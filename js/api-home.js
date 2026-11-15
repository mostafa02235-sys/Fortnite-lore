// Data for the homepage showcase, team selection and countdowns.
import { sb } from './supabase.js';
import { seasonCmp } from './api-lore.js';
import { removeFiles, USER_BUCKET } from './media.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

// ─── Seasons showcase ─────────────────────────────────────────────────
const showcaseSort = (a, b) => (a.home_order - b.home_order) || seasonCmp(a, b);

/** Published seasons enabled for the homepage, with cover artwork, in showcase order. */
export async function showcaseSeasons() {
  const rows = ok(await sb.from('seasons')
    .select('id,name,chapter_number,season_number,cover_path,summary,home_tagline,home_order,show_on_home,release_date,is_published')
    .eq('is_published', true).eq('show_on_home', true));
  return rows.filter(s => s.cover_path).sort(showcaseSort);
}
/** All seasons for the developer showcase manager. */
export async function allShowcaseSeasons() {
  const rows = ok(await sb.from('seasons')
    .select('id,name,chapter_number,season_number,cover_path,summary,home_tagline,home_order,show_on_home,release_date,is_published'));
  return rows.sort(showcaseSort);
}
export async function setShowOnHome(id, value) {
  ok(await sb.from('seasons').update({ show_on_home: value }).eq('id', id));
}
export async function saveShowcaseOrder(ids) {
  for (const [i, id] of ids.entries()) ok(await sb.from('seasons').update({ home_order: i }).eq('id', id));
}

// ─── Teams ────────────────────────────────────────────────────────────
const TEAM_SEL = 'id,name,name_ar,tagline,tagline_ar,logo_path,description,team_order,is_team,is_published';
export async function listTeams() {
  return ok(await sb.from('groups').select(TEAM_SEL).eq('is_team', true).eq('is_published', true))
    .sort((a, b) => a.team_order - b.team_order || a.name.localeCompare(b.name));
}
export async function allGroupsForTeams() {
  return ok(await sb.from('groups').select(TEAM_SEL)).sort((a, b) => (b.is_team - a.is_team) || a.team_order - b.team_order || a.name.localeCompare(b.name));
}
export async function setIsTeam(id, value) { ok(await sb.from('groups').update({ is_team: value }).eq('id', id)); }
export async function saveTeamOrder(ids) {
  for (const [i, id] of ids.entries()) ok(await sb.from('groups').update({ team_order: i }).eq('id', id));
}
export async function teamCounts() {
  const rows = ok(await sb.rpc('lore_team_counts'));
  return Object.fromEntries(rows.map(r => [r.team_id, Number(r.members)]));
}

// ─── Profile (chosen team) ────────────────────────────────────────────
export async function myProfile(uid) {
  return ok(await sb.from('lore_profiles').select('user_id,team_id,team_chosen_at').eq('user_id', uid).maybeSingle());
}
export async function setMyTeam(uid, teamId) {
  return ok(await sb.from('lore_profiles').upsert({ user_id: uid, team_id: teamId }, { onConflict: 'user_id' }).select().single());
}

// ─── Countdowns ───────────────────────────────────────────────────────
export async function myCountdown(uid) {
  return ok(await sb.from('lore_countdowns').select('*').eq('user_id', uid).maybeSingle());
}
export async function saveMyCountdown(uid, row) {
  const data = {
    user_id: uid, title: (row.title || '').trim(), target_at: row.target_at || null,
    bg_type: row.bg_type || 'none', bg_path: row.bg_path || null, poster_path: row.poster_path || null,
    focal_x: row.focal_x ?? 50, focal_y: row.focal_y ?? 50, zoom: row.zoom ?? 1, overlay: row.overlay ?? 0.45,
  };
  return ok(await sb.from('lore_countdowns').upsert(data, { onConflict: 'user_id' }).select().single());
}
/** Delete the user's countdown and its files (back to the site default). */
export async function resetMyCountdown(uid, current) {
  ok(await sb.from('lore_countdowns').delete().eq('user_id', uid));
  if (current) await removeFiles([current.bg_path, current.poster_path], USER_BUCKET);
}
export async function defaultCountdown() {
  const row = ok(await sb.from('lore_site_settings').select('value').eq('key', 'countdown_default').maybeSingle());
  return row?.value || null;
}
export async function saveDefaultCountdown(value) {
  ok(await sb.from('lore_site_settings').upsert({ key: 'countdown_default', value }, { onConflict: 'key' }));
}
