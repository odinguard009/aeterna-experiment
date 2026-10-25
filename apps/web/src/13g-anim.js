/* ---------------------------------------------------------------------
   v0.92.0 U5b LIGHT BATTLE ANIMATIONS (roadmap item U, owner 2026-10-21; docs/DESIGN.md section 0, U5b)
   After every board render the page compares the board with the last one and plays short cues in the shared overlay layer
   #ae-fx (index.template.html, U5): attack beam from the attacker to its blocker or the defender's Life, Life core shatter,
   summon / deploy flash, destroy fade (a ghost where the card was), BP number pop, level-up glow, draw slide (the new hand card).
   Only transform / opacity animate (no layout change, X1 stays locked), 250-650 ms, every cue removes itself; nothing waits for
   them, so the engine and the CPU never slow down. Settings "Animations": Full / Reduced (fades only, no travel) / Off;
   reduced motion turns Full into Reduced; the default is Off under automation (tests) and nothing plays in sims (?sim=1).
   --------------------------------------------------------------------- */
function animMode() {                              // v0.99 U8a: an explicit choice wins; only Auto (no choice) follows the device's reduced motion
  const m = SETTINGS.anim;
  if (m === 'full' || m === 'reduced' || m === 'off') return m;
  if (navigator.webdriver) return 'off';
  return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
}
let ANIM = null;                                   // last board: { g, cards: Map uid -> {k, bp, lv, r}, hand: Set, life: {player, opponent}, att, blk }
const rectOf = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
const visEl = sel => [...document.querySelectorAll(sel)].find(e => e.getBoundingClientRect().width > 0) || null;
function aeFx(cls, r, html, ms) {
  const L = $('ae-fx'); if (!L || !r) return null;
  const d = document.createElement('div'); d.className = cls;
  d.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
  if (html) d.innerHTML = html;
  L.appendChild(d); setTimeout(() => d.remove(), ms || 700);
  return d;
}
function aeBeam(a, b, cpu, still) {               // a, b: rects; v0.124.0 U14d: a thick arrow from centre to centre (after the attacker has turned), scaled in from the attacker
  if (!a || !b) return;
  const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, dx = b.x + b.w / 2 - x1, dy = b.y + b.h / 2 - y1, len = Math.hypot(dx, dy);
  const d = aeFx(`ae-a-beam${cpu ? ' cpu' : ''}${still ? ' still' : ' arrow'}`, { x: x1, y: y1 - 11, w: len, h: 22 }, '', 850);
  if (d) d.style.setProperty('--r', `rotate(${Math.atan2(dy, dx)}rad)`);
}
function animCues() {
  if (SIM || !G) { ANIM = null; return; }
  const mode = animMode(), cards = new Map();
  if (mode === 'off') { ANIM = null; return; }
  for (const k of ['player', 'opponent']) for (const f of fieldList(G.p[k])) {
    const c = CARDS[f.id]; if (!c) continue;
    cards.set(f.uid, { k, ex: f.heavy ? 180 : f.exhausted ? 90 : 0, bp: isSpiritForm(c) ? bpOf(f) : null, lv: isSpiritForm(c) ? lvNo(f) : null, r: rectOf(document.querySelector(`[data-a="field"][data-v$=":${f.uid}"]`)) });
  }
  const now = { g: G, cards, hand: new Set(G.p.player.hand.map(h => h.uid)), life: { player: G.p.player.life, opponent: G.p.opponent.life },
    att: G.attacker ? G.attacker.uid : null, blk: G.blocker ? G.blocker.uid : null };
  const prev = ANIM; ANIM = now;
  if (!prev || prev.g !== G || G.over) return;      // the first board of a match sets the baseline
  const full = mode === 'full';
  for (const [uid, c] of cards) {
    const o = prev.cards.get(uid);
    if (!o) { aeFx('ae-a-sum' + (c.k === 'opponent' ? ' cpu' : ''), c.r, '', 500); continue; }
    if (full && c.ex !== o.ex) { const e = document.querySelector(`[data-a="field"][data-v$=":${uid}"]`); if (e && e.animate) e.animate([{ transform: `rotate(${o.ex}deg)` }, { transform: `rotate(${c.ex}deg)` }], { duration: 280, easing: 'ease-out' }); }   // one Refresh = one level (180 -> 90 -> 0)
    if (c.lv != null && o.lv != null && c.lv > o.lv) aeFx('ae-a-lv', c.r, '', 600);
    if (c.bp != null && o.bp != null && c.bp !== o.bp) aeFx('ae-a-bp' + (c.bp < o.bp ? ' down' : ''), c.r, `${c.bp > o.bp ? '+' : '−'}${Math.abs(c.bp - o.bp)}`, 650);
  }
  for (const [uid, o] of prev.cards) if (!cards.has(uid)) {
    aeFx('ae-a-die', o.r, '', 550);
    if (!full || !o.r) continue;                    // v0.124.0 U14d: flash, shards and dust where the card stood
    aeFx('ae-a-flash', o.r, '', 350);
    for (let i = 0; i < 6; i++) {
      const d = aeFx('ae-a-card-shard', { x: o.r.x + o.r.w / 2 - 6, y: o.r.y + o.r.h / 2 - 6, w: 12, h: 12 }, '', 700), a = i * Math.PI / 3 + 0.3;
      if (d) { d.style.setProperty('--dx', Math.round(Math.cos(a) * 54) + 'px'); d.style.setProperty('--dy', Math.round(Math.sin(a) * 54 + 10) + 'px'); }
    }
  }
  for (const k of ['player', 'opponent']) {
    if (!(now.life[k] < prev.life[k])) continue;
    const r = rectOf(visEl(`[data-a="zone"][data-v="${k}:life"]`)); if (!r) continue;
    if (!full) { aeFx('ae-a-hit', r, '', 450); continue; }
    for (let i = 0; i < 6; i++) {
      const d = aeFx('ae-a-shard', { x: r.x + r.w / 2 - 5, y: r.y + r.h / 2 - 5, w: 10, h: 10 }, '', 650);
      if (d) { const a = i * Math.PI / 3 + 0.4; d.style.setProperty('--dx', Math.round(Math.cos(a) * 42) + 'px'); d.style.setProperty('--dy', Math.round(Math.sin(a) * 42) + 'px'); }
    }
  }
  if (now.att && (now.att !== prev.att || (now.blk && now.blk !== prev.blk))) {
    const a = cards.get(now.att);
    if (a) {
      const t = now.blk && cards.get(now.blk), def = a.k === 'player' ? 'opponent' : 'player';
      aeBeam(a.r, t ? t.r : rectOf(visEl(`[data-a="zone"][data-v="${def}:life"]`)), a.k === 'opponent', !full);
    }
  }
  if (full) for (const uid of now.hand) if (!prev.hand.has(uid)) { const e = document.querySelector(`.hand-area [data-a="hand"][data-v="${uid}"]`); if (e) e.classList.add('ae-a-draw'); }
}
