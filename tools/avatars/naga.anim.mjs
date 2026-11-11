// clips for ลูกพญานาค (naga.py): node anim.mjs naga_raw.glb naga_anim.glb ./naga.anim.mjs
// glTF axes: Y up, +Z where it faces. Neck and head rotations about X lean it back (negative) or droop it forward (positive).
export default ({ clip, Z, ONE }) => {
  // idle: the head sways and looks about, the crest flutters, the tail tip flicks, the coil breathes (loops every 2.6 s)
  clip("idle", [
    ["neck", "rotation", [[0, Z], [0.65, [0.03, 0.12, 0.06]], [1.3, Z], [1.95, [-0.03, -0.12, -0.06]], [2.6, Z]]],
    ["head", "rotation", [[0, Z], [0.65, [0, -0.08, -0.1]], [1.3, Z], [1.95, [0, 0.08, 0.1]], [2.6, Z]]],
    ["crest", "scale", [[0, ONE], [0.4, [1, 1.08, 1]], [0.8, ONE], [1.7, ONE], [2.1, [1, 1.06, 1]], [2.6, ONE]]],
    ["tail", "rotation", [[0, Z], [0.3, [0, 0.45, 0]], [0.6, Z], [1.6, Z], [1.9, [0, -0.35, 0]], [2.2, Z], [2.6, Z]]],
    ["coil", "scale", [[0, ONE], [1.3, [1.025, 1.015, 1.025]], [2.6, ONE]]],
  ]);
  // hit: the coil squashes, the neck snaps back, the crest flares, then it settles (0.6 s)
  clip("hit", [
    ["coil", "scale", [[0, ONE], [0.07, [1.12, 0.85, 1.12]], [0.2, [0.96, 1.06, 0.96]], [0.4, ONE]]],
    ["neck", "rotation", [[0, Z], [0.08, [-0.45, 0, 0.12]], [0.3, [0.12, 0, -0.05]], [0.55, Z]]],
    ["head", "rotation", [[0, Z], [0.08, [-0.3, 0, 0]], [0.4, [0.05, 0, 0]], [0.6, Z]]],
    ["crest", "scale", [[0, ONE], [0.1, [1.2, 1.3, 1.2]], [0.45, ONE]]],
    ["tail", "rotation", [[0, Z], [0.1, [0, 0.6, 0]], [0.45, Z]]],
  ]);
  // win: it rears up tall, spins round on a hop, crest blazing, tail flicking fast (1.6 s)
  const spin = [0, 0.15, 0.3, 0.45, 0.6].map((t, k) => [t, [0, (k * Math.PI) / 2, 0]]);
  clip("win", [
    ["root", "translation", [[0, Z], [0.18, [0, 0.28, 0]], [0.36, Z], [1.6, Z]]],
    ["root", "rotation", [...spin, [1.6, [0, 2 * Math.PI, 0]]]],
    ["neck", "rotation", [[0, Z], [0.3, [-0.35, 0, 0]], [1.2, [-0.35, 0, 0]], [1.6, Z]]],
    ["head", "rotation", [[0, Z], [0.3, [-0.15, 0, 0]], [1.2, [-0.15, 0, 0]], [1.6, Z]]],
    ["crest", "scale", [[0, ONE], [0.3, [1.25, 1.35, 1.25]], [1.2, [1.25, 1.35, 1.25]], [1.6, ONE]]],
    ["tail", "rotation", [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 1.6].map((t, k) => [t, [0, k % 2 ? 0.5 : -0.5, 0]])],
  ]);
  // lose: the neck sinks, the head bows to the coil, the crest wilts (1.4 s, held on the last frame)
  clip("lose", [
    ["neck", "rotation", [[0, Z], [0.7, [0.7, 0, 0.1]], [1.4, [0.7, 0, 0.1]]]],
    ["head", "rotation", [[0, Z], [0.7, [0.4, 0, 0]], [1.4, [0.4, 0, 0]]]],
    ["crest", "scale", [[0, ONE], [0.7, [0.85, 0.75, 0.85]], [1.4, [0.85, 0.75, 0.85]]]],
    ["coil", "scale", [[0, ONE], [0.7, [1.03, 0.92, 1.03]], [1.4, [1.03, 0.92, 1.03]]]],
  ]);
};
