import json
from playwright.sync_api import sync_playwright
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
RED=open('/tmp/claude-0/fixtures/red_cards_BS75_BS76.json', encoding='utf-8').read()
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
SETUP="""(()=>{BS.testSetup(); window.mk=(k,id,cores,o)=>{const p=BS.G.p[k]; const i=BS.mkInst(id); i.cores=cores; Object.assign(i,o||{}); if(BS.CARDS[id].type==='Spirit') p.spirits.push(i); else p.nexus.push(i); return i;}; window.bal=()=>{for(const k of ['player','opponent']){const p=BS.G.p[k]; const fc=BS.fieldList(p).reduce((s,i)=>s+i.cores,0); p.made=p.life+p.reserve.n+p.trashCores.n+p.count+fc; p.deckSize=p.deck.length+p.hand.length+p.spirits.length+p.nexus.length+p.soulState.length+p.trash.length+p.removed.length+(p.burst?1:0)+BS.fieldList(p).reduce((s,i)=>s+i.under.length,0); const sc=(p.reserve.soul?1:0)+(p.trashCores.soul?1:0)+BS.fieldList(p).filter(i=>i.soul).length; if(sc===0) p.reserve.soul=true;}}; BS.G.p.player.cpu=true; return 1})()"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200])); pg.goto(F)
    pg.wait_for_timeout(300)
    r=pg.evaluate("(t)=>BS.importCards(t)",RED); print('import:',str(r)[:200])
    def ev(js): return pg.evaluate(js)
    def inv(n):
        ev("bal()"); r=ev("(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"); chk(n+' invariants',r=='ok',r)
    # 1 Cladoselache summoned: destroy <=10000 and draw
    ev(SETUP); ev("window.C=mk('player','BS75-012',1); mk('opponent','TRAIN-05',3); mk('opponent','TRAIN-10',3); BS.G.p.opponent.spirits[1].cores=6")
    bp=ev("BS.G.p.opponent.spirits.map(s=>BS.bpOf(s))"); h0=ev("BS.G.p.player.hand.length")
    ev("BS.fireFx(BS.G.p.player,'SUMMONED',C)"); pg.wait_for_timeout(900)
    chk('Clado destroys <=10000 target',ev("BS.G.p.opponent.spirits.length")==1,bp)
    chk('Clado draws on destroy',ev("BS.G.p.player.hand.length")==h0+1)
    chk('survivor is the big one',ev("BS.bpOf(BS.G.p.opponent.spirits[0])")>10000)
    inv('clado')
    # 2 no target -> nothing
    ev(SETUP); ev("window.C=mk('player','BS75-012',1); mk('opponent','TRAIN-10',5)")
    h0=ev("BS.G.p.player.hand.length"); ev("BS.fireFx(BS.G.p.player,'SUMMONED',C)"); pg.wait_for_timeout(700)
    chk('no valid target: nothing happens',ev("BS.G.p.opponent.spirits.length")==1 and ev("BS.G.p.player.hand.length")==h0)
    # 3 level gating: Clado lv? (1 core = lv1 ok). Borzoi attack draw only lv1-2: 3000/4000 levels cores 1,2 ; lv index
    ev(SETUP); ev("window.B=mk('player','BS76-004',2)")
    h0=ev("BS.G.p.player.hand.length"); ev("BS.fireFx(BS.G.p.player,'ATTACKS',B,{attacker:B})"); pg.wait_for_timeout(700)
    chk('Borzoi lv2 attack draws',ev("BS.G.p.player.hand.length")==h0+1)
    ev(SETUP); ev("window.B=mk('player','BS75-004',1)")   # lv1 only: draw is LV2 only
    h0=ev("BS.G.p.player.hand.length"); ev("BS.fireFx(BS.G.p.player,'ATTACKS',B,{attacker:B})"); pg.wait_for_timeout(500)
    chk('Pachyrhachis lv1: LV2-only effect does not fire',ev("BS.G.p.player.hand.length")==h0)
    # 4 static Rainydle
    ev(SETUP); ev("window.R=mk('player','BS75-006',2); window.W=mk('player','BS75-002',1)")
    a=ev("BS.bpOf(W)"); ev("BS.G.p.player.life=3"); c=ev("BS.bpOf(W)"); ev("BS.G.p.player.life=5"); d=ev("BS.bpOf(W)")
    chk('static +5000 only at life<=3 and lv2',c==a+5000 and d==a,(a,c,d))
    ev("BS.G.p.player.life=3; R.cores=1"); chk('static off at lv1',ev("BS.bpOf(W)")==a)
    # 5 Lavafalls attackingOnly
    ev(SETUP); ev("window.N=mk('player','BS76-069',1); window.W=mk('player','BS75-002',1); window.W2=mk('player','BS75-002',1)")
    a=ev("BS.bpOf(W)"); ev("BS.G.attacker=W"); chk('Lavafalls +3000 to attacker only',ev("BS.bpOf(W)")==a+3000 and ev("BS.bpOf(W2)")==a)
    ev("BS.G.attacker=null"); chk('Lavafalls gone outside attack',ev("BS.bpOf(W)")==a)
    # 6 Lizardedge ally attacks
    ev(SETUP); ev("window.L=mk('player','BS75-002',2); window.A=mk('player','BS75-006',2); mk('opponent','TRAIN-02',1); mk('opponent','TRAIN-06',4)")
    ba=ev("BS.bpOf(A)"); bs=ev("BS.G.p.opponent.spirits.map(s=>BS.bpOf(s))")
    ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',A,{attacker:A})"); pg.wait_for_timeout(800)
    left=ev("BS.G.p.opponent.spirits.map(s=>BS.bpOf(s))")
    chk('Lizardedge destroys best BP<=attacker',len(left)==1,(ba,bs,left))
    # 7 ALLY filter: attacker not matching name does nothing
    ev(SETUP); ev("window.L=mk('player','BS75-002',2); window.X=mk('player','TRAIN-02',2); mk('opponent','TRAIN-02',1)")
    ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',X,{attacker:X})"); pg.wait_for_timeout(500)
    chk('match filter respected',ev("BS.G.p.opponent.spirits.length")==1)
    # 8 Rokceratops nexus destroy
    ev(SETUP); ev("window.R=mk('player','BS75-005',2); window.A=mk('player','BS75-002',1); mk('opponent','TRAIN-N1',2)")
    ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',A,{attacker:A})"); pg.wait_for_timeout(700)
    chk('Nexus destroyed',ev("BS.G.p.opponent.nexus.length")==0 and ev("BS.G.p.opponent.trash.length")==1)
    inv('nexus destroy')
    # 9 Sunstone: counter +1, once per turn draw
    ev(SETUP); ev("window.S=mk('player','BS75-061',2); window.A=mk('player','BS75-002',1); BS.G.p.opponent.life=3")
    ev("BS.G.p.player.hand=[]"); c0=ev("BS.G.p.player.count")
    ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',A,{attacker:A})"); pg.wait_for_timeout(900)
    ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',A,{attacker:A})"); pg.wait_for_timeout(900)
    chk('Sunstone counter +1 twice, draw once per turn',ev("BS.G.p.player.count")==c0+2 and ev("BS.G.p.player.hand.length")==1,(ev("BS.G.p.player.count"),ev("BS.G.p.player.hand.length")))
    inv('sunstone')
    ev("BS.G.turnNo++; BS.G.p.player.hand=[]"); ev("BS.fireFx(BS.G.p.player,'ALLY_ATTACKS',A,{attacker:A})"); pg.wait_for_timeout(900)
    chk('once-per-turn resets next turn',ev("BS.G.p.player.hand.length")==1)
    # 10 Goradon blocked draw 2
    ev(SETUP); ev("window.G1=mk('player','BS75-001',1); window.A=mk('player','BS75-002',1); BS.G.p.player.hand=[]; BS.G.step=5; BS.G.active=BS.G.p.player.key")      # v0.204.0: Goradon's clause is scoped to your Attack Step
    ev("BS.fireFx(BS.G.p.player,'ALLY_BLOCKED',A,{attacker:A})"); pg.wait_for_timeout(700)
    chk('Goradon draws 2 when Wurm blocked: name filter needs Wurm',ev("BS.G.p.player.hand.length")==0)
    ev("window.A=mk('player','BS76-X01',1)"); ev("BS.G.p.player.hand=[]; BS.fireFx(BS.G.p.player,'ALLY_BLOCKED',A,{attacker:A})"); pg.wait_for_timeout(700)
    chk('Goradon draws 2 for a Wurm' ,ev("BS.G.p.player.hand.length")==2,ev("BS.CARDS['BS75-002'].name"))
    # 11 human prompt: optional effect asks; skip then use
    ev(SETUP); ev("BS.G.p.player.cpu=false"); ev("window.C=mk('player','BS75-012',1); window.O1=mk('opponent','TRAIN-05',3); window.O2=mk('opponent','TRAIN-05',3)")
    ev("window.PR=BS.fireFx(BS.G.p.player,'SUMMONED',C);1"); pg.wait_for_timeout(500)
    chk('human is asked',pg.evaluate("document.getElementById('action-modal').classList.contains('active')"))
    pg.locator("#modal-actions .modal-btn",has_text='Skip').click(); pg.wait_for_timeout(500)
    chk('skip = nothing destroyed',ev("BS.G.p.opponent.spirits.length")==2)
    ev("window.PR=BS.fireFx(BS.G.p.player,'SUMMONED',C);1"); pg.wait_for_timeout(500)
    pg.locator("#modal-actions .modal-btn",has_text='Use Effect').click(); pg.wait_for_timeout(500)
    chk('human target pick bar',pg.evaluate("document.getElementById('pick-bar').classList.contains('active')"))
    pg.locator("[data-v='opponent:spirit:%d']"%ev("O2.uid")).first.click(force=True); pg.wait_for_timeout(1000)
    chk('chosen target destroyed',ev("BS.G.p.opponent.spirits.length")==1 and ev("BS.G.p.opponent.spirits[0].uid===O1.uid"))
    inv('human fx')
    # 12 validation
    for bad_fx,exp in [([{'trigger':'NOPE','actions':[{'do':'DRAW','n':1}]}],'trigger'),([{'trigger':'ATTACKS','actions':[{'do':'EXPLODE'}]}],'unknown action'),([{'trigger':'ATTACKS','actions':[{'do':'DRAW','n':99}]}],'invalid'),([{'trigger':'STATIC','bp':0}],'bp'),([{'trigger':'ATTACKS','actions':[]}],'actions')]:
        r=pg.evaluate("(e)=>BS.parseCard({id:'X-1',name:'X',type:'Spirit',color:'red',cost:1,levels:[{cores:1,bp:1000}],effects:e})",bad_fx)
        chk('reject '+exp,bool(r.get('errors')) and exp in r['errors'][0],r.get('errors'))
    print('errs',errs)
    # 13 red-deck sims (CPU vs CPU)
    pg2=b.new_page(); e2=[]; pg2.on('pageerror',lambda e:e2.append(str(e)[:200])); pg2.goto(F+'?sim=1'); pg2.wait_for_timeout(400)
    pg2.evaluate("(t)=>BS.importCards(t)",RED)
    deck="""(()=>{const D=BS.PRESET_DECK; for(const k of Object.keys(D)) delete D[k]; const ids=['BS75-001','BS75-002','BS75-004','BS75-005','BS75-006','BS75-009','BS75-012','BS76-004','BS76-009','BS75-061','BS76-069','BS75-003','BS76-003','BS75-010'];
      let n=0; for(const id of ids){ if(!BS.CARDS[id]) throw new Error('missing '+id); D[id]=3; n+=3;} D['BS75-010']=1; D['BS75-003']=1; D['BS76-003']=1; return n})()"""
    print('deck size',pg2.evaluate(deck))
    fxlogs=0; games=0; invb=[]; fin=0
    for g in range(12):
        pg2.evaluate("BS.startNewGame()")
        for _ in range(150):
            pg2.wait_for_timeout(100)
            if pg2.evaluate("BS.G&&BS.G.over"): fin+=1; break
        h=pg2.evaluate("BS.G.history"); fxlogs+=len([x for x in h if '[When' in x])
        r=pg2.evaluate("(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()")
        if r!='ok': invb.append(r)
        games+=1
    print('sim games',games,'finished',fin,'fx log lines',fxlogs,'inv',invb,'errs',e2)
    chk('sims: no errors/invariants',not e2 and not invb)
    chk('sims: effects actually fired',fxlogs>0)
print('BAD',bad)
