# Chess Data Archive Audit

Date: 2026-05-19

## Result

No raw chess-data files were moved or deleted in this pass.

The current `CHESS DATA` archives and extracted folders are still referenced by `scripts/training/train-bot-knowledge.ts` and by the generated runtime manifest at `src/data/bot-knowledge.generated.json`. Moving them now would make the default training command stop finding the same source paths.

## Current Data Roots

| Path | Role | Archive action |
| --- | --- | --- |
| `CHESS DATA/lichess_db_puzzle.csv.zst` | Puzzle/tactic cache source | Keep active |
| `CHESS DATA/chess` | Classic game samples | Keep active |
| `CHESS DATA/chess960` | Chess960 samples | Keep active |
| `CHESS DATA/antichess` | Antichess samples | Keep active |
| `CHESS DATA/atomic` | Preview dataset, not playable yet | Keep active until manifest generation excludes it |
| `CHESS DATA/crazyhouse` | Preview dataset, not playable yet | Keep active until manifest generation excludes it |
| `CHESS DATA/aix-lichess-database` | Dataset tooling metadata | Keep active |
| `CHESS DATA/*Stockfish*`, `*StockLLM*`, `*nnue*`, `*lc0*`, `*aix*` zips | Tool/source manifests | Keep active |

## Archive Policy

Only move a data file to `CHESS DATA/archive` when all are true:

1. It is not referenced by `src/data/bot-knowledge.generated.json`.
2. It is not needed by `scripts/training/train-bot-knowledge.ts`.
3. It is either a duplicate, an obsolete generated extraction, or a failed partial download.
4. A replacement source path has already been added to the training manifest.

Raw archives stay out of Git. This document is the tracked audit record.
