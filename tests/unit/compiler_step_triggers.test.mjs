// v0.59.0 step-prefixed attack triggers in the compiler:
//   "(Your Attack Step) When your "X" family Spirit attacks, ..."  -> ALLY_ATTACKS + match { family: [X], noUlt: true }
//   "(Opposing Attack Step) When an opposing Spirit attacks, ..."  -> new engine trigger OPP_ATTACKS (fired for the defending player
//   in the same pool as the attacker's ATTACKS / ALLY_ATTACKS), match { noUlt: true }
//   "that Spirit gains +N BP" after an ALLY_ATTACKS trigger -> BP_PLUS to: 'attacker'.
// The text says "Spirit", so an attacking Ultimate of that family does not trigger them (match.noUlt).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const SP = { id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }] };
const compile = text => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({}, SP, { text })))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('C59-01 step-prefixed attack triggers compile to ALLY_ATTACKS / OPP_ATTACKS with noUlt', () => {
  const a = compile('[LV1][LV2] (Your Attack Step) When your "Astral Soul" family Spirit attacks, put a core from the Void to your Reserve.');
  assert.deepEqual(a.effects, [{ trigger: 'ALLY_ATTACKS', lv: [1, 2], match: { family: ['Astral Soul'], noUlt: true }, actions: [{ do: 'VOID_TO_RESERVE', n: 1 }] }]);
  const b = compile('[LV2] (Opposing Attack Step) When an opposing Spirit attacks, draw a card.');
  assert.deepEqual(b.effects, [{ trigger: 'OPP_ATTACKS', lv: [2], match: { noUlt: true }, actions: [{ do: 'DRAW', n: 1 }] }]);
  const c = compile('[LV1] (Your Attack Step) When your "Investigator" family Spirit attacks, that Spirit gains +3000 BP.');
  assert.deepEqual(c.effects[0].actions, [{ do: 'BP_PLUS', n: 3000, to: 'attacker' }]);
  assert.match(compile('[LV1] (When Attacks) That Spirit gains +3000 BP.').review, /^sentence/);      // "that Spirit" only after an ally trigger
});
test('C59-02 the promoted cards carry the new triggers', () => {
  const ids = py(`print(json.dumps([c['id'] for c in json.load(open('build/all-cards.json', encoding='utf-8')) if any(e.get('trigger') in ('OPP_ATTACKS',) or (e.get('match') or {}).get('noUlt') for e in c.get('effects') or [])]))`);
  for (const id of ['BS11-031', 'BS18-021', 'BS21-016', 'BS21-032']) assert.ok(ids.includes(id), id);
});

let g;
const FIX = [
  { id: 'T59-WATCH', name: 'Watcher', type: 'Spirit', color: 'blue', cost: 2, symbols: 1, levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'OPP_ATTACKS', match: { noUlt: true }, actions: [{ do: 'COUNTER', n: 1 }] }] },
  { id: 'T59-LEAD', name: 'Leader', type: 'Spirit', color: 'red', cost: 2, symbols: 1, families: ['Fixture'], levels: [{ cores: 1, bp: 3000 }], effects: [{ trigger: 'ALLY_ATTACKS', match: { family: ['Fixture'], noUlt: true }, actions: [{ do: 'COUNTER', n: 1 }, { do: 'BP_PLUS', n: 3000, to: 'attacker' }] }] },
  { id: 'T59-FAM', name: 'Family Spirit', type: 'Spirit', color: 'red', cost: 1, symbols: 1, families: ['Fixture'], levels: [{ cores: 1, bp: 2000 }] },
  { id: 'T59-ULT', name: 'Family Ultimate', type: 'Ultimate', color: 'red', cost: 3, symbols: 1, families: ['Fixture'], levels: [{ cores: 1, bp: 3000 }], summonIf: { lifeGe: 1 } },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.life = 5; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('C59-03 OPP_ATTACKS fires for the defender when an opposing Spirit attacks, not for an Ultimate', async () => {
  const r = await ev(`sp('T59-WATCH'); G.active = O.key;
    const a = sp('T59-FAM', O); await BS.doBattle(O.key, a); const n1 = P.count;
    const u = sp('T59-ULT', O); await BS.doBattle(O.key, u); return [n1, P.count];`);
  assert.deepEqual(r, [1, 1]);
});
test('C59-04 ALLY_ATTACKS with a family: the attacker gains BP; an attacking Ultimate of that family does not trigger it', async () => {
  const r = await ev(`sp('T59-LEAD'); const a = sp('T59-FAM');
    await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: a }); const bp = BS.bpOf(a), n1 = P.count;
    const u = sp('T59-ULT'); await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: u }); return [bp, n1, P.count];`);
  assert.deepEqual(r, [5000, 1, 1]);
});
test('C59-05 the engine knows OPP_ATTACKS and keeps match.noUlt through parseCard', async () => {
  const r = await g.page.evaluate(() => [BS.CARDS['T59-WATCH'].effects[0].trigger, BS.CARDS['T59-WATCH'].effects[0].match.noUlt, BS.CARDS['T59-LEAD'].effects[0].match.family[0]]);
  assert.deepEqual(r, ['OPP_ATTACKS', true, 'Fixture']);
});
test('C59-06 OPP_ATTACKS does not fire for the attacking player\'s own cards', async () => {
  const r = await ev(`sp('T59-WATCH'); const a = sp('T59-FAM'); await BS.doBattle(P.key, a); return P.count;`);
  assert.equal(r, 0);
});
test('C59-07 ALLY_ATTACKS with a family ignores an attacker of another family', async () => {
  const r = await ev(`sp('T59-LEAD'); const a = sp('T59-WATCH'); await BS.fireFx(P, 'ALLY_ATTACKS', null, { attacker: a }); return [P.count, BS.bpOf(a)];`);
  assert.deepEqual(r, [0, 3000]);
});
test('C59-08 real card BS11-031 The Valkyrie-Mist: LV1 does nothing, LV2 exhausts an opposing Spirit when one attacks', async () => {
  const r = await ev(`const v = sp('BS11-031', P, 1); G.active = O.key; const a = sp('BS01-030', O), b = sp('BS01-030', O);
    await BS.doBattle(O.key, a); const lv1 = b.exhausted === true;
    a.exhausted = false; b.exhausted = false; v.cores = 3; await BS.doBattle(O.key, a);
    return [BS.lvNo(v), lv1, b.exhausted === true];`);
  assert.deepEqual(r, [2, false, true]);
});
test('C59-09 scenario valkyrie-mist-opposing-attack-exhausts (real cards)', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/valkyrie-mist-opposing-attack-exhausts.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const ld = BS.loadScenario(s); if (ld && ld.ok === false) return ld.error;
    BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const [a, b] = O.spirits; await BS.doBattle(O.key, a); return b.exhausted === true;
  }, spec);
  assert.equal(r, true);
});
test('C59-10 real cards BS18-021 / BS21-016 / BS21-032 carry the family and noUlt matches', async () => {
  const r = await g.page.evaluate(() => ['BS18-021', 'BS21-016', 'BS21-032'].map(id => { const e = BS.CARDS[id].effects.find(x => x.trigger === 'ALLY_ATTACKS' || x.trigger === 'OPP_ATTACKS'); return [e.trigger, (e.match.family || [])[0] || '', e.match.noUlt]; }));
  assert.deepEqual(r, [['ALLY_ATTACKS', 'Great General', true], ['ALLY_ATTACKS', 'Astral Soul', true], ['OPP_ATTACKS', '', true]]);
});
