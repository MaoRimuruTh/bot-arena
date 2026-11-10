// 3D duel arena (three.js r128 + GSAP). Kenney particle textures and Poly Haven stone are CC0.
import { card, resolveArt, colorHex, corsUrl } from "./cards.js?v=20261111023353";
import { E } from "./engine.js?v=20261111023353";
import { h } from "./util.js?v=20261111023353";
import { Sfx } from "./sfx.js?v=20261111023353";
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

  scene.add(new THREE.HemisphereLight(0x6f86c9, 0x120c08, 0.55));
  const key = new THREE.DirectionalLight(0xffe2b0, 1.15); key.position.set(4, 12, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7f9cff, 0.5); rim.position.set(-6, 6, -10); scene.add(rim);
  R.goldL = new THREE.PointLight(0xffb84a, 1.3, 13, 2); R.goldL.position.set(0, 2.6, 3.6); scene.add(R.goldL);
  R.redL = new THREE.PointLight(0xff3b45, 1.1, 13, 2); R.redL.position.set(0, 2.6, -4.2); scene.add(R.redL);

  const floor = tex("assets/tex/floor.jpg"); floor.wrapS = floor.wrapT = THREE.RepeatWrapping; floor.repeat.set(3.2, 3.2);
  const nor = tex("assets/tex/floor_nor.jpg", false); nor.wrapS = nor.wrapT = THREE.RepeatWrapping; nor.repeat.set(3.2, 3.2);
  const topMat = new THREE.MeshStandardMaterial({ map: floor, normalMap: nor, color: 0x3a3f50, roughness: 0.86, metalness: 0.1 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x151a2a, roughness: 0.5, metalness: 0.55 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 8.3, 0.8, 120), [sideMat, topMat, sideMat]); platform.position.y = -0.4; platform.receiveShadow = true; scene.add(platform);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.62, 0.055, 10, 220), new THREE.MeshBasicMaterial({ color: 0xffc35a })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  const ring2 = ring.clone(); ring2.material = new THREE.MeshBasicMaterial({ color: 0x8a6420 }); ring2.scale.setScalar(1.09); ring2.position.y = -0.38; scene.add(ring2);
  const plane = (map, size, color, opacity, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m; };
  R.rune = plane(runeTexture(), 14.6, 0xffb44a, 0.32, 0.015);
  R.sigil = plane(FX.magic_04, 6.5, 0x8fb0ff, 0.26, 0.02);
  R.sigil2 = plane(FX.magic_02, 3.2, 0xffc35a, 0.28, 0.025); R.sigil2.position.z = -0.2;
  const div = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 0.06), new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })); div.rotation.x = -Math.PI / 2; div.position.set(0, 0.03, -0.2); scene.add(div); R.div = div;

  R.obelisks = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const r = 11.5 + (i % 2) * 1.2; const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 1.5);
    const ob = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6 + (i % 3) * 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x1b2032, roughness: 0.35, metalness: 0.6, flatShading: true })); ob.position.y = 1.4; ob.castShadow = true; g.add(ob);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshStandardMaterial({ color: 0xffc35a, emissive: i % 2 ? 0xff3b45 : 0xffb84a, emissiveIntensity: 1.8, roughness: 0.2 })); cr.position.y = 4.4 + (i % 3) * 0.6; g.add(cr);
    const halo = sprite(FX.light_02, i % 2 ? 0xff5560 : 0xffc35a, 2.2, cr.position, 0.5, g);
    scene.add(g); R.obelisks.push({ g, cr, halo, ph: Math.random() * 6 });
  }
  const small = innerWidth < 760;
  R.embers = points(small ? 110 : 240, 0xffb35a, 0.22, FX.spark_05, 10);
  R.motes = points(small ? 50 : 130, 0x8fb0ff, 0.12, FX.star_06, 12);
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
      R.rune.rotation.z = t * 0.03; R.sigil.rotation.z = -t * 0.06; R.sigil2.rotation.z = t * 0.12; R.rune.material.opacity = 0.3 + Math.sin(t * 1.3) * 0.06;
      for (const o of R.obelisks) { o.g.position.y = Math.sin(t * 0.6 + o.ph) * 0.25; o.cr.rotation.y = t * 0.8 + o.ph; o.halo.material.opacity = 0.4 + Math.sin(t * 2 + o.ph) * 0.15; }
      for (const pts of [R.embers, R.motes]) { const a = pts.geometry.attributes.position.array, sp = pts.userData.sp; for (let i = 0; i < sp.length; i++) { a[i * 3 + 1] += sp[i] * 60 * dt * (pts === R.motes ? 0.35 : 1); a[i * 3] += Math.sin(t + i) * 0.002; if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0; } pts.geometry.attributes.position.needsUpdate = true; }
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
  gsap.from(R.rune.scale, { x: 0.2, y: 0.2, z: 0.2, duration: reduce ? 0 : 1.6, ease: "power3.out" });
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
function runeTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d");
  g.translate(512, 512); g.strokeStyle = g.fillStyle = "rgba(255,214,140,1)"; g.lineCap = "round";
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  ring(500, 6); ring(480, 2); ring(390, 3); ring(250, 2); ring(236, 5);
  for (let i = 0; i < 72; i++) { g.save(); g.rotate((i / 72) * Math.PI * 2); g.lineWidth = i % 6 ? 2 : 5; g.beginPath(); g.moveTo(0, -480); g.lineTo(0, i % 6 ? -462 : -440); g.stroke(); g.restore(); }
  g.font = "600 34px sans-serif"; g.textAlign = "center"; const gl = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
  for (let i = 0; i < 24; i++) { g.save(); g.rotate((i / 24) * Math.PI * 2); g.fillText(gl[i], 0, -425); g.restore(); }
  for (let k = 0; k < 2; k++) { g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 + k * Math.PI + (i * 2 * Math.PI) / 3; const p = [Math.cos(a) * 390, Math.sin(a) * 390]; i ? g.lineTo(...p) : g.moveTo(...p); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function frameTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 340; const g = c.getContext("2d");
  const rr = (x, y, w, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.shadowColor = "#fff"; g.shadowBlur = 14; g.strokeStyle = "#fff"; g.lineWidth = 5; rr(14, 14, 228, 312, 22); g.stroke();
  return new THREE.CanvasTexture(c);
}
function backTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 348; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 256, 348); gr.addColorStop(0, "#5a1612"); gr.addColorStop(1, "#8f2721"); g.fillStyle = gr; g.fillRect(0, 0, 256, 348);
  g.strokeStyle = "#e3b54a"; g.lineWidth = 8; g.strokeRect(10, 10, 236, 328); g.fillStyle = "#f2cc6c"; g.font = "700 46px sans-serif"; g.textAlign = "center"; g.fillText("BoT", 128, 190);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
function tokenTexture(d) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 348; const g = c.getContext("2d");
  g.fillStyle = "#1d2338"; g.fillRect(0, 0, 256, 348); g.strokeStyle = "#" + colorHex(d.co).toString(16).padStart(6, "0"); g.lineWidth = 10; g.strokeRect(6, 6, 244, 336);
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
export function mood(mine) { if (!R) return; gsap.to(R.goldL, { intensity: mine ? 1.3 : 0.6, duration: 0.8 }); gsap.to(R.redL, { intensity: mine ? 1.1 : 1.8, duration: 0.8 }); }
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
  if (s.land) out.set(s.land.i, { x: s.land, p: s.land.o, side: s.land.o === V ? "me" : "opp", zone: "land", pos: new THREE.Vector3(-6.05, 0.04, -0.2), scale: 0.72 });
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
    Sfx.play("battle"); banner("BATTLE PHASE", ""); gsap.fromTo(R.div.material, { opacity: 1 }, { opacity: 0.65, duration: 1 });
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
