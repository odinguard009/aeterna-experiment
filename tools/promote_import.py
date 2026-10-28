#!/usr/bin/env python3
"""Promote staged cards (data/import/saga-NN.json, v0.36) into the game data (data/cards/saga-NN.json).
  python3 tools/promote_import.py BS71-053 BS71-054 ...     (or --list FILE with one id per line)
Never overwrites a card that already exists in data/cards (hand-verified data wins); reports it instead.
Stats come from the owner's Fandom export (owner decision 2026-10-14); each promoted card says so in "note".
Afterwards run: python3 tools/build_cards.py && python3 tools/tag_effects.py && node tools/build.mjs"""
import json, glob, os, sys, subprocess
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ids = []
a = sys.argv[1:]
while a:
    x = a.pop(0)
    if x == '--list':                                   # deck file lines: "<count> <id>   # name" (a bare id works too)
        for l in open(a.pop(0), encoding='utf-8'):
            t = l.split('#')[0].split()
            if t: ids.append(t[-1])
    else: ids.append(x)
staged = {}
for f in sorted(glob.glob(os.path.join(root, 'data/import/saga-[0-9][0-9].json'))):
    for c in json.load(open(f, encoding='utf-8')): staged[c['id']] = c
have = {c['id'] for f in glob.glob(os.path.join(root, 'data/cards/saga-[0-9][0-9].json')) for c in json.load(open(f, encoding='utf-8'))}
out, skipped, missing = [], [], []
for i in ids:
    if i in have: skipped.append(i); continue
    c = staged.get(i)
    if not c: missing.append(i); continue
    n = {k: c[k] for k in ('id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels', 'families', 'text', 'image', 'block', 'saga') if k in c}
    if n.get('families'): n['families'] = [b.strip() for a in n['families'] for b in a.split(',')]   # v0.181: "A, B" is two families
    if c.get('keyword'): n['mechanics'] = [c['keyword']]
    n['fxComplete'] = False
    n['note'] = 'Stats and text from the owner-supplied Fandom export (owner decision 2026-10-14); not yet checked against the card image.'
    out.append(n)
if missing: sys.exit('not in data/import: ' + ', '.join(missing))
if out:
    tmp = os.path.join(root, 'build_promote.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(root, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp)
print(f'promoted {len(out)}, already present {len(skipped)}' + (': ' + ', '.join(skipped) if skipped else ''))
