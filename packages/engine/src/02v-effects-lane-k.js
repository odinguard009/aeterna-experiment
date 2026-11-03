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
    await maybeBurst(c.p, 'LIFE_DECREASE', { selfCost: true });
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
/* v0.208 REMOVE_ANY_DRAW {match}: "By putting any number of <X> cards from your Hand onto the Removed Zone, for each card you put, draw a card" (the CPU puts every matching card). */
FX_ACTIONS.REMOVE_ANY_DRAW = {
  chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
  txt: () => 'put any number of matching cards from your Hand onto the Removed Zone, draw a card for each',
  cands: (c, a) => c.p.hand.filter(h => h !== c.src && fxMatch(CARDS[h.id], a.match)),
  can: () => true,
  run: async (c, a) => {
    let n = 0;
    for (;;) {
      const L = FX_ACTIONS.REMOVE_ANY_DRAW.cands(c, a); if (!L.length) break;
      const d = c.p.cpu ? L[0] : await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, `Choose a card to put onto the Removed Zone (${n} so far; each draws a card). Skip to finish.`, true);
      if (!d) break;
      removeFrom(c.p.hand, d); c.p.removed.push(d); n++;
      if (G && G.evQ && !G.over) G.evQ.push({ type: 'REMOVED', key: c.p.key });
      log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'puts' : 'put'} ${CARDS[d.id].name} onto the Removed Zone.`);
    }
    c.ctx.did = n > 0;
    if (n) { const k = draw(c.p, n); log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    io.view({ type: 'board' });
  } };
/* v0.208 BOTH_RESET_HAND {n}: "Both players discard their entire Hand. Then, both players draw N cards" (own side first, then the opponent). */
FX_ACTIONS.BOTH_RESET_HAND = {
  chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 7 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `both players discard their entire Hand, then draw ${a.n} cards`,
  can: () => true,
  run: async (c, a) => {
    const sides = [c, { ...c, p: c.opp, opp: c.p }];
    for (const q of sides) {
      const out = q.p.hand.filter(h => h !== c.src);
      for (const d of out) { removeFrom(q.p.hand, d); q.p.trash.push(d); }
      if (out.length) log(`${CARDS[c.src.id].name}: ${who(q.p)} ${q.p.cpu ? 'discards' : 'discard'} ${out.length} card${out.length === 1 ? '' : 's'}.`);
      await sentToTrashFx(q, out, 'hand');
    }
    for (const q of sides) { const k = draw(q.p, a.n); log(`${CARDS[c.src.id].name}: ${who(q.p)} ${q.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(q.p, k); }
    io.view({ type: 'board' });
  } };
/* v0.208 OPP_DISCARD_RANDOM {n}: "The opponent discards N random cards from their Hand" (a random card that is not hand-protected; ctx.did = false when none). */
FX_ACTIONS.OPP_DISCARD_RANDOM = {
  chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `discard ${a.n === 1 ? 'a random card' : a.n + ' random cards'} from the opposing Hand`,
  can: c => c.opp.hand.length > 0,
  run: async (c, a) => { let k = 0;
    for (let j = 0; j < a.n; j++) { const L = c.opp.hand.filter(x => !handSafe(x, c.opp, c)); if (!L.length) break;
      const d = L[Math.floor(rng() * L.length)]; removeFrom(c.opp.hand, d); c.opp.trash.push(d); k++;
      log(`${CARDS[c.src.id].name}: ${who(c.opp)} ${c.opp.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name} (random).`); }
    if (!k) c.ctx.did = false; io.view({ type: 'board' }); } };
/* v0.208 DRAW_BOTH {n}: "Each player draws N cards" (own side first). */
FX_ACTIONS.DRAW_BOTH = {
  chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
  txt: a => `each player draws ${a.n} card${a.n === 1 ? '' : 's'}`,
  can: () => true,
  run: async (c, a) => { for (const q of [c.p, c.opp]) { const k = draw(q, a.n); handUp(q, k); } io.view({ type: 'board' }); } };
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
Object.assign(FX_ACTIONS, {      // v278 "Send a core from your Field or your Trash to the Void." (Field = Reserve; the CPU spends a Trash core first)
  OWN_CORE_TO_VOID: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'send a core from your Reserve or your Trash to the Void',
    can: c => c.p.trashCores.n > 0 || c.p.reserve.n > 0,
    run: async (c, a) => {
      const p = c.p, nm = CARDS[c.src.id].name, T = p.trashCores.n > 0, R = p.reserve.n > 0; c.ctx.did = false;
      if (!T && !R) return;
      let fromTrash = T;
      if (T && R && !p.cpu) fromTrash = (await ask({ title: `✨ ${nm}`, peek: true, html: 'Send a core to the Void from:', buttons: [{ label: 'Trash', cls: 'primary', value: true }, { label: 'Reserve', cls: 'purple', value: false }] })) !== false;
      if (fromTrash) { coreEvN(p, 'trash', 'void', 1, false); p.trashCores.n--; } else { coreEvN(p, 'reserve', 'void', 1, false); p.reserve.n--; }
      p.void += 1; c.ctx.did = true; log(`${nm}: a core from ${poss(p)} ${fromTrash ? 'Trash' : 'Reserve'} goes to the Void.`); io.view({ type: 'board' });
    } },
});
Object.assign(FX_ACTIONS, {      // v279 "Gain cores in your Reserve equal to the number of cores that were on this Spirit when it was destroyed."
  VOID_TO_RESERVE_LOST: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'put cores from the Void to your Reserve equal to the cores this Spirit held when it left the Field',
    run: async (c, a) => { const m = takeFromVoid(c.p, c.src.lostCores || 0); c.ctx.did = m > 0; if (!m) return; coreEvN(c.p, 'void', 'reserve', m, false); c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Reserve.`); io.view({ type: 'board' }); } },
});
Object.assign(FX_ACTIONS, {      // v280 "Each player chooses and destroys a Nexus they control. Can't be used unless each player controls at least one Nexus."
  /* v0.212 LIFE_CAP_ALL "During this turn, your Life can only be reduced by one by the attacks of opposing unblocked Spirits." (player.lifeCapAll = turn number, read by 08-battle) */
  LIFE_CAP_ALL: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'during this turn, your Life can only be reduced by one by the attacks of opposing unblocked Spirits',
    can: () => true,
    run: async c => { c.p.lifeCapAll = G.turnNo; io.view({ type: 'board' }); log(`${_nm(c)}: ${poss(c.p)} Life can only be reduced by one per attack this turn.`); } },
  /* v0.212 CANT_BLOCK_PER {per} "For each <match> Spirit you control, target an opposing Spirit. During this turn, those can't block." (up to that many distinct targets; noAB + noABTurn like CANT_ATTACK_BLOCK turn:true, it is the owner's turn so attack does not matter) */
  CANT_BLOCK_PER: { chk: a => Object.keys(a).every(k => ['do', 'if', 'per'].includes(k)) && hasMatch(a.per),
    txt: () => 'for each matching Spirit you control, target an opposing Spirit; during this turn those can\'t block',
    cands: c => c.opp.spirits.filter(t => !t.noAB && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.CANT_BLOCK_PER.cands(c).length > 0,
    run: async (c, a) => {
      const n = c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.per, s)).length, L = FX_ACTIONS.CANT_BLOCK_PER.cands(c);
      if (!n || !L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, Math.min(n, L.length), `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirits that can't block this turn (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { t.noAB = true; t.noABTurn = G.turnNo; log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[t.id].name} can't block during this turn.`); }
      io.view({ type: 'board' });
    } },
  BOTH_DESTROY_NEXUS: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'each player destroys a Nexus they control (only if both control one)',
    can: c => c.p.nexus.length > 0 && c.opp.nexus.length > 0,
    run: async (c, a) => {
      c.ctx.did = false; if (!c.p.nexus.length || !c.opp.nexus.length) return;
      const nm = CARDS[c.src.id].name, mine = c.p.nexus.filter(n => !n.noFx);
      const t = c.p.cpu || mine.length < 2 ? mine.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, mine, `✨ <b>${esc(nm)}</b><br>Tap your Nexus to destroy (glowing).`);
      const u = c.opp.nexus.filter(n => !n.noFx).sort((x, y) => x.cores - y.cores)[0];      // the opponent's own choice: the engine picks their weakest Nexus
      for (const [q, x] of [[c.p, t], [c.opp, u]]) if (x) { log(`${nm}: ${poss(q)} ${CARDS[x.id].name} is destroyed.`); removeNexus(q, x, 'destroyed'); c.ctx.did = true; }
      io.view({ type: 'board' });
    } },
});
Object.assign(FX_ACTIONS, {      // v281 "By sending all cores from a <bpGe> BP or more Spirit you control to the Void, ..." (cost half; the Spirit is then depleted)
  OWN_SPIRIT_CORES_TO_VOID: { chk: a => Number.isInteger(a.bpGe) && a.bpGe >= 1000 && a.bpGe <= 100000 && Object.keys(a).every(k => ['do', 'if', 'bpGe'].includes(k)),
    txt: a => `send all cores from a Spirit of yours with ${a.bpGe} BP or more to the Void`,
    cands: (c, a) => c.p.spirits.filter(t => t.cores > 0 && bpOf(t) >= a.bpGe && !t.noFx && !fxImmune(c.p, t)),
    can: (c, a) => FX_ACTIONS.OWN_SPIRIT_CORES_TO_VOID.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.OWN_SPIRIT_CORES_TO_VOID.cands(c, a); c.ctx.did = false; if (!L.length) return;
      const nm = CARDS[c.src.id].name, t = c.p.cpu ? L.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(nm)}</b><br>Tap the Spirit whose cores go to the Void (glowing).`);
      if (!t) return;
      const m = Math.min(t.cores, coreTakeCap(c.p, t, t.cores)); if (m <= 0) return;
      coreEvN(c.p, t.uid, 'void', m, false); t.cores -= m; c.p.void += m; c.ctx.did = true;
      log(`${nm}: ${m} core${m === 1 ? '' : 's'} from ${CARDS[t.id].name} go to the Void.`);
      if (t.cores <= 0 && !t.soul) removeSpirit(c.p, t, 'depleted');
      io.view({ type: 'board' });
    } },
});
Object.assign(FX_ACTIONS, {      // v282 "Exhaust opposing Spirits until they control the same number of exhausted Spirits as you do."
  EXHAUST_OPP_MATCH: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'exhaust opposing Spirits until they have as many exhausted Spirits as you',
    need: c => c.p.spirits.filter(t => t.exhausted).length - c.opp.spirits.filter(t => t.exhausted).length,
    cands: c => c.opp.spirits.filter(t => !t.exhausted && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.EXHAUST_OPP_MATCH.need(c) > 0 && FX_ACTIONS.EXHAUST_OPP_MATCH.cands(c).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.EXHAUST_OPP_MATCH.cands(c), k = Math.min(FX_ACTIONS.EXHAUST_OPP_MATCH.need(c), L.length); c.ctx.did = false; if (k <= 0) return;
      const T = await pickOppSpirits(c, L, k, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirits to exhaust (glowing).`);
      if (!T.length) return;
      for (const t of T) { t.exhausted = true; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} is exhausted.`); }
      c.ctx.did = true; await fireFx(c.p, 'EXHAUSTED_FX', null, { side: 'opp', fxSrc: c.src });
      for (const t of T) await fireFx(c.opp, 'EXHAUSTED_FX', null, { side: 'own', subject: t, fxSrc: c.src });
      io.view({ type: 'board' });
    } },
});
Object.assign(FX_ACTIONS, {      // v283 "Gain n core(s) on target Spirit you control except this Spirit." (Reserve cores, like CORE_TO_SELF)
  CORE_TO_OTHER: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
    txt: a => `+${a.n} core${a.n === 1 ? '' : 's'} to another Spirit of yours`,
    cands: c => c.p.spirits.filter(s => s !== c.src),
    can: c => c.p.reserve.n > 0 && FX_ACTIONS.CORE_TO_OTHER.cands(c).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.CORE_TO_OTHER.cands(c); c.ctx.did = false; if (!L.length || c.p.reserve.n < 1) return;
      const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap another Spirit of yours to receive the core${a.n === 1 ? '' : 's'} (glowing).`);
      if (!t) return;
      let k = 0; for (let j = 0; j < a.n; j++) if (addCore(c.p, t)) k++;
      if (k) { c.ctx.did = true; log(`${CARDS[t.id].name} gets +${k} core${k === 1 ? '' : 's'}.`); io.view({ type: 'board' }); }
    } },
  /* v289 "Send all cores from the opposing Reserve to their Trash." */
  OPP_RESERVE_TO_TRASH: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'send all cores from the opposing Reserve to their Trash',
    can: c => c.opp.reserve.n > 0,
    run: async (c, a) => { const m = c.opp.reserve.n; c.ctx.did = m > 0; if (!m) return; coreEvN(c.opp, 'reserve', 'trash', m, false); c.opp.reserve.n -= m; c.opp.trashCores.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} Reserve go to the Trash.`); io.view({ type: 'board' }); } },
  /* v291 "Send all cores from your Trash to your Reserve." */
  TRASH_TO_RESERVE: { chk: a => Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)) && (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5)),
    txt: a => a && a.n ? `send ${a.n} core${a.n === 1 ? '' : 's'} from your Trash to your Reserve` : 'send all cores from your Trash to your Reserve',
    can: c => c.p.trashCores.n > 0,
    run: async (c, a) => { const m = a.n ? Math.min(a.n, c.p.trashCores.n) : c.p.trashCores.n; c.ctx.did = m > 0; if (!m) return; coreEvN(c.p, 'trash', 'reserve', m, false); c.p.trashCores.n -= m; c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} from the Trash go to ${poss(c.p)} Reserve.`); io.view({ type: 'board' }); } },
  /* v290 "Put a core from the Void to this Nexus/Spirit." */
  VOID_TO_SELF: { chk: a => Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)) && (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 3)),
    txt: a => `put ${a.n || 1} core${(a.n || 1) === 1 ? '' : 's'} from the Void to this card`,
    can: c => c.p.void > 0 && fieldList(c.p).includes(c.src),
    run: async (c, a) => { const m = Math.min(a.n || 1, c.p.void); c.ctx.did = m > 0 && fieldList(c.p).includes(c.src); if (!c.ctx.did) return; c.p.void -= m; c.src.cores += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} go from the Void onto it.`); io.view({ type: 'board' }); } },
});

/* v310 BLOCKER_UNAFFECTED: "During this turn, a blocking Spirit you control is unaffected by opposing cards' effects." Marks blockUnaffTurn on the player; fxImmune treats the current blocker (G.blocker) as immune to every opposing effect while the mark matches the turn. */
FX_ACTIONS.BLOCKER_UNAFFECTED = {
  chk: () => true,
  txt: () => "during this turn, a blocking Spirit you control is unaffected by opposing cards' effects",
  can: () => !!G,
  run: async c => { c.p.blockUnaffTurn = G.turnNo; log(`${CARDS[c.src.id].name}: ${poss(c.p)} blocking Spirits are unaffected by opposing effects this turn.`); } };
/* v312 BLOCK_EXHAUSTED_TURN {to:'pick'|'all', match?}: "During this turn, [target Spirit you control / all your <X> Spirits] can block while exhausted." Marks blockExT = the turn number, read by canBlockState. */
FX_ACTIONS.BLOCK_EXHAUSTED_TURN = {
  chk: a => (a.to === 'pick' || a.to === 'all' || a.to === 'picked') && (a.match == null || hasMatch(a.match)) && (a.battle == null || (a.battle === true && a.to !== 'all')),
  txt: a => `during this turn, ${a.to === 'all' ? 'your matching Spirits' : 'one of your Spirits'} can block while exhausted`,
  cands: (c, a) => a.to === 'picked' ? (c.ctx.picked && c.p.spirits.includes(c.ctx.picked) ? [c.ctx.picked] : []) : c.p.spirits.filter(s => !a.match || fxMatch(CARDS[s.id], a.match, s)),      // to:'picked' = the Spirit chosen by the previous action (ctx.picked)
  can: (c, a) => (!a.battle || !!G.attacker) && FX_ACTIONS.BLOCK_EXHAUSTED_TURN.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.BLOCK_EXHAUSTED_TURN.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const T = a.to === 'all' || a.to === 'picked' ? L : [c.p.cpu || L.length === 1 ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to let it block while exhausted (glowing).`)];
    if (!T[0]) { c.ctx.did = false; return; }
    if (a.to === 'pick') c.ctx.picked = T[0];      // v314: a following WIN_RIDER stamps the same Spirit; battle:true limits it to this battle
    for (const t of T) { if (a.battle) t.blockExB = G.battleNo; else t.blockExT = G.turnNo; log(`${CARDS[c.src.id].name}: ${poss(c.p)} ${CARDS[t.id].name} can block while exhausted this turn.`); }
  } };

/* v316 NEXUS_CORES_ALL_TO_TRASH {oppOnly?} (v331 oppOnly: "every core from all opposing Nexuses"): "Move all cores from all Nexuses to their owner's Trash." Both sides; protected Nexuses (fxImmune) are skipped for the opponent only. */
FX_ACTIONS.NEXUS_CORES_ALL_TO_TRASH = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'oppOnly'].includes(k)) && (a.oppOnly == null || a.oppOnly === true),
  txt: () => "move all cores from all Nexuses to their owner's Trash",
  can: (c, a) => (!(a && a.oppOnly) && c.p.nexus.some(x => x.cores > 0)) || c.opp.nexus.some(x => x.cores > 0),
  run: async (c, a) => {
    let k = 0;
    for (const side of (a && a.oppOnly ? [c.opp] : [c.p, c.opp])) for (const x of side.nexus) {
      if (x.cores <= 0 || (side === c.opp && fxImmune(side, x))) continue;
      const m = Math.min(x.cores, coreTakeCap(side, x, x.cores)); if (!m) continue;
      coreEvN(side, x.uid, 'trash', m, false); x.cores -= m; side.trashCores.n += m; k += m;
    }
    c.ctx.did = k > 0; if (k) log(`${CARDS[c.src.id].name}: ${k} core${k === 1 ? '' : 's'} move from the Nexuses to their owners' Trash.`);
  } };

/* v318 DESTROY_SAME_FAMILY: "destroy every opposing Spirit with the same family as that destroyed Spirit" (BATTLE_WIN; ctx.victimId = the Spirit card the battle destroyed). */
FX_ACTIONS.DESTROY_SAME_FAMILY = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'destroy every opposing Spirit that shares a family with the Spirit destroyed in this battle',
  cands: c => { const v = c.ctx.victimId && CARDS[c.ctx.victimId], F = (v && v.families) || []; return F.length ? c.opp.spirits.filter(s => (CARDS[s.id].families || []).some(f => F.includes(f))) : []; },
  can: c => !!c.ctx.victimId,
  run: async c => {
    const L = FX_ACTIONS.DESTROY_SAME_FAMILY.cands(c); c.ctx.did = false;
    for (const s of L) if (c.opp.spirits.includes(s)) { removeSpirit(c.opp, s, 'destroyed', true); c.ctx.did = true; }
    if (c.ctx.did) { log(`${CARDS[c.src.id].name}: ${L.length} opposing Spirit${L.length === 1 ? '' : 's'} sharing the destroyed Spirit's family are destroyed.`); checkDepletion(c.opp); }
  } };

/* v319 NEXUS_ALL_TO_HAND: "Move all Nexuses to their owners' Hand." Both sides; protected opposing Nexuses (fxImmune) stay. */
FX_ACTIONS.NEXUS_ALL_TO_HAND = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "return all Nexuses to their owners' Hands",
  can: c => c.p.nexus.length + c.opp.nexus.length > 0,
  run: async c => {
    let k = 0;
    for (const side of [c.p, c.opp]) for (const x of side.nexus.slice()) { if (side === c.opp && fxImmune(side, x)) continue; bounceCard(side, x, 'hand'); k++; }
    c.ctx.did = k > 0; if (k) { checkDepletion(c.p); checkDepletion(c.opp); }
  } };

/* v320 MUST_ATTACK_ALL_OPP {costLe}: "opposing Cost N or less Spirits must attack if possible" - every matching unexhausted opposing Spirit gets mustAtk (same marker as MUST_ATTACK_OPP). */
FX_ACTIONS.MUST_ATTACK_ALL_OPP = {
  chk: a => Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'costLe'].includes(k)),
  txt: a => `every opposing Cost ${a.costLe} or less Spirit must attack at the start of the step if possible`,
  cands: (c, a) => c.opp.spirits.filter(t => !t.exhausted && !fxImmune(c.opp, t) && CARDS[t.id].cost <= a.costLe),
  can: (c, a) => FX_ACTIONS.MUST_ATTACK_ALL_OPP.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.MUST_ATTACK_ALL_OPP.cands(c, a); c.ctx.did = L.length > 0;
    for (const t of L) { t.mustAtk = G.turnNo; log(`${CARDS[t.id].name} must attack at the start of the step if possible.`); }
  } };

/* v321 DESTROY_OPP_DOWN_TO_OWN: "If you control two or more Spirits, the opponent destroys their Spirits until they control the same number as you." Needs 2+ own Spirits; the opponent chooses (CPU: weakest first). */
FX_ACTIONS.DESTROY_OPP_DOWN_TO_OWN = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'if you control two or more Spirits, the opponent destroys Spirits they control until they control as many as you',
  can: c => c.p.spirits.length >= 2 && c.opp.spirits.length > c.p.spirits.length,
  run: async c => {
    c.ctx.did = false; if (c.p.spirits.length < 2) return;
    const want = c.p.spirits.length;
    while (c.opp.spirits.length > want) {
      const before = c.opp.spirits.length;
      await FX_ACTIONS.DESTROY_OPP_OWN.run(c, { do: 'DESTROY_OPP_OWN' });
      if (c.opp.spirits.length >= before) break;
      c.ctx.did = true;
    }
  } };

/* v323 TREAT_HIGHEST_ALL: "During this turn, treat every Spirit you control as being on its highest level." Applies to the Spirits on the Field at resolve time (reuses the lvHighTurn marker of TREAT_LV2 highest). */
FX_ACTIONS.TREAT_HIGHEST_ALL = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'during this turn, treat every Spirit you control as being on its highest level',
  can: c => c.p.spirits.some(s => CARDS[s.id].levels.length > 1 && !s.lvHighTurn),
  run: async c => {
    const L = c.p.spirits.filter(s => CARDS[s.id].levels.length > 1 && !s.lvHighTurn); c.ctx.did = L.length > 0;
    for (const s of L) s.lvHighTurn = true;
    if (L.length) { log(`${poss(c.p)} Spirits are treated as being on their highest levels this turn.`); io.view({ type: 'board' }); }
  } };

/* v324 CANT_ATTACK_BLOCK_ALL {costLe | costIn | opp:true (every opposing Spirit, no cost filter)}: "During this turn, all Cost N or less (or Cost A/B) Spirits can't attack nor block." Both fields; protected Spirits are skipped (fxImmune); lasts to the End Step like CANT_ATTACK_BLOCK turn:true. */
FX_ACTIONS.CANT_ATTACK_BLOCK_ALL = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'costLe', 'costIn', 'opp'].includes(k)) && (a.opp === true ? a.costLe == null && a.costIn == null : ((Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30) !== (Array.isArray(a.costIn) && a.costIn.length > 0 && a.costIn.every(Number.isInteger)))),
  txt: a => a.opp ? "during this turn, every opposing Spirit can't attack/block" : `during this turn, all Spirits with cost ${a.costLe != null ? a.costLe + ' or less' : a.costIn.join('/')} can't attack/block`,
  cands: (c, a) => (a.opp ? [c.opp] : [c.p, c.opp]).flatMap(side => side.spirits.filter(s => !s.noAB && (a.opp || (a.costLe != null ? CARDS[s.id].cost <= a.costLe : a.costIn.includes(CARDS[s.id].cost))) && (side === c.p || !fxImmune(c.opp, s, c)))),
  can: (c, a) => FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.cands(c, a); c.ctx.did = L.length > 0;
    for (const t of L) { t.noAB = true; t.noABTurn = G.turnNo; }
    if (L.length) { log(`${CARDS[c.src.id].name}: ${L.length} Spirit${L.length === 1 ? '' : 's'} can't attack/block during this turn.`); io.view({ type: 'board' }); }
  } };
/* v419 CANT_ATTACK_PICK {match?}: "Target an opposing <match> Spirit/Ultimate. During this turn, it can't attack." One target (fxImmune respected); sets noAtkTurn (read by cantAttack). */
FX_ACTIONS.CANT_ATTACK_PICK = {
  chk: a => (a.match == null || hasMatch(a.match)) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
  txt: a => `target an opposing ${a.match ? 'matching ' : ''}Spirit/Ultimate. During this turn, it can't attack`,
  cands: (c, a) => c.opp.spirits.filter(t => t.noAtkTurn !== G.turnNo && !fxImmune(c.opp, t, c) && (!a.match || fxMatch(CARDS[t.id], a.match, t))),
  can: (c, a) => FX_ACTIONS.CANT_ATTACK_PICK.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.CANT_ATTACK_PICK.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const [t] = await pickOppSpirits(c, L, 1, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit that can't attack this turn (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t.noAtkTurn = G.turnNo; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} can't attack during this turn.`); io.view({ type: 'board' });
  } };
/* v354 CANT_BLOCK_OPP_ALL {costLe}: "During this turn, every opposing Cost N or less Spirit can't block." Opposing side only; protected Spirits skipped; mark noBlockT = turn number (read by canBlockState). */
FX_ACTIONS.CANT_BLOCK_OPP_ALL = {
  chk: a => Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'costLe'].includes(k)),
  txt: a => `during this turn, every opposing Spirit with cost ${a.costLe} or less can't block`,
  cands: (c, a) => c.opp.spirits.filter(s => CARDS[s.id].cost <= a.costLe && !fxImmune(c.opp, s, c)),
  can: (c, a) => FX_ACTIONS.CANT_BLOCK_OPP_ALL.cands(c, a).length > 0,
  run: async (c, a) => { const L = FX_ACTIONS.CANT_BLOCK_OPP_ALL.cands(c, a); c.ctx.did = L.length > 0; for (const t of L) t.noBlockT = G.turnNo;
    if (L.length) log(`${CARDS[c.src.id].name}: ${L.length} opposing Spirit${L.length === 1 ? '' : 's'} can't block during this turn.`); } };
/* v360 DISCARD_OPP_REMOVED {n | all | perSpirit, match?, exact?}: "discard a card / N cards / every <match> card from the opposing Removed Zone" (the cards go to their Trash).
   perSpirit: one card per Spirit/Ultimate you control. exact: all n cards must be available, otherwise nothing happens ("by discarding two cards ..."). Sets ctx.did and ctx.removedN. */
FX_ACTIONS.DISCARD_OPP_REMOVED = {
  chk: a => ((Number.isInteger(a.n) && a.n >= 1 && a.n <= 10) || a.all === true || a.perSpirit === true) && (a.match == null || hasMatch(a.match)) && (a.exact == null || (a.exact === true && Number.isInteger(a.n))) && Object.keys(a).every(k => ['do', 'if', 'n', 'all', 'perSpirit', 'match', 'exact'].includes(k)),
  txt: a => `discard ${a.all ? 'every' : a.perSpirit ? 'one per Spirit you control' : a.n} ${a.match ? 'matching ' : ''}card${a.n === 1 ? '' : 's'} from the opposing Removed Zone`,
  cands: (c, a) => c.opp.removed.filter(t => !a.match || fxMatch(CARDS[t.id], a.match)),
  can: (c, a) => { const L = FX_ACTIONS.DISCARD_OPP_REMOVED.cands(c, a); return L.length >= (a.exact ? a.n : 1); },
  run: async (c, a) => {
    const L = FX_ACTIONS.DISCARD_OPP_REMOVED.cands(c, a), want = a.all ? L.length : a.perSpirit ? c.p.spirits.length : a.n;
    if (!L.length || want < 1 || (a.exact && L.length < want)) { c.ctx.did = false; c.ctx.removedN = 0; return; }
    let k = 0;
    for (let j = 0; j < Math.min(want, L.length); j++) { const pool = FX_ACTIONS.DISCARD_OPP_REMOVED.cands(c, a); const t = a.all || pool.length <= want - j ? pool[0] : await chooseCard(c, pool, `✨ ${CARDS[c.src.id].name}`, 'Choose a card from the opposing Removed Zone to discard.', false); if (!t) break; removeFrom(c.opp.removed, t); c.opp.trash.push(t); k++; }
    c.ctx.did = k > 0; c.ctx.removedN = k; if (k) { log(`${CARDS[c.src.id].name}: ${k} card${k === 1 ? '' : 's'} from ${poss(c.opp)} Removed Zone go to their Trash.`); io.view({ type: 'board' }); }
  } };
/* v325 SPIRITS_ALL_TO_HAND {costLe}: "Return every Cost N or less Spirit to its owner's Hand." Both sides; protected opposing Spirits are skipped (fxImmune). */
FX_ACTIONS.SPIRITS_ALL_TO_HAND = {
  chk: a => Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'costLe'].includes(k)),
  txt: a => `return every Cost ${a.costLe} or less Spirit to its owner's Hand`,
  can: c => c.p.spirits.concat(c.opp.spirits).some(s => CARDS[s.id].cost <= 30),
  run: async (c, a) => {
    let k = 0;
    for (const side of [c.p, c.opp]) for (const x of side.spirits.slice()) { if (CARDS[x.id].cost > a.costLe || (side === c.opp && fxImmune(side, x, c))) continue; bounceCard(side, x, 'hand'); k++; }
    c.ctx.did = k > 0; if (k) { checkDepletion(c.p); checkDepletion(c.opp); io.view({ type: 'board' }); }
  } };

/* v327 LV_UP_TURN: "Target a Spirit you or the opponent controls. During this turn, it is treated as being one LV higher." inst.lvPlusTurn, read by lvIndex (capped at the highest level), cleared at turn end / on leaving the Field. Protected opposing Spirits (fxImmune) are not targetable. */
FX_ACTIONS.LV_UP_TURN = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'self'].includes(k)) && (a.self == null || a.self === true),      // v342 self: "Treat this Spirit as being one level higher"
  txt: () => 'target a Spirit; during this turn, it is treated as being one LV higher',
  cands: c => [...c.p.spirits, ...c.opp.spirits.filter(t => !fxImmune(c.opp, t))].filter(t => CARDS[t.id].levels.length > 1 && !t.lvPlusTurn),
  can: (c, a) => a && a.self ? !!c.src && c.p.spirits.includes(c.src) && CARDS[c.src.id].levels.length > 1 : FX_ACTIONS.LV_UP_TURN.cands(c).length > 0,
  run: async (c, a) => {
    if (a && a.self) { const me = c.src; if (!me || !c.p.spirits.includes(me) || CARDS[me.id].levels.length < 2) { c.ctx.did = false; return; } me.lvPlusTurn = true; io.view({ type: 'board' }); log(`${CARDS[me.id].name} is treated as being one LV higher this turn.`); return; }
    const L = FX_ACTIONS.LV_UP_TURN.cands(c); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? (L.find(s => c.p.spirits.includes(s)) || L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a Spirit to treat as one LV higher (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t.lvPlusTurn = true; io.view({ type: 'board' }); log(`${CARDS[t.id].name} is treated as being one LV higher this turn.`);
  } };

/* v328 DISCARD_ANY_CORES: "Discard any number of cards from your Hand. For each card discarded, send a core from a single opposing Spirit to the Trash." The Spirit is chosen first (protected ones are skipped), then up to its core count of cards may be discarded; the CPU discards up to 2 and keeps at least one card. */
FX_ACTIONS.DISCARD_ANY_CORES = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'discard any number of cards from your Hand; for each, send a core from a single opposing Spirit to the Trash',
  cands: c => c.opp.spirits.filter(t => t.cores > 0 && !fxImmune(c.opp, t)),
  can: c => FX_ACTIONS.DISCARD_ANY_CORES.cands(c).length > 0 && c.p.hand.some(h => h !== c.src),
  run: async c => {
    const L = FX_ACTIONS.DISCARD_ANY_CORES.cands(c); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a single opposing Spirit to take cores from.`);
    if (!t) { c.ctx.did = false; return; }
    const out = [];
    while (out.length < t.cores) {
      const H = c.p.hand.filter(h => h !== c.src); if (!H.length || (c.p.cpu && (out.length >= 2 || H.length < 2))) break;
      const d = c.p.cpu ? H.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, H, `✨ ${_pn(c)}`, `Choose a card to discard (${out.length} so far; each sends a core to the Trash). Skip to finish.`, true);
      if (!d) break;
      removeFrom(c.p.hand, d); c.p.trash.push(d); out.push(d);
      log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
    }
    c.ctx.did = out.length > 0; if (!out.length) return;
    await sentToTrashFx(c, out, 'hand');
    const m = Math.min(out.length, t.cores, coreTakeCap(c.opp, t, out.length));
    if (m > 0) { coreEvN(c.opp, t.uid, 'trash', m, false); t.cores -= m; c.opp.trashCores.n += m; log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Trash.`); }
    io.view({ type: 'board' });
  } };

/* v329 LIFE_HIT_DESTROY_TURN: "During this turn, when the attack of an opposing Spirit without Tribute reduces your Life, destroy that Spirit." Marks lifeHitDestroy on the player (turn number); 08-battle destroys the unblocked attacker after the Life loss unless it has Tribute or is protected (fxImmune). */
FX_ACTIONS.LIFE_HIT_DESTROY_TURN = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'during this turn, when an opposing Spirit without Tribute reduces your Life by attacking, destroy that Spirit',
  can: c => c.p.lifeHitDestroy !== G.turnNo,
  run: async c => { if (c.p.lifeHitDestroy === G.turnNo) { c.ctx.did = false; return; } c.p.lifeHitDestroy = G.turnNo; log(`${_nm(c)}: this turn, an attack without Tribute that reduces ${poss(c.p)} Life gets its Spirit destroyed.`); } };

/* v330 SPIRIT_TO_DECKTOP: "Move target Spirit to the top of its owner's Deck." Any Spirit; protected opposing Spirits are skipped. Reuses bounceCard(..., 'deckBottom') and then moves the card from the bottom to the top (Tokens just go home). */
FX_ACTIONS.SPIRIT_TO_DECKTOP = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "move a Spirit to the top of its owner's Deck",
  cands: c => [...c.p.spirits, ...c.opp.spirits.filter(t => !fxImmune(c.opp, t))],
  can: c => FX_ACTIONS.SPIRIT_TO_DECKTOP.cands(c).length > 0,
  run: async c => {
    const L = FX_ACTIONS.SPIRIT_TO_DECKTOP.cands(c); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? (L.find(s => c.opp.spirits.includes(s)) || L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a Spirit to move to the top of its owner's Deck (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    const own = c.p.spirits.includes(t) ? c.p : c.opp;
    bounceCard(own, t, 'deckBottom');
    if (own.deck[own.deck.length - 1] === t) { own.deck.pop(); own.deck.unshift(t); log(`${CARDS[t.id].name} is moved to the top of ${poss(own)} Deck.`); }
    checkDepletion(own); io.view({ type: 'board' });
  } };

/* v332 SPIRIT_BUT_ONE_TO_RESERVE: "Move all but 1 core from target Spirit to its owner's Reserve." Any Spirit with 2+ cores; protected opposing Spirits are skipped; the CPU takes the opposing one with the most cores (else its own). */
FX_ACTIONS.SPIRIT_BUT_ONE_TO_RESERVE = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "move all but 1 core from a Spirit to its owner's Reserve",
  cands: c => [...c.p.spirits, ...c.opp.spirits.filter(t => !fxImmune(c.opp, t))].filter(t => t.cores > 1),
  can: c => FX_ACTIONS.SPIRIT_BUT_ONE_TO_RESERVE.cands(c).length > 0,
  run: async c => {
    const L = FX_ACTIONS.SPIRIT_BUT_ONE_TO_RESERVE.cands(c); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? (L.filter(s => c.opp.spirits.includes(s)).sort((x, y) => y.cores - x.cores)[0] || L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a Spirit to leave with one core (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    const own = c.p.spirits.includes(t) ? c.p : c.opp;
    const m = Math.min(t.cores - 1, coreTakeCap(own, t, t.cores - 1)); if (m <= 0) { c.ctx.did = false; return; }
    coreEvN(own, t.uid, 'reserve', m, false); t.cores -= m; own.reserve.n += m;
    log(`${_nm(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(own)} ${CARDS[t.id].name} go to the Reserve.`); io.view({ type: 'board' });
  } };

/* v332 RESERVE_TRASH_MIRROR: "Move any number of cores from your Reserve to your Trash. Then move the same number of cores from the opposing Reserve to their Trash." The human picks 0-5; the CPU sends two (or fewer). The opposing part is capped by the opposing Reserve. */
FX_ACTIONS.RESERVE_TRASH_MIRROR = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'move any number of cores from your Reserve to your Trash; then the same number from the opposing Reserve to their Trash',
  can: c => c.p.reserve.n > 0,
  run: async c => {
    const cap = Math.min(5, c.p.reserve.n); let n = 0;
    if (c.p.cpu) n = Math.min(2, cap);
    else { const btn = []; for (let j = 0; j <= cap; j++) btn.push({ label: String(j), cls: j ? 'primary' : 'blue', value: j }); n = await ask({ title: `✨ ${esc(_nm(c))}`, html: 'How many cores from your Reserve to your Trash?', buttons: btn }) || 0; }
    if (n <= 0) { c.ctx.did = false; return; }
    c.p.reserve.n -= n; c.p.trashCores.n += n;
    const m = Math.min(n, c.opp.reserve.n); c.opp.reserve.n -= m; c.opp.trashCores.n += m;
    c.ctx.did = true; log(`${_nm(c)}: ${n} core${n === 1 ? '' : 's'} from ${poss(c.p)} Reserve and ${m} from ${poss(c.opp)} Reserve go to the Trash.`); io.view({ type: 'board' });
  } };

/* v335 DESTROY_FAMILY_THEN_ALL {family,n}: "If you control n or more <family> Spirits, destroy all of them. In that case, destroy all Spirits your opponent controls." */
FX_ACTIONS.DESTROY_FAMILY_THEN_ALL = {
  chk: a => typeof a.family === 'string' && !!a.family && Number.isInteger(a.n) && a.n >= 1 && a.n <= 9 && Object.keys(a).every(k => ['do', 'family', 'n', 'if'].includes(k)),
  txt: a => `if you control ${a.n}+ "${a.family}" Spirits, destroy all of them; then destroy every opposing Spirit`,
  can: (c, a) => c.p.spirits.filter(s => (CARDS[s.id].families || []).includes(a.family)).length >= a.n,
  run: async (c, a) => {
    const L = c.p.spirits.filter(s => (CARDS[s.id].families || []).includes(a.family)); if (L.length < a.n) { c.ctx.did = false; return; }
    for (const s of L) removeSpirit(c.p, s, 'destroyed', false);
    for (const s of c.opp.spirits.filter(x => !fxImmune(c.opp, x))) removeSpirit(c.opp, s, 'destroyed', true);
    checkDepletion(c.p); checkDepletion(c.opp); c.ctx.did = true; io.view({ type: 'board' });
  } };
/* v335 NEXUS_DESTROY_FOR_SPIRITS: "Destroy any number of Nexuses you control. For each Nexus destroyed, the opponent destroys a Spirit they control." Human picks 0..n; the CPU destroys as many as the opponent has Spirits (up to its Nexuses, fewest cores first). The opponent's Spirits are chosen by the engine (lowest BP first). */
FX_ACTIONS.NEXUS_DESTROY_FOR_SPIRITS = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'destroy any number of your Nexuses; for each, the opponent destroys a Spirit they control',
  can: c => c.p.nexus.length > 0,
  run: async c => {
    const L = c.p.nexus.filter(n => !n.noFx).sort((x, y) => x.cores - y.cores); const cap = Math.min(L.length, 5); let n = 0;
    if (c.p.cpu) n = Math.min(cap, c.opp.spirits.length);
    else { const btn = []; for (let j = 0; j <= cap; j++) btn.push({ label: String(j), cls: j ? 'primary' : 'blue', value: j }); n = await ask({ title: `✨ ${esc(_nm(c))}`, html: 'How many of your Nexuses to destroy?', buttons: btn }) || 0; }
    if (n <= 0) { c.ctx.did = false; return; }
    for (const t of L.slice(0, n)) { log(`${_nm(c)}: ${CARDS[t.id].name} is destroyed.`); removeNexus(c.p, t, 'destroyed'); }
    for (let i = 0; i < n; i++) { const V = c.opp.spirits.filter(x => !fxImmune(c.opp, x)).sort((x, y) => bpOf(x) - bpOf(y)); if (!V.length) break; log(`${CARDS[V[0].id].name} is destroyed.`); removeSpirit(c.opp, V[0], 'destroyed', true); }
    checkDepletion(c.opp); c.ctx.did = true; io.view({ type: 'board' });
  } };

/* v346 SELF_CORE_REFRESH: "By sending 1 core from this Spirit to your Trash, refresh this Spirit." (cost = one core of this Spirit; ctx.did = false when it is not exhausted or has no core; the CPU only pays while the Spirit keeps its current level) */
FX_ACTIONS.SELF_CORE_REFRESH = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'send a core from this Spirit to your Trash to refresh it',
  can: c => !!c.src && c.p.spirits.includes(c.src) && c.src.exhausted && c.src.cores > 0,
  run: async c => {
    const s = c.src;
    if (!s || !c.p.spirits.includes(s) || !s.exhausted || s.cores < 1 || (c.p.cpu && lvIndex(s) > 0 && s.cores - 1 < CARDS[s.id].levels[lvIndex(s)].cores)) { c.ctx.did = false; return; }
    const m = Math.min(1, s.cores, coreTakeCap(c.p, s, 1)); if (!m) { c.ctx.did = false; return; }
    coreEvN(c.p, s.uid, 'trash', m, false); s.cores -= m; c.p.trashCores.n += m;
    log(`${CARDS[s.id].name}: 1 core goes to the Trash.`);
    if (!c.p.spirits.includes(s)) return;
    refreshOne(s); log(`${CARDS[s.id].name} is refreshed.`); await fireFx(c.p, 'REFRESHED', s, {});
  } };
/* v348 MILL_OPP perMatchSpirit: "For each <family> Spirit you control, discard a card from the opposing decktop." */
(() => {
  const M = FX_ACTIONS.MILL_OPP, mChk = M.chk, mTxt = M.txt, mRun = M.run, cnt = (c, a) => Math.min(20, c.p.spirits.filter(x => fxMatch(CARDS[x.id], a.perMatchSpirit, x)).length);
  M.chk = a => a.perMatchSpirit != null ? (a.n == null && hasMatch(a.perMatchSpirit) && Object.keys(a).every(k => ['do', 'perMatchSpirit', 'if'].includes(k))) : mChk(a);
  M.txt = a => a.perMatchSpirit ? 'send cards from the top of the opposing Deck to the Trash, one for each matching Spirit you control' : mTxt(a);
  M.run = async (c, a) => { if (a.perMatchSpirit == null) return mRun(c, a); const n = cnt(c, a); if (!n) { c.ctx.did = false; return; } return mRun(c, { do: 'MILL_OPP', n }); };
})();
/* v350 DESTROY_EVERY match: "Destroy every opposing Cost 11 or less Brave Spirit" (match {hasBrave:true}) */
(() => {
  const D = FX_ACTIONS.DESTROY_EVERY, dChk = D.chk, dRun = D.run;
  D.chk = a => a.match != null ? (a.opposing === true && hasMatch(a.match) && dChk((({ match, ...r }) => r)(a)) && Object.keys(a).every(k => ['do', 'bpLe', 'costLe', 'costIs', 'opposing', 'match', 'if'].includes(k))) : dChk(a);
  D.run = async (c, a) => { if (a.match == null) return dRun(c, a);
    const hit = s => (a.bpLe != null ? bpOf(s) <= a.bpLe : a.costLe != null ? CARDS[s.id].cost <= a.costLe : CARDS[s.id].cost === a.costIs) && fxMatch(CARDS[s.id], a.match, s);
    for (const s of c.opp.spirits.filter(hit)) removeSpirit(c.opp, s, 'destroyed', true);
    checkDepletion(c.opp); };
})();
/* v352 DESTROY_BRAVE: "Destroy a Brave on an opposing Brave Spirit." The chosen opposing Spirit keeps its cores; its combined Brave card goes to its owner's Trash. Protected Spirits (fxImmune) cannot be chosen; ctx.did = false when there is none. */
Object.assign(FX_ACTIONS, {
  DESTROY_BRAVE: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'destroy a Brave on an opposing Brave Spirit',
    cands: c => c.opp.spirits.filter(t => t.brave && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.DESTROY_BRAVE.cands(c).length > 0,
    run: async (c) => { const L = FX_ACTIONS.DESTROY_BRAVE.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? L.slice().sort((a, b) => bpOf(b) - bpOf(a))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Brave Spirit whose Brave is destroyed (glowing).`);
      if (!t || !t.brave) { c.ctx.did = false; return; }
      const b = t.brave; t.brave = null; c.opp.trash.push(b); log(`${_nm(c)}: ${poss(c.opp)} ${CARDS[b.id].name} is destroyed.`); checkDepletion(c.opp); } },
});
wrapImmunity(Object.values(FX_ACTIONS));   // the actions above are defined after 02k: LO01
// v385/v386: attack an opposing Spirit instead of the Life (moved here from 02p, size cap)
FX_ACTIONS.ATTACK_SPIRIT = { chk: a => (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000)) && (a.state == null || a.state === 'refreshed' || a.state === 'exhausted') && (a.kind == null || a.kind === 'spirit') && (a.coresLe == null || Number.isInteger(a.coresLe)) && (a.coresGe == null || Number.isInteger(a.coresGe)) && (a.highest == null || a.highest === true) && Object.keys(a).every(k => ['do', 'bpLe', 'state', 'kind', 'coresLe', 'coresGe', 'highest', 'if'].includes(k)),
  txt: () => 'target an opposing Spirit and attack it',
  cands: (c, a) => c.opp.spirits.filter(t => (!a.bpLe || bpOf(t) <= a.bpLe) && (!a.state || t.exhausted === (a.state === 'exhausted')) && (a.kind !== 'spirit' || CARDS[t.id].type !== 'Ultimate') && (a.coresLe == null || totalCores(t) <= a.coresLe) && (a.coresGe == null || totalCores(t) >= a.coresGe) && (!a.highest || bpOf(t) >= Math.max(...c.opp.spirits.map(bpOf))) && !fxImmune(c.opp, t)),
  can: (c, a) => !!G.attacker && G.attacker === c.src && FX_ACTIONS.ATTACK_SPIRIT.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = G.attacker === c.src ? FX_ACTIONS.ATTACK_SPIRIT.cands(c, a) : [], t = L.length && await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to attack instead of the Life (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    c.src.atkT = { s: t, b: G.battleNo }; log(`${CARDS[c.src.id].name} targets ${poss(c.opp)} ${CARDS[t.id].name} and attacks it.`);
  } };

/* v330+ OWN_NEXUS_CORE_TO_VOID {n, name}: "send N cores from any of your <name> Nexuses to the Void" (the cost half of BS75-043; use it as the cost of a BY). Fails when no matching own Nexus has a core. */
FX_ACTIONS.OWN_NEXUS_CORE_TO_VOID = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'n', 'name'].includes(k)) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && typeof a.name === 'string' && a.name.length > 0,
  txt: a => `send ${a.n} core${a.n === 1 ? '' : 's'} from any of your "${a.name}" Nexuses to the Void`,
  cands: (c, a) => c.p.nexus.filter(x => x.cores >= a.n && CARDS[x.id].name.toLowerCase().includes(a.name.toLowerCase())),
  can: (c, a) => FX_ACTIONS.OWN_NEXUS_CORE_TO_VOID.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.OWN_NEXUS_CORE_TO_VOID.cands(c, a); c.ctx.did = false; if (!L.length) return;
    const t = L.length === 1 || c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your Nexus to send ${a.n} core${a.n === 1 ? '' : 's'} to the Void (glowing).`);
    if (!t) return;
    const k = Math.min(a.n, coreTakeCap(c.p, t, a.n)); if (k < a.n) return;
    coreEvN(c.p, t.uid, 'void', k, false); c.p.void += k; t.cores -= k; c.ctx.did = true;
    log(`${CARDS[c.src.id].name}: ${k} core${k === 1 ? '' : 's'} from ${CARDS[t.id].name} are sent to the Void.`);
  } };

/* v330+ NEXUS_LOCK {costLe}: "until your next Start Step, the effects of every opposing Cost N or less Nexus can't activate" (flag on the locking player, cleared in beginTurn of that player; read by `activatable`). */
FX_ACTIONS.NEXUS_LOCK = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'costLe'].includes(k)) && Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 20,
  txt: a => `until your next Start Step, the effects of every opposing Cost ${a.costLe} or less Nexus can't activate`,
  can: () => true,
  run: async (c, a) => { c.p.nexusLockLe = Math.max(c.p.nexusLockLe == null ? -1 : c.p.nexusLockLe, a.costLe); c.ctx.did = true; log(`${CARDS[c.src.id].name}: opposing Cost ${a.costLe} or less Nexus effects can't activate until ${poss(c.p)} next Start Step.`); } };

/* v398 LIFE_SYMBOL_SHIELD {symbolsGe, battle?}: "during this battle/turn, your Life can't be reduced by the attacks of opposing Spirits/Ultimates with N symbols or more" (BS75-069 Charged Crystal Cave) */
FX_ACTIONS.LIFE_SYMBOL_SHIELD = { chk: a => Number.isInteger(a.symbolsGe) && a.symbolsGe >= 1 && a.symbolsGe <= 5 && (a.battle == null || a.battle === true),
  txt: a => `during this ${a.battle ? 'battle' : 'turn'}, your Life can't be reduced by the attacks of opposing Spirits/Ultimates with ${a.symbolsGe} symbols or more`,
  can: () => true,
  run: async (c, a) => { c.p.symShield = { turn: G.turnNo, ge: a.symbolsGe, b: a.battle ? (G.battleNo || 0) : null }; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${poss(c.p)} Life can't be reduced by the attacks of opposing Spirits with ${a.symbolsGe} symbols or more this ${a.battle ? 'battle' : 'turn'}.`); } };

/* v399 CANT_AB_UNPREVENTABLE: "during this turn, all your Can't Attack/Block effects can't be prevented by opposing effects" (BS75-X10 Unleash): CANT_ATTACK_BLOCK then also targets Spirits that are unaffected by opposing effects (flag `p.cantAbFree` = turn number) */
FX_ACTIONS.CANT_AB_UNPREVENTABLE = { chk: () => true, txt: () => "during this turn, your Can't Attack/Block effects can't be prevented by opposing effects", can: () => true,
  run: async c => { c.p.cantAbFree = G.turnNo; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${poss(c.p)} Can't Attack/Block effects can't be prevented this turn.`); } };

/* v400 TURN_SUMMON_TAX {n 1-5, match?}: "During this turn, increase the LV cost of every opposing <match> Spirit/Ultimate/Nexus by +N." Stored as opp.turnTax [{turn, n, match}], read by summonTaxOf (effCost). */
FX_ACTIONS.TURN_SUMMON_TAX = {
  chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && (a.match == null || hasMatch(a.match)) && Object.keys(a).every(k => ['do', 'if', 'n', 'match'].includes(k)),
  txt: a => `during this turn, increase the cost of every opposing ${a.match ? 'matching ' : ''}card by +${a.n}`,
  can: () => true,
  run: async (c, a) => { c.opp.turnTax = (c.opp.turnTax || []).filter(t => t.turn === G.turnNo); c.opp.turnTax.push({ turn: G.turnNo, n: a.n, match: a.match || null }); c.ctx.did = true;
    log(`${CARDS[c.src.id].name}: the cost of opposing cards gets +${a.n} during this turn.`); } };
const canPursuit = (p, s) => !s.heavy && flagActive(p, 'PURSUIT', s);      // v408 "This exhausted Spirit can heavy exhaust to attack"
/* v410 OPP_CORES_DOWN_TO_SELF: "Send cores from an opposing Spirit to the Reserve until the number of cores on that Spirit is the same as this Spirit's" (BS53-020). */
FX_ACTIONS.OPP_CORES_DOWN_TO_SELF = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "send cores from an opposing Spirit to the Reserve until it has as many cores as this Spirit",
  cands: c => c.opp.spirits.filter(t => t.cores > c.src.cores && !fxImmune(c.opp, t)),
  can: c => FX_ACTIONS.OPP_CORES_DOWN_TO_SELF.cands(c).length > 0,
  run: async c => {
    const L = FX_ACTIONS.OPP_CORES_DOWN_TO_SELF.cands(c); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? L.slice().sort((x, y) => (y.cores - c.src.cores) - (x.cores - c.src.cores))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap the opposing Spirit to lower to ${c.src.cores} core(s) (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    const m = Math.min(t.cores - c.src.cores, coreTakeCap(c.opp, t, t.cores - c.src.cores)); if (m <= 0) { c.ctx.did = false; return; }
    coreEvN(c.opp, t.uid, 'reserve', m, false); t.cores -= m; c.opp.reserve.n += m;
    log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Reserve.`);
    checkDepletion(c.opp); io.view({ type: 'board' });
  } };
/* v420 Grandwalker Oracle Core Charge (cores come from the Void, capped on the Nexus) and the Grandwalker Skill "Refresh one of your <match> Spirits/Ultimates and put a core from the Void to it". */
Object.assign(FX_ACTIONS, {
  ORACLE_CORE: { chk: a => a.n === 1 && Number.isInteger(a.max) && a.max >= 1 && a.max <= 15 && Object.keys(a).every(k => ['do', 'if', 'n', 'max'].includes(k)),
    txt: a => `put a core from the Void to this Nexus (up to ${a.max} on it)`,
    can: (c, a) => c.p.nexus.includes(c.src) && c.src.cores < a.max,
    run: async (c, a) => { if (!c.p.nexus.includes(c.src) || c.src.cores >= a.max) { c.ctx.did = false; return; } takeFromVoid(c.p, 1); c.src.cores++; log(`${CARDS[c.src.id].name}: +1 core from the Void.`); } },
  REFRESH_PUT_CORE: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
    txt: () => 'refresh one of your matching Spirits/Ultimates and put a core from the Void to it',
    cands: (c, a) => c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match, s)),
    can: (c, a) => FX_ACTIONS.REFRESH_PUT_CORE.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.REFRESH_PUT_CORE.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L.some(s => s.exhausted) ? L.filter(s => s.exhausted) : L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits/Ultimates to refresh and give a core (glowing).`); if (!t) { c.ctx.did = false; return; }
      if (t.exhausted) { refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`); await fireFx(c.p, 'REFRESHED', t, {}); }
      takeFromVoid(c.p, 1); t.cores++; log(`${CARDS[c.src.id].name}: a core moves from the Void to ${CARDS[t.id].name}.`);
    } }
});
wrapImmunity(Object.values(FX_ACTIONS));
