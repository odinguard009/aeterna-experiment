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
const removedLocked = p => { if (!G) return false; if (G.removedLock && G.removedLock.by !== p.key && G.turnNo < G.removedLock.turn + 2) return true;
  const o = G.p[other(p.key)];      // v480 STATIC REMOVED_LOCK {gwColor}: while its controller has a Nexus of that colour among the Grandwalkers
  return fieldList(o).some(src => fxEntries(src).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'REMOVED_LOCK' && (!e.lv || e.lv.includes(lvNo(src))) && o.nexus.some(n => isGwNexus(n) && CARDS[n.id].symbol === e.gwColor))); };
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
/* v480 VOID_SPLIT_SELF_GW {n, color}: "take N cores from the Void and, in any way you like, put them to this Spirit or to one <color>-only Grandwalker Nexus you control" (BS49-033). Human: asks per core; the CPU puts all on the Nexus when it has one (Grandwalker levels pay off most), else on this Spirit. */
FX_ACTIONS.VOID_SPLIT_SELF_GW = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && COLORS.includes(a.color) && Object.keys(a).every(k => ['do', 'if', 'n', 'color'].includes(k)),
  txt: a => `take ${a.n} cores from the Void and put them, in any way you like, to this Spirit or to one ${cap(a.color)} Grandwalker Nexus you control`,
  can: c => c.p.void > 0 && c.p.spirits.includes(c.src),
  run: async (c, a) => {
    const m = Math.min(a.n, c.p.void); c.ctx.did = false; if (m <= 0 || !c.p.spirits.includes(c.src)) return;
    const N = c.p.nexus.filter(x => isGwNexus(x) && CARDS[x.id].symbol === a.color), nm = CARDS[c.src.id].name;
    let nx = N[0] || null; if (N.length > 1 && !c.p.cpu) nx = (await fxPickTarget(c, N, `✨ <b>${esc(nm)}</b><br>Tap the ${cap(a.color)} Grandwalker Nexus that may receive the cores (glowing).`)) || N[0];
    let toS = 0, toN = 0;
    for (let i = 0; i < m; i++) {
      let dest = nx ? 'nexus' : 'self';
      if (nx && !c.p.cpu) dest = await ask({ title: `✨ ${esc(nm)}`, peek: true, html: `Core ${i + 1}/${m} from the Void goes to:`, buttons: [{ label: 'This Spirit', cls: 'primary', value: 'self' }, { label: CARDS[nx.id].name, cls: 'blue', value: 'nexus' }] }) || 'self';
      if (dest === 'nexus') toN++; else toS++;
    }
    c.p.void -= m; c.src.cores += toS; if (nx) nx.cores += toN; else c.src.cores += toN; c.ctx.did = true;
    log(`${nm}: ${m} core${m === 1 ? '' : 's'} taken from the Void (${toS} to this Spirit${nx ? `, ${toN} to ${CARDS[nx.id].name}` : ''}).`); io.view({ type: 'board' }); } };

/* v482 REVEAL_SUMMON_PAY_ANY {match, pay}: "reveal one card from your decktop for each card on the opposing Removed Zone; you can summon any amount of matching Spirit cards among them, paying `pay` cost for each; discard the rest" (BS50-035). The CPU summons every card it can afford. did = true when one was summoned. */
FX_ACTIONS.REVEAL_SUMMON_PAY_ANY = { chk: a => Number.isInteger(a.pay) && a.pay >= 0 && a.pay <= 3 && hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'pay', 'match'].includes(k)),
  txt: a => `reveal a card from your decktop for each card on the opposing Removed Zone, summon any amount of matching Spirits among them paying ${a.pay} cost each, discard the rest`,
  can: c => c.p.deck.length > 0 && c.opp.removed.length > 0,
  run: async (c, a) => {
    const nm = CARDS[c.src.id].name; c.ctx.did = false; const n = Math.min(c.opp.removed.length, c.p.deck.length); if (n < 1) return;
    const top = c.p.deck.splice(0, n); c.p.revealed = top;
    log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ')}.`); io.view({ type: 'board' }); await revealedFx(c.p);
    for (;;) {
      const L = c.p.revealed.filter(x => CARDS[x.id].type === 'Spirit' && fxMatch(CARDS[x.id], a.match) && coresAvailable(c.p) >= a.pay && canPlaceFree(c.p, x)); if (!L.length) break;
      const t = c.p.cpu ? L[0] : await chooseCard(c, L, `✨ ${nm}`, `Pay ${a.pay} cost to summon one of these revealed Spirits?`, true); if (!t) break;
      if (a.pay && !(await payInvokeCost(c.p, c.src, { pay: a.pay }))) break;
      removeFrom(c.p.revealed, t); c.p.hand.push(t);
      if (await summonFree(c.p, t)) c.ctx.did = true; else { removeFrom(c.p.hand, t); c.p.revealed.push(t); break; }
    }
    const rest = c.p.revealed.splice(0); for (const x of rest) c.p.trash.push(x);
    if (rest.length) log(`${nm}: ${rest.length} revealed card${rest.length === 1 ? '' : 's'} discarded.`);
  } };

/* v483 STATIC NO_DRAW_REMOVED: "while this card is in the Removed Zone, neither player can draw via Red/Purple/Yellow/Blue Spirit/Nexus effects" (BS45-024). Read by drawLocked(): an effect draw whose source (G.fxSrc) is a Spirit/Ultimate/Nexus holding one of those colours (or symbol) is cancelled while any Removed Zone card carries the flag. The Draw Step itself is no effect and is never blocked. */
const removedDrawLocked = () => { const src = G && G.fxSrc, k = src && CARDS[src.id]; if (!k || !['Spirit', 'Ultimate', 'Nexus'].includes(k.type)) return false;
  if (!(k.colors || [k.symbol]).some(x => ['red', 'purple', 'yellow', 'blue'].includes(x))) return false;
  return [G.p.player, G.p.opponent].some(q => q.removed.some(r => (CARDS[r.id].effects || []).some(e => e.trigger === 'STATIC' && e.flag === 'NO_DRAW_REMOVED'))); };

/* v484 REFRESH_ATTACKER_ONCE {}: "your Spirits with Crush-named effects, when they aren't blocked, can refresh once per turn per Spirit" (BS66-XV05; ALLY_LIFE_HIT = an unblocked attack reached the Life). Refreshes ctx.attacker (or the subject) when exhausted and not yet refreshed this turn by this effect. */
FX_ACTIONS.REFRESH_ATTACKER_ONCE = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'refresh the attacking Spirit (once per turn per Spirit)',
  can: c => { const t = c.ctx.attacker || c.ctx.subject; return !!t && t.exhausted && t.crushRefT !== G.turnNo; },
  run: async c => { const t = c.ctx.attacker || c.ctx.subject; c.ctx.did = false; if (!t || !t.exhausted || t.crushRefT === G.turnNo) return;
    t.crushRefT = G.turnNo; refreshOne(t); c.ctx.did = true; log(`${CARDS[t.id].name} is refreshed.`); await fireFx(ownerOf(t) || c.p, 'REFRESHED', t, {}); } };

/* v485 OPP_NO_HAND_MAGIC: "during this battle the opponent can't use Magic cards from the Hand during Flash Timing" (noMagicB.all); noMagicHit also carries the v421 colour lock out of magicUsable */
const noMagicHit = (p, card) => !!p.noMagicB && p.noMagicB.no === G.battleNo && !!G.attacker && (!!p.noMagicB.all || (card.colors || [card.color]).includes(p.noMagicB.color));
FX_ACTIONS.OPP_NO_HAND_MAGIC = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => "during this battle, the opponent can't use Magic cards from the Hand during Flash Timing",
  run: async c => { c.opp.noMagicB = { no: G.battleNo, all: true }; c.ctx.did = true; log(`${_nm(c)}: ${poss(c.opp)} can't use Magic from the Hand this battle.`); } };
/* v486 ATTACK_SPIRIT_ALLY: "your <X> Spirits can target and attack an opposing Spirit" (BS69-002): same targeting as ATTACK_SPIRIT but for the attacker of an ALLY_ATTACKS effect (G.attacker), not the effect's own card */
FX_ACTIONS.ATTACK_SPIRIT_ALLY = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'the attacking Spirit can target an opposing Spirit and attack it',
  can: c => !!G.attacker && c.opp.spirits.some(t => CARDS[t.id].type !== 'Ultimate' && !fxImmune(c.opp, t)),
  run: async c => {
    const att = G.attacker, L = att ? c.opp.spirits.filter(t => CARDS[t.id].type !== 'Ultimate' && !fxImmune(c.opp, t)) : [], t = L.length && await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit that ${esc(CARDS[att.id].name)} attacks instead of the Life (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    att.atkT = { s: t, b: G.battleNo }; c.ctx.did = true; log(`${CARDS[att.id].name} targets ${poss(c.opp)} ${CARDS[t.id].name} and attacks it.`);
  } };
/* v487 RETURN_TRASH_DISTINCT {match, n}: "return up to n differently-named <match> cards from your Trash to the Hand" (BS69-007); any card type, one per printed name */
FX_ACTIONS.RETURN_TRASH_DISTINCT = { chk: a => hasMatch(a.match) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Object.keys(a).every(k => ['do', 'match', 'n', 'if'].includes(k)), txt: a => `return up to ${a.n} differently-named matching cards from your Trash to the Hand`,
  can: (c, a) => c.p.trash.some(t => fxMatch(CARDS[t.id], a.match)),
  run: async (c, a) => {
    let got = 0; const names = new Set();
    while (got < a.n) {
      const L = c.p.trash.filter(t => fxMatch(CARDS[t.id], a.match) && !names.has(CARDS[t.id].name)); if (!L.length) break;
      const t = c.p.cpu ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a card to return to the Hand (${got + 1}/${a.n}), or pass.`); if (!t) break;
      names.add(CARDS[t.id].name); removeFrom(c.p.trash, t); c.p.hand.push(t); got++;
    }
    if (!got) { c.ctx.did = false; return; } c.ctx.did = true; log(`${_nm(c)}: ${got} card${got === 1 ? '' : 's'} return from the Trash to the Hand.`); io.view({ type: 'board' });
  } };
/* v487 TRASH_CORES_PER_NEXUS {n, family}: "for each <family> Nexus you control, send n cores (not the Soul Core) from your Trash to any of your Spirits/Nexuses" (BS69-008); the cores go to one picked Spirit/Nexus */
FX_ACTIONS.TRASH_CORES_PER_NEXUS = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && typeof a.family === 'string' && Object.keys(a).every(k => ['do', 'n', 'family', 'if'].includes(k)), txt: a => `for each "${a.family}" Nexus you control, send ${a.n} cores from your Trash to any of your Spirits/Nexuses`,
  can: (c, a) => c.p.trashCores.n > 0 && c.p.nexus.some(x => (CARDS[x.id].families || []).includes(a.family)),
  run: async (c, a) => {
    const k = c.p.nexus.filter(x => (CARDS[x.id].families || []).includes(a.family)).length, m = Math.min(a.n * k, c.p.trashCores.n), L = c.p.spirits.concat(c.p.nexus);
    if (!m || !L.length) { c.ctx.did = false; return; }
    const t = L.length === 1 ? L[0] : c.p.cpu ? L.slice().sort((x, y) => (CARDS[y.id].type === 'Spirit') - (CARDS[x.id].type === 'Spirit'))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the Spirit/Nexus that receives ${m} core${m === 1 ? '' : 's'} from the Trash (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    c.p.trashCores.n -= m; t.cores += m; c.ctx.did = true; log(`${_nm(c)}: ${m} core${m === 1 ? '' : 's'} go from the Trash to ${CARDS[t.id].name}.`); io.view({ type: 'board' });
  } };
/* v487 DESTROY_OWN_NEXUS_FAMILY {family}: "by destroying one of your <family> Nexuses" (cost half of BS69-011's Mirage Flash; did=false when none); SUMMON_MIRAGE_SELF_PAID: "pay the cost to summon this Mirage" (the paid twin of SUMMON_MIRAGE_SELF) */
FX_ACTIONS.DESTROY_OWN_NEXUS_FAMILY = { chk: a => typeof a.family === 'string' && Object.keys(a).every(k => ['do', 'family', 'if'].includes(k)), txt: a => `destroy one of your "${a.family}" Nexuses`,
  can: (c, a) => c.p.nexus.some(n => !n.noFx && (CARDS[n.id].families || []).includes(a.family)),
  run: async (c, a) => {
    const L = c.p.nexus.filter(n => !n.noFx && (CARDS[n.id].families || []).includes(a.family)); if (!L.length) { c.ctx.did = false; return; }
    const t = L.length === 1 || c.p.cpu ? L.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the Nexus to destroy (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    log(`${_nm(c)}: ${CARDS[t.id].name} is destroyed.`); removeNexus(c.p, t, 'destroyed'); c.ctx.did = true; io.view({ type: 'board' });
  } };
FX_ACTIONS.SUMMON_MIRAGE_SELF_PAID = { chk: () => true, txt: () => 'pay the cost to summon this set Mirage',
  can: c => c.p.mirage === c.src && !!c.src.mirage,
  run: async c => {
    const m = c.src; if (c.p.mirage !== m || !m.mirage) { c.ctx.did = false; return; }
    c.p.mirage = null; m.mirage = false; c.p.hand.push(m);
    if (await summonPaid(c.p, m)) { log(`${CARDS[m.id].name}: the set Mirage is summoned (cost paid).`); c.ctx.did = true; return; }
    removeFrom(c.p.hand, m); m.mirage = true; c.p.mirage = m; c.ctx.did = false;
  } };
/* v489 DISCARD_FIELD_MAGIC {costLe}: "discard a Cost N or less Magic card from the opposing Field". The engine has no response window while an opposing Magic sits on the Field (it resolves in castMagic at once), so this finds nothing and does nothing; it is kept so the printed clause is data, not residual (BS69-024) */
FX_ACTIONS.DISCARD_FIELD_MAGIC = { chk: a => Number.isInteger(a.costLe) && Object.keys(a).every(k => ['do', 'costLe', 'if'].includes(k)), txt: a => `discard a Cost ${a.costLe} or less Magic card from the opposing Field`,
  can: () => false, run: async c => { c.ctx.did = false; } };
/* v490 DEPLOY_LAST_DISCARDED {match}: "When this effect discards a <match> card, you can deploy that card without paying the cost" (the card LOOT discarded last, ctx.lastDiscarded; asks a human) */
FX_ACTIONS.DEPLOY_LAST_DISCARDED = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: a => 'when this effect discards a matching card, you can deploy it without paying the cost',
  can: () => true,
  run: async (c, a) => {
    const d = c.ctx.lastDiscarded; c.ctx.did = false;
    if (!d || !c.p.trash.includes(d) || !fxMatch(CARDS[d.id], a.match) || !canPlaceFree(c.p, d)) return;
    if (!c.p.cpu && !await ask({ title: `✨ ${esc(_nm(c))}`, html: `Deploy ${esc(CARDS[d.id].name)} without paying the cost?`, buttons: [{ label: 'Yes', cls: 'primary', value: true }, { label: 'No', cls: 'blue', value: false }] })) return;
    removeFrom(c.p.trash, d); c.p.hand.push(d);
    if (await summonFree(c.p, d)) c.ctx.did = true; else { removeFrom(c.p.hand, d); c.p.trash.push(d); }
  } };
/* v492 DEPLOY_SELF_PAID {costN}: "pay N cost to summon this card from the Hand" (BS69-026 Priapus; only from the Hand, the cost is paid, did=false when not paid) */
FX_ACTIONS.DEPLOY_SELF_PAID = { chk: a => Number.isInteger(a.costN) && a.costN >= 0 && a.costN <= 10 && Object.keys(a).every(k => ['do', 'costN', 'if'].includes(k)), txt: a => `pay ${a.costN} cost to summon this card from the Hand`,
  can: (c, a) => c.p.hand.includes(c.src) && canPlacePaid(c.p, c.src) && reserveTotal(c.p) >= a.costN + minCores(CARDS[c.src.id]),
  run: async (c, a) => {
    c.ctx.did = false; if (!FX_ACTIONS.DEPLOY_SELF_PAID.can(c, a)) return;
    c.ctx.did = !!(await summonPaid(c.p, c.src, { costN: a.costN }));
  } };
