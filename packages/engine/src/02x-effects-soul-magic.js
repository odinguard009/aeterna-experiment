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
