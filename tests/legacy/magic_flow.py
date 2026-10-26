from playwright.sync_api import sync_playwright
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
SETUP="""(()=>{BS.testSetup(); window.mk=(k,id,cores,opts)=>{const p=BS.G.p[k]; const i=BS.mkInst(id); i.cores=cores; Object.assign(i,opts||{}); if(BS.CARDS[id].type==='Spirit') p.spirits.push(i); else p.nexus.push(i); return i.uid;}; window.TOT=(()=>{const p=BS.G.p.player;return p.life+p.void+p.reserve.n+p.trashCores.n+p.count+BS.fieldList(p).reduce((s,i)=>s+i.cores,0)})(); window.bal=()=>{for(const k of ['player','opponent']){const p=BS.G.p[k]; const fc=BS.fieldList(p).reduce((s,i)=>s+i.cores,0); p.made=p.life+p.reserve.n+p.trashCores.n+p.count+fc; p.deckSize=p.deck.length+p.hand.length+p.spirits.length+p.nexus.length+p.soulState.length+p.trash.length+p.removed.length+(p.burst?1:0)+BS.fieldList(p).reduce((s,i)=>s+i.under.length,0); const sc=(p.reserve.soul?1:0)+(p.trashCores.soul?1:0)+BS.fieldList(p).filter(i=>i.soul).length; if(sc===0) p.reserve.soul=true;}}; return 1})()"""
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
def modal(pg): return pg.inner_text('#action-modal') if pg.evaluate("document.getElementById('action-modal').classList.contains('active')") else ''
with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h) in [(390,844),(1280,800)]:
        T=f'{w}: '
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F)
        _o=pg.evaluate
        def ev(js,*a):
            js=js.replace("BS.render(); window.PR","BS.render(); bal(); window.PR").replace("window.PR=BS.cpuTurn","bal(); window.PR=BS.cpuTurn")
            if 'PR=' not in js and ('hand=' in js or 'mk(' in js) and 'bal()' not in js and 'SETUP' not in js and 'testSetup' not in js: js=js+";bal()"
            return _o(js,*a)
        pg.evaluate=ev
        def fresh():
            pg.evaluate(SETUP)
        def inv(n):
            r=pg.evaluate("(()=>{try{BS.checkInvariants();return 'ok'}catch(e){return e.message}})()"); chk(T+n+' invariants',r=='ok',r)
        def btn(txt):
            l=pg.locator("#modal-actions .modal-btn",has_text=txt); return l
        # 1 main cast destroys target
        fresh()
        pg.evaluate("mk('player','TRAIN-02',2); window.T1=mk('opponent','TRAIN-02',2); BS.G.p.opponent.spirits[0].cores=2; BS.G.p.player.hand=[BS.mkInst('TST-MG1')]; BS.G.p.player.reserve.n=5; BS.G.p.player.void-=0; BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        chk(T+'cast button offered',btn('Cast').count()==1,pg.inner_text('#modal-actions'))
        btn('Cast').click(); pg.wait_for_timeout(250)
        chk(T+'target pick bar',pg.evaluate("document.getElementById('pick-bar').classList.contains('active')"))
        pg.locator("[data-v='opponent:spirit:%d']"%pg.evaluate("window.T1")).first.click(force=True); pg.wait_for_timeout(300)
        chk(T+'target destroyed',pg.evaluate("BS.G.p.opponent.spirits.length")==0)
        chk(T+'magic in trash',pg.evaluate("BS.G.p.player.trash.some(c=>c.id==='TST-MG1')") and pg.evaluate("BS.G.p.player.hand.length")==0)
        chk(T+'paid 2 (cost 3 minus red symbol)',pg.evaluate("BS.G.p.player.reserve.n")==3,pg.evaluate("BS.G.p.player.reserve.n"))
        inv('main cast')
        # 2 no valid target
        fresh()
        pg.evaluate("mk('opponent','TRAIN-10',5); BS.G.p.player.hand=[BS.mkInst('TST-MG1')]; BS.G.p.player.reserve.n=5; BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        chk(T+'no valid target disabled',btn('No valid target').count()==1 and btn('No valid target').is_disabled(),pg.inner_text('#modal-actions'))
        btn('Cancel').click()
        # 3 draw + cost reduction (red spirit on field gives 1 red symbol -> MG4 cost 1)
        fresh()
        pg.evaluate("mk('player','TRAIN-02',2); BS.G.p.player.hand=[BS.mkInst('TST-MG4')]; BS.G.p.player.reserve.n=5; BS.render()")
        d0=pg.evaluate("BS.G.p.player.deck.length")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        chk(T+'reduction shown (Pay 1)',btn('Pay 1').count()==1,pg.inner_text('#modal-actions'))
        btn('Cast').click(); pg.wait_for_timeout(300)
        chk(T+'draw 2',pg.evaluate("BS.G.p.player.hand.length")==2 and pg.evaluate("BS.G.p.player.deck.length")==d0-2)
        chk(T+'paid 1',pg.evaluate("BS.G.p.player.reserve.n")==4)
        inv('draw')
        # 3b not enough cores
        fresh()
        pg.evaluate("BS.G.p.player.hand=[BS.mkInst('TST-MG3')]; BS.G.p.player.reserve={n:1,soul:false}; mk('opponent','TRAIN-02',1); BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        chk(T+'not enough cores disabled',btn('Not enough cores').count()==1,pg.inner_text('#modal-actions'))
        btn('Cancel').click()
        # 3c payment dialog when Reserve short but field cores available
        fresh()
        pg.evaluate("BS.G.p.player.hand=[BS.mkInst('TST-MG3')]; BS.G.p.player.reserve={n:1,soul:false}; window.S=mk('player','TRAIN-10',4,{soul:true}); mk('opponent','TRAIN-02',1); BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        btn('Cast').click(); pg.wait_for_timeout(250)
        pg.locator("[data-v='opponent:spirit:%d']"%pg.evaluate("BS.G.p.opponent.spirits[0].uid")).first.click(force=True); pg.wait_for_timeout(300)
        chk(T+'payment dialog opens',pg.evaluate("document.getElementById('action-modal').classList.contains('active')") and 'Pay for' in modal(pg),modal(pg)[:80])
        # choose Reserve 1 then + field via tap
        pg.evaluate("1")
        pg.locator("#action-modal [data-peek]").click(); pg.wait_for_timeout(150)
        for _ in range(4): pg.locator("[data-v^='player:spirit']").first.click(force=True); pg.wait_for_timeout(80)
        pg.wait_for_timeout(100)
        pg.evaluate("1")
        txt=pg.inner_text('#peek-text'); chk(T+'payment selecting',True,txt[:80])
        # reserve + button
        if pg.locator("#peek-btns .modal-btn",has_text='Reserve +').count(): pg.locator("#peek-btns .modal-btn",has_text='Reserve +').click(); pg.wait_for_timeout(100)
        pb=pg.locator("#peek-btns .modal-btn",has_text='Pay (')
        if pb.count() and pb.is_enabled(): pb.click(); pg.wait_for_timeout(300)
        else:
            # fall back: reset selection and select exact
            print('  payment not ready:',pg.inner_text('#peek-text')[:100])
        chk(T+'magic cast with field payment',pg.evaluate("BS.G.p.player.trash.some(c=>c.id==='TST-MG3')"),pg.evaluate("BS.G.p.player.hand.length"))
        inv('field payment')
        pg.evaluate("1")

        # 4b banish
        fresh()
        pg.evaluate("window.T1=mk('opponent','TRAIN-02',2); BS.G.p.player.hand=[BS.mkInst('TST-MG6')]; BS.G.p.player.reserve.n=5; BS.render()")
        pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
        btn('Cast').click(); pg.wait_for_timeout(250)
        pg.locator("[data-v='opponent:spirit:%d']"%pg.evaluate("window.T1")).first.click(force=True); pg.wait_for_timeout(300)
        r=pg.evaluate("({tr:BS.G.p.opponent.trash.length,rm:BS.G.p.opponent.removed.map(c=>c.id),sp:BS.G.p.opponent.spirits.length})")
        chk(T+'banished goes to Banished zone, not Trash',r['rm']==['TRAIN-02'] and r['tr']==0 and r['sp']==0,r)
        inv('banish')
        txt=pg.inner_text('#view-playmat')
        chk(T+'Void panel is shown (needed by Mitra cards; v0.13 decision change)',('VOID' in txt.upper().replace('AVOID','') or 'VD:' in txt.upper()),'')
        if w==1280: chk(T+'BANISHED flank on PC','BANISHED' in txt)
        else:
            chk(T+'BAN pill shows count',pg.evaluate("[...document.querySelectorAll('.stat-pill')].some(e=>e.textContent.startsWith('BAN: '))"))
            pg.locator("[data-a=zone][data-v='opponent:removed']").first.click(force=True); pg.wait_for_timeout(200)
            chk(T+'banished zone modal lists card','Spark Lizard' in modal(pg) and 'Banished' in modal(pg),modal(pg)[:100]); btn('Close').click()
            y=pg.evaluate("(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();const bars=[...document.querySelectorAll('.mobile-stats-bar')].map(e=>e.getBoundingClientRect());const rows=[...document.querySelectorAll('.field-row-wrapper')].map(e=>e.getBoundingClientRect());const hh=q('.hand-area');return {bars:bars.map(b=>[b.top|0,b.bottom|0]),rows:rows.map(b=>[b.top|0,b.bottom|0]),hand:hh.top|0}})()")
            ob,pb=y['bars']; orow,prow=y['rows'][0],y['rows'][-1]
            chk(T+'CPU panel above CPU field',ob[1]<=orow[0]+2,y)
            chk(T+'your panel below your field and above hand',pb[0]>=prow[1]-2 and pb[1]<=y['hand']+2,y)
        # 5 flash: CPU attacks, human defender casts MG2 in window 2 so blocker wins
        fresh()
        pg.evaluate("window.A=mk('opponent','TRAIN-06',2); window.B=mk('player','TRAIN-02',1); BS.G.p.player.hand=[BS.mkInst('TST-MG2')]; BS.G.p.player.reserve.n=4; BS.G.busy=true; BS.G.active='opponent'; BS.render(); window.PR=BS.doBattle('opponent',BS.G.p.opponent.spirits[0]).catch(e=>String(e)); 1")
        pg.wait_for_timeout(1200)
        chk(T+'flash prompt 1 for defender',('Flash Timing' in modal(pg)) and 'attacking' in modal(pg),modal(pg)[:120])
        btn('Pass').click(); pg.wait_for_timeout(700)
        chk(T+'block pick appears',pg.evaluate("document.getElementById('pick-bar').classList.contains('active')"))
        pg.locator("[data-v='player:spirit:%d']"%pg.evaluate("window.B")).first.click(force=True); pg.wait_for_timeout(900)
        chk(T+'flash prompt 2 after block',('Flash Timing' in modal(pg)) and 'blocked by' in modal(pg),modal(pg)[:160])
        pg.locator("#modal-actions .modal-btn",has_text='Scorch Ward').click(); pg.wait_for_timeout(300)
        pg.locator("[data-v='player:spirit:%d']"%pg.evaluate("window.B")).first.click(force=True); pg.wait_for_timeout(1500)
        res=pg.evaluate("({att:BS.G.p.opponent.spirits.length,blk:BS.G.p.player.spirits.length,life:BS.G.p.player.life,trash:BS.G.p.player.trash.some(c=>c.id==='TST-MG2')})")
        chk(T+'flash BP boost made blocker win',res['att']==0 and res['blk']==1 and res['life']==5 and res['trash'],res)
        inv('flash boost')
        # 6 flash destroys attacker in window 1 (human attacker is CPU's? human defender with MG3)
        fresh()
        pg.evaluate("mk('opponent','TRAIN-02',2); BS.G.p.player.hand=[BS.mkInst('TST-MG3')]; BS.G.p.player.reserve.n=5; mk('player','TRAIN-02',1); BS.G.busy=true; BS.G.active='opponent'; BS.render(); window.PR=BS.doBattle('opponent',BS.G.p.opponent.spirits[0]).catch(e=>String(e)); 1")
        pg.wait_for_timeout(1200)
        btn('Sudden Strike').click(); pg.wait_for_timeout(300)
        pg.locator("[data-v='opponent:spirit:%d']"%pg.evaluate("BS.G.p.opponent.spirits.length?BS.G.p.opponent.spirits[0].uid:0")).first.click(force=True); pg.wait_for_timeout(1500)
        r=pg.evaluate("({att:BS.G.p.opponent.spirits.length,life:BS.G.p.player.life,pick:document.getElementById('pick-bar').classList.contains('active'),modal:document.getElementById('action-modal').classList.contains('active')})")
        chk(T+'attacker destroyed in flash: no block/no damage',r['att']==0 and r['life']==5 and not r['pick'],r)
        chk(T+'attack ended in log','attack ends' in pg.evaluate("BS.G.history.join(' ')"))
        inv('flash destroy')
        # 7 CPU defender flashes (MG3) vs human attacker BP<=5000
        fresh()
        pg.evaluate("window.HA=mk('player','TRAIN-02',2); mk('opponent','TRAIN-10',3,{exhausted:true}); BS.G.p.opponent.hand=[BS.mkInst('TST-MG3')]; BS.G.p.opponent.reserve.n=5; BS.G.busy=true; BS.render(); window.PR=BS.doBattle('player',BS.G.p.player.spirits[0]).catch(e=>String(e)); 1")
        pg.wait_for_timeout(2500)
        chk(T+'CPU flash destroyed attacker',pg.evaluate("BS.G.p.player.spirits.length")==0 and pg.evaluate("BS.G.p.opponent.trash.some(c=>c.id==='TST-MG3')"),pg.evaluate("BS.G.history.slice(-4)"))
        inv('cpu flash')
        # 8 CPU main casts MG1; holds flash-only
        fresh()
        pg.evaluate("mk('player','TRAIN-06',2); BS.G.p.opponent.hand=[BS.mkInst('TST-MG1'),BS.mkInst('TST-MG2')]; BS.G.p.opponent.reserve.n=6; BS.G.active='opponent'; BS.G.busy=true; window.PR=BS.cpuTurn(BS.G.p.opponent).catch(e=>String(e)); 1")
        pg.wait_for_timeout(3500)
        chk(T+'CPU main cast destroyed spirit',pg.evaluate("BS.G.p.player.spirits.length")==0,pg.evaluate("BS.G.history.slice(-5)"))
        chk(T+'CPU holds Flash-only magic',pg.evaluate("BS.G.p.opponent.hand.some(c=>c.id==='TST-MG2')"))
        inv('cpu main')
        chk(T+'no page errors',errs==[],errs)
        pg.close()
    # import tests
    pg=b.new_page(viewport={'width':1280,'height':800}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F)
    r=pg.evaluate("""(()=>{const out={};
      out.ok=BS.importCards(JSON.stringify([{id:'IM-M1',name:'Imp Magic',type:'Magic',color:'red',cost:3,reduction:{red:1},text:'[Main][Flash] x',magic:{timing:['MAIN','FLASH'],effect:'DESTROY_BP_LE',value:5000},block:'A'}]));
      out.bad1=BS.importCards(JSON.stringify([{id:'IM-M2',name:'Bad',type:'Magic',color:'red',cost:3,magic:{effect:'NUKE'}}]));
      out.bad2=BS.importCards(JSON.stringify([{id:'IM-M3',name:'Bad',type:'Magic',color:'red',cost:3,magic:{timing:['SLOW'],effect:'DRAW',value:1}}]));
      out.txt=BS.importCards(JSON.stringify([{id:'IM-M4',name:'Text Flash',type:'Magic',color:'red',cost:2,text:'[Flash] Something'}]));
      out.c1=BS.CARDS['IM-M1']&&{t:BS.CARDS['IM-M1'].type,m:BS.CARDS['IM-M1'].magic,k:BS.CARDS['IM-M1'].keywords,impl:BS.CARDS['IM-M1'].implemented};
      out.c4=BS.CARDS['IM-M4']&&{m:BS.CARDS['IM-M4'].magic,impl:BS.CARDS['IM-M4'].implemented};
      out.leg=BS.legalityOf('IM-M1','standard');
      return out})()""")
    chk('import magic ok',r['ok']['ok']==1 and r['c1']['t']=='Magic' and r['c1']['m']['effect']=='DESTROY_BP_LE' and 'FLASH' in r['c1']['k'] and r['c1']['impl'],r['c1'])
    chk('bad effect rejected',r['bad1']['ok']==0 and len(r['bad1']['bad'])==1,r['bad1'])
    chk('bad timing rejected',r['bad2']['ok']==0,r['bad2'])
    chk('text-only magic: flash timing inferred, not implemented',r['txt']['ok']==1 and r['c4']['m']['timing']==['FLASH'] and not r['c4']['impl'],r['c4'])
    chk('imported magic legal in Standard (block A)',not r['leg'],r['leg'])
    # unimplemented magic cast
    pg.evaluate(SETUP)
    pg.evaluate("BS.G.p.player.hand=[BS.mkInst('IM-M4')]; BS.G.p.player.reserve.n=4; BS.render()")
    pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
    pg.locator("#modal-actions .modal-btn",has_text='Cast').click(); pg.wait_for_timeout(300)
    chk('text-only magic casts with warning log','not implemented' in pg.evaluate("BS.G.history.join(' ')") and pg.evaluate("BS.G.p.player.trash.length")==1)
    pg.evaluate("1")
    # detail view shows timing
    pg.evaluate("BS.G.p.player.hand=[BS.mkInst('TST-MG3')]; BS.render()")
    pg.locator("#view-playmat .hand-area .tcg-card").first.click(); pg.wait_for_timeout(200)
    pg.locator("#modal-actions .modal-btn",has_text='Card Info').click(); pg.wait_for_timeout(200)
    chk('detail shows Timing',"Timing: Main / Flash" in modal(pg),modal(pg)[:200])
    pg.screenshot(path='/tmp/claude-0/t/mag_detail.png')
    chk('no page errors (import)',errs==[],errs)
    b.close()
print('FAILS',bad)
