from backend.agent_service import DocumentStore, run_agent_query


def test_run_agent_query_returns_frontend_contract(tmp_path):
    store = DocumentStore(tmp_path / "rag.sqlite")
    document = store.add_document(
        name="agentic-rag-sample-policy.pdf",
        content="Customers may request a refund within 30 days. Custom work may be excluded from refunds.",
    )

    result = run_agent_query(
        store=store,
        query="Compare refund policy and identify risky clauses",
        settings={"topK": 3, "guardrailsEnabled": True},
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
    excluded = store.add_document(
        name="agentic-rag-sample-policy.pdf",
        content="Refund disputes must be filed within seven days.",
    )
    selected = store.add_document(
        name="policy.pdf",
        content="Invoices must be paid within thirty days.",
    )

    result = run_agent_query(
        store=store,
        query="refund disputes invoices",
        settings={"topK": 5, "documentIds": [selected["id"]]},
    )

    assert selected["name"] in {citation["document"] for citation in result["citations"]}
    assert excluded["name"] not in {citation["document"] for citation in result["citations"]}
