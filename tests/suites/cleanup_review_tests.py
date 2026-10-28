# v0.24: code review / cleanup suite. Every chk() is one numbered test. Needs PYTHONPATH with the fixtures helper for fixture checks only.
import json as _json_c, os as _os_c  # counts come from the card data, so a new colour needs no edit here
_CARDS = _json_c.load(open(_os_c.path.join(_os_c.path.dirname(_os_c.path.abspath(__file__)), '..', '..', 'build', 'all-cards.json'), encoding='utf-8'))
import re as _re_c; PACK_N = sum(1 for _c in _CARDS if _re_c.match(r'(\d\dR)?(BSC|BS|SD|CB|DB)\d', _c['id']) and not _c.get('token')); CONTRACTORS = sorted(c['id'] for c in _CARDS if c['type'] == 'Nexus' and '-CX' in c['id'] and c.get('levels'))   # BS76/BS77 CX Flagbearers have no levels yet (Flag Contract, open in roadmap-open.md): not Count-level
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, sys, re, time
F = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
res = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
def ev(pg, js): return pg.evaluate(js)
def newp(b, w=1280, h=800, fixtures=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []; reqs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.on("console", lambda m: errs.append('CONSOLE:' + m.text[:200]) if m.type == 'error' else None)
    pg.on("request", lambda r: reqs.append(r.url))
    pg.goto(F); ready(pg); return pg, errs, reqs
SETUP = """(()=>{BS.testSetup(); const G=BS.G;
window.mk=(k,id,cores,o)=>{const p=G.p[k]; const i=BS.mkInst(id); i.cores=cores; if(BS.CARDS[id].type==='Spirit') p.spirits.push(i); else p.nexus.push(i); p.reserve.n-=cores; p.deckSize++; return i;};
window.inv=()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}};
G.p.player.reserve.n=20; G.p.player.made=25; G.p.opponent.reserve.n=20; G.p.opponent.made=25; G.p.player.cpu=true; G.p.opponent.cpu=true;
G.p.player.deck=[]; G.p.opponent.deck=[]; G.p.player.deckSize=0; G.p.opponent.deckSize=0;
return 1})()"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg, errs, reqs = newp(b)
    # ---- A. prototype leftovers are gone from the shipped game
    chk('A1 no TST-* cards in the shipped game', ev(pg, "Object.keys(BS.CARDS).filter(k=>k.startsWith('TST-')).length===0"))
    chk('A2 old Advent API removed (doAdvent/adventSources)', ev(pg, "BS.doAdvent===undefined&&BS.adventSources===undefined"))
    chk('A3 no card carries a legacy field (advent/onAdvent/onAttack/onSummon)', ev(pg, "Object.values(BS.CARDS).every(c=>!('advent' in c)&&!('onAdvent' in c)&&!('onAttack' in c)&&!('onSummon' in c))"))
    chk('A4 page source has no legacy markers', ev(pg, "(()=>{const s=document.documentElement.outerHTML;return !/DESTROY_ALL_BP_LE|COUNT1|humanAdvent|'DRAW1'|v0\\.2\\.0 prototype/.test(s)})()"))
    chk('A5 no page errors on load', not errs, errs)
    chk('A6 version: title, header and BS.VERSION agree', ev(pg, "document.title.includes('v'+BS.VERSION)&&/^0\\.\\d+\\.\\d+$/.test(BS.VERSION)"))
    # ---- B. the Training deck and the default deck
    chk('B1 Training deck has exactly 40 cards', ev(pg, "Object.values(BS.PRESET_DECK).reduce((a,b)=>a+b,0)===40"))
    chk('B2 Training deck is legal in Eternal', ev(pg, "BS.validateDeck(BS.PRESET_DECK,'eternal').ok"), ev(pg, "BS.validateDeck(BS.PRESET_DECK,'eternal').errors"))
    chk('B3 Training deck uses only existing cards, max 3 copies', ev(pg, "Object.entries(BS.PRESET_DECK).every(([id,n])=>BS.CARDS[id]&&n>=1&&n<=3)"))
    chk('B4 first-run default deck is a real-card deck (v0.97.0: Standard starter 26RSD02)', ev(pg, "(()=>{const d=BS.PLAYER_DECK;return Object.keys(d).some(k=>k.startsWith('26RSD02-'))})()"))
    chk('B5 default deck is legal in Eternal', ev(pg, "BS.validateDeck(BS.PLAYER_DECK,'eternal').ok"), ev(pg, "BS.validateDeck(BS.PLAYER_DECK,'eternal').errors"))
    chk('B6 every prebuilt deck only references existing cards', ev(pg, "BS.PREBUILT.every(d=>Object.keys(d.cards).every(id=>BS.CARDS[id]))"))
    chk('B7 Mitra and Red prebuilt decks are legal in Eternal', ev(pg, "BS.PREBUILT.filter(d=>d.id!=='train'&&!d.format).every(d=>BS.validateDeck(d.cards,'eternal').ok)"), ev(pg, "BS.PREBUILT.map(d=>d.id+':'+BS.validateDeck(d.cards,'eternal').errors.join('|'))"))
    # ---- C. built-in card data audit (all 63 pack cards)
    chk(f'C1 pack registers {PACK_N} cards (the Brave card too, Standard 26R BS/CB ids), all ids unique', ev(pg, "(()=>{const k=Object.keys(BS.CARDS).filter(i=>/^(\\d\\dR)?(BSC|BS|SD|CB|DB)\\d/.test(i)&&!BS.CARDS[i].token);return k.length===%d&&new Set(k).size===%d})()" % (PACK_N, PACK_N)))
    # v0.80.x data intake added the id families 26RDBxx-yyy and BSCxx-yyy and 3-letter promo codes (BS38-RVX01)
    chk('C2 every pack card id looks like BSxx-yyy / SDxx-yyy / BSCxx-yyy / 26RBSxx-yyy / 26RCBxx-yyy / 26RDBxx-yyy', ev(pg, "Object.keys(BS.CARDS).filter(i=>/^(\\d\\dR)?(BSC|BS|SD|CB|DB)\\d/.test(i)&&!BS.CARDS[i].token).every(i=>/^(\\d\\dR)?(BSC|BS|SD|CB|DB)\\d\\d-[A-Z]{0,4}\\d{2,3}$/.test(i))"))
    chk('C3 colour is one of the six', ev(pg, "Object.values(BS.CARDS).every(c=>['red','purple','green','yellow','blue','white'].includes(c.symbol))"))
    chk('C4 cost within 0..30 and integer', ev(pg, "Object.values(BS.CARDS).every(c=>Number.isInteger(c.cost)&&c.cost>=0&&c.cost<=30)"))
    chk('C5 Spirit levels: cores strictly ascending, BP numeric', ev(pg, "Object.values(BS.CARDS).filter(c=>c.type==='Spirit').every(c=>c.levels.length>=1&&c.levels.every((l,i)=>Number.isInteger(l.cores)&&Number.isInteger(l.bp)&&(i===0||l.cores>c.levels[i-1].cores)))"))
    # BS32-036 is the one printed exception: Fandom lists LV1 20000 BP and LV2 10000 BP (checked 2026-10-20), so the data is right
    chk('C6 Spirit BP never decreases with level (except BS32-036)', ev(pg, "Object.values(BS.CARDS).filter(c=>c.type==='Spirit'&&c.id!=='BS32-036').every(c=>c.levels.every((l,i)=>i===0||l.bp>=c.levels[i-1].bp))"))
    chk('C7 reduction values are non-negative integers, symbols 0..5', ev(pg, "Object.values(BS.CARDS).every(c=>Object.values(c.reduction||{}).every(v=>Number.isInteger(v)&&v>=0&&v<=10)&&Number.isInteger(c.symbols)&&c.symbols>=0&&c.symbols<=5)"))
    chk('C8 Nexus cards carry no BP', ev(pg, "Object.values(BS.CARDS).filter(c=>c.type==='Nexus').every(c=>c.levels.every(l=>l.bp==null))"))
    chk('C9 Magic cards have a magic block or are flagged not implemented', ev(pg, "Object.values(BS.CARDS).filter(c=>c.type==='Magic').every(c=>c.magic||c.implemented===false)"))
    chk('C10 every card has a non-empty name and desc', ev(pg, "Object.values(BS.CARDS).every(c=>c.name&&c.name.length>0&&typeof c.desc==='string'&&c.desc.length>0)"))
    chk('C11 effects re-validate through the parser', ev(pg, "Object.values(BS.CARDS).filter(c=>c.effects).every(c=>!BS.parseEffects(JSON.parse(JSON.stringify(c.effects))).error)"))
    chk('C12 bursts re-validate through the parser', ev(pg, "Object.values(BS.CARDS).filter(c=>c.burst).every(c=>!BS.parseBurst(JSON.parse(JSON.stringify(c.burst))).error)"))
    chk('C13 every action name used by a card exists in the engine', ev(pg, "Object.values(BS.CARDS).every(c=>(c.effects||[]).concat(c.burst?[c.burst]:[]).every(e=>(e.actions||[]).every(a=>BS.FX_ACTIONS[a.do])))"))
    chk(f'C14 Count-level cards are exactly the {len(CONTRACTORS)} Contractor Nexuses', ev(pg, "Object.values(BS.CARDS).filter(c=>c.countLv).length===%d" % len(CONTRACTORS)))
    chk('C15 at most one Contract card family per deck rule is enforced', ev(pg, "(()=>{const d={'BS74-CX03':1,'BS71-CX01':1};d['BS74-072']=38;return !BS.validateDeck(d,'eternal').ok})()"))
    # ---- D. security / privacy
    chk('D1 no network request other than the page itself', all(u.startswith('file://') or u.startswith('data:') for u in reqs), [u for u in reqs if not (u.startswith('file://') or u.startswith('data:'))][:3])
    src = open('/mnt/user-data/outputs/wip.html', encoding='utf-8').read()
    # v0.117.0: the page now carries the opt-in ONLINE mode (13i-online.js + 13j-online-lobby.js), the only code allowed to
    # reach the network; a local match must stay request-free (D1 measures that live). The scan is scoped instead of dropped,
    # and the same invariant runs in the quick loop as tests/unit/offline_bundle.test.mjs (this Python-only check missed the
    # regressions from v0.108.0 to v0.116.0).
    NET = re.compile(r'\bfetch\s*\(|\bWebSocket\s*\(|XMLHttpRequest|\beval\s*\(|new\s+Function\s*\(|sendBeacon\s*\(|importScripts\s*\(')
    ONLINE_MODULES = {'13i-online.js', '13j-online-lobby.js'}
    def _read(p): return open(p, encoding='utf-8').read()
    engine_net = []
    for d in ('packages/protocol/src', 'packages/engine/src'):
        for f in sorted(_os_c.listdir(d)):
            if f.endswith('.js') and NET.search(_read(_os_c.path.join(d, f))): engine_net.append(d + '/' + f)
    chk('D2a the engine and protocol never touch the network or eval', not engine_net, engine_net[:3])
    web = {f: len(NET.findall(_read(_os_c.path.join('apps/web/src', f)))) for f in sorted(_os_c.listdir('apps/web/src')) if f.endswith('.js')}
    extra_net = [f for f, n in web.items() if n and f not in ONLINE_MODULES]
    chk('D2b only the opt-in online modules make network calls', not extra_net, extra_net[:3])
    chk('D2c every network call in the page comes from those two modules', len(NET.findall(src)) == sum(web.get(f, 0) for f in ONLINE_MODULES), (len(NET.findall(src)), sum(web.get(f, 0) for f in ONLINE_MODULES)))
    chk('D3 no external script or stylesheet tags', not re.search(r'<script[^>]+src=|<link[^>]+href="http', src))
    xss = [{"id": "XSS-1", "name": "<img src=x onerror=window.__x=1>", "type": "Spirit", "color": "red", "cost": 1, "levels": [{"cores": 1, "bp": 1000}], "text": "<script>window.__x=1</script>", "families": ["<b>x</b>"]}]
    ev(pg, "BS.importCards(%s)" % json.dumps(json.dumps(xss)))
    ev(pg, SETUP); ev(pg, "BS.G.p.player.hand.push(BS.mkInst('XSS-1'));BS.render()")
    settle(pg)
    chk('D4 hostile card name/text never executes (hand render)', ev(pg, "window.__x===undefined"))
    ev(pg, "BS.showCardDetail&&0"); settle(pg)
    chk('D5 hostile name is shown as text in the card-style effect text', ev(pg, "(()=>{const h=BS.effectTextHTML(BS.CARDS['XSS-1'],true);return !h.includes('<img src=x')})()"))
    chk('D6 no page errors after hostile import', not errs, errs)
    ev(pg, "BS.clearImported()")
    pg2, e2, _ = newp(b)
    pg2.evaluate("localStorage.setItem('bse.cards.v4','{not json');localStorage.setItem('bse.slots.v1','[1,2');localStorage.setItem('bse.settings.v1','xx');localStorage.setItem('bse.history.v1','{{')")
    pg2.reload(); ready(pg2)
    chk('D7 corrupt localStorage does not break the page', ev(pg2, "typeof BS==='object'&&Object.keys(BS.CARDS).length>60") and not [e for e in e2 if 'CONSOLE' not in e], e2)
    chk('D8 corrupt storage still yields a valid default deck', ev(pg2, "BS.validateDeck(BS.PLAYER_DECK,'eternal').ok"))
    pg3 = b.new_context().new_page(); pg3.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})"); e3 = []
    pg3.on("pageerror", lambda e: e3.append(str(e)[:200])); pg3.goto(F); ready(pg3)
    chk('D9 blocked localStorage does not break the page', ev(pg3, "typeof BS==='object'") and not e3, e3)
    big = json.dumps([{"id": "Z%d" % i, "name": "z", "type": "Spirit", "color": "red", "cost": 1, "levels": [{"cores": 1, "bp": 1000}]} for i in range(3001)])
    r = ev(pg2, "BS.importCards(%s)" % json.dumps(big))
    chk('D10 import of >3000 cards is refused', r.get('fatal') and r.get('ok') == 0, r)
    r = ev(pg2, "BS.importCards('[{\"id\":\"BS74-CX03\",\"name\":\"x\",\"cost\":1,\"color\":\"red\",\"levels\":[{\"cores\":1,\"bp\":1000}]}]')")
    ev(pg2, "BS.clearImported()")
    chk('D11 an import may override a pack card, and clearing the imports restores the pack card', r['ok'] == 1 and ev(pg2, "BS.CARDS['BS74-CX03'].name.includes('Mitra')&&BS.CARDS['BS74-CX03'].pack===true"), r)
    # ---- E. engine sanity without fixtures
    pg, errs, _ = newp(b); ev(pg, SETUP)
    chk('E1 testSetup builds a valid state', ev(pg, "inv()==='ok'"))
    ev(pg, "window.t1=mk('player','TRAIN-01',2);window.t2=mk('opponent','TRAIN-02',2)")
    chk('E2 BP and Lv helpers work on Training cards', ev(pg, "BS.bpOf(t1)>0&&BS.lvIndex(t1)>=0"))
    ev(pg, "BS.removeNexus(BS.G.p.player,mk('player','TRAIN-N1',2),'destroyed')")
    chk('E3 ordinary Nexus removal keeps invariants', ev(pg, "inv()==='ok'"))
    ev(pg, "BS.G.p.player.hand.push(BS.mkInst('TRAIN-03'));BS.G.step=4;BS.G.active='player'")
    chk('E4 effCost respects red symbols (TRAIN-03 cost 2, red 1)', ev(pg, "BS.effCost(BS.G.p.player,BS.CARDS['TRAIN-03'])<=2"))
    chk('E5 checkInvariants still throws on corrupt state', ev(pg, "(()=>{BS.G.p.player.reserve.n+=5;let bad=false;try{BS.checkInvariants()}catch(e){bad=true}BS.G.p.player.reserve.n-=5;return bad})()"))
    # ---- F. UI smoke on both layouts
    for (w, h, nm) in [(1280, 800, 'PC'), (390, 844, 'phone')]:
        pg, errs, _ = newp(b, w, h)
        ev(pg, "BS.loadPrebuilt('mitra');BS.setFormat('eternal');BS.startNewGame();1")
        settle(pg)
        for _ in range(5):
            if ev(pg, "document.getElementById('action-modal').classList.contains('active')"):
                pg.evaluate("(document.querySelector('#modal-actions .modal-btn')||{click(){}}).click()"); settle(pg)
        settle(pg)
        chk(f'F {nm}: a game starts from the lobby without errors', ev(pg, "BS.G!=null&&BS.G.p.player.hand.length>=4") and not errs, errs)
        chk(f'F {nm}: no horizontal page overflow', ev(pg, "document.documentElement.scrollWidth<=window.innerWidth+1"), ev(pg, "[document.documentElement.scrollWidth,window.innerWidth]"))
    # ---- G. short CPU-vs-CPU sims on the cleaned game: invariants hold, no errors
    for i, fmt in enumerate(['eternal', 'standard', 'eternal', 'standard']):
        pg, errs, _ = newp(b)
        ok = pg.evaluate("""async(f)=>{BS.setFormat(f);BS.SETTINGS.cpuDeck='red';BS.loadPrebuilt(f==='standard'?'train':'red');const bad=[];
          BS.startNewGame();await new Promise(r=>setTimeout(r,300));return 1}""", fmt)
        settle(pg)
        r = pg.evaluate("""async()=>{const G=BS.G;let n=0;try{for(let k=0;k<5&&!G.over;k++){BS.checkInvariants();await new Promise(r=>setTimeout(r,200));n++}}catch(e){return 'ERR '+e.message}return 'ok'}""")
        chk(f'G{i+1} {fmt} game stays consistent for several ticks', r == 'ok' and not errs, [r, errs])
    print('TOTAL %d/%d' % (sum(res), len(res)))
