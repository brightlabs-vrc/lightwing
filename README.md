# The URS Competitive Portal (Project Lightwing)

The URS Competitive Portal is a full-stack application to facilitate the management of competitive events, including registration, scheduling, and results tracking. What normally would be a tonload of google sheets and forms is now in one place~

Lightwing is built with the following technologies:

- Backend: [Encore](https://encore.dev/) (Go)
- Frontend: [Vite](https://vitejs.dev/) (TypeScript + React) with [TanStack Query](https://tanstack.com/) for file-based routing, data fetching, and caching.
- Database: [PostgreSQL](https://www.postgresql.org/), with raw SQL migrations in `shared/migrations/`, completely managed by Encore.

## Layout

- `auth/` — Discord OAuth sign-in, sessions, users, RBAC (site roles, org roles, event admins).
- `eventmanager/` — events, race events, members, results, scoring (points/ladder), classes, datasets.
- `scorecalc/` + `scorecalcworker/` — async points recomputation coordinator and worker (Pub/Sub).
- `teammanager/` — teams (organizations), members, stats.
- `shared/` — shared PostgreSQL database (migrations live here) and cache cluster.
- `frontend/` — standalone Vite SPA (separate origin; talks to the backend over HTTP).
- `ts-legacy/` — the original Encore.ts backend + Prisma schema, kept for reference. Ported tests live in the Go services; do not add new code here.

## Development

Run the backend:

```bash
encore run
```

Run the frontend (separate terminal):

```bash
cd frontend && pnpm install && pnpm dev
```

This starts the Vite dev server on port `5173`. The frontend targets the local backend by default; point it elsewhere with:

```bash
VITE_API_BASE_URL=https://<env>-lightwing2-uxgi.encr.app pnpm dev
```

Frontend-only UI work without a backend:

```bash
cd frontend && pnpm dev:mock
```

### Local sign-in without Discord

Discord OAuth does not work on localhost. For local end-to-end testing, set:

```bash
LIGHTWING_DEBUG_LOGIN=1
```

With it set, the browser sign-in endpoint provisions a fixed `SITE_ADMIN` debug user, sets the normal session cookie, and returns you to the app — same cookie auth as a real login, no provider round-trip. Never set this in production.

```bash
LIGHTWING_FRONTEND_URL=http://localhost:5173
```

overrides the post-login redirect base (defaults to `http://localhost:3000`).

### Setting application secrets

Because this application works with OIDC, you will need the following secrets set for the backend to work properly:

- `DISCORD_AUTH_CLIENT_ID`: the client ID of the Discord OIDC application.
- `DISCORD_AUTH_CLIENT_SECRET`: the client secret of the Discord OIDC application.
- `DISCORD_BOT_TOKEN`: the bot token Encore uses to check server roles automatically. This bot must be added to the server with the `View Channels` and `Read Messages` permissions.
- `SESSION_COOKIE_SECRET`: signs the session cookie (only the better-auth-compatible cookie routes use it; empty in local dev yields a dev-only key).

Set them in the dashboard (Settings → Secrets) or via `encore secret set --env <env> <name>` —
the Go backend reads them through Encore's secrets facility (`var secrets` in
`auth/service.go`; field names must match secret names exactly). Plain
environment variables with the same names also work as a fallback (self-hosted
Docker runs outside Encore's secret injection). For local runs, set
`--type local` values once (synced automatically) or export the same names as
environment variables. You can generate a secret with `openssl rand -base64 32`.

### Working with the database

Migrations are plain SQL in `shared/migrations/` and apply automatically on `encore run` (Docker must be running). To open a shell:

```bash
encore db shell lightwing
```

## Testing

Backend (all services):

```bash
encore test ./...
```

Frontend:

```bash
cd frontend && pnpm vitest run && pnpm typecheck && pnpm build
```

The generated API client (`frontend/src/lib/client.ts`) is produced from the Go backend — regenerate it after changing endpoints:

```bash
encore gen client --lang typescript --output frontend/src/lib/client.ts
```

## Deployment

The backend also serves the frontend: `frontendserve` embeds the compiled SPA
(`frontendserve/dist`) at a root fallback route, so the deployed app is
same-origin (no CORS needed). Encore Cloud does not run frontend builds, so
rebuild and commit `dist/` before pushing:

```bash
cd frontend && pnpm build:encore && cd .. && git add frontendserve/dist
```

(Built without `VITE_API_BASE_URL`, the SPA calls same-origin APIs.)

See the [self-hosting instructions](https://encore.dev/docs/go/self-host/docker-build) for `encore build docker`, or push to Encore Cloud with `git push encore`.
