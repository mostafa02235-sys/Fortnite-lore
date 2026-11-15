// In-memory stand-in for supabase-js, used by the offline preview (Claude
// Artifact) and by the UI tests. It mimics the queries this app makes and a
// simplified version of the database's Row Level Security rules.
const T = ['teams', 'characters', 'character_images', 'image_archive', 'lore_user_roles', 'group_relationship_types', 'groups',
  'group_relationships', 'group_images', 'seasons', 'season_events', 'season_characters', 'season_groups', 'season_images',
  'season_references', 'event_characters', 'event_groups', 'event_images', 'mysteries', 'lore_dev_sessions', 'lore_profiles', 'lore_countdowns', 'lore_site_settings'];
const db = Object.fromEntries(T.map(t => [t, []]));
const files = new Map();
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
// devCode is a demo code for the offline preview and tests only. The live
// site checks the real code on the server (see the developer_mode migration).
window.__mock = { db, files, user: { id: 'u-dev', email: 'dev@test', created_at: now() }, signedIn: true, devCode: 'PREVIEW', fails: 0 };
const M = window.__mock;
const isDev = () => M.signedIn && db.lore_dev_sessions.some(x => x.user_id === M.user.id && new Date(x.expires_at) > new Date());
const isAdmin = () => isDev() && db.lore_user_roles.some(r => r.user_id === M.user.id && r.role === 'admin');
const find = (t, id) => db[t].find(r => r.id === id);
const pub = (t, id) => !!find(t, id)?.is_published;
const evPub = id => { const e = find('season_events', id); return !!e && pub('seasons', e.season_id); };

const visible = (t, r) => {
  if (!M.signedIn) return false;
  if (isDev()) return true;
  switch (t) {
    case 'characters': case 'image_archive': case 'groups': case 'seasons': case 'mysteries': return r.is_published;
    case 'character_images': return pub('characters', r.character_id);
    case 'lore_user_roles': case 'lore_dev_sessions': case 'lore_profiles': case 'lore_countdowns': return r.user_id === M.user.id;
    case 'group_relationships': return pub('groups', r.group_id) && pub('characters', r.character_id);
    case 'group_images': return pub('groups', r.group_id);
    case 'season_events': case 'season_images': case 'season_references': return pub('seasons', r.season_id);
    case 'season_characters': return pub('seasons', r.season_id) && pub('characters', r.character_id);
    case 'season_groups': return pub('seasons', r.season_id) && pub('groups', r.group_id);
    case 'event_characters': return evPub(r.event_id) && pub('characters', r.character_id);
    case 'event_groups': return evPub(r.event_id) && pub('groups', r.group_id);
    case 'event_images': return evPub(r.event_id) && pub('image_archive', r.image_id);
    default: return true;
  }
};
const vis = (t, rows) => rows.filter(r => visible(t, r)).map(r => ({ ...r }));
const one = (t, id) => { const r = find(t, id); return r && visible(t, r) ? { ...r } : null; };
const charLite = id => { const c = one('characters', id); return c ? { ...c, images: vis('character_images', db.character_images.filter(i => i.character_id === id)) } : null; };
const seasonOf = id => one('seasons', id);
const eventLite = id => { const e = one('season_events', id); return e ? { ...e, season: seasonOf(e.season_id) } : null; };

function embed(t, r, sel) {
  const o = { ...r };
  if (t === 'characters') {
    const tm = db.teams.find(x => x.id === r.team_id); o.team = tm ? { ...tm } : null;
    o.images = vis('character_images', db.character_images.filter(i => i.character_id === r.id));
  }
  if (t === 'teams') o.characters = [{ count: db.characters.filter(c => c.team_id === r.id && visible('characters', c)).length }];
  if (t === 'image_archive') {
    o.character = one('characters', r.character_id); o.season = seasonOf(r.season_id);
    o.events = vis('event_images', db.event_images.filter(x => x.image_id === r.id)).map(x => ({ event: eventLite(x.event_id) }));
  }
  if (t === 'groups') {
    const mem = vis('group_relationships', db.group_relationships.filter(x => x.group_id === r.id));
    o.members = /members:group_relationships\(count\)/.test(sel) ? [{ count: mem.length }]
      : mem.map(m => ({ ...m, type: { ...find('group_relationship_types', m.relationship_type_id) }, character: charLite(m.character_id) }));
    o.images = vis('group_images', db.group_images.filter(x => x.group_id === r.id));
    o.seasons = vis('season_groups', db.season_groups.filter(x => x.group_id === r.id)).map(x => ({ note: x.note, season: seasonOf(x.season_id) }));
    o.events = vis('event_groups', db.event_groups.filter(x => x.group_id === r.id)).map(x => ({ event: eventLite(x.event_id) }));
  }
  if (t === 'group_relationships') {
    o.type = { ...find('group_relationship_types', r.relationship_type_id) };
    o.group = one('groups', r.group_id); o.character = charLite(r.character_id);
  }
  if (t === 'season_characters') { o.season = seasonOf(r.season_id); o.character = charLite(r.character_id); }
  if (t === 'event_characters') o.event = eventLite(r.event_id);
  if (t === 'seasons') {
    o.images = vis('season_images', db.season_images.filter(x => x.season_id === r.id));
    o.refs = vis('season_references', db.season_references.filter(x => x.season_id === r.id));
    o.characters = vis('season_characters', db.season_characters.filter(x => x.season_id === r.id)).map(x => ({ ...x, character: charLite(x.character_id) }));
    o.groups = vis('season_groups', db.season_groups.filter(x => x.season_id === r.id)).map(x => ({ ...x, group: one('groups', x.group_id) }));
    o.mysteries = vis('mysteries', db.mysteries.filter(x => x.season_id === r.id));
    o.events = vis('season_events', db.season_events.filter(x => x.season_id === r.id));
  }
  if (t === 'season_events') {
    o.season = seasonOf(r.season_id);
    o.characters = vis('event_characters', db.event_characters.filter(x => x.event_id === r.id)).map(x => ({ character: charLite(x.character_id) }));
    o.groups = vis('event_groups', db.event_groups.filter(x => x.event_id === r.id)).map(x => ({ group: one('groups', x.group_id) }));
    o.images = vis('event_images', db.event_images.filter(x => x.event_id === r.id)).map(x => ({ image: one('image_archive', x.image_id) }));
  }
  if (t === 'mysteries') o.season = seasonOf(r.season_id);
  return o;
}

const CHECKS = {
  characters: r => r.is_published && !String(r.story || '').trim() && 'characters_publish_requires_story',
  groups: r => r.is_published && !String((r.description || '') + (r.story || '')).trim() && 'groups_publish_requires_text',
  seasons: r => (r.is_published && !String((r.summary || '') + (r.story || '')).trim() && 'seasons_publish_requires_text')
    || (r.end_date && r.release_date && r.end_date < r.release_date && 'seasons_dates_order'),
  mysteries: r => r.is_published && !String(r.body || '').trim() && 'mysteries_publish_requires_body',
};
const UNIQUE = { teams: ['name'], groups: ['name'], group_relationship_types: ['label_en'] };
// Who may write a row (mirrors the RLS policies).
const isTeam = id => { const g = find('groups', id); return !!g && g.is_team && g.is_published; };
const canWrite = (t, r) => {
  if (!M.signedIn) return false;
  if (t === 'lore_profiles') return r.user_id === M.user.id && (!r.team_id || isTeam(r.team_id));
  if (t === 'lore_countdowns') return r.user_id === M.user.id && [r.bg_path, r.poster_path].every(p => !p || p.startsWith(M.user.id + '/'));
  if (t === 'lore_dev_sessions' || t === 'lore_user_roles') return false;
  return isDev();
};
const DEFAULTS = {
  groups: { name_ar: '', tagline: '', tagline_ar: '', is_team: false, team_order: 0 },
  seasons: { show_on_home: true, home_order: 0, home_tagline: '' },
  lore_countdowns: { title: '', bg_type: 'none', bg_path: null, poster_path: null, focal_x: 50, focal_y: 50, zoom: 1, overlay: 0.45 },
};
const PK = { lore_profiles: ['user_id'], lore_countdowns: ['user_id'], lore_site_settings: ['key'], season_characters: ['season_id', 'character_id'], season_groups: ['season_id', 'group_id'],
  event_characters: ['event_id', 'character_id'], event_groups: ['event_id', 'group_id'], event_images: ['event_id', 'image_id'] };
const denied = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };

function cascade(t, r) {
  const drop = (tt, f) => { db[tt] = db[tt].filter(x => !f(x)); };
  if (t === 'characters') {
    ['character_images', 'group_relationships', 'season_characters', 'event_characters'].forEach(tt => drop(tt, x => x.character_id === r.id));
    db.image_archive.forEach(a => { if (a.character_id === r.id) a.character_id = null; });
  }
  if (t === 'teams') db.characters.forEach(c => { if (c.team_id === r.id) c.team_id = null; });
  if (t === 'groups') ['group_relationships', 'group_images', 'season_groups', 'event_groups'].forEach(tt => drop(tt, x => x.group_id === r.id));
  if (t === 'seasons') {
    db.season_events.filter(e => e.season_id === r.id).forEach(e => cascade('season_events', e));
    ['season_events', 'season_characters', 'season_groups', 'season_images', 'season_references'].forEach(tt => drop(tt, x => x.season_id === r.id));
    db.mysteries.forEach(m => { if (m.season_id === r.id) m.season_id = null; });
    db.image_archive.forEach(m => { if (m.season_id === r.id) m.season_id = null; });
  }
  if (t === 'season_events') ['event_characters', 'event_groups', 'event_images'].forEach(tt => drop(tt, x => x.event_id === r.id));
  if (t === 'image_archive') drop('event_images', x => x.image_id === r.id);
}

class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.sel = '*'; this.oneMode = null; this.head = false; this.ord = []; this.lim = null; }
  select(s = '*', o) { this.sel = s; if (o?.head) this.head = true; return this; }
  insert(v) { this.op = 'insert'; this.val = v; return this; }
  upsert(v) { this.op = 'upsert'; this.val = v; return this; }
  update(v) { this.op = 'update'; this.val = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) {
    if (k.includes('.')) { const [rel, col] = k.split('.'); this.f.push(r => r.__e?.[rel]?.[col] === v); }
    else this.f.push(r => r[k] === v);
    return this;
  }
  in(k, v) { this.f.push(r => v.includes(r[k])); return this; }
  ilike(k, v) { const s = v.replace(/\\(.)/g, '$1').replace(/^%|%$/g, '').toLowerCase(); this.f.push(r => String(r[k] || '').toLowerCase().includes(s)); return this; }
  order(k, o) { this.ord.push([k, o?.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.oneMode = 'maybe'; return this; }
  single() { this.oneMode = 'single'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
  stamp(r, prev) {
    if ('is_published' in r && (!prev || r.is_published !== prev.is_published)) r.published_at = r.is_published ? now() : null;
    return r;
  }
  check(r) {
    const c = CHECKS[this.t]?.(r); if (c) return { message: `new row violates check constraint "${c}"` };
    for (const k of UNIQUE[this.t] || []) if (db[this.t].some(x => x !== r && x.id !== r.id && String(x[k]).toLowerCase().trim() === String(r[k]).toLowerCase().trim()))
      return { message: `duplicate key value violates unique constraint "${this.t}_${k}_unique"` };
    return null;
  }
  run() {
    const t = this.t, tab = db[t];
    let rows;
    if (this.op === 'insert' || this.op === 'upsert') {
      rows = [];
      for (const v of [].concat(this.val)) {
        const pk = PK[t];
        const hit = pk && tab.find(x => pk.every(k => x[k] === v[k]));
        if (!canWrite(t, { ...(hit || {}), ...v })) return denied;
        if (hit) { Object.assign(hit, v, { updated_at: now() }); rows.push(hit); continue; }
        const r = this.stamp({ id: uid(), created_at: now(), updated_at: now(), uploaded_at: now(), ...(DEFAULTS[t] || {}), ...v });
        const e = this.check(r); if (e) return { data: null, error: e };
        tab.push(r); rows.push(r);
      }
    } else if (this.op === 'update') {
      rows = tab.filter(r => visible(t, r) && this.f.every(f => f(r)) && canWrite(t, r));
      for (const r of rows) {
        const next = this.stamp({ ...r, ...this.val, updated_at: now() }, r);
        if (!canWrite(t, next)) return denied;
        const e = this.check(next); if (e) return { data: null, error: e };
        Object.assign(r, next);
      }
    } else if (this.op === 'delete') {
      rows = tab.filter(r => visible(t, r) && this.f.every(f => f(r)) && canWrite(t, r));
      if (t === 'group_relationship_types' && rows.some(r => db.group_relationships.some(g => g.relationship_type_id === r.id)))
        return { error: { message: 'update or delete violates foreign key constraint', code: '23503' } };
      for (const r of rows) { tab.splice(tab.indexOf(r), 1); cascade(t, r); }
    } else {
      rows = tab.filter(r => visible(t, r)).map(r => { const e = embed(t, r, this.sel); return { ...r, __e: e }; }).filter(r => this.f.every(f => f(r)));
      rows = rows.map(r => r.__e);
      if (/!inner/.test(this.sel)) rows = rows.filter(r => r.season);
    }
    if (this.head) return { count: rows.length, error: null };
    let data = this.op === 'select' ? rows : rows.map(r => embed(t, r, this.sel));
    for (const [k, asc] of [...this.ord].reverse()) data.sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k] ?? '').localeCompare(String(b[k] ?? ''))) * (asc ? 1 : -1));
    if (this.lim != null) data = data.slice(0, this.lim);
    if (this.oneMode) {
      if (this.oneMode === 'single' && data.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: data[0] || null, error: null };
    }
    return { data, error: null };
  }
}

export function createClient() {
  const listeners = [];
  const session = () => M.signedIn ? { user: M.user } : null;
  return {
    from: t => new Q(t),
    rpc: async (fn, a) => {
      if (fn === 'lore_reorder_events') {
        if (!isDev()) return denied;
        a._ids.forEach((id, i) => { const e = find('season_events', id); if (e && e.season_id === a._season_id) e.position = i; });
        return { data: null, error: null };
      }
      if (fn === 'lore_enter_dev_mode') {
        if (!M.signedIn) return { data: { ok: false, reason: 'signin' }, error: null };
        if (M.fails >= 5) return { data: { ok: false, reason: 'locked', retry_after: 900 }, error: null };
        if (String(a._code || '').trim() !== M.devCode) { M.fails++; return { data: { ok: false, reason: 'invalid', remaining: Math.max(0, 5 - M.fails) }, error: null }; }
        M.fails = 0;
        const expires_at = new Date(Date.now() + 8 * 3600e3).toISOString();
        db.lore_dev_sessions = db.lore_dev_sessions.filter(x => x.user_id !== M.user.id);
        db.lore_dev_sessions.push({ user_id: M.user.id, started_at: now(), expires_at, email: M.user.email });
        return { data: { ok: true, expires_at }, error: null };
      }
      if (fn === 'lore_team_counts') {
        if (!isDev()) return { data: null, error: { message: 'not authorized', code: '42501' } };
        const c = {}; db.lore_profiles.forEach(p => { if (p.team_id) c[p.team_id] = (c[p.team_id] || 0) + 1; });
        return { data: Object.entries(c).map(([team_id, members]) => ({ team_id, members })), error: null };
      }
      if (fn === 'lore_exit_dev_mode') { db.lore_dev_sessions = db.lore_dev_sessions.filter(x => x.user_id !== M.user.id); return { data: null, error: null }; }
      if (!isAdmin()) return { data: null, error: { message: 'not authorized', code: '42501' } };
      if (fn === 'lore_list_dev_sessions') return { data: db.lore_dev_sessions.map(x => ({ ...x })), error: null };
      if (fn === 'lore_end_dev_session') { db.lore_dev_sessions = db.lore_dev_sessions.filter(x => x.user_id !== a._user_id); return { data: null, error: null }; }
      if (fn === 'lore_list_staff') return { data: db.lore_user_roles.map(r => ({ ...r, email: r.email || 'x@test', granted_at: now() })), error: null };
      if (fn === 'lore_grant_role') { db.lore_user_roles.push({ user_id: uid(), role: a._role, email: a._email }); return { data: null, error: null }; }
      if (fn === 'lore_revoke_role') { db.lore_user_roles = db.lore_user_roles.filter(r => !(r.user_id === a._user_id && r.role === a._role)); return { data: null, error: null }; }
      return { data: null, error: { message: 'unknown rpc' } };
    },
    auth: {
      getSession: async () => ({ data: { session: session() } }),
      onAuthStateChange: cb => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async () => { M.signedIn = true; listeners.forEach(l => l('SIGNED_IN', session())); return { error: null }; },
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => { M.signedIn = false; listeners.forEach(l => l('SIGNED_OUT', null)); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
    storage: {
      from: bucket => {
        const own = p => bucket !== 'lore-user-media' || p.startsWith(M.user.id + '/');
        return {
          upload: async (path, file) => {
            const ok = bucket === 'lore-user-media' ? M.signedIn && own(path) : isDev();
            if (!ok) return { error: { message: 'new row violates row-level security policy' } };
            if (M.failUploads) return { error: { message: 'Network error' } };
            files.set(path, URL.createObjectURL(file)); M.uploads = (M.uploads || 0) + 1; return { error: null };
          },
          remove: async paths => { paths.filter(own).forEach(p => files.delete(p)); return { error: null }; },
          createSignedUrls: async paths => ({ data: paths.map(p => ({ path: p, signedUrl: own(p) ? files.get(p) || null : null, error: own(p) && files.has(p) ? null : 'not found' })), error: null }),
        };
      },
    },
  };
}

// Seed: default relationship labels (as the migration does)
[['Member', 'عضو'], ['Leader', 'قائد'], ['Former Member', 'عضو سابق'], ['Enemy', 'عدو'], ['Ally', 'حليف'], ['Unknown', 'غير معروف']]
  .forEach(([en, ar], i) => db.group_relationship_types.push({ id: uid(), label_en: en, label_ar: ar, sort_order: i }));
