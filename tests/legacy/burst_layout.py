from playwright.sync_api import sync_playwright
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
SETUP="""(()=>{BS.testSetup(); window.mk=(k,id,cores)=>{const p=BS.G.p[k]; const i=BS.mkInst(id); i.cores=cores; p.spirits.push(i); return i.uid;}; window.bal=()=>{for(const k of ['player','opponent']){const p=BS.G.p[k]; const fc=BS.fieldList(p).reduce((s,i)=>s+i.cores,0); p.made=p.life+p.reserve.n+p.trashCores.n+p.count+fc; p.deckSize=p.deck.length+p.hand.length+p.spirits.length+p.nexus.length+p.soulState.length+p.trash.length+p.removed.length+(p.burst?1:0)+BS.fieldList(p).reduce((s,i)=>s+i.under.length,0);}}; return 1})()"""
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
INV="(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"
GEO="""(k)=>{const q=(s)=>[...document.querySelectorAll(s)];const ba=q('.burst-area').map(e=>e.getBoundingClientRect());const fc=q('.field-container-dual').map(e=>e.getBoundingClientRect());const rows=q('.field-container-dual').map(c=>[...c.querySelectorAll('.field-row-wrapper')].map(e=>e.getBoundingClientRect()));return {ba:ba.map(r=>[r.left|0,r.top|0,r.right|0,r.bottom|0]),fc:fc.map(r=>[r.left|0,r.top|0,r.right|0,r.bottom|0]),rows:rows.map(a=>a.map(r=>[r.left|0,r.top|0,r.right|0,r.bottom|0])),w:innerWidth,h:innerHeight}}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h) in [(390,844),(360,640),(844,390),(768,700),(1280,800),(1920,1080)]:
        T=f'{w}x{h}: '
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F)
        _o=pg.evaluate
        def ev(js,*a):
            if ('mk(' in js or 'hand=' in js or 'burst' in js) and 'bal()' not in js and 'SETUP' not in js and 'testSetup' not in js and 'getBounding' not in js and 'INV' not in js and 'checkInv' not in js: js=js+";bal()"
            return _o(js,*a)
        pg.evaluate=ev
        def modal(): return pg.inner_text('#action-modal') if _o("document.getElementById('action-modal').classList.contains('active')") else ''
        pg.evaluate(SETUP)
        pg.evaluate("mk('player','TRAIN-02',2); mk('opponent','TRAIN-02',2); BS.render()")
        g=_o("("+GEO+")()")
        chk(T+'two burst areas',len(g['ba'])==2,g['ba'])
        for i,nm in enumerate(['CPU','YOU']):
            ba,fc=g['ba'][i],g['fc'][i]
            if i==1: chk(T+'YOU area in top-left corner of your field',ba[0]-fc[0]<=8 and ba[1]-fc[1]<=8,(ba,fc))
            else: chk(T+'CPU area in bottom-right corner of CPU field (mirrored)',fc[2]-ba[2]<=8 and fc[3]-ba[3]<=8,(ba,fc))
            ov=any(not(ba[2]<=r[0] or r[2]<=ba[0] or ba[3]<=r[1] or r[3]<=ba[1]) for r in g['rows'][i])
            chk(T+f'{nm} area does not overlap field rows',not ov,(ba,g['rows'][i]))
            chk(T+f'{nm} area inside screen',ba[0]>=0 and ba[2]<=g['w'] and ba[3]<=g['h'],ba)
        t=_o("[...document.querySelectorAll('.burst-area')].map(e=>e.innerText.replace(/\\s+/g,' '))")
        chk(T+'empty areas say EMPTY',all('EMPTY' in x and 'SET' not in x.replace('EMPTY','') for x in t),t)
        sb=_o("[...document.querySelectorAll('.mobile-stats-bar')].map(e=>{const r=e.getBoundingClientRect(),c=e.parentElement.getBoundingClientRect();return [r.left-c.left|0,c.right-r.right|0,r.width|0]})")
        if w<768 or h<620:
            chk(T+'stats panels centered, full width',all(abs(x[0]-x[1])<=2 for x in sb) and sb[0][2]==sb[1][2],sb)
            pg.evaluate("BS.G.p.player.life=1; BS.G.p.player.reserve.n=12; BS.G.p.player.hand=Array.from({length:10},()=>BS.mkInst('TRAIN-01')); BS.G.p.player.deck.length=5; BS.render()")
            sb2=_o("[...document.querySelectorAll('.mobile-stats-bar')].map(e=>{const r=e.getBoundingClientRect(),c=e.parentElement.getBoundingClientRect();return [r.left-c.left|0,c.right-r.right|0,r.width|0]})")
            cols=_o("[...document.querySelectorAll('.mobile-stats-bar')][1].querySelectorAll('.stat-pill')[0].getBoundingClientRect().width|0")
            chk(T+'panel does not shift when values change',sb2==sb,(sb,sb2))
            pg.evaluate("BS.testSetup(); mk('player','TRAIN-02',2); mk('opponent','TRAIN-02',2); BS.render()")
        # set burst via hand button
        pg.evaluate("BS.G.p.player.hand=[BS.mkInst('TST-BST1'),BS.mkInst('TST-MIR1')]; BS.G.p.player.reserve.n=6; BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").nth(0).click(); pg.wait_for_timeout(200)
        pg.locator("#modal-actions .modal-btn",has_text='Set as Burst').click(); pg.wait_for_timeout(250)
        t=_o("[...document.querySelectorAll('.burst-area')].map(e=>e.innerText.replace(/\\s+/g,' '))")
        chk(T+'your area shows sleeve + SET',_o("!!document.querySelectorAll('.burst-area')[1].querySelector('.ba-card.set-burst')") and 'SET' in t[1] and 'EMPTY' not in t[1],t)
        chk(T+'CPU area still EMPTY','EMPTY' in t[0])
        # second set same turn is blocked (burst or mirage)
        pg.locator("#view-playmat .hand-area .tcg-card").nth(0).click(); pg.wait_for_timeout(200)
        txt=modal(); chk(T+'Mirage can still be set after a Burst this turn (official: both fit in the Burst Area)','Set as Mirage' in txt and 'already' not in txt,txt[:120])
        pg.locator("#modal-actions .modal-btn",has_text='Cancel').click()
        # next turn: mirage replaces burst (old to trash)
        pg.evaluate("BS.G.p.player.burstSetThisTurn=false")
        pg.locator("#view-playmat .hand-area .tcg-card").nth(0).click(); pg.wait_for_timeout(200)
        chk(T+'Mirage button with cost',pg.locator("#modal-actions .modal-btn",has_text='Set as Mirage (Pay 2)').count()==1,modal()[:150])
        pg.locator("#modal-actions .modal-btn",has_text='Set as Mirage').click(); pg.wait_for_timeout(300)
        r=_o("({b:BS.G.p.player.mirage&&BS.G.p.player.mirage.id,m:BS.G.p.player.mirage&&BS.G.p.player.mirage.mirage,kb:BS.G.p.player.burst&&BS.G.p.player.burst.id,tr:BS.G.p.player.trash.map(c=>c.id),res:BS.G.p.player.reserve.n,hand:BS.G.p.player.hand.length})")
        chk(T+'mirage set face up, the Burst stays set, cost paid',r['b']=='TST-MIR1' and r['m'] and r['kb']=='TST-BST1' and r['tr']==[] and r['res']==4 and r['hand']==0,r)
        chk(T+'mirage area shows card face + SET',_o("!!document.querySelectorAll('.burst-area')[1].querySelector('.ba-card.set-mirage .cface')") and 'SET' in _o("document.querySelectorAll('.burst-area')[1].innerText"))
        chk(T+'invariants',_o(INV)=='ok',_o(INV))
        # tap area opens detail with button
        pg.locator(".burst-area").nth(1).click(); pg.wait_for_timeout(200)
        chk(T+'area tap shows Mirage + details button','Mirage set face up' in modal() and 'Card Info' in modal(),modal()[:100])
        pg.locator("#modal-actions .modal-btn",has_text='Full Card').click(); pg.wait_for_timeout(200)
        chk(T+'details open',('Timing' in modal()) or 'Mirage Wisp' in modal(),modal()[:60])
        pg.locator("#modal-actions .modal-btn",has_text='Close').click()
        # mirage must not fire as burst when life decreases
        pg.evaluate("window.A=mk('opponent','TRAIN-06',2); BS.G.p.player.spirits=[]; bal()")
        _o("(()=>{BS.G.busy=true; BS.G.active='opponent'; window.PR=BS.doBattle('opponent',BS.G.p.opponent.spirits.slice(-1)[0]).catch(e=>String(e)); return 1})()")
        pg.wait_for_timeout(2000)
        chk(T+'mirage did not trigger as Burst; life lost',_o("BS.G.p.player.mirage&&BS.G.p.player.mirage.id")=='TST-MIR1' and _o("BS.G.p.player.life")<5,_o("BS.G.p.player.life"))
        if _o("document.getElementById('action-modal').classList.contains('active')") and pg.locator("#modal-actions .modal-btn",has_text='Keep It Set').count():
            pg.locator("#modal-actions .modal-btn",has_text='Keep It Set').click(); pg.wait_for_timeout(300)   # the Burst that is still set now offers itself
        # opponent burst via CPU shows sleeve (no card name)
        pg.evaluate("BS.G.p.opponent.burst=BS.mkInst('TST-BST1'); BS.render()")
        t=_o("[...document.querySelectorAll('.burst-area')][0].innerText.replace(/\\s+/g,' ')")
        chk(T+'CPU burst: sleeve + SET, name hidden','SET' in t and 'Flame' not in t,t)
        pg.locator(".burst-area").nth(0).click(); pg.wait_for_timeout(200)
        chk(T+'CPU burst modal hides card','face down' in modal() and 'Flame' not in modal() and 'Full Card' not in modal(),modal()[:90])
        pg.locator("#modal-actions .modal-btn",has_text='Close').click()
        # pill order
        o=_o("[...document.querySelectorAll('.mobile-stats-bar')][1].innerText.replace(/\\s+/g,' ')")
        if w<768 or h<620:
            import re
            pos=[o.find(x) for x in ['LIFE','RES','HD','DECK','TR','CNT','VD','BAN']]
            chk(T+'pill order Life,Res,Hand,Deck,Trash,Count,Void,Banished (Soul State moved to its own area)',pos==sorted(pos) and min(pos)>=0,o)
        chk(T+'no BST pill / no VOID','BST' not in o and 'VOID' not in o,o)
        chk(T+'no page errors',errs==[],errs)
        pg.screenshot(path=f'/tmp/claude-0/t/b_{w}x{h}.png')
        pg.close()
    b.close()
print('FAILS',bad)
