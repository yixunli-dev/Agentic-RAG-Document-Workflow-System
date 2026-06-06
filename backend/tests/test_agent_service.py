from backend.agent_service import DocumentStore, index_document_for_retrieval, run_agent_query
from backend.tests.test_p0_agent_service import FakeEmbeddingService, FakeLLMService
from backend.tests.test_p0_services import FakeVectorStore


def test_run_agent_query_returns_frontend_contract(tmp_path):
    store = DocumentStore(tmp_path / "rag.sqlite")
    vector_store = FakeVectorStore()
    embedding_service = FakeEmbeddingService()
    document = index_document_for_retrieval(
        store=store,
        vector_store=vector_store,
        embedding_service=embedding_service,
        name="agentic-rag-sample-policy.pdf",
        content="Customers may request a refund within 30 days. Custom work may be excluded from refunds.",
        size_bytes=128,
    )

    result = run_agent_query(
        store=store,
        query="Compare refund policy and identify risky clauses",
        settings={"topK": 3, "guardrailsEnabled": True, "documentIds": [document["id"]]},
        embedding_service=embedding_service,
        vector_store=vector_store,
        llm_service=FakeLLMService("Customers may request a refund within 30 days. [1]"),
    )

    assert document["name"] == "agentic-rag-sample-policy.pdf"
    assert document["status"] == "Indexed"
    assert document["chunks"] >= 1
    assert result["answer"]
    assert result["citations"][0]["document"] == "agentic-rag-sample-policy.pdf"
    assert result["citations"][0]["page"] == 1
    assert result["chunks"][0]["rank"] == 1
    assert result["chunks"][0]["document"] == "agentic-rag-sample-policy.pdf"
    assert any(check["check"] == "Citation coverage" for check in result["guardrails"])
    assert result["metrics"]["guardrailStatus"] in {"Passed", "Needs Review"}


def test_run_agent_query_limits_retrieval_to_selected_documents(tmp_path):
    store = DocumentStore(tmp_path / "rag.sqlite")
    vector_store = FakeVectorStore()
    embedding_service = FakeEmbeddingService()
    excluded = index_document_for_retrieval(
        store=store,
        vector_store=vector_store,
        embedding_service=embedding_service,
        name="agentic-rag-sample-policy.pdf",
        content="Refund disputes must be filed within seven days.",
        size_bytes=128,
    )
    selected = index_document_for_retrieval(
        store=store,
        vector_store=vector_store,
        embedding_service=embedding_service,
        name="policy.pdf",
        content="Invoices must be paid within thirty days.",
        size_bytes=128,
    )

    result = run_agent_query(
        store=store,
        query="When are invoices due?",
        settings={"topK": 5, "documentIds": [selected["id"]]},
        embedding_service=embedding_service,
        vector_store=vector_store,
        llm_service=FakeLLMService("Invoices must be paid within thirty days. [1]"),
    )

    assert selected["name"] in {citation["document"] for citation in result["citations"]}
    assert excluded["name"] not in {citation["document"] for citation in result["citations"]}
