#!/usr/bin/env python3
"""Import the Rebirth back faces (Fandom Category:Rebirth Side B) into data/index/rebirth-sides.json.

The back faces are NOT cards of the library: they never enter data/cards, the counts, the Library, the Deck Builder or a
deck. The game embeds this file and shows a face only through the "Side B" button of the front card's detail
(`rebirthTo` on the front names the back id, `<front-id>B`). Effects stay printed text (`residual`), like the fronts.

  python3 tools/import_rebirth_sides.py --dry-run   report only
  python3 tools/import_rebirth_sides.py             write data/index/rebirth-sides.json
"""
import glob
import json
import os
import re
import sys

import import_rebirth as R

ROOT = R.ROOT
OUT = os.path.join(ROOT, 'data/index/rebirth-sides.json')
NOTE = 'Rebirth back face (display only): the flip rule is not in the engine yet.'


def members():
    titles, cont = [], None
    while True:
        p = {'action': 'query', 'list': 'categorymembers', 'cmtitle': 'Category:Rebirth Side B', 'cmlimit': '500'}
        if cont:
            p['cmcontinue'] = cont
        d = R.api(**p)
        titles += [x['title'] for x in d['query']['categorymembers']]
        cont = d.get('continue', {}).get('cmcontinue')
        if not cont:
            return titles


def main():
    dry = '--dry-run' in sys.argv[1:]
    fronts = {}
    for f in glob.glob(os.path.join(ROOT, 'data/cards/saga-*.json')):
        for c in json.load(open(f, encoding='utf-8')):
            if c.get('rebirthTo'):
                fronts[c['rebirthTo']] = c
    titles = members()
    pm = R.pages(titles)
    out, skipped, taken = {}, [], set()
    for title in titles:
        w = pm.get(title, '')
        f = R.card_fields(w) if w else {}
        image = f.get('image', '')
        fid = R.image_id(re.sub(r'^([A-Z0-9]+)\s+(\d)', r'-', image))      # "SD56 003(B).png" prints a space for the hyphen
        if not fid:                  # no card number in the file name: the {{Reborn|type|front name}} head names the front, used when that name is unique
            m = re.search(r'\{\{Reborn\|[^|}]*\|([^}|]+)', w)
            same = [c for c in fronts.values() if m and c['name'] == m.group(1).strip() and c['id'] not in taken]
            fid = same[0]['id'] if len(same) == 1 else None
        if not fid:
            skipped.append((title, 'no card id in image ' + repr(image)))
            continue
        sid = fid + 'B'
        front = fronts.get(sid)
        if front:
            taken.add(front['id'])
        if not front:
            skipped.append((title, f'no front card {fid} with rebirthTo {sid}'))
            continue
        typ = f.get('type', '').strip()
        typ = 'Nexus' if 'Nexus' in typ else 'Magic' if 'Magic' in typ else 'Brave' if 'Brave' in typ else 'Ultimate' if 'Ultimate' in typ else 'Spirit'
        color = f.get('color', '').strip().lower() or front.get('color')
        levels = R.parse_levels(typ, f.get('level'))
        if typ == 'Spirit' and not levels:
            skipped.append((sid, 'no levels'))
            continue
        for L in levels:
            L['cores'] = max(1, L['cores'])
        text = R.clean_text(f.get('effect', ''))
        fam = [f.get(k, '').strip() for k in ('family', 'family2', 'family3') if f.get(k, '').strip()]
        out[front['id']] = {
            'id': sid, 'name': R.page_id(title), 'name_jp': f.get('kanji') or f.get('jpname') or None,
            'type': typ, 'color': color, 'cost': R.parse_cost(f.get('cost')) or front.get('cost'),
            'symbols': R.parse_symbols(f.get('symbols')) or 1, 'levels': levels, 'families': fam,
            'text': text, 'image': image or None, 'rebirthSide': True, 'fxComplete': False,
            'residual': R.residual(text), 'note': NOTE,
        }
    miss = [c['id'] for c in fronts.values() if c['id'] not in out]
    print(f'back pages {len(titles)}, backs {len(out)}, fronts without a back {len(miss)}, skipped pages {len(skipped)}')
    for s in skipped[:30]:
        print('  skip', *s)
    print('  front without back:', miss[:40])
    if dry:
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    body = json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=1)
    open(OUT, 'w', encoding='utf-8', newline='').write(body + '\n')
    print('wrote', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
