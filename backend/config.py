import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    def __init__ (self):
        self.GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "") or os.getenv("LLM_API_KEY", "")
        self.HOST: str = os.getenv("HOST", "127.0.0.1")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
        
        self.DOCUMENTS_DIR: Path = BASE_DIR / os.getenv("DOCUMENTS_DIR", "documents/sample_library_data")
        self.VECTOR_STORE_DIR: Path = BASE_DIR / os.getenv("VECTOR_STORE_DIR", "vector_store")
        
        self.CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "600"))
        self.CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "100"))
        self.TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "4"))
        self.SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.15"))
        
        # Ensure directories exist
        os.makedirs(self.DOCUMENTS_DIR, exist_ok=True)
        os.makedirs(self.VECTOR_STORE_DIR, exist_ok=True)

settings = Settings()
