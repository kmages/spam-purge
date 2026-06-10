# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Self-hosting (own VM, e.g. Hetzner)

The app runs as a **single Node process** outside Replit. The Express server
(`@workspace/api-server`) serves both the API (`/api/*`) and the built frontend when
`SERVE_STATIC=true`. An always-on VM is what the auto-purge scheduler needs (the
scheduler is an in-process timer that only runs when `NODE_ENV=production`, so it stops
on any host that sleeps when idle).

### One-command install (recommended)

On a fresh Ubuntu 22.04/24.04 VM (e.g. Hetzner), as root:

```bash
apt update && apt install -y git
git clone <YOUR-REPO-URL> /opt/spam-purge
cd /opt/spam-purge
sudo ./deploy/setup.sh
```

`deploy/setup.sh` prompts for the domain + Google OAuth client ID/secret, then installs
Node 24, PostgreSQL, and Caddy; creates the database; generates `SESSION_SECRET` and the
DB password; writes `/etc/spam-purge.env`; builds the app; installs the always-on
`spam-purge` systemd service; and configures Caddy for automatic HTTPS. Re-running it is
safe (reuses existing config + database). Update later with
`cd /opt/spam-purge && git pull && sudo ./deploy/setup.sh`.

Two manual finishing steps the script prints: point the domain's DNS A record at the VM,
and add `https://<your-domain>/api/auth/google/callback` to the Google OAuth client.

### Manual build + run (if you don't use the installer)

```bash
pnpm install
# push DB schema to the VM's Postgres (DATABASE_URL must be set)
pnpm --filter @workspace/db run push
# build frontend (build needs PORT + BASE_PATH even though only BASE_PATH matters at build time)
PORT=8080 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/spam-purge run build
# build backend bundle
pnpm --filter @workspace/api-server run build
# run (one process serves SPA + API)
SERVE_STATIC=true NODE_ENV=production PORT=8080 \
  node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Required env on the VM: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_OAUTH_CID` +
`GOOGLE_OAUTH_CSEC` (OAuth fallback chain still applies), `NODE_ENV=production`,
`PORT`, `SERVE_STATIC=true`. Optional `STATIC_DIR` overrides the frontend dir
(default `artifacts/spam-purge/dist/public` relative to cwd).

- Put it behind a TLS-terminating reverse proxy (Caddy/nginx). `app.set("trust proxy", 1)`
  is already set, and the session cookie is `secure` in production, so HTTPS is required.
- Register the VM callback `https://<your-domain>/api/auth/google/callback` in the Google
  Cloud OAuth client (in addition to / instead of the Replit URIs).
- Sessions use in-memory `MemoryStore` → logins are lost on restart (auto-purge is
  unaffected, since the scheduler uses the DB-stored refresh token). Switch to
  `connect-pg-simple` if persistent logins across restarts are wanted.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

SPAM Purge — a single-user personal tool (for kmages@gmail.com) that connects Gmail
via Google OAuth and permanently deletes all spam messages (using the Gmail API's
`batchDelete`, which bypasses the 30-day trash delay). Dark black theme with a vivid
teal/green accent. Connect page at `/`, dashboard with spam count, one-click purge, and
purge history at `/dashboard`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Google OAuth credentials are read with a fallback chain: `GOOGLE_OAUTH_CID`/`GOOGLE_OAUTH_CSEC`
  (preferred, set as shared env vars) → `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` → `GOOGLE_CLIENT_ID`/`SECRET`.
  This exists because updating the original secrets kept persisting the stale value.
- Register both the dev (`*.spock.replit.dev`) and prod (`*.replit.app`) callback URIs
  (`/api/auth/google/callback`) in the Google Cloud OAuth client, or sign-in fails with
  `redirect_uri_mismatch`.
- Production only picks up new secrets/env/code after a **Republish**.
- `app.set("trust proxy", 1)` is required for the secure session cookie to work behind Replit's proxy.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
