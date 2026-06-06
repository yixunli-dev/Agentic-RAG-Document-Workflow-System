from backend.agent_service import DocumentStore, index_document_for_retrieval, run_agent_query, tokenize
from backend.tests.test_p0_agent_service import FakeEmbeddingService, FakeLLMService
from backend.tests.test_p0_services import FakeVectorStore


def lexical_overlap(query, text):
    return len(tokenize(query).intersection(tokenize(text)))


def test_semantic_retrieval_finds_paraphrase_that_keyword_overlap_misses(tmp_path):
    query = "What is the cancellation deadline?"
    paraphrased_clause = "The purchaser may terminate the agreement within thirty calendar days."
    assert lexical_overlap(query, paraphrased_clause) == 1

    store = DocumentStore(tmp_path / "rag.sqlite")
    vector_store = FakeVectorStore()
    embedding_service = FakeEmbeddingService()
    document = index_document_for_retrieval(
        store=store,
        vector_store=vector_store,
        embedding_service=embedding_service,
        name="agreement.pdf",
        content=paraphrased_clause,
        size_bytes=128,
    )

    result = run_agent_query(
        store=store,
        query=query,
        settings={"documentIds": [document["id"]]},
        embedding_service=embedding_service,
        vector_store=vector_store,
        llm_service=FakeLLMService("The purchaser may terminate within thirty calendar days. [1]"),
    )

    assert result["citations"][0]["document"] == "agreement.pdf"
