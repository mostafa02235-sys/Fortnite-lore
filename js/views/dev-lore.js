// Developer management for Groups/Factions, Seasons + Timeline, Mysteries and
// relationship labels. All writes are re-checked by RLS in the database.
import { t, getLang } from '../i18n.js';
import { h, $, $$, toast, errMsg, confirmDialog, modal, fmtDate, hasContent, debounce, excerpt } from '../util.js';
import { hydrateMedia, removeFiles } from '../media.js';
import { createEditor } from '../editor.js';
import * as api from '../api.js';
import * as lore from '../api-lore.js';
import { go } from '../app.js';
import { imageField, galleryEditor, linkPicker, relationshipEditor, referencesEditor, actionBar, seasonLabel } from '../components.js';
import { renderGroupProfile } from './groups.js';
import { renderSeasonPage } from './seasons.js';
import { renderMystery } from './explore.js';

let guard = null;
export const leaveGuard = () => guard?.();
export const resetGuard = () => { guard = null; };

const pubBadge = p => `<span class="badge ${p ? 'badge-pub' : 'badge-draft'}">${h(t(p ? 'common.published' : 'common.draft'))}</span>`;
const editorHead = (back, backLabel, title, published) => `
  <div class="toolbar"><div><a href="${back}" class="muted small">← ${h(backLabel)}</a>
    <h1 class="display" dir="auto">${h(title)}</h1></div>${published === undefined ? '' : pubBadge(published)}</div>`;
const panel = (titleKey, inner, { req = false, id = '' } = {}) =>
  `<section class="panel" ${id ? `id="${id}"` : ''}><h2 class="kicker">${h(t(titleKey))}${req ? ' <em class="req">*</em>' : ''}</h2>${inner}</section>`;

/** Generic admin list with search, publish toggle and delete. */
async function adminList(el, ctx, { title, newHref, newLabel, load, row, publish, remove, confirmKey }) {
  el.innerHTML = `
    <div class="toolbar"><h1 class="display">${h(title)}</h1>${newHref ? `<a class="btn btn-primary" href="${newHref}">＋ ${h(newLabel)}</a>` : ''}</div>
    <form class="filters" id="dfilters"><input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto"></form>
    <div id="rows"></div>`;
  const form = $('#dfilters', el);
  const run = async () => {
    const list = await load(form.q.value.trim());
    if (!ctx.isCurrent()) return;
    const rows = $('#rows', el);
    rows.innerHTML = list.length ? `<ul class="admin-list">${list.map(item => `<li class="admin-row" data-id="${h(item.id)}">${row(item)}
      <div class="admin-actions">
        <a class="btn btn-small" href="${item._edit}">${h(t('common.edit'))}</a>
        ${publish ? `<button class="btn btn-small" data-act="pub">${h(t(item.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>` : ''}
        ${item._view ? `<a class="btn btn-small btn-ghost" href="${item._view}">${h(t('common.view'))}</a>` : ''}
        <button class="btn btn-small btn-ghost btn-danger-text" data-act="del">${h(t('common.delete'))}</button>
      </div></li>`).join('')}</ul>` : `<div class="empty"><p class="muted">${h(t('dev.nothingYet'))}</p></div>`;
    hydrateMedia(rows);
    $$('[data-act]', rows).forEach(b => b.onclick = async () => {
      const item = list.find(x => x.id === b.closest('[data-id]').dataset.id);
      b.disabled = true;
      try {
        if (b.dataset.act === 'pub') { await publish(item.id, !item.is_published); toast(t(item.is_published ? 'dev.unpublished' : 'dev.publishedOk')); }
        else if (await confirmDialog(t(confirmKey, { name: item.name || item.title }))) { await remove(item.id); toast(t('dev.deleted')); }
        await run();
      } catch (e) { toast(errMsg(e), 'error'); b.disabled = false; }
    });
  };
  form.oninput = debounce(run, 250); form.onsubmit = e => e.preventDefault();
  await run();
}

function wireActions(el, { save, preview, remove, model }) {
  const setBusy = b => $$('.action-bar button', el).forEach(x => x.disabled = b);
  $('.action-bar', el).onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'preview') return preview();
    if (a === 'delete') {
      if (!await confirmDialog(t('dev.confirmDeleteGeneric', { name: model.name || model.title }))) return;
      setBusy(true);
      try { await remove(); guard = null; toast(t('dev.deleted')); } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try { await save(a === 'toggle' ? !model.is_published : undefined); }
    catch (err) { toast(errMsg(err), 'error'); }
    finally { setBusy(false); }
  };
}
const openPreview = box => modal({ title: t('dev.preview'), body: box, wide: true, className: 'modal-full' });
const savedToast = publish => toast(t(publish === true ? 'dev.publishedOk' : publish === false ? 'dev.unpublished' : 'dev.saved'));

// ═══ Groups ══════════════════════════════════════════════════════════════
export function groupList(el, _, ctx) {
  return adminList(el, ctx, {
    title: t('dev.groups'), newHref: '#dev/group/new', newLabel: t('dev.newGroup'), confirmKey: 'dev.confirmDeleteGeneric',
    load: async q => (await lore.listGroups({ publishedOnly: false, search: q })).map(g => ({ ...g, _edit: `#dev/group/${g.id}`, _view: `#group/${g.id}` })),
    row: g => `<div class="thumb thumb-sq">${g.logo_path ? `<img data-path="${h(g.logo_path)}" alt="">` : ''}</div>
      <div class="admin-main"><a href="#dev/group/${h(g.id)}" class="admin-title" dir="auto">${h(g.name)}</a>
        <div class="row-wrap small">${pubBadge(g.is_published)}${g.status ? `<span class="muted" dir="auto">${h(g.status)}</span>` : ''}
        <span class="muted">${h(t('groups.memberCount', { n: g.members?.[0]?.count ?? 0 }))}</span><span class="muted">${h(fmtDate(g.updated_at))}</span></div></div>`,
    publish: lore.setGroupPublished, remove: lore.deleteGroup,
  });
}

export async function groupEditor(el, id, ctx) {
  const isNew = !id || id === 'new' || id === 'new-team';
  const [g, chars, types, seasons] = await Promise.all([
    isNew ? null : lore.getGroup(id), api.listCharacters({ publishedOnly: false }), lore.listRelTypes(), lore.listSeasons({ publishedOnly: false }),
  ]);
  const events = (await Promise.all(seasons.map(s => lore.listEvents(s.id).then(evs => evs.map(e => ({ ...e, season: s })))))).flat();
  if (!ctx.isCurrent()) return;
  if (!isNew && !g) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = g || { name: '', status: '', description: '', story: '', history: '', goals: '', is_published: false, images: [], members: [], seasons: [], events: [],
    name_ar: '', tagline: '', tagline_ar: '', is_team: id === 'new-team' };
  let dirty = false; guard = () => dirty;

  el.innerHTML = `${editorHead('#dev/groups', t('dev.groups'), isNew ? t('dev.newGroup') : model.name, model.is_published)}
    <form class="editor-form" id="gform" novalidate>
      ${panel('dev.basics', `
        <label class="field"><span>${h(t('groups.name'))} <em class="req">*</em></span><input name="name" maxlength="200" required value="${h(model.name)}" dir="auto"></label>
        <label class="field"><span>${h(t('groups.status'))} <small class="muted">(${h(t('common.optional'))})</small></span>
          <input name="status" maxlength="60" list="dl-gstatus" value="${h(model.status || '')}" dir="auto" placeholder="${h(t('groups.statusPh'))}"></label>
        <datalist id="dl-gstatus">${['active', 'disbanded', 'destroyed', 'unknown'].map(k => `<option value="${h(t('groups.st.' + k))}">`).join('')}</datalist>`)}
      ${panel('team.panel', `
        <label class="check-row"><input type="checkbox" name="is_team" ${model.is_team ? 'checked' : ''}> <span><strong>${h(t('team.isTeam'))}</strong><small class="muted">${h(t('team.isTeamHelp'))}</small></span></label>
        <div class="grid-2">
          <label class="field"><span>${h(t('team.nameAr'))}</span><input name="name_ar" maxlength="200" value="${h(model.name_ar || '')}" dir="rtl"></label>
          <span></span>
          <label class="field"><span>${h(t('team.tagline'))}</span><input name="tagline" maxlength="300" value="${h(model.tagline || '')}" dir="ltr"></label>
          <label class="field"><span>${h(t('team.taglineAr'))}</span><input name="tagline_ar" maxlength="300" value="${h(model.tagline_ar || '')}" dir="rtl"></label>
        </div>`)}
      ${panel('groups.logo', '<div id="logo"></div>')}
      ${panel('groups.description', '<div id="ed-description"></div>', { req: true })}
      ${panel('groups.story', '<div id="ed-story"></div>')}
      ${panel('groups.history', '<div id="ed-history"></div>')}
      ${panel('groups.goals', '<div id="ed-goals"></div>')}
      ${panel('groups.members', `<p class="muted small">${h(t('groups.membersHelp'))} <a href="#dev/labels">${h(t('dev.labels'))} →</a></p><div id="members"></div>`)}
      ${panel('groups.relatedSeasons', '<div id="gseasons"></div>')}
      ${panel('groups.relatedEvents', '<div id="gevents"></div>')}
      ${panel('groups.images', '<div id="gallery"></div>')}
      ${actionBar({ isNew, published: model.is_published })}
    </form>`;
  const form = $('#gform', el);
  form.addEventListener('input', () => { dirty = true; });
  const logo = imageField($('#logo', el), { path: model.logo_path });
  const eds = Object.fromEntries(['description', 'story', 'history', 'goals'].map(k =>
    [k, createEditor($('#ed-' + k, el), { html: model[k], compact: k !== 'story', placeholder: t('dev.storyPlaceholder'), label: t('groups.' + k) })]));
  const members = relationshipEditor($('#members', el), {
    side: 'group', types, rows: model.members.map(m => ({ character_id: m.character.id, relationship_type_id: m.relationship_type_id, note: m.note })),
    targets: chars.map(c => ({ id: c.id, label: c.name + (c.is_published ? '' : ` (${t('common.draft')})`) })),
  });
  const sPick = linkPicker($('#gseasons', el), {
    options: seasons.map(s => ({ id: s.id, label: s.name, sub: seasonLabel(s) })),
    selected: model.seasons.map(s => ({ id: s.season.id, note: s.note })), withNote: true, ordered: false, notePlaceholder: t('groups.seasonNotePh'),
  });
  const ePick = linkPicker($('#gevents', el), {
    options: events.map(e => ({ id: e.id, label: e.title, sub: e.season.name })),
    selected: model.events.map(e => ({ id: e.id })), ordered: false,
  });
  const gallery = galleryEditor($('#gallery', el), model.images);

  const collect = () => ({
    id: model.id, name: form.name.value, status: form.status.value,
    name_ar: form.name_ar.value, tagline: form.tagline.value, tagline_ar: form.tagline_ar.value, is_team: form.is_team.checked,
    ...Object.fromEntries(Object.entries(eds).map(([k, e]) => [k, e.getHtml()])),
  });
  wireActions(el, {
    model,
    preview: () => {
      const d = collect();
      const typeOf = id => types.find(ty => ty.id === id);
      const box = document.createElement('div');
      renderGroupProfile(box, {
        ...d, is_published: false, _logoUrl: logo.previewUrl, logo_path: logo.path,
        members: members.value().map(r => ({ note: r.note, type: typeOf(r.relationship_type_id), character: chars.find(c => c.id === r.character_id) })).filter(m => m.character),
        seasons: sPick.value().map(v => ({ note: v.note, season: seasons.find(s => s.id === v.id) })),
        events: ePick.ids().map(id => events.find(e => e.id === id)).filter(Boolean),
        images: gallery.items(),
      }, { preview: true });
      openPreview(box);
    },
    remove: async () => { await lore.deleteGroup(model.id); go('dev/groups'); },
    save: async publish => {
      const d = collect();
      if (!d.name.trim()) { form.name.focus(); return toast(t('dev.nameRequired'), 'error'); }
      const target = publish ?? model.is_published;
      if (target && !hasContent(d.description) && !hasContent(d.story)) return toast(t('groups.needText'), 'error');
      const uploaded = [];
      try {
        const lg = await logo.commit('groups'); if (lg.uploaded) uploaded.push(lg.uploaded);
        const row = await lore.saveGroup({ ...d, logo_path: lg.path, is_published: target });
        model.id = row.id;
        await lore.syncRelationships({ groupId: row.id }, members.value());
        await lore.syncGroupSeasons(row.id, sPick.value());
        await lore.syncGroupEvents(row.id, ePick.ids());
        const gal = await gallery.upload('groups'); uploaded.push(...gal.uploaded);
        await lore.syncGallery('group_images', 'group_id', row.id, gal.items, model.images || []);
        if (lg.old && lg.old !== lg.path) await removeFiles([lg.old]);
        dirty = false; guard = null; savedToast(publish);
        go(`dev/group/${row.id}`);
      } catch (e) { if (uploaded.length) await removeFiles(uploaded).catch(() => {}); throw e; }
    },
  });
}

// ═══ Seasons ═════════════════════════════════════════════════════════════
export function seasonList(el, _, ctx) {
  return adminList(el, ctx, {
    title: t('dev.seasons'), newHref: '#dev/season/new', newLabel: t('dev.newSeason'), confirmKey: 'dev.confirmDeleteGeneric',
    load: async q => (await lore.listSeasons({ publishedOnly: false, search: q })).map(s => ({ ...s, _edit: `#dev/season/${s.id}`, _view: `#season/${s.id}` })),
    row: s => `<div class="thumb thumb-wide">${s.cover_path ? `<img data-path="${h(s.cover_path)}" alt="">` : ''}</div>
      <div class="admin-main"><a href="#dev/season/${h(s.id)}" class="admin-title" dir="auto">${h(s.name)}</a>
        <div class="row-wrap small">${pubBadge(s.is_published)}<span class="muted">${h(seasonLabel(s))}</span>
        ${s.release_date ? `<span class="muted">${h(fmtDate(s.release_date))}</span>` : ''}</div></div>`,
    publish: lore.setSeasonPublished, remove: lore.deleteSeason,
  });
}

export async function seasonEditor(el, id, ctx) {
  const isNew = !id || id === 'new';
  const [s, chars, groups] = await Promise.all([
    isNew ? null : lore.getSeason(id), api.listCharacters({ publishedOnly: false }), lore.listGroups({ publishedOnly: false }),
  ]);
  if (!ctx.isCurrent()) return;
  if (!isNew && !s) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = s || { name: '', chapter_number: null, season_number: null, release_date: null, end_date: null, summary: '', story: '', discoveries: '', missions: '',
    is_published: false, images: [], refs: [], characters: [], groups: [], events: [], mysteries: [], archive: [] };
  let dirty = false; guard = () => dirty;

  el.innerHTML = `${editorHead('#dev/seasons', t('dev.seasons'), isNew ? t('dev.newSeason') : model.name, model.is_published)}
    <form class="editor-form" id="sform" novalidate>
      ${panel('dev.basics', `
        <label class="field"><span>${h(t('seasons.name'))} <em class="req">*</em></span><input name="name" maxlength="200" required value="${h(model.name)}" dir="auto" placeholder="${h(t('seasons.namePh'))}"></label>
        <div class="grid-2">
          <label class="field"><span>${h(t('seasons.chapterNumber'))}</span><input name="chapter_number" type="number" min="0" inputmode="numeric" value="${h(model.chapter_number ?? '')}"></label>
          <label class="field"><span>${h(t('seasons.seasonNumber'))}</span><input name="season_number" type="number" min="0" inputmode="numeric" value="${h(model.season_number ?? '')}"></label>
          <label class="field"><span>${h(t('seasons.release'))}</span><input name="release_date" type="date" value="${h(model.release_date || '')}"></label>
          <label class="field"><span>${h(t('seasons.end'))}</span><input name="end_date" type="date" value="${h(model.end_date || '')}"></label>
        </div>`)}
      ${panel('seasons.cover', `<div id="cover"></div><p class="muted small">${h(t('showcase.coverHelp'))}</p>`)}
      ${panel('showcase.panel', `
        <label class="check-row"><input type="checkbox" name="show_on_home" ${model.show_on_home !== false ? 'checked' : ''}> <span><strong>${h(t('showcase.onHome'))}</strong><small class="muted">${h(t('showcase.onHomeHelp'))}</small></span></label>
        <label class="field"><span>${h(t('showcase.tagline'))} <small class="muted">(${h(t('common.optional'))})</small></span>
          <input name="home_tagline" maxlength="300" value="${h(model.home_tagline || '')}" dir="auto" placeholder="${h(t('showcase.taglinePh'))}"></label>`)}
      ${panel('seasons.summary', '<div id="ed-summary"></div>', { req: true })}
      ${panel('seasons.story', '<div id="ed-story"></div>')}
      ${isNew ? panel('seasons.timeline', `<p class="muted small">${h(t('seasons.saveFirst'))}</p>`) : panel('seasons.timeline', `
        <p class="muted small">${h(t('seasons.timelineHelp'))}</p>
        <ol class="ev-list" id="ev-list"></ol>
        <a class="btn btn-small" href="#dev/event/new-${h(model.id)}">＋ ${h(t('seasons.addEvent'))}</a>`, { id: 'timeline' })}
      ${panel('seasons.characters', '<div id="schars"></div>')}
      ${panel('seasons.groups', '<div id="sgroups"></div>')}
      ${panel('seasons.discoveries', '<div id="ed-discoveries"></div>')}
      ${panel('seasons.missions', '<div id="ed-missions"></div>')}
      ${panel('seasons.images', '<div id="gallery"></div>')}
      ${panel('seasons.references', '<div id="refs"></div>')}
      ${actionBar({ isNew, published: model.is_published })}
    </form>`;
  const form = $('#sform', el);
  form.addEventListener('input', () => { dirty = true; });
  const cover = imageField($('#cover', el), { path: model.cover_path });
  const eds = Object.fromEntries(['summary', 'story', 'discoveries', 'missions'].map(k =>
    [k, createEditor($('#ed-' + k, el), { html: model[k], compact: k !== 'story', placeholder: t('dev.storyPlaceholder'), label: t('seasons.' + k) })]));
  const cPick = linkPicker($('#schars', el), {
    options: chars.map(c => ({ id: c.id, label: c.name, sub: c.is_published ? '' : t('common.draft') })),
    selected: model.characters.map(c => ({ id: c.character.id, note: c.note })), withNote: true, notePlaceholder: t('seasons.charNotePh'),
  });
  const gPick = linkPicker($('#sgroups', el), {
    options: groups.map(g => ({ id: g.id, label: g.name, sub: g.is_published ? '' : t('common.draft') })),
    selected: model.groups.map(g => ({ id: g.group.id, note: g.note })), withNote: true, notePlaceholder: t('seasons.groupNotePh'),
  });
  const gallery = galleryEditor($('#gallery', el), model.images);
  const refs = referencesEditor($('#refs', el), model.refs);
  if (!isNew) timelineManager($('#ev-list', el), model);

  const collect = () => ({
    id: model.id, name: form.name.value, chapter_number: form.chapter_number.value, season_number: form.season_number.value,
    show_on_home: form.show_on_home.checked, home_tagline: form.home_tagline.value,
    release_date: form.release_date.value, end_date: form.end_date.value,
    ...Object.fromEntries(Object.entries(eds).map(([k, e]) => [k, e.getHtml()])),
  });
  wireActions(el, {
    model,
    preview: () => {
      const d = collect();
      const box = document.createElement('div');
      renderSeasonPage(box, {
        ...d, chapter_number: d.chapter_number === '' ? null : +d.chapter_number, season_number: d.season_number === '' ? null : +d.season_number,
        is_published: false, cover_path: cover.path, _coverUrl: cover.previewUrl,
        characters: cPick.value().map(v => ({ note: v.note, character: chars.find(c => c.id === v.id) })),
        groups: gPick.value().map(v => ({ note: v.note, group: groups.find(g => g.id === v.id) })),
        images: gallery.items(), refs: refs.value(), events: model.events, mysteries: model.mysteries, archive: model.archive,
      }, { preview: true });
      openPreview(box);
    },
    remove: async () => { await lore.deleteSeason(model.id); go('dev/seasons'); },
    save: async publish => {
      const d = collect();
      if (!d.name.trim()) { form.name.focus(); return toast(t('dev.nameRequired'), 'error'); }
      if (d.release_date && d.end_date && d.end_date < d.release_date) return toast(t('seasons.badDates'), 'error');
      if (refs.invalid()) return toast(t('editor.badUrl'), 'error');
      const target = publish ?? model.is_published;
      if (target && !hasContent(d.summary) && !hasContent(d.story)) return toast(t('seasons.needText'), 'error');
      const uploaded = [];
      try {
        const cv = await cover.commit('seasons'); if (cv.uploaded) uploaded.push(cv.uploaded);
        const row = await lore.saveSeason({ ...d, cover_path: cv.path, is_published: target });
        model.id = row.id;
        await lore.syncSeasonCharacters(row.id, cPick.value());
        await lore.syncSeasonGroups(row.id, gPick.value());
        const gal = await gallery.upload('seasons'); uploaded.push(...gal.uploaded);
        await lore.syncGallery('season_images', 'season_id', row.id, gal.items, model.images || []);
        await lore.syncReferences(row.id, refs.value(), model.refs || []);
        if (cv.old && cv.old !== cv.path) await removeFiles([cv.old]);
        dirty = false; guard = null; savedToast(publish);
        go(`dev/season/${row.id}`);
      } catch (e) { if (uploaded.length) await removeFiles(uploaded).catch(() => {}); throw e; }
    },
  });
}

/** Reorder events without recreating them: drag & drop or ↑/↓, saved at once. */
export function timelineManager(list, season) {
  let events = [...season.events];
  const draw = () => {
    list.innerHTML = events.length ? events.map((e, i) => `
      <li class="ev-row" draggable="true" data-id="${h(e.id)}">
        <span class="ev-handle" aria-hidden="true">⋮⋮</span>
        <span class="ev-num">${i + 1}</span>
        <div class="ev-main"><strong dir="auto">${h(e.title)}</strong><small class="muted" dir="auto">${h(excerpt(e.body, 90))}</small></div>
        <div class="link-actions">
          ${i > 0 ? `<button type="button" class="icon-btn" data-mv="-1" aria-label="${h(t('seasons.moveUp'))}">↑</button>` : ''}
          ${i < events.length - 1 ? `<button type="button" class="icon-btn" data-mv="1" aria-label="${h(t('seasons.moveDown'))}">↓</button>` : ''}
          <a class="btn btn-small" href="#dev/event/${h(e.id)}">${h(t('common.edit'))}</a>
        </div></li>`).join('') : `<li class="muted small empty-inline">${h(t('seasons.noEvents'))}</li>`;
    $$('[data-mv]', list).forEach(b => b.onclick = () => {
      const i = events.findIndex(e => e.id === b.closest('[data-id]').dataset.id), j = i + +b.dataset.mv;
      [events[i], events[j]] = [events[j], events[i]]; persist();
    });
    let dragId = null;
    $$('.ev-row', list).forEach(li => {
      li.ondragstart = e => { dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; };
      li.ondragend = () => li.classList.remove('dragging');
      li.ondragover = e => { e.preventDefault(); li.classList.add('drop-target'); };
      li.ondragleave = () => li.classList.remove('drop-target');
      li.ondrop = e => {
        e.preventDefault(); li.classList.remove('drop-target');
        const from = events.findIndex(x => x.id === dragId), to = events.findIndex(x => x.id === li.dataset.id);
        if (from < 0 || from === to) return;
        const [m] = events.splice(from, 1); events.splice(to, 0, m); persist();
      };
    });
  };
  const persist = async () => {
    draw();
    try { await lore.reorderEvents(season.id, events.map(e => e.id)); season.events = events; toast(t('seasons.orderSaved')); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  draw();
}

// ═══ Season event ════════════════════════════════════════════════════════
export async function eventEditor(el, id, ctx) {
  const isNew = id.startsWith('new-');
  const [e, chars, groups, archive, seasons] = await Promise.all([
    isNew ? null : lore.getEvent(id), api.listCharacters({ publishedOnly: false }), lore.listGroups({ publishedOnly: false }),
    api.listArchive({ publishedOnly: false }), lore.listSeasons({ publishedOnly: false }),
  ]);
  if (!ctx.isCurrent()) return;
  if (!isNew && !e) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const seasonId = isNew ? id.slice(4) : e.season_id;
  const season = seasons.find(s => s.id === seasonId);
  if (!season) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = e || { title: '', body: '', event_date: null, season_id: seasonId, characters: [], groups: [], images: [] };
  let dirty = false; guard = () => dirty;

  el.innerHTML = `${editorHead(`#dev/season/${seasonId}`, season.name, isNew ? t('seasons.addEvent') : model.title)}
    <form class="editor-form" id="eform" novalidate>
      ${panel('dev.basics', `
        <label class="field"><span>${h(t('seasons.eventName'))} <em class="req">*</em></span><input name="title" maxlength="200" required value="${h(model.title)}" dir="auto"></label>
        <div class="grid-2">
          <label class="field"><span>${h(t('seasons.eventDate'))} <small class="muted">(${h(t('common.optional'))})</small></span><input type="date" name="event_date" value="${h(model.event_date || '')}"></label>
          <label class="field"><span>${h(t('seasons.season'))}</span><select name="season_id">${seasons.map(s => `<option value="${h(s.id)}" ${s.id === seasonId ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>
        </div>`)}
      ${panel('seasons.eventImage', '<div id="eimg"></div>')}
      ${panel('seasons.explanation', '<div id="ed-body"></div>')}
      ${panel('nav.characters', '<div id="echars"></div>')}
      ${panel('nav.groups', '<div id="egroups"></div>')}
      ${panel('seasons.relatedImages', '<div id="eimages"></div>')}
      <div class="action-bar">
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-danger-text" data-a="delete">${h(t('common.delete'))}</button>` : ''}
        <span class="spacer"></span>
        ${!isNew ? `<a class="btn" href="#event/${h(model.id)}">${h(t('common.view'))}</a>` : ''}
        <button type="button" class="btn btn-primary" data-a="save">${h(t('common.save'))}</button>
      </div>
    </form>`;
  const form = $('#eform', el);
  form.addEventListener('input', () => { dirty = true; });
  const img = imageField($('#eimg', el), { path: model.image_path });
  const body = createEditor($('#ed-body', el), { html: model.body, placeholder: t('dev.storyPlaceholder'), label: t('seasons.explanation') });
  const cPick = linkPicker($('#echars', el), { options: chars.map(c => ({ id: c.id, label: c.name })), selected: model.characters.map(c => ({ id: c.id })), ordered: false });
  const gPick = linkPicker($('#egroups', el), { options: groups.map(g => ({ id: g.id, label: g.name })), selected: model.groups.map(g => ({ id: g.id })), ordered: false });
  const iPick = linkPicker($('#eimages', el), {
    options: archive.map(a => ({ id: a.id, label: a.image_name, sub: [a.chapter, a.event_name].filter(Boolean).join(' · ') })),
    selected: model.images.map(i => ({ id: i.id })), ordered: false,
  });
  $('.action-bar', el).onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    const btns = $$('.action-bar button', el); btns.forEach(b => b.disabled = true);
    try {
      if (a === 'delete') {
        if (!await confirmDialog(t('dev.confirmDeleteGeneric', { name: model.title }))) return;
        await lore.deleteEvent(model.id); guard = null; toast(t('dev.deleted')); go(`dev/season/${seasonId}`); return;
      }
      if (!form.title.value.trim()) { form.title.focus(); return toast(t('dev.nameRequired'), 'error'); }
      const uploaded = [];
      try {
        const im = await img.commit('events'); if (im.uploaded) uploaded.push(im.uploaded);
        const row = await lore.saveEvent({ id: model.id, season_id: form.season_id.value, title: form.title.value, event_date: form.event_date.value, body: body.getHtml(), image_path: im.path });
        await lore.syncEventCharacters(row.id, cPick.ids());
        await lore.syncEventGroups(row.id, gPick.ids());
        await lore.syncEventImages(row.id, iPick.ids());
        if (im.old && im.old !== im.path) await removeFiles([im.old]);
        dirty = false; guard = null; toast(t('dev.saved'));
        go(`dev/season/${row.season_id}`);
      } catch (err) { if (uploaded.length) await removeFiles(uploaded).catch(() => {}); throw err; }
    } catch (err) { toast(errMsg(err), 'error'); }
    finally { btns.forEach(b => b.disabled = false); }
  };
}

// ═══ Mysteries ═══════════════════════════════════════════════════════════
export function mysteryList(el, _, ctx) {
  return adminList(el, ctx, {
    title: t('dev.mysteries'), newHref: '#dev/mystery/new', newLabel: t('dev.newMystery'), confirmKey: 'dev.confirmDeleteGeneric',
    load: async q => (await lore.listMysteries({ publishedOnly: false, search: q })).map(m => ({ ...m, _edit: `#dev/mystery/${m.id}`, _view: `#mystery/${m.id}` })),
    row: m => `<div class="admin-main"><a href="#dev/mystery/${h(m.id)}" class="admin-title" dir="auto">${h(m.title)}</a>
      <div class="row-wrap small">${pubBadge(m.is_published)}<span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span>
      ${m.season ? `<span class="muted" dir="auto">${h(m.season.name)}</span>` : ''}</div></div>`,
    publish: lore.setMysteryPublished, remove: lore.deleteMystery,
  });
}

export async function mysteryEditor(el, id, ctx) {
  const isNew = !id || id === 'new';
  const [m, seasons] = await Promise.all([isNew ? null : lore.getMystery(id), lore.listSeasons({ publishedOnly: false })]);
  if (!ctx.isCurrent()) return;
  if (!isNew && !m) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = m || { title: '', body: '', status: 'open', season_id: null, is_published: false };
  let dirty = false; guard = () => dirty;
  el.innerHTML = `${editorHead('#dev/mysteries', t('dev.mysteries'), isNew ? t('dev.newMystery') : model.title, model.is_published)}
    <form class="editor-form" id="mform" novalidate>
      ${panel('dev.basics', `
        <label class="field"><span>${h(t('mysteries.name'))} <em class="req">*</em></span><input name="title" maxlength="200" value="${h(model.title)}" dir="auto"></label>
        <fieldset class="field"><legend>${h(t('mysteries.status'))}</legend><div class="seg">${['open', 'partial', 'solved'].map(s =>
          `<label><input type="radio" name="status" value="${s}" ${model.status === s ? 'checked' : ''}><span>${h(t('mysteries.' + s))}</span></label>`).join('')}</div></fieldset>
        <label class="field"><span>${h(t('seasons.season'))}</span><select name="season_id"><option value="">—</option>
          ${seasons.map(s => `<option value="${h(s.id)}" ${s.id === model.season_id ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select></label>`)}
      ${panel('mysteries.body', '<div id="ed-body"></div>', { req: true })}
      ${actionBar({ isNew, published: model.is_published })}
    </form>`;
  const form = $('#mform', el);
  form.addEventListener('input', () => { dirty = true; });
  const body = createEditor($('#ed-body', el), { html: model.body, placeholder: t('dev.storyPlaceholder') });
  const collect = () => ({ id: model.id, title: form.title.value, status: form.status.value, season_id: form.season_id.value || null, body: body.getHtml() });
  wireActions(el, {
    model,
    preview: () => { const d = collect(); const box = document.createElement('div'); renderMystery(box, { ...d, is_published: false, season: seasons.find(s => s.id === d.season_id) }, { preview: true }); openPreview(box); },
    remove: async () => { await lore.deleteMystery(model.id); go('dev/mysteries'); },
    save: async publish => {
      const d = collect();
      if (!d.title.trim()) { form.title.focus(); return toast(t('dev.nameRequired'), 'error'); }
      const target = publish ?? model.is_published;
      if (target && !hasContent(d.body)) return toast(t('error.storyRequired'), 'error');
      const row = await lore.saveMystery({ ...d, is_published: target });
      dirty = false; guard = null; savedToast(publish);
      go(`dev/mystery/${row.id}`);
    },
  });
}

// ═══ Relationship labels ═════════════════════════════════════════════════
export async function labelsManager(el, _, ctx) {
  const types = await lore.listRelTypes();
  if (!ctx.isCurrent()) return;
  el.innerHTML = `
    <div class="toolbar"><h1 class="display">${h(t('dev.labels'))}</h1></div>
    <p class="muted">${h(t('labels.help'))}</p>
    <form class="panel label-add" id="ladd">
      <label class="field"><span>English</span><input name="en" maxlength="60" required dir="ltr"></label>
      <label class="field"><span>العربية</span><input name="ar" maxlength="60" dir="rtl"></label>
      <button class="btn btn-primary">＋ ${h(t('labels.add'))}</button>
    </form>
    <ul class="admin-list">${types.map((ty, i) => `
      <li class="admin-row label-row" data-id="${h(ty.id)}">
        <input class="l-en" value="${h(ty.label_en)}" maxlength="60" dir="ltr" aria-label="English">
        <input class="l-ar" value="${h(ty.label_ar)}" maxlength="60" dir="rtl" aria-label="العربية">
        <div class="admin-actions">
          ${i > 0 ? '<button class="icon-btn" data-mv="-1">↑</button>' : ''}${i < types.length - 1 ? '<button class="icon-btn" data-mv="1">↓</button>' : ''}
          <button class="btn btn-small" data-save>${h(t('common.save'))}</button>
          <button class="btn btn-small btn-ghost btn-danger-text" data-del>${h(t('common.delete'))}</button>
        </div></li>`).join('')}</ul>`;
  const reload = () => labelsManager(el, _, ctx);
  $('#ladd', el).onsubmit = async e => {
    e.preventDefault();
    if (!e.target.en.value.trim()) return;
    try { await lore.saveRelType({ label_en: e.target.en.value, label_ar: e.target.ar.value, sort_order: types.length }); toast(t('dev.saved')); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  };
  $$('.label-row', el).forEach(li => {
    const ty = types.find(x => x.id === li.dataset.id);
    $('[data-save]', li).onclick = async () => {
      try { await lore.saveRelType({ ...ty, label_en: $('.l-en', li).value, label_ar: $('.l-ar', li).value }); toast(t('dev.saved')); reload(); }
      catch (err) { toast(errMsg(err), 'error'); }
    };
    $('[data-del]', li).onclick = async () => {
      if (!await confirmDialog(t('dev.confirmDeleteGeneric', { name: ty.label_en }))) return;
      try { await lore.deleteRelType(ty.id); toast(t('dev.deleted')); reload(); }
      catch (err) { toast(/foreign key|23503|violates/i.test(err.message + err.code) ? t('labels.inUse') : errMsg(err), 'error'); }
    };
    $$('[data-mv]', li).forEach(b => b.onclick = async () => {
      const i = types.indexOf(ty), j = i + +b.dataset.mv; const other = types[j];
      try {
        await lore.saveRelType({ ...ty, sort_order: j }); await lore.saveRelType({ ...other, sort_order: i }); reload();
      } catch (err) { toast(errMsg(err), 'error'); }
    });
  });
}

export async function loreOverviewTiles() {
  const s = await lore.loreStats();
  return { ...s, lang: getLang() };
}
