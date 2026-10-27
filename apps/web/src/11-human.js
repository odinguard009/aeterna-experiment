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
function effectLines(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  // break before a run of level tags (unless it follows another tag, e.g. [Spirit][LV1]), and before a block keyword / timing tag that starts a sentence
  t = t.replace(/(?<!\])\s*((?:\[LV\d\])+)/g, (m, run, i) => (i ? '\n' : '') + run)
       .replace(/([.!:)\]])\s+(?=(Burst:|Revive\b|Contract Skill\b|Contract Field\b|Awaken\b|Manifest\b|Mirage\b|Over Count\b|\(Flash\)|\[Flash\]|\[Main\]|\(Can't Stack\)|\[Can't Stack\]))/g, '$1\n');
  const out = [];
  for (let line of t.split('\n')) {
    line = line.trim(); if (!line) continue;
    for (const k of FX_LINE_STOP) if (line.startsWith(k) && line.length > k.length) { out.push(k); line = line.slice(k.length).trim(); }
    if (line) out.push(line);
  }
  return out;
}
function fxMark(line) {
  return esc(line)
    .replace(/\[LV(\d)\]/g, '<span class="fx-lv">LV$1</span>')
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
      <div style="font-size:8.5px;color:var(--text-muted);margin-top:3px;">${esc(card.token ? 'Token Spirit' : card.type)} · ${esc(cap(card.symbol))} · ${card.symbols} symbol${card.symbols === 1 ? '' : 's'} · Reduction: ${esc(red)}</div>
      <div class="cd-lv" style="font-size:8.5px;margin-top:3px;">${lv}</div>
      ${noArt ? '' : legalityHTML(card)}
      ${pills ? `<div style="margin-top:4px;">${pills}</div>` : ''}</div>
    <div style="font-size:9.5px;text-align:left;background:rgba(255,255,255,.05);padding:6px;border-radius:4px;border:1px solid var(--border-line);">
      <b>Effect text:</b>${effectTextHTML(card, false)}${card.implemented ? '' : card.partial ? '<div class="warn-note">⚠ Only part of this effect text is implemented in this build yet.' + residualHTML(card) + '</div>' : '<div class="warn-note">⚠ This effect is not implemented in this build yet.</div>'}</div>`;
}
const residualHTML = card => (card.residual && card.residual.length ? '<br>Not implemented yet:<ul style="margin:2px 0 0 14px;padding:0;">' + card.residual.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>' : '');
function cardFacePlaceholder(card, withCost, col, extra) {
  const bp = card.levels[0] && card.levels[0].bp != null ? card.levels[0].bp + ' BP' : card.brave ? 'Brave +' + card.brave.bp + ' BP' : '';
  return `<div class="cface ph" style="--card-col:${col}${extra ? ';' + extra : ''}"><div class="ph-name">${esc(card.name)}</div><div class="ph-sub">${esc(card.token ? 'Token Spirit' : card.type)} · ${esc(cap(card.symbol))}${withCost ? ' · Cost ' + card.cost : ''}</div><div class="ph-txt">${slashBreak(esc(card.desc))}</div><div class="ph-bp">${bp}</div></div>`;
}
function cardFaceHTML(card, withCost) {
  const col = `var(--color-${card.symbol})`;
  const cbm = `<span class="cbm" data-s="${card.symbol}" aria-hidden="true"></span>`;   // v0.143.0: colour-blind shape marker, shown only when the setting is on
  const aid = (typeof ART_ALT !== 'undefined' && ART_ALT[card.id] && CARDS[ART_ALT[card.id]]) ? ART_ALT[card.id] : card.id;   // v0.155.0: the art picked on the card page is used everywhere (an unavailable picture falls back to the card's own)
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
function mullCardHTML(card) {
  return `<div class="mull-card" data-a="zoom" data-v="${esc(card.id)}" title="Tap to enlarge">${cardFaceHTML(card, false)}<div class="nm">${esc(card.name)}</div></div>`;
}
function openZoom(id, uid) {
  const card = CARDS[id], z = $('zoom-overlay'); if (!card || !z) return;
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
async function showCardDetail(id, ctx, uid) {
  const card = CARDS[id]; if (!card) return;
  let buttons = [], inst = null;
  if (ctx === 'deck') {
    const n = PLAYER_DECK[id] || 0;
    const mx = maxCopies(id, FORMAT), bad = legalityOf(id, FORMAT);
    buttons.push({ label: bad ? `🚫 Not legal in ${fmtName(FORMAT)}` : `＋ Add to deck (${n}/${mx})`, cls: 'primary', value: 'add', dis: !!bad || n >= mx });
    buttons.push({ label: '－ Remove from deck', cls: 'blue', value: 'sub', dis: n <= 0 });
  } else if (ctx === 'hand' && G) {
    inst = G.p.player.hand.find(h => h.uid === uid) || null;
    if (inst) buttons = handButtons(G.p.player, inst, false);
  }
  buttons.push({ label: 'Close', cls: 'cancel', value: null });
  /* v0.105.1 fix (regression R15): with inst (a hand card mid-match) this menu carries the played action, so it records again -
     v0.104's uiOnly tagging was for view-only dialogs and wrongly swallowed these action menus (the replay diverged at a hand tap) */
  const v = await modal({ uiOnly: !inst, title: '🎴 Card Detail', html: cardDetailHTML(card), buttons });
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
    else if (f.exhausted) buttons.push({ label: 'Spirit is Exhausted', value: 'x', dis: true });
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

