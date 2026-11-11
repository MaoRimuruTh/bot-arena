// clips for ไก่ชนน้อย (kai.py): node anim.mjs kai_raw.glb kai_anim.glb ./kai.anim.mjs
// glTF axes: Y up, +Z where it faces. Rotating a wing about Z lifts it (left wing +, right wing -).
export default ({ clip, Z, ONE }) => {
  const flaps = (t0, n, step, amp) => { const L = [[0, Z], [t0, Z]], R = [[0, Z], [t0, Z]]; for (let k = 1; k <= n * 2; k++) { const up = k % 2; L.push([t0 + k * step, [0, 0, up ? amp : 0]]); R.push([t0 + k * step, [0, 0, up ? -amp : 0]]); } return [L, R]; };
  // idle: the little head bobs and looks about, the body breathes, now and then a wing shuffle (loops every 2.4 s)
  const [iL, iR] = flaps(1.5, 1, 0.12, 0.5);
  clip("idle", [
    ["body", "scale", [[0, ONE], [1.2, [1.02, 1.03, 1.02]], [2.4, ONE]]],
    ["head", "rotation", [[0, Z], [0.3, [0.18, 0, 0]], [0.45, Z], [0.9, [0, 0.35, 0]], [1.3, Z], [1.9, [0, -0.3, 0.05]], [2.4, Z]]],
    ["head", "translation", [[0, Z], [0.3, [0, -0.02, 0.03]], [0.45, Z], [2.4, Z]]],
    ["wing.L", "rotation", [...iL, [2.4, Z]]],
    ["wing.R", "rotation", [...iR, [2.4, Z]]],
    ["tail", "rotation", [[0, Z], [1.2, [0.06, 0.12, 0]], [2.4, Z]]],
  ]);
  // hit: knocked back and squashed, wings thrown out, head jerked back (0.6 s)
  clip("hit", [
    ["root", "scale", [[0, ONE], [0.07, [1.15, 0.82, 1.15]], [0.2, [0.95, 1.08, 0.95]], [0.4, ONE]]],
    ["root", "translation", [[0, Z], [0.1, [0, 0, -0.12]], [0.45, Z]]],
    ["head", "rotation", [[0, Z], [0.08, [-0.35, 0, 0.1]], [0.4, Z]]],
    ["wing.L", "rotation", [[0, Z], [0.08, [0, 0, 0.9]], [0.45, Z]]],
    ["wing.R", "rotation", [[0, Z], [0.08, [0, 0, -0.9]], [0.45, Z]]],
  ]);
  // win: a hop with a full turn, then wings beating fast and the head thrown back to crow (1.6 s)
  const spin = [0, 0.15, 0.3, 0.45, 0.6].map((t, k) => [t, [0, (k * Math.PI) / 2, 0]]);
  const [wL, wR] = flaps(0.6, 4, 0.1, 1.1);
  clip("win", [
    ["root", "translation", [[0, Z], [0.18, [0, 0.32, 0]], [0.36, Z], [1.6, Z]]],
    ["root", "rotation", [...spin, [1.6, [0, 2 * Math.PI, 0]]]],
    ["wing.L", "rotation", [...wL, [1.6, Z]]],
    ["wing.R", "rotation", [...wR, [1.6, Z]]],
    ["head", "rotation", [[0, Z], [0.6, Z], [0.8, [-0.55, 0, 0]], [1.4, [-0.55, 0, 0]], [1.6, Z]]],
    ["tail", "rotation", [[0, Z], [0.6, [-0.25, 0, 0]], [1.4, [-0.25, 0, 0]], [1.6, Z]]],
  ]);
  // lose: it hunches, head down, tail drooping, wings hanging (1.4 s, held on the last frame)
  clip("lose", [
    ["body", "scale", [[0, ONE], [0.7, [1.05, 0.9, 1.05]], [1.4, [1.05, 0.9, 1.05]]]],
    ["head", "rotation", [[0, Z], [0.7, [0.5, 0, 0.08]], [1.4, [0.5, 0, 0.08]]]],
    ["tail", "rotation", [[0, Z], [0.7, [0.6, 0, 0]], [1.4, [0.6, 0, 0]]]],
    ["wing.L", "rotation", [[0, Z], [0.7, [0, 0, -0.25]], [1.4, [0, 0, -0.25]]]],
    ["wing.R", "rotation", [[0, Z], [0.7, [0, 0, 0.25]], [1.4, [0, 0, 0.25]]]],
  ]);
};
