/* ---------------------------------------------------------------------
   v0.38 GREEN (Contractor Hermes / Lionheart): Heavy Exhaust, the Removed Zone, exhaust effects, "the opponent can't activate Burst effects".
   Rules: Heavy Exhaust = the card is turned upside down; it cannot attack or block, and one Refresh turns it into a normal Exhausted card
   (glossary HEAVY_EXHAUST; the engine keeps `heavy` next to `exhausted`, so every "exhausted" check already stops attack/block).
   Removed Zone = p.removed. A card put onto the opposing Removed Zone queues a REMOVED event; the other player's OPP_REMOVED effects fire from flushBursts.
   --------------------------------------------------------------------- */
function setHeavy(t) { t.exhausted = true; t.heavy = true; }
function refreshOne(t) { if (t.heavy) t.heavy = false; else t.exhausted = false; }          // one Refresh: Heavy Exhaust -> Exhaust, Exhaust -> Ready
function toRemoved(owner, card) { owner.removed.push(card); if (G && G.evQ && !G.over) G.evQ.push({ type: 'REMOVED', key: owner.key }); }
function fromHandRemoved(owner, card) { removeFrom(owner.hand, card); toRemoved(owner, card); }
const _nm = c => CARDS[c.src.id].name;
const handSafe = (h, o, c) => !!CARDS[h.id].handUnaffected || (!!o && handLocked(o, c));
/* v0.58 STATIC HAND_UNAFFECTED: "your Hand is unaffected by opposing effects" while that Field card (level, condition) is active */
const handLocked = (o, c) => !!c && c.p !== o && fieldList(o).some(f => flagActive(o, 'HAND_UNAFFECTED', f));      // v0.47 Lightning Tempest: "this card in Hand/Removed Zone is unaffected by opposing effects"
async function pickOppSpirits(c, L, n, text) {                       // up to n distinct targets; the CPU takes the strongest untapped ones first
  const out = [];
  for (let j = 0; j < n; j++) {
    const left = L.filter(t => !out.includes(t)); if (!left.length) break;
    const t = c.p.cpu ? left.slice().sort((a, b) => (a.exhausted - b.exhausted) || (bpOf(b) - bpOf(a)) || (b.cores - a.cores))[0] : await fxPickTarget(c, left, text);
    if (!t) break; out.push(t);
  }
  return out;
}
Object.assign(FX_ACTIONS, {
  EXHAUST_OPP: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.noSoul == null || a.noSoul === true),
    txt: a => `exhaust ${a.n === 1 ? 'an' : 'up to ' + a.n} opposing Spirit${a.n === 1 ? '' : 's'}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''}${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' : ''}`,
    cands: (c, a) => c.opp.spirits.filter(t => !t.exhausted && !fxImmune(c.opp, t) && (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (a.bpLe == null || bpOf(t) <= a.bpLe) && !(a.noSoul && t.soul)),      // v0.197 noSoul: "without (Soul Core) on it"
    can: (c, a) => FX_ACTIONS.EXHAUST_OPP.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.EXHAUST_OPP.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.n, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit to exhaust (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { t.exhausted = true; log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[t.id].name} is exhausted.`); }
      await fireFx(c.p, 'EXHAUSTED_FX', null, { side: 'opp', fxSrc: c.src });
      for (const t of T) await fireFx(c.opp, 'EXHAUSTED_FX', null, { side: 'own', subject: t, fxSrc: c.src });
    } },
  /* v0.55 BP minus: "during this turn, give an opposing Spirit/Ultimate -N BP". Lasts until the end of the turn (bpMod is cleared in
     beginTurn); BP never shows below 0 (Standard CR 1-4-6). A Spirit at 0 BP is NOT destroyed by a rule (Eternal manual FAQ p. 68);
     destruction needs the card's own "Then, if its BP is 0, destroy it" clause. */
  BP_MINUS: { chk: a => Number.isInteger(a.n) && a.n >= 1000 && a.n <= 30000 && a.n % 1000 === 0 && (a.blockerOnly == null || a.blockerOnly === true) && (a.targets == null || (Number.isInteger(a.targets) && a.targets >= 1 && a.targets <= 2)),      // v192 targets: "target up to two opposing Spirits"
    txt: a => a.targets > 1 ? `give up to ${a.targets} opposing Spirits -${a.n} BP this turn` : `give an opposing Spirit -${a.n} BP this turn`,
    cands: (c, a) => c.opp.spirits.filter(t => !fxImmune(c.opp, t) && !(a && a.blockerOnly && t !== c.ctx.blocker)),      // v157 blockerOnly: "target an opposing blocking Spirit"
    can: (c, a) => FX_ACTIONS.BP_MINUS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.BP_MINUS.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.targets || 1, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit to give -${a.n} BP (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { t.bpMod = (t.bpMod || 0) - a.n; log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[t.id].name} gets -${a.n} BP (${bpOf(t)} BP).`); }
    } },
  HEAVY_EXHAUST_OPP: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.exhaustedOnly == null || a.exhaustedOnly === true) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 20)) && (a.per == null || perOk(a.per)),      // v189 per: "target an opposing Spirit for each <X> you control"
    txt: a => a.per ? 'heavy exhaust an opposing Spirit for each matching card you control' : `heavy exhaust ${a.n === 1 ? 'an' : 'up to ' + a.n} ${a.exhaustedOnly ? 'exhausted ' : ''}opposing Spirit${a.n === 1 ? '' : 's'}`,
    cands: (c, a) => c.opp.spirits.filter(t => !t.heavy && !fxImmune(c.opp, t) && (!a || !a.exhaustedOnly || t.exhausted) && (!a || a.costLe == null || CARDS[t.id].cost <= a.costLe)),      // v0.195 exhaustedOnly: "target an opposing exhausted Spirit"
    can: (c, a) => (a.per == null || perCount(c.p, a.per) > 0) && FX_ACTIONS.HEAVY_EXHAUST_OPP.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.HEAVY_EXHAUST_OPP.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.per ? Math.max(1, a.n * perCount(c.p, a.per)) : a.n, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit to Heavy Exhaust (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { setHeavy(t); log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[t.id].name} is heavy exhausted.`); }
      await fireFx(c.p, 'EXHAUSTED_FX', null, { side: 'opp', heavy: true, fxSrc: c.src });
      for (const t of T) await fireFx(c.opp, 'EXHAUSTED_FX', null, { side: 'own', subject: t, heavy: true, fxSrc: c.src });
    } },
  /* "put a random card from the opposing Hand onto their Removed Zone" (the cards are kept in ctx.removedCards / ctx.removedN) */
  REMOVE_OPP_HAND: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && (a.toSize == null || (Number.isInteger(a.toSize) && a.toSize >= 0 && a.toSize <= 10)) && (a.counterIfCostLe == null || (a.counterIfCostLe && Number.isInteger(a.counterIfCostLe.cost) && Number.isInteger(a.counterIfCostLe.n) && a.counterIfCostLe.n >= 1 && a.counterIfCostLe.n <= 5)),
    txt: a => a.toSize != null ? `put random cards from the opposing Hand onto their Removed Zone until it holds ${a.toSize}` : `put ${a.n} random card${a.n === 1 ? '' : 's'} from the opposing Hand onto their Removed Zone`,
    can: (c, a) => c.opp.hand.filter(h => !handSafe(h, c.opp, c)).length > (a.toSize != null ? a.toSize : 0),
    run: async (c, a) => {
      const H = () => c.opp.hand.filter(h => !handSafe(h, c.opp, c)), k = a.toSize != null ? H().length - a.toSize : Math.min(a.n, H().length);   // v0.47: cards unaffected in the Hand stay
      if (k <= 0) { c.ctx.did = false; return; }
      c.ctx.removedCards = [];
      for (let j = 0; j < k && H().length; j++) { const L = H(), t = L[Math.floor(rng() * L.length)]; fromHandRemoved(c.opp, t); c.ctx.removedCards.push(t); }
      c.ctx.removedN = c.ctx.removedCards.length;
      log(`${_nm(c)}: ${c.ctx.removedN} random card${c.ctx.removedN === 1 ? '' : 's'} from ${poss(c.opp)} Hand go onto their Removed Zone.`);
      if (a.counterIfCostLe && c.ctx.removedCards.some(t => CARDS[t.id].cost <= a.counterIfCostLe.cost)) await FX_ACTIONS.COUNTER.run(c, { n: a.counterIfCostLe.n });
    } },
  /* "the opponent puts a card from their Hand onto their Removed Zone": the OPPONENT chooses (the CPU gives up its cheapest card) */
  OPP_CHOOSES_REMOVE_HAND: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.counterIfCostLe == null || (a.counterIfCostLe && Number.isInteger(a.counterIfCostLe.cost) && Number.isInteger(a.counterIfCostLe.n) && a.counterIfCostLe.n >= 1 && a.counterIfCostLe.n <= 5)),
    txt: a => `the opponent puts ${a.n} card${a.n === 1 ? '' : 's'} from their Hand onto their Removed Zone`,
    can: c => c.opp.hand.some(h => !handSafe(h, c.opp, c)),
    run: async (c, a) => {
      c.ctx.removedCards = [];
      const H = () => c.opp.hand.filter(h => !handSafe(h, c.opp, c));
      for (let j = 0; j < a.n && H().length; j++) {
        let t;
        if (c.opp.cpu) t = H().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0];
        else {
          const ids = Array.from(new Set(H().map(x => x.id))).slice(0, 8);
          const id = await ask({ title: `✨ ${_nm(c)}`, peek: true, wide: true, html: 'Choose a card from your Hand to put onto your Removed Zone.', cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
          t = H().find(x => x.id === id) || H()[0];
        }
        fromHandRemoved(c.opp, t); c.ctx.removedCards.push(t);
      }
      if (!c.ctx.removedCards.length) { c.ctx.did = false; return; }
      c.ctx.removedN = c.ctx.removedCards.length;
      log(`${_nm(c)}: ${poss(c.opp)} ${c.ctx.removedCards.map(t => CARDS[t.id].name).join(', ')} goes onto their Removed Zone.`);
      if (a.counterIfCostLe && c.ctx.removedCards.some(t => CARDS[t.id].cost <= a.counterIfCostLe.cost)) await FX_ACTIONS.COUNTER.run(c, { n: a.counterIfCostLe.n });
    } },
  /* "put a card (or every card) from the opposing Trash onto their Removed Zone" */
  REMOVE_OPP_TRASH: { chk: a => (a.all === true || a.n === 1),
    txt: a => a.all ? 'banish every card in the opposing Trash' : 'put a card from the opposing Trash onto their Removed Zone',
    can: c => c.opp.trash.some(t => !trashSafe(t)),
    run: async (c, a) => {
      const T = c.opp.trash.filter(t => !trashSafe(t));   // v0.58: "this card in Trash is unaffected by any effects" stays
      if (!T.length) { c.ctx.did = false; return; }
      const list = a.all ? T : [await chooseCard(c, T, `✨ ${_nm(c)}`, 'Choose a card from the opposing Trash to put onto their Removed Zone.', false)];
      let k = 0; for (const t of list) { if (t && removeFrom(c.opp.trash, t)) { toRemoved(c.opp, t); k++; } }
      c.ctx.removedN = k; if (!k) { c.ctx.did = false; return; }
      log(`${_nm(c)}: ${k} card${k === 1 ? '' : 's'} from ${poss(c.opp)} Trash go onto their Removed Zone.`);
    } },
  /* "send an opposing Spirit/Ultimate to the Removed Zone" (cores go to its Reserve; Tokens return to the supply instead) */
  SEND_REMOVED: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && (a.costLe == null || Number.isInteger(a.costLe)) && (a.exhaustedOnly == null || a.exhaustedOnly === true),
    txt: a => `send ${a.n === 1 ? 'an' : a.n} opposing ${a.exhaustedOnly ? 'exhausted ' : ''}Spirit${a.n === 1 ? '' : 's'}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} to the Removed Zone`,
    cands: (c, a) => c.opp.spirits.filter(t => !fxImmune(c.opp, t) && (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (!a.exhaustedOnly || t.exhausted)),
    can: (c, a) => FX_ACTIONS.SEND_REMOVED.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SEND_REMOVED.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.n, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit to send to the Removed Zone (glowing).`);
      let k = 0;
      for (const t of T) {
        removeSpirit(c.opp, t, 'banished', false);
        const i = c.opp.trash.lastIndexOf(t); if (i >= 0) { c.opp.trash.splice(i, 1); toRemoved(c.opp, t); k++; }
        log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[t.id].name} is sent to the Removed Zone.`);
      }
      c.ctx.removedN = k; if (!T.length) c.ctx.did = false;
      checkDepletion(c.opp);
    } },
  /* "put a core from the Void each to N of your <family> Spirits (/Nexuses)": one core per target, distinct targets; counterIfFamily: when a core goes to ANOTHER Spirit of that family, your counter +1 (once) */
  VOID_TO_MATCHING: { chk: a => Number.isInteger(a.targets) && a.targets >= 1 && a.targets <= 5 && hasMatch(a.match) && (a.incNexus == null || typeof a.incNexus === 'boolean') && (a.exhausted == null || a.exhausted === true) && (a.other == null || a.other === true) && (a.counterIfFamily == null || (typeof a.counterIfFamily === 'string' && a.counterIfFamily.length > 0)),
    txt: a => `put a core from the Void each to up to ${a.targets} of your matching Spirits${a.incNexus ? '/Nexuses' : ''}${a.counterIfFamily ? '; when that puts a core to another "' + a.counterIfFamily + '" Spirit, your counter +1' : ''}`,
    cands: (c, a) => c.p.spirits.concat(a.incNexus ? c.p.nexus : []).filter(t => fxMatch(CARDS[t.id], a.match) && (!a.exhausted || t.exhausted) && !(a.other && t === c.src)),      // v0.196 exhausted: "your exhausted <X>"
    can: (c, a) => FX_ACTIONS.VOID_TO_MATCHING.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.VOID_TO_MATCHING.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const T = [];
      for (let j = 0; j < a.targets; j++) {
        const left = L.filter(t => !T.includes(t)); if (!left.length) break;
        const t = c.p.cpu ? left.slice().sort((x, y) => (x.cores - y.cores) || (bpOf(y) - bpOf(x)))[0] : await fxPickTarget(c, left, `✨ <b>${esc(_nm(c))}</b><br>Tap a card that receives a core from the Void (glowing). ${j + 1}/${Math.min(a.targets, L.length)}`);
        if (!t) break; T.push(t);
      }
      let k = 0, bonus = false;
      for (const t of T) {
        if (!takeFromVoid(c.p, 1)) break; t.cores += 1; k++;
        if (a.counterIfFamily && t !== c.src && c.p.spirits.includes(t) && (CARDS[t.id].families || []).includes(a.counterIfFamily)) bonus = true;
        log(`${_nm(c)}: a core moves from the Void to ${CARDS[t.id].name}.`);
      }
      c.ctx.put = k; if (!k) { c.ctx.did = false; return; }
      if (bonus) await FX_ACTIONS.COUNTER.run(c, { n: 1 });
    } },
  /* "during this battle, the opponent can't activate Burst effects" (cleared when the battle ends) */
  NO_BURST_BATTLE: { chk: () => true, txt: () => "during this battle, the opponent can't activate Burst effects",
    can: () => !!G && !!G.attacker,
    run: async c => { G.noBurst = c.opp.key; log(`${_nm(c)}: ${poss(c.opp)} Burst effects cannot be activated during this battle.`); } }
});
