#!/usr/bin/env python3
"""Pack plan (plan K1, owner 2026-10-19): which compiler blockers to finish, in which order, so the most staged
cards become compilable per unit of work.

A card in review usually waits on several blockers (one per failing paragraph or wiki template), so finishing one
head alone unlocks only the cards for which it was the ONLY blocker. This tool runs compile_v2 `blockers()` over the
staged pool and orders the blockers greedily: at each step it takes the blocker whose finishing completes the most
cards given the blockers already taken (ties broken by how many open cards it touches). Consecutive steps are what a
session should bundle ("pack").

Caveat (upper bound): `blockers()` lists only the FIRST failing sentence of a paragraph, so a card can show one
blocker and still fail on a later sentence. The real unlock of a pack is measured by a scratch recompile after it is
built (`docs/ai/compiler-v2-plan.md`); this table gives the order, not a promise.

  python3 tools/pack_plan.py            -> writes docs/reports/pack-plan.md
  python3 tools/pack_plan.py --steps N  -> table length (default 60)
  python3 tools/pack_plan.py --block A  -> only cards of one block (Standard = A; owner 2026-10-21: Standard first)
                                           -> writes docs/reports/pack-plan-standard.md (other blocks: pack-plan-<block>.md)
  python3 tools/pack_plan.py --measure  -> adds the measured yield (tools/pack_measure.py: head swapped for a known head,
                                           body recompiled) and orders the packs by it (owner, 2026-10-20)"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compile_v2 as v2  # noqa: E402
import pack_measure as pm  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'docs/reports/pack-plan.md')
MAP = os.path.join(ROOT, 'data/glossary/wiki-rules-map.json')

FAMILIES = [
    ('step timing head', r'^no trigger: \((?:Your|Opposing|Either) \w+ Step\)|^no trigger: \(Start of|^no trigger: \(During Your Battle Phase\)|^no trigger: Flash - '),
    ('turn / while head', r'^no trigger: \((?:Your|Opposing) Turn\)|^no trigger: While |^no trigger: \(Permanent\)'),
    ('event trigger head', r'^no trigger: '),
    ('Burst', r'Burst'),
    ('keyword template', r'^wiki template'),
    ('duration / connective', r'^sentence: (?:during this|also, if|then|when this effect|\(once per)'),
    ('sentence verb', r'^sentence: |^v2 '),
    ('card kind', r'^(?:Ultimate|Brave|Magic|Rush on a Magic|Armor text|keyword)'),
]


def family(k):
    return next((n for n, rx in FAMILIES if re.search(rx, k)), 'other')


def zero_line(meas):
    """v0.106.0: how many measured rows delivered nothing, so the New column is not read as a forecast."""
    if not meas:
        return ('**No measurement in this report:** run with `--measure` before sizing a pack from the New column '
                '(a scratch recompile is the only honest estimate, item T.2).')
    rows = [(k, v) for k, v in meas.items() if v and v[0]]
    zero = [k for k, v in rows if v[1] == 0]
    if not rows:
        return '**No measurement in this report:** run with `--measure` before sizing a pack from the New column.'
    if not zero:
        return f'**Measured reality:** all {len(rows)} measured rows delivered at least one compiled card.'
    return (f'**Measured reality (read this before sizing a pack):** {len(zero)} of {len(rows)} measured rows delivered '
            f'**zero** compiled cards (Measured 0/x). The New column is a ceiling on what the text promises, never a forecast '
            f'of what a session will build; size the next pack with a scratch recompile (item T.2).')


def main(a):
    steps = int(a[a.index('--steps') + 1]) if '--steps' in a else 60
    pool = list(v2.v1.staged())
    block = a[a.index('--block') + 1] if '--block' in a else None
    out = OUT
    if block:
        pool = [c for c in pool if c.get('block') == block]
        out = os.path.join(ROOT, 'docs/reports', 'pack-plan-standard.md' if block == 'A' else f'pack-plan-{block}.md')
    ok, rev = v2.run(pool)
    revids = {r[0] for r in rev}
    v2.install()
    try:
        B = {c['id']: set(v2.blockers(c)) for c in pool if c['id'] in revids}
    finally:
        v2.uninstall()
    blk = {c['id']: c.get('block') for c in pool}
    rmap = json.load(open(MAP, encoding='utf8'))
    src = lambda k: next(('; '.join(f'{p} #{s}' if s else p for p, s in e['sources']) for e in rmap
                          if e['blocker'] == k or re.search(e.get('match', '^$'), k, re.I)), '')
    taken, done, rows = set(), set(), []
    for _ in range(steps):
        open_ = {i: s - taken for i, s in B.items() if i not in done}
        gain = collections.Counter(next(iter(r)) for r in open_.values() if len(r) == 1)
        touch = collections.Counter(k for r in open_.values() for k in r)
        if not touch: break
        k = max(touch, key=lambda x: (gain[x], touch[x]))
        taken.add(k)
        new = [i for i, r in open_.items() if r <= {k}]
        done |= set(new)
        rows.append((k, len(new), sum(1 for i in new if blk.get(i) == 'A'), len(done), touch[k]))
    meas = {}
    if '--measure' in a:
        for k, *_ in rows:
            meas[k] = pm.measure(pool, revids, B, k)
        ratios = collections.defaultdict(list)
        for k, r in meas.items():
            if r and r[0]: ratios[family(k)].append(r[1] / r[0])
        allr = sorted(x for v in ratios.values() for x in v) or [0.0]
        med = lambda v: sorted(v)[len(v) // 2]
        def ratio(k):
            r = meas.get(k)
            if r and r[0]: return r[1] / r[0], ''
            return (med(ratios[family(k)]) if ratios.get(family(k)) else med(allr)), '~'
    per = collections.Counter(min(len(s), 4) for s in B.values())
    fam = collections.Counter()
    for k, n, *_ in rows: fam[family(k)] += n
    L = ['# Pack plan' + (f' for block {block}' + (' (Standard)' if block == 'A' else '') if block else '') + ' (generated by tools/pack_plan.py; do not edit)', '',
         f'Staged pool {len(pool):,} cards; compile_v2 compiles {len(ok)} new ({"everything it can compile is already playable" if not ok else "not promoted yet"}), {len(B):,} stay in review. '
         f'Blockers per review card: ' + ', '.join(f'{k}{"+" if k == 4 else ""}: {v:,}' for k, v in sorted(per.items())) + f'; {len({k for s in B.values() for k in s}):,} distinct blockers.', '',
         '**Upper bound:** `blockers()` lists only the first failing sentence of each paragraph, so real unlocks are lower; '
         'measure each pack by a scratch recompile after it is built. Rule sources: `data/glossary/wiki-rules-map.json` '
         '(`python3 tools/wiki_rules.py --for "<blocker>"`, index `docs/reports/wiki-rules-index.md`).', '',
         zero_line(meas), '',
         '## Greedy order', '', '"New (upper)" = cards whose last open blocker is this row; "Block A (upper)" = of those, Standard '
         'block A; "Touches" = open cards that still list it. The "(upper)" marks are there because both columns are ceilings, not forecasts.', '',
         '| Step | Blocker | Family | New (upper) | Block A (upper) | Total | Touches |' + (' Measured | Est. real |' if meas else '') + ' Rule source |',
         '|---|---|---|---|---|---|---|' + ('---|---|' if meas else '') + '---|']
    est = {}
    for n, (k, new, a_, tot, t) in enumerate(rows, 1):
        extra = ''
        if meas:
            r, mark = ratio(k)
            est[k] = new * r
            m = meas[k]
            extra = f' {m[1]}/{m[0]} |' if m and m[0] else ' - |'
            extra += f' {mark}{est[k]:.0f} |'
        L.append(f'| {n} | {k.replace("|", "/")[:80]} | {family(k)} | {new} | {a_} | {tot:,} | {t} |{extra} {src(k) or "-"} |')
    if meas:
        L += ['', '## Measured order (real yield first)', '',
              'Measured = of the cards whose ONLY blocker is the row, how many compile once its head is swapped for a head the '
              'compiler already reads (`tools/pack_measure.py`); this tests the BODY under the head, the part the upper bound ignores '
              '(v0.70.0 step window: ~300 promised, +4 built). Est. real = New x measured ratio; "~" = no pure single-blocker sample or no '
              'head to swap, so the median ratio of the family is used. It is an estimate: the pack still has to teach the engine the head itself.', '',
              '| Rank | Blocker | Est. real | Upper bound | Next blockers revealed (bundle these) |', '|---|---|---|---|---|']
        order = sorted(rows, key=lambda r: -est[r[0]])[:20]
        for n, (k, new, *_r) in enumerate(order, 1):
            nx = meas[k][2] if meas[k] else []
            L.append(f'| {n} | {k.replace("|", "/")[:70]} | {est[k]:.0f} | {new} | ' + ('; '.join(f'{x.replace("|", "/")[:40]} ({c})' for x, c in nx) or '-') + ' |')
        top = order[:4]
        L += ['', f'**Suggested bundle for one release (owner, 2026-10-20: 3-4 packs per release):** ' + '; '.join(k.replace('|', '/')[:50] for k, *_ in top)
              + f' (about {sum(est[k] for k, *_ in top):.0f} cards by estimate).']
    L += ['', '## By family (cards completed inside the table)', '', '| Family | Cards |', '|---|---|']
    L += [f'| {f} | {v:,} |' for f, v in fam.most_common()]
    L += ['', 'Packs for sessions: take consecutive rows of one family (e.g. all step timing heads) so one engine change '
          'serves them together; then re-run this tool, since every finished blocker changes the order.', '']
    open(out, 'w', encoding='utf-8').write('\n'.join(L))
    print(f'pack_plan: {len(rows)} steps, {len(done):,} cards (upper bound) -> {os.path.relpath(out, ROOT)}')


if __name__ == '__main__':
    main(sys.argv[1:])
