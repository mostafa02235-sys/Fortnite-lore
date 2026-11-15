// Developer dashboard hub: overview, stories, timeline and publishing views.
import { t } from '../i18n.js';
import { h, $, $$, toast, errMsg, fmtDate, wordCount, debounce, modal } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as api from '../api.js';
import * as lore from '../api-lore.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { seasonLabel } from '../components.js';
import { timelineManager } from './dev-lore.js';
import * as homeApi from '../api-home.js';
import { renderShowcase } from './showcase.js';
import { mountCountdown } from './countdown.js';
import { teamEmblem } from './onboarding.js';

export const TYPES = {
  character: { icon: 'user', label: 'nav.characters', edit: id => `#dev/character/${id}`, view: id => `#character/${id}`, publish: api.setCharacterPublished },
  group: { icon: 'shield', label: 'nav.groups', edit: id => `#dev/group/${id}`, view: id => `#group/${id}`, publish: lore.setGroupPublished },
  season: { icon: 'calendar', label: 'nav.seasons', edit: id => `#dev/season/${id}`, view: id => `#season/${id}`, publish: lore.setSeasonPublished },
  mystery: { icon: 'help', label: 'nav.mysteries', edit: id => `#dev/mystery/${id}`, view: id => `#mystery/${id}`, publish: lore.setMysteryPublished },
  image: { icon: 'image', label: 'nav.images', edit: id => `#dev/image/${id}`, view: id => `#image/${id}`, publish: api.setArchivePublished },
};
const pubBadge = p => `<span class="badge ${p ? 'badge-pub' : 'badge-draft'}">${h(t(p ? 'common.published' : 'common.draft'))}</span>`;
const typeTag = ty => `<span class="type-tag">${icon(TYPES[ty].icon, 14)} ${h(t(TYPES[ty].label))}</span>`;

// ─── Overview ──────────────────────────────────────────────────────────
export async function overview(el, _, ctx) {
  const [s, l, inv] = await Promise.all([api.stats(), lore.loreStats(), lore.contentInventory()]);
  if (!ctx.isCurrent()) return;
  const tile = (ic, n, label, sub, href) => `<a class="stat" href="${href}"><span class="stat-ico">${icon(ic)}</span><strong>${n}</strong><span>${h(label)}</span>${sub ? `<small>${h(sub)}</small>` : ''}</a>`;
  const drafts = inv.filter(i => !i.is_published).slice(0, 6);
  const recent = inv.slice(0, 6);
  const row = i => `<li><a href="${TYPES[i.type].edit(i.id)}" class="mini-row">${typeTag(i.type)}<strong dir="auto">${h(i.title)}</strong>${pubBadge(i.is_published)}<span class="muted small">${h(fmtDate(i.updated_at))}</span></a></li>`;
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.title'))}</h1><p class="muted">${h(t('dev.overviewLead'))}</p></div></div>
    <div class="stats">
      ${tile('user', s.chars, t('dev.characters'), t('dev.publishedOf', { n: s.charsPub }), '#dev/characters')}
      ${tile('shield', l.groups, t('dev.groups'), t('dev.publishedOf', { n: l.groupsPub }), '#dev/groups')}
      ${tile('calendar', l.seasons, t('dev.seasons'), t('dev.publishedOf', { n: l.seasonsPub }), '#dev/seasons')}
      ${tile('clock', l.events, t('seasons.events'), '', '#dev/timeline')}
      ${tile('image', s.imgs, t('dev.images'), t('dev.publishedOf', { n: s.imgsPub }), '#dev/images')}
      ${tile('help', l.mysteries, t('dev.mysteries'), '', '#dev/mysteries')}
    </div>
    <section class="panel">
      <h2 class="kicker">${h(t('dev.quickCreate'))}</h2>
      <div class="quick">
        <a class="quick-btn" href="#dev/character/new">${icon('user')}<span>${h(t('dev.newCharacter'))}</span></a>
        <a class="quick-btn" href="#dev/group/new">${icon('shield')}<span>${h(t('dev.newGroup'))}</span></a>
        <a class="quick-btn" href="#dev/season/new">${icon('calendar')}<span>${h(t('dev.newSeason'))}</span></a>
        <a class="quick-btn" href="#dev/image/new">${icon('image')}<span>${h(t('dev.newImage'))}</span></a>
        <a class="quick-btn" href="#dev/mystery/new">${icon('help')}<span>${h(t('dev.newMystery'))}</span></a>
      </div>
    </section>
    <div class="two-col">
      <section class="panel"><div class="panel-head"><h2 class="kicker">${h(t('dev.waitingDrafts'))}</h2><a class="more" href="#dev/publishing">${h(t('common.viewAll'))} →</a></div>
        ${drafts.length ? `<ul class="mini-list">${drafts.map(row).join('')}</ul>` : `<p class="muted small empty-inline">${h(t('dev.noDrafts'))}</p>`}</section>
      <section class="panel"><div class="panel-head"><h2 class="kicker">${h(t('dev.recent'))}</h2><a class="more" href="#dev/stories">${h(t('common.viewAll'))} →</a></div>
        ${recent.length ? `<ul class="mini-list">${recent.map(row).join('')}</ul>` : `<p class="muted small empty-inline">${h(t('dev.nothingYet'))}</p>`}</section>
    </div>`;
}

// ─── Stories: every long-form entry, with length and state ────────────
export async function stories(el, _, ctx) {
  const inv = await lore.contentInventory();
  if (!ctx.isCurrent()) return;
  inv.forEach(i => { i.words = wordCount(i.story); });
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.stories'))}</h1><p class="muted">${h(t('dev.storiesLead'))}</p></div></div>
    <form class="filters" id="sf">
      <input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto">
      <select name="type" aria-label="${h(t('dev.type'))}"><option value="">${h(t('dev.allTypes'))}</option>
        ${Object.keys(TYPES).map(k => `<option value="${k}">${h(t(TYPES[k].label))}</option>`).join('')}</select>
      <select name="len" aria-label="${h(t('dev.length'))}"><option value="">${h(t('dev.anyLength'))}</option>
        <option value="empty">${h(t('dev.noStoryYet'))}</option><option value="short">${h(t('dev.under300'))}</option><option value="long">${h(t('dev.over1000'))}</option></select>
    </form>
    <div id="rows"></div>`;
  const f = $('#sf', el);
  const run = () => {
    const q = f.q.value.trim().toLowerCase();
    const list = inv.filter(i => (!f.type.value || i.type === f.type.value) && (!q || i.title.toLowerCase().includes(q))
      && (!f.len.value || (f.len.value === 'empty' ? i.words === 0 : f.len.value === 'short' ? i.words > 0 && i.words < 300 : i.words >= 1000)));
    $('#rows', el).innerHTML = list.length ? `<ul class="admin-list">${list.map(i => `
      <li class="admin-row"><div class="admin-main">
        <a class="admin-title" href="${TYPES[i.type].edit(i.id)}" dir="auto">${h(i.title)}</a>
        <div class="row-wrap small">${typeTag(i.type)}${pubBadge(i.is_published)}
          <span class="${i.words ? 'muted' : 'warn'}">${h(i.words ? t('editor.words', { n: i.words.toLocaleString() }) : t('dev.noStoryYet'))}</span>
          <span class="muted">${h(fmtDate(i.updated_at))}</span></div></div>
        <div class="admin-actions"><a class="btn btn-small" href="${TYPES[i.type].edit(i.id)}">${icon('edit', 15)} ${h(t('dev.editStory'))}</a>
          <a class="btn btn-small btn-ghost" href="${TYPES[i.type].view(i.id)}">${icon('eye', 15)} ${h(t('common.view'))}</a></div></li>`).join('')}</ul>`
      : `<div class="empty"><p class="muted">${h(t('dev.nothingYet'))}</p></div>`;
  };
  f.oninput = debounce(run, 150); f.onsubmit = e => e.preventDefault();
  run();
}

// ─── Publishing: drafts and published items in one place ──────────────
export async function publishing(el, _, ctx) {
  let inv = await lore.contentInventory();
  if (!ctx.isCurrent()) return;
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.publishing'))}</h1><p class="muted">${h(t('dev.publishingLead'))}</p></div></div>
    <form class="filters" id="pf">
      <div class="seg seg-tabs" role="tablist">
        <button type="button" data-st="draft" class="on">${h(t('dev.drafts'))}</button>
        <button type="button" data-st="pub">${h(t('common.published'))}</button>
        <button type="button" data-st="">${h(t('dev.everything'))}</button>
      </div>
      <select name="type" aria-label="${h(t('dev.type'))}"><option value="">${h(t('dev.allTypes'))}</option>
        ${Object.keys(TYPES).map(k => `<option value="${k}">${h(t(TYPES[k].label))}</option>`).join('')}</select>
    </form>
    <div id="rows"></div>`;
  const f = $('#pf', el);
  let st = 'draft';
  $$('[data-st]', f).forEach(b => b.onclick = () => { st = b.dataset.st; $$('[data-st]', f).forEach(x => x.classList.toggle('on', x === b)); run(); });
  f.oninput = () => run(); f.onsubmit = e => e.preventDefault();
  const run = () => {
    const list = inv.filter(i => (!f.type.value || i.type === f.type.value) && (!st || (st === 'pub') === i.is_published));
    const rows = $('#rows', el);
    rows.innerHTML = list.length ? `<ul class="admin-list">${list.map(i => `
      <li class="admin-row" data-k="${h(i.type)}:${h(i.id)}"><div class="admin-main">
        <a class="admin-title" href="${TYPES[i.type].edit(i.id)}" dir="auto">${h(i.title)}</a>
        <div class="row-wrap small">${typeTag(i.type)}${pubBadge(i.is_published)}<span class="muted">${h(fmtDate(i.updated_at))}</span></div></div>
        <div class="admin-actions">
          <a class="btn btn-small btn-ghost" href="${TYPES[i.type].edit(i.id)}">${icon('edit', 15)} ${h(t('common.edit'))}</a>
          <button class="btn btn-small ${i.is_published ? '' : 'btn-primary'}" data-toggle>${h(t(i.is_published ? 'dev.unpublish' : 'dev.publish'))}</button>
        </div></li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-icon">${icon('check', 22)}</div><p class="muted">${h(t(st === 'draft' ? 'dev.noDrafts' : 'dev.nothingYet'))}</p></div>`;
    $$('[data-toggle]', rows).forEach(b => b.onclick = async () => {
      const [type, id] = b.closest('[data-k]').dataset.k.split(':');
      const it = inv.find(x => x.type === type && x.id === id);
      b.disabled = true;
      try {
        await TYPES[type].publish(id, !it.is_published);
        it.is_published = !it.is_published;
        toast(t(it.is_published ? 'dev.publishedOk' : 'dev.unpublished'));
        run();
      } catch (e) { toast(errMsg(e), 'error'); b.disabled = false; }
    });
  };
  run();
}

// ─── Timeline: pick a season and order its events ─────────────────────
export async function timeline(el, _, ctx) {
  const seasons = await lore.listSeasons({ publishedOnly: false });
  if (!ctx.isCurrent()) return;
  let pick = null;
  try { pick = sessionStorage.getItem('lore:tl-season'); } catch { /* ignore */ }
  if (!seasons.some(s => s.id === pick)) pick = seasons[0]?.id || null;
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.timeline'))}</h1><p class="muted">${h(t('seasons.timelineHelp'))}</p></div></div>
    ${seasons.length ? `<div class="filters"><select id="tl-season" aria-label="${h(t('seasons.season'))}">
      ${seasons.map(s => `<option value="${h(s.id)}" ${s.id === pick ? 'selected' : ''}>${h([seasonLabel(s), s.name].filter(Boolean).join(' — '))}${s.is_published ? '' : ' (' + h(t('common.draft')) + ')'}</option>`).join('')}</select></div>
    <section class="panel"><ol class="ev-list" id="ev-list"></ol>
      <div class="row-wrap"><a class="btn btn-small btn-primary" id="tl-add">${icon('plus', 16)} ${h(t('seasons.addEvent'))}</a>
      <a class="btn btn-small btn-ghost" id="tl-edit">${icon('edit', 16)} ${h(t('dev.editSeason'))}</a>
      <a class="btn btn-small btn-ghost" id="tl-view">${icon('eye', 16)} ${h(t('common.view'))}</a></div></section>`
    : `<div class="empty"><p class="muted">${h(t('seasons.empty'))}</p><a class="btn btn-primary" href="#dev/season/new">${h(t('dev.newSeason'))}</a></div>`}`;
  if (!seasons.length) return;
  const load = async id => {
    try { sessionStorage.setItem('lore:tl-season', id); } catch { /* ignore */ }
    $('#tl-add', el).href = `#dev/event/new-${id}`; $('#tl-edit', el).href = `#dev/season/${id}`; $('#tl-view', el).href = `#season/${id}`;
    const events = await lore.listEvents(id);
    if (!ctx.isCurrent()) return;
    timelineManager($('#ev-list', el), { id, events });
  };
  $('#tl-season', el).onchange = e => load(e.target.value);
  await load(pick);
}

// ─── Showcase: which seasons appear in the homepage carousel, and in what order ─
export async function showcaseManager(el, _, ctx) {
  let rows = await homeApi.allShowcaseSeasons();
  if (!ctx.isCurrent()) return;
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.showcase'))}</h1><p class="muted">${h(t('showcase.devLead'))}</p></div>
      <div class="row-wrap"><button class="btn" id="sc-preview">${icon('eye', 16)} ${h(t('dev.preview'))}</button>
      <a class="btn btn-primary" href="#dev/season/new">${icon('plus', 16)} ${h(t('dev.newSeason'))}</a></div></div>
    <ol class="ev-list sc-list" id="sc-list"></ol>`;
  const list = $('#sc-list', el);
  const draw = () => {
    list.innerHTML = rows.length ? rows.map((s, i) => {
      const live = s.is_published && s.show_on_home && s.cover_path;
      const why = !s.cover_path ? t('showcase.needsCover') : !s.is_published ? t('showcase.needsPublish') : !s.show_on_home ? t('showcase.hidden') : '';
      return `<li class="ev-row sc-row ${live ? '' : 'is-off'}" draggable="true" data-id="${h(s.id)}">
        <span class="ev-handle" aria-hidden="true">⋮⋮</span>
        <span class="ev-num">${i + 1}</span>
        <div class="thumb thumb-wide">${s.cover_path ? `<img data-path="${h(s.cover_path)}" alt="">` : ''}</div>
        <div class="ev-main"><strong dir="auto">${h(s.name)}</strong>
          <small class="${why ? 'warn' : 'muted'}">${h(why || [seasonLabel(s), t('showcase.live')].filter(Boolean).join(' · '))}</small></div>
        <div class="link-actions">
          <label class="switch" title="${h(t('showcase.onHome'))}"><input type="checkbox" data-home ${s.show_on_home ? 'checked' : ''}><span aria-hidden="true"></span><span class="sr-only">${h(t('showcase.onHome'))}</span></label>
          ${i > 0 ? `<button type="button" class="icon-btn" data-mv="-1" aria-label="${h(t('seasons.moveUp'))}">↑</button>` : ''}
          ${i < rows.length - 1 ? `<button type="button" class="icon-btn" data-mv="1" aria-label="${h(t('seasons.moveDown'))}">↓</button>` : ''}
          <a class="btn btn-small" href="#dev/season/${h(s.id)}">${icon('edit', 15)} ${h(t('common.edit'))}</a>
        </div></li>`;
    }).join('') : `<li class="empty"><p class="muted">${h(t('seasons.empty'))}</p></li>`;
    hydrateMedia(list);
    $$('[data-home]', list).forEach(cb => cb.onchange = async () => {
      const s = rows.find(x => x.id === cb.closest('[data-id]').dataset.id);
      try { await homeApi.setShowOnHome(s.id, cb.checked); s.show_on_home = cb.checked; toast(t('dev.saved')); draw(); }
      catch (e) { cb.checked = !cb.checked; toast(errMsg(e), 'error'); }
    });
    $$('[data-mv]', list).forEach(b => b.onclick = () => {
      const i = rows.findIndex(x => x.id === b.closest('[data-id]').dataset.id), j = i + +b.dataset.mv;
      [rows[i], rows[j]] = [rows[j], rows[i]]; persist();
    });
    let dragId = null;
    $$('.sc-row', list).forEach(li => {
      li.ondragstart = e => { dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; };
      li.ondragend = () => li.classList.remove('dragging');
      li.ondragover = e => { e.preventDefault(); li.classList.add('drop-target'); };
      li.ondragleave = () => li.classList.remove('drop-target');
      li.ondrop = e => {
        e.preventDefault(); li.classList.remove('drop-target');
        const from = rows.findIndex(x => x.id === dragId), to = rows.findIndex(x => x.id === li.dataset.id);
        if (from < 0 || from === to) return;
        const [m] = rows.splice(from, 1); rows.splice(to, 0, m); persist();
      };
    });
  };
  const persist = async () => {
    draw();
    try { await homeApi.saveShowcaseOrder(rows.map(r => r.id)); rows.forEach((r, i) => { r.home_order = i; }); toast(t('showcase.orderSaved')); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  $('#sc-preview', el).onclick = () => {
    const live = rows.filter(s => s.is_published && s.show_on_home && s.cover_path);
    const box = document.createElement('div');
    if (live.length) renderShowcase(box, live, { preview: true });
    else box.innerHTML = `<div class="empty"><p class="muted">${h(t('showcase.nothingLive'))}</p></div>`;
    modal({ title: t('dev.preview'), body: box, wide: true, className: 'modal-full' });
  };
  draw();
}

// ─── Default countdown (used by everyone who hasn't made their own) ───
export async function countdownManager(el, _, ctx) {
  const def = await homeApi.defaultCountdown();
  if (!ctx.isCurrent()) return;
  const local = iso => { if (!iso) return ''; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.countdown'))}</h1><p class="muted">${h(t('countdown.devLead'))}</p></div></div>
    <form class="panel" id="cdf">
      <div class="grid-2">
        <label class="field"><span>${h(t('countdown.titleLabel'))}</span><input name="title" maxlength="120" value="${h(def?.title || '')}" dir="auto"></label>
        <label class="field"><span>${h(t('countdown.target'))} <em class="req">*</em></span><input name="target" type="datetime-local" value="${local(def?.target_at)}" required></label>
      </div>
      <div class="row-wrap"><button class="btn btn-primary">${icon('check', 16)} ${h(t('common.save'))}</button>
        ${def ? `<button type="button" class="btn btn-ghost btn-danger-text" id="cd-clear">${h(t('countdown.clearDefault'))}</button>` : ''}</div>
    </form>
    <h2 class="kicker">${h(t('dev.preview'))}</h2>
    <div id="cd-prev" class="cd-preview cd-preview-dev"></div>`;
  const f = $('#cdf', el);
  const draw = () => mountCountdown($('#cd-prev', el), { title: f.title.value, target_at: f.target.value ? new Date(f.target.value).toISOString() : null, bg_type: 'none', overlay: 0.45 });
  f.title.oninput = draw; f.target.onchange = draw; draw();
  f.onsubmit = async e => {
    e.preventDefault();
    if (!f.target.value) return toast(t('countdown.needDate'), 'error');
    try { await homeApi.saveDefaultCountdown({ title: f.title.value.trim(), target_at: new Date(f.target.value).toISOString() }); toast(t('dev.saved')); }
    catch (ex) { toast(errMsg(ex), 'error'); }
  };
  const clr = $('#cd-clear', el);
  if (clr) clr.onclick = async () => {
    try { await homeApi.saveDefaultCountdown({}); toast(t('dev.saved')); countdownManager(el, _, ctx); } catch (ex) { toast(errMsg(ex), 'error'); }
  };
}

// ─── Teams offered during onboarding ──────────────────────────────────
export async function teamsManager(el, _, ctx) {
  const [groups, counts] = await Promise.all([homeApi.allGroupsForTeams(), homeApi.teamCounts().catch(() => ({}))]);
  if (!ctx.isCurrent()) return;
  let teams = groups.filter(g => g.is_team);
  const others = groups.filter(g => !g.is_team);
  el.innerHTML = `
    <div class="toolbar"><div><h1 class="page-title">${h(t('dev.teams'))}</h1><p class="muted">${h(t('team.devLead'))}</p></div>
      <a class="btn btn-primary" href="#dev/group/new-team">${icon('plus', 16)} ${h(t('team.new'))}</a></div>
    <section class="panel"><h2 class="kicker">${h(t('team.offered'))}</h2>
      <ol class="ev-list" id="tm-list"></ol></section>
    ${others.length ? `<section class="panel"><h2 class="kicker">${h(t('team.otherGroups'))}</h2>
      <ul class="ev-list">${others.map(g => `<li class="ev-row" data-id="${h(g.id)}">
        ${teamEmblem(g, 'team-emblem-xs')}<div class="ev-main"><strong dir="auto">${h(g.name)}</strong><small class="muted">${h(g.is_published ? t('common.published') : t('common.draft'))}</small></div>
        <div class="link-actions"><button class="btn btn-small" data-add>${icon('plus', 15)} ${h(t('team.offer'))}</button></div></li>`).join('')}</ul></section>` : ''}`;
  const list = $('#tm-list', el);
  const draw = () => {
    list.innerHTML = teams.length ? teams.map((g, i) => `
      <li class="ev-row" data-id="${h(g.id)}">
        <span class="ev-num">${i + 1}</span>${teamEmblem(g, 'team-emblem-xs')}
        <div class="ev-main"><strong dir="auto">${h(g.name)}${g.name_ar ? ` · <span dir="rtl">${h(g.name_ar)}</span>` : ''}</strong>
          <small class="${g.is_published ? 'muted' : 'warn'}">${h(g.is_published ? t('team.members', { n: counts[g.id] || 0 }) : t('team.needsPublish'))}</small></div>
        <div class="link-actions">
          ${i > 0 ? `<button type="button" class="icon-btn" data-mv="-1" aria-label="${h(t('seasons.moveUp'))}">↑</button>` : ''}
          ${i < teams.length - 1 ? `<button type="button" class="icon-btn" data-mv="1" aria-label="${h(t('seasons.moveDown'))}">↓</button>` : ''}
          <a class="btn btn-small" href="#dev/group/${h(g.id)}">${icon('edit', 15)} ${h(t('common.edit'))}</a>
          <button class="btn btn-small btn-ghost" data-remove>${h(t('team.unoffer'))}</button>
        </div></li>`).join('') : `<li class="muted small empty-inline">${h(t('team.noneOffered'))}</li>`;
    hydrateMedia(list);
    $$('[data-mv]', list).forEach(b => b.onclick = async () => {
      const i = teams.findIndex(x => x.id === b.closest('[data-id]').dataset.id), j = i + +b.dataset.mv;
      [teams[i], teams[j]] = [teams[j], teams[i]]; draw();
      try { await homeApi.saveTeamOrder(teams.map(x => x.id)); toast(t('dev.saved')); } catch (e) { toast(errMsg(e), 'error'); }
    });
    $$('[data-remove]', list).forEach(b => b.onclick = async () => {
      const id = b.closest('[data-id]').dataset.id;
      try { await homeApi.setIsTeam(id, false); toast(t('dev.saved')); teamsManager(el, _, ctx); } catch (e) { toast(errMsg(e), 'error'); }
    });
  };
  $$('[data-add]', el).forEach(b => b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id;
    try { await homeApi.setIsTeam(id, true); await homeApi.saveTeamOrder([...teams.map(x => x.id), id]); toast(t('dev.saved')); teamsManager(el, _, ctx); }
    catch (e) { toast(errMsg(e), 'error'); }
  });
  draw();
  hydrateMedia(el);
}
