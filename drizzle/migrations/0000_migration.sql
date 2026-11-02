
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Spelare',
  avatar text not null default '🎲',
  country text not null default 'SE',
  friend_code text not null unique default upper(substr(md5(random()::text),1,6)),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.player_stats (
  user_id uuid primary key,
  played int not null default 0,
  wins int not null default 0,
  captures int not null default 0,
  pieces_home int not null default 0,
  forfeits int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.player_stats to authenticated;
grant all on public.player_stats to service_role;
alter table public.player_stats enable row level security;
create policy "stats readable" on public.player_stats for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,'Spelare'),'@',1)), 20),
    '🎲');
  insert into public.player_stats (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting','playing','finished','abandoned')),
  is_private boolean not null default false,
  max_players int not null default 4 check (max_players between 2 and 4),
  host_id uuid not null,
  state jsonb,
  version int not null default 0,
  verified boolean not null default false,
  turn_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.matches (status, is_private);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  seat int not null,
  color int not null,
  display_name text not null,
  avatar text not null default '🎲',
  country text not null default 'SE',
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  left_at timestamptz,
  primary key (match_id, user_id),
  unique (match_id, seat)
);

create or replace function public.is_match_member(_match uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.match_players where match_id = _match and user_id = _user) $$;

grant select on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "members read match" on public.matches for select to authenticated using (public.is_match_member(id, auth.uid()));

grant select on public.match_players to authenticated;
grant all on public.match_players to service_role;
alter table public.match_players enable row level security;
create policy "members read seats" on public.match_players for select to authenticated using (public.is_match_member(match_id, auth.uid()));

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null,
  addressee uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
grant select on public.friendships to authenticated;
grant all on public.friendships to service_role;
alter table public.friendships enable row level security;
create policy "own friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));

create table public.match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  from_user uuid not null,
  to_user uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
grant select on public.match_invites to authenticated;
grant all on public.match_invites to service_role;
alter table public.match_invites enable row level security;
create policy "own invites" on public.match_invites for select to authenticated using (auth.uid() in (from_user, to_user));

create table public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  device_id text,
  platform text,
  kind text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on public.app_events (kind, created_at);
grant all on public.app_events to service_role;
alter table public.app_events enable row level security;

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_players;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.match_invites;
