/* an effect can resolve when at least one action that does not depend on a previous action ({"prev":true}) is possible */
function fxCan(c, e) { return e.actions.some(a => { const d = FX_ACTIONS[a.do]; if (!d) return fxUnknown('action', a.do); return !(a.if && a.if.prev === true) && (!d.can || d.can(c, a)); }); }
/* run the actions of one effect. Each action sets ctx.did = false when it could not do anything; the next action can test {"prev":true/false} */
async function runActions(c, e, trg) {
  let last = false;
  for (const a of e.actions) {
    if (G.over) return;
    c.ctx.prev = last; last = false;
    if (!fieldList(c.p).includes(c.src) && trg !== 'SUMMONED' && a.do === 'REFRESH') continue;
    if (a.if && !fxIf(c.p, c.opp, a.if, c.ctx)) continue;
    if (!FX_ACTIONS[a.do]) { fxUnknown('action', a.do); continue; }             // v0.59.4 strict effects (release: skip it)
    c.ctx.did = true;
    const by = G.fxBy; G.fxBy = c.p.key;                 // v0.73: whose effect is resolving (LEAVES / byOppFx: "due to opposing effects", depletion and returns included)
    try { await FX_ACTIONS[a.do].run(c, a); } finally { G.fxBy = by; }
    last = c.ctx.did !== false;
    if (a.cost && !last) return;                        // v0.43: a cost that could not be paid stops the rest of the effect
  }
}
/* fire a trigger. src = the card the trigger belongs to (SUMMONED/ATTACKS/MANIFEST); ctx.attacker for the ALLY_* triggers.
   Official rules (Eternal Rule Manual, Other Rules "About Activating Effects"):
   - effects that activate at the same time form one pool; the TURN PLAYER decides the order (also for the opponent's effects);
   - an effect activated as a result of a resolving effect is resolved first, right after that effect has finished (derived queue).
   fireFxMulti takes several events that happen at the same time (e.g. Life reduced: attacker and defender effects). */
async function fireFx(owner, trigger, src, ctx) { return fireFxMulti([{ owner, trigger, src, ctx }]); }
function collectFx(ev) {
  const owner = ev.owner, trigger = ev.trigger, src = ev.src, ctx = ev.ctx || {};
  if (trigger === 'SUMMONED') ctx.subject = src;
  if (!FX_TRIGGERS.includes(trigger)) { fxUnknown('trigger', trigger); return []; }   // v0.59.4 strict effects
  const opp = G.p[other(owner.key)], out = [];
  const add = (trg, f, e, idx) => out.push({ owner, opp, f, idx, e, trg, trigger, ctx });
  const collect = (trg, f) => { for (const { e, idx } of fxEntries(f)) if (e.trigger === trg) add(trg, f, e, idx); };
  if (trigger === 'ADVENT') { const card = CARDS[src.id]; if (card.effects) card.effects.forEach((e, idx) => { if (e.trigger === 'ADVENT' || (e.trigger === 'SUMMONED' && e.alsoAdvent)) add(e.trigger, src, e, idx); }); ctx.subject = src; }
  else if (trigger === 'SUMMONED' || trigger === 'ATTACKS' || trigger === 'MANIFEST' || trigger === 'DESTROYED' || trigger === 'LEAVES' || trigger === 'BATTLE_WIN') collect(trigger, src);
  else if (trigger === 'BLOCKS') { for (const { e, idx } of fxEntries(src)) { if (e.trigger === 'BLOCKS' || (e.trigger === 'ATTACKS' && e.alsoBlocks)) add('BLOCKS', src, e, idx); } }
  else if (trigger === 'MIRAGE_OWN_LIFE' || trigger === 'MIRAGE_OPP_LIFE') { if (owner.mirage) collect(trigger, owner.mirage); }
  else for (const f of fieldList(owner)) collect(trigger, f);
  if (trigger === 'ALLY_BLOCKED' || trigger === 'SILVER_WHEEL') for (const h of owner.hand) collect(trigger, h);           // zone:'hand' effects (e.g. deploy this from the Hand)
  if (trigger === 'SUMMONED' || trigger === 'ADVENT') for (const f of fieldList(owner)) collect('ALLY_SUMMONED', f);
  if (out.some(i => i.e.noStack)) { const seen = new Set(); return out.filter(i => { if (!i.e.noStack) return true; const k = CARDS[i.f.id].name + ':' + i.idx; if (seen.has(k)) return false; seen.add(k); return true; }); }     // v0.40 (Can't Stack): the same-name effect works once
  return out;
}
function fxValid(it) {
  const { owner, opp, f, idx, e, trg, ctx } = it, subj = ctx.subject || ctx.attacker;
  const isMir = trg === 'MIRAGE_OWN_LIFE' || trg === 'MIRAGE_OPP_LIFE';
  const fromHand = e.zone === 'hand', dead = trg === 'DESTROYED' || trg === 'LEAVES';
  if (isMir ? !(owner.mirage === f && f.mirage) : fromHand ? !owner.hand.includes(f) : trg === 'LEAVES' ? fieldList(owner).includes(f) : dead ? !(owner.trash.includes(f) || owner.standby.includes(f) || owner.soulState.includes(f)) : !fieldList(owner).includes(f)) return false;
  if (!isMir && !fromHand && e.lv && !e.lv.includes(dead ? f.lostLv + lvBase(CARDS[f.id]) : lvNo(f))) return false;
  if (e.oc && (dead || !ocActive(f))) return false;
  if (e.braved && !f.brave) return false;
  if ((trg === 'ALLY_ATTACKS' || trg === 'OPP_ATTACKS' || trg === 'ALLY_DESTROYS' || trg === 'ALLY_BLOCKED' || trg === 'ALLY_SUMMONED' || trg === 'ALLY_LIFE_HIT' || trg === 'ALLY_LOST' || trg === 'SOUL_PLACED' || trg === 'ALLY_BATTLE_WIN' || trg === 'MAGIC_USED') && !(subj && fxMatch(CARDS[subj.id], e.match))) return false;
  if (e.subjBraved && !(subj && subj.brave && [subj, subj.brave].some(x => (CARDS[x.id].families || []).includes(e.subjBraved)))) return false;
  if (e.self && subj !== f && (trg === 'SOUL_PLACED' || trg === 'ALLY_LIFE_HIT')) return false;
  if (e.other && subj === f) return false;
  if (e.attackingOnly && (trg === 'BATTLE_WIN' || trg === 'ALLY_BATTLE_WIN') && !ctx.attacking) return false;     // v0.72 (During Attack) battle result: only as the attacker
  if (e.blockingOnly && (trg === 'BATTLE_WIN' || trg === 'ALLY_BATTLE_WIN') && ctx.attacking) return false;     // v0.74 (When Blocks) battle result: only as the blocker
  if (trg === 'ALLY_SUMMONED' && subj && CARDS[subj.id].type === 'Brave' && !(e.match && e.match.type === 'Brave')) return false;     // a Brave summon is not a Spirit summon (manual p. 35)
  if (e.once && usedThisTurn(owner, f, idx, e)) return false;
  if (!fxIf(owner, opp, e.if, ctx)) return false;
  return fxCan({ p: owner, opp, src: f, ctx }, e);
}
async function fireFxMulti(events) {
  if (!G || G.over) return;
  if (G.resolving > 0) { G.derivedQ = (G.derivedQ || []).concat(events); return; }     // derived: waits until the resolving effect has finished
  await resolvePool([].concat(...events.map(collectFx)));
  await braveSummonedEvs(events);                       // v0.47 Dana Draw: a set Burst that activates when a Brave is summoned
}
/* run fn as "an effect is resolving": triggers caused inside it are queued and resolved right after it */
async function asResolving(fn) {
  G.resolving = (G.resolving || 0) + 1;
  try { await fn(); } finally { G.resolving--; }
  await flushDerived();
}
async function flushDerived() {
  while (G && !G.over && !(G.resolving > 0) && G.derivedQ && G.derivedQ.length) {
    const evs = G.derivedQ.splice(0);
    await resolvePool([].concat(...evs.map(collectFx)));
    await braveSummonedEvs(evs);
  }
}
async function resolvePool(pending) {
  while (pending.length) {
    if (G.over) return;
    const cands = pending.filter(fxValid);
    if (!cands.length) return;
    const turnP = G.p[G.active];
    let chosen = cands.find(x => x.owner === turnP) || cands[0];                  // CPU turn player: its own effects first, in card order
    if (cands.length > 1 && !turnP.cpu) {
      const v = await ask({ title: '⚡ Order of triggered effects', peek: true, html: 'Several effects trigger at the same time. As the turn player, choose which one resolves first.',
        buttons: cands.map((x, i) => ({ label: `${x.owner === turnP ? '' : 'CPU · '}${CARDS[x.f.id].name}: [${FX_TRIGGER_TEXT[x.trg]}] ${fxDescribe(x.e)}`.slice(0, 120), cls: 'primary', value: i })) });
      chosen = cands[Number.isInteger(v) ? v : 0] || cands[0];
    }
    pending = cands.filter(x => x !== chosen);
    const { owner, opp, f, idx, e, trg, trigger, ctx } = chosen, card = CARDS[f.id], c = { p: owner, opp, src: f, ctx };
    if (e.optional && !owner.cpu) {
      const yes = await ask({ title: `✨ ${card.name}`, peek: true, html: `[${FX_TRIGGER_TEXT[trg]}] You can ${esc(fxDescribe(e))}.`,
        buttons: [{ label: 'Use effect', cls: 'primary', value: true }, { label: 'Skip', cls: 'cancel', value: false }] });
      if (!yes) continue;
    }
    if (e.once) markUsed(owner, f, idx, e);
    log(`${card.name}: [${trigger === 'ADVENT' && trg === 'SUMMONED' ? 'When Advents' : FX_TRIGGER_TEXT[trg]}] ${fxDescribe(e)}.`);
    G.resolving = (G.resolving || 0) + 1;
    try { await runActions(c, e, trigger === 'ADVENT' ? 'SUMMONED' : trg); } finally { G.resolving--; }
    io.view({ type: 'board' }); await wait(350);
    if (trg === 'SUMMONED' && (trigger === 'SUMMONED' || trigger === 'ADVENT') && !G.over) await maybeBurst(opp, trigger === 'ADVENT' ? 'OPP_ADVENT_FX' : 'OPP_SUMMON_FX', { summoned: f });   // v0.71: an Advent's (When Summoned) effect only answers the "/Advents" condition
    await flushBursts();
    await flushDerived();                                   // effects caused by this one resolve before the ones still pending
  }
}
/* ---- Contract Advent / Manifest (v0.14): Flash from the Hand, the Soul Core goes to the Trash ---- */
function soulCoreHolder(p, exceptUid) {                 // where the Soul Core can be taken from without depleting a Spirit
  if (p.reserve.soul) return 'reserve';
  const f = fieldList(p).find(x => x.soul && x.uid !== exceptUid && (!isSpiritForm(CARDS[x.id]) || spare(x) >= 1));
  return f || null;
}
function soulToTrash(p, holder) {
  if (holder === 'reserve') p.reserve.soul = false; else if (holder) holder.soul = false; else return false;
  p.trashCores.soul = true; log(`${poss(p)} Soul Core is sent to the Trash.`); return true;
}
/* v0.48 Seal (Eternal manual p.49): a Seal effect moves your Soul Core to your Life; you are Sealed while it is there ([During Seal]
   effects work). The Soul Core in Life counts as one of the Life cores (p.life includes it, p.lifeSoul marks it). When Life is reduced
   the player chooses which core leaves (p.49); engine choice for both players: normal cores first, so the Soul Core leaves only with the last Life core. */
const isSealed = p => !!(p && p.lifeSoul);
function soulToLife(p, holder) {
  if (!holder || p.lifeSoul) return false;
  if (holder === 'reserve') { if (!p.reserve.soul) return false; p.reserve.soul = false; }
  else if (holder === 'trash') { if (!p.trashCores.soul) return false; p.trashCores.soul = false; }
  else if (holder.soul) holder.soul = false; else return false;
  p.life++; p.lifeSoul = true; log(`${poss(p)} Soul Core is sent to the Life: Sealed.`); return true;
}
function lifeTake(p, m, dest) {                          // m Life cores leave to 'reserve' | 'trash' | a card on the Field; returns how many left
  m = Math.min(m, p.life); if (m <= 0) return 0;
  const soul = p.lifeSoul && m >= p.life, n = m - (soul ? 1 : 0);
  p.life -= m; if (soul) p.lifeSoul = false; p.lifeRedTurn = G.turnNo;      // v0.88 S1: condition lifeReduced
  if (dest === 'reserve') { p.reserve.n += n; if (soul) p.reserve.soul = true; }
  else if (dest === 'trash') { p.trashCores.n += n; if (soul) p.trashCores.soul = true; }
  else { dest.cores += n; if (soul) dest.soul = true; }
  if (soul) log(`${poss(p)} Soul Core leaves the Life: the Seal ends.`);
  return m;
}
/* official (Eternal manual, Cores and the Soul Core): the Soul Core can only be in the Reserve, on a card on the Field or in the Trash, never in the Void.
   soulSource = where "send your Soul Core to ..." takes it from (never from a Spirit it would deplete). */
function soulSource(p) {
  if (p.trashCores.soul) return 'trash';
  if (p.reserve.soul) return 'reserve';
  return fieldList(p).find(x => x.soul && (!isSpiritForm(CARDS[x.id]) || spare(x) >= 1)) || null;
}
async function soulToNexus(p, t) {
  const src = soulSource(p); if (!src || !p.nexus.includes(t) || t.soul || src === t) return false;
  if (src === 'trash') p.trashCores.soul = false; else if (src === 'reserve') p.reserve.soul = false; else src.soul = false;
  t.soul = true; log(`${poss(p)} Soul Core is sent to ${CARDS[t.id].name}.`); io.view({ type: 'board' }); await wait(300);
  if (!G.over) await fireFx(p, 'SOUL_PLACED', t, { subject: t });
  return true;
}
const advTiming = (p, spec, where) => where === 'flash' ? (spec.turn === 'EITHER' || G.active === p.key) : (G.active === p.key);
const soulAdventOK = (p, inst) => p.soulState.includes(inst) && p.csAdventTurn === G.turnNo && (CARDS[inst.id].families || []).includes('Awakened Dragon');   // Contract Field: this turn only
const cadvSources = p => p.hand.concat(p.csAdventTurn === G.turnNo ? p.soulState : []).filter(h => CARDS[h.id].contractAdvent);
function contractAdventTargets(p, inst, where) {
  const spec = CARDS[inst.id].contractAdvent; if (!spec || !(p.hand.includes(inst) || soulAdventOK(p, inst)) || !advTiming(p, spec, where)) return [];
  if (p.count < (spec.counterGe || 0)) return [];
  if (!summonOK(p, CARDS[inst.id])) return [];
  return p.spirits.filter(sp => !isUlt(sp) && (CARDS[sp.id].families || []).includes(spec.family) && !sp.under.includes(inst) && (sp.soul ? sp.cores >= minCores(CARDS[inst.id]) : soulCoreHolder(p, null) !== null));
}
async function doContractAdvent(p, adv, src, where) {
  if (!contractAdventTargets(p, adv, where || 'main').includes(src)) return false;
  const sh = src.soul ? src : soulCoreHolder(p, null);
  if (CARDS[adv.id].contractAdvent.seal) soulToLife(p, sh); else soulToTrash(p, sh);   // v0.48 Seal Contract Advent: the Soul Core goes to the Life
  const fromSoul = p.soulState.includes(adv);
  removeFrom(p.hand, adv); removeFrom(p.soulState, adv); adv.inSoulState = false;
  const idx = p.spirits.indexOf(src);
  adv.cores = src.cores; adv.soul = false; adv.exhausted = src.exhausted; adv.summonedTurn = src.summonedTurn; adv.bpMod = src.bpMod; adv.fxUsed = {};
  adv.under = src.under.concat([src]); src.under = []; src.cores = 0; src.soul = false; src.exhausted = false; src.heavy = false; src.noAB = false; src.bpMod = 0;
  p.spirits[idx] = adv;
  if (src.brave) { adv.brave = src.brave; src.brave = null; braveRecheck(p, adv); }
  log(`${who(p)} ${p.cpu ? 'performs' : 'perform'} ${CARDS[adv.id].contractAdvent.seal ? 'Seal ' : ''}Contract Advent${fromSoul ? ' from Soul State' : ''}: ${CARDS[adv.id].name} on ${CARDS[src.id].name}.`);
  if (fromSoul && p.reserve.n > 0) {                       // Contract Field: put any number of Reserve cores onto the adventing card
    let k = Math.min(p.reserve.n, 2);
    if (!p.cpu) {
      const mx = Math.min(p.reserve.n, 6), opts = [0, 1, 2, 3, mx].filter((v, i, a) => v <= mx && a.indexOf(v) === i);
      const v = await ask({ title: `✨ ${CARDS[adv.id].name}`, peek: true, html: 'Contract Field: put how many cores from your Reserve onto the adventing card?', buttons: opts.map(n => ({ label: n === mx && mx > 3 ? `All (${n})` : String(n), cls: n ? 'primary' : 'cancel', value: n })) });
      k = Number.isInteger(v) ? Math.min(v, p.reserve.n) : 0;
    }
    if (k > 0) { p.reserve.n -= k; adv.cores += k; log(`${CARDS[adv.id].name}: ${k} core${k === 1 ? '' : 's'} from the Reserve.`); }
  }
  checkDepletion(p);
  io.view({ type: 'board' }); await wait(450);
  if (!G.over && p.spirits.includes(adv)) await fireFx(p, 'ADVENT', adv);
  return true;
}
/* manifest.turn: 'YOURS' = (Your Turn), Main Step and your Flash Timings; 'EITHER_ATTACK' = (Either Attack Step), Flash Timings of either player's Attack Step; 'YOUR_ATTACK' = (Your Attack Step), Flash Timings of your own Attack Step (v0.38) */
function manifestTargets(p, inst, where) {
  const spec = CARDS[inst.id].manifest; if (!spec || !G || !p.hand.includes(inst) || p.count < (spec.counterGe || 0)) return [];
  if (spec.turn === 'YOUR_ATTACK' ? !(where === 'flash' && G.step === 5 && G.active === p.key) : spec.turn === 'EITHER_ATTACK' ? !(where === 'flash' && G.step === 5) : G.active !== p.key) return [];
  if (!canPlaceFree(p, inst) || soulCoreHolder(p, null) === null) return [];
  if (spec.ultra && p.onceUsed && p.onceUsed['ultra:' + CARDS[inst.id].name] === G.turnNo) return [];      // (Once per Turn: Same Name)
  return p.nexus.filter(n => CARDS[n.id].name.toLowerCase().includes(spec.name.toLowerCase()) && (spec.ultra || n.cores >= 1));
}
async function doManifest(p, inst, target, where) {
  if (!manifestTargets(p, inst, where || 'main').includes(target)) return false;
  if (CARDS[inst.id].manifest.ultra) {        // v0.46 Ultra Manifest (BS76-CP01 text): Soul Core onto this card, +1 core to the target, summon treating all costs as paid
    const h = soulCoreHolder(p, null); if (h === 'reserve') p.reserve.soul = false; else h.soul = false;
    p.onceUsed = p.onceUsed || {}; p.onceUsed['ultra:' + CARDS[inst.id].name] = G.turnNo;
    takeFromVoid(p, 1); target.cores++; log(`${who(p)} ${p.cpu ? 'performs' : 'perform'} Ultra Manifest: the Soul Core goes onto ${CARDS[inst.id].name}, +1 core to ${CARDS[target.id].name}.`);
    checkDepletion(p);
    await summonFree(p, inst, { manifest: true, soul: true });
    return true;
  }
  if (CARDS[inst.id].manifest.seal) soulToLife(p, soulCoreHolder(p, null));        // v0.48 Seal Manifest: Soul Core from the Field/Reserve to the Life
  else soulToTrash(p, soulCoreHolder(p, null));
  target.cores--; p.trashCores.n++; log(`${CARDS[target.id].name}: one core is paid to the Trash for the Manifest.`);
  checkDepletion(p);
  await summonFree(p, inst, { manifest: true });
  return true;
}
async function humanContractAdvent(inst, where) {
  const p = G.p.player, T = contractAdventTargets(p, inst, where); if (!T.length) { await info('Contract Advent not possible', 'You need a matching Spirit, enough counters and a Soul Core that can be sent to the Trash.'); return false; }
  const v = await ask({ title: `✨ ${CARDS[inst.id].name}`, peek: true, html: 'Contract Advent: your Soul Core goes to the Trash and this card stacks on the target. Choose the target.',
    buttons: T.map(t => ({ label: `${CARDS[t.id].name} (${bpOf(t)} BP)`, cls: 'purple', value: t.uid })).concat([{ label: 'Cancel', cls: 'cancel', value: null }]) });
  const t = T.find(x => x.uid === v); if (!t) return false;
  return doContractAdvent(p, inst, t, where);
}
async function humanManifest(inst, where) {
  const p = G.p.player, T = manifestTargets(p, inst, where || 'main'); if (!T.length) { await info('Manifest not possible', 'You need the named Nexus with a core on it, enough counters and a Soul Core that can be sent to the Trash.'); return false; }
  const v = await ask({ title: `✨ ${CARDS[inst.id].name}`, peek: true, html: 'Manifest: your Soul Core goes to the Trash, one core is paid from the target Nexus, and this card is summoned.',
    buttons: T.map(t => ({ label: `${CARDS[t.id].name} (${t.cores} cores)`, cls: 'purple', value: t.uid })).concat([{ label: 'Cancel', cls: 'cancel', value: null }]) });
  const t = T.find(x => x.uid === v); if (!t) return false;
  return doManifest(p, inst, t, where || 'main');
}
async function cpuAdvents(p) {
  for (let g = 0; g < 4 && !G.over; g++) {
    let did = false;
    for (const h of p.hand.concat(cadvSources(p).filter(x => p.soulState.includes(x)))) {
      const card = CARDS[h.id];
      let Mt = null, Ct = null;
      if (card.manifest) Mt = manifestTargets(p, h);
      else if (card.contractAdvent) Ct = contractAdventTargets(p, h, 'main').filter(t => CARDS[h.id].levels[0].bp > CARDS[t.id].levels[0].bp);
      if (Mt && Mt.length) {
        const v = await portCpu(p.key, 'advent', [h.uid]);                // v0.105.0 (M6 step 3): the host's cpuAnswer re-derives {uid, targetUid}
        const tg = v && v.uid === h.uid && v.targetUid != null ? Mt.find(t => t.uid === v.targetUid) : null;
        if (tg) { await doManifest(p, h, tg); did = true; }
        break;
      }
      if (Ct && Ct.length) {
        const v = await portCpu(p.key, 'advent', [h.uid]);
        const tg = v && v.uid === h.uid && v.targetUid != null ? Ct.find(t => t.uid === v.targetUid) : null;
        if (tg) { await doContractAdvent(p, h, tg, 'main'); did = true; }
        break;
      }
    }
    if (!did) break;
  }
}
/* ACTIVATE effects: a button on the field card (Main Step; Flash windows for Spirits are not wired yet) */
const onceKey = (f, idx) => `${f.id}#${idx}`;
/* e.onceKey (v0.33): effects of one card that share a name share one "once per turn" (e.g. "(When Summoned/Attacks) (Once per Turn)") */
function usedThisTurn(p, f, idx, e) { const k = e.onceKey || idx; return e.sameName ? !!p.onceUsed && p.onceUsed[onceKey(f, k)] === G.turnNo : !!f.fxUsed && f.fxUsed[k] === G.turnNo; }
function markUsed(p, f, idx, e) { const k = e.onceKey || idx; if (e.sameName) { p.onceUsed = p.onceUsed || {}; p.onceUsed[onceKey(f, k)] = G.turnNo; } else { f.fxUsed = f.fxUsed || {}; f.fxUsed[k] = G.turnNo; } }
/* v0.33 "When this card is revealed from the deck": resolved at once, while the revealing effect resolves, because the card would
   otherwise leave with the rest (the Eternal manual VER.17.0 gives no timing; chosen ruling, see docs/manual-notes.md). Optional for the human, the CPU always uses it. */
async function revealedFx(p) {
  if (!G || G.over) return;
  for (const x of p.revealed.slice()) {
    const card = CARDS[x.id]; if (!card.effects) continue;
    for (let idx = 0; idx < card.effects.length; idx++) {
      const e = card.effects[idx];
      if (e.trigger !== 'REVEALED' || G.over || !p.revealed.includes(x)) continue;
      const c = { p, opp: G.p[other(p.key)], src: x, ctx: {} };
      if (!fxIf(p, c.opp, e.if, c.ctx) || !fxCan(c, e)) continue;
      if (e.optional && !p.cpu) {
        const yes = await ask({ title: `✨ ${card.name}`, peek: true, html: `[${FX_TRIGGER_TEXT.REVEALED}] You can ${esc(fxDescribe(e))}.`,
          buttons: [{ label: 'Use effect', cls: 'primary', value: true }, { label: 'Skip', cls: 'cancel', value: false }] });
        if (!yes) continue;
      }
      log(`${card.name}: [${FX_TRIGGER_TEXT.REVEALED}] ${fxDescribe(e)}.`);
      await runActions(c, e, 'REVEALED');
      io.view({ type: 'board' }); await wait(300);
    }
  }
}
/* v0.35 Saga Brave on a Grandwalker Nexus (manual p. 38): the Nexus gains the Brave's [While Combined with a Nexus] effects (nexusBrave:true), indexed from 100 */
const NB_IDX = 100;
function actList(f) {
  const out = fxEntries(f).map(({ e, idx }) => ({ e, idx }));
  if (f.brave && CARDS[f.id].type === 'Nexus') (CARDS[f.brave.id].effects || []).forEach((e, j) => { if (e.nexusBrave) out.push({ e, idx: NB_IDX + j }); });
  return out;
}
function effAt(f, idx) { const x = actList(f).find(y => y.idx === idx); return x ? x.e : null; }
function activatable(p, f, timing) {
  const card = CARDS[f.id], out = [];
  if (!G || !fieldList(p).includes(f)) return out;
  const opp = G.p[other(p.key)], L = lvNo(f);
  actList(f).forEach(({ e, idx }) => {
    if (e.trigger !== 'ACTIVATE') return;
    if (timing && !e.timing.includes(timing)) return;
    if (e.lv && !e.nexusBrave && !e.lv.includes(L)) return;
    if (e.oc && !ocActive(f)) return;
    if (e.once && (e.oncePer === 'battle' ? usedThisBattle(f, idx) : usedThisTurn(p, f, idx, e))) return;
    if (e.invoke && (!invokeWhenOK(p, f, e.when) || !invokeCostOK(p, f, e.cost))) return;      // v0.68 Invoke: timing head + the cost paid in full (02l)
    const ctx = {};
    if (!fxIf(p, opp, e.if, ctx)) return;
    if (e.cost && ((e.cost.nexusToVoid && f.cores < e.cost.nexusToVoid) || (e.cost.exhaustSelf && f.exhausted))) return;
    if (!fxCan({ p, opp, src: f, ctx }, e)) return;
    out.push({ idx, e });
  });
  return out;
}
async function activateFx(p, f, idx) {
  const card = CARDS[f.id], e = effAt(f, idx);
  if (!e || !activatable(p, f).some(x => x.idx === idx)) return false;
  const opp = G.p[other(p.key)];
  if (e.cost && e.cost.nexusToVoid) { f.cores -= e.cost.nexusToVoid; p.void += e.cost.nexusToVoid; log(`${card.name}: ${e.cost.nexusToVoid} cores are sent to the Void.`); }
  if (e.cost && e.cost.exhaustSelf) { f.exhausted = true; log(`${card.name} is exhausted.`); }
  if (e.invoke && !(await payInvokeCost(p, f, e.cost))) return false;      // v0.68: part A must resolve in full (Std FAQ on Effects Q11)
  if (e.oncePer === 'battle') markUsedBattle(f, idx); else markUsed(p, f, idx, e);      // marked after a paid cost (A7 review)
  log(`${card.name}: [${e.invoke ? 'Invoke' : 'Activate'}] ${fxDescribe(e)}.`);
  await asResolving(() => runActions({ p, opp, src: f, ctx: {} }, e, 'ACTIVATE'));
  checkDepletion(p); checkDepletion(opp);
  if (e.silverWheel && !G.over) await fireFx(p, 'SILVER_WHEEL', f);   // v0.50: "when you activate Silver Wheel"
  io.view({ type: 'board' }); await wait(350); await flushBursts();
  return true;
}
async function cpuActivate(p) {
  for (let g = 0; g < 8 && !G.over; g++) {
    let did = false;
    for (const f of fieldList(p).slice()) {
      const a = activatable(p, f, 'MAIN').find(x => !x.e.cpuSkip && !x.e.silverWheel && (!x.e.invoke || cpuInvokeOK(p, f, x.e, 'MAIN')));   // v0.50: Silver Wheel waits for the opposing Attack Step (cpuSilverWheel)
      if (!a) continue;
      const v = await portCpu(p.key, 'activate', [f.uid]);                // v0.105.0 (M6 step 3): the host's cpuAnswer re-derives {uid, idx}
      if (v && v.idx === a.idx) { await activateFx(p, f, v.idx); did = true; }
      break;
    }
    if (!did) break;
  }
}

/* Revive [Main] (Once per Turn: Same Name): deploy this card from Soul State */
const reviveKey = inst => `revive:${CARDS[inst.id].name}`;
function reviveTargets(p) {
  if (!G || G.over || G.active !== p.key || !(G.step === 4 || (G.format === 'standard' && G.step === 6))) return [];
  return p.soulState.filter(x => CARDS[x.id].revive && canPlacePaid(p, x) && !(p.onceUsed && p.onceUsed[reviveKey(x)] === G.turnNo));
}
async function doRevive(p, inst) {
  if (!reviveTargets(p).includes(inst)) return false;
  p.onceUsed = p.onceUsed || {}; p.onceUsed[reviveKey(inst)] = G.turnNo;
  log(`${CARDS[inst.id].name}: [Revive] ${who(p)} ${p.cpu ? 'deploys' : 'deploy'} it from Soul State (paying its cost).`);
  const ok = await summonPaid(p, inst);
  if (!ok) { delete p.onceUsed[reviveKey(inst)]; return false; }
  io.view({ type: 'board' }); await wait(300); await flushBursts();
  return true;
}
async function cpuRevive(p) {
  for (let g = 0; g < 3 && !G.over; g++) {
    const T = reviveTargets(p);
    if (!T.length) break;
    const v = await portCpu(p.key, 'revive', [T[0].uid]);                // v0.105.0 (M6 step 3): the host's cpuAnswer re-derives the uid
    const t = T.find(x => x.uid === v);
    if (!t) break;
    await doRevive(p, t);
  }
}

