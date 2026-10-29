# R6 - measure before building the head parser (2026-10-29)

Command: `python3 tools/r6_head_measure.py` (reuses `pack_measure.py`: the head is swapped for a head the compiler reads, then the card is recompiled).

| Measure | Cards |
|---|---|
| staged cards in review | 7,304 |
| exactly one blocker | 3,018 |
| exactly one blocker that is a head (`no trigger` / wiki template) | 1,035 (1,030 have an official Japanese text) |
| of those, measurable by a head swap (275 distinct heads) | 782 |
| compile once the head is readable | 75 (about 10% of the measured) |

Largest rows: Mirage 88 (0 compile), Accel 20 (0), "When the opponent ..." 19 (3), "When this Spirit ..." 18 (2), cs 15 (0), Seal 13 (0), SSoul 13 (0).

**Verdict: no-go for R7 as a head parser.** Even a perfect head reader unlocks at most about 75 of the 1,035 cards (about 100 with the 253 unmeasured, if they behave alike); the body or the missing mechanic is the real blocker, so each head is better built together with its mechanic in a Lane K pack (`pack_plan.py --measure` already ranks that).

Limits: the measure replaces the English head only; it does not test whether Japanese bodies compile more easily (the compiler grammar is English, so that would need a new grammar). 253 single-head cards show no swappable head text and are not counted.
