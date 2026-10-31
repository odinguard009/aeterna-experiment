/* ---------------------------------------------------------------------
   DECK STORAGE AND VALIDATION  (manual: 40 or more cards, max 3 per name,
   only one type of Contract card)
   --------------------------------------------------------------------- */
const deckTotal = d => Object.values(d).reduce((s, n) => s + n, 0);
function cleanDeck(o) {
  const out = {};
  for (const [id, n] of Object.entries(o || {})) { const k = Math.min(3, Math.floor(Number(n))); if (CARDS[id] && !CARDS[id].token && k >= 1) out[id] = k; }
  return out;
}
function validateDeck(d, format, key) {
  format = format || FORMAT;
  const total = deckTotal(d), errors = [];
  if (total < 40) errors.push(`Needs at least 40 cards (has ${total}).`);
  if (Object.keys(d).filter(id => CARDS[id] && CARDS[id].contract).length > 1) errors.push('Only one type of Contract card is allowed.');
  if (Object.keys(d).some(id => CARDS[id] && CARDS[id].token && d[id] > 0)) errors.push('Token cards cannot be put into a Deck.');
  if (key != null) {                     // Key Spirit (Aeterna house rule, v0.103.0): optional 3rd argument; the marked key must be a Spirit with at least one copy in the deck
    const kc = CARDS[key];
    if (!kc) errors.push(`Key Spirit: unknown card (${key}).`);
    else if (kc.type !== 'Spirit' || kc.token) errors.push(`${kc.name} (${key}) cannot be the Key Spirit: a Spirit card is required.`);
    else if (!(d[key] > 0)) errors.push(`${kc.name} (${key}) must be in the Deck to mark it as the Key Spirit.`);
  }
  const byName = {};
  for (const [id, n] of Object.entries(d)) {
    if (!CARDS[id] || !n) continue;
    const c = CARDS[id], bad = legalityOf(id, format);
    byName[c.name] = (byName[c.name] || 0) + n;
    if (bad) errors.push(`${c.name} (${id}): ${bad}.`);
    else if (banStatus(id, format) === 'limit1' && n > 1) errors.push(`${c.name} (${id}): limited to 1 copy.`);
  }
  for (const [nm, n] of Object.entries(byName)) if (n > 3) errors.push(`${nm}: max 3 copies with the same name (has ${n}).`);
  return { total, errors, ok: errors.length === 0, format };
}
/* Key Spirit (Aeterna house rule, v0.103.0): a marked key resolves only while it is a Spirit with at least one copy in the deck;
   decks without one draw exactly as before. pickKey is the CPU's deterministic pick (most copies, then the smallest id) for a
   player-built deck it uses without a marked key. */
const keyOfDeck = (d, key) => key != null && CARDS[key] && CARDS[key].type === 'Spirit' && !CARDS[key].token && (d && d[key]) > 0 ? key : null;
const pickKey = d => {
  let best = null, bn = 0;
  for (const [id, n] of Object.entries(d || {})) if (n > 0 && CARDS[id] && CARDS[id].type === 'Spirit' && !CARDS[id].token && (n > bn || (n === bn && id < best))) { best = id; bn = n; }
  return best;
};
const fmtName = f => (f === 'standard' ? 'STANDARD' : 'ETERNAL');
const fmtButton = f => (f === 'standard' ? 'STANDARD' : 'ETERNAL (PREVIEW)');      // button text: Eternal is a preview while most Eternal cards are partial (owner, 2026-10-21)
function setFormat(f) {
  FORMAT = f === 'standard' ? 'standard' : 'eternal';
  try { localStorage.setItem(FORMAT_KEY, FORMAT); } catch (e) { /* blocked */ }
  io.view({ type: 'decks' });
}
const errSummary = v => v.errors.slice(0, 3).join(' ') + (v.errors.length > 3 ? ` (+${v.errors.length - 3} more)` : '');
/* Ready-made decks (owner 2026-10-31: only starter decks and official ready decks, no hand-made recipes). Two listed kinds:
   - 'starter': the ten official Standard starters (Entry / Starter / Anime Starter Decks 26RSD01-10); recipes data/decks/standard-26rsd*.txt
   - 'ready':   the official deck-feature recipes of the Standard sets (battlespirits.com "Deck Feature", feature/structure/<set>/deck_0N.php);
                every recipe keeps its source URL, shown on the Recipe page; recipes data/decks/ready-*.txt
   The full official recipe is kept in `recipe`; `cards` holds only the cards that are playable in the library (so a deck fills in as
   card sessions add cards) and `missing` counts the rest.
   'fixture' decks (hidden) are internal only: the six hand-made colour / Contract decks are not listed anywhere in the UI (deck builder
   preset, My decks, CPU picker, New deck chooser, Recipe page) but the engine unit tests and the CPU sims pin their ids and cards; they
   stay in the engine as fixtures (same rule as Training Red, v0.162.0) until a dedicated test refactor can remove them. */
const prebuiltDeck = (kind, id, name, recipe, key, source) => ({
  id, name, kind, format: kind === 'fixture' ? undefined : 'standard', key: key || null, recipe, source: source || null,
  ...(kind === 'fixture' ? { hidden: true } : {}),
  get cards() { const o = {}; for (const [k, n] of Object.entries(recipe)) if (CARDS[k]) o[k] = n; return o; },
  get missing() { let m = 0; for (const [k, n] of Object.entries(recipe)) if (!CARDS[k]) m += n; return m; },
});
const stdDeck = (id, name, recipe, key) => prebuiltDeck('starter', id, name, recipe, key);
const readyDeck = (id, name, recipe, key, source) => prebuiltDeck('ready', id, name, recipe, key, source);
const prebuiltFmt = d => d.format || 'eternal';
const prebuiltOrder = format => PREBUILT.map((d, i) => ({ d, i })).filter(e => !e.d.hidden).sort((a, b) => +(prebuiltFmt(b.d) === format) - +(prebuiltFmt(a.d) === format) || a.i - b.i);      // decks of the chosen format first, index kept for COPY
const prebuiltLabel = d => d.name + (d.missing ? ` (incomplete, ${d.missing} missing)` : '');
const PREBUILT = [
  { id: 'train', hidden: true, name: 'Training Red (generic vanilla cards)', cards: PRESET_DECK },      // v0.162.0: internal sim fixture, no longer listed anywhere in the UI (still loadable by id for tests)
  stdDeck('std01', 'Red: Windfang (Entry Deck 26RSD01)', { '26RSD01-001': 3, '26RSD01-002': 3, '26RSD01-003': 2, '26RSD01-004': 3, '26RSD01-005': 3, '26RSD01-006': 2, '26RSD01-007': 2, '26RSD01-008': 2, '26RSD01-009': 2, '26RSD01-010': 3, '26RSD01-011': 3, '26RSD01-012': 3, '26RSD01-013': 3, '26RSD01-014': 2, '26RSD01-X01': 2, '26RSD01-X02': 2 }, '26RSD01-001'),
  stdDeck('std02', 'Purple: Bloodrouse (Entry Deck 26RSD02)', { '26RSD02-001': 3, '26RSD02-002': 3, '26RSD02-003': 3, '26RSD02-004': 2, '26RSD02-005': 3, '26RSD02-006': 2, '26RSD02-007': 2, '26RSD02-008': 3, '26RSD02-009': 3, '26RSD02-010': 3, '26RSD02-011': 3, '26RSD02-012': 2, '26RSD02-013': 2, '26RSD02-014': 2, '26RSD02-X01': 2, '26RSD02-X02': 2 }, '26RSD02-001'),
  stdDeck('std03', 'Green: Armored Fish (Entry Deck 26RSD03)', { '26RSD03-001': 2, '26RSD03-002': 3, '26RSD03-003': 2, '26RSD03-004': 3, '26RSD03-005': 3, '26RSD03-006': 2, '26RSD03-007': 2, '26RSD03-008': 3, '26RSD03-009': 2, '26RSD03-010': 3, '26RSD03-011': 3, '26RSD03-012': 3, '26RSD03-013': 3, '26RSD03-014': 2, '26RSD03-X01': 2, '26RSD03-X02': 2 }, '26RSD03-002'),
  stdDeck('std04', 'White: Mineroid (Entry Deck 26RSD04)', { '26RSD04-001': 3, '26RSD04-002': 3, '26RSD04-003': 3, '26RSD04-004': 2, '26RSD04-005': 3, '26RSD04-006': 2, '26RSD04-007': 2, '26RSD04-008': 2, '26RSD04-009': 3, '26RSD04-010': 3, '26RSD04-011': 2, '26RSD04-012': 3, '26RSD04-013': 3, '26RSD04-014': 2, '26RSD04-X01': 2, '26RSD04-X02': 2 }, '26RSD04-001'),
  stdDeck('std05', 'Yellow: Thunder Dragon (Entry Deck 26RSD05)', { '26RSD05-001': 3, '26RSD05-002': 3, '26RSD05-003': 2, '26RSD05-004': 3, '26RSD05-005': 3, '26RSD05-006': 2, '26RSD05-007': 2, '26RSD05-008': 2, '26RSD05-009': 3, '26RSD05-010': 3, '26RSD05-011': 3, '26RSD05-012': 3, '26RSD05-013': 2, '26RSD05-014': 2, '26RSD05-X01': 2, '26RSD05-X02': 2 }, '26RSD05-001'),
  stdDeck('std06', 'Blue: Ferobeast (Entry Deck 26RSD06)', { '26RSD06-001': 3, '26RSD06-002': 3, '26RSD06-003': 2, '26RSD06-004': 2, '26RSD06-005': 3, '26RSD06-006': 2, '26RSD06-007': 3, '26RSD06-008': 2, '26RSD06-009': 3, '26RSD06-010': 3, '26RSD06-011': 3, '26RSD06-012': 3, '26RSD06-013': 2, '26RSD06-014': 2, '26RSD06-X01': 2, '26RSD06-X02': 2 }, '26RSD06-001'),
  stdDeck('std07', 'Purple: Kamen Rider Zeztz (Starter 26RSD07)', { '26RSD07-001': 2, '26RSD07-002': 2, '26RSD07-003': 3, '26RSD07-004': 3, '26RSD07-005': 3, '26RSD07-006': 3, '26RSD07-007': 3, '26RSD07-008': 3, '26RSD07-009': 2, '26RSD07-010': 2, '26RSD07-011': 2, '26RSD07-012': 3, '26RSD07-013': 2, '26RSD07-014': 3, '26RSD07-X01': 2, '26RSD07-X02': 2 }, '26RSD07-003'),
  stdDeck('std08', 'Yellow: Diva (Starter 26RSD08)', { '26RSD08-001': 3, '26RSD08-002': 2, '26RSD08-003': 3, '26RSD08-004': 3, '26RSD08-005': 3, '26RSD08-006': 2, '26RSD08-007': 2, '26RSD08-008': 2, '26RSD08-009': 2, '26RSD08-010': 3, '26RSD08-011': 3, '26RSD08-012': 3, '26RSD08-013': 3, '26RSD08-014': 2, '26RSD08-X01': 2, '26RSD08-X02': 2 }, '26RSD08-001'),
  stdDeck('std09', 'Red: Purgatory Phoenix (Anime Starter 26RSD09)', { '26RSD09-001': 3, '26RSD09-002': 3, '26RSD09-003': 3, '26RSD09-004': 2, '26RSD09-005': 3, '26RSD09-006': 3, '26RSD09-007': 2, '26RSD09-008': 2, '26RSD09-009': 2, '26RSD09-010': 3, '26RSD09-011': 3, '26RSD09-012': 2, '26RSD09-013': 3, '26RSD01-014': 2, '26RSD09-X01': 2, '26RSD09-X02': 2 }, '26RSD09-001'),
  stdDeck('std10', 'Green: Aberrant Whale (Anime Starter 26RSD10)', { '26RSD10-001': 3, '26RSD10-002': 3, '26RSD10-003': 2, '26RSD10-004': 3, '26RSD10-005': 3, '26RSD10-006': 3, '26RSD10-007': 2, '26RSD10-008': 2, '26RSD10-009': 2, '26RSD10-010': 3, '26RSD10-011': 3, '26RSD10-012': 2, '26RSD10-013': 3, '26RSD03-014': 2, '26RSD10-X01': 2, '26RSD10-X02': 2 }, '26RSD10-001'),
  readyDeck('rbs01-1', 'Clash (26RBS01)', {'26RSD01-001': 3, '26RBS01-002': 3, '26RBS01-005': 3, '26RBS01-006': 3, '26RBS01-004': 3, '26RBS01-008': 3, '26RBS01-009': 3, '26RBS01-X01': 3, '26RBS01-X02': 3, '26RBS01-X03': 3, '26RBS01-092': 3, '26RSD01-012': 3, '26RSD01-014': 3, '26RBS01-111': 1}, '26RBS01-009', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_01.php'),
  readyDeck('rbs01-2', 'Necromancy (26RBS01)', {'26RSD02-001': 3, '26RSD02-002': 3, '26RSD02-003': 3, '26RBS01-016': 3, '26RBS01-017': 3, '26RBS01-018': 3, '26RBS01-019': 3, '26RBS01-021': 3, '26RBS01-024': 3, '26RBS01-028': 2, '26RBS01-X04': 3, '26RBS01-X05': 3, '26RBS01-X06': 2, '26RSD02-014': 3}, '26RBS01-024', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_02.php'),
  readyDeck('rbs01-3', 'Torrent (26RBS01)', {'26RSD03-002': 3, '26RBS01-034': 3, '26RBS01-035': 3, '26RBS01-038': 3, '26RBS01-041': 3, '26RBS01-044': 3, '26RBS01-X08': 3, '26RBS01-X09': 3, '26RBS01-097': 3, '26RBS01-098': 3, '26RSD03-012': 3, '26RBS01-115': 3, '26RBS01-116': 2, '26RBS01-117': 2}, '26RBS01-044', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_03.php'),
  readyDeck('rbs01-4', 'Amplify (26RBS01)', {'26RBS01-046': 3, '26RBS01-048': 3, '26RBS01-049': 3, '26RBS01-050': 3, '26RBS01-053': 3, '26RBS01-051': 2, '26RBS01-054': 3, '26RBS01-055': 2, '26RBS01-059': 3, '26RBS01-X10': 3, '26RBS01-X11': 3, '26RBS01-100': 3, '26RSD04-014': 3, '26RBS01-120': 3}, '26RBS01-055', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_04.php'),
  readyDeck('rbs01-5', 'Magic Arts (26RBS01)', {'26RBS01-062': 3, '26RBS01-066': 3, '26RBS01-068': 3, '26RBS01-071': 3, '26RBS01-072': 3, '26RBS01-074': 3, '26RBS01-X13': 3, '26RBS01-X15': 2, '26RBS01-104': 3, '26RSD05-011': 3, '26RSD05-014': 3, '26RBS01-121': 3, '26RBS01-122': 3, '26RBS01-123': 3}, '26RBS01-074', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_05.php'),
  readyDeck('rbs01-6', 'Earth Rumble (26RBS01)', {'26RBS01-076': 3, '26RBS01-077': 3, '26RBS01-079': 2, '26RBS01-081': 3, '26RBS01-082': 3, '26RBS01-084': 3, '26RBS01-088': 3, '26RBS01-090': 3, '26RBS01-X16': 3, '26RBS01-X18': 2, '26RBS01-106': 3, '26RBS01-107': 3, '26RSD06-013': 3, '26RBS01-126': 3}, '26RBS01-088', 'https://www.battlespirits.com/feature/structure/26RBS01/deck_06.php'),
  readyDeck('rbs02-1', 'Crimson Cloud (26RBS02)', {'26RBS01-002': 3, '26RBS01-009': 3, '26RBS01-X03': 3, '26RBS02-002': 3, '26RBS02-007': 2, '26RBS02-008': 3, '26RBS02-011': 2, '26RBS02-012': 3, '26RBS02-X01': 3, '26RBS02-X02': 3, '26RBS02-074': 3, '26RBS02-087': 3, '26RSD01-012': 3, '26RSD01-014': 3}, '26RBS02-X01', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_01.php'),
  readyDeck('rbs02-2', 'Beast Possession (26RBS02)', {'26RBS01-026': 2, '26RBS02-013': 3, '26RBS02-015': 3, '26RBS02-016': 3, '26RBS02-017': 3, '26RBS02-019': 2, '26RBS02-022': 3, '26RBS02-X04': 3, '26RBS02-X05': 3, '26RBS02-X06': 3, '26RSD02-001': 3, '26RSD02-002': 3, '26RBS02-076': 3, '26RSD02-014': 3}, '26RBS02-X05', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_02.php'),
  readyDeck('rbs02-3', 'Ancient Serpent (26RBS02)', {'26RBS01-034': 3, '26RBS02-025': 3, '26RBS02-026': 3, '26RBS02-029': 3, '26RBS02-032': 3, '26RBS02-033': 3, '26RBS02-X07': 3, '26RBS02-X09': 3, '26RSD03-002': 3, '26RSD03-003': 1, '26RSD03-X01': 3, '26RBS02-078': 3, '26RBS02-089': 3, '26RSD03-014': 3}, '26RBS02-X07', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_03.php'),
  readyDeck('rbs02-4', 'White Weave (26RBS02)', {'26RBS02-038': 3, '26RBS02-039': 3, '26RBS02-042': 3, '26RBS02-044': 2, '26RBS02-047': 3, '26RBS02-048': 2, '26RBS02-X10': 3, '26RBS02-X12': 3, '26RSD04-002': 3, '26RBS02-080': 3, '26RBS02-081': 3, '26RBS01-118': 3, '26RBS01-120': 2, '26RBS02-090': 1, '26RSD04-014': 3}, '26RBS02-X10', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_04.php'),
  readyDeck('rbs02-5', "Oni's Cry (26RBS02)", {'26RBS01-061': 3, '26RBS01-073': 2, '26RBS02-050': 3, '26RBS02-051': 3, '26RBS02-054': 3, '26RBS02-056': 3, '26RBS02-059': 3, '26RBS02-061': 2, '26RBS02-X13': 3, '26RBS02-X14': 3, '26RBS02-082': 3, '26RBS02-083': 3, '26RBS02-091': 3, '26RSD05-014': 3}, '26RBS02-X13', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_05.php'),
  readyDeck('rbs02-6', 'Blue Tree (26RBS02)', {'26RBS02-063': 3, '26RBS02-065': 2, '26RBS02-066': 2, '26RBS02-069': 3, '26RBS02-073': 2, '26RBS02-X16': 3, '26RBS02-X17': 2, '26RBS02-X18': 3, '26RSD06-X01': 2, '26RBS02-084': 3, '26RBS02-085': 3, '26RBS02-086': 3, '26RBS02-092': 3, '26RSD06-012': 3, '26RSD06-013': 3}, '26RBS02-X16', 'https://www.battlespirits.com/feature/structure/26RBS02/deck_06.php'),
  readyDeck('rbs03-1', 'Refined Wing (26RBS03)', {'26RSD09-001': 3, '26RSD09-004': 3, '26RSD09-006': 3, '26RSD09-X01': 3, '26RSD09-X02': 3, '26RBS03-003': 3, '26RBS03-X01': 3, '26RBS03-X02': 3, '26RBS03-X03': 3, '26RSD09-010': 1, '26RSD09-011': 3, '26RSD01-014': 3, '26RSD09-012': 3, '26RBS03-087': 3}, '26RBS03-X01', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_01.php'),
  readyDeck('rbs03-2', 'Dark Purple (26RBS03)', {'26RSD02-001': 3, '26RBS03-009': 3, '26RBS03-010': 3, '26RBS03-011': 3, '26RBS03-012': 3, '26RBS03-014': 3, '26RBS03-022': 2, '26RBS03-X04': 3, '26RBS03-X05': 3, '26RBS03-X06': 3, '26RBS03-076': 3, '26RSD02-012': 3, '26RSD02-014': 3, '26RBS03-089': 2}, '26RBS03-X04', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_02.php'),
  readyDeck('rbs03-3', 'Abyss (26RBS03)', {'26RBS01-034': 3, '26RSD10-003': 3, '26RSD10-007': 3, '26RSD10-008': 3, '26RSD10-X01': 3, '26RSD10-X02': 3, '26RBS03-024': 3, '26RBS03-029': 3, '26RBS03-030': 2, '26RBS03-X07': 3, '26RSD10-011': 2, '26RSD03-014': 3, '26RSD10-013': 3, '26RBS03-091': 3}, '26RSD10-X02', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_03.php'),
  readyDeck('rbs03-4', 'Silica Ash (26RBS03)', {'26RBS03-032': 3, '26RBS03-034': 3, '26RBS03-035': 3, '26RBS03-039': 3, '26RBS03-040': 3, '26RBS03-041': 3, '26RBS03-042': 2, '26RBS03-045': 2, '26RBS03-X09': 2, '26RBS03-X10': 3, '26RBS03-X11': 3, '26RBS03-079': 3, '26RBS03-080': 3, '26RSD04-014': 3, '26RBS03-093': 1}, '26RBS03-X10', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_04.php'),
  readyDeck('rbs03-5', 'Yellow Even (26RBS03)', {'26RBS03-047': 2, '26RBS03-049': 3, '26RBS03-050': 3, '26RBS03-052': 3, '26RBS03-053': 2, '26RBS03-055': 3, '26RBS03-056': 3, '26RBS03-058': 3, '26RBS03-060': 3, '26RBS03-X13': 3, '26RBS03-081': 2, '26RBS03-082': 3, '26RSD05-014': 3, '26RBS03-095': 2, '26RBS03-096': 2}, '26RBS03-058', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_05.php'),
  readyDeck('rbs03-6', 'Blue Vanilla (26RBS03)', {'26RSD06-005': 2, '26RBS01-078': 3, '26RBS03-061': 3, '26RBS03-064': 3, '26RBS03-065': 3, '26RBS03-066': 3, '26RBS03-068': 3, '26RBS03-070': 3, '26RBS03-071': 3, '26RBS03-X14': 3, '26RBS03-085': 3, '26RSD06-012': 3, '26RBS01-126': 2, '26RBS03-097': 3}, '26RBS03-070', 'https://www.battlespirits.com/feature/structure/26RBS03/deck_06.php'),
  readyDeck('rcb01-1', 'Kamen Rider Zeztz (26RCB01)', {'26RCB01-019': 3, '26RCB01-020': 2, '26RCB01-021': 3, '26RCB01-022': 3, '26RCB01-X03': 3, '26RSD07-002': 3, '26RSD07-003': 3, '26RSD07-004': 3, '26RSD07-X01': 3, '26RSD07-X02': 3, '26RSD07-012': 3, '26RCB01-063': 2, '26RSD07-013': 3, '26RSD07-014': 3}, '26RCB01-X03', 'https://www.battlespirits.com/feature/structure/26RCB01/deck_01.php'),
  readyDeck('rcb01-2', 'Kamen Rider Gaim (26RCB01)', {'26RCB01-001': 3, '26RCB01-003': 3, '26RCB01-004': 3, '26RCB01-005': 3, '26RCB01-006': 3, '26RCB01-008': 3, '26RCB01-011': 3, '26RCB01-014': 2, '26RCB01-015': 3, '26RCB01-X01': 3, '26RCB01-X02': 3, '26RCB01-057': 3, '26RCB01-061': 2, '26RCB01-062': 3}, '26RCB01-X02', 'https://www.battlespirits.com/feature/structure/26RCB01/deck_02.php'),
  readyDeck('rcb01-3', 'Kamen Rider Ryuki (26RCB01)', {'26RCB01-026': 3, '26RCB01-027': 2, '26RCB01-028': 3, '26RCB01-029': 2, '26RCB01-031': 3, '26RCB01-035': 3, '26RCB01-037': 3, '26RCB01-038': 3, '26RCB01-X04': 1, '26RCB01-X05': 3, '26RCB01-058': 3, '26RCB01-065': 3, '26RCB01-066': 1, '26RCB01-067': 1, '26RCB01-068': 3, '26RCB01-069': 3}, '26RCB01-X05', 'https://www.battlespirits.com/feature/structure/26RCB01/deck_03.php'),
  readyDeck('rcb01-4', 'Kamen Rider Ex-Aid (26RCB01)', {'26RCB01-039': 3, '26RCB01-040': 3, '26RCB01-041': 3, '26RCB01-043': 3, '26RCB01-044': 3, '26RCB01-046': 3, '26RCB01-047': 3, '26RCB01-048': 3, '26RCB01-054': 3, '26RCB01-X06': 3, '26RCB01-X07': 3, '26RCB01-059': 3, '26RCB01-070': 2, '26RCB01-071': 2}, '26RCB01-X07', 'https://www.battlespirits.com/feature/structure/26RCB01/deck_04.php'),
  readyDeck('rdb01-1', 'Red Stella (26RDB01)', {'26RDB01-002': 3, '26RDB01-003': 3, '26RDB01-004': 3, '26RDB01-005': 3, '26RDB01-006': 2, '26RDB01-007': 3, '26RDB01-009': 3, '26RDB01-014': 2, '26RDB01-X01': 3, '26RDB01-X02': 3, '26RDB01-055': 3, '26RDB01-056': 3, '26RDB01-060': 3}, '26RDB01-X01', 'https://www.battlespirits.com/feature/structure/26RDB01/deck_01.php'),
  readyDeck('rdb01-2', 'Green Wave (26RDB01)', {'26RDB01-015': 3, '26RDB01-016': 3, '26RDB01-017': 3, '26RDB01-018': 3, '26RDB01-023': 3, '26RDB01-027': 3, '26RDB01-028': 3, '26RDB01-029': 2, '26RDB01-X03': 3, '26RDB01-X04': 3, '26RDB01-051': 3, '26RDB01-057': 2, '26RDB01-059': 3, '26RDB01-060': 3}, '26RDB01-X03', 'https://www.battlespirits.com/feature/structure/26RDB01/deck_02.php'),
  readyDeck('rdb01-3', 'Yellow Rise (26RDB01)', {'26RSD08-001': 3, '26RSD08-002': 3, '26RSD08-003': 3, '26RSD08-006': 3, '26RSD08-X01': 2, '26RSD08-X02': 3, '26RDB01-030': 3, '26RDB01-031': 3, '26RDB01-X05': 3, '26RSD08-011': 3, '26RSD08-012': 3, '26RSD08-013': 2, '26RSD08-014': 3, '26RDB01-060': 3}, '26RSD08-X01', 'https://www.battlespirits.com/feature/structure/26RDB01/deck_03.php'),
  readyDeck('rdb01-4', 'Blue Beat (26RDB01)', {'26RDB01-033': 3, '26RDB01-034': 3, '26RDB01-036': 3, '26RDB01-039': 3, '26RDB01-040': 3, '26RDB01-042': 2, '26RDB01-043': 3, '26RDB01-045': 3, '26RDB01-X06': 3, '26RDB01-X07': 3, '26RDB01-053': 3, '26RDB01-062': 2, '26RDB01-063': 3, '26RDB01-060': 3}, '26RDB01-X06', 'https://www.battlespirits.com/feature/structure/26RDB01/deck_04.php'),
  /* Internal fixtures (hidden, never listed): the six hand-made colour / Contract decks. They are no longer ready-made decks;
     the engine unit tests and CPU sims pin their ids and card maps, so the recipes stay here as fixtures (v0.162.0 rule). */
  prebuiltDeck('fixture', 'mitra', 'White: Mitra / Awakened Dragon (Contract)', { 'BS74-CX03': 3, 'BS74-072': 3, 'BS74-038': 3, 'BS74-040': 2, 'BS74-041': 3, 'BS74-042': 3, 'BS74-043': 2, 'BS74-045': 2, 'BS74-047': 2, 'BS74-048': 2, 'BS74-049': 2, 'BS74-050': 2, 'BS75-028': 3, 'BS75-030': 2, 'BS75-035': 3, 'BS75-037': 1, 'BS75-041': 1, 'BS75-X08': 1 }, 'BS74-038'),
  prebuiltDeck('fixture', 'red', 'Red: BS75 Crimson Dragon / Lava Fish', { 'BS74-CX01': 3, 'BS75-001': 3, 'BS75-002': 3, 'BS75-003': 3, 'BS75-004': 3, 'BS75-006': 3, 'BS75-007': 3, 'BS75-008': 3, 'BS75-010': 3, 'BS75-011': 3, 'BS75-012': 3, 'BS75-013': 2, 'BS75-073': 3, 'BS75-076': 2 }, 'BS75-001'),
  prebuiltDeck('fixture', 'blue', 'Blue: Nuadha / Scalostle Dana (Contract)', { 'BS71-CX03': 3, 'BS71-072': 1, 'BS71-053': 3, 'BS71-054': 2, 'BS71-056': 3, 'BS71-057': 3, 'BS72-049': 2, 'BS72-050': 3, 'BS72-051': 2, 'BS71-058': 3, 'BS72-054': 2, 'BS71-060': 2, 'BS71-061': 2, 'BS71-X09': 1, 'BS71-063': 2, 'BS71-064': 2, 'BS72-068': 2, 'BS74-067': 2 }, 'BS71-053'),
  prebuiltDeck('fixture', 'green', 'Green: Hermes / Lionheart Blade Beast (Contract)', { 'BS69-CX02': 3, 'BS69-071': 2, 'BS70-072': 2, 'BS69-023': 3, 'BS69-024': 2, 'BS69-025': 3, 'BS69-026': 3, 'BS70-028': 3, 'BS69-028': 2, 'BS69-029': 3, 'BS70-031': 2, 'BS70-034': 2, 'BS69-030': 2, 'BS70-035': 2, 'BS69-031': 3, 'BS70-X03': 1, 'BS69-033': 2 }, 'BS69-023'),
  prebuiltDeck('fixture', 'purple', 'Purple: Hades / Sorcerer Infernal Lord (Contract)', { 'BS68-CX01': 3, 'BS68-070': 3, 'BS68-012': 3, 'BS68-014': 3, 'BS68-015': 3, 'BS68-016': 3, 'BS68-017': 3, 'BS68-018': 3, 'BS68-019': 3, 'BS68-020': 3, 'BS68-022': 3, 'BS68-023': 3, 'BS68-NX01': 2, 'BS68-021': 2 }, 'BS68-012'),
  prebuiltDeck('fixture', 'yellow', 'Yellow: Indra / Thunderive (Contract)', { 'BS75-CX03': 3, 'BS75-068': 3, 'BS75-042': 3, 'BS75-043': 3, 'BS75-044': 3, 'BS75-045': 3, 'BS75-046': 2, 'BS75-047': 3, 'BS75-048': 3, 'BS75-049': 3, 'BS75-050': 2, 'BS75-X10': 3, 'BS76-047': 3, 'BS76-048': 3 }, 'BS75-042'),
];
const defaultDeck = () => Object.assign({}, PREBUILT.find(d => d.id === 'std02').cards);     // first-run and "Default" deck: the Standard starter 26RSD02 (most complete cards of the ten, 27 of 40 on 2026-10-21)
const SLOT_KEY = 'bse.slots.v1', SLOT_COUNT = 8;
/** @type {DeckSlot[]} */
let SLOTS = null;
let ACTIVE_SLOT = 0;
function loadSlots() {
  try {
    const o = JSON.parse(localStorage.getItem(SLOT_KEY));
    if (o && Array.isArray(o.slots) && o.slots.length === SLOT_COUNT) {
      SLOTS = o.slots.map((x, i) => Object.assign({ name: String(x && x.name || 'Deck ' + (i + 1)).slice(0, 24), cards: cleanDeck(x && x.cards) }, x && x.used ? { used: true } : {}, x && x.look && typeof x.look === 'object' ? { look: x.look } : {}, x && x.key && CARDS[x.key] && CARDS[x.key].type === 'Spirit' ? { key: x.key } : {}));   // used: listed on My decks (v0.93.0); look: Deck look (v0.94.0); key: marked Key Spirit (v0.103.0)
      ACTIVE_SLOT = Number.isInteger(o.active) && o.active >= 0 && o.active < SLOT_COUNT ? o.active : 0; return;
    }
  } catch (e) { /* ignore */ }
  let first = {};
  try { const v = cleanDeck(JSON.parse(localStorage.getItem('bse.deck.v3'))); if (deckTotal(v) > 0) first = v; } catch (e) { /* ignore */ }
  if (!deckTotal(first)) first = defaultDeck();
  SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => ({ name: 'Deck ' + (i + 1), cards: i === 0 ? first : {} })); ACTIVE_SLOT = 0;
}
loadSlots();
let PLAYER_DECK = Object.assign({}, SLOTS[ACTIVE_SLOT].cards);
function saveDeck() {
  SLOTS[ACTIVE_SLOT].cards = Object.assign({}, PLAYER_DECK);
  try { localStorage.setItem(SLOT_KEY, JSON.stringify({ active: ACTIVE_SLOT, slots: SLOTS })); localStorage.setItem('bse.deck.v3', JSON.stringify(PLAYER_DECK)); } catch (e) { /* storage blocked */ }
}
function switchSlot(i) {
  if (!Number.isInteger(i) || i < 0 || i >= SLOT_COUNT) return false;
  saveDeck(); ACTIVE_SLOT = i; PLAYER_DECK = Object.assign({}, SLOTS[i].cards); saveDeck(); return true;
}
function loadPrebuilt(id) {
  const d = PREBUILT.find(x => x.id === id); if (!d) return false;
  PLAYER_DECK = cleanDeck(d.cards); if (SLOTS[ACTIVE_SLOT].name.startsWith('Deck ')) SLOTS[ACTIVE_SLOT].name = d.name.slice(0, 24); SLOTS[ACTIVE_SLOT].key = d.key || null; saveDeck(); return true;
}
let CPU_DECK_NAME = '', CPU_KEY = null;                 // CPU_KEY: the CPU seat's Key Spirit, resolved with the deck pick (v0.103.0)
function cpuDeckFor(format) {                          // the CPU deck: the chosen one when legal in this format, else a random legal prebuilt deck
  const sel = SETTINGS.cpuDeck;
  if (sel === 'mine') { CPU_DECK_NAME = 'Mirror of ' + SLOTS[ACTIVE_SLOT].name; CPU_KEY = keyOfDeck(PLAYER_DECK, SLOTS[ACTIVE_SLOT] && SLOTS[ACTIVE_SLOT].key) || pickKey(PLAYER_DECK); return Object.assign({}, PLAYER_DECK); }
  /* Format legality comes from the cards themselves: a Standard deck is legal in Eternal and may serve as the Eternal CPU
     deck (v0.201.0: every listed deck is a Standard printer now), an Eternal deck is not legal in Standard. */
  const usable = d => !d.missing && validateDeck(d.cards, format).ok;      // an incomplete starter is never picked for the CPU
  const pick = PREBUILT.find(d => d.id === sel);
  if (pick && usable(pick)) { CPU_DECK_NAME = pick.name; CPU_KEY = keyOfDeck(pick.cards, pick.key); return pick.cards; }
  const legal = PREBUILT.filter(d => usable(d) && !d.hidden && d.id !== 'train');      // the random pick only takes listed decks (hidden fixtures and the training deck stay selectable by id)
  const d = legal.length ? legal[Math.floor(rng() * legal.length)] : PREBUILT[0];
  CPU_DECK_NAME = d.name; CPU_KEY = keyOfDeck(d.cards, d.key); return d.cards;
}

