#!/usr/bin/env python3
"""Keep data/import (staging) in step with data/cards after cards complete (replaces the manual chore of Lane K bundles).
  python3 tools/staging_sync.py          prune completed cards from staging, refresh the import report
  python3 tools/staging_sync.py --check  exit 1 when staging still holds a card that data/cards has (what tests I18/I30 would flag)
tools/import_fandom.py regenerates staging from the Fandom export, which DROPS what tools/apply_official.py wrote into the
records (official reductions, Ultimate icons ...; the 2026-11-02 CI failure of v0.207.0). So this tool runs the importer for the
report, then puts the previous record back for every id that is still staged: only the pruned ids change, new ids come from the importer.
A Partial card (v0.79.0 note) keeps its staging record, like the importer."""
import glob, json, os, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(ROOT)
CHECK = '--check' in sys.argv


def dump(d, style):
    return json.dumps(d, ensure_ascii=False, indent=1) if style == 'indent' else '[\n' + ',\n'.join(json.dumps(c, ensure_ascii=False) for c in d) + '\n]'


def load(path):
    s = open(path, encoding='utf-8', newline=None).read()
    d = json.loads(s)
    return d, ('indent' if dump(d, 'indent') == s.rstrip('\n') else 'line')


have = set()
for f in glob.glob('data/cards/saga-[0-9][0-9].json'):
    for c in json.load(open(f, encoding='utf-8')):
        if not (c.get('residual') and 'Partial card (v0.79.0' in (c.get('note') or '')):
            have.add(c['id'])
old = {}
for f in sorted(glob.glob('data/import/saga-[0-9][0-9].json')):
    d, style = load(f)
    old[f] = (d, style)
dup = sorted(c['id'] for d, _ in old.values() for c in d if c['id'] in have)
if CHECK:
    print(f'staging holds {len(dup)} card(s) that data/cards has' + (': ' + ', '.join(dup[:8]) if dup else ''))
    sys.exit(1 if dup else 0)
if not dup:
    print('staging is in step with data/cards')
    sys.exit(0)

report_path = 'data/import/report.json'
old_report = json.load(open(report_path, encoding='utf-8'))
subprocess.run([sys.executable, 'tools/import_fandom.py'], check=True, stdout=subprocess.DEVNULL)
for f, (d, style) in old.items():
    keep = [c for c in d if c['id'] not in have]
    new_d, new_style = load(f) if os.path.exists(f) else ([], style)
    prev = {c['id']: c for c in keep}
    merged = [prev.get(c['id'], c) for c in new_d]
    seen = {c['id'] for c in merged}
    merged += [c for c in keep if c['id'] not in seen and False]      # never resurrect an id the importer no longer stages
    open(f, 'w', encoding='utf-8', newline='\n').write(dump(merged, style) + '\n')
rep = json.load(open(report_path, encoding='utf-8'))
for k, v in old_report.items():                                       # keys the importer does not write (level_problems ...) travel on
    rep.setdefault(k, [x for x in v if not (isinstance(x, dict) and x.get('id') in have)] if k == 'level_problems' else v)
open(report_path, 'w', encoding='utf-8', newline='\n').write(json.dumps(rep, ensure_ascii=False, indent=1) + '\n')
print(f'pruned {len(dup)} card(s) from staging, report refreshed')
