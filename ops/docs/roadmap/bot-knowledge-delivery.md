# Lossless bot knowledge delivery

The browser now loads a dictionary-table representation of the generated bot knowledge. The authoritative training document remains unchanged. Repeated field names and values are represented once in the delivery file; all 10,064 entries, optional fields, timestamps, labels, explanations and training metadata are reconstructed before the existing runtime builds its indexes.

The packed JSON is 4,340,159 bytes, compared with 12,033,353 bytes for the minified source document. This saves about 7.34 MiB before bundler overhead. It does not delete knowledge or artwork, change game rules, alter bot search budgets, or reduce the number of offline games. Network compression already removes much of the original repetition, so the measured file reduction is not a claim of a proportionate network speedup.

## Generation and compatibility

`npm run prepare:knowledge` reads `src/data/bot-knowledge.generated.json`, verifies a complete strict round trip, and writes the committed `src/data/bot-knowledge.packed.json`. Development and both production build commands prepare this artifact alongside Stockfish. Training that updates the canonical source refreshes it too, including relative or symlink paths; training to a separate output leaves the canonical artifact alone.

The content checksum hashes parsed, compact JSON, so Windows and Linux checkout line endings produce identical artifacts. The versioned format retains absent fields separately from explicit null, zero and false. Decoding makes independent nested objects and arrays, preserving the mutation behavior of the previous JSON import. Unsupported versions, duplicate columns, invalid dictionary references and oversized rows are rejected.

The runtime still provides its existing lookup, tier, principal-variation, explanation and metadata interfaces. Only its data import and reconstruction change. Training sources, generated artwork, models, camera composition and offline-cache publication behavior remain untouched.

## Verification in progress

Independent source review passes after correcting cross-platform checksums and canonical-source refresh through relative paths. Preparation, training, bundle boundaries and complete dataset fidelity pass serially. Short-budget bot explanation checks fail on the loaded host; two also fail in a control run using the original unpacked data. The full suite, production build size and updated-pack/cold-offline browser checks are still in progress. Failed runs are retained rather than treated as passing checks.

The full lint command also exposed a scope defect: seven generated Cloudflare preview workers under nested `.wrangler` folders added about 224 MB of bundled code to the scan. The ignore now covers these generated folders at any depth while keeping all authored-source rules. The oversized run was stopped; corrected full lint remains part of the verification queue.

The offline allowance remains 88 MiB. The final built manifest, rather than the source-file estimate, determines available headroom. Selective per-family downloads remain separate work: they need selection-specific readiness, safe migration from the existing worker, concurrent update handling and honest behavior when opening an undownloaded game or save.

This packaging increment leaves the collection inventory at 17 designs across 11 families. The broader art, app, camera and multiplayer goal remains unfinished.
