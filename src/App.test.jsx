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

const indexedDocument = {
  id: "agentic-rag-sample-policy",
  name: "agentic-rag-sample-policy.pdf",
  size: "24 KB",
  status: "Indexed",
  chunks: 7,
  embeddingStatus: "Embedded",
};

const secondIndexedDocument = {
  id: "policy",
  name: "policy.pdf",
  size: "60 B",
  status: "Indexed",
  chunks: 1,
  embeddingStatus: "Embedded",
};

beforeEach(() => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/agent/runs")) {
      return {
        ok: true,
        json: async () => agentRunResponse,
      };
    }
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({ documents: [indexedDocument] }),
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

const waitForIndexedDocument = async () => {
  await waitFor(() =>
    expect(screen.getByText("agentic-rag-sample-policy.pdf")).toBeInTheDocument(),
  );
};

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
  await waitForIndexedDocument();

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

test("shows uploaded PDF feedback with the uploaded file name", async () => {
  const uploadedDocument = {
    id: "policy.pdf",
    name: "policy.pdf",
    size: "12 KB",
    status: "Indexed",
    chunks: 4,
    embeddingStatus: "Ready",
  };
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => uploadedDocument,
  }));

  const { container } = render(<App />);
  const input = container.querySelector('input[type="file"]');
  const file = new File(["Refunds are available."], "policy.pdf", {
    type: "application/pdf",
  });

  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() =>
    expect(screen.getByText("Uploaded policy.pdf")).toBeInTheDocument(),
  );
  expect(screen.getByText("policy.pdf")).toBeInTheDocument();
});

test("keeps agent workflow disabled after an upload fails with no indexed documents", async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents/upload")) {
      throw new TypeError("Failed to fetch");
    }
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({ documents: [] }),
      };
    }
    return {
      ok: true,
      json: async () => agentRunResponse,
    };
  });

  const { container } = render(<App />);
  const input = container.querySelector('input[type="file"]');
  const file = new File(["Refunds are available."], "policy.pdf", {
    type: "application/pdf",
  });

  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });

  await waitFor(() => expect(screen.getByText("Upload failed")).toBeInTheDocument());
  expect(screen.getByText(/FastAPI backend is unreachable/i)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /run agent workflow/i }),
  ).toBeDisabled();
});

test("loads existing indexed documents from the backend", async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({
          documents: [
            {
              id: "existing-policy",
              name: "existing-policy.pdf",
              size: "24 KB",
              status: "Indexed",
              chunks: 7,
              embeddingStatus: "Embedded",
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => agentRunResponse,
    };
  });

  render(<App />);

  await waitFor(() =>
    expect(screen.getByText("existing-policy.pdf")).toBeInTheDocument(),
  );
});

test("keeps an agent workflow result when navigating away during the run", async () => {
  render(<App />);
  await waitForIndexedDocument();

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /documents/i }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/runs"),
      expect.anything(),
    ),
  );

  fireEvent.click(screen.getByRole("menuitem", { name: /workspace/i }));

  await waitFor(
    () =>
      expect(
        screen.getByText(/Based on the retrieved document evidence/i),
      ).toBeInTheDocument(),
    { timeout: 5000 },
  );
});

test("shows a failed workflow state when the agent run request fails", async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({ documents: [indexedDocument] }),
      };
    }
    return {
      ok: false,
      json: async () => ({ detail: "Backend unavailable" }),
    };
  });

  render(<App />);
  await waitForIndexedDocument();

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
  expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /run agent workflow/i }),
    ).not.toHaveClass("ant-btn-loading"),
  );
});

test("trace viewer reflects the current workflow state", async () => {
  render(<App />);
  await waitForIndexedDocument();

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(() => expect(screen.getByText(/Based on the retrieved document evidence/i)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("menuitem", { name: /trace viewer/i }));

  expect(screen.getByRole("heading", { name: "Trace Viewer" })).toBeInTheDocument();
  expect(screen.getByText("Needs Review")).toBeInTheDocument();
});

test("shows an empty evaluation state until PDFs are uploaded", () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({ documents: [] }),
      };
    }
    return {
      ok: true,
      json: async () => agentRunResponse,
    };
  });

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

test("sends updated runtime settings with an agent run", async () => {
  render(<App />);
  await waitForIndexedDocument();

  fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
  fireEvent.change(
    within(screen.getByText("Retrieval top-k").closest(".ant-form-item")).getByRole("spinbutton"),
    { target: { value: "2" } },
  );
  fireEvent.click(screen.getByRole("menuitem", { name: /workspace/i }));
  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/runs"),
      expect.anything(),
    ),
  );
  const [, request] = global.fetch.mock.calls.find(([url]) =>
    String(url).includes("/api/agent/runs"),
  );
  expect(JSON.parse(request.body).settings.topK).toBe(2);
});

test("lets users select which indexed documents are used for workflow", async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({
          documents: [indexedDocument, secondIndexedDocument],
        }),
      };
    }
    return {
      ok: true,
      json: async () => agentRunResponse,
    };
  });

  render(<App />);

  await waitFor(() => expect(screen.getByText("policy.pdf")).toBeInTheDocument());
  expect(screen.getByText("2 selected")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("checkbox", { name: "policy.pdf" }));
  expect(screen.getByText("1 selected")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/runs"),
      expect.anything(),
    ),
  );
  const [, request] = global.fetch.mock.calls.find(([url]) =>
    String(url).includes("/api/agent/runs"),
  );
  expect(JSON.parse(request.body).settings.documentIds).toEqual([
    indexedDocument.id,
  ]);
});

test("documents page supports selecting documents for the workspace", async () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/documents")) {
      return {
        ok: true,
        json: async () => ({
          documents: [indexedDocument, secondIndexedDocument],
        }),
      };
    }
    return {
      ok: true,
      json: async () => agentRunResponse,
    };
  });

  render(<App />);

  await waitFor(() => expect(screen.getByText("policy.pdf")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("menuitem", { name: /documents/i }));
  expect(screen.getByText("2 selected for workflow")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: /select row policy.pdf/i }));
  expect(screen.getByText("1 selected for workflow")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /open workspace/i }));
  expect(screen.getByText("1 selected")).toBeInTheDocument();
});
