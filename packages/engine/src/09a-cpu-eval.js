/* ---------------------------------------------------------------------
   CPU EVALUATION POLICY (v0.32, Aegis study point 7)
   Every decision scores its legal options in one unit and takes the best;
   passing scores 0, so the CPU never acts just because it can pay.
   Personalities are weight sets only (never code branches).
   --------------------------------------------------------------------- */
const CPU_PROFILES = {
  balanced:   { life: 10, oppLife: 10, unit: 1, bp: 1, symbol: 3, cost: 0.6, spirit: 2, nexus: 4, coreUse: 0.4, risk: 1, guard: 1 },
  aggressive: { life: 7, oppLife: 14, unit: 1, bp: 1, symbol: 4, cost: 0.6, spirit: 2, nexus: 3, coreUse: 0.3, risk: 0.6, guard: 0 },
  defensive:  { life: 14, oppLife: 8, unit: 1.2, bp: 1, symbol: 3, cost: 0.6, spirit: 2.5, nexus: 4, coreUse: 0.5, risk: 1.5, guard: 2 },
};
const CPU_PROFILE_NAMES = Object.keys(CPU_PROFILES);
let CPU_SIM_PROFILES = {};          // test hook: per-side profile for CPU-vs-CPU matches
function cpuProfileName(p) {
  const n = (p && p.cpuProfile) || CPU_SIM_PROFILES[p && p.key] || SETTINGS.cpuProfile;
  return CPU_PROFILES[n] ? n : 'balanced';
}
function cpuW(p) { return CPU_PROFILES[cpuProfileName(p)]; }
/* Life is worth more the less of it is left: losing the last core is the whole game */
function lifeValue(l) { return l <= 0 ? -100 : l + 6 * (1 - Math.pow(0.6, l)); }
function lifeLoss(l, dmg) { return lifeValue(l) - lifeValue(l - dmg); }
const symOf = s => (CARDS[s.id] ? attackSymbols(s) : 0);
/* value of one Spirit on the field (BP in thousands, symbols, printed cost as a proxy for its effects) */
function unitValue(s, W) {
  const c = CARDS[s.id];
  return W.spirit + W.bp * bpOf(s) / 1000 + W.symbol * symOf(s) + W.cost * (c.cost || 0);
}
/* the whole board from p's side in one unit; used by tests and to explain decisions */
function cpuEval(p, W = cpuW(p)) {
  const o = G.p[other(p.key)], side = (x, k) => x.spirits.reduce((s, f) => s + unitValue(f, W), 0) + W.nexus * x.nexus.length + 0.5 * x.hand.length + 0.3 * reserveTotal(x) * k;
  return Math.round((W.life * lifeValue(p.life) - W.oppLife * lifeValue(o.life) + W.unit * (side(p, 1) - side(o, 1))) * 100) / 100;
}
/* Main Step: score one card in Hand that cpuCanPlay already accepted (0 or less = do not play) */
function cpuPlayScore(p, h, W = cpuW(p)) {
  const c = CARDS[h.id], ec = effCost(p, c);
  if (c.type === 'Nexus') return p.nexus.some(n => n.id === h.id) || ec > 2 ? 0 : 5 * W.nexus - W.coreUse * ec;     // a cheap new Nexus first (old CPU order)
  if (c.type !== 'Spirit' && c.type !== 'Ultimate') return 0;
  const bp0 = (c.levels[0] && c.levels[0].bp) || 0;
  return W.spirit + W.bp * bp0 / 1000 + W.symbol * (c.symbols || 0) + W.cost * (c.cost || 0) + (c.cost || 0) * 0.05 - W.coreUse * ec;
}
/* v0.59.6 MATCH FUZZER hook (Q1 quality bundle, Aegis idea): while FUZZ[side] is on, that CPU picks a uniformly random legal option
   (or passes) at its play, attack and block decisions, drawing from the seeded game rng, so a fuzzed match replays from its seed +
   the same FUZZ setting (tools/fuzz.mjs, tests/fuzz-cases). Off in normal play. */
let FUZZ = {};
/* v0.137.0 CPU strength (play setup, mockup "Strength"): on Easy the CPU seat slips on 3 of 10 play, attack and block decisions (the same random pick as the fuzzer, from the seeded rng so the match still replays); Normal and Hard draw nothing */
const cpuSlips = p => !!(G && G.lvl === 'easy' && p.cpu && p.key === 'opponent' && rng() < 0.3);
function fuzzPick(p, opts) { if (!p || !opts.length || (!FUZZ[p.key] && !cpuSlips(p))) return undefined; const i = Math.floor(rng() * (opts.length + 1)); return i < opts.length ? opts[i] : null; }
function cpuPlayChoice(p, opts) {
  const fz = fuzzPick(p, opts); if (fz !== undefined) return fz;
  let best = null;
  for (const h of opts) { const sc = cpuPlayScore(p, h); if (sc > 0 && (!best || sc > best.sc)) best = { h, sc }; }
  return best ? best.h : null;
}
/* lethal check: even if every ready blocker stops one of the attackers with the most symbols, the rest finish the opponent */
/* v0.42 "Unless the opponent discards a Magic card" (OPP_DISCARD_MAGIC_OR): the CPU pays with its cheapest Magic card when it holds two or more
   (spare card) or when its Life is 2 or less (every effect hurts more); otherwise it keeps the Magic cards. Returns the card to discard or null. */
function cpuKeepMagicOrPay(p, c, M) {
  if (!M.length) return null;
  if (M.length < 2 && p.life > 2) return null;
  return M.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0];
}
function cpuLethal(p) {
  const o = G.p[other(p.key)];
  const att = p.spirits.filter(s => !s.exhausted && !s.noAB && symOf(s) > 0).sort((a, b) => symOf(b) - symOf(a));
  const blocks = o.spirits.filter(s => canBlockState(o, s)).length;
  const through = att.slice(blocks).reduce((n, s) => n + symOf(s), 0);
  return att.length > 0 && through >= o.life;
}
/* how many of my Spirits should stay ready to block: enough when the opponent's next attack could take most of my Life */
function guardNeed(p, W) {
  const o = G.p[other(p.key)], threat = o.spirits.reduce((n, s) => n + symOf(s), 0);
  if (!o.spirits.length) return 0;
  if (threat >= p.life) return Math.min(o.spirits.length, Math.ceil(W.guard));
  return p.life <= 2 ? 1 : 0;
}
/* Attack Step: score attacking with a; 0 or less = keep it home */
function cpuAttackScore(p, a, W = cpuW(p)) {
  const o = G.p[other(p.key)], oppB = o.spirits.filter(s => !s.exhausted && !s.noAB), sym = symOf(a), abp = bpOf(a);
  const dmg = W.oppLife * lifeLoss(o.life, Math.min(sym, o.life));
  if (!oppB.length) return dmg + 0.1;
  const maxB = oppB.reduce((m, b) => Math.max(m, bpOf(b)), 0);
  if (abp > maxB) return Math.max(0.5, Math.min(dmg, Math.min(...oppB.map(b => W.unit * unitValue(b, W))))) + 0.1;    // they take the hit or lose a blocker
  if (abp === maxB && o.life <= sym) return dmg;                                                                         // a trade at worst, game if unblocked
  return dmg * 0.25 - W.risk * W.unit * unitValue(a, W) - (abp === maxB ? 0 : 1);                                         // a stronger blocker waits
}
function cpuAttackChoice(p) {
  const ready = p.spirits.filter(s => !s.exhausted && !s.noAB && abTaxOK(p, s)).sort((a, b) => bpOf(b) - bpOf(a));
  if (!ready.length) return null;
  const fz = fuzzPick(p, ready); if (fz !== undefined) return fz;
  if (cpuLethal(p)) return ready.slice().sort((a, b) => symOf(b) - symOf(a) || bpOf(b) - bpOf(a))[0];
  const W = cpuW(p), keep = guardNeed(p, W);
  if (ready.length <= keep) return null;
  let best = null;
  for (const a of ready) { const sc = cpuAttackScore(p, a, W); if (sc > 0 && (!best || sc > best.sc)) best = { a, sc }; }
  return best ? best.a : null;
}
/* Block: compare taking the hit with each blocker; returns the best blocker or null (take the hit) */
function cpuBlockScore(d, att, b, W = cpuW(d)) {
  const abp = bpOf(att), bb = bpOf(b), mine = W.unit * unitValue(b, W), theirs = W.unit * unitValue(att, W), saved = W.life * lifeLoss(d.life, Math.min(symOf(att), d.life));
  if (bb > abp) return saved + theirs;
  if (bb === abp) return saved + theirs - mine;
  return saved - mine * (1 + W.risk) - 4 * W.unit;          // a chump block also costs the body's next attack
}
function cpuChooseBlock(d, att) {
  const blockers = d.spirits.filter(s => canBlockState(d, s));
  if (!blockers.length) return null;
  const fz = fuzzPick(d, blockers); if (fz !== undefined) return fz;
  const W = cpuW(d), lethalHit = symOf(att) >= d.life;
  let best = null;
  for (const b of blockers) {
    let sc = cpuBlockScore(d, att, b, W);
    if (lethalHit) sc += 1000;                            // must block; the scores still prefer a winner, else the cheapest body
    else sc -= 0.01 * bpOf(b) / 1000;                     // equal value: block with the weaker one
    if (!best || sc > best.sc) best = { b, sc };
  }
  return best && best.sc > 0 ? best.b : null;
}
function setCpuProfile(name, side) {
  if (!CPU_PROFILES[name]) return false;
  if (side) CPU_SIM_PROFILES[side] = name; else { SETTINGS.cpuProfile = name; saveSettings(); }
  return true;
}
