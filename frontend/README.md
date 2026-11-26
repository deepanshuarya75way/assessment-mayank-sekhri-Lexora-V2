# Lexora Frontend

## Setup

Install dependencies:

```bash
npm install
```

## Run

```bash
npm run dev
```

## Production check

```bash
npm run build
npm run start
```

## Environment

Copy `.env.example` to `.env.local` and fill values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` (default: `documents`)

## Vercel readiness

- `vercel.json` is included.
- Build command is `npm run build`.
- Ensure all `NEXT_PUBLIC_*` vars are set in Vercel project settings.
