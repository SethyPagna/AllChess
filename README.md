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

Secrets must stay in Vercel, GitHub secrets, Supabase, or local ignored `.env` files. Never commit real API keys.
