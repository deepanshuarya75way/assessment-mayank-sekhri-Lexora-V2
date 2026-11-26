import asyncio
from pathlib import Path
from typing import Any

from pinecone import Pinecone

from app.config import get_settings
from app.schemas import DocumentDeleteResponse, IngestionStep
from app.supabase_client import get_supabase_client

IN_FLIGHT_STEPS: set[str] = {"uploading", "chunking", "indexing"}


def _cleanup_local_files(document_id: str, file_path: str | None) -> None:
    """Best-effort cleanup for any temporary or uploaded files on local disk."""
    candidate_paths: list[Path] = []
    if file_path:
        p = Path(file_path)
        if p.is_absolute():
            candidate_paths.append(p)
        else:
            candidate_paths.append(Path("uploads") / p)
            candidate_paths.append(Path("tmp") / p)

    for folder in (Path("uploads"), Path("tmp")):
        if folder.exists():
            candidate_paths.extend(folder.glob(f"*{document_id}*"))

    for target in candidate_paths:
        try:
            if target.is_file():
                target.unlink(missing_ok=True)
        except Exception as e:
            print(f"Error removing local file '{target}': {e}")


def _cleanup_document_chunks_table(supabase: Any, document_id: str) -> None:
    """Remove any partial chunk rows if a chunks table exists."""
    try:
        supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
    except Exception as e:
        # Ignore if table does not exist or no rows exist yet
        print(f"Note while cleaning chunk rows for '{document_id}': {e}")


async def delete_document(document_id: str, user_id: str) -> DocumentDeleteResponse:
    supabase = get_supabase_client()
    settings = get_settings()

    # 1. Verify existence and ownership (fetch current ingestion state too)
    doc_query = (
        supabase.table("documents")
        .select("id, file_path, status, ingestion_step, is_deleting")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = doc_query.data if isinstance(doc_query.data, list) else []
    if not rows:
        raise ValueError("Document not found or access denied")

    doc_row = rows[0]
    file_path: str | None = doc_row.get("file_path")
    previous_step: IngestionStep | None = doc_row.get("ingestion_step")
    was_in_flight = (
        previous_step in IN_FLIGHT_STEPS
        or doc_row.get("status") in {"processing", "uploading", "chunking", "indexing"}
    )

    # 2. Signal cancellation immediately so any running ingestion task aborts at its next checkpoint
    try:
        supabase.table("documents").update(
            {
                "is_deleting": True,
                "status": "cancelled" if was_in_flight else "deleting",
                "ingestion_step": "cancelled" if was_in_flight else previous_step,
                "step_message": "Deletion requested; cancelling ingestion" if was_in_flight else "Deleting document",
            }
        ).eq("id", document_id).eq("user_id", user_id).execute()
    except Exception as e:
        print(f"Error marking document '{document_id}' as deleting/cancelled: {e}")

    # Give any active worker loop a brief moment to yield/hit a checkpoint
    if was_in_flight:
        await asyncio.sleep(0.05)

    # 3. Delete any partial vectors from Pinecone (even if indexing was incomplete)
    if settings.pinecone_api_key and settings.pinecone_index_name:
        def _delete_from_pinecone() -> None:
            pc = Pinecone(api_key=settings.pinecone_api_key)
            index = pc.Index(settings.pinecone_index_name)
            index.delete(filter={"document_id": {"$eq": document_id}})

        try:
            await asyncio.to_thread(_delete_from_pinecone)
        except Exception as e:
            print(f"Error deleting from Pinecone: {e}")

    # 4. Clean up any partial chunk rows (idempotent)
    await asyncio.to_thread(_cleanup_document_chunks_table, supabase, document_id)

    # 5. Delete file from Supabase Storage (if uploaded) + any local temp/upload files
    if file_path:
        try:
            supabase.storage.from_("documents").remove([file_path])
        except Exception as e:
            print(f"Error deleting from Supabase Storage: {e}")

    await asyncio.to_thread(_cleanup_local_files, document_id, file_path)

    # 6. Delete row from Supabase Database
    supabase.table("documents").delete().eq("id", document_id).eq("user_id", user_id).execute()

    return DocumentDeleteResponse(
        document_id=document_id,
        deleted=True,
        cancelled_in_flight=was_in_flight,
        previous_step=previous_step,
        status="deleted",
    )