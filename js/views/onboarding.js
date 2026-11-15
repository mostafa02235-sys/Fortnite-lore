// "Which team are you with?" — required once after the first sign-in,
// changeable later from Profile. Teams come from the database (groups
// marked as teams), so new teams appear automatically.
import { t, getLang } from '../i18n.js';
import { h, $, $$, toast, errMsg } from '../util.js';
import { hydrateMedia } from '../media.js';
import * as home from '../api-home.js';
import { state } from '../state.js';
import { icon } from '../icons.js';

export const teamName = g => (getLang() === 'ar' && g.name_ar) ? g.name_ar : g.name;
export const otherName = g => (getLang() === 'ar' ? g.name : g.name_ar) || '';
export const teamTag = g => (getLang() === 'ar' && g.tagline_ar) ? g.tagline_ar : (g.tagline || '');

export function teamEmblem(g, cls = '') {
  return `<span class="team-emblem ${cls}">${g.logo_path ? `<img data-path="${h(g.logo_path)}" alt="">` : `<span>${h((g.name || '?').charAt(0))}</span>`}</span>`;
}

/**
 * Full-screen team picker. mode 'required' (first login) or 'change' (from Profile).
 * Resolves after a successful save by calling onDone().
 */
export async function teamPicker(main, { mode = 'required', onDone }) {
  document.body.classList.add('is-onboarding');
  const teams = await home.listTeams();
  let chosen = state.teamId && teams.some(x => x.id === state.teamId) ? state.teamId : null;
  main.innerHTML = `
    <section class="onboard" aria-labelledby="ob-title">
      <div class="onboard-bg" aria-hidden="true"><span></span><span></span></div>
      <div class="onboard-inner">
        <header class="onboard-head">
          <span class="brand-mark brand-mark-lg" aria-hidden="true"></span>
          <p class="eyebrow">${h(t(mode === 'required' ? 'team.step' : 'team.changeEyebrow'))}</p>
          <h1 class="display display-xl" id="ob-title">${h(t('team.question'))}</h1>
          <p class="lead">${h(t(mode === 'required' ? 'team.lead' : 'team.changeLead'))}</p>
        </header>
        <div class="team-grid" role="radiogroup" aria-labelledby="ob-title">
          ${teams.map((g, i) => `
            <button type="button" class="team-card" role="radio" aria-checked="${g.id === chosen}" data-id="${h(g.id)}" style="--i:${i}">
              <span class="team-check" aria-hidden="true">${icon('check', 16)}</span>
              ${teamEmblem(g)}
              <span class="team-names"><strong dir="auto">${h(teamName(g))}</strong>${otherName(g) ? `<small dir="auto">${h(otherName(g))}</small>` : ''}</span>
              ${teamTag(g) ? `<span class="team-tag" dir="auto">${h(teamTag(g))}</span>` : ''}
            </button>`).join('')}
        </div>
        ${teams.length ? '' : `<p class="muted center">${h(t('team.none'))}</p>`}
        <div class="onboard-actions">
          ${mode === 'change' ? `<a class="btn btn-ghost btn-lg" href="#profile">${h(t('common.cancel'))}</a>` : ''}
          <button class="btn btn-primary btn-lg" id="team-confirm" ${chosen ? '' : 'disabled'}>
            <span id="team-confirm-label">${h(chosen ? t('team.confirm', { name: teamName(teams.find(x => x.id === chosen)) }) : t('team.pick'))}</span>
          </button>
        </div>
      </div>
    </section>`;
  hydrateMedia(main);
  const btn = $('#team-confirm', main), label = $('#team-confirm-label', main);
  const select = id => {
    chosen = id;
    $$('.team-card', main).forEach(c => { const on = c.dataset.id === id; c.classList.toggle('is-chosen', on); c.setAttribute('aria-checked', String(on)); });
    main.querySelector('.team-grid').classList.toggle('has-choice', !!id);
    btn.disabled = !id;
    label.textContent = id ? t('team.confirm', { name: teamName(teams.find(x => x.id === id)) }) : t('team.pick');
  };
  if (chosen) select(chosen);
  $$('.team-card', main).forEach(c => {
    c.onclick = () => select(c.dataset.id);
    c.onkeydown = e => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const cards = $$('.team-card', main); const i = cards.indexOf(c);
      const fwd = (e.key === 'ArrowRight' || e.key === 'ArrowDown') !== (getLang() === 'ar' && e.key.startsWith('Arrow') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'));
      const n = cards[(i + (fwd ? 1 : -1) + cards.length) % cards.length]; n.focus(); select(n.dataset.id);
    };
  });
  btn.onclick = async () => {
    if (!chosen) return;
    btn.disabled = true; btn.classList.add('is-loading');
    try {
      await home.setMyTeam(state.user.id, chosen);
      state.teamId = chosen; state.needsTeam = false;
      toast(t('team.saved', { name: teamName(teams.find(x => x.id === chosen)) }));
      document.body.classList.remove('is-onboarding');
      onDone?.();
    } catch (e) { toast(errMsg(e), 'error'); btn.disabled = false; }
    finally { btn.classList.remove('is-loading'); }
  };
}
