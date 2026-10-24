# Card images online (Aegis-style) — plan

## Goal
Show **official Battle Spirits card art** in Aeterna the way aegis-digi.online does: a
server-side mirror + a client fallback chain. Player-supplied images (the existing IndexedDB
store) stay the **top-priority override**; the offline single-file game keeps working unchanged.

## Why this is possible cheaply
- `data/cards/saga-*.json` already carries an `image` field per card (6,361 of 6,890 cards):
  the **Fandom wiki `File:` name** (e.g. `BS76-001.png`, `Gora.jpg`). It was built from
  `data/index/saga_card_index.json` by `tools/import_fandom.py`.
- The MediaWiki API resolves a `File:` name to the full static URL in one call:
  `https://battle-spirits.fandom.com/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url&format=json&formatversion=2`
  → `https://static.wikia.nocookie.net/battle-spirits/images/d/df/BS76-001.png/revision/latest?cb=…`
- The Fandom wiki is an already-approved read-only source (CLAUDE.md).

## Architecture (mirrors Aegis, adapted to the single-file game)
- **Server** (`apps/server`): a `/assets/card-images/<filename>` route that serves the file
  from a local mirror directory, downloading + caching it from the wiki **on demand** on the
  first request. The mirror dir is git-ignored (build artifact, not committed).
- **Client** (`apps/web`): `cardImgSrc(id)` returns the first of:
  1. the player's own image (`IMG[id]`, IndexedDB blob) — unchanged, always wins;
  2. `${onlineOrigin()}/assets/card-images/<card.image>` — only when an online server is present;
  3. nothing → the existing text/colour placeholder (graceful fallback, no broken image).
  Wired into `imgCls`/`imgSty` (hand, field, deck builder, library, online board) and
  `cardFaceHTML` (zoom, strips, details).

## Phases
- **P1 (this session, v0.112.0):** server mirror route + client fallback chain + tests.
  Online matches show official art; offline stays player-supplied-only.
- **P2 (later):** bulk pre-fetch tool (`tools/fetch_card_images.mjs`, concurrency + resume)
  so a deploy can warm the mirror; optional `cwebp` re-encode to 430px WebP for bandwidth.
- **P3 (later, optional):** offline hotlink via a committed URL manifest, alternate-art
  printings, per-language art — only if the owner wants them.

## Decisions
- **Online only for now.** The offline file cannot bundle ~6,300 images (size), and the wiki
  static URL needs a resolved hash path (not derivable from the filename), so offline hotlink
  needs a committed manifest first (P3).
- **No re-encode in P1.** Serve the wiki's original PNG/JPG. `cwebp`/`sharp` are unavailable
  (npm/pip blocked); P2 adds re-encoding if bandwidth matters.
- **On-demand + cache**, not a cron job. The mirror fills as cards are viewed; a first view
  costs one wiki fetch. A bulk warm-up is P2.

## Reversibility
- All changes are additive: the route is opt-in (a `cardImages` dep on `createApi`), the
  client fallback only activates when an online origin exists, and the player-supplied path
  still takes precedence. Removing the dep or the fallback reverts to today's behaviour.
