// v0.107.0 (roadmap M7 step 7): the server entry point wires the store, the accounts service, the HTTP
// API and the WebSocket room server in one process. It runs against the in-memory reference store and
// skips itself wherever ws is missing (CI installs it): npm install --no-save ws@8 to run locally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstAnswer, replayPort } from '../../packages/engine/headless.mjs';

let ws = null;
try { ws = (await import('ws')).default; } catch (e) { ws = null; }
const SKIP = ws ? false : 'ws is not installed here (CI runs it): npm install --no-save ws@8';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DECK = 'std01';

/** One scripted socket that joins and answers every decide the headless way (actions/payments: the bot). */
function connect(url, room, opts = {}) {
  return new Promise((open, fail) => {
    const sock = opts.headers ? new ws(url, { headers: opts.headers }) : new ws(url);
    const c = { sock, msgs: [], token: null };
    c.send = (m) => c.sock.send(JSON.stringify(m));
    c.sock.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      c.msgs.push(m);
      if (m.t === 'welcome') c.token = m.token;
      if (m.t === 'decide') {
        if (m.d.kind === 'action' || m.d.kind === 'payment') c.send({ t: 'answer', cpu: true });
        else c.send({ t: 'answer', v: firstAnswer('player', m.d) });
      }
    });
    c.sock.on('open', () => { c.send({ t: 'join', room, seat: 'player', deck: DECK, seed: 3 }); open(c); });
    c.sock.on('error', fail);
  });
}

test('SERVE01 one process serves /health, names the account from its cookie, and writes a finished room to the store', { skip: SKIP }, async () => {
  const { serve } = await import('../../apps/server/src/serve.mjs');
  const s = await serve({ port: 0, wsPort: 0 });
  try {
    const base = `http://127.0.0.1:${s.httpPort}`;
    assert.deepEqual(await fetch(base + '/health').then((r) => r.json()), { ok: true }, 'the HTTP API is up');

    // the accounts service and the store are the same process the ws room will write to
    const login = await s.svc.loginWithDiscord({ discordId: '123456789', username: 'Odin' });
    const cookie = login.cookie.split(';')[0];
    const me = await fetch(base + '/api/me', { headers: { Cookie: cookie } }).then((r) => r.json());
    assert.equal(me.account.displayName, 'Odin', 'the API names the account behind the cookie');

    // a full match over the WebSocket writes itself to the shared store
    const seat = await connect(s.ws.url, 'S1');
    while (!seat.msgs.some((x) => x.t === 'over')) await sleep(25);
    const saved = await s.ws.savedOf('S1');
    assert.ok(saved, 'the finished room wrote its match to the store');
    assert.equal(saved.seats[0].accountId, null, 'the ws client joined without a session, so it is a guest');
    assert.equal(saved.seats[1].isBot, true);
    const rp = await replayPort(saved.replay.record);
    assert.equal(rp.ok, true, rp.reason);
    assert.equal(String(rp.final.hash).padStart(8, '0'), saved.replay.logHash, 'the stored record replays to the stored hash');
    seat.sock.terminate();
  } finally {
    await s.close();
  }
});
