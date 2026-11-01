from waits import settle, ready  # v0.87.0 (F5): state waits instead of fixed times
# v0.20 Magic with separate Main / Flash effects, alternative cost (Wurm Draw). Every chk() is one numbered test.
src = open('/tmp/claude-0/t4/mitra_tests.py', encoding='utf-8').read()
exec(src.split("MITRA_FX =")[0])
def run(pg, js, ms=700):
    pg.evaluate("(()=>{window.pr=(async()=>{" + js + "})().catch(e=>console.error(e));return 1})()"); settle(pg)
S = "window.P=BS.G.p.player;window.O=BS.G.p.opponent;BS.G.active='player';BS.G.step=4;window.wd=put('player','hand','BS75-074');"
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh(extra=''):
        pg, errs, _ = new_page(b); ev(pg, S + extra); return pg, errs
    pg, errs = fresh()
    chk('data: Wurm Draw has Main and Flash effects plus an alternative cost', ev(pg, "(()=>{const c=BS.CARDS['BS75-074'];return c.magic.by.MAIN.effect==='REVEAL_ADD'&&c.magic.by.FLASH.effect==='BP_PLUS_MATCH'&&c.costAlt.cost===3&&c.implemented===true})()"))
    chk('magicFx returns the right effect per timing', ev(pg, "BS.magicFx(BS.CARDS['BS75-074'],'main').effect==='REVEAL_ADD'&&BS.magicFx(BS.CARDS['BS75-074'],'flash').effect==='BP_PLUS_MATCH'"))
    base = "{id:'X-1',name:'X',type:'Magic',color:'red',cost:2,levels:[],magic:%s}"
    def bad(js, exp, label):
        r = pg.evaluate("BS.parseCard(" + js + ")"); chk('reject: ' + label, bool(r.get('errors')) and exp in ' '.join(r['errors']), r.get('errors'))
    bad(base % "{timing:['MAIN'],by:{MAIN:{effect:'NOPE'}}}", 'unknown', 'unknown effect in by')
    bad(base % "{timing:['MAIN','FLASH'],by:{MAIN:{effect:'DRAW',value:1}}}", 'every timing', 'by missing a timing')
    bad(base % "{timing:['MAIN'],by:{LATE:{effect:'DRAW',value:1}}}", 'magic.by', 'bad by key')
    bad("{id:'X-1',name:'X',type:'Magic',color:'red',cost:2,levels:[],costAlt:{cost:'a'}}", 'costAlt', 'bad costAlt')
    ok = pg.evaluate("BS.parseCard(" + base % "{timing:['MAIN'],by:{MAIN:{effect:'DRAW',value:2,if:{lifeGe:2}}}}" + ")")
    chk('accept a valid by + condition', ok.get('card') and ok['card']['magic']['by']['MAIN']['value'] == 2, ok.get('errors'))
    # cost
    chk('cost 5 without a Wurm', ev(pg, "BS.effCost(P,BS.CARDS['BS75-074'])===5"))
    ev(pg, "window.w=mk('player','BS75-CX01',1)")
    chk('cost 3 (minus 1 red reduction from the Siegwurm symbol = 2) while controlling a Wurm', ev(pg, "BS.costAltActive(P,BS.CARDS['BS75-074'])&&BS.effCost(P,BS.CARDS['BS75-074'])===2"))
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');")
    chk('cost 3 when the Wurm is in Soul State', ev(pg, "BS.effCost(P,BS.CARDS['BS75-074'])===3"))
    # Main cast
    pg, errs = fresh()
    chk('Main: not usable without a Siegwurm', ev(pg, "!BS.magicUsable(P,wd,'main')"))
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');window.d1=put('player','deck','BS75-001');window.d2=put('player','deck','BS75-CX01');window.d3=put('player','deck','TRAIN-01');window.d4=put('player','deck','TRAIN-02');window.d5=put('player','deck','TRAIN-03');window.t0=P.trash.length;")
    chk('Main: usable with a Siegwurm in Soul State', ev(pg, "BS.magicUsable(P,wd,'main')"))
    ev(pg, "window.r0=P.reserve.n")
    run(pg, "BS.castMagic(P,{inst:wd,target:null,plan:null,ctx:'main'});", 400)
    chk('Main: cost 3 paid (Siegwurm in Soul State counts as a Wurm)', ev(pg, "r0-P.reserve.n===3"), ev(pg, "[r0,P.reserve.n]"))
    chk('Main: reveals 3, adds one Crimson and one Wurm card at most (Goradon + Siegwurm)', ev(pg, "P.hand.length===2&&P.hand.includes(d1)&&P.hand.includes(d2)&&inv()==='ok'"), ev(pg, "[P.hand.map(x=>x.id),inv()]"))
    chk('Main: the third revealed card is discarded, deck keeps 2, Wurm Draw in the Trash', ev(pg, "P.trash.includes(d3)&&P.deck.length===2&&P.trash.includes(wd)"))
    ev(pg, "window.w2=put('player','hand','BS75-074')")
    chk('Alternative cost is once per turn: a second copy costs 5', ev(pg, "BS.effCost(P,BS.CARDS['BS75-074'])===5"))
    ev(pg, "BS.G.turnNo++")
    chk('Alternative cost is available again next turn', ev(pg, "BS.effCost(P,BS.CARDS['BS75-074'])===3"))
    # duplicates
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');window.d1=put('player','deck','BS75-CX01');window.d2=put('player','deck','TRAIN-01');window.d3=put('player','deck','TRAIN-02');")
    run(pg, "BS.castMagic(P,{inst:wd,target:null,plan:null,ctx:'main'});", 400)
    chk('Main: one card matching two keywords is added only once', ev(pg, "P.hand.length===1&&P.hand[0]===d1&&inv()==='ok'"), ev(pg, "[P.hand.length,inv()]"))
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');put('player','deck','TRAIN-01');put('player','deck','TRAIN-02');")
    run(pg, "BS.castMagic(P,{inst:wd,target:null,plan:null,ctx:'main'});", 400)
    chk('Main: nothing matching -> all three go to the Trash, no errors', ev(pg, "P.hand.length===0&&P.deck.length===0&&inv()==='ok'") and not errs, errs)
    # Flash
    pg, errs = fresh("window.w=mk('player','BS75-CX01',1);window.ot=mk('player','TRAIN-01',1);")
    chk('Flash: usable with a Wurm Spirit; targets only matching Spirits', ev(pg, "BS.magicUsable(P,wd,'flash')&&BS.magicTargets(P,wd,'flash').length>=1&&!BS.magicTargets(P,wd,'flash').includes(ot)"), ev(pg, "BS.magicTargets(P,wd,'flash').map(x=>x.id)"))
    pg, errs = fresh("window.w=mk('player','BS75-CX01',1);window.bp0=BS.bpOf(w);")
    run(pg, "BS.castMagic(P,{inst:wd,target:w,plan:null,ctx:'flash'});", 400)
    chk('Flash: +5000 BP to the Wurm, no card revealed', ev(pg, "BS.bpOf(w)===bp0+5000&&P.hand.length===0&&inv()==='ok'"), ev(pg, "[BS.bpOf(w),bp0]"))
    pg, errs = fresh("window.ot=mk('player','TRAIN-01',1);")
    chk('Flash: unusable with only non-Wurm Spirits', ev(pg, "!BS.magicUsable(P,wd,'flash')"))
    # v0.51.1: check the rendered effect text only (the old check also matched the uncompressed pack inside the page source)
    chk('magicText shows both effects', ev(pg, "/\\(Main\\)[\\s\\S]*reveal[\\s\\S]*\\(Flash\\)[\\s\\S]*\\+5000/i.test(BS.effectTextHTML(BS.CARDS['BS75-074'],true).replace(/<[^>]+>/g,''))"))
    # CPU
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');for(let i=0;i<10;i++)put('player','deck',i%2?'BS75-001':'TRAIN-01');")
    run(pg, "await BS.cpuCastMain(P);", 900)
    chk('CPU Main step casts Wurm Draw when it can (Siegwurm in Soul State)', ev(pg, "P.trash.includes(wd)&&P.hand.length>=1&&inv()==='ok'") and not errs, [errs, ev(pg, "[P.trash.length,P.hand.length]")])
    pg, errs = fresh("for(let i=0;i<10;i++)put('player','deck','TRAIN-01');")
    run(pg, "await BS.cpuCastMain(P);", 500)
    chk('CPU does not cast Wurm Draw without a Siegwurm', ev(pg, "P.hand.includes(wd)"))
    # CPU flash
    pg, errs = fresh("window.w=mk('player','BS75-CX01',1);window.fb=mk('opponent','BS75-011',2);BS.G.active='opponent';")
    r = ev(pg, "(()=>{const c=BS.cpuFlashChoice(P,'opponent',fb,w);return c?{ctx:c.ctx,t:c.target===w}:null})()")
    chk('CPU Flash: uses Wurm Draw to win a lost block (5000 vs 8000 BP -> +5000)', r and r['ctx'] == 'flash' and r['t'], r)
    # human UI
    pg, errs = fresh("window.sg=put('player','soulState','BS75-CX01');for(let i=0;i<5;i++)put('player','deck','BS75-001');P.cpu=false;BS.G.busy=false;BS.render();")
    run(pg, "await humanCast(wd);", 900)
    chk('human Main cast works end to end (no prompt needed), 1 Crimson added', ev(pg, "P.hand.length===1&&P.trash.includes(wd)&&inv()==='ok'"), ev(pg, "[P.hand.length,P.trash.length,inv()]"))
    chk('V1: no page errors', not errs, errs)
print('TOTAL %d/%d' % (sum(res), len(res)))
