import { citations, guardrails, retrievedChunks, workflowSteps } from "./mockData";

export const createMockDocument = (file, index) => ({
  id: `${file.name}-${Date.now()}-${index}`,
  name: file.name,
  size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
  status: "Indexed",
  chunks: 18 + index * 7,
  embeddingStatus: "Embedded",
});

export const runMockAgent = (query, settings, onStep) =>
  new Promise((resolve) => {
    workflowSteps.forEach((step, index) => {
      setTimeout(() => onStep(index), 230 * (index + 1));
    });

    setTimeout(() => {
      resolve({
        query,
        answer:
          "The uploaded policies align on a 30-day refund window for standard purchases [1], but they diverge on service and enterprise exceptions. Service terms allow denial when work has substantially started [2], while the enterprise addendum shortens dispute notice to 10 business days [3]. The riskiest clause is the custom-work exception because it leaves room for subjective interpretation and should be reviewed before customer-facing use.",
        citations,
        chunks: retrievedChunks,
        guardrails: settings.guardrailsEnabled ? guardrails : guardrails.map((item) => ({ ...item, status: "Passed" })),
        metrics: {
          latency: "3.0s",
          tokenUsage: "4,820",
          cost: "$0.014",
          citationAccuracy: "92%",
          guardrailStatus: settings.guardrailsEnabled ? "Needs Review" : "Passed",
        },
      });
    }, 230 * (workflowSteps.length + 1));
  });
