/* ---------------------------------------------------------------------
   CARD IMAGE MIRROR — Cloudflare Pages Function (v0.113.0)

   Serves official Battle Spirits card art on the static Cloudflare Pages deployment, the same way
   the Node server does in `apps/server/src/card-images.mjs` (which only runs locally / on the room
   server). The Pages site has no Node process, so this Function proxies the wiki fetch at the edge.

   Route: GET /assets/card-images/<filename>   (filename = a card's `image` field, e.g. BS76-001.png)

   The image filename is the wiki's `File:` name, resolved through the MediaWiki imageinfo API.
   The wiki CDN blocks hotlinks without a Fandom Referer header (403), so the fetch sends one here
   (a browser cannot — it sends the real page origin). Responses are cached for a day in the
   Cloudflare cache; the client still falls back to its text/colour placeholder on a 404.
   --------------------------------------------------------------------- */

const WIKI_API = 'https://battle-spirits.fandom.com/api.php';
const WIKI_ORIGIN = 'https://battle-spirits.fandom.com';
const USER_AGENT = 'AeternaCardArtSync/1.0 (unofficial fan project; read-only)';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// The wiki transcodes the "latest" revision to WebP regardless of the file extension, so the type is
// sniffed from the bytes instead of trusting the name.
function sniffMime(buf, filename) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const ascii = (a, b) => String.fromCharCode(...bytes.subarray(a, b));
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length > 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  const ext = (String(filename).match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

export async function onRequestGet({ request, params, waitUntil }) {
  const filename = params.file;               // the URL-decoded single path segment after /assets/card-images/
  // Only a bare filename (no separators, no leading dot, with an extension) reaches the wiki fetch.
  if (!filename || /[\\/]/.test(filename) || filename.startsWith('.') || !/\.[a-z0-9]+$/i.test(filename)) {
    return new Response(null, { status: 404 });
  }

  const cache = caches.default;
  const cacheKey = new URL(request.url);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const headers = { 'user-agent': USER_AGENT, referer: WIKI_ORIGIN + '/' };

  // 1. Resolve the File: name to the wiki static URL (one API call per uncached card).
  let data;
  try {
    const api = `${WIKI_API}?action=query&titles=${encodeURIComponent('File:' + filename)}&prop=imageinfo&iiprop=url&format=json&formatversion=2`;
    const apiRes = await fetch(api, { headers });
    if (!apiRes.ok) return new Response(null, { status: 404 });
    data = await apiRes.json();
  } catch (e) {
    return new Response(null, { status: 502 });
  }
  const page = data && data.query && Array.isArray(data.query.pages) ? data.query.pages[0] : null;
  const url = page && Array.isArray(page.imageinfo) && page.imageinfo[0] && typeof page.imageinfo[0].url === 'string'
    ? page.imageinfo[0].url : null;
  if (!url) return new Response(null, { status: 404 });

  // 2. Download the art bytes (with the Fandom Referer the CDN requires).
  let buf;
  try {
    const imgRes = await fetch(url, { headers });
    if (!imgRes.ok) return new Response(null, { status: 404 });
    buf = await imgRes.arrayBuffer();
  } catch (e) {
    return new Response(null, { status: 502 });
  }
  if (!buf || !buf.byteLength) return new Response(null, { status: 404 });

  const res = new Response(buf, {
    headers: {
      'Content-Type': sniffMime(buf, filename),
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'public, max-age=86400',
    },
  });
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
