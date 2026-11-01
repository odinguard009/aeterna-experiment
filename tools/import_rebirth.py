#!/usr/bin/env python3
"""Import the 264 Rebirth front-side cards (Category:Rebirth Side A) as partial playable cards.

Owner order 2026-11-01: show Rebirth cards in the Library and the Deck Builder; effects may stay
partial, the cards only need to be playable. The data model already has `rebirthTo` (front -> back)
and `rebirthSide` (back); this pass fills the front cards and points `rebirthTo` at a synthetic
back-side id (`<front-id>B`). The back face is not imported yet because the flip rule is not wired.
Re-run is idempotent; existing ids are left alone.

  python3 tools/import_rebirth.py --dry-run   -> parse and report only
  python3 tools/import_rebirth.py             -> append the cards to data/cards/saga-*.json
"""
import argparse
import glob
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
API = 'https://battle-spirits.fandom.com/api.php'
UA = 'aeterna-rebirth-import/1.0 (read-only)'
NOTE = ('Partial card (v0.79.0 Rebirth import 2026-11-01): Rebirth front side only, effects not wired; '
        'the flip/rebirth rule is not in the engine yet.')
COLORS = {'red': 'red', 'purple': 'purple', 'green': 'green', 'white': 'white', 'yellow': 'yellow', 'blue': 'blue'}
SPECIAL = {'god': 'god', 'ultimate': 'ultimate'}


def api(**params):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def pages(titles):
    """title -> wikitext for up to 50 titles, following normalization and redirects."""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        d = api(action='query', prop='revisions', rvprop='content', rvslots='main', redirects=1, titles='|'.join(batch))
        q = d.get('query', {})
        back = {}
        for key in ('normalized', 'redirects'):
            for x in q.get(key, []):
                back[x['to']] = x['from']
        found = {}
        for p in q.get('pages', []):
            revs = p.get('revisions')
            if not revs:
                continue
            title = p['title']
            src = back.get(title, title)
            src = back.get(src, src)
            found[src] = found[title] = revs[0]['slots']['main']['content']
        for t in batch:
            out[t] = found.get(t, '')
    return out


def category_members():
    titles, cont = [], None
    while True:
        p = {'action': 'query', 'list': 'categorymembers', 'cmtitle': 'Category:Rebirth Side A', 'cmlimit': '500'}
        if cont:
            p['cmcontinue'] = cont
        d = api(**p)
        titles += [x['title'] for x in d['query']['categorymembers']]
        cont = d.get('continue', {}).get('cmcontinue')
        if not cont:
            return titles


def card_fields(wikitext):
    """The first CardTable3 block as a {field: value} map (values may span lines)."""
    start = wikitext.find('{{CardTable3')
    if start < 0:
        return {}
    block = wikitext[start:]
    end = block.find('\n}}')
    if end >= 0:
        block = block[:end + 3]
    out = {}
    for m in re.finditer(r'\n\s*\|\s*([A-Za-z0-9_]+)\s*=\s*(.*?)(?=\n\s*\||\n\}\})', block, re.S):
        out[m.group(1).lower()] = m.group(2).strip()
    return out


def clean_text(s):
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'\[\[file:[^\]]*\]\]', '', s, flags=re.I)

    def tmpl(m):
        parts = [p.strip() for p in m.group(1).split('|')]
        name = parts[0].lower()
        args = parts[1:]
        arg = args[0] if args else ''
        if name == 'tk':
            return arg
        if name == 'ws':
            return 'Windstorm: ' + arg
        if name == 'mdrain':
            return 'Mirage Drain: ' + arg
        if name == 'mt':
            return 'Mirage Trance: ' + arg
        if name == 'accel':
            return 'Accel: ' + arg
        if name == 'burst':
            return 'Burst: ' + arg
        return arg

    s = re.sub(r'\{\{([^{}]*)\}\}', tmpl, s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = s.replace("'''", '').replace("''", '')
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n[ \t]+', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def residual(text):
    text = (text or '').strip()
    if not text:
        return []
    out = []
    for part in [p.strip() for p in re.split(r'\n+|(?<=[.!?])\s+', text) if p.strip()]:
        while len(part) > 400:
            out.append(part[:400])
            part = part[400:].lstrip()
        if part:
            out.append(part)
    if len(out) > 12:
        out = out[:11] + [' '.join(out[11:])]
        out[-1] = out[-1][:400]
    return out


def icon_list(s):
    return [x.lower() for x in re.findall(r'file:([A-Za-z]+) core\.png', s or '', re.I)]


def parse_levels(kind, s):
    s = re.sub(r'<br\s*/?>', '\n', s or '', flags=re.I)
    levels = []
    for line in s.split('\n'):
        m = re.search(r'Level\s*(\d+)\s*:\s*(\d+)\s*cores?(?:\s*,\s*([0-9X]+)\s*BP)?', line, re.I)
        if not m:
            continue
        cores = int(m.group(2))
        bp = m.group(3)
        if kind == 'Nexus':
            levels.append({'cores': cores})
        elif bp is None:
            levels.append({'cores': cores, 'bp': 0})
        elif bp.upper() == 'X':
            levels.append({'cores': cores, 'bp': 0})
        else:
            levels.append({'cores': cores, 'bp': int(bp)})
    return levels


def parse_reduction(s):
    out = {}
    for c in icon_list(s):
        if c in COLORS:
            out[c] = out.get(c, 0) + 1
        elif c in SPECIAL:
            out[c] = out.get(c, 0) + 1
    return out


def parse_symbols(s):
    return len(re.findall(r'file:', s or '', re.I))


def parse_cost(s):
    m = re.search(r'\d+', s or '')
    return int(m.group(0)) if m else None


def page_id(title):
    t = re.sub(r'\s*\((?:[A-Z0-9]+-[A-Z0-9]+(?:\s*\([A-Z]\))?|[A-Z])\)$', '', title).strip()
    return t


def image_id(image):
    base = os.path.splitext(image or '')[0]
    base = re.sub(r'\s*\((?:A|B)\)$', '', base, flags=re.I)
    base = re.sub(r'\s+[bB]$', '', base)
    m = re.match(r'^([A-Z0-9]+-[A-Z0-9]+)', base)
    return m.group(1) if m else None


def saga_map():
    out = {}
    for d in ('data/cards', 'data/import'):
        for f in glob.glob(os.path.join(ROOT, d, 'saga-*.json')):
            for c in json.load(open(f, encoding='utf-8')):
                pre = str(c.get('id', '')).split('-')[0]
                if pre and c.get('saga') is not None:
                    out.setdefault(pre, c['saga'])
    # Collab/starter sets have no cards in the library yet; docs/saga-map.md places the two
    # Rebirth-era ranges in Saga 11 and 12.
    for n in range(13, 18):
        out.setdefault(f'CB{n}', 11)
    for n in range(18, 23):
        out.setdefault(f'CB{n}', 12)
    for n in range(55, 59):
        out.setdefault(f'SD{n}', 11)
    for n in range(59, 64):
        out.setdefault(f'SD{n}', 12)
    return out


def main():
    dry = '--dry-run' in sys.argv[1:]
    titles = category_members()
    pages_map = pages(titles)
    sagas = saga_map()
    existing = {}
    for f in glob.glob(os.path.join(ROOT, 'data/cards/saga-*.json')):
        for c in json.load(open(f, encoding='utf-8')):
            existing[c['id']] = c
    records, skipped = [], []
    for title in titles:
        w = pages_map.get(title, '')
        if not w:
            skipped.append((title, 'page empty'))
            continue
        f = card_fields(w)
        image = f.get('image', '')
        cid = image_id(image)
        if not cid:
            skipped.append((title, 'no card id in image ' + repr(image)))
            continue
        if cid in existing:
            skipped.append((cid, 'already in data'))
            continue
        pre = cid.split('-')[0]
        saga = sagas.get(pre)
        if saga is None:
            skipped.append((cid, 'no saga for ' + pre))
            continue
        typ = f.get('type', '').strip()
        typ = 'Nexus' if 'Nexus' in typ else 'Magic' if 'Magic' in typ else 'Brave' if 'Brave' in typ else 'Ultimate' if 'Ultimate' in typ else 'Spirit'
        color = f.get('color', '').strip().lower()
        if color not in COLORS:
            skipped.append((cid, 'unknown colour ' + repr(color)))
            continue
        levels = parse_levels(typ, f.get('level'))
        if typ == 'Spirit' and not levels:
            skipped.append((cid, 'no levels'))
            continue
        if typ == 'Spirit' and levels[0]['cores'] < 1:
            levels[0]['cores'] = 1                  # Fandom prints SD57-006 Lv1 as 0 cores; parseCard needs >= 1
        text = clean_text(f.get('effect', ''))
        families = [f.get(k, '').strip() for k in ('family', 'family2', 'family3') if f.get(k, '').strip()]
        keyword = f.get('keyword', '').strip()
        rec = {
            'id': cid,
            'name': page_id(title),
            'name_jp': f.get('kanji') or f.get('jpname') or None,
            'type': typ,
            'color': color,
            'cost': parse_cost(f.get('cost')),
            'reduction': parse_reduction(f.get('reductions')),
            'symbols': parse_symbols(f.get('symbols')),
            'levels': levels,
            'families': families,
            'mechanics': [keyword] if keyword else None,
            'text': text,
            'image': image or None,
            'block': str(f.get('block1') or '').strip() or None,
            'saga': saga,
            'rcode': (f.get('rarity1') or '').strip() or None,
            'bicon': [str(f.get('block1')).strip()] if f.get('block1') else None,
            'rebirthTo': cid + 'B',
            'fxComplete': False,
            'residual': residual(text),
            'note': NOTE,
        }
        records.append(rec)
    print(f'rebirth pages {len(titles)}, records {len(records)}, skipped {len(skipped)}')
    for cid, why in skipped[:40]:
        print('  skip', cid, why)
    if dry:
        for r in records[:5]:
            print(json.dumps({k: r.get(k) for k in ('id', 'name', 'type', 'cost', 'levels', 'reduction', 'symbols', 'saga', 'rebirthTo')}, ensure_ascii=False))
        return 0
    by_saga = {}
    for r in records:
        by_saga.setdefault(r['saga'], []).append(r)
    for saga, rows in by_saga.items():
        path = os.path.join(ROOT, 'data/cards', f'saga-{saga:02d}.json')
        raw = open(path, encoding='utf-8').read() if os.path.exists(path) else '[]\n'
        arr = json.loads(raw)
        style = 'indent' if json.dumps(arr, ensure_ascii=False, indent=1) == raw.rstrip('\n') else 'line'
        ids = {c['id'] for c in arr}
        arr += [r for r in rows if r['id'] not in ids]
        arr.sort(key=lambda c: c['id'])
        if style == 'indent':
            body = json.dumps(arr, ensure_ascii=False, indent=1)
        else:
            body = '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in arr) + '\n]'
        open(path, 'w', encoding='utf-8', newline='').write(body + '\n')
        print(f'  saga {saga}: {len(rows)} cards -> {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
