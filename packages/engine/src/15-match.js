/* ---------------------------------------------------------------------
   MATCH START / END
   --------------------------------------------------------------------- */
/** v0.105.0 (M6 server prep): drops the running match - pending waits, port decisions and seat loops throw ABORT (the
 *  replay drop and the web page's leave do the same) - so a wrapper that shuts down can stop the engine for good. */
function closeMatch() {
  if (!G) return;
  SESSION++;
  io.view({ type: 'reset' });
  G = null;
}

async function startNewGame(opts) {
  opts = opts || {};
  SESSION++; io.view({ type: 'reset' });
  const seed = opts.seed != null ? ((opts.seed >>> 0) || 1) : newSeed();
  seedRng(seed); UID = 0;
  const lvl = SIM && !opts.lvl ? 'normal' : (['easy', 'normal', 'hard'].includes(opts.lvl) ? opts.lvl : ['easy', 'normal', 'hard'].includes(SETTINGS.cpuLevel) ? SETTINGS.cpuLevel : 'normal');   // v0.137.0: CPU strength
  const firstOpt = ['me', 'cpu'].includes(opts.first) ? opts.first : (SIM || opts.first === 'coin' || opts.deckA ? 'coin' : (['me', 'cpu'].includes(SETTINGS.firstTurn) ? SETTINGS.firstTurn : 'coin'));   // v0.137.0: First turn (play setup)
  const deckA = opts.deckA || (SIM ? PRESET_DECK : PLAYER_DECK);
  const v = validateDeck(deckA);
  if (!v.ok && !SIM && !opts.deckA) { await info(`Your deck is not legal in ${fmtName(FORMAT)}`, esc(errSummary(v)) + (v.errors.length > 3 ? '<br>Open the Deck Builder to see all issues.' : '')); io.view({ type: 'screen', id: 'view-deckbuilder' }); return; }
  const my = SESSION;
  const deckB = opts.deckB || (SIM ? (SIM_DECK_B || PRESET_DECK) : cpuDeckFor(FORMAT));
  G = newGame(deckA, deckB, FORMAT); G.lvl = lvl;
  const prof = CPU_PROFILES[opts.prof] ? opts.prof : (!SIM && opts.prof !== null && SETTINGS.cpuRandom ? CPU_PROFILE_NAMES[seed % CPU_PROFILE_NAMES.length] : null);   // v0.137.0: CPU Style "Random" = one fixed style per match, from the seed
  if (prof) G.p.opponent.cpuProfile = prof;
  // Key Spirit (Aeterna house rule, v0.103.0): a recorded key wins (replay/port); else the deck's marked key — the CPU seat's key is already resolved by cpuDeckFor/setSimDeckB
  const keyA = opts.keyA != null ? keyOfDeck(deckA, opts.keyA) : (!SIM && !opts.deckA ? keyOfDeck(PLAYER_DECK, SLOTS[ACTIVE_SLOT].key) : null);
  const keyB = opts.keyB != null ? keyOfDeck(deckB, opts.keyB) : keyOfDeck(deckB, SIM ? SIM_DECK_B_KEY : CPU_KEY);
  G.p.player.keySpirit = keyA || null; G.p.opponent.keySpirit = keyB || null;
  const W = !SIM && !!opts.watch;   // U3 "Watch CPU vs CPU": the CPU plays your deck too, at the chosen speed, no history entry
  if (W) { G.watch = true; G.p.player.cpu = true; G.p.player.name = 'Your deck'; }
  G.rec = { v: 1, build: VERSION, seed, format: FORMAT, sim: SIM, deckA: Object.assign({}, deckA), deckB: Object.assign({}, deckB), inputs: [], lvl, first: firstOpt, prof, keyA: keyA || null, keyB: keyB || null, keyW: KEY_WEIGHT };
  G.prec = newPortRecord(seed, deckA, deckB, W, keyA || null, keyB || null);         // v0.85.0 (F4 = M4): the host-independent input record, 15b-replay.js
  if (!SIM && !W && !opts.noHistory) G.meta = { fmt: FORMAT, you: opts.deckA ? 'Replay' : SLOTS[ACTIVE_SLOT].name, cpu: opts.deckB ? 'Replay' : CPU_DECK_NAME, done: false };
  io.view({ type: 'screen', id: 'view-playmat' });
  io.view({ type: 'board' });
  try {
    let first;
    if (SIM || W) { first = rng() < 0.5 ? 'player' : 'opponent'; if (W) log('Watching: the CPU plays both sides.'); log(`${G.p[first].name} goes first.`); }
    else if (firstOpt !== 'coin') { first = firstOpt === 'me' ? 'player' : 'opponent'; log(first === 'player' ? 'You go first (set in the match setup).' : 'The CPU goes first (set in the match setup).'); }
    else {
      const call = await ask({ title: '🪙 Coin Toss', html: 'Pick a side. The winner chooses who goes first.', buttons: [{ label: 'HEADS', cls: 'primary', value: 'h' }, { label: 'TAILS', cls: 'primary', value: 't' }] });
      const heads = rng() < 0.5, won = (call === 'h') === heads;
      if (won) {
        first = await ask({ title: `Coin: ${heads ? 'HEADS' : 'TAILS'} — you win!`, html: 'Do you want to go first or second?', buttons: [{ label: 'FIRST', cls: 'primary', value: 'player' }, { label: 'SECOND', cls: 'primary', value: 'opponent' }] });
        log(first === 'player' ? 'You won the coin toss and go first.' : 'You won the coin toss and go second.');
      } else { first = 'opponent'; log(`Coin: ${heads ? 'HEADS' : 'TAILS'}. CPU won the toss and goes first.`); }
      io.view({ type: 'board' });
    }
    // setup: a Contract card may be added to the starting Hand (default: add it; the CPU always does)
    if (!SIM && !W && G.p.player.hand.some(h => CARDS[h.id].contract)) {
      const add = await ask({ title: '📜 Contract card', html: 'Your Deck has a Contract card. Add it to your starting Hand?', buttons: [{ label: 'Add to Hand', cls: 'primary', value: true }, { label: 'Keep in Deck', cls: 'cancel', value: false }] });
      if (!add) { contractToDeck(G.p.player); log('You kept the Contract card in the Deck.'); }
    }
    // starting hand: each player may redraw once, in turn order (JP Standard Rule Manual 1.1 setup step 7, kb SJP:setup): the first player decides first
    G.setupRedraw = [];
    for (const seat of first === 'player' ? ['player', 'opponent'] : ['opponent', 'player']) {
      if (seat === 'opponent') { if (cpuWantsRedraw(G.p.opponent.hand)) { redrawHand(G.p.opponent); log('CPU redrew its starting hand.'); } }
      else if (W) { if (cpuWantsRedraw(G.p.player.hand)) { redrawHand(G.p.player); log('Your deck (CPU) redrew its starting hand.'); } }
      else if (!SIM) {
        const r = await ask({ title: '🎴 Starting Hand', cards: cardIds(G.p.player.hand), cardsStyle: 'mull', html: `<div style="margin-top:8px">Redraw your 4 cards? You can only do this once.</div>${G.p.player.hand.some(h => CARDS[h.id].contract) ? '<div class="mull-note">📜 A redraw returns your Contract card to the Deck too, and it cannot be added to your Hand again this game (official rules).</div>' : ''}`, wide: true, peek: true, buttons: [{ label: 'Redraw all cards', cls: 'primary', value: true }, { label: 'Keep hand', cls: 'cancel', value: false }] });
        if (r) { redrawHand(G.p.player); log('You redrew your starting hand.'); }
      }
      G.setupRedraw.push(seat);
    }
    if (SESSION !== my) return;
    G.next = first;
    io.view({ type: 'board' });
    matchLoop();
  } catch (e) { if (e !== ABORT) throw e; }
}
const matchSummary = () => ({ winner: G.winner, turn: G.turnNo, life: [G.p.player.life, G.p.opponent.life], log: G.hn || 0, hash: (G.hh >>> 0).toString(16) });   // v0.26 final result + hash of the whole log (moved from 16-events.js in v0.82.0)
