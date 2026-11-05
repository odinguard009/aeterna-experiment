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
Object.assign(FX_ACTIONS, {
  /* v537 BOUNCE_DECKBOTTOM_PIERCE {pierceName}: "return an opposing Spirit/Nexus to the deckbottom; if you control any LV2 <name>, this effect can only be prevented by Heavy Armor/Ultra Heavy Armor" (BS73-X05). With the LV2 card on the Field a target is skipped only when it is immune AND has Heavy Armor / Ultra Heavy Armor (other immunity is ignored); otherwise a plain immunity check. The CPU returns the highest BP Spirit. */
  /* v542 SUMMON_TRASH_TOTAL {match, totalLe}: "summon any number of <match> Spirit cards from your Trash, up to a total of Cost N, without paying the cost" (BSC48-012). */
  SUMMON_TRASH_TOTAL: { chk: a => hasMatch(a.match) && Number.isInteger(a.totalLe) && a.totalLe >= 1 && a.totalLe <= 20 && Object.keys(a).every(k => ['do', 'if', 'match', 'totalLe'].includes(k)),
    txt: a => `summon any number of matching Spirit cards from your Trash, up to a total of Cost ${a.totalLe}, without paying the cost`,
    cands: (c, a, left) => c.p.trash.filter(h => { const k = CARDS[h.id]; return k.type === 'Spirit' && !k.token && fxMatch(k, a.match) && k.cost <= left && canPlaceBy(c.p, h, false); }),
    can: (c, a) => FX_ACTIONS.SUMMON_TRASH_TOTAL.cands(c, a, a.totalLe).length > 0,
    run: async (c, a) => {
      let left = a.totalLe; c.ctx.did = false;
      for (;;) {
        const L = FX_ACTIONS.SUMMON_TRASH_TOTAL.cands(c, a, left); if (!L.length) break;
        let t;
        if (c.p.cpu) t = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
        else {
          const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
          const id = await ask({ title: `✨ ${esc(_pn(c))}`, peek: true, wide: true, html: `Summon a card from the Trash (total cost left: ${left}).`, cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, cls: 'primary', value: i })).concat([{ label: 'Stop', cls: 'cancel', value: null }]) });
          if (!id) break; t = L.find(x => x.id === id) || L[0];
        }
        left -= CARDS[t.id].cost; await summonBy(c.p, t, false, {}); c.ctx.did = true;
      } } },
  /* v543 VOID_TO_NEXUS_TOTAL {n, match}: "+N cores in total of any of your <match> Nexuses" (cores from the Void, any split; BSC48-013). */
  VOID_TO_NEXUS_TOTAL: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 4 && hasMatch(a.match) && Object.keys(a).every(k => ['do', 'if', 'n', 'match'].includes(k)),
    txt: a => `put ${a.n} cores in total from the Void on your matching Nexuses`,
    cands: (c, a) => c.p.nexus.filter(x => fxMatch(CARDS[x.id], a.match, x)),
    can: (c, a) => c.p.void > 0 && FX_ACTIONS.VOID_TO_NEXUS_TOTAL.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.VOID_TO_NEXUS_TOTAL.cands(c, a); c.ctx.did = false; if (!L.length) return;
      for (let j = 0; j < a.n && c.p.void > 0; j++) {
        const t = L.length === 1 ? L[0] : c.p.cpu ? L.slice().sort((x, y) => x.cores - y.cores)[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap a Nexus that receives a core from the Void (${j + 1}/${a.n}).`);
        if (!t || !takeFromVoid(c.p, 1)) break; t.cores += 1; c.ctx.did = true; log(`${_nm(c)}: a core moves from the Void to ${CARDS[t.id].name}.`);
      } io.view({ type: 'board' }); } },
  /* v541 OPP_RESERVE_CORES_TO_TRASH {n}: "send a core from the opposing Reserve to the Trash" (BSC48-010; OPP_RESERVE_TO_TRASH sends all). */
  OPP_RESERVE_CORES_TO_TRASH: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Object.keys(a).every(k => ['do', 'if', 'n'].includes(k)),
    txt: a => `send ${a.n} core${a.n === 1 ? '' : 's'} from the opposing Reserve to the Trash`,
    can: c => c.opp.reserve.n > 0,
    run: async (c, a) => { const m = Math.min(a.n, c.opp.reserve.n); c.ctx.did = m > 0; if (!m) return; coreEvN(c.opp, 'reserve', 'trash', m, false); c.opp.reserve.n -= m; c.opp.trashCores.n += m; log(`${_nm(c)}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} Reserve go to the Trash.`); io.view({ type: 'board' }); } },
  /* v541 DESTROY_ANY_SYMBOLS {symbolsLe}: "destroy an opposing Spirit/Nexus with N symbol(s) or less" (BSC48-009). */
  DESTROY_ANY_SYMBOLS: { chk: a => Number.isInteger(a.symbolsLe) && a.symbolsLe >= 0 && a.symbolsLe <= 5 && Object.keys(a).every(k => ['do', 'if', 'symbolsLe'].includes(k)),
    txt: a => `destroy an opposing Spirit/Nexus with ${a.symbolsLe} symbol(s) or less`,
    cands: (c, a) => c.opp.spirits.concat(c.opp.nexus).filter(t => CARDS[t.id].symbols <= a.symbolsLe && (c.ctx.noPrevent || !fxImmune(c.opp, t, { p: c.p, src: c.src }))),
    can: (c, a) => FX_ACTIONS.DESTROY_ANY_SYMBOLS.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DESTROY_ANY_SYMBOLS.cands(c, a); c.ctx.did = false; if (!L.length) return;
      const t = c.p.cpu ? L.slice().sort((x, y) => (c.opp.spirits.includes(y) ? bpOf(y) : 0) - (c.opp.spirits.includes(x) ? bpOf(x) : 0))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit/Nexus to destroy (glowing).`);
      if (!t) return;
      if (c.opp.spirits.includes(t)) removeSpirit(c.opp, t, 'destroyed', true); else removeNexus(c.opp, t, 'destroyed');
      checkDepletion(c.opp); c.ctx.did = true; log(`${_nm(c)}: ${CARDS[t.id].name} is destroyed.`); io.view({ type: 'board' }); } },
  /* v541 DISCARD_DRAW_FAMILY {family, draw}: "discard a card from your Hand. (Once per Turn: Same Name) When this effect discards any <family> card, you can draw N cards" (BSC48-011). */
  DISCARD_DRAW_FAMILY: { chk: a => Array.isArray(a.family) && a.family.length >= 1 && a.family.length <= 3 && a.family.every(f => typeof f === 'string' && f.length > 0) && Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 3 && Object.keys(a).every(k => ['do', 'if', 'family', 'draw'].includes(k)),
    txt: a => `discard a card from your Hand; once per turn, if it is a ${a.family.join('/')} family card, draw ${a.draw}`,
    can: c => c.p.hand.some(h => h !== c.src),
    run: async (c, a) => {
      const L = c.p.hand.filter(h => h !== c.src); c.ctx.did = false; if (!L.length) return;
      const pref = L.filter(h => !(CARDS[h.id].families || []).some(f => a.family.includes(f)));
      const d = c.p.cpu ? (pref[0] || L[0]) : await chooseCard(c, L, `✨ ${_pn(c)}`, 'Choose a card from your Hand to discard.', false);
      if (!d) return;
      removeFrom(c.p.hand, d); c.p.trash.push(d); c.ctx.did = true; log(`${_pn(c)}: ${who(c.p)} ${c.p.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      await sentToTrashFx(c, [d], 'hand');
      const k = 'ddf:' + CARDS[c.src.id].name; c.p.onceUsed = c.p.onceUsed || {};
      if ((CARDS[d.id].families || []).some(f => a.family.includes(f)) && c.p.onceUsed[k] !== G.turnNo) {
        const go = c.p.cpu || await ask({ title: `✨ ${esc(_pn(c))}`, html: `Draw ${a.draw} card${a.draw === 1 ? '' : 's'}?`, buttons: [{ label: 'Draw', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] });
        if (go) { c.p.onceUsed[k] = G.turnNo; const n = draw(c.p, a.draw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${n} card${n === 1 ? '' : 's'}.`); handUp(c.p, n); }
      }
      io.view({ type: 'board' }); } },
  /* v539 DESTROY_PIERCE_ARMOR {costLe}: "destroy an opposing Cost N or less Spirit. This effect can only be prevented by 'Armor'-named effects" (BS74-059). A target is skipped only when it is immune AND has an Armor-named keyword; any other immunity is pierced. */
  DESTROY_PIERCE_ARMOR: { chk: a => Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30 && Object.keys(a).every(k => ['do', 'if', 'costLe'].includes(k)),
    txt: a => `destroy an opposing Cost ${a.costLe} or less Spirit; only Armor-named effects can prevent it`,
    cands: (c, a) => c.opp.spirits.filter(t => CARDS[t.id].cost <= a.costLe && !(fxImmune(c.opp, t, { p: c.p, src: c.src }) && ['Armor', 'Heavy Armor', 'Ultra Heavy Armor'].some(k => cardHasKeyword(CARDS[t.id], k)))),
    can: (c, a) => FX_ACTIONS.DESTROY_PIERCE_ARMOR.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DESTROY_PIERCE_ARMOR.cands(c, a); c.ctx.did = false; if (!L.length) return;
      const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing Spirit to destroy (glowing).`);
      if (!t) return;
      removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); c.ctx.did = true; log(`${_nm(c)}: ${CARDS[t.id].name} is destroyed.`); io.view({ type: 'board' }); } },
  BOUNCE_DECKBOTTOM_PIERCE: { chk: a => typeof a.pierceName === 'string' && !!a.pierceName && Object.keys(a).every(k => ['do', 'if', 'pierceName'].includes(k)),
    txt: a => `return an opposing Spirit/Nexus to the deckbottom; with an LV2 "${a.pierceName}" it can only be prevented by Heavy Armor/Ultra Heavy Armor`,
    cands: (c, a) => { const pierce = c.p.spirits.some(s => lvNo(s) === 2 && CARDS[s.id].name.includes(a.pierceName));
      return c.opp.spirits.concat(c.opp.nexus).filter(t => !flagActive(c.opp, 'NO_RETURN', t) && !(fxImmune(c.opp, t, { p: c.p, src: c.src }) && (!pierce || cardHasKeyword(CARDS[t.id], 'Heavy Armor') || cardHasKeyword(CARDS[t.id], 'Ultra Heavy Armor')))); },
    can: (c, a) => FX_ACTIONS.BOUNCE_DECKBOTTOM_PIERCE.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.BOUNCE_DECKBOTTOM_PIERCE.cands(c, a); c.ctx.did = false; if (!L.length) return;
      const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap the opposing card to return to the deckbottom (glowing).`);
      if (!t) return;
      bounceCard(c.opp, t, 'deckBottom'); checkDepletion(c.opp); c.ctx.did = true; log(`${_nm(c)}: ${CARDS[t.id].name} returns to the deckbottom.`); io.view({ type: 'board' }); } } });
