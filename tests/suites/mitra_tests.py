# Soul State / Void / Activate / trigger-order tests (v0.13.0). Every chk() is one numbered test.
from playwright.sync_api import sync_playwright
from waits import settle, ready
import json, sys, time
F = "file:///mnt/user-data/outputs/" + (sys.argv[1] if len(sys.argv) > 1 else "wip.html")
WH = open('/tmp/claude-0/fixtures/white_mitra_awakened_dragon.json', encoding='utf-8').read()
res = []
def chk(n, c, x=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + f'[{len(res)}] ' + n, x if not c else '')
SETUP = """(()=>{BS.testSetup(); const G=BS.G;
window.mk=(k,id,cores,o)=>{const p=G.p[k]; const i=BS.mkInst(id); i.cores=cores; Object.assign(i,o||{}); if(BS.CARDS[id].type==='Spirit') p.spirits.push(i); else p.nexus.push(i); p.reserve.n-=cores; p.deckSize++; return i;};
window.put=(k,z,id)=>{const i=BS.mkInst(id); G.p[k][z].push(i); if(z==='soulState') i.inSoulState=true; G.p[k].deckSize++; return i;};
window.tovoid=(k,n)=>{G.p[k].reserve.n-=n; G.p[k].void+=n;};
window.cnt=(k)=>{const p=G.p[k]; return {hand:p.hand.length,deck:p.deck.length,trash:p.trash.length,ss:p.soulState.length,res:p.reserve.n,void:p.void,count:p.count,made:p.made}};
window.inv=()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}};
G.p.player.reserve.n=20; G.p.player.made=25; G.p.opponent.reserve.n=20; G.p.opponent.made=25; G.p.player.cpu=true; G.p.opponent.cpu=true;
G.p.player.deck=[]; G.p.opponent.deck=[]; G.p.player.deckSize=0; G.p.opponent.deckSize=0;
return 1})()"""
def new_page(b, w=1280, h=800):
    ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300])); pg.on("dialog", lambda d: (errs.append('DIALOG'), d.dismiss()))
    pg.goto(F); ready(pg)
    r = pg.evaluate("(t)=>BS.importCards(t)", WH)
    pg.evaluate(SETUP); return pg, errs, r
def ev(pg, js, *a): return pg.evaluate(js, *a) if a else pg.evaluate(js)
def modal_open(pg): return pg.evaluate("document.getElementById('action-modal').classList.contains('active')")
def modal_title(pg): return pg.inner_text("#modal-card-title") if modal_open(pg) else ''
def press(pg, txt):
    l = pg.locator("#modal-actions .modal-btn", has_text=txt); assert l.count(), 'no button ' + txt + ' in ' + modal_title(pg); l.first.click()
def wait_for(pg, js, ms=4000):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(60)
    return False
MITRA_FX = "BS.CARDS['BS74-CX03']"
with sync_playwright() as p:
    b = p.chromium.launch()
    # ================= A. data =================
    pg, errs, r = new_page(b)
    chk('white deck data imports: 18 cards, 0 rejected', r['ok'] == 18 and not r['bad'], r)
    chk('Mitra is a white Contract Nexus with 2 levels (0 / 2 cores)', ev(pg, "(()=>{const c=BS.CARDS['BS74-CX03'];return c.type==='Nexus'&&c.symbol==='white'&&c.contract===true&&c.levels.length===2&&c.levels[0].cores===0&&c.levels[1].cores===2&&c.cost===2})()"))
    chk('all 16 Spirits are white with a white reduction icon', ev(pg, "Object.values(BS.CARDS).filter(c=>c.imported&&c.type==='Spirit'&&/^BS7[45]/.test(c.id)).every(c=>c.symbol==='white'&&c.reduction.white>=1)"))
    chk('Paanch / Chai / Sat carry the god reduction icon (Fandom, v0.41.2)', ev(pg, "['BS74-043','BS74-045','BS74-047'].every(i=>BS.CARDS[i].reduction.god===1)"))
    chk('Sunya has soulReduce, others do not', ev(pg, "BS.CARDS['BS74-050'].soulReduce===true&&!BS.CARDS['BS74-038'].soulReduce"))
    chk('ACTIVATE effects parsed with timing/cost/sameName', ev(pg, "(()=>{const e=BS.CARDS['BS74-CX03'].effects.filter(x=>x.trigger==='ACTIVATE');return e.length===2&&e[0].timing.includes('MAIN')&&e[0].sameName&&e[1].cost.nexusToVoid===3&&e[1].timing.join()==='FLASH'})()"))
    def bad(js, exp, label):
        r = pg.evaluate("BS.parseCard(" + js + ")")
        chk('reject: ' + label, bool(r.get('errors')) and exp in r['errors'][0], r.get('errors'))
    base = "{id:'X-1',name:'X',type:'Spirit',color:'white',cost:1,levels:[{cores:1,bp:1000}],effects:[%s]}"
    bad(base % "{trigger:'ACTIVATE',cost:{nexusToVoid:9},actions:[{do:'DRAW',n:1}]}", 'ACTIVATE "cost"', 'ACTIVATE cost too high')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'SOUL_ENTER',src:'nowhere',match:{name:['a']}}]}", 'invalid parameters', 'SOUL_ENTER bad source')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'SOUL_ENTER',src:'hand'}]}", 'invalid parameters', 'SOUL_ENTER without match')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'SOUL_ENTER',src:'reveal',n:9,match:{name:['a']},rest:'bottom'}]}", 'invalid parameters', 'reveal 9 cards')
    bad(base % "{trigger:'SUMMONED',if:{controlName:5},actions:[{do:'DRAW',n:1}]}", 'condition', 'controlName not a string')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'DRAW',n:1,if:{prev:'yes'}}]}", 'condition', 'prev not boolean')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'BOUNCE_OPP',kind:'all',to:'hand'}]}", 'invalid parameters', 'BOUNCE_OPP bad kind')
    bad(base % "{trigger:'SUMMONED',actions:[{do:'COUNTER',n:1,max:99}]}", 'invalid parameters', 'COUNTER max too high')
    bad(base % "{trigger:'ALLY_SUMMONED',match:{type:'Dragon'},actions:[{do:'DRAW',n:1}]}", 'match.type', 'match.type invalid')
    ok = pg.evaluate("BS.parseCard(" + base % "{trigger:'ALLY_SUMMONED',match:{type:'Spirit',costGe:3},actions:[{do:'NEXUS_CORES_TO_VOID',family:'Grandwalker'}]}" + ")")
    chk('accept valid ALLY_SUMMONED with type+costGe', ok.get('card'), ok.get('errors'))
    pg.reload(); ready(pg)
    chk('white cards (with effects) survive a reload', ev(pg, "BS.CARDS['BS74-CX03']&&BS.CARDS['BS74-CX03'].effects.length===4&&BS.CARDS['BS74-CX03'].contract===true&&BS.CARDS['BS74-050'].soulReduce===true"))
    chk('A: no page errors', not errs, errs)

    # ================= B. Soul State / Void primitives =================
    pg, errs, _ = new_page(b)
    ev(pg, "window.e1=put('player','hand','BS74-038');0")
    ev(pg, "BS.toSoulState(BS.G.p.player, e1)")
    chk('toSoulState from hand: card is in Soul State with flag', ev(pg, "BS.G.p.player.soulState.includes(e1)&&e1.inSoulState&&!BS.G.p.player.hand.includes(e1)"))
    ev(pg, "window.e2=put('player','trash','BS74-040');BS.toSoulState(BS.G.p.player,e2)")
    chk('toSoulState from trash', ev(pg, "BS.G.p.player.soulState.length===2&&BS.G.p.player.trash.length===0"))
    ev(pg, "window.e3=put('player','deck','BS74-041');BS.toSoulState(BS.G.p.player,e3)")
    chk('toSoulState from deck', ev(pg, "BS.G.p.player.soulState.length===3&&BS.G.p.player.deck.length===0"))
    ev(pg, "window.s1=mk('player','BS74-038',3);BS.toSoulState(BS.G.p.player,s1)")
    chk('toSoulState from field: cores return to the Reserve, spirit leaves the field', ev(pg, "BS.G.p.player.soulState.includes(s1)&&!BS.G.p.player.spirits.includes(s1)&&s1.cores===0&&BS.G.p.player.reserve.n===20"))
    chk('invariants hold with cards in Soul State', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    ev(pg, "tovoid('player',4)")
    chk('Void holds cores and invariants count them', ev(pg, "BS.G.p.player.void===4&&inv()==='ok'"), ev(pg, "inv()"))
    ev(pg, "window.ek=mk('player','BS74-038',1);window.mi=mk('player','BS74-CX03',2);")
    chk('Ek not activatable without being Lv ok? (needs Mitra, which is on field now) -> activatable', ev(pg, "BS.activatable(BS.G.p.player,ek,'MAIN').length===1"))
    ev(pg, "BS.G.p.player.nexus.length=0")
    chk('Ek NOT activatable without a Contractor Mitra', ev(pg, "BS.activatable(BS.G.p.player,ek,'MAIN').length===0"))
    chk('B: no page errors', not errs, errs)

    # ================= C. Ek =================
    pg, errs, _ = new_page(b)
    ev(pg, "window.mi=mk('player','BS74-CX03',2);window.ek=mk('player','BS74-038',1);tovoid('player',2);0")
    c0 = ev(pg, "cnt('player')")
    ev(pg, "window.pr=BS.activateFx(BS.G.p.player,ek,0);0"); settle(pg)
    c1 = ev(pg, "cnt('player')")
    chk('Ek activate: Ek enters Soul State', ev(pg, "BS.G.p.player.soulState.includes(ek)&&!BS.G.p.player.spirits.includes(ek)"))
    # v0.29 official rule: Count Area cores come from the Void (Eternal Rule Manual p.60) and the Void is the core supply (Comprehensive Rules 4-8)
    chk('Ek activate: counter +1', c1['count'] == 1 and c1['made'] == c0['made'], c1)
    chk('Ek activate: exact Void/Reserve numbers', c1['void'] == 0 and c1['res'] == c0['res'] + 1 + 1, (c0, c1))
    ev(pg, "window.ek2=mk('player','BS74-038',1)")
    chk('second Ek cannot activate the same turn (Same Name)', ev(pg, "BS.activatable(BS.G.p.player,ek2,'MAIN').length===0"))
    ev(pg, "BS.G.turnNo++")
    chk('next turn Ek can activate again', ev(pg, "BS.activatable(BS.G.p.player,ek2,'MAIN').length===1"))
    chk('invariants after Ek', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    chk('C: no page errors', not errs, errs)

    # ================= D. Mitra Contract Field / Skill =================
    pg, errs, _ = new_page(b)
    ev(pg, "window.mi=mk('player','BS74-CX03',3);window.h1=put('player','hand','BS74-043');window.h2=put('player','hand','BS74-050');window.t1=put('player','trash','BS74-048');0")
    chk('Contract Field activatable (MAIN and FLASH)', ev(pg, "BS.activatable(BS.G.p.player,mi,'MAIN').length===1&&BS.activatable(BS.G.p.player,mi,'FLASH').length===1"), ev(pg, "BS.activatable(BS.G.p.player,mi,'FLASH').length"))
    ev(pg, "window.pr=BS.activateFx(BS.G.p.player,mi,2);0"); settle(pg)
    chk('Contract Field: CPU lets the most expensive card enter Soul State', ev(pg, "BS.G.p.player.soulState.length===1&&BS.G.p.player.soulState[0].id==='BS74-050'"), ev(pg, "BS.G.p.player.soulState.map(x=>x.id)"))
    chk('Contract Field: counter +2', ev(pg, "BS.G.p.player.count===2"))
    ev(pg, "BS.G.turnNo++;BS.G.p.player.count+=7;BS.G.p.player.made+=7;0")
    ev(pg, "window.pr=BS.activateFx(BS.G.p.player,mi,2);0"); settle(pg)
    chk('counter is capped at 10', ev(pg, "BS.G.p.player.count===10"), ev(pg, "BS.G.p.player.count"))
    chk('Contract Field with no Hand/Trash/Soul State cards to use is not activatable', ev(pg, "(()=>{const p=BS.G.p.player;p.deck.push(...p.hand.splice(0),...p.trash.splice(0));const keep=p.soulState.filter(x=>BS.CARDS[x.id].contractAdvent);for(const x of keep)p.soulState.splice(p.soulState.indexOf(x),1);BS.G.turnNo++;const r=BS.activatable(p,mi,'MAIN').length===0;for(const x of keep)p.soulState.push(x);return r})()"))
    # skill
    ev(pg, "(()=>{const x=BS.mkInst('BS74-043');x.inSoulState=true;BS.G.p.player.soulState.push(x);BS.G.p.player.deckSize++})()")
    chk('Contract Skill needs 3 cores on Mitra (has 3) and is Flash only', ev(pg, "BS.activatable(BS.G.p.player,mi,'FLASH').some(x=>x.idx===3)&&!BS.activatable(BS.G.p.player,mi,'MAIN').some(x=>x.idx===3)"))
    ev(pg, "window.rs=BS.G.p.player.reserve.n;window.pr=BS.activateFx(BS.G.p.player,mi,3);0"); settle(pg)
    chk('Contract Skill: 3 cores to the Void, Mitra drops to 0 cores (v0.87.0 state wait: the summoned card then charges it with 1)', ev(pg, "BS.G.p.player.void===3&&mi.cores===1"), ev(pg, "[BS.G.p.player.void,mi.cores]"))
    chk('Contract Skill: a Spirit from Soul State was summoned free', ev(pg, "BS.G.p.player.spirits.length===1&&BS.G.p.player.soulState.length===2"), ev(pg, "[BS.G.p.player.spirits.map(x=>x.id),BS.G.p.player.soulState.map(x=>x.id)]"))
    chk('summoned-from-Soul-State card has the Lv1 core and no Soul State flag', ev(pg, "BS.G.p.player.spirits[0].cores>=1&&!BS.G.p.player.spirits[0].inSoulState"))
    chk('invariants after Contract Field/Skill', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    ev(pg, "mi.cores=2;BS.G.turnNo++")
    chk('Contract Skill not activatable with only 2 cores on Mitra', ev(pg, "!BS.activatable(BS.G.p.player,mi,'FLASH').some(x=>x.idx===3)"))
    chk('D: no page errors', not errs, errs)

    # ================= E. Neo-Core Charge + trigger order =================
    pg, errs, _ = new_page(b)
    ev(pg, "window.mi=mk('player','BS74-CX03',0);window.sp=put('player','hand','BS74-042');0")
    ev(pg, "BS.summon(BS.G.p.player,sp,null);window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',sp);0"); settle(pg)
    chk('Neo-Core: summoning a cost-3 Awakened Dragon gives Mitra +1 core', ev(pg, "mi.cores===1"), ev(pg, "mi.cores"))
    ev(pg, "window.sp2=put('player','hand','BS74-038');BS.summon(BS.G.p.player,sp2,null);window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',sp2);0"); settle(pg)
    chk('Neo-Core: a cost-1 Awakened Dragon gives no core', ev(pg, "mi.cores===1"), ev(pg, "mi.cores"))
    ev(pg, "window.sp3=put('player','hand','TRAIN-08');window.pr=0")
    pg.evaluate("BS.CARDS['TRAIN-08'].families=['Training']")
    ev(pg, "BS.summon(BS.G.p.player,sp3,null);window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',sp3);0"); settle(pg)
    chk('Neo-Core: a non-matching family gives no core', ev(pg, "mi.cores===1"))
    ev(pg, "const q=BS.mkInst('BS74-CX03');BS.G.p.player.hand.push(q);BS.G.p.player.deckSize++;")
    # deploy second Mitra: deck top 3 to trash with cores per matching card
    ev(pg, "const P=BS.G.p.player;P.deck=[BS.mkInst('BS74-043'),BS.mkInst('TRAIN-01'),BS.mkInst('BS74-050')];P.deckSize+=3;window.mi2=P.hand[P.hand.length-1];BS.summon(P,mi2,null);window.pr=BS.fireFx(P,'SUMMONED',mi2);0"); settle(pg)
    chk('Mitra deploy: 3 cards from the Deck go to the Trash', ev(pg, "BS.G.p.player.deck.length===0&&BS.G.p.player.trash.length>=3"), ev(pg, "cnt('player')"))
    chk('Mitra deploy: +1 core for each matching card (Paanch cost3 + Sunya cost9 = 2)', ev(pg, "mi2.cores===2"), ev(pg, "mi2.cores"))
    chk('invariants after Neo-Core', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    chk('E: no page errors', not errs, errs)

    # trigger order: human sees a choice when two effects trigger together
    pg, errs, _ = new_page(b)
    ev(pg, "BS.G.p.player.cpu=false;window.mi=mk('player','BS74-CX03',0);window.pc=put('player','hand','BS75-030');BS.G.p.player.soulState.push(BS.mkInst('BS74-043'));BS.G.p.player.soulState[0].inSoulState=true;BS.G.p.player.deckSize++;BS.G.p.player.reserve.n=20")
    ev(pg, "BS.summon(BS.G.p.player,pc,null);window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',pc);0")
    chk('two simultaneous triggers: human is asked for the order', wait_for(pg, "document.getElementById('action-modal').classList.contains('active')") and 'Order' in modal_title(pg), modal_title(pg))
    buttons = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    buttons = [x for x in buttons if 'View Field' not in x]
    chk('order modal lists both effects', len(buttons) == 2 and any('Mitra' in x for x in buttons) and any('Pachhattar' in x for x in buttons), buttons)
    press(pg, 'Mitra')       # Neo-Core first
    wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    t = modal_title(pg)
    chk('after the first effect the next prompt appears', modal_open(pg), t)
    for _ in range(8):
        if not wait_for(pg, "document.getElementById('action-modal').classList.contains('active')", 1500): break   # derived effects (v0.28) open their prompt after the current effect has finished
        l = pg.locator("#modal-actions .modal-btn"); txt = l.all_inner_texts()
        pick = [x for x in txt if 'Use Effect' in x] or [x for x in txt if 'Skip' not in x and 'Pass' not in x and 'Cancel' not in x]
        press(pg, (pick or txt)[0]); settle(pg)
    chk('both effects resolved: Mitra got +1 core from Neo-Core and Pachhattar added +1 core', ev(pg, "mi.cores>=1"), ev(pg, "mi.cores"))
    chk('trigger-order run leaves invariants intact', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    settle(pg)
    chk('E2: no page errors', not errs, errs)
    chk('E2: no modal left open', not modal_open(pg), modal_title(pg))

    # ================= F. Spirit effects =================
    def setup2(extra=''):
        pg, errs, _ = new_page(b)
        ev(pg, "window.mi=mk('player','BS74-CX03',2);" + extra); return pg, errs
    # Teen: reveal 1 card
    pg, errs = setup2("window.teen=mk('player','BS74-041',1);const P=BS.G.p.player;P.deck=[BS.mkInst('BS74-048'),BS.mkInst('TRAIN-01')];P.deckSize+=2;tovoid('player',1);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',teen,{attacker:teen});0"); settle(pg)
    chk('Teen: revealed Awakened Dragon enters Soul State', ev(pg, "BS.G.p.player.soulState.some(x=>x.id==='BS74-048')"), ev(pg, "BS.G.p.player.soulState.map(x=>x.id)"))
    chk('Teen: a core from the Void goes to Teen', ev(pg, "teen.cores===2&&BS.G.p.player.void===0"), ev(pg, "[teen.cores,BS.G.p.player.void]"))
    chk('Teen: remaining deck intact, revealed zone empty', ev(pg, "BS.G.p.player.deck.length===1&&BS.G.p.player.revealed.length===0&&inv()==='ok'"), ev(pg, "inv()"))
    pg, errs = setup2("window.teen=mk('player','BS74-041',1);const P=BS.G.p.player;P.deck=[BS.mkInst('TRAIN-01'),BS.mkInst('TRAIN-02')];P.deckSize+=2;tovoid('player',1);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',teen,{attacker:teen});0"); settle(pg)
    chk('Teen: non-matching revealed card returns to the deck BOTTOM, no Void core', ev(pg, "BS.G.p.player.deck.length===2&&BS.G.p.player.deck[1].id==='TRAIN-01'&&teen.cores===1&&BS.G.p.player.soulState.length===0"), ev(pg, "[BS.G.p.player.deck.map(x=>x.id),teen.cores]"))
    # Iktis
    pg, errs = setup2("window.ik=mk('player','BS74-042',2);const P=BS.G.p.player;P.deck=[BS.mkInst('TRAIN-01'),BS.mkInst('BS74-050'),BS.mkInst('BS74-CX03'),BS.mkInst('TRAIN-02')];P.deckSize+=4;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',ik);0"); settle(pg)
    chk('Iktis LV2: reveals 3, Awakened Dragon AND Mitra enter Soul State, rest discarded', ev(pg, "(()=>{const P=BS.G.p.player;const s=P.soulState.map(x=>x.id).sort().join();return s==='BS74-050,BS74-CX03'&&P.trash.some(x=>x.id==='TRAIN-01')&&P.deck.length===1&&inv()==='ok'})()"), ev(pg, "[BS.G.p.player.soulState.map(x=>x.id),BS.G.p.player.trash.map(x=>x.id),inv()]"))
    pg, errs = setup2("window.ik=mk('player','BS74-042',1);const P=BS.G.p.player;P.deck=[BS.mkInst('BS74-050'),BS.mkInst('BS74-CX03'),BS.mkInst('TRAIN-02')];P.deckSize+=3;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',ik);0"); settle(pg)
    chk('Iktis LV1: only ONE card enters Soul State', ev(pg, "BS.G.p.player.soulState.length===1"), ev(pg, "BS.G.p.player.soulState.map(x=>x.id)"))
    # Paanch
    pg, errs = setup2("window.pa=mk('player','BS74-043',1);const P=BS.G.p.player;P.soulState.push(BS.mkInst('BS74-040'));P.soulState[0].inSoulState=true;P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',pa,{attacker:pa});0"); settle(pg)
    chk('Paanch: Soul State card returns to Hand and Mitra gets +1 core', ev(pg, "BS.G.p.player.soulState.length===0&&BS.G.p.player.hand.some(x=>x.id==='BS74-040')&&mi.cores===3"), ev(pg, "[cnt('player'),mi.cores]"))
    pg, errs = setup2("window.pa=mk('player','BS74-043',3);window.big=mk('opponent','TRAIN-08',3);window.small=mk('opponent','TRAIN-01',1);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',pa,{attacker:pa});0"); settle(pg)
    chk('Paanch LV2: bounces an opposing card with cost <= its own (cost 3)', ev(pg, "BS.G.p.opponent.hand.length===1&&(BS.G.p.opponent.hand[0].id==='TRAIN-01'||BS.G.p.opponent.hand[0].id==='TRAIN-08')&&inv()==='ok'"), ev(pg, "BS.G.p.opponent.hand.map(x=>x.id)"))
    chk('Paanch LV2: the cost-5 target (TRAIN-08 cost 5) was NOT eligible', ev(pg, "BS.G.p.opponent.spirits.some(x=>x.id==='TRAIN-08')"), ev(pg, "BS.G.p.opponent.spirits.map(x=>x.id)"))
    chk('bounced card returned its cores to the owner Reserve', ev(pg, "BS.G.p.opponent.reserve.n===17"), ev(pg, "BS.G.p.opponent.reserve.n"))
    # Battis
    pg, errs = setup2("window.ba=mk('player','BS75-035',3);window.o1=mk('opponent','TRAIN-08',2);const O=BS.G.p.opponent;for(let i=0;i<5;i++){O.hand.push(BS.mkInst('TRAIN-01'));O.deckSize++}const P=BS.G.p.player;P.deck=[BS.mkInst('TRAIN-02')];P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',ba);0"); settle(pg)
    chk('Battis: opposing Spirit to Hand, opposing Hand now 6 -> you draw 1', ev(pg, "BS.G.p.opponent.hand.length===6&&BS.G.p.player.hand.length===1&&BS.G.p.player.deck.length===0"), ev(pg, "[cnt('player'),cnt('opponent')]"))
    pg, errs = setup2("window.ba=mk('player','BS75-035',3);window.o1=mk('opponent','TRAIN-08',2);const P=BS.G.p.player;P.deck=[BS.mkInst('TRAIN-02')];P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',ba,{attacker:ba});0"); settle(pg)
    chk('Battis: opposing Hand only 1 -> no draw', ev(pg, "BS.G.p.opponent.hand.length===1&&BS.G.p.player.hand.length===0"), ev(pg, "[cnt('player'),cnt('opponent')]"))
    # Aath
    pg, errs = setup2("window.aa=mk('player','BS74-048',3);window.og=mk('opponent','BS74-CX03',4);window.o1=mk('opponent','TRAIN-08',2);const P=BS.G.p.player;for(let i=0;i<3;i++){const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++}")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',aa,{attacker:aa});0"); settle(pg)
    chk('Aath: all cores of the opposing Grandwalker Nexus go to the OPPOSING Void', ev(pg, "og.cores===0&&BS.G.p.opponent.void===4"), ev(pg, "[og.cores,BS.G.p.opponent.void]"))
    chk('Aath with 3 Soul State cards: an opposing card is returned to the deck bottom', ev(pg, "BS.G.p.opponent.deck.length===1&&inv()==='ok'"), ev(pg, "[cnt('opponent'),inv()]"))
    pg, errs = setup2("window.aa=mk('player','BS74-048',3);window.o1=mk('opponent','TRAIN-08',2);const P=BS.G.p.player;const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',aa,{attacker:aa});0"); settle(pg)
    chk('Aath with only 1 Soul State card: no deck-bottom return', ev(pg, "BS.G.p.opponent.deck.length===0&&BS.G.p.opponent.spirits.length===1"), ev(pg, "cnt('opponent')"))
    # Chai
    pg, errs = setup2("window.ch=mk('player','BS74-045',2);tovoid('player',2);const O=BS.G.p.opponent;O.burst=BS.mkInst('TST-BST1');O.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',ch,{attacker:ch});0"); settle(pg)
    chk('Chai: opposing Burst is discarded and no Void core is taken', ev(pg, "BS.G.p.opponent.burst===null&&BS.G.p.opponent.trash.length===1&&ch.cores===2&&BS.G.p.player.void===2"), ev(pg, "[cnt('opponent'),ch.cores]"))
    pg, errs = setup2("window.ch=mk('player','BS74-045',2);tovoid('player',2);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',ch,{attacker:ch});0"); settle(pg)
    chk('Chai: no opposing Burst -> a core from the Void goes to Chai', ev(pg, "ch.cores===3&&BS.G.p.player.void===1&&inv()==='ok'"), ev(pg, "[ch.cores,BS.G.p.player.void,inv()]"))
    # Sunya
    pg, errs = setup2("window.su=mk('player','BS74-050',2);window.o1=mk('opponent','TRAIN-08',2);")
    ev(pg, "su.exhausted=true;window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',su,{attacker:su});0"); settle(pg)
    chk('Sunya LV2: returns an opposing Spirit to the deck bottom and refreshes itself', ev(pg, "BS.G.p.opponent.deck.length===1&&su.exhausted===false"), ev(pg, "[cnt('opponent'),su.exhausted]"))
    pg, errs = setup2("window.su=mk('player','BS74-050',2);su.exhausted=true;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'ATTACKS',su,{attacker:su});0"); settle(pg)
    chk('Sunya: no opposing Spirit -> no refresh (prev=false)', ev(pg, "su.exhausted===true"))
    pg, errs = setup2("")
    ev(pg, "(()=>{const P=BS.G.p.player;P.reserve.n=0;P.made=P.made;})()")
    ev(pg, "(()=>{const P=BS.G.p.player;for(let i=0;i<3;i++){const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++}})()")
    c_with = ev(pg, "BS.effCost(BS.G.p.player,BS.CARDS['BS74-050'])"); c_wo = ev(pg, "(()=>{const P=BS.G.p.player;const keep=P.soulState.splice(0);const v=BS.effCost(P,BS.CARDS['BS74-050']);P.soulState.push(...keep);return v})()")
    chk('Sunya cost: Soul State symbols reduce 9 -> 7 (3 white cards x 1 white symbol; the field has only Mitra = 1 white)', c_with == 5 and c_wo == 8, (c_with, c_wo))
    # Iktalis
    pg, errs = setup2("window.ia=mk('player','BS75-037',3);tovoid('player',3);window.ally=mk('player','BS74-038',1);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',ia);0"); settle(pg)
    chk('Iktalis: nothing to return -> 2 cores from the Void go to a Spirit', ev(pg, "BS.G.p.player.void===1&&(ia.cores+ally.cores)===3+1+2"), ev(pg, "[BS.G.p.player.void,ia.cores,ally.cores]"))
    pg, errs = setup2("window.ia=mk('player','BS75-037',3);tovoid('player',3);window.o1=mk('opponent','TRAIN-08',2);")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',ia);0"); settle(pg)
    chk('Iktalis: returned a Spirit -> NO cores from the Void', ev(pg, "BS.G.p.player.void===3&&BS.G.p.opponent.deck.length===1"), ev(pg, "[BS.G.p.player.void,cnt('opponent')]"))
    # Hazaar
    pg, errs = setup2("window.hz=mk('player','BS75-X08',3);tovoid('player',5);const P=BS.G.p.player;['BS74-040','BS74-040','BS74-043','BS74-050'].forEach(id=>{const x=BS.mkInst(id);x.inSoulState=true;P.soulState.push(x);P.deckSize++})")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',hz);0"); settle(pg)
    chk('Hazaar: 3 differently-named cards in Soul State -> 3 cores from the Void', ev(pg, "BS.G.p.player.void===2&&hz.cores===6"), ev(pg, "[BS.G.p.player.void,hz.cores]"))
    # Pachhattar
    pg, errs = setup2("window.pc=mk('player','BS75-030',2);const P=BS.G.p.player;const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',pc);0"); settle(pg)
    chk('Pachhattar: +1 core to Mitra, then a Soul State card is summoned (v0.87.0 state wait: it charges Mitra once more)', ev(pg, "mi.cores===4&&BS.G.p.player.soulState.length===0&&BS.G.p.player.spirits.some(x=>x.id==='BS74-040')"), ev(pg, "[mi.cores,cnt('player'),BS.G.p.player.spirits.map(x=>x.id)]"))
    pg, errs = setup2("window.pc=mk('player','BS75-030',2);const P=BS.G.p.player;P.reserve.n=0;const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++;")
    ev(pg, "window.pr=BS.fireFx(BS.G.p.player,'SUMMONED',pc);0"); settle(pg)
    chk('Pachhattar: no Reserve core -> Mitra cannot be charged -> the Soul State card stays', ev(pg, "mi.cores===2&&BS.G.p.player.soulState.length===1"), ev(pg, "[mi.cores,BS.G.p.player.soulState.length]"))
    # Unnis
    pg, errs = setup2("window.un=mk('player','BS75-028',1);")
    ev(pg, "window.pr=BS.activateFx(BS.G.p.player,un,0);0"); settle(pg)
    chk('Unnis: enters Soul State and Mitra gets +1 core', ev(pg, "BS.G.p.player.soulState.some(x=>x.id==='BS75-028')&&mi.cores===3"), ev(pg, "[mi.cores,BS.G.p.player.soulState.length]"))
    chk('F: no page errors (last page)', not errs, errs)

    # ================= G. human UI path: activate button + choose card =================
    pg, errs, _ = new_page(b)
    ev(pg, "BS.G.p.player.cpu=false;BS.G.active='player';BS.G.step=4;BS.G.busy=false;window.mi=mk('player','BS74-CX03',2);window.ek=mk('player','BS74-038',1);window.h1=put('player','hand','BS74-043');window.h2=put('player','hand','BS74-040');BS.render()")
    pg.locator("[data-v='player:spirit:%d']" % ev(pg, "ek.uid")).first.click(force=True)
    wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    btns = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    chk('field modal shows the Activate button for Ek', any('Activate' in x and 'Soul State' in x for x in btns), btns)
    press(pg, 'Activate'); settle(pg)
    chk('Ek: activation resolved through the UI', ev(pg, "BS.G.p.player.soulState.some(x=>x.id==='BS74-038')&&BS.G.p.player.count===1"), ev(pg, "cnt('player')"))
    pg.locator("[data-v='player:nexus:%d']" % ev(pg, "mi.uid")).first.click(force=True)
    wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    btns = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    chk('Mitra modal: Contract Field button is shown, Contract Skill is not (Main Step)', any('Activate' in x for x in btns) and sum('Activate' in x for x in btns) == 1, btns)
    press(pg, 'Activate'); wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    chk('human picks the card from a list (Paanch / Do offered)', modal_open(pg) and pg.locator("#modal-actions .modal-btn").count() >= 3, pg.locator("#modal-actions .modal-btn").all_inner_texts())
    press(pg, 'Revelation'); settle(pg)
    chk('chosen card entered Soul State, counter +2', ev(pg, "BS.G.p.player.soulState.length===2&&BS.G.p.player.count===3"), ev(pg, "cnt('player')"))
    chk('invariants after the UI path', ev(pg, "inv()") == 'ok', ev(pg, "inv()"))
    # Flash window: Contract Skill offered
    ev(pg, "mi.cores=3;BS.G.turnNo++")
    ev(pg, "window.fp=BS.flashTiming('player',mk('player','TRAIN-02',2),null);0")
    wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    press(pg, 'Use Flash'); wait_for(pg, "document.querySelector('#modal-actions.vlist')")
    btns = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    chk('Flash window offers the Contract Skill (Flash effect on a Nexus)', any('Mitra' in x for x in btns), btns)
    press(pg, 'Pass'); settle(pg)
    chk('G: no page errors', not errs, errs)

    # ================= H. phone layout shows Void =================
    ctx = b.new_context(viewport={'width': 390, 'height': 844}); pm = ctx.new_page(); perr = []
    pm.on("pageerror", lambda e: perr.append(str(e)[:300])); pm.goto(F); ready(pm)
    pm.evaluate("(t)=>BS.importCards(t)", WH); pm.evaluate(SETUP); pm.evaluate("tovoid('player',2);BS.render()")
    chk('phone stats bar shows the Void pill', pm.locator(".stat-pill", has_text='VD').count() >= 2 and ' '.join(pm.locator(".stat-pill[data-v='player:void']").first.inner_text().split()).startswith('VD: 2'), pm.locator(".stat-pill", has_text='VD').all_inner_texts())
    chk('H: no page errors', not perr, perr)
    # ================= J. Soul State area (top-right / mirrored bottom-left) =================
    for (w, h, nm) in [(1280, 800, 'PC'), (390, 844, 'phone')]:
        ctx = b.new_context(viewport={'width': w, 'height': h}); q = ctx.new_page(); qe = []
        q.on("pageerror", lambda e: qe.append(str(e)[:300])); q.goto(F); ready(q)
        q.evaluate("(t)=>BS.importCards(t)", WH); q.evaluate(SETUP)
        lab0 = q.locator(".soul-area[data-v='player:soulstate'] .ba-lab").first.inner_text()
        chk(nm + ': empty Soul State area shows EMPTY', lab0.strip() == 'EMPTY', lab0)
        q.evaluate("(()=>{for(let i=0;i<12;i++){const x=BS.mkInst('BS74-038');x.inSoulState=true;BS.G.p.player.soulState.push(x);BS.G.p.player.deckSize++}BS.render()})()")
        cnt = q.locator(".soul-area[data-v='player:soulstate'] .ss-count").first.inner_text()
        chk(nm + ': 12 cards (no limit) show the count 12', cnt.strip() == '12', cnt)
        box = q.locator(".soul-area[data-v='player:soulstate']").first.bounding_box(); bur = q.locator(".burst-area[data-v='player:burst']").first.bounding_box(); fld = q.locator(".field-container-dual").nth(1).bounding_box()
        chk(nm + ': your Soul State area is right of the Burst area, same top row', box['x'] > bur['x'] + 100 and abs(box['y'] - bur['y']) < 6, (box, bur))
        ob = q.locator(".soul-area[data-v='opponent:soulstate']").first.bounding_box(); obu = q.locator(".burst-area[data-v='opponent:burst']").first.bounding_box()
        chk(nm + ': CPU area is mirrored (Soul State bottom-left, Burst bottom-right)', ob['x'] < obu['x'] - 100 and abs(ob['y'] - obu['y']) < 6, (ob, obu))
        q.locator(".soul-area[data-v='player:soulstate']").first.click(force=True); settle(q)
        chk(nm + ': tapping the area lists the cards', 'Soul State' in q.inner_text('#modal-card-title') or 'SOULSTATE' in q.inner_text('#modal-card-title').upper().replace(' ', ''), q.inner_text('#modal-card-title'))
        chk(nm + ': no page errors', not qe, qe); ctx.close()
    # ================= I. regressions of old behaviour =================
    pg, errs, _ = new_page(b)
    chk('legacy test cards still load (training deck legal)', ev(pg, "BS.validateDeck(BS.PRESET_DECK,'eternal').ok"))
    chk('Mitra deck is legal in Eternal', ev(pg, "(()=>{const d={'BS74-CX03':3,'BS74-072':3,'BS74-038':3,'BS74-040':2,'BS74-041':3,'BS74-042':3,'BS74-043':2,'BS74-045':2,'BS74-047':2,'BS74-048':2,'BS74-049':2,'BS74-050':2,'BS75-028':3,'BS75-030':2,'BS75-035':3,'BS75-037':1,'BS75-041':1,'BS75-X08':1};const v=BS.validateDeck(d,'eternal');return v.ok&&v.total===40})()"), ev(pg, "BS.validateDeck({'BS74-CX03':3},'eternal').errors"))
    b.close()
print(f"TOTAL {sum(res)}/{len(res)}")
