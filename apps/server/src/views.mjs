/* ---------------------------------------------------------------------
   M6 VIEWS (docs/ai/monorepo-plan.md "hidden cards never leave the server", v0.105.0): everything a room viewer
   receives goes through seat-filtered frames of the engine's boardSnapshot(viewerKey) (packages/engine/src/15b-replay.js):
   the viewer's own hand ids, every other hand as a count, the opponent's face-down Burst as "set", decks as lengths.
   Pure: no engine import, no packages - the engine facade is injected, tests feed it directly.
   --------------------------------------------------------------------- */
/** The plain-data frame one viewer receives (the JSON round-trip drops every vm-realm reference of the live G). */
export function frameFor(E, viewerKey) {
  return JSON.parse(JSON.stringify(E.boardSnapshot(viewerKey)));
}
/** The hidden-card guarantees the wire must never break: for every side that is NOT the viewer, Hand and Burst are
 *  only a count / "set" and the Deck is only a length. Returns the leak descriptions (empty = clean frame). */
export function leaks(frame, viewerKey) {
  const out = [];
  for (const k of ['player', 'opponent']) {
    const s = frame.p[k];
    if (k === viewerKey) continue;
    if (Array.isArray(s.hand)) out.push(k + ': hand reveals ids');
    if (s.burst && s.burst !== 'set') out.push(k + ': burst reveals ' + s.burst);
    if (typeof s.deck !== 'number') out.push(k + ': deck reveals its contents');
  }
  return out;
}
