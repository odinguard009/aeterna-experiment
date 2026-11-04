"""English card text from a Fandom infobox 'effect' field: tools/fetch_fandom_std.clean_text plus the core icons, which that
cleaner drops (the library writes the Soul Core as "(Soul Core)"; the other icons follow the same pattern)."""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import fetch_fandom_std as F

ICON = re.compile(r'\[\[\s*file:\s*([^\]|]*?)\s*(?:\|[^\]]*)?\]\]', re.I)
def icon(m):
    n = re.sub(r'[_\s ]+', ' ', m.group(1)).lower()
    n = re.sub(r'\.(png|jpg|gif|webp)$', '', n).strip()
    if n in ('soul core', 'god core', 'six-color core') or re.fullmatch(r'(red|blue|green|yellow|purple|white) core', n):
        return ' (' + n.title().replace('-C', '-C') + ')'
    return ''                                             # ut.png / wut.png / xut.png: unknown symbols stay in the Japanese text
def clean_effect(raw):
    return F.clean_text(ICON.sub(icon, raw or ''))
