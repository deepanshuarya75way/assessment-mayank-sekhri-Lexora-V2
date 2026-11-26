# Supabase Setup (Phase 1)

1. Open your Supabase project SQL editor.
2. Run the SQL in `schema.sql`.
3. Verify tables exist with RLS enabled:
   - users
   - documents
   - analyses
   - chat_messages
4. Confirm all RLS policies are created and scoped to `auth.uid()` ownership.

# Supabase Setup (Phase 2)

1. Run `storage.sql` in the SQL editor.
2. Verify bucket `documents` exists and is private.
3. Verify storage policies only allow each user to access objects under `<auth.uid()>/...`.
