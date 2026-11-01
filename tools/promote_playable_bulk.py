#!/usr/bin/env python3
"""One-off bulk playable pass (owner order 2026-11-01): promote every staged card that the game can
load as a partial playable card, with the printed text in `residual` and no effects wired yet.
A later Lane K session completes them in place; the A1 note keeps each staging record in the compile
pool (tools/compile_effects.py staged() skips A1 partial cards when it looks for `have`), so a fuller
compiler can replace them instead of duplicating them.

  python3 tools/promote_playable_bulk.py --dry-run   -> counts + skipped cards only
  python3 tools/promote_playable_bulk.py             -> data/cards update + build/all-cards.json

The 14 data gaps are the same set as tools/check_staged.mjs KNOWN_GAPS; the source export has no usable
levels (11), no Brave combine data (2) or six symbols on one Spirit (1). They stay staged.
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
KNOWN_GAPS = {
    'BS14-008': 'levels: the Fandom export has no level table',
    'BS14-X01': 'levels: the Fandom export has no level table',
    'BS16-036': 'levels: the Fandom export has no level table',
    'BS18-009': 'levels: the Fandom export has no level table',
    'BS42-006': 'levels: the Fandom export has no level table',
    'BS42-021': 'levels: the Fandom export has no level table',
    'BS42-038': 'levels: the Fandom export has no level table',
    'BS55-XX01': 'levels: the Fandom export has no level table',
    'BS77-AX01': 'levels: the Fandom export has no level table',
    'BS77-AX02': 'levels: the Fandom export has no level table',
    'BS77-AX03': 'levels: the Fandom export has no level table',
    'BS42-074': 'Brave: the export has no combine data (bp/family/name/nexus)',
    'BS44-072': 'Brave: the export has no combine data (bp/family/name/nexus)',
    'BS60-XX01': 'symbols: six colours on one Spirit (the engine allows 5)',
}
ID_RE = re.compile(r'^(BS|SD|CB|BSC|LM|PB|P|X|26R[A-Z]+)\d+-[A-Z]*\d+[A-Z]?$')
FIELDS = ('id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels',
          'families', 'text', 'image', 'block', 'saga', 'rcode', 'collab', 'bicon')
NOTE = ('Partial card (v0.79.0 bulk playable pass 2026-11-01): printed text only, effects not wired; '
        'staging record kept in data/import for a later compiler pass.')
TEAM = re.compile(r'(?m)^[ \t]*\[Teams?:[^\]\n]+\][ \t]*(?:\n|$)')
LEGACY = re.compile(r'(?m)^[ \t]*\(Legacy\)[ \t]*(?:\n|$)')


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


COLORS = {'red', 'purple', 'green', 'white', 'yellow', 'blue'}
# Source rows whose printed text has an unbalanced level bracket ("[LV1][LV2[LV3]"); tests/unit/ui_button_labels U19
# cannot format them. They stay staged until the text is repaired.
BAD_TEXT = {'BS06-028', 'BS18-014', 'BS18-042', 'BS20-048', 'BS36-X03', 'BS43-012', 'BS58-015', 'BS59-057'}
FANDOM_SRC = os.path.join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json')
FANDOM_KNOWN = {'BS75-001', 'BS75-063', 'BS75-075', 'BS75-076', 'BS75-079', 'BS75-082', 'BS76-079'}
_fandom = None


def fandom_rows():
    global _fandom
    if _fandom is None:
        if not os.path.exists(FANDOM_SRC):
            _fandom = {}
        else:
            data = json.load(open(FANDOM_SRC, encoding='utf-8'))
            rows = data.get('cards') if isinstance(data, dict) else data
            _fandom = {r['id']: r for r in rows}
    return _fandom


def source_mismatch(c):
    """The BS74-BS76 data check (tests/unit/fandom_bs74_bs76_data.test.mjs) against the Fandom export."""
    rows = fandom_rows()
    r = rows.get(c['id'])
    if not r or c['id'] in FANDOM_KNOWN or not re.match(r'^BS7[456]-', c['id']):
        return ''
    if c.get('cost') != r.get('cost'):
        return f"cost differs from the Fandom export ({c.get('cost')} vs {r.get('cost')})"
    if (c.get('reduction') or {}).get('god', 0) != (r.get('reduction') or {}).get('god', 0):
        return 'god reduction differs from the Fandom export'
    if c.get('type') == 'Spirit' and [l.get('cores') for l in c.get('levels') or []] != [l.get('cores') for l in r.get('levels') or []]:
        return 'level cores differ from the Fandom export'
    return ''


def invalid_reason(c):
    """The shipped-data rules (data.test D04-D09 and the data checks above); keep in step with tests/unit."""
    if c['id'] in BAD_TEXT:
        return 'malformed level bracket in the source text (U19)'
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
        why.append('Contract Grandwalker has no symbol icon (symbols 0, R19)')
    if re.match(r'^BS7[456]-', c['id']) and (c.get('reduction') or {}).get('blue') and c.get('color') != 'blue':
        why.append('blue reduction on a non-blue card (BS74 check)')
    if (c.get('reduction') or {}).get('god', 0) > (c.get('cost') or 0):
        why.append('god reduction exceeds the cost (BS74 check)')
    src = source_mismatch(c)
    if src: why.append(src)
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
        n['note'] = NOTE
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
