#!/usr/bin/env python3
"""Stale-reference check for tests (v0.31.1): finds tests that still use something src/ no longer has.

Runs in seconds and needs no browser, so it lives in the pre-push hook. It catches the class of failure that
otherwise only shows up in the 20-minute GitHub Regression run:
  1. a function / constant removed from the script parts but still named in tests/ (e.g. BS.hoverHTML after v0.31);
  2. a button label removed or reworded in the script parts but still asserted in tests/;
  4. (v0.50.1 lesson) any other UI text literal removed or reworded in the script parts but still asserted in tests/
     (e.g. 'Banished cards' -> 'Removed Zone (banished cards)' broke legacy check 390 in the v0.50.0 Regression);
  3. a label compared case-sensitively in a Python suite that is not in Title Case (buttons are drawn with
     titleCase since v0.31, so 'Not legal' in btns(...) never matches 'Not Legal').

Usage:  python3 tools/check_renames.py [BASE]     BASE = git ref to diff against (default: origin/main)
Exit 1 and one line per finding when something is stale.
"""
import glob, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
TEST_FILES = [f for f in glob.glob('tests/**/*', recursive=True) if f.endswith(('.py', '.mjs', '.js')) and '/fixtures/' not in f]
SRC = '\n'.join(open(f, encoding='utf8').read() for f in sorted(glob.glob('packages/engine/src/*.js') + glob.glob('apps/web/src/*.js')))
TESTS = {f: open(f, encoding='utf8').read() for f in TEST_FILES}

# same rule as titleCase() in packages/engine/src/00-config.js
MINOR = set('a an the and or nor but of to in on at by for from with as per vs via into'.split())
def title_case(s):
    out, first = [], True
    for w in s.split(' '):
        m = re.match(r'^([^A-Za-z]*)([a-z])(.*)$', w)
        if m and (first or (m.group(2) + m.group(3)) not in MINOR): w = m.group(1) + m.group(2).upper() + m.group(3)
        if re.search('[A-Za-z]', w): first = False
        out.append(w)
    return ' '.join(out)

def removed_lines(base):
    # text=True needs the encoding spelled out: diff hunks carry the card data's Japanese text (a cp1252 read would die in the reader thread)
    try: diff = subprocess.run(['git', 'diff', base, '--', 'packages/engine/src', 'apps/web/src'], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True).stdout
    except Exception: return []
    return [l[1:] for l in diff.splitlines() if l.startswith('-') and not l.startswith('---')]

def where(pattern):
    rx = re.compile(pattern)
    return [f'{f}:{i}' for f, t in TESTS.items() for i, line in enumerate(t.splitlines(), 1) if rx.search(line)]

findings = []
base = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
gone = removed_lines(base)

# 1. names defined in removed lines that src no longer defines anywhere
names = set()
for l in gone:
    # top-level definitions only (no indentation): locals inside a removed function are not part of the API
    names.update(re.findall(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', l))
    names.update(re.findall(r'^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=', l))
for n in sorted(names):
    if len(n) < 4 or re.search(r'\b(function\s+%s\b|(const|let|var)\s+%s\b)' % (re.escape(n), re.escape(n)), SRC): continue
    for loc in where(r'\b%s\b' % re.escape(n)): findings.append(f'{loc}: uses {n}, which the script parts no longer defines')

# 2. label literals from removed lines that no longer appear in src
for l in gone:
    for lab in re.findall(r"label:\s*['`]([^'`$]{4,})['`$]", l):
        lab = lab.strip()
        if len(lab) < 4 or lab in SRC: continue
        for loc in where(re.escape(lab)): findings.append(f'{loc}: asserts the old label "{lab}"')

# 4. other text literals (quoted or template text with a space, 8+ chars) removed from src and no longer in it
for l in gone:
    if l.lstrip().startswith(('//', '*')): continue
    l = re.sub(r'\s//\s.*$', '', l)      # a trailing code comment is not UI text (stripping comments to save script bytes must not trip this)
    for q, body in re.findall(r"(['\"`])((?:(?!\1).){8,120})\1", l):
        for seg in re.split(r'\$\{[^}]*\}', body):
            seg = seg.strip(' :,.()')
            if len(seg) < 8 or ' ' not in seg or not re.search('[A-Za-z]{3}', seg) or seg in SRC: continue
            for loc in where(re.escape(seg)): findings.append(f'{loc}: asserts the old text "{seg}"')

# 3. case-sensitive label comparisons in Python suites that are not Title Case
CS = [r"""(['"])([^'"\n]{3,60})\1\s+(?:not\s+)?in\s+(?:' '\.join\(btns|pg\.inner_text\(['"]#(?:modal-actions|pick-btns|peek-btns)['"]\))""",
      r"""\b(?:wait_btn|press)\(\s*pg2?\s*,\s*(['"])([^'"\n]{3,60})\1"""]
for f, t in TESTS.items():
    if not f.endswith('.py'): continue
    for i, line in enumerate(t.splitlines(), 1):
        for rx in CS:
            for m in re.finditer(rx, line):
                s = m.group(2)
                # press() uses has_text (case-insensitive) in most suites, but wait_btn() compares exactly: flag both, the fix is free
                if re.search(r'[a-z]', s) and title_case(s) != s:
                    findings.append(f'{f}:{i}: label "{s}" is drawn as "{title_case(s)}"')

for x in sorted(set(findings)): print(x)
if findings: print(f'[check_renames] {len(set(findings))} stale reference(s) in tests/'); sys.exit(1)
print('[check_renames] ok')
