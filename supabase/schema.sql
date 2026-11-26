-- Lexora Phase 1 & 2 schema with strict RLS (Fully Idempotent)
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'completed', 'failed', 'cancelled', 'deleting')),
  ingestion_step text not null default 'uploading'
    check (ingestion_step in ('uploading', 'chunking', 'indexing', 'completed', 'failed', 'cancelled')),
  ingestion_progress integer not null default 0
    check (ingestion_progress >= 0 and ingestion_progress <= 100),
  step_message text,
  chunks_indexed integer not null default 0,
  page_count integer not null default 0,
  is_deleting boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  summary text,
  key_points jsonb,
  raw_output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_analyses_updated_at on public.analyses;
create trigger set_analyses_updated_at
before update on public.analyses
for each row
execute procedure public.set_updated_at();

-- Keep public.users synced with auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- Enable RLS and strict policies
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.analyses enable row level security;
alter table public.chat_messages enable row level security;

-- users policies
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- documents policies
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
on public.documents
for select
using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
on public.documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
on public.documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
on public.documents
for delete
using (auth.uid() = user_id);

-- analyses policies
drop policy if exists "analyses_select_own" on public.analyses;
create policy "analyses_select_own"
on public.analyses
for select
using (auth.uid() = user_id);

drop policy if exists "analyses_insert_own" on public.analyses;
create policy "analyses_insert_own"
on public.analyses
for insert
with check (auth.uid() = user_id);

drop policy if exists "analyses_update_own" on public.analyses;
create policy "analyses_update_own"
on public.analyses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "analyses_delete_own" on public.analyses;
create policy "analyses_delete_own"
on public.analyses
for delete
using (auth.uid() = user_id);

-- chat policies
drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own"
on public.chat_messages
for select
using (auth.uid() = user_id);

drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own"
on public.chat_messages
for insert
with check (auth.uid() = user_id);

drop policy if exists "chat_delete_own" on public.chat_messages;
create policy "chat_delete_own"
on public.chat_messages
for delete
using (auth.uid() = user_id);

-- Workspaces schema
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_documents (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, document_id)
);

-- Auto-update updated_at timestamps for workspaces
drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute procedure public.set_updated_at();

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.workspace_documents enable row level security;

-- workspaces policies
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
on public.workspaces
for select
using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own"
on public.workspaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
on public.workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own"
on public.workspaces
for delete
using (auth.uid() = user_id);

-- workspace_documents policies
drop policy if exists "workspace_documents_select_own" on public.workspace_documents;
create policy "workspace_documents_select_own"
on public.workspace_documents
for select
using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_documents.workspace_id and w.user_id = auth.uid()
  )
);

drop policy if exists "workspace_documents_insert_own" on public.workspace_documents;
create policy "workspace_documents_insert_own"
on public.workspace_documents
for insert
with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_documents.workspace_id and w.user_id = auth.uid()
  )
);

drop policy if exists "workspace_documents_delete_own" on public.workspace_documents;
create policy "workspace_documents_delete_own"
on public.workspace_documents
for delete
using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_documents.workspace_id and w.user_id = auth.uid()
  )
);

-- Alter chat_messages to support workspaces
alter table public.chat_messages alter column document_id drop not null;
alter table public.chat_messages add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

-- Phase 2 additions
alter table public.documents add column if not exists summary text;
alter table public.documents add column if not exists entities jsonb;
alter table public.workspaces add column if not exists summary text;
alter table public.workspaces add column if not exists entities jsonb;

-- Ingestion step progress & pre-emptive deletion columns (idempotent migration)
alter table public.documents add column if not exists ingestion_step text not null default 'uploading';
alter table public.documents add column if not exists ingestion_progress integer not null default 0;
alter table public.documents add column if not exists step_message text;
alter table public.documents add column if not exists chunks_indexed integer not null default 0;
alter table public.documents add column if not exists page_count integer not null default 0;
alter table public.documents add column if not exists is_deleting boolean not null default false;
alter table public.documents add column if not exists error_message text;

-- Update status & ingestion_step constraints safely on existing tables
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'documents'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%status%'
        or pg_get_constraintdef(con.oid) ilike '%ingestion_step%'
        or pg_get_constraintdef(con.oid) ilike '%ingestion_progress%'
      )
  loop
    execute format('alter table public.documents drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'processing', 'completed', 'failed', 'cancelled', 'deleting'));

alter table public.documents
  add constraint documents_ingestion_step_check
  check (ingestion_step in ('uploading', 'chunking', 'indexing', 'completed', 'failed', 'cancelled'));

alter table public.documents
  add constraint documents_ingestion_progress_check
  check (ingestion_progress >= 0 and ingestion_progress <= 100);

create index if not exists idx_documents_user_step
  on public.documents (user_id, ingestion_step);

-- Chat Sessions (Threads)
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_sessions enable row level security;

drop policy if exists "Users can access their own chat sessions" on public.chat_sessions;
create policy "Users can access their own chat sessions" on public.chat_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Link messages to sessions
alter table public.chat_messages add column if not exists session_id uuid references public.chat_sessions (id) on delete cascade;

-- Data migration: Create default sessions for existing NULL session_id messages
insert into public.chat_sessions (user_id, document_id, title)
select distinct user_id, document_id, 'Default Chat'
from public.chat_messages
where document_id is not null and session_id is null
on conflict do nothing;

update public.chat_messages m
set session_id = s.id
from public.chat_sessions s
where m.document_id = s.document_id and m.user_id = s.user_id and m.session_id is null;

insert into public.chat_sessions (user_id, workspace_id, title)
select distinct user_id, workspace_id, 'Default Chat'
from public.chat_messages
where workspace_id is not null and session_id is null
on conflict do nothing;

update public.chat_messages m
set session_id = s.id
from public.chat_sessions s
where m.workspace_id = s.workspace_id and m.user_id = s.user_id and m.session_id is null;

-- Backfill existing completed/failed documents
update public.documents
set ingestion_step = 'completed',
    ingestion_progress = 100,
    step_message = coalesce(step_message, 'Ingestion complete')
where status = 'completed'
  and (ingestion_step is null or ingestion_step <> 'completed');

update public.documents
set ingestion_step = 'failed',
    step_message = coalesce(step_message, 'Ingestion failed')
where status = 'failed'
  and (ingestion_step is null or ingestion_step <> 'failed');