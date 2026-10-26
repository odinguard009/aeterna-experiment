// v0.92.0 U5b light battle animations (roadmap item U, owner 2026-10-21): attack beam, Life shatter, summon flash, destroy fade,
// BP pop, level-up glow, draw slide. Overlay layer #ae-fx only (transform / opacity), never blocks a tap or the engine;
// Settings "Animations: Full / Reduced / Off" (Off by default under automation and never in sims), reduced motion = Reduced.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
async function open(screen, query = '', extra = {}) {
  const ctx = await (await getBrowser()).newContext(Object.assign({}, SCREENS[screen], extra)); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto(GAME_URL + query); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });
// a quiet board with one Spirit on each side; returns nothing (state lives in the page)
const board = page => page.evaluate(() => {
  const G = BS.testSetup(), id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.isSpiritForm(BS.CARDS[i]) && BS.CARDS[i].levels && BS.CARDS[i].levels.length > 1);
  window.__id = id;
  for (const k of ['player', 'opponent']) { const f = BS.mkInst(id); f.cores = 1; G.p[k].spirits.push(f); }
  BS.render(); return 1;
});
const count = (page, sel) => page.evaluate(s => document.querySelectorAll(s).length, sel);

test('U92-1 Settings has Animations Full / Reduced / Off; automation defaults to Off; the choice is saved', async () => {
  const { page, errors } = await open('pc');
  const r = await page.evaluate(() => ({ def: BS.SETTINGS.anim || null, eff: BS.animMode(), opts: [...document.querySelectorAll('#set-anim option')].map(o => o.value) }));
  assert.deepEqual(r, { def: null, eff: 'off', opts: ['auto', 'full', 'reduced', 'off'] });
  await page.click('#app-nav [data-a="go-settings"]');
  await page.click('#set-menu [data-v="sound"]');
  await page.selectOption('#set-anim', 'reduced');
  assert.equal(await page.evaluate(() => [BS.SETTINGS.anim, BS.animMode(), JSON.parse(localStorage.getItem(BS.SET_KEY)).anim].join()), 'reduced,reduced,reduced');
  assert.deepEqual(errors, []);
});

for (const screen of ['pc', 'phone']) {
  test(`U92-2 ${screen}: Full shows every cue in the overlay layer, each gone within a second; Off shows none`, async () => {
    const { page, errors } = await open(screen);
    await board(page);
    await page.evaluate(() => { BS.SETTINGS.anim = 'full'; BS.fxCueReset(); BS.render(); return 1; });
    await page.evaluate(() => { const G = BS.G, f = BS.mkInst(window.__id); f.cores = 1; G.p.player.spirits.push(f); window.__f = f; BS.render(); return 1; });
    assert.equal(await count(page, '#ae-fx .ae-a-sum'), 1, 'summon flash');
    await page.evaluate(() => { window.__f.bpMod += 3000; BS.render(); return 1; });
    assert.match(await page.evaluate(() => (document.querySelector('#ae-fx .ae-a-bp') || {}).textContent || ''), /^\+3000$/, 'BP pop');
    await page.evaluate(() => { const f = window.__f, c = BS.CARDS[f.id]; f.cores = c.levels[c.levels.length - 1].cores; BS.render(); return 1; });
    assert.equal(await count(page, '#ae-fx .ae-a-lv'), 1, 'level-up glow');
    await page.evaluate(() => { const G = BS.G; G.attacker = G.p.opponent.spirits[0]; BS.render(); return 1; });
    const beam = await page.evaluate(() => { const b = document.querySelector('#ae-fx .ae-a-beam'); return b && { w: parseFloat(b.style.width), cpu: b.classList.contains('cpu') }; });
    assert.ok(beam && beam.w > 40 && beam.cpu, JSON.stringify(beam));
    await page.evaluate(() => { const G = BS.G; G.attacker = null; G.p.player.life -= 2; BS.render(); return 1; });
    assert.ok(await count(page, '#ae-fx .ae-a-shard') >= 5, 'Life shatter');
    await page.evaluate(() => { const G = BS.G; G.p.player.spirits = G.p.player.spirits.filter(x => x !== window.__f); G.p.player.hand.push(BS.mkInst(window.__id)); BS.render(); return 1; });
    assert.equal(await count(page, '#ae-fx .ae-a-die'), 1, 'destroy fade');
    assert.equal(await count(page, '.hand-area .tcg-card.ae-a-draw'), 1, 'draw slide');
    const r = await page.evaluate(() => { const l = getComputedStyle(document.getElementById('ae-fx')); return { pe: l.pointerEvents, kids: [...document.querySelectorAll('#ae-fx [class^="ae-a-"]')].every(e => getComputedStyle(e).pointerEvents === 'none' || l.pointerEvents === 'none') }; });
    assert.deepEqual(r, { pe: 'none', kids: true });
    await page.waitForTimeout(1000);
    assert.equal(await count(page, '#ae-fx [class*="ae-a-"]'), 0, 'every cue removes itself');
    await page.evaluate(() => { BS.SETTINGS.anim = 'off'; const G = BS.G; G.p.player.life -= 1; G.p.player.spirits.push(BS.mkInst(window.__id)); BS.render(); return 1; });
    assert.equal(await count(page, '#ae-fx [class*="ae-a-"]'), 0, 'Off');
    assert.deepEqual(errors, []);
  });
}

// v0.99.0 U8a: an explicit Full now wins over the device's reduced motion (owner); that case moved to u8a.test.mjs U8A-1
test('U92-3 Reduced keeps fades only: no shards, a still beam', async () => {
  for (const [mode, extra] of [['reduced', {}]]) {
    const { page, errors } = await open('pc', '', extra);
    await board(page);
    await page.evaluate(m => { BS.SETTINGS.anim = m; BS.fxCueReset(); BS.render(); const G = BS.G; G.p.player.life -= 1; G.attacker = G.p.opponent.spirits[0]; BS.render(); return 1; }, mode);
    const r = await page.evaluate(() => ({ eff: BS.animMode(), shards: document.querySelectorAll('#ae-fx .ae-a-shard').length, hit: document.querySelectorAll('#ae-fx .ae-a-hit').length, still: !!document.querySelector('#ae-fx .ae-a-beam.still') }));
    assert.deepEqual(r, { eff: 'reduced', shards: 0, hit: 1, still: true }, mode);
    assert.deepEqual(errors, []);
  }
});

test('U92-4 sims draw no animation; a watched CPU match with Full runs on without errors', async () => {
  const s = await open('pc', '?sim=1');
  await s.page.evaluate(() => { BS.SETTINGS.anim = 'full'; BS.SETTINGS.speed = 'fast'; BS.startNewGame({ seed: 4501 }); return 1; });
  await s.page.waitForFunction(() => BS.G && BS.G.turnNo >= 3, null, { timeout: 30000 });
  assert.equal(await count(s.page, '#ae-fx [class*="ae-a-"]'), 0);
  const w = await open('pc');
  await w.page.evaluate(() => { BS.SETTINGS.anim = 'full'; BS.SETTINGS.speed = 'fast'; BS.startNewGame({ watch: true, seed: 4501 }); return 1; });
  let most = 0; const t0 = Date.now();
  while (Date.now() - t0 < 30000) { most = Math.max(most, await count(w.page, '#ae-fx [class*="ae-a-"]')); if (await w.page.evaluate(() => BS.G && BS.G.over)) break; await w.page.waitForTimeout(100); }
  assert.ok(await w.page.evaluate(() => BS.G.over && BS.G.turnNo >= 3), 'the match plays to its end');
  assert.ok(most < 40, 'cues never pile up: ' + most);
  assert.deepEqual(s.errors.concat(w.errors), []);
});

test('U92-5 phone: a scrolled field row keeps its place at once after a render (cues measure the real card places)', async () => {
  const { page, errors } = await open('phone');
  await board(page);
  const r = await page.evaluate(() => {
    const G = BS.G; for (let n = 0; n < 7; n++) { const f = BS.mkInst(window.__id); f.cores = 1; G.p.player.spirits.push(f); }
    BS.render(); const row = () => document.querySelector('[data-scroll="player-field"]');
    const max = row().scrollWidth - row().clientWidth; row().style.scrollBehavior = 'auto'; row().scrollLeft = max; row().style.scrollBehavior = '';
    BS.render(); return { max, now: row().scrollLeft };
  });
  assert.ok(r.max > 50, JSON.stringify(r)); assert.ok(Math.abs(r.now - r.max) <= 1, JSON.stringify(r));
  assert.deepEqual(errors, []);
});
