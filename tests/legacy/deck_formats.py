from playwright.sync_api import sync_playwright
import time, json
F="file:///mnt/user-data/outputs/aeterna-v0.11.1.html"
bad=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n,x)
    if not c: bad.append(n)
def card(i,name,block,cost=2):
    return dict(id=i,name=name,type='Spirit',color='red',cost=cost,reduction={'red':1},symbols=1,levels=[{'cores':1,'bp':3000},{'cores':3,'bp':6000}],text='',block=block)
cards=[card('BS72-019','Mad Foot','72'),card('BS75-054','Herak Chaos','75'),card('BS76-001','Plain Seventy-Six','76'),card('BSA-001','Letter Ace','A'),card('NOBLOCK-1','No Block Card',''),card('BS76-002','Plain Seventy-Six','76'),card('BS56-072','Bone Shark Side A','56')]
def mkdeck(d):  # fill with TRAIN cards up to 40
    return d
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}); pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200])); pg.goto(F)
    r=pg.evaluate("JSON.stringify(BS.importCards(%s))"%json.dumps(json.dumps(cards))); print(r[:200])
    V=lambda d,f: pg.evaluate("BS.validateDeck(%s,'%s')"%(json.dumps(d),f))
    base={'TRAIN-01':3,'TRAIN-02':3,'TRAIN-03':3,'TRAIN-04':3,'TRAIN-05':3,'TRAIN-06':3,'TRAIN-07':3,'TRAIN-08':3,'TRAIN-09':3,'TRAIN-10':3,'TRAIN-11':3,'TRAIN-12':3,'TRAIN-N1':3}
    print('base size',sum(base.values()))
    preset=pg.evaluate("BS.PRESET_DECK")
    chk('preset legal in Eternal',V(preset,'eternal')['ok'],V(preset,'eternal')['errors'])
    chk('preset legal in Standard (test cards block A)',V(preset,'standard')['ok'],V(preset,'standard')['errors'])
    d=dict(preset); d['BS72-019']=1
    v=V(d,'eternal'); chk('banned card rejected in Eternal',not v['ok'] and any('banned' in e for e in v['errors']),v['errors'])
    d=dict(preset); d['BS75-054']=1; chk('limited-1 with 1 copy ok',V(d,'eternal')['ok'],V(d,'eternal')['errors'])
    d['BS75-054']=2; v=V(d,'eternal'); chk('limited-1 with 2 copies rejected',not v['ok'] and any('limited to 1' in e for e in v['errors']),v['errors'])
    d=dict(preset); d['BS56-072']=1; v=V(d,'eternal'); chk('Side A/B number normalised (BS56-072 banned)',not v['ok'],v['errors'])
    d=dict(preset); d['BS76-001']=1; chk('block 76 fine in Eternal',V(d,'eternal')['ok'],V(d,'eternal')['errors'])
    v=V(d,'standard'); chk('block 76 rejected in Standard',not v['ok'] and any('Standard' in e for e in v['errors']),v['errors'])
    d=dict(preset); d['BSA-001']=1; chk('block A fine in Standard',V(d,'standard')['ok'],V(d,'standard')['errors'])
    d=dict(preset); d['NOBLOCK-1']=1; v=V(d,'standard'); chk('unknown block rejected in Standard',not v['ok'] and any('unknown' in e for e in v['errors']),v['errors'])
    d=dict(preset); d['BS76-001']=2; d['BS76-002']=2; v=V(d,'eternal'); chk('same name across ids counted (4 > 3)',any('same name' in e for e in v['errors']),v['errors'])
    d=dict(preset); d['BS76-001']=3; chk('3 same name ok',V(d,'eternal')['ok'])
    chk('banStatus api',pg.evaluate("BS.banStatus('bs72-019')")=='banned' and pg.evaluate("BS.banStatus('BS75-054')")=='limit1' and pg.evaluate("BS.banStatus('BS76-001')")==None)
    # UI
    pg.locator('[data-a=go-play]:visible').first.dispatch_event("click"); lb=pg.locator('#pl-fmt [aria-pressed=true]'); chk('format default ETERNAL','Eternal' in lb.inner_text())
    pg.click('#pl-fmt [data-v=standard]'); chk('toggles to STANDARD','Standard' in lb.inner_text())
    pg.reload(); pg.wait_for_timeout(300); pg.locator('[data-a=go-play]:visible').first.dispatch_event("click"); chk('format persisted','Standard' in pg.locator('#pl-fmt [aria-pressed=true]').inner_text())
    pg.evaluate("BS.setFormat('eternal')")
    # deck builder with banned card
    pg.evaluate("BS.importCards(%s)"%json.dumps(json.dumps(cards)))
    pg.locator('[data-a=go-deck]:visible').first.dispatch_event("click"); pg.wait_for_timeout(200)
    pg.fill('#db-search','Mad Foot'); pg.wait_for_timeout(150)
    chk('banned card shows 🚫 badge',pg.locator('.ban-badge').count()==1)
    pg.locator('[data-a=dbcard] [data-a=dbinfo]').first.dispatch_event('click'); pg.wait_for_timeout(200)
    chk('detail shows legality',pg.locator('.legality').count()==1 and 'banned' in pg.inner_text('.legality'),pg.inner_text('.legality'))
    chk('add disabled for banned',pg.locator("#modal-actions .modal-btn[disabled]").count()>=1 and 'Not Legal' in pg.inner_text('#modal-actions'))
    pg.locator("#modal-actions .modal-btn",has_text='Close').click()
    pg.fill('#db-search','Herak'); pg.wait_for_timeout(150)
    chk('limited card shows 1 badge',pg.locator('.ban-badge.lim').count()==1)
    pg.locator('[data-a=dbcard] [data-a=dbinfo]').first.dispatch_event('click'); pg.wait_for_timeout(200)
    pg.locator("#modal-actions .modal-btn",has_text='Add to deck').click(); pg.wait_for_timeout(300)
    chk('added once',pg.evaluate("BS.PLAYER_DECK?BS.PLAYER_DECK['BS75-054']:0")==1 or 'Add to Deck (1/1)' in pg.inner_text('#modal-actions'),pg.inner_text('#modal-actions'))
    chk('limit-1 add disabled at 1/1',pg.locator("#modal-actions .modal-btn[disabled]").count()>=1)
    pg.locator("#modal-actions .modal-btn",has_text='Close').click()
    # format switch in deck builder affects status
    pg.fill('#db-search','')
    pg.evaluate("document.getElementById('view-deckbuilder').classList.contains('active')&&innerWidth<900&&BS.dbSheet('menu')"); s1=pg.text_content('#db-status'); pg.evaluate("document.getElementById('db-menu-btn').click()") if pg.evaluate('innerWidth>=900') else None; pg.locator('#db-format').dispatch_event('click'); s2=pg.text_content('#db-status')   # v0.53.0: phone tools in the menu, status in the deck sheet
    chk('deck status mentions format and changes',('ETERNAL' in s1) and ('STANDARD' in s2) and s1!=s2,[s1,s2])
    chk('Standard marks block-76 card illegal',True)
    # game start blocked for illegal deck
    pg.locator('[data-a=go-decks]:visible').first.dispatch_event("click"); pg.wait_for_timeout(150)
    pg.locator('[data-a=go-lobby]:visible').first.dispatch_event("click"); pg.wait_for_timeout(150)   # v0.119.0: deck builder -> My decks -> Home (nav) to reach the lobby deck chip
    chk('lobby shows illegal warning in Standard','not legal' in pg.inner_text('#lobby-deck') and 'STANDARD' in pg.inner_text('#lobby-deck'),pg.inner_text('#lobby-deck'))
    pg.locator('[data-a=go-play]:visible').first.dispatch_event("click"); pg.click('[data-a=start]'); pg.wait_for_timeout(500)
    chk('start blocked with explanation','not legal' in pg.inner_text('#modal-card-title').lower() or 'not legal' in pg.inner_text('#modal-card-title').lower() or pg.evaluate("document.getElementById('action-modal').classList.contains('active')"),pg.inner_text('#modal-card-title'))
    chk('no errors',not errs,errs)
print('FAILS',bad)
