/* ---------------------------------------------------------------------
   v0.41 MAGIC effect types (Dana Draw, Whirling Tide, Magic Bullet, Hades Disaster, Thunder Counter, Lightning Tempest).
   A Magic card runs engine actions through MAGIC_FX.ACTIONS (00-config.js). New actions here:
   - DESTROY_EACH_COST: destroy one opposing Spirit of each listed cost (Magic Bullet). A Spirit's cost is its own card cost; Braves on it do not change it.
   - SYMBOLS_ZERO_OPP: every opposing Spirit's symbol count is fixed as zero for this turn (flag symZeroTurn, read by attackSymbols).
   v0.43 END_ATTACK_AFTER_BATTLE (Crimson Meteor Defense Flash): "when this battle ends, end the Attack Step". Sets G.endAttackAfter; doBattle (08-battle.js)
   turns it into G.attackEnded = turnNo when the battle ends, and the human/CPU attack loops stop. Blocked while the attacking side has an active
   STATIC NO_END_ATTACK flag for the attacker (Sunya Lv3, Crimson Crater Lv2); checked when the Magic is used and again when the battle ends.
   --------------------------------------------------------------------- */
function endAttackLocked(by) {                       // true = "by" can't end the current Attack Step via effects
  const att = G && G.attacker, owner = att && ownerOf(att);
  return !!owner && owner !== by && flagActive(owner, 'NO_END_ATTACK', att);
}
const _matchTxt = m => m && m.family ? `"${m.family.join('"/"')}" family ` : m && m.name ? `"${m.name.join('"/"')}" ` : '';
Object.assign(FX_ACTIONS, {
  /* v0.44 "during this turn, give one of your X Spirits/Ultimates an extra <colour> symbol" (Magma Call Flash). Counts for attacks and for reductions. */
  SYMBOL_PLUS_TURN: { chk: a => COLORS.includes(a.color) && (a.match == null || hasMatch(a.match)) && (a.self == null || (a.self === true && a.match == null)),
    txt: a => a.self ? `during this turn, this card gains an extra ${cap(a.color)} symbol` : `during this turn, give one of your ${_matchTxt(a.match)}Spirits/Ultimates an extra ${cap(a.color)} symbol`,
    cands: (c, a) => a.self ? [c.src].filter(s => c.p.nexus.includes(s) || c.p.spirits.includes(s)) : c.p.spirits.filter(s => !a.match || fxMatch(CARDS[s.id], a.match)),
    can: (c, a) => FX_ACTIONS.SYMBOL_PLUS_TURN.cands(c, a).length > 0,      // v201 also usable outside a battle (When Summoned targets a Spirit)
    run: async (c, a) => {
      const L = FX_ACTIONS.SYMBOL_PLUS_TURN.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = a.self ? L[0] : c.p.cpu ? (L.find(s => s === G.attacker) || L.slice().sort((x, y) => (x.exhausted - y.exhausted) || bpOf(y) - bpOf(x))[0]) : await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose your Spirit that gets an extra ${cap(a.color)} symbol this turn.`, false);
      if (!t.symTurn || t.symTurn.turn !== G.turnNo) t.symTurn = { turn: G.turnNo, cols: [] };
      t.symTurn.cols.push(a.color); log(`${_pn(c)}: ${CARDS[t.id].name} gets an extra ${cap(a.color)} symbol this turn.`); io.view({ type: 'board' });
    } },
  /* v160 "it has N symbols (during this turn / this battle); the number of symbols can't be increased except via this effect": sets the attack symbol count (attackSymbols), later +symbols do not add */
  SYMBOLS_SET: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && (a.match == null || hasMatch(a.match)) && (a.self == null || (a.self === true && a.match == null)) && (a.battle == null || a.battle === true),
    txt: a => `${a.self ? 'this Spirit' : 'one of your ' + _matchTxt(a.match) + 'Spirits'} has ${a.n} symbol${a.n === 1 ? '' : 's'} during this ${a.battle ? 'battle' : 'turn'} and cannot gain more`,
    cands: (c, a) => a.self ? [c.src].filter(s => c.p.spirits.includes(s)) : c.p.spirits.filter(s => !a.match || fxMatch(CARDS[s.id], a.match)),
    can: (c, a) => FX_ACTIONS.SYMBOLS_SET.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SYMBOLS_SET.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = a.self ? L[0] : c.p.cpu ? (L.find(s => s === G.attacker) || L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0]) : await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose your Spirit that has ${a.n} symbol${a.n === 1 ? '' : 's'} ${a.battle ? 'this battle' : 'this turn'}.`, false);
      t.symSet = { turn: G.turnNo, battle: a.battle ? G.battleNo : 0, n: a.n }; log(`${_pn(c)}: ${CARDS[t.id].name} has ${a.n} symbol${a.n === 1 ? '' : 's'} ${a.battle ? 'during this battle' : 'this turn'}.`); io.view({ type: 'board' });
    } },
  /* v162 "target one of your <match> Spirits. During this turn, it can't be destroyed by BP comparison": mark noBpTurn = turn number (read by the BP comparison in 08-battle) */
  NO_BP_DESTROY_TURN: { chk: a => a.match != null && hasMatch(a.match),
    txt: a => `one of your ${_matchTxt(a.match)}Spirits can't be destroyed by BP comparison during this turn`,
    cands: (c, a) => c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match, s)),
    can: (c, a) => FX_ACTIONS.NO_BP_DESTROY_TURN.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NO_BP_DESTROY_TURN.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? (L.find(s => s === G.attacker) || L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0]) : await chooseCard(c, L, `✨ ${_pn(c)}`, `Choose your Spirit that can't be destroyed by BP comparison this turn.`, false);
      t.noBpTurn = G.turnNo; log(`${_pn(c)}: ${CARDS[t.id].name} can't be destroyed by BP comparison this turn.`); io.view({ type: 'board' });
    } },
  /* v0.44 "Then, you can send your Soul Core to <Grandwalker Nexus>. When you've done so, activate this effect once and only once more" (then = the actions repeated) */
  SOUL_TO_NEXUS_THEN: { chk: a => hasMatch(a.match) && Array.isArray(a.then) && a.then.length >= 1 && a.then.length <= 3 && a.then.every(x => x && FX_ACTIONS[x.do] && x.do !== 'SOUL_TO_NEXUS_THEN' && FX_ACTIONS[x.do].chk(x)),
    txt: a => `then you can send your Soul Core to ${_matchTxt(a.match)}Grandwalker Nexus; if you do, ${a.then.map(x => FX_ACTIONS[x.do].txt(x)).join(', then ')} once more`,
    targets: (c, a) => c.p.nexus.filter(n => isGW(n) && !n.soul && fxMatch(CARDS[n.id], a.match)),
    can: (c, a) => !!soulSource(c.p) && FX_ACTIONS.SOUL_TO_NEXUS_THEN.targets(c, a).length > 0,
    run: async (c, a) => {
      const T = FX_ACTIONS.SOUL_TO_NEXUS_THEN.targets(c, a), again = a.then.some(x => !FX_ACTIONS[x.do].can || FX_ACTIONS[x.do].can(c, x));
      if (!soulSource(c.p) || !T.length) { c.ctx.did = false; return; }
      const go = c.p.cpu ? again : await ask({ title: `✨ ${esc(_pn(c))}`, html: `Send your Soul Core to ${esc(CARDS[T[0].id].name)} and activate the effect once more?`,
        buttons: [{ label: 'Send the Soul Core', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] });
      if (!go || !(await soulToNexus(c.p, T[0]))) { c.ctx.did = false; return; }
      for (const x of a.then) { if (G.over) return; if (!FX_ACTIONS[x.do].can || FX_ACTIONS[x.do].can(c, x)) await FX_ACTIONS[x.do].run(c, x); }
    } },
  END_ATTACK_AFTER_BATTLE: { chk: () => true, txt: () => 'when this battle ends, end the Attack Step',
    can: c => !!G.attacker && !endAttackLocked(c.p),
    run: async c => {
      if (!G.attacker || endAttackLocked(c.p)) { c.ctx.did = false; log(`${_pn(c)}: the Attack Step can't be ended via effects now.`); return; }
      G.endAttackAfter = c.p.key; log(`${_pn(c)}: when this battle ends, the Attack Step ends.`);
    } },
  DESTROY_EACH_COST: { chk: a => Array.isArray(a.costs) && a.costs.length >= 1 && a.costs.length <= 6 && a.costs.every(k => Number.isInteger(k) && k >= 0 && k <= 30)
      && (a.plus == null || (Number.isInteger(a.plus.counterGe) && a.plus.counterGe >= 0 && Number.isInteger(a.plus.costGe) && a.plus.costGe >= 0)),
    txt: a => `destroy one opposing Spirit/Ultimate of each cost ${a.costs.join(' and ')}${a.plus ? `; with ${a.plus.counterGe} counters or more, also one of cost ${a.plus.costGe} or more` : ''}`,
    classes: (c, a) => a.costs.map(k => ({ label: 'cost ' + k, ok: s => CARDS[s.id].cost === k }))
      .concat(a.plus && c.p.count >= a.plus.counterGe ? [{ label: `cost ${a.plus.costGe} or more`, ok: s => CARDS[s.id].cost >= a.plus.costGe }] : []),
    can: (c, a) => FX_ACTIONS.DESTROY_EACH_COST.classes(c, a).some(k => c.opp.spirits.some(s => !fxImmune(c.opp, s) && k.ok(s))),
    run: async (c, a) => {
      const picked = [];
      for (const k of FX_ACTIONS.DESTROY_EACH_COST.classes(c, a)) {
        const L = c.opp.spirits.filter(s => !picked.includes(s) && !fxImmune(c.opp, s) && k.ok(s)); if (!L.length) continue;
        const [t] = await pickOppSpirits(c, L, 1, `✨ <b>${esc(_pn(c))}</b><br>Tap the opposing Spirit with ${k.label} to destroy (glowing).`);
        if (t) picked.push(t);
      }
      c.ctx.destroyed = [];
      for (const t of picked) if (c.opp.spirits.includes(t)) { removeSpirit(c.opp, t, 'destroyed', true); c.ctx.destroyed.push(t); }
      checkDepletion(c.opp); c.ctx.did = c.ctx.destroyed.length > 0; io.view({ type: 'board' });
    } },
  SYMBOLS_ZERO_OPP: { chk: a => (a.color == null || COLORS.includes(a.color)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0 && a.bpLe <= 30000)) && (a.pick == null || (a.pick === true && a.color == null)) && Object.keys(a).every(k => ['do', 'if', 'color', 'bpLe', 'pick'].includes(k)),
    txt: a => a.color ? `during this turn, every opposing ${a.bpLe || 0} BP or less Spirit loses a ${cap(a.color)} symbol` : 'during this turn, the symbol of every opposing Spirit/Ultimate is fixed as zero',
    can: c => c.opp.spirits.length > 0,
    run: async (c, a) => {
      if (!c.opp.spirits.length) { c.ctx.did = false; return; }
      if (a.color || a.pick) {      // v220 "You can target a colour. During this step, every opposing N BP or less Spirit loses a symbol of that colour."
        let color = a.color;
        if (!color) { const cnt = {}; for (const t of c.opp.spirits) for (const k of symbolAttrs(CARDS[t.id])) cnt[k] = (cnt[k] || 0) + 1; color = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]?.[0] || COLORS[0]; }
        for (const t of c.opp.spirits) if (bpOf(t) <= (a.bpLe || 0) && !fxImmune(c.opp, t, c)) t.symZeroColor = { color, turn: G.turnNo };
        log(`${_pn(c)}: every opposing ${a.bpLe || 0} BP or less Spirit loses a ${cap(color)} symbol this step.`); io.view({ type: 'board' });
        return;
      }
      for (const t of c.opp.spirits) if (!fxImmune(c.opp, t, c)) t.symZeroTurn = G.turnNo;     // v0.58: unaffected Spirits keep their symbols
      c.opp.symZeroAll = G.turnNo; c.opp.symZeroBy = { p: c.p, src: c.src };                      // v0.47: also Spirits/Ultimates that come to the Field later this turn
      log(`${_pn(c)}: the symbols of ${poss(c.opp)} Spirits are zero until the end of the turn.`); io.view({ type: 'board' });
    } }
});

/* ---------------------------------------------------------------------
   v0.47 remaining Magic clauses (session F).
   - trashTrigger (card field): "when this card is sent to the Trash from the Deck/Hand by the effect of your X" -> add it to the Hand (add)
     and/or +N core to one of your Grandwalker Nexuses (gwCore, from the Void: "+1 core" puts a core from the Void). Called by the actions
     that send cards there: DECK_TO_TRASH_CORES, MILL, DISCARD_HAND. Whirling Tide, Thunder Counter, Hades Disaster.
   - magic.trashUse: use from the Trash (06-rules.js magicFxAt / castMagic; the card is banished afterwards).
   - AB_CORE_TAX_TURN (Plutonic Wall): this turn an opposing Spirit/Ultimate attacks/blocks only by sending a core from itself to the Trash.
     House reading (noted in the release notes): the core must be a spare one, a payment that would deplete the Spirit is not offered.
   - magic.oppAttackHand (Thunder Counter): at the start of the opposing Attack Step, send N cores from your X Grandwalker Nexus to the Void
     and pay the cost to use the card from the Hand (its Flash effect).
   - burst.also BRAVE_SUMMONED + burst.thenMain (Dana Draw): braveSummonedFx / maybeBurst / burstFlash(..., 'main').
   --------------------------------------------------------------------- */
async function gwCorePlus(c, n, nm) {
  const L = c.p.nexus.filter(isGW); if (!L.length || n <= 0) return 0;
  const t = L.length === 1 || c.p.cpu ? L[0] : await chooseCard(c, L, `✨ ${nm}`, `Choose the Grandwalker Nexus that gets +${n} core.`, false);
  const m = takeFromVoid(c.p, n); t.cores += m;
  log(`${nm}: +${m} core to ${CARDS[t.id].name}.`); io.view({ type: 'board' }); return m;
}
async function sentToTrashFx(c, cards, from) {
  if (!c || !c.src || !CARDS[c.src.id]) return;
  for (const x of cards) {
    const card = CARDS[x.id], tt = card.trashTrigger;
    if (!tt || !tt.from.includes(from) || !c.p.trash.includes(x) || !fxMatch(CARDS[c.src.id], tt.by) || G.over) continue;
    if (tt.add) {
      const yes = c.p.cpu ? true : await ask({ title: `✨ ${card.name}`, peek: true, wide: true, html: `It was sent to the Trash from your ${from === 'deck' ? 'Deck' : 'Hand'}. Add it to your Hand${tt.gwCore ? ' (then +' + tt.gwCore + ' core to a Grandwalker Nexus)' : ''}?`, cards: cardIds([x]),
        buttons: [{ label: 'Add to Hand', cls: 'primary', value: true }, { label: 'Keep in Trash', cls: 'cancel', value: false }] });
      if (!yes) continue;
      removeFrom(c.p.trash, x); c.p.hand.push(x); log(`${card.name} is added to the Hand (${who(c.p)}).`); handUp(c.p, 1);
    }
    if (tt.gwCore) await gwCorePlus(c, tt.gwCore, card.name);
  }
}
const abTaxOn = (p) => !!G && p.abTax === G.turnNo;
const abTaxOK = (p, s) => !abTaxOn(p) || spare(s) >= 1;
async function payAbTax(p, s, verb) {                 // true = the Spirit may attack/block (tax paid or none)
  if (!abTaxOn(p)) return true;
  const nm = CARDS[s.id].name;
  if (spare(s) < 1) { log(`${nm} can't ${verb}: no core to send to the Trash (Plutonic Wall).`); return false; }
  const go = p.cpu ? true : await ask({ title: '🛡 Plutonic Wall', html: `Send a core from ${esc(nm)} to the Trash to ${verb}?`, buttons: [{ label: `Send a core and ${verb}`, cls: 'primary', value: true }, { label: 'Cancel', cls: 'cancel', value: false }] });
  if (!go) return false;
  if (s.cores > 0) { s.cores--; p.trashCores.n++; } else if (s.soul) { s.soul = false; p.trashCores.soul = true; }
  log(`${who(p)} ${p.cpu ? 'sends' : 'send'} a core from ${nm} to the Trash to ${verb}.`); io.view({ type: 'board' }); return true;
}
async function oppAttackHandFx(D) {                    // D = the player whose opponent starts the Attack Step
  const A = G.p[other(D.key)];
  for (const h of D.hand.slice()) {
    if (G.over || !D.hand.includes(h)) continue;
    const card = CARDS[h.id], oh = card.magic && card.magic.oppAttackHand; if (!oh) continue;
    const gw = D.nexus.filter(n => isGW(n) && fxMatch(CARDS[n.id], oh.match) && n.cores >= oh.gwToVoid);
    if (!gw.length || !magicUsable(D, h, 'flash')) continue;
    let ch;
    if (D.cpu) { if (!A.spirits.some(s => !s.exhausted && !s.noAB)) continue; ch = { inst: h, target: null, plan: null, ctx: 'flash' }; }
    else {
      const go = await ask({ title: `⚡ ${esc(card.name)}`, peek: true, wide: true, html: `The opposing Attack Step starts. Send ${oh.gwToVoid} cores from ${esc(CARDS[gw[0].id].name)} to the Void and pay ${effCost(D, card)} to use ${esc(card.name)} from your Hand?`, cards: cardIds([h]),
        buttons: [{ label: 'Use it', cls: 'primary', value: true }, { label: 'No', cls: 'cancel', value: false }] });
      if (!go) continue;
      ch = await prepareHumanMagic(D, h, 'flash'); if (!ch) continue;
    }
    gw[0].cores -= oh.gwToVoid; D.void += oh.gwToVoid;
    log(`${who(D)} ${D.cpu ? 'sends' : 'send'} ${oh.gwToVoid} cores from ${CARDS[gw[0].id].name} to the Void.`);
    await castMagic(D, ch); io.view({ type: 'board' }); await flushBursts();
  }
}
async function braveSummonedFx(p, b) { if (G && !G.over && b) { await maybeBurst(p, 'BRAVE_SUMMONED', { subject: b }); await flushBursts(); } }
async function braveSummonedEvs(evs) { for (const e of evs) if (e.trigger === 'SUMMONED' && e.src && CARDS[e.src.id] && CARDS[e.src.id].type === 'Brave') await braveSummonedFx(e.owner, e.src); }
Object.assign(FX_ACTIONS, {
  /* v0.184 "You can use the Flash effect of a <match> Magic card from your Hand, without paying the cost": the card is cast (Flash side) for free and goes to the Trash */
  USE_FLASH: { chk: a => hasMatch(a.match),
    txt: () => 'use the Flash effect of a matching Magic card from your Hand without paying the cost',
    cands: (c, a) => c.p.hand.filter(h => CARDS[h.id].type === 'Magic' && fxMatch(CARDS[h.id], a.match) && magicUsable(c.p, h, 'flash', true)),
    can: (c, a) => FX_ACTIONS.USE_FLASH.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.USE_FLASH.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      let ch;
      if (c.p.cpu) {
        const best = L.map(h => ({ h, tg: magicTargets(c.p, h, 'flash') })).filter(x => x.tg === null || x.tg.length).sort((x, y) => CARDS[y.h.id].cost - CARDS[x.h.id].cost)[0];
        if (!best) { c.ctx.did = false; return; }
        const t = best.tg && best.tg.slice().sort((x, y) => bpOf(y) - bpOf(x))[0];
        ch = { inst: best.h, target: t || null, plan: null, ctx: 'flash', free: true };
      } else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: 'Use the Flash effect of which Magic card (no cost)?', cards: cardIds(ids), buttons: [...ids.map(i => ({ label: CARDS[i].name, value: i })), { label: 'Do not use', cls: 'cancel', value: null }] });
        const h = L.find(x => x.id === id); if (!h) { c.ctx.did = false; return; }
        ch = await prepareHumanMagic(c.p, h, 'flash', true); if (!ch) { c.ctx.did = false; return; }
      }
      if (cardHasKeyword(CARDS[c.src.id], 'Magirrate')) ch.inst.viaMagirrate = true;      // v205 "used via Magirrate"
      log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'uses' : 'use'} the Flash effect of ${CARDS[ch.inst.id].name} without paying the cost.`);
      await castMagic(c.p, ch); io.view({ type: 'board' });
    } },
  AB_CORE_TAX_TURN: { chk: () => true, txt: () => 'during this turn, when an opposing Spirit/Ultimate would attack/block, unless the opponent sends a core from it to the Trash, it can\'t attack/block',
    run: async c => { c.opp.abTax = G.turnNo; log(`${_pn(c)}: this turn ${poss(c.opp)} Spirits must send a core to the Trash to attack/block.`); io.view({ type: 'board' }); } }
});
