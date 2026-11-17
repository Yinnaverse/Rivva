-- Rivva phase 7: usernames, friends, room invites. Run once in Supabase → SQL Editor
-- (after schema.sql, phase4.sql, phase5.sql and phase6.sql).

-- ───────── Usernames ─────────
alter table public.profiles add column username text;
alter table public.profiles add constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index profiles_username_key on public.profiles (username) where username is not null;

-- Guests (anonymous accounts) can't use friends: their account only lives on one device.
create function public.assert_registered() returns void
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign up for an account to use friends';
  end if;
end $$;

-- ───────── Friendships ─────────
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;
create policy "see your friendships" on public.friendships
  for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "remove a friend or cancel a request" on public.friendships
  for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

create function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare target uuid; existing public.friendships;
begin
  perform public.assert_registered();
  select id into target from profiles where username = lower(trim(p_username));
  if target is null then raise exception 'No one has that username'; end if;
  if target = auth.uid() then raise exception 'That''s you'; end if;

  select * into existing from friendships
    where (requester_id = auth.uid() and addressee_id = target) or (requester_id = target and addressee_id = auth.uid());
  if found then
    if existing.status = 'accepted' then raise exception 'You''re already friends'; end if;
    if existing.requester_id = auth.uid() then raise exception 'You already sent a request'; end if;
    update friendships set status = 'accepted' where id = existing.id; -- they had asked you first
    return 'accepted';
  end if;

  insert into friendships (requester_id, addressee_id) values (auth.uid(), target);
  return 'sent';
end $$;

create function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_registered();
  if p_accept then
    update friendships set status = 'accepted' where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friendships where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'That request is no longer available'; end if;
end $$;

-- ───────── Room invites ─────────
create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  room_name text not null,
  created_at timestamptz not null default now(),
  unique (room_id, invitee_id)
);

alter table public.room_invites enable row level security;
create policy "see invites you sent or got" on public.room_invites
  for select to authenticated using (invitee_id = auth.uid() or inviter_id = auth.uid());
create policy "dismiss or withdraw an invite" on public.room_invites
  for delete to authenticated using (invitee_id = auth.uid() or inviter_id = auth.uid());

create function public.invite_friend(p_room uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  perform public.assert_registered();
  if not exists (select 1 from room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'Join the room first';
  end if;
  if not exists (
    select 1 from friendships where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = p_friend) or (requester_id = p_friend and addressee_id = auth.uid()))
  ) then raise exception 'You can only invite friends'; end if;

  select * into r from rooms where id = p_room;
  insert into room_invites (room_id, inviter_id, invitee_id, room_name)
  values (p_room, auth.uid(), p_friend, r.name)
  on conflict (room_id, invitee_id) do update
    set inviter_id = auth.uid(), room_name = excluded.room_name, created_at = now();
end $$;

create function public.accept_invite(p_invite uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.room_invites; r public.rooms;
begin
  select * into i from room_invites where id = p_invite and invitee_id = auth.uid();
  if not found then raise exception 'That invite is no longer available'; end if;
  select * into r from rooms where id = i.room_id;
  if not exists (select 1 from room_members where room_id = r.id and user_id = auth.uid())
     and (select count(*) from room_members where room_id = r.id) >= r.capacity then
    raise exception 'That room is full';
  end if;
  insert into room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  delete from room_invites where id = p_invite;
  return r.id;
end $$;

revoke all on function public.assert_registered() from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.invite_friend(uuid, uuid) from public, anon;
revoke all on function public.accept_invite(uuid) from public, anon;
grant execute on function public.assert_registered() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.invite_friend(uuid, uuid) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ───────── Realtime ─────────
alter publication supabase_realtime add table public.friendships, public.room_invites;
