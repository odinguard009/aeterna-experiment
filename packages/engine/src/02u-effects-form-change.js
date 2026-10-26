/* ---------------------------------------------------------------------
   FORM CHANGE (v0.135.0, schema v8; Kamen Rider cross-over cards): {{F Change|"X" & Cost N}} {{Invoke|Main}}
   "Return this exhausted Spirit to the Hand, and you must summon a Cost N "X" with a different name from your Hand, without paying
   the cost. You can only use this effect of the same card name once per turn." (the once-per-name limit is the effect's `sameName`).
   The summoned card carries inst.viaFC while its When Summoned effects resolve ("If summoned via Form Change, ...").
   House readings (no rule page covers them): the returned Spirit's cores go to the Reserve first (bounceCard), so they can pay the
   summoned card's Lv1 cores; the effect cannot be used when no Hand card qualifies (so nothing is bounced for nothing).
   --------------------------------------------------------------------- */
const fcCands = (p, src, a, extraCores) => p.hand.filter(h => {
  const k = CARDS[h.id];
  return k.type === 'Spirit' && fxMatch(k, a.match) && a.costIn.includes(k.cost) && k.name !== CARDS[src.id].name && summonOK(p, k) && minCores(k) <= coresAvailable(p) + extraCores;
});
Object.assign(FX_ACTIONS, {
  FORM_CHANGE: { chk: a => hasMatch(a.match) && Array.isArray(a.costIn) && a.costIn.length >= 1 && a.costIn.length <= 3 && a.costIn.every(n => Number.isInteger(n) && n >= 0 && n <= 30),
    txt: a => `Form Change: return this exhausted Spirit to your Hand and summon a Cost ${a.costIn.join('/')} Spirit with a different name from your Hand without paying the cost`,
    can: (c, a) => c.p.spirits.includes(c.src) && !!c.src.exhausted && fcCands(c.p, c.src, a, c.src.cores).length > 0,
    run: async (c, a) => {
      const p = c.p, src = c.src;
      if (!p.spirits.includes(src) || !src.exhausted || !fcCands(p, src, a, src.cores).length) { c.ctx.did = false; return; }
      bounceCard(p, src, 'hand'); checkDepletion(p); handUp(p, 1); io.view({ type: 'board' });
      const L = fcCands(p, src, a, 0).filter(h => canPlaceFree(p, h));
      if (!L.length) { c.ctx.did = false; return; }                 // the returned cores could not pay any Lv1: the Spirit simply stays in the Hand
      let t;
      if (p.cpu) t = L.slice().sort((x, y) => (CARDS[y.id].levels[0].bp || 0) - (CARDS[x.id].levels[0].bp || 0) || CARDS[y.id].cost - CARDS[x.id].cost)[0];
      else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = ids.length === 1 ? ids[0] : await ask({ title: `✨ ${CARDS[src.id].name}`, peek: true, wide: true, html: 'Form Change: choose a card to summon without paying the cost.', cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
        t = L.find(x => x.id === id) || L[0];
      }
      log(`${CARDS[src.id].name}: Form Change into ${CARDS[t.id].name}.`);
      await summonFree(p, t, { formChange: true });
    } } });
