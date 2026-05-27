# Self-Hosting

The self-hosted edition runs the AllChess app container on your own server while keeping Cloudflare as the managed database, object storage, DNS, and security layer.

## Included Service

- `app`: production Next.js standalone server.

Cloudflare D1 and R2 remain the source of truth, so no Supabase, Postgres, MinIO, or Redis services are required for the supported self-host path.

## Start Locally

```bash
cp config/env/.env.example .env
docker compose -f infra/docker/docker-compose.selfhost.yml up --build
```

Open `http://localhost:3000/en`.

## Required Environment

Set these in `.env`, your server environment, or a secret manager:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_API_TOKEN=
R2_PUBLIC_BASE_URL=
SESSION_SECRET=
```

The Cloudflare token should be least-privilege for the `allchess` D1 database and R2 buckets.

## Domain Through Cloudflare

1. Put the domain on Cloudflare DNS.
2. Point an `A` or `CNAME` record to the server or load balancer.
3. Enable TLS, WAF managed rules, and DDoS protections.
4. Set `NEXT_PUBLIC_SITE_URL=https://your-domain.example`.

## Data Boundaries

AllChess uses separate resources from LEARN and edsync:

- D1: `allchess`
- R2: `allchess-objects`, `allchess-objects-preview`
- OpenNext cache: `allchess-opennext-cache`
