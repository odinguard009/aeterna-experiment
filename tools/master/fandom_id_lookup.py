#!/usr/bin/env python3
"""English text for library cards that still carry Japanese text after fandom_jp_lookup.py: the Fandom page is found by the CARD NUMBER
(search "<id>"), accepted only when the page has a {{CardTable}} that lists that number and the card's Japanese name (NFKC, spaces
ignored) and has a non-Japanese `effect`. The card's own cost must equal the infobox cost when both exist.
  python3 tools/master/fandom_id_lookup.py [--apply]       cache: build/fandom-id-cache.json"""
import json, glob, os, re, sys, time, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import textclean
from fandom_jp_lookup_lib import api, blocks, nt
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = os.path.join(ROOT, 'build/fandom-id-cache.json')
JP = re.compile('[぀-ヿ㐀-鿿]')
def chunks(lines, n=380):
    res = []
    for l in lines:
        while len(l) > n:
            k = max(l.rfind('。', 0, n), l.rfind(' ', 0, n), n // 2)
            res.append(l[:k + 1].strip()); l = l[k + 1:].strip()
        if l: res.append(l)
    return res
cards = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
    for c in json.load(open(f, encoding='utf-8')):
        if JP.search(c.get('text') or ''): cards[c['id']] = c
cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {'search': {}, 'pages': {}}
for cid in cards:
    if cid in cache['search']: continue
    r = api({'action': 'query', 'list': 'search', 'srsearch': '"%s"' % cid, 'srlimit': 5, 'srnamespace': 0})
    cache['search'][cid] = [x['title'] for x in r['query']['search']]; time.sleep(0.3)
need = sorted({t for v in cache['search'].values() for t in v} - set(cache['pages']))
for i in range(0, len(need), 50):
    b = need[i:i + 50]
    d = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(b)})
    for p in d['query']['pages']:
        if p.get('revisions'): cache['pages'][p['title']] = p['revisions'][0]['slots']['main']['content']
    for t in b: cache['pages'].setdefault(t, ''); 
    time.sleep(1)
json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
res = {}
for cid, c in cards.items():
    for t in cache['search'][cid]:
        txt = cache['pages'].get(t, '')
        for b in blocks(txt):
            if nt(b.get('kanji') or b.get('jpname')) != nt(c['name_jp']) or not b.get('effect') or JP.search(b['effect']): continue
            m = re.search(r'\d+', b.get('cost') or '')
            if m and int(m.group()) != c['cost']: continue
            res.setdefault(cid, (t, textclean.clean_effect(b['effect'])))
print('cards', len(cards), 'resolved', len(res))
if '--apply' in sys.argv:
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
        j = json.load(open(f, encoding='utf-8')); ch = False
        for c in j:
            if c['id'] in res:
                c['text'] = res[c['id']][1]; ch = True
                if not c.get('fxComplete'): c['residual'] = chunks([' '.join(x.split()) for x in c['text'].split('\n') if x.strip()])
                c['note'] = (re.sub(r'\s*English text pending[^.]*\.( \(Japanese[^)]*\))?', '', c.get('note', '')).strip() + ' English text from the Fandom page "%s", found by card number; not compared with the official Japanese text.' % res[c['id']][0]).strip()
        if ch: json.dump(j, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
