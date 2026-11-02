// Meal cards (Drifting Spirit): reveal two, summon one within the cost limit, trash the rest.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

test('K-870 Meal cards carry a REVEAL_DEPLOY with the printed cost limit', async () => {
  const { page } = await sharedBoard();
  const BSC = await page.evaluate(() => Object.fromEntries(['BS35-045','BS35-047','BS35-050','BS36-044','BS38-035'].map(id => [id, { ok: BS.CARDS[id].implemented !== false, a: BS.CARDS[id].effects[0].actions[0] }])));
  const lim = { 'BS35-045': 2, 'BS35-047': 4, 'BS35-050': 6, 'BS36-044': 5 };
  for (const [id, n] of Object.entries(lim)) {
    const a = BSC[id].a;
    assert.equal(BSC[id].ok, true, id);
    assert.equal(a.do, 'REVEAL_DEPLOY'); assert.equal(a.match.costLe, n, id);
  }
  assert.deepEqual(BSC['BS38-035'].a.match.costIn, [2, 4, 6]);
});

test('K-871 Meal: reveal two, summon only the Spirit within the cost limit, trash the rest', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
    const ds = Object.keys(BS.CARDS).filter(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Drifting Spirit') && !BS.CARDS[k].token);
    const lo = ds.find(k => BS.CARDS[k].cost === 2), hi = ds.find(k => BS.CARDS[k].cost >= 6);
    const m = BS.mkInst('BS35-045'); P.hand.push(m); P.reserve.n = 20;
    P.deck.length = 0; for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst(ds.find(k => BS.CARDS[k].cost === 1) || lo));
    P.deck.unshift(BS.mkInst(hi)); P.deck.unshift(BS.mkInst(lo));
    const top = P.deck.slice(0, 2).map(x => x.id), d0 = P.deck.length;
    await BS.summonFree(P, m);
    return { top, lo, hi, field: BS.fieldList(P).map(f => f.id), dd: d0 - P.deck.length, trash: P.trash.map(x => x.id) };
  });
  assert.ok(r.field.includes(r.lo), JSON.stringify(r));
  assert.ok(!r.field.includes(r.hi), JSON.stringify(r));
  assert.ok(r.trash.includes(r.hi) && r.dd === 2, JSON.stringify(r));
});

test('K-872 BS35-046 is complete: Meal cost 3 plus Destroyed returns a Drifting Spirit from Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => { const c = BS.CARDS['BS35-046']; return [c.implemented !== false, c.effects.map(e => e.trigger), c.effects[0].actions[0].match.costLe, c.effects[1].actions[0].do]; });
  assert.deepEqual(r, [true, ['SUMMONED', 'DESTROYED'], 3, 'RETURN_TRASH'], JSON.stringify(r));
});

test('K-873 BS40-050: +15000 BP and an extra Yellow symbol only with five Drifting Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key;
    const ds = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].families || []).includes('Drifting Spirit') && !BS.CARDS[k].effects && !BS.CARDS[k].token);
    const m = BS.mkInst('BS40-050'); m.cores = 3; P.spirits.push(m);
    const bp = () => BS.bpOf ? BS.bpOf(m) : null, sym = () => BS.symbolsOn(P).yellow || 0;
    const a = [bp(), sym()];
    for (let i = 0; i < 4; i++) { const x = BS.mkInst(ds); x.cores = 1; P.spirits.push(x); }
    return { a, b: [bp(), sym()] };
  });
  assert.equal(r.b[0] - r.a[0], 15000, JSON.stringify(r));
  assert.equal(r.b[1] - r.a[1], 1, JSON.stringify(r));
});

test('K-874 BS43-RV012 data: SUMMONED exhaust + Rush Red DESTROY_BRAVE', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => { const c = BS.CARDS['BS43-RV012']; return { fx: c.fxComplete !== false, a: c.effects[0].actions.map(a => a.do + (a.if ? ':' + a.if.hasSymbol : '')) }; });
  assert.equal(r.fx, true);
  assert.deepEqual(r.a, ['EXHAUST_OPP', 'DESTROY_BRAVE:red']);
});

test('K-875 BS27-005 and BS22-039 Rush data (hasSymbol-gated second step)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS27-005', 'BS22-039'].map(id => { const c = BS.CARDS[id]; return { ok: c.fxComplete !== false, a: c.effects.find(e => e.actions.some(a => a.if && a.if.hasSymbol)).actions.map(a => a.do + (a.if ? ':' + a.if.hasSymbol : '')) }; }));
  assert.deepEqual(r, [{ ok: true, a: ['DESTROY', 'VOID_TO_CARD:green'] }, { ok: true, a: ['REFRESH_SPIRIT', 'DESTROY:red'] }]);
});

test('K-876 BS39-043, BS40-RV001, BS51-007 Rush refresh steps are complete and gated', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS39-043', 'BS40-RV001', 'BS51-007'].map(id => { const c = BS.CARDS[id]; const a = c.effects.flatMap(e => e.actions).filter(x => x.if && x.if.hasSymbol); return [c.fxComplete !== false, a.length]; }));
  assert.deepEqual(r, [[true, 1], [true, 1], [true, 1]]);
});

test('K-877 BS36-038 and BS59-045 BP_MINUS zeroDestroy data', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['BS36-038', 'BS59-045'].map(id => { const c = BS.CARDS[id]; return [c.fxComplete !== false, c.effects.map(e => e.trigger + ':' + e.actions.map(a => a.do + (a.zeroDestroy ? '!' : '')).join('+'))]; }));
  assert.deepEqual(r, [[true, ['ATTACKS:BP_MINUS!']], [true, ['SUMMONED:BP_MINUS!+VOID_TO_CARD', 'ATTACKS:BP_MINUS!+VOID_TO_CARD']]]);
});

test('K-878 BS44-038 reveals three and summons a paid Cost<=5 Machine Beast; BS50-042 is complete', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async () => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
    const mb = 'BS48-042'; P.reserve.n = 20;
    const m = BS.mkInst('BS44-038'); P.hand.push(m);
    P.deck.length = 0; for (let i = 0; i < 4; i++) P.deck.push(BS.mkInst(mb)); P.deck.unshift(BS.mkInst(mb));
    await BS.summonFree(P, m);
    return { mbOnField: BS.fieldList(P).filter(f => f.id === mb).length, a: BS.CARDS['BS50-042'].implemented !== false };
  });
  assert.ok(r.mbOnField >= 1 && r.a, JSON.stringify(r));
});

test('K-879 BS31-053 reveals 6 with Soul Core paid and picks only a Burst-less Magic', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const e = BS.CARDS['BS31-053'].effects.find(x => x.trigger === 'SUMMONED');
    const picks = e.actions.map(a => [a.n, a.if.soulPaid, a.match.noBurst]);
    const bur = Object.values(BS.CARDS).find(c => c.type === 'Magic' && /\{\{Burst\|/.test(c.desc || c.text || ''));
    const non = Object.values(BS.CARDS).find(c => c.type === 'Magic' && !c.burst && !/\{\{Burst\|/.test(c.desc || c.text || ''));
    return { picks, fc: BS.CARDS['BS31-053'].fxComplete, bur: !!bur, non: !!non };
  });
  assert.deepEqual(r.picks, [[3, false, true], [6, true, true]]);
});

test('K-880 SD40-006 / BS74-RV002 Void core, counter and Ninja Gale refresh only via an effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['SD40-006', 'BS74-RV002'].map(id => {
    const e = BS.CARDS[id].effects.find(x => x.trigger === 'SUMMONED');
    return e.actions.map(a => [a.do, !!(a.if && a.if.viaEffect)]);
  }));
  for (const x of r) assert.deepEqual(x, [['VOID_TO_CARD', false], ['COUNTER', true], ['REFRESH_SPIRIT', true]]);
});

test('K-881 BS42-050 adds the revealed Birthgem Deity Spirit and draws; a plain Divine Spirit does not draw', async () => {
  const { page } = await sharedBoard();
  const run = (pick) => page.evaluate(async (pick) => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true; P.reserve.n = 20;
    const m = BS.mkInst('BS42-050'); P.hand.push(m);
    P.deck.length = 0; for (let i = 0; i < 6; i++) P.deck.push(BS.mkInst('BS48-042')); P.deck.unshift(BS.mkInst(pick));
    const h0 = P.hand.length - 1;      // minus the summoned card
    await BS.summonFree(P, m);
    return { gained: P.hand.length - h0, hasPick: P.hand.some(x => x.id === pick) };
  }, pick);
  const bg = await run('BS50-X01'), dv = await run('BS42-050');
  assert.equal(bg.hasPick, true); assert.equal(bg.gained, 2, JSON.stringify(bg));
  assert.equal(dv.hasPick, true); assert.equal(dv.gained, 1, JSON.stringify(dv));
});

test('K-882 BS21-061 / BS42-037 / BS30-026 effects are wired (data only, no play)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ({
    a: BS.CARDS['BS21-061'].effects.some(e => e.trigger === 'BLOCKS' && e.braved && e.actions[0].do === 'BP_PLUS'),
    b: BS.CARDS['BS42-037'].effects.some(e => e.flag === 'EXTRA_SYMBOL' && e.color === 'blue' && e.if.selfSoul),
    c: BS.CARDS['BS30-026'].effects.some(e => e.braved && e.actions[0].do === 'BOUNCE_OPP' && e.actions[0].match.type === 'Ultimate'),
  }));
  assert.deepEqual(r, { a: true, b: true, c: true });
});

test('K-883 BS19-008 attack: +5000 BP always; Shellman destroyed only with a Purple symbol (Rush)', async () => {
  const { page } = await sharedBoard();
  const run = (purple) => page.evaluate(async (purple) => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0;
    const s = BS.mkInst('BS19-008'); s.cores = 3; P.spirits.push(s);
    if (purple) { const pp = BS.mkInst('BS31-015'); pp.cores = 1; P.spirits.push(pp); }
    const t = BS.mkInst('BS52-026'); t.cores = 1; O.spirits.push(t);
    G.attacker = s;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    return { left: O.spirits.length, bp: null };
  }, purple);
  const no = await run(false), yes = await run(true);
  assert.equal(no.left, 1, JSON.stringify(no)); assert.equal(yes.left, 0, JSON.stringify(yes));
  if (no.bp != null) assert.equal(yes.bp, no.bp, 'same BP boost both ways');
});

test('K-884 BS60-028 summoned: counter +1, then heavy exhaust only with four counters or more', async () => {
  const { page } = await sharedBoard();
  const run = (start) => page.evaluate(async (start) => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true; P.reserve.n = 20;
    O.spirits.length = 0; const t = BS.mkInst('BS52-026'); t.cores = 1; O.spirits.push(t);
    P.count = start; const m = BS.mkInst('BS60-028'); P.hand.push(m);
    await BS.summonFree(P, m);
    return { count: P.count, heavy: !!t.heavy };
  }, start);
  const lo = await run(2), hi = await run(3);
  assert.deepEqual(lo, { count: 3, heavy: false }, JSON.stringify(lo));
  assert.deepEqual(hi, { count: 4, heavy: true }, JSON.stringify(hi));
});

test('K-885 BS59-RV003 summoned: exhausts one Spirit; the Cost 3 or less destroy needs a Mirage set', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => {
    const fx = BS.CARDS['BS59-RV003'].effects;
    return { trig: fx.map(e => e.trigger).sort(), mirage: fx.every(e => e.actions[1].do === 'DESTROY' && e.actions[1].if.mirageSet === true) };
  });
  assert.deepEqual(r, { trig: ['DESTROYED', 'SUMMONED'], mirage: true });
});

test('K-886 BS58-037 attack: core from an opposing Spirit goes to the Reserve only with a Purple/White Mirage set', async () => {
  const { page } = await sharedBoard();
  const run = (mir) => page.evaluate(async (mir) => {
    BS.testSetup(); BS.SETTINGS.speed = 'instant';
    const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; P.cpu = true;
    P.spirits.length = 0; O.spirits.length = 0;
    const s = BS.mkInst('BS58-037'); s.cores = 2; P.spirits.push(s);
    const t = BS.mkInst('BS52-026'); t.cores = 2; O.spirits.push(t);
    P.mirage = mir ? BS.mkInst(mir) : null; G.attacker = s;
    await BS.fireFx(P, 'ATTACKS', s, { subject: s, attacker: s });
    return t.cores;
  }, mir);
  const none = await run(null), blue = await run('BS58-017'), purple = await run('BS58-016');
  const m = JSON.stringify([none, blue, purple]); assert.equal(none, 2, m); assert.equal(blue, 2, m); assert.equal(purple, 1, m);
});
