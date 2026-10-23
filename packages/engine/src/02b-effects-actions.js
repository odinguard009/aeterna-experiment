const FX_ACTIONS = {
  DRAW: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `draw ${a.n} card${a.n === 1 ? '' : 's'}`,
    run: async (c, a) => { const k = draw(c.p, a.n); log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); } },
  COUNTER: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && (a.max == null || (Number.isInteger(a.max) && a.max >= 1 && a.max <= 30)), txt: a => `counter +${a.n}${a.max ? ' (max ' + a.max + ' counters)' : ''}`,
    run: async (c, a) => {
      const n = a.max != null ? Math.max(0, Math.min(a.n, a.max - c.p.count)) : a.n;
      if (!n) { c.ctx.did = false; log(`${CARDS[c.src.id].name}: the counter is already at its maximum.`); return; }
      takeFromVoid(c.p, n); c.p.count += n; log(`${CARDS[c.src.id].name}: counter +${n}.`);      // official: Count Area cores come from the Void
    } },
  /* v0.35 Tokens: "send out (up to) N of your <Token>" — no cost, cores for Lv1 from the Field/Reserve, not a summon; ask:true = "you can" inside the effect */
  SEND_TOKEN: { chk: a => typeof a.token === 'string' && /^[A-Z0-9-]{3,30}$/.test(a.token) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.ask == null || typeof a.ask === 'boolean'),
    txt: a => `${a.ask ? 'you can ' : ''}send out ${a.n === 1 ? 'one' : 'up to ' + a.n} of your "${CARDS[a.token] ? CARDS[a.token].name : a.token}" Token${a.n === 1 ? '' : 's'}`,
    can: (c, a) => canSendToken(c.p, a.token),
    run: async (c, a) => {
      if (!canSendToken(c.p, a.token)) { c.ctx.did = false; return; }
      let want = a.n;
      if (!c.p.cpu && (a.ask || a.n > 1)) {
        const buttons = [];
        for (let k = a.n; k >= 1; k--) buttons.push({ label: `Send out ${k}`, cls: 'primary', value: k });
        if (a.ask) buttons.push({ label: 'Skip', cls: 'cancel', value: 0 });
        want = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Send out "${esc(CARDS[a.token].name)}" Token${a.n === 1 ? '' : 's'}? (${c.p.tokens[a.token]} left in your Token supply)`, buttons });
      }
      let k = 0; for (let j = 0; j < (want || 0); j++) if (sendToken(c.p, a.token)) k++;
      c.ctx.did = k > 0;
    } },
  /* "during this battle, this Spirit gains N extra symbol(s)" (cleared when the battle ends) */
  SYMBOL_PLUS: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3, txt: a => `during this battle, this Spirit gains ${a.n} extra symbol${a.n === 1 ? '' : 's'}`,
    can: c => c.p.spirits.includes(c.src) && !!G.attacker,
    run: async (c, a) => { c.src.symBattle = (c.src.symBattle || 0) + a.n; log(`${CARDS[c.src.id].name} gains ${a.n} extra symbol${a.n === 1 ? '' : 's'} during this battle.`); } },
  DESTROY: { chk: a => (a.all == null || (a.all === true && !a.nexus)) && (a.nexus === true || a.bpLe != null || a.bpLeAttacker === true || a.symbolsLe != null || a.bpLeReturned === true || a.familyInOppTrash === true || a.costLe != null || a.costLeSelf === true || a.costLeDiscarded === true || a.costRank != null || (Number.isInteger(a.coresLe) && a.coresLe >= 0 && a.coresLe <= 10)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.costRank == null || ['lowest', 'highest'].includes(a.costRank)) && (a.costBoost == null || (a.costBoost && Number.isInteger(a.costBoost.counterGe) && Number.isInteger(a.costBoost.n) && a.costBoost.n > 0)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0)) && (a.symbolsLe == null || Number.isInteger(a.symbolsLe)) && (a.thenDraw == null || (Number.isInteger(a.thenDraw) && a.thenDraw >= 1 && a.thenDraw <= 3)) && (a.lifeBoost == null || (a.lifeBoost && Number.isInteger(a.lifeBoost.le) && Number.isInteger(a.lifeBoost.n) && a.lifeBoost.n > 0)) && (a.noFx == null || a.noFx === true),
    txt: a => a.all ? 'destroy every opposing Spirit/Ultimate with ' + (a.coresLe != null ? a.coresLe + ' core(s) or less on it' : a.bpLe + ' BP or less') + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed targets can't activate" : '') : (a.coresLe != null ? `destroy 1 opposing Spirit/Ultimate with ${a.coresLe} core${a.coresLe === 1 ? '' : 's'} or less on it` : a.nexus ? 'destroy 1 opposing Nexus' : a.costRank ? `destroy 1 opposing Spirit/Ultimate with the ${a.costRank} cost` : (a.costLe != null || a.costLeSelf || a.costLeDiscarded) ? `destroy 1 opposing Spirit/Ultimate with ${a.costLe != null ? 'cost ' + a.costLe + ' or less' : a.costLeSelf ? 'a cost equal or inferior to this Spirit' : 'a cost equal or inferior to the discarded card'}${a.costBoost ? ' (+' + a.costBoost.n + ' with ' + a.costBoost.counterGe + ' counters or more)' : ''}` : `destroy 1 opposing Spirit${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' + (a.lifeBoost ? ' (+' + a.lifeBoost.n + ' if your Life is ' + a.lifeBoost.le + ' or less)' : '') : a.symbolsLe != null ? ' with ' + a.symbolsLe + ' symbol(s) or less' : a.bpLeReturned ? ' with BP equal or inferior to the LV1 BP of the returned card' : a.familyInOppTrash ? ' with the same family as a card in the opposing Trash' : ' with BP equal or inferior to the attacker'}${a.thenDraw ? ', then draw ' + a.thenDraw : ''}`) + (a.noFx ? "; the effects of the destroyed target can't activate" : ''),
    cands: (c, a) => {
      if (a.nexus) return c.opp.nexus.filter(n => !fxImmune(c.opp, n));
      if (a.costRank || a.costLe != null || a.costLeSelf || a.costLeDiscarded) {                    // v0.37 cost based destruction ("Cost Destruction effect")
        const all = c.opp.spirits.filter(s => !fxImmune(c.opp, s));
        if (a.costRank) { if (!all.length) return []; const cs = all.map(s => CARDS[s.id].cost), m = a.costRank === 'lowest' ? Math.min(...cs) : Math.max(...cs); return all.filter(s => CARDS[s.id].cost === m); }
        const base = a.costLe != null ? a.costLe : a.costLeSelf ? CARDS[c.src.id].cost : (c.ctx.discardedCost == null ? -1 : c.ctx.discardedCost);
        if (base < 0) return [];
        const lim = base + (a.costBoost && c.p.count >= a.costBoost.counterGe ? a.costBoost.n : 0) + costDestroyBonus(c.p, c.src);
        return all.filter(s => CARDS[s.id].cost <= lim);
      }
      if (a.coresLe != null) return c.opp.spirits.filter(s => (a.ignoreImmune === true || !fxImmune(c.opp, s)) && totalCores(s) <= a.coresLe);      // v0.39 (Purple): "with N cores or less on it"
      let lim = null;
      if (a.bpLeReturned) { const r = c.ctx.returned, k = r && CARDS[r.id]; lim = k && k.type === 'Spirit' ? k.levels[0].bp : -1; }
      const fams = a.familyInOppTrash ? new Set([].concat(...c.opp.trash.map(t => CARDS[t.id].families || []))) : null;
      const bpLim = a.bpLe == null ? null : a.bpLe + (a.lifeBoost && c.p.life <= a.lifeBoost.le ? a.lifeBoost.n : 0);
      return c.opp.spirits.filter(s => (bpLim == null || bpOf(s) <= bpLim) && (a.symbolsLe == null || CARDS[s.id].symbols <= a.symbolsLe) && (!a.bpLeAttacker || (c.ctx.attacker && bpOf(s) <= bpOf(c.ctx.attacker)))
        && (lim == null || bpOf(s) <= lim) && (!fams || (CARDS[s.id].families || []).some(f => fams.has(f))));
    },
    can: (c, a) => FX_ACTIONS.DESTROY.cands(c, a).length > 0,
    run: async (c, a) => {
      if (a.all) {      // v0.75 "Destroy every / all opposing <bound> Spirits": every candidate at once
        const L = FX_ACTIONS.DESTROY.cands(c, a).slice(); if (!L.length) { c.ctx.did = false; return; }
        for (const t of L) { if (a.noFx) t.noFx = true; removeSpirit(c.opp, t, 'destroyed', true); }
        checkDepletion(c.opp); c.ctx.destroyedN = L.length;
        if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
        return;
      }
      const t = await fxPickTarget(c, FX_ACTIONS.DESTROY.cands(c, a), c.burst ? `💥 <b>Choose a target</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).` : `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      if (a.noFx) t.noFx = true;
      if (!a.nexus) c.ctx.destroyedCost = CARDS[t.id].cost;
      if (a.nexus) removeNexus(c.opp, t, 'destroyed'); else { removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); }
      if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    } },
  BP_PLUS: { chk: a => Number.isInteger(a.n) && a.n >= 1000 && ['self', 'attacker', 'own'].includes(a.to || 'self') && (a.per == null || perOk(a.per)), txt: a => `${a.to === 'own' ? 'your matching Spirits' : a.to === 'attacker' ? 'the attacking Spirit' : 'this Spirit'} gain +${a.n} BP${a.per ? ' for each matching card you control' : ''} this turn`,
    run: async (c, a) => {
      const L = (a.to || 'self') === 'self' ? [c.src] : a.to === 'attacker' ? (c.ctx.attacker ? [c.ctx.attacker] : []) : c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match));
      const n = a.per ? a.n * perCount(c.p, a.per) : a.n;     // v0.72 per: counted when it resolves
      if (n) for (const s of L) { s.bpMod = (s.bpMod || 0) + n; log(`${CARDS[s.id].name} gets +${n} BP.`); }
    } },
  CORE_TO_SELF: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `+${a.n} core to this card`,
    can: c => c.p.reserve.n > 0,
    run: async (c, a) => { let k = 0; for (let j = 0; j < a.n; j++) if (addCore(c.p, c.src)) k++; if (k) log(`${CARDS[c.src.id].name} gets +${k} core${k === 1 ? '' : 's'}.`); } },
  REFRESH: { chk: () => true, txt: () => 'refresh this card', can: c => c.src.exhausted,
    run: async c => { refreshOne(c.src); log(`${CARDS[c.src.id].name} is refreshed.`); } },
  RETURN_TRASH: { chk: a => a.match && (a.match.name || a.match.family), txt: a => `return a matching ${a.anyType ? 'card' : 'Spirit'} from your Trash to your Hand`,
    cands: (c, a) => c.p.trash.filter(t => (a.anyType || CARDS[t.id].type === 'Spirit') && fxMatch(CARDS[t.id], a.match)),
    can: (c, a) => FX_ACTIONS.RETURN_TRASH.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.RETURN_TRASH.cands(c, a); if (!L.length) return;
      let t;
      if (c.p.cpu) t = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
      else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: 'Choose a card to return from your Trash to your Hand.', cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
        t = L.find(x => x.id === id) || L[0];
      }
      removeFrom(c.p.trash, t); c.p.hand.push(t); c.ctx.returned = t; handUp(c.p, 1); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from the Trash to the Hand.`);
    } },
  REFRESH_SPIRIT: { chk: a => a.match == null || hasMatch(a.match), txt: a => `refresh one of your ${a.match ? 'matching ' : ''}Spirits`,
    cands: (c, a) => c.p.spirits.filter(s => s.exhausted && (!a || !a.match || fxMatch(CARDS[s.id], a.match))),
    can: (c, a) => FX_ACTIONS.REFRESH_SPIRIT.cands(c, a).length > 0,
    run: async (c, a) => {
      const t = await fxPickTarget(c, FX_ACTIONS.REFRESH_SPIRIT.cands(c, a), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your exhausted Spirits to refresh (glowing).`);
      if (!t) return; refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`);
    } },
  /* v0.33 effects of a card that is not on the field: revealed from the deck, or in the Hand */
  MIRAGE_SET: { chk: () => true, txt: () => 'set this card as a Mirage without paying the cost (only if you have no Mirage set)',
    can: c => !c.p.mirage && !!CARDS[c.src.id].mirage && (c.p.revealed.includes(c.src) || c.p.hand.includes(c.src)),
    run: async c => {
      if (!FX_ACTIONS.MIRAGE_SET.can(c)) { c.ctx.did = false; return; }
      removeFrom(c.p.revealed, c.src); removeFrom(c.p.hand, c.src); c.src.mirage = true; c.p.mirage = c.src;
      log(`${who(c.p)} ${c.p.cpu ? 'sets' : 'set'} a Mirage face up without paying the cost: ${CARDS[c.src.id].name}.`);
    } },
  DEPLOY_SELF: { chk: () => true, txt: () => 'summon/deploy this card without paying the cost',
    can: c => (c.p.revealed.includes(c.src) || c.p.hand.includes(c.src)) && canPlaceFree(c.p, c.src),
    run: async c => {
      if (!FX_ACTIONS.DEPLOY_SELF.can(c)) { c.ctx.did = false; return; }
      removeFrom(c.p.revealed, c.src); await summonFree(c.p, c.src); c.ctx.did = fieldList(c.p).includes(c.src);
    } },
  /* reveal n cards, add one matching card to the Hand, the rest go to the Trash or the bottom of the Deck (v0.33, e.g. Rainydle) */
  REVEAL_PICK: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && hasMatch(a.match) && ['trash', 'bottom', 'top', 'either'].includes(a.rest) && (a.diffName == null || a.diffName === true),   // v0.69 diffName: "a card name different from this Spirit's"
    txt: a => `reveal ${a.n} cards from the top of your Deck, add a matching card to your Hand, ${a.rest === 'trash' ? 'discard' : a.rest === 'top' ? 'return to the top of the Deck' : a.rest === 'either' ? 'return to the top or the bottom of the Deck' : 'return to the bottom of the Deck'} the rest`,      // v0.75 rest top / either
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      const t = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match) && (!a.diffName || CARDS[x.id].name !== nm)), `✨ ${nm}`, 'Choose a revealed card to add to your Hand.', true);
      if (t) { removeFrom(c.p.revealed, t); c.p.hand.push(t); handUp(c.p, 1); log(`${nm}: ${CARDS[t.id].name} is added to the Hand.`); }
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
  LOOT: { chk: a => Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 5 && Number.isInteger(a.discard) && a.discard >= 1 && a.discard <= 5
      && (a.drawPlus == null || (a.drawPlus && Number.isInteger(a.drawPlus.n) && a.drawPlus.n >= 1 && a.drawPlus.n <= 3 && a.drawPlus.if && !parseCond(a.drawPlus.if).error))
      && (a.discardLessPerName == null || (typeof a.discardLessPerName === 'string' && a.discardLessPerName.length > 0)) && (a.famCostDestroy == null || (typeof a.famCostDestroy === 'string' && a.famCostDestroy.length > 0)),
    txt: a => `draw ${a.draw}${a.drawPlus ? ' (+' + a.drawPlus.n + ' in a set condition)' : ''}, then discard ${a.discard}${a.discardLessPerName ? ' (-1 for each ' + a.discardLessPerName + ' you control)' : ''}${a.famCostDestroy ? '; a discarded ' + a.famCostDestroy + ' card lets you destroy a Spirit with cost equal or less' : ''}`,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, n = a.draw + (a.drawPlus && fxIf(c.p, c.opp, a.drawPlus.if, c.ctx) ? a.drawPlus.n : 0);
      const k = draw(c.p, n); log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k);
      let m = a.discard; if (a.discardLessPerName) { const w = a.discardLessPerName.toLowerCase(); m = Math.max(0, m - fieldList(c.p).filter(f => CARDS[f.id].name.toLowerCase().includes(w)).length); }
      m = Math.min(m, c.p.hand.length); let last = null; c.ctx.discardedCost = null;
      for (let j = 0; j < m && c.p.hand.length; j++) {
        let d;
        if (c.p.cpu) d = c.p.hand.slice().sort((x, y) => (CARDS[x.id].cost - CARDS[y.id].cost) || (+(CARDS[x.id].type === 'Nexus') - +(CARDS[y.id].type === 'Nexus')))[0];
        else {
          const v = await ask({ title: `✨ ${nm}`, peek: true, html: `Discard a card from your Hand (${m - j} left).`, buttons: c.p.hand.slice(0, 12).map(x => ({ label: `${CARDS[x.id].name} (cost ${CARDS[x.id].cost})`, cls: 'primary', value: x.uid })) });
          d = c.p.hand.find(x => x.uid === v) || c.p.hand[0];
        }
        removeFrom(c.p.hand, d); c.p.trash.push(d); last = d; log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      if (a.famCostDestroy) { const hit = !!last && (CARDS[last.id].families || []).includes(a.famCostDestroy); c.ctx.discardedCost = hit ? CARDS[last.id].cost : null; c.ctx.did = hit; }
    } },
  /* v0.37 Contract Field of Contractor Nuadha: when doing Neo-Core Charge, instead of +1 core to this Nexus you can +1 counter (the player chooses; the CPU builds the Count first) */
  CORE_OR_COUNTER: { chk: a => a.n === 1, txt: () => '+1 core to this Nexus, or +1 counter instead',
    run: async c => {
      let counter;
      if (c.p.cpu) counter = c.p.count < 5;
      else { const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, html: 'Neo-Core Charge: choose what you get.', buttons: [{ label: '+1 core to this Nexus', cls: 'primary', value: 'core' }, { label: '+1 counter', cls: 'primary', value: 'counter' }] }); counter = v === 'counter'; }
      if (counter) await FX_ACTIONS.COUNTER.run(c, { n: 1 }); else await FX_ACTIONS.CORE_TO_SELF.run(c, { n: 1 });
    } },
  SUMMON_SELF: { chk: () => true, txt: () => 'summon this card without paying the cost',
    can: c => !!c.burst && canPlaceFree(c.p, c.src),
    run: async c => { if (!c.burst || !canPlaceFree(c.p, c.src)) return; await summonFree(c.p, c.src); c.summoned = true; } },
  SUMMON_HAND: { chk: a => a.match && (a.match.name || a.match.family) && (a.from == null || ['hand', 'handOrSoul', 'soul', 'trash'].includes(a.from)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.pay == null || typeof a.pay === 'boolean') && (a.allowBrave == null || (a.allowBrave === true && !a.pay)) && (a.types == null || (Array.isArray(a.types) && a.types.every(t => ['Spirit', 'Brave', 'Nexus'].includes(t)))),
    txt: a => `summon/deploy a matching card${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} from your ${a.from === 'trash' ? 'Trash' : a.from === 'soul' ? 'Soul State' : a.from === 'handOrSoul' ? 'Hand/Soul State' : 'Hand'}${a.pay ? ' (paying its cost)' : ' without paying the cost'}`,
    cands: (c, a) => (a.from === 'trash' ? c.p.trash : a.from === 'soul' ? c.p.soulState : a.from === 'handOrSoul' ? c.p.hand.concat(c.p.soulState) : c.p.hand).filter(h => { const k = CARDS[h.id]; if (a.types && !a.types.includes(k.type)) return false; if (a.allowBrave && k.type === 'Brave') return fxMatch(k, a.match) && (a.costLe == null || k.cost <= a.costLe) && canPlaceBraveFree(c.p, h);    // v0.37: a Brave card is summoned as a Spirit
      return (k.type === 'Spirit' || k.type === 'Nexus') && fxMatch(k, a.match) && (a.costLe == null || k.cost <= a.costLe) && canPlaceBy(c.p, h, a.pay); }),
    can: (c, a) => FX_ACTIONS.SUMMON_HAND.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SUMMON_HAND.cands(c, a); if (!L.length) return;
      let t;
      if (c.p.cpu) t = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
      else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: (a.pay ? 'Choose a card to summon/deploy (you pay its cost).' : 'Choose a card to summon/deploy without paying the cost.'), cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
        t = L.find(x => x.id === id) || L[0];
      }
      await summonBy(c.p, t, a.pay);
    } },
  SOUL_ENTER: { chk: a => SOUL_SRC.includes(a.src) && (a.src === 'self' || hasMatch(a.match)) && (a.src !== 'reveal' || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && ['bottom', 'trash'].includes(a.rest))),
    txt: a => a.src === 'self' ? 'let this card enter Soul State' : a.src === 'reveal' ? `reveal ${a.n} card${a.n === 1 ? '' : 's'} from the top of your Deck, let a matching card enter Soul State, ${a.rest === 'trash' ? 'discard' : 'return to the bottom of the Deck'} the rest`
      : `let a matching card from your ${a.src === 'handOrTrash' ? 'Hand/Trash' : cap(a.src)} enter Soul State`,
    cands: (c, a) => (a.src === 'hand' ? c.p.hand : a.src === 'trash' ? c.p.trash : a.src === 'handOrTrash' ? c.p.hand.concat(c.p.trash) : []).filter(x => fxMatch(CARDS[x.id], a.match)),
    can: (c, a) => a.src === 'self' ? fieldList(c.p).includes(c.src) : a.src === 'reveal' ? c.p.deck.length > 0 : FX_ACTIONS.SOUL_ENTER.cands(c, a).length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name;
      if (a.src === 'self') { c.ctx.did = fieldList(c.p).includes(c.src) && toSoulState(c.p, c.src); return; }
      if (a.src === 'reveal') {
        const top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
        log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`);
        await revealedFx(c.p);
        let k = 0;
        const t = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match)), `✨ ${nm}`, 'Choose a revealed card to let enter Soul State.', true);
        if (t && toSoulState(c.p, t)) k++;
        if (a.extra && lvNo(c.src) >= a.extra.lv) {
          const t2 = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], { name: [a.extra.name] })), `✨ ${nm}`, `You may also let a revealed "${esc(a.extra.name)}" enter Soul State.`, true);
          if (t2 && toSoulState(c.p, t2)) k++;
        }
        const rest = c.p.revealed.splice(0);
        if (a.rest === 'trash') { for (const x of rest) c.p.trash.push(x); if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} discarded.`); }
        else for (const x of rest) c.p.deck.push(x);
        c.ctx.did = k > 0; return;
      }
      const t = await chooseCard(c, FX_ACTIONS.SOUL_ENTER.cands(c, a), `✨ ${nm}`, 'Choose a card to let enter Soul State.', true);
      c.ctx.did = !!t && toSoulState(c.p, t);
    } },
  SOUL_RETURN: { chk: a => hasMatch(a.match), txt: () => 'return a matching card from Soul State to your Hand',
    cands: (c, a) => c.p.soulState.filter(x => fxMatch(CARDS[x.id], a.match)),
    can: (c, a) => FX_ACTIONS.SOUL_RETURN.cands(c, a).length > 0,
    run: async (c, a) => {
      const t = await chooseCard(c, FX_ACTIONS.SOUL_RETURN.cands(c, a), `✨ ${CARDS[c.src.id].name}`, 'Choose a card to return from Soul State to your Hand.', true);
      if (!t) { c.ctx.did = false; return; }
      removeFrom(c.p.soulState, t); t.inSoulState = false; c.p.hand.push(t); handUp(c.p, 1); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from Soul State to the Hand.`);
    } },
  SOUL_SUMMON: { chk: a => hasMatch(a.match) && (a.pay == null || typeof a.pay === 'boolean'), txt: a => `summon/deploy a matching card from Soul State${a.pay ? ' (paying its cost)' : ''}${a.orReturn ? ', or return it to the Hand' : ''}`,
    cands: (c, a) => c.p.soulState.filter(x => fxMatch(CARDS[x.id], a.match) && (a.orReturn || canPlaceBy(c.p, x, a.pay))),
    can: (c, a) => FX_ACTIONS.SOUL_SUMMON.cands(c, a).length > 0,
    run: async (c, a) => {
      const t = await chooseCard(c, FX_ACTIONS.SOUL_SUMMON.cands(c, a), `✨ ${CARDS[c.src.id].name}`, 'Choose a card in Soul State.', true);
      if (!t) { c.ctx.did = false; return; }
      let summon = canPlaceBy(c.p, t, a.pay);
      if (summon && a.orReturn && !c.p.cpu) summon = (await ask({ title: `✨ ${CARDS[t.id].name}`, peek: true, wide: true, html: 'Summon/deploy it, or return it to your Hand?', cards: cardIds([t]), buttons: [{ label: 'Summon / deploy', cls: 'primary', value: true }, { label: 'Return to Hand', cls: 'blue', value: false }] })) !== false;
      if (summon) { if (!(await summonBy(c.p, t, a.pay))) { c.ctx.did = false; return; } }
      else { removeFrom(c.p.soulState, t); t.inSoulState = false; c.p.hand.push(t); handUp(c.p, 1); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from Soul State to the Hand.`); }
    } },
  VOID_TO_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to your Reserve`,
    run: async (c, a) => { const m = takeFromVoid(c.p, a.n); c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Reserve.`); } },
  VOID_TO_TRASH: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to your Trash`,      // v0.75: the cores come back to the Reserve in the next Refresh Step
    run: async (c, a) => { const m = takeFromVoid(c.p, a.n); c.p.trashCores.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Trash.`); } },
  VOID_TO_CARD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && ['self', 'anySpirit', 'anyNexus', 'eachSpirit', 'eachNexus'].includes(a.to) && (a.match == null || (a.to !== 'self' && hasMatch(a.match))),      // v0.74: match = "any of your <colour|family> Spirits"; v0.75: Nexus targets, "each to every <X> you control"
    cands: (c, a) => (/Nexus$/.test(a.to) ? c.p.nexus : c.p.spirits).filter(x => fxMatch(CARDS[x.id], a.match)), txt: a => a.perOppHandPairs ? 'put a core from the Void to one of your Spirits for every two cards in the opposing Hand' : a.perDistinctSoul ? 'put a core from the Void to one of your Spirits for each differently-named card in Soul State' : `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void ${/^each/.test(a.to) ? 'to each of your ' : 'to '}${a.to === 'self' ? 'this Spirit' : (/^any/.test(a.to) ? 'one of your ' : '') + (a.match ? 'matching ' : '') + (/Nexus$/.test(a.to) ? 'Nexuses' : 'Spirits')}`,
    can: (c, a) => (!a.perOppHandPairs || c.opp.hand.length >= 2) && (!a.perDistinctSoul || c.p.soulState.length > 0) && (a.to === 'self' ? c.p.spirits.includes(c.src) : FX_ACTIONS.VOID_TO_CARD.cands(c, a).length > 0),
    run: async (c, a) => {
      if (/^each/.test(a.to)) {      // v0.75: every matching card gets n cores (each one its own)
        const L = FX_ACTIONS.VOID_TO_CARD.cands(c, a); let m = 0;
        for (const t of L) { const k = takeFromVoid(c.p, a.n); t.cores += k; m += k; }
        c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
        log(`${CARDS[c.src.id].name}: ${a.n} core${a.n === 1 ? '' : 's'} from the Void to each of ${L.map(t => CARDS[t.id].name).join(', ')}.`); return;
      }
      const t = a.to === 'self' ? (c.p.spirits.includes(c.src) ? c.src : null) : await fxPickTarget(c, FX_ACTIONS.VOID_TO_CARD.cands(c, a), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the ${/Nexus$/.test(a.to) ? 'Nexus' : 'Spirit'} that receives the core${a.n === 1 ? '' : 's'} from the Void (glowing).`);
      const want = a.perOppHandPairs ? Math.floor(c.opp.hand.length / 2) : a.perDistinctSoul ? new Set(c.p.soulState.map(x => x.id)).size : a.n;
      const m = t ? takeFromVoid(c.p, want) : 0; c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
      t.cores += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to ${CARDS[t.id].name}.`);
    } },
  CORE_TO_NEXUS: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && hasMatch(a.match) && (a.perDestroyedCost == null || (a.perDestroyedCost === true && Number.isInteger(a.max) && a.max >= 1 && a.max <= 30)), txt: a => `+${a.n} core to one of your matching Nexuses`,
    cands: (c, a) => c.p.nexus.filter(x => fxMatch(CARDS[x.id], a.match)),
    can: (c, a) => c.p.reserve.n > 0 && FX_ACTIONS.CORE_TO_NEXUS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.CORE_TO_NEXUS.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the Nexus that receives +${a.n} core (glowing).`); let k = 0;
      const total = a.perDestroyedCost ? Math.min(c.ctx.destroyedCost || 0, a.max) : a.n;          // v0.37: +1 core per cost of the Spirit destroyed by the previous action
      for (let j = 0; j < total; j++) if (addCore(c.p, t)) k++;
      c.ctx.did = k > 0; if (k) log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} gets +${k} core${k === 1 ? '' : 's'}.`);
    } },
  BOUNCE_OPP: { chk: a => ['hand', 'deckBottom'].includes(a.to) && ['spirit', 'any', 'nexus'].includes(a.kind) && (a.lv == null || (Array.isArray(a.lv) && a.lv.length > 0 && a.lv.every(x => Number.isInteger(x) && x >= 1 && x <= 4))) && (a.notColor == null || typeof a.notColor === 'string') && (a.costLeSubject == null || a.costLeSubject === true) && (a.exhaustedOnly == null || a.exhaustedOnly === true) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)),
    txt: a => `return an opposing ${a.lv ? 'LV' + a.lv.join('/') + ' ' : ''}${a.kind === 'any' ? 'Spirit/Nexus' : 'Spirit'}${a.costLeSubject ? ' with cost equal or inferior to the attacking card' : ''}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} to the ${a.to === 'hand' ? 'Hand' : 'bottom of the Deck'}`,
    cands: (c, a) => {
      const sub = c.ctx.subject || c.ctx.attacker, lim = a.costLeSubject ? (sub ? CARDS[sub.id].cost : -1) : null;
      return (a.kind === 'any' ? c.opp.spirits.concat(c.opp.nexus) : a.kind === 'nexus' ? c.opp.nexus : c.opp.spirits).filter(t => (lim == null || CARDS[t.id].cost <= lim) && (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (!a.lv || a.lv.includes(lvNo(t))) && (!a.notColor || !(CARDS[t.id].colors || [CARDS[t.id].symbol]).includes(a.notColor)) && (!a.exhaustedOnly || t.exhausted) && !flagActive(c.opp, 'NO_RETURN', t) && !fxImmune(c.opp, t));
    },
    can: (c, a) => FX_ACTIONS.BOUNCE_OPP.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.BOUNCE_OPP.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing card to return (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      bounceCard(c.opp, t, a.to); checkDepletion(c.opp);
    } },
  DISCARD_OPP_BURST: { chk: () => true, txt: () => 'discard the opposing Burst',
    run: async c => { const b = c.opp.burst; if (!b) { c.ctx.did = false; return; } c.opp.burst = null; b.mirage = false; c.opp.trash.push(b); log(`${CARDS[c.src.id].name}: the opposing Burst is discarded.`); } },
  /* v0.42 "Unless the opponent discards a Magic card from their Hand, <next actions>": the opponent chooses (modal for the human, CPU rule).
     ctx.did = true when the effect goes ahead (no Magic card to discard, or the opponent declines), false when they discarded, so the
     following actions use {"if":{"prev":true}}. {needExhausted:true}: nothing to ask when this card is not exhausted (refresh clauses). */
  OPP_DISCARD_MAGIC_OR: { chk: a => a.needExhausted == null || typeof a.needExhausted === 'boolean',
    txt: () => 'unless the opponent discards a Magic card from their Hand, the following effect applies',
    can: (c, a) => !a.needExhausted || !!c.src.exhausted,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, o = c.opp, M = o.hand.filter(x => CARDS[x.id].type === 'Magic' && !handSafe(x, o, c));
      if (!M.length) { c.ctx.did = true; return; }
      let d = null;
      if (o.cpu) d = cpuKeepMagicOrPay(o, c, M);
      else {
        const v = await ask({ title: `✨ ${nm}`, peek: true, html: `Discard a Magic card from your Hand to stop this effect?`, buttons: M.slice(0, 12).map(x => ({ label: `Discard ${CARDS[x.id].name}`, cls: 'primary', value: x.uid })).concat([{ label: 'Do not discard', value: 'no' }]) }, o.key || 'player');   // v0.105.0 (M6 step 1): ask for the owner's seat - the port marks CPU seats by it and the attacking seat may be a CPU
        d = M.find(x => x.uid === v) || null;
      }
      if (!d) { c.ctx.did = true; log(`${nm}: ${who(o)} ${o.cpu ? 'does' : 'do'} not discard a Magic card.`); return; }
      removeFrom(o.hand, d); o.trash.push(d); c.ctx.did = false;
      log(`${nm}: ${who(o)} ${o.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}, the effect does not apply.`);
    } },
  /* "send all cores from an opposing <family> Nexus" (one Nexus), {n, spread:true}: "send n cores from any opposing <family> Nexuses",
     orAllIfLifeLe: "Or, if your Life is X or less, you can send all cores from an opposing <family> Nexus". The Soul Core is never moved by these effects. */
  NEXUS_CORES_TO_VOID: { chk: a => typeof a.family === 'string' && a.family.length > 0 && (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 10)) && (a.spread == null || typeof a.spread === 'boolean') && (a.orAllIfLifeLe == null || (Number.isInteger(a.orAllIfLifeLe) && a.n != null)),
    txt: a => (a.n ? `send ${a.n} core${a.n === 1 ? '' : 's'} from ${a.spread ? 'any opposing "' + a.family + '" Nexuses' : 'an opposing "' + a.family + '" Nexus'}` : `send all cores from an opposing "${a.family}" Nexus`) + ' to the Void' + (a.orAllIfLifeLe != null ? `, or, if your Life is ${a.orAllIfLifeLe} or less, all cores from one such Nexus` : ''),
    cands: (c, a) => c.opp.nexus.filter(x => x.cores > 0 && !fxImmune(c.opp, x) && (CARDS[x.id].families || []).some(f => f.toLowerCase().includes(a.family.toLowerCase()))),
    can: (c, a) => FX_ACTIONS.NEXUS_CORES_TO_VOID.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NEXUS_CORES_TO_VOID.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const nm = CARDS[c.src.id].name, total = L.reduce((t, x) => t + x.cores, 0), most = Math.max(...L.map(x => x.cores));
      let all = a.n == null;
      if (!all && a.orAllIfLifeLe != null && c.p.life <= a.orAllIfLifeLe) {
        const nAmt = Math.min(a.n, a.spread ? total : most);
        if (c.p.cpu) all = most > nAmt;
        else all = (await ask({ title: `✨ ${nm}`, peek: true, html: `Your Life is ${c.p.life}. Choose which cores go to the opposing Void.`,
          buttons: [{ label: `${a.n} core${a.n === 1 ? '' : 's'} from ${a.spread ? 'any Nexuses' : 'one Nexus'}`, cls: 'primary', value: false }, { label: 'All cores from one Nexus', cls: 'purple', value: true }] })) === true;
      }
      let k = 0;
      const pick = async (lst, what) => fxPickTarget(c, lst.slice().sort((x, y) => y.cores - x.cores), `✨ <b>${esc(nm)}</b><br>Tap the opposing Nexus ${what} (glowing).`);
      if (all) { const t = await pick(L, 'whose cores all go to the Void'); if (t) { k = t.cores; c.opp.void += t.cores; t.cores = 0; } }
      else if (!a.spread) { const t = await pick(L, `that loses ${a.n} core${a.n === 1 ? '' : 's'}`); if (t) { k = Math.min(a.n, t.cores); t.cores -= k; c.opp.void += k; } }
      else for (let j = 0; j < a.n; j++) {
        const lst = L.filter(x => x.cores > 0 && c.opp.nexus.includes(x)); if (!lst.length) break;
        const t = await pick(lst, `that loses core ${j + 1} of ${a.n}`); if (!t) break;
        t.cores--; c.opp.void++; k++;
      }
      c.ctx.did = k > 0; if (k) log(`${nm}: ${k} core${k === 1 ? '' : 's'} are sent to the opposing Void.`);
    } },
  /* v0.45 "for each differently named <family> family Brave you control, send an opposing Life to the Trash" (Agateram Unleash).
     Braves counted: combined on your Spirits/Nexuses and Brave cards on the Field as Spirits; distinct names. Not damage: one Burst check. */
  OPP_LIFE_TO_TRASH: { chk: a => (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5)) && (a.perBraveNames == null || (typeof a.perBraveNames === 'string' && a.perBraveNames.length > 0)) && (a.n != null || a.perBraveNames != null),
    txt: a => a.perBraveNames ? `for each differently named "${a.perBraveNames}" family Brave you control, send an opposing Life to the Trash` : `send ${a.n} opposing Life to the Trash`,
    count: (c, a) => {
      if (!a.perBraveNames) return a.n;
      const nm = new Set();
      for (const i of fieldList(c.p)) for (const b of [i.brave, CARDS[i.id].type === 'Brave' ? i : null]) if (b && (CARDS[b.id].families || []).includes(a.perBraveNames)) nm.add(CARDS[b.id].name);
      return nm.size;
    },
    can: c => c.opp.life > 0,
    run: async (c, a) => {
      const m = Math.min(FX_ACTIONS.OPP_LIFE_TO_TRASH.count(c, a), c.opp.life); if (!m) { c.ctx.did = false; return; }
      lifeTake(c.opp, m, 'trash'); log(`${CARDS[c.src.id].name}: ${m} opposing Life ${m === 1 ? 'is' : 'are'} sent to the opposing Trash.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  /* v0.45 "(Your Attack Step) the opponent can't block" while this card stays on the Field at minLv or higher (Agateram Lv2-3) */
  OPP_NO_BLOCK: { chk: a => a.minLv == null || (Number.isInteger(a.minLv) && a.minLv >= 1 && a.minLv <= 5), txt: () => 'the opponent can\'t block during this Attack Step',
    run: async (c, a) => { c.opp.noBlock = { turn: G.turnNo, uid: c.src.uid, owner: c.p.key, minLv: a.minLv || 1 }; log(`${CARDS[c.src.id].name}: ${who(c.opp)} can't block during this Attack Step.`); io.view({ type: 'board' }); } },
  /* v0.48 Seal (manual p.49): send your Soul Core to your Life (from wherever it is: Trash, Reserve or a card that keeps enough cores) */
  SEAL: { chk: () => true, txt: () => 'Seal: send your Soul Core to your Life',
    can: c => !isSealed(c.p) && soulSource(c.p) !== null,
    run: async c => { c.ctx.did = soulToLife(c.p, soulSource(c.p)); io.view({ type: 'board' }); } },
  /* v0.48 "Thunder God Bombardment" (BS76-X02): reveal n from the decktop; per card whose name contains one of names (case-sensitive,
     so "Z" is the capital letter of "Z"-named cards), send an opposing Life to the Reserve; the revealed cards go to the Hand */
  REVEAL_LIFE_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Array.isArray(a.names) && a.names.length > 0 && a.names.every(x => typeof x === 'string' && x),
    txt: a => `reveal ${a.n} cards from the top of your Deck; for each ${a.names.map(x => `"${x}"`).join('/')}, send an opposing Life to the Reserve; add the revealed cards to the Hand`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      const k = c.p.revealed.filter(x => a.names.some(s => CARDS[x.id].name.includes(s))).length;
      const got = c.p.revealed.splice(0); for (const x of got) c.p.hand.push(x); if (got.length) { handUp(c.p, got.length); log(`${nm}: ${got.length} revealed card${got.length === 1 ? '' : 's'} added to the Hand.`); }
      c.ctx.did = k > 0;
      const m = Math.min(k, c.opp.life); if (!m) return;
      lifeTake(c.opp, m, 'reserve'); log(`${nm}: ${m} opposing Life moves to the opposing Reserve.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  LIFE_TO_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3, txt: a => `send ${a.n} opposing Life to the opposing Reserve`,
    can: c => c.opp.life > 0,
    run: async (c, a) => {
      const m = Math.min(a.n, c.opp.life); if (!m) { c.ctx.did = false; return; }
      lifeTake(c.opp, m, 'reserve'); log(`${CARDS[c.src.id].name}: ${m} opposing Life moves to the opposing Reserve.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  TRASH_CORES_TO: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && (hasMatch(a.match) || a.toAttacker === true), txt: a => a.toAttacker ? `send up to ${a.n} cores (not the Soul Core) from your Trash to the attacking Spirit` : `send up to ${a.n} cores (not the Soul Core) from your Trash to ${a.onlyCards ? '' : 'your Reserve and '}your matching Spirits/Nexuses${a.thenDestroyNexus ? '; when you do, destroy an opposing Nexus' : ''}`,
    can: c => c.p.trashCores.n > 0,
    run: async (c, a) => {
      let moved = 0; const got = new Map();
      if (a.toAttacker) {
        const t = c.ctx.attacker; if (!t || !c.p.spirits.includes(t)) { c.ctx.did = false; return; }
        const m = Math.min(a.n, c.p.trashCores.n); c.p.trashCores.n -= m; t.cores += m; moved = m; got.set(t, m);
      } else
      for (let j = 0; j < a.n && c.p.trashCores.n > 0; j++) {
        const L = fieldList(c.p).filter(x => fxMatch(CARDS[x.id], a.match));
        let t = null;
        if (a.onlyCards && !L.length) break;
        if (c.p.cpu) t = L.filter(x => CARDS[x.id].type === 'Spirit').sort((x, y) => bpOf(y) - bpOf(x))[0] || null;
        else if (a.onlyCards && L.length === 1) t = L[0];
        else {
          const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Core ${j + 1} of up to ${a.n} from your Trash: where does it go?`,
            buttons: L.slice(0, 6).map(x => ({ label: `${CARDS[x.id].name} (${x.cores} cores)`, cls: 'primary', value: x.uid })).concat(a.onlyCards ? [] : [{ label: 'Reserve', cls: 'blue', value: 'res' }]).concat([{ label: 'Stop', cls: 'cancel', value: null }]) });
          if (v == null) break;
          t = L.find(x => x.uid === v) || null;
        }
        c.p.trashCores.n--; if (t) { t.cores++; got.set(t, (got.get(t) || 0) + 1); } else c.p.reserve.n++; moved++;
      }
      c.ctx.did = moved > 0; if (moved) log(`${CARDS[c.src.id].name}: ${moved} core${moved === 1 ? '' : 's'} move from the Trash.`);
      for (const [t, n] of got) coresSent(c.p, t, n);
      if (moved && a.thenDestroyNexus && c.opp.nexus.some(n => !fxImmune(c.opp, n))) { const lst = c.opp.nexus.filter(n => !fxImmune(c.opp, n)); const nx = c.p.cpu ? lst[0] : await fxPickTarget(c, lst, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an opposing Nexus to destroy (glowing).`); if (nx) removeNexus(c.opp, nx, 'destroyed'); }
    } },
  AWAKEN: { chk: () => true, txt: () => 'send any number of cores from your other Spirits to this Spirit',
    can: c => fieldList(c.p).includes(c.src) && c.p.spirits.some(x => x !== c.src && spare(x) > 0),
    run: async (c, a) => {
      const src = c.p.spirits.filter(x => x !== c.src && spare(x) > 0), max = src.reduce((t, x) => t + spare(x), 0);
      if (!max) { c.ctx.did = false; return; }
      let n = max;
      if (!c.p.cpu) {
        const opts = [1, 2, 3, max].filter((v, i, arr) => v <= max && arr.indexOf(v) === i);
        const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: 'Awaken: send how many cores from your other Spirits to this Spirit?', buttons: opts.map(k => ({ label: k === max && max > 3 ? `All (${k})` : String(k), cls: 'primary', value: k })).concat([{ label: 'None', cls: 'cancel', value: 0 }]) });
        n = Number.isInteger(v) ? v : 0;
      }
      let moved = 0;
      for (const x of src.sort((p, q) => spare(q) - spare(p))) { while (moved < n && spare(x) > 0 && x.cores > 0) { x.cores--; c.src.cores++; moved++; } }
      c.ctx.did = moved > 0; if (!moved) return;
      log(`${CARDS[c.src.id].name}: Awaken, ${moved} core${moved === 1 ? '' : 's'} sent from other Spirits.`);
      coresSent(c.p, c.src, moved);
    } },
  CONTRACT_FIELD_ADVENT: { chk: () => true, txt: () => 'this turn, you can Contract Advent onto your Awakened Dragon Spirits from Soul State',
    can: c => c.p.soulState.some(x => CARDS[x.id].contractAdvent),
    run: async c => { c.p.csAdventTurn = G.turnNo; log(`${CARDS[c.src.id].name}: until the end of this turn, ${who(c.p)} ${c.p.cpu ? 'can' : 'can'} Contract Advent from Soul State.`); } },
  DECK_TO_TRASH_CORES: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && hasMatch(a.match), txt: a => `send ${a.n} cards from your Deck to the Trash, +1 core to this card for each matching card among them`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); let k = 0;
      for (const x of top) { c.p.trash.push(x); if (fxMatch(CARDS[x.id], a.match)) k++; }
      log(`${CARDS[c.src.id].name}: ${top.length} card${top.length === 1 ? '' : 's'} from the Deck go to the Trash.`);
      for (const x of top.filter(y => CARDS[y.id].trashSoul && c.p.trash.includes(y))) {      // e.g. Do: "when sent to the Trash from the Deck by Contractor Mitra, you can let it enter Soul State"
        const yes = c.p.cpu ? true : (await ask({ title: `✨ ${CARDS[x.id].name}`, peek: true, wide: true, html: 'It was sent to the Trash from your Deck. Let it enter Soul State?', cards: cardIds([x]), buttons: [{ label: 'Enter Soul State', cls: 'primary', value: true }, { label: 'Keep in Trash', cls: 'cancel', value: false }] }));
        if (yes) toSoulState(c.p, x);
      }
      const sn = CARDS[c.src.id], gw = sn.type === 'Nexus' && (sn.families || []).includes('Grandwalker');
      for (const x of top.filter(y => CARDS[y.id].trashHand && gw && sn.name.toLowerCase().includes(CARDS[y.id].trashHand.toLowerCase()) && c.p.trash.includes(y))) {   // e.g. Yaj-Veda: "(Once per Turn: Same Name) when sent to the Trash from the deck by your "Brahma" Grandwalker Nexus, you can add it to the Hand"
        const key = 'trashHand:' + CARDS[x.id].name; if (c.p.onceUsed && c.p.onceUsed[key] === G.turnNo) continue;
        const yes = c.p.cpu ? true : (await ask({ title: `✨ ${CARDS[x.id].name}`, peek: true, wide: true, html: 'It was sent to the Trash from your Deck. Add it to your Hand?', cards: cardIds([x]), buttons: [{ label: 'Add to Hand', cls: 'primary', value: true }, { label: 'Keep in Trash', cls: 'cancel', value: false }] }));
        if (!yes) continue;
        c.p.onceUsed = c.p.onceUsed || {}; c.p.onceUsed[key] = G.turnNo;
        removeFrom(c.p.trash, x); c.p.hand.push(x); log(`${CARDS[x.id].name} is added to the Hand (${who(c.p)}).`); handUp(c.p, 1);
      }
      await sentToTrashFx(c, top, 'deck');               // v0.47 Whirling Tide / Thunder Counter / Hades Disaster
      let got = 0; if (fieldList(c.p).includes(c.src)) for (let j = 0; j < k; j++) if (addCore(c.p, c.src)) got++;
      c.ctx.did = got > 0; if (got) log(`${CARDS[c.src.id].name}: +${got} core${got === 1 ? '' : 's'}.`);
    } },
  /* "send your Soul Core to any <name> Nexus": from the Trash, the Reserve or a card where it can leave without depleting a Spirit.
     ask:true = "you can" inside the effect (the human is asked, the CPU does it). Fires SOUL_PLACED for the Nexus. */
  SOUL_TO_NEXUS: { chk: a => hasMatch(a.match) && (a.ask == null || typeof a.ask === 'boolean'), txt: a => `${a.ask ? 'you can ' : ''}send your Soul Core to one of your matching Nexuses`,
    cands: (c, a) => { const src = soulSource(c.p); return src ? c.p.nexus.filter(n => !n.soul && fxMatch(CARDS[n.id], a.match)) : []; },
    can: (c, a) => FX_ACTIONS.SOUL_TO_NEXUS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SOUL_TO_NEXUS.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const nm = CARDS[c.src.id].name;
      if (a.ask && !c.p.cpu && !(await ask({ title: `✨ ${nm}`, peek: true, html: 'Send your Soul Core to your ' + esc(CARDS[L[0].id].name) + '?', buttons: [{ label: 'Send the Soul Core', cls: 'purple', value: true }, { label: 'Skip', cls: 'cancel', value: false }] }))) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(nm)}</b><br>Tap the Nexus that receives your Soul Core (glowing).`);
      if (!t || !(await soulToNexus(c.p, t))) { c.ctx.did = false; return; }
    } },
  /* reveal n cards, summon/deploy one matching card among them (pay:true = paying its cost), from Lv add.lv add one card matching add.match to the Hand, the rest go to the bottom of the Deck */
  REVEAL_DEPLOY: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10 && hasMatch(a.match) && (a.pay == null || typeof a.pay === 'boolean') && (a.diffName == null || a.diffName === true) && (a.add == null || (hasMatch(a.add.match) && Number.isInteger(a.add.lv))) && (a.allowBrave == null || (a.allowBrave === true && !a.pay)),
    txt: a => `reveal ${a.n} cards from the top of your Deck, summon/deploy a matching card among them${a.pay ? ' (paying its cost)' : ''}${a.add ? ', from Lv' + a.add.lv + ' add a matching card to your Hand' : ''}, return the rest to the bottom of the Deck`,
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
      const rest = c.p.revealed.splice(0); for (const x of rest) c.p.deck.push(x);
      if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} return to the bottom of the Deck.`);
      c.ctx.did = k > 0;
    } },
  /* "destroy any number of opposing Spirits up to a total of X BP" (the destroyed cards are kept in ctx.destroyed) */
  DESTROY_TOTAL: { chk: a => Number.isInteger(a.total) && (a.byCost === true ? a.total >= 1 && a.total <= 30 : a.total >= 1000 && a.total <= 100000), txt: a => a.byCost ? `destroy any number of opposing Spirits/Ultimates up to a total cost of ${a.total}` : `destroy any number of opposing Spirits up to a total of ${a.total} BP`,
    cands: (c, budget, a) => c.opp.spirits.filter(s => (a && a.byCost ? CARDS[s.id].cost : bpOf(s)) <= budget),
    can: (c, a) => FX_ACTIONS.DESTROY_TOTAL.cands(c, a.total + (a.boost && c.p.count >= a.boost.counterGe ? a.boost.n : 0), a).length > 0,
    run: async (c, a) => {
      let budget = a.total + (a.boost && c.p.count >= a.boost.counterGe ? a.boost.n : 0); const picked = [];       // v0.41: boost = { counterGe, n } (Dana Draw)
      for (let g = 0; g < 10; g++) {
        const val = x => (a.byCost ? CARDS[x.id].cost : bpOf(x)), L = FX_ACTIONS.DESTROY_TOTAL.cands(c, budget, a).filter(s => !picked.includes(s)); if (!L.length) break;
        let t;
        if (c.p.cpu) t = L.slice().sort((x, y) => (val(y) - val(x)) || (y.cores - x.cores))[0];
        else {
          const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Choose opposing Spirits to destroy. ${a.byCost ? 'Cost' : 'BP'} left: ${budget}.`,
            buttons: L.slice(0, 8).map(x => ({ label: `${CARDS[x.id].name} (${a.byCost ? 'cost ' + val(x) : val(x) + ' BP'})`, cls: 'primary', value: x.uid })).concat([{ label: picked.length ? 'Done' : 'Destroy none', cls: 'cancel', value: null }]) });
          t = L.find(x => x.uid === v);
        }
        if (!t) break;
        picked.push(t); budget -= val(t);
      }
      c.ctx.destroyed = [];
      for (const t of picked) if (c.opp.spirits.includes(t)) { removeSpirit(c.opp, t, 'destroyed', true); c.ctx.destroyed.push(t); }
      checkDepletion(c.opp);
      c.ctx.did = c.ctx.destroyed.length > 0;
    } },
  /* banish one of the cards destroyed by the previous action of this effect (it moves from the Trash to the Banished zone) */
  BANISH_DESTROYED: { chk: () => true, txt: () => 'banish one of the Spirits destroyed by this effect',
    cands: c => (c.ctx.destroyed || []).filter(t => c.opp.trash.includes(t) || c.opp.standby.includes(t)),
    can: c => FX_ACTIONS.BANISH_DESTROYED.cands(c).length > 0,
    run: async c => {
      const t = await chooseCard(c, FX_ACTIONS.BANISH_DESTROYED.cands(c), `✨ ${CARDS[c.src.id].name}`, 'Choose a destroyed card to banish.', false);
      if (!t) { c.ctx.did = false; return; }
      removeFrom(c.opp.trash, t); removeFrom(c.opp.standby, t); c.opp.removed.push(t); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} is banished.`);
    } },
  /* "By doing X, do Y" (Eternal Rule Manual FAQ, About Effects in General Q5): X must be performable, X is not done when Y cannot be done,
     and the player chooses whether to do it (ask:true asks the human; the CPU does it). {do:'BY', cost:{action X}, then:[actions Y], ask} */
  BY: { chk: a => !!a.cost && typeof a.cost === 'object' && a.cost.do !== 'BY' && !parseActionList([a.cost]).error && Array.isArray(a.then) && a.then.length >= 1 && a.then.length <= 4 && a.then.every(x => x && x.do !== 'BY') && !parseActionList(a.then).error && (a.ask == null || typeof a.ask === 'boolean'),
    txt: a => `${a.ask ? 'you can, ' : ''}by ${FX_ACTIONS[a.cost.do].txt(a.cost)}, ${a.then.map(x => FX_ACTIONS[x.do].txt(x)).join(', then ')}`,
    can: (c, a) => { const ok = x => !FX_ACTIONS[x.do].can || FX_ACTIONS[x.do].can(c, x); return ok(a.cost) && ok(a.then[0]); },
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name;
      if (!FX_ACTIONS.BY.can(c, a)) { c.ctx.did = false; return; }
      if (a.ask && !c.p.cpu && !(await ask({ title: `✨ ${nm}`, peek: true, html: `You can ${esc(FX_ACTIONS.BY.txt(Object.assign({}, a, { ask: false })))}.`, buttons: [{ label: 'Do it', cls: 'primary', value: true }, { label: 'Skip', cls: 'cancel', value: false }] }))) { c.ctx.did = false; return; }
      c.ctx.did = true; await FX_ACTIONS[a.cost.do].run(c, a.cost);
      if (c.ctx.did === false || G.over) { c.ctx.did = false; return; }
      let last = true;                                    // v0.45: {"prev":true} inside "then" tests the previous "then" action
      for (const x of a.then) {
        if (G.over) return;
        c.ctx.prev = last;
        if (x.if && !fxIf(c.p, c.opp, x.if, c.ctx)) { last = false; continue; }
        c.ctx.did = true; await FX_ACTIONS[x.do].run(c, x); last = c.ctx.did !== false;
      }
      c.ctx.did = true;
    } }
};
