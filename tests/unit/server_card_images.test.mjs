// v0.112.0 (card images online), v0.114.0 (official source): the on-demand card-image mirror.
// GET /assets/card-images/<card-id> proxies the official battlespirits.com image (the URL is derived
// from the card id), downloads and caches it in a git-ignored mirror dir; the second request is served
// from disk. A card the official site lacks is a 404, separators/dot-files/extensions are refused, and
// the route is opt-in on createApi.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../../apps/server/src/http.mjs';
import { cardImageRoute } from '../../apps/server/src/card-images.mjs';

const WEBP = () => Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]).buffer;   // "RIFF....WEBP"
const OFFICIAL = 'https://www.battlespirits.com/images/cardlist/';

/** A fetch stub for the official image URL (derived from the card id). Tracks upstream fetches. */
function fakeFetch({ bytes = WEBP(), haveImage = true, contentType = 'image/webp' } = {}) {
  const calls = { image: 0 };
  const fetchImpl = async (url) => {
    if (url.startsWith(OFFICIAL) && url.endsWith('.webp?v2')) {
      calls.image += 1;
      return haveImage
        ? { ok: true, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) }, arrayBuffer: async () => bytes }
        : { ok: false, status: 404 };
    }
    return { ok: false, status: 404 };
  };
  return { fetchImpl, calls };
}

let dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const mkdir = () => { const d = mkdtempSync(join(tmpdir(), 'aeterna-cimg-')); dirs.push(d); return d; };

function mount() {
  const dir = mkdir();
  const { fetchImpl, calls } = fakeFetch();
  const route = cardImageRoute({ mirrorDir: dir, fetchImpl });
  return { dir, route, calls };
}
async function hit(route, path, method = 'GET') {
  let status = 0, type = '', body = Buffer.alloc(0);
  const req = { method, url: path };
  const res = {
    writeHead: (s, h = {}) => { status = s; type = h['Content-Type'] || ''; },
    end: (b) => { body = Buffer.isBuffer(b) ? b : Buffer.from(String(b || '')); },
  };
  const handled = await route(req, res, path);
  return { handled, status, type, body };
}

test('CIMG-S1 an official image is proxied on first request and served from disk after', async () => {
  const { dir, route, calls } = mount();
  const r1 = await hit(route, '/assets/card-images/BS76-001');
  assert.equal(r1.handled, true);
  assert.equal(r1.status, 200);
  assert.equal(r1.type, 'image/webp');
  assert.ok(r1.body.length > 0, 'the image bytes are served');
  assert.equal(calls.image, 1);
  assert.ok(existsSync(join(dir, 'BS76-001.webp')), 'the mirror cached the file');

  const r2 = await hit(route, '/assets/card-images/BS76-001');
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.body, r1.body);
  assert.equal(calls.image, 1, 'the second request is served from disk, not re-downloaded');
});

test('CIMG-S2 a card the official site lacks is a 404 and nothing is cached', async () => {
  const { dir } = mount();
  const { fetchImpl, calls } = fakeFetch({ haveImage: false });
  const route = cardImageRoute({ mirrorDir: dir, fetchImpl });
  const r = await hit(route, '/assets/card-images/XXXXX-999');
  assert.equal(r.status, 404);
  assert.equal(calls.image, 1);
  assert.equal(existsSync(join(dir, 'XXXXX-999.webp')), false);
});

test('CIMG-S5 an official HTTP 200 HTML page is rejected instead of cached as a webp', async () => {
  const dir = mkdir();
  const { fetchImpl, calls } = fakeFetch({ bytes: Buffer.from('<html>missing card</html>'), contentType: 'text/html' });
  const route = cardImageRoute({ mirrorDir: dir, fetchImpl });
  const r = await hit(route, '/assets/card-images/BS01-014');
  assert.equal(r.status, 404);
  assert.equal(calls.image, 1);
  assert.equal(existsSync(join(dir, 'BS01-014.webp')), false);
});
test('CIMG-S6 an old HTML file already in the mirror is dropped and refetched', async () => {
  const dir = mkdir();
  writeFileSync(join(dir, 'BS76-001.webp'), '<html>old 200 page</html>');
  const { fetchImpl, calls } = fakeFetch();
  const route = cardImageRoute({ mirrorDir: dir, fetchImpl });
  const r = await hit(route, '/assets/card-images/BS76-001');
  assert.equal(r.status, 200);
  assert.equal(calls.image, 1, 'the poisoned cache entry is fetched again');
  const cached = readFileSync(join(dir, 'BS76-001.webp'));
  assert.equal(cached.subarray(0, 4).toString('ascii'), 'RIFF');
});

test('CIMG-S3 separators, dot-files and extensions are refused, and non-GET is a 405', async () => {
  const { dir, route } = mount();
  for (const p of ['/assets/card-images/../secret', '/assets/card-images/.hidden', '/assets/card-images/a/b', '/assets/card-images/BS76-001.webp', '/assets/card-images/']) {
    const r = await hit(route, p);
    assert.equal(r.status, 404, `${p} is refused`);
  }
  assert.equal(existsSync(join(dir, 'secret.webp')), false, 'nothing escaped the mirror dir');
  const r = await hit(route, '/assets/card-images/BS76-001', 'POST');
  assert.equal(r.status, 405);
});

test('CIMG-S4 the route is opt-in on createApi: mounted it serves, unmounted it 404s', async () => {
  const dir = mkdir();
  const { fetchImpl } = fakeFetch();
  const accountsStub = { requestLogin: async () => ({}), consumeLogin: async () => null, accountFromCookie: async () => null, signOut: async () => {}, cookieFor: () => '' };
  const api = createApi({ accounts: accountsStub, origin: 'http://127.0.0.1', cardImages: cardImageRoute({ mirrorDir: dir, fetchImpl }) });
  await new Promise((res) => api.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${api.address().port}`;
  try {
    const r = await fetch(base + '/assets/card-images/BS76-001');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/webp');

    const bare = createApi({ accounts: accountsStub, origin: 'http://127.0.0.1' });
    await new Promise((res) => bare.listen(0, '127.0.0.1', res));
    const base2 = `http://127.0.0.1:${bare.address().port}`;
    try {
      const r2 = await fetch(base2 + '/assets/card-images/BS76-001');
      assert.equal(r2.status, 404, 'without the dep the path is the ordinary JSON 404');
    } finally { await new Promise((res) => bare.close(res)); }
  } finally { await new Promise((res) => api.close(res)); }
});

test('CIMG-S5 10th-anniversary X ids use the official 10thX file (never the older plain X card); a Rebirth back face is <front>_b', async () => {
  const urls = [];
  const route = cardImageRoute({ mirrorDir: mkdir(), fetchImpl: async (u) => { urls.push(u.slice(OFFICIAL.length)); return u.includes('_b') || u.includes('10thX') ? { ok: true, headers: { get: () => 'image/webp' }, arrayBuffer: async () => WEBP() } : { ok: false, status: 404 }; } });
  assert.equal((await hit(route, '/assets/card-images/BS51-10THX04')).status, 200);
  assert.equal((await hit(route, '/assets/card-images/BS73-061B')).status, 200);
  assert.deepEqual(urls, ['BS51-10thX04.webp?v2', 'BS73-061_b.webp?v2']);
  const miss = cardImageRoute({ mirrorDir: mkdir(), fetchImpl: async (u) => { urls.push(u); return { ok: false, status: 404 }; } });
  urls.length = 0;
  assert.equal((await hit(miss, '/assets/card-images/BS44-10THX01')).status, 404);
  assert.ok(urls.every((u) => u.includes('10thX')), 'no plain-X fallback for a 10thX id');
  urls.length = 0;
  assert.equal((await hit(miss, '/assets/card-images/BS13-X005Z')).status, 404);
  assert.deepEqual(urls, [OFFICIAL + 'BS13-X005Z.webp?v2'], 'no X0nn -> Xnn guess (that file is another card)');
});

test('CIMG-S6 BS01-014 (The Shaman Dragno) is filed as BS01-014A on the official site', async () => {
  const urls = [];
  const route = cardImageRoute({ mirrorDir: mkdir(), fetchImpl: async (u) => { urls.push(u.slice(OFFICIAL.length)); return { ok: true, headers: { get: () => 'image/webp' }, arrayBuffer: async () => WEBP() }; } });
  assert.equal((await hit(route, '/assets/card-images/BS01-014')).status, 200);
  assert.deepEqual(urls, ['BS01-014A.webp?v2']);
  assert.match(readFileSync('functions/assets/card-images/[file].js', 'utf8'), /'BS01-014': 'BS01-014A'/, 'the Pages function carries the same alias');
});

test('CIMG-S7 a card the official site lacks falls back to its Fandom art (21 ids), others stay a 404', async () => {
  const fb = JSON.parse(readFileSync('data/card-art-fallback.json', 'utf8'));
  assert.equal(Object.keys(fb.files).length, 21);
  const urls = [];
  const fetchImpl = async (u) => {
    urls.push(u);
    return u.startsWith(OFFICIAL) ? { ok: false, status: 404 } : { ok: true, headers: { get: () => 'image/webp' }, arrayBuffer: async () => WEBP() };
  };
  const route = cardImageRoute({ mirrorDir: mkdir(), fetchImpl });
  assert.equal((await hit(route, '/assets/card-images/BS18-X012R')).status, 200);
  assert.equal(urls.at(-1), `${fb.base}${fb.files['BS18-X012R']}/revision/latest?format=webp`);
  assert.equal((await hit(route, '/assets/card-images/BS77-005')).status, 404, 'BS77 (unreleased) has no art anywhere');
  assert.match(readFileSync('functions/assets/card-images/[file].js', 'utf8'), /card-art-fallback\.json/, 'the Pages function uses the same map');
});
