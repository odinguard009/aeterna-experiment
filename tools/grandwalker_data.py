#!/usr/bin/env python3
"""Grandwalker Nexus table from the OFFICIAL card database fields (data/sources/official-fields.json, no network).

Every Grandwalker Nexus (family 創界神, type Nexus) and every Contract Grandwalker Nexus (type missing in the official
fields, 《真・神託》) with its Oracle / Contract Oracle target (the 〔families＆cost〕 brackets after 《神託》), the two Core
Charge triggers, the products it was printed in, and for every target family the cards of BS44-BS77 / SD44-SD70 in the
library (data/cards), oldest first, with their completion state.

  python3 tools/grandwalker_data.py            -> data/kb/grandwalker-nexus.json + docs/reports/grandwalker-families.md
  python3 tools/grandwalker_data.py --check    -> exit 1 when the committed files are out of date

English names/families come from the Fandom export (data/sources/fandom-cards-bs01-bs77.json) and data/cards, only for display;
matching a card to a family always uses the official Japanese family names.
"""
import glob, json, os, re, sys, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OFF = os.path.join(ROOT, 'data/sources/official-fields.json')
FDM = os.path.join(ROOT, 'data/sources/fandom-cards-bs01-bs77.json')
OUT_JSON = os.path.join(ROOT, 'data/kb/grandwalker-nexus.json')
OUT_MD = os.path.join(ROOT, 'docs/reports/grandwalker-families.md')
OUT_TAB = os.path.join(ROOT, 'docs/reports/grandwalker-family-table.md')
MIN_SET = 44
SHARED_FRAC = 0.3   # a family targeted by this share of the Nexus cards of one kind is generic support (化神, 界渡, 眷属, 締皇), not the card's own family
ORACLE = re.compile(r'《(真・神託|新神託|神託)》((?:〔[^〕]*〕)+)')


def load_cards():
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/cards/saga-*.json'))):
        j = json.load(open(f)); a = j if isinstance(j, list) else j.get('cards', j)
        for c in (a if isinstance(a, list) else a.values()): out[c['id']] = c
    return out


def set_key(code):
    m = re.match(r'(BS|SD)(\d+)$', code)
    return (int(m.group(2)), 0 if m.group(1) == 'BS' else 1) if m else None


def products(rec):
    codes = []
    for p in rec.get('products') or []:
        m = re.match(r'\[(BS\d+|SD\d+)\]', p)
        if m and m.group(1) not in codes: codes.append(m.group(1))
    return codes


def parse_group(g):
    left, _, cond = g.partition('＆')
    toks = [t.strip() for t in left.split('/') if t.strip()]
    return {'raw': g, 'tokens_jp': toks, 'cond_jp': cond or None}


def build():
    off = json.load(open(OFF)); lib = load_cards()
    fd = {c['id']: c for c in json.load(open(FDM))['cards']}
    jp2en = collections.defaultdict(collections.Counter)    # pair JP/EN family names where both lists have the same length
    for cid, rec in off.items():
        fam_jp = [x for x in (rec.get('familiesJp') or '').split('・') if x]
        en = (lib.get(cid) or {}).get('families') or []
        if fam_jp and len(fam_jp) == len(en):
            for j, e in zip(fam_jp, en): jp2en[j][e] += 1
    en_of = lambda jp: jp2en[jp].most_common(1)[0][0] if jp in jp2en else None

    rows = []
    for cid, rec in off.items():
        fam = rec.get('familiesJp') or ''
        if '創界神' not in fam.split('・') or rec.get('type') not in ('Nexus', None): continue
        txt = ' '.join(rec['textJp']); m = ORACLE.search(txt)
        if not m: continue
        groups = [parse_group(g) for g in re.findall(r'〔([^〕]*)〕', m.group(2))]
        bullets = [b.strip() for b in txt.split('◆')[1:]]
        # the first bullets (up to the next 【/［ block) are the Core Charge triggers
        triggers = [re.split(r'\s*(?:［Lv|\[Lv|【|\{|Lv\d)', b)[0].strip() for b in bullets[:2]]
        prods = products(rec); keys = [set_key(p) for p in prods if set_key(p)]
        first = min(zip(keys, prods))[1] if keys else cid.split('-')[0]   # promo-only cards (CP/SP): the set of the card number
        cost_m = re.search(r'コスト(\d+)以上', m.group(2))
        rows.append({
            'id': cid, 'kind': 'Contract Grandwalker Nexus' if m.group(1) in ('真・神託', '新神託') else 'Grandwalker Nexus',
            'name_en': (fd.get(cid) or lib.get(cid) or {}).get('name'), 'name_jp': rec['nameJp'], 'color': (rec.get('colors') or [None])[0],
            'line_jp': [x for x in fam.split('・') if x != '創界神'], 'first_set': first, 'products': prods,
            'oracle_jp': m.group(1), 'oracle_min_cost': int(cost_m.group(1)) if cost_m else None, 'oracle_groups': groups,
            'core_charge_triggers_jp': triggers,
        })
    def order(r):
        k = set_key(r['first_set']) if r['first_set'] else (0, 0)
        return (-k[0], -k[1], r['id'])
    rows.sort(key=order)

    known = {x for rec in off.values() for x in (rec.get('familiesJp') or '').split('・') if x}   # real family names; other tokens are card kinds / cost texts
    for r in rows:
        for g in r['oracle_groups']:
            g['families_jp'] = [t for t in g['tokens_jp'] if t in known]
    kind_n = collections.Counter(r['kind'] for r in rows)
    uses = collections.Counter((t, r['kind']) for r in rows for t in r['oracle_groups'][0]['families_jp'])
    shared = {t for (t, k), n in uses.items() if n >= SHARED_FRAC * kind_n[k]}      # 化神/界渡 on many old Grandwalkers, 眷属/締皇 on every Contract one
    fam_cards = {}
    for r in rows:
        for g in r['oracle_groups']:
            for t in g['families_jp']:
                fam_cards.setdefault(t, None)
    for t in fam_cards:
        lst = []
        for cid, rec in off.items():
            if t not in (rec.get('familiesJp') or '').split('・'): continue
            s = set_key(cid.split('-')[0]); c = lib.get(cid)
            if not s or s[0] < MIN_SET or not c: continue
            lst.append((s, cid, c))
        lst.sort(key=lambda x: (x[0], x[1]))
        fam_cards[t] = [{'id': cid, 'name': c['name'], 'type': c['type'], 'cost': c.get('cost'), 'complete': bool(c.get('fxComplete'))} for _, cid, c in lst]
    for r in rows:
        for g in r['oracle_groups']:
            g['families_en'] = [en_of(t) for t in g['families_jp']]
            g['tokens_en'] = [en_of(t) for t in g['tokens_jp']]
    seen = set()
    for r in rows:     # newest Nexus first takes a card; each card is listed once
        g0f = r['oracle_groups'][0]['families_jp']
        own = [t for t in g0f if t not in shared] or [t for t in g0f if t not in ('眷属', '締皇', '化神')]   # fall back to shared-but-specific families
        r['own_families_jp'] = own
        ids = {}
        for t in own:
            for c in fam_cards[t]: ids.setdefault(c['id'], c)
        order_ids = sorted(ids, key=lambda i: (set_key(i.split('-')[0]), i))
        r['deck_cards'] = order_ids
        r['deck_incomplete'] = [i for i in order_ids if not ids[i]['complete']]
        self_open = [] if (lib.get(r['id']) or {}).get('fxComplete') else [r['id']]   # the Nexus card itself leads its queue
        r['order_cards'] = self_open + [i for i in order_ids if i not in seen and i != r['id'] and not ids[i]['complete']]   # open cards not already queued under a newer Nexus
        seen.update(order_ids)
    data = {'source': 'official card database fields (data/sources/official-fields.json)', 'count': len(rows),
            'nexus': rows, 'shared_families_jp': sorted(shared), 'family_en': {t: en_of(t) for t in fam_cards}, 'family_cards': fam_cards}
    return data


def family_table(d):
    off = json.load(open(OFF)); nm = d['family_en']; lib = load_cards()
    tot = collections.Counter(); late = collections.Counter(); inlib = collections.Counter(); done = collections.Counter(); done_all = collections.Counter()
    for cid, rec in off.items():
        k = set_key(cid.split('-')[0])
        for t in set((rec.get('familiesJp') or '').split('・')):
            tot[t] += 1
            c = lib.get(cid)
            if c and c.get('fxComplete'): done_all[t] += 1
            if k and k[0] >= MIN_SET:
                late[t] += 1
                if c: inlib[t] += 1
                if c and c.get('fxComplete'): done[t] += 1
    L = ['# Grandwalker Nexus x target family: card counts', '',
         '_Generated by `python3 tools/grandwalker_data.py` from the official fields. Do not edit._', '',
         'Counts are card numbers (ids) in `data/sources/official-fields.json`: every printing with its own id counts (reprints, promo, SD decks). '
         '"Complete" = `fxComplete` in `data/cards` (every printed effect runs). "SD44-BS77" = id set number 44 or higher; "All series" = every set including BS01-BS43 and SD01-SD43. Shared = generic support family.', '',
         '| Grandwalker Nexus | Kind | Family (JP) | Family (EN) | Shared | Cards SD44-BS77 | In Aeterna library (SD44-BS77) | Complete in Aeterna (SD44-BS77) | Complete %  | Cards all series | Complete in Aeterna (all series) |', '|---|---|---|---|---|---|---|---|---|---|']
    for r in d['nexus']:
        for t in r['oracle_groups'][0]['families_jp']:
            L.append(f'| {r["id"]} {r["name_en"] or r["name_jp"]} | {"Contract" if r["kind"].startswith("Contract") else "Grandwalker"} | {t} | {nm.get(t) or "-"} | {"yes" if t in d["shared_families_jp"] else ""} | {late[t]} | {inlib[t]} | {done[t]} | {round(100 * done[t] / late[t]) if late[t] else 0}% | {tot[t]} | {done_all[t]} |')
        if not r['oracle_groups'][0]['families_jp']: L.append(f'| {r["id"]} {r["name_en"] or r["name_jp"]} | {"Contract" if r["kind"].startswith("Contract") else "Grandwalker"} | (cost only) | - | | - | - | - | - | - | - |')
    return '\n'.join(L) + '\n'


def report(d):
    nm = {t: (d['family_en'].get(t) or t) for t in d['family_cards']}
    L = ['# Grandwalker Nexus and their target families', '',
         '_Generated by `python3 tools/grandwalker_data.py` from the official fields (no network). Do not edit._', '',
         f'{d["count"]} Grandwalker Nexus cards, newest first printing first. "Target" = the 〔...〕 after 《神託》 / 《真・神託》 (Core Charge target). '
         '"Own families" = target families that are not shared (shared: ' + ', '.join(f'{t} ({nm.get(t, t)})' for t in d['shared_families_jp']) + '). '
         '"Deck cards" = library cards of BS44-BS77 / SD44-SD70 in the own families (a card can serve several Nexus); "Open" = not complete yet; "Queue" = open cards not already queued under a newer Nexus (the Lane K order).', '',
         '| First set | Card | Kind | Colour | Own families | All target families | Other target groups | Deck cards | Open | Queue |', '|---|---|---|---|---|---|---|---|---|---|']
    for r in d['nexus']:
        g0 = r['oracle_groups'][0]
        allf = ' / '.join(f'{t} ({nm[t]})' for t in g0['families_jp']) or '-'
        own = ' / '.join(f'{t} ({nm[t]})' for t in r['own_families_jp']) or '-'
        extra = '; '.join(g['raw'] for g in r['oracle_groups'][1:]) or '-'
        L.append(f'| {r["first_set"]} | {r["id"]} {r["name_en"] or r["name_jp"]} | {"Contract" if r["kind"].startswith("Contract") else "Grandwalker"} | {r["color"]} | {own} | {allf} | {extra} | {len(r["deck_cards"])} | {len(r["deck_incomplete"])} | {len(r["order_cards"])} |')
    q = sum(len(r['order_cards']) for r in d['nexus'])
    L += ['', f'Queue total: {q} open cards (each once).', '', '## Lane K queue per Nexus (newest Nexus first; cards oldest series first)', '']
    for r in d['nexus']:
        if not r['order_cards']: continue
        L.append(f'### {r["id"]} {r["name_en"] or r["name_jp"]}: {len(r["order_cards"])} in queue')
        L.append('')
        L.append(', '.join(r['order_cards']))
        L.append('')
    L += ['## Cards per target family (BS44+ / SD44+, oldest first)', '']
    for t, cards in d['family_cards'].items():
        done = sum(c['complete'] for c in cards)
        L.append(f'- **{t} ({nm[t]})**: {done}/{len(cards)} complete' + (' (shared)' if t in d['shared_families_jp'] else ''))
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    d = build(); js = json.dumps(d, ensure_ascii=False, indent=1) + '\n'; md = report(d); tab = family_table(d)
    if '--check' in sys.argv:
        ok = os.path.exists(OUT_JSON) and open(OUT_JSON).read() == js and os.path.exists(OUT_MD) and open(OUT_MD).read() == md and os.path.exists(OUT_TAB) and open(OUT_TAB).read() == tab
        sys.exit(0 if ok else 1)
    open(OUT_JSON, 'w').write(js); open(OUT_MD, 'w').write(md); open(OUT_TAB, 'w').write(tab)
    kinds = collections.Counter(r['kind'] for r in d['nexus'])
    print(d['count'], dict(kinds), 'families', len(d['family_cards']))
