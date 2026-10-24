// v0.106.0 (roadmap M7 step 4): the HTTP API over the store and the accounts service. Runs against
// the in-memory reference store and a fixed clock, so no database and no waiting; the login link is
// followed exactly as a browser would (302 -> Set-Cookie -> cookie on the next request).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../../apps/server/src/store.mjs';
import { accounts, COOKIE } from '../../apps/server/src/accounts.mjs';
import { createApi } from '../../apps/server/src/http.mjs';
import { discordOAuth } from '../../apps/server/src/oauth-discord.mjs';

let base = null, server = null, svc = null, store = null;
const t0 = Date.parse('2026-10-24T06:00:00Z');
before(async () => {
  store = memoryStore();
  svc = accounts({ store, now: () => Date.now(), origin: 'http://127.0.0.1', secure: false, linkPath: '/api/login?t=' });
  server = createApi({ accounts: svc, store, origin: 'http://127.0.0.1' });
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((res) => server.close(res)));

const j = async (path, { method = 'GET', body, cookie } = {}) => {
  const res = await fetch(base + path, {
    method, redirect: 'manual',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie'), location: res.headers.get('location') };
};
const login = async (email = 'odin@example.com') => {
  const r = await j('/api/login', { method: 'POST', body: { email } });
  assert.equal(r.status, 200);
  const out = await j(new URL(r.data.url).pathname + new URL(r.data.url).search);
  assert.equal(out.status, 302);
  assert.match(out.setCookie, new RegExp(`^${COOKIE}=[A-Za-z0-9%_-]+;`));
  return out.setCookie.split(';')[0];
};

test('API01 /health answers and an unknown route is a 404', async () => {
  assert.deepEqual((await j('/health')).data, { ok: true });
  assert.equal((await j('/nope')).status, 404);
  assert.equal((await j('/api/me')).status, 401, 'no session -> 401');
});

test('API02 a login link redeems to a session, and the session names the account', async () => {
  const cookie = await login('odin@example.com');
  const me = await j('/api/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.data.account.email, 'odin@example.com');
  assert.equal(me.data.account.id, (await svc.accountFromCookie(cookie)).id);
});

test('API03 a used link is dead, a broken email is refused, bad json is refused', async () => {
  const r = await j('/api/login', { method: 'POST', body: { email: 'odin@example.com' } });
  const link = new URL(r.data.url);
  await j(link.pathname + link.search);                                    // redeem it once
  assert.equal((await j(link.pathname + link.search)).status, 401, 'second redemption is refused');
  assert.equal((await j('/api/login', { method: 'POST', body: { email: 'nope' } })).status, 400);
  const raw = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(raw.status, 400);
});

test('API04 logout ends the session; the library routes refuse a sessionless request', async () => {
  const cookie = await login('odin@example.com');
  assert.equal((await j('/api/decks', { cookie })).status, 200);
  assert.deepEqual((await j('/api/decks', { cookie })).data, { decks: [] });
  assert.deepEqual((await j('/api/matches', { cookie })).data, { matches: [] });
  assert.equal((await j('/api/logout', { method: 'POST', cookie })).status, 204);
  assert.equal((await j('/api/me', { cookie })).status, 401, 'the row is gone, so the cookie is dead');
  assert.equal((await j('/api/decks', { cookie })).status, 401);
});

test('API05 the deck list returns only the account\'s own slots', async () => {
  const cookie = await login('odin@example.com');
  const mine = (await svc.accountFromCookie(cookie)).id;
  await store.decks.put({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accountId: mine, slot: 1, name: 'Red', format: 'standard', cards: { 'BS75-001': 3 } });
  const other = await login('other@example.com');                                     // a second account, so the foreign key is happy
  await store.decks.put({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', accountId: (await svc.accountFromCookie(other)).id, slot: 1, name: 'Other', format: 'eternal', cards: {} });
  const r = await j('/api/decks', { cookie });
  assert.equal(r.data.decks.length, 1, 'the list is scoped to the session account');
  assert.equal(r.data.decks[0].name, 'Red');
});

test('API06 cookie-only auth: the account id is never taken from a query string', async () => {
  const cookie = await login('odin@example.com');
  assert.equal((await j('/api/me?accountId=whatever', { cookie })).status, 200, 'query params are ignored');
  assert.equal((await j('/api/me')).status, 401, 'and without a cookie they do not help');
});

test('API07 the Discord OAuth routes: authorize redirects to the provider; the callback exchanges and logs in', async () => {
  const discord = discordOAuth({
    clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://play.example/cb',
    fetchImpl: async (url) => {
      if (String(url).endsWith('/api/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'tok' }) };
      return { ok: true, json: async () => ({ id: '987654321', username: 'OdinDiscord' }) };
    }
  });
  const srv = createApi({ accounts: svc, store, origin: 'http://127.0.0.1', discord });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const b = `http://127.0.0.1:${srv.address().port}`;
  try {
    const start = await fetch(b + '/api/login/discord', { redirect: 'manual' });
    assert.equal(start.status, 302);
    const loc = new URL(start.headers.get('location'));
    assert.equal(loc.origin + loc.pathname, 'https://discord.com/oauth2/authorize');
    const state = loc.searchParams.get('state');
    assert.equal(discord.validState(state), true);

    const cb = await fetch(b + '/api/login/discord/callback?code=c&state=' + encodeURIComponent(state), { redirect: 'manual' });
    assert.equal(cb.status, 302);
    assert.equal(cb.headers.get('location'), '/');
    const cookie = cb.headers.get('set-cookie').split(';')[0];
    const me = await fetch(b + '/api/me', { headers: { Cookie: cookie } }).then((r) => r.json());
    assert.equal(me.account.displayName, 'OdinDiscord');
    assert.equal(me.account.email, null, 'a Discord account carries no email');

    assert.equal((await fetch(b + '/api/login/discord/callback?code=c&state=nope', { redirect: 'manual' })).status, 400, 'a forged state is refused');
  } finally {
    await new Promise((res) => srv.close(res));
  }
});

test('API08 without a Discord provider the OAuth routes answer 501, never crash', async () => {
  assert.equal((await j('/api/login/discord')).status, 501);
  assert.equal((await j('/api/login/discord/callback?code=c&state=s')).status, 501);
});

test('API09 /api/config reports the ws endpoint and whether Discord sign-in is offered', async () => {
  // The base server has no ws URL and no Discord provider.
  assert.deepEqual((await j('/api/config')).data, { ok: true, wsUrl: null, discord: false });
  const discord = discordOAuth({ clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://play.example/cb' });
  const srv = createApi({ accounts: svc, store, origin: 'http://127.0.0.1', discord, wsUrl: 'ws://127.0.0.1:9000' });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  try {
    const b = `http://127.0.0.1:${srv.address().port}`;
    assert.deepEqual(await fetch(b + '/api/config').then((r) => r.json()), { ok: true, wsUrl: 'ws://127.0.0.1:9000', discord: true });
  } finally {
    await new Promise((res) => srv.close(res));
  }
});
