// v0.79.0 (roadmap item A1, owner 2026-10-20): partial promotion. A card may enter the library with part of its printed
// effect missing: fxComplete false + a `residual` list; it shows a "!" mark in the deck builder grid and deck rows, the
// "Complete effects only" filter hides it, prebuilt and CPU decks keep complete cards only, and the two counts (playable =
// in the library, complete = every effect runs) agree between tools/card_counts.py and the engine's `implemented` flag.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBrowser, closeBrowser, GAME_URL, ROOT } from './lib/game.mjs';

after(closeBrowser);
const py = code => execFileSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8' }).trim();
const DATA = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8'));

async function open(viewport) {
  const ctx = await (await getBrowser()).newContext({ viewport }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  return { page, errors, ctx };
}

test('PA01 the compiler drops a whole paragraph to residual, never half of one', () => {
  const out = JSON.parse(py(`
import sys, json; sys.path.insert(0, 'tools'); import compile_v2 as v2
c = {'id': 'TST-001', 'name': 'Test', 'type': 'Spirit', 'color': 'red', 'cost': 3, 'reduction': {'red': 1}, 'symbols': 1, 'saga': 1,
     'levels': [{'cores': 1, 'bp': 3000}, {'cores': 3, 'bp': 5000}],
     'text': '[LV1][LV2] (When Summoned) Draw a card.\\n\\n[LV2] (When Attacks) Draw a card. Then, frobnicate every opposing glorp.'}
v2.install()
try: n, res = v2.compile_partial(c)
finally: v2.uninstall()
print(json.dumps({'fx': n.get('effects'), 'res': res, 'complete': n.get('fxComplete'), 'text': n['text'] == c['text']}))`));
  assert.equal(out.fx.length, 1, JSON.stringify(out.fx));
  assert.equal(out.fx[0].trigger, 'SUMMONED');
  assert.deepEqual(out.res, ['[LV2] (When Attacks) Draw a card. Then, frobnicate every opposing glorp.']);   // the compilable first sentence goes with it
  assert.equal(out.complete, false);
  assert.equal(out.text, true);                     // the card keeps its full printed text
});

test('PA02 data: A1 partial cards are fxComplete false; every residual entry is short, non-empty text', () => {
  const part = DATA.filter(c => /Partial card \(v0\.79\.0/.test(c.note || ''));
  assert.ok(part.length > 1000, String(part.length));
  for (const c of part) assert.equal(c.fxComplete, false, c.id);
  for (const c of DATA) for (const r of c.residual || []) assert.ok(r.length <= 400 && r.trim(), c.id);   // older hand-wired cards list notes, A1 cards printed paragraphs
});

test('PA03 a partial card plays without errors and its compiled paragraph fires', async () => {
  const { page, errors } = await open({ width: 1366, height: 768 });
  const r = await page.evaluate(async () => {
    const id = Object.keys(BS.CARDS).find(k => { const c = BS.CARDS[k]; return c.partial && c.residual.length && c.type === 'Spirit' && (c.effects || []).some(e => e.trigger === 'SUMMONED' && !e.optional && e.actions.length === 1 && e.actions[0].do === 'DRAW' && !e.actions[0].if && !e.if && !e.once && (!e.lv || e.lv.includes(1))); });
    if (!id) return { id: null };
    BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player; G.active = P.key;
    const filler = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].effects && BS.CARDS[k].implemented && !BS.CARDS[k].token);
    for (let i = 0; i < 6; i++) P.deck.push(BS.mkInst(filler));
    const inst = BS.mkInst(id); P.hand.push(inst); P.reserve.n = 20;
    const hand0 = P.hand.length;
    await BS.summonFree(P, inst);
    return { id, drew: P.hand.length - (hand0 - 1), on: BS.fieldList(P).some(f => f.uid === inst.uid) };
  });
  assert.ok(r.id, 'no partial Spirit with a plain (When Summoned) draw in the data');
  assert.equal(r.on, true, r.id);
  assert.ok(r.drew >= 1, JSON.stringify(r));
  assert.deepEqual(errors, []);
});

for (const [name, vp] of [['PC', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`PA04 deck builder (${name}): "!" on partial cards only, legend shown, "Complete effects only" hides them`, async () => {
    const { page, errors } = await open(vp);
    const r = await page.evaluate(async () => {
      BS.switchView('view-deckbuilder'); await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
      const faces = [...document.querySelectorAll('#db-card-list [data-a="dbcard"]')];
      const bad = faces.filter(f => !!f.querySelector('.fx-mark') !== (BS.CARDS[f.dataset.v].implemented === false)).map(f => f.dataset.v);
      const s = document.getElementById('db-search'); s.value = ''; const all = parseInt(document.getElementById('db-count').textContent.replace(/,/g, ''), 10);
      const cb = document.getElementById('db-play'); cb.click();   // v0.137.0: the Playable Only chip
      await new Promise(r => setTimeout(r, 50));
      const only = parseInt(document.getElementById('db-count').textContent.replace(/,/g, ''), 10);
      const marked = document.querySelectorAll('#db-card-list .fx-mark').length;
      const expect = Object.keys(BS.CARDS).filter(k => !BS.CARDS[k].token && BS.CARDS[k].implemented !== false).length;
      cb.click();
      const pid = Object.keys(BS.CARDS).find(k => BS.CARDS[k].implemented === false);
      s.value = pid; BS.renderDeckBuilder(); await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
      const mk = document.querySelector(`#db-card-list [data-v="${pid}"] .fx-mark`); s.value = ''; BS.renderDeckBuilder();
      return { pc: BS.isPC(), faces: faces.length, bad, all, only, marked, expect, label: mk && mk.getAttribute('aria-label') };
    });
    assert.equal(r.pc, name === 'PC');
    assert.ok(r.faces > 10, JSON.stringify(r));
    assert.deepEqual(r.bad, []);
    assert.ok(r.only < r.all, JSON.stringify(r));
    assert.equal(r.only, r.expect);
    assert.equal(r.marked, 0);
    assert.equal(r.label, 'Effect not fully implemented');
    assert.deepEqual(errors, []);
  });
}

test('PA05 deck rows carry the mark; the two counts agree between tools/card_counts.py and the engine', async () => {
  const [playable, complete] = py('import sys; sys.path.insert(0, "tools"); from card_counts import counts; print(*counts())').split(' ').map(Number);
  const { page, errors } = await open({ width: 1366, height: 768 });
  const r = await page.evaluate(async ids => {
    const inPack = ids.filter(id => BS.CARDS[id]);
    const part = inPack.find(id => BS.CARDS[id].implemented === false && BS.CARDS[id].type === 'Spirit' && !BS.legalityOf(id, BS.FORMAT));
    BS.switchView('view-deckbuilder');
    BS.dbChange(part, 1); await new Promise(r => setTimeout(r, 30));
    const row = [...document.querySelectorAll('#db-dk-list .drow')].find(x => x.dataset.id === part);
    const out = { n: inPack.length, complete: inPack.filter(id => BS.CARDS[id].implemented !== false).length, rowMark: !!(row && row.querySelector('.fx-mark')) };
    BS.dbUndo(); return out;
  }, DATA.map(c => c.id));
  assert.equal(r.n, playable);
  assert.equal(r.complete, complete);
  assert.equal(r.rowMark, true);
  assert.deepEqual(errors, []);
});

test('PA06 prebuilt decks (also the CPU deck pool) hold no card promoted by the A1 partial promotion', async () => {
  // The hand-built colour decks predate A1 and include hand-wired cards whose fxComplete is false: they show "!" too
  // (roadmap-open.md item A follow-up). A1's bulk-promoted partial cards must never enter a prebuilt deck.
  const a1 = new Set(DATA.filter(c => /Partial card \(v0\.79\.0/.test(c.note || '')).map(c => c.id));
  assert.ok(a1.size > 1000, String(a1.size));
  const { page } = await open({ width: 1366, height: 768 });
  const ids = await page.evaluate(() => BS.PREBUILT.filter(d => !d.format).flatMap(d => Object.keys(d.cards).map(id => d.id + ':' + id)));
  assert.deepEqual(ids.filter(x => a1.has(x.split(':')[1])), []);
});
