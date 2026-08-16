import os
import json
import uuid
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.rag.embeddings import EmbeddingEngine

class VectorStore:
    """In-memory and persistent vector database with metadata filtering and cosine similarity search."""

    def __init__(self, persistence_dir: Optional[Path] = None):
        self.persistence_dir = persistence_dir or settings.VECTOR_STORE_DIR
        os.makedirs(self.persistence_dir, exist_ok=True)

        self.store_file = self.persistence_dir / "index_store.json"
        self.matrix_file = self.persistence_dir / "embeddings.npy"

        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: Optional[np.ndarray] = None
        self.embedding_engine = EmbeddingEngine()

        self.load_from_disk()

    def update_api_key(self, api_key: str):
        self.embedding_engine = EmbeddingEngine(api_key=api_key)

    def add_chunks(self, new_chunks: List[Dict[str, Any]]):
        """Adds new chunks, computes embeddings, and updates store."""
        if not new_chunks:
            return

        texts = [c["text"] for c in new_chunks]
        
        # Make sure local vectorizer fits full corpus if needed
        all_texts = [c["text"] for c in self.chunks] + texts
        self.embedding_engine.fit_local_vectorizer(all_texts)

        new_embeddings = self.embedding_engine.get_embeddings(texts)

        for idx, chunk in enumerate(new_chunks):
            chunk_id = str(uuid.uuid4())
            chunk["id"] = chunk_id
            self.chunks.append(chunk)

        if self.embeddings is None or self.embeddings.size == 0:
            self.embeddings = new_embeddings
        else:
            # Handle dimension mismatch if switching engines
            if self.embeddings.shape[1] == new_embeddings.shape[1]:
                self.embeddings = np.vstack([self.embeddings, new_embeddings])
            else:
                # Re-embed all chunks if dimensions changed
                print("[VectorStore] Embedding dimension changed. Re-embedding all chunks...")
                all_embeddings = self.embedding_engine.get_embeddings([c["text"] for c in self.chunks])
                self.embeddings = all_embeddings

        self.save_to_disk()

    def search(self, query: str, top_k: int = 4, threshold: float = 0.05, document_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Executes cosine similarity search against stored embeddings with optional document filtering."""
        if not self.chunks or self.embeddings is None or len(self.chunks) == 0:
            return []

        query_vec = self.embedding_engine.get_query_embedding(query)

        # Dimension match check
        if query_vec.shape[0] != self.embeddings.shape[1]:
            print("[VectorStore] Query embedding dimension mismatch. Re-calculating corpus embeddings...")
            all_texts = [c["text"] for c in self.chunks]
            self.embedding_engine.fit_local_vectorizer(all_texts)
            self.embeddings = self.embedding_engine.get_embeddings(all_texts)
            query_vec = self.embedding_engine.get_query_embedding(query)

        # Dot product of normalized vectors = Cosine similarity
        scores = np.dot(self.embeddings, query_vec)
        
        # Rank indices by score descending
        ranked_indices = np.argsort(scores)[::-1]

        results = []
        for idx in ranked_indices:
            score = float(scores[idx])
            chunk = self.chunks[idx].copy()
            
            # Apply document filter if requested
            if document_id and document_id != "all":
                source = chunk.get("metadata", {}).get("source", "")
                if source != document_id and Path(source).name != Path(document_id).name:
                    continue

            if score < threshold and len(results) > 0:
                continue

            chunk["score"] = round(score, 4)
            results.append(chunk)

            if len(results) >= top_k:
                break

        return results

    def delete_document(self, filename: str) -> int:
        """Deletes all chunks belonging to a document filename."""
        indices_to_keep = [i for i, c in enumerate(self.chunks) if c["metadata"]["source"] != filename]
        deleted_count = len(self.chunks) - len(indices_to_keep)

        if deleted_count > 0:
            self.chunks = [self.chunks[i] for i in indices_to_keep]
            if indices_to_keep and self.embeddings is not None:
                self.embeddings = self.embeddings[indices_to_keep]
            else:
                self.embeddings = None

            # Re-fit local vectorizer
            if self.chunks:
                self.embedding_engine.fit_local_vectorizer([c["text"] for c in self.chunks])
            self.save_to_disk()

        return deleted_count

    def clear(self):
        """Clears all vector store data."""
        self.chunks = []
        self.embeddings = None
        if os.path.exists(self.store_file):
            os.remove(self.store_file)
        if os.path.exists(self.matrix_file):
            os.remove(self.matrix_file)

    def save_to_disk(self):
        """Persists store metadata and embeddings matrix to disk."""
        try:
            with open(self.store_file, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, indent=2)

            if self.embeddings is not None:
                np.save(self.matrix_file, self.embeddings)
            print(f"[VectorStore] Saved {len(self.chunks)} chunks to disk.")
        except Exception as e:
            print(f"[VectorStore Error saving to disk]: {e}")

    def load_from_disk(self):
        """Loads store metadata and embeddings matrix from disk."""
        if os.path.exists(self.store_file) and os.path.exists(self.matrix_file):
            try:
                with open(self.store_file, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)

                self.embeddings = np.load(self.matrix_file)
                if self.chunks:
                    all_texts = [c["text"] for c in self.chunks]
                    self.embedding_engine.fit_local_vectorizer(all_texts)
                print(f"[VectorStore] Loaded {len(self.chunks)} chunks from disk.")
            except Exception as e:
                print(f"[VectorStore Error loading from disk]: {e}")
                self.chunks = []
                self.embeddings = None
