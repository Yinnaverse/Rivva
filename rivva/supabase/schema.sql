-- Rivva schema: profiles, rooms, members, chat. Run once in Supabase → SQL Editor.

-- ───────── Tables ─────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Guest',
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Movie Night',
  description text,
  host_id uuid not null references public.profiles (id) on delete cascade,
  is_private boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'playing')),
  now_playing text,
  capacity int not null default 8 check (capacity between 2 and 50),
  sync_controls boolean not null default true,
  allow_reactions boolean not null default true,
  chat_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index messages_room_created_idx on public.messages (room_id, created_at);

-- ───────── Profile on signup (also fires for anonymous guests) ─────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    )
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── Access helpers (security definer, so policies don't recurse) ─────────
create function public.is_room_member(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_members where room_id = rid and user_id = auth.uid());
$$;

create function public.can_view_room(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rooms r
    where r.id = rid
      and (not r.is_private or r.host_id = auth.uid() or public.is_room_member(r.id))
  );
$$;

-- ───────── Row level security ─────────
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;

create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "view rooms you can access" on public.rooms
  for select to authenticated using (public.can_view_room(id));
create policy "host updates room" on public.rooms
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "host deletes room" on public.rooms
  for delete to authenticated using (host_id = auth.uid());

create policy "view members of visible rooms" on public.room_members
  for select to authenticated using (public.can_view_room(room_id));
create policy "leave a room" on public.room_members
  for delete to authenticated using (user_id = auth.uid());

create policy "members read chat" on public.messages
  for select to authenticated using (public.is_room_member(room_id));
create policy "members send chat" on public.messages
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_room_member(room_id)
    and exists (select 1 from rooms r where r.id = room_id and r.chat_enabled)
  );

-- ───────── Actions the app calls ─────────
create function public.gen_room_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = result);
  end loop;
  return result;
end $$;

create function public.create_room(
  p_name text default 'Movie Night',
  p_description text default 'Lets watch something awesome together',
  p_private boolean default false
) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into rooms (code, name, description, host_id, is_private)
  values (public.gen_room_code(), p_name, p_description, auth.uid(), p_private)
  returning * into r;
  insert into room_members (room_id, user_id) values (r.id, auth.uid());
  return r;
end $$;

create function public.join_room_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'No room with that code'; end if;
  if not exists (select 1 from room_members where room_id = r.id and user_id = auth.uid())
     and (select count(*) from room_members where room_id = r.id) >= r.capacity then
    raise exception 'That room is full';
  end if;
  insert into room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return r.id;
end $$;

create function public.join_room(p_room uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from rooms where id = p_room;
  if not found then raise exception 'Room not found'; end if;
  if r.is_private and r.host_id <> auth.uid() then raise exception 'This room is private. Join with its code.'; end if;
  if not exists (select 1 from room_members where room_id = r.id and user_id = auth.uid())
     and (select count(*) from room_members where room_id = r.id) >= r.capacity then
    raise exception 'That room is full';
  end if;
  insert into room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return r.id;
end $$;

revoke all on function public.create_room(text, text, boolean) from public, anon;
revoke all on function public.join_room_by_code(text) from public, anon;
revoke all on function public.join_room(uuid) from public, anon;
grant execute on function public.create_room(text, text, boolean) to authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.join_room(uuid) to authenticated;

-- ───────── Realtime ─────────
alter table public.room_members replica identity full;
alter publication supabase_realtime add table public.rooms, public.room_members, public.messages;
