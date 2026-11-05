import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1501 BS74-064 Dana Sniper: set from the Trash as Mirage (once per turn), old Mirage returns, Nexus shield without summon offer', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const sc = Object.values(BS.CARDS).find(c => (c.families || []).includes('Scalostle') && c.type === 'Spirit' && c.id !== 'BS74-064');
    const src = BS.mkInst(sc.id); P.spirits = [src];
    const old = BS.mkInst(Object.values(BS.CARDS).find(c => c.mirage && c.id !== 'BS74-064' && c.type === 'Spirit').id); old.mirage = true; P.mirage = old;
    const d1 = BS.mkInst('BS74-064'); P.trash = [d1];
    await BS.sentToTrashFx({ p: P, opp: O, src, ctx: {} }, [d1], 'hand');
    const set1 = P.mirage === d1, oldBack = P.hand.includes(old);
    const d2 = BS.mkInst('BS74-064'); P.trash.push(d2);
    await BS.sentToTrashFx({ p: P, opp: O, src, ctx: {} }, [d2], 'hand');
    const wrongFrom = BS.mkInst('BS74-064'); P.mirage = null; P.trash.push(wrongFrom); G.turnNo += 1;
    await BS.sentToTrashFx({ p: P, opp: O, src, ctx: {} }, [wrongFrom], 'deck');
    const k = BS.CARDS['BS74-064'];
    return { set1, oldBack, second: P.mirage === d2, deckByScalostle: P.mirage === wrongFrom, fc: k.partial === false, mn: !!(k.mirageNexus && k.mirageNexus.shieldOnly) }; })()`);
  assert.equal(r.set1, true, JSON.stringify(r)); assert.equal(r.oldBack, true, JSON.stringify(r));
  assert.equal(r.second, false, JSON.stringify(r)); assert.equal(r.deckByScalostle, false, JSON.stringify(r));
  assert.equal(r.fc, true, JSON.stringify(r)); assert.equal(r.mn, true, JSON.stringify(r));
});

test('K-1502 BS74-064: with the Mirage set, a Cost 4 or less Spirit with NO_DESTROY_OPP no longer protects against your destroy effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key;
    const hid = 'BS30-018'; const h = BS.mkInst(hid); h.cores = 2; O.spirits = [h];
    G.fxBy = P.key; BS.removeSpirit(O, h, 'destroyed', true); const safe = O.spirits.includes(h);
    const m = BS.mkInst('BS74-064'); m.mirage = true; P.mirage = m;
    BS.removeSpirit(O, h, 'destroyed', true); const gone = !O.spirits.includes(h);
    return { safe, gone, cost: BS.CARDS[hid].cost }; })()`);
  assert.equal(r.safe, true, JSON.stringify(r)); assert.equal(r.gone, true, JSON.stringify(r));
});
