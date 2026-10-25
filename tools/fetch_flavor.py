#!/usr/bin/env python3
"""English flavor text per card (v0.131.0, U14g Lore tab): reads the card pages of the Fandom wiki (battle-spirits.fandom.com)
through its MediaWiki API and writes data/index/flavor.json = { card id: "flavor text" }.

  python3 tools/fetch_flavor.py            -> fetch the pages (cached in build/flavor-cache.json), write the index
  python3 tools/fetch_flavor.py --offline  -> re-parse the cache only, no network

Read-only GET requests, one at a time, 50 titles per call, redirects followed (polite use of the wiki API).
A page lists one `setN` / `enflavorN` pair per printing: the pair whose set equals the set prefix of our card id is used,
else the first printing with a flavor text. Flavor text is card text, so it stays data (data/index), never code.
Cleanup: wiki links and templates reduced to their text, quote marks of bold / italic removed, <br> -> a space."""
import json, os, re, sys, time, urllib.parse, urllib.request, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data/index/flavor.json')
CACHE = os.path.join(ROOT, 'build/flavor-cache.json')
API = 'https://battle-spirits.fandom.com/api.php'
UA = 'aeterna-card-data/1.0 (read-only, batched)'


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2 + attempt * 3)


def clean(t):
    t = re.sub(r'<br\s*/?>', ' ', t)
    t = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', t)
    t = re.sub(r'\{\{[^{}|]*\|([^{}|]*)[^{}]*\}\}', r'\1', t)
    t = t.replace("'''", '').replace("''", '')
    return re.sub(r'\s+', ' ', t).strip()


def flavors(wikitext):
    """-> [(set, text)] in printing order"""
    sets = {m.group(1) or '1': m.group(2).strip().upper() for m in re.finditer(r'\|\s*set(\d*)\s*=\s*([^\n|]*)', wikitext)}
    out = []
    for m in re.finditer(r'\|\s*enflavor(\d*)\s*=\s*(.*?)(?=\n\s*\||\n\}\})', wikitext, re.S):
        n = m.group(1) or '1'; t = clean(m.group(2))
        if t:
            out.append((sets.get(n, ''), t))
    return out


def our_cards():
    cards = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/*.json'))):
        d = json.load(open(f, encoding='utf8'))
        cards += d if isinstance(d, list) else d.get('cards', [])
    return [(c['id'], c['name']) for c in cards if not c.get('token')]


def main():
    offline = '--offline' in sys.argv
    cards = our_cards()
    names = sorted({n for _, n in cards})
    cache = json.load(open(CACHE, encoding='utf8')) if os.path.exists(CACHE) else {}
    todo = [n for n in names if n not in cache]
    if offline:
        todo = []
    print(f'{len(cards)} cards, {len(names)} names, {len(todo)} to fetch', flush=True)
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        r = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(batch)})
        q = r.get('query', {})
        back = {}
        for k in ('normalized', 'redirects'):
            for x in q.get(k, []):
                back[x['to']] = x['from']
        found = {}
        for p in q.get('pages', []):
            revs = p.get('revisions')
            if not revs:
                continue
            title = p['title']; src = back.get(title, title); src = back.get(src, src)
            found[src] = found[title] = revs[0]['slots']['main']['content']
        for n in batch:
            cache[n] = found.get(n, '')
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(cache, open(CACHE, 'w', encoding='utf8'), ensure_ascii=False)
        print(f'  {min(i + 50, len(todo))}/{len(todo)}', flush=True)
        time.sleep(1)
    index = {}
    for cid, name in cards:
        fl = flavors(cache.get(name, ''))
        if not fl:
            continue
        pre = cid.split('-')[0].upper()
        pick = next((t for s, t in fl if s == pre), None) or fl[0][1]
        index[cid] = pick
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8', newline='\n') as f:
        json.dump(dict(sorted(index.items())), f, ensure_ascii=False, indent=0, separators=(',', ':'))
    print(f'{len(index)} of {len(cards)} cards have an English flavor text -> data/index/flavor.json')


if __name__ == '__main__':
    main()
