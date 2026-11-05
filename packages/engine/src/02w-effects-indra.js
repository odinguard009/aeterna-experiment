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
function mirageCoreSafe(p, t) { return !!(G && G.fxBy && G.fxBy !== p.key && p.mirage && t && p.nexus.includes(t) && CARDS[p.mirage.id].mirageNexus && CARDS[p.mirage.id].mirageNexus.onlyOne && mirageShield(p, t)); }
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
  if (G && G.evQ && CARDS[inst.id].type === 'Nexus') G.evQ.push({ type: 'NEXUS_SOUL', key: p.key, inst, byOppFx: !!G.fxBy && G.fxBy !== p.key });
  if (G && G.evQ && CARDS[inst.id].soulDeploy) G.evQ.push({ type: 'SOUL_DEPLOY', key: p.key, inst });
  if (G && G.evQ && (p.soulState.some(x => CARDS[x.id].soulBurst && p.soulState.length >= ((CARDS[x.id].burst || {}).soulAt || 5)) || (p.burst && CARDS[p.burst.id].soulBurst && p.soulState.length >= ((CARDS[p.burst.id].burst || {}).soulAt || 5))) && !G.evQ.some(e => e.type === 'SOUL_BURST' && e.key === p.key)) G.evQ.push({ type: 'SOUL_BURST', key: p.key });
  const mn = G && G.evQ && p.mirage && CARDS[p.mirage.id].mirageNexus;
  if (mn && mn.soul && CARDS[inst.id].name.endsWith(mn.name) && !G.evQ.some(e => e.type === 'MIRAGE_SUMMON' && e.key === p.key)) G.evQ.push({ type: 'MIRAGE_SUMMON', key: p.key, inst });
}
function nexusShielded(p, n) {
  if (nexusSwapSave(p, n)) return true;
  if (nexusGuarded(p, n)) return true;
  if (!G || !G.fxBy || G.fxBy === p.key || !p.nexus.includes(n) || !mirageShield(p, n)) return false;
  log(`${CARDS[n.id].name} can't be destroyed by opposing effects (${CARDS[p.mirage.id].name} is set).`); return true;
}
function nexusVoided(p, uid) {
  nexusCoresDown(p, uid);
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

/* v554 DESTROY_OWN_ALL {besides, nexus}: "Besides this Spirit, destroy all your Spirits and Nexuses" (P16-16). */
Object.assign(FX_ACTIONS, {
  DESTROY_OWN_ALL: { chk: a => a.besides === true && a.nexus === true && Object.keys(a).every(k => ['do', 'if', 'besides', 'nexus'].includes(k)),
    txt: () => 'besides this Spirit, destroy all your Spirits and Nexuses', can: () => true,
    run: async (c, a) => {
      for (const s of c.p.spirits.filter(x => x !== c.src)) removeSpirit(c.p, s, 'destroyed', false);
      for (const n of c.p.nexus.slice()) removeNexus(c.p, n, 'destroyed');
      checkDepletion(c.p); log(`${CARDS[c.src.id].name}: ${poss(c.p)} other Spirits and Nexuses are destroyed.`); io.view({ type: 'board' });
    } } });

/* v555 EXTRA_SYMBOL {replace:true}: "change this Spirit's symbols to N <colour> symbols" while `if` holds (PB17-X02): the printed symbols are dropped, the N extras stay (extraSymbolsOf). */
function symReplaced(p, i) {
  if (!G || !fieldList(p).includes(i)) return false;
  const L = lvNo(i), opp = G.p[other(p.key)];
  return fxEntries(i).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'EXTRA_SYMBOL' && e.replace === true && !(e.lv && !e.lv.includes(L)) && fxIf(p, opp, e.if, { selfInst: i }));
}

/* v556 BOUNCE_PER_SYMCOLOR: "for each colour of your symbols, return 1 opposing Spirit/Ultimate to the Hand" (SD32-X01); trashCoresIf:'soulPaid' = with (Soul Core) used for the summon cost the returned Spirits' cores go to the Trash instead. */
Object.assign(FX_ACTIONS, {
  BOUNCE_PER_SYMCOLOR: { chk: a => (a.trashCoresIf == null || a.trashCoresIf === 'soulPaid') && Object.keys(a).every(k => ['do', 'if', 'trashCoresIf'].includes(k)),
    txt: () => 'for each colour of your symbols, return 1 opposing Spirit to the Hand', can: () => true,
    run: async (c, a) => {
      const n = COLORS.filter(k => (symbolsOn(c.p)[k] || 0) >= 1).length, got = [], trash = a.trashCoresIf === 'soulPaid' && !!c.src.soulPaid;
      for (let j = 0; j < n; j++) {
        const rest = c.opp.spirits.filter(t => !got.includes(t) && !fxImmune(c.opp, t)); if (!rest.length) break;
        const t = await fxPickTarget(c, rest, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to return (${j + 1}/${n}).`); if (!t) break;
        got.push(t);
      }
      for (const t of got) {
        if (trash) { c.opp.trashCores.n += t.cores; t.cores = 0; if (t.soul) { t.soul = false; c.opp.trashCores.soul = true; } }
        bounceCard(c.opp, t, 'hand');
      }
      if (!got.length) c.ctx.did = false; checkDepletion(c.opp); io.view({ type: 'board' });
    } } });

/* v557 OPP_SPIRITS_CORES_TRASH {spirits, cores, lifeIf}: "put N cores each from M opposing Spirits to the opposing Trash"; with `lifeIf` (a condition) true, for each Spirit removed (depleted) by it send 1 opposing Life core to the opposing Reserve (SJ15-20). */
Object.assign(FX_ACTIONS, {
  OPP_SPIRITS_CORES_TRASH: { chk: a => Number.isInteger(a.spirits) && a.spirits >= 1 && a.spirits <= 3 && Number.isInteger(a.cores) && a.cores >= 1 && a.cores <= 3 && Object.keys(a).every(k => ['do', 'if', 'spirits', 'cores', 'lifeIf'].includes(k)),
    txt: a => `put ${a.cores} cores each from ${a.spirits} opposing Spirits to the opposing Trash`,
    can: c => c.opp.spirits.some(t => t.cores > 0 && !fxImmune(c.opp, t)),
    run: async (c, a) => {
      const hit = [];
      for (let j = 0; j < a.spirits; j++) {
        const L = c.opp.spirits.filter(t => t.cores > 0 && !hit.includes(t) && !fxImmune(c.opp, t)); if (!L.length) break;
        const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap an opposing Spirit (${j + 1}/${a.spirits}).`);
        if (!t) break;
        const m = Math.min(a.cores, t.cores, coreTakeCap(c.opp, t, a.cores)); hit.push(t); if (m <= 0) continue;
        coreEvN(c.opp, t.uid, 'trash', m, false); t.cores -= m; c.opp.trashCores.n += m;
        log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Trash.`);
      }
      if (!hit.length) { c.ctx.did = false; return; }
      checkDepletion(c.opp);
      const gone = hit.filter(t => !c.opp.spirits.includes(t)).length;
      if (gone && a.lifeIf && fxIf(c.p, c.opp, a.lifeIf, { selfInst: c.src })) {
        const m = await lifeGuardFx(c.opp, Math.min(gone, c.opp.life));
        if (m) { lifeTake(c.opp, m, 'reserve'); log(`${_pn(c)}: ${m} opposing Life moves to the opposing Reserve.`); }
        if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
        if (m) await maybeBurst(c.opp, 'LIFE_DECREASE', {});
      }
      io.view({ type: 'board' });
    } } });

/* v558 REFRESH_PER_SYMCOLOR: "for each colour of your symbols, refresh a Spirit you control" (SD32-007 Burst). */
Object.assign(FX_ACTIONS, {
  REFRESH_PER_SYMCOLOR: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'for each colour of your symbols, refresh a Spirit you control', can: c => c.p.spirits.some(s => s.exhausted),
    run: async (c, a) => {
      const n = COLORS.filter(k => (symbolsOn(c.p)[k] || 0) >= 1).length; let done = 0;
      for (let j = 0; j < n; j++) {
        const L = c.p.spirits.filter(s => s.exhausted); if (!L.length) break;
        const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your exhausted Spirit to refresh (${j + 1}/${n}).`);
        if (!t) break;
        t.exhausted = false; done++; log(`${CARDS[t.id].name} is refreshed.`);
      }
      if (!done) c.ctx.did = false; io.view({ type: 'board' });
    } } });

/* v560 DISCARD_DOWN_TO {n}: "discard cards from your Hand until your Hand is n or less" (BS72-074; you choose, the CPU throws away the cheapest). */
Object.assign(FX_ACTIONS, {
  DISCARD_DOWN_TO: { chk: a => Number.isInteger(a.n) && a.n >= 0 && a.n <= 5 && Object.keys(a).every(k => ['do', 'n', 'if'].includes(k)),
    txt: a => `discard cards from your Hand until it is ${a.n} or less`, can: () => true,
    run: async (c, a) => {
      const out = [];
      while (c.p.hand.length > a.n) {
        const L = c.p.hand.slice();
        const d = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose a card to discard (Hand must be ${a.n} or less).`, false);
        removeFrom(c.p.hand, d); c.p.trash.push(d); out.push(d);
        log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      if (!out.length) { c.ctx.did = false; return; }
      await sentToTrashFx(c, out, 'hand'); io.view({ type: 'board' });
    } } });
