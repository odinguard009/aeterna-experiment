// v0.105.0 (M6 step 1; docs/ai/monorepo-plan.md Design 1): CPU seats answer the port too.
// The hosts reply to cpu-marked records with cpuAnswer() (packages/protocol/src/00p-protocol.js, packages/engine/src/05b-decide.js portAsk).
// The block decision of a CPU defender (08-battle.js askBlock) is the first converted decision: hosts answer it with the
// same cpuChooseBlock policy, so the records of the routed match are bit-identical to the inline CPU (hashes below were
// measured on the pre-change build 93bf8b7 and must never move).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { playHeadless, firstAnswer, loadEngine } from '../../packages/engine/headless.mjs';
import { closeBrowser, openGame } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('M6-01 CPU decisions answer the port with the unchanged CPU policy: sims stay bit-identical', async () => {
  for (const [seed, winner, hash, asks] of [
    [2, 'player', '1dd0b275', { block: 1, summon: 10, activate: 5, revive: 0, advent: 0, brave: 8, attack: 11 }],
    [3, 'opponent', '28020066', { block: 1, summon: 8, activate: 6, revive: 0, advent: 2, brave: 7, attack: 12 }],
    [8, 'player', 'ac0aeae3', { block: 3, summon: 9, activate: 5, revive: 0, advent: 0, brave: 6, attack: 12 }],
    [11, 'opponent', '921a7697', { block: 4, summon: 14, activate: 3, revive: 0, advent: 0, brave: 9, attack: 16 }],
  ]) {
    const r = await playHeadless({ seed });
    assert.deepEqual(r.errors, [], 'seed ' + seed);
    assert.equal(r.winner, winner, seed);
    assert.equal(r.hash, hash, 'the routed CPU changed the match (seed ' + seed + ')');
    for (const [k, n] of Object.entries(asks)) {
      assert.equal(r.decisions.filter(d => d.cpu && d.cpuK === k).length, n, k + ' picks routed through the port (seed ' + seed + ')');
    }
  }
});

test('M6-02 a human seat vs CPU: the CPU defender block pick reaches the host as a cpu-marked record and the match is unchanged', async () => {
  for (const [deckA, deckB, seed, winner, hash, asks] of [
    ['yellow', 'mitra', 7, 'player', '31a467d2', 1],
    ['mitra', 'yellow', 10, 'opponent', '3f7154b3', 3],
  ]) {
    const r = await playHeadless({ seed, deckA, deckB, human: true });
    const cpu = r.decisions.filter(d => d.cpu);
    assert.equal(r.winner, winner, seed + ' winner');
    assert.equal(r.hash, hash, 'the routed CPU changed the match (' + deckA + ' vs ' + deckB + ')');
    assert.ok(cpu.length >= asks, 'CPU asks reached the host (' + deckA + ' vs ' + deckB + '): ' + cpu.length);
    for (const d of cpu) assert.ok(d.kind === 'pick', 'a cpu ask must be a pick record (block or summon): ' + JSON.stringify(d));
  }
});

test('M6-03 the web host answers cpu-marked records without UI and keeps sims playable', async () => {
  const { page, errors } = await openGame('?sim=1');
  await page.evaluate(() => BS.startNewGame({ seed: 8 }));
  await page.waitForFunction(() => BS.G && BS.G.over, null, { timeout: 90000 });
  assert.deepEqual(errors, []);
  const log = await page.evaluate(() => window.__cpuDecideLog || []);
  assert.ok(log.length >= 1, 'cpu-marked records reached the web host in the sim');
  for (const d of log) assert.ok(d.kind === 'pick', 'a cpu ask must be a pick record (block or summon): ' + JSON.stringify(d));
});

test('M6-04 real-match records keep replaying: full record and an old-shape record without CPU answers', async () => {
  for (const seed of [8, 10]) {
    const r = await playHeadless({ seed, real: true, answer: firstAnswer });
    assert.deepEqual(r.errors, []);
    assert.ok(r.over);
    const rec = r.port;
    const bySeat = rec.answers.reduce((a, x) => { a[x.s] = (a[x.s] || 0) + 1; return a; }, {});
    assert.ok(bySeat.opponent >= 1, 'a CPU answer was recorded for seed ' + seed + ': ' + JSON.stringify(bySeat));
    const one = loadEngine({ sim: false }), two = loadEngine({ sim: false });
    const full = await one.runPortRecord(JSON.parse(JSON.stringify(rec)), { timeoutMs: 60000 });
    assert.ok(full.ok && full.same, 'full record replays identical (seed ' + seed + ': ' + full.reason + ')');
    const oldLike = { ...rec, answers: rec.answers.filter(x => x.s !== 'opponent') };
    const back = await two.runPortRecord(JSON.parse(JSON.stringify(oldLike)), { timeoutMs: 60000 });
    assert.ok(back.ok && back.same, 'an old-shape record (no CPU answers) replays identical via the cpuAnswer fallback (seed ' + seed + ': ' + back.reason + ')');
  }
});
