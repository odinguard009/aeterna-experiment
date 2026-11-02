# UI/UX direction slices: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Three original phone-first direction slices (Lobby home + Battle) the owner can open on a phone and pick from.

**Architecture:** Three throwaway single-file HTML mockups sharing one fixed zone list and one animated moment (attack, block prompt, Life shatter). Research notes feed an originality ledger.

**Tech Stack:** Plain HTML/CSS/JS, system fonts, no network assets.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-ux-phone-first-design.md`

## Global Constraints
- 375x812 primary, full-bleed at 480 px or less (no device frame); touch targets at least 44 px.
- Respect `prefers-reduced-motion`. Neutral codename "Aeterna" in the chrome; no copied art, logos, text.
- Battle zones per side (DESIGN.md 17:40): Life, Reserve, Count, Trash, Deck, Void, Banished, Burst/Mirage, Soul State, Nexus row, Spirit row (cores on spirits), hand, step band (7 steps), NEXT.
- Directions must differ in zone-density solution and motion language, not palette. Lobby section order must not match Oplay's (hero, tiles, 5-tab bar).

## Review Focus
- Zone overflow: 5 Spirits plus 3 Nexus plus full hand at 360 px wide must not clip.
- Reduced motion: the attack moment still shows its result without movement.
- Long card names and 3-digit BP numbers must not break tiles.

### Task 1: Research notes
**Files:** Create `docs/design/research/aegis-oplay-crossover-today.md`
- [ ] Read Aegis battle study (`docs/aegis-study.md` line 65+), mockup-v14 idea table, Oplay tutorial board (done), 6 CrossOver frames, Aeterna today (Battle + Deckbuilder at mobile).
- [ ] Done when the note has one originality ledger table ("keep" vs "do differently") per source.

### Task 2: Shared slice kit
**Files:** Create the shared kit data (kit.js idea, not kept as a file) (zones, sample cards) inlined into each slice.
- [ ] Done when the zone list and 6 sample cards exist once and are pasted identically into all three files.

### Tasks 3-5: Directions
**Files:** Create `docs/design/slices/direction-a.html`, `docs/design/slices/direction-b.html`, `docs/design/slices/direction-c.html`
- [ ] Each: Lobby home screen, Battle screen, tap NEXT or an attacker to play attack, block prompt, Life shatter.
- [ ] Done when each opens at 375 px with no horizontal scroll and the distinctness test passes (swap palettes: still different).

### Task 6: Check and present
- [ ] Screenshot each at 375x812 and 360x740; publish as private Artifact for phone viewing; show owner the three one-line descriptions.
