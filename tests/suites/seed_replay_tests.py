# v0.26: seeded randomness, match input record + replay, named scenarios (ideas from the Aegis study). Every chk() is one numbered test.
# Run: python3 tests/make_fixtures.py && python3 tests/suites/seed_replay_tests.py      (no fixtures needed)
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, sys, time, os, glob
OUT = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
SCEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scenarios')
res = []; ALLERR = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def page(b, sim=False):
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; ALLERR.append(errs)
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.goto(OUT + ('?sim=1' if sim else '')); ready(pg); return pg
def ev(pg, js, *a): return pg.evaluate(js, *a) if a else pg.evaluate(js)
def wait_over(pg, s=60):
    t0 = time.time()
    while time.time() - t0 < s and not ev(pg, "!!(BS.G&&BS.G.over)"): time.sleep(0.15)
    return ev(pg, "!!(BS.G&&BS.G.over)")
RED = "(()=>{const r=BS.PREBUILT.find(x=>x.id==='red').cards;const D=BS.PRESET_DECK;for(const k of Object.keys(D)) delete D[k];Object.assign(D,r);return 1})()"
def sim_game(b, seed):
    pg = page(b, True); ev(pg, RED); ev(pg, f"BS.startNewGame({{seed:{seed}}});1"); wait_over(pg); return pg
def human_game(b, seed, turns=10):
    """scripted human through the real UI: answers each prompt with its first enabled button, taps a pickable card, tries two hand cards per Main Step, else Next"""
    pg = page(b); ev(pg, "BS.SETTINGS.speed='instant';1"); ev(pg, f"BS.startNewGame({{deckA:BS.PREBUILT.find(x=>x.id==='mitra').cards,deckB:BS.PREBUILT.find(x=>x.id==='train').cards,seed:{seed}}});1")
    t0 = time.time(); tried = {}
    while time.time() - t0 < 90:
        if ev(pg, f"!BS.G||BS.G.over||BS.G.turnNo>{turns}"): break
        if ev(pg, "document.getElementById('action-modal').classList.contains('active')"):
            bt = pg.locator("#modal-actions .modal-btn:not([disabled])")
            if bt.count(): bt.first.click()
            settle(pg); continue
        if ev(pg, "document.documentElement.classList.contains('picking')"):
            c = pg.locator(".tcg-card.pickable")
            (c.first if c.count() else pg.locator("#pick-btns .modal-btn").first).click(); settle(pg); continue
        if ev(pg, "BS.humanCan()"):
            key = ev(pg, "BS.G.turnNo+':'+BS.G.step")
            if ev(pg, "BS.G.step===4&&BS.G.p.player.hand.length>0") and tried.get(key, 0) < 2:
                tried[key] = tried.get(key, 0) + 1; hc = pg.locator(".tcg-card[data-a='hand']"); hc.nth(min(tried[key] - 1, hc.count() - 1)).click()
            else:
                nb = pg.locator(".inline-next-btn")
                if nb.count() and nb.first.is_enabled(): nb.first.click()
        settle(pg)
    return pg
def replay(b, rec, sim=False):
    pg = page(b, sim); return pg, ev(pg, "(r)=>BS.runReplay(r,{idleMs:2500})", rec)
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- A. seeded randomness
    pg = page(b)
    chk('1 same seed gives the same random sequence', ev(pg, "(()=>{BS.seedRng(42);const a=[...Array(10)].map(()=>BS.rng());BS.seedRng(42);const c=[...Array(10)].map(()=>BS.rng());return JSON.stringify(a)===JSON.stringify(c)})()"))
    chk('2 different seeds give different sequences', ev(pg, "(()=>{BS.seedRng(1);const a=BS.rng();BS.seedRng(2);return a!==BS.rng()})()"))
    chk('3 rng() stays in [0,1) over 5000 draws', ev(pg, "(()=>{BS.seedRng(7);for(let i=0;i<5000;i++){const x=BS.rng();if(!(x>=0&&x<1))return false}return true})()"))
    chk('4 seed 0 is accepted (treated as 1)', ev(pg, "(()=>{BS.seedRng(0);const a=BS.rng();BS.seedRng(1);return a===BS.rng()})()"))
    chk('5 game logic no longer uses Math.random (only the seed generator)', ev(pg, "(document.documentElement.outerHTML.match(/Math\\.random\\(/g)||[]).length===1"))
    # ---- B. record and replay
    pg1 = sim_game(b, 12345); r1 = ev(pg1, "BS.lastReplay()")
    chk('6 a match keeps its record: seed, build, both decks, inputs', r1 and r1['seed'] == 12345 and r1['build'] == ev(pg1, "BS.VERSION") and sum(r1['deckA'].values()) == 40 and sum(r1['deckB'].values()) == 40 and r1['inputs'] == [], r1 and {k: r1[k] for k in ('seed', 'build')})
    chk('7 the record has the final result and a hash of the whole log', r1['final'] and r1['final']['log'] > 10 and len(r1['final']['hash']) > 4, r1['final'])
    pg2 = sim_game(b, 12345); r2 = ev(pg2, "BS.lastReplay()")
    chk('8 same seed + decks: the CPU-vs-CPU match is identical (log hash)', r1['final'] == r2['final'], [r1['final'], r2['final']])
    chk('9 card uids restart each match (same seed -> same uids)', ev(pg1, "BS.G.p.player.trash.concat(BS.G.p.player.deck).length>0") and ev(pg1, "Math.min(...BS.G.p.player.deck.concat(BS.G.p.player.trash,BS.G.p.player.hand).map(x=>x.uid))") == ev(pg2, "Math.min(...BS.G.p.player.deck.concat(BS.G.p.player.trash,BS.G.p.player.hand).map(x=>x.uid))"))
    r3 = ev(sim_game(b, 999), "BS.lastReplay()")
    chk('10 another seed gives another match', r3['final']['hash'] != r1['final']['hash'], [r1['final'], r3['final']])
    pgR, rr = replay(b, r1, True)
    chk('11 replay of a CPU-vs-CPU record: ok and the same match', rr['ok'] and rr['same'], rr)
    pgH = human_game(b, 777); h1 = ev(pgH, "BS.lastReplay()")
    chk('12 human record starts with the coin-toss answer and is not lossy', h1['inputs'] and h1['inputs'][0].get('m') in ('h', 't') and not h1['lossy'], h1['inputs'][:3])
    chk('13 human record has board actions and prompt answers', any('a' in x for x in h1['inputs']) and sum(1 for x in h1['inputs'] if 'm' in x) >= 3, len(h1['inputs']))
    chk('14 the human match finished', ev(pgH, "BS.G.over"))
    pgR, rr = replay(b, h1)
    chk('15 replay of the human match: every input used, same result and log hash', rr['ok'] and rr['same'] and rr['at'] == len(h1['inputs']), rr)
    pgH2 = human_game(b, 31337); h2 = ev(pgH2, "BS.lastReplay()")
    pgR2, rr2 = replay(b, h2)
    chk('16 second human match (with field picks / Burst set) replays identically', rr2['ok'] and rr2['same'], [rr2, len(h2['inputs'])])
    chk('17 the replay record survives a JSON round trip', json.loads(json.dumps(h2)) == h2)
    bad = dict(h1); bad['seed'] = h1['seed'] + 1
    _, rb = replay(b, bad)
    chk('18 a changed seed is detected (not the same match)', not (rb['ok'] and rb['same']), rb)
    k = next(i for i, x in enumerate(h1['inputs']) if x.get('a') == 'next')
    cut = dict(h1); cut['inputs'] = h1['inputs'][:k] + h1['inputs'][k + 1:]
    _, rc = replay(b, cut)
    chk('19 a missing board action (first Next) is detected', not (rc['ok'] and rc['same']), rc)
    pgx = page(b)
    chk('20 runReplay rejects something that is not a record', ev(pgx, "(async()=>{const r=await BS.runReplay({foo:1});return r.ok===false&&/not a replay/.test(r.reason)})()"))
    hist0 = ev(pgR, "BS.HISTORY().length")
    chk('21 a replay does not add a match to the history', ev(pgR, "BS.HISTORY().filter(h=>h.you==='Replay').length") == 0, hist0)
    chk('22 a finished human match stores its replay in the history', ev(pgH, "(()=>{const h=BS.HISTORY();return !!h.length&&!!h[h.length-1].replay&&h[h.length-1].replay.seed===777})()"))
    chk('23 only the last 3 history entries keep a replay', ev(pgH, "(()=>{const H=BS.HISTORY();for(let i=0;i<5;i++)H.push({t:1,fmt:'eternal',you:'x',cpu:'y',won:true,turns:1,replay:{v:1}});BS.G.meta={fmt:'eternal',you:'a',cpu:'b',done:false};BS.recordMatch('player');return H.filter(h=>h.replay).length===3&&!!H[H.length-1].replay})()"))
    # ---- C. named scenarios
    files = sorted(glob.glob(os.path.join(SCEN, '*.json')))
    pg = page(b); loaded = []
    for f in files:
        spec = json.load(open(f, encoding='utf-8')); r = ev(pg, "(s)=>{const r=BS.loadScenario(s);return [r.ok===true, r.error||'', (()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()]}", spec)
        loaded.append([os.path.basename(f)] + r)
    chk('24 every scenario file loads with consistent cores/cards', len(files) >= 4 and all(x[1] and x[3] == 'ok' for x in loaded), loaded)
    chk('25 scenario names match their file names', all(json.load(open(f, encoding='utf-8'))['name'] + '.json' == os.path.basename(f) for f in files))
    chk('26 loadScenario rejects an unknown card', ev(pg, "/unknown card/.test(BS.loadScenario({players:{player:{hand:['NOPE-1']}}}).error||'')"))
    chk('27 loadScenario rejects two Soul Cores and duplicate aliases', ev(pg, "/Soul Core/.test(BS.loadScenario({players:{player:{nexus:[{id:'BS74-CX01',soul:true},{id:'BS74-CX03',soul:true}]}}}).error||'')&&/twice/.test(BS.loadScenario({players:{player:{hand:[{id:'BS75-001',as:'a'},{id:'BS75-002',as:'a'}]}}}).error||'')"))
    def scen(name):
        pg = page(b); r = ev(pg, "(s)=>BS.loadScenario(s)", json.load(open(os.path.join(SCEN, name + '.json'), encoding='utf-8'))); return pg, r
    pg, r = scen('erimakilizard-life3-takes-all-cores')
    ev(pg, "(async()=>{await BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',SC.attacker,{attacker:SC.attacker})})();1"); settle(pg)
    chk('28 scenario erimakilizard-life3: all 4 cores of one Nexus go to the Void', ev(pg, "SC.mitra.cores===0&&SC.zeus.cores===1"), ev(pg, "[SC.mitra.cores,SC.zeus.cores]"))
    pg, r = scen('ometeotl-soul-unaffected')
    ev(pg, "(async()=>{await BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',SC.erimaki,{attacker:SC.erimaki})})();1"); settle(pg)
    chk('29 scenario ometeotl-soul-unaffected: Ometeotl untouched, Mitra loses its core', ev(pg, "SC.ometeotl.cores===3&&SC.mitra.cores===0"), ev(pg, "[SC.ometeotl.cores,SC.mitra.cores]"))
    pg, r = scen('sphinott-manifest-either-attack-step')
    chk('30 scenario sphinott: Manifest offered in the opposing Attack Step', ev(pg, "BS.manifestTargets(BS.G.p.player,SC.sphinott,'flash').includes(SC.ometeotl)"))
    ev(pg, "(async()=>{await BS.doManifest(BS.G.p.player,SC.sphinott,SC.ometeotl,'flash')})();1"); settle(pg)
    chk('31 ... When Manifests destroys up to 20000 BP and banishes one', ev(pg, "(()=>{const O=BS.G.p.opponent;const gone=[SC.big,SC.mid,SC.small].filter(x=>!O.spirits.includes(x));return gone.length>=1&&O.removed.length===1})()"), ev(pg, "BS.G.history.slice(-6)"))
    pg, r = scen('magmatodon-reveal-deploys-ometeotl')
    ev(pg, "(async()=>{await BS.fireFx(BS.G.p.player,'SUMMONED',SC.magmatodon)})();1"); settle(pg)
    chk('32 scenario magmatodon: Ometeotl deployed, Lava Fish added, opposing Spirit destroyed', ev(pg, "(()=>{const P=BS.G.p.player;return P.nexus.some(n=>n.id==='BS74-CX01'&&n.soul)&&P.hand.some(h=>h.id==='BS75-012')&&!BS.G.p.opponent.spirits.includes(SC.victim)})()"), ev(pg, "BS.G.history.slice(-6)"))
    chk('33 no page errors in this suite', not any(ALLERR), [e for e in ALLERR if e])
    print(f'TOTAL {sum(res)}/{len(res)}')
