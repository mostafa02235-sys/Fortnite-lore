-- Fortnite Lore — Character Archive & Image Archive
-- Safe, additive migration. It does not touch any existing table, function or bucket.
-- Every object is new; names that could collide with other apps sharing this
-- Supabase project are prefixed with "lore_".

-- ─────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.lore_role as enum ('developer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.character_status as enum ('alive', 'dead', 'unknown');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Roles (server-side source of truth for developer access)
--    No insert/update/delete policies exist on this table, so a user can
--    never grant themselves a role from the browser. Roles are changed only
--    by the SECURITY DEFINER functions below (admins only) or by SQL run
--    from the Supabase dashboard.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.lore_user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.lore_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);
alter table public.lore_user_roles enable row level security;

create or replace function public.lore_has_role(_role public.lore_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lore_user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;

-- Developers and admins may manage official content.
create or replace function public.lore_is_developer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lore_user_roles
    where user_id = (select auth.uid()) and role in ('developer', 'admin')
  );
$$;

revoke all on function public.lore_has_role(public.lore_role) from public, anon;
revoke all on function public.lore_is_developer() from public, anon;
grant execute on function public.lore_has_role(public.lore_role) to authenticated;
grant execute on function public.lore_is_developer() to authenticated;

drop policy if exists "read own roles; admins read all" on public.lore_user_roles;
create policy "read own roles; admins read all" on public.lore_user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.lore_has_role('admin'));

-- ─────────────────────────────────────────────────────────────
-- 3. Shared helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.lore_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create or replace function public.lore_stamp_published()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Teams / factions (no hardcoded list — developers create them)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists teams_name_unique on public.teams (lower(btrim(name)));

-- ─────────────────────────────────────────────────────────────
-- 5. Characters
--    story is HTML from the rich-text editor; type text has no length limit.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  story        text not null default '',
  status       public.character_status not null default 'unknown',
  team_id      uuid references public.teams(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A character cannot be published without a story.
  constraint characters_publish_requires_story
    check (not is_published or char_length(btrim(story)) > 0)
);
create index if not exists characters_team_idx on public.characters (team_id);
create index if not exists characters_published_idx on public.characters (is_published, name);

-- ─────────────────────────────────────────────────────────────
-- 6. Character images (image file lives in Storage; this is metadata)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.character_images (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  storage_path text not null unique,
  image_name   text not null default '' check (char_length(image_name) <= 200),
  image_story  text not null default '',
  is_primary   boolean not null default true,
  sort_order   integer not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists character_images_character_idx on public.character_images (character_id);
create unique index if not exists character_images_one_primary
  on public.character_images (character_id) where is_primary;

-- ─────────────────────────────────────────────────────────────
-- 7. Image archive
-- ─────────────────────────────────────────────────────────────
create table if not exists public.image_archive (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  image_name   text not null check (char_length(btrim(image_name)) between 1 and 200),
  story        text not null default '',
  character_id uuid references public.characters(id) on delete set null,
  event_name   text check (event_name is null or char_length(event_name) <= 200),
  chapter      text check (chapter is null or char_length(chapter) <= 100),
  is_published boolean not null default false,
  published_at timestamptz,
  uploaded_at  timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index if not exists image_archive_character_idx on public.image_archive (character_id);
create index if not exists image_archive_published_idx on public.image_archive (is_published, uploaded_at desc);

-- ─────────────────────────────────────────────────────────────
-- 8. Triggers
-- ─────────────────────────────────────────────────────────────
drop trigger if exists teams_touch on public.teams;
create trigger teams_touch before insert or update on public.teams
  for each row execute function public.lore_touch();

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before insert or update on public.characters
  for each row execute function public.lore_touch();
drop trigger if exists characters_publish on public.characters;
create trigger characters_publish before insert or update on public.characters
  for each row execute function public.lore_stamp_published();

drop trigger if exists character_images_touch on public.character_images;
create trigger character_images_touch before insert or update on public.character_images
  for each row execute function public.lore_touch();

-- image_archive has uploaded_at instead of created_at; reuse lore_touch for updated_at/created_by
drop trigger if exists image_archive_touch on public.image_archive;
create trigger image_archive_touch before insert or update on public.image_archive
  for each row execute function public.lore_touch();
drop trigger if exists image_archive_publish on public.image_archive;
create trigger image_archive_publish before insert or update on public.image_archive
  for each row execute function public.lore_stamp_published();

-- ─────────────────────────────────────────────────────────────
-- 9. Row Level Security
--    Readers: signed-in users see published content only.
--    Writers: only verified developers/admins (checked in the database).
-- ─────────────────────────────────────────────────────────────
alter table public.teams            enable row level security;
alter table public.characters       enable row level security;
alter table public.character_images enable row level security;
alter table public.image_archive    enable row level security;

-- teams
drop policy if exists "teams readable" on public.teams;
create policy "teams readable" on public.teams for select to authenticated using (true);
drop policy if exists "teams insert dev" on public.teams;
create policy "teams insert dev" on public.teams for insert to authenticated with check (public.lore_is_developer());
drop policy if exists "teams update dev" on public.teams;
create policy "teams update dev" on public.teams for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer());
drop policy if exists "teams delete dev" on public.teams;
create policy "teams delete dev" on public.teams for delete to authenticated using (public.lore_is_developer());

-- characters
drop policy if exists "characters readable" on public.characters;
create policy "characters readable" on public.characters for select to authenticated
  using (is_published or public.lore_is_developer());
drop policy if exists "characters insert dev" on public.characters;
create policy "characters insert dev" on public.characters for insert to authenticated with check (public.lore_is_developer());
drop policy if exists "characters update dev" on public.characters;
create policy "characters update dev" on public.characters for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer());
drop policy if exists "characters delete dev" on public.characters;
create policy "characters delete dev" on public.characters for delete to authenticated using (public.lore_is_developer());

-- character_images
drop policy if exists "character images readable" on public.character_images;
create policy "character images readable" on public.character_images for select to authenticated
  using (
    public.lore_is_developer()
    or exists (select 1 from public.characters c where c.id = character_id and c.is_published)
  );
drop policy if exists "character images insert dev" on public.character_images;
create policy "character images insert dev" on public.character_images for insert to authenticated with check (public.lore_is_developer());
drop policy if exists "character images update dev" on public.character_images;
create policy "character images update dev" on public.character_images for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer());
drop policy if exists "character images delete dev" on public.character_images;
create policy "character images delete dev" on public.character_images for delete to authenticated using (public.lore_is_developer());

-- image_archive
drop policy if exists "archive readable" on public.image_archive;
create policy "archive readable" on public.image_archive for select to authenticated
  using (is_published or public.lore_is_developer());
drop policy if exists "archive insert dev" on public.image_archive;
create policy "archive insert dev" on public.image_archive for insert to authenticated with check (public.lore_is_developer());
drop policy if exists "archive update dev" on public.image_archive;
create policy "archive update dev" on public.image_archive for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer());
drop policy if exists "archive delete dev" on public.image_archive;
create policy "archive delete dev" on public.image_archive for delete to authenticated using (public.lore_is_developer());

grant select, insert, update, delete on public.teams, public.characters, public.character_images, public.image_archive to authenticated;
grant select on public.lore_user_roles to authenticated;
revoke all on public.teams, public.characters, public.character_images, public.image_archive, public.lore_user_roles from anon;

-- ─────────────────────────────────────────────────────────────
-- 10. Storage — private bucket; files readable only when the record
--     that uses them is published (developers can read everything).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lore-media', 'lore-media', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do nothing;

create or replace function public.lore_can_read_media(_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    public.lore_is_developer()
    -- images placed inside stories by the rich-text editor
    or (_path like 'inline/%')
    or exists (
      select 1 from public.character_images ci
      join public.characters c on c.id = ci.character_id
      where ci.storage_path = _path and c.is_published
    )
    or exists (
      select 1 from public.image_archive ia
      where ia.storage_path = _path and ia.is_published
    );
$$;
revoke all on function public.lore_can_read_media(text) from public, anon;
grant execute on function public.lore_can_read_media(text) to authenticated;

drop policy if exists "lore media read" on storage.objects;
create policy "lore media read" on storage.objects for select to authenticated
  using (bucket_id = 'lore-media' and public.lore_can_read_media(name));
drop policy if exists "lore media insert dev" on storage.objects;
create policy "lore media insert dev" on storage.objects for insert to authenticated
  with check (bucket_id = 'lore-media' and public.lore_is_developer());
drop policy if exists "lore media update dev" on storage.objects;
create policy "lore media update dev" on storage.objects for update to authenticated
  using (bucket_id = 'lore-media' and public.lore_is_developer())
  with check (bucket_id = 'lore-media' and public.lore_is_developer());
drop policy if exists "lore media delete dev" on storage.objects;
create policy "lore media delete dev" on storage.objects for delete to authenticated
  using (bucket_id = 'lore-media' and public.lore_is_developer());

-- ─────────────────────────────────────────────────────────────
-- 11. Admin-only access management (server-side authorization)
-- ─────────────────────────────────────────────────────────────
create or replace function public.lore_list_staff()
returns table (user_id uuid, email text, role public.lore_role, granted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lore_has_role('admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select r.user_id, u.email::text, r.role, r.granted_at
    from public.lore_user_roles r join auth.users u on u.id = r.user_id
    order by r.granted_at;
end $$;

create or replace function public.lore_grant_role(_email text, _role public.lore_role)
returns void language plpgsql security definer set search_path = '' as $$
declare _uid uuid;
begin
  if not public.lore_has_role('admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into _uid from auth.users where lower(email) = lower(btrim(_email));
  if _uid is null then
    raise exception 'no account with that email — ask them to sign up first' using errcode = 'P0002';
  end if;
  insert into public.lore_user_roles (user_id, role, granted_by)
  values (_uid, _role, auth.uid())
  on conflict (user_id, role) do nothing;
end $$;

create or replace function public.lore_revoke_role(_user_id uuid, _role public.lore_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.lore_has_role('admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _user_id = auth.uid() and _role = 'admin' then
    raise exception 'you cannot remove your own admin role' using errcode = '42501';
  end if;
  delete from public.lore_user_roles where user_id = _user_id and role = _role;
end $$;

revoke all on function public.lore_list_staff() from public, anon;
revoke all on function public.lore_grant_role(text, public.lore_role) from public, anon;
revoke all on function public.lore_revoke_role(uuid, public.lore_role) from public, anon;
grant execute on function public.lore_list_staff() to authenticated;
grant execute on function public.lore_grant_role(text, public.lore_role) to authenticated;
grant execute on function public.lore_revoke_role(uuid, public.lore_role) to authenticated;
