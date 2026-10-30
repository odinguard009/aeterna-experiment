#!/usr/bin/env python3
"""R4/R5 head audit of the complete cards: the Japanese heads on the official page (data/sources/official-fields.json,
textJp) against the compiled `effects`. Checks only what a head states without doubt: the event trigger and the Lv range.
  python3 tools/audit_heads.py                 list mismatches (all complete cards)
  python3 tools/audit_heads.py --saga 1-40     only those sagas
  python3 tools/audit_heads.py --report        write docs/reports/head-audit.md
A match does not prove the effect is right (order and edge cases are not seen here)."""
import argparse, glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# JP head -> engine triggers that must ALL be present (a list of alternatives per slash part is not needed: every part must appear)
ALT = {'summon': {'SUMMONED'}, 'attack': {'ATTACKS', 'BATTLE_WIN', 'ALLY_LIFE_HIT'}, 'destroy': {'DESTROYED', 'LEAVES'}, 'block': {'BLOCKS', 'BATTLE_WIN', 'ATTACKS'},
       'end': {'END_STEP'}, 'manifest': {'MANIFEST'}, 'startatk': {'START_ATTACK', 'OPP_START_ATTACK'}}
HEADS = [('アタックステップ開始', 'startatk'), ('エンドステップ', 'end'), ('顕現', 'manifest'), ('召喚', 'summon'), ('配置時', 'summon'),
         ('アタック', 'attack'), ('ブロック', 'block'), ('破壊', 'destroy'), ('消滅', 'destroy')]
SKIP = ('アタック中', 'ブロック中', 'アタック/ブロック中', 'アタックステップ', 'バトル時', '合体アタック', 'メインステップ', 'ターン', 'ドローステップ', 'リフレッシュ', 'によるこの', 'によるこのスピリットの')


def parts(h):
    """『head』 text -> set of wanted trigger classes, or None when the head is not a plain event trigger."""
    if h in ('アタック中', 'ブロック中', 'アタック/ブロック中') or any(s in h for s in ('中', 'ステップ', 'ターン', 'バトル', '合体')) and '開始時' not in h and 'エンドステップ' not in h:
        return None
    if h.endswith('時') is False:
        return None
    h = re.sub(r'^(この|自分の|相手の)?(スピリット|ブレイヴ|ネクサス|アルティメット|スピリット/ブレイヴ)?の?', '', h)
    h = h.rstrip('時')
    if h.startswith('相手によ'):
        return None
    got = set()
    for tok in re.split(r'[/・]', h):
        for key, cls in HEADS:
            if key in tok:
                got.add(cls); break
        else:
            return None
    return got


def lvs(s):
    """'[Lv1-2]' / '[Lv2]' / '[Lv1][Lv2-3]' at the start of a clause -> list of levels."""
    out = []
    for a, b in re.findall(r'Lv(\d)(?:-(\d))?', s):
        out += list(range(int(a), int(b or a) + 1))
    return sorted(set(out))


def audit(c, r):
    probs = []
    effs = c.get('effects') or []
    trig = {}
    for e in effs:
        trig.setdefault(e.get('trigger'), []).append(e)
    for line in r['textJp']:
        for clause in re.split(r'(?=\[Lv\d)', line):
            m = re.match(r'((?:\[Lv[\d\-,]+\])+)?\s*『([^』]+)』', clause)
            if not m:
                continue
            want = parts(m.group(2))
            if not want:
                continue
            lv = lvs(m.group(1) or '')
            for cls in want:
                cand = [e for t in ALT[cls] for e in trig.get(t, []) if t != 'ATTACKS' or cls == 'attack' or e.get('alsoBlocks')]
                if not cand:
                    probs.append('head 『%s』 has no %s effect' % (m.group(2), '/'.join(sorted(ALT[cls]))))
                elif lv and len(want) == 1 and not any(e.get('lv') is None or sorted(e['lv']) == lv for e in cand):
                    probs.append('head 『%s』 Lv%s but effects have lv %s' % (m.group(2), lv, [e.get('lv') for e in cand]))
    # every BP figure in the Japanese text must appear in the compiled data (a Magic stores its BP in thousands)
    jp = re.sub(r'\[Lv[^\]]*\]', '', ''.join(r['textJp']).translate(str.maketrans('０１２３４５６７８９', '0123456789')))
    fx = json.dumps([effs, c.get('magic'), c.get('burst')], ensure_ascii=False)
    for m in sorted(set(re.findall(r'\d{4,5}', jp))):
        alts = [m, str(int(m) + 1)] + ([str(int(m) // 1000)] if c.get('type') == 'Magic' else [])      # N+1: "BP N or less" stored as selfBpGe N+1 under not
        if not any(re.search(r'(?<![\d.])%s(?![\d])' % x, fx) for x in alts):
            probs.append('BP figure %s in the text is not in the compiled effect' % m)
    # counts of 2 or more (cards, spirits, cores, points) in the text must appear as a number in the compiled effect (1 is the default)
    body = re.sub(r'BP\d+以[上下]|\d{4,}|コスト\d+|{[^}]*}', '', jp)
    have = set(re.findall(r'(\d+)', fx))  # also the 3 in a key such as oppReserveGe3
    dos = re.findall(r'"do": "(\w+)"', fx)  # N copies of one action also encode "N spirits"
    have |= {str(dos.count(d)) for d in set(dos)} | {str(dos.count(d) // 2) for d in set(dos)}  # a branch pair (if / else) halves it
    for m in sorted(set(re.findall(r'(\d+)(?=[枚体個点つ])', body)) - {'1'} - have):
        probs.append('count %s in the text is not a number in the compiled effect' % m)
    return probs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--saga', default='')
    ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    lo, hi = (int(x) for x in a.saga.split('-')) if a.saga else (0, 999)
    off = json.load(open(os.path.join(ROOT, 'data/sources/official-fields.json'), encoding='utf-8'))
    rows, n = [], 0
    for p in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json'))):
        for c in json.load(open(p, encoding='utf-8')):
            if c.get('fxComplete') is not True or not lo <= (c.get('saga') or 0) <= hi:
                continue
            r = off.get(c['id'])
            if not r:
                continue
            n += 1
            pr = audit(c, r)
            if pr:
                rows.append((c['id'], c['name'], pr))
    for i, nm, pr in rows:
        print(i, nm, '|', '; '.join(pr))
    print('%d complete cards checked, %d with a head mismatch' % (n, len(rows)))


if __name__ == '__main__':
    main()
