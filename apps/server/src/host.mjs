/* ---------------------------------------------------------------------
   M6 ROOM HOST (docs/ai/monorepo-plan.md M6, v0.105.0): the pure engine-port adapter of one room. The room's engine
   runs in its own node:vm context (loadEngine, packages/engine/headless.mjs) - this host binds the port io of that
   context exactly once: view events become coalesced seat-filtered frames (src/views.mjs), the bot seat answers the
   port through the engine's own cpuAnswer (the M6 plan), and the human seat's open decision is delivered to the
   transport and awaits the reply; a configured timeout answers it with cpuAnswer as well (v1 policy, never hangs).
   No transports, no packages: the ws wrapper (run.mjs) is the only caller besides the tests.
   --------------------------------------------------------------------- */
import { frameFor, leaks } from './views.mjs';

const deckOf = (E, d) => (typeof d === 'string' ? (E.PREBUILT.find(x => x.id === d) || { cards: null }).cards : d);

export function newRoomHost(E, opts) {
  opts = opts || {};
  const send = opts.send || (() => {});                       // send(msg, viewerKey): route to the viewers of that key
  const now = opts.now || (() => Date.now());
  const decideTimeoutMs = opts.decideTimeoutMs != null ? opts.decideTimeoutMs : null;   // null: wait forever
  const viewers = new Set();
  const H = {
    E, started: null, over: false, error: null, summary: null, record: null, open: null, timedOut: 0, flushes: 0,
    start: null, answer: null, answerCPU: null, snapshot: null, pending: null, register: null, unregister: null, stop: null
  };
  let dirty = false, flushTimer = null;

  const frameGuard = key => {
    const bad = leaks(frameFor(E, key), key);
    if (bad.length) { H.error = 'view guard: ' + bad.join('; '); return true; }   // a broken frame is dropped, never sent
    return false;
  };
  const pushFrame = key => { if (!E.G || frameGuard(key)) return; send({ t: 'view', frame: frameFor(E, key) }, key); H.flushes++; };
  const broadcast = msg => { for (const key of viewers) send(msg, key); };

  const flush = () => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    if (!E.G) return;
    if (E.G.over && !H.over) {
      H.over = true;
      H.summary = E.matchSummary();
      try { H.record = E.portRecord(); } catch (e) { H.record = null; H.error = H.error || 'record: ' + e.message; }
      broadcast({ t: 'over', summary: H.summary });
    }
    for (const key of viewers) pushFrame(key);
  };
  const schedule = () => { dirty = true; if (!flushTimer) flushTimer = setTimeout(flush, 0); };

  async function onDecide(seat, d) {
    if (d.cpu) return E.cpuAnswer(seat, d);                    // M6: the bot seat answers the port with the engine's own policy
    d = JSON.parse(JSON.stringify(d));                         // the wire copy: the record is plain data by the protocol docs
    const opened = { seat, d, since: now(), timer: null };
    H.open = opened;
    send({ t: 'decide', d }, seat);
    const v = await new Promise(res => {
      opened.resolve = null;
      if (decideTimeoutMs != null) opened.timer = setTimeout(() => {
        if (H.open !== opened) return;
        H.timedOut++;
        const a = E.cpuAnswer(seat, d);
        H.open = null;
        send({ t: 'note', who: seat, text: 'the decision timed out; the bot answered it' }, seat);
        res(a);
      }, decideTimeoutMs);
      opened.resolve = res;
    });
    return v == null && (d.kind === 'action' || d.kind === 'payment') ? E.cpuAnswer(seat, d) : v;   // headless parity: no answer for action/payment falls back to the bot
  }

  E.bindHost({
    name: 'server',
    view(ev) {
      if (!ev || !E.VIEW_TYPES.includes(ev.type)) { H.error = 'unknown view record ' + JSON.stringify(ev); return; }   // never throw inside the engine's sync path
      schedule();
    },
    log() {},
    decide: onDecide
  });

  const closeOpen = (seat, value) => {
    const o = H.open;
    if (!o || o.seat !== seat) return { ok: false, reason: 'no open decision for ' + seat };
    H.open = null;
    clearTimeout(o.timer);
    o.resolve(value);
    return { ok: true };
  };

  /** Starts the room's match once: deck/deckB are prebuilt deck ids or full {cardId: count} maps. deckB is REQUIRED:
   *  the engine's own CPU pick (cpuDeckFor) consumes the rng seed whenever the settings deck is not legal in the room's
   *  format, which shifts every draw after it - the recorded run could then never replay the record it just wrote
   *  (the replay passes deckB concretely, see runPortRecord). seed omitted is a real random seed; keyA/keyB: optional
   *  Key Spirit ids. The engine promise is fire-and-forget: the io events (frames, decides, over) drive everything else. */
  H.start = cfg => {
    cfg = cfg || {};
    if (H.started) return { ok: false, reason: 'the match already started' };
    const A = deckOf(E, cfg.deck);
    if (!A) return { ok: false, reason: 'unknown deck ' + JSON.stringify(cfg.deck) };
    const B = cfg.deckB == null ? null : deckOf(E, cfg.deckB);
    if (!B) return { ok: false, reason: 'deckB is required and must be a known deck id (got ' + JSON.stringify(cfg.deckB) + ')' };
    H.started = { deck: JSON.parse(JSON.stringify(A)), deckB: (typeof cfg.deckB === 'string' ? cfg.deckB : null), seed: cfg.seed != null ? ((cfg.seed >>> 0) || 1) : undefined, at: now() };
    E.startNewGame({ seed: cfg.seed != null ? ((cfg.seed >>> 0) || 1) : undefined, deckA: A, deckB: B, noHistory: true, keyA: cfg.keyA != null ? cfg.keyA : null, keyB: cfg.keyB != null ? cfg.keyB : null }).catch(e => {
      if (e === E.ABORT || H.over) return;                     // H.stop aborts the match on purpose: not a room error
      H.error = 'match threw: ' + (e && e.message ? e.message : String(e));
      broadcast({ t: 'error', message: H.error });
    });
    return { ok: true };
  };
  /** Stops the room (tests and the server close): the open decision and its timeout timer are dropped and the engine's match aborts. */
  H.stop = () => {
    const o = H.open;
    if (o) { H.open = null; clearTimeout(o.timer); }
    try { E.closeMatch(); } catch (e) { /* the aborted chains may rethrow through closed timers: the room is dead anyway */ }
  };
  /** The human seat answers the open decision with a plain value. */
  H.answer = (seat, v) => closeOpen(seat, JSON.parse(JSON.stringify(v === undefined ? null : v)));
  /** The scripted/reconnected client's fallback: the engine's own CPU re-derives the answer of the open decision. */
  H.answerCPU = seat => {
    const o = H.open;
    return o && o.seat === seat ? closeOpen(seat, E.cpuAnswer(seat, o.d)) : { ok: false, reason: 'no open decision for ' + seat };
  };
  /** The current frame of a viewer key (null before the match started) and the open decision (reconnect sends both). */
  H.snapshot = key => (E.G ? frameFor(E, key) : null);
  H.pending = () => (H.open ? { seat: H.open.seat, d: JSON.parse(JSON.stringify(H.open.d)) } : null);
  /** A viewer attached: the current frame, then the open decision if the viewer owns it (one reconnect call). */
  H.register = key => {
    key = key === undefined ? null : key;
    viewers.add(key);
    pushFrame(key);
    const o = H.pending();
    if (o && o.seat === key) send({ t: 'decide', d: o.d }, key);
  };
  H.unregister = key => { viewers.delete(key === undefined ? null : key); };
  return H;
}
