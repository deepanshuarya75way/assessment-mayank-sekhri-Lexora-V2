import time
from typing import Any, Callable

from app.schemas import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    IngestionStep,
)
from app.services.file_processing import (
    FileProcessingCancelledError,
    extract_text_chunks,
)
from app.services.hybrid_indexer import (
    IndexingCancelledError,
    upsert_hybrid_chunks,
)
from app.services.summarization import generate_summary_and_entities
from app.supabase_client import get_supabase_client


class IngestionCancelledError(Exception):
    """Raised when a document is pre-emptively deleted or cancelled mid-ingestion."""


def _first_row(data: Any) -> dict[str, Any]:
    if isinstance(data, list) and data:
        return data[0]
    raise ValueError("Expected at least one row in Supabase response")


def _safe_update_document(
    supabase: Any,
    document_id: str,
    payload: dict[str, Any],
    *,
    only_if_active: bool = True,
) -> bool:
    query = supabase.table("documents").update(payload).eq("id", document_id)
    if only_if_active:
        query = query.not_.in_("ingestion_step", ["cancelled", "failed"]).eq(
            "is_deleting", False
        )
    result = query.execute()
    return bool(result.data)


def _is_document_cancelled(supabase: Any, document_id: str) -> bool:
    result = (
        supabase.table("documents")
        .select("id, status, ingestion_step, is_deleting")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else []
    if not rows:
        return True

    row = rows[0]
    return (
        row.get("is_deleting") is True
        or row.get("ingestion_step") == "cancelled"
        or row.get("status") in {"cancelled", "deleting"}
    )


def _assert_not_cancelled(supabase: Any, document_id: str) -> None:
    if _is_document_cancelled(supabase, document_id):
        raise IngestionCancelledError(f"Document {document_id} was cancelled or deleted")


def _make_should_cancel(
    supabase: Any,
    document_id: str,
    min_interval_sec: float = 0.25,
) -> Callable[[], bool]:
    cancelled = False
    last_checked = 0.0

    def should_cancel() -> bool:
        nonlocal cancelled, last_checked
        if cancelled:
            return True

        now = time.monotonic()
        if now - last_checked < min_interval_sec:
            return False

        last_checked = now
        if _is_document_cancelled(supabase, document_id):
            cancelled = True
            return True
        return False

    return should_cancel


def _set_step(
    supabase: Any,
    document_id: str,
    step: IngestionStep,
    progress: int,
    message: str,
    *,
    extra: dict[str, Any] | None = None,
    check_cancelled: bool = True,
) -> None:
    if check_cancelled:
        _assert_not_cancelled(supabase, document_id)

    payload: dict[str, Any] = {
        "ingestion_step": step,
        "ingestion_progress": max(0, min(100, progress)),
        "step_message": message,
    }
    if extra:
        payload.update(extra)

    updated = _safe_update_document(
        supabase,
        document_id,
        payload,
        only_if_active=check_cancelled,
    )
    if check_cancelled and not updated:
        raise IngestionCancelledError(
            f"Document {document_id} became inactive before updating step '{step}'"
        )


def _make_chunk_progress_callback(
    supabase: Any,
    document_id: str,
) -> Callable[[int, int], None]:
    last_progress = -1

    def on_chunk_progress(current: int, total: int) -> None:
        nonlocal last_progress
        _assert_not_cancelled(supabase, document_id)
        if total <= 0:
            return
        ratio = min(1.0, current / total)
        progress = 35 + int(ratio * 25)  # 35% -> 60%
        if progress != last_progress:
            last_progress = progress
            _set_step(
                supabase,
                document_id,
                "chunking",
                progress,
                f"Chunking content ({current}/{total})",
            )

    return on_chunk_progress


async def _upsert_chunks_with_checkpoints(
    supabase: Any,
    document_id: str,
    user_id: str,
    chunk_records: list[Any],
    should_cancel: Callable[[], bool],
    batch_size: int = 25,
) -> int:
    total = len(chunk_records)
    if total == 0:
        return 0

    indexed_count = 0
    for start in range(0, total, batch_size):
        _assert_not_cancelled(supabase, document_id)
        batch = chunk_records[start : start + batch_size]
        batch_end = min(start + len(batch), total)

        def on_batch_progress(
            current: int,
            batch_total: int,
            _start: int = start,
            _batch_len: int = len(batch),
        ) -> None:
            _assert_not_cancelled(supabase, document_id)
            if batch_total <= 0:
                return
            overall_done = _start + int((current / batch_total) * _batch_len)
            ratio = min(1.0, overall_done / total)
            progress = 60 + int(ratio * 25)  # 60% -> 85%
            _set_step(
                supabase,
                document_id,
                "indexing",
                progress,
                f"Indexing chunks ({overall_done}/{total})",
            )

        try:
            batch_indexed = await upsert_hybrid_chunks(
                document_id=document_id,
                user_id=user_id,
                chunk_records=batch,
                on_progress=on_batch_progress,
                should_cancel=should_cancel,
            )
        except TypeError:
            batch_indexed = await upsert_hybrid_chunks(
                document_id=document_id,
                user_id=user_id,
                chunk_records=batch,
            )

        indexed_count += batch_indexed

        _assert_not_cancelled(supabase, document_id)
        ratio = min(1.0, batch_end / total)
        progress = 60 + int(ratio * 25)  # 60% -> 85%
        _set_step(
            supabase,
            document_id,
            "indexing",
            progress,
            f"Indexing chunks ({batch_end}/{total})",
        )

    return indexed_count


def _mark_cancelled(supabase: Any, document_id: str) -> None:
    _safe_update_document(
        supabase,
        document_id,
        {
            "status": "cancelled",
            "ingestion_step": "cancelled",
            "step_message": "Ingestion cancelled due to deletion",
        },
        only_if_active=False,
    )


async def ingest_document(request: DocumentIngestRequest) -> DocumentIngestResponse:
    supabase = get_supabase_client()

    document_insert = (
        supabase.table("documents")
        .insert(
            {
                "user_id": request.user_id,
                "title": request.title,
                "file_path": request.file_path,
                "mime_type": request.mime_type,
                "status": "processing",
                "ingestion_step": "uploading",
                "ingestion_progress": 10,
                "step_message": "Fetching file from storage",
                "is_deleting": False,
                "error_message": None,
            }
        )
        .execute()
    )

    document_row = _first_row(document_insert.data)
    document_id = str(document_row["id"])
    should_cancel = _make_should_cancel(supabase, document_id)

    try:
        # 1. Uploading / Staging stage (10% -> 30%)
        _assert_not_cancelled(supabase, document_id)
        file_bytes = supabase.storage.from_(request.bucket).download(request.file_path)
        if not file_bytes:
            raise ValueError("Downloaded file is empty")

        _set_step(
            supabase,
            document_id,
            "uploading",
            30,
            "File staged for processing",
            extra={"file_size": len(file_bytes)},
        )

        # 2. Chunking stage (35% -> 60%)
        _set_step(
            supabase,
            document_id,
            "chunking",
            35,
            "Extracting text and creating chunks",
        )
        on_chunk_progress = _make_chunk_progress_callback(supabase, document_id)
        try:
            chunk_records, page_count = extract_text_chunks(
                file_bytes,
                request.mime_type,
                on_progress=on_chunk_progress,
                should_cancel=should_cancel,
            )
        except TypeError:
            _assert_not_cancelled(supabase, document_id)
            chunk_records, page_count = extract_text_chunks(file_bytes, request.mime_type)
            _assert_not_cancelled(supabase, document_id)

        if not chunk_records:
            raise ValueError("No text chunks were extracted from this file")

        _set_step(
            supabase,
            document_id,
            "chunking",
            60,
            f"Created {len(chunk_records)} chunks across {page_count} pages",
            extra={"page_count": page_count},
        )

        # 3. Indexing stage (60% -> 95%)
        _set_step(
            supabase,
            document_id,
            "indexing",
            62,
            "Indexing chunks for hybrid search",
        )
        chunks_indexed = await _upsert_chunks_with_checkpoints(
            supabase=supabase,
            document_id=document_id,
            user_id=request.user_id,
            chunk_records=chunk_records,
            should_cancel=should_cancel,
            batch_size=25,
        )

        _assert_not_cancelled(supabase, document_id)
        _set_step(
            supabase,
            document_id,
            "indexing",
            90,
            "Generating summary and entities",
        )
        summary, entities = await generate_summary_and_entities(chunk_records)

        # Finalize only if still active
        _assert_not_cancelled(supabase, document_id)
        finalized = _safe_update_document(
            supabase,
            document_id,
            {
                "file_size": len(file_bytes),
                "status": "completed",
                "ingestion_step": "completed",
                "ingestion_progress": 100,
                "step_message": "Ingestion complete",
                "chunks_indexed": chunks_indexed,
                "page_count": page_count,
                "summary": summary,
                "entities": entities,
                "error_message": None,
            },
            only_if_active=True,
        )
        if not finalized:
            raise IngestionCancelledError(
                f"Document {document_id} was cancelled before completion"
            )

        return DocumentIngestResponse(
            document_id=document_id,
            chunks_indexed=chunks_indexed,
            page_count=page_count,
            status="completed",
            ingestion_step="completed",
            ingestion_progress=100,
            step_message="Ingestion complete",
        )

    except (
        IngestionCancelledError,
        FileProcessingCancelledError,
        IndexingCancelledError,
    ) as exc:
        _mark_cancelled(supabase, document_id)
        if isinstance(exc, IngestionCancelledError):
            raise
        raise IngestionCancelledError(str(exc)) from exc

    except Exception as exc:
        if _is_document_cancelled(supabase, document_id):
            _mark_cancelled(supabase, document_id)
            raise IngestionCancelledError(
                f"Document {document_id} was cancelled during error handling"
            ) from exc

        _safe_update_document(
            supabase,
            document_id,
            {
                "status": "failed",
                "ingestion_step": "failed",
                "step_message": "Ingestion failed",
                "error_message": str(exc)[:500],
            },
            only_if_active=True,
        )
        raise