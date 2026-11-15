import { t } from '../i18n.js';
import { h, $, $$, excerpt, debounce, fmtDate } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as lore from '../api-lore.js';
import { state } from '../state.js';
import { renderRich, characterCard, imageCard, imgAttrs } from './public.js';
import { groupCard } from './groups.js';
import { seasonLabel } from '../components.js';

const loading = () => `<div class="wrap"><div class="skeleton-grid">${'<div class="skel"></div>'.repeat(6)}</div></div>`;
const empty = msg => `<div class="empty"><p class="muted">${h(msg)}</p></div>`;
const hasText = html => !!(html && (html.replace(/<[^>]+>/g, '').trim() || /<img/.test(html)));
const dateRange = s => [s.release_date, s.end_date].filter(Boolean).map(fmtDate).join(' – ');

export function seasonCard(s) {
  const cover = s._coverUrl ? { _url: s._coverUrl } : (s.cover_path ? { storage_path: s.cover_path } : null);
  return `<a class="card-season" href="#season/${h(s.id)}">
    <div class="card-season-img">${cover ? `<img ${imgAttrs(cover, s.name)}>` : '<div class="ph ph-wide"></div>'}</div>
    <div class="card-season-meta">
      <p class="eyebrow">${h(seasonLabel(s) || t('nav.seasons'))}</p>
      <h3 dir="auto">${h(s.name)}</h3>
      ${s.release_date ? `<p class="small muted">${h(dateRange(s))}</p>` : ''}
      ${s.summary ? `<p class="small muted clamp-3" dir="auto">${h(excerpt(s.summary, 150))}</p>` : ''}
      ${s.is_published === false ? `<span class="badge badge-draft">${h(t('common.draft'))}</span>` : ''}
    </div></a>`;
}

const byChapter = list => {
  const m = new Map();
  for (const s of list) {
    const k = s.chapter_number ?? '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(s);
  }
  return [...m.entries()];
};
const chapterTitle = k => k === '—' ? t('seasons.otherSeasons') : t('seasons.chapterN', { n: k });

// ─── Seasons list ──────────────────────────────────────────────────────
export async function seasons(main, _, ctx) {
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.seasons'))}</p>
      <h1 class="display">${h(t('seasons.title'))}</h1>
      <p class="lead">${h(t('seasons.lead'))}</p>
      <form class="filters" id="filters" role="search"><input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto"></form>
    </section>
    <section class="wrap section" id="results">${loading()}</section>`;
  const form = $('#filters', main);
  const run = async () => {
    const list = await lore.listSeasons({ search: form.q.value.trim() });
    if (!ctx.isCurrent()) return;
    const box = $('#results', main);
    box.innerHTML = list.length ? byChapter(list).map(([k, ss]) => `
      <div class="chapter-block">
        <header class="section-head"><h2 class="display">${h(chapterTitle(k))}</h2>${k !== '—' ? `<a class="more" href="#chapter/${h(k)}">${h(t('seasons.openChapter'))} →</a>` : ''}</header>
        <div class="grid-seasons">${ss.map(seasonCard).join('')}</div>
      </div>`).join('') : empty(t('seasons.empty'));
    hydrateMedia(box);
  };
  form.oninput = debounce(run, 250); form.onsubmit = e => e.preventDefault();
  await run();
}

// ─── Chapters ──────────────────────────────────────────────────────────
export async function chapters(main, _, ctx) {
  main.innerHTML = loading();
  const list = await lore.listSeasons();
  if (!ctx.isCurrent()) return;
  const groups = byChapter(list).filter(([k]) => k !== '—');
  main.innerHTML = `
    <section class="wrap page-head"><p class="eyebrow">${h(t('nav.chapters'))}</p><h1 class="display">${h(t('chapters.title'))}</h1>
      <p class="lead">${h(t('chapters.lead'))}</p></section>
    <section class="wrap section">
      ${groups.length ? `<div class="chapter-list">${groups.map(([k, ss]) => {
        const cover = ss.find(s => s.cover_path);
        const first = ss.find(s => s.release_date)?.release_date, last = [...ss].reverse().find(s => s.end_date || s.release_date);
        return `<a class="chapter-card" href="#chapter/${h(k)}">
          ${cover ? `<div class="chapter-bg" data-bg="${h(cover.cover_path)}"></div>` : '<div class="chapter-bg hero-bg-empty"></div>'}
          <div class="chapter-shade"></div>
          <div class="chapter-copy">
            <span class="chapter-num">${h(String(k).padStart(2, '0'))}</span>
            <div><h2 class="display">${h(chapterTitle(k))}</h2>
              <p class="small">${h(t('chapters.seasonCount', { n: ss.length }))}${first ? ' · ' + h([first, last?.end_date || last?.release_date].filter(Boolean).map(d => new Date(d).getFullYear()).filter((v, i, a) => a.indexOf(v) === i).join('–')) : ''}</p></div>
          </div></a>`;
      }).join('')}</div>` : empty(t('seasons.empty'))}
    </section>`;
  hydrateMedia(main);
}

export async function chapter(main, num, ctx) {
  main.innerHTML = loading();
  const list = await lore.listSeasons({ chapter: +num });
  if (!ctx.isCurrent()) return;
  main.innerHTML = `
    <section class="wrap page-head"><p class="eyebrow"><a href="#chapters">${h(t('nav.chapters'))}</a></p>
      <h1 class="display display-xl">${h(t('seasons.chapterN', { n: num }))}</h1></section>
    <section class="wrap section">
      ${list.length ? `<ol class="chapter-seasons">${list.map(s => `<li>${seasonCard(s)}</li>`).join('')}</ol>` : empty(t('seasons.empty'))}
    </section>`;
  hydrateMedia(main);
}

// ─── Story archive: the whole saga as a readable table of contents ────
export async function storyArchive(main, _, ctx) {
  main.innerHTML = loading();
  const list = await lore.listSeasons();
  if (!ctx.isCurrent()) return;
  main.innerHTML = `
    <section class="wrap page-head"><p class="eyebrow">${h(t('nav.story'))}</p><h1 class="display">${h(t('story.title'))}</h1>
      <p class="lead">${h(t('story.lead'))}</p></section>
    <section class="wrap section story-archive">
      ${list.length ? byChapter(list).map(([k, ss]) => `
        <div class="saga-chapter">
          <h2 class="saga-ch-title display">${h(chapterTitle(k))}</h2>
          <ol class="saga-list">${ss.map(s => `
            <li class="saga-item">
              <a href="#season/${h(s.id)}" class="saga-link">
                <span class="saga-tag">${h(seasonLabel(s))}</span>
                <h3 dir="auto">${h(s.name)}</h3>
                ${s.release_date ? `<span class="small muted">${h(dateRange(s))}</span>` : ''}
              </a>
              <div class="prose prose-small" dir="auto" data-sum="${h(s.id)}"></div>
              <a class="more" href="#season/${h(s.id)}">${h(t('story.readFull'))} →</a>
            </li>`).join('')}</ol>
        </div>`).join('') : empty(t('seasons.empty'))}
    </section>`;
  $$('[data-sum]', main).forEach(d => renderRich(d, list.find(s => s.id === d.dataset.sum).summary));
}

// ─── Season page ───────────────────────────────────────────────────────
export async function season(main, id, ctx) {
  main.innerHTML = loading();
  const s = await lore.getSeason(id);
  if (!ctx.isCurrent()) return;
  if (!s) { main.innerHTML = `<section class="wrap">${empty(t('error.notFound'))}</section>`; return; }
  renderSeasonPage(main, s);
}

export function renderSeasonPage(el, s, { preview = false } = {}) {
  const cover = s._coverUrl ? { _url: s._coverUrl } : (s.cover_path ? { storage_path: s.cover_path } : null);
  const toc = [
    ['intro', 'seasons.summary', hasText(s.summary)], ['story', 'seasons.story', hasText(s.story)],
    ['timeline', 'seasons.timeline', s.events.length], ['characters', 'seasons.characters', s.characters.length],
    ['groups', 'seasons.groups', s.groups.length], ['discoveries', 'seasons.discoveries', hasText(s.discoveries)],
    ['missions', 'seasons.missions', hasText(s.missions)], ['mysteries', 'nav.mysteries', (s.mysteries || []).length],
    ['images', 'seasons.images', s.images.length + (s.archive || []).length], ['refs', 'seasons.references', s.refs.length],
  ].filter(x => x[2]);
  const link = (href, inner) => preview ? inner : `<a href="${href}">${inner}</a>`;
  el.innerHTML = `
    <article class="season-page">
      ${!s.is_published ? `<div class="draft-banner">${h(t(preview ? 'dev.previewBanner' : 'dev.draftBanner'))}</div>` : ''}
      <header class="season-hero">
        ${cover ? (cover._url ? `<div class="hero-bg" style="background-image:url('${h(cover._url)}')"></div>` : `<div class="hero-bg" data-bg="${h(cover.storage_path)}"></div>`) : '<div class="hero-bg hero-bg-empty"></div>'}
        <div class="hero-shade"></div>
        <div class="wrap season-hero-copy">
          <p class="eyebrow">${s.chapter_number != null && !preview ? `<a href="#chapter/${h(s.chapter_number)}">${h(seasonLabel(s))}</a>` : h(seasonLabel(s) || t('nav.seasons'))}</p>
          <h1 class="display display-xl" dir="auto">${h(s.name)}</h1>
          <dl class="facts">
            ${s.chapter_number != null ? `<div><dt>${h(t('seasons.chapter'))}</dt><dd>${h(s.chapter_number)}</dd></div>` : ''}
            ${s.season_number != null ? `<div><dt>${h(t('seasons.season'))}</dt><dd>${h(s.season_number)}</dd></div>` : ''}
            ${s.release_date ? `<div><dt>${h(t('seasons.release'))}</dt><dd>${h(fmtDate(s.release_date))}</dd></div>` : ''}
            ${s.end_date ? `<div><dt>${h(t('seasons.end'))}</dt><dd>${h(fmtDate(s.end_date))}</dd></div>` : ''}
            ${s.events.length ? `<div><dt>${h(t('seasons.events'))}</dt><dd>${s.events.length}</dd></div>` : ''}
          </dl>
          ${state.isDev && !preview && s.id ? `<a class="btn btn-small" href="#dev/season/${h(s.id)}">${h(t('common.edit'))}</a>` : ''}
        </div>
      </header>
      ${toc.length > 2 ? `<nav class="season-toc wrap" aria-label="${h(t('seasons.contents'))}">${toc.map(([k, key]) => `<button type="button" data-jump="${k}">${h(t(key))}</button>`).join('')}</nav>` : ''}
      <div class="wrap season-body">
        ${hasText(s.summary) ? `<section id="sec-intro" class="season-intro"><div class="prose lead-prose prose-intro" dir="auto" data-rich="summary"></div></section>` : ''}
        ${hasText(s.story) ? `<section id="sec-story" class="lore-block"><h2 class="kicker">${h(t('seasons.story'))}</h2><div class="prose prose-story" dir="auto" data-rich="story"></div></section>` : ''}
        ${s.events.length ? `<section id="sec-timeline" class="lore-block">
          <h2 class="display">${h(t('seasons.timeline'))}</h2>
          <ol class="timeline">${s.events.map((e, i) => `
            <li class="tl-item">
              <span class="tl-dot" aria-hidden="true">${i + 1}</span>
              <div class="tl-card">
                ${e.image_path || e._url ? `<div class="tl-img"><img ${imgAttrs(e._url ? { _url: e._url } : { storage_path: e.image_path }, e.title)}></div>` : ''}
                <div class="tl-body">
                  ${e.event_date ? `<p class="small muted">${h(fmtDate(e.event_date))}</p>` : ''}
                  <h3 dir="auto">${link(`#event/${h(e.id)}`, h(e.title))}</h3>
                  <div class="prose prose-small" dir="auto" data-ev="${i}"></div>
                  ${(e.characters.length || e.groups.length) ? `<div class="chip-row">${e.characters.map(c => link(`#character/${h(c.id)}`, `<span class="tag" dir="auto">${h(c.name)}</span>`)).join('')}${e.groups.map(g => link(`#group/${h(g.id)}`, `<span class="tag tag-group" dir="auto">${h(g.name)}</span>`)).join('')}</div>` : ''}
                </div>
              </div>
            </li>`).join('')}</ol>
        </section>` : ''}
        ${s.characters.length ? `<section id="sec-characters" class="lore-block"><h2 class="display">${h(t('seasons.characters'))}</h2>
          <div class="grid-chars">${s.characters.map(c => `<div class="member-wrap">${characterCard({ ...c.character, team: null })}${c.note ? `<p class="small muted member-note" dir="auto">${h(c.note)}</p>` : ''}</div>`).join('')}</div></section>` : ''}
        ${s.groups.length ? `<section id="sec-groups" class="lore-block"><h2 class="display">${h(t('seasons.groups'))}</h2>
          <div class="grid-groups">${s.groups.map(g => `<div class="member-wrap">${groupCard(g.group)}${g.note ? `<p class="small muted member-note" dir="auto">${h(g.note)}</p>` : ''}</div>`).join('')}</div></section>` : ''}
        <div class="two-col">
          ${hasText(s.discoveries) ? `<section id="sec-discoveries" class="lore-block side-card"><h2 class="kicker">${h(t('seasons.discoveries'))}</h2><div class="prose prose-small" dir="auto" data-rich="discoveries"></div></section>` : ''}
          ${hasText(s.missions) ? `<section id="sec-missions" class="lore-block side-card"><h2 class="kicker">${h(t('seasons.missions'))}</h2><div class="prose prose-small" dir="auto" data-rich="missions"></div></section>` : ''}
        </div>
        ${(s.mysteries || []).length ? `<section id="sec-mysteries" class="lore-block"><h2 class="display">${h(t('nav.mysteries'))}</h2>
          <div class="mystery-list">${s.mysteries.map(m => link(`#mystery/${h(m.id)}`, `<div class="mystery-row"><span class="badge mys-${h(m.status)}">${h(t('mysteries.' + m.status))}</span><strong dir="auto">${h(m.title)}</strong><span class="muted small" dir="auto">${h(excerpt(m.body, 140))}</span></div>`)).join('')}</div></section>` : ''}
        ${s.images.length || (s.archive || []).length ? `<section id="sec-images" class="lore-block"><h2 class="display">${h(t('seasons.images'))}</h2>
          ${s.images.length ? `<div class="gallery">${s.images.map((im, i) => `<figure class="gallery-item"><div class="gallery-open"><img ${imgAttrs(im, im.image_name)}></div>
            <figcaption><strong dir="auto">${h(im.image_name || '')}</strong><div class="prose prose-small" dir="auto" data-si="${i}"></div></figcaption></figure>`).join('')}</div>` : ''}
          ${(s.archive || []).length ? `<h3 class="kicker" style="margin-top:28px">${h(t('seasons.fromArchive'))}</h3><div class="grid-imgs">${s.archive.map(imageCard).join('')}</div>` : ''}
        </section>` : ''}
        ${s.refs.length ? `<section id="sec-refs" class="lore-block"><h2 class="kicker">${h(t('seasons.references'))}</h2>
          <ol class="refs">${s.refs.map(r => `<li><strong dir="auto">${r.url ? `<a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">${h(r.title)}</a>` : h(r.title)}</strong>${r.note ? ` <span class="muted" dir="auto">— ${h(r.note)}</span>` : ''}</li>`).join('')}</ol></section>` : ''}
      </div>
    </article>`;
  $$('[data-rich]', el).forEach(d => renderRich(d, s[d.dataset.rich]));
  $$('[data-ev]', el).forEach(d => renderRich(d, s.events[+d.dataset.ev].body));
  $$('[data-si]', el).forEach(d => renderRich(d, s.images[+d.dataset.si].image_story));
  $$('[data-jump]', el).forEach(b => b.onclick = () => $('#sec-' + b.dataset.jump, el)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if (preview) $$('a.card-char, a.card-group, a.card-img', el).forEach(a => a.removeAttribute('href'));
  hydrateMedia(el);
}

// ─── Single event ──────────────────────────────────────────────────────
export async function event(main, id, ctx) {
  main.innerHTML = loading();
  const e = await lore.getEvent(id);
  if (!ctx.isCurrent()) return;
  if (!e) { main.innerHTML = `<section class="wrap">${empty(t('error.notFound'))}</section>`; return; }
  main.innerHTML = `
    <article class="imgpage">
      ${e.image_path ? `<div class="stage stage-short"><div class="stage-bg" data-bg="${h(e.image_path)}"></div><figure class="stage-fig"><img data-path="${h(e.image_path)}" alt="${h(e.title)}"></figure></div>` : ''}
      <div class="wrap imgpage-body">
        <header class="imgpage-head">
          <p class="eyebrow"><a href="#season/${h(e.season.id)}">${h(e.season.name)}</a> · ${h(t('seasons.eventN', { n: e.position + 1 }))}</p>
          <h1 class="display display-xl" dir="auto">${h(e.title)}</h1>
        </header>
        <div class="imgpage-cols">
          <div class="prose prose-story" dir="auto" id="ev-body"></div>
          <aside class="meta-card">
            <dl class="facts facts-col">
              <div><dt>${h(t('seasons.season'))}</dt><dd><a href="#season/${h(e.season.id)}" dir="auto">${h(e.season.name)}</a></dd></div>
              ${e.event_date ? `<div><dt>${h(t('seasons.eventDate'))}</dt><dd>${h(fmtDate(e.event_date))}</dd></div>` : ''}
              ${e.characters.length ? `<div><dt>${h(t('nav.characters'))}</dt><dd class="chip-row">${e.characters.map(c => `<a href="#character/${h(c.id)}" class="tag" dir="auto">${h(c.name)}</a>`).join('')}</dd></div>` : ''}
              ${e.groups.length ? `<div><dt>${h(t('nav.groups'))}</dt><dd class="chip-row">${e.groups.map(g => `<a href="#group/${h(g.id)}" class="tag tag-group" dir="auto">${h(g.name)}</a>`).join('')}</dd></div>` : ''}
            </dl>
            ${state.isDev ? `<a class="btn btn-small" href="#dev/event/${h(e.id)}">${h(t('common.edit'))}</a>` : ''}
          </aside>
        </div>
        ${e.images.length ? `<section class="section"><h2 class="kicker">${h(t('seasons.images'))}</h2><div class="grid-imgs">${e.images.map(imageCard).join('')}</div></section>` : ''}
      </div>
    </article>`;
  renderRich($('#ev-body', main), e.body || `<p>${h(t('seasons.noEventBody'))}</p>`);
  hydrateMedia(main);
}

// ─── Global timeline ───────────────────────────────────────────────────
export async function timeline(main, _, ctx) {
  main.innerHTML = loading();
  const events = await lore.allEvents();
  if (!ctx.isCurrent()) return;
  let lastSeason = null, lastChapter = undefined;
  const items = events.map(e => {
    let head = '';
    if (e.season.chapter_number !== lastChapter) { lastChapter = e.season.chapter_number; head += `<li class="tl-chapter"><h2 class="display">${h(chapterTitle(lastChapter ?? '—'))}</h2></li>`; }
    if (e.season.id !== lastSeason) { lastSeason = e.season.id; head += `<li class="tl-season"><a href="#season/${h(e.season.id)}"><span class="saga-tag">${h(seasonLabel(e.season))}</span> <strong dir="auto">${h(e.season.name)}</strong></a></li>`; }
    return head + `<li class="tl-item tl-compact">
      <span class="tl-dot" aria-hidden="true"></span>
      <a class="tl-card" href="#event/${h(e.id)}">
        ${e.image_path ? `<div class="tl-img"><img data-path="${h(e.image_path)}" alt=""></div>` : ''}
        <div class="tl-body">${e.event_date ? `<p class="small muted">${h(fmtDate(e.event_date))}</p>` : ''}<h3 dir="auto">${h(e.title)}</h3><p class="small muted" dir="auto">${h(excerpt(e.body, 160))}</p></div>
      </a></li>`;
  }).join('');
  main.innerHTML = `
    <section class="wrap page-head"><p class="eyebrow">${h(t('nav.timeline'))}</p><h1 class="display">${h(t('timeline.title'))}</h1>
      <p class="lead">${h(t('timeline.lead'))}</p></section>
    <section class="wrap section">${events.length ? `<ol class="timeline timeline-global">${items}</ol>` : empty(t('timeline.empty'))}</section>`;
  hydrateMedia(main);
}
