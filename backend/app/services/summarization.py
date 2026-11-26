import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from typing import Any
from app.config import get_settings

async def generate_summary_and_entities(chunk_records: list[dict[str, Any]]) -> tuple[str, list[str]]:
    """
    Takes the first few chunks of the document and asks an LLM to extract a summary and key entities.
    """
    # Just take the first 5000 characters to save tokens and time
    text_content = "\n\n".join([record["text"] for record in chunk_records])[:5000]

    settings = get_settings()
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2, google_api_key=settings.google_api_key)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert document analyst. Read the following text extracted from a document and provide a concise executive summary (3-4 sentences) and a list of key entities (people, organizations, important terms, concepts). Output your response strictly in valid JSON format with keys 'summary' (string) and 'entities' (list of strings)."),
        ("user", "{text}")
    ])

    chain = prompt | llm

    try:
        res = await chain.ainvoke({"text": text_content})
        
        # Parse JSON
        content = res.content.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
            
        data = json.loads(content)
        return data.get("summary", "Summary not available."), data.get("entities", [])
    except Exception as e:
        print(f"Summarization error: {e}")
        return "Summary generation failed.", []


from app.supabase_client import get_supabase_client
from app.services.file_processing import extract_text_chunks

async def summarize_document_by_id(document_id: str, user_id: str):
    supabase = get_supabase_client()
    doc_res = supabase.table("documents").select("file_path, mime_type").eq("id", document_id).eq("user_id", user_id).single().execute()
    if not doc_res.data:
        raise ValueError("Document not found")
        
    file_bytes = supabase.storage.from_("documents").download(doc_res.data["file_path"])
    if not file_bytes:
        raise ValueError("Could not download file")
        
    chunk_records, _ = extract_text_chunks(file_bytes, doc_res.data["mime_type"])
    summary, entities = await generate_summary_and_entities(chunk_records)
    
    supabase.table("documents").update({"summary": summary, "entities": entities}).eq("id", document_id).execute()
    return {"summary": summary, "entities": entities}

async def summarize_workspace_by_id(workspace_id: str, user_id: str):
    supabase = get_supabase_client()
    ws_res = supabase.table("workspaces").select("id").eq("id", workspace_id).eq("user_id", user_id).execute()
    if not ws_res.data:
        raise ValueError("Workspace not found")
        
    # Get all documents in workspace
    docs_res = supabase.table("workspace_documents").select("document_id").eq("workspace_id", workspace_id).execute()
    if not docs_res.data:
        raise ValueError("No documents in workspace")
        
    all_chunks = []
    for doc in docs_res.data:
        d_res = supabase.table("documents").select("file_path, mime_type").eq("id", doc["document_id"]).single().execute()
        if d_res.data:
            file_bytes = supabase.storage.from_("documents").download(d_res.data["file_path"])
            if file_bytes:
                chunks, _ = extract_text_chunks(file_bytes, d_res.data["mime_type"])
                all_chunks.extend(chunks[:5]) # take first few chunks from each doc
                
    summary, entities = await generate_summary_and_entities(all_chunks)
    supabase.table("workspaces").update({"summary": summary, "entities": entities}).eq("id", workspace_id).execute()
    return {"summary": summary, "entities": entities}
