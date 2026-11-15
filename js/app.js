import { sb } from './supabase.js';
import { state } from './state.js';
import { t, getLang, setLang, applyLang } from './i18n.js';
import { h, $, errMsg } from './util.js';
import { myRoles } from './api.js';
import { icon } from './icons.js';
import { loadDevSession, openDevDialog, devTimeLeft } from './devmode.js';
import * as pub from './views/public.js';
import * as auth from './views/auth.js';
import * as dev from './views/dev.js';
import * as grp from './views/groups.js';
import * as sea from './views/seasons.js';
import * as exp from './views/explore.js';

const routes = [
  [/^$/, pub.home],
  [/^characters$/, pub.characters],
  [/^character\/([\w-]+)$/, pub.character],
  [/^teams$/, pub.teams],              // legacy → groups
  [/^team\/([\w-]+)$/, pub.team],      // legacy → group
  [/^groups$/, grp.groups],
  [/^group\/([\w-]+)$/, grp.group],
  [/^story$/, sea.storyArchive],
  [/^chapters$/, sea.chapters],
  [/^chapter\/(\d+)$/, sea.chapter],
  [/^seasons$/, sea.seasons],
  [/^season\/([\w-]+)$/, sea.season],
  [/^event\/([\w-]+)$/, sea.event],
  [/^timeline$/, sea.timeline],
  [/^mysteries$/, exp.mysteries],
  [/^mystery\/([\w-]+)$/, exp.mystery],
  [/^search$/, exp.search],
  [/^profile$/, exp.profile],
  [/^images$/, pub.images],
  [/^image\/([\w-]+)$/, pub.image],
  [/^login$/, auth.login, { open: true }],
  [/^reset$/, auth.reset, { open: true }],
  [/^dev(?:\/(.*))?$/, dev.dashboard, { dev: true }],
];

let renderSeq = 0;
export function go(path) {
  if (location.hash === '#' + path) render(); else location.hash = path;
}

export async function render() {
  const seq = ++renderSeq;
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const main = $('#main');
  renderNav(path);
  closeMenu();

  const match = routes.map(([re, view, opts]) => [path.match(re), view, opts || {}]).find(([m]) => m);
  if (!match) { main.innerHTML = notFound(); return; }
  const [m, view, opts] = match;

  document.body.classList.toggle('is-auth', !state.user || /^(login|reset)$/.test(path));
  if (!opts.open && !state.user) { return auth.gate(main, path); }
  if (opts.dev && !state.isDev) { devLocked(main); return; }

  main.classList.remove('view-in');
  main.setAttribute('aria-busy', 'true');
  try {
    // Every view takes (main, param, ctx); routes have at most one parameter.
    await view(main, m[1], { isCurrent: () => seq === renderSeq });
  } catch (e) {
    console.error(e);
    if (seq === renderSeq) main.innerHTML = `<section class="wrap empty-page"><div class="empty-icon">${icon('alert', 28)}</div><h1>${h(t('error.title'))}</h1><p class="muted">${h(errMsg(e))}</p><a class="btn" href="#">${h(t('nav.home'))}</a></section>`;
  }
  if (seq !== renderSeq) return;
  main.removeAttribute('aria-busy');
  void main.offsetWidth; main.classList.add('view-in');
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

function notFound() {
  return `<section class="wrap empty-page"><div class="empty-icon">${icon('help', 28)}</div><h1>${h(t('error.notFound'))}</h1><p class="muted">${h(t('error.notFoundBody'))}</p><a class="btn" href="#">${h(t('nav.home'))}</a></section>`;
}

/** #dev without an active Developer Mode session: offer the access dialog. */
function devLocked(main) {
  main.innerHTML = `
    <section class="wrap empty-page dev-locked">
      <div class="empty-icon">${icon('lock', 28)}</div>
      <p class="eyebrow">${h(t('nav.dev'))}</p>
      <h1>${h(t('devmode.lockedTitle'))}</h1>
      <p class="muted">${h(t('devmode.lockedBody'))}</p>
      <div class="row-wrap center"><button class="btn btn-primary" id="dev-unlock">${icon('key', 16)} ${h(t('devmode.enter'))}</button>
        <a class="btn btn-ghost" href="#">${h(t('nav.home'))}</a></div>
    </section>`;
  main.classList.add('view-in');
  $('#dev-unlock').onclick = async () => { if (await openDevDialog()) render(); };
}

const NAV = [
  ['explore', [
    ['', 'nav.home', 'home'], ['story', 'nav.story', 'book'], ['chapters', 'nav.chapters', 'layers', ['chapter']],
    ['seasons', 'nav.seasons', 'calendar', ['season', 'event']], ['timeline', 'nav.timeline', 'clock'],
  ]],
  ['encyclopedia', [
    ['characters', 'nav.characters', 'user', ['character']], ['groups', 'nav.groups', 'shield', ['group', 'teams', 'team']],
    ['images', 'nav.images', 'image', ['image']], ['mysteries', 'nav.mysteries', 'help', ['mystery']],
  ]],
];

function renderNav(path) {
  const top = path.split('/')[0];
  const link = ([href, key, ic, also = []]) => {
    const on = top === href || also.includes(top);
    return `<a href="#${href}" class="nav-link ${on ? 'active' : ''}" ${on ? 'aria-current="page"' : ''}>${icon(ic)}<span>${h(t(key))}</span></a>`;
  };
  $('#nav').innerHTML = NAV.map(([group, items]) => `
    <div class="nav-group"><p class="nav-label">${h(t('nav.group.' + group))}</p>${items.map(link).join('')}</div>`).join('')
    + `<div class="nav-group"><p class="nav-label">${h(t('nav.group.account'))}</p>
        ${link(['search', 'nav.search', 'search'])}
        ${state.user ? link(['profile', 'nav.profile', 'user']) : ''}
        ${state.user ? (state.isDev
          ? `<a href="#dev" class="nav-link nav-dev ${top === 'dev' ? 'active' : ''}">${icon('grid')}<span>${h(t('nav.dev'))}</span><small class="nav-pill">${h(devTimeLeft())}</small></a>`
          : `<button type="button" class="nav-link nav-devmode" id="nav-devmode">${icon('lock')}<span>${h(t('devmode.enter'))}</span></button>`) : ''}
      </div>`;
  const u = state.user;
  $('#account').innerHTML = `
    <div class="lang-switch" role="group" aria-label="${h(t('nav.language'))}">
      <button type="button" id="lang-btn" class="lang-opt" aria-label="${h(t('nav.language'))}">
        <span class="${getLang() === 'en' ? 'on' : ''}">EN</span><span class="${getLang() === 'ar' ? 'on' : ''}">ع</span></button>
    </div>
    ${u ? `<a class="me" href="#profile"><span class="avatar">${h((u.email || '?').charAt(0).toUpperCase())}</span>
          <span class="me-text"><strong dir="ltr">${h(u.email || '')}</strong><small>${h(state.isDev ? t('devmode.active') : t('profile.member'))}</small></span></a>`
       : `<a class="btn btn-primary btn-block" href="#login">${h(t('nav.signIn'))}</a>`}`;
  $('#lang-btn').onclick = () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); render(); };
  const dm = $('#nav-devmode');
  if (dm) dm.onclick = async () => { closeMenu(); if (await openDevDialog()) go('dev'); };
  $('#m-search').classList.toggle('is-on', top === 'search');
}

function closeMenu() { document.body.classList.remove('menu-open'); $('#menu-btn')?.setAttribute('aria-expanded', 'false'); }

export async function loadUser(session) {
  state.session = session;
  state.user = session?.user || null;
  try { state.roles = state.user ? await myRoles(state.user.id) : []; }
  catch (e) { console.warn(e); state.roles = []; }
  await loadDevSession();
  scheduleExpiry();
}

// When the Developer Mode session runs out, refresh so dev controls disappear.
let expiryTimer;
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!state.devUntil) return;
  const ms = new Date(state.devUntil) - Date.now();
  if (ms > 0 && ms < 2 ** 31) expiryTimer = setTimeout(async () => { await loadDevSession(); render(); }, ms + 1000);
}
export function onDevChange() { scheduleExpiry(); }

async function boot() {
  applyLang();
  $('#menu-btn').innerHTML = icon('menu', 22);
  $('#m-search').innerHTML = icon('search', 20);
  $('#menu-btn').onclick = () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    $('#menu-btn').setAttribute('aria-expanded', String(open));
  };
  $('#menu-close').innerHTML = icon('x', 20);
  $('#menu-close').onclick = closeMenu;
  $('#scrim').onclick = closeMenu;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable && state.user) {
      e.preventDefault(); go('search');
    }
  });

  const { data } = await sb.auth.getSession();
  await loadUser(data.session);
  // Remove ?code= left by the auth redirect.
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') { await loadUser(session); go('reset'); return; }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      const changed = (session?.user?.id || null) !== (state.user?.id || null);
      await loadUser(session);
      if (changed) render();
    }
  });
  window.addEventListener('hashchange', render);
  await render();
  document.body.classList.add('ready');
}

boot().catch(e => {
  console.error(e);
  $('#main').innerHTML = `<section class="wrap empty-page"><h1>${h(t('error.title'))}</h1><p>${h(errMsg(e))}</p></section>`;
});
