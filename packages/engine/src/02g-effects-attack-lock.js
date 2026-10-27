/* ---------------------------------------------------------------------
   v0.40 YELLOW (Contractor Indra / Thunderive): "can't attack/block" (permanent flag noAB), drawing from the bottom of the Deck, discarding the whole Hand,
   revealing and adding cards, Life <-> Spirit/Void core moves, Nexus cores to a Spirit, returning itself to the Hand.
   Rules: manual "Can't attack/block" effects only stop the declaration of an attack / a block; the Spirit still counts as a Spirit (stays on the Field). The flag lives on the
   Spirit instance and ends when it leaves the Field (all instance resets clear noAB). "During this game" effects are not removed at turn end.
   --------------------------------------------------------------------- */
Object.assign(FX_ACTIONS, {
  /* up to n opposing Spirits/Ultimates can't attack/block for the rest of the game (Indra Contract Skill, Nazuma, Vajrawurm) */
  CANT_ATTACK_BLOCK: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3,
    txt: a => `during this game, ${a.n === 1 ? 'an opposing Spirit/Ultimate' : a.n + ' opposing Spirits/Ultimates'} can't attack/block`,
    cands: c => c.opp.spirits.filter(t => !t.noAB && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.CANT_ATTACK_BLOCK.cands(c).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.CANT_ATTACK_BLOCK.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.n, `✨ <b>${esc(_pn(c))}</b><br>Tap the opposing Spirit that can't attack/block for the rest of the game (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { t.noAB = true; log(`${_pn(c)}: ${poss(c.opp)} ${CARDS[t.id].name} can't attack/block during this game.`); }
      io.view({ type: 'board' });
    } },
  /* draw n cards from the bottom of the Deck (Thunderive) */
  DRAW_BOTTOM: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `draw ${a.n} card${a.n === 1 ? '' : 's'} from the bottom of the Deck`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      let k = 0; for (; k < a.n && c.p.deck.length; k++) c.p.hand.push(c.p.deck.pop());
      if (!k) { c.ctx.did = false; return; }
      log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'} from the bottom of the Deck.`); handUp(c.p, k);
    } },
  /* discard the entire Hand (at least one card); cost of BY (Airavajdra) */
  DISCARD_ALL_HAND: { chk: () => true, txt: () => 'discard your entire Hand (at least one card)',
    can: c => c.p.hand.length > 0,
    run: async c => {
      if (!c.p.hand.length) { c.ctx.did = false; return; }
      const k = c.p.hand.length; for (const h of c.p.hand.splice(0)) c.p.trash.push(h);
      log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} the entire Hand (${k} card${k === 1 ? '' : 's'}).`); io.view({ type: 'board' });
    } },
  /* reveal n cards from the top of your Deck and add up to `add` matching cards to the Hand, discarding the rest (Manevajra: three cards, one "Contractor Indra" or "Thunderive" card;
     with moreIf true (eight counters or more) reveal +1 and add +1) */
  REVEAL_ADD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 6 && Number.isInteger(a.add) && a.add >= 1 && a.add <= 3 && hasMatch(a.match) && (a.moreIf == null || (typeof a.moreIf === 'object' && !parseCond(a.moreIf).error)),
    txt: a => `reveal ${a.n} cards from the top of your Deck, add ${a.add === 1 ? 'one matching card' : a.add + ' matching cards'} to the Hand, discard the rest${a.moreIf ? '; if the bonus condition holds reveal +1 and add +1 card' : ''}`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = _pn(c), more = !!a.moreIf && fxIf(c.p, c.opp, a.moreIf, c.ctx), n = a.n + (more ? 1 : 0), want = a.add + (more ? 1 : 0);
      const top = c.p.deck.splice(0, Math.min(n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      let got = 0;
      for (let j = 0; j < want; j++) {
        const L = c.p.revealed.filter(x => fxMatch(CARDS[x.id], a.match)); if (!L.length) break;
        const t = await chooseCard(c, L, `✨ ${nm}`, 'Choose a revealed card to add to your Hand.', true);
        if (!t) break; removeFrom(c.p.revealed, t); c.p.hand.push(t); got++; log(`${nm}: ${CARDS[t.id].name} is added to the Hand.`);
      }
      if (got) handUp(c.p, got);
      const rest = c.p.revealed.splice(0); for (const x of rest) c.p.trash.push(x);
      if (rest.length) log(`${nm}: ${rest.length} card${rest.length === 1 ? '' : 's'} discarded.`);
      c.ctx.did = got > 0;
    } },
  /* put cores from your Void on your Life (Naraka, Temple): only while your Life is at most lifeLe */
  VOID_TO_LIFE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.lifeLe == null || Number.isInteger(a.lifeLe)), txt: a => `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to your Life${a.lifeLe != null ? ' if your Life is ' + a.lifeLe + ' or less' : ''}`,
    can: (c, a) => c.p.void > 0 && (a.lifeLe == null || c.p.life <= a.lifeLe),
    run: async (c, a) => {
      if (a.lifeLe != null && c.p.life > a.lifeLe) { c.ctx.did = false; return; }
      const m = takeFromVoid(c.p, a.n); if (!m) { c.ctx.did = false; return; }
      c.p.life += m; log(`${_pn(c)}: ${m} core${m === 1 ? '' : 's'} move from the Void to ${who(c.p)}${c.p.cpu ? "'s" : 'r'} Life.`); io.view({ type: 'board' });
    } },
  /* send one of your Lives to this Spirit (cost of BY, Vajdra-of-Magan). Not a Life reduction by damage: no Burst. A Life of 1 can't be sent (that would end the game by an own effect). */
  LIFE_TO_SELF: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 2, txt: a => `send ${a.n} of your Life to this Spirit`,
    can: (c, a) => c.p.life > a.n && c.p.spirits.includes(c.src),
    run: async (c, a) => {
      if (c.p.life <= a.n || !c.p.spirits.includes(c.src)) { c.ctx.did = false; return; }
      lifeTake(c.p, a.n, c.src); log(`${_pn(c)}: ${a.n} Life of ${who(c.p)} moves to ${_pn(c)}.`); io.view({ type: 'board' });
    } },
  /* send n cores from your matching Nexus (name) to this Spirit (Vajrawurm Unleash cost) */
  NEXUS_CORES_TO_SELF: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && typeof a.name === 'string' && a.name.length > 0, txt: a => `send ${a.n} cores from your "${a.name}" Nexus to this Spirit`,
    cands: (c, a) => c.p.nexus.filter(x => x.cores >= a.n && CARDS[x.id].name.toLowerCase().includes(a.name.toLowerCase())),
    can: (c, a) => c.p.spirits.includes(c.src) && FX_ACTIONS.NEXUS_CORES_TO_SELF.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NEXUS_CORES_TO_SELF.cands(c, a); if (!L.length || !c.p.spirits.includes(c.src)) { c.ctx.did = false; return; }
      const t = L.length === 1 ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(_pn(c))}</b><br>Tap the Nexus that sends ${a.n} cores to this Spirit (glowing).`);
      coreEvN(c.p, t.uid, c.src.uid, a.n, false); t.cores -= a.n; c.src.cores += a.n; log(`${_pn(c)}: ${a.n} cores move from ${CARDS[t.id].name} to ${_pn(c)}.`); io.view({ type: 'board' });
    } },
  /* return this Spirit to the Hand (Togevajdra) */
  SELF_TO_HAND: { chk: () => true, txt: () => 'return this Spirit to your Hand',
    can: c => [c.p.spirits, c.p.trash, c.p.standby].some(z => z.includes(c.src)),
    run: async c => { const dead = !c.p.spirits.includes(c.src); if (dead ? !(removeFrom(c.p.trash, c.src) || removeFrom(c.p.standby, c.src)) : false) { c.ctx.did = false; return; }
      if (dead) { delete c.src.standbyTo; c.p.hand.push(c.src); } else { bounceCard(c.p, c.src, 'hand'); checkDepletion(c.p); } handUp(c.p, 1); io.view({ type: 'board' }); } },
});
