import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1175 BSC48-CX02: trashAllMatch condition and the colour also-treated read the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const K = BS.CARDS['BSC48-CX02'], cond = { trashAllMatch: { anyOf: [{ name: ['God-Sechs'] }, { family: ['Heavenly Demon King', 'Vassal'] }] } };
    const gs = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.includes('God-Sechs') && BS.CARDS[k].type === 'Spirit');
    const other = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && !(BS.CARDS[k].families || []).some(f => ['Heavenly Demon King', 'Vassal'].includes(f)) && !BS.CARDS[k].name.includes('God-Sechs'));
    P.trash = [BS.mkInst(gs)]; const yes = BS.fxIf(P, O, cond);
    P.trash.push(BS.mkInst(other)); const no = BS.fxIf(P, O, cond);
    return { fc: K.partial === false, yes, no, rev: !!K.revive }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.yes, true, JSON.stringify(r)); assert.equal(r.no, false, JSON.stringify(r));
});

test('K-1176 BSC48-CX02: MAGIC_SOUL_TAX_TURN locks Magic while a God-Sechs attacks until the Soul Core is paid once', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const gsId = Object.keys(BS.CARDS).find(k => BS.CARDS[k].name.includes('God-Sechs') && BS.CARDS[k].type === 'Spirit' && BS.CARDS[k].levels.length > 1);
    const nx = BS.mkInst('BSC48-CX02'); nx.cores = 6; P.nexus = [nx]; const gs = BS.mkInst(gsId); gs.cores = 2; P.spirits = [gs];
    await BS.runActions({ p: P, opp: O, src: nx, ctx: {} }, { actions: [{ do: 'MAGIC_SOUL_TAX_TURN', match: { name: ['God-Sechs'] } }] });
    O.reserve.n = 5; O.reserve.soul = true; G.attacker = null; let m = null, mg = null;
    for (const k of Object.keys(BS.CARDS)) { const c = BS.CARDS[k]; if (c.type !== 'Magic' || !c.magic || !(c.magic.timing || []).includes('FLASH') || (c.cost || 0) > 2) continue; const t = BS.mkInst(k); O.hand = [t]; if (BS.magicUsable(O, t, 'flash')) { m = t; mg = k; break; } }
    const idle = !!m; G.attacker = gs; G.battleNo = (G.battleNo || 0) + 1;
    const canPay = BS.magicUsable(O, m, 'flash');
    O.reserve.soul = false; O.spirits = []; const noSoul = BS.magicUsable(O, m, 'flash');
    return { gsId, mg, idle, canPay, noSoul, tax: !!O.magicTax }; })()`);
  assert.equal(r.tax, true, JSON.stringify(r)); assert.equal(r.noSoul, false, JSON.stringify(r));
  assert.equal(r.idle, true, JSON.stringify(r)); assert.equal(r.canPay, true, JSON.stringify(r));
});

test('K-1177 SD32-X02: a two-colour ally attacking sends two opposing cores to the Trash only while the Soul Core is on the source', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const two = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || []).length === 2 && BS.CARDS[k].levels.length > 0);
    const one = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && (BS.CARDS[k].colors || [BS.CARDS[k].color]).length === 1 && BS.CARDS[k].levels.length > 0);
    const run = async (soul, id) => { const src = BS.mkInst('SD32-X02'); src.cores = 3; src.soul = soul; const al = BS.mkInst(id); al.cores = 1; P.spirits = [src, al];
      const t = BS.mkInst(one); t.cores = 6; O.spirits = [t]; O.trashCores.n = 0; await BS.fireFx(P, 'ALLY_ATTACKS', al, { attacker: al }); return O.trashCores.n; };
    return { fc: BS.CARDS['SD32-X02'].partial === false, withSoul: await run(true, two), noSoul: await run(false, two), mono: await run(true, one) }; })()`);
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.withSoul, 2, JSON.stringify(r)); assert.equal(r.noSoul, 0, JSON.stringify(r)); assert.equal(r.mono, 0, JSON.stringify(r));
});
