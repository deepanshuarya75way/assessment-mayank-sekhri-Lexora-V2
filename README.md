# 🌌 Lexora

> **"Because naive RAG is just an LLM guessing in the dark with a bloated context window."**

Lexora is a fully-decoupled, AI-powered document processing and analysis SaaS. Instead of just chunking text, throwing it at a basic vector store, and hoping for the best, Lexora implements a true **Hybrid RAG** (Retrieval-Augmented Generation) pipeline. It marries dense semantic embeddings with sparse BM25 keyword matching, wraps it in a gorgeous glassmorphic dark-mode interface, and isolates everything safely behind strict Row-Level Security (RLS) workspaces.

Whether you're querying a single dense 200-page technical specification or analyzing a shared workspace containing dozens of cross-referenced documents, Lexora retrieves *exactly* what you need, explains its answers, and cites its sources down to the exact chunk and page number.

---

## ✨ Features

*   **⚡ Hybrid Search RAG**: Combines the semantic depth of dense vectors (`google/text-embedding-004`) with the pinpoint keyword precision of sparse vectors (BM25).
*   **🎚️ The Alpha Slider**: A dynamic retrieval parameter (`alpha` from `0.0` to `1.0`) that lets you slide smoothly between pure keyword match (`0.0`) and pure semantic match (`1.0`).
*   **👥 Workspace Isolation**: Group documents into collaborative, project-specific workspaces. Search and chat with a single file or query across the entire workspace collection simultaneously.
*   **💎 Premium Glassmorphism UI**: A gorgeous, dark-themed dashboard built with React 18, Next.js 14 (App Router), Tailwind CSS, and buttery-smooth micro-animations powered by **Framer Motion**.
*   **🛡️ Robust Security**: Everything is secured via Supabase Auth (SSR) and strict PostgreSQL Row-Level Security (RLS) policies. Your documents are yours alone.
*   **🏎️ Rate-Limit Proof Ingestion**: Document parsing via PyMuPDF (super-fast) with embedding chunk-batching and adaptive throttling to completely bypass Google AI Studio rate limits.
*   **🔌 Zero-Config Bootstrapping**: A self-healing backend that automatically provisions missing Supabase storage buckets and applies SQL database migrations on startup.

---

## 🛠️ The Tech Stack

Lexora is architected with a clean, fully-decoupled, asynchronous full-stack setup:

| Layer | Technology | Why we chose it |
| :--- | :--- | :--- |
| **Frontend** | `Next.js 14` (App Router) + `TS` | Fast SSR page loads, strict type safety, clean component-driven layout. |
| **Aesthetics** | `Tailwind CSS` + `Framer Motion` | Sleek custom glassmorphic panels, fluid sidebars, responsive design. |
| **Backend** | `FastAPI` (Python 3.11, `asyncio`) | Asynchronous, lightning-fast endpoints; perfect for I/O bound LLM pipelines. |
| **Database** | `Supabase` (Postgres) | Enterprise-grade SQL relational schemas, simple SSR auth, robust RLS. |
| **Storage** | `Supabase Storage` | Secure object storage for original uploaded PDFs. |
| **Vector DB** | `Pinecone` (Serverless) | Native sparse-dense hybrid vector indexing, high performance, zero maintenance. |
| **Orchestration**| `LangChain` | Clean prompt templating, robust document splitters. |
| **LLM & Embeds**| `Gemini 1.5 Flash` + `text-embedding-004` | Lightning-fast synthesis, highly contextual embeddings, massive context window. |

---

## 📐 Under the Hood: How the Hybrid RAG Works

Most standard RAG applications do a simple cosine similarity search on dense embeddings. If you search for an exact term like *"Model-X790 Section 4"*, dense embeddings might fetch general sections about products, completely missing the exact clause.

Lexora fixes this by indexing every chunk twice:
1.  **Dense Embedding**: Using Google's `text-embedding-004` (768 dimensions) to capture deep semantic concepts and synonyms.
2.  **Sparse Vector**: Using `pinecone-text`'s **BM25 Encoder** to map TF-IDF-like keyword frequencies.

```
       ┌───────────────── Uploaded PDF ─────────────────┐
       │                                                │
       ▼ (PyMuPDF Extraction)                           ▼
┌──────────────┐                                 ┌──────────────┐
│  Text Chunk  │                                 │  Text Chunk  │
└──────┬───────┘                                 └──────┬───────┘
       │ (LangChain Splitter: 1000 char / 200 overlap)  │
       ▼                                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Hybrid Embedding Engine                   │
│  ┌───────────────────────────┐ ┌───────────────────────────┐  │
│  │   Dense Vector Generator  │ │  Sparse Vector Generator  │  │
│  │  (Google text-embed-004)  │ │      (BM25 Encoder)       │  │
│  └─────────────┬─────────────┘ └─────────────┬─────────────┘  │
└────────────────┼─────────────────────────────┼────────────────┘
                 └──────────────┬──────────────┘
                                ▼ (Batched & Rate-Limited Upsert)
                 ┌─────────────────────────────┐
                 │ Pinecone Serverless Index   │
                 └─────────────────────────────┘
```

When you ask a question:
- Lexora embeds your query into both a dense vector and a sparse vector.
- It applies the **Alpha Scale Formula**:
  $$\text{Query Vector} = \text{Dense Vector} \times \alpha$$
  $$\text{Query Sparse} = \text{Sparse Vector} \times (1 - \alpha)$$
- A single hybrid query is dispatched to Pinecone.
- The returned context blocks are formatted, injected into a LangChain system prompt, synthesized by **Gemini 1.5 Flash**, and streamed/saved back to your Supabase chat history.

---

## 🚀 Getting Started (Local Development)

We've made spinning up Lexora extremely easy with a custom developer control script.

### 1. Prerequisites
Make sure you have the following installed on your machine:
*   **Python 3.10+**
*   **Node.js 18+** & **npm**
*   A **Supabase** account (Free tier is perfect)
*   A **Pinecone** Serverless Index (configured for sparse-dense vectors)
*   A **Google AI Studio (Gemini)** API key

---

### 2. Environment Setup

#### **Backend Env Configuration**
Create a `.env` file inside the `backend/` directory:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_DB_URL=postgresql://postgres.your-project-id:your-db-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Vector & AI Keys
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=your-pinecone-index-name
GOOGLE_API_KEY=your-gemini-api-key

# Embedding Configuration
EMBEDDING_MODEL=models/text-embedding-004
GEMINI_CHAT_MODEL=gemini-1.5-flash
EMBEDDING_BATCH_SIZE=50
EMBEDDING_BATCH_SLEEP_SECONDS=1

# Local Port & CORS
PORT=8000
CORS_ORIGINS=http://localhost:3000
AUTO_BOOTSTRAP_ON_STARTUP=true
```

#### **Frontend Env Configuration**
Create a `.env.local` file inside the `frontend/` directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=documents
```

---

### 3. Running the Stack

You don't need to split your terminal and run multiple complex processes. Just use the custom bootstrap script in the root directory:

```bash
# Make it executable (if it isn't already)
chmod +x start-dev.sh

# Run the complete stack (it checks ports, installs missing deps, and runs services)
./start-dev.sh
```

**What the script does for you:**
1.  Verifies Python, Node.js, and npm are installed.
2.  Ensures your `.env` configuration files exist.
3.  Checks if ports `8000` (Backend) and `3000` (Frontend) are clear.
4.  Initializes a backend virtual environment (`.venv`) and installs dependencies.
5.  Installs frontend `node_modules`.
6.  Spins up the FastAPI backend and Next.js frontend in the background.
7.  Directs logs to `/tmp/lexora_backend.log` and `/tmp/lexora_frontend.log` so your terminal stays neat.
8.  **Graceful shutdown**: Hitting `Ctrl+C` terminates both servers instantly—no stray processes left running on port 8000 or 3000!

---

## 🛠️ Deploying to Production

Lexora is built production-ready and fully audited for horizontal scaling.

### **Backend (Railway)**
The backend includes a `Procfile` and a `railway.json` blueprint.
1. Connect your Github repository to Railway.
2. Set up a Python service.
3. Add the exact environment variables from `backend/.env` (make sure `CORS_ORIGINS` points to your Vercel frontend domain).

### **Frontend (Vercel)**
The frontend includes a `vercel.json` file.
1. Connect your repository to Vercel.
2. Set the root directory to `frontend`.
3. Set the production environment variables (with `NEXT_PUBLIC_API_URL` pointing to your Railway backend URL).
4. Deploy!

---

## 🧠 Engineering Insights & Self-Reflections

Building a high-quality RAG system is harder than it looks. Here are a few technical trade-offs we encountered and solved during development:

*   **Google AI Studio Embedding Rate Limits**: Google's free/low-tier API limits requests strictly. Embedding a 200-page document all at once would crash the worker. We solved this by writing a custom chunk iterator inside `app/services/hybrid_indexer.py` that processes files in batches of `50` and executes `asyncio.sleep(1)` to let the API cool down.
*   **Supabase SSR Authentication**: Handling sessions in Next.js Server Components can get messy. We used the modern `@supabase/ssr` middleware structure to intercept requests, validate server-side cookies, and transparently pass the access token down to client-side components to fetch document indices securely.
*   **Synchronous Block Prevention**: PDF text parsing (PyMuPDF) and BM25 matrix generation are highly CPU-bound. In FastAPI, running synchronous blocking functions in an `async def` handler halts the main event loop. We wrapped all heavy operations inside `asyncio.to_thread()` to keep the web application highly responsive under load.

---

## 📜 License

Lexora is open-source software, licensed under the [MIT License](LICENSE). Feel free to spin it up, tear it down, and build your own custom document agents!

---
*Created by [redditard](https://github.com/redditard)*. Let us know if you run into any issues or have cool ideas for hybrid retrievers! 🌌
