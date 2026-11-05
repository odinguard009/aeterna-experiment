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
FX_ACTIONS.FLOOR_EXH_TARGETS = { chk: a => Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)) && (a.n === undefined || a.n === 3), txt: () => "during this turn the exhausted target can't have its cores brought to less than three by the opponent", can: () => true,
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

/* v525 STATIC LIFE_BED_SAVE {lv} (BS74-037): "once per turn, when your Life would be reduced by the opponent's attack, by destroying one of your Fungal Bed, your Life won't be reduced". The CPU always pays; a human is asked. */
async function lifeBedSave(D, A, att) {
  for (const f of fieldList(D)) {
    const L = lvNo(f);
    for (const { e } of fxEntries(f)) {
      if (e.trigger !== 'STATIC' || e.flag !== 'LIFE_BED_SAVE' || (e.lv && !e.lv.includes(L)) || f.bedSaveTurn === G.turnNo) continue;
      const beds = fungalBeds(D); if (!beds.length) continue;
      if (!D.cpu && !await ask({ title: `✨ ${CARDS[f.id].name}`, html: `Destroy one of your "Fungal Bed" so your Life isn't reduced by ${esc(CARDS[att.id].name)}?`, buttons: [{ label: 'Destroy a Bed', cls: 'primary', value: true }, { label: 'Skip', cls: 'cancel', value: false }] })) continue;
      const bed = D.cpu ? beds.sort((x, y) => x.cores - y.cores)[0] : (await fxPickTarget({ p: D, opp: A, src: f, ctx: {} }, beds, `✨ <b>${esc(CARDS[f.id].name)}</b><br>Tap the "Fungal Bed" to destroy.`)) || beds[0];
      f.bedSaveTurn = G.turnNo; removeNexus(D, bed, 'destroyed'); log(`${CARDS[f.id].name}: ${poss(D)} ${CARDS[bed.id].name} is destroyed, ${poss(D)} Life isn't reduced.`); return true;
    }
  }
  return false;
}

/* v526 STATIC OPP_CORE_MOVE_LOCK {lv, match}: "while your <match> Spirit is attacking, besides Soul Core the opponent can't move cores from their Field/Grandwalker Nexuses" (BS74-X05). Read by moveCore (06-rules): covers the player's own core moves only, effect-driven core moves are not blocked. */
function coreMoveLocked(p) {
  if (!G || !G.attacker) return false;
  const A = G.p[other(p.key)]; if (!A.spirits.includes(G.attacker)) return false;
  return fieldList(A).some(f => fxEntries(f).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'OPP_CORE_MOVE_LOCK' && (!e.lv || e.lv.includes(lvNo(f))) && fxMatch(CARDS[G.attacker.id], e.match, G.attacker)));
}
/* v526 SYMBOL_ATTACKER_PLUS {color}: "that Spirit gains an extra <colour> symbol" (ALLY_ATTACKS with `if`; the attacker is ctx.attacker/subject). */
FX_ACTIONS.SYMBOL_ATTACKER_PLUS = { chk: a => COLORS.includes(a.color) && Object.keys(a).every(k => ['do', 'if', 'color'].includes(k)), txt: a => `that Spirit gains an extra ${cap(a.color)} symbol this turn`, can: () => true,
  run: async (c, a) => {
    const s = c.ctx.attacker || c.ctx.subject; c.ctx.did = !!s && c.p.spirits.includes(s); if (!c.ctx.did) return;
    if (!s.symTurn || s.symTurn.turn !== G.turnNo) s.symTurn = { turn: G.turnNo, cols: [] }; s.symTurn.cols.push(a.color); log(`${_nm(c)}: ${CARDS[s.id].name} gains an extra ${cap(a.color)} symbol this turn.`); } };
/* v526 BED_REMOVED_REDRAW {n} (BS74-X05, zone hand): "by destroying one of your Fungal Bed, put this card from the Hand onto the Removed Zone; when you've done so, discard all your Hand and draw n cards; then return this card from the Removed Zone to your decktop". Main Step only; offered at the start of the Main Step (START_MAIN, zone hand), the CPU only with a Hand of two or fewer. */
FX_ACTIONS.BED_REMOVED_REDRAW = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)), txt: a => `by destroying one of your "Fungal Bed", put this card from the Hand onto the Removed Zone; discard your entire Hand, draw ${a.n} cards, then return this card to your decktop`,
  can: c => c.p.hand.includes(c.src) && (!c.p.cpu || c.p.hand.length <= 2) && (G.step === 4 || (G.format === 'standard' && G.step === 6)) && fungalBeds(c.p).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; if (!FX_ACTIONS.BED_REMOVED_REDRAW.can(c, a)) return;
    const beds = fungalBeds(c.p), bed = c.p.cpu ? beds.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, beds, `✨ <b>${esc(_nm(c))}</b><br>Tap the "Fungal Bed" to destroy.`); if (!bed) return;
    removeNexus(c.p, bed, 'destroyed'); c.p.hand = c.p.hand.filter(h => h !== c.src); c.p.removed.push(c.src); c.ctx.did = true; log(`${_nm(c)}: ${poss(c.p)} ${CARDS[bed.id].name} is destroyed; this card goes to the Removed Zone.`);
    await FX_ACTIONS.DISCARD_ALL_HAND.run(c, { do: 'DISCARD_ALL_HAND' });
    const k = draw(c.p, a.n); log(`${_nm(c)}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k);
    c.p.removed = c.p.removed.filter(x => x !== c.src); c.p.deck.unshift(c.src); log(`${_nm(c)}: this card returns to the top of ${poss(c.p)} deck.`); io.view({ type: 'board' }); } };
/* v527 STATIC LIFE_CAP_SYM2 (BS73-070 LV2): "your Life can only be reduced by one per opposing Spirit/Ultimate with two or more symbols per turn". Read by 08-battle; approximated as a cap of one per such attack. */
STATIC_FLAGS.push('LIFE_CAP_SYM2');
const lifeSym2Cap = (D, att) => !!att && attackSymbols(att) >= 2 && fieldList(D).some(f => fxEntries(f).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'LIFE_CAP_SYM2' && (!e.lv || e.lv.includes(lvNo(f)))));
/* v528 STATIC NEXUS_SAFE_OPP {match}: "your <match> Nexuses can't be destroyed by opposing effects" (read by nexusShielded, 02w). */
STATIC_FLAGS.push('NEXUS_SAFE_OPP');
const nexusGuarded = (p, n) => !!G && !!G.fxBy && G.fxBy !== p.key && p.nexus.includes(n) && fieldList(p).some(f => fxEntries(f).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'NEXUS_SAFE_OPP' && (!e.lv || e.lv.includes(lvNo(f))) && fxMatch(CARDS[n.id], e.match)));
/* v528 STATIC MAGIC_COST_EXHAUST {n, match}: "(Your Turn) when you would use a <match> Magic card, by exhausting this Nexus, treat as up to n costs being paid" (BS74-074 LV2). House reading: while the Nexus is refreshed on your turn the matching Magic costs n less (read by summonDiscountOf, 06); MAGIC_RELIEF_EXHAUST on MAGIC_USED then exhausts it. */
STATIC_FLAGS.push('MAGIC_COST_EXHAUST');
function magicDiscount(p, card) {
  if (card.type !== 'Magic' || !G || G.active !== p.key) return 0; let n = 0;
  for (const f of p.nexus) if (!f.exhausted) for (const { e } of fxEntries(f)) if (e.trigger === 'STATIC' && e.flag === 'MAGIC_COST_EXHAUST' && (!e.lv || e.lv.includes(lvNo(f))) && fxMatch(card, e.match)) n += e.n;
  return n;
}
FX_ACTIONS.MAGIC_RELIEF_EXHAUST = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'exhaust this Nexus (its cost relief for the Magic card was used)',
  can: () => true,
  run: async c => { const s = c.ctx.subject; c.ctx.did = false; if (!s || !c.src || c.src.exhausted || G.active !== c.p.key || !c.p.nexus.includes(c.src) || CARDS[s.id].cost < 1) return;
    c.src.exhausted = true; c.ctx.did = true; log(`${CARDS[c.src.id].name} is exhausted: up to two costs of ${CARDS[s.id].name} are treated as paid.`); io.view({ type: 'board' }); } };
/* v529 STATIC COST_PLUS {n, match}: "(Either Attack Step) the cost of every <match> Spirit in refreshed state you control gets +n" (BS73-070). ccost(card, inst) is the printed cost plus this bonus; fxMatch costGe/costLe read it (a direct CARDS[].cost check elsewhere does not). */
STATIC_FLAGS.push('COST_PLUS');
function ccost(card, inst) {
  if (!inst || !G || G.step !== 5 || inst.exhausted || card.type !== 'Spirit') return card.cost;
  const p = G.p.player.spirits.includes(inst) ? G.p.player : G.p.opponent.spirits.includes(inst) ? G.p.opponent : null; if (!p) return card.cost;
  let n = 0; for (const f of fieldList(p)) for (const { e } of fxEntries(f)) if (e.trigger === 'STATIC' && e.flag === 'COST_PLUS' && (!e.lv || e.lv.includes(lvNo(f))) && (card.families || []).some(x => (e.match.family || []).includes(x))) n += e.n;
  return card.cost + n;
}

/* v530 Field Flash: a resolved Magic marked inst.toBottom goes to the deckbottom, inst.toField onto the Field (p.fieldMag, activatable via zone:'field' ACTIVATE; cost {discardSelf:true} moves it to the Trash). */
function magicRest(p, inst) {
  if (inst.chg) return changeRep(p, inst);
  if (inst.toField) { inst.toField = false; p.fieldMag = p.fieldMag || []; p.fieldMag.push(inst); log(`${CARDS[inst.id].name} is put onto ${poss(p)} Field.`); }
  else { inst.toBottom = false; p.deck.push(inst); }
}
FX_ACTIONS.PUT_SELF_ONTO_FIELD = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'put this card onto your Field', can: () => true,
  run: async c => { c.ctx.did = CARDS[c.src.id].type === 'Magic' && c.p.limbo === c.src && !c.src.fromTrash; if (c.ctx.did) c.src.toField = true; } };
/* v530 CONTRACT_SKILL_RUN {name}: "immediately activate a Contract Skill written on a <name> Grandwalker Nexus you control, ignoring once per turn, treating the cores as sent to the Void":
   runs the actions of that Nexus's cost-bearing ACTIVATE effect (its Contract Skill) with no cost paid and no once-per-turn mark. */
const _csEff = (c, a) => { for (const n of c.p.nexus) if (CARDS[n.id].name.toLowerCase().includes(a.name.toLowerCase())) for (const x of actList(n)) if (x.e.trigger === 'ACTIVATE' && x.e.cost && x.e.cost.nexusToVoid) return { n, e: x.e }; return null; };
FX_ACTIONS.CONTRACT_SKILL_RUN = { chk: a => typeof a.name === 'string' && a.name.length > 0 && Object.keys(a).every(k => ['do', 'if', 'name'].includes(k)),
  txt: a => `immediately activate a Contract Skill of your "${a.name}" Nexus, ignoring once per turn, treating the cores as sent to the Void`, can: (c, a) => !!_csEff(c, a),
  run: async (c, a) => { const x = _csEff(c, a); c.ctx.did = !!x; if (!x) return; log(`${CARDS[c.src.id].name}: activates the Contract Skill of ${CARDS[x.n.id].name}.`); await runActions({ p: c.p, opp: c.opp, src: x.n, ctx: {} }, x.e, 'ACTIVATE'); } };

/* v566 BOUNCE_ALL_OTHERS (BS74-AX03): "You can return all other Spirits/Ultimates to the deckbottom": every Spirit/Ultimate on both Fields except the source goes to its owner's deckbottom;
   an opposing one that is unaffected by this effect (or has NO_RETURN) stays. The own side is hit as well, as printed. */
FX_ACTIONS.BOUNCE_ALL_OTHERS = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'return all other Spirits/Ultimates on both Fields to the deckbottom', can: c => c.p.spirits.concat(c.opp.spirits).some(s => s !== c.src),
  run: async (c, a) => {
    c.ctx.did = false;
    const hit = [];
    for (const side of [c.p, c.opp]) for (const t of side.spirits.slice()) {
      if (t === c.src || flagActive(side, 'NO_RETURN', t) || (side === c.opp && fxImmune(side, t, { p: c.p, src: c.src }))) continue;
      bounceCard(side, t, 'deckBottom'); hit.push(t);
    }
    if (!hit.length) return;
    checkDepletion(c.p); checkDepletion(c.opp); c.ctx.did = true; log(`${_nm(c)}: ${hit.length} other Spirit${hit.length === 1 ? '' : 's'} return${hit.length === 1 ? 's' : ''} to the deckbottom.`); io.view({ type: 'board' }); } };

/* v567 Change (183 cards; BSC48-X09, BSC48-052): a Spirit with magic.change {cost, reduction} is used from the Hand in Flash like a Magic card (alsoMagic) at the Change's own cost/reduction (changeView + effCostM stand in for effCost on every Magic-side cost check).
   CHANGE_SELF {pay}: "pay N cost to use this card's Change from the Hand/Trash" (castMagic with the cost already paid). CHANGE_REPLACE {family, costLe}: "after this effect resolves, either discard this card, or replace one of your <family> Spirits (cost N or less) with this card in refreshed state":
   chooses the Spirit now (inst.chg), changeRep swaps it in when castMagic puts the card to rest (the replaced Spirit goes to the Trash with its Brave/under cards, its cores stay). A Change Spirit entering this way is not summoned. */
const _chgView = new WeakMap();
function changeView(card) {
  const ch = card.magic && card.magic.change; if (!ch) return card;
  let v = _chgView.get(card); if (!v) { v = Object.assign({}, card, { cost: ch.cost, reduction: ch.reduction || {}, costAlt: null, costPer: null }); _chgView.set(card, v); }
  return v;
}
const effCostM = (p, card) => effCost(p, changeView(card));
const _chgCands = (p, a) => p.spirits.filter(s => !isUlt(s) && (CARDS[s.id].families || []).includes(a.family) && CARDS[s.id].cost <= a.costLe);
function changeRep(p, inst) {
  const t = inst.chg; inst.chg = null;
  if (!t || !p.spirits.includes(t)) return magicToTrash(p, inst);
  const i = p.spirits.indexOf(t);
  inst.cores = t.cores; inst.soul = t.soul; inst.exhausted = false; inst.heavy = false; inst.noAB = false; inst.bpMod = 0; inst.fxUsed = {}; inst.viaFx = true; inst.summonedTurn = t.summonedTurn; inst.under = []; inst.brave = t.brave; t.brave = null;
  for (const u of t.under) { u.under = []; p.trash.push(u); }
  t.under = []; t.cores = 0; t.soul = false; t.exhausted = false; t.heavy = false; t.noAB = false; t.bpMod = 0; t.symBattle = 0;
  p.spirits[i] = inst; p.trash.push(t);
  if (G.attacker === t) G.attacker = inst; if (G.blocker === t) G.blocker = inst;
  if (inst.brave) braveRecheck(p, inst);
  log(`${CARDS[inst.id].name} replaces ${CARDS[t.id].name} (Change; the cores stay, refreshed).`); checkDepletion(p); io.view({ type: 'board' });
}
FX_ACTIONS.CHANGE_SELF = { chk: a => Number.isInteger(a.pay) && a.pay >= 0 && a.pay <= 5 && Object.keys(a).every(k => ['do', 'if', 'pay'].includes(k)),
  txt: a => `pay ${a.pay} cost to use the Change of this card from the Hand/Trash`,
  can: (c, a) => (c.p.hand.includes(c.src) || c.p.trash.includes(c.src)) && !!(CARDS[c.src.id].magic && CARDS[c.src.id].magic.change) && coresAvailable(c.p) >= a.pay,
  run: async (c, a) => {
    c.ctx.did = false; if (!FX_ACTIONS.CHANGE_SELF.can(c, a)) return;
    if (a.pay && !(await payInvokeCost(c.p, c.src, { pay: a.pay }))) return;
    log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'uses' : 'use'} its Change.`);
    c.ctx.did = true; await castMagic(c.p, { inst: c.src, target: null, plan: null, ctx: 'flash', free: true }); io.view({ type: 'board' }); } };
FX_ACTIONS.CHANGE_REPLACE = { chk: a => typeof a.family === 'string' && Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'family', 'costLe'].includes(k)),
  txt: a => `after this effect resolves, either discard this card, or replace one of your Cost ${a.costLe} or less "${a.family}" Spirits with this card in refreshed state`,
  can: (c, a) => CARDS[c.src.id].type !== 'Magic' && c.p.limbo === c.src && _chgCands(c.p, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; if (!FX_ACTIONS.CHANGE_REPLACE.can(c, a)) return;
    const L = _chgCands(c.p, a); let t;
    if (c.p.cpu) t = L.slice().sort((x, y) => bpOf(x) - bpOf(y))[0];
    else { const uid = await pickFromField({ text: `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Replace one of your Spirits with this card (Change), or discard it.`, uids: L.map(x => x.uid), buttons: [{ label: 'Discard this card', cls: 'cancel', value: 'none' }] }); t = L.find(x => x.uid === uid); }
    if (t) { c.src.chg = t; c.ctx.did = true; } } };
FX_ACTIONS.CHANGE_BOUNCE_OPP = { chk: a => a.to === 'deckBottom' && (a.noNexus == null || a.noNexus === true) && Object.keys(a).every(k => ['do', 'if', 'to', 'noNexus'].includes(k)),
  txt: () => 'return an opposing Spirit/Nexus/Burst to the deckbottom',
  cands: (c, a) => c.opp.spirits.concat(a && a.noNexus ? [] : c.opp.nexus).filter(t => !flagActive(c.opp, 'NO_RETURN', t) && !fxImmune(c.opp, t, { p: c.p, src: c.src })),
  can: (c, a) => FX_ACTIONS.CHANGE_BOUNCE_OPP.cands(c, a).length > 0 || (!!c.opp.burst && !burstSetSafe(c.opp)),
  run: async (c, a) => {
    c.ctx.did = false; const L = FX_ACTIONS.CHANGE_BOUNCE_OPP.cands(c, a), b = c.opp.burst && !burstSetSafe(c.opp) ? c.opp.burst : null;
    if (!L.length && !b) return;
    let t = null;
    if (L.length) {
      if (b && !c.p.cpu) { const uid = await pickFromField({ text: `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an opposing card to return, or the Burst.`, uids: L.map(x => x.uid), buttons: [{ label: 'Return the Burst', cls: 'primary', value: 'burst' }] }); t = uid === 'burst' ? null : L.find(x => x.uid === uid) || L[0]; }
      else t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing card to return (glowing).`);
    }
    if (t) { bounceCard(c.opp, t, 'deckBottom'); checkDepletion(c.opp); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns to the deckbottom.`); }
    else if (b) { c.opp.burst = null; b.mirage = false; c.opp.deck.push(b); log(`${CARDS[c.src.id].name}: the opposing Burst returns to the deckbottom.`); }
    else return;
    c.ctx.did = true; io.view({ type: 'board' }); } };
/* v569 RETURN_OPP_SUN (BSC48-XX01): "return an opposing Spirit, Ultimate and Nexus, one of each, to the deckbottom" (each class optional; the human taps a target per class or skips). */
FX_ACTIONS.RETURN_OPP_SUN = { chk: a => a.to === 'deckBottom' && Object.keys(a).every(k => ['do', 'if', 'to'].includes(k)),
  txt: () => 'return an opposing Spirit, Ultimate and Nexus, one of each, to the deckbottom',
  cls: c => [['Spirit', c.opp.spirits.filter(t => CARDS[t.id].type !== 'Ultimate')], ['Ultimate', c.opp.spirits.filter(t => CARDS[t.id].type === 'Ultimate')], ['Nexus', c.opp.nexus]].map(([n, L]) => [n, L.filter(t => !flagActive(c.opp, 'NO_RETURN', t) && !fxImmune(c.opp, t, { p: c.p, src: c.src }))]),
  can: c => FX_ACTIONS.RETURN_OPP_SUN.cls(c).some(([, L]) => L.length > 0),
  run: async (c, a) => {
    c.ctx.did = false;
    for (const n of ['Spirit', 'Ultimate', 'Nexus']) {
      const L = FX_ACTIONS.RETURN_OPP_SUN.cls(c).find(x => x[0] === n)[1]; if (!L.length) continue;
      let t;
      if (c.p.cpu) t = L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0];
      else { const uid = await pickFromField({ text: `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an opposing ${n} to return to the deckbottom, or skip.`, uids: L.map(x => x.uid), buttons: [{ label: 'Skip', cls: 'cancel', value: 'none' }] }); t = L.find(x => x.uid === uid); }
      if (!t) continue;
      bounceCard(c.opp, t, 'deckBottom'); checkDepletion(c.opp); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns to the deckbottom.`); c.ctx.did = true;
    }
    if (c.ctx.did) io.view({ type: 'board' }); } };
/* v570 DISCARD_OPP_HAND_REMOVED {geTotal, leaveTotal} (BS72-X07): "If the opposing Hand + Removed Zone has a total of five or more cards, the opponent must discard cards from their Hand + Removed Zone until three or less remain in total."
   The opponent chooses which cards go to the Trash (the CPU gives up its cheapest); cards unaffected in the Hand stay. */
FX_ACTIONS.DISCARD_OPP_HAND_REMOVED = {
  chk: a => Number.isInteger(a.geTotal) && a.geTotal >= 1 && a.geTotal <= 10 && Number.isInteger(a.leaveTotal) && a.leaveTotal >= 0 && a.leaveTotal < a.geTotal && Object.keys(a).every(k => ['do', 'if', 'geTotal', 'leaveTotal'].includes(k)),
  txt: a => `if the opposing Hand + Removed Zone has ${a.geTotal} or more cards in total, the opponent discards from them until ${a.leaveTotal} or less remain`,
  can: (c, a) => c.opp.hand.length + c.opp.removed.length >= a.geTotal,
  run: async (c, a) => {
    const nm = CARDS[c.src.id].name, o = c.opp; let k = 0;
    if (o.hand.length + o.removed.length < a.geTotal) { c.ctx.did = false; return; }
    while (o.hand.length + o.removed.length > a.leaveTotal) {
      const L = o.hand.filter(x => !handSafe(x, o, c)).map(x => ({ x, z: 'hand' })).concat(o.removed.map(x => ({ x, z: 'removed' })));
      if (!L.length) break;
      let d;
      if (o.cpu) d = L.slice().sort((u, v) => CARDS[u.x.id].cost - CARDS[v.x.id].cost)[0];
      else { const v = await ask({ title: `✨ ${nm}`, peek: true, html: `Choose a card from your Hand or Removed Zone to discard (${o.hand.length + o.removed.length - a.leaveTotal} more).`, buttons: L.slice(0, 14).map(u => ({ label: `${CARDS[u.x.id].name} (${u.z === 'hand' ? 'Hand' : 'Removed'})`, cls: 'primary', value: u.x.uid })) }, o.key || 'player'); d = L.find(u => u.x.uid === v) || L[0]; }
      removeFrom(d.z === 'hand' ? o.hand : o.removed, d.x); o.trash.push(d.x); k++;
      log(`${nm}: ${who(o)} ${o.cpu ? 'discards' : 'discard'} ${CARDS[d.x.id].name} from ${d.z === 'hand' ? 'the Hand' : 'the Removed Zone'}.`);
      if (d.z === 'hand') await handDiscardedFx(o, d.x);
    }
    c.ctx.did = k > 0; io.view({ type: 'board' });
  } };
/* v571 EXHAUST_NEXUS_BRAVE_TRASH {nexusName, match} (BS72-051): "You can exhaust one of your <nexusName> Grandwalker Nexuses. When you've done so, you can summon from your Trash a <match> Brave card with a cost equal or inferior to your number of counters without paying the cost, directly braving it to your Spirit/Grandwalker Nexus."
   The exhaust is the price (only offered when a Brave can be combined); the Brave goes from the Trash straight onto the chosen target, then the Brave-summoned triggers fire. */
FX_ACTIONS.EXHAUST_NEXUS_BRAVE_TRASH = {
  chk: a => typeof a.nexusName === 'string' && a.nexusName.length > 0 && hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'nexusName', 'match'].includes(k)),
  txt: a => `exhaust one of your "${a.nexusName}" Nexuses, then summon a matching Brave from your Trash (cost at most your counters) directly combined`,
  nx: (c, a) => c.p.nexus.filter(n => !n.exhausted && fxMatch(CARDS[n.id], { name: a.nexusName })),
  bv: (c, a) => c.p.trash.filter(b => CARDS[b.id].type === 'Brave' && fxMatch(CARDS[b.id], a.match) && CARDS[b.id].cost <= c.p.count && braveTargets(c.p, b).length > 0),
  can: (c, a) => FX_ACTIONS.EXHAUST_NEXUS_BRAVE_TRASH.nx(c, a).length > 0 && FX_ACTIONS.EXHAUST_NEXUS_BRAVE_TRASH.bv(c, a).length > 0,
  run: async (c, a) => {
    const F = FX_ACTIONS.EXHAUST_NEXUS_BRAVE_TRASH, N = F.nx(c, a), B = F.bv(c, a);
    if (!N.length || !B.length) { c.ctx.did = false; return; }
    const n = await fxPickTarget(c, N, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap a Nexus to exhaust.`); if (!n) { c.ctx.did = false; return; }
    const b = c.p.cpu ? B.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0] : await chooseCard(c, B, `✨ ${CARDS[c.src.id].name}`, 'Choose a Brave card from your Trash to summon.', false); if (!b) { c.ctx.did = false; return; }
    const T = braveTargets(c.p, b), t = await fxPickTarget(c, T, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the Spirit/Nexus to combine ${esc(CARDS[b.id].name)} with.`); if (!t) { c.ctx.did = false; return; }
    n.exhausted = true; log(`${CARDS[n.id].name} is exhausted.`);
    removeFrom(c.p.trash, b); b.viaFx = true; b.summonedTurn = G.turnNo; combineBrave(c.p, b, t); c.ctx.did = true;
    io.view({ type: 'board' }); await braveSummonedFx(c.p, b);
  } };
/* v567 TRASH_PICK_THREE {nameHas, costLe} (BSC48-052): "from your Trash, either return a Cost N or less <name> to the Hand, or summon it without paying the cost, or immediately use its Change without paying the cost":
   picks a matching Spirit in the Trash, then one of the three modes (the CPU summons it when it can, else returns it). */
FX_ACTIONS.TRASH_PICK_THREE = { chk: a => typeof a.nameHas === 'string' && Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'nameHas', 'costLe'].includes(k)),
  txt: a => `from the Trash, either return a Cost ${a.costLe} or less "${a.nameHas}" to the Hand, or summon it without paying the cost, or use its Change without paying the cost`,
  cands: (c, a) => c.p.trash.filter(t => { const k = CARDS[t.id]; return k.type === 'Spirit' && !k.token && k.name.includes(a.nameHas) && k.cost <= a.costLe; }),
  can: (c, a) => FX_ACTIONS.TRASH_PICK_THREE.cands(c, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; const L = FX_ACTIONS.TRASH_PICK_THREE.cands(c, a); if (!L.length) return;
    const t = await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose a Cost ${a.costLe} or less "${a.nameHas}" from your Trash.`, false); if (!t) return;
    const k = CARDS[t.id], canS = canPlaceFree(c.p, t), canC = !!(k.magic && k.magic.change) && FX_ACTIONS.CHANGE_BOUNCE_OPP.can(c);
    let m = 'hand';
    if (c.p.cpu) m = canS ? 'summon' : 'hand';
    else { const v = await ask({ title: `✨ ${esc(k.name)}`, html: 'Return it to the Hand, summon it free, or use its Change free?', buttons: [{ label: 'Return to the Hand', cls: 'blue', value: 'hand' }].concat(canS ? [{ label: 'Summon free', cls: 'primary', value: 'summon' }] : [], canC ? [{ label: 'Use its Change', cls: 'primary', value: 'change' }] : []) }); m = v || 'hand'; }
    c.ctx.did = true;
    if (m === 'summon' && canS) { await summonFree(c.p, t); return; }
    if (m === 'change' && canC) { await castMagic(c.p, { inst: t, target: null, plan: null, ctx: 'flash', free: true }); io.view({ type: 'board' }); return; }
    removeFrom(c.p.trash, t); c.p.hand.push(t); handUp(c.p, 1); log(`${CARDS[c.src.id].name}: ${k.name} returns from the Trash to the Hand.`); io.view({ type: 'board' }); } };
/* v567 DESTROY_OPP_SPIRIT_AND_GW (BSC48-X09): "destroy opposing Spirits/Grandwalker Nexuses, one of each": one opposing Spirit and one opposing Grandwalker Nexus (each only when a non-immune one exists). */
FX_ACTIONS.DESTROY_OPP_SPIRIT_AND_GW = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'destroy one opposing Spirit and one opposing Grandwalker Nexus',
  cands: c => [c.opp.spirits.filter(s => !fxImmune(c.opp, s, { p: c.p, src: c.src })), c.opp.nexus.filter(n => (CARDS[n.id].families || []).includes('Grandwalker') && !fxImmune(c.opp, n, { p: c.p, src: c.src }))],
  can: c => FX_ACTIONS.DESTROY_OPP_SPIRIT_AND_GW.cands(c).some(L => L.length),
  run: async c => {
    c.ctx.did = false; const [S, N] = FX_ACTIONS.DESTROY_OPP_SPIRIT_AND_GW.cands(c);
    const s = await fxPickTarget(c, S, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to destroy (glowing).`);
    if (s) { removeSpirit(c.opp, s, 'destroyed', true); checkDepletion(c.opp); c.ctx.did = true; }
    const n = await fxPickTarget(c, N.filter(x => c.opp.nexus.includes(x)), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Grandwalker Nexus to destroy (glowing).`);
    if (n) { removeNexus(c.opp, n, 'destroyed'); c.ctx.did = true; }
    io.view({ type: 'board' }); } };

/* v567 trigger ALLY_LEAVES (BSC48-P25-05): "when your <family> Spirits would leave the Field due to an opposing effect" (match on the leaving Spirit). Fires after the leave like LEAVES (the effect is a reaction here, not a replacement). */
FX_TRIGGER_TEXT.ALLY_LEAVES = 'When your X Spirits would leave the Field due to an opposing effect';
function allyLeaves(p, s, byOppFx) {
  if (byOppFx && G && G.evQ && fieldList(p).some(f => fxEntries(f).some(({ e }) => e.trigger === 'ALLY_LEAVES'))) G.evQ.push({ type: 'ALLY_LEAVES', key: p.key, inst: s });
}
/* v579 condition bedsGe N: "if you control N or more Fungal Bed" */
function bedsGeOk(p, n) { return p.nexus.filter(x => !x.noFx && isFungalBed(x)).length >= n; }
/* v580 BED_SENT: "when your Fungal Bed Token is sent out" - SEND_TOKEN is wrapped; a rise in the Bed Token count queues the event (BS73-TX02) */
const _sendTokenBed = FX_ACTIONS.SEND_TOKEN.run;
FX_ACTIONS.SEND_TOKEN.run = async (c, a) => {
  const p = c.p, cnt = () => p.nexus.filter(x => x.id === 'BS73-T001' && x.token).length, before = cnt();
  await _sendTokenBed(c, a);
  const now = cnt();
  if (now > before && G && G.evQ && fieldList(p).some(f => fxEntries(f).some(({ e }) => e.trigger === 'BED_SENT'))) G.evQ.push({ type: 'BED_SENT', key: p.key, inst: p.nexus[p.nexus.length - 1] });
};
/* v580 STATIC FLASH_COST_LOCK (BS73-TX02B): "(Your Attack Step) neither player can use cards with a cost equal or inferior to your number of counters during Flash Timing". Read by magicTaxHit (Magic cards only; High Speed / Accel are not covered). */
STATIC_FLAGS.push('FLASH_COST_LOCK');
function flashCostLocked(card) {
  if (!G || G.step !== 5 || !G.active || !card) return false;
  const A = G.p[G.active];
  return A.spirits.some(s => !s.noFx && fxEntries(s).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'FLASH_COST_LOCK' && (!e.lv || e.lv.includes(lvNo(s))))) && card.cost <= A.count;
}
/* v580 REVEAL_BED_SUMMON {n, match}: "reveal n cards from your decktop. By destroying any number of Fungal Bed you control, for each target destroyed, summon one <match> Spirit among them without paying the cost. Return the rest to the deckbottom" (BS73-TX02B). House reading: the fewest-core Bed is destroyed first; only Spirit cards are summoned. */
FX_ACTIONS.REVEAL_BED_SUMMON = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 6 && hasMatch(a.match) && Object.keys(a).every(k => ['do', 'n', 'match', 'if'].includes(k)),
  txt: a => `reveal ${a.n} cards from your decktop; for each Fungal Bed you destroy, summon one matching Spirit among them without paying the cost; return the rest to the deckbottom`,
  can: c => c.p.deck.length > 0,
  run: async (c, a) => {
    const nm = _pn(c), top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top; c.ctx.did = false;
    log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
    await revealedFx(c.p);
    for (;;) {
      const beds = fungalBeds(c.p).sort((x, y) => x.cores - y.cores); if (!beds.length) break;
      const L = c.p.revealed.filter(x => CARDS[x.id].type === 'Spirit' && fxMatch(CARDS[x.id], a.match) && canPlaceFree(c.p, x)); if (!L.length) break;
      const t = await chooseCard(c, L, `✨ ${nm}`, 'Destroy a Fungal Bed to summon one of these? (Cancel to stop)', true); if (!t) break;
      removeFrom(c.p.revealed, t); c.p.hand.push(t);
      removeNexus(c.p, beds[0], 'destroyed'); log(`${nm}: ${CARDS[beds[0].id].name} is destroyed.`);
      if (await summonFree(c.p, t)) c.ctx.did = true; else { removeFrom(c.p.hand, t); c.p.revealed.push(t); break; }
    }
    const rest = c.p.revealed.splice(0); for (const x of rest) c.p.deck.push(x);
    if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} returned to the deckbottom.`);
  } };
