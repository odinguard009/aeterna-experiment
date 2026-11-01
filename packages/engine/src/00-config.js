"use strict";

/* =====================================================================
   AETERNA - engine (version: VERSION in 01-cards.js)
   Rules: official Eternal Rule Manual (17.x) and Standard Comprehensive Rules (1.x).
   Cards: built-in Saga 15-17 pack (data/cards, embedded below), user-imported JSON, and generic "Training" vanilla cards for sims.
   Unofficial non-commercial fan project; card names, text and trademarks belong to their owners.
   ===================================================================== */

const SIM = new URLSearchParams(location.search).has('sim');   // dev: CPU plays both sides
const STEPS = ['START', 'CORE', 'DRAW', 'REFRESH', 'MAIN', 'ATTACK', 'END'];
const STEPS_STANDARD = ['START', 'CORE', 'DRAW', 'REFRESH', 'MAIN', 'ATTACK', 'MAIN 2', 'END'];
/* Formats (official): Eternal = every card except the banned list; Standard = only cards with a letter block icon
   (Apr 2026 - Mar 2027: block "A" only) and it adds the Second Main Step. */
const FORMAT_KEY = 'bse.format';
let FORMAT = 'standard';      // default format (owner, 2026-10-21); a saved choice below wins
try { const v = localStorage.getItem(FORMAT_KEY); if (v === 'standard' || v === 'eternal') FORMAT = v; } catch (e) { /* blocked */ }
const STANDARD_BLOCKS = ['A'];
const BAN_LIST_INFO = { effective: '2026-09-01', checked: '2026-10-21', source: 'battlespirits.com banned/restricted list (announced 2026-08-21)', standard: 'no Standard list exists on the official page (checked 2026-10-21): the one list is for the Eternal qualifiers' };      // session_start.sh warns when `effective` is older than 30 days
const BANNED = new Set(["BS01-124", "BS01-132", "BS02-063", "BS02-085", "BS02-097", "BS02-099", "BS03-030", "BS04-088", "BS04-089", "BS04-096", "BS04-105", "BS10-006", "BS10-108", "BS10-111", "BS11-X02", "BS12-039", "BS12-X02", "BS13-059", "BS13-071", "BS16-X03", "BS26-016", "BS28-082", "BS32-011", "BS32-074", "BS38-RV003", "BS38-RVX02", "BS39-049", "BS39-051", "BS39-052", "BS39-055", "BS39-057", "BS39-059", "BS40-X06", "BS41-063", "BS43-X04", "BS44-10THX01", "BS45-024", "BS45-090", "BS48-X06", "BS52-017", "BS52-019", "BS52-058", "BS52-CP08", "BS52-RV002", "BS52-X01", "BS52-X06", "BS53-XX02", "BS54-X03", "BS55-075", "BS56-021", "BS56-072", "BS56-075", "BS56-RV006", "BS57-011", "BS57-078", "BS57-083", "BS59-X07", "BS60-051", "BS61-062", "BS64-X02", "BS66-068", "BS70-078", "BS72-019", "BSC22-CP01", "BSC22-CP02", "BSC32-031", "BSC48-015", "BSC50-031", "CB05-055", "EX017", "P043", "SD02-014", "SD27-001", "SD41-RVX01", "SD54-015", "SD68-007"]);
const LIMITED1 = new Set(["BS02-093", "BS02-X08", "BS03-148", "BS03-X11", "BS04-082", "BS06-084", "BS08-066", "BS08-X32", "BS11-082", "BS12-052", "BS13-062", "BS13-063", "BS15-063", "BS21-X07", "BS26-075", "BS30-035", "BS31-017", "BS31-112", "BS32-048", "BS33-019", "BS35-005", "BS35-X04", "BS37-X05", "BS38-RV028", "BS39-036", "BS39-039", "BS39-054", "BS41-XX01", "BS42-007", "BS42-069", "BS43-RVX06", "BS45-X01", "BS46-056", "BS46-X05", "BS48-019", "BS48-025", "BS50-015", "BS50-X03", "BS51-042", "BS51-10THX01", "BS51-CP04", "BS52-010", "BS52-032", "BS52-TX01", "BS52-X09", "BS55-TX04", "BS55-X02", "BS56-022", "BS56-025", "BS57-X07", "BS58-TCP02", "BS60-063", "BS60-064", "BS60-083", "BS64-059", "BS70-013", "BS72-023", "BS73-TCP01", "BS75-054", "BSC05-018", "BSC29-007", "BSC49-075", "BSC50-033", "CB05-XX01", "CB08-X02", "CB13-X05", "LM17-01", "LM19-02", "P073", "SD03-001", "SD03-012", "SD10-009", "SD39-X01", "SD43-RV001", "SD51-004", "SD51-005", "SD51-X02", "SD53-014", "SD55-011", "SD55-TX01", "SD57-006"]);
const normCardNo = id => String(id || '').trim().toUpperCase();
/* Ban lists per format: the official list is the Eternal one; Standard has none yet (BAN_LIST_INFO.standard), so it is empty and a later Standard list is added to this table. */
const BAN_LISTS = { eternal: { banned: BANNED, limit1: LIMITED1 }, standard: { banned: new Set(), limit1: new Set() } };
const banStatus = (id, format) => { const L = BAN_LISTS[format === 'standard' ? 'standard' : 'eternal'], k = normCardNo(id); return L.banned.has(k) ? 'banned' : L.limit1.has(k) ? 'limit1' : null; };      // no format = Eternal list
const maxCopies = (id, format) => (banStatus(id, format) === 'banned' ? 0 : banStatus(id, format) === 'limit1' ? 1 : 3);
function standardLegal(id) { const b = CARDS[id] && CARDS[id].block; return !!b && STANDARD_BLOCKS.includes(String(b).toUpperCase()); }
function legalityOf(id, format) {            // -> null when legal, else a short reason
  const st = banStatus(id, format);
  if (st === 'banned') return 'banned';
  if (format === 'standard' && !standardLegal(id)) return `not Standard-legal (block ${(CARDS[id] && CARDS[id].block) || 'unknown'})`;
  return null;
}
/* cores are unlimited: new cores enter the game from an infinite supply (p.made counts them); the Soul Core is a separate core */
const ABORT = { abort: true };
const other = k => (k === 'player' ? 'opponent' : 'player');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/* v0.31 Title Case for every dialog button label (owner request, issue #6): capitalise the first letter of each word, minor words stay lower case except as the first word; existing capitals (LV2, BP, HEADS, card names) are kept. */
const TC_MINOR = new Set('a an the and or nor but of to in on at by for from with as per vs via into'.split(' '));
const titleCase = s => { let first = true; return String(s == null ? '' : s).split(' ').map(w => {
  const m = /^([^A-Za-z]*)([a-z])(.*)$/.exec(w);
  if (m && (first || !TC_MINOR.has(m[2] + m[3]))) w = m[1] + m[2].toUpperCase() + m[3];
  if (/[A-Za-z]/.test(w)) first = false; return w; }).join(' '); };
/* v0.26 seeded randomness: every match has a seed (G.rec.seed), so the same seed + decks + inputs replay the same match (idea from the Aegis input record). mulberry32. */
let RNG_STATE = 1;
/* Aeterna house rule (owner, 2026-10-21): the Key Spirit — one Spirit card per deck marked in the deck builder; while no copy of it is
   in the Hand or on the Field, draws from the Deck favour its copies. 2x per copy to start, sized by cpu_bench (docs/mechanics/key-spirit.md). */
const KEY_WEIGHT = 2;
function seedRng(seed) { RNG_STATE = (seed >>> 0) || 1; }
function rng() { let t = RNG_STATE = (RNG_STATE + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const newSeed = () => (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function removeFrom(arr, x) { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); return i >= 0; }

const KEYWORD_GLOSSARY = {
  'ADVENT': 'Place this card from your Hand on top of a Spirit that meets its Advent condition. No cost is paid, but you must move your Soul Core as the card says. Cores on the source stay. Advent is not a summon.',
  'CONTRACT_ADVENT': 'Flash: by sending your Soul Core to the Trash, stack this card from your Hand onto your target Spirit (it needs the family / counters the card names). Cores on the target stay. Advent is not a summon, but "When Advents" effects activate.',
  'MANIFEST': 'Flash: by sending your Soul Core to the Trash and paying one core from the target Nexus, summon this card from your Hand. It needs the target and counters the card names.',
  'CONTRACT': 'Contract cards: only one type (up to 3 copies) per deck, and one can be added to your starting Hand. When it would leave the Field because of the opponent, it may enter Soul State instead.',
  'BURST': 'Set face down in the Burst Area once per turn from your Hand (no cost). When its condition is met, flip it and use its effect without paying the cost.',
  'MIRAGE': 'Set face up in the Burst Area once per turn (pay the Mirage cost) to use its Mirage effect.',
  'HEAVY_EXHAUST': 'Card turned upside down. It cannot attack or block, and one Refresh turns it into a normal Exhausted card.',
  'FLASH': 'An effect usable in your Main Step and in the Flash Timing during battle.',
  'MAGIC': 'Magic cards are cast from your Hand: pay the cost, use the effect, then the card goes to the Trash. [Main] Magic is cast in your Main Step. [Flash] Magic can also be cast in the Flash Timings of a battle, by either player.',
  'RUMBLE': 'During Attack: at the end of the battle, discard X cards from the opposing decktop, minus the cost of the blocking Spirit card that is now in the opposing Trash (the attacker must still be on the Field).',
  'AMPLIFY': 'Amplify: for each matching Spirit you control, during this battle, this Spirit gains +N BP (printed as {{Amplify|family +N}}).'
};
/* v0.205.1: printed rule words and timing tags that card text shows without explaining them. Own wording (reminders, not rule text);
   effect text marks each word as tappable (11-human.js fxMark) and the Learn glossary lists them. Aliases resolve in glossText (11-human.js). */
const TERM_GLOSSARY = {
  'Legacy': 'A Legacy Spirit can be summoned by banishing cards with an EX Symbol (from where its text says). Each EX Symbol card banished that way counts as "banished via this Legacy", and many Legacy effects get stronger with that number.',
  'True Release': 'A card with True Release reaches LV2 with only its Soul Core on it (True Release state). Effects that say "in True Release state" check for this. Higher levels still count the Soul Core as one core.',
  'Clash': 'Clash: while this Spirit attacks, opposing Spirits must block it if possible. Other effects can name "Spirits with Clash" (for example +BP in your Attack Step) and then apply only to Spirits that have this word.',
  'Rush': 'Rush <colour>: while you have a Field symbol of that colour, the effect printed after it takes place. Without the symbol the effect after it is skipped.',
  'Accel': 'Accel: use this card\'s Accel effect from your Hand by paying the Accel cost. Symbols on your Field reduce that cost. The card then goes where its text says (often the Removed Zone), not to the Trash.',
  'Invoke': 'Invoke Flash / Invoke Main: an ability usable at that timing. Pay the cost shown before the arrow (▶) in full; if you cannot, the effect after the arrow does not happen.',
  'Seal': 'Seal: put your Soul Core from the place the card names onto your Life. While it sits in your Life you are Sealed, and "During Seal" effects are active.',
  'Unleash': 'Unleash N: when the trigger happens you can send N cores from the named Grandwalker Nexus to this Spirit. The rest of the effect works only if you did.',
  'Tribute': 'Tribute: after paying the summon cost you must send all cores from one of your Spirits that meets the stated cost to the stated place (Trash or Void). Summoning without paying skips Tribute.',
  'Assault': 'Assault N: this Spirit may be refreshed up to N times per turn by exhausting one of your Nexuses (used when it attacks).',
  'Excite': 'Excite N: a counter-based condition. If you have N or more counters when the trigger happens, the stated effect (often returning this card from the Trash to your Hand) can be used.',
  'Immortality': 'Immortality: when the stated Spirit would be destroyed, it can come back (summoned) as the card says. "Summoned via Immortality" effects check for that return.',
  'Armor': 'Armor <colour>: this card is unaffected by opposing Spirit / Nexus / Magic effects of that colour.',
  'Heavy Armor': 'Heavy Armor <colour>: unaffected by opposing Spirit / Brave / Nexus / Magic effects of that colour (and it keeps Burst effects from being activated).',
  'Ultra Armor': 'Ultra Armor <colour>: unaffected by opposing Spirit / Ultimate / Nexus / Magic effects of that colour.',
  'Soul Magic': 'Soul Magic: a Magic card printed with a Soul Core cost; it is cast as the card says while your Soul Core is where the card needs it.',
  'Sumcon': 'Sumcon: the summon condition of an Ultimate card. You can summon it only while you meet the condition printed (a control, colour, cost, family, Life or counter requirement).',
  'Mani': 'Mani: summon this card from your Hand during the stated timing. Send your Soul Core to the Trash and pay one cost from the named target as the card says. It is a Manifest-style summon.',
  'Fast Draw': 'Fast Draw N: an Invoke-style Flash ability. By paying the stated cost (usually discarding a named card) you can use its effect at the printed timing, once per turn.',
  'High Speed': 'High Speed: a Flash ability. You can summon this card from your Hand at Flash Timing by paying its cost with the Lv1 cores taken only from your Reserve.',
  'Crush': 'Crush (When Attacks): discard cards from the top of the opposing Deck equal to this Spirit\'s level.',
  'Holy Life': 'Holy Life (When Attacks): when this Spirit\'s attack reduces the opposing Life, put a core from the Void on your Life.',
  'Silver Wheel': 'Silver Wheel: a Flash effect that costs you exhausting this Spirit.',
  'Awaken': 'Awaken: move cores from your other Spirits to this Spirit within the printed limit.',
  'Revive': 'Revive: a Spirit or Grandwalker Nexus that can be summoned again, paying its cost, from the place the card names (for example your Trash).',
  'Oracle': 'Oracle: put a core on a Grandwalker Nexus as the card says (a Grandwalker only receives cores through effects that target it).',
  'Core Charge': 'Core Charge: add cores to your target as the card says when the trigger happens (Neo-Core Charge: from your Spirits being summoned).',
  'Over Count': 'Over Count (OC): active while your Count meets the stated number, whatever the level. Its + value is added to the BP of the Spirit.',
  'Soul Core': 'The Soul Core is your special core. It can be in your Reserve, on a Field card, in your Life or in the Trash, and many effects (Advent, Manifest, Seal) move it.',
  'Soul State': 'A Contract card in Soul State is not on the Field. It stands in for your Soul Core and can be deployed later by an effect; it is not "controlled" until then.',
  'Grandwalker': 'A Grandwalker Nexus is a special Nexus. Cores can only be put on it by Oracle or by effects that target it, and cores on it go to the Void when it leaves the Field.',
  'Brave': 'A Brave card can combine with a Spirit on your Field. A combined Brave belongs to that Spirit and gives it the BP and effects printed on the Brave.',
  'Nether Immortality': 'Nether Immortality: when your matching "Nether" Spirit is destroyed, you can summon this card from your Trash.',
  'When Summoned': 'Timing tag: the effect activates when this card is summoned.',
  'When Attacks': 'Timing tag: the effect activates when this Spirit attacks (in your Attack Step).',
  'When Blocks': 'Timing tag: the effect activates when this Spirit blocks.',
  'When Destroyed': 'Timing tag: the effect activates when this card is destroyed (it resolves before the card goes to the Trash).',
  'When Destroyed by the Opponent': 'Timing tag: only when an opposing effect, or a BP comparison with an opposing Spirit, destroyed it.',
  'When Battles': 'Timing tag: activates around the battle of this Spirit; "(When Battles)" texts usually say whether it is before, during or after the comparison.',
  'When Advents': 'Timing tag: the effect activates when this card advents (is stacked on a Spirit).',
  'When Manifests': 'Timing tag: the effect activates when this card is summoned by Manifest.',
  'During Attack': 'Timing tag: the effect applies as long as this Spirit is attacking.',
  'Either Attack Step': 'Timing: your own or the opponent\'s Attack Step.',
  'Your Attack Step': 'Timing: during your Attack Step.',
  'Opposing Attack Step': 'Timing: during the opponent\'s Attack Step.',
  'Once per Turn: Same Name': 'Limit: the effect can be used once per turn in total by all your cards with the same name.',
  'Can\'t Stack': 'The same effect cannot activate more than once at a time (extra copies of it are ignored).'
};
Object.assign(KEYWORD_GLOSSARY, TERM_GLOSSARY);
/* Magic effects (data driven; imported Magic cards pick one of these in their "magic" field) */
const MAGIC_FX = {
  DESTROY_BP_LE: { side: 'opp', ok: (s, v) => bpOf(s) <= v, text: v => `Destroy 1 opposing Spirit with ${v} BP or less.`,
    apply: (p, opp, t) => removeSpirit(opp, t, 'destroyed', true) },
  BANISH_BP_LE: { side: 'opp', ok: (s, v) => bpOf(s) <= v, text: v => `Banish 1 opposing Spirit with ${v} BP or less.`,
    apply: (p, opp, t) => { removeSpirit(opp, t, 'banished', false); const i = opp.trash.lastIndexOf(t); if (i >= 0) { opp.trash.splice(i, 1); opp.removed.push(t); } } },
  EXHAUST_OPP: { side: 'opp', ok: s => !s.exhausted, text: () => 'Exhaust 1 opposing Spirit.',
    apply: (p, opp, t) => { t.exhausted = true; log(`${CARDS[t.id].name} is exhausted.`); } },
  BP_PLUS: { side: 'own', ok: () => true, text: v => `1 of your Spirits gets +${v} BP until the end of the turn.`,
    apply: (p, opp, t, v) => { t.bpMod = (t.bpMod || 0) + v; log(`${CARDS[t.id].name} gets +${v} BP.`); } },
  BP_PLUS_MATCH: { side: 'own', ok: (s, v, m) => fxMatch(CARDS[s.id], m && m.match), text: (v, m) => `During this turn, give 1 of your matching Spirits +${v} BP.`,
    apply: (p, opp, t, v) => { t.bpMod = (t.bpMod || 0) + v; log(`${CARDS[t.id].name} gets +${v} BP.`); } },
  REVEAL_ADD: { side: null, text: (v, m) => `Reveal ${v} cards from your decktop. Add one matching card per name keyword to your Hand and discard the rest.`,
    apply: (p, opp, t, v, m) => {
      const top = p.deck.splice(0, Math.min(v, p.deck.length)); let added = 0;
      log(`${who(p)} ${p.cpu ? 'reveals' : 'reveal'} ${top.map(x => CARDS[x.id].name).join(', ') || 'nothing'}.`);
      const keep = new Set();
      for (const key of (m && m.match && m.match.name) || []) { const x = top.find(y => !keep.has(y) && CARDS[y.id].name.toLowerCase().includes(key.toLowerCase())); if (x) keep.add(x); }
      for (const x of top) { if (keep.has(x)) { p.hand.push(x); added++; } else p.trash.push(x); }
      log(`${who(p)} ${p.cpu ? 'adds' : 'add'} ${added} card${added === 1 ? '' : 's'} to the Hand, ${top.length - added} to the Trash.`); handUp(p, added);
    } },
  DRAW: { side: null, text: v => `Draw ${v} card${v === 1 ? '' : 's'}.`,
    apply: (p, opp, t, v) => { const k = draw(p, v); log(`${who(p)} ${p.cpu ? 'draws' : 'draw'} ${k} card${k === 1 ? '' : 's'}.`); handUp(p, k); } }
};
/* v0.41: a Magic card can run any list of engine actions (FX_ACTIONS) as its effect: magic { effect: 'ACTIONS', actions: [...] }; an action may carry its own "if" */
MAGIC_FX.ACTIONS = { side: null, text: (v, m) => cap((m.actions || []).map(a => FX_ACTIONS[a.do].txt(a)).join(', then ')) + '.',
  apply: async (p, opp, t, v, m, inst) => { await runActions({ p, opp, src: inst, ctx: {} }, { actions: m.actions }); } };
const MAGIC_TIMINGS = ['MAIN', 'FLASH'];
const SYMBOL_KINDS = ['ultimate', 'god'];          // special symbols besides the six colours (rule manual p. 13)
