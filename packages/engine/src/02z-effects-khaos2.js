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
