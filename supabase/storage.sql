-- Lexora Phase 2 storage setup
-- Create a private bucket for user PDF uploads and strict owner policies.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Users can only access objects under their own folder prefix: <auth.uid()>/...
drop policy if exists "storage_documents_select_own" on storage.objects;
create policy "storage_documents_select_own"
on storage.objects
for select
to authenticated
using (bucket_id = 'documents' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "storage_documents_insert_own" on storage.objects;
create policy "storage_documents_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'documents' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "storage_documents_update_own" on storage.objects;
create policy "storage_documents_update_own"
on storage.objects
for update
to authenticated
using (bucket_id = 'documents' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'documents' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "storage_documents_delete_own" on storage.objects;
create policy "storage_documents_delete_own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'documents' and split_part(name, '/', 1) = auth.uid()::text);
