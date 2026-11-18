-- Rivva phase 9: profile pictures. Run once in Supabase → SQL Editor.

alter table public.profiles add column avatar_url text;

-- A profile picture may only point at a file inside your own folder of the avatars bucket,
-- so nobody can make their profile display an outside image.
alter table public.profiles add constraint avatar_url_is_own check (
  avatar_url is null
  or avatar_url like '%/storage/v1/object/public/avatars/' || id::text || '/%'
);

-- Public bucket (pictures are shown to other people). Small files only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "list own avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
