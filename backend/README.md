# Lexora Backend

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `GOOGLE_API_KEY`
- `EMBEDDING_MODEL` (default: `models/text-embedding-004`)
- `GEMINI_CHAT_MODEL` (default: `gemini-1.5-flash`)
- `EMBEDDING_BATCH_SIZE` (default: `50`)
- `EMBEDDING_BATCH_SLEEP_SECONDS` (default: `1`)

## Automatic initialization on startup

The backend can auto-bootstrap missing resources when it starts.

- Always attempts to create storage bucket `documents` (or `BOOTSTRAP_BUCKET_NAME`) if missing.
- If `SUPABASE_DB_URL` is set, it also auto-applies:
  - `supabase/schema.sql`
  - `supabase/storage.sql`

Related flags:

- `AUTO_BOOTSTRAP_ON_STARTUP=true`
- `BOOTSTRAP_FAIL_FAST=false`
- `SUPABASE_DB_URL=`
- `BOOTSTRAP_BUCKET_NAME=documents`

## APIs

### Phase 2 ingestion

- `POST /api/v1/documents/ingest`
- Requires `Authorization: Bearer <supabase-access-token>`

Body:

```json
{
  "user_id": "<supabase-user-id>",
  "bucket": "documents",
  "file_path": "<storage-path>",
  "title": "<filename>.pdf"
}
```

### Phase 3 hybrid chat

- `POST /api/v1/chat/ask`
- Requires `Authorization: Bearer <supabase-access-token>`

Body:

```json
{
  "user_id": "<supabase-user-id>",
  "document_id": "<document-id>",
  "question": "What are the termination conditions?",
  "alpha": 0.5,
  "top_k": 8
}
```

## Railway readiness

- `Procfile` and `railway.json` are included.
- Start command binds to `0.0.0.0` and `${PORT}`.
- Health check endpoint: `/health`.
