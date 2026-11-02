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
      const d = L[Math.floor(Math.random() * L.length)]; removeFrom(c.opp.hand, d); c.opp.trash.push(d); k++;
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
  TRASH_TO_RESERVE: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'send all cores from your Trash to your Reserve',
    can: c => c.p.trashCores.n > 0,
    run: async (c, a) => { const m = c.p.trashCores.n; c.ctx.did = m > 0; if (!m) return; coreEvN(c.p, 'trash', 'reserve', m, false); c.p.trashCores.n -= m; c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} from the Trash go to ${poss(c.p)} Reserve.`); io.view({ type: 'board' }); } },
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

/* v316 NEXUS_CORES_ALL_TO_TRASH: "Move all cores from all Nexuses to their owner's Trash." Both sides; protected Nexuses (fxImmune) are skipped for the opponent only. */
FX_ACTIONS.NEXUS_CORES_ALL_TO_TRASH = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "move all cores from all Nexuses to their owner's Trash",
  can: c => c.p.nexus.some(x => x.cores > 0) || c.opp.nexus.some(x => x.cores > 0),
  run: async c => {
    let k = 0;
    for (const side of [c.p, c.opp]) for (const x of side.nexus) {
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

/* v324 CANT_ATTACK_BLOCK_ALL {costLe | costIn}: "During this turn, all Cost N or less (or Cost A/B) Spirits can't attack nor block." Both fields; protected Spirits are skipped (fxImmune); lasts to the End Step like CANT_ATTACK_BLOCK turn:true. */
FX_ACTIONS.CANT_ATTACK_BLOCK_ALL = {
  chk: a => Object.keys(a).every(k => ['do', 'if', 'costLe', 'costIn'].includes(k)) && ((Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30) !== (Array.isArray(a.costIn) && a.costIn.length > 0 && a.costIn.every(Number.isInteger))),
  txt: a => `during this turn, all Spirits with cost ${a.costLe != null ? a.costLe + ' or less' : a.costIn.join('/')} can't attack/block`,
  cands: (c, a) => [c.p, c.opp].flatMap(side => side.spirits.filter(s => !s.noAB && (a.costLe != null ? CARDS[s.id].cost <= a.costLe : a.costIn.includes(CARDS[s.id].cost)) && (side === c.p || !fxImmune(c.opp, s, c)))),
  can: (c, a) => FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.CANT_ATTACK_BLOCK_ALL.cands(c, a); c.ctx.did = L.length > 0;
    for (const t of L) { t.noAB = true; t.noABTurn = G.turnNo; }
    if (L.length) { log(`${CARDS[c.src.id].name}: ${L.length} Spirit${L.length === 1 ? '' : 's'} can't attack/block during this turn.`); io.view({ type: 'board' }); }
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

wrapImmunity(Object.values(FX_ACTIONS));   // the actions above are defined after 02k: LO01
