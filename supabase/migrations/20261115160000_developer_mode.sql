-- Fortnite Lore — Developer Mode (access code checked on the server)
--
-- * The access code is stored ONLY as a bcrypt hash in the private schema
--   `lore_private`, which the API does not expose. It is never in the repo
--   or the frontend. Set or rotate it with the SQL in README ("Developer
--   access code").
-- * Entering the correct code opens a time-limited Developer Mode session
--   (8 hours) for that signed-in account. It is never a permanent role.
-- * Wrong codes are rate-limited: 5 failures per 15 minutes per account.
-- * public.lore_is_developer() now means "has an active Developer Mode
--   session". Every RLS policy and storage policy already uses it, so all
--   developer operations require an active session.
-- Additive: no existing table or data is removed.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists lore_private;
revoke all on schema lore_private from public, anon, authenticated;

create table if not exists lore_private.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

create table if not exists lore_private.dev_attempts (
  id      bigserial primary key,
  user_id uuid not null,
  ok      boolean not null,
  at      timestamptz not null default now()
);
create index if not exists dev_attempts_user_at_idx on lore_private.dev_attempts (user_id, at desc);

-- One row per account; active while expires_at is in the future.
create table if not exists public.lore_dev_sessions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.lore_dev_sessions enable row level security;
revoke all on public.lore_dev_sessions from anon, authenticated;
grant select on public.lore_dev_sessions to authenticated;
drop policy if exists "read own session" on public.lore_dev_sessions;
create policy "read own session" on public.lore_dev_sessions for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies: sessions change only through the functions below.

-- Developer = active Developer Mode session (replaces the role-only check).
create or replace function public.lore_is_developer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lore_dev_sessions
    where user_id = (select auth.uid()) and expires_at > now()
  );
$$;

create or replace function public.lore_enter_dev_mode(_code text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  _uid   uuid := auth.uid();
  _hash  text;
  _fails int;
  _first timestamptz;
  _ok    boolean;
  _until timestamptz := now() + interval '8 hours';
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signin');
  end if;

  delete from lore_private.dev_attempts where at < now() - interval '1 day';

  select count(*), min(at) into _fails, _first
    from lore_private.dev_attempts
   where user_id = _uid and not ok and at > now() - interval '15 minutes';
  if _fails >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'locked',
      'retry_after', ceil(extract(epoch from (_first + interval '15 minutes' - now())))::int);
  end if;

  select value into _hash from lore_private.settings where key = 'dev_code_hash';
  if _hash is null then
    return jsonb_build_object('ok', false, 'reason', 'not_configured');
  end if;

  _ok := extensions.crypt(btrim(coalesce(_code, '')), _hash) = _hash;
  insert into lore_private.dev_attempts (user_id, ok) values (_uid, _ok);

  if not _ok then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'remaining', greatest(0, 4 - _fails));
  end if;

  insert into public.lore_dev_sessions (user_id, started_at, expires_at)
  values (_uid, now(), _until)
  on conflict (user_id) do update set started_at = excluded.started_at, expires_at = excluded.expires_at;
  return jsonb_build_object('ok', true, 'expires_at', _until);
end $$;

create or replace function public.lore_exit_dev_mode()
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.lore_dev_sessions where user_id = (select auth.uid());
$$;

revoke all on function public.lore_enter_dev_mode(text) from public, anon;
revoke all on function public.lore_exit_dev_mode() from public, anon;
grant execute on function public.lore_enter_dev_mode(text) to authenticated;
grant execute on function public.lore_exit_dev_mode() to authenticated;

-- Admin tools now also require Developer Mode.
create or replace function public.lore_list_staff()
returns table (user_id uuid, email text, role public.lore_role, granted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.lore_has_role('admin') and public.lore_is_developer()) then
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
  if not (public.lore_has_role('admin') and public.lore_is_developer()) then
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
  if not (public.lore_has_role('admin') and public.lore_is_developer()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if _user_id = auth.uid() and _role = 'admin' then
    raise exception 'you cannot remove your own admin role' using errcode = '42501';
  end if;
  delete from public.lore_user_roles where user_id = _user_id and role = _role;
  -- Revoking access also ends that person's Developer Mode session.
  delete from public.lore_dev_sessions where user_id = _user_id;
end $$;

-- Admins can see and end active Developer Mode sessions.
create or replace function public.lore_list_dev_sessions()
returns table (user_id uuid, email text, started_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.lore_has_role('admin') and public.lore_is_developer()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select s.user_id, u.email::text, s.started_at, s.expires_at
    from public.lore_dev_sessions s join auth.users u on u.id = s.user_id
    where s.expires_at > now() order by s.started_at desc;
end $$;

create or replace function public.lore_end_dev_session(_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.lore_has_role('admin') and public.lore_is_developer()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.lore_dev_sessions where user_id = _user_id;
end $$;

revoke all on function public.lore_list_dev_sessions() from public, anon;
revoke all on function public.lore_end_dev_session(uuid) from public, anon;
grant execute on function public.lore_list_dev_sessions() to authenticated;
grant execute on function public.lore_end_dev_session(uuid) to authenticated;
