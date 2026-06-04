# Agentic RAG Document Workflow System

A production-style full-stack application for an agentic Retrieval-Augmented Generation document workflow platform. The application lets users upload PDFs, ask document-related questions, retrieve grounded evidence, generate cited answers, run verification checks, surface guardrail warnings, and expose evaluation metrics.

This version is intentionally built as a no-paid-API MVP. It uses FastAPI, local file storage, SQLite, PDF text extraction, and lightweight keyword retrieval. It does not require OpenAI, LangChain, LangGraph, or a hosted vector database.

## Highlights

- PDF document intake experience backed by a real FastAPI upload endpoint
- Local PDF text extraction, chunking, and SQLite indexing
- Query workspace for document analysis, comparison, extraction, and risk review
- Agent workflow trace with step status, latency, component/model metadata, and expandable details
- Cited answer card with clickable inline citation markers
- Retrieved source chunks table with local relevance scoring
- Guardrail panel for citation coverage, unsupported claims, prompt injection, sensitive actions, and context sufficiency
- Human review state with local approve/regenerate/edit actions
- Evaluation dashboard with recall, faithfulness, citation accuracy, latency, cost, and guardrail metrics
- Settings page for model selection, retrieval top-k, guardrails, review, trace logging, and temperature
- Vite-powered React app with Vitest coverage
- FastAPI service tests with pytest

## Product Scope

The goal is not to build a basic "chat with PDF" demo. The interface is designed to look and behave like an AI document workflow platform that could later connect to a real FastAPI backend and agent runtime.

Current implementation:

- Frontend: React + Vite
- UI system: Ant Design
- Backend: FastAPI
- Storage: local uploads folder + SQLite
- Retrieval: local keyword-overlap retrieval
- Agent execution: deterministic no-cost workflow service
- PDF parsing: `pypdf`

Out of scope for this version:

- Real LLM calls
- Real embeddings
- Real vector search
- Real LangChain or LangGraph orchestration
- Real authentication, billing, or persistent storage

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | React 18 |
| Build Tool | Vite |
| UI Components | Ant Design |
| API | FastAPI |
| Storage | SQLite, local filesystem |
| PDF Parsing | pypdf |
| Testing | Vitest, Testing Library, jsdom |
| Backend Testing | pytest, FastAPI TestClient |
| Styling | CSS modules/global CSS |
| Retrieval | Local lexical scoring |

## Architecture

```text
src/
  App.jsx          Main application shell, pages, and UI panels
  App.css          Dashboard layout and visual styling
  main.jsx         Vite React entrypoint
  apiClient.js     Frontend API adapter for FastAPI endpoints
  fixtures.js      UI fixtures for workflow labels, settings, and evaluation cases
  App.test.jsx     Workspace, agent run, evaluation, and settings tests
  setupTests.js    jsdom test environment setup

backend/
  app.py           FastAPI app and HTTP endpoints
  agent_service.py SQLite store, chunking, retrieval, guardrails, and response assembly
  tests/           Backend service and endpoint tests
```

The frontend is organized around a stable backend contract:

1. Upload events create document metadata in local state.
2. Query submission calls `runMockAgent`, which now posts to FastAPI.
3. The frontend emits staged workflow progress for the trace UI.
4. The UI renders answer, citations, chunks, metrics, and guardrail results.
5. Review actions update local UI state only.

`src/apiClient.js` owns the frontend-to-FastAPI boundary for document uploads and agent workflow runs.

## Agent Workflow Simulation

The application models the following execution trace:

1. Intent Router
2. Retrieval Agent
3. Answer Agent
4. Citation Agent
5. Verifier Agent
6. Guardrail Check
7. Human Review
8. Final Response

Each step includes:

- Status
- Description
- Latency
- Selected model or component
- Expandable implementation details

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Python 3.9+

### Install dependencies

```bash
npm install
```

### Install backend dependencies

```bash
python3 -m pip install -r requirements.txt
```

### Start the backend API

```bash
npm run api
```

FastAPI runs on:

```text
http://127.0.0.1:8000
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

### Start the frontend

```bash
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

If port `5173` is unavailable, Vite may choose another port. Use the URL printed in your terminal.

### Start frontend and backend together

```bash
npm run dev:full
```

### Try the sample PDF

Upload this file from the Workspace page:

```text
sample-documents/agentic-rag-sample-policy.pdf
```

Example questions:

```text
Compare the refund policy and identify risky clauses.
```

```text
Extract parties, payment terms, refund window, and risky clauses.
```

### Build for production

```bash
npm run build
```

The production build is emitted to `dist/`.

### Run tests

```bash
npm test
```

### Run backend tests

```bash
python3 -m pytest backend/tests
```

The test suite verifies:

- Main workspace rendering
- Mock agent workflow execution
- Cited answer and review state
- Evaluation dashboard
- Settings page controls

## API Contract

The React app currently calls these FastAPI endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Backend health check |
| `POST /api/documents/upload` | Upload a PDF and return document metadata |
| `GET /api/documents` | List indexed documents |
| `POST /api/agent/runs` | Run retrieval, answer assembly, citations, guardrails, and metrics |

The response from `POST /api/agent/runs` keeps the frontend contract:

- `answer`
- `citations`
- `chunks`
- `guardrails`
- `metrics`

## Future Upgrade Path

The no-cost backend is intentionally simple. A production upgrade can replace individual layers without changing the UI:

1. Replace keyword scoring with embeddings and a vector database.
2. Replace deterministic answer assembly with an LLM call.
3. Stream trace events from the backend instead of simulating progress in the frontend.
4. Add run persistence, authentication, user workspaces, and deployment configuration.

## Engineering Notes

- The current backend is free to run locally and does not call paid AI APIs.
- `backend/data/` is ignored because it stores generated SQLite and uploaded files.
- `dist/` is ignored because it is a generated Vite build artifact.
- Large bundle warnings may appear because Ant Design is a full UI component system. The app still builds successfully; future optimization can use route-level code splitting and manual chunks.

## Repository

GitHub: [yixunli-dev/Agentic-RAG-Document-Workflow-System](https://github.com/yixunli-dev/Agentic-RAG-Document-Workflow-System)
