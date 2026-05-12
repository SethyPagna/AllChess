# Cloudflare Deployment

AllChess supports Cloudflare as a first-class deployment target alongside GitHub, local development, and Vercel.

## Architecture

- Runtime: Cloudflare Workers through the OpenNext Cloudflare adapter.
- Static assets: Worker assets from `.open-next/assets`.
- Next incremental cache: R2 bucket `allchess-opennext-cache`.
- User objects: R2 bucket `allchess-objects`.
- Cloudflare-native SQL: D1 database `allchess-multiplayer`.
- Postgres path: Hyperdrive binding `HYPERDRIVE` for Supabase, Neon, or self-hosted Postgres.
- AI path: Workers AI binding `AI`, with OpenAI still supported through environment secrets.
- Domain path: custom domain route in `wrangler.jsonc`.

## One-Time Cloudflare Setup

```bash
npx wrangler login
npx wrangler r2 bucket create allchess-opennext-cache
npx wrangler r2 bucket create allchess-objects
npx wrangler r2 bucket create allchess-objects-preview
npx wrangler d1 create allchess-multiplayer
```

Copy the returned D1 database id into `wrangler.jsonc`.

For Postgres through Hyperdrive:

```bash
npx wrangler hyperdrive create allchess-postgres --connection-string "postgres://USER:PASSWORD@HOST:5432/DATABASE"
```

Copy the returned Hyperdrive id into `wrangler.jsonc`.

## Local Cloudflare Preview

```bash
npm run cf:build
npm run cf:preview
```

## Deploy to Cloudflare

```bash
npm run cf:deploy
```

## Domain

Replace `allchess.example.com` in `wrangler.jsonc` with the real domain, then make sure the domain is on Cloudflare DNS. Use Cloudflare dashboard rules for WAF, bot protection, and TLS mode.

## Secrets

Set secrets with Wrangler, never in Git:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Cloudflare resource bindings are declared in `wrangler.jsonc`; secret values stay in Cloudflare.
