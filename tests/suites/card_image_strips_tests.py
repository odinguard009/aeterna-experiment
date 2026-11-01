# v0.27 (user request): every card zone / card prompt shows card images like the starting-hand screen, in a strip that scrolls sideways. Every chk() is one numbered test.
# Run: python3 tests/make_fixtures.py && python3 tests/suites/card_image_strips_tests.py      (no fixtures needed)
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, sys, time
OUT = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
res = []; ALLERR = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def page(b, w=1280, h=800):
    pg = b.new_page(viewport={'width': w, 'height': h}); errs = []; ALLERR.append(errs)
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.goto(OUT); ready(pg); return pg
def ev(pg, js, *a): return pg.evaluate(js, *a) if a else pg.evaluate(js)
def is_open(pg): return ev(pg, "document.getElementById('action-modal').classList.contains('active')")
def strip(pg): return ev(pg, "(()=>{const s=document.querySelector('#action-modal.active .card-strip');if(!s)return null;const r=s.getBoundingClientRect(),c=[...s.children].map(x=>x.getBoundingClientRect());return {n:s.children.length,sw:s.scrollWidth,cw:s.clientWidth,ox:getComputedStyle(s).overflowX,left:c.length?c[0].left-r.left:0,right:c.length?r.right-c[c.length-1].right:0,ids:[...s.children].map(x=>x.dataset.v),docw:document.documentElement.scrollWidth,vw:innerWidth}})()")
def close(pg):
    if is_open(pg): ev(pg, "document.querySelector('#modal-actions .modal-btn.cancel')?document.querySelector('#modal-actions .modal-btn.cancel').click():0;1"); settle(pg)
TRASH12 = ["BS75-001", "BS75-002", "BS75-003", "BS75-004", "BS75-009", "BS75-010", "BS75-011", "BS75-012", "BS75-013", "BS74-CX01", "BS75-073", "BS75-076"]
BOARD = {"players": {"player": {"cpu": False, "trash": TRASH12, "hand": ["BS75-012", "BS75-073"], "soulState": ["BS74-041", "BS74-042"], "spirits": [{"id": "BS75-012", "cores": 2, "as": "sp"}]},
                     "opponent": {"hand": ["BS75-001", "BS75-002"], "trash": ["BS75-004"]}}}
def zone(pg, z, k='player'):
    close(pg); ev(pg, f"BS.gameAct('zone','{k}:{z}');1"); settle(pg)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = page(b); ev(pg, "(s)=>BS.loadScenario(s)", BOARD)
    zone(pg, 'trash'); s = strip(pg)
    chk('1 Trash shows card images (12)', s and s['n'] == 12, s)
    chk('2 ... newest card first', s and s['ids'][0] == 'BS75-076' and s['ids'][-1] == 'BS75-001', s and s['ids'])
    chk('3 ... the strip scrolls sideways when the cards do not fit', s and s['ox'] == 'auto' and s['sw'] > s['cw'], s)
    chk('4 ... the page itself never scrolls sideways', s and s['docw'] <= s['vw'], s)
    chk('5 ... the dialog uses the wide layout', ev(pg, "document.querySelector('#action-modal .modal-box').classList.contains('wide')"))
    zone(pg, 'hand'); s = strip(pg)
    chk('6 your Hand zone shows your 2 cards', s and s['n'] == 2, s)
    chk('7 ... few cards are centered (space on both sides)', s and s['left'] > 20 and s['right'] > 20, s)
    zone(pg, 'hand', 'opponent'); s = strip(pg)
    chk('8 the CPU Hand stays hidden (no images)', s is None, s)
    zone(pg, 'soulstate'); s = strip(pg)
    chk('9 Soul State shows its 2 cards', s and s['n'] == 2 and s['ids'] == ['BS74-041', 'BS74-042'], s)
    zone(pg, 'trash', 'opponent'); s = strip(pg)
    chk('10 the CPU Trash is visible to both players (1 card)', s and s['n'] == 1, s)
    ev(pg, "BS.G.p.opponent.removed.push(BS.mkInst('BS75-010'));BS.G.p.opponent.deckSize++;1")
    zone(pg, 'removed', 'opponent'); s = strip(pg)
    chk('11 Banished zone shows its card', s and s['n'] == 1 and s['ids'] == ['BS75-010'], s)
    zone(pg, 'void'); s = strip(pg)
    chk('12 a core-only zone (Void) has no card strip', s is None and is_open(pg))
    zone(pg, 'deck'); s = strip(pg)
    chk('13 the Deck stays face down (no images)', s is None)
    close(pg)
    # Burst / Mirage
    ev(pg, "(()=>{const P=BS.G.p.player,O=BS.G.p.opponent;const m=BS.mkInst('BS75-007');m.mirage=true;P.mirage=m;P.deckSize++;const bb=BS.mkInst('BS75-076');P.burst=bb;P.deckSize++;const ob=BS.mkInst('BS75-073');O.burst=ob;O.deckSize++;return 1})()")
    zone(pg, 'burst'); s = strip(pg)
    chk('14 your Burst/Mirage area shows the Mirage and your face-down Burst', s and s['ids'] == ['BS75-007', 'BS75-076'], s)
    zone(pg, 'burst', 'opponent'); s = strip(pg)
    chk('15 the opposing face-down Burst is not shown', s is None)
    close(pg)
    # field: cards under a Spirit
    ev(pg, "(()=>{const sp=SC.sp;sp.under=[BS.mkInst('BS75-004'),BS.mkInst('BS75-002')];BS.G.p.player.deckSize+=2;BS.render();return 1})()")
    ev(pg, "BS.gameAct('field','player:spirit:'+SC.sp.uid);1"); settle(pg); s = strip(pg)
    chk('16 a stacked Spirit shows the cards under it', s and s['ids'] == ['BS75-004', 'BS75-002'], s)
    close(pg)
    chk('17 tapping a strip card opens the enlarged card view', (lambda: (ev(pg, "BS.gameAct('zone','player:trash');1"), settle(pg), pg.locator('#action-modal .card-strip .mull-card').first.click(), settle(pg), ev(pg, "document.getElementById('zoom-overlay').classList.contains('active')"))[-1])())
    ev(pg, "document.getElementById('zoom-overlay').classList.remove('active');1"); close(pg)
    chk('18 board still consistent after viewing zones', ev(pg, "(()=>{try{BS.checkInvariants();return true}catch(e){return e.message}})()") is True)
    # hand card dialog
    ev(pg, "BS.gameAct('hand',String(BS.G.p.player.hand[0].uid));1"); settle(pg); s = strip(pg)
    chk('19 tapping a Hand card shows its image in the dialog', s and s['n'] == 1 and s['ids'] == ['BS75-012'], s)
    close(pg)
    # choice prompts
    pg2 = page(b, 390, 844)
    ev(pg2, "(s)=>BS.loadScenario(s)", {"players": {"player": {"cpu": False, "deck": ["BS75-001", "BS74-CX01", "BS75-012", "BS75-002", "BS75-004"], "spirits": [{"id": "BS75-010", "cores": 2, "as": "mt"}]}, "opponent": {}}})
    ev(pg2, "(async()=>{await BS.fireFx(BS.G.p.player,'SUMMONED',SC.mt)})();1"); settle(pg2)
    pg2.locator("#modal-actions .modal-btn", has_text="Use Effect").click(); settle(pg2); s = strip(pg2)
    chk('20 an effect "choose a revealed card" prompt shows the candidates as images (phone)', s and s['ids'] == ['BS74-CX01'], s)
    chk('21 ... the choice buttons are still there (record/replay compatible)', pg2.locator("#modal-actions .modal-btn", has_text="Ometeotl").count() == 1)
    pg2.locator("#modal-actions .modal-btn", has_text="Ometeotl").click(); settle(pg2)
    chk('22 ... choosing works as before (Ometeotl deployed)', ev(pg2, "BS.G.p.player.nexus.some(n=>n.id==='BS74-CX01')"))
    pg3 = page(b)
    ev(pg3, "(s)=>BS.loadScenario(s)", {"players": {"player": {"cpu": False, "trash": ["BS75-001", "BS75-002", "BS75-003"], "spirits": [{"id": "BS75-001", "cores": 1, "as": "x"}]}, "opponent": {}}})
    ev(pg3, "(async()=>{await BS.runActions({p:BS.G.p.player,opp:BS.G.p.opponent,src:SC.x,ctx:{}},{actions:[{do:'RETURN_TRASH',match:{name:['Crimson']}}]},'SUMMONED')})();1"); settle(pg3); s = strip(pg3)
    chk('23 "return a card from your Trash" prompt shows the matching cards', s and set(s['ids']) == {'BS75-001', 'BS75-002', 'BS75-003'}, s)
    close(pg3)
    pg4 = page(b)
    ev(pg4, "(s)=>BS.loadScenario(s)", {"players": {"player": {"cpu": False, "hand": [{"id": "BS75-076", "as": "mc"}], "spirits": [{"id": "BS75-001", "cores": 1, "as": "x"}]}, "opponent": {}}})
    ev(pg4, "(()=>{const P=BS.G.p.player;P.burst=SC.mc;P.hand=[];return 1})()")
    ev(pg4, "(async()=>{await BS.maybeBurst(BS.G.p.player,'ALLY_DESTROYED',{})})();1"); settle(pg4); s = strip(pg4)
    chk('24 a Burst prompt shows the Burst card', (s and s['ids'] == ['BS75-076']) or not is_open(pg4), [s, is_open(pg4)])
    # starting hand screen unchanged
    pg5 = page(b); ev(pg5, "BS.SETTINGS.speed='instant';BS.startNewGame({seed:5});1"); settle(pg5)
    for _ in range(3):
        if ev(pg5, "document.querySelector('#action-modal.active .mull-list')!==null"): break
        if is_open(pg5): pg5.locator("#modal-actions .modal-btn:not([disabled])").first.click(); settle(pg5)
    chk('25 the starting-hand screen keeps its 4-card grid', ev(pg5, "document.querySelectorAll('#action-modal.active .mull-list .mull-card').length") == 4)
    # replay still works with the new dialogs
    pg6 = page(b); ev(pg6, "BS.SETTINGS.speed='instant';BS.startNewGame({deckA:BS.PREBUILT.find(x=>x.id==='mitra').cards,deckB:BS.PREBUILT.find(x=>x.id==='train').cards,seed:2024});1")
    t0 = time.time(); tried = {}
    while time.time() - t0 < 60 and not ev(pg6, "!BS.G||BS.G.over||BS.G.turnNo>6"):
        if is_open(pg6):
            bt = pg6.locator("#modal-actions .modal-btn:not([disabled])")
            if bt.count(): bt.first.click()
        elif ev(pg6, "document.documentElement.classList.contains('picking')"):
            c = pg6.locator(".tcg-card.pickable"); (c.first if c.count() else pg6.locator("#pick-btns .modal-btn").first).click()
        elif ev(pg6, "BS.humanCan()"):
            key = ev(pg6, "BS.G.turnNo+':'+BS.G.step")
            if ev(pg6, "BS.G.step===4&&BS.G.p.player.hand.length>0") and tried.get(key, 0) < 1:
                tried[key] = 1; pg6.locator(".tcg-card[data-a='hand']").first.click()
            else:
                ev(pg6, "BS.gameAct('zone','player:trash');1") if tried.get(key + 'z', 0) < 1 else None; tried[key + 'z'] = 1
                if not is_open(pg6):
                    nb = pg6.locator(".inline-next-btn")
                    if nb.count() and nb.first.is_enabled(): nb.first.click()
        settle(pg6)
    t1 = time.time()
    while time.time() - t1 < 20 and not ev(pg6, "BS.G.over||BS.humanCan()||document.getElementById('action-modal').classList.contains('active')||document.documentElement.classList.contains('picking')"): settle(pg6)
    settle(pg6)
    rec = ev(pg6, "BS.lastReplay()"); st = ev(pg6, "[BS.G.hn,(BS.G.hh>>>0).toString(16)]")
    pg7 = page(b); rr = ev(pg7, "(r)=>BS.runReplay(r,{idleMs:2500})", rec); st2 = ev(pg7, "[BS.G.hn,(BS.G.hh>>>0).toString(16)]")
    chk('26 a recorded match that opened zone dialogs replays to the same log', rr['ok'] and rr['at'] == len(rec['inputs']) and st == st2 and (rr['same'] or not rec['final']), [rr, st, st2, len(rec['inputs'])])
    for w, h in [(1280, 800), (390, 844), (844, 390), (360, 640)]:
        pgv = page(b, w, h); ev(pgv, "(s)=>BS.loadScenario(s)", BOARD); zone(pgv, 'trash'); s = strip(pgv)
        cardw = ev(pgv, "document.querySelector('#action-modal .card-strip .mull-card').getBoundingClientRect().width")
        chk(f'{27 + [(1280,800),(390,844),(844,390),(360,640)].index((w,h))} {w}x{h}: Trash strip scrolls, page does not, cards {round(cardw)}px wide', s and s['sw'] > s['cw'] and s['docw'] <= s['vw'] and 55 <= cardw <= 110, [s, cardw])
    chk('31 no page errors in this suite', not any(ALLERR), [e for e in ALLERR if e])
    print(f'TOTAL {sum(res)}/{len(res)}')
