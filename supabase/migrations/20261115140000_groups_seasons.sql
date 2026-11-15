-- Fortnite Lore — Groups/Factions, Seasons Archive, Timeline, Mysteries
-- Additive and idempotent. Existing tables and data are preserved:
--   * `teams` and `characters.team_id` stay in place (deprecated, read-only in the UI);
--     their data is copied into `groups` / `group_relationships`.

-- ─────────────────────────────────────────────────────────────
-- 1. Configurable relationship labels (Member, Leader, …)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.group_relationship_types (
  id         uuid primary key default gen_random_uuid(),
  label_en   text not null check (char_length(btrim(label_en)) between 1 and 60),
  label_ar   text not null default '' check (char_length(label_ar) <= 60),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists group_relationship_types_label_unique
  on public.group_relationship_types (lower(btrim(label_en)));

insert into public.group_relationship_types (label_en, label_ar, sort_order)
select v.en, v.ar, v.o from (values
  ('Member', 'عضو', 0), ('Leader', 'قائد', 1), ('Former Member', 'عضو سابق', 2),
  ('Enemy', 'عدو', 3), ('Ally', 'حليف', 4), ('Unknown', 'غير معروف', 5)
) as v(en, ar, o)
where not exists (select 1 from public.group_relationship_types t where lower(t.label_en) = lower(v.en));

-- ─────────────────────────────────────────────────────────────
-- 2. Groups / Factions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  status       text check (status is null or char_length(status) <= 60),
  logo_path    text,
  description  text not null default '',
  story        text not null default '',
  history      text not null default '',
  goals        text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint groups_publish_requires_text
    check (not is_published or char_length(btrim(description || story)) > 0)
);
create unique index if not exists groups_name_unique on public.groups (lower(btrim(name)));
create index if not exists groups_published_idx on public.groups (is_published, name);

-- Many-to-many: a character may belong to several groups, with a label each.
create table if not exists public.group_relationships (
  id                   uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.groups(id) on delete cascade,
  character_id         uuid not null references public.characters(id) on delete cascade,
  relationship_type_id uuid not null references public.group_relationship_types(id) on delete restrict,
  note                 text not null default '' check (char_length(note) <= 500),
  sort_order           integer not null default 0,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (group_id, character_id, relationship_type_id)
);
create index if not exists group_relationships_character_idx on public.group_relationships (character_id);
create index if not exists group_relationships_group_idx on public.group_relationships (group_id, sort_order);
create index if not exists group_relationships_type_idx on public.group_relationships (relationship_type_id);

create table if not exists public.group_images (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  storage_path text not null unique,
  image_name   text not null default '' check (char_length(image_name) <= 200),
  image_story  text not null default '',
  sort_order   integer not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists group_images_group_idx on public.group_images (group_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 3. Seasons
-- ─────────────────────────────────────────────────────────────
create table if not exists public.seasons (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 200),
  chapter_number integer check (chapter_number is null or chapter_number >= 0),
  season_number  integer check (season_number is null or season_number >= 0),
  cover_path     text,
  release_date   date,
  end_date       date,
  summary        text not null default '',
  story          text not null default '',
  discoveries    text not null default '',
  missions       text not null default '',
  is_published   boolean not null default false,
  published_at   timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint seasons_dates_order check (end_date is null or release_date is null or end_date >= release_date),
  constraint seasons_publish_requires_text
    check (not is_published or char_length(btrim(summary || story)) > 0)
);
create index if not exists seasons_order_idx on public.seasons (chapter_number, season_number, release_date);
create index if not exists seasons_published_idx on public.seasons (is_published);

create table if not exists public.season_events (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  image_path  text,
  body        text not null default '',
  event_date  date,
  position    integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists season_events_order_idx on public.season_events (season_id, position);

create table if not exists public.season_characters (
  season_id    uuid not null references public.seasons(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  note         text not null default '' check (char_length(note) <= 500),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  primary key (season_id, character_id)
);
create index if not exists season_characters_character_idx on public.season_characters (character_id);

create table if not exists public.season_groups (
  season_id  uuid not null references public.seasons(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (season_id, group_id)
);
create index if not exists season_groups_group_idx on public.season_groups (group_id);

create table if not exists public.season_images (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons(id) on delete cascade,
  storage_path text not null unique,
  image_name   text not null default '' check (char_length(image_name) <= 200),
  image_story  text not null default '',
  sort_order   integer not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists season_images_season_idx on public.season_images (season_id, sort_order);

create table if not exists public.season_references (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 300),
  url        text check (url is null or url ~* '^https?://'),
  note       text not null default '' check (char_length(note) <= 1000),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists season_references_season_idx on public.season_references (season_id, sort_order);

-- Event links
create table if not exists public.event_characters (
  event_id     uuid not null references public.season_events(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  primary key (event_id, character_id)
);
create index if not exists event_characters_character_idx on public.event_characters (character_id);

create table if not exists public.event_groups (
  event_id uuid not null references public.season_events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (event_id, group_id)
);
create index if not exists event_groups_group_idx on public.event_groups (group_id);

create table if not exists public.event_images (
  event_id uuid not null references public.season_events(id) on delete cascade,
  image_id uuid not null references public.image_archive(id) on delete cascade,
  primary key (event_id, image_id)
);
create index if not exists event_images_image_idx on public.event_images (image_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Mysteries
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mysteries (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  body         text not null default '',
  status       text not null default 'open' check (status in ('open', 'partial', 'solved')),
  season_id    uuid references public.seasons(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint mysteries_publish_requires_body check (not is_published or char_length(btrim(body)) > 0)
);
create index if not exists mysteries_season_idx on public.mysteries (season_id);

-- Image archive ↔ season (optional)
alter table public.image_archive add column if not exists season_id uuid references public.seasons(id) on delete set null;
create index if not exists image_archive_season_idx on public.image_archive (season_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Triggers
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['group_relationship_types','groups','group_relationships','group_images',
    'seasons','season_events','season_images','season_references','mysteries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.lore_touch()', t || '_touch', t);
  end loop;
  foreach t in array array['groups','seasons','mysteries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_publish', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.lore_stamp_published()', t || '_publish', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. Row Level Security
--    Read: signed-in users see published content (links only when both
--    ends are published); developers see everything.
--    Write: developers/admins only (checked in the database).
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['group_relationship_types','groups','group_relationships','group_images',
    'seasons','season_events','season_characters','season_groups','season_images','season_references',
    'event_characters','event_groups','event_images','mysteries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dev insert" on public.%I', t);
    execute format('create policy "dev insert" on public.%I for insert to authenticated with check (public.lore_is_developer())', t);
    execute format('drop policy if exists "dev update" on public.%I', t);
    execute format('create policy "dev update" on public.%I for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer())', t);
    execute format('drop policy if exists "dev delete" on public.%I', t);
    execute format('create policy "dev delete" on public.%I for delete to authenticated using (public.lore_is_developer())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Security-definer helpers: is the parent published? (avoid nested RLS cost)
create or replace function public.lore_group_published(_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_published from public.groups where id = _id), false) $$;
create or replace function public.lore_season_published(_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_published from public.seasons where id = _id), false) $$;
create or replace function public.lore_character_published(_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_published from public.characters where id = _id), false) $$;
create or replace function public.lore_event_published(_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.is_published from public.season_events e join public.seasons s on s.id = e.season_id where e.id = _id), false) $$;
do $$
declare f text;
begin
  foreach f in array array['lore_group_published(uuid)','lore_season_published(uuid)','lore_character_published(uuid)','lore_event_published(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

drop policy if exists "read" on public.group_relationship_types;
create policy "read" on public.group_relationship_types for select to authenticated using (true);

drop policy if exists "read" on public.groups;
create policy "read" on public.groups for select to authenticated using (is_published or public.lore_is_developer());

drop policy if exists "read" on public.group_relationships;
create policy "read" on public.group_relationships for select to authenticated using (
  public.lore_is_developer() or (public.lore_group_published(group_id) and public.lore_character_published(character_id)));

drop policy if exists "read" on public.group_images;
create policy "read" on public.group_images for select to authenticated using (
  public.lore_is_developer() or public.lore_group_published(group_id));

drop policy if exists "read" on public.seasons;
create policy "read" on public.seasons for select to authenticated using (is_published or public.lore_is_developer());

drop policy if exists "read" on public.season_events;
create policy "read" on public.season_events for select to authenticated using (
  public.lore_is_developer() or public.lore_season_published(season_id));

drop policy if exists "read" on public.season_images;
create policy "read" on public.season_images for select to authenticated using (
  public.lore_is_developer() or public.lore_season_published(season_id));

drop policy if exists "read" on public.season_references;
create policy "read" on public.season_references for select to authenticated using (
  public.lore_is_developer() or public.lore_season_published(season_id));

drop policy if exists "read" on public.season_characters;
create policy "read" on public.season_characters for select to authenticated using (
  public.lore_is_developer() or (public.lore_season_published(season_id) and public.lore_character_published(character_id)));

drop policy if exists "read" on public.season_groups;
create policy "read" on public.season_groups for select to authenticated using (
  public.lore_is_developer() or (public.lore_season_published(season_id) and public.lore_group_published(group_id)));

drop policy if exists "read" on public.event_characters;
create policy "read" on public.event_characters for select to authenticated using (
  public.lore_is_developer() or (public.lore_event_published(event_id) and public.lore_character_published(character_id)));

drop policy if exists "read" on public.event_groups;
create policy "read" on public.event_groups for select to authenticated using (
  public.lore_is_developer() or (public.lore_event_published(event_id) and public.lore_group_published(group_id)));

drop policy if exists "read" on public.event_images;
create policy "read" on public.event_images for select to authenticated using (
  public.lore_is_developer() or (public.lore_event_published(event_id)
    and exists (select 1 from public.image_archive ia where ia.id = image_id and ia.is_published)));

drop policy if exists "read" on public.mysteries;
create policy "read" on public.mysteries for select to authenticated using (is_published or public.lore_is_developer());

-- ─────────────────────────────────────────────────────────────
-- 7. Reorder timeline events in one transaction (RLS still applies)
-- ─────────────────────────────────────────────────────────────
create or replace function public.lore_reorder_events(_season_id uuid, _ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.lore_is_developer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.season_events e
     set position = o.ord - 1
    from unnest(_ids) with ordinality as o(id, ord)
   where e.id = o.id and e.season_id = _season_id;
end $$;
revoke all on function public.lore_reorder_events(uuid, uuid[]) from public, anon;
grant execute on function public.lore_reorder_events(uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. Storage: files of published groups/seasons/events become readable
-- ─────────────────────────────────────────────────────────────
create or replace function public.lore_can_read_media(_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    public.lore_is_developer()
    or (_path like 'inline/%')
    or exists (select 1 from public.character_images ci join public.characters c on c.id = ci.character_id
               where ci.storage_path = _path and c.is_published)
    or exists (select 1 from public.image_archive ia where ia.storage_path = _path and ia.is_published)
    or exists (select 1 from public.groups g where g.logo_path = _path and g.is_published)
    or exists (select 1 from public.group_images gi join public.groups g on g.id = gi.group_id
               where gi.storage_path = _path and g.is_published)
    or exists (select 1 from public.seasons s where s.cover_path = _path and s.is_published)
    or exists (select 1 from public.season_images si join public.seasons s on s.id = si.season_id
               where si.storage_path = _path and s.is_published)
    or exists (select 1 from public.season_events e join public.seasons s on s.id = e.season_id
               where e.image_path = _path and s.is_published);
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. Carry existing teams over to groups (ids kept, so old links still resolve)
-- ─────────────────────────────────────────────────────────────
insert into public.groups (id, name, description, is_published, created_by, created_at, updated_at)
select t.id, t.name,
       case when btrim(t.description) = '' then ''
            else '<p>' || replace(replace(replace(replace(t.description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>') || '</p>' end,
       btrim(t.description) <> '',
       t.created_by, t.created_at, t.updated_at
from public.teams t
where not exists (select 1 from public.groups g where g.id = t.id or lower(btrim(g.name)) = lower(btrim(t.name)));

insert into public.group_relationships (group_id, character_id, relationship_type_id)
select c.team_id, c.id, (select id from public.group_relationship_types where lower(label_en) = 'member' limit 1)
from public.characters c
join public.groups g on g.id = c.team_id
where c.team_id is not null
on conflict do nothing;

comment on table public.teams is 'Deprecated: superseded by public.groups (data copied by migration 20261115140000). Kept for data preservation.';
comment on column public.characters.team_id is 'Deprecated: use public.group_relationships.';
