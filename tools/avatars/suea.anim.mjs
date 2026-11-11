// clips for เสือน้อย (suea.py): node anim.mjs suea_raw.glb suea_anim.glb ./suea.anim.mjs
// glTF axes: Y up, +Z where it faces. Rotating the paw pivot about X swings the left foreleg (negative = up and forward).
export default ({ clip, Z, ONE }) => {
  // idle: breathing, a guard-up bounce like a boxer waiting, an ear flick, the tail swaying (loops every 2.4 s)
  clip("idle", [
    ["body", "scale", [[0, ONE], [0.6, [1.025, 1.035, 1.025]], [1.2, ONE], [1.8, [1.025, 1.035, 1.025]], [2.4, ONE]]],
    ["root", "translation", [[0, Z], [0.3, [0, 0.025, 0]], [0.6, Z], [0.9, [0, 0.025, 0]], [1.2, Z], [2.4, Z]]],
    ["head", "rotation", [[0, Z], [0.6, [0, 0, 0.08]], [1.2, Z], [1.8, [0, 0, -0.08]], [2.4, Z]]],
    ["paw", "rotation", [[0, Z], [0.6, [-0.25, 0, 0]], [1.2, Z], [1.8, [-0.25, 0, 0]], [2.4, Z]]],
    ["ear.R", "rotation", [[0, Z], [1.5, Z], [1.6, [0, 0, 0.35]], [1.75, Z], [2.4, Z]]],
    ["tail", "rotation", [[0, Z], [0.6, [0, 0.3, 0.08]], [1.2, Z], [1.8, [0, -0.3, -0.08]], [2.4, Z]]],
  ]);
  // hit: knocked back, squashed, ears flat, then shakes it off (0.6 s)
  clip("hit", [
    ["root", "scale", [[0, ONE], [0.07, [1.15, 0.8, 1.15]], [0.2, [0.95, 1.08, 0.95]], [0.4, ONE]]],
    ["root", "translation", [[0, Z], [0.1, [0, 0, -0.12]], [0.45, Z]]],
    ["head", "rotation", [[0, Z], [0.08, [-0.32, 0, 0.12]], [0.4, Z]]],
    ["ear.L", "rotation", [[0, Z], [0.08, [0.5, 0, -0.5]], [0.5, Z]]],
    ["ear.R", "rotation", [[0, Z], [0.08, [0.5, 0, 0.5]], [0.5, Z]]],
    ["tail", "scale", [[0, ONE], [0.1, [1.35, 1.2, 1.35]], [0.55, ONE]]],
  ]);
  // win: a hop with a full turn, then two quick jabs and a proud chin-up (1.6 s)
  const spin = [0, 0.15, 0.3, 0.45, 0.6].map((t, k) => [t, [0, (k * Math.PI) / 2, 0]]);
  clip("win", [
    ["root", "translation", [[0, Z], [0.18, [0, 0.3, 0]], [0.36, Z], [1.6, Z]]],
    ["root", "rotation", [...spin, [1.6, [0, 2 * Math.PI, 0]]]],
    ["paw", "rotation", [[0, Z], [0.65, Z], [0.75, [-1.45, 0, 0]], [0.85, [-0.3, 0, 0]], [0.95, [-1.45, 0, 0]], [1.05, [-0.3, 0, 0]], [1.3, [-1.2, 0, 0.25]], [1.6, Z]]],
    ["head", "rotation", [[0, Z], [0.7, [-0.1, 0, 0]], [1.3, [-0.22, 0, 0]], [1.6, Z]]],
    ["tail", "rotation", [[0, Z], [0.3, [-0.5, 0, 0]], [1.3, [-0.5, 0, 0]], [1.6, Z]]],
  ]);
  // lose: ears flatten, head hangs, it hunches down (1.4 s, held on the last frame)
  clip("lose", [
    ["body", "scale", [[0, ONE], [0.7, [1.05, 0.9, 1.05]], [1.4, [1.05, 0.9, 1.05]]]],
    ["head", "rotation", [[0, Z], [0.7, [0.42, 0, 0.06]], [1.4, [0.42, 0, 0.06]]]],
    ["ear.L", "rotation", [[0, Z], [0.7, [0.4, 0, -0.6]], [1.4, [0.4, 0, -0.6]]]],
    ["ear.R", "rotation", [[0, Z], [0.7, [0.4, 0, 0.6]], [1.4, [0.4, 0, 0.6]]]],
    ["tail", "rotation", [[0, Z], [0.7, [0.4, 0, 0]], [1.4, [0.4, 0, 0]]]],
    ["paw", "rotation", [[0, Z], [0.7, [0.15, 0, 0]], [1.4, [0.15, 0, 0]]]],
  ]);
};
