from typing import List, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")

class ChatRequest(BaseModel):
    message: str = Field(..., description="User question or message")
    document_id: Optional[str] = Field(None, description="Optional target document filename for single-doc mode")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Previous chat messages")

class SourceCitation(BaseModel):
    document: str = Field(..., description="Source document file name")
    section: str = Field("General", description="Section heading or topic")
    page: Optional[int] = Field(None, description="Page number if applicable")
    score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    snippet: str = Field(..., description="Text excerpt from the source chunk")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated RAG answer")
    sources: List[SourceCitation] = Field(default_factory=list, description="Unique source documents used")
    retrieved_context: List[SourceCitation] = Field(default_factory=list, description="Detailed list of retrieved context chunks")
    retrieved_chunks_count: int = Field(0, description="Total chunks retrieved")
    engine: str = Field("Local Precision RAG Engine", description="RAG Generation engine used")

class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunks_count: int
    pages_count: Optional[int] = None
    author: Optional[str] = None
    indexed_at: str

class SearchRequest(BaseModel):
    query: str
    document_id: Optional[str] = None
    top_k: Optional[int] = 5

class SearchResult(BaseModel):
    id: str
    document: str
    section: str
    page: Optional[int] = None
    score: float
    snippet: str
    chunk_index: int

class SummaryRequest(BaseModel):
    summary_type: str = Field("full", description="'full', 'chapters', or 'key_points'")

class SummaryResponse(BaseModel):
    filename: str
    summary_type: str
    summary: str
    chunks_analyzed: int

class HealthResponse(BaseModel):
    status: str
    documents_count: int
    total_chunks: int
    queries_count: int = 0
    vector_store: str
    has_gemini_key: bool

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None

class SettingsResponse(BaseModel):
    has_gemini_key: bool
    gemini_api_key_masked: str
    chunk_size: int
    chunk_overlap: int
    top_k: int
    similarity_threshold: float

