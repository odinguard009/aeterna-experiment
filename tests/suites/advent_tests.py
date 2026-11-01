from waits import settle, ready  # v0.87.0 (F5): state waits instead of fixed times
# Contract Advent / Manifest tests (v0.14.0). Every chk() is one numbered test.
import sys, re
sys.argv = [sys.argv[0]] + sys.argv[1:]
src = open('/tmp/claude-0/t4/mitra_tests.py', encoding='utf-8').read()
head = src.split("MITRA_FX =")[0]          # shared helpers + SETUP
exec(head)
def inv(pg): return ev(pg, "inv()")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg, errs, r = new_page(b)
    chk('data: Teen/Iktis/Aath/Pachhattar/Iktalis have contractAdvent, Banve/Hazaar have manifest', ev(pg, "['BS74-041','BS74-042','BS74-048','BS75-030','BS75-037'].every(i=>!!BS.CARDS[i].contractAdvent&&BS.CARDS[i].keywords.includes('CONTRACT_ADVENT'))&&['BS75-041','BS75-X08'].every(i=>!!BS.CARDS[i].manifest&&BS.CARDS[i].keywords.includes('MANIFEST'))"))
    chk('data: counter requirements C2 / C3 / C4 / C6', ev(pg, "BS.CARDS['BS74-042'].contractAdvent.counterGe===2&&BS.CARDS['BS74-048'].contractAdvent.counterGe===3&&BS.CARDS['BS75-037'].contractAdvent.counterGe===4&&BS.CARDS['BS75-041'].manifest.counterGe===6"))
    base = "{id:'X-1',name:'X',type:'%s',color:'white',cost:1,levels:[{cores:1,bp:1000}],%s}"
    def bad(js, exp, label, typ='Spirit'):
        rr = pg.evaluate("BS.parseCard(" + base % (typ, js) + ")")
        chk('reject: ' + label, bool(rr.get('errors')) and exp in rr['errors'][0], rr.get('errors'))
    bad("contractAdvent:{}", 'contractAdvent', 'contractAdvent without family')
    bad("contractAdvent:{family:'A',turn:'NEVER'}", 'contractAdvent', 'bad turn')
    bad("contractAdvent:{family:'A',counterGe:'x'}", 'contractAdvent', 'counterGe not a number')
    bad("manifest:{counterGe:3}", 'manifest', 'manifest without name')
    bad("contractAdvent:{family:'A'}", 'contractAdvent', 'contractAdvent on a Nexus', 'Nexus')
    chk('A: no page errors', not errs, errs)

    S = "BS.G.p.player.cpu=true;window.mi=mk('player','BS74-CX03',2);window.pa=mk('player','BS74-043',2);window.tn=put('player','hand','BS74-041');"
    def fresh(extra=''):
        pg, errs, _ = new_page(b); ev(pg, S + extra); return pg, errs
    pg, errs = fresh()
    chk('Teen (no counter needed): the Awakened Dragon Spirit is a target, Mitra (a Nexus) is not', ev(pg, "BS.contractAdventTargets(BS.G.p.player,tn,'main').map(x=>x.id).join()==='BS74-043'"))
    chk('a non-Awakened Spirit is not a target', ev(pg, "(()=>{mk('player','TRAIN-02',2);return BS.contractAdventTargets(BS.G.p.player,tn,'main').length===1})()"))
    ev(pg, "window.hp=BS.G.p.player.hand.length;window.pr=BS.doContractAdvent(BS.G.p.player,tn,pa,'main');0"); settle(pg)
    chk('Contract Advent: Teen now stands on the field in Paanch place, Paanch is stacked under it', ev(pg, "BS.G.p.player.spirits.includes(tn)&&!BS.G.p.player.spirits.includes(pa)&&tn.under.includes(pa)&&BS.G.p.player.hand.length===hp-1"))
    chk('Contract Advent: cores stay on the stack (2)', ev(pg, "tn.cores===2"), ev(pg, "tn.cores"))
    chk('Contract Advent: the Soul Core went to the Trash (not to Teen)', ev(pg, "BS.G.p.player.trashCores.soul===true&&BS.G.p.player.reserve.soul===false&&tn.soul===false"))
    chk('invariants after Contract Advent (exactly one Soul Core)', inv(pg) == 'ok', inv(pg))
    ev(pg, "window.x2=put('player','hand','BS74-041')")
    chk('a second Contract Advent is impossible: the Soul Core is gone', ev(pg, "BS.contractAdventTargets(BS.G.p.player,x2,'main').length===0"))
    chk('A2: no page errors', not errs, errs)

    pg, errs = fresh("window.ik=put('player','hand','BS74-042');")
    chk('Iktis needs 2 counters: 0 -> no target', ev(pg, "BS.contractAdventTargets(BS.G.p.player,ik,'main').length===0"))
    ev(pg, "BS.G.p.player.count=2;BS.G.p.player.made+=2")
    chk('Iktis with 2 counters: target available', ev(pg, "BS.contractAdventTargets(BS.G.p.player,ik,'main').length===1"))
    ev(pg, "const P=BS.G.p.player;P.deck=[BS.mkInst('TRAIN-01'),BS.mkInst('BS74-050'),BS.mkInst('TRAIN-02')];P.deckSize+=3;window.pr=BS.doContractAdvent(P,ik,pa,'main');0"); settle(pg)
    chk('Iktis "When Summoned/Advents" fires on Advent: Awakened Dragon enters Soul State, rest discarded', ev(pg, "BS.G.p.player.soulState.some(x=>x.id==='BS74-050')&&BS.G.p.player.trash.length>=2&&inv()==='ok'"), ev(pg, "[BS.G.p.player.soulState.map(x=>x.id),BS.G.p.player.trash.length,inv()]"))
    chk('log says "When Advents"', ev(pg, "BS.G.history.some(x=>x.includes('When Advents'))"))

    pg, errs = fresh("window.aa=put('player','hand','BS74-048');BS.G.p.player.count=3;BS.G.p.player.made+=3;window.og=mk('opponent','BS74-CX03',3);")
    ev(pg, "window.pr=BS.doContractAdvent(BS.G.p.player,aa,pa,'main');0"); settle(pg)
    chk('Aath "When Advents": the opposing Grandwalker Nexus cores go to the opposing Void', ev(pg, "og.cores===0&&BS.G.p.opponent.void===3&&inv()==='ok'"), ev(pg, "[og.cores,BS.G.p.opponent.void,inv()]"))

    pg, errs = fresh("window.pc=put('player','hand','BS75-030');const P=BS.G.p.player;const x=BS.mkInst('BS74-040');x.inSoulState=true;P.soulState.push(x);P.deckSize++;")
    ev(pg, "window.pr=BS.doContractAdvent(BS.G.p.player,pc,pa,'main');0"); settle(pg)
    chk('Pachhattar "When Summoned/Advents": +1 core to Mitra and a Soul State card is summoned (v0.87.0 state wait: it charges Mitra once more)', ev(pg, "mi.cores===4&&BS.G.p.player.spirits.some(x=>x.id==='BS74-040')&&inv()==='ok'"), ev(pg, "[mi.cores,BS.G.p.player.spirits.map(x=>x.id),inv()]"))

    pg, errs = fresh()
    ev(pg, "BS.G.active='opponent';BS.G.p.player.cpu=true")
    chk('Teen is "Your Turn" only: no target during the opponent turn (flash)', ev(pg, "BS.contractAdventTargets(BS.G.p.player,tn,'flash').length===0"))
    ev(pg, "window.ik=put('player','hand','BS74-042');BS.G.p.player.count=2;BS.G.p.player.made+=2")
    chk('Iktis is "Either Attack Step": target available on the opponent turn in a Flash window', ev(pg, "BS.contractAdventTargets(BS.G.p.player,ik,'flash').length===1"))
    chk('but not in the Main Step of the opponent turn', ev(pg, "BS.contractAdventTargets(BS.G.p.player,ik,'main').length===0"))

    # soul core on a spirit
    pg, errs = fresh()
    ev(pg, "const P=BS.G.p.player;P.reserve.soul=false;pa.soul=true;")
    chk('Soul Core on the target itself: Advent allowed when enough cores remain (Teen Lv1 needs 1)', ev(pg, "BS.contractAdventTargets(BS.G.p.player,tn,'main').length===1"))
    ev(pg, "window.pr=BS.doContractAdvent(BS.G.p.player,tn,pa,'main');0"); settle(pg)
    chk('that Soul Core was sent to the Trash and invariants hold', ev(pg, "BS.G.p.player.trashCores.soul&&!tn.soul&&inv()==='ok'"), inv(pg))
    pg, errs = fresh()
    ev(pg, "const P=BS.G.p.player;P.reserve.soul=false;const o=mk('player','TRAIN-02',0);o.soul=true;")      # holder has 1 core + Soul Core: spare 0
    chk('Soul Core held by another Spirit with no spare core: Advent not possible', ev(pg, "BS.contractAdventTargets(BS.G.p.player,tn,'main').length===0"))

    # Manifest
    pg, errs = fresh("window.bv=put('player','hand','BS75-041');")
    chk('Manifest needs 6 counters: 0 -> no target', ev(pg, "BS.manifestTargets(BS.G.p.player,bv).length===0"))
    ev(pg, "BS.G.p.player.count=6;BS.G.p.player.made+=6")
    chk('Manifest with 6 counters: Mitra is the target', ev(pg, "BS.manifestTargets(BS.G.p.player,bv).map(x=>x.id).join()==='BS74-CX03'"))
    ev(pg, "window.mc=mi.cores;window.pr=BS.doManifest(BS.G.p.player,bv,mi);0"); settle(pg)
    chk('Manifest: Banve is summoned, Mitra paid one core (and Neo-Core Charge gave one back for the cost-9 Spirit), Soul Core in the Trash', ev(pg, "BS.G.p.player.spirits.includes(bv)&&mi.cores===mc&&BS.G.history.some(x=>x.includes('paid to the Trash for the Manifest'))&&BS.G.p.player.trashCores.soul===true&&BS.G.p.player.trashCores.n>=1"), ev(pg, "[mi.cores,mc]"))
    chk('invariants after Manifest', inv(pg) == 'ok', inv(pg))
    pg, errs = fresh("window.bv=put('player','hand','BS75-041');BS.G.p.player.count=6;BS.G.p.player.made+=6;mi.cores=0;")
    chk('Manifest: Mitra with no core -> not possible', ev(pg, "BS.manifestTargets(BS.G.p.player,bv).length===0"))
    pg, errs = fresh("window.bv=put('player','hand','BS75-041');BS.G.p.player.count=6;BS.G.p.player.made+=6;BS.G.p.player.nexus.length=0;")
    chk('Manifest: no Contractor Mitra on the field -> not possible', ev(pg, "BS.manifestTargets(BS.G.p.player,bv).length===0"))
    pg, errs = fresh("window.hz=put('player','hand','BS75-X08');BS.G.p.player.count=6;BS.G.p.player.made+=6;BS.G.p.soulState=BS.G.p.player.soulState;const q=BS.mkInst('BS74-040');q.inSoulState=true;BS.G.p.player.soulState.push(q);BS.G.p.player.deckSize++;tovoid('player',2);")
    ev(pg, "window.pr=BS.doManifest(BS.G.p.player,hz,mi);0"); settle(pg)
    chk('Hazaar Manifest summons and its When Summoned (Void cores) resolves', ev(pg, "BS.G.p.player.spirits.includes(hz)&&BS.G.p.player.void===1&&inv()==='ok'"), ev(pg, "[BS.G.p.player.void,inv()]"))

    # human UI
    pg, errs, _ = new_page(b)
    ev(pg, "BS.G.p.player.cpu=false;BS.G.active='player';BS.G.step=4;BS.G.busy=false;window.pa=mk('player','BS74-043',2);window.tn=put('player','hand','BS74-041');BS.render()")
    pg.locator("[data-a='hand'][data-v='%d']" % ev(pg, "tn.uid")).first.click(force=True) if pg.locator("[data-a='hand']").count() else None
    settle(pg)
    if not modal_open(pg):
        pg.locator(".hand-area .tcg-card, .hand-area [data-a]").first.click(force=True); settle(pg)
    btns = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    chk('hand modal shows the Contract Advent button', any('Contract Advent' in x for x in btns), btns)
    press(pg, 'Contract Advent'); wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    chk('target prompt lists Paanch', 'Paanch' in ' '.join(pg.locator("#modal-actions .modal-btn").all_inner_texts()))
    press(pg, 'Paanch'); settle(pg)
    chk('human Contract Advent resolved', ev(pg, "BS.G.p.player.spirits.includes(tn)&&BS.G.p.player.trashCores.soul&&inv()==='ok'"), inv(pg))
    # human flash window offer
    pg, errs, _ = new_page(b)
    ev(pg, "BS.G.p.player.cpu=false;BS.G.active='player';BS.G.step=5;window.pa=mk('player','BS74-043',2);window.ik=put('player','hand','BS74-042');BS.G.p.player.count=2;BS.G.p.player.made+=2;")
    ev(pg, "window.fp=BS.flashTiming('player',pa,null);0")
    wait_for(pg, "document.getElementById('action-modal').classList.contains('active')")
    press(pg, 'Use Flash'); wait_for(pg, "document.querySelector('#modal-actions.vlist')")
    btns = pg.locator("#modal-actions .modal-btn").all_inner_texts()
    chk('Flash window offers Contract Advent for the hand card', any('Contract Advent' in x and 'Iktis' in x for x in btns), btns)
    press(pg, 'Contract Advent'); wait_for(pg, "document.getElementById('action-modal').classList.contains('active')"); press(pg, 'Paanch'); settle(pg)
    for _ in range(4):
        if modal_open(pg):
            txt = pg.locator("#modal-actions .modal-btn").all_inner_texts(); pick = [x for x in txt if 'Use Effect' in x] or [x for x in txt if 'Pass' in x or 'Skip' in x]
            press(pg, (pick or txt)[0]); settle(pg)
    chk('Advent in the Flash window replaced the attacker', ev(pg, "BS.G.p.player.spirits.includes(ik)&&inv()==='ok'"), inv(pg))
    chk('human paths: no page errors', not errs, errs)
    b.close()
print(f"TOTAL {sum(res)}/{len(res)}")
