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

test('K-1093 BS69-007 Rock Geosoldier: Summoned returns up to three differently-named Primordial Nexuses from the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = G.p.opponent.cpu = true; G.active = P.key; G.step = 3;
    const a = BS.mkInst('BS69-007'); a.cores = 3; P.spirits = [a]; P.hand = [];
    P.trash = ['BS69-068', 'BS69-068', 'BS69-072', 'BS69-078', 'BS70-071'].map(i => BS.mkInst(i));
    await BS.fireFx(P, 'SUMMONED', a, { subject: a });
    return { hand: P.hand.map(h => h.id).sort(), trash: P.trash.length, partial: BS.CARDS['BS69-007'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.hand.length, 3, JSON.stringify(r)); assert.equal(new Set(r.hand).size, 3, JSON.stringify(r)); assert.equal(r.trash, 2, JSON.stringify(r));
});

test('K-1094 BS69-008 Volcano Geozard: Attacks deploys a Primordial Nexus from four revealed cards; Start of Attack Step sends two Trash cores per Primordial Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player; P.cpu = G.p.opponent.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && !(BS.CARDS[k].families || []).includes('Primordial'));
    const a = BS.mkInst('BS69-008'); a.cores = 5; P.spirits = [a]; P.nexus = []; P.deck = [BS.mkInst(any), BS.mkInst('BS69-068'), BS.mkInst(any), BS.mkInst(any), BS.mkInst(any)]; P.reserve.n = 5;
    G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    const nx = P.nexus.length; P.trashCores.n = 5; const c0 = a.cores + P.nexus.reduce((s, x) => s + x.cores, 0);
    await BS.fireFx(P, 'START_ATTACK', null, {});
    const c1 = a.cores + P.nexus.reduce((s, x) => s + x.cores, 0);
    return { nx, moved: c1 - c0, trash: P.trashCores.n, mani: BS.CARDS['BS69-008'].manifest && BS.CARDS['BS69-008'].manifest.counterGe, partial: BS.CARDS['BS69-008'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nx, 1, JSON.stringify(r)); assert.equal(r.moved, 2, JSON.stringify(r)); assert.equal(r.trash, 3, JSON.stringify(r)); assert.equal(r.mani, 3, JSON.stringify(r));
});

test('K-1095 BS69-009: Lv2 attack deploys a Primordial Nexus from hand; set Burst on Spirit destroyed destroys lowest BP, draws and summons it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels[0].bp > 0);
    const a = BS.mkInst('BS69-009'); a.cores = 3; P.spirits = [a]; P.nexus = []; const nxc = BS.mkInst('BS69-068'); P.hand = [nxc];
    G.attacker = a; await BS.fireFx(P, 'ATTACKS', a, { attacker: a, subject: a });
    const nx = P.nexus.length;
    const b = BS.mkInst('BS69-009'); P.spirits = []; P.burst = b; P.deck = [1,2,3].map(() => BS.mkInst(any)); P.hand = []; P.reserve.n = 5;
    const t = BS.mkInst(any); t.cores = 1; O.spirits = [t]; G.active = O.key;
    await BS.maybeBurst(P, 'ALLY_DESTROYED', {});
    return { nx, oppLeft: O.spirits.length, hand: P.hand.length, onField: P.spirits.some(s => s.id === 'BS69-009'), partial: BS.CARDS['BS69-009'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.nx, 1, JSON.stringify(r));
  assert.equal(r.oppLeft, 0, JSON.stringify(r)); assert.equal(r.hand, 1, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r));
});

test('K-1096 BS69-011 Mirage: attacking Primordial gets +5000; Flash destroys an own Primordial Nexus, pays the cost and destroys 10000 BP or less', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5;
    const low = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token && BS.CARDS[k].levels[0].bp > 0 && BS.CARDS[k].levels[0].bp <= 5000);
    const m = BS.mkInst('BS69-011'); m.mirage = true; P.mirage = m; const nx = BS.mkInst('BS69-068'); P.nexus = [nx];
    const at = BS.mkInst('BS69-007'); at.cores = 3; P.spirits = [at]; const bp0 = BS.bpOf(at);
    G.attacker = at; await BS.fireFx(P, 'ALLY_ATTACKS', at, { attacker: at });
    const bp1 = BS.bpOf(at); G.attacker = null;
    const t = BS.mkInst(low); t.cores = 1; O.spirits = [t]; P.reserve.n = 10; G.active = O.key;
    const idx = BS.CARDS['BS69-011'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, m, idx);
    return { gain: bp1 - bp0, ok, nexusLeft: P.nexus.length, onField: P.spirits.includes(m), oppLeft: O.spirits.length, partial: BS.CARDS['BS69-011'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.gain, 5000, JSON.stringify(r)); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.nexusLeft, 0, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.oppLeft, 0, JSON.stringify(r));
});
