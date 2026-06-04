import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import App from "./App";

const agentRunResponse = {
  query: "Find risky refund clauses",
  answer:
    'Based on the retrieved document evidence, the answer should be treated as grounded in the cited source chunks. The most relevant passages indicate the key policy obligations, exceptions, and review points for the query: "Find risky refund clauses". [1] [2]',
  citations: [
    {
      id: 1,
      document: "agentic-rag-sample-policy.pdf",
      page: 1,
      text: "Customers may request a refund within 30 days.",
      score: 0.91,
      relevance: 0.91,
    },
    {
      id: 2,
      document: "agentic-rag-sample-policy.pdf",
      page: 1,
      text: "Custom work may be excluded from refunds.",
      score: 0.77,
      relevance: 0.77,
    },
  ],
  chunks: [
    {
      key: 1,
      rank: 1,
      document: "agentic-rag-sample-policy.pdf",
      page: 1,
      score: 0.91,
      preview: "Customers may request a refund within 30 days.",
    },
  ],
  guardrails: [
    {
      key: "coverage",
      check: "Citation coverage",
      status: "Passed",
      explanation: "The answer includes citations for retrieved source chunks.",
    },
    {
      key: "context",
      check: "Context sufficiency",
      status: "Warning",
      explanation: "Only limited context was retrieved for this query.",
    },
  ],
  metrics: {
    latency: "0.01s",
    tokenUsage: "128",
    cost: "$0.000",
    citationAccuracy: "88%",
    guardrailStatus: "Needs Review",
  },
};

beforeEach(() => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/agent/runs")) {
      return {
        ok: true,
        json: async () => agentRunResponse,
      };
    }
    return {
      ok: true,
      json: async () => ({}),
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders the agentic RAG workspace shell", () => {
  render(<App />);

  expect(screen.getByText("Agentic RAG")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: /workspace/i })).toBeInTheDocument();
  expect(screen.getByText("Document Intake")).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/compare the refund policy/i)).toBeInTheDocument();
  expect(screen.getByText("Agent Workflow Trace")).toBeInTheDocument();
  expect(screen.getByText("Citation coverage")).toBeInTheDocument();
  expect(screen.getByText("Run a question to inspect citations from retrieved source chunks.")).toBeInTheDocument();
  expect(screen.queryByText("Customers may request a refund within 30 days.")).not.toBeInTheDocument();
});

test("simulates an agent run and displays cited answer details", async () => {
  render(<App />);

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(
    () => expect(screen.getByText(/Based on the retrieved document evidence/i)).toBeInTheDocument(),
    { timeout: 5000 }
  );

  expect(screen.getByText("Needs Review")).toBeInTheDocument();
  expect(screen.getByText("Verifier Agent")).toBeInTheDocument();
  expect(screen.getAllByText("agentic-rag-sample-policy.pdf, page 1").length).toBeGreaterThan(0);
  expect(screen.getByText("Needs Human Review")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /approve answer/i }));
  expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
});

test("shows an empty evaluation state until PDFs are uploaded", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("menuitem", { name: /evaluation/i }));
  expect(screen.getByText("Evaluation Dashboard")).toBeInTheDocument();
  expect(screen.getByText("No evaluation data yet")).toBeInTheDocument();
  expect(screen.queryByText("Retrieval Recall@5")).not.toBeInTheDocument();
});

test("shows configurable runtime settings", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByText("GPT-4.1")).toBeInTheDocument();
  expect(within(screen.getByText("Retrieval top-k").closest(".ant-form-item")).getByRole("spinbutton")).toHaveValue("5");
});
