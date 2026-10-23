// v0.83.0 (phase F3 = monorepo step M3 part 1): every human prompt is a decision record through io.decide.
// v0.105.0 (M6 step 1): CPU seats are asked as well - their picks (block, only one routed so far) carry the cpu flag.
// Records and answers: packages/engine/src/05b-decide.js. Hosts: apps/web/src/13e-host.js (modals) and
// packages/engine/headless.mjs (scripted answers, human seat).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { playHeadless, firstAnswer } from '../../packages/engine/headless.mjs';
import { closeBrowser, openGame } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const PAIRS = [['green', 'purple', 6], ['yellow', 'mitra', 7], ['mitra', 'yellow', 10], ['blue', 'green', 9]];

test('H83-01 headless human seat: its prompts reach the host as serializable records and the match ends cleanly', async () => {
  const kinds = {};
  for (const [a, b, seed] of PAIRS) {
    const r = await playHeadless({ seed, deckA: a, deckB: b, human: true, timeoutMs: 30000 });
    assert.deepEqual(r.errors, [], `${a} vs ${b}`);
    assert.ok(r.over && (r.winner === 'player' || r.winner === 'opponent'), `${a} vs ${b} did not finish`);
    for (const d of r.decisions) {
      if (d.seat === 'player') kinds[d.kind] = (kinds[d.kind] || 0) + 1;
      else assert.ok(d.cpu && d.kind === 'pick', 'an opponent ask must be a cpu-marked pick (M6 step 1): ' + JSON.stringify(d));
    }
  }
  assert.ok(kinds.choice > 20, 'choices: ' + JSON.stringify(kinds));
  assert.ok(kinds.pick >= 1, 'field picks: ' + JSON.stringify(kinds));
});

test('H83-02 scripted answers reproduce the match; another script changes it', async () => {
  const [a, b, seed] = PAIRS[0];
  const first = await playHeadless({ seed, deckA: a, deckB: b, human: true });
  assert.ok(first.over && first.decisions.length > 10);
  let i = 0;
  const human = first.decisions.filter(d => d.seat === 'player');      // CPU picks never call answer() (the host answers them with cpuAnswer)
  const script = human.map(d => d.v);
  const again = await playHeadless({ seed, deckA: a, deckB: b, human: true, answer: (seat, d) => { assert.equal(d.kind, human[i].kind, `decision ${i}`); return script[i++]; } });
  assert.equal(i, script.length, 'every scripted answer was asked for');
  assert.deepEqual([again.winner, again.turn, again.hash, again.log], [first.winner, first.turn, first.hash, first.log]);
  // decline every optional choice (the last usable button, usually "No" / "Pass"): still a clean, different match
  const last = (seat, d) => { if (d.kind !== 'choice') return firstAnswer(seat, d); const bs = (d.buttons || []).filter(x => !x.hidden && !x.dis); return bs.length ? bs[bs.length - 1].value : null; };
  const other = await playHeadless({ seed, deckA: a, deckB: b, human: true, answer: last });
  assert.deepEqual(other.errors, []); assert.ok(other.over);
  assert.notEqual(other.hash, first.hash);
});

test('H83-03 the web host answers decision records with its modal, card strip and info dialog', async () => {
  const { page, errors } = await openGame('');
  const r = await page.evaluate(async () => {
    /* eslint-disable no-undef */
    const id = Object.keys(CARDS).find(k => !CARDS[k].token);
    const p = ask({ title: 'Pick', html: 'Choose one.', buttons: [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }], cards: [id], cardsHead: 'Cards' });
    await new Promise(res => setTimeout(res, 20));
    const strip = !!document.querySelector('#modal-card-desc .card-strip .mull-card'), head = document.querySelector('#modal-card-desc .strip-head')?.textContent;
    document.querySelector('#modal-actions [data-mi="1"]').click();
    const v = await p;
    const q = ask({ title: 'Hand', html: 'Redraw?', buttons: [{ label: 'Yes', value: true }], cards: [id, id], cardsStyle: 'mull' });
    await new Promise(res => setTimeout(res, 20));
    const mull = document.querySelectorAll('#modal-card-desc .mull-list .mull-card').length;
    closeModal(true); const w = await q;
    const n = info('Note', 'Just text.'); await new Promise(res => setTimeout(res, 20));
    const close = document.querySelector('#modal-actions [data-mi="0"]').textContent; closeModal(null); await n;
    let bad = null; try { await io.decide('player', { kind: 'nope' }); } catch (e) { bad = e.message; }
    return { v, w, strip, head, mull, close, bad, host: io.host.name };
    /* eslint-enable no-undef */
  });
  await page.close();
  assert.deepEqual(errors, []);
  assert.equal(r.host, 'web'); assert.equal(r.v, 2); assert.equal(r.w, true);
  assert.ok(r.strip); assert.equal(r.head, 'Cards (1)'); assert.equal(r.mull, 2);
  assert.match(r.close, /close/i); assert.match(r.bad || '', /unknown decision record/);
});
