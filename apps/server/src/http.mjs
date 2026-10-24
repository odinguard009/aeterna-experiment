/* ---------------------------------------------------------------------
   HTTP API (roadmap M7 step 4): the account and library routes over the store.

   A tiny node:http router - no framework, no new dependency - that the WebSocket
   room server (run.mjs) can run next to, or a future M8 client can call. Every
   route that touches private data goes through the session cookie; the account
   id is never read from a query string or a body (accounts.mjs owns that rule).

   Routes:
     GET  /health                -> { ok: true }
     POST /api/login   {email}   -> asks accounts for a one-time link; without a
                                    mailer the link is returned so a local run works
     GET  /api/login?t=<token>   -> redeems the link, Set-Cookie, redirects to /
     GET  /api/login/discord           -> the Discord OAuth2 authorize URL (needs `discord`)
     GET  /api/login/discord/callback  -> exchanges the code, Set-Cookie, redirects to /
     GET  /api/me                -> the logged-in account, or 401
     POST /api/logout            -> drops the session cookie
     GET  /api/decks             -> the account's deck slots (401 without a session)
     GET  /api/matches           -> the account's match history, newest first
   --------------------------------------------------------------------- */
import http from 'node:http';

const JSON_HEAD = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { ...JSON_HEAD, ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 64 * 1024) req.destroy(); });
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve({ __parseError: e.message }); } });
});

/**
 * @param {{ accounts: object, store?: object, origin?: string, mailer?: function }} deps
 * @returns an http.Server. The store is only used for the deck and match list routes.
 */
export function createApi({ accounts, store = null, origin = 'http://localhost:8080', mailer = null, discord = null } = {}) {
  if (!accounts || !accounts.requestLogin || !accounts.consumeLogin || !accounts.accountFromCookie) {
    throw new Error('createApi: an accounts service is required');
  }
  if (discord && typeof accounts.loginWithDiscord !== 'function') {
    throw new Error('createApi: Discord OAuth needs accounts.loginWithDiscord');
  }
  const self = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const p = url.pathname;
    const m = (req.method || 'GET').toUpperCase();
    try {
      if (p === '/health' && m === 'GET') return send(res, 200, { ok: true });

      if (p === '/api/login' && m === 'POST') {
        const body = await readBody(req);
        if (body.__parseError) return send(res, 400, { error: 'bad json: ' + body.__parseError });
        const out = await accounts.requestLogin({ email: body.email, displayName: body.displayName });
        // A mailer means the link left the process; otherwise it comes back so a local run can follow it.
        return send(res, mailer ? 202 : 200, { ok: true, ...(mailer ? {} : { url: out.url }) });
      }

      if (p === '/api/login' && m === 'GET') {
        const out = await accounts.consumeLogin(url.searchParams.get('t'));
        if (!out) return send(res, 401, { error: 'this link is unknown, used or expired' });
        res.writeHead(302, { Location: '/', 'Set-Cookie': out.cookie });
        return res.end();
      }

      // Discord OAuth: start the dance, then its callback. Both need the provider; without one the
      // route answers 501 (the store and the accounts service keep working with magic links alone).
      if (p === '/api/login/discord' && m === 'GET') {
        if (!discord) return send(res, 501, { error: 'Discord OAuth is not configured' });
        res.writeHead(302, { Location: discord.authorizeUrl(discord.newState()) });
        return res.end();
      }
      if (p === '/api/login/discord/callback' && m === 'GET') {
        if (!discord) return send(res, 501, { error: 'Discord OAuth is not configured' });
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state || !discord.validState(state)) return send(res, 400, { error: 'bad Discord callback (missing or bad code/state)' });
        let user;
        try { user = await discord.exchange(code); }
        catch (e) { return send(res, 401, { error: String(e && e.message) }); }
        const out = await accounts.loginWithDiscord(user);
        res.writeHead(302, { Location: '/', 'Set-Cookie': out.cookie });
        return res.end();
      }

      if (p === '/api/me' && m === 'GET') {
        const account = await accounts.accountFromCookie(req.headers.cookie);
        return account ? send(res, 200, { account: { id: account.id, email: account.email, displayName: account.displayName } })
          : send(res, 401, { error: 'no session' });
      }

      if (p === '/api/logout' && m === 'POST') {
        await accounts.signOut(req.headers.cookie);
        res.writeHead(204, { 'Set-Cookie': `${accounts.cookieFor ? accounts.cookieFor('', 0) : 'aeterna_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'}` });
        return res.end();
      }

      // private library routes: the only paths that require a session, so an unknown path falls
      // through to a 404 rather than a misleading 401
      if ((p === '/api/decks' && m === 'GET') || (p === '/api/matches' && m === 'GET')) {
        if (!store) return send(res, 501, { error: 'no store configured' });
        const account = await accounts.accountFromCookie(req.headers.cookie);
        if (!account) return send(res, 401, { error: 'no session' });
        if (p === '/api/decks') return send(res, 200, { decks: await store.decks.list(account.id) });
        return send(res, 200, { matches: await store.matches.listOf(account.id, { limit: 50 }) });
      }

      return send(res, 404, { error: 'not found' });
    } catch (e) {
      if (e && e.name === 'TypeError' && /valid email|store:|accounts:/.test(e.message)) return send(res, 400, { error: e.message });
      send(res, 500, { error: String(e && e.message) });
    }
  });
  self.on('clientError', (err, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  return self;
}
