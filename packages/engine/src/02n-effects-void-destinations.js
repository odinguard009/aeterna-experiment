/* v0.77 Void destinations (pack bundle, docs/mechanics/effect-depletes-void-choices.md), wrapped onto VOID_TO_CARD like the 02m filters:
   to: 'attacker'  "When your X Spirit attacks, put a core from the Void to that Spirit" (the attacking Spirit of the
                   ALLY_ATTACKS / ATTACKS event, only while it is still on its owner's Field)
   orReserve: true "Put a core from the Void to your Spirit/Reserve" / "to this Spirit, or your Reserve": the owner picks
                   one destination when it resolves (the CPU takes the Spirit when there is one); with no legal Spirit the
                   core goes to the Reserve. */
(() => {
  const V = FX_ACTIONS.VOID_TO_CARD, vChk = V.chk, vCan = V.can, vRun = V.run, vTxt = V.txt;
  const att = c => (c.ctx && c.ctx.attacker && c.p.spirits.includes(c.ctx.attacker)) ? c.ctx.attacker : null;
  const base = a => { const o = Object.assign({}, a); delete o.orReserve; if (o.to === 'attacker') o.to = 'self'; return o; };
  V.chk = a => (a.orReserve == null || (a.orReserve === true && ['self', 'anySpirit'].includes(a.to))) && (a.to === 'attacker' ? !a.orReserve && a.match == null && vChk(base(a)) : vChk(base(a)));
  V.txt = a => a.to === 'attacker' ? `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void to the attacking Spirit`
    : vTxt(base(a)) + (a.orReserve ? ', or to your Reserve' : '');
  V.can = (c, a) => a.orReserve ? true : a.to === 'attacker' ? !!att(c) : vCan(c, a);
  V.run = async (c, a) => {
    if (a.to === 'attacker') {
      const t = att(c); const m = t ? takeFromVoid(c.p, a.n) : 0; c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
      t.cores += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to ${CARDS[t.id].name}.`); return;
    }
    if (!a.orReserve) return vRun(c, a);
    const b = base(a), spiritOk = vCan(c, b);
    let toSpirit = spiritOk;
    if (spiritOk && !c.p.cpu) toSpirit = (await ask({ title: `✨ ${esc(CARDS[c.src.id].name)}`, html: `Put ${a.n} core${a.n === 1 ? '' : 's'} from the Void on ${a.to === 'self' ? 'this Spirit' : 'one of your Spirits'} or in your Reserve?`,
      buttons: [{ label: a.to === 'self' ? 'This Spirit' : 'A Spirit', cls: 'primary', value: true }, { label: 'Reserve', cls: 'blue', value: false }] })) === true;
    if (toSpirit) return vRun(c, b);
    const m = takeFromVoid(c.p, a.n); c.p.reserve.n += m; c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
    log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Reserve.`);
  };
})();
/* v0.77 one-target core removal with a filter or a floor, wrapped onto OPP_CORES_TO_RESERVE (targets 1):
   costLe / exhaustedOnly / coresLe  the target filter of "Target an opposing <Cost N or less | exhausted | with N cores or less on it> Spirit."
   keepOne   "Its number of cores can't be brought to less than one." (send at most all but one)
   untilOne  "Send cores from it to the Reserve until one core remains." (each is ignored; all but one)
   A Soul Core stays when the text says "besides" (normal cores only, like before) and is kept last otherwise (the opponent chooses).
   v0.169 upgrade {when:'oppReserveGe3'|'viaFC', anyTarget?, soul?}: "If there are three or more cores in the opposing Reserve / If summoned via Form Change, <the target becomes any opposing Spirit | send one core (the Soul Core too) from it> instead";
   the Soul Core goes only when no normal core is left on the target (house reading of "the opponent chooses": nobody gives up the Soul Core first). */
(() => {
  const O = FX_ACTIONS.OPP_CORES_TO_RESERVE, oChk = O.chk, oTxt = O.txt, oCands = O.cands, oCan = O.can, oRun = O.run;
  const NEW = ['costLe', 'exhaustedOnly', 'coresLe', 'keepOne', 'untilOne', 'upgrade', 'fighting', 'eachPer', 'eachLegacy'];      // v0.196 fighting: "an opposing attacking/blocking Spirit"
  const upOk = u => u == null || (typeof u === 'object' && ['oppReserveGe3', 'viaFC'].includes(u.when) && (u.anyTarget == null || u.anyTarget === true) && (u.soul == null || u.soul === true) && (u.anyTarget === true || u.soul === true));
  const upOn = (c, a) => !!a.upgrade && (a.upgrade.when === 'viaFC' ? !!(c.src && c.src.viaFC) : (c.opp.reserve.n + (c.opp.reserve.soul ? 1 : 0)) >= 3);
  const has = a => !!a && NEW.some(k => a[k] != null);
  const ok = a => a.targets === 1 && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.coresLe == null || (Number.isInteger(a.coresLe) && a.coresLe >= 1 && a.coresLe <= 10))
    && [a.exhaustedOnly, a.keepOne, a.untilOne, a.fighting, a.eachLegacy].every(v => v == null || v === true) && upOk(a.upgrade) && (a.eachPer == null || perOk(a.eachPer));
  const base = a => { const o = Object.assign({}, a); for (const k of NEW) delete o[k]; if (a.untilOne) o.each = 1; return o; };
  O.chk = a => has(a) ? ok(a) && oChk(base(a)) : oChk(a);
  O.cands = (c, a) => has(a) ? (upOn(c, a) && a.upgrade.soul ? c.opp.spirits.filter(t => (t.cores > 0 || t.soul) && !fxImmune(c.opp, t)) : oCands(c)).filter(t => (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (!a.exhaustedOnly || t.exhausted || (upOn(c, a) && a.upgrade.anyTarget))
    && (a.coresLe == null || totalCores(t) <= a.coresLe) && (!(a.keepOne || a.untilOne) || totalCores(t) > 1) && (!a.fighting || t === G.attacker || t === G.blocker)) : oCands(c);
  O.can = (c, a) => has(a) ? O.cands(c, a).length > 0 : oCan(c, a);
  O.txt = a => has(a) ? (a.untilOne ? 'send cores from an opposing ' : `send ${a.each} core${a.each === 1 ? '' : 's'} from an opposing `)
    + [a.exhaustedOnly ? 'exhausted' : '', a.costLe != null ? 'Cost ' + a.costLe + ' or less' : ''].filter(Boolean).concat('Spirit').join(' ')
    + (a.coresLe != null ? ` with ${a.coresLe} core${a.coresLe === 1 ? '' : 's'} or less on it` : '') + ' to the Reserve'
    + (a.untilOne ? ' until one core remains' : a.keepOne ? ' (not below one core)' : '') + (a.drawPerDepleted ? ', and draw a card if it is depleted' : '') : oTxt(a);
  O.run = async (c, a) => {
    if (!has(a)) return oRun(c, a);
    const L = O.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const [t] = await pickOppSpirits(c, L, 1, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to send cores from (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    if (upOn(c, a) && a.upgrade.soul && t.cores < 1 && t.soul) {      // v0.169: only the Soul Core is left on the target and the text lets it go
      if (!coreTakeCap(c.opp, t, 1)) { c.ctx.did = false; return; }      // v190 CORE_SAFE
      coreEvN(c.opp, t.uid, 'reserve', 0, true); t.soul = false; c.opp.reserve.soul = true;
      log(`${CARDS[c.src.id].name}: the Soul Core of ${poss(c.opp)} ${CARDS[t.id].name} goes to the Reserve.`);
      checkDepletion(c.opp); io.view({ type: 'board' }); return;
    }
    const floor = (a.keepOne || a.untilOne) ? totalCores(t) - 1 : Infinity;
    const m = Math.max(0, Math.min(a.untilOne ? Infinity : a.each + (a.eachPer ? perCount(c.p, a.eachPer) : 0) + (a.eachLegacy ? (c.src.legacyN || 0) : 0), t.cores, floor, coreTakeCap(c.opp, t, Infinity)));      // v137 eachPer: "send +1 core for each Spirit with X you control"; v190 CORE_SAFE
    if (!m) { c.ctx.did = false; return; }
    coreEvN(c.opp, t.uid, 'reserve', m, false); t.cores -= m; c.opp.reserve.n += m;
    log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} from ${poss(c.opp)} ${CARDS[t.id].name} go to the Reserve.`);
    checkDepletion(c.opp);
    if (a.drawPerDepleted && !c.opp.spirits.includes(t)) { const k = draw(c.p, 1); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    io.view({ type: 'board' });
  };
})();
