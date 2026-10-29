/* ---- FX_ACTIONS, part 2 of 5 (v0.106.0 split of the old 516-line 02b-effects-actions.js) ----
   Your own board: draw, counters, tokens, symbols, BP, cores, refresh, set-as-Mirage and self-deploy.
   Object.assign keeps the original entry order. Only the entries that 02m and 02p capture at
   load time must load before those parts, which is why the targeting actions stay in 02b;
   every other entry here is read from inside a function.
   ------------------------------------------------------------------------------------ */
Object.assign(FX_ACTIONS, {
  DRAW: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `draw ${a.n} card${a.n === 1 ? '' : 's'}`,
    run: async (c, a) => { const k = draw(c.p, a.n); log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); } },
  DRAW_UNTIL: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 10, txt: a => `draw until your Hand is ${a.n}`,      // v0.185 "draw until your Hand is three"
    run: async (c, a) => { const k = c.p.hand.length < a.n ? draw(c.p, a.n - c.p.hand.length) : 0; log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); } },
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
  BP_PLUS: { chk: a => Number.isInteger(a.n) && a.n >= 1000 && ['self', 'attacker', 'own'].includes(a.to || 'self') && (a.pick == null || ((a.to || 'self') === 'own' && Number.isInteger(a.pick) && a.pick >= 1 && a.pick <= 3)) && (a.per == null || perOk(a.per)) && (a.perReserve == null || (a.perReserve === true && a.per == null && (a.to || 'self') === 'self')), txt: a => `${a.to === 'own' ? 'your matching Spirits' : a.to === 'attacker' ? 'the attacking Spirit' : 'this Spirit'} gain +${a.n} BP${a.per ? ' for each matching card you control' : ''} this turn`,
    run: async (c, a) => {
      let L = (a.to || 'self') === 'self' ? [c.src] : a.to === 'attacker' ? (c.ctx.attacker ? [c.ctx.attacker] : []) : c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match));
      if (a.pick && L.length > a.pick) { const ch = []; while (ch.length < a.pick) { const t = await fxPickTarget(c, L.filter(x => !ch.includes(x)), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap up to ${a.pick} of your Spirits (${ch.length} chosen) for +${a.n} BP.`); if (!t) break; ch.push(t); } L = ch; }      // v0.196 pick: "target up to N Spirits you control"
      const n = a.perReserve ? a.n * c.p.reserve.n : a.per ? a.n * perCount(c.p, a.per) : a.n;     // v0.72 per: counted when it resolves; v0.195 perReserve: cores in your Reserve
      if (n) for (const s of L) { s.bpMod = (s.bpMod || 0) + n; log(`${CARDS[s.id].name} gets +${n} BP.`); }
    } },
  CORE_TO_SELF: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `+${a.n} core to this card`,
    can: c => c.p.reserve.n > 0,
    run: async (c, a) => { let k = 0; for (let j = 0; j < a.n; j++) if (addCore(c.p, c.src)) k++; if (k) log(`${CARDS[c.src.id].name} gets +${k} core${k === 1 ? '' : 's'}.`); } },
  REFRESH_SPIRIT: { chk: a => (a.match == null || hasMatch(a.match)) && (a.self == null || (a.self === true && a.match == null)) && (a.noAttack == null || a.noAttack === true) && (a.bp == null || (a.bp && Number.isInteger(a.bp.n) && a.bp.n >= 1000 && a.bp.n <= 5000 && a.bp.n % 1000 === 0 && (a.bp.oppAttackStep == null || a.bp.oppAttackStep === true))),      // v0.195 bp {n, oppAttackStep}: "refresh it, and during this turn it gains +n BP" (only in the opposing Attack Step with oppAttackStep)
    txt: a => `refresh one of your ${a.match ? 'matching ' : ''}Spirits`,
    cands: (c, a) => c.p.spirits.filter(s => s.exhausted && (!a || !a.self || s === c.src) && (!a || !a.match || fxMatch(CARDS[s.id], a.match))),
    can: (c, a) => FX_ACTIONS.REFRESH_SPIRIT.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.REFRESH_SPIRIT.cands(c, a), t = a.self ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your exhausted Spirits to refresh (glowing).`);
      if (!t) return; refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`);
      if (a.noAttack) { t.noAtkTurn = G.turnNo; log(`${CARDS[t.id].name} can't attack this turn.`); }      // v97 "Refresh it. Then, during this turn, it can't attack."
      if (a.bp && (!a.bp.oppAttackStep || (G.step === 5 && G.active !== c.p.key))) { t.bpMod = (t.bpMod || 0) + a.bp.n; log(`${CARDS[t.id].name} gains +${a.bp.n} BP this turn.`); }
    } },
  REFRESH_NEXUS: { chk: () => true, txt: () => 'refresh one of your Nexuses',
    cands: c => c.p.nexus.filter(n => n.exhausted),
    can: c => FX_ACTIONS.REFRESH_NEXUS.cands(c).length > 0,
    run: async c => {
      const t = await fxPickTarget(c, FX_ACTIONS.REFRESH_NEXUS.cands(c), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your exhausted Nexuses to refresh (glowing).`);
      if (!t) return; refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`);
    } },
  /* v0.33 effects of a card that is not on the field: revealed from the deck, or in the Hand */
  RETURN_TRASH: { chk: a => !!a.match && hasMatch(a.match) && (a.diffName == null || a.diffName === true) && (a.milled == null || a.milled === true),      // v0.168: any match shape (colour, cost, keyword), not only a name or family
    txt: a => `return a matching ${a.anyType ? 'card' : 'Spirit'} from your Trash to your Hand`,
    cands: (c, a) => c.p.trash.filter(t => (a.anyType || CARDS[t.id].type === 'Spirit') && fxMatch(CARDS[t.id], a.match) && !(a.diffName && CARDS[t.id].name === CARDS[c.src.id].name) && (!a.milled || (c.ctx.milled || []).includes(t))),      // v0.196 milled: only cards the earlier MILL sent to the Trash; v0.195 diffName: "besides <this card's name>" / "a different name to this Spirit's"
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
  /* v0.185 (schema 69) HAND_RECYCLE {perOppHand?, drawIfAll?: {match, n}}: "Return all your Hand to the deckbottom (any order; kept in Hand order). When one or more cards are returned, draw a card for each card in the opposing Hand" / "If all the cards returned have <X>, draw N cards" */
  HAND_RECYCLE: { chk: a => Object.keys(a).every(k => ['do', 'if', 'perOppHand', 'drawIfAll'].includes(k)) && (a.perOppHand === true) !== !!a.drawIfAll
      && (!a.drawIfAll || (!!a.drawIfAll.match && hasMatch(a.drawIfAll.match) && Number.isInteger(a.drawIfAll.n) && a.drawIfAll.n >= 1 && a.drawIfAll.n <= 5)),
    txt: () => 'return all your Hand to the deckbottom, then draw',
    run: async (c, a) => {
      const L = c.p.hand.splice(0), opp = G.p[other(c.p.key)].hand.length; c.ctx.did = L.length > 0; if (!L.length) return;
      for (const t of L) c.p.deck.push(t);
      log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'returns' : 'return'} ${L.length} card${L.length === 1 ? '' : 's'} from the Hand to the deckbottom.`);
      const n = a.perOppHand ? opp : L.every(t => fxMatch(CARDS[t.id], a.drawIfAll.match)) ? a.drawIfAll.n : 0;
      if (n) { const k = draw(c.p, n); log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    } },
  /* v0.185 (schema 66) DEPLOY_TRASH {match}: "Target a <X> Nexus card in your Trash. Deploy it without paying the cost." (Nexus only) */
  DEPLOY_TRASH: { chk: a => !!a.match && hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)),
    txt: () => 'deploy a matching Nexus card from your Trash without paying the cost',
    cands: (c, a) => c.p.trash.filter(t => CARDS[t.id].type === 'Nexus' && fxMatch(CARDS[t.id], a.match) && canPlaceFree(c.p, t)),
    can: (c, a) => FX_ACTIONS.DEPLOY_TRASH.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DEPLOY_TRASH.cands(c, a); c.ctx.did = false; if (!L.length) return;
      let t;
      if (c.p.cpu) t = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
      else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: 'Choose a Nexus to deploy from your Trash.', cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
        t = L.find(x => x.id === id) || L[0];
      }
      removeFrom(c.p.trash, t); c.p.hand.push(t);
      if (await summonFree(c.p, t)) c.ctx.did = true; else { removeFrom(c.p.hand, t); c.p.trash.push(t); }
    } },
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
  CORE_TO_NEXUS: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && hasMatch(a.match) && (a.perDestroyedCost == null || (a.perDestroyedCost === true && Number.isInteger(a.max) && a.max >= 1 && a.max <= 30)), txt: a => `+${a.n} core to one of your matching Nexuses`,
    cands: (c, a) => c.p.nexus.filter(x => fxMatch(CARDS[x.id], a.match)),
    can: (c, a) => c.p.reserve.n > 0 && FX_ACTIONS.CORE_TO_NEXUS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.CORE_TO_NEXUS.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the Nexus that receives +${a.n} core (glowing).`); let k = 0;
      const total = a.perDestroyedCost ? Math.min(c.ctx.destroyedCost || 0, a.max) : a.n;          // v0.37: +1 core per cost of the Spirit destroyed by the previous action
      for (let j = 0; j < total; j++) if (addCore(c.p, t)) k++;
      c.ctx.did = k > 0; if (k) log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} gets +${k} core${k === 1 ? '' : 's'}.`);
    } }
});

/* v0.169 REFRESH_SPIRIT n (1-3): "Target up to two <X> you control. Refresh them." (each pick is a still-exhausted matching Spirit); all: "Refresh all your <X> Spirits." */
(() => {
  const R = FX_ACTIONS.REFRESH_SPIRIT, rChk = R.chk, rTxt = R.txt, rRun = R.run;
  R.chk = a => (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 3)) && (a.all == null || a.all === true) && (!(a.all && a.n != null)) && rChk(a);
  R.txt = a => a.all ? `refresh all your ${a.match ? 'matching ' : ''}Spirits` : a.n > 1 ? `refresh up to ${a.n} of your ${a.match ? 'matching ' : ''}Spirits` : rTxt(a);
  R.run = async (c, a) => {
    if (a.all) {
      const L = R.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      for (const t of L) { refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`); }
      return;
    }
    if (!(a.n > 1)) return rRun(c, a);
    let k = 0;
    for (let j = 0; j < a.n; j++) {
      const L = R.cands(c, a); if (!L.length) break;
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an exhausted Spirit to refresh (${j + 1}/${a.n}, glowing).`);
      if (!t) break; refreshOne(t); k++; log(`${CARDS[t.id].name} is refreshed.`);
    }
    if (!k) c.ctx.did = false;
  };
})();
/* This part loads after 02k, whose load-time pass wraps every action's cands() with the immunity
   filter (trash-safe cards, opposing cards unaffected by this effect). Run it again so the entries
   defined here get the same wrapper; it is idempotent. */
wrapImmunity(Object.values(FX_ACTIONS));
