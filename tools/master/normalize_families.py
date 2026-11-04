#!/usr/bin/env python3
"""Replace Japanese family names left in library cards by their English name (data/glossary/family-names-jp-en.json, built from
the master database: the English name that the Fandom wiki uses for the same Japanese family, at least 80 % of the cards),
strip junk families ('-'), and unify spelling variants. Prints the Japanese families that still have no English name.
  python3 tools/master/normalize_families.py [--dry-run]     then: build_cards, tag_effects, unlock_report, build.mjs"""
import json, glob, os, re, sys, subprocess, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DRY = '--dry-run' in sys.argv
MP = json.load(open(os.path.join(ROOT, 'data/glossary/family-names-jp-en.json'), encoding='utf-8'))
JP = re.compile(r'[぀-ヿ一-鿿]')
SPELL = {'God King': 'God-King'}
JUNK = {'-', '－', ''}
out, left = [], collections.Counter()
for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
    for c in json.load(open(f, encoding='utf-8')):
        new = []
        for x in c.get('families') or []:
            for p in ([x] if x.strip() in MP else x.split()) if JP.search(x) else [x]:
                p = p.strip()
                if p in JUNK: continue
                p = MP.get(p, p); p = SPELL.get(p, p)
                if JP.search(p): left[p] += 1
                if p not in new: new.append(p)
        if new != c.get('families'): c['families'] = new; out.append(c)
print('cards changed', len(out), '| Japanese families left', dict(left))
if not DRY and out:
    tmp = os.path.join(ROOT, 'build_fam.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp)
