/* ---------------------------------------------------------------------
   TURN FLOW
   --------------------------------------------------------------------- */
const isMainStep = () => !!G && (G.step === 4 || (G.format === 'standard' && G.step === 6));   // moved from 11-human.js (v0.82.0)
function setStep(i) { G.step = i; checkDepletion(G.p.player); checkDepletion(G.p.opponent); io.view({ type: 'board' }); }
async function beginTurn(key) {
  const p = G.p[key];
  G.active = key; G.turnNo++; p.burstSetThisTurn = false; p.mirageSetThisTurn = false; p.attacksThisTurn = 0; G.p.player.blocksThisTurn = G.p.opponent.blocksThisTurn = 0; G.burstQ.length = 0; releaseStandby(true); G.evQ.length = 0;
  log(`— Turn ${G.turnNo}: ${p.name} —`);
  setStep(0); await wait(300);
  if (p.deck.length === 0) { win(other(key), `${poss(p)} deck is empty at the start step`); return; }
  setStep(1);
  if (G.turnNo === 1) log('First turn: the Core Step is skipped.');
  else {
    io.view({ type: 'core', side: key, kind: 'core', from: 'void', to: 'reserve' });   // v0.138.0: display cue, the old board still shows the core in the Void
    takeFromVoid(p, 1); p.reserve.n++; log(`${who(p)} ${p.cpu ? 'adds' : 'add'} 1 core from the Void to the Reserve.`);   // Comprehensive Rules 7-3-2
    io.view({ type: 'board' });
  }
  await wait(450);
  setStep(2); io.view({ type: 'draw', side: key }); const dn = 1 + drawPlusOf(p); draw(p, dn); log(`${who(p)} ${p.cpu ? 'draws' : 'draw'} ${dn === 1 ? 'a card' : dn + ' cards'}.`); io.view({ type: 'board' }); if (!G.over) { await fireFx(p, 'DRAW_STEP', null, {}); await flushBursts(); }      // v0.199 "(Your Draw Step)" effects
  await wait(450);
  setStep(3);
  const back = Math.min(p.trashCores.n + (p.trashCores.soul ? 1 : 0), 5);
  for (let i = 0; i < back; i++) io.view({ type: 'core', side: key, kind: i === back - 1 && p.trashCores.soul ? 'soul' : 'core', from: 'trash', to: 'reserve', nth: i });
  for (const f of fieldList(p)) if (!(f.noRefreshT && f.noRefreshT === G.turnNo)) refreshOne(f); else log(`${CARDS[f.id].name} can't refresh this Refresh Step.`);
  p.reserve.n += p.trashCores.n; p.trashCores.n = 0;
  if (p.trashCores.soul) { p.reserve.soul = true; p.trashCores.soul = false; }
  log('Refresh Step: cards refreshed, Trash cores returned to the Reserve.');
  io.view({ type: 'board' });
  await wait(450);
  setStep(4);
  if (!G.over) { await fireFx(p, 'START_MAIN', null, {}); await flushBursts(); checkDepletion(G.p.player); checkDepletion(G.p.opponent); io.view({ type: 'board' }); }      // v0.197 "(Start of Your Main Step)" effects
}
async function endStep(key) {
  setStep(G.steps.length - 1);
  if (!G.over) { await fireFx(G.p[key], 'END_STEP', null, {}); await flushBursts(); checkDepletion(G.p.player); checkDepletion(G.p.opponent); }      // v0.169 "(Your End Step)" effects, before the "during this turn" effects end
  if (G.over) return;
  for (const k of ['player', 'opponent']) for (const f of fieldList(G.p[k])) { f.bpMod = 0; f.lv2Turn = false; if (f.noABTurn != null) { f.noAB = false; f.noABTurn = null; } }   // v0.88 S1: "during this turn, can't attack/block" ends
  log(`${who(G.p[key])} ${G.p[key].cpu ? 'ends' : 'end'} the turn.`);
  await wait(300);
}
function win(key, why) {
  if (G.over) return;
  G.over = true; G.winner = key; G.busy = true;
  log(`${who(G.p[key])} ${G.p[key].cpu || key === 'opponent' ? 'wins' : 'win'}: ${why}.`);
  if (G.rec) G.rec.final = matchSummary();
  if (G.prec) G.prec.final = matchSummary();
  io.view({ type: 'board' });
  if (G.turnResolver) { const r = G.turnResolver; G.turnResolver = null; r(); }
  io.view({ type: 'matchEnd', winner: key });   // web host: history entry + game-over dialog (not in ?sim=1)
}
async function matchLoop() {
  const my = SESSION;
  try {
    while (!G.over && SESSION === my) {
      const key = G.next, p = G.p[key];
      await beginTurn(key);
      if (G.over) break;
      if (p.cpu) { G.busy = true; io.view({ type: 'board' }); await cpuTurn(p); }
      else { await seatTurn(key); G.busy = true; }       // v0.84.0: the seat's board actions are intents through io.decide (05c-intent.js)
      if (G.over || SESSION !== my) break;
      await endStep(key);
      G.next = other(key);
    }
  } catch (e) { if (e !== ABORT) throw e; }
}
/* rules invariants (cores, Soul Core, cards) checked by tests and sims; moved from 13-render.js in v0.82.0 */
function checkInvariants() {
  for (const k of ['player', 'opponent']) {
    const p = G.p[k], fc = fieldList(p).reduce((s, i) => s + i.cores, 0);
    const normal = p.life - (p.lifeSoul ? 1 : 0) + p.reserve.n + p.trashCores.n + p.count + p.void + fc;
    if (normal !== p.made) throw new Error(`Core mismatch for ${p.name}: ${normal}`);
    const soul = (p.reserve.soul ? 1 : 0) + (p.lifeSoul ? 1 : 0) + (p.trashCores.soul ? 1 : 0) + fieldList(p).filter(i => i.soul).length;
    if (soul !== 1) throw new Error(`Soul Core count for ${p.name}: ${soul}`);
    const cards = p.deck.length + p.hand.length + p.spirits.filter(i => !i.token).length + p.nexus.length + p.soulState.length + p.standby.length + p.trash.length + p.removed.length + (p.burst ? 1 : 0) + (p.mirage ? 1 : 0) + (p.limbo ? 1 : 0) + p.revealed.length + fieldList(p).reduce((s, i) => s + i.under.length + (i.brave ? 1 : 0), 0);
    if (cards !== p.deckSize) throw new Error(`Card mismatch for ${p.name}: ${cards} vs ${p.deckSize}`);
    for (const s of p.spirits) if (totalCores(s) < CARDS[s.id].levels[0].cores) throw new Error(`Undepleted spirit ${CARDS[s.id].name}`);
    if (p.void < 0 || p.count < 0 || p.reserve.n < 0) throw new Error(`Negative core zone for ${p.name}`);
    for (const x of p.soulState) if (!x.inSoulState) throw new Error(`Soul State flag for ${CARDS[x.id].name}`);
  }
}
