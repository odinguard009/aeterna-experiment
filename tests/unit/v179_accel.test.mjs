import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_v2 as c\n${code}`], { cwd: ROOT, encoding: 'utf8' }));

const card = `{'id':'T-1','name':'Cynognathus','type':'Spirit','cost':2,'levels':[{'lv':1,'cores':1,'bp':3000}],'text':'Flash - {{Accel|Cost 2 ()}}'+chr(10)+'During this turn, give all your Spirits +3000 BP. After this effect resolves, put this card face-up onto the Removed Zone.'}`;

test('V179-01 Accel head = ACCEL effect with cost, timing and the table reduction', () => {
  const n = py(`n = c.compile_card(${card}); print(json.dumps(n['effects']))`);
  assert.equal(n.length, 1);
  assert.equal(n[0].trigger, 'ACCEL'); assert.equal(n[0].cost, 2); assert.deepEqual(n[0].timing, ['FLASH']);
  assert.ok(n[0].reduction && Object.values(n[0].reduction).every(v => v > 0));
});

test('V179-02 an Accel card missing from the reduction table stays in review', () => {
  const r = py(`
try:
    c.compile_card(${card.replace('Cynognathus', 'No Such Card')})
    print(json.dumps('compiled'))
except c.Review as e:
    print(json.dumps(str(e)))`);
  assert.match(r, /reduction icons unknown/);
});
