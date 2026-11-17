-- Rivva phase 8: in-app notifications. Run once in Supabase → SQL Editor
-- (after schema.sql and phase4–phase7.sql).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'room_invite', 'movie_started')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "see your notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "update your notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete your notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
-- people can only mark their own as read, never rewrite the text
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Internal helper: only the database itself (triggers below) can create notifications.
create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Friend requests and acceptances
create function public.on_friendship_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select display_name into nm from profiles where id = new.requester_id;
    perform public.notify(new.addressee_id, 'friend_request', coalesce(nm, 'Someone') || ' sent you a friend request', null, '/settings');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select display_name into nm from profiles where id = new.addressee_id;
    perform public.notify(new.requester_id, 'friend_accepted', coalesce(nm, 'Someone') || ' accepted your friend request', null, '/settings');
  end if;
  return null;
end $$;
create trigger friendship_notify after insert or update on public.friendships
  for each row execute function public.on_friendship_change();

-- Room invites
create function public.on_room_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select display_name into nm from profiles where id = new.inviter_id;
  perform public.notify(new.invitee_id, 'room_invite', coalesce(nm, 'A friend') || ' invited you to ' || new.room_name, null, '/');
  return null;
end $$;
create trigger room_invite_notify after insert or update on public.room_invites
  for each row execute function public.on_room_invite();

-- A movie starts in a room you're in
create function public.on_room_movie() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if old.video_id is null and new.video_id is not null then
    select display_name into nm from profiles where id = new.host_id;
    insert into public.notifications (user_id, kind, title, body, link)
    select m.user_id, 'movie_started', coalesce(nm, 'The host') || ' started ' || coalesce(new.now_playing, 'a movie'), new.name, '/rooms/' || new.id || '/watch'
    from public.room_members m where m.room_id = new.id and m.user_id <> new.host_id;
  end if;
  return null;
end $$;
create trigger room_movie_notify after update of video_id on public.rooms
  for each row execute function public.on_room_movie();

alter publication supabase_realtime add table public.notifications;
