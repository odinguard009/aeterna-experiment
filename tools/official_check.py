#!/usr/bin/env python3
"""Compare card data (data/cards + data/import) with the official card database pages (read-only).
  python3 tools/official_check.py --sample 200 [--seed 1] [--cache DIR] [--delay 0.7]
  python3 tools/official_check.py --ids BS38-RV023 BS10-062
  python3 tools/official_check.py --all            (long: about 1 request per --delay seconds; resumable through the cache)
Page: https://www.battlespirits.com/cardlist/detail_iframe.php?card_no=<ID>&card_no2=<ID>
Raw pages are cached under --cache (default: the OS temp dir) and never committed; only the field differences are printed.
Stops at the first HTTP 403/429 (no workaround). Compared: type, colours, cost, reduction size, level BP/cores, Brave BP and combine cost."""
import argparse, glob, json, os, random, re, sys, tempfile, time, urllib.request, urllib.error
from html import unescape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
URL = 'https://www.battlespirits.com/cardlist/detail_iframe.php?card_no={0}&card_no2={0}'
TYPES = {'スピリット': 'Spirit', 'ブレイヴ': 'Brave', 'ネクサス': 'Nexus', 'マジック': 'Magic', 'アルティメット': 'Ultimate'}
COLORS = {'赤': 'red', '紫': 'purple', '緑': 'green', '白': 'white', '黄': 'yellow', '青': 'blue'}


def load_cards():
    cards = {}
    for d in ('data/import', 'data/cards'):                      # data/cards wins over staging
        for f in sorted(glob.glob(os.path.join(ROOT, d, 'saga-[0-9][0-9].json'))):
            j = json.load(open(f, encoding='utf-8'))
            for c in (j if isinstance(j, list) else j.get('cards', [])):
                cards[c['id']] = c
    return cards


def fetch(cid, cache, delay):
    p = os.path.join(cache, cid + '.html')
    if os.path.exists(p):
        return open(p, encoding='utf-8').read()
    time.sleep(delay)
    try:
        s = urllib.request.urlopen(urllib.request.Request(URL.format(cid), headers={'User-Agent': 'aeterna-card-check (read-only, non-commercial)'}), timeout=30).read().decode('utf-8')
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            sys.exit('stopped: HTTP %d from the official site (no workaround attempted)' % e.code)
        return None
    open(p, 'w', encoding='utf-8').write(s)
    return s


def parse(s):
    """Official page -> dict, or None when the page holds no card (unknown id)."""
    if 'detailColInfoInner' not in s or not re.search(r'<dt class="detailColListTerm">カテゴリー</dt>\s*<dd[^>]*>\s*\S', s):
        return None
    rows = {}
    for dt, dd in re.findall(r'<dt class="detailColListTerm">(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>', s, re.S):
        rows[dt.strip()] = dd
    txt = lambda h: re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', h))).strip()
    o = {'type': TYPES.get(txt(rows.get('カテゴリー', '')))}
    o['colors'] = sorted(COLORS[c] for c in re.findall(r'class="attributeItem[^"]*">([^<]+)<', rows.get('属性', '')) if c in COLORS)
    m = re.search(r'textCost">(\d+)<', rows.get('コスト', ''))
    o['cost'] = int(m.group(1)) if m else None
    o['reduction'] = len([x for x in re.findall(r'<img[^>]*alt="([^"]*)"', rows.get('軽減コスト', '')) if x in COLORS])   # god / other icons are dropped by the import on purpose
    lv = []
    for item in re.findall(r'<div class="bpCoreItem[^"]*">(.*?)</div>', rows.get('BP/コア', ''), re.S):
        a = re.search(r'alt="([^"]*)"', item).group(1)
        v = re.search(r'bpCoreVal">([^<]*)<', item).group(1).strip()
        c = re.sub(r'\s+', '', re.search(r'bpCoreLevel">(.*?)</span>', item, re.S).group(1))
        lv.append((a, v, c))
    lead = lambda t: int(m.group(0)) if (m := re.match(r'\d+', t)) else None        # "3/<soul core icon>" -> 3; "C2" -> 2; "-" -> None
    o['levels'] = [(lead(v), lead(c.lstrip('C'))) for a, v, c in lv if a.startswith('LV')]
    o['braveBp'] = next((int(v.lstrip('+')) for a, v, c in lv if a == 'brave' and v.lstrip('+').isdigit()), None)
    body = txt(rows.get('能力・効果', ''))
    m = re.search(r'(?:合体条件[：:]\s*)コスト(\d+)以(上|下)', body)
    o['combine'] = {'costGe' if m.group(2) == '上' else 'costLe': int(m.group(1))} if m else None
    return o


def compare(c, o):
    d = []
    if o['type'] and o['type'] != c.get('type'):
        d.append(('type', c.get('type'), o['type']))
    mine = sorted(c.get('colors') or ([c['color']] if c.get('color') else []))
    if o['colors'] and mine != o['colors'] and c.get('type') != 'Magic':
        d.append(('colors', mine, o['colors']))
    if o['cost'] is not None and c.get('cost') != o['cost']:
        d.append(('cost', c.get('cost'), o['cost']))
    red = c.get('reduction') or {}
    n = sum(v for k, v in red.items() if k in COLORS.values()) if isinstance(red, dict) else None   # ultimate / god symbols are not colour icons
    if n is not None and n != o['reduction'] and (n or o['reduction']) and not any('god' in k for k in red):
        d.append(('reduction', n, o['reduction']))
    if c.get('type') in ('Spirit', 'Brave', 'Nexus') and c.get('levels') and o['levels']:
        mine = [(l.get('bp'), l.get('cores')) for l in c['levels']]
        theirs = [(b, k) for b, k in o['levels']]
        if c.get('type') == 'Nexus':
            mine = [x[1] for x in mine if x[1] is not None][-1:]            # the page lists only the Lv2 threshold of a Nexus
            theirs = [x[1] for x in theirs if x[1] is not None][-1:]
        else:
            theirs = [(b, k) for b, k in theirs]
            mine = [(b, k) for b, k in mine]
        if mine != theirs and (len(mine) == len(theirs) or c.get('type') == 'Nexus'):
            d.append(('levels', mine, theirs))
    br = c.get('brave')
    if c.get('type') == 'Brave' and br:
        if o['braveBp'] is not None and br.get('bp') != o['braveBp']:
            d.append(('braveBp', br.get('bp'), o['braveBp']))
        if o['combine']:
            k, v = next(iter(o['combine'].items()))
            if br.get(k) != v:
                d.append(('combine', {x: br[x] for x in ('costGe', 'costLe') if x in br}, o['combine']))
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', type=int)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--ids', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'official-cards'))
    ap.add_argument('--delay', type=float, default=0.7)
    ap.add_argument('--json', help='write the differences to this file')
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)
    cards = load_cards()
    if a.ids: ids = a.ids
    elif a.all: ids = sorted(cards)
    else: ids = random.Random(a.seed).sample(sorted(cards), a.sample or 200)
    stat = {'checked': 0, 'no_page': 0, 'same': 0, 'diff': 0}
    per = {}
    out = {}
    for i, cid in enumerate(ids):
        c = cards.get(cid)
        if not c: print('unknown id', cid); continue
        s = fetch(cid, a.cache, a.delay)
        o = parse(s) if s else None
        if not o:
            stat['no_page'] += 1; out[cid] = 'no_page'; continue
        stat['checked'] += 1
        d = compare(c, o)
        if d:
            stat['diff'] += 1; out[cid] = d
            for f, mine, off in d: per[f] = per.get(f, 0) + 1
            print(cid, c.get('name'), d)
        else: stat['same'] += 1
        if (i + 1) % 200 == 0: print('...', i + 1, '/', len(ids), stat, file=sys.stderr)
    print(stat, 'per field:', per)
    if a.json: json.dump(out, open(a.json, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
