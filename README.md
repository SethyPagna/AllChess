# AllChess Multiplayer

AllChess Multiplayer is a production-focused, multilingual chess platform rebuilt from the original terminal Jungle Chess project.

The legacy Python implementation is preserved in `legacy/python-jungle-chess` for reference while the active application is a Next.js app designed for Vercel, Supabase, realtime multiplayer, AI analysis, and future self-hosted Postgres deployments.

## Status

The active app is a Next.js 16 production build with:

- 19 launch locales with reusable dictionaries and chess vocabulary fallback.
- Light, dark, and system theme modes.
- A premium game hub, lobby, variant atlas, profiles, history, analysis, and playable board surfaces.
- Supabase schema, RLS policies, realtime-ready tables, and local Docker Postgres/Redis.
- Vercel-ready scripts and config.
- Cloudflare Workers/OpenNext, R2, D1, Workers AI, Hyperdrive, and custom-domain deployment config.
- Fully self-hosted Docker profile with app, Postgres, MinIO object storage, and Redis.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/en`.

## Verify

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Deploy

Set the values from `.env.example` in Vercel, especially Supabase and AI keys, then run:

```bash
npm run deploy:preview
npm run deploy:prod
```

Cloudflare deployment:

```bash
npm run cf:build
npm run cf:deploy
```

Self-hosted deployment:

```bash
docker compose -f docker-compose.selfhost.yml up --build
```

Secrets must stay in Vercel, GitHub secrets, Supabase, or local ignored `.env` files. Never commit real API keys.

See `docs/cloudflare-deployment.md` and `docs/self-hosting.md` for the Cloudflare, domain, database, and object-storage paths.
