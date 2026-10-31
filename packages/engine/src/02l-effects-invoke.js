/* ---------------------------------------------------------------------
   v0.68 INVOKE (Standard activations): "{{Invoke|Flash}}" / "{{Invoke|Main}}" + "<cost> ▶ <effect>".
   Rules (Standard manual "FAQ on Effects" Q11; data/glossary/mechanics.json kind:invoke): the part before ▶ is the cost; it must
   resolve in full, otherwise the effect is not used at all (never "as much as possible"). The template gives the timing
   (Flash = every Flash Timing and also your Main Step; Main = your Main Step); a printed step / (During Attack) / (During Block)
   head narrows it; limits only when printed: (Once Per Turn), (Once Per Battle), "only once per turn with the same card name".
   Engine form: ACTIVATE {invoke:true, timing, when, once, oncePer:'battle', cost:{pay|exhaustSelf|destroySelf|exhaustOwn|discard}};
   activatable / activateFx (02d) call the helpers below; the battle counter G.battleNo and G.blocker come from 08-battle.
   Also the battle-length BP (inst.bpB, read by bpOf) and two own-target actions: BP_TARGET, SYMBOL_TARGET; and extra filters on
   DESTROY (exhaustedOnly) and BOUNCE_OPP (bpLe, attackingOnly) for the sentences these cards print.
   --------------------------------------------------------------------- */
const INVOKE_WHEN = {
  yourAttack: (p) => G.step === 5 && G.active === p.key,          // (Your Attack Step)
  oppAttack: (p) => G.step === 5 && G.active !== p.key,           // (Opposing Attack Step)
  eitherAttack: () => G.step === 5,                                // (Either Attack Step)
  yourTurn: (p) => G.active === p.key,                             // (Your Turn)
  duringAttack: (p, f) => !!G.attacker && G.attacker === f,        // (During Attack): while this Spirit is attacking
  duringBlock: (p, f) => !!G.blocker && G.blocker === f,           // (During Block): while this Spirit is blocking
  duringAttackBlock: (p, f) => (!!G.attacker && G.attacker === f) || (!!G.blocker && G.blocker === f),
};
const INVOKE_COSTS = ['pay', 'exhaustSelf', 'destroySelf', 'exhaustOwn', 'discard', 'returnSelf', 'returnOwn', 'destroyOwn', 'soulToTrash'];      // v0.184: returnSelf / returnOwn = "Return <this / one of your X> to the deckbottom"
const invokeMatchOK = m => m == null || (typeof m === 'object' && (m.family == null || (Array.isArray(m.family) && m.family.length > 0 && m.family.every(x => typeof x === 'string' && x)))
  && (m.name == null || (Array.isArray(m.name) && m.name.length > 0 && m.name.every(x => typeof x === 'string' && x)))      // v0.169: a card-name list ("Kamen Rider Bravo")
  && (m.costGe == null || Number.isInteger(m.costGe)) && (m.costLe == null || Number.isInteger(m.costLe)) && (m.costIn == null || (Array.isArray(m.costIn) && m.costIn.length > 0 && m.costIn.every(Number.isInteger))) && (m.type == null || ['Spirit', 'Nexus', 'Magic', 'Ultimate'].includes(m.type)) && (m.color == null || COLORS.includes(m.color)) && (m.tr == null || m.tr === true));
/* parse hook (02c): returns an error text or null; copies the checked fields onto o */
function invokeParse(e, o) {
  o.invoke = true;
  o.once = e.once === true || e.oncePer === 'battle' || !!e.sameName;      // limits only when printed (A7 review): no "once" key = unlimited
  if (e.when != null) { if (!INVOKE_WHEN[e.when]) return `Invoke "when" must be one of ${Object.keys(INVOKE_WHEN).join(', ')}`; o.when = e.when; }
  if (e.oncePer != null) { if (e.oncePer !== 'battle') return 'Invoke "oncePer" must be "battle"'; o.oncePer = 'battle'; o.once = true; }
  if (e.cost == null) return null;
  const c = e.cost;
  if (typeof c !== 'object' || Object.keys(c).length !== 1 || !INVOKE_COSTS.includes(Object.keys(c)[0])) return `Invoke "cost" must have exactly one of ${INVOKE_COSTS.join(', ')}`;
  if (c.pay != null && !(Number.isInteger(c.pay) && c.pay >= 1 && c.pay <= 5)) return 'Invoke cost "pay" must be 1-5';
  if ((c.exhaustSelf != null && c.exhaustSelf !== true) || (c.destroySelf != null && c.destroySelf !== true)) return 'Invoke cost exhaustSelf / destroySelf must be true';
  if (c.returnSelf != null && c.returnSelf !== true) return 'Invoke cost returnSelf must be true';
  if (c.soulToTrash != null && c.soulToTrash !== true) return 'Invoke cost soulToTrash must be true';      // v170 "Send your Soul Core to the Trash"
  if (c.returnOwn != null && !(typeof c.returnOwn === 'object' && ['nexus', 'spirit'].includes(c.returnOwn.kind) && invokeMatchOK(c.returnOwn.match) && (c.returnOwn.toHand == null || c.returnOwn.toHand === true))) return 'Invoke cost "returnOwn" must look like {"kind":"nexus","match":{"family":["X"]}}';
  if (c.exhaustOwn != null && !(typeof c.exhaustOwn === 'object' && ['nexus', 'spirit'].includes(c.exhaustOwn.kind) && invokeMatchOK(c.exhaustOwn.match) && (c.exhaustOwn.n == null || (Number.isInteger(c.exhaustOwn.n) && c.exhaustOwn.n >= 2 && c.exhaustOwn.n <= 3)))) return 'Invoke cost "exhaustOwn" must look like {"kind":"nexus","match":{"family":["X"]}}';
  if (c.destroyOwn != null && !(typeof c.destroyOwn === 'object' && ['nexus', 'spirit'].includes(c.destroyOwn.kind) && invokeMatchOK(c.destroyOwn.match))) return 'Invoke cost "destroyOwn" must look like {"kind":"nexus","match":{"family":["X"]}}';
  if (c.discard != null && !(typeof c.discard === 'object' && invokeMatchOK(c.discard.match))) return 'Invoke cost "discard" must look like {"match":{"family":["X"]}}';
  o.cost = JSON.parse(JSON.stringify(c));
  return null;
}
const invokeWhenOK = (p, f, w) => !w || (!!G && !!INVOKE_WHEN[w] && INVOKE_WHEN[w](p, f));
const exhaustOwnCands = (p, f, x) => (x.kind === 'nexus' ? p.nexus : p.spirits).filter(t => !t.exhausted && fxMatch(CARDS[t.id], x.match));
const returnOwnCands = (p, x) => (x.kind === 'nexus' ? p.nexus : p.spirits).filter(t => fxMatch(CARDS[t.id], x.match));
const discardCands = (p, x) => p.hand.filter(h => fxMatch(CARDS[h.id], x.match));
function invokeCostOK(p, f, c) {
  if (!c) return true;
  if (c.pay) return coresAvailable(p) >= c.pay;
  if (c.exhaustSelf) return !f.exhausted;
  if (c.destroySelf) return p.spirits.includes(f) || p.nexus.includes(f);
  if (c.exhaustOwn) return exhaustOwnCands(p, f, c.exhaustOwn).length >= (c.exhaustOwn.n || 1);
  if (c.returnSelf) return p.spirits.includes(f) || p.nexus.includes(f);
  if (c.returnOwn) return returnOwnCands(p, c.returnOwn).length > 0;
  if (c.destroyOwn) return returnOwnCands(p, c.destroyOwn).length > 0;
  if (c.discard) return discardCands(p, c.discard).length > 0;
  if (c.soulToTrash) return !!soulCoreHolder(p, null);
  return false;
}
/* pays the cost (exhaustSelf was already paid by activateFx); false = could not be paid in full, nothing else happens */
async function payInvokeCost(p, f, c) {
  if (!c || c.exhaustSelf) return true;
  const nm = CARDS[f.id].name;
  if (c.pay) {
    if (coresAvailable(p) < c.pay) return false;
    const got = takeCores(p, c.pay, f.uid);      // Reserve first, never the Invoke source itself (A7 review); the cores go to the Trash
    if (got.n + (got.soul ? 1 : 0) < c.pay) return false;
    p.trashCores.n += got.n; if (got.soul) p.trashCores.soul = true; log(`${nm}: ${who(p)} ${p.cpu ? 'pays' : 'pay'} ${c.pay} cost${c.pay === 1 ? '' : 's'}.`); checkDepletion(p); return true;
  }
  if (c.destroySelf) {
    if (p.nexus.includes(f)) removeNexus(p, f, 'destroyed'); else if (p.spirits.includes(f)) removeSpirit(p, f, 'destroyed', false); else return false;
    return true;
  }
  if (c.soulToTrash) return soulToTrash(p, soulCoreHolder(p, null));
  if (c.returnSelf) {
    if (!p.spirits.includes(f) && !p.nexus.includes(f)) return false;
    bounceCard(p, f, 'deckBottom'); return true;
  }
  if (c.returnOwn) {
    const L = returnOwnCands(p, c.returnOwn); if (!L.length) return false;
    const t = p.cpu ? L.slice().sort((a, b) => (a.cores - b.cores))[0]
      : await fxPickTarget({ p, opp: G.p[other(p.key)], src: f, ctx: {} }, L, `✨ <b>${esc(nm)}</b><br>Tap one of your ${c.returnOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'} to return to the ${c.returnOwn.toHand ? 'Hand' : 'deckbottom'} (the cost).`);
    if (!t) return false;
    bounceCard(p, t, c.returnOwn.toHand ? 'hand' : 'deckBottom'); return true;      // v180 toHand
  }
  if (c.destroyOwn) {
    const L = returnOwnCands(p, c.destroyOwn); if (!L.length) return false;
    const t = p.cpu ? L.slice().sort((a, b) => (a.cores - b.cores))[0]
      : await fxPickTarget({ p, opp: G.p[other(p.key)], src: f, ctx: {} }, L, `✨ <b>${esc(nm)}</b><br>Tap one of your ${c.destroyOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'} to destroy (the cost).`);
    if (!t) return false;
    if (c.destroyOwn.kind === 'nexus') removeNexus(p, t, 'destroyed'); else removeSpirit(p, t, 'destroyed', false); return true;
  }
  if (c.exhaustOwn) {
    if (exhaustOwnCands(p, f, c.exhaustOwn).length < (c.exhaustOwn.n || 1)) return false;
    for (let i = 0; i < (c.exhaustOwn.n || 1); i++) {      // v174 exhaustOwn.n: "exhaust two of your X Nexuses"
      const L = exhaustOwnCands(p, f, c.exhaustOwn);
      const t = p.cpu ? L.slice().sort((a, b) => +(a === f) - +(b === f) || (a.cores - b.cores))[0]
        : await fxPickTarget({ p, opp: G.p[other(p.key)], src: f, ctx: {} }, L, `✨ <b>${esc(nm)}</b><br>Tap one of your refreshed ${c.exhaustOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'} to exhaust (the cost).`);
      if (!t) return false;
      t.exhausted = true; log(`${nm}: ${CARDS[t.id].name} is exhausted (cost).`);
    }
    return true;
  }
  if (c.discard) {
    const L = discardCands(p, c.discard); if (!L.length) return false;
    let t;
    if (p.cpu) t = L.slice().sort((a, b) => CARDS[a.id].cost - CARDS[b.id].cost)[0];
    else {
      const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
      const id = await ask({ title: `✨ ${nm}`, peek: true, wide: true, html: 'Choose a card to discard from your Hand (the cost).', cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
      t = L.find(x => x.id === id) || L[0];
    }
    removeFrom(p.hand, t); p.trash.push(t); log(`${nm}: ${who(p)} ${p.cpu ? 'discards' : 'discard'} ${CARDS[t.id].name} (cost).`); return true;
  }
  return false;
}
/* (Once Per Battle) */
const usedThisBattle = (f, idx) => !!G && !!f.fxBattle && f.fxBattle[idx] === G.battleNo;
function markUsedBattle(f, idx) { f.fxBattle = f.fxBattle || {}; f.fxBattle[idx] = G.battleNo; }
/* "during this battle" BP: counted while that battle lasts (G.battleNo and an attacker) */
const bpBattle = i => (i.bpB && G && G.attacker && i.bpB.b === G.battleNo ? i.bpB.n : 0);
function addBattleBp(s, n) { if (!(s.bpB && s.bpB.b === G.battleNo)) s.bpB = { n: 0, b: G.battleNo }; s.bpB.n += n; }
const invokeCostText = c => !c ? '' : c.pay ? `pay ${c.pay} cost${c.pay === 1 ? '' : 's'}` : c.exhaustSelf ? 'exhaust this card' : c.destroySelf ? 'destroy this card'
  : c.exhaustOwn ? `exhaust one of your ${c.exhaustOwn.match && c.exhaustOwn.match.family ? '"' + c.exhaustOwn.match.family.join('"/"') + '" ' : ''}${c.exhaustOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'}`
  : c.returnSelf ? 'return this card to the deckbottom' : c.returnOwn ? `return one of your ${c.returnOwn.match && c.returnOwn.match.family ? '"' + c.returnOwn.match.family.join('"/"') + '" ' : ''}${c.returnOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'} to the ${c.returnOwn.toHand ? 'Hand' : 'deckbottom'}`
  : c.destroyOwn ? `destroy one of your ${c.destroyOwn.match && c.destroyOwn.match.family ? '"' + c.destroyOwn.match.family.join('"/"') + '" ' : ''}${c.destroyOwn.kind === 'nexus' ? 'Nexuses' : 'Spirits'}`
  : c.discard ? `discard a ${c.discard.match && c.discard.match.family ? '"' + c.discard.match.family.join('"/"') + '" family ' : ''}card` : '';
const ownTargetCands = (c, a) => c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match, s) && (!a.match || !a.match.tr || (CARDS[s.id].trueRelease && lvNo(s) >= 2)) && (!a.attacking || s === G.attacker) && (!a.coreFromSelf || s !== c.src) && (!a.other || s !== c.src) && !fxImmune(c.p, s, c));
Object.assign(FX_ACTIONS, {
  /* "during this battle/turn, this Spirit gains +N BP" (to:self) / "Target one of your [attacking] X Spirits. ... it gains +N BP" (to:pick) */
  BP_TARGET: { chk: a => Number.isInteger(a.n) && a.n >= 1000 && a.n <= 30000 && ['self', 'pick'].includes(a.to) && (a.battle == null || a.battle === true) && (a.attacking == null || a.attacking === true) && invokeMatchOK(a.match) && (a.per == null || perOk(a.per)) && (a.alt == null || (a.to === 'pick' && typeof a.alt.name === 'string' && Number.isInteger(a.alt.n) && a.alt.n > a.n && a.alt.n <= 30000)),
    txt: a => `${a.to === 'self' ? 'this Spirit gains' : 'one of your ' + (a.attacking ? 'attacking ' : '') + (a.match && a.match.family ? '"' + a.match.family.join('"/"') + '" ' : '') + 'Spirits gains'} +${a.n} BP${a.per ? ' for each matching card you control' : ''} during this ${a.battle ? 'battle' : 'turn'}`,
    can: (c, a) => (!a.battle || !!G.attacker) && (a.to === 'self' ? c.p.spirits.includes(c.src) : ownTargetCands(c, a).length > 0),
    run: async (c, a) => {
      let t = c.src;
      if (a.to === 'pick') {
        const L = ownTargetCands(c, a); if (!L.length) { c.ctx.did = false; return; }
        const fight = L.find(s => s === G.attacker || s === G.blocker);       // the CPU boosts its own fighting Spirit first
        t = c.p.cpu && fight ? fight : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to get +${a.n} BP (glowing).`);
        if (!t) { c.ctx.did = false; return; }
      } else if (!c.p.spirits.includes(t)) { c.ctx.did = false; return; }
      c.ctx.picked = t;      // v0.88 S1: "When this battle ends, destroy it" (DESTROY_PICKED, 02p)
      const n = a.per ? a.n * perCount(c.p, a.per) : a.alt && CARDS[t.id].name.includes(a.alt.name) ? a.alt.n : a.n;      // v0.195 alt: "If that's <name>, give it +M instead"; v0.120.0 Amplify: "for each <family> Spirit you control" (the source itself counts)
      if (a.battle) addBattleBp(t, n); else t.bpMod = (t.bpMod || 0) + n;
      log(`${CARDS[t.id].name} gets +${n} BP during this ${a.battle ? 'battle' : 'turn'}.`);
    } },
  /* "Target one of your X Spirits. During this battle, it gains an extra <colour> symbol." (cleared when the battle ends, like SYMBOL_PLUS) */
  SYMBOL_TARGET: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3 && invokeMatchOK(a.match) && (a.attacking == null || a.attacking === true) && (a.color == null || COLORS.includes(a.color)) && (a.lock == null || a.lock === true),      // v189 color: "two Red symbols"; lock: "The number of symbols can't increase except via this effect"
    txt: a => `one of your ${a.match && a.match.family ? '"' + a.match.family.join('"/"') + '" ' : ''}${a.match && a.match.costGe != null ? 'Cost ' + a.match.costGe + '+ ' : ''}Spirits gains ${a.n} extra ${a.color ? a.color + ' ' : ''}symbol${a.n === 1 ? '' : 's'} during this battle`,
    can: (c, a) => !!G.attacker && ownTargetCands(c, a).length > 0,
    run: async (c, a) => {
      const L = ownTargetCands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu ? (L.find(s => s === G.attacker) || L[0]) : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to gain an extra symbol (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      t.symBattle = (t.symBattle || 0) + a.n;
      if (a.lock) { t.symLockBattle = G.battleNo; t.symLockN = a.n; }      // v189 the printed cap: only this effect raises the symbol count this battle
      log(`${CARDS[t.id].name} gains ${a.n} extra ${a.color ? a.color + ' ' : ''}symbol${a.n === 1 ? '' : 's'} during this battle.`);
    } },
});
/* extra filters on existing actions (wrapped here so the Invoke sentences stay in one module) */
(() => {
  const D = FX_ACTIONS.DESTROY, dChk = D.chk, dCands = D.cands, dTxt = D.txt;
  // v0.75: exhaustedOnly alone ("Destroy an opposing exhausted Spirit/Ultimate") = no BP/cost bound
  const anyB = a => a.exhaustedOnly === true && !['nexus', 'bpLe', 'bpLeAttacker', 'symbolsLe', 'bpLeReturned', 'familyInOppTrash', 'costLe', 'costLeSelf', 'costLeDiscarded', 'costRank', 'coresLe'].some(k => a[k] != null);
  const unb = a => Object.assign({}, a, { exhaustedOnly: undefined }, anyB(a) ? { bpLe: 1e9 } : {});
  D.chk = a => (a.exhaustedOnly == null || a.exhaustedOnly === true) && dChk(unb(a));
  D.cands = (c, a) => { const L = dCands(c, unb(a)); return a.exhaustedOnly ? L.filter(t => t.exhausted) : L; };
  D.txt = a => anyB(a) ? 'destroy 1 opposing exhausted Spirit/Ultimate' + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed target can't activate" : '') : dTxt(a) + (a.exhaustedOnly ? ' (exhausted only)' : '');
  const B = FX_ACTIONS.BOUNCE_OPP, bChk = B.chk, bCands = B.cands, bTxt = B.txt;
  B.chk = a => (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0)) && (a.attackingOnly == null || a.attackingOnly === true) && bChk(a);
  B.cands = (c, a) => bCands(c, a).filter(t => (a.bpLe == null || bpOf(t) <= a.bpLe + (a.bpPer ? a.bpPer.n * c.p.spirits.filter(x => cardHasKeyword(CARDS[x.id], a.bpPer.keyword)).length : 0)) && (!a.attackingOnly || t === G.attacker));
  B.txt = a => bTxt(a).replace(/^return an opposing /, `return an opposing ${a.attackingOnly ? 'attacking ' : ''}`) + (a.bpLe != null ? ` (${a.bpLe} BP or less)` : '');
})();
/* v0.169 "Target one of your "X". Send a core, besides <Soul Core>, from this Spirit to it, and during this battle, it gains +N BP." = BP_TARGET (to:pick, battle) with coreFromSelf:
   one normal core moves from this Spirit to the target first (the Soul Core stays); the source may be depleted by it (the player's choice; the CPU avoids it). */
(() => {
  const T = FX_ACTIONS.BP_TARGET, tChk = T.chk, tCan = T.can, tRun = T.run, tTxt = T.txt;
  T.chk = a => (a.coreFromSelf == null || (a.coreFromSelf === true && a.to === 'pick')) && tChk(a);
  T.txt = a => tTxt(a) + (a.coreFromSelf ? ' (a core is sent from this Spirit to it first)' : '');
  T.can = (c, a) => tCan(c, a) && (!a.coreFromSelf || (c.p.spirits.includes(c.src) && c.src.cores > 0));
  T.run = async (c, a) => {
    if (!a.coreFromSelf) return tRun(c, a);
    const L = ownTargetCands(c, a);
    if (!L.length || !c.p.spirits.includes(c.src) || c.src.cores < 1) { c.ctx.did = false; return; }
    const fight = L.find(s => s === G.attacker || s === G.blocker);
    const t = c.p.cpu && fight ? fight : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits to receive a core and +${a.n} BP (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    coreEvN(c.p, c.src.uid, t.uid, 1, false); c.src.cores--; t.cores++;
    log(`${CARDS[c.src.id].name}: a core moves to ${CARDS[t.id].name}.`);
    checkDepletion(c.p);
    c.ctx.picked = t; addBattleBp(t, a.n);
    log(`${CARDS[t.id].name} gets +${a.n} BP during this battle.`);
  };
})();
/* CPU: use an Invoke only when it clearly helps (timing is 'MAIN' or 'FLASH'; in a Flash Timing G.attacker / G.blocker are the fighters) */
function cpuInvokeOK(p, f, e, timing) {
  const c = e.cost || {}, acts = e.actions.map(a => a.do), opp = G.p[other(p.key)];
  if (c.pay && coresAvailable(p) - c.pay < 1) return false;
  const rt = e.actions.find(x => x.do === 'RETURN_TRASH'), mine = CARDS[f.id].cost;
  const better = !!rt && p.trash.some(t => (rt.anyType || CARDS[t.id].type === 'Spirit') && fxMatch(CARDS[t.id], rt.match) && CARDS[t.id].cost > mine);
  if (c.destroySelf && !acts.some(x => x === 'DESTROY' || x === 'BOUNCE_OPP') && !better) return false;     // trade the card for an opposing card, or for a stronger card from the Trash (A6 note)
  if (c.exhaustSelf && timing === 'MAIN' && p.spirits.includes(f) && G.active === p.key) return false;   // keep the Spirit ready to attack
  if (acts.some(x => x === 'BP_TARGET')) {
    if (timing !== 'FLASH' || !G.attacker || !G.blocker) return false;
    const mine = G.active === p.key ? G.attacker : G.blocker, theirs = mine === G.attacker ? G.blocker : G.attacker;
    if (!p.spirits.includes(mine) || !opp.spirits.includes(theirs)) return false;
    const a = e.actions.find(x => x.do === 'BP_TARGET');
    if (a.coreFromSelf && (f.cores < 1 || totalCores(f) - 1 < CARDS[f.id].levels[0].cores)) return false;      // v0.169: do not deplete the Spirit that pays the core
    if (a.to === 'self' && mine !== f) return false;
    if (a.to === 'pick' && !ownTargetCands({ p, opp, src: f, ctx: {} }, a).includes(mine)) return false;
    const me = bpOf(mine), them = bpOf(theirs), n = e.actions.filter(x => x.do === 'BP_TARGET').reduce((t, x) => t + x.n * (x.per ? perCount(p, x.per) : 1), 0);      // v0.120.0 Amplify per-count
    return me <= them && me + n > them;
  }
  if (acts.some(x => x === 'SYMBOL_TARGET' || x === 'SYMBOL_PLUS')) {
    if (timing !== 'FLASH' || G.active !== p.key || !G.attacker || G.blocker) return false;
    return !opp.spirits.some(s => !s.exhausted && !s.noAB);      // the extra symbol only matters if the attack goes through
  }
  return acts.every(x => ['DRAW', 'DESTROY', 'BOUNCE_OPP', 'RETURN_TRASH', 'REFRESH', 'REFRESH_SPIRIT', 'VOID_TO_RESERVE', 'VOID_TO_CARD', 'EXHAUST_OPP', 'HEAVY_EXHAUST_OPP', 'BP_MINUS', 'OPP_CORES_TO_RESERVE', 'NEXUS_AS_SPIRIT'].includes(x));      // v189 NEXUS_AS_SPIRIT (X15 "treated as a Spirit this step")
}
/* v0.68 "Target an opposing Spirit. During this turn, give it -N BP. Then, if it has 0 BP, destroy it." (BP_MINUS zeroDestroy):
   in Standard a Spirit at 0 BP is not destroyed by the rules (Eternal manual FAQ p. 68, as in v0.55), only by this text */
(() => {
  const M = FX_ACTIONS.BP_MINUS, mChk = M.chk, mRun = M.run, mTxt = M.txt;
  M.chk = a => (a.zeroDestroy == null || a.zeroDestroy === true) && (a.zeroBottom == null || a.zeroBottom === true) && (a.all == null || a.all === true) && (a.nPer == null || (a.nPer && /^[A-Za-z ]{3,30}$/.test(a.nPer.team) && Number.isInteger(a.nPer.n) && a.nPer.n >= 1000 && a.nPer.n <= 5000 && a.nPer.n % 1000 === 0)) && (a.nLegacy == null || (Number.isInteger(a.nLegacy) && a.nLegacy >= 1000 && a.nLegacy <= 5000 && a.nLegacy % 1000 === 0)) && mChk(a);      // v0.195 nLegacy: "for each EX Symbol banished via this Legacy, BP- decreases n further"; nPer: "for each <team> Spirit you control, BP- decreases n further"
  M.txt = a => mTxt(a) + (a.zeroDestroy ? ', then destroy it if it has 0 BP' : '') + (a.zeroBottom ? ', then return it to the deckbottom if it has 0 BP' : '');
  M.run = async (c, a) => {
    const before = new Map(c.opp.spirits.map(t => [t, t.bpMod || 0]));
    if (a.all) {      // v0.197 "give every opposing Spirit -N BP"
      const L = c.opp.spirits.filter(t => !fxImmune(c.opp, t, c)); if (!L.length) { c.ctx.did = false; return; }
      for (const t of L) { t.bpMod = (t.bpMod || 0) - a.n; before.set(t, (t.bpMod || 0) + a.n); }
      log(`${_nm(c)}: every opposing Spirit gets -${a.n} BP.`);
    } else await mRun(c, a.nPer || a.nLegacy ? { ...a, n: a.n + (a.nPer ? a.nPer.n * c.p.spirits.filter(x => cardTeams(CARDS[x.id]).includes(a.nPer.team)).length : 0) + (a.nLegacy ? a.nLegacy * (c.src.legacyN || 0) : 0) } : a);
    if (!a.zeroDestroy && !a.zeroBottom) return;
    for (const t of c.opp.spirits.slice()) if (before.has(t) && (t.bpMod || 0) < before.get(t) && bpOf(t) === 0 && !fxImmune(c.opp, t, c)) { if (a.zeroBottom) bounceCard(c.opp, t, 'deckBottom'); else removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); }      // v180 zeroBottom
  };
})();
/* v0.196 "Target a "X" family Spirit you control. During this turn, it can't be blocked." (turn number mark read by the block list in 08-battle) */
FX_ACTIONS.UNBLOCKABLE_PICK = { chk: a => invokeMatchOK(a.match) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000 && a.bpLe <= 30000)) && (a.costGe == null || (a.bpLe == null && Number.isInteger(a.costGe) && a.costGe >= 1 && a.costGe <= 20)) && (a.other == null || a.other === true),
  txt: a => `one of your ${a.match && a.match.family ? '"' + a.match.family.join('"/"') + '" ' : ''}Spirits can't be blocked during this turn`,
  can: (c, a) => ownTargetCands(c, a).length > 0,
  run: async (c, a) => {
    const L = ownTargetCands(c, a); if (!L.length) { c.ctx.did = false; return; }
    const t = c.p.cpu ? L.reduce((m, s) => bpOf(s) > bpOf(m) ? s : m) : await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap one of your Spirits that can't be blocked this turn (glowing).`);
    if (!t) { c.ctx.did = false; return; }
    if (a.costGe != null) t.noBlockTurnCost = { turn: G.turnNo, costGe: a.costGe }; else if (a.bpLe != null) t.noBlockTurnBp = { turn: G.turnNo, bpLe: a.bpLe }; else t.noBlockTurn = G.turnNo;      // v157 bpLe: "can't be blocked by opposing N BP or less Spirits" (turn-long)
    log(`${CARDS[t.id].name} can't be blocked during this turn.`);
  } };
