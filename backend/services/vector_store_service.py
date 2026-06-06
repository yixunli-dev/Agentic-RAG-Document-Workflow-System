import uuid
from dataclasses import dataclass
from pathlib import Path

from backend.exceptions import ApplicationError
from backend.settings import settings


@dataclass
class VectorSearchResult:
    chunk_id: str
    document_id: str
    document_name: str
    page: int
    chunk_index: int
    text: str
    score: float


class VectorStoreService:
    """Persistent Qdrant Local vector store for document chunks."""

    def __init__(self, path=None, collection_name=None, client=None):
        self.path = Path(path or settings.qdrant_path)
        self.collection_name = collection_name or settings.qdrant_collection
        self._client = client

    @property
    def client(self):
        if self._client is not None:
            return self._client
        try:
            from qdrant_client import QdrantClient

            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._client = QdrantClient(path=str(self.path))
            return self._client
        except Exception as error:
            raise ApplicationError(
                f"Qdrant Local could not be initialized: {error}",
                status_code=503,
            ) from error

    def collection_exists(self):
        try:
            return self.client.collection_exists(self.collection_name)
        except AttributeError:
            names = [collection.name for collection in self.client.get_collections().collections]
            return self.collection_name in names
        except Exception as error:
            raise ApplicationError(f"Qdrant collection check failed: {error}", 503) from error

    def ensure_collection(self, vector_size):
        try:
            from qdrant_client import models

            if self.collection_exists():
                collection = self.client.get_collection(self.collection_name)
                configured = collection.config.params.vectors
                existing_size = getattr(configured, "size", None)
                if existing_size is not None and int(existing_size) != int(vector_size):
                    raise ApplicationError(
                        f"Qdrant collection vector size is {existing_size}, expected {vector_size}. Run the reindex script after changing embedding models.",
                        503,
                    )
                return
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
        except ApplicationError:
            raise
        except Exception as error:
            raise ApplicationError(f"Qdrant collection setup failed: {error}", 503) from error

    @staticmethod
    def _point_id(chunk_id):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"document-chunk:{chunk_id}"))

    def upsert_chunks(self, chunks, embeddings):
        if not chunks:
            return
        try:
            from qdrant_client import models

            points = []
            for chunk, embedding in zip(chunks, embeddings):
                points.append(
                    models.PointStruct(
                        id=self._point_id(chunk["id"]),
                        vector=embedding,
                        payload={
                            "chunk_id": chunk["id"],
                            "document_id": chunk["document_id"],
                            "document_name": chunk["document_name"],
                            "page": chunk["page"],
                            "chunk_index": chunk["chunk_index"],
                            "text": chunk["text"],
                        },
                    )
                )
            self.client.upsert(collection_name=self.collection_name, points=points)
        except Exception as error:
            raise ApplicationError(f"Qdrant upsert failed: {error}", 503) from error

    def search(self, query_embedding, document_ids, top_k):
        if not document_ids:
            return []
        try:
            from qdrant_client import models

            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchAny(any=list(document_ids)),
                    )
                ]
            )
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_embedding,
                    query_filter=query_filter,
                    limit=top_k,
                    with_payload=True,
                )
                points = response.points
            else:
                points = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_embedding,
                    query_filter=query_filter,
                    limit=top_k,
                    with_payload=True,
                )
            return [
                VectorSearchResult(
                    chunk_id=point.payload["chunk_id"],
                    document_id=point.payload["document_id"],
                    document_name=point.payload["document_name"],
                    page=int(point.payload["page"]),
                    chunk_index=int(point.payload["chunk_index"]),
                    text=point.payload["text"],
                    score=float(point.score),
                )
                for point in points
            ]
        except Exception as error:
            raise ApplicationError(f"Qdrant search failed: {error}", 503) from error

    def delete_document(self, document_id):
        try:
            from qdrant_client import models

            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=document_id),
                            )
                        ]
                    )
                ),
            )
        except Exception as error:
            raise ApplicationError(f"Qdrant delete failed: {error}", 503) from error
