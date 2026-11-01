#!/usr/bin/env python3
"""Put back the "(Soul Core)" icon that the Fandom export dropped from card text.

The official page (data/sources/official-fields.json, `textJp`, icon = `{soulcore}`) is the truth for where a
Soul Core icon is printed. The Fandom English text lost every inline icon and left a gap ("besides , from",
"gains  (an extra ...)", "()"). A card is patched only when the number of gaps equals the number of icons
missing from the English text, so a card with some other lost icon (colour symbols) is listed, never guessed.

  python3 tools/restore_soulcore.py            dry run: counts, and the cards that need a manual look
  python3 tools/restore_soulcore.py --apply    write data/cards and data/import (text + residual)
  python3 tools/restore_soulcore.py --list N   dry run: show N patched texts
"""
import argparse
import glob
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OFFICIAL = os.path.join(ROOT, 'data/sources/official-fields.json')
ICON = '(Soul Core)'
# a gap = double space between a letter and a word, a space before , or . , or empty brackets
GAP = re.compile(r'(?<=[A-Za-z]) {2}(?=\S)|(?<=\S) +(?=[,.])|(?<!\d )\(\s*\)')


# phrases where the icon was the noun and no double space was left ("without on it", "if is in your Reserve")
WORDS = re.compile(r"(?<=without )(?=on it)|(?<=with )(?=on it)|(?<=has no )(?=on it)|(?<=have no )(?=on it)|(?<=no )(?=on (?:it|this))|(?<=if )(?=is (?:in|on))|(?<=the )(?=(?:is in|from your|from the))|(?<=there's )(?=in your)|(?<=there is )(?=in your)|(?<=besides )(?=from)|(?<=send the )(?=from)|(?<=with )(?=in your Reserve)", re.I)


def missing(card, off):
    jp = sum(t.count('{soulcore}') for t in off['textJp'])
    return jp - len(re.findall(r'soul ?core', card.get('text', ''), re.I))


# a gap that is a Soul Core by its words (used only when the plain gap count is ambiguous, e.g. a lost Advent/colour icon too)
CTX = re.compile(r"(?:\b(?:sending|putting|send|put|while|if|without|there is|there's|your|opposing|besides|the)\s*$)", re.I)
NEXT = re.compile(r"\s*(?:on (?:it|this|that)|from (?:this|your|the|it)|is (?:on|in)|in your|to (?:the|your)|or the|,|\.)")


def sites(text, need):
    """The gap matches to fill, or None when the count cannot be settled safely."""
    allg = list(GAP.finditer(text))
    w = len(WORDS.findall(text))
    if len(allg) + w == need:
        return allg
    pick = [m for m in allg if CTX.search(text[max(0, m.start() - 14):m.start()]) and NEXT.match(text[m.end():m.end() + 14])]
    return pick if len(pick) + w == need else None


def fill(m):
    s = m.group(0)
    if s.startswith('('):
        return ICON
    return ' ' + ICON + ('' if s.strip() == '' and m.string[m.end():m.end() + 1] in ',.' else ' ')


def patch_text(text, picked):
    out, last = [], 0
    for m in picked:
        out += [text[last:m.start()], fill(m)]
        last = m.end()
    return WORDS.sub(ICON + ' ', ''.join(out) + text[last:])


def patch_residual(text, picked, residual):
    """Residual paragraphs are whitespace-collapsed copies of the text: replay each gap by its neighbours."""
    out = list(residual)
    for m in picked:
        left = ' '.join(text[max(0, m.start() - 14):m.start()].split())
        right = ' '.join(text[m.end():m.end() + 14].split())
        if m.group(0).startswith('('):
            old, rep = '()', ICON
        elif right[:1] in (',', '.'):
            old, rep = left + right[:1], left + ' ' + ICON + right[:1]
        else:
            old, rep = left + ' ' + right, left + ' ' + ICON + ' ' + right
        for i, p in enumerate(out):
            if old in p:
                out[i] = p.replace(old, rep, 1)
                break
    return [WORDS.sub(ICON + ' ', x) for x in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--list', type=int, default=0)
    a = ap.parse_args()
    off = json.load(open(OFFICIAL, encoding='utf-8'))
    stats = {'patched': 0, 'manual': 0, 'ok': 0}
    manual, shown = [], 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-*.json')) + glob.glob(os.path.join(ROOT, 'data/import/saga-*.json'))):
        raw = open(path, encoding='utf-8').read()
        cards = json.loads(raw)
        changed = False
        for c in cards:
            o = off.get(c['id'])
            if not o:
                continue
            need = missing(c, o)
            if need <= 0:
                stats['ok'] += 1
                continue
            txt = c.get('text', '')
            picked = sites(txt, need)
            if picked is None:
                stats['manual'] += 1
                manual.append(c['id'])
                continue
            new = patch_text(txt, picked)
            stats['patched'] += 1
            if a.list and shown < a.list:
                shown += 1
                print(c['id'], '|', new.replace('\n', ' ')[:220])
            if a.apply:
                if c.get('residual'):
                    c['residual'] = patch_residual(txt, picked, c['residual'])
                c['text'] = new
                changed = True
        if a.apply and changed:
            style = 'indent' if json.dumps(json.loads(raw), ensure_ascii=False, indent=1) == raw.rstrip('\n') else 'line'
            body = json.dumps(cards, ensure_ascii=False, indent=1) if style == 'indent' else '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in cards) + '\n]'
            open(path, 'w', encoding='utf-8', newline='\n').write(body + ('\n' if raw.endswith('\n') else ''))
    print(stats)
    print('manual look:', len(set(manual)), sorted(set(manual))[:40])


if __name__ == '__main__':
    main()
