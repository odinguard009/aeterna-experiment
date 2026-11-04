#!/usr/bin/env python3
"""Rebuild the stats of library cards whose official record disagrees with the library because the v0.210.0 product
import took the stats of the Rebirth BACK face (the official page lists both faces under one number; the front is the
first one). Only cost / levels / reduction / colour / brave are replaced; id, text, effects, rebirthTo and mechanics stay.
  python3 tools/master/fix_product_stats.py [--dry-run]   then: build_cards, tag_effects, unlock_report, build.mjs"""
import sys, os, json, subprocess
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DRY = '--dry-run' in sys.argv
src = open(os.path.join(ROOT, 'tools/import_master.py'), encoding='utf-8').read().split('out, skip, bad = ')[0]
sys.argv = ['import_master.py', '--dry-run']
g = {'__file__': os.path.join(ROOT, 'tools/import_master.py'), '__name__': 'im'}
exec(compile(src, 'import_master.py', 'exec'), g)
M, lib, build = g['M'], g['lib'], g['build']
out = []
for i, o in lib.items():
    r = M.get(i)
    if not r or 'official' not in r['sources'] or not r.get('type') or not (o.get('note', '').startswith('Product-only card (v0.210.0)') or o.get('rebirthTo')): continue
    if r.get('cost') is None: continue
    n = build(dict(r, canonical_number=None))
    if not n: continue
    retyped = n['type'] != o['type']                               # the old import took the back face's category too
    bp = [l.get('bp') for l in n['levels'] if l.get('bp') is not None]; lb = [l.get('bp') for l in o['levels'] if l.get('bp') is not None]
    if not retyped and o['cost'] == n['cost'] and (o['type'] not in ('Spirit', 'Ultimate') or not bp or not lb or bp[:len(lb)] == lb or lb == bp): continue   # only a real stat disagreement
    keys = ('cost', 'levels', 'reduction', 'color', 'colors', 'brave')
    if all(o.get(k) == n.get(k) for k in keys): continue
    c = json.loads(json.dumps(o))
    if retyped:                                                    # whole card from the official front; keep the Rebirth link
        c = n
        for k in ('rebirthTo', 'image'):
            if o.get(k): c[k] = o[k]
        c['mechanics'] = sorted(set(c.get('mechanics', []) + o.get('mechanics', [])))
        c['note'] = n['note'] + ' (kept Rebirth link).'
    for k in (() if retyped else keys):
        if k in n: c[k] = n[k]
        else: c.pop(k, None)
    c['note'] += ' v0.217: stats rebuilt from the official front face (the old import took the Rebirth back face).'
    out.append(c)
print('fix', len(out), [c['id'] for c in out][:60])
if not DRY and out:
    tmp = os.path.join(ROOT, 'build_fix.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp)
