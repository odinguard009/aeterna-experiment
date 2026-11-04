/* Lane K, Grandwalker Khaos family (勇傑 / 原初): mechanics added for those cards. Each block names its version in docs/ai/effect-format.md. */
/* v476 STATIC SET_UNAFFECTED: "this set card is unaffected by opposing effects" while the card is the owner's set Burst (its conditions, e.if, are checked for the owner; no level) */
const burstSetSafe = owner => { const b = owner && owner.burst; if (!b || b.mirage || !G) return false;
  const opp = G.p[other(owner.key)];
  return (CARDS[b.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'SET_UNAFFECTED' && fxIf(owner, opp, e.if, {})); };
/* v476 OPP_REMOVE_HAND_RANDOM {thenVoidSelf?}: "Put a random card from the opposing Hand onto their Removed Zone[, and when any Spirit/Ultimate card is put, put N cores from the Void to this Spirit]" (hand-protected cards are skipped; ctx.removedCards) */
FX_ACTIONS.OPP_REMOVE_HAND_RANDOM = {
  chk: a => (a.thenVoidSelf == null || (Number.isInteger(a.thenVoidSelf) && a.thenVoidSelf >= 1 && a.thenVoidSelf <= 5)) && Object.keys(a).every(k => ['do', 'if', 'thenVoidSelf'].includes(k)),
  txt: a => 'put a random card from the opposing Hand onto their Removed Zone' + (a.thenVoidSelf ? `; when a Spirit/Ultimate card is put, put ${a.thenVoidSelf} cores from the Void to this Spirit` : ''),
  can: c => c.opp.hand.some(h => !handSafe(h, c.opp, c)),
  run: async (c, a) => {
    const L = c.opp.hand.filter(h => !handSafe(h, c.opp, c)); c.ctx.removedCards = [];
    if (!L.length) { c.ctx.did = false; return; }
    const t = L[Math.floor(rng() * L.length)]; fromHandRemoved(c.opp, t); c.ctx.removedCards.push(t);
    log(`${_nm(c)}: a random card from ${poss(c.opp)} Hand goes onto their Removed Zone (${CARDS[t.id].name}).`);
    io.view({ type: 'board' });
    if (a.thenVoidSelf && ['Spirit', 'Ultimate'].includes(CARDS[t.id].type)) await FX_ACTIONS.VOID_TO_SELF.run(c, { do: 'VOID_TO_SELF', n: a.thenVoidSelf });
  } };
/* v476 NO_FLASH_BATTLE: "during this battle, Flash effects can't be used by the opponent" (G.noFlash = the locked player's key; cleared when the battle ends; read by flashTiming) */
FX_ACTIONS.NO_FLASH_BATTLE = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => "during this battle, Flash effects can't be used by the opponent",
  can: () => !!G && !!G.attacker,
  run: async c => { G.noFlash = c.opp.key; c.ctx.did = true; log(`${_nm(c)}: ${poss(c.opp)} can't use Flash effects during this battle.`); } };
/* v477 BLOCK_MIN {n}: "the opponent can only block if they block with N Spirits; when this Spirit is blocked, choose one of them to battle with" (BS46-X03). att.blockN = {b: battle number, n}; read by doBattleInner, which asks for N blockers (all exhaust and fire BLOCKS) and lets the attacker pick the one that fights. Fewer than N eligible blockers means no block is possible. */
FX_ACTIONS.BLOCK_MIN = { chk: a => Number.isInteger(a.n) && a.n >= 2 && a.n <= 4 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `the opponent can only block if they block with ${a.n} Spirits; when this Spirit is blocked, its controller chooses one of them to battle with`,
  can: () => !!G && !!G.attacker,
  run: async (c, a) => { c.src.blockN = { b: G.battleNo, n: a.n }; c.ctx.did = true; log(`${_nm(c)}: ${poss(c.opp)} can only block with ${a.n} Spirits this battle.`); } };
/* the attacker's controller picks which of the blocking Spirits fights (the CPU takes the lowest BP, the easiest to destroy) */
async function pickFightingBlocker(A, att, team) {
  if (A.cpu) return team.slice().sort((x, y) => bpOf(x) - bpOf(y))[0];
  return (await fxPickTarget({ p: A, opp: G.p[other(A.key)], src: att, ctx: {} }, team, `✨ <b>${esc(CARDS[att.id].name)}</b><br>Tap the blocking Spirit to battle with (glowing).`)) || team[0]; }
/* v477 OPP_GW_CORES_TO_VOID {n}: "send N cores each from every opposing Grandwalker Nexus to the Void" (a Nexus with fewer cores loses all it can; core-protected Nexuses lose what the cap allows) */
FX_ACTIONS.OPP_GW_CORES_TO_VOID = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `send ${a.n} cores each from every opposing Grandwalker Nexus to the Void`,
  can: c => c.opp.nexus.some(x => x.cores > 0 && (CARDS[x.id].families || []).includes('Grandwalker')),
  run: async (c, a) => {
    c.ctx.did = false;
    for (const t of c.opp.nexus.filter(x => x.cores > 0 && (CARDS[x.id].families || []).includes('Grandwalker'))) {
      const k = Math.min(a.n, t.cores, coreTakeCap(c.opp, t, Math.min(a.n, t.cores))); if (k <= 0) continue;
      coreEvN(c.opp, t.uid, 'void', k, false); c.opp.void += k; t.cores -= k; c.ctx.did = true;
      log(`${_nm(c)}: ${k} core${k === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} are sent to the Void.`); }
    if (c.ctx.did) io.view({ type: 'board' }); } };
/* v478 CORE_SAFE to:"every" mode "move" (STATIC): "besides the Soul Core, neither player can remove cores from their Spirits/Ultimates" (BS45-032 Lv2). Any Field card of either player with that STATIC entry protects every Spirit/Ultimate that does not hold the Soul Core (approximation: the Soul holder is not protected at all, so its other cores can also be removed). */
const coreSafeEvery = target => !!G && !!target && !target.soul && ['Spirit', 'Ultimate'].includes(CARDS[target.id].type) && ['player', 'opponent'].some(k => fieldList(G.p[k]).some(src => fxEntries(src).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'CORE_SAFE' && e.to === 'every' && (!e.lv || e.lv.includes(lvNo(src))) && fxIf(G.p[k], G.p[other(k)], e.if, { selfInst: src }))));
/* v478 SUMMON_SELF_TRASH {pay}: "pay N cost to summon this card" from the Trash (HAND_DISCARDED; the discarded card is already in the Trash). did = false when the cost cannot be paid or the card cannot be summoned. */
FX_ACTIONS.SUMMON_SELF_TRASH = { chk: a => Number.isInteger(a.pay) && a.pay >= 0 && a.pay <= 5 && Object.keys(a).every(k => ['do', 'if', 'pay'].includes(k)),
  txt: a => `pay ${a.pay} cost to summon this card from the Trash`,
  can: (c, a) => c.p.trash.includes(c.src) && coresAvailable(c.p) >= a.pay && canPlaceFree(c.p, c.src),
  run: async (c, a) => {
    c.ctx.did = false;
    if (!FX_ACTIONS.SUMMON_SELF_TRASH.can(c, a)) return;
    if (a.pay && !(await payInvokeCost(c.p, c.src, { pay: a.pay }))) return;
    if (!c.p.trash.includes(c.src) || !canPlaceFree(c.p, c.src)) return;
    removeFrom(c.p.trash, c.src); c.p.hand.push(c.src);
    if (await summonFree(c.p, c.src)) c.ctx.did = true; else { removeFrom(c.p.hand, c.src); c.p.trash.push(c.src); } } };
/* v478 OPP_REMOVED_LOCK {}: "by sending a core from any of your Green Grandwalker Nexus to this Spirit, until your next Start Step, cards in the opposing Removed Zone can't be used by the opponent" (BS45-X03 Unleash; optional, the CPU pays).
   G.removedLock = {by, turn}; removedLocked(p) is read by the Accel summon from the Removed Zone (02j removedSummonable) and SUMMON_HAND_REMOVED (02x); other uses of Removed cards do not exist in the engine. It ends when the source's controller's next turn begins (turnNo + 2). */
const removedLocked = p => !!G && !!G.removedLock && G.removedLock.by !== p.key && G.turnNo < G.removedLock.turn + 2;
FX_ACTIONS.OPP_REMOVED_LOCK = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "by sending a core from any of your Green Grandwalker Nexus to this Spirit, until your next Start Step, cards in the opposing Removed Zone can't be used by the opponent",
  pay: c => c.p.spirits.includes(c.src) ? c.p.nexus.filter(x => x.cores - (x.soul ? 1 : 0) > 0 && (CARDS[x.id].families || []).includes('Grandwalker') && CARDS[x.id].symbol === 'green') : [],
  can: c => FX_ACTIONS.OPP_REMOVED_LOCK.pay(c).length > 0,
  run: async c => {
    c.ctx.did = false; const P = FX_ACTIONS.OPP_REMOVED_LOCK.pay(c), nm = CARDS[c.src.id].name; if (!P.length) return;
    const yes = c.p.cpu ? true : await ask({ title: `✨ ${nm}`, peek: true, html: "Send 1 core from a Green Grandwalker Nexus to this Spirit so the opposing Removed Zone can't be used until your next Start Step?", buttons: [{ label: 'Send a core', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] });
    if (!yes) return;
    const t = P.length === 1 || c.p.cpu ? P.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, P, `✨ <b>${esc(nm)}</b><br>Tap the Green Grandwalker Nexus that sends 1 core to this Spirit (glowing).`);
    if (!t || !P.includes(t)) return;
    coreEvN(c.p, t.uid, c.src.uid, 1, false); t.cores--; c.src.cores++; G.removedLock = { by: c.p.key, turn: G.turnNo }; c.ctx.did = true;
    log(`${nm}: a core moves from ${CARDS[t.id].name} to ${nm}; ${poss(c.opp)} Removed Zone can't be used until ${poss(c.p)} next Start Step.`); io.view({ type: 'board' }); } };
/* v478 SYMBOL_PER_OPP_REMOVED {color, per}: "for each N cards in the opposing Removed Zone, this Spirit gains an extra <color> symbol" (this turn, like SYMBOL_PLUS_TURN self) */
FX_ACTIONS.SYMBOL_PER_OPP_REMOVED = { chk: a => COLORS.includes(a.color) && Number.isInteger(a.per) && a.per >= 1 && a.per <= 5 && Object.keys(a).every(k => ['do', 'if', 'color', 'per'].includes(k)),
  txt: a => `for each ${a.per} cards in the opposing Removed Zone, this Spirit gains an extra ${cap(a.color)} symbol this turn`,
  can: (c, a) => Math.floor(c.opp.removed.length / a.per) > 0 && (c.p.spirits.includes(c.src) || c.p.nexus.includes(c.src)),
  run: async (c, a) => {
    const n = Math.floor(c.opp.removed.length / a.per); if (n <= 0 || !FX_ACTIONS.SYMBOL_PER_OPP_REMOVED.can(c, a)) { c.ctx.did = false; return; }
    const s = c.src; if (!s.symTurn || s.symTurn.turn !== G.turnNo) s.symTurn = { turn: G.turnNo, cols: [] };
    for (let i = 0; i < n; i++) s.symTurn.cols.push(a.color);
    log(`${_nm(c)}: gains ${n} extra ${cap(a.color)} symbol${n === 1 ? '' : 's'} this turn.`); io.view({ type: 'board' }); } };
/* v478 STATIC BURST_ON_DISCARD: "when this set card is discarded by the opponent, you can activate it, ignoring the Burst condition" (BS46-037). Called by DISCARD_OPP_BURST before the card leaves the Burst Area: the owner may activate it now (maybeBurst1 with force, which skips the "when" check but still honours the Burst's own `if`). True when it was activated. */
async function burstOnDiscard(owner, b) {
  if (!b || b.mirage || !(CARDS[b.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'BURST_ON_DISCARD')) return false;
  return await maybeBurst1(owner, 'DISCARD', { force: true }) && owner.burst !== b; }
