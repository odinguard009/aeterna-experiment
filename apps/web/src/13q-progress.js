/* ---------------------------------------------------------------------
   PROGRESS (v0.134.0, U15): rank, daily missions, achievements and avatars. Everything is derived from the saved match history on this
   device (no server, no rewards that touch the rules); the only stored value is the chosen avatar. Display only.
   --------------------------------------------------------------------- */
const RANKS = [{ n: 'Rookie', w: 0 }, { n: 'Apprentice', w: 3 }, { n: 'Adept', w: 10 }, { n: 'Veteran', w: 25 }, { n: 'Master', w: 50 }, { n: 'Legend', w: 100 }];   // by wins
const AVATARS = ['red', 'blue', 'green', 'yellow', 'purple', 'white', 'ultimate', 'god'], AVATAR_RANK = [0, 0, 0, 1, 2, 3, 4, 5];   // colour -> rank index that unlocks it
const AVATAR_KEY = 'bse.avatar.v1';
let AVATAR = (() => { try { const v = localStorage.getItem(AVATAR_KEY); return AVATARS.includes(v) ? v : 'red'; } catch (e) { return 'red'; } })();
const dayNo = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5);   // local calendar day
const MISSIONS = [
  { id: 'play2', txt: 'Play 2 matches', goal: 2, val: t => t.length },
  { id: 'win1', txt: 'Win a match', goal: 1, val: t => t.filter(x => x.won).length },
  { id: 'win2', txt: 'Win 2 matches', goal: 2, val: t => t.filter(x => x.won).length },
  { id: 'std', txt: 'Play a Standard match', goal: 1, val: t => t.filter(x => x.fmt === 'standard').length },
  { id: 'fast', txt: 'Win a match in 8 turns or fewer', goal: 1, val: t => t.filter(x => x.won && x.turns <= 8).length },
  { id: 'eternal', txt: 'Play an Eternal match', goal: 1, val: t => t.filter(x => x.fmt === 'eternal').length },
];
const ACHIEVEMENTS = [
  { n: 'First win', f: s => s.won >= 1 }, { n: '10 wins', f: s => s.won >= 10 }, { n: '50 wins', f: s => s.won >= 50 }, { n: '25 matches', f: s => s.n >= 25 },
  { n: '3 wins in a row', f: s => s.best >= 3 }, { n: '5 wins in a row', f: s => s.best >= 5 }, { n: 'Played both formats', f: s => !!(s.byFmt.eternal && s.byFmt.standard) },
];
function rankOf(wins) {
  let i = 0; RANKS.forEach((r, k) => { if (wins >= r.w) i = k; });
  const next = RANKS[i + 1];
  return { i, name: RANKS[i].n, next: next ? next.n : '', left: next ? next.w - wins : 0, pct: next ? Math.round((wins - RANKS[i].w) * 100 / (next.w - RANKS[i].w)) : 100 };
}
function dailyMissions(h = HISTORY, d = new Date()) {
  const day = dayNo(d), today = h.filter(x => dayNo(new Date(x.t)) === day);
  return [0, 1, 2].map(k => { const m = MISSIONS[(day + k) % MISSIONS.length], v = Math.min(m.goal, m.val(today)); return { id: m.id, txt: m.txt, goal: m.goal, v, done: v >= m.goal }; });
}
function setAvatar(c) {
  if (!AVATARS.includes(c) || AVATAR_RANK[AVATARS.indexOf(c)] > rankOf(profileStats().won).i) return;
  AVATAR = c; try { localStorage.setItem(AVATAR_KEY, c); } catch (e) { /* blocked: this visit only */ }
}
// v0.155.0 (batch 4, mockup DLG.avatar / DLG.history): the Avatar chooser and the Match history open as dialogs
function avatarDialog() {
  const r = rankOf(profileStats().won), btn = AVATARS.map((c, k) => `<button class="pg-av${c === AVATAR ? ' on' : ''}" data-a="avatar" data-v="${c}" style="--lc:${colorVar(c)}" aria-label="${esc(cap(c))}" aria-pressed="${c === AVATAR}"${AVATAR_RANK[k] > r.i ? ' disabled title="Locked: finish missions and win matches to unlock"' : ''}>${AVATAR_RANK[k] > r.i ? '🔒' : esc(cap(c)[0])}</button>`).join('');
  return modal({ uiOnly: true, title: 'Choose your avatar', html: `<div class="pg-avs">${btn}</div><div class="db-io-hint" style="margin-top:8px">Locked avatars open as your rank rises.</div>`, buttons: [{ label: 'Close', cls: 'cancel', value: null }] });
}
function historyDialog() {
  const rows = HISTORY.slice(-8).map((h, i, a) => ({ h, k: HISTORY.length - a.length + i })).reverse().map(({ h, k }) => `<tr><td><span class="tag ${h.won ? '' : 'cpu'}">${h.won ? 'Win' : 'Loss'}</span></td><td>${esc(h.you || '')}</td><td>${esc(h.cpu || '')}</td><td>${h.turns || ''}</td><td>${h.port ? `<button class="btn sm" data-a="rv-watch" data-v="${k}">Replay</button>` : ''}</td></tr>`).join('');
  return modal({ uiOnly: true, title: 'Match history', html: rows ? `<table class="tb"><tr><th>Result</th><th>Deck</th><th>Opponent</th><th>Turns</th><th></th></tr>${rows}</table>` : '<div class="empty-note">No finished matches yet.</div>', buttons: [{ label: 'All matches', cls: 'primary', value: 'all' }, { label: 'Close', cls: 'cancel', value: null }] }).then(v => { if (v === 'all') navHistory(); });
}
// v0.137.0 (mockup parity): the Profile page (header card with rank, KPIs, win-rate chart, achievements, recent matches, missions)
function renderProfilePage() {
  const el = $('pf-page'); if (!el) return;
  const s = profileStats(), r = rankOf(s.won), ms = dailyMissions();
  const last = HISTORY.slice(-20);
  let w = 0; const pts = last.map((x, i) => { if (x.won) w++; return [last.length > 1 ? Math.round(i * 400 / (last.length - 1)) : 0, Math.round(110 - 100 * w / (i + 1))]; });
  const line = pts.map(p => p.join(',')).join(' ');
  const fav = (() => { const c = {}; HISTORY.forEach(x => { if (x.you) c[x.you] = (c[x.you] || 0) + 1; }); const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k || '-'; })();
  const kpi = [['Matches', s.n], ['Win rate', s.rate + '%'], ['Best streak', s.best], ['Favourite deck', fav]];
  const unlocked = AVATARS.map((c, k) => `<button class="pg-av${c === AVATAR ? ' on' : ''}" data-a="avatar" data-v="${c}" style="--lc:${colorVar(c)}" aria-label="${esc(cap(c))}" aria-pressed="${c === AVATAR}"${AVATAR_RANK[k] > r.i ? ' disabled title="Unlocks at ' + esc(RANKS[AVATAR_RANK[k]].n) + '"' : ''}></button>`).join('');
  const rows = HISTORY.slice(-8).map((h, i, a) => ({ h, k: HISTORY.length - a.length + i })).reverse().map(({ h, k }) => `<tr><td><span class="tag ${h.won ? '' : 'cpu'}">${h.won ? 'Win' : 'Loss'}</span></td><td>${esc(h.you || '')}</td><td>${esc(h.cpu || '')}</td><td>${h.turns || '?'}</td><td>${h.port ? `<button class="btn sm" data-a="rv-watch" data-v="${k}">Replay</button>` : ''}</td></tr>`).join('');
  el.innerHTML = `<div class="card hdcard"><span class="av" style="width:72px;height:72px;font-size:2em">A</span><div class="grow"><span class="eyebrow">Profile · offline</span><h2 class="hd">Player</h2><span class="sub">Rank ${esc(r.name)} · ${r.next ? r.left + ' more win' + (r.left === 1 ? '' : 's') + ' to ' + esc(r.next) : 'top rank reached'}</span><div class="bar" style="margin-top:8px;max-width:340px"><i style="width:${r.pct}%"></i></div><span class="mut" style="font-size:.74em">${s.won} wins</span></div><button class="btn" data-a="pf-avatars">Change avatar</button><button class="btn pri" data-a="online">Sign in · online</button></div>
  <div class="card" id="pf-avs" hidden style="padding:12px 16px"><div class="sec" style="margin:0 0 8px">Avatar</div><div class="pg-avs">${unlocked}</div></div>
  <div class="kpi">${kpi.map(k => `<div class="card"><span class="mut" style="font-size:.7em;letter-spacing:.14em;text-transform:uppercase;font-weight:800">${k[0]}</span><b ${String(k[1]).length > 6 ? 'style="font-size:1.1em;line-height:1.6"' : ''}>${esc(String(k[1]))}</b></div>`).join('')}</div>
  <div class="steps3" style="grid-template-columns:1.4fr 1fr"><div class="card" style="padding:14px 16px"><div class="sec" style="margin:0 0 8px">Win rate · last 20 matches</div>${pts.length > 1 ? `<svg viewBox="0 0 400 120" style="width:100%;height:auto" role="img" aria-label="Win rate chart"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--you)" stop-opacity=".5"/><stop offset="1" stop-color="var(--you)" stop-opacity="0"/></linearGradient></defs><path d="M${pts.map(p => p.join(' ')).join(' L')} L400 120 L0 120Z" fill="url(#wg)"/><polyline points="${line}" fill="none" stroke="var(--you)" stroke-width="2.5" stroke-linejoin="round"/><line x1="0" y1="60" x2="400" y2="60" stroke="var(--line2)" stroke-dasharray="4 4"/></svg>` : '<span class="mut">Play two matches to draw the chart.</span>'}</div>
   <div class="card" style="padding:14px 16px"><div class="sec" style="margin:0 0 8px">Achievements</div><div class="row" style="gap:10px;flex-wrap:wrap">${ACHIEVEMENTS.map(({ n, f }) => { const ok = f(s); return `<div style="width:70px;text-align:center;opacity:${ok ? 1 : .35}"><span class="av" style="width:44px;height:44px;margin:0 auto;${ok ? '' : 'filter:grayscale(1)'}">${ok ? '★' : '🔒'}</span><span style="font-size:.7em">${esc(n)}</span></div>`; }).join('')}</div></div></div>
  <div class="card" style="padding:12px 16px"><div class="sec" style="margin:0 0 6px">Today's missions</div>${ms.map(m => `<div class="mission"><span class="grow">${esc(m.txt)}</span><b>${m.v}/${m.goal}</b></div>`).join('')}</div>
  <div class="card" style="padding:12px 16px"><div class="sec" style="margin:0 0 6px">Recent matches</div>${rows ? `<table class="tb"><tr><th>Result</th><th>Deck</th><th>Opponent</th><th>Turns</th><th></th></tr>${rows}</table>` : '<span class="mut">No finished matches yet.</span>'}</div>`;
}
