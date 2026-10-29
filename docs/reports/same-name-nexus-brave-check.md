# Same-name check: Nexus and Brave reprints

First pass was read-only; the later "Update" sections below changed card data after checking the official images (current state is in the last section).

- Nexus: 20 same-name groups checked against the Fandom export. Level thresholds are keyed per wiki page (page-title hash), so an original and its RV reprint share one value. Not verifiable without card images.
- Brave: 7 groups with differing data. Combine condition and braved BP are keyed per page title, so they are shared too. Several reprints differ in cost or BP from the original (Sabershark, Reticle-Arms, Poppor, Chihyu, Oborogissha); the cause could not be proven from text sources.
- God icon: BS51-CP/RV, BS46-081 and BS71-RV005 differ from the source only by the god icon in the reduction. This is the intentional drop (`tools/import_fandom.py:75`, issue #5), not a data error.
- BS07-051: text differs from the source wording; looks like a deliberate rewrite, not checked further.
- Staged-only ids (e.g. BS51-CP03) live in `data/import`, not `data/cards`.

Open at that point: confirm the Nexus/Brave values against card images (done in the updates below).

## Update: Brave reprints against per-id source rows

The five Brave names with differing cost/BP were compared with the per-card rows in `data/sources/fandom-cards-bs01-bs77.json` (cost, reduction, LV1 BP, cores): all 10 library cards match their own source row. The differences are real per-printing data, not an import error. (Sabershark BS10-072 3000 BP vs BS39-RV026 5000 BP with different text, etc.)

Still unverified: the `brave` field (`bp`, `costGe`). It comes from `fandom-brave-combine.tsv`, keyed by page title, so BS39-RV026 carries `brave {bp: 3000, costGe: 5}` copied from the original although its printed text is different. Whether the RV combine condition differs needs the card image or the wiki page.

Why the wiki could not be read in this session: the first attempts were refused at the proxy (host not allowed); later the host answered but returned HTTP 403 to non-browser clients (www.fandom.com the same, `static.wikia.nocookie.net` reachable), so it is the site's bot protection, not only the session policy. No workaround was attempted.

## Update: checked against the official card images (battlespirits.com `images/cardlist/<id>.webp`)

Fandom stays blocked (Cloudflare challenge); the official card database serves the card images, so the Brave reprints were read from the images. Result: the page-level combine data was wrong for four RV reprints (fixed in data, test `tests/unit/brave_reprint_combine.test.mjs`):

| Card | Was | Printed on the card |
|---|---|---|
| BS39-RV026 Sabershark | +3000, Cost 5+ | +6000, Cost 3+ (both sides) |
| BS38-RV024 Kacrane | +5000, Cost 5+ | +5000, Cost 4+ (both sides) |
| BS39-RV027 Reticle-Arms | +2000, Cost 3+ | +3000, Cost 3+ |
| BS38-RV025 Poppor | +2000, Cost 4+ | +2000, Cost 3 or less (new `brave.costLe`) |

Checked and correct: BS10-072, BS31-081, BS13-057, BS50-RV009, BS59-RV006.

Known limit: BS38-RV022 Phoenix-Cannon prints Cost 5+ on the right and Cost 3+ on the left; the engine has one condition per Brave, so it keeps `costGe: 3` (left side only).

## Update: Nexus reprints against the card images

All 20 RV Nexus cards and 9 of their originals were read from the official images. The RV cards carry their own (revised) text, which the library already has; only the Lv2 core threshold was copied from the original. Nine RV cards print a different threshold (fixed in data, test `NEXUS-RV`):

| Card | Was | Printed |
|---|---|---|
| BS38-RV026 The Star Altar | 2 | 1 |
| BS38-RV030 The Octant Small Shrine | 3 | 1 |
| BS38-RV031 The Great Wall of the White Shield | 3 | 2 |
| BS38-RV034 Unfinished Ancient Battleship: Keel | 3 | 2 |
| BS38-RV035 Unfinished Ancient Battleship: Stern | 3 | 2 |
| BS39-RV028 The Table Mountain Range | 1 | 2 |
| BS39-RV030 The House of the Idol | 1 | 3 |
| BS39-RV031 The Doomsday Drawn Canvas | 3 | 2 |
| BS39-RV033 The Moonlight Gathering Tower | 2 | 1 |

The other 11 RV cards match. All 20 original Nexus cards of those groups were read as well and match the data (the nine listed above, plus BS32-068, BS10-082, BS10-093, BS12-061, BS12-066, BS12-069, BS12-071, BS13-061, BS13-063, BS13-068, BS13-072).

## Update: remaining Brave originals and two-sided Braves

Brave images with combine data were read in montage and zoom passes (bp, printed condition). Mismatches fixed in data (test `BRAVE-RV`): BS38-RV023 Burn-Crow printed +4000 (was 2000), BS39-RV025 Beo-Wulf +5000 (was 3000), BS51-CP05 Cost 4+ and +4000 (was Cost 5+ / +5000), BS71-RV006 prints family 動玩 (its own `families` is Devotee / Puppet Beast, so the combine family is Puppet Beast), not Cost 4+ (staged only, no test). Confirmed by zoom: BS34-059 (+6000, "no effect text" condition), BS12-059 (Cost 3+, +4000), BS13-056, BS20-058, BS27-068, BS66-063 and the BS66/BS67 cards. Brave originals BS10-062, BS10-069, BS11-059 and BS13-058 were also read and match. Not confirmed: BS44-10THX01/02 (image name unknown); the Rush-text cards in the BS20-BS27 range were only read at montage size, not zoomed. BS51-CP05 is staged only (no test).

Condition types the data does not model (the card prints them, the engine ignores them): "no effect text" (BS10-061/064/067/070/073/076, BS34-059) fits any Spirit in the engine. BS51-RV005..009 print a colour plus a Grandwalker Nexus but hold other `costGe` values (staged only, not corrected). BS12-059 and BS34-059 carry `families` Fusion Beast (printed 異合); BS47-093 lists Fusion Beast too, but its printed condition was not compared. The engine already has a `match.noText` predicate (`02c-effects-parse.js`), so the "no effect text" Brave condition would be cheap to model later.

Two-sided (left/right) Braves print "右合体条件" and "左合体条件" bars (or one "左右合体条件" bar) and connect to two Spirits, with separate "while on the right / left" effects. Read from images: BS38-RV022 (R Cost 5+, L Cost 3+, +3000; the data stores the left condition 3+), BS38-RV023 (R 5+, L 4+, +4000; the data stores the right condition 5+), BS38-RV024 (4+/4+, +5000), BS38-RV025 (3 or less both, +2000), BS39-RV024 (3+/3+, +4000), BS39-RV025 (5+/5+, +5000), BS39-RV026 (3+/3+, +6000), BS39-RV027 (3+/3+, +3000), BS45-080 (4+/4+, +3000). About 40 cards print "Right Brave" / "Left Brave" text. The engine has one `s.brave` per Spirit and one condition per Brave (`braveFits`, `combineBrave`, `braveRecheck`, `shedBrave`, `separateBrave`, UI and replay all assume that), so these Braves still combine with a single Spirit. Supporting two Spirits needs a left/right slot model, and the exact rules (BP on both Spirits? what happens when one Spirit leaves? separation) are not in the repo; the places checked found only card text, no rule page: the local Fandom export (`data/sources/fandom-cards-bs01-bs77.json`, 36 cards with "Right/Left Brave" wording, e.g. BS37-074, BS38-CP01, BS39-049), one web search, and the live Fandom wiki (Cloudflare-blocked). The card text shows that a Brave can have Spirits braved on its left and right and that it does not exhaust, but not the combine, separation or leave rules. Those must be confirmed before the engine is changed.
