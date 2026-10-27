// v0.63.0 U1 battle screen restyle (owner, 2026-10-18; docs/DESIGN.md section 0): clickable step buttons with the
// "Illegal move" strip, player colour + Dark/Light theme, plates without prefixes, mirrored phone grid, core gems.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, GAME_URL } from './lib/game.mjs';

const SCREENS = {
  pc: { viewport: { width: 1366, height: 768 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const pages = {};
async function open(screen) {
  if (pages[screen]) return pages[screen];
  const ctx = await (await getBrowser()).newContext(SCREENS[screen]), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(GAME_URL); await page.waitForFunction(() => !!window.BS);
  pages[screen] = { page, errors, ctx }; return pages[screen];
}
after(async () => { for (const k of Object.keys(pages)) await pages[k].ctx.close(); await closeBrowser(); });
const ev = async (fn, arg, screen = 'pc') => (await open(screen)).page.evaluate(fn, arg);
const warnText = () => { const w = document.querySelector('.step-warn'); return w && !w.hidden ? w.textContent : ''; };

test('U01 a step button for a passed step shows "Illegal move" and changes nothing', async () => {
  const r = await ev(w => { BS.testSetup(); document.querySelector('.step-chip[data-v="2"]').click(); return [BS.G.step, (0, eval)('(' + w + ')')()]; }, warnText.toString());
  assert.equal(r[0], 4); assert.match(r[1], /ILLEGAL MOVE/); assert.match(r[1], /Draw Step has passed/);
});
test('U02 the current step says it is already the current step', async () => {
  const r = await ev(w => { BS.testSetup(); document.querySelector('.step-chip[data-v="4"]').click(); return (0, eval)('(' + w + ')')(); }, warnText.toString());
  assert.match(r, /Already in the Main Step/);
});
test('U03 Attack from Main is legal: same as NEXT', async () => {
  const r = await ev(() => { BS.testSetup(); BS.stepClick(5); return BS.G.step; });
  assert.equal(r, 5);
});
test('U04 End from Main runs the Attack Step (no attacks) and ends the turn through NEXT', async () => {
  const { page } = await open('pc');
  await page.evaluate(() => { BS.testSetup(); window.__ended = 0; BS.G.turnResolver = () => { window.__ended++; }; BS.stepClick(6); });
  await page.waitForFunction(() => window.__ended === 1, null, { timeout: 8000 });   // the turn ended once, after the Attack Step
  assert.deepEqual(await page.evaluate(() => [BS.G.step, BS.G.active]), [5, 'player']);
});
test('U05 during the CPU turn every step button says the CPU is playing', async () => {
  const r = await ev(w => { BS.testSetup(); BS.G.active = 'opponent'; BS.render(); BS.stepClick(5); return [BS.G.step, (0, eval)('(' + w + ')')(), document.querySelector('.full-center-divider').classList.contains('cpu-turn'), document.querySelector(".turn-title").innerText.replace(/\s+/g, ' ')]; }, warnText.toString());
  assert.equal(r[0], 4); assert.match(r[1], /CPU is playing/); assert.equal(r[2], true); assert.match(r[3], /^OPPONENT TURN \d+$/);
});
test('U06 a step that is not next says which step is legal', async () => {
  const r = await ev(w => { BS.testSetup(); BS.G.format = 'standard'; BS.G.steps = ['START', 'CORE', 'DRAW', 'REFRESH', 'MAIN', 'ATTACK', 'MAIN 2', 'END']; BS.render(); BS.stepClick(6);
    const t = (0, eval)('(' + w + ')')(); BS.G.format = 'eternal'; return [BS.G.step, t]; }, warnText.toString());
  assert.equal(r[0], 4); assert.match(r[1], /Next legal step: Attack/);
});
test('U07 player colour and mode: red turns the CPU blue, light mode sets data-mode, saved on the device', async () => {
  const r = await ev(() => {
    const cs = () => getComputedStyle(document.documentElement), out = [];
    BS.setTheme('color', 'red'); out.push(cs().getPropertyValue('--you').trim(), cs().getPropertyValue('--cpu').trim());
    BS.setTheme('mode', 'light'); out.push(document.documentElement.dataset.mode, JSON.parse(localStorage.getItem('aeterna.theme.v1')).mode);
    BS.setTheme('color', 'nope'); out.push(BS.THEME.color);
    BS.setTheme('color', 'teal'); BS.setTheme('mode', 'dark'); out.push(cs().getPropertyValue('--you').trim(), cs().getPropertyValue('--cpu').trim());
    return out;
  });
  assert.deepEqual(r, ['#e5484d', '#3a8cf0', 'light', 'light', 'red', '#17b897', '#d8344b']);
});
test('U08 PC plates: no Tr/Cnt/Vd prefixes and no "Your"/"CPU" in zone labels; Life shows one gem per Life', async () => {
  const r = await ev(() => { BS.testSetup(); const t = [...document.querySelectorAll('.side-flank-pc, .pc-hand-flank, .row-header-badge')].map(e => e.innerText).join(' ');
    const P = BS.G.p.player; return [t, document.querySelectorAll('.zone-box[data-v="player:life"] .g-core').length + document.querySelectorAll('.zone-box[data-v="player:life"] .g-soul').length, P.life]; });
  assert.doesNotMatch(r[0], /\b(Tr|Cnt|Vd|Core):|\bYOUR\b|\bCPU\b/i); assert.equal(r[1], r[2]);
});
test('U09 phone: the CPU stat grid is the point mirror of yours and the field captions show (mockup)', async () => {
  const r = await ev(() => { BS.testSetup(); const bars = [...document.querySelectorAll('.mobile-stats-bar')].map(b => [...b.querySelectorAll('.stat-pill')].map(p => p.dataset.v.split(':')[1]));
    const tag = document.querySelector('.row-header-badge').getBoundingClientRect(); return [bars, tag.width > 1 && tag.height > 1]; }, null, 'phone');
  assert.deepEqual(r[0][1], ['life', 'reserve', 'hand', 'deck', 'trash', 'count', 'void', 'removed']);
  assert.deepEqual(r[0][0], r[0][1].slice().reverse()); assert.equal(r[1], true);
});
test('U10 field cards draw one gem per core and the Soul Core as its own gem', async () => {
  const r = await ev(() => { BS.testSetup(); const P = BS.G.p.player, s = BS.mkInst('BS74-047'); s.cores = 3; s.soul = true; P.spirits.push(s); BS.render();
    const e = document.querySelector(`.tcg-card[data-v="player:spirit:${s.uid}"] .core-tag`); return [e.querySelectorAll('.g-core').length, e.querySelectorAll('.g-soul').length, e.textContent.trim()]; });
  assert.deepEqual(r, [2, 1, 'C:3 S']);
});
test('U11 no page errors on either layout', async () => {
  await ev(() => BS.render(), null, 'phone');
  for (const s of Object.keys(pages)) assert.deepEqual(pages[s].errors, [], s);
});
