#!/usr/bin/env python3
"""R6: how many staged cards hold exactly one head blocker, and how many compile once that head is swapped (upper bound of any head parser). Run from the repo root."""
import sys,json,re,collections
sys.path.insert(0,'tools')
import pack_measure as pm
off=json.load(open('data/sources/official-fields.json'))
pool,revids,B=pm.blocker_sets()
head=[k for k in set().union(*B.values()) if k.startswith('no trigger:') or k.startswith('wiki template')]
single={cid:next(iter(b)) for cid,b in B.items() if len(b)==1}
hs={cid:k for cid,k in single.items() if k in head}
print('staged review cards',len(revids),'| single blocker',len(single),'| single head blocker',len(hs))
tot=ok=0; with_jp=sum(1 for c in hs if off.get(c,{}).get('textJp'))
print('of those with textJp',with_jp)
rows=[]
for k in sorted(set(hs.values()),key=lambda k:-list(hs.values()).count(k)):
    r=pm.measure(pool,revids,B,k)
    if r: tot+=r[0]; ok+=r[1]; rows.append((k,r[0],r[1]))
print('measured heads',len(rows),'cards',tot,'compile after head swap',ok)
for r in rows[:12]: print(r)
