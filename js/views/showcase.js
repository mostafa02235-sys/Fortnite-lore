// Homepage seasons showcase: a cinematic carousel driven by the Seasons table.
// Crossfading cover artwork, swipe on touch, keyboard arrows, autoplay that
// pauses on hover/focus/hidden tabs, and RTL-aware direction.
import { t, getLang } from '../i18n.js';
import { h, $, $$, excerpt } from '../util.js';
import { signedUrls } from '../media.js';
import { icon } from '../icons.js';
import { onLeave } from '../lifecycle.js';
import { seasonLabel } from '../components.js';

const AUTOPLAY_MS = 7000;

export function renderShowcase(el, seasons, { preview = false } = {}) {
  const n = seasons.length;
  const rtl = () => getLang() === 'ar';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = `
    <section class="showcase" aria-roledescription="carousel" aria-label="${h(t('showcase.label'))}" tabindex="-1">
      <div class="sc-slides">${seasons.map((s, i) => `
        <div class="sc-slide" data-i="${i}" aria-hidden="true"><div class="sc-bg" data-path="${h(s.cover_path || '')}" ${s._url ? `data-url="${h(s._url)}"` : ''}></div></div>`).join('')}</div>
      <div class="sc-shade" aria-hidden="true"></div>
      <div class="wrap sc-inner">
        <div class="sc-copy" aria-live="polite"></div>
        ${n > 1 ? `<div class="sc-controls">
          <div class="sc-dots" role="tablist" aria-label="${h(t('showcase.choose'))}">${seasons.map((s, i) => `
            <button type="button" class="sc-dot" role="tab" data-go="${i}" aria-label="${h(s.name)}">
              <span class="sc-dot-bar"><span class="sc-dot-fill"></span></span>
              <span class="sc-dot-label"><small>${h(seasonLabel(s) || '')}</small><span dir="auto">${h(s.name)}</span></span>
            </button>`).join('')}</div>
          <div class="sc-arrows">
            <button type="button" class="sc-arrow" data-step="-1" aria-label="${h(t('showcase.prev'))}">${icon('arrow', 18)}</button>
            <button type="button" class="sc-arrow sc-next" data-step="1" aria-label="${h(t('showcase.next'))}">${icon('arrow', 18)}</button>
          </div>
        </div>` : ''}
      </div>
    </section>`;
  const root = $('.showcase', el);
  const slides = $$('.sc-slide', root), dots = $$('.sc-dot', root), copy = $('.sc-copy', root);
  let cur = -1, timer = null, paused = false, startedAt = 0, remaining = AUTOPLAY_MS;

  // Load artwork for a slide and its neighbours only (lazy).
  const loaded = new Set();
  async function load(idxs) {
    const want = idxs.map(i => (i + n) % n).filter(i => !loaded.has(i));
    if (!want.length) return;
    want.forEach(i => loaded.add(i));
    const bgs = want.map(i => $('.sc-bg', slides[i]));
    const paths = bgs.map(b => b.dataset.path).filter(Boolean);
    const urls = paths.length ? await signedUrls(paths) : {};
    for (const b of bgs) {
      const u = b.dataset.url || urls[b.dataset.path];
      if (!u) continue;
      const img = new Image();
      img.onload = () => { b.style.backgroundImage = `url("${u}")`; b.classList.add('ready'); };
      img.src = u;
    }
  }

  function show(i, { user = false } = {}) {
    i = (i + n) % n;
    if (i === cur) return;
    const s = seasons[i];
    slides.forEach((sl, k) => { sl.classList.toggle('is-active', k === i); sl.setAttribute('aria-hidden', String(k !== i)); });
    dots.forEach((d, k) => { d.classList.toggle('is-active', k === i); d.setAttribute('aria-selected', String(k === i)); });
    const desc = s.home_tagline || excerpt(s.summary, 200);
    copy.classList.remove('in'); void copy.offsetWidth;
    copy.innerHTML = `
      <p class="eyebrow sc-eyebrow">${icon('calendar', 14)} ${h(seasonLabel(s) || t('nav.seasons'))}${n > 1 ? `<span class="sc-count">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span>` : ''}</p>
      <h1 class="display display-xl sc-title" dir="auto">${h(s.name)}</h1>
      ${desc ? `<p class="lead sc-desc" dir="auto">${h(desc)}</p>` : ''}
      <div class="row-wrap hero-actions">
        ${preview ? `<span class="btn btn-primary btn-lg">${h(t('showcase.explore'))}</span>`
          : `<a class="btn btn-primary btn-lg" href="#season/${h(s.id)}">${h(t('showcase.explore'))} <span aria-hidden="true">→</span></a>
             <a class="btn btn-lg btn-onimage" href="#story">${h(t('home.readStory'))}</a>`}
      </div>`;
    copy.classList.add('in');
    cur = i;
    load([i, i + 1, i - 1]);
    if (user) restart();
  }

  // Autoplay with a visible progress bar on the active indicator.
  function schedule(ms) {
    clearTimeout(timer);
    if (n < 2 || reduced || paused) return;
    startedAt = performance.now(); remaining = ms;
    root.style.setProperty('--sc-ms', ms + 'ms');
    root.classList.remove('playing'); void root.offsetWidth; root.classList.add('playing');
    timer = setTimeout(() => { show(cur + 1); schedule(AUTOPLAY_MS); }, ms);
  }
  const restart = () => schedule(AUTOPLAY_MS);
  function pause() {
    if (paused) return;
    paused = true; clearTimeout(timer);
    remaining = Math.max(400, remaining - (performance.now() - startedAt));
    root.classList.add('paused');
  }
  function resume() {
    if (!paused) return;
    paused = false; root.classList.remove('paused');
    schedule(remaining);
  }

  root.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) show(+go.dataset.go, { user: true });
    const st = e.target.closest('[data-step]'); if (st) show(cur + (+st.dataset.step), { user: true });
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const fwd = (e.key === 'ArrowRight') !== rtl();
    show(cur + (fwd ? 1 : -1), { user: true });
  });
  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) resume(); });

  // Swipe (touch / pen / mouse drag)
  let sx = null, sy = 0, moved = false;
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button') || n < 2) return;
    sx = e.clientX; sy = e.clientY; moved = false;
  });
  root.addEventListener('pointermove', e => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - sy)) { moved = true; root.style.setProperty('--sc-drag', dx + 'px'); root.classList.add('dragging'); }
  });
  const end = e => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    root.classList.remove('dragging'); root.style.removeProperty('--sc-drag');
    if (moved && Math.abs(dx) > 50) {
      const toNext = (dx < 0) !== rtl();   // swipe left = next (LTR), right = next (RTL)
      show(cur + (toNext ? 1 : -1), { user: true });
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', () => { sx = null; root.classList.remove('dragging'); });

  const onVis = () => (document.hidden ? pause() : resume());
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); });

  show(0);
  restart();
  return { show, get index() { return cur; } };
}
