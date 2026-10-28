// v0.185 Assault: {{Assault|N}} (When Attacks) = optional ASSAULT {n}: refresh this Spirit by exhausting one of your Nexuses, up to N times per turn.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, openGame, closeBrowser } from './lib/game.mjs';

const TEXT = '[LV1] {{Assault|2}} (When Attacks)\nThis Spirit can, up to twice per turn, be refreshed by exhausting one of your Nexuses.';
test('AS185-01 compiler: Assault sentence becomes an optional ASSAULT effect', () => {
  const r = JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\nc = json.loads(${JSON.stringify(JSON.stringify({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }], text: TEXT }))})\nprint(json.dumps(v2.compile_card(c).get('effects')))`], { cwd: ROOT, encoding: 'utf8' }));
  assert.equal(r[0].optional, true);
  assert.match(JSON.stringify(r), /"do": ?"ASSAULT".*"n": ?2/);
});

after(closeBrowser);
let g;
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), [{ id: 'T185-AS', name: 'T185-AS', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'ATTACKS', optional: true, actions: [{ do: 'ASSAULT', n: 2 }] }] }, { id: 'T185-NX', name: 'T185-NX', type: 'Nexus', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 0 }] }]);
  assert.equal(r.ok, 2, JSON.stringify(r));
});
const ev = body => g.page.evaluate(`(async () => { BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player; G.active = P.key; P.cpu = true;
  P.spirits = [BS.mkInst('T185-AS')]; P.nexus = [BS.mkInst('T185-NX'), BS.mkInst('T185-NX'), BS.mkInst('T185-NX')]; const a = P.spirits[0]; ${body} })()`);

test('AS185-02 engine: refreshes an exhausted Spirit by exhausting a Nexus, twice per turn, not a third time', async () => {
  const r = await ev(`const o = []; for (let i = 0; i < 3; i++) { a.exhausted = true; await BS.fireFx(P, 'ATTACKS', a, {}); o.push(a.exhausted); } return [o, P.nexus.filter(n => n.exhausted).length];`);
  assert.deepEqual(r, [[false, false, true], 2]);
});
test('AS185-03 engine: a new turn resets the limit; no ready Nexus = no refresh', async () => {
  const r = await ev(`a.exhausted = true; for (const n of P.nexus) n.exhausted = true; await BS.fireFx(P, 'ATTACKS', a, {}); const x = a.exhausted; P.nexus[0].exhausted = false; a.assaultT = -1; await BS.fireFx(P, 'ATTACKS', a, {}); return [x, a.exhausted];`);
  assert.deepEqual(r, [true, false]);
});
