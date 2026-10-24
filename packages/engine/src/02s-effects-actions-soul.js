/* ---- FX_ACTIONS, part 4 of 5 (v0.106.0 split of the old 516-line 02b-effects-actions.js) ----
   The Soul Core and the Trash: Soul State moves, Seal, Awaken, Contract Field Advent, deck-to-Trash cores.
   Object.assign keeps the original entry order. Only the entries that 02m and 02p capture at
   load time must load before those parts, which is why the targeting actions stay in 02b;
   every other entry here is read from inside a function.
   ------------------------------------------------------------------------------------ */
Object.assign(FX_ACTIONS, {
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
  SEAL: { chk: () => true, txt: () => 'Seal: send your Soul Core to your Life',
    can: c => !isSealed(c.p) && soulSource(c.p) !== null,
    run: async c => { c.ctx.did = soulToLife(c.p, soulSource(c.p)); io.view({ type: 'board' }); } },
  /* v0.48 "Thunder God Bombardment" (BS76-X02): reveal n from the decktop; per card whose name contains one of names (case-sensitive,
     so "Z" is the capital letter of "Z"-named cards), send an opposing Life to the Reserve; the revealed cards go to the Hand */
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
    } }
});

/* This part loads after 02k, whose load-time pass wraps every action's cands() with the immunity
   filter (trash-safe cards, opposing cards unaffected by this effect). Run it again so the entries
   defined here get the same wrapper; it is idempotent. */
wrapImmunity(Object.values(FX_ACTIONS));
