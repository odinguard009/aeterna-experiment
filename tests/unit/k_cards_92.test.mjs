// Lane K cards, batch 92 (Magic Main clauses authored into magic.by).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard, closeBrowser } from './lib/node_board.mjs';

after(async () => { await closeBrowser(); });

const run = (id, setup) => `(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.step = 4; G.active = P.key;
  const m = BS.mkInst('${id}'); ${setup}
  await BS.runActions({ p: P, opp: O, src: m, ctx: { selfInst: m } }, { actions: BS.CARDS['${id}'].magic.by.MAIN.actions });
  return { impl: BS.CARDS['${id}'].implemented === true, hand: P.hand.length, field: P.spirits.length, trash: P.trash.length, deck: P.deck.length, flags: P.spirits.map(s => s.id) }; })()`;

test('K-1103 BS66-085 Main: draw 3, discard 2, then a Crush Spirit (cost 6 or less) may be summoned from the Hand', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS66-085', `P.deck = [1,2,3,4].map(() => BS.mkInst('BS01-001')); P.hand = []; P.reserve.n = 0;`));
  assert.equal(r.impl, true, JSON.stringify(r));
  assert.equal(r.hand + r.trash, 3, JSON.stringify(r));   // 3 drawn, 2 discarded (the optional summon finds no Crush Spirit)
  assert.equal(r.trash, 2, JSON.stringify(r));
});

test('K-1104 BS35-086 Main: draw two; the reveal of two only happens with the Soul Core', async () => {
  const { page } = await sharedBoard();
  const plain = await page.evaluate(run('BS35-086', `P.deck = [1,2,3,4,5].map(() => BS.mkInst('BS01-001')); P.hand = [];`));
  const soul = await page.evaluate(run('BS35-086', `P.deck = [1,2,3,4,5].map(() => BS.mkInst('BS01-001')); P.hand = []; m.soulPaid = true;`));
  assert.equal(plain.impl, true, JSON.stringify(plain));
  assert.equal(plain.hand, 2, JSON.stringify(plain)); assert.equal(plain.trash, 0, JSON.stringify(plain));
  assert.equal(soul.hand, 2, JSON.stringify(soul)); assert.equal(soul.trash, 2, JSON.stringify(soul));   // two non-matching cards revealed and discarded
});

test('K-1105 BS35-088 Main: Cost 4 or less from the Trash normally, Cost 6 or less with the Soul Core', async () => {
  const { page } = await sharedBoard();
  const plain = await page.evaluate(run('BS35-088', `P.trash = [BS.mkInst('BS01-016')]; P.spirits = [];`));
  const soul = await page.evaluate(run('BS35-088', `P.trash = [BS.mkInst('BS01-016')]; P.spirits = []; m.soulPaid = true;`));
  assert.equal(plain.impl, true, JSON.stringify(plain));
  assert.equal(plain.field, 0, JSON.stringify(plain));
  assert.equal(soul.field, 1, JSON.stringify(soul));
});

test('K-1106 BS21-084 Main: a Spirit is treated as highest level; two cards with Red and Purple symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(run('BS21-084', `const s = BS.mkInst('BS01-001'); s.cores = 1; P.spirits = [s]; P.deck = [1,2,3].map(() => BS.mkInst('BS01-001')); P.hand = [];`));
  assert.equal(r.impl, true, JSON.stringify(r));
  assert.equal(r.hand, 0, JSON.stringify(r));   // no Red + Purple symbols on the Field: no draw
});
