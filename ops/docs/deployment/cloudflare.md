# Cloudflare Deployment

AllChess is Cloudflare-first. Supabase, Hyperdrive, Vercel databases, and Vercel object storage are not part of the runtime plan.

## Architecture

- Runtime: Cloudflare Workers through the OpenNext Cloudflare adapter, configured as Worker `allchess`.
- Database: D1 database `allchess`.
- User objects: R2 bucket `allchess-objects`.
- Preview objects: R2 bucket `allchess-objects-preview`.
- Next incremental cache: R2 bucket `allchess-opennext-cache`.
- Realtime: Durable Objects `GameRoomDO`, `MatchmakingDO`, and `PresenceDO`.
- AI: Workers AI binding `AI`, with optional Groq, Mistral, Cerebras, Google AI, or OpenAI secrets for deeper review.
- Other products: edsync must use separate Cloudflare resources.

Both Wrangler configurations set `assets.html_handling` to `none`. Keep `/offline` routed to the Next app and `/offline.html` served as the separate reconnect fallback. Cloudflare's default clean-URL behavior otherwise serves the fallback at `/offline`, causing offline-pack integrity verification to reject the wrong shell. A Miniflare routing regression covers both configurations and the default-setting failure.

## One-Time Setup

```bash
npx wrangler login
npx wrangler r2 bucket create allchess-opennext-cache
npx wrangler r2 bucket create allchess-objects
npx wrangler r2 bucket create allchess-objects-preview
npx wrangler d1 create allchess
npm run db:migrate:remote
```

Copy the D1 database id into `ops/infra/cloudflare/wrangler.jsonc` and set the same value as `CLOUDFLARE_D1_DATABASE_ID` anywhere the app runs outside Workers.
Use the configured Worker named `allchess` in the account identified by the Wrangler configuration. Redeploy that target instead of creating a duplicate. A custom hostname is independent of the Worker name.

## Secrets

Use Wrangler or GitHub secrets. Never commit tokens.
Environment variables and secrets are allowed when they are actually needed for deploy, persistence, auth, OAuth, or AI. Keep values in secret stores and dashboards, not in source files or logs.

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put AI_PROVIDER
npx wrangler secret put AI_MODEL
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put CEREBRAS_API_KEY
npx wrangler secret put GOOGLE_AI_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI
```

Run `npm run audit:env -- cloudflare` before deploy. The audit masks secret values and only reports whether required names are present.

If a broad Cloudflare token was exposed in chat or logs, rotate it after creating least-privilege tokens for Workers, D1, R2, and DNS.

## Deploy

```bash
npm run verify
npm run audit:env -- cloudflare
npm run cf:deploy
```

Deploy only to the Apps account (`d105a82bc26b6913575355352c2d1bb1`) belonging to `jamesung.kh@gmail.com`. The BusinessOS account must not be used. GitHub Actions pins this account and checks the credential's access before deployment. `deploy:prod` now uses Cloudflare; `deploy:preview` runs the local Cloudflare preview. Vercel hosting is retired.