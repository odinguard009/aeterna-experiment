#!/usr/bin/env python3
"""Puts English into the product-only cards of data/cards/saga-60.json (v0.209.2): every output of Aeterna is English.
Layers, first hit wins: (1) Fandom (data/sources/fandom-saga60-en.json, tools/fetch_saga60_en.py): name, families, effect;
(2) a reprint of a card we already have in English (same Japanese name and the same official Japanese text);
(3) hand translation (data/import/saga60-en-manual.json: id -> {name, families, text}), checked against the official Japanese fields.
Families fall back to a Japanese->English table learned from the cards that have both. Residual = the English clauses (paragraphs).
  python3 tools/merge_saga60_en.py [--dry]"""
import glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
JP = re.compile(r'[぀-ヿ㐀-鿿]')
BR = {'［': '[', '］': ']'}


def j(p): return json.load(open(os.path.join(ROOT, p), encoding='utf8'))
def norm(s):
    if isinstance(s, list): s = ''.join(map(str, s))
    return re.sub(r'\s+', '', (s or '').translate(str.maketrans('［］（）', '[]()')))
def has_jp(v): return bool(JP.search(json.dumps(v, ensure_ascii=False)))


def clean_text(raw):
    s = raw or ''
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'\[\[\s*file:\s*Soul Core[^\]]*\]\]', '(Soul Core)', s, flags=re.I)
    s = re.sub(r'\[\[\s*file:\s*(Red|Blue|Green|Yellow|White|Purple) core[^\]]*\]\]', lambda m: '(' + m.group(1).title() + ' Core)', s, flags=re.I)
    s = re.sub(r'\[\[\s*file:[^\]]*\]\]', '', s, flags=re.I)
    s = re.sub(r'<ref[^>]*>.*?</ref>|<[^>]+>', '', s, flags=re.S)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\{\{\s*ST\s*\|([^{}|]*)\}\}', r' (\1)', s, flags=re.I)
    s = re.sub(r'\{\{\s*tk\s*\|\s*team\s*\|([^{}|]*)\}\}', r'[Team: \1]', s, flags=re.I)
    s = re.sub(r'\{\{\s*tk\s*\|\s*teams\s*\|([^{}]*)\}\}', lambda m: '[Teams: ' + m.group(1).replace('|', '/') + ']', s, flags=re.I)
    s = re.sub(r'\{\{\s*tk\s*\|([^{}|]*)\}\}', r'\1', s, flags=re.I)
    s = re.sub(r'\{\{\s*ruby\s*\|([^{}|]*)\|[^{}]*\}\}', r'\1', s, flags=re.I)
    s = s.replace("'''", '').replace("''", '').replace('\xa0', ' ')
    s = re.sub(r'[ \t]+', ' ', s)
    s = '\n'.join(l.strip() for l in s.split('\n'))
    return re.sub(r'\n{3,}', '\n\n', s).strip()


def clauses(text, limit=380):
    """paragraph clauses; a paragraph longer than the parseCard limit (400) is split at sentence ends"""
    out = []
    for p in re.split(r'\n\s*\n', text):
        p = re.sub(r'\s*\n\s*', ' ', p).strip()
        while len(p) > limit:
            cuts = [m.end() for m in re.finditer(r'(?:[.)}] |(?= ◆))', p[:limit])]
            cut = cuts[-1] if cuts and cuts[-1] > 40 else (p.rfind(' ', 0, limit) + 1 or limit)
            out.append(p[:cut].strip()); p = p[cut:].strip()
        if p: out.append(p)
    return out


def en_name(n): return re.sub(r'］\s+', '］', n).strip()


def main():
    dry = '--dry' in sys.argv
    path = os.path.join(ROOT, 'data/cards/saga-60.json')
    cards = json.load(open(path, encoding='utf8'))
    fan = j('data/sources/fandom-saga60-en.json')
    off = j('data/sources/official-fields.json')
    manual = j('data/import/saga60-en-manual.json') if os.path.exists(os.path.join(ROOT, 'data/import/saga60-en-manual.json')) else {}
    # reprint index: (Japanese name, Japanese text) of cards that are already English -> that card
    reprint = {}
    for f in glob.glob(os.path.join(ROOT, 'data/cards/*.json')):
        if f.endswith('saga-60.json'): continue
        for c in json.load(open(f, encoding='utf8')):
            o = off.get(c['id'])
            if o and not has_jp([c['name'], c.get('text'), c.get('families')]) and o.get('nameJp'):
                reprint.setdefault((norm(o['nameJp']), norm(o.get('textJp'))), c)
    # Japanese family -> English family: majority vote over every card where both sides are known (a zip error is outvoted)
    votes = {}
    def vote(jp, en):
        for a, b in zip(jp, en):
            if JP.search(a) and not JP.search(b): votes.setdefault(a, {}).setdefault(b, 0); votes[a][b] += 1
    for c in cards:
        e = fan.get(c['id'])
        if e and len(e['families']) == len(c.get('families', [])): vote(c['families'], e['families'])
    for f in glob.glob(os.path.join(ROOT, 'data/cards/*.json')):
        if f.endswith('saga-60.json'): continue
        for c in json.load(open(f, encoding='utf8')):
            o = off.get(c['id'], {})
            jp = [x for x in re.split(r'[・,、]', o.get('familiesJp') or '') if x]
            if jp and len(jp) == len(c.get('families', [])): vote(jp, c['families'])
    fam = {k: max(v, key=v.get) for k, v in votes.items()}
    fam.update(manual.get('_families', {}))
    stat = {'fandom': 0, 'reprint': 0, 'manual': 0, 'left': []}
    for c in cards:
        if not has_jp([c['name'], c.get('text'), c.get('families'), c.get('residual'), c.get('rcode')]): continue
        i, m = c['id'], manual.get(c['id'])
        e = fan.get(i)
        o = off.get(i, {})
        rp = reprint.get((norm(c.get('name_jp') or o.get('nameJp')), norm(c.get('text') or o.get('textJp'))))
        name = fams = text = None
        if m:
            name, fams, text = m.get('name'), m.get('families'), m.get('text'); src = 'manual'
        elif e and e['name'] and not has_jp(clean_text(e['effect'])) and (clean_text(e['effect']) or not c.get('text', '').strip()):
            name, fams, text = en_name(e['name']), e['families'], clean_text(e['effect']); src = 'fandom'
        elif rp:
            name, fams, text = rp['name'], rp.get('families'), rp.get('text', ''); src = 'reprint'
        else:
            if e and e['name']:
                name = en_name(e['name']); fams = e['families']
            src = None
        if name is None and src is None and e and e['name']: name = en_name(e['name'])
        if fams is None and c.get('families'):
            fams = [fam.get(f, f) for f in c['families']]
        if src is None or name is None or has_jp([name, fams, text]):
            stat['left'].append(i)
            continue
        stat[src] += 1
        c['name'] = name
        c['families'] = fams
        c['text'] = text
        c['residual'] = clauses(text) if c.get('residual') else []
        if c.get('rcode') and JP.search(c['rcode']): c['rcode'] = {'転醒X': 'Awaken X', '転醒R': 'Awaken R'}.get(c['rcode'], c['rcode'])
        c['note'] = re.sub(r'\s*English text/name pending\.?', '', c.get('note', '')).replace('Japanese text from the official card database', 'text from the official card database (English: ' + {'fandom': 'Fandom wiki', 'reprint': 'reprint', 'manual': 'hand translation'}[src] + ')').strip()
    left = stat.pop('left')
    print({k: v for k, v in stat.items()}, 'left', len(left))
    json.dump(left, open(os.path.join(ROOT, 'build/saga60-left.json'), 'w'), ensure_ascii=False)
    if not dry:
        json.dump(cards, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    main()
