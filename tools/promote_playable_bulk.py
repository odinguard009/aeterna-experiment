#!/usr/bin/env python3
"""One-off bulk playable pass (owner order 2026-11-01): promote every staged card that the game can
load as a partial playable card, with the printed text in `residual` and no effects wired yet.
A later Lane K session completes them in place; the A1 note keeps each staging record in the compile
pool (tools/compile_effects.py staged() skips A1 partial cards when it looks for `have`), so a fuller
compiler can replace them instead of duplicating them.

  python3 tools/promote_playable_bulk.py --dry-run   -> counts + skipped cards only
  python3 tools/promote_playable_bulk.py             -> data/cards update + build/all-cards.json

Run tools/apply_official_fix.py first: the levels, god/ultimate reductions and Brave data come from the
official card database. The KNOWN_GAPS set is the same one as tools/check_staged.mjs.
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
KNOWN_GAPS = {
    'BS77-AX02': 'Fandom card page is blank (history: moved from a category page, then blanked); the BS77 set page lists no stats',
    'BS77-AX03': 'Fandom card page is blank (history: moved from a category page, then blanked); the BS77 set page lists no stats',
}
ID_RE = re.compile(r'^(BS|SD|CB|BSC|LM|PB|P|X|CP|26R[A-Z]+)\d+-(?:[A-Z]*\d+[A-Z]?|10THX\d+)$')
FIELDS = ('id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels',
          'families', 'text', 'image', 'block', 'saga', 'rcode', 'collab', 'bicon')
NOTE = ('Partial card (v0.79.0 bulk playable pass 2026-11-01): printed text only, effects not wired; '
        'staging record kept in data/import for a later compiler pass.')
TEAM = re.compile(r'(?m)^[ \t]*\[Teams?:[^\]\n]+\][ \t]*(?:\n|$)')
LEGACY = re.compile(r'(?m)^[ \t]*\(Legacy\)[ \t]*(?:\n|$)')
COLORS = {'red', 'purple', 'green', 'white', 'yellow', 'blue'}
# Fandom-only wiki markup in the English text was repaired from the Fandom pages (2026-11-01);
# nothing is skipped for text formatting any more.
BAD_TEXT = set()


def load(pattern):
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, pattern))):
        out += json.load(open(f, encoding='utf-8'))
    return out


def residual_clauses(text):
    """Printed clauses for the UI, within parseCard limits (12 entries, 400 chars each)."""
    text = (text or '').strip()
    if not text:
        return []
    raw = [p.strip() for p in re.split(r'\n+|(?<=[.!?])\s+', text) if p.strip()]
    out = []
    for part in raw:
        while len(part) > 400:
            out.append(part[:400])
            part = part[400:].lstrip()
        if part:
            out.append(part)
    if len(out) > 12:
        out = out[:11] + [' '.join(out[11:])]
        out[-1] = out[-1][:400]
    return out


def effect_text(card):
    """The text minus a [Team: ...] / (Legacy) head, which the engine reads as data."""
    text = TEAM.sub('', card.get('text') or '', count=1)
    if card.get('legacy') is True:
        text = LEGACY.sub('', text, count=1)
    return text.strip()


def invalid_reason(c):
    """The shipped-data rules (data.test D04-D09); keep in step with tests/unit/data.test.mjs."""
    if c['id'] in BAD_TEXT:
        return 'Fandom-only wiki markup in the text (U19); the official text is Japanese only'
    why = []
    if not (isinstance(c.get('cost'), int) and c['cost'] >= 0): why.append('cost is not a whole number >= 0')
    if not (isinstance(c.get('symbols'), int) and c['symbols'] >= 0): why.append('symbols is not a whole number >= 0')
    for k, n in (c.get('reduction') or {}).items():
        if k not in COLORS and k not in ('god', 'ultimate'): why.append(f'reduction colour {k}')
        if not (isinstance(n, int) and n >= 1): why.append(f'reduction {k}={n}')
    if c.get('type') == 'Spirit':
        lv = c.get('levels') or []
        if not lv: why.append('levels missing')
        for k, L in enumerate(lv):
            if not (isinstance(L.get('cores'), int) and L['cores'] >= 0): why.append(f'LV{k + 1} cores not a whole number >= 0')
            if k and not (L.get('cores', -1) > lv[k - 1].get('cores', -1)): why.append(f'LV{k + 1} cores not ascending')
            if L.get('bp') is not None and not (isinstance(L.get('bp'), int) and L['bp'] >= 0): why.append(f'LV{k + 1} bp')
    if str(c['id']).startswith('BS75') and c.get('saga') != 16: why.append('BS75 outside Saga 16')
    if str(c['id']).startswith('BS76') and c.get('saga') != 17: why.append('BS76 outside Saga 17')
    if not ID_RE.match(c['id']): why.append('id outside the shipped id pattern')
    if c.get('type') == 'Nexus' and 'Grandwalker' in (c.get('families') or []) and 'Contractor' in (c.get('name') or '') and c.get('symbols') == 0:
        why.append('Contract Grandwalker has no symbol icon (symbols 0)')
    return '; '.join(why)


def main(argv):
    dry = '--dry-run' in argv
    have = {c['id'] for c in load('data/cards/saga-[0-9][0-9].json')}
    staged = [c for c in load('data/import/saga-[0-9][0-9].json') if c['id'] not in have]
    promote, skipped = [], []
    for c in staged:
        if c['id'] in KNOWN_GAPS:
            skipped.append((c['id'], c.get('name', '?'), KNOWN_GAPS[c['id']]))
            continue
        why = invalid_reason(c)
        if why:
            skipped.append((c['id'], c.get('name', '?'), why))
            continue
        n = {k: c[k] for k in FIELDS if k in c}
        if n.get('families'):
            n['families'] = [b.strip() for a in n['families'] for b in a.split(',')]
        if c.get('keyword'):
            n['mechanics'] = [c['keyword']]
        text = effect_text(c)
        n['fxComplete'] = not text          # empty or head-only text is a complete vanilla card
        n['residual'] = residual_clauses(text)
        n['note'] = 'Official card data; no printed effect text (2026-11-01 playable pass).' if not text else NOTE
        promote.append(n)
    print(f'staged {len(staged)}, promote {len(promote)}, skipped {len(skipped)}')
    for cid, name, why in skipped:
        print(f'  skip {cid} {name}: {why}')
    if dry or not promote:
        return 0
    tmp = os.path.join(ROOT, 'build', 'promote-playable-bulk.tmp.json')
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    json.dump(promote, open(tmp, 'w', encoding='utf-8', newline=''), ensure_ascii=False)
    try:
        subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'build_cards.py'), '--update', tmp])
    finally:
        os.remove(tmp)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
