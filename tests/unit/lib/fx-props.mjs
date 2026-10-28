// K2 (v0.69.2) generated tests per compiled action: one quiet board per action of a shipped card, built from the action JSON alone.
// Each generator states the property its sentence promises (e.g. DESTROY bpLe N: an opposing Spirit at N BP is destroyed, one at
// N+1000 is not), so a promoted card needs no hand-written test unless its effect is new. Unknown keys or shapes are not guessed:
// caseFor() returns { skip: '<shape>' } and the test lists them, so coverage grows only where a generator exists.
// Boards use synthetic fixtures (fixtureCards()), never pack cards, so a card data change cannot break a generator.

export const FIX_PREFIX = 'FXP-';
const sid = (cost, bp) => `${FIX_PREFIX}S${cost}-${bp}`;        // vanilla red Spirit, LV1 at 1 core
const nid = cost => `${FIX_PREFIX}N${cost}`;                     // vanilla red Nexus
const FILL = `${FIX_PREFIX}F`;                                   // filler for decks

/** Keys that never change what an action does on a board (the trigger gate `if` is tested with the trigger, not the action). */
const IGNORED = new Set(['do', 'if']);

/** The shape key of an action: its verb plus its sorted keys, e.g. "DESTROY{bpLe,thenDraw}". */
export function shapeOf(a) { return `${a.do}{${Object.keys(a).filter(k => !IGNORED.has(k)).sort().join(',')}}`; }

const only = (a, allowed) => Object.keys(a).every(k => IGNORED.has(k) || allowed.includes(k));
const J = v => JSON.stringify(v);

/* Board helpers available to every body (evaluated in the page):
   P / O players (P.cpu so targets are chosen without a dialog), sp(id, q, cores), nx(id, q), dk(id, q), src (the card under test,
   placed on the field only when the action needs it), run(src, action, ctx) -> ctx after BS.runActions. A = the action the property is about, RA = the action run (equal, except in the mutation check). A body returns '' or an error. */
export const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; q.life = 3; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; }, nx = (id, q = P) => { const i = BS.mkInst(id); i.cores = 0; q.nexus.push(i); return i; }, dk = (id, q = P) => { const i = BS.mkInst(id); q.deck.push(i); return i; };
  const place = id => { const k = BS.CARDS[id]; if (k.type === 'Nexus') return nx(id); const lv = (k.levels || [])[0]; return sp(id, P, Math.max(1, (lv && lv.cores) || 1)); };
  const run = async (src, a, ctx = {}) => { await BS.runActions({ p: P, opp: O, src, ctx }, { actions: [a] }); return ctx; };
  const gone = (t, q = O) => !q.spirits.includes(t) && !q.nexus.includes(t);`;

/* A fixture that matches a simple `match` (family / type / costLe / color): its id is derived from the match, so one card per match. */
const MATCH_KEYS = ['family', 'type', 'costLe', 'color'];
const okMatch = m => m && Object.keys(m).every(k => MATCH_KEYS.includes(k)) && (!m.type || m.type === 'Spirit' || m.type === 'Nexus') && (!m.family || m.family.length > 0);
const mid = m => `${FIX_PREFIX}M-` + [...JSON.stringify(m)].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261).toString(36);
const fillMatches = m => (!m.family || m.family.includes('FXP')) && (!m.type || m.type === 'Spirit') && (m.costLe == null || m.costLe >= 1) && (!m.color || m.color === 'red');
function matchCard(m) {
  const type = m.type || 'Spirit', id = mid(m);
  return { id, name: id, type, color: m.color || 'red', cost: m.costLe != null ? m.costLe : 3, symbols: 1, levels: type === 'Nexus' ? [{ cores: 0 }] : [{ cores: 1, bp: 2000 }], families: m.family ? [m.family[0]] : ['FXM'] };
}

/** Builds the fixture cards the cases need (import once with BS.importCards). */
export function fixtureCards(cases) {
  const need = new Map([[FILL, { id: FILL, name: FILL, type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }], families: ['FXP'] }]]);
  for (const c of cases) for (const f of c.fix || []) {
    if (f.m) need.set(mid(f.m), matchCard(f.m));
    else if (f.n != null) need.set(nid(f.n), { id: nid(f.n), name: nid(f.n), type: 'Nexus', color: 'red', cost: f.n, symbols: 1, levels: [{ cores: 0 }], families: ['FXP'] });
    else need.set(sid(f.cost, f.bp), { id: sid(f.cost, f.bp), name: sid(f.cost, f.bp), type: 'Spirit', color: 'red', cost: f.cost, symbols: 1, levels: [{ cores: 1, bp: f.bp }], families: ['FXP'] });
  }
  return [...need.values()];
}

// One body per property; `A` is the action JSON as a literal, `S` the source card id.
function destroyCase(card, a) {
  if (!only(a, ['bpLe', 'costLe', 'coresLe', 'costLeSelf', 'nexus', 'costRank', 'exhaustedOnly', 'thenDraw', 'noFx'])) return null;
  const bounds = ['bpLe', 'costLe', 'coresLe', 'costLeSelf', 'nexus', 'costRank'].filter(k => a[k] != null);
  if (bounds.length !== 1) return null;
  const k = bounds[0], ex = a.exhaustedOnly ? 'true' : 'false', draw = a.thenDraw || 0;
  const fin = `if (${draw} && P.hand.length !== ${draw}) return 'thenDraw: hand ' + P.hand.length;`;
  if (k === 'nexus') return { fix: [{ n: 2 }], body: `const t = nx(${J(nid(2))}, O); for (let j = 0; j < 4; j++) dk(${J(FILL)});
      await run(src, RA); if (!gone(t)) return 'the opposing Nexus is still there'; if (!O.trash.includes(t)) return 'the Nexus is not in the Trash'; ${fin} return '';` };
  if (k === 'costRank') return { fix: [{ cost: 2, bp: 3000 }, { cost: 5, bp: 3000 }], body: `const lo = sp(${J(sid(2, 3000))}, O), hi = sp(${J(sid(5, 3000))}, O); for (let j = 0; j < 4; j++) dk(${J(FILL)});
      if (${ex}) { lo.exhausted = true; hi.exhausted = true; }
      await run(src, RA); const want = A.costRank === 'lowest' ? lo : hi, keep = want === lo ? hi : lo;
      if (!gone(want)) return 'the ' + A.costRank + ' cost Spirit survived'; if (gone(keep)) return 'the other Spirit was destroyed too'; ${fin} return '';` };
  // bound -> (at, over) fixtures
  let at, over, cores = 1;
  if (k === 'bpLe') { at = { cost: 3, bp: a.bpLe }; over = { cost: 3, bp: a.bpLe + 1000 }; }
  else if (k === 'costLe') { at = { cost: a.costLe, bp: 3000 }; over = { cost: a.costLe + 1, bp: 3000 }; }
  else if (k === 'costLeSelf') { const c0 = card.cost; if (!Number.isInteger(c0)) return null; at = { cost: c0, bp: 3000 }; over = { cost: c0 + 1, bp: 3000 }; }
  else { if (a.coresLe < 1) return null; at = { cost: 3, bp: 3000 }; over = at; cores = a.coresLe; }
  const overCores = k === 'coresLe' ? a.coresLe + 1 : 1;
  return { fix: [at, over], body: `for (let j = 0; j < 4; j++) dk(${J(FILL)});
      let t = sp(${J(sid(at.cost, at.bp))}, O, ${cores}); if (${ex}) t.exhausted = true;
      let ctx = await run(src, RA); if (!gone(t)) return 'a target at the bound (${k} ' + ${J(String(a[k] === true ? card.cost : a[k]))} + ') survived'; if (!O.trash.includes(t)) return 'the target is not in the Trash'; ${fin}
      ${PRE_RESET}
      t = sp(${J(sid(over.cost, over.bp))}, O, ${overCores}); if (${ex}) t.exhausted = true;
      ctx = await run(src, RA); if (gone(t)) return 'a target one step over the bound was destroyed'; if (ctx.did !== false) return 'no target, but the action reports done';
      if (${ex}) { ${PRE_RESET} t = sp(${J(sid(at.cost, at.bp))}, O, ${cores}); await run(src, RA); if (gone(t)) return 'exhaustedOnly: a ready target was destroyed'; }
      return '';` };
}
// clears both fields between two boards inside one body
const PRE_RESET = `for (const q of [P, O]) { q.spirits = q.spirits.filter(x => x === src); q.nexus = q.nexus.filter(x => x === src); q.trash = []; q.hand = []; q.deck = []; } for (let j = 0; j < 4; j++) dk(${J(FILL)});`;

function exhaustCase(a, heavy) {
  if (!only(a, heavy ? ['n'] : ['n', 'costLe'])) return null;
  const c0 = a.costLe != null ? a.costLe : 3, flag = heavy ? 'heavy' : 'exhausted';
  const fix = [{ cost: c0, bp: 3000 }].concat(a.costLe != null ? [{ cost: c0 + 1, bp: 9000 }] : []);
  return { fix, body: `const L = []; for (let j = 0; j < A.n + 1; j++) L.push(sp(${J(sid(c0, 3000))}, O));
      const big = ${a.costLe != null ? `sp(${J(sid(c0 + 1, 9000))}, O)` : 'null'};
      await run(src, RA); const k = L.filter(t => t.${flag}).length;
      if (k !== A.n) return '${flag} ' + k + ' of ' + (A.n + 1) + ' matching Spirits, want ' + A.n;
      if (big && big.${flag}) return 'a Spirit over the cost bound was ${flag}';
      ${heavy ? '' : "if (O.spirits.some(t => t.heavy)) return 'a plain exhaust gave Heavy Exhaust';"} return '';` };
}

function bounceCase(a) {
  if (!only(a, ['kind', 'to', 'bpLe', 'costLe', 'exhaustedOnly'])) return null;
  if (!['spirit', 'nexus', 'any'].includes(a.kind) || !['hand', 'deckBottom'].includes(a.to)) return null;
  const nexus = a.kind === 'nexus', cost = a.costLe != null ? a.costLe : 3, bp = a.bpLe != null ? a.bpLe : 3000, ex = a.exhaustedOnly ? 'true' : 'false';
  const at = nexus ? { n: cost } : { cost, bp };
  const over = a.costLe != null ? (nexus ? { n: cost + 1 } : { cost: cost + 1, bp }) : a.bpLe != null ? { cost, bp: bp + 1000 } : null;
  const mk = f => f.n != null ? `nx(${J(nid(f.n))}, O)` : `sp(${J(sid(f.cost, f.bp))}, O)`;
  const where = a.to === 'hand' ? `O.hand.includes(t)` : `O.deck[O.deck.length - 1] === t`;
  return { fix: [at].concat(over ? [over] : []), body: `for (let j = 0; j < 3; j++) dk(${J(FILL)}, O);
      let t = ${mk(at)}; if (${ex}) t.exhausted = true;
      let ctx = await run(src, RA); if (!gone(t)) return 'the matching target is still on the field'; if (!(${where})) return 'the target did not go to ${a.to}';
      ${over ? `${PRE_RESET} t = ${mk(over)}; if (${ex}) t.exhausted = true; ctx = await run(src, RA); if (gone(t)) return 'a target over the bound was returned';` : ''}
      if (${ex}) { ${PRE_RESET} t = ${mk(at)}; await run(src, RA); if (gone(t)) return 'exhaustedOnly: a ready target was returned'; }
      return '';` };
}

function bpMinusCase(a) {
  if (!only(a, ['n', 'zeroDestroy'])) return null;
  return { fix: [{ cost: 3, bp: a.n + 1000 }, { cost: 3, bp: a.n }], body: `let t = sp(${J(sid(3, a.n + 1000))}, O);
      await run(src, RA); if (BS.bpOf(t) !== 1000) return 'BP after -' + A.n + ' is ' + BS.bpOf(t) + ', want 1000'; if (gone(t)) return 'a Spirit with BP left was destroyed';
      ${PRE_RESET} t = sp(${J(sid(3, a.n))}, O); await run(src, RA);
      if (A.zeroDestroy && !gone(t)) return 'zeroDestroy: a Spirit at 0 BP survived';
      if (!A.zeroDestroy && gone(t)) return 'a Spirit at 0 BP was destroyed without a destroy clause (Eternal FAQ p. 68)';
      return '';` };
}

function simple(card, a) {
  const spirit = card.type === 'Spirit';
  switch (a.do) {
    case 'DRAW': return only(a, ['n']) && { body: `for (let j = 0; j < 6; j++) dk(${J(FILL)}); const top = P.deck.slice(0, A.n); await run(src, RA);
      if (P.hand.length !== A.n || P.deck.length !== 6 - A.n) return 'hand ' + P.hand.length + ' deck ' + P.deck.length; if (top.some(x => !P.hand.includes(x))) return 'not drawn from the top'; return '';` };
    case 'DRAW_BOTTOM': return only(a, ['n']) && { body: `for (let j = 0; j < 6; j++) dk(${J(FILL)}); const bot = P.deck.slice(6 - A.n); await run(src, RA);
      if (P.hand.length !== A.n || P.deck.length !== 6 - A.n) return 'hand ' + P.hand.length + ' deck ' + P.deck.length; if (bot.some(x => !P.hand.includes(x))) return 'not drawn from the bottom'; return '';` };
    case 'MILL': return only(a, ['n']) && { body: `for (let j = 0; j < 7; j++) dk(${J(FILL)}); const top = P.deck.slice(0, A.n); await run(src, RA);
      if (P.trash.length !== A.n || P.deck.length !== 7 - A.n || top.some(x => !P.trash.includes(x))) return 'trash ' + P.trash.length + ' deck ' + P.deck.length; return '';` };
    case 'CRUSH':
      if (!only(a, ['n'])) return null;
      if (a.n === 'lv') return spirit && { onField: true, body: `for (let j = 0; j < 7; j++) dk(${J(FILL)}, O); const n = BS.lvNo(src); await run(src, RA);
      return O.trash.length === n && O.deck.length === 7 - n ? '' : 'Crush LV' + n + ': opposing trash ' + O.trash.length;` };
      return Number.isInteger(a.n) && { body: `for (let j = 0; j < 7; j++) dk(${J(FILL)}, O); const top = O.deck.slice(0, A.n); await run(src, RA);
      if (O.trash.length !== A.n || O.deck.length !== 7 - A.n || top.some(x => !O.trash.includes(x))) return 'opposing trash ' + O.trash.length + ' deck ' + O.deck.length; if (P.trash.length) return 'own cards were discarded'; return '';` };
    case 'COUNTER': return only(a, ['n', 'max']) && { body: `await run(src, RA); const want = A.max != null ? Math.min(A.n, A.max) : A.n; if (P.count !== want) return 'count ' + P.count + ', want ' + want;
      P.count = A.max != null ? A.max : 0; if (A.max != null) { await run(src, RA); if (P.count !== A.max) return 'the counter went over its maximum'; } return '';` };
    case 'VOID_TO_RESERVE': return only(a, ['n']) && { body: `const r = P.reserve.n; await run(src, RA); return P.reserve.n === r + A.n ? '' : 'reserve ' + r + ' -> ' + P.reserve.n;` };
    case 'VOID_TO_TRASH': return only(a, ['n']) && { body: `const t = P.trashCores.n, r = P.reserve.n; await run(src, RA); return P.trashCores.n === t + A.n && P.reserve.n === r ? '' : 'trash cores ' + t + ' -> ' + P.trashCores.n;` };
    case 'VOID_TO_LIFE': return only(a, ['n']) && { body: `const l = P.life; await run(src, RA); return P.life === l + A.n ? '' : 'life ' + l + ' -> ' + P.life;` };
    case 'VOID_TO_CARD':
      if (a.to === 'attacker' && only(a, ['n', 'to'])) return { body: `const t = sp(${J(FILL)}, P, 1), r = P.reserve.n; await run(src, RA, { attacker: t }); return t.cores === 1 + A.n && P.reserve.n === r ? '' : 'attacker cores 1 -> ' + t.cores;` };      // v0.77
      if (a.orReserve && only(a, ['n', 'to', 'orReserve']) && ['self', 'anySpirit'].includes(a.to)) return (spirit || a.to === 'anySpirit') && { onField: a.to === 'self', body: `const t = A.to === 'self' ? src : sp(${J(FILL)}, P, 1), c0 = t.cores, r = P.reserve.n; await run(src, RA);
      if (t.cores !== c0 + A.n || P.reserve.n !== r) return 'the CPU did not put the core on the Spirit: ' + c0 + ' -> ' + t.cores;
      ${PRE_RESET} P.spirits = []; const r2 = P.reserve.n; await run(src, RA); return P.reserve.n === r2 + A.n ? '' : 'no Spirit: reserve ' + r2 + ' -> ' + P.reserve.n;` };      // v0.77: CPU takes the Spirit, else the Reserve
      if (only(a, ['n', 'to', 'match']) && ['anySpirit', 'anyNexus'].includes(a.to) && a.match && Object.keys(a.match).every(k => k === 'family') && okMatch(a.match)) {      // v0.163 "Target a <family> Spirit/Nexus you control. Put a core from the Void to it."
        const m = a.to === 'anyNexus' ? Object.assign({}, a.match, { type: 'Nexus' }) : a.match;
        return { fix: [{ m }], body: `const t = A.to === 'anyNexus' ? nx(${J(mid(m))}) : sp(${J(mid(m))}, P, 1), o = sp(${J(FILL)}, P, 1), c0 = t.cores; await run(src, RA); return t.cores === c0 + A.n && o.cores === 1 ? '' : 'matching ' + c0 + ' -> ' + t.cores + ', other ' + o.cores;` };
      }
      if (!only(a, ['n', 'to'])) return null;
      if (a.to === 'self') return spirit && { onField: true, body: `const c0 = src.cores, r = P.reserve.n; await run(src, RA); if (src.cores !== c0 + A.n) return 'cores ' + c0 + ' -> ' + src.cores; return P.reserve.n === r ? '' : 'the cores came from the Reserve';` };
      return a.to === 'anySpirit' && { body: `const t = sp(${J(FILL)}, P, 1); await run(src, RA); return t.cores === 1 + A.n ? '' : 'cores 1 -> ' + t.cores;` };
    case 'BP_PLUS':
      if (only(a, ['n', 'per']) && spirit && a.per && ['Spirit', 'Nexus'].includes(a.per.type) && Object.keys(a.per).every(k => k === 'type')) {      // v0.163 "For each Nexus you control, this Spirit gains +N BP": counted when it resolves
        const nex = a.per.type === 'Nexus';
        return { onField: true, fix: nex ? [{ n: 2 }] : [], body: `${nex ? `nx(${J(nid(2))}); nx(${J(nid(2))});` : `sp(${J(FILL)}, P, 1); sp(${J(FILL)}, P, 1);`} const want = ${nex ? 2 : 'P.spirits.length'}, b = BS.bpOf(src); await run(src, RA); return BS.bpOf(src) === b + A.n * want ? '' : 'BP ' + b + ' -> ' + BS.bpOf(src) + ', want +' + A.n * want;` };
      }
      if (!only(a, ['n', 'to']) || !spirit || !['self', 'attacker', 'own', undefined].includes(a.to)) return null;
      if (a.to === 'own') return { onField: true, body: `const t = sp(${J(FILL)}, P, 1), b = [BS.bpOf(src), BS.bpOf(t)], o = sp(${J(FILL)}, O, 1); await run(src, RA);
      if (BS.bpOf(src) !== b[0] + A.n || BS.bpOf(t) !== b[1] + A.n) return 'own Spirits: ' + b + ' -> ' + [BS.bpOf(src), BS.bpOf(t)]; return BS.bpOf(o) === 1000 ? '' : 'an opposing Spirit got BP';` };
      return { onField: true, body: `const b = BS.bpOf(src); await run(src, RA, A.to === 'attacker' ? { attacker: src } : {}); return BS.bpOf(src) === b + A.n ? '' : 'BP ' + b + ' -> ' + BS.bpOf(src);` };
    case 'SHOW_RETURN':
      if (!only(a, ['max', 'match', 'drawEach', 'drawIf']) || !okMatch(a.match)) return null;      // v0.165 the CPU returns every matching card up to max
      return { fix: [{ m: a.match }], body: `for (let i = 0; i < A.max; i++) P.hand.push(BS.mkInst(${J(mid(a.match))})); for (let j = 0; j < 6; j++) dk(${J(FILL)}); await run(src, RA);
        const drew = A.drawEach ? A.max : (A.drawIf && A.drawIf.n === A.max ? A.drawIf.draw : 0); return P.hand.length === drew && P.deck.length === 6 + A.max - drew ? '' : 'hand ' + P.hand.length + ', deck ' + P.deck.length + ', want hand ' + drew;` };
    case 'REFRESH':
      if (a.to === 'subject' && only(a, ['to'])) return { onField: true, body: `const t = sp(${J(FILL)}, P, 1); t.exhausted = true; await run(src, RA, { subject: t }); return t.exhausted ? 'the winning Spirit is still exhausted' : '';` };      // v0.78 ALLY_BATTLE_WIN subject
      return only(a, []) && (spirit || card.type === 'Nexus') && { onField: true, body: `src.exhausted = true; await run(src, RA); return src.exhausted ? 'still exhausted' : '';` };
    case 'CURSE': return only(a, []) && spirit && { onField: true, body: `const t = sp(${J(FILL)}, O, 1); G.attacker = src; G.blocker = t; G.eob = []; G.battleResolved = true;
      await run(src, RA); if (gone(t)) return 'Curse destroyed before the end of the battle'; await BS.endOfBattle(); G.attacker = null; G.blocker = null; G.eob = null; G.battleResolved = false;
      return gone(t) ? '' : 'the blocker survived Curse';` };      // v0.78
    case 'END_BATTLE': return only(a, ['then']) && spirit && { onField: true, body: `G.attacker = src; G.eob = []; await run(src, RA); if (G.eob.length !== 1) return 'the effect was not queued for the end of the battle';
      P.spirits = P.spirits.filter(x => x !== src); const snap = () => JSON.stringify([P.hand.length, O.hand.length, O.spirits.length, P.trash.length]); const s0 = snap();
      await BS.endOfBattle(); G.attacker = null; G.eob = null; return snap() === s0 ? '' : 'it resolved although its source left the Field';` };      // v0.78
    case 'REVEAL_PICK': {
      if (!only(a, ['n', 'match', 'rest', 'diffName']) || !okMatch(a.match) || !['bottom', 'trash'].includes(a.rest)) return null;
      const M = mid(a.match), miss = fillMatches(a.match) ? '' : `${PRE_RESET} for (let j = 0; j < 2; j++) dk(${J(FILL)}); const ctx = await run(src, RA); if (P.hand.length) return 'a card that does not match was added'; if (ctx.did !== false) return 'nothing added, but the action reports done';`;
      return { fix: [{ m: a.match }], body: `P.deck = []; dk(${J(M)}); for (let j = 0; j < 5; j++) dk(${J(FILL)}); const top = P.deck.slice(0, A.n); await run(src, RA);
      if (P.hand.length !== 1 || P.hand[0].id !== ${J(M)}) return 'the matching card was not added: hand ' + P.hand.map(x => x.id);
      if (A.rest === 'trash' ? (P.trash.length !== A.n - 1 || P.deck.length !== 6 - A.n) : (P.trash.length || P.deck.length !== 5 || top.slice(1).some(x => !P.deck.slice(-(A.n - 1)).includes(x)))) return 'rest ' + A.rest + ': trash ' + P.trash.length + ' deck ' + P.deck.length;
      if (P.revealed.length) return 'cards stay revealed';
      ${miss} return '';` };
    }
    case 'BP_TARGET':      // v0.169 battle-length BP on this Spirit (to:self) or on one of your fighting Spirits (to:pick, the CPU boosts its attacker)
      if (!only(a, ['n', 'to', 'battle']) || a.battle !== true || !['self', 'pick'].includes(a.to) || (a.to === 'self' && !spirit)) return null;
      return { onField: a.to === 'self', body: `const foe = sp(${J(FILL)}, O, 1), t = A.to === 'self' ? src : sp(${J(FILL)}, P, 1); G.attacker = t; G.blocker = foe; G.battleNo = 1;
        const b = BS.bpOf(t); await run(src, RA); const got = BS.bpOf(t) - b; G.attacker = null; G.blocker = null; return got === A.n ? '' : 'battle BP +' + got + ', want +' + A.n;` };
    case 'CANT_BLOCK_OPP':      // v0.172 the picked opposing Spirit can't block this battle
      return only(a, []) && spirit && { onField: true, body: `const t = sp(${J(FILL)}, O, 1); G.attacker = src; G.battleNo = 1; await run(src, RA); G.attacker = null; return t.noBlockB === 1 ? '' : 'the opposing Spirit was not marked';` };
    case 'CANT_BE_BLOCKED_BY':      // v0.175 the attacker carries noBlockBy for this battle only
      return only(a, ['color', 'levels', 'keyword', 'highSpeed']) && spirit && { onField: true, body: `G.attacker = src; G.battleNo = 4; await run(src, RA); const m = src.noBlockBy; G.attacker = null; return m && m.battleNo === 4 ? '' : 'noBlockBy not set';` };
    case 'SELF_TO_HAND':      // v0.180 this Spirit goes from the Field back to its owner's Hand
      return only(a, []) && spirit && { onField: true, body: `await run(src, RA); return !P.spirits.includes(src) && P.hand.includes(src) ? '' : 'the Spirit did not return to the Hand';` };
    case 'RETURN_TRASH':      // v0.182 a matching card goes from the Trash to the Hand
      if (!only(a, ['match', 'anyType']) || !okMatch(a.match) || (a.match.type === 'Nexus' && !a.anyType)) return null;
      return { fix: [{ m: a.match }], body: `const t = BS.mkInst(${J(mid(a.match))}); P.trash.push(t); await run(src, RA); return P.hand.includes(t) && !P.trash.includes(t) ? '' : 'the card did not return to the Hand';` };
    case 'DESTROY_ANY':      // v0.183 either side is legal; with only an opposing target (and a CPU-safe fixture) that one goes
      if (!only(a, ['kind', 'exhaustedOnly'])) return null;
      return a.kind === 'nexus'
        ? { fix: [{ n: 2 }], body: `const t = nx(${J(nid(2))}, O); await run(src, RA); return gone(t) && O.trash.includes(t) ? '' : 'the Nexus survived';` }
        : { fix: [{ cost: 3, bp: 3000 }], body: `const t = sp(${J(sid(3, 3000))}, O); t.exhausted = true; const r = sp(${J(sid(3, 3000))}, O); await run(src, RA); return gone(t) && !gone(r) && O.trash.includes(t) ? '' : 'wrong Spirit destroyed';` };
    case 'DISCARD_HAND':      // v0.180 the CPU discards exactly n cards of its Hand
      return only(a, ['n']) && { body: `for (let j = 0; j < A.n + 2; j++) P.hand.push(BS.mkInst(${J(FILL)})); await run(src, RA); return P.hand.length === 2 && P.trash.length === A.n ? '' : 'hand ' + P.hand.length + ', trash ' + P.trash.length;` };
    case 'NO_REFRESH_OPP':      // v0.172 an exhausted opposing Spirit skips its next Refresh Step
      return only(a, []) && { onField: true, body: `const t = sp(${J(FILL)}, O, 1); t.exhausted = true; G.turnNo = 3; await run(src, RA); return t.noRefreshT === 4 ? '' : 'noRefreshT ' + t.noRefreshT;` };
    case 'REFRESH_SPIRIT':
      if (only(a, ['match', 'n', 'all']) && (a.n != null || a.all) && (a.match == null || okMatch(a.match)) && !(a.n != null && a.all)) {      // v0.169 up to N / all matching exhausted Spirits
        const M = a.match ? mid(a.match) : FILL, k = a.all ? 3 : a.n;
        return { fix: a.match ? [{ m: a.match }] : [], body: `const ts = []; for (let j = 0; j < ${k + (a.all ? 0 : 1)}; j++) { const t = sp(${J(M)}, P, 1); t.exhausted = true; ts.push(t); } await run(src, RA);
        const done = ts.filter(t => !t.exhausted).length; return done === ${a.all ? k : a.n} ? '' : 'refreshed ' + done + ' of ' + ts.length + ', want ' + ${a.all ? k : a.n};` };
      }
      if (only(a, ['match']) && okMatch(a.match)) return { fix: [{ m: a.match }], body: `const t = sp(${J(mid(a.match))}, P, 1); t.exhausted = true; await run(src, RA); if (t.exhausted) return 'the matching Spirit is still exhausted';
      ${fillMatches(a.match) ? '' : `${PRE_RESET} const f = sp(${J(FILL)}, P, 1); f.exhausted = true; await run(src, RA); if (!f.exhausted) return 'a Spirit that does not match was refreshed';`} return '';` };
      return only(a, []) && { body: `const t = sp(${J(FILL)}, P, 1); t.exhausted = true; await run(src, RA); return t.exhausted ? 'still exhausted' : '';` };
    case 'OPP_CORES_TO_RESERVE':
      if (a.targets === 1 && only(a, ['targets', 'each', 'costLe', 'exhaustedOnly', 'coresLe', 'keepOne', 'untilOne', 'drawPerDepleted']) && !(a.drawPerDepleted && (a.keepOne || a.untilOne))
        && ['costLe', 'exhaustedOnly', 'coresLe', 'keepOne', 'untilOne', 'drawPerDepleted'].some(k => a[k] != null)) {      // v0.77 filters / floors / draw on depletion
        const T = a.costLe != null ? sid(a.costLe, 1000) : FILL, K = a.coresLe != null ? Math.min(a.coresLe, 4) : 4;
        return { fix: a.costLe != null ? [{ cost: a.costLe, bp: 1000 }, { cost: a.costLe + 1, bp: 1000 }] : [], body: `const ex = ${a.exhaustedOnly ? 'true' : 'false'}, mk = (id, n, e) => { const i = sp(id, O, n); i.exhausted = e; return i; };
      const D = []; ${a.costLe != null ? `D.push(mk(${J(sid(a.costLe + 1, 1000))}, ${K}, ex));` : ''} ${a.exhaustedOnly ? `D.push(mk(${J(T)}, ${K}, false));` : ''} ${a.coresLe != null ? `D.push(mk(${J(T)}, ${a.coresLe + 1}, ex));` : ''}
      const d0 = D.map(x => x.cores);
      if (A.drawPerDepleted) { for (let j = 0; j < 3; j++) dk(${J(FILL)}); const t = mk(${J(T)}, Math.min(A.each, ${K}), ex); const h = P.hand.length; await run(src, RA);
        if (O.spirits.includes(t) || P.hand.length !== h + 1) return 'depleted target: hand ' + h + ' -> ' + P.hand.length; }
      else { const t = mk(${J(T)}, ${K}, ex); await run(src, RA); const want = A.untilOne ? 1 : A.keepOne ? Math.max(1, ${K} - A.each) : ${K} - A.each;
        if (t.cores !== want) return 'target cores ${K} -> ' + t.cores + ', want ' + want; }
      return D.every((x, j) => x.cores === d0[j]) ? '' : 'a Spirit outside the filter lost cores';` };
      }
      if (!only(a, ['targets', 'each'])) return null;
      return { body: `const L = []; for (let j = 0; j < A.targets + 1; j++) L.push(sp(${J(FILL)}, O, A.each + 2)); const r = O.reserve.n, before = L.reduce((s, t) => s + t.cores, 0);
      await run(src, RA); const moved = before - L.reduce((s, t) => s + t.cores, 0), hit = L.filter(t => t.cores < A.each + 2);
      if (moved !== A.targets * A.each || O.reserve.n !== r + moved) return 'moved ' + moved + ' cores, want ' + A.targets * A.each;
      if (hit.length !== A.targets || hit.some(t => t.cores !== 2)) return 'hit ' + hit.length + ' Spirits unevenly'; return '';` };
    default: return undefined;
  }
}

/** The generated case for one action of a card: { name, fix, onField, body } or { skip: shape }. */
export function caseFor(card, ei, ai, a) {
  let r;
  if (a.do === 'DESTROY') r = destroyCase(card, a);
  else if (a.do === 'EXHAUST_OPP') r = exhaustCase(a, false);
  else if (a.do === 'HEAVY_EXHAUST_OPP') r = exhaustCase(a, true);
  else if (a.do === 'BOUNCE_OPP') r = bounceCase(a);
  else if (a.do === 'BP_MINUS') r = bpMinusCase(a);
  else r = simple(card, a);
  if (!r) return { skip: shapeOf(a), id: card.id };
  const A = Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'if'));
  return { name: `${card.id} e${ei}.a${ai} ${shapeOf(a)}`, id: card.id, fix: r.fix || [], onField: !!r.onField,
    body: `const A = ${J(A)}; const RA = A; const src = ${r.onField ? `place(${J(card.id)})` : `BS.mkInst(${J(card.id)})`};\n${r.body}` };
}

/** Every action of every card with complete effects (fxComplete), in card order. */
export function casesFor(cards) {
  const out = [];
  for (const c of cards) {
    if (!c.fxComplete) continue;
    (c.effects || []).forEach((e, ei) => (e.actions || []).forEach((a, ai) => out.push(caseFor(c, ei, ai, a))));
  }
  return out;
}
