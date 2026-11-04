/* ---------------------------------------------------------------------
   v0.49 KEYWORD EFFECTS as engine data (session D, part 1): High Speed, Crush, Holy Life.
   High Speed (card text): "This card in Hand can be summoned by paying the cost with cores in the Reserve. In this case, cores to be
   put on this Spirit must also be from the Reserve." Printed as "Flash - High Speed": used in the Flash Timings of a battle (in the
   Main Step a normal summon already does the same). Card flag "highSpeed": true.
   Crush: "Discard a number of cards equal to this Spirit's level from opposing decktop." -> action CRUSH {n: "lv" | 1-5}.
   Holy Life needs no new code: {"trigger":"ALLY_LIFE_HIT","self":true,"actions":[{"do":"VOID_TO_LIFE","n":1}]}.
   --------------------------------------------------------------------- */
function highSpeedOK(p, inst) {
  const card = CARDS[inst.id];
  if (!card || !(card.highSpeed || card.flashSummon) || !isSpiritForm(card) || !p.hand.includes(inst) || !summonOK(p, card)) return false;
  if (card.highSpeedIf && !fxIf(p, G.p[other(p.key)], card.highSpeedIf, {})) return false;      // v138 "Flash - <condition>, you can summon this card from the Hand"
  if (card.highSpeedOnce && p.hsOnce && p.hsOnce[card.name] === G.turnNo) return false;      // "only once per turn per card name"
  if (card.flashSummon) return !!fsNexus(p, card);      // v465 flashSummon: Soul Core to the Nexus instead of paying
  return effCost(p, card) + minCores(card) <= reserveTotal(p);
}
/* v465 card field flashSummon {counterGe?, nexus: match}: "Flash: (Once per Turn: Same Name) [if N counters,] by sending your Soul Core to a matching Nexus, summon this card from the Hand, treating all summon costs as paid". Returns the Nexus that receives the Soul Core. */
function fsNexus(p, card) {
  const f = card.flashSummon; if (f && f.fromNexus) return (f.counterGe && p.count < f.counterGe) || (p.fsOnce && p.fsOnce[card.name] === G.turnNo) ? null : p.nexus.find(n => n.soul && fxMatch(CARDS[n.id], f.nexus)) || null;      // fromNexus: the Soul Core moves from the Nexus onto this card
  if (!f || !soulSource(p) || (f.counterGe && p.count < f.counterGe) || (p.fsOnce && p.fsOnce[card.name] === G.turnNo)) return null;
  return p.nexus.find(n => !n.soul && fxMatch(CARDS[n.id], f.nexus)) || null;
}
const highSpeedSources = p => p.hand.filter(h => highSpeedOK(p, h));
async function highSpeedSummon(p, inst) {
  if (!highSpeedOK(p, inst)) return false;
  const card = CARDS[inst.id], fs = card.flashSummon ? fsNexus(p, card) : null, c = fs ? 0 : effCost(p, card); if (!fs) legacyPay(p, inst);
  const fromN0 = fs && card.flashSummon.fromNexus; if (fs) { (p.fsOnce = p.fsOnce || {})[card.name] = G.turnNo; if (fromN0) { fs.soul = false; log(`${poss(p)} Soul Core moves from ${CARDS[fs.id].name} to ${card.name}.`); } else await soulToNexus(p, fs); }
  if (card.highSpeedOnce) (p.hsOnce = p.hsOnce || {})[card.name] = G.turnNo;
  const fromN = Math.min(c, p.reserve.n), plan = { reserve: fromN, by: {}, rsoul: c > fromN, fsoul: null };
  removeFrom(p.hand, inst); inst.mirage = false;
  const soulPaid = payCost(p, c, plan);
  inst.viaFC = false; inst.viaHS = true; inst.viaFx = false; inst.soulPaid = soulPaid; inst.soulLost = false; inst.cores = 0; inst.soul = !!fromN0; inst.exhausted = false; inst.heavy = false; inst.noAB = false; inst.summonedTurn = G.turnNo; inst.bpMod = 0;
  let need = card.levels[0].cores - (fromN0 ? 1 : 0);                       // Lv1 cores also come from the Reserve only
  while (need > 0 && p.reserve.n > 0) { p.reserve.n--; inst.cores++; need--; }
  if (need > 0 && p.reserve.soul) { p.reserve.soul = false; inst.soul = true; need--; }
  p.spirits.push(inst);
  log(`${who(p)} ${p.cpu ? 'summons' : 'summon'} ${card.name} ${fs ? 'by ' + (fromN0 ? 'moving the Soul Core from ' : 'sending the Soul Core to ') + CARDS[fs.id].name + ' (costs treated as paid)' : 'with High Speed (paid ' + c + ' from the Reserve)'}.`);
  checkDepletion(p); io.view({ type: 'board' }); await wait(350);
  if (!G.over && p.spirits.includes(inst)) await fireFx(p, 'SUMMONED', inst);
  return true;
}
/* CPU: as the defender before the block, summon a High Speed Spirit that wins (or, at low Life, at least makes) the block */
function cpuHighSpeed(p, attKey, att, blk) {
  if (p.key === attKey || blk || !att) return null;
  const L = highSpeedSources(p); if (!L.length) return null;
  const bp = h => CARDS[h.id].levels[0].bp, ready = p.spirits.some(s => !s.exhausted && !s.noAB && bpOf(s) > bpOf(att));
  if (ready) return null;
  const win = L.filter(h => bp(h) > bpOf(att)).sort((a, b) => bp(a) - bp(b))[0];
  if (win) return win;
  return p.life <= 2 && !p.spirits.some(s => !s.exhausted && !s.noAB) ? L.sort((a, b) => effCost(p, CARDS[a.id]) - effCost(p, CARDS[b.id]))[0] : null;
}
Object.assign(FX_ACTIONS, {
  CRUSH: { chk: a => (a.n === 'lv' || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 10)) && (a.perKeyword == null || (typeof a.perKeyword === 'string' && Number.isInteger(a.n))),      // v276 perKeyword: "For each of your Spirits with Crush, discard three cards from the opposing decktop"
    txt: a => `discard ${a.n === 'lv' ? "cards equal to this Spirit's level" : a.n + ' card' + (a.n === 1 ? '' : 's')} from the opposing decktop (Crush)`,
    can: c => c.opp.deck.length > 0,
    run: async (c, a) => {
      const n = a.n === 'lv' ? (fieldList(c.p).includes(c.src) ? lvNo(c.src) : 0) : a.perKeyword ? a.n * c.p.spirits.filter(x => cardHasKeyword(CARDS[x.id], a.perKeyword)).length : a.n;
      const top = c.opp.deck.splice(0, Math.min(n, c.opp.deck.length)); if (!top.length) { c.ctx.did = false; return; }
      for (const x of top) c.opp.trash.push(x);
      c.ctx.crushed = top;
      log(`${_nmK(c)}: Crush discards ${top.length} card${top.length === 1 ? '' : 's'} from ${poss(c.opp)} Deck (${top.map(x => CARDS[x.id].name).join(', ')}).`);
      io.view({ type: 'board' });
    } },
  /* v0.56 Ultimate Trigger (card reminder text, Fandom Ultimate-Sea-Serpendar / Ultimate-Cu-Sith: "Send a card from the opposing decktop
     to the Trash. If that card's cost is lower than this Ultimate's, it's a hit."). Sets ctx.utHit / ctx.utCost; the "When Ultimate
     Trigger hits" actions carry {"if":{"utHit":true}}. Guard / Trigger Counter cards are not wired. */
  ULT_TRIGGER: { chk: a => Object.keys(a).every(k => k === 'do' || k === 'if'),
    txt: () => 'Ultimate Trigger: send the opposing decktop card to the Trash; a lower cost than this card is a hit',
    can: c => c.opp.deck.length > 0,
    run: async (c) => {
      c.ctx.utHit = false; c.ctx.utCost = 0;
      const x = c.opp.deck.shift(); if (!x) { c.ctx.did = false; log(`${_nmK(c)}: Ultimate Trigger - the opposing deck is empty, no hit.`); return; }
      c.opp.trash.push(x);
      const k = CARDS[x.id], hit = k.cost < CARDS[c.src.id].cost;
      c.ctx.utHit = hit; c.ctx.utCost = k.cost; c.ctx.did = hit;
      log(`${_nmK(c)}: Ultimate Trigger sends ${k.name} (cost ${k.cost}) from ${poss(c.opp)} Deck to the Trash - ${hit ? 'hit!' : 'no hit.'}`);
      io.view({ type: 'board' });
    } },
});
const _nmK = c => CARDS[c.src.id].name;
