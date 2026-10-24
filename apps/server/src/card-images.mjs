/* ---------------------------------------------------------------------
   CARD IMAGE MIRROR (v0.112.0, official source v0.114.0)

   Serves official Battle Spirits card art from a local mirror directory, proxying the official
   battlespirits.com card database on demand (the first request for a card pays one upstream fetch).
   The mirror dir is a git-ignored build artifact; a card the official site lacks is a 404 and the
   client falls back to its text/colour placeholder.

   Route: GET /assets/card-images/<card-id>   (card-id = a card's `id`, e.g. BS76-001)

   The official image URL is derived directly from the card id:
       https://www.battlespirits.com/images/cardlist/<card-id>.webp?v2   (WebP, uniform size)
   The offline single-file game never imports this module; it only runs inside the online server.
   --------------------------------------------------------------------- */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OFFICIAL_IMG = 'https://www.battlespirits.com/images/cardlist/';
const USER_AGENT = 'AeternaCardArtSync/1.0 (unofficial fan project; read-only)';
const PREFIX = '/assets/card-images/';

/**
 * @param {{ mirrorDir: string, officialImg?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} deps
 * @returns an async `(req, res, pathname) => Promise<boolean>` HTTP handler (true when it handled the path).
 */
export function cardImageRoute({ mirrorDir, officialImg = OFFICIAL_IMG, fetchImpl = globalThis.fetch, timeoutMs = 30_000 } = {}) {
  const dir = resolve(mirrorDir);
  const inflight = new Map();   // card id -> Promise<Buffer|null>, dedupes concurrent first requests

  async function download(id) {
    const res = await fetchImpl(`${officialImg}${id}.webp?v2`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    mkdirSync(dir, { recursive: true, mode: 0o755 });
    const tmp = join(dir, `.${id}.webp.partial`);          // atomic write so a crash never leaves a half file
    writeFileSync(tmp, buf, { mode: 0o644 });
    renameSync(tmp, join(dir, `${id}.webp`));
    return buf;
  }

  async function getBytes(id) {
    const target = join(dir, `${id}.webp`);
    if (existsSync(target)) return readFileSync(target);
    if (inflight.has(id)) return inflight.get(id);
    const p = download(id).catch(() => null);
    inflight.set(id, p);
    p.finally(() => { if (inflight.get(id) === p) inflight.delete(id); });
    return p;
  }

  return async function handler(req, res, pathname) {
    if (!pathname.startsWith(PREFIX)) return false;
    const m = (req.method || 'GET').toUpperCase();
    if (m !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
    let raw;
    try { raw = decodeURIComponent(pathname.slice(PREFIX.length)); }
    catch (e) { res.writeHead(400); res.end(); return true; }
    // Card ids are letters/digits/hyphens; anything else (separators, leading dot, an extension) is refused.
    if (!raw || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(raw)) {
      res.writeHead(404); res.end(); return true;
    }
    const bytes = await getBytes(raw);
    if (!bytes) { res.writeHead(404); res.end(); return true; }
    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Content-Length': bytes.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(bytes);
    return true;
  };
}
