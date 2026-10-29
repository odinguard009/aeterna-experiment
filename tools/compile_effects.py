#!/usr/bin/env python3
"""Effect compiler (v0.52.0; v0.54.0: (When Destroyed), Spirit/Ultimate targets, Your Attack Step BP, colour + symbol, Burst block, more sentences;
v0.55.0: BP minus, (When Destroyed by the Opponent), (When Battles) battle win, Rush {{Rush|Colour}}): staged card text (data/import/saga-NN.json) -> engine data ("effects", "magic", flags).
  python3 tools/compile_effects.py --saga 1                -> compile one Saga; prints a summary
  python3 tools/compile_effects.py --vanilla               -> every staged card without text
  python3 tools/compile_effects.py --saga 1 --out F.json   -> also write the compiled cards (promotion input)
  python3 tools/compile_effects.py ... --review R.md       -> also write the review list (every paragraph it could not map)
  python3 tools/compile_effects.py --ids BS01-001,BS01-002 ...
A card compiles only when EVERY paragraph of its text maps to engine data; anything else goes to the review list and the
card stays staged (no partial promotion). The patterns cover the wired glossary tags only (data/glossary/effects.json,
status "wired"); each pattern is written for the wording the Fandom export uses, old (Saga 1-2) and current.
Not handled on purpose (review): wiki templates ({{...}}), cards with more than one text version (errata tabs), Nexus
cards with [LV2]+ text (the export has no Nexus level thresholds), Braves without combine data, Burst conditions the engine
has no slot for (and Burst text that is not a leading {{Burst|...}} block), any keyword or
sentence not in the tables below. The output still has to pass the game's parseCard (tools/promote_compiled.mjs)."""
import json, glob, os, re, sys, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
KEEP = ('id', 'name', 'name_jp', 'type', 'color', 'cost', 'reduction', 'symbols', 'levels', 'families', 'text', 'image', 'block', 'saga', 'brave', 'ex_symbols')
NUM = {'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8}
num = lambda s: int(s) if s.isdigit() else NUM[s.lower()]
W = r'(\d+|a|an|one|two|three|four|five)'
COLOURS = ('red', 'purple', 'green', 'white', 'yellow', 'blue')


class Review(Exception):
    pass


# ---------- text clean-up ----------
VERSION_LABEL = re.compile(r'(?m)^\s*(Original \(Jap Version\)|Original|Jap Version|Japanese Ver\.|After Errata|Before Errata|Standard|Eng Version|Eternal)\s*=\s*')

def clean(text):
    t = (text or '').replace('\r', '').strip()
    labels = VERSION_LABEL.findall(t)
    if len(labels) > 1: raise Review('more than one text version (' + ', '.join(labels) + ')')
    t = VERSION_LABEL.sub('', t).strip()
    m = re.search(r'\{\{\s*([#\w]+)', t)
    if m: raise Review('wiki template {{' + m.group(1) + '}}')
    if '☼' in t or re.search(r'\bBurst\b', t): raise Review('Burst')
    return t


def paragraphs(t):
    out = []
    for block in re.split(r'\n\s*\n', t):
        cur = []
        for line in block.split('\n'):
            line = line.strip()
            if not line: continue
            if cur and re.match(r'^\[LV\d', line): out.append(' '.join(cur)); cur = []     # a new [LVn] block on its own line
            cur.append(line)
        if cur: out.append(' '.join(cur))
    return [re.sub(r'\s+', ' ', p).strip() for p in out]


def sentences(body):
    s = re.split(r'(?<=\.)\s+(?=[A-Z])', body.strip())
    return [x.strip() for x in s if x.strip()]


# ---------- sentence -> action(s) ----------
def bp(s): return int(s.replace(',', ''))


def all_have_cond(x):
    """v0.131 "all your Spirits are Cost 2/4/6/8 with the "X" family" / "all your Spirits/Nexuses have the "X" family" -> engine allHave"""
    m = re.fullmatch(r'all your spirits are cost ((?:\d/)*\d) with the "([^"]+)" family', x.strip(), re.I)
    if m: return {'allHave': {'family': m.group(2), 'costIn': [int(v) for v in m.group(1).split('/')], 'spiritsOnly': True}}
    m = re.fullmatch(r'all your spirits/nexuses have the "([^"]+)" family', x.strip(), re.I)
    if m: return {'allHave': {'family': m.group(1)}}
    m = re.fullmatch(r'all your spirits/nexuses have (Green Wave|Red Stella|Blue Beat|Yellow Rise)', x.strip(), re.I)   # team names, as printed on [Team:] lines
    return {'allHave': {'team': m.group(1).title()}} if m else None

COND_HOOK = None      # v0.166: set by compile_v2.install() to its cond_of (the fxIf condition reader)

def bpm(s):
    n = bp(s)
    if n % 1000 or not 1000 <= n <= 30000: raise Review(f'BP minus {n} (engine: 1000-30000 in steps of 1000)')
    return n

def crush_n(k):
    if k > 5: raise Review(f'decktop discard of {k} cards (engine limit 5)')
    return k

def action_of(s, ctx):
    """One sentence -> (actions, optional, static) or raise Review. ctx: {'trigger': ..., 'kind': 'spirit'|'magic'}"""
    x = s.strip().rstrip('.').strip()
    opt = False
    m = re.match(r'^(?:You can|You may) (.*)$', x, re.I)
    if m: opt = True; x = m.group(1); x = x[0].upper() + x[1:]
    L = x.lower()
    if 'opposing' in L: L = L.replace('spirit/ultimate', 'spirit')      # v0.54: the engine's opposing targets already include Ultimates
    fam = [   # v0.54: family names keep their case
        (r'^refresh an? "([^"]+)" family spirit (?:you control|of yours)$', lambda m: [{'do': 'REFRESH_SPIRIT', 'match': {'family': [m.group(1)]}}]),
        (r'^(?:during this turn, )?' + PER_NP + r',? (?:during this turn,? )?this spirit (?:gains|gets) \+(\d[\d,]*) ?bp(?: (?:until (?:the )?end of (?:the )?turn|during this turn))?$',
         lambda m: [{'do': 'BP_PLUS', 'n': bp(m.group(7)), 'per': per_of(m)}]),      # v0.72 "For each X you control, this Spirit gains +N BP"; v0.163 also "..., during this turn, this Spirit gains" (the clause after the count)
        (r'^this spirit (?:gains|gets) \+(\d[\d,]*) ?bp ' + PER_NP + r'(?: (?:until (?:the )?end of (?:the )?turn|during this turn))?$',
         lambda m: [{'do': 'BP_PLUS', 'n': bp(m.group(1)), 'per': per_of(re.match(PER_NP, m.group(0)[m.group(0).lower().index('for each'):], re.I))}]),      # v0.163 "This Spirit gains +N BP for each X you control"
    ]
    if 'ALLY_ATTACKS' in (ctx.get('trigger') or ()):      # v0.59: "that Spirit" = the attacking ally (engine target 'attacker')
        m = re.match(r'^that spirit (?:gains|gets) \+(\d[\d,]*) ?bp(?: (?:during|until the end of) this turn)?$', L)
        if m: return [{'do': 'BP_PLUS', 'n': bp(m.group(1)), 'to': 'attacker'}], opt
    for p, f in fam:
        m = re.match(p, x, re.I)
        if m: return f(m), opt
    pats = [
        (r'^(?:during this turn, )?this spirit (?:gains|gets) \+(\d[\d,]*) ?bp(?: (?:until (?:the )?end of (?:the )?turn|during this turn))?$',
         lambda m: [{'do': 'BP_PLUS', 'n': bp(m.group(1))}]),
        (r'^(?:during this turn, )?give (?:all your spirits|all spirits you control|all of your spirits) \+(\d[\d,]*) ?bp$',
         lambda m: [{'do': 'BP_PLUS', 'n': bp(m.group(1)), 'to': 'own'}]),
        (r'^(?:during this turn, )?all (?:your spirits|spirits you control) (?:gain|get) \+(\d[\d,]*) ?bp(?: until (?:the )?end of (?:the )?turn)?$',
         lambda m: [{'do': 'BP_PLUS', 'n': bp(m.group(1)), 'to': 'own'}]),
        (r'^draw ' + W + r' cards?$', lambda m: [{'do': 'DRAW', 'n': num(m.group(1))}]),
        (r'^destroy an opposing (\d[\d,]*) ?bp or less spirit$', lambda m: [{'do': 'DESTROY', 'bpLe': bp(m.group(1))}]),
        (r'^destroy an opposing spirit with (\d[\d,]*) ?bp or less$', lambda m: [{'do': 'DESTROY', 'bpLe': bp(m.group(1))}]),
        (r'^destroy (?:an opposing|one opposing|target) nexus(?: (?:your opponent controls|the opponent controls))?$', lambda m: [{'do': 'DESTROY', 'nexus': True}]),
        (r'^exhaust an opposing spirit$', lambda m: [{'do': 'EXHAUST_OPP', 'n': 1}]),
        (r'^refresh this spirit$', lambda m: [{'do': 'REFRESH'}]),
        (r'^put ' + W + r' cores? from the void (?:on|to|onto) this spirit$', lambda m: [{'do': 'VOID_TO_CARD', 'n': num(m.group(1)), 'to': 'self'}]),
        (r'^put ' + W + r' cores? from the void (?:in|to|into) your reserve$', lambda m: [{'do': 'VOID_TO_RESERVE', 'n': num(m.group(1))}]),
        (r'^your counter \+(\d)$', lambda m: [{'do': 'COUNTER', 'n': int(m.group(1))}]),
        (r'^return an opposing spirit to (?:the|its owner\'s|their) hand$', lambda m: [{'do': 'BOUNCE_OPP', 'to': 'hand', 'kind': 'spirit'}]),
        (r'^destroy an opposing cost (\d+) or less spirit$', lambda m: [{'do': 'DESTROY', 'costLe': int(m.group(1))}]),
        (r'^put ' + W + r' cores? from the void (?:on|to|onto) (?:any|one) of your spirits$', lambda m: [{'do': 'VOID_TO_CARD', 'n': num(m.group(1)), 'to': 'anySpirit'}]),
        # v0.54 patterns (existing engine actions only)
        (r'^refresh (?:a spirit you control|one of your spirits|a spirit of yours)$', lambda m: [{'do': 'REFRESH_SPIRIT'}]),
        (r'^send (?:a|one) core from (?:any |an |one )?opposing spirits? to (?:their|the|its owner\'s|the opposing) reserve$', lambda m: [{'do': 'OPP_CORES_TO_RESERVE', 'targets': 1, 'each': 1}]),
        (r'^draw ' + W + r' cards?, then return ' + W + r' cards? from your hand to the deck ?bottom(?: in any order)?$', lambda m: [{'do': 'LOOT', 'draw': num(m.group(1)), 'discard': num(m.group(2)), 'to': 'deckBottom'}]),   # v0.159
        (r'^draw ' + W + r' cards?, then discard ' + W + r' cards? from your hand$', lambda m: [{'do': 'LOOT', 'draw': num(m.group(1)), 'discard': num(m.group(2))}]),
        (r'^draw ' + W + r' cards? from (?:the|your) deck ?bottom$|^draw ' + W + r' cards? from the bottom of your deck$', lambda m: [{'do': 'DRAW_BOTTOM', 'n': num(m.group(1) or m.group(2))}]),
        (r'^draw ' + W + r' cards? from your deck$', lambda m: [{'do': 'DRAW', 'n': num(m.group(1))}]),
        (r'^put ' + W + r' cores? from the void (?:on|to|onto) (?:any|a|one) spirit (?:you control|of yours)$', lambda m: [{'do': 'VOID_TO_CARD', 'n': num(m.group(1)), 'to': 'anySpirit'}]),
        (r'^destroy an opposing spirit with (?:one|1) core on it$', lambda m: [{'do': 'DESTROY', 'coresLe': 1}]),
        (r'^destroy an opposing spirit with ' + W + r' cores? or less on it$', lambda m: [{'do': 'DESTROY', 'coresLe': num(m.group(1))}]),
        (r'^discard ' + W + r' cards? from the opposing deck ?top$|^discard ' + W + r' cards? from the top of the opposing deck$', lambda m: [{'do': 'CRUSH', 'n': crush_n(num(m.group(1) or m.group(2)))}]),
        (r'^put ' + W + r' cores? from the void (?:on|to|onto|in|into) your life$', lambda m: [{'do': 'VOID_TO_LIFE', 'n': num(m.group(1))}]),
        # v0.55: BP minus on one opposing Spirit (no BP-0 destruction rule: Eternal manual FAQ p. 68)
        (r'^(?:during this turn, )?give (?:an|one) opposing spirit -(\d[\d,]*) ?bp(?: (?:during|until the end of) this turn)?$', lambda m: [{'do': 'BP_MINUS', 'n': bpm(m.group(1))}]),
    ]
    for p, f in pats:
        m = re.match(p, L)
        if m: return f(m), opt
    raise Review('sentence: ' + s[:140])


# v0.72 "for each <colour> <"F" family | "N"-named> Spirit/Nexus you control" -> engine "per" {type, colors, family, name}
TEAMS = 'Red Stella|Green Wave|Blue Beat|Yellow Rise'      # team names printed on [Team:] lines (engine cardTeams)
PER_NP = r'for each (?:(red|purple|green|white|yellow|blue) )?(?:"([^"]+)" family |"([^"]+)"-named |(' + TEAMS + r') )?(spirit|nexus)(?:es|s)?(?: with ([A-Z][a-z]+))? (?:you control|on your field)'

def per_of(m):
    q = {'type': m.group(5).capitalize()}
    if m.group(4): q['team'] = m.group(4).title()
    if m.group(1): q['colors'] = [m.group(1).lower()]
    if m.group(2): q['family'] = m.group(2)
    if m.group(3): q['name'] = m.group(3)
    if m.group(6): q['keyword'] = m.group(6)      # v0.167 "for each Spirit with Legacy you control" (engine per.keyword)
    return q

PER_STATIC = re.compile(r'^(\(During Attack\)\s*)?' + PER_NP + r',? this spirit (?:gains|gets) \+(\d[\d,]*) ?bp\.?$', re.I)
PER_STATIC_TAIL = re.compile(r'^(\(During Attack\)\s*)?this spirit (?:gains|gets) \+(\d[\d,]*) ?bp (' + PER_NP + r')\.?$', re.I)      # v0.184 old trailing wording 'This spirit gets +N BP for each X you control'
BATTLE_HEADS = [      # v0.72 heads read before TRIGGERS: (trigger list, extra effect keys)
    (r'\(When Attacks\)\s*When this Spirit is blocked,', ['ALLY_BLOCKED'], {'self': True}),      # v0.183 Windstorm
    (r'When your Spirit is blocked,', ['ALLY_BLOCKED'], {'match': {'noUlt': True}}),      # v0.185 any ally Spirit
    (r'\(During Attack\)\s*When blocked,', ['ALLY_BLOCKED'], {'self': True}),      # v0.185 same event as '(When Attacks) When this Spirit is blocked,'
    (r"\((?:During Attack|When Attacks)\)\s*When this Spirit's attack reduces the opposing Life,", ['ALLY_LIFE_HIT'], {'self': True}),
    (r'\(During Attack\)\s*When only the opposing Spirit(?:/Ultimate)? is destroyed (?:by comparing BP|via BP comparison|by BP comparison),', ['BATTLE_WIN'], {'attackingOnly': True}),
    # v0.74: "(When Attacks) When only the opposing Spirit is destroyed ..." = the battle result as the attacker, "(When Blocks) ..." as the blocker
    (r'\(When Attacks\)\s*When only the opposing Spirit(?:/Ultimate)? is destroyed(?: (?:by comparing BP|via BP comparison|by BP comparison))?,', ['BATTLE_WIN'], {'attackingOnly': True}),
    (r'\(When Blocks\)\s*When only the opposing Spirit(?:/Ultimate)? is destroyed(?: (?:by comparing BP|via BP comparison|by BP comparison))?,', ['BATTLE_WIN'], {'blockingOnly': True}),
]


# ---------- Spirit / Nexus paragraphs ----------
TRIGGERS = [
    (r'\(When Summoned/Attacks\)', ['SUMMONED', 'ATTACKS']),
    (r'\(When Summoned/Destroyed\)', ['SUMMONED', 'DESTROYED']),      # v0.54: (When Destroyed) = engine trigger DESTROYED (manual p. 31)
    (r'When cards with EX Symbols are discarded by your Rumble,', ['RUMBLE_DISCARD+EX']),      # v0.185 engine RUMBLE_DISCARD (exOnly)
    (r'When cards are discarded from the opposing deck by your Rumble, besides this Spirit\'s,', ['RUMBLE_DISCARD+OTHER']),
    (r'When this Spirit becomes the target of Tribute,', ['TRIBUTED']),      # v0.183 engine TRIBUTED (tributePay)
    (r'\(When Destroyed\)', ['DESTROYED']),
    (r'\(When Depleted/Destroyed by the Opponent\)', ['DESTROYED_OPPD']),      # v0.177 engine alsoDepleted
    (r'\(When Destroyed by the Opponent\)', ['DESTROYED_OPP']),      # v0.55: CR 12-2-1-12-1 (opposing effect or BP comparison)
    (r'When this Spirit is destroyed by the opponent,', ['DESTROYED_OPP']),      # v0.73 leave heads (docs/mechanics/leave-heads.md)
    (r'When this Spirit is destroyed by (?:opposing effects|an opposing effect),', ['DESTROYED_OPPFX']),
    (r'When this Spirit would leave the [Ff]ield due to the opponent,', ['LEAVES']),
    (r'When this Spirit would leave the [Ff]ield (?:due to|by) (?:opposing effects?|an opposing effect),', ['LEAVES_OPPFX']),
    (r'(?:\(When (?:Battles|Attacks/Blocks|Attacks or Blocks)\)\s*)?When only the opposing Spirit(?:/Ultimate)? is destroyed(?: (?:by comparing BP|via BP comparison|by BP comparison))?,', ['BATTLE_WIN']),   # v0.55: CR 8-1-6-2; v0.74: the "(When Battles)" head and the "by BP comparison" words are optional in the older texts
    (r'\(When Attacks/Blocks\)|\(When Attacks or Blocks\)', ['ATTACKS+BLOCKS']),
    (r'\(When Battles\)', ['ATTACKS+BLOCKS']),      # v0.78: (When Battles) = this Spirit attacks or blocks (house reading, only with an end-of-battle body)
    (r'\(When Summoned\)', ['SUMMONED']),
    (r'\(When Deployed\)', ['SUMMONED']),      # v0.135: the Nexus form of When Summoned (the engine fires SUMMONED for a deployed Nexus)
    (r'\(When Attacks\)', ['ATTACKS']),
    (r'\(When Blocks\)|\(When Blocking\)', ['BLOCKS']),
    (r'\(Your End Step\)', ['END_STEP']),      # v0.169: fired by the engine at the owner's End Step (07-turn endStep)
    (r'\(Start of Your Attack Step\)', ['START_ATTACK']),      # v0.169: the engine trigger already existed (hand-written cards); the compiler reads the head now
]
SELF_ACTS = ('REFRESH', 'VOID_TO_CARD', 'BP_PLUS', 'SELF_TO_HAND', 'CRUSH', 'AWAKEN')   # these need the Spirit on the Field
ATTACK_STEP = {'(Your Attack Step)': {'attackStep': True, 'oppTurn': False}}
KEYWORD_LINES = {   # keyword -> handler(levels, body) returning effect list and card flags
    'Crush': 'crush', 'Holy Life': 'holy', 'High Speed': 'speed', 'Clash': 'clash',
    'Curse': 'curse', 'Brilliance': 'brilliance',      # v0.78 end-of-battle keywords (docs/mechanics/end-of-battle.md)
}
CURSE_TEXT = re.compile(r'^\((?:When Attacks|During Your Battle Phase)\)\s*(?:Destroy an opposing Spirit that blocked(?: when the battle resolves)? at the end of (?:the )?battle'
                        r'|Each time this spirit is blocked, destroy the spirit that blocked this spirit at (?:the )?End of Battle(?: Step)?)\.?$', re.I)
BRILLIANCE_TEXT = re.compile(r'^\(When Attacks\)\s*At the end of (?:the )?battle, return every Magic card you used during this battle (?:from your Trash )?to your Hand\.?$', re.I)

# v0.78 ally battle result: "When only the opposing [attacking|blocking] Spirit is destroyed by comparing BP [during battle] [with your X]," (CR 8-1-6-2)
ALLY_WIN = re.compile(r'^When only the opposing (attacking |blocking )?Spirit(?:/Ultimate)? is destroyed (?:by comparing BP|via BP comparison|by BP comparison)(?: during (?:the )?battle)?(?: with your (.+?))?,\s*', re.I)
NUMS = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5}


def ally_np(x):
    """'"A"/"B" family Spirits' | '"A"-named Spirit' | '[A]/[B]' | 'Spirit with two or more symbols' | '<Colour> Spirit' -> engine match"""
    x = x.strip()
    m = re.fullmatch(r'((?:"[^"]+"/?)+) family Spirits?', x)
    if m: return {'family': re.findall(r'"([^"]+)"', m.group(1)), 'noUlt': True}
    m = re.fullmatch(r'((?:"[^"]+"/?)+)-named Spirits?', x)
    if m: return {'name': re.findall(r'"([^"]+)"', m.group(1)), 'noUlt': True}
    m = re.fullmatch(r'((?:\[[^\]]+\]/?)+)', x)
    if m: return {'name': [n.strip() for n in re.findall(r'\[([^\]]+)\]', m.group(1))], 'noUlt': True}
    m = re.fullmatch(r'Spirits? with (one|two|three|four|five|\d) or more symbols', x, re.I)
    if m: return {'symbolsGe': NUMS.get(m.group(1).lower()) or int(m.group(1)), 'noUlt': True}
    m = re.fullmatch(r'(Red|Purple|Green|White|Yellow|Blue) Spirits?', x)
    if m: return {'color': m.group(1).lower(), 'noUlt': True}
    raise Review('ally battle result with your ' + x[:40])


def ally_win(p, side=None):
    """None, or (rest of the paragraph, match, extra keys) for an ALLY_BATTLE_WIN head; side = 'att' | 'blk' from a step head"""
    m = ALLY_WIN.match(p)
    if not m or not (m.group(1) or m.group(2)): return None
    tm = ally_np(m.group(2)) if m.group(2) else {}
    s2 = {'attacking ': 'blk', 'blocking ': 'att'}.get((m.group(1) or '').lower())
    if side and s2 and side != s2: raise Review('ally battle result on the wrong side: ' + p[:60])
    side = side or s2
    ex = {'attackingOnly': True} if side == 'att' else {'blockingOnly': True} if side == 'blk' else {}
    return p[m.end():], tm, ex

RUSH = re.compile(r'(?<!\n)[ \t]*\n?[ \t]*\{\{Rush\|((?:Red|Purple|Green|White|Yellow|Blue)(?:/(?:Red|Purple|Green|White|Yellow|Blue))*)(?: Symbol)?\}\}\s*\(While you have an? \1 symbol, the following effect activates next\)\s*:?\s*', re.I)
RUSH_MARK = ' \u27e6RUSH:%s\u27e7 '

def rush_sym(c):
    """v0.184: "purple/yellow" -> ['purple', 'yellow'] (both symbols needed, hasSymbol list); one colour stays a string"""
    l = c.split('/'); return l[0] if len(l) == 1 else l

def rush_mark(t):
    """v0.55: {{Rush|Colour}} + its reminder line -> an in-paragraph marker (the Rush effect activates after the main body while you have that symbol)"""
    return RUSH.sub(lambda m: RUSH_MARK % m.group(1).lower(), t or '')

ARMOR_TPL = re.compile(r'\{\{\s*(Armor|ha|ua|uha)\s*\|\s*([A-Za-z/ ]+?)\s*\}\}\s*', re.I)
ARMOR_MARK = '\u27e6ARMOR:%s:%s\u27e7 '
ARMOR_KIND = {'armor': 'Armor', 'ha': 'Heavy Armor', 'ua': 'Ultra Armor', 'uha': 'Ultimate Heavy Armor'}
FX_TYPES = ('Spirit', 'Brave', 'Ultimate', 'Nexus', 'Magic')

def armor_mark(t):
    """v0.58: {{Armor|Red}} / {{ha|..}} / {{ua|..}} / {{uha|..}} -> an in-text marker read by unaffected_para"""
    return ARMOR_TPL.sub(lambda m: ARMOR_MARK % (ARMOR_KIND[m.group(1).lower()], m.group(2).replace(' ', '')), t or '')

def colour_list(s):
    cs = [x.strip().lower() for x in s.split('/')]
    if not cs or any(x not in COLOURS for x in cs): raise Review('Armor colours: ' + s)
    return cs

UNAFF = re.compile(r'^(?:\u27e6ARMOR:([A-Za-z ]+):([A-Za-z/]+)\u27e7\s*|(Armor|Heavy Armor|Ultra Armor)\s*:\s*([A-Za-z/]+)\s*-\s*)?'
                   r'(This Spirit is|All your "([^"]+)" family Spirits are) unaffected by opposing '
                   r'((?:(?:Red|Purple|Green|White|Yellow|Blue)/?)+ )?((?:(?:Spirit|Brave|Ultimate|Nexus|Magic)/?)+ )?effects'
                   r'(?: of the (?:specified|stated) colou?rs?)?\.?$')

GIVE_ARMOR = re.compile(r'^Give (?:all|every) your (?:(Red|Purple|Green|White|Yellow|Blue) |"([^"]+)" family |"([^"]+)"-named )?Spirits?(?: with ([A-Z][A-Za-z]+))?:\s*"?⟦ARMOR:(Armor|Heavy Armor|Ultra Armor):([A-Za-z/]+)⟧\s*(?:This Spirit is unaffected by opposing [A-Za-z/]+ [A-Za-z/]+ effects\.?")?\s*\.?$')
GIVE_ARMOR2 = re.compile(r'^Give (?:all|every) (?:your )?(?:(?:(?P<fam>(?:"[^"]+"\s*/\s*)*"[^"]+") family |"(?P<nm>[^"]+)"-named )?Spirits?)(?: you control)?(?: the effect)?:\s*"?⟦ARMOR:(Armor|Heavy Armor|Ultra Armor):([A-Za-z/]+)⟧\s*(?:- )?(?:This Spirit is unaffected by opposing [A-Za-z/]+ [A-Za-z/]+ effects\.?")?\s*\.?$')
PLAIN_GIVE_ARMOR = re.compile(r'^Give all your (?:"([^"]+)" family )?(?:"([^"]+)"-named )?Spirits:\s*(Armor|Heavy Armor|Ultra Armor): ?([A-Za-z/]+)\.?$', re.I)
ARMOR_TYPES = {'armor': ['Spirit', 'Nexus', 'Magic'], 'heavy armor': ['Spirit', 'Brave', 'Nexus', 'Magic'], 'ultra armor': ['Spirit', 'Ultimate', 'Nexus', 'Magic']}

def unaffected_para(p):
    """v0.58 session E: Armor / Heavy Armor / Ultra Armor and plain "unaffected by opposing <colour> <types> effects" -> STATIC UNAFFECTED.
    Returns (effect, keyword) or None when p is not such a paragraph."""
    if '\u27e6ARMOR' not in p and not re.search(r'unaffected by opposing', p) and not PLAIN_GIVE_ARMOR.match(p): return None
    g = GIVE_ARMOR.match(p)
    if not g and (g2 := GIVE_ARMOR2.match(p)):      # v0.184 "Give every "X"-named Spirit you control: / Give all your "A"/"B" family Spirits: / Give every Spirit you control the effect: {{ha|Red}} - ..."
        g = type('G', (), {'group': lambda self, i, g2=g2: (None, g2.group('fam') or (g2.group('nm') and '"%s"' % g2.group('nm')), None, None, g2.group(3), g2.group(4))[i - 1]})()
    if not g and (pg := PLAIN_GIVE_ARMOR.match(p)):      # v0.184 the same grant printed without the {{armor}} template ("Give all your X family Spirits: Heavy Armor: Purple.")
        g = type('G', (), {'group': lambda self, i, pg=pg: (None, pg.group(1), pg.group(2), None, pg.group(3), pg.group(4))[i - 1]})()
    if g:      # v0.181 "Give all your <selector> Spirits: {{armor|Colours}}" = STATIC UNAFFECTED for the matching own cards
        cols = colour_list(g.group(6)); types = ARMOR_TYPES[g.group(5).lower()]
        e = {'trigger': 'STATIC', 'flag': 'UNAFFECTED', 'to': 'own', 'from': {'colors': cols, 'types': types}}
        mt = {}
        if g.group(1): mt['color'] = [g.group(1).lower()]
        if g.group(2): mt['family'] = re.findall(r'"([^"]+)"', g.group(2)) if g.group(2).startswith('"') else [g.group(2)]
        if g.group(3): mt['name'] = [g.group(3)]
        if g.group(4): mt['keyword'] = g.group(4)
        if mt: e['match'] = mt
        return e, None
    m = UNAFF.match(p)
    if not m:
        if '\u27e6ARMOR' in p or re.match(r'^(?:Armor|Heavy Armor|Ultra Armor)\s*:', p): raise Review('Armor text: ' + p[:80])
        return None
    kw = m.group(1) or m.group(3)
    kcols = colour_list(m.group(2) or m.group(4)) if kw else None
    bcols = colour_list(m.group(7).strip()) if m.group(7) else None
    if kcols and bcols and kcols != bcols: raise Review('Armor colours differ: ' + p[:80])
    cols = bcols or kcols
    if kw and not cols: raise Review('Armor without colours: ' + p[:60])
    types = [x for x in m.group(8).strip().split('/') if x] if m.group(8) else None
    if types and (len(set(types)) != len(types) or any(x not in FX_TYPES for x in types)): raise Review('unaffected types: ' + p[:60])
    e = {'trigger': 'STATIC', 'flag': 'UNAFFECTED', 'to': 'own' if m.group(6) else 'self'}
    if m.group(6): e['match'] = {'family': [m.group(6)]}
    fr = {}
    if cols: fr['colors'] = cols
    if types: fr['types'] = types
    if fr: e['from'] = fr
    return e, kw

FLAG_PARAS = [   # v0.58: whole paragraphs that only set a card flag
    (re.compile(r'^This card in (?:your )?Hand is unaffected by opposing effects\.?$'), 'handUnaffected'),
    (re.compile(r'^This (?:Magic )?card in (?:your )?Trash is unaffected by (?:any|all) effects?\.?$'), 'trashUnaffected'),
]

def flag_para(p):
    for rx, k in FLAG_PARAS:
        if rx.match(p): return k
    return None

def spirit_paragraph(p, card):
    rush = None
    p = re.sub(r'^((?:\[LV\d\])*\s*)\(Permanent\)\s*(?=\S)', r'\1', p)      # v0.184 old '(Permanent)' header is the constant effect itself; the plain sentence reads as before
    mr = re.search(r'\u27e6RUSH:([\w/]+)\u27e7', p)
    if mr:
        rush = (mr.group(1), p[mr.end():].strip()); p = p[:mr.start()].strip()
        if '\u27e6' in rush[1]: raise Review('Rush: two Rush effects in one paragraph')
    effects, flags = spirit_paragraph_main(p, card, rush)
    if rush and not any((a.get('if') or {}).get('hasSymbol') == rush_sym(rush[0]) for e in effects for a in e.get('actions', [])):
        raise Review('Rush on a paragraph without a triggered effect: ' + p[:60])
    return effects, flags

BRAVED_PARA = re.compile(r'^(?:\[When Braved\]|When Braved|During (?:Spirit )?Brave)\s+(?!on\b)')


# ---------- v0.70 step window heads ----------
# "(Your|Opposing|Either) <Step> Step)" is a window, not an event (Fandom Comprehensive Rules / Categories of Effects,
# "Effects Which Activate During Specific Steps"; docs/mechanics/step-timings.md): the body below it is an ordinary
# trigger / constant effect, only active while that step runs on that player's turn. Compiled as the effect condition
# {"step": <STEPS name>, "oppTurn": false|true} (Either = no oppTurn). The legacy forms above stay as they are.
STEP_HEAD = re.compile(r'^\((Your|Opposing|Either) (Start|Core|Draw|Refresh|Main|Attack|End) Step\)\s*')
WIN_KEYS = ('step', 'attackStep', 'oppTurn')
OPP_ATT_BODY = re.compile(r'^When an opposing (?:Cost (\d+) or less |(\d+) BP or less )?Spirit(/Ultimate)? attacks,\s*')
ALLY_ATT_BODY = re.compile(r'^When (?:one of )?your (?:"([^"]+)" family |(Red|Purple|Green|White|Yellow|Blue) )?Spirits? attacks?,\s*')
ALLY_SUMMON_HEAD = re.compile(r'^When your (?:(?P<col>Red|Purple|Green|White|Yellow|Blue) |(?P<fam>"[^"]+"(?:\s*/\s*"[^"]+")*) family |"(?P<nm>[^"]+)"-named |[Cc]ost (?P<cn>\d+) or (?P<cd>more|less) )?(?P<ty>Spirit|Ultimate)s?(?: with (?P<kw>[A-Z][A-Za-z]+))? (?:is|are) summoned,\s*')      # v0.181
OWN_BP_BODY = re.compile(r'^(?:All (?:of )?your (?:"([^"]+)" family )?Spirits (?:with (?P<kw>[A-Z][A-Za-z]+) )?(?:gain|get)|Give all your (?:"([^"]+)" family )?Spirits|(?:All )?"([^"]+)" (?:family )?spirits you control (?:gain|get)) \+(\d[\d,]*) ?BP\.?$', re.I)      # v0.181 also 'Give all your "X" family Spirits +N BP'
SELF_BP_BODY = re.compile(r'^This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', re.I)
OPP_HAND_WHILE = re.compile(r'^While the opponent has (\d+|two|three|four|five|six|seven|eight) or more cards in (?:the|their) Hand,\s*', re.I)
BURST_WHILE = re.compile(r"^While you (don't )?have an? (?:set Burst|Burst set),\s*", re.I)
DRAW_PLUS_BODY = re.compile(r'^(?:If (.+?), )?(?:you draw|increase the number of cards you draw by|increase the amount of cards you draw by) \+(\d)(?: cards?)?\.?$', re.I)      # v0.181
NOTRIBUTE_BODY = re.compile(r"^Once per turn, you can summon a Spirit card with Tribute from your Hand without using Tribute\. However, any \(When Summoned\) effects of the Spirit can't activate\.$", re.I)      # v0.183 ACTIVATE SUMMON_HAND noTribute
BLOCK_EXH_BODY = re.compile(r'^This Spirit can block (?:opposing Spirits )?while exhausted\.?$', re.I)


def step_window(p, card, lv, rush):
    """None = not a step head; else (effects, flags) with the window on every effect (Review on a body we cannot read)."""
    m = STEP_HEAD.match(p)
    if not m: return None
    who, step, body = m.group(1), m.group(2).upper(), p[m.end():].strip()
    if not body or STEP_HEAD.match(body): raise Review('no trigger: ' + p[:100])
    if step == 'MAIN' and who == 'Your' and NOTRIBUTE_BODY.match(body):
        if rush: raise Review('Rush with a Tribute-less summon')
        x = {'trigger': 'ACTIVATE', 'timing': ['MAIN'], 'once': True, 'optional': True, 'actions': [{'do': 'SUMMON_HAND', 'match': {'type': 'Spirit'}, 'pay': True, 'noFx': True, 'noTribute': True}]}
        if lv: x['lv'] = lv
        return [x], {}
    csopt = re.match(r'\(CSOPT\)\s*(?=When )', body)
    if csopt: body = body[csopt.end():]      # v0.185 '(Step) (CSOPT) When ...': same-name once per turn, applied to the triggered effects below
    win = {'step': step}
    if who != 'Either': win['oppTurn'] = who == 'Opposing'
    mw = BURST_WHILE.match(body)
    if mw:      # v0.71 "(Your Attack Step) While you have a set Burst, <effect>" = one more window condition
        win['burstSet'] = not mw.group(1); body = body[mw.end():].strip(); body = body[0].upper() + body[1:]
    mh = OPP_HAND_WHILE.match(body)
    if mh:      # v0.183 "While the opponent has N or more cards in the Hand, <effect>" = oppHandGe window condition
        win['oppHandGe'] = NUM.get(mh.group(1).lower()) or int(mh.group(1)); body = body[mh.end():].strip(); body = body[0].upper() + body[1:]
    flags = {}
    e = None
    aw = ally_win(body, 'att' if who == 'Your' else 'blk' if who == 'Opposing' else None) if step == 'ATTACK' else None
    if aw:      # v0.78 "(Your|Opposing Attack Step) When only the opposing Spirit is destroyed by comparing BP with your X, ..."
        e, _ = trig_effects(aw[0], card, ['ALLY_BATTLE_WIN'], aw[1] or None, lv, rush, flags, aw[2] or None)
    mm = None if e is not None else OPP_ATT_BODY.match(body)
    if mm and step == 'ATTACK' and who != 'Your':
        tm = {} if mm.group(3) else {'noUlt': True}
        if mm.group(1): tm['costLe'] = int(mm.group(1))
        if mm.group(2): tm['bpLe'] = int(mm.group(2))      # v0.183
        e, _ = trig_effects(body[mm.end():], card, ['OPP_ATTACKS'], tm, lv, rush, flags)
    mm = None if e is not None else ALLY_ATT_BODY.match(body)
    if mm and step == 'ATTACK' and who != 'Opposing':
        tm = {'noUlt': True}
        if mm.group(1): tm['family'] = [mm.group(1)]
        if mm.group(2): tm['color'] = mm.group(2).lower()
        e, _ = trig_effects(body[mm.end():], card, ['ALLY_ATTACKS'], tm, lv, rush, flags)
    if e is None:
        mm = OWN_BP_BODY.match(body) or SELF_BP_BODY.match(body)
        if mm:
            if rush: raise Review('Rush with a step-window constant effect')
            own = mm.re is OWN_BP_BODY
            x = {'trigger': 'STATIC', 'bp': bp(mm.group(5) if own else mm.group(1)), 'to': 'own' if own else 'self'}
            if own and (mm.group(1) or mm.group(3) or mm.group(4)): x['match'] = {'family': [mm.group(1) or mm.group(3) or mm.group(4)]}
            if own and mm.group('kw'): x['match'] = dict(x.get('match') or {}, keyword=mm.group('kw'))      # v0.167 "All your Spirits with Shamanism gain +N BP"
            e = [x]
        elif step == 'DRAW' and who == 'Your' and DRAW_PLUS_BODY.match(body):      # v0.181 STATIC DRAW_PLUS (engine drawPlusOf)
            if rush: raise Review('Rush with a step-window constant effect')
            md = DRAW_PLUS_BODY.match(body)
            cd = (all_have_cond(md.group(1)) or (COND_HOOK(md.group(1)) if COND_HOOK else None)) if md.group(1) else None
            if md.group(1) and not cd: raise Review('sentence: ' + md.group(1)[:60].lower())
            e = [{'trigger': 'STATIC', 'flag': 'DRAW_PLUS', 'to': 'self', 'n': int(md.group(2))}]
            if cd: e[0]['if'] = cd
        elif BLOCK_EXH_BODY.match(body):
            if rush: raise Review('Rush with a step-window constant effect')
            e = [{'trigger': 'STATIC', 'flag': 'BLOCK_EXHAUSTED', 'to': 'self'}]
        if e is not None and lv: e[0]['lv'] = lv
    if e is None:
        e, flags = spirit_paragraph_main((''.join('[LV%d]' % x for x in lv) + ' ' if lv else '') + body, card, rush)
    for x in e:
        if x['trigger'] in ('ADVENT', 'REVEALED', 'ACCEL', 'MANIFEST') or x.get('zone') or x.get('invoke') or x.get('nexusBrave'):
            raise Review('step window on ' + x['trigger'] + ': ' + body[:60])
        if any(k in (x.get('if') or {}) for k in WIN_KEYS): raise Review('step window twice: ' + body[:60])
        x['if'] = dict(x.get('if') or {}, **win)
        if csopt:
            if x['trigger'] == 'STATIC': raise Review('CSOPT on a static effect: ' + body[:60])
            x['once'] = True; x['sameName'] = True
    return e, flags


def spirit_paragraph_main(p, card, rush):
    mb = BRAVED_PARA.match(p)
    if mb:      # v0.60: [When Braved] / During (Spirit) Brave = while a Brave is combined with this Spirit (JP 合体時); effects get braved:true
        body = re.sub(r'\(When (?:This Spirit )?Brave Attacks?\)', '(When Attacks)', p[mb.end():].strip())
        if card['type'] == 'Brave' and re.match(r'^\[LV\d', body): raise Review('braved paragraph with a level on a Brave')
        if BRAVED_PARA.match(body): raise Review('braved paragraph twice')
        e, f = spirit_paragraph_main(body, card, rush)
        if f or not e: raise Review('braved paragraph with card flags: ' + body[:60])
        for x in e:
            if x['trigger'] in ('DESTROYED', 'LEAVES', 'SUMMONED', 'ADVENT', 'REVEALED', 'ACCEL') or x.get('zone') or x.get('nexusBrave'): raise Review('braved paragraph trigger ' + x['trigger'])
            x['braved'] = True
        return e, f
    mu = UT_PARA.match(p)
    if mu and card['type'] == 'Ultimate':      # v0.56: Ultimate Trigger [LVn] (When Attacks) When Ultimate Trigger hits, <actions>
        if rush: raise Review('Rush with Ultimate Trigger')
        body = mu.group(2).strip(); body = body[0].upper() + body[1:]
        e, f = spirit_paragraph_main(mu.group(1) + ' (When Attacks) ' + body, card, None)
        if len(e) != 1 or e[0]['trigger'] != 'ATTACKS' or e[0].get('optional'): raise Review('Ultimate Trigger body: ' + body[:60])
        if any(a.get('if') for a in e[0]['actions']): raise Review('Ultimate Trigger body with its own condition: ' + body[:60])
        e[0]['actions'] = [{'do': 'ULT_TRIGGER'}] + [dict(a, **{'if': {'utHit': True}}) for a in e[0]['actions']]
        return e, f
    m = re.match(r'^((?:\[LV\d\])+)\s*', p)
    lv = None
    if m:
        lv = [int(x) for x in re.findall(r'\d', m.group(1))]
        p = p[m.end():]
    nlv = len(card['levels'])
    if lv is not None:
        if card['type'] == 'Nexus' and any(x > 1 for x in lv) and nlv <= 1:
            if lv == [1, 2] or lv == [1, 2, 3]: lv = [1]                     # LV1 is the only known level; same effect there
            else: raise Review('Nexus [LV2]+ effect, but the export has no Nexus level thresholds')
        base = 3 if card['type'] == 'Ultimate' else 1      # v0.56: Ultimate levels are printed LV3+ (engine lvBase 3)
        top = base - 1 + max(nlv, 1)
        if card['type'] != 'Nexus' and any(x > top for x in lv) and any(x <= top for x in lv): lv = [x for x in lv if x <= top]      # v0.184 a printed LV the card does not have (e.g. [LV1][LV2][LV3] on a 2-level Spirit) is dropped when lower levels remain
        if any(x < base or x > base - 1 + max(nlv, 1) for x in lv): raise Review(f'[LV{max(lv) if max(lv) >= base else min(lv)}] but the card has {nlv} level(s) from LV{base}')
    flags = {}
    if INVOKE_MARK_RE.search(p): return [invoke_para(p, card, lv, rush)], flags      # v0.68 Invoke
    if re.match(r'^Your Hand is unaffected by opposing effects\.?$', p):     # v0.58: STATIC HAND_UNAFFECTED (while this card is on the Field)
        e = {'trigger': 'STATIC', 'flag': 'HAND_UNAFFECTED', 'to': 'self'}
        if lv: e['lv'] = lv
        if rush: raise Review('Rush with an unaffected effect')
        return [e], flags
    ua = unaffected_para(p)
    if ua:
        e, kw = ua
        if rush: raise Review('Rush with an unaffected effect')
        if lv: e = dict(list(e.items())[:3] + [('lv', lv)] + list(e.items())[3:])
        if kw: flags['mechanics'] = sorted(set((card.get('mechanics') or ([card['keyword']] if card.get('keyword') else [])) + [kw]))
        return [e], flags
    if re.match(r'^Flash\s*-\s*High Speed\b', p):
        if not re.search(r'(?:This|this) (?:Spirit )?card in Hand can be summoned', p) or not re.search(r'Reserve', p): raise Review('High Speed text: ' + p[:80])
        return [], {'highSpeed': True}
    mm = re.match(r'^Flash\s*-?\s*Awaken\s*-?\s*You can (?:send|put) any number of cores from (?:your Spirits|Spirits you control) to this Spirit\.?$', p)
    if mm:
        e = {'trigger': 'ACTIVATE', 'timing': ['MAIN', 'FLASH'], 'once': False, 'cpuSkip': True, 'optional': True, 'actions': [{'do': 'AWAKEN'}]}
        if lv: e['lv'] = lv
        return [e], flags
    mm = re.match(r'^While\s+\(Soul Core\) is on this Spirit,\s*([a-z])', p)
    soul_if = bool(mm and card['type'] == 'Spirit')
    if soul_if: p = mm.group(1).upper() + p[mm.end():]      # v0.184 "While (Soul Core) is on this Spirit, when ..." = the triggered effect with if.selfSoul
    kw = None
    for k in KEYWORD_LINES:
        if p.startswith(k + ' ') or p.startswith(k + ':'):
            kw = k; p = p[len(k):].lstrip(' :-'); break
    if kw is None and re.match(r'^[A-Z][a-z]+(?: [A-Z][a-z]+)?\s*(?:\(|:)', p) and not re.match(r'^\((?:When|Your|Opposing|Either|Flash|Permanent)', p) and not p.startswith('('):
        raise Review('keyword: ' + p.split('(')[0].strip()[:40])
    if kw == 'High Speed':
        if not re.search(r'summon', p, re.I) or not re.search(r'flash', p, re.I): raise Review('High Speed text: ' + p[:80])
        return [], {'highSpeed': True}
    if kw == 'Crush':
        if not re.search(r'\(When Attacks\)', p) or not re.search(r"(?:equal to|equal to the|equal) (?:this spirit'?s? |its )?(?:lv|level)|equal to this spirits lv|this spirit's (?:lv|level)", p, re.I):
            raise Review('Crush text: ' + p[:80])
        e = {'trigger': 'ATTACKS', 'actions': [{'do': 'CRUSH', 'n': 'lv'}]}
        if lv: e['lv'] = lv
        return [e], flags
    if kw == 'Holy Life':
        if not re.search(r"reduces the opposing life, put a core from the void (?:to|on) your life", p, re.I): raise Review('Holy Life text: ' + p[:80])
        e = {'trigger': 'ALLY_LIFE_HIT', 'self': True, 'actions': [{'do': 'VOID_TO_LIFE', 'n': 1}]}
        if lv: e['lv'] = lv
        return [e], flags
    if kw == 'Clash':
        if not re.match(r'^\((?:When Attacks|During Attack)\)\s*(?:(?:The|Your) opponent|Opposing Spirits) must block (?:if possible|with a spirit if possible)\.?$', p, re.I): raise Review('Clash text: ' + p[:80])   # v0.66: (During Attack) / "Opposing Spirits" (Standard)
        e = {'trigger': 'STATIC', 'flag': 'MUST_BLOCK', 'to': 'self'}
        if lv: e['lv'] = lv
        return [e], flags
    if kw == 'Curse':
        if not CURSE_TEXT.match(p): raise Review('Curse text: ' + p[:80])
        e = {'trigger': 'ATTACKS', 'actions': [{'do': 'CURSE'}]}
        if lv: e['lv'] = lv
        return [e], flags
    if kw == 'Brilliance':
        if not BRILLIANCE_TEXT.match(p): raise Review('Brilliance text: ' + p[:80])
        e = {'trigger': 'ATTACKS', 'actions': [{'do': 'BRILLIANCE'}]}
        if lv: e['lv'] = lv
        return [e], flags
    # trigger
    trig, tmatch, extra = None, None, None
    mm = re.match(r'^\(During Attack/Block\)\s*(This Spirit (?:gains|gets) \+\d[\d,]* ?BP)\.\s*(At the end of battle, .+)$', p, re.I)
    if mm:      # v0.173 "(During Attack/Block) This Spirit gains +N BP. At the end of battle, X": the BP is static, the end-of-battle part fires for the attacker and the blocker
        pre = ''.join('[LV%d]' % x for x in lv) + ' ' if lv else ''
        e1, f1 = spirit_paragraph_main(pre + '(During Attack/Block) ' + mm.group(1), card, rush)
        e2, f2 = spirit_paragraph_main(pre + '(When Attacks/Blocks) ' + mm.group(2), card, rush)
        if f1 or f2: raise Review('Attack/Block pair with card flags: ' + p[:60])
        return e1 + e2, flags
    p = re.sub(r'^\(During (Attack|Block)s\)', r'(During \1)', p)      # v0.169 "(During Blocks)" / "(During Attacks)" are the same heads as the singular ones
    ns = re.match(r"^\(Can't Stack\)\s*", p, re.I)
    nostack = bool(ns and any(re.match(r'^' + rx_ + r'\s*', p[ns.end():]) for rx_, _ts in TRIGGERS))
    mc = None if nostack else re.match(r"^(\((?:Your|Opposing|Either) Attack Step\))\s*\(Can't Stack\)\s*(?=When )", p, re.I)
    if mc: nostack, p = True, mc.group(1) + ' ' + p[mc.end():]      # v0.185 '(Your Attack Step) (Can't Stack) When ...': the step head stays, the limit moves to the effect
    if nostack and ns: p = p[ns.end():]      # v0.164 "(Can't Stack) When ..." = noStack on the triggered effect (engine 02d: one activation per card name and effect)
    aw = ally_win(p)
    if aw: p, tmatch, extra = aw; trig = ['ALLY_BATTLE_WIN']; tmatch = tmatch or None; extra = extra or None
    if not trig: p = re.sub(r'^\(During Attack\)\s*(?=(?:If [^.]+?, )?This Spirit can\'t be blocked by (?:opposing )?Cost \d+ or (?:less|more) Spirits?)', '(When Attacks) ', p, flags=re.I)      # v0.179 attack-long unblockable = marked when the attack starts (blockers come right after)
    if not trig: p = re.sub(r'^\(During Attack\)\s*(?=At the end of battle,)', '(When Attacks) ', p)      # v0.167 "(During Attack) At the end of battle, X" = the attacker's end-of-battle effect
    mo = None if trig else re.match(r'^(\((?:During Attack|When Attacks|When Blocks)\))\s*\(Once Per Turn\)\s*(?=When )', p, re.I)
    if mo: p = mo.group(1) + ' ' + p[mo.end():]      # v0.185 '(During Attack) (Once Per Turn) When ...': the limit is read after the head matched
    mb = None if trig else re.match(r'^\((?:During Attack|When Attacks)\)\s*When blocked by an opposing (\d[\d,]*) BP or less Spirit,\s*', p, re.I)
    if mb: trig, extra, p = ['ALLY_BLOCKED'], {'self': True, 'if': {'blockerBpLe': int(mb.group(1).replace(',', ''))}}, p[mb.end():]      # v0.185 blocker BP condition (schema v63)
    mb = None if trig else re.match(r'^\(Your Attack Step\)\s*(\(Once Per Turn\)\s*)?When your (?:(?P<team>Red Stella) )Spirit is blocked by an opposing (?P<bp>\d[\d,]*) BP or less Spirit,\s*', p)
    if mb:      # v0.185 ALLY_BLOCKED + blockerBpLe (schema v63)
        trig, tmatch, extra, p = ['ALLY_BLOCKED'], {'noUlt': True, 'team': mb.group('team')}, dict(extra or {}, **{'if': {'blockerBpLe': int(mb.group('bp').replace(',', ''))}}), p[mb.end():]
        if mb.group(1): extra['once'] = True
    for rx, ts, ex in ([] if trig else BATTLE_HEADS):
        mm = re.match(r'^' + rx + r'\s*', p)
        if mm: trig, extra, p = ts, ex, p[mm.end():]; break
    if mo and trig: extra = dict(extra or {}, once=True)
    elif mo: p = mo.group(1) + ' (Once Per Turn) ' + p[len(mo.group(1)) + 1:]
    mm = None if trig else re.match(r'^This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP for each core on (?:it|this Spirit)\.?$', p, re.I)
    if mm:      # v0.185 STATIC perCores (schema 67)
        if rush: raise Review('Rush with a static effect')
        e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'perCores': True}
        if lv: e['lv'] = lv
        return [e], flags
    mm = None if trig else re.match(r'^This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP for each card in your Hand\.?$', p, re.I)
    if mm:      # v0.180 STATIC perHand
        if rush: raise Review('Rush with a static effect')
        e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'perHand': True}
        if lv: e['lv'] = lv
        return [e], flags
    p = re.sub(r'^(\(During Attack\)\s*)?For each of your (.+? Spirits?), (this spirit)', lambda m: (m.group(1) or '') + 'For each ' + m.group(2) + ' you control, ' + m.group(3), p, flags=re.I) if not trig else p      # v0.185 'for each of your X Spirits' reads as the head form
    mt = None if trig else PER_STATIC_TAIL.match(p)
    if mt: p = (mt.group(1) or '') + re.sub(r'^for each', 'For each', mt.group(3)) + ', this spirit gets +' + mt.group(2) + 'BP'      # v0.184 read the tail form as the head form
    mm = None if trig else PER_STATIC.match(p)
    if mm:      # v0.72 static "for each X you control" BP (with (During Attack): only while attacking)
        e = {'trigger': 'STATIC', 'bp': bp(mm.group(mm.lastindex)), 'to': 'self'}
        if lv: e['lv'] = lv
        if mm.group(1): e['attackingOnly'] = True
        q = re.match(PER_NP, p[mm.end(1) if mm.group(1) else 0:], re.I)
        e['per'] = per_of(q)
        if rush: raise Review('Rush with a static effect')
        return [e], flags
    mm = None if trig else re.match(r'^\(Once Per Turn\)\s*(?=When cards .* by your Rumble,)', p, re.I)
    if mm: p = p[mm.end():]; extra = dict(extra or {}, once=True)      # v0.185 plain once-per-turn limit in front of the Rumble head
    for rx, ts in ([] if trig else TRIGGERS):
        mm = re.match(r'^' + rx + r'\s*', p)
        if mm: trig = ts; p = p[mm.end():]; break
    if trig is None:      # v0.59: step-prefixed attack triggers (the step is implied by the attack itself)
        mm = re.match(r'^\(Your Attack Step\)\s*(\(Once Per Turn\)\s*)?When (?:one of )?your ("[^"]+"(?:\s*/\s*"[^"]+")*) family Spirits? attacks?,\s*', p)
        if mm:      # v0.185 '"A"/"B" family' = any of the listed families; optional '(Once Per Turn)' between the step and When
            trig, tmatch, p = ['ALLY_ATTACKS'], {'family': re.findall(r'"([^"]+)"', mm.group(2)), 'noUlt': True}, p[mm.end():]
            if mm.group(1): extra = dict(extra or {}, once=True)
        mm = None if trig else re.match(r'^\(During Attack\)\s*(\(Once Per Turn\)\s*)?When you use an? (?:"([^"]+)" family )?Magic card,\s*', p)
        if mm:      # v0.185 engine MAGIC_USED + if.selfAttacking (this Spirit is attacking)
            trig, tmatch, p = ['MAGIC_USED'], dict({'type': 'Magic'}, **({'family': [mm.group(2)]} if mm.group(2) else {})), p[mm.end():]
            extra = dict(extra or {}, **{'if': {'selfAttacking': True}})
            if mm.group(1): extra['once'] = True
        mm = None if trig else re.match(r'^\(Your Attack Step\)\s*(\(Once Per Turn\)\s*)?When (?:your (?:(?P<col>Red|Purple|Green|White|Yellow|Blue) )?(?:(?P<team>Red Stella) )?Spirits? makes? the first attack of the turn|you make the second or subsequent attack of the turn(?:, (?:and|if) the Spirit that attacks has the (?P<fam>"[^"]+"(?:\s*/\s*"[^"]+")*) family)?),\s*', p)
        if mm:      # v0.185 engine firstAttack condition (owner attack counter): 'first attack of the turn' / 'second or subsequent attack of the turn'
            tm = {'noUlt': True}
            if mm.group('col'): tm['color'] = mm.group('col').lower()
            if mm.group('team'): tm['team'] = mm.group('team')
            if mm.group('fam'): tm['family'] = re.findall(r'"([^"]+)"', mm.group('fam'))
            trig, tmatch, p = ['ALLY_ATTACKS'], tm, p[mm.end():]
            extra = dict(extra or {}, **{'if': {'firstAttack': 'first attack' in mm.group(0)}})
            if mm.group(1): extra['once'] = True
        mm = None if trig else re.match(r'^\(Your Attack Step\)\s*(\(Once Per Turn\)\s*)?When your Cost (\d+) or (more|less) (Red|Purple|Green|White|Yellow|Blue) Spirit with no printed effects attacks,\s*', p)
        if mm:      # v0.185 attack head with a subject filter (cost, colour, no printed effects); once-per-turn optional
            trig, tmatch, p = ['ALLY_ATTACKS'], {'noUlt': True, 'noText': True, 'color': mm.group(4).lower(), 'costGe' if mm.group(3) == 'more' else 'costLe': int(mm.group(2))}, p[mm.end():]
            if mm.group(1): extra = dict(extra or {}, once=True)
        mm = None if trig else re.match(r'^(?:\((?:Opposing|Either) Attack Step\)\s*/?\s*)?When your Life is reduced(?: by (?:the attack of )?(?:an? )?opposing (Spirit|Ultimate)s?| by the opponent)?,\s*', p)
        if mm: trig, tmatch, p = ['OWN_LIFE_HIT'], ({'noUlt': True} if (mm.group(1) or '').lower() == 'spirit' else {'type': 'Ultimate'} if mm.group(1) else None), p[mm.end():]      # v0.177 engine OWN_LIFE_HIT (an opposing attack reduced your Life)
        mm = None if trig else ALLY_SUMMON_HEAD.match(p)
        if mm:      # v0.181 'When your Blue Spirit is summoned, ...' / 'When your "X" family Spirit is summoned' = engine ALLY_SUMMONED with a subject match
            tm = {}
            if mm.group('col'): tm['color'] = mm.group('col').lower()
            if mm.group('fam'): tm['family'] = re.findall(r'"([^"]+)"', mm.group('fam'))
            if mm.group('nm'): tm['name'] = [mm.group('nm')]
            if mm.group('kw'): tm['keyword'] = mm.group('kw')      # v0.185 'When your Spirit with Current is summoned'
            if mm.group('cn'): tm['costGe' if mm.group('cd').lower() == 'more' else 'costLe'] = int(mm.group('cn'))
            tm['type' if mm.group('ty').lower() == 'ultimate' else 'noUlt'] = 'Ultimate' if mm.group('ty').lower() == 'ultimate' else True
            trig, tmatch, p = ['ALLY_SUMMONED'], tm, p[mm.end():]
        mm = None if trig else re.match(r'^\(Opposing Attack Step\)\s*When an opposing Spirit attacks,\s*', p)
        if mm: trig, tmatch, p = ['OPP_ATTACKS'], {'noUlt': True}, p[mm.end():]
    if trig is None:
        mm = re.match(r'^\(Your Attack Step\)\s*All (?:your|of your) (?:Cost (?P<cn>\d+) or (?P<cd>more|less) )?(?:"(?P<fam>[^"]+)" family )?Spirits (?:with (?P<kw>[A-Z][A-Za-z]+) )?(?:gain|get) \+(?P<n>\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.54: static BP for your Spirits during your Attack Step
            e = {'trigger': 'STATIC', 'bp': bp(mm.group('n')), 'to': 'own', 'if': dict(ATTACK_STEP['(Your Attack Step)'])}
            if mm.group('fam'): e['match'] = {'family': [mm.group('fam')]}
            if mm.group('kw'): e['match'] = dict(e.get('match') or {}, keyword=mm.group('kw'))      # v0.167
            if mm.group('cn'): e['match'] = dict(e.get('match') or {}, **{'costGe' if mm.group('cd').lower() == 'more' else 'costLe': int(mm.group('cn'))})      # v0.185
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(Your Attack Step\)\s*If (?P<c>all your [^,]+), (?:give all your Spirits|all your Spirits (?:gain|get)) \+(?P<n>\d[\d,]*) ?BP\.?$', p, re.I)
        ac = all_have_cond(mm.group('c')) if mm else None
        if ac:      # v0.185 conditional static BP: step + allHave
            e = {'trigger': 'STATIC', 'bp': bp(mm.group('n')), 'to': 'own', 'if': dict(ATTACK_STEP['(Your Attack Step)'], **ac)}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(Your Attack Step\)\s*All your attacking (?:"(?P<fam>[^"]+)" family |(?P<team>' + TEAMS + r') )Spirits (?:gain|get) \+(?P<n>\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.185 "All your attacking <family/team> Spirits gain +N BP" = STATIC own + attackingOnly (engine staticBp: only the attacker)
            e = {'trigger': 'STATIC', 'bp': bp(mm.group('n')), 'to': 'own', 'attackingOnly': True, 'if': dict(ATTACK_STEP['(Your Attack Step)']), 'match': {'family': [mm.group('fam')]} if mm.group('fam') else {'team': mm.group('team').title()}}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(Your Attack Step\)\s*All your ("[^"]+"(?:\s*/\s*"[^"]+")*) (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.185 '(Your Attack Step) All your "X" gain +N BP' = STATIC own, name match
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(2)), 'to': 'own', 'if': dict(ATTACK_STEP['(Your Attack Step)']), 'match': {'name': re.findall(r'"([^"]+)"', mm.group(1))}}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(Your Attack Step\)\s*This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'if': dict(ATTACK_STEP['(Your Attack Step)'])}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(During Attack\)\s*This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.66: (During Attack) = active as long as this Spirit is attacking (Standard manual, Examples on Activation Timings)
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'attackingOnly': True}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(During Attack/Block\)\s*This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.173: (During Attack/Block) = active while this Spirit is the attacker or the blocker (engine fightingOnly)
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'fightingOnly': True}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(During Block\)\s*This Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.159: (During Block) = active as long as this Spirit is blocking
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'self', 'blockingOnly': True}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r"^This Spirit's colou?r and symbols? are also treated as (Red|Purple|Green|White|Yellow|Blue)\.?$", p)
        if mm:      # v0.54: a second colour for colour and symbol (multicolour card, 06-rules symbol colours)
            if lv and sorted(lv) != list(range(1, nlv + 1)): raise Review('colour change only on some levels')
            own, extra = card['color'].lower(), mm.group(1).lower()
            if own == extra or own not in COLOURS: raise Review('colour change: ' + p[:60])
            return [], {'colors': [own, extra]}
        mm = re.match(r"^This Spirit is also treated as (?:an? )?(Red|Purple|Green|White|Yellow|Blue) Spirit\.?$", p)
        if mm:      # v0.184: colour only (symbols stay): colors gets the extra colour, symbolColors pins the printed symbols
            if lv and sorted(lv) != list(range(1, nlv + 1)): raise Review('colour change only on some levels')
            own, extra = card['color'].lower(), mm.group(1).lower()
            if own == extra or own not in COLOURS or not card.get('symbols'): raise Review('colour change: ' + p[:60])
            return [], {'colors': [own, extra], 'symbolColors': [own] * card['symbols']}
        mm = re.match(r'^\(Either Attack Step\)\s*(\(Can\'t Stack\)\s*)?All your attacking/blocking Spirits (?:with (?P<kw>[A-Z][A-Za-z ]+?) )?(?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.168: both Attack Steps, only the Spirits that fight (attacker or blocker); (Can't Stack) = copies do not add up (engine bp loop)
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(3)), 'to': 'own', 'fightingOnly': True, 'if': {'attackStep': True}}
            if mm.group('kw'): e['match'] = {'keyword': mm.group('kw')}
            if mm.group(1): e['noStack'] = True
            if lv: e['lv'] = lv
            return [e], flags
        mm = OWN_BP_BODY.match(p)
        if mm and not mm.group('kw'):      # v0.181 constant 'Give all your "X" family Spirits +N BP' / 'All your X family Spirits get +N BP'
            if rush: raise Review('Rush with a constant effect')
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(5)), 'to': 'own'}
            if mm.group(1) or mm.group(3) or mm.group(4): e['match'] = {'family': [mm.group(1) or mm.group(3) or mm.group(4)]}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^(?:\(Your Turn\)\s*)?All (?:of )?your (?:(?P<col>Red|Purple|Green|White|Yellow|Blue) |(?P<fam>"[^"]+"(?:\s*/\s*"[^"]+")*) family |"(?P<nm>[^"]+)"-named |Cost (?P<cn>\d+) or (?P<cd>more|less) )Spirits (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.181 constant own BP for a colour / family list / name / cost range ('All your White Spirits gain +1000 BP')
            if rush: raise Review('Rush with a constant effect')
            m = {}
            if mm.group('col'): m['color'] = mm.group('col').lower()
            if mm.group('fam'): m['family'] = re.findall(r'"([^"]+)"', mm.group('fam'))
            if mm.group('nm'): m['name'] = [mm.group('nm')]
            if mm.group('cn'): m['costGe' if mm.group('cd').lower() == 'more' else 'costLe'] = int(mm.group('cn'))
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(mm.lastindex)), 'to': 'own', 'match': m}
            if p.startswith('(Your Turn)'): e['if'] = {'oppTurn': False}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^Give all your (?:(?P<col>Red|Purple|Green|White|Yellow|Blue) |(?P<fam>"[^"]+"(?:\s*/\s*"[^"]+")*) family |"(?P<nm>[^"]+)"-named )Spirits:\s*Clash\.?$', p, re.I)
        if mm:      # v0.184 granted Clash = STATIC MUST_BLOCK for the owner's matching Spirits (flagActive handles to: own + match; the attacker is the subject)
            if rush: raise Review('Rush with a constant effect')
            m = {}
            if mm.group('col'): m['color'] = mm.group('col').lower()
            if mm.group('fam'): m['family'] = re.findall(r'"([^"]+)"', mm.group('fam'))
            if mm.group('nm'): m['name'] = [mm.group('nm')]
            e = {'trigger': 'STATIC', 'flag': 'MUST_BLOCK', 'to': 'own', 'match': m}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^All (?:of )?your (?:(?P<col>Red|Purple|Green|White|Yellow|Blue) |(?P<fam>"[^"]+"(?:\s*/\s*"[^"]+")*) family |"(?P<nm>[^"]+)"-named )(?:Spirits )?can block (?:even )?while exhausted\.?$', p, re.I)
        if mm:      # v0.181 STATIC BLOCK_EXHAUSTED for the owner's matching Spirits (flagActive handles to: own + match)
            if rush: raise Review('Rush with a constant effect')
            m = {}
            if mm.group('col'): m['color'] = mm.group('col').lower()
            if mm.group('fam'): m['family'] = re.findall(r'"([^"]+)"', mm.group('fam'))
            if mm.group('nm'): m['name'] = [mm.group('nm')]
            e = {'trigger': 'STATIC', 'flag': 'BLOCK_EXHAUSTED', 'to': 'own', 'match': m}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^(?:All your attacking (Red|Purple|Green|White|Yellow|Blue) Spirits (?:gain|get)|Give all your attacking (Red|Purple|Green|White|Yellow|Blue) Spirits) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.181 constant BP for the owner's attacking Spirits of one colour (engine attackingOnly + match.color)
            if rush: raise Review('Rush with a constant effect')
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(3)), 'to': 'own', 'attackingOnly': True, 'match': {'color': (mm.group(1) or mm.group(2)).lower()}}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^\(Your Attack Step\)\s*All attacking Spirits you control (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(1)), 'to': 'own', 'attackingOnly': True}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^(\(During (?:Attack|Block|Attack/Block)\)\s*)?(?:\(Permanent\)\s*)?(?:If|While) (.+?), this Spirit (?:gains|gets) \+(\d[\d,]*) ?BP\.?$', p, re.I)      # v0.181 old '(Permanent) While <cond>, this spirit gets +N BP' reads like 'If'
        cond = (all_have_cond(mm.group(2)) or (COND_HOOK(mm.group(2)) if COND_HOOK else None)) if mm else None
        if cond:      # v0.131 conditional static BP (house reading of allHave: no card on the Field = not met); v0.166 "(During Attack)" prefix and the v2 condition reader
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(3)), 'to': 'self', 'if': cond}
            if mm.group(1): e['fightingOnly' if '/' in mm.group(1) else 'blockingOnly' if re.search(r'block', mm.group(1), re.I) else 'attackingOnly'] = True      # v0.168 "(During Block)" prefix; v0.173 "(During Attack/Block)" = fightingOnly
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r"^(?:\((?:Your|Opposing|Either) Attack Step\)\s*|\(During Your Battle Phase\)\s*)?This Spirit can(?:'t|not) (attack|block)(?: opposing Spirits)?\.?$", p, re.I)
        if mm:      # v0.170 printed "can't attack" / "can't block" as a STATIC flag (the Attack Step head only names when it matters)
            if rush: raise Review('Rush with a can\'t attack/block flag')
            e = [{'trigger': 'STATIC', 'flag': 'CANT_' + mm.group(1).upper(), 'to': 'self'}]
            if lv: e[0]['lv'] = lv
            return e, flags
        if re.fullmatch(r'(?:\(Your Main Step\)\s*)?When this Spirit becomes the target of Tribute, by exhausting this Spirit, (?:treat all cores on this Spirit as being sent to the designated place|(?:you can )?summon without (?:using )?Tribute)\.?', p, re.I):      # v0.183 STATIC TRIBUTE_SAFE (engine tributePay)
            if rush: raise Review('Rush with a Tribute flag')
            e = [{'trigger': 'STATIC', 'flag': 'TRIBUTE_SAFE', 'to': 'self'}]
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r'^If (you control [^,]+?), all your (?:"([^"]+)" family |((?:"[^"]+"/)+"[^"]+") )?Spirits? (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I) or re.match(r'^If (you control [^,]+?), all your ((?:"[^"]+"/)*"[^"]+") (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        cond = (COND_HOOK(mm.group(1)) if COND_HOOK else None) if mm else None
        if cond and mm.re.groups == 3:      # v0.185 STATIC BP for named Spirits while a condition holds (no step window)
            e = [{'trigger': 'STATIC', 'bp': bp(mm.group(3)), 'to': 'own', 'if': cond, 'match': {'name': re.findall(r'"([^"]+)"', mm.group(2))}}]
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r'^While (you control [^,]+?), (?:this Spirit is treated as being (?:at )?|treat this Spirit as being (?:at |on )?)\[?LV([23])\]?\.?$', p, re.I)
        cond = (COND_HOOK(mm.group(1)) if COND_HOOK else None) if mm else None
        if cond:      # v0.184 STATIC TREAT_LV3 with a v2 condition and a target level n (2 or 3)
            if rush: raise Review('Rush with a treat-as-LV flag')
            e = [{'trigger': 'STATIC', 'flag': 'TREAT_LV3', 'to': 'self', 'if': cond}]
            if mm.group(2) == '2': e[0]['n'] = 2
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r"^If you control no ((?:Cost \d+ )?(?:Red |Purple |Green |White |Yellow |Blue )?(?:\"[^\"]+\" family )?)Spirits, this Spirit can't attack\.?$", p, re.I)
        cond = (COND_HOOK('you control a ' + mm.group(1) + 'Spirit') if COND_HOOK else None) if mm and mm.group(1) else None
        if cond and 'ctrl' in cond:      # v0.184 STATIC CANT_ATTACK while you control no <colour/family> Spirit (ctrl nLe 0)
            if rush: raise Review('Rush with a conditional can\'t-attack')
            q = dict(cond['ctrl']); q.pop('n', None); q['nLe'] = 0
            e = [{'trigger': 'STATIC', 'flag': 'CANT_ATTACK', 'to': 'self', 'if': {'ctrl': q}}]
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r'^While you control (two|three|\d) or (?:less|fewer) Spirits, (?:this Spirit is treated as being at|treat this Spirit as being (?:at|on)) \[?LV3\]?\.?$', p, re.I)
        if mm:      # v0.181 STATIC TREAT_LV3 (engine treatLv3 in lvIndex)
            if rush: raise Review('Rush with a treat-as-LV3 flag')
            e = [{'trigger': 'STATIC', 'flag': 'TREAT_LV3', 'to': 'self', 'if': {'ctrl': {'type': 'Spirit', 'nLe': num(mm.group(1))}}}]
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r'^\(Permanent\)\s*(?:All )?"([^"]+)" (?:family )?spirits you control (?:gain|get) \+(\d[\d,]*) ?BP\.?$', p, re.I)
        if mm:      # v0.181 old wording '(Permanent) All "Winged Beast" spirits you control get +1000BP' = STATIC own BP for a family
            if rush: raise Review('Rush with a constant effect')
            e = {'trigger': 'STATIC', 'bp': bp(mm.group(2)), 'to': 'own', 'match': {'family': [mm.group(1)]}}
            if lv: e['lv'] = lv
            return [e], flags
        mm = re.match(r'^The cost of all ((?:"[^"]+"(?:\s*/\s*"[^"]+")*) family) Spirit cards in your Hand becomes (\d+)\.?$', p, re.I)
        if mm:      # v0.186 STATIC flag HAND_COST (engine handCostSet in effCost)
            e = [{'trigger': 'STATIC', 'flag': 'HAND_COST', 'to': 'self', 'n': int(mm.group(2)), 'match': {'family': re.findall(r'"([^"]+)"', mm.group(1))}}]
            if lv: e[0]['lv'] = lv
            return e, flags
        mm = re.match(r"^Cost (\d+)/(\d+) Spirits can(?:'t|not) attack/block\.?$", p, re.I)
        if mm:      # v0.183 STATIC CANT_ATTACK + CANT_BLOCK to:'all' (both players' Spirits, engine flagActive)
            e = [{'trigger': 'STATIC', 'flag': f, 'to': 'all', 'match': {'type': 'Spirit', 'costIn': [int(mm.group(1)), int(mm.group(2))]}} for f in ('CANT_ATTACK', 'CANT_BLOCK')]
            if lv: [x.update(lv=lv) for x in e]
            return e, flags
        mm = re.match(r"^Neither player's Life can be reduced by the attacks of Cost (\d+) or less Spirits\.?$", p, re.I)
        if mm:      # v0.186 STATIC flag NO_ATTACK_LIFE (engine attackLifeLocked)
            e = [{'trigger': 'STATIC', 'flag': 'NO_ATTACK_LIFE', 'to': 'self', 'costLe': int(mm.group(1))}]
            if lv: e[0]['lv'] = lv
            return e, flags
        if re.match(r"^Cards can't be discarded from either (?:player's )?deck\.?$", p, re.I):      # v0.180 STATIC flag NO_DECK_DISCARD
            e = [{'trigger': 'STATIC', 'flag': 'NO_DECK_DISCARD', 'to': 'self'}]
            if lv: e[0]['lv'] = lv
            return e, flags
        sw = step_window(re.sub(r"^\(During (?:Your|the) Battle Phase\)", '(Your Attack Step)', p, flags=re.I) if re.match(r'^\(During (?:Your|the) Battle Phase\)\s*(?:All )?"', p, re.I) else p, card, lv, rush)      # v0.70: generic step window head; v0.183 old wording '(During Your Battle Phase) "X" spirits you control get +N BP' (the Battle Phase is the Attack Step here)
        if sw is not None: e, f2 = sw; flags.update(f2); return e, flags
        raise Review('no trigger: ' + p[:100])
    if soul_if: extra = dict(extra or {}, **{'if': {'selfSoul': True}})
    return trig_effects(p, card, trig, tmatch, lv, rush, flags, dict(extra or {}, noStack=True) if nostack else extra)


def trig_effects(p, card, trig, tmatch, lv, rush, flags, extra=None):
    acts, opt = [], False
    mo = re.match(r'^\(Once per Turn: Same Name\)\s*', p, re.I)
    if mo:      # v0.76: the limit in front of a triggered body (CR Categories of Effects "(Once Per Turn: Same Name)"): once per turn for all cards of this name
        p = p[mo.end():]; extra = dict(extra or {}, once=True, sameName=True)
    p = p.lstrip(); mo = re.match(r'^\(Once Per Turn\)\s*', p, re.I)
    if mo: p = p[mo.end():]; extra = dict(extra or {}, once=True)      # v0.170: the plain limit (Na-Nascita "(When Blocks) (Once Per Turn) You can refresh this Spirit"), per card, not per name
    mo = re.search(r'\s*This effect can only be used once per turn\.?\s*$', p, re.I)
    if mo: p = p[:mo.start()]; extra = dict(extra or {}, once=True)      # v0.184 old trailing wording of the plain once-per-turn limit
    if rush and not p: raise Review('Rush without a main effect')
    for s in sentences(p):
        a, o = action_of(s, {'trigger': trig, 'battle': bool((extra or {}).get('if', {}).get('selfAttacking'))})      # v0.185 (During Attack) MAGIC_USED: a battle is running
        if acts and o: raise Review('optional second sentence: ' + s[:80])
        acts += a; opt = opt or o
    if not acts: raise Review('empty body')
    if rush:
        for s in [x for part in re.split(r'(?:(?<=[.!])|\n)\s*:\s+', rush[1].lstrip(': ')) for x in sentences(part)]:      # v0.184: several ": effect" lines
            a, o = action_of(s, {'trigger': trig})
            if o: raise Review('Rush: optional Rush effect: ' + s[:60])
            acts += [dict(x, **{'if': {'hasSymbol': rush_sym(rush[0])}}) for x in a]
        rush = None
    if (set(trig) & {'DESTROYED', 'DESTROYED_OPP', 'DESTROYED_OPPD', 'DESTROYED_OPPFX', 'LEAVES', 'LEAVES_OPPFX'}) and any(a['do'] in SELF_ACTS and a.get('to', 'self') == 'self' and not (a['do'] == 'SELF_TO_HAND' and set(trig) <= {'DESTROYED', 'DESTROYED_OPP', 'DESTROYED_OPPD', 'DESTROYED_OPPFX'}) for a in acts):      # v0.171 SELF_TO_HAND under a destroyed trigger returns the card from the Trash
        raise Review('(When Destroyed) effect about this Spirit: ' + p[:80])
    out = []
    for t in trig:
        e = {'trigger': 'RUMBLE_DISCARD', 'exOnly': True} if t == 'RUMBLE_DISCARD+EX' else {'trigger': 'RUMBLE_DISCARD', 'other': True} if t == 'RUMBLE_DISCARD+OTHER' else {'trigger': 'ATTACKS', 'alsoBlocks': True} if t == 'ATTACKS+BLOCKS' else {'trigger': t.split('_OPP')[0]} if t in ('DESTROYED_OPP', 'DESTROYED_OPPD', 'DESTROYED_OPPFX', 'LEAVES_OPPFX') else {'trigger': t}
        if lv: e['lv'] = lv
        if tmatch: e['match'] = dict(tmatch)
        if t in ('DESTROYED_OPP', 'DESTROYED_OPPD'): e['if'] = {'byOpp': True}
        if t == 'DESTROYED_OPPD': e['alsoDepleted'] = True
        if t in ('DESTROYED_OPPFX', 'LEAVES_OPPFX'): e['if'] = {'byOppFx': True}
        if extra: e.update(extra)
        if opt: e['optional'] = True
        e['actions'] = acts
        out.append(e)
    return out, flags


# ---------- Magic paragraphs ----------
MAGIC_HEAD = [
    (r'^\(Flash Step\)\s*\(Your Main Ph(?:a|r)ase\)\s*', ['MAIN', 'FLASH']),
    (r'^\(Main Step\)\s*\(Flash Step\)\s*', ['MAIN', 'FLASH']),
    (r'^Flash\s*-?\s*', ['FLASH']),
    (r'^Main\s*-?\s*', ['MAIN']),
    (r'^\(Flash Step\)\s*', ['FLASH']),
    (r'^\(Main Step\)\s*|^\(Your Main Ph(?:a|r)ase\)\s*', ['MAIN']),
]

def magic_spec(body, tim=()):
    """Body -> {"effect":..., "value":...} using the simple MAGIC_FX types where they fit, ACTIONS otherwise.
    v0.180: a Rush marker splits the body; the Rush sentences become actions with if.hasSymbol (like a Spirit's Rush)."""
    mr = re.search(r'⟦RUSH:([\w/]+)⟧', body)
    rush = None
    if mr:
        rush = (mr.group(1), body[mr.end():].strip()); body = body[:mr.start()].strip()
        if '⟦' in rush[1] or not body or not rush[1]: raise Review('Rush on a Magic: odd shape')
    ss = sentences(body)
    if len(ss) == 1 and not rush:
        L = ss[0].rstrip('.').lower()
        for p, f in [
            (r'^(?:during this turn, )?give (?:a|one|target) spirit(?:/ultimate)? +\+(\d[\d,]*) ?bp$', lambda m: {'effect': 'BP_PLUS', 'value': bp(m.group(1))}),
            (r'^target spirit (?:gets|gains) \+(\d[\d,]*) ?bp(?: until (?:the )?end of (?:the )?turn)?$', lambda m: {'effect': 'BP_PLUS', 'value': bp(m.group(1))}),
            (r'^destroy an opposing (\d[\d,]*) ?bp or less spirit$|^destroy an opposing spirit with (\d[\d,]*) ?bp or less$', lambda m: {'effect': 'DESTROY_BP_LE', 'value': bp(m.group(1) or m.group(2))}),
            (r'^exhaust an opposing spirit$', lambda m: {'effect': 'EXHAUST_OPP', 'value': 0}),
            (r'^draw ' + W + r' cards?$', lambda m: {'effect': 'DRAW', 'value': num(m.group(1))}),
        ]:
            m = re.match(p, L)
            if m: return f(m)
    acts = []
    for s in ss:
        a, o = action_of(s, {'kind': 'magic', 'battle': 'FLASH' in tim})      # v0.75: a Flash Magic may say "during this battle" (the actions do nothing outside a battle)
        if o: raise Review('optional clause in Magic: ' + s[:80])
        acts += a
    if rush:
        for s in [x for part in re.split(r'(?:(?<=[.!])|\n)\s*:\s+', rush[1].lstrip(': ')) for x in sentences(part)]:
            a, o = action_of(s, {'kind': 'magic', 'battle': 'FLASH' in tim})
            if o: raise Review('optional clause in Magic Rush: ' + s[:80])
            acts += [dict(x, **{'if': {'hasSymbol': rush_sym(rush[0])}}) for x in a]
    if any(a['do'] in ('REFRESH', 'VOID_TO_CARD', 'BP_PLUS') and a.get('to', 'self') == 'self' for a in acts):
        raise Review('Magic sentence about "this Spirit": ' + body[:80])
    return {'effect': 'ACTIONS', 'value': 0, 'actions': acts}


TEAM_LINE = re.compile(r'(?m)^[ \t]*\[Teams?:[^\]\n]+\][ \t]*(?:\n|$)')
TEAM_HEAD = re.compile(r'^\[Teams?:[^\]]+\]$')
NO_MAIN = re.compile(r"^(?:\(Can't Use in Main\)|You can(?:'|no)t use this card (?:during|in) (?:the )?Main Step\.?)$", re.I)


def magic_card(paras, n=None):
    by, no_main = {}, False
    for p in paras:
        if NO_MAIN.match(p): no_main = True; continue      # v0.64: "You can't use this card during Main Step." -> magic.noMain (v0.44 engine flag)
        if TEAM_HEAD.match(p): continue      # the team is read from the card text by the engine (cardTeams)
        fk = flag_para(p)
        if fk and n is not None:
            n[fk] = True; continue
        fm = re.match(r'^This card has (?:the )?"([^"]+)" family\.?$', p)
        if fm and n is not None:
            n['families'] = sorted(set(n.get('families') or []) | {fm.group(1)}); continue
        tim = None
        for rx, ts in MAGIC_HEAD:
            m = re.match(rx, p)
            if m: tim = ts; p = p[m.end():]; break
        if tim is None: raise Review('Magic paragraph without Main/Flash: ' + p[:80])
        spec = magic_spec(p, tim)
        for t in tim:
            if t in by: raise Review('two effects for the same timing')
            by[t] = spec
    timing = [t for t in ('MAIN', 'FLASH') if t in by]
    if no_main and 'FLASH' not in timing: raise Review("can't use in Main without a Flash effect")
    specs = {json.dumps(by[t], sort_keys=True) for t in timing}
    if len(specs) == 1:
        s = by[timing[0]]; m = {'timing': timing, 'effect': s['effect'], 'value': s['value']}
        if 'actions' in s: m['actions'] = s['actions']
    else:
        m = {'timing': timing, 'effect': None, 'value': 0, 'by': {t: by[t] for t in timing}}
    if no_main: m['noMain'] = True
    return m


# ---------- Burst (v0.54) ----------
BURST_WHEN = [   # Fandom {{Burst|...}} condition -> engine BURST_WHEN key (02c-effects-parse.js); v0.71: export spelling variants + OPP_ATTACK, OPP_SUMMON_ADV_FX
    (r'after your life is (?:ree?duced|decreased)', 'LIFE_DECREASE'),
    (r'after your spirit(?:/ultimate)? is (?:depleted/)?destroyed by the opponent', 'ALLY_DESTROYED'),
    (r"after an opp?posing spirit(?:/brave|/ultimate|'s/brave)?'s \(when summoned\) effect (?:resolves|activates)", 'OPP_SUMMON_FX'),
    (r"after an opposing spirit(?:/brave|/ultimate)?'s \(when summoned/advents?\) effect (?:resolves|activates)", 'OPP_SUMMON_ADV_FX'),
    (r'after the opposing hand increases (?:via|with|by) (?:an opposing effect|opposing effects)', 'OPP_HAND_UP'),
    (r'after an opposing spirit attacks', 'OPP_ATTACK'),
    (r'after an opposing spirit/ultimate attacks', 'OPP_ATTACK'),
]
BURST_BLOCK = re.compile(r'^\s*\{\{[Bb]urst\|(?:s\|)?([^}|]*)\}\}\s*(.*)$', re.S)      # v0.181 the newer export spelling {{Burst|s|<condition>}}

def burst_block(text):
    """Split off the {{Burst|condition}} paragraph -> (burst dict or None, rest of the text).
    v0.71: the Burst paragraph may stand anywhere (Fandom puts it first or after the card's own Main/Flash text)."""
    blocks = re.split(r'\n\s*\n', (text or '').replace('\r', '').strip())
    i = next((k for k, x in enumerate(blocks) if BURST_BLOCK.match(x)), None)
    if i is None: return None, text
    m = BURST_BLOCK.match(blocks[i])
    cond = re.sub(r'^after after ', 'after ', m.group(1).strip().lower().replace('oopponent', 'opponent'))      # v0.181 export typos
    when = next((k for rx, k in BURST_WHEN if re.fullmatch(rx, cond)), None)
    if when is None: raise Review('Burst condition: ' + cond[:70])
    b = {'when': when, 'actions': []}
    if cond == 'after an opposing spirit attacks': b['noUlt'] = True
    for s in sentences(re.sub(r'\s+', ' ', m.group(2))):
        x = s.rstrip('.').strip()
        if re.fullmatch(r'(?:After this effect resolves, )?(?:summon this (?:Spirit )?|deploy this (?:Nexus )?)card,?(?: without paying the cost)?', x, re.I):
            b['actions'].append({'do': 'SUMMON_SELF'}); continue
        mm = re.fullmatch(r"Then,? by paying the cost, activate (?:this card's (Flash|Main) effect|the (Flash|Main) effect of this card)", x, re.I)
        if mm: b['then' + (mm.group(1) or mm.group(2)).capitalize()] = True; continue
        if any(a['do'] == 'SUMMON_SELF' for a in b['actions']): raise Review('Burst sentence after the summon: ' + s[:80])
        a, o = action_of(s, {'kind': 'burst'})
        if o: raise Review('optional clause in Burst: ' + s[:80])
        if any(y['do'] in SELF_ACTS and y.get('to', 'self') == 'self' for y in a): raise Review('Burst sentence about this Spirit: ' + s[:80])
        b['actions'] += a
    if not b['actions']: raise Review('Burst without actions')
    if len(b['actions']) > 5: raise Review('Burst with more than 5 actions')
    return b, '\n\n'.join(blocks[:i] + blocks[i + 1:])


# ---------- Ultimate summon condition (v0.56) ----------
UT_PARA = re.compile(r'^Ultimate Trigger\s*((?:\[LV\d\])+)\s*\(When Attacks\)\s*When Ultimate Trigger hits, (.+)$', re.S)   # v0.56 inline form only
SUMCON = re.compile(r'^\s*(?:\{\{\s*[Ss]umcon\|([^}]*)\}\}|\[Summon Condition:\s*([^\]]*)\])\s*(?:\n\s*\n|$)')
CTRL_ONE = re.compile(r'^(one|two|three|\d) or more (?:cost (\d+) or (?:higher|more|above|greater) )?(.*?)\s*(spirits?/ultimates?|spirits?|ultimates?)$', re.I)

def ctrl_one(s):
    m = CTRL_ONE.match(s)
    if not m: raise Review('summon condition: ' + s[:70])
    n, cost, mid, kind = num(m.group(1)), m.group(2), m.group(3).strip(), m.group(4).lower()
    q = {'n': n, 'type': 'Both' if '/' in kind else 'Ultimate' if kind.startswith('ultimate') else 'Spirit'}
    if cost: q['costGe'] = int(cost)
    if mid:
        cols = mid.lower().split('/')
        if all(c in COLOURS for c in cols): q['colors'] = cols
        elif re.fullmatch(r'[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*', mid): q['family'] = mid
        else: raise Review('summon condition: ' + s[:70])
    return q

def sumcon(s):
    """{{Sumcon|...}} / [Summon Condition: ...] text -> engine summonIf (fxIf keys), None for "None"; Review otherwise."""
    x = re.sub(r'\s+', ' ', s).strip().rstrip('.').strip()
    if x.lower() == 'none': return None
    m = re.fullmatch(r'(?:Your Life is at|At Least) (\w+) (or more|or less|Lives)', x, re.I)
    if m: return {'lifeLe': num(m.group(1))} if m.group(2).lower() == 'or less' else {'lifeGe': num(m.group(1))}
    m = re.fullmatch(r'You have (\w+) counters? or more', x, re.I)
    if m: return {'counterGe': num(m.group(1))}
    m = re.fullmatch(r'You must have (\d) or more (.+?)(?: on your field)?', x, re.I)
    if m: x = 'You control ' + m.group(1) + ' or more ' + m.group(2)
    m = re.fullmatch(r'Controlling at least (\w+) (.+)', x, re.I)
    if m: x = 'You control ' + m.group(1) + ' or more ' + m.group(2)
    m = re.fullmatch(r'You control (.+)', x)
    if not m: raise Review('summon condition: ' + x[:70])
    parts = [ctrl_one(re.sub(r'(?i)^(one|two|three|\d) or more cost', lambda mm: mm.group(0).lower(), p.strip())) for p in re.split(r' and (?=(?:one|two|three|\d) or more)', m.group(1))]
    return {'ctrl': parts[0] if len(parts) == 1 else parts}

def ultimate_text(c, t):
    """Split the summon condition off an Ultimate's text -> (summonIf or None, rest, display text)."""
    m = SUMCON.match(t or '')
    if not m: raise Review('Ultimate with no summon condition block (Contract Advent / Manifest or other text)')
    cond = (m.group(1) if m.group(1) is not None else m.group(2)).strip()
    rest = (t or '')[m.end():]
    rest = re.sub(r'(?m)^\s*utb\s*$', '', rest)
    rest = re.sub(r'\s*\(Ultimate Trigger: [^)]*\)', '', rest)       # the reminder text (rule: action ULT_TRIGGER)
    for p in re.split(r'\n\s*\n', rest):
        if not re.search(r'Ultimate[- ]Trigger', p): continue
        if not UT_PARA.match(p.strip()):
            if re.match(r'^\s*Ultimate Trigger\s*\n', p): raise Review('Ultimate Trigger (export drops its [LVn] (timing) line)')
            raise Review('Ultimate Trigger form: ' + re.sub(r'\s+', ' ', p.strip())[:70])
    if re.search(r'(?m)^\s*uhand\s*$', rest): raise Review('Ultimate: "uhand" template (Ultimate in Hand rule)')
    return sumcon(cond), rest, '[Summon Condition: ' + cond + ']\n\n' + rest.strip()


# ---------- card ----------
SOUL_MAGIC_COLS = {'r': 'red', 'p': 'purple', 'g': 'green', 'w': 'white', 'y': 'yellow', 'b': 'blue',
                   'red': 'red', 'purple': 'purple', 'green': 'green', 'white': 'white', 'yellow': 'yellow', 'blue': 'blue'}


# ---------- v0.68 Invoke (Standard activations; Std manual "FAQ on Effects" Q11) ----------
INVOKE_TPL = re.compile(r'\s*\{\{\s*Invoke\s*\|\s*(Flash|Main)\s*\}\}\s*', re.I)
INVOKE_MARK_RE = re.compile(r'\u27e6INVOKE:(FLASH|MAIN)\u27e7')
INVOKE_HEADS = {'(Your Attack Step)': 'yourAttack', '(Opposing Attack Step)': 'oppAttack', '(Either Attack Step)': 'eitherAttack',
                '(Your Turn)': 'yourTurn', '(During Attack)': 'duringAttack', '(During Block)': 'duringBlock', '(During Attack/Block)': 'duringAttackBlock'}


# v0.135 Form Change: {{F Change|"Gaim" & Cost 6}} {{Invoke|Main}} -> a marker the Invoke paragraph reads (schema v8 FORM_CHANGE)
FC_TPL = re.compile(r'\{\{\s*F Change\s*\|\s*"([^"]+)"\s*&\s*Cost\s*(\d+(?:/\d+)*)\s*\}\}\s*', re.I)
FC_MARK = re.compile(r'⟦FC:([^:⟧]+):([\d/]+)⟧')
FC_NAME = {'Parado': 'Para-DX'}      # house reading: the printed "Parado" is the Para-DX cards (their data family is EX-AID; no card name contains "Parado")
FC_BODY = re.compile(r'^Return this exhausted Spirit to the Hand, and you must summon a Cost ([\d/]+) "([^"]+)" with a different name from your Hand, without paying the cost\.?$', re.I)


CUR_TPL = re.compile(r'\{\{\s*Current\s*\|[^}]*\}\}\s*', re.I)      # v0.170 Current: reminder template of the Invoke effect below it; the body sentence carries the rule, so it is dropped


def invoke_mark(t):
    if t and INVOKE_TPL.search(t): t = CUR_TPL.sub('', t)
    t = FC_TPL.sub(lambda m: ' ⟦FC:%s:%s⟧ ' % (m.group(1), m.group(2)), t or '') if t else t
    return INVOKE_TPL.sub(lambda m: ' \u27e6INVOKE:%s\u27e7 ' % m.group(1).upper(), t or '') if t else t


def invoke_cost(x, card):
    """the part before the arrow -> engine cost (exactly one kind); Review otherwise"""
    L = x.strip().rstrip('.').strip()
    own = 'nexus' if card['type'] == 'Nexus' else 'spirit'
    m = re.match(r'^pay (one|two|three|four|five|\d) costs?$', L, re.I)
    if m: return {'pay': num(m.group(1).lower())}
    m = re.match(r'^(exhaust|destroy) this (spirit|nexus)$', L, re.I)
    if m and m.group(2).lower() == own: return {'exhaustSelf' if m.group(1).lower() == 'exhaust' else 'destroySelf': True}
    m = re.match(r'^exhaust one of your "([^"]+)" family (nexus(?:es)?|spirits?)$', L, re.I)
    if m: return {'exhaustOwn': {'kind': 'nexus' if m.group(2).lower().startswith('nexus') else 'spirit', 'match': {'family': [m.group(1)]}}}
    m = re.match(r'^exhaust one of your (nexus(?:es)?|spirits)$', L, re.I)
    if m: return {'exhaustOwn': {'kind': 'nexus' if m.group(1).lower().startswith('nexus') else 'spirit'}}
    m = re.match(r'^discard (?:a|one) "([^"]+)" family card from your hand$', L, re.I)
    if m: return {'discard': {'match': {'family': [m.group(1)]}}}
    m = re.match(r'^discard a cost (\d(?:/\d)*) (white|red|green|blue|yellow|purple) (spirit|nexus) card from your hand$', L, re.I)
    if m: return {'discard': {'match': {'costIn': [int(x) for x in m.group(1).split('/')], 'color': m.group(2).lower(), 'type': m.group(3).capitalize()}}}
    m = re.match(r'^return this (spirit|nexus) to the deckbottom$', L, re.I)
    if m and m.group(1).lower() == own: return {'returnSelf': True}
    m = re.match(r'^return one of your "([^"]+)" family (nexus(?:es)?|spirits?) to the deckbottom$', L, re.I)
    if m: return {'returnOwn': {'kind': 'nexus' if m.group(2).lower().startswith('nexus') else 'spirit', 'match': {'family': [m.group(1)]}}}
    m = re.match(r'^return one of your (' + TEAMS + r') (nexus(?:es)?|spirits?) to the deckbottom$', L, re.I)
    if m: return {'returnOwn': {'kind': 'nexus' if m.group(2).lower().startswith('nexus') else 'spirit', 'match': {'team': m.group(1).title()}}}      # v0.185 team match (schema 55)
    raise Review('Invoke cost: ' + L[:80])


def invoke_para(p, card, lv, rush):
    """[LVn] (heads) <INVOKE> (Once Per Turn|Battle) [<cost> ▶] <effect> -> one ACTIVATE effect"""
    if rush: raise Review('Rush with Invoke')
    m = re.match(r'^(.*?)\u27e6INVOKE:(FLASH|MAIN)\u27e7\s*(\(Once Per (Turn|Battle)\))?\s*(.*)$', p)
    pre, kind, oncep, body = m.group(1).strip(), m.group(2), m.group(4), m.group(5).strip()
    fc = FC_MARK.search(pre)
    if fc: pre = FC_MARK.sub('', pre).strip()
    when, main_only = None, False
    for h in re.findall(r'\([^)]*\)', pre):
        if h in INVOKE_HEADS and when is None: when = INVOKE_HEADS[h]
        elif h == '(Your Main Step)' and kind == 'FLASH': main_only = True
        else: raise Review('Invoke head: ' + h)
    if re.sub(r'\([^)]*\)', '', pre).strip(): raise Review('Invoke head: ' + pre[:60])
    if kind == 'MAIN' and when not in (None, 'yourTurn'): raise Review('Invoke head: Main with ' + when)
    if INVOKE_MARK_RE.search(body): raise Review('two Invoke effects in one paragraph')
    cost, icond = None, None
    if '\u25b6' in body:
        ctxt, body = body.split('\u25b6', 1); body = body.strip()
        mi = re.match(r'^If (.+?), ((?:pay|exhaust|destroy|return|discard) .+)$', ctxt.strip(), re.I)      # v0.185 "If <condition>, <cost> ▶" = the effect's if (engine activatable() checks e.if)
        if mi:
            import compile_v2 as _v2
            icond = _v2.cond_of(mi.group(1))
            if icond is None: raise Review('Invoke condition: ' + mi.group(1)[:80])
            ctxt = mi.group(2)
        cost = invoke_cost(ctxt, card)
    same, acts = False, []
    for s in sentences(body):
        if re.fullmatch(r'You can only use this effect of the same card name once per turn\.?', s.strip(), re.I): same = True; continue
        if fc:      # v0.135 Form Change: the one body sentence must agree with the template, then it is one FORM_CHANGE action
            b = FC_BODY.match(s.strip())
            if not b or b.group(1) != fc.group(2) or b.group(2) != fc.group(1) or kind != 'MAIN' or cost: raise Review('Form Change body: ' + s[:100])
            acts.append({'do': 'FORM_CHANGE', 'match': {'name': [FC_NAME.get(fc.group(1), fc.group(1))]}, 'costIn': [int(x) for x in fc.group(2).split('/')]})
            continue
        a, _o = action_of(s, {'trigger': ['ACTIVATE']})
        acts += a
    if not acts: raise Review('Invoke without an effect')
    e = {'trigger': 'ACTIVATE', 'invoke': True, 'timing': ['MAIN', 'FLASH'] if kind == 'FLASH' and not main_only else ['MAIN']}
    if when: e['when'] = when
    e['once'] = bool(oncep) or same
    if oncep == 'Battle': e['oncePer'] = 'battle'
    if same: e['sameName'] = True
    if lv: e['lv'] = lv
    if cost: e['cost'] = cost
    if icond: e['if'] = icond
    e['actions'] = acts
    return e


TRUE_RELEASE = re.compile(r"\[LV2\]'?\s*\(True Release\)\s*")

LEGACY_HEAD = re.compile(r'(?m)^[ \t]*\(Legacy\)[ \t]*(?:\n|$)')


def compile_card(c):
    n = {k: c[k] for k in KEEP if k in c}
    if c.get('keyword'): n['mechanics'] = [c['keyword']]
    txt = c.get('text')
    if c['type'] == 'Ultimate':      # v0.56
        si, txt, n['text'] = ultimate_text(c, txt)
        if si: n['summonIf'] = si
        txt = re.sub(r'\b([Tt])his Ultimate\b', lambda m: m.group(1) + 'his Spirit', txt)
    txt = TEAM_LINE.sub('', txt or '', count=1) if txt else txt      # "[Team: X]" head line: the engine reads it from the card text (cardTeams)
    sm = re.match(r'^\s*\{\{\s*Soul Magic\s*\|\s*([^}|]*)[^}]*\}\}\s*\n?', txt or '')   # also {{Soul Magic|p||<printed text>}}
    if sm:                            # v0.64 Soul Magic (Standard CR 12-2-1-2): "If you control any <colour> symbol, you can use it with just the Soul Core"
        col = SOUL_MAGIC_COLS.get(sm.group(1).strip().lower())
        if c['type'] != 'Magic': raise Review('Soul Magic on a ' + c['type'])
        if not col: raise Review('Soul Magic colour: ' + sm.group(1)[:10])
        n['soulMagic'] = col; txt = txt[sm.end():]
    if txt and LEGACY_HEAD.search(txt):      # v0.69 Legacy (= Succession, Standard CR 12-2-1-3): the "(Legacy)" line is the head, banishing EX cards from the Trash pays reduction symbols (engine: legacyPlan)
        if c['type'] not in ('Spirit', 'Nexus', 'Magic'): raise Review('Legacy on a ' + c['type'])
        n['legacy'] = True; txt = LEGACY_HEAD.sub('', txt, count=1)
    if txt and '(True Release)' in txt:     # v0.66 True Release (= Super Unleash, Standard CR 12-2-1-1): LV2 by its cores OR by the Soul Core alone
        if c['type'] not in ('Spirit', 'Nexus'): raise Review('True Release on a ' + c['type'])
        if len(c.get('levels') or []) < 2: raise Review('True Release without an LV2')
        txt2 = TRUE_RELEASE.sub('[LV2] ', txt)       # the export also has "[LV2]' (True Release)" (26RBS01-032)
        if '(True Release)' in txt2: raise Review('True Release outside an [LV2] head')
        n['trueRelease'] = True; txt = txt2
    txt = invoke_mark(txt)
    b, rest = burst_block(txt)
    if b:
        if c['type'] not in ('Spirit', 'Magic'): raise Review('Burst on a ' + c['type'])
        if c['type'] == 'Spirit' and not any(a['do'] == 'SUMMON_SELF' for a in b['actions']): raise Review('Spirit Burst without the summon')
        if c['type'] == 'Magic' and any(a['do'] == 'SUMMON_SELF' for a in b['actions']): raise Review('Magic Burst with a summon')
        if (b.get('thenFlash') or b.get('thenMain')) and c['type'] != 'Magic': raise Review('then-Flash/Main Burst on a Spirit')
        n['burst'] = b
    t = clean(armor_mark(rush_mark(rest)))
    if c['type'] not in ('Spirit', 'Magic') and '\u27e6RUSH' in t: raise Review('Rush on a ' + c['type'])
    if c['type'] == 'Brave' and not c.get('brave'): raise Review('Brave without combine data (export)')
    if c['type'] in ('Spirit', 'Brave', 'Ultimate') and not c.get('levels'): raise Review('no level data')
    L = c.get('levels') or []
    if any(L[i]['cores'] <= L[i - 1]['cores'] for i in range(1, len(L))): raise Review('level thresholds not ascending (export)')
    if not t:
        if c['type'] == 'Magic': raise Review('Magic without text')
        if b: raise Review('Burst only, no other text')
        n['fxComplete'] = True
        return n
    paras = paragraphs(t)
    if c['type'] == 'Magic':
        n['magic'] = magic_card(paras, n)
        tim = n['magic']['timing']
        if b and ((b.get('thenFlash') and 'FLASH' not in tim) or (b.get('thenMain') and 'MAIN' not in tim)): raise Review('Burst then-effect without that timing')
    else:
        effects = []
        for p in paras:
            fk = flag_para(p)
            if fk: n[fk] = True; continue
            e, f = spirit_paragraph(p, c)
            effects += e; n.update(f)
        if len(effects) > 8: raise Review('more than 8 effects')
        if effects: n['effects'] = effects
    n['fxComplete'] = True
    return n


A1_NOTE = 'Partial card (v0.79.0'     # v0.79.0 (A1): set by tools/promote_compiled.mjs on bulk-promoted partial cards


def a1_partial(c):
    """a card in data/cards that the A1 bulk promotion put there with part of its effect missing"""
    return bool(c.get('residual')) and A1_NOTE in (c.get('note') or '')


def staged():
    """the compile pool: cards in data/import that are not in data/cards, plus (v0.79.0, A1) the bulk-promoted partial cards,
    whose staging record stays in data/import so every later compiler change can make them complete (promotion replaces them)"""
    have = {c['id'] for f in glob.glob(os.path.join(ROOT, 'data/cards/saga-[0-9][0-9].json')) for c in json.load(open(f, encoding='utf8')) if not a1_partial(c)}
    for f in sorted(glob.glob(os.path.join(ROOT, 'data/import/saga-[0-9][0-9].json'))):
        for c in json.load(open(f, encoding='utf8')):
            if c['id'] not in have: yield c


def main(argv):
    sel = lambda c: True
    if '--saga' in argv: s = int(argv[argv.index('--saga') + 1]); sel = lambda c, s=s: c.get('saga') == s
    if '--ids' in argv: ids = set(argv[argv.index('--ids') + 1].split(',')); sel = lambda c, ids=ids: c['id'] in ids
    vanilla_only = '--vanilla' in argv
    ok, rev = [], []
    for c in staged():
        if vanilla_only and (c.get('text') or '').strip(): continue
        if not vanilla_only and not sel(c): continue
        try: ok.append(compile_card(c))
        except Review as e: rev.append((c['id'], c['name'], str(e)))
    reasons = collections.Counter(re.sub(r':.*', '', r[2]) for r in rev)
    print(f'compiled {len(ok)}, review {len(rev)}  ' + ', '.join(f'{k} {v}' for k, v in reasons.most_common(8)))
    if '--out' in argv:
        json.dump(ok, open(argv[argv.index('--out') + 1], 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if '--review' in argv:
        with open(argv[argv.index('--review') + 1], 'w', encoding='utf-8') as f:
            f.write('# Effect compiler review list (generated by tools/compile_effects.py; do not edit)\n\n')
            f.write(f'{len(rev)} cards stay staged. Reasons:\n\n')
            for k, v in reasons.most_common(): f.write(f'- {k}: {v}\n')
            f.write('\n| Card | Name | First reason |\n|---|---|---|\n')
            for i, nm, r in rev: f.write(f'| {i} | {nm} | {r.replace("|", "/")} |\n')
    return ok, rev


if __name__ == '__main__':
    main(sys.argv[1:])
