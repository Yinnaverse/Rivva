-- Rivva phase 5: saved videos + account deletion. Run once in Supabase → SQL Editor
-- (after schema.sql and phase4.sql).

create table public.saved_videos (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.saved_videos enable row level security;

create policy "see own saved videos" on public.saved_videos
  for select to authenticated using (user_id = auth.uid());
create policy "save videos you can access" on public.saved_videos
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_video(video_id));
create policy "unsave videos" on public.saved_videos
  for delete to authenticated using (user_id = auth.uid());

-- Deletes the signed-in user's login; their profile, rooms, chats, videos and saved list
-- all cascade away with it. (The app removes uploaded files from storage first.)
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
