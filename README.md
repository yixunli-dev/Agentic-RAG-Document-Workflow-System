# Agentic RAG Document Workflow System

A production-style React frontend for an agentic Retrieval-Augmented Generation document workflow platform. The application simulates how an enterprise document intelligence product can ingest PDFs, route user intent, retrieve grounded evidence, generate cited answers, run verification checks, surface guardrail warnings, and expose evaluation metrics.

This repository is intentionally frontend-only. It uses mocked data and mocked API functions so the interface can be reviewed, tested, and extended without requiring OpenAI, LangChain, LangGraph, a vector database, or a backend service.

## Highlights

- PDF document intake experience with mocked chunking, embedding, and indexing status
- Query workspace for document analysis, comparison, extraction, and risk review
- Simulated multi-agent workflow trace with step status, latency, component/model metadata, and expandable details
- Cited answer card with clickable inline citation markers
- Retrieved source chunks table with relevance scoring
- Guardrail panel for citation coverage, unsupported claims, prompt injection, sensitive actions, and context sufficiency
- Human review state with local approve/regenerate/edit actions
- Evaluation dashboard with recall, faithfulness, citation accuracy, latency, cost, and guardrail metrics
- Settings page for model selection, retrieval top-k, guardrails, review, trace logging, and temperature
- Vite-powered React app with Vitest test coverage

## Product Scope

The goal is not to build a basic "chat with PDF" demo. The interface is designed to look and behave like an AI document workflow platform that could later connect to a real FastAPI backend and agent runtime.

Current implementation:

- Frontend: React + Vite
- UI system: Ant Design
- Data: mocked local datasets
- Agent execution: mocked async workflow simulation
- Backend: not implemented

Out of scope for this version:

- Real PDF parsing
- Real embeddings
- Real vector search
- Real LLM calls
- Real LangChain or LangGraph orchestration
- Real authentication, billing, or persistent storage

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | React 18 |
| Build Tool | Vite |
| UI Components | Ant Design |
| Testing | Vitest, Testing Library, jsdom |
| Styling | CSS modules/global CSS |
| Mock Runtime | Local JavaScript mock API |

## Architecture

```text
src/
  App.jsx          Main application shell, pages, and UI panels
  App.css          Dashboard layout and visual styling
  main.jsx         Vite React entrypoint
  mockApi.js       Mock upload and agent-run functions
  mockData.js      Mock documents, workflow steps, citations, chunks, guardrails, eval cases
  App.test.jsx     Workspace, agent run, evaluation, and settings tests
  setupTests.js    jsdom test environment setup
```

The frontend is organized around a future backend contract:

1. Upload events create document metadata in local state.
2. Query submission calls `runMockAgent`.
3. The mock runner emits staged workflow progress.
4. The UI renders answer, citations, chunks, metrics, and guardrail results.
5. Review actions update local UI state only.

When integrating a real backend, `mockApi.js` is the primary replacement point.

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

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

If port `5173` is unavailable, Vite may choose another port. Use the URL printed in your terminal.

### Build for production

```bash
npm run build
```

The production build is emitted to `dist/`.

### Run tests

```bash
npm test
```

The test suite verifies:

- Main workspace rendering
- Mock agent workflow execution
- Cited answer and review state
- Evaluation dashboard
- Settings page controls

## Backend Integration Plan

This frontend is structured so it can later connect to a FastAPI backend with minimal UI rewrites.

Recommended backend endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /documents/upload` | Upload PDFs and return document metadata |
| `GET /documents` | List indexed documents |
| `POST /agent/runs` | Start an agent workflow for a query |
| `GET /agent/runs/{run_id}` | Poll run status and trace events |
| `GET /agent/runs/{run_id}/citations` | Fetch citation mappings |
| `GET /agent/runs/{run_id}/chunks` | Fetch retrieved chunks |
| `GET /evaluations/summary` | Fetch evaluation metrics |

Suggested replacement path:

1. Replace `runMockAgent` in `src/mockApi.js` with real API calls.
2. Stream or poll workflow step updates into the existing trace panel.
3. Map backend response objects into the current citation, chunk, guardrail, and metrics shapes.
4. Add authentication and persistence after the workflow contract is stable.

## Engineering Notes

- All product behavior is mocked by design.
- The repository contains a legacy `server/` directory from the original project, but the current application does not depend on it.
- `dist/` is ignored because it is a generated Vite build artifact.
- Large bundle warnings may appear because Ant Design is a full UI component system. The app still builds successfully; future optimization can use route-level code splitting and manual chunks.

## Repository

GitHub: [yixunli-dev/Agentic-RAG-Document-Workflow-System](https://github.com/yixunli-dev/Agentic-RAG-Document-Workflow-System)
