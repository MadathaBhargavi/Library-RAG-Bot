import re
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.rag.vector_store import VectorStore
from backend.models.schemas import SourceCitation, ChatResponse, ChatMessage

class RAGPipeline:
    """Complete Retrieval-Augmented Generation (RAG) Orchestration Pipeline."""

    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store

    def run(self, query: str, history: Optional[List[ChatMessage]] = None) -> ChatResponse:
        query_str = query.strip()
        if not query_str:
            return ChatResponse(
                answer="Please enter a valid question about library rules, books, services, or resources.",
                sources=[],
                retrieved_chunks_count=0,
                engine="Input Validation"
            )

        # 1. Retrieve relevant chunks
        top_k = settings.TOP_K_RESULTS
        retrieved_chunks = self.vector_store.search(
            query=query_str,
            top_k=top_k,
            threshold=settings.SIMILARITY_THRESHOLD
        )

        # Build source citations
        sources: List[SourceCitation] = []
        context_parts: List[str] = []

        for idx, chunk in enumerate(retrieved_chunks):
            meta = chunk["metadata"]
            src_doc = meta.get("source", "Unknown Document")
            sec_title = meta.get("section", "General")
            page_num = meta.get("page")
            score = chunk.get("score", 0.0)
            text_excerpt = chunk["text"]

            sources.append(SourceCitation(
                document=src_doc,
                section=sec_title,
                page=page_num,
                score=score,
                snippet=text_excerpt[:180] + ("..." if len(text_excerpt) > 180 else "")
            ))

            context_parts.append(
                f"[Source {idx+1}: {src_doc} | Section: {sec_title}" + 
                (f" | Page {page_num}" if page_num else "") + f"]\n{text_excerpt}"
            )

        context_str = "\n\n".join(context_parts)

        # 2. Check if we have valid context (if best score is extremely low or no chunks retrieved)
        is_relevant = len(retrieved_chunks) > 0 and retrieved_chunks[0].get("score", 0.0) >= 0.12

        if not is_relevant:
            return ChatResponse(
                answer="I couldn't find that information in the library knowledge base. Please try another question or contact the library staff.",
                sources=[],
                retrieved_chunks_count=0,
                engine="Library Knowledge Base Filter"
            )

        # 3. Generate answer using Gemini API or Local RAG Engine
        api_key = settings.GEMINI_API_KEY
        if api_key:
            try:
                answer = self._generate_with_gemini(api_key, query_str, context_str, history)
                return ChatResponse(
                    answer=answer,
                    sources=sources,
                    retrieved_chunks_count=len(retrieved_chunks),
                    engine="Google Gemini API (gemini-2.5-flash)"
                )
            except Exception as e:
                print(f"[RAGPipeline] Gemini generation failed: {e}. Falling back to Local RAG Synthesizer.")

        # Local Grounded RAG Generation Fallback
        answer = self._generate_local_grounded(query_str, retrieved_chunks)
        return ChatResponse(
            answer=answer,
            sources=sources,
            retrieved_chunks_count=len(retrieved_chunks),
            engine="Local Precision RAG Engine"
        )

    def _generate_with_gemini(self, api_key: str, query: str, context: str, history: Optional[List[ChatMessage]]) -> str:
        from google import genai

        client = genai.Client(api_key=api_key)

        system_prompt = (
            "You are the official Library RAG Assistant for Central City Library.\n"
            "Strict Instructions:\n"
            "1. Answer the user's question using ONLY the provided Library Knowledge Base context below.\n"
            "2. Do NOT invent, assume, or fabricate any facts outside of the provided context.\n"
            "3. If the context does not contain sufficient details to answer the question, clearly state: "
            "'I couldn't find that information in the library knowledge base. Please try another question or contact the library staff.'\n"
            "4. Keep answers concise, helpful, and professional. Use markdown lists and bold text where appropriate.\n"
            "5. Explicitly cite the document names referenced in your answer.\n\n"
            f"LIBRARY KNOWLEDGE BASE CONTEXT:\n{context}"
        )

        chat_contents = [system_prompt]

        if history:
            for msg in history[-4:]: # include recent turns
                chat_contents.append(f"{msg.role.upper()}: {msg.content}")

        chat_contents.append(f"USER QUESTION: {query}")

        prompt_text = "\n\n".join(chat_contents)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_text
        )

        return response.text.strip()

    def _generate_local_grounded(self, query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
        """High-precision local synthesis engine that formats retrieved facts directly from context."""
        query_words = set(re.findall(r'\w+', query.lower())) - {'what', 'is', 'are', 'the', 'how', 'do', 'can', 'i', 'for', 'in', 'of', 'to', 'a', 'an'}

        paragraphs = []
        used_docs = set()

        for chunk in retrieved_chunks:
            text = chunk["text"]
            meta = chunk["metadata"]
            doc_name = meta.get("source", "Document")
            sec_name = meta.get("section", "Section")
            used_docs.add(doc_name)

            # Filter relevant sentences
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
            relevant_sentences = []

            for sent in sentences:
                sent_words = set(re.findall(r'\w+', sent.lower()))
                # sentence matches some query intent or provides context
                if sent_words & query_words or len(relevant_sentences) < 2:
                    relevant_sentences.append(sent)

            if relevant_sentences:
                clean_text = " ".join(relevant_sentences)
                paragraphs.append(f"**From {doc_name} ({sec_name})**:\n{clean_text}")

        if not paragraphs:
            return "I couldn't find that information in the library knowledge base. Please try another question or contact the library staff."

        intro = "Based on the Central City Library Knowledge Base:\n\n"
        body = "\n\n".join(paragraphs)
        return intro + body
