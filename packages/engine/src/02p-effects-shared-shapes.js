/* v0.88.0 S1 Standard Magic (roadmap item L, owner 2026-10-21 "agar game playable"): the shared shapes of the Standard (block A)
   Magic cards that had no runnable paragraph.
   Conditions (fxIf, 02a):
     lifeReduced: true|false      "If your Life was reduced (during) this turn" (any Life core left the owner's Life this turn;
                                  lifeTake records the turn in p.lifeRedTurn)
     allHave: {family, team, costIn: [n..], spiritsOnly | nexusOnly}
                                  "If all your Spirits/Nexuses have the X family / have <Team>" and "If all your Spirits are Cost
                                  2/4/6/8 with the X family": every card on the owner's Field (Spirits only with spiritsOnly)
                                  matches; with no such card the condition is not met (house reading, rules audit).
   Match field (fxMatch, 02a): familyAll ['RYUKI', 'Kamen'] = '"RYUKI" & "Kamen" family' (every listed family).
   Actions:
     DESTROY_OWN {match}          "Target one of your <X> Spirits. Destroy it." (own effect; ctx.did = false when nothing was
                                  destroyed, so "If you've done so, ..." follows with {"if": {"prev": true}})
     EXHAUST_OPP + coresLe        "Target an opposing Spirit with one core or less on it. Exhaust it."
     CANT_ATTACK_BLOCK + turn, costLe
                                  "Target an opposing Cost N or less Spirit. During this turn, it can't attack/block." (turn: the
                                  flag ends in the End Step, 07-turn.js; without turn it lasts the game as before)
   v0.89.0 S1 part 2:
     condition ctrlFamily {any: [..], is}   "If you control any X/Y family Spirit" (is: false = none of them)
     BP_TARGET perExhausted                 "For each exhausted Spirit you control, give it +N BP" (N times that count)
     BP_TARGET sets ctx.picked; DESTROY_PICKED destroys that Spirit ("When this battle ends, destroy it", inside END_BATTLE;
                                            a Magic card's delayed effect resolves from the Trash, 02o)
     BP_MINUS other                         "Target two opposing Spirits ...": a second BP_MINUS picks another Spirit
     EXHAUST_OPP oppChooses + refreshedOnly "The opponent targets a refreshed Spirit they control. Exhaust it."
     SOUL_HOLDER_CORE                       "Target an opposing Spirit with [Soul Core] on it. Send a core from it to the
                                            Reserve. (The opponent chooses which core.)": the opponent keeps the Soul Core
                                            while another core is on it
     BOUNCE_OPP bpLeOwnLv1: match           "with a BP equal or inferior to the original LV1 BP of one of your X Spirits"
     LIFE_SHIELD {n}                        "Target (n) opposing Spirit(s). During this turn, your Life can't be reduced by
                                            its attack." (08-battle: the unblocked attack takes no Life)
     BLOCK_EXHAUSTED_OPP                    "Target an opposing Spirit. During this battle, it can block even while exhausted."
   v0.90.0 S1 part 3:
     match keyword: 'Clash'                 "a Spirit with Clash" (the card prints the keyword head "Clash (...)")
     match noText                           "with no printed effects" (the card has no effect text)
     SUMMON_HAND match by colour / noText   "Target a Purple Spirit card with no printed effects in your Trash. Summon it";
                                            the summoned card becomes ctx.picked (for "When this battle ends, destroy the summoned")
     OWN_CORE_TO_LIFE {match}               "Target one of your X Spirits. Send a core, besides [Soul Core], from it to your Life."
   A team is printed as the card's head line "[Team: X]" / "[Teams: X/Y]"; cardTeams reads it from the card text. */
function cardTeams(k) { const m = /\[Teams?:\s*([^\]]+)\]/.exec((k && (k.desc || k.text)) || ''); return m ? m[1].split('/').map(x => x.trim()).filter(Boolean) : []; }
function allHaveShapeOK(q) { return !!q && typeof q === 'object' && (q.family != null || q.familyAny != null || q.team != null || q.costIn != null)
  && (q.family == null || typeof q.family === 'string') && (q.familyAny == null || (Array.isArray(q.familyAny) && q.familyAny.length > 0 && q.familyAny.every(x => typeof x === 'string' && x))) && (q.team == null || typeof q.team === 'string')
  && (q.costIn == null || (Array.isArray(q.costIn) && q.costIn.length > 0 && q.costIn.every(n => Number.isInteger(n) && n >= 0 && n <= 30)))
  && (q.spiritsOnly == null || q.spiritsOnly === true) && (q.nexusOnly == null || (q.nexusOnly === true && !q.spiritsOnly)); }
function allHaveOK(owner, q) {
  if (!allHaveShapeOK(q)) return fxUnknown('condition', 'allHave');
  const L = q.spiritsOnly ? owner.spirits : q.nexusOnly ? owner.nexus : fieldList(owner);
  return L.length > 0 && L.every(f => { const k = CARDS[f.id];
    return (!q.family || (k.families || []).includes(q.family)) && (!q.familyAny || q.familyAny.some(x => (k.families || []).includes(x))) && (!q.team || cardTeams(k).includes(q.team)) && (!q.costIn || q.costIn.includes(k.cost)); });
}
(() => {
  const E = FX_ACTIONS.EXHAUST_OPP, eChk = E.chk, eCands = E.cands, eTxt = E.txt;
  E.chk = a => eChk(a) && (a.coresLe == null || (Number.isInteger(a.coresLe) && a.coresLe >= 0 && a.coresLe <= 10));
  E.cands = (c, a) => eCands(c, a).filter(t => a.coresLe == null || totalCores(t) <= a.coresLe);
  E.txt = a => eTxt(a) + (a.coresLe != null ? ` with ${a.coresLe} core${a.coresLe === 1 ? '' : 's'} or less on it` : '');
  const N = FX_ACTIONS.CANT_ATTACK_BLOCK, nChk = N.chk, nCands = N.cands, nRun = N.run, nTxt = N.txt;
  const okN = a => (a.turn == null || a.turn === true) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30));
  N.chk = a => nChk(a) && okN(a);
  N.cands = (c, a) => nCands(c, a).filter(t => !a || a.costLe == null || CARDS[t.id].cost <= a.costLe);
  N.can = (c, a) => N.cands(c, a).length > 0;
  N.txt = a => a.turn ? `during this turn, ${a.n === 1 ? 'an opposing Spirit/Ultimate' : a.n + ' opposing Spirits/Ultimates'}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} can't attack/block` : nTxt(a);
  N.run = async (c, a) => {
    if (!a.turn && a.costLe == null) return nRun(c, a);
    const L = N.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const T = await pickOppSpirits(c, L, a.n, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit that can't attack/block${a.turn ? ' this turn' : ''} (glowing).`);
    if (!T.length) { c.ctx.did = false; return; }
    for (const t of T) { t.noAB = true; if (a.turn) t.noABTurn = G.turnNo; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} can't attack/block during this ${a.turn ? 'turn' : 'game'}.`); }
    io.view({ type: 'board' });
  };
})();
(() => {
  const B = FX_ACTIONS.BP_TARGET, bChk = B.chk, bRun = B.run, bTxt = B.txt;
  const exN = c => c.p.spirits.filter(x => x.exhausted).length;
  B.chk = a => bChk(a) && (a.perExhausted == null || a.perExhausted === true);
  B.txt = a => bTxt(a) + (a.perExhausted ? ' for each exhausted Spirit you control' : '');
  B.run = async (c, a) => {
    if (!a.perExhausted) return bRun(c, a);
    const k = exN(c); if (!k) { c.ctx.did = false; return; }
    return bRun(c, Object.assign({}, a, { n: a.n * k, perExhausted: undefined }));
  };
  const M = FX_ACTIONS.BP_MINUS, mChk = M.chk, mCands = M.cands, mRun = M.run, mTxt = M.txt;
  M.chk = a => mChk(a) && (a.other == null || a.other === true);
  M.cands = (c, a) => mCands(c, a).filter(t => !c.ctx || !c.ctx.bpmEx || !c.ctx.bpmEx.includes(t));
  M.can = (c, a) => { const o = c.ctx && c.ctx.bpmEx; if (a && a.other) c.ctx.bpmEx = c.ctx.bpmHit || []; const r = M.cands(c, a).length > 0; if (c.ctx) c.ctx.bpmEx = o; return r; };
  M.txt = a => mTxt(a) + (a.other ? ' (another Spirit)' : '');
  M.run = async (c, a) => {
    const before = new Map(c.opp.spirits.map(t => [t, t.bpMod || 0]));
    c.ctx.bpmEx = a.other ? (c.ctx.bpmHit || []) : null;
    try { await mRun(c, a); } finally { c.ctx.bpmEx = null; }
    const hit = [...before.keys()].filter(t => (t.bpMod || 0) < before.get(t));
    c.ctx.bpmHit = (c.ctx.bpmHit || []).concat(hit);
  };
  const E = FX_ACTIONS.EXHAUST_OPP, eChk = E.chk, eCands = E.cands, eRun = E.run, eTxt = E.txt;
  E.chk = a => eChk(a) && (a.oppChooses == null || a.oppChooses === true) && (a.heavy == null || (a.heavy === true && a.oppChooses === true));
  E.txt = a => a.oppChooses ? `the opponent chooses ${a.n === 1 ? 'one' : a.n} of their refreshed Spirits; exhaust ${a.n === 1 ? 'it' : 'them'}` : eTxt(a);
  E.run = async (c, a) => {
    if (!a.oppChooses) return eRun(c, a);
    if (!E.cands(c, a).length) { c.ctx.did = false; return; }
    const hit = [];
    // the opponent targets: the CPU gives up its weakest refreshed Spirits, a human opponent taps them (v0.183: n of them, Windstorm)
    for (let j = 0; j < a.n; j++) {
      const L = E.cands(c, a); if (!L.length) break;
      const t = c.opp.cpu ? L.slice().sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
        : await fxPickTarget(Object.assign({}, c, { p: c.opp }), L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Choose one of your refreshed Spirits to exhaust (glowing).`);
      if (!t) break;
      hit.push(t); t.exhausted = true; if (a.heavy) setHeavy(t); log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} is ${a.heavy ? 'heavy ' : ''}exhausted (the opponent chose it).`);
    }
    await fireFx(c.p, 'EXHAUSTED_FX', null, { side: 'opp', heavy: !!a.heavy, fxSrc: c.src });
    for (const t of hit) await fireFx(c.opp, 'EXHAUSTED_FX', null, { side: 'own', subject: t, heavy: !!a.heavy, fxSrc: c.src });
  };
  const H = FX_ACTIONS.HEAVY_EXHAUST_OPP, hChk = H.chk, hCands = H.cands, hRun = H.run, hTxt = H.txt;
  H.chk = a => hChk(a) && (a.oppChooses == null || a.oppChooses === true);
  H.txt = a => a.oppChooses ? `the opponent chooses ${a.n === 1 ? 'one' : a.n} of their exhausted Spirits; heavy exhaust ${a.n === 1 ? 'it' : 'them'}` : hTxt(a);
  H.run = async (c, a) => {
    if (!a.oppChooses) return hRun(c, a);      // v198 "the opponent targets one of their exhausted Spirits that aren't heavily exhausted. Heavy exhaust it."
    const hit = [];
    for (let j = 0; j < a.n; j++) {
      const L = H.cands(c, a); if (!L.length) break;
      const t = c.opp.cpu ? L.slice().sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
        : await fxPickTarget(Object.assign({}, c, { p: c.opp }), L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Choose one of your exhausted Spirits to heavy exhaust (glowing).`);
      if (!t) break;
      hit.push(t); setHeavy(t); log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} is heavy exhausted (the opponent chose it).`);
    }
    if (!hit.length) { c.ctx.did = false; return; }
    await fireFx(c.p, 'EXHAUSTED_FX', null, { side: 'opp', heavy: true, fxSrc: c.src });
    for (const t of hit) await fireFx(c.opp, 'EXHAUSTED_FX', null, { side: 'own', subject: t, heavy: true, fxSrc: c.src });
  };
  const R = FX_ACTIONS.BOUNCE_OPP, rChk = R.chk, rCands = R.cands, rTxt = R.txt;
  const lv1Lim = (c, m) => { const L = c.p.spirits.filter(f => fxMatch(CARDS[f.id], m)).map(f => ((CARDS[f.id].levels || [])[0] || {}).bp || 0); return L.length ? Math.max(...L) : -1; };
  R.chk = a => a.bpLeOwnLv1 == null ? rChk(a) : hasMatch(a.bpLeOwnLv1) && rChk(Object.assign({}, a, { bpLeOwnLv1: undefined }));
  R.cands = (c, a) => { const L = rCands(c, a); if (!a || a.bpLeOwnLv1 == null) return L; const lim = lv1Lim(c, a.bpLeOwnLv1); return L.filter(t => bpOf(t) <= lim); };
  R.can = (c, a) => R.cands(c, a).length > 0;
  R.txt = a => rTxt(a) + (a.bpLeOwnLv1 ? " with BP equal or inferior to the original LV1 BP of one of your matching Spirits" : '');
})();
/* v0.195 Lane K: "Then, during this turn/battle, when only the opposing Spirit is destroyed by comparing BP with it, draw N / (your Attack Step) send a core from the opposing Life to the Reserve."
   Stamps the Spirit BP_TARGET just picked; the BATTLE_WIN event handler (08-battle) runs it via winRiderRun. */
FX_ACTIONS.WIN_RIDER = {
  chk: a => (a.draw == null || (Number.isInteger(a.draw) && a.draw >= 1 && a.draw <= 3)) && (a.lifeCore == null || a.lifeCore === true) && (a.draw != null) !== (a.lifeCore === true) && (a.battle == null || a.battle === true) && (a.match == null || invokeMatchOK(a.match)),
  txt: a => `when only the opposing Spirit is destroyed by comparing BP with it this ${a.battle ? 'battle' : 'turn'}, ${a.draw ? 'draw ' + a.draw : "(your Attack Step) send a core from the opposing Life to the Reserve"}`,
  can: (c, a) => !a.match || ownTargetCands(c, a).length > 0,
  run: async (c, a) => {
    let t = c.ctx.picked;      // a.match: no BP_TARGET before it, so pick one of your matching Spirits here
    if (!t && a.match) { const L = ownTargetCands(c, a); t = !L.length ? null : c.p.cpu ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits (glowing).`); }
    if (!t) { c.ctx.did = false; return; }
    t.winRider = { turn: G.turnNo, battleNo: a.battle ? G.battleNo : null, draw: a.draw || 0, lifeCore: !!a.lifeCore };
  }
};
function winRiderRun(ev) {
  const r = ev.inst && ev.inst.winRider; if (!r || r.turn !== G.turnNo) return;
  if (r.battleNo != null && r.battleNo !== G.battleNo) return;
  const p = G.p[ev.key], name = CARDS[ev.inst.id].name;
  if (r.draw) { const k = draw(p, r.draw); log(`${name}: ${who(p)} ${p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'} (BP win).`); handUp(p, k); }
  else if (r.lifeCore && ev.att) {
    const o = G.p[other(ev.key)]; if (o.life > 0) { lifeTake(o, 1, 'reserve'); log(`${name}: a core from ${poss(o)} Life moves to the Reserve (BP win).`); if (o.life <= 0) win(ev.key, `${poss(o)} Life reached 0`); }
  }
}
Object.assign(FX_ACTIONS, {
  /* v209 "Target one of your [matching] Spirits. During this turn, give it: <keyword/flag>." (e.g. Clash = STATIC MUST_BLOCK):
     a one-turn flag mark on the chosen Spirit, read by flagActive. */
  GRANT_FLAG: { chk: a => typeof a.flag === 'string' && STATIC_FLAGS.includes(a.flag) && (a.match == null || hasMatch(a.match)),
    txt: a => `during this turn, give one of your ${a.match ? 'matching ' : ''}Spirits "${a.flag}"`,
    cands: (c, a) => c.p.spirits.filter(s => !a.match || fxMatch(CARDS[s.id], a.match, s)),
    can: (c, a) => FX_ACTIONS.GRANT_FLAG.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.GRANT_FLAG.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to give "${a.flag}" for this turn (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      t.grantFlag = a.flag; t.grantFlagTurn = G.turnNo;
      log(`${CARDS[c.src.id].name}: ${poss(c.p)} ${CARDS[t.id].name} gains "${a.flag}" for this turn.`);
    } } });
Object.assign(FX_ACTIONS, {
  DESTROY_OWN: {
    chk: a => hasMatch(a.match) && (a.voidByCost == null || a.voidByCost === true) && (a.other == null || a.other === true),
    txt: a => (a.other ? 'destroy another Spirit you control' : 'destroy one of your matching Spirits') + (a.voidByCost ? ', then put cores from the Void to your Reserve equal to its cost' : ''),
    cands: (c, a) => c.p.spirits.filter(s => (!a.other || s !== c.src) && fxMatch(CARDS[s.id], a.match)),
    can: (c, a) => FX_ACTIONS.DESTROY_OWN.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DESTROY_OWN.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      // the CPU gives up its weakest matching Spirit; the human taps one
      const t = c.p.cpu ? L.slice().sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
        : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to destroy (glowing).`);
      if (!t || !c.p.spirits.includes(t)) { c.ctx.did = false; return; }
      log(`${CARDS[c.src.id].name}: ${poss(c.p)} ${CARDS[t.id].name} is destroyed.`);
      removeSpirit(c.p, t, 'destroyed', false); checkDepletion(c.p);
      if (a.voidByCost) { const m = takeFromVoid(c.p, CARDS[t.id].cost); c.p.reserve.n += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to the Reserve.`); }      // v0.183 (schema 46)
    } } });
/* v0.197 ACTIVATE_SUMMONED {match}: "Target one of your <X> Spirits. Activate one of its (When Summoned) effects." The first effect it can resolve at its level is used (house reading of "one of"). */
FX_ACTIONS.ACTIVATE_SUMMONED = {
  chk: a => hasMatch(a.match),
  txt: () => 'activate one of the When Summoned effects of one of your matching Spirits',
  eff: (c, t) => fxEntries(t).map(x => x.e).find(e => e.trigger === 'SUMMONED' && !(e.lv && !e.lv.includes(lvNo(t))) && !e.alsoAdvent && fxCan({ p: c.p, opp: c.opp, src: t, ctx: {} }, e)),
  cands: (c, a) => c.p.spirits.filter(s => !s.noFx && fxMatch(CARDS[s.id], a.match) && FX_ACTIONS.ACTIVATE_SUMMONED.eff(c, s)),
  can: (c, a) => FX_ACTIONS.ACTIVATE_SUMMONED.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.ACTIVATE_SUMMONED.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? L.slice().sort((x, y) => bpOf(y) - bpOf(x))[0] : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to activate its When Summoned effect (glowing).`);
    const e = t && FX_ACTIONS.ACTIVATE_SUMMONED.eff(c, t); if (!e) { c.ctx.did = false; return; }
    log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name}'s When Summoned effect activates.`);
    await runActions({ p: c.p, opp: c.opp, src: t, ctx: {} }, e, 'SUMMONED');
  } };
Object.assign(FX_ACTIONS, {
  DESTROY_PICKED: { chk: () => true, txt: () => 'destroy that Spirit',
    can: c => !!(c.ctx && c.ctx.picked),
    run: async c => {
      const t = c.ctx && c.ctx.picked, q = t && ownerOf(t); if (!q) { c.ctx.did = false; return; }
      log(`${CARDS[c.src.id].name}: ${poss(q)} ${CARDS[t.id].name} is destroyed.`);
      removeSpirit(q, t, 'destroyed', q !== c.p); checkDepletion(q);
    } } });
Object.assign(FX_ACTIONS, {
  SOUL_HOLDER_CORE: { chk: () => true, txt: () => 'send a core from an opposing Spirit with the Soul Core on it to the Reserve (the opponent chooses the core)',
    cands: c => c.opp.spirits.filter(t => t.soul && !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.SOUL_HOLDER_CORE.cands(c).length > 0,
    run: async c => {
      const L = FX_ACTIONS.SOUL_HOLDER_CORE.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit with the Soul Core (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      if (!coreTakeCap(c.opp, t, 1)) { c.ctx.did = false; return; }      // v190 CORE_SAFE
      if (t.cores > 0) { coreEv(c.opp, 'core', t.uid, 'reserve'); t.cores -= 1; c.opp.reserve.n += 1; log(`${CARDS[c.src.id].name}: a core from ${poss(c.opp)} ${CARDS[t.id].name} goes to the Reserve.`); }
      else { t.soul = false; c.opp.reserve.soul = true; log(`${CARDS[c.src.id].name}: the Soul Core on ${poss(c.opp)} ${CARDS[t.id].name} goes to the Reserve.`); }
      checkDepletion(c.opp); io.view({ type: 'board' });
    } } });
Object.assign(FX_ACTIONS, {
  LIFE_SHIELD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3,
    txt: a => `during this turn, your Life can't be reduced by the attack of ${a.n === 1 ? 'an opposing Spirit' : a.n + ' opposing Spirits'}`,
    cands: c => c.opp.spirits.filter(t => !fxImmune(c.opp, t)),
    can: c => FX_ACTIONS.LIFE_SHIELD.cands(c).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.LIFE_SHIELD.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const T = await pickOppSpirits(c, L, a.n, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit whose attack can't reduce your Life this turn (glowing).`);
      if (!T.length) { c.ctx.did = false; return; }
      for (const t of T) { t.lifeShield = { turn: G.turnNo, key: c.p.key }; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name}'s attack can't reduce ${poss(c.p)} Life this turn.`); }
    } } });
/* v0.199 LIFE_CORE_SHIELD {cores, battle?}: "during this turn/battle, your Life can't be reduced by the attacks of opposing Spirits with <cores> cores on them" (Rainy Poison, Venomous Bottomless Swamp) */
Object.assign(FX_ACTIONS, {
  LIFE_CORE_SHIELD: { chk: a => Number.isInteger(a.cores) && a.cores >= 1 && a.cores <= 9 && (a.battle == null || a.battle === true),
    txt: a => `during this ${a.battle ? 'battle' : 'turn'}, your Life can't be reduced by the attacks of opposing Spirits with ${a.cores} core${a.cores === 1 ? '' : 's'} on them`,
    can: () => true,
    run: async (c, a) => { c.p.coreShield = { turn: G.turnNo, cores: a.cores, b: a.battle ? (G.battleNo || 0) : null }; log(`${CARDS[c.src.id].name}: ${poss(c.p)} Life can't be reduced by the attacks of opposing Spirits with ${a.cores} core${a.cores === 1 ? '' : 's'} this ${a.battle ? 'battle' : 'turn'}.`); } } });
Object.assign(FX_ACTIONS, {
  BLOCK_EXHAUSTED_OPP: { chk: () => true, txt: () => 'during this battle, an opposing Spirit can block even while exhausted',
    cands: c => c.opp.spirits.filter(t => !fxImmune(c.opp, t)),
    can: c => !!G.attacker && FX_ACTIONS.BLOCK_EXHAUSTED_OPP.cands(c).length > 0,
    run: async c => {
      const L = FX_ACTIONS.BLOCK_EXHAUSTED_OPP.cands(c); if (!L.length || !G.attacker) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit that can block while exhausted this battle (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      t.blockExB = G.battleNo; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} can block even while exhausted during this battle.`);
    } } });
/* v0.185 (schema 64) "Target an opposing [N BP or less | exhausted] Spirit [in refreshed state]. During this battle, it must block if possible even while exhausted": marks blockExB + mustB (08-battle binds it) */
FX_ACTIONS.MUST_BLOCK_OPP = { chk: a => (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000)) && (a.state == null || a.state === 'refreshed' || a.state === 'exhausted') && Object.keys(a).every(k => ['do', 'bpLe', 'state', 'if'].includes(k)),
  txt: () => 'during this battle, an opposing Spirit must block if possible even while exhausted',
  cands: (c, a) => c.opp.spirits.filter(t => (!a.bpLe || bpOf(t) <= a.bpLe) && (!a.state || t.exhausted === (a.state === 'exhausted')) && !fxImmune(c.opp, t)),
  can: (c, a) => !!G.attacker && FX_ACTIONS.MUST_BLOCK_OPP.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = G.attacker ? FX_ACTIONS.MUST_BLOCK_OPP.cands(c, a) : [], t = L.length && await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit that must block this battle (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t.blockExB = t.mustB = G.battleNo; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} must block if possible, even while exhausted, during this battle.`);
  } };
// v0.172.0: marks on a targeted opposing Spirit: noRefreshT (skips the next opposing Refresh Step), noBlockB (can't block this battle)
const fxOppMark = (k, key, f, val, ask, txt) => ({ chk: () => true, txt: () => txt, cands: c => c.opp.spirits.filter(t => f(t) && !fxImmune(c.opp, t)),
  can: c => FX_ACTIONS[k].cands(c).length > 0,
  run: async c => {
    const L = FX_ACTIONS[k].cands(c), t = L.length && await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the ${ask} (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t[key] = val(); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} ${txt}.`);
  } });
FX_ACTIONS.NO_REFRESH_OPP = { ...fxOppMark('NO_REFRESH_OPP', 'noRefreshT', t => t.exhausted, () => G.turnNo + 1, 'exhausted opposing Spirit', "can't refresh next Refresh Step") };
FX_ACTIONS.NO_BP_DESTROY = { chk: () => true, txt: () => "can't be destroyed by BP comparison during this battle", can: () => !!G.attacker,      // v0.196 (When Blocks/Attacks): the mark holds for this battle number
  run: async c => { c.src.noBpDestroy = G.battleNo; log(`${CARDS[c.src.id].name} can't be destroyed by BP comparison during this battle.`); } };
/* v162 "target an opposing <costLe> Spirit. It must attack at the start of the step if possible": mark mustAtk = turn number; startAttackFx (09-cpu) makes it attack once the Start steps are over */
FX_ACTIONS.MUST_ATTACK_OPP = { chk: a => a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30), txt: a => `an opposing ${a.costLe != null ? 'Cost ' + a.costLe + ' or less ' : ''}Spirit must attack at the start of the step if possible`,
  cands: (c, a) => c.opp.spirits.filter(t => !t.exhausted && !fxImmune(c.opp, t) && (a.costLe == null || CARDS[t.id].cost <= a.costLe)),
  can: (c, a) => FX_ACTIONS.MUST_ATTACK_OPP.cands(c, a).length > 0,
  run: async (c, a) => {
    const L = FX_ACTIONS.MUST_ATTACK_OPP.cands(c, a), t = L.length && await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t.mustAtk = G.turnNo; log(`${CARDS[t.id].name} must attack at the start of the step if possible.`);
  } };
FX_ACTIONS.CANT_BLOCK_OPP = { ...fxOppMark('CANT_BLOCK_OPP', 'noBlockB', () => G.attacker, () => G.battleNo, 'opposing Spirit', "can't block this battle") };
(() => {      // v159 n (1-3 targets) and costLe: "target three opposing Cost 6 or less Spirits. During this battle, they can't block"
  const B = FX_ACTIONS.CANT_BLOCK_OPP, bRun = B.run;
  B.chk = a => (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 3)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.lv == null || a.lv === 1);      // v165 lv:1 "an opposing LV1 Spirit"
  B.cands = (c, a) => c.opp.spirits.filter(t => G.attacker && !fxImmune(c.opp, t) && (!a || a.costLe == null || CARDS[t.id].cost <= a.costLe) && (!a || a.lv == null || lvNo(t) === a.lv));
  B.can = (c, a) => B.cands(c, a).length > 0;
  B.txt = a => `during this battle, ${a.n > 1 ? a.n + ' opposing Spirits' : 'an opposing Spirit'}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} can't block`;
  B.run = async (c, a) => {
    if (!(a.n > 1)) return bRun(c, a);
    const L = B.cands(c, a), T = L.length ? await pickOppSpirits(c, L, a.n, `✨ <b>${esc(_pn(c))}</b><br>Tap the opposing Spirits that can't block this battle (glowing).`) : [];
    if (!T.length) { c.ctx.did = false; return; }
    for (const t of T) { t.noBlockB = G.battleNo; log(`${_pn(c)}: ${CARDS[t.id].name} can't block this battle.`); }
  };
})();
// v0.175.0: "This Spirit can't be blocked by <colour> / LV<n> / High Speed / Curse Spirits" (this battle): the attacker carries noBlockBy for the battle; the block list (08-battle) skips matching Spirits
FX_ACTIONS.CANT_BE_BLOCKED_BY = { chk: a => (a.toSubject == null || a.toSubject === true) && (a.color == null || (Array.isArray(a.color) && a.color.length > 0)) && (a.levels == null || (Array.isArray(a.levels) && a.levels.length > 0 && a.levels.every(Number.isInteger))) && (a.keyword == null || typeof a.keyword === 'string') && (a.highSpeed == null || a.highSpeed === true) && (a.costLe == null || Number.isInteger(a.costLe)) && (a.costGe == null || Number.isInteger(a.costGe)) && (a.bpLe == null || Number.isInteger(a.bpLe)) && (a.coresLe == null || Number.isInteger(a.coresLe)) && (a.noSoul == null || a.noSoul === true) && (a.noSoul === true || a.color != null || a.levels != null || a.keyword != null || a.highSpeed === true || a.costLe != null || a.costGe != null || a.bpLe != null || a.coresLe != null || a.all === true),
  txt: () => "can't be blocked by Spirits with the printed trait during this battle", can: () => true,
  run: async (c, a) => { const t = a.toSubject ? c.ctx.attacker : c.src; if (!t) return; t.noBlockBy = { battleNo: G.battleNo, color: a.color, levels: a.levels, keyword: a.keyword, highSpeed: a.highSpeed === true, costLe: a.costLe, costGe: a.costGe, bpLe: a.bpLe, coresLe: a.coresLe, noSoul: a.noSoul === true, all: a.all === true }; log(`${CARDS[t.id].name} can't be blocked by some Spirits during this battle.`); } };      // v0.199 toSubject: an ALLY_ATTACKS effect gives it to the attacking ally
// v178 "When the opponent would block, unless they <send a core from their Reserve to the Trash | exhaust a Spirit other than the blocker>, they can't block": the attacker carries blockTax for the battle
FX_ACTIONS.BLOCK_TAX = { chk: a => (a.kind === 'reserve' || a.kind === 'exhaust') && Object.keys(a).every(k => ['do', 'kind', 'toSubject'].includes(k)) && (a.toSubject == null || a.toSubject === true),
  txt: a => `when the opponent would block, unless they ${a.kind === 'reserve' ? 'send a core from their Reserve to the Trash' : 'exhaust another Spirit they control'}, they can't block`, can: () => true,
  run: async (c, a) => { const t = a.toSubject ? c.ctx.attacker : c.src; if (!t) return; t.blockTax = { battleNo: G.battleNo, kind: a.kind }; } };
const blockTaxOK = (D, att, s) => { const q = att.blockTax; return !q || q.battleNo !== G.battleNo || (q.kind === 'reserve' ? D.reserve.n >= 1 : D.spirits.some(x => x !== s && !x.exhausted)); };
async function payBlockTax(D, att, s) {                // true = the Spirit may block (tax paid or none)
  const q = att.blockTax; if (!q || q.battleNo !== G.battleNo) return true;
  const verb = q.kind === 'reserve' ? 'send a core from your Reserve to the Trash' : 'exhaust another Spirit';
  const go = D.cpu ? true : await ask({ title: '🛡 Block cost', html: `${esc(CARDS[s.id].name)} can only block if you ${verb}. Pay?`, buttons: [{ label: 'Pay and block', cls: 'primary', value: true }, { label: 'Cancel', cls: 'cancel', value: false }] });
  if (!go) return false;
  if (q.kind === 'reserve') { D.reserve.n--; D.trashCores.n++; }
  else D.spirits.filter(x => x !== s && !x.exhausted).sort((x, y) => bpOf(x) - bpOf(y))[0].exhausted = true;      // shortcut: the weakest other Spirit is exhausted automatically, offer a pick if a card needs it
  log(`${who(D)} ${D.cpu ? 'pays' : 'pay'} to block: ${verb}.`); io.view({ type: 'board' }); return true;
}
const blockedInferior = (D, att, s) => flagActive(D, 'NO_BLOCK_INFERIOR', s) && bpOf(att) < bpOf(s);
/* v213 STATIC UNBLOCKABLE_LOW {bpLe} ("all your Spirits can't be blocked by opposing N BP or less Spirits"): the blocker filter
   asks the attacker's side for the flag, honouring lv/if and the to self|own scope. */
const unblockableLow = (A, att, s) => { if (!A || !att) return false; const L = lvNo(att), opp = G.p[other(A.key)];
  return fieldList(A).some(f => (f === att || A.spirits.includes(f)) && fxEntries(f).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'UNBLOCKABLE_LOW'
    && (e.to !== 'self' || f === att) && !(e.lv && !e.lv.includes(f === att ? L : lvNo(f))) && (!e.oc || ocActive(f)) && fxIf(A, opp, e.if, { selfInst: f })
    && bpOf(s) <= e.bpLe)); };      // v213      // v0.195 "can't block Spirits with BP inferior to this Spirit's"
const shamanNoBlock = (att, s) => {      // v201 NO_BLOCK_SHAMAN: Spirits summoned via Shamanism this turn can't be blocked by opposing Cost N or less Spirits
  if (!G || att.viaShamanTurn !== G.turnNo) return false;
  const ow = ownerOf(att); if (!ow) return false;
  for (const src of fieldList(ow)) { const L = lvNo(src);
    for (const { e } of fxEntries(src)) if (e.trigger === 'STATIC' && e.flag === 'NO_BLOCK_SHAMAN' && !(e.lv && !e.lv.includes(L)) && CARDS[s.id].cost <= (e.costLe || 0) && fxIf(ow, G.p[other(ow.key)], e.if, { selfInst: src })) return true; }
  return false;
};
const blockedByMark = (att, s) => { const q2 = att.noBlockTurnCost; if (q2 && q2.turn === G.turnNo && CARDS[s.id].cost >= q2.costGe) return true; const q = att.noBlockTurnBp; if (q && q.turn === G.turnNo && bpOf(s) <= q.bpLe) return true; if (att.noBlockInferiorBattle != null && att.noBlockInferiorBattle === G.battleNo && bpOf(s) <= bpOf(att)) return true; const m = att.noBlockBy; if (shamanNoBlock(att, s)) return true; if (!m || m.battleNo !== G.battleNo) return false; const k = CARDS[s.id];
  return m.all || (m.color == null || fxMatch(k, { color: m.color })) && (m.levels == null || m.levels.includes(lvNo(s))) && (m.keyword == null || cardHasKeyword(k, m.keyword)) && (!m.highSpeed || k.highSpeed === true) && (m.costLe == null || k.cost <= m.costLe) && (m.costGe == null || k.cost >= m.costGe) && (m.bpLe == null || bpOf(s) <= m.bpLe) && (m.coresLe == null || totalCores(s) <= m.coresLe) && (!m.noSoul || !s.soul); };      // v0.196 "without (Soul Core) on it"      // v0.185 "N BP or less" / "N cores or less on it"      // v0.179 "Cost N or less/more"
/* v189 "during this battle, all your Spirits can't be blocked by opposing Spirits with BP equal or inferior to theirs": every own Spirit carries the mark for this battle */
FX_ACTIONS.NO_BLOCK_INFERIOR_BATTLE = {
  chk: a => Object.keys(a).every(k => ['do', 'if'].includes(k)),
  txt: () => "all your Spirits can't be blocked by opposing Spirits with BP equal or inferior to theirs this battle",
  can: () => true,
  run: async c => { for (const s of c.p.spirits) s.noBlockInferiorBattle = G.battleNo; log(`${_pn(c)}: your Spirits can't be blocked by Spirits with BP equal or inferior to theirs this battle.`); } };
(() => {
  const S = FX_ACTIONS.SUMMON_HAND, sChk = S.chk, sRun = S.run;
  S.chk = a => sChk(a) || (!!a.match && (a.match.color != null || a.match.noText === true) && sChk(Object.assign({}, a, { match: Object.assign({}, a.match, { name: ['-'] }) })));
  S.run = async (c, a) => {
    const before = new Set(fieldList(c.p)); await sRun(c, a);
    const t = fieldList(c.p).find(x => !before.has(x)); if (t) c.ctx.picked = t; else c.ctx.did = false;
  };
})();
Object.assign(FX_ACTIONS, {
  OWN_CORE_TO_LIFE: { chk: a => hasMatch(a.match), txt: () => 'send a core (not the Soul Core) from one of your matching Spirits to your Life',
    cands: (c, a) => c.p.spirits.filter(s => s.cores > 0 && fxMatch(CARDS[s.id], a.match)),
    can: (c, a) => FX_ACTIONS.OWN_CORE_TO_LIFE.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.OWN_CORE_TO_LIFE.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      // the CPU takes the core from the Spirit that keeps its level best (most spare cores)
      const t = c.p.cpu ? L.slice().sort((x, y) => (spare(y) - spare(x)) || (y.cores - x.cores))[0]
        : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to send a core to your Life (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      t.cores -= 1; c.p.life += 1; log(`${CARDS[c.src.id].name}: a core from ${CARDS[t.id].name} goes to ${poss(c.p)} Life.`);
      checkDepletion(c.p); io.view({ type: 'board' });
      await fireFx(c.p, 'LIFE_UP', null, {});      // v191 "When your Life increases"
    } } });
