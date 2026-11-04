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
