// v0.85.0 (phase F4 = monorepo step M4 part 1): every match keeps a host-independent port input record (G.prec,
// packages/engine/src/15b-replay.js); headless replayPort() re-runs it without a browser and viewerReplay() exports
// board frames. Records from the web game, the headless runner and the fuzzer replay the same way.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { playHeadless, replayPort, viewerReplay } from '../../packages/engine/headless.mjs';
import { closeBrowser, openGame, simMatch } from './lib/game.mjs';

after(async () => { await closeBrowser(); });

test('R85-01 a headless match with a human seat replays from its port record (same result and log hash)', async () => {
  for (const [a, b, seed] of [['red', 'mitra', 3], ['yellow', 'green', 8]]) {
    const r = await playHeadless({ seed, deckA: a, deckB: b, human: true, timeoutMs: 30000 });
    assert.ok(r.over && r.port && r.port.v === 2 && r.port.final, `${a} vs ${b}`);
    assert.deepEqual(r.port.human, ['player']);
    assert.equal(r.port.answers.length, r.decisions.length, 'every decision is in the record');
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(r.port))), JSON.stringify(r.port));
    const x = await replayPort(r.port);
    assert.ok(x.ok, x.reason); assert.ok(x.same, JSON.stringify([x.final, r.port.final]));
    assert.equal(x.at, x.total);
  }
});

test('R85-02 fuzzed CPU-vs-CPU sims (headless and browser) replay headless from the record alone', async () => {
  const fz = { player: true, opponent: true };
  const h = await playHeadless({ seed: 77, deckA: 'green', deckB: 'blue', fuzz: fz, timeoutMs: 30000 });
  assert.ok(h.over); assert.deepEqual(h.port.cpu.fuzz, fz);
  assert.ok(h.port.answers.length > 0, 'the CPU picks go through the port too (v0.105.0, M6 step 1): ' + h.port.answers.length);
  const x = await replayPort(h.port); assert.ok(x.ok && x.same, x.reason);   // the replay re-derives the CPU picks; the record only witnesses them
  const b = await simMatch(596, { mode: 'yellowpurple', fuzz: fz, timeoutMs: 60000 });
  assert.ok(b.over && b.port, 'browser sim finished');
  const y = await replayPort({ port: b.port });                // a fuzz case file carries the record as `port`
  assert.ok(y.ok, y.reason); assert.ok(y.same, 'browser sim and headless replay agree: ' + JSON.stringify([y.final, b.port.final]));
});

test('R85-03 viewer replay: plain board frames from a port record, no engine needed to read them', async () => {
  const r = await playHeadless({ seed: 5, deckA: 'purple', deckB: 'red', human: true, timeoutMs: 30000 });
  const v = await viewerReplay(r.port);
  assert.ok(v.ok, v.reason);
  const R = v.replay;
  assert.equal(R.v, 1); assert.equal(R.kind, 'aeterna-viewer'); assert.ok(R.frames.length > 20, 'frames: ' + R.frames.length);
  const last = R.frames[R.frames.length - 1];
  assert.ok(last.over); assert.equal(last.w, r.winner); assert.deepEqual([last.p.player.life, last.p.opponent.life], r.lives);
  assert.ok(R.frames.every((f, i) => i === 0 || JSON.stringify(f) !== JSON.stringify(R.frames[i - 1])), 'no repeated frames');
  assert.ok(R.frames.every(f => typeof f.p.opponent.hand === 'number'), 'the CPU Hand is only a count');
  assert.ok(R.frames.some(f => f.p.player.spirits.length > 0));
});

test('R85-04 a changed record diverges with the answer index; other files are refused', async () => {
  const r = await playHeadless({ seed: 3, deckA: 'red', deckB: 'mitra', human: true, timeoutMs: 30000 });
  const bad = JSON.parse(JSON.stringify(r.port)); const k = bad.answers.findIndex(a => a.k === 'action');
  bad.answers[k].k = 'pick';
  const x = await replayPort(bad);
  assert.equal(x.ok, false); assert.match(x.reason, new RegExp(`diverged at answer ${k}`));
  assert.match((await replayPort({ v: 1, inputs: [] })).reason, /not a port record/);
  const cut = JSON.parse(JSON.stringify(r.port)); cut.answers = cut.answers.slice(0, 5); delete cut.final;
  const y = await replayPort(cut); assert.ok(y.ok, 'a shortened record stops where it ends: ' + y.reason); assert.equal(y.at, 5); assert.equal(y.over, false);
});

test('R85-05 browser: a real match record (cut while the human is asked) replays headless to the same log; page messages are not recorded', async () => {
  const { page, errors } = await openGame('');
  const rec = await page.evaluate(async () => {
    /* eslint-disable no-undef */
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    BS.startNewGame({ seed: 11, deckA: BS.PREBUILT.find(x => x.id === 'mitra').cards, deckB: BS.PREBUILT.find(x => x.id === 'train').cards });      // pinned: the default decks changed in v0.97.0
    const t0 = Date.now(); let n0 = -1, n1 = -1, last = null; const skip = new Set();   // item T: a summon whose payment was cancelled is not tried again
    while (Date.now() - t0 < 60000 && BS.G && !BS.G.over && BS.G.turnNo < 4) {
      await sleep(30);
      if (MODAL) { const b = (MODAL.cfg.buttons || []).find(x => !x.dis && !x.hidden); if (last && !(b && b.value)) skip.add(last); last = null; closeModal(b ? b.value : null); continue; }
      if (PICK) { PICK.res([...PICK.uids][0]); continue; }
      if (!BS.seatLoopOpen('player') || !BS.humanCan()) continue;
      if (n0 < 0) { n0 = BS.portRecord().answers.length; uiInfo('Glossary', 'a page message'); await sleep(30); closeModal(null); await sleep(30); n1 = BS.portRecord().answers.length; }
      const g = BS.G, p = g.p.player, c = (g.step === 4 || g.step === 6) && p.hand.find(x => !skip.has(x.uid) && CARDS[x.id].type === 'Spirit' && BS.canPlayCard(p, x));
      last = c ? c.uid : null; BS.sendIntent(c ? { type: 'summon', uid: c.uid } : { type: 'next' }); await sleep(300);
    }
    for (let k = 0; k < 400 && !(BS.seatLoopOpen('player') && BS.humanCan() && !MODAL && !PICK); k++) {
      await sleep(30);
      if (MODAL) { const b = (MODAL.cfg.buttons || []).find(x => !x.dis && !x.hidden); closeModal(b ? b.value : null); }
      else if (PICK) PICK.res([...PICK.uids][0]);
    }
    const r = BS.portRecord(); r.n0 = n0; r.n1 = n1; r.turn = BS.G && BS.G.turnNo; r.over = !!(BS.G && BS.G.over);
    return r;
    /* eslint-enable no-undef */
  });
  await page.close();
  assert.deepEqual(errors, []);
  assert.equal(rec.sim, false); assert.ok(rec.cut, 'cut while the action decision is open'); assert.ok(rec.answers.length > 5);
  assert.ok(rec.answers.some(a => a.k === 'action'));
  assert.ok(rec.n0 > 0 && rec.n1 === rec.n0, `a page message adds no answer (${rec.n0} -> ${rec.n1})`);
  const x = await replayPort(rec);
  assert.ok(x.ok, x.reason); assert.ok(x.sameCut, 'same log up to the cut: ' + JSON.stringify([x.cut, rec.cut]));
  assert.equal(x.at, rec.answers.length);
  assert.ok(rec.turn >= 4 || rec.over, `the match reaches turn 4 (stopped at turn ${rec.turn}; a driver loop that retries a cancelled summon ran into the 60 s cap before)`);
});
