# Vercel-first deployment boundary

## Decision

MONETRA's target hosting platform is **Vercel**. A VPS is not a prerequisite and
must not be treated as the selected deployment architecture. The self-hosting
Docker files remain an optional alternative only.

## Current deployment

The Vercel project currently builds the Vue/Vite frontend from the repository
root:

- Install: `npm install --include=dev`
- Build: `npm run build --workspace=packages/frontend`
- Output: `packages/frontend/dist`
- Node.js: 24.x

The preview previously published from `infra/production-readiness` is a
frontend preview. The backend migration is in progress and production is not
approved.

## Vercel application topology

- Frontend: Vercel static deployment.
- HTTP API: Vercel Node.js Functions, using the existing Express router.
- PostgreSQL: managed PostgreSQL with a pooled connection URL.
- Redis: managed Redis with a TLS connection URL, only where required by
  sessions, rate limits, and existing application services.
- Scheduled work: Vercel Cron or a managed queue/worker service. Persistent
  workers must not start inside request-scoped functions.
- Attachments: object storage (Vercel Blob or S3-compatible storage), not a
  local function filesystem.

## Serverless compatibility work

The API entry point is `api/[...path].ts`. The Express app must not bind a
port or start persistent workers when `VERCEL=1`. Database connection pools
must be small because each warm function instance can own its own pool.

The following are still release blockers and must be adapted and tested before
production:

1. Replace the local HTTP self-proxy used by the OAuth dynamic-client
   registration compatibility patch; serverless functions do not own a
   localhost listener.
2. Move BullMQ workers and all recurring jobs out of the request lifecycle.
   Preserve every job's schedule and retry semantics using Vercel Cron plus a
   managed queue/worker runtime where execution can exceed a function request.
3. Verify Redis provider compatibility, TLS, credentials, connection reuse,
   and failure behavior.
4. Migrate attachment uploads/downloads to object storage and verify signed
   URLs, size limits, and authorization.
5. Verify all routes against Vercel function duration, body-size, streaming,
   and request/response constraints. Large imports may require direct object
   storage uploads.
6. Configure pooled PostgreSQL connection strings, SSL, migrations, and
   backup/restore procedures.
7. Configure Better Auth public URL, trusted origins, CORS, secure cookies,
   OAuth callbacks, and secrets.
8. Run financial and auth integration tests against the managed services.

## Environment contract

Vercel Preview and Production will need server-side variables (never
`VITE_*` for secrets):

- `APPLICATION_DB_URL`: pooled PostgreSQL URL, with SSL enabled by provider.
- `APPLICATION_REDIS_URL`: TLS Redis URL.
- `AUTH_ORIGIN`: public frontend origin.
- `BETTER_AUTH_URL`: public API origin (or same-origin API base, depending on
  the final routing setup).
- `BETTER_AUTH_SECRET`, `APPLICATION_JWT_SECRET`,
  `APP_SESSION_ID_SECRET`: independent generated secrets.
- `ALLOWED_ORIGINS`: exact browser origins.
- Object-storage credentials and any optional integration secrets.

Never commit secrets or put server credentials in browser-exposed variables.

## Release gates

Do not promote to Production until CI passes, the Vercel API function responds,
authentication works over HTTPS, migrations and backup/restore are verified,
all recurring work and attachment storage are operational, and financial
end-to-end tests pass. A successful frontend build alone is not a production
readiness signal.
