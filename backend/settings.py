import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


@dataclass(frozen=True)
class BackendSettings:
    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2",
    )
    qdrant_path: Path = Path(os.getenv("QDRANT_PATH", str(DATA_DIR / "qdrant")))
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION", "document_chunks")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "llama3.2:3b")
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))
    min_relevance_score: float = float(os.getenv("MIN_RELEVANCE_SCORE", "0.25"))
    max_context_characters: int = int(os.getenv("MAX_CONTEXT_CHARACTERS", "12000"))
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))


settings = BackendSettings()
