from fastapi.testclient import TestClient

import backend.app as app_module
from backend.tests.test_p0_agent_service import FakeEmbeddingService, FakeLLMService
from backend.tests.test_p0_services import FakeVectorStore


def test_upload_and_agent_run_endpoints_return_frontend_shapes(monkeypatch):
    app_module.store.clear()
    fake_vector_store = FakeVectorStore()
    monkeypatch.setattr(app_module, "embedding_service", FakeEmbeddingService())
    monkeypatch.setattr(app_module, "vector_store", fake_vector_store)
    monkeypatch.setattr(app_module, "llm_service", FakeLLMService("Refunds are available within 30 days. [1]"))
    client = TestClient(app_module.app)

    upload_response = client.post(
        "/api/documents/upload",
        files={"file": ("policy.pdf", b"Refunds are available within 30 days for eligible purchases.", "application/pdf")},
    )
    assert upload_response.status_code == 200
    document = upload_response.json()
    assert document["name"] == "policy.pdf"
    assert document["status"] == "Indexed"
    assert document["embeddingStatus"] == "Embedded"

    run_response = client.post(
        "/api/agent/runs",
        json={
            "query": "Find refund risks",
            "settings": {
                "topK": 3,
                "guardrailsEnabled": True,
                "documentIds": [document["id"]],
            },
        },
    )
    assert run_response.status_code == 200
    result = run_response.json()
    assert result["answer"]
    assert result["citations"][0]["document"] == "policy.pdf"
    assert result["chunks"][0]["rank"] == 1
    assert result["metrics"]["cost"] == "$0.000"


def test_health_endpoint_reports_services(monkeypatch):
    class HealthyVectorStore(FakeVectorStore):
        def collection_exists(self):
            return True

    class HealthyLLM(FakeLLMService):
        def health(self):
            return {"ollama": "ok", "ollama_model": "ok"}

    monkeypatch.setattr(app_module, "embedding_service", FakeEmbeddingService())
    monkeypatch.setattr(app_module, "vector_store", HealthyVectorStore())
    monkeypatch.setattr(app_module, "llm_service", HealthyLLM())
    client = TestClient(app_module.app)

    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["services"]["api"] == "ok"
    assert body["services"]["sqlite"] == "ok"
    assert body["services"]["qdrant"] == "ok"
    assert body["services"]["ollama"] == "ok"
