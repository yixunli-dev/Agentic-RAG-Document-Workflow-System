from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.agent_service import DocumentStore, index_document_for_retrieval, run_agent_query
from backend.exceptions import ApplicationError
from backend.services.embedding_service import EmbeddingService
from backend.services.llm_service import LLMService
from backend.services.vector_store_service import VectorStoreService


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "rag.sqlite"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Agentic RAG Document Workflow API", version="1.0.0")
store = DocumentStore(DB_PATH)
embedding_service = EmbeddingService()
vector_store = VectorStoreService()
llm_service = LLMService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRunRequest(BaseModel):
    query: str = Field(..., min_length=1)
    settings: dict = Field(default_factory=dict)


def extract_text_from_pdf(path):
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        text_by_page = []
        for page_index, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_by_page.append(f"Page {page_index}: {page_text}")
        return "\n\n".join(text_by_page).strip()
    except Exception:
        return path.read_bytes().decode("utf-8", errors="ignore")


@app.get("/api/health")
def health():
    services = {"api": "ok"}
    try:
        with store._connect() as connection:
            connection.execute("SELECT 1").fetchone()
        services["sqlite"] = "ok"
    except Exception:
        services["sqlite"] = "unavailable"

    try:
        services["embedding_model"] = "ok" if embedding_service.dimension else "unknown"
    except Exception:
        services["embedding_model"] = "unavailable"

    try:
        services["qdrant"] = "ok" if vector_store.collection_exists() else "missing_collection"
    except Exception:
        services["qdrant"] = "unavailable"

    services.update(llm_service.health())
    status = "ok" if all(value == "ok" for value in services.values()) else "degraded"
    return {"status": status, "services": services}


@app.get("/api/documents")
def list_documents():
    return {"documents": store.list_documents()}


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    safe_name = Path(file.filename).name
    target_path = UPLOAD_DIR / safe_name
    content = await file.read()
    target_path.write_bytes(content)

    extracted_text = extract_text_from_pdf(target_path)
    if not extracted_text.strip():
        extracted_text = f"Uploaded file {safe_name} did not contain extractable text."

    try:
        return index_document_for_retrieval(
            store=store,
            vector_store=vector_store,
            embedding_service=embedding_service,
            name=safe_name,
            content=extracted_text,
            size_bytes=len(content),
        )
    except ApplicationError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error


@app.post("/api/agent/runs")
def create_agent_run(request: AgentRunRequest):
    try:
        return run_agent_query(
            store=store,
            query=request.query,
            settings=request.settings,
            embedding_service=embedding_service,
            vector_store=vector_store,
            llm_service=llm_service,
        )
    except ApplicationError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
