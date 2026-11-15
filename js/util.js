import { t, getLang } from './i18n.js';

/** Escape text for safe insertion into HTML templates. */
export function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ─── Rich-text sanitizer (allow-list) ────────────────────────────────
// Story HTML is rebuilt node by node; anything not on the list is dropped
// or unwrapped. Used on save AND on render.
const ALLOWED = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
  'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'IMG', 'FIGURE', 'FIGCAPTION', 'HR', 'DIV', 'SPAN']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE',
  'SVG', 'MATH', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'VIDEO', 'AUDIO', 'TITLE', 'HEAD']);
const MEDIA_PATH = /^[a-z]+\/[A-Za-z0-9_\-/.]+$/;

function safeHref(href) {
  const v = String(href || '').trim();
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (/^#[A-Za-z0-9_\-/]*$/.test(v)) return v;
  return null;
}

/**
 * @param {string} html
 * @param {{keepSrc?: boolean}} opts keepSrc keeps blob:/https: src on images
 *        (editor display only; never persisted).
 */
export function sanitizeHtml(html, opts = {}) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const out = document.createDocumentFragment();

  const walk = (node, parent) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(child.nodeValue)); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName;
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) { walk(child, parent); continue; } // unwrap
      let name = tag;
      if (tag === 'H1') name = 'H2';
      const el = document.createElement(name);
      const dir = child.getAttribute('dir');
      if (dir === 'rtl' || dir === 'ltr' || dir === 'auto') el.setAttribute('dir', dir);
      if (tag === 'A') {
        const href = safeHref(child.getAttribute('href'));
        if (!href) { walk(child, parent); continue; }
        el.setAttribute('href', href);
      }
      if (tag === 'IMG') {
        const path = child.getAttribute('data-path') || '';
        if (!MEDIA_PATH.test(path) || path.includes('..')) continue;
        el.setAttribute('data-path', path);
        el.setAttribute('alt', child.getAttribute('alt') || '');
        el.setAttribute('loading', 'lazy');
        const src = child.getAttribute('src') || '';
        if (opts.keepSrc && /^(blob:|https:)/.test(src)) el.setAttribute('src', src);
        parent.appendChild(el);
        continue;
      }
      parent.appendChild(el);
      walk(child, el);
    }
  };
  walk(doc.body, out);
  const box = document.createElement('div');
  box.appendChild(out);
  return box.innerHTML;
}

/** Plain-text length of story HTML (for "is it empty?" checks and counts). */
export function htmlText(html) {
  const d = document.createElement('div');
  d.innerHTML = sanitizeHtml(html);
  return (d.textContent || '').trim();
}
export function hasContent(html) {
  return htmlText(html).length > 0 || /<img\b/i.test(html || '');
}
export function wordCount(html) {
  const txt = htmlText(html);
  return txt ? txt.split(/\s+/).length : 0;
}
export function excerpt(html, n = 160) {
  const txt = htmlText(html).replace(/\s+/g, ' ');
  return txt.length > n ? txt.slice(0, n).trimEnd() + '…' : txt;
}

/** Plain multi-line text → paragraphs (used for team descriptions). */
export function textToHtml(text) {
  return String(text || '').split(/\n{2,}/).filter(Boolean)
    .map(p => `<p dir="auto">${h(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(getLang() === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

export function debounce(fn, ms = 250) {
  let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

// ─── Toasts ─────────────────────────────────────────────────────────
export function toast(msg, kind = 'info') {
  let wrap = $('#toasts');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; wrap.setAttribute('role', 'status'); document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, kind === 'error' ? 6000 : 3200);
}

export function errMsg(e) {
  if (!e) return t('error.generic');
  const m = e.message || String(e);
  if (/row-level security|not authorized|permission denied|42501/i.test(m + (e.code || ''))) return t('error.forbidden');
  if (/characters_publish_requires_story/.test(m)) return t('error.storyRequired');
  if (/teams_name_unique|duplicate key/.test(m)) return t('error.duplicate');
  if (/Failed to fetch|NetworkError/i.test(m)) return t('error.network');
  return m;
}

// ─── Modal dialogs (alert/confirm are blocked in some webviews) ──────
export function modal({ title = '', body = '', actions = [], wide = false, className = '' }) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${h(title)}">
      ${title ? `<header class="modal-head"><h2>${h(title)}</h2><button class="icon-btn" data-x aria-label="${h(t('common.close'))}">✕</button></header>` : ''}
      <div class="modal-body"></div>
      ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.kind ? 'btn-' + a.kind : ''}" data-i="${i}">${h(a.label)}</button>`).join('')}</footer>` : ''}
    </div>`;
    const bodyEl = $('.modal-body', back);
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    const close = v => { back.classList.remove('in'); document.removeEventListener('keydown', onKey); setTimeout(() => back.remove(), 200); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('[data-x]')) close(null);
      const b = e.target.closest('[data-i]'); if (b) close(actions[+b.dataset.i].value);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('in'));
    back._close = close;
  });
}

export function confirmDialog(message, { title = t('common.confirm'), ok = t('common.delete'), danger = true } = {}) {
  return modal({
    title, body: `<p>${h(message)}</p>`,
    actions: [{ label: t('common.cancel'), value: false }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }],
  }).then(v => v === true);
}

export function statusBadge(status) {
  const s = ['alive', 'dead', 'unknown'].includes(status) ? status : 'unknown';
  return `<span class="badge status-${s}">${h(t('status.' + s))}</span>`;
}
