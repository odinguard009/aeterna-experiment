from playwright.sync_api import sync_playwright
from waits import settle, ready
F="file:///mnt/user-data/outputs/wip.html"; res=[]
def chk(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+f'[{len(res)}] '+n, x if not c else '')
with sync_playwright() as p:
    b=p.chromium.launch()
    for i,(w,h) in enumerate([(1280,800),(390,844)]*10):
        ctx=b.new_context(viewport={'width':w,'height':h}); pg=ctx.new_page(); errs=[]
        pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F); ready(pg)
        t=pg.locator('#view-lobby [data-a=go-play]:visible').first.inner_text()
        ok=('Play' in t) and not pg.locator('#view-lobby #pl-fmt').count() and not pg.locator('#view-lobby [data-a=start]').count()
        pg.locator('[data-a=go-play]:visible').first.click(); vis=pg.locator('#view-play').is_visible() and pg.locator('#pl-fmt').is_visible() and pg.locator('#view-play [data-a=start]').is_visible()
        f0=pg.inner_text('#pl-fmt [aria-pressed=true]'); pg.click('#pl-fmt [aria-pressed=false]'); f1=pg.inner_text('#pl-fmt [aria-pressed=true]')
        pg.click('#pl-fmt [aria-pressed=false]')
        pg.locator('[data-a=go-lobby]:visible').first.click(); back=pg.locator('#view-lobby').is_visible()
        pg.locator('[data-a=go-play]:visible').first.click(); pg.click('[data-a=start]'); settle(pg)
        chk(f'#{i+1} {w}x{h}: lobby shows Play only; play page has format + start; toggle works; back works; match starts', ok and vis and f0!=f1 and back and pg.locator('#view-playmat').is_visible() and not errs, [t,ok,vis,f0,f1,back,errs])
        ctx.close()
print('TOTAL %d/%d'%(sum(res),len(res)))
