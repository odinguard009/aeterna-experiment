#!/usr/bin/env node
// Lane order (owner, 2026-10-21; replaces the 2 K : 1 U/I cycle of 2026-10-20):
//   1. phase F: while any F1-F5 item is listed in docs/ai/roadmap-open.md -> U/I;
//   2. S1 Standard Magic: while the "- **S1 " item is listed -> K (make every Standard card playable first);
//   3. U/I first: while the "- **U/I queue:**" line still names an item -> U/I;
//   4. then K (Standard block A first, then the other blocks).
// The lane of a release is still written as the first bullet of its CHANGELOG.md section ("- Lane: K" or "- Lane: U/I");
// lanesOf() reads it for reports. Prints one line: "LANE K|U/I (reason)". Exit code is always 0. The session takes the
// first ready item of that lane; if the lane has no ready item (blocked, or a UI item without an approved design) it
// takes the other lane's first ready item and writes the Lane: of what it actually did.
// Usage: node tools/lane_next.mjs   (called by tools/session_start.sh)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function lanesOf(changelog) {
  const out = [];
  const parts = changelog.split(/^## v\d+\.\d+\.\d+\s*$/m).slice(1);
  for (const body of parts) {
    const m = body.match(/^- Lane: (K|U\/I)\s*$/m);
    out.push(m ? m[1] : 'U/I');
  }
  return out; // newest first
}

export function uiQueue(roadmap) {
  const m = roadmap.match(/^- \*\*U\/I queue:\*\*(.*)$/m);
  if (!m) return [];
  const body = m[1].replace(/\(.*?\)/g, '').trim();
  if (!body || /^(none|empty|-)\.?$/i.test(body)) return [];
  return body.split(/[,;]/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
}

// Owner hold (2026-11-03): item G of roadmap-open.md starts with "- **Accepted, ON HOLD.**" until the owner says start;
// while it is there no K item is taken (U/I items still are). Delete that line to lift the hold.
export function kHold(roadmap) {
  return /^- \*\*Accepted, ON HOLD\.\*\*/m.test(roadmap);
}

export function nextLane(_changelog, roadmap) {
  const hold = kHold(roadmap);
  const k = (why) => (hold ? { lane: 'HOLD', why: 'owner hold on Lane K (roadmap-open.md item G); take no K item' } : { lane: 'K', why });
  if (/^- \*\*F[1-5] /m.test(roadmap)) return { lane: 'U/I', why: 'phase F is still open' };
  if (/^- \*\*S1 /m.test(roadmap)) return k('S1 Standard Magic is still open');
  const q = uiQueue(roadmap);
  if (q.length) return { lane: 'U/I', why: `U/I queue first: ${q[0]} next, ${q.length} left` };
  return k('U/I queue is empty: cards, Standard first');
}

/* Windows note (2026-10-23): `file://` + a bare argv path never matched on Windows (no file:/// + slashes), so the tool
   printed nothing; normalize through pathToFileURL so session_start.sh shows the lane there too (tests/unit/lane_order.test.mjs). */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = nextLane(readFileSync('CHANGELOG.md', 'utf8'), readFileSync('docs/ai/roadmap-open.md', 'utf8'));
  console.log(r.lane === 'HOLD' ? `LANE HOLD (${r.why})` : `LANE ${r.lane} (${r.why}; other lane when this one has no ready item)`);
}
