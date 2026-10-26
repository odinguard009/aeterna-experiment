from playwright.sync_api import sync_playwright
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
INV="(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F)
    # A. abort during flash prompt via new game
    pg.evaluate("BS.testSetup(); const m=(k,id,c)=>{const i=BS.mkInst(id);i.cores=c;BS.G.p[k].spirits.push(i)}; m('opponent','TRAIN-06',2); m('player','TRAIN-02',1); BS.G.p.player.hand=[BS.mkInst('TST-MG2')]; BS.G.p.player.reserve.n=4; BS.G.busy=true; BS.render(); window.PR=BS.doBattle('opponent',BS.G.p.opponent.spirits[0]).then(()=>'done',e=>'rej:'+String(e)); 1")
    pg.wait_for_timeout(1200)
    chk('A flash prompt open',pg.evaluate("document.getElementById('action-modal').classList.contains('active')"))
    pg.evaluate("BS.testSetup()"); pg.wait_for_timeout(500)
    chk('A modal closed after new setup',not pg.evaluate("document.getElementById('action-modal').classList.contains('active')"))
    # B. abort during target pick
    pg.evaluate("const m=(k,id,c)=>{const i=BS.mkInst(id);i.cores=c;BS.G.p[k].spirits.push(i)}; m('opponent','TRAIN-02',2); BS.G.p.player.hand=[BS.mkInst('TST-MG1')]; BS.G.p.player.reserve.n=5; BS.render()")
    pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
    pg.locator("#modal-actions .modal-btn",has_text='Cast').click(); pg.wait_for_timeout(300)
    chk('B pick active',pg.evaluate("document.getElementById('pick-bar').classList.contains('active')"))
    pg.evaluate("BS.testSetup()"); pg.wait_for_timeout(400)
    chk('B pick cleared',not pg.evaluate("document.getElementById('pick-bar').classList.contains('active')"))
    chk('A/B no page errors',errs==[],errs)
    # C. Standard format Magic in Main 2
    pg.evaluate("BS.setFormat('standard'); BS.testSetup(); BS.G.step=6; const m=(k,id,c)=>{const i=BS.mkInst(id);i.cores=c;BS.G.p[k].spirits.push(i)}; m('opponent','TRAIN-02',2); BS.G.p.player.hand=[BS.mkInst('TST-MG1')]; BS.G.p.player.reserve.n=5; BS.render()")
    pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
    chk('C cast offered in Second Main',pg.locator("#modal-actions .modal-btn",has_text='Cast').count()==1)
    pg.locator("#modal-actions .modal-btn",has_text='Cancel').click()
    pg.evaluate("BS.G.step=5; BS.render()")
    pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
    chk('C no cast in Attack step',pg.locator("#modal-actions .modal-btn",has_text='Cast').count()==0)
    pg.locator("#modal-actions .modal-btn",has_text='Cancel').click()
    pg.evaluate("BS.setFormat('eternal')")
    # D. deck builder shows Magic cards, detail works
    pg.evaluate("switchView('view-deckbuilder')"); pg.wait_for_timeout(200)
    pg.fill("#db-search","Flame Burst"); pg.wait_for_timeout(200)
    chk('D magic listed in deck builder',pg.locator("#db-card-list [data-a=dbcard]").count()==1)
    pg.locator("#db-card-list [data-a=dbcard] [data-a=dbinfo]").first.dispatch_event("click"); pg.wait_for_timeout(200)
    t=pg.inner_text('#action-modal'); chk('D detail has Timing and legality','Timing: Main' in t and 'Eternal' in t,t[:150])
    pg.locator("#modal-actions .modal-btn",has_text='Close').click()
    chk('D no errors',errs==[],errs)
    # E. unlimited cores: 45 turns of core steps
    pg.evaluate("BS.testSetup()")
    pg.evaluate("(()=>{const p=BS.G.p.player; for(let i=0;i<60;i++) p.deck.push(BS.mkInst('TRAIN-01')); p.deckSize=p.deck.length+p.hand.length; BS.G.p.opponent.deckSize=BS.G.p.opponent.deck.length+BS.G.p.opponent.hand.length; BS.G.turnNo=2; return 1})()")
    pg.evaluate("window.PR=(async()=>{for(let i=0;i<45;i++){await beginTurn('player'); BS.G.over=false;} return 'ok'})().catch(e=>String(e)); 1")
    for _ in range(120):
        pg.wait_for_timeout(1000)
        if pg.evaluate("BS.G.p.player.made")>=8+44: break
    m=pg.evaluate("BS.G.p.player.made"); res=pg.evaluate("BS.G.p.player.reserve.n")
    chk('E more than 30 cores in play (unlimited)',m>=52 and res>=45,(m,res))
    chk('E invariants hold',pg.evaluate(INV)=='ok',pg.evaluate(INV))
    pg.close()
    # F. phone landscape + PC flash prompt fits
    for (w,h) in [(844,390),(1280,800),(360,640)]:
        pg=b.new_page(viewport={'width':w,'height':h}); pg.goto(F)
        pg.evaluate("BS.testSetup(); const m=(k,id,c)=>{const i=BS.mkInst(id);i.cores=c;BS.G.p[k].spirits.push(i)}; m('opponent','TRAIN-06',2); m('player','TRAIN-02',1); BS.G.p.player.hand=[BS.mkInst('TST-MG2'),BS.mkInst('TST-MG3'),BS.mkInst('TST-MG5')]; BS.G.p.player.reserve.n=6; BS.G.busy=true; BS.render(); BS.doBattle('opponent',BS.G.p.opponent.spirits[0]).catch(()=>0); 1")
        pg.wait_for_timeout(1200)
        r=pg.evaluate("(()=>{const bx=document.querySelector('#action-modal .modal-box').getBoundingClientRect();const bt=[...document.querySelectorAll('#modal-actions .modal-btn')].map(e=>e.getBoundingClientRect());return {top:bx.top,bottom:bx.bottom,h:innerHeight,w:innerWidth,right:bx.right,minTop:Math.min(...bt.map(x=>x.top)),maxBottom:Math.max(...bt.map(x=>x.bottom)),scroll:document.querySelector('#action-modal .modal-box').scrollHeight>document.querySelector('#action-modal .modal-box').clientHeight}})()")
        chk(f'F {w}x{h} flash prompt reachable',r['top']>=-1 and (r['bottom']<=r['h']+1 or r['scroll']) and r['right']<=r['w']+1,r)
        pg.close()
    b.close()
print('FAILS',bad)
