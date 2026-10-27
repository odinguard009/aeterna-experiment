# Effect format (schema v4; v1 = F1 in v0.81.0)

Card effects are data. A card in `data/cards/saga-*.json` (built into `build/all-cards.json`) carries its effects in JSON that the engine reads through `parseCard` (`packages/engine/src/03-imported-cards.js`), `parseEffects` / `parseBurst` / `parseActionList` (`02c-effects-parse.js`) and the action table `FX_ACTIONS` (`02b`-`02o`). This file is the human description; the machine-readable list is **`packages/engine/fx-schema.json`**, generated from the engine source by `tools/fx_schema.mjs` (never edit it by hand).

## Shape
```
card
  effects: [ effect, ... ]            up to 8
    trigger                           one of schema.triggers (SUMMONED, ATTACKS, STATIC, ACTIVATE, ...)
    lv: [1,2]  if: {cond}  match: {filter}  once  optional  braved  ...   (schema.effectFields)
    actions: [ action, ... ]          1-6, every non-STATIC trigger
    STATIC: bp + to + per | flag (schema.staticFlags) + flag fields
  burst: { when (schema.burstWhen), if, actions, thenFlash, thenMain, noUlt, also }
  magic: { timing: [MAIN|FLASH], effect (schema.magicEffects), value, actions, by: {MAIN:{..}, FLASH:{..}}, trashUse, noMain, oppAttackHand }
  fxComplete: true | false            false = partial card ("!" mark)
  residual: [ "printed clause that does not run", ... ]   up to 12, each at most 400 characters
action
  do: one of schema.actions           + the fields listed for it (schema.actions.<DO>.fields)
  if: {cond}                          skip this action unless the condition holds (prev: the previous action happened)
  cost: true                          "by <action>": when it cannot be paid, the rest of the effect stops
cond   keys of schema.conditions      (FX_COND_KEYS in 02a-effects-base.js)
match  keys of schema.matchFields     (fxMatch: name, family, color, type, costGe, costLe, symbolsGe, noUlt)
```
Nested actions (`BY.cost`, `BY.then`, `END_BATTLE.then`, `SOUL_TO_NEXUS_THEN.then`, `magic.by.*.actions`, `magic.trashUse.actions`) follow the same action rules.

## How the schema is built
`tools/fx_schema.mjs` reads `packages/engine/src/*.js`:
- lists: `FX_TRIGGERS`, `FX_COND_KEYS`, `STATIC_FLAGS`, `BURST_WHEN`, `MAGIC_FX`, `MAGIC_TIMINGS`;
- effect / Burst / Magic / card fields: what `parseEffects` + `invokeParse` (`e.x`), `parseBurst` (`b.x`), `parseCard` (`o.x`, `c.x`, `m.x`) read; `metaFields` are data-only card fields the engine ignores (note, mechanics, name_jp, ...);
- per action: every `a.<field>` in its `FX_ACTIONS` entry, in the wrappers that extend it (`const D = FX_ACTIONS.DESTROY; D.chk = ...` in an IIFE, with the local helpers those use) and in helper functions `f(c, a)` it calls; `actionFields` (do, if, cost) come from `runActions`.
Test FS02 (`tests/unit/fx_schema.test.mjs`) compares the schema with the live engine (action names, Burst timings, trigger and flag lists).

## Validator
`node tools/fx_validate.mjs` (shipped cards, schema + `BS.parseCard`; exit 1 on any error), `--static` (no browser; run by `npm run loop`), `--staged` (also compiles the staged pool with `tools/compile_v2.py --partial` and writes `docs/reports/fx-validate.md`; staged errors are reported, not fatal; CI runs this). It reports: schema out of date; unknown card, effect, Burst, Magic, match or condition field; unknown trigger, action, STATIC flag, Burst timing or Magic effect; an action field the action's code never reads (it would be silently ignored); a bad `residual` (over 12 entries, empty, over 400 characters = `parseCard` drops the card); `fxComplete: true` with a residual. Gate: zero errors on shipped cards (test FS03). The ~15 s `npm run loop` runs `--static` (schema only, no browser); the live `BS.parseCard` gate is test FS03, which runs in the pre-push full set and CI, not in the fast loop — a parse-level rejection (e.g. a reserved id) is caught there, not by `npm run loop`.

## Changing the format (after F1: only with a version bump)
1. Change the engine (new action, field, trigger, condition, flag), scenario first as usual (skill `bs-effect-mechanic-adder`).
2. `node tools/fx_schema.mjs`: when the format part changed it refuses until `SCHEMA_VERSION` in `tools/fx_schema.mjs` is raised; raise it, re-run, commit `packages/engine/fx-schema.json`.
3. Add a line below. Additions keep every card valid; a rename or removal must migrate every card in the same commit (the validator lists them).

## Versions
- v1 (v0.81.0): first schema: 77 actions, 27 triggers, 33 conditions, 10 STATIC flags, 6 Burst timings.
- v2 (v0.88.0, S1 Standard Magic): conditions `lifeReduced`, `allHave`; match field `familyAll`; action `DESTROY_OWN`; fields `EXHAUST_OPP.coresLe`, `CANT_ATTACK_BLOCK.turn` / `costLe` (additions only, every v1 card stays valid).
- v3 (v0.89.0, S1 part 2): condition `ctrlFamily`; actions `DESTROY_PICKED`, `SOUL_HOLDER_CORE`, `LIFE_SHIELD`, `BLOCK_EXHAUSTED_OPP`; fields `BP_TARGET.perExhausted`, `BP_MINUS.other`, `EXHAUST_OPP.oppChooses`, `BOUNCE_OPP.bpLeOwnLv1` (additions only).
- v4 (v0.90.0, S1 part 3): match fields `keyword`, `noText`; `SUMMON_HAND` by colour / `noText` (sets ctx.picked); action `OWN_CORE_TO_LIFE` (additions only).
- v5 (v0.116.0, Standard keyword heads): trigger `MAGIC_USED` ("when you use a Magic card"; `match` filters the used card, which arrives as `ctx.subject`, and a Burst activation does not fire it); condition `magicUsed` (the same match shape, "if you used a X Magic card this turn") (additions only).
- v6 (v0.118.0, Standard keyword head Rumble): action `RUMBLE {n:1-7}` (queued at ATTACKS, resolved at the end of battle) (addition only).
- v7 (v0.120.0, Standard keyword head Amplify): field `BP_TARGET.per` (`{type:'Spirit'|'Nexus', family|colors|name}` per-count, "for each X you control, +N BP this battle") (addition only).
- v8 (v0.135.0, Form Change): action `FORM_CHANGE {match, costIn:[N..]}` ("return this exhausted Spirit to the Hand and summon a Cost N Spirit with a different name from your Hand without paying"; pair with `invoke` MAIN + `sameName`) and condition `viaFormChange` (boolean, "if summoned via Form Change"; `false` = the otherwise branch) (additions only).
- v9 (v0.135.0, "If C, B instead"): condition `not` (`{"not": {one condition}}` = true when that condition is false; no nesting). A replacement pair compiles to the first action with `if: {not: C}` and the replacement with `if: C` (addition only).
- v10 (v0.159.0, Lane K): STATIC flag `blockingOnly` ("(During Block)": the BP applies only while this Spirit is the blocker); `LOOT.to: "deckBottom"` ("draw N, then return M cards from your Hand to the deckbottom": the player picks each card in turn, so the pick order is the deck order) (additions only).
