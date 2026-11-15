// Developer dashboard. Only rendered for users whose role (read from the
// database) is developer/admin — and every change below is re-checked by
// Row Level Security on the server, so hiding/showing UI is not the guard.
import { t } from '../i18n.js';
import { h, $, $$, toast, errMsg, confirmDialog, modal, fmtDate, statusBadge, hasContent, debounce, excerpt, textToHtml } from '../util.js';
import { hydrateMedia, uploadImage, removeFiles, validateImage } from '../media.js';
import { createEditor } from '../editor.js';
import * as api from '../api.js';
import { state } from '../state.js';
import { go } from '../app.js';
import { coverOf, imgAttrs, renderCharacterProfile, renderImageDetail } from './public.js';
import * as lore from '../api-lore.js';
import { relationshipEditor } from '../components.js';
import * as dl from './dev-lore.js';

const TABS = [
  ['', 'dev.overview'], ['characters', 'dev.characters'], ['groups', 'dev.groups'], ['seasons', 'dev.seasons'],
  ['images', 'dev.images'], ['mysteries', 'dev.mysteries'], ['labels', 'dev.labels'],
];

let leaveGuard = null;
window.addEventListener('beforeunload', e => { if (leaveGuard?.() || dl.leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });

export async function dashboard(main, sub = '', ctx) {
  leaveGuard = null; dl.resetGuard();
  const [section, id] = (sub || '').split('/');
  if (section === 'teams') { go('dev/groups'); return; } // Teams were upgraded to Groups
  const tabs = state.isAdmin ? [...TABS, ['access', 'dev.access']] : TABS;
  const activeTab = { character: 'characters', image: 'images', group: 'groups', season: 'seasons', event: 'seasons', mystery: 'mysteries' }[section] ?? section;
  main.innerHTML = `
    <div class="dev">
      <header class="dev-head wrap">
        <p class="eyebrow">${h(t('dev.eyebrow'))}</p>
        <nav class="tabs" aria-label="${h(t('nav.dev'))}">
          ${tabs.map(([k, label]) => `<a href="#dev${k ? '/' + k : ''}" class="tab ${activeTab === k ? 'active' : ''}">${h(t(label))}</a>`).join('')}
        </nav>
      </header>
      <div class="wrap dev-body" id="dev-body"></div>
    </div>`;
  const body = $('#dev-body', main);
  const views = {
    '': overview, characters: charList, character: charEditor, images: imageList, image: imageEditor, access,
    groups: dl.groupList, group: dl.groupEditor, seasons: dl.seasonList, season: dl.seasonEditor, event: dl.eventEditor,
    mysteries: dl.mysteryList, mystery: dl.mysteryEditor, labels: dl.labelsManager,
  };
  const view = views[section];
  if (!view || (section === 'access' && !state.isAdmin)) { body.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  await view(body, id, ctx);
}

// ─── Overview ──────────────────────────────────────────────────────────
async function overview(el, _, ctx) {
  const [s, l] = await Promise.all([api.stats(), lore.loreStats()]);
  if (!ctx.isCurrent()) return;
  const tile = (n, label, sub) => `<div class="stat"><strong>${n}</strong><span>${h(label)}</span>${sub ? `<small>${h(sub)}</small>` : ''}</div>`;
  el.innerHTML = `
    <h1 class="display">${h(t('dev.title'))}</h1>
    <div class="stats">
      ${tile(s.chars, t('dev.characters'), t('dev.publishedOf', { n: s.charsPub }))}
      ${tile(s.imgs, t('dev.images'), t('dev.publishedOf', { n: s.imgsPub }))}
      ${tile(l.groups, t('dev.groups'), t('dev.publishedOf', { n: l.groupsPub }))}
      ${tile(l.seasons, t('dev.seasons'), t('dev.publishedOf', { n: l.seasonsPub }))}
      ${tile(l.events, t('seasons.events'))}
      ${tile(l.mysteries, t('dev.mysteries'))}
    </div>
    <div class="quick">
      <a class="btn btn-primary" href="#dev/character/new">＋ ${h(t('dev.newCharacter'))}</a>
      <a class="btn btn-primary" href="#dev/group/new">＋ ${h(t('dev.newGroup'))}</a>
      <a class="btn btn-primary" href="#dev/season/new">＋ ${h(t('dev.newSeason'))}</a>
      <a class="btn" href="#dev/image/new">＋ ${h(t('dev.newImage'))}</a>
      <a class="btn" href="#dev/mystery/new">＋ ${h(t('dev.newMystery'))}</a>
    </div>
    <p class="muted small">${h(t('dev.roleNote', { roles: state.roles.map(r => t('role.' + r)).join(', ') }))}</p>`;
}

// ─── Characters: list ──────────────────────────────────────────────────
async function charList(el, _, ctx) {
  el.innerHTML = `
    <div class="toolbar">
      <h1 class="display">${h(t('dev.characters'))}</h1>
      <a class="btn btn-primary" href="#dev/character/new">＋ ${h(t('dev.newCharacter'))}</a>
    </div>
    <form class="filters" id="dfilters">
      <input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto">
      <select name="pub" aria-label="${h(t('dev.visibility'))}">
        <option value="">${h(t('dev.allStates'))}</option><option value="1">${h(t('common.published'))}</option><option value="0">${h(t('common.draft'))}</option>
      </select>
    </form>
    <div id="rows"></div>`;
  const form = $('#dfilters', el);
  const run = async () => {
    let list = await api.listCharacters({ publishedOnly: false, search: form.q.value.trim() });
    if (!ctx.isCurrent()) return;
    if (form.pub.value) list = list.filter(c => c.is_published === (form.pub.value === '1'));
    const rows = $('#rows', el);
    rows.innerHTML = list.length ? `<ul class="admin-list">${list.map(c => {
      const cover = coverOf(c);
      return `<li class="admin-row" data-id="${h(c.id)}">
        <div class="thumb">${cover ? `<img ${imgAttrs(cover)}>` : ''}</div>
        <div class="admin-main">
          <a href="#dev/character/${h(c.id)}" class="admin-title" dir="auto">${h(c.name)}</a>
          <div class="row-wrap small">${statusBadge(c.status)}
            <span class="badge ${c.is_published ? 'badge-pub' : 'badge-draft'}">${h(t(c.is_published ? 'common.published' : 'common.draft'))}</span>
            <span class="muted">${h(fmtDate(c.updated_at))}</span></div>
        </div>
        <div class="admin-actions">
          <a class="btn btn-small" href="#dev/character/${h(c.id)}">${h(t('common.edit'))}</a>
          <button class="btn btn-small" data-act="pub">${h(t(c.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>
          <a class="btn btn-small btn-ghost" href="#character/${h(c.id)}">${h(t('common.view'))}</a>
          <button class="btn btn-small btn-ghost btn-danger-text" data-act="del">${h(t('common.delete'))}</button>
        </div></li>`;
    }).join('')}</ul>` : `<div class="empty"><p class="muted">${h(t('characters.empty'))}</p></div>`;
    hydrateMedia(rows);
    $$('[data-act]', rows).forEach(b => b.onclick = async () => {
      const id = b.closest('[data-id]').dataset.id;
      const c = list.find(x => x.id === id);
      b.disabled = true;
      try {
        if (b.dataset.act === 'pub') {
          await api.setCharacterPublished(id, !c.is_published);
          toast(t(c.is_published ? 'dev.unpublished' : 'dev.publishedOk'));
        } else if (await confirmDialog(t('dev.confirmDeleteChar', { name: c.name }))) {
          await api.deleteCharacter(id); toast(t('dev.deleted'));
        }
        await run();
      } catch (e) { toast(errMsg(e), 'error'); b.disabled = false; }
    });
  };
  form.addEventListener('input', debounce(run, 250));
  form.addEventListener('submit', e => e.preventDefault());
  await run();
}

// ─── Characters: editor ────────────────────────────────────────────────
async function charEditor(el, id, ctx) {
  const isNew = !id || id === 'new';
  const [c, groups, types, rels] = await Promise.all([
    isNew ? null : api.getCharacter(id), lore.listGroups({ publishedOnly: false }), lore.listRelTypes(),
    isNew ? [] : lore.characterGroups(id),
  ]);
  if (!ctx.isCurrent()) return;
  if (!isNew && !c) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = c ? structuredClone(c) : { name: '', story: '', status: 'unknown', team_id: null, is_published: false, images: [] };
  const original = c ? structuredClone(c.images) : [];
  let items = model.images.map(i => ({ ...i }));
  let dirty = false;
  leaveGuard = () => dirty;

  el.innerHTML = `
    <div class="toolbar">
      <div><a href="#dev/characters" class="muted small">← ${h(t('dev.characters'))}</a>
        <h1 class="display" dir="auto">${h(isNew ? t('dev.newCharacter') : model.name)}</h1></div>
      <span class="badge ${model.is_published ? 'badge-pub' : 'badge-draft'}" id="pub-badge">${h(t(model.is_published ? 'common.published' : 'common.draft'))}</span>
    </div>
    <form id="char-form" class="editor-form" novalidate>
      <section class="panel">
        <h2 class="kicker">${h(t('dev.basics'))}</h2>
        <label class="field"><span>${h(t('characters.name'))} <em class="req">*</em></span>
          <input name="name" required maxlength="200" value="${h(model.name)}" dir="auto" autocomplete="off"></label>
        <fieldset class="field">
          <legend>${h(t('characters.status'))}</legend>
          <div class="seg">${['alive', 'dead', 'unknown'].map(s => `
            <label><input type="radio" name="status" value="${s}" ${model.status === s ? 'checked' : ''}><span>${h(t('status.' + s))}</span></label>`).join('')}</div>
        </fieldset>
      </section>

      <section class="panel">
        <h2 class="kicker">${h(t('nav.groups'))}</h2>
        <p class="muted small">${h(t('groups.charHelp'))} <a href="#dev/group/new">＋ ${h(t('dev.newGroup'))}</a></p>
        <div id="char-groups"></div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2 class="kicker">${h(t('dev.charImages'))}</h2>
          <label class="btn btn-small">＋ ${h(t('dev.addImage'))}<input type="file" accept="image/*" multiple hidden id="add-img"></label></div>
        <p class="muted small">${h(t('dev.charImagesHelp'))}</p>
        <div id="img-items" class="img-items"></div>
      </section>

      <section class="panel">
        <h2 class="kicker">${h(t('characters.story'))} <em class="req">*</em></h2>
        <div id="story-ed"></div>
      </section>

      <div class="action-bar">
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-danger-text" data-a="delete">${h(t('common.delete'))}</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-a="preview">${h(t('dev.preview'))}</button>
        <button type="button" class="btn" data-a="save">${h(t(model.is_published ? 'dev.saveChanges' : 'dev.saveDraft'))}</button>
        <button type="button" class="btn btn-primary" data-a="toggle">${h(t(model.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>
      </div>
    </form>`;

  const form = $('#char-form', el);
  const story = createEditor($('#story-ed', el), { html: model.story, placeholder: t('dev.storyPlaceholder'), label: t('characters.story') });
  form.addEventListener('input', () => { dirty = true; });

  // Images
  const itemsEl = $('#img-items', el);
  const drawItems = () => {
    itemsEl.innerHTML = items.length ? '' : `<p class="muted small empty-inline">${h(t('dev.noImages'))}</p>`;
    items.forEach((it, i) => {
      const card = document.createElement('div');
      card.className = 'img-item';
      card.innerHTML = `
        <div class="img-item-media">
          <img ${imgAttrs(it, it.image_name)}>
          <label class="cover-pick"><input type="radio" name="cover" ${it.is_primary ? 'checked' : ''}> ${h(t('dev.cover'))}</label>
        </div>
        <div class="img-item-fields">
          <label class="field"><span>${h(t('dev.imageName'))}</span><input class="i-name" maxlength="200" value="${h(it.image_name || '')}" dir="auto"></label>
          <div class="field"><span class="label">${h(t('dev.imageStory'))}</span><div class="i-story"></div></div>
          <div class="row-wrap">
            <label class="btn btn-small">${h(t('dev.replace'))}<input type="file" accept="image/*" hidden class="i-replace"></label>
            ${i > 0 ? `<button type="button" class="btn btn-small btn-ghost" data-move="-1">↑</button>` : ''}
            ${i < items.length - 1 ? `<button type="button" class="btn btn-small btn-ghost" data-move="1">↓</button>` : ''}
            <button type="button" class="btn btn-small btn-ghost btn-danger-text i-remove">${h(t('common.remove'))}</button>
          </div>
        </div>`;
      itemsEl.appendChild(card);
      it._editor = createEditor($('.i-story', card), { html: it._editor ? it._editor.getHtml() : it.image_story, compact: true, placeholder: t('dev.imageStoryPlaceholder') });
      $('.i-name', card).oninput = e => { it.image_name = e.target.value; dirty = true; };
      $('input[name=cover]', card).onchange = () => { items.forEach(x => x.is_primary = x === it); dirty = true; };
      $('.i-replace', card).onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const bad = validateImage(f); if (bad) return toast(bad, 'error');
        snapshotStories(); it.file = f; it._url = URL.createObjectURL(f); dirty = true; drawItems();
      };
      $('.i-remove', card).onclick = () => {
        snapshotStories(); items.splice(i, 1);
        if (items.length && !items.some(x => x.is_primary)) items[0].is_primary = true;
        dirty = true; drawItems();
      };
      $$('[data-move]', card).forEach(b => b.onclick = () => {
        snapshotStories(); const j = i + +b.dataset.move;
        [items[i], items[j]] = [items[j], items[i]]; dirty = true; drawItems();
      });
    });
    hydrateMedia(itemsEl);
  };
  const snapshotStories = () => items.forEach(it => { if (it._editor) { it.image_story = it._editor.getHtml(); it._editor = null; } });
  $('#add-img', el).onchange = e => {
    snapshotStories();
    for (const f of e.target.files) {
      const bad = validateImage(f); if (bad) { toast(`${f.name}: ${bad}`, 'error'); continue; }
      items.push({ file: f, _url: URL.createObjectURL(f), image_name: '', image_story: '', is_primary: !items.length });
    }
    e.target.value = ''; dirty = true; drawItems();
  };
  drawItems();

  // Groups / factions: many-to-many with configurable relationship labels.
  const relEd = relationshipEditor($('#char-groups', el), {
    side: 'character', types, rows: rels,
    targets: groups.map(g => ({ id: g.id, label: g.name + (g.is_published ? '' : ` (${t('common.draft')})`) })),
  });

  const collect = () => {
    snapshotStories(); drawItems();
    return {
      // team_id is deprecated (kept untouched for data preservation)
      id: model.id, name: form.name.value, status: form.status.value, team_id: model.team_id || null,
      story: story.getHtml(),
    };
  };
  const collectImages = () => items.map(it => ({ ...it, image_story: it._editor ? it._editor.getHtml() : it.image_story }));

  const save = async publish => {
    const data = collect();
    if (!data.name.trim()) { form.name.focus(); return toast(t('dev.nameRequired'), 'error'); }
    const target = publish ?? model.is_published;
    if (target && !hasContent(data.story)) { story.focus(); return toast(t('error.storyRequired'), 'error'); }
    setBusy(true);
    const uploaded = [];
    try {
      // 1) row (new characters stay drafts until images are in place)
      const row = await api.saveCharacter({ ...data, is_published: model.id ? model.is_published && target : false });
      model.id = row.id;
      // 2) files → Storage, metadata → character_images
      const imgs = collectImages();
      for (const it of imgs) {
        if (it.file) { it.storage_path = await uploadImage(it.file, `characters/${row.id}`); uploaded.push(it.storage_path); }
      }
      await api.syncCharacterImages(row.id, imgs, original);
      await lore.syncRelationships({ characterId: row.id }, relEd.value());
      // 3) publish state
      if (target !== row.is_published) await api.setCharacterPublished(row.id, target);
      dirty = false;
      toast(t(publish === true ? 'dev.publishedOk' : publish === false ? 'dev.unpublished' : 'dev.saved'));
      if (isNew) go(`dev/character/${row.id}`); else go(`dev/character/${row.id}`);
    } catch (e) {
      // Remove files uploaded in this attempt that no row points to.
      if (uploaded.length) await removeFiles(uploaded).catch(() => {});
      toast(errMsg(e), 'error');
    } finally { setBusy(false); }
  };
  const setBusy = b => $$('.action-bar button', el).forEach(x => x.disabled = b);

  $('.action-bar', el).onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') return save();
    if (a === 'toggle') return save(!model.is_published);
    if (a === 'preview') {
      const data = collect();
      const box = document.createElement('div');
      const groupRows = relEd.value().map(r => ({ note: r.note, type: types.find(ty => ty.id === r.relationship_type_id), group: groups.find(g => g.id === r.group_id) })).filter(r => r.group);
      renderCharacterProfile(box, {
        ...data, is_published: false, groups: groupRows, updated_at: new Date().toISOString(),
        images: collectImages().map(it => ({ ...it, _editor: undefined })),
      }, { preview: true });
      return modal({ title: t('dev.preview'), body: box, wide: true, className: 'modal-full' });
    }
    if (a === 'delete' && await confirmDialog(t('dev.confirmDeleteChar', { name: model.name }))) {
      try { await api.deleteCharacter(model.id); dirty = false; toast(t('dev.deleted')); go('dev/characters'); }
      catch (err) { toast(errMsg(err), 'error'); }
    }
  };
}

// ─── Image archive: list ───────────────────────────────────────────────
async function imageList(el, _, ctx) {
  el.innerHTML = `
    <div class="toolbar"><h1 class="display">${h(t('dev.images'))}</h1>
      <a class="btn btn-primary" href="#dev/image/new">＋ ${h(t('dev.newImage'))}</a></div>
    <form class="filters" id="dfilters"><input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto"></form>
    <div id="rows"></div>`;
  const form = $('#dfilters', el);
  const run = async () => {
    const list = await api.listArchive({ publishedOnly: false, search: form.q.value.trim() });
    if (!ctx.isCurrent()) return;
    const rows = $('#rows', el);
    rows.innerHTML = list.length ? `<ul class="admin-list">${list.map(r => `
      <li class="admin-row" data-id="${h(r.id)}">
        <div class="thumb thumb-wide"><img ${imgAttrs(r)}></div>
        <div class="admin-main">
          <a href="#dev/image/${h(r.id)}" class="admin-title" dir="auto">${h(r.image_name)}</a>
          <div class="row-wrap small">
            <span class="badge ${r.is_published ? 'badge-pub' : 'badge-draft'}">${h(t(r.is_published ? 'common.published' : 'common.draft'))}</span>
            <span class="muted" dir="auto">${h([r.chapter, r.event_name, r.character?.name].filter(Boolean).join(' · '))}</span>
            <span class="muted">${h(fmtDate(r.uploaded_at))}</span></div>
        </div>
        <div class="admin-actions">
          <a class="btn btn-small" href="#dev/image/${h(r.id)}">${h(t('common.edit'))}</a>
          <button class="btn btn-small" data-act="pub">${h(t(r.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>
          <a class="btn btn-small btn-ghost" href="#image/${h(r.id)}">${h(t('common.view'))}</a>
          <button class="btn btn-small btn-ghost btn-danger-text" data-act="del">${h(t('common.delete'))}</button>
        </div></li>`).join('')}</ul>` : `<div class="empty"><p class="muted">${h(t('images.empty'))}</p></div>`;
    hydrateMedia(rows);
    $$('[data-act]', rows).forEach(b => b.onclick = async () => {
      const r = list.find(x => x.id === b.closest('[data-id]').dataset.id);
      b.disabled = true;
      try {
        if (b.dataset.act === 'pub') { await api.setArchivePublished(r.id, !r.is_published); toast(t(r.is_published ? 'dev.unpublished' : 'dev.publishedOk')); }
        else if (await confirmDialog(t('dev.confirmDeleteImage', { name: r.image_name }))) { await api.deleteArchive(r.id); toast(t('dev.deleted')); }
        await run();
      } catch (e) { toast(errMsg(e), 'error'); b.disabled = false; }
    });
  };
  form.addEventListener('input', debounce(run, 250));
  form.addEventListener('submit', e => e.preventDefault());
  await run();
}

// ─── Image archive: editor ─────────────────────────────────────────────
async function imageEditor(el, id, ctx) {
  const isNew = !id || id === 'new';
  const [rec, chars, facets, seasons] = await Promise.all([
    isNew ? null : api.getArchive(id), api.listCharacters({ publishedOnly: false }), api.archiveFacets(), lore.listSeasons({ publishedOnly: false }),
  ]);
  if (!ctx.isCurrent()) return;
  if (!isNew && !rec) { el.innerHTML = `<p>${h(t('error.notFound'))}</p>`; return; }
  const model = rec ? { ...rec } : { image_name: '', story: '', chapter: '', event_name: '', character_id: null, season_id: null, is_published: false };
  let file = null; let dirty = false;
  leaveGuard = () => dirty;

  el.innerHTML = `
    <div class="toolbar">
      <div><a href="#dev/images" class="muted small">← ${h(t('dev.images'))}</a>
        <h1 class="display" dir="auto">${h(isNew ? t('dev.newImage') : model.image_name)}</h1></div>
      <span class="badge ${model.is_published ? 'badge-pub' : 'badge-draft'}">${h(t(model.is_published ? 'common.published' : 'common.draft'))}</span>
    </div>
    <form id="img-form" class="editor-form" novalidate>
      <section class="panel">
        <h2 class="kicker">${h(t('images.file'))} <em class="req">*</em></h2>
        <label class="drop" id="drop">
          <div class="drop-preview">${model.storage_path ? `<img ${imgAttrs(model)}>` : `<span>${h(t('dev.dropHint'))}</span>`}</div>
          <input type="file" accept="image/*" hidden name="file">
          <span class="btn btn-small">${h(t(model.storage_path ? 'dev.replace' : 'dev.chooseFile'))}</span>
        </label>
        ${!isNew ? `<p class="muted small">${h(t('images.uploaded'))}: ${h(fmtDate(model.uploaded_at))}</p>` : ''}
      </section>
      <section class="panel">
        <h2 class="kicker">${h(t('dev.details'))}</h2>
        <label class="field"><span>${h(t('dev.imageName'))} <em class="req">*</em></span>
          <input name="image_name" maxlength="200" required value="${h(model.image_name)}" dir="auto"></label>
        <div class="grid-2">
          <label class="field"><span>${h(t('images.chapter'))}</span>
            <input name="chapter" maxlength="100" list="dl-chapters" value="${h(model.chapter || '')}" dir="auto" placeholder="${h(t('images.chapterPh'))}"></label>
          <label class="field"><span>${h(t('images.event'))}</span>
            <input name="event_name" maxlength="200" list="dl-events" value="${h(model.event_name || '')}" dir="auto" placeholder="${h(t('images.eventPh'))}"></label>
        </div>
        <datalist id="dl-chapters">${facets.chapters.map(c => `<option value="${h(c)}">`).join('')}</datalist>
        <datalist id="dl-events">${facets.events.map(c => `<option value="${h(c)}">`).join('')}</datalist>
        <label class="field"><span>${h(t('images.character'))}</span>
          <select name="character_id"><option value="">${h(t('images.noCharacter'))}</option>
            ${chars.map(c => `<option value="${h(c.id)}" ${model.character_id === c.id ? 'selected' : ''}>${h(c.name)}${c.is_published ? '' : ' (' + h(t('common.draft')) + ')'}</option>`).join('')}
          </select></label>
        <label class="field"><span>${h(t('images.season'))}</span>
          <select name="season_id"><option value="">${h(t('images.noCharacter'))}</option>
            ${seasons.map(x => `<option value="${h(x.id)}" ${model.season_id === x.id ? 'selected' : ''}>${h(x.name)}</option>`).join('')}
          </select></label>
      </section>
      <section class="panel">
        <h2 class="kicker">${h(t('images.story'))}</h2>
        <div id="story-ed"></div>
      </section>
      <div class="action-bar">
        ${!isNew ? `<button type="button" class="btn btn-ghost btn-danger-text" data-a="delete">${h(t('common.delete'))}</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-a="preview">${h(t('dev.preview'))}</button>
        <button type="button" class="btn" data-a="save">${h(t(model.is_published ? 'dev.saveChanges' : 'dev.saveDraft'))}</button>
        <button type="button" class="btn btn-primary" data-a="toggle">${h(t(model.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>
      </div>
    </form>`;
  hydrateMedia(el);
  const form = $('#img-form', el);
  const story = createEditor($('#story-ed', el), { html: model.story, placeholder: t('dev.storyPlaceholder'), label: t('images.story') });
  form.addEventListener('input', () => { dirty = true; });

  const setFile = f => {
    const bad = validateImage(f); if (bad) return toast(bad, 'error');
    file = f; dirty = true;
    $('.drop-preview', el).innerHTML = `<img src="${URL.createObjectURL(f)}" alt="" class="loaded">`;
  };
  form.file.onchange = e => e.target.files[0] && setFile(e.target.files[0]);
  const drop = $('#drop', el);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && setFile(e.dataTransfer.files[0]); });

  const collect = () => ({
    id: model.id, image_name: form.image_name.value, chapter: form.chapter.value, event_name: form.event_name.value,
    character_id: form.character_id.value || null, season_id: form.season_id.value || null, story: story.getHtml(), storage_path: model.storage_path,
  });
  const setBusy = b => $$('.action-bar button', el).forEach(x => x.disabled = b);

  const save = async publish => {
    const data = collect();
    if (!file && !data.storage_path) return toast(t('media.noFile'), 'error');
    if (!data.image_name.trim()) { form.image_name.focus(); return toast(t('dev.nameRequired'), 'error'); }
    const target = publish ?? model.is_published;
    setBusy(true);
    let newPath = null;
    try {
      if (file) { newPath = await uploadImage(file, 'archive'); data.storage_path = newPath; }
      const row = await api.saveArchive({ ...data, is_published: target });
      if (newPath && model.storage_path && model.storage_path !== newPath) await removeFiles([model.storage_path]);
      dirty = false;
      toast(t(publish === true ? 'dev.publishedOk' : publish === false ? 'dev.unpublished' : 'dev.saved'));
      go(`dev/image/${row.id}`);
    } catch (e) {
      if (newPath) await removeFiles([newPath]).catch(() => {});
      toast(errMsg(e), 'error');
    } finally { setBusy(false); }
  };

  $('.action-bar', el).onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') return save();
    if (a === 'toggle') return save(!model.is_published);
    if (a === 'preview') {
      const d = collect();
      if (!file && !d.storage_path) return toast(t('media.noFile'), 'error');
      const box = document.createElement('div');
      renderImageDetail(box, {
        ...d, is_published: false, uploaded_at: model.uploaded_at,
        _url: file ? URL.createObjectURL(file) : null,
        character: chars.find(c => c.id === d.character_id) || null,
        season: seasons.find(x => x.id === d.season_id) || null,
      }, { preview: true });
      return modal({ title: t('dev.preview'), body: box, wide: true, className: 'modal-full' });
    }
    if (a === 'delete' && await confirmDialog(t('dev.confirmDeleteImage', { name: model.image_name }))) {
      try { await api.deleteArchive(model.id); dirty = false; toast(t('dev.deleted')); go('dev/images'); }
      catch (err) { toast(errMsg(err), 'error'); }
    }
  };
}

// ─── Access (admins) ───────────────────────────────────────────────────
async function access(el, _, ctx) {
  const staff = await api.listStaff();
  if (!ctx.isCurrent()) return;
  el.innerHTML = `
    <h1 class="display">${h(t('dev.access'))}</h1>
    <p class="muted">${h(t('access.help'))}</p>
    <form class="panel grant" id="grant">
      <label class="field"><span>${h(t('auth.email'))}</span><input type="email" name="email" required dir="ltr"></label>
      <label class="field"><span>${h(t('access.role'))}</span><select name="role">
        <option value="developer">${h(t('role.developer'))}</option><option value="admin">${h(t('role.admin'))}</option></select></label>
      <button class="btn btn-primary">${h(t('access.grant'))}</button>
    </form>
    <ul class="admin-list">${staff.map(s => `
      <li class="admin-row" data-u="${h(s.user_id)}" data-r="${h(s.role)}">
        <div class="admin-main"><span class="admin-title" dir="ltr">${h(s.email)}</span>
          <div class="row-wrap small"><span class="badge">${h(t('role.' + s.role))}</span><span class="muted">${h(fmtDate(s.granted_at))}</span></div></div>
        <div class="admin-actions">${s.user_id === state.user.id && s.role === 'admin' ? '' :
          `<button class="btn btn-small btn-ghost btn-danger-text" data-revoke>${h(t('access.revoke'))}</button>`}</div>
      </li>`).join('')}</ul>`;
  $('#grant', el).onsubmit = async e => {
    e.preventDefault();
    try { await api.grantRole(e.target.email.value.trim(), e.target.role.value); toast(t('dev.saved')); access(el, _, ctx); }
    catch (ex) { toast(errMsg(ex), 'error'); }
  };
  $$('[data-revoke]', el).forEach(b => b.onclick = async () => {
    const row = b.closest('[data-u]');
    if (!await confirmDialog(t('access.confirmRevoke'), { ok: t('access.revoke') })) return;
    try { await api.revokeRole(row.dataset.u, row.dataset.r); toast(t('dev.saved')); access(el, _, ctx); }
    catch (ex) { toast(errMsg(ex), 'error'); }
  });
}
