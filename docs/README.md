# AllChess

AllChess is a multilingual, Cloudflare-first chess ecosystem for classic chess and global variants.

The archived Python Jungle Chess implementation remains in `archive/reference/python-jungle-chess` for reference. The active app is a Next.js 16 application deployed as `allchess`, with Cloudflare D1 for data and Cloudflare R2 for object storage.

## Current Stack

- Next.js: `^16.2.6`
- React: `^19.2.6`
- TypeScript: `^5.9.3`
- Vitest: `^4.1.7`
- Playwright: `^1.57.0`
- Wrangler: `^4.95.0`
- OpenNext Cloudflare: `^1.19.11`

The package ranges are current for the verified non-major update lane. Major upgrades reported by `npm outdated` are tracked separately because they can require migration work.

## Status

- 19 launch locales with shared chess vocabulary.
- Board-first responsive UI with compact navigation, bot controls, move history, and review-ready play.
- App-owned D1 auth scaffolding: email/password, guest mode, passkeys schema, and Google OAuth configuration hooks.
- D1 repositories for games, moves, rooms, ratings, profiles, sessions, and analysis reports.
- R2 object storage with `allchess/` key prefixing.
- Launch variants declare their rules adapter: `chessops`, `xiangqiops`, `shogiops`, `makruk-js`, or owned AllChess modules.
- Bot difficulty ladder: Easy, Normal, Hard, Very Hard, Grandmaster, Legend, with consistent Elo-style bands and calibration status per variant.
- Deployment paths for GitHub, local development, Vercel hosting, Cloudflare Workers, and Docker self-deploy.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/en`.

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Verify

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit:live
npm run audit:env -- vercel
```

## Maintenance

Use the storage cleanup command when local builds, test runs, or Git objects start taking too much disk space:

```bash
npm run clean:storage
```

This removes local build/test artifacts such as `.next`, `.open-next`, `.wrangler`, reports, logs, and `tsconfig.tsbuildinfo`, then runs `git gc --prune=now`. It intentionally keeps `CHESS DATA`, `node_modules`, `.env` files, and generated public runtime assets. For a preview, run:

```bash
npm run clean:local -- --dry-run
```

If a dev server or audit run leaves background Node processes behind, stop only the ones launched from this workspace:

```bash
npm run stop:local
npm run stop:local -- --dry-run
```

## Deploy

Cloudflare:

```bash
npx wrangler r2 bucket create allchess-opennext-cache
npx wrangler r2 bucket create allchess-objects
npx wrangler r2 bucket create allchess-objects-preview
npx wrangler d1 create allchess
npm run db:migrate:remote
npm run cf:deploy
```

The current workers.dev deployment URL for this Cloudflare account is `https://allchess.learn-app.workers.dev`.

Vercel:

```bash
vercel link --yes --project allchess
npm run deploy:prod
```

Vercel should host the app only. Database and object storage stay on Cloudflare.

Docker self-deploy:

```bash
docker compose -f infra/docker/docker-compose.selfhost.yml up --build
```

## Secrets

Never commit real API keys or tokens. Store Cloudflare, Vercel, Google OAuth, and AI provider credentials in local ignored `.env` files or hosted secret stores. The AI analysis adapter supports the Business OS style providers Groq, Mistral, Cerebras, Google AI, and OpenAI. Rotate any broad token that was pasted into chat or logs.

See `docs/cloudflare-deployment.md` and `docs/self-hosting.md` for the Cloudflare, domain, database, and object-storage paths.

Project planning, progress notes, decisions, and change history live in `docs/roadmap/`.
