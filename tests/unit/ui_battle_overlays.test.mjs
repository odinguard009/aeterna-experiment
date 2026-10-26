// v0.91.0 U5 battle overlays and popups in the mockup v11 style (docs/DESIGN.md section 0 and the U5 checklist):
// every modal gets a kind chip and cut-corner panel, skewed buttons (yellow only for the "yes" of a prompt),
// one shared overlay layer #ae-fx for the turn / step / Flash ribbons and the match-start banner, the block strip.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const ctxs = [];
async function open(screen, query = '', extra = {}) {
  const ctx = await (await getBrowser()).newContext(Object.assign({}, SCREENS[screen], extra)); ctxs.push(ctx);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto(GAME_URL + query); await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}
after(async () => { for (const c of ctxs) await c.close(); await closeBrowser(); });
const ribbons = page => page.evaluate(() => [...document.querySelectorAll('#ae-fx .ae-rib')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));

for (const screen of ['pc', 'phone']) {
  test(`U91-1 ${screen}: a yes/no effect prompt has the kind chip, the cut-corner panel and a yellow yes; values unchanged`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.testSetup(); window.__v = 'open'; BS.modal({ title: '✨ Sample Spirit', html: 'Draw 1 card?', buttons: [{ label: 'Do it', cls: 'primary', value: 7 }, { label: 'Skip', cls: 'cancel', value: null }] }).then(v => { window.__v = v; }); return 1; });
    const r = await page.evaluate(() => {
      const box = document.querySelector('#action-modal .modal-box'), s = getComputedStyle(box), yes = document.querySelector('#modal-actions [data-mi="0"]');
      return { kind: box.dataset.kind, title: document.getElementById('modal-card-title').textContent, clip: s.clipPath, radius: s.borderTopLeftRadius,
        yes: yes.className, yesBg: getComputedStyle(yes).backgroundColor, skip: document.querySelector('#modal-actions [data-mi="1"]').className,
        btnClip: getComputedStyle(yes).clipPath, wide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.equal(r.kind, 'EFFECT');
    assert.equal(r.title, '✨ Sample Spirit');
    assert.notEqual(r.clip, 'none'); assert.equal(r.radius, '0px');
    assert.match(r.yes, /\bprimary\b/); assert.match(r.yes, /\byes\b/);
    assert.equal(r.yesBg, 'rgb(255, 212, 71)');
    assert.doesNotMatch(r.skip, /\byes\b/);
    assert.notEqual(r.btnClip, 'none');
    assert.equal(r.wide, false);
    await page.click('#modal-actions [data-mi="0"]');
    assert.equal(await page.evaluate(() => window.__v), 7);
    assert.deepEqual(errors, []);
  });

  test(`U91-2 ${screen}: choices with several options keep the side colour, Flash Timing shows its ribbon, the result dialog its kind`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.testSetup(); BS.modal({ title: '⚡ Flash Timing', peek: true, html: 'Cast?', buttons: [{ label: 'Use effect', cls: 'primary', value: 1 }, { label: 'Reserve', cls: 'blue', value: 2 }, { label: 'Pass', cls: 'cancel', value: null }] }); return 1; });
    const r = await page.evaluate(() => ({ kind: document.querySelector('#action-modal .modal-box').dataset.kind, yes: document.querySelectorAll('#modal-actions .yes').length,
      prim: getComputedStyle(document.querySelector('#modal-actions .primary')).backgroundColor, you: getComputedStyle(document.documentElement).getPropertyValue('--you').trim() }));
    assert.equal(r.kind, 'FLASH TIMING');
    assert.equal(r.yes, 0, 'three options: no yellow yes');
    assert.equal(r.prim, await page.evaluate(c => { const d = document.createElement('i'); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, r.you));
    assert.deepEqual(await ribbons(page), ['YOUR FLASH TIMING']);
    await page.evaluate(() => { BS.closeModal(null); BS.G.winner = 'opponent'; BS.G.over = true; showGameOver(); return 1; });
    const o = await page.evaluate(() => ({ kind: document.querySelector('#action-modal .modal-box').dataset.kind, lose: document.querySelector('#action-modal .modal-box').classList.contains('lose'), rib: document.querySelectorAll('#ae-fx .ae-rib').length }));
    assert.deepEqual(o, { kind: 'RESULT', lose: true, rib: 0 });
    assert.deepEqual(errors, []);
  });

  test(`U91-3 ${screen}: the overlay layer shows the match-start banner, turn and step ribbons; never blocks a tap`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.testSetup(); return 1; });
    assert.deepEqual(await ribbons(page), [], 'a board first drawn after turn 1 shows nothing');
    await page.evaluate(() => { BS.G.turnNo = 0; BS.fxCueReset(); BS.render(); return 1; });
    assert.deepEqual(await ribbons(page), [], 'no banner during the coin toss and starting hand (turn 0)');
    await page.evaluate(() => { BS.G.turnNo = 1; BS.modal({ title: '🎴 Starting Hand', html: 'x', buttons: [{ label: 'Keep hand', cls: 'cancel', value: 0 }] }); BS.render(); return 1; });
    assert.deepEqual(await ribbons(page), [], 'never under a dialog');
    await page.evaluate(() => { BS.closeModal(null); BS.render(); return 1; });
    const ban = await ribbons(page);
    assert.equal(ban.length, 1); assert.match(ban[0], /gate open, release!/i);
    await page.evaluate(() => { BS.G.turnNo = 2; BS.G.active = 'opponent'; BS.G.step = 0; BS.render(); return 1; });
    assert.deepEqual(await ribbons(page), ['OPPONENT TURN 2'], 'one ribbon at a time');
    await page.evaluate(() => { BS.G.active = 'player'; BS.G.turnNo = 3; BS.render(); BS.G.step = 4; BS.render(); return 1; });
    assert.deepEqual(await ribbons(page), ['MAIN STEP']);
    const r = await page.evaluate(() => { const l = document.getElementById('ae-fx'), s = getComputedStyle(l); const b = document.querySelector('.inline-next-btn').getBoundingClientRect();
      return { pe: s.pointerEvents, hidden: l.getAttribute('aria-hidden'), hit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).closest('#ae-fx') === null, z: +s.zIndex < +getComputedStyle(document.getElementById('action-modal')).zIndex };
    });
    assert.deepEqual(r, { pe: 'none', hidden: 'true', hit: true, z: true });
    assert.deepEqual(errors, []);
  });

  test(`U91-4 ${screen}: the block pick shows the centre strip and a grey "Do not block"; both go when the pick ends`, async () => {
    const { page, errors } = await open(screen);
    await page.evaluate(() => { BS.testSetup(); window.__b = 'open'; webPick({ text: '🛡 <b>Block?</b> X attacks with 5000 BP (1 symbol). Your Life: 5.', uids: [], buttons: [{ label: 'Do not block', cls: 'cancel', value: 'none' }] }).then(v => { window.__b = v; }); return 1; });
    const r = await page.evaluate(() => ({ blk: document.getElementById('pick-bar').classList.contains('blk'), strip: !document.querySelector('#ae-fx .ae-strip').hidden, txt: document.querySelector('#ae-fx .ae-strip').textContent,
      bg: getComputedStyle(document.querySelector('#pick-btns .modal-btn')).backgroundColor !== 'rgb(255, 212, 71)' }));
    assert.deepEqual(r, { blk: true, strip: true, txt: 'BLOCK?', bg: true });
    await page.click('#pick-btns [data-pk="0"]');
    assert.equal(await page.evaluate(() => window.__b), 'none');
    assert.deepEqual(await page.evaluate(() => [document.getElementById('pick-bar').classList.contains('blk'), document.querySelector('#ae-fx .ae-strip').hidden]), [false, true]);
    assert.deepEqual(errors, []);
  });
}

test('U91-5 sims (?sim=1) never draw ribbons; reduced motion stops the ribbon animation', async () => {
  const { page, errors } = await open('pc', '?sim=1');
  await page.evaluate(() => { BS.SETTINGS.speed = 'fast'; BS.startNewGame({ seed: 4501 }); return 1; });
  await page.waitForFunction(() => BS.G && BS.G.turnNo >= 3, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => document.querySelectorAll('#ae-fx .ae-rib').length), 0);
  const m = await open('pc', '', { reducedMotion: 'reduce' });
  await m.page.evaluate(() => { BS.testSetup(); BS.G.turnNo = 0; BS.fxCueReset(); BS.render(); BS.G.turnNo = 1; BS.render(); return 1; });
  assert.equal(await m.page.evaluate(() => getComputedStyle(document.querySelector('#ae-fx .ae-rib')).animationName), 'none');
  assert.deepEqual(errors.concat(m.errors), []);
});

test('U91-6 payment: + on the "Soul Core on <Spirit>" row works (its key holds a colon; it threw "reading max" before v0.91.0)', async () => {
  const { page, errors } = await open('pc');
  const r = await page.evaluate(async () => {
    const G = BS.testSetup(), p = G.p.player, id = Object.keys(BS.CARDS).find(i => BS.CARDS[i].type === 'Spirit' && BS.isSpiritForm(BS.CARDS[i]));
    const f = BS.mkInst(id); f.cores = 1; f.soul = true; p.spirits.push(f); p.reserve.n = 0; p.reserve.soul = false; BS.render();
    let plan; const done = webPayment(BS.CARDS[id], 1, 0).then(v => { plan = v; });
    const rows = [...document.querySelectorAll('#modal-card-desc .pay-row')].map(e => e.textContent);
    const k = rows.findIndex(t => /Soul Core on/.test(t));
    document.querySelector(`#modal-card-desc .pay-btn[data-mi="${2 * k + 1}"]`).click();
    const sel = document.querySelectorAll('#modal-card-desc .pay-row b')[k].textContent;
    document.querySelector('#modal-actions .modal-btn.primary').click(); await done;
    return { k, sel, plan };
  });
  assert.ok(r.k >= 0); assert.equal(r.sel, '1');
  assert.ok(r.plan && r.plan.fsoul != null, JSON.stringify(r.plan));
  assert.deepEqual(errors, []);
});
