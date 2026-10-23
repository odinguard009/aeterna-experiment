/* ---------------------------------------------------------------------
   IMPORTED CARD DATA  (user supplied JSON; validated, stored in localStorage)
   --------------------------------------------------------------------- */
const COLORS = ['red', 'purple', 'green', 'yellow', 'blue', 'white'];
const BUILTIN_IDS = new Set(Object.keys(CARDS));
const CARDS_KEY = 'bse.cards.v4';
let IMPORTED = {};   // id -> normalized card object
let CARDS_VER = 0;   // v0.52.1: bumped whenever CARDS changes (deck builder search index)
function parseCard(o) {
  const err = [], err2 = [], int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!o || typeof o !== 'object') return { errors: ['not an object'] };
  const id = String(o.id == null ? '' : o.id).trim(), name = String(o.name == null ? '' : o.name).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-\/ ]{0,39}$/.test(id)) err.push('invalid "id" (letters, digits, . _ - / and spaces only)');
  if (BUILTIN_IDS.has(id)) err.push(`"${id}" is reserved for a built-in card`);
  if (!name || name.length > 80) err.push('missing or invalid "name"');
  const t = String(o.type == null ? 'Spirit' : o.type).toLowerCase();
  const type = t === 'spirit' ? 'Spirit' : t === 'nexus' ? 'Nexus' : t === 'magic' ? 'Magic' : t === 'brave' ? 'Brave' : t === 'ultimate' ? 'Ultimate' : null;
  if (!type) err.push(`type "${o.type}" is not supported yet (only Spirit, Nexus, Magic, Brave and Ultimate)`);
  let colors;                    // optional multicolour card, e.g. ["red","white"]; the first colour is the main one
  if (o.colors != null) {
    const cs = Array.isArray(o.colors) ? [...new Set(o.colors.map(x => String(x).toLowerCase()))] : null;
    if (!cs || cs.length < 2 || cs.length > 3 || cs.some(x => !COLORS.includes(x))) err.push('invalid "colors" (2-3 of ' + COLORS.join('/') + ')');
    else colors = cs;
  }
  const symbol = String(o.color || o.symbol || (colors ? colors[0] : '')).toLowerCase();
  if (colors && !colors.includes(symbol)) err.push('"color" must be one of "colors"');
  if (!COLORS.includes(symbol)) err.push(`invalid color "${symbol}"`);
  const cost = Number(o.cost); if (!int(cost, 0, 30)) err.push('invalid "cost" (0-30)');
  let symbols = o.symbols == null ? 1 : Number(o.symbols); if (!int(symbols, 0, 5)) err.push('invalid "symbols" (0-5)');
  const rebirthTo = o.rebirthTo == null ? undefined : String(o.rebirthTo).trim();     // Rebirth card: id of its rebirth side
  if (rebirthTo === '') err.push('invalid "rebirthTo" (card id of the rebirth side)');
  let symbolColors;              // optional: one colour per symbol (mixed colours, "ultimate" = Ultimate symbol)
  if (o.symbolColors != null) {
    const sc = Array.isArray(o.symbolColors) ? o.symbolColors.map(x => String(x).toLowerCase()) : null;
    if (!sc || !sc.length || sc.length > 5 || sc.some(x => !(COLORS.includes(x) || SYMBOL_KINDS.includes(x) || (x.startsWith('god-') && COLORS.includes(x.slice(4)))))) err.push('invalid "symbolColors" (1-5 of ' + COLORS.join('/') + '/ultimate/god/god-<colour>)');
    else { symbolColors = sc; symbols = sc.length; }
  }
  const reduction = {};
  if (o.reduction != null) {
    if (typeof o.reduction !== 'object') err.push('"reduction" must be an object like {"red":2}');
    else for (const [k, v] of Object.entries(o.reduction)) { if (!(COLORS.includes(k) || k === 'all' || SYMBOL_KINDS.includes(k)) || !int(Number(v), 0, 10)) err.push(`invalid reduction "${k}"`); else if (Number(v) > 0) reduction[k] = Number(v); }
  }
  let levels = [];
  if (type === 'Magic') levels = [{ cores: 0 }];
  else if (Array.isArray(o.levels) && o.levels.length >= 1 && o.levels.length <= 6) {
    let last = -1;
    for (const L of o.levels) {
      const cores = Number(L && L.cores), bp = L && L.bp != null ? Number(L.bp) : null;
      if (!int(cores, 0, 30) || cores < last) { err.push('levels need ascending whole-number "cores"'); break; }
      const sp = type === 'Spirit' || type === 'Brave' || type === 'Ultimate';
      if (sp && (!int(bp, 0, 99999))) { err.push('every Spirit/Brave/Ultimate level needs a numeric "bp"'); break; }
      levels.push(sp ? { cores, bp } : { cores }); last = cores;
    }
    if ((type === 'Spirit' || type === 'Ultimate') && levels.length && levels[0].cores < 1) err.push(type + ' first level needs at least 1 core');
  } else if (type === 'Nexus' && (o.levels == null || (Array.isArray(o.levels) && !o.levels.length))) levels = [{ cores: 0 }];     // v0.51.2: the Fandom export has no Nexus level data (760 cards): load at LV1 only; tools/compile_effects keeps cards with [LV2]+ text staged
  else if (type === 'Brave' && (o.levels == null || (Array.isArray(o.levels) && !o.levels.length))) levels = [];     // no Spirit-form data yet: only direct combining
  else err.push('"levels" must be a list of 1-6 levels');
  if (err.length) return { errors: err };
  const text = String(o.text || o.desc || '').slice(0, 1500);
  let magic = null;
  if (type === 'Magic') {
    const m = o.magic && typeof o.magic === 'object' ? o.magic : {};
    let timing = Array.isArray(m.timing) ? m.timing.map(x => String(x).toUpperCase()) : null;
    if (!timing) timing = /\bflash\b/i.test(text) ? (/\bmain\b/i.test(text) ? ['MAIN', 'FLASH'] : ['FLASH']) : ['MAIN'];
    if (!timing.length || timing.some(x => !MAGIC_TIMINGS.includes(x))) err2.push('"magic.timing" must be a list of MAIN and/or FLASH');
    const effect = m.effect == null ? null : String(m.effect).toUpperCase();
    if (effect && !MAGIC_FX[effect]) err2.push(`unknown "magic.effect" "${effect}" (use ${Object.keys(MAGIC_FX).join(', ')})`);
    const value = m.value == null ? 0 : Number(m.value);
    if (!int(value, 0, 99999)) err2.push('invalid "magic.value"');
    magic = /** @type {MagicSpec} */ ({ timing: Array.from(new Set(timing)), effect, value });
    if (m.noMain === true) magic.noMain = true;           // v0.44 "(Can't Use in Main)"
    if (m.trashUse != null) {                              // v0.47 "while you control X, you can use this card from the Trash" (+ "when used from the Trash, instead ...", then banish)
      const t = m.trashUse, o2 = {};
      if (!t || typeof t !== 'object' || Array.isArray(t)) err2.push('"magic.trashUse" must look like {"if":{...},"actions":[...]}');
      else {
        if (t.if != null) { const cr = parseCond(t.if); if (cr.error) err2.push('magic.trashUse: ' + cr.error); else o2.if = cr.cond; }
        if (t.actions != null) { const r = parseActionList(Array.isArray(t.actions) ? t.actions : []); if (r.error || !r.actions.length) err2.push('"magic.trashUse.actions": ' + (r.error || 'is empty')); else o2.actions = r.actions; }
        magic.trashUse = o2;
      }
    }
    if (m.oppAttackHand != null) {                         // v0.47 Thunder Counter: "at the start of the opposing Attack Step, by sending N cores from your X Grandwalker Nexus to the Void, pay the cost to use this card from the Hand"
      const h = m.oppAttackHand;
      if (!h || !Number.isInteger(h.gwToVoid) || h.gwToVoid < 0 || h.gwToVoid > 5 || !hasMatch(h.match)) err2.push('"magic.oppAttackHand" must look like {"gwToVoid":2,"match":{"name":[...]}}');
      else magic.oppAttackHand = { gwToVoid: h.gwToVoid, match: h.match };
    }
    if (effect === 'ACTIONS') { const r = parseActionList(Array.isArray(m.actions) ? m.actions : []); if (r.error || !r.actions.length) err2.push('"magic.actions": ' + (r.error || 'is empty')); else magic.actions = r.actions; }
    if (m.by != null) {
      if (typeof m.by !== 'object' || Array.isArray(m.by) || !Object.keys(m.by).length || Object.keys(m.by).some(k => !MAGIC_TIMINGS.includes(k))) err2.push('"magic.by" must look like {"MAIN":{...},"FLASH":{...}}');
      else {
        magic.by = {};
        for (const [k, b] of Object.entries(m.by)) {
          const e2 = b && String(b.effect || '').toUpperCase();
          if (!b || !MAGIC_FX[e2]) { err2.push(`unknown "magic.by.${k}.effect"`); continue; }
          if (!int(Number(b.value == null ? 0 : b.value), 0, 99999)) { err2.push(`invalid "magic.by.${k}.value"`); continue; }
          const o2 = { effect: e2, value: Number(b.value == null ? 0 : b.value) };
          if (e2 === 'ACTIONS') { const r = parseActionList(Array.isArray(b.actions) ? b.actions : []); if (r.error || !r.actions.length) { err2.push(`"magic.by.${k}.actions": ` + (r.error || 'is empty')); continue; } o2.actions = r.actions; }
          if (b.match != null) { if (typeof b.match !== 'object' || [].concat(b.match.name || [], b.match.family || []).some(x => typeof x !== 'string')) { err2.push(`invalid "magic.by.${k}.match"`); continue; } o2.match = b.match; }
          if (b.if != null) { const cr = parseCond(b.if); if (cr.error) { err2.push(cr.error); continue; } o2.if = cr.cond; }
          magic.by[k] = o2;
        }
        if (!magic.timing.every(t => magic.by[t]) ) err2.push('"magic.by" needs an entry for every timing');
      }
    }
  }
  let costAlt = null;
  if (o.costAlt != null) {
    const a = o.costAlt;
    if (!a || typeof a !== 'object' || !int(Number(a.cost), 0, 30)) return { errors: ['invalid "costAlt" (use {"cost":3,"if":{...},"once":true})'] };
    costAlt = /** @type {CostAlt} */ ({ cost: Number(a.cost), once: a.once === true });
    if (a.if != null) { const cr = parseCond(a.if); if (cr.error) return { errors: [cr.error] }; costAlt.if = cr.cond; }
  }
  let brave = null, overCount = null;
  if (type === 'Brave') {             // {"bp":5000,"family":["Ancient Dragon"],"name":[...],"costGe":3}: BP+ and the Brave condition (manual p. 34)
    const b = o.brave;
    const strs = x => x == null || (Array.isArray(x) && x.length <= 6 && x.every(y => typeof y === 'string' && y.trim()));
    if (b == null && levels.length) { /* v0.51.2: no combine data in the Fandom export (460 Braves): loads as a Spirit only and never combines (braveFits needs .brave) */ }
    else if (!b || typeof b !== 'object' || !int(Number(b.bp), 0, 99999) || !strs(b.family) || !strs(b.name) || (b.costGe != null && !int(b.costGe, 0, 30)) || (b.nexus != null && (typeof b.nexus !== 'object' || !b.nexus.name || !strs(b.nexus.name)))) err2.push('a Brave needs "brave": {"bp":5000,"family":[...],"name":[...],"costGe":N,"nexus":{"name":[...]}} (family/name/costGe/nexus optional)');
    else { brave = /** @type {BraveSpec} */ ({ bp: Number(b.bp) }); if (b.family) brave.family = b.family.slice(); if (b.name) brave.name = b.name.slice(); if (b.costGe != null) brave.costGe = b.costGe; if (b.nexus) brave.nexus = { name: b.nexus.name.slice() }; }
  } else if (o.brave != null) err2.push('"brave" is only for Brave cards');
  if (o.overCount != null) {          // {"count":4,"bp":5000}: Over Count condition and BP+ (manual p. 60)
    const a = o.overCount;
    if (type !== 'Spirit' || !a || typeof a !== 'object' || !int(a.count, 1, 30) || !int(Number(a.bp == null ? 0 : a.bp), 0, 99999)) err2.push('invalid "overCount" (use {"count":4,"bp":5000} on a Spirit)');
    else overCount = { count: a.count, bp: Number(a.bp || 0) };
  }
  if (err2.length) return { errors: err2 };
  const image = o.image == null ? '' : String(o.image).trim().slice(0, 120);
  const keywords = (Array.isArray(o.keywords) ? o.keywords : []).map(k => String(k).toUpperCase()).filter(k => KEYWORD_GLOSSARY[k]);
  let mirage = null;
  if (o.mirage != null) { const mc = Number(o.mirage && o.mirage.cost); if (!o.mirage || typeof o.mirage !== 'object' || !int(mc, 0, 30)) return { errors: ['invalid "mirage" (use {"cost": 0-30})'] }; mirage = { cost: mc }; }
  if (mirage && !keywords.includes('MIRAGE')) keywords.push('MIRAGE');
  if (magic && magic.timing.includes('FLASH') && !keywords.includes('FLASH')) keywords.push('FLASH');
  let contractAdvent = null, manifest = null;
  if (o.contractAdvent != null) { const a = o.contractAdvent; if (!a || typeof a !== 'object' || typeof a.family !== 'string' || !a.family || (a.counterGe != null && !int(a.counterGe, 0, 30)) || (a.turn != null && !['YOURS', 'EITHER'].includes(a.turn)) || (a.seal != null && a.seal !== true) || !['Spirit', 'Ultimate'].includes(type)) return { errors: ['invalid "contractAdvent" (use {"family":"Awakened Dragon","counterGe":2,"turn":"YOURS"|"EITHER","seal":true} on a Spirit/Ultimate)'] }; contractAdvent = /** @type {ContractAdventSpec} */ ({ family: a.family, counterGe: a.counterGe || 0, turn: a.turn || 'YOURS' }); if (a.seal) contractAdvent.seal = true; if (!keywords.includes('CONTRACT_ADVENT')) keywords.push('CONTRACT_ADVENT'); if (!keywords.includes('FLASH')) keywords.push('FLASH'); }
  if (o.manifest != null) { const a = o.manifest; if (!a || typeof a !== 'object' || typeof a.name !== 'string' || !a.name || (a.counterGe != null && !int(a.counterGe, 0, 30)) || (a.turn != null && !['YOURS', 'EITHER_ATTACK', 'YOUR_ATTACK'].includes(a.turn)) || (a.ultra != null && a.ultra !== true) || (a.seal != null && a.seal !== true) || (a.ultra && a.seal) || !['Spirit', 'Ultimate'].includes(type)) return { errors: ['invalid "manifest" (use {"name":"Contractor Mitra","counterGe":6,"turn":"YOURS"|"EITHER_ATTACK","ultra":true|"seal":true} on a Spirit/Ultimate)'] }; manifest = /** @type {ManifestSpec} */ ({ name: a.name, counterGe: a.counterGe || 0, turn: a.turn || 'YOURS' }); if (a.ultra) manifest.ultra = true; if (a.seal) manifest.seal = true; if (!keywords.includes('MANIFEST')) keywords.push('MANIFEST'); if (!keywords.includes('FLASH')) keywords.push('FLASH'); }
  /* v0.46 Ultimate summon condition ({{sumcon|...}}): an fxIf condition on the owner, checked for every summon and Advent of the card */
  const ctrlOK = q => [].concat(q).length > 0 && [].concat(q).every(x => x && typeof x === 'object' && ['Spirit', 'Ultimate', 'Both'].includes(x.type) && (x.n == null || int(x.n, 1, 5))
    && (x.colors == null || (Array.isArray(x.colors) && x.colors.length && x.colors.every(y => COLORS.includes(y)))) && (x.costGe == null || int(x.costGe, 0, 20)) && (x.family == null || (typeof x.family === 'string' && x.family))
    && Object.keys(x).every(k => ['n', 'type', 'colors', 'costGe', 'family'].includes(k)));   // v0.56
  let summonIf = null;
  if (o.summonIf != null) { const a = o.summonIf, ok = ['controlName', 'counterGe', 'lifeLe', 'lifeGe', 'soulGe', 'ctrl']; if (!a || typeof a !== 'object' || !Object.keys(a).length || Object.keys(a).some(k => !ok.includes(k)) || (a.ctrl != null && !ctrlOK(a.ctrl))) return { errors: ['invalid "summonIf" (keys: ' + ok.join(', ') + ')'] }; summonIf = Object.assign({}, a); }
  const fx = parseEffects(o.effects); if (fx.error) return { errors: [fx.error] };
  let burst = null;
  if (o.burst != null) { const r = parseBurst(o.burst); if (r.error) return { errors: [r.error] }; burst = r.burst; }
  if (burst && !keywords.includes('BURST')) keywords.push('BURST');
  if (o.residual != null && (!Array.isArray(o.residual) || o.residual.length > 12 || o.residual.some(x => typeof x !== 'string' || !x.trim() || x.length > 400))) return { errors: ['"residual" must be a list of up to 12 printed clauses that are not implemented'] };
  const residual = (o.residual || []).map(x => x.trim());
  let trashTrigger;                                       // v0.47 "when this card is sent to the Trash from the Deck/Hand by the effect of your X: you can add it to the Hand (add), +1 core to a Grandwalker Nexus (gwCore)"
  if (o.trashTrigger != null) {
    const t = o.trashTrigger;
    if (!t || !Array.isArray(t.from) || !t.from.length || t.from.some(x => !['deck', 'hand'].includes(x)) || !hasMatch(t.by) || (t.add != null && typeof t.add !== 'boolean') || (t.gwCore != null && (!Number.isInteger(t.gwCore) || t.gwCore < 0 || t.gwCore > 3)))
      return { errors: ['invalid "trashTrigger" (use {"from":["deck"],"by":{"name":[...]},"add":true,"gwCore":1})'] };
    trashTrigger = { from: t.from.slice(), by: t.by, add: t.add === true, gwCore: t.gwCore || 0 };
  }
  if (o.soulMagic != null && (type !== 'Magic' || !COLORS.includes(o.soulMagic))) return { errors: ['invalid "soulMagic" (a colour, on Magic cards only)'] };   // v0.64 Soul Magic
  if (o.trueRelease != null && (o.trueRelease !== true || !['Spirit', 'Nexus'].includes(type) || !Array.isArray(o.levels) || o.levels.length < 2)) return { errors: ['invalid "trueRelease" (true, on Spirit / Nexus cards with an LV2)'] };   // v0.66 True Release
  const exSym = o.ex_symbols != null ? Number(o.ex_symbols) : o.exSymbols != null ? Number(o.exSymbols) : 0;   // data name ex_symbols (Fandom export), exSymbols when a parsed card is parsed again (localStorage)   // v0.69 Legacy: EX symbols of the card (each EX-symbol card in the Trash pays one reduction symbol of a Legacy card)
  if (!int(exSym, 0, 5)) return { errors: ['invalid "ex_symbols" (0-5)'] };
  if (o.legacy != null && (o.legacy !== true || !['Spirit', 'Nexus', 'Magic'].includes(type))) return { errors: ['invalid "legacy" (true, on Spirit / Nexus / Magic cards)'] };   // v0.69 Legacy
  const families = (Array.isArray(o.families) ? o.families : []).map(f => String(f).slice(0, 40)).slice(0, 8);
  const block = o.block == null ? '' : String(o.block).trim().toUpperCase().slice(0, 8);
  if (block && !/^[A-Z0-9]+$/.test(block)) return { errors: ['invalid "block" (letters/digits only, e.g. "A" or "76")'] };
  return { card: { id, name, type, symbol, colors, cost, symbols, symbolColors, rebirthTo, rebirthSide: o.rebirthSide === true, reduction, levels, text, keywords, families, image, block, magic, costAlt, mirage, effects: fx.effects, burst, fxComplete: o.fxComplete === true, contract: o.contract === true, soulReduce: o.soulReduce === true, revive: o.revive === true, trashSoul: o.trashSoul === true, trashHand: typeof o.trashHand === 'string' && o.trashHand.trim() ? o.trashHand.trim().slice(0, 40) : undefined, trashTrigger, trashSymbols: o.trashSymbols === true, handUnaffected: o.handUnaffected === true, trashUnaffected: o.trashUnaffected === true || undefined, highSpeed: o.highSpeed === true, soulMagic: o.soulMagic || undefined, trueRelease: o.trueRelease === true || undefined, legacy: o.legacy === true || undefined, exSymbols: exSym || undefined, contractAdvent, manifest, summonIf, residual, brave, overCount } };
}
function registerImported(c) {
  CARDS_VER++;
  defCard({ id: c.id, name: c.name, type: c.type, symbol: c.symbol, colors: c.colors || undefined, cost: c.cost, symbols: c.symbols, symbolColors: c.symbolColors || undefined, rebirthTo: c.rebirthTo || undefined, rebirthSide: c.rebirthSide === true, reduction: c.reduction, levels: c.levels,
    keywords: c.keywords, families: c.families, image: c.image || '', block: c.block || '', imported: true, magic: c.magic || undefined, costAlt: c.costAlt || undefined, mirage: c.mirage || undefined,
    effects: c.effects || undefined, burst: c.burst || undefined, contract: c.contract === true, soulReduce: c.soulReduce === true, revive: c.revive === true, trashSoul: c.trashSoul === true, trashHand: c.trashHand || undefined, trashTrigger: c.trashTrigger || undefined, trashSymbols: c.trashSymbols === true, handUnaffected: c.handUnaffected === true, trashUnaffected: c.trashUnaffected === true || undefined, highSpeed: c.highSpeed === true || undefined, soulMagic: c.soulMagic || undefined, trueRelease: c.trueRelease === true || undefined, legacy: c.legacy === true || undefined, exSymbols: c.exSymbols || undefined, contractAdvent: c.contractAdvent || undefined, manifest: c.manifest || undefined, summonIf: c.summonIf || undefined, lvBase: c.type === 'Ultimate' ? 3 : undefined, brave: c.brave || undefined, overCount: c.overCount || undefined,
    implemented: c.type === 'Magic' ? !!(c.magic && (c.magic.effect || c.magic.by)) && !(c.residual || []).length : (!c.text || (c.legacy === true && !c.text.replace(/^[ \t]*\(Legacy\)[ \t]*(?:\n|$)/m, '').trim()) || (((!!c.effects || !!c.burst || !!c.brave || !!c.overCount) || c.highSpeed === true || c.colors != null) && c.fxComplete && !(c.residual || []).length)),    // v0.104.0: a data-field mechanic (High Speed flag, treated-as colours) is a payload of its own — keep in step with tools/card_counts.py complete() (test PA05); clause coverage guarded by the A1 `residual` discipline
    partial: (c.residual || []).length > 0 || ((!!c.effects || !!c.burst || !!c.manifest || !!c.brave || !!c.overCount) && !c.fxComplete), residual: (c.residual || []).slice(),      // v0.79 (A1): a residual list alone marks a partial card (stats-only cards included)
    desc: c.text || 'Vanilla card (no effect text).' });
  IMPORTED[c.id] = c;
}
function saveImported() { try { localStorage.setItem(CARDS_KEY, JSON.stringify(Object.values(IMPORTED))); } catch (e) { /* blocked */ } }
function importCards(text) {
  let data; try { data = JSON.parse(text); } catch (e) { return { ok: 0, bad: [], fatal: 'This file is not valid JSON.' }; }
  if (data && !Array.isArray(data) && Array.isArray(data.cards)) data = data.cards;
  if (!Array.isArray(data)) return { ok: 0, bad: [], fatal: 'Expected a JSON list of cards (or {"cards":[...]}).' };
  if (data.length > 3000) return { ok: 0, bad: [], fatal: 'Too many cards in one file (max 3000).' };
  let ok = 0; const bad = [];
  data.forEach((o, i) => { const r = parseCard(o); if (r.card) { registerImported(r.card); ok++; } else bad.push(`#${i + 1}${o && o.id ? ' (' + o.id + ')' : ''}: ${r.errors.join('; ')}`); });
  saveImported();
  return { ok, bad };
}
function clearImported() {
  CARDS_VER++;
  for (const id of Object.keys(IMPORTED)) { delete CARDS[id]; delete PLAYER_DECK[id]; }
  IMPORTED = {}; saveImported(); registerPack(); saveDeck();
}
/*PACK_START*//*PACK_END*/
const PACK_IDS = new Set();
function registerPack() {                                // built-in Saga 15-17 pack: always available, not removable, can be overridden by an import
  for (const o of BUILTIN_PACK) {
    const r = parseCard(o); if (!r.card) continue;       // cards whose data does not parse are skipped
    registerImported(r.card); delete IMPORTED[r.card.id];
    CARDS[r.card.id].imported = false; CARDS[r.card.id].pack = true; PACK_IDS.add(r.card.id);
  }
}
registerPack();
/*TOKENS_START*//*TOKENS_END*/
/* Token cards (v0.35): registered as Spirits with token:true ("Token Spirit" on the card); never listed in the deck builder or allowed in a Deck */
const TOKEN_IDS = new Set();
function registerTokens() {
  for (const o of BUILTIN_TOKENS) {
    if (o.type !== 'Token Spirit') continue;
    const r = parseCard(Object.assign({}, o, { type: 'Spirit' })); if (!r.card) continue;
    registerImported(r.card); delete IMPORTED[r.card.id];
    Object.assign(CARDS[r.card.id], { imported: false, token: true });   // not a pack card: never in the deck builder or the 63-card pack audit
    TOKEN_IDS.add(r.card.id);
  }
}
registerTokens();
(function loadImported() {
  try { const a = JSON.parse(localStorage.getItem(CARDS_KEY)); if (Array.isArray(a)) a.forEach(o => { const r = parseCard(o); if (r.card) registerImported(r.card); }); } catch (e) { /* ignore */ }
})();

