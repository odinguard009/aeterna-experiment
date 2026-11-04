/* Lane K, Grandwalker Yum-Kaax family, part 2 (02y is full). Each block names its version in docs/ai/effect-format.md. */
/* v522 DEPLOY_SELF_FROM {minOppHandRemoved, lockOppDraw}: "during either Main Step, if the opposing Hand + Removed Zone hold N or more cards, summon this card from the Hand/Trash without paying the cost; when you've done so, this turn the opponent can't draw via <colour> effects" (BS73-023). The lock is G.noDraw, read by removedDrawLocked (Spirit/Ultimate/Nexus sources only; a Magic draw is not blocked). */
FX_ACTIONS.DEPLOY_SELF_FROM = { chk: a => Number.isInteger(a.minOppHandRemoved) && a.minOppHandRemoved >= 1 && a.minOppHandRemoved <= 20 && (a.lockOppDraw == null || ['red', 'purple', 'green', 'white', 'yellow', 'blue'].includes(a.lockOppDraw)) && Object.keys(a).every(k => ['do', 'if', 'minOppHandRemoved', 'lockOppDraw'].includes(k)),
  txt: a => `during the Main Step, if the opposing Hand + Removed Zone hold ${a.minOppHandRemoved}+ cards, summon this card from the Hand/Trash without paying the cost` + (a.lockOppDraw ? `; this turn the opponent can't draw via ${a.lockOppDraw} effects` : ''),
  can: (c, a) => (c.p.hand.includes(c.src) || c.p.trash.includes(c.src)) && (G.step === 4 || (G.format === 'standard' && G.step === 6)) && c.opp.hand.length + c.opp.removed.length >= a.minOppHandRemoved && canPlaceFree(c.p, c.src),
  run: async (c, a) => {
    c.ctx.did = false; if (!FX_ACTIONS.DEPLOY_SELF_FROM.can(c, a)) return;
    await summonFree(c.p, c.src); c.ctx.did = fieldList(c.p).includes(c.src);
    if (c.ctx.did && a.lockOppDraw) { G.noDraw = { key: c.opp.key, turn: G.turnNo, color: a.lockOppDraw }; log(`${CARDS[c.src.id].name}: the opponent can't draw via ${a.lockOppDraw} effects this turn.`); } } };
/* v522 VOID_TO_FAMILY_OTHERS {n, family}: "put a core from the Void each to up to n other <family> family Spirits/Nexuses you control" (BS73-023) */
FX_ACTIONS.VOID_TO_FAMILY_OTHERS = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && typeof a.family === 'string' && a.family.length > 0 && Object.keys(a).every(k => ['do', 'if', 'n', 'family'].includes(k)),
  txt: a => `put one core from the Void each to up to ${a.n} other "${a.family}" family Spirits/Nexuses you control`,
  cands: (c, a) => c.p.spirits.concat(c.p.nexus).filter(x => x !== c.src && (CARDS[x.id].families || []).includes(a.family)),
  can: (c, a) => FX_ACTIONS.VOID_TO_FAMILY_OTHERS.cands(c, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; let L = FX_ACTIONS.VOID_TO_FAMILY_OTHERS.cands(c, a);
    for (let j = 0; j < a.n && L.length; j++) {
      const t = c.p.cpu ? L.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap a "${esc(a.family)}" Spirit/Nexus that receives a core from the Void (${j + 1}/${a.n}).`); if (!t) break;
      takeFromVoid(c.p, 1); t.cores++; L = L.filter(x => x !== t); c.ctx.did = true; log(`${CARDS[c.src.id].name}: a core moves from the Void to ${CARDS[t.id].name}.`);
    }
    io.view({ type: 'board' }); } };
/* v523 floor mark: a Spirit with floorT === the current turn can't have its cores brought below three by opposing effects (read by coreSafeMode, 02a). Set by FLOOR_EXH_TARGETS. */
const coreFloorMark = (owner, target) => !!G && !!target && target.floorT === G.turnNo && !!G.fxBy && G.fxBy !== owner.key;
/* v523 FLOOR_EXH_TARGETS {}: "during this turn the target exhausted by this effect can't have its core brought to less than three by the opponent" (after EXHAUST_OPP, which keeps ctx.exhT; BS73-029) */
FX_ACTIONS.FLOOR_EXH_TARGETS = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => "during this turn the exhausted target can't have its cores brought to less than three by the opponent", can: () => true,
  run: async c => { const T = (c.ctx.exhT || []).filter(t => c.opp.spirits.includes(t)); c.ctx.did = T.length > 0; for (const t of T) t.floorT = G.turnNo; } };
/* v523 NO_REFRESH_PER_BED {}: "(Opposing Refresh Step) by destroying any number of your Fungal Bed, for each target destroyed an opposing exhausted Spirit can't refresh" (OPP_START_STEP, BS73-029). Marks noRefreshT = this turn (07-turn.js skips the refresh). The CPU uses at most two beds. */
FX_ACTIONS.NO_REFRESH_PER_BED = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => "by destroying any number of your Fungal Bed, an opposing exhausted Spirit can't refresh for each", can: c => fungalBeds(c.p).length > 0 && c.opp.spirits.some(t => t.exhausted),
  run: async c => {
    c.ctx.did = false;
    for (let j = 0; j < (c.p.cpu ? 2 : 5); j++) {
      const L = c.opp.spirits.filter(t => t.exhausted && t.noRefreshT !== G.turnNo && !fxImmune(c.opp, t)), B = fungalBeds(c.p); if (!L.length || !B.length) break;
      const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Destroy a "Fungal Bed" so this exhausted Spirit can't refresh (${j + 1}); cancel to stop.`); if (!t) break;
      removeNexus(c.p, B[0], 'destroyed'); t.noRefreshT = G.turnNo; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} can't refresh this Refresh Step.`);
    } } };
/* v523 REMOVE_TRASH_BOTH {n}: "banish up to N cards in total from your Trash and the opposing Trash" (BS73-AX01); keeps ctx.removedN / ctx.removedCards like REMOVE_OPP_TRASH so HEAVY_EXHAUST_OPP perRemoved follows. The human picks card by card (cancel stops); the CPU banishes only opposing cards. "Their effects can't activate" is not modelled. */
FX_ACTIONS.REMOVE_TRASH_BOTH = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)), txt: a => `banish up to ${a.n} cards in total from your Trash and the opposing Trash`,
  can: c => c.p.trash.length + c.opp.trash.length > 0,
  run: async (c, a) => {
    c.ctx.did = false; c.ctx.removedCards = []; c.ctx.removedN = 0;
    const own = () => c.p.trash.filter(t => t !== c.src), opp = () => c.opp.trash.filter(t => !trashSafe(t, c));
    for (let j = 0; j < a.n; j++) {
      const L = c.p.cpu ? opp() : own().concat(opp()); if (!L.length) break;
      const t = c.p.cpu ? L[0] : await chooseCard(c, L, `✨ ${esc(CARDS[c.src.id].name)}`, `Choose a card from either Trash to banish (${j + 1}/${a.n}).`, j > 0); if (!t) break;
      const side = c.p.trash.includes(t) ? c.p : c.opp; if (removeFrom(side.trash, t)) { toRemoved(side, t); c.ctx.removedCards.push(t); c.ctx.removedN++; }
    }
    c.ctx.did = c.ctx.removedN > 0; if (c.ctx.did) log(`${CARDS[c.src.id].name}: ${c.ctx.removedN} card${c.ctx.removedN === 1 ? '' : 's'} are banished from the Trashes.`); } };
