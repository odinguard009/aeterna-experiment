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
