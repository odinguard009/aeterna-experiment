#!/usr/bin/env node
// v0.52.0: promotes the output of tools/compile_effects.py after two checks in the real game page:
//   1) the game's parseCard accepts the card (same check as tools/check_staged.mjs);
//   2) smoke check: on a quiet board the card is played (CPU Main Step, else a free summon / cast), its SUMMONED,
//      START_ATTACK, ATTACKS and BLOCKS effects fire, a Spirit attacks once; no page/console error, no invariant break.
// Cards that fail stay staged and are listed. Passing cards go to data/cards via tools/build_cards.py --update.
//   node tools/promote_compiled.mjs build/compiled.json          -> check + promote
//   node tools/promote_compiled.mjs build/compiled.json --dry    -> check only
//   add --v2 when the file comes from tools/compile_v2.py (v0.61.0; the note names it); v0.79.0: --partial output
//   (fxComplete false + residual) is promoted the same way, with a note naming the residual
// Then: python3 tools/tag_effects.py && python3 tools/residual_tags.py && npm run -s loop
// Semantic fidelity (the compiler is a measurement tool, never the source of correctness): before a batch is final,
// run `python3 tools/card_verify.py <id>` for each newly promoted `fxComplete: true` card and confirm every printed
// clause maps to an action or is named in `residual`; a clause that is neither is a false complete.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, closeBrowser } from '../tests/unit/lib/game.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOTE = 'Stats and text from the owner-supplied Fandom export (owner decision 2026-10-14); effects compiled by tools/compile_effects.py (v0.52.0) and smoke-checked; not yet checked against the card image.';

export async function smoke(cards) {
  const { page, errors } = await openGame('');
  try {
    const parsed = await page.evaluate(cs => cs.map(c => { const r = BS.parseCard(c); return r.card ? null : r.errors.join('; '); }), cards);
    const ok = cards.filter((c, i) => !parsed[i]), res = cards.map((c, i) => ({ id: c.id, err: parsed[i] ? 'parseCard: ' + parsed[i] : null }));
    for (let i = 0; i < ok.length; i += 2500) await page.evaluate(cs => BS.importCards(JSON.stringify(cs)), ok.slice(i, i + 2500));      // v0.79.0: importCards takes at most 3000 cards per call
    const filler = await page.evaluate(() => { const d = BS.PREBUILT.find(x => x.id !== 'train'); return Object.keys(d.cards).filter(x => BS.CARDS[x] && BS.CARDS[x].type === 'Spirit' && !BS.CARDS[x].effects).slice(0, 2); });
    for (const r of res) {
      if (r.err) continue;
      const before = errors.length;
      const out = await page.evaluate(async ([id, fill]) => {
        const t = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
        BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key;
        for (const q of [P, O]) { q.cpu = true; q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 6; q.revealed = []; q.trash = []; q.hand = []; q.deck = []; q.removed = []; q.reserve.n = 20; q.reserve.soul = true; q.tokens = {}; q.onceUsed = {}; q.life = 5; }
        const mk = (x, q, zone, n = 0) => { const i = BS.mkInst(x); i.cores = n; q[zone].push(i); return i; };
        for (const x of fill) { mk(x, O, 'spirits', 1); mk(x, P, 'spirits', 1); }
        for (let k = 0; k < 6; k++) for (const x of fill) { mk(x, P, 'deck'); mk(x, O, 'deck'); }
        const c = BS.CARDS[id], inst = mk(id, P, 'hand');
        for (const q of [P, O]) { q.void = 0; q.deckSize = q.deck.length + q.hand.length + q.spirits.length + q.nexus.length; q.made = q.life + q.reserve.n + q.trashCores.n + q.count + q.void + BS.fieldList(q).reduce((s, i) => s + i.cores, 0); }
        let how = 'cpu';
        try {
          await t(BS.cpuMain(P), 8000);
          if (P.hand.includes(inst)) {
            how = 'forced';
            if (c.type === 'Magic') { if (!BS.magicUsable || BS.magicUsable(P, inst)) await t(BS.castMagic(P, { inst }), 8000); else how = 'magic-not-usable'; }
            else await t(BS.summonFree(P, inst), 8000);
          }
          const on = BS.fieldList(P).find(f => f.uid === inst.uid);
          if (on) {
            { const k = Math.max(0, Math.min(P.reserve.n, ((c.levels || []).at(-1)?.cores || 0) - on.cores)); on.cores += k; P.reserve.n -= k; }
            for (const trg of ['SUMMONED', 'START_ATTACK', 'ATTACKS', 'BLOCKS']) await t(BS.fireFx(P, trg, on, { attacker: on }), 8000);
            if (c.type !== 'Nexus' && !G.over) await t(BS.doBattle(P.key, on), 8000);
          }
          let inv = null; try { inv = BS.checkInvariants(); } catch (e) { inv = String(e.message || e); }
          const played = !P.hand.includes(inst);
          return { how, err: !played && how !== 'magic-not-usable' ? 'not played' : (inv && (Array.isArray(inv) ? inv.length : true) ? 'invariant: ' + JSON.stringify(inv).slice(0, 160) : null) };
        } catch (e) { return { how, err: String(e.message || e).slice(0, 160) }; }
      }, [r.id, filler]);
      const errs = errors.slice(before);
      r.how = out.how; r.err = out.err || (errs.length ? errs.join(' | ').slice(0, 200) : null);
    }
    return res;
  } finally { await closeBrowser(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2]; if (!file) { console.error('usage: node tools/promote_compiled.mjs FILE [--dry]'); process.exit(2); }
  const cards = JSON.parse(readFileSync(file, 'utf8'));
  const res = await smoke(cards), bad = res.filter(r => r.err);
  const hows = res.reduce((m, r) => (m[r.how || 'parse'] = (m[r.how || 'parse'] || 0) + 1, m), {});
  console.log(`smoke: ${res.length - bad.length} ok, ${bad.length} failed (${Object.entries(hows).map(([k, v]) => k + ' ' + v).join(', ')})`);
  for (const r of bad.slice(0, 40)) console.log(`  BAD ${r.id} ${r.how || ''} ${r.err}`);
  if (process.argv.includes('--dry')) process.exit(bad.length ? 1 : 0);
  const keep = new Set(res.filter(r => !r.err).map(r => r.id));
  const note = process.argv.includes('--v2') ? NOTE.replace('(v0.52.0)', '(v0.52.0) with the v2 clause grammar of tools/compile_v2.py (v0.61.0)') : NOTE;      // v0.61.0
  const PART = ' Partial card (v0.79.0, roadmap item A1): the printed paragraphs in "residual" do not run yet; the card shows a "!" mark in the Library and the deck builder.';
  const out = cards.filter(c => keep.has(c.id)).map(c => Object.assign({}, c, { note: (c.residual || []).length ? note + PART : note }));      // v0.79.0: partial cards from compile_v2.py --partial
  const tmp = join(ROOT, 'build_promote.tmp.json'); writeFileSync(tmp, JSON.stringify(out));
  try { execFileSync('python3', [join(ROOT, 'tools/build_cards.py'), '--update', tmp], { stdio: 'inherit' }); } finally { unlinkSync(tmp); }
  console.log(`promoted ${out.length}`);
}
