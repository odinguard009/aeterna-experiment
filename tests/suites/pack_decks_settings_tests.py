# v0.17.0: built-in pack, deck slots, prebuilt decks, CPU deck choice, settings, PLAY page. Every chk() is one numbered test.
import json as _json_c, os as _os_c  # counts come from the card data, so a new colour needs no edit here
_CARDS = _json_c.load(open(_os_c.path.join(_os_c.path.dirname(_os_c.path.abspath(__file__)), '..', '..', 'build', 'all-cards.json'), encoding='utf-8'))
PACK_N = len(_CARDS); CONTRACTORS = sorted(c['id'] for c in _CARDS if c['type'] == 'Nexus' and '-CX' in c['id'])
import os as _os_repo
_REPO = _os_repo.path.abspath(_os_repo.path.join(_os_repo.path.dirname(_os_repo.path.abspath(__file__)), '..', '..'))
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, time, random
F = "file:///mnt/user-data/outputs/wip.html"
ALL = open(_os_repo.path.join(_REPO, 'build/all-cards.json'), encoding='utf-8').read()
WHITE = json.dumps([c for c in json.loads(ALL) if c['color'] == 'white'])
res = []
random.seed(17)
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def page(b, w=1280, h=800, init=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}); 
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.goto(F); ready(pg); return pg, errs, ctx
ev = lambda pg, js: pg.evaluate(js)
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- A. built-in pack ----------
    pg, errs, ctx = page(b)
    chk(f'pack: {PACK_N} cards available without any import (Brave included since v0.34)', ev(pg, "Object.values(BS.CARDS).filter(c=>c.pack).length") == PACK_N)
    chk('pack: white Mitra deck cards present with their effects', ev(pg, "BS.CARDS['BS74-CX03'].revive===true&&BS.CARDS['BS75-041'].effects[0].trigger==='ALLY_LIFE_HIT'"))
    chk('pack: red cards present', ev(pg, "!!BS.CARDS['BS75-011']&&!!BS.CARDS['BS76-007']&&!!BS.CARDS['BS75-X01']"))
    chk('pack: the Brave card is loaded as a Brave', ev(pg, "BS.CARDS['BS76-060'].type==='Brave'"))
    chk('pack: cards are not stored as imports', ev(pg, "(localStorage.getItem('bse.cards.v4')||'[]')").count('BS75') == 0)
    chk('pack: legacy test cards still exist', ev(pg, "!!BS.CARDS['TRAIN-01']&&!!BS.CARDS['TST-001']"))
    _all = json.loads(ALL); r = {'ok': 0, 'bad': []}
    for k in range(0, len(_all), 2500):        # importCards refuses more than 3000 cards per call (cleanup_review_tests D10): import in chunks like tools/promote_compiled.mjs
        rr = pg.evaluate("(t)=>BS.importCards(t)", json.dumps(_all[k:k+2500])); r['ok'] += rr['ok']; r['bad'] += rr['bad']
    chk(f'import all-cards.json over the pack: {PACK_N} ok, none rejected', r['ok'] == PACK_N and not r['bad'], r)
    ev(pg, "BS.clearImported()")
    chk('Remove imported cards keeps the pack', ev(pg, "!!BS.CARDS['BS74-CX03']&&Object.values(BS.CARDS).filter(c=>c.pack).length")== PACK_N)
    pg.reload(); ready(pg)
    chk('pack survives a reload and removal of imports', ev(pg, "Object.values(BS.CARDS).filter(c=>c.pack).length") == PACK_N and not errs, errs)
    ev(pg, "BS.importCards(JSON.stringify([{id:'BS74-CX03',name:'Override Mitra',type:'Nexus',color:'white',cost:2,levels:[{cores:0},{cores:2}]}]))")
    chk('an import with the same ID overrides the pack card', ev(pg, "BS.CARDS['BS74-CX03'].name")=='Override Mitra')
    ev(pg, "BS.clearImported()")
    chk('removing the import restores the original pack card', ev(pg, "BS.CARDS['BS74-CX03'].name.includes('Mitra')&&BS.CARDS['BS74-CX03'].revive===true"))
    ctx.close()
    # ---------- B. prebuilt decks ----------
    pg, errs, ctx = page(b)
    info = ev(pg, "BS.PREBUILT.filter(d=>!d.format).map(d=>({id:d.id,n:Object.values(d.cards).reduce((a,b)=>a+b,0),e:BS.validateDeck(d.cards,'eternal').ok,s:BS.validateDeck(d.cards,'standard').ok,miss:Object.keys(d.cards).filter(i=>!BS.CARDS[i])}))")
    for d in info:
        chk(f'prebuilt {d["id"]}: 40 cards, all cards exist, legal in Eternal', d['n'] == 40 and not d['miss'] and d['e'], d)
    chk('prebuilt train is legal in Standard, Mitra/red are not (no letter block)', info[0]['s'] and not info[1]['s'] and not info[2]['s'])
    ctx.close()
    # ---------- C. slots ----------
    pg, errs, ctx = page(b)
    chk('slots: 8 slots, slot 1 holds the default deck (40 cards)', ev(pg, "BS.SLOTS().length")==8 and ev(pg, "Object.values(BS.SLOTS()[0].cards).reduce((a,b)=>a+b,0)")==40)
    ev(pg, "BS.switchSlot(2)"); 
    chk('switching to an empty slot gives an empty deck', ev(pg, "Object.keys(BS.PLAYER_DECK).length")==0 and ev(pg, "BS.ACTIVE_SLOT")==2)
    ev(pg, "BS.loadPrebuilt('mitra')")
    chk('loading a ready-made deck fills the slot and renames the default name', ev(pg, "Object.values(BS.PLAYER_DECK).reduce((a,b)=>a+b,0)")==40 and 'White' in ev(pg, "BS.SLOTS()[2].name"))
    ev(pg, "BS.switchSlot(0)")
    chk('slot 1 is unchanged after editing slot 3', ev(pg, "Object.values(BS.PLAYER_DECK).reduce((a,b)=>a+b,0)")==40 and ev(pg, "Object.keys(BS.PLAYER_DECK).some(k=>k.startsWith('26RSD02-'))"))     # v0.97.0: the default deck is the Standard starter 26RSD02
    pg.reload(); ready(pg)
    chk('slots persist across reload (slot 3 still the Mitra deck, active slot 1)', ev(pg, "BS.ACTIVE_SLOT")==0 and ev(pg, "(BS.switchSlot(2),!!BS.PLAYER_DECK['BS74-CX03'])"))
    chk('invalid switchSlot is refused', ev(pg, "BS.switchSlot(99)")==False and ev(pg, "BS.switchSlot(-1)")==False and ev(pg, "BS.switchSlot('x')")==False)
    ctx.close()
    pg, errs, ctx = page(b, init="localStorage.getItem('bse.slots.v1')||localStorage.setItem('bse.deck.v3',JSON.stringify({'TRAIN-01':3,'TRAIN-02':3}))")
    chk('migration: an old single saved deck becomes slot 1', ev(pg, "Object.keys(BS.SLOTS()[0].cards).sort().join()")=='TRAIN-01,TRAIN-02' and ev(pg, "BS.PLAYER_DECK['TRAIN-01']")==3)
    ctx.close()
    # ---------- D. UI: deck builder ----------
    for (w, h, lab) in [(1280, 800, 'PC'), (390, 844, 'phone')]:
        pg, errs, ctx = page(b, w, h)
        pg.locator('[data-a=go-deck]:visible').first.click(); settle(pg)
        if lab == 'phone': pg.click('#db-deckbar'); settle(pg)   # v0.129.0: the phone deck sheet opens from the bottom bar
        pg.click('#db-menu-btn'); settle(pg)   # the slot / ready-made tools sit in the Deck options menu
        chk(f'{lab} builder: slot select has 8 options and the name field shows the slot name', pg.locator('#db-slot option').count()==8 and pg.input_value('#db-name')=='Deck 1')
        pg.select_option('#db-slot', '3'); settle(pg)
        chk(f'{lab} builder: choosing slot 4 shows an empty deck', 'Add 40 more' in pg.text_content('#db-status') and ev(pg, "BS.ACTIVE_SLOT")==3)
        pg.fill('#db-name', 'My Red Test'); pg.press('#db-name', 'Enter'); pg.locator('#db-name').blur(); settle(pg)
        chk(f'{lab} builder: renaming the slot works and appears in the list', ev(pg, "BS.SLOTS()[3].name")=='My Red Test' and 'My Red Test' in pg.locator('#db-slot option:checked').inner_text())
        pg.select_option('#db-preset', 'std01'); settle(pg)
        chk(f'{lab} builder: loading a ready-made deck into an empty slot needs no confirmation', ev(pg, "Object.values(BS.PLAYER_DECK).reduce((a,b)=>a+b,0)")==40, ev(pg, "Object.values(BS.PLAYER_DECK).reduce((a,b)=>a+b,0)"))
        pg.select_option('#db-preset', 'rbs01-1'); settle(pg)
        chk(f'{lab} builder: loading over a filled slot asks first', pg.evaluate("document.getElementById('action-modal').classList.contains('active')"))
        pg.locator('#modal-actions .modal-btn', has_text='Cancel').click(); settle(pg)
        chk(f'{lab} builder: Cancel keeps the starter deck', ev(pg, "!!BS.PLAYER_DECK['26RSD01-001']&&!BS.PLAYER_DECK['26RBS01-002']"))
        pg.select_option('#db-preset', 'rbs01-1'); settle(pg); pg.locator('#modal-actions .modal-btn', has_text='Replace').click(); settle(pg)
        chk(f'{lab} builder: Replace swaps in the official ready deck', ev(pg, "!!BS.PLAYER_DECK['26RBS01-002']&&!BS.PLAYER_DECK['26RSD01-002']"))   # 26RSD01-001 is in both lists (the recipe plays the red starter), 26RSD01-002 only in std01
        chk(f'{lab} builder: the official ready deck is legal in Standard (status text)', 'legal' in pg.text_content('#db-status') and 'Needs' not in pg.text_content('#db-status'), pg.text_content('#db-status'))
        ov = ev(pg, "document.documentElement.scrollWidth<=window.innerWidth+1")
        inview = ev(pg, "[...document.querySelectorAll('#view-deckbuilder .db-tools > *')].every(e=>{const r=e.getBoundingClientRect();return r.right<=window.innerWidth+1&&r.left>=-1})")
        chk(f'{lab} builder: toolbar fits the screen (no horizontal overflow)', ov and inview, [ov, inview])
        pg.screenshot(path=f'/tmp/claude-0/t4/v17_builder_{lab}.png')
        ovl = ev(pg, "(()=>{const c=[...document.querySelectorAll('#db-card-list .tcg-card')];for(let i=0;i<c.length-1;i++){const a=c[i].getBoundingClientRect(),b=c[i+1].getBoundingClientRect();if(a.top<b.top-1&&a.bottom>b.top+2&&Math.abs(a.left-b.left)<a.width)return i}return -1})()")
        chk(f'{lab} builder: card tiles do not overlap (91 cards)', ovl == -1, ovl)
        chk(f'{lab} builder: no page errors', not errs, errs); ctx.close()
    # ---------- E. UI: PLAY page + settings ----------
    for (w, h, lab) in [(1280, 800, 'PC'), (390, 844, 'phone')]:
        pg, errs, ctx = page(b, w, h)
        pg.locator('[data-a=go-play]:visible').first.click(); settle(pg)
        chk(f'{lab} PLAY: CPU select, format buttons and start button visible (v0.136.0 Play page)', all(pg.locator(s).is_visible() for s in ['#play-cpu', '#pl-fmt', '#view-play [data-a=start]']))
        chk(f'{lab} PLAY: CPU list has every ready-made deck + random + mirror', pg.locator('#play-cpu option').count()==ev(pg, 'BS.PREBUILT.filter(d=>!d.hidden).length')+2)
        pg.select_option('#play-cpu', 'rbs01-1'); settle(pg)
        chk(f'{lab} PLAY: the CPU deck choice is saved', ev(pg, "BS.SETTINGS.cpuDeck")=='rbs01-1' and 'rbs01-1' in ev(pg, "localStorage.getItem('bse.settings.v1')"))
        pg.reload(); ready(pg); pg.locator('[data-a=go-play]:visible').first.click()
        chk(f'{lab} PLAY: the choice survives a reload', pg.input_value('#play-cpu')=='rbs01-1')
        pg.click('#pl-fmt [data-v=standard]'); settle(pg)
        chk(f'{lab} PLAY: in Standard an incomplete official deck says it will be replaced', 'not legal in STANDARD' in pg.locator('#play-cpu option[value=rbs02-6]').inner_text())
        pg.click('#pl-fmt [data-v=eternal]')
        ov = ev(pg, "document.documentElement.scrollWidth<=window.innerWidth+1")
        chk(f'{lab} PLAY: fits the screen', ov and pg.locator('#view-play [data-a=start]').is_visible(), ov)
        pg.screenshot(path=f'/tmp/claude-0/t4/v17_play_{lab}.png')
        pg.locator('[data-a=go-settings]:visible').first.click(); settle(pg); pg.click('#set-menu [data-v=game]')
        chk(f'{lab} Settings: opens with speed Normal and sound Off', pg.input_value('#set-speed')=='normal' and pg.input_value('#set-sound')=='off')
        pg.select_option('#set-speed', 'fast'); pg.click('#set-menu [data-v=sound]'); pg.select_option('#set-sound', 'on'); settle(pg)
        chk(f'{lab} Settings: choices saved', ev(pg, "BS.SETTINGS.speed")=='fast' and ev(pg, "BS.SETTINGS.sound")==True)
        pg.screenshot(path=f'/tmp/claude-0/t4/v17_settings_{lab}.png')
        pg.reload(); ready(pg); pg.locator('[data-a=go-settings]:visible').first.click(); pg.click('#set-menu [data-v=game]')
        chk(f'{lab} Settings: persisted after reload', pg.input_value('#set-speed')=='fast' and ev(pg, 'BS.SETTINGS.sound')==True)
        pg.click('#set-menu [data-v=data]'); pg.click('[data-a=set-reset]'); pg.click('#set-menu [data-v=game]')
        chk(f'{lab} Settings: reset', pg.input_value('#set-speed')=='normal' and ev(pg, 'BS.SETTINGS.sound')!=True)
        chk(f'{lab} no page errors', not errs, errs); ctx.close()
    # ---------- F. speed + sound behaviour ----------
    pg, errs, ctx = page(b)
    t = {}
    for sp in ['normal', 'fast', 'instant']:
        ev(pg, f"BS.SETTINGS.speed='{sp}'")
        t[sp] = pg.evaluate("(async()=>{const t=performance.now();await wait(300);return performance.now()-t})()")
    chk('speed: Normal ~300ms, Fast ~135ms, Instant ~25ms', 250 < t['normal'] < 450 and 100 < t['fast'] < 230 and t['instant'] < 90, t)
    ev(pg, "BS.SETTINGS.sound=true")
    ok = pg.evaluate("(()=>{try{for(const k of ['attack','hit','destroy','summon','card','win','lose','bogus'])sfx(k);return true}catch(e){return String(e)}})()")
    chk('sound: every effect type is safe to call', ok is True, ok)
    chk('sound: no page errors', not errs, errs); ctx.close()
    # ---------- G. matches with chosen decks (20 runs) ----------
    combos = [(f, c) for f in ['eternal', 'standard'] for c in ['train', 'mitra', 'red', 'random', 'mine']] * 2
    for i, (fmt, cpu) in enumerate(combos):
        pg, errs, ctx = page(b)
        ev(pg, f"BS.setFormat('{fmt}');BS.SETTINGS.cpuDeck='{cpu}';BS.switchSlot(0)")
        ev(pg, "BS.loadPrebuilt('mitra')" if (fmt == 'eternal' and i % 2 == 1) else "BS.loadPrebuilt('train')")
        pg.evaluate("(()=>{BS.startNewGame();return 1})()"); settle(pg)
        mine = ev(pg, "Object.keys(BS.PLAYER_DECK)"); 
        got = ev(pg, "(()=>{const g=BS.G;const ids=p=>new Set(p.deck.concat(p.hand,p.spirits,p.nexus,p.soulState,p.trash).map(x=>x.id));return {p:[...ids(g.p.player)],o:[...ids(g.p.opponent)],pn:g.p.player.deckSize,on:g.p.opponent.deckSize}})()")
        legal_cpu = {'train': True, 'mitra': fmt == 'eternal', 'red': fmt == 'eternal', 'random': True, 'mine': True}[cpu]
        if fmt == 'standard':   # slot 1 is the legal training deck in Standard
            exp_o = {'train': 'TRAIN-01', 'mitra': '26R', 'red': '26R', 'random': '26R', 'mine': 'TRAIN-01'}[cpu]     # v0.201.0: an illegal choice or random gives a complete listed Standard deck (starter or official ready deck)
        else:
            exp_o = {'train': 'TRAIN-01', 'mitra': 'BS74-CX03', 'red': 'BS75-011', 'random': None, 'mine': ('BS74-CX03' if i % 2 == 1 else 'TRAIN-01')}[cpu]
        okp = set(got['p']) <= set(mine) and got['pn'] >= 40
        oko = got['on'] >= 40 and (exp_o is None or (any(x.startswith('26R') for x in got['o']) if exp_o == '26R' else exp_o in got['o']))
        chk(f'match #{i+1} {fmt}/CPU deck {cpu}: both decks built from the chosen lists (40 cards each)', okp and oko and not errs, [got, mine[:3], errs])
        ctx.close()
    # ---------- H. illegal own deck ----------
    pg, errs, ctx = page(b)
    ev(pg, "BS.switchSlot(5)"); pg.locator('[data-a=go-play]:visible').first.click(); pg.click('#view-play [data-a=start]'); settle(pg)
    chk('an empty/illegal deck cannot start a match: a notice appears and the builder opens', pg.evaluate("document.getElementById('action-modal').classList.contains('active')") and ev(pg, "!BS.G"), errs)
    ctx.close()
    b.close()
print('TOTAL %d/%d' % (sum(res), len(res)))
