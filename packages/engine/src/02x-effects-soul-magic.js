/* v429 Magic cards used from Soul State (card magic.soulUse: "You can use this card from Soul State"; the Mitra Magic cards BS74-082/083, BS75-081).
   A soulUse Magic in Soul State is offered next to the Hand cards (magicSources, Flash windows); castMagic takes it out of Soul State and pays its cost as usual.
   Actions: SOUL_SWAP (reveal N, swap matching revealed cards with Soul State cards, the revealed cards go to the deckbottom), SOUL_TO_DECKBOTTOM (a cost),
   LIFE_COST_SHIELD (Life can't be reduced by attacks of opposing Cost N+ Spirits this turn), MAGIC_BOTTOM (this Magic goes to the deckbottom on the opposing turn),
   OPP_FX_LOCK_TURN (effects of every opposing Spirit/Nexus can't activate). */
const magicFromSoul = (p, inst) => !!p && !!p.soulState && p.soulState.includes(inst);
function magicSoulSrc(p, ctx) { return p.soulState.filter(t => CARDS[t.id].type === 'Magic' && CARDS[t.id].magic && CARDS[t.id].magic.soulUse && magicUsable(p, t, ctx)); }

FX_ACTIONS.SOUL_SWAP = { chk: a => Object.keys(a).every(k => ['do', 'if', 'n', 'match'].includes(k)) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && hasMatch(a.match),
  txt: a => `reveal ${a.n} cards from the top of your Deck, swap any number of matching revealed cards with your cards in Soul State, return the revealed cards to the bottom of the Deck`,
  can: c => c.p.deck.length > 0,
  run: async (c, a) => {
    const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
    log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`);
    await revealedFx(c.p);
    let k = 0;
    for (const r of top.filter(x => fxMatch(CARDS[x.id], a.match))) {
      const L = c.p.soulState.filter(s => fxMatch(CARDS[s.id], a.match)); if (!L.length) break;
      let s = null;
      if (c.p.cpu) { s = L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0]; if (CARDS[s.id].cost >= CARDS[r.id].cost) continue; }      // the CPU swaps only to raise the cost in Soul State
      else s = await chooseCard(c, L, `✨ ${nm}`, `Swap ${CARDS[r.id].name} (revealed) with a card in Soul State?`, true);
      if (!s || !toSoulState(c.p, r)) continue;
      removeFrom(c.p.soulState, s); s.inSoulState = false; c.p.revealed.push(s); k++;
    }
    const rest = c.p.revealed.splice(0); for (const x of rest) c.p.deck.push(x);
    log(`${nm}: ${k} card${k === 1 ? '' : 's'} swapped with Soul State; the revealed cards go to the bottom of the Deck.`);
    c.ctx.did = true;
  } };
FX_ACTIONS.SOUL_TO_DECKBOTTOM = { chk: a => Object.keys(a).every(k => ['do', 'if', 'match', 'n'].includes(k)) && hasMatch(a.match) && (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5)),
  txt: a => `return ${a.n > 1 ? a.n + ' matching cards' : 'a matching card'} from your Soul State to the bottom of your Deck`,
  cands: (c, a) => c.p.soulState.filter(x => fxMatch(CARDS[x.id], a.match)),
  can: (c, a) => FX_ACTIONS.SOUL_TO_DECKBOTTOM.cands(c, a).length >= (a.n || 1),      // v431 n: all of them or none
  run: async (c, a) => {
    c.ctx.did = false; const n = a.n || 1;
    if (!FX_ACTIONS.SOUL_TO_DECKBOTTOM.can(c, a)) return;
    for (let i = 0; i < n; i++) {
      const t = await chooseCard(c, FX_ACTIONS.SOUL_TO_DECKBOTTOM.cands(c, a), `✨ ${CARDS[c.src.id].name}`, `Choose a card in Soul State to return to the bottom of your Deck (${i + 1}/${n}).`, false);
      if (!t) return;
      removeFrom(c.p.soulState, t); t.inSoulState = false; c.p.deck.push(t); c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from Soul State to the bottom of the Deck.`);
    }
  } };
/* v431 REVEAL_SUMMON_PAY {n, match}: reveal n cards from the decktop, you can summon one matching Spirit among them by paying its cost, the rest go to the deckbottom (BS75-067). */
FX_ACTIONS.REVEAL_SUMMON_PAY = { chk: a => Object.keys(a).every(k => ['do', 'if', 'n', 'match'].includes(k)) && Number.isInteger(a.n) && a.n >= 1 && a.n <= 6 && hasMatch(a.match),
  txt: a => `reveal ${a.n} cards from your decktop, you can summon a matching Spirit among them by paying its cost, return the rest to the deckbottom`, can: c => c.p.deck.length > 0,
  run: async (c, a) => {
    const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top; c.ctx.did = false;
    log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' }); await revealedFx(c.p);
    const L = c.p.revealed.filter(x => CARDS[x.id].type === 'Spirit' && fxMatch(CARDS[x.id], a.match) && canPlacePaid(c.p, x));
    const t = L.length ? await chooseCard(c, L, `✨ ${nm}`, 'Pay the cost to summon one of these revealed Spirits?', true) : null;
    if (t) { removeFrom(c.p.revealed, t); c.p.hand.push(t); if (await summonPaid(c.p, t)) c.ctx.did = true; else { removeFrom(c.p.hand, t); c.p.revealed.push(t); } }
    const rest = c.p.revealed.splice(0); for (const x of rest) c.p.deck.push(x);
  } };
FX_ACTIONS.LIFE_COST_SHIELD = { chk: a => Object.keys(a).every(k => ['do', 'if', 'costGe'].includes(k)) && Number.isInteger(a.costGe) && a.costGe >= 1 && a.costGe <= 20,
  txt: a => `during this turn, your Life can't be reduced by the attacks of opposing Cost ${a.costGe} or more Spirits/Ultimates`, can: () => true,
  run: async (c, a) => { c.p.costShield = { turn: G.turnNo, ge: a.costGe }; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${poss(c.p)} Life can't be reduced by the attacks of opposing Cost ${a.costGe} or more Spirits this turn.`); } };
FX_ACTIONS.MAGIC_BOTTOM = { chk: a => Object.keys(a).every(k => ['do', 'if', 'oppTurn'].includes(k)) && a.oppTurn === true,
  txt: () => "if it's the opposing turn, return this card to the bottom of the Deck", can: () => true,
  run: async c => { c.ctx.did = G.active !== c.p.key; if (c.ctx.did) c.src.toBottom = true; } };      // castMagic puts the card on the deckbottom instead of the Trash
FX_ACTIONS.OPP_FX_LOCK_TURN = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "the effects of every opposing Spirit/Nexus can't activate (this turn; Nexus until your next Start Step)", can: () => true,
  run: async c => { c.p.fxLockTurn = G.turnNo; c.p.nexusLockLe = 99; c.ctx.did = true; log(`${CARDS[c.src.id].name}: the effects of every opposing Spirit/Nexus can't activate.`); } };

/* v430 SOUL_CORE_TO_TRASH: "you can send your Soul Core to the Trash" as an effect step (BS75-X08; the Soul Core must be in a place it can leave without depleting a Spirit). */
FX_ACTIONS.SOUL_CORE_TO_TRASH = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => 'send your Soul Core to the Trash', can: c => soulCoreHolder(c.p, null) !== null,
  run: async (c) => { const h = soulCoreHolder(c.p, null); if (h === null) { c.ctx.did = false; return; } if (!c.p.cpu && !(await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: 'Send your Soul Core to the Trash?', buttons: [{ label: 'Yes', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] }))) { c.ctx.did = false; return; } soulToTrash(c.p, h); c.ctx.did = true; } };

/* v435 BS74-X06 Lord-Dragon-Glazar: card field soulBurst ("(Once per Turn: Same Name) When your cards enter Soul State, and there are five or more cards in Soul State, you can immediately
   activate the Soul Burst of this set card / this card in Soul State"): soulEnterHook queues SOUL_BURST, soulBurstCheck runs the Burst through maybeBurst1 (ctx.force skips the "when", ctx.fromSoul = the card in Soul State).
   Burst when LIFE_ANY (your Life or the opposing Life reduced, see maybeBurst). STATIC UNAFFECTED from.oppField (colours of the symbols on the opposing Field, fromCols).
   Actions: NEXUS_CORE_TO_RESERVE {family}, RETURN_OPP_SNB (return an opposing Spirit / Nexus / set Burst to the deckbottom). */
function fromCols(f, cols, owner) {
  if (f.oppField) { const sy = symbolsOn(G.p[other(owner.key)]); return cols.some(x => sy[x] > 0); }
  return !f.colors || f.colors.some(x => cols.includes(x));
}
async function soulBurstCheck(p) {
  if (!G || G.over) return;
  p.sbTurn = p.sbTurn || {};
  const cands = p.soulState.filter(x => CARDS[x.id].soulBurst && CARDS[x.id].burst).map(x => ({ x, soul: true })).concat(p.burst && !p.burst.mirage && CARDS[p.burst.id].soulBurst ? [{ x: p.burst, soul: false }] : []);
  for (const { x, soul } of cands) {
    const nm = CARDS[x.id].name; if (p.sbTurn[nm] === G.turnNo || p.soulState.length < ((CARDS[x.id].burst || {}).soulAt || 5)) continue;
    if (await maybeBurst1(p, 'SOUL_BURST', soul ? { force: true, fromSoul: x } : { force: true })) { p.sbTurn[nm] = G.turnNo; break; }
  }
}
/* v440 trigger OPP_LEFT_BY_BURST (Grandwalker Manaka): maybeBurst1 (08) fires it for the Burst's owner when opposing Spirits/Ultimates left the Field while that Burst resolved (ctx.n) */
FX_TRIGGER_TEXT.OPP_LEFT_BY_BURST = 'When an opposing Spirit/Ultimate leaves the Field due to your Burst effect';
/* v441 STATIC DRAW_ONE (Grandwalker Alex): "when either player draws via an effect, they can only draw one card" (any draw outside the Draw Step); read by draw() */
/* v442 Grandphosis (Grandwalker Nexus): the Nexus is also treated as a Spirit for the rest of the turn (moved into p.spirits with gpBp, its Nexus effects stay on), "can only be destroyed by Grandwalker Nexuses".
   House reading: by effects only when the source is a Grandwalker Nexus; in battle only when the opposing fighter is a Nexus (a Grandphosis Grandwalker Nexus). */
const isGwNexus = x => !!x && CARDS[x.id].type === 'Nexus' && (CARDS[x.id].families || []).includes('Grandwalker');
const gwNexusCount = p => p.nexus.concat(p.spirits.filter(x => x.gpBp)).filter(isGwNexus).length;
const gpShield = (p, s, by) => !!s.gpBp && by !== 'battle' && !isGwNexus(G && G.fxSrc);
const gpBattleSafe = (s, foe) => !!s.gpBp && !isGwNexus(foe);
const drawOneOnly = () => !!G && [G.p.player, G.p.opponent].some(o => fieldList(o).some(f => flagActive(o, 'DRAW_ONE', f)));
Object.assign(FX_ACTIONS, {
  NEXUS_CORE_TO_RESERVE: { chk: a => typeof a.family === 'string' && a.family.length > 0 && Object.keys(a).every(k => ['do', 'if', 'family'].includes(k)),
    txt: a => `send a core from any of your "${a.family}" Nexus to the Reserve`,
    cands: (c, a) => c.p.nexus.filter(x => x.cores - (x.soul ? 1 : 0) > 0 && (CARDS[x.id].families || []).some(f => f.toLowerCase().includes(a.family.toLowerCase()))),
    can: (c, a) => FX_ACTIONS.NEXUS_CORE_TO_RESERVE.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NEXUS_CORE_TO_RESERVE.cands(c, a), p = c.p, nm = CARDS[c.src.id].name; c.ctx.did = false; if (!L.length) return;
      const t = p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await chooseCard(c, L, `✨ ${nm}`, 'Send a core from which Nexus to the Reserve?', true);
      if (!t || !p.nexus.includes(t)) return;
      coreEvN(p, t.uid, 'reserve', 1, false); t.cores--; p.reserve.n++; c.ctx.did = true; log(`${nm}: a core from ${CARDS[t.id].name} goes to ${poss(p)} Reserve.`); checkDepletion(p); io.view({ type: 'board' });
    } },
  /* v438 ACTIVATE_SET_BURST {thenSet}: "Immediately activate one of your set Bursts" (Grandwalker Kei): ignores the Burst's own timing (force), its other conditions still apply; thenSet = "after that Burst activates, you can set a Burst card from your Hand" */
  ACTIVATE_SET_BURST: { chk: a => Object.keys(a).every(k => ['do', 'if', 'thenSet'].includes(k)) && (a.thenSet == null || a.thenSet === true),
    txt: a => 'immediately activate your set Burst' + (a.thenSet ? '; after that you can set a Burst card from your Hand' : ''),
    can: c => !!c.p.burst && !c.p.burst.mirage && !!CARDS[c.p.burst.id].burst && !burstLocked(c.p) && G.noBurst !== c.p.key,
    run: async (c, a) => {
      const b = c.p.burst; if (!b || b.mirage) { c.ctx.did = false; return; }
      const ok = await maybeBurst1(c.p, 'FORCE', { force: true }); c.ctx.did = ok; if (!ok || !a.thenSet || G.over) return;
      const L = c.p.hand.filter(h => h !== c.src && CARDS[h.id].burst); if (!L.length) return;
      const h = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, 'You can set a card with Burst effect from your Hand.', true);
      if (!h) return; setBurst(c.p, h, false); io.view({ type: 'board' }); await fireBurstSet(c.p);
    } },
  /* v442 GRANDPHOSIS {bp}: "During this turn, this Nexus is also treated as a Spirit with LV1/LV2 <bp> BP, and can only be destroyed by Grandwalker Nexuses" (cost: nexusToVoid on the ability) */
  GRANDPHOSIS: { chk: a => Number.isInteger(a.bp) && a.bp > 0 && Object.keys(a).every(k => ['do', 'bp', 'if', 'noRefresh'].includes(k)) && (a.noRefresh == null || a.noRefresh === true), txt: a => `during this turn, this Nexus is also treated as a Spirit with ${a.bp} BP${a.noRefresh ? ' that can\'t be refreshed' : ''} and can only be destroyed by Grandwalker Nexuses`,
    can: c => c.p.nexus.includes(c.src) && c.src.cores > 0,
    run: async (c, a) => {
      const t = c.src; if (!c.p.nexus.includes(t)) { c.ctx.did = false; return; }
      c.p.nexus.splice(c.p.nexus.indexOf(t), 1); c.p.spirits.push(t); t.asSpirit = true; t.gpBp = a.bp; t.gp = G.turnNo; if (a.noRefresh) t.gpNoRefresh = true; c.ctx.did = true;
      log(`${CARDS[t.id].name} enters the Grandphosis state (treated as a Spirit this turn).`); io.view({ type: 'board' });
    } },
  /* v445 SUMMON_HAND_REMOVED {match}: "Summon a <family> card from your Hand/Removed Zone" (the cost is paid) */
  SUMMON_HAND_REMOVED: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)), txt: () => 'summon a matching card from your Hand/Removed Zone (paying its cost)',
    cands: (c, a) => c.p.hand.concat(c.p.removed).filter(x => x !== c.src && fxMatch(CARDS[x.id], a.match) && canPlacePaid(c.p, x)),
    can: (c, a) => FX_ACTIONS.SUMMON_HAND_REMOVED.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SUMMON_HAND_REMOVED.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, 'Choose a card from your Hand/Removed Zone to summon (you pay its cost).', true);
      if (!t) { c.ctx.did = false; return; } c.ctx.did = await summonPaid(c.p, t);
    } },
  /* v445 REFRESH_SELF_OR: "Refresh either this Nexus, or a <match> Spirit you control" */
  REFRESH_SELF_OR: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)), txt: () => 'refresh this Nexus or a matching Spirit you control',
    cands: (c, a) => c.p.nexus.filter(x => x === c.src && x.exhausted).concat(c.p.spirits.filter(x => x.exhausted && !x.asSpirit && fxMatch(CARDS[x.id], a.match))),
    can: (c, a) => FX_ACTIONS.REFRESH_SELF_OR.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.REFRESH_SELF_OR.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap this Nexus or one of your exhausted Spirits to refresh (glowing).`);
      if (!t) { c.ctx.did = false; return; } refreshOne(t); c.ctx.did = true; log(`${CARDS[t.id].name} is refreshed.`); await fireFx(c.p, 'REFRESHED', t, {});
    } },
  /* v442 REFRESH_GP_NEXUS: "Besides any exactly-named <this card>, refresh a Grandphosis state Grandwalker Nexus you control" */
  REFRESH_GP_NEXUS: { chk: a => Object.keys(a).every(k => ['do', 'if', 'exceptSelfName'].includes(k)), txt: () => 'refresh a Grandwalker Nexus of yours in the Grandphosis state (besides one with this card name)',
    cands: (c, a) => c.p.spirits.filter(x => x.gpBp && x.exhausted && isGwNexus(x) && !(a.exceptSelfName && CARDS[x.id].name === CARDS[c.src.id].name)),
    can: (c, a) => FX_ACTIONS.REFRESH_GP_NEXUS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.REFRESH_GP_NEXUS.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = L.length === 1 || c.p.cpu ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your Grandwalker Nexus in the Grandphosis state to refresh it.`); if (!t) { c.ctx.did = false; return; }
      refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`); await fireFx(c.p, 'REFRESHED', t, {}); io.view({ type: 'board' });
    } },
  /* v441 PREADVENT_REFRESH: "by adding a card from your Hand as a pre-Advent card underneath a Spirit with Advent you control, refresh that Spirit" (Grandwalker Alex) */
  PREADVENT_REFRESH: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'by adding a card from your Hand as a pre-Advent card underneath one of your Spirits with Advent, refresh that Spirit',
    cands: c => c.p.hand.length ? c.p.spirits.filter(s => cardHasKeyword(CARDS[s.id], 'Advent')) : [],
    can: c => FX_ACTIONS.PREADVENT_REFRESH.cands(c).length > 0,
    run: async c => {
      const L = FX_ACTIONS.PREADVENT_REFRESH.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? (L.find(s => s.exhausted) || L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your Spirit with Advent to put a Hand card under it and refresh it.`); if (!t) { c.ctx.did = false; return; }
      const H = c.p.hand.filter(h => h !== c.src), cost = x => CARDS[x.id].cost;
      const h = !H.length ? null : c.p.cpu ? H.slice().sort((x, y) => cost(x) - cost(y))[0] : await chooseCard(c, H, `✨ ${_pn(c)}`, 'Choose a card from your Hand to add as a pre-Advent card.', false);
      if (!h) { c.ctx.did = false; return; }
      removeFrom(c.p.hand, h); t.under.push(h); log(`${CARDS[c.src.id].name}: ${CARDS[h.id].name} is added under ${CARDS[t.id].name} as a pre-Advent card.`);
      if (t.exhausted) { refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`); await fireFx(c.p, 'REFRESHED', t, {}); }
      io.view({ type: 'board' });
    } },
  RETURN_OPP_SNB: { chk: a => a.to === 'deckBottom' && Object.keys(a).every(k => ['do', 'if', 'to', 'unleash'].includes(k)) && (a.unleash == null || (a.unleash.family && typeof a.unleash.family === 'string' && (a.unleash.color == null || COLORS.includes(a.unleash.color)))),
    txt: a => 'return an opposing Spirit, Nexus or set Burst to the bottom of the Deck' + (a.unleash ? `; by sending a core from one of your ${a.unleash.color ? cap(a.unleash.color) + ' ' : ''}${a.unleash.family} Nexus to this card, it can't be prevented` : ''),
    kinds: (c, free) => ['spirit', 'nexus', 'burst'].filter(k => k === 'burst' ? !!c.opp.burst && !c.opp.burst.mirage : (k === 'spirit' ? c.opp.spirits : c.opp.nexus).some(x => free || !fxImmune(c.opp, x, c))),
    pay: (c, a) => !a.unleash || !c.p.spirits.includes(c.src) ? [] : c.p.nexus.filter(x => x.cores - (x.soul ? 1 : 0) > 0 && (CARDS[x.id].families || []).some(f => f.toLowerCase().includes(a.unleash.family.toLowerCase())) && (!a.unleash.color || (CARDS[x.id].colors || [CARDS[x.id].symbol]).includes(a.unleash.color))),
    can: (c, a) => FX_ACTIONS.RETURN_OPP_SNB.kinds(c, FX_ACTIONS.RETURN_OPP_SNB.pay(c, a).length > 0).length > 0,
    run: async (c, a) => {
      const F = FX_ACTIONS.RETURN_OPP_SNB, nm = CARDS[c.src.id].name; c.ctx.did = false;
      let free = false, K = F.kinds(c, false);
      const P = F.pay(c, a);
      if (P.length && F.kinds(c, true).length) {      // v437 Unleash: a core from the matching Nexus to this card makes the return unpreventable
        const yes = c.p.cpu ? true : await ask({ title: `✨ ${nm}`, peek: true, html: `Send 1 core from a ${a.unleash.family} Nexus to this card so the return can't be prevented?`, buttons: [{ label: 'Send a core', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] });
        if (yes) {
          const t = P.length === 1 || c.p.cpu ? P.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, P, `✨ <b>${esc(nm)}</b><br>Tap the Nexus that sends 1 core to this card (glowing).`);
          if (t && P.includes(t)) { coreEvN(c.p, t.uid, c.src.uid, 1, false); t.cores--; c.src.cores++; log(`${nm}: a core moves from ${CARDS[t.id].name} to ${nm}; the effect can't be prevented.`); free = true; K = F.kinds(c, true); io.view({ type: 'board' }); }
        }
      }
      if (!K.length) return;
      const lbl = { spirit: 'Spirit', nexus: 'Nexus', burst: 'Burst' };
      const k = c.p.cpu || K.length === 1 ? K[0] : await ask({ title: `✨ ${nm}`, peek: true, html: 'Return which opposing card to the bottom of the Deck?', buttons: K.map(x => ({ label: lbl[x], cls: 'primary', value: x })).concat([{ label: 'Skip', cls: 'cancel', value: null }]) });
      if (!k) return;
      if (k === 'burst') { const b = c.opp.burst; if (!b || b.mirage) return; c.opp.burst = null; c.opp.deck.push(b); log(`${nm}: the opposing set Burst goes to the bottom of the Deck.`); c.ctx.did = true; io.view({ type: 'board' }); return; }
      await FX_ACTIONS.BOUNCE_OPP.run(c, { do: 'BOUNCE_OPP', to: 'deckBottom', kind: k, ignoreImmune: free ? true : undefined });
    } },
});

/* v447 Grandwalker Nyx (BS72-CX02) and its family: "when the number of cores on your Contractor Nyx is reduced" (trigger NEXUS_DOWN, queued once per batch by
   nexusCoresDown from coreEv / nexusVoided, fired on the field and from the Trash with zone:'trash'); "the LV cost of every opposing Spirit/Ultimate gets +1
   during this turn" (lvCostUp: each LV threshold needs one more core; never for Nexuses); core removal from any opposing Spirit/Ultimate/Nexus down to one core. */
const nyxNexus = p => p.nexus.filter(n => /Contractor Nyx/i.test(CARDS[n.id].name));
function lvCostUp(i) { const o = G && CARDS[i.id].type !== 'Nexus' ? ownerOf(i) : null; return o && o.lvCostUp === G.turnNo ? 1 : 0; }
function nexusCoresDown(p, uid) {
  if (!G || !G.evQ || G.over) return;
  const n = p.nexus.find(x => x.uid === uid); if (!n || !/Contractor Nyx/i.test(CARDS[n.id].name) || G.evQ.some(e => e.type === 'NEXUS_DOWN' && e.key === p.key)) return;
  G.evQ.push({ type: 'NEXUS_DOWN', key: p.key, inst: n });
}
Object.assign(FX_ACTIONS, {
  OPP_LV_COST_UP: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'during this turn, the LV cost of every opposing Spirit/Ultimate gets +1', cands: () => [1], can: () => true,
    run: async c => { c.opp.lvCostUp = G.turnNo; log(`${_pn(c)}: during this turn, the LV cost of ${poss(c.opp)} Spirits/Ultimates gets +1.`); io.view({ type: 'board' }); } },
  OPP_CORES_UNTIL_ONE: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'send cores from an opposing Spirit/Ultimate/Nexus to the Reserve until one core remains on it',
    cands: c => c.opp.spirits.concat(c.opp.nexus).filter(t => totalCores(t) > 1 && t.cores > 0 && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.OPP_CORES_UNTIL_ONE.cands(c).length > 0,
    run: async c => {
      const L = FX_ACTIONS.OPP_CORES_UNTIL_ONE.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? L.slice().sort((x, y) => totalCores(y) - totalCores(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit/Ultimate/Nexus to send cores from (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      const m = Math.max(0, Math.min(t.cores, totalCores(t) - 1, coreTakeCap(c.opp, t, Infinity))); if (!m) { c.ctx.did = false; return; }
      coreEvN(c.opp, t.uid, 'reserve', m, false); t.cores -= m; c.opp.reserve.n += m; c.ctx.did = true;
      log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Reserve.`); checkDepletion(c.opp); io.view({ type: 'board' });
    } },
  /* NYX_CORES_TO_VOID {n}: "you can send n cores from any of your Contractor Nyx Grandwalker Nexuses to the Void" (optional; c.ctx.did tells the next "when you've done so" action) */
  NYX_CORES_TO_VOID: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 4 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)), txt: a => `you can send ${a.n} cores from any of your Contractor Nyx Nexuses to the Void`,
    cands: (c, a) => nyxNexus(c.p).filter(n => n.cores >= a.n), can: (c, a) => FX_ACTIONS.NYX_CORES_TO_VOID.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NYX_CORES_TO_VOID.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      if (!c.p.cpu && !await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Send ${a.n} cores from your Contractor Nyx to the Void?`, buttons: [{ label: 'Send', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] })) { c.ctx.did = false; return; }
      const t = L.length === 1 || c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your Contractor Nyx to send ${a.n} cores to the Void (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      coreEvN(c.p, t.uid, 'void', a.n, false); t.cores -= a.n; c.p.void += a.n; c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${a.n} cores from ${CARDS[t.id].name} go to the Void.`); io.view({ type: 'board' });
    } },
  /* DESTROY_CORES_GE {n}: "destroy an opposing Spirit/Ultimate with n or more cores on it" (only Armor-style immunity stops it: fxImmune) */
  DESTROY_CORES_GE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 9 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)), txt: a => `destroy an opposing Spirit/Ultimate with ${a.n} or more cores on it`,
    cands: (c, a) => c.opp.spirits.filter(t => totalCores(t) >= a.n && !fxImmune(c.opp, t)), can: (c, a) => FX_ACTIONS.DESTROY_CORES_GE.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DESTROY_CORES_GE.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = L.length === 1 || c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to destroy (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); c.ctx.did = true; io.view({ type: 'board' });
    } },
});
async function trashCoreGw(c) {
  const L = c.p.nexus.filter(n => isGwNexus(n) && c.p.reserve.n > 0); if (!L.length) return;
  const t = L.length === 1 || c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap your Grandwalker Nexus to put 1 core on (glowing).`);
  if (t && addCore(c.p, t)) { log(`${CARDS[t.id].name}: +1 core.`); io.view({ type: 'board' }); }
}
/* v447 Muddy Swing (BS73-075) Main: "During this turn, when opposing Spirits/Ultimates are depleted, if your Hand is six or less, you can draw a card" (Spirits only: the engine has no Nexus depletion) */
function muddyDraw(ev) {
  const q = ev.depl && G.p[other(ev.key)]; if (!q || q.muddyTurn !== G.turnNo || q.hand.length > (q.muddyLe || 6)) return;
  const k = draw(q, 1); log(`${who(q)} ${q.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'} (Muddy Swing).`); handUp(q, k);
}
FX_ACTIONS.DRAW_ON_OPP_DEPLETE = { chk: a => Object.keys(a).every(k => ['do', 'if', 'handLe'].includes(k)) && Number.isInteger(a.handLe) && a.handLe >= 1 && a.handLe <= 10, txt: a => `during this turn, when opposing Spirits/Ultimates are depleted, if your Hand is ${a.handLe} or less, draw a card`, can: () => true,
  run: async (c, a) => { c.p.muddyTurn = G.turnNo; c.p.muddyLe = a.handLe; c.ctx.did = true; log(`${CARDS[c.src.id].name}: during this turn, you draw a card when an opposing Spirit is depleted (Hand 6 or less).`); } };

/* v449 ACTIVATE_MIRAGE_FX: "you can activate the Mirage effect written on this Spirit" (Jellime LV2 When Destroyed): runs the card's own zone:'mirage' ACTIVATE effect; the once-per-turn mark is not used. */
FX_ACTIONS.ACTIVATE_MIRAGE_FX = { chk: a => Object.keys(a).every(k => k === 'do' || k === 'if'), txt: () => 'activate the Mirage effect written on this Spirit', can: () => true,
  run: async c => {
    const e = (CARDS[c.src.id].effects || []).find(x => x.trigger === 'ACTIVATE' && x.zone === 'mirage'); c.ctx.did = false; if (!e) return;
    log(`${CARDS[c.src.id].name}: the Mirage effect is activated.`); await runActions({ p: c.p, opp: c.opp, src: c.src, ctx: {} }, e, 'ACTIVATE'); c.ctx.did = true;
  } };

/* v451 MIRAGE_SET_TRASH {match}: "set a matching Mirage card from your Trash without paying the cost" (Silkie LV2 When Attacks); only while you have no Mirage set. */
FX_ACTIONS.MIRAGE_SET_TRASH = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: () => 'set a matching Mirage card from your Trash without paying the cost', can: c => !c.p.mirage,
  run: async (c, a) => {
    const L = c.p.mirage ? [] : c.p.trash.filter(x => CARDS[x.id].mirage && fxMatch(CARDS[x.id], a.match)); c.ctx.did = false; if (!L.length) return;
    const t = await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, 'Choose a Mirage card in your Trash.', true); if (!t) return;
    removeFrom(c.p.trash, t); t.mirage = true; c.p.mirage = t; c.ctx.did = true;
    log(`${who(c.p)} ${c.p.cpu ? 'sets' : 'set'} a Mirage from the Trash without paying the cost: ${CARDS[t.id].name}.`);
    await fireFx(c.p, 'MIRAGE_SET', t, {});
  } };

/* v452 Headspring (BS73-066): STATIC EXHAUST_ON_CORE_PUT (to:'all') = "Besides via summon, exhaust every Spirit that has cores being put onto it" (Main Steps). runActions snapshots the Spirits' cores around each action in a Main Step; a Spirit already on the field whose cores grew is exhausted (EXHAUSTED_FX fires as for an effect). */
const coreWatchBegin = () => { if (!G || !isMainStep()) return null; const m = new Map(); for (const s of [G.p.player, G.p.opponent]) for (const sp of s.spirits) m.set(sp, sp.cores); return m; };
async function coreWatchEnd(m, src) {
  if (!m || G.over) return;
  for (const s of [G.p.player, G.p.opponent]) for (const sp of s.spirits) {
    if (!m.has(sp) || sp.cores <= m.get(sp) || sp.exhausted || !flagActive(s, 'EXHAUST_ON_CORE_PUT', sp)) continue;
    sp.exhausted = true; log(`${CARDS[sp.id].name} is exhausted (cores were put onto it).`);
    await fireFx(G.p[other(s.key)], 'EXHAUSTED_FX', null, { side: 'opp', fxSrc: src }); await fireFx(s, 'EXHAUSTED_FX', null, { side: 'own', subject: sp, fxSrc: src });
  }
}

/* v452 DEPLOY_SELF_TRASH {costN}: "deploy this card from the Trash by paying N cost" (Headspring); the card must be in the Trash. */
FX_ACTIONS.DEPLOY_SELF_TRASH = { chk: a => Number.isInteger(a.costN) && a.costN >= 0 && a.costN <= 10 && Object.keys(a).every(k => ['do', 'costN', 'if'].includes(k)), txt: a => `deploy this card from the Trash by paying ${a.costN} cost`,
  can: (c, a) => c.p.trash.includes(c.src) && canPlacePaid(c.p, c.src) && reserveTotal(c.p) >= a.costN + minCores(CARDS[c.src.id]),
  run: async (c, a) => {
    if (!FX_ACTIONS.DEPLOY_SELF_TRASH.can(c, a)) { c.ctx.did = false; return; }
    removeFrom(c.p.trash, c.src); c.p.hand.push(c.src);
    if (await summonPaid(c.p, c.src, { costN: a.costN })) c.ctx.did = true; else { removeFrom(c.p.hand, c.src); c.p.trash.push(c.src); c.ctx.did = false; }
  } };

/* v453 Grandwalker Morrigan (BS73-CX02) and its family: trigger OWN_RETURNED ("when your Spirit is returned to the Hand", queued once per Nexus from bounceCard),
   STATIC flag BOUNCE_COST_PLUS (Makala: when returned by the Contract Skill of Morrigan its cost counts +1 per counter), and action MORRIGAN_BOUNCE_SUMMON
   {match}: return one of your non-battling Yellow-only Spirits to the Hand, then summon/deploy from the Hand a matching card of lower cost without paying. */
function ownReturned(p, t) {
  if (!G || !G.evQ || G.over) return;
  for (const n of p.nexus) if (fxEntries(n).some(({ e }) => e.trigger === 'OWN_RETURNED')) G.evQ.push({ type: 'OWN_RETURNED', key: p.key, inst: n, subj: t });
}
const bounceCost = (p, t) => CARDS[t.id].cost + (fxEntries(t).some(({ e }) => e.flag === 'BOUNCE_COST_PLUS') ? p.count : 0);
FX_ACTIONS.MORRIGAN_BOUNCE_SUMMON = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: () => 'return one of your non-battling Yellow-only Spirits to the Hand, then summon/deploy a cheaper matching card from the Hand without paying the cost',
  cands: (c, a) => c.p.spirits.filter(s => s !== G.attacker && s !== G.blocker && fxMatch(CARDS[s.id], { mono: true, color: 'yellow' }) && c.p.hand.some(h => CARDS[h.id].cost < bounceCost(c.p, s) && fxMatch(CARDS[h.id], a.match) && canPlaceFree(c.p, h))),
  can: (c, a) => FX_ACTIONS.MORRIGAN_BOUNCE_SUMMON.cands(c, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; const L = FX_ACTIONS.MORRIGAN_BOUNCE_SUMMON.cands(c, a); if (!L.length) return;
    const t = await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, 'Return one of your Yellow-only Spirits to the Hand.', true); if (!t) return;
    const cap = bounceCost(c.p, t), pick = c.p.hand.filter(h => CARDS[h.id].cost < cap && fxMatch(CARDS[h.id], a.match) && canPlaceFree(c.p, h));
    bounceCard(c.p, t, 'hand'); if (!c.p.hand.includes(t)) return;
    const h = await chooseCard(c, pick.filter(x => c.p.hand.includes(x)), `✨ ${CARDS[c.src.id].name}`, 'Summon/deploy a card of lower cost without paying the cost.', false); if (!h) { c.ctx.did = true; return; }
    c.ctx.did = true; await summonFree(c.p, h);
  } };
/* v453 TRASH_SUMMON_PAY {match, costN}: "summon/deploy a <match> card from your Trash by paying N cost" (Fluora);
   USE_TRASH_FLASH {match}: "activate a Flash effect of a <match> Magic card (or a Spirit treated as one) in your Trash without paying the cost" (Koon-Zite; the card stays in the Trash);
   USE_SELF_FLASH: "activate the Flash effect written on this Spirit without paying the cost" (Fluora Lv2-3; Flash with no target only). */
const magicLike = k => k.type === 'Magic' || (k.type === 'Spirit' && k.magic && k.magic.alsoMagic);
FX_ACTIONS.TRASH_SUMMON_PAY = { chk: a => hasMatch(a.match) && Number.isInteger(a.costN) && a.costN >= 0 && a.costN <= 10 && Object.keys(a).every(k => ['do', 'match', 'costN', 'if'].includes(k)), txt: a => `summon/deploy a matching card from your Trash by paying ${a.costN} cost`,
  cands: (c, a) => c.p.trash.filter(h => ['Spirit', 'Nexus'].includes(CARDS[h.id].type) && fxMatch(CARDS[h.id], a.match) && canPlacePaid(c.p, h) && reserveTotal(c.p) >= a.costN + minCores(CARDS[h.id])),
  can: (c, a) => FX_ACTIONS.TRASH_SUMMON_PAY.cands(c, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; const L = FX_ACTIONS.TRASH_SUMMON_PAY.cands(c, a); if (!L.length) return;
    const t = await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, `Summon/deploy a card from your Trash by paying ${a.costN} cost.`, true); if (!t) return;
    removeFrom(c.p.trash, t); c.p.hand.push(t);
    if (await summonPaid(c.p, t, { costN: a.costN })) c.ctx.did = true; else { removeFrom(c.p.hand, t); c.p.trash.push(t); }
  } };
const trashFlashOK = (p, h) => { removeFrom(p.trash, h); p.hand.push(h); const ok = magicUsable(p, h, 'flash', true); removeFrom(p.hand, h); p.trash.push(h); return ok; };
FX_ACTIONS.USE_TRASH_FLASH = { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'match', 'if'].includes(k)), txt: () => 'activate a Flash effect of a matching Magic card in your Trash without paying the cost',
  cands: (c, a) => c.p.trash.filter(h => magicLike(CARDS[h.id]) && fxMatch(CARDS[h.id], a.match) && trashFlashOK(c.p, h)),
  can: (c, a) => FX_ACTIONS.USE_TRASH_FLASH.cands(c, a).length > 0,
  run: async (c, a) => {
    c.ctx.did = false; const L = FX_ACTIONS.USE_TRASH_FLASH.cands(c, a); if (!L.length) return;
    const h = await chooseCard(c, L, `✨ ${CARDS[c.src.id].name}`, 'Use the Flash effect of which card in your Trash (no cost)?', true); if (!h) return;
    removeFrom(c.p.trash, h); c.p.hand.push(h);
    const k = CARDS[h.id], keep = k.magic && k.magic.summonAfter; if (keep) k.magic.summonAfter = false;      // the card must stay in the Trash
    try {
      let ch;
      if (c.p.cpu) { const tg = magicTargets(c.p, h, 'flash'); ch = { inst: h, target: tg && tg.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] || null, plan: null, ctx: 'flash', free: true }; }
      else { ch = await prepareHumanMagic(c.p, h, 'flash', true); if (!ch) { removeFrom(c.p.hand, h); c.p.trash.push(h); return; } }
      log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'uses' : 'use'} the Flash effect of ${k.name} from the Trash without paying the cost.`);
      await castMagic(c.p, ch); c.ctx.did = true;
    } finally { if (keep) k.magic.summonAfter = true; }
    io.view({ type: 'board' });
  } };
FX_ACTIONS.USE_SELF_FLASH = { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)), txt: () => 'activate the Flash effect written on this Spirit without paying the cost',
  can: c => { const m = CARDS[c.src.id].magic && magicFxAt(c.p, c.src, 'flash'); return !!m && m.effect === 'ACTIONS'; },
  run: async c => { const m = magicFxAt(c.p, c.src, 'flash'); c.ctx.did = false; if (!m || m.effect !== 'ACTIONS') return; await MAGIC_FX.ACTIONS.apply(c.p, c.opp, null, m.value, m, c.src); c.ctx.did = true; } };
