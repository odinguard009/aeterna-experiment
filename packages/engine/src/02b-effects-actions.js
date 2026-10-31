const FX_ACTIONS = {
  BOUNCE_OPP: { chk: a => ['hand', 'deckBottom'].includes(a.to) && ['spirit', 'any', 'nexus'].includes(a.kind) && (a.lv == null || (Array.isArray(a.lv) && a.lv.length > 0 && a.lv.every(x => Number.isInteger(x) && x >= 1 && x <= 4))) && (a.notColor == null || typeof a.notColor === 'string') && (a.costLeSubject == null || a.costLeSubject === true) && (a.exhaustedOnly == null || a.exhaustedOnly === true) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000 && a.bpLe <= 100000)) && (a.n == null || (Number.isInteger(a.n) && a.n >= 2 && a.n <= 3)) && (a.upTo == null || (a.upTo === true && a.n != null)) && (a.spiritCore == null || (a.spiritCore === true && a.kind === 'any' && a.n == null)) && (a.nexusSymbol == null || (COLORS.includes(a.nexusSymbol) && a.kind === 'any' && a.n == null)) && (a.bpPer == null || (a.bpLe != null && Number.isInteger(a.bpPer.n) && typeof a.bpPer.keyword === 'string')),      // v0.197 spiritCore / nexusSymbol (Gigantocheires); v0.195 bpLe ("3000 BP or less") and n ("Target two opposing ...": exactly n distinct targets)
    txt: a => `return ${a.n || 'an'} opposing ${a.lv ? 'LV' + a.lv.join('/') + ' ' : ''}${a.kind === 'any' ? 'Spirit/Nexus' : 'Spirit'}${a.costLeSubject ? ' with cost equal or inferior to the attacking card' : ''}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''}${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' : ''} to the ${a.to === 'hand' ? 'Hand' : 'bottom of the Deck'}`,
    cands: (c, a) => {
      const sub = c.ctx.subject || c.ctx.attacker, lim = a.costLeSubject ? (sub ? CARDS[sub.id].cost : -1) : null;
      return (a.kind === 'any' ? c.opp.spirits.concat(c.opp.nexus) : a.kind === 'nexus' ? c.opp.nexus : c.opp.spirits).filter(t => (lim == null || CARDS[t.id].cost <= lim) && (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (a.bpLe == null || (a.kind === 'any' && c.opp.nexus.includes(t)) || bpOf(t) <= a.bpLe + (a.bpPer ? a.bpPer.n * c.p.spirits.filter(x => cardHasKeyword(CARDS[x.id], a.bpPer.keyword)).length : 0)) && (!a.lv || a.lv.includes(lvNo(t))) && (!a.notColor || !(CARDS[t.id].colors || [CARDS[t.id].symbol]).includes(a.notColor)) && (!a.exhaustedOnly || t.exhausted) && !flagActive(c.opp, 'NO_RETURN', t) && !fxImmune(c.opp, t));
    },
    can: (c, a) => FX_ACTIONS.BOUNCE_OPP.cands(c, a).length >= (a.upTo ? 1 : a.n || 1),      // v0.196 upTo: "up to N" targets
    run: async (c, a) => {
      if (FX_ACTIONS.BOUNCE_OPP.cands(c, a).length < (a.upTo ? 1 : a.n || 1)) { c.ctx.did = false; return; }
      const got = [];
      for (let j = 0; j < (a.n || 1); j++) {
        const rest = FX_ACTIONS.BOUNCE_OPP.cands(c, a).filter(x => !got.includes(x));
        if (a.upTo && (!rest.length || (c.p.cpu === false && j > 0 && !await ask({ title: `✨ ${esc(CARDS[c.src.id].name)}`, html: 'Return another one?', buttons: [{ label: 'Yes', cls: 'primary', value: true }, { label: 'No', cls: 'blue', value: false }] })))) break;
        const t = await fxPickTarget(c, rest, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing card to return${a.n ? ` (${j + 1}/${a.n})` : ''} (glowing).`);
        if (!t) { c.ctx.did = false; return; }
        got.push(t);
      }
      for (const t of got) {
        const nx = c.opp.nexus.includes(t); bounceCard(c.opp, t, a.to);
        if (!nx && a.spiritCore && c.p.spirits.includes(c.src) && takeFromVoid(c.p, 1)) { c.src.cores += 1; log(`${CARDS[c.src.id].name}: a core moves from the Void to this Spirit.`); }
        if (nx && a.nexusSymbol) { if (!c.src.symTurn || c.src.symTurn.turn !== G.turnNo) c.src.symTurn = { turn: G.turnNo, cols: [] }; c.src.symTurn.cols.push(a.nexusSymbol); log(`${CARDS[c.src.id].name}: gets an extra ${cap(a.nexusSymbol)} symbol.`); }
      }
      checkDepletion(c.opp);
    } },
  DESTROY: { chk: a => (a.noTR == null || (a.noTR === true && a.nexus === true)) && (a.all == null || (a.all === true && !a.nexus)) && (a.nexus === true || a.bpLe != null || a.bpLeAttacker === true || a.symbolsLe != null || a.bpLeReturned === true || a.familyInOppTrash === true || a.costLe != null || a.costIs != null || a.costLeSelf === true || a.costLeDiscarded === true || a.costRank != null || (Array.isArray(a.keywords) && a.keywords.length > 0 && a.keywords.length <= 8 && a.keywords.every(k => typeof k === 'string' && /^[A-Za-z ]{3,20}$/.test(k))) || (Number.isInteger(a.coresLe) && a.coresLe >= 0 && a.coresLe <= 10)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.costRank == null || ['lowest', 'highest'].includes(a.costRank)) && (a.costBoost == null || (a.costBoost && Number.isInteger(a.costBoost.counterGe) && Number.isInteger(a.costBoost.n) && a.costBoost.n > 0)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0)) && (a.symbolsLe == null || Number.isInteger(a.symbolsLe)) && (a.thenDraw == null || (Number.isInteger(a.thenDraw) && a.thenDraw >= 1 && a.thenDraw <= 3)) && (a.lifeBoost == null || (a.lifeBoost && Number.isInteger(a.lifeBoost.le) && Number.isInteger(a.lifeBoost.n) && a.lifeBoost.n > 0)) && (a.noFx == null || a.noFx === true) && (a.n == null || (Number.isInteger(a.n) && a.n >= 2 && a.n <= 3 && !a.all && !a.nexus)) && (a.bpPer == null || (a.bpLe != null && a.bpPer && /^[A-Za-z ]{3,20}$/.test(a.bpPer.keyword) && Number.isInteger(a.bpPer.n) && a.bpPer.n > 0 && a.bpPer.n <= 3000)) && (a.costPerOwn == null || ((a.costPerOwn === true || hasMatch(a.costPerOwn)) && a.costLe != null)),
    txt: a => a.keywords ? `destroy ${a.all ? 'every' : '1'} opposing Spirit/Ultimate with ${a.keywords.join('/')}` : a.all ? 'destroy every opposing Spirit/Ultimate with ' + (a.coresLe != null ? a.coresLe + ' core(s) or less on it' : a.bpLe + ' BP or less') + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed targets can't activate" : '') : (a.coresLe != null ? `destroy 1 opposing Spirit/Ultimate with ${a.coresLe} core${a.coresLe === 1 ? '' : 's'} or less on it` : a.nexus ? 'destroy 1 opposing Nexus' : a.costRank ? `destroy 1 opposing Spirit/Ultimate with the ${a.costRank} cost` : (a.costLe != null || a.costLeSelf || a.costLeDiscarded) ? `destroy 1 opposing Spirit/Ultimate with ${a.costLe != null ? 'cost ' + a.costLe + ' or less' : a.costLeSelf ? 'a cost equal or inferior to this Spirit' : 'a cost equal or inferior to the discarded card'}${a.costBoost ? ' (+' + a.costBoost.n + ' with ' + a.costBoost.counterGe + ' counters or more)' : ''}` : `destroy 1 opposing Spirit${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' + (a.lifeBoost ? ' (+' + a.lifeBoost.n + ' if your Life is ' + a.lifeBoost.le + ' or less)' : '') : a.symbolsLe != null ? ' with ' + a.symbolsLe + ' symbol(s) or less' : a.bpLeReturned ? ' with BP equal or inferior to the LV1 BP of the returned card' : a.familyInOppTrash ? ' with the same family as a card in the opposing Trash' : ' with BP equal or inferior to the attacker'}${a.thenDraw ? ', then draw ' + a.thenDraw : ''}`) + (a.noFx ? "; the effects of the destroyed target can't activate" : ''),
    cands: (c, a) => {
      if (a.nexus) return c.opp.nexus.filter(n => !fxImmune(c.opp, n) && (a.costLe == null || CARDS[n.id].cost <= a.costLe) && !(a.noTR && CARDS[n.id].trueRelease && lvNo(n) >= 2));      // v0.196 noTR: "a Nexus that isn't during True Release"
      if (a.costIs != null) return c.opp.spirits.filter(s => !fxImmune(c.opp, s) && CARDS[s.id].cost === a.costIs);      // v174 costIs: "Cost N Spirit" exactly
      if (a.costRank || a.costLe != null || a.costLeSelf || a.costLeDiscarded) {                    // v0.37 cost based destruction ("Cost Destruction effect")
        const all = c.opp.spirits.filter(s => !fxImmune(c.opp, s));
        if (a.costRank) { if (!all.length) return []; const cs = all.map(s => CARDS[s.id].cost), m = a.costRank === 'lowest' ? Math.min(...cs) : Math.max(...cs); return all.filter(s => CARDS[s.id].cost === m); }
        const base = a.costLe != null ? a.costLe : a.costLeSelf ? CARDS[c.src.id].cost : (c.ctx.discardedCost == null ? -1 : c.ctx.discardedCost);
        if (base < 0) return [];
        const lim = base + (a.costBoost && c.p.count >= a.costBoost.counterGe ? a.costBoost.n : 0) + costDestroyBonus(c.p, c.src) + (a.costPerOwn ? (a.costPerOwn === true ? c.p.spirits.length + c.p.nexus.length : c.p.spirits.filter(x => fxMatch(CARDS[x.id], a.costPerOwn)).length) : 0);      // v0.195 costPerOwn: "for each Spirit/Nexus you control, the target cost gets +1"
        return all.filter(s => CARDS[s.id].cost <= lim);
      }
      if (a.coresLe != null) return c.opp.spirits.filter(s => (a.ignoreImmune === true || !fxImmune(c.opp, s)) && totalCores(s) <= a.coresLe);      // v0.39 (Purple): "with N cores or less on it"
      let lim = null;
      if (a.bpLeReturned) { const r = c.ctx.returned, k = r && CARDS[r.id]; lim = k && k.type === 'Spirit' ? k.levels[0].bp : -1; }
      const fams = a.familyInOppTrash ? new Set([].concat(...c.opp.trash.map(t => CARDS[t.id].families || []))) : null;
      const bpLim = a.bpLe == null ? null : a.bpLe + (a.lifeBoost && c.p.life <= a.lifeBoost.le ? a.lifeBoost.n : 0) + (a.bpPer ? a.bpPer.n * c.p.spirits.filter(x => cardHasKeyword(CARDS[x.id], a.bpPer.keyword)).length : 0);      // v0.195 bpPer: "for each Spirit with Clash you control, the targeting BP gets +1000"
      return c.opp.spirits.filter(s => (bpLim == null || bpOf(s) <= bpLim) && (a.symbolsLe == null || CARDS[s.id].symbols <= a.symbolsLe) && (!a.bpLeAttacker || (c.ctx.attacker && bpOf(s) <= bpOf(c.ctx.attacker)))
        && (lim == null || bpOf(s) <= lim) && (!fams || (CARDS[s.id].families || []).some(f => fams.has(f))) && (!a.keywords || a.keywords.some(k => cardHasKeyword(CARDS[s.id], k))));      // v0.181 "with Clash/Windstorm"
    },
    can: (c, a) => FX_ACTIONS.DESTROY.cands(c, a).length > 0,
    run: async (c, a) => {
      if (a.all) {      // v0.75 "Destroy every / all opposing <bound> Spirits": every candidate at once
        const L = FX_ACTIONS.DESTROY.cands(c, a).slice(); if (!L.length) { c.ctx.did = false; return; }
        for (const t of L) { if (a.noFx) t.noFx = true; removeSpirit(c.opp, t, 'destroyed', true); }
        checkDepletion(c.opp); c.ctx.destroyedN = L.length;
        if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
        return;
      }
      if (a.n) {      // v0.195 "Target two opposing ... Spirits. Destroy them": up to n distinct targets (fewer when fewer qualify)
        const got = [];
        for (let j = 0; j < a.n; j++) { const t = await fxPickTarget(c, FX_ACTIONS.DESTROY.cands(c, a).filter(x => !got.includes(x)), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing Spirit to destroy (${j + 1}/${a.n}, glowing).`); if (!t) break; got.push(t); }
        if (!got.length) { c.ctx.did = false; return; }
        c.ctx.destroyedN = got.length;
        for (const t of got) { if (a.noFx) t.noFx = true; c.ctx.destroyedCost = CARDS[t.id].cost; removeSpirit(c.opp, t, 'destroyed', true); }
        checkDepletion(c.opp);
        if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
        return;
      }
      const t = await fxPickTarget(c, FX_ACTIONS.DESTROY.cands(c, a), c.burst ? `💥 <b>Choose a target</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).` : `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      if (a.noFx) t.noFx = true;
      if (!a.nexus) c.ctx.destroyedCost = CARDS[t.id].cost;
      if (a.nexus) removeNexus(c.opp, t, 'destroyed'); else { removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); }
      if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    } },
  REFRESH: { chk: () => true, txt: () => 'refresh this card', can: c => c.src.exhausted,
    run: async c => { refreshOne(c.src); log(`${CARDS[c.src.id].name} is refreshed.`); } },
  /* v0.195 "You can exhaust this Spirit. If you've done so, ..." (optional effect; the next action reads prev) */
  EXHAUST_SELF: { chk: () => true, txt: () => 'exhaust this Spirit', can: c => (c.p.spirits.includes(c.src) || c.p.nexus.includes(c.src)) && !c.src.exhausted,      // v0.197 a Nexus can exhaust itself (Red Stella Stage)
    run: async c => { c.src.exhausted = true; log(`${CARDS[c.src.id].name} is exhausted.`); } },
  ASSAULT: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5, txt: a => `refresh this Spirit by exhausting one of your Nexuses (up to ${a.n} per turn)`,      // v0.185 {{Assault|N}}
    can: c => c.src.exhausted && c.p.nexus.some(x => !x.exhausted),
    run: async (c, a) => {
      const s = c.src, used = s.assaultT === G.turnNo ? s.assaultN : 0, L = c.p.nexus.filter(x => !x.exhausted);
      if (!s.exhausted || used >= a.n || !L.length) { c.ctx.did = false; return; }
      const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[s.id].name)}</b><br>Tap one of your Nexuses to exhaust.`);
      if (!t) { c.ctx.did = false; return; }
      t.exhausted = true; refreshOne(s); s.assaultT = G.turnNo; s.assaultN = used + 1;
      log(`${CARDS[s.id].name} is refreshed (Assault, exhausting ${CARDS[t.id].name}).`);
    } },
  SUMMON_HAND: { chk: a => hasMatch(a.match) && (a.from == null || ['hand', 'handOrSoul', 'soul', 'trash'].includes(a.from)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.pay == null || typeof a.pay === 'boolean') && (a.noFx == null || a.noFx === true) && (a.noTribute == null || (a.noTribute === true && a.pay === true)) && (a.allowBrave == null || (a.allowBrave === true && !a.pay)) && (a.types == null || (Array.isArray(a.types) && a.types.every(t => ['Spirit', 'Brave', 'Nexus'].includes(t)))),
    txt: a => `summon/deploy a matching card${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''} from your ${a.from === 'trash' ? 'Trash' : a.from === 'soul' ? 'Soul State' : a.from === 'handOrSoul' ? 'Hand/Soul State' : 'Hand'}${a.pay ? ' (paying its cost)' : ' without paying the cost'}${a.noTribute ? ' without using Tribute' : ''}${a.noFx ? "; its (When Summoned) effects can't activate" : ''}`,
    cands: (c, a) => (a.from === 'trash' ? c.p.trash : a.from === 'soul' ? c.p.soulState : a.from === 'handOrSoul' ? c.p.hand.concat(c.p.soulState) : c.p.hand).filter(h => { const k = CARDS[h.id]; if (a.types && !a.types.includes(k.type)) return false; if (a.noTribute && !k.tribute) return false; if (a.allowBrave && k.type === 'Brave') return fxMatch(k, a.match) && (a.costLe == null || k.cost <= a.costLe) && canPlaceBraveFree(c.p, h);    // v0.37: a Brave card is summoned as a Spirit
      return (k.type === 'Spirit' || k.type === 'Nexus') && fxMatch(k, a.match) && (a.costLe == null || k.cost <= a.costLe) && canPlaceBy(c.p, h, a.pay, a.noTribute); }),
    can: (c, a) => FX_ACTIONS.SUMMON_HAND.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.SUMMON_HAND.cands(c, a); if (!L.length) return;
      let t;
      if (c.p.cpu) t = L.slice().sort((x, y) => CARDS[y.id].cost - CARDS[x.id].cost)[0];
      else {
        const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
        const id = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, wide: true, html: (a.pay ? 'Choose a card to summon/deploy (you pay its cost).' : 'Choose a card to summon/deploy without paying the cost.'), cards: cardIds(ids), buttons: ids.map(i => ({ label: CARDS[i].name, value: i })) });
        t = L.find(x => x.id === id) || L[0];
      }
      const shaman = a.from === 'trash' && (cardHasKeyword(CARDS[c.src.id], 'Shamanism') || /\{\{Shaman\|/.test(CARDS[c.src.id].text || ''));      // v201 "summoned via Shamanism"
      await summonBy(c.p, t, a.pay, Object.assign({ noFx: a.noFx, noTribute: a.noTribute }, shaman ? { viaShaman: true } : {}));
    } },
  VOID_TO_CARD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && ['self', 'anySpirit', 'anyNexus', 'eachSpirit', 'eachNexus'].includes(a.to) && (a.match == null || (a.to !== 'self' && hasMatch(a.match))) && (a.perLegacy == null || (a.perLegacy === true && a.to === 'anyNexus')),      // v0.196 perLegacy: "for each EX Symbol banished via this Legacy, you can target one of your Nexuses" (up to that many different Nexuses, n core(s) each); v0.74: match = "any of your <colour|family> Spirits"; v0.75: Nexus targets, "each to every <X> you control"
    cands: (c, a) => (/Nexus$/.test(a.to) ? c.p.nexus : c.p.spirits).filter(x => fxMatch(CARDS[x.id], a.match)), txt: a => a.perOppHandPairs ? 'put a core from the Void to one of your Spirits for every two cards in the opposing Hand' : a.perDistinctSoul ? 'put a core from the Void to one of your Spirits for each differently-named card in Soul State' : `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void ${/^each/.test(a.to) ? 'to each of your ' : 'to '}${a.to === 'self' ? 'this Spirit' : (/^any/.test(a.to) ? 'one of your ' : '') + (a.match ? 'matching ' : '') + (/Nexus$/.test(a.to) ? 'Nexuses' : 'Spirits')}`,
    can: (c, a) => (!a.perLegacy || (c.src.legacyN || 0) > 0) && (!a.perOppHandPairs || c.opp.hand.length >= 2) && (!a.perDistinctSoul || c.p.soulState.length > 0) && (a.to === 'self' ? c.p.spirits.includes(c.src) : FX_ACTIONS.VOID_TO_CARD.cands(c, a).length > 0),
    run: async (c, a) => {
      if (/^each/.test(a.to)) {      // v0.75: every matching card gets n cores (each one its own)
        const L = FX_ACTIONS.VOID_TO_CARD.cands(c, a); let m = 0;
        for (const t of L) { const k = takeFromVoid(c.p, a.n); t.cores += k; m += k; }
        c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
        log(`${CARDS[c.src.id].name}: ${a.n} core${a.n === 1 ? '' : 's'} from the Void to each of ${L.map(t => CARDS[t.id].name).join(', ')}.`); return;
      }
      if (a.perLegacy) {
        let L = FX_ACTIONS.VOID_TO_CARD.cands(c, a), m = 0;
        for (let i = 0; i < (c.src.legacyN || 0) && L.length; i++) {
          const t = await fxPickTarget(c, L, `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap a Nexus that receives a core from the Void (${i + 1}/${c.src.legacyN}).`); if (!t) break;
          const k = takeFromVoid(c.p, a.n); t.cores += k; m += k; L = L.filter(x => x !== t); if (k) log(`${CARDS[c.src.id].name}: ${k} core${k === 1 ? '' : 's'} move from the Void to ${CARDS[t.id].name}.`);
        }
        c.ctx.put = m; if (!m) c.ctx.did = false; return;
      }
      const t = a.to === 'self' ? (c.p.spirits.includes(c.src) ? c.src : null) : await fxPickTarget(c, FX_ACTIONS.VOID_TO_CARD.cands(c, a), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the ${/Nexus$/.test(a.to) ? 'Nexus' : 'Spirit'} that receives the core${a.n === 1 ? '' : 's'} from the Void (glowing).`);
      const want = a.perOppHandPairs ? Math.floor(c.opp.hand.length / 2) : a.perDistinctSoul ? new Set(c.p.soulState.map(x => x.id)).size : a.n;
      const m = t ? takeFromVoid(c.p, want) : 0; c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
      t.cores += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to ${CARDS[t.id].name}.`);
    } }
};
