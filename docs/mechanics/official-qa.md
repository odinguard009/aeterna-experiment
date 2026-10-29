# Official Q&A rule notes (R8, 2026-10-29)

- **Source:** the Q&A of each official card page, stored in `data/sources/official-fields.json` (`qa`: id, date, question, answer). 6,368 of 8,629 records carry at least one entry. Notes below are paraphrases; Q ids point to the original.
- **Status of every note:** read from the Q&A only. None is checked against the engine and none has a test yet; use `bs-card-verify` per card before relying on one.
- **Counts (question text, all cards):** Mirage 633 entries on 371 cards; Manifest (顕現) 172; two-sided Brave / Revival (リバイバル) wording about 770 (loose match, includes unrelated hits).

## Mirage
- Setting a Mirage is not using a Magic card, so effects that let you use Magic without paying do not let you set one without the Mirage cost (Q1819).
- An effect that keeps working "while the Mirage is set" is not counted as a use; another Magic effect may still be used once per turn on top of it (Q27713).
- Setting a Mirage through a Spirit/Nexus effect replaces the set Mirage the same way as a Main Step set, unless the effect says otherwise (Q8822).
- Mirage / Accel / Change reduction symbols are not changed by effects that change a card's reduction symbols (Q8869).
- Effects that change a Mirage effect's target cannot change a continuous effect without a "this turn/battle" duration; instant ones (set-time, Flash, "when ...") can be changed if the condition fits (Q21944).

## Manifest (顕現)
- Pays the original cost from the stated Soul-God Nexus (one or several that qualify), not from the Reserve (Q29699).
- A Manifest summon still counts as a summon for "when you summon ..." effects (Q11316).
- Trash-zone Manifest through a Contract effect only grants the summon; it is not usable at any time (Q23540). Paying from the Nexus into the Trash is not paying to the Void, so Oracle still works (Q23543).
- Super Manifest (超顕現) does not pay the original cost, so effects that depend on having paid it do not trigger (Q31764).

## Two-sided Brave (Revival)
- BS38-RV022: a Brave summoned by this Brave's When-Summoned effect does activate its own When-Summoned effect (Q20589, 2024/10/31).
- BS45-080 has no Q&A on the official page, so there is nothing to record.
- Same-name cards with different effects count together for the 3-copy deck limit (Q5610).
- A Revival Spirit summoned by its Burst does not set Burst through its own Lv effects (Q5613).

## Not done
- No engine comparison, no test, no UI link from card detail to Q&A.
- Only the three named targets were read, by sampling; the other mechanics hold more Q&A.
