begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'batch-images' $$,
  $$ values (true, 5242880::bigint, '{image/webp,image/jpeg,image/png}'::text[]) $$,
  'batch-images bucket is public with 5 MB limit and image mime types'
);

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'site-media' $$,
  $$ values (true, 52428800::bigint, '{video/mp4,image/jpeg}'::text[]) $$,
  'site-media bucket is public with 50 MB limit and video/image mime types'
);

select is_empty(
  $$ select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and roles && array['anon','authenticated']::name[]
       and cmd in ('INSERT','UPDATE','DELETE','ALL') $$,
  'anon and authenticated have no write policies on storage.objects'
);

select * from finish();
rollback;
