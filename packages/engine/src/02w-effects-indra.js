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
function nexusShielded(p, n) {
  if (!G || !G.fxBy || G.fxBy === p.key || !p.nexus.includes(n) || !mirageNexusOf(p, n)) return false;
  log(`${CARDS[n.id].name} can't be destroyed by opposing effects (${CARDS[p.mirage.id].name} is set).`); return true;
}
function nexusVoided(p, uid) {
  if (!G || !G.evQ || G.over || !p.mirage) return;
  const n = p.nexus.find(x => x.uid === uid); if (!n || !mirageNexusOf(p, n) || G.evQ.some(e => e.type === 'MIRAGE_SUMMON' && e.key === p.key)) return;
  G.evQ.push({ type: 'MIRAGE_SUMMON', key: p.key, inst: n });
}
async function mirageSummonOffer(p) {
  const m = p.mirage; if (!G || G.over || !m || !CARDS[m.id].mirageNexus) return;
  if (!p.cpu && !await ask({ title: `✨ ${CARDS[m.id].name}`, peek: true, html: `Cores on your ${esc(CARDS[m.id].mirageNexus.name)} were sent to the Void. Summon the set Mirage ${esc(CARDS[m.id].name)} (paying its cost)?`, cards: cardIds([m]), buttons: [{ label: 'Summon', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] })) return;
  p.mirage = null; m.mirage = false; p.hand.push(m);
  if (await summonPaid(p, m)) { log(`${CARDS[m.id].name}: the set Mirage is summoned.`); return; }
  removeFrom(p.hand, m); m.mirage = true; p.mirage = m;      // could not be paid: it stays set
}
