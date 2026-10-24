/* ---------------------------------------------------------------------
   EVENTS (delegation)
   --------------------------------------------------------------------- */
document.addEventListener('contextmenu', e => { if (evC(e, '.tcg-card')) e.preventDefault(); });
/* v0.32.5: horizontal rows (Hand, Field rows, steps) scroll with a mouse too: the wheel scrolls sideways, and a mouse drag
   scrolls them; a drag never counts as a click. Touch keeps the native swipe. */
const hScrollable = el => el && el.scrollWidth > el.clientWidth + 1;
document.addEventListener('wheel', e => {
  const el = e.target && e.target instanceof Element ? evC(e, '[data-scroll]') : null;   // v0.32.5: closest only when the target is an element
  if (!hScrollable(el) || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
  const max = el.scrollWidth - el.clientWidth, before = el.scrollLeft, next = Math.max(0, Math.min(max, before + e.deltaY * (e.deltaMode === 1 ? 32 : 1)));
  if (next === before) return;
  e.preventDefault(); el.style.scrollBehavior = 'auto'; el.scrollLeft = next; el.style.scrollBehavior = '';
}, { passive: false });
let HDRAG = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  const el = e.target && e.target instanceof Element ? evC(e, '[data-scroll]') : null;
  HDRAG = hScrollable(el) ? { el, x: e.clientX, left: el.scrollLeft, moved: false } : null;
});
document.addEventListener('pointermove', e => {
  if (!HDRAG || !(e.buttons & 1)) return;
  const dx = e.clientX - HDRAG.x;
  if (!HDRAG.moved && Math.abs(dx) < 6) return;
  HDRAG.moved = true; HDRAG.el.style.scrollBehavior = 'auto'; HDRAG.el.scrollLeft = HDRAG.left - dx;
});
document.addEventListener('pointerup', () => {
  if (HDRAG && HDRAG.moved) {
    HDRAG.el.style.scrollBehavior = '';
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, true), 0);
  }
  HDRAG = null;
});
document.addEventListener('click', e => {
  const mg = e.target instanceof Element ? evC(e, '[data-a="mag"]') : null; if (!mg) return;
  e.stopPropagation(); e.preventDefault(); openZoom(mg.dataset.v, mg.dataset.u != null ? Number(mg.dataset.u) : null);
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const z = $('zoom-overlay'); if (z) z.classList.remove('active'); } });
document.addEventListener('click', e => {
  const peekBtn = evC(e, '[data-peek]');
  if (peekBtn) { startPeek(); return; }
  const pfn = evC(e, '[data-peekfn]');
  if (pfn && PEEK) { if (pfn.dataset.peekfn === 'back') endPeek(); else { const b = PEEK.btns[Number(pfn.dataset.peekfn)]; if (b && !b.dis) b.act(); } return; }
  if (PEEK) {
    const pe = evC(e, '[data-a]');
    if (pe && !['zoom', 'zoomclose', 'zoominfo'].includes(pe.dataset.a)) {
      if (pe.dataset.a === 'field' && PEEK.cfg.onFieldTap) PEEK.cfg.onFieldTap(Number(pe.dataset.v.split(':')[2]));
      return;
    }
  }
  const pkb = evC(e, '[data-pk]');
  if (pkb && PICK) { PICK.res(PICK.buttons[Number(pkb.dataset.pk)].value); return; }
  const mi = evC(e, '[data-mi]');
  if (mi) { modalPress(Number(mi.dataset.mi)); return; }
  const el = evC(e, '[data-a]'); if (!el) return;
  const a = el.dataset.a, v = el.dataset.v;
  if (a === 'start') startNewGame();
  else if (a === 'watch') startNewGame({ watch: true });
  else if (a === 'play-style') playSet('style', v);
  else if (a === 'play-speed') playSet('speed', v);
  else if (a === 'go-deck') switchView('view-deckbuilder');
  else if (a === 'db-unchip') dbUnchip(v);
  else if (a === 'db-tab') dbTab(v);
  else if (a === 'db-look') dbLook(v);
  else if (a === 'db-sl-clear') dbSleeveClear();
  else if (a === 'go-decks') { DK_MENU = -1; if ($('view-deckbuilder')) dbSheet(''); switchView('view-decks'); }   // v0.99 U8a: also from the phone deck sheet
  else if (a.startsWith('dk-')) { if (a !== 'dk-more' && $('dk-msg')) $('dk-msg').textContent = ''; dkAct(a, v); }
  else if (a === 'go-lobby') switchView('view-lobby');
  else if (a === 'go-play') switchView('view-play');
  else if (a === 'go-settings') switchView('view-settings');
  else if (a === 'go-howto') switchView('view-howto');
  else if (a === 'go-history') navHistory();
  else if (a === 'theme-pop') themePop();
  else if (a === 'theme-mode') { navTheme('mode', v); if (G) render(); }
  else if (a === 'theme-color') { navTheme('color', v); if (G) render(); }
  else if (a === 'sound-toggle') navSound();
  else if (a === 'log-toggle') toggleLog();
  else if (a === 'log-close') toggleLog(false);
  else if (a === 'step') stepClick(v);
  else if (a === 'rv-watch') replayWatch(Number(v));
  else if (a === 'rv-save') replaySave(Number(v));
  else if (a === 'hist-clear') { HISTORY = []; try { localStorage.removeItem(HIST_KEY); } catch (e) { /* blocked */ } renderSettings(); }
  else if (a === 'set-reset') { SETTINGS.speed = 'normal'; SETTINGS.sound = false; delete SETTINGS.anim; SETTINGS.cpuDeck = 'std03'; SETTINGS.cpuProfile = 'balanced'; saveSettings(); renderSettings(); $('set-msg').textContent = 'Settings reset.'; }
  else if (a === 'go-lib') switchView('view-library');
  else if (a === 'set-sec') setSection(v);
  else if (a === 'set-mat-clear') matClear();
  else if (a.startsWith('lib-')) libAction(a);
  else if (a === 'format') setFormat(FORMAT === 'eternal' ? 'standard' : 'eternal');
  else if (a === 'rules') showRules();
  else if (a === 'db-reset') { dbSheet(''); dbReplace(defaultDeck()); }
  else if (a === 'db-clear') dbClear();
  else if (a === 'dbcard') dbTap(v);
  else if (a === 'dbinfo') showCardDetail(v, 'deck');
  else if (a === 'db-chip') { const i = v.indexOf(':'); dbToggle(v.slice(0, i), v.slice(i + 1)); }
  else if (a === 'db-row') { const i = v.lastIndexOf(':'); dbChange(v.slice(0, i), Number(v.slice(i + 1))); }
  else if (a === 'db-key') dbKey(v);
  else if (a === 'db-freset') dbResetFilters();
  else if (a === 'db-sheet') dbSheet(v || '');
  else if (a === 'db-undo') dbUndo();
  else if (a === 'db-import') dbImport();
  else if (a === 'db-export') dbExport();
  else if (a === 'zoom') openZoom(v);
  else if (a === 'zoominfo') return;
  else if (a === 'zoomclose') $('zoom-overlay').classList.remove('active');
  else if (a === 'gloss') uiInfo(`GLOSSARY: ${v}`, esc(KEYWORD_GLOSSARY[v] || ''));
  else if (a === 'online') { switchView('view-online'); renderOnlineLobby(); }   // v0.109.0 M8 part 2: the online lobby (13j-online-lobby.js)
  else if (a === 'onl-quick') onlQuick();
  else if (a === 'onl-join') onlJoin();
  else if (a === 'onl-login') onlLogin();
  else if (a === 'onl-logout') onlLogout();
  else if (a === 'onl-discord') onlDiscord();
  else if (a === 'onl-reload') renderOnlineLobby();
  else if (a === 'onext') onlineIntent({ type: 'next' });
  else if (a === 'ostep') onlineIntent({ type: 'next' });
  else if (a === 'ohand') onlineHandMenu(v);
  else if (a === 'ofield') onlineFieldTap(v);
  else if (a === 'ozone') onlineZoneMenu(v);
  else if (a === 'opk') onlinePickButton(Number(v));
  else if (a === 'opay') onlinePayButton(v);
  else if (a === 'oleave') { onlineDisconnect(); switchView('view-lobby'); renderLobby(); }
  else if (!G) return;
  else if (a === 'field' && PICK) { const u = Number(v.split(':')[2]); if (PICK.uids.has(u)) PICK.res(u); }
  else if (a === 'log') openLogModal();
  else if (GAME_ACTS.includes(a)) gameAct(a, v);
});
/* the board actions of the human; the replay calls the same function */
const GAME_ACTS = ['hand', 'field', 'zone', 'next', 'leave'];
function gameAct(a, v) {
  if (!GAME_ACTS.includes(a)) return;
  recIn({ a, v: v == null ? null : v });              // every route (click, keyboard, replay, tests) records the same way
  if (a === 'hand') openHandModal(Number(v));
  else if (a === 'field') { const [k, kind, u] = v.split(':'); openFieldModal(k, kind, Number(u)); }
  else if (a === 'zone') { const [k, z] = v.split(':'); openZoneModal(k, z); }
  else if (a === 'next') onNext();
  else if (a === 'leave') {
    modal({ uiOnly: true, title: 'Leave the match?', html: 'The current match will be lost.', buttons: [{ label: 'Stay', cls: 'primary', value: false }, { label: 'Exit to Lobby', cls: 'cancel', value: true }] })
      .then(r => { if (r) { SESSION++; clearPick(); G = null; switchView('view-lobby'); } });
  }
}

/* ---- v0.26: replay of an input record, and named test scenarios (ideas from the Aegis study) ---- */
function replayOf(g) { const r = g.rec; return { v: r.v, build: r.build, seed: r.seed, format: r.format, sim: !!r.sim, deckA: r.deckA, deckB: r.deckB, inputs: r.inputs.slice(), lossy: !!r.lossy, final: r.final || null, keyA: r.keyA || null, keyB: r.keyB || null }; }
function lastReplay() { if (G && G.rec) return replayOf(G); for (let i = HISTORY.length - 1; i >= 0; i--) if (HISTORY[i].replay) return HISTORY[i].replay; return null; }
/* replays a record: same seed and decks, then every recorded prompt answer / pick / board action in order.
   Resolves {ok, reason, at, total, over, final, same}: "same" compares the final result and the hash of the whole log with the recorded match. */
async function runReplay(rec, opts) {
  opts = opts || {};
  if (!rec || rec.v !== 1 || !Array.isArray(rec.inputs) || !rec.deckA || !rec.deckB || rec.seed == null) return { ok: false, reason: 'not a replay record' };
  if (rec.format && rec.format !== FORMAT) setFormat(rec.format);
  const R = REPLAY = { fast: opts.fast !== false, i: 0 }, inputs = rec.inputs, limit = opts.idleMs || 4000;
  const done = (ok, reason) => {
    if (REPLAY === R) REPLAY = null;
    const final = G && G.rec ? G.rec.final || null : null;
    const same = !!(rec.final && final && rec.final.winner === final.winner && rec.final.turn === final.turn && rec.final.hash === final.hash && rec.final.log === final.log);
    return { ok, reason: reason || '', at: R.i, total: inputs.length, over: !!(G && G.over), final, same };
  };
  startNewGame({ seed: rec.seed, deckA: rec.deckA, deckB: rec.deckB, noHistory: true });
  const t0 = Date.now(); let idle = Date.now();
  const desc = x => (x ? JSON.stringify(x).slice(0, 80) : 'nothing');
  while (Date.now() - t0 < (opts.timeoutMs || 180000)) {
    await new Promise(r => setTimeout(r, 5));
    if (REPLAY !== R) return done(false, 'replay was interrupted');
    if (!G) return done(false, 'the match was closed');
    const x = inputs[R.i];
    if (G.over) return R.i >= inputs.length ? done(true) : done(false, `${inputs.length - R.i} recorded inputs are left after the end of the match`);
    if (!x && (MODAL || PICK) && Date.now() - idle > limit) return done(true, 'the record ends here (the match waits for a prompt)');
    if (MODAL) {
      if (MODAL.cfg.uiOnly) { closeModal(null); continue; }      // v0.105.1 fix: view-only dialogs (zone views, the leave confirm) sit outside the record - the replay closes them itself
      if (x && 'm' in x) { R.i++; idle = Date.now(); closeModal(x.m); }
      else if (Date.now() - idle > limit) return done(false, `diverged at input ${R.i}: a prompt "${MODAL.cfg.title}" is open but the record has ${desc(x)}`);
      continue;
    }
    if (PICK) {
      if (x && x.k === 'pick') { R.i++; idle = Date.now(); PICK.res(x.v); }
      else if (Date.now() - idle > limit) return done(false, `diverged at input ${R.i}: a field pick is open but the record has ${desc(x)}`);
      continue;
    }
    if (!x) { if (humanCan() && Date.now() - idle > limit) return done(true, 'the record ends before the match ends'); continue; }      // CPU-only stretches run until the match ends
    if (x.a && GAME_ACTS.includes(x.a) && (x.a === 'zone' || x.a === 'leave' || humanCan())) { R.i++; idle = Date.now(); gameAct(x.a, x.v); continue; }
    if (Date.now() - idle > limit) return done(false, `diverged at input ${R.i}: the game waits but the record has ${desc(x)}`);
  }
  return done(false, 'time limit');
}
/* a named board for tests: {players:{player:{life,reserve,soul:'reserve'|'trash'|'field',count,void,trashCores,hand,deck,trash,soulState:[id|{id,as}],spirits,nexus:[{id,cores,soul,exhausted,as}],cpu}}, turn, active, step, seed} */
function loadScenario(spec) {
  try {
    if (!spec || typeof spec !== 'object' || !spec.players || typeof spec.players !== 'object') return { error: 'a scenario needs "players"' };
    testSetup(); seedRng(spec.seed || 1);
    const refs = {};
    G.turnNo = Number.isInteger(spec.turn) ? spec.turn : 3; G.active = spec.active === 'opponent' ? 'opponent' : 'player'; G.step = Number.isInteger(spec.step) ? spec.step : 4;
    const int = (v, d) => (v == null ? d : (Number.isInteger(v) && v >= 0 && v <= 99 ? v : (() => { throw new Error('bad number ' + v); })()));
    for (const k of ['player', 'opponent']) {
      const sp = spec.players[k] || {}, p = G.p[k];
      const mk = e => { const o = typeof e === 'string' ? { id: e } : (e || {}); if (!CARDS[o.id]) throw new Error(`unknown card "${o.id}"`); const i = mkInst(o.id); if (o.as) { if (refs[o.as]) throw new Error(`alias "${o.as}" used twice`); refs[o.as] = i; } return [i, o]; };
      p.cpu = sp.cpu !== false;
      for (const z of ['hand', 'deck', 'trash', 'soulState']) { p[z] = (sp[z] || []).map(e => { const [i] = mk(e); if (z === 'soulState') i.inSoulState = true; return i; }); }
      p.spirits = []; p.nexus = []; p.removed = []; p.revealed = []; p.burst = null; p.mirage = null; p.limbo = null;
      if (sp.burst) { const [i] = mk(sp.burst); if (!CARDS[i.id].burst) throw new Error(`${i.id} has no Burst effect`); p.burst = i; }   // v0.55.2: a set Burst card
      let soulOnField = 0;
      for (const z of ['spirits', 'nexus']) for (const e of sp[z] || []) {
        const [i, o] = mk(e); const want = z === 'spirits' ? 'Spirit' : 'Nexus';
        if (CARDS[i.id].type !== want) throw new Error(`${o.id} is not a ${want}`);
        i.cores = int(o.cores, z === 'spirits' ? CARDS[i.id].levels[0].cores : 0); i.exhausted = !!o.exhausted; i.soul = !!o.soul; if (i.soul) soulOnField++;
        p[z].push(i);
      }
      const soul = sp.soul || (soulOnField ? 'field' : 'reserve');
      if (soulOnField > 1 || (soul === 'field') !== (soulOnField === 1)) throw new Error(`${k}: exactly one Soul Core (soul: reserve | trash | one field card with "soul": true)`);
      p.life = int(sp.life, 5); p.reserve = { n: int(sp.reserve, 3), soul: soul === 'reserve' }; p.trashCores = { n: int(sp.trashCores, 0), soul: soul === 'trash' };
      p.count = int(sp.count, 0); p.void = int(sp.void, 0);
      p.made = p.life + p.reserve.n + p.trashCores.n + p.count + p.void + fieldList(p).reduce((t, i) => t + i.cores, 0);
      p.deckSize = p.hand.length + p.deck.length + p.trash.length + p.soulState.length + p.spirits.length + p.nexus.length + (p.burst ? 1 : 0);
      const ids = {}; if (p.burst) ids[p.burst.id] = 1; for (const z of ['hand', 'deck', 'trash', 'soulState', 'spirits', 'nexus']) for (const x of p[z]) ids[x.id] = 1;
      prepareTokens(p, ids); if (sp.tokens) for (const [t, n] of Object.entries(sp.tokens)) { if (!CARDS[t] || !CARDS[t].token) throw new Error(`unknown token "${t}"`); p.tokens[t] = int(n, 0); }
    }
    checkInvariants();
    render(); window.SC = refs;
    return { ok: true, refs: Object.keys(refs) };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
function testSetup() {            // dev hook: a quiet board with no match loop running
  SESSION++; clearPick(); closeModal(null);
  G = newGame(PRESET_DECK, PRESET_DECK); G.busy = false; G.active = 'player'; G.step = 4; G.turnNo = 3; G.p.player.hand = []; G.p.opponent.hand = [];
  switchView('view-playmat'); render(); return G;
}
const defBuiltin = o => { defCard(o); BUILTIN_IDS.add(o.id); };      // test fixtures register through this so their ids stay reserved
window.BS = { BAN_LIST_INFO, webPick, maxCopies, prebuiltLabel, fmtButton, defaultDeck, get CPU_DECK_NAME() { return CPU_DECK_NAME; }, SLEEVE_IMG, renderDecks, animMode, fxCueReset, aeRibbon, endOfBattle, MAT, matUse, setSection, navSync, renderHome, themePop, soulMagicOK, soulMagicHolder, soulMagicPick, THEME, THEME_COLS, setTheme, stepClick, stepTargets, get FX_STRICT() { return FX_STRICT; }, setFxStrict(v) { FX_STRICT = !!v; }, FX_WARNED, collectFx, setFuzz(o) { FUZZ = Object.assign({}, o || {}); }, get FUZZ() { return FUZZ; }, fuzzPick, ERR_LOG, errReport, onGameError, releaseStandby, leaveStandby, renderDeckBuilder, dbChange, dbUndo, dbSheet, DBF, get DB_UNDO() { return DB_UNDO.length; }, accelList, accelCost, accelOK, accelSources, useAccel, removedSummonable, summonFromRemoved, cpuAccelScore, cpuAccelMain, cpuAccelFlash, cpuSilverWheel, highSpeedOK, highSpeedSources, highSpeedSummon, cpuHighSpeed, isSealed, soulToLife, lifeTake, braveSummonedFx, abTaxOK, payAbTax, oppAttackHandFx, sentToTrashFx, magicFxAt, summonOK, lvNo, isUlt, noBlockActive, burstFlash, cpuBurstFlash, humanAttack, cpuAttack, attackStepOver, endAttackLocked, battleEndAttack, isGW, freeCores, moveCore, swapSoul, payCost, cpuCanPlay, coresAvailable, addCore, cpuKeepMagicOrPay, nameHTML, switchView, SET_KEY, dbFilterOK, cardColors, contractToDeck, redrawHand, cpuWantsRedraw, setHeavy, refreshOne, toRemoved, fxIf, costDestroyBonus, sendToken, canSendToken, tokenHome, attackSymbols, TOKEN_SUPPLY, isSpiritForm, ocActive, braveFits, braveTargets, combineBrave, braveSummon, separateBrave, canSeparate, braveRecheck, braveAfford, cpuBrave, handButtons, minCores, openFieldModal, cpuMain, VERSION, defBuiltin, beginTurn, endStep, newGame, takeFromVoid, checkDepletion, removeSpirit, lvIndex, mirageUsable, cpuCastMain, magicFx, magicText, costAltActive, flagActive, coresSent, startAttackFx, win, recordMatch, HISTORY: () => HISTORY, toggleLog, effectTextHTML, effectLines, titleCase, liveStatusHTML, openZoom, modal, closeModal, startPeek, SETTINGS, SLOTS: () => SLOTS, loadSlots, get ACTIVE_SLOT() { return ACTIVE_SLOT; }, switchSlot, loadPrebuilt, PREBUILT, cpuDeckFor, saveSettings, PACK_IDS, registerPack, clearImported, summonPaid, reviveTargets, doRevive, handUp, contractAdventTargets, doContractAdvent, manifestTargets, doManifest, soulCoreHolder, rng, seedRng, newSeed, runReplay, lastReplay, fireFxMulti, asResolving, replayOf, loadScenario, gameAct, matchSummary, get REPLAY() { return REPLAY; }, soulSource, soulToNexus, fxImmune, residualHTML, cardDetailHTML, setSimDeckB(d, key) { SIM_DECK_B = d; SIM_DECK_B_KEY = key || null; }, activatable, activateFx, cpuActivate, toSoulState, bounceCard, runActions, maybeBurst, flushBursts, summonFree, parseBurst, parseActionList, BURST_WHEN, fireFx, parseEffects, staticBp, FX_ACTIONS, removeNexus, magicUsable, magicTargets, castMagic, flashTiming, cpuFlashChoice, setFormat, validateDeck, legalityOf, banStatus, get FORMAT() { return FORMAT; }, isPC, applyLayout, testSetup, mkInst, draw, keyOfDeck, pickKey, render, takeCores, IMG, importCards, importImages, textToDeck, deckToText, parseCard, loadImages, get PLAYER_DECK() { return PLAYER_DECK; }, get G() { return G; }, startNewGame, checkInvariants, CARDS, PRESET_DECK, humanCan, onNext, engineIdle, runPortRecord, viewerReplayOf, openViewer, replayFromRecord, portRecord, boardSnapshot, sendIntent, applyIntent, seatLoopOpen, cpuAnswer, INTENT_TYPES, cpuTurn, doBattle, summon, effCost, legacyPlan, legacyPay, canBlockState, canPlayCard, setBurst, fieldList, bpOf, get SESSION() { return SESSION; }, CPU_PROFILES, cpuProfileName, cpuEval, cpuPlayScore, cpuPlayChoice, cpuLethal, cpuAttackScore, cpuAttackChoice, cpuBlockScore, cpuChooseBlock, setCpuProfile, setSimProfiles(o) { CPU_SIM_PROFILES = Object.assign({}, o || {}); }, lifeValue, symbolAttrs, fieldSymbols, symbolsOn, reductionOf, extraReduction };
navSync();
renderLobby();
loadImages();
if (SIM) startNewGame();
