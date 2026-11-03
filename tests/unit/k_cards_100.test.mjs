import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1071 BS75-AX02 Grand-Sagitto-Nova: UTadvent needs a Cost 8+ Thunderive and the Soul Core in the Reserve/Trash, which ends up on the adventing card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const big = BS.mkInst('BS75-051'); big.cores = 3; const small = BS.mkInst('BS75-046'); small.cores = 3; P.spirits = [small, big]; O.spirits = [];
    const adv = BS.mkInst('BS75-AX02'); P.hand = [adv]; P.reserve.soul = true; P.trashCores.soul = false;
    const t = BS.contractAdventTargets(P, adv, 'flash').map(x => x.uid);
    P.reserve.soul = false; P.trashCores.soul = false; const none = BS.contractAdventTargets(P, adv, 'flash').length; P.trashCores.soul = true;
    const ok = await BS.doContractAdvent(P, adv, big, 'flash');
    return { t, bigUid: big.uid, smallUid: small.uid, none, ok, onField: P.spirits.includes(adv), under: adv.under.includes(big), soul: adv.soul, trash: P.trashCores.soul, partial: BS.CARDS['BS75-AX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.t, [r.bigUid], JSON.stringify(r)); assert.equal(r.none, 0, JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.onField, true); assert.equal(r.under, true); assert.equal(r.soul, true); assert.equal(r.trash, false);
});

test('K-1072 BS75-AX02: when Advents/Attacks it refreshes and, with a Cost 6+ pre-Advent card in your Attack Step, sends one opposing Life per can\'t-attack/block Spirit to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const big = BS.mkInst('BS75-051'); const ax = BS.mkInst('BS75-AX02'); ax.cores = 6; ax.under = [big]; ax.exhausted = true; P.spirits = [ax];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst(any), b = BS.mkInst(any), c = BS.mkInst(any); a.cores = b.cores = c.cores = 1; a.noAB = b.noAB = true; O.spirits = [a, b, c]; O.life = 5; const l0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    const hit = { life: O.life, res: O.reserve.n - l0, ref: !ax.exhausted };
    ax.under = []; ax.exhausted = true; ax.fxUsed = {}; O.life = 5;
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    return { hit, noUnder: O.life }; })()`);
  assert.equal(r.hit.life, 3, JSON.stringify(r)); assert.equal(r.hit.res, 2, JSON.stringify(r)); assert.equal(r.hit.ref, true, JSON.stringify(r)); assert.equal(r.noUnder, 5, JSON.stringify(r));
});

test('K-1073 BS75-AX02 LV2/3: When Attacks/Blocks five opposing Spirits can\'t attack/block for the rest of the game', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const ax = BS.mkInst('BS75-AX02'); ax.cores = 6; P.spirits = [ax];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    O.spirits = [1, 2, 3, 4, 5, 6].map(() => { const s = BS.mkInst(any); s.cores = 1; return s; });
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    return { n: O.spirits.filter(s => s.noAB).length, lv: BS.lvNo(ax) }; })()`);
  assert.ok(r.lv >= 2, JSON.stringify(r)); assert.equal(r.n, 5, JSON.stringify(r));
});

test('K-1074 BS75-049 Airavajdra: when a Thunderive Spirit would leave by an opposing effect it is summoned from the Hand (cost paid); not on a battle loss', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 2; G.fxBy = O.key;
    const s = BS.mkInst('BS75-046'); s.cores = 1; P.spirits = [s]; O.spirits = []; P.nexus = []; const a = BS.mkInst('BS75-049'); P.hand = [a]; P.reserve.n = 10;
    const none = BS.mkInst('BS76-047'); none.cores = 1; P.spirits.push(none);
    G.fxBy = null; BS.removeSpirit(P, none, 'destroyed', 'battle'); await BS.flushBursts(); const afterBattle = P.hand.includes(a);
    G.fxBy = O.key; BS.removeSpirit(P, s, 'destroyed'); await BS.flushBursts();
    return { afterBattle, onField: P.spirits.includes(a), inHand: P.hand.includes(a), res: P.reserve.n, leaveSummon: BS.CARDS['BS75-049'].leaveSummon, partial: BS.CARDS['BS75-049'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.afterBattle, true, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.inHand, false); assert.ok(r.res < 10, JSON.stringify(r));
});

test('K-1075 BS75-042 Bilijvern: while set it shields Contractor Indra from opposing destruction, and Void cores from Indra summon the Mirage', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const n = BS.mkInst('BS75-CX03'); n.cores = 4; P.nexus = [n]; P.spirits = []; O.spirits = []; const m = BS.mkInst('BS75-042'); m.mirage = true; P.mirage = m; P.reserve.n = 5; P.void = 0;
    G.fxBy = O.key; BS.removeNexus(P, n, 'destroyed'); const shielded = P.nexus.includes(n); G.fxBy = null;
    BS.coreEvN(P, n.uid, 'void', 2, false); n.cores -= 2; P.void += 2; await BS.flushBursts();
    return { shielded, summoned: P.spirits.includes(m), mirageGone: P.mirage === null, partial: BS.CARDS['BS75-042'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.shielded, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.mirageGone, true, JSON.stringify(r));
});

test('K-1076 BS75-051 Canonvajdra: set card activates when a Thunderive Spirit attacks with 6+ counters, summons free and zeroes opposing symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const att = BS.mkInst('BS76-044'); att.cores = 1; P.spirits = [att]; const v = BS.mkInst('BS76-044'); v.cores = 1; O.spirits = [v]; v.noFx = false; P.reserve.n = 5;
    const b = BS.mkInst('BS75-051'); b.mirage = false; P.burst = b; P.count = 5;
    const low = await BS.maybeBurst(P, 'ALLY_ATTACK', { subject: att, attacker: att }); const stay = P.burst === b;
    P.count = 6; const hi = await BS.maybeBurst(P, 'ALLY_ATTACK', { subject: att, attacker: att }); await BS.flushBursts();
    return { low, stay, hi, summoned: P.spirits.includes(b), zeroed: O.spirits.every(s => s.symZeroTurn === G.turnNo), partial: BS.CARDS['BS75-051'].partial, fx: !!BS.CARDS['BS75-051'].fxComplete }; })()`);
  assert.equal(r.low, false, JSON.stringify(r)); assert.equal(r.stay, true, JSON.stringify(r)); assert.equal(r.hi, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.zeroed, true, JSON.stringify(r));
});

test('K-1077 BS75-030 Pachhattar: Attacks lets a pre-advent family card enter Soul State; BS74-042 second reveal pick is once per turn per name', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const s = BS.mkInst('BS75-030'); s.cores = 2; const u = BS.mkInst('BS74-040'); s.under = [u]; P.spirits = [s]; O.spirits = [];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); const inSoul = P.soulState.includes(u), gone = !s.under.includes(u);
    return { inSoul, gone, p30: !BS.CARDS['BS75-030'].partial, p42: !BS.CARDS['BS74-042'].partial, p48: !BS.CARDS['BS74-048'].partial }; })()`);
  assert.deepEqual(r, { inSoul: true, gone: true, p30: true, p42: true, p48: true }, JSON.stringify(r));
});

test('K-1078 BS74-040 Revelation Dragon: when an Awakened Dragon ally is lost, up to three cores go from the Trash to matching cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 2; G.fxBy = null;
    const a = BS.mkInst('BS74-040'); a.cores = 1; const b = BS.mkInst('BS74-040'); b.cores = 1; P.spirits = [a, b]; O.spirits = []; P.trashCores.n = 8; const before = P.trashCores.n, tot = a.cores + b.cores + P.reserve.n;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: b, depl: false, byOpp: true });
    return { moved: before - P.trashCores.n, gain: a.cores + b.cores + P.reserve.n - tot, partial: BS.CARDS['BS74-040'].partial, ok: !BS.CARDS['BS74-040'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.moved, 6, JSON.stringify(r)); assert.equal(r.gain, 6, JSON.stringify(r));   // each copy on the field reacts once, up to 3 cores each
});
