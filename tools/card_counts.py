#!/usr/bin/env python3
"""v0.79.0 (A1, owner 2026-10-20): the two card counts.
  playable = in data/cards (in the library, can be put in a deck and played; "!" partial cards included)
  complete = every printed effect runs: the same rule as the engine's `implemented` flag (registerImported in
             packages/engine/src/03-imported-cards.js); test PA05 keeps the two in step.
Progress, pack measurements ("+N cards") and the v1.0 target use complete."""
import json, os, re
import allcards      # build/all-cards.json is generated (not in git): allcards.load() writes it when missing or stale

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TEAM = re.compile(r'(?m)^[ \t]*\[Teams?:[^\]\n]+\][ \t]*(?:\n|$)')      # a team head line is read by the engine from the text (cardTeams): a card that prints only it has no effect to run
LEGACY = re.compile(r'(?m)^[ \t]*\(Legacy\)[ \t]*(?:\n|$)')


def complete(c):
    res = c.get('residual') or []
    if c.get('type') == 'Magic':
        m = c.get('magic') or {}
        return bool(m.get('effect') or m.get('by')) and not res
    t = c.get('text') or ''
    if not t: return True
    if not TEAM.sub('', t, count=1).strip(): return True
    if c.get('legacy') is True and not LEGACY.sub('', t, count=1).strip(): return True
    # v0.104.0: a data-field mechanic that runs straight from its flag is a payload of its own, so a card whose only
    # printed effect is that mechanic counts complete: High Speed (flag highSpeed, summon in the Flash Timing is
    # implemented directly) and "treated as <colour>" (colors, honoured wherever colour/symbols are matched).
    # Clause coverage is guarded by the A1 discipline: a card with an extra printed paragraph carries `residual`.
    shape = c.get('highSpeed') is True or (c.get('colors') not in (None, []))
    return (bool(c.get('effects') or c.get('burst') or c.get('brave') or c.get('overCount')) or shape) and c.get('fxComplete') is True and not res


def counts(cards=None):
    if cards is None: cards = allcards.load()
    return len(cards), sum(1 for c in cards if complete(c))


if __name__ == '__main__':
    p, k = counts()
    print(f'playable {p:,}, complete {k:,}')
