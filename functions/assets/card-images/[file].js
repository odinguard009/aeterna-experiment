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

import FALLBACK from '../../../data/card-art-fallback.json';

const FILE_ALIAS = { 'BS01-014': 'BS01-014A' };

export async function onRequestGet({ request, params, waitUntil }) {
  const id = params.file;                      // the URL-decoded single path segment after /assets/card-images/
  // Card ids are letters/digits/hyphens (BS01-001, 26RBS01-001, SD69-TOKEN-RAD, ...); reject anything else.
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)) {
    return new Response(null, { status: 404 });
  }

  const cache = caches.default;
  const cacheKey = new URL(request.url);
  cacheKey.search = '?cv=3';                   // bump to drop entries cached by older versions (the official HTML 404 page was cached for some cards)
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // FILE_ALIAS: ids whose official detail page names another file (BS01-014 The Shaman Dragno is BS01-014A there).
  // The official site files 10th-anniversary X cards as BS51-10thX04 (lower-case "th"; BS51-X04 is a different card) and a Rebirth back
  // face (<front id>B) as <front id>_b. No other fallback name: a guessed file is another card, and no picture beats the wrong one.
  const n = FILE_ALIAS[id] || id.replace(/-10THX/, '-10thX'), side = /^(.+\d)B$/.exec(id);
  const names = [...new Set([...(side ? [`${side[1]}_b`] : []), n])];
  let res;
  for (const name of names) {
    try {
      res = await fetch(`${OFFICIAL_IMG}${name}.webp?v2`, { headers: { 'user-agent': USER_AGENT } });
    } catch (e) {
      res = null;                                // a timeout on one name still tries the next
      continue;
    }
    if (res.ok && /^image\//i.test(res.headers.get('Content-Type') || 'image/')) break;      // an HTML 200 (the site's 404 page) is a miss: try the next name
  }
  if ((!res || !res.ok || !/^image\//i.test(res.headers.get('Content-Type') || 'image/')) && FALLBACK.files[id]) {      // cards the official site lacks: Fandom art
    try { res = await fetch(`${FALLBACK.base}${FALLBACK.files[id]}/revision/latest?format=webp`, { headers: { 'user-agent': USER_AGENT, accept: 'image/webp' } }); } catch (e) { res = null; }
  }
  if (!res || !res.ok) return new Response(null, { status: 404 });

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
