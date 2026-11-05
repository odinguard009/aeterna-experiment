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
function costAltExhaustPick(p, a) { return p.nexus.find(n => isGW(n) && !n.exhausted && fxMatch(CARDS[n.id], a.exhaust.match)); }   // v547 costAlt.exhaust: "by exhausting one of your <match> Grandwalker Nexuses"
function costAltActive(p, card) {                 // e.g. Wurm Draw: "(Once per Turn: Same Name) when using this card, if you control any Wurm, this card can become Cost 3"
  const a = card.costAlt; if (!a || !G) return false;
  if (a.once && p.onceUsed && p.onceUsed['costalt:' + card.name] === G.turnNo) return false;
  if (a.bed && !fungalBeds(p).length) return false;
  if (a.exhaust && !costAltExhaustPick(p, a)) return false;
  return fxIf(p, G.p[other(p.key)], a.if);
}
/* v549 STATIC SIX_HEAVEN_COLOR (Grand Field): "fulfill one symbol color for the conditions of your Six Heaven Rush/Rebirth": +1 colour for every symColorsGe check unless the condition says symColorsPlain */
function grandFieldColors(p) { return p.nexus.filter(n => fxEntries(n).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'SIX_HEAVEN_COLOR' && (!e.lv || e.lv.includes(lvNo(n))))).length; }
/* v550: moved here from 02a (part size budget B08) */
const cardHasKeyword = (card, kw) => (card.keywords || []).some(k => String(k).toUpperCase() === String(kw).toUpperCase()) || (card.mechanics || []).some(k => String(k).toUpperCase() === String(kw).toUpperCase()) || new RegExp('(^|[\\]\\)\\s])' + String(kw).replace(/[^A-Za-z ]/g, '') + ' \\(').test(card.desc || card.text || '') || new RegExp('\\(' + String(kw).replace(/[^A-Za-z ]/g, '') + '\\)', 'i').test(card.desc || card.text || '')
  || (String(kw).toUpperCase() === 'LEGACY' && (card.legacy === true || /^\(Legacy\)/.test(card.desc || card.text || '')))      // v0.167 "Spirit with Legacy": the (Legacy) head line / legacy flag
  || (String(kw).toUpperCase() === 'CURRENT' && /\{\{Current\|/.test(card.desc || card.text || ''))
  || (String(kw).toUpperCase() === 'SIX HEAVEN RUSH' && /\{\{Six Heaven Rush\|/.test(card.desc || card.text || ''))      // v550 the head template also counts when the card lists another mechanic first (BS46-10THX02)
  || (String(kw).toUpperCase() === 'SHAMANISM' && /\{\{Shaman\|/.test(card.desc || card.text || ''));      // v0.167 "Spirit with Shamanism": the {{Shaman|...}} holder template
/* v550 MAGIC_SOUL_TAX_TURN {match}: "during this turn, while your <match> is attacking, unless the opponent sends their Soul Core to the Trash, they can't use Magic cards" (BSC48-CX02). p.magicTax = {turn, match}; noMagicHit locks Magic while it applies and the Soul Core cannot (or Magic cannot be afforded without it) be paid; otherwise castMagic pays it once (the lock is then lifted for the turn) */
const magicTaxOn = p => { const t = p.magicTax, a = G.attacker, o = a && ownerOf(a); return !!(t && t.turn === G.turnNo && !t.paid && o && o !== p && fxMatch(CARDS[a.id], t.match, a)); };
const magicTaxHit = (p, card) => flashCostLocked(card) || magicTaxOn(p) && (soulCoreHolder(p, null) === null || effCost(p, card) > coresAvailable(p));
const magicTaxPay = p => { if (magicTaxOn(p)) { p.magicTax.paid = true; soulToTrash(p, soulCoreHolder(p, null)); } };
FX_ACTIONS.MAGIC_SOUL_TAX_TURN = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: () => "during this turn, while your matching Spirit is attacking, the opponent can't use Magic cards unless they send their Soul Core to the Trash",
  run: async (c, a) => { c.opp.magicTax = { turn: G.turnNo, match: a.match }; c.ctx.did = true; log(`${_nm(c)}: ${poss(c.opp)} Magic is locked while the attack lasts, unless the Soul Core goes to the Trash.`); } };
