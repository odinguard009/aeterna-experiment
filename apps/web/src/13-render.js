/* ---------------------------------------------------------------------
   RENDERING
   --------------------------------------------------------------------- */
/* ---------- layout: PC (two field rows) or Phone (one swipeable row) ---------- */
/* layout is always automatic: PC needs width >= 768px and height >= 620px; wide-but-short screens (landscape phones) use the phone layout */
// Card names wrap at word and CamelCase boundaries ("Crimson / Dragon / Star"), never in the middle of a word.
function nameHTML(n) { return esc(n).replace(/([a-z])(?=[A-Z])/g, '$1<wbr>'); }
const isPC = () => window.innerWidth >= 768 && window.innerHeight >= 480;
function applyLayout() {
  const pc = isPC(), c = document.documentElement.classList;
  const changed = c.contains('layout-pc') !== pc;
  c.toggle('layout-pc', pc); c.toggle('layout-mobile', !pc);
  return changed;
}
let _rz = 0;
window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => { if (applyLayout() && G && $('view-playmat').classList.contains('active')) render(); }, 120); });
applyLayout();

const colorVar = s => `var(--color-${s})`;
/* symbol indicator (bottom-right of every card with symbols, Magic excluded): count + colour; mixed colours as a pie, Ultimate symbol in gold */
const cardColors = c => (c.colors && c.colors.length ? c.colors : [c.symbol]);
const isMulti = c => cardColors(c).length > 1;
const colorSty = c => `--card-color:${colorVar(cardColors(c)[0])}` + (isMulti(c) ? `;--card-color2:${colorVar(cardColors(c)[1])}` : '');
/* pie slices: one per symbol; a symbol with several colours (multicolour card) splits into its colours; Ultimate = gold, God = silver ring */
const symSlices = c => symbolAttrs(c).flatMap(a => { const cols = a.filter(x => COLORS.includes(x)); return cols.length ? cols : a.includes('ultimate') ? ['ultimate'] : ['god']; });
const symCount = c => symbolAttrs(c).length;
/* Ultimate cards: base colour + gold (frame, cost circle, symbol ring). Rebirth cards: a flip mark on the type badge,
   the rebirth side also gets a double frame. Display only until the Ultimate/Rebirth rules exist (issue #4). */
const isUltimate = c => c.type === 'Ultimate';
function cardCls(c) { return (isUltimate(c) ? ' ult' : '') + (isMulti(c) ? ' multi' : '') + (c.rebirthSide ? ' reb-side' : c.rebirthTo ? ' reb' : '') + ' sym-' + c.symbol; }
function rebMark(c) { return c.rebirthSide ? '<span class="reb-mark" title="Rebirth side">↻</span>' : c.rebirthTo ? '<span class="reb-mark" title="Rebirth card: can flip to its rebirth side">↻</span>' : ''; }
function symBadgeHTML(id) {
  const c = CARDS[id]; if (!c || c.type === 'Magic') return '';          // Spirits, Ultimates, Nexuses (Grandwalker too) and Braves carry symbols; Magic never
  const n = symCount(c); if (!n) return '';
  const cols = symSlices(c), k = cols.length, kinds = [...new Set(cols)], god = symbolAttrs(c).some(a => a.includes('god'));
  const bg = kinds.length === 1 ? colorVar(kinds[0]) : `conic-gradient(${cols.map((s, i) => `${colorVar(s)} ${Math.round(i * 360 / k)}deg ${Math.round((i + 1) * 360 / k)}deg`).join(', ')})`;
  return `<div class="sym-badge${god ? ' god' : ''}" style="background:${bg}" title="${n} symbol${n > 1 ? 's' : ''}: ${kinds.join(', ')}${god ? ' (God)' : ''}">${n}</div>`;
}
function handCardHTML(inst) {
  const card = CARDS[inst.id], p = G.p.player;
  const can = humanCan() && isMainStep();
  const ok = can && (card.type === 'Magic' ? magicUsable(p, inst, 'main') : (canPlayCard(p, inst) || (card.burst && !p.burstSetThisTurn) || mirageUsable(p, inst)));
  const bp = card.levels[0] && card.levels[0].bp != null ? card.levels[0].bp : card.brave ? '+' + card.brave.bp : '-';
  return `<div class="tcg-card ${ok ? '' : 'dim'}${cardCls(card)}${imgCls(inst.id)}" style="${colorSty(card)}${imgSty(inst.id)}" data-a="hand" data-v="${inst.uid}">
    <div class="cost">${card.cost}</div><div class="type-badge">${card.contract ? 'CON' : card.token ? 'TOK' : card.type.substring(0, 3).toUpperCase()}${rebMark(card)}</div>
    <div class="name">${nameHTML(card.name)}</div><div class="bp">${bp}</div>${magBtnHTML(inst.id, inst.uid)}${symBadgeHTML(inst.id)}</div>`;
}
/* v0.63.0 (U1): cores are drawn as gems (pentagon crystals), the Soul Core as a silver frame with a coloured gem; the count stays as text for screen readers */
function gemsHTML(n, soul, max) {
  max = max || 8; const k = Math.max(0, Math.min(n, max));
  return '<i class="g-core" aria-hidden="true"></i>'.repeat(k) + (soul ? '<i class="g-soul" aria-hidden="true"></i>' : '') + (n > max ? `<em class="g-more">+${n - max}</em>` : '');
}
function fieldCardHTML(key, kind, f) {
  const card = CARDS[f.id];
  const plain = Math.max(0, f.cores - (f.soul ? 1 : 0));
  const stack = f.under.length ? `<div class="stack-badge">STK:${f.under.length}</div>` : '';
  const bp = isSpiritForm(card) ? bpOf(f) : 'Lv' + lvNo(f);
  const sel = PEEK && PEEK.cfg.selected ? PEEK.cfg.selected(f.uid) : 0;
  const pk = PICK ? (PICK.uids.has(f.uid) ? ' pickable' : PICK.mark === f.uid ? ' pick-att' : '') : (PEEK && PEEK.cfg.tappable && PEEK.cfg.tappable(f.uid) ? ' pickable' : '');
  const selB = sel ? `<span class="sel-badge">−${sel}</span>` : '';
  return `<div class="slot ${f.exhausted && !f.heavy ? 'ex' : ''}"><div class="tcg-card ${f.exhausted ? 'exhausted' : ''}${f.heavy ? ' heavy' : ''} ${f.soul ? 'has-soul-core' : ''}${pk}${cardCls(card)}${imgCls(f.id)}" style="${colorSty(card)}${imgSty(f.id)}" data-a="field" data-v="${key}:${kind}:${f.uid}">
    ${selB}<div class="cost">${card.cost}</div><div class="type-badge">${f.under.length ? 'ADV' : card.contract ? 'CON' : card.token ? 'TOK' : card.type.substring(0, 3).toUpperCase()}${rebMark(card)}</div>
    <div class="name">${nameHTML(card.name)}</div><div class="core-tag${f.soul ? ' soul-active' : ''}${f.cores ? '' : ' none'}" title="${f.cores} core${f.cores === 1 ? '' : 's'}${f.soul ? ' (Soul Core included)' : ''}"><span class="gems">${gemsHTML(plain, f.soul, 6)}</span><span class="sr-only">C:${f.cores}${f.soul ? ' S' : ''}</span></div>${stack}<div class="bp">${bp}</div>${isSpiritForm(card) ? `<span class="lv-dia" aria-hidden="true" title="Level ${lvNo(f)}"><b>${lvNo(f)}</b></span>` : ''}${magBtnHTML(f.id, f.uid)}${symBadgeHTML(f.id)}</div></div>`;
}
function rowHTML(title, scroll, key, items, emptyText, cls, pad) {       // items: [{kind, f}]
  return `<div class="field-row-wrapper ${cls || ''}"><div class="row-header-badge"><span>${title}</span></div>
    <div class="field-row" data-scroll="${scroll}">${items.length ? items.map(o => fieldCardHTML(key, o.kind, o.f)).join('') + (pad || '') : (pad || `<span class="empty-note">${emptyText}</span>`)}</div></div>`;
}
/* Burst / Mirage Area (top-left corner of each field): sleeve = Burst set face down, card face = Mirage set face up */
function burstAreaHTML(p) {
  const b = p.burst, m = p.mirage; let title = 'BURST·MIR', card = '<div class="ba-card"></div>', lab = '<div class="ba-lab empty">EMPTY</div>';
  if (m) { const c = CARDS[m.id]; title = b ? 'MIRAGE+BURST' : 'MIRAGE'; card = `<div class="ba-card set-mirage" style="--card-col:${colorVar(c.symbol)}">${cardFaceHTML(c, false)}</div>`; lab = `<div class="ba-lab set">${b ? 'SET +B' : 'SET'}</div>`; }
  else if (b) { title = 'BURST'; card = '<div class="ba-card set-burst"><span class="sleeve fill" aria-hidden="true"></span><span class="btag">BURST SET</span></div>'; lab = '<div class="ba-lab set">SET</div>'; }
  return `<div class="burst-area" data-a="zone" data-v="${p.key}:burst" title="Burst / Mirage Area"><div class="ba-title">${title}</div>${card}${lab}</div>`;
}
/* Soul State Area (top-right corner of your field, mirrored at the bottom-left of the CPU field): no card limit, the badge shows how many cards are in it */
function soulAreaHTML(p) {
  const n = p.soulState.length, last = n ? p.soulState[n - 1] : null, lc = last && CARDS[last.id];
  /* v0.63.0 (U1): the last card that entered is the cover (its image, or its name), the count sits in the corner */
  const card = n ? `<div class="ba-card has-soul${imgCls(last.id)}" style="${imgSty(last.id).replace(/^;/, '')}">${lc && !imgCls(last.id) ? `<span class="ss-name">${nameHTML(lc.name)}</span>` : ''}<span class="ss-count">${n}</span><span class="ss-sub">CARD${n === 1 ? '' : 'S'}</span></div>` : '<div class="ba-card"></div>';
  const lab = n ? `<div class="ba-lab set">${n} IN</div>` : '<div class="ba-lab empty">EMPTY</div>';
  return `<div class="soul-area" data-a="zone" data-v="${p.key}:soulstate" title="Soul State Area (no card limit)"><div class="ba-title">SOUL STATE</div>${card}${lab}</div>`;
}
const PILL_FULL = {LIFE:'Life',RES:'Reserve',HD:'Hand',DECK:'Deck',TR:'Trash',CNT:'Count',VD:'Void',BAN:'Banished'};   // v0.152.0: the phone stat cells read as full words (CSS shows data-f; the text itself keeps the short label)
function fieldAreaHTML(p, isPlayer) {
  const k = p.key, pill = (label, val, z, pre) => `<div class="stat-pill${z === 'life' || z === 'reserve' ? ' hl' : ''}" data-a="zone" data-v="${k}:${z}"><span class="pl" data-f="${PILL_FULL[label] || label}">${label}:</span> ${pre || ''}<b>${val}</b></div>`;
  const sp = p.spirits.map(f => ({ kind: 'spirit', f })), nx = p.nexus.map(f => ({ kind: 'nexus', f }));
  let rows;
  if (isPC()) {                                  // PC: two rows, Spirits and Nexus
    const nexusRow = rowHTML('NEXUS', k + '-nexus', k, nx, 'No Nexus', 'nexus-row');      // v0.63.0: the side colour of the label says whose row it is
    const spiritRow = rowHTML('SPIRITS', k + '-spirits', k, sp, 'No Spirits');
    rows = isPlayer ? spiritRow + nexusRow : nexusRow + spiritRow;
  } else {                                       // phone: one swipeable row (Spirits, then Nexus)
    const all = sp.concat(nx), ph = all.length ? '' : '<span class="ph-slot" aria-hidden="true">Empty</span>';   // v0.149.0: cards start in the middle (auto margins), one dashed slot only when the field is empty
    rows = rowHTML(isPlayer ? 'YOUR FIELD ↔' : 'CPU FIELD ↔', k + '-field', k, all, '', '', ph);
  }
  /* v0.63.0 (U1): the CPU grid is the point mirror of yours (your Life top-left, the CPU's Life bottom-right) */
  const lifeGems = '<span class="gems sm"><i class="g-core" aria-hidden="true"></i></span>';      // v0.149.0: one core icon, so the pill never changes size as Life drops
  const pills = [pill('LIFE', lifeTxt(p), 'life', lifeGems), pill('RES', p.reserve.n + (p.reserve.soul ? '+S' : ''), 'reserve', p.reserve.soul ? '<i class="g-soul" aria-hidden="true"></i>' : ''), pill('HD', p.hand.length, 'hand'), pill('DECK', p.deck.length, 'deck', '<span class="sleeve mini" aria-hidden="true"></span>'),
    pill('TR', p.trash.length, 'trash'), pill('CNT', p.count, 'count'), pill('VD', p.void, 'void'), pill('BAN', p.removed.length, 'removed')];
  const stats = `<div class="mobile-stats-bar ${isPlayer ? 'side-you' : 'side-cpu'}">${(isPlayer ? pills : pills.slice().reverse()).join('')}</div>`;
  /* phone: the CPU panel sits above its field, yours sits below your field (mirrored, next to your hand) */
  /* the two mats face each other: your Burst Area is at the top-left of your field, the CPU's at the bottom-right of its field; the panels span the full width and stay centered */
  /* PC: the CPU's hand count sits at the top centre of its field (the player's is in the hand flank) */
  const oppHand = !isPlayer && isPC() ? `<div class="opp-hand-pill" data-a="zone" data-v="${k}:hand" title="Cards in the CPU's Hand">HAND <b>${p.hand.length}</b></div>` : '';
  const body = `<div class="fc-body ${isPlayer ? '' : 'mir'}">${burstAreaHTML(p)}<div class="fc-main">${oppHand}${rows}</div>${soulAreaHTML(p)}</div>`;
  return `<div class="field-container-dual ${isPlayer ? 'side-you' : 'side-cpu'}">${isPlayer ? body + stats : stats + body}</div>`;
}
/* v0.63.0 (U1): PC zone plates: a skewed tag in the side colour, the value without prefixes, gems and sleeve stacks */
function zoneBox(key, zone, label, valueHTML) {
  return `<div class="zone-box ${key === 'player' ? 'side-you' : 'side-cpu'}" data-a="zone" data-v="${key}:${zone}"><div class="zone-label"><span>${label}</span></div>${valueHTML}</div>`;
}
const pv = n => `<span class="pv"><b>${n}</b></span>`;
const pileHTML = (n, mark) => `<span class="deckv">${n ? `<span class="sleeve${mark ? ' ' + mark : ''}" aria-hidden="true"></span>` : ''}${pv(n)}</span>`;
const lifePlate = p => `<span class="gems">${gemsHTML(p.life - (p.lifeSoul ? 1 : 0), !!p.lifeSoul, 10)}</span>${pv(lifeTxt(p))}`;
const resPlate = p => `<span class="gems">${gemsHTML(p.reserve.n, !!p.reserve.soul, 10)}</span>${pv(p.reserve.n + (p.reserve.soul ? '+S' : ''))}`;
/* clickable step buttons (v0.63.0, owner 2026-10-18): a legal click is the step NEXT goes to, or End (no attacks: the Attack Step still runs, empty);
   anything else shows an "Illegal move" strip with the reason. Same path as NEXT, no rules change. */
let STEP_WARN = null;
function stepTargets() {                      // [index NEXT goes to, End index] while the human may press NEXT, else null
  if (!G || G.over || G.active !== 'player' || !humanCan()) return null;
  const end = G.steps.length - 1;
  if (G.step === 4) return [G.turnNo === 1 ? end : 5, end];
  if (G.step === 5) return [G.format === 'standard' ? 6 : end, end];
  if (G.step === 6 && G.format === 'standard') return [end, end];
  return null;
}
function stepWarn(text, i) {
  STEP_WARN = { text, i, at: Date.now() };
  const w = dq('.step-warn'); if (w) { elq(w, '.sw-t').textContent = text; w.hidden = false; }
  const b = dq(`.step-chip[data-v="${i}"]`); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  clearTimeout(stepWarn.t); stepWarn.t = setTimeout(() => { STEP_WARN = null; const x = dq('.step-warn'); if (x) x.hidden = true; }, 2200);
}
stepWarn.t = 0;   // the timer id lives on the function; initialized so the checker accepts the property
function stepClick(i) {
  if (!G) return;
  i = Number(i); const name = s => (G.steps[s] || '').toLowerCase().replace(/(^|\s)\w/g, m => m.toUpperCase());
  if (G.over) return stepWarn('The match is over.', i);
  if (G.watch) return stepWarn('Watching: the CPU plays both sides.', i);
  if (G.active !== 'player') return stepWarn('The CPU is playing its turn.', i);
  const t = stepTargets();
  if (i === G.step) return stepWarn(`Already in the ${name(i)} Step.`, i);
  if (i < G.step) return stepWarn(`The ${name(i)} Step has passed.`, i);
  if (!t) return stepWarn('Finish the current action first.', i);
  if (i !== t[0] && i !== t[1]) return stepWarn(`Next legal step: ${name(t[0])}.`, i);
  const turn = G.turnNo, game = G, until = Date.now() + 60000;
  gameAct('next', null);
  if (i === t[0]) return;
  const go = () => {                          // End from Main / Attack: press NEXT again whenever it is the human's turn to press it
    if (G !== game || G.over || G.turnNo !== turn || G.active !== 'player' || Date.now() > until) return;
    const u = stepTargets();
    if (u) { if (G.step < G.steps.length - 1) gameAct('next', null); if (G.step >= G.steps.length - 1 || G.active !== 'player') return; }
    setTimeout(go, 120);
  };
  setTimeout(go, 120);
}
/* v0.94.0 U7 Deck look (DESIGN.md section 0, 18:30 / 17:59): built-in sleeve tints and core / Soul Core colours per deck slot */
const SLEEVE_TINTS = { silver: '#cfcfcf', crimson: '#ff6b7d', azure: '#7fb4ff', jade: '#6fe0b8', gold: '#e9c46a', violet: '#c39bff' };
const CORE_LOOKS = { blue: ['#cfe8ff', '#3a8cf0', '#0b3f8a'], red: ['#ffd0d0', '#e5484d', '#7a0f16'], purple: ['#eadcff', '#9b6bff', '#3d1a7a'], green: ['#d3f7e0', '#2fbf71', '#0d5530'],
  white: ['#ffffff', '#d9dee6', '#7d8696'], yellow: ['#fff6c2', '#ffe14a', '#8a6d00'], gold: ['#ffe9b0', '#c9952a', '#6b4a0c'], silver: ['#ffffff', '#b8c0cc', '#5d6676'], onyx: ['#8a93a3', '#2a303b', '#05070a'] };
function deckLook(i) {
  const l = (SLOTS[i] && SLOTS[i].look) || {};
  return { sleeve: SLEEVE_TINTS[l.sleeve] ? l.sleeve : 'silver', core: CORE_LOOKS[l.core] ? l.core : 'blue', soul: CORE_LOOKS[l.soul] ? l.soul : 'red' };
}
const coreVars = (k, n) => CORE_LOOKS[n].map((c, j) => `--ae-${k}${j + 1}:${c}`).join(';');
/* v0.95.0 U7 part 2: your own sleeve picture per deck slot (IndexedDB key '~sleeve:<slot>'), multiplied with the tint (Silver = as it is) */
const SLEEVE_IMG = {};
const sleeveImgCss = (sel, i, tint) => SLEEVE_IMG[i] ? `${sel}{background:url("${SLEEVE_IMG[i]}") center/cover${tint === 'silver' ? '' : `,${SLEEVE_TINTS[tint]}`};background-blend-mode:multiply}${sel}::before,${sel}::after{display:none}` : '';
function applyLook() {                                // your side of the board (and the hand row) takes the active deck's look; the CPU keeps the default
  const L = deckLook(ACTIVE_SLOT), css = `#view-playmat .side-you{--sl-tint:${SLEEVE_TINTS[L.sleeve]};${coreVars('core', L.core)};${coreVars('soul', L.soul)}}` + sleeveImgCss('#view-playmat .side-you .sleeve,.db-mini .sleeve', ACTIVE_SLOT, L.sleeve)
    + SLOTS.map((s, i) => sleeveImgCss(`.dk-tile[data-v="${i}"]:not(.st) .dk-sl`, i, deckLook(i).sleeve)).join('');
  /** @type {HTMLElement} */
  let s = $('ae-look'); if (!s) { s = document.createElement('style'); s.id = 'ae-look'; document.head.appendChild(s); }
  if (s.textContent !== css) s.textContent = css;
}
/* v0.137.0 Learning hints (play setup switch, mockup "Shows what you can do now"): one line under the log while it is your Main or Attack Step */
function hintText() {
  if (!G || G.over || SETTINGS.hints === false || !humanCan()) return '';
  if (isMainStep()) return 'Main Step: tap a card in your hand to summon or cast it, then press NEXT to attack.';
  return G.step === 5 ? 'Attack Step: tap a ready Spirit to attack, or press NEXT to end your turn.' : '';
}
function renderBoard() {
  const app = $('app'); if (!app || !G) return;
  applyLook();
  const keep = {};
  dqa('[data-scroll]').forEach(e => { keep[e.dataset.scroll] = e.scrollLeft; });
  const P = G.p.player, O = G.p.opponent, stepName = G.steps[G.step];
  const cpuTurn = G.active !== 'player', nextOff = !humanCan() || !(G.step === 4 || G.step === 5 || (G.format === 'standard' && G.step === 6));
  const turnLbl = G.over ? '<span>GAME</span> <span>OVER</span>' : cpuTurn ? `<span>OPPONENT</span> <span>TURN ${G.turnNo}</span>` : `<span>PLAYER</span> <span>TURN ${G.turnNo}</span>`;   // v0.152.0: the band carries the turn number, like the mockup
  app.innerHTML = `
    <header class="ae-head"><div class="ae-turn"><h1 translate="no">Aeterna</h1><span class="ae-ver">v${VERSION}</span>${G.over ? '' : `<span class="ae-turnno">${cpuTurn ? 'OPPONENT' : 'PLAYER'} TURN ${G.turnNo}</span>`}</div><span class="ae-step"><span>${G.over ? 'GAME OVER' : esc(stepName)}</span></span><span class="ae-fill"><span class="ae-sub">${G.format === 'standard' ? 'Standard' : 'Eternal'} · vs ${esc(cap(cpuProfileName(null)))} CPU</span></span>
      <span class="ae-tools"><button class="btn-nav-small ae-btn" data-a="log-toggle" title="Game log (L)"><span class="l">LOG</span><span class="s">Log</span></button><button class="btn-nav-small ae-btn" data-a="emote" title="Emoticon (one every 30 s)" aria-label="Emoticon"><span class="l">EMOTE</span><span class="s" aria-hidden="true">☺</span></button><button class="btn-nav-small ae-btn" data-a="options" title="Settings (the match waits)" aria-label="Options"><span class="l">OPTIONS</span><span class="s">Options</span></button><button class="btn-nav-small ae-btn" data-a="bug-open" aria-label="Report a bug" title="Report A Bug"><span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 7a3 3 0 016 0M7 11h10M12 11v9M5 8l3 2M19 8l-3 2M4 14h3M17 14h3M5 20l3-3M19 20l-3-3"/><rect x="7" y="8" width="10" height="11" rx="5"/></svg></span></button><button class="btn-nav-small ae-btn dng" data-a="leave" aria-label="Concede and leave the match"><span class="l">CONCEDE</span><span class="s">Concede</span></button></span></header>
    <div class="playmat-layout${isPC() ? ' has-cp' : ''}">${isPC() ? cardPanelHTML() : ''}
      <div class="half-field">
        <div class="side-flank-pc">
          ${zoneBox('opponent', 'trash', 'Trash', pileHTML(O.trash.length, 'cpu-sleeve'))}
          ${zoneBox('opponent', 'deck', 'Deck', pileHTML(O.deck.length, 'cpu-sleeve'))}
          ${zoneBox('opponent', 'count', 'Count', pv(O.count))}
        </div>
        ${fieldAreaHTML(O, false)}
        <div class="side-flank-pc">
          ${zoneBox('opponent', 'void', 'Void', pv(O.void))}
          ${zoneBox('opponent', 'reserve', 'Reserve', resPlate(O))}
          ${zoneBox('opponent', 'life', 'Life', lifePlate(O))}
        </div>
      </div>
      <div class="full-center-divider${cpuTurn && !G.over ? ' cpu-turn' : ''}">
        <div class="control-top-row">
          <div class="turn-title">${turnLbl}</div>
          <div class="phase-steps-container" data-scroll="phase"><div class="phase-steps">
            ${G.steps.map((s, i) => `<button class="step-chip${s === stepName ? ' active' : i < G.step ? ' done' : ''}" data-a="step" data-v="${i}"${s === stepName ? ' aria-current="step"' : ''}>${s}</button>`).join('')}</div></div>
          <div class="next-btn-wrapper"><button class="inline-next-btn" data-a="next" aria-label="Next step" ${nextOff ? 'disabled' : ''}><span class="ic">▶</span><span class="tx">NEXT</span></button></div>
        </div>
        <div class="control-log-row" data-a="log" title="Tap to see the game log">${esc(G.last)}</div>
        ${hintText() ? `<div class="step-hint" role="note">${hintText()}</div>` : ''}
        <div class="step-warn" role="status" aria-live="polite"${STEP_WARN && Date.now() - STEP_WARN.at < 2200 ? '' : ' hidden'}><b>ILLEGAL MOVE</b><span class="sw-t">${STEP_WARN ? esc(STEP_WARN.text) : ''}</span></div>
      </div>
      <div class="half-field">
        <div class="side-flank-pc">
          ${zoneBox('player', 'life', 'Life', lifePlate(P))}
          ${zoneBox('player', 'reserve', 'Reserve', resPlate(P))}
          ${zoneBox('player', 'void', 'Void', pv(P.void))}
        </div>
        ${fieldAreaHTML(P, true)}
        <div class="side-flank-pc">
          ${zoneBox('player', 'count', 'Count', pv(P.count))}
          ${zoneBox('player', 'deck', 'Deck', pileHTML(P.deck.length))}
          ${zoneBox('player', 'trash', 'Trash', pileHTML(P.trash.length))}
        </div>
      </div>
      <div class="hand-container-wrapper">
        <div class="pc-hand-flank side-you" data-a="zone" data-v="player:removed"><div class="zone-label"><span>Banished</span></div><span class="sub-text">${pileHTML(P.removed.length)}</span></div>
        <div class="hand-area" data-scroll="hand">${P.hand.map(handCardHTML).join('')}</div>
        <div class="pc-hand-flank side-you" data-a="zone" data-v="player:hand"><div class="zone-label"><span>Hand Cnt</span></div><span class="sub-text">${pv(P.hand.length)}</span></div>
      </div>
    </div>`;
  dqa('[data-scroll]').forEach(e => { if (keep[e.dataset.scroll]) { e.style.scrollBehavior = 'auto'; e.scrollLeft = keep[e.dataset.scroll]; e.style.scrollBehavior = ''; } });   // v0.92.0: at once, not smooth, so the cues measure the real card places
  const ch = dq('.step-chip.active'), cont = dq('.phase-steps-container');
  if (ch && cont) {
    const target = ch.offsetLeft - cont.clientWidth / 2 + ch.offsetWidth / 2, prev = keep.phase || 0;
    cont.style.scrollBehavior = 'auto'; cont.scrollLeft = prev; void cont.offsetWidth;
    cont.style.scrollBehavior = 'smooth'; cont.scrollLeft = target;
  }
  if (SIM) checkInvariants();
}
function render() { renderBoard(); updateLogDrawer(); fxCues(); animCues(); }
/* ---- v0.91.0 U5: one shared overlay layer #ae-fx (index.template.html) above the board, under every dialog, never hit by a tap.
   Ribbons (turn, Main / Attack step, your Flash Timing) and the match-start banner with the motto run about 1.2 s, one at a time;
   the block strip stays while the block pick is open. Sims (?sim=1) draw nothing; reduced motion keeps them static (CSS). U5b adds the animations. */
let CUE = { g: null, turn: 0, step: -1, act: '' };
function fxCueReset() { CUE = { g: null, turn: 0, step: -1, act: '' }; }
function aeRibbon(text, opt) {
  const L = $('ae-fx'); if (!L) return;
  L.querySelectorAll('.ae-rib').forEach(r => r.remove()); clearTimeout(aeRibbon.t);
  if (!text || SIM) return;
  const r = document.createElement('div'); opt = opt || {};
  r.className = 'ae-rib' + (opt.cpu ? ' cpu' : '') + (opt.banner ? ' banner' : '');
  r.innerHTML = (opt.eyebrow ? `<span class="ae-rib-e">${esc(opt.eyebrow)}</span>` : '') + `<b>${esc(text)}</b>`;
  L.appendChild(r);
  const f = SPEEDS[SETTINGS.speed] || 1;
  aeRibbon.t = setTimeout(() => r.remove(), (opt.banner ? 1800 : 1200) * f);
  if (f !== 1 && r.getAnimations) r.getAnimations().forEach(a => { a.updatePlaybackRate(1 / f); });
}
aeRibbon.t = 0;   // the timer id lives on the function; initialized so the checker accepts the property
function aeStrip(text) {
  const L = $('ae-fx'), s = L && elq(L, '.ae-strip'); if (!s) return;
  s.hidden = !text; s.textContent = text || ''; $('pick-bar').classList.toggle('blk', !!text);
  s.style.top = '';                                // v0.99 U8a: sit just above the step band's log line instead of covering it
  const lg = text && visEl('#view-playmat .control-log-row'), r = lg && lg.getBoundingClientRect();
  if (r && r.height) s.style.top = Math.max(0, r.top - s.offsetHeight - 6) + 'px';
}
function fxCues() {
  if (SIM || !G) return;
  const fresh = CUE.g !== G, turn = G.turnNo, step = G.step, act = G.active;
  const prev = CUE; CUE = { g: G, turn, step, act, ban: fresh ? turn === 0 : prev.ban };
  if (G.over) return;
  if (CUE.ban) { if (turn >= 1 && !MODAL) { CUE.ban = false; aeRibbon('GATE OPEN, RELEASE!', { banner: true, eyebrow: 'MATCH START' }); } return; }   // turn 1 starts: coin toss and starting hand are done
  if (fresh) return;
  if (turn !== prev.turn || act !== prev.act) return aeRibbon(`${act === 'player' ? 'PLAYER' : 'OPPONENT'} TURN ${turn}`, { cpu: act !== 'player' });
  if (step !== prev.step && /^(MAIN|ATTACK)/.test(G.steps[step] || '')) aeRibbon(`${G.steps[step]} STEP`, { cpu: act !== 'player' });
}
/* ---- game log drawer ---- */
let LOG_OPEN = false;
function updateLogDrawer() {
  const d = $('log-drawer'), body = $('ld-body'); if (!d || !body) return;
  d.classList.toggle('open', LOG_OPEN && !!G && $('view-playmat').classList.contains('active'));
  if (!LOG_OPEN || !G) return;
  const rows = G.history.slice(-150), atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 30 || !body.dataset.n;
  const sig = rows.length + '|' + (rows[rows.length - 1] || ''); if (body.dataset.sig === sig) return; body.dataset.sig = sig; body.dataset.n = '1';
  body.innerHTML = rows.map(t => `<div${/^(Turn|--- Turn|=== )/.test(t) ? ' class="ld-turn"' : ''}>${esc(t)}</div>`).join('');
  if (atEnd) body.scrollTop = body.scrollHeight;
}
function toggleLog(force) { LOG_OPEN = typeof force === 'boolean' ? force : !LOG_OPEN; const b = $('ld-body'); if (b) delete b.dataset.sig; updateLogDrawer(); }
/* v0.31: the automatic hover / long-press preview is replaced by a magnifier button on every card (issue #6) */
const magBtnHTML = (id, uid) => `<button class="mag-btn" data-a="mag" data-v="${esc(id)}"${uid != null ? ` data-u="${uid}"` : ''} aria-label="Card details" title="Card details">🔍</button>`;
/* live state of a card on the Field (shown in the card detail opened from the magnifier) */
function liveStatusHTML(inst) {
  const c = inst && CARDS[inst.id]; if (!c || !(isSpiritForm(c) || c.type === 'Nexus')) return '';
  return `<div class="live-st">Now: Lv${lvNo(inst)} · ${inst.cores} core${inst.cores === 1 ? '' : 's'}${inst.soul ? ' + Soul' : ''}${isSpiritForm(c) ? ' · ' + bpOf(inst) + ' BP' : ''}${inst.heavy ? ' · heavy exhausted' : inst.exhausted ? ' · exhausted' : ''}</div>`;
}
document.addEventListener('keydown', e => {
  const t = evT(e), tag = t.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$('view-playmat').classList.contains('active') || !G) return;
  const modalOpen = $('action-modal').classList.contains('active');
  if (e.key === 'l' || e.key === 'L') { toggleLog(); return; }
  if (e.key === 'Escape' && LOG_OPEN) { toggleLog(false); return; }
  if ((e.key === ' ' || e.key === 'Enter') && !modalOpen && !PICK && !PEEK) { const b = /** @type {HTMLButtonElement} */ (dq('.inline-next-btn')); if (b && !b.disabled && humanCan()) { e.preventDefault(); b.click(); } }
});
/* ---- match history ---- */
const HIST_KEY = 'bse.history.v1';
let HISTORY = (() => { try { const a = JSON.parse(localStorage.getItem(HIST_KEY)); return Array.isArray(a) ? a.slice(-100) : []; } catch (e) { return []; } })();
function recordMatch(winnerKey) {
  if (!G || !G.meta || G.meta.done) return; G.meta.done = true;
  HISTORY.push({ t: Date.now(), fmt: G.meta.fmt, you: G.meta.you, cpu: G.meta.cpu, won: winnerKey === 'player', turns: G.turnNo, replay: G.rec ? replayOf(G) : undefined, port: portRecord() || undefined });
  if (HISTORY.length > 100) HISTORY.shift();
  for (let i = 0; i < HISTORY.length - 3; i++) { delete HISTORY[i].replay; delete HISTORY[i].port; }   // only the last 3 matches keep their replays (storage size)
  try { localStorage.setItem(HIST_KEY, JSON.stringify(HISTORY)); } catch (e) { /* blocked */ }
}
function histHTML() {
  if (!HISTORY.length) return '<div class="empty-note">No finished matches yet.</div>';
  const w = HISTORY.filter(h => h.won).length, n = HISTORY.length;
  const rows = HISTORY.slice(-10).reverse().map(h => `<tr><td>${new Date(h.t).toLocaleDateString()}</td><td class="${h.won ? 'hist-win' : 'hist-loss'}">${h.won ? 'Win' : 'Loss'}</td><td>${esc(h.you)}</td><td>${esc(h.cpu)}</td><td>${esc(String(h.fmt || '').toUpperCase())}</td><td>${h.turns}</td></tr>`).join('');
  // v0.86.0: Watch / Save the port record of the last matches (13f-replay.js); a list above the table, so phones need no sideways scroll
  const rv = HISTORY.map((h, k) => (h.port ? `<div class="rv-item"><span>${new Date(h.t).toLocaleDateString()} · ${h.won ? 'Win' : 'Loss'} · ${esc(h.you)} vs ${esc(h.cpu)}</span><button class="ae-ghost rv-btn" data-a="rv-watch" data-v="${k}">▶ WATCH</button><button class="ae-ghost rv-btn" data-a="rv-save" data-v="${k}" title="Save the match record (JSON)">SAVE</button></div>` : '')).reverse().join('');
  return `<div>Total: <b>${w}</b> wins, <b>${n - w}</b> losses (${Math.round(100 * w / n)}%) over ${n} match${n === 1 ? '' : 'es'}.</div>${rv ? `<div class="rv-list">${rv}</div>` : ''}
    <table class="hist-table"><tr><th>Date</th><th>Result</th><th>Your deck</th><th>CPU deck</th><th>Format</th><th>Turn</th></tr>${rows}</table>`;
}

const lifeTxt = p => p.lifeSoul ? `${p.life - 1}+S` : String(p.life);   // v0.48: the Soul Core in Life (Sealed) shows as +S, like the Reserve

/* ---------- lobby / deck builder ---------- */
function switchView(id) {
  document.querySelectorAll('.app-view').forEach(e => e.classList.remove('active'));
  $(id).classList.add('active');
  navSync(id);
  if (id === 'view-lobby' || id === 'view-play') renderLobby();
  if (id === 'view-online') renderOnlineLobby();                        // v0.109.0 M8 part 2: the online lobby + account (13j-online-lobby.js)
  if (id === 'view-deckbuilder') { dbSheet(''); renderDeckBuilder(); }
  if (id === 'view-library') renderLibrary();
  if (id === 'view-decks') renderDecks();
  if (id === 'view-settings') renderSettings();
  if (id === 'view-howto') renderLearn();
  if (id === 'view-profile') renderProfilePage();
  if (id === 'view-card') renderCardPage();
}
function renderSettings() { $('set-hist').innerHTML = histHTML(); $('set-cpu').innerHTML = CPU_PROFILE_NAMES.map(n => `<option value="${n}">${cap(n)}</option>`).join(''); $('set-cpu').value = cpuProfileName(null); $('set-speed').value = SETTINGS.speed; $('set-sound').value = SETTINGS.sound ? 'on' : 'off'; $('set-anim').value = SETTINGS.anim || 'auto'; $('set-effpop').value = SETTINGS.effPop === 'off' ? 'off' : 'on'; $('set-lp').value = SETTINGS.longpress === 'off' ? 'off' : 'on'; $('set-cb').value = SETTINGS.cbShapes ? 'on' : 'off'; $('set-hc').value = SETTINGS.hiContrast ? 'on' : 'off'; $('set-ts').value = SETTINGS.textSize || 'normal';
  renderSetPage(); $('set-back').hidden = !G || !!G.over; }   // v0.122.0 U14b: Options from a running match shows BACK TO MATCH; v0.68.0 U4: colour grid, Dark/Light, playmat and CPU colour rows (13d-pages.js)
function renderLobby() {
  renderHome();
  const v = validateDeck(PLAYER_DECK), el = $('lobby-deck');
  el.className = 'lobby-deck' + (v.ok ? '' : ' bad');
  el.textContent = v.ok ? `Your deck: ${v.total} cards · legal in ${fmtName(FORMAT)}` : `Your deck is not legal in ${fmtName(FORMAT)}: ${errSummary(v)}`;
  if ($('play-cpu')) {
    $('play-cpu').innerHTML = [...prebuiltOrder(FORMAT).map(({ d }) => `<option value="${d.id}">${esc(prebuiltLabel(d))}${validateDeck(d.cards, FORMAT).ok ? (d.missing ? ' (random instead)' : '') : ' (not legal in ' + fmtName(FORMAT) + ': random instead)'}</option>`), '<option value="random">Random legal deck</option>', '<option value="mine">Mirror: copy of your deck</option>'].join('');
    $('play-cpu').value = SETTINGS.cpuDeck;
  }
  renderPlay();
}


