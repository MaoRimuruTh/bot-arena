// Pack a CC0 scan (Poly Haven glTF) into a small game .glb: weld, simplify to a triangle budget, resize the textures,
// quantize (KHR_mesh_quantization, which three r128's GLTFLoader reads), and stand it on y=0 facing +Z.
// usage: node pack.mjs <in.gltf> <out.glb> <tris> <texDiff> <texNormal> <texArm> [yawDeg]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, quantize, prune, dedup, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [IN, OUT, TRIS = '30000', TD = '512', TN = '1024', TA = '512', YAW = '0'] = process.argv.slice(2);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
const tris = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const t0 = tris();
await doc.transform(weld(), dedup());
const want = +TRIS; if (t0 > want) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: want / t0, error: +(process.env.ERR || 0.002), lockBorder: false }));
// textures: each by its slot, resized; jpeg keeps them small (the scans' maps are jpeg already)
const sizeOf = (slot) => (/normal/i.test(slot) ? +TN : /occlusion|metallicRoughness/i.test(slot) ? +TA : +TD);
for (const tex of doc.getRoot().listTextures()) {
  const slots = doc.getGraph().listParentEdges(tex).map((e) => e.getName()).join(' ');
  const s = sizeOf(slots); const img = await sharp(Buffer.from(tex.getImage())).resize(s, s, { fit: 'inside' }).jpeg({ quality: /normal/i.test(slots) ? 88 : 80, mozjpeg: true }).toBuffer();
  tex.setImage(new Uint8Array(img)).setMimeType('image/jpeg'); if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.\w+$/, '.jpg'));
}
// positions stay float: three r128 measures a normalized (quantized) position in raw integers, which breaks the figure's sizing
await doc.transform(prune(), quantize({ pattern: /^(NORMAL|TEXCOORD_\d|TANGENT)$/, quantizeNormal: 10, quantizeTexcoord: 12 }));
// facing: a yaw on the scene's top nodes
if (+YAW) { const q = [0, Math.sin((+YAW * Math.PI) / 360), 0, Math.cos((+YAW * Math.PI) / 360)]; for (const n of doc.getRoot().getDefaultScene().listChildren()) { const r = n.getRotation(); const a = q, b = r; n.setRotation([a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]); } }
await io.write(OUT, doc);
console.log(OUT, 'tris', t0, '->', tris(), 'size', (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', 'textures', doc.getRoot().listTextures().map((t) => (t.getImage().byteLength / 1024).toFixed(0) + 'KB').join(','));
