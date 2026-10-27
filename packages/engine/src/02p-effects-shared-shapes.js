/* v0.88.0 S1 Standard Magic (roadmap item L, owner 2026-10-21 "agar game playable"): the shared shapes of the Standard (block A)
   Magic cards that had no runnable paragraph.
   Conditions (fxIf, 02a):
     lifeReduced: true|false      "If your Life was reduced (during) this turn" (any Life core left the owner's Life this turn;
                                  lifeTake records the turn in p.lifeRedTurn)
     allHave: {family, team, costIn: [n..], spiritsOnly}
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
function allHaveShapeOK(q) { return !!q && typeof q === 'object' && (q.family != null || q.team != null || q.costIn != null)
  && (q.family == null || typeof q.family === 'string') && (q.team == null || typeof q.team === 'string')
  && (q.costIn == null || (Array.isArray(q.costIn) && q.costIn.length > 0 && q.costIn.every(n => Number.isInteger(n) && n >= 0 && n <= 30)))
  && (q.spiritsOnly == null || q.spiritsOnly === true); }
function allHaveOK(owner, q) {
  if (!allHaveShapeOK(q)) return fxUnknown('condition', 'allHave');
  const L = q.spiritsOnly ? owner.spirits : fieldList(owner);
  return L.length > 0 && L.every(f => { const k = CARDS[f.id];
    return (!q.family || (k.families || []).includes(q.family)) && (!q.team || cardTeams(k).includes(q.team)) && (!q.costIn || q.costIn.includes(k.cost)); });
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
  E.chk = a => eChk(a) && (a.oppChooses == null || a.oppChooses === true);
  E.txt = a => a.oppChooses ? 'the opponent chooses one of their refreshed Spirits; exhaust it' : eTxt(a);
  E.run = async (c, a) => {
    if (!a.oppChooses) return eRun(c, a);
    const L = E.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
    // the opponent targets: the CPU gives up its weakest refreshed Spirit, a human opponent taps one
    const t = c.opp.cpu ? L.slice().sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
      : await fxPickTarget(Object.assign({}, c, { p: c.opp }), L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Choose one of your refreshed Spirits to exhaust (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    t.exhausted = true; log(`${CARDS[c.src.id].name}: ${poss(c.opp)} ${CARDS[t.id].name} is exhausted (the opponent chose it).`);
  };
  const R = FX_ACTIONS.BOUNCE_OPP, rChk = R.chk, rCands = R.cands, rTxt = R.txt;
  const lv1Lim = (c, m) => { const L = c.p.spirits.filter(f => fxMatch(CARDS[f.id], m)).map(f => ((CARDS[f.id].levels || [])[0] || {}).bp || 0); return L.length ? Math.max(...L) : -1; };
  R.chk = a => a.bpLeOwnLv1 == null ? rChk(a) : hasMatch(a.bpLeOwnLv1) && rChk(Object.assign({}, a, { bpLeOwnLv1: undefined }));
  R.cands = (c, a) => { const L = rCands(c, a); if (!a || a.bpLeOwnLv1 == null) return L; const lim = lv1Lim(c, a.bpLeOwnLv1); return L.filter(t => bpOf(t) <= lim); };
  R.can = (c, a) => R.cands(c, a).length > 0;
  R.txt = a => rTxt(a) + (a.bpLeOwnLv1 ? " with BP equal or inferior to the original LV1 BP of one of your matching Spirits" : '');
})();
Object.assign(FX_ACTIONS, {
  DESTROY_OWN: {
    chk: a => hasMatch(a.match),
    txt: a => 'destroy one of your matching Spirits',
    cands: (c, a) => c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match)),
    can: (c, a) => FX_ACTIONS.DESTROY_OWN.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.DESTROY_OWN.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      // the CPU gives up its weakest matching Spirit; the human taps one
      const t = c.p.cpu ? L.slice().sort((x, y) => (bpOf(x) - bpOf(y)) || (x.cores - y.cores))[0]
        : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to destroy (glowing).`);
      if (!t || !c.p.spirits.includes(t)) { c.ctx.did = false; return; }
      log(`${CARDS[c.src.id].name}: ${poss(c.p)} ${CARDS[t.id].name} is destroyed.`);
      removeSpirit(c.p, t, 'destroyed', false); checkDepletion(c.p);
    } } });
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
    } } });
