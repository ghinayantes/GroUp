insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('batch-images', 'batch-images', true, 5242880, '{image/webp,image/jpeg,image/png}'),
  ('site-media', 'site-media', true, 52428800, '{video/mp4,image/jpeg}')
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
