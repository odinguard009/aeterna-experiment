/* ---------------------------------------------------------------------
   INTENTS (v0.84.0, phase F3 part 2 = monorepo step M3 rest; docs/ai/monorepo-plan.md "Design" 1)
   A human seat's board actions are intent records, answers to the decision `{kind: 'action', step, turn}` that
   seatTurn() asks through the port (io.decide) until the turn ends. An intent is a plain, serializable object
   (cards by uid); applyIntent() checks it against the rules and resolves true (done) or false (not legal now).
     {type: 'next'}                     NEXT: Main -> Attack -> (Second Main) -> End, as the NEXT button
     {type: 'end'}                      press NEXT until the turn ends
     {type: 'summon'|'cast'|'burst'|'mirage'|'brave'|'cadvent'|'manifest', uid}   a card in the Hand
                                        (cadvent: also Soul State while Contract Advent from there is allowed)
     {type: 'accel', uid, idx}          an [Accel] effect of a card in the Hand (Main Step)
     {type: 'act', uid, idx}            an activated [Main] effect of a field card
     {type: 'bcombine'|'bseparate', uid}   Brave on the field: combine with a Spirit (asked by a pick) / separate
     {type: 'core', op, uid}            op: add | remove | move | soul | unsoul | swaphere | swapsoul (move / swapsoul ask a pick)
     {type: 'attack', uid}              Attack Step: attack with this Spirit
     {type: 'revive', uid}              [Revive] a card in Soul State
     {type: 'summonRemoved', uid}       summon an Accel Spirit from the Removed Zone
   Payments, targets and other prompts inside an action are ordinary decision records (05b-decide.js).
   Hosts: the web UI sends intents with sendIntent (apps/web/src/13e-host.js); headless scripts answer the action
   decision (packages/engine/headless.mjs); cpuAnswer() below is a port answerer for any seat (the CPU through the port).
   Without a running seat loop (test boards) applyIntent() runs the intent at once.
   --------------------------------------------------------------------- */
const INTENT_TYPES = ['next', 'end', 'summon', 'cast', 'burst', 'mirage', 'brave', 'cadvent', 'manifest', 'accel', 'act', 'bcombine', 'bseparate', 'core', 'attack', 'revive', 'summonRemoved'];
const CORE_OPS = ['add', 'remove', 'move', 'soul', 'unsoul', 'swaphere', 'swapsoul'];
const INTENT_MAX = 400;                               // a seat that sends this many intents in one turn has its turn ended (scripts that loop)
let SEAT_LOOP = null;                                 // {key, s: SESSION} while seatTurn() waits for that seat's intents
/** The seat may act now: its own turn, not busy (an attack or the Start of the Attack Step resolving), a human seat. */
const seatCan = key => !!G && !G.over && !G.busy && G.active === key && !!G.p[key] && !G.p[key].cpu;
const seatLoopOpen = key => !!SEAT_LOOP && SEAT_LOOP.key === key && SEAT_LOOP.s === SESSION;
const boardView = () => { if (G && !G.over) { checkDepletion(G.p.player); checkDepletion(G.p.opponent); } io.view({ type: 'board' }); };      // v0.149.0: a Spirit below its Lv1 cores never survives an intent (Depletion safety net)
/** Ends the current turn of the seat (the old finishTurn of the web UI). */
function endTurnNow() { const r = G.turnResolver; G.turnResolver = null; G.busy = true; boardView(); if (r) r(); }
async function seatTurn(key) {
  const my = SESSION; let ended = false, n = 0;
  G.turnResolver = () => { ended = true; };
  SEAT_LOOP = { key, s: my };
  G.busy = false; boardView();
  try {
    while (!ended && !G.over && SESSION === my) {
      const it = await decide(key, { kind: 'action', step: G.step, turn: G.turnNo });
      if (ended || G.over) break;
      const ok = await applyIntent(key, it);
      if (SESSION !== my) throw ABORT;
      io.view({ type: 'acted', seat: key, ok: !!ok });
      if (++n >= INTENT_MAX && !ended && !G.over) { log(`${who(G.p[key])}: too many actions in one turn, the turn ends.`); G.busy = false; await applyIntent(key, { type: 'end' }); ended = true; }
    }
  } finally { if (SEAT_LOOP && SEAT_LOOP.s === my) SEAT_LOOP = null; if (SESSION === my && G) G.turnResolver = null; }
}
const handOf = (p, uid) => p.hand.find(h => h.uid === uid) || null;
const fieldOf = (p, uid) => fieldList(p).find(x => x.uid === uid) || null;
async function intentNext(key) {
  if (!seatCan(key)) return false;
  if (G.step === 4) {
    if (G.turnNo === 1) { log(G.format === 'standard' ? 'First turn: the Attack and Second Main Steps are skipped.' : 'First turn: the Attack Step is skipped.'); endTurnNow(); }
    else {
      setStep(5); log('Attack Step: tap a Spirit to attack.'); G.busy = true; boardView();
      await startAttackFx(G.p[key]);
      if (G && !G.over) { G.busy = false; boardView(); }
    }
  } else if (G.step === 5) {
    if (G.format === 'standard') { setStep(6); log('Second Main Step.'); }
    else endTurnNow();
  } else if (G.step === 6 && G.format === 'standard') endTurnNow();
  else return false;
  return true;
}
async function intentSummon(p, inst) {
  const card = CARDS[inst.id];
  if (!isSpiritForm(card) && card.type !== 'Nexus') return false;
  if (!canPlayCard(p, inst)) { log(`Not enough cores for ${card.name}.`); boardView(); return false; }
  const c = effCost(p, card), L = minCores(card);
  let plan = null;
  if (c > 0 && reserveTotal(p) < c + L) { plan = await askPayment(card, c, L); if (!plan) return false; }
  if (!seatCan(p.key) || !p.hand.includes(inst)) return false;
  summon(p, inst, plan); await tributePay(p, inst); boardView();
  await fireFx(p, 'SUMMONED', inst);
  return true;
}
async function intentCast(p, inst) {
  if (CARDS[inst.id].type !== 'Magic' || !magicUsable(p, inst, 'main')) return false;
  const ch = await prepareHumanMagic(p, inst);
  if (!ch || !seatCan(p.key) || !isMainStep() || !p.hand.includes(inst)) return false;
  await castMagic(p, ch); boardView(); await flushBursts();
  return true;
}
async function intentMirage(p, inst) {
  const card = CARDS[inst.id];
  if (!card.mirage || p.mirageSetThisTurn || !mirageUsable(p, inst)) return false;
  const c = card.mirage.cost; let plan = null;
  if (c > 0 && reserveTotal(p) < c) { plan = await askPayment(card, c, 0); if (!plan) return false; }
  if (!seatCan(p.key) || !isMainStep() || !p.hand.includes(inst) || p.mirageSetThisTurn) return false;
  removeFrom(p.hand, inst); payCost(p, c, plan); checkDepletion(p);
  setBurst(p, inst, true); boardView();
  return true;
}
/* Brave (manual p. 34-36): summon directly combined with a Spirit; combine / separate in the Main Step at no cost */
async function intentBraveSummon(p, inst) {
  const card = CARDS[inst.id];
  if (!card.brave || !braveAfford(p, inst) || !braveTargets(p, inst).length) return false;
  const uid = await pickFromField({ text: `🗡 <b>${esc(card.name)}</b><br>Tap the Spirit to combine with.`, uids: braveTargets(p, inst).map(s => s.uid), buttons: [{ label: 'Cancel', cls: 'cancel', value: 'none' }] });
  const t = fieldList(p).find(s => s.uid === uid);
  if (!t || !seatCan(p.key) || !p.hand.includes(inst) || !braveFits(inst, t)) { boardView(); return false; }
  const c = effCost(p, card); let plan = null;
  if (c > 0 && reserveTotal(p) < c) { plan = await askPayment(card, c, 0); if (!plan) { boardView(); return false; } }
  if (!seatCan(p.key) || !p.hand.includes(inst) || !braveFits(inst, t)) return false;
  braveSummon(p, inst, t, plan); boardView(); await braveSummonedFx(p, inst);
  return true;
}
async function intentBraveField(p, f, sep) {
  if (sep) { if (!f.brave || !canSeparate(p, f)) return false; separateBrave(p, f); boardView(); return true; }
  const card = CARDS[f.id];
  if (card.type !== 'Brave' || !card.brave || !p.spirits.includes(f)) return false;
  const L = braveTargets(p, f); if (!L.length) return false;
  const uid = await pickFromField({ text: `🗡 <b>${esc(card.name)}</b><br>Tap the Spirit to combine with.`, uids: L.map(s => s.uid), buttons: [{ label: 'Cancel', cls: 'cancel', value: 'none' }] });
  const t = L.find(s => s.uid === uid);
  const ok = !!t && seatCan(p.key) && isMainStep() && p.spirits.includes(f) && braveFits(f, t);
  if (ok) combineBrave(p, f, t);
  boardView(); return ok;
}
/* core and Soul Core moves on the own field (Main Step), as the buttons of the field card dialog */
async function intentCore(p, f, op) {
  const gw = isGW(f), others = fieldList(p).filter(x => x !== f && !isGW(x));      // nothing can be moved onto a Grandwalker Nexus (p. 22)
  let ok = false;
  if (op === 'add') ok = !gw && addCore(p, f);
  else if (op === 'remove') ok = !gw && removeCore(p, f);
  else if (op === 'soul') {
    if (f.soul) return false;
    const r = moveSoulTo(p, f); ok = r === 'ok';
    if (!ok) await info('Soul Core', r === 'deplete' ? 'Moving the Soul Core would deplete the Spirit it is on. Use Swap instead.' : 'The Soul Core is not available.', p.key);
  } else if (op === 'unsoul') {
    if (!f.soul) return false;
    const r = returnSoul(p, f); ok = r !== 'deplete';
    if (!ok) await info('Soul Core', 'Returning the Soul Core would deplete this Spirit. Swap it with a normal core first.', p.key);
  } else if (op === 'swaphere') {
    const h = others.find(x => x.soul);
    if (h && f.cores >= 1) { swapSoul(p, h, f); ok = true; }
  } else if (op === 'move' || op === 'swapsoul') {
    if (gw || (op === 'move' ? f.cores < 1 : !f.soul)) return false;
    const L = others.filter(x => (op === 'swapsoul' ? x.cores > 0 : true));
    if (!L.length) return false;
    const card = CARDS[f.id];
    const t = await pickFromField({
      text: op === 'move' ? `➡ <b>Move 1 core from ${esc(card.name)}</b><br>Tap the card that receives it.` : `🔄 <b>Swap the Soul Core of ${esc(card.name)}</b><br>Tap the card whose normal core trades places with it.`,
      uids: L.map(x => x.uid), buttons: [{ label: 'Cancel', cls: 'cancel', value: 'none' }]
    }, p.key);
    const target = L.find(x => x.uid === t);
    if (target && seatCan(p.key) && isMainStep() && fieldList(p).includes(f)) { if (op === 'move') moveCore(p, f, target); else swapSoul(p, f, target); ok = true; }
  }
  boardView(); return ok;
}
async function intentAttack(key, f) {
  const p = G.p[key];
  if (!p.spirits.includes(f) || !isSpiritForm(CARDS[f.id])) return false;
  if (G.step !== 5 || G.turnNo === 1 || f.exhausted || cantAttack(p, f) || !abTaxOK(p, f) || attackStepOver()) return false;
  G.busy = true; boardView();
  await doBattle(key, f);
  if (!G.over && attackStepOver()) { G.busy = false; await intentNext(key); return true; }   // v0.43: an effect ended the Attack Step
  if (!G.over) { G.busy = false; boardView(); }
  return true;
}
/** Checks an intent of seat `key` against the rules and runs it; resolves true when it was done, false when not legal now. */
async function applyIntent(key, it) {
  if (!it || typeof it !== 'object' || !INTENT_TYPES.includes(it.type) || !seatCan(key)) return false;
  const p = G.p[key], main = isMainStep(), uid = Number(it.uid);
  switch (it.type) {
    case 'next': return intentNext(key);
    case 'end': {
      const t = G.turnNo;
      for (let g = 0; g < 4 && seatCan(key) && G.turnNo === t; g++) if (!(await intentNext(key))) return false;
      return true;
    }
    case 'attack': { const f = fieldOf(p, uid); return !!f && intentAttack(key, f); }
    case 'revive': { const t = reviveTargets(p).find(x => x.uid === uid); if (!t) return false; const ok = await doRevive(p, t); boardView(); return !!ok; }
  }
  if (!main) return false;                            // everything below is a Main Step action
  switch (it.type) {
    case 'summon': case 'cast': case 'burst': case 'mirage': case 'brave': case 'manifest': {
      const inst = handOf(p, uid); if (!inst) return false;
      if (it.type === 'summon') return intentSummon(p, inst);
      if (it.type === 'cast') return intentCast(p, inst);
      if (it.type === 'mirage') return intentMirage(p, inst);
      if (it.type === 'brave') return intentBraveSummon(p, inst);
      if (it.type === 'burst') { if (!CARDS[inst.id].burst || p.burstSetThisTurn) return false; setBurst(p, inst); boardView(); return true; }
      if (!CARDS[inst.id].manifest) return false;
      const ok = await humanManifest(inst); boardView(); return !!ok;
    }
    case 'cadvent': {
      const inst = cadvSources(p).find(x => x.uid === uid); if (!inst) return false;
      const ok = await humanContractAdvent(inst, 'main'); boardView(); return !!ok;
    }
    case 'accel': {
      const inst = handOf(p, uid), idx = Number(it.idx); if (!inst || !accelOK(p, inst, idx, 'MAIN')) return false;
      const r = await humanAccel(inst, idx, 'MAIN');
      if (!r || !seatCan(key)) { boardView(); return false; }
      await useAccel(p, r.inst, r.idx, r.plan, 'MAIN'); boardView(); return true;
    }
    case 'summonRemoved': { const t = removedSummonable(p).find(x => x.uid === uid); if (!t) return false; const ok = await summonFromRemoved(p, t); boardView(); return !!ok; }
    case 'act': {
      const f = fieldOf(p, uid), idx = Number(it.idx); if (!f || !activatable(p, f, 'MAIN').some(x => x.idx === idx)) return false;
      await activateFx(p, f, idx); boardView(); return true;
    }
    case 'bcombine': case 'bseparate': { const f = fieldOf(p, uid); return !!f && intentBraveField(p, f, it.type === 'bseparate'); }
    case 'core': { const f = fieldOf(p, uid); return !!f && CORE_OPS.includes(it.op) && intentCore(p, f, it.op); }
  }
  return false;
}
/* ---- the CPU as a port answerer (any seat; headless default for the human seat) ----
   The CPU seat of the offline game still decides inline (09-cpu.js and the `p.cpu` branches of the effects). */
/** Cores that pay `cost` while `keep` stay in the Reserve: normal Reserve cores first, then spare normal cores of field cards; null when short. */
function cpuPaymentPlan(p, cost, keep) {
  const r = Math.max(0, Math.min(cost, p.reserve.n - (keep || 0)));
  let need = cost - r; const by = {};
  for (const f of fieldList(p).filter(x => !isGW(x)).sort((a, b) => spare(b) - spare(a))) {
    if (need <= 0) break;
    const k = Math.max(0, Math.min(need, freeCores(f), isSpiritForm(CARDS[f.id]) ? spare(f) : f.cores));
    if (k > 0) { by[f.uid] = k; need -= k; }
  }
  return need > 0 ? null : { reserve: r, by };
}
/** The CPU's answer to an action decision: summon what cpuPlayChoice likes, set a Burst, attack by cpuAttackChoice, else NEXT. */
function cpuIntent(key) {
  const p = G.p[key];
  if (isMainStep()) {
    const pays = h => { const c = CARDS[h.id], n = effCost(p, c), L = minCores(c); return reserveTotal(p) >= n + L || !!cpuPaymentPlan(p, n, L); };
    const opts = p.hand.filter(h => (isSpiritForm(CARDS[h.id]) || CARDS[h.id].type === 'Nexus') && CARDS[h.id].type !== 'Brave' && canPlayCard(p, h) && cpuCanPlay(p, h) && pays(h));
    const pick = opts.length ? cpuPlayChoice(p, opts) : null;
    if (pick) return { type: 'summon', uid: pick.uid };
    const b = !p.burstSetThisTurn && !p.burst && p.hand.find(h => CARDS[h.id].burst);
    if (b) return { type: 'burst', uid: b.uid };
  } else if (G.step === 5) {
    const a = cpuAttackChoice(p);
    if (a) return { type: 'attack', uid: a.uid };
  }
  return { type: 'next' };
}
/** A port answerer for any decision record (05b-decide.js kinds + action): what the CPU would pick. */
function cpuAnswer(seat, d) {
  const p = G && G.p[seat];
  switch (d && d.kind) {
    case 'action': return p ? cpuIntent(seat) : { type: 'end' };
    case 'payment': return p ? cpuPaymentPlan(p, d.cost, d.L) : null;
    case 'choice': { const b = (d.buttons || []).find(x => !x.hidden && !x.dis); return b ? b.value : null; }
    case 'pick':
      if (d.cpuK === 'block') {                 // v0.105.0 (M6 step 1): the block pick of a CPU defender (08-battle.js askBlock); a uid, like every pick answer
        const att = (G.p[other(seat)].spirits || []).find(s => s && s.uid === d.mark);
        const b = att ? cpuChooseBlock(p, att) : null;
        return b && b.uid ? b.uid : null;
      }
      if (d.cpuK === 'summon') {                // v0.105.0 (M6 step 2): the summon pick of a CPU main step (09-cpu.js cpuMain)
        const c = cpuPlayChoice(p, summonableOpts(p));
        return c && c.uid != null ? c.uid : null;
      }
      if (d.cpuK === 'activate') {              // v0.105.0 (M6 step 3): the CPU activation pick of the main step (02d-effects-resolve.js cpuActivate)
        for (const f of fieldList(p)) {
          const a = activatable(p, f, 'MAIN').find(x => !x.e.cpuSkip && !x.e.silverWheel && (!x.e.invoke || cpuInvokeOK(p, f, x.e, 'MAIN')));
          if (a) return { uid: f.uid, idx: a.idx };
        }
        return null;
      }
      if (d.cpuK === 'revive') {                // v0.105.0 (M6 step 3): the CPU Revive pick (02d-effects-resolve.js cpuRevive)
        return (reviveTargets(p)[0] || {}).uid ?? null;
      }
      if (d.cpuK === 'advent') {                // v0.105.0 (M6 step 3): the CPU Manifest / Contract Advent pick (02d-effects-resolve.js cpuAdvents)
        for (const h of p.hand.concat(cadvSources(p).filter(x => p.soulState.includes(x)))) {
          const card = CARDS[h.id];
          if (card.manifest) { const T = manifestTargets(p, h); if (T.length) return { uid: h.uid, targetUid: T[0].uid }; }
          else if (card.contractAdvent) {
            const T = contractAdventTargets(p, h, 'main').filter(t => CARDS[h.id].levels[0].bp > CARDS[t.id].levels[0].bp);
            if (T.length) return { uid: h.uid, targetUid: T.sort((a, b) => bpOf(b) - bpOf(a))[0].uid };
          }
        }
        return null;
      }
      if (d.cpuK === 'brave') {                 // v0.105.0 (M6 step 4): the CPU Brave pick (09-cpu.js cpuBrave)
        const strongest = L => L.slice().sort((a, b) => bpOf(b) - bpOf(a))[0];
        const fb = p.spirits.find(b => CARDS[b.id].brave && braveTargets(p, b).length);
        if (fb) return { mode: 'combine', uid: fb.uid, targetUid: strongest(braveTargets(p, fb)).uid };
        const hb = p.hand.find(h => CARDS[h.id].brave && h !== p.burst && braveTargets(p, h).length && cpuCanPlay(p, h));
        if (hb) return { mode: 'summon', uid: hb.uid, targetUid: strongest(braveTargets(p, hb)).uid };
        return null;
      }
      if (d.cpuK === 'attack') return (cpuAttackChoice(p) || {}).uid ?? null;   // v0.105.0 (M6 step 4): the CPU attacker pick (09-cpu.js cpuAttack)
      return d.uids && d.uids.length ? d.uids[0] : (d.buttons && d.buttons[0] ? d.buttons[0].value : null);
    default: return null;
  }
}
