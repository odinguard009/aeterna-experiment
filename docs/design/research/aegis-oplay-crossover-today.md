# Research: Aegis, Oplay, CrossOver and Aeterna today (2026-11-01)

Purpose: ground the three direction slices in `docs/design/slices/`. Observations only; no assets, text or art are copied. Sources: `docs/aegis-study.md`, `docs/design/mockup-v14.html` idea table, the Oplay tutorial board and `/play` page seen in the browser pane (no account), the built Aeterna v0.205.0 at 375x812.

## Aeterna today (phone, 375x812)
- Home: hero, two big buttons, "continue" strip, card of the day, five-tab bar (Home, Play, Decks, Library, Learn). Same skeleton as Oplay and Aegis, which is why it reads as a copy.
- Battle: dense text rows (Banished, Void, Count, Deck, Hand, Res) in a table-like header, empty dashed placeholders, a long step band that does not fit (`START / CO...`), board wider than the viewport on the right, no art, no hand fan. Everything has equal weight, so nothing says "what do I do now".
- Deckbuilder: table-like list, small tiles, filters hidden behind buttons (see mockup-v14 rows for the planned fix).

## Aegis (practice vs bot works signed out)
Keep as usability lessons: one big primary action coloured by phase; legal targets glow; inspect sheet on long press; hand as a fan with lift; phone layout designed on its own (opponent strip top, you below, round End-turn button).
Do differently: no illustrated mat with corner piles copied; no same lobby (hero, mode tiles, tab bar).

## Oplay (One Piece Card Game simulator)
Keep: full-bleed board with a subtle tint per side; pill info tags (name, clock, hand count); guided coach marks in the tutorial; one cream "End turn" pill; mode list (Ranked, Friendly, Solo vs AI, Private).
Do differently: do not use hero then tiles then five-tab lobby; no pill tags in the same spots; no cream-on-dark button; our own coach-mark wording and shape.

## CrossOver (console Battle Spirits game)
Keep as mood: graphite board, side colours, cut corners, skewed bars, turn ribbons, attack beam, core gems, Life shattering as the big payoff.
Do differently: nothing from its art or logos; shapes are redrawn, names are ours.

## What the owner asked for (the "shadow")
Modern and easy like Oplay and Aegis, but with Aeterna's own identity; Battle and Deckbuilder first on phone; every action reachable by thumb; motion that makes attacks and Life loss feel good.

## Zone budget (every slice must fit all of it at 360 px wide)
Per side: Life, Reserve, Count, Trash, Deck, Void, Banished, Burst/Mirage, Soul State, Nexus row (3), Spirit row (5, cores on spirits), hand (6), step band (7 steps), NEXT. Pile counts may collapse, but every zone stays reachable in at most one tap.

## Originality ledger
| Source | Usability lesson we keep | What we do differently |
|---|---|---|
| Aegis | big phase-coloured action, legal glow, inspect sheet, hand fan | own board, no corner-pile mat, own lobby order |
| Oplay | full-bleed board, info pills, coach marks, short mode list | no hero+tiles+tabs lobby, own tags and button shape |
| CrossOver | cut corners, ribbons, beam, core gems, Life shatter | redrawn shapes, own names and art |
| Aeterna today | all functions (see `ui-inventory.md`) | prose rows replaced by shape; fit to width |

Distinctness test for the slices: A = tabletop (piles on rails, physical motion), B = ribbon strips (collapsed pile tray, cut-wipe motion), C = orbit (cores and steps as rings, glow motion). Swapping palettes must still leave them different.
