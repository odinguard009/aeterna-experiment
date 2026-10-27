/* ---------------------------------------------------------------------
   EFFECT ACTIVE PANEL + EMOTICONS (v0.125.0, U14d2; docs/design/mockup-v14.html)
   effectPanel: the engine's 'effect' view record shows the card and what its effect does for about 1.4 s in the shared overlay
   layer #ae-fx (never blocks a tap; Off and sims show nothing). Emoticons: 12 icons, one every 30 s, shown above your side
   for 2 s; display only, never part of the match record.
   --------------------------------------------------------------------- */
const EMOTES = ['😀', '😎', '😮', '😢', '😡', '👍', '👏', '🙏', '🔥', '❄️', '⚔️', '🏳️'];
const EMOTE_GAP = 30000;
let EMOTE_AT = 0, EMOTE_NOW = () => Date.now();
const emoteLeft = () => Math.max(0, Math.ceil((EMOTE_AT + EMOTE_GAP - EMOTE_NOW()) / 1000));
/* v0.151.0: effect pop-ups (owner 2026-10-27, like Aegis): an info card for every effect that runs, never a question. PC: bottom of the left card panel column;
   phone: under the top bar (over the CPU stats row), one at a time. Never over the field. Closes after 5 s or with the X; Settings > Game > Effect pop-ups turns it off. */
const EFF_MS = 5000;
function effectPanel(ev) {
  if (SIM || SETTINGS.effPop === 'off') return;
  const L = $('ae-fx'), c = CARDS[ev.id]; if (!L || !c) return;
  /** @type {HTMLElement} */ let st = $('ae-eff-stack'); if (!st) { st = document.createElement('div'); st.id = 'ae-eff-stack'; st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite'); L.appendChild(st); }
  const text = String(ev.text || '').slice(0, 200), trg = (typeof FX_TRIGGER_TEXT !== 'undefined' && FX_TRIGGER_TEXT[ev.trg]) || '';
  const dup = /** @type {HTMLElement[]} */ ([...st.children]).find(e => e.dataset.k === ev.id + '|' + text);        // the same effect again within 5 s refreshes its timer instead of stacking
  if (dup) { clearTimeout(+dup.dataset.t); dup.dataset.t = String(setTimeout(() => dup.remove(), EFF_MS)); return; }
  const max = isPC() ? 3 : 1; while (st.children.length >= max) st.firstElementChild.remove();
  const d = document.createElement('div'); d.className = 'ae-eff' + (ev.side === 'opponent' ? ' cpu' : ''); d.dataset.k = ev.id + '|' + text;
  d.innerHTML = `<span class="ae-eff-h">${ev.side === 'opponent' ? 'CPU' : 'YOU'} · EFFECT${trg ? ' · ' + esc(trg) : ''}</span><b>${esc(c.name)}</b><span class="ae-eff-t">${esc(text)}</span><button class="ae-eff-x" type="button" aria-label="Close this effect pop-up">✕</button>`;
  d.querySelector('button').addEventListener('click', e => { e.stopPropagation(); clearTimeout(+d.dataset.t); d.remove(); });
  d.dataset.t = String(setTimeout(() => d.remove(), EFF_MS));
  st.appendChild(d);
}
function emotePop() {
  /** @type {HTMLElement} */ let p = $('emote-pop');
  if (p) { p.remove(); return; }
  p = document.createElement('div'); p.id = 'emote-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Emoticons');
  const wait = emoteLeft();
  p.innerHTML = (wait ? `<div class="em-wait">Next emoticon in ${wait} s</div>` : '') + EMOTES.map((e, i) => `<button data-a="emote-pick" data-v="${i}"${wait ? ' disabled' : ''} aria-label="Emoticon ${i + 1}">${e}</button>`).join('');
  $('view-playmat').appendChild(p);
}
function emoteSend(i) {
  if (!EMOTES[i] || emoteLeft() > 0) return false;
  EMOTE_AT = EMOTE_NOW();
  const p = $('emote-pop'); if (p) p.remove();
  const L = $('ae-fx'); if (!L) return true;
  const d = document.createElement('div'); d.className = 'ae-emote'; d.textContent = EMOTES[i];
  L.appendChild(d); setTimeout(() => d.remove(), 2000);
  return true;
}
