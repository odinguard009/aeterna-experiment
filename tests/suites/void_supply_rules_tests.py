# v0.29: the Void is an unlimited core supply (CR 4-8-1/4-8-2), plus direct tests for the official setup, turn steps, battle and
# deck-out rules (docs/manual-notes.md). Every label starts with the obligation id from data/kb/rule-obligations.json.
# Run: python3 tests/make_fixtures.py && python3 tests/suites/void_supply_rules_tests.py      (no fixtures needed)
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, os, subprocess, sys, time
OUT = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
res = []; ALLERR = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def ev(pg, js, *a): return pg.evaluate(js, *a) if a else pg.evaluate(js)
def is_open(pg): return ev(pg, "document.getElementById('action-modal').classList.contains('active')")
def btns(pg): return pg.locator("#modal-actions .modal-btn").all_inner_texts() if is_open(pg) else []
def press(pg, t): pg.locator("#modal-actions .modal-btn", has_text=t).first.click(); settle(pg)
def wait_btn(pg, t, ms=4000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        if any(t in x for x in btns(pg)): return True
        settle(pg)
    return False
def run(pg, js, ms=1200): ev(pg, "(()=>{window.pr=(async()=>{" + js + "})().catch(e=>console.error('RUNERR '+e.message));return 1})()"); settle(pg)
def page(b):
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; ALLERR.append(errs)
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.on("console", lambda m: errs.append('CONSOLE:' + m.text[:200]) if m.type == 'error' else None)
    pg.goto(OUT); ready(pg); return pg
def scen(pg, spec):
    r = ev(pg, "(s)=>BS.loadScenario(s)", spec); assert r.get('ok'), r
    ev(pg, "window.P=BS.G.p.player;window.O=BS.G.p.opponent;0")
inv = "(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"
def cores(pg, k): return ev(pg, f"(()=>{{const p=BS.G.p.{k};return {{life:p.life,res:p.reserve.n,soul:p.reserve.soul,void:p.void,count:p.count,made:p.made,hand:p.hand.length,deck:p.deck.length,trash:p.trash.length}}}})()")
CONTRACT_DECK = {"BS74-CX03": 1, "TRAIN-01": 3, "TRAIN-02": 3, "TRAIN-03": 3, "TRAIN-04": 3, "TRAIN-05": 3, "TRAIN-06": 3}
def fill(d):   # pad a deck to 40 with the plain training cards (3 copies max per name is a deck-building rule; newGame does not check it)
    d = dict(d); d["TRAIN-01"] += 40 - sum(d.values()); return d
CONTRACT_DECK = fill(CONTRACT_DECK)
DECK = "Object.assign({},BS.PRESET_DECK)"
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- A. setup (Eternal manual pp. 11-12, 55)
    pg = page(b)
    s = ev(pg, f"(()=>{{const g=BS.newGame({DECK},{DECK});return ['player','opponent'].map(k=>{{const q=g.p[k];return [q.life,q.reserve.n,q.reserve.soul,q.void,q.count,q.made,q.trashCores.n]}})}})()")
    chk('1 [SETUP-LIFE-RESERVE] both players: 5 Life, 3 Reserve cores + Soul Core, empty Void and Count, 8 cores made', all(x == [5, 3, True, 0, 0, 8, 0] for x in s), s)
    s = ev(pg, f"(()=>{{const g=BS.newGame({DECK},{DECK});return [g.p.player.hand.length,g.p.player.deck.length,g.p.opponent.hand.length,g.p.opponent.deck.length]}})()")
    chk('2 [SETUP-HAND-4] a 40-card deck gives a 4-card Hand and 36 cards in the Deck', s == [4, 36, 4, 36], s)
    s = ev(pg, "(d)=>{const out=[];for(let i=0;i<8;i++){BS.seedRng(100+i);const q=BS.newGame(d,d).p.player;out.push([q.hand.length,q.deck.length,q.hand.filter(h=>h.id==='BS74-CX03').length,q.deck.filter(h=>h.id==='BS74-CX03').length])}return out}", CONTRACT_DECK)
    chk('3 [SETUP-CONTRACT] with a Contract card: 3 drawn + the Contract card = 4 in Hand, 36 in the Deck, over 8 seeds', all(x == [4, 36, 1, 0] for x in s), s)
    s = ev(pg, "(d)=>{const out=new Set();for(let i=0;i<8;i++){BS.seedRng(200+i);const q=BS.newGame(d,d).p.player;out.add(q.hand.map(h=>h.id).join())}return out.size}", CONTRACT_DECK)
    chk('4 [SETUP-CONTRACT] the 3 drawn cards still come from a shuffled Deck (different seeds give different Hands)', s > 1, s)
    # redraw through the real start-of-match prompts
    def start(seed, deck=None, choose='FIRST', contract='Add to Hand'):
        pg = page(b)
        run(pg, "await BS.startNewGame({seed:%d%s});" % (seed, (',deckA:' + json.dumps(deck)) if deck else ''), 50)
        wait_btn(pg, 'HEADS'); press(pg, 'HEADS')
        if wait_btn(pg, 'FIRST', 1500): press(pg, choose)
        if wait_btn(pg, 'Add to Hand', 1500): press(pg, contract)      # v0.40.2: the Contract card is optional in the starting Hand
        wait_btn(pg, 'Redraw All Cards')
        return pg
    pg = start(7, CONTRACT_DECK)
    before = ev(pg, "BS.G.p.player.hand.map(h=>h.uid).join()")
    press(pg, 'Redraw All Cards'); settle(pg)
    s = ev(pg, "(()=>{const q=BS.G.p.player,all=q.hand.concat(q.deck);return [all.length,all.filter(h=>h.id==='BS74-CX03').length,BS.G.history.some(t=>t.includes('You redrew'))]})()")
    chk('5 [SETUP-REDRAW] redraw: the whole Hand (Contract card too) goes back, 40 cards stay in Hand + Deck, the Contract card exists once', s == [40, 1, True], s)
    s = ev(pg, "BS.G.p.player.hand.map(h=>h.uid).join()")
    chk('6 [SETUP-REDRAW] the redrawn Hand is a new draw (not the same 4 cards in the same order)', s != before, [before, s])
    settle(pg)
    chk('7 [SETUP-REDRAW] only one redraw: the starting-hand prompt does not come back', not any('Redraw All Cards' in x for x in btns(pg)), btns(pg))
    pg2 = start(11, CONTRACT_DECK, contract='Keep in Deck')
    s = ev(pg2, "(()=>{const q=BS.G.p.player;return [q.hand.length,q.hand.filter(h=>h.id==='BS74-CX03').length,q.deck.filter(h=>h.id==='BS74-CX03').length]})()")
    chk('8 [SETUP-CONTRACT-CHOICE] Keep in Deck: 4 cards in Hand without the Contract card, the Contract card is in the Deck (v0.40.2)', s == [4, 0, 1], s)
    pg = start(8)
    before = ev(pg, "BS.G.p.player.hand.map(h=>h.uid).join()")
    press(pg, 'Keep Hand'); settle(pg)
    chk('8 [SETUP-REDRAW] "Keep Hand" keeps the same 4 cards', ev(pg, "BS.G.p.player.hand.slice(0,4).map(h=>h.uid).join()") == before)
    # coin toss: try seeds until both outcomes are seen
    won = lost = None
    for seed in range(1, 12):
        pg = page(b); run(pg, "await BS.startNewGame({seed:%d});" % seed, 50)
        wait_btn(pg, 'HEADS'); press(pg, 'HEADS')
        if wait_btn(pg, 'FIRST', 1200):
            if won is None:
                won = 'SECOND' in ' '.join(btns(pg)); press(pg, 'SECOND'); (wait_btn(pg, 'Add to Hand', 800) and press(pg, 'Add to Hand')); wait_btn(pg, 'Keep Hand'); press(pg, 'Keep Hand'); settle(pg)
                won = won and ev(pg, "BS.G.history.some(t=>t.includes('Turn 1: CPU'))")   # v0.87.0: settle() waits past the CPU's whole first turn
        elif lost is None:
            lost = ev(pg, "BS.G.history.some(t=>t.includes('CPU won the toss and goes first'))")
        if won is not None and lost is not None: break
    chk('9 [SETUP-FIRST-PLAYER] the toss winner chooses first or second (SECOND makes the CPU start)', won, won)
    chk('10 [SETUP-FIRST-PLAYER] when the CPU wins the toss it goes first', lost, lost)
    # ---- B. turn steps (Eternal manual pp. 20-21, CR 7-3-2)
    def board(turn, void=0, extra=None):
        pg = page(b); spec = {"turn": turn, "active": "player", "step": 0, "players": {"player": {"reserve": 3, "void": void, "deck": ["TRAIN-01", "TRAIN-02", "TRAIN-03"], "hand": []}, "opponent": {"deck": ["TRAIN-01", "TRAIN-01"]}}}
        if extra: spec["players"]["player"].update(extra)
        scen(pg, spec); return pg
    pg = board(0)
    c0 = cores(pg, 'player'); run(pg, "await BS.beginTurn('player');", 1700); c1 = cores(pg, 'player')
    chk('11 [TURN-FIRST-SKIPS] turn 1: no core in the Core Step, but the Draw Step still draws', c1['res'] == c0['res'] and c1['hand'] == 1 and c1['made'] == c0['made'] and ev(pg, "BS.G.turnNo===1&&BS.G.step===4"), (c0, c1))
    chk('12 [TURN-FIRST-SKIPS] the log says only the Core Step is skipped', ev(pg, "BS.G.history.some(t=>t.includes('Core Step is skipped'))"))
    pg = board(1, void=2)
    top = ev(pg, "P.deck[0].uid"); c0 = cores(pg, 'player'); run(pg, "await BS.beginTurn('player');", 1700); c1 = cores(pg, 'player')
    chk('13 [TURN-CORE-FROM-VOID] Core Step: 1 core from the Void to the Reserve (Void 2 -> 1, no new core made)', c1['res'] == c0['res'] + 1 and c1['void'] == 1 and c1['made'] == c0['made'] and ev(pg, inv) == 'ok', (c0, c1))
    chk('14 [TURN-DRAW] Draw Step: the top card of the Deck goes to the Hand', ev(pg, f"P.hand.length===1&&P.hand[0].uid==={top}&&P.deck.length===2"))
    pg = board(1, void=0)
    c0 = cores(pg, 'player'); run(pg, "await BS.beginTurn('player');", 1700); c1 = cores(pg, 'player')
    chk('15 [VOID-UNLIMITED] Core Step with an empty Void: a core is added from outside the game (made +1)', c1['res'] == c0['res'] + 1 and c1['void'] == 0 and c1['made'] == c0['made'] + 1 and ev(pg, inv) == 'ok', (c0, c1))
    pg = board(1, extra={"spirits": [{"id": "TRAIN-02", "cores": 1, "exhausted": True, "as": "s1"}], "trashCores": 2, "soul": "trash"})
    c0 = cores(pg, 'player'); run(pg, "await BS.beginTurn('player');", 1700); c1 = cores(pg, 'player')
    chk('16 [TURN-REFRESH] Refresh Step: exhausted Spirits are refreshed', ev(pg, "SC.s1.exhausted===false"))
    chk('17 [TURN-REFRESH] Refresh Step: Trash cores (and the Soul Core) go to the Reserve', c1['res'] == c0['res'] + 1 + 2 and c1['soul'] and ev(pg, "P.trashCores.n===0&&!P.trashCores.soul") and ev(pg, inv) == 'ok', (c0, c1))
    pg = board(3, extra={"spirits": [{"id": "TRAIN-02", "cores": 1, "as": "s1"}]})
    ev(pg, "SC.s1.bpMod=3000;O.spirits.push(BS.mkInst('TRAIN-01'));O.spirits[0].cores=1;O.made+=1;O.spirits[0].bpMod=2000;0")
    run(pg, "await BS.endStep('player');", 600)
    chk('18 [TURN-END] End Step: until-end-of-turn BP changes end for both players', ev(pg, "SC.s1.bpMod===0&&O.spirits[0].bpMod===0"))
    # ---- C. deck-out (Eternal manual p. 9)
    pg = board(3, extra={"deck": []})
    run(pg, "await BS.beginTurn('player');", 900)
    chk('19 [DECK-OUT] empty Deck at the start step of your own turn: you lose', ev(pg, "BS.G.over&&BS.G.winner==='opponent'"), ev(pg, "[BS.G.over,BS.G.winner]"))
    chk('20 [DECK-OUT] the game ends before the Core and Draw Steps (no core, no draw)', ev(pg, "P.hand.length===0&&P.reserve.n===3&&BS.G.step===0"))
    pg = board(3, extra={"deck": ["TRAIN-01"]})
    run(pg, "await BS.beginTurn('player');", 1700)
    chk('21 [DECK-OUT] drawing your last card is not a loss', not ev(pg, "BS.G.over") and ev(pg, "P.deck.length===0&&P.hand.length===1"))
    run(pg, "await BS.beginTurn('opponent');", 1700)
    chk('22 [DECK-OUT] your empty Deck does not lose at the opponent\'s start step', not ev(pg, "BS.G.over"))
    run(pg, "await BS.beginTurn('player');", 900)
    chk('23 [DECK-OUT] ... but it does at the start step of your next turn', ev(pg, "BS.G.over&&BS.G.winner==='opponent'"))
    # ---- D. battle (Eternal manual pp. 30-31); the CPU defends with cpuChooseBlock (stronger blocker first; at low Life the strongest)
    def fight(att, blockers, life=5, exhausted=False):
        pg = page(b)
        scen(pg, {"turn": 3, "active": "player", "step": 5, "players": {
            "player": {"reserve": 3, "spirits": [{"id": att, "cores": 1, "as": "a"}]},
            "opponent": {"life": life, "reserve": 3, "spirits": [{"id": x, "cores": 1, "exhausted": exhausted, "as": "b%d" % i} for i, x in enumerate(blockers)]}}})
        ev(pg, "window.c0={o:O.reserve.n,om:O.made,pm:P.made};0")
        run(pg, "await BS.doBattle('player',SC.a);", 2200); return pg
    pg = fight('TRAIN-04', ['TRAIN-01'], life=2)        # 4000 vs 2000, the CPU must block at Life 2
    chk('24 [BATTLE-BP] higher BP wins: the blocker is destroyed, the attacker stays (exhausted)', ev(pg, "O.trash.includes(SC.b0)&&P.spirits.includes(SC.a)&&SC.a.exhausted&&O.life===2"), ev(pg, "[O.trash.length,P.spirits.length,O.life]"))
    chk('25 [BATTLE-BP] the destroyed Spirit\'s cores go to its owner\'s Reserve', ev(pg, "O.reserve.n===c0.o+1&&O.made===c0.om&&" + inv + "==='ok'"), ev(pg, "[O.reserve.n,c0.o]"))
    pg = fight('TRAIN-01', ['TRAIN-04', 'TRAIN-04'])    # 2000 vs 4000: the CPU blocks with a stronger Spirit
    chk('26 [BATTLE-BP] lower BP loses: the attacker is destroyed, the blocker stays', ev(pg, "P.trash.includes(SC.a)&&O.spirits.length===2&&O.life===5"), ev(pg, "[P.trash.length,O.spirits.length,O.life]"))
    chk('27 [BATTLE-ONE-BLOCKER] exactly one Spirit blocks and it is exhausted; the other stays refreshed', ev(pg, "O.spirits.filter(s=>s.exhausted).length===1"))
    pg = fight('TRAIN-02', ['TRAIN-02'])                 # 3000 vs 3000, same cost: the CPU blocks
    chk('28 [BATTLE-BP] equal BP: both Spirits are destroyed', ev(pg, "P.trash.includes(SC.a)&&O.trash.includes(SC.b0)&&" + inv + "==='ok'"), ev(pg, "[P.trash.length,O.trash.length]"))
    pg = fight('TRAIN-01', ['TRAIN-04'], exhausted=True)
    chk('29 [BATTLE-ONE-BLOCKER] exhausted Spirits cannot block: the attack hits the Life', ev(pg, "O.life===4&&O.spirits.length===1"), ev(pg, "[O.life,O.spirits.length]"))
    chk('30 [BATTLE-LIFE] unblocked: Life -1 (1 symbol) and that core goes to the defender\'s Reserve (no core made or lost)', ev(pg, "O.reserve.n===c0.o+1&&O.made===c0.om&&" + inv + "==='ok'"), ev(pg, "[O.reserve.n,c0.o,O.made,c0.om]"))
    pg = fight('TRAIN-01', [], life=1)
    chk('31 [BATTLE-LIFE] Life 0: the attacking player wins', ev(pg, "BS.G.over&&BS.G.winner==='player'&&O.life===0"), ev(pg, "[BS.G.over,BS.G.winner,O.life]"))
    pg = page(b)
    scen(pg, {"turn": 0, "active": "opponent", "step": 0, "players": {"player": {"spirits": [], "deck": ["TRAIN-01"]}, "opponent": {"reserve": 3, "deck": ["TRAIN-01", "TRAIN-01"], "spirits": [{"id": "TRAIN-04", "cores": 1, "as": "cs"}]}}})
    run(pg, "await BS.beginTurn('opponent');await BS.cpuTurn(BS.G.p.opponent);", 4500)
    chk('32 [BATTLE-NO-FIRST-ATTACK] the CPU does not attack on the first turn of the game', ev(pg, "BS.G.turnNo===1&&P.life===5&&!SC.cs.exhausted"), ev(pg, "[BS.G.turnNo,P.life,SC.cs.exhausted]"))
    # ---- E. the Void and the Count Area (CR 4-8, Eternal manual p. 60)
    def fx(pg, act):
        run(pg, "const s=BS.mkInst('TRAIN-01');await BS.FX_ACTIONS[%s.do].run({p:P,opp:O,src:s,ctx:{}},%s);" % (json.dumps(act), json.dumps(act)), 300)
    def vboard(void):
        pg = page(b); scen(pg, {"players": {"player": {"reserve": 3, "void": void}, "opponent": {}}}); return pg
    pg = vboard(0); c0 = cores(pg, 'player'); fx(pg, {"do": "VOID_TO_RESERVE", "n": 3}); c1 = cores(pg, 'player')
    chk('33 [VOID-UNLIMITED] "3 cores from the Void" with an empty Void still gives 3 cores (added from outside the game)', c1['res'] == c0['res'] + 3 and c1['made'] == c0['made'] + 3 and c1['void'] == 0 and ev(pg, inv) == 'ok', (c0, c1))
    pg = vboard(5); c0 = cores(pg, 'player'); fx(pg, {"do": "VOID_TO_RESERVE", "n": 2}); c1 = cores(pg, 'player')
    chk('34 [VOID-UNLIMITED] with cores in the Void they are used first (Void 5 -> 3, nothing new made)', c1['res'] == c0['res'] + 2 and c1['void'] == 3 and c1['made'] == c0['made'] and ev(pg, inv) == 'ok', (c0, c1))
    pg = vboard(1); c0 = cores(pg, 'player'); fx(pg, {"do": "VOID_TO_RESERVE", "n": 3}); c1 = cores(pg, 'player')
    chk('35 [VOID-UNLIMITED] a partly empty Void: 1 core from it plus 2 new ones', c1['res'] == c0['res'] + 3 and c1['void'] == 0 and c1['made'] == c0['made'] + 2 and ev(pg, inv) == 'ok', (c0, c1))
    pg = vboard(0); c0 = cores(pg, 'player'); fx(pg, {"do": "COUNTER", "n": 1}); c1 = cores(pg, 'player')
    chk('36 [COUNT-FROM-VOID] Count +1 with an empty Void: the core comes from outside the game (made +1)', c1['count'] == 1 and c1['made'] == c0['made'] + 1 and ev(pg, inv) == 'ok', (c0, c1))
    pg = vboard(2); c0 = cores(pg, 'player'); fx(pg, {"do": "COUNTER", "n": 2}); c1 = cores(pg, 'player')
    chk('37 [COUNT-FROM-VOID] Count +2 takes 2 cores from the Void (Void 2 -> 0, nothing new made)', c1['count'] == 2 and c1['void'] == 0 and c1['made'] == c0['made'] and ev(pg, inv) == 'ok', (c0, c1))
    chk('38 [VOID-UNLIMITED] taking 0 (or fewer) cores changes nothing', ev(pg, "BS.takeFromVoid(P,0)===0&&BS.takeFromVoid(P,-2)===0&&P.void===0&&" + inv + "==='ok'"))
    # ---- F. depletion (Eternal manual p. 28)
    pg = page(b); scen(pg, {"players": {"player": {"reserve": 3, "spirits": [{"id": "TRAIN-02", "cores": 2, "as": "d"}]}, "opponent": {}}})
    ev(pg, "SC.d.cores=0;P.reserve.n+=2;BS.G.burstQ.length=0;BS.checkDepletion(P);0")
    chk('39 [DEPLETION] a Spirit below its LV1 cores is depleted to the Trash (not destroyed: no Burst/destruction event)', ev(pg, "P.trash.includes(SC.d)&&BS.G.burstQ.length===0&&BS.G.history.some(t=>t.includes('is depleted'))&&" + inv + "==='ok'"))
    pg = page(b); scen(pg, {"players": {"player": {"reserve": 3, "spirits": [{"id": "TRAIN-02", "cores": 1, "as": "d"}]}, "opponent": {}}})
    ev(pg, "BS.checkDepletion(P);0")
    chk('40 [DEPLETION] a Spirit with exactly its LV1 cores stays on the Field', ev(pg, "P.spirits.includes(SC.d)"))
    # ---- G. the rule obligations file is complete and every proving test exists
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'check_obligations.py')], capture_output=True, text=True)
    chk('41 data/kb/rule-obligations.json: every rule has a source in the manual notes and an existing proving test', r.returncode == 0, r.stdout[-400:])
    errs = [e for L in ALLERR for e in L]
    chk('42 no page errors, dialogs or console errors', not errs, errs[:4])
    b.close()
print(f'TOTAL {sum(res)}/{len(res)}')
