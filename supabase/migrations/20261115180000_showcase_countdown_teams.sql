-- Fortnite Lore — Homepage seasons showcase, personal countdown, team selection
-- Additive and idempotent. Requires the earlier lore migrations.

-- ─────────────────────────────────────────────────────────────
-- 1. Seasons showcase (homepage carousel)
-- ─────────────────────────────────────────────────────────────
alter table public.seasons add column if not exists show_on_home boolean not null default true;
alter table public.seasons add column if not exists home_order integer not null default 0;
alter table public.seasons add column if not exists home_tagline text not null default ''
  check (char_length(home_tagline) <= 300);
create index if not exists seasons_home_idx on public.seasons (show_on_home, home_order);

-- ─────────────────────────────────────────────────────────────
-- 2. Teams = groups that users can pick during onboarding
-- ─────────────────────────────────────────────────────────────
alter table public.groups add column if not exists name_ar text not null default '' check (char_length(name_ar) <= 200);
alter table public.groups add column if not exists tagline text not null default '' check (char_length(tagline) <= 300);
alter table public.groups add column if not exists tagline_ar text not null default '' check (char_length(tagline_ar) <= 300);
alter table public.groups add column if not exists is_team boolean not null default false;
alter table public.groups add column if not exists team_order integer not null default 0;
create index if not exists groups_team_idx on public.groups (is_team, team_order);

-- The three starting teams. Existing groups with the same name are reused
-- (marked as teams), never duplicated.
update public.groups g set is_team = true,
  name_ar = coalesce(nullif(g.name_ar, ''), v.ar),
  tagline = coalesce(nullif(g.tagline, ''), v.tag),
  tagline_ar = coalesce(nullif(g.tagline_ar, ''), v.tag_ar),
  team_order = v.o
from (values
  ('the seven', 'السبعة', 'Heroes working to free the Island from the Loop.', 'أبطال يعملون لتحرير الجزيرة من الحلقة.', 0),
  ('imagined order', 'الايماجند أوردر', 'A secretive order that wants to control the Zero Point.', 'منظمة سرية تسعى للسيطرة على النقطة الصفرية.', 1),
  ('the imagined order', 'الايماجند أوردر', 'A secretive order that wants to control the Zero Point.', 'منظمة سرية تسعى للسيطرة على النقطة الصفرية.', 1),
  ('the last reality', 'الواقع الأخير', 'An alien force that came to absorb the Island''s reality.', 'قوة فضائية جاءت لابتلاع واقع الجزيرة.', 2)
) as v(name, ar, tag, tag_ar, o)
where lower(btrim(g.name)) = v.name;

insert into public.groups (name, name_ar, tagline, tagline_ar, description, is_team, team_order, is_published)
select v.name, v.ar, v.tag, v.tag_ar, '<p>' || v.tag || '</p>', true, v.o, true
from (values
  ('The Seven', 'السبعة', 'Heroes working to free the Island from the Loop.', 'أبطال يعملون لتحرير الجزيرة من الحلقة.', 0, array['the seven']),
  ('Imagined Order', 'الايماجند أوردر', 'A secretive order that wants to control the Zero Point.', 'منظمة سرية تسعى للسيطرة على النقطة الصفرية.', 1, array['imagined order', 'the imagined order']),
  ('The Last Reality', 'الواقع الأخير', 'An alien force that came to absorb the Island''s reality.', 'قوة فضائية جاءت لابتلاع واقع الجزيرة.', 2, array['the last reality'])
) as v(name, ar, tag, tag_ar, o, aliases)
where not exists (select 1 from public.groups g where lower(btrim(g.name)) = any (v.aliases));

-- ─────────────────────────────────────────────────────────────
-- 3. Per-user profile: chosen team (one row per account)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.lore_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  team_id        uuid references public.groups(id) on delete set null,
  team_chosen_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists lore_profiles_team_idx on public.lore_profiles (team_id);

create or replace function public.lore_is_team(_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.groups where id = _id and is_team and is_published) $$;
revoke all on function public.lore_is_team(uuid) from public, anon;
grant execute on function public.lore_is_team(uuid) to authenticated;

create or replace function public.lore_profile_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.team_id is distinct from (case when tg_op = 'UPDATE' then old.team_id end) then
    new.team_chosen_at := case when new.team_id is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists lore_profiles_touch on public.lore_profiles;
create trigger lore_profiles_touch before insert or update on public.lore_profiles
  for each row execute function public.lore_profile_touch();

alter table public.lore_profiles enable row level security;
revoke all on public.lore_profiles from anon;
grant select, insert, update on public.lore_profiles to authenticated;
drop policy if exists "own profile read" on public.lore_profiles;
create policy "own profile read" on public.lore_profiles for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "own profile insert" on public.lore_profiles;
create policy "own profile insert" on public.lore_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (team_id is null or public.lore_is_team(team_id)));
drop policy if exists "own profile update" on public.lore_profiles;
create policy "own profile update" on public.lore_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (team_id is null or public.lore_is_team(team_id)));

-- Team sizes for developers (counts only, no user details).
create or replace function public.lore_team_counts()
returns table (team_id uuid, members bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lore_is_developer() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query select p.team_id, count(*) from public.lore_profiles p where p.team_id is not null group by p.team_id;
end $$;
revoke all on function public.lore_team_counts() from public, anon;
grant execute on function public.lore_team_counts() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Personal countdowns (private to each user)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.lore_countdowns (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 120),
  target_at   timestamptz,
  bg_type     text not null default 'none' check (bg_type in ('none', 'image', 'video')),
  bg_path     text,
  poster_path text,
  focal_x     real not null default 50 check (focal_x between 0 and 100),
  focal_y     real not null default 50 check (focal_y between 0 and 100),
  zoom        real not null default 1 check (zoom between 1 and 3),
  overlay     real not null default 0.45 check (overlay between 0 and 0.9),
  updated_at  timestamptz not null default now(),
  -- background files must live in the owner's own folder
  constraint countdown_paths_owned check (
    (bg_path is null or bg_path like user_id::text || '/%') and
    (poster_path is null or poster_path like user_id::text || '/%'))
);
alter table public.lore_countdowns enable row level security;
revoke all on public.lore_countdowns from anon;
grant select, insert, update, delete on public.lore_countdowns to authenticated;
drop policy if exists "own countdown" on public.lore_countdowns;
create policy "own countdown" on public.lore_countdowns for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Site-wide settings (default countdown): everyone signed in reads, developers write.
create table if not exists public.lore_site_settings (
  key        text primary key check (key ~ '^[a-z_]{1,40}$'),
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.lore_site_settings enable row level security;
revoke all on public.lore_site_settings from anon;
grant select, insert, update, delete on public.lore_site_settings to authenticated;
drop policy if exists "read settings" on public.lore_site_settings;
create policy "read settings" on public.lore_site_settings for select to authenticated using (true);
drop policy if exists "dev insert" on public.lore_site_settings;
create policy "dev insert" on public.lore_site_settings for insert to authenticated with check (public.lore_is_developer());
drop policy if exists "dev update" on public.lore_site_settings;
create policy "dev update" on public.lore_site_settings for update to authenticated using (public.lore_is_developer()) with check (public.lore_is_developer());
drop policy if exists "dev delete" on public.lore_site_settings;
create policy "dev delete" on public.lore_site_settings for delete to authenticated using (public.lore_is_developer());

-- ─────────────────────────────────────────────────────────────
-- 5. Private storage for each user's countdown media: <user_id>/<file>
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lore-user-media', 'lore-user-media', false, 31457280,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists "user media own read" on storage.objects;
create policy "user media own read" on storage.objects for select to authenticated
  using (bucket_id = 'lore-user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "user media own insert" on storage.objects;
create policy "user media own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lore-user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "user media own update" on storage.objects;
create policy "user media own update" on storage.objects for update to authenticated
  using (bucket_id = 'lore-user-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'lore-user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "user media own delete" on storage.objects;
create policy "user media own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lore-user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
