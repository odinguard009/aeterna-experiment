// v0.106.0 (roadmap M7 step 3): magic-link login and sessions, tested without a database and
// without waiting: the clock is injected and the store is the in-memory reference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../../apps/server/src/store.mjs';
import { accounts, hashToken, readCookie, sameHash, cryptoId, COOKIE, LOGIN_TTL_MS } from '../../apps/server/src/accounts.mjs';

/** A service with a controllable clock and a store shared by the whole test. */
function service(over = {}) {
  const store = memoryStore();
  let t = Date.parse('2026-10-24T06:00:00Z');
  const svc = accounts({ store, now: () => t, origin: 'https://play.example', secure: true, ...over });
  return { store, svc, tick: (ms) => { t += ms; }, at: () => new Date(t).toISOString() };
}

test('AA01 the first login creates the account and mails a one-time link; the token is only stored hashed', async () => {
  const { store, svc } = service();
  const sent = [];
  const s2 = accounts({ store, mailer: (m) => sent.push(m), origin: 'https://play.example' });
  const r = await s2.requestLogin({ email: 'Odin@Example.com' });
  assert.equal(r.created, true);
  assert.match(r.url, /^https:\/\/play\.example\/login\?t=[A-Za-z0-9_-]{43}$/);
  assert.equal(sent.length, 1, 'a mailer means the link leaves the process');
  assert.equal(r.token, null, 'and is not handed back to the caller');
  const token = new URL(r.url).searchParams.get('t');
  // the hash is what the store holds: a dump of the table is not a set of working links
  assert.equal(await store.auth.takeLogin(token, new Date().toISOString()), null, 'the raw token is not a key; only its hash is');
  assert.equal(await store.auth.takeLogin(hashToken(token), '2026-10-24T06:01:00Z'), r.accountId);
});

test('AA02 the second login with the same address reuses the account', async () => {
  const { svc } = service();
  const a = await svc.requestLogin({ email: 'odin@example.com' });
  const b = await svc.requestLogin({ email: 'odin@example.com' });
  assert.equal(b.created, false);
  assert.equal(a.accountId, b.accountId);
});

test('AA03 redeeming a link yields a session cookie; the cookie names the account', async () => {
  const { svc } = service();
  const { url } = await svc.requestLogin({ email: 'odin@example.com', displayName: 'Odin' });
  const token = new URL(url).searchParams.get('t');
  const out = await svc.consumeLogin(token, { userAgent: 'test' });
  assert.equal(out.account.displayName, 'Odin');
  assert.match(out.cookie, new RegExp(`^${COOKIE}=[A-Za-z0-9%_-]{43}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$`));
  const cookie = out.cookie.split(';')[0];
  assert.equal(readCookie(cookie), out.session.token);
  assert.equal((await svc.accountFromCookie(cookie)).id, out.account.id);
  assert.equal(await svc.accountFromCookie(null), null);
  assert.equal(await svc.accountFromCookie(`${COOKIE}=nonsense`), null);
});

test('AA04 a link works once; a used or expired link answers null; expiry is the injected clock', async () => {
  const { svc, tick } = service();
  const first = await svc.requestLogin({ email: 'odin@example.com' });
  const t1 = new URL(first.url).searchParams.get('t');
  assert.ok(await svc.consumeLogin(t1), 'first redemption works');
  assert.equal(await svc.consumeLogin(t1), null, 'a forwarded mail does not work twice');

  const second = await svc.requestLogin({ email: 'odin@example.com' });
  const t2 = new URL(second.url).searchParams.get('t');
  tick(LOGIN_TTL_MS + 1);
  assert.equal(await svc.consumeLogin(t2), null, 'a link older than the TTL is dead');
});

test('AA05 a session expires, and signing out kills it immediately', async () => {
  const { svc, tick } = service();
  const { url } = await svc.requestLogin({ email: 'odin@example.com' });
  const a = await svc.consumeLogin(new URL(url).searchParams.get('t'));
  const cookie = a.cookie.split(';')[0];
  assert.ok(await svc.accountFromCookie(cookie));
  assert.equal(await svc.signOut(cookie), true);
  assert.equal(await svc.accountFromCookie(cookie), null, 'the row is gone, so the cookie is worthless');
  assert.equal(await svc.signOut(cookie), false, 'signing out twice is a no-op');

  const b = await svc.consumeLogin(new URL((await svc.requestLogin({ email: 'odin@example.com' })).url).searchParams.get('t'));
  tick(30 * 24 * 60 * 60 * 1000 + 1);
  assert.equal(await svc.accountFromCookie(b.cookie.split(';')[0]), null, 'a session past its TTL is refused');
});

test('AA06 signOutEverywhere drops every session of the account and nothing else', async () => {
  const { svc } = service();
  const mk = async (email) => {
    const { url } = await svc.requestLogin({ email });
    const out = await svc.consumeLogin(new URL(url).searchParams.get('t'));
    return { account: out.account, cookie: out.cookie.split(';')[0] };
  };
  const one = await mk('one@example.com'), two = await mk('two@example.com');
  const again = await mk('one@example.com');
  assert.equal(await svc.signOutEverywhere(one.account.id), 2);
  assert.equal(await svc.accountFromCookie(one.cookie), null);
  assert.equal(await svc.accountFromCookie(again.cookie), null);
  assert.ok(await svc.accountFromCookie(two.cookie), 'the other account is untouched');
});

test('AA07 bad input is refused: no email, a broken email, a missing store', async () => {
  const { svc } = service();
  await assert.rejects(() => svc.requestLogin({}), /valid email/);
  await assert.rejects(() => svc.requestLogin({ email: 'not-an-address' }), /valid email/);
  assert.equal(await svc.consumeLogin(''), null);
  assert.equal(await svc.consumeLogin('short'), null);
  assert.throws(() => accounts({}), /store with accounts and auth/);
});

test('AA08 cookies are parsed strictly and hashes compare in constant time', () => {
  assert.equal(readCookie('a=1; b=2'), null);
  assert.equal(readCookie('a=1; aeterna_session=tok'), 'tok');
  assert.equal(readCookie('aeterna_session=a%2Fb'), 'a/b', 'percent-encoded values are decoded');
  assert.equal(readCookie(''), null);
  assert.equal(sameHash('ab', 'ab'), true);
  assert.equal(sameHash('ab', 'ac'), false);
  assert.equal(sameHash('ab', 'abc'), false, 'a length difference is not a match');
  assert.match(cryptoId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'v4 shape with the right version/variant bits');
  assert.notEqual(cryptoId(), cryptoId());
});
