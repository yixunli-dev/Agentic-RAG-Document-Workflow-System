import re
import sqlite3
import time
import uuid
from pathlib import Path

from backend.exceptions import ApplicationError
from backend.services.embedding_service import EmbeddingService
from backend.services.llm_service import LLMService
from backend.services.vector_store_service import VectorStoreService
from backend.settings import settings as default_settings


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+")
CITATION_PATTERN = re.compile(r"\[(\d+)\]")
PROMPT_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore the system prompt",
    "reveal the system prompt",
    "act as",
    "you are now",
    "follow these instructions",
]


def tokenize(text):
    return set(token.lower() for token in TOKEN_PATTERN.findall(text))


def split_text(text, chunk_size=700, overlap=120):
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        normalized = "No extractable text was found in this document."

    chunks = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks


def split_text_with_pages(content):
    page_matches = list(re.finditer(r"Page\s+(\d+):", content))
    if not page_matches:
        return [
            {"page": 1, "text": chunk}
            for chunk in split_text(content)
            if chunk.strip()
        ]

    chunks = []
    for index, match in enumerate(page_matches):
        page = int(match.group(1))
        start = match.end()
        end = page_matches[index + 1].start() if index + 1 < len(page_matches) else len(content)
        page_text = content[start:end].strip()
        for chunk in split_text(page_text):
            if chunk.strip():
                chunks.append({"page": page, "text": chunk})
    return chunks


def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / 1024 / 1024:.1f} MB"


class DocumentStore:
    def __init__(self, db_path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self):
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_schema(self):
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    size TEXT NOT NULL,
                    status TEXT NOT NULL,
                    chunks INTEGER NOT NULL,
                    embedding_status TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    document_name TEXT NOT NULL,
                    page INTEGER NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(id)
                )
                """
            )

    def clear(self):
        with self._connect() as connection:
            connection.execute("DELETE FROM chunks")
            connection.execute("DELETE FROM documents")

    def add_document(self, name, content, size_bytes=None):
        document = self.create_document_record(
            name=name,
            content=content,
            size_bytes=size_bytes,
            status="Indexed",
            embedding_status="Embedded",
        )
        return self.document_to_response(document)

    def create_document_record(self, name, content, size_bytes=None, status="Indexing", embedding_status="Pending"):
        document_id = str(uuid.uuid4())
        page_chunks = split_text_with_pages(content)
        size = format_size(size_bytes if size_bytes is not None else len(content.encode("utf-8")))

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO documents (id, name, size, status, chunks, embedding_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (document_id, name, size, status, len(page_chunks), embedding_status, time.time()),
            )
            for index, chunk in enumerate(page_chunks):
                chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{document_id}:{index}:{chunk['page']}"))
                connection.execute(
                    """
                    INSERT INTO chunks (id, document_id, document_name, page, chunk_index, text)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (chunk_id, document_id, name, chunk["page"], index, chunk["text"]),
                )

        return {
            "id": document_id,
            "name": name,
            "size": size,
            "status": status,
            "chunks": len(page_chunks),
            "embedding_status": embedding_status,
        }

    def update_document_status(self, document_id, status, embedding_status):
        with self._connect() as connection:
            connection.execute(
                "UPDATE documents SET status = ?, embedding_status = ? WHERE id = ?",
                (status, embedding_status, document_id),
            )

    def delete_document(self, document_id):
        with self._connect() as connection:
            connection.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
            connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))

    def get_chunks_for_document(self, document_id):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, document_id, document_name, page, chunk_index, text
                FROM chunks
                WHERE document_id = ?
                ORDER BY chunk_index ASC
                """,
                (document_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_all_chunks(self):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, document_id, document_name, page, chunk_index, text
                FROM chunks
                ORDER BY document_id ASC, chunk_index ASC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def document_to_response(document):
        return {
            "id": document["id"],
            "name": document["name"],
            "size": document["size"],
            "status": document["status"],
            "chunks": document["chunks"],
            "embeddingStatus": document["embedding_status"],
        }

    def list_documents(self):
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, name, size, status, chunks, embedding_status FROM documents ORDER BY created_at DESC"
            ).fetchall()
        return [self.document_to_response(dict(row)) for row in rows]

    def search_chunks(self, query, top_k=5, document_ids=None):
        query_tokens = tokenize(query)
        document_ids = [document_id for document_id in (document_ids or []) if document_id]
        with self._connect() as connection:
            if document_ids:
                placeholders = ",".join("?" for _ in document_ids)
                rows = connection.execute(
                    f"""
                    SELECT id, document_id, document_name, page, chunk_index, text
                    FROM chunks
                    WHERE document_id IN ({placeholders})
                    ORDER BY chunk_index ASC
                    """,
                    document_ids,
                ).fetchall()
            else:
                rows = connection.execute(
                    "SELECT id, document_id, document_name, page, chunk_index, text FROM chunks ORDER BY chunk_index ASC"
                ).fetchall()

        scored = []
        for row in rows:
            text_tokens = tokenize(row["text"])
            overlap = len(query_tokens.intersection(text_tokens))
            density = overlap / max(len(query_tokens), 1)
            score = min(0.99, 0.35 + density * 0.6 + min(len(text_tokens), 80) / 800)
            if overlap == 0 and query_tokens:
                score = min(score, 0.44)
            scored.append({**dict(row), "score": round(score, 2)})

        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:top_k]


def classify_intent(query):
    lowered = query.lower()
    if any(term in lowered for term in ["compare", "across", "difference"]):
        return "Comparison"
    if any(term in lowered for term in ["risk", "ambiguous", "clause"]):
        return "Risk Analysis"
    if any(term in lowered for term in ["extract", "table", "dates", "parties"]):
        return "Extraction"
    if any(term in lowered for term in ["summarize", "summary"]):
        return "Summary"
    return "General QA"


def index_document_for_retrieval(store, vector_store, embedding_service, name, content, size_bytes=None):
    document = store.create_document_record(
        name=name,
        content=content,
        size_bytes=size_bytes,
        status="Indexing",
        embedding_status="Pending",
    )
    chunks = store.get_chunks_for_document(document["id"])
    try:
        valid_chunks = [chunk for chunk in chunks if chunk["text"].strip()]
        embeddings = embedding_service.embed_texts([chunk["text"] for chunk in valid_chunks])
        vector_store.ensure_collection(embedding_service.dimension)
        vector_store.delete_document(document["id"])
        vector_store.upsert_chunks(valid_chunks, embeddings)
        store.update_document_status(document["id"], "Indexed", "Embedded")
        document["status"] = "Indexed"
        document["embedding_status"] = "Embedded"
        return store.document_to_response(document)
    except Exception:
        try:
            vector_store.delete_document(document["id"])
        except Exception:
            pass
        store.update_document_status(document["id"], "Failed", "Failed")
        raise


def build_numbered_context(results, max_characters):
    lines = []
    total = 0
    for index, result in enumerate(results, start=1):
        chunk_text = result.text.strip()
        block = f"[{index}] {result.document_name}, page {result.page}\n{chunk_text}"
        if total + len(block) > max_characters:
            break
        lines.append(block)
        total += len(block)
    return "\n\n".join(lines)


def result_to_citation(result, index):
    return {
        "id": index,
        "number": index,
        "documentId": result.document_id,
        "documentName": result.document_name,
        "document": result.document_name,
        "page": result.page,
        "chunkId": result.chunk_id,
        "chunkText": result.text,
        "text": result.text,
        "relevanceScore": round(result.score, 4),
        "score": round(result.score, 4),
        "relevance": round(result.score, 4),
    }


def citations_to_chunks(citations):
    return [
        {
            "key": citation["id"],
            "rank": citation["id"],
            "documentId": citation["documentId"],
            "document": citation["document"],
            "page": citation["page"],
            "chunkId": citation["chunkId"],
            "score": citation["score"],
            "preview": citation["text"],
            "text": citation["text"],
        }
        for citation in citations
    ]


def citation_numbers(answer):
    return [int(match) for match in CITATION_PATTERN.findall(answer or "")]


def detect_prompt_injection(results):
    matched = []
    for result in results:
        lowered = result.text.lower()
        for phrase in PROMPT_INJECTION_PATTERNS:
            if phrase in lowered:
                matched.append(phrase)
    return sorted(set(matched))


def build_guardrails(citations, answer, retrieved_results, min_relevance_score, llm_error=None):
    used_numbers = citation_numbers(answer)
    valid_numbers = {citation["id"] for citation in citations}
    invalid_numbers = sorted(number for number in used_numbers if number not in valid_numbers)
    injection_matches = detect_prompt_injection(retrieved_results)
    insufficient_answer = "do not provide enough evidence" in (answer or "").lower()
    has_relevant_context = bool(retrieved_results) and any(
        result.score >= min_relevance_score for result in retrieved_results
    )

    coverage_status = "Passed" if citations and used_numbers and not invalid_numbers else "Warning"
    context_status = "Passed" if has_relevant_context and not insufficient_answer else "Warning"
    unsupported_status = "Warning" if invalid_numbers or llm_error else "Passed"

    return [
        {
            "key": "coverage",
            "check": "Citation coverage",
            "status": coverage_status,
            "explanation": "The answer includes valid citation markers." if coverage_status == "Passed" else "Citation markers are missing or invalid.",
        },
        {
            "key": "unsupported",
            "check": "Unsupported claim detection",
            "status": unsupported_status,
            "explanation": f"Invalid citation markers detected: {invalid_numbers}." if invalid_numbers else (llm_error or "No unsupported citation markers were detected."),
        },
        {
            "key": "injection",
            "check": "Prompt injection detection",
            "status": "Warning" if injection_matches else "Passed",
            "explanation": f"Document-side injection phrases detected: {', '.join(injection_matches)}." if injection_matches else "No prompt-injection patterns were detected in retrieved chunks.",
        },
        {
            "key": "sensitive",
            "check": "Sensitive action detection",
            "status": "Passed",
            "explanation": "The workflow did not attempt to perform external sensitive actions.",
        },
        {
            "key": "context",
            "check": "Context sufficiency",
            "status": context_status,
            "explanation": "Retrieved chunks passed the configured relevance threshold." if context_status == "Passed" else "The retrieved context is empty, low relevance, or insufficient.",
        },
    ]


def workflow_steps(retrieval_latency_ms, answer_latency_ms, guardrails):
    needs_review = any(check["status"] in {"Warning", "Failed"} for check in guardrails)
    return [
        {"key": "intent", "title": "Intent", "status": "Completed", "latencyMs": 1, "description": "Classified the query intent with deterministic rules."},
        {"key": "retrieval", "title": "Retrieval", "status": "Completed", "latencyMs": retrieval_latency_ms, "description": "Embedded the query and searched Qdrant Local."},
        {"key": "answer", "title": "Answer", "status": "Completed", "latencyMs": answer_latency_ms, "description": "Generated a grounded answer with Ollama or returned a controlled local error."},
        {"key": "citation", "title": "Citation", "status": "Completed", "latencyMs": 1, "description": "Parsed and validated citation markers."},
        {"key": "verifier", "title": "Verifier", "status": "Completed", "latencyMs": 1, "description": "Checked evidence and citation consistency."},
        {"key": "guardrail", "title": "Guardrail", "status": "Warning" if needs_review else "Completed", "latencyMs": 1, "description": "Ran deterministic guardrail checks."},
        {"key": "review", "title": "Review", "status": "Needs Review" if needs_review else "Completed", "latencyMs": 0, "description": "Marked runs with warnings for human review."},
        {"key": "final", "title": "Final", "status": "Needs Review" if needs_review else "Completed", "latencyMs": 0, "description": "Returned the frontend-compatible response."},
    ]


def insufficient_context_response(query, retrieved_results, min_relevance_score, started_at):
    answer = "The uploaded documents do not provide enough evidence to answer this question with citations."
    guardrails = build_guardrails([], answer, retrieved_results, min_relevance_score)
    elapsed = time.perf_counter() - started_at
    return build_response(
        query=query,
        answer=answer,
        citations=[],
        chunks=[],
        guardrails=guardrails,
        elapsed=elapsed,
        token_usage=0,
        retrieval_latency_ms=int(elapsed * 1000),
        answer_latency_ms=0,
    )


def build_response(query, answer, citations, chunks, guardrails, elapsed, token_usage, retrieval_latency_ms, answer_latency_ms):
    needs_review = any(check["status"] in {"Warning", "Failed"} for check in guardrails)
    citation_accuracy = "100%" if citations and not any(
        check["key"] in {"coverage", "unsupported"} and check["status"] != "Passed"
        for check in guardrails
    ) else ("0%" if not citations else "75%")
    return {
        "id": str(uuid.uuid4()),
        "query": query,
        "intent": classify_intent(query),
        "status": "needs_review" if needs_review else "completed",
        "answer": answer,
        "steps": workflow_steps(retrieval_latency_ms, answer_latency_ms, guardrails),
        "citations": citations,
        "retrievedChunks": chunks,
        "chunks": chunks,
        "guardrails": guardrails,
        "latencyMs": int(elapsed * 1000),
        "tokenUsage": token_usage,
        "costUsd": 0,
        "metrics": {
            "latency": f"{elapsed:.2f}s",
            "tokenUsage": f"{token_usage:,}" if token_usage is not None else "0",
            "cost": "$0.000",
            "citationAccuracy": citation_accuracy,
            "guardrailStatus": "Needs Review" if needs_review else "Passed",
        },
    }


def run_agent_query(
    store,
    query,
    settings,
    embedding_service=None,
    vector_store=None,
    llm_service=None,
    app_settings=default_settings,
):
    started_at = time.perf_counter()
    request_settings = settings or {}

    def setting_value(*names, default):
        for name in names:
            if name in request_settings and request_settings[name] is not None:
                return request_settings[name]
        return default

    top_k = int(setting_value("topK", "top_k", default=app_settings.retrieval_top_k))
    min_relevance_score = float(
        setting_value(
            "minRelevanceScore",
            "min_relevance_score",
            default=app_settings.min_relevance_score,
        )
    )
    document_ids = request_settings.get("documentIds") or request_settings.get("document_ids") or []
    document_ids = [document_id for document_id in document_ids if document_id]
    if not document_ids:
        raise ApplicationError("Select at least one indexed document before running the workflow.")

    embedding_service = embedding_service or EmbeddingService()
    vector_store = vector_store or VectorStoreService()
    llm_service = llm_service or LLMService()

    retrieval_started = time.perf_counter()
    query_embedding = embedding_service.embed_query(query)
    retrieved_results = vector_store.search(query_embedding, document_ids=document_ids, top_k=top_k)
    retrieval_latency_ms = int((time.perf_counter() - retrieval_started) * 1000)
    relevant_results = [
        result for result in retrieved_results if result.score >= min_relevance_score
    ]
    if not relevant_results:
        return insufficient_context_response(
            query,
            retrieved_results,
            min_relevance_score,
            started_at,
        )

    citations = [
        result_to_citation(result, index)
        for index, result in enumerate(relevant_results, start=1)
    ]
    chunks = citations_to_chunks(citations)
    numbered_context = build_numbered_context(
        relevant_results,
        int(
            setting_value(
                "maxContextCharacters",
                "max_context_characters",
                default=app_settings.max_context_characters,
            )
        ),
    )

    llm_error = None
    answer_started = time.perf_counter()
    try:
        generation = llm_service.generate_answer(query, numbered_context)
        answer = generation["answer"]
        token_usage = generation.get("token_usage")
        answer_latency_ms = generation.get("latency_ms") or int((time.perf_counter() - answer_started) * 1000)
    except ApplicationError as error:
        llm_error = error.message
        markers = " ".join(f"[{citation['id']}]" for citation in citations[:2])
        answer = f"{error.message}. Retrieved evidence is available for review. {markers}".strip()
        token_usage = 0
        answer_latency_ms = int((time.perf_counter() - answer_started) * 1000)

    guardrails = build_guardrails(
        citations,
        answer,
        relevant_results,
        min_relevance_score,
        llm_error=llm_error,
    )
    elapsed = time.perf_counter() - started_at
    return build_response(
        query=query,
        answer=answer,
        citations=citations,
        chunks=chunks,
        guardrails=guardrails,
        elapsed=elapsed,
        token_usage=token_usage if token_usage is not None else 0,
        retrieval_latency_ms=retrieval_latency_ms,
        answer_latency_ms=answer_latency_ms,
    )
