// v0.32.1 UI change requested by the owner (review comment on v0.32.0): readable cost circle on white cards,
// symbol indicator in the bottom-right corner of Spirits (count + colour, pie for mixed colours, gold Ultimate). PC + phone.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const pages = {};
async function open(screen) {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  pages[screen] = { page, errors, ctx }; return pages[screen];
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });
const ev = async (fn, arg, screen = 'pc') => (await open(screen)).page.evaluate(fn, arg);

// test-only cards: a mixed red/white 2-symbol Spirit, a 3-symbol mixed one, an Ultimate-symbol one
const FIX = [
  { id: 'U32-MIX', name: 'Mix Test', type: 'Spirit', color: 'red', cost: 3, symbolColors: ['red', 'white'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'U32-TRI', name: 'Tri Test', type: 'Spirit', color: 'white', cost: 3, symbolColors: ['red', 'white', 'blue'], levels: [{ cores: 1, bp: 3000 }] },
  { id: 'U32-ULT', name: 'Ult Test', type: 'Spirit', color: 'red', cost: 3, symbolColors: ['ultimate'], levels: [{ cores: 1, bp: 3000 }] },
];
/** board: white Spirit + red 2-symbol Spirit + mixed + Ultimate in Hand, white Spirit exhausted on the Field, a Nexus on the Field */
const board = fix => {
  BS.importCards(JSON.stringify(fix)); BS.testSetup(); const g = BS.G, P = g.p.player;
  P.hand = ['BS74-047', 'BS75-X03', 'U32-MIX', 'U32-ULT', 'BS75-073'].map(id => BS.mkInst(id));
  const w = BS.mkInst('BS74-047'); w.cores = 1; w.exhausted = true; P.spirits = [w];
  const n = BS.mkInst('BS75-061'); n.cores = 0; P.nexus = [n]; BS.render();
  return 1;
};
const handBadges = () => [...document.querySelectorAll('[data-a="hand"]')].map(el => { const b = el.querySelector('.sym-badge'); return b ? { n: b.textContent, bg: b.style.background, title: b.title } : null; });

for (const screen of ['pc', 'phone']) {
  test(`S01-${screen} every Spirit in Hand shows a symbol badge; Magic does not`, async () => {
    await ev(board, FIX, screen);
    const b = await ev(handBadges, null, screen);
    assert.equal(b.length, 5);
    assert.ok(b.slice(0, 4).every(Boolean)); assert.equal(b[4], null);
  });
  test(`S02-${screen} badge sits in the bottom-right corner inside the card`, async () => {
    const r = await ev(() => { const el = document.querySelector('[data-a="hand"]'); el.style.transition = 'none'; el.style.transform = 'none'; const c = el.getBoundingClientRect(), b = el.querySelector('.sym-badge').getBoundingClientRect();   // v0.155.0: the PC hand is a fan (rotated cards), measure it upright
      return { dr: c.right - b.right, db: c.bottom - b.bottom, w: b.width, cw: c.width }; }, null, screen);
    assert.ok(r.dr >= 0 && r.dr <= 6 && r.db >= 0 && r.db <= 6, JSON.stringify(r));
    assert.ok(r.w >= 14 && r.w < r.cw / 2, JSON.stringify(r));
  });
  test(`S03-${screen} badge does not overlap the magnifier button`, async () => {
    const r = await ev(() => { const el = document.querySelector('[data-a="hand"]'), a = el.querySelector('.mag-btn').getBoundingClientRect(), b = el.querySelector('.sym-badge').getBoundingClientRect(); return a.right <= b.left; }, null, screen);
    assert.equal(r, true);
  });
  test(`S04-${screen} Field Spirit and Nexus both show their symbols`, async () => {
    const r = await ev(() => [...document.querySelectorAll('[data-a="field"]')].map(el => !!el.querySelector('.sym-badge')).sort(), null, screen);
    assert.deepEqual(r, [true, true]);
  });
  test(`S05-${screen} the badge turns with an exhausted Spirit (stays upright to read)`, async () => {
    const t = await ev(() => getComputedStyle(document.querySelector('.tcg-card.exhausted .sym-badge')).transform, null, screen);
    assert.notEqual(t, 'none');
  });
  test(`S06-${screen} cost number stays readable on a white card (dark outline)`, async () => {
    const r = await ev(() => { const c = document.querySelector('[data-a="hand"] .cost'), s = getComputedStyle(c); return { ts: s.textShadow, col: s.color }; }, null, screen);
    assert.ok(r.ts && r.ts !== 'none', r.ts);
    assert.equal(r.col, 'rgb(255, 255, 255)');
  });
  test(`S07-${screen} no page errors`, async () => { assert.deepEqual((await open(screen)).errors, []); });
}

test('S08 count and colour: one white symbol, two red symbols', async () => {
  await ev(board, FIX);
  const b = await ev(handBadges);
  assert.equal(b[0].n, '1'); assert.match(b[0].bg, /--color-white/);
  assert.equal(b[1].n, '2'); assert.match(b[1].bg, /--color-red/); assert.doesNotMatch(b[1].bg, /conic/);
});
test('S09 mixed colours draw a pie with one slice per symbol', async () => {
  const b = await ev(handBadges);
  assert.equal(b[2].n, '2'); assert.match(b[2].bg, /conic-gradient/);
  assert.match(b[2].bg, /--color-red[^,]*0deg 180deg/); assert.match(b[2].bg, /--color-white[^,]*180deg 360deg/);
});
test('S10 three mixed symbols: three slices of 120 degrees', async () => {
  const bg = await ev(() => { BS.G.p.player.hand = [BS.mkInst('U32-TRI')]; BS.render(); return document.querySelector('[data-a="hand"] .sym-badge').style.background; });
  assert.match(bg, /0deg 120deg/); assert.match(bg, /120deg 240deg/); assert.match(bg, /240deg 360deg/);
});
test('S11 the Ultimate symbol is gold', async () => {
  await ev(board, FIX);
  const r = await ev(() => { const el = document.querySelectorAll('[data-a="hand"]')[3].querySelector('.sym-badge'); return [el.style.background, getComputedStyle(el).backgroundColor]; });
  assert.match(r[0], /--color-ultimate/); assert.equal(r[1], 'rgb(212, 175, 55)');
});
test('S12 the badge title names the count and colours', async () => {
  const b = await ev(handBadges);
  assert.equal(b[2].title, '2 symbols: red, white'); assert.equal(b[0].title, '1 symbol: white');
});
test('S13 symbolColors sets the symbol count used by the rules', async () => {
  const r = await ev(() => [BS.CARDS['U32-MIX'].symbols, BS.CARDS['U32-TRI'].symbols, BS.CARDS['U32-ULT'].symbols]);
  assert.deepEqual(r, [2, 3, 1]);
});
test('S14 invalid symbolColors are rejected at import', async () => {
  const r = await ev(() => [['pink'], [], 'red', ['red', 'red', 'red', 'red', 'red', 'red']].map(sc => (BS.parseCard({ id: 'U32-BAD', name: 'Bad', type: 'Spirit', color: 'red', cost: 1, symbolColors: sc, levels: [{ cores: 1, bp: 1000 }] }).errors || []).some(e => /symbolColors/.test(e))));
  assert.deepEqual(r, [true, true, true, true]);
});
test('S15 cards without symbolColors keep their printed colour and count (built-in pack unchanged)', async () => {
  const r = await ev(() => [BS.CARDS['BS75-X03'].symbols, BS.CARDS['BS75-X03'].symbolColors, BS.CARDS['BS74-047'].symbols]);
  assert.deepEqual(r, [2, undefined, 1]);
});
test('S16 deck builder tile (mockup): the copy pips sit under the tile and follow the deck count', async () => {   // v0.137.0: the mockup tile has no symbol badge, only the three copy pips
  const r = await ev(() => { BS.testSetup(); document.querySelector('[data-a="go-deck"]').click();
    document.getElementById('db-in').click();
    const t = document.querySelector('#db-card-list .tile .bd i.f') && document.querySelector('#db-card-list .tile .bd i.f').closest('.tile');
    if (!t) return { found: false };
    const id = t.dataset.v, filled = t.querySelectorAll('.bd i.f').length, all = t.querySelectorAll('.bd i').length, b = t.querySelector('.bd').getBoundingClientRect(), tb = t.getBoundingClientRect();
    document.getElementById('db-in').click();
    return { found: true, ok: filled === Math.min(3, BS.PLAYER_DECK[id]) && all === 3, below: b.top >= tb.top + tb.height * 0.8 }; });
  assert.deepEqual([r.found, r.ok, r.below], [true, true, true], JSON.stringify(r));
});
test('S17 deck builder CSS keeps the copy count away from the symbol badge', async () => {
  const r = await ev(() => [...document.styleSheets].flatMap(s => [...s.cssRules]).some(x => x.selectorText === '.db-grid .tcg-card .qty-badge' && x.style.left === '2px'));
  assert.equal(r, true);
});
test('S18 screenshots of the new badges (PC + phone)', async () => {
  mkdirSync(ROOT + '/build', { recursive: true });
  for (const screen of ['pc', 'phone']) {
    await ev(board, FIX, screen);
    const buf = await (await open(screen)).page.screenshot();
    writeFileSync(`${ROOT}/build/ui32-${screen}.png`, buf);
    assert.ok(buf.length > 1000);
  }
});

// colours for later sets, Ultimate and Rebirth cards (display only until their rules exist, issue #4)
const COLS = ['red', 'purple', 'green', 'yellow', 'blue', 'white'];
const more = cols => {
  BS.importCards(JSON.stringify(cols.map(c => ({ id: 'U32-C-' + c, name: 'Col ' + c, type: 'Spirit', color: c, cost: 2, symbols: 1, levels: [{ cores: 1, bp: 2000 }] }))
    .concat([{ id: 'U32-REB', name: 'Reb Front', type: 'Spirit', color: 'green', cost: 4, rebirthTo: 'U32-REBS', levels: [{ cores: 1, bp: 4000 }] },
             { id: 'U32-REBS', name: 'Reb Side', type: 'Spirit', color: 'green', cost: 4, rebirthSide: true, levels: [{ cores: 1, bp: 6000 }] }])));
  BS.defBuiltin({ id: 'U32-ULTC', name: 'Ultimate Test', type: 'Ultimate', symbol: 'blue', cost: 6, symbols: 1, levels: [{ cores: 1, bp: 8000 }] });
  BS.testSetup(); const P = BS.G.p.player;
  P.hand = cols.map(c => BS.mkInst('U32-C-' + c)).concat(['U32-REB', 'U32-REBS', 'U32-ULTC'].map(id => BS.mkInst(id)));
  const u = BS.mkInst('U32-ULTC'); u.cores = 1; P.spirits = [u]; BS.render(); return 1;
};
const handInfo = () => [...document.querySelectorAll('[data-a="hand"]')].map(el => ({ cls: el.className, badge: el.querySelector('.sym-badge') && el.querySelector('.sym-badge').style.background, type: el.querySelector('.type-badge').textContent, mark: el.querySelector('.reb-mark') && el.querySelector('.reb-mark').title }));

test('S19 every colour gets its own badge colour; yellow is not the Ultimate gold', async () => {
  await ev(more, COLS);
  const h = await ev(handInfo);
  COLS.forEach((c, i) => assert.match(h[i].badge, new RegExp('--color-' + c)));
  const [y, g] = await ev(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--color-yellow').trim(), s.getPropertyValue('--color-ultimate').trim()]; });
  const d = [1, 3, 5].reduce((n, k) => n + Math.abs(parseInt(y.slice(k, k + 2), 16) - parseInt(g.slice(k, k + 2), 16)), 0);
  assert.ok(d > 120, `yellow ${y} too close to gold ${g} (${d})`);
});
test('S20 yellow and white badges and cost circles keep a dark outline (readable)', async () => {
  const r = await ev(() => [...document.querySelectorAll('[data-a="hand"]')].slice(3, 6).map(el => [getComputedStyle(el.querySelector('.sym-badge')).textShadow, getComputedStyle(el.querySelector('.cost')).textShadow]));
  for (const [a, b] of r) { assert.notEqual(a, 'none'); assert.notEqual(b, 'none'); }
});
test('S21 Ultimate card: gold frame ring and a cost circle split between its colour and gold', async () => {
  const r = await ev(() => { const el = [...document.querySelectorAll('[data-a="hand"]')].pop(), s = getComputedStyle(el), c = getComputedStyle(el.querySelector('.cost'));
    return [el.classList.contains('ult'), s.boxShadow, c.backgroundImage]; });
  assert.equal(r[0], true); assert.match(r[1], /rgb\(212, 175, 55\)/); assert.match(r[2], /conic-gradient/); assert.match(r[2], /rgb\(212, 175, 55\)/);
});
// rules: ETR:ultimate.basics@ad2b8a6d
test('S22 Ultimate card: its symbols are Ultimate symbols (gold), as the rule manual says (p. 39)', async () => {
  const r = await ev(() => { const b = [...document.querySelectorAll('[data-a="hand"]')].pop().querySelector('.sym-badge'); return [b.style.background, b.title]; });
  assert.match(r[0], /--color-ultimate/); assert.match(r[1], /ultimate/);
});
test('S23 Ultimate on the Field shows the same frame and badge', async () => {
  const r = await ev(() => { const el = document.querySelector('[data-a="field"]'); return [el.classList.contains('ult'), !!el.querySelector('.sym-badge')]; });
  assert.deepEqual(r, [true, true]);
});
test('S24 Rebirth card shows a flip mark; its rebirth side also gets a double frame', async () => {
  const h = await ev(handInfo), front = h[COLS.length], side = h[COLS.length + 1];
  assert.match(front.type, /↻/); assert.match(front.mark, /can flip/); assert.match(front.cls, /\breb\b/);
  assert.match(side.mark, /Rebirth side/); assert.match(side.cls, /reb-side/);
  assert.equal(await ev(() => getComputedStyle(document.querySelector('.tcg-card.reb-side')).borderTopStyle), 'double');
});
test('S25 rebirth data passes the import check; an empty rebirthTo is refused', async () => {
  const r = await ev(() => [BS.CARDS['U32-REB'].rebirthTo, BS.CARDS['U32-REBS'].rebirthSide, (BS.parseCard({ id: 'U32-X', name: 'X', type: 'Spirit', color: 'red', cost: 1, rebirthTo: ' ', levels: [{ cores: 1, bp: 1000 }] }).errors || []).some(e => /rebirthTo/.test(e))]);
  assert.deepEqual(r, ['U32-REBS', true, true]);
});
test('S26 normal cards carry no Ultimate or Rebirth styling', async () => {
  const h = await ev(handInfo);
  assert.ok(h.slice(0, COLS.length).every(x => !/\b(ult|reb|reb-side)\b/.test(x.cls) && !x.mark));
});
test('S27 no page errors after the colour / Ultimate / Rebirth boards', async () => { assert.deepEqual((await open('pc')).errors, []); });
test('S28 screenshot of colours, Rebirth and Ultimate (phone)', async () => {
  await ev(more, COLS, 'phone');
  const buf = await (await open('phone')).page.screenshot(); writeFileSync(`${ROOT}/build/ui32-more-phone.png`, buf); assert.ok(buf.length > 1000);
});

// two-colour (multicolour) cards: display only; the rules still read the main colour until issue #4
const multi = () => {
  BS.importCards(JSON.stringify([
    { id: 'U32-RW', name: 'Red White', type: 'Spirit', colors: ['red', 'white'], cost: 4, symbols: 1, levels: [{ cores: 1, bp: 4000 }] },
    { id: 'U32-RW2', name: 'Red White 2', type: 'Spirit', colors: ['red', 'white'], cost: 6, symbols: 2, levels: [{ cores: 1, bp: 6000 }] },
    { id: 'U32-BYS', name: 'Blue Yellow sym', type: 'Spirit', colors: ['blue', 'yellow'], cost: 4, symbolColors: ['blue', 'blue'], levels: [{ cores: 1, bp: 4000 }] }]));
  BS.defBuiltin({ id: 'U32-UMC', name: 'Multi Ultimate', type: 'Ultimate', symbol: 'green', colors: ['green', 'purple'], cost: 7, symbols: 1, levels: [{ cores: 1, bp: 9000 }] });
  BS.testSetup(); BS.G.p.player.hand = ['U32-RW', 'U32-RW2', 'U32-BYS', 'U32-UMC', 'BS74-047'].map(id => BS.mkInst(id)); BS.render(); return 1;
};
const cardsInfo = () => [...document.querySelectorAll('[data-a="hand"]')].map(el => { const s = getComputedStyle(el), b = el.querySelector('.sym-badge');
  return { multi: el.classList.contains('multi'), top: s.borderTopColor, right: s.borderRightColor, cost: getComputedStyle(el.querySelector('.cost')).backgroundImage, n: b && b.textContent, bg: b && b.style.background }; });

test('S29 import: a two-colour card keeps both colours; its main colour is the first', async () => {
  await ev(multi);
  assert.deepEqual(await ev(() => [BS.CARDS['U32-RW'].colors, BS.CARDS['U32-RW'].symbol]), [['red', 'white'], 'red']);
});
test('S30 import: bad colour lists are refused', async () => {
  const r = await ev(() => [['red'], ['red', 'pink'], 'red', ['red', 'white', 'blue', 'green']].map(cs => (BS.parseCard({ id: 'U32-BC', name: 'B', type: 'Spirit', colors: cs, cost: 1, levels: [{ cores: 1, bp: 1000 }] }).errors || []).some(e => /colors/.test(e)))
    .concat([(BS.parseCard({ id: 'U32-BC', name: 'B', type: 'Spirit', color: 'blue', colors: ['red', 'white'], cost: 1, levels: [{ cores: 1, bp: 1000 }] }).errors || []).some(e => /one of "colors"/.test(e))]));
  assert.deepEqual(r, [true, true, true, true, true]);
});
test('S31 frame is split between the two colours (top/left first colour, right/bottom second)', async () => {
  const h = await ev(cardsInfo);
  assert.equal(h[0].multi, true); assert.notEqual(h[0].top, h[0].right);
  assert.equal(h[4].multi, false);
});
test('S32 cost circle is split between the two colours', async () => {
  const h = await ev(cardsInfo);
  assert.match(h[0].cost, /conic-gradient/); assert.equal(h[4].cost, 'none');
});
test('S33 a two-colour symbol is one pie with both colours; the number is the symbol count', async () => {
  const h = await ev(cardsInfo);
  assert.equal(h[0].n, '1'); assert.match(h[0].bg, /--color-red[^,]*0deg 180deg/); assert.match(h[0].bg, /--color-white[^,]*180deg 360deg/);
  assert.equal(h[1].n, '2'); assert.match(h[1].bg, /conic-gradient/);
});
test('S34 printed symbol colours (symbolColors) win over the card colours', async () => {
  const h = await ev(cardsInfo);
  assert.equal(h[2].n, '2'); assert.match(h[2].bg, /--color-blue/); assert.doesNotMatch(h[2].bg, /conic|yellow/);
});
test('S35 a two-colour Ultimate splits its cost circle in both colours and gold', async () => {
  const h = await ev(cardsInfo);
  assert.match(h[3].cost, /rgb\(212, 175, 55\)/); assert.equal(h[3].multi, true);
});
test('S36 no page errors after the two-colour board; screenshot (phone)', async () => {
  assert.deepEqual((await open('pc')).errors, []);
  await ev(multi, null, 'phone');
  const buf = await (await open('phone')).page.screenshot(); writeFileSync(`${ROOT}/build/ui32-multi-phone.png`, buf);
  assert.deepEqual((await open('phone')).errors, []);
});

// v0.32.4 owner request: enlarged card view never cut off (Aegis-style: card + scrolling detail panel), effect text justified
const ZOOM_SCREENS = { pc: { width: 1366, height: 768 }, phone: { width: 390, height: 844 }, phoneLand: { width: 844, height: 390 }, small: { width: 360, height: 640 } };
for (const [name, vp] of Object.entries(ZOOM_SCREENS)) {
  test(`Z01-${name} the enlarged card view fits the screen: nothing cut off, the Close button visible`, async () => {
    const ctx = await (await getBrowser()).newContext({ viewport: vp }), page = await ctx.newPage();
    try {
      await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
      const r = await page.evaluate(() => { BS.testSetup(); BS.openZoom('BS74-CX03');
        const z = document.getElementById('zoom-overlay'), card = z.querySelector('.zc-card').getBoundingClientRect(), side = z.querySelector('.zc-side').getBoundingClientRect(), close = z.querySelector('.zc-close').getBoundingClientRect(), info = z.querySelector('.zc-info');
        return { over: z.scrollHeight - z.clientHeight, cardTop: card.top, cardBottom: card.bottom, sideTop: side.top, sideBottom: side.bottom, closeBottom: close.bottom, h: innerHeight, w: innerWidth, right: Math.max(card.right, side.right), land: z.classList.contains('land'), infoScroll: info.scrollHeight > info.clientHeight, infoOverflow: getComputedStyle(info).overflowY }; });
      assert.ok(r.over <= 1, JSON.stringify(r));
      assert.ok(r.cardTop >= 0 && r.cardBottom <= r.h + 1 && r.sideTop >= 0 && r.sideBottom <= r.h + 1 && r.closeBottom <= r.h + 1 && r.right <= r.w + 1, JSON.stringify(r));
      assert.equal(r.land, vp.width >= vp.height * 1.1);
      assert.equal(r.infoOverflow, 'auto');
    } finally { await ctx.close(); }
  });
}
test('Z02 effect lines and the placeholder card text are justified (last line left)', async () => {
  const r = await ev(() => { BS.testSetup(); BS.openZoom('BS74-CX03'); const l = getComputedStyle(document.querySelector('#zoom-overlay .fx-line')), t = getComputedStyle(document.querySelector('#zoom-overlay .ph-txt'));
    return [l.textAlign, l.textAlignLast, t.textAlign]; });
  assert.deepEqual(r, ['justify', 'left', 'justify']);
});
test('Z03 long "A/B/C" names get break points after each slash; tags stay intact', async () => {
  const r = await ev(() => { const h = document.querySelector('#zoom-overlay .fx-line').innerHTML; return [/Dragon\/<wbr>Devotee/.test(h), /<\/<wbr>/.test(h)]; });
  assert.deepEqual(r, [true, false]);
});
test('Z04 the card detail dialog uses the same justified effect text', async () => {
  const r = await ev(() => { const d = document.createElement('div'); d.innerHTML = BS.cardDetailHTML(BS.CARDS['BS74-CX03']); document.body.appendChild(d); const a = getComputedStyle(d.querySelector('.fx-line')).textAlign; d.remove(); return a; });
  assert.equal(r, 'justify');
});
test('Z05 the enlarged view closes and no page errors', async () => {
  const r = await ev(() => { document.querySelector('#zoom-overlay .zc-close').click(); return document.getElementById('zoom-overlay').classList.contains('active'); });
  assert.equal(r, false);
  assert.deepEqual((await open('pc')).errors, []);
});

// v0.32.5 owner requests: no "swipe" word (arrow kept), CPU flank mirrors the player's (VOID, RES, LIFE), CPU hand count on PC
test('L01 phone field headers keep the arrow and drop the word "swipe"', async () => {
  const r = await ev(() => { BS.testSetup(); BS.render(); return [...document.querySelectorAll('.row-header-badge span')].map(x => x.textContent); }, null, 'phone');
  assert.ok(r.includes('CPU FIELD ↔') && r.includes('YOUR FIELD ↔'), r.join('|'));
  assert.ok(!r.some(t => /swipe/i.test(t)));
});
test('L02 PC: the CPU right flank reads VOID chip, BANISHED, RES, LIFE from the top (point mirror of the player; your Void chip sits under the hand row)', async () => {
  const r = await ev(() => { BS.testSetup(); BS.render(); return [...document.querySelectorAll('.side-flank-pc')].map(f => [...f.querySelectorAll('[data-a="zone"]')].map(z => z.dataset.v)); });
  assert.deepEqual(r[1], ['opponent:void', 'opponent:removed', 'opponent:reserve', 'opponent:life']);
  assert.deepEqual(r[2], ['player:life', 'player:reserve', 'player:removed']);
});
test('L03 PC: the CPU hand count is the tag beside the CPU Nexus (v0.155.0, mockup)', async () => {
  const r = await ev(() => { BS.testSetup(); const O = BS.G.p.opponent; O.hand = ['BS74-047', 'BS74-047', 'BS74-047'].map(id => BS.mkInst(id)); BS.render();
    const p = document.querySelector('.opp-hand-pill'), n = p.closest('.nexus-row').getBoundingClientRect(), b = p.getBoundingClientRect();
    return { t: p.textContent, inside: b.left >= n.left && b.right <= n.right && b.top >= n.top - 1 && b.bottom <= n.bottom + 1, v: p.dataset.v }; });
  assert.equal(r.t, 'CPU Hand 3'); assert.ok(r.inside, JSON.stringify(r)); assert.equal(r.v, 'opponent:hand');
});
test('L04 PC: the CPU hand count follows the hand and opens the count-only zone view', async () => {
  const r = await ev(() => { BS.G.p.opponent.hand.pop(); BS.render(); const p = document.querySelector('.opp-hand-pill'); const t = p.textContent; p.click();
    const m = document.body.innerText.includes('Hand: 2 cards'); BS.closeModal(null); return [t, m]; });
  assert.deepEqual(r, ['CPU Hand 2', true]);
});
test('L05 phone: no extra CPU hand pill (the HD stat already shows it)', async () => {
  assert.equal(await ev(() => { BS.testSetup(); BS.render(); return document.querySelectorAll('.opp-hand-pill').length; }, null, 'phone'), 0);
});
test('L06 no page errors after the layout checks', async () => {
  assert.deepEqual((await open('pc')).errors, []); assert.deepEqual((await open('phone')).errors, []);
});

// v0.32.5 owner report: the Hand could not be scrolled sideways with a mouse on a narrow window (scrollbar hidden, wheel vertical)
async function narrow(width) {
  const ctx = await (await getBrowser()).newContext({ viewport: { width, height: 700 } }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.testSetup(); BS.G.p.player.hand = Array.from({ length: 12 }, () => BS.mkInst('BS74-047')); BS.render(); return 1; });
  const at = async () => page.$eval('[data-scroll="hand"]', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, sl: e.scrollLeft, max: e.scrollWidth - e.clientWidth }; });
  return { ctx, page, errors, at };
}
for (const width of [900, 700, 390]) {
  test(`H01-${width} the mouse wheel scrolls the Hand sideways`, async () => {
    const n = await narrow(width);
    try {
      const a = await n.at(); assert.ok(a.max > 0, 'hand should overflow at this width');
      await n.page.mouse.move(a.x, a.y); await n.page.mouse.wheel(0, 240); await n.page.waitForTimeout(150);
      const b = await n.at(); assert.ok(b.sl >= Math.min(100, a.max), JSON.stringify(b));
      await n.page.mouse.wheel(0, -1000); await n.page.waitForTimeout(150);
      assert.equal((await n.at()).sl, 0);
      assert.deepEqual(n.errors, []);
    } finally { await n.ctx.close(); }
  });
}
test('H02 a mouse drag scrolls the Hand and does not open the card dialog', async () => {
  const n = await narrow(700);
  try {
    const a = await n.at();
    await n.page.mouse.move(a.x, a.y); await n.page.mouse.down(); await n.page.mouse.move(a.x - 150, a.y, { steps: 6 }); await n.page.mouse.up(); await n.page.waitForTimeout(150);
    const b = await n.at();
    assert.ok(b.sl >= 140, JSON.stringify(b));
    assert.equal(await n.page.$eval('#action-modal', e => e.classList.contains('active')), false);
  } finally { await n.ctx.close(); }
});
test('H03 a plain click on a Hand card still opens its dialog', async () => {
  const n = await narrow(700);
  try {
    await n.page.click('[data-a="hand"] .name'); await n.page.waitForTimeout(150);
    assert.equal(await n.page.$eval('#action-modal', e => e.classList.contains('active')), true);
  } finally { await n.ctx.close(); }
});
test('H04 the wheel leaves the page alone when the Hand fits (no overflow)', async () => {
  const n = await narrow(1366);
  try {
    await n.page.evaluate(() => { BS.G.p.player.hand = BS.G.p.player.hand.slice(0, 3); BS.render(); return 1; });
    const a = await n.at(); assert.equal(a.max, 0);
    await n.page.mouse.move(a.x, a.y); await n.page.mouse.wheel(0, 240); await n.page.waitForTimeout(100);
    assert.equal((await n.at()).sl, 0); assert.deepEqual(n.errors, []);
  } finally { await n.ctx.close(); }
});

// v0.32.7 owner note: Nexuses (Grandwalker Nexuses too) carry symbols as well; Magic never does
test('N01 Nexus in Hand, on the Field and in the deck builder shows its symbol count and colour', async () => {
  const r = await ev(() => { BS.testSetup(); const P = BS.G.p.player; P.hand = [BS.mkInst('BS75-061'), BS.mkInst('BS74-072')]; const n = BS.mkInst('BS74-072'); n.cores = 0; P.nexus = [n]; BS.render();
    const h = [...document.querySelectorAll('[data-a="hand"] .sym-badge')].map(b => [b.textContent, b.style.background]), f = document.querySelector('[data-a="field"] .sym-badge');
    return { h, f: f && [f.textContent, f.style.background] }; });
  assert.deepEqual(r.h.map(x => x[0]), ['1', '1']); assert.match(r.h[0][1], /--color-red/); assert.match(r.h[1][1], /--color-white/);
  assert.deepEqual(r.f && r.f[0], '1');
});
test('N02 a Grandwalker Nexus shows its symbols like any Nexus', async () => {
  const gw = await ev(() => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Nexus' && /Grandwalker/i.test(BS.CARDS[k].desc || '')));
  assert.ok(gw, 'a Grandwalker Nexus in the built-in pack');
  const r = await ev(id => { BS.testSetup(); BS.G.p.player.hand = [BS.mkInst(id)]; BS.render(); const b = document.querySelector('[data-a="hand"] .sym-badge'); return b && b.textContent; }, gw);
  assert.equal(r, String(await ev(id => BS.CARDS[id].symbols, gw)));
});
test('N03 a Nexus with 0 symbols and every Magic show no badge', async () => {
  const r = await ev(() => { BS.importCards(JSON.stringify([{ id: 'U32-N0', name: 'Zero Nexus', type: 'Nexus', color: 'blue', cost: 2, symbols: 0, levels: [{ cores: 0 }] }])); BS.testSetup();
    const mags = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Magic'); BS.G.p.player.hand = ['U32-N0'].concat(mags).map(id => BS.mkInst(id)); BS.render();
    return [mags.length, document.querySelectorAll('[data-a="hand"] .sym-badge').length]; });
  assert.ok(r[0] > 0); assert.equal(r[1], 0);
});
