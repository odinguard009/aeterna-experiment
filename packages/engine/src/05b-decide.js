/* ---------------------------------------------------------------------
   DECISIONS (v0.83.0, phase F3 = monorepo step M3 part 1; docs/ai/monorepo-plan.md "Design" 1)
   Every prompt of a human seat goes through the port: decide(seat, record) -> io.decide -> the host answers.
   A decision record is a plain, serializable object (no functions, no instances; cards and Spirits by id / uid):
     choice  {title, html, buttons:[{label, value, cls?, dis?, hidden?}], peek?, wide?, cards?:[id], cardsHead?, cardsStyle?:'mull'}
             -> the value of the pressed button (null = closed)
     pick    {text, uids:[uid], mark?: uid, buttons?:[{label, value, cls?}]} -> a uid from uids or a button value
     payment {card: id, cost, L} -> {reserve, by:{uid: n}, rsoul?, fsoul?: uid} or null (cancelled)
     info    {title, html} -> null
     action  {step, turn} -> an intent record (v0.84.0, packages/engine/src/05c-intent.js): the seat's next board action
   Web host: apps/web/src/13e-host.js (modals, field picks, the payment dialog). Headless host: packages/engine/headless.mjs
   (scripted answers). A match that changed while a decision was open (SESSION moved on) throws ABORT, as the web prompts did.
   Board actions (v0.84.0, M3 rest): the action decision and its intent records, 05c-intent.js; cpuAnswer() there answers
   any record as the CPU would. The CPU seat of the offline game still decides inline in 09-cpu.js.
   --------------------------------------------------------------------- */
const DECISION_KINDS = ['choice', 'pick', 'payment', 'info', 'action'];
const cardIds = L => (L || []).map(x => (typeof x === 'string' ? x : x.id)).filter(id => CARDS[id]);
/* v0.85.0 (F4 = M4 part 1): every answer is kept in the port input record G.prec (15b-replay.js), in the order asked */
async function portAsk(seat, d) {
  const g = G, r = g && g.prec && g.prec.s === SESSION && !g.over ? g.prec : null;
  if (r) r.wait = { s: seat, k: d.kind };
  const P = g && g.p && g.p[seat];
  d.cpu = !!(P && P.cpu);                       // v0.105.0 (M6 step 1): CPU seats answer the port too; the host replies via cpuAnswer() (05c-intent.js)
  const v = await io.decide(seat, d);
  if (r && G === g && r.s === SESSION) { r.wait = null; r.answers.push({ s: seat, k: d.kind, v: v === undefined ? null : JSON.parse(JSON.stringify(v)) }); }
  return v;
}
async function decide(seat, d) { const s = SESSION; const v = await portAsk(seat, d); if (s !== SESSION) throw ABORT; return v; }
/** A choice between buttons (the old web ask()); the human seat unless another seat is named. */
function ask(cfg, seat) { return decide(seat || 'player', Object.assign({ kind: 'choice' }, cfg)); }
/** A message with one Close button; never throws ABORT (as before M3). */
function info(title, html, seat) { return portAsk(seat || 'player', { kind: 'info', title, html }); }
/** Tap a glowing card on the field: {text, uids, mark?, buttons?}. */
function pickFromField(cfg, seat) { return decide(seat || 'player', Object.assign({ kind: 'pick' }, cfg, { uids: Array.from(cfg.uids || []) })); }
/** v0.105.0 (M6 step 2): a CPU decision through the port: the record asks for a uid; the host's cpuAnswer recomputes
 *  the engine's own policy (09a-cpu-eval.js), so sims bit-identical to the inline loop (docs/ai/monorepo-plan.md M6). */
async function portPick(seat, cpuK, uids) {
  const d = { kind: 'pick', cpuK, uids: uids.map(x => x.uid) };
  const v = await decide(seat, d);
  return v == null ? null : (uids.find(x => x.uid === v) || null);
}

async function askBlock(att, D, blockers, must, bound) {
  const sym = CARDS[att.id].symbols;
  const cfg = {
    text: `🛡 <b>${must ? 'You must block!' : 'Block?'}</b> ${esc(CARDS[att.id].name)} attacks with ${bpOf(att)} BP (${sym} symbol${sym === 1 ? '' : 's'}). Your Life: ${D.life}.<br>Tap a glowing Spirit to block with it.`,
    uids: blockers.map(b => b.uid), mark: att.uid, buttons: must ? [] : [{ label: 'Do not block', cls: 'cancel', value: 'none' }]
  };
  if (D.cpu) cfg.cpuK = 'block';                // v0.105.0 (M6 step 1): cpuAnswer() answers this pick with cpuChooseBlock (unchanged policy)
  const v = await pickFromField(cfg, D.key || 'player');
  const found = blockers.find(b => b.uid === v);
  if (found) return found;
  if (D.cpu) return must ? (bound || blockers).slice().sort((x, y) => bpOf(x) - bpOf(y))[0] : null;   // the same fallback the inline CPU had in 08-battle.js
  return must ? blockers[0] : null;
}
/** Which cores pay a cost the Reserve cannot cover: the host lets the player choose (web: the payment dialog). */
function askPayment(card, c, L) { return decide('player', { kind: 'payment', card: card.id, cost: c, L: L || 0 }); }
const uniqById = L => { const seen = new Set(); return L.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true))); };
/* target + payment for a human Magic cast; returns { inst, target, plan } or null when cancelled */
async function prepareHumanMagic(p, inst, ctx) {
  ctx = ctx || 'main';
  const card = CARDS[inst.id], c = effCost(p, card), m = magicFx(card, ctx);
  let target = null;
  const tg = magicTargets(p, inst, ctx);
  if (tg) {
    const uid = await pickFromField({ text: `✨ <b>${esc(card.name)}</b><br>${esc(MAGIC_FX[m.effect].text(m.value, m))}<br>Tap a glowing Spirit.`, uids: tg.map(t => t.uid), buttons: [{ label: 'Cancel', cls: 'cancel', value: 'none' }] });
    target = tg.find(t => t.uid === uid) || null;
    if (!target) return null;
  }
  let plan = null, soulMagic = false;
  if (soulMagicOK(p, card)) {                              // v0.64 Soul Magic: pay the whole cost with the Soul Core, or pay normally
    if (c > coresAvailable(p)) soulMagic = true;
    else {
      const v = await ask({ title: `✨ ${esc(card.name)}: Soul Magic`, html: `Pay the whole cost with just your Soul Core (it goes to the Trash), or pay ${c} core${c === 1 ? '' : 's'} as usual?`,
        buttons: [{ label: '◆ Pay the Soul Core', cls: 'purple', value: 'soul' }, { label: `Pay ${c}`, cls: 'primary', value: 'normal' }, { label: 'Cancel', cls: 'cancel', value: null }] });
      if (!v) return null;
      soulMagic = v === 'soul';
    }
  }
  if (!soulMagic && c > 0 && reserveTotal(p) < c) { plan = await askPayment(card, c, 0); if (!plan) return null; }
  return { inst, target, plan, ctx, soulMagic };
}
async function humanFlashChoice(p, attKey, att, blk) {
  for (let g = 0; g < 6; g++) {
    const usable = magicSources(p, 'flash').filter(h => magicUsable(p, h, 'flash'));
    const acts = []; for (const f of fieldList(p)) for (const x of activatable(p, f, 'FLASH')) acts.push({ f, idx: x.idx, e: x.e });
    const cadv = cadvSources(p).filter(h => contractAdventTargets(p, h, 'flash').length);
    const mani = p.hand.filter(h => CARDS[h.id].manifest && manifestTargets(p, h, 'flash').length);
    const hsp = highSpeedSources(p);                                   // v0.49 High Speed
    const acc = accelSources(p, 'FLASH');                              // v0.50 Accel
    if (!usable.length && !acts.length && !cadv.length && !mani.length && !hsp.length && !acc.length) return null;
    const ctx = `${esc(CARDS[att.id].name)} (${bpOf(att)} BP) is attacking` + (blk ? `, blocked by ${esc(CARDS[blk.id].name)} (${bpOf(blk)} BP)` : '') + '.';
    const v = await ask({ title: '⚡ Flash Timing', peek: true, wide: true, html: `${ctx}<br>Cast a [Flash] Magic card or use a Flash effect?`, cards: cardIds(uniqById(usable.concat(cadv, mani, hsp, acc.map(x => x.inst)))), cardsHead: 'Cards you can use',
      buttons: usable.map(h => ({ label: `${CARDS[h.id].name}${p.trash.includes(h) ? ' [from the Trash]' : ''} (Pay ${effCost(p, CARDS[h.id])}) — ${magicText(CARDS[h.id]).replace(/^(\[[^\]]*\])+ /, '')}`, cls: 'purple', value: h.uid })).concat(cadv.map(h => ({ label: `✨ Contract Advent: ${CARDS[h.id].name}`, cls: 'purple', value: 'c:' + h.uid }))).concat(mani.map(h => ({ label: `✨ Manifest: ${CARDS[h.id].name}`, cls: 'purple', value: 'm:' + h.uid }))).concat(hsp.map(h => ({ label: `⚡ High Speed: summon ${CARDS[h.id].name} (Pay ${effCost(p, CARDS[h.id])} from the Reserve)`, cls: 'primary', value: 'h:' + h.uid }))).concat(acc.map(x => ({ label: accelLabel(p, x), cls: 'primary', value: `x:${x.inst.uid}:${x.idx}` }))).concat(acts.map(x => ({ label: `⚡ ${CARDS[x.f.id].name}: ${fxDescribe(x.e)}`.slice(0, 140), cls: 'primary', value: `a:${x.f.uid}:${x.idx}` }))).concat([{ label: 'Pass', cls: 'cancel', value: null }]) });
    if (v == null) return null;
    if (typeof v === 'string' && v.startsWith('c:')) { const h = cadv.find(x => x.uid === Number(v.slice(2))); if (h) return { cadv: h }; return null; }
    if (typeof v === 'string' && v.startsWith('h:')) { const h = hsp.find(x => x.uid === Number(v.slice(2))); if (h) return { hs: h }; return null; }
    if (typeof v === 'string' && v.startsWith('m:')) { const h = mani.find(x => x.uid === Number(v.slice(2))); if (h) return { manifest: h }; return null; }
    if (typeof v === 'string' && v.startsWith('x:')) { const [, u, ix] = v.split(':'); const a = acc.find(x => x.inst.uid === Number(u) && x.idx === Number(ix)); const r = a ? await humanAccel(a.inst, a.idx, 'FLASH') : null; if (r) return { accel: r }; continue; }
    if (typeof v === 'string' && v.startsWith('a:')) { const [, u, ix] = v.split(':'); const a = acts.find(x => x.f.uid === Number(u) && x.idx === Number(ix)); if (a) return { act: { f: a.f, idx: a.idx } }; return null; }
    const inst = usable.find(h => h.uid === v); if (!inst) return null;
    const ch = await prepareHumanMagic(p, inst, 'flash');
    if (ch) return ch;
  }
  return null;
}
