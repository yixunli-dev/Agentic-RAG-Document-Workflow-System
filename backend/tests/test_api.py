from fastapi.testclient import TestClient

from backend.app import app, store


def test_upload_and_agent_run_endpoints_return_frontend_shapes():
    store.clear()
    client = TestClient(app)

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
        json={"query": "Find refund risks", "settings": {"topK": 3, "guardrailsEnabled": True}},
    )
    assert run_response.status_code == 200
    result = run_response.json()
    assert result["answer"]
    assert result["citations"][0]["document"] == "policy.pdf"
    assert result["chunks"][0]["rank"] == 1
    assert result["metrics"]["cost"] == "$0.000"
