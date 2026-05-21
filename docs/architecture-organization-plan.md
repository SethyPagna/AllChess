# AllChess Architecture Organization And Runtime Plan

## Goals
- Keep the app easy to navigate by grouping files by domain instead of leaving runtime-heavy modules in a flat `src/lib` list.
- Preserve working imports, routes, tests, and deployments while moving files in small slices.
- Use additional languages only where they improve measurable throughput, memory use, or engine integration without making the web runtime harder to ship.

## Folder Organization Rules
1. Keep Next.js routes under `src/app` because the framework expects that structure.
2. Keep shared React UI under `src/components/<domain>`:
   - `src/components/analysis`: analysis and review playback UI.
   - `src/components/auth`: sign-in and guest account UI.
   - `src/components/board`: board, square, and piece presentation UI.
   - `src/components/catalog`: games/rules catalog and guide overlays.
   - `src/components/play`: play setup and game picker UI.
   - `src/components/shell`: navigation, language, theme, and notification controls.
   - `src/components/ui`: small shared primitives such as info/help controls.
3. Group domain logic under `src/lib/<domain>`:
   - `src/lib/bot`: bot runtime, strength bands, training metadata, Stockfish bridge, difficulty config.
   - `src/lib/cloudflare`: D1, R2, Workers, runtime env, and REST adapters.
   - `src/lib/variants`: rules engines, variant definitions, move/state types.
   - `src/lib/realtime`: Durable Object room, matchmaking, live stats, protocol types.
   - `src/lib/catalog`: universal game catalog, family metadata, release gates.
   - `src/lib/i18n`: locale dictionaries, vocabulary, navigation labels.
4. Keep migrations in `cloudflare/d1/migrations` and schema docs in `docs`.
5. Keep generated compact runtime data in `src/data`; raw training archives stay outside commits or in R2.

## Migration Order
1. Bot domain: move flat bot files into `src/lib/bot/` and update all imports.
2. Gameplay domain: review whether `clocks`, `game-outcome`, `game-review`, and `time-controls` should move under `src/lib/game/`.
3. UI domain: keep board, catalog, play, shell, auth, analysis, and shared UI primitives in their current component subfolders.
4. Scripts domain: keep scripts grouped by `audit`, `deploy`, `training`, and `assets`.
5. Remove empty or obsolete folders after confirming Git tracks no files inside them.

## Multi-Language Policy
- Keep app, API routes, rules validation, and Cloudflare runtime in TypeScript because the deployment targets are Next.js, Workers, and browser/WASM.
- Use Python for offline data ingestion when packages like `pyarrow`, PGN parsers, or dataset tooling make streaming training data faster than Node.
- Use Rust or C/C++ only through existing engines or WASM artifacts, not by rewriting app code opportunistically.
- Do not mix languages inside one source file or runtime boundary.
- Add a language only with:
  1. A bounded command or service.
  2. A clear input/output artifact.
  3. Tests or checks for the artifact.
  4. No secret leakage in logs or generated files.

## Current Decision
- Do not convert the main app away from TypeScript. The best performance return is from organizing hot bot modules, keeping Stockfish as WASM/native engine work, and using offline training scripts for heavy datasets.
- Future Python/Rust work should target `scripts/training` or engine build tooling, not Next.js pages or Cloudflare request handlers.
