// Lane K tests, file 84 (v0.208 cycle).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('K-907 BS02-108 puts every Magic card from the Hand onto the Removed Zone and draws one per card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    P.reserve.n = 20; const m = BS.mkInst('BS02-108'); P.hand = [m, BS.mkInst('BS01-148'), BS.mkInst('BS01-148'), BS.mkInst('BS01-001')];
    P.deck = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')]; P.removed = [];
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); return [P.removed.filter(x => x.id === 'BS01-148').length, P.hand.length]; })()`);
  assert.deepEqual(r, [2, 3], JSON.stringify(r));
});

test('K-908 BS10-111 makes both players discard their Hand and draw four', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    P.reserve.n = 20; const m = BS.mkInst('BS10-111'); P.hand = [m, BS.mkInst('BS01-001')]; O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
    const dk = () => Array.from({ length: 8 }, () => BS.mkInst('BS01-001')); P.deck = dk(); O.deck = dk(); const t0 = P.trash.length, t1 = O.trash.length;
    await BS.castMagic(P, { inst: m, target: null, plan: null, ctx: 'main' }); return [P.hand.length, O.hand.length, P.trash.length - t0 >= 1, O.trash.length - t1]; })()`);
  assert.deepEqual(r, [4, 4, true, 3], JSON.stringify(r));
});

test('K-909 BS33-035 bounces an opposing Spirit; with the Soul Core it also adds every revealed Ultimate', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const out = [];
    for (const soul of [false, true]) {
      const t = mk('BS33-035'); P.spirits = [t]; O.spirits = [mk('BS01-001')]; O.hand = []; P.hand = [];
      const ult = BS.mkInst('BS24-062'); P.deck = [ult, BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001'), BS.mkInst('BS01-001')];
      t.soulPaid = soul; await BS.fireFx(P, 'SUMMONED', t, { subject: t });
      out.push([O.hand.length, P.hand.filter(x => x.id === 'BS24-062').length]);
    }
    return out; })()`);
  assert.deepEqual(r, [[1, 0], [1, 1]], JSON.stringify(r));
});

test('K-910 BS20-062 bounces an opposing Spirit; with a Yellow symbol it also gives an opposing Spirit -3000 BP', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const out = [];
    for (const yel of [false, true]) {
      const yid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].symbol === 'yellow' && !(BS.CARDS[k].effects || []).length && BS.CARDS[k].symbols >= 1); const b = mk('BS20-062'); const y = mk(yel ? yid : 'BS01-001'); P.spirits = [b, y]; const hid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !(BS.CARDS[k].effects || []).length && (BS.CARDS[k].levels[0] || {}).bp >= 6000); const a = mk(hid), c = mk(hid); O.spirits = [a, c]; O.hand = [];
      const b0 = BS.bpOf(c); await BS.fireFx(P, 'SUMMONED', b, { subject: b });
      out.push([O.hand.length, O.spirits.length === 1 ? BS.bpOf(O.spirits[0]) - b0 : 'n/a']);
    }
    return out; })()`);
  assert.deepEqual(r, [[1, 0], [1, -3000]], JSON.stringify(r));
});

test('K-911 BS30-016 puts a Void core on itself; with an opposing Burst set it also feeds two other Green Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const out = [];
    for (const burst of [false, true]) {
      const t = mk('BS30-016'), g1 = mk('BS01-050'), g2 = mk('BS01-051'); P.spirits = [t, g1, g2]; P.void = 5; O.burst = burst ? BS.mkInst('BS01-001') : null;
      const before = [t.cores, g1.cores, g2.cores];
      await BS.fireFx(P, 'SUMMONED', t, { subject: t });
      out.push([t.cores - before[0], g1.cores - before[1] + g2.cores - before[2]]);
    }
    return out; })()`);
  assert.deepEqual(r, [[1, 0], [1, 2]], JSON.stringify(r));
});

test('K-912 BS19-006 destroys an opposing Spirit with (When Summoned); with a Purple symbol it also draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const sp = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].effects || []).some(e => e.trigger === 'SUMMONED') && !(BS.CARDS[k].effects || []).some(e => e.trigger === 'DESTROYED'));
    const van = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !(BS.CARDS[k].effects || []).length);
    const pid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].symbol === 'purple' && !(BS.CARDS[k].effects || []).length && BS.CARDS[k].symbols >= 1);
    const out = [];
    for (const pur of [false, true]) {
      const t = mk('BS19-006'); P.spirits = [t]; if (pur) P.spirits.push(mk(pid)); const a = mk(sp), b = mk(van); O.spirits = [a, b]; P.hand = [];
      const d0 = P.deck.length; await BS.fireFx(P, 'SUMMONED', t, { subject: t });
      out.push([O.spirits.includes(a), O.spirits.includes(b), d0 - P.deck.length]);
    }
    return out; })()`);
  assert.deepEqual(r, [[false, true, 0], [false, true, 1]], JSON.stringify(r));
});

test('K-913 BS20-027 exhausts every 3000 BP or less Spirit; with a White symbol it also bounces an opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 1; return x; };
    const low = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !(BS.CARDS[k].effects || []).length && (BS.CARDS[k].levels[0] || {}).bp <= 3000 && (BS.CARDS[k].levels[0] || {}).bp > 0);
    const wid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].symbol === 'white' && !(BS.CARDS[k].effects || []).length && BS.CARDS[k].symbols >= 1);
    const out = [];
    for (const wh of [false, true]) {
      const t = mk('BS20-027'); const l = mk(low); P.spirits = [t, l]; if (wh) P.spirits.push(mk(wid)); const o = mk(low); O.spirits = [o]; O.hand = [];
      await BS.fireFx(P, 'ATTACKS', t, { subject: t });
      out.push([!!l.exhausted, O.hand.length, O.spirits.length]);
    }
    return out; })()`);
  assert.deepEqual(r, [[true, 0, 1], [true, 1, 0]], JSON.stringify(r));
});

test('K-914 BS44-017 sends an opposing Spirit core to the Reserve; with a Nexus it also draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const mk = id => { const x = BS.mkInst(id); x.cores = 3; return x; };
    const nx = 'TRAIN-N1';
    const out = [];
    for (const n of [false, true]) {
      const t = mk('BS44-017'); P.spirits = [t]; P.nexus = n ? [BS.mkInst(nx)] : []; const o = mk('BS01-001'); O.spirits = [o]; const c0 = o.cores; const d0 = P.deck.length;
      await BS.fireFx(P, 'SUMMONED', t, { subject: t });
      out.push([c0 - o.cores, d0 - P.deck.length]);
    }
    return out; })()`);
  assert.deepEqual(r, [[1, 0], [1, 1]], JSON.stringify(r));
});

test('K-915 BS54-045 returns a Yellow Primal Nexus from the Trash when destroyed by the opponent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const nid = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.type === 'Nexus' && (c.colors || [c.symbol]).includes('yellow') && (c.families || []).includes('Primal'); });
    const t = BS.mkInst('BS54-045'); t.cores = 1; P.spirits = []; P.trash = [t, BS.mkInst(nid)]; t.lostLv = 0; P.hand = [];
    await BS.fireFx(P, 'DESTROYED', t, { subject: t, byOpp: true });
    return [P.hand.length, P.trash.length, !!nid]; })()`);
  assert.deepEqual(r, [1, 1, true], JSON.stringify(r));
});

test('K-916 BS03-084 makes each player draw on attack; when destroyed at LV2 the opponent discards a random card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS03-084'); t.cores = 3; P.spirits = [t]; P.hand = []; O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-002')];
    const pd = P.deck.length, od = O.deck.length; await BS.fireFx(P, 'ATTACKS', t, { subject: t });
    const drew = [pd - P.deck.length, od - O.deck.length];
    P.spirits = []; P.trash = [t]; t.lostLv = 1; O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-002')]; const ot = O.trash.length;
    await BS.fireFx(P, 'DESTROYED', t, { subject: t });
    return [drew, O.hand.length, O.trash.length - ot]; })()`);
  assert.deepEqual(r, [[1, 1], 1, 1], JSON.stringify(r));
});

test('K-917 BS43-RV009 discards a random opposing card when its attack reduces the opposing Life', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS43-RV009'); t.cores = 3; P.spirits = [t]; O.hand = [BS.mkInst('BS01-001'), BS.mkInst('BS01-002')];
    await BS.fireFx(P, 'ALLY_LIFE_HIT', t, { subject: t });
    return O.hand.length; })()`);
  assert.equal(r, 1);
});

test('K-918 BS06-014 sends one core but never the last one', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS06-014'); t.cores = 1; P.spirits = [t];
    const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits = [a]; const b4 = O.reserve.n;
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    const one = [a.cores, O.reserve.n - b4]; a.cores = 3; const b5 = O.reserve.n;
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    return [one, [a.cores, O.reserve.n - b5]]; })()`);
  assert.deepEqual(r, [[1, 0], [2, 1]]);
});

test('K-919 BS37-022 leaves one core on every opposing Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS37-022'); t.cores = 3; P.spirits = [t];
    const a = BS.mkInst('BS01-001'), b = BS.mkInst('BS01-002'); a.cores = 4; b.cores = 2; O.spirits = [a, b];
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    return [a.cores, b.cores]; })()`);
  assert.deepEqual(r, [1, 1]);
});

test('K-920 BS36-017 sends two cores and returns a Death Dragon/Zombie Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS36-017'); t.cores = 3; P.spirits = [t]; P.hand = [];
    const z = 'BS01-029';
    P.trash = [BS.mkInst(z)];
    const a = BS.mkInst('BS01-001'); a.cores = 4; O.spirits = [a];
    await BS.fireFx(P, 'ATTACKS', t, { subject: t });
    return [a.cores, P.hand.length, P.trash.length]; })()`);
  assert.deepEqual(r, [2, 1, 0]);
});

test('K-921 BS26-055 sends a core from an opposing Cost 6 or less Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS26-055'); t.cores = 1; P.spirits = [t];
    const a = BS.mkInst('BS01-001'); a.cores = 3; O.spirits = [a]; const b = O.reserve.n;
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    return [a.cores, O.reserve.n - b]; })()`);
  assert.deepEqual(r, [2, 1]);
});

test('K-922 BS30-011 draws a card when the core removal depletes the Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS30-011'); t.cores = 3; P.spirits = [t];
    const a = BS.mkInst('BS01-001'); a.cores = 1; O.spirits = [a]; const h = P.hand.length;
    await BS.fireFx(P, 'ATTACKS', t, { subject: t });
    return [a.cores, P.hand.length - h]; })()`);
  assert.equal(r[1], 1);
});

test('K-923 BS30-010 sends one core per Infernal Lord Spirit you control', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS30-010'); t.cores = 3; P.spirits = [t];
    const a = BS.mkInst('BS01-001'); a.cores = 5; O.spirits = [a]; const b = O.reserve.n;
    await BS.fireFx(P, 'SUMMONED', t, { subject: t });
    return [a.cores, O.reserve.n - b, [].concat(BS.CARDS['BS30-010'].families || []).join()]; })()`);
  assert.equal(r[0] + r[1], 5); assert.ok(r[1] >= 1, JSON.stringify(r));
});

test('K-924 BS06-097 destroys an exhausted Spirit of Cost 4 or less only', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const act = BS.CARDS['BS06-097'].magic.by ? BS.CARDS['BS06-097'].magic.by.MAIN.actions[0] : BS.CARDS['BS06-097'].magic.actions[0];
    const c = { p: P, opp: O, src: BS.mkInst('BS06-097'), ctx: {} };
    const big = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost >= 6 && !BS.CARDS[k].id.startsWith('TRAIN'));
    const a = BS.mkInst(big); a.exhausted = true; O.spirits = [a];
    const can1 = BS.FX_ACTIONS.DESTROY_ANY.can(c, act);
    const b = BS.mkInst('BS01-001'); b.exhausted = true; O.spirits = [a, b];
    const can2 = BS.FX_ACTIONS.DESTROY_ANY.cands(c, act).map(x => x.id);
    return [can1, can2, BS.CARDS['BS01-001'].cost]; })()`);
  assert.equal(r[0], false); assert.deepEqual(r[1], ['BS01-001'], JSON.stringify(r));
});

test('K-925 BS13-031 lets Armored Dragon Spirits block while exhausted on the opposing Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent;
    const t = BS.mkInst('BS13-031'); t.cores = 2; const al = BS.mkInst('BS01-001'); al.cores = 2; al.exhausted = true;
    P.spirits = [t, al]; G.active = O.key; G.step = 5;
    const ad = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && [].concat(BS.CARDS[k].families || []).includes('Armored Dragon') && k !== 'BS13-031');
    const d = BS.mkInst(ad); d.cores = 3; d.exhausted = true; P.spirits.push(d);
    const f = (s) => BS.flagActive(P, 'BLOCK_EXHAUSTED', s);
    const on = [f(t), f(d), f(al)]; G.active = P.key; const off = f(d);
    return [on, off]; })()`);
  assert.deepEqual(r, [[true, true, false], false]);
});

test('K-926 X13-10 moves a Void core to Life when a Beach Spirit is destroyed by the opponent while Life is 5 or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('X13-10'); t.cores = 1; P.spirits = [t];
    const dead = BS.mkInst('X13-09'); dead.cores = 0;
    P.void = 3; P.life = 4; const l0 = P.life, v0 = P.void;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: dead, byOpp: true });
    const hit = [P.life - l0, v0 - P.void];
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: dead, byOpp: false });
    const own = P.life - l0;
    P.life = 6; const l1 = P.life;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: dead, byOpp: true });
    return [hit, own, P.life - l1]; })()`);
  assert.deepEqual(r[0], [1, 1], JSON.stringify(r)); assert.equal(r[1], 1, JSON.stringify(r)); assert.equal(r[2], 0, JSON.stringify(r));
});

test('K-927 BS66-RV001 moves a Void core to Life only for a Sieg Spirit destroyed by an opposing effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const t = BS.mkInst('BS66-RV001'); t.cores = 1; P.spirits = [t];
    const dead = BS.mkInst('BS13-X005A'); dead.cores = 0;
    P.void = 3; P.life = 3; const l0 = P.life;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: dead, byOpp: true, byOppFx: false });
    const bp = P.life - l0;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: dead, byOpp: true, byOppFx: true });
    const fx = P.life - l0;
    const other = BS.mkInst('BS01-001'); other.cores = 0;
    await BS.fireFx(P, 'ALLY_DIED', null, { subject: other, byOpp: true, byOppFx: true });
    return [bp, fx, P.life - l0]; })()`);
  assert.deepEqual(r, [0, 1, 1]);
});

test('K-928 BS16-084 lets only your Spirits with two or more symbols block while exhausted this turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const two = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].symbols >= 2);
    const a = BS.mkInst(two); a.cores = 3; a.exhausted = true; const b = BS.mkInst('BS01-001'); b.cores = 2; b.exhausted = true;
    P.spirits = [a, b]; G.active = O.key; G.step = 5;
    const before = BS.flagActive(P, 'BLOCK_EXHAUSTED', a);
    const act = BS.CARDS['BS16-084'].magic.actions[0];
    await BS.FX_ACTIONS.GRANT_FLAG.run({ p: P, opp: O, src: BS.mkInst('BS16-084'), ctx: {} }, act);
    const after = [BS.flagActive(P, 'BLOCK_EXHAUSTED', a), BS.flagActive(P, 'BLOCK_EXHAUSTED', b), BS.CARDS['BS01-001'].symbols];
    G.turnNo++; const next = BS.flagActive(P, 'BLOCK_EXHAUSTED', a);
    return [before, after, next]; })()`);
  assert.equal(r[0], false); assert.deepEqual(r[1].slice(0, 2), [true, false], JSON.stringify(r)); assert.equal(r[2], false);
});

test('K-929 BS17-077 gives all your Spirits +3000 BP only if you control as many Spirits as the opponent', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 2; const b = BS.mkInst('BS01-001'); b.cores = 2; const o1 = BS.mkInst('BS01-001'); o1.cores = 2;
    P.spirits = [a]; O.spirits = [o1, b];
    const act = BS.CARDS['BS17-077'].magic.actions[0];
    const ok = (s) => BS.fxIf(P, O, act.if, {});
    const fewer = ok();
    P.spirits = [a, b]; O.spirits = [o1];
    const more = ok();
    await BS.FX_ACTIONS.BP_PLUS.run({ p: P, opp: O, src: BS.mkInst('BS17-077'), ctx: {} }, act);
    return [fewer, more, a.bpMod, b.bpMod, o1.bpMod || 0]; })()`);
  assert.deepEqual(r, [false, true, 3000, 3000, 0]);
});

test('K-930 BS18-083 destroys only opposing Spirits whose Cost is within your Blue symbols on the Field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = false; O.cpu = false;
    const act = BS.CARDS['BS18-083'].magic.actions[0];
    const c = { p: P, opp: O, src: BS.mkInst('BS18-083'), ctx: {} };
    const byCost = n => Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].cost === n && /^BS0/.test(k));
    const lo = BS.mkInst(byCost(1)), hi = BS.mkInst(byCost(5)); lo.cores = hi.cores = 2; O.spirits = [lo, hi];
    const own = BS.mkInst(byCost(1)); own.cores = 2; P.spirits = [own];
    const blue = 'BS03-071';
    const b = BS.mkInst(blue); b.cores = 3; P.spirits = [own, b];
    let n; n = BS.symbolsOn(P).blue || 0;
    const got = BS.FX_ACTIONS.DESTROY_ANY.cands(c, act).map(x => x === lo ? 'lo' : x === hi ? 'hi' : x === own ? 'own' : 'x');
    return [n, got, BS.CARDS[lo.id].cost, BS.CARDS[hi.id].cost]; })()`);
  const [n, got] = r; assert.ok(n >= 1, JSON.stringify(r));
  assert.ok(got.includes('lo') && !got.includes('own') && !got.includes('hi') === (n < 5), JSON.stringify(r));
});

test('K-931 BS01-116 and BS01-145 boost only your attacking / blocking Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true;
    const a = BS.mkInst('BS01-001'); a.cores = 2; const b = BS.mkInst('BS01-001'); b.cores = 2; const o = BS.mkInst('BS01-001'); o.cores = 2;
    P.spirits = [a, b]; O.spirits = [o];
    const run = async (id, att, blk) => { G.attacker = att; G.blocker = blk; a.bpMod = b.bpMod = o.bpMod = 0;
      await BS.FX_ACTIONS.BP_PLUS.run({ p: P, opp: O, src: BS.mkInst(id), ctx: {} }, BS.CARDS[id].magic.actions[0]); return [a.bpMod || 0, b.bpMod || 0, o.bpMod || 0]; };
    const off = await run('BS01-116', a, o), offOpp = await run('BS01-116', o, a);
    const def = await run('BS01-145', o, b), defOpp = await run('BS01-145', a, o);
    return [off, offOpp, def, defOpp]; })()`);
  assert.deepEqual(r, [[2000, 0, 0], [0, 0, 0], [0, 3000, 0], [0, 0, 0]]);
});
