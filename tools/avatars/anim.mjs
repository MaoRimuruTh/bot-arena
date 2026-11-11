// Adds the idle / hit / win / lose clips to an avatar by animating its named pivots; the clips themselves live in <name>.anim.mjs.
// Run from a folder where @gltf-transform/core is installed: node anim.mjs chang_raw.glb chang_anim.glb ./chang.anim.mjs
// glTF axes: Y up, +Z is where the elephant faces. Rotations are Euler XYZ in radians, added to each pivot's rest pose.
import { NodeIO } from "@gltf-transform/core";
const [, , src, dst, specFile] = process.argv;
const io = new NodeIO(); const doc = await io.read(src); const root = doc.getRoot(); const buf = root.listBuffers()[0];
const N = Object.fromEntries(root.listNodes().map((n) => [n.getName(), n]));
const quat = (x, y, z) => { const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2), c2 = Math.cos(y / 2), s2 = Math.sin(y / 2), c3 = Math.cos(z / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]; };
const mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
function clip(name, tracks) {
  const a = doc.createAnimation(name);
  for (const [node, path, keys] of tracks) {
    const n = N[node]; if (!n) throw new Error("no node " + node);
    const vals = keys.flatMap(([, v]) => {
      if (path === "rotation") return mul(n.getRotation(), quat(...v));
      if (path === "translation") { const r = n.getTranslation(); return [r[0] + v[0], r[1] + v[1], r[2] + v[2]]; }
      const r = n.getScale(); return [r[0] * v[0], r[1] * v[1], r[2] * v[2]];
    });
    const input = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(keys.map((k) => k[0]))).setBuffer(buf);
    const output = doc.createAccessor().setType(path === "rotation" ? "VEC4" : "VEC3").setArray(new Float32Array(vals)).setBuffer(buf);
    const s = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
    a.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath(path).setSampler(s));
  }
}
const Z = [0, 0, 0], ONE = [1, 1, 1];
const flap = (side, amp, times) => times.map((t, k) => [t, [0, k % 2 ? -side * amp : 0, 0]]);
const { default: spec } = await import(new URL(specFile, "file://" + process.cwd() + "/").href);
spec({ clip, Z, ONE, flap });
await io.write(dst, doc);
console.log("clips", root.listAnimations().map((a) => a.getName()).join(", "));
