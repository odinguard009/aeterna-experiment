/* ---------------------------------------------------------------------
   v0.39 PURPLE (Contractor Hades / Sorcerer): Deck-to-Trash (mill), discarding from the Hand, sending opposing cores to the Reserve, once-per-turn Count.
   Rules: manual "Depletion" - a Spirit left with fewer cores than its Lv1 requirement is depleted (not destroyed; checkDepletion);
   sending a core to the Reserve is not a destruction. "By discarding X, do Y" goes through the BY action (FAQ: X must be performable).
   --------------------------------------------------------------------- */
const _pn = c => CARDS[c.src.id].name;
Object.assign(FX_ACTIONS, {
  /* send n cards from the top of your Deck to the Trash. family + counter/draw: when a card of that family is among them, counter +counter and draw (Hound-Beros) */
  MILL_OPP: { chk: a => ((Number.isInteger(a.n) && a.n >= 1 && a.n <= 20) || (a.n == null && (a.perOppHand === true || a.perLostCores === true))) && (a.perOppHand == null || a.perOppHand === true) && (a.perLostCores == null || (a.perLostCores === true && a.perOppHand == null && a.n == null)) && Object.keys(a).every(k => ['do', 'n', 'perOppHand', 'perLostCores', 'if'].includes(k)),   // v304 perLostCores: one card per core that was on this Spirit when it was destroyed      // v259 perOppHand: one card per card in the opposing Hand      // v237 "discard N cards from the opposing decktop"
    txt: a => a.perLostCores ? 'send cards from the top of the opposing Deck to the Trash, one for each core that was on this Spirit' : a.perOppHand ? 'send cards from the top of the opposing Deck to the Trash, one for each card in the opposing Hand' : `send the top ${a.n} card${a.n === 1 ? '' : 's'} of the opposing Deck to the Trash`,
    can: c => c.opp.deck.length > 0,
    run: async (c, a) => {
      const top = c.opp.deck.splice(0, Math.min(a.perLostCores ? (c.src.lostCores || 0) : a.perOppHand ? c.opp.hand.length : a.n, c.opp.deck.length)); if (!top.length) { c.ctx.did = false; return; }
      for (const x of top) c.opp.trash.push(x);
      log(`${_pn(c)}: ${top.length} card${top.length === 1 ? '' : 's'} from the opposing Deck go to the Trash.`);
      io.view({ type: 'board' });
    } },
  OPP_CORES_TO_TRASH: { chk: a => a.untilOne === true ? (a.total == null && a.costLe == null) : (a.untilOne == null && Number.isInteger(a.total) && a.total >= 1 && a.total <= 10 && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30))),      // v271 untilOne: "send all but one of the Cores on one of the opposing Spirits to the Trash"
    txt: a => a.untilOne ? 'send all but one core from an opposing Spirit to the Trash' : `send ${a.total} core${a.total === 1 ? '' : 's'} from any opposing Spirits/Ultimates to the Trash`,
    cands: (c, a) => c.opp.spirits.filter(t => t.cores > (a && a.untilOne ? 1 : 0) && !fxImmune(c.opp, t) && (a == null || a.costLe == null || CARDS[t.id].cost <= a.costLe)),
    can: (c, a) => FX_ACTIONS.OPP_CORES_TO_TRASH.cands(c, a).length > 0,
    run: async (c, a) => {
      let moved = 0;
      if (a.untilOne) {
        const L = FX_ACTIONS.OPP_CORES_TO_TRASH.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
        const t = c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap an opposing Spirit to leave with one core.`);
        if (!t) { c.ctx.did = false; return; }
        const m = Math.min(t.cores - 1, coreTakeCap(c.opp, t, t.cores - 1)); if (m <= 0) { c.ctx.did = false; return; }
        coreEvN(c.opp, t.uid, 'trash', m, false); t.cores -= m; c.opp.trashCores.n += m;
        log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Trash.`);
        io.view({ type: 'board' }); return;
      }
      for (let j = 0; j < a.total; j++) {
        const L = FX_ACTIONS.OPP_CORES_TO_TRASH.cands(c); if (!L.length) break;
        const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap an opposing Spirit to take a core from (${j + 1}/${a.total}).`);
        if (!t) break;
        const m = Math.min(1, t.cores, coreTakeCap(c.opp, t, 1)); if (!m) continue;
        coreEvN(c.opp, t.uid, 'trash', m, false); t.cores -= m; c.opp.trashCores.n += m; moved += m;
        log(`${_pn(c)}: ${m} core from ${poss(c.opp)} ${CARDS[t.id].name} goes to the Trash.`);
      }
      if (!moved) { c.ctx.did = false; return; }
      checkDepletion(c.opp);
      io.view({ type: 'board' });
    } },
  MILL: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && (a.family == null || typeof a.family === 'string') && (a.counter == null || (Number.isInteger(a.counter) && a.counter >= 1 && a.counter <= 3)) && (a.draw == null || (Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 3)),
    txt: a => `send ${a.n} cards from your Deck to the Trash${a.family ? ', and if a "' + a.family + '" family card is among them' + (a.counter ? ' counter +' + a.counter : '') + (a.draw ? ' and draw ' + a.draw : '') : ''}`,
    can: c => c.p.deck.length > 0 && !deckDiscardLocked(),
    run: async (c, a) => {
      if (deckDiscardLocked()) { c.ctx.did = false; log(`${_pn(c)}: cards can't be discarded from a Deck.`); return; }
      const top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); if (!top.length) { c.ctx.did = false; return; }
      for (const x of top) c.p.trash.push(x);
      log(`${_pn(c)}: ${top.length} card${top.length === 1 ? '' : 's'} from the Deck go to the Trash.`);
      c.ctx.milled = top;
      await sentToTrashFx(c, top, 'deck');               // v0.47 Hades Disaster (an Infernal Lord effect)
      if (a.family && top.some(x => (CARDS[x.id].families || []).includes(a.family))) {
        if (a.counter) await FX_ACTIONS.COUNTER.run(c, { n: a.counter });
        if (a.draw) { const k = draw(c.p, a.draw); log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
      }
    } },
  /* discard n cards from the Hand (you choose; the CPU throws away the cheapest). match limits the cards that may be discarded (Purple, a name or family).
     Used as the cost of BY ("by discarding a card from your Hand, ..."). ctx.discardedCost = cost of the last discarded card. */
  DISCARD_HAND: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.match == null || hasMatch(a.match)),
    txt: a => `discard ${a.n === 1 ? 'a' : a.n} ${a.match && a.match.color ? a.match.color[0].toUpperCase() + a.match.color.slice(1) + ' ' : ''}card${a.n === 1 ? '' : 's'} from your Hand`,
    cands: (c, a) => c.p.hand.filter(h => h !== c.src && (!a.match || fxMatch(CARDS[h.id], a.match))),   // never the card that pays with it (a Magic still in the Hand while its use is checked)
    can: (c, a) => FX_ACTIONS.DISCARD_HAND.cands(c, a).length >= a.n,
    run: async (c, a) => {
      if (!FX_ACTIONS.DISCARD_HAND.can(c, a)) { c.ctx.did = false; return; }
      const out = [];
      for (let j = 0; j < a.n; j++) {
        const L = FX_ACTIONS.DISCARD_HAND.cands(c, a); if (!L.length) break;
        const d = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, 'Choose a card from your Hand to discard.', false);
        removeFrom(c.p.hand, d); c.p.trash.push(d); out.push(d); c.ctx.discardedCost = CARDS[d.id].cost;
        log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      await sentToTrashFx(c, out, 'hand');               // v0.47 Hades Disaster discarded by Contractor Hades
      io.view({ type: 'board' });
    } },
  /* v262 DISCARD_ANY_DRAW {match}: "Discard any number of <X> cards from your Hand. For each card you discarded, draw a card." (the player may stop at any time; the CPU discards every matching card) */
  DISCARD_ANY_DRAW: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)),
    txt: () => 'discard any number of matching cards from your Hand, draw a card for each',
    cands: (c, a) => c.p.hand.filter(h => h !== c.src && fxMatch(CARDS[h.id], a.match)),
    can: () => true,
    run: async (c, a) => {
      const out = [];
      for (;;) {
        const L = FX_ACTIONS.DISCARD_ANY_DRAW.cands(c, a); if (!L.length) break;
        const d = c.p.cpu ? L[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose a card to discard (${out.length} so far; each draws a card). Skip to finish.`, true);
        if (!d) break;
        removeFrom(c.p.hand, d); c.p.trash.push(d); out.push(d);
        log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      c.ctx.did = out.length > 0;
      if (out.length) { await sentToTrashFx(c, out, 'hand'); const k = draw(c.p, out.length); log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
      io.view({ type: 'board' });
    } },
  /* v0.197 (schema 129) HAND_TO_BOTTOM {n:1..2}: "You can return N card(s) from your Hand to the deckbottom" (an optional cost-like step: did = N cards were returned; the CPU returns its cheapest cards while it keeps at least one). */
  HAND_TO_BOTTOM: { chk: a => Object.keys(a).every(k => ['do', 'if', 'n', 'forced'].includes(k)) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 2 && (a.forced == null || a.forced === true),
    txt: a => `${a.forced ? '' : 'you can '}return ${a.n === 1 ? 'a card' : a.n + ' cards'} from your Hand to the deckbottom`,
    can: (c, a) => c.p.hand.length >= a.n,
    run: async (c, a) => {
      if (c.p.hand.length < a.n || (c.p.cpu && !a.forced && c.p.hand.length <= a.n)) { c.ctx.did = false; return; }
      const out = [];
      for (let j = 0; j < a.n; j++) {
        const L = c.p.hand.filter(h => !out.includes(h)); if (!L.length) break;
        const d = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, `Return ${a.n === 1 ? 'a card' : 'two cards'} from your Hand to the deckbottom? (${j + 1}/${a.n})`, !a.forced);
        if (!d) { for (const t of out) { removeFrom(c.p.deck, t); c.p.hand.push(t); } c.ctx.did = false; return; }   // declined: put back what was already moved
        removeFrom(c.p.hand, d); c.p.deck.push(d); out.push(d);
      }
      log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'returns' : 'return'} ${out.length} card${out.length === 1 ? '' : 's'} from the Hand to the deckbottom.`);
      io.view({ type: 'board' });
    } },
  /* send cores from opposing Spirits/Ultimates to the opposing Reserve (not a destruction; a Spirit left below its Lv1 cores is depleted).
     {targets:T, each:K}: up to T different Spirits lose up to K cores each; {total:N}: N cores one by one from any Spirits. drawPerDepleted: draw 1 for each Spirit depleted by this (Vaplus). */
  OPP_CORES_TO_RESERVE: { chk: a => ((Number.isInteger(a.targets) && a.targets >= 1 && a.targets <= 3 && Number.isInteger(a.each) && a.each >= 0 && a.each <= 5) || (Number.isInteger(a.total) && a.total >= 1 && a.total <= 7) || a.perSource != null || a.allTargets === true) && (a.drawPerDepleted == null || typeof a.drawPerDepleted === 'boolean') && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.perSource == null || ['own', 'oppColors', 'nexus', 'srcLv'].includes(a.perSource)) && (a.allTargets == null || (a.allTargets === true && Number.isInteger(a.each) && a.each >= 1 && a.each <= 5)) && (a.perMatch == null || (a.perSource === 'own' && typeof a.perMatch === 'object')),      // v196 costLe: "target an opposing Cost N or less Spirit"
    txt: a => a.total ? `send ${a.total} cores from any opposing Spirits/Ultimates to the Reserve` : `send ${a.each} core${a.each === 1 ? '' : 's'} ${a.targets > 1 ? 'each from ' + a.targets + ' opposing Spirits/Ultimates' : 'from an opposing Spirit/Ultimate'} to the Reserve${a.drawPerDepleted ? ', and draw a card for each depleted target' : ''}`,
    cands: (c, a) => c.opp.spirits.filter(t => t.cores > 0 && !fxImmune(c.opp, t) && (a == null || a.costLe == null || CARDS[t.id].cost <= a.costLe)),
    can: (c, a) => FX_ACTIONS.OPP_CORES_TO_RESERVE.cands(c, a).length > 0,
    run: async (c, a) => {
      const hit = new Set(); let moved = 0;
      const take = (t, k) => { const m = Math.min(k, t.cores, coreTakeCap(c.opp, t, k)); hit.add(t); if (!m) return; coreEvN(c.opp, t.uid, 'reserve', m, false); t.cores -= m; c.opp.reserve.n += m; moved += m; log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Reserve.`); };      // v190 CORE_SAFE
      if (a.allTargets) {
        const L = FX_ACTIONS.OPP_CORES_TO_RESERVE.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
        for (const t of L) take(t, a.untilOne ? Math.max(0, t.cores - 1) : (a.each || 1));      // v298 untilOne with allTargets: all but one core from every target
      } else if (a.total || a.perSource) {
        const total = a.perSource === 'oppColors' ? new Set(c.opp.spirits.concat(c.opp.nexus).map(x => { const k = CARDS[x.id]; return (k.colors || [k.color, k.symbol]).filter(Boolean); }).flat()).size : a.perSource === 'nexus' ? c.p.nexus.length : a.perSource === 'srcLv' ? Math.max(1, lvNo(c.src)) : a.perSource === 'own' ? perCount(c.p, a.perMatch) : a.total;
        for (let j = 0; j < total; j++) {
          const L = FX_ACTIONS.OPP_CORES_TO_RESERVE.cands(c); if (!L.length) break;
          const t = c.p.cpu ? L.slice().sort((x, y) => ((totalCores(x) - 1 < CARDS[x.id].levels[0].cores) ? 0 : 1) - ((totalCores(y) - 1 < CARDS[y.id].levels[0].cores) ? 0 : 1) || bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap an opposing Spirit to take a core from (${j + 1}/${a.total}).`);
          if (!t) break; take(t, 1);
        }
      } else {
        const L = FX_ACTIONS.OPP_CORES_TO_RESERVE.cands(c); if (!L.length) { c.ctx.did = false; return; }
        const T = await pickOppSpirits(c, L, a.targets, `✨ <b>${esc(_pn(c))}</b><br>Tap the opposing Spirit to send ${a.each} core${a.each === 1 ? '' : 's'} from (glowing).`);
        for (const t of T) take(t, a.each);
      }
      if (!moved) { c.ctx.did = false; return; }
      checkDepletion(c.opp);
      const gone = [...hit].filter(t => !c.opp.spirits.includes(t)).length;
      if (gone) log(`${_pn(c)}: ${gone} opposing Spirit${gone === 1 ? ' is' : 's are'} depleted.`);
      if (a.drawPerDepleted && gone) { const k = draw(c.p, gone); log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
      io.view({ type: 'board' });
    } },
  /* "Then, once per turn, your counter +n" (Contractor Hades' Contract Skill): the Count part has its own once-per-turn limit, the rest of the effect does not */
  COUNTER_ONCE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 7, txt: a => `(once per turn) counter +${a.n}`,
    run: async (c, a) => {
      const k = 'cnt:' + _pn(c); c.p.onceUsed = c.p.onceUsed || {};
      if (c.p.onceUsed[k] === G.turnNo) { c.ctx.did = false; return; }
      c.p.onceUsed[k] = G.turnNo; await FX_ACTIONS.COUNTER.run(c, { n: a.n });
    } }
});

/* v169 "discard your entire Hand" (did = at least one card was discarded; the card that pays with it stays). */
FX_ACTIONS.DISCARD_ALL_HAND = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'discard your entire Hand',
  can: c => c.p.hand.some(h => h !== c.src),
  run: async c => {
    const out = c.p.hand.filter(h => h !== c.src); if (!out.length) { c.ctx.did = false; return; }
    for (const d of out) { removeFrom(c.p.hand, d); c.p.trash.push(d); log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`); }
    await sentToTrashFx(c, out, 'hand'); io.view({ type: 'board' });
  } };
