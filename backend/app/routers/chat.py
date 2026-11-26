from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import ChatAskRequest, ChatAskResponse
from app.services.chat_service import ask_document_question
from app.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post("/ask", response_model=ChatAskResponse)
async def ask_chat_route(request: Request, payload: ChatAskRequest) -> ChatAskResponse:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    if str(user.id) != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

    try:
        return await ask_document_question(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


from app.schemas import (
    ChatSessionCreateRequest,
    ChatSessionRenameRequest,
    ChatSessionResponse
)

@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session_route(request: Request, payload: ChatSessionCreateRequest):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    if str(user.id) != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

    supabase = get_supabase_client()
    insert_data = {
        "user_id": payload.user_id,
        "title": payload.title,
    }
    if payload.document_id:
        insert_data["document_id"] = payload.document_id
    if payload.workspace_id:
        insert_data["workspace_id"] = payload.workspace_id

    res = supabase.table("chat_sessions").insert(insert_data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create session")
    
    sess = res.data[0]
    return ChatSessionResponse(
        id=str(sess["id"]),
        title=sess["title"],
        document_id=sess.get("document_id"),
        workspace_id=sess.get("workspace_id"),
        created_at=str(sess["created_at"])
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions_route(
    request: Request,
    user_id: str,
    document_id: str | None = None,
    workspace_id: str | None = None,
):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    if str(user.id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

    supabase = get_supabase_client()
    query = supabase.table("chat_sessions").select("*").eq("user_id", user_id)
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    elif document_id:
        query = query.eq("document_id", document_id)
    else:
        raise HTTPException(status_code=400, detail="Either document_id or workspace_id must be provided")

    res = query.order("created_at", desc=True).execute()
    return [
        ChatSessionResponse(
            id=str(sess["id"]),
            title=sess["title"],
            document_id=sess.get("document_id"),
            workspace_id=sess.get("workspace_id"),
            created_at=str(sess["created_at"])
        ) for sess in res.data
    ]


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
async def rename_session_route(
    request: Request,
    session_id: str,
    payload: ChatSessionRenameRequest,
):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    if str(user.id) != payload.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

    supabase = get_supabase_client()
    res = supabase.table("chat_sessions").update({"title": payload.title}).eq("id", session_id).eq("user_id", payload.user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")

    sess = res.data[0]
    return ChatSessionResponse(
        id=str(sess["id"]),
        title=sess["title"],
        document_id=sess.get("document_id"),
        workspace_id=sess.get("workspace_id"),
        created_at=str(sess["created_at"])
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_route(
    request: Request,
    session_id: str,
    user_id: str,
):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    user = get_supabase_client().auth.get_user(token).user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    if str(user.id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_id does not match token")

    supabase = get_supabase_client()
    res = supabase.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")

