# Phase 4 Deployment Audit (Deployment On Hold)

## Backend env keys

Required in Railway:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- CORS_ORIGINS
- PINECONE_API_KEY
- PINECONE_INDEX_NAME
- GOOGLE_API_KEY
- EMBEDDING_MODEL
- GEMINI_CHAT_MODEL
- EMBEDDING_BATCH_SIZE
- EMBEDDING_BATCH_SLEEP_SECONDS

Notes:

- `CORS_ORIGINS` must include `http://localhost:3000` and the deployed Vercel URL.
- `GEMINI_CHAT_MODEL` should be `gemini-1.5-flash` to match project instructions.

## Frontend env keys

Required in Vercel:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET

Notes:

- `NEXT_PUBLIC_API_URL` should point to Railway backend URL in production.

## Deployment readiness files

Backend:

- `backend/Procfile`
- `backend/railway.json`

Frontend:

- `frontend/vercel.json`

## Final pre-deploy checks

- Backend starts with `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
- Frontend passes `npm run build` and `npm run lint`.
- `/health` endpoint returns 200.
- Auth-protected endpoints return 401 for missing/invalid bearer token.
