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
});
