"""Offline UI test for Groups/Factions, Seasons, Timeline, Mysteries, Search and Profile.
Run: python3 tests/lore_test.py   (serves the repo and swaps supabase-js for preview/mock-supabase.js)"""
import http.server, threading, functools, sys, os, re
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
MOCK = open(os.path.join(APP, 'preview', 'mock-supabase.js')).read()
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8767), functools.partial(H, directory=APP))
threading.Thread(target=srv.serve_forever, daemon=True).start()
U = 'http://127.0.0.1:8767/index.html'
errors, results = [], []
def check(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
img = lambda n: os.path.join(HERE, n)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/.*supabase-js.*'), lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'ERR_FAILED' not in m.text and errors.append(m.text))
    pg.on('dialog', lambda d: (errors.append('native dialog: ' + d.message), d.dismiss()))
    pg.add_init_script("localStorage.setItem('lore:lang','en')")
    def go(h, sel):
        pg.goto(U + '#' + h); pg.wait_for_selector(sel)
    def saved(prefix):
        pg.wait_for_url(re.compile(prefix + r'[0-9a-f-]{36}$')); pg.wait_for_timeout(250)
    go('', '.hero')
    # Seed three characters (character CRUD is covered by ui_test.py)
    pg.evaluate("""() => { const c = (id, name, pub) => __mock.db.characters.push({ id, name, story: '<p>Story of '+name+'</p>', status: 'alive', is_published: pub, team_id: null, updated_at: new Date().toISOString() });
      c('c-a', 'The Foundation', true); c('c-b', 'Jonesy', true); c('c-c', 'Secret Agent', false); }""")

    # ── Navigation ──
    nav = pg.inner_text('#nav').lower()
    check('nav has Home, Story Archive, Chapters, Seasons, Characters, Groups, Image Archive, Timeline, Mysteries',
          all(k in nav for k in ['home', 'story archive', 'chapters', 'seasons', 'characters', 'groups', 'image archive', 'timeline', 'mysteries']))
    check('header has Search and Profile', pg.locator('#account a[href="#search"]').count() == 1 and pg.locator('#account a[href="#profile"]').count() == 1)

    # ── Relationship labels (configurable) ──
    go('dev/labels', '#ladd')
    check('6 default labels seeded', pg.locator('.label-row').count() == 6)
    pg.fill('#ladd input[name=en]', 'Double Agent'); pg.fill('#ladd input[name=ar]', 'عميل مزدوج'); pg.click('#ladd button')
    pg.wait_for_function("document.querySelectorAll('.label-row').length === 7")
    check('custom label added', pg.evaluate("__mock.db.group_relationship_types.some(t => t.label_en === 'Double Agent' && t.label_ar === 'عميل مزدوج')"))

    # ── Group with everything ──
    go('dev/group/new', '#gform')
    pg.fill('#gform input[name=name]', 'The Seven'); pg.fill('#gform input[name=status]', 'Active')
    pg.set_input_files('#logo input[type=file]', img('portrait.png'))
    for k, txt in [('description', 'Guardians of the Zero Point.'), ('story', 'The full story. ' * 400), ('history', 'Formed long ago.'), ('goals', 'Escape the Loop.')]:
        pg.locator(f'#ed-{k} .rte-area').click(); pg.evaluate("t => document.execCommand('insertText', false, t)", txt)
    for name, label, note in [('The Foundation', 'Leader', 'Founder'), ('The Foundation', 'Double Agent', ''), ('Jonesy', 'Ally', ''), ('Secret Agent', 'Member', '')]:
        pg.click('#members [data-add]')
        pg.locator('#members .rel-target').last.select_option(label=name if name != 'Secret Agent' else 'Secret Agent (Draft)')
        pg.locator('#members .rel-type').last.select_option(label=label)
        if note: pg.locator('#members .rel-note').last.fill(note)
    pg.set_input_files('#gallery input[type=file]', [img('scene.png')])
    pg.locator('#gallery .i-name').fill('Headquarters')
    pg.click('.action-bar [data-a=preview]'); pg.wait_for_selector('.modal-full .group-page')
    check('group preview renders members grouped by label', 'leader' in pg.inner_text('.modal-full .group-page').lower() and pg.locator('.modal-full .card-char').count() >= 3)
    pg.click('.modal [data-x]'); pg.wait_for_selector('.modal-back', state='detached')
    pg.click('.action-bar [data-a=toggle]'); saved('#dev/group/')
    gid = pg.evaluate("__mock.db.groups[0].id")
    g = pg.evaluate("() => { const g = __mock.db.groups[0]; return { pub: g.is_published, logo: !!g.logo_path, st: g.status, len: g.story.length, hist: g.history.includes('Formed'), goals: g.goals.includes('Loop'), rels: __mock.db.group_relationships.length, imgs: __mock.db.group_images.length } }")
    check('group saved: published, logo, status, long story, history, goals', g['pub'] and g['logo'] and g['st'] == 'Active' and g['len'] > 6000 and g['hist'] and g['goals'])
    check('group members: 4 relationships (multi-label for one character)', g['rels'] == 4)
    check('group additional image saved', g['imgs'] == 1)
    # Edit: remove Jonesy, change Secret Agent's label
    rows = pg.locator('#members .rel-row')
    for i in range(rows.count()):
        if pg.locator('#members .rel-target').nth(i).input_value() == 'c-b':
            pg.locator('#members .rel-row').nth(i).locator('[data-rm]').click(); break
    for i in range(pg.locator('#members .rel-row').count()):
        if pg.locator('#members .rel-target').nth(i).input_value() == 'c-c':
            pg.locator('#members .rel-type').nth(i).select_option(label='Enemy')
    pg.click('.action-bar [data-a=save]'); pg.wait_for_timeout(500); pg.wait_for_selector('#gform')
    lab = pg.evaluate("() => __mock.db.group_relationships.map(r => r.character_id + ':' + __mock.db.group_relationship_types.find(t => t.id === r.relationship_type_id).label_en).sort().join(',')")
    check('remove member + change relationship label', lab == 'c-a:Double Agent,c-a:Leader,c-c:Enemy')
    # second group
    go('dev/group/new', '#gform'); pg.fill('#gform input[name=name]', 'IO')
    pg.locator('#ed-description .rte-area').click(); pg.keyboard.type('The Imagined Order.')
    pg.click('#members [data-add]'); pg.locator('#members .rel-target').last.select_option(label='Jonesy')
    pg.click('.action-bar [data-a=toggle]'); saved('#dev/group/')
    io = pg.evaluate("__mock.db.groups.find(g=>g.name==='IO').id")
    # label in use cannot be deleted
    go('dev/labels', '.label-row')
    pg.locator('.label-row').filter(has=pg.locator('input.l-en[value="Leader"]')).locator('[data-del]').click(); pg.click('.modal .btn-danger')
    pg.wait_for_selector('.toast-error'); check('label in use cannot be deleted', 'used' in pg.inner_text('#toasts').lower())

    # ── Archive image for event links ──
    go('dev/image/new', '#img-form')
    pg.set_input_files('input[name=file]', img('scene.png')); pg.fill('input[name=image_name]', 'The Zero Point Opens')
    pg.click('.action-bar [data-a=toggle]'); saved('#dev/image/')
    aid = pg.evaluate("__mock.db.image_archive[0].id")

    # ── Season ──
    go('dev/season/new', '#sform')
    check('timeline asks to save season first', 'save the season first' in pg.inner_text('#sform').lower())
    pg.fill('input[name=name]', 'Zero Point'); pg.fill('input[name=chapter_number]', '2'); pg.fill('input[name=season_number]', '5')
    pg.fill('input[name=release_date]', '2021-03-16'); pg.fill('input[name=end_date]', '2021-01-01')
    pg.click('.action-bar [data-a=save]'); pg.wait_for_selector('.toast-error')
    check('end date before release rejected', 'end date' in pg.inner_text('#toasts').lower())
    pg.fill('input[name=end_date]', '2021-06-07')
    pg.set_input_files('#cover input[type=file]', img('scene.png'))
    for k, txt in [('summary', 'Bounty hunters arrive.'), ('story', 'Chapter one of the season. ' * 600), ('discoveries', 'The Zero Point is unstable.'), ('missions', 'Week 1: Bounties.')]:
        pg.locator(f'#ed-{k} .rte-area').click(); pg.evaluate("t => document.execCommand('insertText', false, t)", txt)
    pg.locator('#schars .picker-q').fill('Found'); pg.click('#schars .picker-opt'); pg.locator('#schars .link-note').fill('Recruits the hunters')
    pg.locator('#sgroups .picker-q').click(); pg.click('#sgroups .picker-opt >> text=The Seven')
    pg.set_input_files('#gallery input[type=file]', [img('inline.png')]); pg.locator('#gallery .i-name').fill('Loading screen')
    pg.click('#refs [data-add]'); pg.locator('#refs .r-title').fill('Patch notes'); pg.locator('#refs .r-url').fill('ftp://bad')
    pg.click('.action-bar [data-a=save]'); pg.wait_for_selector('.toast-error >> text=https')
    check('bad reference URL rejected', True)
    pg.locator('#refs .r-url').fill('https://example.com/notes')
    pg.click('.action-bar [data-a=save]'); saved('#dev/season/')
    sid = pg.evaluate("__mock.db.seasons[0].id")
    s = pg.evaluate("() => { const s = __mock.db.seasons[0]; return [s.is_published, s.chapter_number, s.season_number, s.release_date, s.end_date, !!s.cover_path, s.story.length > 10000, __mock.db.season_characters.length, __mock.db.season_groups.length, __mock.db.season_images.length, __mock.db.season_references.length, __mock.db.season_characters[0].note] }")
    check('season draft saved with numbers, dates, cover, long story, chars, groups, images, refs', s == [False, 2, 5, '2021-03-16', '2021-06-07', True, True, 1, 1, 1, 1, 'Recruits the hunters'])

    # ── Timeline events ──
    for title, extra in [('Bounty begins', None), ('The Spire', 'img'), ('The Zero Point Explodes', 'links')]:
        pg.click('#timeline a[href^="#dev/event/new-"]'); pg.wait_for_selector('#eform')
        pg.fill('input[name=title]', title)
        pg.locator('#ed-body .rte-area').click(); pg.keyboard.type(f'What happened: {title}.')
        if extra == 'img': pg.set_input_files('#eimg input[type=file]', img('portrait.png'))
        if extra == 'links':
            pg.locator('#echars .picker-q').click(); pg.click('#echars .picker-opt >> text=The Foundation')
            pg.locator('#egroups .picker-q').click(); pg.click('#egroups .picker-opt >> text=The Seven')
            pg.locator('#eimages .picker-q').click(); pg.click('#eimages .picker-opt >> text=The Zero Point Opens')
        pg.click('.action-bar [data-a=save]'); pg.wait_for_url(re.compile(r'#dev/season/' + sid + '$')); pg.wait_for_selector('#ev-list .ev-row')
    order = lambda: pg.evaluate("() => __mock.db.season_events.slice().sort((a,b)=>a.position-b.position).map(e=>e.title)")
    ids_before = pg.evaluate("__mock.db.season_events.map(e=>e.id).sort().join()")
    check('3 events in creation order', order() == ['Bounty begins', 'The Spire', 'The Zero Point Explodes'])
    pg.locator('#ev-list .ev-row').nth(2).locator('[data-mv="-1"]').click(); pg.wait_for_timeout(300)
    check('reorder with ↑ saves order', order() == ['Bounty begins', 'The Zero Point Explodes', 'The Spire'])
    pg.evaluate('''() => { const rows = document.querySelectorAll('#ev-list .ev-row'); const dt = new DataTransfer();
      const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(rows[2], 'dragstart'); fire(rows[0], 'dragover'); fire(rows[0], 'drop'); fire(rows[2], 'dragend'); }'''); pg.wait_for_timeout(300)
    check('reorder with drag & drop saves order', order() == ['The Spire', 'Bounty begins', 'The Zero Point Explodes'])
    check('reordering keeps the same event records', pg.evaluate("__mock.db.season_events.map(e=>e.id).sort().join()") == ids_before)
    ev3 = pg.evaluate("__mock.db.season_events.find(e=>e.title==='The Zero Point Explodes').id")
    check('event links: character, group, archive image', pg.evaluate(f"[__mock.db.event_characters.filter(x=>x.event_id==='{ev3}').length, __mock.db.event_groups.filter(x=>x.event_id==='{ev3}').length, __mock.db.event_images.filter(x=>x.event_id==='{ev3}').length].join()") == '1,1,1')
    # edit event without recreating
    pg.locator('#ev-list .ev-row').nth(0).locator('a.btn').click(); pg.wait_for_selector('#eform')
    pg.fill('input[name=title]', 'The Spire (edited)'); pg.click('.action-bar [data-a=save]'); pg.wait_for_url(re.compile(r'#dev/season/' + sid + '$'))
    check('event edited in place', order()[0] == 'The Spire (edited)' and pg.evaluate("__mock.db.season_events.length") == 3)
    # season preview + publish
    pg.wait_for_selector('#sform')
    pg.click('.action-bar [data-a=preview]'); pg.wait_for_selector('.modal-full .season-page')
    check('season preview shows timeline in order', pg.locator('.modal-full .tl-item').count() == 3)
    pg.click('.modal [data-x]'); pg.wait_for_selector('.modal-back', state='detached')
    pg.click('.action-bar [data-a=toggle]'); pg.wait_for_timeout(500)
    check('season published', pg.evaluate("__mock.db.seasons[0].is_published") is True)
    # link group → season/events from the group side
    go('dev/group/' + io, '#gform'); pg.wait_for_timeout(300)
    pg.wait_for_selector('#gseasons .picker-q')
    pg.locator('#gseasons .picker-q').click(); pg.click('#gseasons .picker-opt >> text=Zero Point')
    pg.locator('#gevents .picker-q').click(); pg.click('#gevents .picker-opt >> text=Bounty begins')
    pg.click('.action-bar [data-a=save]'); pg.wait_for_timeout(500)
    check('group → season and group → event links saved', pg.evaluate(f"__mock.db.season_groups.some(x=>x.group_id==='{io}') && __mock.db.event_groups.some(x=>x.group_id==='{io}')"))

    # ── Mystery ──
    go('dev/mystery/new', '#mform')
    pg.fill('input[name=title]', 'Who built the Zero Point?'); pg.click('#mform label:has(input[value=partial])')
    pg.select_option('select[name=season_id]', label='Zero Point')
    pg.click('.action-bar [data-a=toggle]'); pg.wait_for_selector('.toast-error')
    check('mystery needs text to publish', True)
    pg.locator('#ed-body .rte-area').click(); pg.keyboard.type('Nobody knows yet.')
    pg.click('.action-bar [data-a=toggle]'); saved('#dev/mystery/')
    mid = pg.evaluate("__mock.db.mysteries[0].id")
    check('mystery published with status + season', pg.evaluate("[__mock.db.mysteries[0].is_published, __mock.db.mysteries[0].status, !!__mock.db.mysteries[0].season_id].join()") == 'true,partial,true')

    # ── Public pages ──
    go('season/' + sid, '.season-page .tl-item')
    txt = pg.inner_text('.season-page').lower()
    check('season page: cover, chapter/season ids, dates', pg.locator('.season-hero .hero-bg[data-bg]').count() == 1 and 'chapter 2' in txt and 'season 5' in txt and '2021' in txt)
    check('season page: timeline in chronological order', [pg.locator('.tl-body h3').nth(i).inner_text() for i in range(3)] == ['The Spire (edited)', 'Bounty begins', 'The Zero Point Explodes'])
    check('season page: characters, groups, discoveries, missions, mysteries, images, refs',
          pg.locator('#sec-characters .card-char').count() == 1 and pg.locator('#sec-groups .card-group').count() == 2 and pg.locator('#sec-discoveries').count() == 1
          and pg.locator('#sec-missions').count() == 1 and pg.locator('#sec-mysteries .mystery-row').count() == 1 and pg.locator('#sec-images .gallery-item').count() == 1
          and pg.locator('#sec-refs a[href="https://example.com/notes"]').count() == 1)
    check('season page: contents bar', pg.locator('.season-toc button').count() >= 6)
    pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/l1-season.png')
    pg.locator('#sec-timeline').scroll_into_view_if_needed(); pg.wait_for_timeout(400); pg.screenshot(path=f'{SHOTS}/l2-season-timeline.png')
    go('event/' + ev3, '#ev-body')
    check('event page: links to character, group, image', pg.locator('.meta-card a[href^="#character/"]').count() == 1 and pg.locator('.meta-card a[href^="#group/"]').count() == 1 and pg.locator('.card-img').count() == 1)
    go('group/' + gid, '.group-page')
    gt = pg.inner_text('.group-page').lower()
    check('group page: description, story, history, goals', all(k in gt for k in ['guardians', 'full story', 'background', 'goals']))
    check('group page: related season + event', pg.locator('.side-card a[href^="#season/"]').count() == 1 and pg.locator('.side-card a[href^="#event/"]').count() == 1)
    check('group page (developer): 3 member cards incl. draft (one character under 2 labels)', pg.locator('.group-page .card-char').count() == 3)
    pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/l3-group.png')
    go('character/c-a', '.profile')
    check('character page: groups with labels + season/event appearances', pg.locator('.rel-card').count() == 2 and pg.locator('a[href="#season/' + sid + '"]').count() >= 1 and pg.locator('a[href="#event/' + ev3 + '"]').count() == 1)
    go('seasons', '.card-season'); check('seasons list grouped by chapter', 'chapter 2' in pg.inner_text('#results').lower())
    go('chapters', '.chapter-card'); check('chapters page', pg.locator('.chapter-card').count() == 1)
    pg.click('.chapter-card'); pg.wait_for_selector('.chapter-seasons .card-season'); check('chapter page lists its seasons', True)
    go('story', '.saga-item'); check('story archive lists season summary', 'bounty hunters arrive' in pg.inner_text('.saga-item').lower())
    pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/l4-story.png')
    go('timeline', '.timeline-global'); check('global timeline lists events with chapter/season headers', pg.locator('.timeline-global .tl-item').count() == 3 and pg.locator('.tl-chapter').count() == 1)
    pg.wait_for_timeout(900); pg.screenshot(path=f'{SHOTS}/l5-timeline.png')
    go('mysteries', '.mystery-row'); check('mysteries list', 'partly answered' in pg.inner_text('#results').lower())
    go('mystery/' + mid, '#m-body'); check('mystery page', 'nobody knows' in pg.inner_text('#m-body').lower())
    go('search', '#sform'); pg.fill('#sform input', 'zero'); pg.wait_for_selector('.search-block')
    st = pg.inner_text('#results').lower()
    check('search finds seasons, events, images, mysteries', all(k in st for k in ['seasons', 'events', 'image archive', 'mysteries']))
    go('profile', '.profile-page'); check('profile shows email + role', 'dev@test' in pg.inner_text('.profile-page') and 'developer' in pg.inner_text('.profile-page').lower())

    # ── Arabic + mobile ──
    pg.click('#lang-btn'); pg.wait_for_timeout(200)
    go('season/' + sid, '.season-page .tl-item'); pg.wait_for_timeout(900)
    check('Arabic season page RTL', pg.evaluate("document.documentElement.dir") == 'rtl' and 'الخط الزمني' in pg.inner_text('.season-page'))
    pg.screenshot(path=f'{SHOTS}/l6-season-ar.png')
    go('group/' + gid, '.group-page'); check('Arabic relationship labels', 'قائد' in pg.inner_text('.group-page')); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{SHOTS}/l7-group-ar.png')
    pg.click('#lang-btn')
    pg.set_viewport_size({'width': 390, 'height': 844})
    for hsh, sel, name in [('season/' + sid, '.season-page', 'l8-m-season'), ('dev/season/' + sid, '#sform', 'l9-m-season-editor'), ('dev/group/' + gid, '#gform', 'l10-m-group-editor'), ('timeline', '.timeline', 'l11-m-timeline')]:
        go(hsh, sel); pg.wait_for_timeout(800)
        check(f'mobile {name}: no horizontal overflow', not pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
        pg.screenshot(path=f'{SHOTS}/{name}.png')
    pg.click('#menu-btn'); pg.wait_for_timeout(300)
    check('mobile menu shows all sections incl. Search + Profile', all(k in pg.inner_text('#nav').lower() for k in ['story archive', 'timeline', 'mysteries', 'search', 'profile']))
    pg.screenshot(path=f'{SHOTS}/l12-m-menu.png')
    pg.click('#menu-btn')
    pg.set_viewport_size({'width': 1280, 'height': 900})

    # ── Normal user visibility ──
    go('dev/seasons', '.admin-row')  # unpublish nothing; check drafts are hidden for readers
    pg.evaluate("() => { __mock.role = 'user'; __mock.db.lore_user_roles = []; }")
    go('profile', '#p-out'); pg.click('#p-out'); go('login', '#auth-form')
    pg.fill('input[name=email]', 'reader@test.com'); pg.fill('input[name=password]', 'password123'); pg.click('#auth-form button[type=submit]'); pg.wait_for_timeout(400)
    go('group/' + gid, '.group-page')
    check('reader: draft character hidden from group members', pg.locator('.group-page .card-char').count() == 2 and 'secret agent' not in pg.inner_text('.group-page').lower())
    check('reader: no edit buttons', pg.locator('a[href^="#dev"]').count() == 0)
    r = pg.evaluate("async () => { const m = await import('/js/supabase.js'); const a = await m.sb.from('seasons').insert({ name: 'hack' }); const b = await m.sb.rpc('lore_reorder_events', { _season_id: 'x', _ids: [] }); return !!a.error && !!b.error }")
    check('reader: writes refused by backend', r)
    go('dev/season/' + sid, '#main'); pg.wait_for_timeout(300)
    check('reader: dashboard blocked', 'developers only' in pg.inner_text('#main').lower())

    # ── Delete cascade (developer) ──
    pg.evaluate("() => { __mock.role = 'developer'; __mock.db.lore_user_roles = [{ user_id: 'u-dev', role: 'developer' }]; }")
    go('profile', '#p-out'); pg.click('#p-out'); go('login', '#auth-form')
    pg.fill('input[name=email]', 'dev@test.com'); pg.fill('input[name=password]', 'password123'); pg.click('#auth-form button[type=submit]'); pg.wait_for_timeout(400)
    go('dev/season/' + sid, '#sform'); pg.click('.action-bar [data-a=delete]'); pg.click('.modal .btn-danger'); pg.wait_for_url(re.compile(r'#dev/seasons$')); pg.wait_for_timeout(300)
    check('delete season: events, links, images, refs removed; mystery kept unlinked; files removed',
          pg.evaluate("[__mock.db.seasons.length, __mock.db.season_events.length, __mock.db.event_characters.length, __mock.db.season_groups.length, __mock.db.season_images.length, __mock.db.season_references.length, __mock.db.mysteries.length, __mock.db.mysteries[0].season_id === null, [...__mock.files.keys()].some(k => k.startsWith('seasons/') || k.startsWith('events/'))].join()") == '0,0,0,0,0,0,1,true,false')
    go('dev/groups', '.admin-row'); pg.locator('.admin-row', has_text='The Seven').locator('[data-act=del]').click(); pg.click('.modal .btn-danger'); pg.wait_for_timeout(400)
    check('delete group: relationships and images removed, characters kept', pg.evaluate(f"[__mock.db.groups.some(g=>g.id==='{gid}'), __mock.db.group_relationships.some(r=>r.group_id==='{gid}'), __mock.db.group_images.length, __mock.db.characters.length].join()") == 'false,false,0,3')
    b.close()

srv.shutdown()
print('\nconsole/page errors:', errors or 'none')
failed = [n for n, ok in results if not ok]
print(f'{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed or errors else 0)
