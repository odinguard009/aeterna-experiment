#!/usr/bin/env python3
"""Fix card numbers from the official card database (data/sources/official-fields.json).

The official page wins for cost, reduction (six colours + god/ultimate icons), level rows and Brave
BP/combine; it also repairs the five malformed level brackets in the English text. The English text
itself still comes from the Fandom export (the official site is Japanese only); effect semantics stay
with Lane K.

  python3 tools/apply_official_fix.py            dry run: counts per field
  python3 tools/apply_official_fix.py --apply    write data/cards and data/import
  python3 tools/apply_official_fix.py --list 20  dry run: show the first 20 changes
"""
import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OFFICIAL = os.path.join(ROOT, 'data/sources/official-fields.json')
COLORS = ('red', 'purple', 'green', 'white', 'yellow', 'blue')
SPECIAL = {'神': 'god', '極': 'ultimate'}
TEXT_FIX = {'BS18-014', 'BS18-042', 'BS20-048', 'BS36-X03', 'BS43-012'}   # missing ']' after [LVn


def dump(cards, style):
    if style == 'indent':
        return json.dumps(cards, ensure_ascii=False, indent=1)
    return '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in cards) + '\n]'


def clean_levels(levels):
    """Drop a trailing empty table row (the official page prints one for a level the card does not use)."""
    levels = [tuple(p) if isinstance(p, list) else p for p in (levels or [])]
    while levels and (not isinstance(levels[-1], tuple) or any(x is None for x in levels[-1])):
        levels = levels[:-1]
    return levels


def sound(levels):
    """Official rows whose table was parsed cleanly: every value present and not falling."""
    if not levels:
        return False
    for pair in levels:
        if not (isinstance(pair, tuple) and len(pair) == 2 and all(isinstance(x, int) for x in pair)):
            return False
    return all(b[0] <= c[0] and b[1] <= c[1] for b, c in zip(levels, levels[1:]))


def official_reduction(o):
    red = {k: v for k, v in (o.get('reductionBy') or {}).items() if k in COLORS}
    icons = o.get('reductionIcons') or []
    for label, key in SPECIAL.items():
        n = icons.count(label)
        if n:
            red[key] = n
    return red


def fix_text(text):
    return re.sub(r'\[LV(\d+)(?!\])', r'[LV\1]', text)


def changes(c, o):
    out = []
    if o.get('cost') is not None and c.get('cost') != o['cost']:
        out.append(('cost', o['cost']))
    red = official_reduction(o)
    if red != (c.get('reduction') or {}):
        out.append(('reduction', red))
    levels = clean_levels(o.get('levels'))
    if c.get('type') in ('Spirit', 'Brave', 'Ultimate') and sound(levels):
        new_levels = [{'cores': cores, 'bp': bp} for bp, cores in levels]
        if new_levels != (c.get('levels') or []):
            out.append(('levels', new_levels))
    # Keep the on-disk key order cores,bp: tools/pack_size.mjs compares the pack round trip as text.
    current_levels = c.get('levels') or []
    if current_levels and not any(k == 'levels' for k, _ in out) and all(isinstance(L, dict) for L in current_levels):
        ordered = [{k: L[k] for k in ('cores', 'bp') if k in L} for L in current_levels]
        if [list(L) for L in current_levels] != [list(L) for L in ordered]:
            out.append(('levels', ordered))
    if c.get('type') == 'Brave':
        brave = dict(c.get('brave') or {})
        if o.get('braveBp') is not None:
            brave['bp'] = o['braveBp']
        brave.update(o.get('combine') or {})
        if brave and brave != (c.get('brave') or {}):
            out.append(('brave', brave))
    # The official fields do not expose the symbol count. Two families are inferred from the printed card
    # (and from the nine Contract Grandwalkers already in the library, all symbols 1): a Contract Grandwalker
    # Nexus has one symbol, and BS60-XX01's Fandom "six symbols" is one symbol per colour misread (the engine
    # allows five). Recorded in docs/audits/bulk-playable-2026-11-01.md.
    if c['id'] == 'BS60-XX01' and c.get('symbols') != 1:
        out.append(('symbols', 1))
    if c.get('type') == 'Nexus' and 'Grandwalker' in (c.get('families') or []) and 'Contractor' in (c.get('name') or '') and c.get('symbols') != 1:
        out.append(('symbols', 1))
    if c['id'] in TEXT_FIX and isinstance(c.get('text'), str):
        fixed = fix_text(c['text'])
        if fixed != c['text']:
            out.append(('text', fixed))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--list', type=int, default=0)
    ap.add_argument('--fields-file', default=OFFICIAL)
    a = ap.parse_args()
    off = json.load(open(a.fields_file, encoding='utf-8'))
    total = {}
    shown = 0
    for d in ('data/cards', 'data/import'):
        for path in sorted(glob.glob(os.path.join(ROOT, d, 'saga-[0-9][0-9].json'))):
            raw = open(path, encoding='utf-8').read()
            cards = json.loads(raw)
            style = 'indent' if dump(cards, 'indent') == raw.rstrip('\n') else 'line'
            if dump(cards, style) != raw.rstrip('\n'):
                sys.exit(path + ': layout not reproducible')
            dirty = False
            for c in cards:
                o = off.get(c['id'])
                if not o:
                    continue
                ch = changes(c, o)
                for key, value in ch:
                    total[key] = total.get(key, 0) + 1
                    if a.list and shown < a.list:
                        shown += 1
                        print(c['id'], key, repr(c.get(key))[:90], '->', repr(value)[:90])
                    if a.apply:
                        c[key] = value
                        dirty = True
            if dirty and a.apply:
                open(path, 'w', encoding='utf-8', newline='').write(dump(cards, style) + ('\n' if raw.endswith('\n') else ''))
    for key, n in sorted(total.items()):
        print('%-10s %5d cards %s' % (key, n, 'changed' if a.apply else 'would change'))


if __name__ == '__main__':
    main()
