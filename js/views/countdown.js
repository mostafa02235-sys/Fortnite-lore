// Countdown: a personal, live countdown with an image or video background.
// Remaining time is always computed from the target date (never a fixed
// counter), and every timer/observer is released when the page is left.
import { t, getLang } from '../i18n.js';
import { h, $, $$, toast, errMsg, confirmDialog } from '../util.js';
import { userUrls, uploadUserFile, removeFiles, USER_BUCKET } from '../media.js';
import { optimizeImage, videoPoster } from '../optimize.js';
import * as home from '../api-home.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { onLeave } from '../lifecycle.js';

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 30 * 1024 * 1024;
const MAX_SECONDS = 15;
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VID_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

// ─── Time maths ────────────────────────────────────────────────────────
export function remaining(target, now = Date.now()) {
  const end = target ? new Date(target).getTime() : NaN;
  if (!Number.isFinite(end)) return null;
  let ms = Math.max(0, end - now);
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const hh = Math.floor(ms / 36e5); ms -= hh * 36e5;
  const m = Math.floor(ms / 6e4); ms -= m * 6e4;
  const s = Math.floor(ms / 1e3);
  return { d, h: hh, m, s, done: end <= now };
}

// One ticker per mounted countdown; tracked so duplicates are impossible.
const active = new Map();          // element -> stop()
window.__loreCountdownTimers = () => active.size;

function startTicker(el, fn) {
  stopTicker(el);
  let id = null, stopped = false;
  const tick = () => {
    if (stopped) return;
    fn();
    id = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);  // align to whole seconds
  };
  tick();
  const stop = () => { stopped = true; clearTimeout(id); active.delete(el); };
  active.set(el, stop);
  onLeave(stop);
  return stop;
}
function stopTicker(el) { active.get(el)?.(); }

// ─── Display ───────────────────────────────────────────────────────────
const UNITS = [['d', 'countdown.days'], ['h', 'countdown.hours'], ['m', 'countdown.minutes'], ['s', 'countdown.seconds']];

function bgMarkup(cfg) {
  const fx = cfg.focal_x ?? 50, fy = cfg.focal_y ?? 50, z = cfg.zoom ?? 1;
  if (cfg.bg_type === 'image' && cfg.bg_url)
    return `<div class="cd-bg cd-img" style="background-image:url('${h(cfg.bg_url)}');background-position:${fx}% ${fy}%;transform:scale(${z});transform-origin:${fx}% ${fy}%"></div>`;
  if (cfg.bg_type === 'video' && cfg.bg_url)
    return `<video class="cd-bg cd-video" src="${h(cfg.bg_url)}" ${cfg.poster_url ? `poster="${h(cfg.poster_url)}"` : ''} muted loop playsinline autoplay preload="metadata" disablepictureinpicture aria-hidden="true"></video>
            ${cfg.poster_url ? `<div class="cd-bg cd-img cd-fallback" style="background-image:url('${h(cfg.poster_url)}')"></div>` : ''}`;
  return '<div class="cd-bg cd-default" aria-hidden="true"><span></span><span></span></div>';
}

/**
 * Render a countdown into `el`. cfg: { title, target_at, bg_type, bg_url,
 * poster_url, focal_x, focal_y, zoom, overlay }. Returns { stop }.
 */
export function mountCountdown(el, cfg, { compact = false, href = null } = {}) {
  const tag = href ? 'a' : 'section';
  el.innerHTML = `
    <${tag} class="cd ${compact ? 'cd-compact' : ''}" ${href ? `href="${h(href)}"` : ''} aria-label="${h(cfg.title || t('countdown.title'))}">
      ${bgMarkup(cfg)}
      <div class="cd-overlay" style="--ov:${cfg.overlay ?? 0.45}"></div>
      <div class="cd-content">
        <p class="eyebrow cd-eyebrow">${icon('clock', 14)} ${h(t('countdown.title'))}</p>
        <h2 class="cd-title" dir="auto">${h(cfg.title || t('countdown.untitled'))}</h2>
        <div class="cd-units" role="timer" aria-live="off">${UNITS.map(([k, label]) => `
          <div class="cd-unit" data-u="${k}"><div class="cd-num" aria-hidden="true"></div><span class="cd-label">${h(t(label))}</span></div>`).join('')}</div>
        <p class="cd-when small" dir="auto"></p>
        <p class="sr-only cd-sr" aria-live="polite"></p>
      </div>
    </${tag}>`;
  const root = el.firstElementChild;
  wireVideo(root);
  const when = $('.cd-when', root);
  const target = cfg.target_at ? new Date(cfg.target_at) : null;
  when.textContent = target ? new Intl.DateTimeFormat(getLang() === 'ar' ? 'ar' : 'en', { dateStyle: 'full', timeStyle: 'short' }).format(target) : t('countdown.noDate');
  const nums = Object.fromEntries($$('.cd-unit', root).map(u => [u.dataset.u, $('.cd-num', u)]));
  let lastMinute = -1;
  const update = () => {
    const r = remaining(cfg.target_at);
    const v = r || { d: 0, h: 0, m: 0, s: 0, done: false };
    setDigits(nums.d, String(v.d).padStart(2, '0'));
    setDigits(nums.h, String(v.h).padStart(2, '0'));
    setDigits(nums.m, String(v.m).padStart(2, '0'));
    setDigits(nums.s, String(v.s).padStart(2, '0'));
    root.classList.toggle('is-done', !!r?.done);
    if (r?.done) when.textContent = t('countdown.done');
    if (r && v.m !== lastMinute) { lastMinute = v.m; $('.cd-sr', root).textContent = t('countdown.srLeft', { d: v.d, h: v.h, m: v.m }); }
    if (r?.done) stop();
  };
  const stop = startTicker(root, update);
  return { stop, root };
}

/** Change only the digits that differ, with a short slide animation. */
function setDigits(box, str) {
  const slots = $$('.cd-slot', box);
  if (slots.length !== str.length) {
    box.innerHTML = [...str].map(c => `<span class="cd-slot"><span class="cd-d">${c}</span></span>`).join('');
    return;
  }
  [...str].forEach((c, i) => {
    const slot = slots[i];
    const curr = slot.lastElementChild;
    if (curr.textContent === c) return;
    const next = document.createElement('span');
    next.className = 'cd-d in'; next.textContent = c;
    curr.classList.add('out');
    slot.appendChild(next);
    setTimeout(() => curr.remove(), 450);
  });
}

/** Videos: muted loop, pause when off-screen/hidden, fall back to the still image on error. */
function wireVideo(root) {
  const v = $('video', root);
  if (!v) return;
  const fallback = () => { root.classList.add('video-failed'); v.remove(); };
  v.addEventListener('error', fallback);
  v.addEventListener('playing', () => root.classList.add('video-ready'));
  const tryPlay = () => v.play().catch(() => { /* autoplay may be blocked; poster stays */ });
  let visible = true;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? tryPlay() : v.pause(); }, { threshold: 0.1 }) : null;
  io?.observe(v);
  const onVis = () => (document.hidden || !visible ? v.pause() : tryPlay());
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => { io?.disconnect(); document.removeEventListener('visibilitychange', onVis); v.pause(); v.removeAttribute('src'); v.load(); });
}

// ─── Data → display config ─────────────────────────────────────────────
async function resolveConfig(row, fallback) {
  if (!row) return fallback ? { title: fallback.title || '', target_at: fallback.target_at || null, bg_type: 'none', overlay: 0.45, isDefault: true } : null;
  const urls = await userUrls([row.bg_path, row.poster_path].filter(Boolean));
  return { ...row, bg_url: urls[row.bg_path] || null, poster_url: urls[row.poster_path] || null };
}
export async function loadMyCountdown() {
  const [mine, raw] = await Promise.all([home.myCountdown(state.user.id), home.defaultCountdown().catch(() => null)]);
  const def = raw?.target_at ? raw : null;
  return { mine, def, cfg: await resolveConfig(mine, def) };
}

/** Small countdown card for the homepage. */
export async function homeCountdown(el) {
  try {
    const { cfg } = await loadMyCountdown();
    if (!cfg?.target_at) { el.innerHTML = ''; return; }
    mountCountdown(el, cfg, { compact: true, href: '#countdown' });
  } catch (e) { console.warn('countdown', e); el.innerHTML = ''; }
}

// ─── Page ──────────────────────────────────────────────────────────────
export async function countdownPage(main, _, ctx) {
  let data = await loadMyCountdown();
  if (!ctx.isCurrent()) return;
  const view = () => {
    main.innerHTML = `
      <div class="cd-page">
        <div id="cd-stage">${data.cfg?.target_at ? '' : `
          <section class="cd cd-empty"><div class="cd-bg cd-default"><span></span><span></span></div>
            <div class="cd-content"><div class="empty-icon">${icon('clock', 26)}</div><h2 class="cd-title">${h(t('countdown.emptyTitle'))}</h2>
            <p class="muted">${h(t('countdown.emptyBody'))}</p></div></section>`}</div>
        <div class="wrap cd-bar">
          <div><p class="eyebrow">${h(t('countdown.title'))}</p>
            <p class="muted small">${h(data.mine ? t('countdown.yours') : data.def ? t('countdown.usingDefault') : t('countdown.notSet'))}</p></div>
          <div class="row-wrap">
            <button class="btn btn-primary" id="cd-edit">${icon('edit', 16)} ${h(t(data.mine ? 'countdown.customize' : 'countdown.create'))}</button>
            ${data.mine ? `<button class="btn btn-ghost" id="cd-reset">${h(t('countdown.reset'))}</button>` : ''}
          </div>
        </div>
      </div>`;
    if (data.cfg?.target_at) mountCountdown($('#cd-stage', main), data.cfg);
    $('#cd-edit', main).onclick = () => editor();
    const rs = $('#cd-reset', main);
    if (rs) rs.onclick = async () => {
      if (!await confirmDialog(t('countdown.resetConfirm'), { ok: t('countdown.reset') })) return;
      try { await home.resetMyCountdown(state.user.id, data.mine); toast(t('countdown.resetDone')); data = await loadMyCountdown(); view(); }
      catch (e) { toast(errMsg(e), 'error'); }
    };
  };

  const editor = () => {
    const base = data.mine || {};
    const draft = {
      title: base.title ?? data.def?.title ?? '', target_at: base.target_at ?? data.def?.target_at ?? null,
      bg_type: base.bg_type || 'none', focal_x: base.focal_x ?? 50, focal_y: base.focal_y ?? 50, zoom: base.zoom ?? 1, overlay: base.overlay ?? 0.45,
    };
    // Media per background kind, so switching Image ⇄ Video never loses a choice.
    // { url, file?, posterBlob?, posterUrl?, saved? }
    const media = { image: null, video: null };
    if (base.bg_type === 'image' && data.cfg?.bg_url) media.image = { url: data.cfg.bg_url, saved: true };
    if (base.bg_type === 'video' && data.cfg?.bg_url) media.video = { url: data.cfg.bg_url, posterUrl: data.cfg.poster_url, saved: true };
    const shown = () => ({ ...draft, bg_url: media[draft.bg_type]?.url || null, poster_url: draft.bg_type === 'video' ? media.video?.posterUrl || null : null });
    const local = iso => { if (!iso) return ''; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    main.innerHTML = `
      <div class="cd-page cd-editing">
        <div class="cd-preview-wrap">
          <div id="cd-preview" class="cd-preview" title="${h(t('countdown.dragHint'))}"></div>
          <p class="cd-preview-hint small muted" id="cd-hint">${icon('eye', 14)} ${h(t('countdown.previewHint'))}</p>
        </div>
        <form class="wrap cd-form" id="cd-form" novalidate>
          <div class="toolbar"><div><p class="eyebrow">${h(t('countdown.title'))}</p><h1 class="page-title">${h(t('countdown.customize'))}</h1></div></div>
          <section class="panel">
            <label class="field"><span>${h(t('countdown.titleLabel'))}</span><input name="title" maxlength="120" value="${h(draft.title)}" dir="auto" placeholder="${h(t('countdown.titlePh'))}"></label>
            <label class="field"><span>${h(t('countdown.target'))} <em class="req">*</em></span><input name="target" type="datetime-local" value="${local(draft.target_at)}" required></label>
            <p class="muted small" style="margin:-8px 0 0">${h(t('countdown.tz', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone }))}</p>
          </section>
          <section class="panel">
            <h2 class="kicker">${h(t('countdown.background'))}</h2>
            <div class="seg seg-tabs" role="radiogroup" id="bg-seg">
              ${['none', 'image', 'video'].map(k => `<button type="button" data-bg="${k}" role="radio">${icon(k === 'none' ? 'sparkle' : k === 'image' ? 'image' : 'send', 15)} ${h(t('countdown.bg.' + k))}</button>`).join('')}
            </div>
            <div id="bg-opts" class="bg-opts"></div>
            <p class="form-error" id="bg-err" role="alert" hidden></p>
            <label class="field range-field" id="ov-field"><span class="field-row"><span>${h(t('countdown.overlay'))}</span><output id="ov-out"></output></span>
              <input type="range" name="overlay" min="0" max="0.9" step="0.05" value="${draft.overlay}"></label>
          </section>
          <div class="action-bar">
            <button type="button" class="btn btn-ghost" data-a="cancel">${h(t('common.cancel'))}</button>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-primary" data-a="save">${icon('check', 16)} ${h(t('common.save'))}</button>
          </div>
        </form>
      </div>`;
    const form = $('#cd-form', main), prev = $('#cd-preview', main), err = $('#bg-err', main);
    let previewHandle = null;
    const objectUrls = [];
    onLeave(() => objectUrls.forEach(u => URL.revokeObjectURL(u)));
    const redraw = () => {
      previewHandle?.stop();
      const target = form.target.value ? new Date(form.target.value).toISOString() : null;
      previewHandle = mountCountdown(prev, { ...shown(), title: form.title.value, target_at: target });
      const canDrag = draft.bg_type === 'image' && !!media.image;
      prev.classList.toggle('can-drag', canDrag);
      $('#cd-hint', main).innerHTML = `${icon('eye', 14)} ${h(t(canDrag ? 'countdown.dragHint' : 'countdown.previewHint'))}`;
    };
    const setErr = m => { err.textContent = m || ''; err.hidden = !m; };

    const opts = () => {
      $$('#bg-seg [data-bg]', main).forEach(b => { b.classList.toggle('on', b.dataset.bg === draft.bg_type); b.setAttribute('aria-checked', String(b.dataset.bg === draft.bg_type)); });
      const box = $('#bg-opts', main);
      if (draft.bg_type === 'none') { box.innerHTML = `<p class="muted small">${h(t('countdown.noneHelp'))}</p>`; return; }
      const isImg = draft.bg_type === 'image';
      const hasMedia = !!media[draft.bg_type];
      box.innerHTML = `
        <label class="drop drop-compact">
          <div class="drop-preview"><span>${icon(isImg ? 'image' : 'send', 22)}<br>${h(t(isImg ? 'countdown.imageHelp' : 'countdown.videoHelp'))}</span></div>
          <input type="file" hidden accept="${isImg ? IMG_TYPES.join(',') : Object.keys(VID_TYPES).join(',')}" id="bg-file">
          <span class="btn btn-small">${h(t(hasMedia ? 'dev.replace' : 'dev.chooseFile'))}</span>
        </label>
        ${isImg && hasMedia ? `<label class="field range-field"><span class="field-row"><span>${h(t('countdown.zoom'))}</span><output id="z-out">${Math.round(draft.zoom * 100)}%</output></span>
          <input type="range" id="zoom" min="1" max="3" step="0.05" value="${draft.zoom}"></label>
          <button type="button" class="link-btn" id="recenter">${h(t('countdown.recenter'))}</button>` : ''}`;
      $('#bg-file', box).onchange = e => pick(e.target.files[0]);
      const z = $('#zoom', box);
      if (z) z.oninput = () => { draft.zoom = +z.value; $('#z-out', box).textContent = Math.round(draft.zoom * 100) + '%'; applyImageTransform(); };
      const rc = $('#recenter', box);
      if (rc) rc.onclick = () => { draft.focal_x = 50; draft.focal_y = 50; draft.zoom = 1; opts(); applyImageTransform(); };
    };
    const applyImageTransform = () => {
      const bg = $('.cd-img:not(.cd-fallback)', prev);
      if (!bg) return;
      bg.style.backgroundPosition = `${draft.focal_x}% ${draft.focal_y}%`;
      bg.style.transformOrigin = `${draft.focal_x}% ${draft.focal_y}%`;
      bg.style.transform = `scale(${draft.zoom})`;
    };

    async function pick(file) {
      setErr('');
      if (!file) return;
      try {
        if (draft.bg_type === 'image') {
          if (!IMG_TYPES.includes(file.type)) throw new Error(t('countdown.badImage'));
          if (file.size > MAX_IMAGE) throw new Error(t('countdown.imageTooBig'));
          const opt = await optimizeImage(file, { maxDim: 2400 });
          const url = URL.createObjectURL(opt); objectUrls.push(url);
          media.image = { url, file: opt };
          draft.focal_x = 50; draft.focal_y = 50; draft.zoom = 1;
        } else {
          if (!VID_TYPES[file.type]) throw new Error(t('countdown.badVideo'));
          if (file.size > MAX_VIDEO) throw new Error(t('countdown.videoTooBig'));
          const { url, poster, duration } = await inspectVideo(file);
          objectUrls.push(url);
          if (duration > MAX_SECONDS + 0.4) { URL.revokeObjectURL(url); throw new Error(t('countdown.videoTooLong', { s: Math.round(duration) })); }
          const posterUrl = poster ? URL.createObjectURL(poster) : null;
          if (posterUrl) objectUrls.push(posterUrl);
          media.video = { url, file, posterBlob: poster, posterUrl };
        }
        opts(); redraw();
      } catch (e) { setErr(e.message || t('countdown.uploadFailed')); }
    }

    // Drag on the preview to reposition the image (crop focus).
    let drag = null;
    prev.addEventListener('pointerdown', e => {
      if (draft.bg_type !== 'image' || !media.image) return;
      drag = { x: e.clientX, y: e.clientY, fx: draft.focal_x, fy: draft.focal_y };
      prev.setPointerCapture(e.pointerId); prev.classList.add('dragging');
    });
    prev.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = prev.getBoundingClientRect();
      const k = 100 / draft.zoom;
      draft.focal_x = Math.min(100, Math.max(0, drag.fx - (e.clientX - drag.x) / r.width * k));
      draft.focal_y = Math.min(100, Math.max(0, drag.fy - (e.clientY - drag.y) / r.height * k));
      applyImageTransform();
    });
    const endDrag = () => { drag = null; prev.classList.remove('dragging'); };
    prev.addEventListener('pointerup', endDrag); prev.addEventListener('pointercancel', endDrag);

    $$('#bg-seg [data-bg]', main).forEach(b => b.onclick = () => {
      draft.bg_type = b.dataset.bg; setErr('');
      opts(); redraw();
    });
    const ov = form.overlay, ovOut = $('#ov-out', main);
    const showOv = () => { ovOut.textContent = Math.round(+ov.value * 100) + '%'; };
    ov.oninput = () => { draft.overlay = +ov.value; showOv(); const o = $('.cd-overlay', prev); if (o) o.style.setProperty('--ov', draft.overlay); };
    form.title.oninput = () => { const tt = $('.cd-title', prev); if (tt) tt.textContent = form.title.value || t('countdown.untitled'); };
    form.target.onchange = redraw;
    showOv(); opts(); redraw();

    $('[data-a=cancel]', main).onclick = () => view();
    form.onsubmit = async e => {
      e.preventDefault(); setErr('');
      if (!form.target.value) { form.target.focus(); return toast(t('countdown.needDate'), 'error'); }
      const target = new Date(form.target.value);
      if (Number.isNaN(target.getTime())) return toast(t('countdown.needDate'), 'error');
      const m = media[draft.bg_type];
      if (draft.bg_type !== 'none' && !m) return setErr(t('countdown.needMedia'));
      const btn = $('[data-a=save]', main); btn.disabled = true; btn.classList.add('is-loading');
      const uploaded = [];
      try {
        const uid = state.user.id;
        let bg_path = null, poster_path = null;
        if (m?.file && draft.bg_type === 'image') {
          const ext = m.file.type === 'image/webp' ? 'webp' : m.file.type === 'image/png' ? 'png' : 'jpg';
          bg_path = await uploadUserFile(uid, m.file, ext, m.file.type); uploaded.push(bg_path);
        } else if (m?.file && draft.bg_type === 'video') {
          bg_path = await uploadUserFile(uid, m.file, VID_TYPES[m.file.type], m.file.type); uploaded.push(bg_path);
          if (m.posterBlob) { poster_path = await uploadUserFile(uid, m.posterBlob, 'jpg', 'image/jpeg'); uploaded.push(poster_path); }
        } else if (m?.saved) {
          bg_path = data.mine.bg_path; poster_path = data.mine.poster_path;
        }
        await home.saveMyCountdown(uid, {
          title: form.title.value, target_at: target.toISOString(), bg_type: draft.bg_type, bg_path, poster_path,
          focal_x: draft.focal_x, focal_y: draft.focal_y, zoom: draft.zoom, overlay: draft.overlay,
        });
        const old = [data.mine?.bg_path, data.mine?.poster_path].filter(p => p && p !== bg_path && p !== poster_path);
        if (old.length) await removeFiles(old, USER_BUCKET);
        toast(t('countdown.saved'));
        data = await loadMyCountdown();
        view();
      } catch (ex) {
        if (uploaded.length) await removeFiles(uploaded, USER_BUCKET).catch(() => {});
        setErr(t('countdown.uploadFailed') + ' ' + errMsg(ex));
      } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
    };
  };
  view();
}

/** Read a video's duration and grab a still frame; rejects unreadable files. */
function inspectVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = () => { cleanup(); URL.revokeObjectURL(url); reject(new Error(t('countdown.unreadableVideo'))); };
    const timer = setTimeout(fail, 12000);
    const cleanup = () => { clearTimeout(timer); v.onerror = v.onloadedmetadata = v.onseeked = null; };
    v.onerror = fail;
    v.onloadedmetadata = () => {
      if (!Number.isFinite(v.duration) || v.duration <= 0 || !v.videoWidth) return fail();
      v.currentTime = Math.min(0.5, v.duration / 2);
    };
    v.onseeked = async () => {
      const duration = v.duration;
      let poster = null;
      try { poster = await videoPoster(v); } catch { /* poster optional */ }
      cleanup();
      resolve({ url, poster, duration });
    };
  });
}
