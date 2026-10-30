/* ---------------------------------------------------------------------
   CPU
   --------------------------------------------------------------------- */
/* cpuChooseBlock, cpuPlayChoice and cpuAttackChoice: evaluation policy in 09a-cpu-eval.js */
/* the CPU only plays cards it can pay for without depleting its own Spirits */
function cpuCanPlay(p, inst) {
  const c = CARDS[inst.id];
  const free = reserveTotal(p) + fieldList(p).reduce((s, f) => s + Math.max(0, Math.min(spare(f), freeTotal(f))), 0);
  return summonOK(p, c) && effCost(p, c) + minCores(c) <= free;
}
function cpuLevelUp(p) {
  for (let g = 0; g < 30 && p.reserve.n > 0; g++) {
    let best = null;
    for (const f of p.spirits) {
      const k = lvIndex(f), L = CARDS[f.id].levels;
      if (k + 1 >= L.length) continue;
      const need = L[k + 1].cores - totalCores(f);
      if (need <= 0 || need > p.reserve.n) continue;
      const ratio = (L[k + 1].bp - L[k].bp) / need;
      if (!best || ratio > best.ratio) best = { f, need, ratio };
    }
    if (!best) break;
    p.reserve.n -= best.need; best.f.cores += best.need;
    log(`${p.name} levels up ${CARDS[best.f.id].name} to Lv${lvNo(best.f)}.`);
  }
}
/* CPU Flash: defender answers an attacker, attacker answers a blocker; cheap heuristics */
function cpuBurstFlash(p, inst, ctx) {                     // v0.44: pay after the Burst? Only when the Flash effect does something useful now
  const m = magicFx(CARDS[inst.id], ctx || 'flash'), acts = (m && m.actions) || [], opp = G.p[other(p.key)];
  if (acts.some(a => a.do === 'LOOT')) return acts.some(a => a.do === 'LOOT' && a.discardLessPerName && fieldList(p).some(f => CARDS[f.id].name.toLowerCase().includes(a.discardLessPerName.toLowerCase())));   // v0.47 Dana Draw: only a net gain of cards
  if (acts.some(a => a.do === 'END_ATTACK_AFTER_BATTLE')) return G.active !== p.key && !!G.attacker && opp.spirits.some(sp => sp !== G.attacker && !sp.exhausted && !sp.noAB);
  if (acts.some(a => a.do === 'SYMBOL_PLUS_TURN')) return G.active === p.key && p.spirits.some(sp => !sp.exhausted && acts.some(a => a.do === 'SYMBOL_PLUS_TURN' && (!a.match || fxMatch(CARDS[sp.id], a.match))));
  return true;
}
function cpuFlashChoice(p, attKey, att, blk) {
  const isAtt = p.key === attKey, opp = G.p[other(p.key)];
  const hs = cpuHighSpeed(p, attKey, att, blk); if (hs) return { hs };   // v0.49 High Speed
  const ac = cpuAccelFlash(p, att, blk); if (ac) return ac;              // v0.50 Accel
  const sw = cpuSilverWheel(p, attKey, att, blk); if (sw) return sw;     // v0.50 Silver Wheel
  for (const h of magicSources(p, 'flash')) {
    const card = CARDS[h.id], m = magicFxAt(p, h, 'flash');
    if (card.type !== 'Magic' || !m || !m.effect || !card.magic.timing.includes('FLASH')) continue;
    if (!magicUsable(p, h, 'flash') || !cpuCanPlay(p, h)) continue;
    const foe = isAtt ? blk : att, mine = isAtt ? att : blk;
    if (m.effect === 'DESTROY_BP_LE') {
      if (foe && opp.spirits.includes(foe) && MAGIC_FX.DESTROY_BP_LE.ok(foe, m.value) && (isAtt ? bpOf(foe) >= bpOf(att) : true)) return { inst: h, target: foe, plan: null };
    } else if (m.effect === 'BP_PLUS' || m.effect === 'BP_PLUS_MATCH') {
      if (blk && mine && p.spirits.includes(mine) && foe && bpOf(mine) <= bpOf(foe) && bpOf(mine) + m.value > bpOf(foe) && (m.effect === 'BP_PLUS' || MAGIC_FX.BP_PLUS_MATCH.ok(mine, m.value, m))) return { inst: h, target: mine, plan: null, ctx: 'flash' };
    } else if (m.effect === 'ACTIONS' && m.actions.some(a => a.do === 'SYMBOL_PLUS_TURN')) {   // v0.44 Magma Call: an extra symbol on the unblocked attacker
      if (isAtt && !blk && att && p.spirits.includes(att) && m.actions.some(a => a.do === 'SYMBOL_PLUS_TURN' && (!a.match || fxMatch(CARDS[att.id], a.match)))) return { inst: h, target: null, plan: null, ctx: 'flash' };
    } else if (m.effect === 'ACTIONS' && m.actions.some(a => a.do === 'END_ATTACK_AFTER_BATTLE')) {   // v0.43: worth it as the defender when more attackers are ready
      if (!isAtt && att && opp.spirits.some(sp => sp !== att && !sp.exhausted && !sp.noAB)) return { inst: h, target: null, plan: null, ctx: 'flash' };
    } else if (m.effect === 'ACTIONS') {
      if (isAtt ? (blk && foe && bpOf(foe) >= bpOf(att)) : (att && p.life <= 3)) return { inst: h, target: null, plan: null, ctx: 'flash' };
    } else if (m.effect === 'EXHAUST_OPP') {
      const rdy = opp.spirits.filter(sp => !sp.exhausted && !sp.noAB);
      if (isAtt && !blk && rdy.length === 1 && bpOf(rdy[0]) >= bpOf(att)) return { inst: h, target: rdy[0], plan: null };
    }
  }
  /* Contract Advent onto the fighting Spirit when it turns a lost/tied fight into a win */
  const mine0 = isAtt ? att : blk, foe0 = isAtt ? blk : att;
  if (mine0 && foe0 && p.spirits.includes(mine0) && bpOf(mine0) <= bpOf(foe0)) {
    for (const h of cadvSources(p)) {
      if (!contractAdventTargets(p, h, 'flash').includes(mine0)) continue;
      const k = CARDS[h.id]; if (k.type !== 'Spirit' || k.levels[0].bp <= bpOf(mine0)) continue;
      const lvl = k.levels.filter(l => l.cores <= mine0.cores).pop() || k.levels[0];
      if (lvl.bp + (mine0.bpMod || 0) > bpOf(foe0)) return { cadv: h, target: mine0 };
    }
  }
  /* Manifest in the Attack Step when the card's When-Manifests effect has something to hit */
  for (const h of p.hand) {
    if (!CARDS[h.id].manifest) continue;
    const T = manifestTargets(p, h, 'flash'); if (!T.length) continue;
    const hits = (CARDS[h.id].effects || []).some(e => e.trigger === 'MANIFEST') ? opp.spirits.length > 0 : true;
    if (hits) return { manifest: h, target: T.sort((a, b) => b.cores - a.cores)[0] };
  }
  /* Flash effects of the field cards that are clearly useful */
  for (const f of fieldList(p)) {
    for (const x of activatable(p, f, 'FLASH')) {
      if (x.e.cpuSkip) continue;
      if (x.e.invoke) { if (cpuInvokeOK(p, f, x.e, 'FLASH')) return { act: { f, idx: x.idx } }; continue; }   // v0.68 Invoke (02l)
      const doesSummon = x.e.actions.some(a => a.do === 'SOUL_SUMMON'), doesEnter = x.e.actions.some(a => a.do === 'SOUL_ENTER' || a.do === 'COUNTER');
      if (doesSummon && p.spirits.length < 6 && p.soulState.some(sc => canPlaceFree(p, sc) && CARDS[sc.id].type === 'Spirit')) return { act: { f, idx: x.idx } };
      if (!doesSummon && doesEnter) return { act: { f, idx: x.idx } };
    }
  }
  return null;
}
/* CPU Main: cast Main Magic that is clearly worth it (Flash-only Magic is held for battles) */
/* v0.105.0 (M6 step 2): the summonable options of a CPU seat - the builder the site and cpuAnswer (05c-intent.js) share */
function summonableOpts(p) {
  return p.hand.filter(h => cpuCanPlay(p, h) && h !== p.burst && (CARDS[h.id].type !== 'Brave' || isSpiritForm(CARDS[h.id]))).concat(removedSummonable(p).filter(h => cpuCanPlay(p, h)));   // v0.50: Accel Spirits from the Removed Zone
}
async function cpuCastMain(p) {
  for (let g = 0; g < 4 && !G.over; g++) {
    let best = null;
    for (const h of p.hand) {
      const card = CARDS[h.id], m = magicFx(card, 'main');
      if (card.type !== 'Magic' || !m || !m.effect || !card.magic.timing.includes('MAIN') || !cpuCanPlay(p, h) || !magicUsable(p, h, 'main')) continue;
      let sc = 0, target = null;
      if (m.effect === 'DESTROY_BP_LE') { const t = magicTargets(p, h, 'main').sort((a, b) => bpOf(b) - bpOf(a))[0]; if (t) { target = t; sc = 10 + bpOf(t) / 1000; } }
      else if (m.effect === 'REVEAL_ADD' && p.deck.length > m.value + 4 && p.hand.length <= 6) sc = 6;
      else if (m.effect === 'DRAW' && p.deck.length > m.value + 4 && p.hand.length <= 6) sc = 5;
      else if (m.effect === 'ACTIONS' && p.deck.length > 6) sc = 4;
      if (sc > 0 && (!best || sc > best.sc)) best = { sc, ch: { inst: h, target, plan: null, ctx: 'main' } };
    }
    if (!best) break;
    await castMagic(p, best.ch); io.view({ type: 'board' }); await wait(600); await flushBursts();
  }
}
async function cpuMain(p) {
  await cpuCastMain(p);
  await cpuAccelMain(p);                                                 // v0.50 Accel
  await cpuActivate(p);
  await cpuRevive(p);
  await cpuAdvents(p);
  if (!p.mirageSetThisTurn && !p.mirage) {
    const mh = p.hand.find(h => CARDS[h.id].mirage && (CARDS[h.id].effects || []).some(e => e.trigger === 'MIRAGE_OWN_LIFE' || e.trigger === 'MIRAGE_OPP_LIFE') && CARDS[h.id].mirage.cost <= reserveTotal(p) && mirageUsable(p, h));
    if (mh) { removeFrom(p.hand, mh); payCost(p, CARDS[mh.id].mirage.cost, null); checkDepletion(p); setBurst(p, mh, true); io.view({ type: 'board' }); await wait(400); }
  }
  if (!p.burstSetThisTurn && !p.burst) { const b = p.hand.find(h => CARDS[h.id].burst); if (b) { setBurst(p, b); io.view({ type: 'board' }); await wait(400); } }
  for (let g = 0; g < 14 && !G.over; g++) {
    const opts = summonableOpts(p);                                       // v0.105.0 (M6 step 2): shared with the cpuAnswer summon route
    if (!opts.length) break;
    const pick = await portPick(p.key, 'summon', opts);
    if (!pick) break;
    summon(p, pick, null); await tributePay(p, pick); io.view({ type: 'board' }); await wait(450);
    await fireFx(p, 'SUMMONED', pick);
    await cpuActivate(p);
  }
  await cpuBrave(p);
  cpuLevelUp(p); io.view({ type: 'board' }); await wait(350);
}
/* Brave: combine a Brave from the Hand (direct summon) or from the Field with the strongest fitting Spirit (manual p. 34-35) */
async function cpuBrave(p) {
  for (let g = 0; g < 6 && !G.over; g++) {
    const v = await portCpu(p.key, 'brave', []);                        // v0.105.0 (M6 step 4): the host's cpuAnswer re-derives {mode, uid, targetUid}
    if (!v || (v.mode !== 'combine' && v.mode !== 'summon')) break;
    const src = (v.mode === 'combine' ? p.spirits : p.hand).find(x => x.uid === v.uid);
    const tg = src && v.targetUid != null ? braveTargets(p, src).find(x => x.uid === v.targetUid) : null;
    if (!src || !tg) break;
    if (v.mode === 'combine') { combineBrave(p, src, tg); io.view({ type: 'board' }); await wait(400); }
    else { braveSummon(p, src, tg, null); io.view({ type: 'board' }); await braveSummonedFx(p, src); await wait(450); }
  }
}
async function cpuAttack(p) {
  for (let g = 0; g < 14 && !G.over; g++) {
    const v = await portCpu(p.key, 'attack', []);                       // v0.105.0 (M6 step 4): the host's cpuAnswer re-derives the attacker uid
    const choice = v ? p.spirits.find(s => s.uid === v) : null;
    if (!choice) break;
    await doBattle(p.key, choice);
    await wait(450);
    if (attackStepOver()) break;
  }
}
async function startAttackFx(p) { await fireFx(p, 'START_ATTACK', null, {}); if (!G.over) await fireFx(G.p[other(p.key)], 'OPP_START_ATTACK', null, {}); await flushBursts(); if (!G.over) await oppAttackHandFx(G.p[other(p.key)]); checkDepletion(p); checkDepletion(G.p[other(p.key)]); io.view({ type: 'board' }); }
async function cpuTurn(p) {
  await wait(500);
  await cpuMain(p);
  if (G.over) return;
  if (G.turnNo > 1) {
    setStep(5); await wait(300); await startAttackFx(p); if (G.over) return; await cpuAttack(p);
    if (G.over) return;
    if (G.format === 'standard') { setStep(6); await wait(300); await cpuMain(p); }
  }
}

