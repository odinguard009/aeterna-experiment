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
function renderGlossary() {
  const el = $('howto-gloss'); if (!el) return;
  const q = (($('gl-q') || {}).value || '').toLowerCase();
  const ks = Object.keys(KEYWORD_GLOSSARY).sort().filter(k => (k + KEYWORD_GLOSSARY[k]).toLowerCase().includes(q));
  el.innerHTML = ks.map(k => `<div class="card flat" style="padding:10px 14px"><b>${esc(k)}</b><br><span class="sub">${esc(KEYWORD_GLOSSARY[k])}</span></div>`).join('') || '<span class="mut">No rule word matches.</span>';   // v0.137.0: mockup glossary cards + search
}
