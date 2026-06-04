import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";

test("renders the agentic RAG workspace shell", () => {
  render(<App />);

  expect(screen.getByText("Agentic RAG")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: /workspace/i })).toBeInTheDocument();
  expect(screen.getByText("Document Intake")).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/compare the refund policy/i)).toBeInTheDocument();
  expect(screen.getByText("Agent Workflow Trace")).toBeInTheDocument();
  expect(screen.getByText("Citation coverage")).toBeInTheDocument();
});

test("simulates an agent run and displays cited answer details", async () => {
  render(<App />);

  fireEvent.change(screen.getByPlaceholderText(/compare the refund policy/i), {
    target: { value: "Find risky refund clauses" },
  });
  fireEvent.click(screen.getByRole("button", { name: /run agent workflow/i }));

  await waitFor(
    () => expect(screen.getByText(/The uploaded policies align on a 30-day refund window/i)).toBeInTheDocument(),
    { timeout: 5000 }
  );

  expect(screen.getByText("Needs Review")).toBeInTheDocument();
  expect(screen.getByText("Verifier Agent")).toBeInTheDocument();
  expect(screen.getByText("refund_policy.pdf, page 3")).toBeInTheDocument();
  expect(screen.getByText("Needs Human Review")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /approve answer/i }));
  expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
});

test("shows evaluation metrics and configurable mock settings", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("menuitem", { name: /evaluation/i }));
  expect(screen.getByText("Evaluation Dashboard")).toBeInTheDocument();
  expect(screen.getByText("Retrieval Recall@5")).toBeInTheDocument();
  expect(screen.getByText("Average Cost per Query")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByText("GPT-4.1")).toBeInTheDocument();
  expect(within(screen.getByText("Retrieval top-k").closest(".ant-form-item")).getByRole("spinbutton")).toHaveValue("5");
});
