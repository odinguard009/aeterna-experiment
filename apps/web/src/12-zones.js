/* ---------------------------------------------------------------------
   ZONES, LOG, RULES COVERAGE
   --------------------------------------------------------------------- */
function openZoneModal(key, zone) {
  const p = G.p[key], mine = key === 'player' && !p.cpu, label = mine ? 'YOUR' : 'CPU';
  let desc = '', list = [];
  switch (zone) {
    case 'life': desc = `Life: ${p.life}${p.lifeSoul ? ' (one is your Soul Core: Sealed)' : ''}`; break;
    case 'reserve': desc = `Reserve: ${p.reserve.n} core${p.reserve.n === 1 ? '' : 's'}${p.reserve.soul ? ' + Soul Core' : ''}`; break;
    case 'count': desc = `Count Area: ${p.count} cores`; break;
    case 'trashcards':
    case 'trash': desc = `Trash: ${p.trash.length} cards, ${p.trashCores.n}${p.trashCores.soul ? ' + Soul' : ''} cores`; list = p.trash.slice().reverse(); break;
    case 'deck': desc = `Deck: ${p.deck.length} cards`; break;
    case 'hand': desc = `Hand: ${p.hand.length} cards`; if (mine) list = p.hand.slice(); break;
    case 'burst': {
      const b = p.mirage || p.burst, vis = b && (b.mirage || mine);
      desc = !b ? 'The Burst / Mirage Area is empty.' : [p.mirage ? `Mirage set face up: ${CARDS[p.mirage.id].name}` : '', p.burst ? (mine ? `Burst set face down: ${CARDS[p.burst.id].name}` : 'A Burst is set (face down).') : ''].filter(Boolean).join(' · ');
      if (vis) { modal({ uiOnly: true, title: `${label} BURST / MIRAGE AREA`, wide: true, html: esc(desc) + cardStripHTML([p.mirage, mine ? p.burst : null].filter(Boolean)), buttons: [{ label: '🔎 Full Card Details', cls: 'blue', value: 'detail' }, { label: 'Close', cls: 'cancel', value: null }] }).then(v => { if (v === 'detail') showCardDetail(b.id); }); return; }
      break; }
    case 'void': desc = `Void: ${p.void} core${p.void === 1 ? '' : 's'}`; break;
    case 'soulstate': {
      desc = `Cards in Soul State: ${p.soulState.length}`; list = p.soulState.slice();
      const rv = mine && humanCan() ? reviveTargets(p) : [];
      const ca = mine && humanCan() && isMainStep() ? cadvSources(p).filter(x => p.soulState.includes(x) && contractAdventTargets(p, x, 'main').length) : [];
      if (rv.length || ca.length) {
        modal({ uiOnly: true, title: `${label} SOUL STATE`, wide: true, html: esc(desc) + cardStripHTML(list, 'Cards'), buttons: rv.map(t => ({ label: `⚡ Revive: deploy ${CARDS[t.id].name}`, cls: 'primary', value: 'r' + t.uid })).concat(ca.map(t => ({ label: `✨ Contract Advent: ${CARDS[t.id].name}`, cls: 'purple', value: 'c' + t.uid }))).concat([{ label: 'Close', cls: 'cancel', value: null }]) })
          .then(async v => {
            if (typeof v !== 'string' || !humanCan()) return;
            const t = rv.find(x => 'r' + x.uid === v); if (t) { await sendIntent({ type: 'revive', uid: t.uid }); return; }
            const u = ca.find(x => 'c' + x.uid === v); if (u) await sendIntent({ type: 'cadvent', uid: u.uid });
          });
        return;
      }
      break; }
    case 'removed': {
      desc = `Banished cards: ${p.removed.length}`; list = p.removed.slice();
      const rs = mine && humanCan() && isMainStep() ? removedSummonable(p) : [];      // v0.50: Accel Spirits can be summoned from here
      if (rs.length) {
        modal({ uiOnly: true, title: `${label} REMOVED ZONE`, wide: true, html: esc(desc) + cardStripHTML(list, 'Cards'), buttons: rs.map(t => ({ label: `🎴 Summon ${CARDS[t.id].name} (Pay ${effCost(p, CARDS[t.id])})`, cls: 'primary', value: 'z' + t.uid })).concat([{ label: 'Close', cls: 'cancel', value: null }]) })
          .then(async v => { const t = rs.find(x => 'z' + x.uid === v); if (t && humanCan()) await sendIntent({ type: 'summonRemoved', uid: t.uid }); });
        return;
      }
      break; }
  }
  const head = zone === 'trash' || zone === 'trashcards' ? 'Cards (newest first)' : 'Cards';
  modal({ uiOnly: true, title: `${label} ${zone.toUpperCase()}`, wide: list.length > 0, html: esc(desc) + cardStripHTML(list, head), buttons: [{ label: 'Close', cls: 'cancel', value: null }] });
}
function openLogModal() {
  if (!G) return;
  uiInfo('Game Log', `<div class="log-list">${G.history.slice(-60).reverse().map(t => `<div>${esc(t)}</div>`).join('')}</div>`);
}
function showRules() {
  uiInfo('Rules coverage (Eternal Ver.17.1 / Standard Ver.1.1)', `
    <div style="text-align:left"><b>Implemented</b>
    <ul class="rule-list"><li>40+ card decks, max 3 per name, one Contract type; Contract card added to the starting Hand</li>
    <li>Setup: 5 Life, 3 Reserve cores + Soul Core, 4-card hand (3 cards + your Contract card if you add it), coin toss winner picks the turn order, one redraw (the whole hand goes back, Contract card too; draw 4; the Contract card cannot be added again)</li>
    <li>Two formats: <b>Eternal</b> (all cards except the banned list) and <b>Standard</b> (letter block icon only; block A until Mar 2027)</li>
    <li>Banned / limited list effective 2026-09-01 is enforced in the deck builder and before a match</li>
    <li>Turn: START, CORE, DRAW, REFRESH, MAIN, ATTACK, END (Standard adds MAIN 2); the first turn skips the Core, Attack and Second Main Steps (the Draw Step still happens)</li>
    <li>Core Step (cores are unlimited), Banished zone, Refresh returning Trash cores, mandatory cost reduction, paying from Reserve or field cores</li>
    <li>Summon / deploy, level by cores, depletion, free core movement, the Soul Core as a normal core</li>
    <li>Attack, block, BP comparison, Life damage by symbols (Life cores go to the Reserve)</li>
    <li>Burst / Mirage Area in the top-left corner of each field (sleeve + SET for a Burst, face-up card for a Mirage, EMPTY when unused; one set per turn), Advent, Soul State, Count, deck-out at the start step</li>
    <li>Magic cards: [Main] in your Main Step, [Flash] also in the two Flash Timings of a battle (defender first, either player, responses possible); CPU casts Magic too</li></ul>
    <b>Not yet</b>
    <ul class="rule-list"><li>Flash effects on Spirits (only Magic uses Flash so far), Mirage effects (the area and setting a Mirage work), [While Braved] effects, Ultimate Trigger (Ultimates themselves work since v0.46), Grandwalker, Flag Nexus, Rebirth, Seal, Heavy Exhaust</li>
    <li>Standard extras: Succession, Soul Magic, Shinkai-ho (Super Unleash), "while attacking" timing</li>
    <li>Most card effects (cards marked with ⚠ in their details)</li><li>Real card data (import your own; add a "block" field for Standard)</li></ul>
    <b>Sources:</b> asia-en.battlespirits.com and www.battlespirits.com</div>`);
}

