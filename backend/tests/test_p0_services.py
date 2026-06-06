import pytest

from backend.exceptions import ApplicationError
from backend.services.embedding_service import EmbeddingService
from backend.services.vector_store_service import VectorSearchResult


class FakeSentenceTransformer:
    def __init__(self, model_name):
        self.model_name = model_name

    def get_sentence_embedding_dimension(self):
        return 3

    def encode(self, texts, normalize_embeddings=True):
        vectors = {
            "refund policy": [1.0, 0.0, 0.0],
            "payment terms": [0.0, 1.0, 0.0],
            "": [0.0, 0.0, 0.0],
        }
        return [vectors.get(text, [0.2, 0.2, 0.2]) for text in texts]


def test_embedding_service_batch_encoding_uses_cached_model(monkeypatch):
    created = []

    def fake_loader(model_name):
        created.append(model_name)
        return FakeSentenceTransformer(model_name)

    service = EmbeddingService(model_name="test-model", model_loader=fake_loader)

    vectors = service.embed_texts(["refund policy", "payment terms"])
    query_vector = service.embed_query("refund policy")

    assert vectors == [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    assert query_vector == [1.0, 0.0, 0.0]
    assert service.dimension == 3
    assert created == ["test-model"]


def test_embedding_service_handles_empty_batch(monkeypatch):
    service = EmbeddingService(model_name="test-model", model_loader=FakeSentenceTransformer)

    assert service.embed_texts([]) == []


def test_embedding_service_raises_application_error_when_model_fails():
    def failing_loader(model_name):
        raise RuntimeError("download failed")

    service = EmbeddingService(model_name="test-model", model_loader=failing_loader)

    with pytest.raises(ApplicationError, match="Embedding model could not be loaded"):
        service.embed_query("refund policy")


class FakeVectorStore:
    def __init__(self):
        self.deleted = []
        self.points = []

    def ensure_collection(self, vector_size):
        self.vector_size = vector_size

    def upsert_chunks(self, chunks, embeddings):
        for chunk, embedding in zip(chunks, embeddings):
            self.points.append((chunk, embedding))

    def search(self, query_embedding, document_ids, top_k):
        if not document_ids:
            return []
        results = []
        for chunk, embedding in self.points:
            if chunk["document_id"] not in document_ids:
                continue
            score = sum(left * right for left, right in zip(query_embedding, embedding))
            results.append(
                VectorSearchResult(
                    chunk_id=chunk["id"],
                    document_id=chunk["document_id"],
                    document_name=chunk["document_name"],
                    page=chunk["page"],
                    chunk_index=chunk["chunk_index"],
                    text=chunk["text"],
                    score=score,
                )
            )
        return sorted(results, key=lambda result: result.score, reverse=True)[:top_k]

    def delete_document(self, document_id):
        self.deleted.append(document_id)
        self.points = [
            (chunk, embedding)
            for chunk, embedding in self.points
            if chunk["document_id"] != document_id
        ]


def test_fake_vector_store_filters_selected_documents():
    store = FakeVectorStore()
    chunks = [
        {
            "id": "chunk-a",
            "document_id": "doc-a",
            "document_name": "a.pdf",
            "page": 1,
            "chunk_index": 0,
            "text": "Refunds are available within thirty days.",
        },
        {
            "id": "chunk-b",
            "document_id": "doc-b",
            "document_name": "b.pdf",
            "page": 1,
            "chunk_index": 0,
            "text": "Invoices are due within ten days.",
        },
    ]
    store.upsert_chunks(chunks, [[1.0, 0.0], [0.0, 1.0]])

    results = store.search([0.0, 1.0], document_ids=["doc-b"], top_k=5)

    assert [result.document_id for result in results] == ["doc-b"]
