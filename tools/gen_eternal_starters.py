"""Writes the Eternal starter-deck recipes (one per printed SDnn set) into packages/engine/src/04-decks.js between the
ETERNAL-STARTERS markers. Official copy counts are not in the repo, so each recipe is the set's own cards at 3 copies
(X cards 1), trimmed to exactly 40 by lowering the most expensive cards first. Sets with fewer than 14 unique cards are skipped."""
import json, glob, re, collections
cfg = open('packages/engine/src/00-config.js', encoding='utf8').read()
ids = lambda name: set(re.findall(r'"([^"]+)"', re.search(r'const ' + name + r' = new Set\(\[(.*?)\]\)', cfg, re.S).group(1)))
BANNED, LIMITED1 = ids('BANNED'), ids('LIMITED1')
sets = collections.defaultdict(list)
for f in sorted(glob.glob('data/cards/saga-*.json')):
    d = json.load(open(f, encoding='utf8'))
    for x in (d if isinstance(d, list) else d.get('cards', d)):
        m = re.match(r'(SD\d+)-', x['id'])
        if m and not x.get('token'): sets[m.group(1)].append(x)
CN = {'red': 'Red', 'purple': 'Purple', 'green': 'Green', 'white': 'White', 'yellow': 'Yellow', 'blue': 'Blue'}
lines = []
for sd in sorted(sets):
    cs = sets[sd]
    if len(cs) < 14: continue
    cap = lambda i: 0 if i.upper() in BANNED else 1 if i.upper() in LIMITED1 or '-X' in i else 3
    n = {c['id']: cap(c['id']) for c in cs}
    order = sorted(cs, key=lambda c: (-(c.get('cost') or 0), c['id']))
    while sum(n.values()) > 40:
        for c in order:
            if sum(n.values()) <= 40: break
            if n[c['id']] > 1 and '-X' not in c['id']: n[c['id']] -= 1
    for c in sorted(cs, key=lambda c: ((c.get('cost') or 0), c['id'])):      # a ban or a 1-copy limit freed slots: refill with the cheapest legal cards
        while sum(n.values()) < 40 and 0 < n[c['id']] < cap(c['id']): n[c['id']] += 1
    n = {k: v for k, v in n.items() if v > 0}
    if sum(n.values()) != 40: continue
    col = collections.Counter(c.get('color') for c in cs if c.get('color')).most_common(1)[0][0]
    sp = [c for c in cs if c['type'] == 'Spirit']
    # same rule as pickKey in 04-decks.js: most copies, then the smallest id (the test key_spirit KEY-2 checks it)
    key = min((c['id'] for c in sp if n.get(c['id'], 0) > 0), key=lambda i: (-n[i], i))
    rec = ', '.join(f"'{k}': {v}" for k, v in sorted(n.items()))
    lines.append(f"  eternalDeck('{sd.lower()}', '{CN.get(col, col)}: Starter Deck {sd}', {{{rec}}}, '{key}'),")
p = 'packages/engine/src/04-decks.js'
s = open(p, encoding='utf8').read()
a, b = '  /* ETERNAL-STARTERS begin (tools/gen_eternal_starters.py) */\n', '  /* ETERNAL-STARTERS end */\n'
blk = a + '\n'.join(lines) + '\n' + b
if a in s: s = s[:s.index(a)] + blk + s[s.index(b) + len(b):]
else:
    m = '  /* Internal fixtures (hidden, never listed)'
    assert m in s; s = s.replace(m, blk + m)
open(p, 'w', encoding='utf8').write(s)
print(len(lines), 'eternal starter decks')
