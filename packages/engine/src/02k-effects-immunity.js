
/* =====================================================================
   v0.58 IMMUNITY (rules audit R3 item 2 + session E): every effect action that lists targets (FX_ACTIONS[k].cands) skips a card
   on the OPPOSING Field that is unaffected by this effect's source (fxImmune with the acting effect c). An action marked
   ignoreImmune ("cannot be prevented") keeps them: FAQ Q4 order "cannot be prevented" > "unaffected" > "cannot activate".
   Trash: a card with trashUnaffected ("this card in Trash is unaffected by any effects") is never picked from a Trash by an effect.
   ===================================================================== */
/* v432: `trashOpp` card flag = "this card in Trash is unaffected by opposing effects"; TRASH_SAFE_TURN sets p.trashSafeFam for a turn (owner-only flag, read here with the acting effect c). */
const trashSafe = (t, c) => {
  const d = t && CARDS[t.id]; if (!d) return false;
  if (d.trashUnaffected) return true;
  if (G && c && trashLocked(t, c.src)) return true;      // v577 TRASH_LOCK
  if (!c || !c.p || !G) return false;
  const own = G.p.player.trash.includes(t) ? G.p.player : G.p.opponent.trash.includes(t) ? G.p.opponent : null;
  if (!own || c.p === own) return false;
  return !!d.trashOpp || (own.trashSafeTurn === G.turnNo && !!own.trashSafeFam && (d.families || []).includes(own.trashSafeFam));
};
/* v0.106.0: this used to be a bare loop. The action table is now split over 02b and 02q-02t,
   so the parts that load after this one call wrapImmunity() again once they have added their
   entries (the flag makes it idempotent, so calling it more often costs nothing). */
/* v158 Camou N: an opposing Spirit effect can't target this Spirit unless its owner pays N costs; shortcut: the payment is not modelled, so it is never targetable by Spirit effects. */
const camouBlocks = (owner, t, c) => !!c.src && !!CARDS[c.src.id] && CARDS[c.src.id].type === 'Spirit' && c.p !== owner && flagActive(owner, 'CAMOU', t);
function wrapImmunity(actions) {
for (const A of actions) {
  if (typeof A.cands !== 'function' || A.cands.immunityWrapped) continue;
  const raw = A.cands;
  A.cands = function (c, ...rest) {
    const L = raw.call(this, c, ...rest);
    if (!Array.isArray(L) || !c || !c.p || !G) return L;
    const a = rest.find(x => x && typeof x === 'object' && typeof x.do === 'string');
    const opp = G.p[other(c.p.key)], oppField = fieldList(opp);
    return L.filter(x => !(x && ((G.p.player.trash.includes(x) || G.p.opponent.trash.includes(x)) && trashSafe(x, c)))
      && !(x && !(a && a.ignoreImmune === true) && oppField.includes(x) && (fxImmune(opp, x, c) || camouBlocks(opp, x, c)))
      && !(x && !(a && a.ignoreImmune === true) && c.src !== x && fieldList(c.p).includes(x) && flagActive(c.p, 'UNAFFECTED', x, e => e.exceptOwn === true)));      // v566 exceptOwn: also the owner's other effects skip it
  };
  A.cands.immunityWrapped = true;
}
}
wrapImmunity(Object.values(FX_ACTIONS));
