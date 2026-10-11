-- Private bucket for post media (uploads and AI-generated images).
-- Objects live under "<user_id>/..." and are only reachable by their owner
-- (signed URLs for display; bytes are handed to the publisher server-side).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "Users can read their own post media"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own post media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own post media"
  on storage.objects for update to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own post media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
