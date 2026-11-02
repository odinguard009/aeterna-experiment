#!/usr/bin/env python3
"""Adds cards that exist only in starter-deck / premium-box / promo products (missing from the saga files) as partial
library cards (`fxComplete: false`, `residual`), from the official-site detail data in data/sources/official-extra.json.
  python3 tools/import_products.py      -> data/cards/saga-60.json (idempotent)
Reprints of a card already in the library are clones of it (new id, same stats and effects). New cards carry the
Japanese name until an English name is added to `names` in the source file. Symbols are not on the official page: 1 for
Spirits/Ultimates, 0 otherwise (note says so)."""
import json, glob, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = json.load(open(os.path.join(ROOT, 'data/sources/official-extra.json'), encoding='utf-8'))
base = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
    if f.endswith('saga-60.json'):
        continue
    j = json.load(open(f, encoding='utf-8'))
    for c in (j if isinstance(j, list) else j['cards']):
        base[c['id']] = c
by_jp = {}
for c in base.values():
    by_jp.setdefault(c.get('name_jp'), c)
NOTE = 'Product-only card (v0.210.0): stats and Japanese text from the official card database; effects not wired yet, symbols unverified; English text/name pending.'
def chunks(lines, n=380):
    res = []
    for l in lines:
        while len(l) > n:                                          # parseCard drops a residual line over 400 characters
            k = max(l.rfind('。', 0, n), l.rfind(' ', 0, n), n // 2)
            res.append(l[:k + 1].strip()); l = l[k + 1:].strip()
        if l:
            res.append(l)
    return res
out = []
for cid, r in sorted(SRC['cards'].items()):
    if cid in base:
        continue
    twin = by_jp.get(r['nameJp']) if r.get('nameJp') else None
    if twin and twin['type'] == r['type']:
        c = json.loads(json.dumps(twin)); c['id'] = cid; c['saga'] = 60; c['block'] = 'P'
        c['image'] = cid + '.png'; c['note'] = 'Reprint of %s (same name and stats), added v0.210.0 from the official product list.' % twin['id']
        out.append(c); continue
    if r['type'] not in ('Spirit', 'Ultimate', 'Brave', 'Nexus', 'Magic'):
        continue                                                  # no category on the page (contract/symbol cards): not importable yet
    cols = r['colors']
    if r['type'] in ('Spirit', 'Ultimate', 'Brave'):
        levels = [{'cores': cr, 'bp': bp} for bp, cr in r['levels'] if bp is not None]      # parseCard needs a numeric bp on every level
    else:
        levels = [{'cores': cr} for _, cr in r['levels']]
    text = '\n'.join(r['textJp'])
    c = {'id': cid, 'name': SRC.get('names', {}).get(cid) or r['nameJp'], 'name_jp': r['nameJp'], 'type': r['type'],
         'color': cols[0] if cols else 'white', 'cost': r['cost'] or 0, 'reduction': r.get('reductionBy') or {},
         'symbols': 1 if r['type'] in ('Spirit', 'Ultimate') else 0, 'levels': levels,
         'families': [x for x in re.split(r'[・/]', r.get('familiesJp') or '') if x], 'text': text,
         'image': cid + '.png', 'block': 'P', 'saga': 60, 'fxComplete': False, 'residual': chunks(r['textJp']) or ['(no ability)'],
         'note': NOTE, 'rcode': r.get('rarity') or 'C'}
    if r['type'] == 'Brave' and r.get('braveBp'):
        c['brave'] = {'bp': r['braveBp'], 'costGe': 3}
    out.append(c)
for d in ('data/cards',):                                          # no staging copy: the staging tests expect the Fandom intake format
    json.dump(out, open(os.path.join(ROOT, d, 'saga-60.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'cards')
