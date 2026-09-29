# Lossless bot knowledge delivery

The browser now loads a dictionary-table representation of the generated bot knowledge. The authoritative training document remains unchanged. Repeated field names and values are represented once in the delivery file; all 10,064 entries, optional fields, timestamps, labels, explanations and training metadata are reconstructed before the existing runtime builds its indexes.

The packed JSON is 4,340,159 bytes, compared with 12,033,353 bytes for the minified source document. This saves about 7.34 MiB before bundler overhead. It does not delete knowledge or artwork, change game rules, alter bot search budgets, or reduce the number of offline games. Network compression already removes much of the original repetition, so the measured file reduction is not a claim of a proportionate network speedup.

## Generation and compatibility

`npm run prepare:knowledge` reads `src/data/bot-knowledge.generated.json`, verifies a complete strict round trip, and writes the committed `src/data/bot-knowledge.packed.json`. Development and both production build commands prepare this artifact alongside Stockfish. Training that updates the canonical source refreshes it too, including relative or symlink paths; training to a separate output leaves the canonical artifact alone.

The content checksum hashes parsed, compact JSON, so Windows and Linux checkout line endings produce identical artifacts. The versioned format retains absent fields separately from explicit null, zero and false. Decoding makes independent nested objects and arrays, preserving the mutation behavior of the previous JSON import. Unsupported versions, duplicate columns, invalid dictionary references and oversized rows are rejected.

The runtime still provides its existing lookup, tier, principal-variation, explanation and metadata interfaces. Only its data import and reconstruction change. Training sources, generated artwork, models, camera composition and offline-cache publication behavior remain untouched.

## Verification and open failures

Independent source review, preparation/training checks and complete dataset fidelity pass. The latest full suite reported **1,362 passed, 14 failed and 4 skipped**. Separate unpacked-data controls reproduced rescue and trade explanation failures seen in focused runs; the full run's trade fixture instead chose a quiet move. These controls do not explain all fourteen failures. Decoding completes before search deadlines begin, but indirect timing effects remain unproven. Failed runs remain recorded.

Corrected full lint passes after excluding generated `.wrangler` preview folders at any depth. Seven preview workers had added about 224 MB of generated code to the scan; authored-source lint rules remain unchanged. The strict application typecheck and a separate check of the current browser audit pass. Ignored historical Playwright diagnostics are excluded from the application check; all tracked source and tests remain covered. Two Three test typing repairs preserve runtime behavior and assertions, with all 32 focused 3D tests passing.

The complete production build passes, including mandatory Next.js TypeScript, 209 pages and realtime Worker packaging. The built offline manifest contains the same **182 assets at 83,510,261 bytes (79.64 MiB)**, saving **7,692,594 bytes (7.34 MiB)** and leaving **8,764,427 bytes (8.36 MiB)** below the unchanged limit. All 104 prior artwork, model, engine and icon descriptors and their actual public file bytes/hashes match. The large browser-chunk scan finds one packed payload, verifies its full decoded equality and finds no copy of the former raw payload among large `JSON.parse` literals.

The online production audit passes the three-ply classic hint/apply flow, an actual Stockfish UCI result with matching board change, Xiangqi hint/manual/automatic replies, and API equality for every generated source field. The hint UI does not expose its knowledge-source counter, so this is observed behavior plus complementary bundle/API evidence, not a measured cache-hit rate. An initial setup-readiness failure is retained; the corrected harness waits for page load and asserts the selected side and active controls before moving, without changing gameplay deadlines.

Two old-profile update runs verify every old/new cached body and preserve both earlier saves and preferences. Both then miss the five-second Classic 3D readiness limit, with the board rendering shortly afterward. A separate browser process launched with networking disabled restores the saved position, orientation and 3D preference, retains earlier saves, verifies all 182 cached files and passes classic hint/Stockfish and Xiangqi checks with no page errors, console errors or failed requests.

Cold 3D readiness also misses the target: 6,268 ms on the original run and 5,259 ms on the diagnostic continuation. The continuation allows up to 30 seconds to inspect functional recovery but records the unchanged five-second performance budget separately; its overall result and exit code remain failed. Functional passes do not erase these timing failures. Phase timing of texture callbacks, scene redraws, shader preparation and first render is the next 3D performance task; no artwork reduction or readiness-threshold change is included here.

Local warmed Node parsing samples had medians of 41.44 ms for the original JSON and 54.66 ms for packed JSON plus decoding, excluding runtime indexing, import, browser startup and transfer. They do not establish faster startup. Shared-process heap deltas were unstable and cannot support a memory-footprint claim.

The offline allowance remains 88 MiB. This headroom is measured from the final built manifest. Selective per-family downloads remain separate work: they need selection-specific readiness, safe migration from the existing worker, concurrent update handling and honest behavior when opening an undownloaded game or save.

This packaging increment leaves the collection inventory at 17 designs across 11 families. The broader art, app, camera and multiplayer goal remains unfinished.
