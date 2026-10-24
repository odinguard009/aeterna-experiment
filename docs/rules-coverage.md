# Aeterna — Rules Coverage Audit (rule sources read 2026-10-14; status rows updated per release up to engine v0.95.0; the "vX additions" sections below are a history log)

v0.13 adds: Void zone (cores sent to the Void by effects; replaces the earlier "no Void zone" decision because Contract cards need it), Soul State Area, 10 new actions (SOUL_ENTER, SOUL_RETURN, SOUL_SUMMON, VOID_TO_RESERVE, VOID_TO_CARD, CORE_TO_NEXUS, BOUNCE_OPP, DISCARD_OPP_BURST, NEXUS_CORES_TO_VOID, DECK_TO_TRASH_CORES), triggers ALLY_SUMMONED and ACTIVATE, conditions soulGe / oppHandGe / voidGe / controlName / prev.


Sources: official Battle Spirits site (battlespirits.com): Eternal Rule Manual Ver.17.1 (2026-05-29), Standard Rule Manual Ver.1.1 (2026-10-02), Standard Comprehensive Rules Ver.1.0 (2026-04-10), Eternal Ver.17.0 revision notice (2026-04-03), Banned/Restricted list (announced 2026-08-21, effective 2026-09-01).
Note: the Eternal 17.1 and Standard 1.1 *change notes* could not be read (pages only list titles). Details below come from the 17.0 revision notice and the Standard 1.0 comprehensive rules; anything changed in 17.1 / 1.1 must be re-checked against the PDFs.

## Formats
| Format | Cards allowed | Notes |
|---|---|---|
| Eternal | every card except banned/restricted | no Second Main Step; Flag Nexus (BS76+) |
| Standard | only cards with a letter block icon; Apr 2026 – Mar 2027 = block "A" only | has Second Main Step; Succession, Soul Magic, Shinkai-ho (Super Unleash), "while attacking" timing |

Shared: 40+ card deck, max 3 copies by name, 5 Life, 3 Reserve + 1 Soul Core, draw 4, one redraw after turn order, first player's first turn skips Core/Attack(/Second Main), win by Life 0 or deck 0 at own start step.

## Status legend
✅ implemented and tested · 🟡 partial · ❌ not implemented

## A. Core rules (both formats)
| Area | Status | Note |
|---|---|---|
| Deck 40+, max 3 same name, one Contract type | ✅ | validateDeck |
| Setup: 5 Life, 3 Reserve + Soul Core, 4 cards, one redraw | ✅ | |
| Turn order by coin toss | ✅ | official uses rock-paper-scissors, equivalent |
| Steps Start/Core/Draw/Refresh/Main/Attack/End | ✅ | first turn skips Core + Attack |
| Cost payment, mandatory reduction, depletion | ✅ | |
| Lv by core count, BP per level | ✅ | |
| Attack, block (one blocker), BP compare, symbols damage | ✅ | |
| Deck-out loss at own Start step | ✅ | |
| Life cores go to Reserve | ✅ | |
| Mandatory Soul Core use (17.0) | ✅ | JP 17.0 revision notice item 5 (read 2026-10-16): the Soul Core is part of every game (setup 3 cores + 1 Soul Core in the Reserve); spending it stays optional. Engine setup already does this |
| Standby state unification (17.0) | 🟡 | v0.57.0: a destroyed/depleted card waits in Standby (`p.standby`) while its leave triggers resolve, its symbols still reduce costs, then goes to the Trash/destination (JP 17.0 notice item 4, test S557). Open: When Banished / leaves-the-Field triggers (none in the engine yet) Record: `docs/mechanics/standby.md`. |
| Rule priority cannot > must > may (17.0) | ✅ | v0.58.0: can't block beats must block; unaffected Spirits are not bound by must block; ignoreImmune > unaffected (A58-10/11) Record: `docs/mechanics/effect-priority-unaffected.md`. |
| Effect engine (data-driven effects: When Summoned / When Attacks / ally attacks / ally blocked / static BP) | 🟡 | v0.12: 11 actions (draw, counter, destroy by BP/symbols/Nexus/returned-card BP/family in opposing Trash, BP+, core to self, refresh, refresh a Spirit, return from Trash, summon this card free, summon from Hand free), per-action conditions, level gating, once per turn, optional prompts, human target pick; 12 red cards partly wired |
| Triggered effects order (turn player chooses) | 🟡 | v0.13: effects that trigger together are collected and a human owner picks the order (CPU: field order); not yet across the two players |
| Flash timing (2 windows, defender first) | ✅ | v0.9: priority alternates, responses allowed; Flash used by Magic only (Flash effects on Spirits ❌) |
| Magic cards ([Main]/[Flash]) | 🟡 | v0.9: cast, cost reduction, targets, CPU; v0.41: `magic.effect = "ACTIONS"` runs engine actions (Dana Draw, Whirling Tide, Magic Bullet, Hades Disaster, Thunder Counter, Lightning Tempest); not built: use from the Trash, Deck-to-Trash triggers, Plutonic Wall |
| Heavy Exhaust | ✅ | v0.38: `heavy` flag, HEAVY_EXHAUST_OPP, one Refresh -> Exhausted; v0.40.2: drawn upside down (180 degrees) |
| Removed Zone (card-text rule, no manual rule found) | 🟡 | v0.38: hand/Trash/Spirit put there, OPP_REMOVED trigger; returns and locks not built |
| Burst lock for one battle (card text) | 🟡 | v0.38: NO_BURST_BATTLE (Contractor Hermes) |
| Cores sent to the Reserve, Depletion (p. 28) | ✅ | v0.39: OPP_CORES_TO_RESERVE then checkDepletion (Vaplus, Dells-Vajram, Contractor Hades skill) |
| "By discarding a card" cost (FAQ Q5) | ✅ | v0.39: BY + DISCARD_HAND (Naberidus, Infernal Soldier) |
| Deck to Trash (mill) | ✅ | v0.39: MILL, DECK_TO_TRASH_CORES |
| Constant effects not negatable by "cannot be prevented" (17.0) | ❌ | |

## B. Eternal-specific
| Area | Status | Note |
|---|---|---|
| Contract + Soul State | 🟡 | v0.13: Soul State Area (no card limit, shown top-right / mirrored), cards can enter from Hand/Trash/Deck reveal/field, return to Hand, summon/deploy free; Void zone (cores); counter max; ACTIVATE effects (Main button + Flash windows). Not yet: Revive, Contract Advent, Manifest, Soul State in Hand-set Mirage |
| Advent (煌臨) | 🟡 | one generic form (Soul Core moves). v0.14: Contract Advent (Soul Core to the Trash, family + counter requirement, Your Turn / Either Attack Step, from the Hand in Main or Flash windows, "When Advents" effects) Record: `docs/mechanics/contract-advent.md`. |
| Burst (once per turn, declare timing per 17.0) | 🟡 | v0.12: Burst is engine data (card.burst = {when, actions}); 3 triggers: after your Life is reduced, after your Spirit is destroyed by the opponent, after an opposing (When Summoned) effect activates. Works for Spirit and Magic Burst cards. Not yet: Flash follow-up after a Burst (pay the cost to use the Flash effect), simultaneous-trigger ordering Record: `docs/mechanics/burst-order.md`. |
| Count area | ✅ | basic |
| Brave | 🟨 | v0.34: Spirit form, combine/separate, direct summon, BP+/symbol, leaves with the Spirit, CPU. v0.35: Saga Brave onto a Grandwalker Nexus (Yaj-Veda), Brave symbol counts for Life damage. Imagine Brave, swaps and [While Braved] effects not yet. v0.60.0: combine data for 287 staged Braves from the Fandom page fields (`data/sources/fandom-brave-combine.tsv`); [When Braved] / During (Spirit) Brave effects of the Brave move to the combined Spirit (`fxEntries`, BR_IDX). Open: two-sided Braves (Left/Right), Braves onto Ultimates, Grandwalker-Nexus braving for imported Braves, symbol/keyword-holder conditions. |
| Token | ✅ | v0.35: Token supply outside the Deck, SEND_TOKEN (no cost, Lv1 cores, not a summon), back to the supply when leaving the Field. Tests K01-K15. |
| Ultimate | 🟡 | v0.46.0: summon with summon condition, LV3+ levels, Ultimate symbol, attack/block, depletion, not a Brave / Contract Advent target. v0.56.0: Sumcon summon conditions in the compiler (colour/cost/family/Life/counter), Ultimate Trigger action (opposing decktop to the Trash, hit when its cost is lower; Eternal Rule Manual sec.15 and the Fandom card reminder). Open: Ultimate Trigger level/timing (missing in the Fandom export), Double/Triple Ultimate Trigger, Guard / Trigger Counter; Spirit-only effects still reach Ultimates. |
| Grandwalker / Grandstone Nexus | ❌ | |
| Contract Grandwalker Nexus | ❌ | needed for BS76 red |
| Flag Nexus + F-Contract Advent (BS76) | ❌ | needed for BS76; v0.48.0 checked: not in the engine, the Flag Nexus rule box ("FArule") and Nexus levels are missing from the Fandom export, all 32 cards are staging only; v0.55.1: rule text found in the JP 17.0 revision notice item 2 (Flag Nexus = ordinary Nexus; Contract Flag Nexus has Contract card traits; F Contract Advent onto Spirits or Nexuses, also in Soul State) Record: `docs/mechanics/contract-advent.md`. |
| Mirage | 🟡 | v0.10: Burst/Mirage Area (one card, once per turn), set face up by paying the Mirage cost; effects not implemented |
| Seal | 🟨 | v0.48.0: Soul Core in Life (manual p.49), SEAL action, Seal Manifest, Seal Contract Advent spec, `sealed` condition; Life loss takes normal cores first (no human choice yet). Tests seal48 S01-S09. Record: `docs/mechanics/seal.md`. |
| Rebirth | ❌ | |
| Manifest | 🟡 | v0.14: Flash from the Hand, Soul Core to the Trash + one core from the named Nexus, counter requirement, summon free. CPU uses it in its Main Step; CPU does not use Flash windows yet |
| Over Count, Counter | ✅ | v0.34: `overCount` BP+ and `oc:true` effects (manual p. 61). |
| Keyword effects (renamed in 17.0; multiple keywords per card) | 🟡 | v0.49.0: High Speed (`highSpeed`, Flash Timing), Crush (action `CRUSH`), Holy Life (ALLY_LIFE_HIT self + VOID_TO_LIFE) executed; v0.50.0: Accel (ACCEL effects from the Hand, Removed Zone, Removed Zone summon; Accel-cost reductions not in the data) and Silver Wheel (ACTIVATE silverWheel + SILVER_WHEEL trigger) executed, partial; Soul Magic executed v0.64.0; Ultra Holy Life, Heavy/Ultra Armor, Nether Immortality still only stored (glossary `K_*`, status missing) |
| Banned/restricted enforcement (76 banned, 81 limit-1, 1 limit-20; effective 2026-09-01) | ✅ | v0.8 validateDeck; applied to both formats |
| Standard-card text treated in Eternal (omitted "this Spirit's") | ❌ | |

## C. Standard-specific (format not offered yet)
| Area | Status |
|---|---|
| Format selector (Eternal / Standard) | ✅ |
| Second Main Step | ✅ |
| Letter-block legality (block "A" until 2027-03-31) | ✅ |
| Succession (継召) | ❌ |
| Soul Magic | ✅ | v0.64.0: `soulMagic` colour on Magic cards; usable with only the Soul Core (Reserve or Field, not Life/Trash) while a symbol of that colour is on your Field (Standard CR 12-2-1-2, Q&A 31159-31161); human picks Soul Core or normal payment, CPU uses it when the normal cost is unpayable or 3+ |
| Shinkai-ho (Super Unleash) = True Release | ✅ | v0.66.0: `trueRelease` on Spirit / Nexus cards; holding the Soul Core fulfils LV2 (Standard CR 12-2-1-1, manual "True Release", Q&A 31532-31534); "(During Attack)" heads for self +BP and Clash |
| Invoke (Standard activation) | 🟡 | v0.68.0: ACTIVATE `invoke` with timing heads (Your / Opposing / Either Attack Step, Your Turn, During Attack, During Block), (Once Per Turn) / (Once Per Battle), costs pay N, exhaust / destroy this card, exhaust one of your family Nexuses / Spirits, discard a family card (Standard manual "FAQ on Effects" Q11: the cost resolves in full or nothing happens); open: conditional and other costs |
| "While attacking" timing (アタック中) | 🟡 | v0.66.0 (During Attack) self +BP; v0.68.0 Invoke (During Attack) / (During Block) heads |
| Standard Rule Card / Play Sheet layout | ❌ |

## D. Suggested order
1. (DONE in v0.8) Format selector + legality framework (Eternal = all minus banned list; Standard = block A) and a deck-legality screen using the saved banned list.
2. (DONE in v0.9, basic effect set) Magic cards + real Flash timing.
3. Standby state, mandatory Soul Core, trigger ordering (rule engine hardening).
4. Keyword effects, Heavy Exhaust, Counter/Over Count.
5. Eternal gimmicks needed for the red BS76 deck: Contract Grandwalker Nexus, Flag Nexus, F-Contract Advent, Manifest, Mirage, Seal, Brave.
6. Standard extras: Second Main, Succession, Soul Magic, Shinkai-ho.
7. Re-read Eternal 17.1 and Standard 1.1 PDFs for changes after 17.0 / 1.0.

## v0.15.0 additions
| Rule / card | Status | Notes |
|---|---|---|
| "Opposing Hand increases by an opposing effect" | 🟡 | Fires when a player's own effect (draw, Trash/Soul State to Hand) raises their Hand. Used by Temple (LV1-2, opposing turn, Soul State ≤5) and the Nao Burst. Normal turn draw does not count. |
| "Ally attack reduces the Life" (Banve) | ✅ | Fires after unblocked damage; the extra Life goes to the Reserve and can win the game / flip a Burst. |
| "Ally depleted/destroyed by the opponent" (Do) | 🟡 | Up to 3 Trash cores (not the Soul Core) go one by one to the Reserve or a matching field card. |
| Revive [Main] | ✅ | Soul State button in the Main Step, once per turn per name; the CPU uses it. |
| Not wired | ⬜ | Temple deploy-on-Soul-State and LV2 line; Nao core distribution is on one Spirit; Banve "unaffected"; CPU Flash use; Contract Field second half. |

## v0.16.0 additions
| Rule / card | Status | Notes |
|---|---|---|
| Advent / Contract Advent in a battle | ✅ | The Spirit on top of the stack continues the fight (attacker or blocker). |
| Contract Field (Soul State Contract Advent) | 🟡 | Only Reserve cores can be put onto the advent card; Field cores are not offered. |
| CPU Flash use | 🟡 | Contract Advent to win a fight, Contract Field / Contract Skill. No other Spirit Flash effects exist yet. |

## v0.18.0 additions
UI only (log drawer, hover preview, keyboard, match history, How to play). No rules changes.

## v0.19.0 additions
| Rule / card | Status | Notes |
|---|---|---|
| Start of Your Attack Step trigger | ✅ | Balmung LV2-3: up to five Trash cores (not the Soul Core) to Crimson/Wurm cards, optional Nexus destroy. |
| Mirage "During Set" effects | 🟡 | Triggers when your/the opposing Life is reduced (Ankillersaurus, Katanakasago). Not yet: setting a Mirage for free when revealed from the deck; Lava Sea Flash; Thunder-Z-Mole. |
| "Must block if possible" | ✅ | Goradon LV2; the human prompt has no "Do not block". |
| "Cannot be returned by opposing effects" | 🟡 | Tartargar; only engine return actions check it (Spirit/Nexus return effects). |
| Awaken (Flash, move cores between Spirits) | 🟡 | Sabecaulus; human only (the CPU does not use it). Draw once per turn when your effects send cores to it. |
| Summon from Soul State by an attack effect | ✅ | Lizardedge (Hand/Soul State), Altair (Soul State). |
| Not wired | ⬜ | Grandwalker Nexus core effects (wired in v0.25), Over Count, Brave, Ultimate, Seal. |

## v0.20.0 additions
| Rule / card | Status | Notes |
|---|---|---|
| Magic with different [Main] and [Flash] effects | ✅ | `magic.by = {MAIN:{...}, FLASH:{...}}`. Wurm Draw: Main reveals 3 and adds Crimson/Wurm/Kushina (one card per name keyword, needs a Siegwurm incl. Soul State), Flash gives a Wurm +5000 BP. |
| Alternative cost (`costAlt`) | ✅ | Once per turn per name; Wurm Draw becomes Cost 3 while you control a Wurm (incl. Soul State). Normal cost reduction still applies. |
| Not wired | ⬜ | Burst "then pay the cost to use the Flash effect" (Meteor Defense, Magma Call); extra symbol effects; Star Intention / Howling Effect reveal triggers. |

## v0.21.0 additions (checked against Eternal Rule Manual and Standard Comprehensive Rules 1.0)
| Rule | Status | Notes |
|---|---|---|
| Burst Area holds one Burst and one Mirage | ✅ | Was one card in total. Separate once-per-turn flags (assumption: each is once per turn). |
| A replaced Mirage returns to the Hand; a replaced Burst goes to the Trash | ✅ | Was: both went to the Trash. |
| (Flash) without a step restriction is usable in the Main Step too; "(Either Attack Step)" is Flash Timing only | ✅ | Sabecaulus Awaken corrected. |
| CPU sets a Mirage that has an effect | ✅ | New. |
| Found in the manuals, not wired | ⬜ | Unstackable, Seal (Soul Core in Life), Over Count, Brave, Ultimate rules (not affected by Spirit-targeting effects), Token "by doing X" requiring X, simultaneous-trigger order across both players. |
| Revive/Revival | ✅ | Resolved in v0.23: the cost is paid. |

## v0.22.0 additions (official Eternal manual)
| Rule | Status | Notes |
|---|---|---|
| Lv of a Contract Grandwalker Nexus is decided by the Count, not by its cores | ✅ | Zeus (Count 6), Brahma (4), Lugh (2), Ometeotl (2), Mitra (2). `countLv` is set for Grandwalker Nexuses named "...Contractor...". Ordinary Nexuses still level by cores. |
| Checked and already matching | ✅ | 40+ cards / 3 copies, 5 Life, 3 Reserve + Soul Core, redraw once, Refresh moves Trash cores to the Reserve, Life cores go to the Reserve, deck-out judged at your own Start Step, cost reduction mandatory and no overpay, no hand limit, Core move / Soul Core swap in Main. |
| Not wired | ⬜ | Draw game when both players lose at the same time (comprehensive rules 1-3-3). |

## v0.23.0 additions (official Eternal manual: Void, Revival, summon/deploy)
| Rule | Status | Notes |
|---|---|---|
| Cores of a Grandwalker Nexus go to the Void when it leaves the Field (destroyed, returned, enters Soul State) | ✅ | `releaseCores`; Soul Core still returns to the Reserve; other cards' cores still go to the Reserve. |
| Revive/Revival pays the Nexus' cost | ✅ | `summonPaid`; with too few cores it is not offered; the human gets the payment dialog; the once-per-turn mark is released if payment is cancelled. |
| "Summon/deploy" without "without paying the cost" pays the cost | ✅ | `pay:true` on Mitra Contract Skill and Pachhattar (Soul State), Lizardedge, Altair. Balmung, Nao and Magma Call stay free. |
| Not wired | ⬜ | Draw game on simultaneous loss; Grandwalker core effects; Over Count; Brave; Ultimate; Token; Seal. |

## v0.25.0 additions (official Eternal manual, read 2026-10-13 from asia-en.battlespirits.com/pdf/official-rule-manual_eternal.pdf, Ver.17.0 text)
| Rule / card | Status | Notes |
|---|---|---|
| The Soul Core is only in the Reserve, on a Field card or in the Trash, never in the Void | ✅ | Effects that send cores to the Void never move the Soul Core (manual FAQ: another core goes instead). "Send your Soul Core to X" takes it from the Trash, the Reserve or a card it can leave without depleting a Spirit (`soulSource`). |
| Manifest: Soul Core to the Trash, 1 cost paid with a core of the target Grandwalker Nexus, treated as summoned by paying 1 cost | ✅ | Already so since v0.14; `manifest.turn` adds "(Either Attack Step)" = Flash Timing of either Attack Step (Sphinott-Hauser) next to "(Your Turn)". Humans get a Manifest button in Flash Timing; the CPU manifests when its When-Manifests effect has a target. |
| (When Manifests) does not activate when the Manifest happens in the Main Step | ✅ | New trigger MANIFEST, fired by `doManifest` only outside the Main Step. |
| "Summon/deploy" from revealed cards pays the cost | ✅ | Magmatodon deploys Ometeotl with `pay:true` (manual FAQ Paying Costs Q3). |
| Unaffected by opposing effects | 🟡 | Ometeotl with a Soul Core (Contract Field): opposing destroy / return / cores-to-Void actions skip it. Magic cards only target Spirits so far. Other "unaffected" cards (Banve, Grandwalker Nexus general immunity) are not wired. |
| "Send all cores from an opposing Grandwalker Nexus" means one Nexus | ✅ | Corrected for Aath (it emptied every opposing Grandwalker Nexus before). |
| Cards | ✅ | Erimakilizard, Magmatodon, Cladoselache (LV2 re-uses its When Summoned actions), Sphinott-Hauser, Pachyrhachis, Magmazosia fully wired; Ometeotl partly (immunity + counters +2; the rest is listed in its `residual`). |
| Card `residual` list | ✅ | Printed clauses that are not implemented are listed per card and shown in the card detail / hover (idea from the Aegis study). |
| Known limits | ⬜ | Banish is not defined in the 17.0 text available online (engine: Banished zone). In sims the Manifest of Sphinott-Hauser is rare because Ometeotl only gets cores from Pachyrhachis until Neo-Core Charge is wired. The 17.1 PDF still has to be compared with 17.0. |

## v0.26.0 additions
No rules changes. Tooling: seeded randomness per match, input record + replay (`runReplay` checks the final result and a hash of the whole log), named scenarios in `tests/scenarios/`.

## v0.31.0 additions
UI only (owner-approved, issue #6): Title Case labels, card-style effect text, magnifier button instead of the hover / long-press preview. No rules changes.

## v0.27.0 additions
UI only (user request): card images in every card zone and card prompt, sideways scrolling strip. Hidden information stays hidden (opposing Hand, face-down Bursts, Deck). No rules changes.

## v0.28.0 additions (official Eternal manual, read 2026-10-14: FAQ About Effects in General Q3/Q5/Q6/Q9, Other Rules "About Activating Effects", Burst FAQ Q5)
| Rule | Status | Notes |
|---|---|---|
| "By doing X, do Y": X must be performable, X is not done when Y cannot be done, the player chooses (Q5); "you can do X; if you do, Y" does Y as far as possible (Q6) | ✅ | Action `BY {cost, then, ask}`. Paanch, Pachhattar, Sphinott-Hauser (banish), Hazaar LV2. |
| Effects activating at the same time: the turn player decides the order (also the opponent's effects) | ✅ | `fireFxMulti` pool. Life reduced (attacker ALLY_LIFE_HIT / Mirage, defender Mirage), When Attacks + ally-attack triggers, When Manifests + summon triggers. A CPU turn player resolves its own effects first. |
| An effect activated by a resolved effect is resolved first | ✅ | Triggers caused while an effect resolves are queued and resolved right after it (`asResolving`, `flushDerived`), before older pending effects; also for Activate effects and Bursts. |
| Ongoing (category A) effects before timed (category B) effects | ✅ | Ongoing effects are always applied (static BP / flags), so they never wait in the pool. |
| Bursts: declared at the same timing, starting with the defending player; several Bursts resolve in activation order | ✅ | v0.55.2 (JP 17.0 notice item 6): `flushBursts()` resolves all non-Burst triggered effects of the event first, then the Bursts, non-turn player first, each in declaration order; one Burst per player per event. |
| Priority "cannot" > "must" > "may" (Q3) | ✅ | v0.58.0 (see the 17.0 row above). |
| Once per Turn vs Once per Turn: Same Name (Q9) | ✅ | Already so: `once` per card, `sameName` per name. |

## v0.29.0 additions (official rules, read 2026-10-14: CR 4-8-1/4-8-2, CR 7-3-2, Eternal manual pp. 9, 11-12, 20-21, 28, 30-31, 55, 60)
Every rule below is listed in `data/kb/rule-obligations.json` with its proving test (checked by `tools/check_obligations.py`).
| Rule | Status | Notes |
|---|---|---|
| The Void is the core supply with no limit; when it runs out cores come from outside the game (CR 4-8-1/4-8-2) | ✅ | `takeFromVoid`: uses the Void first, then adds new cores (`made`). VOID_TO_RESERVE / VOID_TO_CARD no longer stop at an empty Void. |
| Core Step: 1 core from the Void to the Reserve (CR 7-3-2) | ✅ | Was "1 new core"; same total, now the Void is used first. |
| Count Area cores come from the Void (p. 60) | ✅ | COUNTER uses `takeFromVoid`. |
| Setup: 5 Life, 3 Reserve + Soul Core, Hand 4; Contract card + 3 drawn (pp. 11-12, 55) | 🟡 | Adding the Contract card is optional in the manual; the engine always adds it (choice prompt = UI change, suggested to the user). |
| Redraw once: the whole Hand, a Contract card too, returns; draw 4; the Contract card is not added again (p. 12) | ✅ | Proven through the real start-of-match prompts. Manual order is "in turn order"; the result is the same. |
| First turn skips only the Core and Attack Steps (pp. 20-21) | ✅ | Draw Step tested; the CPU does not attack on turn 1. |
| Refresh Step, End Step, deck-out at the own start step only (pp. 9, 20) | ✅ | Drawing the last card is not a loss; the opponent's start step is not judged for you. |
| Battle: one Refresh-state blocker, lower BP destroyed, equal both, unblocked Life -symbols to the Reserve, Life 0 loses (pp. 30-31) | ✅ | |
| Depletion is not destruction (p. 28) | ✅ | No Burst/destruction event. |

## v0.33.0 additions (Eternal manual VER.17.0)
| Rule | Status | Note |
|---|---|---|
| (When Blocks) activates after the block, one pool with the attacker's "when blocked" effects (p. 30) | ✅ | Trigger BLOCKS; `alsoBlocks` for "(When Attacks/Blocks)". Tests M05-M11. |
| v0.55: BP minus (no rule destruction at 0 BP, FAQ p. 68), (When Destroyed by the Opponent) (CR 12-2-1-12-1), (When Battles) battle win (CR 8-1-6-2), Rush symbol condition | 🟨 | BP_MINUS on one opposing Spirit; DESTROYED `if:{byOpp}`; trigger BATTLE_WIN; per-action `if:{hasSymbol}`. Open: every/two opposing -BP, 'then destroy at 0', Depleted/Destroyed by the Opponent, other (When Battles) texts. |
| (When Destroyed) on the card itself, battle or effect, not depletion (p. 31) | 🟨 | Resolved right after the card reaches the Trash, with its stored level. Tests M12-M15. |
| "When your X destroys an opposing Spirit" (pp. 30-31) | 🟨 | Battle only (trigger ALLY_DESTROYS). |
| Effects from the Hand when your Spirit is blocked | ✅ | ALLY_BLOCKED `zone:"hand"` + DEPLOY_SELF (The Crimson Lavafalls). |
| "When revealed from the deck" | 🟨 | No manual rule; ruling: resolves at once inside the revealing effect. Magic reveals not yet. |
| Brave (pp. 34-36) | 🟨 | v0.34. Tests V07-V24. |
| Over Count (p. 61) | ✅ | v0.34. Tests V25-V28. |
| Tokens (p. 56-57 + "How to Use Token Cards") | ✅ | v0.35. Tests K01-K18. |
| Saga Brave onto a Grandwalker Nexus (p. 38-39) | 🟨 | v0.35: Nexus does not take the Brave's cost/family. Tests K31-K35. |
| Cost Destruction effects + limit bonuses (card text) | ✅ | v0.37. Tests B07-B13. No manual page defines the term (manual-notes.md). |
| Nexus Brave Contract Skill of Contractor Nuadha | ✅ | v0.37. Tests B26-B29. |
| Brave summoned by an effect (as a Spirit) | 🟨 | v0.37: no direct combine by an effect, no summon from the Trash. Tests B17, B32. |
| Can't attack/block effects (Indra Contract Skill, Nazuma, Vajrawurm) | 🟨 | v0.40: permanent flag, no attack or block; manual text not re-read. Tests Y09-Y11, Y28. |
| Extra reduction symbol from a Field card (Indra Contract Field, Shimavajdra) | ✅ | v0.40. Tests Y21-Y22. |
| "(Can't Stack)" and "your other X" effect flags | ✅ | v0.40. Tests Y27, Y32. |
| Life <-> Spirit / Void <-> Life core moves (Magan, Naraka) | 🟨 | v0.40: built as printed, no Burst. Tests Y17-Y18, Y37, Y41. |
| Contractor Indra (Neo-Core Charge, Contract Field, Contract Skill) | 🟨 | v0.40: Lv2 at Count 2. Tests Y24-Y29. |
| Ending the Attack Step via effects, and "the opponent can't end the Attack Step via effects" | ✅ | v0.43: Crimson Meteor Defense Flash, Sunya Lv3, Crimson Crater Lv2. Tests E01-E21. |
| Burst "then by paying the cost, activate this card's (Flash) effect"; (Can't Use in Main) | ✅ | v0.44: Crimson Meteor Defense, Magma Call. Tests F01-F21. |
| Magic clauses: sent-to-Trash triggers, use from the Trash, attack/block core tax, Trash symbols, Hand protection, opposing-Attack-Step Hand trigger, Burst then Main | 🟨 | v0.47: Whirling Tide, Thunder Counter, Hades Disaster, Plutonic Wall, Lightning Tempest, Dana Draw (depletion Burst open). Tests M01-M17 (magic47). |
| Standard Magic conditions "If your Life was reduced this turn", "If all your Spirits/Nexuses have X" (family / Team), "all your Spirits are Cost 2/4/6/8 with X"; own-Spirit destruction as the first step; turn-long can't attack/block | 🟨 | v0.88.0 S1: 39 Standard Magic cards (23 complete). Empty-Field reading of allHave is a house reading. Tests S88-01..S88-10. |
| Standard Magic: "your Life can't be reduced by its attack", "the opponent targets ...", "When this battle ends, destroy it" (Magic delayed effect), "can block even while exhausted", Soul Core holder cores, "If you control any X/Y family Spirit" | ✅ | v0.89.0 S1 part 2: 9 cards. Tests S89-01..S89-08. |
| Standard block A: "When you use a <family>/<colour> Magic card" and "If you used a X Magic card this turn" | 🟨 | v0.116.0: trigger `MAGIC_USED` + condition `magicUsed`; the event (using a Magic card) is an ordinary game action, not a numbered entry in Standard Comprehensive Rules 12-2, and the "during this battle" BP uses the existing battle-scoped modifier. A Burst activation does not fire it (house reading: a Burst is triggered, not used). Tests M116-01..05. |
