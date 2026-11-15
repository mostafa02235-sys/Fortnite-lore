import { t, getLang } from '../i18n.js';
import { h, $, $$, excerpt, debounce, fmtDate } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as lore from '../api-lore.js';
import { state } from '../state.js';
import { renderRich, characterCard, imgAttrs } from './public.js';
import { seasonLabel } from '../components.js';

const loading = () => `<div class="wrap"><div class="skeleton-grid">${'<div class="skel"></div>'.repeat(6)}</div></div>`;
const empty = (msg) => `<div class="empty"><p class="muted">${h(msg)}</p></div>`;
export const relLabel = ty => ty ? ((getLang() === 'ar' && ty.label_ar) ? ty.label_ar : ty.label_en) : '';

export function groupCard(g) {
  const n = g.members?.[0]?.count ?? null;
  return `<a class="card-group" href="#group/${h(g.id)}">
    <div class="group-logo">${g.logo_path || g._url ? `<img ${imgAttrs(g._url ? { _url: g._url } : { storage_path: g.logo_path }, g.name)}>` : `<span>${h((g.name || '?').charAt(0))}</span>`}</div>
    <div class="card-group-meta">
      <h3 dir="auto">${h(g.name)}</h3>
      <p class="muted small" dir="auto">${h(excerpt(g.description, 120))}</p>
      <div class="row-wrap small">
        ${g.status ? `<span class="badge" dir="auto">${h(g.status)}</span>` : ''}
        ${n !== null ? `<span class="muted">${h(t('groups.memberCount', { n }))}</span>` : ''}
        ${g.is_published === false ? `<span class="badge badge-draft">${h(t('common.draft'))}</span>` : ''}
      </div>
    </div></a>`;
}

export async function groups(main, _, ctx) {
  main.innerHTML = `
    <section class="wrap page-head">
      <p class="eyebrow">${h(t('nav.groups'))}</p>
      <h1 class="display">${h(t('groups.title'))}</h1>
      <p class="lead">${h(t('groups.lead'))}</p>
      <form class="filters" id="filters" role="search"><input type="search" name="q" placeholder="${h(t('common.search'))}" aria-label="${h(t('common.search'))}" dir="auto"></form>
    </section>
    <section class="wrap section" id="results">${loading()}</section>`;
  const form = $('#filters', main);
  const run = async () => {
    const list = await lore.listGroups({ search: form.q.value.trim() });
    if (!ctx.isCurrent()) return;
    const box = $('#results', main);
    box.innerHTML = list.length ? `<div class="grid-groups">${list.map(groupCard).join('')}</div>` : empty(t('groups.empty'));
    hydrateMedia(box);
  };
  form.oninput = debounce(run, 250); form.onsubmit = e => e.preventDefault();
  await run();
}

export async function group(main, id, ctx) {
  main.innerHTML = loading();
  const g = await lore.getGroup(id);
  if (!ctx.isCurrent()) return;
  if (!g) { main.innerHTML = `<section class="wrap">${empty(t('error.notFound'))}</section>`; return; }
  renderGroupProfile(main, g);
}

/** Group profile page (also used by the developer preview). */
export function renderGroupProfile(el, g, { preview = false } = {}) {
  const logo = g._logoUrl ? { _url: g._logoUrl } : (g.logo_path ? { storage_path: g.logo_path } : null);
  // Members grouped by relationship label
  const byType = new Map();
  for (const m of g.members) {
    const k = m.type?.id || '_';
    if (!byType.has(k)) byType.set(k, { type: m.type, rows: [] });
    byType.get(k).rows.push(m);
  }
  const section = (key, titleKey, html) => html && html.replace(/<[^>]+>/g, '').trim() || /<img/.test(html || '')
    ? `<section class="lore-block"><h2 class="kicker">${h(t(titleKey))}</h2><div class="prose prose-story" dir="auto" data-rich="${key}"></div></section>` : '';
  el.innerHTML = `
    <article class="profile group-page">
      ${!g.is_published ? `<div class="draft-banner">${h(t(preview ? 'dev.previewBanner' : 'dev.draftBanner'))}</div>` : ''}
      <header class="profile-hero">
        ${logo ? (logo._url ? `<div class="hero-bg" style="background-image:url('${h(logo._url)}')"></div>` : `<div class="hero-bg" data-bg="${h(logo.storage_path)}"></div>`) : '<div class="hero-bg hero-bg-empty"></div>'}
        <div class="hero-shade"></div>
        <div class="wrap group-hero-inner">
          <figure class="group-emblem">${logo ? `<img ${imgAttrs(logo, g.name)}>` : `<span>${h((g.name || '?').charAt(0))}</span>`}</figure>
          <div>
            <p class="eyebrow">${preview ? h(t('nav.groups')) : `<a href="#groups">${h(t('nav.groups'))}</a>`}</p>
            <h1 class="display display-xl" dir="auto">${h(g.name)}</h1>
            <dl class="facts">
              ${g.status ? `<div><dt>${h(t('groups.status'))}</dt><dd dir="auto">${h(g.status)}</dd></div>` : ''}
              <div><dt>${h(t('groups.members'))}</dt><dd>${h(String(new Set(g.members.map(m => m.character.id)).size))}</dd></div>
              ${g.seasons.length ? `<div><dt>${h(t('nav.seasons'))}</dt><dd>${h(String(g.seasons.length))}</dd></div>` : ''}
            </dl>
            ${state.isDev && !preview && g.id ? `<a class="btn btn-small" href="#dev/group/${h(g.id)}">${h(t('common.edit'))}</a>` : ''}
          </div>
        </div>
      </header>
      <div class="wrap profile-body">
        <div class="lore-col">
          ${g.description ? `<div class="prose lead-prose group-desc" dir="auto" data-rich="description"></div>` : ''}
          ${section('story', 'groups.story', g.story)}
          ${section('history', 'groups.history', g.history)}
          ${section('goals', 'groups.goals', g.goals)}
        </div>
        <aside class="side-col">
          ${g.seasons.length ? `<div class="side-card"><h2 class="kicker">${h(t('groups.relatedSeasons'))}</h2>
            <ul class="plain-list">${g.seasons.map(s => `<li>${preview ? '' : `<a href="#season/${h(s.season.id)}">`}<strong dir="auto">${h(s.season.name)}</strong>${preview ? '' : '</a>'}
              <small class="muted">${h(seasonLabel(s.season))}</small>${s.note ? `<small dir="auto">${h(s.note)}</small>` : ''}</li>`).join('')}</ul></div>` : ''}
          ${g.events.length ? `<div class="side-card"><h2 class="kicker">${h(t('groups.relatedEvents'))}</h2>
            <ul class="plain-list">${g.events.map(e => `<li>${preview ? '' : `<a href="#event/${h(e.id)}">`}<strong dir="auto">${h(e.title)}</strong>${preview ? '' : '</a>'}
              <small class="muted" dir="auto">${h(e.season?.name || '')}</small></li>`).join('')}</ul></div>` : ''}
        </aside>
      </div>
      <section class="wrap section">
        <h2 class="display">${h(t('groups.members'))}</h2>
        ${g.members.length ? [...byType.values()].map(({ type, rows }) => `
          <h3 class="kicker rel-head">${h(relLabel(type) || t('groups.unlabelled'))} · ${rows.length}</h3>
          <div class="grid-chars">${rows.map(m => `
            <div class="member-wrap">${characterCard({ ...m.character, team: null })}
              ${m.note ? `<p class="small muted member-note" dir="auto">${h(m.note)}</p>` : ''}</div>`).join('')}</div>`).join('')
          : empty(t('groups.noMembers'))}
      </section>
      ${g.images.length ? `<section class="wrap section">
        <h2 class="display">${h(t('characters.gallery'))}</h2>
        <div class="gallery">${g.images.map((im, i) => `
          <figure class="gallery-item"><div class="gallery-open"><img ${imgAttrs(im, im.image_name)}></div>
            <figcaption><strong dir="auto">${h(im.image_name || '')}</strong><div class="prose prose-small" dir="auto" data-gi="${i}"></div></figcaption></figure>`).join('')}</div>
      </section>` : ''}
    </article>`;
  $$('[data-rich]', el).forEach(d => renderRich(d, g[d.dataset.rich]));
  $$('[data-gi]', el).forEach(d => renderRich(d, g.images[+d.dataset.gi].image_story));
  if (preview) $$('a.card-char', el).forEach(a => a.removeAttribute('href'));
  hydrateMedia(el);
}
