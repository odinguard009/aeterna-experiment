// v0.182 Tribute: {{Tribute|Cost N or more > Void}} / {{Tribute|<family> > Trash}} = card.tribute; playable only with a matching Spirit,
// and after the cost is paid all cores of one matching Spirit go to the Trash / Void.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const tribute = text => py(`c = json.loads(${JSON.stringify(JSON.stringify({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 6, levels: [{ cores: 1, bp: 3000 }], text }))})
try: print(json.dumps(v2.compile_card(c).get('tribute')))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('TR182-01 compiler: cost and family forms, Trash and Void', () => {
  assert.deepEqual(tribute('{{Tribute|Cost 3 or more &rarr; Void}}\nAfter paying for the summoning cost, you must send all cores from a Cost 3 or more Spirit you control to the Void.'), { costGe: 3, to: 'void' });
  assert.deepEqual(tribute('{{Tribute|Astral Soul &rarr; Trash}}\nAfter paying for the summoning cost, you must send all cores from an "Astral Soul" family Spirit you control to the Trash.\n\n[LV1] (When Summoned)\nDraw a card.'), { family: 'Astral Soul', to: 'trash' });
});

after(closeBrowser);
let g;
before(async () => {
  g = await openGame('');
  const mk = (id, extra) => Object.assign({ id, name: id, type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }] }, extra);
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), [
    mk('T182-TRB', { cost: 3, tribute: { costGe: 2, to: 'void' } }), mk('T182-BIG', { cost: 4 }), mk('T182-SML', { cost: 1 }),
    mk('T182-FAM', { cost: 3, tribute: { family: 'Zed', to: 'trash' } }), mk('T182-Z', { families: ['Zed'] }),
  ]);
  assert.equal(r.ok, 5, JSON.stringify(r));
});
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player; G.active = P.key; G.step = 3;
  P.cpu = true; for (const q of [P, G.p.opponent]) { q.spirits = []; q.nexus = []; q.hand = []; q.trash = []; }
  P.reserve.n = 8; const before = () => P.void + P.trashCores.n;
  const put = (id, cores) => { const i = BS.mkInst(id); i.cores = cores; P.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('TR182-02 engine: not playable without a matching Spirit; a cheap Spirit does not qualify', async () => {
  const r = await ev(`const h = BS.mkInst('T182-TRB'); P.hand.push(h); const a = BS.canPlayCard(P, h); put('T182-SML', 1); const b = BS.canPlayCard(P, h); put('T182-BIG', 1); return [a, b, BS.canPlayCard(P, h)];`);
  assert.deepEqual(r, [false, false, true]);
});
test('TR182-03 engine: after the cost, all cores of the matching Spirit go to the Void and it is depleted', async () => {
  const r = await ev(`const big = put('T182-BIG', 3); const h = BS.mkInst('T182-TRB'); P.hand.push(h); const v = P.void;
    await BS.summonPaid(P, h); return [P.void - v, P.spirits.map(s => s.id), big.cores];`);
  assert.deepEqual(r, [3, ['T182-TRB'], 0]);
});
test('TR182-04 engine: family Tribute to the Trash; a free summon skips the Tribute', async () => {
  const r = await ev(`put('T182-Z', 2); const h = BS.mkInst('T182-FAM'); P.hand.push(h); const t = P.trashCores.n;
    await BS.summonPaid(P, h); const a = [P.trashCores.n - t - 0, P.spirits.map(s => s.id)];
    const f = BS.mkInst('T182-TRB'); await BS.summonFree(P, f); return [a, P.spirits.map(s => s.id)];`);
  assert.equal(r[0][1].join(), 'T182-FAM'); assert.ok(r[0][0] >= 2);
  assert.deepEqual(r[1], ['T182-FAM', 'T182-TRB']);
});
