import { sb } from '../supabase.js';
import { t } from '../i18n.js';
import { h, $, toast, errMsg } from '../util.js';
import { go } from '../app.js';

const redirectTo = () => location.origin + location.pathname;

/** Shown in place of any page that needs a signed-in user. */
export function gate(main, path) {
  sessionStorageSafe('lore:after', path);
  main.innerHTML = `
    <section class="gate">
      <div class="gate-art" aria-hidden="true"></div>
      <div class="gate-copy">
        <p class="eyebrow">${h(t('brand.tagline'))}</p>
        <h1 class="display">${h(t('gate.title'))}</h1>
        <p class="lead">${h(t('gate.body'))}</p>
        <a class="btn btn-primary" href="#login">${h(t('nav.signIn'))}</a>
      </div>
    </section>`;
  main.classList.add('view-in');
}

export async function login(main) {
  let mode = 'in';
  const draw = () => {
    main.innerHTML = `
      <section class="auth wrap-narrow">
        <h1 class="display">${h(t(mode === 'in' ? 'auth.signInTitle' : mode === 'up' ? 'auth.signUpTitle' : 'auth.forgotTitle'))}</h1>
        <form class="card stack" id="auth-form" novalidate>
          <label class="field"><span>${h(t('auth.email'))}</span>
            <input type="email" name="email" autocomplete="email" required dir="ltr"></label>
          ${mode !== 'forgot' ? `<label class="field"><span>${h(t('auth.password'))}</span>
            <input type="password" name="password" minlength="8" required dir="ltr"
              autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}"></label>` : ''}
          <p class="form-error" role="alert" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">${h(t(mode === 'in' ? 'nav.signIn' : mode === 'up' ? 'auth.createAccount' : 'auth.sendLink'))}</button>
        </form>
        <div class="auth-alt">
          ${mode !== 'in' ? `<button class="link-btn" data-mode="in">${h(t('auth.haveAccount'))}</button>` : ''}
          ${mode !== 'up' ? `<button class="link-btn" data-mode="up">${h(t('auth.needAccount'))}</button>` : ''}
          ${mode === 'in' ? `<button class="link-btn" data-mode="forgot">${h(t('auth.forgot'))}</button>` : ''}
        </div>
      </section>`;
    main.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    const form = $('#auth-form', main);
    const errEl = $('.form-error', form);
    form.onsubmit = async e => {
      e.preventDefault();
      errEl.hidden = true;
      const email = form.email.value.trim();
      const password = form.password?.value || '';
      if (!/^\S+@\S+\.\S+$/.test(email)) return showErr(t('auth.badEmail'));
      if (mode !== 'forgot' && password.length < 8) return showErr(t('auth.shortPassword'));
      const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
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
          else main.querySelector('.auth').innerHTML = `<h1 class="display">${h(t('auth.checkEmail'))}</h1><p class="lead">${h(t('auth.checkEmailBody'))}</p>`;
        } else {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
          if (error) throw error;
          main.querySelector('.auth').innerHTML = `<h1 class="display">${h(t('auth.checkEmail'))}</h1><p class="lead">${h(t('auth.resetSent'))}</p>`;
        }
      } catch (err) { showErr(err.message === 'Invalid login credentials' ? t('auth.invalid') : errMsg(err)); }
      finally { btn.disabled = false; }
    };
    function showErr(m) { errEl.textContent = m; errEl.hidden = false; }
  };
  draw();
}

export async function reset(main) {
  main.innerHTML = `
    <section class="auth wrap-narrow">
      <h1 class="display">${h(t('auth.newPassword'))}</h1>
      <form class="card stack" id="reset-form">
        <label class="field"><span>${h(t('auth.password'))}</span>
          <input type="password" name="password" minlength="8" required autocomplete="new-password" dir="ltr"></label>
        <button class="btn btn-primary btn-block">${h(t('common.save'))}</button>
      </form>
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
