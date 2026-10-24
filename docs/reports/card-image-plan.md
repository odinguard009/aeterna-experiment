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
- **P1b (v0.113.0):** the static Cloudflare Pages deployment. The Pages site has no Node process,
  so a Pages Function (`functions/assets/card-images/[file].js`) mirrors the same route at the edge
  and the deploy stages `functions/` beside `index.html`. Official art now loads on the Pages URL.
- **P1c (v0.114.0):** switch the art source to the **official battlespirits.com card database**.
  The Fandom `File:` names were stale for most old sagas (about 5 of 18 sampled cards resolved), so
  the client now keys on the **card id** and the Function + Node server proxy the directly-derived
  official URL `/images/cardlist/<card-id>.webp?v2` (WebP, uniform size — this also fixed the
  Ultimate-card crop in the grid). The wiki is no longer the image source; the `image` field stays
  in the card data as metadata only.
- **P2 (later):** a bulk pre-fetch tool (concurrency + resume) so a deploy can warm the mirror;
  optional `cwebp` re-encode to 430px WebP for bandwidth.
- **P3 (later, optional):** offline hotlink via a committed URL manifest, alternate-art
  printings, per-language art — only if the owner wants them.

## Decisions
- **Online only for now.** The offline file cannot bundle ~6,300 images (size), so offline art
  needs a committed URL manifest first (P3).
- **Official source, not the wiki (v0.114.0).** `battlespirits.com/images/cardlist/<id>.webp?v2`
  is derived from the card id and serves every card in uniform WebP, so no MediaWiki API round-trip
  and no stale-name gaps. `cwebp`/`sharp` re-encode is no longer needed (the official art is already WebP).
- **On-demand + cache**, not a cron job. The mirror fills as cards are viewed; a first view
  costs one upstream fetch. A bulk warm-up is P2.

## Reversibility
- All changes are additive: the route is opt-in (a `cardImages` dep on `createApi`), the
  client fallback only activates when an online origin exists, and the player-supplied path
  still takes precedence. Removing the dep or the fallback reverts to today's behaviour.
