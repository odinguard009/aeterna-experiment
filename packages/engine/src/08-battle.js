/* ---------------------------------------------------------------------
   BATTLE  (declare -> flash -> block -> flash -> resolution)
   --------------------------------------------------------------------- */
/* Flash Timing: the defending player gets priority first; every cast gives the other player a chance to respond; it ends when both pass in a row. */
const successor = (p, inst) => p.spirits.includes(inst) ? inst : (p.spirits.find(x => x.under.includes(inst)) || null);   // an Advent keeps the battle going with the card on top
async function flashTiming(attKey, att, blk) {
  const order = [other(attKey), attKey];
  let passes = 0, turn = 0, plays = 0;
  while (passes < 2 && plays < 8 && !G.over) {
    const p = G.p[order[turn % 2]];
    const ch = p.cpu ? cpuFlashChoice(p, attKey, att, blk) : await humanFlashChoice(p, attKey, att, blk);
    if (ch && ch.cadv) { passes = 0; plays++; if (p.cpu) await doContractAdvent(p, ch.cadv, ch.target, 'flash'); else await humanContractAdvent(ch.cadv, 'flash'); } else if (ch && ch.manifest) { passes = 0; plays++; if (p.cpu) await doManifest(p, ch.manifest, ch.target, 'flash'); else await humanManifest(ch.manifest, 'flash'); } else if (ch && ch.hs) { passes = 0; plays++; await highSpeedSummon(p, ch.hs); } else if (ch && ch.accel) { passes = 0; plays++; await useAccel(p, ch.accel.inst, ch.accel.idx, ch.accel.plan, 'FLASH'); } else if (ch && ch.act) { passes = 0; plays++; await activateFx(p, ch.act.f, ch.act.idx); } else if (ch) { passes = 0; plays++; await castMagic(p, ch); io.view({ type: 'board' }); await wait(650); await flushBursts(); } else passes++;
    turn++;
    att = successor(G.p[attKey], att) || att; if (blk) blk = successor(G.p[other(attKey)], blk) || blk; G.attacker = att; if (blk) G.blocker = blk;
    if (!G.p[attKey].spirits.includes(att) || (blk && !G.p[other(attKey)].spirits.includes(blk))) break;
  }
  return [att, blk];
}

function battleEndAttack() {                          // v0.43 "when this battle ends, end the Attack Step"
  const by = G.endAttackAfter; G.endAttackAfter = null;
  if (by == null || G.over) return;
  if (endAttackLocked(G.p[by])) { log('The Attack Step can\'t be ended via effects: the effect does nothing.'); return; }
  G.attackEnded = G.turnNo; log('The battle ends, and with it the Attack Step.');
}
const attackStepOver = () => !!G && G.attackEnded === G.turnNo;
async function doBattle(attKey, att) { try { G.eob = []; G.battleMagic = []; G.battleResolved = false; await doBattleInner(attKey, att); if (G && !G.over && G.eob && G.eob.length) await endOfBattle(); const a2 = G && G.attacker; if (a2 && !G.over && G.p[attKey].spirits.includes(a2)) await fireFx(G.p[attKey], 'ALLY_BATTLE_END', null, { subject: a2, attacker: a2 }); } finally { if (G) { G.eob = null; G.battleMagic = null; G.battleResolved = false; battleEndAttack(); G.attacker = null; G.blocker = null; G.noBurst = null; for (const k of ['player', 'opponent']) for (const f of fieldList(G.p[k])) f.symBattle = 0; } } }
async function doBattleInner(attKey, att) {
  const A = G.p[attKey], D = G.p[other(attKey)];
  if (!(await payAbTax(A, att, 'attack'))) { io.view({ type: 'board' }); return; }   // v0.47 Plutonic Wall
  A.attacksThisTurn = (A.attacksThisTurn || 0) + 1;      // v0.185 'first / second or subsequent attack of the turn' (reset in beginTurn)
  att.exhausted = true; G.battleNo = (G.battleNo || 0) + 1; G.blocker = null;      // v0.68: battle counter for (Once Per Battle) / "during this battle" (02l)
  log(`${who(A)} ${A.cpu ? 'attacks' : 'attack'} with ${CARDS[att.id].name} (${bpOf(att)} BP).`);
  G.attacker = att;
  io.view({ type: 'board' }); await wait(450);
  await fireFxMulti([{ owner: A, trigger: 'ATTACKS', src: att, ctx: { attacker: att } }, { owner: A, trigger: 'ALLY_ATTACKS', src: att, ctx: { attacker: att } }, { owner: D, trigger: 'OPP_ATTACKS', src: att, ctx: { attacker: att } }]);   // one simultaneous pool
  if (G.over) { G.attacker = null; return; }
  if (A.spirits.includes(att)) { await maybeBurst(D, 'OPP_ATTACK', { attacker: att }); await flushBursts(); if (G.over) { G.attacker = null; return; } }   // v0.71 Burst "After an opposing Spirit attacks": after the attack's (When Attacks) effects
  att = (await flashTiming(attKey, att, null))[0];
  if (G.over) return;
  if (!A.spirits.includes(att)) { log('The attack ends: the attacking Spirit left the field.'); io.view({ type: 'board' }); return; }
  const blockers = noBlockActive(D) || att.noBlockTurn === G.turnNo ? [] : D.spirits.filter(s => canBlockState(D, s) && abTaxOK(D, s) && !blockedByMark(att, s) && !blockedInferior(D, att, s));
  let blk = null;
  /* v0.58 priority "cannot" > "must" > "do" = "can" (JP 17.0 item 9): Spirits that can't block were removed above; a Spirit unaffected by the
     attacker's effects is not bound by its "must block" (FAQ Q4: unaffected > the effect) */
  const bound = blockers.filter(b => !fxImmune(D, b, { p: A, src: att }));
  const must = bound.length > 0 && flagActive(A, 'MUST_BLOCK', att);
  const marked = bound.filter(b => b.mustB === G.battleNo);      // v0.185 MUST_BLOCK_OPP: only the marked Spirits are bound (and are the only choice)
  if (must) log(`${CARDS[att.id].name}: opposing Spirits must block if possible.`);
  if (blockers.length) blk = await askBlock(att, D, marked.length ? marked : blockers, must || marked.length > 0, marked.length ? marked : bound);   // v0.105.0 (M6 step 1): CPU seats answer the port too; cpuAnswer routes this pick to the same cpuChooseBlock
  if (blk && !(await payAbTax(D, blk, 'block'))) blk = null;
  if (blk) {
    blk.exhausted = true; G.blocker = blk; D.blocksThisTurn = (D.blocksThisTurn || 0) + 1;
    log(`${who(D)} ${D.cpu ? 'blocks' : 'block'} with ${CARDS[blk.id].name} (${bpOf(blk)} BP).`);
    io.view({ type: 'board' }); await wait(450);
    await fireFxMulti([{ owner: A, trigger: 'ALLY_BLOCKED', src: att, ctx: { attacker: att, blocker: blk } }, { owner: D, trigger: 'BLOCKS', src: blk, ctx: { attacker: att, blocker: blk } }, { owner: D, trigger: 'ALLY_BLOCKS', src: blk, ctx: { attacker: att, blocker: blk, subject: blk } }]);   // manual p. 30: one pool after the block
    if (G.over) return;
    [att, blk] = await flashTiming(attKey, att, blk);
    if (G.over) return;
    if (!A.spirits.includes(att) || !D.spirits.includes(blk)) { log('The battle ends: a fighting Spirit left the field.'); io.view({ type: 'board' }); return; }
    const ab = bpOf(att), bb = bpOf(blk); G.battleResolved = true;      // v0.78 Curse: armed only when the battle reaches the BP comparison
    const safe = s => s.noBpDestroy === G.battleNo || bpCompareLocked(s);      // v0.196 NO_BP_DESTROY: "can't be destroyed by BP comparison" (this battle)
    if (ab >= bb && !safe(blk)) removeSpirit(D, blk, 'destroyed', 'battle');            // v0.73 'battle' = by the opponent, not by an opposing effect
    if (ab <= bb && !safe(att)) removeSpirit(A, att, 'destroyed', 'battle');
    if (ab >= bb && G.evQ) G.evQ.push({ type: 'DESTROYS', key: A.key, inst: att });
    if (ab !== bb && G.evQ && !safe(ab > bb ? blk : att)) G.evQ.push(ab > bb ? { type: 'BATTLE_WIN', key: A.key, inst: att, att: true } : { type: 'BATTLE_WIN', key: D.key, inst: blk, att: false });   // v0.55 (When Battles): only the opposing Spirit destroyed (CR 8-1-6-2)
    checkDepletion(A); checkDepletion(D);
    io.view({ type: 'board' });
    await flushBursts();
    return;
  }
  const shield = (att.lifeShield && att.lifeShield.turn === G.turnNo && att.lifeShield.key === D.key) || attackLifeLocked(att) || (D.coreShield && D.coreShield.turn === G.turnNo && (D.coreShield.b == null || D.coreShield.b === G.battleNo) && totalCores(att) === D.coreShield.cores);      // v0.199 LIFE_CORE_SHIELD      // v0.186 NO_ATTACK_LIFE      // v0.89 S1 LIFE_SHIELD: "your Life can't be reduced by its attack"
  const dmg = shield ? 0 : Math.min(attackSymbols(att), D.life);
  if (shield) log(`${CARDS[att.id].name}'s attack can't reduce ${poss(D)} Life.`);
  lifeTake(D, dmg, 'reserve');                    // Life cores go to the Reserve
  log(`${CARDS[att.id].name} is not blocked: ${who(D)} ${D.cpu ? 'loses' : 'lose'} ${dmg} Life.`);
  io.view({ type: 'board' });
  if (D.life <= 0) { win(attKey, `${poss(D)} Life reached 0`); return; }
  if (dmg > 0) { await fireFxMulti([{ owner: A, trigger: 'ALLY_LIFE_HIT', src: null, ctx: { attacker: att } }, { owner: A, trigger: 'MIRAGE_OPP_LIFE', src: null, ctx: {} }, { owner: D, trigger: 'OWN_LIFE_HIT', src: null, ctx: { attacker: att } }, { owner: D, trigger: 'MIRAGE_OWN_LIFE', src: null, ctx: {} }]); if (G.over) return; }
  await maybeBurst(D, 'LIFE_DECREASE', { attacker: att });
  await flushBursts();
  io.view({ type: 'board' });
}
/* Burst: a face-down card in the Burst Area flips when its condition happens. All effects are engine actions (card.burst = {when, actions}). */
async function maybeBurst(owner, trigger, ctx) {
  const b = owner.burst; if (!b || b.mirage || !G || G.over) return false;
  if (G.noBurst === owner.key) return false;           // v0.38 "the opponent can't activate Burst effects" (this battle)
  const def = CARDS[b.id].burst, opp = G.p[other(owner.key)];
  const when = def && def.when === 'OPP_SUMMON_ADV_FX' && (trigger === 'OPP_SUMMON_FX' || trigger === 'OPP_ADVENT_FX') ? def.when : trigger;   // v0.71 "(When Summoned/Advents)" Burst condition
  const also = !!def && !!def.also && def.also.when === trigger && (!ctx || !ctx.subject || fxMatch(CARDS[ctx.subject.id], def.also.match)) && (!def.also.if || fxIf(owner, opp, def.also.if));   // v0.47 Dana Draw
  if (!def || (def.when !== when && !also)) return false;
  const c = { p: owner, opp, src: b, ctx: Object.assign({}, ctx), burst: true, summoned: false };
  if (!fxIf(owner, opp, def.if)) return false;
  if (def.noUlt && ctx && ctx.attacker && CARDS[ctx.attacker.id].type === 'Ultimate') return false;   // v0.71 "After an opposing Spirit attacks" (not "Spirit/Ultimate")
  if (!def.actions.some(a => !FX_ACTIONS[a.do].can || FX_ACTIONS[a.do].can(c, a))) return false;
  const use = owner.cpu ? true : (await ask({
    title: '💥 Burst', peek: true, wide: true, html: `${esc(CARDS[b.id].name)} can be activated (${esc(BURST_WHEN[def.when])}): ${esc(fxDescribe(def))}.`, cards: cardIds([b]),
    buttons: [{ label: 'Activate Burst', cls: 'primary', value: true }, { label: 'Keep it set', cls: 'cancel', value: false }]
  }));
  if (!use || owner.burst !== b) return false;
  io.view({ type: 'burst', side: owner.key, id: b.id });   // v0.126.0 U14d3: display only, before the card leaves the Burst Area
  owner.burst = null; owner.limbo = b;                // the card is flipped and leaves the Burst Area while its effect resolves
  log(`${who(owner)} ${owner.cpu ? 'activates' : 'activate'} Burst: ${CARDS[b.id].name}!`);
  io.view({ type: 'board' });
  G.resolving = (G.resolving || 0) + 1;
  try {
    for (const a of def.actions) {
      if (G.over) break;
      if (a.if && !fxIf(owner, opp, a.if)) continue;
      await FX_ACTIONS[a.do].run(c, a);
      io.view({ type: 'board' });
    }
    if (def.thenFlash && !G.over) await burstFlash(owner, b);
    if (def.thenMain && !G.over) await burstFlash(owner, b, 'main');
  } finally {
    G.resolving--;
    owner.limbo = null;
    if (!fieldList(owner).includes(b) && !owner.trash.includes(b) && !owner.hand.includes(b)) owner.trash.push(b);   // a used Magic / Spirit that was not summoned goes to the Trash
  }
  checkDepletion(owner); checkDepletion(opp);
  io.view({ type: 'board' });
  await flushDerived();
  return true;
}
/* v0.44 K_FLASH_BURST_FOLLOWUP: "Then by paying the cost, activate this card's (Flash) effect" (Crimson Meteor Defense, Magma Call).
   After the Burst actions the owner may pay the card's cost (reductions apply) to run its Flash effect; the card is not in the Hand, so it is cast straight from the Burst. */
async function burstFlash(p, inst, ctx) {            // v0.47: ctx 'main' = "activate the Main effect of this card" (Dana Draw)
  ctx = ctx || 'flash'; const card = CARDS[inst.id], lbl = ctx === 'main' ? '(Main)' : '(Flash)';
  if (!magicUsable(p, inst, ctx)) return false;
  let ch;
  if (p.cpu) { if (!cpuBurstFlash(p, inst, ctx)) { log(`${who(p)} ${p.cpu ? 'does' : 'do'} not pay for the ${lbl} effect of ${card.name}.`); return false; } ch = { inst, target: null, plan: null, ctx }; }
  else {
    const go = await ask({ title: `💥 Burst: ${lbl} effect`, peek: true, wide: true, html: `Pay ${effCost(p, card)} to activate the ${lbl} effect of ${esc(card.name)}: ${esc(magicText(card))}`, cards: cardIds([inst]),
      buttons: [{ label: `Pay ${effCost(p, card)}`, cls: 'primary', value: true }, { label: 'Do not pay', cls: 'cancel', value: false }] });
    if (!go) return false;
    ch = await prepareHumanMagic(p, inst, ctx); if (!ch) return false;
  }
  log(`${who(p)} ${p.cpu ? 'pays' : 'pay'} the cost to activate the ${lbl} effect of ${card.name}.`);
  await castMagic(p, ch); io.view({ type: 'board' });
  return true;
}
async function flushBursts() {                         // queued Bursts and events: "your Spirit was destroyed", "the opposing Hand increased", "an ally was lost"
  // v0.55.2 JP 17.0 revision notice item 6: a declared Burst resolves after every non-Burst triggered effect of the event,
  // so all queued events (When Destroyed, ally lost, opposing Hand increased, ...) run first; then the declared Bursts,
  // the non-turn player's first, each player's in declaration order. The Burst condition is checked when it resolves (house reading).
  let guard = 0;
  while (G && !G.over && (G.burstQ.length || G.evQ.length) && guard++ < 60) {
    if (!G.evQ.length) {
      const k = G.burstQ.findIndex(q => q.key !== G.active), q = G.burstQ.splice(k < 0 ? 0 : k, 1)[0];
      await maybeBurst(G.p[q.key], q.when || 'ALLY_DESTROYED', {}); continue;
    }
    const ev = G.evQ.shift();
    if (ev.type === 'HAND_UP') {
      const q = G.p[other(ev.key)];
      G.burstQ.push({ key: q.key, when: 'OPP_HAND_UP' });
      await fireFx(q, 'OPP_HAND_UP', null, {});
    } else if (ev.type === 'REMOVED') {
      await fireFx(G.p[other(ev.key)], 'OPP_REMOVED', null, {});
    } else if (ev.type === 'FXKILL') {
      await fireFx(G.p[ev.key], 'OPP_DESTROYED_FX', null, { bp: ev.bp, fxSrc: ev.src });
    } else if (ev.type === 'LOST') {
      await fireFx(G.p[ev.key], 'ALLY_LOST', null, { subject: ev.inst });
    } else if (ev.type === 'DESTROYED') await fireFx(G.p[ev.key], 'DESTROYED', ev.inst, { subject: ev.inst, byOpp: !!ev.byOpp, byOppFx: !!ev.byOppFx, depl: !!ev.depl });
    else if (ev.type === 'IMMORTAL') await immortalOffer(G.p[ev.key], ev.inst);
    else if (ev.type === 'LEAVES') await fireFx(G.p[ev.key], 'LEAVES', ev.inst, { subject: ev.inst, byOpp: true, byOppFx: !!ev.byOppFx });
    else if (ev.type === 'BATTLE_WIN') await fireFxMulti([{ owner: G.p[ev.key], trigger: 'BATTLE_WIN', src: ev.inst, ctx: { subject: ev.inst, attacking: !!ev.att } }, { owner: G.p[ev.key], trigger: 'ALLY_BATTLE_WIN', src: null, ctx: { subject: ev.inst, attacking: !!ev.att } }]), winRiderRun(ev);   // v0.78 also "... with your X Spirit" on other cards
    else if (ev.type === 'DESTROYS') await fireFx(G.p[ev.key], 'ALLY_DESTROYS', null, { attacker: ev.inst, subject: ev.inst });
    releaseStandby(false);                               // v0.57.0: a card whose leave triggers have all resolved leaves Standby
  }
  if (G && G.over) { G.burstQ.length = 0; releaseStandby(true); G.evQ.length = 0; }
}


