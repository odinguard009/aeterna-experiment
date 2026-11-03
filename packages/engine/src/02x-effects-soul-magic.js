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
FX_ACTIONS.SOUL_TO_DECKBOTTOM = { chk: a => Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)) && hasMatch(a.match),
  txt: () => 'return a matching card from your Soul State to the bottom of your Deck',
  cands: (c, a) => c.p.soulState.filter(x => fxMatch(CARDS[x.id], a.match)),
  can: (c, a) => FX_ACTIONS.SOUL_TO_DECKBOTTOM.cands(c, a).length > 0,
  run: async (c, a) => {
    const t = await chooseCard(c, FX_ACTIONS.SOUL_TO_DECKBOTTOM.cands(c, a), `✨ ${CARDS[c.src.id].name}`, 'Choose a card in Soul State to return to the bottom of your Deck.', false);
    if (!t) { c.ctx.did = false; return; }
    removeFrom(c.p.soulState, t); t.inSoulState = false; c.p.deck.push(t); c.ctx.did = true; log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns from Soul State to the bottom of the Deck.`);
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
