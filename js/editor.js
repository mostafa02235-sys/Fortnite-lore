// Lightweight rich-text editor (no dependencies). Produces sanitized HTML with
// headings, paragraphs, bold/italic/underline, lists, quotes, links, rules and
// uploaded images. No length limit is imposed anywhere.
import { t } from './i18n.js';
import { h, sanitizeHtml, wordCount, modal, toast, errMsg, $ } from './util.js';
import { uploadImage, hydrateMedia } from './media.js';

const TOOLS = [
  ['formatBlock:h2', 'H2', 'editor.h2'],
  ['formatBlock:h3', 'H3', 'editor.h3'],
  ['formatBlock:p', '¶', 'editor.paragraph'],
  ['|'],
  ['bold', '<b>B</b>', 'editor.bold'],
  ['italic', '<i>I</i>', 'editor.italic'],
  ['underline', '<u>U</u>', 'editor.underline'],
  ['|'],
  ['insertUnorderedList', '•≡', 'editor.bullets'],
  ['insertOrderedList', '1≡', 'editor.numbers'],
  ['formatBlock:blockquote', '❝', 'editor.quote'],
  ['insertHorizontalRule', '―', 'editor.rule'],
  ['|'],
  ['link', '🔗', 'editor.link'],
  ['unlink', '⛓︎', 'editor.unlink'],
  ['image', '🖼', 'editor.image'],
  ['|'],
  ['dir:rtl', 'ع', 'editor.rtl'],
  ['dir:ltr', 'A', 'editor.ltr'],
  ['removeFormat', '⌫', 'editor.clear'],
  ['undo', '↶', 'editor.undo'],
  ['redo', '↷', 'editor.redo'],
];

/**
 * @param {HTMLElement} mount
 * @param {{html?: string, placeholder?: string, compact?: boolean, label?: string}} opts
 */
export function createEditor(mount, opts = {}) {
  const id = 'ed-' + Math.random().toString(36).slice(2, 8);
  mount.classList.add('rte');
  if (opts.compact) mount.classList.add('rte-compact');
  mount.innerHTML = `
    <div class="rte-bar" role="toolbar" aria-label="${h(t('editor.toolbar'))}">
      ${TOOLS.map(([cmd, icon, label]) => cmd === '|' ? '<span class="rte-sep"></span>'
        : `<button type="button" class="rte-btn" data-cmd="${cmd}" title="${h(t(label))}" aria-label="${h(t(label))}">${icon}</button>`).join('')}
    </div>
    <div class="rte-area prose" id="${id}" contenteditable="true" role="textbox" aria-multiline="true"
      ${opts.label ? `aria-label="${h(opts.label)}"` : ''} dir="auto"
      data-placeholder="${h(opts.placeholder || t('editor.placeholder'))}"></div>
    <div class="rte-foot"><span class="rte-count"></span><span class="rte-busy" hidden>${h(t('editor.uploading'))}</span></div>`;
  const area = $('.rte-area', mount);
  const count = $('.rte-count', mount);
  let savedRange = null;

  const setHtml = html => {
    area.innerHTML = sanitizeHtml(html || '');
    hydrateMedia(area);
    update();
  };
  const update = () => {
    const n = wordCount(area.innerHTML);
    count.textContent = t('editor.words', { n: n.toLocaleString() });
    area.classList.toggle('is-empty', !area.textContent.trim() && !area.querySelector('img,hr,li'));
  };
  const saveSel = () => {
    const s = window.getSelection();
    if (s.rangeCount && area.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  };
  const restoreSel = () => {
    area.focus();
    if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
  };

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* ignore */ }

  area.addEventListener('input', update);
  area.addEventListener('keyup', saveSel);
  area.addEventListener('mouseup', saveSel);
  area.addEventListener('blur', saveSel);
  area.addEventListener('paste', e => {
    // Keep structure from pasted rich text, but only allowed tags.
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else if (text) document.execCommand('insertHTML', false, text.split(/\n{2,}/).map(p => `<p>${h(p).replace(/\n/g, '<br>')}</p>`).join(''));
    update();
  });

  mount.querySelector('.rte-bar').addEventListener('mousedown', e => {
    if (e.target.closest('.rte-btn')) e.preventDefault(); // keep selection in the text
  });
  mount.querySelector('.rte-bar').addEventListener('click', async e => {
    const btn = e.target.closest('.rte-btn'); if (!btn) return;
    const cmd = btn.dataset.cmd;
    restoreSel();
    if (cmd.startsWith('formatBlock:')) document.execCommand('formatBlock', false, cmd.split(':')[1]);
    else if (cmd.startsWith('dir:')) setBlockDir(cmd.split(':')[1]);
    else if (cmd === 'link') await addLink();
    else if (cmd === 'image') await addImage();
    else document.execCommand(cmd, false, null);
    saveSel(); update();
  });

  function currentBlock() {
    const s = window.getSelection(); if (!s.rangeCount) return null;
    let n = s.anchorNode; if (n?.nodeType === 3) n = n.parentNode;
    while (n && n !== area && !/^(P|H2|H3|H4|LI|BLOCKQUOTE|DIV|FIGCAPTION)$/.test(n.tagName)) n = n.parentNode;
    return n && n !== area ? n : null;
  }
  function setBlockDir(dir) {
    let b = currentBlock();
    if (!b) { document.execCommand('formatBlock', false, 'p'); b = currentBlock(); }
    if (b) b.setAttribute('dir', dir);
  }

  async function addLink() {
    const range = savedRange;
    const form = document.createElement('form');
    form.className = 'stack';
    form.innerHTML = `<label class="field"><span>${h(t('editor.linkUrl'))}</span><input type="url" name="url" required placeholder="https://" dir="ltr"></label>`;
    const p = modal({ title: t('editor.link'), body: form, actions: [{ label: t('common.cancel'), value: null }, { label: t('common.insert'), value: 'ok', kind: 'primary' }] });
    setTimeout(() => form.url.focus(), 50);
    form.addEventListener('submit', ev => { ev.preventDefault(); form.closest('.modal-back')?._close('ok'); });
    const r = await p;
    if (r !== 'ok') return;
    const url = form.url.value.trim();
    if (!/^(https?:\/\/|mailto:|#)/i.test(url)) { toast(t('editor.badUrl'), 'error'); return; }
    area.focus();
    if (range) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }
    if (range && !range.collapsed) document.execCommand('createLink', false, url);
    else document.execCommand('insertHTML', false, `<a href="${h(url)}">${h(url)}</a>`);
  }

  async function addImage() {
    const range = savedRange;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    const file = await new Promise(res => { input.onchange = () => res(input.files[0]); input.click(); });
    if (!file) return;
    const busy = $('.rte-busy', mount); busy.hidden = false;
    try {
      const path = await uploadImage(file, 'inline');
      const local = URL.createObjectURL(file);
      area.focus();
      if (range) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }
      document.execCommand('insertHTML', false,
        `<figure><img data-path="${h(path)}" src="${local}" alt=""><figcaption>${h(t('editor.caption'))}</figcaption></figure><p><br></p>`);
    } catch (err) { toast(errMsg(err), 'error'); }
    finally { busy.hidden = true; update(); }
  }

  setHtml(opts.html || '');
  return {
    el: mount,
    area,
    /** Clean HTML for saving: no signed/blob URLs, only storage paths. */
    getHtml() {
      const clean = sanitizeHtml(area.innerHTML);
      return clean.replace(/<p><br><\/p>$/, '');
    },
    setHtml,
    focus: () => area.focus(),
  };
}
