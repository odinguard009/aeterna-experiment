/* ---------------------------------------------------------------------
   STORE: the persistence contract of the server (roadmap M7 step 2)

   One small API over accounts, deck slots, matches and replays, with two
   implementations:
     * memoryStore()  - the reference, pure JS, used by tests and by a local
                        server that runs without a database;
     * store-pg.mjs   - the same calls against Postgres (db/migrations/).

   The contract is deliberately narrow. The engine is authoritative for rules,
   so a match is stored as its INPUTS (seed, both decks, every answered
   decision) plus the outcome and the log hash: replaying the record must
   reproduce that hash. Nothing derived from game state is written, which is
   what keeps a schema change cheap.

   The validation here mirrors the CHECK constraints of the migration on
   purpose. The database stays the last word, but a caller should not have to
   reach Postgres to learn that a format name is wrong - and the parity test
   (tests/unit/server_store.test.mjs) keeps the two lists from drifting.
   --------------------------------------------------------------------- */
export const FORMATS = ['standard', 'eternal'];
export const SEATS = ['player', 'opponent'];
export const SLOT_RANGE = { min: 1, max: 8 };

const isStr = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (msg) => { throw new TypeError('store: ' + msg); };

/** Account shape check shared by both implementations. */
export function checkAccount(a) {
  if (!isObj(a)) fail('account must be an object');
  if (!isStr(a.id, 8, 64)) fail('account id must be a uuid string');
  if (a.email != null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(a.email))) fail('account email is not an address');
  if (a.discordId != null && !isStr(String(a.discordId), 5, 40)) fail('account discordId must be 5-40 characters');
  if (a.email == null && a.discordId == null) fail('an account needs an email or a discordId to be reachable');
  if (!isStr(a.displayName, 1, 40)) fail('account displayName must be 1-40 characters');
  return a;
}

/** Deck slot shape check (the local slot list of 04-decks.js, server side). */
export function checkDeckSlot(d) {
  if (!isObj(d)) fail('deck slot must be an object');
  if (!isStr(d.id, 8, 64)) fail('deck slot id must be a uuid string');
  if (!isStr(d.accountId, 8, 64)) fail('deck slot accountId must be a uuid string');
  if (!Number.isInteger(d.slot) || d.slot < SLOT_RANGE.min || d.slot > SLOT_RANGE.max) fail(`deck slot number must be ${SLOT_RANGE.min}-${SLOT_RANGE.max}`);
  if (!isStr(d.name, 1, 60)) fail('deck slot name must be 1-60 characters');
  if (!FORMATS.includes(d.format)) fail('deck slot format must be one of ' + FORMATS.join('/'));
  if (!isObj(d.cards)) fail('deck slot cards must be a {cardId: copies} map');
  for (const [k, v] of Object.entries(d.cards)) if (!isStr(k, 1, 40) || !Number.isInteger(v) || v < 1 || v > 3) fail(`deck slot card ${k}: copies must be 1-3`);
  if (d.keyCard != null && !isStr(d.keyCard, 1, 40)) fail('deck slot keyCard must be a card id');
  if (d.sleeve != null && !isObj(d.sleeve)) fail('deck slot sleeve must be an object');
  return d;
}

/**
 * Login token / session row: addressed by the sha256 of the token, never by the token itself.
 * expiresAt is passed in so the caller owns the clock (a test needs no sleep).
 */
export function checkAuthRow(r, what) {
  if (!isObj(r)) fail(what + ' must be an object');
  if (!/^[0-9a-f]{64}$/.test(String(r.tokenHash || ''))) fail(what + ' tokenHash must be a sha256 hex');
  if (!isStr(r.accountId, 8, 64)) fail(what + ' accountId must be a uuid string');
  const at = Date.parse(r.expiresAt);
  if (!Number.isFinite(at)) fail(what + ' expiresAt must be an ISO timestamp');
  return r;
}

/** Match shape check: the inputs plus the outcome, never derived state. */
export function checkMatch(m) {
  if (!isObj(m)) fail('match must be an object');
  if (!isStr(m.id, 8, 64)) fail('match id must be a uuid string');
  if (m.roomCode != null && !isStr(m.roomCode, 1, 24)) fail('match roomCode must be 1-24 characters');
  if (!FORMATS.includes(m.format)) fail('match format must be one of ' + FORMATS.join('/'));
  if (!Number.isInteger(m.seed) || m.seed < 1) fail('match seed must be a positive integer');
  if (!isObj(m.deckA) || !isObj(m.deckB)) fail('match needs both decks (deckA, deckB)');
  if (!isStr(m.build, 1, 20)) fail('match build must be the engine version that played it');
  if (m.winner != null && !SEATS.includes(m.winner)) fail('match winner must be player/opponent or null');
  if (m.turns != null && (!Number.isInteger(m.turns) || m.turns < 0)) fail('match turns must be a whole number');
  if (!Array.isArray(m.seats) || m.seats.length !== 2) fail('match needs exactly two seats');
  for (const s of m.seats) {
    if (!SEATS.includes(s && s.seat)) fail('match seat must be player/opponent');
    if (s.accountId != null && !isStr(s.accountId, 8, 64)) fail('match seat accountId must be a uuid string');
    if (!isStr(s.displayName, 1, 40)) fail('match seat displayName must be 1-40 characters');
    if (s.isBot != null && typeof s.isBot !== 'boolean') fail('match seat isBot must be a boolean');
  }
  if (new Set(m.seats.map((s) => s.seat)).size !== 2) fail('match seats must be distinct');
  if (m.replay != null) {
    if (!isObj(m.replay.record)) fail('match replay needs the port record');
    if (!isStr(m.replay.logHash, 4, 64)) fail('match replay needs its log hash');
  }
  return m;
}

/** Copy so a caller cannot mutate stored state through the object it passed in. */
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * The reference store: everything in memory, same contract, no dependencies.
 * Used by the server when no database is configured and by the tests.
 */
export function memoryStore() {
  const accounts = new Map();          // id -> account
  const decks = new Map();             // `${accountId}:${slot}` -> deck slot
  const matches = new Map();           // id -> { ...match, seats, replay }
  const logins = new Map();            // tokenHash -> login token row
  const sessions = new Map();          // tokenHash -> session row

  return {
    kind: 'memory',
    accounts: {
      async create(a) {
        const acc = { email: null, discordId: null, ...checkAccount(a) };
        if (accounts.has(acc.id)) fail('account id already exists: ' + acc.id);
        for (const other of accounts.values()) {
          if (acc.email != null && other.email === acc.email) fail('email already registered');
          if (acc.discordId != null && other.discordId === acc.discordId) fail('discordId already registered');
        }
        accounts.set(acc.id, clone(acc));
        return clone(acc);
      },
      async byLogin({ email = null, discordId = null } = {}) {
        for (const a of accounts.values()) if ((email && a.email === email) || (discordId && a.discordId === discordId)) return clone(a);
        return null;
      },
      async get(id) { return accounts.has(id) ? clone(accounts.get(id)) : null; },
    },
    decks: {
      async put(d) {
        const slot = { keyCard: null, sleeve: null, ...checkDeckSlot(d) };
        if (!accounts.has(slot.accountId)) fail('deck slot account does not exist: ' + slot.accountId);
        decks.set(`${slot.accountId}:${slot.slot}`, clone(slot));      // one row per (account, slot), as the UNIQUE key says
        return clone(slot);
      },
      async list(accountId) {
        return [...decks.values()].filter((d) => d.accountId === accountId).sort((a, b) => a.slot - b.slot).map(clone);
      },
    },
    // login tokens (magic links) and sessions: both single-purpose rows keyed by a token hash
    auth: {
      async putLogin(r) {
        const row = checkAuthRow({ usedAt: null, ...r }, 'login token');
        if (logins.has(row.tokenHash)) fail('login token already exists');
        logins.set(row.tokenHash, clone(row));
        return clone(row);
      },
      /** Single use: a token that is expired, unknown or already used answers null. */
      async takeLogin(tokenHash, nowIso = new Date().toISOString()) {
        const row = logins.get(tokenHash);
        if (!row || row.usedAt || Date.parse(row.expiresAt) <= Date.parse(nowIso)) return null;
        row.usedAt = nowIso;
        return row.accountId;
      },
      async putSession(r) {
        const row = checkAuthRow(r, 'session');
        sessions.set(row.tokenHash, clone(row));
        return clone(row);
      },
      /** Live session -> account id; an expired row is dropped on the way out. */
      async session(tokenHash, nowIso = new Date().toISOString()) {
        const row = sessions.get(tokenHash);
        if (!row) return null;
        if (Date.parse(row.expiresAt) <= Date.parse(nowIso)) { sessions.delete(tokenHash); return null; }
        return row.accountId;
      },
      async dropSession(tokenHash) { return sessions.delete(tokenHash); },
      async dropAccountSessions(accountId) {
        let n = 0;
        for (const [h, r] of sessions) if (r.accountId === accountId) { sessions.delete(h); n++; }
        return n;
      },
    },
    matches: {
      async record(m) {
        const match = checkMatch(m);
        if (matches.has(match.id)) fail('match id already recorded: ' + match.id);
        for (const s of match.seats) if (s.accountId != null && !accounts.has(s.accountId)) fail('match seat account does not exist: ' + s.accountId);
        matches.set(match.id, clone({ seats: match.seats, replay: match.replay || null, ...match }));
        return clone(matches.get(match.id));
      },
      async get(id) { return matches.has(id) ? clone(matches.get(id)) : null; },
      async listOf(accountId, { limit = 20 } = {}) {
        return [...matches.values()]
          .filter((m) => m.seats.some((s) => s.accountId === accountId))
          .sort((a, b) => (b.turns || 0) - (a.turns || 0) || (a.id < b.id ? -1 : 1))
          .slice(0, Math.max(1, Math.min(100, limit)))
          .map(clone);
      },
      async replay(id) {
        const m = matches.get(id);
        return m && m.replay ? clone(m.replay) : null;
      },
    },
  };
}
