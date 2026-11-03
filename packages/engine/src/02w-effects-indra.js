/* v422 Grandwalker Indra family helpers.
   SYM_FIXED_ON_SUMMON {match, color, n} (STATIC, own Spirit): while that Spirit is on the Field and a card matching `match` is summoned/deployed/used,
   the Spirit's own symbols count as exactly n symbols of `color` (BS75-046 Shimavajdra LV2/3). Edits the symbol list effCost passes to reductionOf. */
function symFixedOnSummon(p, card, syms) {
  for (const src of p.spirits) for (const e of CARDS[src.id].effects || []) {
    if (e.trigger !== 'STATIC' || e.flag !== 'SYM_FIXED_ON_SUMMON' || (e.lv && !e.lv.includes(lvNo(src))) || !fxMatch(card, e.match)) continue;
    for (const a of symbolAttrs(CARDS[src.id])) { const i = syms.findIndex(x => x.join() === a.join()); if (i >= 0) syms.splice(i, 1); }
    for (let k = 0; k < e.n; k++) syms.push([e.color]);
  }
}

let fxLockBusy = false;
function fxLocked(f) {      // v422 OPP_CAB_FX_LOCK (Nazuma): effects of opposing Cost <= counters Spirits under can't attack/block can't activate; v422 p.fxLockTurn (Shimavajdra): all opposing Spirit effects this turn
  const own = G.p.player.spirits.includes(f) ? G.p.player : G.p.opponent.spirits.includes(f) ? G.p.opponent : null; if (!own) return false;
  const foe = G.p[other(own.key)];
  if (foe.fxLockTurn === G.turnNo) return true;
  if (!f.noAB) return false;
  fxLockBusy = true;
  try { return fieldList(foe).some(src => (CARDS[src.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'OPP_CAB_FX_LOCK' && (!e.lv || e.lv.includes(lvNo(src))) && CARDS[f.id].cost <= foe.count && fxIf(foe, own, e.if, { selfInst: src }))); }
  finally { fxLockBusy = false; }
}
