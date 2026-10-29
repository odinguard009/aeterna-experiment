# Same-name check: Nexus and Brave reprints

Read-only check; no card data was changed.

- Nexus: 20 same-name groups checked against the Fandom export. Level thresholds are keyed per wiki page (page-title hash), so an original and its RV reprint share one value. Not verifiable without card images.
- Brave: 7 groups with differing data. Combine condition and braved BP are keyed per page title, so they are shared too. Several reprints differ in cost or BP from the original (Sabershark, Reticle-Arms, Poppor, Chihyu, Oborogissha); the cause could not be proven from text sources.
- God icon: BS51-CP/RV, BS46-081 and BS71-RV005 differ from the source only by the god icon in the reduction. This is the intentional drop (`tools/import_fandom.py:75`, issue #5), not a data error.
- BS07-051: text differs from the source wording; looks like a deliberate rewrite, not checked further.
- Staged-only ids (e.g. BS51-CP03) live in `data/import`, not `data/cards`.

Open: confirm the Nexus/Brave values against card images when available.

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
