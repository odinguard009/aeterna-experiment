# v0.28: "By doing X, do Y" (Eternal Rule Manual FAQ Q5) and the trigger loop (turn player orders simultaneous effects of both players;
# an effect caused by a resolving effect resolves right after it, before older pending effects). Every chk() is one numbered test.
# Run: python3 tests/make_fixtures.py && python3 tests/suites/by_doing_trigger_loop_tests.py      (no fixtures needed; ZT-* cards exist only inside this test page)
import os as _os_repo
_REPO = _os_repo.path.abspath(_os_repo.path.join(_os_repo.path.dirname(_os_repo.path.abspath(__file__)), '..', '..'))
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, sys, time
OUT = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
res = []; ALLERR = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def ev(pg, js, *a): return pg.evaluate(js, *a) if a else pg.evaluate(js)
def is_open(pg): return ev(pg, "document.getElementById('action-modal').classList.contains('active')")
def title(pg): return pg.inner_text("#modal-card-title") if is_open(pg) else ''
def btns(pg): return pg.locator("#modal-actions .modal-btn").all_inner_texts() if is_open(pg) else []
def press(pg, t): pg.locator("#modal-actions .modal-btn", has_text=t).first.click(); settle(pg)
def wait_modal(pg, ms=2500):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        if is_open(pg): return True
        settle(pg)
    return False
def run(pg, js, ms=1200): ev(pg, "(()=>{window.pr=(async()=>{" + js + "})().catch(e=>console.error('RUNERR '+e.message));return 1})()"); settle(pg)
# test-only cards: their effects log in a recognisable order
ZT = r"""(()=>{const fx=a=>{const r=BS.parseEffects(a);if(r.error)throw new Error(r.error);return r.effects};
const L=[[1,2000],[2,3000]].map(([c,b])=>({cores:c,bp:b}));
const d=(id,name,effects,o)=>BS.defBuiltin(Object.assign({id,name,type:'Spirit',symbol:'red',cost:0,reduction:{},levels:L,families:['ZT'],effects:fx(effects)},o||{}));
d('ZT-1','ZT One',[{trigger:'SUMMONED',actions:[{do:'SUMMON_HAND',match:{name:['ZT Two']}},{do:'COUNTER',n:1}]}]);
d('ZT-2','ZT Two',[{trigger:'SUMMONED',actions:[{do:'DRAW',n:1}]}]);
d('ZT-3','ZT Watcher',[{trigger:'ALLY_SUMMONED',match:{name:['ZT One']},actions:[{do:'VOID_TO_RESERVE',n:1}]}]);
d('ZT-4','ZT Striker',[{trigger:'ATTACKS',actions:[{do:'DRAW',n:1}]},{trigger:'ALLY_LIFE_HIT',match:{name:['ZT']},actions:[{do:'COUNTER',n:1}]}]);
d('ZT-5','ZT Cheer',[{trigger:'ALLY_ATTACKS',match:{name:['ZT Striker']},actions:[{do:'COUNTER',n:1}]}]);
d('ZT-6','ZT Mirage',[{trigger:'MIRAGE_OWN_LIFE',actions:[{do:'DRAW',n:1}]}]);
d('ZT-7','ZT Activator',[{trigger:'ACTIVATE',timing:['MAIN'],actions:[{do:'SUMMON_HAND',match:{name:['ZT Two']}},{do:'COUNTER',n:1}]}]);
return 1})()"""
def page(b, extra=''):
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; ALLERR.append(errs)
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.on("console", lambda m: errs.append('CONSOLE:' + m.text[:200]) if m.type == 'error' else None)
    pg.goto(OUT); ready(pg); ev(pg, ZT); return pg
def scen(pg, spec): r = ev(pg, "(s)=>BS.loadScenario(s)", spec); assert r.get('ok'), r; return r
H = "BS.G.history"
def idx(pg, needle): return ev(pg, f"BS.G.history.findIndex(t=>t.includes({json.dumps(needle)}))")
inv = "(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"
AD = {"family": ["Awakened Dragon"]}; MI = {"name": ["Contractor Mitra"]}
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- A. parsing
    pg = page(b)
    chk('1 BY parses with a cost and 1-4 follow-up actions', ev(pg, "!BS.parseActionList([{do:'BY',cost:{do:'SOUL_RETURN',match:{family:['Awakened Dragon']}},then:[{do:'CORE_TO_NEXUS',n:1,match:{name:['Contractor Mitra']}}]}]).error"))
    chk('2 BY rejects nesting, an empty "then" and an invalid cost', ev(pg, "!!BS.parseActionList([{do:'BY',cost:{do:'BY',cost:{do:'DRAW',n:1},then:[{do:'DRAW',n:1}]},then:[{do:'DRAW',n:1}]}]).error&&!!BS.parseActionList([{do:'BY',cost:{do:'DRAW',n:1},then:[]}]).error&&!!BS.parseActionList([{do:'BY',cost:{do:'DRAW',n:0},then:[{do:'DRAW',n:1}]}]).error"))
    chk('3 the four "By ..." cards use BY now', ev(pg, "['BS74-043','BS75-030','BS75-013','BS75-X08'].every(i=>JSON.stringify(BS.CARDS[i].effects).includes('\"do\":\"BY\"'))"))
    # ---- B. "By doing X, do Y" on real cards (FAQ Q5: X needs Y to be possible)
    def paanch(nexus=True, reserve=5):
        pg = page(b); scen(pg, {"players": {"player": {"reserve": reserve, "soulState": [{"id": "BS74-047", "as": "ad"}], "nexus": [{"id": "BS74-CX03", "cores": 0, "as": "mitra"}] if nexus else [], "spirits": [{"id": "BS74-043", "cores": 1, "as": "paanch"}]}, "opponent": {}}})
        run(pg, "await BS.fireFx(BS.G.p.player,'ATTACKS',SC.paanch,{attacker:SC.paanch});"); return pg
    pg = paanch()
    chk('4 Paanch: Soul State card returns to the Hand and Mitra gets +1 core', ev(pg, "BS.G.p.player.hand.includes(SC.ad)&&SC.mitra.cores===1&&" + inv + "==='ok'"), ev(pg, "[BS.G.p.player.hand.length,SC.mitra.cores]"))
    pg = paanch(nexus=False)
    chk('5 Paanch without a Mitra: the card stays in Soul State (X is not done when Y is impossible)', ev(pg, "BS.G.p.player.soulState.includes(SC.ad)&&BS.G.p.player.hand.length===0"))
    pg = paanch(reserve=0)
    chk('6 Paanch with no Reserve core for Mitra: the card stays in Soul State', ev(pg, "BS.G.p.player.soulState.includes(SC.ad)&&SC.mitra.cores===0"))
    def pach(soul=True):
        pg = page(b); scen(pg, {"players": {"player": {"reserve": 8, "soulState": [{"id": "BS74-043", "as": "ad"}] if soul else [], "nexus": [{"id": "BS74-CX03", "cores": 0, "as": "mitra"}], "spirits": [{"id": "BS75-030", "cores": 1, "as": "pach"}]}, "opponent": {}}})
        run(pg, "await BS.fireFx(BS.G.p.player,'SUMMONED',SC.pach);", 1800); return pg
    pg = pach(False)
    chk('7 Pachhattar with no Awakened Dragon in Soul State: no core is put on Mitra', ev(pg, "SC.mitra.cores") == ev(pg, "BS.G.history.filter(t=>t.includes('[When an ally is summoned]')).length"), ev(pg, "[SC.mitra.cores," + H + ".slice(-5)]"))
    pg = pach(True)
    chk('8 Pachhattar with one: Mitra +1 and the card leaves Soul State', ev(pg, "!BS.G.p.player.soulState.includes(SC.ad)&&BS.G.history.some(t=>t.startsWith('The RevelationDragon Pachhattar: The CovenantContractor Mitra gets +1'))"), ev(pg, H + ".slice(-6)"))
    def sph(opp_spirits):
        pg = page(b); scen(pg, {"turn": 4, "active": "opponent", "step": 5, "players": {"player": {"reserve": 5, "count": 5, "hand": [{"id": "BS75-013", "as": "sph"}], "nexus": [{"id": "BS74-CX01", "cores": 2, "as": "om"}]}, "opponent": {"reserve": 3, "spirits": opp_spirits}}})
        run(pg, "await BS.doManifest(BS.G.p.player,SC.sph,SC.om,'flash');", 2200); return pg
    pg = sph([{"id": "BS75-013", "cores": 4, "as": "huge"}])
    chk('9 Sphinott-Hauser: a 14000 BP Spirit fits the 20000 BP total, is destroyed and banished', ev(pg, "!BS.G.p.opponent.spirits.includes(SC.huge)&&BS.G.p.opponent.removed.includes(SC.huge)"), ev(pg, "BS.G.history.slice(-6)"))
    pg = sph([])
    chk('10 Sphinott-Hauser with nothing destroyed: the Soul Core stays in the Trash (no banish target)', ev(pg, "BS.G.p.player.trashCores.soul&&!SC.om.soul&&" + inv + "==='ok'"), ev(pg, "[BS.G.p.player.trashCores.soul,SC.om.soul]"))
    pg = sph([{"id": "BS75-012", "cores": 2, "as": "v"}])
    chk('11 ... with a destroyed target: Soul Core to Ometeotl and the target is banished', ev(pg, "SC.om.soul&&BS.G.p.opponent.removed.includes(SC.v)"), ev(pg, "[SC.om.soul,BS.G.p.opponent.removed.length]"))
    def haz(soul):
        pg = page(b); scen(pg, {"players": {"player": {"reserve": 6, "soulState": [{"id": "BS74-043", "as": "ad"}] if soul else [], "nexus": [{"id": "BS74-CX03", "cores": 0, "as": "mitra"}], "spirits": [{"id": "BS75-X08", "cores": 3, "exhausted": True, "as": "hz"}]}, "opponent": {}}})
        lv = ev(pg, "BS.lvIndex(SC.hz)+1"); run(pg, "await BS.fireFx(BS.G.p.player,'ATTACKS',SC.hz,{attacker:SC.hz});"); return pg, lv
    pg, lv = haz(False)
    chk('12 Hazaar LV2 with no card in Soul State: Mitra +1 still happens, no refresh', lv >= 2 and ev(pg, "SC.mitra.cores===1&&SC.hz.exhausted"), [lv, ev(pg, "[SC.mitra.cores,SC.hz.exhausted]")])
    pg, lv = haz(True)
    chk('13 ... with one: it returns to the Hand and Hazaar refreshes', ev(pg, "BS.G.p.player.hand.includes(SC.ad)&&!SC.hz.exhausted"))
    pg = page(b); scen(pg, {"turn": 4, "active": "opponent", "step": 5, "players": {"player": {"cpu": False, "reserve": 5, "count": 5, "hand": [{"id": "BS75-013", "as": "sph"}], "nexus": [{"id": "BS74-CX01", "cores": 2, "as": "om"}]}, "opponent": {"reserve": 3, "spirits": [{"id": "BS75-012", "cores": 2, "as": "v"}]}}})
    run(pg, "await BS.doManifest(BS.G.p.player,SC.sph,SC.om,'flash');", 900)
    for _ in range(4):
        if not wait_modal(pg, 1500): break
        if 'Do It' in ' '.join(btns(pg)): break
        bt = [x for x in btns(pg) if 'Skip' not in x and 'View Field' not in x]
        press(pg, bt[0] if bt else 'Done'); settle(pg)
    chk('14 human: the optional "By sending your Soul Core ..., banish" asks "Do it / Skip"', 'Do It' in ' '.join(btns(pg)), [title(pg), btns(pg)])
    press(pg, 'Skip'); settle(pg)
    chk('15 ... Skip: nothing is paid and nothing banished', ev(pg, "BS.G.p.player.trashCores.soul&&BS.G.p.opponent.removed.length===0&&" + inv + "==='ok'"))
    # ---- C. trigger loop
    pg = page(b); scen(pg, {"players": {"player": {"reserve": 6, "void": 3, "deck": ["BS75-001", "BS75-002"], "hand": [{"id": "ZT-2", "as": "t2"}], "spirits": [{"id": "ZT-1", "cores": 1, "as": "t1"}, {"id": "ZT-3", "cores": 1, "as": "t3"}]}, "opponent": {}}})
    run(pg, "await BS.fireFx(BS.G.p.player,'SUMMONED',SC.t1);", 2000)
    i1, i2, i3 = idx(pg, 'ZT One: counter'), idx(pg, 'ZT Two: [When Summoned]'), idx(pg, 'ZT Watcher: [When an ally')
    chk('16 a derived effect waits until the effect that caused it has finished (ZT One counter before ZT Two draw)', 0 <= i1 < i2, [i1, i2, ev(pg, H + ".slice(-8)")])
    chk('17 ... and then resolves before the older pending effect (ZT Two before ZT Watcher)', 0 <= i2 < i3, [i2, i3])
    chk('18 no effect is left queued; the resolving depth is back to 0', ev(pg, "!(BS.G.resolving>0)&&!(BS.G.derivedQ&&BS.G.derivedQ.length)&&" + inv + "==='ok'"))
    pg = page(b); scen(pg, {"players": {"player": {"reserve": 6, "deck": ["BS75-001"], "hand": [{"id": "ZT-2", "as": "t2"}], "spirits": [{"id": "ZT-7", "cores": 1, "as": "t7"}]}, "opponent": {}}})
    run(pg, "await BS.activateFx(BS.G.p.player,SC.t7,0);", 1500)
    chk('19 an Activate effect: what it causes resolves after it (counter before ZT Two draw)', 0 <= idx(pg, 'ZT Activator: counter') < idx(pg, 'ZT Two: [When Summoned]'), ev(pg, H + ".slice(-6)"))
    pg = page(b); scen(pg, {"players": {"player": {"cpu": False, "reserve": 4, "deck": ["BS75-001", "BS75-002"], "spirits": [{"id": "ZT-4", "cores": 1, "as": "st"}, {"id": "ZT-5", "cores": 1, "as": "ch"}]}, "opponent": {}}})
    run(pg, "await BS.fireFxMulti([{owner:BS.G.p.player,trigger:'ATTACKS',src:SC.st,ctx:{attacker:SC.st}},{owner:BS.G.p.player,trigger:'ALLY_ATTACKS',src:SC.st,ctx:{attacker:SC.st}}]);", 600)
    chk('20 When Attacks and an ally "when attacks" trigger together: the human orders them', 'Order' in title(pg) and len([x for x in btns(pg) if 'ZT' in x]) == 2, [title(pg), btns(pg)])
    press(pg, 'ZT Cheer'); settle(pg)
    chk('21 ... the chosen one resolves first', 0 <= idx(pg, 'ZT Cheer: [') < idx(pg, 'ZT Striker: ['), ev(pg, H + ".slice(-5)"))
    def lifepool(human_turn):
        pg = page(b)
        scen(pg, {"turn": 4, "active": "player" if human_turn else "opponent", "step": 5,
                  "players": {"player": {"cpu": not human_turn, "reserve": 4, "deck": ["BS75-001", "BS75-002"], "spirits": [{"id": "ZT-4", "cores": 1, "as": "st"}]},
                              "opponent": {"cpu": True, "reserve": 4, "deck": ["BS75-001", "BS75-002"]}}})
        ev(pg, "(()=>{const O=BS.G.p.opponent;const m=BS.mkInst('ZT-6');m.mirage=true;O.mirage=m;O.deckSize++;return 1})()")
        run(pg, "const A=BS.G.p.player,D=BS.G.p.opponent;await BS.fireFxMulti([{owner:A,trigger:'ALLY_LIFE_HIT',src:null,ctx:{attacker:SC.st}},{owner:A,trigger:'MIRAGE_OPP_LIFE',src:null,ctx:{}},{owner:D,trigger:'MIRAGE_OWN_LIFE',src:null,ctx:{}}]);", 700)
        return pg
    pg = lifepool(True)
    chk('22 Life reduced: the human turn player orders his and the CPU\'s effects in one prompt', 'Order' in title(pg) and any(x.startswith('CPU') and 'ZT Mirage' in x for x in btns(pg)) and any('ZT Striker' in x and not x.startswith('CPU') for x in btns(pg)), btns(pg))
    press(pg, 'ZT Mirage'); settle(pg)
    chk('23 ... the CPU Mirage resolved first because the turn player chose it', 0 <= idx(pg, 'ZT Mirage: [') < idx(pg, 'ZT Striker: ['), ev(pg, H + ".slice(-5)"))
    pg = b.new_page(); errs = []; ALLERR.append(errs); pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.goto(OUT); ready(pg); ev(pg, ZT)
    scen(pg, {"turn": 4, "active": "opponent", "step": 5, "players": {"player": {"cpu": False, "reserve": 4, "deck": ["BS75-001", "BS75-002"]}, "opponent": {"reserve": 4, "deck": ["BS75-001", "BS75-002"], "spirits": [{"id": "ZT-4", "cores": 1, "as": "st"}]}}})
    ev(pg, "(()=>{const P=BS.G.p.player;const m=BS.mkInst('ZT-6');m.mirage=true;P.mirage=m;P.deckSize++;return 1})()")
    run(pg, "const A=BS.G.p.opponent,D=BS.G.p.player;await BS.fireFxMulti([{owner:A,trigger:'ALLY_LIFE_HIT',src:null,ctx:{attacker:SC.st}},{owner:D,trigger:'MIRAGE_OWN_LIFE',src:null,ctx:{}}]);", 1200)
    chk('24 CPU turn: no order prompt for the human; the CPU (turn player) resolves its own effect first', not ('Order' in title(pg)) and 0 <= idx(pg, 'ZT Striker: [') < idx(pg, 'ZT Mirage: ['), [title(pg), ev(pg, H + ".slice(-5)")])
    pg = page(b); scen(pg, {"turn": 4, "active": "player", "step": 5, "players": {"player": {"cpu": False, "reserve": 5, "void": 2, "count": 5, "hand": [{"id": "BS75-013", "as": "sph"}], "nexus": [{"id": "BS74-CX01", "cores": 2, "as": "om"}], "spirits": [{"id": "ZT-3", "cores": 1}]}, "opponent": {"reserve": 3, "spirits": [{"id": "BS75-012", "cores": 2}]}}})
    ev(pg, "BS.CARDS['ZT-3'].effects[0].match={name:['Sphinott']};1")
    run(pg, "await BS.doManifest(BS.G.p.player,SC.sph,SC.om,'flash');", 900)
    chk('25 your Attack Step: When Manifests and "when an ally is summoned" trigger together and you order them', 'Order' in title(pg) and any('When Manifests' in x for x in btns(pg)) and any('ZT Watcher' in x for x in btns(pg)), [title(pg), btns(pg)])
    chk('26 glossary: "by doing X" is wired and cites FAQ Q5', (lambda g: g['status'] == 'wired' and 'Q5' in g['rule'])(next(x for x in json.load(open(_os_repo.path.join(_REPO, 'data/glossary/effects.json'))) if x['id'] == 'M_BY_DOING')))
    chk('27 no page errors or console errors in this suite', not any(ALLERR), [e for e in ALLERR if e])
    print(f'TOTAL {sum(res)}/{len(res)}')
