// clips for ช้างน้อย (chang.py): node anim.mjs chang_raw.glb chang_anim.glb ./chang.anim.mjs
export default ({ clip, Z, ONE, flap }) => {
// idle: breathing, a slow nod, the ears flapping now and then, the trunk swaying, the tail wagging (loops every 2.4 s)
clip("idle", [
  ["body", "scale", [[0, ONE], [1.2, [1.02, 1.04, 1.02]], [2.4, ONE]]],
  ["head", "rotation", [[0, Z], [0.6, [0.06, 0, 0.03]], [1.2, Z], [1.8, [-0.03, 0, -0.03]], [2.4, Z]]],
  ["ear.L", "rotation", [[0, Z], [0.3, [0, -0.35, 0]], [0.6, Z], [1.5, Z], [1.8, [0, -0.25, 0]], [2.1, Z], [2.4, Z]]],
  ["ear.R", "rotation", [[0, Z], [0.3, [0, 0.35, 0]], [0.6, Z], [1.5, Z], [1.8, [0, 0.25, 0]], [2.1, Z], [2.4, Z]]],
  ["trunk", "rotation", [[0, Z], [0.8, [-0.22, 0, 0.05]], [1.6, [0.05, 0, -0.05]], [2.4, Z]]],
  ["tail", "rotation", [[0, Z], [0.6, [0, 0, 0.4]], [1.2, Z], [1.8, [0, 0, -0.4]], [2.4, Z]]],
  ["root", "translation", [[0, Z], [1.2, [0, 0.015, 0]], [2.4, Z]]],
]);
// hit: squashed, knocked back a step, ears and trunk flung back, then it shakes it off (0.6 s)
clip("hit", [
  ["root", "scale", [[0, ONE], [0.07, [1.16, 0.8, 1.16]], [0.2, [0.94, 1.08, 0.94]], [0.34, [1.03, 0.97, 1.03]], [0.5, ONE]]],
  ["root", "rotation", [[0, Z], [0.1, [-0.3, 0, 0]], [0.3, [0.08, 0, 0]], [0.55, Z]]],
  ["root", "translation", [[0, Z], [0.1, [0, 0, -0.12]], [0.45, Z]]],
  ["head", "rotation", [[0, Z], [0.08, [-0.35, 0, 0.1]], [0.4, [0.05, 0, 0]], [0.6, Z]]],
  ["ear.L", "rotation", [[0, Z], [0.08, [0, 0.5, -0.3]], [0.45, Z]]],
  ["ear.R", "rotation", [[0, Z], [0.08, [0, -0.5, 0.3]], [0.45, Z]]],
  ["trunk", "rotation", [[0, Z], [0.1, [-0.6, 0, 0]], [0.45, [0.1, 0, 0]], [0.6, Z]]],
]);
// win: two hops with a full turn on the first, trunk raised high, ears flapping (1.6 s)
const spin = [0, 0.15, 0.3, 0.45, 0.6].map((t, k) => [t, [0, (k * Math.PI) / 2, 0]]);
clip("win", [
  ["root", "translation", [[0, Z], [0.18, [0, 0.32, 0]], [0.36, Z], [0.54, [0, 0.22, 0]], [0.72, Z], [1.6, Z]]],
  ["root", "rotation", [...spin, [1.6, [0, 2 * Math.PI, 0]]]],
  ["trunk", "rotation", [[0, Z], [0.25, [-1.7, 0, 0]], [1.1, [-1.7, 0, 0]], [1.5, Z], [1.6, Z]]],
  ["head", "rotation", [[0, Z], [0.25, [-0.2, 0, 0]], [1.1, [-0.2, 0, 0]], [1.5, Z], [1.6, Z]]],
  ["ear.L", "rotation", flap(1, 0.5, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.6])],
  ["ear.R", "rotation", flap(-1, 0.5, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.6])],
]);
// lose: it sags, head and ears droop, trunk hangs (1.4 s, meant to hold on the last frame)
clip("lose", [
  ["body", "scale", [[0, ONE], [0.6, [1.03, 0.88, 1.03]], [1.4, [1.03, 0.88, 1.03]]]],
  ["head", "rotation", [[0, Z], [0.6, [0.45, 0, 0.08]], [1.4, [0.45, 0, 0.08]]]],
  ["ear.L", "rotation", [[0, Z], [0.6, [0, 0, -0.55]], [1.4, [0, 0, -0.55]]]],
  ["ear.R", "rotation", [[0, Z], [0.6, [0, 0, 0.55]], [1.4, [0, 0, 0.55]]]],
  ["trunk", "rotation", [[0, Z], [0.6, [0.35, 0, 0]], [1.4, [0.35, 0, 0]]]],
  ["tail", "rotation", [[0, Z], [0.6, [0.3, 0, 0]], [1.4, [0.3, 0, 0]]]],
  ["root", "translation", [[0, Z], [0.6, [0, -0.02, 0]], [1.4, [0, -0.02, 0]]]],
]);
};
