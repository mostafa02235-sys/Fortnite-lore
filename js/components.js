// Reusable form widgets for the developer dashboard.
import { t, getLang } from './i18n.js';
import { h, $, $$, toast } from './util.js';
import { hydrateMedia, uploadImage, validateImage } from './media.js';
import { createEditor } from './editor.js';

const imgTag = (it, alt = '') => it?._url ? `<img src="${h(it._url)}" alt="${h(alt)}" class="loaded">`
  : it?.storage_path ? `<img data-path="${h(it.storage_path)}" alt="${h(alt)}">` : '';

/** Single image (logo, cover, event image). */
export function imageField(mount, { path = null, hint = '' } = {}) {
  const st = { path, file: null, url: null, removed: false };
  const draw = () => {
    const has = st.url || (st.path && !st.removed);
    mount.innerHTML = `
      <label class="drop drop-compact">
        <div class="drop-preview">${has ? imgTag(st.url ? { _url: st.url } : { storage_path: st.path }) : `<span>${h(hint || t('dev.dropHint'))}</span>`}</div>
        <input type="file" accept="image/*" hidden>
        <span class="row-wrap"><span class="btn btn-small">${h(t(has ? 'dev.replace' : 'dev.chooseFile'))}</span>
        ${has ? `<button type="button" class="btn btn-small btn-ghost btn-danger-text" data-rm>${h(t('common.remove'))}</button>` : ''}</span>
      </label>`;
    hydrateMedia(mount);
    $('input', mount).onchange = e => set(e.target.files[0]);
    const rm = $('[data-rm]', mount);
    if (rm) rm.onclick = ev => { ev.preventDefault(); st.file = null; st.url = null; st.removed = true; mount.dispatchEvent(new Event('input', { bubbles: true })); draw(); };
    const drop = $('.drop', mount);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); set(e.dataTransfer.files[0]); };
  };
  const set = f => {
    if (!f) return;
    const bad = validateImage(f); if (bad) return toast(bad, 'error');
    st.file = f; st.url = URL.createObjectURL(f); st.removed = false;
    mount.dispatchEvent(new Event('input', { bubbles: true })); draw();
  };
  draw();
  return {
    get previewUrl() { return st.url; },
    get path() { return st.removed ? null : st.path; },
    /** Upload if needed; returns { path, old } where old is a file to delete after saving. */
    async commit(folder) {
      if (st.file) { const p = await uploadImage(st.file, folder); return { path: p, old: st.path, uploaded: p }; }
      if (st.removed) return { path: null, old: st.path };
      return { path: st.path, old: null };
    },
    previewItem() { return st.url ? { _url: st.url } : (st.path && !st.removed ? { storage_path: st.path } : null); },
  };
}

/** List of images, each with a name and a story (group / season galleries). */
export function galleryEditor(mount, initial = []) {
  let items = initial.map(i => ({ ...i }));
  const snap = () => items.forEach(it => { if (it._ed) { it.image_story = it._ed.getHtml(); it._ed = null; } });
  const draw = () => {
    mount.innerHTML = `<div class="panel-head"><span></span><label class="btn btn-small">＋ ${h(t('dev.addImage'))}<input type="file" accept="image/*" multiple hidden></label></div>
      <div class="img-items">${items.length ? '' : `<p class="muted small empty-inline">${h(t('dev.noImages'))}</p>`}</div>`;
    const list = $('.img-items', mount);
    items.forEach((it, i) => {
      const card = document.createElement('div');
      card.className = 'img-item';
      card.innerHTML = `
        <div class="img-item-media">${imgTag(it, it.image_name)}</div>
        <div class="img-item-fields">
          <label class="field"><span>${h(t('dev.imageName'))}</span><input class="i-name" maxlength="200" value="${h(it.image_name || '')}" dir="auto"></label>
          <div class="field"><span class="label">${h(t('dev.imageStory'))}</span><div class="i-story"></div></div>
          <div class="row-wrap">
            ${i > 0 ? '<button type="button" class="btn btn-small btn-ghost" data-mv="-1">↑</button>' : ''}
            ${i < items.length - 1 ? '<button type="button" class="btn btn-small btn-ghost" data-mv="1">↓</button>' : ''}
            <button type="button" class="btn btn-small btn-ghost btn-danger-text" data-rm>${h(t('common.remove'))}</button>
          </div>
        </div>`;
      list.appendChild(card);
      it._ed = createEditor($('.i-story', card), { html: it.image_story, compact: true, placeholder: t('dev.imageStoryPlaceholder') });
      $('.i-name', card).oninput = e => { it.image_name = e.target.value; };
      $('[data-rm]', card).onclick = () => { snap(); items.splice(i, 1); changed(); };
      $$('[data-mv]', card).forEach(b => b.onclick = () => { snap(); const j = i + +b.dataset.mv; [items[i], items[j]] = [items[j], items[i]]; changed(); });
    });
    $('input[type=file]', mount).onchange = e => {
      snap();
      for (const f of e.target.files) {
        const bad = validateImage(f); if (bad) { toast(`${f.name}: ${bad}`, 'error'); continue; }
        items.push({ file: f, _url: URL.createObjectURL(f), image_name: '', image_story: '' });
      }
      changed();
    };
    hydrateMedia(mount);
  };
  const changed = () => { mount.dispatchEvent(new Event('input', { bubbles: true })); draw(); };
  draw();
  return {
    /** Current items (stories read from the editors). */
    items() { return items.map(it => ({ ...it, image_story: it._ed ? it._ed.getHtml() : it.image_story, _ed: undefined })); },
    /** Upload new files; returns items ready for syncGallery plus uploaded paths. */
    async upload(folder) {
      const out = this.items(); const uploaded = [];
      for (const it of out) if (it.file) { it.storage_path = await uploadImage(it.file, folder); uploaded.push(it.storage_path); }
      return { items: out, uploaded };
    },
    /** After a successful save, adopt ids so a second save doesn't duplicate rows. */
    adopt(saved) { snap(); items = saved.map(s => ({ ...s, file: undefined, _url: s._url })); draw(); },
  };
}

/**
 * Searchable many-to-many picker.
 * options: [{id, label, sub?}]; selected: [{id, note?}]
 */
export function linkPicker(mount, { options, selected = [], withNote = false, notePlaceholder = '', ordered = true }) {
  let rows = selected.filter(s => options.some(o => o.id === s.id)).map(s => ({ ...s }));
  const label = id => options.find(o => o.id === id);
  const draw = () => {
    mount.innerHTML = `
      <div class="picker">
        <input type="search" class="picker-q" placeholder="${h(t('dev.searchToAdd'))}" dir="auto" autocomplete="off">
        <div class="picker-results" hidden></div>
      </div>
      <ul class="link-rows">${rows.map((r, i) => {
        const o = label(r.id);
        return `<li class="link-row" data-i="${i}">
          <div class="link-main"><strong dir="auto">${h(o?.label || '?')}</strong>${o?.sub ? `<small class="muted" dir="auto">${h(o.sub)}</small>` : ''}</div>
          ${withNote ? `<input class="link-note" maxlength="500" placeholder="${h(notePlaceholder || t('dev.notePh'))}" value="${h(r.note || '')}" dir="auto">` : ''}
          <div class="link-actions">
            ${ordered && i > 0 ? '<button type="button" class="icon-btn" data-mv="-1" aria-label="↑">↑</button>' : ''}
            ${ordered && i < rows.length - 1 ? '<button type="button" class="icon-btn" data-mv="1" aria-label="↓">↓</button>' : ''}
            <button type="button" class="icon-btn btn-danger-text" data-rm aria-label="${h(t('common.remove'))}">✕</button>
          </div></li>`;
      }).join('')}</ul>
      ${rows.length ? '' : `<p class="muted small empty-inline">${h(t('dev.noneLinked'))}</p>`}`;
    const q = $('.picker-q', mount), res = $('.picker-results', mount);
    const show = () => {
      const s = q.value.trim().toLowerCase();
      const avail = options.filter(o => !rows.some(r => r.id === o.id) && (!s || o.label.toLowerCase().includes(s))).slice(0, 8);
      res.hidden = !avail.length && !s;
      res.innerHTML = avail.length ? avail.map(o => `<button type="button" class="picker-opt" data-id="${h(o.id)}"><span dir="auto">${h(o.label)}</span>${o.sub ? `<small class="muted" dir="auto">${h(o.sub)}</small>` : ''}</button>`).join('')
        : `<p class="muted small" style="padding:8px 12px;margin:0">${h(t('dev.noMatches'))}</p>`;
    };
    q.onfocus = show; q.oninput = show;
    q.onblur = () => setTimeout(() => { res.hidden = true; }, 150);
    res.onmousedown = e => e.preventDefault();
    res.onclick = e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      sync(); rows.push({ id: b.dataset.id, note: '' }); changed(); $('.picker-q', mount).focus();
    };
    $$('.link-row', mount).forEach(li => {
      const i = +li.dataset.i;
      $('[data-rm]', li).onclick = () => { sync(); rows.splice(i, 1); changed(); };
      $$('[data-mv]', li).forEach(b => b.onclick = () => { sync(); const j = i + +b.dataset.mv; [rows[i], rows[j]] = [rows[j], rows[i]]; changed(); });
    });
  };
  const sync = () => $$('.link-row', mount).forEach(li => { const n = $('.link-note', li); if (n) rows[+li.dataset.i].note = n.value; });
  const changed = () => { mount.dispatchEvent(new Event('input', { bubbles: true })); draw(); };
  draw();
  return { value() { sync(); return rows.map(r => ({ ...r })); }, ids() { return rows.map(r => r.id); } };
}

/**
 * Group ↔ character relationships with configurable labels.
 * side: 'group' (pick characters) or 'character' (pick groups).
 */
export function relationshipEditor(mount, { targets, types, rows = [], side }) {
  const key = side === 'group' ? 'character_id' : 'group_id';
  let list = rows.map(r => ({ target: r[key], type: r.relationship_type_id, note: r.note || '' }));
  const typeLabel = ty => (getLang() === 'ar' && ty.label_ar) ? ty.label_ar : ty.label_en;
  const defaultType = (types.find(ty => ty.label_en.toLowerCase() === 'member') || types[0])?.id;
  const draw = () => {
    mount.innerHTML = `
      <ul class="rel-rows">${list.map((r, i) => `
        <li class="rel-row" data-i="${i}">
          <select class="rel-target" aria-label="${h(t(side === 'group' ? 'nav.characters' : 'nav.groups'))}">
            <option value="">—</option>
            ${targets.map(o => `<option value="${h(o.id)}" ${o.id === r.target ? 'selected' : ''}>${h(o.label)}</option>`).join('')}
          </select>
          <select class="rel-type" aria-label="${h(t('groups.relationship'))}">
            ${types.map(ty => `<option value="${h(ty.id)}" ${ty.id === r.type ? 'selected' : ''}>${h(typeLabel(ty))}</option>`).join('')}
          </select>
          <input class="rel-note" maxlength="500" value="${h(r.note)}" placeholder="${h(t('dev.notePh'))}" dir="auto">
          <button type="button" class="icon-btn btn-danger-text" data-rm aria-label="${h(t('common.remove'))}">✕</button>
        </li>`).join('')}</ul>
      ${list.length ? '' : `<p class="muted small empty-inline">${h(t('dev.noneLinked'))}</p>`}
      <button type="button" class="btn btn-small" data-add>＋ ${h(t(side === 'group' ? 'groups.addMember' : 'groups.addToGroup'))}</button>`;
    $$('.rel-row', mount).forEach(li => {
      const i = +li.dataset.i;
      $('.rel-target', li).onchange = e => { list[i].target = e.target.value; };
      $('.rel-type', li).onchange = e => { list[i].type = e.target.value; };
      $('.rel-note', li).oninput = e => { list[i].note = e.target.value; };
      $('[data-rm]', li).onclick = () => { list.splice(i, 1); changed(); };
    });
    $('[data-add]', mount).onclick = () => { list.push({ target: '', type: defaultType, note: '' }); changed(); setTimeout(() => $$('.rel-target', mount).at(-1)?.focus(), 0); };
  };
  const changed = () => { mount.dispatchEvent(new Event('input', { bubbles: true })); draw(); };
  draw();
  return {
    /** Valid rows only; duplicates (same target + label) collapsed. */
    value() {
      const seen = new Set(); const out = [];
      for (const r of list) {
        if (!r.target || !r.type) continue;
        const k = r.target + '|' + r.type; if (seen.has(k)) continue; seen.add(k);
        out.push({ [key]: r.target, relationship_type_id: r.type, note: r.note.trim() });
      }
      return out;
    },
  };
}

/** References & sources list. */
export function referencesEditor(mount, refs = []) {
  let list = refs.map(r => ({ ...r }));
  const draw = () => {
    mount.innerHTML = `
      <ul class="ref-rows">${list.map((r, i) => `
        <li class="ref-row" data-i="${i}">
          <input class="r-title" maxlength="300" value="${h(r.title || '')}" placeholder="${h(t('seasons.refTitle'))}" dir="auto">
          <input class="r-url" type="url" value="${h(r.url || '')}" placeholder="https://" dir="ltr">
          <input class="r-note" maxlength="1000" value="${h(r.note || '')}" placeholder="${h(t('dev.notePh'))}" dir="auto">
          <button type="button" class="icon-btn btn-danger-text" data-rm aria-label="${h(t('common.remove'))}">✕</button>
        </li>`).join('')}</ul>
      ${list.length ? '' : `<p class="muted small empty-inline">${h(t('seasons.noRefs'))}</p>`}
      <button type="button" class="btn btn-small" data-add>＋ ${h(t('seasons.addRef'))}</button>`;
    $$('.ref-row', mount).forEach(li => {
      const r = list[+li.dataset.i];
      $('.r-title', li).oninput = e => { r.title = e.target.value; };
      $('.r-url', li).oninput = e => { r.url = e.target.value; };
      $('.r-note', li).oninput = e => { r.note = e.target.value; };
      $('[data-rm]', li).onclick = () => { list.splice(+li.dataset.i, 1); changed(); };
    });
    $('[data-add]', mount).onclick = () => { list.push({ title: '', url: '', note: '' }); changed(); setTimeout(() => $$('.r-title', mount).at(-1)?.focus(), 0); };
  };
  const changed = () => { mount.dispatchEvent(new Event('input', { bubbles: true })); draw(); };
  draw();
  return {
    value() { return list.filter(r => (r.title || '').trim()); },
    invalid() { return list.find(r => (r.title || '').trim() && r.url && !/^https?:\/\//i.test(r.url.trim())); },
  };
}

/** Standard sticky action bar for editors. */
export function actionBar({ isNew, published }) {
  return `<div class="action-bar">
    ${!isNew ? `<button type="button" class="btn btn-ghost btn-danger-text" data-a="delete">${h(t('common.delete'))}</button>` : ''}
    <span class="spacer"></span>
    <button type="button" class="btn" data-a="preview">${h(t('dev.preview'))}</button>
    <button type="button" class="btn" data-a="save">${h(t(published ? 'dev.saveChanges' : 'dev.saveDraft'))}</button>
    <button type="button" class="btn btn-primary" data-a="toggle">${h(t(published ? 'dev.unpublish' : 'dev.publish'))}</button>
  </div>`;
}

export const seasonLabel = s => {
  if (!s) return '';
  const parts = [];
  if (s.chapter_number != null) parts.push(t('seasons.chapterN', { n: s.chapter_number }));
  if (s.season_number != null) parts.push(t('seasons.seasonN', { n: s.season_number }));
  return parts.join(' · ');
};
