# Aeterna UI/UX, phone-first mockup: design

Status: draft for owner approval (2026-11-01). Mockup only; nothing in `apps/web/` or `index.html` changes in this project.

## Intent
The owner finds Aeterna's Deckbuilder and Battle screens on a phone weaker than Oplay and Aegis, and noticed the Aeterna lobby now looks like Oplay's (and was built on purpose to copy Aegis's). Goal: a phone-first UI/UX that is as easy and modern to use as those two, with **its own identity**, still carrying the Battle Spirits CrossOver mood (skewed cuts, turn ribbons, attack beam, core gems). The owner distrusts their own design taste, so Claude judges and proposes; the owner reacts to pictures.

## Goals
- Best-in-class phone **Battle** and **Deckbuilder** (the two named weak spots), then a new **Lobby**.
- Animations and extras beyond today's set (attack, block, burst, flash, core payment, summon, level-up, game over, test hand).
- PC layout derived from the chosen phone design, after phone is approved.

## Non-goals
- No engine, data or `index.html` build changes. No online/accounts. No copied art, logos, names or text from Oplay, Aegis or Bandai.
- Not a full redesign of every settings or info page in the first pass.

## Anti-goals (failure even if it "works")
- Anything a viewer could call a re-skin of Oplay or Aegis: same section order, same card tiles, same hero, same tab icons.
- Generic template look. Losing a function that exists today (see `docs/design/ui-inventory.md`).

## Constraints
- Phone first: 375x812 primary, check 360x740 and 412x915; thumb-reachable actions at the bottom; touch targets at least 44 px; respects reduced motion.
- Single-file HTML mockups in `docs/design/` (`mockup-v15-*.html`), system fonts or Google Fonts only, no other network assets.
- Public repo keeps the neutral codename "Aeterna"; no real game or publisher branding in the mockup chrome.
- DESIGN.md section 0 decisions may be broken (owner, 2026-11-01); keep what still serves: side colours, core gems, deck look, playmat/sleeve uploads.

## Approaches considered
- **A. One full phone mockup straight away.** Fast; if the visual direction is wrong, every screen is wrong.
- **B. Three original directions on a small slice (Lobby home + Battle, phone), owner picks one, then the full phone mockup, then PC.** One extra round, but the owner chooses by looking. **Chosen by the owner.**
- **C. All screens, PC and phone, at once.** Too large, fights the phone priority. Rejected.

## Plan of the project
1. **Research notes** (`docs/design/research/`): Aegis, Oplay (public pages, tutorial board, no accounts), CrossOver (video and wiki), Aeterna today. Tools: browser pane, TinyFish; REA for page structure and motion where a debug-enabled Chrome is available. Each note ends with an **originality ledger**: "usability lesson we keep" versus "what we do differently".
2. **Direction slices**: three files, same data, three distinct identities (names, palettes, shapes, motion language), each showing Lobby home and one Battle moment on a phone frame.
3. **Owner picks** (may mix elements).
4. **Full phone mockup**: Battle (all prompts and animations), Deckbuilder (large-art grid with size choice, quick filters, deck sheet, test hand, curve), Lobby and Play setup, My decks, compact Settings.
5. **PC mockup** from the approved phone design.
6. Implementation into `apps/web/` is a separate later project and needs its own plan.

## Calls made by Claude (owner can overrule)
- Three directions will be named and described in one line each before building.
- First pass covers Battle, Deckbuilder, Lobby, Play setup and My decks; Library and Settings come in the PC round.
- Research notes are written in English like the other docs; chat stays Indonesian.

## Left to the builder
Palettes, type pairing, exact motion timings, icon set (own drawings), copy text.
