from fastapi import APIRouter, Depends, HTTPException

from app.schemas import (
    WorkspaceCreateRequest,
    WorkspaceCreateResponse,
    WorkspaceAddDocumentRequest,
    WorkspaceRenameRequest,
)
from app.supabase_client import get_supabase_client
from supabase import Client

router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])


@router.post("/", response_model=WorkspaceCreateResponse)
async def create_workspace(
    req: WorkspaceCreateRequest,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        response = supabase.table("workspaces").insert(
            {"user_id": req.user_id, "name": req.name}
        ).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create workspace")

        workspace_id = response.data[0]["id"]

        return WorkspaceCreateResponse(
            workspace_id=workspace_id,
            name=req.name,
            status="created",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{workspace_id}/documents")
async def add_document_to_workspace(
    workspace_id: str,
    req: WorkspaceAddDocumentRequest,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        # Verify workspace belongs to user
        ws_res = supabase.table("workspaces").select("id").eq("id", workspace_id).eq("user_id", req.user_id).execute()
        if not ws_res.data:
            raise HTTPException(status_code=404, detail="Workspace not found or unauthorized")

        # Insert to join table
        response = supabase.table("workspace_documents").insert(
            {"workspace_id": workspace_id, "document_id": req.document_id}
        ).execute()

        return {"status": "added", "workspace_id": workspace_id, "document_id": req.document_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
async def list_workspaces(
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        response = supabase.table("workspaces").select("id, name, created_at").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{workspace_id}/documents/{user_id}")
async def list_workspace_documents(
    workspace_id: str,
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        # We must check if workspace belongs to user_id
        ws_res = supabase.table("workspaces").select("id").eq("id", workspace_id).eq("user_id", user_id).execute()
        if not ws_res.data:
            raise HTTPException(status_code=404, detail="Workspace not found")

        # Get documents
        response = supabase.table("workspace_documents").select(
            "document_id, documents(id, title, status, created_at)"
        ).eq("workspace_id", workspace_id).execute()

        docs = [row["documents"] for row in response.data if row.get("documents")]
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{workspace_id}")
async def rename_workspace(
    workspace_id: str,
    req: WorkspaceRenameRequest,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        response = supabase.table("workspaces").update({"name": req.name}).eq("id", workspace_id).eq("user_id", req.user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Workspace not found or unauthorized")
        return {"status": "renamed", "workspace_id": workspace_id, "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        response = supabase.table("workspaces").delete().eq("id", workspace_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Workspace not found or unauthorized")
        return {"status": "deleted", "workspace_id": workspace_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{workspace_id}/documents/{document_id}")
async def remove_document_from_workspace(
    workspace_id: str,
    document_id: str,
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        ws_res = supabase.table("workspaces").select("id").eq("id", workspace_id).eq("user_id", user_id).execute()
        if not ws_res.data:
            raise HTTPException(status_code=404, detail="Workspace not found or unauthorized")

        response = supabase.table("workspace_documents").delete().eq("workspace_id", workspace_id).eq("document_id", document_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Document not in workspace")
        return {"status": "removed", "workspace_id": workspace_id, "document_id": document_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.services.summarization import summarize_workspace_by_id

@router.post("/{workspace_id}/summarize")
async def summarize_workspace_route(
    workspace_id: str,
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        res = await summarize_workspace_by_id(workspace_id, user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
