/* ---------------------------------------------------------------------
   ONLINE LOBBY + ACCOUNT (v0.109.0, roadmap M8 part 2; docs/ai/monorepo-plan.md M8)
   The lobby that sits before a match and the account panel beside it. The match terminal itself is 13i-online.js;
   this module only renders the lobby (view-online), the private-room code entry and the account sign-in, all over
   the server's HTTP API (apps/server/src/http.mjs) - the ws endpoint, /api/me, /api/login, /api/logout and the
   Discord OAuth redirect. The offline single-file game is untouched.

   - Quick match: onlineStart() joins a fresh room (auto code).
   - Private room: onlineStart(code) joins (or creates) that code - the room id is the shareable code.
   - Account: optional for casual play; magic-link sign-in (the server returns the link when no mailer runs),
     Discord when the server configured it, and sign-out.
   --------------------------------------------------------------------- */
let ONL_CFG = { wsUrl: null, discord: false, serverOk: false, checked: false };
let ONL_ACCOUNT = null;

/** Fetch the server's /api/config (ws endpoint + whether Discord sign-in is offered). */
async function onlConfig() {
  const origin = onlineOrigin();
  if (!origin) { ONL_CFG = { wsUrl: null, discord: false, serverOk: false, checked: true, unreachable: true }; return ONL_CFG; }
  try {
    const r = await fetch(origin.replace(/\/+$/, '') + '/api/config', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); ONL_CFG = { wsUrl: j.wsUrl || null, discord: !!j.discord, serverOk: true, checked: true }; }
    else ONL_CFG = { wsUrl: null, discord: false, serverOk: false, checked: true };
  } catch (e) { ONL_CFG = { wsUrl: null, discord: false, serverOk: false, checked: true, unreachable: true }; }
  return ONL_CFG;
}
/** Fetch the signed-in account (or null) from /api/me. */
async function onlAccount() {
  const origin = onlineOrigin();
  if (!origin) { ONL_ACCOUNT = null; return null; }
  try {
    const r = await fetch(origin.replace(/\/+$/, '') + '/api/me', { cache: 'no-store', credentials: 'include' });
    ONL_ACCOUNT = r.ok ? ((await r.json()).account || null) : null;
  } catch (e) { ONL_ACCOUNT = null; }
  return ONL_ACCOUNT;
}
/** The account panel HTML for the current server/account state. */
function onlAccountHTML() {
  if (!ONL_CFG.serverOk) {
    return `<div class="empty-note">${onlineOrigin() ? 'The server is unreachable — account sign-in needs the server.' : 'Run <code>node apps/server/src/serve.mjs</code> to use online play and accounts.'}</div>`;
  }
  if (ONL_ACCOUNT) {
    return `<div class="srow"><div class="tx"><b>Signed in</b><span>${esc(ONL_ACCOUNT.displayName || ONL_ACCOUNT.email)}${ONL_ACCOUNT.email ? ' · ' + esc(ONL_ACCOUNT.email) : ''}</span></div><button class="ae-ghost" data-a="onl-logout">SIGN OUT</button></div>`;
  }
  const discordBtn = ONL_CFG.discord ? `<button class="ae-ghost" data-a="onl-discord">CONTINUE WITH DISCORD</button>` : '';
  return `<div class="srow"><div class="tx"><b>Not signed in</b><span>Optional for casual play. A one-time link signs you in — no password.</span></div></div>
    <div class="srow"><input id="onl-email" class="sel" type="email" placeholder="you@example.com" autocomplete="off" spellcheck="false"><button class="ae-ghost" data-a="onl-login">EMAIL ME A SIGN-IN LINK</button>${discordBtn}</div>
    <div id="onl-account-msg" class="lib-msg" role="status"></div>`;
}
/** Render the whole online lobby: the deck line, the server reachability and the account panel. */
async function renderOnlineLobby() {
  const v = validateDeck(PLAYER_DECK, 'standard');
  const el = $('onl-deck');
  if (el) {
    el.className = 'lobby-deck' + (v.ok ? '' : ' bad');
    el.textContent = v.ok ? `Your deck: ${deckTotal(PLAYER_DECK)} cards · legal in ${fmtName('standard')}` : `Your deck is not legal in Standard: ${errSummary(v)}`;
  }
  const acc = $('onl-account'); if (acc) acc.innerHTML = '<div class="empty-note">Loading…</div>';
  const srv = $('onl-server'); if (srv) srv.textContent = 'Checking the server…';
  await onlConfig();
  await onlAccount();
  if (srv) srv.textContent = ONL_CFG.serverOk
    ? 'Reachable · ' + (ONL_CFG.wsUrl || 'WebSocket endpoint from /api/config')
    : (onlineOrigin() ? 'Unreachable — start it with node apps/server/src/serve.mjs, or set a Server URL in Settings.' : 'Not available — the page is opened as a file.');
  if (acc) acc.innerHTML = onlAccountHTML();
}

/* ---------- lobby actions (16-events.js) ---------- */
async function onlQuick() { await onlineStart(); }
async function onlJoin() {
  const code = String(($('onl-code') || {}).value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  if (!code) { await uiInfo('Online', 'Enter a room code first (letters and numbers, up to 16 characters).'); return; }
  await onlineStart(code);
}
async function onlLogin() {
  const origin = onlineOrigin(), msg = $('onl-account-msg');
  if (!origin) { if (msg) msg.textContent = 'The server is unreachable.'; return; }
  const email = String(($('onl-email') || {}).value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msg) msg.textContent = 'Enter a valid email address.'; return; }
  try {
    const r = await fetch(origin.replace(/\/+$/, '') + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) {
      // a local run (no mailer) returns the link; a deployment mails it and returns none.
      if (msg) msg.innerHTML = `A sign-in link was created. <a href="${esc(j.url)}">Open the sign-in link</a> — it sets your session and returns here.`;
    } else if (r.ok) {
      if (msg) msg.textContent = `A sign-in link was emailed to ${email}. Click it to finish signing in.`;
    } else if (msg) msg.textContent = (j && j.error) || 'Sign-in failed.';
  } catch (e) { if (msg) msg.textContent = 'The server is unreachable.'; }
}
async function onlLogout() {
  const origin = onlineOrigin();
  try { await fetch(origin.replace(/\/+$/, '') + '/api/logout', { method: 'POST' }); } catch (e) { /* offline */ }
  await onlAccount();
  const acc = $('onl-account'); if (acc) acc.innerHTML = onlAccountHTML();
}
function onlDiscord() {
  const origin = onlineOrigin();
  if (origin) location.href = origin.replace(/\/+$/, '') + '/api/login/discord';
}
/* expose hooks for the tests (16-events.js reassigns window.BS after this module loads). */
Promise.resolve().then(() => {
  if (window.BS) Object.assign(window.BS, { renderOnlineLobby, onlConfig, onlAccount, onlineAccount: () => ONL_ACCOUNT });
});
