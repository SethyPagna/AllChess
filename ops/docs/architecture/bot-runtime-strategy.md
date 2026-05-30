# Bot Runtime Strategy

AllChess uses a mixed-language bot stack where it is measurably useful:

- TypeScript: product runtime, rules validation, UI, API routes, Durable Objects, and D1/R2 metadata.
- WebAssembly/C++: Stockfish-style search for chess-family engine hot paths.
- Python/native tools: offline dataset ingestion, compressed file streaming, feature extraction, local AI experiments, and long-running label generation.
- Rust/WASM: candidate only if benchmarks show TypeScript rules or search kernels are still the bottleneck after indexed cache lookup and engine fallback.

The current decision is to keep TypeScript as the orchestration layer and move only proven hot paths to native/WASM engines. A full TypeScript replacement is not justified until benchmark data shows the indexed knowledge layer plus native engines are still too slow.
Optional Python dependencies for bot/local-AI training probes live in `ops/config/python/bot-training-requirements.txt`; the interactive Next.js runtime does not import them.

Runtime bot move order:

1. Reject terminal positions.
2. Generate legal moves from the deterministic rules engine.
3. Try indexed opening, tactic, endgame, or model knowledge.
4. Use Stockfish/Fairy-Stockfish-style engines where supported.
5. Use internal search fallback for variants without mature engines.
6. Validate the final move through the rules engine before applying it.

The public `/api/bots/models` endpoint reports the active runtime language profile and knowledge-index size so deployments can verify the fast path is active.
