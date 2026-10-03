# Tabletop material provenance

The physical case uses the colour, OpenGL normal and roughness maps from [Wood Table 001](https://polyhaven.com/a/wood_table_001), photographed by Dimitrios Savva and processed by Rico Cilliers. The source textures are [CC0](https://polyhaven.com/license).

`wood-table-source.json` pins the exact 2K JPEG URLs, byte lengths and MD5 checksums. The unchanged files are delivered from `public/assets/materials/wood-table/`. They load only with the 3D renderer and are included in the offline pack. Colour uses sRGB; normal and roughness use linear data. The renderer applies regional colour tints, a restrained normal strength and a clear-coat layer. No website preview images are bundled.

The playing squares still use the existing compact procedural surface. This revision upgrades the physical case material; it does not claim every board surface or regional miniature is finished.

Studio reflections use the prepared [CubeUV HDR atlas](studio-room.md), baked from the original Three.js studio environment. The asset preserves linear lighting and its roughness levels while removing runtime environment generation. The linked record includes the reproduction command, source license, pixel validation and orientation checks. It is included in the offline pack; direct scene lights keep the board usable if the optional HDR cannot load.
