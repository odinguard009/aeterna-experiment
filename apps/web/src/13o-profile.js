/* ---------------------------------------------------------------------
   PROFILE and GLOSSARY (v0.133.0, U14h): statistics read from the saved match history only, and the Learn page's keyword glossary.
   Display only: nothing here touches the rules.
   --------------------------------------------------------------------- */
function profileStats(h = HISTORY) {
  const n = h.length, won = h.filter(x => x.won).length, byFmt = {};
  for (const x of h) { const k = String(x.fmt || '?'); (byFmt[k] = byFmt[k] || [0, 0])[x.won ? 0 : 1]++; }
  let best = 0, run = 0; for (const x of h) { run = x.won ? run + 1 : 0; best = Math.max(best, run); }
  let streak = 0; for (let i = n - 1; i >= 0 && h[i].won; i--) streak++;
  return { n, won, lost: n - won, rate: n ? Math.round(won * 100 / n) : 0, streak, best, turns: n ? Math.round(h.reduce((a, x) => a + (x.turns || 0), 0) / n) : 0, byFmt };
}
function renderProfile() {
  const el = $('set-profile'); if (!el) return;
  const s = profileStats();
  if (!s.n) { el.innerHTML = '<div class="empty-note">Play a match to fill your profile.</div>'; return; }
  const tile = (k, v) => `<div class="pf-tile"><b>${v}</b><span>${k}</span></div>`;
  el.innerHTML = `<div class="pf-grid">${tile('Matches', s.n)}${tile('Wins', s.won)}${tile('Win rate', s.rate + '%')}${tile('Win streak', s.streak)}${tile('Best streak', s.best)}${tile('Avg. turns', s.turns)}</div>`
    + `<div class="pf-fmt">${Object.entries(s.byFmt).map(([f, [w, l]]) => `<span>${esc(f.toUpperCase())}: ${w} W / ${l} L</span>`).join('')}</div>`;
}
function renderGlossary() {
  const el = $('howto-gloss'); if (!el) return;
  el.innerHTML = Object.keys(KEYWORD_GLOSSARY).sort().map(k => `<div class="gl-item"><b>${esc(k)}</b><p>${esc(KEYWORD_GLOSSARY[k])}</p></div>`).join('');
}
