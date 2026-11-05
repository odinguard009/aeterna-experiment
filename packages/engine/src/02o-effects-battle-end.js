/* v0.78 end of battle and ally battle results (pack bundle 5, docs/mechanics/end-of-battle.md):
   END_BATTLE {then: [actions]}  "At the end of (the) battle, <actions>." inside a (When Attacks / Blocks / Battles) effect:
                                  the actions wait until this battle ends (also when it ends early) and resolve only while
                                  the source is still on its owner's Field (CR Categories of Effects "At the End of...").
   CURSE                          keyword Curse: at the end of the battle destroy the Spirit that blocked, if the battle
                                  reached the BP comparison and that Spirit is still on the Field (effect destruction, so
                                  "unaffected" applies). Resolves even when the Curse Spirit itself was destroyed.
   BRILLIANCE                     keyword Brilliance: at the end of the battle, while the source is on the Field, return
                                  every Magic card its owner used during this battle that is now in the Trash to the Hand.
   DESTROY_SELF                   "Destroy this Spirit." (own effect; the source must be on the Field).
   REFRESH to: 'subject'          "refresh that Spirit / the blocking Spirit you control" after ALLY_BATTLE_WIN.
   Trigger ALLY_BATTLE_WIN ("When only the opposing Spirit is destroyed by comparing BP with your X Spirit") is fired in
   08-battle.js next to BATTLE_WIN (ctx.subject = your Spirit that won, ctx.attacking = it was the attacker). */
(() => {
  const queue = (c, o) => { if (!G || !G.eob) { c.ctx.did = false; return; } G.eob.push(Object.assign({ p: c.p, opp: c.opp, src: c.src, ctx: Object.assign({}, c.ctx) }, o)); };
  const inBattle = () => !!(G && G.attacker && G.eob);
  FX_ACTIONS.END_BATTLE = {
    chk: a => Array.isArray(a.then) && a.then.length >= 1 && a.then.length <= 3 && a.then.every(x => x && x.do !== 'END_BATTLE' && x.do !== 'CURSE' && x.do !== 'BRILLIANCE') && !parseActionList(a.then).error,
    txt: a => 'at the end of this battle, ' + a.then.map(x => FX_ACTIONS[x.do].txt(x)).join(', then '),
    can: () => inBattle(),
    run: async (c, a) => { queue(c, { then: a.then }); if (c.ctx.did !== false) log(`${CARDS[c.src.id].name}: an effect waits for the end of this battle.`); }
  };
  // v0.208 END_BATTLE_NOW: "Immediately end the current battle." / "end the battle without comparing BP": no comparison and no Life damage (08-battle checks G.battleCut after each Flash window)
  FX_ACTIONS.END_BATTLE_NOW = { chk: () => true, txt: () => 'immediately end the current battle', can: () => !!(G && G.attacker),
    run: async c => { G.battleCut = G.battleNo; log(`${CARDS[c.src.id].name}: the battle ends immediately.`); } };
  FX_ACTIONS.CURSE = { chk: () => true, txt: () => 'Curse: at the end of this battle, destroy the opposing Spirit that blocked', can: () => inBattle(),
    run: async c => queue(c, { curse: true }) };
  FX_ACTIONS.BRILLIANCE = { chk: () => true, txt: () => 'Brilliance: at the end of this battle, return every Magic card you used during this battle to your Hand', can: () => inBattle(),
    run: async c => queue(c, { brilliance: true }) };
  /* v0.118.0 Rumble {{Rumble|X}} (During Attack): at the end of the battle, discard X cards from the opposing decktop,
     minus the cost of the Spirit card that blocked, when that blocker is now in the opposing Trash (FAQ 31592-31594, 31621:
     only a Spirit blocker counts; a returned / bounced blocker does not reduce; the attacker must still be on the Field). */
  FX_ACTIONS.RUMBLE = { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 7,
    txt: a => `Rumble ${a.n}: at the end of this battle, discard ${a.n} cards from the opposing decktop, minus the cost of the blocking Spirit in their Trash`,
    can: () => inBattle(),
    run: async (c, a) => queue(c, { rumble: a.n + rumblePlusOf(c.p) }) };      // v210 RUMBLE_PLUS
  FX_ACTIONS.DESTROY_SELF = { chk: () => true, txt: () => 'destroy this Spirit', can: c => c.p.spirits.includes(c.src),
    run: async c => { if (!c.p.spirits.includes(c.src)) { c.ctx.did = false; return; } log(`${CARDS[c.src.id].name} is destroyed by its own effect.`); removeSpirit(c.p, c.src, 'destroyed', false); checkDepletion(c.p); } };
  const R = FX_ACTIONS.REFRESH, rChk = R.chk, rCan = R.can, rRun = R.run, rTxt = R.txt;
  const subj = c => (c.ctx && c.ctx.subject && c.p.spirits.includes(c.ctx.subject)) ? c.ctx.subject : null;
  R.chk = a => a.to == null ? rChk() : a.to === 'subject';
  R.txt = a => a.to === 'subject' ? 'refresh that Spirit' : rTxt();
  R.can = (c, a) => a.to === 'subject' ? !!(subj(c) && subj(c).exhausted) : rCan(c);
  R.run = async (c, a) => {
    if (a.to !== 'subject') return rRun(c);
    const t = subj(c); if (!t || !t.exhausted) { c.ctx.did = false; return; }
    refreshOne(t); log(`${CARDS[t.id].name} is refreshed.`);
  };
})();
async function endOfBattle() {
  const L = G.eob || []; G.eob = [];
  for (const q of L) {
    if (!G || G.over) return;
    const name = CARDS[q.src.id].name;
    if (q.curse) {
      const b = G.blocker;
      if (!G.battleResolved || !b || !q.opp.spirits.includes(b)) continue;
      if (fxImmune(q.opp, b, { p: q.p, src: q.src })) { log(`${name}: Curse does not affect ${CARDS[b.id].name}.`); continue; }
      log(`${name}: Curse destroys ${CARDS[b.id].name}.`);
      const by = G.fxBy; G.fxBy = q.p.key;
      try { removeSpirit(q.opp, b, 'destroyed', true); } finally { G.fxBy = by; }
      checkDepletion(q.opp); io.view({ type: 'board' }); continue;
    }
    if (CARDS[q.src.id].type !== 'Magic' && !fieldList(q.p).includes(q.src)) continue;      // the source left the Field: the end-of-battle effect does not resolve (v0.89: a Magic card's delayed effect resolves from the Trash)
    if (q.brilliance) {
      const back = (G.battleMagic || []).filter(m => m.key === q.p.key && q.p.trash.includes(m.inst)).map(m => m.inst);
      for (const m of back) { removeFrom(q.p.trash, m); q.p.hand.push(m); }
      if (back.length) { log(`${name}: Brilliance returns ${back.map(m => CARDS[m.id].name).join(', ')} to the Hand.`); handUp(q.p, back.length); }
      continue;
    }
    if (q.rumble) {
      let n = q.rumble;
      const b = G.blocker;
      if (b && q.opp.trash.includes(b) && CARDS[b.id].type === 'Spirit') n -= CARDS[b.id].cost;   // FAQ 31592/31621: only a Spirit blocker in the Trash reduces the mill
      if (n <= 0) { log(`${name}: Rumble discards nothing (the blocker's cost covers it).`); continue; }
      const top = q.opp.deck.splice(0, Math.min(n, q.opp.deck.length));
      for (const x of top) q.opp.trash.push(x);
      log(`${name}: Rumble discards ${top.length} card${top.length === 1 ? '' : 's'} from ${poss(q.opp)} Deck.`);
      io.view({ type: 'board' });
      await fireFx(q.p, 'RUMBLE_DISCARD', q.src, { subject: q.src, exCount: top.filter(x => CARDS[x.id].exSymbols > 0).length });      // v0.185 "When cards are discarded by your Rumble"
      continue;
    }
    await asResolving(() => runActions({ p: q.p, opp: q.opp, src: q.src, ctx: q.ctx }, { actions: q.then }, 'END_BATTLE'));
    io.view({ type: 'board' });
  }
  await flushDerived();
  await flushBursts();
}
Object.assign(FX_ACTIONS, {
  /* v533 "by returning one of your X Spirits to the Hand, summon this card (from the Hand/Trash) without paying the cost" (BS34-XX02). The CPU returns the attacker when it matches, else the first match. */
  SUMMON_SELF_BY_RETURN: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
    txt: () => 'by returning one of your matching Spirits to the Hand, summon this card without paying the cost',
    cands: (c, a) => c.p.spirits.filter(s => s !== c.src && fxMatch(CARDS[s.id], a.match, s)),
    can: (c, a) => (c.p.hand.includes(c.src) || c.p.trash.includes(c.src)) && FX_ACTIONS.SUMMON_SELF_BY_RETURN.cands(c, a).length > 0,
    run: async (c, a) => {
      if (!FX_ACTIONS.SUMMON_SELF_BY_RETURN.can(c, a)) { c.ctx.did = false; return; }
      const L = FX_ACTIONS.SUMMON_SELF_BY_RETURN.cands(c, a), atk = c.ctx && c.ctx.attacker;
      const t = c.p.cpu ? (L.includes(atk) ? atk : L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to return to the Hand (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      bounceCard(c.p, t, 'hand'); checkDepletion(c.p); handUp(c.p, 1);
      log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} returns to the Hand.`);
      if (!canPlaceFree(c.p, c.src)) { c.ctx.did = false; return; }
      await summonFree(c.p, c.src); c.ctx.did = fieldList(c.p).includes(c.src);
      io.view({ type: 'board' });
    } } });
Object.assign(FX_ACTIONS, {
  /* v533 "destroy opposing Spirits/Ultimates with the same colors as your symbols, one of each color" (Six Heaven Rush 4, BS34-XX02): for each color you have a symbol of, destroy one opposing Spirit/Ultimate of that color (one card is never counted twice; the CPU picks the cheapest). */
  DESTROY_PER_SYMBOL_COLOR: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => 'destroy opposing Spirits/Ultimates with the same colors as your symbols, one of each color',
    can: c => COLORS.some(k => (symbolsOn(c.p)[k] || 0) >= 1 && c.opp.spirits.some(s => fxMatch(CARDS[s.id], { color: [k] }, s))),
    run: async c => {
      const gone = [];
      for (const k of COLORS.filter(k => (symbolsOn(c.p)[k] || 0) >= 1)) {
        const cands = c.opp.spirits.filter(s => !gone.includes(s) && !fxImmune(c.opp, s) && fxMatch(CARDS[s.id], { color: [k] }, s));
        if (!cands.length) continue;
        const t = c.p.cpu ? cands.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await fxPickTarget(c, cands, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap an opposing ${k} Spirit/Ultimate to destroy (glowing).`);
        if (!t) continue;
        gone.push(t); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} is destroyed (${k}).`);
        removeSpirit(c.opp, t, 'destroyed', true);
      }
      checkDepletion(c.opp); c.ctx.did = gone.length > 0;
      io.view({ type: 'board' });
    } } });
Object.assign(FX_ACTIONS, {
  /* v535 "swap this card from the Hand with a <match> Spirit you control in the same condition" (BS35-XX02): this card takes the Spirit's place with its cores, Soul Core, exhausted/heavy state and battle role; the Spirit returns to the Hand. */
  SWAP_HAND_WITH_FIELD: { chk: a => hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'match'].includes(k)),
    txt: () => 'swap this card from the Hand with a matching Spirit you control in the same condition',
    cands: (c, a) => c.p.spirits.filter(s => s !== c.src && !s.under.length && fxMatch(CARDS[s.id], a.match, s)),
    can: (c, a) => (c.p.hand.includes(c.src) || c.p.limbo === c.src) && CARDS[c.src.id].type === 'Spirit' && FX_ACTIONS.SWAP_HAND_WITH_FIELD.cands(c, a).length > 0,
    run: async (c, a) => {
      if (!FX_ACTIONS.SWAP_HAND_WITH_FIELD.can(c, a)) { c.ctx.did = false; return; }
      const L = FX_ACTIONS.SWAP_HAND_WITH_FIELD.cands(c, a);
      const t = c.p.cpu ? L.slice().sort((x, y) => y.cores - x.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the Spirit to swap with (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      const n = c.src, i = c.p.spirits.indexOf(t);
      removeFrom(c.p.hand, n); if (c.p.limbo === n) c.p.limbo = null; c.p.spirits[i] = n;
      n.cores = t.cores; n.soul = t.soul; n.exhausted = t.exhausted; n.heavy = t.heavy; n.viaFx = true;
      t.cores = 0; t.soul = false; t.exhausted = false; t.heavy = false; t.noAB = false; t.bpMod = 0; t.symBattle = 0; t.viaFC = false; t.viaHS = false; t.legacyN = 0;
      c.p.hand.push(t);
      if (G.attacker === t) G.attacker = n; if (G.blocker === t) G.blocker = n;
      log(`${CARDS[n.id].name} swaps places with ${CARDS[t.id].name} (the cores stay).`);
      checkDepletion(c.p); c.ctx.did = true;
      io.view({ type: 'board' });
    } } });
/* v535 SYM_ALL_COLORS (Six Heaven Rush 6, BS35-XX02): the attacker's symbols are fixed as one of each of the six colours (six symbols) */
const symAllColorsOn = i => !!G && i.symLoseTurn !== G.turnNo && flagActive(G.p.player.spirits.includes(i) ? G.p.player : G.p.opponent, 'SYM_ALL_COLORS', i);
/* v535 STATIC SOUL_TREATED {to:'own', match, if}: "every <match> Spirit you control is treated as having the Soul Core on it" (BS46-10THX02); read by the selfSoul / srcSoul conditions only */
const soulTreated = i => !!G && !!i && [G.p.player, G.p.opponent].some(o => o.spirits.includes(i) && flagActive(o, 'SOUL_TREATED', i));

Object.assign(FX_ACTIONS, {
  /* v537 SUMMON_SELF_PAY {pay, thenCore}: "you can summon this card from the Hand by paying N cost" (BS73-AX03, zone hand). thenCore: "when you've done so, you can put a core from the Void to this Spirit, or send the Soul Core from your Trash to this Spirit" (the Soul Core first when it is in the Trash). */
  SUMMON_SELF_PAY: { chk: a => Number.isInteger(a.pay) && a.pay >= 0 && a.pay <= 5 && (a.thenCore == null || a.thenCore === true) && Object.keys(a).every(k => ['do', 'if', 'pay', 'thenCore'].includes(k)),
    txt: a => `pay ${a.pay} cost to summon this card from the Hand${a.thenCore ? '; then put a core from the Void, or the Soul Core from the Trash, onto it' : ''}`,
    can: (c, a) => c.p.hand.includes(c.src) && coresAvailable(c.p) >= a.pay && canPlaceFree(c.p, c.src),
    run: async (c, a) => {
      c.ctx.did = false; if (!FX_ACTIONS.SUMMON_SELF_PAY.can(c, a)) return;
      if (a.pay && !(await payInvokeCost(c.p, c.src, { pay: a.pay }))) return;
      if (!c.p.hand.includes(c.src) || !canPlaceFree(c.p, c.src)) return;
      if (!(await summonFree(c.p, c.src))) return;
      c.ctx.did = true; if (!a.thenCore || !fieldList(c.p).includes(c.src)) return;
      if (c.p.trashCores.soul && c.p.trashCores.n > 0 && !c.src.soul) { c.p.trashCores.soul = false; c.p.trashCores.n--; c.src.cores += 1; c.src.soul = true; log(`${CARDS[c.src.id].name} receives the Soul Core from the Trash.`); }
      else if (c.p.void > 0) { c.p.void--; c.src.cores++; log(`${CARDS[c.src.id].name}: 1 core goes from the Void onto it.`); }
      io.view({ type: 'board' }); } },
  /* v537 OPP_BOUNCE_OR_NOBLOCK {}: "unless the opponent returns a Spirit they control to the deckbottom, they can't block" (BS73-AX03, ALLY_ATTACKS). The attacking card is marked unblockable for the turn (approximation of "this attack"); the CPU never returns a Spirit, a player may. */
  OPP_BOUNCE_OR_NOBLOCK: { chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
    txt: () => "unless the opponent returns a Spirit they control to the deckbottom, they can't block",
    can: c => !!(c.ctx && c.ctx.attacker),
    run: async c => {
      const att = c.ctx && c.ctx.attacker; c.ctx.did = false; if (!att) return;
      let pay = null;
      if (!c.opp.cpu && c.opp.spirits.length) {
        const v = await ask({ title: `✨ ${_nm(c)}`, html: "Return one of your Spirits to the deckbottom to keep the right to block?", buttons: [{ label: 'Return a Spirit', value: 'y' }, { label: "Can't block", value: 'n' }] });
        if (v === 'y') { const u = await ask({ title: `✨ ${_nm(c)}`, html: 'Choose a Spirit to return to the deckbottom.', buttons: c.opp.spirits.map(x => ({ label: CARDS[x.id].name, value: x.uid })) }); pay = c.opp.spirits.find(x => x.uid === u) || c.opp.spirits[0]; }
      }
      if (pay) { bounceCard(c.opp, pay, 'deckBottom'); checkDepletion(c.opp); log(`${poss(c.opp)} ${CARDS[pay.id].name} returns to the deckbottom.`); return; }
      att.noBlockTurn = G.turnNo; c.ctx.did = true; log(`${CARDS[att.id].name} can't be blocked.`); io.view({ type: 'board' }); } } });
