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
