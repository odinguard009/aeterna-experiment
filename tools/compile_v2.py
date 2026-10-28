#!/usr/bin/env python3
"""Effect compiler v2 (v0.61.0, plan: docs/ai/compiler-v2-plan.md).

v1 (tools/compile_effects.py) matches whole sentences. v2 keeps v1 untouched and runs on top of it:
  1. every sentence is tried with v1 first, so a card v1 compiles comes out byte-identical (test U611);
  2. a sentence v1 rejects goes through a small clause grammar: optional head ("You can", "During this turn,",
     "Then,"), verb, and ONE selector noun phrase ("an opposing Cost 3 or less exhausted Spirit/Ultimate",
     "up to two opposing Spirits with 5000 BP or less") that every verb shares;
  3. "Target <selector>. <Verb> it." pairs are joined into one clause;
  4. level heads written as [LV1-2-3] / [LV2-3] are read as [LV1][LV2][LV3] / [LV2][LV3].
A clause maps to an existing engine action only when the action supports every filter of the selector;
otherwise the card stays in review with a reason "v2 <verb>: <what is missing>", which is what the
measurement (--report) counts. No new engine actions here.

  python3 tools/compile_v2.py                       -> summary over the staged pool
  python3 tools/compile_v2.py --saga 17 --out build/compiled.json
  python3 tools/compile_v2.py --report docs/reports/compile-v2-report.md
"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compile_effects as v1  # noqa: E402

Review = v1.Review
_V1_ACTION_OF = v1.action_of
_V1_SENTENCES = v1.sentences
_V1_COMPILE = v1.compile_card
_V1_CLEAN = v1.clean

NUMW = {'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6}
COL = r'(?:red|purple|green|white|yellow|blue)'


def low(s):
    """lower-case everything except quoted names (families keep their case)"""
    parts = re.split(r'("[^"]*")', s)
    return ''.join(p if p.startswith('"') else p.lower() for p in parts)


def n_of(w):
    w = w.strip()
    if w.isdigit(): return int(w)
    if w not in NUMW: raise Review('v2 number: ' + w)
    return NUMW[w]


def bpv(s): return int(s.replace(',', ''))


# ---------- selector: one noun phrase for every verb ----------
SEL = re.compile(
    r'^(?P<count>an|a|one|two|three|up to (?:one|two|three|\d)|all|every|each|any number of)?\s*'
    r'(?P<owner>opposing|of the opposing|your|one of your|of your)\s+'
    r'(?P<mods>(?:(?:cost \d+ or (?:less|more)|cost \d+(?:/\d+)+|non-attacking|\d[\d,]* ?bp or (?:less|more)|exhausted|refreshed|attacking/blocking|attacking|blocking|lv\d(?:/lv?\d)*|'
    + COL + r'(?:/' + COL + r')*|"[^"]+" family|non-braved|braved)\s+)*)'
    r'(?P<kind>spirits?/ultimates?|spirits?/nexus(?:es)?|spirits?|ultimates?|nexus(?:es)?|cards?)'
    r'(?P<post>(?:,? (?:with|that ha(?:s|ve)) [^,]+?|,? that is blocking this spirit)*)'
    r'(?P<own> you control| the opponent controls| your opponent controls)?$')


def selector(np):
    """noun phrase -> dict(count, owner, kind, filters) or None when it is not a selector"""
    m = SEL.match(np.strip())
    if not m: return None
    cw = (m.group('count') or 'a').replace('up to ', '')
    upto = (m.group('count') or '').startswith('up to')
    if cw in ('all', 'every', 'each', 'any number of'): count = 'all'
    else: count = n_of(cw)
    owner = 'opp' if 'opposing' in m.group('owner') else 'own'
    kind = m.group('kind')
    kind = 'spirit' if re.match(r'spirits?(/ultimates?)?$', kind) else 'any' if 'nexus' in kind and 'spirit' in kind else \
        'nexus' if 'nexus' in kind else 'ultimate' if 'ultimate' in kind else 'card'
    f = {}
    for x in re.findall(r'cost \d+ or (?:less|more)|cost \d+(?:/\d+)+|non-attacking|\d[\d,]* ?bp or (?:less|more)|exhausted|refreshed|attacking/blocking|attacking|blocking|lv\d(?:/lv?\d)*|'
                        + COL + r'(?:/' + COL + r')*|"[^"]+" family|non-braved|braved', m.group('mods')):
        if x == 'non-attacking': f['notAttacking'] = True; continue      # v0.168
        mm = re.fullmatch(r'cost (\d+(?:/\d+)+)', x)
        if mm: f['costIn'] = [int(y) for y in mm.group(1).split('/')]; continue      # v0.168 "Cost 1/2" = cost 1 or 2
        mm = re.match(r'cost (\d+) or (less|more)', x)
        if mm: f['costLe' if mm.group(2) == 'less' else 'costGe'] = int(mm.group(1)); continue
        mm = re.match(r'(\d[\d,]*) ?bp or (less|more)', x)
        if mm: f['bpLe' if mm.group(2) == 'less' else 'bpGe'] = bpv(mm.group(1)); continue
        mm = re.match(r'"([^"]+)" family', x)
        if mm: f['family'] = mm.group(1); continue
        if re.match(COL, x): f['color'] = x.split('/'); continue
        f[x] = True
    if re.search(r'that is blocking this spirit', m.group('post') or ''): f['blockingSelf'] = True      # v0.168
    for x in re.findall(r'(?:with|that ha(?:s|ve)) ([^,]+?)(?=,? (?:with|that ha|that is blocking)|$)', m.group('post') or ''):
        x = x.strip()
        mm = re.match(r'(\d[\d,]*) ?bp or (less|more)$', x)
        if mm: f['bpLe' if mm.group(2) == 'less' else 'bpGe'] = bpv(mm.group(1)); continue
        mm = re.match(r'(?:a )?cost (?:of )?(\d+) or (less|more)$', x)
        if mm: f['costLe' if mm.group(2) == 'less' else 'costGe'] = int(mm.group(1)); continue
        mm = re.match(r'(?:the )?(lowest|highest) cost$', x)
        if mm: f['costRank'] = mm.group(1); continue
        if re.match(r"(?:a )?cost equal (?:to )?or (?:inferior|less) (?:to|than) (?:this spirit'?s?|that of this spirit)(?: cost)?$", x): f['costLeSelf'] = True; continue
        if re.match(r"(?:a )?bp equal (?:to )?or (?:inferior|less) (?:to|than) (?:the attacking spirit'?s?|that of the attacking spirit)(?: bp)?$", x): f['bpLeAttacker'] = True; continue
        if re.match(r"bp equal (?:to )?or (?:inferior|less) (?:to|than) (?:this (?:spirit|ultimate)'?s?|that of this (?:spirit|ultimate))(?: bp)?$", x): f['bpLeSelf'] = True; continue      # v0.76
        if re.match(r'(?:the )?same bp as this (?:spirit|ultimate)$', x): f['bpEqSelf'] = True; continue
        mm = re.match(r'(two|three|\d) or more symbols$', x)
        if mm: f['symbolsGe'] = n_of(mm.group(1)); continue
        mm = re.match(r'(?:a )?cost equal (?:to )?or (?:inferior|less) (?:to|than) the (?:total )?number of (?:(nexus(?:es)?)|"([^"]+)" family spirits?)(?: you control)?$', x)
        if mm: f['costLePer'] = {'type': 'Nexus'} if mm.group(1) else {'type': 'Spirit', 'family': mm.group(2)}; continue
        mm = re.match(r'(one|two|three|\d) cores? or (?:less|fewer) on (?:it|them)$|(?:only )?(one|1) core on (?:it|them)$', x)
        if mm: f['coresLe'] = n_of(mm.group(1) or mm.group(2)); continue
        f['other:' + x] = True
    return {'count': count, 'upto': upto, 'owner': owner, 'kind': kind, 'f': f}


def need(verb, sel, allowed):
    """Review unless the selector uses only filters the engine action supports"""
    extra = [k for k in sel['f'] if k not in allowed]
    if extra: raise Review(f'v2 {verb}: filter ' + '+'.join(sorted(k.split(':')[0] for k in extra)))


def one_target(verb, sel, kinds=('spirit',)):
    if sel['owner'] != 'opp': raise Review(f'v2 {verb}: own target')
    if sel['kind'] not in kinds: raise Review(f'v2 {verb}: target kind {sel["kind"]}')


# ---------- verbs ----------
def v_destroy(sel):
    one_target('destroy', sel, ('spirit', 'nexus'))
    if sel['count'] == 'all' and sel['kind'] == 'spirit' and not sel['upto']:      # v0.75 DESTROY all: one BP or core bound only
        need('destroy', sel, ('bpLe', 'coresLe'))
        keys = [k for k in ('bpLe', 'coresLe') if k in sel['f']]
        if len(keys) != 1: raise Review('v2 destroy: count all ' + ('no bound' if not keys else 'two bounds'))
        return [{'do': 'DESTROY', 'all': True, keys[0]: sel['f'][keys[0]]}]
    if sel['count'] != 1: raise Review('v2 destroy: count ' + str(sel['count']))
    if sel['kind'] == 'nexus':
        need('destroy', sel, ())
        return [{'do': 'DESTROY', 'nexus': True}]
    B = ('bpLe', 'costLe', 'coresLe', 'costRank', 'costLeSelf', 'bpLeAttacker', 'bpLeSelf', 'bpEqSelf', 'symbolsGe', 'costLePer', 'costIn')      # v0.76: the last four; v0.168 costIn
    need('destroy', sel, B + ('exhausted', 'blockingSelf'))      # v0.68: exhausted only (DESTROY exhaustedOnly, 02l)
    keys = [k for k in B if k in sel['f']]
    if not keys and sel['f'].get('exhausted'): return [{'do': 'DESTROY', 'exhaustedOnly': True}]      # v0.75: "an opposing exhausted Spirit" (any BP)
    if len(keys) != 1: raise Review('v2 destroy: ' + ('no bound' if not keys else 'two bounds'))
    k = keys[0]
    if k == 'coresLe' and sel['f'][k] > 10: raise Review('v2 destroy: cores')
    a = {'do': 'DESTROY', k: sel['f'][k]}
    if sel['f'].get('exhausted'): a['exhaustedOnly'] = True
    if sel['f'].get('blockingSelf'): a['blockingSelf'] = True      # v0.168
    return [a]


def v_return(sel, where):
    one_target('return', sel, ('spirit', 'any', 'nexus'))
    if sel['count'] != 1: raise Review('v2 return: count ' + str(sel['count']))
    need('return', sel, ('costLe', 'exhausted', 'bpLe', 'attacking', 'notAttacking'))
    a = {'do': 'BOUNCE_OPP', 'to': where, 'kind': sel['kind']}
    if 'costLe' in sel['f']: a['costLe'] = sel['f']['costLe']
    if 'bpLe' in sel['f']: a['bpLe'] = sel['f']['bpLe']          # v0.68 (02l)
    if sel['f'].get('attacking'): a['attackingOnly'] = True
    if sel['f'].get('notAttacking'): a['notAttacking'] = True      # v0.168
    if sel['f'].get('exhausted'): a['exhaustedOnly'] = True
    return [a]


def v_exhaust(sel, heavy):
    verb = 'heavy exhaust' if heavy else 'exhaust'
    one_target(verb, sel)
    if sel['count'] == 'all' or not 1 <= sel['count'] <= 3: raise Review(f'v2 {verb}: count {sel["count"]}')
    if sel['count'] > 1 and not sel['upto']: raise Review(f'v2 {verb}: exactly {sel["count"]} (engine: up to)')
    if heavy:
        need(verb, sel, ())
        return [{'do': 'HEAVY_EXHAUST_OPP', 'n': sel['count']}]
    need(verb, sel, ('costLe',))
    a = {'do': 'EXHAUST_OPP', 'n': sel['count']}
    if 'costLe' in sel['f']: a['costLe'] = sel['f']['costLe']
    return [a]


def v_bp_minus(sel, n):
    one_target('bp minus', sel)
    if sel['count'] != 1: raise Review('v2 bp minus: count ' + str(sel['count']))
    need('bp minus', sel, ())
    return [{'do': 'BP_MINUS', 'n': v1.bpm(str(n))}]


def v_remove(sel):
    one_target('remove', sel)
    if sel['count'] == 'all' or sel['upto']: raise Review('v2 remove: count ' + str(sel['count']))
    need('remove', sel, ('costLe', 'exhausted'))
    a = {'do': 'SEND_REMOVED', 'n': sel['count']}
    if 'costLe' in sel['f']: a['costLe'] = sel['f']['costLe']
    if sel['f'].get('exhausted'): a['exhaustedOnly'] = True
    return [a]


def v_cores_to_reserve(k, sel):
    one_target('send cores', sel)
    need('send cores', sel, ())
    if sel['count'] == 1: return [{'do': 'OPP_CORES_TO_RESERVE', 'targets': 1, 'each': k}]
    raise Review('v2 send cores: count ' + str(sel['count']))


THIS_TURN = r'(?: (?:during|until the end of) (?:this|the) turn)?'
HAND = r"(?:the|its owner'?s|their|the owner'?s|the opposing) hand"
BOTTOM = r"(?:the )?(?:bottom of (?:the|its owner'?s|their|the opposing) deck|(?:opposing |their )?deck ?bottom)"


def clause(x):
    """one lower-cased clause without the head -> actions"""
    m = re.match(r'^refresh one of your (.+)$', x)
    if m:      # v0.168 "Target one of your <X>. Refresh it." arrives here as "refresh one of your <X>" (TARGET pair form)
        match, att = own_np(m.group(1))
        if att or 'costGe' in match: raise Review('v2 refresh: filter')
        return [{'do': 'REFRESH_SPIRIT', 'match': match}] if match else [{'do': 'REFRESH_SPIRIT'}]
    m = re.match(r'^destroy (.+?), and (effects of the destroyed spirit(?:/ultimates?)? can\'t activate|when (?:it )?destroys?,? draw (a|one|two) cards?)$', x)
    if m and selector(m.group(1)):      # v0.75: DESTROY noFx / thenDraw tails
        a = v_destroy(selector(m.group(1)))
        if m.group(3): a[0]['thenDraw'] = n_of(m.group(3))
        else: a[0]['noFx'] = True
        return a
    m = re.match(r'^(destroy|heavy exhaust|heavily exhaust|exhaust) (.+)$', x)
    if m:
        sel = selector(m.group(2))
        if sel:
            if m.group(1) == 'destroy': return v_destroy(sel)
            return v_exhaust(sel, m.group(1) != 'exhaust')
    m = re.match(r'^return (.+?) to ' + HAND + '$', x)
    if m and selector(m.group(1)): return v_return(selector(m.group(1)), 'hand')
    m = re.match(r'^return (.+?) to ' + BOTTOM + '$', x) or re.match(r'^put (.+?) (?:at|on|to) ' + BOTTOM + '$', x)
    if m and selector(m.group(1)): return v_return(selector(m.group(1)), 'deckBottom')
    m = re.match(r'^(?:remove|send) (.+?) (?:from (?:the )?game|to the removed zone)$', x)
    if m and selector(m.group(1)): return v_remove(selector(m.group(1)))
    m = re.match(r'^give (.+?) -(\d[\d,]*) ?bp' + THIS_TURN + '$', x) or re.match(r'^(.+?) (?:gets|gains|loses) -?(\d[\d,]*) ?bp' + THIS_TURN + '$', x)
    if m and selector(m.group(1)) and (x.startswith('give') or 'gets -' in x or 'gains -' in x or 'loses' in x):
        return v_bp_minus(selector(m.group(1)), bpv(m.group(2)))
    m = re.match(r"^send (a|one|two|three|four|five|\d) cores? from any opposing spirits?(?:\(s\))?(?:/ultimates?)? to (?:the|their|your opponent'?s) reserve$", x)
    if m and n_of(m.group(1)) <= 5: return [{'do': 'OPP_CORES_TO_RESERVE', 'total': n_of(m.group(1))}]      # v0.173: each core may come from a different Spirit (engine total form)
    m = re.match(r'^send (a|one|two|three|\d) cores? from (.+?) to (?:the|its owner\'?s|their|the opposing) reserve$', x)
    if m and selector(m.group(2)): return v_cores_to_reserve(n_of(m.group(1)), selector(m.group(2)))
    raise Review('v2 clause: ' + x[:120])


def head(s):
    """strip connectives and option words; returns (clause, optional)"""
    x = s.strip().rstrip('.').strip()
    x = re.sub(r'^then,?\s+', '', x, flags=re.I)
    opt = False
    m = re.match(r'^(?:you can|you may) (.*)$', x, re.I)
    if m: opt = True; x = m.group(1)
    x = re.sub(r'^during this turn,\s*', '', x, flags=re.I)
    return low(x), opt


TARGET = re.compile(r'^(?:(?:you can|you may) )?target (.+?)\.\s*(?:then,? )?(\w[\w ]*?) (?:it|that spirit|them|those spirits)(\b.*)?$', re.I)


COLW = r'(red|purple|green|white|yellow|blue)'
OWN_BP = re.compile(r'^target one of your (.+?)\.\s*during this (battle|turn), (?:it gains|it gets|give it) \+(\d[\d,]*) ?bp$', re.I)
OWN_SYM = re.compile(r'^target one of your (.+?)\.\s*during this battle, it gains an extra ' + COLW + r' symbol$', re.I)
OWN_REFRESH = re.compile(r'^(?:(?:you can|you may) )?target (?:one of your |an? |one )?(?:up to (two|three) (?:of your )?)?(?!opposing\b)(.+?)(?: you control)?\.\s*refresh (it|them)$', re.I)      # v0.169: "a Spirit you control", "up to two <X> you control" (REFRESH_SPIRIT n)
OWN_REFRESH_ALL = re.compile(r'^(?:(?:you can|you may) )?refresh all your (.+)$', re.I)
CORE_BP = re.compile(r'^target one of your ("[^"]+"(?:\s*/\s*"[^"]+")*)\.\s*send (?:a|one) cores?,? besides ,? from this spirit to it,? and during this battle, it gains \+(\d[\d,]*) ?bp$', re.I)      # v0.169 (the export drops the Soul Core icon after "besides")
SELF_BATTLE_BP = re.compile(r'^during this battle, this spirit (?:gains|gets) \+(\d[\d,]*) ?bp$', re.I)
SELF_BATTLE_SYM = re.compile(r'^during this battle, this spirit gains an extra ' + COLW + r' symbol$', re.I)


def own_np(np):
    """v0.68: "[attacking] [Cost N or more | Cost A/B] ["X" family] Spirits [with Kw | with the "Y" family]" (one of your ...) -> (match, attacking)"""
    m = re.match(r'^(attacking )?(?:cost (\d+) or more |cost (\d+(?:/\d+)+) )?(?:(red|purple|green|white|yellow|blue) )?(?:"([^"]+)" family )?spirits?(?: with (?:the "([^"]+)" family|([a-z]+)))?$', low(np.strip()))
    if not m or (m.group(7) in ('no', 'a', 'an', 'the', 'any')): raise Review('v2 own target: ' + np[:60])
    match = {}
    if m.group(4): match['color'] = m.group(4)      # v0.169 "one of your Green Spirits" (fxMatch color)
    if m.group(7): match['keyword'] = m.group(7).capitalize()      # v0.164 "Spirits with Clash" (fxMatch keyword)
    if m.group(5) or m.group(6): match['family'] = [m.group(5) or m.group(6)]      # v0.168 'with the "Topaz" family' = the same family filter
    if m.group(2): match['costGe'] = int(m.group(2))
    if m.group(3): match['costIn'] = [int(y) for y in m.group(3).split('/')]      # v0.168 "Cost 6/8"
    return match, bool(m.group(1))


BATTLE_TRIGGERS = {'ACTIVATE', 'ATTACKS', 'BLOCKS', 'ATTACKS+BLOCKS', 'ALLY_ATTACKS', 'OPP_ATTACKS'}


def own_grammar(s, ctx=None):
    """v0.68 own-target and battle-length sentences (BP_TARGET / SYMBOL_TARGET, 02l); None = not this shape"""
    x = s.strip().rstrip('.')
    battle_ok = ctx is None or bool(ctx.get('battle')) or bool(BATTLE_TRIGGERS & set(ctx.get('trigger') or ()))
    if re.search(r'during this battle', x, re.I) and not battle_ok: raise Review('v2 battle effect outside a battle trigger')      # A7 review
    if re.fullmatch(r'the opponent targets a refreshed spirit they control\.\s*exhaust it', x, re.I): return [{'do': 'EXHAUST_OPP', 'n': 1, 'oppChooses': True}]      # v0.170 (engine oppChooses, schema v3)
    m = CORE_BP.match(x)
    if m: return [{'do': 'BP_TARGET', 'n': bpv(m.group(2)), 'to': 'pick', 'battle': True, 'coreFromSelf': True, 'match': {'name': re.findall(r'"([^"]+)"', m.group(1))}}]
    m = re.fullmatch(r'for each "([^"]+)" family spirit you control, during this battle, this spirit (?:gains|gets) \+(\d[\d,]*) ?bp', x, re.I)
    if m: return [{'do': 'BP_TARGET', 'n': bpv(m.group(2)), 'to': 'self', 'battle': True, 'per': {'type': 'Spirit', 'family': m.group(1)}}]      # v0.169 Amplify (engine BP_TARGET.per, v0.120)
    m = SELF_BATTLE_BP.match(x)
    if m: return [{'do': 'BP_TARGET', 'n': bpv(m.group(1)), 'to': 'self', 'battle': True}]
    if SELF_BATTLE_SYM.match(x): return [{'do': 'SYMBOL_PLUS', 'n': 1}]
    m = re.fullmatch(r'(?:during this turn, give (?:a|one) spirit you control \+(\d[\d,]*) ?bp|give (?:a|one) spirit you control \+(\d[\d,]*) ?bp (?:during|until the end of) this turn)', x, re.I)
    if m: return [{'do': 'BP_TARGET', 'n': bpv(m.group(1) or m.group(2)), 'to': 'pick'}]      # v0.78 "give a Spirit you control +N BP" = one of your Spirits (BP_TARGET pick)
    m = OWN_BP.match(x)
    if m:
        match, att = own_np(m.group(1))
        a = {'do': 'BP_TARGET', 'n': bpv(m.group(3)), 'to': 'pick'}
        if m.group(2).lower() == 'battle': a['battle'] = True
        if att: a['attacking'] = True
        if match: a['match'] = match
        return [a]
    m = OWN_SYM.match(x)
    if m:
        match, att = own_np(m.group(1))
        a = {'do': 'SYMBOL_TARGET', 'n': 1}
        if att: a['attacking'] = True
        if match: a['match'] = match
        return [a]
    m = re.match(r'^(?:(?:you can|you may) )?target an opposing (.+?)\.\s*during this turn, give it -(\d[\d,]*) ?bp\.?\s*then,? (?:if it has 0 ?bp,? destroy it|destroy it if it has 0 ?bp)$', x, re.I)
    if m:      # v0.68 BP_MINUS zeroDestroy (Standard: 0 BP alone does not destroy, the text does)
        sel = selector('an opposing ' + low(m.group(1)))
        if not sel or sel['kind'] != 'spirit' or sel['f']: raise Review('v2 bp minus: ' + m.group(1)[:40])
        return [{'do': 'BP_MINUS', 'n': v1.bpm(m.group(2)), 'zeroDestroy': True}]
    if re.fullmatch(r"target an opposing exhausted spirit\.\s*the targeted spirit can't refresh on the next \(opposing refresh step\)", x, re.I): return [{'do': 'NO_REFRESH_OPP'}]      # v0.172 Janome-Shielder
    m = re.match(r'^target an opposing spirit\.\s*during this battle, that spirit can\'t block$', x, re.I)
    if m: return [{'do': 'CANT_BLOCK_OPP'}]      # v0.172 targeted "can't block this battle"
    if re.fullmatch(r"this spirit can't be blocked by (?:opposing )?spirits with high speed", x, re.I): return [{'do': 'CANT_BE_BLOCKED_BY', 'highSpeed': True}]      # v0.175
    m = re.match(r"^this spirit can't be blocked by (?:opposing )?(.+?) spirits?$", x, re.I)      # v0.175 attacker is unblockable by a colour / level / High Speed class
    if m:
        w = m.group(1).strip()
        cols = [t.capitalize() for t in w.split('/')]
        if all(t in ('Red', 'Purple', 'Green', 'White', 'Yellow', 'Blue') for t in cols): return [{'do': 'CANT_BE_BLOCKED_BY', 'color': cols}]
        lv = re.fullmatch(r'LV([1-3])(?:/LV([1-3]))?(?:/LV([1-3]))?', w, re.I)
        if lv: return [{'do': 'CANT_BE_BLOCKED_BY', 'levels': [int(g) for g in lv.groups() if g]}]
        if re.fullmatch(r'with high speed', w, re.I): return [{'do': 'CANT_BE_BLOCKED_BY', 'highSpeed': True}]
    m = re.fullmatch(r"this spirit can't be blocked by (?:opposing )?cost (\d+) or (less|more) spirits?(?:/ultimates?)?", x, re.I)
    if m: return [{'do': 'CANT_BE_BLOCKED_BY', 'costLe' if m.group(2).lower() == 'less' else 'costGe': int(m.group(1))}]      # v0.179 (engine blockedByMark cost bound)
    m = OPP_CORES_T.match(x)
    if m: return opp_cores_t(m)
    m = re.match(r'^target an opposing (.+?)\.\s*send (a|one|two|three) cores?,? besides ,? from it to (?:the|their|its owner\'?s) reserve$', x, re.I)
    if m:      # "besides <Soul Core icon>" (the export drops the icon): normal cores only = OPP_CORES_TO_RESERVE
        sel = selector('an opposing ' + low(m.group(1)))
        if not sel or sel['kind'] != 'spirit' or sel['f']: raise Review('v2 send cores: ' + m.group(1)[:40])
        return [{'do': 'OPP_CORES_TO_RESERVE', 'targets': 1, 'each': n_of(m.group(2).lower())}]
    m = re.match(r'^(?:(?:you can|you may) )?return an? ((?:"[^"]+"/)*"[^"]+") (?:card )?from your trash to (?:the|your) hand$', x, re.I)
    if m:      # v0.76: '"A"/"B"' = any card whose name includes A or B (RETURN_TRASH anyType + match.name)
        return [{'do': 'RETURN_TRASH', 'anyType': True, 'match': {'name': re.findall(r'"([^"]+)"', m.group(1))}}]
    m = re.match(r'^target an? (?:cost (\d+) or (less|more) )?(?:(red|purple|green|white|yellow|blue) )?(?:"([^"]+)" family )?spirit card(?: with ([a-z]+(?: [a-z]+)?))? in your trash\.\s*return it to (?:the|your) hand$', x, re.I)
    if m and (m.group(1) or m.group(3) or m.group(4) or m.group(5)):      # v0.76: optional "Cost N or more"; v0.168: "or less", a colour and a keyword ("a Spirit card with Clash")
        mt = {}
        if m.group(4): mt['family'] = [m.group(4)]
        if m.group(1): mt['costGe' if m.group(2).lower() == 'more' else 'costLe'] = int(m.group(1))
        if m.group(3): mt['color'] = m.group(3).lower()
        if m.group(5): mt['keyword'] = m.group(5).title()
        return [{'do': 'RETURN_TRASH', 'match': mt}]
    m = re.match(r'^(?:you can )?return an? spirit card(?: with ([a-z]+))? from your trash to (?:the|your) hand$', x, re.I)
    if m:      # v0.176: untargeted pick from the Trash (engine RETURN_TRASH, match type Spirit + optional keyword)
        mt = {'type': 'Spirit'}
        if m.group(1): mt['keyword'] = m.group(1).title()
        return [{'do': 'RETURN_TRASH', 'match': mt}]
    m = re.match(r'^(?:you can )?return an? ((?:"[^"]+"/)*"[^"]+")-named spirit card from your trash to (?:the|your) hand$', x, re.I)
    if m: return [{'do': 'RETURN_TRASH', 'match': {'name': re.findall(r'"([^"]+)"', m.group(1))}}]      # v0.177 '"X"-named Spirit card' (Spirit-only pick, name includes X)
    m = OWN_REFRESH.match(x)
    if m and (m.group(1) is None) == (m.group(3).lower() == 'it'):
        match, att = own_np(m.group(2))
        if att or 'costGe' in match: raise Review('v2 refresh: filter')
        a = {'do': 'REFRESH_SPIRIT'}
        if match: a['match'] = match
        if m.group(1): a['n'] = n_of(m.group(1).lower())
        return [a]
    m = OWN_REFRESH_ALL.match(x)
    if m:      # v0.169 "Refresh all your <X> Spirits" (REFRESH_SPIRIT all)
        match, att = own_np(m.group(1))
        if att or 'costGe' in match: raise Review('v2 refresh: filter')
        a = {'do': 'REFRESH_SPIRIT', 'all': True}
        if match: a['match'] = match
        return [a]
    m = WHEN_FX.match(x)
    if m:      # v0.77 "<Destroy X | Send a core from an opposing Spirit ...>. When this effect destroys / depletes any Spirit, draw a card."
        return when_fx(m, ctx)
    m = VOID_CORES.match(re.sub(r'^(?:you can|you may) ', '', x, flags=re.I))      # grammar() adds the optional flag
    if m: return void_cores(m, x, ctx)
    # v0.74: sentences for actions the engine already has (no engine change): own discard, counters plural, opposing Life
    y = re.sub(r'^(?:you can|you may) ', '', x, flags=re.I)
    m = re.match(r'^by discarding an? (?:(spirit|nexus|magic) |"([^"]+)" family )?card from your hand, draw (a|one|two|three) cards?(?: from your deck)?$', y, re.I)
    if m:      # v0.76 "By doing A, do B" (CR Effect Texts): optional (grammar() sets it), B only when A was done
        d = {'do': 'DISCARD_HAND', 'n': 1}
        if m.group(1): d['match'] = {'type': m.group(1).capitalize()}
        if m.group(2): d['match'] = {'family': [m.group(2)]}
        return [d, {'do': 'DRAW', 'n': n_of(m.group(3).lower()), 'if': {'prev': True}}]
    m = re.match(r'^gain (a|one|two|\d) cores? on this spirit$', y, re.I)
    if m: return [{'do': 'VOID_TO_CARD', 'n': n_of(m.group(1).lower()), 'to': 'self'}]      # v0.77 early wording of "put N cores from the Void to ..." (house reading)
    m = re.match(r'^gain (a|one|two|\d) cores? in your reserve$', y, re.I)
    if m: return [{'do': 'VOID_TO_RESERVE', 'n': n_of(m.group(1).lower())}]
    m = re.match(r'^gain (a|one|two|\d) cores? on (?:a |one |target )?nexus you control$', y, re.I)
    if m: return [{'do': 'VOID_TO_CARD', 'n': n_of(m.group(1).lower()), 'to': 'anyNexus'}]
    m = re.match(r'^discard (a|one|two|three) cards? from your hand$', y, re.I)
    if m: return [{'do': 'DISCARD_HAND', 'n': n_of(m.group(1).lower())}]
    m = re.match(r'^your counters? \+(\d)$', y, re.I)
    if m: return [{'do': 'COUNTER', 'n': int(m.group(1))}]
    m = re.match(r'^send (an|one|two) opposing life to (?:their|the opposing|the) reserve$', y, re.I)
    if m: return [{'do': 'LIFE_TO_RESERVE', 'n': n_of(m.group(1).lower())}]
    if re.match(r'^send (?:an|one) opposing life to (?:the|their) trash$', y, re.I): return [{'do': 'OPP_LIFE_TO_TRASH', 'n': 1}]
    return None


# ---------- v0.77: "Target an opposing <X> Spirit. Send N core(s) | cores ... until one core remains ... from it to the Reserve." ----------
OPP_CORES_T = re.compile(r'^target an opposing (?P<np>.+?)\.\s*send (?:(?P<n>a|one|two|three) cores?(?:,? besides)?\s*,?\s*from it to (?:the|their|its owner\'?s) reserve'
                         r'(?P<keep>\.\s*its number of cores can\'t be brought to (?:less than one|below one|0))?|cores from it to (?:the|their) reserve until one core remains)'
                         r'(?P<up>\.\s*if (?:there are three or more cores in the opposing reserve,\s*(?:the target becomes any opposing spirit|send one core from it to the reserve)|summoned via form change,\s*send a core from it to the reserve) instead)?'      # v0.169 upgrade
                         r'(?:\.?\s*\(the opponent chooses which cores? to send\.?\))?'
                         r'(?:\.\s*(?P<dep>if it depletes|when this effect depletes (?:it|that spirit|any spirit)),? draw a card)?\.?$', re.I)


def opp_cores_t(m):
    sel = selector('an opposing ' + low(m.group('np')))
    if not sel or sel['kind'] != 'spirit' or sel['count'] != 1: raise Review('v2 send cores: ' + m.group('np')[:40])
    need('send cores', sel, ('costLe', 'exhausted', 'coresLe'))
    a = {'do': 'OPP_CORES_TO_RESERVE', 'targets': 1, 'each': n_of(m.group('n').lower()) if m.group('n') else 1}
    if not m.group('n'): a['untilOne'] = True
    if m.group('keep'): a['keepOne'] = True
    for k in ('costLe', 'coresLe'):
        if k in sel['f']: a[k] = sel['f'][k]
    if sel['f'].get('exhausted'): a['exhaustedOnly'] = True
    if m.group('dep'): a['drawPerDepleted'] = True
    if m.group('up'):      # v0.169 "If there are three or more cores in the opposing Reserve, the target becomes any opposing Spirit / send one core from it instead", "If summoned via Form Change, send a core from it instead"
        u = m.group('up').lower()
        a['upgrade'] = {'when': 'viaFC' if 'form change' in u else 'oppReserveGe3'}
        a['upgrade']['anyTarget' if 'the target becomes' in u else 'soul'] = True
    return [a]


# ---------- v0.77: "When this effect destroys / depletes any Spirit, draw a card." after the action it watches ----------
WHEN_FX_TAIL = r'(?:if it depletes|when this effect (?:(destroys) any (?:opposing )?spirits?(?:/ultimates?)?|(depletes) any (?:opposing )?spirits?(?:/ultimates?)?|brought the number of cores on that spirit to (?:0|zero))),? draw (a|one) cards?'
WHEN_FX = re.compile(r'^(.+?\.)\s*' + WHEN_FX_TAIL + r'$', re.I)


def when_fx(m, ctx):
    """the watched action must be one DESTROY of one target (thenDraw) or one OPP_CORES_TO_RESERVE of one target (drawPerDepleted);
    anything else stays in review"""
    first = m.group(1).strip()
    send = re.match(r'^send (?:a|one) core from (?:an|any|one) opposing spirit to (?:the|their|its owner\'?s|the opposing) reserve\.$', first, re.I)
    if send:
        if m.group(2): raise Review('sentence: ' + first[:140])
        return [{'do': 'OPP_CORES_TO_RESERVE', 'targets': 1, 'each': 1, 'drawPerDepleted': True}]
    if not m.group(2): raise Review('sentence: ' + first[:140])
    a, o = action_of(first, ctx)
    if o or len(a) != 1 or a[0]['do'] != 'DESTROY' or a[0].get('all') or a[0].get('nexus') or a[0].get('thenDraw') or a[0].get('if'): raise Review('sentence: when this effect destroys')
    return [dict(a[0], thenDraw=n_of(m.group(4).lower()))]


# ---------- v0.74: "Put N core(s) from the Void to <destination>" (v0.75: Trash, Nexus, "each to every", two colours) ----------
VOID_CORES = re.compile(r'^put (a|one|two|three|\d) cores? from (?:the )?void (each )?(?:to|on|onto|in|into) (.+)$', re.I)
_VCOL = r'(?:(' + COL + r'(?:/' + COL + r')*) )?'
_VS_NP = _VCOL + r'(?:"([^"]+(?:"\s*/\s*"[^"]+)*)" family )?(spirits?|nexus(?:es)?)'
VOID_SPIRIT = re.compile(r'^(?:(?:any (?:one )?of your|one of your|your) ' + _VS_NP + r'|(?:any|an?) ' + _VS_NP + r' you control)$')      # an own-side marker is required (an unmarked "a Spirit" is not guessed)
VOID_EACH = re.compile(r'^(?:every|all|each|all of your|each of your) ' + _VS_NP + r'(?: you control)?$')


def _void_match(col, fam):
    match = {}
    if col: match['color'] = col if '/' not in col else col.split('/')
    if fam: match['family'] = re.split(r'"\s*/\s*"', fam)
    return match


def void_cores(m, x, ctx=None):
    """destinations the engine has: your Reserve (VOID_TO_RESERVE), your Trash (VOID_TO_TRASH, v0.75), this Spirit, one of your
    Spirits / Nexuses with an optional colour (one or "A/B" = either) or family (VOID_TO_CARD anySpirit / anyNexus + match), and
    "each to every <X> you control" (VOID_TO_CARD eachSpirit / eachNexus). "-only" colours, "other", keyword filters, Grandstone
    Nexus and two-destination sentences stay in review."""
    n = n_of(m.group(1).lower())
    each = bool(m.group(2))
    dest = low(m.group(3).strip())
    if not each:
        if re.fullmatch(r'(?:your|the) reserve', dest): return [{'do': 'VOID_TO_RESERVE', 'n': n}]
        if re.fullmatch(r'(?:your|the) trash', dest): return [{'do': 'VOID_TO_TRASH', 'n': n}]
        if re.fullmatch(r'this spirit', dest): return [{'do': 'VOID_TO_CARD', 'n': n, 'to': 'self'}]
        if re.fullmatch(r'this spirit,? and refresh it', dest): return [{'do': 'VOID_TO_CARD', 'n': n, 'to': 'self'}, {'do': 'REFRESH'}]
        if re.fullmatch(r'this spirit,? or (?:to )?your reserve', dest): return [{'do': 'VOID_TO_CARD', 'n': n, 'to': 'self', 'orReserve': True}]      # v0.77: the owner picks
        if re.fullmatch(r'your spirit/reserve', dest): return [{'do': 'VOID_TO_CARD', 'n': n, 'to': 'anySpirit', 'orReserve': True}]
        if re.fullmatch(r'that spirit', dest):      # v0.77 "When your X Spirit attacks, ... to that Spirit" = the attacker of the event
            if not (isinstance(ctx, dict) and set(ctx.get('trigger') or ()) & {'ALLY_ATTACKS', 'ATTACKS'}): raise Review('sentence: ' + x[:140])
            return [{'do': 'VOID_TO_CARD', 'n': n, 'to': 'attacker'}]
        d = VOID_SPIRIT.match(dest)
        if not d: raise Review('sentence: ' + x[:140])
        col, fam, kind = (d.group(1) or d.group(4)), (d.group(2) or d.group(5)), (d.group(3) or d.group(6))
        a = {'do': 'VOID_TO_CARD', 'n': n, 'to': 'anyNexus' if kind.startswith('nexus') else 'anySpirit'}
    else:
        d = VOID_EACH.match(dest)
        if not d: raise Review('sentence: ' + x[:140])
        col, fam, kind = d.group(1), d.group(2), d.group(3)
        a = {'do': 'VOID_TO_CARD', 'n': n, 'to': 'eachNexus' if kind.startswith('nexus') else 'eachSpirit'}
    match = _void_match(col, fam)
    if match: a['match'] = match
    return [a]


# ---------- v0.69: "Reveal N cards from your decktop. Among them, add/deploy <card>. Return/Discard any remaining cards." ----------
REVEAL_HEAD = re.compile(r'^(?:(?:you can|you may) )?reveal (a|one|two|three|four|five|\d) cards? from your decktop\.', re.I)
_DTOP = r'(?:the |your )?decktop'
_DBOT = r'(?:the |your )?deck ?bottom'
REVEAL_REST = re.compile(r'\.\s*(return (?:any|the) remaining cards? to ' + _DBOT + r'(?:,? in any order)?|discard (?:any|the) remaining cards?'
                         r'|return (?:any|the) remaining cards? to (?:either )?(?:only )?' + _DTOP + r'(?: only)? or (?:only )?' + _DBOT + r'(?: only)?(?:,? in any order)?'
                         r'|(?:if not|otherwise),? (?:return it to ' + _DTOP + r'(?: or ' + _DBOT + r')?|return it to ' + _DBOT + r'|discard it))\.?$', re.I)      # v0.75: singular, "the", decktop-or-deckbottom, one-card "If not, ..." endings
REVEAL_IF = re.compile(r'^if (?:that card|that|it)(?: is|\'s|’s) (.+?), add it to (?:the |your |you )?hand$', re.I)      # v0.75: one revealed card
DIFF_NAME = r"(?: with (?:a )?(?:card )?name different (?:from|to) this (?:spirit|nexus)'?s)?"
REVEAL_NP = re.compile(r'^(?:an?|one) (?:(?P<col>' + COL + r') )?(?:cost (?P<cost>\d+) or less )?(?:"(?P<fam>[^"]+(?:"\s*/\s*"[^"]+)*)" family )?(?:(?P<kind>spirit|nexus|magic) )?card' + DIFF_NAME + r'$')


def reveal_np(np):
    """one card noun phrase -> engine match + diffName; Review for forms the engine match cannot say (keywords, two kinds, no printed effects, unquoted families)"""
    x = low(np.strip())
    m = REVEAL_NP.match(x)
    if not m: raise Review('v2 reveal: card phrase ' + np.strip()[:60])
    if not (m.group('fam') or m.group('kind') or m.group('col') or m.group('cost')): raise Review('v2 reveal: any card')
    match = {}
    if m.group('fam'): match['family'] = [f.strip() for f in re.findall(r'"([^"]+)"', np)]
    if m.group('kind'): match['type'] = m.group('kind').capitalize()
    if m.group('col'): match['color'] = m.group('col')
    if m.group('cost'): match['costLe'] = int(m.group('cost'))
    return match, 'name different' in x


def reveal_grammar(s):
    """-> [action] or None when the sentence is not a reveal-from-decktop effect (REVEAL_PICK / REVEAL_DEPLOY, 02b)"""
    x = s.strip()
    h = REVEAL_HEAD.match(x)
    if not h: return None
    n = n_of(h.group(1).lower())
    body = x[h.end():].strip()
    r = REVEAL_REST.search(body)
    if not r: raise Review('v2 reveal: no "remaining cards" ending')
    e = r.group(1).lower()
    rest = 'trash' if 'discard' in e else 'either' if ' or ' in e else 'top' if 'decktop' in e else 'bottom'
    body = body[:r.start()].strip().rstrip('.')
    mi = REVEAL_IF.match(body)
    if mi:
        if n != 1: raise Review('v2 reveal: "if" form with more cards')
        match, diff = reveal_np(re.sub(r'^(?:an?|one) ', 'a ', mi.group(1).strip()) if re.search(r'\bcard$', mi.group(1).strip()) else 'a ' + re.sub(r'^(?:an?|one) ', '', mi.group(1).strip()) + ' card')
        return [{'do': 'REVEAL_PICK', 'n': 1, 'match': match, 'rest': rest}]
    if rest == 'top': raise Review('v2 reveal: decktop return with more cards')
    body = re.sub(r'^among them,?\s*', '', body, flags=re.I)
    body = re.sub(r'^(?:you can|you may)\s+', '', body, flags=re.I)
    m = re.match(r'^add (?:to (?:the |your )?hand )?(.+?)(?: among them)?(?: to (?:the |your )?hand)?$', body, re.I)
    if m:
        match, diff = reveal_np(m.group(1))
        a = {'do': 'REVEAL_PICK', 'n': n, 'match': match, 'rest': rest}
        if diff: a['diffName'] = True
        return [a]
    m = re.match(r'^(?:summon/deploy|deploy|summon) (.+?)(, without paying the cost)?$', body, re.I)
    if m:
        if rest != 'bottom': raise Review('v2 reveal: deploy then discard')
        match, diff = reveal_np(m.group(1))
        a = {'do': 'REVEAL_DEPLOY', 'n': n, 'match': match, 'pay': not m.group(2)}
        if diff: a['diffName'] = True
        return [a]
    raise Review('v2 reveal: ' + body[:60])


def grammar(s, ctx=None):
    rg = reveal_grammar(s)
    if rg is not None: return rg, bool(re.match(r'^(?:you can|you may) ', s, re.I))
    og = own_grammar(s, ctx)
    if og is not None: return og, bool(re.match(r'^(?:you can|you may|by discarding) ', s, re.I))      # v0.76: "By doing A, do B" is optional
    s = re.sub(r'^((?:(?:you can|you may) )?target an opposing [^.,]+), (destroy|exhaust|return) it\b', lambda q: q.group(1) + '. ' + q.group(2).capitalize() + ' it', s.strip(), flags=re.I)      # v0.77 "Target X, destroy it."
    m = TARGET.match(s.strip().rstrip('.'))
    if m:      # "Target an opposing ... Spirit. Destroy it." -> one clause
        opt = bool(re.match(r'^(?:you can|you may) ', s, re.I))
        x = low(m.group(2) + ' ' + m.group(1) + (m.group(3) or ''))
        return self_bound_ok(clause(x), ctx), opt
    x, opt = head(s)
    return self_bound_ok(clause(x), ctx), opt


def self_bound_ok(acts, ctx):
    """v0.76: "BP equal or inferior to / the same BP as this Spirit" reads the source on the Field; after it left (When
    Destroyed, leave heads) the engine keeps no last-known BP, so those stay in review"""
    trig = ' '.join(ctx.get('trigger') or ()) if isinstance(ctx, dict) else ''
    if re.search(r'DESTROY|LEAVE|DEPLET|REMOVED', trig) and any(a.get('bpLeSelf') or a.get('bpEqSelf') for a in acts):
        raise Review('v2 destroy: this Spirit\'s BP after it left')
    return acts


# v0.71 condition clauses in front of an action: "If you have a Burst set, ...", "If you control any Ultimate, also, ...".
# The condition becomes the action's "if" (engine fxIf: burstSet, oppBurstSet, ctrl). "instead" (a replacement) stays in review.
COND_LEAD = re.compile(r'^(?:also,? )?(?:then,? )?(?:if|when|while) (.+?), (?:also,? )?(?!instead)(.+)$', re.I)
CTRL_ANY = re.compile(r'^you control (?:any|an?|one or more) (exhausted )?(?:(red|purple|green|white|yellow|blue) )?(?:"([^"]+)" family )?(spirit/ultimate|spirit|ultimate)s?$', re.I)


def cond_of(x):
    """condition text -> fxIf dict or None"""
    x = x.strip()
    m = re.fullmatch(r"you (don't |do not )?have an? (?:set burst|burst set)", x, re.I)
    if m: return {'burstSet': not m.group(1)}
    m = re.fullmatch(r"the opponent (doesn't |does not )?ha(?:s|ve) an? (?:set burst|burst set)", x, re.I)
    if m: return {'oppBurstSet': not m.group(1)}
    m = re.fullmatch(r'you control (?:an? |any )?\[([^\]/]+)\]', x, re.I)
    if m: return {'controlName': m.group(1).strip()}
    m = re.fullmatch(r'you control (?:an? |any )?(\[[^\]/]+\](?:\s*/\s*\[[^\]/]+\]){1,3})', x, re.I)      # v0.171 "[A]/[B]" = either name (engine controlName list)
    if m: return {'controlName': [y.strip() for y in re.findall(r'\[([^\]/]+)\]', m.group(1))]}
    m = re.fullmatch(r'your hand is (one|two|three|four|five|six|seven|\d) or less', x, re.I)
    if m: return {'handLe': n_of(m.group(1).lower())}      # v0.166 (engine fxIf handLe)
    m = re.fullmatch(r'you have (one|two|three|four|five|\d) counters? or more', x, re.I)
    if m: return {'counterGe': n_of(m.group(1).lower())}
    m = re.fullmatch(r'you control (one|two|three|four|five|six|\d) or more (?:(red|purple|green|white|yellow|blue) )?(?:("[^"]+"(?:\s*/\s*"[^"]+")*) family )?(spirit/ultimate|spirit|ultimate)s', x, re.I)
    if m:
        q = {'n': n_of(m.group(1).lower()), 'type': 'Both' if '/' in m.group(4) else m.group(4).capitalize()}
        if m.group(2): q['colors'] = [m.group(2).lower()]
        if m.group(3):
            fams = re.findall(r'"([^"]+)"', m.group(3))
            q['family'] = fams[0] if len(fams) == 1 else fams      # v0.169 '"A"/"B" family' = either family (engine ctrl.family may be a list)
        return {'ctrl': q} if q['n'] <= 5 else None
    m = re.fullmatch(r'you control (?:an? |any )?["“]([^"”]+)["”]-named (?:spirit|spirit/nexus|nexus)', x, re.I)      # v0.178 "X"-named Spirit = controlName
    if m: return {'controlName': m.group(1).strip()}
    m = re.fullmatch(r'you control (?:an? |any )?"([^"]+)"', x, re.I)      # v0.76: a quoted card name (part of the name, like [Name])
    if m: return {'controlName': m.group(1).strip()}
    if re.fullmatch(r'you control fewer spirits than (?:the|your) opponent', x, re.I): return {'fewerSpirits': True}      # v0.77
    m = re.fullmatch(r'you control (?:an?|any) (red|purple|green|white|yellow|blue) nexus', x, re.I)
    if m: return {'nexusGe': {'n': 1, 'colors': [m.group(1).lower()]}}      # v0.77
    m = re.fullmatch(r'there (?:is|are) only (red|purple|green|white|yellow|blue) symbols? on your field', x, re.I)
    if m: return {'onlySymbols': m.group(1).lower()}      # v0.179
    m = re.fullmatch(r'you (?:control|have) (one|two|three|four|five|six|\d) or more (red|purple|green|white|yellow|blue) symbols?', x, re.I)
    if m: return {'symbolsOnGe': {'color': m.group(2).lower(), 'n': n_of(m.group(1).lower())}}      # v0.168 (engine symbolsOnGe: Field symbols of the owner)
    if re.fullmatch(r'\(soul core\) (?:was|is) used to pay (?:for )?the summon cost', x, re.I): return {'soulPaid': True}      # v0.176 (engine soulPaid: the normal summon paid with the Soul Core)
    if re.fullmatch(r'(?:there is )?\(soul core\) (?:is )?on this spirit', x, re.I): return {'selfSoul': True}      # v0.176 (engine selfSoul: this Spirit holds the Soul Core)
    c = v1.all_have_cond(x)
    if c: return c
    if re.fullmatch(r'(?:you )?(?:are |is |was )?summoned via form change', x, re.I): return {'viaFormChange': True}      # v0.135 (schema v8)
    m = re.fullmatch(r'you control (?:an?|any) spirit with ([A-Za-z]+)', x, re.I)      # v0.150 "a Spirit with Evolution" (engine ctrl.keyword)
    if m: return {'ctrl': {'n': 1, 'type': 'Spirit', 'keyword': m.group(1).capitalize()}}
    m = re.fullmatch(r'you control another "([^"]+)" family spirit(/nexus)?', x, re.I)      # v0.150 "another X family Spirit" (engine ctrl.other = not the source); v0.171 "Spirit/Nexus" (ctrl.nexus)
    if m:
        q = {'n': 1, 'type': 'Spirit', 'family': m.group(1), 'other': True}
        if m.group(2): q['nexus'] = True
        return {'ctrl': q}
    m = re.fullmatch(r'you control (?:an?|any) (?:(red|purple|green|white|yellow|blue) )?spirit with (\d[\d,]*) BP or more', x, re.I)      # v0.167 (engine ctrl.bpGe)
    if m:
        q = {'n': 1, 'type': 'Spirit', 'bpGe': bpv(m.group(2))}
        if m.group(1): q['colors'] = [m.group(1).lower()]
        return {'ctrl': q}
    m = re.fullmatch(r'you control (?:an?|any) (?:(red|purple|green|white|yellow|blue) )?spirit with no printed effects', x, re.I)      # v0.167 (engine ctrl.noText)
    if m:
        q = {'n': 1, 'type': 'Spirit', 'noText': True}
        if m.group(1): q['colors'] = [m.group(1).lower()]
        return {'ctrl': q}
    m = re.fullmatch(r'you control (?:an?|any) (exhausted )?"([^"]+)"', x, re.I)      # v0.167 a card name, optionally exhausted (engine ctrl.name)
    if m and m.group(1):
        return {'ctrl': {'n': 1, 'type': 'Spirit', 'name': m.group(2).strip(), 'exhausted': True}}
    m = CTRL_ANY.fullmatch(x)
    if m:
        q = {'n': 1, 'type': 'Both' if '/' in m.group(4) else m.group(4).capitalize()}
        if m.group(2): q['colors'] = [m.group(2).lower()]
        if m.group(3): q['family'] = m.group(3)
        if m.group(1): q['exhausted'] = True      # v0.76 "any exhausted ..." (fxIf ctrl.exhausted)
        return {'ctrl': q}
    return None


def clean(text):
    """v0.71: v1 clean() without its blanket "Burst" stop: a sentence that names a Burst reaches action_of, which reads the
    Burst conditions above and sends every other Burst sentence to review (BURST_WORD)"""
    try:
        return _V1_CLEAN(text)
    except Review as e:
        if str(e) != 'Burst': raise
    t = (text or '').replace('\r', '').strip()
    return v1.VERSION_LABEL.sub('', t).strip()


BURST_WORD = re.compile(r'\bbursts?\b|\u263c', re.I)
THEN_LEAD = re.compile(r'^Then,\s*(.+)$', re.I)
AND_SPLIT = re.compile(r'^(.+?),? and ((?:draw|put|send|return|destroy|discard|exhaust|refresh|your counter)\b.+)$', re.I)


EOB_LEAD = re.compile(r'^at the end of (?:the |of )?battle, (.+)$', re.I)
EOB_TRIG = {'ATTACKS', 'BLOCKS', 'ATTACKS+BLOCKS'}
SUBJ_REFRESH = re.compile(r'^refresh (?:that spirit|the (?:blocking|attacking|battling) spirit)(?: you control)?\.?$', re.I)


INSTEAD_PAIR = re.compile(r'^(.+?\.)\s+If ([^,.]+), (?:([^.]+?) instead|instead,\s*([^.]+?))\.?$', re.I)      # v0.150: also "If C, instead, B." (group 4)
SUBST_BP = re.compile(r'^(?:change )?the targeting (BP|cost) (?:becomes|to) (\d[\d,]*)(?: (?:BP|cost))? or (less|more)$', re.I)


def instead_pair(m, ctx):
    """v0.135 "A. If C, B instead.": A runs unless C (`not`), B runs when C. B is a whole action on its own, or "the targeting BP/cost becomes N or less"
    (A with its number swapped). Anything else stays in review (more than one action, an optional clause, a condition the engine lacks)."""
    cond = cond_of(m.group(2))
    if not cond: raise Review('sentence: ' + m.group(0)[:140])
    first, b0 = m.group(1).strip(), (m.group(3) or m.group(4)).strip()
    sb = SUBST_BP.match(b0)
    two = re.fullmatch(r'target (two|three)(?: instead)?', b0, re.I)      # v0.167 "If C, target two instead.": the same single-target action, run N times (each run picks a still-legal target)
    if two:
        a1, o1 = action_of(first, ctx)
        if o1 or not a1 or len(a1) != 1 or 'if' in a1[0] or a1[0].get('do') not in ('DESTROY', 'BOUNCE_OPP', 'BP_MINUS'): raise Review('sentence: ' + m.group(0)[:140])
        k = n_of(two.group(1).lower())
        return [dict(a1[0], **{'if': {'not': cond}})] + [dict(a1[0], **{'if': dict(cond)}) for _ in range(k)], False
    if sb:
        kind, n, rel = sb.group(1).lower(), sb.group(2), sb.group(3).lower()
        pat = r'(\d[\d,]*)( ?BP or %s)' % rel if kind == 'bp' else r'(Cost )(\d+)( or %s)' % rel
        if kind == 'bp': second, k = re.subn(pat, n + r'\2', first, count=1, flags=re.I)
        else: second, k = re.subn(pat, r'\g<1>' + n + r'\3', first, count=1, flags=re.I)
        if k != 1: raise Review('sentence: ' + m.group(0)[:140])
    else: second = b0[0].upper() + b0[1:]
    a1, o1 = action_of(first, ctx); a2, o2 = action_of(second, ctx)
    if o1 or o2 or not a1 or len(a1) != len(a2) or len(a1) > 2 or any('if' in y for y in a1 + a2): raise Review('sentence: ' + m.group(0)[:140])
    return [dict(y, **{'if': {'not': cond}}) for y in a1] + [dict(y, **{'if': dict(cond)}) for y in a2], False


SHOW_RET = re.compile(r'^(you can )?show (a|an|up to (one|two|three)) (?:(' + COL + r') )?"([^"]+)" family (?:(' + COL + r') )?cards? from (?:your|the) hand to the opponent(?:\.\s*return (?:them|it) to the deckbottom(?: in any order)?|,? and return (?:them|it) to the deckbottom)\.?((?:\s*(?:for each card returned, draw a card|if (?:one|two|three) cards? (?:is|are) returned, draw (?:a|one|two|three|four|five) cards?)\.?)?)$', re.I)      # v0.165
MILL_OWN = re.compile(r'^(you can )?discard (a|one|two|three|four|five|\d) cards? from (?:your|the) decktop\.?$', re.I)      # v0.165
SUMMON_FREE = re.compile(r'^(you can )?summon (?:a|an|one) (?:cost (\d+) or less )?"([^"]+)" family spirit card from your (hand|trash), without paying the cost\.?$', re.I)      # v0.164
TGT_VOID_OWN = re.compile(r'^target one of your (.+?)\.\s*put (a|one|two|three|\d) cores? from (?:the )?void to it\.?$', re.I)      # v0.164
TGT_VOID = re.compile(r'^target (?:an?|one) (.+? you control)\.\s*put (a|one|two|three|\d) cores? from (?:the )?void to it\.?$', re.I)      # v0.163


def action_of(s, ctx):
    s = re.sub(r'(?:^|(?<=\. ))(if you control) any ("[^"]+" family spirit(?:/nexus)?), besides this (?:spirit|one),', r'\1 another \2,', s.strip(), flags=re.I)      # v0.168 'any "X" family Spirit, besides this Spirit,' = 'another "X" family Spirit' (ctrl.other); v0.171 also Spirit/Nexus and "besides this one"
    s = re.sub(r'^besides this (?:spirit|one), (if you control) any ("[^"]+" family spirit(?:/nexus)?),', r'\1 another \2,', s, flags=re.I)      # v0.171 'Besides this Spirit, if you control any "X" family Spirit/Nexus, B' = the same
    if re.fullmatch(r'return this spirit to (?:the|your) hand\.?', s.strip(), re.I): return [{'do': 'SELF_TO_HAND'}], False      # v0.171 (engine SELF_TO_HAND; from the Trash under a destroyed trigger)
    if re.fullmatch(r'put the core to this spirit\.?', s.strip(), re.I): return [{'do': 'VOID_TO_CARD', 'n': 1, 'to': 'self'}], False      # v0.171 "put the core to this Spirit instead" (the core of the sentence before; only inside an instead pair)
    m = re.fullmatch(r'target up to (one|two|three) spirits? with ([A-Za-z]+) you control\.\s*put a core from the void (?:each )?to (?:each of them|it|them)\.?', s.strip(), re.I)      # v0.171 (engine VOID_TO_MATCHING + match.keyword)
    if m: return [{'do': 'VOID_TO_MATCHING', 'targets': n_of(m.group(1).lower()), 'match': {'keyword': m.group(2).capitalize()}}], False
    sh = SHOW_RET.match(s.strip())
    if sh:      # v0.165 "Show up to N <X> cards from your Hand to the opponent. Return them to the deckbottom. For each card returned, draw a card." = SHOW_RETURN
        col1, fam, col2 = sh.group(4), sh.group(5), sh.group(6)
        a = {'do': 'SHOW_RETURN', 'max': 1 if sh.group(3) is None else n_of(sh.group(3).lower()), 'match': {'family': [fam]}}
        if col1 or col2: a['match']['color'] = (col1 or col2).lower()
        tail = (sh.group(7) or '').lower()
        if 'for each card returned' in tail: a['drawEach'] = True
        mi = re.search(r'if (one|two|three) cards? (?:is|are) returned, draw (a|one|two|three|four|five) cards?', tail)
        if mi: a['drawIf'] = {'n': n_of(mi.group(1)), 'draw': n_of(mi.group(2))}
        if sh.group(1) is None and (a.get('drawEach') or a.get('drawIf')) is None and False: pass
        return [a], bool(sh.group(1))
    if re.match(r'^if returned, ', s.strip(), re.I):      # v0.165 "If returned, X" = "Then, X" (only when the previous action returned a card)
        return action_of('Then, ' + re.sub(r'^if returned, ', '', s.strip(), flags=re.I), ctx)
    if re.fullmatch(r'this spirit can refresh\.?', s.strip(), re.I): return [{'do': 'REFRESH'}], True      # v0.169 "(Your End Step) This Spirit can refresh." (optional REFRESH on this card)
    if re.fullmatch(r'refresh this spirit\.?', s.strip(), re.I): return [{'do': 'REFRESH'}], False      # v0.169 "If <condition>, refresh this Spirit."
    mm_ = MILL_OWN.match(s.strip())
    if mm_ and n_of(mm_.group(2).lower()) <= 5:      # v0.165 "(You can) discard N card(s) from your decktop" = MILL (own Deck to Trash)
        return [{'do': 'MILL', 'n': n_of(mm_.group(2).lower())}], bool(mm_.group(1))
    ms = SUMMON_FREE.match(s.strip())
    if ms:      # v0.164 "You can summon a Cost N or less "X" family Spirit card from your Hand/Trash, without paying the cost." = SUMMON_HAND (optional when "you can")
        a = {'do': 'SUMMON_HAND', 'match': {'family': [ms.group(3)]}, 'from': ms.group(4).lower()}
        if ms.group(2): a['costLe'] = int(ms.group(2))
        return [a], bool(ms.group(1))
    sn = re.match(r'^target (?:an?|one) ((?:"[^"]+" family )?spirit) you control\.\s*(.+)$', s.strip(), re.I)
    if sn and re.match(r'(?:refresh it|during (?:this|the) (?:turn|battle)|put )', sn.group(2), re.I):      # v0.164 "Target a Spirit you control. <X>" = "Target one of your Spirits. <X>"
        return action_of('Target one of your %ss. %s' % (sn.group(1), sn.group(2)), ctx)
    mo = TGT_VOID_OWN.match(s.strip())
    if mo and not re.search(r'\b(?:with|besides|except|other|another)\b', mo.group(1), re.I):      # v0.164 "Target one of your <X>. Put a core from the Void to it." (own side by wording)
        return action_of('Put %s core from the Void to one of your %s.' % (mo.group(2), mo.group(1)), ctx)
    m = TGT_VOID.match(s.strip())
    kw = re.fullmatch(r'(?:(' + COL + r') )?(spirit) with ([A-Za-z]+) you control', m.group(1), re.I) if m else None
    if kw and kw.group(3).lower() not in ('no', 'a', 'an', 'the', 'any'):      # v0.163 "Target a Spirit with Rumble you control. Put a core from the Void to it." (match.keyword)
        mt = {'keyword': kw.group(3).capitalize()}
        if kw.group(1): mt['color'] = kw.group(1).lower()
        return [{'do': 'VOID_TO_CARD', 'n': n_of(m.group(2).lower()), 'to': 'anySpirit', 'match': mt}], False
    if m and not re.search(r'\b(?:with|besides|except|other|another)\b', m.group(1), re.I):      # v0.163 "Target a <X> you control. Put a core from the Void to it." = "Put a core from the Void to a <X> you control." (VOID_TO_CARD, own side)
        return action_of('Put %s core from the Void to a %s.' % (m.group(2), m.group(1)), ctx)
    trig = set((ctx or {}).get('trigger') or ()) if isinstance(ctx, dict) else set()
    m = EOB_LEAD.match(s.strip())
    if m and trig and trig <= EOB_TRIG:      # v0.78 "At the end of (the) battle, X." = X waits for the end of this battle (END_BATTLE)
        body = m.group(1).strip(); body = body[0].upper() + body[1:]
        a, o = action_of(body, ctx)
        if o or not a or len(a) > 3: raise Review('sentence: ' + s[:140])
        return [{'do': 'END_BATTLE', 'then': a}], False
    if re.fullmatch(r'destroy this spirit\.?', s.strip(), re.I) and trig and not (trig & {'DESTROYED', 'DESTROYED_OPP', 'DESTROYED_OPPD', 'DESTROYED_OPPFX', 'LEAVES', 'LEAVES_OPPFX'}):
        return [{'do': 'DESTROY_SELF'}], False      # v0.78 the source destroys itself (own effect)
    if 'ALLY_BATTLE_WIN' in trig and SUBJ_REFRESH.match(s.strip()):      # v0.78 your Spirit that won the battle
        return [{'do': 'REFRESH', 'to': 'subject'}], False
    m = None if OPP_CORES_T.match(s.strip().rstrip('.')) else INSTEAD_PAIR.match(s.strip())      # v0.169: the core-removal upgrade clause is read by OPP_CORES_T itself
    if m: return instead_pair(m, ctx)
    m = COND_LEAD.match(s.strip())
    cond = cond_of(m.group(1)) if m else None
    if cond:
        if re.search(r'\binstead\b', s, re.I): raise Review('sentence: ' + s[:140])
        body = m.group(2).strip(); body = body[0].upper() + body[1:]
        a, o = action_of(body, ctx)
        if any(set(cond) & set(y.get('if') or {}) for y in a): raise Review('sentence: ' + s[:140])
        return [dict(y, **{'if': dict(y.get('if') or {}, **cond)}) for y in a], o
    if BURST_WORD.search(s): raise Review('Burst sentence: ' + s[:140])
    m = THEN_LEAD.match(s.strip())
    if m:      # v0.73 "Then, B." = B only when the previous action was done (CR Effect Texts "Then"; engine if.prev)
        body = m.group(1).strip(); body = body[0].upper() + body[1:]
        a, o = action_of(body, ctx)
        if not a or 'prev' in (a[0].get('if') or {}): raise Review('sentence: ' + s[:140])
        return [dict(a[0], **{'if': dict(a[0].get('if') or {}, prev=True)})] + a[1:], o
    m = AND_SPLIT.match(s.strip())
    if m:      # v0.73 "A, and B." = both, in order (each half must read on its own; an optional second half stays in review)
        try:
            a1, o1 = action_of(m.group(1).rstrip(',') + '.', ctx)
            b = m.group(2); a2, o2 = action_of(b[0].upper() + b[1:], ctx)
        except Review:
            a1 = None
        if a1 and not o2 and not any('prev' in (y.get('if') or {}) for y in a2): return a1 + a2, o1
    try:
        return _V1_ACTION_OF(s, ctx)
    except Review as e1:
        try:
            return grammar(s, ctx)
        except Review as e2:
            raise Review(str(e2) if str(e2).startswith('v2 ') and not str(e2).startswith('v2 clause') else str(e1)) from None


def sentences(body):
    out = []
    for x in _V1_SENTENCES(body):
        if out and re.fullmatch(r'then,? (?:if it has 0 ?bp,? destroy it|destroy it if it has 0 ?bp)\.?', x.strip(), re.I) and re.search(r'-\d[\d,]* ?bp\.$', out[-1], re.I):
            out[-1] = out[-1] + ' ' + x      # v0.68: "... give it -N BP. Then, if it has 0 BP, destroy it." is one effect
        elif out and re.match(r'^(?:you can )?show ', out[-1], re.I) and re.fullmatch(r'(?:return (?:them|it) to the deckbottom(?: in any order)?|for each card returned, draw a card|if (?:one|two|three) cards? (?:is|are) returned, draw (?:a|one|two|three|four|five) cards?)\.?', x.strip(), re.I):
            out[-1] = out[-1].rstrip() + ' ' + x      # v0.165: "Show ... to the opponent." + "Return them to the deckbottom." + "For each card returned, draw a card." is one effect
        elif out and REVEAL_HEAD.match(out[-1]) and not REVEAL_REST.search(out[-1]):
            out[-1] = out[-1] + ' ' + x      # v0.69: "Reveal N cards from your decktop." + "Among them, add ..." + "Return any remaining cards ..." is one effect
        elif out and re.fullmatch(r'If [^,.]+, (?:[^.]+? instead|instead,[^.]+)\.?', x.strip(), re.I) and out[-1].endswith('.') and 'instead' not in out[-1]:
            out[-1] = out[-1] + ' ' + x      # v0.135: the replacement belongs to the sentence before it
        elif out and re.fullmatch(WHEN_FX_TAIL + r'\.?', x.strip(), re.I) and out[-1].endswith('.'):
            out[-1] = out[-1] + ' ' + x      # v0.77: "When this effect destroys any Spirit, draw a card." belongs to the sentence before it
        elif out and re.fullmatch(r'The opponent targets a refreshed Spirit they control\.', out[-1].strip(), re.I) and re.fullmatch(r'Exhaust it\.?', x.strip(), re.I):
            out[-1] = out[-1] + ' ' + x      # v0.170: "The opponent targets a refreshed Spirit they control. Exhaust it." is one effect
        elif out and re.match(r'^(?:if (?:you control [^,.]+|returned), )?(?:(?:you can|you may) )?target ', out[-1], re.I) and out[-1].endswith('.'):
            out[-1] = out[-1] + ' ' + x      # join "Target X." with its action sentence
        else:
            out.append(x)
    return out


def lv_dash(t):
    """[LV1-2-3] -> [LV1][LV2][LV3]"""
    return re.sub(r'\[LV(\d(?:-\d)+)\]', lambda m: ''.join('[LV%s]' % d for d in m.group(1).split('-')), t or '')


RUSH_VAR = re.compile(r'\{\{Rush\|(Red|Purple|Green|White|Yellow|Blue)\}\}(\s*)\(While you have (?:an? )?\1 symbols?,? the following effects? activates? next\.?\)')


def rush_norm(t):
    """Rush reminder spellings (plural, period inside) -> the one v1 reads; one colour only (engine hasSymbol)"""
    return RUSH_VAR.sub(lambda m: '{{Rush|%s}}%s(While you have a %s symbol, the following effect activates next)' % (m.group(1), m.group(2), m.group(1)), t)


def burst_norm(t):
    """v0.71: older export spelling "\u263c[ Burst: <condition> ]" = {{Burst|<condition>}}"""
    return re.sub(r'\u263c\s*\[\s*Burst:\s*([^\]]+?)\s*\]', lambda m: '{{Burst|' + m.group(1) + '}}', t) if t and '\u263c' in t else t


AMPLIFY_TPL = re.compile(r'\{\{\s*Amplify\s*\|[^{}]*\}\}\s*', re.I)


def compile_card(c):
    t = c.get('text')
    if t and AMPLIFY_TPL.search(t):      # v0.169 {{Amplify|<family> +N}}: the printed "Pay one cost > For each ..." sentence carries the effect; the card gets keywords ['Amplify'] (match.keyword, Rock Pit)
        n = compile_card(dict(c, text=AMPLIFY_TPL.sub('', t)))
        n['keywords'] = sorted(set(n.get('keywords') or []) | {'Amplify'}); n['text'] = t
        return n
    t2 = burst_norm(t)
    if t2 != t: c = dict(c, text=t2); t = t2
    if t and '{{Rush|' in t:
        t2 = rush_norm(t)
        if t2 != t: c = dict(c, text=t2); t = t2
    if t and '[LV' in t and '-' in t:
        c = dict(c, text=lv_dash(t))
    alt, t0 = None, c.get('text')
    m = BURST_COST.search(t0 or '')
    if m:       # v0.71 "While you have a Burst set, this Spirit card in Hand becomes Cost N" = costAlt {cost, if: {burstSet}} (engine costAltActive)
        if c['type'] != 'Spirit': raise Review('Burst cost paragraph on a ' + c['type'])
        alt = {'cost': int(m.group(1)), 'if': {'burstSet': True}}
        c = dict(c, text=(t0[:m.start()] + '\n\n' + t0[m.end():]).strip())
    n = _V1_COMPILE(c)
    if alt:
        if n.get('costAlt'): raise Review('two cost changes')
        n['costAlt'] = alt; n['text'] = t0
    return n


BURST_COST = re.compile(r'(?:^|\n\s*\n)\s*While you have an? (?:set Burst|Burst set), this Spirit card in (?:your )?Hand becomes Cost (\d+)\.?\s*(?=\n\s*\n|$)', re.I)


def install():
    """route v1's helpers through v2 (module globals are looked up at call time)"""
    v1.action_of = action_of
    v1.sentences = sentences
    v1.clean = clean
    v1.COND_HOOK = cond_of


def uninstall():
    v1.action_of, v1.sentences, v1.clean = _V1_ACTION_OF, _V1_SENTENCES, _V1_CLEAN
    v1.COND_HOOK = None


def units(t):
    """v0.79 (A1): the raw text split like v1.paragraphs (blank lines, a new [LVn] line inside a block), but each unit keeps
    its line breaks, so the per-card preprocessing (Burst block, Legacy / True Release heads, Ultimate summon block) still
    sees what it expects when a subset is recompiled."""
    out = []
    for block in re.split(r'\n\s*\n', (t or '').replace('\r', '').strip()):
        cur = []
        for line in block.split('\n'):
            if cur and re.match(r'^\s*\[LV\d', line) and any(x.strip() for x in cur): out.append('\n'.join(cur)); cur = []
            cur.append(line)
        if any(x.strip() for x in cur): out.append('\n'.join(cur).strip())
    return out


def residual_text(u):
    x = re.sub(r'\s+', ' ', u).strip()
    return x if len(x) <= 400 else x[:398].rstrip() + ' …'


_GATE = None
def a1_gate():
    """data/glossary/a1-gate.json: staged cards held back from the partial promotion for a data reason (v0.79.0)"""
    global _GATE
    if _GATE is None:
        try: _GATE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data/glossary/a1-gate.json'), encoding='utf8'))['cards']
        except FileNotFoundError: _GATE = {}
    return _GATE


def compile_partial(c):
    """v0.79 (A1, owner 2026-10-20): a card may enter the library with part of its effect missing. Each paragraph is either
    compiled in full or left out (a sentence that does not compile drops its whole paragraph to `residual`: a half paragraph
    could misplay, e.g. a cost paid with no effect). Paragraphs are added in printed order and kept only when the card still
    compiles with them. Card-level problems (no level data, Brave without combine data, two text versions, an Ultimate
    without its summon block, a Magic with no compiled timing) still raise Review: those cards stay staged.
    Returns (card, residual list); [] = complete."""
    try:
        return compile_card(c), []
    except Review as e:
        first = e
    why = a1_gate().get(c['id'])
    if why: raise Review('A1 data gate: ' + why)
    us = units(c.get('text'))
    keep, rest = [], []
    for u in us:
        try:
            compile_card(dict(c, text='\n\n'.join(keep + [u]))); keep.append(u)
        except Review:
            rest.append(u)
    if rest and keep:      # a dropped paragraph may compile once a later one is in (rare); one more pass
        for u in list(rest):
            trial = [x for x in us if x in keep or x == u]
            try:
                compile_card(dict(c, text='\n\n'.join(trial))); keep = trial; rest.remove(u)
            except Review:
                pass
    if not rest: raise first          # every paragraph compiles alone but not together: leave it to review
    try:
        n = compile_card(dict(c, text='\n\n'.join(keep)))
    except Review:
        raise first
    if c['type'] == 'Magic' and not (n.get('magic') or {}).get('timing'): raise first
    if len(rest) > 12: raise Review('more than 12 residual paragraphs')
    n['text'] = c.get('text')
    if c['type'] == 'Ultimate':
        try: n['text'] = v1.ultimate_text(c, c.get('text'))[2]
        except Review: pass
    n['fxComplete'] = False
    n['residual'] = [residual_text(u) for u in rest]
    return n, n['residual']


def run(cards, partial=False):
    install()
    try:
        ok, rev = [], []
        for c in cards:
            try: ok.append(compile_partial(c)[0] if partial else compile_card(c))
            except Review as e: rev.append((c['id'], c['name'], str(e), c.get('saga')))
        return ok, rev
    finally:
        uninstall()


def blockers(c):
    """every reason a staged card is not compiled (one per paragraph / template), for the lever table.
    Must run with install() active. [] = the card compiles."""
    if c.get('text') and AMPLIFY_TPL.search(c['text']): c = dict(c, text=AMPLIFY_TPL.sub('', c['text']))      # v0.169
    try:
        compile_card(c); return []
    except Review as e:
        first = str(e)
    if c['type'] not in ('Spirit', 'Brave', 'Nexus') or not c.get('levels'): return [first]
    out = []
    t = v1.invoke_mark(v1.TRUE_RELEASE.sub('[LV2] ', v1.LEGACY_HEAD.sub('', lv_dash(burst_norm(c.get('text')) or ''), count=1)))      # v0.68: Invoke + True Release heads are read; v0.69: the (Legacy) head too
    try:
        b, t = v1.burst_block(t)
    except Review as e:
        out.append(str(e)); t = re.sub(r'\{\{[Bb]urst\|[^}]*\}\}', '', t)
    t = v1.armor_mark(v1.rush_mark(t))
    labels = v1.VERSION_LABEL.findall(t)
    if len(labels) > 1: return [first]
    t = v1.VERSION_LABEL.sub('', t).strip()
    for p in v1.paragraphs(t):
        tpl = re.findall(r'\{\{\s*([#\w]+)', p)
        if tpl: out.append('wiki template {{' + tpl[0] + '}}'); continue
        if v1.flag_para(p): continue
        try: v1.spirit_paragraph(p, c)
        except Review as e: out.append(str(e))
    return sorted(set(reason_key(x) for x in out)) or [first]


def reason_key(r):
    if r.startswith('v2 clause'): return 'v2 clause: ' + ' '.join(r[11:].split()[:2])
    if r.startswith('v2 '): return r
    if r.startswith('sentence:'):
        x = re.sub(r'^(?:(?:you can|you may|then,|during this turn,|once per turn,)\s*)+', '', r[10:].lower())
        return 'sentence: ' + ' '.join(x.split()[:3])
    if r.startswith('no trigger:'):
        x = r[12:]
        return 'no trigger: ' + (re.match(r'^\([^)]*\)', x).group(0) if x.startswith('(') else ' '.join(x.split()[:3]))
    if r.startswith('wiki template'): return r
    return re.sub(r':.*', '', r)


def main(argv):
    sel = lambda c: True
    if '--saga' in argv: s = int(argv[argv.index('--saga') + 1]); sel = lambda c, s=s: c.get('saga') == s
    if '--ids' in argv: ids = set(argv[argv.index('--ids') + 1].split(',')); sel = lambda c, ids=ids: c['id'] in ids
    pool = [c for c in v1.staged() if sel(c)]
    part = '--partial' in argv       # v0.79 (A1): also emit partial cards (fxComplete false + residual)
    ok, rev = run(pool, part)
    reasons = collections.Counter(reason_key(r[2]) for r in rev)
    if part: print(f'partial mode: complete {sum(1 for c in ok if not c.get("residual"))}, partial {sum(1 for c in ok if c.get("residual"))}')
    print(f'v2 compiled {len(ok)}, review {len(rev)}  ' + ', '.join(f'{k} {v}' for k, v in reasons.most_common(6)))
    if '--out' in argv:
        json.dump(ok, open(argv[argv.index('--out') + 1], 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if '--report' in argv:
        by_saga = collections.Counter(c.get('saga') for c in ok)
        v2only = [r for r in rev if r[2].startswith('v2 ') and not r[2].startswith('v2 clause')]
        with open(argv[argv.index('--report') + 1], 'w', encoding='utf-8') as f:
            f.write('# Effect compiler v2 report (generated by tools/compile_v2.py; do not edit)\n\n')
            f.write(f'Staged pool: {len(pool)} cards. v2 compiles {len(ok)}; {len(rev)} stay in review.\n\n')
            f.write('Compiled per Saga: ' + ', '.join(f'{k}: {v}' for k, v in sorted(by_saga.items(), key=lambda x: -(x[0] or 0))) + '\n\n')
            f.write('## First review reason (top 60)\n\n| Reason | Cards |\n|---|---|\n')
            for k, v in reasons.most_common(60): f.write(f'| {k.replace("|", "/")} | {v} |\n')
            f.write('\n## Clauses the grammar read but the engine cannot do yet (engine levers)\n\n| Verb: missing | Cards |\n|---|---|\n')
            for k, v in collections.Counter(r[2] for r in v2only).most_common(): f.write(f'| {k.replace("|", "/")} | {v} |\n')
            install()
            try:
                bl = [blockers(c) for c in pool if c['id'] in {r[0] for r in rev}]
            finally:
                uninstall()
            one = collections.Counter(b[0] for b in bl if len(b) == 1)
            per = collections.Counter(min(len(b), 4) for b in bl)
            f.write('\n## Levers: cards whose only blocker is this one (top 50)\n\n')
            f.write('Blockers per review card (one per failing paragraph or template; within a paragraph only the first failing sentence counts): '
                    + ', '.join(f'{k}{"+" if k == 4 else ""}: {v}' for k, v in sorted(per.items())) + '.\n'
                    'Fixing one row unlocks at most that many cards (the text still has to be read against the JSON).\n\n| Only blocker | Cards |\n|---|---|\n')
            for k, v in one.most_common(50): f.write(f'| {k.replace("|", "/")} | {v} |\n')
    return ok, rev


if __name__ == '__main__':
    main(sys.argv[1:])
