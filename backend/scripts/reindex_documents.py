from collections import defaultdict

from backend.agent_service import DocumentStore
from backend.services.embedding_service import EmbeddingService
from backend.services.vector_store_service import VectorStoreService
from backend.settings import DATA_DIR


def reindex_documents(db_path=None, embedding_service=None, vector_store=None):
    store = DocumentStore(db_path or DATA_DIR / "rag.sqlite")
    embedding_service = embedding_service or EmbeddingService()
    vector_store = vector_store or VectorStoreService()
    chunks = store.get_all_chunks()
    if not chunks:
        return {"documents": 0, "chunks": 0}

    embeddings = embedding_service.embed_texts([chunk["text"] for chunk in chunks])
    vector_store.ensure_collection(embedding_service.dimension)

    document_chunks = defaultdict(list)
    document_embeddings = defaultdict(list)
    for chunk, embedding in zip(chunks, embeddings):
        document_chunks[chunk["document_id"]].append(chunk)
        document_embeddings[chunk["document_id"]].append(embedding)

    for document_id, grouped_chunks in document_chunks.items():
        vector_store.delete_document(document_id)
        vector_store.upsert_chunks(grouped_chunks, document_embeddings[document_id])
        store.update_document_status(document_id, "Indexed", "Embedded")

    return {"documents": len(document_chunks), "chunks": len(chunks)}


def main():
    result = reindex_documents()
    print(f"Reindexed {result['chunks']} chunks across {result['documents']} documents.")


if __name__ == "__main__":
    main()
