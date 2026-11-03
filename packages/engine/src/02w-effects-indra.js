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

/* v425 BS75-AX02 Grand-Sagitto-Nova: "for each opposing Spirit/Ultimate under can't attack/block effects, send an opposing Life to the Reserve" */
FX_ACTIONS.LIFE_TO_RESERVE_PER_CAB = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => "for each opposing Spirit/Ultimate under can't attack/block effects, send an opposing Life to the opposing Reserve",
  can: c => c.opp.life > 0 && c.opp.spirits.some(t => t.noAB),
  run: async c => {
    let m = Math.min(c.opp.spirits.filter(t => t.noAB).length, c.opp.life); if (!m) { c.ctx.did = false; return; }
    m = await lifeGuardFx(c.opp, m); if (!m) { c.ctx.did = false; return; }
    lifeTake(c.opp, m, 'reserve'); log(`${CARDS[c.src.id].name}: ${m} opposing Life moves to the opposing Reserve.`); io.view({ type: 'board' });
    if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
    await maybeBurst(c.opp, 'LIFE_DECREASE', {});
  } };

/* v426 BS75-049 Airavajdra: "When your <family> Spirits would leave the Field due to opposing effects, you can summon this card from the Hand" (queued by leaveHook, answered after the effect) */
async function leaveSummonOffer(p, s) {
  if (!G || G.over) return;
  for (const h of p.hand.slice()) {
    const k = CARDS[h.id]; if (!k.leaveSummon || !(CARDS[s.id].families || []).includes(k.leaveSummon.family) || !p.hand.includes(h) || !summonOK(p, k) || !canPlacePaid(p, h)) continue;
    if (!p.cpu && !await ask({ title: `✨ ${k.name}`, peek: true, html: `${esc(CARDS[s.id].name)} would leave the Field due to an opposing effect. Summon ${esc(k.name)} from your Hand (paying its cost, Trash symbols can reduce it)?`, cards: cardIds([h]), buttons: [{ label: 'Summon', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] })) continue;
    log(`${k.name}: summoned from the Hand as ${CARDS[s.id].name} would leave the Field.`);
    await summonPaid(p, h); return;
  }
}

/* v426 BS75-042 Bilijvern: card field mirageNexus {name}. During Set the named Nexuses can't be destroyed by opposing effects; when cores on such a Nexus are sent to the Void the set Mirage may be summoned (nexusVoided is called wherever Nexus cores go to the Void) */
const mirageNexusOf = (p, n) => { const m = p.mirage && CARDS[p.mirage.id].mirageNexus; return m && n && CARDS[n.id].name.endsWith(m.name) ? p.mirage : null; };
/* v433 BS74-047 Sat: mirageNexus {name, onlyOne, soul}: onlyOne = the shield holds only while exactly one such Nexus is controlled; soul = the Mirage may be set from Soul State and is summoned when a card of that name enters Soul State (soulEnterHook, called by toSoulState), not when cores go to the Void */
const mirageShield = (p, n) => { const m = mirageNexusOf(p, n); return !!m && (!CARDS[m.id].mirageNexus.onlyOne || p.nexus.filter(x => CARDS[x.id].name.endsWith(CARDS[m.id].mirageNexus.name)).length === 1); };
function mirageCoreSafe(p, t) { return !!(G && G.fxBy && G.fxBy !== p.key && p.mirage && t && p.nexus.includes(t) && CARDS[p.mirage.id].mirageNexus.onlyOne && mirageShield(p, t)); }
/* v433 BS74-072 Mitra's Revelation Temple: card field soulDeploy ("When this card enters Soul State, you can deploy it": event SOUL_DEPLOY -> soulDeployOffer, cost paid); STATIC flag OPP_RETURN_FX_LOCK {match} (Lv2: the (would leave) effects of opposing Spirits returned to the Hand/Deck by an effect of a matching card of yours can't activate; bounceCard sets noFx around leaveEvent) */
function bounceLocked(owner) {
  const foe = G && G.p[other(owner.key)], src = G && G.fxSrc; if (!foe || !src || G.fxBy !== foe.key) return false;
  return fieldList(foe).some(f => (CARDS[f.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'OPP_RETURN_FX_LOCK' && (!e.lv || e.lv.includes(lvNo(f))) && fxMatch(CARDS[src.id], e.match, src)));
}
async function soulDeployOffer(p, inst) {
  if (!G || G.over || !p.soulState.includes(inst) || !canPlaceBy(p, inst, true)) return;
  if (!p.cpu && !await ask({ title: `✨ ${CARDS[inst.id].name}`, peek: true, html: `${esc(CARDS[inst.id].name)} entered Soul State. Deploy it (paying its cost)?`, cards: cardIds([inst]), buttons: [{ label: 'Deploy', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] })) return;
  if (await summonPaid(p, inst)) log(`${CARDS[inst.id].name}: deployed from Soul State.`);
}
function soulEnterHook(p, inst) {
  if (G && G.evQ && CARDS[inst.id].soulDeploy) G.evQ.push({ type: 'SOUL_DEPLOY', key: p.key, inst });
  if (G && G.evQ && p.soulState.length >= 5 && (p.soulState.some(x => CARDS[x.id].soulBurst) || (p.burst && CARDS[p.burst.id].soulBurst)) && !G.evQ.some(e => e.type === 'SOUL_BURST' && e.key === p.key)) G.evQ.push({ type: 'SOUL_BURST', key: p.key });
  const mn = G && G.evQ && p.mirage && CARDS[p.mirage.id].mirageNexus;
  if (mn && mn.soul && CARDS[inst.id].name.endsWith(mn.name) && !G.evQ.some(e => e.type === 'MIRAGE_SUMMON' && e.key === p.key)) G.evQ.push({ type: 'MIRAGE_SUMMON', key: p.key, inst });
}
function nexusShielded(p, n) {
  if (!G || !G.fxBy || G.fxBy === p.key || !p.nexus.includes(n) || !mirageShield(p, n)) return false;
  log(`${CARDS[n.id].name} can't be destroyed by opposing effects (${CARDS[p.mirage.id].name} is set).`); return true;
}
function nexusVoided(p, uid) {
  if (!G || !G.evQ || G.over || !p.mirage) return;
  const n = p.nexus.find(x => x.uid === uid); if (!n || !mirageNexusOf(p, n) || CARDS[p.mirage.id].mirageNexus.soul || G.evQ.some(e => e.type === 'MIRAGE_SUMMON' && e.key === p.key)) return;
  G.evQ.push({ type: 'MIRAGE_SUMMON', key: p.key, inst: n });
}
async function mirageSummonOffer(p) {
  const m = p.mirage; if (!G || G.over || !m || !CARDS[m.id].mirageNexus) return;
  if (!p.cpu && !await ask({ title: `✨ ${CARDS[m.id].name}`, peek: true, html: `${CARDS[m.id].mirageNexus.soul ? `Your ${esc(CARDS[m.id].mirageNexus.name)} entered Soul State.` : `Cores on your ${esc(CARDS[m.id].mirageNexus.name)} were sent to the Void.`} Summon the set Mirage ${esc(CARDS[m.id].name)} (paying its cost)?`, cards: cardIds([m]), buttons: [{ label: 'Summon', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] })) return;
  p.mirage = null; m.mirage = false; p.hand.push(m);
  if (await summonPaid(p, m)) { log(`${CARDS[m.id].name}: the set Mirage is summoned.`); return; }
  removeFrom(p.hand, m); m.mirage = true; p.mirage = m;      // could not be paid: it stays set
}
