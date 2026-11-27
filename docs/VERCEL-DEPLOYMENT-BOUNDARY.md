# Vercel deployment boundary

## Current deployment

The Vercel project is configured to build the Vue/Vite frontend from the
repository root:

- Install: `npm install --include=dev`
- Build: `npm run build --workspace=packages/frontend`
- Output: `packages/frontend/dist`
- Node.js: 24.x

This produces a **frontend-only preview**. It does not deploy the Express API,
PostgreSQL, Redis/BullMQ workers, currency-rates sidecar, or persistent
attachment storage.

The frontend's runtime config reads `window.__APP_CONFIG__.API_HTTP` first,
then `VITE_APP_API_HTTP`. When both are empty, the browser uses same-origin
`/api/v1`. A static Vercel deployment has no API at that path, so login and
data operations are not functional until a backend is deployed and connected.

## Required production topology

Use Vercel for the static frontend and a persistent container host for the
backend stack. The supported self-host Compose topology is documented in
`self-hosting/docker-compose.yml` and includes:

- Express backend
- PostgreSQL 16
- Redis 7 (BullMQ and background jobs)
- currency-rates API sidecar
- frontend runtime proxy and persistent attachment volume

Do not deploy the backend as a simple Vercel Function without first redesigning
the persistent workers, cron jobs, Redis connections, migrations, and storage.

## Values to configure after choosing the backend host

### Vercel project

Set these for Preview and Production only after the backend HTTPS origin is
available:

| Variable | Value |
| --- | --- |
| `VITE_APP_API_HTTP` | Public HTTPS origin of the backend, e.g. `https://api.example.com` |
| `VITE_APP_API_VER` | `/api/v1` |

If the backend is exposed through the same origin using a supported reverse
proxy, leave `VITE_APP_API_HTTP` empty and configure the proxy to forward
`/api` to the backend. The current static Vercel project does not provide that
proxy by itself.

### Backend host

Generate independent random secrets (never reuse the example values) for:

- `APPLICATION_JWT_SECRET`
- `APP_SESSION_ID_SECRET`
- `BETTER_AUTH_SECRET`

Set these required database and runtime values from the selected host:

- `NODE_ENV=production`
- `APPLICATION_HOST=0.0.0.0`
- `APPLICATION_PORT=8081`
- `APPLICATION_DB_HOST`, `APPLICATION_DB_PORT`,
  `APPLICATION_DB_USERNAME`, `APPLICATION_DB_PASSWORD`,
  `APPLICATION_DB_DATABASE`, `APPLICATION_DB_DIALECT=postgres`
- `APPLICATION_REDIS_HOST`
- `BETTER_AUTH_URL` and `AUTH_ORIGIN` to the public frontend origin
- `ALLOWED_ORIGINS` to the exact frontend origin(s)

Keep database and Redis private to the application network. Persist PostgreSQL,
Redis data where required, and transaction attachments; use the documented S3
compatible attachment configuration when local persistent volumes are not
available.

Optional integrations (Google/GitHub OAuth, Resend, AI providers, market-data
providers, Stripe, observability) must only be enabled after their credentials
and callback URLs are configured. Never put server secrets in `VITE_*`
variables or commit them to Git.

## Release gates

Do not promote this frontend preview to Production until all of the following
are true:

1. A persistent backend host and public HTTPS API origin exist.
2. PostgreSQL migrations have run and a backup/restore test has passed.
3. Redis, background workers, cron jobs, and attachment persistence are healthy.
4. Better Auth callback/origin, CORS, and cookie behavior have been tested over
   HTTPS on the real domain.
5. Frontend API calls, sign-in, financial writes, and logout have passed smoke
   tests against the deployed backend.
6. Financial E2E, frontend tests, typechecks, lint, and production build have
   passed in CI.
7. Dependency audit findings have been triaged and accepted or fixed.

The Vercel frontend build alone is not evidence that the complete application
is production-ready.
