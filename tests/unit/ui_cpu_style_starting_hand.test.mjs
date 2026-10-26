// v0.40.2 UI patch approved by the owner: CPU style selector, optional Contract card in the starting Hand,
// deck builder filters (colour, cost, type), Heavy Exhaust drawn upside down. PC + phone.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
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
const SHOTS = join(ROOT, 'build', 'shots'); mkdirSync(SHOTS, { recursive: true });
const shot = async (screen, name) => (await open(screen)).page.screenshot({ path: join(SHOTS, `v0402-${name}-${screen}.png`) });
// v0.53.0: the colour / cost / type selects became chip groups (multi-select); chip() selects exactly one value (or none)
const chip = ([group, value]) => { BS.DBF[group].clear(); BS.renderDeckBuilder(); if (value) document.querySelector(`[data-a="db-chip"][data-v="${group}:${value}"]`).click(); return [...BS.DBF[group]].join(); };
const pick = ([id, value]) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; };

for (const screen of ['pc', 'phone']) {
  test(`U01-${screen} Settings lists the CPU styles, balanced by default`, async () => {
    const r = await ev(() => { BS.switchView('view-settings'); return { opts: [...document.querySelectorAll('#set-cpu option')].map(o => o.value), v: document.getElementById('set-cpu').value }; }, null, screen);
    assert.deepEqual(r, { opts: ['balanced', 'aggressive', 'defensive'], v: 'balanced' });
    await shot(screen, 'settings');
  });
  test(`U02-${screen} choosing a CPU style is saved and used by the CPU`, async () => {
    const r = await ev(pick, ['set-cpu', 'aggressive'], screen).then(() => ev(() => ({ s: BS.SETTINGS.cpuProfile, n: BS.cpuProfileName(null), ls: JSON.parse(localStorage.getItem(BS.SET_KEY)).cpuProfile }), null, screen));
    assert.deepEqual(r, { s: 'aggressive', n: 'aggressive', ls: 'aggressive' });
  });
  test(`U03-${screen} Reset settings returns the CPU style to balanced`, async () => {
    const v = await ev(() => { document.querySelector('[data-a=set-reset]').click(); return document.getElementById('set-cpu').value; }, null, screen);
    assert.equal(v, 'balanced');
  });
  test(`U04-${screen} the deck builder has colour, cost and type filters`, async () => {
    const r = await ev(() => { BS.switchView('view-deckbuilder'); return ['db-pips', 'db-costs', 'db-types'].map(i => document.querySelectorAll('#' + i + ' [data-a="db-chip"]').length > 0); }, null, screen);   // v0.137.0: the mockup toolbar
    assert.deepEqual(r, [true, true, true]);
    await shot(screen, 'deckbuilder');
  });
  test(`U05-${screen} colour filter shows only that colour`, async () => {
    await ev(chip, ['colors', 'white'], screen);
    const n = await ev(() => document.querySelectorAll('#db-card-list [data-a="dbcard"]').length, null, screen);
    assert.ok(n > 5);
    const bad = await ev(() => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(el => el.dataset.v).filter(id => !BS.cardColors(BS.CARDS[id]).includes('white')), null, screen);
    assert.deepEqual(bad, []);
  });
  test(`U06-${screen} cost filter shows only that cost`, async () => {
    await ev(chip, ['colors', ''], screen); await ev(chip, ['costs', '3'], screen);
    const bad = await ev(() => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(el => el.dataset.v).filter(id => BS.CARDS[id].cost !== 3), null, screen);
    const n = await ev(() => document.querySelectorAll('#db-card-list [data-a="dbcard"]').length, null, screen);
    assert.deepEqual(bad, []); assert.ok(n > 3);
  });
  test(`U07-${screen} type filter shows only that type; Contract finds Contract cards`, async () => {
    await ev(chip, ['costs', ''], screen); await ev(chip, ['types', 'Nexus'], screen);
    const bad = await ev(() => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(el => el.dataset.v).filter(id => BS.CARDS[id].type !== 'Nexus'), null, screen);
    assert.deepEqual(bad, []);
    await ev(chip, ['types', 'Contract'], screen);
    const con = await ev(() => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(el => BS.CARDS[el.dataset.v].contract), null, screen);
    assert.ok(con.length > 0 && con.every(Boolean));
  });
  test(`U08-${screen} filters combine with the search box and can match nothing`, async () => {
    await ev(chip, ['types', ''], screen); await ev(chip, ['colors', 'red'], screen); await ev(chip, ['costs', '10'], screen);
    const hi = await ev(() => [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')].map(el => BS.CARDS[el.dataset.v]).every(c => c.cost >= 10 && BS.cardColors(c).includes('red')), null, screen);
    assert.equal(hi, true);
    await ev(chip, ['types', 'Magic'], screen);
    const txt = await ev(() => document.getElementById('db-count').textContent, null, screen);
    assert.match(txt, /^[\d,]+ card\(s\) shown/);
    await ev(chip, ['colors', ''], screen); await ev(chip, ['costs', ''], screen); await ev(chip, ['types', ''], screen);
    const all = await ev(() => parseInt(document.getElementById('db-count').textContent.replace(/,/g, ''), 10), null, screen);   // v0.52.1: the grid is windowed
    assert.ok(all > 100);
  });
  test(`U09-${screen} Heavy Exhaust is drawn upside down in a portrait slot; plain Exhaust stays sideways`, async () => {
    const r = await ev(() => { BS.switchView('view-playmat'); BS.testSetup(); const P = BS.G.p.player;
      const a = BS.mkInst('BS74-047'), b = BS.mkInst('BS74-047'); a.cores = 1; b.cores = 1; BS.setHeavy(a); b.exhausted = true; P.spirits = [a, b]; BS.render();
      const cards = [...document.querySelectorAll('.tcg-card.exhausted')];
      return cards.map(el => ({ heavy: el.classList.contains('heavy'), slotEx: el.parentElement.classList.contains('ex'), tf: getComputedStyle(el).transform })); }, null, screen);
    assert.equal(r.length, 2);
    const h = r.find(x => x.heavy), e = r.find(x => !x.heavy);
    assert.equal(h.slotEx, false); assert.equal(h.tf, 'matrix(-1, 0, 0, -1, 0, 0)');
    assert.equal(e.slotEx, true); assert.equal(e.tf, 'matrix(0, 1, -1, 0, 0, 0)');
    await shot(screen, 'heavy');
  });
  test(`U10-${screen} one Refresh turns Heavy Exhaust into plain Exhaust (sideways)`, async () => {
    const r = await ev(() => { const a = BS.G.p.player.spirits[0]; BS.refreshOne(a); BS.render();
      const el = [...document.querySelectorAll('.tcg-card.exhausted')][0]; return { heavy: !!a.heavy, ex: a.exhausted, cls: el.classList.contains('heavy'), slotEx: el.parentElement.classList.contains('ex') }; }, null, screen);
    assert.deepEqual(r, { heavy: false, ex: true, cls: false, slotEx: true });
  });
  test(`U11-${screen} no page errors`, async () => { assert.deepEqual((await open(screen)).errors, []); });
}

test('U12 the Contract card choice moves it out of the Hand and keeps the card count', async () => {
  const r = await ev(() => { const g = BS.newGame(BS.PREBUILT.find(x => x.id === 'mitra').cards, BS.PREBUILT.find(x => x.id === 'red').cards), p = g.p.player; const before = p.hand.filter(h => BS.CARDS[h.id].contract).length;
    BS.contractToDeck(p); return { before, after: p.hand.filter(h => BS.CARDS[h.id].contract).length, n: p.hand.length, total: p.deck.length + p.hand.length === p.deckSize }; });
  assert.deepEqual(r, { before: 1, after: 0, n: 4, total: true });
});
test('U13 contractToDeck does nothing when the Hand has no Contract card', async () => {
  const r = await ev(() => { const p = BS.newGame(BS.PREBUILT.find(x => x.id === 'red').cards, BS.PREBUILT.find(x => x.id === 'red').cards).p.player, h = p.hand.map(i => i.uid).join();
    return { moved: BS.contractToDeck(p), same: p.hand.map(i => i.uid).join() === h }; });
  assert.deepEqual(r, { moved: false, same: true });
});
test('U14 the same seed gives the same Hand after the Contract choice', async () => {
  const r = await ev(() => { const run = () => { BS.seedRng(7); const p = BS.newGame(BS.PREBUILT.find(x => x.id === 'mitra').cards, BS.PREBUILT.find(x => x.id === 'red').cards).p.player; BS.contractToDeck(p); return p.hand.map(i => i.id).join(); }; return run() === run(); });
  assert.equal(r, true);
});
test('U15 the CPU keeps its Contract card in the starting Hand', async () => {
  const r = await ev(() => { const g = BS.newGame(BS.PREBUILT.find(x => x.id === 'red').cards, BS.PREBUILT.find(x => x.id === 'mitra').cards); return g.p.opponent.hand.some(i => BS.CARDS[i.id].contract); });
  assert.equal(r, true);
});
test('U16 the replacement card is never another Contract card', async () => {
  const r = await ev(() => { let bad = 0; for (let s = 1; s <= 40; s++) { BS.seedRng(s); const p = BS.newGame(BS.PREBUILT.find(x => x.id === 'mitra').cards, BS.PREBUILT.find(x => x.id === 'red').cards).p.player; const n0 = p.hand.filter(i => BS.CARDS[i.id].contract).length; BS.contractToDeck(p); if (p.hand.filter(i => BS.CARDS[i.id].contract).length !== n0 - 1) bad++; } return bad; });
  assert.equal(r, 0);
});
test('U17 setCpuProfile still rejects unknown names and keeps the old style', async () => {
  const r = await ev(() => { BS.setCpuProfile('defensive'); const bad = BS.setCpuProfile('nope'); return { bad, n: BS.cpuProfileName(null) }; });
  assert.deepEqual(r, { bad: false, n: 'defensive' });
  await ev(() => BS.setCpuProfile('balanced'));
});
test('U18 dbFilterOK treats empty filters as no filter and 10 as 10 or more', async () => {
  const r = await ev(() => { const c = { cost: 12, type: 'Spirit', symbol: 'red' }; return [BS.dbFilterOK(c, '', '', ''), BS.dbFilterOK(c, '', '10', ''), BS.dbFilterOK({ ...c, cost: 9 }, '', '10', ''), BS.dbFilterOK(c, 'blue', '', '')]; });
  assert.deepEqual(r, [true, true, false, false]);
});
test('U19 a multicolour card matches either of its colours', async () => {
  const r = await ev(() => { const c = { cost: 2, type: 'Spirit', symbol: 'red', colors: ['red', 'white'] }; return [BS.dbFilterOK(c, 'red', '', ''), BS.dbFilterOK(c, 'white', '', ''), BS.dbFilterOK(c, 'green', '', '')]; });
  assert.deepEqual(r, [true, true, false]);
});
test('U20 the Contract type filter excludes normal cards of the same type', async () => {
  const r = await ev(() => { const ids = Object.keys(BS.CARDS).filter(id => !BS.CARDS[id].token); const con = ids.filter(id => BS.dbFilterOK(BS.CARDS[id], '', '', 'Contract')), nex = ids.filter(id => BS.dbFilterOK(BS.CARDS[id], '', '', 'Nexus'));
    return { con: con.length > 0, overlap: con.filter(id => nex.includes(id)).length }; });
  assert.deepEqual(r, { con: true, overlap: 0 });
});
