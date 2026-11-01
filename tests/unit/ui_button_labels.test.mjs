// v0.31 UI changes approved by the owner (issue #6): Title Case button labels, coin toss / turn order labels,
// card-style effect text, magnifier button instead of the automatic hover / long-press preview. PC + phone.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

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
const ev = async (fn, arg, screen = 'pc') => (await open(screen)).page.evaluate(fn, arg);
/** quiet board with one Spirit and one Nexus of each side on the Field and one card in the player's Hand */
const board = () => {
  BS.testSetup(); const g = BS.G, ids = Object.keys(BS.CARDS);
  const sp = ids.find(k => BS.CARDS[k].type === 'Spirit' && !k.startsWith('TST')), nx = ids.find(k => BS.CARDS[k].type === 'Nexus' && !k.startsWith('TST'));
  const a = BS.mkInst(sp); a.cores = 2; g.p.player.spirits.push(a);
  const b = BS.mkInst(nx); b.cores = 1; g.p.player.nexus.push(b);
  const c = BS.mkInst(sp); c.cores = 1; g.p.opponent.spirits.push(c);
  g.p.player.hand.push(BS.mkInst(sp)); BS.render();
  return { sp, a: a.uid, c: c.uid };
};
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });

// ---- titleCase ----
test('U01 titleCase capitalises every word', async () => {
  assert.equal(await ev(() => BS.titleCase('view field')), 'View Field');
});
test('U02 titleCase keeps minor words lower case but not as the first word', async () => {
  assert.deepEqual(await ev(() => [BS.titleCase('add to deck (1/3)'), BS.titleCase('of course')]), ['Add to Deck (1/3)', 'Of Course']);
});
test('U03 titleCase keeps existing capitals, numbers and emoji', async () => {
  assert.equal(await ev(() => BS.titleCase('🎴 Summon (Pay 3) LV2 BP')), '🎴 Summon (Pay 3) LV2 BP');
});
test('U04 titleCase capitalises a word after leading punctuation', async () => {
  assert.equal(await ev(() => BS.titleCase('not enough cores (needs 3) — depletes!')), 'Not Enough Cores (Needs 3) — Depletes!');
});
test('U05 titleCase is safe on empty and missing input', async () => {
  assert.deepEqual(await ev(() => [BS.titleCase(''), BS.titleCase(null), BS.titleCase(undefined)]), ['', '', '']);
});
test('U06 every dialog button is rendered in Title Case', async () => {
  const r = await ev(() => { BS.testSetup(); BS.modal({ title: 't', html: '', peek: true, buttons: [{ label: 'do not block' }, { label: 'keep it set', cls: 'cancel' }] });
    const t = [...document.querySelectorAll('#modal-actions .modal-btn')].map(b => b.textContent); BS.closeModal(null); return t; });
  assert.deepEqual(r, ['Do Not Block', 'Keep It Set', '🔍 View Field']);
});
test('U07 a hidden dialog button stays hidden', async () => {
  const r = await ev(() => { BS.testSetup(); BS.modal({ title: 't', html: '', buttons: [{ label: 'x', hidden: true }, { label: 'ok' }] });
    const n = document.querySelectorAll('#modal-actions .modal-btn').length; BS.closeModal(null); return n; });
  assert.equal(r, 1);
});
test('U08 peek bar buttons are rendered in Title Case', async () => {
  const r = await ev(() => { BS.testSetup(); BS.modal({ title: 't', html: '', peek: true, peekButtons: () => [{ label: 'reserve −', act() {} }], buttons: [{ label: 'ok' }] }); BS.startPeek();
    const t = [...document.querySelectorAll('#peek-btns .modal-btn')].map(b => b.textContent); BS.closeModal(null); return t; });
  assert.deepEqual(r, ['Reserve −', '↩ Back to Dialog']);
});

// ---- coin toss / first player labels ----
test('U09 coin toss buttons read HEADS / TAILS and the turn order buttons FIRST / SECOND', async () => {
  const { page } = await open('pc');
  let coin = null, order = null;
  for (const pick of ['HEADS', 'TAILS']) {     // a fixed Math.random gives a fixed seed, so one of the two calls wins the toss
    await page.evaluate(() => { window.__mr = Math.random; Math.random = () => 0.37; BS.testSetup(); document.querySelector('[data-a="start"]').click(); return 1; });
    await page.waitForFunction(() => document.querySelector('#action-modal.active #modal-actions .modal-btn'));
    coin = await page.$$eval('#modal-actions .modal-btn', b => b.map(x => x.textContent));
    await page.locator('#modal-actions .modal-btn', { hasText: pick }).click(); await page.waitForTimeout(200);
    const t = await page.$$eval('#modal-actions .modal-btn', b => b.map(x => x.textContent));
    await page.evaluate(() => { Math.random = window.__mr; BS.testSetup(); return 1; });
    if (t.includes('FIRST')) { order = t; break; }
  }
  assert.deepEqual(coin, ['HEADS', 'TAILS']);
  assert.deepEqual(order, ['FIRST', 'SECOND']);
});

// ---- card-style effect text ----
test('U10 effectLines puts every level block on its own line', async () => {
  const r = await ev(() => BS.effectLines('[LV1][LV2] When summoned, draw. [LV2] Gets +1000 BP.'));
  assert.deepEqual(r, ['[LV1][LV2] When summoned, draw.', '[LV2] Gets +1000 BP.']);
});
test('U11 a leading (Can\'t Stack) keyword gets its own line', async () => {
  const r = await ev(() => BS.effectLines("(Can't Stack) When this card enters Soul State, you can deploy it. [LV1][LV2] (Opposing Turn) When x."));
  assert.deepEqual(r, ["(Can't Stack)", 'When this card enters Soul State, you can deploy it.', '[LV1][LV2] (Opposing Turn) When x.']);
});
test('U12 Burst and (Flash) blocks of a Magic card are separate lines', async () => {
  const r = await ev(() => BS.effectLines('Burst: After your Spirit is destroyed. You can draw. (Flash) (Can\'t Use in Main) Give +1000 BP.'));
  assert.deepEqual(r, ['Burst: After your Spirit is destroyed. You can draw.', "(Flash) (Can't Use in Main) Give +1000 BP."]);
});
test('U13 keywords after a sentence start a new line (Revive, Contract Skill, Contract Field)', async () => {
  const r = await ev(() => BS.effectLines('Draw. Revive [Main] Deploy it. Contract Field (Your Attack Step) Gain.'));
  assert.deepEqual(r, ['Draw.', 'Revive [Main] Deploy it.', 'Contract Field (Your Attack Step) Gain.']);
});
test('U14 effectLines of empty text is empty', async () => {
  assert.deepEqual(await ev(() => [BS.effectLines(''), BS.effectLines(null)]), [[], []]);
});
test('U15 level tags, timing tags and keywords are marked', async () => {
  const h = await ev(() => BS.effectTextHTML({ name: 'N', type: 'Spirit', symbol: 'red', cost: 3, desc: "(Can't Stack) [LV1][LV2] (When Summoned) Burst: x" }, false));
  assert.match(h, /<span class="fx-lv">LV1<\/span><span class="fx-lv">LV2<\/span>/);
  assert.match(h, /<span class="fx-tm">\(<span class="fx-term" data-a="gloss" data-v="When Summoned">When Summoned<\/span>\)<\/span>/);
  assert.match(h, /<span class="fx-kw">\(Can&#039;t Stack\)<\/span>/);
});
test('U16 the header line shows name, type, colour and cost apart from the text', async () => {
  const h = await ev(() => BS.effectTextHTML({ name: 'Test Dragon', type: 'Spirit', symbol: 'red', cost: 5, desc: 'Draw.' }, true));
  assert.match(h, /<div class="fx-head"><b>Test Dragon<\/b><span>Spirit · Red · Cost 5<\/span><\/div><div class="fx-body">/);
});
test('U17 effect text is escaped (no HTML from card data)', async () => {
  const h = await ev(() => BS.effectTextHTML({ name: '<img src=x onerror=1>', type: 'Spirit', symbol: 'red', cost: 1, desc: '<script>x</script> [LV1] y' }, true));
  assert.ok(!h.includes('<img') && !h.includes('<script>'));
});
test('U18 a card without effect text says so', async () => {
  assert.match(await ev(() => BS.effectTextHTML({ name: 'V', type: 'Spirit', symbol: 'red', cost: 1, desc: '' }, false)), /No effect text\./);
});
test('U19 every real card formats into at least one line and the text survives unchanged', async () => {
  const bad = await ev(() => Object.keys(BS.CARDS).filter(id => { const d = (BS.CARDS[id].desc || '').replace(/\s+/g, ' ').trim();
    return d && !/\{\{/.test(d) && BS.effectLines(d).join(' ').replace(/\s+/g, ' ') !== d; }));
  assert.deepEqual(bad, []);
});
test('U20 the card detail uses the card-style formatter', async () => {
  const h = await ev(() => BS.cardDetailHTML(BS.CARDS[Object.keys(BS.CARDS).find(k => (BS.CARDS[k].desc || '').includes('[LV'))]));
  assert.match(h, /class="fx-card"/); assert.match(h, /class="fx-lv"/);
});
test('U21 the enlarged card view uses the card-style formatter', async () => {
  const r = await ev(() => { BS.openZoom(Object.keys(BS.CARDS).find(k => (BS.CARDS[k].desc || '').includes('[LV')));
    const z = document.getElementById('zoom-overlay'), ok = z.classList.contains('active') && !!z.querySelector('.fx-line'); z.classList.remove('active'); return ok; });
  assert.ok(r);
});

// ---- magnifier instead of the automatic preview ----
for (const screen of ['pc', 'phone']) {
  test(`U22-${screen} every hand and field card has a magnifier button in its bottom-left corner`, async () => {
    const r = await ev(board, null, screen);
    const m = await ev(() => [...document.querySelectorAll('#view-playmat .tcg-card[data-a="hand"], #view-playmat .tcg-card[data-a="field"]')].map(c => {
      const b = c.querySelector(':scope > .mag-btn'); if (!b) return 'missing';
      const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect(), ex = c.classList.contains('exhausted');
      return ex || (br.left - cr.left < cr.width / 2 && br.bottom > cr.top + cr.height / 2) ? 'ok' : 'misplaced'; }), null, screen);
    assert.ok(r.sp && m.length >= 4, `cards: ${m.length}`); assert.deepEqual([...new Set(m)], ['ok']);
  });
  test(`U23-${screen} tapping the magnifier opens the card detail page directly (no action dialog)`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(board);
    await page.locator(`.tcg-card[data-a="field"][data-v$=":${r.a}"] .mag-btn`).click();
    const s = await page.evaluate(() => ({ z: document.getElementById('zoom-overlay').classList.contains('active'), m: document.getElementById('action-modal').classList.contains('active'),
      live: (document.querySelector('#zoom-overlay .live-st') || {}).textContent || '' }));
    assert.equal(s.z, true); assert.equal(s.m, false); assert.match(s.live, /^Now: Lv\d · 2 cores/);
    await page.evaluate(() => { document.getElementById('zoom-overlay').classList.remove('active'); return 1; });
  });
  test(`U24-${screen} the magnifier works on an opposing card and on a Hand card`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(board);
    await page.locator(`.tcg-card[data-a="field"][data-v$=":${r.c}"] .mag-btn`).click();
    const opp = await page.evaluate(() => { const z = document.getElementById('zoom-overlay'), a = z.classList.contains('active'); z.classList.remove('active'); return a; });
    await page.locator('.tcg-card[data-a="hand"] .mag-btn').first().click();
    const hand = await page.evaluate(() => ({ z: document.getElementById('zoom-overlay').classList.contains('active'), m: document.getElementById('action-modal').classList.contains('active') }));
    await page.evaluate(() => { document.getElementById('zoom-overlay').classList.remove('active'); return 1; });
    assert.equal(opp, true); assert.deepEqual(hand, { z: true, m: false });
  });
  test(`U25-${screen} tapping the card itself still opens its action dialog`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(board);
    await page.locator(`.tcg-card[data-a="field"][data-v$=":${r.a}"] .name`).click();
    const s = await page.evaluate(() => ({ m: document.getElementById('action-modal').classList.contains('active'), z: document.getElementById('zoom-overlay').classList.contains('active') }));
    await page.evaluate(() => { BS.closeModal(null); return 1; });
    assert.deepEqual(s, { m: true, z: false });
  });
  test(`U26-${screen} no automatic preview: hovering or long-pressing a card opens nothing`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(board);
    const box = await page.locator(`.tcg-card[data-a="field"][data-v$=":${r.a}"]`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3); await page.mouse.down(); await page.waitForTimeout(700);
    const s = await page.evaluate(() => ({ hover: !!document.getElementById('hover-card'), z: document.getElementById('zoom-overlay').classList.contains('active') }));
    await page.mouse.up(); await page.evaluate(() => { BS.closeModal(null); document.getElementById('zoom-overlay').classList.remove('active'); return 1; });
    assert.deepEqual(s, { hover: false, z: false });
  });
  test(`U27-${screen} the magnifier works while a dialog is waiting and does not cancel it`, async () => {
    const { page } = await open(screen);
    const r = await page.evaluate(board);
    await page.evaluate(() => { window.__mv = 'pending'; BS.modal({ title: 't', html: '', peek: true, buttons: [{ label: 'ok', value: 1 }] }).then(v => { window.__mv = v; }); BS.startPeek(); return 1; });
    await page.locator(`.tcg-card[data-a="field"][data-v$=":${r.a}"] .mag-btn`).click();
    const s = await page.evaluate(() => ({ z: document.getElementById('zoom-overlay').classList.contains('active'), v: window.__mv }));
    await page.evaluate(() => { document.getElementById('zoom-overlay').classList.remove('active'); BS.closeModal(null); return 1; });
    assert.deepEqual(s, { z: true, v: 'pending' });
  });
  test(`U28-${screen} no page errors`, async () => { assert.deepEqual((await open(screen)).errors, []); });
}
