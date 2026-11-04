#!/usr/bin/env python3
"""Stub numbers (listed on Fandom set pages, no card data in the master database) -> library cards so every printed number is playable.
  python3 tools/master/resolve_stubs.py            -> writes build_stubs.tmp.json and merges it with build_cards.py --update
Rules: a stub whose English title is the name of a library card of the same type is a clone of it (same stats and effects, new id);
otherwise the Fandom card page is read (infobox written on one line or many) for colour, cost, levels, reduction, family and effect,
and the card enters as a partial card (fxComplete false + residual). A stub with no page data is reported, never invented."""
import json, gzip, glob, os, re, sys, subprocess, collections, time
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import textclean, fandom_jp_lookup_lib as FL
M = json.load(gzip.open(os.path.join(ROOT, 'data/master/cards.json.gz')))
ROWS = {r['id']: r for r in json.load(gzip.open(os.path.join(ROOT, 'data/master/cache/fandom-rows.json.gz')))}
lib = {c['id']: c for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))) for c in json.load(open(f, encoding='utf-8'))}
by_name = collections.defaultdict(list)
for c in lib.values(): by_name[c['name']].append(c)
RT = {'Spirit': 'Spirit', 'Ultimate': 'Ultimate', 'Brave': 'Brave', 'Nexus': 'Nexus', 'Magic': 'Magic'}
SG = {}
for c in lib.values(): SG.setdefault(c['id'].split('-')[0], (c['saga'], c['block']))
ids = [r['id'] for r in M.values() if r['class'] == 'stub' and r['id'] not in lib]
titles = sorted({ROWS[i]['title'] for i in ids if i in ROWS})
pages = FL.fetch_pages(titles)
out, report = [], []
for i in ids:
    row = ROWS.get(i)
    if not row: report.append((i, 'no Fandom row')); continue
    t = row['title']; typ = RT.get((row['type'] or '').split('/')[0].strip())
    saga, block = SG.get(i.split('-')[0], (60, 'P'))
    twin = next((c for c in by_name.get(t, []) if c['type'] == typ and not c.get('note', '').startswith('Reprint of')), None) or next((c for c in by_name.get(t, []) if c['type'] == typ), None)
    if twin:
        c = json.loads(json.dumps(twin)); c.update(id=i, saga=saga, block=block, image=i + '.png', note='Reprint of %s (same name on the Fandom set page); added by tools/master/resolve_stubs.py.' % twin['id'])
        c.pop('rcode', None); out.append(c); continue
    bl = FL.blocks(pages.get(t, ''))
    if not bl or not typ: report.append((i, 'no infobox' if not bl else 'type ' + str(row['type']))); continue
    b = bl[0]; cols = [x.strip().lower() for x in re.split(r'[/,]', re.sub(r'\[\[|\]\]', '', b.get('color') or row['color'] or '')) if x.strip()]
    cost = re.search(r'\d+', b.get('cost') or ''); lv = []
    for m in re.finditer(r'(\d+)\s*cores?\s*,?\s*(\d+)\s*BP', re.sub(r'<br\s*/?>', ' ', b.get('level') or ''), re.I): lv.append({'cores': int(m.group(1)), 'bp': int(m.group(2))})
    red = collections.Counter(re.findall(r'(Red|Blue|Green|Yellow|Purple|White) core', b.get('reduction') or '', re.I))
    sym = len(re.findall(r'core', b.get('symbols') or '', re.I))
    text = textclean.clean_effect(b.get('effect') or '')
    fam = [x.strip() for x in re.split(r'[,/]', re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', b.get('family') or '')) if x.strip()]
    c = {'id': i, 'name': t, 'name_jp': b.get('kanji') or b.get('jpname') or '', 'type': typ, 'color': cols[0] if cols else 'white',
         'cost': int(cost.group()) if cost else 0, 'reduction': {k.lower(): v for k, v in red.items()}, 'symbols': sym or (1 if typ in ('Spirit', 'Ultimate') else 0),
         'levels': lv if typ in ('Spirit', 'Ultimate', 'Brave') else [{'cores': l['cores']} for l in lv], 'families': fam, 'text': text, 'image': i + '.png', 'block': block, 'saga': saga}
    if len(cols) > 1: c['colors'] = cols
    if typ in ('Spirit', 'Ultimate', 'Brave') and not lv: report.append((i, 'no levels on the page')); continue
    if typ == 'Brave': c['brave'] = {'bp': lv[-1]['bp'], 'costGe': 3}; c['levels'] = lv[:1]
    res = [' '.join(x.split()) for x in text.split('\n') if x.strip()]
    c['fxComplete'] = not res
    if res: c['residual'] = res
    c['note'] = 'Added by tools/master/resolve_stubs.py from the Fandom card page (no official record); effects not wired yet, stats unverified.'
    out.append(c)
print('stubs', len(ids), 'to write', len(out), 'unresolved', report)
if out and '--dry-run' not in sys.argv:
    tmp = os.path.join(ROOT, 'build_stubs.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp)
