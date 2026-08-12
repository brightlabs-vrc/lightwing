# The URS Competitive Portal (Project Lightwing)

The URS Competitive Portal is a full-stack application to facilitate the management of competitive events, including registration, scheduling, and results tracking. What normally would be a tonload of google sheets and forms is now in one place~

Lightwing is built with the following technologies:

- Backend: [Encore](https://encore.dev/) (TypeScript + Rust)
- Frontend: [Next.js 16](https://nextjs.org/) (TypeScript + React) with [TanStack Query](https://tanstack.com/) for data fetching and caching
- Database: [PostgreSQL](https://www.postgresql.org/), with [Prisma](https://www.prisma.io/) as the ORM, completely managed by Encore

## Development

Run backend + frontend together:

```bash
pnpm dev:backend    # Start Encore backend on port 4000
pnpm dev:frontend   # Start Next.js dev server on port 3000
```

Or run them separately in different terminals.

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

Auth endpoints (`/api/auth/*`) are reverse-proxied from the Next.js frontend to the Encore API. This makes session cookies first-party (SameSite=Lax) so they work reliably under Safari ITP and third-party cookie restrictions.

- **Local dev**: Next.js rewrites `/api/auth/*` → local Encore (`http://localhost:4000`)
- **Production**: Deploy the Next.js app to your preferred hosting (Vercel, Deno Deploy, etc.). The rewrites are built into the app.

### Running the Next.js frontend locally

```bash
# 1. Start the Encore backend (in one terminal)
cd lightwing
pnpm dev:backend

# 2. Start the Next.js frontend (in another terminal)
cd lightwing/frontend-next
pnpm dev
```

The frontend will be available at `http://localhost:3000`.

### Deploying the Next.js frontend

The Next.js app can be deployed to any platform that supports Next.js:

**Vercel** (recommended):
1. Connect your GitHub repository to Vercel
2. Set the framework preset to "Next.js"
3. Set environment variable `ENCORE_API_BASE_URL` to your production Encore API URL
4. Deploy

**Deno Deploy** (alternative):
1. Build the frontend: `cd frontend-next && pnpm build`
2. Upload the `.next/` directory and `frontend-next/` to Deno Deploy
3. Set the environment variable `ENCORE_API_BASE_URL` to the production Encore API origin
4. Set the entrypoint to `frontend-next/server.js` (or use the Next.js adapter)

The auth proxy is defined in `frontend-next/next.config.ts`. Required env var: `ENCORE_API_BASE_URL`.

### Session invalidation on auth surface changes 
