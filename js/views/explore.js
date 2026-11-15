import { sb } from '../supabase.js';
import { t, getLang, setLang } from '../i18n.js';
import { h, $, $$, excerpt, debounce, fmtDate, toast, errMsg } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as lore from '../api-lore.js';
import { state } from '../state.js';
import { renderRich, characterCard, imageCard } from './public.js';
import { groupCard } from './groups.js';
import { seasonCard } from './seasons.js';
import { seasonLabel } from '../components.js';
import { go, render } from '../app.js';

const empty = msg => `<div class="empty"><p class="muted">${h(msg)}</p></div>`;
const STATUSES = ['open', 'partial', 'solved'];

// ─── Mysteries ─────────────────────────────────────────────────────────
export async function mysteries(main, _, ctx) {
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.mysteries'))}</p>
      <h1 class="display">${h(t('mysteries.title'))}</h1>
      <p class="lead">${h(t('mysteries.lead'))}</p>
      <form class="filters" id="filters" role="search">
        <input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto">
        <select name="status" aria-label="${h(t('mysteries.status'))}"><option value="">${h(t('mysteries.any'))}</option>
          ${STATUSES.map(s => `<option value="${s}">${h(t('mysteries.' + s))}</option>`).join('')}</select>
      </form>
    </section>
    <section class="wrap section" id="results"></section>`;
  const form = $('#filters', main);
  const run = async () => {
    const list = await lore.listMysteries({ search: form.q.value.trim(), status: form.status.value });
    if (!ctx.isCurrent()) return;
    $('#results', main).innerHTML = list.length ? `<div class="mystery-list">${list.map(m => `
      <a class="mystery-row" href="#mystery/${h(m.id)}">
        <span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span>
        <strong dir="auto">${h(m.title)}</strong>
        <span class="muted small" dir="auto">${h(excerpt(m.body, 180))}</span>
        ${m.season ? `<span class="small" dir="auto">${h(m.season.name)}</span>` : ''}
      </a>`).join('')}</div>` : empty(t('mysteries.empty'));
  };
  form.oninput = debounce(run, 250); form.onsubmit = e => e.preventDefault();
  await run();
}

export async function mystery(main, id, ctx) {
  const m = await lore.getMystery(id);
  if (!ctx.isCurrent()) return;
  if (!m) { main.innerHTML = `<section class="wrap">${empty(t('error.notFound'))}</section>`; return; }
  renderMystery(main, m);
}
export function renderMystery(el, m, { preview = false } = {}) {
  el.innerHTML = `
    <article class="wrap mystery-page">
      ${!m.is_published ? `<div class="draft-banner">${h(t(preview ? 'dev.previewBanner' : 'dev.draftBanner'))}</div>` : ''}
      <header class="page-head">
        <p class="eyebrow">${preview ? h(t('nav.mysteries')) : `<a href="#mysteries">${h(t('nav.mysteries'))}</a>`}</p>
        <h1 class="display display-xl" dir="auto">${h(m.title)}</h1>
        <div class="row-wrap"><span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span>
          ${m.season ? (preview ? `<span dir="auto">${h(m.season.name)}</span>` : `<a href="#season/${h(m.season.id)}" dir="auto">${h(m.season.name)}</a>`) : ''}
          ${state.isDev && !preview && m.id ? `<a class="btn btn-small" href="#dev/mystery/${h(m.id)}">${h(t('common.edit'))}</a>` : ''}</div>
      </header>
      <div class="prose prose-story section" dir="auto" id="m-body"></div>
    </article>`;
  renderRich($('#m-body', el), m.body);
}

// ─── Search ────────────────────────────────────────────────────────────
export async function search(main, _, ctx) {
  let q0 = '';
  try { q0 = sessionStorage.getItem('lore:q') || ''; } catch { /* ignore */ }
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.search'))}</p>
      <h1 class="display">${h(t('search.title'))}</h1>
      <form class="filters search-big" id="sform" role="search">
        <input type="search" name="q" value="${h(q0)}" placeholder="${h(t('search.placeholder'))}" aria-label="${h(t('nav.search'))}" dir="auto" autofocus>
      </form>
    </section>
    <section class="wrap section" id="results"></section>`;
  const form = $('#sform', main);
  const run = async () => {
    const q = form.q.value.trim();
    try { sessionStorage.setItem('lore:q', q); } catch { /* ignore */ }
    const box = $('#results', main);
    if (q.length < 2) { box.innerHTML = `<p class="muted">${h(t('search.hint'))}</p>`; return; }
    const r = await lore.searchAll(q);
    if (!ctx.isCurrent() || form.q.value.trim() !== q) return;
    const block = (key, list, html) => list.length ? `<section class="search-block"><h2 class="kicker">${h(t(key))} · ${list.length}</h2>${html}</section>` : '';
    const total = Object.values(r).reduce((n, l) => n + l.length, 0);
    box.innerHTML = total ? [
      block('nav.characters', r.chars, `<div class="grid-chars">${r.chars.map(characterCard).join('')}</div>`),
      block('nav.groups', r.groups, `<div class="grid-groups">${r.groups.map(groupCard).join('')}</div>`),
      block('nav.seasons', r.seasons, `<div class="grid-seasons">${r.seasons.map(seasonCard).join('')}</div>`),
      block('seasons.events', r.events, `<ul class="plain-list">${r.events.map(e => `<li><a href="#event/${h(e.id)}"><strong dir="auto">${h(e.title)}</strong></a> <small class="muted" dir="auto">${h(e.season.name)}</small></li>`).join('')}</ul>`),
      block('nav.images', r.images, `<div class="grid-imgs">${r.images.map(imageCard).join('')}</div>`),
      block('nav.mysteries', r.mysteries, `<div class="mystery-list">${r.mysteries.map(m => `<a class="mystery-row" href="#mystery/${h(m.id)}"><span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span><strong dir="auto">${h(m.title)}</strong></a>`).join('')}</div>`),
    ].join('') : empty(t('search.none', { q }));
    hydrateMedia(box);
  };
  form.oninput = debounce(run, 300); form.onsubmit = e => { e.preventDefault(); run(); };
  await run();
}

// ─── Profile ───────────────────────────────────────────────────────────
export async function profile(main) {
  const u = state.user;
  main.innerHTML = `
    <section class="wrap-narrow page-head profile-page">
      <p class="eyebrow">${h(t('nav.profile'))}</p>
      <h1 class="display">${h(t('profile.title'))}</h1>
      <div class="card stack">
        <dl class="facts facts-col">
          <div><dt>${h(t('auth.email'))}</dt><dd dir="ltr">${h(u.email || '')}</dd></div>
          <div><dt>${h(t('profile.role'))}</dt><dd>${h(state.roles.length ? state.roles.map(r => t('role.' + r)).join(', ') : t('profile.member'))}</dd></div>
          ${u.created_at ? `<div><dt>${h(t('profile.since'))}</dt><dd>${h(fmtDate(u.created_at))}</dd></div>` : ''}
        </dl>
      </div>
      <div class="card stack">
        <h2 class="kicker" style="margin:0">${h(t('nav.language'))}</h2>
        <div class="seg">
          <label><input type="radio" name="lang" value="en" ${getLang() === 'en' ? 'checked' : ''}><span>English</span></label>
          <label><input type="radio" name="lang" value="ar" ${getLang() === 'ar' ? 'checked' : ''}><span>العربية</span></label>
        </div>
      </div>
      <form class="card stack" id="pw-form">
        <h2 class="kicker" style="margin:0">${h(t('profile.changePassword'))}</h2>
        <label class="field"><span>${h(t('auth.password'))}</span><input type="password" name="password" minlength="8" autocomplete="new-password" dir="ltr" required></label>
        <button class="btn">${h(t('common.save'))}</button>
      </form>
      <div class="row-wrap">
        ${state.isDev ? `<a class="btn" href="#dev">${h(t('nav.dev'))}</a>` : ''}
        <button class="btn btn-ghost btn-danger-text" id="p-out">${h(t('nav.signOut'))}</button>
      </div>
    </section>`;
  $$('input[name=lang]', main).forEach(r => r.onchange = () => { setLang(r.value); render(); });
  $('#pw-form', main).onsubmit = async e => {
    e.preventDefault();
    const pw = e.target.password.value;
    if (pw.length < 8) return toast(t('auth.shortPassword'), 'error');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return toast(errMsg(error), 'error');
    e.target.reset(); toast(t('auth.passwordUpdated'));
  };
  $('#p-out', main).onclick = async () => { await sb.auth.signOut(); toast(t('auth.signedOut')); go(''); };
}
