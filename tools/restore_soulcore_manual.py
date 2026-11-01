#!/usr/bin/env python3
"""Hand-picked Soul Core fixes for the cards restore_soulcore.py cannot place by itself (non-breaking spaces,
two icons in one clause). Idempotent; run after restore_soulcore.py --apply. Official `{soulcore}` text is the truth."""
import glob
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ICON = '(Soul Core)'
IDS = {'BS31-088', 'BS31-X04', 'BS32-071', 'BS32-X01', 'BS33-062', 'BS74-062',
       'BS64-X01', 'BS64-X03', 'BS65-X02', 'BS65-X04', 'BS66-X05', 'BS67-X07'}
PAIRS = [
    ('using as part', 'using ' + ICON + ' as part'),
    ('without on it', 'without ' + ICON + ' on it'),
    ('While there is on this', 'While there is ' + ICON + ' on this'),
    ('While is on this', 'While ' + ICON + ' is on this'),
    ('While is in your', 'While ' + ICON + ' is in your'),
    ('putting from this', 'putting ' + ICON + ' from this'),
    ('if is on this', 'if ' + ICON + ' is on this'),
    ('When was used', 'When ' + ICON + ' was used'),
    ('your or the opposing to', 'your ' + ICON + ' or the opposing ' + ICON + ' to'),
]
RULES = [(re.compile(re.escape(a).replace(r'\ ', r'[ \xa0]+')), b) for a, b in PAIRS]


def fix(s):
    for rx, b in RULES:
        s = rx.sub(b, s)
    return s


def main():
    n = 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-*.json')) + glob.glob(os.path.join(ROOT, 'data/import/saga-*.json'))):
        raw = open(path, encoding='utf-8').read()
        cards = json.loads(raw)
        hit = False
        for c in cards:
            if c['id'] not in IDS:
                continue
            t, r = c.get('text', ''), c.get('residual')
            c['text'] = fix(t)
            if r:
                c['residual'] = [fix(x) for x in r]
            if c['text'] != t or (r and c['residual'] != r):
                hit = True
                n += 1
        if hit:
            style = 'indent' if json.dumps(json.loads(raw), ensure_ascii=False, indent=1) == raw.rstrip('\n') else 'line'
            body = json.dumps(cards, ensure_ascii=False, indent=1) if style == 'indent' else '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in cards) + '\n]'
            open(path, 'w', encoding='utf-8', newline='\n').write(body + ('\n' if raw.endswith('\n') else ''))
    print('fixed', n)


if __name__ == '__main__':
    main()
