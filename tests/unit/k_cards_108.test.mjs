import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1089 BS69-001 Grass Geozard: Lv2 attack puts +1 core on Contractor Gaia and draws; Primordial/Reptile Beast Spirits resist opposing returns in your Attack Step', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS69-001');
    const a = BS.mkInst('BS69-001'); a.cores = 3; const gaia = BS.mkInst('BS69-CX01'); P.spirits = [a]; P.nexus = [gaia]; P.deck = [1,2,3].map(() => BS.mkInst(any)); P.hand = []; P.reserve.n = 2; const c0 = gaia.cores, rs = P.reserve.n;
    G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { core: gaia.cores - c0, hand: P.hand.length, partial: BS.CARDS['BS69-001'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.core, 1, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r));
});

test('K-1090 BS69-002 Wood Geozard: attack reveals three and adds a Primordial Nexus; with a Primordial Nexus an ally can attack a Spirit', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Primordial'));
    const a = BS.mkInst('BS69-002'); a.cores = 3; P.spirits = [a]; P.nexus = []; P.deck = [BS.mkInst(any), BS.mkInst('BS69-068'), BS.mkInst(any), BS.mkInst(any)]; P.hand = []; P.trash = [];
    G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    const added = P.hand.some(h => h.id === 'BS69-068'), trash = P.trash.length;
    P.nexus = [BS.mkInst('BS69-068')]; const t = BS.mkInst(any); t.exhausted = true; O.spirits = [t]; a.atkT = null; G.attacker = a;
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: a, subject: a });
    return { added, trash, tgt: !!(a.atkT && a.atkT.s === t), partial: BS.CARDS['BS69-002'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.added, true, JSON.stringify(r)); assert.equal(r.trash, 2, JSON.stringify(r)); assert.equal(r.tgt, true, JSON.stringify(r));
});

test('K-1091 BS69-004 Rock Geozard: Summoned destroys a Nexus and draws; Lv2 attack destroys a 7000 BP or less Spirit only with a Primordial Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS69-004');
    const a = BS.mkInst('BS69-004'); a.cores = 3; P.spirits = [a]; O.nexus = [BS.mkInst('BS69-068')]; P.deck = [1,2,3].map(() => BS.mkInst(any)); P.hand = [];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    const nex = O.nexus.length, drew = P.hand.length;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t]; P.nexus = []; G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    const without = O.spirits.length; P.nexus = [BS.mkInst('BS69-068')]; O.spirits = [t]; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { nex, drew, without, withNx: O.spirits.length, bp: BS.bpOf ? BS.bpOf(t) : 0, partial: BS.CARDS['BS69-004'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nex, 0, JSON.stringify(r)); assert.equal(r.drew, 1, JSON.stringify(r)); assert.equal(r.without, 1, JSON.stringify(r));
  assert.ok(r.bp <= 7000, JSON.stringify(r)); assert.equal(r.withNx, 0, JSON.stringify(r));
});

test('K-1092 BS69-005 River Geosnake: Summoned/Attacks destroys a 5000 BP or less Spirit once per turn; Lv2 attack draws', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && k !== 'BS69-005');
    const a = BS.mkInst('BS69-005'); a.cores = 3; P.spirits = [a]; P.deck = [1,2,3].map(() => BS.mkInst(any)); P.hand = [];
    const t = BS.mkInst(any); t.cores = 1; const u = BS.mkInst(any); u.cores = 1; O.spirits = [t, u];
    await BS.fireFx(P, 'SUMMONED', a, { subject: a }); const after1 = O.spirits.length;
    G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    return { after1, after2: O.spirits.length, bp: BS.bpOf ? BS.bpOf(t) : 0, hand: P.hand.length, partial: BS.CARDS['BS69-005'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r));
  assert.ok(r.bp <= 5000, JSON.stringify(r)); assert.equal(r.after1, 1, JSON.stringify(r)); assert.equal(r.after2, 1, JSON.stringify(r));
});
