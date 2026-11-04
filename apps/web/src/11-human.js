/* ---------------------------------------------------------------------
   HUMAN ACTIONS: the dialogs of the human seat. Board actions are intent records (v0.84.0, F3 = M3 rest):
   the buttons send them with sendIntent (13e-host.js); the engine checks and runs them (packages/engine/src/05c-intent.js).
   --------------------------------------------------------------------- */
const humanCan = () => seatCan('player');

function legalityHTML(card) {
  const row = (name, f) => { const r = legalityOf(card.id, f), lim = banStatus(card.id, f) === 'limit1';
    return `<span class="lg ${r ? 'no' : 'ok'}">${name}: ${r ? '🚫 ' + esc(r) : lim ? '⚠ limited to 1' : '✓ legal'}</span>`; };
  return `<div class="legality">${row('Eternal', 'eternal')}${row('Standard', 'standard')}</div>`;
}
/* v0.31 card-style effect text (issue #6): one line per effect block, level / timing tags and keywords marked.
   Reused everywhere effect text is shown (card detail, enlarged card, hand prompt). Input is plain card text; output is escaped HTML. */
const FX_KW_START = /^(Burst:|Revive\b|Contract Skill\b|Contract Field\b|Awaken\b|Manifest\b|Mirage\b|Over Count\b|Brave\b|Seal\b|Grand Skill\b|Grand Field\b|Core Charge\b|Neo-Core Charge\b|Oracle\b|Unseal\b)/;
const FX_LINE_STOP = ['(Can\'t Stack)', '[Can\'t Stack]', '(Unstackable)'];
/* v0.205.1: the imported wiki text carries template calls ({{Invoke|Flash}}, {{Rush|Purple}}, {{Armor|Red}}, a {{#tag:tabber}} with a Japanese and an English version).
   descText turns them into readable words: a tabber keeps its English / Standard version, a call becomes a ⟦Name: args⟧ marker that fxMark renders as a tappable word. */
const TPL_NAMES = { ha: 'Heavy Armor', ua: 'Ultra Armor', catl: 'Catalyze', adcon: 'Advent Condition', mirage: 'Mirage', burst: 'Burst', sumcon: 'Sumcon', invoke: 'Invoke', rush: 'Rush', accel: 'Accel', seal: 'Seal', mani: 'Mani', unleash: 'Unleash',
  // wiki template short names spelled out (Template:<name> on the Fandom wiki; owner review 2026-11-01: "Gs: 4" read like a lost word)
  gs: 'Grand Skill', ww: 'Whirlwind', cs: 'Contract Skill', iw: 'Ice Wall', sb: 'Summon Bolt', pb: 'Poison Blade', uha: 'Ultra Heavy Armor', gp: 'Grandphosis', twt: 'Twinkle Trace',
  ws: 'Windstorm', ia: 'Illusive Armor', ii: 'Illusive Immortality', mb: 'Mirage Boost', cb: 'Count Break', camou: 'Camouflage', astmu: 'Astromulet', meal: 'Mealtiply', disp: 'Dispersion',
  shaman: 'Shamanism', msyn: 'Mirage Synchro', mflash: 'Mirage Flash', psa: 'PS Armor', vpsa: 'VPS Armor', 'cf unleash': 'CF Unleash', 'sa unleash': 'SA Unleash', 'in unleash': 'IN Unleash',
  'd assault': 'D Assault', 'c count break': 'C Count Break', 'f change': 'F Change', 'b engage': 'B Engage', 'tw catl': 'TW Catalyze', 'w catl': 'W Catalyze' };
function descText(raw) {
  let t = String(raw || ''); if (t.indexOf('{{') < 0) return t;
  t = t.replace(/\{\{#tag:\s*tabber\s*\|([\s\S]*)\}\}\s*$/, (m, body) => { const parts = body.split('{{!}}-{{!}}'); const pick = parts.find(p => /^\s*(Eng|English|Standard)/i.test(p)) || parts[parts.length - 1]; return pick.replace(/^\s*[^=\n]*=\s*/, '').trim(); });
  return t.replace(/\{\{([^{}|]+)((?:\|[^{}]*)?)\}\}/g, (m, n, a) => {
    n = n.trim(); if (n === '!') return '';
    const nm = TPL_NAMES[n.toLowerCase()] || n.charAt(0).toUpperCase() + n.slice(1);
    const args = a.split('|').slice(1).map(x => x.trim().replace(/^\((.*)\)$/, '$1').replace(/\s*\(\)$/, '').trim()).filter(x => x && x !== '!');
    if (n.toLowerCase() === 'tk' && args.length > 1) return '⟦' + args[0] + '⟧ ' + args.slice(1).join(' ');     // {{tk|Ultimate Trigger|[LV4][LV5] (When Attacks)}}: the name is the marker, the level tag stays plain text (a level tag inside a marker split the line)
    return '⟦' + nm + (args.length ? ': ' + args.join(' · ') : '') + '⟧';
  });
}
/* tappable rule words (data-a="gloss"): the longest term first; the word is looked up in KEYWORD_GLOSSARY with its aliases */
const glossText = v => KEYWORD_GLOSSARY[v] || KEYWORD_GLOSSARY[String(v).toUpperCase().replace(/[ -]+/g, '_')] || '';
const FX_TERM_RE = new RegExp('\\b(' + Object.keys(TERM_GLOSSARY).concat(['Advent', 'Contract Advent', 'Manifest', 'Mirage', 'Burst', 'Flash', 'Rumble', 'Amplify', 'Heavy Exhaust']).filter(k => !k.includes("'")).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');
const familyRowHTML = c => (c.families || []).length ? `<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="cp-h">Family</span>${c.families.map(f => `<span class="tag dim">${esc(f)}</span>`).join('')}</div>` : '';
/* v0.209: the imported text keeps the wiki's own lines, so the source paragraphs are respected (the old version flattened them) and the
   wiki leftovers are dropped: marker lines (utb, heb, GWrule, CArule ...), a level run that repeats ([LV1][LV2][LV3] [LV2][LV3]) keeps its last part,
   header-only lines (Main / Flash / Trigger Counter / a bare level tag) join the line below them, a block marker (█ ◆ ■) starts its own line. */
const FX_JUNK = /^(?:[a-z]?utb|uhand|heb|(?:GP)?GWrule|[CF]Arule)$/;
const FX_HEAD = /^(?:(?:\[LV[\d-]+\]\s*)+|(?:Main|Flash|Trigger Counter|Core Charge:|Neo-Core Charge:)(?:\s*-\s*[A-Za-z ]+)?[:-]?|During (?:Set|Brave|Seal|Soul)(?: \(When \w+\))?)$/;
function fxLevelRuns(t) {
  return t.replace(/(?:\[LV\d(?:-\d)*\]\s*){2,}/g, run => {
    const tags = run.match(/\[LV\d(?:-\d)*\]/g); let from = 0;
    tags.forEach((x, i) => { if (i && parseInt(x.slice(3), 10) <= parseInt(tags[i - 1].slice(3), 10)) from = i; });
    return tags.slice(from).join('') + ' ';
  });
}
function effectLines(text) {
  const paras = [];
  for (let l of descText(text).split(/\n/)) {
    l = l.replace(/\s+/g, ' ').trim(); if (!l || FX_JUNK.test(l)) continue;
    const prev = paras.length ? paras[paras.length - 1] : '';
    if (prev && /^[a-z]/.test(l) && !/[.!?:)"\]”]$/.test(prev) && !FX_HEAD.test(prev)) paras[paras.length - 1] = prev + ' ' + l;
    else if (prev && FX_HEAD.test(prev)) paras[paras.length - 1] = prev + ' ' + l;
    else paras.push(l);
  }
  const out = [];
  for (const para of paras) {
    // break before a run of level tags (unless it follows another tag, e.g. [Spirit][LV1]), before a block marker, and before a block keyword / timing tag that starts a sentence
    const t = fxLevelRuns(para).replace(/\[Lv(\d)/g, '[LV$1').replace(/(?<!\])\s*((?:\[LV\d(?:-\d)*\])+)/g, (m, run, i) => (i ? '\n' : '') + run)
         .replace(/\s*([█◆■])/g, '\n$1')
         .replace(/([.!:)\]])\s+(?=(Burst:|Revive\b|Contract Skill\b|Contract Field\b|Awaken\b|Manifest\b|Mirage\b|Over Count\b|\(Flash\)|\[Flash\]|\[Main\]|\(Can't Stack\)|\[Can't Stack\]|\(Flash Step\)))/g, '$1\n');
    for (let line of t.split('\n')) {
      line = line.trim(); if (!line) continue;
      for (const k of FX_LINE_STOP) if (line.startsWith(k) && line.length > k.length) { out.push(k); line = line.slice(k.length).trim(); }
      if (line) out.push(line);
    }
  }
  // a bare level run that the keyword split left alone joins the line below it
  for (let i = out.length - 2; i >= 0; i--) if (/^(?:\[LV[\d-]+\])+$/.test(out[i])) out.splice(i, 2, out[i] + ' ' + out[i + 1]);
  return out;
}
function fxMark(line) {
  return fxTerms(fxMark0(line));
}
/* text outside tags: ⟦marker⟧ -> tappable word, known rule words -> tappable (a word already inside a tappable chip stays as it is) */
function fxTerms(h) {
  return h.split(/(<[^>]+>|⟦[^⟧]*⟧)/).map(p => {
    if (p.charAt(0) === '<') return p;
    if (p.charAt(0) === '⟦') { const s = p.slice(1, -1), i = s.indexOf(': '), nm = i < 0 ? s : s.slice(0, i), rest = i < 0 ? '' : s.slice(i + 2);
      return `<span class="fx-tpl"${glossText(nm.replace(/&#039;/g, "'")) ? ` data-a="gloss" data-v="${nm}"` : ''}>${nm}</span>${rest ? `<span class="fx-ta">${rest}</span>` : ''}`; }
    return p.replace(FX_TERM_RE, (m, w) => `<span class="fx-term" data-a="gloss" data-v="${w}">${w}</span>`);
  }).join('');
}
function fxMark0(line) {
  return esc(line)
    .replace(/\[LV(\d(?:-\d)*)\]/g, '<span class="fx-lv">LV$1</span>')
    .replace(/(\[(?:Can&#039;t Stack|Main|Flash)\]|\((?:Can&#039;t Stack|Unstackable)\))/g, '<span class="fx-kw">$1</span>')
    .replace(/\(([A-Z][^()]{0,40})\)/g, (m, x) => /^Can&#039;t Stack$/.test(x) ? m : `<span class="fx-tm">(${x})</span>`)
    .replace(new RegExp('^(' + FX_KW_START.source.slice(2, -1) + ')'), '<span class="fx-kw">$1</span>');
}
/* a break point after "/" between words, so justified lines do not stretch around long "A/B/C" names (tags are never touched) */
const slashBreak = h => h.replace(/(\w)\/(?=\w)/g, '$1/<wbr>');
function effectTextHTML(card, head) {
  const lines = effectLines(card && card.desc);
  const h = head ? `<div class="fx-head"><b>${esc(card.name)}</b><span>${esc(card.token ? 'Token Spirit' : card.type)} · ${esc(cap(card.symbol || ''))} · Cost ${card.cost}</span></div>` : '';
  return `<div class="fx-card">${h}<div class="fx-body">${lines.length ? lines.map(l => `<div class="fx-line">${slashBreak(fxMark(l))}</div>`).join('') : '<div class="fx-line fx-none">No effect text.</div>'}</div></div>`;
}
function cardDetailHTML(card, noArt) {
  const col = `var(--color-${card.symbol})`;
  const pills = (card.keywords || []).map(k => `<span class="glossary-pill" data-a="gloss" data-v="${k}">${k}</span>`).join(' ');
  const lv = card.type === 'Magic' ? `Timing: ${(card.magic ? card.magic.timing : ['MAIN']).map(x => x === 'MAIN' ? 'Main' : 'Flash').join(' / ')}` : card.levels.map((L, i) => card.countLv ? `LV${i + 1}: Count ${L.cores}` : `LV${i + lvBase(card)}: ${L.cores} core${L.cores === 1 ? '' : 's'}${L.bp != null ? ' / ' + L.bp + ' BP' : ''}`).join('<br>');
  const red = Object.entries(card.reduction || {}).map(([k, n]) => `${cap(k)} ×${n}`).join(', ') || 'none';
  const art = noArt ? '' : `<div class="art-thumb" data-a="zoom" data-v="${esc(card.id)}" title="Tap to enlarge">${cardFaceHTML(card, false)}<span class="zoom-ic">🔍</span></div>`;
  return `${art}<div class="cd-info" style="border:2px solid ${col};border-radius:6px;padding:8px;text-align:left;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;"><b>${esc(card.name)}</b>
        <span class="cd-cost" style="background:${col};color:${['yellow', 'white'].includes(card.symbol) ? '#141922' : '#fff'};">Cost ${card.cost}</span></div>
      <div style="font-size:calc(8.5px*var(--t));color:var(--text-muted);margin-top:3px;">${esc(card.token ? 'Token Spirit' : card.type)} · ${esc(cap(card.symbol))} · ${card.symbols} symbol${card.symbols === 1 ? '' : 's'} · Reduction: ${esc(red)}</div>
      ${(card.families || []).length ? `<div class="cd-fam" style="font-size:calc(8.5px*var(--t));margin-top:3px;"><b>Family:</b> ${card.families.map(f => esc(f)).join(', ')}</div>` : ''}
      <div class="cd-lv" style="font-size:calc(8.5px*var(--t));margin-top:3px;">${lv}</div>
      ${noArt ? '' : legalityHTML(card)}
      ${pills ? `<div style="margin-top:4px;">${pills}</div>` : ''}</div>
    <div style="font-size:calc(9.5px*var(--t));text-align:left;background:rgba(255,255,255,.05);padding:6px;border-radius:4px;border:1px solid var(--border-line);">
      <b>Effect text:</b>${effectTextHTML(card, false)}${card.implemented ? '' : card.partial ? '<div class="warn-note">⚠ Only part of this effect text is implemented in this build yet.' + residualHTML(card) + '</div>' : '<div class="warn-note">⚠ This effect is not implemented in this build yet.</div>'}</div>`;
}
const residualHTML = card => (card.residual && card.residual.length ? '<br>Not implemented yet:<ul style="margin:2px 0 0 14px;padding:0;">' + card.residual.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>' : '');
/* v0.155.0 (batch 4, mockup art()): a card without a picture gets generated art (colour glow, ridges, a silhouette by type); drawn by code from the card id, no printed artwork */
const ART_HEX = { red: '#d9383a', purple: '#9b51e0', green: '#27ae60', yellow: '#f5e50a', blue: '#2f80ed', white: '#e0e0e0', ultimate: '#d4af37', god: '#b8c4d6' };
const ART_CACHE = new Map();
function artMix(a, b, t) { const x = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), y = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function cardArtSVG(card) {
  const hit = ART_CACHE.get(card.id); if (hit) return hit;
  let h = 7; for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  const col = ART_HEX[card.symbol] || '#8a93a3', dk = artMix(col, '#000000', .78), md = artMix(col, '#000000', .5), lt = artMix(col, '#ffffff', .35), gid = 'ga' + (h % 1e6) + card.id.replace(/\W/g, '');
  let s = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${md}"/><stop offset="1" stop-color="${dk}"/></linearGradient><radialGradient id="${gid}g" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${lt}" stop-opacity=".85"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs><rect width="100" height="140" fill="url(#${gid})"/><circle cx="${40 + r() * 20}" cy="${46 + r() * 8}" r="${30 + r() * 8}" fill="url(#${gid}g)"/>`;
  for (let i = 0; i < 3; i++) { let d = 'M0 140 L0 ' + (88 + i * 8 + r() * 10); for (let x = 12; x <= 100; x += 12 + r() * 10) d += ` L${x} ${80 + i * 10 + r() * 22}`; s += `<path d="${d} L100 140Z" fill="${artMix(col, '#000000', .55 + i * .14)}" opacity=".85"/>`; }
  const P = a => a.map(p => p.join(',')).join(' '), fill = artMix(col, '#000000', .86), cx = 50, cy = 62;
  if (card.type === 'Spirit' || card.type === 'Ultimate' || card.type === 'Brave') {
    const w = 12 + r() * 10, k = Math.floor(r() * 3);
    if (k === 0) s += `<polygon points="${P([[cx, cy - 24], [cx + w, cy - 4], [cx + w + 18 + r() * 8, cy - 20 - r() * 10], [cx + w - 2, cy + 18], [cx + 6, cy + 34], [cx - 6, cy + 34], [cx - w + 2, cy + 18], [cx - w - 18 - r() * 8, cy - 20 - r() * 10], [cx - w, cy - 4]])}" fill="${fill}" stroke="${lt}" stroke-width=".8"/>`;
    else if (k === 1) s += `<polygon points="${P([[cx - 30, cy + 26], [cx - 28, cy + 2], [cx - 16, cy - 10], [cx - 20, cy - 26], [cx - 10, cy - 14], [cx + 4, cy - 16], [cx + 10, cy - 30], [cx + 14, cy - 12], [cx + 30, cy - 4], [cx + 34, cy + 26], [cx + 22, cy + 26], [cx + 18, cy + 8], [cx - 12, cy + 8], [cx - 16, cy + 26]])}" fill="${fill}" stroke="${lt}" stroke-width=".8"/>`;
    else s += `<polygon points="${P([[cx, cy - 34], [cx + 7, cy - 22], [cx + 8, cy - 8], [cx + 30, cy + 34], [cx + 6, cy + 18], [cx, cy + 36], [cx - 6, cy + 18], [cx - 30, cy + 34], [cx - 8, cy - 8], [cx - 7, cy - 22]])}" fill="${fill}" stroke="${lt}" stroke-width=".8"/>`;
    s += `<circle cx="${cx - 4}" cy="${cy - 12}" r="1.6" fill="${lt}"/><circle cx="${cx + 4}" cy="${cy - 12}" r="1.6" fill="${lt}"/>`;
  } else if (card.type === 'Magic') {
    for (let i = 0; i < 4; i++) s += `<circle cx="50" cy="60" r="${10 + i * 9}" fill="none" stroke="${lt}" stroke-width="${1.6 - i * .3}" opacity="${.9 - i * .18}" stroke-dasharray="${4 + i * 3} 3"/>`;
    for (let i = 0; i < 10; i++) { const a = i * 36 * Math.PI / 180; s += `<path d="M50 60 L${50 + Math.cos(a) * 46} ${60 + Math.sin(a) * 46}" stroke="${lt}" stroke-width=".6" opacity=".5"/>`; }
  } else s += `<path d="M30 112 L30 60 L38 60 L38 44 L46 44 L46 30 L50 22 L54 30 L54 44 L62 44 L62 60 L70 60 L70 112Z" fill="${artMix(col, '#000000', .82)}" stroke="${lt}" stroke-width=".8"/><rect x="44" y="70" width="12" height="18" rx="6" fill="${lt}" opacity=".8"/>`;
  for (let i = 0; i < 14; i++) s += `<circle cx="${r() * 100}" cy="${r() * 90}" r="${r() * 1.1 + .3}" fill="#fff" opacity="${.3 + r() * .6}"/>`;
  const out = `<svg class="ph-art" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
  ART_CACHE.set(card.id, out); return out;
}
function cardFacePlaceholder(card, withCost, col, extra) {
  const bp = card.levels[0] && card.levels[0].bp != null ? card.levels[0].bp + ' BP' : card.brave ? 'Brave +' + card.brave.bp + ' BP' : '';
  return `<div class="cface ph" style="--card-col:${col}${extra ? ';' + extra : ''}">${cardArtSVG(card)}<div class="ph-name">${esc(card.name)}</div><div class="ph-sub">${esc(card.token ? 'Token Spirit' : card.type)} · ${esc(cap(card.symbol))}${withCost ? ' · Cost ' + card.cost : ''}</div><div class="ph-txt">${slashBreak(esc(descText(card.desc).replace(/[⟦⟧]/g, '')))}</div><div class="ph-bp">${bp}</div></div>`;
}
function cardFaceHTML(card, withCost) {
  const col = `var(--color-${card.symbol})`;
  const cbm = `<span class="cbm" data-s="${card.symbol}" aria-hidden="true"></span>`;   // v0.143.0: colour-blind shape marker, shown only when the setting is on
  const aid = (typeof artOf === 'function') ? artOf(card.id) : card.id;   // v0.155.0: the art picked on the card page is used everywhere (an unavailable picture falls back to the card's own)
  const src = cardImgSrc(aid) || (aid !== card.id ? cardImgSrc(card.id) : '');                              // v0.112.0: player image first, then the online mirror
  if (!src) return cbm + cardFacePlaceholder(card, withCost, col);
  // A player blob never fails; the mirrored URL may 404 (the wiki lacks that card), so it carries an
  // onerror that swaps to the text placeholder rendered right behind it.
  if (IMG[aid] || IMG[card.id]) return `${cbm}<img class="cface" style="--card-col:${col}" src="${src}" alt="${esc(card.name)}">`;
  return `${cbm}<img class="cface" style="--card-col:${col}" src="${src}" alt="${esc(card.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">${cardFacePlaceholder(card, withCost, col, 'display:none')}`;
}
/* v0.27: card images for a list of cards (instances or ids), in a strip that scrolls sideways */
function cardStripHTML(list, head) {
  if (!list || !list.length) return '';
  const ids = list.map(x => (typeof x === 'string' ? x : x.id)).filter(id => CARDS[id]);
  return `${head ? `<div class="strip-head">${esc(head)} (${ids.length})</div>` : ''}<div class="card-strip">${ids.map(id => mullCardHTML(CARDS[id])).join('')}</div>`;
}
function mullCardHTML(card, mark) {   // mark (v0.155.0, mockup mulligan): an "Easy" tag on cards that cost 3 or less, payable from the first Reserve
  return `<div class="mull-card" data-a="zoom" data-v="${esc(card.id)}" title="Tap to enlarge">${cardFaceHTML(card, false)}${mark && card.cost <= 3 ? '<span class="tag mull-easy">Easy</span>' : ''}<div class="nm">${esc(card.name)}</div></div>`;
}
function openZoom(id, uid) {
  const card = CARDS[id], z = $('zoom-overlay'); if (!card || !z) return;
  if (MODAL && MODAL.cfg.uiOnly && MODAL.cfg.title === '🎴 Card Detail' && $('action-modal').classList.contains('active')) closeModal(null);   // 2026-11-02: the zoom sits below dialogs (z 200 < 210), so the magnifier on the Card Detail art opened it behind that dialog
  z.classList.toggle('top', !!(MODAL && $('action-modal').classList.contains('active')));   // v0.216 UI: opened from a zone sheet (Trash, Removed ...): the card info sits above the sheet, not behind it
  if (uid == null && (['view-library', 'view-card'].some(v => $(v).classList.contains('active')))) return openCardPage(id);   // v0.137.0: the Library card is a page
  /* Aegis-style: landscape / PC = card left, scrolling detail panel right; portrait = card on top, scrolling panel below */
  const W = window.innerWidth, H = window.innerHeight, land = W >= H * 1.1;
  const zw = land ? Math.round(Math.max(150, Math.min(420, (H - 32) / 1.4, W * 0.4))) : Math.round(Math.max(150, Math.min(360, W * 0.62, H * 0.45 / 1.4)));
  z.dataset.id = id; z.style.setProperty('--zw', zw + 'px'); z.classList.toggle('land', land);
  z.innerHTML = `<div class="zc-card">${cardFaceHTML(card, true)}</div><div class="zc-side"><div class="zc-info" data-a="zoominfo">${uid != null && G ? liveStatusHTML(fieldList(G.p.player).concat(fieldList(G.p.opponent)).find(x => x.uid === uid)) : ''}${cardDetailHTML(card, true)}${uid == null && $('view-library').classList.contains('active') ? cardPageHTML(id) : ''}</div><button class="modal-btn cancel zc-close" data-a="zoomclose">Close</button></div>`;
  z.classList.add('active'); cardTilt(z.querySelector('.zc-card'));
}
function handButtons(p, inst, withDetail) {
  const card = CARDS[inst.id], c = effCost(p, card), buttons = [];
  if (withDetail) buttons.push({ label: '🔎 Card Info', cls: 'blue', value: 'detail' });
  if (humanCan() && isMainStep()) {
    if (card.type === 'Magic') {
      const ok = magicUsable(p, inst, 'main'), t = magicTargets(p, inst, 'main');
      const smOnly = ok && c > coresAvailable(p);           // v0.64 Soul Magic: only the Soul Core can pay
      buttons.push({ label: ok ? (smOnly ? '✨ Cast (Soul Magic: pay the Soul Core)' : `✨ Cast (Pay ${c}${soulMagicOK(p, card) ? ' or the Soul Core' : ''})`) : (c > coresAvailable(p) ? `Not enough cores (needs ${c})` : 'No valid target'), cls: 'primary', value: 'cast', dis: !ok });
    } else {
    if (card.contractAdvent) buttons.push({ label: '✨ Contract Advent (Soul Core to Trash)', cls: 'purple', value: 'cadvent', dis: !contractAdventTargets(p, inst, 'main').length });
    if (card.manifest) buttons.push({ label: '✨ Manifest (Soul Core to Trash)', cls: 'purple', value: 'manifest', dis: !manifestTargets(p, inst).length });
    if (card.brave) { const bok = braveAfford(p, inst) && braveTargets(p, inst).length > 0;
      buttons.push({ label: bok ? `🗡 Summon combined with a Spirit (Pay ${c})` : (braveTargets(p, inst).length ? `Not enough cores (needs ${c})` : 'Brave: no Spirit meets the Brave condition'), cls: 'primary', value: 'brave', dis: !bok }); }
    const afford = canPlayCard(p, inst);
    if (isSpiritForm(card) || card.type === 'Nexus') buttons.push({ label: afford ? `🎴 ${card.type === 'Nexus' ? 'Place Nexus' : 'Summon'} (Pay ${c})` : `Not enough cores (needs ${c + minCores(card)})`, cls: 'primary', value: 'play', dis: !afford });
    }
    for (const { e, idx } of accelList(card)) { const ok = accelOK(p, inst, idx, 'MAIN');   // v0.50 Accel
      buttons.push({ label: ok ? `⚡ Accel (Pay ${accelCost(p, e)}): ${fxDescribe(e)}`.slice(0, 140) : `Accel: not usable now (needs ${accelCost(p, e)} cores and a target)`, cls: 'primary', value: 'accel:' + idx, dis: !ok }); }
    if (card.burst) buttons.push({ label: p.burstSetThisTurn ? '🂠 Burst already set this turn' : '🂠 Set as Burst', cls: 'blue', value: 'burst', dis: p.burstSetThisTurn });
    if (card.mirage) { const mu = mirageUsable(p, inst);
      buttons.push({ label: p.mirageSetThisTurn ? '🌀 Mirage already set this turn' : (mu ? `🌀 Set as Mirage (Pay ${card.mirage.cost})` : `Mirage: not enough cores (needs ${card.mirage.cost})`), cls: 'purple', value: 'mirage', dis: !mu }); }
  }
  return buttons;
}
const HAND_INTENTS = { play: 'summon', burst: 'burst', cadvent: 'cadvent', manifest: 'manifest', cast: 'cast', brave: 'brave', mirage: 'mirage' };
function runHandAction(p, inst, v) {
  if (!G || !G.p.player.hand.includes(inst)) return;
  if (HAND_INTENTS[v]) sendIntent({ type: HAND_INTENTS[v], uid: inst.uid });
  else if (typeof v === 'string' && v.startsWith('accel:')) sendIntent({ type: 'accel', uid: inst.uid, idx: Number(v.slice(6)) });
}
/* entry points kept for the Python suite (humanCast, v20) and the console (window.BS): each sends one intent and resolves when it was applied */
const humanCast = inst => sendIntent({ type: 'cast', uid: inst.uid });
const humanAttack = f => sendIntent({ type: 'attack', uid: f.uid });
const onNext = () => sendIntent({ type: 'next' });
/*SIDES_START*//*SIDES_END*/
/* Rebirth Side B (display only): the back face of a Rebirth front card, parsed on demand from the embedded sidecar; it is never a CARDS entry,
   so it cannot reach a deck, the Library list, the counts or a match. */
let REB_SIDES = null; const REB_CACHE = {}, REB_BY_ID = {};   // REB_BY_ID: back-face id (BS73-061B) -> face, for its picture (cardImgSrc)
function rebirthSideOf(id) {
  const f = CARDS[id]; if (!f || !f.rebirthTo || typeof BUILTIN_SIDES !== 'string' || !BUILTIN_SIDES) return null;
  if (REB_CACHE[id]) return REB_CACHE[id];
  if (!REB_SIDES) REB_SIDES = loadFlavor(BUILTIN_SIDES);
  const o = REB_SIDES[id] || REB_SIDES[String(f.rebirthTo).replace(/B$/, '')], r = o ? parseCard(o) : null;   // a reprint (SD52-005) has no page of its own: it flips to the back of the print it copies (CB13-027B)
  if (!r || !r.card) return null;
  const face = (REB_CACHE[id] = Object.assign({}, r.card, { desc: o.text || '', implemented: false, partial: true, residual: (o.residual || []).slice(), side: true }));
  REB_BY_ID[face.id] = face; return face;
}
async function showCardDetail(id, ctx, uid, back) {
  const card = CARDS[id]; if (!card) return;
  const sideCard = ctx !== 'hand' ? rebirthSideOf(id) : null, showB = !!(back && sideCard);      // no flip for a hand card: that menu is a recorded match action
  let buttons = [], inst = null;
  if (showB) { /* the back face is a view only: no Add / Remove */ }
  else if (ctx === 'deck') {
    const n = PLAYER_DECK[id] || 0;
    const mx = maxCopies(id, FORMAT), bad = legalityOf(id, FORMAT);
    buttons.push({ label: bad ? `🚫 Not legal in ${fmtName(FORMAT)}` : `＋ Add to deck (${n}/${mx})`, cls: 'primary', value: 'add', dis: !!bad || n >= mx });
    buttons.push({ label: '－ Remove from deck', cls: 'blue', value: 'sub', dis: n <= 0 });
  } else if (ctx === 'hand' && G) {
    inst = G.p.player.hand.find(h => h.uid === uid) || null;
    if (inst) buttons = handButtons(G.p.player, inst, false);
  }
  if (sideCard) buttons.push({ label: showB ? '↻ Side A' : '↻ Side B', cls: 'blue', value: 'flip' });
  buttons.push({ label: 'Close', cls: 'cancel', value: null });
  /* v0.105.1 fix (regression R15): with inst (a hand card mid-match) this menu carries the played action, so it records again -
     v0.104's uiOnly tagging was for view-only dialogs and wrongly swallowed these action menus (the replay diverged at a hand tap) */
  const v = await modal({ uiOnly: !inst, title: '🎴 Card Detail', html: showB ? cardDetailHTML(sideCard, true) : cardDetailHTML(card), buttons });
  if (v === 'flip' && sideCard) { showCardDetail(id, ctx, uid, !showB); return; }
  if (inst) { runHandAction(G.p.player, inst, v); return; }
  if (ctx === 'deck' && (v === 'add' || v === 'sub')) {
    dbChange(id, v === 'add' ? 1 : -1); showCardDetail(id, 'deck');
  }
}
async function openHandModal(uid) {
  const p = G.p.player, inst = p.hand.find(h => h.uid === uid); if (!inst) return;
  const card = CARDS[inst.id], c = effCost(p, card);
  const buttons = handButtons(p, inst, true);
  buttons.push({ label: '✖ Cancel', cls: 'cancel', value: null });
  /* v0.105.1 fix (regression R15): the tap menu chooses the played action (summon/soul/magic/...) - it must record its answer,
     else the replay cannot drive a hand tap and diverges at the open menu (v0.104's uiOnly tagging was view-only scope) */
  const v = await modal({ title: card.name, wide: true, html: cardStripHTML([inst]) + effectTextHTML(card, true) + `<div class="fx-pay">You pay ${c} (after reduction)</div>`, buttons });
  if (!G || !G.p.player.hand.includes(inst)) return;
  if (v === 'detail') showCardDetail(inst.id, 'hand', inst.uid);
  else runHandAction(p, inst, v);
}
async function openFieldModal(key, kind, uid) {
  const p = G.p[key], f = fieldList(p).find(x => x.uid === uid); if (!f) return;
  const card = CARDS[f.id], mine = key === 'player' && humanCan();
  if (key === 'opponent' || G.watch) { showCardDetail(f.id); return; }   // v0.216 UI: an opponent card (both sides in CPU vs CPU) opens its card info at once, no choice dialog; nothing to act on
  const k = lvIndex(f);
  const stack = f.under.length ? cardStripHTML(f.under, 'Under this card') : '';
  const html = `${esc(card.token ? 'Token Spirit' : card.type)} · Lv${k + lvBase(card)}${isSpiritForm(card) ? ' · ' + bpOf(f) + ' BP' : ''} · Cores ${f.cores}${f.soul ? ' + Soul Core' : ''}${f.exhausted ? ' · Exhausted' : ''}${f.brave ? ' · Brave: ' + esc(CARDS[f.brave.id].name) + ' (+' + CARDS[f.brave.id].brave.bp + ' BP)' : ''}${ocActive(f) ? ' · Over Count active' : ''}${stack}`;
  /** the empty-cell + info buttons: cls is optional (plain disabled info buttons have none). */
  const buttons = /** @type {{label: string, cls?: string, value: string | null, dis?: boolean, hidden?: boolean}[]} */ ([{ label: '🔎 Card Info', cls: 'blue', value: 'detail' }]);
  if (mine && isMainStep()) {
    for (const { idx, e } of activatable(p, f, 'MAIN')) buttons.push({ label: `⚡ Activate: ${fxDescribe(e)}`.slice(0, 140), cls: 'primary', value: 'act:' + idx });
    if (card.type === 'Brave' && card.brave && p.spirits.includes(f)) buttons.push({ label: '🗡 Combine with a Spirit (Brave)…', cls: 'primary', value: 'bcombine', dis: !braveTargets(p, f).length });
    if (f.brave) buttons.push({ label: `🗡 Separate ${CARDS[f.brave.id].name}`, cls: 'blue', value: 'bseparate', dis: !canSeparate(p, f) });
    if (isGW(f)) buttons.push({ label: 'ℹ Grandwalker cores cannot be moved or used to pay costs', cls: 'blue', value: 'x', dis: true });
    else buttons.push({ label: '💎 + Core (from Reserve)', cls: 'primary', value: 'add', dis: p.reserve.n < 1 });
    if (f.cores > 0 && !isGW(f)) {
      const dep = isSpiritForm(card) && totalCores(f) - 1 < minCores(card);
      buttons.push({ label: `📤 − Core (to Reserve)${dep ? ' — depletes!' : ''}`, cls: 'blue', value: 'remove' });
    }
    const others = fieldList(p).filter(x => x !== f && !isGW(x));      // nothing can be moved onto a Grandwalker Nexus (p. 22)
    if (f.cores > 0 && !isGW(f) && others.length) {
      const dep = isSpiritForm(card) && totalCores(f) - 1 < minCores(card);
      buttons.push({ label: `➡ Move 1 core to another card…${dep ? ' — depletes!' : ''}`, cls: 'blue', value: 'movecore' });
    }
    const holder = others.find(x => x.soul);
    if (f.soul) {
      buttons.push({ label: '↩ Return Soul Core to Reserve', cls: 'purple', value: 'unsoul' });
      buttons.push({ label: '🔄 Swap Soul Core with a core on another card…', cls: 'purple', value: 'swapsoul', dis: !others.some(x => x.cores > 0) });
    } else if (p.reserve.soul) {
      buttons.push({ label: '✨ Move Soul Core here (from Reserve)', cls: 'purple', value: 'soul' });
    } else if (holder) {
      const nm = CARDS[holder.id].name, ok = !(isSpiritForm(CARDS[holder.id]) && spare(holder) < 1);
      buttons.push({ label: ok ? `✨ Move Soul Core here (from ${nm})` : `✨ Move Soul Core here (${nm} would deplete)`, cls: 'purple', value: 'soul', dis: !ok });
      buttons.push({ label: `🔄 Swap Soul Core of ${nm} with a core here`, cls: 'purple', value: 'swaphere', dis: f.cores < 1 });
    } else buttons.push({ label: '✨ Soul Core is not on your field or Reserve', cls: 'purple', value: 'x', dis: true });
  } else if (mine && G.step === 5 && isSpiritForm(card)) {
    if (G.turnNo === 1) buttons.push({ label: 'No attacks on the first turn', value: 'x', dis: true });
    else if (f.noAB) buttons.push({ label: 'Cannot attack or block', value: 'x', dis: true });
    else if (cantAttack(G.p.player, f)) buttons.push({ label: 'Cannot attack', value: 'x', dis: true });
    else if (f.exhausted && !canPursuit(G.p.player, f)) buttons.push({ label: 'Spirit is Exhausted', value: 'x', dis: true });
    else buttons.push({ label: '⚔ Attack', cls: 'primary', value: 'attack' });
  }
  buttons.push({ label: '✖ Cancel', cls: 'cancel', value: null });
  /* v0.105.1 fix (regression R15): the field menu also carries intents (activate/attack/cores) - its answer records again
     (viewing closures answer null and are harmless in the record); v0.104's uiOnly tagging was view-only scope */
  const v = await modal({ title: card.name, wide: f.under.length > 0, html, buttons });
  if (!G || G.over) return;
  if (v === 'detail') { showCardDetail(f.id); return; }
  if (!mine) return;
  if (typeof v === 'string' && v.startsWith('act:')) { await sendIntent({ type: 'act', uid: f.uid, idx: Number(v.slice(4)) }); return; }
  if (v === 'bcombine' || v === 'bseparate') { await sendIntent({ type: v, uid: f.uid }); return; }
  const op = { add: 'add', remove: 'remove', soul: 'soul', unsoul: 'unsoul', swaphere: 'swaphere', movecore: 'move', swapsoul: 'swapsoul' }[v];
  if (op) { await sendIntent({ type: 'core', op, uid: f.uid }); return; }
  if (v === 'attack') { sendIntent({ type: 'attack', uid: f.uid }); return; }
  render();
}

