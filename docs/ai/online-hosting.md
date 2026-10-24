# Online hosting (Cloudflare)

Owner decision 2026-10-24: host on Cloudflare — Pages for the static single-file game, Workers + Durable Objects + D1 for the online server later. The card-images feature is no longer gated off until v1.0.

## Static game (now)

`index.html` is a self-contained single file (~1.8 MB, no external scripts or styles). `.github/workflows/deploy-pages.yml` uploads it to Cloudflare Pages after a green CI on `main`, or by hand with "Run workflow".

Owner setup (once):

1. Sign up at cloudflare.com (free plan, no credit card).
2. Create an API token: My Profile > API Tokens > Create Token > **Create Custom Token** > Permissions **Account** > **Cloudflare Pages** > **Edit** > Continue to summary > Create Token. Copy the token.
3. Find your account id: dashboard (right sidebar, **API** section) or the Workers & Pages page.
4. Add two GitHub secrets (repo Settings > Secrets and variables > Actions > New repository secret):
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account id
5. Run "Deploy Pages" once (Actions > Deploy Pages > Run workflow). The first run creates the Pages project `aeterna-experiment` automatically. The game goes live at `aeterna-experiment.pages.dev`; attach a custom domain in the Pages project when wanted.

## Online server (M8, later)

`apps/server` is Node + WebSocket + Postgres today. On Cloudflare the free path is a port to Workers + Durable Objects (WebSocket rooms via the Hibernation API) + D1 (SQLite), or keep Postgres through Hyperdrive to Neon. The persistence layer is decided in the M8 porting session; no deploy until the owner connects the account.

## Card images

The "feature off until v1.0" gate is removed (owner 2026-10-24). Card images stay player-supplied and on-device (IndexedDB); putting card images on a public server remains an owner decision before any deploy (`docs/ai/monorepo-plan.md`).
