// 3D duel arena (three.js r128 + GSAP) on a black-lacquer play mat drawn in code. Kenney particle textures are CC0.
import { card, resolveArt, colorHex, corsUrl } from "./cards.js?v=20261111091418";
import { E } from "./engine.js?v=20261111091418";
import { h } from "./util.js?v=20261111091418";
import { Sfx } from "./sfx.js?v=20261111091418";
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
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0b0605, 0.026);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  const tex = (u, srgb = true) => { const t = loader.load(u); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
  const FX = {}; ["magic_02", "slash_02", "circle_05", "smoke_03", "light_02", "star_06", "flare_01", "twirl_02"].forEach((n) => (FX[n] = tex("assets/fx/" + n + ".png")));
  R = { container, canvas, renderer, scene, camera, loader, FX, meshes: new Map(), dying: new Set(), texCache: new Map(), labels: new Map(), queue: Promise.resolve(), lastEv: 0, camBase: new THREE.Vector3(0, 11, 9.6), look: new THREE.Vector3(0, 0, 0.4), off: new THREE.Vector3(), alive: true, onHover: null, onClick: null, hovered: null, view: 0 };

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
  FX.dot = dotTexture(); R.beamTex = beamTexture(); R.backTex = backTexture(); R.rimTex = haloTexture(18, 5); R.shadowTex = haloTexture(24, 0); R.sigilTex = sigilTexture();
  R.geo = cardGeometry(); R.capMat = new THREE.MeshBasicMaterial({ visible: false });
  R.edgeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.62, metalness: 0 }); // the paper core, not metal
  R.backMat = new THREE.MeshBasicMaterial({ map: R.backTex, color: 0xcccccc, toneMapped: false });
  // the teak table the mat lies on, and candles in brass dishes round it (two of them light the table on larger screens)
  const wood = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshStandardMaterial({ map: woodTexture(small), roughness: 0.55, metalness: 0 }));
  wood.rotation.x = -Math.PI / 2; wood.position.set(0, -0.335, -2); wood.receiveShadow = true; scene.add(wood);
  R.flameTex = flameTexture();
  R.candles = [[-4.6, -8.7], [4.6, -8.7], [-9.4, -4.8], [9.4, -4.8]].map(([x, z], k) => candle(x, z, !small && k >= 2));

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
    const prev = R.meshes.get(R.hovered); if (prev && !prev.busy) { if (!prev.sel) gsap.to(prev.grp.position, { y: prev.restY, duration: 0.2 }); gsap.to(prev.grp.rotation, { x: 0, duration: 0.25 }); }
    R.hovered = p; canvas.style.cursor = p != null ? "pointer" : "default";
    // picked up: the card lifts, tips toward you and the light runs across its laminate
    const m = R.meshes.get(p); if (m && !m.busy) { gsap.to(m.grp.position, { y: m.restY + 0.32, duration: 0.2 }); gsap.to(m.grp.rotation, { x: 0.22, duration: 0.25, ease: "power2.out" }); sweep(m, 0.75, 0.6); }
    if (R.onHover) R.onHover(p != null && p !== "life" ? p : null);
  });
  canvas.addEventListener("click", (e) => { const p = pick(e); if (p != null && R.onClick) R.onClick(p); });
  const clock = new THREE.Clock();
  const tick = () => {
    if (!R || !R.alive) return;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (!reduce) {
      for (const pts of [R.motes]) { const a = pts.geometry.attributes.position.array, sp = pts.userData.sp; for (let i = 0; i < sp.length; i++) { a[i * 3 + 1] += sp[i] * 60 * dt * (pts === R.motes ? 0.35 : 1); a[i * 3] += Math.sin(t + i) * 0.002; if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0; } pts.geometry.attributes.position.needsUpdate = true; }
      for (const c of R.candles) { const f = 1 + 0.07 * Math.sin(t * 13 + c.ph) + 0.05 * Math.sin(t * 7.3 + c.ph * 2) + Math.random() * 0.03; c.flame.scale.set(0.16 * (2 - f), 0.36 * f, 1); c.halo.material.opacity = 0.32 * f; if (c.L) c.L.intensity = 0.55 * f; }
      R.lifeT.rotation.y = t * 1.2; R.lifeT.position.y = 1 + Math.sin(t * 2) * 0.12; R.lifeHalo.position.copy(R.lifeT.position);
      for (const m of R.meshes.values()) {
        if (m.pulse) m.glow.material.opacity = 0.45 + Math.sin(t * 6) * 0.3;
        if (t > m.nextSweep && !m.busy) { sweep(m, 0.22 + m.u.uFoil.value * 0.35, 1.3); m.nextSweep = t + 7 + Math.random() * 10; } // now and then the lamps catch a card
      }
    }
    R.t = t; for (const m of R.meshes.values()) placeShadow(m); for (const m of R.dying) placeShadow(m);
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
// dark teak planks: grain running along each plank, a seam between them, each plank a slightly different tone
function woodTexture(small) {
  const S = small ? 512 : 1024, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), img = g.createImageData(S, S), d = img.data;
  const N = 4, pw = S / N, ph = [...Array(N)].map(() => Math.random() * 50), tone = [...Array(N)].map(() => 0.85 + Math.random() * 0.3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = Math.floor(x / pw), lx = x - p * pw, w = lx + 7 * Math.sin(y * 0.011 + ph[p]) + 3 * Math.sin(y * 0.037 + ph[p] * 2);
    const v = Math.max(0, Math.min(1, 0.5 + 0.18 * Math.sin(w * 0.33 + ph[p]) + 0.08 * Math.sin(w * 1.7 + ph[p] * 5) + (Math.random() - 0.5) * 0.12));
    const k = tone[p] * (lx < 2 ? 0.35 : 1), i = (y * S + x) * 4;
    d[i] = (28 + 26 * v) * k; d[i + 1] = (15 + 13 * v) * k; d[i + 2] = (9 + 7 * v) * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 4); t.anisotropy = 8; return t;
}
function flameTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  let gr = g.createRadialGradient(32, 84, 2, 32, 76, 46); gr.addColorStop(0, "rgba(255,190,90,.9)"); gr.addColorStop(1, "rgba(255,90,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.beginPath(); g.moveTo(32, 14); g.bezierCurveTo(46, 52, 46, 82, 32, 100); g.bezierCurveTo(18, 82, 18, 52, 32, 14); gr = g.createLinearGradient(0, 14, 0, 100); gr.addColorStop(0, "rgba(255,170,60,.0)"); gr.addColorStop(0.45, "rgba(255,214,120,.95)"); gr.addColorStop(1, "rgba(255,250,230,1)"); g.fillStyle = gr; g.fill();
  return new THREE.CanvasTexture(c);
}
function candle(x, z, light) {
  const grp = new THREE.Group(); grp.position.set(x, -0.335, z);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xc99a3e, metalness: 0.6, roughness: 0.35 })); dish.position.y = 0.03;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.62, 20), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6, emissive: 0x3a2008, emissiveIntensity: 0.5 })); wax.position.y = 0.37;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flame.scale.set(0.16, 0.36, 1); flame.position.y = 0.86;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.FX.dot, color: 0xffa040, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(1.3, 1.3, 1); halo.position.y = 0.86;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0xff9a40, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004;
  grp.add(dish, wax, flame, halo, pool);
  let L = null; if (light) { L = new THREE.PointLight(0xffa24a, 0.55, 7, 2); L.position.y = 1; grp.add(L); }
  R.scene.add(grp); return { flame, halo, L, ph: Math.random() * 10 };
}
function softShadow() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(0.55, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
// ---------- cards: thin and round-cornered like the real thing, with a laminated face ----------
const CARD = { w: 1.5, h: 2.04, t: 0.014, r: 0.085 };
const HALO = { w: (CARD.w * 256) / 196, h: (CARD.h * 327) / 267 }; // haloTexture draws the card outline 30px inside a 256×327 canvas
function cardGeometry() {
  const { w, h: hh, t, r } = CARD, x = w / 2, y = hh / 2, sh = new THREE.Shape();
  sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r); sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y);
  sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r); sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
  const face = new THREE.ShapeGeometry(sh, 6), uv = face.attributes.uv, ps = face.attributes.position;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (ps.getX(k) + x) / w, (ps.getY(k) + y) / hh);
  face.rotateX(-Math.PI / 2); // lies on the table with the picture's top away from its owner
  const back = face.clone().rotateZ(Math.PI); face.translate(0, t / 2, 0); back.translate(0, -t / 2, 0);
  const edge = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -t / 2, 0);
  return { face, back, edge, halo: new THREE.PlaneGeometry(HALO.w, HALO.h).rotateX(-Math.PI / 2) };
}
// a soft card-shaped glow: a rim light when stroked, a contact shadow when filled (white on black, used additively or as an alpha map)
function haloTexture(blur, stroke) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 327; const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 256, 327);
  const x = 30, y = 30, w = 196, hh = 267, r = 11;
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  g.shadowColor = "#fff"; g.shadowBlur = blur; g.fillStyle = g.strokeStyle = "#fff";
  if (stroke) { g.lineWidth = stroke; g.stroke(); g.stroke(); } else g.fill();
  return new THREE.CanvasTexture(c);
}
// the summoning circle: rings of lotus petals (กลีบบัว) round a ประจำยาม, in the gold-leaf manner of the mat
function sigilTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"), C = 256;
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512); g.strokeStyle = g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 10;
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  ring(238, 7); ring(222, 2); ring(146, 4); ring(132, 1.5);
  for (let k = 0; k < 16; k++) { // petals
    const a = (k / 16) * Math.PI * 2, P = (d, da) => [C + Math.cos(a + da) * d, C + Math.sin(a + da) * d];
    g.lineWidth = 3; g.beginPath(); g.moveTo(...P(152, -0.16)); g.quadraticCurveTo(...P(196, -0.13), ...P(214, 0)); g.quadraticCurveTo(...P(196, 0.13), ...P(152, 0.16)); g.stroke();
    g.beginPath(); g.arc(...P(230, Math.PI / 16), 4, 0, 7); g.fill();
  }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.lineWidth = 2; g.beginPath(); g.moveTo(C + Math.cos(a) * 60, C + Math.sin(a) * 60); g.lineTo(C + Math.cos(a) * 128, C + Math.sin(a) * 128); g.stroke(); }
  prajamyam(g, C, C, 92, "#000");
  return new THREE.CanvasTexture(c);
}
// a card face: the official art drawn unlit, plus a light that sweeps across the laminate, holo foil on rare prints,
// a white hit flash, and the burn that eats the card from its edges when it is destroyed
const FACE_HOOK = function (sh) {
  Object.assign(sh.uniforms, this.userData.u);
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vNw;").replace("#include <project_vertex>", "#include <project_vertex>\nvNw = normalize(mat3(modelMatrix) * normal);");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
uniform float uBurn, uSweep, uSheen, uFoil, uFlash; uniform vec3 uEdge, uTint; varying vec3 vNw;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vn(p); p = p * 2.03 + 1.7; a *= 0.5; } return v / 0.9375; }
vec3 hue(float x) { return clamp(abs(mod(x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }`).replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );", `vec3 col = outgoingLight;
  float sw = vUv.x * 0.8 - vUv.y - uSweep; float band = exp(-sw * sw * 36.0);
  col += band * uSheen * mix(vec3(1.0, 0.97, 0.9), uTint, 0.4);
  if (uFoil > 0.0) { vec3 N = normalize(vNw); col += hue(fract(vUv.x * 1.2 + vUv.y * 0.8 + N.x * 2.2 + N.z * 2.6 + uSweep * 0.35)) * uFoil * (0.06 + 0.35 * band); }
  col = mix(col, vec3(1.0), uFlash);
  if (uBurn > 0.0) {
    vec2 q = min(vUv, 1.0 - vUv); float e = fbm(vUv * vec2(4.5, 6.0)) * 0.6 + clamp(min(q.x * 2.4, q.y * 1.8), 0.0, 1.0) * 0.4 - uBurn * 1.1 + 0.04;
    if (e < 0.0) discard;
    float rim = 1.0 - smoothstep(0.0, 0.09, e);
    col *= mix(0.12, 1.0, smoothstep(0.0, 0.22, e));
    col += uEdge * rim * 1.2 + vec3(1.0, 0.92, 0.75) * pow(rim, 8.0) * 0.5;
  }
  gl_FragColor = vec4( col, diffuseColor.a );`);
};
const FOIL = { SR: 0.3, PR: 0.45, UR: 0.55, CBR: 0.6, SCR: 0.8, USEC: 1 };
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
  // card faces are unlit so the official art keeps its real colours (no light/bloom wash-out); FACE_HOOK adds the sheen and the burn
  const token = d.t === "T" || d.im == null, c = token ? null : card(d.im);
  const u = { uBurn: { value: 0 }, uSweep: { value: -2 }, uSheen: { value: 0 }, uFoil: { value: (c && FOIL[c.r]) || 0 }, uFlash: { value: 0 }, uEdge: { value: new THREE.Color(0xff8a2a) }, uTint: { value: new THREE.Color(d.co ? colorHex(d.co) : 0xffd9a0) } };
  const mat = new THREE.MeshBasicMaterial({ map: token ? tokenTexture(d) : R.texCache.get(d.im) || R.backTex, color: 0xdedede, toneMapped: false });
  mat.userData.u = u; mat.userData.own = token; mat.onBeforeCompile = FACE_HOOK;
  if (!token && mat.map === R.backTex) resolveArt(c).then((url) => { if (!url || !R) return; R.loader.load(corsUrl(url), (t) => { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; R.texCache.set(d.im, t); mat.map = t; mat.needsUpdate = true; }); });
  return mat;
}
const toScreen = (v) => { const p = v.clone().project(R.camera); const r = R.canvas.getBoundingClientRect(); return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height }; };
function burst(pos, { n = 18, map, color = 0xffc35a, size = 0.5, spread = 2.4, up = 1.6, dur = 0.7 } = {}) {
  map = map || R.FX.dot;
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
// a column of light rising from the floor
function pillar(pos, color, s = 1) {
  const g = new THREE.CylinderGeometry(0.62 * s, 0.78 * s, 5, 40, 1, true).translate(0, 2.5, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: R.beamTex, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(pos.x, 0.02, pos.z); m.scale.set(1, 0.05, 1); R.scene.add(m);
  gsap.to(m.scale, { y: 1, duration: 0.18, ease: "power2.out" }); gsap.to(m.scale, { x: 0.25, z: 0.25, duration: 0.6, delay: 0.1, ease: "power2.in" });
  gsap.to(m.material, { opacity: 0, duration: 0.45, delay: 0.25, onComplete: () => { R && R.scene.remove(m); g.dispose(); m.material.dispose(); } });
}
// a soft ring that spreads across the floor
function ripple(pos, color, scale, delay = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: R.FX.light_02, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.065, pos.z); m.scale.setScalar(0.3); m.visible = !delay; R.scene.add(m);
  gsap.to(m.scale, { x: scale, y: scale, z: scale, duration: 0.9, delay, ease: "power2.out", onStart: () => { m.visible = true; } });
  gsap.to(m.material, { opacity: 0, duration: 0.9, delay, ease: "power1.in", onComplete: () => { R && R.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.16, "rgba(255,255,255,.9)"); gr.addColorStop(0.42, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function beamTexture() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c);
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
  if (!R || reduce) return; const p = pos.clone().setY(0.3);
  if (co === "แดง") { // fire: a ring of heat and embers that rise
    ripple(pos, 0xff6a2a, 5 * big); burst(p, { n: 22 * big, color: 0xff8a3a, size: 0.3, spread: 1.4, up: 3.2, dur: 1.1 }); burst(p, { n: 10 * big, color: 0xffd27a, size: 0.2, spread: 1, up: 2.2, dur: 0.8 });
    burst(p, { n: 4, map: R.FX.flare_01, color: 0xffb04a, size: 1.6, spread: 0.6, up: 0.8, dur: 0.5 });
  } else if (co === "ฟ้า") { // water: ripples spreading out and droplets thrown up
    ripple(pos, 0x7fd0ff, 5.2 * big); ripple(pos, 0x3d8fe0, 4 * big, 0.16); ripple(pos, 0xbfe6ff, 2.8 * big, 0.32);
    burst(p, { n: 16 * big, color: 0xbfe6ff, size: 0.22, spread: 1.8, up: 1.4, dur: 0.8 }); burst(p, { n: 8, map: R.FX.star_06, color: 0xe6f6ff, size: 0.4, spread: 1.6, up: 1.2 });
  } else if (co === "เขียว") { // nature: a swirl of light and motes drifting up like pollen
    decal(R.FX.twirl_02, pos, 0x5fe08a, 4.2 * big, 1.3, 3); burst(p, { n: 20 * big, color: 0x9dff9e, size: 0.24, spread: 1.8, up: 2.4, dur: 1.3 }); burst(p, { n: 6, map: R.FX.star_06, color: 0xe2ffd8, size: 0.4, spread: 1.4, up: 1.6 });
  } else if (co === "ม่วง") { // dark magic: violet smoke curling up through a ring of light
    ripple(pos, 0xb47bff, 4.6 * big); burst(p, { n: 14 * big, color: 0xd9b8ff, size: 0.24, spread: 1.6, up: 2.2 });
    for (let k = 0; k < 7; k++) puff(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 1.6, 0.3, pos.z + (Math.random() - 0.5) * 1.6), { color: 0x3d1f66, size: 1.1 * big, opacity: 0.5, rise: 1.2 + Math.random(), dur: 1.4 });
  } else burst(p, { color: colorHex(co) });
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
const GLOW = { rest: 0.16, sel: 0.85 };
export function highlight(ids, on = true) { if (!R) return; for (const m of R.meshes.values()) { const hit = ids.includes(m.i); m.pulse = on && hit; if (!m.pulse && !m.busy) gsap.to(m.glow.material, { opacity: m.sel ? GLOW.sel : GLOW.rest, duration: 0.2 }); } }
export function setLifeTarget(v) { if (!R) return; R.lifeT.visible = v; R.lifeHalo.visible = v; }
export function select(i) { if (!R) return; for (const m of R.meshes.values()) { m.sel = m.i === i; if (m.busy) continue; gsap.to(m.glow.material, { opacity: m.sel ? GLOW.sel : GLOW.rest, duration: 0.2 }); gsap.to(m.grp.position, { y: m.restY + (m.sel ? 0.4 : 0), duration: 0.2 }); if (m.sel) sweep(m, 0.8, 0.6); } }
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
  const d = E.def(s, L.x), fm = faceMat(d);
  const face = new THREE.Mesh(R.geo.face, fm), back = new THREE.Mesh(R.geo.back, R.backMat), edge = new THREE.Mesh(R.geo.edge, [R.capMat, R.edgeMat]);
  for (const o of [face, back, edge]) o.castShadow = true;
  const glow = new THREE.Mesh(R.geo.halo, new THREE.MeshBasicMaterial({ map: R.rimTex, color: L.zone === "land" ? 0x8fb0ff : L.side === "me" ? 0xffc35a : 0xff4a52, transparent: true, opacity: GLOW.rest, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = -0.012;
  // a soft contact shadow on the mat: it stays on the table, spreading and fading as the card lifts
  const shadow = new THREE.Mesh(R.geo.halo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: R.shadowTex, transparent: true, opacity: 0, depthWrite: false })); shadow.renderOrder = -1; R.scene.add(shadow);
  const grp = new THREE.Group(); grp.add(glow, edge, back, face); R.scene.add(grp);
  face.userData.i = L.x.i;
  return { i: L.x.i, grp, mesh: face, face, back, edge, glow, shadow, shOp: 0.6, u: fm.userData.u, co: d.co, side: L.side, zone: L.zone, scale: L.scale, restY: 0.04, sel: false, pulse: false, busy: false, nextSweep: (R.t || 0) + 3 + Math.random() * 8 };
}
function placeShadow(m) {
  const p = m.grp.position, r = m.grp.rotation, hgt = Math.max(0, p.y - m.restY), k = m.grp.scale.x * (1 + hgt * 0.22);
  m.shadow.position.set(p.x - hgt * 0.3, 0.012, p.z - hgt * 0.5); m.shadow.rotation.y = r.y;
  m.shadow.scale.set(k * Math.max(0.12, Math.abs(Math.cos(r.z))), 1, k * Math.max(0.12, Math.abs(Math.cos(r.x))));
  m.shadow.material.opacity = m.shOp * Math.max(0.15, 1 - hgt * 0.3);
}
function label(s, m, x) {
  const d = E.def(s, x); if (!(d.t === "A" || d.t === "T" || d.t === "C")) { const old = R.labels.get(m.i); if (old) { old.remove(); R.labels.delete(m.i); } return; }
  let el = R.labels.get(m.i); if (!el) { el = h("div", { class: "pwl" }); document.body.append(el); R.labels.set(m.i, el); }
  const p = E.power(s, x), b = d.pw || 0; el.textContent = p; el.className = "pwl" + (m.side === "opp" ? " opp" : "") + (p > b ? " up" : p < b ? " down" : "") + (x.a === false ? " sleep" : "");
}
function sync(s, V, drops, burned, instant) {
  const want = layout(s, V); let k = 0, hold = 0;
  for (const [i, m] of R.meshes) if (!want.has(i)) { // left the field
    R.meshes.delete(i); const el = R.labels.get(i); if (el) { el.remove(); R.labels.delete(i); }
    hold = Math.max(hold, leave(s, V, m, burned.has(i)) || 0); // the others close ranks once it has gone
  }
  for (const [i, L] of want) {
    let m = R.meshes.get(i); const fresh = !m;
    if (fresh) { m = makeMesh(s, L); R.meshes.set(i, m); }
    m.side = L.side; m.zone = L.zone; m.scale = L.scale;
    m.want = { pos: L.pos, rotY: (L.side === "opp" ? Math.PI : 0) + (L.x.a === false && L.zone === "av" ? -Math.PI / 2 : 0), scale: L.scale };
    if (fresh) {
      const co = E.def(s, L.x).co, cHex = co ? colorHex(co) : L.side === "me" ? 0xffc35a : 0xff4a52;
      if (reduce || instant) settle(m, 0.05 * k++); else if (drops.has(i)) summonIn(m, L, co, cHex); else placeIn(m, L);
    } else if (!m.busy) home(m, 0.4, hold);
    label(s, m, L.x);
  }
}
// where a card belongs now: its place may have changed while it was busy animating
function home(m, d = 0.4, delay = 0) {
  const w = m.want; if (!w) return; const o = { delay, overwrite: "auto" };
  gsap.to(m.grp.position, { x: w.pos.x, y: m.sel ? m.restY + 0.4 : w.pos.y, z: w.pos.z, duration: d, ease: "power2.out", ...o });
  gsap.to(m.grp.rotation, { x: 0, y: w.rotY, z: 0, duration: d + 0.05, ease: "power2.inOut", ...o }); gsap.to(m.grp.scale, { x: w.scale, y: w.scale, z: w.scale, duration: d * 0.75, ...o });
}
function done(m) { m.busy = false; home(m, 0.3); if (!m.pulse) gsap.to(m.glow.material, { opacity: m.sel ? GLOW.sel : GLOW.rest, duration: 0.4 }); }
function settle(m, delay) { // the table as it stands (resuming a game): cards just come down into place
  const w = m.want, g = m.grp; g.rotation.set(0, w.rotY, 0); g.scale.setScalar(w.scale); g.position.set(w.pos.x, w.pos.y, w.pos.z); if (reduce) return;
  m.busy = true; g.position.y = w.pos.y + 0.9; m.shOp = 0; gsap.to(m, { shOp: 0.6, duration: 0.4, delay }); gsap.to(g.position, { y: w.pos.y, duration: 0.35, delay, ease: "power2.in", onComplete: () => done(m) });
}
// summoned: the card rises from its owner's hand, turns over above its slot as a summoning circle opens beneath, then slams down
function summonIn(m, L, co, cHex) {
  const mine = L.side === "me", P = L.pos, s = L.scale, g = m.grp, hy = mine ? 3 : 2.1, hz = P.z + (mine ? 1.5 : 1.9); // the hover point stays in view from either seat
  g.position.set(P.x * 0.45, 1.4, mine ? 6.6 : -7.8); g.rotation.set(Math.PI / 2 - 0.3, 0, Math.PI); g.scale.setScalar(s * 0.8);
  m.busy = true; m.shOp = 0; m.glow.material.opacity = 0;
  const ring = sigil(P, cHex, s); Sfx.play("rise"); trail(m, cHex, 0.95);
  gsap.timeline({ onComplete: () => done(m) })
    .to(g.position, { x: P.x, y: hy, z: hz, duration: 0.5, ease: "power2.out" }, 0)
    .to(g.rotation, { x: Math.PI / 2 - 0.12, z: 0, duration: 0.55, ease: "power2.inOut" }, 0.02)
    .to(g.scale, { x: s * 1.3, y: s * 1.3, z: s * 1.3, duration: 0.5, ease: "power2.out" }, 0)
    .add(() => sweep(m, 1.2, 0.55), 0.34)
    .to(m, { shOp: 0.6, duration: 0.5 }, 0.3)
    .to(g.position, { y: hy + 0.14, duration: 0.24, ease: "sine.inOut" }, 0.5)
    .to(g.position, { x: P.x, y: P.y, z: P.z, duration: 0.22, ease: "power4.in" }, 0.76)
    .to(g.rotation, { x: 0, y: m.want.rotY, duration: 0.22, ease: "power3.in" }, 0.76)
    .to(g.scale, { x: s, y: s, z: s, duration: 0.22, ease: "power3.in" }, 0.76)
    .add(() => { landFx(P, s, co, cHex); ringOut(ring, s); Sfx.play("summon", { color: co }); m.glow.material.opacity = 1; }, 0.98)
    .to(g.position, { y: P.y + 0.12, duration: 0.08, ease: "power2.out" }, 0.98)
    .to(g.position, { y: P.y, duration: 0.3, ease: "bounce.out" }, 1.06);
}
// cards that arrive any other way (Magic, Constructs, Land, tokens) are laid down from the owner's side
function placeIn(m, L) {
  const P = L.pos, s = L.scale, g = m.grp, mine = L.side === "me";
  g.position.set(P.x, 1.7, P.z + (mine ? 1.1 : -1.1)); g.rotation.set(mine ? 1 : -1, m.want.rotY, 0); g.scale.setScalar(s * 1.1); m.shOp = 0.15; m.busy = true;
  gsap.timeline({ onComplete: () => done(m) })
    .to(g.position, { x: P.x, y: P.y, z: P.z, duration: 0.42, ease: "power3.in" }, 0)
    .to(g.rotation, { x: 0, duration: 0.42, ease: "power2.in" }, 0)
    .to(g.scale, { x: s, y: s, z: s, duration: 0.42, ease: "power2.in" }, 0)
    .to(m, { shOp: 0.6, duration: 0.42 }, 0)
    .add(() => { dust(P, s * 0.8, 6); sweep(m, 0.9, 0.6); }, 0.42);
}
function landFx(P, s, co, cHex) {
  shockwave(P, cHex, 6 * s); dust(P, s, 10); pillar(P, cHex); colorFx(P, co);
  burst(new THREE.Vector3(P.x, 0.3, P.z), { n: 10, map: R.FX.star_06, color: 0xffe2a8, size: 0.45, spread: 2 * s, up: 0.9, dur: 0.6 }); burst(new THREE.Vector3(P.x, 0.2, P.z), { n: 18, color: cHex, size: 0.2, spread: 2.4 * s, up: 0.7, dur: 0.7 });
  shake(0.2, 0.5); flash("rgba(255,236,200,.2)", 0.2);
}
function sigil(P, color, s) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: R.sigilTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(P.x, 0.05, P.z); m.scale.setScalar(0.5 * s); R.scene.add(m);
  gsap.to(m.material, { opacity: 0.95, duration: 0.35 }); gsap.to(m.scale, { x: 2.9 * s, y: 2.9 * s, z: 2.9 * s, duration: 0.6, ease: "back.out(1.6)" }); gsap.to(m.rotation, { z: 2.2, duration: 1.6, ease: "none" });
  return m;
}
function ringOut(m, s) {
  gsap.to(m.scale, { x: 4 * s, y: 4 * s, z: 4 * s, duration: 0.5, ease: "power2.out" });
  gsap.to(m.material, { opacity: 0, duration: 0.55, ease: "power2.in", onComplete: () => { R && R.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
}
// a stream of light behind a card in flight
function trail(m, color, dur) {
  if (reduce) return; let last = -1;
  gsap.to({}, { duration: dur, onUpdate() {
    const t = this.time(); if (!R || t - last < 0.03) return; last = t;
    const p = m.grp.position, sp = sprite(R.FX.dot, color, 0.3 + Math.random() * 0.25, new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.5, p.y + (Math.random() - 0.5) * 0.4, p.z + (Math.random() - 0.5) * 0.3), 0.7);
    gsap.to(sp.scale, { x: 0.05, y: 0.05, duration: 0.45 }); fadeSprite(sp, 0.45);
  } });
}
function fadeSprite(sp, d) { gsap.to(sp.material, { opacity: 0, duration: d, ease: "power2.in", onComplete: () => { R && R.scene.remove(sp); sp.material.dispose(); } }); }
// smoke and dust: soft puffs drawn normally (not additive) so they can be dark
function puff(pos, { color = 0x2b211c, size = 1, opacity = 0.5, to = null, rise = 0.3, dur = 0.9 } = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.FX.smoke_03, color, transparent: true, opacity, depthWrite: false }));
  sp.scale.set(size, size, 1); sp.position.copy(pos); sp.material.rotation = Math.random() * 6; R.scene.add(sp);
  gsap.to(sp.position, { x: to ? to.x : pos.x, z: to ? to.z : pos.z, y: pos.y + rise, duration: dur, ease: "power2.out" });
  gsap.to(sp.scale, { x: size * 1.8, y: size * 1.8, duration: dur, ease: "power2.out" });
  gsap.to(sp.material, { opacity: 0, rotation: sp.material.rotation + (Math.random() - 0.5), duration: dur, ease: "power1.in", onComplete: () => { R && R.scene.remove(sp); sp.material.dispose(); } });
}
function dust(P, s = 1, n = 9) {
  if (reduce) return;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, r0 = 0.7 * s, r1 = (1.7 + Math.random() * 0.6) * s;
    puff(new THREE.Vector3(P.x + Math.cos(a) * r0, 0.18, P.z + Math.sin(a) * r0 * 1.2), { color: 0x6b5545, size: 0.9 * s, opacity: 0.38, to: new THREE.Vector3(P.x + Math.cos(a) * r1, 0, P.z + Math.sin(a) * r1 * 1.2), rise: 0.25, dur: 0.85 });
  }
}
function sweep(m, k = 0.9, dur = 0.7) {
  if (!m || !m.u) return; const u = m.u; gsap.killTweensOf(u.uSweep); u.uSheen.value = k;
  gsap.fromTo(u.uSweep, { value: -1.35 }, { value: 1.15, duration: dur, ease: "power1.inOut", onComplete: () => { u.uSheen.value = 0; } });
}
function hitFx(m) {
  if (!m) return; gsap.fromTo(m.u.uFlash, { value: 0.85 }, { value: 0, duration: 0.35, ease: "power2.out" }); if (m.busy || reduce) return;
  const p = m.grp.position, x = p.x; gsap.fromTo(p, { x: x - 0.07 }, { x: x + 0.07, duration: 0.04, repeat: 5, yoyo: true, ease: "none", onComplete: () => { p.x = x; } });
}
// ---------- leaving the field ----------
const EMBER = { "แดง": 0xff7a2a, "ฟ้า": 0x56c8ff, "เขียว": 0x6dff8a, "ม่วง": 0xc58aff };
function leave(s, V, m, destroyed) {
  R.dying.add(m); const L = E.locate(s, m.i), to = L ? L.z : null;
  if (reduce) { dropCard(m); return 0; }
  if (destroyed || (to === "hell" && m.zone !== "mg" && m.zone !== "land")) { burnOut(m, "fire"); return 1.1; } // destroyed: it burns from the edges in
  if (to === "hell" || to == null) { burnOut(m, "light"); return 0.6; } // a spent Magic card (or a token that ceases to be) fades into light
  if (to === "dark") { burnOut(m, "void"); return 0.8; } // banished into the dark dimension
  flyOut(m, L.p === V, to); return 0.2; // back to a hand, a deck or LIFE
}
function burnOut(m, kind) {
  m.busy = true; const u = m.u, g = m.grp, P = g.position.clone(), s = m.scale;
  const col = kind === "void" ? 0x8a4dff : kind === "light" ? (m.co ? colorHex(m.co) : 0xffd27a) : EMBER[m.co] || 0xff8a2a;
  u.uEdge.value.setHex(col); gsap.killTweensOf(g.position); gsap.killTweensOf(g.rotation);
  const t0 = kind === "fire" ? 0.26 : 0.05, dur = kind === "light" ? 0.85 : 1.05, tl = gsap.timeline({ onComplete: () => dropCard(m) });
  if (kind === "fire") { // struck: a white flash and a shudder, then it catches
    tl.fromTo(u.uFlash, { value: 0.7 }, { value: 0, duration: 0.3 }, 0).fromTo(g.position, { x: P.x - 0.05 }, { x: P.x + 0.05, duration: 0.04, repeat: 5, yoyo: true, ease: "none" }, 0).set(g.position, { x: P.x }, 0.25);
    Sfx.play("burn");
  } else Sfx.play(kind === "void" ? "void" : "spent");
  tl.add(() => { m.edge.visible = m.back.visible = false; m.face.castShadow = false; }, t0)
    .to(u.uBurn, { value: 1, duration: dur, ease: kind === "void" ? "power2.in" : "power1.in" }, t0)
    .to(m.glow.material, { opacity: 0, duration: 0.4 }, t0).to(m, { shOp: 0, duration: dur * 0.8 }, t0).to(g.rotation, { x: 0, duration: 0.3 }, t0);
  if (kind === "light") tl.to(g.position, { y: P.y + 0.6, duration: dur + 0.1, ease: "power1.in" }, t0);
  if (kind === "void") tl.to(g.scale, { x: s * 0.82, y: s * 0.82, z: s * 0.82, duration: dur, ease: "power2.in" }, t0);
  cinders(P, s, kind, col, t0, dur);
}
// what rises off a dying card: embers and smoke, sparkles, or motes pulled into the dark
function cinders(P, s, kind, col, t0, dur) {
  if (reduce) return; const map = kind === "light" ? R.FX.star_06 : R.FX.dot;
  for (let k = 0; k < (kind === "fire" ? 26 : 18); k++) gsap.delayedCall(t0 + Math.random() * dur, () => {
    if (!R) return; const x = P.x + (Math.random() - 0.5) * CARD.w * s, z = P.z + (Math.random() - 0.5) * CARD.h * s;
    if (kind === "void") { const sp = sprite(map, col, 0.22 + Math.random() * 0.2, new THREE.Vector3(x + (x - P.x) * 0.8, P.y + 0.2 + Math.random() * 0.6, z + (z - P.z) * 0.8), 0.9); gsap.to(sp.position, { x: P.x, y: P.y + 0.1, z: P.z, duration: 0.5, ease: "power2.in" }); fadeSprite(sp, 0.5); return; }
    const sp = sprite(map, kind === "fire" && Math.random() < 0.5 ? 0xffc46a : col, (kind === "light" ? 0.32 : 0.16) + Math.random() * 0.14, new THREE.Vector3(x, P.y + 0.05, z), 1);
    const d = 0.9 + Math.random() * 0.7; gsap.to(sp.position, { y: P.y + 0.8 + Math.random() * 1.8, x: x + (Math.random() - 0.5) * 0.7, z: z + (Math.random() - 0.5) * 0.4, duration: d, ease: "power1.out" }); fadeSprite(sp, d);
  });
  if (kind === "fire") for (let k = 0; k < 7; k++) gsap.delayedCall(t0 + 0.15 + Math.random() * dur * 0.8, () => R && puff(new THREE.Vector3(P.x + (Math.random() - 0.5) * CARD.w * s * 0.7, P.y + 0.2, P.z + (Math.random() - 0.5) * CARD.h * s * 0.7), { color: 0x1d1512, size: 0.9 * s, opacity: 0.5, rise: 1.2 + Math.random(), dur: 1.4 }));
  if (kind === "void") decal(R.FX.twirl_02, P, 0x6a3cd8, 3.2 * s, dur + 0.4, -3);
  if (kind === "light") burst(P.clone().setY(0.4), { n: 10, map: R.FX.star_06, color: col, size: 0.4, spread: 1.2 * s, up: 1.6, dur: 0.9 });
}
function flyOut(m, mineSide, to) {
  m.busy = true; const g = m.grp, s = m.scale; gsap.killTweensOf(g.position); gsap.killTweensOf(g.rotation); Sfx.play("fly");
  gsap.timeline({ onComplete: () => dropCard(m) })
    .to(g.position, { y: 1, duration: 0.22, ease: "power2.out" }, 0)
    .to(g.rotation, { x: mineSide ? 0.9 : -0.9, z: to === "deck" ? Math.PI : 0, duration: 0.45, ease: "power2.inOut" }, 0)
    .to(g.position, { x: 0, y: 2.2, z: mineSide ? 7.6 : -8.6, duration: 0.45, ease: "power2.in" }, 0.2)
    .to(g.scale, { x: s * 0.7, y: s * 0.7, z: s * 0.7, duration: 0.45, ease: "power2.in" }, 0.2)
    .to(m.glow.material, { opacity: 0, duration: 0.3 }, 0).to(m, { shOp: 0, duration: 0.35 }, 0);
}
function dropCard(m) {
  if (!R) return; R.dying.delete(m); R.scene.remove(m.grp); R.scene.remove(m.shadow);
  if (m.face.material.userData.own) m.face.material.map.dispose(); m.face.material.dispose(); m.glow.material.dispose(); m.shadow.material.dispose();
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
      .to(m.grp.position, { y: 1.3, duration: 0.22, ease: "power2.out" }).to(m.glow.material, { opacity: 1, duration: 0.2 }, "<").to(m.grp.rotation, { x: mineSide(ev.by) ? -0.42 : 0.42, duration: 0.22, ease: "power2.out" }, "<")
      .to(m.grp.position, { x: hit.x, z: hit.z, y: 0.6, duration: 0.26, ease: "power4.in" })
      .add(() => {
        Sfx.play("clash"); hitFx(ev.ti != null && R.meshes.get(ev.ti)); sweep(m, 1, 0.4); const sl = sprite(R.FX.slash_02, tint, 3.6, hit.clone().setY(1)); sl.material.rotation = Math.random() * 2;
        gsap.fromTo(sl.scale, { x: 0.5, y: 0.5 }, { x: 4.2, y: 4.2, duration: 0.25, ease: "power3.out" }); gsap.to(sl.material, { opacity: 0, duration: 0.35, delay: 0.1, onComplete: () => R && R.scene.remove(sl) });
        burst(hit.clone().setY(0.8), { n: 22, color: 0xffd27a, spread: 2.6, size: 0.24 }); burst(hit.clone().setY(0.8), { n: 6, map: R.FX.star_06, color: 0xfff1c9, spread: 1.6, size: 0.5, dur: 0.5 }); shockwave(hit, aco ? tint : 0xff8a4a, 5); if (aco) colorFx(hit, aco, 0.6); shake(0.42, 0.6); flash("rgba(255,240,210,.5)", 0.45);
      })
      .to(m.grp.position, { x: from.x, y: from.y, z: from.z, duration: 0.42, ease: "power2.out" }, "+=0.1").to(m.grp.rotation, { x: 0, duration: 0.42, ease: "power2.out" }, "<")
      .add(() => done(m)));
  } else if (ev.k === "life") {
    const mine = mineSide(ev.p); Sfx.play("life");
    if (E.critical(s.P[ev.p]) && R.crit !== ev.p + ":" + s.turn) { R.crit = ev.p + ":" + s.turn; setTimeout(() => R && Sfx.play("crit"), 450); } // one LIFE from losing flash(mine ? "rgba(255,40,60,.5)" : "rgba(255,200,90,.35)", 0.5);
    popText(new THREE.Vector3(0, 1.2, mine ? 5.2 : -4.7), "LIFE −1", "#ff4d55");
    burst(new THREE.Vector3(0, 1, mine ? 5.2 : -4.7), { n: 26, color: 0xff6a70, spread: 2.2 });
  } else if (ev.k === "destroy") {
    Sfx.play("destroy"); const p = pos(ev.i); if (p) { popText(p.clone().setY(1), "BREAK", "#ff4d55"); burst(p.clone().setY(0.6), { n: 16, color: 0xff8a3a, size: 0.2, spread: 2.4 }); }
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
    if (!reduce) for (let k = 0; k < (ev.w === V ? 90 : 40); k++) gsap.delayedCall(Math.random() * 1.6, () => { // gold leaf rains for a win, ash and embers drift down for a loss
      if (!R) return; const win = ev.w === V, p0 = new THREE.Vector3((Math.random() - 0.5) * 15, 6 + Math.random() * 2, (Math.random() - 0.5) * 10 - 0.5);
      const sp = sprite(win && Math.random() < 0.4 ? R.FX.star_06 : R.FX.dot, win ? [0xffd27a, 0xffe9b0, 0xd8a84a, 0xff9a4a][k % 4] : k % 3 ? 0x3a2622 : 0xff5a3a, win ? 0.28 + Math.random() * 0.2 : 0.2 + Math.random() * 0.25, p0, 0.95);
      const d = 2.2 + Math.random() * 1.6; gsap.to(sp.position, { y: 0.1, x: p0.x + (Math.random() - 0.5) * 2, z: p0.z + (Math.random() - 0.5) * 1.5, duration: d, ease: "sine.in" }); gsap.to(sp.material, { rotation: (Math.random() - 0.5) * 8, duration: d });
      gsap.to(sp.material, { opacity: 0, duration: 0.6, delay: d - 0.6, onComplete: () => { R && R.scene.remove(sp); sp.material.dispose(); } });
    });
  }
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function update(s, V, opts = {}) {
  if (!R) return Promise.resolve();
  R.queue = R.queue.then(async () => {
    if (!R) return;
    if (opts.reset || R.view !== V) { R.lastEv = s.evc || 0; R.view = V; }
    const evs = (s.ev || []).filter((e) => e.id > R.lastEv); R.lastEv = s.evc || R.lastEv;
    const drops = new Set(evs.filter((e) => e.k === "summon").map((e) => e.i)), burned = new Set(evs.filter((e) => e.k === "destroy").map((e) => e.i));
    for (const e of evs) if (e.k !== "summon") { try { await animateEvent(e, null, s, V); } catch (err) { console.warn(err); } }
    try { sync(s, V, drops, burned, !!opts.reset); } catch (err) { console.warn(err); } // a drawing problem must never stall the queue the bot waits on
    if (drops.size) await sleepMs(reduce ? 200 : 1150); else if (burned.size) await sleepMs(reduce ? 100 : 600);
  }).catch((err) => console.warn(err));
  return R.queue;
}
