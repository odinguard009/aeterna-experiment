/* ---- FX_ACTIONS, part 3 of 5 (v0.106.0 split of the old 516-line 02b-effects-actions.js) ----
   The Deck and the Hand: reveal and pick, summon from the Hand, Loot and the Void core moves.
   Object.assign keeps the original entry order. Only the entries that 02m and 02p capture at
   load time must load before those parts, which is why the targeting actions stay in 02b;
   every other entry here is read from inside a function.
   ------------------------------------------------------------------------------------ */
Object.assign(FX_ACTIONS, {
  REVEAL_PICK: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && hasMatch(a.match) && ['trash', 'bottom', 'top', 'either'].includes(a.rest) && (a.diffName == null || a.diffName === true) && (a.all == null || a.all === true),   // v0.181 all: "add every matching card among them"; v0.69 diffName: "a card name different from this Spirit's"
    txt: a => `reveal ${a.n} cards from the top of your Deck, add a matching card to your Hand, ${a.rest === 'trash' ? 'discard' : a.rest === 'top' ? 'return to the top of the Deck' : a.rest === 'either' ? 'return to the top or the bottom of the Deck' : 'return to the bottom of the Deck'} the rest`,      // v0.75 rest top / either
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      let t = null;
      if (a.all) { const L = c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match) && (!a.diffName || CARDS[x.id].name !== nm)); for (const x of L) { removeFrom(c.p.revealed, x); c.p.hand.push(x); log(`${nm}: ${CARDS[x.id].name} is added to the Hand.`); } if (L.length) { handUp(c.p, L.length); t = L[0]; } }
      else t = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match) && (!a.diffName || CARDS[x.id].name !== nm)), `✨ ${nm}`, 'Choose a revealed card to add to your Hand.', true);
      if (t && !a.all) { removeFrom(c.p.revealed, t); c.p.hand.push(t); handUp(c.p, 1); log(`${nm}: ${CARDS[t.id].name} is added to the Hand.`); }
      const rest = c.p.revealed.splice(0);
      if (a.rest === 'trash') { for (const x of rest) c.p.trash.push(x); if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} discarded.`); }
      else {
        let top = a.rest === 'top';      // v0.75: "either the decktop or the deckbottom": the owner chooses (CPU: bottom)
        if (a.rest === 'either' && rest.length && !c.p.cpu) top = (await ask({ title: `✨ ${nm}`, peek: true, wide: true, html: 'Return the remaining revealed card(s) to the top or the bottom of your Deck?', cards: cardIds(rest), buttons: [{ label: 'Decktop', cls: 'primary', value: true }, { label: 'Deckbottom', cls: 'blue', value: false }] })) === true;
        if (top) c.p.deck.unshift(...rest); else for (const x of rest) c.p.deck.push(x);
      }
      c.ctx.did = !!t;
    } },
  /* v0.37 LOOT: draw n, then discard m cards from the Hand (you choose). drawPlus {n, if}: extra cards when the condition holds; discardLessPerName: -1 discard per matching card you control;
     famCostDestroy: when the discarded card has that family, the next action {"costLeDiscarded":true} may destroy a Spirit with cost <= the discarded card (prev is false otherwise) */
  REVEAL_DEPLOY: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && hasMatch(a.match) && (a.pay == null || typeof a.pay === 'boolean') && (a.rest == null || a.rest === 'trash') && (a.diffName == null || a.diffName === true) && (a.add == null || (hasMatch(a.add.match) && Number.isInteger(a.add.lv))) && (a.allowBrave == null || (a.allowBrave === true && !a.pay)),
    txt: a => `reveal ${a.n} cards from the top of your Deck, summon/deploy a matching card among them${a.pay ? ' (paying its cost)' : ''}${a.add ? ', from Lv' + a.add.lv + ' add a matching card to your Hand' : ''}, ${a.rest === 'trash' ? 'discard' : 'return to the bottom of the Deck'} the rest`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      let k = 0;
      const dep = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match) && (!a.diffName || CARDS[x.id].name !== nm) && (a.allowBrave && CARDS[x.id].type === 'Brave' ? canPlaceBraveFree(c.p, x) : canPlaceBy(c.p, x, a.pay))), `✨ ${nm}`, 'Choose a revealed card to summon/deploy' + (a.pay ? ' (you pay its cost).' : '.'), true);
      if (dep) { removeFrom(c.p.revealed, dep); c.p.hand.push(dep); if (await summonBy(c.p, dep, a.pay)) k++; else { removeFrom(c.p.hand, dep); c.p.revealed.push(dep); } }
      if (a.add && fieldList(c.p).concat(c.p.trash).includes(c.src) && lvNo(c.src) >= a.add.lv) {
        const t = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.add.match)), `✨ ${nm}`, 'You can add a revealed matching card to your Hand.', true);
        if (t) { removeFrom(c.p.revealed, t); c.p.hand.push(t); handUp(c.p, 1); log(`${nm}: ${CARDS[t.id].name} is added to the Hand.`); k++; }
      }
      const rest = c.p.revealed.splice(0); for (const x of rest) (a.rest === 'trash' ? c.p.trash : c.p.deck).push(x);      // v0.184 rest 'trash': "Discard the remaining cards"
      if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} ${a.rest === 'trash' ? 'discarded' : 'return to the bottom of the Deck'}.`);
      c.ctx.did = k > 0;
    } },
  /* "destroy any number of opposing Spirits up to a total of X BP" (the destroyed cards are kept in ctx.destroyed) */
  LOOT: { chk: a => Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 5 && Number.isInteger(a.discard) && a.discard >= 1 && a.discard <= 5
      && (a.drawPlus == null || (a.drawPlus && Number.isInteger(a.drawPlus.n) && a.drawPlus.n >= 1 && a.drawPlus.n <= 3 && a.drawPlus.if && !parseCond(a.drawPlus.if).error))
      && (a.to == null || a.to === 'deckBottom') && (a.discardLessPerName == null || (typeof a.discardLessPerName === 'string' && a.discardLessPerName.length > 0)) && (a.famCostDestroy == null || (typeof a.famCostDestroy === 'string' && a.famCostDestroy.length > 0)),
    txt: a => `draw ${a.draw}${a.drawPlus ? ' (+' + a.drawPlus.n + ' in a set condition)' : ''}, then ${a.to === 'deckBottom' ? 'return' : 'discard'} ${a.discard}${a.to === 'deckBottom' ? ' to the deckbottom' : ''}${a.discardLessPerName ? ' (-1 for each ' + a.discardLessPerName + ' you control)' : ''}${a.famCostDestroy ? '; a discarded ' + a.famCostDestroy + ' card lets you destroy a Spirit with cost equal or less' : ''}`,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, n = a.draw + (a.drawPlus && fxIf(c.p, c.opp, a.drawPlus.if, c.ctx) ? a.drawPlus.n : 0);
      const k = draw(c.p, n); log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k);
      let m = a.discard; if (a.discardLessPerName) { const w = a.discardLessPerName.toLowerCase(); m = Math.max(0, m - fieldList(c.p).filter(f => CARDS[f.id].name.toLowerCase().includes(w)).length); }
      m = Math.min(m, c.p.hand.length); let last = null; c.ctx.discardedCost = null;
      for (let j = 0; j < m && c.p.hand.length; j++) {
        let d;
        if (c.p.cpu) d = c.p.hand.slice().sort((x, y) => (CARDS[x.id].cost - CARDS[y.id].cost) || (+(CARDS[x.id].type === 'Nexus') - +(CARDS[y.id].type === 'Nexus')))[0];
        else {
          const v = await ask({ title: `✨ ${nm}`, peek: true, html: `${a.to === 'deckBottom' ? 'Return a card from your Hand to the deckbottom' : 'Discard a card from your Hand'} (${m - j} left).`, buttons: c.p.hand.slice(0, 12).map(x => ({ label: `${CARDS[x.id].name} (cost ${CARDS[x.id].cost})`, cls: 'primary', value: x.uid })) });
          d = c.p.hand.find(x => x.uid === v) || c.p.hand[0];
        }
        removeFrom(c.p.hand, d); (a.to === 'deckBottom' ? c.p.deck : c.p.trash).push(d); last = d;
        log(a.to === 'deckBottom' ? `${nm}: ${who(c.p)} ${c.p.cpu ? 'returns' : 'return'} a card from the Hand to the deckbottom.` : `${nm}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      if (a.famCostDestroy) { const hit = !!last && (CARDS[last.id].families || []).includes(a.famCostDestroy); c.ctx.discardedCost = hit ? CARDS[last.id].cost : null; c.ctx.did = hit; }
    } },
  /* v0.165 "Show up to N <X> cards from your Hand to the opponent. Return them to the deckbottom in any order. For each card returned, draw a card." (drawEach), or
     "If two cards are returned, draw three cards." (drawIf {n, draw}); ctx.did = at least one card was returned, so "If returned, ..." (Then) follows. The human picks each card in turn
     (the pick order is the deck order, as for LOOT to the deckbottom); the CPU returns the cheapest matching cards. Showing is not modelled: the cards stay public in the log. */
  SHOW_RETURN: { chk: a => Number.isInteger(a.max) && a.max >= 1 && a.max <= 3 && hasMatch(a.match) && (a.drawEach == null || a.drawEach === true)
      && (a.drawIf == null || (a.drawIf && Number.isInteger(a.drawIf.n) && a.drawIf.n >= 1 && a.drawIf.n <= 3 && Number.isInteger(a.drawIf.draw) && a.drawIf.draw >= 1 && a.drawIf.draw <= 5)),
    txt: a => `show up to ${a.max} matching card${a.max === 1 ? '' : 's'} from your Hand and return them to the deckbottom${a.drawEach ? '; draw a card for each returned' : ''}${a.drawIf ? '; if ' + a.drawIf.n + ' returned, draw ' + a.drawIf.draw : ''}`,
    can: (c, a) => c.p.hand.some(h => fxMatch(CARDS[h.id], a.match)),
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, ok = h => fxMatch(CARDS[h.id], a.match); let k = 0;
      for (let j = 0; j < a.max; j++) {
        const L = c.p.hand.filter(ok); if (!L.length) break;
        let d;
        if (c.p.cpu) d = L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0];
        else {
          const v = await ask({ title: `✨ ${nm}`, peek: true, html: `Show a card from your Hand and return it to the deckbottom (${a.max - j} left).`, buttons: L.slice(0, 12).map(x => ({ label: `${CARDS[x.id].name} (cost ${CARDS[x.id].cost})`, cls: 'primary', value: x.uid })).concat([{ label: 'Done', cls: '', value: 'done' }]) });
          d = c.p.hand.find(x => x.uid === v); if (!d) break;
        }
        removeFrom(c.p.hand, d); c.p.deck.push(d); k++;
        log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'shows' : 'show'} ${CARDS[d.id].name} and ${c.p.cpu ? 'returns' : 'return'} it to the deckbottom.`);
      }
      c.ctx.did = k > 0; if (!k) return;
      const n = a.drawEach ? k : (a.drawIf && k === a.drawIf.n ? a.drawIf.draw : 0);
      if (n) { const got = draw(c.p, n); log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${got} card${got === 1 ? '' : 's'}.`); handUp(c.p, got); }
    } },
  /* v0.37 Contract Field of Contractor Nuadha: when doing Neo-Core Charge, instead of +1 core to this Nexus you can +1 counter (the player chooses; the CPU builds the Count first) */
  SUMMON_SELF: { chk: () => true, txt: () => 'summon this card without paying the cost',
    can: c => !!c.burst && canPlaceFree(c.p, c.src),
    run: async c => { if (!c.burst || !canPlaceFree(c.p, c.src)) return; await summonFree(c.p, c.src); c.summoned = true; } },
  VOID_TO_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to your Reserve`,
    run: async (c, a) => { const m = takeFromVoid(c.p, a.n); c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Reserve.`); } },
  VOID_TO_TRASH: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to your Trash`,      // v0.75: the cores come back to the Reserve in the next Refresh Step
    run: async (c, a) => { const m = takeFromVoid(c.p, a.n); c.p.trashCores.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Trash.`); } },
  CORE_OR_COUNTER: { chk: a => a.n === 1, txt: () => '+1 core to this Nexus, or +1 counter instead',
    run: async c => {
      let counter;
      if (c.p.cpu) counter = c.p.count < 5;
      else { const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, html: 'Neo-Core Charge: choose what you get.', buttons: [{ label: '+1 core to this Nexus', cls: 'primary', value: 'core' }, { label: '+1 counter', cls: 'primary', value: 'counter' }] }); counter = v === 'counter'; }
      if (counter) await FX_ACTIONS.COUNTER.run(c, { n: 1 }); else await FX_ACTIONS.CORE_TO_SELF.run(c, { n: 1 });
    } }
});

/* This part loads after 02k, whose load-time pass wraps every action's cands() with the immunity
   filter (trash-safe cards, opposing cards unaffected by this effect). Run it again so the entries
   defined here get the same wrapper; it is idempotent. */
wrapImmunity(Object.values(FX_ACTIONS));
