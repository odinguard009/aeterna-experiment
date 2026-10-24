/* ---------------------------------------------------------------------
   ONLINE CLIENT (v0.108.0, roadmap M8 part 1; docs/ai/monorepo-plan.md M8)
   The "play through the server" mode: the match runs on the authoritative server (apps/server), and this page is a
   thin terminal - it connects over WebSocket, renders the seat-filtered frames the server streams (boardSnapshot in
   packages/engine/src/15b-replay.js), and answers the server's decision records. The offline single-file game is
   untouched (its host is 13e-host.js; this module only runs when the player starts an ONLINE match).

   - Online rooms play Standard (the server's room format); the player's active deck must be Standard-legal.
   - The server is authoritative: every tap here sends an intent and the server's applyIntent accepts or refuses it
     (a refusal re-delivers the action decision; the 'acted ok:false' note marks the move illegal). No rule logic lives here.
   - The frame carries each field card's current BP (bpOf on the server) and heavy flag, plus the seat's hand uids (hu),
     so the board draws correctly and hand taps send intents by uid.
   - Board actions offered: NEXT, step chips, summon / cast / burst / mirage / brave from the hand, attack and core
     add/remove on the field. Accel, Contract Advent, Manifest and effect activations are the M8 follow-ups (the
     server would accept them too; they are only absent from this menu).
   --------------------------------------------------------------------- */
const ONL_DEF = { sock: null, room: null, token: null, seat: null, frame: null, over: false, myTurn: false, decision: null, pick: null, connecting: false };
let ON = Object.assign({}, ONL_DEF);
let ONL_AUTO = false;                       // the test/automation flag survives connectOnline's ON reset

/** The WebSocket base for the server: SETTINGS.onlineUrl when set, else the page's own origin; the ws port is the http
 *  port + 1 (serve.mjs binds ws on PORT+1). Returns null when the page is opened as a file (no server to reach). */
function onlineWsBase() {
  const origin = SETTINGS.onlineUrl ? SETTINGS.onlineUrl : (location.protocol === 'http:' || location.protocol === 'https:' ? location.origin : null);
  if (!origin) return null;
  let u;
  try { u = new URL(origin); } catch (e) { return null; }
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = u.port ? Number(u.port) + 1 : (u.protocol === 'https:' ? 443 : 80) + 1;
  return `${proto}//${u.hostname}:${port}`;
}
function onlineAvailable() { return !!onlineWsBase(); }

/* ---------- board rendering (frame -> HTML; same CSS classes as the offline board) ---------- */
const onlineLifeTxt = p => p.ls ? `${p.life - 1}+S` : String(p.life);
const onlineLifePlate = p => `<span class="gems">${gemsHTML(p.life - (p.ls ? 1 : 0), !!p.ls, 10)}</span>${pv(onlineLifeTxt(p))}`;
const onlineResPlate = p => `<span class="gems">${gemsHTML(p.res, !!p.rs, 10)}</span>${pv(p.res + (p.rs ? '+S' : ''))}`;

function onlineFieldCard(key, kind, f) {
  const card = CARDS[f.id]; if (!card) return '';
  const plain = Math.max(0, f.c - (f.s ? 1 : 0));
  const stack = (f.u && f.u.length) ? `<div class="stack-badge">STK:${f.u.length}</div>` : '';
  const bp = isSpiritForm(card) ? f.bp : 'Lv' + f.lv;
  const pickable = ON.pick && ON.pick.uids.has(f.uid);
  const pickAtt = ON.pick && ON.pick.mark === f.uid;
  return `<div class="slot ${f.x && !f.h ? 'ex' : ''}"><div class="tcg-card ${f.x ? 'exhausted' : ''}${f.h ? ' heavy' : ''} ${f.s ? 'has-soul-core' : ''}${pickable ? ' pickable' : ''}${pickAtt ? ' pick-att' : ''}${cardCls(card)}${imgCls(f.id)}" style="${colorSty(card)}${imgSty(f.id)}" data-a="ofield" data-v="${key}:${kind}:${f.uid}">
    <div class="cost">${card.cost}</div><div class="type-badge">${f.u && f.u.length ? 'ADV' : card.contract ? 'CON' : card.token ? 'TOK' : card.type.substring(0, 3).toUpperCase()}${rebMark(card)}</div>
    <div class="name">${nameHTML(card.name)}</div><div class="core-tag${f.s ? ' soul-active' : ''}${f.c ? '' : ' none'}" title="${f.c} core${f.c === 1 ? '' : 's'}${f.s ? ' (Soul Core included)' : ''}"><span class="gems">${gemsHTML(plain, f.s, 6)}</span><span class="sr-only">C:${f.c}${f.s ? ' S' : ''}</span></div>${stack}<div class="bp">${bp}</div>${isSpiritForm(card) ? `<span class="lv-dia" aria-hidden="true" title="Level ${f.lv}"><b>${f.lv}</b></span>` : ''}${magBtnHTML(f.id, f.uid)}${symBadgeHTML(f.id)}</div></div>`;
}
function onlineHandCard(id, uid, dim) {
  const card = CARDS[id]; if (!card) return '';
  const bp = card.levels[0] && card.levels[0].bp != null ? card.levels[0].bp : card.brave ? '+' + card.brave.bp : '-';
  return `<div class="tcg-card${dim ? ' dim' : ''}${cardCls(card)}${imgCls(id)}" style="${colorSty(card)}${imgSty(id)}" data-a="ohand" data-v="${uid}">
    <div class="cost">${card.cost}</div><div class="type-badge">${card.contract ? 'CON' : card.token ? 'TOK' : card.type.substring(0, 3).toUpperCase()}${rebMark(card)}</div>
    <div class="name">${nameHTML(card.name)}</div><div class="bp">${bp}</div>${magBtnHTML(id, uid)}${symBadgeHTML(id)}</div>`;
}
function onlineRow(title, scroll, key, items, emptyText, cls) {
  return `<div class="field-row-wrapper ${cls || ''}"><div class="row-header-badge"><span>${title}</span></div>
    <div class="field-row" data-scroll="${scroll}">${items.length ? items.map(o => onlineFieldCard(key, o.kind, o.f)).join('') : `<span class="empty-note">${emptyText}</span>`}</div></div>`;
}
function onlineFieldArea(p, isPlayer) {
  const k = isPlayer ? 'player' : 'opponent';
  const sp = p.spirits.map(f => ({ kind: 'spirit', f })), nx = p.nexus.map(f => ({ kind: 'nexus', f }));
  let rows;
  if (isPC()) {
    const nexusRow = onlineRow('NEXUS', k + '-nexus', k, nx, 'No Nexus', 'nexus-row');
    const spiritRow = onlineRow('SPIRITS', k + '-spirits', k, sp, 'No Spirits');
    rows = isPlayer ? spiritRow + nexusRow : nexusRow + spiritRow;
  } else {
    rows = onlineRow(isPlayer ? 'YOUR FIELD ↔' : 'CPU FIELD ↔', k + '-field', k, sp.concat(nx), 'Empty field');
  }
  const pill = (label, val, z, pre) => `<div class="stat-pill${z === 'life' || z === 'reserve' ? ' hl' : ''}" data-a="ozone" data-v="${k}:${z}">${label}: ${pre || ''}<b>${val}</b></div>`;
  const lifeGems = `<span class="gems sm">${gemsHTML(p.life - (p.ls ? 1 : 0), !!p.ls, 10)}</span>`;
  const pills = [pill('LIFE', onlineLifeTxt(p), 'life', lifeGems), pill('RES', p.res + (p.rs ? '+S' : ''), 'reserve', p.rs ? '<i class="g-soul" aria-hidden="true"></i>' : ''), pill('HD', typeof p.hand === 'number' ? p.hand : p.hand.length, 'hand'), pill('DECK', p.deck, 'deck', '<span class="sleeve mini" aria-hidden="true"></span>'),
    pill('TR', p.trash.length, 'trash'), pill('CNT', p.count, 'count'), pill('VD', p.void, 'void'), pill('BAN', p.removed.length, 'removed')];
  const stats = `<div class="mobile-stats-bar ${isPlayer ? 'side-you' : 'side-cpu'}">${(isPlayer ? pills : pills.slice().reverse()).join('')}</div>`;
  const oppHand = !isPlayer && isPC() ? `<div class="opp-hand-pill" data-a="ozone" data-v="${k}:hand" title="Cards in the CPU's Hand">HAND <b>${typeof p.hand === 'number' ? p.hand : p.hand.length}</b></div>` : '';
  const burst = p.burst ? (p.burst === 'set' ? 'SET' : 'SET') : null;
  const baTitle = p.mirage ? (p.burst ? 'MIRAGE+BURST' : 'MIRAGE') : p.burst ? 'BURST' : 'BURST·MIR';
  const baCard = p.mirage ? `<div class="ba-card set-mirage" style="--card-col:${colorVar(CARDS[p.mirage].symbol)}">${cardFaceHTML(CARDS[p.mirage], false)}</div>` : (p.burst ? '<div class="ba-card set-burst"><span class="sleeve fill" aria-hidden="true"></span><span class="btag">BURST SET</span></div>' : '<div class="ba-card"></div>');
  const baLab = p.mirage || p.burst ? '<div class="ba-lab set">SET</div>' : '<div class="ba-lab empty">EMPTY</div>';
  const burstArea = `<div class="burst-area" data-a="ozone" data-v="${k}:burst" title="Burst / Mirage Area"><div class="ba-title">${baTitle}</div>${baCard}${baLab}</div>`;
  const soulN = p.soulState.length, soulLast = soulN ? p.soulState[soulN - 1] : null, soulCard = soulLast && CARDS[soulLast];
  const soulArea = `<div class="soul-area" data-a="ozone" data-v="${k}:soulstate" title="Soul State Area (no card limit)"><div class="ba-title">SOUL STATE</div>${soulN ? `<div class="ba-card has-soul${imgCls(soulLast)}" style="${imgSty(soulLast).replace(/^;/, '')}">${soulCard && !imgCls(soulLast) ? `<span class="ss-name">${nameHTML(soulCard.name)}</span>` : ''}<span class="ss-count">${soulN}</span><span class="ss-sub">CARD${soulN === 1 ? '' : 'S'}</span></div>` : '<div class="ba-card"></div>'}<div class="ba-lab${soulN ? ' set' : ' empty'}">${soulN ? `${soulN} IN` : 'EMPTY'}</div></div>`;
  const body = `<div class="fc-body ${isPlayer ? '' : 'mir'}">${burstArea}<div class="fc-main">${oppHand}${rows}</div>${soulArea}</div>`;
  return `<div class="field-container-dual ${isPlayer ? 'side-you' : 'side-cpu'}">${isPlayer ? body + stats : stats + body}</div>`;
}
function renderOnlineStatus(text) {
  const app = $('app'); if (!app) return;
  app.innerHTML = `<div class="online-status"><div class="os-box">${esc(text)}</div></div>`;
}
function renderOnline() {
  const app = $('app'); if (!app) return;
  if (!ON.frame) { renderOnlineStatus(ON.connecting ? 'Connecting to the server…' : 'Waiting for the match…'); return; }
  const f = ON.frame, P = f.p.player, O = f.p.opponent;
  const cpuTurn = f.a !== 'player';
  const nextOff = !ON.myTurn || f.over;
  const turnLbl = f.over ? '<span>GAME</span> <span>OVER</span>' : cpuTurn ? '<span>OPPONENT</span> <span>TURN</span>' : '<span>PLAYER</span> <span>TURN</span>';
  const stepChips = (f.steps || []).map((s, i) => `<button class="step-chip${s === f.sn ? ' active' : i < f.st ? ' done' : ''}" data-a="ostep" data-v="${i}"${s === f.sn ? ' aria-current="step"' : ''}>${s}</button>`).join('');
  const handMain = ON.myTurn && (f.st === 4 || f.st === 6);
  const handCards = Array.isArray(P.hand) ? P.hand.map((id, i) => onlineHandCard(id, P.hu ? P.hu[i] : null, !handMain)).join('') : '';
  app.innerHTML = `
    <header class="ae-head"><div class="ae-turn"><h1 translate="no">Aeterna</h1><span class="ae-ver">v${VERSION}</span>${f.over ? '' : `<span class="ae-turnno">${cpuTurn ? 'OPPONENT' : 'PLAYER'} TURN ${f.t}</span>`}</div><span class="ae-step"><span>${f.over ? 'GAME OVER' : esc(f.sn)}</span></span><span class="ae-fill"></span>
      <span class="ae-tools"><button class="btn-nav-small ae-btn" data-a="oleave" title="Leave the online match"><span>EXIT TO LOBBY</span></button></span></header>
    <div class="playmat-layout">
      <div class="half-field">
        <div class="side-flank-pc">
          ${zoneBox('opponent', 'trash', 'Trash', pileHTML(O.trash.length, 'cpu-sleeve'))}
          ${zoneBox('opponent', 'deck', 'Deck', pileHTML(O.deck, 'cpu-sleeve'))}
          ${zoneBox('opponent', 'count', 'Count', pv(O.count))}
        </div>
        ${onlineFieldArea(O, false)}
        <div class="side-flank-pc">
          ${zoneBox('opponent', 'void', 'Void', pv(O.void))}
          ${zoneBox('opponent', 'reserve', 'Reserve', onlineResPlate(O))}
          ${zoneBox('opponent', 'life', 'Life', onlineLifePlate(O))}
        </div>
      </div>
      <div class="full-center-divider${cpuTurn && !f.over ? ' cpu-turn' : ''}">
        <div class="control-top-row">
          <div class="turn-title">${turnLbl}</div>
          <div class="phase-steps-container" data-scroll="phase"><div class="phase-steps">${stepChips}</div></div>
          <div class="next-btn-wrapper"><button class="inline-next-btn" data-a="onext" aria-label="Next step" ${nextOff ? 'disabled' : ''}><span class="ic">▶</span><span class="tx">NEXT</span></button></div>
        </div>
        <div class="control-log-row" title="Last game log line">${esc(f.last || '')}</div>
        <div class="step-warn" role="status" aria-live="polite"${STEP_WARN && Date.now() - STEP_WARN.at < 2200 ? '' : ' hidden'}><b>ILLEGAL MOVE</b><span class="sw-t">${STEP_WARN ? esc(STEP_WARN.text) : ''}</span></div>
      </div>
      <div class="half-field">
        <div class="side-flank-pc">
          ${zoneBox('player', 'life', 'Life', onlineLifePlate(P))}
          ${zoneBox('player', 'reserve', 'Reserve', onlineResPlate(P))}
          ${zoneBox('player', 'void', 'Void', pv(P.void))}
        </div>
        ${onlineFieldArea(P, true)}
        <div class="side-flank-pc">
          ${zoneBox('player', 'count', 'Count', pv(P.count))}
          ${zoneBox('player', 'deck', 'Deck', pileHTML(P.deck))}
          ${zoneBox('player', 'trash', 'Trash', pileHTML(P.trash.length))}
        </div>
      </div>
      <div class="hand-container-wrapper">
        <div class="pc-hand-flank side-you" data-a="ozone" data-v="player:removed"><div class="zone-label"><span>Banished</span></div><span class="sub-text">${pileHTML(P.removed.length)}</span></div>
        <div class="hand-area" data-scroll="hand">${handCards}</div>
        <div class="pc-hand-flank side-you" data-a="ozone" data-v="player:hand"><div class="zone-label"><span>Hand Cnt</span></div><span class="sub-text">${pv(P.hand.length)}</span></div>
      </div>
    </div>`;
}

/* ---------- decisions ---------- */
function onlineSend(msg) { if (ON.sock && ON.sock.readyState === 1) ON.sock.send(JSON.stringify(msg)); }
function onlineIntent(it) { ON.myTurn = false; renderOnline(); onlineSend({ t: 'answer', v: it }); }
async function onlineDecide(d) {
  ON.decision = d; ON.myTurn = d.kind === 'action'; renderOnline();
  if (ONL_AUTO) { onlineSend({ t: 'answer', cpu: true }); return; }   // tests: the server's own CPU policy answers every decision
  if (d.kind === 'choice') {
    const v = await modal({ title: d.title, html: choiceHTML(d), buttons: d.buttons, wide: d.wide });
    onlineSend({ t: 'answer', v: v === undefined ? null : v });
  } else if (d.kind === 'info') {
    await modal({ title: d.title, html: d.html, buttons: [{ label: 'Close', cls: 'cancel', value: null }] });
    onlineSend({ t: 'answer', v: null });
  } else if (d.kind === 'pick') await onlinePick(d);
  else if (d.kind === 'payment') await onlinePayment(d);
  // kind 'action': the board is live - NEXT, step chips, hand and field taps answer with intents.
}
function onlinePick(d) {
  clearOnlinePick();
  return new Promise(res => {
    ON.pick = { uids: new Set(d.uids || []), mark: d.mark, buttons: d.buttons || [], res };
    $('pick-text').innerHTML = d.text || '';
    $('pick-btns').innerHTML = (d.buttons || []).map((b, i) => `<button class="modal-btn ${b.cls || ''}" data-a="opk" data-v="${i}">${esc(titleCase(b.label))}</button>`).join('');
    document.documentElement.classList.add('picking'); $('pick-bar').classList.add('active');
    renderOnline();
    aeStrip(/\bblock\b/i.test(d.text || '') && /attacks/.test(d.text || '') ? 'BLOCK?' : null);
  }).then(v => {
    document.documentElement.classList.remove('picking'); $('pick-bar').classList.remove('active'); aeStrip(null);
    ON.pick = null; renderOnline();
    onlineSend({ t: 'answer', v: v === undefined ? null : v });
  });
}
function clearOnlinePick() { const p = ON.pick; if (p) { ON.pick = null; p.res(null); } }
function onlinePickButton(i) {
  const p = ON.pick; if (!p) return;
  const b = p.buttons[i]; if (!b) return;
  ON.pick = null; p.res(b.value);
}
/** The payment plan dialog: Reserve, spare field cores and the Soul Core; the answer is the engine plan {reserve, by, rsoul?, fsoul?}. */
async function onlinePayment(d) {
  const card = CARDS[d.card] || { name: String(d.card) }, c = Number(d.cost), L = Number(d.L || 0);
  const p = ON.frame && ON.frame.p.player; if (!p) { onlineSend({ t: 'answer', v: null }); return; }
  const fields = p.spirits.concat(p.nexus);
  const src = [{ key: 'reserve', label: 'Reserve', max: Math.max(0, p.res) }];
  for (const f of fields) {
    const cd = CARDS[f.id]; if (!cd) continue;
    const min = isSpiritForm(cd) ? ((cd.levels && cd.levels[0] ? cd.levels[0].cores : 0)) : 0;
    const free = Math.max(0, f.c - (f.s ? 1 : 0) - min);
    if (free > 0) src.push({ key: 'f:' + f.uid, label: `${cd.name} (field)`, max: free });
  }
  if (p.rs) src.push({ key: 'rsoul', label: 'Soul Core (Reserve)', max: 1 });
  for (const f of fields) if (f.s && CARDS[f.id]) src.push({ key: 'fsoul:' + f.uid, label: `Soul Core on ${CARDS[f.id].name}`, max: 1 });
  const sel = {}; src.forEach(s => { sel[s.key] = 0; });
  const total = () => src.reduce((a, s) => a + sel[s.key], 0);
  const build = () => {
    const rows = src.map((s, i) => `<div class="pay-row"><span class="l">${esc(s.label)} — ${s.max}</span><button class="pay-btn" data-a="opay" data-v="${i}:d">−</button><b>${sel[s.key]}</b><button class="pay-btn" data-a="opay" data-v="${i}:i">+</button></div>`).join('');
    return { html: `Choose ${c} core${c === 1 ? '' : 's'} to pay (selected ${total()}/${c}).${L ? ` The new card then takes ${L} more core${L === 1 ? '' : 's'} automatically.` : ''}${rows}`, buttons: [{ label: 'Pay', cls: 'primary', value: 'ok', dis: total() !== c }, { label: 'Cancel', cls: 'cancel', value: null }] };
  };
  // the payment state rides MODAL.cfg so the +/- buttons (data-a="opay") can update and repaint it
  const cfg = Object.assign({ title: `Pay for ${card.name}`, src, sel, cost: c, total, build }, build());
  const v = await modal(cfg);
  if (v !== 'ok') { onlineSend({ t: 'answer', v: null }); return; }
  const plan = { reserve: sel.reserve || 0, by: {} };
  src.forEach(s => {
    if (!(sel[s.key] > 0)) return;
    if (s.key === 'rsoul') plan.rsoul = true;
    else if (s.key.startsWith('fsoul:')) plan.fsoul = Number(s.key.slice(6));
    else if (s.key.startsWith('f:')) plan.by[Number(s.key.slice(2))] = sel[s.key];
  });
  onlineSend({ t: 'answer', v: plan });
}
function onlinePayButton(v) {
  const i = v.indexOf(':'), idx = Number(v.slice(0, i)), op = v.slice(i + 1);
  if (!MODAL || !MODAL.cfg || !Array.isArray(MODAL.cfg.src)) return;
  const src = MODAL.cfg.src, sel = MODAL.cfg.sel, c = MODAL.cfg.cost, total = MODAL.cfg.total;
  const s = src[idx]; if (!s) return;
  if (op === 'i' && sel[s.key] < s.max && total() < c) sel[s.key]++;
  if (op === 'd' && sel[s.key] > 0) sel[s.key]--;
  Object.assign(MODAL.cfg, MODAL.cfg.build());
  paintModal();
}

/* ---------- taps (intents; the server validates) ---------- */
function onlineHandMenu(uidStr) {
  if (!ON.frame || !ON.myTurn) return;
  const uid = Number(uidStr), p = ON.frame.p.player;
  const i = p.hu ? p.hu.indexOf(uid) : -1;
  const id = i >= 0 ? p.hand[i] : null;
  const card = id && CARDS[id]; if (!card) return;
  const main = ON.frame.st === 4 || ON.frame.st === 6;
  const buttons = [];
  if (main) {
    if (card.type === 'Magic') buttons.push({ label: `✨ Cast — ${esc(card.name)}`, cls: 'primary', value: 'cast' });
    else {
      if (isSpiritForm(card) || card.type === 'Nexus') buttons.push({ label: card.type === 'Nexus' ? '🎴 Deploy (Nexus)' : '🎴 Summon', cls: 'primary', value: 'summon' });
      if (card.brave) buttons.push({ label: '🗡 Summon combined with a Spirit (Brave)', cls: 'primary', value: 'brave' });
    }
    if (card.burst) buttons.push({ label: '🂠 Set as Burst', cls: 'blue', value: 'burst' });
    if (card.mirage) buttons.push({ label: `🌀 Set as Mirage (Pay ${card.mirage.cost})`, cls: 'purple', value: 'mirage' });
  }
  buttons.push({ label: '🔎 Full Card Details', cls: 'blue', value: 'detail' });
  buttons.push({ label: '✖ Cancel', cls: 'cancel', value: null });
  modal({ title: card.name, wide: true, html: cardStripHTML([id]) + effectTextHTML(card, true), buttons }).then(v => {
    if (v === 'detail') { openZoom(id); return; }
    if (!ON.frame || !ON.myTurn) return;
    const intent = { cast: { type: 'cast', uid }, summon: { type: 'summon', uid }, brave: { type: 'brave', uid }, burst: { type: 'burst', uid }, mirage: { type: 'mirage', uid } }[v];
    if (intent) onlineIntent(intent);
  });
}
function onlineFieldTap(vStr) {
  if (!ON.frame) return;
  const parts = vStr.split(':'), key = parts[0], uid = Number(parts[2]);
  if (ON.pick) { if (ON.pick.uids.has(uid)) { const r = ON.pick.res; ON.pick = null; r(uid); } return; }
  if (ON.myTurn) onlineFieldMenu(key, uid);   // otherwise the magnifier button (data-a="mag") shows the details
}
function onlineFieldMenu(key, uid) {
  const side = ON.frame && ON.frame.p[key]; if (!side) return;
  const f = side.spirits.concat(side.nexus).find(x => x.uid === uid); if (!f) return;
  const card = CARDS[f.id]; if (!card) return;
  const mine = key === 'player', main = ON.frame.st === 4 || ON.frame.st === 6, att = ON.frame.st === 5;
  const brave = f.b ? ` · Brave: ${esc(CARDS[f.b] ? CARDS[f.b].name : f.b)}` : '';
  const html = `${esc(card.token ? 'Token Spirit' : card.type)} · Lv${f.lv}${isSpiritForm(card) ? ' · ' + f.bp + ' BP' : ''} · Cores ${f.c}${f.s ? ' + Soul Core' : ''}${f.x ? ' · Exhausted' : ''}${f.h ? ' · Heavy' : ''}${brave}`;
  const buttons = [{ label: '🔎 Full Card Details', cls: 'blue', value: 'detail' }];
  if (mine && ON.myTurn) {
    if (att && isSpiritForm(card)) buttons.push({ label: '⚔ Attack', cls: 'primary', value: 'attack' });
    if (main) {
      buttons.push({ label: '💎 Add Core (+1 from Reserve)', cls: 'primary', value: 'add' });
      if (f.c > 0) buttons.push({ label: '📤 Remove Core (-1)', cls: 'blue', value: 'remove' });
    }
  }
  buttons.push({ label: '✖ Cancel', cls: 'cancel', value: null });
  modal({ title: card.name, wide: false, html, buttons }).then(v => {
    if (v === 'detail') { openZoom(f.id); return; }
    if (v === 'attack') onlineIntent({ type: 'attack', uid });
    else if (v === 'add') onlineIntent({ type: 'core', op: 'add', uid });
    else if (v === 'remove') onlineIntent({ type: 'core', op: 'remove', uid });
  });
}
function onlineZoneMenu(vStr) {
  if (!ON.frame) return;
  const i = vStr.indexOf(':'), key = vStr.slice(0, i), zone = vStr.slice(i + 1);
  const side = ON.frame.p[key]; if (!side) return;
  const ids = list => list.map(id => CARDS[id] ? CARDS[id].name : id);
  let html = '';
  if (zone === 'trash') html = ids(side.trash).map(n => `<div>${esc(n)}</div>`).join('') || '<div class="empty-note">Empty.</div>';
  else if (zone === 'removed') html = ids(side.removed).map(n => `<div>${esc(n)}</div>`).join('') || '<div class="empty-note">Empty.</div>';
  else if (zone === 'soulstate') html = ids(side.soulState).map(n => `<div>${esc(n)}</div>`).join('') || '<div class="empty-note">Empty.</div>';
  else if (zone === 'hand') html = `<div>${typeof side.hand === 'number' ? side.hand : side.hand.length} card${(typeof side.hand === 'number' ? side.hand : side.hand.length) === 1 ? '' : 's'}</div>`;
  else if (zone === 'deck') html = `<div>${side.deck} card${side.deck === 1 ? '' : 's'} in the deck.</div>`;
  else if (zone === 'burst') html = `<div>${side.burst === 'set' ? 'A Burst is set face down.' : side.mirage ? 'Mirage set.' : 'Empty.'}</div>`;
  else html = `<div>${esc(zone)}: ${side[zone] != null ? esc(String(side[zone])) : ''}</div>`;
  modal({ uiOnly: true, title: `${key === 'player' ? 'Your' : "CPU's"} ${zone}`, html, buttons: [{ label: 'Close', cls: 'cancel', value: null }] });
}

/* ---------- lifecycle ---------- */
function onlineDisconnect() {
  const s = ON.sock; ON.sock = null;
  if (s) try { s.onclose = null; s.close(); } catch (e) { /* already closed */ }
  clearOnlinePick();
  ON = Object.assign({}, ONL_DEF);
}
async function onlineFail(msg) {
  onlineDisconnect();
  switchView('view-lobby'); renderLobby();
  await uiInfo('Online', `The online match ended: ${esc(msg)}`);
}
function onlineOver(summary) {
  const youWon = summary && summary.winner === 'player';
  const turns = summary && summary.turn != null ? ` in ${summary.turn} turn${summary.turn === 1 ? '' : 's'}` : '';
  modal({ uiOnly: true, title: youWon ? '🏆 VICTORY' : '💀 DEFEAT', html: `The match ended${turns}.`, buttons: [
    { label: 'Rematch', cls: 'primary', value: 'again' }, { label: 'Back to Lobby', cls: 'cancel', value: 'lobby' }]
  }).then(v => {
    const again = v === 'again';
    onlineDisconnect();
    switchView('view-lobby'); renderLobby();
    if (again) onlineStart();
  });
}
function onlineMsg(m) {
  switch (m && m.t) {
    case 'welcome': ON.token = m.token; ON.seat = m.seat; break;
    case 'view': ON.frame = m.frame; ON.connecting = false; renderOnline(); break;
    case 'decide': onlineDecide(m.d); break;
    case 'acted': if (!m.ok && !ON.over) { stepWarn('Illegal move', (ON.frame || {}).st || 0); renderOnline(); } break;
    case 'over': ON.over = true; ON.myTurn = false; onlineOver(m.summary); break;
    case 'note': break;                                          // a decision timed out and the bot answered it; nothing to show
    case 'error': onlineFail(m.message || 'server error'); break;
  }
}
function connectOnline(base, roomId) {
  onlineDisconnect();
  ON = Object.assign({}, ONL_DEF, { room: roomId, connecting: true });
  switchView('view-playmat');
  renderOnlineStatus('Connecting to the server…');
  let sock;
  try { sock = new WebSocket(base); } catch (e) { onlineFail('WebSocket is not available: ' + e.message); return; }
  ON.sock = sock;
  sock.onopen = () => sock.send(JSON.stringify({ t: 'join', room: ON.room, seat: 'player', deck: PLAYER_DECK, key: (SLOTS[ACTIVE_SLOT] && SLOTS[ACTIVE_SLOT].key) || null }));
  sock.onmessage = ev => { let m = null; try { m = JSON.parse(String(ev.data)); } catch (e) { return; } onlineMsg(m); };
  sock.onerror = () => { /* the onclose follows */ };
  sock.onclose = () => { if (ON.sock === sock && !ON.over && !ON.connecting) onlineFail('the connection closed'); else if (ON.sock === sock && ON.connecting) onlineFail('the server is unreachable'); };
}
async function onlineStart() {
  const origin = SETTINGS.onlineUrl || ((location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : null);
  if (!origin) {
    await uiInfo('Online', 'Online play needs the page served over http. Run the server (node apps/server/src/serve.mjs) and open http://localhost:8080 — or set an online server URL in Settings.');
    return;
  }
  if (!validateDeck(PLAYER_DECK, 'standard').ok) {
    await uiInfo('Online', 'Your deck is not legal in Standard. Online rooms play Standard — make a legal deck first.');
    return;
  }
  // The server is authoritative for its own WebSocket endpoint (it can bind any port); ask it first, then fall back to origin + 1.
  let base = onlineWsBase();
  try {
    const r = await fetch(origin.replace(/\/+$/, '') + '/api/config', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); if (j && j.wsUrl) base = j.wsUrl; }
  } catch (e) { /* offline or blocked: keep the derived endpoint */ }
  SESSION++; clearPick(); closeModal(null); G = null;
  connectOnline(base, 'local-' + Math.random().toString(36).slice(2, 8));
}
/* expose hooks for the tests and the console. 16-events.js reassigns window.BS after this module loads (this part
   sorts before it), so the hooks attach on a microtask, once the whole script has finished running. */
Promise.resolve().then(() => {
  if (window.BS) Object.assign(window.BS, {
    onlineStart, onlineWsBase, onlineAvailable,
    online: () => ON,
    onlineAuto: on => { ONL_AUTO = !!on; return ONL_AUTO; }
  });
});
/* the Settings "Online -> Server URL" row saves to the shared settings store */
document.addEventListener('change', e => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  if (t && t.id === 'set-online-url') { SETTINGS.onlineUrl = String(t.value || '').trim().replace(/\/+$/, ''); saveSettings(); }
});
