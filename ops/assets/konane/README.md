# Kōnane stones

Original Blender meshes authored for AllChess. The light coral-tone and dark basalt-tone pebbles have different deterministic contours and small geometric irregularities. Each is approximately 37 × 35 × 16 mm, grounded at zero, with portable PBR materials. Named roots: `light_stone`, `dark_stone`.

Rebuild with Blender 5.2: `blender --background --python ops/assets/konane/build_collection.py`. The script writes an editable `.blend`, a self-contained `.glb`, and a delivery render. No third-party meshes, textures, typefaces or photographs are included. These are contemporary interpretations, not scans or replicas of historical artifacts.

The live papamū uses continuous timber geometry with 64 recessed bowls, generated in `src/components/board/konane-board.ts`; the wooden supporting case sits below the bowl bottoms. Stones rest within the bowls. All board materials and lighting are generated locally and work offline.

Rule and material context: [National Park Service, Play Kōnane](https://www.nps.gov/thingstodo/play-konane.htm), [NPS illustrated rules](https://www.nps.gov/puho/learn/historyculture/upload/Konane-Rules-508.pdf). The new `nps-v1` profile implements that published variation; it does not claim to cover every Hawaiian tradition.
