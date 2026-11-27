# Vercel-first deployment boundary

## Decision

MONETRA's selected hosting platform is **Vercel**. A VPS is not required and
must not be purchased for this deployment. The Docker Compose setup remains an
optional self-hosting alternative only.

## Current state

The existing Vercel project builds the Vue/Vite frontend from the repository
root. The current branch is a preview/infrastructure migration; production has
not been promoted.

## Target Vercel topology

- Frontend: Vercel static deployment.
- HTTP API: Vercel Service running the existing Express backend container.
- Background jobs: Vercel Daemon running the existing BullMQ workers and
  recurring jobs in a separate process.
- PostgreSQL: managed PostgreSQL using `APPLICATION_DB_URL`.
- Redis: managed Redis using a TLS `APPLICATION_REDIS_URL`.
- Attachments: S3-compatible object storage (the existing adapter supports
  Cloudflare R2). Local filesystem fallback is rejected on Vercel to prevent
  loss of financial documents when containers are recycled.

The frontend calls same-origin `/api/v1`; Vercel rewrites `/api/*` to the
backend Service.

## Runtime roles

- `MONETRA_ROLE=api-service`: starts Express on Vercel's `PORT`; does not
  start persistent workers or recurring jobs.
- `MONETRA_ROLE=worker`: does not bind an HTTP port; starts BullMQ workers
  and recurring jobs through the dedicated worker entrypoint.
- Local development retains the existing combined behavior.

The API and worker use the same Docker image. Startup migrations are serialized
with a PostgreSQL advisory lock so concurrent containers cannot race the
Sequelize migration table.

## Vercel plan and cost gate

The current project is on the Hobby tier; a Pro-only project-setting operation
was rejected by Vercel. Vercel's Daemon configuration requires at least
`1Gi` of memory per instance. One continuously running 1Gi daemon represents
about 720 GB-hours in a 30-day month, above Hobby's 420 GB-hour Daemon allowance.
Hobby also includes 5 Daemon active-CPU hours and cannot purchase additional
usage.

Vercel Pro is listed at US$20/month and includes US$20 in usage credit. At the
published Daemon rate of US$0.0212/GB-hour, 720 GB-hours is about US$15.26,
before active CPU and other project usage. This is an estimate, not a guaranteed
bill. No plan upgrade has been made. Before production, either approve the Pro
plan/usage budget or replace the always-on BullMQ Daemon with a request-driven
Vercel Queues/Workflows design.

## External services and environment

The Vercel project currently has no managed PostgreSQL or Redis integration
connected. Production and Preview need separate database/Redis resources and
server-side variables:

- `APPLICATION_DB_URL`: pooled PostgreSQL URL with SSL.
- `APPLICATION_REDIS_URL`: TLS Redis URL.
- `ATTACHMENTS_S3_BUCKET`, `ATTACHMENTS_S3_ENDPOINT`,
  `ATTACHMENTS_S3_ACCESS_KEY_ID`, `ATTACHMENTS_S3_SECRET_ACCESS_KEY`.
- `AUTH_ORIGIN`, `BETTER_AUTH_URL`, `ALLOWED_ORIGINS`.
- `BETTER_AUTH_SECRET`, `APPLICATION_JWT_SECRET`,
  `APP_SESSION_ID_SECRET`: independent generated secrets.

Never commit secrets or put server credentials in browser-exposed `VITE_*`
variables.

## Remaining release gates

1. Connect managed PostgreSQL and Redis providers; confirm pooled connection
   limits, TLS and region.
2. Configure an S3-compatible bucket and verify attachment upload/download,
   authorization and orphan cleanup.
3. Configure Better Auth origins, secure cookies, OAuth callbacks and secrets.
4. Confirm Vercel Service and Daemon builds, startup and runtime behavior.
5. Run migrations, backup/restore, authentication, queue, recurring-job and
   financial end-to-end tests against the managed services.
6. Triage dependency audit findings and require green CI.
7. Confirm the Vercel plan and usage budget before enabling the production
   Daemon.

A successful frontend or container build alone is not evidence that the full
finance system is production-ready.
