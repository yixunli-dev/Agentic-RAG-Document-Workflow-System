from backend.exceptions import ApplicationError
from backend.settings import settings


class EmbeddingService:
    """Lazy Sentence Transformers embedding service."""

    def __init__(self, model_name=None, model_loader=None):
        self.model_name = model_name or settings.embedding_model
        self.model_loader = model_loader
        self._model = None
        self._dimension = None

    def _load_model(self):
        if self._model is not None:
            return self._model
        try:
            loader = self.model_loader
            if loader is None:
                from sentence_transformers import SentenceTransformer

                loader = SentenceTransformer
            self._model = loader(self.model_name)
            self._dimension = int(self._model.get_sentence_embedding_dimension())
            return self._model
        except Exception as error:
            raise ApplicationError(
                f"Embedding model could not be loaded: {error}",
                status_code=503,
            ) from error

    @staticmethod
    def _plain_vector(vector):
        if hasattr(vector, "tolist"):
            vector = vector.tolist()
        return [float(value) for value in vector]

    @property
    def dimension(self):
        self._load_model()
        return self._dimension

    def embed_texts(self, texts):
        texts = [text for text in texts if text is not None]
        if not texts:
            return []
        model = self._load_model()
        try:
            vectors = model.encode(texts, normalize_embeddings=True)
            return [self._plain_vector(vector) for vector in vectors]
        except Exception as error:
            raise ApplicationError(
                f"Embedding generation failed: {error}",
                status_code=503,
            ) from error

    def embed_query(self, text):
        vectors = self.embed_texts([text or ""])
        return vectors[0] if vectors else []
