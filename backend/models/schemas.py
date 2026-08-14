from typing import List, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")

class ChatRequest(BaseModel):
    message: str = Field(..., description="User question or message")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Previous chat messages")

class SourceCitation(BaseModel):
    document: str = Field(..., description="Source document file name")
    section: str = Field("General", description="Section heading or topic")
    page: Optional[int] = Field(None, description="Page number if applicable")
    score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    snippet: str = Field(..., description="Text excerpt from the source chunk")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated RAG answer")
    sources: List[SourceCitation] = Field(default_factory=list, description="Source documents used")
    retrieved_chunks_count: int = Field(0, description="Total chunks retrieved")
    engine: str = Field("Local RAG Generator", description="RAG Generation engine used")

class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunks_count: int
    indexed_at: str

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5

class SearchResult(BaseModel):
    id: str
    document: str
    section: str
    score: float
    snippet: str
    chunk_index: int

class HealthResponse(BaseModel):
    status: str
    documents_count: int
    total_chunks: int
    vector_store: str
    has_gemini_key: bool

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None

class SettingsResponse(BaseModel):
    has_gemini_key: bool
    gemini_api_key_masked: str
    chunk_size: int
    chunk_overlap: int
    top_k: int
    similarity_threshold: float
