// v0.84.0 (phase F3 part 2 = monorepo step M3 rest): the human seat's board actions are intent records, answers to the
// action decision through io.decide (packages/engine/src/05c-intent.js); the CPU can answer any record through the port
// (cpuAnswer). Hosts: apps/web/src/13e-host.js (sendIntent) and packages/engine/headless.mjs (scripted intents).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { playHeadless, firstAnswer } from '../../packages/engine/headless.mjs';
import { closeBrowser, openGame } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const PAIRS = [['red', 'mitra', 3], ['green', 'purple', 6], ['blue', 'green', 9]];
const types = r => r.decisions.filter(d => d.kind === 'action').reduce((o, d) => ((o[d.v.type] = (o[d.v.type] || 0) + 1), o), {});

test('I84-01 a headless human seat plays its own turns with intents (the CPU answers through the port); no CPU turn runs for it', async () => {
  const all = {};
  for (const [a, b, seed] of PAIRS) {
    const r = await playHeadless({ seed, deckA: a, deckB: b, human: true, timeoutMs: 30000 });
    assert.deepEqual(r.errors, [], `${a} vs ${b}`);
    assert.ok(r.over && (r.winner === 'player' || r.winner === 'opponent'), `${a} vs ${b} did not finish`);
    const t = types(r); for (const [k, n] of Object.entries(t)) all[k] = (all[k] || 0) + n;
    assert.ok(r.acted.ok >= r.decisions.filter(d => d.kind === 'action').length - r.acted.refused, 'every intent is acknowledged');
    for (const d of r.decisions) assert.ok(d.seat === 'player' || (d.cpu && d.kind === 'pick'), 'a cpu ask must be a cpu-marked pick (M6): ' + JSON.stringify(d));
  }
  assert.ok(all.summon >= 3, 'summons: ' + JSON.stringify(all));
  assert.ok(all.attack >= 3, 'attacks: ' + JSON.stringify(all));
  assert.ok(all.next >= 10, 'NEXT presses: ' + JSON.stringify(all));
});

test('I84-02 recorded intents and answers reproduce the match exactly', async () => {
  const [a, b, seed] = PAIRS[0];
  const first = await playHeadless({ seed, deckA: a, deckB: b, human: true });
  assert.ok(first.over && first.decisions.some(d => d.kind === 'action'));
  let i = 0;
  const human = first.decisions.filter(d => d.seat === 'player');      // CPU picks are answered by the host's cpuAnswer, never by this script
  const again = await playHeadless({ seed, deckA: a, deckB: b, human: true, answer: (seat, d) => { assert.equal(d.kind, human[i].kind, `decision ${i}`); return human[i++].v; } });
  assert.equal(i, human.length);
  assert.deepEqual([again.winner, again.turn, again.hash, again.log], [first.winner, first.turn, first.hash, first.log]);
});

test('I84-03 illegal intents are refused and change nothing; a seat that only sends them has its turn ended', async () => {
  const [a, b, seed] = PAIRS[1];
  let k = 0;
  const bad = [{ type: 'summon', uid: -1 }, { type: 'attack', uid: -1 }, { type: 'core', op: 'teleport', uid: 1 }, { type: 'cast', uid: -5 }];
  const r = await playHeadless({ seed, deckA: a, deckB: b, human: true, answer: (seat, d) => (d.kind === 'action' && k++ % 3 === 0 ? bad[k % bad.length] : firstAnswer(seat, d)) });
  assert.deepEqual(r.errors, []); assert.ok(r.over);
  assert.ok(r.acted.refused >= 5, 'refused: ' + JSON.stringify(r.acted));
  const loop = await playHeadless({ seed, deckA: a, deckB: b, human: true, timeoutMs: 30000, answer: (seat, d) => (d.kind === 'action' ? { type: 'summon', uid: -1 } : firstAnswer(seat, d)) });
  assert.deepEqual(loop.errors, []); assert.ok(loop.over, 'the capped turns end, the match finishes');
  assert.equal(loop.winner, 'opponent');
});

test("I84-04 human: 'pass' ends every turn of that seat at once", async () => {
  const r = await playHeadless({ seed: 4, deckA: 'red', deckB: 'mitra', human: 'pass', timeoutMs: 30000 });
  assert.deepEqual(r.errors, []); assert.ok(r.over); assert.equal(r.winner, 'opponent');
  assert.ok(r.decisions.filter(d => d.kind === 'action').every(d => d.v.type === 'end'));
});

test('I84-05 browser: intents run at once on a test board; in a real match the buttons answer the action decision', async () => {
  const { page, errors } = await openGame('');
  const r = await page.evaluate(async () => {
    /* eslint-disable no-undef */
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    const out = {};
    // test board (no seat loop): applied at once
    BS.testSetup(); const G0 = BS.G, P = G0.p.player;
    const sp = Object.keys(CARDS).find(k => CARDS[k].type === 'Spirit' && !CARDS[k].token && CARDS[k].cost === 0 && !CARDS[k].effects?.length && !CARDS[k].reduction?.length);
    const h = BS.mkInst(sp); P.hand.push(h); P.reserve.n = 5;
    out.loop0 = BS.seatLoopOpen('player');
    out.summon = await BS.sendIntent({ type: 'summon', uid: h.uid });
    out.onField = P.spirits.includes(h);
    out.add = await BS.sendIntent({ type: 'core', op: 'add', uid: h.uid });
    out.again = await BS.sendIntent({ type: 'summon', uid: h.uid });
    out.junk = await BS.applyIntent('player', { type: 'fly' });
    out.next = await BS.sendIntent({ type: 'next' }); out.step = BS.G.step;
    // real match: answer prompts, then summon / NEXT through the seat loop
    BS.startNewGame({ seed: 5, deckA: BS.PREBUILT.find(x => x.id === 'mitra').cards, deckB: BS.PREBUILT.find(x => x.id === 'train').cards });      // pinned: the default decks changed in v0.97.0
    const t0 = Date.now(); let sent = 0, ok = 0;
    while (Date.now() - t0 < 60000 && BS.G && !BS.G.over && BS.G.turnNo < 4) {
      await sleep(30);
      if (MODAL) { const b = (MODAL.cfg.buttons || []).find(x => !x.dis && !x.hidden); closeModal(b ? b.value : null); continue; }
      if (PICK) { PICK.res([...PICK.uids][0]); continue; }
      if (!BS.seatLoopOpen('player') || !BS.humanCan()) continue;
      const g = BS.G, p = g.p.player;
      const c = (g.step === 4 || g.step === 6) && p.hand.find(x => (CARDS[x.id].type === 'Spirit') && BS.canPlayCard(p, x));
      sent++; BS.sendIntent(c ? { type: 'summon', uid: c.uid } : { type: 'next' }).then(v => { if (v) ok++; }); await sleep(300);   // prompts inside the action are answered above
    }
    out.sent = sent; out.ok = ok; out.turn = BS.G && BS.G.turnNo; out.host = io.host.name;
    return out;
    /* eslint-enable no-undef */
  });
  await page.close();
  assert.deepEqual(errors, []);
  assert.equal(r.loop0, false);
  assert.deepEqual([r.summon, r.onField, r.add, r.again, r.junk, r.next, r.step], [true, true, true, false, false, true, 5]);
  assert.ok(r.turn >= 4, 'the match went on: turn ' + r.turn);
  assert.ok(r.sent >= 3 && r.ok >= 3, `intents sent ${r.sent}, applied ${r.ok}`);
});
