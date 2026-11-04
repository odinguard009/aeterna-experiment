#!/usr/bin/env python3
"""Rebirth: every library front card that has a back face on the official site must carry `rebirthTo` (<id>B) and have
its back face in data/index/rebirth-sides.json.
  python3 tools/master/rebirth_link.py link    -> sets rebirthTo + mechanic Rebirth on fronts that miss it (via build_cards --update)
  python3 tools/master/rebirth_link.py fill    -> after tools/import_rebirth_sides.py: adds the backs Fandom has no page for,
                                                 from the official (Japanese) back data; English text pending, noted
  python3 tools/master/rebirth_link.py check   -> prints the coverage (exit 1 when a front has no back or a back no front)"""
import json, gzip, glob, os, re, sys, subprocess
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
lib = {c['id']: c for f in sorted(glob.glob(os.path.join(R, 'data/cards/saga-[0-9][0-9].json'))) for c in json.load(open(f, encoding='utf-8'))}
SIDES = os.path.join(R, 'data/index/rebirth-sides.json')
def official_backs():
    out = {}
    for f in ('official-off_detail', 'official-off_detail2', 'official-off_detail3'):
        for l in gzip.open(os.path.join(R, 'data/master/cache', f + '.jsonl.gz'), 'rt'):
            for c in json.loads(l)['cards']:
                if re.search(r'_b\.', c.get('img', '')): out[c['no'].replace(' ', '').upper()] = c
    return out
backs = official_backs()
cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
if cmd == 'link':
    out = []
    for i in backs:
        c = lib.get(i)
        if c and not c.get('rebirthTo'):
            c = json.loads(json.dumps(c)); c['rebirthTo'] = i + 'B'
            m = c.setdefault('mechanics', []);
            if 'Rebirth' not in m: m.append('Rebirth')
            out.append(c)
    tmp = os.path.join(R, 'build_rebirth.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(R, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp); print('linked', len(out))
S = json.load(open(SIDES, encoding='utf-8'))
JT = {'スピリット': 'Spirit', 'アルティメット': 'Ultimate', 'ブレイヴ': 'Brave', 'ネクサス': 'Nexus', 'マジック': 'Magic'}
JC = {'赤': 'red', '黄': 'yellow', '紫': 'purple', '白': 'white', '青': 'blue', '緑': 'green'}
if cmd == 'fill':
    added = 0
    for i, c in sorted(lib.items()):
        if not c.get('rebirthTo') or i in S or i not in backs: continue
        b = backs[i]; f = b['f']
        typ = next((v for k, v in JT.items() if k in f.get('カテゴリー', '')), c['type'])
        levels = [{'cores': max(1, int(co or 1)), 'bp': int(bp)} for bp, co in f.get('BP/コア', []) if str(bp).isdigit()]
        if typ in ('Spirit', 'Ultimate', 'Brave') and not levels: continue
        text = (f.get('能力・効果') or '').strip(); text = '' if text == '-' else text
        S[i] = {'id': i + 'B', 'name': b['name'], 'name_jp': b['name'], 'type': typ, 'color': JC.get(f.get('属性', ''), c['color']),
                'cost': int(f.get('コスト') or c['cost'] or 0), 'symbols': c.get('symbols', 1), 'levels': levels or c['levels'],
                'families': c.get('families', []), 'text': text, 'image': i + ' b.png', 'rebirthSide': True, 'fxComplete': not text,
                'residual': [x for x in text.split('\n') if x.strip()],
                'note': 'Rebirth back face (display only) from the official card database; English name and text pending (Japanese kept); families copied from the front.'}
        added += 1
    open(SIDES, 'w', encoding='utf-8', newline='').write(json.dumps(dict(sorted(S.items())), ensure_ascii=False, indent=1) + '\n'); print('added', added)
fronts = {i for i, c in lib.items() if c.get('rebirthTo')}
nb = sorted(i for i in fronts if i not in S and lib[i]['rebirthTo'][:-1] not in S)
nf = sorted(i for i in S if i not in fronts)
of = sorted(i for i in backs if i in lib and i not in fronts)
print('fronts', len(fronts), 'sides', len(S), '| fronts without back:', nb, '| backs without front:', nf, '| official-back cards not linked:', of)
sys.exit(1 if nb or nf or of else 0)
