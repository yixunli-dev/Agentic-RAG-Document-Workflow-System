import { workflowSteps } from "./fixtures";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const fetchApi = async (url, options) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "FastAPI backend is unreachable. Start it with `npm run api` or `npm run dev:full`, then try again."
      );
    }
    throw error;
  }
};

const assertOk = async (response) => {
  if (response.ok) return response;
  let message = "API request failed";
  try {
    const body = await response.json();
    message = body.detail || message;
  } catch {
    message = response.statusText || message;
  }
  throw new Error(message);
};

export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await assertOk(
    await fetchApi(`${API_BASE_URL}/api/documents/upload`, {
      method: "POST",
      body: formData,
    })
  );

  return response.json();
};

export const listDocuments = async () => {
  const response = await assertOk(
    await fetchApi(`${API_BASE_URL}/api/documents`)
  );

  const body = await response.json();
  return body.documents || [];
};

export const runAgentWorkflow = async (query, settings, onStep) => {
  const stepTimers = workflowSteps.map((step, index) =>
    setTimeout(() => onStep(index), 180 * (index + 1))
  );

  try {
    const response = await assertOk(
      await fetchApi(`${API_BASE_URL}/api/agent/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, settings }),
      })
    );

    const result = await response.json();
    stepTimers.forEach(clearTimeout);
    onStep(workflowSteps.length);
    return result;
  } catch (error) {
    stepTimers.forEach(clearTimeout);
    throw error;
  }
};
