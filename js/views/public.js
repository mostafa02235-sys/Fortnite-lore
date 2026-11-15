import { t } from '../i18n.js';
import { h, $, $$, sanitizeHtml, excerpt, fmtDate, statusBadge, textToHtml, debounce, modal } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as api from '../api.js';
import { state } from '../state.js';

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
      <div class="row-wrap">${statusBadge(c.status)}${c.team ? `<span class="muted small" dir="auto">${h(c.team.name)}</span>` : ''}
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
const emptyState = (title, body = '') => `<div class="empty"><h2>${h(title)}</h2>${body ? `<p class="muted">${h(body)}</p>` : ''}</div>`;

// ─── Home ──────────────────────────────────────────────────────────────
export async function home(main, _, ctx) {
  main.innerHTML = loading();
  const [chars, imgs, teams] = await Promise.all([
    api.listCharacters(), api.listArchive(), api.listTeams(),
  ]);
  if (!ctx.isCurrent()) return;
  const featured = [...chars].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || '')).slice(0, 8);
  const heroImg = imgs[0];
  main.innerHTML = `
    <section class="hero">
      ${heroImg ? `<div class="hero-bg" data-bg="${h(heroImg.storage_path)}"></div>` : '<div class="hero-bg hero-bg-empty"></div>'}
      <div class="hero-shade"></div>
      <div class="hero-copy wrap">
        <p class="eyebrow">${h(t('brand.tagline'))}</p>
        <h1 class="display display-xl">${h(t('home.title'))}</h1>
        <p class="lead">${h(t('home.lead'))}</p>
        <div class="row-wrap">
          <a class="btn btn-primary" href="#characters">${h(t('home.browseCharacters'))}</a>
          <a class="btn" href="#images">${h(t('home.browseImages'))}</a>
        </div>
      </div>
    </section>
    <section class="wrap section">
      <header class="section-head"><h2 class="display">${h(t('home.featured'))}</h2><a href="#characters" class="more">${h(t('common.viewAll'))} →</a></header>
      ${featured.length ? `<div class="grid-chars">${featured.map(characterCard).join('')}</div>` : emptyState(t('characters.empty'))}
    </section>
    <section class="wrap section">
      <header class="section-head"><h2 class="display">${h(t('home.latestImages'))}</h2><a href="#images" class="more">${h(t('common.viewAll'))} →</a></header>
      ${imgs.length ? `<div class="grid-imgs">${imgs.slice(0, 6).map(imageCard).join('')}</div>` : emptyState(t('images.empty'))}
    </section>
    ${teams.length ? `<section class="wrap section">
      <header class="section-head"><h2 class="display">${h(t('nav.teams'))}</h2><a href="#teams" class="more">${h(t('common.viewAll'))} →</a></header>
      <div class="team-strip">${teams.slice(0, 8).map(teamChip).join('')}</div></section>` : ''}`;
  hydrateMedia(main);
}

const teamChip = tm => `<a class="team-chip" href="#team/${h(tm.id)}"><strong dir="auto">${h(tm.name)}</strong>
  <span class="muted small">${h(t('teams.count', { n: tm.characters?.[0]?.count ?? 0 }))}</span></a>`;

// ─── Character list ────────────────────────────────────────────────────
export async function characters(main, _, ctx) {
  main.innerHTML = loading();
  const teams = await api.listTeams();
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
        <select name="team" aria-label="${h(t('characters.team'))}">
          <option value="">${h(t('characters.anyTeam'))}</option>
          ${teams.map(tm => `<option value="${h(tm.id)}">${h(tm.name)}</option>`).join('')}
        </select>
      </form>
    </section>
    <section class="wrap section" id="results">${loading()}</section>`;
  const form = $('#filters', main);
  const run = async () => {
    const list = await api.listCharacters({ search: form.q.value.trim(), status: form.status.value, teamId: form.team.value });
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
  const [c, related] = await Promise.all([api.getCharacter(id), api.listArchive({ characterId: id })]);
  if (!ctx.isCurrent()) return;
  if (!c) { main.innerHTML = `<section class="wrap">${emptyState(t('error.notFound'))}</section>`; return; }
  renderCharacterProfile(main, c, { related });
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
            <p class="eyebrow">${c.team ? (preview ? h(c.team.name) : `<a href="#team/${h(c.team.id)}">${h(c.team.name)}</a>`) : h(t('characters.noTeam'))}</p>
            <h1 class="display display-xl" dir="auto">${h(c.name)}</h1>
            <dl class="facts">
              <div><dt>${h(t('characters.status'))}</dt><dd>${statusBadge(c.status)}</dd></div>
              <div><dt>${h(t('characters.team'))}</dt><dd dir="auto">${h(c.team?.name || t('characters.noTeam'))}</dd></div>
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
export async function teams(main, _, ctx) {
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

export async function team(main, id, ctx) {
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
