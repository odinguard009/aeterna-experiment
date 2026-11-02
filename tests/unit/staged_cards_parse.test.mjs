// v0.51.2: every staged card loads with the game's parseCard(), except the listed source-data gaps.
// Nexus cards without level data load at LV1 only; Braves without combine data load as Spirits that never combine.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { checkStaged, stagedCards, KNOWN_GAPS } from '../../tools/check_staged.mjs';
import { quietBoard, closeBrowser } from './lib/node_board.mjs';

after(closeBrowser);

test('S52-01 only the known source-data gaps fail to load', async () => {
  const r = await checkStaged(stagedCards());
  const bad = [...new Set(Object.values(r.groups).flat())];
  assert.deepEqual(bad.filter(id => !KNOWN_GAPS.has(id)), []);
  assert.ok(r.ok >= r.total - KNOWN_GAPS.size, `${r.ok} / ${r.total}`);
});

test('S52-02 Nexus with empty levels loads at LV1; Brave without combine data loads but never combines', async () => {
  const { page } = await quietBoard();
  const out = await page.evaluate(() => {
    const nx = BS.parseCard({ id: 'T52-NX', name: 'Test Nexus', type: 'Nexus', color: 'red', cost: 3, symbols: 0, levels: [], text: '[LV1][LV2] test' });
    const br = BS.parseCard({ id: 'T52-BR', name: 'Test Brave', type: 'Brave', color: 'red', cost: 3, levels: [{ cores: 1, bp: 2000 }] });
    const none = BS.parseCard({ id: 'T52-BX', name: 'Empty Brave', type: 'Brave', color: 'red', cost: 3, levels: [] });
    const sp = BS.parseCard({ id: 'T52-SP', name: 'Test Spirit', type: 'Spirit', color: 'red', cost: 3, levels: [] });
    return { nx: nx.card && nx.card.levels, br: br.card && [br.card.brave === null, br.card.levels.length], none: !!none.card, sp: !!sp.card };
  });
  assert.deepEqual(out.nx, [{ cores: 0 }]);
  assert.deepEqual(out.br, [true, 1]);
  assert.equal(out.none, false);
  assert.equal(out.sp, false);
});
