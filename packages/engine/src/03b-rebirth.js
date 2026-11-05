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
  const toSp = p.nexus.includes(s) && CARDS[bid].type === 'Spirit';      // v573 a Nexus whose back face is a Spirit: "putting your Soul Core onto it" (a Spirit needs a core)
  if (toSp && totalCores(s) < 1 && !soulSource(p)) return false;
  const nm = CARDS[s.id].name; s.baseId = s.id; s.id = bid; s.flipTurn = G.turnNo; s.lv2Turn = false; s.lvHighTurn = false; s.lv1Turn = false;
  if (toSp) {
    removeFrom(p.nexus, s); p.spirits.push(s);
    if (totalCores(s) < 1) { const src = soulSource(p); if (src === 'trash') p.trashCores.soul = false; else if (src === 'reserve') p.reserve.soul = false; else src.soul = false; s.soul = true; log(`${poss(p)} Soul Core is put onto ${CARDS[bid].name}.`); }
  }
  G.rbN = (G.rbN || 0) + 1; log(`${poss(p)} ${nm} flips to ${CARDS[bid].name} (Rebirth).`); return true;
}
/** v573 "Return to Prime": a flipped Spirit that was a Nexus flips back and is deployed as that Nexus (its cores go to the Reserve, the Soul Core stays, Braves are shed) */
function rebirthUnflip(p, s) {
  if (!s || !s.baseId || !p.spirits.includes(s) || !CARDS[s.baseId] || CARDS[s.baseId].type !== 'Nexus') return false;
  const nm = CARDS[s.id].name; removeFrom(p.spirits, s); p.reserve.n += s.cores; s.cores = 0; shedBrave(p, s, p.trash);
  s.id = s.baseId; delete s.baseId; delete s.flipTurn; p.nexus.push(s); log(`${poss(p)} ${nm} flips back to ${CARDS[s.id].name} and is deployed (Return to Prime).`); return true;
}
/** v573 STATIC REBIRTH_ON_LEAVE: "when it would leave the Field due to an opposing effect, you can flip (and deploy) it" (a replacement; the flip is automatic). True = the card stays. */
function rebirthLeave(p, s) {
  if (!G || !G.fxBy || G.fxBy === p.key || !(p.spirits.includes(s) || p.nexus.includes(s))) return false;
  if (!fxEntries(s).some(({ e }) => e.trigger === 'STATIC' && e.flag === 'REBIRTH_ON_LEAVE' && (!e.lv || e.lv.includes(lvNo(s))))) return false;
  const back = !!s.baseId, ok = back ? rebirthUnflip(p, s) : !!rebirthTarget(s) && rebirthFlip(p, s);
  if (ok && !back && G.evQ) G.evQ.push({ type: 'REBORN', key: p.key, inst: s });      // Count +1 and (When Reborn) resolve after the effect (08-battle)
  return ok;
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
