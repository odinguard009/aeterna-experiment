// v0.108.0 (roadmap M8 part 1): the online client. M8-40 checks the frame the server streams carries everything the
// board renderer needs (the step list, the seat's hand uids, and each field card's heavy flag + current BP). M8-41 is
// the end-to-end proof: the built client, served by the server, plays a whole online match against the server bot to
// the end (auto-answered, so the run is deterministic and needs no human).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstAnswer, loadEngine } from '../../packages/engine/headless.mjs';
import { newRoomHost } from '../../apps/server/src/host.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('M8-40 the server frame carries the online fields: steps, the seat hand uids (hu), and each field card its heavy flag and current BP', async () => {
  const E = loadEngine({ sim: false, format: 'standard' });
  const frames = [];
  const H = newRoomHost(E, { send: (msg, key) => { if (msg.t === 'view') frames.push({ key, frame: msg.frame }); } });
  H.register('player');
  assert.equal(H.start({ seed: 4, deck: 'std01', deckB: 'std03' }).ok, true);
  // drive decisions until a field card appears (the first summon), then stop - no need to run the whole match
  let guard = 8000;
  while (guard-- > 0) {
    const o = H.pending();
    if (o) { if (o.d.kind === 'action' || o.d.kind === 'payment') H.answerCPU(o.seat); else H.answer(o.seat, firstAnswer(o.seat, o.d)); }
    if (frames.some(f => f.frame.p.player.spirits.length + f.frame.p.player.nexus.length + f.frame.p.opponent.spirits.length + f.frame.p.opponent.nexus.length > 0)) break;
    await sleep(2);
  }
  H.stop();
  const withField = frames.find(f => f.frame.p.player.spirits.length + f.frame.p.player.nexus.length + f.frame.p.opponent.spirits.length + f.frame.p.opponent.nexus.length > 0);
  assert.ok(withField, 'a field card appeared within the first few turns');
  let withHu = 0;
  for (const { key, frame } of frames) {
    assert.ok(Array.isArray(frame.steps) && frame.steps.length >= 5, 'every frame carries the step list');
    if (key === 'player' && Array.isArray(frame.p.player.hand) && Array.isArray(frame.p.player.hu) && frame.p.player.hu.length === frame.p.player.hand.length) withHu++;
  }
  assert.ok(withHu > 0, 'the seat frames carry hand uids matching the hand ids');
  for (const f of withField.frame.p.player.spirits.concat(withField.frame.p.player.nexus, withField.frame.p.opponent.spirits, withField.frame.p.opponent.nexus)) {
    assert.equal(typeof f.h, 'number', 'the heavy flag is present');
    assert.equal(typeof f.bp, 'number', 'the current BP is present');
    assert.equal(typeof f.lv, 'number', 'the level is present');
  }
});

let ws = null;
try { ws = (await import('ws')).default; } catch (e) { ws = null; }
const SKIP = ws ? false : 'ws is not installed here (CI runs it): npm install --no-save ws@8';

test('M8-41 browser: the served client plays a whole online match against the server bot to the end', { skip: SKIP }, async () => {
  const { serve } = await import('../../apps/server/src/serve.mjs');
  const { getBrowser, closeBrowser } = await import('./lib/game.mjs');
  const s = await serve({ port: 0, wsPort: 0 });
  let page = null;
  try {
    page = await (await getBrowser()).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    await page.goto(`http://127.0.0.1:${s.httpPort}/`);
    await page.waitForFunction(() => !!window.BS && typeof BS.onlineStart === 'function');
    // auto-answer every decision (the server's own CPU policy plays the seat): a deterministic full match
    await page.evaluate(() => { BS.onlineAuto(true); BS.onlineStart(); return 1; });
    await page.waitForFunction(() => { const o = BS.online(); return o && o.over; }, { timeout: 60000 });
    const r = await page.evaluate(() => { const o = BS.online(); return { over: o.over, seat: o.seat, hasFrame: !!o.frame, token: typeof o.token }; });
    assert.deepEqual(errors, [], 'no page errors during the online match');
    assert.equal(r.over, true, 'the online match ended');
    assert.equal(r.seat, 'player', 'the client held the player seat');
    assert.equal(r.hasFrame, true, 'the client rendered server frames');
    assert.equal(r.token, 'string', 'the seat got a reconnect token');
  } finally {
    if (page) await page.close();
    await closeBrowser();
    await s.close();
  }
});

test('M8-42 browser: the online lobby renders account state and a private room code joins that room', { skip: SKIP }, async () => {
  const { serve } = await import('../../apps/server/src/serve.mjs');
  const { getBrowser, closeBrowser } = await import('./lib/game.mjs');
  const s = await serve({ port: 0, wsPort: 0 });
  let page = null;
  try {
    page = await (await getBrowser()).newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    await page.goto(`http://127.0.0.1:${s.httpPort}/`);
    await page.waitForFunction(() => !!window.BS && typeof BS.renderOnlineLobby === 'function');
    // The lobby: server reachable, no session, the active deck is Standard-legal.
    await page.evaluate(() => BS.renderOnlineLobby());
    await page.waitForFunction(() => {
      const el = document.getElementById('onl-account');
      return !!el && /Not signed in/.test(el.textContent || '');
    });
    const lobby = await page.evaluate(() => ({
      account: BS.onlineAccount(),
      server: document.getElementById('onl-server').textContent,
      deck: document.getElementById('onl-deck').textContent,
    }));
    assert.equal(lobby.account, null, 'no session -> the account panel reads "not signed in"');
    assert.match(lobby.server, /Reachable/);
    assert.match(lobby.deck, /legal in STANDARD/);
    // A private room code joins that exact room (the room id is the shareable code).
    await page.evaluate(() => { BS.onlineAuto(true); return BS.onlineStart('ABCD12'); });
    await page.waitForFunction(() => { const o = BS.online(); return o && o.room === 'ABCD12' && o.seat === 'player'; });
    const joined = await page.evaluate(() => { const o = BS.online(); return { room: o.room, seat: o.seat }; });
    assert.deepEqual(joined, { room: 'ABCD12', seat: 'player' });
    assert.deepEqual(errors, [], 'no page errors while rendering the lobby and joining the room');
  } finally {
    if (page) await page.close();
    await closeBrowser();
    await s.close();
  }
});
