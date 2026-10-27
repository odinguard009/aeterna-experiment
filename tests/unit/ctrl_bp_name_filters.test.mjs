// v0.167.0 ctrl qualifiers bpGe / noText / name, per.keyword, keyword detection for Legacy + Shamanism, "target two instead".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
before(async () => { g = await openGame(''); });
after(async () => { await g.page.close(); await closeBrowser(); });
const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent;
  P.cpu = true; O.cpu = true; for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.reserve.n = 10; q.reserve.soul = false; q.tokens = {}; q.onceUsed = {}; }
  const spirit = (q, id, bp, cores = 1) => { const s = BS.mkInst(id); s.cores = cores; s.bpMod = bp - BS.CARDS[id].levels[0].bp; q.spirits.push(s); return s; };`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('CB167-01 Bullfal: the attack destroys a 3000 BP target, or a 5000 BP one while you control a 10000 BP Spirit', async () => {
  const run = (ownBp, oppBp) => ev(`const s = spirit(P, '26RBS02-011', 5000, 4); if (${ownBp} >= 10000) spirit(P, 'BS75-004', ${ownBp});
    const t = spirit(O, 'BS75-001', ${oppBp}); await BS.fireFx(P, 'ATTACKS', s); return O.spirits.includes(t);`);
  assert.equal(await run(5000, 5000), true);       // no big Spirit: a 5000 BP target is out of range
  assert.equal(await run(10000, 5000), false);     // a 10000 BP Spirit: the range becomes 5000
  assert.equal(await run(5000, 3000), false);      // the base range still works
});

test('CB167-02 Megaropsis: the destroy range grows from Cost 3 to Cost 5 only with a Blue Spirit that has no printed effects', async () => {
  const ids = await ev(`const C = BS.CARDS; return { blue: Object.keys(C).find(i => C[i].type === 'Spirit' && (C[i].colors || [C[i].symbol]).includes('blue') && i !== '26RBS03-064' && !i.startsWith('TRAIN') && /\\((When|During|Your)/.test(C[i].desc || '')),
    c5: Object.keys(C).find(i => C[i].type === 'Spirit' && C[i].cost === 5 && !i.startsWith('TRAIN')) };`);
  const run = (withBlue, textless) => ev(`const s = BS.mkInst('26RBS03-064'); s.cores = 1; s.lostLv = 0; P.trash.push(s); const saved = BS.CARDS['${ids.blue}'].desc, savedT = BS.CARDS['${ids.blue}'].text;
    if (${withBlue}) { spirit(P, '${ids.blue}', 2000); if (${textless}) BS.CARDS['${ids.blue}'].desc = ''; BS.CARDS['${ids.blue}'].text = ''; }
    const t = spirit(O, '${ids.c5}', 3000); await BS.fireFx(P, 'DESTROYED', s); BS.CARDS['${ids.blue}'].desc = saved; BS.CARDS['${ids.blue}'].text = savedT; return O.spirits.includes(t);`);
  assert.equal(await run(false, false), true);     // Cost 5 target, no condition: survives
  assert.equal(await run(true, false), true);      // a Blue Spirit WITH printed effects does not count
  assert.equal(await run(true, true), false);      // the same Blue Spirit with its text removed (no printed effects): range 5
});

test('CB167-03 Ryugen-Yomi: "target two instead" destroys two targets while you control an exhausted Gaim', async () => {
  const run = exh => ev(`const s = spirit(P, '26RCB01-015', 6000); const gm = spirit(P, '26RCB01-001', 4000); gm.exhausted = ${exh};
    const a = spirit(O, 'BS75-001', 3000), b = spirit(O, 'BS75-004', 3000); await BS.fireFx(P, 'SUMMONED', s); return O.spirits.length;`);
  assert.equal(await run(false), 1);               // one target
  assert.equal(await run(true), 0);                // two targets
});

test('CB167-04 Striares counts Spirits with Legacy; Shamanism and Legacy are detected as keywords', async () => {
  const bp = await ev(`const s = spirit(P, '26RBS02-003', 2000); const base = BS.bpOf(s); G.attacker = s;
    const withLegacy = BS.bpOf(s); spirit(P, '26RBS01-012', 5000); const two = BS.bpOf(s); G.attacker = null; return [base, withLegacy, two];`);
  assert.equal(bp[1], bp[0] + 2000);               // Striares itself has Legacy
  assert.equal(bp[2], bp[0] + 4000);               // plus the other Legacy Spirit
  const has = id => ev(`spirit(P, '${id}', 3000); return BS.fxIf(P, O, { ctrl: { n: 1, type: 'Spirit', keyword: 'Shamanism' } });`);
  assert.equal(await has('26RBS02-023'), true);    // {{Shaman|...}} holder
  assert.equal(await has('BS75-001'), false);
});

test('CB167-05 Mushakko: the end-of-battle draw checks the Hand size when it resolves', async () => {
  const run = hand => ev(`const s = spirit(P, '26RSD01-001', 3000, 3); for (let i = 0; i < ${hand}; i++) P.hand.push(BS.mkInst('BS75-001')); for (let i = 0; i < 3; i++) P.deck.push(BS.mkInst('BS75-004'));
    G.attacker = s; G.eob = []; await BS.fireFx(P, 'ATTACKS', s); await BS.endOfBattle(); G.attacker = null; return P.hand.length;`);
  assert.equal(await run(5), 6);
  assert.equal(await run(6), 6);
});
