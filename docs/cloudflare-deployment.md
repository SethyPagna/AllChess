# Cloudflare Deployment

AllChess is Cloudflare-first. Supabase, Hyperdrive, Vercel databases, and Vercel object storage are not part of the runtime plan.

## Architecture

- Runtime: Cloudflare Workers through the OpenNext Cloudflare adapter.
- Database: D1 database `allchess`.
- User objects: R2 bucket `allchess-objects`.
- Preview objects: R2 bucket `allchess-objects-preview`.
- Next incremental cache: R2 bucket `allchess-opennext-cache`.
- AI: Workers AI binding `AI`, with optional Groq, Mistral, Cerebras, Google AI, or OpenAI secrets for deeper review.
- Other products: LEARN and edsync must use separate Cloudflare resources.

## One-Time Setup

```bash
npx wrangler login
npx wrangler r2 bucket create allchess-opennext-cache
npx wrangler r2 bucket create allchess-objects
npx wrangler r2 bucket create allchess-objects-preview
npx wrangler d1 create allchess
npm run db:migrate:remote
```

Copy the D1 database id into `wrangler.jsonc` and set the same value as `CLOUDFLARE_D1_DATABASE_ID` anywhere the app runs outside Workers.

## Secrets

Use Wrangler, Vercel, or GitHub secrets. Never commit tokens.

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

Run `npm run audit:env -- cloudflare` before deploy and `npm run audit:env -- vercel` after setting Vercel project variables. The audit masks secret values and only reports whether required names are present.

If a broad Cloudflare token was exposed in chat or logs, rotate it after creating least-privilege tokens for Workers, D1, R2, and DNS.

## Deploy

```bash
npm run verify
npm run cf:deploy
```

For Vercel, link the project as `allchess` and set Cloudflare credentials in Vercel environment variables. Vercel should host the app only; data still belongs to Cloudflare D1/R2.
