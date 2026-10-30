/* ---- FX_ACTIONS, part 5 of 5 (v0.106.0 split of the old 516-line 02b-effects-actions.js) ----
   The opponent's side: burst and Magic discard, opposing Life, the block lock, and the by-doing connector.
   Object.assign keeps the original entry order. Only the entries that 02m and 02p capture at
   load time must load before those parts, which is why the targeting actions stay in 02b;
   every other entry here is read from inside a function.
   ------------------------------------------------------------------------------------ */
Object.assign(FX_ACTIONS, {
  /* v0.183 (schema 38) "Destroy a Nexus" / "Destroy an exhausted Spirit you or the opponent controls": either side is a legal target for a person; the CPU only picks an opposing one (it never destroys its own card) */
  DESTROY_ANY: { chk: a => (a.kind === 'nexus' || (a.kind === 'spirit' && (a.exhaustedOnly === true || (Number.isInteger(a.bpLe) && a.bpLe >= 1000 && a.bpLe <= 100000)))) && (a.noTR == null || (a.noTR === true && a.kind === 'nexus')) && (a.drawIfDone == null || (a.drawIfDone === true && a.kind === 'nexus')) && Object.keys(a).every(k => ['do', 'kind', 'exhaustedOnly', 'bpLe', 'drawIfOpp', 'noTR', 'drawIfDone', 'if'].includes(k)),
    txt: a => a.kind === 'nexus' ? 'destroy 1 ' + (a.noTR ? 'Nexus not in True Release' : 'Nexus') + ' (yours or the opponent\'s)' + (a.drawIfDone ? '; if one is destroyed, draw a card' : '') + (a.drawIfOpp ? '; if it was an opposing Nexus, draw a card' : '') : `destroy 1 ${a.bpLe ? a.bpLe + ' BP or less' : 'exhausted'} Spirit (yours or the opponent\'s)`,
    cands: (c, a) => (c.p.cpu ? [c.opp] : [c.opp, c.p]).flatMap(q => (a.kind === 'nexus' ? q.nexus.filter(x => !a.noTR || !(CARDS[x.id].trueRelease && lvNo(x) >= 2)) : q.spirits.filter(s => (!a.exhaustedOnly || s.exhausted) && (!a.bpLe || bpOf(s) <= a.bpLe)))),
    can: (c, a) => FX_ACTIONS.DESTROY_ANY.cands(c, a).length > 0,
    run: async (c, a) => {
      const t = await fxPickTarget(c, FX_ACTIONS.DESTROY_ANY.cands(c, a), `✨ <b>${esc(CARDS[c.src.id].name)}</b><br>Tap the ${a.kind === 'nexus' ? 'Nexus' : 'Spirit'} to destroy (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      const q = c.p.nexus.includes(t) || c.p.spirits.includes(t) ? c.p : c.opp;
      if (a.kind === 'nexus') { removeNexus(q, t, 'destroyed'); if ((a.drawIfOpp && q === c.opp) || a.drawIfDone) { const k = draw(c.p, 1); log(`${CARDS[c.src.id].name}: ${who(c.p)} ${c.p.cpu ? 'draws' : 'draw'} ${k} card.`); handUp(c.p, k); } } else { removeSpirit(q, t, 'destroyed', q === c.opp); checkDepletion(q); }
    } },
  /* v0.183 (schema 42) "Destroy every N BP / Cost N or less / Cost N Spirit" (opposing:true = "every opposing ..."): otherwise both sides, this Spirit included when it qualifies */
  DESTROY_EVERY: { chk: a => [a.bpLe, a.costLe, a.costIs].filter(x => x != null).length === 1 && (a.bpLe == null || (Number.isInteger(a.bpLe) && a.bpLe >= 1000 && a.bpLe <= 100000)) && [a.costLe, a.costIs].every(x => x == null || (Number.isInteger(x) && x >= 0 && x <= 30))
      && (a.opposing == null || a.opposing === true) && Object.keys(a).every(k => ['do', 'bpLe', 'costLe', 'costIs', 'opposing', 'if'].includes(k)),
    txt: a => `destroy every ${a.opposing ? 'opposing ' : ''}${a.bpLe != null ? a.bpLe + ' BP or less' : a.costLe != null ? 'Cost ' + a.costLe + ' or less' : 'Cost ' + a.costIs} Spirit${a.opposing ? '' : ' (both sides)'}`,
    can: () => true,
    run: async (c, a) => {
      const hit = s => a.bpLe != null ? bpOf(s) <= a.bpLe : a.costLe != null ? CARDS[s.id].cost <= a.costLe : CARDS[s.id].cost === a.costIs, Q = a.opposing ? [c.opp] : [c.opp, c.p];
      for (const q of Q) for (const s of q.spirits.filter(hit)) removeSpirit(q, s, 'destroyed', q === c.opp);
      for (const q of Q) checkDepletion(q);
    } },
  /* v0.183 (schema 45) "Destroy all Nexuses" (both sides) / "every Nexus on the opposing Field" / "every LV1 Nexus" / "all Nexuses with a core on them" */
  DESTROY_NEXUS_ALL: { chk: a => (a.opposing == null || a.opposing === true) && (a.withCore == null || a.withCore === true) && (a.lv == null || [1, 2, 3].includes(a.lv)) && Object.keys(a).every(k => ['do', 'opposing', 'lv', 'withCore', 'if'].includes(k)),
    txt: a => `destroy every ${a.opposing ? 'opposing ' : ''}${a.lv ? 'LV' + a.lv + ' ' : ''}Nexus${a.withCore ? ' with a core on it' : ''}${a.opposing ? '' : ' (both sides)'}`,
    can: () => true,
    run: async (c, a) => {
      for (const q of a.opposing ? [c.opp] : [c.opp, c.p]) for (const x of q.nexus.filter(x => (!a.lv || lvNo(x) === a.lv) && (!a.withCore || x.cores > 0))) removeNexus(q, x, 'destroyed');
    } },
  /* v0.196 DESTROY_EITHER {two, one} "Target either two opposing <two> BP or less Spirits or an opposing <one> BP or less Spirit. Destroy those": the owner picks the branch when both are possible (the CPU takes two) */
  DESTROY_EITHER: { chk: a => Number.isInteger(a.two) && Number.isInteger(a.one) && a.two < a.one && a.two >= 1000 && a.one <= 12000,
    txt: a => `destroy either two opposing ${a.two} BP or less Spirits or one opposing ${a.one} BP or less Spirit`,
    can: (c, a) => FX_ACTIONS.DESTROY.cands(c, { do: 'DESTROY', bpLe: a.one }).length > 0,
    run: async (c, a) => {
      const D = FX_ACTIONS.DESTROY, two = D.cands(c, { do: 'DESTROY', bpLe: a.two }).length >= 2, one = D.cands(c, { do: 'DESTROY', bpLe: a.one }).length > 0;
      if (!two && !one) { c.ctx.did = false; return; }
      let both = two;
      if (two && one && !c.p.cpu) both = await ask({ title: `✨ ${esc(_nm(c))}`, html: `Destroy two opposing ${a.two} BP or less Spirits, or one ${a.one} BP or less Spirit?`, buttons: [{ label: 'Two', cls: 'primary', value: true }, { label: 'One', cls: 'blue', value: false }] });
      for (let i = 0; i < (both ? 2 : 1); i++) await D.run(c, { do: 'DESTROY', bpLe: both ? a.two : a.one });
    } },
  /* v0.196 TREAT_LV2 {match} "Target one of your <match> Spirits. During this turn, treat it as LV2" (inst.lv2Turn, read by lvIndex, cleared at the end of the turn) */
  TREAT_LV2: { chk: a => (hasMatch(a.match) || a.self === true) && (a.battle == null || a.battle === true) && (a.highest == null || (a.highest === true && !a.battle && !a.self)),
    txt: a => `target one of your matching Spirits; during this turn, treat it as ${a.highest ? 'its highest level' : 'LV2'}`,
    cands: (c, a) => (a.self ? c.p.spirits.filter(s => s === c.src) : c.p.spirits.filter(s => fxMatch(CARDS[s.id], a.match, s))).filter(s => CARDS[s.id].levels.length > 1 && !(a.highest ? s.lvHighTurn : s.lv2Turn)),
    can: (c, a) => FX_ACTIONS.TREAT_LV2.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.TREAT_LV2.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const t = c.p.cpu || a.self ? L[0] : await fxPickTarget(c, L, `✨ <b>${esc(_nm(c))}</b><br>Tap your Spirit to treat as LV2 (glowing).`);
      if (!t) { c.ctx.did = false; return; }
      if (a.highest) t.lvHighTurn = true; else if (a.battle) t.lv2Battle = G.battleNo; else t.lv2Turn = true; io.view({ type: 'board' });
    } },
  /* v0.181 (schema 30) "By setting a card with Burst effect from your Hand, <next>": sets one (a previous Burst is discarded, setBurst); ctx.did = false when the Hand has none, so the next actions use {"if":{"prev":true}} */
  SET_BURST: { chk: () => true, txt: () => 'set a card with Burst effect from your Hand',
    cands: c => c.p.hand.filter(h => h !== c.src && CARDS[h.id].burst),
    can: c => FX_ACTIONS.SET_BURST.cands(c).length > 0,
    run: async c => {
      const L = FX_ACTIONS.SET_BURST.cands(c); if (!L.length) { c.ctx.did = false; return; }
      const h = c.p.cpu ? L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0] : await chooseCard(c, L, `✨ ${_pn(c)}`, 'Choose a card with Burst effect from your Hand to set.', false);
      setBurst(c.p, h, false); io.view({ type: 'board' });
    } },
  DISCARD_OPP_BURST: { chk: () => true, txt: () => 'discard the opposing Burst',
    run: async c => { const b = c.opp.burst; if (!b) { c.ctx.did = false; return; } c.opp.burst = null; b.mirage = false; c.opp.trash.push(b); log(`${CARDS[c.src.id].name}: the opposing Burst is discarded.`); } },
  /* v0.42 "Unless the opponent discards a Magic card from their Hand, <next actions>": the opponent chooses (modal for the human, CPU rule).
     ctx.did = true when the effect goes ahead (no Magic card to discard, or the opponent declines), false when they discarded, so the
     following actions use {"if":{"prev":true}}. {needExhausted:true}: nothing to ask when this card is not exhausted (refresh clauses). */
  OPP_DISCARD_MAGIC_OR: { chk: a => a.needExhausted == null || typeof a.needExhausted === 'boolean',
    txt: () => 'unless the opponent discards a Magic card from their Hand, the following effect applies',
    can: (c, a) => !a.needExhausted || !!c.src.exhausted,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, o = c.opp, M = o.hand.filter(x => CARDS[x.id].type === 'Magic' && !handSafe(x, o, c));
      if (!M.length) { c.ctx.did = true; return; }
      let d = null;
      if (o.cpu) d = cpuKeepMagicOrPay(o, c, M);
      else {
        const v = await ask({ title: `✨ ${nm}`, peek: true, html: `Discard a Magic card from your Hand to stop this effect?`, buttons: M.slice(0, 12).map(x => ({ label: `Discard ${CARDS[x.id].name}`, cls: 'primary', value: x.uid })).concat([{ label: 'Do not discard', value: 'no' }]) }, o.key || 'player');   // v0.105.0 (M6 step 1): ask for the owner's seat - the port marks CPU seats by it and the attacking seat may be a CPU
        d = M.find(x => x.uid === v) || null;
      }
      if (!d) { c.ctx.did = true; log(`${nm}: ${who(o)} ${o.cpu ? 'does' : 'do'} not discard a Magic card.`); return; }
      removeFrom(o.hand, d); o.trash.push(d); c.ctx.did = false;
      log(`${nm}: ${who(o)} ${o.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}, the effect does not apply.`);
    } },
  /* v0.180 "The opponent discards N card(s) from their Hand": the opponent picks (modal for the human, the CPU throws away the cheapest). */
  OPP_DISCARD: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3,
    txt: a => `the opponent discards ${a.n === 1 ? 'a card' : a.n + ' cards'} from their Hand`,
    can: c => c.opp.hand.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, o = c.opp; let k = 0;
      for (let j = 0; j < a.n; j++) {
        const L = o.hand.filter(x => !handSafe(x, o, c)); if (!L.length) break;
        let d;
        if (o.cpu) d = L.slice().sort((x, y) => CARDS[x.id].cost - CARDS[y.id].cost)[0];
        else { const v = await ask({ title: `✨ ${nm}`, peek: true, html: 'Choose a card from your Hand to discard.', buttons: L.slice(0, 12).map(x => ({ label: CARDS[x.id].name, cls: 'primary', value: x.uid })) }, o.key || 'player'); d = L.find(x => x.uid === v) || L[0]; }
        removeFrom(o.hand, d); o.trash.push(d); k++;
        log(`${nm}: ${who(o)} ${o.cpu ? 'discards' : 'discard'} ${CARDS[d.id].name}.`);
      }
      if (!k) c.ctx.did = false;
      io.view({ type: 'board' });
    } },
  /* "send all cores from an opposing <family> Nexus" (one Nexus), {n, spread:true}: "send n cores from any opposing <family> Nexuses",
     orAllIfLifeLe: "Or, if your Life is X or less, you can send all cores from an opposing <family> Nexus". The Soul Core is never moved by these effects. */
  OPP_LIFE_TO_TRASH: { chk: a => (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 5)) && (a.perBraveNames == null || (typeof a.perBraveNames === 'string' && a.perBraveNames.length > 0)) && (a.n != null || a.perBraveNames != null),
    txt: a => a.perBraveNames ? `for each differently named "${a.perBraveNames}" family Brave you control, send an opposing Life to the Trash` : `send ${a.n} opposing Life to the Trash`,
    count: (c, a) => {
      if (!a.perBraveNames) return a.n;
      const nm = new Set();
      for (const i of fieldList(c.p)) for (const b of [i.brave, CARDS[i.id].type === 'Brave' ? i : null]) if (b && (CARDS[b.id].families || []).includes(a.perBraveNames)) nm.add(CARDS[b.id].name);
      return nm.size;
    },
    can: c => c.opp.life > 0,
    run: async (c, a) => {
      const m = Math.min(FX_ACTIONS.OPP_LIFE_TO_TRASH.count(c, a), c.opp.life); if (!m) { c.ctx.did = false; return; }
      lifeTake(c.opp, m, 'trash'); log(`${CARDS[c.src.id].name}: ${m} opposing Life ${m === 1 ? 'is' : 'are'} sent to the opposing Trash.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  /* v0.45 "(Your Attack Step) the opponent can't block" while this card stays on the Field at minLv or higher (Agateram Lv2-3) */
  OPP_NO_BLOCK: { chk: a => a.minLv == null || (Number.isInteger(a.minLv) && a.minLv >= 1 && a.minLv <= 5), txt: () => 'the opponent can\'t block during this Attack Step',
    run: async (c, a) => { c.opp.noBlock = { turn: G.turnNo, uid: c.src.uid, owner: c.p.key, minLv: a.minLv || 1 }; log(`${CARDS[c.src.id].name}: ${who(c.opp)} can't block during this Attack Step.`); io.view({ type: 'board' }); } },
  /* v0.48 Seal (manual p.49): send your Soul Core to your Life (from wherever it is: Trash, Reserve or a card that keeps enough cores) */
  LIFE_TO_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 3, txt: a => `send ${a.n} opposing Life to the opposing Reserve`,
    can: c => c.opp.life > 0,
    run: async (c, a) => {
      const m = Math.min(a.n, c.opp.life); if (!m) { c.ctx.did = false; return; }
      lifeTake(c.opp, m, 'reserve'); log(`${CARDS[c.src.id].name}: ${m} opposing Life moves to the opposing Reserve.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  REVEAL_LIFE_RESERVE: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5 && Array.isArray(a.names) && a.names.length > 0 && a.names.every(x => typeof x === 'string' && x),
    txt: a => `reveal ${a.n} cards from the top of your Deck; for each ${a.names.map(x => `"${x}"`).join('/')}, send an opposing Life to the Reserve; add the revealed cards to the Hand`,
    can: c => c.p.deck.length > 0,
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name, top = c.p.deck.splice(0, Math.min(a.n, c.p.deck.length)); c.p.revealed = top;
      log(`${nm}: ${who(c.p)} ${c.p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`); io.view({ type: 'board' });
      await revealedFx(c.p);
      const k = c.p.revealed.filter(x => a.names.some(s => CARDS[x.id].name.includes(s))).length;
      const got = c.p.revealed.splice(0); for (const x of got) c.p.hand.push(x); if (got.length) { handUp(c.p, got.length); log(`${nm}: ${got.length} revealed card${got.length === 1 ? '' : 's'} added to the Hand.`); }
      c.ctx.did = k > 0;
      const m = Math.min(k, c.opp.life); if (!m) return;
      lifeTake(c.opp, m, 'reserve'); log(`${nm}: ${m} opposing Life moves to the opposing Reserve.`); io.view({ type: 'board' });
      if (c.opp.life <= 0) { win(c.p.key, `${poss(c.opp)} Life reached 0`); return; }
      await maybeBurst(c.opp, 'LIFE_DECREASE', {});
    } },
  NEXUS_CORES_TO_VOID: { chk: a => typeof a.family === 'string' && a.family.length > 0 && (a.n == null || (Number.isInteger(a.n) && a.n >= 1 && a.n <= 10)) && (a.spread == null || typeof a.spread === 'boolean') && (a.orAllIfLifeLe == null || (Number.isInteger(a.orAllIfLifeLe) && a.n != null)),
    txt: a => (a.n ? `send ${a.n} core${a.n === 1 ? '' : 's'} from ${a.spread ? 'any opposing "' + a.family + '" Nexuses' : 'an opposing "' + a.family + '" Nexus'}` : `send all cores from an opposing "${a.family}" Nexus`) + ' to the Void' + (a.orAllIfLifeLe != null ? `, or, if your Life is ${a.orAllIfLifeLe} or less, all cores from one such Nexus` : ''),
    cands: (c, a) => c.opp.nexus.filter(x => x.cores > 0 && !fxImmune(c.opp, x) && (CARDS[x.id].families || []).some(f => f.toLowerCase().includes(a.family.toLowerCase()))),
    can: (c, a) => FX_ACTIONS.NEXUS_CORES_TO_VOID.cands(c, a).length > 0,
    run: async (c, a) => {
      const L = FX_ACTIONS.NEXUS_CORES_TO_VOID.cands(c, a); if (!L.length) { c.ctx.did = false; return; }
      const nm = CARDS[c.src.id].name, total = L.reduce((t, x) => t + x.cores, 0), most = Math.max(...L.map(x => x.cores));
      let all = a.n == null;
      if (!all && a.orAllIfLifeLe != null && c.p.life <= a.orAllIfLifeLe) {
        const nAmt = Math.min(a.n, a.spread ? total : most);
        if (c.p.cpu) all = most > nAmt;
        else all = (await ask({ title: `✨ ${nm}`, peek: true, html: `Your Life is ${c.p.life}. Choose which cores go to the opposing Void.`,
          buttons: [{ label: `${a.n} core${a.n === 1 ? '' : 's'} from ${a.spread ? 'any Nexuses' : 'one Nexus'}`, cls: 'primary', value: false }, { label: 'All cores from one Nexus', cls: 'purple', value: true }] })) === true;
      }
      let k = 0;
      const pick = async (lst, what) => fxPickTarget(c, lst.slice().sort((x, y) => y.cores - x.cores), `✨ <b>${esc(nm)}</b><br>Tap the opposing Nexus ${what} (glowing).`);
      if (all) { const t = await pick(L, 'whose cores all go to the Void'); if (t) { k = t.cores; coreEvN(c.opp, t.uid, 'void', k, false); c.opp.void += t.cores; t.cores = 0; } }
      else if (!a.spread) { const t = await pick(L, `that loses ${a.n} core${a.n === 1 ? '' : 's'}`); if (t) { k = Math.min(a.n, t.cores); coreEvN(c.opp, t.uid, 'void', k, false); t.cores -= k; c.opp.void += k; } }
      else for (let j = 0; j < a.n; j++) {
        const lst = L.filter(x => x.cores > 0 && c.opp.nexus.includes(x)); if (!lst.length) break;
        const t = await pick(lst, `that loses core ${j + 1} of ${a.n}`); if (!t) break;
        coreEv(c.opp, 'core', t.uid, 'void'); t.cores--; c.opp.void++; k++;
      }
      c.ctx.did = k > 0; if (k) log(`${nm}: ${k} core${k === 1 ? '' : 's'} are sent to the opposing Void.`);
    } },
  /* v0.45 "for each differently named <family> family Brave you control, send an opposing Life to the Trash" (Agateram Unleash).
     Braves counted: combined on your Spirits/Nexuses and Brave cards on the Field as Spirits; distinct names. Not damage: one Burst check. */
  DESTROY_TOTAL: { chk: a => (a.max == null || (Number.isInteger(a.max) && a.max >= 1 && a.max <= 10)) && Number.isInteger(a.total) && (a.byCost === true ? a.total >= 1 && a.total <= 30 : a.total >= 1000 && a.total <= 100000), txt: a => a.byCost ? `destroy any number of opposing Spirits/Ultimates up to a total cost of ${a.total}` : `destroy any number of opposing Spirits up to a total of ${a.total} BP`,
    cands: (c, budget, a) => c.opp.spirits.filter(s => (a && a.byCost ? CARDS[s.id].cost : bpOf(s)) <= budget),
    can: (c, a) => FX_ACTIONS.DESTROY_TOTAL.cands(c, a.total + (a.boost && c.p.count >= a.boost.counterGe ? a.boost.n : 0), a).length > 0,
    run: async (c, a) => {
      let budget = a.total + (a.boost && c.p.count >= a.boost.counterGe ? a.boost.n : 0); const picked = [];       // v0.41: boost = { counterGe, n } (Dana Draw)
      for (let g = 0; g < (a.max || 10); g++) {      // v0.197 max: "up to three"
        const val = x => (a.byCost ? CARDS[x.id].cost : bpOf(x)), L = FX_ACTIONS.DESTROY_TOTAL.cands(c, budget, a).filter(s => !picked.includes(s)); if (!L.length) break;
        let t;
        if (c.p.cpu) t = L.slice().sort((x, y) => (val(y) - val(x)) || (y.cores - x.cores))[0];
        else {
          const v = await ask({ title: `✨ ${CARDS[c.src.id].name}`, peek: true, html: `Choose opposing Spirits to destroy. ${a.byCost ? 'Cost' : 'BP'} left: ${budget}.`,
            buttons: L.slice(0, 8).map(x => ({ label: `${CARDS[x.id].name} (${a.byCost ? 'cost ' + val(x) : val(x) + ' BP'})`, cls: 'primary', value: x.uid })).concat([{ label: picked.length ? 'Done' : 'Destroy none', cls: 'cancel', value: null }]) });
          t = L.find(x => x.uid === v);
        }
        if (!t) break;
        picked.push(t); budget -= val(t);
      }
      c.ctx.destroyed = [];
      for (const t of picked) if (c.opp.spirits.includes(t)) { removeSpirit(c.opp, t, 'destroyed', true); c.ctx.destroyed.push(t); }
      checkDepletion(c.opp);
      c.ctx.did = c.ctx.destroyed.length > 0;
    } },
  /* banish one of the cards destroyed by the previous action of this effect (it moves from the Trash to the Banished zone) */
  BANISH_DESTROYED: { chk: () => true, txt: () => 'banish one of the Spirits destroyed by this effect',
    cands: c => (c.ctx.destroyed || []).filter(t => c.opp.trash.includes(t) || c.opp.standby.includes(t)),
    can: c => FX_ACTIONS.BANISH_DESTROYED.cands(c).length > 0,
    run: async c => {
      const t = await chooseCard(c, FX_ACTIONS.BANISH_DESTROYED.cands(c), `✨ ${CARDS[c.src.id].name}`, 'Choose a destroyed card to banish.', false);
      if (!t) { c.ctx.did = false; return; }
      removeFrom(c.opp.trash, t); removeFrom(c.opp.standby, t); c.opp.removed.push(t); log(`${CARDS[c.src.id].name}: ${CARDS[t.id].name} is banished.`);
    } },
  /* "By doing X, do Y" (Eternal Rule Manual FAQ, About Effects in General Q5): X must be performable, X is not done when Y cannot be done,
     and the player chooses whether to do it (ask:true asks the human; the CPU does it). {do:'BY', cost:{action X}, then:[actions Y], ask} */
  /* v0.196 PAY_COST {n}: the "pay N cost" step of "you can pay one cost. If you've done so, ..." (BY.cost); the cores go to the Trash like an Invoke cost */
  PAY_COST: { chk: a => Number.isInteger(a.n) && a.n >= 1 && a.n <= 5,
    txt: a => `pay ${a.n} cost${a.n === 1 ? '' : 's'}`,
    can: (c, a) => coresAvailable(c.p) >= a.n,
    run: async (c, a) => { if (!(await payInvokeCost(c.p, c.src, { pay: a.n }))) c.ctx.did = false; } },
  BY: { chk: a => !!a.cost && typeof a.cost === 'object' && a.cost.do !== 'BY' && !parseActionList([a.cost]).error && Array.isArray(a.then) && a.then.length >= 1 && a.then.length <= 4 && a.then.every(x => x && x.do !== 'BY') && !parseActionList(a.then).error && (a.ask == null || typeof a.ask === 'boolean'),
    txt: a => `${a.ask ? 'you can, ' : ''}by ${FX_ACTIONS[a.cost.do].txt(a.cost)}, ${a.then.map(x => FX_ACTIONS[x.do].txt(x)).join(', then ')}`,
    can: (c, a) => { const ok = x => !FX_ACTIONS[x.do].can || FX_ACTIONS[x.do].can(c, x); return ok(a.cost) && ok(a.then[0]); },
    run: async (c, a) => {
      const nm = CARDS[c.src.id].name;
      if (!FX_ACTIONS.BY.can(c, a)) { c.ctx.did = false; return; }
      if (a.ask && !c.p.cpu && !(await ask({ title: `✨ ${nm}`, peek: true, html: `You can ${esc(FX_ACTIONS.BY.txt(Object.assign({}, a, { ask: false })))}.`, buttons: [{ label: 'Do it', cls: 'primary', value: true }, { label: 'Skip', cls: 'cancel', value: false }] }))) { c.ctx.did = false; return; }
      c.ctx.did = true; await FX_ACTIONS[a.cost.do].run(c, a.cost);
      if (c.ctx.did === false || G.over) { c.ctx.did = false; return; }
      let last = true;                                    // v0.45: {"prev":true} inside "then" tests the previous "then" action
      for (const x of a.then) {
        if (G.over) return;
        c.ctx.prev = last;
        if (x.if && !fxIf(c.p, c.opp, x.if, c.ctx)) { last = false; continue; }
        c.ctx.did = true; await FX_ACTIONS[x.do].run(c, x); last = c.ctx.did !== false;
      }
      c.ctx.did = true;
    } }
});

/* This part loads after 02k, whose load-time pass wraps every action's cands() with the immunity
   filter (trash-safe cards, opposing cards unaffected by this effect). Run it again so the entries
   defined here get the same wrapper; it is idempotent. */
wrapImmunity(Object.values(FX_ACTIONS));
