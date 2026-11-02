#!/usr/bin/env python3
"""English names, families and effect text for the product-only cards of data/cards/saga-60.json (v0.209.2).

Reads the Fandom wiki (battle-spirits.fandom.com) through the MediaWiki API, read-only, 50 titles per call:
  1. the set page of every prefix (SD70, PB42 ...) gives card id -> English card name (table rows `|ID` / `|[[Name]]`),
  2. the card page gives `kanji`, `family`..`family6`, `effect` (English) and `jpname`.
Writes data/sources/fandom-saga60-en.json = { id: { name, kanji, families, effect } } (raw wikitext effect, cleaned at merge time).
  python3 tools/fetch_saga60_en.py [--offline]     (cache: build/saga60-en-cache.json)"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data/sources/fandom-saga60-en.json')
CACHE = os.path.join(ROOT, 'build/saga60-en-cache.json')
API = 'https://battle-spirits.fandom.com/api.php'
UA = 'aeterna-card-data/1.0 (read-only, batched)'
JP = re.compile(r'[぀-ヿ㐀-鿿]')


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 3: raise
            time.sleep(2 + attempt * 3)


def pages(titles, cache):
    """titles -> fills cache[title] = wikitext or None (missing); follows redirects"""
    todo = [t for t in titles if t not in cache]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        q = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(batch)}).get('query', {})
        back = {}
        for k in ('normalized', 'redirects'):
            for x in q.get(k, []): back[x['to']] = x['from']
        got = {}
        for p in q.get('pages', []):
            txt = None if p.get('missing') else p['revisions'][0]['slots']['main']['content']
            got[p['title']] = txt
        for t in batch:
            cache[t] = None
        for title, txt in got.items():
            orig = title
            while orig in back: orig = back[orig]
            cache[orig] = txt
            if orig != title and title in batch: cache[title] = txt
        time.sleep(1)
        print(f'  fetched {min(i + 50, len(todo))}/{len(todo)}', flush=True)


def link_text(s):
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\((?:w/ Secret|Revival|Reprint)[^)]*\)', '', s, flags=re.I)
    return s.strip()


def set_rows(text):
    """-> {id: english name} from the wikitext tables of a set page"""
    out = {}
    for m in re.finditer(r'^\|\s*([A-Z0-9]{2,5}-[A-Z]{0,3}\d{1,3}[A-Za-z]?)\s*\n\|\s*(\[\[[^\n]*?\]\][^\n]*)', text, re.M):
        raw = m.group(2)
        link = re.match(r'\[\[([^\]|]+)(?:\|[^\]]*)?\]\]', raw)
        if link: out.setdefault(m.group(1), link.group(1).strip())
    return out


def param(text, name):
    m = re.search(r'\|\s*' + name + r'\s*=\s*(.*?)(?=\n\s*\|\s*[a-z0-9]+\s*=|\n\}\})', text, re.S)
    return m.group(1).strip() if m else ''


def main():
    cache = json.load(open(CACHE, encoding='utf8')) if os.path.exists(CACHE) else {}
    cards = [c for c in json.load(open(os.path.join(ROOT, 'data/cards/saga-60.json'), encoding='utf8')) if JP.search(json.dumps(c, ensure_ascii=False))]
    ids = [c['id'] for c in cards]
    prefixes = sorted({i.split('-')[0] for i in ids})
    print(len(ids), 'cards,', len(prefixes), 'set pages', flush=True)
    if '--offline' not in sys.argv:
        pages(prefixes, cache)
    names = {}
    for p in prefixes:
        if cache.get(p): names.update(set_rows(cache[p]))
    want = sorted({names[i] for i in ids if i in names})
    if '--offline' not in sys.argv:
        pages(want, cache)
        json.dump(cache, open(CACHE, 'w', encoding='utf8'))
    out = {}
    for i in ids:
        n = names.get(i)
        t = cache.get(n) if n else None
        if not t: continue
        fam = [param(t, 'family' + (str(k) if k > 1 else '')) for k in range(1, 7)]
        out[i] = {'name': n, 'kanji': param(t, 'kanji'), 'families': [link_text(f) for f in fam if f],
                  'effect': param(t, 'effect')}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0, sort_keys=True)
    print(f'{len(names)} ids named, {len(out)}/{len(ids)} cards with a Fandom page ->', OUT)


if __name__ == '__main__':
    main()
