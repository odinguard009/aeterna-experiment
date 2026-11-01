/* ---------------------------------------------------------------------
   CARD IMAGE MIRROR — Cloudflare Pages Function (v0.113.0, official source v0.114.0)

   Serves official Battle Spirits card art on the static Cloudflare Pages deployment. The Pages site
   has no Node process, so this Function proxies the official image at the edge.

   Route: GET /assets/card-images/<card-id>   (card-id = a card's `id`, e.g. BS76-001)

   The official battlespirits.com card database serves every card directly by number, so the URL is
   derived from the id — no wiki / API resolution needed:
       https://www.battlespirits.com/images/cardlist/<card-id>.webp?v2   (WebP, uniform size)
   Responses are cached for a day in the Cloudflare cache; the client still falls back to its
   text/colour placeholder on a 404 (a card the official site lacks, or an unknown id).
   --------------------------------------------------------------------- */

const OFFICIAL_IMG = 'https://www.battlespirits.com/images/cardlist/';
const USER_AGENT = 'AeternaCardArtSync/1.0 (unofficial fan project; read-only)';

export async function onRequestGet({ request, params, waitUntil }) {
  const id = params.file;                      // the URL-decoded single path segment after /assets/card-images/
  // Card ids are letters/digits/hyphens (BS01-001, 26RBS01-001, SD69-TOKEN-RAD, ...); reject anything else.
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)) {
    return new Response(null, { status: 404 });
  }

  const cache = caches.default;
  const cacheKey = new URL(request.url);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // The official site files 10th-anniversary cards as BS51-X04 (not BS51-10THX04) and some old X0nn ids as Xnn.
  const base = id.replace(/-10THX/, '-X');
  let res;
  for (const name of new Set([base, base.replace(/-X0(\d\d)[A-Z]?$/, '-X$1')])) {
    try {
      res = await fetch(`${OFFICIAL_IMG}${name}.webp?v2`, { headers: { 'user-agent': USER_AGENT } });
    } catch (e) {
      return new Response(null, { status: 502 });
    }
    if (res.ok) break;
  }
  if (!res.ok) return new Response(null, { status: 404 });

  // The official site answers a missing card with an HTTP 200 HTML page; never pass that through as art.
  const type = res.headers.get('Content-Type') || '';
  if (type && !/^image\//i.test(type)) return new Response(null, { status: 404 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 12) return new Response(null, { status: 404 });
  const head = new Uint8Array(buf, 0, 12);
  const ascii = (a, b) => String.fromCharCode(...head.subarray(a, b));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return new Response(null, { status: 404 });
  const out = new Response(buf, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/webp',
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'public, max-age=86400',
    },
  });
  waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}
