import { sb } from './supabase.js';
import { state } from './state.js';
import { t, getLang, setLang, applyLang } from './i18n.js';
import { h, $, toast, errMsg } from './util.js';
import { myRoles } from './api.js';
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

  const match = routes.map(([re, view, opts]) => [path.match(re), view, opts || {}]).find(([m]) => m);
  if (!match) { main.innerHTML = notFound(); return; }
  const [m, view, opts] = match;

  if (!opts.open && !state.user) { return auth.gate(main, path); }
  if (opts.dev && !state.isDev) { main.innerHTML = forbidden(); return; }

  main.classList.remove('view-in');
  main.setAttribute('aria-busy', 'true');
  try {
    // Every view takes (main, param, ctx); routes have at most one parameter.
    await view(main, m[1], { isCurrent: () => seq === renderSeq });
  } catch (e) {
    console.error(e);
    if (seq === renderSeq) main.innerHTML = `<section class="wrap empty"><h1>${h(t('error.title'))}</h1><p>${h(errMsg(e))}</p></section>`;
  }
  if (seq !== renderSeq) return;
  main.removeAttribute('aria-busy');
  void main.offsetWidth; main.classList.add('view-in');
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

function notFound() {
  return `<section class="wrap empty"><h1>${h(t('error.notFound'))}</h1><a class="btn" href="#">${h(t('nav.home'))}</a></section>`;
}
function forbidden() {
  return `<section class="wrap empty"><h1>${h(t('error.devOnly'))}</h1><p>${h(t('error.devOnlyBody'))}</p><a class="btn" href="#">${h(t('nav.home'))}</a></section>`;
}

const NAV = [
  ['', 'nav.home'], ['story', 'nav.story'], ['chapters', 'nav.chapters', ['chapter']], ['seasons', 'nav.seasons', ['season', 'event']],
  ['characters', 'nav.characters', ['character']], ['groups', 'nav.groups', ['group', 'teams', 'team']], ['images', 'nav.images', ['image']],
  ['timeline', 'nav.timeline'], ['mysteries', 'nav.mysteries', ['mystery']],
];

function renderNav(path) {
  const top = path.split('/')[0];
  const isActive = (href, also = []) => top === href || also.includes(top);
  $('#nav').innerHTML = NAV.map(([href, key, also]) =>
    `<a href="#${href}" class="nav-link ${isActive(href, also) ? 'active' : ''}" ${isActive(href, also) ? 'aria-current="page"' : ''}>${h(t(key))}</a>`).join('')
    + `<a href="#search" class="nav-link nav-only-mobile ${top === 'search' ? 'active' : ''}">${h(t('nav.search'))}</a>`
    + (state.user ? `<a href="#profile" class="nav-link nav-only-mobile ${top === 'profile' ? 'active' : ''}">${h(t('nav.profile'))}</a>` : '')
    + (state.isDev ? `<a href="#dev" class="nav-link nav-dev ${top === 'dev' ? 'active' : ''}">${h(t('nav.dev'))}</a>` : '');
  const icon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  $('#account').innerHTML = `
    <a class="icon-btn ${top === 'search' ? 'is-on' : ''}" href="#search" aria-label="${h(t('nav.search'))}" title="${h(t('nav.search'))}">${icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}</a>
    <button class="chip" id="lang-btn" aria-label="${h(t('nav.language'))}">${getLang() === 'ar' ? 'EN' : 'ع'}</button>
    ${state.user
      ? `<a class="icon-btn ${top === 'profile' ? 'is-on' : ''}" href="#profile" aria-label="${h(t('nav.profile'))}" title="${h(t('nav.profile'))}">${icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>')}</a>`
      : `<a class="chip" href="#login">${h(t('nav.signIn'))}</a>`}`;
  $('#lang-btn').onclick = () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); render(); };
  document.body.classList.toggle('menu-open', false);
  requestAnimationFrame(() => $('#nav .active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}

async function loadUser(session) {
  state.session = session;
  state.user = session?.user || null;
  try { state.roles = state.user ? await myRoles(state.user.id) : []; }
  catch (e) { console.warn(e); state.roles = []; }
}

async function boot() {
  applyLang();
  $('#menu-btn').onclick = () => document.body.classList.toggle('menu-open');
  $('#nav').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('menu-open'); });

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
  $('#main').innerHTML = `<section class="wrap empty"><h1>${h(t('error.title'))}</h1><p>${h(errMsg(e))}</p></section>`;
});
