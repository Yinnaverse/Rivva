-- Rivva phase 4: videos, subtitles, synced playback. Run once in Supabase → SQL Editor
-- (after schema.sql has been run).

-- ───────── Tables ─────────
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source_url text,                 -- set when the video is a pasted https link
  file_name text,                  -- set when the video was uploaded (stored at <id>/<file_name>)
  mime_type text,
  size_bytes bigint,
  duration_seconds double precision,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subtitles (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  lang text not null,
  label text not null,
  path text not null,
  unique (video_id, lang)
);

alter table public.rooms add column video_id uuid references public.videos (id) on delete set null;

create table public.room_playback (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  playing boolean not null default false,
  position double precision not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

-- ───────── Access ─────────
create function public.can_access_video(vid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from videos v
    where v.id = vid
      and (
        v.owner_id = auth.uid()
        or v.is_shared
        or exists (
          select 1 from rooms r
          join room_members m on m.room_id = r.id
          where r.video_id = v.id and m.user_id = auth.uid()
        )
      )
  );
$$;

alter table public.videos enable row level security;
alter table public.subtitles enable row level security;
alter table public.room_playback enable row level security;

create policy "see videos you can access" on public.videos
  for select to authenticated using (owner_id = auth.uid() or public.can_access_video(id));
create policy "add own videos" on public.videos
  for insert to authenticated with check (owner_id = auth.uid());
create policy "edit own videos" on public.videos
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own videos" on public.videos
  for delete to authenticated using (owner_id = auth.uid());

create policy "see subtitles of accessible videos" on public.subtitles
  for select to authenticated using (public.can_access_video(video_id));
create policy "add subtitles to own videos" on public.subtitles
  for insert to authenticated with check (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = auth.uid())
  );
create policy "delete subtitles of own videos" on public.subtitles
  for delete to authenticated using (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = auth.uid())
  );

create policy "members see playback" on public.room_playback
  for select to authenticated using (public.is_room_member(room_id));

-- ───────── Actions ─────────
create function public.server_time() returns timestamptz
language sql stable as $$ select clock_timestamp(); $$;

create function public.set_room_video(p_room uuid, p_video uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.videos;
begin
  if not exists (select 1 from rooms where id = p_room and host_id = auth.uid()) then
    raise exception 'Only the host can choose what to watch';
  end if;
  select * into v from videos where id = p_video and (owner_id = auth.uid() or is_shared);
  if not found then raise exception 'You can''t use that video'; end if;

  update rooms set video_id = p_video, status = 'playing', now_playing = v.title where id = p_room;
  insert into room_playback (room_id, playing, position, updated_at, updated_by)
  values (p_room, false, 0, now(), auth.uid())
  on conflict (room_id) do update
    set playing = false, position = 0, updated_at = now(), updated_by = auth.uid();
end $$;

create function public.clear_room_video(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host_id = auth.uid()) then
    raise exception 'Only the host can end the movie';
  end if;
  update rooms set video_id = null, status = 'waiting', now_playing = null where id = p_room;
  delete from room_playback where room_id = p_room;
end $$;

create function public.set_playback(p_room uuid, p_playing boolean, p_position double precision)
returns public.room_playback
language plpgsql security definer set search_path = public as $$
declare r public.rooms; pb public.room_playback;
begin
  select * into r from rooms where id = p_room;
  if not found or not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'Join the room first';
  end if;
  if r.video_id is null then raise exception 'Nothing is playing yet'; end if;
  if r.host_id <> auth.uid() and not r.sync_controls then
    raise exception 'Only the host can control playback';
  end if;

  insert into room_playback (room_id, playing, position, updated_at, updated_by)
  values (p_room, p_playing, greatest(p_position, 0), now(), auth.uid())
  on conflict (room_id) do update
    set playing = excluded.playing, position = excluded.position,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into pb;
  return pb;
end $$;

revoke all on function public.server_time() from public, anon;
revoke all on function public.set_room_video(uuid, uuid) from public, anon;
revoke all on function public.clear_room_video(uuid) from public, anon;
revoke all on function public.set_playback(uuid, boolean, double precision) from public, anon;
grant execute on function public.server_time() to authenticated;
grant execute on function public.set_room_video(uuid, uuid) to authenticated;
grant execute on function public.clear_room_video(uuid) to authenticated;
grant execute on function public.set_playback(uuid, boolean, double precision) to authenticated;

-- ───────── Storage: private "videos" bucket, files live at <video id>/<file> ─────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('videos', 'videos', false, 52428800)   -- 50 MB: the Free plan's cap
on conflict (id) do nothing;

create policy "read videos you can access" on storage.objects
  for select to authenticated
  using (bucket_id = 'videos' and public.can_access_video(((storage.foldername(name))[1])::uuid));

create policy "owners upload videos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and exists (
      select 1 from public.videos v
      where v.id = ((storage.foldername(name))[1])::uuid and v.owner_id = auth.uid()
    )
  );

create policy "owners delete video files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1 from public.videos v
      where v.id = ((storage.foldername(name))[1])::uuid and v.owner_id = auth.uid()
    )
  );

-- ───────── Realtime ─────────
alter publication supabase_realtime add table public.room_playback;
