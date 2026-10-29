#!/usr/bin/env python3
"""Apply the official card numbers (data/sources/official-fields.json) to data/cards and data/import.
  python3 tools/apply_official.py                         dry run: counts per field
  python3 tools/apply_official.py --field cost --list 20  dry run: first 20 changes of one field
  python3 tools/apply_official.py --field cost --apply    write one field (one commit per field)
Fields: cost, reduction, levels, colors, brave. Idempotent. The official page wins; nothing else in a card is touched.
reduction: only the six colour keys are replaced (other keys such as god / ultimate stay). levels: Spirit / Brave of equal
level count (bp + cores); a Nexus is left alone (the page lists a threshold the library models differently). colors: the `colors` list (the engine reads it), `color`
stays when it is in the list, else becomes the first official colour. Files keep their layout (indent 1 in data/cards,
one card per line in data/import)."""
import argparse, glob, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
COLORS = ('red', 'purple', 'green', 'white', 'yellow', 'blue')
FIELDS = ('cost', 'reduction', 'levels', 'colors', 'brave')


def dump(d, style):
    if style == 'indent':
        return json.dumps(d, ensure_ascii=False, indent=1)
    return '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in d) + '\n]'


def sound(lv):
    """Official level rows without gaps and rising (a row with None or a falling value is a misread table, left alone)."""
    return all(b is not None and k is not None for b, k in lv) and all(x[0] <= y[0] and x[1] <= y[1] for x, y in zip(lv, lv[1:]))


def changes(c, o, field):
    """-> (key, new value) pairs that bring card c in line with the official record o, for one field."""
    out = []
    if field == 'cost':
        if o['cost'] is not None and c.get('cost') != o['cost']:
            out.append(('cost', o['cost']))
    elif field == 'reduction':
        if c.get('type') != 'Magic':
            red = c.get('reduction') or {}
            new = {k: v for k, v in red.items() if k not in COLORS}
            new.update({k: v for k, v in (o['reductionBy'] or {}).items() if k in COLORS})
            if new != red:
                out.append(('reduction', new))
    elif field == 'levels':
        t, lv = c.get('type'), c.get('levels') or []
        if t in ('Spirit', 'Brave') and len(lv) == len(o['levels']) and lv and sound(o['levels']):
            new = [dict(l, bp=b, cores=k) for l, (b, k) in zip(lv, o['levels'])]
            if new != lv:
                out.append(('levels', new))
    elif field == 'colors':
        mine = sorted(c.get('colors') or ([c['color']] if c.get('color') else []))
        if o['colors'] and c.get('type') != 'Magic' and mine != sorted(o['colors']):
            out.append(('colors', list(o['colors'])))
            if c.get('color') not in o['colors']:
                out.append(('color', o['colors'][0]))
    elif field == 'brave':
        br = c.get('brave')
        if c.get('type') == 'Brave' and br:
            new = dict(br)
            if o['braveBp'] is not None:
                new['bp'] = o['braveBp']
            if o['combine']:
                new.update(o['combine'])
            if new != br:
                out.append(('brave', new))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--field', choices=FIELDS)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--list', type=int, default=0)
    ap.add_argument('--fields-file', default=os.path.join(ROOT, 'data/sources/official-fields.json'))
    a = ap.parse_args()
    off = json.load(open(a.fields_file, encoding='utf-8'))
    todo = [a.field] if a.field else list(FIELDS)
    if a.apply and not a.field:
        sys.exit('--apply needs --field (one commit per field)')
    total = {f: 0 for f in todo}
    shown = 0
    for d in ('data/cards', 'data/import'):
        for path in sorted(glob.glob(os.path.join(ROOT, d, 'saga-[0-9][0-9].json'))):
            s = open(path, encoding='utf-8').read()
            cards = json.loads(s)
            style = 'indent' if dump(cards, 'indent') == s.rstrip('\n') else 'line'
            assert dump(cards, style) == s.rstrip('\n'), path + ': layout not reproducible'
            dirty = False
            for c in cards:
                o = off.get(c['id'])
                if not o:
                    continue
                for f in todo:
                    ch = changes(c, o, f)
                    if not ch:
                        continue
                    total[f] += 1
                    if a.list and shown < a.list:
                        shown += 1
                        print(c['id'], f, {k: c.get(k) for k, _ in ch}, '->', dict(ch))
                    if a.apply:
                        for k, v in ch:
                            c[k] = v
                        dirty = True
            if dirty:
                open(path, 'w', encoding='utf-8').write(dump(cards, style) + ('\n' if s.endswith('\n') else ''))
    for f, n in total.items():
        print('%-10s %5d cards %s' % (f, n, 'changed' if a.apply else 'would change'))


if __name__ == '__main__':
    main()
