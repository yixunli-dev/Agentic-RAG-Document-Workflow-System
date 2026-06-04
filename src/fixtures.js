export const initialDocuments = [];

export const examplePrompts = [
  "Summarize the key obligations in these documents.",
  "Compare the refund policy across all uploaded PDFs.",
  "Find risky or ambiguous clauses.",
  "Extract dates, parties, and payment terms into a table.",
];

export const workflowSteps = [
  {
    key: "router",
    title: "Intent Router",
    description: "Classifies the query as Risk Analysis with comparison intent.",
    latency: 118,
    component: "router-small",
    details: "Detected refund policy comparison, risk language, and multi-document grounding requirements.",
  },
  {
    key: "retrieval",
    title: "Retrieval Agent",
    description: "Retrieves top-k chunks from indexed document memory.",
    latency: 426,
    component: "hybrid-search",
    details: "Used semantic and keyword retrieval across uploaded PDFs with k=5.",
  },
  {
    key: "answer",
    title: "Answer Agent",
    description: "Generates a grounded draft answer from retrieved evidence.",
    latency: 1320,
    component: "GPT-4o mini",
    details: "Draft constrained to retrieved context with citation placeholders per claim.",
  },
  {
    key: "citation",
    title: "Citation Agent",
    description: "Maps claims to source chunks and page numbers.",
    latency: 284,
    component: "citation-mapper",
    details: "Matched every refund-window and exception claim to source chunks.",
  },
  {
    key: "verifier",
    title: "Verifier Agent",
    description: "Checks answer faithfulness and flags weak support.",
    latency: 612,
    component: "faithfulness-checker",
    details: "One clause interpretation has partial support and should be reviewed.",
  },
  {
    key: "guardrail",
    title: "Guardrail Check",
    description: "Checks unsupported claims, prompt injection, and sensitive actions.",
    latency: 193,
    component: "policy-guard",
    details: "Citation coverage passed. Context sufficiency raised a warning.",
  },
  {
    key: "human",
    title: "Human Review",
    description: "Routes the answer to review because a guardrail warning exists.",
    latency: 0,
    component: "review-queue",
    details: "Reviewer can approve, reject, regenerate, or edit the answer.",
  },
  {
    key: "final",
    title: "Final Response",
    description: "Produces final answer with citations and audit metadata.",
    latency: 72,
    component: "response-assembler",
    details: "Final response is ready once review is resolved.",
  },
];

export const evaluationCases = [
  {
    key: "EVAL-001",
    caseId: "EVAL-001",
    queryType: "Comparison",
    expectedSource: "agentic-rag-sample-policy.pdf p.1",
    retrievalPassed: true,
    faithfulness: 94,
    citationAccuracy: 92,
    status: "Passed",
  },
  {
    key: "EVAL-002",
    caseId: "EVAL-002",
    queryType: "Risk Analysis",
    expectedSource: "agentic-rag-sample-policy.pdf p.1",
    retrievalPassed: true,
    faithfulness: 86,
    citationAccuracy: 88,
    status: "Review",
  },
  {
    key: "EVAL-003",
    caseId: "EVAL-003",
    queryType: "Extraction",
    expectedSource: "agentic-rag-sample-policy.pdf p.1",
    retrievalPassed: false,
    faithfulness: 79,
    citationAccuracy: 74,
    status: "Failed",
  },
];
