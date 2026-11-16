-- Rivva phase 6: pause the room while someone buffers. Run once in Supabase → SQL Editor
-- (after schema.sql, phase4.sql and phase5.sql).

alter table public.room_playback add column held boolean not null default false;

-- Any manual play / pause / seek clears an automatic hold.
create or replace function public.set_playback(p_room uuid, p_playing boolean, p_position double precision)
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

  insert into room_playback (room_id, playing, position, held, updated_at, updated_by)
  values (p_room, p_playing, greatest(p_position, 0), false, now(), auth.uid())
  on conflict (room_id) do update
    set playing = excluded.playing, position = excluded.position, held = false,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into pb;
  return pb;
end $$;

-- Called by whoever starts buffering: freezes the room at their position.
-- Allowed for any member (it is automatic, not a control), and only acts if the room is playing.
create function public.hold_playback(p_room uuid, p_position double precision)
returns public.room_playback
language plpgsql security definer set search_path = public as $$
declare pb public.room_playback;
begin
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'Join the room first';
  end if;
  update room_playback
    set playing = false, held = true, position = greatest(p_position, 0), updated_at = now(), updated_by = auth.uid()
    where room_id = p_room and playing and not held
    returning * into pb;
  if not found then select * into pb from room_playback where room_id = p_room; end if;
  return pb;
end $$;

-- Called once everyone has caught up. Safe to call from many devices at once.
create function public.resume_playback(p_room uuid)
returns public.room_playback
language plpgsql security definer set search_path = public as $$
declare pb public.room_playback;
begin
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'Join the room first';
  end if;
  update room_playback
    set playing = true, held = false, updated_at = now(), updated_by = auth.uid()
    where room_id = p_room and held
    returning * into pb;
  if not found then select * into pb from room_playback where room_id = p_room; end if;
  return pb;
end $$;

revoke all on function public.hold_playback(uuid, double precision) from public, anon;
revoke all on function public.resume_playback(uuid) from public, anon;
grant execute on function public.hold_playback(uuid, double precision) to authenticated;
grant execute on function public.resume_playback(uuid) to authenticated;
