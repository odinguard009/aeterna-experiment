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
function renderProgress() {
  const el = $('set-progress'); if (!el) return;
  const s = profileStats(), r = rankOf(s.won), ms = dailyMissions();
  el.innerHTML = `<div class="pg-rank"><span class="pg-av" style="--lc:${colorVar(AVATAR)}" aria-hidden="true"></span><div><b>${esc(r.name)}</b><span>${r.next ? r.left + ' more win' + (r.left === 1 ? '' : 's') + ' to ' + esc(r.next) : 'Top rank reached'}</span><i class="pg-bar"><u style="width:${r.pct}%"></u></i></div></div>`
    + `<h3>Avatar</h3><div class="pg-avs">${AVATARS.map((c, k) => `<button class="pg-av${c === AVATAR ? ' on' : ''}" data-a="avatar" data-v="${c}" style="--lc:${colorVar(c)}" aria-label="${esc(cap(c))}" aria-pressed="${c === AVATAR}"${AVATAR_RANK[k] > r.i ? ' disabled title="Unlocks at ' + esc(RANKS[AVATAR_RANK[k]].n) + '"' : ''}></button>`).join('')}</div>`
    + `<h3>Today's missions</h3><ul class="pg-list">${ms.map(m => `<li class="${m.done ? 'done' : ''}"><span>${esc(m.txt)}</span><b>${m.v}/${m.goal}</b></li>`).join('')}</ul>`
    + `<h3>Achievements</h3><ul class="pg-list">${ACHIEVEMENTS.map(({ n, f }) => `<li class="${f(s) ? 'done' : ''}"><span>${esc(n)}</span><b>${f(s) ? 'Done' : '-'}</b></li>`).join('')}</ul>`;
}
