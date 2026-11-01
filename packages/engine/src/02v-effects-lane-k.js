/* Lane K actions added after 02p reached its size budget (one file per ~60 KB, tests/unit/budget.test.mjs B08). */
/* v274 DESTROY_OPP_OWN: "The opponent destroys a Spirit they control." (the opponent chooses: the CPU gives up its weakest, a human taps one; ctx.did = false when they control none). */
FX_ACTIONS.DESTROY_OPP_OWN = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'the opponent destroys one Spirit they control',
  can: c => c.opp.spirits.length > 0,
  run: async (c, a) => {
    const L = c.opp.spirits.slice(); if (!L.length) { c.ctx.did = false; return; }
    const t = c.opp.cpu ? L.sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
      : await fxPickTarget(Object.assign({}, c, { p: c.opp }), L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Choose one of your Spirits to destroy (glowing).`);
    if (!t || !c.opp.spirits.includes(t)) { c.ctx.did = false; return; }
    log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} is destroyed (the opponent chose it).`);
    removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp);
  } };
/* v274 OWN_LIFE_TO_VOID {n}: cost "By sending a core from your Life to the Void, ..." (the Soul Core can't go to the Void, so a lone sealed Soul Core in the Life can't pay; ctx.did = false then). */
FX_ACTIONS.OWN_LIFE_TO_VOID = {
  chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 2 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `send ${a.n} core${a.n === 1 ? '' : 's'} from your Life to the Void`,
  can: (c, a) => c.p.life - (c.p.lifeSoul ? 1 : 0) >= a.n,
  run: async (c, a) => {
    if (c.p.life - (c.p.lifeSoul ? 1 : 0) < a.n) { c.ctx.did = false; return; }
    coreEvN(c.p, 'life', 'void', a.n, false); c.p.life -= a.n; c.p.void += a.n; c.p.lifeRedTurn = G.turnNo;
    log(`${CARDS[c.src.id].name}: ${a.n} core${a.n === 1 ? '' : 's'} move from ${poss(c.p)} Life to the Void.`); io.view({ type: 'board' });
    if (c.p.life <= 0) { win(c.opp.key, `${poss(c.p)} Life reached 0`); return; }
    await maybeBurst(c.p, 'LIFE_DECREASE', {});
  } };
/* v275 HAND_TO_REMOVED {match}: cost "By putting a <X> card from your Hand face-up onto the Removed Zone, ..." (ctx.did = false when the Hand has no such card). */
FX_ACTIONS.HAND_TO_REMOVED = {
  chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
  txt: () => 'put a matching card from your Hand face-up onto the Removed Zone',
  cands: (c, a) => c.p.hand.filter(h => h !== c.src && fxMatch(CARDS[h.id], a.match)),
  can: (c, a) => FX_ACTIONS.HAND_TO_REMOVED.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.HAND_TO_REMOVED.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const d = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, 'Choose a card from your Hand to put onto the Removed Zone.', false);
    if (!d || !c.p.hand.includes(d)) { c.ctx.did = false; return; }
    removeFrom(c.p.hand, d); c.p.removed.push(d);
    if (G && G.evQ && !G.over) G.evQ.push({ type: 'REMOVED', key: c.p.key });
    log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'puts' : 'put'} ${CARDS[d.id].name} face-up onto the Removed Zone.`); io.view({ type: 'board' });
  } };
