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
function effectPanel(ev) {
  if (SIM || animMode() === 'off') return;
  const L = $('ae-fx'), c = CARDS[ev.id]; if (!L || !c) return;
  L.querySelectorAll('.ae-eff').forEach(e => e.remove());
  const d = document.createElement('div'); d.className = 'ae-eff' + (ev.side === 'opponent' ? ' cpu' : '');
  d.innerHTML = `<span class="ae-eff-h">EFFECT ACTIVE</span><b>${esc(c.name)}</b><span>${esc(String(ev.text || '').slice(0, 160))}</span>`;
  L.appendChild(d); setTimeout(() => d.remove(), 1400);
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
