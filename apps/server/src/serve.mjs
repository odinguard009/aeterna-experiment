/* ---------------------------------------------------------------------
   SERVER ENTRY (roadmap M7 step 7): one process that wires the whole server - the store (Postgres when
   DATABASE_URL is set, the in-memory reference otherwise), the accounts service, the HTTP API and the
   WebSocket room server. This is what the server image (apps/server/Dockerfile) runs and what a future
   M8 client talks to; nothing here touches the offline single file.

   Dependencies are loaded only where they are used: `pg` only when DATABASE_URL is set, `ws` only in
   startServer (run.mjs), and the offline game never imports this file. No deploy is implied - hosting,
   a domain and the email sender stay the owner's decision (docs/ai/monorepo-plan.md).

   Usage:
     node apps/server/src/serve.mjs                        # memory store, ws on PORT+1
     DATABASE_URL=postgres://... node apps/server/src/serve.mjs
     DISCORD_CLIENT_ID=.. DISCORD_CLIENT_SECRET=.. DISCORD_REDIRECT_URI=.. node apps/server/src/serve.mjs
   --------------------------------------------------------------------- */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApi } from './http.mjs';
import { startServer } from './run.mjs';
import { memoryStore } from './store.mjs';
import { accounts } from './accounts.mjs';
import { discordOAuth } from './oauth-discord.mjs';

// M8 online client: the server serves the built single file (the repo root index.html) at /, so `node
// apps/server/src/serve.mjs` alone is enough to open the online client in a browser. Absent (not built), the
// API still answers JSON at / and the ws server still runs; the offline file is untouched either way.
const CLIENT_HTML = (() => {
  try {
    const path = fileURLToPath(new URL('../../../index.html', import.meta.url));
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch (e) { return null; }
})();

export async function serve({
  port = Number(process.env.PORT) || 8080,
  wsPort = (Number(process.env.WS_PORT) || Number(process.env.PORT) || 8080) + 1,
  databaseUrl = process.env.DATABASE_URL || null,
  origin = process.env.ORIGIN || `http://localhost:${port}`,
  mailer = null,
  discord = null,
} = {}) {
  const port0 = Number(port) || 0;
  const origin0 = origin.replace(/\/+$/, '');
  let store;
  if (databaseUrl) {
    const { pgStore } = await import('./store-pg.mjs');
    store = await pgStore({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === '1' });
  } else {
    store = memoryStore();
  }
  const svc = accounts({ store, origin: origin0, mailer, secure: origin0.startsWith('https://') });
  // A Discord provider exists only when the deployment configured it; the routes answer 501 otherwise.
  const discordProvider = discord || (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    ? discordOAuth({
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI || `${origin0}/api/login/discord/callback`,
      })
    : null);
  // M8: the ws server starts first so its endpoint (ws.url) is told to the client through /api/config.
  const ws = await startServer({ port: Number(wsPort) || 0, store, accounts: svc });
  const api = createApi({ accounts: svc, store, origin: origin0, mailer, discord: discordProvider, staticHtml: CLIENT_HTML, wsUrl: ws.url });
  await new Promise((res, rej) => { api.once('error', rej); api.listen(port0, '0.0.0.0', res); });
  const close = async () => {
    await ws.close();
    await new Promise(res => api.close(res));
    if (store.close) await store.close();
  };
  return { store, svc, api, ws, httpPort: api.address().port, wsPort: ws.port, close };
}

// Run directly: `node apps/server/src/serve.mjs`.
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  serve().then(({ httpPort, wsPort }) => console.log(`[serve] http :${httpPort} ws :${wsPort}`)).catch(e => { console.error('[serve] ' + (e && e.message)); process.exit(1); });
}
