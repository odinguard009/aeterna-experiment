#!/usr/bin/env python3
"""Accel cost reductions (v0.179.0): the Fandom export keeps `{{Accel|Cost 4 ()}}` with the reduction icons dropped.
The page wikitext (MediaWiki API, `prop=revisions&rvslots=main`) still has them as `[[File:Red core.png|20px]]` images.
This reads saved API answers (the fetch_content JSON files) and writes only derived facts
(card name -> Accel cost + reduction colours) to data/sources/accel-reductions.json; no wiki text is stored.

  python3 tools/accel_reductions.py <fetch-result-file>...      merge the answers into the table
  python3 tools/accel_reductions.py --check                     list library Accel cards the table does not cover
"""
import glob, json, re, sys, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'sources', 'accel-reductions.json')
ACCEL = re.compile(r'\{\{Accel\|Cost (\d+)\s*\((.*?)\)\}\}', re.S)
ICON = re.compile(r'File:(Red|Purple|Green|White|Yellow|Blue) core', re.I)


def load():
    return json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}


def pages_of(path):
    raw = open(path, encoding='utf-8').read()
    for r in json.loads(raw).get('results', []):
        try:
            q = json.loads(r['text'].replace(chr(92) + '*', '*').replace(chr(92) + '_', '_'), strict=False)['query']['pages']   # the fetch tool markdown-escapes * and _, and leaves raw newlines in strings
        except Exception:
            continue
        for p in q.values():
            rev = (p.get('revisions') or [{}])[0].get('slots', {}).get('main', {}).get('*')
            if rev:
                yield p['title'], rev


def parse(wikitext):
    out = []
    for m in ACCEL.finditer(wikitext):
        red = {}
        for c in ICON.findall(m.group(2)):
            red[c.lower()] = red.get(c.lower(), 0) + 1
        out.append({'cost': int(m.group(1)), 'reduction': red})
    return out


def check(table):
    miss = []
    for f in sorted(glob.glob(os.path.join(os.path.dirname(OUT), '..', 'cards', '*.json'))):
        for x in json.load(open(f, encoding='utf-8')):
            t = x.get('text') or x.get('desc') or ''
            if '{{Accel' in t and x['name'].replace('​', '') not in table:
                miss.append(x['id'] + ' ' + x['name'])
    print(len(miss), 'library Accel cards without a table row', *miss[:20], sep='\n  ')


if __name__ == '__main__':
    table = load()
    if sys.argv[1:] == ['--check']:
        check(table)
        sys.exit(0)
    for path in sys.argv[1:]:
        for title, wt in pages_of(path):
            eff = parse(wt)
            if eff:
                table[title] = eff
    json.dump(dict(sorted(table.items())), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(table), 'cards in', os.path.relpath(OUT))
