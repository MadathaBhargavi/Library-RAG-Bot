import os
import shutil
import time
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from backend.config import settings
from backend.models.schemas import (
    ChatRequest, ChatResponse, HealthResponse, DocumentInfo,
    SearchRequest, SearchResult, SettingsResponse, SettingsUpdate
)
from backend.rag.loader import DocumentLoader
from backend.rag.text_splitter import RecursiveTextSplitter
from backend.rag.vector_store import VectorStore
from backend.rag.pipeline import RAGPipeline

router = APIRouter(prefix="/api")

# Singleton vector store and RAG pipeline instances
vector_store = VectorStore()
rag_pipeline = RAGPipeline(vector_store)

def index_all_documents():
    """Helper function to load and index all files in DOCUMENTS_DIR."""
    vector_store.clear()
    docs_dir = settings.DOCUMENTS_DIR
    splitter = RecursiveTextSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)

    total_chunks = []
    if os.path.exists(docs_dir):
        for entry in os.listdir(docs_dir):
            file_path = docs_dir / entry
            if file_path.is_file() and file_path.suffix.lower() in [".pdf", ".docx", ".txt", ".md"]:
                try:
                    sections = DocumentLoader.load_document(file_path)
                    for sec in sections:
                        chunks = splitter.split_section(sec)
                        total_chunks.extend(chunks)
                except Exception as e:
                    print(f"[Indexing Error for {entry}]: {e}")

    if total_chunks:
        vector_store.add_chunks(total_chunks)
    print(f"[Indexer] Indexed {len(total_chunks)} chunks across library knowledge base.")
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
        vector_store="active",
        has_gemini_key=bool(settings.GEMINI_API_KEY)
    )


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Chat endpoint executing RAG pipeline for user questions."""
    try:
        response = rag_pipeline.run(query=request.message, history=request.history)
        return response
    except Exception as e:
        print(f"[API Chat Error]: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing your request: {str(e)}"
        )


@router.get("/documents", response_model=List[DocumentInfo])
def list_documents():
    """Returns list of library documents with chunk counts and status."""
    docs_dir = settings.DOCUMENTS_DIR
    result: List[DocumentInfo] = []

    if not os.path.exists(docs_dir):
        return []

    # Map file -> chunk count
    chunk_counts = {}
    for chunk in vector_store.chunks:
        src = chunk["metadata"].get("source")
        if src:
            chunk_counts[src] = chunk_counts.get(src, 0) + 1

    for idx, filename in enumerate(os.listdir(docs_dir)):
        filepath = docs_dir / filename
        if filepath.is_file():
            ext = filepath.suffix.lower()
            if ext in [".pdf", ".docx", ".txt", ".md"]:
                stat = filepath.stat()
                file_type = ext.replace(".", "").upper()
                indexed_date = time.strftime('%Y-%m-%d %H:%M', time.localtime(stat.st_mtime))
                chunks_cnt = chunk_counts.get(filename, 0)

                result.append(DocumentInfo(
                    id=f"doc-{idx+1}",
                    filename=filename,
                    file_type=file_type,
                    file_size=stat.st_size,
                    status="Indexed" if chunks_cnt > 0 else "Pending",
                    chunks_count=chunks_cnt,
                    indexed_at=indexed_date
                ))

    return result


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Uploads a new document (.pdf, .docx, .txt, .md) and indexes it into the vector store."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload. Filename is missing."
        )

    # Sanitize filename to prevent path traversal
    safe_filename = Path(file.filename).name
    ext = Path(safe_filename).suffix.lower()

    if ext not in [".pdf", ".docx", ".txt", ".md"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Please upload PDF, DOCX, TXT, or MD files."
        )

    # Enforce maximum file size (20 MB)
    MAX_FILE_SIZE = 20 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of 20MB."
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

    # Ingest and index uploaded document
    try:
        # Purge existing chunks if re-uploading same file name (deduplication)
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
            # Cleanup saved file if no readable text could be extracted
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
        threshold=0.0
    )

    output = []
    for idx, item in enumerate(results):
        meta = item["metadata"]
        output.append(SearchResult(
            id=item.get("id", f"chk-{idx}"),
            document=meta.get("source", "Unknown"),
            section=meta.get("section", "General"),
            score=item.get("score", 0.0),
            snippet=item["text"],
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

    return get_settings()
