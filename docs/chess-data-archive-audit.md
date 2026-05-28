# Chess Data Archive Audit

Date: 2026-05-19

## Result

Raw chess-data files now live outside the repository root under `data/local/chess-data/`.

The current `data/local/chess-data` archives and extracted folders are still referenced by `scripts/training/train-bot-knowledge.ts` and by the generated runtime manifest at `src/data/bot-knowledge.generated.json`. Keep this folder ignored and local unless a compact generated artifact is intentionally committed.

## Current Data Roots

| Path | Role | Archive action |
| --- | --- | --- |
| `data/local/chess-data/lichess_db_puzzle.csv.zst` | Puzzle/tactic cache source | Keep active |
| `data/local/chess-data/chess` | Classic game samples | Keep active |
| `data/local/chess-data/chess960` | Chess960 samples | Keep active |
| `data/local/chess-data/antichess` | Antichess samples | Keep active |
| `data/local/chess-data/atomic` | Preview dataset, not playable yet | Keep active until manifest generation excludes it |
| `data/local/chess-data/crazyhouse` | Preview dataset, not playable yet | Keep active until manifest generation excludes it |
| `data/local/chess-data/aix-lichess-database` | Dataset tooling metadata | Keep active |
| `data/local/chess-data/*Stockfish*`, `*StockLLM*`, `*nnue*`, `*lc0*`, `*aix*` zips | Tool/source manifests | Keep active |

## Archive Policy

Only move a data file to `data/local/chess-data/archive` when all are true:

1. It is not referenced by `src/data/bot-knowledge.generated.json`.
2. It is not needed by `scripts/training/train-bot-knowledge.ts`.
3. It is either a duplicate, an obsolete generated extraction, or a failed partial download.
4. A replacement source path has already been added to the training manifest.

Raw archives stay out of Git. This document is the tracked audit record.
