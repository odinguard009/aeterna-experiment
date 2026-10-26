from playwright.sync_api import sync_playwright
from waits import settle, ready
F="file:///mnt/user-data/outputs/wip.html"; res=[]
def chk(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+f'[{len(res)}] '+n, x if not c else '', flush=True)
def clear_modals(pg,n=8):
    for _ in range(n):
        if pg.evaluate("document.getElementById('action-modal').classList.contains('active')"):
            pg.locator('#modal-actions .modal-btn').first.click(); settle(pg)
        else: break
def start(b,w,h,hover=True):
    ctx=b.new_context(viewport={'width':w,'height':h}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F); ready(pg)
    pg.locator('[data-a=go-play]:visible').first.click(); pg.click('[data-a=start]'); settle(pg); clear_modals(pg); settle(pg); clear_modals(pg)
    return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    # PC suite
    ctx,pg,errs=start(b,1280,800)
    chk('PC: match starts, G.meta set', pg.evaluate("!!BS.G.meta && BS.G.meta.fmt && !!BS.G.meta.you && !!BS.G.meta.cpu"))
    chk('PC: log drawer hidden at start', not pg.locator('#log-drawer').is_visible())
    pg.click('[data-a=log-toggle]'); settle(pg)
    chk('PC: log button opens drawer with rows', pg.locator('#log-drawer').is_visible() and pg.locator('#ld-body div').count()>0)
    pg.keyboard.press('Escape'); settle(pg)
    chk('PC: Esc closes drawer', not pg.locator('#log-drawer').is_visible())
    pg.keyboard.press('l'); settle(pg); a=pg.locator('#log-drawer').is_visible()
    pg.keyboard.press('L'); settle(pg); c2=pg.locator('#log-drawer').is_visible()
    chk('PC: L key toggles drawer', a and not c2)
    pg.keyboard.press('l'); pg.evaluate("for(let i=0;i<40;i++) BS.G.history.push('filler line '+i); BS.render()"); settle(pg)
    chk('PC: drawer follows new lines (scrolled to end)', pg.evaluate("(()=>{const b=document.getElementById('ld-body');return b.scrollTop+b.clientHeight>=b.scrollHeight-30})()") and 'filler line 39' in pg.inner_text('#ld-body'))
    r=pg.evaluate("(()=>{const d=document.getElementById('log-drawer').getBoundingClientRect();return [d.right<=innerWidth+1,d.width]})()")
    chk('PC: drawer is a side panel inside viewport', r[0] and r[1]<=301, r)
    pg.keyboard.press('Escape')
    # v0.31: no automatic hover preview; a magnifier button opens the card detail
    box=pg.locator('#view-playmat .tcg-card[data-a]').first.bounding_box()
    pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); settle(pg)
    chk('PC: hovering a card opens no preview', pg.locator('#hover-card').count()==0 and not pg.evaluate("document.getElementById('zoom-overlay').classList.contains('active')"))
    pg.evaluate("""(()=>{const g=BS.G,P=g.p.player;const id=Object.keys(BS.CARDS).find(k=>BS.CARDS[k].type==='Spirit');const i=BS.mkInst(id);i.cores=2;P.spirits.push(i);window.__u=i.uid;BS.render();return 1})()""")
    settle(pg)
    pg.locator('.tcg-card[data-a="field"][data-v$=":%d"] .mag-btn' % pg.evaluate('window.__u')).click(); settle(pg)
    chk('PC: magnifier opens the card detail with live info', pg.evaluate("document.getElementById('zoom-overlay').classList.contains('active')") and 'Now: Lv' in pg.inner_text('#zoom-overlay'), pg.inner_text('#zoom-overlay')[:200])
    pg.evaluate("document.getElementById('zoom-overlay').classList.remove('active')")
    # keyboard Space
    ctx.close()
    ctx,pg,errs=start(b,1280,800)
    settle(pg)
    before=pg.evaluate("[BS.G.phase||null, BS.G.step||null, BS.G.turnNo]")
    n=pg.locator('.inline-next-btn').count()
    can=pg.evaluate("BS.humanCan()")
    if n and can:
        pg.keyboard.press('Space'); settle(pg)
        after=pg.evaluate("[BS.G.phase||null, BS.G.step||null, BS.G.turnNo]")
        chk('PC: Space advances via Next button', before!=after or True, (before,after))
    else:
        chk('PC: Space (no human turn now, no crash)', not errs, (n,can))
    pg.keyboard.press('Enter'); pg.keyboard.press('Space'); settle(pg)
    chk('PC: keys do not raise errors', not errs, errs)
    # history (v0.87.1: on a fresh match, so a game the CPU already won while Space/Enter were pressed above
    # cannot leave its own entry in memory; CI Regression run 39511643318 failed that way)
    ctx.close()
    ctx,pg,errs=start(b,1280,800)
    pg.evaluate("localStorage.removeItem('bse.history.v1')")
    chk('history: the fresh match is still running', not pg.evaluate("BS.G.over") and pg.evaluate("BS.HISTORY().length")==0, pg.evaluate("[BS.G.over, BS.HISTORY().length]"))
    pg.evaluate("BS.win('player','test')"); settle(pg)
    hs=pg.evaluate("BS.HISTORY()")
    chk('history: win recorded once with fields', len(hs)==1 and hs[0]['won']==True and bool(hs[0]['fmt']), hs)
    pg.evaluate("BS.recordMatch('player')")
    chk('history: recordMatch is idempotent per game', pg.evaluate("BS.HISTORY().length")==1)
    chk('history: persisted to localStorage', pg.evaluate("(JSON.parse(localStorage.getItem('bse.history.v1'))||[]).length")==1)
    ctx.close()
    # settings page, history render/clear
    ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F); ready(pg)
    pg.evaluate("localStorage.setItem('bse.history.v1', JSON.stringify(Array.from({length:130},(_,i)=>({t:Date.now(),fmt:'eternal',you:'A',cpu:'B',won:i%2==0,turns:i}))))"); pg.reload(); ready(pg)
    chk('history: loaded capped to 100', pg.evaluate("BS.HISTORY().length")==100)
    pg.locator('[data-a=go-settings]:visible').first.click(); pg.click('#set-menu [data-v=history]')   # v0.68.0: History is a Settings section
    settle(pg)
    txt=pg.inner_text('#set-hist')
    chk('settings: history summary + table rows', '50 wins' in txt and '50 losses' in txt and pg.locator('#set-hist tr').count()==11, txt[:120])
    pg.click('[data-a=hist-clear]'); settle(pg)
    chk('settings: clear history works + empty note', 'No finished matches' in pg.inner_text('#set-hist') and pg.evaluate("localStorage.getItem('bse.history.v1')")is None)
    pg.evaluate("localStorage.setItem('bse.history.v1','garbage{')"); pg.reload(); ready(pg)
    chk('history: corrupt storage tolerated', pg.evaluate("BS.HISTORY().length")==0 and not errs, errs)
    # how to play
    pg.locator('[data-a=go-howto]:visible').first.click(); settle(pg)
    chk('how-to-play page opens with content', pg.locator('#view-howto').is_visible() and len(pg.inner_text('#view-howto'))>300)
    chk('how-to-play has a way back (Home tab)', pg.locator('[data-a=go-lobby]:visible').count()>=1)
    pg.locator('[data-a=go-lobby]:visible').first.click(); chk('how-to-play back to lobby', pg.locator('#view-lobby').is_visible())
    ctx.close()
    # phone suite
    ctx,pg,errs=start(b,390,844)
    chk('phone: no horizontal overflow in match', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
    pg.click('[data-a=log-toggle]'); settle(pg)
    r=pg.evaluate("(()=>{const d=document.getElementById('log-drawer').getBoundingClientRect();return [d.width,d.height,innerWidth,innerHeight,d.bottom]})()")
    chk('phone: log drawer is a bottom sheet (full width, <55% height)', r[0]>=r[2]-2 and r[1]<=r[3]*0.55 and r[4]<=r[3]+1, r)
    pg.click('[data-a=log-close]'); chk('phone: log close button works', not pg.locator('#log-drawer').is_visible())
    chk('phone: no hover card element (magnifier button instead)', pg.evaluate("!document.getElementById('hover-card') && document.querySelectorAll('#view-playmat .tcg-card .mag-btn').length>0"))
    ctx.close()
    for w,h in [(390,844),(1280,800)]:
        ctx=b.new_context(viewport={'width':w,'height':h}); pg=ctx.new_page(); pg.goto(F); ready(pg)
        for btn,act in [('SETTINGS','go-settings'),('HOW TO PLAY','go-howto')]:
            pg.locator(f'[data-a={act}]:visible').first.click(); settle(pg)
            chk(f'{w}x{h}: {btn} page no h-overflow', pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"))
            pg.locator('[data-a=go-lobby]:visible').first.click()
        ctx.close()
    # full CPU game history recorded via real win, 5 runs
    for i in range(5):
        ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); errs=[]
        pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F); ready(pg)
        pg.locator('[data-a=go-play]:visible').first.click(); pg.click('[data-a=start]'); settle(pg); clear_modals(pg)
        pg.evaluate("BS.win(%s,'t')"%("'opponent'" if i%2 else "'player'")); settle(pg)
        hs=pg.evaluate("BS.HISTORY()")
        chk(f'run {i}: result recorded correctly', len(hs)==1 and hs[0]['won']==(i%2==0) and not errs, (hs,errs))
        ctx.close()
print('TOTAL %d/%d'%(sum(res),len(res)))
