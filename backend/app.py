from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.agent_service import DocumentStore, run_agent_query


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "rag.sqlite"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Agentic RAG Document Workflow API", version="1.0.0")
store = DocumentStore(DB_PATH)

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
    return {"status": "ok"}


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

    document = store.add_document(name=safe_name, content=extracted_text, size_bytes=len(content))
    return document


@app.post("/api/agent/runs")
def create_agent_run(request: AgentRunRequest):
    return run_agent_query(store=store, query=request.query, settings=request.settings)
