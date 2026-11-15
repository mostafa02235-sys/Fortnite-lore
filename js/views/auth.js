import { sb } from '../supabase.js';
import { t } from '../i18n.js';
import { h, $, toast, errMsg } from '../util.js';
import { go } from '../app.js';
import { icon } from '../icons.js';

const redirectTo = () => location.origin + location.pathname;

/** Shown in place of any page that needs a signed-in user. */
export function gate(main, path) {
  sessionStorageSafe('lore:after', path);
  main.innerHTML = `
    <section class="gate">
      <div class="gate-art" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="gate-copy wrap">
        <p class="eyebrow">${h(t('brand.tagline'))}</p>
        <h1 class="display display-xl">${h(t('gate.title'))}</h1>
        <p class="lead">${h(t('gate.body'))}</p>
        <div class="row-wrap hero-actions">
          <a class="btn btn-primary btn-lg" href="#login">${h(t('nav.signIn'))}</a>
          <a class="btn btn-lg" href="#login" data-signup>${h(t('auth.createAccount'))}</a>
        </div>
        <ul class="gate-points">
          <li>${icon('book')} ${h(t('gate.p1'))}</li><li>${icon('calendar')} ${h(t('gate.p2'))}</li><li>${icon('shield')} ${h(t('gate.p3'))}</li>
        </ul>
      </div>
    </section>`;
  main.querySelector('[data-signup]').onclick = () => sessionStorageSafe('lore:mode', 'up');
  main.classList.add('view-in');
}

export async function login(main) {
  let mode = sessionStorageSafe('lore:mode') || 'in';
  const draw = () => {
    const title = mode === 'in' ? 'auth.signInTitle' : mode === 'up' ? 'auth.signUpTitle' : 'auth.forgotTitle';
    main.innerHTML = `
      <section class="auth">
        <div class="auth-art" aria-hidden="true">
          <div class="auth-art-copy"><span class="brand-mark brand-mark-lg"></span>
            <p class="auth-quote">${h(t('auth.artLine'))}</p></div>
        </div>
        <div class="auth-panel">
          <div class="auth-box">
            ${mode !== 'forgot' ? `<div class="seg seg-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="${mode === 'in'}" class="${mode === 'in' ? 'on' : ''}" data-mode="in">${h(t('nav.signIn'))}</button>
              <button type="button" role="tab" aria-selected="${mode === 'up'}" class="${mode === 'up' ? 'on' : ''}" data-mode="up">${h(t('auth.createAccount'))}</button>
            </div>` : ''}
            <h1 class="auth-title">${h(t(title))}</h1>
            <p class="muted">${h(t(mode === 'in' ? 'auth.signInSub' : mode === 'up' ? 'auth.signUpSub' : 'auth.forgotSub'))}</p>
            <form class="stack" id="auth-form" novalidate>
              <label class="field"><span>${h(t('auth.email'))}</span>
                <input type="email" name="email" autocomplete="email" required dir="ltr" placeholder="name@example.com"></label>
              ${mode !== 'forgot' ? `<label class="field"><span class="field-row"><span>${h(t('auth.password'))}</span>
                ${mode === 'in' ? `<button type="button" class="link-btn" data-mode="forgot">${h(t('auth.forgot'))}</button>` : ''}</span>
                <span class="input-wrap"><input type="password" name="password" minlength="8" required dir="ltr"
                  autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}">
                  <button type="button" class="input-btn" data-reveal aria-label="${h(t('devmode.show'))}">${icon('eye', 18)}</button></span>
                ${mode === 'up' ? `<small class="muted">${h(t('auth.shortPassword'))}</small>` : ''}</label>` : ''}
              <p class="form-error" role="alert" hidden></p>
              <button class="btn btn-primary btn-block btn-lg" type="submit">${h(t(mode === 'in' ? 'nav.signIn' : mode === 'up' ? 'auth.createAccount' : 'auth.sendLink'))}</button>
            </form>
            ${mode === 'forgot' ? `<button class="link-btn auth-back" data-mode="in">← ${h(t('auth.haveAccount'))}</button>` : ''}
          </div>
        </div>
      </section>`;
    main.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    const rv = main.querySelector('[data-reveal]');
    if (rv) rv.onclick = () => { const i = main.querySelector('input[name=password]'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; rv.innerHTML = icon(show ? 'eyeOff' : 'eye', 18); };
    const form = $('#auth-form', main);
    const errEl = $('.form-error', form);
    setTimeout(() => form.email.focus(), 50);
    form.onsubmit = async e => {
      e.preventDefault();
      errEl.hidden = true;
      const email = form.email.value.trim();
      const password = form.password?.value || '';
      if (!/^\S+@\S+\.\S+$/.test(email)) return showErr(t('auth.badEmail'));
      if (mode !== 'forgot' && password.length < 8) return showErr(t('auth.shortPassword'));
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.classList.add('is-loading');
      try {
        if (mode === 'in') {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          toast(t('auth.welcome'));
          go(sessionStorageSafe('lore:after') || '');
        } else if (mode === 'up') {
          const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
          if (error) throw error;
          if (data.session) { toast(t('auth.welcome')); go(''); }
          else done(t('auth.checkEmailBody'));
        } else {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
          if (error) throw error;
          done(t('auth.resetSent'));
        }
      } catch (err) { showErr(err.message === 'Invalid login credentials' ? t('auth.invalid') : errMsg(err)); }
      finally { btn.disabled = false; btn.classList.remove('is-loading'); }
    };
    function showErr(m) { errEl.textContent = m; errEl.hidden = false; }
    function done(m) {
      main.querySelector('.auth-box').innerHTML = `<div class="empty-icon">${icon('send', 26)}</div><h1 class="auth-title">${h(t('auth.checkEmail'))}</h1><p class="muted">${h(m)}</p>
        <button class="btn" data-again>${h(t('auth.haveAccount'))}</button>`;
      main.querySelector('[data-again]').onclick = () => { mode = 'in'; draw(); };
    }
  };
  draw();
}

export async function reset(main) {
  main.innerHTML = `
    <section class="auth auth-single">
      <div class="auth-box">
      <h1 class="auth-title">${h(t('auth.newPassword'))}</h1>
      <form class="stack" id="reset-form">
        <label class="field"><span>${h(t('auth.password'))}</span>
          <input type="password" name="password" minlength="8" required autocomplete="new-password" dir="ltr"></label>
        <button class="btn btn-primary btn-block btn-lg">${h(t('common.save'))}</button>
      </form>
      </div>
    </section>`;
  $('#reset-form').onsubmit = async e => {
    e.preventDefault();
    const pw = e.target.password.value;
    if (pw.length < 8) return toast(t('auth.shortPassword'), 'error');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return toast(errMsg(error), 'error');
    toast(t('auth.passwordUpdated')); go('');
  };
}

function sessionStorageSafe(key, value) {
  try {
    if (value === undefined) { const v = sessionStorage.getItem(key); sessionStorage.removeItem(key); return v; }
    if (value && value !== 'login') sessionStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
  return null;
}
