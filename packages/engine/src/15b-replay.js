/* ---------------------------------------------------------------------
   REPLAY RECORDS (v0.85.0, phase F4 = monorepo step M4 part 1; docs/ai/monorepo-plan.md "Design" 2)
   Port input record (v 2): what a host answered through io.decide, so any host re-runs the match: the web game, the
   headless runner (packages/engine/headless.mjs replayPort) and later the server. Kept in G.prec by every match:
     {v: 2, build, seed, format, sim, watch, deckA, deckB, human: [seat], cpu: {profiles, fuzz} | null,
      answers: [{s: seat, k: kind, v: answer}], wait: {s, k} | null (a decision is open), final: matchSummary() | absent}
   Answers come from 05b-decide.js (portAsk): choices, picks, payments, info, and the action intents of 05c-intent.js.
   CPU seats answer the port too (v0.105.0, M6 step 1); the replay re-derives their decisions locally with cpuAnswer - a
   record holds each CPU answer only as the witness of a port round. Records of older builds have no CPU answers and
   replay the same way. portRecord() adds `cut` {log, hash} (the log count and hash at a
   moment a decision is open), so a record of an unfinished match is checked up to that moment. The record depends on the
   engine version (`build`); the v1 record of v0.26 (G.rec, web clicks) stays for the browser replay.
   Viewer replay (v 1): {v: 1, kind: 'aeterna-viewer', build, seed, frames: [boardSnapshot()]}: plain board frames that
   play back without the engine; exported from a port record by headless viewerReplay().
   --------------------------------------------------------------------- */
function newPortRecord(seed, deckA, deckB, watch, keyA, keyB) {
  const human = ['player', 'opponent'].filter(k => G.p[k] && !G.p[k].cpu);
  return { v: 2, build: VERSION, s: SESSION, seed, format: FORMAT, sim: SIM, watch: !!watch, deckA: Object.assign({}, deckA), deckB: Object.assign({}, deckB), human, keyA: keyA || null, keyB: keyB || null, keyW: KEY_WEIGHT,
    cpu: SIM ? { profiles: Object.assign({}, CPU_SIM_PROFILES), fuzz: Object.assign({}, FUZZ) } : null, answers: [], wait: null };
}
/** A copy of the current match's port record; `cut` when a decision is open now (the match waits for a host). */
function portRecord() {
  if (!G || !G.prec) return null;
  const r = JSON.parse(JSON.stringify(G.prec)); delete r.s;
  if (G.prec.wait && !G.over) r.cut = { log: G.hn || 0, hash: (G.hh >>> 0).toString(16) };
  delete r.wait;
  return r;
}
/** One viewer-replay frame: the visible board as plain data. No argument keeps the local viewer semantics of v0.104:
 *  a CPU seat's Hand and Burst are a count / "set", the human's own are shown. M6 server (v0.105.0): pass the room seat
 *  key ('player' / 'opponent') to stream that seat its full Hand and Burst only, or null for a spectator who is shown
 *  every Hand as a count and every Burst as "set" - hidden-card ids never leave the server through this filter. */
function boardSnapshot(viewerKey) {
  // h / bp (v0.108.0, M8 online client): the online board reads a frame without the engine, so a field card carries its
  // heavy flag and its current BP as the engine computes them (buffs, Brave and Over Count included) - display only.
  const fc = f => ({ id: f.id, uid: f.uid, c: f.cores, s: f.soul ? 1 : 0, x: f.exhausted ? 1 : 0, h: f.heavy ? 1 : 0, lv: lvNo(f), bp: bpOf(f), u: f.under.length ? f.under.map(x => x.id) : undefined, b: f.brave ? f.brave.id : undefined });
  const local = viewerKey === undefined;         // the same call as every viewer replay up to v0.104
  const side = p => ({
    name: p.name, life: p.life, ls: p.lifeSoul ? 1 : 0, res: p.reserve.n, rs: p.reserve.soul ? 1 : 0, tc: p.trashCores.n, ts: p.trashCores.soul ? 1 : 0, count: p.count, deck: p.deck.length,
    hand: local ? (p.cpu ? p.hand.length : p.hand.map(h => h.id)) : (p.key === viewerKey ? p.hand.map(h => h.id) : p.hand.length),
    hu: !local && p.key === viewerKey ? p.hand.map(h => h.uid) : undefined,   // v0.108.0 (M8): the seat's hand uids, same order as `hand`, so the online client can send intents by uid
    spirits: p.spirits.map(fc), nexus: p.nexus.map(fc), trash: p.trash.map(x => x.id), soulState: p.soulState.map(x => x.id),
    removed: p.removed.map(x => x.id), burst: p.burst ? (local ? (p.cpu ? 'set' : p.burst.id) : (p.key === viewerKey ? p.burst.id : 'set')) : null, mirage: p.mirage ? p.mirage.id : null
  });
  // v0.110.0 (M8 part 3): log = the recent game log for the online client's log panel. Only for a seat view
  // (local viewer replays keep their own record and need no log); capped so the frame stays bounded. The log
  // is shared public text (face-down Bursts and draws are never logged by name), so it carries no hidden cards.
  const log = !local ? G.history.slice(-200) : undefined;
  return { t: G.turnNo, st: G.step, sn: G.steps[G.step] || '', steps: G.steps.slice(), a: G.active, n: G.hn || 0, last: G.history.length ? G.history[G.history.length - 1] : '', log, over: !!G.over, w: G.winner || null, p: { player: side(G.p.player), opponent: side(G.p.opponent) } };
}
/** Re-runs a port record in this engine (any host: headless, or the web page when no match is open). Every decision is
 *  answered from the record in order (same seat and kind, else "diverged at answer N"); the host is restored afterwards.
 *  Resolves { ok, reason, at, total, over, final, same, cut, sameCut, build, recBuild, frames? } (frames: viewer: true).
 * @returns {Promise<PortRunResult>} */
async function runPortRecord(rec, opts) {
  opts = opts || {};
  if (rec && rec.port && rec.port.v === 2) rec = rec.port;           // a fuzz case file
  if (!rec || rec.v !== 2 || !Array.isArray(rec.answers) || !rec.deckA || !rec.deckB || rec.seed == null) return { ok: false, reason: 'not a port record (v 2)' };
  if (!!rec.sim !== SIM) return { ok: false, reason: rec.sim ? 'a CPU-vs-CPU sim record: replay it with packages/engine/headless.mjs --replay' : 'a record of a real match: this page runs sims only' };
  const frames = [], MAXF = opts.maxFrames || 4000, fmt = FORMAT, errors = [];
  let i = 0, stop = null, last = '';
  const never = () => new Promise(() => {});
  const prev = bindHost({
    name: 'replay',
    view(ev) { if (opts.viewer && ev.type === 'board' && G && frames.length < MAXF) { const f = JSON.stringify(boardSnapshot()); if (f !== last) { frames.push(JSON.parse(f)); last = f; } } },
    log() {},
    decide(seat, d) {
      if (stop) return never();
      // v0.105.0 (M6 step 1): CPU seats are re-derived here exactly as the answering host did (cpuAnswer). The record
      // holds those answers as the witness only - consuming them would skip the inner CPU RNG draws (the fuzzer) and shift the stream.
      if (d && d.cpu) return Promise.resolve(cpuAnswer(seat, d));
      if (rec.human) while (i < rec.answers.length && !rec.human.includes(rec.answers[i].s)) i++;   // skip the CPU witness entries
      const a = rec.answers[i];
      if (a && a.s === seat && a.k === d.kind) { i++; return Promise.resolve(a.v); }
      if (!a) { stop = 'end'; return never(); }                     // the record ends: the match waits here
      stop = `diverged at answer ${i}: the engine asks ${seat} for ${d.kind}, the record has ${a.s} ${a.k}`; return never();
    }
  });
  const fast = REPLAY, simH = SIM_HUMAN, prof = CPU_SIM_PROFILES, fz = FUZZ;
  REPLAY = { fast: true, i: 0, port: true };
  if (rec.format && rec.format !== FORMAT) setFormat(rec.format);
  if (SIM) { SIM_HUMAN = (rec.human || []).includes('player'); CPU_SIM_PROFILES = Object.assign({}, rec.cpu && rec.cpu.profiles); FUZZ = Object.assign({}, rec.cpu && rec.cpu.fuzz); }
  const t0 = Date.now(), timeoutMs = opts.timeoutMs || 60000;
  /** @type {PortRunResult} */
  let res;
  try {
    startNewGame({ seed: rec.seed, deckA: rec.deckA, deckB: rec.deckB, noHistory: true, watch: !!rec.watch, keyA: rec.keyA, keyB: rec.keyB }).catch(e => { if (e !== ABORT && errors.length < 3) errors.push(String(e && e.message)); });
    while (!(G && G.over) && !stop && !errors.length && Date.now() - t0 < timeoutMs) await new Promise(r => setTimeout(r, 2));
    const over = !!(G && G.over), final = over ? matchSummary() : null, cut = G ? { log: G.hn || 0, hash: (G.hh >>> 0).toString(16) } : null;
    const same = !!(rec.final && final && ['winner', 'turn', 'log', 'hash'].every(k => rec.final[k] === final[k]));
    const sameCut = !!(rec.cut && cut && stop === 'end' && rec.cut.log === cut.log && rec.cut.hash === cut.hash);
    const humanN = rec.human ? rec.answers.filter(x => rec.human.includes(x.s)).length : rec.answers.length;      // v0.105.0 (M6 step 1): only the human answers are consumed; a CPU witness may stay over
    const reason = errors.length ? 'error: ' + errors[0] : stop && stop !== 'end' ? stop : !over && !stop ? 'time limit' : over && i < humanN ? `${humanN - i} answers are left after the end of the match` : '';
    res = { ok: !reason, reason, at: i, total: rec.answers.length, over, final, same, cut, sameCut, build: VERSION, recBuild: rec.build };
    if (opts.viewer) res.frames = frames;
  } finally {
    io.host = prev; REPLAY = fast; if (FORMAT !== fmt) setFormat(fmt);
    if (SIM) { SIM_HUMAN = simH; CPU_SIM_PROFILES = prof; FUZZ = fz; }
    if (opts.close) { SESSION++; G = null; }                         // the web page: drop the replayed (maybe waiting) match
  }
  return res;
}
/** Viewer replay (v 1) of a port record: board frames that play back in any later version without the engine. */
async function viewerReplayOf(rec, opts) {
  const r = await runPortRecord(rec, Object.assign({}, opts, { viewer: true }));
  if (!r.ok) return { ok: false, reason: r.reason };
  const p = rec.port && rec.port.v === 2 ? rec.port : rec;
  return { ok: true, replay: { v: 1, kind: 'aeterna-viewer', build: r.build, seed: p.seed, final: r.final, frames: r.frames } };
}
