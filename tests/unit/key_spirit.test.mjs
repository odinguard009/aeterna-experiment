// v0.103.0: Key Spirit (Aeterna house rule, roadmap U/I queue): one Spirit card per deck marked in the deck builder; while no copy
// of it is in the Hand or on the Field, draws from the Deck favour its copies (KEY_WEIGHT = 2 per copy vs 1). Covered here by unit
// tests + a full headless replay; NOT by a scenario JSON (documented decision: the scenario format models card boards, not deck
// sequences / draw steps — tests/scenarios/* has no deck or draw-step knob).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { playHeadless, replayPort } from '../../packages/engine/headless.mjs';
import { quietBoard, closeBrowser } from './lib/game.mjs';

let page, errors;
const ev = (fn, arg) => page.evaluate(fn, arg);
before(async () => { ({ page, errors } = await quietBoard(true)); });
after(async () => { await closeBrowser(); });

/* The page bodies are built with new Function so the seeded-rng mirror and the deck fixture ship verbatim to the page.
   RNG_JS mirrors 00-config.js line for line: the tests measure exactly how many rng() calls a draw reads.
   SETUP_JS must run testSetup() BEFORE grabbing the player object (testSetup rebuilds G). */
const RNG_JS = "const mk = s => { let st = (s >>> 0) || 1; return () => { let t = st = (st + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };";
const SETUP_JS = "BS.testSetup(); const p = BS.G.p.player; p.key = 'player'; p.spirits = []; p.nexus = []; const K = 'BS75-001', OTHER = 'BS75-002'; const mkDeck = ids => { p.deck = ids.map(id => BS.mkInst(id)); p.hand = []; p.spirits = []; p.nexus = []; }; const keyedDeck = () => mkDeck(Array(3).fill(K).concat(Array(37).fill(OTHER)));";

test('KEY-1 validateDeck on the marked Key Spirit (optional 3rd argument)', async () => {
  const r = await ev(() => {
    const K = 'BS75-001', kn = BS.CARDS[K].name, names = [kn], ids = [];
    for (const [id, c] of Object.entries(BS.CARDS)) {                       // 13 distinct-name, eternal-legal Spirits for a 40-card fixture
      if (ids.length >= 13) break;
      if (c.type !== 'Spirit' || names.includes(c.name) || BS.legalityOf(id, 'eternal')) continue;
      names.push(c.name); ids.push(id);
    }
    if (ids.length < 13) return { short: ids.length };
    const deck = { [K]: 3 }, absent = {};
    ids.forEach((id, i) => { deck[id] = i < 12 ? 3 : 1; absent[id] = i < 12 ? 3 : 4; });
    let magic = null; for (const [id, c] of Object.entries(BS.CARDS)) if (c.type === 'Magic') { magic = id; break; }
    return {
      okTwoArgs: BS.validateDeck(deck, 'eternal').ok,
      okGoodKey: BS.validateDeck(deck, 'eternal', K).ok,
      absent: BS.validateDeck(absent, 'eternal', K).errors,
      magic: magic ? BS.validateDeck({ [magic]: 3 }, 'eternal', magic).errors : ['no magic card in the pack'],
      unknown: BS.validateDeck(deck, 'eternal', 'BS99-001').errors,
      token: BS.validateDeck({ '26RSD10-T001': 3 }, 'eternal', '26RSD10-T001').errors
    };
  });
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.equal(r.okTwoArgs, true, 'the existing 2-argument calls still validate');
  assert.equal(r.okGoodKey, true, 'a Spirit with copies is a valid Key Spirit');
  assert.ok(r.absent.some(t => /must be in the Deck/.test(t)), 'a key with zero copies in the deck is reported');
  assert.ok(r.magic.some(t => /Spirit card is required/.test(t)), 'a Magic cannot be a Key Spirit');
  assert.ok(r.unknown.some(t => /unknown card/.test(t)), 'an unknown key id is reported');
  assert.ok(r.token.some(t => /must be in the Deck|Spirit card is required|unknown card/.test(t)), 'a Token id is refused as a key');
});

test('KEY-2 every prebuilt deck names its own valid Key Spirit; pickKey is deterministic (most copies, then the smallest id)', async () => {
  const r = await ev(() => {
    const rows = [];
    for (const d of BS.PREBUILT) {
      if (d.id === 'train' || !d.key) continue;
      const errs = BS.validateDeck(d.cards, d.format || 'eternal', d.key).errors.filter(t => /Key Spirit/.test(t));
      rows.push([d.id, d.key, d.cards[d.key] > 0, errs.length, BS.pickKey(d.cards), d.kind || '']);
    }
    let magic = null; for (const [id, c] of Object.entries(BS.CARDS)) if (c.type === 'Magic') { magic = id; break; }
    return { rows, empty: BS.pickKey({}), copyWins: BS.pickKey({ 'BS75-002': 3, 'BS75-001': 2 }), idWins: BS.pickKey({ 'BS75-002': 3, 'BS75-001': 3 }), twoTie: BS.pickKey({ 'BS75-003': 2, 'BS75-002': 2 }), noSpirit: BS.pickKey({ [magic]: 3 }) };
  });
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.equal(r.rows.length, 42, 'std01-std10, the six internal colour fixtures and the 26 official ready decks carry keys');
  for (const [id, key, copied, errs, picked, kind] of r.rows) {
    assert.ok(copied, id + ': key ' + key + ' has at least one copy in the deck');
    assert.equal(errs, 0, id + ': key validation errors');
    if (kind !== 'ready') assert.equal(picked, key, id + ': the data key must equal the deterministic pickKey result');   // a ready deck names the official deck-feature key card instead
  }
  assert.equal(r.empty, null, 'pickKey on an empty deck is null');
  assert.equal(r.copyWins, 'BS75-002', 'more copies win over the smaller id');
  assert.equal(r.idWins, 'BS75-001', 'a tie is broken by the smaller id');
  assert.equal(r.twoTie, 'BS75-002', 'tie break again: smallest id');
  assert.equal(r.noSpirit, null, 'a deck with no Spirits has no pickable key');
});

test('KEY-3 no Key Spirit: draws stay in natural order and read the seeded RNG zero times', async () => {
  const r = await ev(new Function('seed', RNG_JS + SETUP_JS + `
    BS.seedRng(seed);
    mkDeck(['BS75-001', 'BS75-002', 'BS75-003', 'BS75-004', 'BS75-006', 'BS75-007']);
    const drew = [];
    for (let i = 0; i < 3; i++) { BS.draw(p, 1); drew.push(p.hand[p.hand.length - 1].id); }
    return { drew, next: BS.rng(), first: mk(seed)() };
  `), 4242);
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.deepEqual(r.drew, ['BS75-001', 'BS75-002', 'BS75-003'], 'unweighted draws take the deck front in order');
  assert.equal(r.next, r.first, 'three unweighted draws consumed zero rng() calls (the next value is the first of a fresh copy)');
});

test('KEY-4 weighted draws: deterministic per seed, inactive while a copy sits in the Hand or on the Field, active again after', async () => {
  const r = await ev(new Function(RNG_JS + SETUP_JS + `
    const seq = n => { const a = []; for (let i = 0; i < n; i++) { BS.draw(p, 1); a.push(p.hand[p.hand.length - 1].id); } return a; };
    // deterministic per seed
    BS.seedRng(9001); keyedDeck(); p.keySpirit = K; const h1 = seq(6);
    BS.seedRng(9001); keyedDeck(); p.keySpirit = K; const h2 = seq(6);
    // a seed where the weighted deck really deviates from the natural one (scanned deterministically)
    let s0 = null, nat0 = null, w0 = null;
    for (let s = 1; s <= 300 && s0 === null; s++) {
      BS.seedRng(s); keyedDeck(); p.keySpirit = null; const n = seq(3);
      BS.seedRng(s); keyedDeck(); p.keySpirit = K; const w = seq(3);
      if (n.join() !== w.join()) { s0 = s; nat0 = n; w0 = w; }
    }
    // while no copy is in the Hand: natural order + zero rng
    BS.seedRng(s0); keyedDeck(); p.keySpirit = K; p.hand = [BS.mkInst(K)];
    const rst = seq(3); const rstNext = BS.rng(), rstFirst = mk(s0)();
    // while no copy is on the Field: the same reset through the field check
    BS.seedRng(s0); keyedDeck(); p.keySpirit = K; p.spirits = [BS.mkInst(K)];
    const fld = seq(3); const fldNext = BS.rng(), fldFirst = mk(s0)();
    // reactivation: draw #1 weighted (copy into the Hand), the copy leaves, draw #2 is weighted again (same live deck state)
    const reactive = c => { BS.seedRng(c); keyedDeck(); p.keySpirit = K; BS.draw(p, 1); p.hand.splice(0, 1); const n2 = p.deck[0].id; const a2 = (BS.draw(p, 1), p.hand[p.hand.length - 1].id); return a2 !== n2; };
    let sr = null; for (let s = 1; s <= 300; s++) if (reactive(s)) { sr = s; break; }
    return { h1, h2, s0, nat0, w0, rst, rstSame: rstNext === rstFirst, fld, fldSame: fldNext === fldFirst, sr };
  `));
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.deepEqual(r.h1, r.h2, 'the same seed draws the same sequence');
  assert.ok(r.s0, 'the weighted rule deviates from the natural order (found seed ' + r.s0 + ')');
  assert.notDeepEqual(r.w0, r.nat0, 'the first draws differ between the weighted and the natural deck at that seed');
  assert.deepEqual(r.rst, ['BS75-001', 'BS75-001', 'BS75-001'], 'Hand reset: the keyed deck front (3 copies) is drawn unchanged');
  assert.ok(r.rstSame, 'Hand reset: zero rng calls during the reset draws');
  assert.deepEqual(r.fld, ['BS75-001', 'BS75-001', 'BS75-001'], 'Field reset: the keyed deck front (3 copies) is drawn unchanged');
  assert.ok(r.fldSame, 'Field reset: zero rng calls during the reset draws');
  assert.ok(r.sr, 'after the copy leaves the Hand the weighted rule applies again (seed ' + r.sr + ')');
});

test('KEY-5 the favour is measurable but modest (2x per copy vs 1: ~13.9% first draw vs ~7.5% natural)', async () => {
  const r = await ev(new Function(RNG_JS + SETUP_JS + `
    const otherFirstDeck = () => mkDeck([OTHER].concat(Array(3).fill(K)).concat(Array(36).fill(OTHER)));
    let picks = 0, nat = 0;
    for (let s = 1; s <= 100; s++) {
      BS.seedRng(s); otherFirstDeck(); p.keySpirit = K; BS.draw(p, 1); if (p.hand[0].id === K) picks++;
      BS.seedRng(s); otherFirstDeck(); p.keySpirit = null; BS.draw(p, 1); if (p.hand[0].id === K) nat++;
    }
    return { picks, nat };
  `));
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.ok(r.picks >= 8 && r.picks <= 20, 'weighted first-draw rate ~14% (got ' + r.picks + '%)');
  assert.equal(r.nat, 0, 'an unweighted draw takes the other-front deck\'s first card, never the buried key');
});

test('KEY-6 the port record carries both keys (keyW) and a full match replays identically with them', async () => {
  const a = await playHeadless({ seed: 91, deckA: 'std01', deckB: 'std02', format: 'standard', keyA: '26RSD01-001', keyB: '26RSD02-001' });
  assert.ok(a.over, 'the keyed match finishes: ' + JSON.stringify(a.errors));
  assert.equal(a.port.keyA, '26RSD01-001', 'seat A key from the prebuilt id');
  assert.equal(a.port.keyB, '26RSD02-001', 'seat B key from the prebuilt id');
  assert.equal(a.port.keyW, 2, 'the weight rides in the record');
  const rep = await replayPort(a.port, { timeoutMs: 60000 });
  assert.equal(rep.ok, true, rep.reason);
  assert.equal(rep.same, true, 'the recorded match replays to the same hash with its keys');
  const nk = await playHeadless({ seed: 91, deckA: 'std01', deckB: 'std02', format: 'standard', keyA: '', keyB: '' });   // '' forces no key
  assert.ok(nk.over, 'the keyless variant finishes: ' + JSON.stringify(nk.errors));
  assert.equal(nk.port.keyA, null, 'no key when forced off');
  assert.equal(nk.port.keyB, null, 'no key when forced off');
  const rep2 = await replayPort(nk.port, { timeoutMs: 60000 });
  assert.equal(rep2.ok, true, rep2.reason);
  assert.equal(rep2.same, true, 'the keyless match replays identically too');
});

test('KEY-7 deck code round trip with the KEY marker line (old codes unchanged)', async () => {
  const r = await ev(() => {
    const d = { '26RSD01-001': 3, '26RSD01-002': 3 }, K = '26RSD01-001';
    const txt = BS.deckToText(d, K);
    const back = BS.textToDeck(txt);
    const legacy = BS.textToDeck('3 26RSD01-001\n3 26RSD01-002   # plain line');
    const two = BS.textToDeck(`3 26RSD01-001\nKEY ${K}\nKEY 26RSD01-002`);
    const unknown = BS.textToDeck('3 26RSD01-001\nKEY BS99-XXX');
    const plain = BS.deckToText(d);
    return { last: txt.split('\n').pop(), nBack: back.deck['26RSD01-001'], kBack: back.key, legacyKey: legacy.key, legacyBad: legacy.bad.length, twoBad: two.bad.some(b => /one KEY line/.test(b)), twoKey: two.key, unknownBad: unknown.bad.some(b => /KEY "BS99-XXX" not found/.test(b)), plainOk: !/KEY/.test(plain) };
  });
  assert.ok(/KEY 26RSD01-001/.test(r.last), 'the export ends with the KEY line: ' + r.last);
  assert.equal(r.nBack, 3, 'the marked deck round-trips');
  assert.equal(r.kBack, '26RSD01-001', 'the marker comes back as the key');
  assert.equal(r.legacyKey, null, 'a code without a KEY line imports without a key');
  assert.equal(r.legacyBad, 0, 'old deck codes stay valid');
  assert.ok(r.twoBad, 'a second KEY line is an error');
  assert.equal(r.twoKey, '26RSD01-001', 'the first KEY line still applies');
  assert.ok(r.unknownBad, 'an unknown KEY card is an error');
  assert.ok(r.plainOk, 'an unmarked deck exports without a KEY line');
});

test('KEY-8 deck builder: the KEY button toggles the mark, the last copy leaving clears it, import/export ride the marker', async () => {
  const r = await ev(async () => {
    BS.loadPrebuilt('std01');
    BS.switchView('view-deckbuilder'); BS.renderDeckBuilder();
    const onId = '26RSD01-001';
    const btn = () => document.querySelector(`#db-dk-list .st[data-v="${onId}"]`);
    const wasOn = btn().classList.contains('on'), pressed = btn().getAttribute('aria-pressed');
    btn().click();
    const off = !BS.SLOTS()[BS.ACTIVE_SLOT].key, offOn = !btn().classList.contains('on'), offPressed = btn().getAttribute('aria-pressed') === 'false';
    const ids = [...document.querySelectorAll('#db-dk-list .st')].map(x => x.dataset.v).filter(id => id !== onId);
    document.querySelector(`#db-dk-list .st[data-v="${ids[0]}"]`).click();
    const setKey = BS.SLOTS()[BS.ACTIVE_SLOT].key, setOn = document.querySelector(`#db-dk-list .st[data-v="${ids[0]}"]`).classList.contains('on');
    while ((BS.PLAYER_DECK[setKey] || 0) > 0) BS.dbChange(setKey, -1);
    const cleared = !BS.SLOTS()[BS.ACTIVE_SLOT].key;
    document.querySelector('[data-a="db-import"]').click(); await new Promise(x => setTimeout(x, 20));
    const ta = document.getElementById('db-io'); ta.value = `3 ${onId}\n3 26RSD01-002\nKEY ${onId}`; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#action-modal [data-mi="0"]').click(); await new Promise(x => setTimeout(x, 30));
    const impKey = BS.SLOTS()[BS.ACTIVE_SLOT].key;
    document.querySelector('[data-a="db-export"]').click(); await new Promise(x => setTimeout(x, 20));
    const out = document.getElementById('db-io').value; BS.closeModal();
    return { wasOn, pressed, off, offOn, offPressed, ids, setKey, setOn, cleared, impKey, outHas: /KEY 26RSD01-001/.test(out) };
  });
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.ok(r.wasOn && r.pressed === 'true', 'the starter arrives with its Key marked and aria-pressed');
  assert.ok(r.off && r.offOn && r.offPressed, 'pressing again unmarks the Key Spirit (button state follows)');
  assert.ok(r.ids.length > 3, 'Spirit rows carry the KEY button; non-Spirits do not');
  assert.ok(r.setKey && r.setKey !== '26RSD01-001' && r.setKey === r.ids[0] && r.setOn, 'marking another Spirit works');
  assert.ok(r.cleared, 'removing the last copy clears the mark');
  assert.equal(r.impKey, '26RSD01-001', 'the KEY line of an imported code marks the Key Spirit');
  assert.ok(r.outHas, 'exporting a marked deck shows the KEY line');
});

test('KEY-9 My decks: tiles show the KEY badge, Copy and Duplicate bring it along', async () => {
  const r = await ev(async () => {
    BS.switchView('view-decks'); BS.renderDecks();
    const mineKey = !!document.querySelector('#dk-list .dtile[data-v] .tag.dim');
    const startKeys = document.querySelectorAll('#dk-starters .dk-st-row .tag.dim').length;
    const startBtn = document.querySelector('#dk-starters .dk-st-row [data-a="dk-copy"]');
    const startId = startBtn ? Number(startBtn.getAttribute('data-v')) : -1;
    startBtn.click(); await new Promise(x => setTimeout(x, 10));
    const starterKey = (BS.PREBUILT[startId] || {}).key || null;
    const copied = BS.SLOTS().findIndex((s, i) => s.key === starterKey && s.key);
    BS.renderDecks();
    const copyTile = [...document.querySelectorAll('#dk-list .dtile[data-v]')].find(t => t.querySelector('.tag.dim') && t.getAttribute('data-v') == String(copied));
    const copyBadge = !!copyTile;
    const more = document.querySelector(`#dk-list [data-a="dk-more"][data-v="${copied}"]`);
    more.click(); await new Promise(x => setTimeout(x, 10));
    document.querySelector('#dk-list [data-a="dk-dup"]').click(); await new Promise(x => setTimeout(x, 10));
    const withKey = BS.SLOTS().filter(s => s.key === starterKey).length;
    return { mineKey, startKeys, starterKey, copied, copyBadge, withKey };
  });
  assert.ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  assert.ok(r.mineKey, 'the active deck tile shows the KEY badge');
  assert.ok(r.startKeys >= 10, 'the starter tiles show their Key Spirit badges');
  assert.ok(r.copied >= 0 && r.copyBadge, 'COPY of a starter keeps its Key (tile ' + r.copied + ', key ' + r.starterKey + ')');
  assert.ok(r.starterKey ? r.withKey >= 2 : r.withKey >= 1, 'Duplicate carried the Key Spirit: ' + r.withKey + ' slot(s) now carry ' + r.starterKey);
});
