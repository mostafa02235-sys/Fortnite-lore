"""Offline UI test: serves the app locally and swaps supabase-js for an in-memory mock."""
import http.server, threading, functools, sys, os, re
from playwright.sync_api import sync_playwright, expect

APP = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
MOCK = open(os.path.join(HERE, '..', 'preview', 'mock-supabase.js')).read()

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(H, directory=APP))
threading.Thread(target=srv.serve_forever, daemon=True).start()

errors, results = [], []
def check(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/.*supabase-js.*'), lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and not 'ERR_FAILED' in m.text and errors.append(m.text))
    pg.on('dialog', lambda d: (errors.append('native dialog: ' + d.message), d.dismiss()))
    pg.add_init_script("localStorage.setItem('lore:lang','en')")
    def unlock(code):
        pg.click('#dev-unlock'); pg.wait_for_selector('.devcode input[name=code]')
        pg.fill('.devcode input[name=code]', code); pg.click('.devcode button[type=submit]')
    pg.goto('http://127.0.0.1:8765/index.html#dev'); pg.wait_for_selector('.dev-locked')
    check('dashboard locked until the access code is entered', pg.locator('.stats').count() == 0 and pg.locator('.nav-dev').count() == 0)
    unlock('WRONG-CODE'); pg.wait_for_selector('.devcode .form-msg:not([hidden])')
    check('wrong access code shows a clear error', 'not correct' in pg.inner_text('.devcode .form-msg').lower().replace('’', "'").replace("isn't", 'not'))
    check('wrong code creates no session', pg.evaluate("__mock.db.lore_dev_sessions.length") == 0)
    pg.fill('.devcode input[name=code]', 'PREVIEW'); pg.click('.devcode button[type=submit]')
    pg.wait_for_selector('.stats')
    check('correct code unlocks Developer Mode (time-limited session)', pg.locator('.nav-dev').count() == 1 and pg.locator('.dev-mode').count() == 1
          and pg.evaluate("(new Date(__mock.db.lore_dev_sessions[0].expires_at) - Date.now()) / 3600e3") > 7.9)
    # Leak check: pass the real code via an environment variable (never write it in this file).
    secret = os.environ.get('LORE_DEV_CODE', '')
    if secret:
        leaks = [os.path.join(r, f) for r, _, fs in os.walk(APP) if '.git' not in r for f in fs if secret in open(os.path.join(r, f), encoding='utf-8', errors='ignore').read()]
        check('real access code appears in no file of the site or repo', not leaks)
        check('real access code not in served page or scripts', secret not in pg.content())
    else:
        print('SKIP leak check (set LORE_DEV_CODE to run it)')

    # Groups (quick create so characters can be linked)
    for name, desc in [('The Seven', 'Guardians of the Zero Point.'), ('IO', 'The Imagined Order.')]:
        pg.goto('http://127.0.0.1:8765/index.html#dev/group/new'); pg.wait_for_selector('#gform')
        pg.fill('#gform input[name=name]', name)
        pg.locator('#ed-description .rte-area').click(); pg.keyboard.type(desc)
        pg.click('.action-bar [data-a=toggle]'); pg.wait_for_url(re.compile(r'#dev/group/[0-9a-f-]{36}$')); pg.wait_for_selector('#gform')
    check('two groups created and published', pg.evaluate("__mock.db.groups.filter(g=>g.is_published).length") == 2)
    pg.goto('http://127.0.0.1:8765/index.html#dev/group/new'); pg.wait_for_selector('#gform')
    pg.fill('#gform input[name=name]', 'the seven'); pg.click('.action-bar [data-a=save]')
    pg.wait_for_selector('.toast-error'); check('duplicate group name rejected with message', 'already' in pg.inner_text('#toasts'))

    # New character
    pg.goto('http://127.0.0.1:8765/index.html#dev/character/new'); pg.wait_for_selector('#char-form')
    pg.click('.action-bar [data-a=save]')
    pg.wait_for_selector('.toast-error'); check('name required validation', 'name is required' in pg.inner_text('#toasts'))
    pg.fill('input[name=name]', 'The Foundation')
    pg.check('input[name=status][value=alive]', force=True)
    pg.click('#char-groups [data-add]')
    pg.locator('#char-groups .rel-target').last.select_option(label='The Seven')
    pg.locator('#char-groups .rel-type').last.select_option(label='Leader')
    pg.click('#char-groups [data-add]')
    pg.locator('#char-groups .rel-target').last.select_option(label='IO')
    pg.locator('#char-groups .rel-type').last.select_option(label='Former Member')
    pg.locator('#char-groups .rel-note').last.fill('Left after the war')
    pg.set_input_files('#add-img', [os.path.join(HERE, 'portrait.png'), os.path.join(HERE, 'scene.png')])
    pg.wait_for_function("document.querySelectorAll('.img-item').length === 2")
    pg.locator('.i-name').nth(0).fill('Zero Point portrait')
    pg.locator('.img-item .rte-area').nth(0).click(); pg.keyboard.type('Taken moments before the Zero Point collapsed.')
    pg.locator('.i-name').nth(1).fill('Battle at the Spire')
    # Story with heading + list + bold
    story = pg.locator('#story-ed .rte-area')
    story.click()
    pg.locator('#story-ed .rte-btn[data-cmd="formatBlock:h2"]').click(); pg.keyboard.type('Origins'); pg.keyboard.press('Enter')
    pg.locator('#story-ed .rte-btn[data-cmd="formatBlock:p"]').click()
    pg.keyboard.type('Leader of the Seven. '); pg.keyboard.press('Control+b'); pg.keyboard.type('Bold claim.'); pg.keyboard.press('Control+b'); pg.keyboard.press('Enter')
    pg.locator('#story-ed .rte-btn[data-cmd=insertUnorderedList]').click(); pg.keyboard.type('Item one'); pg.keyboard.press('Enter'); pg.keyboard.type('Item two'); pg.keyboard.press('Enter'); pg.keyboard.press('Enter')
    long = 'Long lore paragraph. ' * 3000
    pg.evaluate("t => document.execCommand('insertText', false, t)", long)
    # inline image via editor
    with pg.expect_file_chooser() as fc:
        pg.locator('#story-ed .rte-btn[data-cmd=image]').click()
    fc.value.set_files(os.path.join(HERE, 'inline.png'))
    pg.wait_for_selector('#story-ed figure img')
    # Arabic RTL paragraph
    pg.keyboard.type('هذه فقرة عربية'); pg.locator('#story-ed .rte-btn[data-cmd="dir:rtl"]').click()
    check('word count shows', int(re.sub(r'\D','',pg.inner_text('#story-ed .rte-count'))) > 9000)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/01-char-editor.png', full_page=False)
    # Preview
    pg.click('.action-bar [data-a=preview]'); pg.wait_for_selector('.modal-full .profile')
    check('preview shows name', 'the foundation' in pg.inner_text('.modal-full .profile-id').lower())
    check('preview shows story heading', pg.locator('.modal-full #story h2').count() == 1)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/02-preview.png')
    pg.click('.modal [data-x]')
    pg.wait_for_selector('.modal-back', state='detached')
    # Save draft
    pg.click('.action-bar [data-a=save]')
    pg.wait_for_url(re.compile(r'#dev/character/[0-9a-f-]{36}$'))
    pg.wait_for_selector('#char-form')
    st = pg.evaluate("() => { const c = __mock.db.characters[0]; return {pub: c.is_published, status: c.status, len: c.story.length, h2: c.story.includes('<h2>'), ul: c.story.includes('<ul>'), b: /<(b|strong)>/.test(c.story), img: /data-path=\"inline\\//.test(c.story), noblob: !c.story.includes('blob:'), rtl: c.story.includes('dir=\"rtl\"'), imgs: __mock.db.character_images.length, cover: __mock.db.character_images.filter(i=>i.is_primary).length, iname: __mock.db.character_images.find(i=>i.is_primary).image_name, istory: __mock.db.character_images.find(i=>i.is_primary).image_story} }")
    print(st)
    check('draft saved unpublished', st['pub'] is False)
    check('status saved', st['status'] == 'alive')
    rels = pg.evaluate("__mock.db.group_relationships.map(r => [__mock.db.groups.find(g=>g.id===r.group_id).name, __mock.db.group_relationship_types.find(t=>t.id===r.relationship_type_id).label_en, r.note])")
    check('character in 2 groups with labels Leader + Former Member', sorted(map(tuple, rels)) == [('IO', 'Former Member', 'Left after the war'), ('The Seven', 'Leader', '')])
    check('long rich story saved (>60k chars, h2/ul/bold/rtl)', st['len'] > 60000 and st['h2'] and st['ul'] and st['b'] and st['rtl'])
    check('inline image stored as storage path, no blob url', st['img'] and st['noblob'])
    check('2 character images, exactly 1 cover, name+story saved', st['imgs'] == 2 and st['cover'] == 1 and st['iname'] == 'Zero Point portrait' and 'Zero Point' in st['istory'])
    char_id = pg.evaluate("__mock.db.characters[0].id")
    # editing reloads saved content
    check('editor reloads saved story', 'origins' in pg.inner_text('#story-ed .rte-area').lower())
    # Change cover to 2nd image and save
    pg.locator('input[name=cover]').nth(1).check()
    pg.click('.action-bar [data-a=save]'); pg.wait_for_timeout(400)
    check('cover changed', pg.evaluate("__mock.db.character_images.find(i=>i.is_primary).image_name") == 'Battle at the Spire')
    # Publish
    pg.click('.action-bar [data-a=toggle]'); pg.wait_for_timeout(500); pg.wait_for_selector('#char-form')
    check('character published', pg.evaluate("__mock.db.characters[0].is_published") is True)
    check('button now says Unpublish', 'Unpublish' in pg.inner_text('.action-bar [data-a=toggle]'))

    # Second character (draft, no story) for visibility tests
    pg.goto('http://127.0.0.1:8765/index.html#dev/character/new'); pg.wait_for_selector('#char-form')
    pg.fill('input[name=name]', 'Secret Draft'); pg.click('.action-bar [data-a=toggle]')
    pg.wait_for_selector('.toast-error'); check('publish without story blocked in UI', 'story' in pg.inner_text('#toasts').lower())
    pg.click('.action-bar [data-a=save]'); pg.wait_for_url(re.compile(r'#dev/character/[0-9a-f-]{36}$'))

    # Image archive
    pg.goto('http://127.0.0.1:8765/index.html#dev/image/new'); pg.wait_for_selector('#img-form')
    pg.set_input_files('input[name=file]', os.path.join(HERE, 'scene.png'))
    pg.fill('input[name=image_name]', 'The Zero Point Opens')
    pg.fill('input[name=chapter]', 'Chapter 2'); pg.fill('input[name=event_name]', 'The Device')
    pg.select_option('select[name=character_id]', label='The Foundation')
    pg.locator('#story-ed .rte-area').click(); pg.keyboard.type('The sky split open over the Agency.')
    pg.click('.action-bar [data-a=preview]'); pg.wait_for_selector('.modal-full .imgpage')
    check('image preview renders', 'the zero point opens' in pg.inner_text('.modal-full .imgpage-head').lower())
    pg.click('.modal [data-x]'); pg.wait_for_selector('.modal-back', state='detached')
    pg.click('.action-bar [data-a=toggle]'); pg.wait_for_url(re.compile(r'#dev/image/[0-9a-f-]{36}$')); pg.wait_for_selector('#img-form')
    a = pg.evaluate("() => { const r = __mock.db.image_archive[0]; return [r.is_published, r.chapter, r.event_name, !!r.character_id, r.storage_path.startsWith('archive/'), !!r.uploaded_at] }")
    check('archive record saved+published with chapter/event/character/upload date', a == [True, 'Chapter 2', 'The Device', True, True, True])
    img_id = pg.evaluate("__mock.db.image_archive[0].id")
    # replace image file
    old = pg.evaluate("__mock.db.image_archive[0].storage_path")
    pg.set_input_files('input[name=file]', os.path.join(HERE, 'inline.png'))
    pg.click('.action-bar [data-a=save]'); pg.wait_for_timeout(500)
    check('image replaced, old file removed', pg.evaluate(f"__mock.db.image_archive[0].storage_path !== '{old}' && !__mock.files.has('{old}')"))

    # Public pages
    pg.goto('http://127.0.0.1:8765/index.html#characters'); pg.wait_for_selector('.card-char')
    check('characters list shows only published', pg.locator('.card-char').count() == 1)
    pg.goto(f'http://127.0.0.1:8765/index.html#character/{char_id}'); pg.wait_for_selector('.profile #story h2')
    check('profile: story, status, groups, cover note, gallery', pg.locator('.profile .status-alive').count() >= 1 and 'the seven' in pg.inner_text('.profile-id').lower() and pg.locator('.image-note').count() == 1 and pg.locator('.gallery-item').count() == 1)
    check('profile: group cards show relationship labels', pg.locator('.rel-card').count() == 2 and 'leader' in pg.inner_text('.rel-cards').lower() and 'former member' in pg.inner_text('.rel-cards').lower())
    check('profile: inline story image hydrated', pg.evaluate("!!document.querySelector('#story figure img').src"))
    check('profile: related archive image', pg.locator('.grid-imgs .card-img').count() == 1)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/03-profile.png')
    pg.goto(f'http://127.0.0.1:8765/index.html#image/{img_id}'); pg.wait_for_selector('.stage-fig img.loaded')
    txt = pg.inner_text('.meta-card')
    check('image detail: character, event, chapter, date', 'the foundation' in txt.lower() and 'The Device' in txt and 'Chapter 2' in txt and 'uploaded' in txt.lower())
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/04-image-detail.png')
    gid = pg.evaluate("__mock.db.groups.find(t=>t.name==='The Seven').id")
    pg.goto('http://127.0.0.1:8765/index.html#team/' + gid); pg.wait_for_selector('.group-page')
    check('legacy team link redirects to group page', pg.evaluate("location.hash") == '#group/' + gid)
    check('group page lists member under Leader', pg.locator('.group-page .card-char').count() == 1 and 'leader' in pg.inner_text('.group-page').lower())
    pg.goto('http://127.0.0.1:8765/index.html#'); pg.wait_for_selector('.hero')
    pg.wait_for_timeout(300); pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/05-home.png')

    # Arabic RTL
    pg.click('#lang-btn'); pg.wait_for_timeout(300)
    check('Arabic switches to RTL', pg.evaluate("document.documentElement.dir") == 'rtl' and 'الشخصيات' in pg.inner_text('#nav'))
    pg.goto(f'http://127.0.0.1:8765/index.html#character/{char_id}'); pg.wait_for_selector('.profile #story h2'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/06-profile-ar.png')
    pg.goto('http://127.0.0.1:8765/index.html#dev/character/' + char_id); pg.wait_for_selector('#char-form'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/07-editor-ar.png')
    pg.click('#lang-btn')

    # Unpublish, then normal user
    pg.goto('http://127.0.0.1:8765/index.html#dev/images'); pg.wait_for_selector('[data-act=pub]')
    pg.click('[data-act=pub]'); pg.wait_for_timeout(300)
    check('unpublish from list', pg.evaluate("__mock.db.image_archive[0].is_published") is False)
    pg.click('[data-act=pub]'); pg.wait_for_timeout(300)

    pg.goto('http://127.0.0.1:8765/index.html#profile'); pg.wait_for_selector('#p-out'); pg.click('#p-out'); pg.wait_for_timeout(400)
    check('signing out ends Developer Mode', pg.evaluate("__mock.db.lore_dev_sessions.length") == 0)
    check('signed-out users see the sign-in gate', pg.locator('.gate').count() == 1 or pg.locator('.hero').count() == 0)
    pg.goto('http://127.0.0.1:8765/index.html#login'); pg.wait_for_selector('#auth-form')
    pg.fill('input[name=email]', 'reader@test.com'); pg.fill('input[name=password]', 'password123'); pg.click('#auth-form button[type=submit]')
    pg.wait_for_timeout(500)
    check('normal user: no Developer nav, only the locked Developer Mode entry', pg.locator('.nav-dev').count() == 0 and pg.locator('#nav-devmode').count() == 1)
    pg.goto('http://127.0.0.1:8765/index.html#dev'); pg.wait_for_timeout(300)
    check('normal user: dashboard blocked', 'developer mode is locked' in pg.inner_text('#main').lower())
    pg.goto('http://127.0.0.1:8765/index.html#dev/character/new'); pg.wait_for_timeout(300)
    check('normal user: editor routes blocked too', pg.locator('#char-form').count() == 0)
    pg.goto('http://127.0.0.1:8765/index.html#characters'); pg.wait_for_selector('.card-char')
    check('normal user: sees published only', pg.locator('.card-char').count() == 1 and 'Secret Draft' not in pg.inner_text('#main'))
    pg.goto(f'http://127.0.0.1:8765/index.html#character/{char_id}'); pg.wait_for_selector('.profile')
    check('normal user: no edit button on profile', pg.locator('.profile a[href^="#dev"]').count() == 0)
    # Forced write attempt from console is refused
    r = pg.evaluate("async () => { const m = await import('/js/supabase.js'); const { error } = await m.sb.from('characters').insert({ name: 'hack' }); return !!error }")
    check('normal user: direct insert refused by backend', r)

    # Mobile
    pg.evaluate("() => { __mock.db.lore_user_roles = [{user_id:'u-dev', role:'admin', email:'dev@test'}]; }")
    pg.goto('http://127.0.0.1:8765/index.html#profile'); pg.wait_for_selector('#p-out'); pg.click('#p-out'); pg.goto('http://127.0.0.1:8765/index.html#login'); pg.wait_for_selector('#auth-form')
    pg.fill('input[name=email]', 'dev@test.com'); pg.fill('input[name=password]', 'password123'); pg.click('#auth-form button[type=submit]'); pg.wait_for_timeout(400)
    pg.goto('http://127.0.0.1:8765/index.html#dev'); pg.wait_for_selector('.dev-locked'); unlock('PREVIEW'); pg.wait_for_selector('.stats')
    pg.set_viewport_size({'width': 390, 'height': 844})
    pg.goto('http://127.0.0.1:8765/index.html#dev/character/' + char_id); pg.wait_for_selector('#char-form'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/08-mobile-editor.png')
    overflow = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check('mobile editor: no horizontal overflow', not overflow)
    pg.goto('http://127.0.0.1:8765/index.html#dev/access'); pg.wait_for_selector('#grant')
    check('admin sees Access tab with active sessions', pg.locator('.tab', has_text='Access').count() == 1 and pg.locator('[data-s]').count() == 1)
    pg.click('#dev-exit'); pg.wait_for_timeout(500)
    check('Exit Developer Mode ends the session and hides the dashboard', pg.evaluate("__mock.db.lore_dev_sessions.length") == 0 and pg.locator('#nav-devmode').count() == 1)
    pg.goto('http://127.0.0.1:8765/index.html#dev'); pg.wait_for_selector('.dev-locked'); unlock('PREVIEW'); pg.wait_for_selector('.stats')
    pg.goto(f'http://127.0.0.1:8765/index.html#image/{img_id}'); pg.wait_for_selector('.stage-fig img.loaded'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1000); pg.screenshot(path=f'{SHOTS}/09-mobile-image.png', full_page=True)
    check('mobile image page: no horizontal overflow', not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
    pg.set_viewport_size({'width': 1280, 'height': 900})

    # Delete
    pg.goto('http://127.0.0.1:8765/index.html#dev/characters'); pg.wait_for_selector('.admin-row')
    pg.locator('.admin-row', has_text='The Foundation').locator('[data-act=del]').click()
    pg.click('.modal .btn-danger'); pg.wait_for_timeout(400)
    check('character deleted, images cascade, files removed, archive link cleared',
          pg.evaluate("!__mock.db.characters.some(c=>c.name==='The Foundation') && __mock.db.character_images.length===0 && __mock.db.image_archive[0].character_id===null && [...__mock.files.keys()].every(k=>!k.startsWith('characters/'))"))
    pg.goto('http://127.0.0.1:8765/index.html#dev/images'); pg.wait_for_selector('.admin-row')
    pg.click('[data-act=del]'); pg.click('.modal .btn-danger'); pg.wait_for_timeout(400)
    check('archive image deleted', pg.evaluate("__mock.db.image_archive.length === 0"))
    # XSS: stored script/onerror must not run
    pg.evaluate("""() => { __mock.db.characters.push({id:'x1', name:'<img src=x onerror=window.__xss=1>', story:'<p>ok</p><img src=x onerror="window.__xss=2"><script>window.__xss=3</script><a href="javascript:window.__xss=4">l</a>', status:'unknown', is_published:true, team_id:null}) }""")
    pg.goto('http://127.0.0.1:8765/index.html#character/x1'); pg.wait_for_selector('.profile'); pg.wait_for_timeout(300)
    check('XSS payloads neutralised', pg.evaluate("window.__xss === undefined") and pg.locator('#story a[href^="javascript"]').count() == 0)
    b.close()

srv.shutdown()
print('\nconsole/page errors:', errors or 'none')
failed = [n for n, ok in results if not ok]
print(f'{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed or errors else 0)
