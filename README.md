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
