/* ---------------------------------------------------------------------
   M6 SERVER PRIMER (docs/ai/monorepo-plan.md M6, v0.105.0): the WebSocket wrapper of the M6 room parts. One engine
   per room (loadEngine, one node:vm context), rooms from src/rooms.mjs, seat-filtered frames from src/host.mjs +
   src/views.mjs. Room rules: the page's default format and a concrete bot deck (room.bot, default std03) so a run
   replays its own record. Client messages: {t:'join', room, seat:'player'|omitted(spectator), token?, deck?, key?,
   seed?, bot?}, {t:'answer', v} or {t:'answer', cpu:true} (the bot re-derives the answer), {t:'leave'}; server
   messages: {t:'welcome'|'view'|'decide'|'note'|'over'|'error'}. The ws package installs only in CI (npm install
   --no-save ws): the import below is lazy, so nothing here loads without it. No deployment in M6.

   M7 (step 5, v0.107.0): startServer({ store, accounts }) wires a finished room to the persistence contract -
   instead of dropping its record, a match that ends writes itself (inputs + outcome + replay) to the store. The
   player's account comes from the session cookie of the ws upgrade request (resolved through the accounts service),
   never from the join message; a guest seat stays accountId null and is recorded as "Player". The bot seat is
   always the server's bot (isBot: true). recordOf(roomId) still answers the raw port record; savedOf(roomId)
   answers the promise of the store write.
   --------------------------------------------------------------------- */
import { randomUUID } from 'node:crypto';
import { newRegistry, joinRoom } from './rooms.mjs';
import { newRoomHost } from './host.mjs';
import { loadEngine } from '../../../packages/engine/headless.mjs';

export async function startServer({ port = 0, registry = null, decideTimeoutMs = 120000, format = 'standard', store = null, accounts = null } = {}) {
  let mod;
  try { mod = await import('ws'); } catch (e) { throw new Error('apps/server: the ws package is not installed (CI installs it with npm install --no-save ws)'); }
  const reg = registry || newRegistry();
  const wss = new mod.WebSocketServer({ port });
  const listening = new Promise(res => wss.once('listening', res));
  const hosts = new Map();                                    // roomId -> the room host (one engine per room)
  const subs = new Set();                                     // { ws, roomId, key, seat, token }
  const subsIn = roomId => [...subs].filter(c => c.roomId === roomId);
  const route = room => (msg, key) => {                        // the host sends one plain message per viewer key
    const data = JSON.stringify(msg);
    for (const c of subs) if (c.roomId === room.id && c.key === key && c.ws.readyState === 1) c.ws.send(data);
  };
  /** The account behind a socket: the session cookie of the ws upgrade request, resolved through the accounts
   *  service. Nothing a client sends is trusted for this - the id only ever comes from here (accounts.mjs rule). */
  const accountOf = req => {
    if (!accounts || typeof accounts.accountFromCookie !== 'function') return Promise.resolve(null);
    return Promise.resolve()
      .then(() => accounts.accountFromCookie(req && req.headers && req.headers.cookie))
      .then(a => a || null)
      .catch(() => null);                                     // an auth lookup failure plays as a guest, never crashes the room
  };
  /** A finished room writes its match + replay (the M7 store contract). A broken match (no record or summary)
   *  writes nothing - the host already recorded why in H.error. The replay keeps the 8-hex zero-padded log hash. */
  const recordMatch = (room, h) => {
    if (!store || !store.matches) return Promise.resolve(null);
    const rec = h.record, sum = h.summary;
    if (!rec || !sum) return Promise.resolve(null);
    const s = room.seats.player || {};
    const bot = (h.E && Array.isArray(h.E.PREBUILT) && h.E.PREBUILT.find(x => x.id === room.bot)) || null;
    const match = {
      id: randomUUID(),
      roomCode: room.id.length >= 1 && room.id.length <= 24 ? room.id : null,
      format: rec.format || format,
      seed: rec.seed,
      deckA: rec.deckA,
      deckB: rec.deckB,
      keyA: rec.keyA || null,
      keyB: rec.keyB || null,
      build: rec.build,
      winner: sum.winner || null,
      turns: sum.turn != null ? sum.turn : null,
      seats: [
        { seat: 'player', accountId: s.accountId || null, displayName: s.displayName || 'Player', isBot: false },
        { seat: 'opponent', accountId: null, displayName: ((bot && bot.name) || room.bot).slice(0, 40), isBot: true },
      ],
      replay: { record: rec, logHash: String(sum.hash).padStart(8, '0') },
    };
    return store.matches.record(match);
  };
  const ensureStarted = room => {
    if (!room.seats.player) return null;
    let h = hosts.get(room.id);
    if (!h) {
      h = newRoomHost(loadEngine({ sim: false, format }), { send: route(room), decideTimeoutMs, onOver: hh => recordMatch(room, hh) });
      hosts.set(room.id, h);
      for (const c of subsIn(room.id)) h.register(c.key);      // everyone watching gets the first frame
      const s = room.seats.player;
      h.start({ deck: s.deck, deckB: room.bot, keyA: s.key, seed: room.seed });
    }
    return h;
  };
  wss.on('connection', (ws, req) => {
    const c = { ws, roomId: null, key: null, seat: null, token: null };
    const detach = () => { if (c.roomId) { const h = hosts.get(c.roomId); if (h) h.unregister(c.key); } subs.delete(c); };
    ws.on('close', detach);
    ws.on('error', detach);
    ws.on('message', raw => {
      let m;
      try { m = JSON.parse(String(raw)); } catch (e) { ws.send(JSON.stringify({ t: 'error', message: 'bad json: ' + e.message })); return; }
      if (!m || typeof m !== 'object' || !m.t) return ws.send(JSON.stringify({ t: 'error', message: 'a message needs a t field' }));
      if (m.t === 'join') {
        accountOf(req).then(account => {
          const j = joinRoom(reg, account ? Object.assign({}, m, { accountId: account.id, displayName: account.displayName }) : m);
          if (!j.ok) return ws.send(JSON.stringify({ t: 'error', message: j.reason }));
          const prior = hosts.get(j.room.id);                  // the decide re-delivery only happens for an already-started room (see below)
          const h0 = hosts.get(c.roomId);
          if (h0) h0.unregister(c.key);                        // a second join of the same socket switches rooms
          c.roomId = j.room.id; c.key = j.viewerKey; c.seat = j.seat; c.token = j.token;
          subs.add(c);
          ws.send(JSON.stringify({ t: 'welcome', room: j.room.id, seat: j.seat, token: j.token, seats: j.seats }));
          const h = ensureStarted(j.room);
          if (h && prior === h) h.register(c.key);             // a fresh start already registered every room sub (incl. the joiner): no double decide
        }).catch(() => ws.send(JSON.stringify({ t: 'error', message: 'account lookup failed' })));
        return;
      }
      if (m.t === 'answer') {
        const h = c.roomId && hosts.get(c.roomId);
        if (!h) return ws.send(JSON.stringify({ t: 'error', message: 'no match for this socket yet' }));
        const r = m.cpu ? h.answerCPU(c.seat) : h.answer(c.seat, m.v);
        if (!r.ok) ws.send(JSON.stringify({ t: 'error', message: r.reason }));
      } else if (m.t === 'leave') {
        detach();
      }
    });
  });
  await listening;
  const p = wss.address().port;
  // ws's close() waits until every client is gone; a room host may still hold a socket, so the closer terminates
  // the clients itself - the server then settles and the process can exit on its own (tests and CI).
  return { url: 'ws://127.0.0.1:' + p, port: p, rooms: reg, close: () => { for (const h of hosts.values()) h.stop(); for (const c of subs) try { c.ws.terminate(); } catch (e) { /* already gone */ } return new Promise(res => wss.close(res)); }, recordOf: roomId => { const h = hosts.get(String(roomId)); return h ? h.record : null; }, savedOf: roomId => { const h = hosts.get(String(roomId)); return h ? h.saved : null; } };
}
