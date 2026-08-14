import numpy as np
from typing import List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from backend.config import settings

class EmbeddingEngine:
    """Provides vector embeddings using Gemini API (if key present) or local TF-IDF vectorizer."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.genai_client = None
        self.tfidf_vectorizer = None
        self._init_client()

    def _init_client(self):
        if self.api_key:
            try:
                from google import genai
                self.genai_client = genai.Client(api_key=self.api_key)
                print("[EmbeddingEngine] Initialized Gemini API embedding client.")
            except Exception as e:
                print(f"[EmbeddingEngine] Failed to initialize Gemini API client: {e}. Falling back to local embedding engine.")
                self.genai_client = None
        else:
            print("[EmbeddingEngine] No Gemini API key provided. Using local TF-IDF vector engine.")

    def fit_local_vectorizer(self, corpus: List[str]):
        """Fits the local TF-IDF vectorizer on document corpus."""
        if not corpus:
            return
        self.tfidf_vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words='english',
            max_features=5000,
            sublinear_tf=True
        )
        self.tfidf_vectorizer.fit(corpus)
        print(f"[EmbeddingEngine] Fitted local vectorizer on corpus size {len(corpus)}.")

    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """Returns normalized 2D numpy array of embeddings (shape: [num_texts, dim])."""
        if not texts:
            return np.array([])

        if self.genai_client:
            try:
                embeddings_list = []
                # Batch request to Gemini embedding API
                for t in texts:
                    res = self.genai_client.models.embed_content(
                        model="text-embedding-004",
                        contents=t
                    )
                    emb = res.embedding.values
                    embeddings_list.append(emb)
                
                arr = np.array(embeddings_list, dtype=np.float32)
                # Normalize L2
                norms = np.linalg.norm(arr, axis=1, keepdims=True)
                norms[norms == 0] = 1e-10
                return arr / norms
            except Exception as e:
                print(f"[EmbeddingEngine] Gemini Embedding call failed: {e}. Falling back to local vectorizer.")

        # Local TF-IDF fallback
        if self.tfidf_vectorizer is None:
            self.fit_local_vectorizer(texts)

        sparse_mat = self.tfidf_vectorizer.transform(texts)
        dense_arr = sparse_mat.toarray().astype(np.float32)
        norms = np.linalg.norm(dense_arr, axis=1, keepdims=True)
        norms[norms == 0] = 1e-10
        return dense_arr / norms

    def get_query_embedding(self, query: str) -> np.ndarray:
        """Returns normalized 1D numpy vector for query."""
        if self.genai_client:
            try:
                res = self.genai_client.models.embed_content(
                    model="text-embedding-004",
                    contents=query
                )
                emb = np.array(res.embedding.values, dtype=np.float32)
                norm = np.linalg.norm(emb)
                return emb / (norm if norm > 0 else 1e-10)
            except Exception as e:
                print(f"[EmbeddingEngine] Gemini Query Embedding call failed: {e}. Falling back to local vectorizer.")

        if self.tfidf_vectorizer is None:
            self.fit_local_vectorizer([query])

        sparse_mat = self.tfidf_vectorizer.transform([query])
        dense_arr = sparse_mat.toarray().astype(np.float32)[0]
        norm = np.linalg.norm(dense_arr)
        return dense_arr / (norm if norm > 0 else 1e-10)
