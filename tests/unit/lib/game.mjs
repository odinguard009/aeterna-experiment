// Shared headless browser for the Node unit tests (node --test). One Chromium per test file, one page per helper call.
// The game file is the repo's index.html (always rebuilt from its sources first by `npm test`), so no copy is needed.
import { loadPlaywright } from './pw.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync } from 'node:fs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
/** The real product (default format Standard since v0.97.0). */
export const PRODUCT_URL = pathToFileURL(join(ROOT, 'index.html')).href;
/** Test copy of the game with the default format back to Eternal: most tests were written for Eternal rules. A test of the real default uses PRODUCT_URL / openGame(query, true). */
function eternalCopy() {
  const src = join(ROOT, 'index.html'), dst = join(ROOT, 'build', 'index-eternal.html');
  if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) {
    const s = readFileSync(src, 'utf8'), t = s.replace("let FORMAT = 'standard';", "let FORMAT = 'eternal';");
    if (t === s) throw new Error('default-format line not found in index.html');
    mkdirSync(join(ROOT, 'build'), { recursive: true });
    const tmp = dst + '.' + process.pid; writeFileSync(tmp, t); renameSync(tmp, dst);      // atomic: parallel test files share the copy
  }
  return pathToFileURL(dst).href;
}
export const GAME_URL = eternalCopy();
/** bash for the .sh-tool tests: CI and the cloud sessions have `bash` on PATH; a bare Windows checkout has only Git for
    Windows' bash one level up in the toolchain dir (repo AGENTS.md). Set BASH_BIN to override. */
export const BASH = process.env.BASH_BIN || (existsSync(join(ROOT, '../tools/git/bin/bash.exe')) ? join(ROOT, '../tools/git/bin/bash.exe') : 'bash');
export const WHITE = { 'BS74-CX03': 3, 'BS74-072': 3, 'BS74-038': 3, 'BS74-040': 2, 'BS74-041': 3, 'BS74-042': 3, 'BS74-043': 2, 'BS74-045': 2, 'BS74-047': 2, 'BS74-048': 2, 'BS74-049': 2, 'BS74-050': 2, 'BS75-028': 3, 'BS75-030': 2, 'BS75-035': 3, 'BS75-037': 1, 'BS75-041': 1, 'BS75-X08': 1 };

let browser = null;
export async function getBrowser() {
  if (!browser) { const { chromium } = await loadPlaywright(); browser = await chromium.launch(); }
  return browser;
}
export async function closeBrowser() { shared = null; if (browser) { await browser.close(); browser = null; } }

/** Opens the game. query: '' (normal) or '?sim=1' (CPU plays both sides). Returns { page, errors }. */
export async function openGame(query = '', product = false) {
  const b = await getBrowser(), page = await b.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message().slice(0, 100)); d.dismiss(); });
  await page.goto((product ? PRODUCT_URL : GAME_URL) + query);
  await page.waitForFunction(() => !!window.BS);
  return { page, errors };
}

/** One page per test file instead of one per test (a page load is ~1.2 s): the first call opens it, every call resets it with
 *  BS.testSetup(). Use for tests that only need a fresh quiet board; a test that changes page-level state (settings, view, fixtures it
 *  must not leak) takes quietBoard(). Same return shape as quietBoard(). */
let shared = null;
export async function sharedBoard(product = false) {
  if (!shared) shared = await openGame('', product);
  await shared.page.evaluate(() => { BS.testSetup(); return 1; });
  return shared;
}

/** A quiet board (no match loop): BS.testSetup(). */
export async function quietBoard(product = false) {
  const g = await openGame('', product);
  await g.page.evaluate(() => { BS.testSetup(); return 1; });
  return g;
}

/** Plays one CPU-vs-CPU match with a fixed seed. mode: 'white' (Red prebuilt vs white Mitra) or 'mirror' (Red vs Red).
 *  profiles: optional CPU weight profile per side, e.g. {player:'aggressive', opponent:'defensive'}.
 *  Checks BS.checkInvariants() every pollMs. Returns a plain summary. */
export async function simMatch(seed, { mode = 'white', timeoutMs = 60000, pollMs = 40, keepPage = false, profiles = null, fuzz = null } = {}) {
  const { page, errors } = await openGame('?sim=1');
  try {
    await page.evaluate(({ mode, white }) => {
      const red = BS.PREBUILT.find(x => x.id === 'red').cards, blue = BS.PREBUILT.find(x => x.id === 'blue').cards, green = BS.PREBUILT.find(x => x.id === 'green').cards, purple = BS.PREBUILT.find(x => x.id === 'purple').cards, yellow = BS.PREBUILT.find(x => x.id === 'yellow').cards, D = BS.PRESET_DECK;
      for (const k of Object.keys(D)) delete D[k];
      Object.assign(D, mode.startsWith('yellow') ? yellow : mode.startsWith('purple') ? purple : mode.startsWith('green') ? green : mode.startsWith('blue') ? blue : red);          // v0.37: 'blue' = blue vs red, 'bluewhite' = blue vs white, 'bluemirror' = blue vs blue; v0.38: 'green' = green vs red, 'greenwhite', 'greenblue', 'greenmirror'; v0.39: 'purple' = purple vs red, 'purplewhite', 'purplegreen', 'purplemirror'; v0.40: 'yellow' = yellow vs red, 'yellowwhite', 'yellowgreen', 'yellowpurple', 'yellowmirror'
      BS.setSimDeckB(mode === 'yellowmirror' ? yellow : mode === 'yellowpurple' ? purple : mode === 'yellowgreen' ? green : mode === 'yellow' ? red : mode === 'mirror' ? red : mode === 'bluemirror' ? blue : mode === 'greenmirror' ? green : mode === 'greenblue' ? blue : mode === 'purplemirror' ? purple : mode === 'purplegreen' ? green : (mode === 'blue' || mode === 'green' || mode === 'purple') ? red : white);
      return 1;
    }, { mode, white: WHITE });
    if (profiles) await page.evaluate(o => { BS.setSimProfiles(o); return 1; }, profiles);
    if (fuzz) await page.evaluate(o => { BS.setFuzz(o); return 1; }, fuzz);       // v0.59.6 match fuzzer: random legal CPU choices
    await page.evaluate(s => { BS.startNewGame({ seed: s }); return 1; }, seed);
    const inv = [], t0 = Date.now(); let over = false;
    while (Date.now() - t0 < timeoutMs) {
      await new Promise(r => setTimeout(r, pollMs));
      const st = await page.evaluate(() => { let e = null; try { BS.checkInvariants(); } catch (x) { e = x.message; } return { over: !!(BS.G && BS.G.over), e }; });
      if (st.e && inv.length < 3) inv.push(st.e);
      if (st.over) { over = true; break; }
    }
    const s = await page.evaluate(() => {
      const G = BS.G, f = (G.rec && G.rec.final) || {};
      return { turn: G.turnNo, winner: G.winner, hist: G.history.length, hash: f.hash || null, log: f.log || null, seed: G.rec && G.rec.seed,
        replay: BS.lastReplay(), port: BS.portRecord(), firstPlayer: (G.history.find(x => / goes first\.$/.test(x)) || '').replace(' goes first.', ''), lives: [G.p.player.life, G.p.opponent.life], decks: [G.p.player.deck.length, G.p.opponent.deck.length] };
    });
    const out = { seed, mode, over, inv, errors: errors.slice(0, 3), ...s };
    if (keepPage) out.page = page; else await page.close();
    return out;
  } catch (e) {
    await page.close();
    throw e;
  }
}
