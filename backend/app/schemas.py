from typing import Literal
from pydantic import BaseModel, Field

IngestionStep = Literal[
    "uploading",
    "chunking",
    "indexing",
    "completed",
    "failed",
    "cancelled",
]


class DocumentIngestRequest(BaseModel):
    user_id: str = Field(min_length=1)
    bucket: str = Field(default="documents", min_length=1)
    file_path: str = Field(min_length=1)
    title: str = Field(min_length=1)
    mime_type: str = Field(default="application/pdf")


class DocumentIngestResponse(BaseModel):
    document_id: str
    chunks_indexed: int = 0
    page_count: int = 0
    status: str
    ingestion_step: IngestionStep = "uploading"
    ingestion_progress: int = Field(default=0, ge=0, le=100)
    step_message: str | None = None


class DocumentStatusResponse(BaseModel):
    document_id: str
    title: str | None = None
    status: str
    ingestion_step: IngestionStep
    ingestion_progress: int = Field(default=0, ge=0, le=100)
    step_message: str | None = None
    chunks_indexed: int = 0
    page_count: int = 0
    is_deleting: bool = False
    error_message: str | None = None


class DocumentDeleteRequest(BaseModel):
    user_id: str = Field(min_length=1)


class DocumentDeleteResponse(BaseModel):
    document_id: str
    deleted: bool
    cancelled_in_flight: bool = False
    previous_step: IngestionStep | None = None
    status: str = "deleted"


class ChatAskRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str | None = Field(default=None)
    workspace_id: str | None = Field(default=None)
    question: str = Field(min_length=1)
    alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    top_k: int = Field(default=8, ge=1, le=20)
    session_id: str | None = Field(default=None)


class ChatSessionCreateRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str | None = Field(default=None)
    workspace_id: str | None = Field(default=None)
    title: str = Field(default="New Chat", min_length=1)


class ChatSessionRenameRequest(BaseModel):
    user_id: str = Field(min_length=1)
    title: str = Field(min_length=1)


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    document_id: str | None = None
    workspace_id: str | None = None
    created_at: str


class SourceCitation(BaseModel):
    document_id: str | None = None
    page_number: int
    chunk_text: str
    score: float


class ChatAskResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]


class WorkspaceCreateRequest(BaseModel):
    user_id: str = Field(min_length=1)
    name: str = Field(min_length=1)


class WorkspaceCreateResponse(BaseModel):
    workspace_id: str
    name: str
    status: str


class WorkspaceAddDocumentRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)


class WorkspaceRenameRequest(BaseModel):
    user_id: str = Field(min_length=1)
    name: str = Field(min_length=1)