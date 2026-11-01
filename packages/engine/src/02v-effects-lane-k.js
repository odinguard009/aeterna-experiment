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
/* v277 OWN_CORES_TO_TRASH {total} / OPP_SELF_CORES_TO_TRASH {total}: "By sending N cores from your Spirits to the Trash, ..." (cost; ctx.did = false when your Spirits hold fewer than N)
   and "The opponent sends N cores from their Spirits to their Trash" (the opponent chooses; the CPU gives up cores from its lowest-BP Spirit first). */
async function coresFromSpirits(c, q, total, exact) {
  const nm = CARDS[c.src.id].name, held = () => q.spirits.reduce((n, x) => n + Math.max(0, x.cores), 0);
  if (exact && held() < total) return 0;
  let moved = 0;
  for (let j = 0; j < total; j++) {
    const L = q.spirits.filter(x => x.cores > 0); if (!L.length) break;
    const t = q.cpu ? L.slice().sort((x, y) => bpOf(x) - bpOf(y))[0] : await fxPickTarget({ p: q, opp: q === c.p ? c.opp : c.p, src: c.src, ctx: c.ctx }, L, `✨ <b>${esc(nm)}</b><br>Tap a Spirit of yours to send a core to the Trash (${j + 1}/${total}).`);
    if (!t) break;
    const m = Math.min(1, t.cores, coreTakeCap(q, t, 1)); if (!m) continue;
    coreEvN(q, t.uid, 'trash', m, false); t.cores -= m; q.trashCores.n += m; moved += m;
    log(`${nm}: 1 core from ${poss(q)} ${CARDS[t.id].name} goes to the Trash.`);
  }
  io.view({ type: 'board' }); return moved;
}
Object.assign(FX_ACTIONS, {
  OWN_CORES_TO_TRASH: { chk: a => Number.isInteger(a.total) && a.total >= 1 && a.total <= 8 && Object.keys(a).every(k => ['do', 'if', 'total'].includes(k)),
    txt: a => `send ${a.total} core${a.total === 1 ? '' : 's'} from your Spirits to the Trash`,
    can: (c, a) => c.p.spirits.reduce((n, x) => n + Math.max(0, x.cores), 0) >= a.total,
    run: async (c, a) => { c.ctx.did = (await coresFromSpirits(c, c.p, a.total, true)) === a.total; } },
  OPP_SELF_CORES_TO_TRASH: { chk: a => Number.isInteger(a.total) && a.total >= 1 && a.total <= 8 && Object.keys(a).every(k => ['do', 'if', 'total'].includes(k)),
    txt: a => `the opponent sends ${a.total} core${a.total === 1 ? '' : 's'} from their Spirits to their Trash`,
    can: () => true,
    run: async (c, a) => { c.ctx.did = (await coresFromSpirits(c, c.opp, a.total, false)) > 0; } },
});
