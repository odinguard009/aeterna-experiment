/* ---------------------------------------------------------------------
   v0.50 KEYWORD EFFECTS part 2 (session D): Accel and Silver Wheel.
   Accel (Fandom "Accel" page, Q1-Q8; the Eternal manual text read has no Accel section): an effect printed "Main/Flash - Accel Cost X
   (reductions)" is used from the Hand at that timing (a Flash one also in your Main Step) by paying X. Field symbols reduce it (Q4), effects
   that change the cost of Hand Spirits do not (Q8). After it resolves the card is revealed and put onto the Removed Zone (Q1, Q3). A Spirit
   in the Removed Zone can be summoned in your Main Step by paying its cost (Q5); its Accel can't be used from there (Q6). Accel is a Spirit
   effect, so locks on Magic cards do not stop it (Q2).
   Data: an effect {"trigger":"ACCEL","cost":4,"timing":["FLASH"],"actions":[...]} (optional "reduction" {"white":2}: the Fandom export
   loses the reduction icons of the Accel cost, so cards carry none until they are checked; the full cost is paid).
   Silver Wheel: ACTIVATE {"silverWheel":true,"timing":["MAIN","FLASH"],"cost":{"exhaustSelf":true},"once":false}; after it resolves,
   trigger SILVER_WHEEL ("when you activate Silver Wheel") fires on your field cards and on zone:"hand" cards.
   --------------------------------------------------------------------- */
const accelList = card => (card && card.effects || []).map((e, idx) => ({ e, idx })).filter(x => x.e.trigger === 'ACCEL');
const accelCost = (p, e) => Math.max(0, e.cost - (e.reduction ? reductionOf({ reduction: e.reduction }, fieldSymbols(p, false, true)) : 0));
const accelMainStep = p => !!G && !G.over && G.active === p.key && (G.step === 4 || (G.format === 'standard' && G.step === 6));
/* timing 'MAIN' = your Main Step (Main and Flash Accel), 'FLASH' = a Flash Timing (Flash Accel only) */
function accelOK(p, inst, idx, timing) {
  if (!G || G.over || !p.hand.includes(inst)) return false;
  const e = (CARDS[inst.id].effects || [])[idx]; if (!e || e.trigger !== 'ACCEL') return false;
  if (timing === 'FLASH' ? !e.timing.includes('FLASH') : !accelMainStep(p)) return false;
  if (e.once && usedThisTurn(p, inst, idx, e)) return false;
  const opp = G.p[other(p.key)], ctx = {};
  if (!fxIf(p, opp, e.if, ctx)) return false;
  if (accelCost(p, e) > coresAvailable(p)) return false;
  return fxCan({ p, opp, src: inst, ctx }, e);
}
function accelSources(p, timing) {
  const out = [];
  for (const h of p.hand) for (const { e, idx } of accelList(CARDS[h.id])) if (accelOK(p, h, idx, timing)) out.push({ inst: h, idx, e });
  return out;
}
const accelLabel = (p, x) => `⚡ Accel: ${CARDS[x.inst.id].name} (Pay ${accelCost(p, x.e)}) — ${fxDescribe(x.e)}`.slice(0, 150);
async function useAccel(p, inst, idx, plan, timing) {
  if (!accelOK(p, inst, idx, timing || (accelMainStep(p) ? 'MAIN' : 'FLASH'))) return false;
  const card = CARDS[inst.id], e = card.effects[idx], c = accelCost(p, e), opp = G.p[other(p.key)];
  removeFrom(p.hand, inst);
  payCost(p, c, plan);
  if (e.once) markUsed(p, inst, idx, e);
  log(`${who(p)} ${p.cpu ? 'uses' : 'use'} the Accel effect of ${card.name} (paid ${c}): ${fxDescribe(e)}.`);
  checkDepletion(p);
  const prev = p.limbo; p.limbo = inst;                    // the card is revealed while its effect resolves (in no zone)
  try { io.view({ type: 'board' }); await wait(300); await asResolving(() => runActions({ p, opp, src: inst, ctx: {} }, e, 'ACCEL')); }
  finally { if (p.limbo === inst) p.limbo = prev; }
  if (G && !p.removed.includes(inst)) { toRemoved(p, inst); log(`${card.name} is put onto the Removed Zone (Accel).`); }
  checkDepletion(p); checkDepletion(opp);
  io.view({ type: 'board' }); await wait(300); await flushBursts();
  return true;
}
/* Fandom Q5: an Accel Spirit in your Removed Zone can be summoned in your Main Step by paying its cost */
const removedSummonable = p => accelMainStep(p) ? p.removed.filter(x => isSpiritForm(CARDS[x.id]) && accelList(CARDS[x.id]).length > 0 && canPlacePaid(p, x)) : [];
async function summonFromRemoved(p, inst) {
  if (!removedSummonable(p).includes(inst)) return false;
  log(`${who(p)} ${p.cpu ? 'summons' : 'summon'} ${CARDS[inst.id].name} from the Removed Zone.`);
  const ok = await summonPaid(p, inst);
  if (ok) await flushBursts();
  return ok;
}
/* v0.183 Immortality: when your Spirit is destroyed in an Attack Step, an Immortality Spirit card in your Trash whose printed Cost / family matches can be summoned by paying its cost */
const immortalCands = (p, dead) => { const k = CARDS[dead.id]; return p.trash.filter(x => isSpiritForm(CARDS[x.id]) && (CARDS[x.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'IMMORTALITY' && (e.costIn ? e.costIn.includes(k.cost) : (k.families || []).includes(e.family))) && canPlacePaid(p, x)); };
async function immortalOffer(p, dead) {
  const L = immortalCands(p, dead); if (!L.length) return;
  const pick = await chooseCard({ p }, L, 'Immortality', `Pay the cost to summon an Immortality Spirit card from your Trash (${CARDS[dead.id].name} was destroyed).`, true);
  if (!pick) return;
  log(`${who(p)} ${p.cpu ? 'summons' : 'summon'} ${CARDS[pick.id].name} from the Trash (Immortality).`);
  await summonPaid(p, pick);
}
/* human */
async function humanAccel(inst, idx, timing) {
  const p = G.p.player, x = { inst, idx, e: CARDS[inst.id].effects[idx] };
  if (!accelOK(p, inst, idx, timing)) return null;
  const c = accelCost(p, x.e); let plan = null;
  if (c > 0 && reserveTotal(p) < c) { plan = await askPayment(CARDS[inst.id], c, 0); if (!plan) return null; }
  return { inst, idx, plan };
}
/* CPU: score an Accel effect for the current board (0 = not worth it) */
function cpuAccelScore(p, x, att, blk) {
  const opp = G.p[other(p.key)], c = { p, opp, src: x.inst, ctx: { attacker: att } }, isAtt = G.active === p.key;
  const can = a => !FX_ACTIONS[a.do].can || FX_ACTIONS[a.do].can(c, a);
  let sc = 0;
  for (const a of x.e.actions) {
    if (a.if && a.if.prev != null) continue;
    if (a.do === 'BOUNCE_OPP' && can(a)) {
      const L = FX_ACTIONS.BOUNCE_OPP.cands(c, a);
      if (!att) sc = Math.max(sc, 6);
      else if (!isAtt && L.includes(att)) sc = Math.max(sc, 9);           // return the attacker
      else if (isAtt && blk && L.includes(blk) && bpOf(blk) >= bpOf(att)) sc = Math.max(sc, 8);
    } else if (a.do === 'END_ATTACK_AFTER_BATTLE' && can(a)) {
      if (!isAtt && att && opp.spirits.some(sp => sp !== att && !sp.exhausted && !sp.noAB)) sc = Math.max(sc, 7);
    } else if (a.do === 'DISCARD_OPP_BURST') {
      if (opp.burst && (isAtt || !att)) sc = Math.max(sc, 5);
    } else if ((a.do === 'LOOT' || a.do === 'DRAW') && !att && p.deck.length > 6 && p.hand.length <= 6) sc = Math.max(sc, 4);
  }
  return sc;
}
async function cpuAccelMain(p) {
  for (let g = 0; g < 3 && !G.over; g++) {
    const L = accelSources(p, 'MAIN').filter(x => !x.e.cpuSkip && x.e.timing.includes('MAIN') && accelCost(p, x.e) <= reserveTotal(p))
      .map(x => ({ x, sc: cpuAccelScore(p, x, null, null) })).filter(y => y.sc > 0).sort((a, b) => b.sc - a.sc);
    if (!L.length) break;
    await useAccel(p, L[0].x.inst, L[0].x.idx, null, 'MAIN');
  }
}
function cpuAccelFlash(p, att, blk) {
  const L = accelSources(p, 'FLASH').filter(x => !x.e.cpuSkip && accelCost(p, x.e) <= reserveTotal(p))
    .map(x => ({ x, sc: cpuAccelScore(p, x, att, blk) })).filter(y => y.sc >= 7).sort((a, b) => b.sc - a.sc);
  return L.length ? { accel: { inst: L[0].x.inst, idx: L[0].x.idx, plan: null } } : null;
}
/* CPU Silver Wheel: only as the defender after the block, on a Spirit that is not blocking, while another blocker stays ready or Life is safe */
function cpuSilverWheel(p, attKey, att, blk) {
  if (p.key === attKey || !blk || !att) return null;
  for (const f of fieldList(p)) {
    if (f === blk) continue;
    const x = activatable(p, f, 'FLASH').find(y => y.e.silverWheel && !y.e.cpuSkip); if (!x) continue;
    const others = p.spirits.filter(s => s !== f && s !== blk && !s.exhausted && !s.noAB).length;
    if (others >= 1 || p.life >= 4 || CARDS[f.id].type === 'Nexus') return { act: { f, idx: x.idx } };
  }
  return null;
}
