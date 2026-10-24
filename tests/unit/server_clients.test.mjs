// M6 server prep, part 2 (docs/ai/monorepo-plan.md M6): the CI flow - two scripted clients (the room seat and a
// spectator) drive a whole real match to the end over WebSocket, the spectator's wire shows no hidden card id, and
// the room's own record replays with the same result. Skips itself wherever the ws package is missing (CI installs
// `ws@8` into node_modules without saving it, like playwright); locally: npm install --no-save ws@8 to run it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaks } from '../../apps/server/src/views.mjs';
import { firstAnswer, replayPort } from '../../packages/engine/headless.mjs';
import { memoryStore } from '../../apps/server/src/store.mjs';
import { accounts, newToken, hashToken } from '../../apps/server/src/accounts.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws = null;
try { ws = (await import('ws')).default; } catch (e) { ws = null; }
const SKIP = ws ? false : 'ws is not installed here (CI runs it): npm install --no-save ws@8';

const DECK = 'std01';                                       // room rules: standard, human deck std01 vs the default bot std03

/** One scripted socket: joins `room` on open, answers every decide the headless way (actions/payments: the bot).
 *  `opts.onMsg(c, m)` watches messages; holding (opts.hold) freezes the seat's first decide unanswered (the drill). */
function connect(url, room, opts = {}) {
  opts = opts || {};
  return new Promise((open, fail) => {
    const sock = opts.headers ? new ws(url, { headers: opts.headers }) : new ws(url);   // headers: the ws handshake cookie for the account drill
    const c = { sock, msgs: [], seat: opts.seat || null, token: null, hold: !!opts.hold, closed: false };
    c.send = m => c.sock.send(JSON.stringify(m));
    c.close = () => { if (!c.closed) { c.closed = true; c.sock.close(); } };
    c.sock.on('message', raw => {
      let m = null;
      try { m = JSON.parse(String(raw)); } catch (e) { return; }
      c.msgs.push(m);
      if (m.t === 'welcome') c.token = m.token;
      if (m.t === 'decide') {
        if (c.hold) return;                                 // the reconnect drill froze this seat at its decision
        if (m.d.kind === 'action' || m.d.kind === 'payment') c.send({ t: 'answer', cpu: true });
        else c.send({ t: 'answer', v: firstAnswer('player', m.d) });
      }
      if (opts.onMsg) opts.onMsg(c, m);
    });
    c.sock.on('open', () => {
      c.send({ t: 'join', room, seat: c.seat || undefined, deck: opts.deck, token: opts.token, seed: opts.seed });
      open(c);
    });
    c.sock.on('error', fail);
  });
}
async function waitUntil(fn, ms, label) {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await sleep(25);
  assert.ok(fn(), label);
}
const errorsOf = c => c.msgs.filter(x => x.t === 'error');

test('M6-26 CI: two scripted clients (seat + spectator) run a match to the end; the spectator wire never shows a hidden card; the record replays', { skip: SKIP }, async () => {
  const { startServer } = await import('../../apps/server/src/run.mjs');
  const sv = await startServer({ port: 0, decideTimeoutMs: 20000 });
  let seat = null, spec = null;
  try {
    seat = await connect(sv.url, 'T1', { seat: 'player', deck: DECK, seed: 3 });
    spec = await connect(sv.url, 'T1', {});
    await waitUntil(() => seat.msgs.some(x => x.t === 'over'), 40000, 'the seat saw the match end');
    await waitUntil(() => spec.msgs.some(x => x.t === 'over'), 40000, 'the spectator saw the match end');
    assert.equal(errorsOf(seat).length, 0, 'no server errors for the seat: ' + JSON.stringify(errorsOf(seat)));
    assert.equal(errorsOf(spec).length, 0, 'no server errors for the spectator: ' + JSON.stringify(errorsOf(spec)));
    const welcome = seat.msgs[0];
    assert.deepEqual(welcome, { t: 'welcome', room: 'T1', seat: 'player', token: welcome.token, seats: { player: true } });
    assert.equal(typeof (welcome.token || ''), 'string', 'the seat got a reconnect token');
    assert.ok(seat.msgs.some(x => x.t === 'decide'), 'the seat was asked decisions');
    assert.ok(spec.msgs.every(x => x.t !== 'decide'), 'no decision ever reached the spectator');
    assert.ok(spec.msgs.every(x => x.t !== 'note'), 'no timeout notes (the scripted answers were in time)');
    let withHand = 0;
    for (const m of seat.msgs) if (m.t === 'view') {
      assert.deepEqual(leaks(m.frame, 'player'), [], 'the seat frame leaks: ' + JSON.stringify(leaks(m.frame, 'player')));
      if (Array.isArray(m.frame.p.player.hand)) withHand++;
    }
    for (const m of spec.msgs) if (m.t === 'view') {
      assert.deepEqual(leaks(m.frame, null), [], 'the spectator frame leaks: ' + JSON.stringify(leaks(m.frame, null)));
      assert.equal(typeof m.frame.p.player.hand, 'number', 'the spectator hand stays a count');
    }
    assert.ok(withHand > 0, 'the seat saw its own hand at least once');
    const over = seat.msgs.find(x => x.t === 'over');
    assert.deepEqual(over.summary, spec.msgs.find(x => x.t === 'over').summary, 'both clients saw the same summary');
    assert.ok(over.summary && over.summary.winner, 'the summary names a winner');
    const rec = sv.recordOf('T1');
    assert.ok(rec && rec.v === 2, 'the room kept a v2 record');
    const rp = await replayPort(rec);
    assert.equal(rp.ok, true, rp.reason);
    assert.equal(rp.same, true, 'the room record replays to the same log hash');
  } finally {
    if (seat) seat.close();
    if (spec) spec.close();
    await sv.close();
  }
});

test('M6-26b CI: killing the seat mid-decision and reconnecting by token re-delivers the open decision and completes the match', { skip: SKIP }, async () => {
  const { startServer } = await import('../../apps/server/src/run.mjs');
  const sv = await startServer({ port: 0, decideTimeoutMs: 30000 });
  let frozen = null, again = null;
  try {
    frozen = await connect(sv.url, 'T2', { seat: 'player', deck: DECK, seed: 3, hold: true });
    await waitUntil(() => frozen.msgs.some(x => x.t === 'decide'), 20000, 'the frozen seat got its decision');
    frozen.sock.terminate();                                // the drill: the socket dies while the decision is open
    await sleep(150);                                       // the server notices the close and unregisters the viewer
    again = await connect(sv.url, 'T2', { seat: 'player', deck: DECK, token: frozen.token });
    await waitUntil(() => again.msgs.length > 0, 20000, 'the reconnect lands');
    assert.equal(again.msgs[0].t, 'welcome', 'the reconnect gets a welcome');
    await waitUntil(() => again.msgs.some(x => x.t === 'decide'), 20000, 'the open decision is re-delivered on reconnect');
    assert.equal(again.token, frozen.token, 'the reconnect is the same seat token');
    await waitUntil(() => again.msgs.some(x => x.t === 'over'), 40000, 'the match completes after the reconnect');
    assert.equal(errorsOf(again).length, 0, 'no server errors after the reconnect: ' + JSON.stringify(errorsOf(again)));
    const rp = await replayPort(sv.recordOf('T2'));
    assert.equal(rp.ok, true, rp.reason);
    assert.equal(rp.same, true, 'the reconnected match replays to the same log hash');
  } finally {
    if (frozen && frozen.sock.readyState <= 1) frozen.sock.close();
    if (again) again.close();
    await sv.close();
  }
});

// M7 store wiring (v0.107.0): a finished room writes its match + replay through the store instead of dropping
// them. Both drills run the same full match as M6-26, so they skip without ws and run in CI.

test('M7-31 CI: a finished room writes its match and replay to the store (guest player, bot opponent)', { skip: SKIP }, async () => {
  const store = memoryStore();
  const { startServer } = await import('../../apps/server/src/run.mjs');
  const sv = await startServer({ port: 0, decideTimeoutMs: 20000, store });
  let seat = null;
  try {
    seat = await connect(sv.url, 'G1', { seat: 'player', deck: DECK, seed: 5 });
    await waitUntil(() => seat.msgs.some(x => x.t === 'over'), 40000, 'the match ended');
    const saved = await sv.savedOf('G1');
    assert.ok(saved, 'the finished match was written to the store');
    assert.equal(saved.roomCode, 'G1', 'the room id is the room code');
    assert.equal(saved.format, 'standard');
    assert.equal(saved.seed, 5);
    assert.deepEqual(saved.deckA, saved.deckA && typeof saved.deckA === 'object' ? saved.deckA : null, 'deckA is a card map');
    assert.ok(['player', 'opponent'].includes(saved.winner), 'the winner is a seat');
    assert.ok(Number.isInteger(saved.turns) && saved.turns >= 0, 'the turn count is a whole number');
    assert.deepEqual(saved.seats[0], { seat: 'player', accountId: null, displayName: 'Player', isBot: false });
    assert.equal(saved.seats[1].seat, 'opponent');
    assert.equal(saved.seats[1].accountId, null);
    assert.equal(saved.seats[1].isBot, true);
    assert.ok(saved.seats[1].displayName.length >= 1 && saved.seats[1].displayName.length <= 40, 'the bot seat names its deck');
    assert.ok(saved.replay && saved.replay.record && saved.replay.record.v === 2, 'the replay keeps the v2 port record');
    assert.equal(saved.replay.logHash.length, 8, 'the log hash is the 8-hex zero-padded hash');
    const rp = await replayPort(saved.replay.record);
    assert.equal(rp.ok, true, rp.reason);
    assert.equal(String(rp.final.hash).padStart(8, '0'), saved.replay.logHash, 'replaying the stored record reproduces the stored hash');
  } finally {
    if (seat) seat.close();
    await sv.close();
  }
});

test('M7-32 CI: a signed-in seat is recorded under its account, resolved from the session cookie only', { skip: SKIP }, async () => {
  const store = memoryStore();
  const ACC = { id: '99999999-9999-4999-8999-999999999999', email: 'odin@example.com', displayName: 'Odin' };
  await store.accounts.create(ACC);
  const session = newToken();
  await store.auth.putSession({ tokenHash: hashToken(session), accountId: ACC.id, expiresAt: new Date(Date.now() + 120000).toISOString() });
  const { startServer } = await import('../../apps/server/src/run.mjs');
  const sv = await startServer({ port: 0, decideTimeoutMs: 20000, store, accounts: accounts({ store }) });
  let seat = null;
  try {
    seat = await connect(sv.url, 'G2', { seat: 'player', deck: DECK, seed: 5, headers: { cookie: 'aeterna_session=' + session } });
    await waitUntil(() => seat.msgs.some(x => x.t === 'over'), 40000, 'the match ended');
    const saved = await sv.savedOf('G2');
    assert.ok(saved, 'the finished match was written to the store');
    assert.deepEqual(saved.seats[0], { seat: 'player', accountId: ACC.id, displayName: 'Odin', isBot: false }, 'the account came from the cookie, not the join');
    const list = await store.matches.listOf(ACC.id);
    assert.equal(list.length, 1, 'the account history lists the match');
    assert.equal(list[0].id, saved.id);
  } finally {
    if (seat) seat.close();
    await sv.close();
  }
});
