#!/usr/bin/env python3
"""English names and texts for library cards that still carry Japanese (name or text), found on the Fandom wiki by the card's
JAPANESE name (the earlier export matched by card number, and missed pages whose infobox is written on one line or has no number).
  python3 tools/master/fandom_jp_lookup.py            -> search + fetch (cached in build/fandom-jp-cache.json), write data/master/fandom-jp.json
  python3 tools/master/fandom_jp_lookup.py --offline  -> re-parse the cache only
  python3 tools/master/fandom_jp_lookup.py --apply    -> merge data/master/fandom-jp.json into data/cards/saga-NN.json
A page matches a card only when its infobox `kanji` equals the card's Japanese name (NFKC, spaces ignored). English text is taken
only when the infobox Japanese effect is >= 90 % the same as the card's Japanese text. Read-only GET requests, polite pace."""
import json, glob, os, re, sys, time, unicodedata, difflib, urllib.parse, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textclean
from fandom_jp_lookup_lib import api, blocks, nt, fetch_pages
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = os.path.join(ROOT, 'build/fandom-jp-cache.json'); OUT = os.path.join(ROOT, 'data/master/fandom-jp.json')
API = 'https://battle-spirits.fandom.com/api.php'; UA = 'aeterna-card-data/1.0 (read-only, batched)'
JP = re.compile('[぀-ヿ㐀-鿿]')
KEYS = 'kanji|jpname|image|releasedjp|releaseden|color|cost|reduction|symbols|family|level|effect|jpeffect|flavor|jpflavor|enflavor|rarity|illust|rulings|type|extra|sets?\\d*|number\\d*|rarity\\d*'
def norm(s): return re.sub(r'[\s\[\]［］【】「」()（）:：、。・\-ー]', '', unicodedata.normalize('NFKC', s or ''))
def targets():
    t = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
        for c in json.load(open(f, encoding='utf-8')):
            if c.get('name_jp') and (JP.search(c['name']) or JP.search(c.get('text') or '')): t[c['id']] = c
    return t
def main():
    offline = '--offline' in sys.argv
    T = targets(); jn = sorted({c['name_jp'] for c in T.values()})
    cache = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {'search': {}, 'pages': {}}
    print(len(T), 'cards,', len(jn), 'Japanese names,', sum(1 for n in jn if n not in cache['search']), 'to search', flush=True)
    if not offline:
        for i, n in enumerate(jn):
            if n in cache['search']: continue
            r = api({'action': 'query', 'list': 'search', 'srsearch': n, 'srlimit': 5, 'srnamespace': 0})
            cache['search'][n] = [x['title'] for x in r.get('query', {}).get('search', [])]
            if i % 50 == 0: json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False); print(' search', i, flush=True)
            time.sleep(0.4)
        need = sorted({t for n in jn for t in cache['search'].get(n, [])} - set(cache['pages']))
        for i in range(0, len(need), 50):
            b = need[i:i + 50]
            r = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(b)})
            for p in r.get('query', {}).get('pages', []):
                if p.get('revisions'): cache['pages'][p['title']] = p['revisions'][0]['slots']['main']['content']
            for t in b: cache['pages'].setdefault(t, '')
            print(' pages', i + len(b), '/', len(need), flush=True); time.sleep(1)
        json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    res, nomatch, ambiguous = {}, [], []
    for cid, c in T.items():
        hits = []
        for title in cache['search'].get(c['name_jp'], []):
            for b in blocks(cache['pages'].get(title, '')):
                if nt(b.get('kanji') or b.get('jpname')) == nt(c['name_jp']): hits.append((title, b))
        names = {t for t, _ in hits}
        if not hits: nomatch.append(cid); continue
        if len(names) > 1: ambiguous.append(cid); continue
        title, _ = hits[0]; e = {'name': title}
        jt = c.get('text') if JP.search(c.get('text') or '') else '\n'.join(c.get('residual') or [])
        for _, b in hits:
            eff, jeff = b.get('effect'), b.get('jpeffect')
            if eff and jeff and JP.search(c.get('text') or '') and not JP.search(eff):
                r = difflib.SequenceMatcher(None, norm(jeff), norm(c['text'])).ratio()
                if r >= 0.7 and r > e.get('_r', 0): e['text'] = textclean.clean_effect(eff); e['_r'] = r
            if eff and not jeff and not (c.get('text') or '').strip(): e['text'] = textclean.clean_effect(eff)
        if e.get('_r', 1) < 0.9: e['inexact'] = True
        e.pop('_r', None)
        res[cid] = e
    json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('matched', len(res), '(names', len(res), ', texts', sum('text' in v for v in res.values()), ') no page', len(nomatch), 'ambiguous', len(ambiguous))
    if '--apply' in sys.argv: apply(res)
def chunks(lines, n=380):
    res = []
    for l in lines:
        while len(l) > n:                                          # parseCard drops a residual line over 400 characters
            k = max(l.rfind('。', 0, n), l.rfind(' ', 0, n), n // 2)
            res.append(l[:k + 1].strip()); l = l[k + 1:].strip()
        if l: res.append(l)
    return res
def apply(res):
    n = t = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
        j = json.load(open(f, encoding='utf-8')); ch = False
        for c in j:
            e = res.get(c['id'])
            if not e: continue
            cc = False
            if JP.search(c['name']): c['name'] = e['name']; n += 1; cc = True
            if e.get('text') and JP.search(c.get('text') or ''):
                c['text'] = e['text']; t += 1; cc = True
                if e.get('inexact'): c['note'] = (c.get('note', '') + ' English text from the Fandom page of the same card; its Japanese text differs slightly from the official text (reprint or erratum).').strip()
                if not c.get('fxComplete'): c['residual'] = chunks([' '.join(x.split()) for x in e['text'].split('\n') if x.strip()])
            if cc:
                ch = True
                c['note'] = re.sub(r'\s*English (name|text) pending[^.]*\.( \(Japanese[^)]*\))?', '', c.get('note', '')).strip()
        if ch: json.dump(j, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('applied names', n, 'texts', t)
main()
