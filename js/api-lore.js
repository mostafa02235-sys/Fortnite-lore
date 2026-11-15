// Data access for Groups/Factions, Seasons, Timeline events and Mysteries.
// Row Level Security in the database decides what each user may read/change.
import { sb } from './supabase.js';
import { removeFiles } from './media.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };
const like = s => `%${String(s).replace(/[%_\\]/g, m => '\\' + m)}%`;

// ─── Relationship labels (configurable) ───────────────────────────────
export async function listRelTypes() {
  return ok(await sb.from('group_relationship_types').select('*').order('sort_order').order('label_en'));
}
export async function saveRelType({ id, label_en, label_ar, sort_order = 0 }) {
  const row = { label_en: label_en.trim(), label_ar: (label_ar || '').trim(), sort_order };
  if (id) return ok(await sb.from('group_relationship_types').update(row).eq('id', id).select().single());
  return ok(await sb.from('group_relationship_types').insert(row).select().single());
}
export async function deleteRelType(id) { ok(await sb.from('group_relationship_types').delete().eq('id', id)); }

// ─── Groups ───────────────────────────────────────────────────────────
const GROUP_LIST = 'id,name,status,logo_path,description,is_published,updated_at,published_at,members:group_relationships(count)';

export async function listGroups({ publishedOnly = true, search } = {}) {
  let q = sb.from('groups').select(GROUP_LIST).order('name');
  if (publishedOnly) q = q.eq('is_published', true);
  if (search) q = q.ilike('name', like(search));
  return ok(await q);
}
export async function getGroup(id) {
  const g = ok(await sb.from('groups').select(`*,
      images:group_images(*),
      members:group_relationships(id,note,sort_order,relationship_type_id,type:group_relationship_types(id,label_en,label_ar,sort_order),character:characters(id,name,status,is_published,images:character_images(storage_path,is_primary))),
      seasons:season_groups(note,season:seasons(id,name,chapter_number,season_number,cover_path,is_published)),
      events:event_groups(event:season_events(id,title,position,season:seasons(id,name,chapter_number,season_number)))`)
    .eq('id', id).maybeSingle());
  if (!g) return null;
  g.images.sort((a, b) => a.sort_order - b.sort_order);
  g.members = g.members.filter(m => m.character).sort((a, b) => (a.type?.sort_order ?? 99) - (b.type?.sort_order ?? 99) || a.sort_order - b.sort_order);
  g.seasons = g.seasons.filter(s => s.season).sort((a, b) => seasonCmp(a.season, b.season));
  g.events = g.events.map(e => e.event).filter(Boolean);
  return g;
}
export async function saveGroup(row) {
  const data = {
    name: row.name.trim(), status: row.status?.trim() || null, logo_path: row.logo_path || null,
    description: row.description || '', story: row.story || '', history: row.history || '', goals: row.goals || '',
    is_published: !!row.is_published,
  };
  if (row.id) return ok(await sb.from('groups').update(data).eq('id', row.id).select().single());
  return ok(await sb.from('groups').insert(data).select().single());
}
export async function setGroupPublished(id, v) { return ok(await sb.from('groups').update({ is_published: v }).eq('id', id).select().single()); }
export async function deleteGroup(id) {
  const g = ok(await sb.from('groups').select('logo_path,images:group_images(storage_path)').eq('id', id).maybeSingle());
  ok(await sb.from('groups').delete().eq('id', id));
  if (g) await removeFiles([g.logo_path, ...g.images.map(i => i.storage_path)]);
}

/**
 * Replace the relationship rows for one side (a group or a character).
 * rows: [{character_id|group_id, relationship_type_id, note}]
 */
export async function syncRelationships({ groupId, characterId }, rows) {
  const key = groupId ? 'group_id' : 'character_id';
  const val = groupId || characterId;
  const existing = ok(await sb.from('group_relationships').select('id,group_id,character_id,relationship_type_id,note,sort_order').eq(key, val));
  const sig = r => `${r.group_id}|${r.character_id}|${r.relationship_type_id}`;
  const wanted = rows.map((r, i) => ({ ...r, [key]: val, sort_order: i }));
  const wantedSigs = new Set(wanted.map(sig));
  const remove = existing.filter(e => !wantedSigs.has(sig(e)));
  if (remove.length) ok(await sb.from('group_relationships').delete().in('id', remove.map(r => r.id)));
  for (const w of wanted) {
    const hit = existing.find(e => sig(e) === sig(w));
    if (hit) {
      if (hit.note !== (w.note || '') || hit.sort_order !== w.sort_order)
        ok(await sb.from('group_relationships').update({ note: w.note || '', sort_order: w.sort_order }).eq('id', hit.id));
    } else {
      ok(await sb.from('group_relationships').insert({
        group_id: w.group_id, character_id: w.character_id, relationship_type_id: w.relationship_type_id,
        note: w.note || '', sort_order: w.sort_order,
      }));
    }
  }
}
export async function characterGroups(characterId) {
  const rows = ok(await sb.from('group_relationships')
    .select('id,note,sort_order,relationship_type_id,group_id,type:group_relationship_types(id,label_en,label_ar,sort_order),group:groups(id,name,logo_path,is_published)')
    .eq('character_id', characterId).order('sort_order'));
  return rows.filter(r => r.group);
}
export async function characterAppearances(characterId) {
  const [seasons, events] = await Promise.all([
    sb.from('season_characters').select('note,season:seasons(id,name,chapter_number,season_number,cover_path)').eq('character_id', characterId).then(ok),
    sb.from('event_characters').select('event:season_events(id,title,position,season:seasons(id,name,chapter_number,season_number))').eq('character_id', characterId).then(ok),
  ]);
  return {
    seasons: seasons.filter(s => s.season).map(s => ({ ...s.season, note: s.note })).sort(seasonCmp),
    events: events.map(e => e.event).filter(e => e?.season),
  };
}

/** Sync a link table for one parent: rows = [{id, note?}] in order. */
async function syncLinks(table, parentKey, parentId, childKey, rows, { withNote = false, withOrder = false } = {}) {
  const existing = ok(await sb.from(table).select(`${childKey}${withNote ? ',note' : ''}${withOrder ? ',sort_order' : ''}`).eq(parentKey, parentId));
  const wantIds = rows.map(r => r.id);
  const gone = existing.filter(e => !wantIds.includes(e[childKey])).map(e => e[childKey]);
  if (gone.length) ok(await sb.from(table).delete().eq(parentKey, parentId).in(childKey, gone));
  const payload = rows.map((r, i) => {
    const o = { [parentKey]: parentId, [childKey]: r.id };
    if (withNote) o.note = r.note || '';
    if (withOrder) o.sort_order = i;
    return o;
  });
  if (payload.length) ok(await sb.from(table).upsert(payload, { onConflict: `${parentKey},${childKey}` }));
}

// ─── Gallery tables (group_images / season_images) ────────────────────
export async function syncGallery(table, parentKey, parentId, items, previous) {
  const keep = new Set(items.filter(i => i.id).map(i => i.id));
  const gone = previous.filter(p => !keep.has(p.id));
  if (gone.length) {
    ok(await sb.from(table).delete().in('id', gone.map(g => g.id)));
    await removeFiles(gone.map(g => g.storage_path));
  }
  const replaced = [];
  for (const [i, it] of items.entries()) {
    const row = { [parentKey]: parentId, storage_path: it.storage_path, image_name: (it.image_name || '').trim(), image_story: it.image_story || '', sort_order: i };
    if (it.id) {
      const prev = previous.find(p => p.id === it.id);
      if (prev && prev.storage_path !== it.storage_path) replaced.push(prev.storage_path);
      ok(await sb.from(table).update(row).eq('id', it.id));
    } else {
      it.id = ok(await sb.from(table).insert(row).select('id').single()).id;
    }
  }
  await removeFiles(replaced);
}

// ─── Seasons ──────────────────────────────────────────────────────────
export function seasonCmp(a, b) {
  const n = v => (v ?? 9999);
  return n(a.chapter_number) - n(b.chapter_number) || n(a.season_number) - n(b.season_number)
    || String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.name).localeCompare(String(b.name));
}
const SEASON_LIST = 'id,name,chapter_number,season_number,cover_path,release_date,end_date,summary,is_published,updated_at';

export async function listSeasons({ publishedOnly = true, search, chapter } = {}) {
  let q = sb.from('seasons').select(SEASON_LIST);
  if (publishedOnly) q = q.eq('is_published', true);
  if (search) q = q.ilike('name', like(search));
  if (chapter !== undefined && chapter !== null && chapter !== '') q = q.eq('chapter_number', chapter);
  return ok(await q).sort(seasonCmp);
}
export async function getSeason(id) {
  const s = ok(await sb.from('seasons').select(`*,
      images:season_images(*),
      refs:season_references(*),
      characters:season_characters(note,sort_order,character:characters(id,name,status,is_published,images:character_images(storage_path,is_primary))),
      groups:season_groups(note,sort_order,group:groups(id,name,logo_path,is_published)),
      mysteries(id,title,status,is_published,body)`)
    .eq('id', id).maybeSingle());
  if (!s) return null;
  s.images.sort((a, b) => a.sort_order - b.sort_order);
  s.refs.sort((a, b) => a.sort_order - b.sort_order);
  s.characters = s.characters.filter(c => c.character).sort((a, b) => a.sort_order - b.sort_order);
  s.groups = s.groups.filter(g => g.group).sort((a, b) => a.sort_order - b.sort_order);
  s.events = await listEvents(id);
  s.archive = ok(await sb.from('image_archive').select('id,storage_path,image_name,chapter,event_name,is_published').eq('season_id', id).order('uploaded_at'));
  return s;
}
export async function saveSeason(row) {
  const data = {
    name: row.name.trim(),
    chapter_number: row.chapter_number === '' || row.chapter_number == null ? null : +row.chapter_number,
    season_number: row.season_number === '' || row.season_number == null ? null : +row.season_number,
    cover_path: row.cover_path || null, release_date: row.release_date || null, end_date: row.end_date || null,
    summary: row.summary || '', story: row.story || '', discoveries: row.discoveries || '', missions: row.missions || '',
    is_published: !!row.is_published,
  };
  if (row.id) return ok(await sb.from('seasons').update(data).eq('id', row.id).select().single());
  return ok(await sb.from('seasons').insert(data).select().single());
}
export async function setSeasonPublished(id, v) { return ok(await sb.from('seasons').update({ is_published: v }).eq('id', id).select().single()); }
export async function deleteSeason(id) {
  const s = ok(await sb.from('seasons').select('cover_path,images:season_images(storage_path),events:season_events(image_path)').eq('id', id).maybeSingle());
  ok(await sb.from('seasons').delete().eq('id', id));
  if (s) await removeFiles([s.cover_path, ...s.images.map(i => i.storage_path), ...s.events.map(e => e.image_path)]);
}
export const syncSeasonCharacters = (seasonId, rows) => syncLinks('season_characters', 'season_id', seasonId, 'character_id', rows, { withNote: true, withOrder: true });
export const syncSeasonGroups = (seasonId, rows) => syncLinks('season_groups', 'season_id', seasonId, 'group_id', rows, { withNote: true, withOrder: true });
export const syncGroupSeasons = async (groupId, rows) => {
  // same table, other direction
  const existing = ok(await sb.from('season_groups').select('season_id,note').eq('group_id', groupId));
  const want = rows.map(r => r.id);
  const gone = existing.filter(e => !want.includes(e.season_id)).map(e => e.season_id);
  if (gone.length) ok(await sb.from('season_groups').delete().eq('group_id', groupId).in('season_id', gone));
  const payload = rows.map(r => ({ season_id: r.id, group_id: groupId, note: r.note || '' }));
  if (payload.length) ok(await sb.from('season_groups').upsert(payload, { onConflict: 'season_id,group_id' }));
};
export async function syncReferences(seasonId, refs, previous) {
  const keep = new Set(refs.filter(r => r.id).map(r => r.id));
  const gone = previous.filter(p => !keep.has(p.id)).map(p => p.id);
  if (gone.length) ok(await sb.from('season_references').delete().in('id', gone));
  for (const [i, r] of refs.entries()) {
    const row = { season_id: seasonId, title: r.title.trim(), url: r.url?.trim() || null, note: r.note || '', sort_order: i };
    if (r.id) ok(await sb.from('season_references').update(row).eq('id', r.id));
    else ok(await sb.from('season_references').insert(row));
  }
}

// ─── Season events (timeline) ─────────────────────────────────────────
const EVENT_SEL = `id,season_id,title,image_path,body,event_date,position,
  characters:event_characters(character:characters(id,name,is_published,images:character_images(storage_path,is_primary))),
  groups:event_groups(group:groups(id,name,logo_path,is_published)),
  images:event_images(image:image_archive(id,storage_path,image_name,is_published))`;
const shapeEvent = e => ({
  ...e,
  characters: (e.characters || []).map(x => x.character).filter(Boolean),
  groups: (e.groups || []).map(x => x.group).filter(Boolean),
  images: (e.images || []).map(x => x.image).filter(Boolean),
});
export async function listEvents(seasonId) {
  return ok(await sb.from('season_events').select(EVENT_SEL).eq('season_id', seasonId).order('position').order('created_at')).map(shapeEvent);
}
export async function getEvent(id) {
  const e = ok(await sb.from('season_events').select(EVENT_SEL + ',season:seasons(id,name,chapter_number,season_number,is_published)').eq('id', id).maybeSingle());
  return e ? shapeEvent(e) : null;
}
export async function saveEvent(row) {
  const data = { season_id: row.season_id, title: row.title.trim(), image_path: row.image_path || null, body: row.body || '', event_date: row.event_date || null };
  if (row.id) return ok(await sb.from('season_events').update(data).eq('id', row.id).select().single());
  const last = ok(await sb.from('season_events').select('position').eq('season_id', row.season_id).order('position', { ascending: false }).limit(1));
  data.position = last.length ? last[0].position + 1 : 0;
  return ok(await sb.from('season_events').insert(data).select().single());
}
export async function deleteEvent(id) {
  const e = ok(await sb.from('season_events').select('image_path').eq('id', id).maybeSingle());
  ok(await sb.from('season_events').delete().eq('id', id));
  if (e?.image_path) await removeFiles([e.image_path]);
}
export async function reorderEvents(seasonId, ids) {
  ok(await sb.rpc('lore_reorder_events', { _season_id: seasonId, _ids: ids }));
}
export const syncEventCharacters = (eventId, ids) => syncLinks('event_characters', 'event_id', eventId, 'character_id', ids.map(id => ({ id })));
export const syncEventGroups = (eventId, ids) => syncLinks('event_groups', 'event_id', eventId, 'group_id', ids.map(id => ({ id })));
export const syncEventImages = (eventId, ids) => syncLinks('event_images', 'event_id', eventId, 'image_id', ids.map(id => ({ id })));
/** Link a group to events (from the group editor). */
export async function syncGroupEvents(groupId, eventIds) {
  const existing = ok(await sb.from('event_groups').select('event_id').eq('group_id', groupId)).map(r => r.event_id);
  const gone = existing.filter(id => !eventIds.includes(id));
  if (gone.length) ok(await sb.from('event_groups').delete().eq('group_id', groupId).in('event_id', gone));
  const add = eventIds.filter(id => !existing.includes(id)).map(id => ({ event_id: id, group_id: groupId }));
  if (add.length) ok(await sb.from('event_groups').insert(add));
}
/** All events across seasons, in story order (for the global Timeline). */
export async function allEvents() {
  const rows = ok(await sb.from('season_events')
    .select('id,title,image_path,body,event_date,position,season:seasons(id,name,chapter_number,season_number,release_date,is_published)'));
  return rows.filter(r => r.season).sort((a, b) => seasonCmp(a.season, b.season) || a.position - b.position);
}

// ─── Mysteries ────────────────────────────────────────────────────────
export async function listMysteries({ publishedOnly = true, status, search } = {}) {
  let q = sb.from('mysteries').select('id,title,status,body,is_published,updated_at,season_id,season:seasons(id,name,chapter_number,season_number)').order('updated_at', { ascending: false });
  if (publishedOnly) q = q.eq('is_published', true);
  if (status) q = q.eq('status', status);
  if (search) q = q.ilike('title', like(search));
  return ok(await q);
}
export async function getMystery(id) {
  return ok(await sb.from('mysteries').select('*,season:seasons(id,name,chapter_number,season_number)').eq('id', id).maybeSingle());
}
export async function saveMystery(row) {
  const data = { title: row.title.trim(), body: row.body || '', status: row.status || 'open', season_id: row.season_id || null, is_published: !!row.is_published };
  if (row.id) return ok(await sb.from('mysteries').update(data).eq('id', row.id).select().single());
  return ok(await sb.from('mysteries').insert(data).select().single());
}
export async function setMysteryPublished(id, v) { return ok(await sb.from('mysteries').update({ is_published: v }).eq('id', id).select().single()); }
export async function deleteMystery(id) { ok(await sb.from('mysteries').delete().eq('id', id)); }

// ─── Search across everything ─────────────────────────────────────────
export async function searchAll(q) {
  const s = like(q);
  const [chars, groups, seasons, events, images, mysteries] = await Promise.all([
    sb.from('characters').select('id,name,status,images:character_images(storage_path,is_primary)').eq('is_published', true).ilike('name', s).limit(20).then(ok),
    sb.from('groups').select('id,name,logo_path').eq('is_published', true).ilike('name', s).limit(20).then(ok),
    sb.from('seasons').select('id,name,chapter_number,season_number,cover_path').eq('is_published', true).ilike('name', s).limit(20).then(ok),
    sb.from('season_events').select('id,title,season:seasons!inner(id,name,is_published)').eq('season.is_published', true).ilike('title', s).limit(20).then(ok),
    sb.from('image_archive').select('id,image_name,storage_path,chapter').eq('is_published', true).ilike('image_name', s).limit(20).then(ok),
    sb.from('mysteries').select('id,title,status').eq('is_published', true).ilike('title', s).limit(20).then(ok),
  ]);
  return { chars, groups, seasons, events, images, mysteries };
}

export async function loreStats() {
  const count = async (table, pub) => {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (pub) q = q.eq('is_published', true);
    const { count: n, error } = await q; if (error) throw error; return n || 0;
  };
  const [groups, groupsPub, seasons, seasonsPub, events, mysteries] = await Promise.all([
    count('groups'), count('groups', true), count('seasons'), count('seasons', true), count('season_events'), count('mysteries'),
  ]);
  return { groups, groupsPub, seasons, seasonsPub, events, mysteries };
}

// ─── Content inventory (developer: stories, publishing, overview) ─────
export async function contentInventory() {
  const [c, g, s, m, a] = await Promise.all([
    sb.from('characters').select('id,name,story,is_published,updated_at').then(ok),
    sb.from('groups').select('id,name,description,story,history,goals,is_published,updated_at').then(ok),
    sb.from('seasons').select('id,name,summary,story,chapter_number,season_number,is_published,updated_at').then(ok),
    sb.from('mysteries').select('id,title,body,is_published,updated_at').then(ok),
    sb.from('image_archive').select('id,image_name,story,storage_path,is_published,updated_at,uploaded_at').then(ok),
  ]);
  const item = (type, r, title, story, extra = {}) => ({
    type, id: r.id, title, story: story || '', is_published: r.is_published, updated_at: r.updated_at || r.uploaded_at, ...extra,
  });
  return [
    ...c.map(r => item('character', r, r.name, r.story)),
    ...g.map(r => item('group', r, r.name, [r.description, r.story, r.history, r.goals].join(''))),
    ...s.map(r => item('season', r, r.name, (r.summary || '') + (r.story || ''), { chapter_number: r.chapter_number, season_number: r.season_number })),
    ...m.map(r => item('mystery', r, r.title, r.body)),
    ...a.map(r => item('image', r, r.image_name, r.story, { storage_path: r.storage_path })),
  ].sort((x, y) => String(y.updated_at || '').localeCompare(String(x.updated_at || '')));
}
