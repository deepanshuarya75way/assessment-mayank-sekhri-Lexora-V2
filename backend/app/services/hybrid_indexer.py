import asyncio
from typing import Any, Callable

import google.generativeai as genai
from pinecone import Pinecone
from pinecone_text.sparse import BM25Encoder

from app.config import get_settings
from app.services.nltk_setup import ensure_nltk_resources


class IndexingCancelledError(Exception):
    """Raised when hybrid indexing is cancelled mid-flight."""


def _extract_embedding(payload: dict[str, Any]) -> list[float]:
    embedding = payload.get("embedding")
    if isinstance(embedding, dict):
        values = embedding.get("values")
        if isinstance(values, list):
            return [float(v) for v in values]
    if isinstance(embedding, list):
        return [float(v) for v in embedding]
    raise ValueError("Unexpected embedding response format from Google API")


async def _embed_batch_dense(
    texts: list[str],
    model: str,
    should_cancel: Callable[[], bool] | None = None,
) -> list[list[float]]:
    def _sync_embed() -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            if should_cancel and should_cancel():
                raise IndexingCancelledError("Embedding cancelled mid-batch")
            payload = genai.embed_content(
                model=model,
                content=text,
                task_type="retrieval_document",
            )
            vectors.append(_extract_embedding(payload))
        return vectors

    return await asyncio.to_thread(_sync_embed)


async def upsert_hybrid_chunks(
    *,
    document_id: str,
    user_id: str,
    chunk_records: list[dict[str, Any]],
    on_progress: Callable[[int, int], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> int:
    if should_cancel and should_cancel():
        raise IndexingCancelledError("Indexing cancelled before start")

    settings = get_settings()

    if not settings.pinecone_api_key or not settings.pinecone_index_name:
        raise ValueError("PINECONE_API_KEY and PINECONE_INDEX_NAME must be set")
    if not settings.google_api_key:
        raise ValueError("GOOGLE_API_KEY must be set")

    genai.configure(api_key=settings.google_api_key)
    await asyncio.to_thread(ensure_nltk_resources)

    if should_cancel and should_cancel():
        raise IndexingCancelledError("Indexing cancelled after NLTK setup")

    pinecone = Pinecone(api_key=settings.pinecone_api_key)
    index = pinecone.Index(settings.pinecone_index_name)
    bm25 = BM25Encoder.default()

    texts = [record["text"] for record in chunk_records]
    sparse_vectors = bm25.encode_documents(texts)

    total_chunks = len(chunk_records)
    total_indexed = 0

    for start in range(0, total_chunks, settings.embedding_batch_size):
        if should_cancel and should_cancel():
            raise IndexingCancelledError(
                f"Indexing cancelled before batch starting at chunk {start}"
            )

        end = start + settings.embedding_batch_size
        chunk_batch = chunk_records[start:end]
        text_batch = texts[start:end]

        dense_vectors = await _embed_batch_dense(
            text_batch,
            settings.embedding_model,
            should_cancel=should_cancel,
        )
        sparse_batch = sparse_vectors[start:end]

        if should_cancel and should_cancel():
            raise IndexingCancelledError(
                f"Indexing cancelled before Pinecone upsert at chunk {start}"
            )

        payload = []
        for idx, (chunk, dense_vector, sparse_vector) in enumerate(
            zip(chunk_batch, dense_vectors, sparse_batch), start=start
        ):
            payload.append(
                {
                    "id": f"{document_id}:{idx}",
                    "values": dense_vector,
                    "sparse_values": {
                        "indices": sparse_vector["indices"],
                        "values": sparse_vector["values"],
                    },
                    "metadata": {
                        "document_id": document_id,
                        "user_id": user_id,
                        "chunk_text": chunk["text"],
                        "page_number": chunk["page_number"],
                    },
                }
            )

        await asyncio.to_thread(index.upsert, vectors=payload)
        total_indexed += len(payload)

        if on_progress:
            on_progress(min(end, total_chunks), total_chunks)

        if should_cancel and should_cancel():
            raise IndexingCancelledError(
                f"Indexing cancelled after batch ending at chunk {end}"
            )

        # Keep a short delay between batches to avoid embedding rate limits.
        await asyncio.sleep(settings.embedding_batch_sleep_seconds)

    return total_indexed