// v0.159.0 "(During Block)" static BP: STATIC {blockingOnly:true} applies only while the Spirit is the current blocker.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, quietBoard, closeBrowser } from './lib/game.mjs';

after(closeBrowser);
const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = text => py(`c = json.loads(${JSON.stringify(JSON.stringify({ id: 'T-1', name: 'T', type: 'Spirit', color: 'white', cost: 4, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('DB159-01 compiler: (During Block) constant BP = STATIC blockingOnly', () => {
  assert.deepEqual(compile('[LV2] (During Block)\nThis Spirit gains +3000 BP.').effects,
    [{ trigger: 'STATIC', bp: 3000, to: 'self', blockingOnly: true, lv: [2] }]);
});
test('DB159-02 in the game: +3000 BP only while the Spirit is the blocker', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(() => {
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const b = BS.mkInst('26RCB01-037'); b.cores = 3; O.spirits.push(b);
    const a = BS.mkInst('BS01-042'); a.cores = 1; P.spirits.push(a);
    const idle = BS.bpOf(b);
    G.attacker = a; G.blocker = b; G.battleNo = 1;
    const blocking = BS.bpOf(b);
    G.blocker = null;
    return [idle, blocking, BS.bpOf(b)];
  });
  assert.deepEqual(r, [10000, 13000, 10000]);
});
