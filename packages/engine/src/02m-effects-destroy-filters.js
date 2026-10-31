/* v0.76 destroy filters (pack bundle, docs/mechanics/destroy-filters-conditions.md), wrapped onto DESTROY like the 02l filters:
   bpLeSelf  "with BP equal or inferior to this Spirit's" (the source's BP when it resolves)
   bpEqSelf  "with the same BP as this Spirit"
   symbolsGe "with two or more symbols" (printed symbols, like symbolsLe)
   costLePer "with a cost equal or less than the number of <X> you control" (perCount shape: {type: 'Spirit'|'Nexus', colors, family, name})
   Exactly one of them stands in for the bound; each needs the opposing Spirit/Ultimate to be a legal effect target (fxImmune). */
(() => {
  const D = FX_ACTIONS.DESTROY, dChk = D.chk, dCands = D.cands, dTxt = D.txt;
  const NEW = ['bpLeSelf', 'bpEqSelf', 'symbolsGe', 'costLePer', 'costIn', 'bpPerLegacy'];
  const has = a => NEW.some(k => a[k] != null);
  const okNew = a => (a.bpLeSelf == null || a.bpLeSelf === true) && (a.bpEqSelf == null || a.bpEqSelf === true)
    && (a.symbolsGe == null || (Number.isInteger(a.symbolsGe) && a.symbolsGe >= 1 && a.symbolsGe <= 5)) && (a.costLePer == null || perOk(a.costLePer))
    && (a.costIn == null || (Array.isArray(a.costIn) && a.costIn.length >= 1 && a.costIn.length <= 4 && a.costIn.every(x => Number.isInteger(x) && x >= 0 && x <= 30)))      // v0.168 "Cost 1/2" = cost 1 or 2
    && (a.bpPerLegacy == null || (!!a.bpPerLegacy && Number.isInteger(a.bpPerLegacy.n) && a.bpPerLegacy.n >= 1000 && a.bpPerLegacy.n <= 5000 && Array.isArray(a.bpPerLegacy.family) && a.bpPerLegacy.family.length > 0 && a.bpPerLegacy.family.every(f => typeof f === 'string' && f)))      // v193 "the targeting BP gets +N per EX Symbol of <family> banished via this Legacy"
    && NEW.filter(k => a[k] != null && k !== 'bpPerLegacy').length <= 1 && !a.all && !a.nexus;
  const base = a => { const o = Object.assign({}, a); for (const k of NEW) delete o[k]; o.bpLe = 1e9; return o; };      // the old checks see an open bound
  D.chk = a => has(a) ? okNew(a) && dChk(base(a)) : dChk(a);
  const legacyCount = (c, fam) => (c.src && Array.isArray(c.src.legacyCards) ? c.src.legacyCards.filter(id => CARDS[id] && (CARDS[id].families || []).some(f => fam.includes(f))).length : 0);      // v193
  D.cands = (c, a) => {
    if (!has(a)) return dCands(c, a);
    const gone = c.src.lostLv >= 0 && !c.p.spirits.includes(c.src), me = gone ? CARDS[c.src.id].levels[c.src.lostLv].bp + (c.src.bpMod || 0) : ownerOf(c.src) ? bpOf(c.src) : null, lim = a.costLePer ? perCount(c.p, a.costLePer) : null;
    return dCands(c, base(a)).filter(t => !fxImmune(c.opp, t)
      && (!a.bpLeSelf || (me != null && bpOf(t) <= me)) && (!a.bpEqSelf || (me != null && bpOf(t) === me))
      && (a.symbolsGe == null || CARDS[t.id].symbols >= a.symbolsGe) && (lim == null || CARDS[t.id].cost <= lim) && (a.costIn == null || a.costIn.includes(CARDS[t.id].cost))
      && (a.bpPerLegacy == null || bpOf(t) <= (a.bpLe || 0) + a.bpPerLegacy.n * legacyCount(c, a.bpPerLegacy.family)));
  };
  D.txt = a => {
    if (!has(a)) return dTxt(a);
    const q = a.costLePer;
    if (a.costIn) return 'destroy 1 opposing ' + (a.exhaustedOnly ? 'exhausted ' : '') + 'Spirit/Ultimate with cost ' + a.costIn.join('/') + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed target can't activate" : '');
    const f = a.bpLeSelf ? "BP equal or inferior to this Spirit's" : a.bpEqSelf ? 'the same BP as this Spirit' : a.symbolsGe != null ? a.symbolsGe + ' or more symbols'
      : a.bpPerLegacy ? `BP equal or less than ${a.bpLe || 0} plus ${a.bpPerLegacy.n} per EX Symbol banished via Legacy`
      : `a cost equal or less than the number of matching ${q.type === 'Nexus' ? 'Nexuses' : 'Spirits'} you control`;
    return 'destroy 1 opposing Spirit/Ultimate with ' + f + (a.exhaustedOnly ? ' (exhausted only)' : '') + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed target can't activate" : '');
  };
})();
/* v0.168 target modifiers wrapped on top of the filters above:
   DESTROY blockingSelf  "an opposing Spirit that is blocking this Spirit" (only while this Spirit is the attacker and that Spirit is its blocker)
   BOUNCE_OPP notAttacking "an opposing non-attacking Spirit" (any opposing Spirit except the attacker) */
(() => {
  const D = FX_ACTIONS.DESTROY, dChk = D.chk, dCands = D.cands, dTxt = D.txt;
  const bare = a => { const o = Object.assign({}, a); delete o.blockingSelf; return o; };
  D.chk = a => (a.blockingSelf == null || a.blockingSelf === true) && dChk(bare(a));
  D.cands = (c, a) => { const L = dCands(c, bare(a)); return a.blockingSelf ? L.filter(t => G.attacker === c.src && G.blocker === t) : L; };
  D.txt = a => dTxt(bare(a)).replace(/^destroy 1 opposing /, `destroy 1 opposing ${a.blockingSelf ? 'blocking ' : ''}`);
  const B = FX_ACTIONS.BOUNCE_OPP, bChk = B.chk, bCands = B.cands, bTxt = B.txt;
  const nb = a => { const o = Object.assign({}, a); delete o.notAttacking; return o; };
  B.chk = a => (a.notAttacking == null || a.notAttacking === true) && !(a.notAttacking && a.attackingOnly) && bChk(nb(a));
  B.cands = (c, a) => bCands(c, nb(a)).filter(t => !a.notAttacking || t !== G.attacker);
  B.txt = a => bTxt(nb(a)).replace(/^return an opposing /, `return an opposing ${a.notAttacking ? 'non-attacking ' : ''}`);
  /* costTotalLe: "up to two opposing Spirits with a total cost of N or less" (upTo, n 2, Spirits only) */
  const tChk = B.chk, tCands = B.cands, tTxt = B.txt; const tRun = B.run;
  const tb = a => { const o = Object.assign({}, a); delete o.costTotalLe; return o; };
  B.chk = a => (a.costTotalLe == null || (Number.isInteger(a.costTotalLe) && a.costTotalLe >= 1 && a.costTotalLe <= 30 && a.upTo === true && a.n === 2 && a.kind === 'spirit' && a.costLe == null)) && tChk(tb(a));
  B.cands = (c, a) => tCands(c, tb(a)).filter(t => a.costTotalLe == null || CARDS[t.id].cost <= a.costTotalLe);
  B.txt = a => tTxt(tb(a)) + (a.costTotalLe != null ? ` (up to two, total cost ${a.costTotalLe} or less)` : '');
  /* bpOrGe (with bpLe): "5000 BP or less or 8000 BP or more" */
  const oChk = B.chk, oCands = B.cands, oTxt = B.txt;
  const ob = a => { const o = Object.assign({}, a); delete o.bpOrGe; if (a.bpOrGe != null) delete o.bpLe; return o; };
  B.chk = a => (a.bpOrGe == null || (Number.isInteger(a.bpOrGe) && a.bpOrGe > a.bpLe && a.bpLe != null && a.bpPer == null && a.kind === 'spirit')) && oChk(Object.assign({}, a, { bpOrGe: undefined }));
  B.cands = (c, a) => oCands(c, ob(a)).filter(t => a.bpOrGe == null || bpOf(t) <= a.bpLe || bpOf(t) >= a.bpOrGe);
  B.txt = a => oTxt(ob(a)) + (a.bpOrGe != null ? ` with ${a.bpLe} BP or less or ${a.bpOrGe} BP or more` : '');
  B.run = async (c, a) => {
    if (a.costTotalLe == null) return tRun(c, a);
    const got = []; let sum = 0;
    for (let j = 0; j < 2; j++) {
      const rest = B.cands(c, a).filter(x => !got.includes(x) && sum + CARDS[x.id].cost <= a.costTotalLe);
      if (!rest.length || (j > 0 && c.p.cpu === false && !await ask({ title: `✨ ${esc(CARDS[c.src.id].name)}`, html: 'Return another one?', buttons: [{ label: 'Yes', cls: 'primary', value: true }, { label: 'No', cls: 'blue', value: false }] }))) break;
      const t = await fxPickTarget(c, rest, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to return (${j + 1}/2, total cost ${a.costTotalLe} or less).`);
      if (!t) break;
      got.push(t); sum += CARDS[t.id].cost;
    }
    if (!got.length) { c.ctx.did = false; return; }
    for (const t of got) bounceCard(c.opp, t, a.to);
    checkDepletion(c.opp);
  };
})();
