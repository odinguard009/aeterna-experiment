// v0.112.0 (card images online): the on-demand card-image mirror. GET /assets/card-images/<file>
// resolves the Fandom wiki File: name through the MediaWiki API, downloads the image and caches it
// in a git-ignored mirror dir; the second request is served from disk. A missing card is a 404 and
// path traversal is refused. The route is opt-in on createApi, so the other server tests are untouched.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../../apps/server/src/http.mjs';
import { cardImageRoute } from '../../apps/server/src/card-images.mjs';

const PNG = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer;
const API = 'https://battle-spirits.fandom.com/api.php';

/** A fetch stub: the wiki API returns one image URL; that URL returns the given bytes. Tracks image fetches. */
function fakeFetch({ imageUrl = 'https://img.example/BS76-001.png', bytes = PNG(), haveImage = true } = {}) {
  const calls = { api: 0, image: 0 };
  const fetchImpl = async (url) => {
    if (url.startsWith(API)) {
      calls.api += 1;
      return {
        ok: true,
        json: async () => ({ query: { pages: haveImage ? [{ imageinfo: [{ url: imageUrl }] }] : [{ imageinfo: [] }] } }),
      };
    }
    if (url === imageUrl) {
      calls.image += 1;
      return { ok: true, arrayBuffer: async () => bytes };
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

test('CIMG-S1 a card image is downloaded on first request and served from disk after', async () => {
  const { dir, route, calls } = mount();
  const r1 = await hit(route, '/assets/card-images/BS76-001.png');
  assert.equal(r1.handled, true);
  assert.equal(r1.status, 200);
  assert.equal(r1.type, 'image/png');
  assert.ok(r1.body.length > 0, 'the image bytes are served');
  assert.equal(calls.api, 1);
  assert.equal(calls.image, 1);
  assert.ok(existsSync(join(dir, 'BS76-001.png')), 'the mirror cached the file');

  const r2 = await hit(route, '/assets/card-images/BS76-001.png');
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.body, r1.body);
  assert.equal(calls.image, 1, 'the second request is served from disk, not re-downloaded');
});

test('CIMG-S2 a card the wiki lacks is a 404 and nothing is cached', async () => {
  const { dir, route, calls } = mount();
  const { fetchImpl } = fakeFetch({ haveImage: false });
  const route2 = cardImageRoute({ mirrorDir: dir, fetchImpl });
  const r = await hit(route2, '/assets/card-images/MISSING-999.png');
  assert.equal(r.status, 404);
  assert.equal(calls.api, 0);
  assert.equal(existsSync(join(dir, 'MISSING-999.png')), false);
});

test('CIMG-S3 path traversal and dot-files are refused, and non-GET is a 405', async () => {
  const { dir, route } = mount();
  for (const p of ['/assets/card-images/../secret.png', '/assets/card-images/.hidden.png', '/assets/card-images/a/b.png', '/assets/card-images/']) {
    const r = await hit(route, p);
    assert.equal(r.status, 404, `${p} is refused`);
  }
  assert.equal(existsSync(join(dir, 'secret.png')), false, 'nothing escaped the mirror dir');
  const r = await hit(route, '/assets/card-images/BS76-001.png', 'POST');
  assert.equal(r.status, 405);
});

test('CIMG-S4 the route is opt-in on createApi: mounted it serves, unmounted it 404s', async () => {
  const dir = mkdir();
  const { fetchImpl } = fakeFetch({ bytes: Uint8Array.from([9, 8, 7, 6, 5]).buffer });
  const accountsStub = { requestLogin: async () => ({}), consumeLogin: async () => null, accountFromCookie: async () => null, signOut: async () => {}, cookieFor: () => '' };
  const api = createApi({ accounts: accountsStub, origin: 'http://127.0.0.1', cardImages: cardImageRoute({ mirrorDir: dir, fetchImpl }) });
  await new Promise((res) => api.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${api.address().port}`;
  try {
    const r = await fetch(base + '/assets/card-images/BS76-001.png');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');

    const bare = createApi({ accounts: accountsStub, origin: 'http://127.0.0.1' });
    await new Promise((res) => bare.listen(0, '127.0.0.1', res));
    const base2 = `http://127.0.0.1:${bare.address().port}`;
    try {
      const r2 = await fetch(base2 + '/assets/card-images/BS76-001.png');
      assert.equal(r2.status, 404, 'without the dep the path is the ordinary JSON 404');
    } finally { await new Promise((res) => bare.close(res)); }
  } finally { await new Promise((res) => api.close(res)); }
});
