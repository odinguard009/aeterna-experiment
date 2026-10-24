// v0.107.0 (roadmap M7): Discord OAuth as a second way in. The provider half (apps/server/src/
// oauth-discord.mjs) proves identity and mints a CSRF state; accounts.loginWithDiscord then upserts
// the account by discordId and opens a session exactly like a redeemed magic link. All offline: the
// token exchange runs against an injected fetch, so no network and no Discord app credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../../apps/server/src/store.mjs';
import { accounts, COOKIE } from '../../apps/server/src/accounts.mjs';
import { discordOAuth } from '../../apps/server/src/oauth-discord.mjs';

const provider = (over = {}) => discordOAuth({ clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://play.example/cb', ...over });

test('DO01 the CSRF state round-trips, a tampered or expired state is refused', () => {
  const d = provider();
  const st = d.newState();
  assert.equal(d.validState(st), true, 'a fresh state is valid');
  assert.equal(d.validState(st + 'x'), false, 'a tampered state fails the HMAC');
  assert.equal(d.validState(st.slice(0, -1)), false);
  assert.equal(d.validState(''), false);
  assert.equal(d.validState('a.b.c'), false);
  const [, ts] = st.split('.');
  assert.equal(d.validState(st, { nowMs: parseInt(ts, 36) }), true, 'still valid at its own timestamp');
  assert.equal(d.validState(st, { nowMs: parseInt(ts, 36) + 11 * 60 * 1000 }), false, 'a state older than 10 minutes is dead');
});

test('DO02 the authorize URL names the client, the redirect, the scope and the state', () => {
  const d = provider({ scope: 'identify email' });
  const u = new URL(d.authorizeUrl(d.newState()));
  assert.equal(u.origin + u.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://play.example/cb');
  assert.equal(u.searchParams.get('scope'), 'identify email');
  assert.equal(typeof u.searchParams.get('state'), 'string');
});

test('DO03 the code exchange calls the token endpoint then /users/@me and returns the identity', async () => {
  const calls = [];
  const d = provider({
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init && init.method, auth: init && init.headers && init.headers.Authorization });
      if (String(url).endsWith('/api/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'tok123' }) };
      if (String(url).endsWith('/api/users/@me')) return { ok: true, json: async () => ({ id: '123456789012345678', username: 'Odin' }) };
      throw new Error('unexpected url ' + url);
    }
  });
  assert.deepEqual(await d.exchange('code123'), { discordId: '123456789012345678', username: 'Odin' });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].auth, 'Bearer tok123', 'the user lookup carries the bearer token');
  const bad = provider({ fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}) }) });
  await assert.rejects(() => bad.exchange('c'), /token exchange failed/);
  const noUser = provider({ fetchImpl: async (url) => ({ ok: true, json: async () => (String(url).endsWith('token') ? { access_token: 't' } : {}) }) });
  await assert.rejects(() => noUser.exchange('c'), /no user/);
});

test('DO04 loginWithDiscord upserts the account by discordId and opens a session', async () => {
  const store = memoryStore();
  const svc = accounts({ store, now: () => Date.now(), origin: 'https://play.example', secure: true });
  const a = await svc.loginWithDiscord({ discordId: '123456789', username: 'Odin' });
  assert.equal(a.account.discordId, '123456789');
  assert.equal(a.account.displayName, 'Odin');
  assert.match(a.cookie, new RegExp(`^${COOKIE}=[A-Za-z0-9%_-]{43}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$`));
  const cookie = a.cookie.split(';')[0];
  assert.equal((await svc.accountFromCookie(cookie)).id, a.account.id);
  const b = await svc.loginWithDiscord({ discordId: '123456789', username: 'Someone Else' });
  assert.equal(b.account.id, a.account.id, 'the same Discord id reuses the account');
  assert.equal(b.account.displayName, 'Odin', 'and keeps the name it registered with');
  await assert.rejects(() => svc.loginWithDiscord({}), /valid discordId/);
  await assert.rejects(() => svc.loginWithDiscord({ discordId: 'x' }), /valid discordId/);
});

test('DO05 the provider refuses a missing credential', () => {
  assert.throws(() => discordOAuth({}), /clientId, clientSecret and redirectUri/);
  assert.throws(() => discordOAuth({ clientId: 'c', clientSecret: 's' }), /clientId, clientSecret and redirectUri/);
  assert.throws(() => discordOAuth({ clientId: 'c', clientSecret: 's', redirectUri: 'r', fetchImpl: null }), /fetchImpl/);
});
