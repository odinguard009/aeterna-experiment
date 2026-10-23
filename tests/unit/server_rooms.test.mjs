// M6 server prep (docs/ai/monorepo-plan.md M6): the pure room parts (rooms, views, host) with a real engine per room.
// Room rules match apps/server/src/run.mjs: the page's default format ('standard') and a concrete bot deck (the host
// never lets the engine pick the CPU deck, so a run replays its own record on one rng stream).
// The WebSocket flow (two scripted clients) lives in server_clients.test.mjs; it runs only where ws is installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinRoom, newRegistry, roomOf } from '../../apps/server/src/rooms.mjs';
import { frameFor, leaks } from '../../apps/server/src/views.mjs';
import { newRoomHost } from '../../apps/server/src/host.mjs';
import { firstAnswer, loadEngine, replayPort } from '../../packages/engine/headless.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const roomEngine = () => loadEngine({ sim: false, format: 'standard' });

test('M6-21 rooms: the player seat claims with a deck, reconnects by token, rejects the bot seat and wrong tokens', () => {
  const reg = newRegistry();
  const a = joinRoom(reg, { room: 'C1', seat: 'player', deck: 'std01' });
  assert.equal(a.ok, true, a.reason);
  assert.deepEqual(a.seats, { player: true });
  assert.equal(roomOf(reg, 'C1').bot, 'std03', 'the room bot deck defaults to the engine page default');
  const again = joinRoom(reg, { room: 'C1', seat: 'player', token: a.token });
  assert.equal(again.ok, true, again.reason);
  assert.equal(again.again, true, 'the same seat reconnects by token');
  assert.equal(joinRoom(reg, { room: 'C1', seat: 'player', token: 'nope' }).ok, false, 'a wrong token never takes the seat');
  assert.equal(joinRoom(reg, { room: 'C1', seat: 'opponent' }).ok, false, 'the opponent seat is the server bot');
  const spec = joinRoom(reg, { room: 'C1' });
  assert.equal(spec.ok, true, spec.reason);
  assert.equal(spec.viewerKey, null, 'a spectator is seatless');
  assert.equal(roomOf(reg, 'missing'), null, 'unknown room ids answer null');
  const reg2 = newRegistry();
  assert.equal(joinRoom(reg2, { room: 'C2', seat: 'player' }).ok, false, 'the seat claim needs a deck');
  assert.equal(reg2.rooms.size, 0, 'nothing joins without passing the claim');
  const reg3 = newRegistry();
  joinRoom(reg3, { room: 'C3', seat: 'player', deck: 'std01', bot: 'mitra' });
  assert.equal(roomOf(reg3, 'C3').bot, 'mitra', 'a join may pick the room bot deck itself');
});

/** Answers every open decision of a room the way the headless scripted human does (actions/payments: the bot). */
async function scriptToOver(H) {
  for (let guard = 30000; !H.over && guard > 0; guard--) {
    const o = H.pending();
    if (o) {
      if (o.d.kind === 'action' || o.d.kind === 'payment') assert.ok(H.answerCPU(o.seat).ok, 'the bot fallback answers');
      else assert.ok(H.answer(o.seat, firstAnswer(o.seat, o.d)).ok, 'the scripted client answers');
    }
    await sleep(2);
  }
  assert.ok(H.over, 'the room match finished');
}

test('M6-22 room host: a replay-safe start (concrete decks), one room to the end, the record replays with the same result', async () => {
  const H2 = newRoomHost(roomEngine(), { send: () => {} });
  assert.deepEqual(H2.start({ seed: 3, deck: 'std01' }).ok, false, 'a room requires a concrete bot deck (cpuDeckFor would eat the seed)');
  const E = roomEngine();
  const sent = [];
  const H = newRoomHost(E, { send: (msg, key) => sent.push({ key, msg }) });
  H.register('player');
  assert.deepEqual(H.start({ seed: 3, deck: 'std01', deckB: 'std03' }), { ok: true });
  assert.equal(H.start({ seed: 4, deck: 'std01', deckB: 'std03' }).ok, false, 'a room starts once');
  await scriptToOver(H);
  assert.ok(H.summary && H.summary.winner, 'the summary names a winner');
  assert.equal(H.error, null, 'no room error: ' + H.error);
  assert.ok(sent.some(x => x.msg.t === 'decide' && x.key === 'player'), 'the decisions reached the seat');
  assert.ok(sent.filter(x => x.msg.t === 'view').length > 10, 'frames were streamed');
  assert.ok(sent.every(x => x.msg.t !== 'decide' || x.key === 'player'), 'not one decision left the seat');
  assert.ok(sent.some(x => x.msg.t === 'over' && x.msg.summary.winner), 'the over message carries the summary');
  assert.ok(H.record && H.record.v === 2, 'the room keeps a v2 port record');
  const rp = await replayPort(H.record);
  assert.equal(rp.ok, true, rp.reason);
  assert.equal(rp.same, true, 'the record replays to the same log hash');
});

test('M6-23 room host: a decision timeout is answered by the bot and the match continues', async () => {
  const E = roomEngine();
  const H = newRoomHost(E, { send: () => {}, decideTimeoutMs: 15 });
  H.register('player');
  assert.equal(H.start({ seed: 3, deck: 'std01', deckB: 'std03' }).ok, true);
  let guard = 2000; while (!H.timedOut && guard-- > 0) await sleep(5);
  assert.ok(H.timedOut >= 1, 'the timeout answered the open decision');
  guard = 4000; while (!H.over && guard-- > 0) await sleep(10);
  assert.ok(H.over, 'the match, left unanswered, played to the end on bot answers');
  assert.equal(H.error, null, H.error);
});

test('M6-24 frames on the wire: the seat sees its own side only, the spectator only counts, nothing leaks', async () => {
  const E = roomEngine();
  const frames = [];
  const H = newRoomHost(E, { send: (msg, key) => { if (msg.t === 'view') frames.push({ key, frame: msg.frame }); } });
  H.register('player');
  H.register(null);
  assert.equal(H.start({ seed: 4, deck: 'std01', deckB: 'std03' }).ok, true);
  await scriptToOver(H);
  assert.ok(frames.length > 20, 'both viewers received frames');
  let withHand = 0;
  for (const { key, frame } of frames) {
    assert.deepEqual(leaks(frame, key), [], 'no hidden card leaks (viewer ' + key + '): ' + JSON.stringify(leaks(frame, key)));
    if (key === 'player') {
      if (Array.isArray(frame.p.player.hand)) withHand++;
      assert.equal(typeof frame.p.opponent.hand, 'number', 'the opponent hand stays a count for the seat');
      assert.ok(!frame.p.opponent.burst || frame.p.opponent.burst === 'set', 'the opponent face-down burst stays "set" or none');
    } else {
      assert.equal(typeof frame.p.player.hand, 'number', 'the spectator never sees the hand ids');
      assert.ok(!frame.p.player.burst || frame.p.player.burst === 'set', 'the spectator never sees a face-down burst');
    }
    assert.equal(typeof frame.p.player.deck, 'number', 'decks stay lengths');
  }
  assert.ok(withHand > 0, 'the seat saw its own hand ids at least once');
});

test('M6-25 one engine context per room: the load cost into memory and time is printed once to pick a room limit', async () => {
  const h0 = process.memoryUsage().heapUsed;
  const t0 = Date.now();
  const engines = [];
  for (let i = 0; i < 5; i++) engines.push(roomEngine());
  const ms = Date.now() - t0;
  const kib = Math.round((process.memoryUsage().heapUsed - h0) / 1024);
  console.log(`[M6-25] 5 fresh engines: ${ms} ms, heap +${kib} KiB (a room limit waits for a real fleet measurement)`);
  for (const E of engines) assert.ok(!E.G, 'each room engine starts without a match');
});
