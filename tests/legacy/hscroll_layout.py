from playwright.sync_api import sync_playwright
import time,base64,random
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
art="data:image/png;base64,"+base64.b64encode(open('/tmp/claude-0/t/art.png','rb').read()).decode()
def act(pg): return pg.evaluate("document.getElementById('action-modal').classList.contains('active')")
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h,t) in [(390,844,'mob'),(360,640,'small'),(844,390,'land'),(820,1180,'tab'),(1280,800,'pc'),(1920,1080,'fhd')]:
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.on("console",lambda m: errs.append(m.text[:150]) if m.type=='error' else None)
        pg.goto(F)
        ov=lambda: pg.evaluate("document.documentElement.scrollWidth-innerWidth")
        chk(t+' lobby no hscroll',ov()<=1,ov())
        for v in ['go-deck','go-lib']:
            pg.locator(f"[data-a={v}]:visible").first.click(); time.sleep(.2)
            chk(t+' '+v+' no hscroll',ov()<=1,ov())
            if v=='go-deck':
                pg.locator('[data-a=dbcard] [data-a=dbinfo]').first.click(); time.sleep(.2)
                chk(t+' deck detail has thumb',pg.locator('.art-thumb').count()==1)
                pg.evaluate("(a)=>{for(const id of Object.keys(BS.CARDS)) BS.IMG[id]=a}",art)
                pg.locator("#modal-actions .modal-btn",has_text='Close').click()
                pg.locator('[data-a=dbcard] [data-a=dbinfo]').first.click(); time.sleep(.2)
                pg.locator('.art-thumb').click(); time.sleep(.2)
                r=pg.evaluate("(()=>{const e=document.querySelector('#zoom-overlay .zc-card').getBoundingClientRect(),i=document.querySelector('#zoom-overlay .zc-close').getBoundingClientRect();return [e.top>=0,i.bottom<=innerHeight+1,e.width]})()")
                chk(t+' zoom fits viewport',r[0] and r[1],r)
                pg.mouse.click(5,5); time.sleep(.2)
                chk(t+' zoom closes on backdrop',not pg.evaluate("document.getElementById('zoom-overlay').classList.contains('active')"))
                pg.locator("#modal-actions .modal-btn",has_text='Close').click()
                pg.evaluate("for(const k of Object.keys(BS.IMG)) delete BS.IMG[k]")
            pg.evaluate("document.getElementById('view-deckbuilder').classList.contains('active')&&innerWidth<900&&BS.dbSheet('menu')"); pg.locator("[data-a=go-decks]:visible").first.click(); time.sleep(.2)   # v0.119.0: the deck builder menu now has Back to My decks (not Back to Lobby); nav Play is used next
        pg.click('[data-a=go-play]'); pg.click('[data-a=start]')
        for _ in range(40):
            time.sleep(.15)
            ti=pg.inner_text("#modal-card-title") if act(pg) else ''
            if 'Coin' in ti or 'you win' in ti: pg.locator('#modal-actions .modal-btn').first.click()
            elif 'Starting' in ti: break
        r=pg.evaluate("(()=>{const m=document.querySelector('#action-modal .modal-box').getBoundingClientRect();return [m.top>=-1,m.bottom<=innerHeight+1, document.querySelector('#action-modal .modal-box').scrollHeight>document.querySelector('#action-modal .modal-box').clientHeight]})()")
        chk(t+' mulligan modal fits/scrolls',r[0] and (r[1] or r[2]),r)
        pg.locator("#modal-actions .modal-btn",has_text='Keep').click()
        for _ in range(60):
            time.sleep(.2)
            if pg.evaluate("BS.humanCan()") and pg.evaluate("BS.G.step")==4: break
        # spam next
        for _ in range(6):
            try: pg.click(".inline-next-btn",timeout=500,force=True)
            except Exception: pass
            time.sleep(.05)
        chk(t+' board no hscroll',ov()<=1,ov())
        # next button fully visible
        r=pg.evaluate("(()=>{const e=document.querySelector('.inline-next-btn').getBoundingClientRect();return [e.left>=0,e.right<=innerWidth,e.top>=0,e.bottom<=innerHeight]})()")
        chk(t+' next visible',all(r),r)
        r=pg.evaluate("(()=>{const e=document.querySelector('.hand-area').getBoundingClientRect();return [e.bottom<=innerHeight+1,e.height]})()")
        chk(t+' hand visible',r[0] and r[1]>30,r)
        chk(t+' no errors',not errs,errs[:2])
        pg.close()
print('FAILS',bad)
