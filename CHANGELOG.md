# Changelog

Release notes, newest first. Each version also has a GitHub Release with the game file attached (from v0.57.1 on; earlier versions are listed here only). Issue numbers up to v0.57.0 refer to the owner's private archive.

Older releases (v0.80.0 and earlier): [CHANGELOG-archive.md](CHANGELOG-archive.md).

## v0.174.0
- Lane: K
- **Lane K: 8 more cards complete (all older), 925 of 8,709; compiler only: plain "(When Battles)" heads.** `(When Battles)` is now read as "this Spirit attacks or blocks" (`ATTACKS` with `alsoBlocks`) for any body, not only an end-of-battle body (same house reading as v0.78.0). Cards: The GodTree Dionaeus, The SnakeEmpress Medousa, The HeavyArmoredBug Goliearth, Luckiwi, Photon-Dragon, Quartz-Golem, Hornviper, The DragonArmor Dragmaru.
  - Not built this run: the other "(When Battles)" cards (13) each carry a second mechanic (Rush, Magic use, Heavy Armor, ...).
  - Checked: loop, promotion smoke 8 / 8, `fx_validate`. Not checked: Regression (CI), a real device. Revert note: `git revert` the v0.174.0 commit.

## v0.173.0
- Lane: K
- **Lane K: 4 more cards complete (2 Standard, 2 older), 917 of 8,709; compiler only, no engine change: "(During Attack/Block)" static BP and "send N cores from any opposing Spirits to the Reserve".** Compiler: `(During Attack/Block) This Spirit gains +N BP` (STATIC `fightingOnly`, plain, conditional and followed by an "At the end of battle" sentence) and `Send N core(s) from any opposing Spirit(s)[/Ultimate(s)] to the Reserve` (`OPP_CORES_TO_RESERVE` `total`, up to 5). Cards: Puppislope, Euus-Callus, Plasbat, Cursegargoyle.
  - Not built this run: the Trash / Void variants of the send-cores sentence (a different action each), "for each ..., send a core" (needs a per-count loop), 7-core and conditional forms.
  - Checked: loop, promotion smoke 4 / 4, `card_verify` on all four cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.173.0 commit.

## v0.172.0
- Lane: K
- **Lane K: 3 more cards complete (3 older), 913 of 8,709; two targeted opposing-Spirit marks: "that Spirit can't block" (this battle) and "can't refresh on the next Refresh Step".** Engine: `CANT_BLOCK_OPP` (marker `noBlockB`, honoured by `canBlockState`) and `NO_REFRESH_OPP` (marker `noRefreshT`, honoured by the Refresh Step, with a log line). Compiler: the two sentences. The build now strips full-line comments from the shipped `index.html` (sources unchanged) to stay inside the size budget B01. Cards: The FairyKnight Peter, Kaimeiju, Janome-Shielder. Effect format v17 (addition only).
  - Not built this run: other "target an opposing" cards (Illusiona, Smowg, Garizarot, Hammergrau, 26R Legacy / True Release) each need a second mechanic; "(Once Per Turn)", "(Can't Stack)" and "(During Attack)" heads measured 0 of about 10.
  - Checked: loop, `v172_cant_block_no_refresh` (2 tests), promotion smoke 3 / 3, `card_verify` on the three cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.172.0 commit.

## v0.171.0
- Lane: K
- **Lane K: 11 more cards complete (4 Standard, 7 older), 910 of 8,709; "Spirit/Nexus" family conditions, "[A]/[B]" name lists, Current as a holder, "return this Spirit to the Hand" from the Trash, "put the core to this Spirit instead".** Engine: `ctrl.nexus` counts the owner's Nexus too ("any X family Spirit/Nexus, besides this Spirit" with `other`), `controlName` may be a list of names, `cardHasKeyword` recognises Current (the `{{Current|...}}` holder) so `ctrl.keyword` / `match.keyword` work, and `SELF_TO_HAND` under a destroyed trigger takes the card out of the Standby / Trash (it was Field-only, which kept every "(When Destroyed) return this Spirit to your Hand" card partial). Compiler: the besides forms (prefix and inline, "this one"), the name list, `Put the core to this Spirit` in an instead pair, "Target up to N Spirits with <Keyword> you control. Put a core from the Void to each of them." (`VOID_TO_MATCHING`). Cards: Gawrm, The Ripper Headiless, Lady-Frankelly, Lailaps-Chaser, The Macaroni Pentan, Salakka, Tokkaricca, The SeaMonster Morgawler, The Cannoneer Golek, Kamen Rider Baron Banana Arms, Kamen Rider Gaim Jimber Lemon Arms. Schema v16.
  - Not built this run: Shamanism, Rumble, "can't be blocked by Cost/BP N or less", "(During Attack)" and "(Can't Stack)" heads, "target an opposing" sentences (13 cards, each needs a second mechanic).
  - Checked: loop, `v171_nexus_names_current` (7 tests), `fx_validate` 6894 / 6894, promotion smoke 11 / 11, `card_verify` on three of the cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.171.0 commit.

## v0.170.0
- Lane: K
- **Lane K: 18 more cards complete (9 Standard, 9 older), 899 of 8,709; keyword Current, printed "can't attack / can't block", plain "(Once Per Turn)" after a trigger head, "the opponent targets a refreshed Spirit".** Engine: STATIC flags `CANT_ATTACK` and `CANT_BLOCK` (the human Attack button and the CPU skip such a Spirit; `canBlockState` honours the block flag; the effect lock `noAB` is unchanged). Compiler: the Current template is dropped in front of its Invoke body (the SYMBOL_TARGET sentence carries the rule), `(Once Per Turn)` after a trigger head sets `once` per card, "The opponent targets a refreshed Spirit they control. Exhaust it." is `EXHAUST_OPP` `oppChooses` (engine since v3). Effect format v15 (addition only).
  - Not built this run: the "can't be blocked by Cost/BP N or less" family, Shamanism, Rumble, conditional "this Spirit can't attack" (If you control no X).
  - Checked: loop, `v170_current_cant` (6 tests), `fx_validate` 6894 / 6894, promotion smoke 18 / 18, `card_verify` on three of the cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.170.0 commit.

## v0.169.0
- Lane: K
- **Lane K: 21 more cards complete (15 Standard), 881 of 8,709; new trigger `END_STEP` ("(Your End Step)"), core-move Flash, Soul Core upgrade for core removal, `REFRESH_SPIRIT` n / all, Amplify template.** Engine: the End Step trigger fires for the player whose turn ends (before "during this turn" effects end); `(Start of Your Attack Step)` is now read by the compiler (the engine trigger already existed); `REFRESH_SPIRIT` can refresh up to N Spirits or all matching ones; `BP_TARGET.coreFromSelf` ("Send a core, besides <Soul Core>, from this Spirit to it, and during this battle, it gains +3000 BP", Gaim Arms Flash; the CPU never uses it when it would deplete the paying Spirit); `OPP_CORES_TO_RESERVE.upgrade` ("If there are three or more cores in the opposing Reserve, the target becomes any opposing Spirit / send one core from it instead", "If summoned via Form Change, send a core from it instead"; the Soul Core goes only when no normal core is left on the target, house reading of "the opponent chooses"); a control condition may name two families. Compiler: `{{Amplify|...}}` (the printed "For each X family Spirit you control ..." sentence becomes `BP_TARGET.per`, the card gets `keywords: ["Amplify"]`), "(During Blocks)" / "(During Attacks)" = the singular heads, own targets by colour ("one of your Green Spirits"), "Target a Spirit you control. Refresh it.", "Target up to two X you control. Refresh them.", "Refresh all your X Spirits.", "This Spirit can refresh.", "Refresh this Spirit.". Cards (Standard): Kamen Rider Gridon Donguri Arms, Knuckle Kurumi Arms, Ryugen Budou Arms, Marika Peach Energy Arms, Zeztz Plasma Booster, The CurseLady Pienetta, The WaspArmor Menotera, Waltar, Stellouse, Pepper's Beast, Hopli-Shimmer, The BladeLeg Glassraner, The WarningWhistle Flustle, Genm Corporation, Junks; older sets: Sabecaulus, Wind Shear (new in the library), The Shinobi's Hidden Village, Karakuribatta, The SixthArtifactBeastman Blockade-Tiger, The Sunken City Ruins. Effect format v14 (addition only).
  - Not built this run: the "can't be blocked by opposing Cost/BP N or less Spirits" family (about 10 cards, each also needs a second new mechanic), Shamanism, Rumble, Current.
  - Checked: loop, `v169_end_step` (11 tests, new mechanics), `fx_validate`, promotion smoke 14 / 14 plus Flustle, `card_verify` on three of the cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.169.0 commit.

## v0.168.0
- Lane: K
- **Lane K: 10 more Standard cards complete, 860 of 8,709; new condition `symbolsOnGe`, DESTROY `costIn` / `blockingSelf`, BOUNCE_OPP `notAttacking`, STATIC `fightingOnly` + `noStack`, match `costIn`.** Engine: "If you control / have N or more <Colour> symbols" (the owner's Field symbols); "Cost 1/2" and "Cost 6/8" as a cost list; "an opposing non-attacking Spirit" (any opposing Spirit but the attacker); "an opposing Spirit that is blocking this Spirit" (only while this Spirit attacks and that Spirit is its blocker); "All your attacking/blocking Spirits with <Keyword> gain +N BP" in both Attack Steps, with "(Can't Stack)" counting one copy per card name; RETURN_TRASH now takes any match (colour, cost, keyword). Compiler: "(During Block) If <condition>, this Spirit gains +N BP", "Target a [Cost N or less] [Colour] Spirit card [with Keyword] in your Trash. Return it to the Hand.", own targets "Cost A/B" and "with the \"X\" family", and 'If you control any "X" family Spirit, besides this Spirit, ...' = another X family Spirit. Cards: Nonril, Dane-Grey, Lassrea, The Assassin Nidree, Genm Action Gamer Level 0, Kukulakatol, The DragonSteed Rostache, The Floating Stone Realm, Plasmaru, Baron Ringo Arms. Effect format v13 (addition only).
  - Not built this run: Shamanism (the rule page could not be fetched without the owner, so no guessing; 4 cards wait on it), End Step trigger (The Fabricated Sunwhite), Rumble, Current.
  - Checked: loop, `v168_filters` (8 tests, new mechanics), `compiler_v2` C168-01, `fx_validate` 6893 / 6893, promotion smoke 10 / 10, strict_effects, destroy_filters, form_change, invoke. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.168.0 commit.

## v0.167.0
- Lane: K
- **Lane K: 8 more Standard cards complete, 850 of 8,709; new `ctrl` qualifiers `bpGe` / `noText` / `name`, `per.keyword`, and Legacy / Shamanism detection.** Engine: a control condition can ask for a Spirit with N BP or more (`bpGe`), with no printed effects (`noText`) or with a card name (`name`, with `exhausted`); "for each Spirit with <Keyword> you control" counts by keyword (`per.keyword`); `cardHasKeyword` (and so every `match.keyword`) now recognises Legacy (the `legacy` flag / head line) and Shamanism (the `{{Shaman|...}}` holder), which no keyword list carried. Compiler: "If you control any Spirit with 10000 BP or more / any Blue Spirit with no printed effects / any exhausted \"X\", change the targeting BP/cost ... instead" and "target two instead" (the same target action run twice), "All your Spirits with <Keyword> gain +N BP" (also in Opposing Attack Step), "(During Attack) At the end of battle, X" (the attacker's end-of-battle effect). Cards: The RedGuide Shaniel, Centicade, The Dual Flow Desert, Striares, The HornPower Bullfal, The PowerWings Megaropsis, Kamen Rider Ryugen-Yomi Yomotsuheguri Arms, Mushakko.
  - Checked: loop, `ctrl_bp_name_filters` (5 tests), `compiler_v2` C167-01, promotion smoke 8 / 8, `card_verify` on four of the cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.167.0 commit.

## v0.166.0
- Lane: K
- **Lane K: 2 more Standard cards complete, 842 of 8,709; new condition `handLe`.** "If your Hand is five or less" is an engine condition (the owner's Hand size when the action resolves), and the compiler reads "(During Attack) If <condition>, this Spirit gains +N BP" as a conditional STATIC `attackingOnly` BP, with every condition the v2 reader knows (a hook from v1 to `cond_of`). Cards: Faltex 26RSD09-004 (was partial: True Release draw), 26RBS01-018 (Shamanism). Effect format v12 (addition only).
  - Checked: loop, `hand_le_condition`, `compiler_v2` C166-01, `strict_effects` (condition key list), promotion smoke 2 / 2. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.166.0 commit.

## v0.165.0
- Lane: K
- **Lane K: 7 more cards complete, 840 of 8,709 (all Standard); new action `SHOW_RETURN`.** "Show up to N <X> cards from your Hand to the opponent. Return them to the deckbottom. For each card returned, draw a card." (also "If two cards are returned, draw three cards" and the single-card "You can show ... and return it to the deckbottom. If returned, ...") is one engine action; the human picks each card (or Done), the CPU returns the cheapest matching cards; showing itself is only logged. Compiler: "If returned, X" = "Then, X", "Then, destroy it if it has 0 BP", "(You can) discard N cards from your decktop" (`MILL`, no card needed it alone yet). Cards: 26RCB01-020, 26RCB01-030, 26RSD04-011, 26RSD04-012, 26RSD05-011, 26RSD05-013, 26RSD07-010. Effect format v11 (addition only).
  - Checked: loop, `show_return` (4 tests, new mechanic), `compiler_v2` C165-01, FX01-FX03 with a SHOW_RETURN generator, promotion smoke 7 / 7. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.165.0 commit.

## v0.164.0
- Lane: K
- **Lane K: 5 more cards complete, 833 of 8,709 (4 Standard, 1 Eternal).** Compiler forms, no engine change: "Target one of your <X>. Put a core from the Void to it" and the singular "Target a Spirit you control. ..." pairs (`VOID_TO_CARD`), own-target BP with a keyword ("Spirits with Shamanism", `match.keyword`), "You can summon a Cost N or less \"X\" family Spirit card from your Hand/Trash, without paying the cost" (`SUMMON_HAND`), and the `(Can't Stack)` head (`noStack`; no card needed it alone yet). Cards: Ogre Wizard card BS70-022, 26RBS01-017, 26RBS02-063, 26RBS03-024, 26RSD10-008.
  - Chain limit set to 1,000,000 tokens per chain and per session (owner, 2026-10-27, `RANTAI_MAX`). Regression part 3 test fixed in v0.163.0 (CPU deck list counts non-hidden decks).
  - Checked: loop, `compiler_v2` C164-01, FX01-FX03, promotion smoke 5 / 5. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.164.0 commit.

## v0.163.0
- Lane: K
- **Lane K: 8 more cards complete (6 Standard, 2 Eternal), 828 of 8,709.** Compiler forms, no engine change: (1) own-side pairs "Target a/an <family/colour> Spirit/Nexus you control. Put a core from the Void to it." read as `VOID_TO_CARD` (`anySpirit` / `anyNexus` + `match`), also with a keyword ("a Spirit with Rumble", `match.keyword`); (2) the BP per-count spellings "For each X you control, during this turn, this Spirit gains +N BP" and "This Spirit gets +N BP for each X you control" read as `BP_PLUS` with `per`. Cards: Atun, Dabity, Nausa, The TreeShadow Felio, Tamink, Feeding Draw (26RSD04-001, 26RSD04-006, 26RSD06-001, 26RSD06-008, 26RBS01-076, 26RSD06-012), The Unicorn Einhorn (BS03-046), Ryzard (BS14-001). "Target" with "another", "besides", "up to N" and "each of them" stays in review.
  - Checked: loop (88 tests), `compiler_v2` test C163-01, promotion smoke 8 / 8, `card_verify` on the Rumble, Legacy and Magic cards. Not checked: full pre-push set and Regression (CI), a real device. Revert note: `git revert` the v0.163.0 commit.

## v0.162.0
- Lane: U/I
- **Generated vanilla test cards no longer appear anywhere in the UI.** The "Training Red (generic vanilla cards)" preset is flagged `hidden` and filtered out of the Decks starters, the deck builder "Load ready-made" list, the CPU deck picker and the "Choose a starter deck" dialog (the TRAIN cards were already hidden from the Library, deck builder and card pages). They stay in the engine as internal fixtures for sims and tests (`BS.loadPrebuilt('train')` still works), because ~25 test suites pin their ids; deleting them outright is left for a dedicated refactor.
  - Checked: loop, `std_decks97`, `my_decks_page` (updated to count non-hidden starters). Not checked: full pre-push set and Python suites (CI / Regression), a real device. Revert note: `git revert` the v0.162.0 commit.

## v0.161.0
- Lane: U/I
- **Frontend audit (web-design-guidelines): accessibility labels.** The payment − / + buttons (local and online) now say what they change ("Fewer / More <cost source>"), and the lone inputs without a visible label got an `aria-label`: online server URL, import deck list, deck list (export), deck code, sign-in email. Attribute-only change, no visual difference. Already clean: focus styles replace every `outline: none`, no `transition: all`, reduced-motion handling, `color-scheme` and `theme-color`, image alt text, bug-report form labels.
  - Checked: loop (82 tests). Not checked: the read-only player-view pass (no layout change, so skipped), a screen reader. Revert note: `git revert` the v0.161.0 commit; only `aria-label` attributes were added.

## v0.160.0
- Lane: U/I
- **Mockup parity finished: the battle screen now uses the mockup stylesheet.** `MK_OFF` is empty, so every view runs on `mockup.css` + `mk-glue.css`. The one real collision was the class name `slot`: the old field-card wrapper clashed with the mockup's locked-cell `.slot` (squeezed cards, dashed outlines), so the wrapper is now `fslot` (render, `styles.css`, two tests). PC and phone layouts are unchanged (phone keeps its single swipeable row).
  - Checked: loop, the 13 battle / UI unit test files, screenshots at 1366x768 (PC) and 390 px (phone) before and after. Not checked: the read-only player-view pass, other PC sizes, a real Android device. Revert note: put `'view-playmat'` back into `MK_OFF` in `13b-nav.js`; the `slot` -> `fslot` rename is harmless to keep. Backup branch: `backup/v0.159.0`.

## v0.159.0
- Lane: K
- Staging import (`data/import`) regenerated without the 4 promoted cards.
- **4 more Standard cards complete; LOOT to deckbottom, During Block.** Cards: 26RCB01-037 Kamen Rider Knight Survive, 26RBS01-088 The Honorable Saintar, 26RCB01-048 Kamen Rider Para-DX Puzzle Gamer Level 50, 26RSD06-006 Svarris. Two new pieces of vocabulary: `LOOT` can take `to:"deckBottom"` ("draw N, then return M cards from your Hand to the deckbottom") and a STATIC effect can carry `blockingOnly` ("During Block"). Effect schema v10 (additions only; `docs/ai/effect-format.md`).
  - Checked: loop, `fx_validate` (6892/6892), `card_verify` on all four, promotion sample (all four read in full, seed 64080), new tests `during_block_static_bp` and `loot_deckbottom`. Not checked: the Saintar ALLY_LIFE_HIT trigger and its Lv2 attack bonus, and the Para-DX form-change branch, run only through `fx_validate` (no scenario test). Yield is 4 cards, below the 12+ aim; the remaining packs ("use the flash", "if you control" variants, "During Attack") were not started.

## v0.158.0
- Lane: U/I
- **Owner review round 3 (22 comments).** Phone Lobby: background button moved to the end of the hero (no longer blocks buttons), logo centred (PC too), tiles show the title only. Phone Deck: size button top-right (44 px), long deck names and "Ready to play" no longer overrun, deck-list rows shrunk so spirit names are readable; Type and Cost are dropdowns like Colour and Group. Phone Library: "! Partly Implemented" is a real toggle filter, chips / Saga list / lore head can be minimised, Saga buttons uniform with the count under the title. Phone Learn: library row tidied.
- **Battle (PC):** hand cards are no longer a fan; the empty strip under the hand is gone and the field cards use the space (`clamp(112px,17vh,168px)`); every Trash area is bigger and split into Trash (cards) and Core Trash (cores); zone boxes keep a fixed size and the indicators inside shrink to fit (container queries, `fitGems`), which also stops the COUNT plate being clipped.
  - Checked: loop, screenshots at 1366x768 and 1920x1080 (battle PC, phone lobby/deck/library/lore/learn at 390 px), new test `ui_v158`. Not checked: smaller PC windows, the last phone lore seg-button tweak, a real Android device. Not done: battle screen is still on the old stylesheet (`MK_OFF`).

## v0.157.0
- Lane: U/I
- **Battle (PC): locked cells shown.** Each Spirit row shows its five cells and each Nexus row its one cell as dashed "Empty" slots (mockup `.slot`) instead of the "No Spirits" / "No Nexus" text; a placed card takes the first cell. Phone is unchanged (one swipeable row).
  - Checked: loop, screenshot at 1366 px. Not checked: the full Playwright suite beyond the pre-push run, phone, Android. Not done: moving the battle screen onto `mockup.css` (`MK_OFF`) - the markup stays on the old stylesheet.

## v0.156.0
- Lane: U/I
- **Mockup parity, batch 4.** Export dialog has Text / Code / Image / CSV tabs (Image = a plain deck sheet PNG drawn on a canvas); Import shows "Format detected" live (deck code, list or CSV, with the line count); Avatar and Match history open as dialogs like the mockup (history keeps an "All matches" button to the Settings list); the starting-hand dialog reads "You may redraw the whole hand once. Cards you can pay for on turn 1–2 are marked." with an "Easy" tag on cards that cost 3 or less; battle (PC): the hand-count tag sits beside each Nexus ("CPU Hand n" / "Your Hand n"), a "Mirage Set" tag on a set Mirage, the hand is a fan; card faces without a picture get generated art (glow, ridges, a silhouette by type; drawn by code, no printed artwork).
  - Not done: the battle screen still uses the old stylesheet (`MK_OFF`); moving it onto `mockup.css` means renaming the board markup and its many test selectors, so it is a separate release. The "Easy" mark uses cost only (it ignores reduction and the first-turn Reserve of 3 + Soul Core). Generated art appears on faces drawn by `cardFaceHTML` (Library, dialogs, Card Panel, mulligan); the hand and field cards still use their own compact frame. The "card images" item was read as the mockup's generated art; real card pictures stay off until v1.0 (card-image plan).
  - Checked: loop, tests V155-10 and the updated L03 / L04 / S02 / U65-3, screenshots of the battle and the Library at 1366 px. Not checked: phone layout of the new dialogs, Android.

## v0.155.0
- Lane: U/I
- **Owner review round (28 comments on the HTML preview).** Play (PC): Start box under "Play a Match"; Home: the Aeterna logo as backdrop on the theme colour, with an upload / reset option for an own picture; Quick Match overlap fixed; starter decks in equal cells (phone: Key card and deck name only, one card, title and buttons tidied, panel maximize / minimize button, action row scrolls in one line).
- **Card dialog and cards.** Cards are no longer cut into a parallelogram (cause: the `in` class clashed with `.mk .in`); Add / Remove / Close laid out in a grid; dialog text bold; core and Soul Core colours differ again (`.mk .g-core` overrode the colour variables).
- **Filters.** Rainbow pip for "All coloured spirits"; new groups Burst, True Release, Manifest, High Speed, Token; Mirage and Rebirth moved to the type column; the Library uses the same filter board as the Deck Builder (shared builders) and can hide it ("Hide filters").
- **Card page and lore.** Card page reworked toward the mockup (family line, flavor text, Art block, related cards); alternative art is used everywhere a card face is drawn. Lore can be read by Series or by Saga (17 Sagas, from `docs/saga-map.md`). Game log can be copied.
- **Battle (PC).** Card Panel moved to the right; area and row sizes are fixed (they do not change with contents, "GAME OVER" included); core gems shrink to fit Life, Reserve and card tags; Up / Down arrows scroll the Card Panel; turn / step cues centre on the board and never cover the Card Panel.
  - Not done / not checked: reading order by story arc (no reachable source in this session; Fandom and official pages were blocked); alternative art only appears with card images on the device and only for same-name printings; per-chapter animated PNGs for Learn are planned (roadmap-open item L); phone battle layout not changed; no real-device (Android) check. Every new card adds lore, so the lore lists grow with each card pack.
  - Checked: loop, tests V155-1 to V155-9, screenshots at 1366 and 390 px.

## v0.154.0
- Lane: U/I
- **Front-end audit (Web Interface Guidelines) and fixes.** Checked every main page at 1366 and 390 px for: controls without an accessible name, clickable non-buttons, images without alt, keyboard focus visibility (Tab through Lobby, Play, Decks, Library, Settings), `transition: all`, reduced motion, skip link. Fixed: Room code input had no label; the deck-sheet scrim is now hidden from assistive tech; added a "Skip to content" link; `transition: all` replaced by explicit properties (7 places); scroll-behavior respects reduced motion app-wide.
  - Checked: loop, the probes above (no remaining findings on those pages). Not checked: screen-reader output, the battle board's many small controls under keyboard-only play, Android TalkBack, contrast of every theme combination (the earlier contrast pass stays valid).

## v0.153.0
- Lane: U/I
- **Mockup parity part 2.** (1) Concede dialog: "It counts as a loss. You can replay it from History.", buttons Keep Playing (primary) and Concede (red). (2) New deck now asks Blank deck / From a starter deck / Import a list (a full set of slots still says so first). (3) Report a Bug: new "Display or layout problem" type, an optional "Steps to reproduce" box and an optional "last lines of the match log" box; all parts are capped so the issue link stays under the URL limit.
  - Checked: loop, tests V153-1..3, U93 deck tests updated for the chooser. Not checked / still different from the mockup: export tabs (Text / Code / Image / CSV), Import "format detected", Avatar and History dialogs, mulligan "cards you can pay for are marked", full battle re-skin, card art. B01 budget raised 975 -> 985 KB on purpose (noted in the test).

## v0.152.0
- Lane: U/I
- **Battle screen, mockup parity part 1.** PC: the turn band reads "Player Turn 5" with the turn number; the title bar names the format and CPU style ("Standard · vs Balanced CPU"); the Card Panel has a frame with the hint "Hover Or Tap A Card To Read It Here." and the last three log lines at its bottom. Phone: the stat cells read as full words (Life, Reserve, Hand, Deck, Trash, Count, Void, Banished; "Res." at 360 px) while the text keeps the short labels the tests read. Same session: owner switched chain mode on ("Rantai on").
  - Checked: loop, tests V152-1/2, PC and phone 360 / 390 screenshots. Not checked: the full battle re-skin (the board still uses the old stylesheet and its markup: five-cell locked rows, Nexus rows as in the mockup, hand fan, Burst Set / Mirage Set tags, "Effects" demo menu is mockup-only and not ported), phone stat order differs from the mockup (kept: legacy tests read it), no live player-view pass.

## v0.151.0
- Lane: U/I
- **UI audit fixes, core move gems for every move, effect pop-ups.** (1) Esc now closes view-only dialogs on every page (it only worked in the deck builder; the shortcuts list already promised it). (2) 360 px phones: the page title no longer runs into the colour button (the wordmark hides under 380 px, the title is cut with an ellipsis). (3) Light mode: the footer "Report A Bug" link is readable. (4) The type filter chips (Spirit, Ultimate, Brave, ...) wrap instead of being cut. (5) The "Continue with" thumbnail no longer shows overflowing text. (6) Every core move now flies as a gem, also the ones the engine sends no cue for (summon payment, destroyed Spirit, Void, Life, Count and effect moves): the board is compared with the last one and places that lost cores send gems to places that gained them (net moves, Full animation only); the place a core lands on flashes. (7) New effect pop-ups in battle: an info card for every effect that runs (card, side, trigger, effect text), never a question; PC at the bottom of the left card column, phone under the top bar, never over the field; gone after 5 s or with its X; Settings > Game > Effect pop-ups turns it off. It replaces the old centred "Effect Active" panel and shows in every animation mode. The phone Life area already shows one core icon since v0.149.0 (field height measured constant at 360-844 px); tests added.
  - Checked: loop, tests V151-1..4, EF01 rewritten, screenshots (PC, phone) of the pop-up and the gems. Not checked: continuous (static) effects such as passive BP gains do not send an effect record, so they show no pop-up; gems only in Full animation; no live player-view pass; the battle screen is still the old stylesheet (mockup parity open).

## v0.150.0
- Lane: K
- **+6 complete cards** (BS04-001 Kunanomi, BS12-063, BS24-009 Flame-Gundragna, BS28-011, BS33-022, BS54-021). The condition "if you control" gained three forms: "a Spirit with <keyword>" (`ctrl.keyword`), "another <family> Spirit" (`ctrl.other`, not the source) and "N or less Spirits" (`ctrl.nLe`, engine only); the compiler also reads "If C, instead, B." replacement pairs.
  - Checked: scratch recompile of the staged pool, promote smoke check, card_verify on all six (stats and text match the export), test CK01-CK03. Not checked: card images; the other 4 cards of the "if you control" row need Current, Nexus counting or other mechanics and stay staged

## v0.149.0
- Lane: U/I
- **Battle: core animations, Depletion safety net, phone field.** (1) Every core/Soul Core move now emits a view event and flies as a gem in Full animation: Life to Reserve (damage), Reserve to Spirit, Spirit to Reserve (destroy/deplete), Spirit to Spirit, Reserve/Spirit to Trash (cost payment), Void and Trash zones included. (2) A Spirit below its Lv1 cores is now also depleted at every Intent and step change (safety net next to the existing checks after payments, battle and effects). (3) Phone: the Life indicator shows one core icon instead of up to five, so the field no longer changes size when Life drops; the first Spirit/Nexus starts in the middle of the row and the row scrolls when it overflows. Size budget B01 raised to 975 KB.
  - Checked: loop (build, lint, smoke). Not checked: the reported 0-core Spirit could not be reproduced in the engine; full quick tests run in pre-push; no live player-view pass

## v0.148.0
- Lane: U/I
- **Generated test cards no longer clutter the deck builder.** The 14 built-in Training cards (TRAIN-01..12, N1, N2; the grey cards without art) were the only program-made vanilla cards; all 4 other ids missing from the official source data are tokens/Contract cards and stay. The library, Home count and card page already hid them; the deck builder list now does too. The cards stay inside the engine for the sim, the first-run fallback deck and the tests; no official vanilla card was touched (all 8,709 official ids are in the source data).
  - Checked: id comparison against data/sources, deck builder tests. Not checked: full removal from the engine (needs a rewrite of the legacy suites)

## v0.147.0
- Lane: U/I
- **Frontend audit, part 2.** Two real findings fixed: (1) white text on the Red, Purple and Blue accent colours in dark mode read at only 3.4-3.9:1; the accent ink now falls back to black when its own ink is below 4.5:1 (checked on lobby, Play and Decks for all 9 colours). (2) Lobby Card of the Day showed no name and no buttons on a card without flavor text; it now shows the name, Card Page and + Add To Deck (this also fixed test HM1 failing today and blocking the v0.146.0 push).
  - Checked: contrast script over 3 screens x 9 colours, quick tests. Not checked: contrast on other screens and the battle board, keyboard order

## v0.146.0
- Lane: U/I
- **Frontend audit, part 1.** Scripted pass over 10 screens at 390 px and 1280 px: no console errors, no page-wide horizontal scroll, no unnamed buttons, no images without alt. One finding fixed: the deck builder card info (i) buttons were 22 px wide, now 24 px (WCAG 2.2 minimum).
  - Checked: scripted pass above, loop green. Not checked: contrast per theme colour, keyboard order, screen reader, battle screen

## v0.145.0
- Lane: U/I
- **Spinning coin in the Coin Toss dialogs (mockup parity).** The pick-a-side and first/second dialogs now show the gold coin of the mockup spinning once (shows H or T for the result); off with reduced motion. No rule change.
  - Checked: loop green. Not checked: screenshot against the mockup, phone width

## v0.144.0
- Lane: U/I
- **Deck Share Code dialog (mockup parity).** New Share button in the deck builder shows a code like AET-XXXX-XXXX-XXXX, a QR placeholder as in the mockup, and Copy code. The deck list is kept on this device under the code; pasting the code into Import restores it. Honest limit: codes work on this device only until online play exists.
  - Checked: share then import round-trip test (PC and phone), loop green. Not checked: screenshot against the mockup, other devices

## v0.143.0
- Lane: U/I
- **Colour-blind markers and high contrast edges (Settings > Accessibility).** UI only, both off by default. With markers on, every card shows a small shape for its colour (triangle red, circle blue, diamond green, star yellow, square purple, ring white); high contrast thickens card borders and focus rings.
  - Checked: phone 390 px battle with markers on (hand and field), loop green. Not checked: marker on card images in the library/deck builder, PC screenshot, the online board

## v0.142.0
- Lane: U/I
- **Phone battle board shows dashed empty slots.** UI only. Each field on the phone shows up to four dashed "Empty" slots after the cards (as in the mockup) instead of one "Empty field" note.
  - Checked: phone 390 px screenshot of a live match, no page errors. Not checked: other phone widths, the online board (unchanged)

## v0.141.0
- Lane: U/I
- **Logo, loading screen and favicon follow the chosen colour; lobby Card of the Day matches the mockup.** UI only. The logo, loader and tab icon take the accent colour of the theme (the choice is also stored so the loader is tinted from the first paint); the Card of the Day shows the mockup card face (generated art, cost gem, type chip, LV/BP footer; a real picture still wins) with "Card Page" and "+ Add To Deck" buttons.
  - Tests: B05/B07 now allow a second, tiny early script in the head (accent colour). Checked: PC and phone 390 px screenshots against the mockup, purple theme recolour, no page errors. Not checked: the loader on a real phone

## v0.140.0
- Lane: U/I
- **Battle header fix (PC).** UI only. The short button labels (Log, Options, Concede) showed next to the long ones on PC ("LOGLog"); the PC header now shows one label per button, as in the mockup. Phone unchanged.
  - Checked: PC and phone 390 px screenshots of a live match, no page errors. Not checked: the full mockup-parity walk of the phone battle board (band, 4 slots) against `mockup-v14.html`.

## v0.139.0
- Lane: U/I
- **Brand logo, favicon and loading screen (U16).** UI only; no engine change. Backup: `backup/v0.138.0`.
  - **Logo:** the approved torii + six-gem emblem (`docs/design/aeterna-sigil-torii-gems-v2.svg`, no text inside) now sits left of the AETERNA wordmark in the PC header and the phone header (inline SVG symbol, symbol silhouettes only).
  - **Favicon:** simplified variant (torii + ring only, `docs/design/aeterna-favicon.svg`, embedded as an SVG data URI); checked at 16, 32 and 180 px. No `apple-touch-icon`: a PNG would break the "no base64 images" budget B06.
  - **Loading screen:** the approved animation (ring draws, torii rises, gems pop) is the first element of the page, pure inline SVG + CSS, transform / opacity only, no network. Boot is synchronous, so the screen fades out (0.6 s) the moment the app is ready; it is removed at once in sims, under automation and when animation is Reduced / Off or the device asks for reduced motion. The standalone `setProgress` API of the design file is not used (nothing to measure during a synchronous boot).
  - Size budgets B01 935 -> 965 KB and B02 264 -> 275 KB raised on purpose (~17 KB for loader + logo symbol).
  - Not checked: the loader animation on a real phone (screenshots from a 390 px desktop emulation only).

## v0.138.0
- Lane: U/I
- **Step animations, Slow speed, Text size, shortcuts list, dialogs in the mockup style.** Engine: display-only view records, no rule change. Backup: `backup/v0.137.0`.
  - **Core Step:** a core flies from the Void to the Reserve. **Draw Step:** a card slides from the deck to the hand. **Refresh Step:** up to 5 Trash cores fly (one by one) to the Reserve and heavy / exhausted cards turn back upright. The CPU's turn shows the same cues (Full animation mode only; Reduced and Off draw nothing). New view record `draw`; `core` now also takes the zones `void` and `trash` (protocol doc updated).
  - **Speed order is now Slow - Normal - Fast - Instant** (Settings > Game and the Play page). Slow is 1.8x Normal. The speed scales the step pauses, the CPU's thinking pauses and every animation (flights, turns, cues, ribbons); Instant plays no animation at all.
  - **Text size** (Normal / Large / Larger) in Settings > Accessibility scales the menu screens (not the battle board). **Keyboard shortcuts** list: press `?` or Settings > Accessibility > Show list.
  - Dialogs follow the mockup family: colour bar, outlined kind chip, italic title, right-aligned buttons, bottom sheet on phone.
  - **Not built (mockup "New features" items needing more than UI):** colour-blind shape markers, share code / QR, coin toss / mulligan card flips, "Saved" builder indicator.
  - Tests: step cue order and state, Slow order, Text size, `?` dialog (`step_anim_speed.test.mjs`); size budget B02 raised 256 -> 264 KB on purpose.

## v0.137.0
- Lane: U/I
- **Mockup parity part 2 (`docs/design/mockup-v14.html`): the whole app now uses the mockup stylesheet and markup, PC and phone.** UI only; no engine change. Backup: `backup/v0.136.0`.
  - Ported screens: Home (hero, Continue with, tiles, Daily missions, What's new, Last match), Play, My Decks, Library (+ Cards / Lore), deck builder, Settings (section menu, setrows), Learn (16 chapters, saved progress, glossary search), Profile (rank card, KPIs, win-rate chart, achievements, recent matches), Library card page (tilt, tags, effect text, art picker, level table, Add to deck, Copy Link, prev/next) and the battle header (Log, Emote, Options, Bug, red Concede; field captions on the phone).
  - Battle board layout stays as it was (old stylesheet); only the header and captions follow the mockup.
  - **Deviations from the mockup (report):** builder has 6 card-type chips and no Share / Set Active dialogs; Settings uses selects where the mockup has switches and omits mock-only settings; Learn has no practice boards; Profile name is fixed "Player", rank is wins-based, no XP; card page related cards = same-name printings, no family line, Copy Link has no `#card=` opener yet; Concede leaves the match without recording a loss; "Effects" animation menu, the 32 dialogs, the New features page and the Animation lab are mock-only and not built.
  - Tests follow the new markup (Settings sections, card page, Profile, battle captions); size budgets raised on purpose.

## v0.136.0
- Lane: U/I
- **Mockup parity part 1 (`docs/design/mockup-v14.html`): header, Lobby, Play, My Decks, Library, Settings, deck builder labels.** UI only; no engine change.
  - Header: 62px nav with the teal rule, gradient logo, Title Case tabs. Lobby: hero plus Card of the Day panel.
  - **Play** is three step cards (Your Deck, Opponent, Rules) with mode chips (VS CPU, Watch, Online vs Bot) and a ready box with Start Match (sticky on a phone). Not in the game: First Turn control (the engine has none), "Slow" speed, deck carousel.
  - **My Decks**: vertical tiles with a fan of the deck's three most-played cards (PC), Search Decks, Sort (Slot / Name / Cards), a dashed New Deck tile, Title Case labels. Win rate / last played from the mockup are not built.
  - **Library** opens with All Cards (browse grid, then Lore, then the data tools). The mockup's colour / cost chips and the Cards / Lore toggle are not built.
  - **Settings** and deck builder: Title Case labels. The deck builder layout (left filter rail, header bar) still differs from the mockup (top filter row, ring counter); not 1:1.
  - Phone: the Home button no longer squeezes the page title.
  - Tests updated for the new texts (My Decks, Settings, motto case). Audit: no horizontal overflow, no console errors at 1366 / 820 / 390.
  - The audit's "clip" and 16x16 `.db-info` findings were false positives (the `::after` touch area widens scroll width; the info button already has a 32px hit area).

## v0.135.0
- Lane: K
- Time: ~90 min, claude-sonnet-5-5; tokens not counted.
- **Standard block A: Form Change, "If C, B instead" pairs and (When Deployed): +11 complete (799 -> 810).** Effect schema **v9** (85 actions, 39 conditions; additions only).
  - **Form Change** `{{F Change|"X" & Cost N}} {{Invoke|Main}}`: action `FORM_CHANGE {match, costIn}` returns the exhausted source Spirit to the Hand and summons a Cost N card of the named group with a different name from the Hand without paying; the effect is not usable unless such a card is in the Hand (nothing is bounced for nothing) and is limited to once per turn per card name (`sameName`). The summoned card carries `viaFC` while its When Summoned effects resolve; every other summon path and a bounce clear it.
  - **Conditions `viaFormChange` ("If summoned via Form Change") and `not`** (`{"not": {one condition}}`, no nesting). `A. If C, B instead.` compiles to A with `if: {not: C}` and B with `if: C`; B may also be "the targeting BP / cost becomes N or less" (A with its number swapped). The compiler (`tools/compile_v2.py`) reads this pair for every condition it already knows, and `{{F Change}}` in `tools/compile_effects.py`.
  - **`(When Deployed)`** (the Nexus form of When Summoned) maps to the SUMMONED trigger.
  - **`sameName` once-per-turn is now keyed by the printed card name** (it was the card id), so two printings of one card share the limit, as the text says.
  - **Complete (+11):** Form Change heads 26RCB01-019, -021, -024, 26RSD07-004, -005, -007, -X02; "instead" 26RSD07-009 (draw two), 26RCB01-011 and -X02 (destroy BP up to 6000 / 10000); (When Deployed) 26RSD02-010.
  - **House readings (no rule page covers them):** the returned Spirit's cores go to the Reserve first and may pay the summoned card's Lv1 cores; "Parado" in `{{F Change|"Parado" ...}}` is read as the Para-DX cards (their data family is EX-AID; no card name contains "Parado"; 26RCB01-048 / -049 stay in review on other clauses). Three Eternal cards the new grammar also compiled (BS12-063, BS33-022, BS54-021) were NOT promoted: the first reads "send a core from any opposing Spirits" ambiguously and the two High Speed cards drop a printed refresh / reduction clause.
- Tests: `tests/unit/form_change.test.mjs` (FC-01..FC-06: bounce + free summon + flag, every refusal, once per name, flag cleared, real cards, the `not` pair), scenario `tests/scenarios/form-change-summon.json`. Budgets: B01 790 -> 796 KB, B02 224 -> 226 KB. Promotion sample read in full (8 of 8, seed 135).

## v0.134.1
- Lane: U/I
- Time: ~20 min, claude-sonnet-5-5.
- **Frontend audit fixes.** A scripted pass over every page at 320 to 1366 px (console errors, sideways scroll, clipped controls, unnamed buttons, duplicate ids) found only the header: the Report a Bug button of v0.134.0 made it wider than the screen, so on a 820 px tablet the new button and the sound / history buttons sat off-screen, and on small phones (320-380 px) the header was 3-46 px too wide.
  - **Header fit:** between 768 and 1100 px the tabs get tighter padding and the history / sound shortcuts are hidden (Settings still has them); on phones up to 420 px the brand and gaps shrink, and up to 380 px the Dark / Light switch is hidden from the header (the colour pop-up keeps it). Checked at 11 widths: no overflow, tabs never run into the tools.
  - **Report a Bug form:** field labels are left-aligned (they inherited the dialog's centring).
  - **Test:** U68-3 (playmat survives a reload) reloaded the page before the picture was written to the image store, which failed twice in CI; it now waits for the "Playmat set" message that comes after the write.
- No rule or data change. Full UI test set green (231).

## v0.134.0
- Lane: U/I
- Time: ~50 min (two items, one batch), claude-sonnet-5-5.
- **U14i Report a Bug and U15 progress; the U/I queue is done.** First release built as a batch (one push, one CI wait).
  - **Report a Bug (U14i):** a button in the header (every page) and in the home footer opens a form (type, summary, what happened, optional version / page / screen size). Send opens a pre-filled "new issue" page of the repository in a new tab; the player sends it with their own GitHub login. Nothing is sent from the app and no token is in the file. Escape or Cancel closes it; on a phone it is a bottom sheet.
  - **Progress (U15):** Settings > Profile now shows a **rank** (Rookie, Apprentice, Adept, Veteran, Master, Legend, by wins, with the way to the next one), **8 avatars** (the first three are free, the rest unlock with rank), **3 daily missions** (rotate by calendar day, count only today's matches; also shown on the home page) and **7 achievements**. All of it is derived from the saved match history on the device; the only stored value is the chosen avatar. No server, nothing touches the rules.
  - The other dialogs already share one shape with bottom sheets on phones (U5 / U14d2), so no further dialog work was needed.
  - Budgets: B04 100 -> 104 KB on purpose. Tests: `tests/unit/bug_report.test.mjs` (BR1-BR3), `tests/unit/progress_v15.test.mjs` (PG1-PG4). Backup branch `backup/v0.133.0`.

## v0.133.0
- Lane: U/I
- Time: ~25 min (session start → release), claude-sonnet-5-5.
- **U14h Lobby and pages.** Home: **Card of the Day** (the same card all day, chosen from the date; tap to open it), **Play in three steps** with a one-line summary of your deck, format and CPU deck, and **My decks** tiles (all 8 slots with card count and legal mark; tap one to make it the active deck). Settings: a **Profile** section with statistics read from the saved match history only (matches, wins, win rate, win streak, best streak, average turns, wins and losses per format). How to Play: a **Glossary** of every card keyword.
  - **U14h2 Settings regrouped** into Appearance, Game (speed, CPU style, online server), Animation and sound, Accessibility (long-press) and Cards and saved data (card images, reset, then Profile and Match history); every control and id is unchanged, only the grouping and menu changed.
  - Budgets: B01 780 -> 790 KB and B02 220 -> 224 KB on purpose. Tests: `tests/unit/home_v14.test.mjs` (HM1-HM4). Backup branch `backup/v0.132.0`.

## v0.132.0
- Lane: U/I
- Time: ~25 min (session start → release), claude-sonnet-5-5.
- **U14g2 Library card page.** Opening a card from the Library now shows, under the card detail: **Related cards** (other printings with the same name, tap to switch), **Used in decks** (your saved decks that hold the card, with the count) and **Alternative art** (pick the picture of another printing for this card; kept in this browser, one tap returns to the original). The card face tilts with the pointer when animations are Full.
  - Only in the Library, never during a match. Display only: no rule changes. The art list is the printings the card data already knows; no new image source was added.
  - Budgets: B01 772 -> 780 KB and B02 218 -> 220 KB on purpose. Tests: `tests/unit/library_cardpage.test.mjs` (CP1-CP3).

## v0.131.0
- Lane: U/I
- Time: ~60 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14g part 1 Library: the Lore section.** Eleventh step of the v14 redesign. The flavor texts printed on the cards, read in order by series, with a series dropdown; tapping an entry opens that card.
  - **Data tool:** `tools/fetch_flavor.py` reads the English flavor text (`enflavorN`) of every library card from the Fandom wiki through its MediaWiki API (read-only GET, 50 titles per call, cached in `build/flavor-cache.json`, `--offline` re-parses the cache) and writes `data/index/flavor.json` (card id → text; 5,462 of 6,892 cards have one). The printing whose set matches the card id is used. Flavor text is card text, so it stays data, not code.
  - **In the page:** the index rides as a compressed blob (`BUILTIN_FLAVOR`, built by `tools/build.mjs`, about 0.4 MB) and is decoded only when the Library page opens (`apps/web/src/13m-lore.js`); the headless engine script does not carry it. New budget B15 (blob under 500 KB, decoded lazily); B01 / B02 / B04 measure the page without it.
  - **Left for U14g2:** the card page (tilt, levels, related cards, used in decks) and the alternative art picker with its per-card image list.
  - Tests: `tests/unit/library_lore.test.mjs` (LO1-LO4). Backup branch `backup/v0.130.0`.

## v0.130.0
- Lane: U/I
- Time: ~40 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14f3 Deck builder: Group and Colour dropdowns.** Tenth step of the v14 redesign; closes the deck builder item U14f.
  - **Group** is a dropdown on every screen (one group at a time); **Colour** is a dropdown on phone and keeps its chip row on PC. When chips set more than one value the dropdown reads "Several". The hidden chips stay in the page, so the filter code and the old tests still work.
  - The dropdowns are 44 px tall (the touch target the D09 test checks); D09 now measures the visible chips and the dropdowns.
  - **Moved / left:** the alternative art picker goes to U14g (it needs a per-card list of alternative images); the sideways-scrolling phone toolbar rows stay as they are, the header menu already holds them.
  - Tests: `tests/unit/deckbuilder_v14_part3.test.mjs` (DD1-DD2); `deckbuilder_layout` D09 updated. Backup branch `backup/v0.129.0`.

## v0.129.0
- Lane: U/I
- Time: ~25 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14f2 Deck builder: fly-to-deck and long-press for card info.** Ninth step of the v14 redesign.
  - **Fly-to-deck:** adding a card from the grid flies a small card to the deck panel (Full animations only; Reduced and Off show nothing).
  - **Long-press for card info (touch):** holding a grid card for about half a second opens its card detail instead of adding it, and the tap that ends the hold adds nothing. A new Settings row **Long-press for card info** (On by default) turns it off; PC clicks are unchanged.
  - **Moved:** the alternative art picker needs a per-card list of alternative images, which U14g builds, so it moves there. **Left for U14f3:** Group / Colour dropdowns and the phone toolbar rows that scroll sideways.
  - Tests: `tests/unit/deckbuilder_v14_part2.test.mjs` (LP1-LP2, FL1, ST1). Backup branch `backup/v0.128.0`.

## v0.128.0
- Lane: U/I
- Time: ~50 min (session start → release), claude-sonnet-5-5 (U14f is listed for Opus; this part is UI only); tokens not counted (no gate counter in this harness).
- **U14f part 1 Deck builder: Redo, Test hand, card size, count ring, hover peek.** Eighth step of the v14 redesign (also closes U14e2 by checking it).
  - **Redo** next to Undo (a new change empties it). **Test hand** deals the 4-card starting Hand from the deck in a dialog; Draw again reshuffles (it uses `crypto.getRandomValues`, never the match RNG; OB-04 still allows one `Math.random`).
  - **Card size S / M / L** (PC; saved on the device) for the card grid; the phone keeps its three columns.
  - **Count ring:** the N/40 pill gets a progress ring (amber while the deck is not legal) and is a parallelogram like the other controls.
  - **Hover peek (PC):** the card, enlarged with its effect text, after a short pause over a grid card.
  - **U14e2 checked, nothing to build:** the phone command menu is already a two-column bottom sheet and the step strip already centres the active step. The five locked cells per side stay BLOCKED until the owner decides how the Burst / Soul areas move (five cells make 43 px cards at the current layout).
  - **Left for U14f2:** fly-to-deck add, alternative art picker, long-press card info setting, Group / Colour dropdowns, the phone toolbar rows.
  - Budget: B01 760 → 772 KB and B04 96 → 100 KB (note in the test). Tests: `tests/unit/deckbuilder_v14_part1.test.mjs` (DB1-DB4). Backup branch `backup/v0.127.0`.

## v0.127.0
- Lane: U/I
- Time: ~45 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14e part 1 Battle phone: the header fits again.** Seventh step of the v14 redesign. The Options (v0.122.0) and Emote (v0.125.0) buttons pushed EXIT TO LOBBY off the right edge of the phone header; found by the three-width screenshot pass this release.
  - **Header:** on phone the tools show icons (LOG, emoticon, gear, EXIT) with accessible names; PC keeps the words. The version label hides on phone. Checked at 360 / 390 / 430: every tool inside the screen, no sideways scroll.
  - **Tried and reverted:** hiding the zoom corner on phone field cards; U24 / U27 use it on phone.
  - **Tried and reverted:** five square cells per row. With the Burst / Soul areas on both sides the row is about 300 px, so five cells make 43 px cards whose name and BP are unreadable; the existing swipeable row stays (X1 test unchanged). The five-cell fit needs those areas moved: queued as U14e2 with the centred step strip and the two-column command menu.
  - Tests: `tests/unit/ui_battle_phone_v14.test.mjs` (PH360 / PH390 / PH430). Backup branch `backup/v0.126.0`.

## v0.126.0
- Lane: U/I
- Time: ~35 min (session start → release), claude-sonnet-5-5 (the item is listed for Opus; the engine part is two display-only records); tokens not counted (no gate counter in this harness).
- **U14d3 Cores fly between zones and a Burst flips face up.** Sixth step of the v14 redesign; closes U8b.
  - **Engine:** two display-only view records, both in `VIEW_TYPES`: `core {side, kind, from, to}` (kind `core` or `soul`; from / to = a card uid or `reserve`) sent by `addCore`, `removeCore`, `moveCore`, `moveSoulTo`, `swapSoul` and `returnSoul` in `packages/engine/src/06-rules.js`, and `burst {side, id}` sent when a set Burst is flipped (`maybeBurst`, `08-battle.js`). They change no state and are not part of the match record; the headless and server hosts ignore them.
  - **Web:** the records arrive just before the board is redrawn, so a gem flies from one rect to the other (Soul Core silver) and a flipped Burst turns face up where it was set. Full only: Reduced and Off draw nothing, sims draw nothing.
  - Budget: no change. Tests: `tests/unit/core_fly_burst_flip.test.mjs` (CF01-CF03); `headless_engine` expects the two new view types. Backup branch `backup/v0.125.0`.

## v0.125.0
- Lane: U/I
- Time: ~40 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14d2 Effect Active panel and emoticons.** Fifth step of the v14 redesign.
  - **Engine:** a new display-only view record `{type:'effect', side, id, text}` is sent when a card effect starts resolving (`runActions`, `packages/engine/src/02d-effects-resolve.js`); it is in `VIEW_TYPES` (protocol), so the headless and server hosts accept it and ignore it. It changes no game state and is not part of the match record.
  - **Panel:** the web host shows "Effect Active" with the card and what the effect does for 1.4 s in the overlay layer (never blocks a tap; nothing under Animations Off or in sims).
  - **Emoticons:** an EMOTE button in the battle header opens 12 icons; one every 30 s (the picker shows the wait), the pick floats above the board for 2 s. New part `apps/web/src/13l-emote.js`.
  - **Left for U14d3 (Opus):** cores flying between zones, the Burst flip and the Soul Core move.
  - Budget: B02 raised 212 → 218 KB (note in the test). Tests: `tests/unit/effect_panel_emote.test.mjs` (EF01-02, EM01-02); `headless_engine` expects the new view type. Backup branch `backup/v0.124.0`.

## v0.124.0
- Lane: U/I
- Time: ~25 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14d part 1 Battle animation: arrow attack, destroy shatter, exhaust turn.** Fourth step of the v14 redesign; board-diff cues only (`apps/web/src/13g-anim.js`), no engine change.
  - **Arrow attack:** the old thin beam is a thick arrow with a head that shoots after the attacker has turned (0.18 s delay); Reduced keeps the still fade.
  - **Destroy:** a flash and six shards where the card stood, on top of the existing fade (Full only).
  - **Exhaust:** a card that exhausts turns 90 degrees, a heavy exhaust 180, and a Refresh turns it back one level, as a Web Animation on the card (transform only, the locked cells never move). Reduced and Off do not animate.
  - **Part 2 (U14d2, Opus) stays queued:** core moves, Burst and Soul Core move need engine events, plus the effect notice panel and the emoticons with the 30 s limit.
  - Budget: B01 raised 750 → 760 KB (note in the test). Tests: `tests/unit/battle_animations_v14.test.mjs` (AN01-AN03). No screenshot: the cues last under a second and tests assert them in the overlay. Backup branch `backup/v0.123.0`.

## v0.123.0
- Lane: U/I
- Time: ~25 min (session start → release), claude-sonnet-5-5 (the item is listed for Opus; it turned out to be naming only); tokens not counted (no gate counter in this harness).
- **U14c Battle commands: the card menu uses the mockup names.** Third step of the v14 redesign. The tap menu on a hand or field card already carried every command through intents (`packages/engine/src/05c-intent.js`), so this release only renames them: **Place Nexus** (was Deploy), **+ Core (from Reserve)**, **− Core (to Reserve)**, **Card Info** (was Full Card Details); the online board uses the same words.
  - **Checked and left alone:** every step is shown in order for both sides (`07-turn.js`, `09-cpu.js`), and the turn-1 rule (Core step skipped, Draw still happens, Attack and Second Main skipped in Standard) is already in `05c-intent.js`.
  - **Not added on purpose:** a manual Exhaust / Refresh command. The rules only exhaust a card through an attack or an effect, so a free toggle would break them; recorded in `docs/ai/roadmap-open.md`.
  - Tests: `tests/unit/ui_command_menu.test.mjs` (CM01-CM02); `tests/legacy/burst_layout.py` reads "Card Info". Backup branch `backup/v0.122.0`.

## v0.122.0
- Lane: U/I
- Time: ~35 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14b Battle PC: a Card Panel left of the board and an Options button.** Second step of the v14 redesign (`docs/design/mockup-v14.html`).
  - **Card Panel (PC only):** a panel left of the board shows the card under the pointer (hand or field) with its face and effect text; it keeps the last card across re-renders and a tap on the picture opens the full card. New part `apps/web/src/13k-cardpanel.js`; the board layout becomes a two-column grid only when the panel is drawn (`.playmat-layout.has-cp`), so the phone and the online board are unchanged.
  - **Options:** a header button opens Settings from a running match; **BACK TO MATCH** returns to the same match. It is not a replay input.
  - **Already in earlier releases, checked and left alone:** locked field cells (X1), step band with the log line and GAME OVER label (U1), the Deck plate in your sleeve picture (U7). The separate field-background upload is left out: the Playmat image setting already fills the board.
  - Tests: `tests/unit/ui_card_panel.test.mjs` (CP01-CP04). Backup branch `backup/v0.121.0`.

## v0.121.0
- Lane: U/I
- Time: ~45 min (session start → release), claude-sonnet-5-5; tokens not counted (no gate counter in this harness).
- **U14a Foundations: three embedded fonts, parallelogram controls, soft light palette.** First step of the v14 redesign (`docs/design/mockup-v14.html`).
  - **Fonts:** Oxanium (display), Saira (text) and Orbitron (numbers), SIL OFL, Latin subsets in `apps/web/fonts/` (~52 KB, licences beside them); `tools/build.mjs` inlines them as `@font-face` data URIs, so the file still has no network request. Tokens `--f-display`, `--f-text`, `--f-num`.
  - **Shape:** buttons, chips, pills and selects use one parallelogram (`--par` clip-path, text stays upright) and the button scale PC 40 / 34, phone 46 / 42; the NEXT button is a parallelogram too. Round dots, gems and card badges keep their circles.
  - **Light mode:** panels, heads and row backgrounds are soft grey (`#e7eaee`, `#e1e5ea`), never pure white.
  - **Budget:** B01/B02/B04 now measure the page without the fonts; new B14 caps the fonts (exactly the three, under 80 KB); B06 allows only `data:font/woff2`. B01 raised 745 → 750 KB for the foundations CSS.
  - **Not in this release:** the Title Case sweep. Tests read the visible upper-case text, so each page converts its labels when U14b-U14i rebuild it.
  - Backup branch `backup/v0.120.0`.

## v0.120.0
- Lane: K
- Time: ~90 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Standard block A keyword head Amplify (`{{Amplify|family +N}}`): +6 complete.** The head reads "for each [family] Spirit you control, during this battle, this Spirit gains +N BP". Engine pieces, in one commit:
  - `BP_TARGET` gains a `per` field (`{type:'Spirit'|'Nexus', family|colors|name}`), counted when the Invoke resolves and the source itself counts — the Leucomyst Amplify cards use `{"trigger":"ACTIVATE","invoke":true,"timing":["MAIN","FLASH"],"when":"duringAttackBlock","once":true,"oncePer":"battle","cost":{"pay":1},"actions":[{"do":"BP_TARGET","n":1000,"to":"self","battle":true,"per":{"type":"Spirit","family":"Leucomyst"}}]}`.
  - `match.keyword` ("a Spirit with Amplify") now reads the card's `keywords` list first (the `{{Amplify|…}}` head prints no "(…)" suffix), falling back to the old text regex.
  - The effect-level `match` parser now keeps `keyword` / `familyAll` / `noText`, which it used to drop silently (an effect match with only `keyword` matched *everything*).
  - `AMPLIFY` registered in `KEYWORD_GLOSSARY` and `data/glossary/mechanics.json` `kw:amplify` marked done. Effect format bumped to schema v7.
- **Complete (+6):** 26RBS01-048 Goztaurus, 050 Claydoro, 051 Meztaurus, 056 Stelgatgun, 059 The HollowRadiance Pepper's Dragon, 060 Mudoro (all `Leucomyst` Amplify + their already-compiled clauses). 054 / 057 / X11 get their Amplify wired but stay `!` (their "Your End Step: refresh" / "when this Spirit's BP becomes N or more" clauses still need mechanics). The True Release head on 048/050/057/059/X11 is now the `trueRelease` flag.
- **Promotion track (owner: "promosi bertahap" in parallel):** bulk promotion of the remaining 1,819 staged cards is *not* a batch operation — `tools/compile_v2.py --partial` rejects the "ready" pool per card (745 A1 data gate: missing/broken levels or cost; malformed export text; Magic paragraphs without Main/Flash; grammar gaps like `{{sumcon|…}}`). So promotion stays per-card hand-wiring (read → effects JSON → `card_verify` → promote), the same path this Amplify head used. No new playable cards this release; `playable 6,890 / 8,709, complete 796`.
- Tests: `tests/unit/amplify.test.mjs` (AMP-01..04: per-count, the source counts, the battle bonus ends with the battle, and `match.keyword` via the keywords list); scenario `tests/scenarios/amplify-leucomyst-bp.json` (rules `ETR:faq.bp@134528fb`). Full suite green (1504 + 4 new).

## v0.119.0
- Lane: U/I
- Time: ~60 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Deck builder (owner request): mechanic groupings, a visible Save, back to My decks, and card images.** The filter rail gains a **Group** section with chips **All colour** (rainbow = a card with two or more colours), **Mirage**, **Rebirth**, **Legacy** and **EX symbol** — each reads the modelled card field (`colors` / `mirage` / `rebirthTo|rebirthSide` / `legacy` / `exSymbols`), with the same removable-chips + Clear-all behaviour as the other filters.
  - **Save deck**: the deck already auto-saved, but there was no visible button, so the header tools and the deck panel now carry a **SAVE** button that also captures the name input and flashes "SAVED ✓". The "◄ Back to Lobby" tool is replaced by **‹ Back to My decks** (saves first, then opens the My decks page); the header "‹ MY DECKS" stays.
  - **Ultimate cards showed only a top-left corner** of their art: `.tcg-card.ult`'s `background:` shorthand reset `.has-img`'s `cover`/`center` (the shorthand re-set `background-size` to `auto` and `background-position` to the corner). It is now `background-image:`, so an Ultimate with art covers the card face centred.
  - **The deck list now shows a card thumbnail** (the card image where one is loaded, else a colour swatch with the type letter) before each name.
- Tests: `tests/unit/deckbuilder_groups_images.test.mjs` (DBG-01..04: the group chips, the rainbow filter, the deck-row thumbnails, and the Ultimate cover/center fix); the deck-builder control list in `ui_card_name_wrap` N08 now measures SAVE + back-to-My-decks instead of Back-to-Lobby. `npm run -s loop -- --full` green (1504).

## v0.118.0
- Lane: K
- Time: ~70 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Rumble keyword head (`{{Rumble|X}}`), the Blue deck's mill mechanic — first Standard block A keyword of the K lane.** `{{Rumble|X}} (During Attack)`: at the end of the battle, discard X cards from the opposing decktop, minus the cost of the blocking Spirit card when it is now in the opposing Trash (Fandom keyword page "Rumble", official Q&A 31592-31594/31621). Engine:
  - Action `RUMBLE {n:1-7}` in `02o-effects-battle-end.js`, queued at the `ATTACKS` trigger and resolved in `endOfBattle()` next to Curse/Brilliance, so it shares their timing and survival rules: the attacker must still be on the Field, only a Spirit blocker that reached the Trash reduces the mill (a bounced blocker or an Ultimate blocker does not), and the mill is clamped at 0 when the blocker's cost covers X.
  - `RUMBLE` added to `KEYWORD_GLOSSARY`, and the 10 `{{Rumble|X}}` cards carry `keywords: ["Rumble"]` so the later "Spirit with Rumble" support cards can match them. Effect schema **v6** (84 actions; addition only).
  - **+4 complete**: 26RBS01-079 Fergus, -084 Ganasha, -087 Madra-Magona, 26RBS02-067 Phalotes. Six more Rumble holders now run their Rumble clause and keep only their other residual (26RBS01-077/-081/-082/-089/-X18, 26RBS02-070 — "Your End Step refresh", "two or more Blue symbols", "draw two then return two", and "when discarded by your Rumble").
- Tests: `tests/unit/rumble.test.mjs` RUM-01..05 (unblocked full mill, blocker cost covers X → 0, cost 1 → X−1, attacker destroyed → no mill, shipped cards carry the keyword/effect), scenario `tests/scenarios/rumble-end-of-battle-mill.json`; size budget B01 raised 740 → 745 KB (the first Standard keyword head is new engine code). `npm run -s loop` and `fx_validate --static` green.

## v0.117.0
- Lane: U/I
- Time: ~40 min (two tasks: the unfinished v0.116.0 release tail, then the gate repair), deepseek-v4-flash-vision-exp; tokens not counted (no gate counter in this harness).
- **Regression gate green again: the offline-single-file invariant now runs in the quick loop, and the online room code left `Math.random` alone.** Every tag Regression run from v0.108.0 to v0.116.0 came back red on the same two checks — `cleanup_review_tests` D2 ("source has no fetch/XHR/WebSocket/eval/Function constructor") and `seed_replay_tests` [5] ("game logic no longer uses Math.random") — while CI stayed green, because both checks live only in the Python suites and no local loop runs them. The invariant is still right (a local match must not touch the network; only the seed generator may use `Math.random`), so it is scoped to the one opt-in exception instead of forbidding the feature:
  - `tests/unit/offline_bundle.test.mjs` (new, OB-01..OB-05, so `npm run loop` and CI fail on a regression): the engine and protocol parts never fetch, open a socket or eval; only `13i-online.js` and `13j-online-lobby.js` may; every call site in the built page comes from those two; `Math.random` appears exactly once (the seed generator in `00-config.js`); and only the online modules start an online match, so a `file://` game stays offline.
  - `cleanup_review_tests` D2 becomes D2a-D2c (engine clean / only the online modules / the page's call sites add up) with a "call site, not the bare word" pattern: the How-to-play text names the WebSocket the online room uses.
  - `13i-online.js`: a quick-match room code comes from `crypto.getRandomValues` (clock fallback) instead of `Math.random`, so the seeded RNG stays the engine's own — a room id is not game state. `seed_replay` [5] then passes unchanged.
- **Housekeeping from the unfinished v0.116.0 tail:** that version's GitHub Release had never been created, so it is created now (tag `v0.116.0`, asset `aeterna-v0.116.0.html`), and the 39 releases `v0.69.1`-`v0.103.0` that the `Release` workflow has never managed to create are backfilled — all 77 versions from `v0.57.1` on now have one (the workflow's 403 is account-level, see `docs/ai/release.md`; a session runs `tools/make_releases.sh` instead). The 39 tag pushes started 39 Regression runs; they were cancelled, since `tools/regression_due.sh` ignores a `cancelled` run. Trap recorded in `docs/ai/release.md`.
- Tests: new OB-01..OB-05; `npm run -s loop` green. Python Playwright is not installed in this environment, so the scoped D2 and `seed_replay` [5] were verified against the rebuilt page with the same patterns locally, and the Regression dispatch is the confirmation.

## v0.116.0
- Lane: K
- Time: ~45 min (session start → release), deepseek-v4-flash-vision-exp; tokens not counted (no gate counter in this harness).
- **Standard block A keyword head 1: "When you use a Magic card" (trigger `MAGIC_USED`) + condition `magicUsed`.** The 26RBS01 pack's `(Opposing Attack Step)` watchers had no engine event for a Magic being used, so their clauses sat in `residual`. The trigger fires once the Magic has resolved (the card is in the Trash by then, as after a summon), carries the used card as `ctx.subject` so `match` filters it (`{type:"Magic",family:["Topaz"]}` / `{type:"Magic",color:"yellow"}`), and is skipped for a Burst (a Burst activation is not a use of a Magic card). `magicUsed` answers "if you used a X Magic card this turn" from the per-turn record the same hook writes.
  - +6 complete cards, all in Standard block A: 26RBS01-061 Stodol, -062 Aloucast, -065 Terra-Cotta, -067 Thunder Squatch, -068 Snakrowley (both its clauses), -074 The HeavyThunder Enurai (LV2 clause; its LV1-2 reveal already ran). 26RBS01-062 and -068 now carry `trueRelease: true`, which their printed `[LV2] (True Release)` head states.
  - Engine: `FX_TRIGGERS` + `FX_TRIGGER_TEXT` + `FX_COND_KEYS` (`02a-effects-base.js`), the subject-match branch in `fxValid` (`02d-effects-resolve.js`), `castMagic` writes the per-turn record and fires the trigger (`06-rules.js`), and `parseCond` accepts the new condition (`02c-effects-parse.js`) — a condition missing from that list drops the card at load, which is how 26RBS01-068 was caught.
  - Effect schema **v5** (`tools/fx_schema.mjs`): 28 triggers, 37 conditions (additions only, every v4 card stays valid). Scenario `tests/scenarios/magic-used-topaz-battle-bp.json`, tests M116-01..05 (`tests/unit/magic_used_trigger.test.mjs`): the battle BP applies only inside that battle, another family does not fire it, the condition reads the turn record, and 068 draws two only after a Topaz Magic was used.

## v0.115.0
- Lane: U/I
- Time: ~20 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Card-session prep tooling (pipeline review follow-ups).** The effect-input / engine-update pipeline is already sound (effects as data + a source-generated schema + dual validation + the honest partial-card `residual`), so this adds the review's four follow-ups instead of touching the format:
  - `tools/residual_tags.py` → `data/glossary/residual-tags.json` + `docs/reports/residual-blockers.md`: classifies each partial card's `residual` clauses with the glossary patterns and ranks the partial/missing blockers by how many cards they keep incomplete — the "what to build next" signal without a scratch recompile.
  - `tools/compiler_wiring.mjs` → `docs/reports/compiler-wiring.md`: lists the engine actions the two text compilers cannot emit (hand-write only), so a card session knows which actions are data-only vs engine work.
  - `docs/ai/effect-format.md` now states that `npm run loop` runs `fx_validate --static` and the live `BS.parseCard` gate is test FS03 (pre-push / CI).
  - `python3 tools/card_verify.py` is named in the promotion path (`tools/promote_compiled.mjs`, skill `bs-effect-mechanic-adder`): the compiler is a measurement tool, never the source of correctness.
  - Freshness is gated by `tests/unit/tooling_reports.test.mjs` (full set only, so the ~15 s loop stays fast). No change to the shipped game file.

## v0.114.0
- Lane: U/I
- Time: ~30 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Card images online, part 3: switch the art source to the official battlespirits.com card database.** The Fandom wiki `File:` names were stale for most old sagas (about 5 of 18 sampled cards resolved; `File:Gora.jpg` is `missing`), so many cards stayed on the placeholder. The official card list serves every card directly by number, so the image URL is now derived from the card id — no wiki / MediaWiki API resolution:
  - The client's `cardImgSrc(id)` keys on the **card id** (not the `image` field), so `/assets/card-images/<card-id>`; the Cloudflare Pages Function and the Node server (`apps/server/src/card-images.mjs`) both proxy `https://www.battlespirits.com/images/cardlist/<card-id>.webp?v2` (WebP, uniform size) on demand and cache for a day.
  - This also fixes the Ultimate-card crop in the Library grid: the official images are all the same aspect ratio, while the wiki's Ultimate scans varied and `object-fit: cover` clipped them to a sliver.
  - The Fandom `image` field stays in the card data as metadata; the image-serving path no longer uses it. A card the official site lacks (unknown id) is a 404 and the client still falls back to its text/colour placeholder.
- Tests: `server_card_images` CIMG-S1..S4 rewritten for the official-URL proxy (proxied + disk cache, missing → 404, separators/dot-files/extensions refused + 405, opt-in route) and `card_images_client` CIMG-2 updated to the card-id URL; full quick suite green.
- Left optional (in the plan): bulk pre-fetch + `cwebp` re-encode, an offline URL manifest, alternate-art / per-language art.

## v0.113.0
- Lane: U/I
- Time: ~20 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Card images online, part 2: the static Cloudflare Pages deployment now serves official art.** The Pages site has no Node process, so the v0.112.0 mirror (which only runs in `apps/server`) could not serve `/assets/card-images/<file>` — the route fell back to `index.html` and the client showed its text/colour placeholder. Fix:
  - A Cloudflare Pages Function `functions/assets/card-images/[file].js` mirrors the same route at the edge: it resolves the card's `image` field (the Fandom wiki `File:` name) through the MediaWiki API, downloads the art with the Referer the wiki CDN requires (a browser cannot), sniffs the type from bytes, and caches the response in the Cloudflare cache for a day. Missing / malformed names are a 404 and the client still falls back gracefully.
  - `.github/workflows/deploy-pages.yml` now stages `functions/` beside `index.html` (`cp -r functions dist/`), so `wrangler pages deploy` ships the Function with the static file. No change to the offline single-file game.
- Tests: the Function mirrors the already-tested `apps/server/src/card-images.mjs` logic (`server_card_images` CIMG-S1..S4); verified end-to-end on the deployed Pages URL (`/assets/card-images/<file>` returns the image bytes, not the SPA fallback).
- Left optional (in the plan): bulk pre-fetch + `cwebp` re-encode, an offline URL manifest, alternate-art / per-language art.

## v0.112.0
- Lane: U/I
- Time: ~45 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Card images online, part 1 (Aegis-style official art): the server mirror + client fallback chain.** (`docs/reports/card-image-plan.md`)
  - `apps/server` gains `GET /assets/card-images/<file>`: it resolves a card's `image` field (the Fandom wiki `File:` name) through the MediaWiki API, downloads and caches the art in a git-ignored mirror dir, and serves it — the type is sniffed from bytes, so the wiki's WebP transcode of a `.png`/`.jpg` name is served correctly. On-demand + cache: the first request for a card pays one wiki fetch, later ones are served from disk.
  - The client's `cardImgSrc(id)` now falls back **player image (IndexedDB) → the online server's mirror → nothing (the text/colour placeholder)**, wired into `imgCls`/`imgSty` (hand, field, deck builder, library, online board) and `cardFaceHTML` (zoom, strips, details). The player's own image always wins; offline play is unchanged (no server → player images only).
  - The Fandom CDN blocks hotlinks without a `Referer` header (403), so the mirror fetch sends one; the wiki is the already-approved read-only source.
- Tests: `server_card_images` CIMG-S1..S4 (download + disk cache, missing → 404, path traversal + 405, opt-in route) and `card_images_client` CIMG-2 (player > mirror > placeholder precedence); full quick suite green.
- Left for a later U/I session (optional, in the plan): bulk pre-fetch + `cwebp` re-encode, an offline URL manifest, alternate-art / per-language art.

## v0.111.0
- Lane: U/I
- Time: ~40 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **Card images, part 1 (roadmap U/I "card images"): the Library browse grid — a browsable, searchable grid of every card.**
  - The Library gains a "Browse cards" section: a windowed grid (the deck builder's index + grid CSS) of every non-token card, filtered by search (name / ID / effect text), set and type, with the player's card images where they were added and a tap that zooms the card.
  - This closes the "the Library has no card grid" gap and makes the player-supplied card-image feature browsable; the rest of the feature (import → IndexedDB → display in hand / field / deck / zoom / strips / the online board) was already in place.
  - Size budget B01 raised 730 → 740 KB and B02 208 → 212 KB with a note (the grid is new client code).
- Tests: `library_grid` CIMG-1 (the grid renders, filters by search/set and zooms a card); full quick suite 1478 passes; lint and `npm run check` green.

## v0.110.0
- Lane: U/I
- Time: ~35 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **M8 online client, part 3 (roadmap M8): the Accel / Contract Advent / Manifest / activation intents and the game log — M8 done.**
  - The online hand menu now offers **Contract Advent** (`cadvent`) and **Manifest** (`manifest`) for cards that carry them, plus one **Accel** entry per Accel effect; the online field menu offers **Activate** (`act`) for each activated [Main] effect and **Brave combine / separate** (`bcombine`/`bseparate`). These intents were already accepted by the server's authoritative `applyIntent` (v0.108.0); part 3 only completes the menus — a refusal still re-delivers the decision with the `acted ok:false` note.
  - The seat frame now carries `log` (the last 200 game-log entries) in `boardSnapshot`, and the online header has a 📜 LOG button that opens the game log. The log is shared public text (face-down Bursts and draws are never logged by name), so no hidden card leaves the server; local viewer replays keep their own record and gain no `log`.
  - Remaining online board gaps (outside M8's lobby/room/account scope) are noted in the roadmap for a later session: core move / Soul Core moves (`core` with `move|soul|unsoul|swaphere|swapsoul`), Revive from Soul State and summon-from-Removed.
- Tests: `online_client` M8-40 now also asserts the seat frame carries a non-empty `log`; the full online match (M8-41) and the lobby (M8-42) stay green; full quick suite 1477 passes; lint and `npm run check` green.

## v0.109.0
- Lane: U/I
- Time: ~45 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **M8 online client, part 2 (roadmap M8): the online lobby with quick match / private room codes and the account panel.**
  - New `view-online` lobby (`apps/web/index.template.html` + `apps/web/src/13j-online-lobby.js`): **quick match** (a fresh room vs the server bot, auto code), **private room** (enter a code to join — or create — that room; the room id is the shareable code), and the **account panel** beside them. The Play page's ONLINE mode now opens this lobby; the match terminal (`13i-online.js`) is unchanged.
  - Account panel over the existing HTTP API: it shows the signed-in account from `/api/me`, signs in by magic link (`POST /api/login`; a local run without a mailer returns the link so it can be opened directly, a deployment mails it) or by Discord (the button is offered only when the server configured OAuth), and signs out (`POST /api/logout`). `/api/config` now also reports `discord` so the lobby can hide the Discord button without a provider.
  - `onlineStart(code)` takes an optional room code; without one it keeps the auto `local-…` code.
  - Size budget B01 raised 725 → 730 KB with a note (the lobby + account panel are new client code beside the match terminal; B02 stays 208 KB).
- Tests: `online_client` M8-42 (the lobby renders the account state and a private room code joins that exact room), `server_http` API09 (`/api/config` reports the ws endpoint and the Discord flag), plus the existing online/server suites; `npm run -s loop`, lint and `npm run check` green.

## v0.108.0
- Lane: U/I
- Time: ~75 min (session start → release), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **M8 online client, part 1 (roadmap M8, `docs/ai/monorepo-plan.md`): the ONLINE VS BOT mode plays through the server.**
  - `apps/web/src/13i-online.js`: a thin terminal that connects to the room server over WebSocket, renders its seat-filtered frames and answers its decision records (choice / pick / payment / info / action). Board actions send intents by uid and the server's `applyIntent` is authoritative — a refusal re-delivers the decision and an `acted ok:false` note marks the move illegal. The offline single-file game is untouched (its host is still `13e-host.js`).
  - The server now serves the built client at `/` (`serve.mjs` reads the repo-root `index.html`; `http.mjs` got a static route) and tells the client its WebSocket endpoint through `GET /api/config` (`serve.mjs` starts the ws first and passes `wsUrl`), so one `node apps/server/src/serve.mjs` is enough to open the online client in a browser.
  - `boardSnapshot` (engine) gained `steps` (the step list), `hu` (the seat's hand uids, so hand taps send intents by uid) and `h` + `bp` (each field card's heavy flag and its current BP as the engine computes it) — the online board draws correct BP without running the engine; the viewer replay ignores the new fields.
  - `rooms.mjs` accepts the player's own deck as a card map (capped 120 entries / 4 copies), not only a prebuilt id, so a custom deck plays online; `host.mjs` broadcasts `acted` so the client learns an intent was refused.
  - Board actions offered in part 1: NEXT + step chips, summon / cast / burst / mirage / brave from the hand, attack and core add/remove on the field. Accel, Contract Advent, Manifest, effect activations, the game log, the lobby with quick match / private room codes and the account panel are the part 2 follow-ups.
- **Size budget raised with a note:** B01 700 → 725 KB and B02 200 → 208 KB (gzip), because the online client is a second board renderer — the offline renderer reads the live engine `G`, the online one reads the server frames, so its HTML builders are new code.
- Tests: `tests/unit/online_client.test.mjs` (M8-40 the frame carries `steps`/`hu`/`h`/`bp`; M8-41 the served client plays a whole online match against the server bot to the end, auto-answered), plus `server_rooms`/`server_http`/`server_serve`/`server_clients` still green; `npm run -s loop -- --full`, `npm run check` and lint green.

## v0.107.0
- Lane: U/I
- Time: ~40 min (release session 16:20 → 17:00 WIB, wrapping the M7 steps 2-7 committed earlier today), deepseek-v4-pro; tokens not counted (no gate counter in this harness).
- **M7 database + Docker done (steps 2-7): server accounts, HTTP API, match/replay store, Discord OAuth and the compose image.**
  - Store contract and Postgres binding (step 2): `apps/server/src/store.mjs` + `store-pg.mjs` (SV01-SV05 contract tests, live SP01-SP04), and the `db` CI job applies the migrations twice against a Postgres 16 service container.
  - Magic-link login and sessions (step 3): `db/migrations/0002_sessions.sql` + `apps/server/src/accounts.mjs` — single-use hashed tokens, `HttpOnly` sessions (AA01-AA08), SP05 for the live half.
  - HTTP API (step 4): `apps/server/src/http.mjs` — the account and library routes, cookie-only auth (API01-API06).
  - A finished room writes its match and replay through the store (step 5).
  - Discord OAuth login and the server image for compose (step 6-7): `apps/server/src/oauth-discord.mjs`, `apps/server/Dockerfile`, `docker/compose.yml`.
- **Release tooling:** `tools/release.sh` automates the release tail (dispatch CI → wait green → create the release), so the release step cannot be skipped when a session is interrupted; push-triggered workflows still do not fire (account-level, documented in `docs/ai/release.md`).
- **CI reliability:** the `db` job's SP05 expiry probe used a 1 ms expiry that Postgres' microsecond `now()` made ≤ `created_at`, violating `CHECK (expires_at > created_at)`; it now uses a 2 s expiry (still "expired" when checked 5 s later).
- Tests: `server_store`, `server_store_pg`, `server_accounts`, `server_http`, `server_oauth_discord`, `server_serve` plus `server_clients`/`server_rooms` extended; `npm run check`, lint and the loop green.

## v0.106.0
- Lane: U/I
- Time: ~45 min (09:27 WIB analysis start -> 10:12 release), deepseek-v4-flash-vision-exp; tokens not counted (no gate counter in this harness).
- **Repo hygiene + measured test coverage + two engine splits + M7 step 1 (owner 2026-10-24: "jalankan P0, P1, P2, P3 saya setujui semuanya").**
  - Index scope and repo dirt (P0): `.cbmignore` keeps the build artifact `index.html` out of the codebase-memory graph (it duplicated every engine and web symbol, ~800 nodes, so one lookup answered twice); `docs/README.md` lost the three `ai/lanes/*` lines deleted in v0.96.0 and gained the seven documents it never indexed (including `ai/effect-format.md` and the rules knowledge base); `.gitignore` covers `.vscode/`/`.idea/` and the stray third-party installer left in the repo root is gone.
  - Engine coverage, measured (P1): `tools/coverage.mjs` plays ten seeded headless flows plus a port-record round trip under V8 block coverage and reports which top-level function names each engine part actually runs - 275/363 = 76%, with `02o endOfBattle`, `04-decks` UI helpers, `15-match closeMatch`, `15b viewerReplayOf` and the Accel/Invoke cost paths named as never reached. Floor in `tools/coverage-baseline.json` (raise only), `--check` in CI, cheap structural checks CV01-CV04 in `tests/unit/coverage_baseline.test.mjs` so the quick loop stays fast.
  - Rule provenance closed (P1): all 35 glossary entries that carried no rule note now cite a real manual page taken from `docs/rules/kb.json` ("Eternal Rule Manual p. 22", "Standard Rule Manual p. 5, JP ver 1.1", "Standard Comprehensive Rules 12-2-1-12"), and where the rule genuinely is card text the note says so and names the engine hook. `known-gaps.json` `glossaryWithoutRule` is empty; the audit goes 259 items / 92 confirmed / 54 house / 113 open -> 294 / 126 / 55 / 113, so no new open rows and every glossary mechanic now has a page.
  - Doc references checked (P1): `tools/check_refs.mjs` resolves every backticked path in the 69 living docs (basename-aware, so `06-rules.js` means the engine part) and runs in `npm run loop`; three real findings fixed, 19 deliberate ones in a shrink-only baseline.
  - Pack plan honesty (P1): the greedy table columns are now "New (upper)" / "Block A (upper)" and a generated line counts the zero-yield rows (27 of 35 measured rows in the Standard table delivered nothing), because sessions kept sizing packs from a ceiling. Both reports regenerated on today's data: Standard staged pool 541 -> 489, distinct blockers 289 -> 243.
  - `02b-effects-actions.js` split (P2): the 516-line 14k-token action table is now five parts - `02b` keeps the declaration and the five actions a later part wraps at load time, `02q`/`02r`/`02s`/`02t` hold your own board, the Deck and Hand, the Soul Core and Trash, and the opponent's side. Behaviour proven unchanged: the splitter rebuilds the original file byte for byte before writing, and fifteen seeded CPU-vs-CPU matches report identical winners, turns and log hashes. Those matches were not enough: the split also broke a load-time pass (02k wraps every action's target list with the immunity filter) and only the A58-12 scenario in `tests/unit/effect_priority.test.mjs` noticed "this card in Trash is unaffected by any effects" had stopped working for the moved actions. Fixed in the same session (`wrapImmunity` is now re-run by each part that loads after 02k, and `tests/unit/engine_load_order.test.mjs` LO01-LO04 fails in the quick loop if an action ever misses the wrapper again).
  - `parseCard` split (P2): the repo's most complex function (100, 155 lines) hands its levels and Magic sections to `parseLevels` / `parseMagicOf`, drops to 97 lines, and keeps the exact error order - all 14,685 raw cards in `data/cards` and `data/import` parse to byte-identical results, and `fx-schema.json` is unchanged (no schema bump). `parseCard` is exposed on the headless engine, which makes the new `tests/unit/card_import_parse.test.mjs` (IM01-IM07) possible.
  - Database step (P3 = roadmap M7 step 1): `db/migrations/0001_init.sql` (accounts, deck slots, matches, match seats, match replays), `db/migrate.sh` (one transaction per file, checksum-guarded, append-only), `docker/compose.yml` (Postgres 16 + the same runner), tables documented in `docs/DATA.md`. The schema stores inputs and outcomes only (seed, decks, decisions, log hash), so the engine stays authoritative and a stored match replays to the same hash. `tests/unit/db_schema.test.mjs` DB01-DB07 checks the half that needs no server. Nothing is hosted; accounts, repositories, API routes and the CI service container are the next M7 step.
  - Regression gate widened: `tools/regression_due.sh` treated only a hand-kept list of engine parts as "core" (02a/02c/02d, turn, battle, rules, state, CPU, match), so a change to the action table (02b) or the new 02q-02t parts asked for 10 sims instead of 30 - and this session's immunity regression lived exactly there. Every `packages/engine` and `packages/protocol` source now counts as core.
  - U94-2 (deck builder Deck look) made deterministic: it failed three CI runs in a row, on both layouts, while passing 5/5 locally. Its own diagnostics were decisive - the saved look was in `localStorage` before the reload and the key was absent after it, with `sessionStorage` alive, and nothing in the app removes that key. What vanished was Chromium's flush of the `file://` origin's storage across a reload, so the test now waits for the payload and then calls `BS.loadSlots()` (the product's own parser, added to the test hook) instead of reloading the page: the same claim without asking the browser to touch the disk. Whether a real restart on a saturated disk can lose a just-saved deck is left open in `docs/ai/roadmap-open.md` for one manual check.
  - Release titles fixed: `tools/make_releases.sh` built the GitHub Release title from the first bullet after `- Lane:`, which is always `- Time:` - so v0.104.0 and v0.105.0 are titled "Time" on the Releases page. It now skips both boilerplate bullets and uses the first real summary.
  - Tests: `npm run -s loop -- --full` (1,441 passes), `npm run check`, lint, `fx_validate`, `fx_schema --check` and the Python data checks green. Push and the GitHub release could not run: this environment has no GitHub credentials (`gh` is not logged in and the git credential helper returns nothing), so the commits are local.
  - Revert note: `git revert` the twelve task commits in reverse order (through `dccba5c`); nothing in the game's rules, card data or UI behaviour changed, only file layout, tooling, docs and the new database folder - old saves and replays load either way.

## v0.105.0
- Lane: U/I
- Time: ~170 min (11:11 session start → 14:05 release, incl. the replay-determinism hunt), GLM 5.3 Flash; tokens not counted (no gate counter in this harness).
- **M6 server prep done (`apps/server`: rooms vs the server's bot over WebSocket; the plan's first three M6 steps were committed before this session's step 5 batch; no hosting until the owner decides - the U/I queue continues with M7 database + Docker).**
  - Rooms (`apps/server/src/rooms.mjs`): the human seat is `player`, claimed once with a deck and reopened by a token (mid-decision reconnect re-delivers the open decision - CI drill M6-26b); spectators join seatless; seat `opponent` is refused - it is the server's bot (`cpuAnswer` through the port, M6 steps 1-4). A room's rules = the page's default format (standard) and a concrete bot deck (default `std03`, a join may pick its own).
  - Replay determinism (the root bug of the flaky finds): the room start now **requires a concrete `deckB`** - the engine's own CPU pick (`cpuDeckFor`) consumes seed randomness whenever the settings deck is illegal in the room format (std03 is not usable in eternal), which shifts every draw and the run then never replays the record it just wrote. With both decks given, a room record replays to the same log hash (pinned M6-22 and M6-26).
  - Seat-filtered frames (`views.mjs` + engine `boardSnapshot(viewerKey)`): a seat sees its own Hand/Burst and the opponent's only as counts; a spectator sees every Hand as a count; hidden card ids never leave the server (`leaks()` guard drops a broken frame instead of sending it), and no decision message ever goes to a non-seat client. The no-argument call keeps the v0.104 viewer semantics exactly.
  - Wrapper (`run.mjs`): join/answer/welcome/ready|over|error messages over `ws@8` (one `loadEngine` context per room, no engine write into the record beyond the port content), decide timeout answered by the bot like the page's v1 policy, `recordOf(roomId)` for the replay checks; the server close stops every room (`engine closeMatch()`, an ABORT-shape match drop) and terminates its sockets, so tests and CI never hang on a half-played match. A start-time decide double-delivery is fixed (a fresh start's register loop already covers the joiner).
  - Tests: `tests/unit/server_rooms.test.mjs` M6-21..25 (rooms claim/reconnect/refusals, replay-safe start + record replay, timeout continues, frame discipline, one-engine-per-room load probe: 5 fresh engines = 3.8 s / +46 MB heap - the room limit waits for a real fleet measurement) and `tests/unit/server_clients.test.mjs` M6-26/-26b (the CI flow: two scripted clients drive a match to over, no leaks, one summary, the record replays; ws@8 installed `--no-save` like playwright locally and in ci.yml). `npm run -s loop`, pre-push and `npm run check` green.
  - Revert note: `git revert` the M6 commits in reverse order (through `1ce4492`); the web page's behavior is unchanged (boardSnapshot keeps local semantics; closeMatch is unused by the page), old saves and replays load either way.

## v0.104.0
- Lane: U/I
- Time: ~550 min wall-clock (23:56 Oct 22 session start → 09:05 release, incl. the owner's away gaps), GLM 5.3 Flash; tokens not counted (no gate counter in this harness).
- **Audit fixes (owner 2026-10-22: "saya setuju dengan semua saran. kerjakan" — all findings of the repo audit round, one commit per task).**
  - Windows/CI tooling: `tools/lane_next.mjs` compares script URLs through `pathToFileURL` (its lane print never fired on Windows); every generated-file writer got explicit `encoding='utf-8'` + `newline=''` so the build is LF-stable on every OS; the Windows quick-loop fixes (POSIX paths in card_verify/rules_kb, a BASH resolver in the test lib, the gh-less PATH keeping `python3`, CRLF-normalized fixture files, a 20 s reload wait for U68-3); `check_renames.py` reads diff text as UTF-8 (cp1252 died on the Japanese card lines in the pre-push hook).
  - Lint: `tools/lint.mjs` hard-fails with an install hint when `node_modules/typescript` is missing (no more false clean) and resolves tsc from the node_modules file; all 74 web type checker errors are fixed in the sources (typed DOM helpers `dq/dqa/elq/evT/evC/evV` in 00b-errors.js, local JSDoc casts, `window.BS`/`window.SC` declared), so the ratchet baseline in `tools/type-baseline.json` is emptied to 0 errors and the ALLOW list is gone; `tools/ts_list.mjs` is kept as a debugging helper (not a gate).
  - Card-count rule (audit finding: two counted-incomplete cards): a card whose whole printed effect is one flag-implemented mechanic (highSpeed, the colour-symbol flags) now counts complete; BS33-022 and BS54-021 keep the flag but are demoted to partial (`fxComplete:false` + residual + a partial note tail); complete count 771 → **780**; `import_fandom` staging report regenerated (I30 pins its totals).
  - Replay correctness (audit finding A1e): UI-only modals no longer write into the input record — `modal()` got a `uiOnly` flag and all ten UI-only call sites (card details, rule hint, deck view, clear-deck confirm, ...) are tagged; engine decision modals still record, so human replays that opened a card menu no longer diverge (the `seed_replay_tests` / `card_image_strips_tests` #26 pins stay as-is).
  - Flaky test U94-2 fixed at the cause: the deckbuilder mockup-style test now waits for state (the save must be in localStorage before the reload; the restored look is awaited) instead of racing it — never skipped.
  - Repo setup: Playwright 1.64.1 and TypeScript 6.0.3 are pinned devDependencies (a bare checkout installs the real toolchain); `.gitattributes` keeps `packages/`, `apps/`, `tools/` and the tests LF on every OS (no renormalization churn — unchanged files stay untouched); AGENTS.md's Windows notes now describe the fixed toolchain; the mind map (`docs/roadmap-data.json`, regenerated `docs/roadmap.html`) records the session and the closed audit round (the plan changed, so it updated outside the every-3rd cadence).
  - Tests: `npm run -s loop` + `npm run check` green; the Python Playwright suites that touch the replay fix were patched for correctness only and not executed locally (fixture paths are cloud-only in this checkout) — they run in Regression. Transient honest note: two pre-push attempts flaked under parallel load (one "quick tests failing" retry, one stale connection) and both identical retries passed.
  - Revert note: `git revert` the twelve task commits in reverse order (through `7ed7ee2`); no engine decision changed, only tooling, docs, the two demoted card rows and the record gate — old saves and replays load either way.

## v0.103.0
- Lane: U/I
- Time: ~155 min (08:35 session start → release, incl. the sizing bench and the owner's concurrent docs commit), GLM 5.3; tokens in the DONE mark on issue #1.
- **Key Spirit (Aeterna house rule, not an official rule; owner 2026-10-21: "satu kartu key spirit per deck", U/I queue).**
  - Player-facing: in the deck builder every Spirit row of your deck gets a KEY chip (yellow when marked); My decks tiles show a KEY badge (active slots and the read-only starters). The mark is saved with the deck slot and rides the deck code as a `KEY <id>` line (at most one; old codes import unchanged). One How-to-play line under "A turn": while no copy of the marked Spirit is in your Hand or on your Field, each draw from the Deck favours its copies; once a copy sits there, the draws go back to normal (and the favour returns when none is left).
  - Engine: every in-play draw runs through the single `draw(p, n)` funnel (Draw step + DRAW effects) — the weighted pick reads the seeded RNG exactly once and only while the rule is active, so decks without a Key Spirit draw exactly as before and replays stay deterministic (the keys ride the input record / port record as `keyA`/`keyB`/`keyW`, and are replayed from a record, never guessed). The Opening Hand, the Starting-hand redraw, the Contract setup draw and reveal/search effects are never weighted (wording: only "draws during play"). The favour reads the Hand and the Field (Spirits + Nexuses); Soul State / Mirage / copies under something do not count.
  - The CPU names a Key Spirit too: the ten Standard starters and the six colour decks each carry one (deterministic rule: most copies, then the smallest id, e.g. std01 → `26RSD01-001`, std03 → `26RSD03-002`); a player-built deck the CPU mirrors gets its marked key, else that deterministic pick. One key per deck is enforced by `validateDeck` third argument (a Spirit with at least one copy).
  - Sizing (40 starter-vs-starter matches, seeds 1001-1004, rule on vs off; the same seeds so pairs are comparable): Key in Hand at the End Step of the owner's turns 1-4 = **40.0% natural → 46.9% with the rule (+7 points)**; first-draw rate 13.9% vs 7.5% (6/43 vs 3/40 for a 3-copy key); win rate and average turns unchanged (first seat 19 vs 21 → 20 vs 20; 5.7 turns both ways). The weight starts at 2× per copy and stays 2 — a nudge, not a strategy shift; reasoning in `docs/mechanics/key-spirit.md`.
  - CPU bench baseline rewritten (`tools/cpu_bench.mjs` now passes each starter's key to the match): 240/240 finished, 0 errors, 0 timeouts; 6.0 turns on average (v0.102.0: 6.1); first seat wins 45% (was 48.8%); passive own turns 0.141 idle attack (was 0.135) / 0.023 idle summon (same). Styles: aggressive-defensive 60%, aggressive-balanced 30%, balanced-defensive 40% (was 65/35/65); strongest colours now green 72% and red 57%, weakest yellow 43% and purple 42% (was green/white 61%, purple 40%); per-deck spread std03 72% → std02 28%. All deltas are the seeded consequence of the keys biasing early draws — no CPU or deck-list code changed in this commit. Reason: the Standard starter decks carry the Key Spirit rule on purpose since the prebuilts name keys — the baseline must measure the game that ships.
  - Tests: `tests/unit/key_spirit.test.mjs` KEY-1..KEY-9 — deck validation (optional 3rd argument: unknown / non-Spirit / zero-copy keys refused), all 16 keyable prebuilts match the deterministic pick, draw determinism with a byte-for-byte RNG mirror (zero rng() calls while inactive, one while active; same seed → same hand), reset while a copy sits in Hand / on the Field and reactivation after it leaves, first-draw distribution over 100 seeds, full headless record replay (keyed and keyless, `same: true`), and web round trips (deck code KEY line, real-modal import/export, row toggles, tile badges, copy/duplicate). Full quick suite: 1402 pass.
  - UI checks: player-view pass 35/35 PASS on PC and phone with 0 page/console errors (incl. a full watch match with the starter keys active); screenshots regenerated from the built game; style budget 88,728/96,000 bytes; Web Interface Guidelines self-audit of the new controls clean.
  - Revert note: `git revert` of the engine commit (`8512467`), the web commit (`f861565`) and this docs commit, in reverse order; old deck codes and old saves load either way (the KEY line is optional, unknown marks are skipped).

## v0.102.0
- Lane: U/I
- Time: ~25 min (chain continuation of v0.101.0), Opus 5.5; tokens in the DONE mark on issue #1.
- **CPU benchmark (no game change).**
  - `tools/cpu_bench.mjs`: 240 CPU-vs-CPU matches with the ten Standard starter decks on the headless engine (no browser, ~2 min): every ordered deck pair twice (balanced vs balanced) and the three CPU styles against each other on ten deck pairs, both seats. Fixed seeds, so a build always gives the same numbers. Per match: winner, turns, errors, timeout, and two passivity counts at each End Step of the CPU's own turn (a ready attacker kept back with no attack made; a payable card kept with nothing played).
  - Baseline `docs/reports/cpu-bench.json` + readable `cpu-bench.md`: 240 finished, 0 errors, 0 timeouts; 6.1 turns on average; first seat wins 48.8%; idle attack 0.135 and idle summon 0.023 per own turn. Styles form a cycle: aggressive beats defensive 65%, defensive beats balanced 65%, balanced beats aggressive 65%. Colours: green and white 61%, blue 56%, yellow 49%, red 44%, purple 40%.
  - The Regression workflow has a new job `cpu-bench` (`--check`): more errors or timeouts fail it; clearly more passive turns, 20% longer games or a style losing 15 points become warnings. `docs/ai/release.md` says when to rewrite the baseline.
  - `playHeadless` takes `format` and an `onBoard` hook. Tests CB1-CB4.
  - CI: U94-2 (deck panel tabs, Deck look saved per slot; PC and phone) failed on the first CI run with the Deck look `undefined` and passed on the re-run; it also failed in the two CI runs of 2b52c96 (v0.101.0) and once in v0.99.0. Recorded in `roadmap-open.md` as an open flaky test; the new failure list at the end of `npm test` named it.

## v0.101.0
- Lane: U/I
- Time: ~20 min (chain continuation of v0.100.0), Opus 5.5; tokens in the DONE mark on issue #1.
- **M5 part 1: type checks with a ratchet (no game change).**
  - `tools/lint.mjs` (loop, pre-push, CI) now counts every TypeScript checker error on the built game per source part against `tools/type-baseline.json`: a part may not get more errors than its baseline, and engine and protocol parts (not listed) must have none. `node tools/lint.mjs --update-types` lowers the baseline after a cleanup. The lint line shows the totals.
  - `packages/engine/types.d.ts`: shapes of the engine records the checker needs (card def, Magic spec, cost alternative, Brave, Contract Advent / Manifest, modal button, deck slot, port replay result), used from JSDoc in the parts.
  - Engine and protocol: 25 checker errors fixed (JSDoc types and casts; boolean sort keys written as `+(a) - +(b)`, same order): 0 left. Web: the `$()` lookup and two file-input handlers are typed as input elements: 154 -> 74. Total 179 -> 74. Tests T101-1/2.
  - CI pins TypeScript 6.0.3 (the version the baseline was counted with): the first CI run installed a newer checker that reports other errors (engine 5, web +2) and failed the lint step. With another local version the ratchet only warns; `--update-types` needs 6.0.3.
  - CI: two runs on 2b52c96 ended with 2 failing tests of 1,442 that the CI log did not let us name (all 1,442 pass in the session); the next run (0cc237b) was green. `tools/quick-tests.mjs` now repeats every failing test with its error lines at the end of the output, written synchronously, so the tail of a CI log names them.
  - Next M5 steps (bundled with later U/I sessions): web parts to 0, then `--noImplicitAny` for the engine.

## v0.100.0
- Lane: U/I
- Time: ~25 min (session start to release), Opus 5.5, scheduled auto session; tokens in the DONE mark on issue #1.
- **Q3 part 2 + Q4: tests cite rule chunks, one-card verify skill.**
  - Tests cite rules knowledge base chunks as `<id>@<pin>` (pin = first 8 hex digits of the section fingerprint): `// rules:` comments in 15 Node test files and a `rules` array in 6 scenario boards (40 citations of 25 chunks). `python3 tools/rules_kb.py --list-tests` reports `UNKNOWN` ids and `STALE` pins (the section changed after a manual refresh); `--pin-tests` re-pins them once the tests were re-checked; `--query` prints the line to copy. Tests K08-K09 (`rules_kb.test.mjs`).
  - New skill `bs-card-verify` (evidence -> trace -> test -> verdict for one "card X is wrong" report) with `tools/card_verify.py <id>`: the card as the game has it, the Fandom export row and every differing field, rule chunks for its keywords (with pins) and the tests that name it. Tests CV1-CV3.
  - Docs: `docs/rules/README.md` (test citations, refresh step 4). Standard CR 12-2-1-3 (Legacy) stays a known gap; Legacy tests cite `SJP:inherit`.

## v0.99.0
- Lane: U/I
- Time: ~75 min (session start to release, incl. a ~20 min tool outage), Opus 5.5, tokens in the DONE mark on issue #1 (player-view pass: 140,837).
- **U8a: UI fixes from the player-view passes and the 2026-10-21 UI audit (no animation or layout redesign).**
  - **Animations on the phone:** an explicit "Animations: Full" now wins over the phone's reduced-motion / battery-saver setting. New first option "Auto (device)" (the default) follows the device as before. Tests U8A-1/2 (U92-3 changed accordingly).
  - Light mode: the Card Detail panel is light with dark text (was grey with ~1.8:1 text), legality lines darker; the "Cost N" badge uses dark text on yellow and white cards; primary buttons in teal and green use black text (all side colours now reach 4.5:1, was ~4.2). Test U8A-11.
  - The BLOCK? strip now sits just above the step band's log line instead of covering it (U8A-9, PC and phone). The Card Detail zoom icon no longer covers the BP (U8A-10).
  - Deck builder: Clear asks first (Undo still works) (U8A-3); the card count says which extra cards it shows ("6904 card(s) shown (14 Training)", Home counts real cards only) (U8A-5); phone deck sheet has "‹ My decks" (the header button was under the sheet's backdrop) (U8A-6).
  - My decks: Rename has `autocomplete="off"` (U8A-4); phone rows put EDIT / PLAY below the name, so long names show in full (two lines at most) (U8A-7).
  - `color-scheme` is set on the whole page per mode (form controls and scrollbars in the deck builder, battle screen and popups follow dark / light) (U8A-8).
  - Stylesheet budget: three rules that later rules fully replaced were removed, and the build now drops the spaces around `{ } ; : ,` outside strings (95.9 KB -> 88.2 KB, same rules).
  - Checked and not a bug: the DECKS tab is not highlighted on Settings after the deck builder (player-view pass). Kept for later (roadmap "U8a leftovers"): deck builder Saga select, symbol split, family chips; Escape on the generic confirm modals.
  - Backup `backup/v0.98.0`. Revert note: `git revert` of the v0.99.0 commit.

## v0.98.0
- Lane: U/I
- Time: ~35 min (session start to release), Opus 5.5, tokens in the DONE mark on issue #1.
- **Standard rules: the Japanese Standard Rule Manual Ver.1.1 (2026-10-02) was read in full and compared with the English Comprehensive Rules 1.0 the engine follows and with the engine itself (`docs/rules/standard-jp-1.1.md`, one row per section).**
  - Result: JP 1.1 and EN 1.0 agree on every point checked; JP 1.1 adds worked examples and a Q&A page, no new rule. One engine difference was found and fixed: **the starting-hand redraw now follows turn order** (the first player decides first, so when the CPU goes first it has already kept or redrawn before you are asked; before, you always decided first). Tests SR11-01/02.
  - Rules knowledge base: the Japanese manual is a new web manual `SJP` in `docs/rules/kb.json` with 26 sections (ids, page numbers, one-sentence paraphrases and fingerprints; no manual text). `tools/rules_kb.py` can now read web manuals: it saves the HTML pages, drops the furigana readings and fingerprints the visible text; `--import-html SJP` re-extracts pages saved another way (the official site refuses the session shell). Test K07.
  - Ban list: still no Standard list on the official page (the 2026-09-01 list names Eternal-era cards only).
  - `session_start.sh` prints dated reminders from their date on: 2026-12-26 (import 26RCB02 + 26RSD12, add the 26RSD12 deck recipe) and 2027-03-01 (Standard rotation on 2027-04-01: update `STANDARD_BLOCKS`).
  - Finding for the card queue: a heavy exhaust also counts as exhausting for "when exhausted" triggers (EN CR 5-16-1); only 26RBS02-050 has such a trigger (noted in the K queue).
  - Revert note: `git revert` of the v0.98.0 commit (the redraw order is one block in `packages/engine/src/15-match.js`).

## v0.97.0
- Lane: U/I
- Time: one chain session, Opus (roadmap items "format default" + "Standard decks").
- **Standard is the default format, and the ten official Standard starter decks are in the game (26RSD01-26RSD10: Entry Decks in red, purple, green, white, yellow and blue, starters in purple and yellow, anime starters in red and green).**
  - A new player starts in Standard (a saved choice still wins). The format button reads "FORMAT: STANDARD" or "FORMAT: ETERNAL (PREVIEW)" (most Eternal cards are still partial); the same in the deck builder. The deck lists (Play, Decks, ready-made) show the decks of the chosen format first.
  - The first-run deck is the Standard starter 26RSD02 (27 of its 40 cards are complete today, the most of the ten); the CPU default is 26RSD03. Training Red stays selectable but is no longer part of the random CPU pick. Deck names no longer carry developer notes ("v0.37", "draft", "for testing").
  - Each starter keeps its full official 40-card recipe (`data/decks/standard-26rsd*.txt`). A card that is not playable yet is skipped when the deck loads and the deck is labelled "incomplete, N missing" and never chosen as the CPU deck: only 26RSD08 (Twilight Fantasia Song 26RSD08-013 and its copies, 3 cards) is affected today.
  - Ban lists are per format. The official page has one list (effective 2026-09-01, for the Eternal qualifiers) and no Standard list (checked 2026-10-21), so Standard has an empty list; `session_start.sh` warns when the check is older than 30 days.
  - Token check: the Swordish token `26RSD10-T001` is not defined yet; the 7 cards that send it out stay partial (recorded in `docs/ai/roadmap-open.md`, K queue).
  - Tests: `tests/unit/std_decks97.test.mjs` (S97-1..S97-7). The shared test copies (Node `GAME_URL`, Python `wip.html` and the legacy copy) set the default format back to Eternal, because most suites were written for Eternal rules; the real default is tested in S97 only.
  - Backup `backup/v0.96.0`. Revert note: `git revert` of the v0.97.0 commit(s) (the format default is one line in `00-config.js`, the starters one block in `04-decks.js`).

## v0.96.0
- Lane: U/I
- Time: one chain session, Opus (repo cleanup, roadmap item L; no game change).
- **Repo cleanup, four parts, behaviour unchanged:**
  - Part A: generated and one-off files out of git. `data/cards/all-cards.json` (10 MB copy of the Saga files) is now `build/all-cards.json`, built on demand by `tools/all_cards.mjs` / `tools/allcards.py`; `compile-review.md` moved to `build/`; the one-off red-cards check page was deleted.
  - Part B: dead code removed (`humanMirage`, `humanPlay`, `humanBraveSummon`, `humanBraveField`, `instIdByUid`, `isNexusBrave`, `tools/player_view.mjs`); the parallel-lane tooling in the session gate and `session_start.sh` was removed (the gate still reads an optional lane word).
  - Part C: names by topic. Engine modules, mechanics docs, tests, and the template and stylesheet now live under mechanic or topic names (`apps/web/index.template.html`, `apps/web/styles.css`).
  - Part D: three finished plan docs archived in `docs/ai/roadmap-archive.md`; `docs/rules-coverage.md` header updated; `CHANGELOG.md` split at v0.80.0 (older notes in `CHANGELOG-archive.md`; the release script, mind map, brand guard and tests read both); stale roadmap lines removed; draft "v1.0 criteria" added to `docs/ai/roadmap-open.md` (awaiting owner approval); `docs/ai/deleted-branches.md` lists the branches the owner can delete.
  - Revert note: each part is its own commit (`27999fa`, `84d797c`, `2fc6bbd`, plus the docs commit); `git revert` them in reverse order.

## v0.95.0
- Lane: U/I
- Time: about 35 min (session start to release), Opus, tokens in the DONE mark incl. the player-view subagent (chain session 5).
- **Your own sleeve picture (roadmap U7, part 2): Deck look has UPLOAD SLEEVE; the picture stays on this device per deck slot, is tinted by the chosen sleeve colour (Silver keeps it as it is) and shows on your deck pile in battle, in the deck builder and on My decks. On the phone the deck bar shows a mini preview of the deck look.**
  - Stored like the playmat (the card-image store, key `~sleeve:<slot>`, longest side 600 px); REMOVE takes it out; clearing the card images keeps it.
  - Not done: the format default (Standard first, Eternal as "Preview", owner 2026-10-21): only the training deck is legal in Standard, so the default deck and every starter deck would be unplayable on a first start. It goes with the "Standard decks" item (the official starter recipes were added to the data the same day; noted in `docs/ai/roadmap-open.md`).
- CI (`npm test`) now runs the wall-clock budget files (`budget`, `deckbuilder52`) alone after the other files, like the quick tests since v0.93.0: the CI run of the v0.95.0 code commit failed one test under parallel load and passed on its one re-run (same commit). No check dropped.
  - Test `tests/unit/db95.test.mjs` (U95-1, U95-2). Backup `backup/v0.94.0`. Revert note: `git revert` of the U7 part 2 commit.

## v0.94.0
- Lane: U/I
- Time: about 60 min (session start to release), Opus, tokens in the DONE mark incl. the player-view subagent (chain session 4).
- **Deck builder in the new style (roadmap U7, part 1): back to My decks, a FILTERS button with the number of active filters, removable filter chips with Clear all, deck panel tabs (Deck list / Curve and check / Deck look), and a Deck look per deck: sleeve tint, core colour and Soul Core colour, shown on your side of the battle board.**
  - The builder now uses the graphite theme and your player colour (old orange accents gone). On PC, FILTERS shows or hides the filter column; on the phone it opens the filter sheet as before. "‹ My decks" in the header goes back to the decks page.
  - Curve and check: cost curve, colours, types and a check list (card count, every legality problem, "Legal in Eternal"). Deck look: six built-in sleeve tints (Silver, Crimson, Azure, Jade, Gold, Violet) and nine core / Soul Core colours (Blue, Red, Purple, Green, White, Yellow, Gold, Silver, Onyx); saved with the deck slot (old slots: Silver / Blue / Red). Your Life, Reserve, field cores and deck sleeve take them; the CPU keeps the default look. My decks shows each deck's sleeve tint.
  - Player-view fixes: light mode works in the builder (header buttons, search box, selects, filter chips and the phone sheets took dark backgrounds with dark text); the phone FILTERS button reports whether the sheet is open.
  - Not in this part (U7 part 2): uploading your own sleeve picture (tinted), and the phone panel that minimizes to one row with a mini preview.
  - Stylesheet: old deck-builder rules replaced instead of overridden, so B04 stays under 96 KB (close to the limit: U8 trims first).
  - Test `tests/unit/db94.test.mjs` (U94-1..U94-3, PC and phone); `deckbuilder53` follows the new FILTERS label and the PC FILTERS button. Backup `backup/v0.93.0`. Revert note: `git revert` of the U7 commit.

## v0.93.0
- Lane: U/I
- Time: about 70 min (session start to release), Opus, tokens in the DONE mark incl. the player-view subagent (chain session 3).
- **My decks page (roadmap U6): the Decks tab now opens a list of your decks with sleeve, colours, status and an ACTIVE badge; Edit, Play and a more menu with Set active, Rename, Duplicate, Deck look, Copy deck code and Delete (asks first); Import code and New deck; the prebuilt decks are read-only starter decks with Copy.**
  - Built on the existing 8 deck slots (nothing migrates): a slot is listed when it has cards, its own name, was made by New / Import / Copy / Duplicate, or is the active deck. Play is disabled while a deck is not ready (the status says why, e.g. "37 / 40 · add 3 cards"). On the phone the rows open an action sheet instead of the menu.
  - "Build a deck" on Home and "Edit deck" on Play still open the deck builder directly; Deck look opens the builder until U7 adds its Look tab. Copy deck code puts the card list on the clipboard (Import code reads the same text).
  - Player-view fixes: the more menu of the last tile scrolls into view on PC; Enter saves a rename and Escape closes the Rename / Delete dialogs; on the phone the ACTIVE badge sits under the name. Test U93-4.
  - Stylesheet budget (test B04) raised on purpose from 90 to 96 KB for U6-U8 (unused rules were trimmed first in v0.92.0).
  - Test `tests/unit/decks93.test.mjs` (U93-1..U93-3, PC and phone); `ui65` follows the new Decks tab. Backup `backup/v0.92.0` holds the state before the change. Revert note: `git revert` of the U6 commit (removes `apps/web/src/13h-decks.js`, the `view-decks` page and the CSS block "v0.93.0 U6"; the Decks tab goes back to the deck builder).

- **Process (owner, 2026-10-21): subagent tokens count.** `session_gate.sh done ... sub=<subagent tokens>` adds the subagents' token use to `tokens=` (and so to the chain budget) and keeps `sub=` on the DONE line; test G-T3. This session's DONE carries its player-view pass.
- Quick tests (pre-push): the wall-clock budget files (`budget`, `deckbuilder52`) run alone after the parallel batch; B15 measured 355 ms against its 300 ms limit with 3 files in parallel (100-200 ms alone). No check dropped.

## v0.92.0
- Lane: U/I
- Time: about 65 min (session start to release), Opus, tokens in the DONE mark (chain session 2; player-view pass about 24 min of it).
- **Light battle animations (roadmap U5b): an attack beam from the attacker to its blocker or the defender's Life, the Life cores shatter when Life is lost, and short cues for summon / deploy, destroy, BP changes, level-up and draws.**
  - Settings, Speed: new row "Animations: Full / Reduced / Off" (saved per device; Reset sets it back). Reduced keeps only short fades (no shards, no travel); the system "reduce motion" setting turns Full into Reduced. Off by default under test automation; CPU-vs-CPU sims (`?sim=1`) never draw them.
  - Every cue lives in the U5 overlay layer (`#ae-fx`), animates only transform and opacity for 0.3-0.65 s, removes itself and never takes a tap; the engine and the CPU never wait for it (code `apps/web/src/13g-anim.js`: the board is compared with the last one after each render).
  - Player-view fix: a scrolled phone field row now gets its place back at once after each redraw (it slid back smoothly, so a beam could start off-screen). Test U92-5.
  - Stylesheet budget kept (test B04): 7 unused old rules removed (`.lobby-title`, `.lobby-menu`, `.core-badge`, `.soulstate-zone`, `.card-art`, `.sleeve-mark`).
  - Not in this release: cores flying between zones and the Burst flip (they need the core/Burst events, not only the board diff); listed under item U for U8.
  - Test `tests/unit/anim92.test.mjs` (U92-1..U92-4, PC and phone). Backup `backup/v0.91.0` holds the state before the change. Revert note: `git revert` of the U5b commit (removes `13g-anim.js`, the Settings row and the CSS block "v0.92.0 U5b").

## v0.91.0
- Lane: U/I
- Time: about 75 min (session start to release), Opus, tokens in the DONE mark (player-view pass about 31 min of it).
- **Battle popups in the new style (roadmap U5): every dialog, prompt and pick bar now uses the mockup v11 look, and the battle gets ribbons for the turn, the step, your Flash Timing and the match start ("GATE OPEN, RELEASE!").**
  - Dialogs: cut-corner panel with a side-colour bar and a kind chip (EFFECT, FLASH TIMING, BURST, PAYMENT, MATCH SETUP, RESULT, ...), skewed buttons; yellow is used only for the "yes" of a yes/no prompt, "Cancel" / "Skip" / "Pass" are grey instead of red. On the phone dialogs open as bottom sheets. DEFEAT shows in the CPU colour.
  - Block prompt: a "BLOCK?" chevron strip across the board centre in the CPU colour while you choose a blocker, with a grey "Do not block".
  - One shared overlay layer (`#ae-fx`) for the ribbons; it never takes a tap, sits under every dialog, draws nothing in CPU-vs-CPU sims and stays still with reduced motion. Checklist of every popup: `docs/DESIGN.md` section 0 (U5).
  - Player-view fixes: the match-start banner now waits for turn 1 (it showed behind the Coin Toss dialog); the button row of a tall dialog (Card Detail) stays visible at the bottom while the text scrolls; the payment -/+ buttons are 40x36 px.
- **Fix: pressing + on the "Soul Core on <Spirit>" row of the payment dialog threw a page error** (the row key holds a colon; found by the player-view pass). Test U91-6.
  - Titles, button values and test ids are unchanged. Test `tests/unit/ui91.test.mjs` (U91-1..U91-5, PC and phone). Backup `backup/v0.90.0` holds the state before the change. Revert note: `git revert` of the U5 commit (CSS in `src/styles.css`, `apps/web/src/10-modals.js`, `apps/web/src/13-render.js`, the `#ae-fx` line in `src/index.template.html`).

## v0.90.0
- Lane: K
- Time: about 35 min (session start to release), Opus, about 24,000 tokens (chain session 3).
- S1 is closed for now (item T.2): the 6 Standard Magic cards left each need a mechanic no other blocked card shares; they are listed in the K queue of `docs/ai/roadmap-open.md`, and the next sessions take the U/I queue (U5 first).
- **Standard Magic, part 3 (roadmap S1): 4 more Standard Magic cards in the library: Awakening (complete), Vermillion Roar, Thunder Shutter and Massive Grow (partial).** Playable 6,886 -> 6,890, complete 770 -> 771; Standard block A 668 of 674 playable.
  - Effect format schema v4 (`docs/ai/effect-format.md`, `packages/engine/src/02p-effects-standard.js`): match fields `keyword` ("a Spirit with Clash": the card prints the keyword head "Clash (...)", a card that only mentions it does not count) and `noText` ("with no printed effects"); `SUMMON_HAND` also takes a colour / `noText` match and marks the summoned card for `DESTROY_PICKED` ("When this battle ends, destroy the summoned"); action `OWN_CORE_TO_LIFE` ("Send a core, besides [Soul Core], from it to your Life").
  - Still out of the library (6): Guard Effect (can't be targeted by opposing Magic), Sacrifice Strike (Rumble number), Boost Energy (a Nexus treated as a Spirit), Furious Anger (loses a symbol), Howling Song and Twilight Fantasia Song (granted effects).
  - Tests `tests/unit/s1magic90.test.mjs` (S90-01..S90-04). Revert note: `git revert` of the S1 part 3 commit removes the 4 cards and the schema v4 pieces.

## v0.89.0
- Lane: K
- **Standard Magic, part 2 (roadmap S1): 9 more Standard Magic cards in the library, 8 complete: Meteor Crash, Unmask, Rapid Ripper, Portal Hack, Evil Hazard, Guard Vent, Strike Vent, Defensive Gate, and Flame Summoning (partial: its Nexus rider).** Playable 6,877 -> 6,886, complete 762 -> 770; Standard block A 664 of 674 playable.
  - Effect format schema v3 (`docs/ai/effect-format.md`, code `packages/engine/src/02p-effects-standard.js`): condition `ctrlFamily` ("If you control any X/Y family Spirit", or none of them); `BP_TARGET.perExhausted` ("for each exhausted Spirit you control"); `DESTROY_PICKED` inside `END_BATTLE` ("When this battle ends, destroy it"; a Magic card's delayed end-of-battle effect now resolves from the Trash, `02o`); `BP_MINUS.other` (the second of "two opposing Spirits" is another one); `EXHAUST_OPP.oppChooses` ("The opponent targets a refreshed Spirit they control": a CPU opponent gives up its weakest, a human taps one); `SOUL_HOLDER_CORE` (a core from the Spirit with the Soul Core; the opponent keeps the Soul Core while another core is there); `BOUNCE_OPP.bpLeOwnLv1` (BP up to the original LV1 BP of one of your matching Spirits); `LIFE_SHIELD` ("During this turn, your Life can't be reduced by its attack", checked in `08-battle.js`); `BLOCK_EXHAUSTED_OPP` ("During this battle, it can block even while exhausted").
  - Still out of the library (10): Vermillion Roar, Awakening, Guard Effect, Thunder Shutter, Sacrifice Strike, Boost Energy, Furious Anger, Massive Grow, Howling Song, Twilight Fantasia Song (Clash, summoning from the Trash, Magic immunity, Magirrate, Rumble, Nexus as a Spirit, symbol changes, granted effects).
  - Tests `tests/unit/s1magic89.test.mjs` (S89-01..S89-08). Revert note: `git revert` of the S1 part 2 commit removes the 9 cards and the schema v3 pieces (no earlier card changes).

## v0.88.0
- Lane: K
- **Standard Magic, part 1 (roadmap S1, owner 2026-10-21 "agar game playable"): 39 of the 58 Standard (block A) Magic cards that had no runnable paragraph are in the library (23 complete, 16 partial "!" cards that list the clause that does not run).** Playable 6,838 -> 6,877, complete 739 -> 762.
  - New effect format pieces (schema v2, `docs/ai/effect-format.md`): conditions `lifeReduced` ("If your Life was reduced (during) this turn": `lifeTake` marks the turn) and `allHave` ("If all your Spirits/Nexuses have the X family / have <Team>", "If all your Spirits are Cost 2/4/6/8 with the X family"; the team is read from the card's `[Team: X]` / `[Teams: X/Y]` head line; with none on the Field the condition is not met, house reading); match field `familyAll` ('"RYUKI" & "Kamen" family'); action `DESTROY_OWN` ("Target one of your X. Destroy it. If you've done so, ..."); `EXHAUST_OPP.coresLe`; `CANT_ATTACK_BLOCK.turn` / `costLe` ("During this turn, it can't attack/block", ends in the End Step). Code: `packages/engine/src/02p-effects-standard.js`.
  - Complete: Skull Blast, Suicide Attack, Wave Ride, Double Vortex, Punish Gate, Bolt Grid, Merciless Blow, Grand Theft, Binding Kelp, Bubble Shield, Dream Powder, Flash Run, Sharp Thorn, Burai Kick, Impact Banish, Shoot Vent, Final Vent, Critical Dead, Greed Shout, Flame Hurricane, Blood Sip, Triple Thunder, Catastrom Crusher. Partial: Hydro Force, Fast Travel, Flame Storm, Spear Victory, Sword Vent, Mighty Critical Strike, Sengoku Fire Dance, Deep Strike, Gigan Song, Rainy Poison, Rebirth Thunder, Stem Lance, Breakam Slash, Angelic Feather Song, Shining Sword Song, Abyss Call.
  - Still out of the library (19, part 2 of S1): Meteor Crash, Vermillion Roar, Awakening, Guard Effect, Thunder Shutter, Sacrifice Strike, Flame Summoning, Unmask, Rapid Ripper, Portal Hack, Boost Energy, Evil Hazard, Furious Anger, Massive Grow, Guard Vent, Strike Vent, Howling Song, Defensive Gate, Twilight Fantasia Song (each needs a new action: block while exhausted, Magic immunity, Rumble, opponent-chosen targets, "when this battle ends destroy it", Life protection, granted effects).
  - Tests `tests/unit/s1magic88.test.mjs` (S88-01..S88-10) and scenario `tests/scenarios/s1-sharp-thorn-life-reduced.json`; glossary entries `S1_LIFE_REDUCED`, `S1_ALL_HAVE`; obligations S1-LIFE-88, S1-ALLHAVE-88. Revert note: `git revert` of the S1 commit removes the 39 cards and the schema v2 pieces (no v1 card changes).
- **Field width lock (roadmap X1, owner 2026-10-21): turning a card no longer moves anything on the board.** Every field slot keeps one square footprint (its side is the card height) whether the card is refreshed, exhausted or heavy exhausted, and the card turns inside it; before, a refreshed slot was 63:88 and an exhausted one 1:1, so every exhaust or refresh shifted all cards of the row (phone, 6 Spirits: row scroll width 538 -> 732 px). Field rows with slots have no extra gap now (the square slot already leaves room beside an upright card). The board containers (fields, side columns, hand) were measured stable for 0-12 cards a side on both layouts.
  - Test `tests/unit/x1field88.test.mjs`: on PC 1366x768 and phone 412x915 with 1, 3, 6 and 9 Spirits plus 3 Nexuses a side, the boxes of every board part and every slot stay equal within 1 px through all exhausted, half, heavy and refreshed states; each row has one square slot size that holds the card either way up. The player-view pass (real matches, CPU-vs-CPU sims, a stress board with Brave, an Ultimate and many cores) found no box that moves.
  - Backup `backup/v0.87.0` holds the state before the change. Revert note: `git revert` of the X1 commit restores the old slot shapes (CSS only, `src/styles.css`).
- Regression fix (run 39511643318 on v0.87.0, part 2, `v18_tests` check 12 + crash): the match-history checks ran on the match that the Space/Enter checks had been advancing, and on a slow runner the CPU could win it first, so `BS.win` was ignored and the CPU's entry stayed in memory; the next check then crashed on the cleared storage. The history checks now open a fresh match and check that it is still running; the storage read is null-safe. Test only, no game change.

## v0.87.0
- Lane: U/I
- **Test waits (roadmap phase F, item F5 = Q2; phase F is complete): the browser suites wait on a visible state instead of fixed times.**
  - `tests/suites/waits.py` (new): `ready(pg)` (the page script is loaded, after `goto` / `reload`) and `settle(pg)` (a prompt or field pick is open, or the promise in `window.pr` has settled and no engine pause runs). All 177 fixed `wait_for_timeout` calls of `tests/suites` use them now; the one left is the polling loop of `mitra_tests.py` `wait_for`. The `run(pg, js)` helpers of the suites keep their async step in `window.pr`.
  - Engine: `engineIdle()` (`packages/engine/src/05-state.js`) counts the running engine pauses (`delay`); exposed as `BS.engineIdle`.
  - Three checks read a state in the middle of an effect chain that the fixed wait happened to catch (Contract Skill of Mitra, Pachhattar in `mitra_tests.py` and `advent_tests.py`): they now check the state after the chain (the summoned Soul State card charges Mitra once more); `v29_tests.py` check 9 reads "who started turn 1" from the log. `tests/run_all.py` skips the helper file.
  - Tests `tests/unit/waits87.test.mjs`: W87-01 shrink-only ratchet on fixed waits in `tests/suites` (1 left, was 178), W87-02 every suite that uses the waits imports them. All 3 suite parts and 3 sims pass locally.
- Phase F is done (F1-F5, v0.81.0-v0.87.0). The owner asked to pause after phase F for a roadmap update: `docs/ai/chain-stop.md` stops auto and chain runs until the owner answers.
- Revert note: `git revert` of the v0.87.0 commit restores v0.86.0 (test waits and the idle counter; no card data or rules change).

## v0.86.0
- Lane: U/I
- **Replays, part 2 (roadmap phase F, item F4 = monorepo step M4 rest; F4 done): a replay viewer in the match history.**
  - Settings, Match history: the last 3 finished matches keep their port record and are listed above the table (no sideways scroll on phones); **▶ WATCH** re-runs it in the page's own engine and plays the match back frame by frame (Start, Turn back, Back, Next, Turn forward, End; both sides' Life, cores, Spirits with level and cores, Nexus, Hand, Burst, the log line of each frame; the buttons sit in a 4-column grid), **SAVE** downloads the record. New row **Open a replay file**: a saved match record, a fuzz case or a viewer replay; **💾 Save** in the viewer writes the viewer replay (plays back in any later version, no engine needed). A match must be finished or left before watching.
  - Engine `runPortRecord(record)` / `viewerReplayOf(record)` (`packages/engine/src/15b-replay.js`): one replay runner for every host (the headless `replayPort` / `viewerReplay` now call it); the page refuses CPU-vs-CPU sim records with a pointer to `headless.mjs --replay`. Frames carry the step name. `playHeadless({ real: true })` plays a match by the rules of the web page (coin toss, Starting Hand prompts).
  - `apps/web/src/13f-replay.js` (new): the viewer; styles `.rv-*`. The build now ships the stylesheet without comments and indentation (`src/styles.css` keeps them; 89.9 KB -> 85.5 KB of the 90 KB budget).
  - Tests `tests/unit/viewer86.test.mjs`: V86-01 a web-rules record replays in the page to the same frames as in Node, V86-02 the viewer steps by frame and by turn, the history row watches, an open match blocks watching, V86-03 sim records and broken files are refused with a message.
  - Player-view pass (PC 1366x768, phone 412x915): real match, Watch, every step button, Save + Open of both files, the open-match message; its two findings (Replay column off-screen on phones, stacked viewer buttons) are fixed. Screenshots per layout.
- Backup branch `backup/v0.85.0` (state before the UI change).
- Revert note: `git revert` of the v0.86.0 commit restores v0.85.0 (viewer, history column, build CSS strip; no card data or rules change).

## v0.85.0
- Lane: U/I
- **Replays, part 1 (roadmap phase F, item F4 = monorepo step M4 part 1): every match keeps a host-independent input record of its port answers, and Node re-runs it without a browser.**
  - `packages/engine/src/15b-replay.js` (new): port input record v2 in `G.prec` (seed, format, decks, human seats, CPU profiles + fuzz setting in sims, every answer `{s, k, v}` in the order asked: choices, picks, payments, info and the action intents of v0.84.0; `final` at the match end). `portRecord()` copies it and adds `cut` (log count + hash) when a decision is open, so the record of an unfinished match is checked up to that moment. `boardSnapshot()`: one plain board frame (the CPU Hand and Burst only as count / "set").
  - Answers are recorded in `05b-decide.js` (`portAsk`); page messages of the web UI (Game Log, rules coverage, glossary, deck import notes) now use `uiInfo` and stay out of the record.
  - `packages/engine/headless.mjs`: `replayPort(record)` answers every decision from the record (same seat and kind, else "diverged at answer N"), reports `same` (final result and log hash) or `sameCut`; `viewerReplay(record)` exports the viewer replay v1 (`kind: 'aeterna-viewer'`, deduplicated board frames); `loadEngine({ sim: false })` runs the rules of a real web match (coin toss, Starting Hand prompts) without delays; CLI `node packages/engine/headless.mjs --replay <file>`; `playHeadless` results carry `port`.
  - Fuzz cases (`tools/fuzz.mjs`) now save the port record as `port`, so a failing fuzz game is reproduced in Node without re-running the browser sim.
  - Tests `tests/unit/replay85.test.mjs`: R85-01 headless human matches replay to the same hash, R85-02 fuzzed sims (headless and browser) replay headless from the record alone, R85-03 viewer frames (no repeats, CPU Hand hidden, last frame = result), R85-04 divergence index, refused files and a shortened record, R85-05 a real browser match cut while the human is asked replays headless to the same log, and a page message adds no answer.
  - Not in this part (F4 part 2): the playback screen in `apps/web` and saving failing Regression sims as records.
- Revert note: `git revert` of the v0.85.0 commit restores v0.84.0 (records and replay tools only; no card data or rules change).

## v0.84.0
- Lane: U/I
- **Host port, part 2b (roadmap phase F, item F3 part 2 = monorepo step M3 rest): the human seat's board actions are intent records through `io.decide`; the CPU can answer any decision through the port.**
  - `packages/engine/src/05c-intent.js` (new): on a human seat's turn `seatTurn()` asks the decision `{kind: 'action', step, turn}` until the turn ends; the answer is an intent record (`next`, `end`, `summon`, `cast`, `burst`, `mirage`, `brave`, `cadvent`, `manifest`, `accel`, `act`, `bcombine`, `bseparate`, `core {op}`, `attack`, `revive`, `summonRemoved`; cards by uid). `applyIntent()` checks each one against the rules (stricter than before: a scripted intent for a card type, step or effect index the buttons would not offer is refused) and runs it; payments and targets inside an action stay ordinary decision records. The summon / cast / Mirage / Brave / core-move / attack / NEXT code moved here from `apps/web/src/11-human.js`; `G.turnResolver` is now internal to the seat loop. View record `acted {seat, ok}` acknowledges each intent.
  - `cpuAnswer(seat, record)`: a port answerer for every record kind (actions via `cpuPlayChoice` / `cpuAttackChoice`, payments via `cpuPaymentPlan`). The offline CPU seat still decides inline (`09-cpu.js`).
  - Web host `apps/web/src/13e-host.js`: the buttons send intents with `sendIntent` (resolves true/false once applied). An intent sent while the previous one still resolves waits for it (same turn only); a press while the engine is busy is ignored as before; on a test board without a running match the intent runs at once. Replays of v0.26 input records are unchanged.
  - `packages/engine/headless.mjs`: the human seat now plays its own turns through intents (the CPU no longer plays them); an answer of `undefined` lets `cpuAnswer` decide; `human: 'pass'` ends every turn; results carry `acted {ok, refused}`.
  - Tests `tests/unit/intent84.test.mjs`: I84-01 headless human seat summons, attacks and presses NEXT through intents in 3 matches, I84-02 recorded intents + answers reproduce the match (same hash), I84-03 illegal intents are refused, a seat sending only those has its turns capped and the match still ends, I84-04 `human: 'pass'`, I84-05 browser: intents on a test board and in a real match; H82-05 lists the `acted` view.
  - Player-view pass (PC 1366x768, phone 412x915, real matches): hand summons with the payment dialog, Contract Advent / Mirage, core and Soul Core moves, attacks with block and Flash prompts, double NEXT, step chip End and clicks during effects; no console errors, no stuck state.
- Backup branch `backup/v0.83.0` (state before M3 part 2).
- Revert note: `git revert` of the v0.84.0 commit restores v0.83.0 (action routing only; no card data or rules change).

## v0.83.0
- Lane: U/I
- **Host port, part 2a (roadmap phase F, item F3 = monorepo step M3 part 1): every prompt of a human seat is now a decision record through `io.decide`; the engine calls no web function any more.**
  - `packages/engine/src/05b-decide.js` (new): `decide(seat, record)` and the engine-side `ask`, `info`, `pickFromField`, `askBlock`, `askPayment`; record kinds `choice` (buttons, optional `cards: [id]` strip, `cardsStyle: 'mull'` for the Starting Hand), `pick` (field uids), `payment` (card id, cost) and `info`. Records and answers are plain, serializable values (cards by id, Spirits by uid). `prepareHumanMagic` and `humanFlashChoice` moved here from the web part; the 14 card strips of engine prompts are now `cards` lists the host draws.
  - Web host `apps/web/src/13e-host.js` `webDecide`: opens the same modal, field pick (`webPick`) and payment dialog (`webPayment`) as before; the input record of v0.26 replays is unchanged.
  - `packages/engine/headless.mjs`: `WEB_GAPS` is empty; `playHeadless({ human: true, answer })` makes the first seat a human whose prompts are answered by a script (default `firstAnswer`); the CPU still plays that seat's own turns until board actions go through the port (F3 part 2).
  - Tests `tests/unit/decide83.test.mjs`: H83-01 headless human seat in 4 matches (choices + field picks, serializable records, clean end), H83-02 recorded answers reproduce the match (same hash), another script changes it, H83-03 the web host draws the strip, the Starting Hand list and the info dialog; H82-02/05 updated (no web function left).
  - Player-view pass (PC 1366x768, phone 412x915 and 915x412): coin toss, Starting Hand, payment dialog + View Field, effect prompts with strips, Flash Timing, block pick, zoom and Game Log unchanged, no console errors.
- Backup branch `backup/v0.82.0` (state before M3).
- Revert note: `git revert` of the v0.83.0 commit restores v0.82.0 (prompt routing only; no card data or rules change).

## v0.82.0
- Lane: U/I
- **Host port, part 1 (roadmap phase F, item F2 = monorepo step M2): the engine now reaches the page only through a port, and a CPU-vs-CPU match runs in Node without a browser.**
  - `packages/protocol/src/00p-protocol.js` (new workspace `@aeterna/protocol`): `io.view(record)`, `io.log(text)`, `io.decide(p, d)` (answered from M3 on) and `bindHost(host)`. View records are plain, serializable objects: `board`, `decks`, `screen {id}`, `reset`, `matchEnd {winner}`.
  - All 68 `render()` calls of the engine, the deck/format refresh, the screen switches, the match reset and the match end now go through `io.view`; every log line goes through `io.log`. The browser answers in `apps/web/src/13e-host.js` (redraw, screens, history entry + game-over dialog, sounds per log line, page title). Moved out of the engine: `12-zones.js` (zone/log/rules dialogs) to `apps/web`, `showGameOver`, `sfx` and `$` to the web parts; moved in: `matchSummary`, `isMainStep`, `checkInvariants` (pure rules code). The engine and protocol parts no longer touch `document` or `window`.
  - `packages/engine/headless.mjs`: `playHeadless({seed, deckA, deckB})` builds the protocol + engine script (`tools/build.mjs` `engineScript()`, same card pack) and plays it in a `node:vm` context with no DOM, ~0.1-0.5 s per match; `npm run sim:headless -- <seed> <deckA> <deckB>`. Nine human prompts are still called directly on human-only paths (`WEB_GAPS`); F3 routes them through `io.decide`.
  - Tests `tests/unit/headless82.test.mjs`: H82-01 no DOM in engine/protocol parts, H82-02 the engine uses no web function but `WEB_GAPS` (shrink-only), H82-03 every prebuilt colour plays to the end headless with valid records and invariants, H82-04 headless and browser sims give the same winner, turn and log hash (offline game unchanged), H82-05 the web host is bound and unknown records are rejected.
- Backup branch `backup/v0.81.1` (state before the port).
- Revert note: `git revert` of the v0.82.0 commit restores v0.81.1 (engine/web part moves and the port; no card data change).

## v0.81.1
- Lane: U/I
- **Chain mode ("mode rantai", owner 2026-10-20):** a finished session starts the next roadmap session in the same chat while the chain stays under 600,000 tokens; one session over 600,000 tokens turns the mode OFF. Switch like auto mode: chat `rantai on|off|status`, comment `RANTAI ON|OFF` on issue #1, or the Actions workflow "Auto mode" (`rantai-on` / `rantai-off`); default OFF. Sessions now end with `done vX.Y.Z next=… tokens=N [rantai]` and `session_gate.sh rantai next`; the final summary (and `release_docs.sh --end`) shows the `Mode rantai:` line instead of the retired Mode hemat line. Rules: `docs/ai/next-session-prompt.md` "Chain mode". Test G21 in `tests/unit/gate_lanes.test.mjs`.
- Revert note: `git revert` of the v0.81.1 commit restores v0.81.0 (gate script, workflow, docs; no engine or card data change).

## v0.81.0
- Lane: U/I
- **Effect JSON schema + validator (roadmap phase F, item F1): the card effect format is now fixed and checked** (`docs/ai/effect-format.md`):
  - `packages/engine/fx-schema.json` (schema v1), generated by `tools/fx_schema.mjs` from the engine source: 77 actions with the fields each one's code reads (its entry, the wrappers that extend it, the helpers it calls), 27 triggers, 33 conditions, 10 STATIC flags, 6 Burst timings, the Magic effects and the effect / Burst / Magic / match / card fields the parsers read. A change to the format now needs a `SCHEMA_VERSION` bump (the generator refuses otherwise).
  - `tools/fx_validate.mjs` checks every shipped card (schema + the engine's own `parseCard`) and, with `--staged`, the compiled staged pool (`docs/reports/fx-validate.md`): unknown trigger, action, condition, flag or field (a field the engine never reads would be silently ignored), bad `residual` (over 400 characters makes `parseCard` drop the card), `fxComplete: true` with a residual. Runs in `npm run loop` (static part) and CI (with the staged pool).
  - Result: shipped 6,839 / 6,839 cards valid (tokens included), staged 5,972 / 5,973 (BS60-XX01, a known data gap: 6 symbols). Test `tests/unit/fxschema81.test.mjs` (FS01 schema up to date, FS02 schema = live engine, FS03 zero shipped errors, FS04 each error kind caught).
- Fix: GitHub Release titles skip the new `- Lane:` bullet (`tools/make_releases.sh`).
- Revert note: `git revert` of the v0.81.0 commit restores v0.80.1 (tools, schema file, docs and one CI step; no engine or card data change).

## v0.80.1
- **Process reset and foundation-first plan (owner, 2026-10-20 17:00-17:08):** one main session per roadmap item, no subagents except the read-only player-view pass; Mode hemat, team sessions and card-author agents retired (A2 measured ~1 complete card per 100k tokens with agents against ~8-11 for main-session bundles); push after every commit; long runs go to GitHub Actions; no per-session size limit; Opus for engine work, Sonnet for docs and JSON-only card bundles; auto runs at :00 and :30. CLAUDE.md shortened (15.6 KB -> 7.3 KB), skill `bs-session-runner` rewritten without the team steps, `docs/ai/token-economy.md`, `next-session-prompt.md`, `release.md` and `lanes/README.md` updated; owner's words in `docs/ai/owner-instructions.md`.
- **Roadmap phase F** (`docs/ai/roadmap-open.md`): F1 effect JSON schema + validator, F2/F3 host port (M2/M3), F4 replays (M4), F5 test waits (Q2) come before more card bundles, so the effect format is frozen before thousands of cards use it; UI U5-U8 after the card rate is steady; languages, server, database and card images last.
- **Fixes:** Escape now closes the deck builder card detail (A1 follow-up (e)); the Library counts no longer include the built-in Training cards. Test `tests/unit/fix801.test.mjs` (FX801-01/02).
- Revert note: `git revert` of the v0.80.1 commits restores v0.80.0 (docs and two UI lines only, no data change).
