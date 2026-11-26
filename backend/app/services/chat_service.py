import asyncio
from typing import Any

import google.generativeai as genai
from langchain_core.prompts import ChatPromptTemplate
from pinecone import Pinecone
from pinecone_text.sparse import BM25Encoder

from app.config import get_settings
from app.schemas import ChatAskRequest, ChatAskResponse, SourceCitation
from app.services.hybrid_indexer import _extract_embedding
from app.services.nltk_setup import ensure_nltk_resources
from app.supabase_client import get_supabase_client


def _hybrid_scale(dense: list[float], sparse: dict[str, Any], alpha: float) -> tuple[list[float], dict[str, Any]]:
    if not 0 <= alpha <= 1:
        raise ValueError("alpha must be between 0 and 1")

    scaled_dense = [v * alpha for v in dense]
    scaled_sparse = {
        "indices": sparse["indices"],
        "values": [v * (1 - alpha) for v in sparse["values"]],
    }
    return scaled_dense, scaled_sparse


async def _embed_query(question: str, model: str) -> list[float]:
    def _sync_embed() -> list[float]:
        payload = genai.embed_content(
            model=model,
            content=question,
            task_type="retrieval_query",
        )
        return _extract_embedding(payload)

    return await asyncio.to_thread(_sync_embed)


async def ask_document_question(payload: ChatAskRequest) -> ChatAskResponse:
    settings = get_settings()

    if not settings.pinecone_api_key or not settings.pinecone_index_name:
        raise ValueError("PINECONE_API_KEY and PINECONE_INDEX_NAME must be set")
    if not settings.google_api_key:
        raise ValueError("GOOGLE_API_KEY must be set")

    genai.configure(api_key=settings.google_api_key)
    await asyncio.to_thread(ensure_nltk_resources)

    bm25 = BM25Encoder.default()
    sparse_query = bm25.encode_queries([payload.question])[0]
    dense_query = await _embed_query(payload.question, settings.embedding_model)
    dense_query, sparse_query = _hybrid_scale(dense_query, sparse_query, payload.alpha)

    supabase = get_supabase_client()
    
    document_ids = []
    if payload.workspace_id:
        # Fetch documents in workspace
        ws_docs_res = supabase.table("workspace_documents").select("document_id").eq("workspace_id", payload.workspace_id).execute()
        document_ids = [d["document_id"] for d in ws_docs_res.data]
        if not document_ids:
             raise ValueError("Workspace is empty")
    elif payload.document_id:
        document_ids = [payload.document_id]
    else:
        raise ValueError("Either document_id or workspace_id must be provided")

    pinecone = Pinecone(api_key=settings.pinecone_api_key)
    index = pinecone.Index(settings.pinecone_index_name)

    query_response = await asyncio.to_thread(
        index.query,
        vector=dense_query,
        sparse_vector=sparse_query,
        top_k=payload.top_k,
        include_metadata=True,
        filter={
            "document_id": {"$in": document_ids},
            "user_id": {"$eq": payload.user_id},
        },
    )

    matches = getattr(query_response, "matches", []) or []
    citations: list[SourceCitation] = []
    context_blocks: list[str] = []

    for match in matches:
        metadata = dict(getattr(match, "metadata", {}) or {})
        chunk_text = str(metadata.get("chunk_text", "")).strip()
        page_number = int(metadata.get("page_number", 0) or 0)
        score = float(getattr(match, "score", 0.0) or 0.0)
        doc_id_meta = str(metadata.get("document_id", ""))

        if not chunk_text or page_number <= 0:
            continue

        citations.append(SourceCitation(document_id=doc_id_meta, page_number=page_number, chunk_text=chunk_text, score=score))
        context_blocks.append(f"[Doc: {doc_id_meta}, Page {page_number}] {chunk_text}")

    if not context_blocks:
        raise ValueError("No relevant document chunks were found for this question")

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are Lexora, an expert document assistant. Answer only from the provided context. "
                "If context is insufficient, clearly say so. Keep answers concise and factual.",
            ),
            (
                "human",
                "Question: {question}\n\nContext:\n{context}\n\nProvide a direct answer and reference relevant document and page numbers.",
            ),
        ]
    )

    prompt_value = prompt.format_prompt(question=payload.question, context="\n\n".join(context_blocks))

    def _sync_generate() -> str:
        model = genai.GenerativeModel(settings.gemini_chat_model)
        response = model.generate_content(prompt_value.to_string())
        text = getattr(response, "text", "")
        if not text:
            raise ValueError("Gemini returned an empty response")
        return text.strip()

    answer = await asyncio.to_thread(_sync_generate)

    message_data_user = {
        "user_id": payload.user_id,
        "role": "user",
        "content": payload.question,
    }
    message_data_assistant = {
        "user_id": payload.user_id,
        "role": "assistant",
        "content": answer,
    }
    
    session_id = payload.session_id
    if not session_id:
        # Check if there is an existing session
        query = supabase.table("chat_sessions").select("id").eq("user_id", payload.user_id)
        if payload.workspace_id:
            query = query.eq("workspace_id", payload.workspace_id)
        else:
            query = query.eq("document_id", payload.document_id)
        
        session_res = query.order("created_at", desc=False).limit(1).execute()
        if session_res.data:
            session_id = session_res.data[0]["id"]
        else:
            # Create a default session
            create_data = {
                "user_id": payload.user_id,
                "title": "Default Chat"
            }
            if payload.workspace_id:
                create_data["workspace_id"] = payload.workspace_id
            else:
                create_data["document_id"] = payload.document_id
            
            new_session = supabase.table("chat_sessions").insert(create_data).execute()
            if new_session.data:
                session_id = new_session.data[0]["id"]

    if session_id:
        message_data_user["session_id"] = session_id
        message_data_assistant["session_id"] = session_id

    if payload.workspace_id:
        message_data_user["workspace_id"] = payload.workspace_id
        message_data_assistant["workspace_id"] = payload.workspace_id
    else:
        message_data_user["document_id"] = payload.document_id
        message_data_assistant["document_id"] = payload.document_id

    supabase.table("chat_messages").insert(message_data_user).execute()
    supabase.table("chat_messages").insert(message_data_assistant).execute()

    return ChatAskResponse(answer=answer, sources=citations)
