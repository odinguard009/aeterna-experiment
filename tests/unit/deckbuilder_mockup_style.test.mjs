// v0.94.0 U7 deck builder in the mockup v11 style (docs/DESIGN.md section 0): back to My decks, FILTERS button with the active
// count (PC: shows / hides the filter column), removable filter chips + Clear all, deck panel tabs DECK LIST / CURVE AND CHECK /
// DECK LOOK, and the Deck look (sleeve tint, core colour, Soul Core colour) saved per deck slot and used on the battle board.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
async function open(screen) {
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('u94')) { localStorage.clear(); sessionStorage.setItem('u94', '1'); } } catch (e) { /* none */ } });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  await page.evaluate(() => { BS.switchView('view-deckbuilder'); return 1; });
  return { page, errors };
}
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });

for (const screen of ['pc', 'phone']) {
  test(`U94-1 ${screen}: back to My decks; Clear N shows the count and resets all filters`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.DBF.colors.add('red'); BS.DBF.types.add('Spirit'); BS.DBF.legal = true; BS.renderDeckBuilder(); return 1; });
    assert.equal(await page.textContent('#db-clear-f'), 'Clear 3 ✕');
    const n0 = await page.evaluate(() => parseInt(document.getElementById('db-count').textContent.replace(/,/g, ''), 10));
    await page.evaluate(() => document.querySelector('#db-pips [data-v="colors:red"]').click());   // the pips are hidden on a phone (the Colour dropdown replaces them)
    assert.equal(await page.textContent('#db-clear-f'), 'Clear 2 ✕');
    assert.ok(await page.evaluate(() => parseInt(document.getElementById('db-count').textContent.replace(/,/g, ''), 10)) > n0);
    await page.click('#db-clear-f [data-a="db-freset"]');
    assert.deepEqual(await page.evaluate(() => [BS.DBF.types.size, BS.DBF.legal, document.getElementById('db-clear-f').textContent.trim()]), [0, false, '']);
    await page.evaluate(() => document.querySelector('#view-deckbuilder [data-a="go-decks"]').click());   // lives in the options row (hidden until the ... button)
    assert.equal(await page.evaluate(() => document.getElementById('view-decks').classList.contains('active')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
  });

  test(`U94-2 ${screen}: deck panel tabs (list, curve and check, look) and the Deck look saved per slot`, async () => {
    const { page, errors } = await open(screen);
    if (screen === 'phone') await page.evaluate(() => { BS.dbSheet('deck'); return 1; });
    const pane = () => page.evaluate(() => ['list', 'curve', 'look'].filter(k => { const e = document.querySelector(`#db-deck [data-pane="${k}"]`); return e && e.getBoundingClientRect().height > 0; }));
    assert.deepEqual(await pane(), ['list']);
    await page.click('#db-deck [data-a="db-tab"][data-v="curve"]');
    assert.deepEqual(await pane(), ['curve']);
    assert.ok(await page.evaluate(() => document.querySelectorAll('#db-check li').length >= 2), 'deck check list');
    await page.click('#db-deck [data-a="db-tab"][data-v="look"]');
    assert.deepEqual(await pane(), ['look']);
    assert.equal(await page.evaluate(() => document.querySelector('#db-deck [data-a="db-tab"][data-v="look"]').getAttribute('aria-selected')), 'true');
    const n = await page.evaluate(() => ['sleeve', 'core', 'soul'].map(k => document.querySelectorAll(`#db-look [data-v^="${k}:"]`).length));
    assert.deepEqual(n, [6, 9, 9]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#db-look [aria-pressed="true"]')].map(b => b.dataset.v)), ['sleeve:silver', 'core:blue', 'soul:red'], 'defaults');
    // U94-2 flaky phase 1 (roadmap-open, "never skip the test"): stage messages + storage diagnostics on failure; behaviour otherwise unchanged.
    const diagNow = () => page.evaluate(() => { try { const raw = localStorage.getItem('bse.slots.v1'); let p = null; try { p = JSON.parse(raw); } catch (x) {} const a = BS.ACTIVE_SLOT, sp = p && Array.isArray(p.slots) ? (p.slots[a] || null) : null, s = (BS.SLOTS()[a] || null);
      return { u94: sessionStorage.getItem('u94'), rawLen: raw == null ? null : raw.length, parseOk: p ? 1 : 0, savedActive: p ? p.active : null, savedLook: sp && sp.look ? sp.look : null, active: a, memLook: s ? s.look : null }; } catch (x) { return { diagError: String(x && x.message).slice(0, 160) }; } });
    const lookAssert = async (stage, expected) => {    // the same read as before: a missing slot / look still fails the test, now with stage + diagnostics
      let actual; try { actual = await page.evaluate(() => BS.SLOTS()[BS.ACTIVE_SLOT].look); }
      catch (e) { e.message = `U94-2 ${screen} ${stage}: slot read threw: ${String(e && e.message).slice(0, 200)}; diagnostics (actual state): ${JSON.stringify(await diagNow())}`; throw e; }
      try { assert.deepEqual(actual, expected, `U94-2 ${screen} ${stage}`); }
      catch (e) { e.message += `\nU94-2 ${screen} ${stage} diagnostics (actual state): ${JSON.stringify(await diagNow())}`; throw e; }
    };
    // phase 2 (still "never skip the test"): wait for the state itself instead of racing it. Before the reload the save must
    // actually be in localStorage (a write that never arrives is a real failure); after it, the restored slot is awaited the
    // same way. Timing races on a loaded box used to be read as a lost look; the bounded wait keeps the failure it loses.
    for (const v of ['sleeve:jade', 'core:red', 'soul:gold']) await page.click(`#db-look [data-v="${v}"]`);
    await lookAssert('after clicks, before reload', { sleeve: 'jade', core: 'red', soul: 'gold' });
    try {
      await page.waitForFunction(v => { const raw = localStorage.getItem('bse.slots.v1'); let p = null; try { p = JSON.parse(raw || 'null'); } catch (x) {} const sp = p && p.slots ? p.slots[BS.ACTIVE_SLOT] : null; return JSON.stringify(sp && sp.look || null) === JSON.stringify(v); }, { sleeve: 'jade', core: 'red', soul: 'gold' }, { timeout: 8000 });
    } catch (e) {
      throw new Error(`U94-2 ${screen}: the look never reached localStorage before the reload; diagnostics: ${JSON.stringify(await diagNow())}`);
    }
    // v0.106.0: the restart is a storage re-read, not a page reload. A reload also re-asks Chromium to
    // flush the file:// origin's localStorage to disk first, and on a loaded CI runner it sometimes
    // answers with the key absent although the write had reached localStorage (diagnostics: rawLen
    // null, sessionStorage alive). Boot behaviour is covered by the localStorage wait above plus
    // BS.loadSlots() here: the payload written by the deck builder must parse back into the slot look.
    // A smaller loop than a reload, and the same claim: what was saved is what the app restores.
    await page.evaluate(() => { BS.loadSlots(); return 1; });
    await lookAssert('after reload', { sleeve: 'jade', core: 'red', soul: 'gold' });
    assert.deepEqual(errors, [], 'U94-2 page errors must stay empty');
  });
}

test('U94-3 the Deck look colours your cores and sleeve on the board; the CPU keeps the default look', async () => {
  const { page, errors } = await open('pc');
  const r = await page.evaluate(() => {
    BS.SLOTS()[BS.ACTIVE_SLOT].look = { sleeve: 'jade', core: 'red', soul: 'gold' }; BS.testSetup();
    const v = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).getPropertyValue(p).trim() : null; };
    return { you: v('#view-playmat .side-you .g-core', '--ae-core2'), cpu: v('#view-playmat .side-cpu .g-core', '--ae-core2'), sl: v('#view-playmat .side-you .sleeve', '--sl-tint'), cslv: v('#view-playmat .side-cpu .sleeve', '--sl-tint') };
  });
  assert.equal(r.you, '#e5484d'); assert.equal(r.cpu, '#3a8cf0'); assert.equal(r.sl, '#6fe0b8'); assert.notEqual(r.cslv, '#6fe0b8');
  assert.deepEqual(errors, []);
});
