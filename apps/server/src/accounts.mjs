/* ---------------------------------------------------------------------
   ACCOUNTS: magic-link login and sessions (roadmap M7 step 3)

   No external service and no password. Two flows:

     requestLogin({ email })  -> a one-time link  <origin>/login?t=<token>
     consumeLogin(token)      -> { account, session, cookie }   (creates the account on first use)
     accountFromCookie(header) -> the account behind a request, or null

   Security decisions, all of them testable offline:
     * the token is 32 random bytes, base64url. Only its sha256 goes to the database, so a dump is
       not a set of working links;
     * a login token is single use and short lived (15 min by default), and the store's takeLogin
       marks it used atomically - two clicks cannot both log in;
     * the session is a separate 32-byte token in an HttpOnly, SameSite=Lax cookie, so a script on
       the page cannot read it, and `Secure` is on unless the server runs on plain http for local
       testing;
     * the cookie is the only credential a request carries; the account id is never taken from a
       query parameter or a body.

   The clock and the store are injected, so a test can expire a token without sleeping.
   --------------------------------------------------------------------- */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const LOGIN_TTL_MS = 15 * 60 * 1000;              // a magic link is good for 15 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // and a session for 30 days
export const COOKIE = 'aeterna_session';

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
/** Constant-time comparison for two hex strings of the same length. */
export const sameHash = (a, b) => {
  const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
};
const emailOK = (e) => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

/** Parse a Cookie header for one name. */
export function readCookie(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/**
 * @param {{ store: object, now?: () => number, origin?: string, secure?: boolean,
 *           loginTtlMs?: number, sessionTtlMs?: number, mailer?: (msg:{to:string,url:string})=>Promise<void>|void }} deps
 */
export function accounts({ store, now = () => Date.now(), origin = 'http://localhost:8080', secure = true, loginTtlMs = LOGIN_TTL_MS, sessionTtlMs = SESSION_TTL_MS, mailer = null, linkPath = '/login?t=' } = {}) {
  if (!store || !store.auth || !store.accounts) throw new Error('accounts: a store with accounts and auth is required');
  const iso = (ms) => new Date(ms).toISOString();

  return {
    /** Create the account if the address is new, then hand out a one-time link. */
    async requestLogin({ email, displayName = null } = {}) {
      if (!emailOK(email)) throw new TypeError('accounts: a valid email is required');
      let account = await store.accounts.byLogin({ email });
      let created = false;
      if (!account) {
        created = true;
        account = await store.accounts.create({
          id: cryptoId(), email,
          displayName: (displayName || String(email).split('@')[0]).slice(0, 40)
        });
      }
      const token = newToken();
      await store.auth.putLogin({ tokenHash: hashToken(token), accountId: account.id, expiresAt: iso(now() + loginTtlMs) });
      const url = `${origin.replace(/\/+$/, '')}${linkPath}${token}`;
      if (mailer) await mailer({ to: email, url });
      // Without a mailer (local runs, tests) the caller gets the link; a deployment always mails it.
      return { accountId: account.id, created, url, token: mailer ? null : token };
    },

    /** Redeem a link: single use, then a session cookie. */
    async consumeLogin(token, { userAgent = null } = {}) {
      if (!token) return null;
      const accountId = await store.auth.takeLogin(hashToken(token), iso(now()));
      if (!accountId) return null;
      const account = await store.accounts.get(accountId);
      if (!account) return null;
      const sessionToken = newToken();
      const expiresAt = iso(now() + sessionTtlMs);
      await store.auth.putSession({ tokenHash: hashToken(sessionToken), accountId, expiresAt });
      return { account, session: { token: sessionToken, expiresAt, userAgent }, cookie: cookieFor(sessionToken, sessionTtlMs) };
    },

    /** Discord OAuth: the identity is already proved (discordId + username) - upsert the account by its
     *  Discord id and open a session exactly like a redeemed magic link. No link is sent: Discord vouched
     *  for the user, so the callback goes straight to a session cookie. */
    async loginWithDiscord({ discordId, username } = {}) {
      if (typeof discordId !== 'string' || discordId.length < 5 || discordId.length > 40) throw new TypeError('accounts: a valid discordId is required');
      let account = await store.accounts.byLogin({ discordId });
      if (!account) account = await store.accounts.create({ id: cryptoId(), discordId, displayName: (username || 'Discord user').slice(0, 40) });
      const sessionToken = newToken();
      const expiresAt = iso(now() + sessionTtlMs);
      await store.auth.putSession({ tokenHash: hashToken(sessionToken), accountId: account.id, expiresAt });
      return { account, session: { token: sessionToken, expiresAt }, cookie: cookieFor(sessionToken, sessionTtlMs) };
    },

    /** The account behind a request, or null. */
    async accountFromCookie(header) {
      const token = readCookie(header);
      if (!token) return null;
      const accountId = await store.auth.session(hashToken(token), iso(now()));
      return accountId ? store.accounts.get(accountId) : null;
    },

    /** Sign out: drop the row so a stolen cookie stops working immediately. */
    async signOut(header) {
      const token = readCookie(header);
      if (!token) return false;
      return store.auth.dropSession(hashToken(token));
    },

    async signOutEverywhere(accountId) { return store.auth.dropAccountSessions(accountId); },
    cookieFor,
  };

  function cookieFor(token, ttlMs) {
    const bits = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(ttlMs / 1000)}`];
    if (secure) bits.push('Secure');       // off only for a local http run, never in a deployment
    return bits.join('; ');
  }
}

/** A v4-shaped uuid from the system RNG (the same shape the schema expects). */
export function cryptoId() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
