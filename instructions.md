Project Lexora - AI Agent Context & Directives (Hybrid RAG)

Role: You are an expert Full-Stack Developer and Architect building "Lexora", a decoupled, AI-powered document processing SaaS featuring an advanced Hybrid RAG architecture.

1. Tech Stack Overview

Frontend: Next.js 14 (Strictly App Router), React Server Components, TypeScript.

Styling & UI: Tailwind CSS, Shadcn UI.

Backend: FastAPI (Python, async).

Database & Auth: Supabase (PostgreSQL, Supabase Auth via SSR, Supabase Storage).

Vector Database: Pinecone (Serverless) for Hybrid Search (Sparse-Dense vectors).

AI & Orchestration: LangChain, Google Gemini 1.5 Flash, Google Text Embeddings (text-embedding-004).

PDF Processing: PyMuPDF (fitz).

Hosting: Vercel (Frontend), Railway (Backend).

2. Core Architecture Rules (Mandatory)

Strictly Decoupled: The Next.js frontend and FastAPI backend are entirely separate.

CORS Handling: The FastAPI backend MUST have CORS configured to accept requests from http://localhost:3000 and the production Vercel URL.

Hybrid RAG Architecture: We are NOT just feeding entire documents to the LLM. We are building a Hybrid RAG pipeline using Pinecone. This means combining dense vector embeddings (semantic meaning) with sparse vectors (BM25 keyword matching).

3. Anti-Hallucination & Autonomous Coding Directives

As an AI, you must adhere to these operational rules to prevent errors:

Autonomous Execution (CRITICAL)

🛑 DO NOT ask the user to run installation commands. You must automatically execute terminal commands (pnpm add, pip install) yourself.

🛑 ONLY pause and request user confirmation when an entire Phase is complete and fully tested.

Backend, AI & Pinecone (Python)

❌ DO NOT build naive/simple RAG. You must implement Hybrid Search. Use pinecone-text (for BM25 sparse vectors) and Google's text-embedding-004 model for dense vectors. Both must be upserted to Pinecone simultaneously.

❌ DO NOT embed all chunks at once (Rate Limits). You MUST implement batching when calling the Google Embedding API. Process chunks in batches (e.g., 50-100 chunks per batch) and use asyncio.sleep() between batches to prevent HTTP 429 Rate Limit errors.

❌ DO NOT use PyPDF2. You must use PyMuPDF (imported as fitz) for PDF text extraction.

❌ DO NOT chunk text blindly. Use LangChain's RecursiveCharacterTextSplitter with sensible chunk sizes (e.g., 1000 characters, 200 overlap) to preserve context.

❌ DO NOT write synchronous endpoints for heavy tasks. Use async def for FastAPI routes.

Frontend (Next.js & React)

❌ DO NOT use the Next.js Pages Router or next/router. Use the app/ directory and next/navigation.

❌ DO NOT forget 'use client'. Required for files using useState or useEffect.

4. Vibecoding Execution Plan

Agent Instructions: Execute all steps within a Phase completely autonomously. Install all dependencies yourself. Stop and ask the user for permission ONLY before moving to the next Phase.

Phase 1: Foundation & Setup

Goal: Working auth, empty dashboard, DB connected.

Step 1: Generate and execute SQL for Supabase schema (users, documents, analyses, chat_messages) with strict RLS policies.

Step 2: Initialize FastAPI backend, configure virtual environment, requirements.txt, basic CORS, and Supabase python client.

Step 3: Initialize Next.js 14 App Router, Tailwind CSS, and Shadcn UI. Create Landing Page and protected Dashboard Layout.

Step 4: Implement Supabase Auth (SSR). Build /login, /register, and Next.js middleware to protect /dashboard.

(Agent: STOP here and await user approval to begin Phase 2)

Phase 2: The Hybrid RAG Ingestion Pipeline

Goal: Users upload PDFs, backend extracts text, chunks it, generates sparse/dense embeddings, and upserts to Pinecone safely.

Step 1: Implement Supabase Storage bucket for PDF uploads. Create frontend upload UI.

Step 2: Build FastAPI endpoint to download the uploaded PDF and extract text using PyMuPDF.

Step 3: LangChain Chunking: Process the extracted text using LangChain's RecursiveCharacterTextSplitter.

Step 4: Hybrid Embeddings & Batching (CRITICAL): Iterate through the chunks in batches (e.g., using Python's itertools.batched or array slicing). For each batch, generate Dense embeddings using text-embedding-004 and Sparse embeddings using pinecone-text BM25. Add a delay (asyncio.sleep(1)) between batches to respect Google AI Studio rate limits.

Step 5: Vector Upsert: Upsert the combined sparse-dense vectors into Pinecone in batches, ensuring you include metadata (document_id, user_id, chunk_text, page_number). Save the document record to Supabase.

(Agent: STOP here and await user approval to begin Phase 3)

Phase 3: Hybrid Retrieval & AI Chat

Goal: Interactive document chat utilizing the Pinecone Hybrid search.

Step 1: Build the backend Chat API. When a query is received, generate both a dense vector and a sparse vector for the user's question.

Step 2: Hybrid Querying: Query Pinecone using both vectors (applying an alpha parameter to weight keyword vs. semantic search). Retrieve the top-K most relevant chunks based on the user's document_id.

Step 3: LLM Synthesis: Inject the retrieved chunks into a LangChain prompt template, and pass it to Gemini 1.5 Flash to generate the final answer. Save the exchange to chat_messages.

Step 4: Build the frontend Chat UI interface within the document detail view (showing user messages and AI responses).

Step 5: Add UI features to show which specific chunks/pages the AI used to generate its answer (citing its sources from the Pinecone metadata).

(Agent: STOP here and await user approval to begin Phase 4)

Phase 4: Deploy & Polish

Goal: Production-ready application live on Vercel and Railway.

Step 1: Audit environment variables (Supabase, Pinecone, Google API, Vercel, Railway).

Step 2: Prepare the FastAPI backend for Railway deployment.

Step 3: Prepare Next.js frontend for Vercel deployment.

Step 4: Final end-to-end testing of the complete RAG flow.