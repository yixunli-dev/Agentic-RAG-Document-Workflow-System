export const initialDocuments = [
  {
    id: "doc-1",
    name: "refund_policy.pdf",
    size: "1.8 MB",
    status: "Indexed",
    chunks: 34,
    embeddingStatus: "Embedded",
  },
  {
    id: "doc-2",
    name: "service_terms.pdf",
    size: "2.4 MB",
    status: "Indexed",
    chunks: 52,
    embeddingStatus: "Embedded",
  },
];

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

export const citations = [
  {
    id: 1,
    document: "refund_policy.pdf",
    page: 3,
    text: "The customer may request a refund within 30 days of the original purchase date if the product remains unused.",
    score: 0.94,
  },
  {
    id: 2,
    document: "service_terms.pdf",
    page: 7,
    text: "Refunds may be denied when services have already been substantially performed or custom work has begun.",
    score: 0.88,
  },
  {
    id: 3,
    document: "enterprise_addendum.pdf",
    page: 2,
    text: "Enterprise customers must submit refund disputes in writing within 10 business days of invoice receipt.",
    score: 0.81,
  },
];

export const retrievedChunks = citations.map((citation, index) => ({
  key: citation.id,
  rank: index + 1,
  document: citation.document,
  page: citation.page,
  score: citation.score,
  preview: citation.text,
}));

export const guardrails = [
  {
    key: "coverage",
    check: "Citation coverage",
    status: "Passed",
    explanation: "Every material claim is linked to at least one retrieved source chunk.",
  },
  {
    key: "unsupported",
    check: "Unsupported claim detection",
    status: "Warning",
    explanation: "The exception around custom work is supported but may need legal review before sending.",
  },
  {
    key: "injection",
    check: "Prompt injection detection",
    status: "Passed",
    explanation: "No retrieved chunk attempted to override system behavior.",
  },
  {
    key: "sensitive",
    check: "Sensitive action detection",
    status: "Passed",
    explanation: "The response does not execute external actions or expose secrets.",
  },
  {
    key: "context",
    check: "Context sufficiency",
    status: "Warning",
    explanation: "One uploaded policy references an addendum that has not been indexed.",
  },
];

export const evaluationCases = [
  {
    key: "EVAL-001",
    caseId: "EVAL-001",
    queryType: "Comparison",
    expectedSource: "refund_policy.pdf p.3",
    retrievalPassed: true,
    faithfulness: 94,
    citationAccuracy: 92,
    status: "Passed",
  },
  {
    key: "EVAL-002",
    caseId: "EVAL-002",
    queryType: "Risk Analysis",
    expectedSource: "service_terms.pdf p.7",
    retrievalPassed: true,
    faithfulness: 86,
    citationAccuracy: 88,
    status: "Review",
  },
  {
    key: "EVAL-003",
    caseId: "EVAL-003",
    queryType: "Extraction",
    expectedSource: "enterprise_addendum.pdf p.2",
    retrievalPassed: false,
    faithfulness: 79,
    citationAccuracy: 74,
    status: "Failed",
  },
];
