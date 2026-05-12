# Self-Hosting

The self-hosted edition is for running AllChess on your own server and domain while keeping GitHub and Cloudflare in the release workflow.

## Included Services

- `app`: production Next.js standalone server.
- `postgres`: owned Postgres database for profiles, games, moves, ratings, and analysis records.
- `minio`: S3-compatible object storage for uploads, records, exports, and future media.
- `redis`: cache and future job queue support.

## Start Locally

```bash
copy .env.example .env
docker compose -f docker-compose.selfhost.yml up --build
```

Open `http://localhost:3000/en`.

## Domain Through Cloudflare

1. Put the domain on Cloudflare DNS.
2. Point an `A` or `CNAME` record to the server or load balancer.
3. Enable TLS, WAF managed rules, and DDoS protections.
4. Set `NEXT_PUBLIC_SITE_URL=https://your-domain.example` in `.env`.

## Database Migration Path

The app keeps Supabase and self-hosted Postgres schemas aligned through SQL migrations:

- Supabase production: `supabase/migrations`.
- Self-hosted Postgres: same migration folder mounted into Docker at first boot.
- Cloudflare D1: SQLite-compatible schema in `cloudflare/d1/migrations`.

For a mature migration from Supabase to owned Postgres:

1. Export Supabase data.
2. Restore into the self-hosted Postgres service.
3. Set `DATABASE_DRIVER=postgres`.
4. Set `DATABASE_URL` to the self-hosted Postgres connection string.
5. If deploying Cloudflare Workers in front of owned Postgres, create a Hyperdrive binding.

## Object Storage Migration Path

- Cloudflare-hosted: R2 bucket `allchess-objects`.
- Self-hosted: MinIO bucket `allchess-objects`.
- Vercel-hosted with Cloudflare storage: R2 through S3-compatible credentials.

Keep object keys stable across providers so records can move without rewriting database rows.
