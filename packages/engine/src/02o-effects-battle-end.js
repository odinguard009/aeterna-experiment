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
