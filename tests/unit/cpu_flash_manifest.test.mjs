// v0.42 check of the open note "CPU never manifests or uses Flash outside Main": the CPU must Manifest in the Flash Timing of an opposing attack
// (scenario sphinott-manifest-either-attack-step, but the Manifest owner is the CPU).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGame, closeBrowser, ROOT } from './lib/node_board.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const spec = JSON.parse(readFileSync(`${ROOT}/tests/scenarios/sphinott-manifest-either-attack-step.json`, 'utf8'));
const load = () => g.page.evaluate(s => { BS.loadScenario(s); BS.SETTINGS.speed = 'instant'; BS.G.p.player.cpu = true; return 1; }, spec);

test('C01 the CPU defender picks the Manifest in the opposing Attack Step (Flash Timing)', async () => {
  await load();
  const r = await g.page.evaluate(() => { const ch = BS.cpuFlashChoice(BS.G.p.player, 'opponent', SC.big, null); return ch && ch.manifest ? [ch.manifest === SC.sphinott, ch.target === SC.ometeotl] : null; });
  assert.deepEqual(r, [true, true]);
});
test('C02 the CPU carries the Manifest out inside flashTiming: Sphinott replaces Ometeotl and the opposing Spirits are destroyed', async () => {
  await load();
  const r = await g.page.evaluate(async () => { await BS.flashTiming('opponent', SC.big, null); const O = BS.G.p.opponent;
    return [BS.G.p.player.nexus.some(n => n.id === 'BS75-013') || BS.G.p.player.spirits.some(s => s.id === 'BS75-013'), [SC.big, SC.mid, SC.small].filter(x => !O.spirits.includes(x)).length]; });
  assert.equal(r[0], true);
  assert.ok(r[1] >= 1, 'at least one opposing Spirit is destroyed');
});
