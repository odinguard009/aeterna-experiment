// v0.64.0 Soul Magic (Standard CR 12-2-1-2; Fandom "Soul Magic" page + Template:Soul Magic, official Q&A 31159-31161):
// "[Soul Magic: <colour>] If you control any <colour> symbol, you can use it with just the Soul Core."
// The whole cost is paid with the one Soul Core, which must be where costs are normally paid from (Field or Reserve, not the Life, Q&A 31160);
// the Soul Core may come from the only Spirit that shows the symbol (Q&A 31161). The Soul Core goes to the Trash like any paid core.
// rules: STD:12-2-1-2@fb11fb06, SJP:soul-magic@6d441653
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, openGame, closeBrowser } from './lib/node_board.mjs';

const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce, compile_v2 as v2\nv2.install()\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const compile = (text, extra = {}) => py(`c = json.loads(${JSON.stringify(JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Magic', color: 'green', cost: 5, levels: [], text }, extra)))})
try: print(json.dumps(v2.compile_card(c)))
except ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('S64-01 compiler: the {{Soul Magic|x}} line becomes soulMagic: <colour> and the rest compiles as before', () => {
  const c = compile('{{Soul Magic|g}}\nFlash\nTarget an opposing Spirit. Heavy exhaust it.');
  assert.equal(c.soulMagic, 'green', JSON.stringify(c));
  assert.ok(c.magic && c.magic.timing.includes('FLASH'), JSON.stringify(c));
  assert.equal(compile('{{Soul Magic|r}}\nFlash\nTarget an opposing Spirit. Heavy exhaust it.', { color: 'red' }).soulMagic, 'red');
  assert.equal(compile('{{Soul Magic|p||If you control any Purple symbol, you can use it with just the .}}\nFlash\nTarget an opposing Spirit. Heavy exhaust it.', { color: 'purple' }).soulMagic, 'purple');
  assert.match(compile('{{Soul Magic|g}}\n[LV1] (When Summoned) Draw a card.', { type: 'Spirit', levels: [{ cores: 1, bp: 1000 }] }).review, /Soul Magic/);
  assert.match(compile('{{Soul Magic|q}}\nFlash\nDraw a card.').review, /Soul Magic/);
});

let g;
const FIX = [
  { id: 'T64-SM', name: 'T64-SM', type: 'Magic', color: 'green', cost: 6, reduction: { green: 3 }, symbols: 0, soulMagic: 'green', magic: { timing: ['MAIN', 'FLASH'], effect: 'ACTIONS', actions: [{ do: 'DRAW', n: 1 }] } },
  { id: 'T64-PLAIN', name: 'T64-PLAIN', type: 'Magic', color: 'green', cost: 6, symbols: 0, magic: { timing: ['MAIN'], effect: 'ACTIONS', actions: [{ do: 'DRAW', n: 1 }] } },
  { id: 'T64-G', name: 'T64-G', type: 'Spirit', color: 'green', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
  { id: 'T64-R', name: 'T64-R', type: 'Spirit', color: 'red', cost: 1, symbols: 1, levels: [{ cores: 1, bp: 1000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 4;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.trash = []; }
  P.deck = [BS.mkInst('T64-G'), BS.mkInst('T64-G'), BS.mkInst('T64-G')]; P.deckSize = P.deck.length;
  const sp = (id, n = 1, soul = false) => { const i = BS.mkInst(id); i.cores = n; i.soul = soul; P.spirits.push(i); return i; };
  const hand = id => { const i = BS.mkInst(id); P.hand.push(i); return i; };
  const soulRes = () => { for (const f of P.spirits) f.soul = false; P.reserve.soul = true; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('S64-02 parse: soulMagic keeps a colour; a bad colour is rejected', async () => {
  const r = await g.page.evaluate(() => [BS.CARDS['T64-SM'].soulMagic, BS.CARDS['T64-PLAIN'].soulMagic || null,
    BS.parseCard({ id: 'T64-BAD', name: 'B', type: 'Magic', color: 'red', cost: 3, soulMagic: 'pink' }).errors ? 'err' : 'ok',
    BS.parseCard({ id: 'T64-BAD2', name: 'B', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 1000 }], soulMagic: 'red' }).errors ? 'err' : 'ok']);
  assert.deepEqual(r, ['green', null, 'err', 'err']);
});
test('S64-03 usable with only the Soul Core while a Green symbol is on the Field; not without the symbol, not for a plain Magic', async () => {
  const r = await ev(`P.reserve.n = 0; soulRes(); const g1 = sp('T64-R', 1); const m = hand('T64-SM'), pl = hand('T64-PLAIN');
    const noSym = [BS.soulMagicOK(P, BS.CARDS['T64-SM']), BS.magicUsable(P, m, 'main')];
    sp('T64-G', 1); const withSym = [BS.soulMagicOK(P, BS.CARDS['T64-SM']), BS.magicUsable(P, m, 'main'), BS.magicUsable(P, m, 'flash'), BS.magicUsable(P, pl, 'main')];
    return [noSym, withSym];`);
  assert.deepEqual(r, [[false, false], [true, true, true, false]]);
});
test('S64-04 the Soul Core in the Life or the Trash does not pay (Q&A 31160)', async () => {
  const r = await ev(`P.reserve.n = 0; P.reserve.soul = false; sp('T64-G', 1); const m = hand('T64-SM');
    P.trashCores.soul = true; const inTrash = BS.magicUsable(P, m, 'main');
    return [inTrash, BS.soulMagicOK(P, BS.CARDS['T64-SM'])];`);
  assert.deepEqual(r, [false, false]);
});
test('S64-05 casting pays only the Soul Core (to the Trash) and resolves the effect', async () => {
  const r = await ev(`P.reserve.n = 0; soulRes(); sp('T64-G', 1); const m = hand('T64-SM'); const h0 = P.hand.length, t0 = P.trashCores.n;
    await BS.castMagic(P, { inst: m, ctx: 'main' });
    return [P.reserve.soul, P.trashCores.soul, P.trashCores.n - t0, P.hand.length - h0, P.trash.some(x => x.id === 'T64-SM'), P.spirits.length];`);
  assert.deepEqual(r, [false, true, 0, 0, true, 1]);       // -1 Magic +1 drawn card
});
test('S64-06 the Soul Core may come from the only Spirit that shows the symbol (Q&A 31161); it depletes when it was its only core', async () => {
  const r = await ev(`P.reserve.n = 0; P.reserve.soul = false; const gs = sp('T64-G', 0, true); const m = hand('T64-SM');
    const ok = BS.magicUsable(P, m, 'main'); await BS.castMagic(P, { inst: m, ctx: 'main', soulMagic: true });
    return [ok, gs.soul, P.trashCores.soul, P.spirits.length];`);
  assert.deepEqual(r, [true, false, true, 0]);
});
test('S64-07 normal payment stays the default when the cores are there and the caller chose it; the CPU prefers Soul Magic for a cost of 3 or more', async () => {
  const r = await ev(`P.reserve.n = 6; soulRes(); sp('T64-G', 1); const m = hand('T64-SM'), m2 = hand('T64-SM');
    await BS.castMagic(P, { inst: m, ctx: 'main', soulMagic: false }); const normal = [P.reserve.soul, P.reserve.n];
    await BS.castMagic(P, { inst: m2, ctx: 'main' }); return [normal, P.reserve.soul, P.reserve.n];`);
  assert.deepEqual(r, [[true, 1], false, 1]);               // cost 6, one Green symbol reduces it to 5: paid from the Reserve; the second cast pays the Soul Core only
});
test('S64-08 scenario soul-magic-tentacle-attack: real card 26RSD03-014 with no spare cores heavy-exhausts an opposing Spirit', async () => {
  const spec = JSON.parse(readFileSync(new URL('../scenarios/soul-magic-tentacle-attack.json', import.meta.url), 'utf8'));
  const r = await g.page.evaluate(async s => {
    const e = BS.loadScenario(s); if (e && e.error) return e.error;
    BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = true; O.cpu = true;
    const m = P.hand[0], ok = BS.magicUsable(P, m, 'flash');      // a Flash-only Magic: cast it as in a Flash Timing
    await BS.castMagic(P, { inst: m, ctx: 'flash' });
    return [ok, O.spirits.filter(x => x.exhausted).length, P.trashCores.soul, P.trash.map(x => x.id)];
  }, spec);
  assert.deepEqual(r, [true, 1, true, ['26RSD03-014']]);
});
