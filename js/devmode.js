// Developer Mode: the access code is checked by the database function
// lore_enter_dev_mode (bcrypt hash in a private schema). The browser never
// knows the code; it only receives "ok" plus an expiry time. Every developer
// operation is then authorized again by Row Level Security.
import { sb } from './supabase.js';
import { state } from './state.js';
import { t } from './i18n.js';
import { h, $, modal, toast, errMsg } from './util.js';
import { icon } from './icons.js';

export async function loadDevSession() {
  state.devUntil = null;
  if (!state.user) return;
  try {
    const { data, error } = await sb.from('lore_dev_sessions').select('expires_at').eq('user_id', state.user.id).maybeSingle();
    if (error) throw error;
    if (data && new Date(data.expires_at) > new Date()) state.devUntil = data.expires_at;
  } catch (e) { console.warn('dev session check failed', e); }
}

export function devTimeLeft() {
  if (!state.devUntil) return '';
  const mins = Math.max(0, Math.round((new Date(state.devUntil) - Date.now()) / 60000));
  return mins >= 60 ? t('devmode.hoursLeft', { n: Math.floor(mins / 60), m: mins % 60 }) : t('devmode.minsLeft', { n: mins });
}

/** Shows the access dialog. Resolves true when Developer Mode is unlocked. */
export function openDevDialog() {
  const form = document.createElement('form');
  form.className = 'devcode';
  form.autocomplete = 'off';
  form.innerHTML = `
    <div class="devcode-head">
      <span class="devcode-icon">${icon('key', 22)}</span>
      <div><h2>${h(t('devmode.title'))}</h2><p class="muted">${h(t('devmode.body'))}</p></div>
    </div>
    <label class="field devcode-field">
      <span>${h(t('devmode.label'))}</span>
      <span class="input-wrap">
        <input name="code" type="password" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" spellcheck="false" maxlength="64" required dir="ltr" aria-describedby="devcode-msg">
        <button type="button" class="input-btn" data-reveal aria-label="${h(t('devmode.show'))}">${icon('eye', 18)}</button>
      </span>
    </label>
    <p class="form-msg" id="devcode-msg" role="alert" hidden></p>
    <div class="devcode-actions">
      <button type="button" class="btn btn-ghost" data-cancel>${h(t('common.cancel'))}</button>
      <button type="submit" class="btn btn-primary">${icon('unlock', 16)} ${h(t('devmode.unlock'))}</button>
    </div>
    <p class="devcode-note small muted">${icon('shield', 14)} ${h(t('devmode.note'))}</p>`;
  const done = modal({ body: form, className: 'modal-devcode' });
  const close = v => form.closest('.modal-back')?._close(v);
  const input = form.code, msg = $('#devcode-msg', form), submit = form.querySelector('[type=submit]');
  setTimeout(() => input.focus(), 60);
  form.querySelector('[data-cancel]').onclick = () => close(false);
  form.querySelector('[data-reveal]').onclick = e => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
    e.currentTarget.setAttribute('aria-label', t(show ? 'devmode.hide' : 'devmode.show'));
    input.focus();
  };
  input.oninput = () => { msg.hidden = true; form.classList.remove('is-error'); };
  form.onsubmit = async e => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) { input.focus(); return; }
    submit.disabled = true; submit.classList.add('is-loading');
    try {
      const { data, error } = await sb.rpc('lore_enter_dev_mode', { _code: code });
      if (error) throw error;
      if (data?.ok) {
        state.devUntil = data.expires_at;
        toast(t('devmode.unlocked'));
        close(true);
        return;
      }
      const reason = data?.reason || 'invalid';
      const text = reason === 'locked' ? t('devmode.locked', { n: Math.ceil((data.retry_after || 900) / 60) })
        : reason === 'not_configured' ? t('devmode.notConfigured')
        : reason === 'signin' ? t('devmode.signin')
        : t('devmode.invalid') + (data?.remaining != null ? ' ' + t('devmode.remaining', { n: data.remaining }) : '');
      showError(text);
    } catch (err) { showError(errMsg(err)); }
    finally { submit.disabled = false; submit.classList.remove('is-loading'); }
  };
  function showError(text) {
    msg.textContent = text; msg.hidden = false;
    form.classList.remove('is-error'); void form.offsetWidth; form.classList.add('is-error');
    input.select();
  }
  return done.then(v => v === true);
}

export async function exitDevMode() {
  try {
    const { error } = await sb.rpc('lore_exit_dev_mode');
    if (error) throw error;
  } catch (e) { toast(errMsg(e), 'error'); return false; }
  state.devUntil = null;
  toast(t('devmode.exited'));
  return true;
}
