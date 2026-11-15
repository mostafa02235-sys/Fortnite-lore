"""Offline UI test: homepage seasons showcase, countdown, team onboarding and their dashboard controls.
Runs the offline preview (preview/index.html: same app code + in-memory database with sample data).
Run: python3 tests/features_test.py"""
import http.server, threading, functools, sys, os, re, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8772), functools.partial(H, directory=APP))
threading.Thread(target=srv.serve_forever, daemon=True).start()
U = 'http://127.0.0.1:8772/preview/index.html'
errors, results = [], []
def check(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
f = lambda n: os.path.join(HERE, n)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 860})
    ctx.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'ERR_FAILED' not in m.text and errors.append(m.text))
    pg.on('dialog', lambda d: (errors.append('native dialog: ' + d.message), d.dismiss()))
    pg.add_init_script("localStorage.setItem('lore:lang','en')")
    def go(hsh, sel):
        pg.evaluate(f"location.hash = '{hsh}'"); pg.wait_for_selector(sel)
    timers = lambda: pg.evaluate("window.__loreCountdownTimers ? window.__loreCountdownTimers() : -1")

    # ── 1. Team onboarding on first sign-in ──
    pg.goto(U); pg.wait_for_selector('.onboard')
    check('first sign-in shows full-screen team picker (sidebar hidden)', pg.locator('.sidebar').is_hidden() and 'which team are you with' in pg.inner_text('.onboard').lower())
    check('teams load from the database: The Seven, Imagined Order, The Last Reality', [pg.locator('.team-names strong').nth(i).inner_text() for i in range(3)] == ['The Seven', 'Imagined Order', 'The Last Reality'])
    check('cards show Arabic names + description', 'السبعة' in pg.inner_text('.team-grid') and 'free the Island' in pg.inner_text('.team-grid'))
    check('confirm disabled until a team is chosen', pg.locator('#team-confirm').is_disabled())
    pg.evaluate("location.hash = 'characters'"); pg.wait_for_timeout(300)
    check('cannot skip onboarding by navigating', pg.locator('.onboard').count() == 1 and pg.locator('.card-char').count() == 0)
    pg.click('.team-card:has-text("Imagined Order")')
    check('selected card highlighted + confirm label', pg.locator('.team-card.is-chosen').count() == 1 and pg.get_attribute('.team-card.is-chosen', 'aria-checked') == 'true' and 'Join Imagined Order' in pg.inner_text('#team-confirm'))
    pg.wait_for_timeout(700); pg.screenshot(path=f'{SHOTS}/f1-onboarding.png')
    pg.click('#team-confirm'); pg.wait_for_selector('.card-char, .showcase')
    io = pg.evaluate("__mock.db.groups.find(g => g.name === 'Imagined Order').id")
    check('team saved to the profile, continues into the site', pg.evaluate("__mock.db.lore_profiles.length") == 1 and pg.evaluate("__mock.db.lore_profiles[0].team_id") == io and pg.locator('.sidebar').is_visible())
    r = pg.evaluate("""async () => { const m = await import('/js/supabase.js');
      __mock.db.groups.push({ id: 'g-plain', name: 'Plain group', is_team: false, is_published: true, description: '<p>x</p>' });
      const a = await m.sb.from('lore_profiles').upsert({ user_id: 'u-dev', team_id: 'g-plain' }, { onConflict: 'user_id' });
      return !!a.error; }""")
    check('backend refuses a non-team group as a team', r)
    pg.evaluate("async () => { const m = await import('/js/supabase.js'); await m.sb.auth.signOut(); await m.sb.auth.signInWithPassword({}); }"); pg.wait_for_timeout(500)
    check('returning user does not see onboarding again', pg.locator('.onboard').count() == 0)

    # ── 2. Seasons showcase ──
    go('', '.showcase .sc-copy h1')
    title = lambda: pg.inner_text('.sc-title')
    check('showcase has 4 seasons from the database, starts at the first', pg.locator('.sc-slide').count() == 4 and title() == 'Sample Season A')
    check('chapter info + description + Explore Season button', 'chapter 1' in pg.inner_text('.sc-eyebrow').lower() and pg.locator('.sc-desc').count() == 1
          and pg.get_attribute('.sc-copy a.btn-primary', 'href') == '#season/' + pg.evaluate("__mock.db.seasons[0].id"))
    pg.wait_for_timeout(600)
    covers = pg.evaluate("[...document.querySelectorAll('.sc-bg')].map(b => b.style.backgroundImage)")
    check('artwork lazy-loaded for current + neighbours only', sum(1 for c in covers if c) == 3 and not covers[2])
    check('each season uses its own artwork (no repeats)', len(set(c for c in covers if c)) == 3)
    pg.mouse.move(5, 5)
    pg.click('.sc-next'); pg.wait_for_timeout(150); check('next arrow', title() == 'Sample Season B')
    pg.click('.sc-dot >> nth=3'); pg.wait_for_timeout(150); check('indicator jumps to season D', title() == 'Sample Season D' and pg.locator('.sc-dot.is-active').count() == 1)
    pg.focus('.showcase'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(150); check('keyboard → wraps to first', title() == 'Sample Season A')
    def swipe(dx):
        box = pg.locator('.showcase').bounding_box(); x, y = box['x'] + box['width'] / 2, box['y'] + 160
        pg.evaluate("""([x, y, dx]) => { const el = document.querySelector('.showcase');
          const ev = (type, cx) => el.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: y, bubbles: true, pointerType: 'touch' }));
          ev('pointerdown', x); ev('pointermove', x + dx / 2); ev('pointermove', x + dx); ev('pointerup', x + dx); }""", [x, y, dx])
        pg.wait_for_timeout(150)
    swipe(-180); check('swipe left → next season', title() == 'Sample Season B')
    swipe(180); check('swipe right → previous season', title() == 'Sample Season A')
    pg.mouse.move(5, 5); pg.wait_for_timeout(7600)
    check('autoplay advances after ~7s', title() == 'Sample Season B')
    pg.hover('.sc-title'); pg.wait_for_timeout(7600)
    check('autoplay pauses while hovering', title() == 'Sample Season B')
    pg.mouse.move(5, 5)
    pg.wait_for_timeout(500); pg.screenshot(path=f'{SHOTS}/f2-showcase.png')

    # ── 3. Countdown ──
    check('home shows the countdown card (site default)', pg.locator('#home-countdown .cd-compact').count() == 1 and 'sample' in pg.inner_text('#home-countdown').lower())
    go('countdown', '.cd .cd-units')
    nums = lambda: pg.evaluate("[...document.querySelectorAll('#cd-stage .cd-num')].map(n => [...n.querySelectorAll('.cd-slot')].map(s => s.lastElementChild.textContent).join(''))")
    v1 = nums(); pg.wait_for_timeout(1300); v2 = nums()
    check('default countdown ~12 days, ticks every second', v1[0] == '12' and v1[3] != v2[3])
    check('remaining time computed from the target date', abs(int(v1[0]) * 86400 + int(v1[1]) * 3600 + int(v1[2]) * 60 + int(v1[3]) - pg.evaluate("Math.round((new Date(__mock.db.lore_site_settings[0].value.target_at) - Date.now()) / 1000)")) <= 2)
    check('one timer on the countdown page', timers() == 1)
    for _ in range(4):
        go('', '.showcase'); go('countdown', '#cd-stage .cd-units')
    check('no duplicate timers after navigating back and forth', timers() == 1)
    go('characters', '.card-char'); check('timer stopped when leaving the page', timers() == 0)
    go('countdown', '#cd-stage .cd-units'); pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/f3-countdown-default.png')

    # customize with an image
    pg.click('#cd-edit'); pg.wait_for_selector('#cd-form')
    pg.fill('#cd-form input[name=title]', 'Season launch party')
    pg.fill('#cd-form input[name=target]', pg.evaluate("(() => { const d = new Date(Date.now() + 2 * 864e5 + 3 * 36e5); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })()"))
    pg.dispatch_event('#cd-form input[name=target]', 'change')
    check('preview updates before saving (title + time)', 'season launch party' in pg.inner_text('#cd-preview').lower() and pg.evaluate("document.querySelector('#cd-preview .cd-num').textContent").strip() == '02')
    pg.click('#bg-seg [data-bg=image]'); pg.set_input_files('#bg-file', f('big.jpg')); pg.wait_for_selector('#cd-preview .cd-img'); pg.wait_for_selector('#zoom')
    box = pg.locator('#cd-preview').bounding_box()
    pg.mouse.move(box['x'] + 300, box['y'] + 200); pg.mouse.down(); pg.mouse.move(box['x'] + 180, box['y'] + 120, steps=6); pg.mouse.up()
    pg.fill('#zoom', '1.6'); pg.dispatch_event('#zoom', 'input')
    pg.fill('#cd-form input[name=overlay]', '0.6'); pg.dispatch_event('#cd-form input[name=overlay]', 'input')
    st = pg.evaluate("(() => { const b = document.querySelector('#cd-preview .cd-img'); return [b.style.backgroundPosition, b.style.transform, getComputedStyle(document.querySelector('#cd-preview .cd-overlay')).backgroundColor]; })()")
    check('drag repositions, zoom scales, overlay darkens (live preview)', st[0] != '50% 50%' and 'scale(1.6)' in st[1] and '0.6' in st[2])
    pg.wait_for_timeout(500); pg.screenshot(path=f'{SHOTS}/f4-countdown-editor.png')
    pg.click('[data-a=save]'); pg.wait_for_selector('#cd-edit')
    row = pg.evaluate("__mock.db.lore_countdowns[0]")
    check('saved privately: own row, image in own folder, optimized to WebP', row['user_id'] == 'u-dev' and row['bg_type'] == 'image' and row['bg_path'].startswith('u-dev/') and row['bg_path'].endswith('.webp')
          and row['zoom'] == 1.6 and row['overlay'] == 0.6 and row['focal_x'] != 50)
    check('page shows the personal countdown', 'season launch party' in pg.inner_text('#cd-stage').lower() and pg.locator('#cd-stage .cd-img').count() == 1)
    pg.wait_for_timeout(700); pg.screenshot(path=f'{SHOTS}/f5-countdown-image.png')

    # video: too long, broken, then valid
    pg.click('#cd-edit'); pg.wait_for_selector('#cd-form'); pg.click('#bg-seg [data-bg=video]')
    pg.set_input_files('#bg-file', f('long.mp4')); pg.wait_for_selector('#bg-err:not([hidden])', timeout=15000)
    check('video over 15 s rejected with a clear message', '20 seconds' in pg.inner_text('#bg-err'))
    pg.set_input_files('#bg-file', f('broken.mp4')); pg.wait_for_function("document.querySelector('#bg-err').textContent.includes('played')", timeout=15000)
    check('invalid video file handled gracefully', 'can’t be played' in pg.inner_text('#bg-err') or "can't be played" in pg.inner_text('#bg-err'))
    pg.set_input_files('#bg-file', f('short.mp4')); pg.wait_for_selector('#cd-preview video', timeout=15000)
    check('valid 5 s video previews (muted, looping, inline)', pg.evaluate("(() => { const v = document.querySelector('#cd-preview video'); return v.muted && v.loop && v.playsInline && !!v.poster; })()"))
    pg.click('#bg-seg [data-bg=image]'); pg.wait_for_selector('#cd-preview .cd-img')
    pg.click('#bg-seg [data-bg=video]'); pg.wait_for_selector('#cd-preview video')
    check('switching Image ⇄ Video keeps both choices', True)
    pg.evaluate("__mock.failUploads = true"); pg.click('[data-a=save]'); pg.wait_for_selector('#bg-err:has-text("upload")')
    check('upload failure shows an error and keeps the old settings', pg.evaluate("__mock.db.lore_countdowns[0].bg_type") == 'image' and pg.locator('#cd-form').count() == 1)
    pg.evaluate("__mock.failUploads = false"); pg.click('[data-a=save]'); pg.wait_for_selector('#cd-edit')
    row = pg.evaluate("__mock.db.lore_countdowns[0]")
    old_img_gone = pg.evaluate("![...__mock.files.keys()].some(k => k.endsWith('.webp') && k.startsWith('u-dev/'))")
    check('video saved with a fallback poster; old image file deleted', row['bg_type'] == 'video' and row['bg_path'].endswith('.mp4') and row['poster_path'].endswith('.jpg') and old_img_gone)
    pg.wait_for_function("document.querySelector('#cd-stage .cd').classList.contains('video-ready')", timeout=10000)
    check('video background plays on the page', pg.evaluate("!document.querySelector('#cd-stage video').paused"))
    pg.wait_for_timeout(600); pg.screenshot(path=f'{SHOTS}/f6-countdown-video.png')

    # privacy between users
    priv = pg.evaluate("""async () => { const m = await import('/js/supabase.js'); const me = __mock.user.id; const mine = __mock.db.lore_countdowns[0];
      __mock.user = { ...__mock.user, id: 'u-other' };
      const read = await m.sb.from('lore_countdowns').select('*');
      const upd = await m.sb.from('lore_countdowns').update({ title: 'hacked' }).eq('user_id', me).select();
      const steal = await m.sb.from('lore_countdowns').upsert({ user_id: 'u-other', bg_type: 'image', bg_path: mine.bg_path }, { onConflict: 'user_id' });
      const file = await m.sb.storage.from('lore-user-media').createSignedUrls([mine.bg_path], 60);
      const up = await m.sb.storage.from('lore-user-media').upload(me + '/x.jpg', new Blob(['x']));
      __mock.user = { ...__mock.user, id: me };
      return [read.data.length, (upd.data || []).length, !!steal.error, file.data[0].signedUrl, !!up.error, __mock.db.lore_countdowns[0].title]; }""")
    check("other users can't read, change, reuse or upload into someone's countdown", priv == [0, 0, True, None, True, 'Season launch party'])

    # reset
    pg.click('#cd-reset'); pg.click('.modal .btn-danger'); pg.wait_for_timeout(500)
    check('reset deletes personal countdown + its files, falls back to default', pg.evaluate("__mock.db.lore_countdowns.length") == 0
          and pg.evaluate("![...__mock.files.keys()].some(k => k.startsWith('u-dev/'))") and 'sample' in pg.inner_text('#cd-stage').lower())

    # ── 4. Change team from profile ──
    go('profile', '.team-setting'); check('profile shows current team', 'Imagined Order' in pg.inner_text('.team-setting'))
    pg.click('#change-team'); pg.wait_for_selector('.onboard')
    check('change mode pre-selects current team', pg.inner_text('.team-card.is-chosen .team-names strong') == 'Imagined Order')
    pg.click('.team-card:has-text("The Seven")'); pg.click('#team-confirm'); pg.wait_for_selector('.team-setting')
    check('team changed and saved', 'The Seven' in pg.inner_text('.team-setting') and pg.evaluate("__mock.db.groups.find(g => g.id === __mock.db.lore_profiles[0].team_id).name") == 'The Seven')

    # ── 5. Dashboard: showcase, teams, countdown ──
    go('dev', '.dev-locked'); pg.click('#dev-unlock'); pg.fill('.devcode input', 'PREVIEW'); pg.click('.devcode button[type=submit]'); pg.wait_for_selector('.stats')
    check('dashboard has Showcase, Teams and Countdown sections', all(pg.locator(f'.tab[href="#dev/{k}"]').count() == 1 for k in ['showcase', 'teams', 'countdown']))
    go('dev/showcase', '.sc-row')
    check('showcase manager lists seasons', pg.locator('.sc-row').count() == 4)
    pg.locator('.sc-row', has_text='Sample Season B').locator('.switch').click(); pg.wait_for_timeout(300)
    pg.locator('.sc-row', has_text='Sample Season D').locator('[data-mv="-1"]').click(); pg.wait_for_timeout(300)
    pg.locator('.sc-row', has_text='Sample Season D').locator('[data-mv="-1"]').click(); pg.wait_for_timeout(300)
    pg.locator('.sc-row', has_text='Sample Season D').locator('[data-mv="-1"]').click(); pg.wait_for_timeout(300)
    check('toggle off + reorder saved', pg.evaluate("__mock.db.seasons.find(s => s.name === 'Sample Season B').show_on_home") is False
          and pg.evaluate("__mock.db.seasons.slice().sort((a,b)=>a.home_order-b.home_order)[0].name") == 'Sample Season D')
    pg.click('#sc-preview'); pg.wait_for_selector('.modal-full .showcase')
    check('showcase preview shows 3 live seasons, D first', pg.locator('.modal-full .sc-slide').count() == 3 and pg.inner_text('.modal-full .sc-title') == 'Sample Season D')
    pg.click('.modal [data-x]'); pg.wait_for_selector('.modal-back', state='detached')
    sid = pg.evaluate("__mock.db.seasons.find(s => s.name === 'Sample Season C').id")
    go('dev/season/' + sid, '#sform')
    pg.fill('input[name=home_tagline]', 'A brand-new tagline for the homepage.'); pg.click('.action-bar [data-a=save]'); pg.wait_for_timeout(500)
    check('season editor saves showcase tagline', pg.evaluate(f"__mock.db.seasons.find(s => s.id === '{sid}').home_tagline") == 'A brand-new tagline for the homepage.')
    go('', '.showcase')
    check('homepage reflects order + hidden season', pg.locator('.sc-slide').count() == 3 and pg.inner_text('.sc-title') == 'Sample Season D')
    go('dev/teams', '#tm-list .ev-row')
    check('teams manager: 3 offered teams with member counts', pg.locator('#tm-list .ev-row').count() == 3 and '1 member' in pg.inner_text('#tm-list'))
    pg.locator('#tm-list .ev-row', has_text='The Last Reality').locator('[data-remove]').click(); pg.wait_for_selector('[data-add]')
    check('stop offering a team', pg.locator('#tm-list .ev-row').count() == 2 and not pg.evaluate("__mock.db.groups.find(g => g.name === 'The Last Reality').is_team"))
    pg.click('.tab[href="#dev/groups"]'); pg.wait_for_selector('.admin-row')
    go('dev/group/new-team', '#gform')
    check('new team form starts with "offer as team" ticked', pg.is_checked('input[name=is_team]'))
    pg.fill('#gform input[name=name]', 'The Collective'); pg.fill('#gform input[name=name_ar]', 'الكوليكتيف'); pg.fill('#gform input[name=tagline]', 'A sample new team.')
    pg.locator('#ed-description .rte-area').click(); pg.keyboard.type('Sample team description.')
    pg.click('.action-bar [data-a=toggle]'); pg.wait_for_url(re.compile(r'#dev/group/[0-9a-f-]{36}$'))
    go('dev/countdown', '#cdf')
    pg.fill('#cdf input[name=title]', 'Chapter finale'); pg.fill('#cdf input[name=target]', '2027-03-01T20:00'); pg.dispatch_event('#cdf input[name=target]', 'change')
    check('default countdown preview updates', 'chapter finale' in pg.inner_text('#cd-prev').lower())
    pg.click('#cdf button.btn-primary'); pg.wait_for_timeout(300)
    check('default countdown saved', pg.evaluate("__mock.db.lore_site_settings[0].value.title") == 'Chapter finale')
    # new team appears automatically in the picker
    pg.evaluate("__mock.db.lore_profiles.length = 0")
    pg.evaluate("async () => { const m = await import('/js/supabase.js'); await m.sb.auth.signOut(); await m.sb.auth.signInWithPassword({}); }"); pg.wait_for_selector('.onboard')
    names = pg.evaluate("[...document.querySelectorAll('.team-names strong')].map(e => e.textContent)")
    check('teams added later appear automatically; removed ones disappear', 'The Collective' in names and 'The Last Reality' not in names)

    # ── 6. Arabic + mobile ──
    pg.click('.team-card >> nth=0'); pg.click('#team-confirm'); pg.wait_for_selector('.sidebar')
    pg.evaluate("localStorage.setItem('lore:lang','ar')"); pg.click('#lang-btn'); go('', '.showcase .sc-title')
    t0 = pg.inner_text('.sc-title'); pg.focus('.showcase'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(150)
    check('RTL: ArrowLeft goes to the next season', pg.inner_text('.sc-title') != t0 and pg.evaluate("document.documentElement.dir") == 'rtl')
    pg.wait_for_timeout(800); pg.screenshot(path=f'{SHOTS}/f7-showcase-ar.png')
    go('countdown', '#cd-stage .cd-units'); pg.wait_for_timeout(900)
    check('Arabic countdown labels', 'يوم' in pg.inner_text('#cd-stage'))
    pg.screenshot(path=f'{SHOTS}/f8-countdown-ar.png')
    pg.click('#lang-btn')
    pg.set_viewport_size({'width': 390, 'height': 844})
    for hsh, sel, name in [('', '.showcase .sc-title', 'f9-m-home'), ('countdown', '#cd-stage .cd-units', 'f10-m-countdown')]:
        go(hsh, sel); pg.wait_for_timeout(900)
        check(f'mobile {name}: no horizontal overflow', not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
        pg.screenshot(path=f'{SHOTS}/{name}.png')
    go('', '.showcase .sc-title'); t0 = pg.inner_text('.sc-title'); swipe(-160)
    check('mobile swipe changes season', pg.inner_text('.sc-title') != t0)
    go('countdown', '#cd-edit'); pg.click('#cd-edit'); pg.wait_for_selector('#cd-form'); pg.wait_for_timeout(700)
    check('mobile countdown editor: no overflow', not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
    pg.screenshot(path=f'{SHOTS}/f11-m-countdown-editor.png')
    pg.evaluate("__mock.db.lore_profiles.length = 0")
    pg.evaluate("async () => { const m = await import('/js/supabase.js'); await m.sb.auth.signOut(); await m.sb.auth.signInWithPassword({}); }"); pg.wait_for_selector('.onboard'); pg.wait_for_timeout(900)
    check('mobile onboarding: no overflow', not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
    pg.screenshot(path=f'{SHOTS}/f12-m-onboarding.png')
    b.close()

srv.shutdown()
print('\nconsole/page errors:', errors or 'none')
failed = [n for n, ok in results if not ok]
print(f'{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed or errors else 0)
