#!/usr/bin/env python3
"""Card data intake (v0.36).
Merges the raw Fandom export (data/sources/fandom-cards-bs01-bs77.json, reference only) with the
image index (data/index/saga_card_index.json) into one staging file per Saga: data/import/saga-NN.json.

  python3 tools/import_fandom.py            -> writes data/import/saga-NN.json + data/import/report.json
  python3 tools/import_fandom.py --check    -> same, prints the summary only, writes nothing

Rules
- Staging only: nothing here is loaded by the game. A colour-expansion release promotes cards from data/import
  into data/cards after their stats are checked against the card image (the image wins over the wiki).
- Cards already in data/cards (hand-verified, Saga 15-17) are never overwritten: they are skipped and counted.
- The image is matched by (set, name), then by name alone when the name is unique; otherwise it is reported.
- Rows with the same card number are merged when the name is the same (rarities are collected);
  a different name under one number is a conflict: the row whose name has an image in that set wins, the rest is reported.
- Token rows go to the report (tokens live in data/cards/tokens.json)."""
import json, os, re, sys, glob, unicodedata, collections, difflib, hashlib, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json')
SRC_STD = os.path.join(ROOT, 'data/sources/fandom-cards-26r.json')   # v0.62.0: Standard block A (tools/fetch_fandom_std.py)
STD_SAGA = 50   # v0.62.0: Standard block A cards live in saga-50.json (block "A"); 50 keeps them apart from the Eternal Sagas 1-17
IDX = os.path.join(ROOT, 'data/index/saga_card_index.json')
OUT = os.path.join(ROOT, 'data/import')
SAGA_END = [(9, 1), (13, 2), (18, 3), (23, 4), (30, 5), (34, 6), (39, 7), (43, 8), (47, 9), (51, 10),
            (55, 11), (59, 12), (63, 13), (67, 14), (71, 15), (75, 16), (77, 17)]
COLORS = {'red', 'purple', 'green', 'white', 'yellow', 'blue'}
SET_RE = re.compile(r'^(?:<[^>]*>)*(BS\d+|SD\d+|CB\d+|BSC\d+|\d\dRBS\d+|CBX\d+|PC\d+)')


def saga_of(set_code):
    if re.match(r'^26R', set_code or ''):
        return STD_SAGA
    m = re.match(r'^BS(\d+)$', set_code or '')
    if not m:
        return None
    n = int(m.group(1))
    return next((s for end, s in SAGA_END if n <= end), None)


def norm(name):
    name = re.sub(r'\s*\((card|spirit|nexus|magic|brave)\)\s*$', '', name or '', flags=re.I)
    name = unicodedata.normalize('NFKD', name)
    return re.sub(r'[^a-z0-9]', '', name.lower())


def build_image_index():
    by_set, by_name = collections.defaultdict(list), collections.defaultdict(list)
    for entries in json.load(open(IDX, encoding='utf-8')).values():
        for meta, name, fname in entries:
            code = next((m.group(1) for t in meta if (m := SET_RE.match(t))), None)
            by_set[(code, norm(name))].append(fname)
            by_name[norm(name)].append((code, fname))
    return by_set, by_name


def find_image(card, by_set, by_name):
    """-> (file or None, problem or None)"""
    n = norm(card['name'])
    hit = by_set.get((card['set'], n))
    if hit:
        return (hit[0], None) if len(set(hit)) == 1 else (hit[0], 'ambiguous in set (%d files)' % len(set(hit)))
    hit = by_name.get(n, [])
    files = sorted({f for _, f in hit})
    if len(files) == 1:
        return files[0], None
    if files:
        return None, 'ambiguous name (%d files, none in set %s)' % (len(files), card['set'])
    near = difflib.get_close_matches(n, [k[1] for k in by_set if k[0] == card['set']], 1, 0.8)
    return None, 'no image' + (' (near: %s)' % ', '.join(by_set[(card['set'], near[0])][:1]) if near else '')


def reduction_of(r):
    """Colour reduction icons, plus Fandom's gold icon = our `ultimate` reduction symbol (v0.41.5: 241 Fandom Ultimates carry a gold
    symbol, and manual p. 40 says the Ultimate symbol pays Ultimate reduction symbols). The god icon stays dropped (open, issue #5)."""
    out = {}
    for k, v in (r.get('reduction') or {}).items():
        k = k.lower()
        k = 'ultimate' if k == 'gold' else k
        if k in COLORS or k == 'ultimate':
            out[k] = v
    return out


BRAVE_SRC = os.path.join(ROOT, 'data/sources/fandom-brave-combine.tsv')
BRAVE_COST = r'(?:A )?[Cc]ost (?:of )?(\d+) or (?:more|above)'


def brave_of(cond, bp):
    """v0.60.0: Brave combine data from the Fandom page fields (the export drops them). Returns the card's `brave` dict,
    or None when the condition is not one the engine can check yet (two-sided, Grandwalker Nexus, Ultimates, symbol or
    keyword holders, "or less" costs, family OR cost). braveFits: name/family are OR'd, costGe is AND'd."""
    c = re.sub(r"\[\[|\]\]|'{3}", '', cond).strip()
    m = re.match(r'^\+?(\d+)$', bp.strip())
    if not m: return None
    out = {'bp': int(m.group(1))}
    if re.match(r'^No printed effects?$', c, re.I): return out
    if re.search(r'<br|\[(Left|Right)|Ultimate|Nexus|symbol|holder|less|\{\{|"', c, re.I): return None
    m = re.match('^' + BRAVE_COST + '$', c)
    if m: out['costGe'] = int(m.group(1)); return out
    m = re.match(r'^([A-Z][\w ]*?) & ' + BRAVE_COST + '$', c)
    if m: out['family'] = [m.group(1)]; out['costGe'] = int(m.group(2)); return out
    fams = [x.strip() for x in c.split('/')]
    if all(re.match(r'^[A-Z][A-Za-z ]+$', x) and not re.search(r'\bCost\b', x) for x in fams):
        out['family'] = fams; return out
    return None


def brave_table():
    t = {}
    if not os.path.exists(BRAVE_SRC): return t
    for line in open(BRAVE_SRC, encoding='utf8'):
        if line.startswith('#') or not line.strip(): continue
        title, cond, bp = line.rstrip('\n').split('\t')
        t[title] = brave_of(cond, bp)
    return t


NEXUS_SRC = os.path.join(ROOT, 'data/sources/fandom-nexus-levels.tsv')     # v0.60.3: Nexus level thresholds
UT_SRC = os.path.join(ROOT, 'data/sources/fandom-ultimate-trigger.tsv')     # v0.60.3: Ultimate Trigger [LVn] (timing)


def page_title(card):
    return urllib.parse.unquote((card.get('source') or '').split('/wiki/')[-1]).replace('_', ' ')


def nexus_table():
    """sha1(title)[:6] -> cores per level (levels 1, 2, ...), from the Fandom `level` field."""
    t = {}
    if not os.path.exists(NEXUS_SRC): return t
    for line in open(NEXUS_SRC, encoding='utf8'):
        if line.startswith('#') or not line.strip(): continue
        k, v = line.split()
        t[k] = [int(x) for x in v.split(',')]
    return t


def ut_params(raw):
    """Wiki typos fixed: 'LV4][LV5]' and '[V3]' -> '[LV4][LV5]', '[LV3]'."""
    raw = re.sub(r'\[V(\d)\]', r'[LV\1]', raw.strip())
    return '[' + raw if raw.startswith('LV') else raw


def ut_table():
    t = {}
    if not os.path.exists(UT_SRC): return t
    for line in open(UT_SRC, encoding='utf8'):
        if line.startswith('#') or '\t' not in line: continue
        title, v = line.rstrip('\n').split('\t')
        t[title] = [ut_params(x) for x in v.split(';')]
    return t


def add_ut_lines(text, params):
    """Puts the dropped level/timing back after each bare 'Ultimate Trigger' paragraph head, in page order."""
    it = iter(params)
    def rep(m):
        p = next(it, None)
        return m.group(0) if p is None else m.group(1) + 'Ultimate Trigger ' + p + '\n'
    return re.sub(r'(^|\n)Ultimate Trigger[ \t]*\n', rep, text)


def convert(r, image):
    t = r['type'] or ''
    t_fixed = {'Spirt': 'Spirit'}.get(t, t)
    flags = []
    for pre in ('Contract ', 'Token '):
        if t_fixed.startswith(pre):
            flags.append(pre.strip().lower()); t_fixed = t_fixed[len(pre):]
    if '/' in t_fixed:
        t_fixed, extra = t_fixed.split('/', 1); flags.append(extra.strip().lower().replace(' ', '-'))
    colors = [c.lower() for c in (r['color'] or '').split('/') if c.lower() in COLORS]
    sym = r.get('symbols') or {}
    lv = [{k: v for k, v in (('cores', L.get('cores')), ('bp', L.get('bp'))) if v is not None} for L in r.get('levels') or []]
    m = re.match(r'^BS(\d+)$', r['set'] or '')
    block = m.group(1) if m else ('A' if re.match(r'^26R', r['set'] or '') else None)
    if t_fixed == 'Spirit' and not lv and re.match(r'^(Main|Flash)\s*\n', r.get('effect') or ''):
        t_fixed = 'Magic'                          # v0.51.2: Magic cards typed "Spirit" in the export (no levels, Main/Flash text)
    return {
        'id': r['id'], 'name': re.sub(r'\s+', ' ', r['name']).strip(), 'name_jp': r.get('name_jp'), 'type': t_fixed,
        'color': colors[0] if colors else None, 'colors': colors,
        'set': r['set'], 'cost': r.get('cost'),
        'reduction': reduction_of(r),
        'symbols': sum(sym.values()) if isinstance(sym, dict) else sym,
        'levels': lv, 'families': r.get('families') or [], 'keyword': r.get('keyword'),
        'text': r.get('effect') or '', 'rarity': [r['rarity']] if r.get('rarity') else [],
        'flags': flags, 'image': image, 'block': block, 'saga': saga_of(r['set']),
        'source': r.get('source'), 'status': 'imported', 'stats_verified': False, 'fxComplete': False,
        **({'ex_symbols': r['ex_symbols']} if r.get('ex_symbols') else {}),
    }


def main():
    check = '--check' in sys.argv
    rows = json.load(open(SRC, encoding='utf-8'))['cards']
    if os.path.exists(SRC_STD):                 # block A rows win over the same numbers listed in a BS set (e.g. BS75 box promos)
        std = json.load(open(SRC_STD, encoding='utf-8'))['cards']
        std_ids = {r['id'] for r in std}
        rows = [r for r in rows if r['id'] not in std_ids] + std
    by_set, by_name = build_image_index()
    braves = brave_table()
    nexus_lv, uts = nexus_table(), ut_table()
    have = {c['id'] for f in glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json')) for c in json.load(open(f, encoding='utf-8'))
            if not (c.get('residual') and 'Partial card (v0.79.0' in (c.get('note') or ''))}      # v0.79.0 (A1): partial cards keep their staging record
    rep = collections.defaultdict(list)
    groups = collections.OrderedDict()
    for r in rows:
        if (r['type'] or '').startswith('Token'):
            rep['tokens'].append(r['id']); continue
        if r.get('missing'):
            rep['missing_page'].append(r['id'])
        groups.setdefault(r['id'], []).append(r)
    out = collections.defaultdict(list)
    for cid, rs in groups.items():
        if cid in have:
            rep['skipped_curated'].append(cid); continue
        names = {norm(x['name']) for x in rs}
        chosen = rs[0]
        if len(names) > 1:
            with_img = [x for x in rs if find_image(x, by_set, by_name)[0]]
            chosen = (with_img or rs)[0]
            rep['number_conflicts'].append({'id': cid, 'names': sorted({x['name'] for x in rs}), 'kept': chosen['name']})
        same = [x for x in rs if norm(x['name']) == norm(chosen['name'])]
        img, prob = find_image(chosen, by_set, by_name)
        if img and not re.search(r'\.(png|jpe?g|gif|webp)$', img, re.I):
            rep['image_problems'].append({'id': cid, 'name': chosen['name'], 'problem': 'no image (bad file name in the index: %r)' % img})
            img = None
        card = convert(same[0], img)
        odd = [k for k in (same[0].get('reduction') or {}) if k.lower() not in COLORS and k.lower() != 'gold']
        if odd:
            rep['odd_reduction'].append({'id': cid, 'dropped': odd})
        if any(i and L.get('cores', 0) <= card['levels'][i - 1].get('cores', 0) for i, L in enumerate(card['levels'])):
            rep['level_problems'].append({'id': cid, 'levels': card['levels']})
        card['rarity'] = sorted({x['rarity'] for x in same if x.get('rarity')})
        if len(same) > 1:
            rep['merged'].append(cid)
        if prob:
            rep['image_problems'].append({'id': cid, 'name': chosen['name'], 'problem': prob})
        if card['type'] == 'Brave':
            key = (card.get('source') or '').split('/wiki/')[-1]
            if braves.get(key): card['brave'] = braves[key]
            else: rep['brave_unparsed' if key in braves else 'brave_no_data'].append(cid)
        if card['type'] == 'Nexus' and not card['levels']:
            lv = nexus_lv.get(hashlib.sha1(page_title(card).encode('utf8')).hexdigest()[:6])
            if lv and lv[0] == 0:
                card['levels'] = [{'cores': n} for n in lv]; rep['nexus_levels_added'].append(cid)
            else: rep['nexus_levels_missing'].append(cid)
        if card['type'] == 'Ultimate' and re.search(r'(^|\n)Ultimate Trigger[ \t]*\n', card['text']):
            ps = uts.get(page_title(card))
            if ps: card['text'] = add_ut_lines(card['text'], ps); rep['ut_lines_added'].append(cid)
            else: rep['ut_lines_missing'].append(cid)
        if card['saga'] is None:
            rep['no_saga'].append(cid)
            continue
        if card['type'] not in ('Spirit', 'Nexus', 'Magic', 'Brave', 'Ultimate'):
            rep['odd_type'].append({'id': cid, 'type': card['type']})
        if not card['colors']:
            rep['no_color'].append(cid)
        out[card['saga']].append(card)
    for s in out:
        out[s].sort(key=lambda c: (c['block'] or '', c['id']))
    stats = {'cards': sum(map(len, out.values())), 'per_saga': {s: len(v) for s, v in sorted(out.items())}}
    for k, v in rep.items():
        stats[k] = len(v)
    stats['without_image'] = sum(1 for v in out.values() for c in v if not c['image'])
    print(json.dumps(stats))
    if check:
        return
    os.makedirs(OUT, exist_ok=True)
    for s, cards in out.items():
        with open(os.path.join(OUT, 'saga-%02d.json' % s), 'w', encoding='utf-8', newline='') as f:   # one card per line: small, diff-friendly (newline='': no CRLF churn on Windows)
            f.write('[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in cards) + '\n]\n')
    json.dump({'stats': stats, **rep}, open(os.path.join(OUT, 'report.json'), 'w', encoding='utf-8', newline=''), indent=1, ensure_ascii=False)
    print('wrote', len(out), 'files + report.json to data/import/')


if __name__ == '__main__':
    main()
