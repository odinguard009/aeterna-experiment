#!/usr/bin/env python3
"""Normalise rarity codes (`rcode`) in data/cards/saga-NN.json to one English vocabulary.
  python3 tools/master/normalize_rcode.py [--dry-run]
Imported cards carried Fandom/official long labels ('Rebirth Rare', '転醒X', '契約X', ...); the deck builder filter
lists every distinct value, so they split one rarity into several entries."""
import json, glob, os, sys, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MAP = {'Common': 'C', 'Rare': 'R', 'X-Rare': 'X', 'Master Rare': 'M', 'Campaign Promo': 'CP', 'Campaign Rare': 'CP',
       'Rebirth Rare': 'Awaken R', 'Rebirth X-Rare': 'Awaken X', 'Rebirth Campaign Promo': 'Awaken CP', 'Rebirth Campaign Rare': 'Awaken CP',
       '転醒R': 'Awaken R', '転醒X': 'Awaken X', '契約X': 'Contract X', '-': None, '－': None}
n, cnt = 0, collections.Counter()
for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
    j = json.load(open(f, encoding='utf-8')); ch = False
    for c in j:
        r = c.get('rcode')
        if r in MAP:
            if MAP[r] is None: del c['rcode']
            else: c['rcode'] = MAP[r]
            ch = True; n += 1
    if ch and '--dry-run' not in sys.argv:
        json.dump(j, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for f in glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json')):
    for c in json.load(open(f, encoding='utf-8')): cnt[c.get('rcode')] += 1
print('changed', n); print(dict(cnt.most_common()))
