/* ---------------------------------------------------------------------
   CARD IMAGE MIRROR (v0.112.0, card images online / Aegis-style)

   Serves official Battle Spirits card art from a local mirror directory, downloading and
   caching it from the Fandom wiki on demand (the first request for a card pays one wiki
   fetch). The mirror dir is a git-ignored build artifact; a card the wiki lacks is a 404
   and the client falls back to its text/colour placeholder.

   Route: GET /assets/card-images/<filename>   (filename = a card's `image` field, e.g. BS76-001.png)

   The image filename is the wiki's `File:` name, so the URL is resolved through the
   MediaWiki imageinfo API, exactly like tools/import_fandom.py reads the wiki. The offline
   single-file game never imports this module; it only runs inside the online server.
   --------------------------------------------------------------------- */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';

const WIKI_API = 'https://battle-spirits.fandom.com/api.php';
const WIKI_ORIGIN = 'https://battle-spirits.fandom.com';
const USER_AGENT = 'AeternaCardArtSync/1.0 (unofficial fan project; read-only)';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const PREFIX = '/assets/card-images/';
// The wiki's CDN blocks hotlinks without a Referer header (403 otherwise). It also transcodes the
// "latest" revision to WebP regardless of the file extension, so the served type is sniffed from bytes.
const HEADERS = { 'user-agent': USER_AGENT, referer: WIKI_ORIGIN + '/' };

function sniffMime(buf, filename) {
  const ascii = (a, b) => buf.toString('ascii', a, b);
  if (buf.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 8 && buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  return MIME[extname(filename).toLowerCase()] || 'application/octet-stream';
}

/**
 * @param {{ mirrorDir: string, wikiApi?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} deps
 * @returns an async `(req, res, pathname) => Promise<boolean>` HTTP handler (true when it handled the path).
 */
export function cardImageRoute({ mirrorDir, wikiApi = WIKI_API, fetchImpl = globalThis.fetch, timeoutMs = 30_000 } = {}) {
  const dir = resolve(mirrorDir);
  const inflight = new Map();   // filename -> Promise<Buffer|null>, dedupes concurrent first requests

  async function resolveWikiUrl(filename) {
    const api = `${wikiApi}?action=query&titles=${encodeURIComponent('File:' + filename)}&prop=imageinfo&iiprop=url&format=json&formatversion=2`;
    const res = await fetchImpl(api, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data && data.query && Array.isArray(data.query.pages) ? data.query.pages[0] : null;
    const ii = page && Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
    return ii && typeof ii.url === 'string' ? ii.url : null;
  }

  async function download(filename) {
    const url = await resolveWikiUrl(filename);
    if (!url) return null;
    const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    mkdirSync(dir, { recursive: true, mode: 0o755 });
    const tmp = join(dir, `.${filename}.partial`);          // atomic write so a crash never leaves a half file
    writeFileSync(tmp, buf, { mode: 0o644 });
    renameSync(tmp, join(dir, filename));
    return buf;
  }

  async function getBytes(filename) {
    const target = join(dir, filename);
    if (existsSync(target)) return readFileSync(target);
    if (inflight.has(filename)) return inflight.get(filename);
    const p = download(filename).catch(() => null);
    inflight.set(filename, p);
    p.finally(() => { if (inflight.get(filename) === p) inflight.delete(filename); });
    return p;
  }

  return async function handler(req, res, pathname) {
    if (!pathname.startsWith(PREFIX)) return false;
    const m = (req.method || 'GET').toUpperCase();
    if (m !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
    let raw;
    try { raw = decodeURIComponent(pathname.slice(PREFIX.length)); }
    catch (e) { res.writeHead(400); res.end(); return true; }
    // Only a bare filename (no separators, no leading dot, with an extension) reaches the disk.
    if (!raw || raw !== basename(raw) || /[\\/]/.test(raw) || raw.startsWith('.') || !extname(raw)) {
      res.writeHead(404); res.end(); return true;
    }
    const bytes = await getBytes(raw);
    if (!bytes) { res.writeHead(404); res.end(); return true; }
    res.writeHead(200, {
      'Content-Type': sniffMime(bytes, raw),
      'Content-Length': bytes.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(bytes);
    return true;
  };
}
