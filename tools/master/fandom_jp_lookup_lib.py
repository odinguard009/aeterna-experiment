"""Shared Fandom helpers (read-only MediaWiki API): api(), blocks() (every CardTable of a page, one-line or many-line infobox), fetch_pages(), nt()."""
import json, re, time, unicodedata, urllib.parse, urllib.request
API = 'https://battle-spirits.fandom.com/api.php'; UA = 'aeterna-card-data/1.0 (read-only, batched)'
KEYS = 'kanji|jpname|image|releasedjp|releaseden|color|cost|reduction|symbols|family|level|effect|jpeffect|flavor|jpflavor|enflavor|rarity|illust|rulings|type|extra|sets?\\d*|number\\d*|rarity\\d*'
def nt(s): return re.sub(r'\s+', '', unicodedata.normalize('NFKC', s or ''))
def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    for a in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(API + '?' + q, headers={'User-Agent': UA}), timeout=60))
        except Exception:
            if a == 2: raise
            time.sleep(2 + 3 * a)
def blocks(text):
    """every {{CardTable..}} of a page -> {key: raw value}; fields may share a line (|kanji = X|image = Y)."""
    out = []
    for m in re.finditer(r'\{\{CardTable\d*(.*?)(?:\n\}\}|\}\}\s*(?:\n|$))', text or '', re.S):
        body = m.group(1); f = {}
        parts = re.split(r'(?:^|\n|(?<=[^\s{\[]))\|\s*(' + KEYS + r')\s*=', body, flags=re.I)
        for i in range(1, len(parts) - 1, 2): f.setdefault(parts[i].lower(), parts[i + 1].strip())
        out.append(f)
    return out
def fetch_pages(titles):
    out = {}
    for i in range(0, len(titles), 50):
        b = titles[i:i + 50]
        r = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'redirects': 1, 'titles': '|'.join(b)})
        q = r.get('query', {}); back = {}
        for k in ('normalized', 'redirects'):
            for x in q.get(k, []): back[x['to']] = x['from']
        for p in q.get('pages', []):
            if p.get('revisions'):
                t = p['title']; src = back.get(t, t); src = back.get(src, src); out[src] = out[t] = p['revisions'][0]['slots']['main']['content']
        time.sleep(1)
    return out
