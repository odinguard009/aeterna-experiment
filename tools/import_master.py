#!/usr/bin/env python3
"""Import the cards of the master database (data/master/cards.json.gz, built by tools/master/build.py) that are
missing from the library into data/cards/saga-NN.json.
  python3 tools/import_master.py --dry-run     -> counts only, writes nothing
  python3 tools/import_master.py               -> writes build_import_master.tmp.json and merges it with build_cards.py --update
Rules:
- Imports class standalone / alt_art / reprint with a card type. Stubs (no data) and tokens are skipped (listed in the report).
- A card whose group head is already in the library is a clone of that head (new id, same stats and effects).
- Other cards are partial library cards: fxComplete false + residual (English text from Fandom, else the Japanese official text),
  fxComplete true only when the card has no printed text. English name: Fandom, else the name of a library card with the same
  Japanese name, else the Japanese name (note says English is pending).
- Existing library cards are never overwritten, except the wrong saga-60 "Reprint of ..." clones (--fix-clones, default on):
  those are rebuilt from the master record (the old clone copied stats that differ from the official data).
Afterwards run: python3 tools/build_cards.py && python3 tools/tag_effects.py && node tools/build.mjs"""
import json, gzip, glob, os, re, sys, collections, subprocess
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DRY = '--dry-run' in sys.argv
FIX = '--no-fix-clones' not in sys.argv
M = json.load(gzip.open(os.path.join(ROOT, 'data/master/cards.json.gz')))
lib, files = {}, {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
    for c in json.load(open(f, encoding='utf-8')): lib[c['id']] = c
by_jp = {}
for c in lib.values():
    if c.get('name_jp') and c['name'] != c['name_jp'] and not c.get('note', '').startswith('Reprint of') and 'pending' not in c.get('note', ''): by_jp.setdefault((c['name_jp'], c['type']), c)
RCODE = {'Common': 'C', 'Rare': 'R', 'X-Rare': 'X', 'Master Rare': 'M', 'Campaign Promo': 'CP', 'Campaign Rare': 'CP', 'Rebirth Rare': 'Awaken R', 'Rebirth X-Rare': 'Awaken X',
         'Rebirth Campaign Promo': 'Awaken CP', 'Rebirth Campaign Rare': 'Awaken CP', '転醒R': 'Awaken R', '転醒X': 'Awaken X', '契約X': 'Contract X'}   # same map as tools/master/normalize_rcode.py
RED = {'赤': 'red', '黄': 'yellow', '紫': 'purple', '白': 'white', '青': 'blue', '緑': 'green', '神': 'god', '極': 'ultimate'}
TYPES = ('Spirit', 'Ultimate', 'Brave', 'Nexus', 'Magic', 'Contract Nexus')
BSC = {5: 2, **{n: 5 for n in range(15, 20)}, **{n: 6 for n in range(20, 25)}, **{n: 7 for n in range(25, 30)}, 30: 8, 31: 8, 32: 9, 33: 9, 34: 10, 35: 10,
       36: 11, 37: 11, 38: 12, 39: 12, 40: 13, 41: 14, 42: 14, **{n: 15 for n in range(43, 47)}, **{n: 16 for n in range(47, 52)}}
CB = {**{n: 8 for n in range(1, 5)}, **{n: 9 for n in range(5, 9)}, **{n: 10 for n in range(9, 13)}, **{n: 11 for n in range(13, 18)}, **{n: 12 for n in range(18, 23)},
      **{n: 13 for n in range(23, 28)}, 28: 14, 29: 14, 30: 14, **{n: 15 for n in range(31, 35)}}
BS_RANGES = [(1, 9, 1), (10, 13, 2), (14, 18, 3), (19, 23, 4), (24, 30, 5), (31, 34, 6), (35, 39, 7), (40, 43, 8), (44, 47, 9), (48, 51, 10), (52, 55, 11),
             (56, 59, 12), (60, 63, 13), (64, 67, 14), (68, 71, 15), (72, 75, 16), (76, 99, 17)]
setsaga = collections.defaultdict(collections.Counter)
for c in lib.values():
    if c['saga'] != 60 and re.match(r'BS\d+-', c['id']): setsaga[c['id'].split('-')[0]][(c['saga'], c['block'])] += 1
def place(r):
    s = r['set']; m = re.fullmatch(r'(BS|BSC|CB)(\d+)', s)
    ic = re.fullmatch(r'<(\d+)>', r.get('block_icon') or '')
    if m and m.group(1) == 'BS':
        if s in setsaga: (sg, bl), _ = setsaga[s].most_common(1)[0]; return sg, bl
        n = int(m.group(2)); sg = next((g for a, b, g in BS_RANGES if a <= n <= b), 60); return sg, '%02d' % n
    if m and m.group(1) == 'BSC' and int(m.group(2)) in BSC: return BSC[int(m.group(2))], ic.group(1) if ic else 'P'
    if m and m.group(1) == 'CB' and int(m.group(2)) in CB: return CB[int(m.group(2))], ic.group(1) if ic else 'P'
    return 60, 'P'
def chunks(lines, n=380):
    res = []
    for l in lines:
        while len(l) > n:                                          # parseCard drops a residual line over 400 characters
            k = max(l.rfind('。', 0, n), l.rfind(' ', 0, n), n // 2)
            res.append(l[:k + 1].strip()); l = l[k + 1:].strip()
        if l: res.append(l)
    return res
def clone(src, r):
    c = json.loads(json.dumps(src)); c['id'] = r['id']; sg, bl = place(r)
    c['saga'], c['block'] = sg, bl; c['image'] = r['id'] + '.png'
    c['note'] = 'Reprint of %s (same name, text and stats in the master database); added by tools/import_master.py.' % src['id']
    if r.get('rarity') not in (None, '', '-', '－'): c['rcode'] = RCODE.get(r['rarity'], r['rarity'])
    return c
def build(r):
    if r['type'] not in TYPES: return None
    head = r.get('canonical_number')
    if head and head != r['id'] and head in lib and not lib[head].get('note', '').startswith('Reprint of') and lib[head]['type'] == r['type']:
        return clone(lib[head], r)
    cols = r.get('color') or []; sg, bl = place(r)
    ctype = r['type']; r = dict(r, type='Nexus' if ctype == 'Contract Nexus' else ctype)      # the library has no "Contract Nexus" type: Nexus + mechanic
    jpt = '' if (r.get('text_jp') or '-').strip() in ('', '-') else r['text_jp'].strip()
    en_t = (r.get('text_en') or '').strip()
    text = en_t or jpt
    if text.lstrip().startswith('{{#tag:') and text.count('{{') > text.count('}}'): text = text.rstrip() + '\n}}'      # the source lost the closing braces of a tabber
    levels = [{'cores': l['cores'], 'bp': l['bp']} if l.get('bp') is not None else {'cores': l['cores']} for l in r.get('levels') or []]
    if r['type'] in ('Spirit', 'Ultimate', 'Brave'):
        levels = [l for l in levels if l.get('bp') is not None]
        keep = []                                                   # a level row whose cores do not rise is an extra state row (OC, Soul), not a level
        for l in levels:
            if r['type'] == 'Brave' or not keep or l['cores'] > keep[-1]['cores']: keep.append(l)
        levels = keep
    red = {}
    for ch in r.get('reduction_colors') or []:
        if ch in RED: red[RED[ch]] = red.get(RED[ch], 0) + 1
    for k, v in (r.get('fandom_reduction') or {}).items(): red[k] = v
    name_en = r.get('name_en'); twin = by_jp.get((r['name_jp'], r['type']))
    name = name_en or (twin['name'] if twin else r['name_jp'])
    fam = r.get('families_en') or [x for x in re.split(r'[・/]', r.get('family_jp') or '') if x and x != '-']
    sym = twin['symbols'] if twin and [l.get('bp') for l in twin['levels']] == [l.get('bp') for l in levels] else (
        sum((r.get('fandom_symbols') or {}).values()) if r.get('fandom_symbols') else (1 if r['type'] in ('Spirit', 'Ultimate') else 0))
    c = {'id': r['id'], 'name': name, 'name_jp': r['name_jp'], 'type': r['type'], 'color': cols[0] if cols else 'white',
         'cost': r.get('cost') or 0, 'reduction': red, 'symbols': sym, 'levels': levels, 'families': fam, 'text': text,
         'image': r['id'] + '.png', 'block': bl, 'saga': sg}
    if len(cols) > 1: c['colors'] = cols
    if ctype == 'Contract Nexus': c['mechanics'] = ['Contract Nexus']
    ic = re.fullmatch(r'<(\d+)>', r.get('block_icon') or '')
    if ic: c['bicon'] = [ic.group(1)]
    if r['type'] == 'Brave' and levels:
        m = re.search(r'コスト(\d+)以上', jpt); c['brave'] = {'bp': levels[-1]['bp'], 'costGe': int(m.group(1)) if m else 3}
        c['levels'] = levels[:1]
    res = chunks([' '.join(x.split()) for x in text.split('\n') if x.strip()])
    c['fxComplete'] = not res
    if res: c['residual'] = res
    notes = ['Added by tools/import_master.py from the master database (data/master): official card database + Fandom wiki; effects not wired yet.']
    if not name_en and not twin: notes.append('English name pending (Japanese name kept).')
    if not en_t and jpt: notes.append('English text pending (Japanese official text kept).')
    if 'official' not in r['sources']: notes.append('Fandom data only (no official page found); symbols from Fandom.')
    elif not (twin and sym == twin['symbols']): notes.append('Symbols unverified (not on the official page).')
    c['note'] = ' '.join(notes)
    if r.get('rarity') not in (None, '', '-', '－'): c['rcode'] = RCODE.get(r['rarity'], r['rarity'])
    return c
out, skip, bad = [], collections.Counter(), []
for r in M.values():
    new = r['library_status'] == 'missing'
    wrong = FIX and r['library_status'] == 'in_library' and r['id'] in lib and lib[r['id']].get('saga') == 60 and lib[r['id']].get('note', '').startswith('Reprint of') \
        and r.get('sources') and 'official' in r['sources']
    if new and r['id'] in lib: new = False                       # master library_status is a snapshot: never overwrite a card imported since
    if not (new or wrong): continue
    if r['class'] in ('stub', 'token'): skip[r['class']] += 1; continue
    c = build(r) if r.get('type') else None
    if not c: bad.append(r['id']); continue
    if wrong:
        o = lib[r['id']]
        if json.dumps({k: o.get(k) for k in ('cost', 'levels', 'color')}, sort_keys=True) == json.dumps({k: c.get(k) for k in ('cost', 'levels', 'color')}, sort_keys=True): continue
        c['note'] += ' Replaces a v0.210.0 clone whose stats differed from the official data.'
    out.append(c)
fixed = sum(1 for c in out if c['id'] in lib)
kinds = collections.Counter(('clone' if c['note'].startswith('Reprint') else 'complete' if c['fxComplete'] else 'partial') for c in out)
print('to write', len(out), '(replacing', fixed, 'wrong clones)', dict(kinds), 'skipped', dict(skip), 'invalid', bad[:10], len(bad))
print('saga spread', sorted(collections.Counter(c['saga'] for c in out).items()))
print('English pending: name', sum('English name pending' in c['note'] for c in out), 'text', sum('English text pending' in c['note'] for c in out))
if not DRY and out:
    tmp = os.path.join(ROOT, 'build_import_master.tmp.json'); json.dump(out, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools/build_cards.py'), '--update', tmp]); os.remove(tmp)
