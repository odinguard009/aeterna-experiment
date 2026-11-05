/* v572 (Lane K) Rebirth: a Spirit / Nexus card with `rebirthTo` can flip to its back face (Side B) on the Field.
   The back faces that run are data/cards/rebirth-b.json: registered here as NON-enumerable CARDS entries (never in a deck, the Library, the counts or a pack audit).
   A flip swaps the instance id to the back-face id (cores, exhausted state, Soul, Braves stay) and remembers the front id in inst.baseId;
   a card that is no longer on the Field is turned back to its front face (rebirthSweep, run after every fireFx batch). */
/*REBB_START*//*REBB_END*/
const REBIRTH_B_IDS = new Set();
function registerRebirthB() {
  for (const o of BUILTIN_REBB) {
    const r = parseCard(o); if (!r.card) continue;
    registerImported(r.card); delete IMPORTED[r.card.id];
    const id = r.card.id; CARDS[id].imported = false; CARDS[id].pack = true; CARDS[id].rebirthSide = true;
    const d = Object.getOwnPropertyDescriptor(CARDS, id); Object.defineProperty(CARDS, id, { value: d.value, writable: true, configurable: true, enumerable: false });
    REBIRTH_B_IDS.add(id);
  }
}
registerRebirthB();
/** the back face id a field card can flip to now (null when it has none that runs, or it is already flipped) */
function rebirthTarget(s) { const k = s && CARDS[s.id]; return k && k.rebirthTo && !s.baseId && CARDS[k.rebirthTo] && REBIRTH_B_IDS.has(k.rebirthTo) ? k.rebirthTo : null; }
function rebirthFlip(p, s) {
  const bid = rebirthTarget(s); if (!bid || !(p.spirits.includes(s) || p.nexus.includes(s))) return false;
  const nm = CARDS[s.id].name; s.baseId = s.id; s.id = bid; s.flipTurn = G.turnNo; s.lv2Turn = false; s.lvHighTurn = false; s.lv1Turn = false;
  G.rbN = (G.rbN || 0) + 1; log(`${poss(p)} ${nm} flips to ${CARDS[bid].name} (Rebirth).`); return true;
}
function rebirthSweep() {
  if (!G || !G.rbN) return;
  let left = 0;
  for (const p of Object.values(G.p)) {
    const on = new Set(p.spirits.concat(p.nexus));
    const undo = i => { if (i && i.baseId) { i.id = i.baseId; delete i.baseId; delete i.flipTurn; } };
    for (const key of Object.keys(p)) { const z = p[key]; if (Array.isArray(z) && z !== p.spirits && z !== p.nexus) for (const i of z) { if (i && typeof i === 'object' && i.baseId) undo(i); } }
    for (const f of on) { for (const u of f.under || []) undo(u); if (f.baseId) left++; }
    for (const f of on) { if (f.brave && f.brave.baseId) undo(f.brave); }
  }
  G.rbN = left;
}
