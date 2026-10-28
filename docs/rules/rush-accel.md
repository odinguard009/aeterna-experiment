# Rush and Accel: what the sources say (v0.179.0)

Own-words notes; no wiki text is copied. Sources read: the Fandom pages "Rush" and "Accel" (MediaWiki API wikitext through TinyFish; the normal pages are bot-blocked) and the official Standard Comprehensive Rules PDF (asia-en.battlespirits.com/pdf/comprehensive-rules-standard.pdf).

## The PDF
It has no Rush or Accel section. It only fixes how reduction symbols work (2-3): the icons around a cost are reduction symbols, the cost drops by the number of matching symbols on your Field, capped at the number of icons on the card, and the reduction cannot be declined. Summon follows the same rule (11-1-1-4-1).

## Accel notation
- A printed `Cost X` followed by coloured core icons: X is the full cost, each icon is one reduction symbol of that colour.
- The Fandom export keeps `{{Accel|Cost X ()}}` but drops the icons. They survive on the wiki page as core images.
- `tools/accel_reductions.py` reads saved API answers and writes only derived facts (card name -> cost + reduction colours) to `data/sources/accel-reductions.json` (127 of 134 library Accel cards; 9 rows have no icon). `tools/compile_v2.py` (`compile_accel`) uses it; a card without a row stays in review. `tools/accel_apply.mjs` adds the reduction to the Accel effects written by hand earlier.
- Engine behaviour (reduction, Removed Zone, Flash also in Main) is unchanged: `packages/engine/src/02j-effects-accel.js`.

## Rush
- Single colour: `{{Rush|Red}}` - while you have a symbol of that colour, the effects listed after it also activate (after the main body). Already supported (`hasSymbol`).
- Several colours (`Red/Purple`, 17 of the 47 blocked cards) and `Ultimate` / `God` as the "colour": **not readable from the sources.** The Rush page does not say whether one listed colour is enough or all are needed, nor how a two-symbol card counts. Not guessed; those cards stay blocked until a source says it.
- Measured: the 20 single-colour Rush cards still fail on their body sentences (not on Rush), so Rush opens no card in v0.179.0.
