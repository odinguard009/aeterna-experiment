/* ---------------------------------------------------------------------
   DISCORD OAUTH2 (roadmap M7): the provider half of "Discord OAuth as a second way in".

   This module only proves identity - it mints a CSRF state, builds the authorize URL and exchanges a
   code for { discordId, username }. Creating the account and the session cookie is accounts.mjs's job
   (loginWithDiscord). fetch and the clock are injected, so the token exchange and the user lookup run
   against a fake in the tests and against https://discord.com in a deployment; no network call and no
   Discord app credentials are needed to exercise the flow.
   --------------------------------------------------------------------- */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** The CSRF state is a random nonce plus its HMAC under the client secret, with a timestamp inside so
 *  a captured state expires: `nonce.ts.hmac(nonce + "." + ts)`. Nothing is stored server-side, which
 *  suits a single-process server; a forged or replayed state fails the constant-time check. */
const STATE_TTL_MS = 10 * 60 * 1000;

export function discordOAuth({ clientId, clientSecret, redirectUri, scope = 'identify', base = 'https://discord.com', fetchImpl = fetch } = {}) {
  if (!clientId || !clientSecret || !redirectUri) throw new Error('discordOAuth: clientId, clientSecret and redirectUri are required');
  if (typeof fetchImpl !== 'function') throw new Error('discordOAuth: fetchImpl must be a function');

  const sign = n => createHmac('sha256', clientSecret).update(n).digest('base64url');
  const newState = () => {
    const n = randomBytes(24).toString('base64url');
    const ts = Date.now().toString(36);
    return `${n}.${ts}.${sign(n + '.' + ts)}`;
  };
  const validState = (s, { nowMs = Date.now(), ttlMs = STATE_TTL_MS } = {}) => {
    const parts = String(s || '').split('.');
    if (parts.length !== 3) return false;
    const [n, ts, h] = parts;
    if (!n || !ts || !h) return false;
    const a = Buffer.from(h), b = Buffer.from(sign(n + '.' + ts));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const t = parseInt(ts, 36);
    if (!Number.isFinite(t)) return false;
    const age = nowMs - t;
    return age > -60000 && age <= ttlMs;                       // a little clock skew either way is fine
  };

  const authorizeUrl = state => {
    const u = new URL('/oauth2/authorize', base);
    u.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope, state }).toString();
    return u.toString();
  };

  /** code -> { discordId, username }; throws on a bad code or a provider error. Two calls: the token
   *  exchange, then /users/@me with the bearer token. */
  const exchange = async code => {
    const tok = await fetchImpl(`${base}/api/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!tok.ok) throw new Error('discordOAuth: token exchange failed (' + tok.status + ')');
    const t = await tok.json();
    if (!t || !t.access_token) throw new Error('discordOAuth: no access token in the response');
    const me = await fetchImpl(`${base}/api/users/@me`, { headers: { Authorization: 'Bearer ' + t.access_token } });
    if (!me.ok) throw new Error('discordOAuth: user lookup failed (' + me.status + ')');
    const u = await me.json();
    if (!u || !u.id || !u.username) throw new Error('discordOAuth: no user in the response');
    return { discordId: String(u.id), username: String(u.username) };
  };

  return { newState, validState, authorizeUrl, exchange };
}
