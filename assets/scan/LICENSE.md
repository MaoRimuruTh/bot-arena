# Scanned stone for the scenes (assets/scan)

All files here are CC0 1.0 (public domain) from Poly Haven: https://polyhaven.com/license
("You can use our assets for any purpose … You do not need to give credit"). Credited here anyway, with thanks.

| File | Poly Haven asset | Author | Changes |
|---|---|---|---|
| paver_d.jpg, paver_d_lo.jpg, paver_n.jpg | Large Grey Tiles: https://polyhaven.com/a/large_grey_tiles | Rob Tuytel | 1k colour and OpenGL normal maps resized to 512 px (colour also 256 px for phones), JPEG |
| rock_a.glb | Rock 09: https://polyhaven.com/a/rock_09 | Jenelle van Heerden | 12.4k → 450 triangles (meshoptimizer), textures 256 / 256 / 128 px, normals and UVs quantized |
| rock_b.glb | Rock 07: https://polyhaven.com/a/rock_07 | Jenelle van Heerden | 14.8k → 450 triangles, textures 256 / 256 / 128 px, normals and UVs quantized |

Packed with tools/models/pack.mjs, simplify error raised for these: `ERR=0.1 node tools/models/pack.mjs <in.gltf> <out.glb> 450 256 256 128`.
The scenes draw their own paving and low-poly stones first; these replace them when they load (js/arena3d.js: scanPaver, scanRocks).
