/* ---- FX_ACTIONS, part 4 of 5 (v0.106.0 split of the old 516-line 02b-effects-actions.js) ----
   The Soul Core and the Trash: Soul State moves, Seal, Awaken, Contract Field Advent, deck-to-Trash cores.
   Object.assign keeps the original entry order. Only the entries that 02m and 02p capture at
   load time must load before those parts, which is why the targeting actions stay in 02b;
   every other entry here is read from inside a function.
   ------------------------------------------------------------------------------------ */
Object.assign(FX_ACTIONS, {
  SOUL_ENTER: { chk: a => SOUL_SRC.includes(a.src) && (a.src === 'self' || hasMatch(a.match)) && (a.src !== 'reveal' || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && ['bottom', 'trash'].includes(a.rest) && (a.upTo == null || (Number.isInteger(a.upTo) && a.upTo >= 2 && a.upTo <= 5)))),
    txt: a => a.src === 'self' ? 'let this card enter Soul State' : a.src === 'reveal' ? `reveal ${a.n} card${a.n === 1 ? '' : 's'} from the top of your Deck, let a matching card enter Soul State, ${a.rest === 'trash' ? 'discard' : 'return to the bottom of the Deck'} the rest`
      : `let a matching card from your ${a.src === 'handOrTrash' ? 'Hand/Trash' : cap(a.src)} enter Soul State`,
    cands: (c, a) => (a.src === 'hand' ? c.p.hand : a.src === 'trash' ? c.p.trash : a.src === 'handOrTrash' ? c.p.hand.concat(c.p.trash) : a.src === 'trashOrUnder' ? c.p.trash.concat(c.src.under || []) : []).filter(x => fxMatch(CARDS[x.id], a.match)),
    can: (c, a) => a.src === 'self' ? (fieldList(c.p).includes(c.src) || c.p.trash.includes(c.src)) : a.src === 'reveal' ? c.p.deck.length > 0 : FX_ACTIONS.SOUL_ENTER.cands(c, a).length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name;
      if (a.src === 'self') { c.ctx.did = (fieldList(c.p).includes(c.src) || c.p.trash.includes(c.src)) && toSoulState(c.p, c.src); return; }
      if (a.src === 'reveal') {
        const top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
        log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`);
        await revealedFx(c.p);
        let k = 0;
        for (let u = 0; u < (a.upTo || 1); u++) {      // v431 upTo: "up to a total of N matching cards" (BS75-067)
          const t = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match)), `✨ ${nm}`, 'Choose a revealed card to let enter Soul State.', true);
          if (t && toSoulState(c.p, t)) k++; else break;
        }
        if (a.extra && lvNo(c.src) >= a.extra.lv && !(a.extra.sameName && c.p.onceUsed && c.p.onceUsed[onceKey(c.src, 'xtra')] === G.turnNo)) {
          const t2 = await chooseCard(c, c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.extra.match || { name: [a.extra.name] })), `✨ ${nm}`, `You may also let another matching revealed card enter Soul State.`, true);
          if (t2 && toSoulState(c.p, t2)) { k++; if (a.extra.sameName) { c.p.onceUsed = c.p.onceUsed || {}; c.p.onceUsed[onceKey(c.src, 'xtra')] = G.turnNo; } }      // v428 extra.match + sameName (BS74-042)
        }
        const rest = c.p.revealed.splice(0);
        if (a.rest === 'trash') { for (const x of rest) c.p.trash.push(x); if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} discarded.`); }
        else for (const x of rest) c.p.deck.push(x);
        c.ctx.did = k > 0; return;
      }
      const t = await chooseCard(c, FX_ACTIONS.SOUL_ENTER.cands(c, a), `✨ ${nm}`, 'Choose a card to let enter Soul State.', true);
      if (t && c.src.under && c.src.under.includes(t)) { removeFrom(c.src.under, t); c.p.trash.push(t); }      // v428 trashOrUnder: a pre-advent card
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
  SOUL_SUMMON: { chk: a => hasMatch(a.match) && (a.pay == null || typeof a.pay === 'boolean') && (a.once == null || a.once === true), txt: a => `summon/deploy a matching card from Soul State${a.pay ? ' (paying its cost)' : ''}${a.orReturn ? ', or return it to the Hand' : ''}`,
    cands: (c, a) => c.p.soulState.filter(x => fxMatch(CARDS[x.id], a.match) && (a.orReturn || canPlaceBy(c.p, x, a.pay))),
    can: (c, a) => FX_ACTIONS.SOUL_SUMMON.cands(c, a).length > 0 && !(a.once && c.p.onceUsed && c.p.onceUsed['ssum:' + CARDS[c.src.id].name] === G.turnNo),      // v429 once: "(Once per Turn: Same Name)"
    run: async (c, a) => {
      if (a.once && !FX_ACTIONS.SOUL_SUMMON.can(c, a)) { c.ctx.did = false; return; }
      const t = await chooseCard(c, FX_ACTIONS.SOUL_SUMMON.cands(c, a), `✨ ${CARDS[c.src.id].name}`, 'Choose a card in Soul State.', true);
      if (!t) { c.ctx.did = false; return; }
      let summon = canPlaceBy(c.p, t, a.pay);
      if (summon && a.orReturn && !c.p.cpu) summon = (await ask({ title: `✨ ${CARDS[t.id].name}`, peek: true, wide: true, html: 'Summon/deploy it, or return it to your Hand?', cards: cardIds([t]), buttons: [{ label: 'Summon / deploy', cls: 'primary', value: true }, { label: 'Return to Hand', cls: 'blue', value: false }] })) !== false;
      if (summon) { if (!(await summonBy(c.p, t, a.pay))) { c.ctx.did = false; return; } if (a.once) { c.p.onceUsed = c.p.onceUsed || {}; c.p.onceUsed['ssum:' + CARDS[c.src.id].name] = G.turnNo; } }
      else { removeFrom(c.p.soulState, t); t.inSoulState = false; c.p.hand.push(t); handUp(c.p, 1); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from Soul State to the Hand.`); }
    } },
  /* v217 Soul Awaken: "send the Soul Core from your Field/Trash to this Spirit; if you did, refresh this Spirit, once per turn." */
  SOUL_AWAKEN: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'send the Soul Core from your Field/Trash to this Spirit; if you do, refresh it',
    can: c => !!(c.p.trashCores.soul || c.p.reserve.soul || c.p.nexus.some(n => n.soul) || c.p.spirits.some(s => s !== c.src && s.soul)),
    run: async c => {
      let from = null;
      if (c.p.spirits.some(s => s !== c.src && s.soul)) from = c.p.spirits.find(s => s !== c.src && s.soul);
      else if (c.p.nexus.some(n => n.soul)) from = c.p.nexus.find(n => n.soul);
      else if (c.p.reserve.soul && c.p.reserve.n > 0) { c.p.reserve.soul = false; c.p.reserve.n--; from = 'reserve'; }
      else if (c.p.trashCores.soul && c.p.trashCores.n > 0) { c.p.trashCores.soul = false; c.p.trashCores.n--; from = 'trash'; }
      if (!from) { c.ctx.did = false; return; }
      if (from !== 'reserve' && from !== 'trash') { from.soul = false; from.cores--; }
      c.src.cores += 1; c.src.soul = true; c.ctx.did = true;
      log(`${CARDS[c.src.id].name} receives the Soul Core${from === 'trash' ? ' from the Trash' : ''}.`);
      checkDepletion(c.p);
      refreshOne(c.src); log(`${CARDS[c.src.id].name} is refreshed (Soul Awaken).`);
      await fireFx(ownerOf(c.src) || c.p, 'REFRESHED', c.src, {});
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
  /* v196 "Target one of your Spirits. Put any number of cores from it to this Spirit" (Re Awaken); any number = every spare core of that one Spirit */
  CORE_ANY_FROM_ALLY: { chk: () => true, txt: () => 'target one of your Spirits; put any number of cores from it to this Spirit',
    cands: c => c.p.spirits.filter(x => x !== c.src && spare(x) > 0),
    can: c => fieldList(c.p).includes(c.src) && FX_ACTIONS.CORE_ANY_FROM_ALLY.cands(c).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.CORE_ANY_FROM_ALLY.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? L.slice().sort((x, y) => spare(y) - spare(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to take its cores (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      let n = spare(t);
      if (!c.p.cpu && n > 1) {
        const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Put how many cores from ${CARDS[t.id].name} to this Spirit?`, buttons: [1, 2, 3, n].filter((x, i, arr) => x <= n && arr.indexOf(x) === i).map(k => ({ label: k === n ? `All (${k})` : String(k), cls: 'primary', value: k })).concat([{ label: 'None', cls: 'cancel', value: 0 }]) });
        n = Number.isInteger(v) ? v : 0;
      }
      let moved = 0;
      while (moved < n && spare(t) > 0 && t.cores > 0) { coreEv(c.p, 'core', t.uid, c.src.uid, moved); t.cores--; c.src.cores++; moved++; }
      c.ctx.did = moved > 0; if (!moved) return;
      log(`${CARDS[c.src.id].name}: ${moved} core${moved === 1 ? '' : 's'} put from ${CARDS[t.id].name}.`);
      coresSent(c.p, c.src, moved); checkDepletion(c.p);
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
      for (const x of src.sort((p, q) => spare(q) - spare(p))) { while (moved < n && spare(x) > 0 && x.cores > 0) { coreEv(c.p, 'core', x.uid, c.src.uid, moved); x.cores--; c.src.cores++; moved++; } }
      c.ctx.did = moved > 0; if (!moved) return;
      log(`${CARDS[c.src.id].name}: Awaken, ${moved} core${moved === 1 ? '' : 's'} sent from other Spirits.`);
      coresSent(c.p, c.src, moved);
    } },
  CONTRACT_FIELD_ADVENT: { chk: () => true, txt: () => 'this turn, you can Contract Advent onto your Awakened Dragon Spirits from Soul State',
    can: c => c.p.soulState.some(x => CARDS[x.id].contractAdvent),
    run: async c => { c.p.csAdventTurn = G.turnNo; log(`${CARDS[c.src.id].name}: until the end of this turn, ${who(c.p)} ${c.p.cpu ? 'can' : 'can'} Contract Advent from Soul State.`); } },
  DECK_TO_TRASH_CORES: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 7 && hasMatch(a.match), txt: a => `send ${a.n} cards from your Deck to the Trash, +1 core to this card for each matching card among them`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      if (a.fresh && c.p.nexus.some(x => x !== c.src && CARDS[x.id].name === CARDS[c.src.id].name)) { c.ctx.did = false; return; }      // v420 Oracle Core Charge: only when no same-named Grandwalker Nexus is controlled
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
      let got = 0; if (fieldList(c.p).includes(c.src)) for (let j = 0; j < k; j++) { if (a.void ? (!a.max || c.src.cores < a.max) && (takeFromVoid(c.p, 1), c.src.cores++, true) : addCore(c.p, c.src)) got++; }      // v420 void:true = Oracle (cores come from the Void, max = cap on this Nexus)
      c.ctx.did = got > 0; if (got) log(`${CARDS[c.src.id].name}: +${got} core${got === 1 ? '' : 's'}.`);
      if (a.pickToHand) {      // v442 "add one of the cards sent to the Trash by this Nexus' Core Charge to the Hand" (Grandwalker Alex-Lolo)
        const L = top.filter(y => c.p.trash.includes(y)); if (!L.length) return;
        let h = null;
        if (c.p.cpu) h = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
        else { const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: 'You can add one of the cards sent to the Trash to your Hand.', cards: cardIds(L), buttons: Array.from(new Set(L.map(x => x.id))).map(i => ({ label: CARDS[i].name, cls: 'primary', value: i })).concat([{ label: 'No', cls: 'cancel', value: null }]) }); h = L.find(x => x.id === id) || null; }
        if (h) { removeFrom(c.p.trash, h); c.p.hand.push(h); log(`${CARDS[h.id].name} is added to the Hand (${who(c.p)}).`); handUp(c.p, 1); c.ctx.did = true; }
      }
    } },
  /* "send your Soul Core to any <name> Nexus": from the Trash, the Reserve or a card where it can leave without depleting a Spirit.
     ask:true = "you can" inside the effect (the human is asked, the CPU does it). Fires SOUL_PLACED for the Nexus. */
  TRASH_CORES_TO: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 7 && (hasMatch(a.match) || a.toAttacker === true || a.toReserve === true || a.toLife === true || a.toSelf === true || a.toPick === true) && (a.notAttacker == null || a.notAttacker === true) && (a.perDestroyed == null || (a.perDestroyed === true && a.toSelf === true)) && (a.all == null || (a.all === true && a.toPick === true)), txt: a => a.toLife ? `send ${a.n} core (not the Soul Core) from your Trash to your Life` : a.toSelf ? `send ${a.perDestroyed ? 'a core for each Spirit destroyed' : a.n + ' core(s)'} (not the Soul Core) from your Trash to this Spirit` : a.toReserve ? `send ${a.n} core (not the Soul Core) from your Trash to your Reserve` : a.toAttacker ? `send up to ${a.n} cores (not the Soul Core) from your Trash to the attacking Spirit` : `send up to ${a.n} cores (not the Soul Core) from your Trash to ${a.onlyCards ? '' : 'your Reserve and '}your matching Spirits/Nexuses${a.thenDestroyNexus ? '; when you do, destroy an opposing Nexus' : ''}`,
    can: c => c.p.trashCores.n > 0,
    run: async (c, a) => {
      let moved = 0, fixed; const got = new Map();      // fixed: a.one picks the one target for every core
      if (a.toAttacker) {
        const t = c.ctx.attacker; if (!t || !c.p.spirits.includes(t)) { c.ctx.did = false; return; }
        const m = Math.min(a.n, c.p.trashCores.n); c.p.trashCores.n -= m; t.cores += m; moved = m; got.set(t, m);
      } else if (a.toPick) {      // v217 "send up to N cores (not the Soul Core) from your Trash to one of your matching Spirits"
        const L = c.p.spirits.filter(x => fxMatch(CARDS[x.id], a.match, x));
        const t = L.length === 1 ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the Spirit that receives the Trash cores (glowing).`);
        if (!t) { c.ctx.did = false; return; }
        const m = a.all ? c.p.trashCores.n : Math.min(a.n, c.p.trashCores.n); c.p.trashCores.n -= m; t.cores += m; moved = m; got.set(t, m);
      } else if (a.toSelf) {      // v0.197 "send a core from your Trash to this Spirit" (perDestroyed: for each Spirit the effect destroyed)
        const t = c.src; if (!c.p.spirits.includes(t)) { c.ctx.did = false; return; }
        const m = Math.min(a.perDestroyed ? a.n * (c.ctx.destroyedN || 0) : a.n, c.p.trashCores.n); c.p.trashCores.n -= m; t.cores += m; moved = m; got.set(t, m);
      } else if (a.toLife) {      // v177 "send a core, besides Soul Core, from your Trash to your Life"
        moved = Math.min(a.n, c.p.trashCores.n); c.p.trashCores.n -= moved; c.p.life += moved;
        if (moved) await fireFx(c.p, 'LIFE_UP', null, {});      // v191 "When your Life increases"
      } else if (a.toReserve) {      // v0.196 "send a core from your Trash to the Reserve"
        moved = Math.min(a.n, c.p.trashCores.n); c.p.trashCores.n -= moved; c.p.reserve.n += moved;
      } else
      for (let j = 0; j < a.n && c.p.trashCores.n > 0; j++) {
        const L = fieldList(c.p).filter(x => fxMatch(CARDS[x.id], a.match, x) && !(a.notAttacker && x === G.attacker));      // v0.199 notAttacker: "one of your non-attacking Spirits"; v194 instance filters (match.exhausted)
        let t = null;
        if (a.onlyCards && !L.length) break;
        if (a.one && fixed !== undefined) t = fixed;
        else if (c.p.cpu) t = L.filter(x => CARDS[x.id].type === 'Spirit').sort((x, y) => bpOf(y) - bpOf(x))[0] || null;
        else if (a.onlyCards && L.length === 1) t = L[0];
        else {
          const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Core ${j + 1} of up to ${a.n} from your Trash: where does it go?`,
            buttons: L.slice(0, 6).map(x => ({ label: `${CARDS[x.id].name} (${x.cores} cores)`, cls: 'primary', value: x.uid })).concat(a.onlyCards ? [] : [{ label: 'Reserve', cls: 'blue', value: 'res' }]).concat([{ label: 'Stop', cls: 'cancel', value: null }]) });
          if (v == null) break;
          t = L.find(x => x.uid === v) || null;
        }
        if (a.one) fixed = t;
        c.p.trashCores.n--; if (t) { t.cores++; got.set(t, (got.get(t) || 0) + 1); } else c.p.reserve.n++; moved++;
      }
      c.ctx.did = moved > 0; if (moved) log(`${CARDS[c.src.id].name}: ${moved} core${moved === 1 ? '' : 's'} move from the Trash.`);
      for (const [t, n] of got) coresSent(c.p, t, n);
      if (moved && a.thenDestroyNexus && c.opp.nexus.some(n => !fxImmune(c.opp, n))) { const lst = c.opp.nexus.filter(n => !fxImmune(c.opp, n)); const nx = c.p.cpu ? lst[0] : await fxPickTarget(c, lst, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an opposing Nexus to destroy (glowing).`); if (nx) removeNexus(c.opp, nx, 'destroyed'); }
    } }
});

/* v168 "send the Soul Core from your Trash to one of your matching Spirits/Nexuses" (a Spirit/Nexus without the Soul Core). */
FX_ACTIONS.SOUL_TRASH_TO = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: () => 'send the Soul Core from your Trash to one of your matching Spirits/Nexuses',
  cands: (c, a) => c.p.trashCores.soul ? fieldList(c.p).filter(x => !x.soul && fxMatch(CARDS[x.id], a.match)) : [],
  can: (c, a) => FX_ACTIONS.SOUL_TRASH_TO.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.SOUL_TRASH_TO.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the card that receives your Soul Core (glowing).`);
    if (!t || !c.p.trashCores.soul) { c.ctx.did = false; return; }
    c.p.trashCores.soul = false; t.soul = true; log(`${poss(c.p)} Soul Core is sent from the Trash to ${CARDS[t.id].name}.`);
    if (!G.over && c.p.nexus.includes(t)) await fireFx(c.p, 'SOUL_PLACED', t, { subject: t });
  } };

/* v422 leaveHook(p, s, why, battle): "when your Spirits would leave the Field due to the opponent" for the Spirit s of p. Called before it leaves; true = it stays.
   STATIC REMAIN_LIFE (to own, match): send 1 Life core to it and it remains unchanged (opposing effects only; Life >= 2). LEAVE_VOID_LIFE (once per turn, match): a Void core to your Life.
   OPP_LEAVE_DRAW {n} (to the source's owner, if): when an opposing Spirit under can't attack/block leaves due to your effect, draw n from the deckbottom (once per turn). */
function leaveHook(p, s, why, battle) {
  if (!G || !p.spirits.includes(s)) return false;
  const q = G.p[other(p.key)], oppFx = !battle && !!G.fxBy && G.fxBy !== p.key;
  if (!oppFx && !battle) return false;
  for (const src of fieldList(p)) for (const { e } of fxEntries(src)) {
    if (e.trigger !== 'STATIC' || e.flag !== 'LEAVE_VOID_LIFE' || (e.lv && !e.lv.includes(lvNo(src))) || (src.leaveTurn != null && src.leaveTurn === G.turnNo) || p.void < 1 || !fxMatch(CARDS[s.id], e.match, s)) continue;
    src.leaveTurn = G.turnNo; takeFromVoid(p, 1); p.life++; log(`${CARDS[src.id].name}: a core moves from the Void to ${poss(p)} Life.`);
  }
  if (oppFx && s.noAB) for (const src of fieldList(q)) for (const { e } of fxEntries(src)) {
    if (e.trigger !== 'STATIC' || e.flag !== 'OPP_LEAVE_DRAW' || (e.lv && !e.lv.includes(lvNo(src))) || (src.leaveTurn != null && src.leaveTurn === G.turnNo) || !q.deck.length || !fxIf(q, p, e.if || {}, { selfInst: src })) continue;
    src.leaveTurn = G.turnNo; let k = 0; for (; k < e.n && q.deck.length; k++) q.hand.push(q.deck.pop()); log(`${CARDS[src.id].name}: ${poss(q)} draws ${k} from the deckbottom.`); handUp(q, k);
  }
  if (oppFx && G.evQ && p.hand.some(h => CARDS[h.id].leaveSummon && (CARDS[s.id].families || []).includes(CARDS[h.id].leaveSummon.family))) G.evQ.push({ type: 'LEAVE_SUMMON', key: p.key, inst: s });      // v426 BS75-049
  if (!oppFx || p.life < 2 || (why !== 'destroyed' && why !== 'depleted' && why !== 'returned') || !flagActive(p, 'REMAIN_LIFE', s)) return false;
  lifeTake(p, 1, s); log(`${CARDS[s.id].name} receives a core from ${poss(p)} Life and remains on the Field.`); return true;
}
/* v432 TRASH_SAFE_TURN {family}: "during this turn, all your matching family cards in the Trash are unaffected by opposing effects; this can't be prevented by opposing effects" (BS75-028). Read by trashSafe (02k). */
FX_ACTIONS.TRASH_SAFE_TURN = { chk: a => typeof a.family === 'string' && !!a.family,
  txt: a => `during this turn, all your "${a.family}" family cards in the Trash are unaffected by opposing effects`,
  can: () => true,
  run: async (c, a) => { c.p.trashSafeTurn = G.turnNo; c.p.trashSafeFam = a.family; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${poss(c.p)} "${a.family}" cards in the Trash are unaffected by opposing effects this turn.`); } };
/* This part loads after 02k, whose load-time pass wraps every action's cands() with the immunity
   filter (trash-safe cards, opposing cards unaffected by this effect). Run it again so the entries
   defined here get the same wrapper; it is idempotent. */
wrapImmunity(Object.values(FX_ACTIONS));
