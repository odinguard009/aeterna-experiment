/* ---------------------------------------------------------------------
   M6 ROOMS (docs/ai/monorepo-plan.md M6, v0.105.0): the structural, transport-free parts.
   One room = one match: the human seat is 'player' (claimed once, with a token for reconnect); the opponent seat is
   the server's bot (the engine marks it cpu, answered through the port with cpuAnswer); spectators join with no seat
   and are streamed seat-filtered frames (src/views.mjs). No engine, no packages here: tests run this file standalone.
   --------------------------------------------------------------------- */
/** A fresh room registry (pure data; the ws wrapper owns transports). */
export function newRegistry() {
  return { rooms: new Map(), seq: 0 };
}
/** A room lookup by id (always string ids over the wire). */
export function roomOf(reg, id) {
  return (id != null && reg.rooms.get(String(id))) || null;
}
/** Join or rejoin a room. msg = { room?, seat?: 'player', token?, deck?, key?, seed?, accountId?, displayName? }.
 *  - seat 'player': claims the seat on the first join (a deck is required) and answers reconnects by token;
 *    accountId/displayName are optional and recorded with the seat (run.mjs resolves them from a session, not
 *    from the wire) so a finished match can name the player who signed in.
 *  - no seat: a spectator (fits any number of clients).
 *  Resolves { ok, room, seat, viewerKey, token, again, seats } or { ok: false, reason }. */export function joinRoom(reg, msg) {
  msg = msg || {};
  const id = String(msg.room || '').trim().slice(0, 64);
  if (!id) return { ok: false, reason: 'room id required' };
  let room = reg.rooms.get(id);
  const created = !room;
  if (!room) {
    // bot: the room's bot deck (a prebuilt id) - always concrete. The engine's own CPU pick (cpuDeckFor) can eat the
    // seed when the settings deck is illegal in the room format; the host demands deckB so the run replays it (M6-22).
    room = { id, seq: ++reg.seq, seats: { player: null }, bot: msg.bot != null ? String(msg.bot).slice(0, 80) : 'std03', seed: msg.seed != null ? (Number(msg.seed) >>> 0) || undefined : undefined };
    reg.rooms.set(id, room);
  }
  if (msg.seat && msg.seat !== 'player') return { ok: false, reason: 'the opponent seat is the server bot; join a spectator with no seat' };
  if (msg.seat === 'player') {
    if (room.seats.player) {
      if (room.seats.player.token === msg.token) return { ok: true, room, seat: 'player', viewerKey: 'player', token: msg.token, again: true, seats: { player: true } };
      return { ok: false, reason: 'seat taken (wrong token)' };
    }
    // v0.108.0 (M8 online client): the deck may be a prebuilt id (string) or the player's own card map
    // ({cardId: count}); an object is kept as-is so a custom deck plays through the room (host.mjs deckOf
    // passes objects to the engine unchanged). A card map is capped at 120 entries and 4 copies per card.
    let deck;
    if (typeof msg.deck === 'string') deck = String(msg.deck).slice(0, 80);
    else if (msg.deck && typeof msg.deck === 'object' && !Array.isArray(msg.deck)) {
      deck = {};
      for (const [cid, n] of Object.entries(msg.deck).slice(0, 120)) {
        const k = Number(n);
        if (Number.isInteger(k) && k >= 0 && k <= 4) deck[String(cid).slice(0, 40)] = k;
      }
      if (!Object.keys(deck).length) deck = null;
    }
    if (!deck) {
      if (created) reg.rooms.delete(id);                     // a fresh room that never claimed its seat does not linger
      return { ok: false, reason: 'the player seat needs a deck (a prebuilt deck id or a card map)' };
    }
    const token = 'r' + room.seq + '-' + Math.random().toString(36).slice(2, 12);
    // accountId/displayName are optional and only ever resolved server-side (run.mjs passes them from the
    // session cookie, never from the wire): a guest seat keeps both null and records with a "Player" name.
    room.seats.player = {
      token,
      deck,
      key: msg.key != null ? String(msg.key).slice(0, 80) : null,
      accountId: msg.accountId != null ? String(msg.accountId).slice(0, 64) : null,
      displayName: msg.displayName != null ? String(msg.displayName).slice(0, 40) : null,
    };
    return { ok: true, room, seat: 'player', viewerKey: 'player', token, again: false, seats: { player: true } };
  }
  return { ok: true, room, seat: null, viewerKey: null, token: null, again: false, seats: { player: !!room.seats.player } };
}
