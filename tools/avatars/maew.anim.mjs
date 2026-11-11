// clips for แมววิเชียรมาศ (maew.py): node anim.mjs maew_raw.glb maew_anim.glb ./maew.anim.mjs
// glTF axes: Y up, +Z where it faces. Rotating the paw pivot about X lifts the left foreleg (negative = up and forward).
export default ({ clip, Z, ONE }) => {
  // idle: breathing, a curious head tilt, an ear twitch now and then, the tail swaying (loops every 2.8 s)
  clip("idle", [
    ["body", "scale", [[0, ONE], [1.4, [1.02, 1.035, 1.02]], [2.8, ONE]]],
    ["head", "rotation", [[0, Z], [0.7, [0, 0, 0.12]], [1.4, Z], [2.1, [0.04, 0.1, 0]], [2.8, Z]]],
    ["ear.L", "rotation", [[0, Z], [0.9, Z], [1.0, [0, 0, -0.35]], [1.15, Z], [2.8, Z]]],
    ["ear.R", "rotation", [[0, Z], [2.0, Z], [2.1, [0, 0, 0.35]], [2.25, Z], [2.8, Z]]],
    ["tail", "rotation", [[0, Z], [0.7, [0, 0.35, 0.1]], [1.4, Z], [2.1, [0, -0.3, -0.1]], [2.8, Z]]],
  ]);
  // hit: it flinches flat, ears pinned back, tail puffed, then shakes it off (0.6 s)
  clip("hit", [
    ["root", "scale", [[0, ONE], [0.07, [1.15, 0.8, 1.15]], [0.2, [0.95, 1.08, 0.95]], [0.4, ONE]]],
    ["root", "translation", [[0, Z], [0.1, [0, 0, -0.1]], [0.45, Z]]],
    ["head", "rotation", [[0, Z], [0.08, [-0.3, 0, 0.12]], [0.4, Z]]],
    ["ear.L", "rotation", [[0, Z], [0.08, [0.5, 0, -0.5]], [0.5, Z]]],
    ["ear.R", "rotation", [[0, Z], [0.08, [0.5, 0, 0.5]], [0.5, Z]]],
    ["tail", "scale", [[0, ONE], [0.1, [1.4, 1.2, 1.4]], [0.55, ONE]]],
  ]);
  // win: a hop with a full turn, then a happy wave of the paw (1.6 s)
  const spin = [0, 0.15, 0.3, 0.45, 0.6].map((t, k) => [t, [0, (k * Math.PI) / 2, 0]]);
  clip("win", [
    ["root", "translation", [[0, Z], [0.18, [0, 0.3, 0]], [0.36, Z], [1.6, Z]]],
    ["root", "rotation", [...spin, [1.6, [0, 2 * Math.PI, 0]]]],
    ["paw", "rotation", [[0, Z], [0.6, Z], [0.75, [-1.3, 0, 0.2]], [0.9, [-1.3, 0, -0.2]], [1.05, [-1.3, 0, 0.2]], [1.2, [-1.3, 0, -0.2]], [1.45, Z], [1.6, Z]]],
    ["tail", "rotation", [[0, Z], [0.3, [-0.5, 0, 0]], [1.3, [-0.5, 0, 0]], [1.6, Z]]],
    ["head", "rotation", [[0, Z], [0.7, [-0.15, 0, 0.1]], [1.3, [-0.15, 0, -0.1]], [1.6, Z]]],
  ]);
  // lose: ears flatten, head hangs, it hunches down (1.4 s, held on the last frame)
  clip("lose", [
    ["body", "scale", [[0, ONE], [0.7, [1.05, 0.9, 1.05]], [1.4, [1.05, 0.9, 1.05]]]],
    ["head", "rotation", [[0, Z], [0.7, [0.4, 0, 0.06]], [1.4, [0.4, 0, 0.06]]]],
    ["ear.L", "rotation", [[0, Z], [0.7, [0.4, 0, -0.6]], [1.4, [0.4, 0, -0.6]]]],
    ["ear.R", "rotation", [[0, Z], [0.7, [0.4, 0, 0.6]], [1.4, [0.4, 0, 0.6]]]],
    ["tail", "rotation", [[0, Z], [0.7, [0.4, 0, 0]], [1.4, [0.4, 0, 0]]]],
  ]);
};
