import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

const setup = `BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
  const pick = (lvWant, type) => Object.values(BS.CARDS).find(c => c.type === type && !c.token && c.levels && c.levels.length);`;

test('K-1701 BS68-CX03 Kinich-Ahau: complete card, Flash bounces an opposing LV1 Spirit or LV3 Ultimate (not LV2 Spirit, not LV2 Ultimate)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const A = BS.FX_ACTIONS.BOUNCE_OPP, ctx = { p: P, opp: O, src: BS.mkInst('BS68-CX03'), ctx: {} };
    const act = { do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', lv: [1], ultLv: [3] };
    const lvs = {};
    const at = (c, want) => { const x = BS.mkInst(c.id); for (let k = 0; k <= 12 && BS.lvNo(x) !== want; k++) x.cores = k; return BS.lvNo(x) === want ? x : null; };
    const sp = Object.values(BS.CARDS).find(c => c.type === 'Spirit' && !c.token && c.levels && c.levels.length >= 2 && at(c, 1) && at(c, 2));
    const ul = Object.values(BS.CARDS).find(c => c.type === 'Ultimate' && !c.token && c.levels && c.levels.length >= 3 && at(c, 3) && at(c, 2));
    const cnt = x => { O.spirits = [x]; return A.cands(ctx, act).length; };
    return { chk: A.chk(act), bad: A.chk({ do: 'BOUNCE_OPP', to: 'hand', kind: 'spirit', ultLv: [9] }), sp1: cnt(at(sp, 1)), sp2: cnt(at(sp, 2)), u1: cnt(at(ul, 2)), u3: cnt(at(ul, 3)),
      fc: BS.CARDS['BS68-CX03'].partial === false, revive: BS.CARDS['BS68-CX03'].revive === true }; })()`);
  const j = JSON.stringify(r);
  assert.equal(r.chk, true, j); assert.equal(r.bad, false, j); assert.equal(r.fc, true, j); assert.equal(r.revive, true, j);
  assert.deepEqual([r.sp1, r.sp2, r.u1, r.u3], [1, 0, 0, 1], j);
});

test('K-1702 viaHoly LIFE_UP: sends an opposing Life to the Reserve after Holy Life only, not after a plain Life gain', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { ${setup}
    const nx = BS.mkInst('BS68-CX03'); nx.cores = 3; P.nexus = [nx];
    const lv = BS.lvNo(nx);
    O.life = 5; P.life = 3; P.void = 5;
    await BS.fireFx(P, 'LIFE_UP', null, {});
    const plain = O.life;
    await BS.fireFx(P, 'LIFE_UP', null, { holyLife: true });
    return { lv, plain, holy: O.life, fc: BS.CARDS['BS68-CX03'].partial === false }; })()`);
  const j = JSON.stringify(r);
  assert.equal(r.plain, 5, j);
  if (r.lv >= 2) assert.equal(r.holy, 4, j); else assert.equal(r.holy, 5, j);
});
