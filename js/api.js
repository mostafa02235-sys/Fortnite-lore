// Data access. Every call runs as the signed-in user; Row Level Security in
// the database decides what they can read and change.
import { sb } from './supabase.js';
import { removeFiles } from './media.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

// ─── Roles ────────────────────────────────────────────────────────────
export async function myRoles(uid) {
  if (!uid) return [];
  const rows = ok(await sb.from('lore_user_roles').select('role').eq('user_id', uid));
  return rows.map(r => r.role);
}

// ─── Teams ────────────────────────────────────────────────────────────
export async function listTeams() {
  return ok(await sb.from('teams').select('id,name,description,updated_at,characters(count)').order('name'));
}
export async function getTeam(id, { publishedOnly = true } = {}) {
  const team = ok(await sb.from('teams').select('id,name,description').eq('id', id).maybeSingle());
  if (!team) return null;
  let q = sb.from('characters')
    .select('id,name,status,is_published,images:character_images(storage_path,is_primary)')
    .eq('team_id', id).order('name');
  if (publishedOnly) q = q.eq('is_published', true);
  team.characters = ok(await q);
  return team;
}
export async function saveTeam({ id, name, description }) {
  const row = { name: name.trim(), description: description || '' };
  if (id) return ok(await sb.from('teams').update(row).eq('id', id).select().single());
  return ok(await sb.from('teams').insert(row).select().single());
}
export async function deleteTeam(id) {
  ok(await sb.from('teams').delete().eq('id', id));
}
/** Set team_id for the given characters; clear it for removed members. */
export async function setTeamMembers(teamId, memberIds, previousIds) {
  const add = memberIds.filter(id => !previousIds.includes(id));
  const remove = previousIds.filter(id => !memberIds.includes(id));
  if (add.length) ok(await sb.from('characters').update({ team_id: teamId }).in('id', add));
  if (remove.length) ok(await sb.from('characters').update({ team_id: null }).in('id', remove).eq('team_id', teamId));
}

// ─── Characters ───────────────────────────────────────────────────────
const CHAR_LIST = 'id,name,status,is_published,updated_at,published_at,team_id,team:teams(id,name),images:character_images(storage_path,is_primary,image_name)';

export async function listCharacters({ publishedOnly = true, teamId, status, search } = {}) {
  let q = sb.from('characters').select(CHAR_LIST).order('name');
  if (publishedOnly) q = q.eq('is_published', true);
  if (teamId) q = q.eq('team_id', teamId);
  if (status) q = q.eq('status', status);
  if (search) q = q.ilike('name', `%${search.replace(/[%_]/g, m => '\\' + m)}%`);
  return ok(await q);
}
export async function getCharacter(id) {
  const c = ok(await sb.from('characters')
    .select('*,team:teams(id,name,description),images:character_images(*)')
    .eq('id', id).maybeSingle());
  if (c) c.images.sort((a, b) => (b.is_primary - a.is_primary) || a.sort_order - b.sort_order);
  return c;
}
export async function saveCharacter(row) {
  const data = {
    name: row.name.trim(), story: row.story || '', status: row.status || 'unknown',
    team_id: row.team_id || null, is_published: !!row.is_published,
  };
  if (row.id) return ok(await sb.from('characters').update(data).eq('id', row.id).select().single());
  return ok(await sb.from('characters').insert(data).select().single());
}
export async function setCharacterPublished(id, value) {
  return ok(await sb.from('characters').update({ is_published: value }).eq('id', id).select().single());
}
export async function deleteCharacter(id) {
  const imgs = ok(await sb.from('character_images').select('storage_path').eq('character_id', id));
  ok(await sb.from('characters').delete().eq('id', id));
  await removeFiles(imgs.map(i => i.storage_path));
}

/**
 * Sync a character's image list. `images` = [{id?, storage_path, image_name,
 * image_story, is_primary}] in display order. Removed rows are deleted and
 * their files removed from Storage.
 */
export async function syncCharacterImages(characterId, images, previous) {
  const keep = new Set(images.filter(i => i.id).map(i => i.id));
  const gone = previous.filter(p => !keep.has(p.id));
  if (gone.length) {
    ok(await sb.from('character_images').delete().in('id', gone.map(g => g.id)));
    await removeFiles(gone.map(g => g.storage_path));
  }
  // Clear the old cover first so the one-cover-per-character index never trips.
  ok(await sb.from('character_images').update({ is_primary: false }).eq('character_id', characterId).eq('is_primary', true));
  const replacedFiles = [];
  for (const [i, img] of images.entries()) {
    const row = {
      character_id: characterId, storage_path: img.storage_path,
      image_name: (img.image_name || '').trim(), image_story: img.image_story || '',
      is_primary: false, sort_order: i,
    };
    if (img.id) {
      const prev = previous.find(p => p.id === img.id);
      if (prev && prev.storage_path !== img.storage_path) replacedFiles.push(prev.storage_path);
      ok(await sb.from('character_images').update(row).eq('id', img.id));
    } else {
      const created = ok(await sb.from('character_images').insert(row).select('id').single());
      img.id = created.id;
    }
  }
  const cover = images.find(i => i.is_primary) || images[0];
  if (cover) ok(await sb.from('character_images').update({ is_primary: true }).eq('id', cover.id));
  await removeFiles(replacedFiles);
}

// ─── Image archive ────────────────────────────────────────────────────
const ARCH_LIST = 'id,storage_path,image_name,chapter,event_name,is_published,uploaded_at,character_id,character:characters(id,name)';

export async function listArchive({ publishedOnly = true, chapter, characterId, search } = {}) {
  let q = sb.from('image_archive').select(ARCH_LIST).order('uploaded_at', { ascending: false });
  if (publishedOnly) q = q.eq('is_published', true);
  if (chapter) q = q.eq('chapter', chapter);
  if (characterId) q = q.eq('character_id', characterId);
  if (search) q = q.ilike('image_name', `%${search.replace(/[%_]/g, m => '\\' + m)}%`);
  return ok(await q);
}
export async function getArchive(id) {
  return ok(await sb.from('image_archive').select('*,character:characters(id,name),season:seasons(id,name),events:event_images(event:season_events(id,title))').eq('id', id).maybeSingle());
}
export async function saveArchive(row) {
  const data = {
    storage_path: row.storage_path, image_name: row.image_name.trim(), story: row.story || '',
    character_id: row.character_id || null, season_id: row.season_id || null,
    event_name: row.event_name?.trim() || null, chapter: row.chapter?.trim() || null,
    is_published: !!row.is_published,
  };
  if (row.id) return ok(await sb.from('image_archive').update(data).eq('id', row.id).select().single());
  return ok(await sb.from('image_archive').insert(data).select().single());
}
export async function setArchivePublished(id, value) {
  return ok(await sb.from('image_archive').update({ is_published: value }).eq('id', id).select().single());
}
export async function deleteArchive(id) {
  const rec = ok(await sb.from('image_archive').select('storage_path').eq('id', id).maybeSingle());
  ok(await sb.from('image_archive').delete().eq('id', id));
  if (rec) await removeFiles([rec.storage_path]);
}
export async function archiveFacets() {
  const rows = ok(await sb.from('image_archive').select('chapter,event_name'));
  const uniq = k => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { chapters: uniq('chapter'), events: uniq('event_name') };
}

// ─── Stats (developer overview) ───────────────────────────────────────
export async function stats() {
  const count = async (table, f) => {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count: n, error } = await q; if (error) throw error; return n || 0;
  };
  const [chars, charsPub, imgs, imgsPub, teams] = await Promise.all([
    count('characters'), count('characters', q => q.eq('is_published', true)),
    count('image_archive'), count('image_archive', q => q.eq('is_published', true)),
    count('teams'),
  ]);
  return { chars, charsPub, imgs, imgsPub, teams };
}

// ─── Access management (admin RPCs; refused server-side for others) ───
export async function listStaff() { return ok(await sb.rpc('lore_list_staff')); }
export async function grantRole(email, role) { ok(await sb.rpc('lore_grant_role', { _email: email, _role: role })); }
export async function revokeRole(userId, role) { ok(await sb.rpc('lore_revoke_role', { _user_id: userId, _role: role })); }
