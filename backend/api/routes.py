import os
import shutil
import time
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from backend.config import settings
from backend.models.schemas import (
    ChatRequest, ChatResponse, HealthResponse, DocumentInfo,
    SearchRequest, SearchResult, SettingsResponse, SettingsUpdate,
    SummaryRequest, SummaryResponse
)
from backend.rag.loader import DocumentLoader
from backend.rag.text_splitter import RecursiveTextSplitter
from backend.rag.vector_store import VectorStore
from backend.rag.pipeline import RAGPipeline

router = APIRouter(prefix="/api")

# Singleton vector store and RAG pipeline instances
vector_store = VectorStore()
rag_pipeline = RAGPipeline(vector_store)
queries_counter = 0

SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".bmp"]

def index_all_documents():
    """Helper function to load and index all files in DOCUMENTS_DIR."""
    vector_store.clear()
    docs_dir = settings.DOCUMENTS_DIR
    splitter = RecursiveTextSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)

    total_chunks = []
    if os.path.exists(docs_dir):
        for entry in os.listdir(docs_dir):
            file_path = docs_dir / entry
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                try:
                    sections = DocumentLoader.load_document(file_path)
                    for sec in sections:
                        chunks = splitter.split_section(sec)
                        total_chunks.extend(chunks)
                except Exception as e:
                    print(f"[Indexing Error for {entry}]: {e}")

    if total_chunks:
        vector_store.add_chunks(total_chunks)
    print(f"[Indexer] Indexed {len(total_chunks)} chunks across document knowledge base.")
    return len(total_chunks)

# Trigger initial indexing if vector store is empty
if len(vector_store.chunks) == 0:
    index_all_documents()


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint returning system status and knowledge base statistics."""
    doc_files = set()
    for chunk in vector_store.chunks:
        doc_files.add(chunk["metadata"].get("source", ""))

    return HealthResponse(
        status="ok",
        documents_count=len(doc_files),
        total_chunks=len(vector_store.chunks),
        queries_count=queries_counter,
        vector_store="active",
        has_gemini_key=bool(settings.GEMINI_API_KEY)
    )


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Chat endpoint executing RAG pipeline for user questions."""
    global queries_counter
    queries_counter += 1
    try:
        response = rag_pipeline.run(
            query=request.message,
            document_id=request.document_id,
            history=request.history
        )
        return response
    except Exception as e:
        print(f"[API Chat Error]: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing your question: {str(e)}"
        )


@router.get("/documents", response_model=List[DocumentInfo])
def list_documents():
    """Returns list of uploaded documents with page count, chunk counts, and indexing status."""
    docs_dir = settings.DOCUMENTS_DIR
    result: List[DocumentInfo] = []

    if not os.path.exists(docs_dir):
        return []

    # Map file -> chunk count and max page
    chunk_counts = {}
    pages_counts = {}
    
    for chunk in vector_store.chunks:
        src = chunk.get("metadata", {}).get("source")
        page = chunk.get("metadata", {}).get("page")
        if src:
            chunk_counts[src] = chunk_counts.get(src, 0) + 1
            if page:
                pages_counts[src] = max(pages_counts.get(src, 1), page)

    for idx, filename in enumerate(os.listdir(docs_dir)):
        filepath = docs_dir / filename
        if filepath.is_file():
            ext = filepath.suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                stat = filepath.stat()
                file_type = ext.replace(".", "").upper()
                indexed_date = time.strftime('%Y-%m-%d %H:%M', time.localtime(stat.st_mtime))
                chunks_cnt = chunk_counts.get(filename, 0)
                pages_cnt = pages_counts.get(filename, 1 if chunks_cnt > 0 else None)

                result.append(DocumentInfo(
                    id=f"doc-{idx+1}",
                    filename=filename,
                    file_type=file_type,
                    file_size=stat.st_size,
                    status="Indexed" if chunks_cnt > 0 else "Pending",
                    chunks_count=chunks_cnt,
                    pages_count=pages_cnt,
                    indexed_at=indexed_date
                ))

    return result


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Uploads a new document (PDF, DOCX, TXT, MD, Images/OCR) and indexes it into the vector store."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload. Filename is missing."
        )

    safe_filename = Path(file.filename).name
    ext = Path(safe_filename).suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Please upload PDF, DOCX, TXT, MD, or Image files."
        )

    MAX_FILE_SIZE = 25 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of 25MB."
        )

    destination = settings.DOCUMENTS_DIR / safe_filename
    try:
        with open(destination, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(e)}"
        )

    try:
        vector_store.delete_document(safe_filename)

        sections = DocumentLoader.load_document(destination)
        splitter = RecursiveTextSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
        chunks = []
        indexed_at = time.strftime('%Y-%m-%d %H:%M')

        for sec in sections:
            split_chunks = splitter.split_section(sec)
            for idx, chk in enumerate(split_chunks):
                chk["metadata"]["source"] = safe_filename
                chk["metadata"]["file_type"] = ext.replace(".", "").upper()
                chk["metadata"]["chunk_index"] = idx
                chk["metadata"]["indexed_at"] = indexed_at
                chunks.append(chk)

        if not chunks:
            if destination.exists():
                os.remove(destination)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The uploaded document '{safe_filename}' contains no extractable text content."
            )

        vector_store.add_chunks(chunks)

        return {
            "message": f"Successfully uploaded and indexed '{safe_filename}'.",
            "filename": safe_filename,
            "chunks_count": len(chunks),
            "status": "Indexed",
            "indexed_at": indexed_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index document '{safe_filename}': {str(e)}"
        )


@router.post("/documents/{filename}/summarize", response_model=SummaryResponse)
def summarize_document(filename: str, request: SummaryRequest = SummaryRequest()):
    """Generates a summary for a specific uploaded document."""
    return rag_pipeline.summarize_document(filename=filename, summary_type=request.summary_type)


@router.delete("/documents/{filename}")
def delete_document(filename: str):
    """Deletes a document file from storage and removes its vector index."""
    filepath = settings.DOCUMENTS_DIR / filename
    deleted_chunks = vector_store.delete_document(filename)

    if filepath.exists():
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"[Error removing file {filename}]: {e}")

    return {
        "message": f"Document '{filename}' deleted.",
        "deleted_chunks": deleted_chunks
    }


@router.post("/documents/reindex")
def reindex_knowledge_base():
    """Triggers complete re-indexing of all documents in knowledge base directory."""
    try:
        total_chunks = index_all_documents()
        return {
            "message": "Knowledge base re-indexed successfully.",
            "total_chunks": total_chunks,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Re-indexing failed: {str(e)}"
        )


@router.post("/search", response_model=List[SearchResult])
def search_knowledge_base(request: SearchRequest):
    """Executes standalone semantic vector search against knowledge base."""
    results = vector_store.search(
        query=request.query,
        top_k=request.top_k or 5,
        threshold=0.0,
        document_id=request.document_id
    )

    output = []
    for idx, item in enumerate(results):
        meta = item.get("metadata", {})
        output.append(SearchResult(
            id=item.get("id", f"chk-{idx}"),
            document=meta.get("source", "Unknown"),
            section=meta.get("section", "General"),
            page=meta.get("page"),
            score=item.get("score", 0.0),
            snippet=item.get("text", ""),
            chunk_index=meta.get("chunk_index", 0)
        ))

    return output


@router.get("/settings", response_model=SettingsResponse)
def get_settings():
    """Returns current configuration parameters."""
    masked_key = ""
    if settings.GEMINI_API_KEY:
        key = settings.GEMINI_API_KEY
        masked_key = key[:4] + "..." + key[-4:] if len(key) > 8 else "****"

    return SettingsResponse(
        has_gemini_key=bool(settings.GEMINI_API_KEY),
        gemini_api_key_masked=masked_key,
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        top_k=settings.TOP_K_RESULTS,
        similarity_threshold=settings.SIMILARITY_THRESHOLD
    )


@router.post("/settings", response_model=SettingsResponse)
def update_settings(update: SettingsUpdate):
    """Updates runtime configuration settings."""
    if update.gemini_api_key is not None:
        settings.GEMINI_API_KEY = update.gemini_api_key.strip()
        vector_store.update_api_key(settings.GEMINI_API_KEY)

    if update.chunk_size is not None:
        settings.CHUNK_SIZE = update.chunk_size

    if update.chunk_overlap is not None:
        settings.CHUNK_OVERLAP = update.chunk_overlap

    if update.top_k is not None:
        settings.TOP_K_RESULTS = update.top_k

    if update.similarity_threshold is not None:
        settings.SIMILARITY_THRESHOLD = update.similarity_threshold

    return get_settings()

