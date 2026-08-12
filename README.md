# The URS Competitive Portal (Project Lightwing)

The URS Competitive Portal is a full-stack application to facilitate the management of competitive events, including registration, scheduling, and results tracking. What normally would be a tonload of google sheets and forms is now in one place~

Lightwing is built with the following technologies:

- Backend: [Encore](https://encore.dev/) (TypeScript + Rust)
- Frontend: [Vite](https://vitejs.dev/) (TypeScript + React) with [TanStack Query](https://tanstack.com/) for facilitating file-based routing, data fetching, and caching.
- Database: [PostgreSQL](https://www.postgresql.org/), with [Prisma](https://www.prisma.io/) as the ORM, completely managed by Encore.

## Development

Run backend + frontend together:

```bash
pnpm dev
```

This starts:
- Encore backend (`encore run`)
- Frontend Vite dev server on port `5173`

You can still run each side independently:

```bash
pnpm dev:backend
pnpm dev:frontend
```

### Setting application secrets

Because this application works with OIDC, you will need to set secrets for the authentication provider. You will need the following secrets set for the backend to work properly:

- `BETTER_AUTH_SECRET`: Authentication secret for the BetterAuth OIDC provider. You can generate a random secret using `openssl rand -base64 32`.
- `DISCORD_AUTH_CLIENT_ID`: The client ID of the OIDC application.
- `DISCORD_AUTH_CLIENT_SECRET`: The client secret of the OIDC application.
- `DISCORD_BOT_TOKEN`: The bot token of the Discord bot that will be used by Encore to check for roles automatically. This bot must be added to the server with the `View Channels` and `Read Messages` permissions.

### Working with the database

As we use Prisma, you can use the Prisma CLI to manage the database. For example, to apply migrations:

```bash
pnpm prisma migrate dev
```
To access the Studio UI for the database, run:

```bash
pnpm prisma studio
```

Keep in mind you will need to expose Encore's database connection string to Prisma for Prisma to be able to connect to the database.

### Reverse proxy for auth endpoints

Auth endpoints (`/api/auth/*`) are reverse-proxied from the frontend host to the
Encore API. This makes session cookies first-party (SameSite=Lax) so they work
reliably under Safari ITP and third-party cookie restrictions.

- **Local dev**: Vite proxies `/api/auth` → local Encore (`http://localhost:4000`)
- **Production**: Deno Deploy runs `frontend/deploy/deno/main.ts` which serves the
  built SPA and forwards `/api/auth/*` to the Encore API, passing through
  `Set-Cookie` unchanged.

### Running the Deno Deploy server locally

The Deno Deploy server can be run locally for testing the same proxy path that
will be used in production:

```bash
# 1. Build the frontend
pnpm frontend:build

# 2. Start Encore backend (in another terminal)
pnpm dev:backend

# 3. Start the Deno Deploy server
export ENCORE_API_BASE_URL="http://127.0.0.1:4000"
export FRONTEND_DIST_DIR="frontend/dist"
deno run --allow-read --allow-net --allow-env frontend/deploy/deno/main.ts
```

The server listens on port `8000` by default (or `PORT` env var). It will:
- Serve the built SPA from `FRONTEND_DIST_DIR` (default `frontend/dist`)
- Proxy `/api/auth/*` requests to `ENCORE_API_BASE_URL`
- Return 404 for any request outside those paths

### Deploying to Deno Deploy

1. Build the frontend: `pnpm frontend:build`
2. Upload `frontend/dist/` and `frontend/deploy/deno/` to Deno Deploy
3. Set the environment variable `ENCORE_API_BASE_URL` to the production Encore
   API origin (e.g. `https://your-app.encr.app`)
4. Set the entry point to `frontend/deploy/deno/main.ts`

The `FRONTEND_DIST_DIR` env var can be set to point at the uploaded dist
directory if it differs from the default `../frontend/dist` relative to the
entrypoint.

The proxy is defined in `frontend/deploy/deno/api-proxy.ts`. Required env var:
`ENCORE_API_BASE_URL`.

### Session invalidation on auth surface changes 
