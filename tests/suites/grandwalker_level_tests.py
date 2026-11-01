from waits import settle, ready  # v0.87.0 (F5): state waits instead of fixed times
# v0.22: Lv of a Contract Grandwalker Nexus is decided by the Count (official Eternal rule). Every chk() is one numbered test.
import json as _json_c, os as _os_c  # counts come from the card data, so a new colour needs no edit here
_CARDS = _json_c.load(open(_os_c.path.join(_os_c.path.dirname(_os_c.path.abspath(__file__)), '..', '..', 'build', 'all-cards.json'), encoding='utf-8'))
PACK_N = len(_CARDS); CONTRACTORS = sorted(c['id'] for c in _CARDS if c['type'] == 'Nexus' and '-CX' in c['id'] and 'Grandwalker' in c.get('families', []))   # Contractor Grandwalkers only: the BS76/BS77 CX Flagbearers (family Flag) are not Count-level
src = open('/tmp/claude-0/t4/mitra_tests.py', encoding='utf-8').read()
exec(src.split("MITRA_FX =")[0])
def run(pg, js, ms=700):
    pg.evaluate("(()=>{window.pr=(async()=>{" + js + "})().catch(e=>console.error(e));return 1})()"); settle(pg)
S = "window.P=BS.G.p.player;window.O=BS.G.p.opponent;BS.G.active='player';BS.G.step=4;"
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh(extra=''):
        pg, errs, _ = new_page(b); ev(pg, S + extra); return pg, errs
    pg, errs = fresh()
    chk('countLv flag: exactly the Contractor Grandwalker Nexuses (Nexus cards with a CX number)', sorted(ev(pg, "Object.values(BS.CARDS).filter(c=>c.countLv).map(c=>c.id)")) == CONTRACTORS)
    chk('ordinary Nexuses (Temple, Air Fortress, Crater) stay core-based', ev(pg, "!BS.CARDS['BS74-072'].countLv&&!BS.CARDS['BS75-061'].countLv&&!BS.CARDS['BS75-063'].countLv"))
    ev(pg, "window.mi=mk('player','BS74-CX03',5)")
    chk('Mitra with 5 cores but Count 0 is still Lv1', ev(pg, "P.count===0&&BS.lvIndex(mi)===0"))
    ev(pg, "P.count=1;P.made++")
    chk('Count 1: Lv1', ev(pg, "BS.lvIndex(mi)===0"))
    ev(pg, "P.count=2;P.made++")
    chk('Count 2: Lv2', ev(pg, "BS.lvIndex(mi)===1"))
    pg, errs = fresh("window.mi=mk('player','BS74-CX03',0);P.count=2;P.made+=2;")
    chk('Mitra with 0 cores and Count 2 is Lv2', ev(pg, "BS.lvIndex(mi)===1&&inv()==='ok'"))
    ev(pg, "P.made-=2;P.count=0;")
    chk('the Lv drops again when the Count drops', ev(pg, "BS.lvIndex(mi)===0"))
    pg, errs = fresh("window.mi=mk('player','BS74-CX03',3);P.count=0;")
    chk('Contract Skill (Lv2 Flash) is not available at Count 0 even with 3 cores', ev(pg, "BS.activatable(P,mi,'FLASH').every(x=>x.e.cost==null)"))
    ev(pg, "P.count=2;P.made+=2;window.tg=put('player','soulState','BS74-041');")
    chk('Contract Skill becomes available at Count 2 with 3 cores', ev(pg, "BS.activatable(P,mi,'FLASH').some(x=>x.e.cost&&x.e.cost.nexusToVoid===3)"))
    run(pg, "const a=BS.activatable(P,mi,'FLASH').find(x=>x.e.cost); await BS.activateFx(P,mi,a.idx);", 800)
    chk('Contract Skill paid 3 cores to the Void (+1 from Neo-Core Charge on the summon) and the Lv stays (Count based)', ev(pg, "mi.cores===1&&P.void>=3&&BS.lvIndex(mi)===1&&inv()==='ok'"), ev(pg, "[mi.cores,P.void,BS.lvIndex(mi),inv()]"))
    pg, errs = fresh("window.mi=mk('player','BS74-CX03',0);window.ad=put('player','hand','BS74-038');")
    chk('Contract Field (Lv1-2) works at Count 0 (Lv1)', ev(pg, "BS.activatable(P,mi,'MAIN').some(x=>x.e.timing.includes('FLASH'))||BS.activatable(P,mi,'FLASH').length>=1"))
    # other Contractor nexuses
    pg, errs = fresh("window.z=mk('player','BS71-CX01',0);window.br=mk('player','SD69-CX01',0);window.lu=mk('player','BS72-CX01',0);window.om=mk('player','BS74-CX01',0);P.count=3;P.made+=3;")
    chk('Count 3: Lugh and Ometeotl (Count 2) Lv2; Brahma (Count 4) and Zeus (Count 6) Lv1', ev(pg, "BS.lvIndex(lu)===1&&BS.lvIndex(om)===1&&BS.lvIndex(br)===0&&BS.lvIndex(z)===0"))
    ev(pg, "P.count=4;P.made++")
    chk('Count 4: Brahma Lv2, Zeus still Lv1', ev(pg, "BS.lvIndex(br)===1&&BS.lvIndex(z)===0"))
    ev(pg, "P.count=6;P.made+=2")
    chk('Count 6: Zeus Lv2', ev(pg, "BS.lvIndex(z)===1"))
    chk('the Count of the opponent does not matter', ev(pg, "(()=>{O.count=9;O.made+=9;P.count=0;P.made-=6;return BS.lvIndex(z)===0&&BS.lvIndex(om)===0})()"))
    # ordinary nexus
    pg, errs = fresh("window.tp=mk('player','BS74-072',1);P.count=0;")
    chk('an ordinary Nexus still levels up by cores', ev(pg, "BS.lvIndex(tp)===1"))
    # counter effect changes Lv live
    pg, errs = fresh("window.mi=mk('player','BS74-CX03',0);window.mx=put('player','hand','BS74-038');")
    run(pg, "await BS.activateFx(P,mi,2);", 700)
    chk('Contract Field counter +2 raises Mitra to Lv2 at once', ev(pg, "P.count===2&&BS.lvIndex(mi)===1&&inv()==='ok'"), ev(pg, "[P.count,BS.lvIndex(mi),inv()]"))
    # UI texts
    chk('detail text shows the Count requirement', ev(pg, "BS.cardDetailHTML(BS.CARDS['BS74-CX03']).includes('Count 2')"))
    chk('magnifier detail of the field card shows live Lv from the Count', ev(pg, "BS.liveStatusHTML(mi).includes('Now: Lv2')"))
    chk('detail page level list says Count', ev(pg, "(()=>{BS.render();return typeof showCardDetail==='function'})()") and ev(pg, "cardDetailHTML(BS.CARDS['BS74-CX03']).includes('Count 2')"))
    chk('V22 no page errors', not errs, errs)
print('TOTAL %d/%d' % (sum(res), len(res)))
