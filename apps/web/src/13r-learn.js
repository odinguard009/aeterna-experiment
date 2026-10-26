/* ---------------------------------------------------------------------
   LEARN (v0.137.0, mockup parity): 16 short chapters with saved progress, a Continue button and a searchable glossary.
   Text only: the mockup's practice boards are not built (reported to the owner). Display only: no rules here.
   --------------------------------------------------------------------- */
const LEARN_KEY = 'aeterna.learn.v1';
/** @type {Array<[string, string]>} */
const LEARN_CHAPS = [
  ['Your goal', 'Reduce the opposing Life from 5 to 0 by attacking with your Spirits. You also win if the opponent has no card to draw at the start of their turn.'],
  ['The board', 'Your Hand, Deck, Field (Spirits and Nexuses), Reserve (free cores), Trash, Life, Burst area and Void. Tap a zone to look inside it.'],
  ['Cores', 'Cores pay for cards and sit on Spirits to give them levels. Free cores wait in your Reserve; cores spent on a cost go to the Trash and return to the Reserve at Refresh.'],
  ['Turn steps', 'Start → Core → Draw → Refresh → Main → Attack → End. In the Main Step you summon Spirits and cast Magic. Press NEXT to move to the following step. In Standard there is also a second Main step.'],
  ['Summoning', 'Pay a Spirit\'s cost with Reserve cores; matching-colour cards on your Field reduce it. Put at least one core on the new Spirit: a Spirit with too few cores is depleted and goes to the Trash.'],
  ['Level up', 'A Spirit\'s level depends on the cores on it. More cores means a higher level and more BP. Move cores between your Spirits in the Main Step.'],
  ['Attacking', 'In the Attack Step choose a ready Spirit to attack. It becomes exhausted. An unblocked attack removes Life equal to its symbols.'],
  ['Blocking', 'The defender may block with one ready Spirit. The higher BP wins; on a tie both are destroyed.'],
  ['Life and Burst', 'Each Life point is a core in your Life. When your Life is hit a Burst card you set face down can flip by itself if its condition is met.'],
  ['Flash Timing', 'Magic and effects with Flash can be used in the two Flash windows of a battle, the defender first. The game asks you when one is possible.'],
  ['Magic', 'Magic cards are cast in the Main Step (or in a Flash window if they have Flash), do their effect and go to the Trash.'],
  ['Nexus', 'A Nexus is a permanent you deploy in the Main Step. It supports your Spirits as long as it stays on the Field.'],
  ['Soul Core', 'The Soul Core is a special core that counts as any colour. Advent, Contract Advent and Manifest use it; some effects send it to the Trash, a Nexus or the Void.'],
  ['Key Spirit', 'In the Deck Builder mark one Spirit as your Key Spirit. While no copy of it is in your Hand or Field, it is a little more likely to be drawn (an Aeterna house rule).'],
  ['Deck rules', 'A deck has 40 cards, at most 3 copies of a card, and a Key Spirit if you like. The Deck Builder checks your deck and shows what is missing.'],
  ['First match', 'Open Play, pick a deck, an opponent and the rules, then press Start. Tap a card to open its actions; long-press a card to read it. Space or Enter = Next step, Esc = close.'],
];
function learnDone() { try { const a = JSON.parse(localStorage.getItem(LEARN_KEY)); return Array.isArray(a) ? a.filter(n => Number.isInteger(n) && n >= 0 && n < 16) : []; } catch (e) { return []; } }
function learnSave(a) { try { localStorage.setItem(LEARN_KEY, JSON.stringify(a)); } catch (e) { /* blocked: this visit only */ } }
function learnNext(d = learnDone()) { const i = LEARN_CHAPS.findIndex((_, k) => !d.includes(k)); return i; }
function renderLearn() {
  const el = $('learn-tiles'); if (!el) return;
  const d = learnDone(), nx = learnNext(d);
  $('learn-bars').innerHTML = LEARN_CHAPS.map((_, i) => `<i style="width:18px;height:6px;background:${d.includes(i) ? 'var(--you)' : 'var(--chip)'}"></i>`).join('') + `<span class="mut" style="font-size:.76em;margin-left:8px">${d.length} / 16 done</span>`;
  const cont = $('learn-cont'); cont.hidden = nx < 0; cont.dataset.v = String(nx); cont.textContent = `▶ Continue · chapter ${nx + 1}`;
  el.innerHTML = LEARN_CHAPS.map((c, i) => `<button class="card tile2" style="min-height:74px" data-a="learn-open" data-v="${i}"><span class="ic" style="${d.includes(i) ? '' : i === nx ? 'background:var(--yes);color:var(--yes-ink)' : 'background:var(--chip);color:var(--text3)'}">${d.includes(i) ? '✓' : i + 1}</span><span><b>${esc(c[0])}</b><span>${d.includes(i) ? 'Done' : i === nx ? 'Next · 2 min' : '2 min'}</span></span></button>`).join('');
  renderGlossary();
}
async function learnOpen(i) {
  const c = LEARN_CHAPS[i]; if (!c) return;
  const done = learnDone().includes(i);
  const r = await modal({ uiOnly: true, title: `Chapter ${i + 1} of 16 · ${c[0]}`, html: `<p>${esc(c[1])}</p>`, buttons: [{ label: 'Later', cls: 'cancel', value: null }, { label: done ? 'Read again' : 'Mark as done', cls: 'primary', value: 'done' }] });
  if (r === 'done' && !done) learnSave(learnDone().concat(i));
  renderLearn();
}
