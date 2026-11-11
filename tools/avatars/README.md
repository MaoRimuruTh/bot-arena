# 3D table avatars (assets/avatars)

Original figures that stand by each player's side of the centre band and react to the game.
They are chosen in Settings and stored per browser (`bot.av3`); the list is `AVATARS` in `js/arena3d.js`.

How a figure is made:
1. A Blender script (bpy 5.3) builds the figure from rounded parts hung on named pivots, like a Blockbench model, facing -Y in Blender (+Z in the game):
   `OUT=. python chang.py` writes `chang_raw.glb`.
2. `node anim.mjs chang_raw.glb chang_anim.glb` adds the clips by animating the pivots (needs `@gltf-transform/core`).
3. `gltf-transform quantize chang_anim.glb chang.glb` makes it small (about 80 KB).

What the game uses from a model: clips whose names contain idle, hit, win and lose (any that are missing are done in code:
a breathing bob, a squash and recoil, a hop and spin, a slump). It is scaled to stand about 1.25 units tall with its feet at the origin.
Any glTF 2.0 .glb works, skinned or not; Draco, Meshopt and KTX2 compression are not loaded.
