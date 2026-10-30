/* ---------------------------------------------------------------------
   RULES HELPERS
   --------------------------------------------------------------------- */
const fieldList = p => p.spirits.concat(p.nexus);
/* v0.42.1 (manual pp. 22, 26, 42): the cores on a Grandwalker (or Grandstone) Nexus cannot pay costs, cannot be moved by the player and are not
   counted as cores on the Field; only effects put them on / take them off. The Soul Core is not covered by these pages and is left as it was. */
const isGW = f => { const k = CARDS[f.id]; return !!k && k.type === 'Nexus' && (k.families || []).some(x => x === 'Grandwalker' || x === 'Grandstone'); };
const freeCores = f => isGW(f) ? 0 : f.cores;                   // normal cores of a card that the player may use or move
const freeTotal = f => freeCores(f) + (f.soul ? 1 : 0);
const totalCores = i => i.cores + (i.soul ? 1 : 0);
const reserveTotal = p => p.reserve.n + (p.reserve.soul ? 1 : 0);
const minCores = card => (isSpiritForm(card) ? card.levels[0].cores : 0);
/* a card that stands on the Field as a Spirit: Spirits, and Braves that are not combined (Spirit form, manual p. 34). A Brave without level data can only be combined directly. */
const isSpiritForm = card => !!card && (card.type === 'Spirit' || card.type === 'Ultimate' || (card.type === 'Brave' && card.levels.length > 0));
/* v0.46 Ultimates stand on the Field like Spirits (attack, block, BP, depletion) but are not Spirits: Braves and Contract Advent need a Spirit.
   Their levels start at LV3 (lvBase 3); lvNo = the printed LV number, which is what effect "lv" lists use. */
const isUlt = i => !!i && !!CARDS[i.id] && CARDS[i.id].type === 'Ultimate';
const lvBase = card => (card && card.lvBase) || 1;
const lvNo = i => lvIndex(i) + lvBase(CARDS[i.id]);
/* Summon condition (Ultimates, {{sumcon|...}}): checked for every summon or Advent of the card; house reading v0.46 (manual page not read this session) */
const summonOK = (p, card) => !card || !card.summonIf || (!!G && fxIf(p, G.p[other(p.key)], card.summonIf, null));
const spare = f => totalCores(f) - minCores(CARDS[f.id]);
const coresAvailable = p => reserveTotal(p) + fieldList(p).reduce((s, i) => s + freeTotal(i), 0);
/* Official rule (Eternal manual): the Lv of a Contract Grandwalker Nexus ("...Contractor ...") is decided by your Count, not by the cores on it. levels[].cores is then the Count needed. */
function isCountLv(card) { return card.type === 'Nexus' && (card.families || []).includes('Grandwalker') && /Contractor/i.test(card.name); }
let _tl3 = false;      // re-entrancy guard: flagActive reads lvNo, which reads lvIndex
function treatLv3(i) {      // the level (2 or 3) the Spirit is treated as being at, 0 = none
  if (_tl3 || !G || !(CARDS[i.id].effects || []).some(e => e.flag === 'TREAT_LV3')) return 0;
  const o = ownerOf(i); if (!o || !o.spirits.includes(i)) return 0;
  _tl3 = true; try { return [3, 2].find(n => flagActive(o, 'TREAT_LV3', i, e => (e.n || 3) === n)) || 0; } finally { _tl3 = false; }
}
function lvIndex(i) {
  const card = CARDS[i.id], L = card.levels; let t, k = -1;
  if (card.countLv) { const o = ownerOf(i); t = o ? o.count : 0; } else t = totalCores(i);
  for (let j = 0; j < L.length; j++) if (t >= L[j].cores) k = j;
  if (k >= 0 && k < 2 && L.length > 1) { const n = treatLv3(i); if (n && L.length >= n && k < n - 1) k = n - 1; }      // v0.181 STATIC TREAT_LV3 "While you control N or less Spirits, this Spirit is treated as being at LV3"; v0.184 n:2 = LV2
  if (i.lv2Battle && G && G.attacker && i.lv2Battle === G.battleNo && L.length > 1 && k < 1) k = 1;      // v0.196 TREAT_LV2 battle:true (Level Up)
  if (i.lv2Turn && L.length > 1 && k < 1) k = 1;      // v0.196 TREAT_LV2 action
  if (card.trueRelease && i.soul && L.length > 1 && k < 1) k = 1;   // v0.66 True Release (Standard CR 12-2-1-1): the Soul Core alone fulfils LV2 (a rule, not an effect)
  return k;
}
function bpOf(i) { const k = lvIndex(i); if (k < 0) return 0; const b = CARDS[i.id].levels[k].bp; return b == null ? 0 : Math.max(0, b + (i.bpMod || 0) + bpBattle(i) + staticBp(i) + braveBp(i) + (ocActive(i) ? CARDS[i.id].overCount.bp : 0)); }
/* Over Count (Eternal manual p. 60): active while the owner's Count meets the card's OC condition, whatever the Spirit's Lv; adds its BP like a combined Brave */
function ocActive(i) { const oc = CARDS[i.id] && CARDS[i.id].overCount; if (!oc || !G) return false; const o = ownerOf(i); return !!o && o.count >= oc.count; }
/* Brave (manual p. 34-36): a combined Brave (inst.brave) adds its BP+ and symbol to the Spirit; one Brave per Spirit; no cost to combine or separate */
const braveBp = i => (i.brave ? CARDS[i.brave.id].brave.bp : 0);
/* Saga Brave (manual p. 38): a Brave with "brave.nexus" may also combine with a Grandwalker Nexus whose name matches; a Nexus treated as a Spirit cannot be braved (p. 69 Q1) */
function braveFits(b, s) {
  const bc = CARDS[b.id].brave, k = CARDS[s.id];
  if (!bc || b === s || s.brave) return false;
  if (k.type === 'Nexus') return !!bc.nexus && (k.families || []).includes('Grandwalker') && fxMatch(k, { name: bc.nexus.name });
  return k.type === 'Spirit' && fxMatch(k, { name: bc.name, family: bc.family, costGe: bc.costGe, costLe: bc.costLe });
}
const braveTargets = (p, b) => p.spirits.concat(p.nexus).filter(s => braveFits(b, s));
function combineBrave(p, b, s) {             // from the Field (Spirit form) or straight from the Hand (cost already paid); the Brave's cores move onto the Spirit
  const nx = CARDS[s.id].type === 'Nexus';   // Saga Brave onto a Grandwalker Nexus: its cores go back to the Reserve first (p. 38)
  if (removeFrom(p.spirits, b)) { if (nx) { p.reserve.n += b.cores; if (b.soul) p.reserve.soul = true; } else { s.cores += b.cores; if (b.soul) s.soul = true; if (b.exhausted) s.exhausted = true; } }
  removeFrom(p.hand, b); removeFrom(p.soulState, b);
  b.cores = 0; b.soul = false; b.exhausted = false; b.heavy = false; b.noAB = false; b.bpMod = 0; b.inSoulState = false; b.mirage = false;
  s.brave = b;
  log(`${CARDS[b.id].name} combines with ${poss(p)} ${CARDS[s.id].name} (${nx ? 'Nexus Brave' : 'Brave +' + CARDS[b.id].brave.bp + ' BP'}).`);
}
const canSeparate = (p, s) => !!s.brave && CARDS[s.brave.id].levels.length > 0 && reserveTotal(p) + fieldList(p).reduce((n, f) => n + Math.max(0, spare(f)), 0) >= minCores(CARDS[s.brave.id]);
function separateBrave(p, s) {               // Main Step: the Brave becomes a Spirit again and needs cores for Lv1 (from the Reserve / Field as when summoning)
  const b = s.brave; if (!b) return false;
  s.brave = null; p.spirits.push(b);
  const got = takeCores(p, minCores(CARDS[b.id]), b.uid); b.cores = got.n; b.soul = got.soul;
  log(`${CARDS[b.id].name} separates from ${poss(p)} ${CARDS[s.id].name}.`);
  checkDepletion(p);
  return true;
}
const braveAfford = (p, b) => effCost(p, CARDS[b.id]) <= reserveTotal(p) + fieldList(p).reduce((n, f) => n + Math.max(0, spare(f)), 0);
function braveSummon(p, b, s, plan) {        // Summon a Brave directly combined (manual p. 34): pay its cost, no cores go on the Brave; it is not a Spirit summon
  const c = effCost(p, CARDS[b.id]);
  removeFrom(p.hand, b); payCost(p, c, plan);
  b.summonedTurn = G.turnNo;
  log(`${who(p)} ${p.cpu ? 'summons' : 'summon'} ${CARDS[b.id].name} (paid ${c}).`);
  combineBrave(p, b, s); checkDepletion(p);
}
function braveRecheck(p, s) {               // the combined Spirit no longer meets the Brave condition: it separates at once (manual p. 35); a Brave that cannot keep Lv1 goes to the Trash (not destroyed)
  const b = s.brave; if (!b) return;
  s.brave = null; const ok = braveFits(b, s); s.brave = b; if (ok) return;
  if (canSeparate(p, s)) { separateBrave(p, s); return; }
  s.brave = null; p.trash.push(b); log(`${CARDS[b.id].name} separates and goes to the Trash (no cores for Lv1).`);
}
function shedBrave(p, s, zone) {             // the Spirit leaves the Field: its Brave goes to the same place (manual p. 36)
  const b = s.brave; if (!b) return; s.brave = null;
  zone.push(b); log(`${CARDS[b.id].name} leaves the Field with it.`);
}
/* Tokens (Eternal manual p. 56-57 + official "How to Use Token Cards" page): prepared outside the Deck before the game (no limit per kind,
   not refilled during the game); placed only by "send out" effects, without paying the cost but with cores for at least Lv1 from the
   Field or Reserve (not a summon); on the Field a Token Spirit is a Spirit; when it leaves the Field it returns to the Token supply. */
const TOKEN_SUPPLY = 10;                      // house choice: each kind of Token the deck can send out is prepared 10 times
function tokenIdsOf(id) {
  const c = CARDS[id], out = [];
  for (const e of (c && c.effects) || []) for (const a of e.actions || []) if (a.do === 'SEND_TOKEN' && CARDS[a.token]) out.push(a.token);
  return out;
}
function prepareTokens(p, counts) { p.tokens = {}; for (const id of Object.keys(counts)) for (const t of tokenIdsOf(id)) p.tokens[t] = TOKEN_SUPPLY; }
const tokenCoreRoom = p => reserveTotal(p) + fieldList(p).reduce((n, f) => n + Math.max(0, spare(f)), 0);
const canSendToken = (p, id) => !!CARDS[id] && !!p.tokens && (p.tokens[id] || 0) > 0 && tokenCoreRoom(p) >= minCores(CARDS[id]);
function sendToken(p, id) {
  if (!canSendToken(p, id)) return null;
  p.tokens[id]--;
  const t = mkInst(id); t.token = true; t.summonedTurn = G.turnNo;
  const got = takeCores(p, minCores(CARDS[id]), t.uid); t.cores = got.n; t.soul = got.soul;
  p.spirits.push(t);
  log(`${who(p)} ${p.cpu ? 'sends' : 'send'} out a "${CARDS[id].name}" Token.`);
  checkDepletion(p);
  return t;
}
function tokenHome(p, t) { t.cores = 0; t.soul = false; t.exhausted = false; t.heavy = false; t.noAB = false; t.bpMod = 0; t.symBattle = 0; p.tokens = p.tokens || {}; p.tokens[t.id] = (p.tokens[t.id] || 0) + 1; }
/* symbols an attacker takes from the Life: its own, a combined Brave's (manual p. 34) and "+N symbol during this battle" effects */
const symTurnCols = i => i.symTurn && G && i.symTurn.turn === G.turnNo ? i.symTurn.cols : [];   // v0.44 "during this turn, an extra Red symbol"
const symZeroAllOn = (q, i) => q.symZeroAll === G.turnNo && !fxImmune(q, i, q.symZeroBy);    // v0.58: an unaffected later arrival keeps its symbols
const attackSymbols = i => i.symZeroTurn === G.turnNo || symZeroAllOn(G.p.player.spirits.includes(i) ? G.p.player : G.p.opponent, i) ? 0 : Math.max(0, (CARDS[i.id].symbols || 0) + (i.brave ? CARDS[i.brave.id].symbols || 0 : 0) + (i.symBattle || 0) + symTurnCols(i).length);
/* Symbols (Eternal rule manual VER.17.0): each printed symbol has one or more attributes.
   colour; "ultimate" (Ultimates, p. 39: reduces only Ultimate reduction symbols); "god" (Grandwalker Nexuses, p. 42: never reduces the six colours);
   a Contract Grandwalker Nexus has a coloured God symbol = God + its colour (p. 44). symbolColors entries: a colour, "ultimate", "god" or "god-<colour>".
   A multicolour card's plain symbols count as each of its colours (house reading; the manual does not say). */
function symAttrs(e) { if (e.startsWith('god-')) return ['god', e.slice(4)]; return [e]; }
function symbolAttrs(card) {
  if (!card || card.type === 'Magic') return [];
  if (card.symbolColors && card.symbolColors.length) return card.symbolColors.map(symAttrs);
  const n = Math.max(0, card.symbols || 0), cols = card.colors && card.colors.length ? card.colors : [card.symbol];
  let one = cols;
  if (card.type === 'Ultimate') one = ['ultimate'];
  else if (card.type === 'Nexus' && (card.families || []).includes('Grandwalker')) one = /Contractor/i.test(card.name) ? ['god', card.symbol] : ['god'];
  return Array.from({ length: n }, () => one.slice());
}
/* symbols usable for cost reduction: Field cards only (not Soul State, p. 55, unless the card being paid says so; not the Burst Area, p. 49) */
function fieldSymbols(p, withSoulState, withStandby) {     // withStandby: cost reduction also counts cards waiting in Standby (v0.57.0)
  const out = [];
  for (const i of fieldList(p).concat(withSoulState ? p.soulState : [], withStandby ? (p.standby || []) : [])) for (const a of symbolAttrs(CARDS[i.id]).concat(i.brave ? symbolAttrs(CARDS[i.brave.id]) : [], symTurnCols(i).map(k => [k]))) out.push(a);
  return out;
}
function symbolsOn(p, withSoulState) {        // count per attribute (a two-attribute symbol counts in both)
  const s = {};
  for (const a of fieldSymbols(p, withSoulState)) for (const k of a) s[k] = (s[k] || 0) + 1;
  return s;
}
/* reduction = how many reduction symbols can each be matched to a different Field symbol of a matching attribute
   ("all" = six-colour reduction symbol, matched by any coloured symbol, p. 25) */
function reductionOf(card, syms, extra) {
  const slots = (extra || []).slice();
  for (const [k, n] of Object.entries(card.reduction || {})) for (let i = 0; i < n; i++) slots.push(k);
  if (!slots.length || !syms.length) return 0;
  const fits = (k, a) => (k === 'all' ? a.some(x => COLORS.includes(x)) : a.includes(k));
  const owner = new Array(syms.length).fill(-1);
  const tryAssign = (si, seen) => {
    for (let j = 0; j < syms.length; j++) {
      if (seen[j] || !fits(slots[si], syms[j])) continue;
      seen[j] = true;
      if (owner[j] < 0 || tryAssign(owner[j], seen)) { owner[j] = si; return true; }
    }
    return false;
  };
  let r = 0;
  for (let si = 0; si < slots.length; si++) if (tryAssign(si, [])) r++;
  return r;
}
/* v0.45 OPP_NO_BLOCK: the lock holds this turn while its source stays on its owner's Field at minLv or higher */
function noBlockActive(D) {
  const L = D && D.noBlock; if (!L || !G || L.turn !== G.turnNo) return false;
  const src = fieldList(G.p[L.owner]).find(i => i.uid === L.uid);
  return !!src && lvNo(src) >= L.minLv;
}
function costAltActive(p, card) {                 // e.g. Wurm Draw: "(Once per Turn: Same Name) when using this card, if you control any Wurm, this card can become Cost 3"
  const a = card.costAlt; if (!a || !G) return false;
  if (a.once && p.onceUsed && p.onceUsed['costalt:' + card.name] === G.turnNo) return false;
  return fxIf(p, G.p[other(p.key)], a.if);
}
/* v0.40: STATIC EXTRA_REDUCTION of your Field cards ("all your Thunderive cards gain an extra yellow reduction symbol"): extra slots for the card being paid */
function extraReduction(p, card) {
  const out = []; if (!G) return out; const opp = G.p[other(p.key)];
  for (const src of fieldList(p)) {
    const L = lvNo(src);
    for (const { e } of fxEntries(src)) {
      if (e.trigger !== 'STATIC' || e.flag !== 'EXTRA_REDUCTION' || (e.lv && !e.lv.includes(L)) || !fxMatch(card, e.match) || !fxIf(p, opp, e.if)) continue;
      for (let i = 0; i < (e.n || 1); i++) out.push(e.color);
    }
  }
  return out;
}
/* v0.196 STATIC SUMMON_SYMBOL {color, n, match}: "when you're summoning a <match> card, this Nexus/Spirit gains an extra <colour> symbol": extra Field symbols for the card being paid */
function summonSymbols(p, card) {
  const out = []; if (!G) return out; const opp = G.p[other(p.key)];
  for (const src of fieldList(p)) {
    const L = lvNo(src);
    for (const { e } of fxEntries(src)) {
      if (e.trigger !== 'STATIC' || e.flag !== 'SUMMON_SYMBOL' || (e.lv && !e.lv.includes(L)) || !fxMatch(card, e.match) || !fxIf(p, opp, e.if)) continue;
      const k = e.perSpirit ? p.spirits.filter(s => fxMatch(CARDS[s.id], e.perSpirit)).length : e.n || 1;
      for (let i = 0; i < k; i++) out.push([e.color]);
    }
  }
  return out;
}
/* v0.69 LEGACY (= Succession; Standard CR 12-2-1-3, Fandom Q&A 31541-31543, 31620, 31866): summoning / casting a card with Legacy you may banish EX-symbol
   cards of the reduction colour from your Trash, one per reduction symbol, before the Field symbols reduce the cost; none banished = Legacy not activated;
   never with a fixed cost (costAlt). House reading: applied automatically with the fewest EX cards that give the lowest cost (a Field symbol that can pay
   a reduction symbol saves an EX card). EX colour = the card's colour(s) (no two-colour EX card exists in block A). */
function legacyPlan(p, card, syms, extra) {
  if (!card || !card.legacy || !p || costAltActive(p, card)) return null;
  const slots = []; for (const [k, n] of Object.entries(card.reduction || {})) for (let i = 0; i < n; i++) slots.push(k);
  const pool = p.trash.filter(t => CARDS[t.id] && CARDS[t.id].exSymbols > 0);
  if (!slots.length || !pool.length) return null;
  syms = syms || fieldSymbols(p, card.soulReduce, true).concat(card.trashSymbols ? p.trash.flatMap(t => symbolAttrs(CARDS[t.id])) : []);
  const fits = (k, a) => (k === 'all' ? a.some(x => COLORS.includes(x)) : a.includes(k));
  const need = slots.map((k, i) => ({ k, i, fit: syms.filter(a => fits(k, a)).length })).sort((a, b) => a.fit - b.fit);   // slots the Field cannot pay come first
  const left = pool.slice(), pick = [];
  for (const s of need) {
    const j = left.findIndex(t => { const c = CARDS[t.id], cols = c.colors && c.colors.length ? c.colors : [c.symbol]; return s.k === 'all' ? cols.some(x => COLORS.includes(x)) : cols.includes(s.k); });
    if (j >= 0) { pick.push({ s, t: left[j] }); left.splice(j, 1); }
  }
  let best = null;
  for (let k = 0; k <= pick.length; k++) {                      // fewest EX cards for the lowest cost
    const gone = new Set(pick.slice(0, k).map(x => x.s.i)), rest = { reduction: {} };
    slots.forEach((c, i) => { if (!gone.has(i)) rest.reduction[c] = (rest.reduction[c] || 0) + 1; });
    const total = k + reductionOf(rest, syms, extra || extraReduction(p, card));
    if (!best || total > best.total) best = { n: k, cards: pick.slice(0, k).map(x => x.t), total };
  }
  return best.n > 0 ? best : null;
}
/* v0.186 STATIC HAND_COST {n, match} ("The cost of all <family> Spirit cards in your Hand becomes N"): the base cost of a matching card the owner pays for */
function handCostSet(p, card) {
  if (!G) return null; const opp = G.p[other(p.key)];
  for (const src of fieldList(p)) {
    const L = lvNo(src);
    for (const { e } of fxEntries(src)) if (e.trigger === 'STATIC' && e.flag === 'HAND_COST' && !(e.lv && !e.lv.includes(L)) && fxMatch(card, e.match) && fxIf(p, opp, e.if, { selfInst: src })) return e.n;
  }
  return null;
}
function effCost(p, card) {                       // cost reduction is mandatory when possible
  const syms = fieldSymbols(p, card.soulReduce, true);
  if (card.trashSymbols) for (const t of p.trash) for (const x of symbolAttrs(CARDS[t.id])) syms.push(x);   // v0.47 Lightning Tempest: "you can also use symbols from your Trash to reduce the cost
  for (const x of summonSymbols(p, card)) syms.push(x);
  const extra = extraReduction(p, card), lp = legacyPlan(p, card, syms, extra);
  const r = lp ? lp.total : reductionOf(card, syms, extra);
  const hc = handCostSet(p, card), base = hc == null ? card.cost : hc;
  const per = card.costPer ? Math.min(card.costPer.max, card.costPer.n * p.spirits.filter(s => (CARDS[s.id].families || []).includes(card.costPer.family)).length) : 0;      // v0.196 costPer
  return Math.max(0, (costAltActive(p, card) ? Math.min(base, card.costAlt.cost) : base) - r - per);
}
function legacyPay(p, inst) {                     // v0.69: banish the Legacy cards (call once, before the cost is paid: the state must still be the one effCost saw)
  const lp = legacyPlan(p, CARDS[inst.id]); inst.legacyN = lp ? lp.n : 0;
  if (!lp) return 0;
  for (const t of lp.cards) { removeFrom(p.trash, t); p.removed.push(t); }
  log(`${who(p)} ${p.cpu ? 'banishes' : 'banish'} ${lp.n} EX-symbol card${lp.n === 1 ? '' : 's'} from the Trash via Legacy.`);
  return lp.n;
}
const tributeList = (p, c) => !c.tribute ? [] : p.spirits.filter(s => { const k = CARDS[s.id]; return c.tribute.costGe != null ? k.cost >= c.tribute.costGe : (k.families || []).includes(c.tribute.family); });      // v0.182 Tribute: your Spirits that can be sacrificed
function canPlayCard(p, inst, noTribute) { const c = CARDS[inst.id]; return summonOK(p, c) && effCost(p, c) + minCores(c) <= coresAvailable(p) && (noTribute || !c.tribute || tributeList(p, c).length > 0); }

/* take n cores: Reserve first, then spare field cores, then the Soul Core last */
function takeCores(p, n, excludeUid) {
  const got = { n: 0, soul: false };
  const cands = () => fieldList(p).filter(f => f.uid !== excludeUid);
  while (got.n + (got.soul ? 1 : 0) < n) {
    if (p.reserve.n > 0) { p.reserve.n--; got.n++; continue; }
    const sp = cands().filter(f => freeCores(f) > 0 && spare(f) > 0).sort((a, b) => spare(b) - spare(a));
    if (sp.length) { sp[0].cores--; got.n++; continue; }
    if (p.reserve.soul) { p.reserve.soul = false; got.soul = true; continue; }
    const any = cands().filter(f => freeCores(f) > 0);
    if (any.length) { any[0].cores--; got.n++; continue; }
    const sc = cands().filter(f => f.soul);
    if (sc.length) { sc[0].soul = false; got.soul = true; continue; }
    break;
  }
  return got;
}
function payCost(p, c, plan) {      // v0.176: returns true when the Soul Core was among the paid cores ("If (Soul Core) was used to pay the summon cost")
  let soul = false;
  if (plan) {
    coreEvN(p, 'reserve', 'trash', plan.reserve, plan.rsoul);
    for (const [u, k] of Object.entries(plan.by)) coreEvN(p, Number(u), 'trash', k, false);
    if (plan.fsoul) coreEv(p, 'soul', plan.fsoul, 'trash');
    p.reserve.n -= plan.reserve; p.trashCores.n += plan.reserve;
    for (const [u, k] of Object.entries(plan.by)) { const f = fieldList(p).find(x => x.uid === Number(u)); f.cores -= k; p.trashCores.n += k; }
    if (plan.rsoul) { p.reserve.soul = false; p.trashCores.soul = true; soul = true; }
    if (plan.fsoul) { const f = fieldList(p).find(x => x.uid === plan.fsoul); if (f) { f.soul = false; p.trashCores.soul = true; soul = true; } }
  } else {
    const got = takeCores(p, c, null); p.trashCores.n += got.n; if (got.soul) { p.trashCores.soul = true; soul = true; }
  }
  return soul;
}

function checkDepletion(p) {                       // Depletion is not Destruction
  let again = true;
  while (again) {
    again = false;
    for (const s of p.spirits.slice()) {
      if (totalCores(s) < CARDS[s.id].levels[0].cores) { removeSpirit(p, s, 'depleted', false); again = true; }
    }
  }
}
/* v0.73 "When this Spirit would leave the Field due to the opponent / due to opposing effects" (LEAVES): queued when a Spirit with such an
   effect leaves by an opposing effect (destroyed, depleted, returned, removed) or by BP comparison; the card waits in Standby (Trash) or
   resolves from its new zone (Hand / Deck), as (When Destroyed) does (house reading: the effect resolves just after it left). */
function leaveEvent(p, s, byOpp, byOppFx) {
  if (!byOpp || s.noFx || !G || !G.evQ || !(CARDS[s.id].effects || []).some(e => e.trigger === 'LEAVES')) return;
  G.evQ.push({ type: 'LEAVES', key: p.key, inst: s, byOppFx: !!byOppFx });
}
function removeSpirit(p, s, why, byOpponent) {
  const lv = p.spirits.includes(s) ? lvIndex(s) : -1;
  const kill = why === 'destroyed' && byOpponent !== 'battle' && !!G && !!G.evQ && !!G.fxBy && G.fxBy !== p.key && fieldList(G.p[G.fxBy]).some(f => fxEntries(f).some(({ e }) => e.trigger === 'OPP_DESTROYED_FX')),      // v0.196 someone can react to "opposing Spirits destroyed by your effect"
    bp0 = kill ? bpOf(s) : 0;
  if (!removeFrom(p.spirits, s)) return;
  if ((why === 'destroyed' || why === 'depleted') && byOpponent !== 'battle' && G && G.fxBy && G.fxBy !== p.key) G.p[G.fxBy].oppFxLossTurn = G.turnNo;      // v0.196 condition oppLostByFx
  if (kill) G.evQ.push({ type: 'FXKILL', key: G.fxBy, bp: bp0, src: G.fxSrc || null });
  s.lostLv = lv; s.soulLost = s.soul;      // v0.176: the Soul Core it held when it left ("If (Soul Core) is on this Spirit" in a Destroyed trigger)
  const oppFx = byOpponent === true || (byOpponent !== 'battle' && !!G && !!G.fxBy && G.fxBy !== p.key);   // v0.73: by an opposing effect (byOpponent 'battle' = BP comparison)
  const depl = why === 'depleted' && oppFx;      // v0.177: depleted by an opposing effect wakes only the "(When Depleted/Destroyed by the Opponent)" effects (alsoDepleted)
  if ((why === 'destroyed' || depl) && !s.noFx && G && G.evQ && (CARDS[s.id].effects || []).some(e => e.trigger === 'DESTROYED' && (!depl || e.alsoDepleted))) G.evQ.push({ type: 'DESTROYED', key: p.key, inst: s, byOpp: !!byOpponent || depl, byOppFx: oppFx, depl });
  leaveEvent(p, s, !!byOpponent || oppFx, oppFx);   // (When Destroyed), manual p. 31; noFx = "the effects of the destroyed target can't activate"
  delete s.noFx;
  coreEvN(p, s.uid, 'reserve', s.cores, s.soul);          // v0.149.0: the cores of a destroyed / depleted Spirit fly to the Reserve
  p.reserve.n += s.cores; if (s.soul) p.reserve.soul = true;
  s.cores = 0; s.soul = false; s.exhausted = false; s.heavy = false; s.noAB = false; s.bpMod = 0; s.lv2Turn = false; s.lv2Battle = null; s.bpB = null; s.fxBattle = null;      // v0.68: battle BP / Once Per Battle end when it leaves
  const under = s.under; s.under = [];
  for (const u of under) { u.under = []; p.trash.push(u); }
  shedBrave(p, s, p.trash);
  if (s.token) {                                 // Token rule 3: back to the Token supply, never the Trash, so "after destroyed" Bursts cannot activate
    tokenHome(p, s); log(`${poss(p)} ${CARDS[s.id].name} Token is ${why} and returns to the Token supply.`);
    if (G && G.evQ && ((why === 'destroyed' && byOpponent) || why === 'depleted')) G.evQ.push({ type: 'LOST', key: p.key, inst: s });
    return;
  }
  if (why === 'destroyed' && byOpponent && CARDS[s.id].contract) {     // Contract card: Soul State instead of Trash
    s.inSoulState = true; p.soulState.push(s);
    log(`${poss(p)} ${CARDS[s.id].name} enters Soul State.`);
    if (G && G.burstQ) G.burstQ.push({ key: p.key });
    if (G && G.evQ) G.evQ.push({ type: 'LOST', key: p.key, inst: s });
    return;
  }
  log(`${poss(p)} ${CARDS[s.id].name} is ${why}.`);
  if (why === 'destroyed' && G && G.evQ && STEPS[G.step] === 'ATTACK' && p.trash.some(x => (CARDS[x.id].effects || []).some(e => e.flag === 'IMMORTALITY'))) G.evQ.push({ type: 'IMMORTAL', key: p.key, inst: s });      // v0.183 Immortality (02j)
  if (why === 'destroyed' && byOpponent && G && G.burstQ) G.burstQ.push({ key: p.key });
  if (G && G.evQ && ((why === 'destroyed' && byOpponent) || why === 'depleted')) G.evQ.push({ type: 'LOST', key: p.key, inst: s });
  if (G && G.evQ && G.evQ.some(e => e.inst === s && (e.type === 'DESTROYED' || e.type === 'LEAVES' || (e.type === 'LOST' && lostHeard(p))))) { s.standbyTo = 'trash'; p.standby.push(s); }   // v0.57.0 Standby (JP 17.0 item 4): waits while its leave triggers resolve
  else p.trash.push(s);
}
/* v0.57.0 Standby state (JP 17.0 revision notice item 4): a card that left the Field waits in p.standby while the queued
   events naming it (When Destroyed, ally lost) resolve; its symbols still reduce costs (fieldSymbols withStandby); then it
   goes to its destination (standbyTo: 'trash' or 'removed'). force = release every waiting card (new turn, game over). */
const lostHeard = p => fieldList(p).some(f => fxEntries(f).some(({ e }) => e.trigger === 'ALLY_LOST'));   // someone can react to "an ally is lost"
function leaveStandby(p, s) {
  if (!removeFrom(p.standby, s)) return;
  const to = s.standbyTo || 'trash'; delete s.standbyTo;
  (to === 'removed' ? p.removed : p.trash).push(s);
}
function releaseStandby(force) {
  if (!G || !G.p) return;
  for (const k of ['player', 'opponent']) {
    const p = G.p[k]; if (!p || !p.standby) continue;
    for (const s of p.standby.slice()) if (force || !(G.evQ || []).some(e => e.inst === s)) leaveStandby(p, s);
  }
}
const poss = p => (p.key === 'player' && !p.cpu ? 'Your' : p.name + "'s");
const who = p => (p.key === 'player' && !p.cpu ? 'You' : p.name);

/* Key Spirit draws (Aeterna house rule, v0.103.0): while a deck's marked Key Spirit has no copy in the Hand or on the Field,
   every draw from the Deck favours its copies (weight KEY_WEIGHT per copy vs 1). The weighted pick reads the seeded RNG exactly
   once, and only while the rule is active, so decks without a Key Spirit draw exactly as before (replay/sim determinism). */
const keyDrawActive = p => !!p.keySpirit && !(G && G.over) && !p.hand.some(h => h.id === p.keySpirit) && !fieldList(p).some(f => f.id === p.keySpirit);
function drawKeyFirst(p) {                       // the picked Key copy moves to the front first, so the following natural draws keep their order
  const ks = p.keySpirit; let tot = 0;
  for (const d of p.deck) tot += d.id === ks ? KEY_WEIGHT : 1;
  let r = rng() * tot, ix = p.deck.length - 1;
  for (let i = 0; i < p.deck.length; i++) { r -= p.deck[i].id === ks ? KEY_WEIGHT : 1; if (r < 0) { ix = i; break; } }
  if (ix) p.deck.unshift(p.deck.splice(ix, 1)[0]);
}
function draw(p, n) {
  let k = 0;
  for (; k < n && p.deck.length; k++) { if (p.keySpirit && keyDrawActive(p)) drawKeyFirst(p); p.hand.push(p.deck.shift()); }
  return k;
}
/* the owner's Hand increased through one of the owner's own effects: the opponent sees an "opposing Hand increase by an opposing effect" */
function handUp(p, k) { if (G && !G.over && k !== 0 && G.evQ) G.evQ.push({ type: 'HAND_UP', key: p.key }); }
function summon(p, inst, plan) {
  const card = CARDS[inst.id], c = effCost(p, card); legacyPay(p, inst);
  removeFrom(p.hand, inst); removeFrom(p.soulState, inst); removeFrom(p.removed, inst); removeFrom(p.trash, inst); inst.inSoulState = false; inst.mirage = false;   // v0.50: Accel Spirits are summoned from the Removed Zone; v0.183 Immortality from the Trash
  const soulPaid = payCost(p, c, plan);
  inst.viaFC = false; inst.viaHS = false; inst.viaFx = false; inst.soulPaid = soulPaid; inst.soulLost = false; inst.cores = 0; inst.soul = false; inst.exhausted = false; inst.heavy = false; inst.noAB = false; inst.summonedTurn = G.turnNo; inst.bpMod = 0;
  if (isSpiritForm(card)) {
    const got = takeCores(p, card.levels[0].cores, inst.uid);
    inst.cores += got.n; if (got.soul) inst.soul = true;
    p.spirits.push(inst);
  } else p.nexus.push(inst);
  log(`${who(p)} ${isSpiritForm(card) ? (p.cpu ? 'summons' : 'summon') : (p.cpu ? 'deploys' : 'deploy')} ${card.name} (paid ${c}).`);
  checkDepletion(p);
}
function setBurst(p, inst, mirage) {          // the Burst Area holds one card: a face-down Burst or a face-up Mirage
  removeFrom(p.hand, inst);
  if (mirage) {                                   // official rule: a Burst and a Mirage can both be in the Burst Area; a replaced Mirage returns to the Hand
    if (p.mirage) { p.mirage.mirage = false; p.hand.push(p.mirage); log(`${CARDS[p.mirage.id].name} returns to the Hand.`); }
    inst.mirage = true; p.mirage = inst; p.mirageSetThisTurn = true;
  } else {
    if (p.burst) { p.burst.mirage = false; p.trash.push(p.burst); }     // setting another Burst discards the old one
    inst.mirage = false; p.burst = inst; p.burstSetThisTurn = true;
  }
  log(mirage ? `${who(p)} ${p.cpu ? 'sets' : 'set'} a Mirage face up: ${CARDS[inst.id].name}.` : `${who(p)} ${p.cpu ? 'sets' : 'set'} a Burst.`);
}
const mirageUsable = (p, inst) => !!CARDS[inst.id].mirage && !p.mirageSetThisTurn && CARDS[inst.id].mirage.cost <= coresAvailable(p);

/* Magic cards: [Main] in the Main Step, [Flash] also in the Flash Timings of a battle */
function magicFx(card, ctx) {                       // a Magic card can have a different effect for Main and Flash: magic.by = { MAIN: {...}, FLASH: {...} }
  const m = card.magic; if (!m) return null;
  if (m.by) { const b = m.by[String(ctx || 'main').toUpperCase()]; return b ? Object.assign({ timing: m.timing }, b) : null; }
  return m;
}
/* v0.47 "you can use this card from the Trash" (magic.trashUse): usable from the Trash while its condition holds; trashUse.actions replace the effect ("when used from the Trash, instead ...") */
const magicFromTrash = (p, inst) => !!p && p.trash.includes(inst);
function magicFxAt(p, inst, ctx) {
  const card = CARDS[inst.id], m = magicFx(card, ctx), tu = card.magic && card.magic.trashUse;
  return m && tu && tu.actions && magicFromTrash(p, inst) ? Object.assign({}, m, { effect: 'ACTIONS', actions: tu.actions }) : m;
}
function magicTrashOK(p, inst) { const tu = CARDS[inst.id].magic && CARDS[inst.id].magic.trashUse; return !!tu && (!tu.if || fxIf(p, G.p[other(p.key)], tu.if)); }
const magicSources = (p, ctx) => p.hand.concat(p.trash.filter(t => CARDS[t.id].type === 'Magic' && magicTrashOK(p, t) && magicUsable(p, t, ctx)));
function magicTargets(p, inst, ctx) {                    // null = no target needed, [] = needed but none available
  const m = magicFx(CARDS[inst.id], ctx); if (!m || !m.effect) return null;
  const fx = MAGIC_FX[m.effect]; if (!fx.side) return null;
  const q = fx.side === 'opp' ? G.p[other(p.key)] : p;
  return q.spirits.filter(sp => fx.ok(sp, m.value, m) && !(q !== p && fxImmune(q, sp, { p, src: inst })));   // v0.58: unaffected opposing Spirits are no target
}
/* v0.64 Soul Magic (Standard CR 12-2-1-2; Q&A 31159-31161): "If you control any <colour> symbol, you can use it with just the Soul Core".
   The Soul Core must be where costs are paid from (Reserve or a Field card, not the Life or Trash); the Spirit that shows the
   only matching symbol may give it. soulMagicHolder prefers the Reserve, then a card that keeps its level, then any Field card. */
function soulMagicHolder(p) {
  if (p.reserve.soul) return 'reserve';
  const f = fieldList(p).filter(x => x.soul);
  return f.find(x => !isSpiritForm(CARDS[x.id]) || spare(x) >= 1) || f[0] || null;
}
function soulMagicOK(p, card) {
  if (!card || !card.soulMagic || !p) return false;
  return soulMagicHolder(p) !== null && fieldSymbols(p).some(a => a.includes(card.soulMagic));
}
/* who pays how: an explicit choice (ch.soulMagic true/false) wins; otherwise Soul Magic when the normal cost cannot be paid,
   or for the CPU when the normal cost is 3 or more (one core instead of many) */
function soulMagicPick(p, card, ch) {
  if (!soulMagicOK(p, card)) return false;
  if (ch && ch.soulMagic != null) return ch.soulMagic === true;
  const c = effCost(p, card);
  return c > coresAvailable(p) || (!!p.cpu && c >= 3);
}
function magicUsable(p, inst, ctx, free) {   // free: "without paying the cost" (USE_FLASH)
  const card = CARDS[inst.id]; if (!card || card.type !== 'Magic') return false;
  const timing = card.magic ? card.magic.timing : ['MAIN'];
  if (ctx === 'flash' && !timing.includes('FLASH')) return false;
  if (ctx !== 'flash' && card.magic && card.magic.noMain) return false;   // v0.44 (Can't Use in Main)
  if (!free && effCost(p, card) > coresAvailable(p) && !soulMagicOK(p, card)) return false;   // v0.64: Soul Magic pays with the Soul Core only
  if (magicFromTrash(p, inst) && !magicTrashOK(p, inst)) return false;
  const fm = magicFxAt(p, inst, ctx); if (card.magic && card.magic.by && !fm) return false;
  if (fm && fm.if && !fxIf(p, G.p[other(p.key)], fm.if)) return false;
  if (fm && fm.effect === 'ACTIONS') {                  // v0.41: usable when at least one action has its condition met and something to act on
    const c = { p, opp: G.p[other(p.key)], src: inst, ctx: {} };
    const can = a => !FX_ACTIONS[a.do].can || FX_ACTIONS[a.do].can(c, a);
    if (fm.actions.some(a => a.cost && !can(a))) return false;   // v0.43: an action marked "cost" (e.g. "by discarding a Crimson from your Hand") must be payable
    if (!fm.actions.some(a => !a.cost && (!a.if || (!a.if.prev && fxIf(c.p, c.opp, a.if, c.ctx))) && can(a)) && !fm.actions.every(a => a.cost)) return false;
  }
  const t = magicTargets(p, inst, ctx);
  return !(t && !t.length);
}
function magicText(card) {
  const m = card.magic; if (!m) return card.desc;
  if (m.by) return Object.entries(m.by).map(([k, b]) => `[${k === 'MAIN' ? 'Main' : 'Flash'}] ${MAGIC_FX[b.effect].text(b.value, b)}`).join(' ');
  return `${m.timing.map(x => '[' + (x === 'MAIN' ? 'Main' : 'Flash') + ']').join('')} ${m.effect ? MAGIC_FX[m.effect].text(m.value, m) : card.desc}`;
}
async function castMagic(p, ch) {                         // ch = { inst, target, plan }
  const inst = ch.inst, fromTrash = magicFromTrash(p, inst), card = CARDS[inst.id], m = magicFxAt(p, inst, ch.ctx), free = !!ch.free, sm = !free && soulMagicPick(p, card, ch), alt = !sm && !free && costAltActive(p, card), c = free ? 0 : effCost(p, card), opp = G.p[other(p.key)];
  if (!sm && !free) legacyPay(p, inst);
  if (alt) { p.onceUsed = p.onceUsed || {}; p.onceUsed['costalt:' + card.name] = G.turnNo; }
  const smHolder = sm ? soulMagicHolder(p) : null;              // chosen before the card leaves the Hand (symbols stay as they are)
  removeFrom(p.hand, inst); if (fromTrash) removeFrom(p.trash, inst);
  if (sm) {                                                     // v0.64 Soul Magic: the whole cost is the Soul Core, which goes to the Trash
    if (smHolder === 'reserve') p.reserve.soul = false; else smHolder.soul = false;
    p.trashCores.soul = true;
  } else if (!free) payCost(p, c, ch.plan);
  log(`${who(p)} ${p.cpu ? 'casts' : 'cast'} ${card.name}${fromTrash ? ' from the Trash' : ''} (${free ? 'without paying the cost' : sm ? 'Soul Magic: paid the Soul Core' : 'paid ' + c}).`);
  checkDepletion(p);
  const fromBurst = p.limbo === inst;                       // v0.44: cast from the Burst (burstFlash); maybeBurst moves it to the Trash afterwards
  const prevLimbo = p.limbo; if (!fromBurst) p.limbo = inst;   // the card being resolved is in no zone: count it while its effect runs (SIM invariants)
  try {
    if (m && m.effect) {
      const fx = MAGIC_FX[m.effect], t = ch.target;
      if (!fx.side) await fx.apply(p, opp, null, m.value, m, inst);
      else if (t && (fx.side === 'opp' ? opp : p).spirits.includes(t) && fx.ok(t, m.value, m) && !(fx.side === 'opp' && fxImmune(opp, t, { p, src: inst }))) fx.apply(p, opp, t, m.value, m);
      else log(`${card.name}: no valid target remains.`);
    } else log(`${card.name}: this effect is not implemented in this build.`);
  } finally { if (!fromBurst && p.limbo === inst) p.limbo = prevLimbo; }
  if (fromTrash) { toRemoved(p, inst); log(`${card.name} is banished (used from the Trash).`); }
  else if (!fromBurst) p.trash.push(inst);
  if (G && G.attacker && G.battleMagic) G.battleMagic.push({ key: p.key, inst });      // v0.78 Brilliance: Magic used during this battle
  /* v0.116 "When you use a <family>/<colour> Magic card": the Magic is in the Trash by now; a Burst is not a use of a Magic card */
  if (!fromBurst && G && !G.over) {
    p.magicTurn = (p.magicTurn && p.magicTurn.turn === G.turnNo) ? p.magicTurn : { turn: G.turnNo, cards: [] };
    p.magicTurn.cards.push(inst.id);
    await fireFx(p, 'MAGIC_USED', null, { subject: inst });
  }
  checkDepletion(p); checkDepletion(opp);
}

/* manual core movement during the Main Step */
/* v0.126.0 U14d3: display-only record of one core moving (a uid or 'reserve' at each end); the web host flies it, other hosts ignore it */
const coreEv = (p, kind, from, to, nth) => io.view({ type: 'core', side: p.key, kind, from, to, nth });
const coreEvN = (p, from, to, n, soul) => { for (let i = 0; i < Math.min(n, 5); i++) coreEv(p, 'core', from, to, i); if (soul) coreEv(p, 'soul', from, to, Math.min(n, 5)); };   // v0.149.0: n gems fly one after the other (display cue only)
function addCore(p, f) { if (p.reserve.n > 0) { coreEv(p, 'core', 'reserve', f.uid); p.reserve.n--; f.cores++; return true; } return false; }
function removeCore(p, f) { if (f.cores > 0) { coreEv(p, 'core', f.uid, 'reserve'); f.cores--; p.reserve.n++; checkDepletion(p); return true; } return false; }
function moveSoulTo(p, f) {
  if (f.soul) return 'already';
  if (p.reserve.soul) { coreEv(p, 'soul', 'reserve', f.uid); p.reserve.soul = false; f.soul = true; return 'ok'; }
  const from = fieldList(p).find(x => x.soul);
  if (!from) return 'none';
  if (spare(from) < 1) return 'deplete';
  coreEv(p, 'soul', from.uid, f.uid); from.soul = false; f.soul = true; return 'ok';
}
function moveCore(p, from, to) {
  if (from === to || from.cores < 1 || isGW(from) || isGW(to)) return false;     // manual p. 22: Grandwalker cores cannot be moved, nor moved onto one
  coreEv(p, 'core', from.uid, to.uid); from.cores--; to.cores++; checkDepletion(p); return true;
}
function swapSoul(p, withSoul, other) {       // Soul Core and a normal core trade places (totals unchanged, nothing depletes)
  if (!withSoul.soul || other.cores < 1 || withSoul === other || isGW(other) || isGW(withSoul)) return false;
  coreEv(p, 'soul', withSoul.uid, other.uid); coreEv(p, 'core', other.uid, withSoul.uid);
  withSoul.soul = false; withSoul.cores++; other.cores--; other.soul = true; return true;
}
function returnSoul(p, f) {
  if (!f.soul) return 'none';
  if (isSpiritForm(CARDS[f.id]) && spare(f) < 1) return 'deplete';
  coreEv(p, 'soul', f.uid, 'reserve'); f.soul = false; p.reserve.soul = true; return 'ok';
}

