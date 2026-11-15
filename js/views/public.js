import { t } from '../i18n.js';
import { h, $, $$, sanitizeHtml, excerpt, fmtDate, statusBadge, textToHtml, debounce, modal } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as api from '../api.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import * as homeApi from '../api-home.js';
import { renderShowcase } from './showcase.js';
import { homeCountdown } from './countdown.js';
import * as lore from '../api-lore.js';
import { go } from '../app.js';

const relName = ty => ty ? ((document.documentElement.lang === 'ar' && ty.label_ar) ? ty.label_ar : ty.label_en) : '';
const chapterSeason = s => [s.chapter_number != null ? t('seasons.chapterN', { n: s.chapter_number }) : '', s.season_number != null ? t('seasons.seasonN', { n: s.season_number }) : ''].filter(Boolean).join(' · ');

// ─── Shared pieces ─────────────────────────────────────────────────────
export const coverOf = c => (c.images || []).find(i => i.is_primary) || (c.images || [])[0] || null;

/** <img> attributes for a stored path or a local preview URL. */
export function imgAttrs(img, alt = '') {
  if (!img) return '';
  if (img._url) return `src="${h(img._url)}" alt="${h(alt)}" class="loaded"`;
  return `data-path="${h(img.storage_path)}" alt="${h(alt)}" loading="lazy"`;
}

export function renderRich(el, html) {
  el.innerHTML = sanitizeHtml(html);
  for (const a of $$('a[href^="http"]', el)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  hydrateMedia(el);
}

export function characterCard(c) {
  const cover = coverOf(c);
  return `<a class="card-char" href="#character/${h(c.id)}">
    <div class="card-char-img">${cover ? `<img ${imgAttrs(cover, c.name)}>` : `<div class="ph" aria-hidden="true">${h((c.name || '?').trim().charAt(0))}</div>`}</div>
    <div class="card-char-meta">
      <h3 dir="auto">${h(c.name)}</h3>
      <div class="row-wrap">${statusBadge(c.status)}${c.team ? `<span class="muted small" dir="auto">${h(c.team.name)}</span>` : ''}${c.groupName ? `<span class="muted small" dir="auto">${h(c.groupName)}</span>` : ''}
      ${c.is_published === false ? `<span class="badge badge-draft">${h(t('common.draft'))}</span>` : ''}</div>
    </div></a>`;
}

export function imageCard(r) {
  return `<a class="card-img" href="#image/${h(r.id)}">
    <img ${imgAttrs(r, r.image_name)}>
    <div class="card-img-cap"><h3 dir="auto">${h(r.image_name)}</h3>
      <span class="small muted" dir="auto">${h([r.chapter, r.event_name].filter(Boolean).join(' · '))}</span></div></a>`;
}

const loading = () => `<div class="wrap"><div class="skeleton-grid">${'<div class="skel"></div>'.repeat(8)}</div></div>`;
const emptyState = (title, body = '') => `<div class="empty"><div class="empty-icon">${icon('sparkle', 22)}</div><h2>${h(title)}</h2>${body ? `<p class="muted">${h(body)}</p>` : ''}</div>`;

// ─── Home ──────────────────────────────────────────────────────────────
export async function home(main, _, ctx) {
  main.innerHTML = loading();
  const [chars, imgs, teams, seasons, mysteries, showcase] = await Promise.all([
    api.listCharacters(), api.listArchive(), lore.listGroups(), lore.listSeasons(), lore.listMysteries(),
    homeApi.showcaseSeasons().catch(() => []),
  ]);
  if (!ctx.isCurrent()) return;
  const featured = [...chars].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || '')).slice(0, 8);
  const latest = seasons.at(-1);
  const heroPath = latest?.cover_path || imgs[0]?.storage_path;
  const stat = (n, key, href) => `<a class="hero-stat" href="#${href}"><strong>${n}</strong><span>${h(t(key))}</span></a>`;
  const head = (key, href) => `<header class="section-head"><h2 class="section-title">${h(t(key))}</h2>${href ? `<a href="#${href}" class="more">${h(t('common.viewAll'))} <span aria-hidden="true">→</span></a>` : ''}</header>`;
  main.innerHTML = `
    <div id="home-hero"></div>
    <section class="wrap home-stats">
      ${stat(seasons.length, 'nav.seasons', 'seasons')}${stat(chars.length, 'nav.characters', 'characters')}
      ${stat(teams.length, 'nav.groups', 'groups')}${stat(imgs.length, 'nav.images', 'images')}
    </section>
    <section class="wrap section home-countdown" id="home-countdown"></section>
    ${latest && !showcase.length ? `<section class="wrap section">
      ${head('home.latestSeason')}
      <a class="spotlight" href="#season/${h(latest.id)}">
        <div class="spotlight-media">${latest.cover_path ? `<img data-path="${h(latest.cover_path)}" alt="">` : '<span class="ph ph-wide"></span>'}</div>
        <div class="spotlight-copy">
          <p class="eyebrow">${h(chapterSeason(latest) || t('nav.seasons'))}</p>
          <h3 class="spotlight-title" dir="auto">${h(latest.name)}</h3>
          <p class="muted clamp-3" dir="auto">${h(excerpt(latest.summary, 260))}</p>
          <span class="btn btn-small">${h(t('story.readFull'))} <span aria-hidden="true">→</span></span>
        </div>
      </a>
    </section>` : ''}
    ${seasons.length > 1 ? `<section class="wrap section">
      ${head('nav.seasons', 'seasons')}
      <div class="season-strip">${seasons.slice(-10).reverse().map(x => `<a class="season-chip" href="#season/${h(x.id)}">
        ${x.cover_path ? `<img data-path="${h(x.cover_path)}" alt="">` : '<span class="ph ph-wide"></span>'}
        <span class="season-chip-cap"><small>${h(chapterSeason(x))}</small><strong dir="auto">${h(x.name)}</strong></span></a>`).join('')}</div>
    </section>` : ''}
    <section class="wrap section">
      ${head('home.featured', 'characters')}
      ${featured.length ? `<div class="grid-chars">${featured.map(characterCard).join('')}</div>` : emptyState(t('characters.empty'))}
    </section>
    ${teams.length || mysteries.length ? `<section class="wrap section home-split">
      ${teams.length ? `<div>${head('nav.groups', 'groups')}<div class="team-list">${teams.slice(0, 5).map(teamChip).join('')}</div></div>` : ''}
      ${mysteries.length ? `<div>${head('nav.mysteries', 'mysteries')}<div class="mystery-list">${mysteries.slice(0, 5).map(m => `
        <a class="mystery-row" href="#mystery/${h(m.id)}"><span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span><strong dir="auto">${h(m.title)}</strong></a>`).join('')}</div></div>` : ''}
    </section>` : ''}
    <section class="wrap section">
      ${head('home.latestImages', 'images')}
      ${imgs.length ? `<div class="grid-imgs">${imgs.slice(0, 6).map(imageCard).join('')}</div>` : emptyState(t('images.empty'))}
    </section>`;
  // Cinematic seasons showcase (falls back to the classic hero when no season has artwork yet).
  const heroEl = $('#home-hero', main);
  if (showcase.length) renderShowcase(heroEl, showcase);
  else {
    heroEl.innerHTML = `<section class="hero home-hero">
      ${heroPath ? `<div class="hero-bg" data-bg="${h(heroPath)}"></div>` : '<div class="hero-bg hero-bg-empty"></div>'}
      <div class="hero-shade"></div>
      <div class="hero-copy wrap">
        <p class="eyebrow">${h(t('brand.tagline'))}</p>
        <h1 class="display display-xl">${h(t('home.title'))}</h1>
        <p class="lead">${h(t('home.lead'))}</p>
        <div class="row-wrap hero-actions">
          <a class="btn btn-primary btn-lg" href="#story">${h(t('home.readStory'))}</a>
          <a class="btn btn-lg" href="#characters">${h(t('home.browseCharacters'))}</a>
        </div>
      </div></section>`;
  }
  homeCountdown($('#home-countdown', main));
  hydrateMedia(main);
}

const teamChip = g => `<a class="team-row" href="#group/${h(g.id)}">
  <span class="group-logo group-logo-sm">${g.logo_path ? `<img data-path="${h(g.logo_path)}" alt="">` : h((g.name || '?').charAt(0))}</span>
  <span class="team-row-main"><strong dir="auto">${h(g.name)}</strong><small class="muted" dir="auto">${h(excerpt(g.description, 90))}</small></span>
  <span class="count">${h(t('groups.memberCount', { n: g.members?.[0]?.count ?? 0 }))}</span></a>`;

// ─── Character list ────────────────────────────────────────────────────
export async function characters(main, _, ctx) {
  main.innerHTML = loading();
  const teams = await lore.listGroups();
  if (!ctx.isCurrent()) return;
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.characters'))}</p>
      <h1 class="display">${h(t('characters.title'))}</h1>
      <form class="filters" id="filters" role="search">
        <input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto">
        <select name="status" aria-label="${h(t('characters.status'))}">
          <option value="">${h(t('characters.anyStatus'))}</option>
          ${['alive', 'dead', 'unknown'].map(s => `<option value="${s}">${h(t('status.' + s))}</option>`).join('')}
        </select>
        <select name="team" aria-label="${h(t('nav.groups'))}">
          <option value="">${h(t('characters.anyGroup'))}</option>
          ${teams.map(tm => `<option value="${h(tm.id)}">${h(tm.name)}</option>`).join('')}
        </select>
      </form>
    </section>
    <section class="wrap section" id="results">${loading()}</section>`;
  const form = $('#filters', main);
  const run = async () => {
    let list = await api.listCharacters({ search: form.q.value.trim(), status: form.status.value });
    if (form.team.value) {
      const g = await lore.getGroup(form.team.value);
      const ids = new Set((g?.members || []).map(m => m.character.id));
      list = list.filter(c => ids.has(c.id));
    }
    if (!ctx.isCurrent()) return;
    const box = $('#results', main);
    box.innerHTML = list.length ? `<div class="grid-chars">${list.map(characterCard).join('')}</div>` : emptyState(t('characters.empty'));
    hydrateMedia(box);
  };
  form.addEventListener('input', debounce(run, 250));
  form.addEventListener('submit', e => e.preventDefault());
  await run();
}

// ─── Character profile ─────────────────────────────────────────────────
export async function character(main, id, ctx) {
  main.innerHTML = loading();
  const [c, related, groups, appear] = await Promise.all([
    api.getCharacter(id), api.listArchive({ characterId: id }), lore.characterGroups(id), lore.characterAppearances(id),
  ]);
  if (!ctx.isCurrent()) return;
  if (!c) { main.innerHTML = `<section class="wrap">${emptyState(t('error.notFound'))}</section>`; return; }
  renderCharacterProfile(main, { ...c, groups, appear }, { related });
}

/** Also used by the developer preview (images may carry a local _url). */
export function renderCharacterProfile(el, c, { related = [], preview = false } = {}) {
  const cover = coverOf(c);
  const gallery = (c.images || []).filter(i => i !== cover);
  el.innerHTML = `
    <article class="profile">
      ${!c.is_published ? `<div class="draft-banner">${h(t(preview ? 'dev.previewBanner' : 'dev.draftBanner'))}</div>` : ''}
      <header class="profile-hero">
        ${cover ? (cover._url ? `<div class="hero-bg" style="background-image:url('${h(cover._url)}')"></div>` : `<div class="hero-bg" data-bg="${h(cover.storage_path)}"></div>`) : '<div class="hero-bg hero-bg-empty"></div>'}
        <div class="hero-shade"></div>
        <div class="wrap profile-hero-inner">
          <figure class="profile-portrait">${cover ? `<img ${imgAttrs(cover, cover.image_name || c.name)}>` : `<div class="ph">${h((c.name || '?').charAt(0))}</div>`}</figure>
          <div class="profile-id">
            <p class="eyebrow">${(c.groups || []).length ? c.groups.slice(0, 3).map(r => preview ? h(r.group.name) : `<a href="#group/${h(r.group.id)}">${h(r.group.name)}</a>`).join(' · ') : h(t('characters.noGroup'))}</p>
            <h1 class="display display-xl" dir="auto">${h(c.name)}</h1>
            <dl class="facts">
              <div><dt>${h(t('characters.status'))}</dt><dd>${statusBadge(c.status)}</dd></div>
              <div><dt>${h(t('nav.groups'))}</dt><dd dir="auto">${h(String((c.groups || []).length))}</dd></div>
              ${c.appear?.seasons?.length ? `<div><dt>${h(t('nav.seasons'))}</dt><dd>${c.appear.seasons.length}</dd></div>` : ''}
              ${c.updated_at ? `<div><dt>${h(t('common.updated'))}</dt><dd>${h(fmtDate(c.updated_at))}</dd></div>` : ''}
            </dl>
            ${state.isDev && !preview && c.id ? `<a class="btn btn-small" href="#dev/character/${h(c.id)}">${h(t('common.edit'))}</a>` : ''}
          </div>
        </div>
      </header>
      <div class="wrap profile-body">
        <section class="story">
          <h2 class="kicker">${h(t('characters.story'))}</h2>
          <div class="prose prose-story" dir="auto" id="story"></div>
        </section>
        ${cover && (cover.image_name || cover.image_story) ? `
        <aside class="image-note">
          <h2 class="kicker">${h(t('characters.image'))}</h2>
          <h3 dir="auto">${h(cover.image_name || '')}</h3>
          <div class="prose prose-small" dir="auto" id="cover-story"></div>
        </aside>` : ''}
      </div>
      ${(c.groups || []).length ? `<section class="wrap section">
        <h2 class="display">${h(t('characters.groups'))}</h2>
        <div class="rel-cards">${c.groups.map(r => `
          ${preview ? '<div' : `<a href="#group/${h(r.group.id)}"`} class="rel-card">
            <span class="rel-logo">${r.group.logo_path ? `<img data-path="${h(r.group.logo_path)}" alt="">` : h(r.group.name.charAt(0))}</span>
            <span><strong dir="auto">${h(r.group.name)}</strong><small class="badge">${h(relName(r.type))}</small>${r.note ? `<small class="muted" dir="auto">${h(r.note)}</small>` : ''}</span>
          ${preview ? '</div>' : '</a>'}`).join('')}</div></section>` : ''}
      ${c.appear && (c.appear.seasons.length || c.appear.events.length) ? `<section class="wrap section">
        <h2 class="display">${h(t('characters.appearances'))}</h2>
        <div class="two-col">
          ${c.appear.seasons.length ? `<div class="side-card"><h3 class="kicker">${h(t('nav.seasons'))}</h3><ul class="plain-list">${c.appear.seasons.map(x => `<li><a href="#season/${h(x.id)}"><strong dir="auto">${h(x.name)}</strong></a><small class="muted">${h(chapterSeason(x))}</small>${x.note ? `<small dir="auto">${h(x.note)}</small>` : ''}</li>`).join('')}</ul></div>` : ''}
          ${c.appear.events.length ? `<div class="side-card"><h3 class="kicker">${h(t('seasons.events'))}</h3><ul class="plain-list">${c.appear.events.map(e => `<li><a href="#event/${h(e.id)}"><strong dir="auto">${h(e.title)}</strong></a><small class="muted" dir="auto">${h(e.season.name)}</small></li>`).join('')}</ul></div>` : ''}
        </div></section>` : ''}
      ${gallery.length ? `<section class="wrap section">
        <h2 class="display">${h(t('characters.gallery'))}</h2>
        <div class="gallery">${gallery.map((g, i) => `
          <figure class="gallery-item">
            <button class="gallery-open" data-g="${i}" aria-label="${h(t('common.open'))}"><img ${imgAttrs(g, g.image_name)}></button>
            <figcaption><strong dir="auto">${h(g.image_name || '')}</strong>
              <div class="prose prose-small" dir="auto" data-gstory="${i}"></div></figcaption>
          </figure>`).join('')}</div></section>` : ''}
      ${related.length ? `<section class="wrap section">
        <h2 class="display">${h(t('characters.related'))}</h2>
        <div class="grid-imgs">${related.map(imageCard).join('')}</div></section>` : ''}
    </article>`;
  renderRich($('#story', el), c.story || `<p class="muted">${h(t('characters.noStory'))}</p>`);
  if ($('#cover-story', el)) renderRich($('#cover-story', el), cover.image_story);
  $$('[data-gstory]', el).forEach(d => renderRich(d, gallery[+d.dataset.gstory].image_story));
  $$('.gallery-open', el).forEach(b => b.onclick = () => lightbox(gallery[+b.dataset.g]));
  hydrateMedia(el);
}

function lightbox(img) {
  const body = document.createElement('div');
  body.className = 'lightbox';
  body.innerHTML = `<img ${imgAttrs(img, img.image_name)}>`;
  hydrateMedia(body);
  modal({ title: img.image_name || '', body, wide: true, className: 'modal-dark' });
}

// ─── Teams ─────────────────────────────────────────────────────────────
export async function teams() { go('groups'); }
async function legacyTeams(main, _, ctx) {
  main.innerHTML = loading();
  const list = await api.listTeams();
  if (!ctx.isCurrent()) return;
  main.innerHTML = `
    <section class="wrap page-head"><p class="eyebrow">${h(t('nav.teams'))}</p><h1 class="display">${h(t('teams.title'))}</h1></section>
    <section class="wrap section">
      ${list.length ? `<div class="team-list">${list.map(tm => `
        <a class="team-row" href="#team/${h(tm.id)}">
          <div><h2 dir="auto">${h(tm.name)}</h2><p class="muted" dir="auto">${h(excerpt(textToHtml(tm.description), 180))}</p></div>
          <span class="count">${h(t('teams.count', { n: tm.characters?.[0]?.count ?? 0 }))}</span>
        </a>`).join('')}</div>` : emptyState(t('teams.empty'))}
    </section>`;
}

export async function team(main, id) { go('group/' + id); }
async function legacyTeam(main, id, ctx) {
  main.innerHTML = loading();
  const tm = await api.getTeam(id);
  if (!ctx.isCurrent()) return;
  if (!tm) { main.innerHTML = `<section class="wrap">${emptyState(t('error.notFound'))}</section>`; return; }
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow"><a href="#teams">${h(t('nav.teams'))}</a></p>
      <h1 class="display" dir="auto">${h(tm.name)}</h1>
      <div class="prose lead-prose">${textToHtml(tm.description)}</div>
    </section>
    <section class="wrap section">
      <h2 class="kicker">${h(t('teams.members'))}</h2>
      ${tm.characters.length ? `<div class="grid-chars">${tm.characters.map(c => characterCard({ ...c, team: null })).join('')}</div>` : emptyState(t('teams.noMembers'))}
    </section>`;
  hydrateMedia(main);
}

// ─── Image archive ─────────────────────────────────────────────────────
export async function images(main, _, ctx) {
  main.innerHTML = loading();
  const facets = await api.archiveFacets();
  if (!ctx.isCurrent()) return;
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.images'))}</p>
      <h1 class="display">${h(t('images.title'))}</h1>
      <form class="filters" id="filters" role="search">
        <input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto">
        <select name="chapter" aria-label="${h(t('images.chapter'))}">
          <option value="">${h(t('images.anyChapter'))}</option>
          ${facets.chapters.map(c => `<option>${h(c)}</option>`).join('')}
        </select>
      </form>
    </section>
    <section class="wrap section" id="results"></section>`;
  const form = $('#filters', main);
  const run = async () => {
    const list = await api.listArchive({ search: form.q.value.trim(), chapter: form.chapter.value });
    if (!ctx.isCurrent()) return;
    const box = $('#results', main);
    box.innerHTML = list.length ? `<div class="grid-imgs grid-masonry">${list.map(imageCard).join('')}</div>` : emptyState(t('images.empty'));
    hydrateMedia(box);
  };
  form.addEventListener('input', debounce(run, 250));
  form.addEventListener('submit', e => e.preventDefault());
  await run();
}

export async function image(main, id, ctx) {
  main.innerHTML = loading();
  const rec = await api.getArchive(id);
  if (!ctx.isCurrent()) return;
  if (!rec) { main.innerHTML = `<section class="wrap">${emptyState(t('error.notFound'))}</section>`; return; }
  renderImageDetail(main, rec);
}

/** Cinematic editorial image page (also used for developer preview). */
export function renderImageDetail(el, rec, { preview = false } = {}) {
  const src = rec._url ? `style="background-image:url('${h(rec._url)}')"` : `data-bg="${h(rec.storage_path)}"`;
  const charLink = rec.character
    ? (preview ? h(rec.character.name) : `<a href="#character/${h(rec.character.id)}">${h(rec.character.name)}</a>`) : '';
  el.innerHTML = `
    <article class="imgpage">
      ${!rec.is_published ? `<div class="draft-banner">${h(t(preview ? 'dev.previewBanner' : 'dev.draftBanner'))}</div>` : ''}
      <div class="stage">
        <div class="stage-bg" ${src}></div>
        <figure class="stage-fig"><img ${imgAttrs(rec, rec.image_name)}></figure>
      </div>
      <div class="wrap imgpage-body">
        <header class="imgpage-head">
          <p class="eyebrow">${h([rec.chapter, rec.event_name].filter(Boolean).join(' · ') || t('nav.images'))}</p>
          <h1 class="display display-xl" dir="auto">${h(rec.image_name)}</h1>
        </header>
        <div class="imgpage-cols">
          <div class="prose prose-story" dir="auto" id="img-story"></div>
          <aside class="meta-card">
            <dl class="facts facts-col">
              ${rec.character ? `<div><dt>${h(t('images.character'))}</dt><dd dir="auto">${charLink}</dd></div>` : ''}
              ${rec.event_name ? `<div><dt>${h(t('images.event'))}</dt><dd dir="auto">${h(rec.event_name)}</dd></div>` : ''}
              ${(rec.events || []).filter(e => e.event).length ? `<div><dt>${h(t('seasons.events'))}</dt><dd class="chip-row">${rec.events.filter(e => e.event).map(e => preview ? `<span class="tag" dir="auto">${h(e.event.title)}</span>` : `<a class="tag" href="#event/${h(e.event.id)}" dir="auto">${h(e.event.title)}</a>`).join('')}</dd></div>` : ''}
              ${rec.season ? `<div><dt>${h(t('seasons.season'))}</dt><dd dir="auto">${preview ? h(rec.season.name) : `<a href="#season/${h(rec.season.id)}">${h(rec.season.name)}</a>`}</dd></div>` : ''}
              ${rec.chapter ? `<div><dt>${h(t('images.chapter'))}</dt><dd dir="auto">${h(rec.chapter)}</dd></div>` : ''}
              <div><dt>${h(t('images.uploaded'))}</dt><dd>${h(fmtDate(rec.uploaded_at || new Date().toISOString()))}</dd></div>
            </dl>
            ${state.isDev && !preview ? `<a class="btn btn-small" href="#dev/image/${h(rec.id)}">${h(t('common.edit'))}</a>` : ''}
          </aside>
        </div>
      </div>
    </article>`;
  renderRich($('#img-story', el), rec.story || `<p class="muted">${h(t('images.noStory'))}</p>`);
  hydrateMedia(el);
}
