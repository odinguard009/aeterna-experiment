const FX_ACTIONS = {
  BOUNCE_OPP: { chk: a => ['hand', 'deckBottom'].includes(a.to) && ['spirit', 'any', 'nexus'].includes(a.kind) && (a.lv == null || (Array.isArray(a.lv) && a.lv.length > 0 && a.lv.every(x => Number.isInteger(x) && x >= 1 && x <= 4))) && (a.notColor == null || typeof a.notColor === 'string') && (a.costLeSubject == null || a.costLeSubject === true) && (a.exhaustedOnly == null || a.exhaustedOnly === true) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000 && a.bpLe <= 100000)) && (a.n == null || (Number.isInteger(a.n) && a.n >= 2 && a.n <= 3)),      // v0.195 bpLe ("3000 BP or less") and n ("Target two opposing ...": exactly n distinct targets)
    txt: a => `return ${a.n || 'an'} opposing ${a.lv ? 'LV' + a.lv.join('/') + ' ' : ''}${a.kind === 'any' ? 'Spirit/Nexus' : 'Spirit'}${a.costLeSubject ? ' with cost equal or inferior to the attacking card' : ''}${a.costLe != null ? ' with cost ' + a.costLe + ' or less' : ''}${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' : ''} to the ${a.to === 'hand' ? 'Hand' : 'bottom of the Deck'}`,
    cands: (c, a) => {
      const sub = c.ctx.subject || c.ctx.attacker, lim = a.costLeSubject ? (sub ? CARDS[sub.id].cost : -1) : null;
      return (a.kind === 'any' ? c.opp.spirits.concat(c.opp.nexus) : a.kind === 'nexus' ? c.opp.nexus : c.opp.spirits).filter(t => (lim == null || CARDS[t.id].cost <= lim) && (a.costLe == null || CARDS[t.id].cost <= a.costLe) && (a.bpLe == null || bpOf(t) <= a.bpLe) && (!a.lv || a.lv.includes(lvNo(t))) && (!a.notColor || !(CARDS[t.id].colors || [CARDS[t.id].symbol]).includes(a.notColor)) && (!a.exhaustedOnly || t.exhausted) && !flagActive(c.opp, 'NO_RETURN', t) && !fxImmune(c.opp, t));
    },
    can: (c, a) => FX_ACTIONS.BOUNCE_OPP.cands(c, a).length >= (a.n || 1),
    run: async (c, a) => {
      if (FX_ACTIONS.BOUNCE_OPP.cands(c, a).length < (a.n || 1)) { c.ctx.did = false; return; }
      const got = [];
      for (let j = 0; j < (a.n || 1); j++) {
        const t = await fxPickTarget(c, FX_ACTIONS.BOUNCE_OPP.cands(c, a).filter(x => !got.includes(x)), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing card to return${a.n ? ` (${j + 1}/${a.n})` : ''} (glowing).`);
        if (!t) { c.ctx.did = false; return; }
        got.push(t);
      }
      for (const t of got) bounceCard(c.opp, t, a.to);
      checkDepletion(c.opp);
    } },
  DESTROY: { chk: a => (a.all == null || (a.all === true && !a.nexus)) && (a.nexus === true || a.bpLe != null || a.bpLeAttacker === true || a.symbolsLe != null || a.bpLeReturned === true || a.familyInOppTrash === true || a.costLe != null || a.costLeSelf === true || a.costLeDiscarded === true || a.costRank != null || (Array.isArray(a.keywords) && a.keywords.length > 0 && a.keywords.length <= 8 && a.keywords.every(k => typeof k === 'string' && /^[A-Za-z ]{3,20}$/.test(k))) || (Number.isInteger(a.coresLe) && a.coresLe >= 0 && a.coresLe <= 10)) && (a.costLe == null || (Number.isInteger(a.costLe) && a.costLe >= 0 && a.costLe <= 30)) && (a.costRank == null || ['lowest', 'highest'].includes(a.costRank)) && (a.costBoost == null || (a.costBoost && Number.isInteger(a.costBoost.counterGe) && Number.isInteger(a.costBoost.n) && a.costBoost.n > 0)) && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 0)) && (a.symbolsLe == null || Number.isInteger(a.symbolsLe)) && (a.thenDraw == null || (Number.isInteger(a.thenDraw) && a.thenDraw >= 1 && a.thenDraw <= 3)) && (a.lifeBoost == null || (a.lifeBoost && Number.isInteger(a.lifeBoost.le) && Number.isInteger(a.lifeBoost.n) && a.lifeBoost.n > 0)) && (a.noFx == null || a.noFx === true),
    txt: a => a.keywords ? `destroy ${a.all ? 'every' : '1'} opposing Spirit/Ultimate with ${a.keywords.join('/')}` : a.all ? 'destroy every opposing Spirit/Ultimate with ' + (a.coresLe != null ? a.coresLe + ' core(s) or less on it' : a.bpLe + ' BP or less') + (a.thenDraw ? ', then draw ' + a.thenDraw : '') + (a.noFx ? "; the effects of the destroyed targets can't activate" : '') : (a.coresLe != null ? `destroy 1 opposing Spirit/Ultimate with ${a.coresLe} core${a.coresLe === 1 ? '' : 's'} or less on it` : a.nexus ? 'destroy 1 opposing Nexus' : a.costRank ? `destroy 1 opposing Spirit/Ultimate with the ${a.costRank} cost` : (a.costLe != null || a.costLeSelf || a.costLeDiscarded) ? `destroy 1 opposing Spirit/Ultimate with ${a.costLe != null ? 'cost ' + a.costLe + ' or less' : a.costLeSelf ? 'a cost equal or inferior to this Spirit' : 'a cost equal or inferior to the discarded card'}${a.costBoost ? ' (+' + a.costBoost.n + ' with ' + a.costBoost.counterGe + ' counters or more)' : ''}` : `destroy 1 opposing Spirit${a.bpLe != null ? ' with ' + a.bpLe + ' BP or less' + (a.lifeBoost ? ' (+' + a.lifeBoost.n + ' if your Life is ' + a.lifeBoost.le + ' or less)' : '') : a.symbolsLe != null ? ' with ' + a.symbolsLe + ' symbol(s) or less' : a.bpLeReturned ? ' with BP equal or inferior to the LV1 BP of the returned card' : a.familyInOppTrash ? ' with the same family as a card in the opposing Trash' : ' with BP equal or inferior to the attacker'}${a.thenDraw ? ', then draw ' + a.thenDraw : ''}`) + (a.noFx ? "; the effects of the destroyed target can't activate" : ''),
    cands: (c, a) => {
      if (a.nexus) return c.opp.nexus.filter(n => !fxImmune(c.opp, n));
      if (a.costRank || a.costLe != null || a.costLeSelf || a.costLeDiscarded) {                    // v0.37 cost based destruction ("Cost Destruction effect")
        const all = c.opp.spirits.filter(s => !fxImmune(c.opp, s));
        if (a.costRank) { if (!all.length) return []; const cs = all.map(s => CARDS[s.id].cost), m = a.costRank === 'lowest' ? Math.min(...cs) : Math.max(...cs); return all.filter(s => CARDS[s.id].cost === m); }
        const base = a.costLe != null ? a.costLe : a.costLeSelf ? CARDS[c.src.id].cost : (c.ctx.discardedCost == null ? -1 : c.ctx.discardedCost);
        if (base < 0) return [];
        const lim = base + (a.costBoost && c.p.count >= a.costBoost.counterGe ? a.costBoost.n : 0) + costDestroyBonus(c.p, c.src);
        return all.filter(s => CARDS[s.id].cost <= lim);
      }
      if (a.coresLe != null) return c.opp.spirits.filter(s => (a.ignoreImmune === true || !fxImmune(c.opp, s)) && totalCores(s) <= a.coresLe);      // v0.39 (Purple): "with N cores or less on it"
      let lim = null;
      if (a.bpLeReturned) { const r = c.ctx.returned, k = r && CARDS[r.id]; lim = k && k.type === 'Spirit' ? k.levels[0].bp : -1; }
      const fams = a.familyInOppTrash ? new Set([].concat(...c.opp.trash.map(t => CARDS[t.id].families || []))) : null;
      const bpLim = a.bpLe == null ? null : a.bpLe + (a.lifeBoost && c.p.life <= a.lifeBoost.le ? a.lifeBoost.n : 0);
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
      const t = await fxPickTarget(c, FX_ACTIONS.DESTROY.cands(c, a), c.burst ? `💥 <b>Choose a target</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).` : `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the opposing ${a.nexus ? 'Nexus' : 'Spirit'} to destroy (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      if (a.noFx) t.noFx = true;
      if (!a.nexus) c.ctx.destroyedCost = CARDS[t.id].cost;
      if (a.nexus) removeNexus(c.opp, t, 'destroyed'); else { removeSpirit(c.opp, t, 'destroyed', true); checkDepletion(c.opp); }
      if (a.thenDraw) { const k = draw(c.p, a.thenDraw); log(`${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(c.p, k); }
    } },
  REFRESH: { chk: () => true, txt: () => 'refresh this card', can: c => c.src.exhausted,
    run: async c => { refreshOne(c.src); log(`${CARDS[c.src.id].name} is refreshed.`); } },
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
      await summonBy(c.p, t, a.pay, a.noFx || a.noTribute ? { noFx: a.noFx, noTribute: a.noTribute } : undefined);
    } },
  VOID_TO_CARD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && ['self', 'anySpirit', 'anyNexus', 'eachSpirit', 'eachNexus'].includes(a.to) && (a.match == null || (a.to !== 'self' && hasMatch(a.match))),      // v0.74: match = "any of your <colour|family> Spirits"; v0.75: Nexus targets, "each to every <X> you control"
    cands: (c, a) => (/Nexus$/.test(a.to) ? c.p.nexus : c.p.spirits).filter(x => fxMatch(CARDS[x.id], a.match)), txt: a => a.perOppHandPairs ? 'put a core from the Void to one of your Spirits for every two cards in the opposing Hand' : a.perDistinctSoul ? 'put a core from the Void to one of your Spirits for each differently-named card in Soul State' : `put ${a.n} core${a.n === 1 ? '' : 's'} from the Void ${/^each/.test(a.to) ? 'to each of your ' : 'to '}${a.to === 'self' ? 'this Spirit' : (/^any/.test(a.to) ? 'one of your ' : '') + (a.match ? 'matching ' : '') + (/Nexus$/.test(a.to) ? 'Nexuses' : 'Spirits')}`,
    can: (c, a) => (!a.perOppHandPairs || c.opp.hand.length >= 2) && (!a.perDistinctSoul || c.p.soulState.length > 0) && (a.to === 'self' ? c.p.spirits.includes(c.src) : FX_ACTIONS.VOID_TO_CARD.cands(c, a).length > 0),
    run: async (c, a) => {
      if (/^each/.test(a.to)) {      // v0.75: every matching card gets n cores (each one its own)
        const L = FX_ACTIONS.VOID_TO_CARD.cands(c, a); let m = 0;
        for (const t of L) { const k = takeFromVoid(c.p, a.n); t.cores += k; m += k; }
        c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
        log(`${CARDS[c.src.id].name}: ${a.n} core${a.n === 1 ? '' : 's'} from the Void to each of ${L.map(t => CARDS[t.id].name).join(', ')}.`); return;
      }
      const t = a.to === 'self' ? (c.p.spirits.includes(c.src) ? c.src : null) : await fxPickTarget(c, FX_ACTIONS.VOID_TO_CARD.cands(c, a), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the ${/Nexus$/.test(a.to) ? 'Nexus' : 'Spirit'} that receives the core${a.n === 1 ? '' : 's'} from the Void (glowing).`);
      const want = a.perOppHandPairs ? Math.floor(c.opp.hand.length / 2) : a.perDistinctSoul ? new Set(c.p.soulState.map(x => x.id)).size : a.n;
      const m = t ? takeFromVoid(c.p, want) : 0; c.ctx.put = m; if (!m) { c.ctx.did = false; return; }
      t.cores += m; log(`${CARDS[c.src.id].name}: ${m} core${m === 1 ? '' : 's'} move from the Void to ${CARDS[t.id].name}.`);
    } }
};
