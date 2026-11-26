from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import (
    DocumentDeleteResponse,
    DocumentIngestRequest,
    DocumentIngestResponse,
    DocumentStatusResponse,
    IngestionStep,
)
from app.services.document_deletion import delete_document
from app.services.document_ingestion import IngestionCancelledError, ingest_document
from app.services.summarization import summarize_document_by_id
from app.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


def _authenticate_user(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase token",
        )

    return str(user.id)


def _infer_step(row: dict) -> IngestionStep:
    step = row.get("ingestion_step")
    if step in {"uploading", "chunking", "indexing", "completed", "failed", "cancelled"}:
        return step

    doc_status = (row.get("status") or "").lower()
    if doc_status == "completed":
        return "completed"
    if doc_status == "failed":
        return "failed"
    if doc_status == "cancelled":
        return "cancelled"
    if doc_status in {"chunking", "indexing", "uploading"}:
        return doc_status
    return "uploading"


@router.post("/ingest", response_model=DocumentIngestResponse)
async def ingest_document_route(
    request: Request,
    payload: DocumentIngestRequest,
) -> DocumentIngestResponse:
    try:
        user_id = _authenticate_user(request)
        if user_id != payload.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="user_id does not match token",
            )

        return await ingest_document(payload)
    except IngestionCancelledError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc) or "Document ingestion was cancelled",
        ) from exc
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status_route(
    request: Request,
    document_id: str,
) -> DocumentStatusResponse:
    try:
        user_id = _authenticate_user(request)
        supabase = get_supabase_client()

        query = (
            supabase.table("documents")
            .select(
                "id, title, status, ingestion_step, ingestion_progress, "
                "step_message, chunks_indexed, page_count, is_deleting, error_message"
            )
            .eq("id", document_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = query.data if isinstance(query.data, list) else []
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )

        row = rows[0]
        step = _infer_step(row)
        default_progress = 100 if step == "completed" else 0
        raw_progress = row.get("ingestion_progress")
        progress = int(raw_progress) if raw_progress is not None else default_progress

        return DocumentStatusResponse(
            document_id=str(row["id"]),
            title=row.get("title"),
            status=str(row.get("status") or step),
            ingestion_step=step,
            ingestion_progress=max(0, min(100, progress)),
            step_message=row.get("step_message"),
            chunks_indexed=int(row.get("chunks_indexed") or 0),
            page_count=int(row.get("page_count") or 0),
            is_deleting=bool(row.get("is_deleting") or False),
            error_message=row.get("error_message"),
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document_route(
    request: Request,
    document_id: str,
) -> DocumentDeleteResponse:
    try:
        user_id = _authenticate_user(request)
        return await delete_document(document_id, user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{document_id}/summarize")
async def summarize_document_route(request: Request, document_id: str):
    try:
        user_id = _authenticate_user(request)
        return await summarize_document_by_id(document_id, user_id)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc