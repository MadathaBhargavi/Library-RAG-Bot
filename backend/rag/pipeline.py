import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.rag.vector_store import VectorStore
from backend.models.schemas import SourceCitation, ChatResponse, ChatMessage, SummaryResponse

class RAGPipeline:
    """Complete Retrieval-Augmented Generation (RAG) Orchestration Pipeline for Books & Documents."""

    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store

    def run(self, query: str, document_id: Optional[str] = None, history: Optional[List[ChatMessage]] = None) -> ChatResponse:
        query_str = query.strip()
        if not query_str:
            return ChatResponse(
                answer="Please enter a valid question about your uploaded books or documents.",
                sources=[],
                retrieved_context=[],
                retrieved_chunks_count=0,
                engine="Input Validation"
            )

        # 1. Retrieve relevant chunks
        top_k = settings.TOP_K_RESULTS
        retrieved_chunks = self.vector_store.search(
            query=query_str,
            top_k=top_k,
            threshold=settings.SIMILARITY_THRESHOLD,
            document_id=document_id
        )

        # Build detailed source citations and context chunks
        retrieved_context: List[SourceCitation] = []
        unique_sources_map: Dict[str, SourceCitation] = {}
        context_parts: List[str] = []

        for idx, chunk in enumerate(retrieved_chunks):
            meta = chunk.get("metadata", {})
            src_doc = meta.get("source", "Unknown Document")
            sec_title = meta.get("section", "General")
            page_num = meta.get("page")
            score = chunk.get("score", 0.0)
            text_excerpt = chunk.get("text", "")

            citation = SourceCitation(
                document=src_doc,
                section=sec_title,
                page=page_num,
                score=score,
                snippet=text_excerpt[:250] + ("..." if len(text_excerpt) > 250 else "")
            )
            retrieved_context.append(citation)

            if src_doc not in unique_sources_map or score > unique_sources_map[src_doc].score:
                unique_sources_map[src_doc] = citation

            context_parts.append(
                f"[Source {idx+1}: {src_doc} | Section: {sec_title}" + 
                (f" | Page {page_num}" if page_num else "") + f" | Score: {score}]\n{text_excerpt}"
            )

        context_str = "\n\n".join(context_parts)
        sources_list = list(unique_sources_map.values())

        # 2. Check if we have valid context
        is_relevant = len(retrieved_chunks) > 0 and retrieved_chunks[0].get("score", 0.0) >= 0.05

        if not is_relevant:
            target_doc_text = f"in '{document_id}'" if document_id and document_id != "all" else "in the uploaded documents"
            return ChatResponse(
                answer=f"I couldn't find that information {target_doc_text}.",
                sources=[],
                retrieved_context=[],
                retrieved_chunks_count=0,
                engine="Document Grounding Filter"
            )

        # 3. Generate answer using Gemini API or Local RAG Engine
        api_key = settings.GEMINI_API_KEY
        if api_key:
            try:
                answer = self._generate_with_gemini(api_key, query_str, context_str, history, document_id)
                return ChatResponse(
                    answer=answer,
                    sources=sources_list,
                    retrieved_context=retrieved_context,
                    retrieved_chunks_count=len(retrieved_chunks),
                    engine="Google Gemini API (gemini-2.5-flash)"
                )
            except Exception as e:
                print(f"[RAGPipeline] Gemini generation failed: {e}. Falling back to Local RAG Synthesizer.")

        # Local Grounded RAG Generation Fallback
        answer = self._generate_local_grounded(query_str, retrieved_chunks)
        return ChatResponse(
            answer=answer,
            sources=sources_list,
            retrieved_context=retrieved_context,
            retrieved_chunks_count=len(retrieved_chunks),
            engine="Local Precision RAG Engine"
        )

    def summarize_document(self, filename: str, summary_type: str = "full") -> SummaryResponse:
        """Generates a structured document summary using stored document chunks."""
        doc_chunks = [c for c in self.vector_store.chunks if c.get("metadata", {}).get("source") == filename or Path(c.get("metadata", {}).get("source", "")).name == Path(filename).name]
        
        if not doc_chunks:
            return SummaryResponse(
                filename=filename,
                summary_type=summary_type,
                summary=f"No indexed content found for document '{filename}'.",
                chunks_analyzed=0
            )

        combined_text = "\n\n".join([f"[{c.get('metadata',{}).get('section','General')}]: {c.get('text','')}" for c in doc_chunks[:15]])
        
        api_key = settings.GEMINI_API_KEY
        if api_key:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                
                prompt = (
                    f"You are a professional document analysis assistant. Provide a clear, well-structured {summary_type} summary "
                    f"of the following uploaded document ('{filename}').\n\n"
                    f"SUMMARY STYLE: {summary_type.upper()} SUMMARY\n"
                    "Instructions:\n"
                    "- Focus on key takeaways, main arguments, concepts, and structure.\n"
                    "- Use bullet points, bold headers, and clear sections.\n"
                    "- Ground all points strictly in the provided text.\n\n"
                    f"DOCUMENT TEXT CONTENT:\n{combined_text[:6000]}"
                )
                
                res = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                return SummaryResponse(
                    filename=filename,
                    summary_type=summary_type,
                    summary=res.text.strip(),
                    chunks_analyzed=len(doc_chunks)
                )
            except Exception as e:
                print(f"[RAGPipeline Summarize] Gemini call error: {e}")

        # Local summary fallback
        sections = list(dict.fromkeys([c.get("metadata", {}).get("section", "General") for c in doc_chunks]))
        sample_snippets = [c.get("text", "")[:200] for c in doc_chunks[:5]]
        
        local_summary = (
            f"### Document Summary for `{filename}`\n\n"
            f"- **Total Indexed Chunks**: {len(doc_chunks)}\n"
            f"- **Document Sections**: {', '.join(sections[:8])}\n\n"
            f"**Key Overview**:\n" + "\n\n".join([f"• {snip}..." for snip in sample_snippets])
        )

        return SummaryResponse(
            filename=filename,
            summary_type=summary_type,
            summary=local_summary,
            chunks_analyzed=len(doc_chunks)
        )

    def _generate_with_gemini(self, api_key: str, query: str, context: str, history: Optional[List[ChatMessage]], document_id: Optional[str] = None) -> str:
        from google import genai

        client = genai.Client(api_key=api_key)

        target_scope = f"specifically for the document '{document_id}'" if document_id and document_id != "all" else "across the uploaded documents"

        system_prompt = (
            "You are the official Book and Document RAG Assistant.\n"
            "Strict Instructions:\n"
            f"1. Answer the user's question {target_scope} using ONLY the provided document context below.\n"
            "2. If the user asks about book details (author, title, key concepts, chapter breakdowns, formulas, definitions, code snippets, or overall topic), provide a clear, accurate, and detailed answer directly from the text.\n"
            "3. Do NOT invent, assume, or hallucinate any information outside of the provided document context.\n"
            "4. If the provided document context does NOT contain the answer to the user's question, reply strictly: "
            "'I couldn't find that information in the uploaded document.'\n"
            "5. Keep responses structured, professional, and easy to read with markdown formatting.\n"
            "6. Always mention the relevant document title or page number where applicable.\n\n"
            f"RETRIEVED DOCUMENT CONTEXT:\n{context}"
        )

        chat_contents = [system_prompt]

        if history:
            for msg in history[-4:]:
                chat_contents.append(f"{msg.role.upper()}: {msg.content}")

        chat_contents.append(f"USER QUESTION: {query}")

        prompt_text = "\n\n".join(chat_contents)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_text
        )

        return response.text.strip()

    def _generate_local_grounded(self, query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
        """High-precision local synthesis engine that formats retrieved facts directly from document context."""
        query_words = set(re.findall(r'\w+', query.lower())) - {'what', 'is', 'are', 'the', 'how', 'do', 'can', 'i', 'for', 'in', 'of', 'to', 'a', 'an', 'about'}

        paragraphs = []
        used_docs = set()

        for chunk in retrieved_chunks:
            text = chunk["text"]
            meta = chunk["metadata"]
            doc_name = meta.get("source", "Document")
            sec_name = meta.get("section", "Section")
            page_num = meta.get("page")
            used_docs.add(doc_name)

            page_str = f" Page {page_num}," if page_num else ""
            
            # Filter relevant sentences
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
            relevant_sentences = []

            for sent in sentences:
                sent_words = set(re.findall(r'\w+', sent.lower()))
                if sent_words & query_words or len(relevant_sentences) < 2:
                    relevant_sentences.append(sent)

            if relevant_sentences:
                clean_text = " ".join(relevant_sentences[:4])
                paragraphs.append(f"**From `{doc_name}` ({sec_name},{page_str} Score: {chunk.get('score', 0.0)})**:\n{clean_text}")

        if not paragraphs:
            return "I couldn't find that information in the uploaded document."

        intro = "Based on your uploaded document content:\n\n"
        body = "\n\n".join(paragraphs)
        return intro + body

