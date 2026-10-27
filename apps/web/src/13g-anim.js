/* ---------------------------------------------------------------------
   v0.92.0 U5b LIGHT BATTLE ANIMATIONS (roadmap item U, owner 2026-10-21; docs/DESIGN.md section 0, U5b)
   After every board render the page compares the board with the last one and plays short cues in the shared overlay layer
   #ae-fx (index.template.html, U5): attack beam from the attacker to its blocker or the defender's Life, Life core shatter,
   summon / deploy flash, destroy fade (a ghost where the card was), BP number pop, level-up glow, draw slide (the new hand card).
   Only transform / opacity animate (no layout change, X1 stays locked), 250-650 ms, every cue removes itself; nothing waits for
   them, so the engine and the CPU never slow down. Settings "Animations": Full / Reduced (fades only, no travel) / Off;
   reduced motion turns Full into Reduced; the default is Off under automation (tests) and nothing plays in sims (?sim=1).
   --------------------------------------------------------------------- */
const spdF = () => SPEEDS[SETTINGS.speed] || 1;     // v0.138.0: Slow 1.8 / Normal 1 / Fast .45 / Instant .08 scales every cue below as it scales the engine's pauses
function animMode() {                              // v0.99 U8a: an explicit choice wins; only Auto (no choice) follows the device's reduced motion
  if (SETTINGS.speed === 'instant') return 'off';  // Instant plays no cue: the board just changes
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
  const f = spdF(); ms = (ms || 700) * f;
  L.appendChild(d); setTimeout(() => d.remove(), ms);
  if (f !== 1 && d.getAnimations) d.getAnimations().forEach(a => { a.updatePlaybackRate(1 / f); });   // the CSS cues keep their look, only their pace follows the speed
  return d;
}
function aeBeam(a, b, cpu, still) {               // a, b: rects; v0.124.0 U14d: a thick arrow from centre to centre (after the attacker has turned), scaled in from the attacker
  if (!a || !b) return;
  const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, dx = b.x + b.w / 2 - x1, dy = b.y + b.h / 2 - y1, len = Math.hypot(dx, dy);
  const d = aeFx(`ae-a-beam${cpu ? ' cpu' : ''}${still ? ' still' : ' arrow'}`, { x: x1, y: y1 - 11, w: len, h: 22 }, '', 850);
  if (d) d.style.setProperty('--r', `rotate(${Math.atan2(dy, dx)}rad)`);
}
/* v0.126.0 U14d3: engine records 'core' and 'burst' (06-rules.js, 08-battle.js) arrive just before the board is redrawn, so the old DOM still
   holds both ends: a gem flies from one rect to the other (Full only; Reduced and Off draw nothing), and a flipped Burst turns face up where it was set. */
const CF_SEEN = {};                                // v0.151.0: explicit engine core cues of this board update ("side|from|to" -> count), so the board diff below never repeats them
function flyGem(a, b, side, soul, nth) {            // a, b: rects; one core gem travels from a to b (Full only)
  const L = $('ae-fx'); if (!a || !b || !L) return;
  const d = document.createElement('div'); d.className = 'ae-a-fly' + (soul ? ' soul' : '') + (side === 'opponent' ? ' cpu' : '');
  d.style.cssText = `left:${a.x + a.w / 2 - 10}px;top:${a.y + a.h / 2 - 10}px;width:20px;height:20px`;
  L.appendChild(d);
  const f = spdF(), dx = b.x + b.w / 2 - a.x - a.w / 2, dy = b.y + b.h / 2 - a.y - a.h / 2;
  const run = d.animate([{ transform: 'translate(0,0) scale(1.35)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.9)`, opacity: .95 }], { duration: 480 * f, delay: (nth || 0) * 110 * f, fill: 'backwards', easing: 'cubic-bezier(.3,.1,.2,1)' });
  const land = () => { d.remove(); aeFx('ae-a-land' + (side === 'opponent' ? ' cpu' : ''), { x: b.x, y: b.y, w: b.w, h: b.h }, '', 350); };
  run.onfinish = land; setTimeout(() => d.remove(), 900 * f + (nth || 0) * 110 * f);
}
const coreEnd = (x, side) => ['reserve', 'void', 'trash', 'life', 'count'].includes(x) ? rectOf(visEl(`[data-a="zone"][data-v="${side}:${x}"]`)) : rectOf(document.querySelector(`[data-a="field"][data-v$=":${x}"]`));
function coreFly(ev) {
  if (SIM || animMode() !== 'full') return;
  const k = `${ev.side}|${ev.from}|${ev.to}`; CF_SEEN[k] = (CF_SEEN[k] || 0) + 1;
  flyGem(coreEnd(ev.from, ev.side), coreEnd(ev.to, ev.side), ev.side, ev.kind === 'soul', ev.nth);
}
/* v0.151.0: every other core move (summon payment, destroyed Spirit, Void and Life moves, effects without a cue) is found by comparing the cores in each place
   with the last board: places that lost cores send gems to places that gained them. Net moves only; cues the engine already sent are skipped. */
function coreFlows(prev, now, full) {
  if (!full) return;
  for (const side of ['player', 'opponent']) {
    const src = [], dst = [], P = prev.zn[side], N = now.zn[side];
    for (const z of ['reserve', 'trash', 'void', 'count', 'life']) { const d = N[z] - P[z]; if (d) (d < 0 ? src : dst).push({ id: z, n: Math.abs(d), r: rectOf(visEl(`[data-a="zone"][data-v="${side}:${z}"]`)) }); }
    const uids = new Set(); for (const m of [prev.cards, now.cards]) for (const [u, c] of m) if (c.k === side) uids.add(u);
    for (const u of uids) {
      const a = prev.cards.get(u), b = now.cards.get(u), d = (b ? b.co : 0) - (a ? a.co : 0);
      if (d) (d < 0 ? src : dst).push({ id: u, n: Math.abs(d), r: (b || a).r });
    }
    let nth = 0;
    for (const s of src) for (const t of dst) {
      while (s.n > 0 && t.n > 0 && nth < 8) {
        s.n--; t.n--;
        const key = `${side}|${s.id}|${t.id}`;
        if (CF_SEEN[key] > 0) { CF_SEEN[key]--; continue; }
        flyGem(s.r, t.r, side, false, nth++);
      }
    }
  }
}
/* v0.138.0: Draw Step, a card back slides from the deck to the hand (the opponent's pile to its hand pill) */
function drawFly(ev) {
  if (SIM || animMode() !== 'full') return;
  const a = rectOf(visEl(`[data-a="zone"][data-v="${ev.side}:deck"]`)), b = ev.side === 'player' ? rectOf(visEl('.hand-area')) : rectOf(visEl('.opp-hand-pill')), L = $('ae-fx'); if (!a || !b || !L) return;
  const d = document.createElement('div'); d.className = 'ae-a-flyc' + (ev.side === 'opponent' ? ' cpu' : '');
  d.style.cssText = `left:${a.x + a.w / 2 - 14}px;top:${a.y + a.h / 2 - 19}px`; L.appendChild(d);
  const f = spdF(), run = d.animate([{ transform: 'translate(0,0) scale(1.3)', opacity: 1 }, { transform: `translate(${b.x + b.w / 2 - a.x - a.w / 2}px,${b.y + b.h / 2 - a.y - a.h / 2}px) scale(.8)`, opacity: .6 }], { duration: 460 * f, easing: 'ease-in-out' });
  run.onfinish = () => d.remove(); setTimeout(() => d.remove(), 900 * f);
}
function burstFlip(ev) {
  if (SIM || animMode() !== 'full' || !CARDS[ev.id]) return;
  const mid = innerHeight / 2, all = [...document.querySelectorAll('#view-playmat .ba-card.set-burst')].map(rectOf).filter(r => r && (ev.side === 'opponent') === (r.y + r.h / 2 < mid));
  const r = all[0], L = $('ae-fx'); if (!r || !L) return;
  const d = aeFx('ae-a-flip', { x: r.x - r.w * .3, y: r.y - r.h * .3, w: r.w * 1.6, h: r.h * 1.6 }, cardFaceHTML(CARDS[ev.id], true), 800);
  if (d) d.style.setProperty('--w', Math.round(r.w * 1.6) + 'px');
}
function animCues() {
  if (SIM || !G) { ANIM = null; return; }
  const mode = animMode(), cards = new Map();
  if (mode === 'off') { ANIM = null; return; }
  for (const k of ['player', 'opponent']) for (const f of fieldList(G.p[k])) {
    const c = CARDS[f.id]; if (!c) continue;
    cards.set(f.uid, { k, co: (f.cores || 0) + (f.soul ? 1 : 0), ex: f.heavy ? 180 : f.exhausted ? 90 : 0, bp: isSpiritForm(c) ? bpOf(f) : null, lv: isSpiritForm(c) ? lvNo(f) : null, r: rectOf(document.querySelector(`[data-a="field"][data-v$=":${f.uid}"]`)) });
  }
  const zn = {}; for (const k of ['player', 'opponent']) { const p = G.p[k]; zn[k] = { reserve: p.reserve.n + (p.reserve.soul ? 1 : 0), trash: p.trashCores.n + (p.trashCores.soul ? 1 : 0), void: p.void, count: p.count, life: p.life }; }
  const now = { g: G, cards, zn, hand: new Set(G.p.player.hand.map(h => h.uid)), life: { player: G.p.player.life, opponent: G.p.opponent.life },
    att: G.attacker ? G.attacker.uid : null, blk: G.blocker ? G.blocker.uid : null };
  const prev = ANIM; ANIM = now;
  if (!prev || prev.g !== G || G.over) { for (const k in CF_SEEN) delete CF_SEEN[k]; return; }      // the first board of a match sets the baseline
  const full = mode === 'full';
  coreFlows(prev, now, full); for (const k in CF_SEEN) delete CF_SEEN[k];
  for (const [uid, c] of cards) {
    const o = prev.cards.get(uid);
    if (!o) { aeFx('ae-a-sum' + (c.k === 'opponent' ? ' cpu' : ''), c.r, '', 500); continue; }
    if (full && c.ex !== o.ex) { const e = document.querySelector(`[data-a="field"][data-v$=":${uid}"]`); if (e && e.animate) e.animate([{ transform: `rotate(${o.ex}deg)` }, { transform: `rotate(${c.ex}deg)` }], { duration: 280 * spdF(), easing: 'ease-out' }); }   // one Refresh = one level (180 -> 90 -> 0)
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
