-- Allow signed-in students to create only their own private staging objects.
-- TUS requests authenticate with the student's Supabase access token.
drop policy if exists thesis_staging_insert on storage.objects;

create policy thesis_staging_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'theses'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = 'staging'
);
