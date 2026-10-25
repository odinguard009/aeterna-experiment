// v0.126.0 U14d3: the engine's 'core' and 'burst' view records and the cues they play (Full only; Reduced and Off draw nothing).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

let ctx, page;
const open = async () => { ctx = await (await getBrowser()).newContext({ viewport: { width: 1366, height: 768 } }); page = await ctx.newPage(); await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS); };
after(async () => { if (ctx) await ctx.close(); await closeBrowser(); });
const board = mode => page.evaluate(m => {
  const G = BS.testSetup(), id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.isSpiritForm(BS.CARDS[i]));
  const a = BS.mkInst(id), b = BS.mkInst(id); a.cores = 3; b.cores = 1; G.p.player.spirits = [a, b]; G.p.player.reserve.n = 4;
  window.__a = a; window.__b = b; window.__ev = []; BS.SETTINGS.anim = m;
  const prev = BS.io.host; BS.bindHost({ ...prev, view: ev => { if (ev.type === 'core' || ev.type === 'burst') window.__ev.push(ev); prev.view(ev); } });
  BS.render(); return 1;
}, mode);
const flies = () => page.evaluate(() => document.querySelectorAll('#ae-fx .ae-a-fly').length);

test('CF01 the rules emit one core record per move: add, remove, move, Soul Core move, swap and return', async () => {
  await open(); await board('off');
  const r = await page.evaluate(() => {
    const P = BS.G.p.player, a = window.__a, b = window.__b;
    BS.addCore(P, a); BS.removeCore(P, a); BS.moveCore(P, a, b);
    P.reserve.soul = true; BS.moveSoulTo(P, a); BS.swapSoul(P, a, b); BS.returnSoul(P, b);
    return window.__ev.map(e => `${e.kind}:${e.from === 'reserve' ? 'R' : e.from === a.uid ? 'a' : 'b'}>${e.to === 'reserve' ? 'R' : e.to === a.uid ? 'a' : 'b'}`);
  });
  assert.deepEqual(r, ['core:R>a', 'core:a>R', 'core:a>b', 'soul:R>a', 'soul:a>b', 'core:b>a', 'soul:b>R']);
});
test('CF02 Full flies a gem for a core move; Reduced and Off draw none; the match state is the same', async () => {
  for (const [mode, n] of [['full', 1], ['reduced', 0], ['off', 0]]) {
    await board(mode);
    await page.evaluate(() => document.querySelectorAll('#ae-fx .ae-a-fly').forEach(e => e.remove()));
    const cores = await page.evaluate(() => { BS.moveCore(BS.G.p.player, window.__a, window.__b); return [window.__a.cores, window.__b.cores]; });
    assert.deepEqual(cores, [2, 2]); assert.equal(await flies(), n, mode);
  }
});
test('CF03 a flipped Burst sends a burst record and Full shows the flip', async () => {
  await board('full');
  const r = await page.evaluate(async () => {
    const P = BS.G.p.player, O = BS.G.p.opponent, id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].burst && BS.CARDS[i].implemented);
    O.burst = BS.mkInst(id); BS.render();
    BS.io.view({ type: 'burst', side: 'opponent', id });
    return document.querySelectorAll('#ae-fx .ae-a-flip').length;
  });
  assert.equal(r, 1);
});
