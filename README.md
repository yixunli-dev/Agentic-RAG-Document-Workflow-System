# Agentic RAG Document Workflow System

A full-stack local AI document workflow app for uploading PDFs, indexing their text into a vector database, retrieving relevant evidence, and generating grounded answers with citations. The system is intentionally local-first: React UI, FastAPI, SQLite, Qdrant Local, Sentence Transformers, and Ollama.

## What It Does

- Upload PDFs through the React workspace UI.
- Extract text with FastAPI and `pypdf`.
- Chunk document text and persist document/chunk metadata in SQLite.
- Embed chunks with a lazy-loaded Sentence Transformers model.
- Store vectors in persistent Qdrant Local.
- Run semantic retrieval only against user-selected documents.
- Generate grounded answers with local Ollama chat models.
- Return citations, retrieved chunks, guardrail checks, metrics, and workflow steps to the existing UI contract.
- Mark uploads as `Indexed` only after embedding and Qdrant upsert succeed.
- Keep failed uploads in a visible `Failed` state so the workflow cannot treat them as ready documents.

## Current Scope

Implemented:

- React 18 + Vite + Ant Design frontend
- FastAPI backend
- SQLite document/chunk store
- Local PDF extraction
- Sentence Transformers embeddings
- Qdrant Local vector search
- Ollama local answer generation
- Deterministic guardrails for citation coverage, prompt injection phrases, sensitive actions, unsupported citations, and context sufficiency
- Backend and frontend tests

Deliberately not included:

- LangGraph orchestration
- Hosted vector databases
- Paid or cloud LLM APIs
- Auth, billing, streaming, or multi-user workspace management
- New pages beyond the current product surface

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite, Ant Design |
| API | FastAPI |
| Storage | SQLite, local uploads folder |
| PDF Parsing | pypdf |
| Embeddings | sentence-transformers |
| Vector Store | Qdrant Local |
| Generation | Ollama |
| Backend Tests | pytest, FastAPI TestClient |
| Frontend Tests | Vitest, Testing Library, jsdom |

## Architecture

```text
PDF upload
  -> FastAPI stores file
  -> pypdf extracts text by page
  -> backend.agent_service chunks text
  -> SQLite stores document and chunk metadata
  -> Sentence Transformers embeds chunks
  -> Qdrant Local stores vectors and payloads
  -> UI shows Indexed only after vector upsert succeeds

Run Agent Workflow
  -> Frontend sends query + selected documentIds
  -> Backend embeds query
  -> Qdrant searches only selected documents
  -> Low-relevance or empty context returns an evidence-insufficient answer
  -> Ollama generates an answer from numbered context
  -> Guardrails validate citations and retrieved evidence
  -> API returns the existing answer/citations/chunks/guardrails/metrics shape
```

Important backend files:

```text
backend/app.py                         FastAPI endpoints and service wiring
backend/agent_service.py               SQLite store, chunking, retrieval flow, guardrails, response assembly
backend/services/embedding_service.py  Lazy Sentence Transformers wrapper
backend/services/vector_store_service.py Persistent Qdrant Local wrapper
backend/services/llm_service.py        Ollama chat wrapper and grounded prompt
backend/scripts/reindex_documents.py   Rebuild Qdrant vectors from SQLite chunks
```

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- Python 3.9+
- Ollama installed locally

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
python3 -m pip install -r requirements.txt
```

### Configure environment

```bash
cp .env.example .env
```

Defaults:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
QDRANT_PATH=backend/data/qdrant
QDRANT_COLLECTION=document_chunks
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.2:3b
RETRIEVAL_TOP_K=5
MIN_RELEVANCE_SCORE=0.25
MAX_CONTEXT_CHARACTERS=12000
OLLAMA_TIMEOUT_SECONDS=45
```

### Start Ollama

```bash
ollama serve
```

In another terminal, make sure the configured model exists:

```bash
ollama pull llama3.2:3b
```

### Start the backend API

```bash
npm run api
```

FastAPI runs at:

```text
http://127.0.0.1:8000
```

Health endpoint:

```text
http://127.0.0.1:8000/api/health
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

### Start the frontend

```bash
npm run dev
```

Vite usually runs at:

```text
http://localhost:5173/
```

### Start frontend and backend together

```bash
npm run dev:full
```

## Using The App

1. Open the Workspace page.
2. Upload a PDF, for example `sample-documents/agentic-rag-sample-policy.pdf`.
3. Wait for the document to show `Indexed` and `Embedded`.
4. Select the document in the document list.
5. Ask a grounded question.
6. Click `Run Agent Workflow`.
7. Review the answer, citations, retrieved chunks, guardrails, and metrics.

Example prompts:

```text
Compare the refund policy and identify risky clauses.
```

```text
Extract parties, payment terms, refund window, and risky clauses.
```

```text
What does the selected document say about cancellation or termination?
```

## API Contract

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Reports API, SQLite, embedding model, Qdrant, and Ollama health |
| `GET /api/documents` | Lists document metadata |
| `POST /api/documents/upload` | Uploads, extracts, chunks, embeds, and indexes a PDF |
| `POST /api/agent/runs` | Runs semantic retrieval, local generation, citations, guardrails, and metrics |

`POST /api/agent/runs` keeps the frontend-compatible fields:

- `answer`
- `citations`
- `chunks`
- `guardrails`
- `metrics`

It also returns richer backend fields such as:

- `steps`
- `retrievedChunks`
- `latencyMs`
- `tokenUsage`
- `costUsd`

## Reindexing

If you change `EMBEDDING_MODEL`, delete Qdrant data, or need to rebuild vectors from existing SQLite chunks:

```bash
python3 -m backend.scripts.reindex_documents
```

The script reads `backend/data/rag.sqlite`, embeds all stored chunks, rebuilds vectors in Qdrant Local, and marks documents as `Indexed` / `Embedded`.

## Testing

Run backend tests:

```bash
python3 -m pytest backend/tests
```

Run frontend tests:

```bash
npm test
```

Build production frontend:

```bash
npm run build
```

The backend tests use fakes for embeddings, vector search, and Ollama so CI-style verification does not need model downloads.

## Troubleshooting

- `Embedding model could not be loaded`: install backend dependencies and allow Sentence Transformers to download the configured model.
- `Qdrant Local could not be initialized`: check `QDRANT_PATH` and local write permissions under `backend/data/`.
- `Qdrant collection vector size is ... expected ...`: run `python3 -m backend.scripts.reindex_documents` after changing embedding models.
- `Local Ollama generation is unavailable`: start Ollama and pull the configured `OLLAMA_CHAT_MODEL`.
- Upload shows `Failed`: indexing did not complete, so the document is intentionally blocked from normal workflow use.
- No citations returned: select at least one indexed document and ask a question supported by the selected document context.

## Interview Talking Points

- This is not just a static UI demo. The upload, indexing, retrieval, generation, and guardrail flow is backed by real FastAPI services.
- SQLite stores durable document metadata and chunks, while Qdrant stores semantic vectors for retrieval.
- The embedding model is lazy-loaded so the server can start before the model is needed.
- Retrieval is scoped by selected document IDs, which prevents accidental cross-document leakage.
- The answer generation prompt treats retrieved PDF text as untrusted data and requires citation markers.
- Guardrails are deterministic and explainable, which makes failures visible in the UI.
- The project keeps the frontend contract stable while replacing the earlier keyword mock with real local AI infrastructure.

## Repository

GitHub: [yixunli-dev/Agentic-RAG-Document-Workflow-System](https://github.com/yixunli-dev/Agentic-RAG-Document-Workflow-System)
