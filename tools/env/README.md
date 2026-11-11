# Table, props and reflections (assets/env)

Everything in `assets/env` is made by these scripts; nothing is downloaded from elsewhere.
Blender runs as a Python module: `pip install bpy==5.3.0` (Python 3.13).

| File | Made by | What it is |
|---|---|---|
| `wood.jpg` | `python3 wood.py 1024 wood.png`, then saved as JPEG | seamless teak tile, repeated over the table |
| `props.glb` | `BAKE=0 python props.py`, then `gltf-transform quantize` | brass candlesticks, jasmine garland, water bowl, marigold petals |
| `table-light.jpg` | `PASS=candles` and `PASS=key` runs of `props.py` (`LW=512 LH=366 SAMPLES=40 CANDLE_W=2600 KEY_W=1300`), then `python3 lm8.py 0.45 1.3 3` | candle and key light baked onto the table, stored as light / 3 |
| `hall.hdr` | `W=768 python hall.py`, scaled to 512 x 256 | a dim hall the gold leaf and brass reflect |

Coordinates: Blender X = three.js x, Blender Y = -z, Blender Z = y; the table top is at y = -0.335.
The candle positions in `props.py` must match `R.candles` in `js/arena3d.js`.
After changing a file here, bump `ENV_V` in `js/arena3d.js` so browsers fetch the new copy.
