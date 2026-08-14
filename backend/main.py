import sys
import uvicorn
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import settings
from backend.api.routes import router as api_router

app = FastAPI(
    title="Library RAG Bot API",
    description="Retrieval-Augmented Generation (RAG) AI Chatbot for Library Knowledge Base",
    version="1.0.0"
)

# Enable CORS for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router)

# Mount Frontend Static Assets
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

    @app.get("/")
    async def serve_index():
        index_path = frontend_dir / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"message": "Library RAG Bot Backend Server Running. Frontend index.html not found."}

    @app.get("/style.css")
    async def serve_css():
        css_path = frontend_dir / "style.css"
        if css_path.exists():
            return FileResponse(str(css_path), media_type="text/css")
        return FileResponse(str(frontend_dir / "index.html"))

    @app.get("/script.js")
    async def serve_js():
        js_path = frontend_dir / "script.js"
        if js_path.exists():
            return FileResponse(str(js_path), media_type="application/javascript")
        return FileResponse(str(frontend_dir / "index.html"))

if __name__ == "__main__":
    print(f"Starting Library RAG Bot Server on http://{settings.HOST}:{settings.PORT}")
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
