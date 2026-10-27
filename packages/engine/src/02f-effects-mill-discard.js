/* ---------------------------------------------------------------------
   v0.39 PURPLE (Contractor Hades / Sorcerer): Deck-to-Trash (mill), discarding from the Hand, sending opposing cores to the Reserve, once-per-turn Count.
   Rules: manual "Depletion" - a Spirit left with fewer cores than its Lv1 requirement is depleted (not destroyed; checkDepletion);
   sending a core to the Reserve is not a destruction. "By discarding X, do Y" goes through the BY action (FAQ: X must be performable).
   --------------------------------------------------------------------- */
const _pn = c => CARDS[c.src.id].name;
Object.assign(FX_ACTIONS, {
  /* send n cards from the top of your Deck to the Trash. family + counter/draw: when a card of that family is among them, counter +counter and draw (Hound-Beros) */
  MILL: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && (a.family == null || typeof a.family === 'string') && (a.counter == null || (Number.isInteger(a.counter) && a.counter >= 1 && a.counter <= 3)) && (a.draw == null || (Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 3)),
    txt: a => `send ${a.n} cards from your Deck to the Trash${a.family ? ', and if a "' + a.family + '" family card is among them' + (a.counter ? ' counter +' + a.counter : '') + (a.draw ? ' and draw ' + a.draw : '') : ''}`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
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
  /* send cores from opposing Spirits/Ultimates to the opposing Reserve (not a destruction; a Spirit left below its Lv1 cores is depleted).
     {targets:T, each:K}: up to T different Spirits lose up to K cores each; {total:N}: N cores one by one from any Spirits. drawPerDepleted: draw 1 for each Spirit depleted by this (Vaplus). */
  OPP_CORES_TO_RESERVE: { chk: a => ((Number.isInteger(a.targets) && a.targets >= 1 && a.targets <= 3 && Number.isInteger(a.each) && a.each >= 1 && a.each <= 5) || (Number.isInteger(a.total) && a.total >= 1 && a.total <= 5)) && (a.drawPerDepleted == null || typeof a.drawPerDepleted === 'boolean'),
    txt: a => a.total ? `send ${a.total} cores from any opposing Spirits/Ultimates to the Reserve` : `send ${a.each} core${a.each === 1 ? '' : 's'} ${a.targets > 1 ? 'each from ' + a.targets + ' opposing Spirits/Ultimates' : 'from an opposing Spirit/Ultimate'} to the Reserve${a.drawPerDepleted ? ', and draw a card for each depleted target' : ''}`,
    cands: c => c.opp.spirits.filter(t => t.cores > 0 && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.OPP_CORES_TO_RESERVE.cands(c).length > 0,
    run: async (c, a) => {
      const hit = new Set(); let moved = 0;
      const take = (t, k) => { const m = Math.min(k, t.cores); coreEvN(c.opp, t.uid, 'reserve', m, false); t.cores -= m; c.opp.reserve.n += m; moved += m; hit.add(t); log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Reserve.`); };
      if (a.total) {
        for (let j = 0; j < a.total; j++) {
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
  COUNTER_ONCE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `(once per turn) counter +${a.n}`,
    run: async (c, a) => {
      const k = 'cnt:' + _pn(c); c.p.onceUsed = c.p.onceUsed || {};
      if (c.p.onceUsed[k] === G.turnNo) { c.ctx.did = false; return; }
      c.p.onceUsed[k] = G.turnNo; await FX_ACTIONS.COUNTER.run(c, { n: a.n });
    } }
});
