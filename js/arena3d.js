// 3D duel arena (three.js r128 + GSAP) on a black-lacquer play mat drawn in code. Kenney particle textures are CC0.
import { card, resolveArt, colorHex, corsUrl } from "./cards.js?v=20261111043245";
import { E } from "./engine.js?v=20261111043245";
import { h } from "./util.js?v=20261111043245";
import { Sfx } from "./sfx.js?v=20261111043245";
const THREE = window.THREE, gsap = window.gsap;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let R = null; // runtime
export const Arena = {
  get on() { return !!R; },
  mount, unmount, update, idle: () => (R ? R.queue : Promise.resolve()), setHover: (fn) => R && (R.onHover = fn), setClick: (fn) => R && (R.onClick = fn),
  highlight, setLifeTarget, banner, flash, shake, popText, mood,
};

function mount(container) {
  unmount();
  const canvas = h("canvas", { "aria-label": "สนามดวล 3 มิติ" }); container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = innerWidth >= 760; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x070a14, 0.026);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  const tex = (u, srgb = true) => { const t = loader.load(u); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
  const FX = {}; ["magic_02", "magic_04", "magic_05", "spark_05", "spark_06", "slash_02", "circle_05", "smoke_03", "light_02", "star_06", "trace_01", "flare_01", "twirl_02"].forEach((n) => (FX[n] = tex("assets/fx/" + n + ".png")));
  R = { container, canvas, renderer, scene, camera, loader, FX, meshes: new Map(), texCache: new Map(), labels: new Map(), queue: Promise.resolve(), lastEv: 0, camBase: new THREE.Vector3(0, 11, 9.6), look: new THREE.Vector3(0, 0, 0.4), off: new THREE.Vector3(), alive: true, onHover: null, onClick: null, hovered: null, view: 0 };

  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x140a06, 0.5));
  const key = new THREE.DirectionalLight(0xffe2b0, 1.1); key.position.set(4, 12, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.2); rim.position.set(-6, 6, -10); scene.add(rim);
  R.goldL = new THREE.PointLight(0xffb84a, 0.8, 16, 2); R.goldL.position.set(0, 4.2, 3.6); scene.add(R.goldL);
  R.redL = new THREE.PointLight(0xff4a3a, 0.55, 16, 2); R.redL.position.set(0, 4.2, -4.4); scene.add(R.redL);

  // the play mat: black lacquer with gold-leaf line-work (ลายรดน้ำ), stepped corners (ย่อมุม) round every zone
  const small = innerWidth < 760; const mt = matTextures(small);
  R.matMat = new THREE.MeshStandardMaterial({ map: mt.base, emissiveMap: mt.glow, emissive: new THREE.Color(0xe0982c), emissiveIntensity: 0.2, roughness: 0.52, metalness: 0 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), R.matMat); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, MZ); top.receiveShadow = true; scene.add(top);
  const lacq = new THREE.MeshStandardMaterial({ color: 0x5a1812, roughness: 0.34, metalness: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(MW, 0.28, MD), lacq); body.position.set(0, -0.18, MZ); body.receiveShadow = true; scene.add(body);
  const trimM = new THREE.MeshStandardMaterial({ color: 0xc99a3e, emissive: 0x7a5414, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.3 });
  for (const [w, d, x, z] of [[MW + 0.08, 0.05, 0, MZ - MD / 2], [MW + 0.08, 0.05, 0, MZ + MD / 2], [0.05, MD, -MW / 2, MZ], [0.05, MD, MW / 2, MZ]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), trimM); t.position.set(x, 0.005, z); scene.add(t); }
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(MW * 1.9, MD * 1.9), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false })); shade.rotation.x = -Math.PI / 2; shade.position.set(0, -0.31, MZ); scene.add(shade);
  // the centre band lights up when the Battle Phase starts
  const div = new THREE.Mesh(new THREE.PlaneGeometry(MW - 3.4, 0.62), new THREE.MeshBasicMaterial({ map: R.FX.light_02, color: 0xffc35a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); div.rotation.x = -Math.PI / 2; div.position.set(1.2, 0.02, MZ); scene.add(div); R.div = div;
  R.motes = points(small ? 34 : 80, 0xffd27a, 0.1, FX.star_06, 9);
  R.lifeT = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0xff7a80, emissive: 0xff2a3a, emissiveIntensity: 1.6, roughness: 0.15 })); R.lifeT.position.set(0, 1, -4.7); R.lifeT.visible = false; scene.add(R.lifeT);
  R.lifeHalo = sprite(FX.light_02, 0xff4a52, 3.2, R.lifeT.position, 0.5); R.lifeHalo.visible = false;
  R.frame = frameTexture(); R.backTex = backTexture();
  R.cardGeo = new THREE.BoxGeometry(1.5, 0.035, 2.04); R.glowGeo = new THREE.PlaneGeometry(2.1, 2.66);
  R.edgeMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.8, roughness: 0.3 });

  if (THREE.EffectComposer && innerWidth >= 760) {
    R.composer = new THREE.EffectComposer(renderer); R.composer.addPass(new THREE.RenderPass(scene, camera));
    R.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.9));
  }
  R.resize = () => {
    const w = container.clientWidth || innerWidth, hh = container.clientHeight || innerHeight; renderer.setSize(w, hh, false); camera.aspect = w / hh;
    const portrait = w / hh < 0.9; const k = portrait ? 1 : Math.min(1.45, Math.max(1, 820 / hh, 1250 / w));
    R.camBase.set(0, portrait ? 17.5 : 11.2 * k, portrait ? 12.5 : 9.6 * k); R.look.set(0, 0, portrait ? 1.9 : 0.4); camera.fov = portrait ? 50 : 38; camera.updateProjectionMatrix();
    if (R.composer) R.composer.setSize(w, hh);
    document.documentElement.style.setProperty("--handDrop", hh < 620 ? "-28px" : hh < 760 ? "-40px" : "-44px");
  };
  addEventListener("resize", R.resize); R.resize();
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
  const pick = (e) => {
    const r = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1; ray.setFromCamera(ptr, camera);
    const objs = [...R.meshes.values()].map((m) => m.mesh); if (R.lifeT.visible) objs.push(R.lifeT);
    const hit = ray.intersectObjects(objs)[0]; return hit ? (hit.object === R.lifeT ? "life" : hit.object.userData.i) : null;
  };
  canvas.addEventListener("pointermove", (e) => {
    const p = pick(e); if (p === R.hovered) return;
    const prev = R.meshes.get(R.hovered); if (prev && !prev.busy && !prev.sel) gsap.to(prev.grp.position, { y: prev.restY, duration: 0.2 });
    R.hovered = p; canvas.style.cursor = p != null ? "pointer" : "default";
    const m = R.meshes.get(p); if (m && !m.busy) gsap.to(m.grp.position, { y: m.restY + 0.32, duration: 0.2 });
    if (R.onHover) R.onHover(p != null && p !== "life" ? p : null);
  });
  canvas.addEventListener("click", (e) => { const p = pick(e); if (p != null && R.onClick) R.onClick(p); });
  const clock = new THREE.Clock();
  const tick = () => {
    if (!R || !R.alive) return;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (!reduce) {
      for (const pts of [R.motes]) { const a = pts.geometry.attributes.position.array, sp = pts.userData.sp; for (let i = 0; i < sp.length; i++) { a[i * 3 + 1] += sp[i] * 60 * dt * (pts === R.motes ? 0.35 : 1); a[i * 3] += Math.sin(t + i) * 0.002; if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0; } pts.geometry.attributes.position.needsUpdate = true; }
      R.lifeT.rotation.y = t * 1.2; R.lifeT.position.y = 1 + Math.sin(t * 2) * 0.12; R.lifeHalo.position.copy(R.lifeT.position);
      for (const m of R.meshes.values()) if (m.pulse) m.glow.material.opacity = 0.4 + Math.sin(t * 6) * 0.25;
    }
    camera.position.set(R.camBase.x + Math.sin(t * 0.15) * 0.35 + R.off.x, R.camBase.y + R.off.y, R.camBase.z + Math.cos(t * 0.12) * 0.2); camera.lookAt(R.look);
    for (const [i, el] of R.labels) { const m = R.meshes.get(i); if (!m) continue; const s = toScreen(m.grp.position.clone().add(new THREE.Vector3(-0.55 * m.scale, 0.1, (m.side === "me" ? 0.85 : -0.85) * m.scale))); el.style.left = s.x + "px"; el.style.top = s.y + "px"; }
    if (R.composer) R.composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
  gsap.from(R.camBase, { y: 22, z: 18, duration: reduce ? 0 : 2, ease: "power3.out" });
  gsap.from(R.matMat, { emissiveIntensity: 0, duration: reduce ? 0 : 1.8, ease: "power2.out" }); // the gold leaf catches the light once
}
function unmount() {
  if (!R) return; R.alive = false; removeEventListener("resize", R.resize);
  for (const el of R.labels.values()) el.remove();
  R.renderer.dispose(); R.canvas.remove(); R = null;
}

// ---------- helpers ----------
function sprite(map, color, size, pos, opacity = 1, parent) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); s.position.copy(pos); (parent || R.scene).add(s); return s;
}
function points(n, color, size, map, spread) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3); const sp = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.random() * 9; p[i * 3 + 2] = Math.sin(a) * r; sp[i] = 0.004 + Math.random() * 0.012; }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  pts.userData.sp = sp; R.scene.add(pts); return pts;
}
// ---------- lacquer and gold leaf ----------
// world ↔ mat canvas: x ∈ [-MW/2, MW/2], z ∈ [MZ - MD/2, MZ + MD/2]; the top of the canvas is the opponent's side
const MW = 15.4, MD = 11.6, MZ = -0.2;
const GOLD = "#d8a84a";
// a frame with stepped corners (ย่อมุม), the corner shape of Thai thrones and temple bases
function stepPath(g, x0, y0, x1, y1, st) {
  g.beginPath(); g.moveTo(x0 + 2 * st, y0); g.lineTo(x1 - 2 * st, y0); g.lineTo(x1 - 2 * st, y0 + st); g.lineTo(x1 - st, y0 + st); g.lineTo(x1 - st, y0 + 2 * st); g.lineTo(x1, y0 + 2 * st);
  g.lineTo(x1, y1 - 2 * st); g.lineTo(x1 - st, y1 - 2 * st); g.lineTo(x1 - st, y1 - st); g.lineTo(x1 - 2 * st, y1 - st); g.lineTo(x1 - 2 * st, y1);
  g.lineTo(x0 + 2 * st, y1); g.lineTo(x0 + 2 * st, y1 - st); g.lineTo(x0 + st, y1 - st); g.lineTo(x0 + st, y1 - 2 * st); g.lineTo(x0, y1 - 2 * st);
  g.lineTo(x0, y0 + 2 * st); g.lineTo(x0 + st, y0 + 2 * st); g.lineTo(x0 + st, y0 + st); g.lineTo(x0 + 2 * st, y0 + st); g.closePath();
}
// ประจำยาม: the four-petal flower that sits on Thai borders and door panels
function prajamyam(g, cx, cy, r, ground) {
  g.beginPath();
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 - Math.PI / 2; const P = (d, da) => [cx + Math.cos(a + da) * d, cy + Math.sin(a + da) * d];
    g.moveTo(cx, cy); g.quadraticCurveTo(...P(r * 0.72, -0.62), ...P(r, 0)); g.quadraticCurveTo(...P(r * 0.72, 0.62), cx, cy); }
  g.fill();
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.09, 0, 7); g.fill(); }
  if (ground) { const f = g.fillStyle; g.fillStyle = ground; g.beginPath(); g.moveTo(cx, cy - r * 0.2); g.lineTo(cx + r * 0.2, cy); g.lineTo(cx, cy + r * 0.2); g.lineTo(cx - r * 0.2, cy); g.closePath(); g.fill(); g.fillStyle = f; }
}
function matTextures(small) {
  const S = small ? 84 : 128; const CW = Math.round(MW * S), CH = Math.round(MD * S);
  const mk = () => { const c = document.createElement("canvas"); c.width = CW; c.height = CH; return c; };
  const base = mk(), glow = mk(); const g = base.getContext("2d"), q = glow.getContext("2d");
  const X = (x) => (x + MW / 2) * S, Y = (z) => (z - MZ + MD / 2) * S, U = (v) => v * S;
  const LAC = "#120b09";
  // lacquer: a warm black with a soft pool of light, flecks of gold leaf, red lacquer creeping in on the opponent's side
  g.fillStyle = LAC; g.fillRect(0, 0, CW, CH); q.fillStyle = "#000"; q.fillRect(0, 0, CW, CH);
  let gr = g.createRadialGradient(CW / 2, CH * 0.55, CW * 0.05, CW / 2, CH * 0.55, CW * 0.62); gr.addColorStop(0, "rgba(64,38,28,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  gr = g.createLinearGradient(0, 0, 0, CH * 0.42); gr.addColorStop(0, "rgba(150,34,24,.30)"); gr.addColorStop(1, "rgba(150,34,24,0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH * 0.42);
  gr = g.createLinearGradient(0, CH, 0, CH * 0.6); gr.addColorStop(0, "rgba(216,168,74,.10)"); gr.addColorStop(1, "rgba(216,168,74,0)"); g.fillStyle = gr; g.fillRect(0, CH * 0.6, CW, CH * 0.4);
  for (let k = 0; k < CW * CH / 900; k++) { const v = Math.random(); g.fillStyle = v < 0.5 ? "rgba(255,255,255,.018)" : "rgba(0,0,0,.05)"; g.fillRect(Math.random() * CW, Math.random() * CH, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let k = 0; k < (small ? 260 : 520); k++) { const x = Math.random() * CW, y = Math.random() * CH, r = Math.random() * 1.6 + 0.4, a = Math.random() * 0.22 + 0.04; g.fillStyle = `rgba(232,186,92,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); q.fillStyle = `rgba(255,255,255,${a * 0.6})`; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); }
  // everything gilded is drawn twice: in gold on the mat, in white on the glow map
  const gild = (fn) => { for (const [c, col] of [[g, GOLD], [q, "#fff"]]) { c.save(); c.strokeStyle = c.fillStyle = col; c.lineJoin = "miter"; fn(c, c === g ? LAC : "#000"); c.restore(); } };
  const frame = (c, x0, z0, x1, z1, st, w = 0.035) => { c.lineWidth = U(w); stepPath(c, X(x0), Y(z0), X(x1), Y(z1), U(st)); c.stroke(); c.lineWidth = U(w * 0.38); stepPath(c, X(x0) + U(0.1), Y(z0) + U(0.1), X(x1) - U(0.1), Y(z1) - U(0.1), U(st * 0.8)); c.stroke(); };
  const label = (c, text, x, z, flip, align = "left", size = 0.19) => { c.save(); c.translate(X(x), Y(z)); if (flip) c.rotate(Math.PI); c.font = `600 ${U(size)}px "Chakra Petch", "IBM Plex Sans Thai", sans-serif`; c.textAlign = align; c.textBaseline = "middle"; c.globalAlpha = 0.8; c.fillText(text, 0, 0); c.restore(); };
  const inLabel = (c, text, x0, z0, x1, z1, flip) => (flip ? label(c, text, x1 - 0.32, z1 - 0.3, true) : label(c, text, x0 + 0.32, z0 + 0.3, false));
  const draw = () => gild((c, ground) => {
    // the mat's border: a double rule with a row of saw teeth (ฟันปลา) between
    const e = 0.2; c.lineWidth = U(0.045); stepPath(c, X(-MW / 2 + e), Y(MZ - MD / 2 + e), X(MW / 2 - e), Y(MZ + MD / 2 - e), U(0.22)); c.stroke();
    c.lineWidth = U(0.016); stepPath(c, X(-MW / 2 + e + 0.24), Y(MZ - MD / 2 + e + 0.24), X(MW / 2 - e - 0.24), Y(MZ + MD / 2 - e - 0.24), U(0.17)); c.stroke();
    const tooth = 0.17, th = 0.1; const side = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / tooth), dx = (x1 - x0) / n, dz = (z1 - z0) / n;
      c.beginPath(); for (let k = 0; k < n; k++) { const ax = x0 + dx * k, az = z0 + dz * k; c.moveTo(X(ax), Y(az)); c.lineTo(X(ax + dx / 2 + nx * th), Y(az + dz / 2 + nz * th)); c.lineTo(X(ax + dx), Y(az + dz)); } c.fill(); };
    const i0 = e + 0.07, xa = -MW / 2 + i0 + 0.5, xb = MW / 2 - i0 - 0.5, za = MZ - MD / 2 + i0 + 0.5, zb = MZ + MD / 2 - i0 - 0.5;
    side(xa, MZ - MD / 2 + i0, xb, MZ - MD / 2 + i0, 0, 1); side(xa, MZ + MD / 2 - i0, xb, MZ + MD / 2 - i0, 0, -1); side(-MW / 2 + i0, za, -MW / 2 + i0, zb, 1, 0); side(MW / 2 - i0, za, MW / 2 - i0, zb, -1, 0);
    // zones, mine near and the opponent's far (their labels face them)
    for (const [zs, flip] of [[1, false], [-1, true]]) {
      const zc = zs > 0 ? 2.15 : -2.55, zo = zs > 0 ? 4.17 : -4.5;
      frame(c, -4.35, zc - 1.18, 4.35, zc + 1.18, 0.16); inLabel(c, "Avatar Zone", -4.35, zc - 1.18, 4.35, zc + 1.18, flip);
      prajamyam(c, X(0), Y(zc - zs * 1.18), U(0.2), ground); prajamyam(c, X(0), Y(zc + zs * 1.18), U(0.13), ground);
      frame(c, -5.8, zo - 0.76, -1.8, zo + 0.76, 0.11, 0.028); inLabel(c, "Construct Zone", -5.8, zo - 0.76, -1.8, zo + 0.76, flip);
      frame(c, -1.2, zo - 0.76, 5.8, zo + 0.76, 0.11, 0.028); inLabel(c, "Magic Zone", -1.2, zo - 0.76, 5.8, zo + 0.76, flip);
    }
    // Land Magic Zone, shared in the middle on the left; the centre band of ประจำยาม runs from it
    frame(c, -6.98, MZ - 1.72, -5.12, MZ + 1.72, 0.13, 0.03); label(c, "Land Magic", -6.05, MZ + 1.95, false, "center");
    c.lineWidth = U(0.022); for (const dz of [-0.24, 0.24]) { c.beginPath(); c.moveTo(X(-4.6), Y(MZ + dz)); c.lineTo(X(6.85), Y(MZ + dz)); c.stroke(); }
    for (let x = -4.2; x <= 6.6; x += 0.9) prajamyam(c, X(x), Y(MZ), U(0.14), ground);
    for (const x of [-4.6, 6.85]) prajamyam(c, X(x), Y(MZ), U(0.3), ground);
  });
  draw();
  const tb = new THREE.CanvasTexture(base), tg = new THREE.CanvasTexture(glow); tb.encoding = THREE.sRGBEncoding; tb.anisotropy = 8; tg.anisotropy = 8;
  // the labels need the display font: redraw once it has loaded
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => { if (!R) return; draw(); tb.needsUpdate = true; tg.needsUpdate = true; });
  return { base: tb, glow: tg };
}
function softShadow() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(0.55, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function frameTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 340; const g = c.getContext("2d");
  const rr = (x, y, w, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.shadowColor = "#fff"; g.shadowBlur = 14; g.strokeStyle = "#fff"; g.lineWidth = 5; rr(14, 14, 228, 312, 22); g.stroke();
  return new THREE.CanvasTexture(c);
}
function backTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 348; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 256, 348); gr.addColorStop(0, "#4a120d"); gr.addColorStop(1, "#7a2018"); g.fillStyle = gr; g.fillRect(0, 0, 256, 348);
  g.strokeStyle = g.fillStyle = GOLD; g.lineWidth = 6; stepPath(g, 12, 12, 244, 336, 14); g.stroke(); g.lineWidth = 2; stepPath(g, 24, 24, 232, 324, 11); g.stroke();
  prajamyam(g, 128, 160, 46, "#5c1710"); for (const y of [64, 256]) prajamyam(g, 128, y, 16, "#5c1710");
  g.font = '700 30px "Chakra Petch", sans-serif'; g.textAlign = "center"; g.fillText("BoT", 128, 300);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function tokenTexture(d) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 348; const g = c.getContext("2d");
  g.fillStyle = "#2a1712"; g.fillRect(0, 0, 256, 348); g.strokeStyle = "#" + colorHex(d.co).toString(16).padStart(6, "0"); g.lineWidth = 10; g.strokeRect(6, 6, 244, 336);
  g.fillStyle = "#ffd986"; g.font = "700 30px sans-serif"; g.textAlign = "center"; g.fillText("TOKEN", 128, 70); g.fillStyle = "#fff"; g.font = "600 28px sans-serif"; g.fillText(d.n.slice(0, 12), 128, 180);
  g.font = "700 64px sans-serif"; g.fillStyle = "#ffd986"; g.fillText(String(d.pw || 0), 128, 290);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function faceMat(d) {
  // card faces are unlit so the official art keeps its real colours (no light/bloom wash-out)
  if (d.t === "T" || d.im == null) return new THREE.MeshBasicMaterial({ map: tokenTexture(d), color: 0xdedede, toneMapped: false });
  const mat = new THREE.MeshBasicMaterial({ map: R.backTex, color: 0xdedede, toneMapped: false });
  const cached = R.texCache.get(d.im); if (cached) { mat.map = cached; return mat; }
  resolveArt(card(d.im)).then((url) => { if (!url || !R) return; R.loader.load(corsUrl(url), (t) => { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; R.texCache.set(d.im, t); mat.map = t; mat.needsUpdate = true; }); });
  return mat;
}
const toScreen = (v) => { const p = v.clone().project(R.camera); const r = R.canvas.getBoundingClientRect(); return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height }; };
function burst(pos, { n = 18, map, color = 0xffc35a, size = 0.5, spread = 2.4, up = 1.6, dur = 0.7 } = {}) {
  map = map || R.FX.spark_06;
  for (let i = 0; i < n; i++) {
    const s = sprite(map, color, size * (0.5 + Math.random()), pos); const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
    gsap.to(s.position, { x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r, y: pos.y + Math.random() * up, duration: dur, ease: "power3.out" });
    gsap.to(s.material, { opacity: 0, rotation: Math.random() * 4 - 2, duration: dur, ease: "power2.in", onComplete: () => { R && R.scene.remove(s); s.material.dispose(); } });
  }
}
function shockwave(pos, color = 0xffc35a, scale = 7) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: R.FX.circle_05, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.06, pos.z); m.scale.setScalar(0.3); R.scene.add(m);
  gsap.to(m.scale, { x: scale, y: scale, z: scale, duration: 0.7, ease: "power2.out" });
  gsap.to(m.material, { opacity: 0, duration: 0.7, ease: "power1.in", onComplete: () => { R && R.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
function pillar(pos, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 6, 32, 1, true), new THREE.MeshBasicMaterial({ map: R.FX.trace_01, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(pos.x, 3, pos.z); R.scene.add(m);
  gsap.to(m.material, { opacity: 0.8, duration: 0.15 }); gsap.to(m.scale, { x: 0.2, z: 0.2, duration: 0.6, ease: "power2.in" });
  gsap.to(m.material, { opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => R && R.scene.remove(m) });
}
// flat glowing decal on the floor that spins and fades
function decal(map, pos, color, size, dur = 1.1, spin = 1.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.07, pos.z); m.scale.setScalar(size * 0.4); R.scene.add(m);
  gsap.to(m.scale, { x: size, y: size, z: size, duration: dur * 0.6, ease: "power2.out" }); gsap.to(m.rotation, { z: spin, duration: dur });
  gsap.to(m.material, { opacity: 0, duration: dur * 0.6, delay: dur * 0.4, onComplete: () => { R && R.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
// each card colour gets its own flavour: red fire, blue water, green nature, purple dark magic
export function colorFx(pos, co, big = 1) {
  if (!R || reduce) return; const c = colorHex(co); const p = pos.clone().setY(0.3);
  if (co === "แดง") { burst(p, { n: 26 * big, map: R.FX.spark_05, color: 0xff7a2a, size: 0.45, spread: 1.6, up: 3.4, dur: 1 }); burst(p, { n: 6, map: R.FX.flare_01, color: 0xffb04a, size: 1.4, spread: 0.8, up: 1.2, dur: 0.6 }); }
  else if (co === "ฟ้า") { decal(R.FX.magic_04, pos, 0x5fb6ff, 4.6 * big, 1.2, -2); shockwave(pos, 0x7fd0ff, 5.5 * big); setTimeout(() => R && shockwave(pos, 0x3d8fe0, 4 * big), 160); burst(p, { n: 18 * big, map: R.FX.star_06, color: 0xbfe6ff, size: 0.35, spread: 2, up: 1.6 }); }
  else if (co === "เขียว") { decal(R.FX.twirl_02, pos, 0x5fe08a, 4.2 * big, 1.3, 3); burst(p, { n: 22 * big, map: R.FX.spark_06, color: 0x8dff9e, size: 0.4, spread: 1.8, up: 2.6, dur: 1.1 }); }
  else if (co === "ม่วง") { decal(R.FX.magic_05, pos, 0xb47bff, 4.8 * big, 1.4, 2.5); burst(p, { n: 12, map: R.FX.smoke_03, color: 0x7a4bc9, size: 1.6, spread: 1.4, up: 1.2, dur: 1.3 }); burst(p, { n: 14 * big, map: R.FX.spark_05, color: 0xd9b8ff, size: 0.35, spread: 2, up: 2 }); }
  else burst(p, { color: c });
}
export function banner(t, s) {
  let b = document.querySelector(".banner"); if (!b) { b = h("div", { class: "banner" }, h("div", { class: "band" }, h("b"), h("span"))); document.body.append(b); }
  b.querySelector("b").textContent = t; b.querySelector("span").textContent = s || ""; const band = b.querySelector(".band");
  gsap.killTweensOf(band); gsap.fromTo(band, { opacity: 0, scaleX: 0.4 }, { opacity: 1, scaleX: 1, duration: 0.35, ease: "power3.out" });
  gsap.fromTo(b.querySelector("b"), { letterSpacing: "0.6em", opacity: 0 }, { letterSpacing: "0.25em", opacity: 1, duration: 0.5, ease: "power3.out" });
  gsap.to(band, { opacity: 0, duration: 0.4, delay: 1.3 });
}
export function flash(color, a = 0.45) { let f = document.querySelector(".flash"); if (!f) { f = h("div", { class: "flash" }); document.body.append(f); } f.style.background = color; gsap.fromTo(f, { opacity: a }, { opacity: 0, duration: 0.5, ease: "power2.out" }); }
export function shake(p = 0.25, d = 0.4) { if (reduce || !R) return; gsap.fromTo(R.off, { x: p, y: p * 0.6 }, { x: 0, y: 0, duration: d, ease: "elastic.out(1.2,0.3)" }); }
export function popText(pos3, text, color) {
  if (!R) return; const s = toScreen(pos3); const d = h("div", { class: "dmg" }, text); d.style.left = s.x + "px"; d.style.top = s.y + "px"; if (color) d.style.textShadow = `0 0 14px ${color},0 2px 0 #000`;
  document.body.append(d); gsap.fromTo(d, { y: 0, scale: 0.4, opacity: 0 }, { y: -40, scale: 1, opacity: 1, duration: 0.35, ease: "back.out(3)" }); gsap.to(d, { y: -90, opacity: 0, duration: 0.6, delay: 0.55, onComplete: () => d.remove() });
}
export function mood(mine) { if (!R) return; gsap.to(R.goldL, { intensity: mine ? 0.95 : 0.5, duration: 0.8 }); gsap.to(R.redL, { intensity: mine ? 0.45 : 0.9, duration: 0.8 }); }
export function highlight(ids, on = true) { if (!R) return; for (const m of R.meshes.values()) { const hit = ids.includes(m.i); m.pulse = on && hit; if (!m.pulse) gsap.to(m.glow.material, { opacity: m.sel ? 0.7 : 0.2, duration: 0.2 }); } }
export function setLifeTarget(v) { if (!R) return; R.lifeT.visible = v; R.lifeHalo.visible = v; }
export function select(i) { if (!R) return; for (const m of R.meshes.values()) { m.sel = m.i === i; gsap.to(m.glow.material, { opacity: m.sel ? 0.7 : 0.2, duration: 0.2 }); gsap.to(m.grp.position, { y: m.restY + (m.sel ? 0.4 : 0), duration: 0.2 }); } }
Arena.select = select;

// ---------- layout ----------
function layout(s, V) {
  const out = new Map();
  for (const p of [0, 1]) {
    const side = p === V ? "me" : "opp"; const P = s.P[p]; const zs = side === "me" ? 1 : -1;
    const n = P.av.length; P.av.forEach((x, k) => out.set(x.i, { x, p, side, zone: "av", pos: new THREE.Vector3((k - (n - 1) / 2) * 2.05, 0.04, side === "me" ? 2.15 : -2.55), scale: 1 }));
    P.cs.forEach((x, k) => out.set(x.i, { x, p, side, zone: "cs", pos: new THREE.Vector3(-5.1 + k * 1.3, 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: 0.68 }));
    P.mg.forEach((x, k) => out.set(x.i, { x, p, side, zone: "mg", pos: new THREE.Vector3(5.1 - k * 1.15, 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: 0.6 }));
  }
  { const two = !!(s.land && s.land2); for (const l of [s.land, s.land2]) if (l) out.set(l.i, { x: l, p: l.o, side: l.o === V ? "me" : "opp", zone: "land", pos: new THREE.Vector3(-6.05, 0.04, two ? (l.o === V ? 0.6 : -1.0) : -0.2), scale: two ? 0.6 : 0.72 }); } // แบ่งแยกดินแดน: one Land per side
  return out;
}
function makeMesh(s, L) {
  const d = E.def(s, L.x);
  const mesh = new THREE.Mesh(R.cardGeo, [R.edgeMat, R.edgeMat, faceMat(d), new THREE.MeshBasicMaterial({ map: R.backTex, color: 0xcccccc, toneMapped: false }), R.edgeMat, R.edgeMat]); mesh.castShadow = true;
  const col = L.side === "me" ? 0xffc35a : 0xff4a52;
  const glow = new THREE.Mesh(R.glowGeo, new THREE.MeshBasicMaterial({ map: R.FX.light_02, color: L.zone === "land" ? 0x8fb0ff : col, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = -0.03;
  const grp = new THREE.Group(); grp.add(glow); grp.add(mesh); R.scene.add(grp);
  const m = { i: L.x.i, grp, mesh, glow, side: L.side, zone: L.zone, scale: L.scale, restY: 0.04, sleep: false, sel: false, pulse: false, busy: false };
  mesh.userData.i = L.x.i; return m;
}
function label(s, m, x) {
  const d = E.def(s, x); if (!(d.t === "A" || d.t === "T" || d.t === "C")) { const old = R.labels.get(m.i); if (old) { old.remove(); R.labels.delete(m.i); } return; }
  let el = R.labels.get(m.i); if (!el) { el = h("div", { class: "pwl" }); document.body.append(el); R.labels.set(m.i, el); }
  const p = E.power(s, x), b = d.pw || 0; el.textContent = p; el.className = "pwl" + (m.side === "opp" ? " opp" : "") + (p > b ? " up" : p < b ? " down" : "") + (x.a === false ? " sleep" : "");
}
function sync(s, V, drops) {
  const want = layout(s, V);
  for (const [i, m] of R.meshes) if (!want.has(i)) { // left the field
    R.meshes.delete(i); const el = R.labels.get(i); if (el) { el.remove(); R.labels.delete(i); }
    const p = m.grp.position.clone();
    gsap.to(m.grp.position, { y: 1.4, duration: 0.35, ease: "power2.out" }); gsap.to(m.grp.rotation, { x: Math.PI * 1.2, z: 0.8, duration: 0.6, ease: "power2.in" });
    gsap.to(m.grp.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.55, delay: 0.2, ease: "power3.in", onComplete: () => R && R.scene.remove(m.grp) });
    burst(p.clone().setY(0.6), { n: 12, map: R.FX.smoke_03, color: 0x8899bb, size: 1.3, spread: 1.5, dur: 1 });
  }
  for (const [i, L] of want) {
    let m = R.meshes.get(i); const fresh = !m;
    if (fresh) { m = makeMesh(s, L); R.meshes.set(i, m); }
    m.side = L.side; m.zone = L.zone; m.scale = L.scale;
    const rotY = (L.side === "opp" ? Math.PI : 0) + (L.x.a === false && L.zone === "av" ? -Math.PI / 2 : 0);
    if (fresh) {
      const drop = true;
      m.grp.scale.setScalar(L.scale * 1.25); m.grp.position.set(L.pos.x, drop ? 7 : L.pos.y, L.pos.z + 1.5); m.grp.rotation.set(-0.6, rotY, 0.4);
      const co = E.def(s, L.x).co; const cHex = co ? colorHex(co) : (L.side === "me" ? 0xffc35a : 0xff4a52);
      if (drops.has(i)) { pillar(L.pos, cHex); Sfx.play("summon", { color: co }); }
      m.busy = true;
      gsap.timeline({ onComplete: () => { m.busy = false; } })
        .to(m.grp.position, { x: L.pos.x, y: L.pos.y, z: L.pos.z, duration: 0.55, ease: "power4.in" }, 0.1)
        .to(m.grp.rotation, { x: 0, z: 0, duration: 0.55, ease: "power3.in" }, 0.1)
        .to(m.grp.scale, { x: L.scale, y: L.scale, z: L.scale, duration: 0.55, ease: "power3.in" }, 0.1)
        .add(() => { if (drops.has(i)) { shockwave(L.pos, cHex); colorFx(L.pos, co); shake(0.16); } }, 0.65);
    } else if (!m.busy) {
      gsap.to(m.grp.position, { x: L.pos.x, y: m.sel ? m.restY + 0.4 : L.pos.y, z: L.pos.z, duration: 0.4, ease: "power2.out" });
      gsap.to(m.grp.rotation, { y: rotY, duration: 0.45, ease: "power2.inOut" }); gsap.to(m.grp.scale, { x: L.scale, y: L.scale, z: L.scale, duration: 0.3 });
    }
    label(s, m, L.x);
  }
}
async function animateEvent(ev, prev, s, V) {
  const pos = (i) => { const m = R.meshes.get(i); return m ? m.grp.position.clone() : null; };
  const mineSide = (p) => p === V;
  if (ev.k === "clash") {
    const m = R.meshes.get(ev.att); if (!m) return;
    const from = m.grp.position.clone(); let to = ev.tk === "life" ? new THREE.Vector3(0, 0.6, mineSide(ev.by) ? -4.7 : 5.3) : pos(ev.ti); if (!to) return;
    const hit = from.clone().add(to.clone().sub(from).multiplyScalar(0.82)); m.busy = true;
    const aco = (s.cards[(E.locate(s, ev.att) || { x: {} }).x.c] || {}).co; const tint = aco ? colorHex(aco) : 0xfff1c9; Sfx.play("declare");
    await new Promise((res) => gsap.timeline({ onComplete: res })
      .to(m.grp.position, { y: 1.3, duration: 0.22, ease: "power2.out" }).to(m.glow.material, { opacity: 1, duration: 0.2 }, "<")
      .to(m.grp.position, { x: hit.x, z: hit.z, y: 0.6, duration: 0.26, ease: "power4.in" })
      .add(() => {
        Sfx.play("clash"); const sl = sprite(R.FX.slash_02, tint, 3.6, hit.clone().setY(1)); sl.material.rotation = Math.random() * 2;
        gsap.fromTo(sl.scale, { x: 0.5, y: 0.5 }, { x: 4.2, y: 4.2, duration: 0.25, ease: "power3.out" }); gsap.to(sl.material, { opacity: 0, duration: 0.35, delay: 0.1, onComplete: () => R && R.scene.remove(sl) });
        burst(hit.clone().setY(0.8), { n: 24, color: 0xffd27a, spread: 2.8, size: 0.55 }); shockwave(hit, aco ? tint : 0xff8a4a, 5); if (aco) colorFx(hit, aco, 0.6); shake(0.42, 0.6); flash("rgba(255,240,210,.5)", 0.45);
      })
      .to(m.grp.position, { x: from.x, y: from.y, z: from.z, duration: 0.42, ease: "power2.out" }, "+=0.1").to(m.glow.material, { opacity: 0.2, duration: 0.4 }, "<")
      .add(() => { m.busy = false; }));
  } else if (ev.k === "life") {
    const mine = mineSide(ev.p); Sfx.play("life"); flash(mine ? "rgba(255,40,60,.5)" : "rgba(255,200,90,.35)", 0.5);
    popText(new THREE.Vector3(0, 1.2, mine ? 5.2 : -4.7), "LIFE −1", "#ff4d55");
    burst(new THREE.Vector3(0, 1, mine ? 5.2 : -4.7), { n: 26, color: 0xff6a70, spread: 2.2 });
  } else if (ev.k === "destroy") {
    Sfx.play("destroy"); const p = pos(ev.i); if (p) { popText(p.clone().setY(1), "BREAK", "#ff4d55"); burst(p.clone().setY(0.6), { n: 20, map: R.FX.spark_05, color: 0xff7a4a, size: 0.4, spread: 2.4 }); }
  } else if (ev.k === "cast") {
    const d = s.cards[(E.locate(s, ev.i) || { x: { c: "" } }).x.c]; const mco = d && d.co; const mpos = new THREE.Vector3(0, 0, mineSide(ev.p) ? 3.9 : -4.4);
    Sfx.play(ev.st === "L" ? "land" : "cast", { color: mco });
    pillar(mpos, mco ? colorHex(mco) : ev.st === "L" ? 0x8fb0ff : 0xc9a2ff); burst(new THREE.Vector3(0, 0.6, -0.2), { n: 16, map: R.FX.star_06, color: 0xbfd0ff, spread: 3 });
    if (ev.st === "L") decal(R.FX.magic_02, new THREE.Vector3(0, 0, -0.2), mco ? colorHex(mco) : 0x8fb0ff, 9, 1.8, 1.2); else if (mco) colorFx(mpos, mco, 0.8);
    if (d) popText(new THREE.Vector3(0, 1.4, -0.2), d.n, "#8fb0ff");
  } else if (ev.k === "turn") {
    mood(mineSide(ev.p)); Sfx.play("turn", { mine: mineSide(ev.p) }); banner(mineSide(ev.p) ? "YOUR TURN" : s.P[ev.p].name, `เทิร์น ${ev.t}`); await sleepMs(500);
  } else if (ev.k === "battle") {
    Sfx.play("battle"); banner("BATTLE PHASE", ""); gsap.fromTo(R.div.material, { opacity: 0.9 }, { opacity: 0, duration: 1.4, ease: "power2.out" });
  } else if (ev.k === "over") {
    Sfx.play(ev.w === V ? "win" : "lose"); banner(ev.w === V ? "VICTORY" : "DEFEAT", ""); flash(ev.w === V ? "rgba(255,210,120,.5)" : "rgba(80,0,10,.6)", 0.6);
  }
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function update(s, V, opts = {}) {
  if (!R) return Promise.resolve();
  R.queue = R.queue.then(async () => {
    if (!R) return;
    if (opts.reset || R.view !== V) { R.lastEv = s.evc || 0; R.view = V; }
    const evs = (s.ev || []).filter((e) => e.id > R.lastEv); R.lastEv = s.evc || R.lastEv;
    const drops = new Set(evs.filter((e) => e.k === "summon").map((e) => e.i));
    for (const e of evs) if (e.k !== "summon") { try { await animateEvent(e, null, s, V); } catch (err) { console.warn(err); } }
    sync(s, V, drops);
    if (drops.size) await sleepMs(700);
  });
  return R.queue;
}
