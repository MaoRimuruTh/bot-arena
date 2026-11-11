// 3D duel arena (three.js r128 + GSAP) on a black-lacquer play mat drawn in code. Kenney particle textures are CC0.
import { card, resolveArt, colorHex, corsUrl, artImg } from "./cards.js?v=20261112040837";
import { E } from "./engine.js?v=20261112040837";
import { h } from "./util.js?v=20261112040837";
import { Sfx } from "./sfx.js?v=20261112040837";
const THREE = window.THREE, gsap = window.gsap;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let R = null; // runtime
export const Arena = {
  get on() { return !!R; },
  mount, unmount, update, idle: () => (R ? R.queue : Promise.resolve()),
  refit: () => R && R.resize(true), // the HUD is drawn: fit an upright phone's table between its bars
  // where a card on the table is on screen: its centre and its drawn width and height (for the buttons beside it)
  screenOf: (i) => { const m = R && R.meshes.get(i); if (!m) return null; const P = m.grp.position, c = toScreen(P), sc = m.scale || 1;
    const a = toScreen(P.clone().add(new THREE.Vector3(-CARD.w * sc / 2, 0, -CARD.h * sc / 2))), b = toScreen(P.clone().add(new THREE.Vector3(CARD.w * sc / 2, 0, CARD.h * sc / 2)));
    return { x: c.x, y: c.y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), top: Math.min(a.y, b.y) }; },
  // the floating LIFE target (attacking LIFE): whether the pointer is on it, and where it is on screen
  lifeAim: () => (R && R.lifeT.visible && R.hovered === "life" ? (() => { const c = toScreen(R.lifeT.position); return { x: c.x, y: c.y, w: 70, h: 70 }; })() : null),
  // replays can run fast: every animation and pause in the arena speeds up together
  setSpeed: (k) => { const v = k * animSetting(); if (R) R.speed = v; gsap.globalTimeline.timeScale(v); },
  cheer: (p) => R && avatarDo(p, "hop"), // an emote makes the sender's figure hop
  setHover: (fn) => R && (R.onHover = fn), setClick: (fn) => R && (R.onClick = fn),
  highlight, setLifeTarget, banner, flash, shake, popText, mood,
  setQuiet: (v) => { quiet = !!v; },
};

// how much the 3D table draws, from Settings: "high" everywhere, "low" for weak phones, "auto" by screen size
export const gfxSetting = () => { try { return localStorage.getItem("bot.gfx") || "auto"; } catch { return "auto"; } };
export const animSetting = () => { try { return +(localStorage.getItem("bot.anim") || 1) || 1; } catch { return 1; } };
// a short buzz on phones that have one (Android; iPhones have none for web pages): our LIFE is hit, our turn begins
export const buzzOn = () => { try { return localStorage.getItem("bot.buzz") !== "0"; } catch { return true; } };
let quiet = false; // watching someone's game or a replay: no buzz
function buzz(pattern) { try { if (!quiet && buzzOn() && navigator.vibrate) navigator.vibrate(pattern); } catch { /* not on this device */ } }
const gfxLevel = () => { const g = gfxSetting(); return g === "low" ? "low" : g === "high" ? "high" : innerWidth < 760 ? "mid" : "high"; };
function mount(container, opts = {}) {
  unmount();
  const Q = gfxLevel(); // high: bloom, shadows, reflections everywhere · mid: none of those, only the brass reflects · low: no reflections, fewer motes, lower resolution
  const canvas = h("canvas", { "aria-label": "สนามดวล 3 มิติ" }); container.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q === "low" ? 1 : Q === "mid" ? 1.5 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = Q === "high"; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  const small = innerWidth < 760; R.small = small; R.Q = Q; R.watch = !!opts.watch; /* a friend looking on: no "your turn", and the winner gets the banner */ R.matKey = [small || Q === "low", MATS[opts.mat] || MATS.black]; R.zones = tallScreen(container) ? ZONES.tall : ZONES.wide; const mt = matTextures(...R.matKey, R.zones);
  R.matMat = new THREE.MeshStandardMaterial({ map: mt.base, emissiveMap: mt.glow, emissive: new THREE.Color(0xe0982c), emissiveIntensity: 0.2, roughness: 0.62, roughnessMap: mt.rough, metalness: 0 }); R.matGlow = mt.glow;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), R.matMat); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, MZ); top.receiveShadow = true; scene.add(top);
  const lacq = new THREE.MeshStandardMaterial({ color: 0x5a1812, roughness: 0.34, metalness: 0, envMapIntensity: 0.3 }); R.lacq = lacq;
  const body = new THREE.Mesh(new THREE.BoxGeometry(MW, 0.28, MD), lacq); body.position.set(0, -0.18, MZ); body.receiveShadow = true; scene.add(body);
  const trimM = new THREE.MeshStandardMaterial({ color: 0xc99a3e, emissive: 0x7a5414, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.3 });
  for (const [w, d, x, z] of [[MW + 0.08, 0.05, 0, MZ - MD / 2], [MW + 0.08, 0.05, 0, MZ + MD / 2], [0.05, MD, -MW / 2, MZ], [0.05, MD, MW / 2, MZ]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), trimM); t.position.set(x, 0.005, z); scene.add(t); }
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(MW * 1.9, MD * 1.9), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false })); shade.rotation.x = -Math.PI / 2; shade.position.set(0, -0.31, MZ); scene.add(shade);
  // the centre band lights up when the Battle Phase starts
  const div = new THREE.Mesh(new THREE.PlaneGeometry(MW - 3.4, 0.62), new THREE.MeshBasicMaterial({ map: R.FX.light_02, color: 0xffc35a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); div.rotation.x = -Math.PI / 2; div.position.set(1.2, 0.02, MZ); scene.add(div); R.div = div;
  R.motes = points(Q === "low" ? 12 : small ? 34 : 80, 0xffd27a, 0.1, FX.star_06, 9);
  R.lifeT = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0xff7a80, emissive: 0xff2a3a, emissiveIntensity: 1.6, roughness: 0.15 })); R.lifeT.position.set(0, 1, MZ - 1.15); R.lifeT.visible = false; /* just above the centre band: never under the opponent's bar at the top of the screen */ scene.add(R.lifeT);
  R.lifeHalo = sprite(FX.light_02, 0xff4a52, 3.2, R.lifeT.position, 0.5); R.lifeHalo.visible = false;
  FX.dot = dotTexture(); R.beamTex = beamTexture(); R.backTex = backTexture(); R.rimTex = haloTexture(18, 5); R.shadowTex = haloTexture(24, 0); R.sigilTexs = {}; R.sig = ["lotus", "lotus"];
  R.geo = cardGeometry(); R.capMat = new THREE.MeshBasicMaterial({ visible: false });
  R.edgeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.62, metalness: 0 }); // the paper core, not metal
  R.backMat = new THREE.MeshBasicMaterial({ map: R.backTex, color: 0xcccccc, toneMapped: false });
  // the teak table the mat lies on, and candles in brass dishes round it, each throwing a flickering pool of light on the wood
  // unlit, with the lamplight baked into vertex colours: it covers much of a phone screen, so it must be cheap to draw
  const tg = new THREE.PlaneGeometry(70, 50, 28, 20), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
  for (let k = 0; k < tp.count; k++) { const x = tp.getX(k), y = tp.getY(k), d = Math.hypot(x / 1.25, y + 1.5); const v = 0.3 + 1.3 * Math.exp(-((Math.max(0, d - 6)) ** 2) / 80); tc[k * 3] = v; tc[k * 3 + 1] = v * 0.93; tc[k * 3 + 2] = v * 0.86; }
  tg.setAttribute("color", new THREE.BufferAttribute(tc, 3));
  const wood = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: woodTexture(small), vertexColors: true }));
  wood.rotation.x = -Math.PI / 2; wood.position.set(0, -0.335, -2); scene.add(wood);
  R.flameTex = flameTexture();
  // two candles at the far corners of the mat show at the top of a wide screen, two further back show on a phone
  R.candles = [[-4.2, -8.2], [4.2, -8.2], [-8.7, -5.4], [8.7, -5.4]].map(([x, z]) => candle(x, z));
  // made in Blender (tools/env): a seamless teak top with the candlelight baked into a light map, brass candlesticks, a jasmine garland,
  // a water bowl, and a dim hall that the gold and brass reflect. Each part swaps in when it has loaded; the drawn table stays as the fallback.
  const envUrl = (f) => `assets/env/${f}?v=${ENV_V}`;
  { let n = 0; const ok = () => { if (++n < 2 || !R) return;
      woodT.encoding = THREE.sRGBEncoding; woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(70 / 12, 50 / 12); woodT.anisotropy = 8; lightT.encoding = THREE.sRGBEncoding;
      tg.setAttribute("uv2", tg.attributes.uv); wood.material.dispose(); wood.material = new THREE.MeshBasicMaterial({ map: woodT, lightMap: lightT, lightMapIntensity: LIGHT_MAX }); shade.visible = false; };
    const woodT = loader.load(envUrl("wood.jpg"), ok), lightT = loader.load(envUrl("table-light.jpg"), ok); }
  if (THREE.GLTFLoader) new THREE.GLTFLoader().load(envUrl("props.glb"), (g) => {
    if (!R) return;
    g.scene.traverse((o) => { if (!o.isMesh) return; const m = o.material; if (/wax/.test(m.name)) { m.emissive = new THREE.Color(0x5a2c0a); m.emissiveIntensity = 0.55; } if (/brass/.test(m.name)) m.envMapIntensity = 1.6; });
    g.scene.name = "props"; scene.add(g.scene); for (const c of R.candles) c.onStand(); envProps();
  }, undefined, () => {});
  // on phones only the small brass pieces reflect the hall: the mat covers most of the screen and stays cheap to draw
  const envProps = () => { const g = scene.getObjectByName("props"); if (Q === "high" || !g || !R.env) return; g.traverse((o) => { if (o.isMesh && /brass|water/.test(o.material.name)) { o.material.envMap = R.env; o.material.needsUpdate = true; } }); };
  if (THREE.RGBELoader && Q !== "low") new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load(envUrl("hall.hdr"), (t) => {
    if (!R) return; const pm = new THREE.PMREMGenerator(renderer); R.env = pm.fromEquirectangular(t).texture; t.dispose(); pm.dispose();
    if (Q !== "high") { if (R.avatars) for (const a of R.avatars) if (a && a.model) a.model.traverse((o) => { if (o.isMesh && o.material.metalness > 0.5) { o.material.envMap = R.env; o.material.needsUpdate = true; } }); return envProps(); }
    scene.environment = R.env;
    // with something to reflect, the gold leaf on the mat becomes real metal (without it, metal would look dark)
    Object.assign(R.matMat, { metalness: 0.7, metalnessMap: R.matGlow, envMapIntensity: 2.4 });
    // the lacquer between the gold keeps only a faint reflection of the hall, so the hall's columns never streak across the mat
    R.matMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_maps>", "#include <lights_fragment_maps>\n\tradiance *= mix(0.22, 1.0, metalnessFactor);"); };
    R.matMat.needsUpdate = true;
  }, undefined, () => {});

  if (THREE.EffectComposer && Q === "high") {
    R.composer = new THREE.EffectComposer(renderer); R.composer.addPass(new THREE.RenderPass(scene, camera));
    R.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.9));
  }
  R.resize = (smooth) => {
    const w = container.clientWidth || innerWidth, hh = container.clientHeight || innerHeight; renderer.setSize(w, hh, false); camera.aspect = w / hh;
    const portrait = w / hh < 0.9; const k = portrait ? 1 : Math.min(1.45, Math.max(1, 820 / hh, 1250 / w));
    const Z = portrait ? ZONES.tall : ZONES.wide; if (Z !== R.zones) { R.zones = Z; swapMat(); if (R.last) update(R.last.s, R.last.V); } // turned the phone: the other table
    camera.fov = portrait ? 50 : 38; camera.updateProjectionMatrix();
    const cam = portrait ? fitTall(camera, w, hh) : wideCam(camera, w, hh, k);
    gsap.killTweensOf(R.camBase); gsap.killTweensOf(R.look);
    if (smooth && !reduce) { gsap.to(R.camBase, { x: cam.pos.x, y: cam.pos.y, z: cam.pos.z, duration: 0.5, ease: "power2.out" }); gsap.to(R.look, { x: cam.look.x, y: cam.look.y, z: cam.look.z, duration: 0.5, ease: "power2.out" }); }
    else { R.camBase.copy(cam.pos); R.look.copy(cam.look); }
    if (R.composer) R.composer.setSize(w, hh);
    document.documentElement.style.setProperty("--handDrop", hh < 620 ? "-28px" : hh < 760 ? "-40px" : "-44px");
  };
  R.onResize = () => R.resize(); addEventListener("resize", R.onResize); R.resize();
  // automatic quality: if the table keeps running under ~28 frames a second, give up the glow first, then resolution
  R.autoQ = gfxSetting() === "auto" ? { t0: performance.now(), born: performance.now(), sum: 0, n: 0, slow: 0, last: 0 } : null;
  R.onVis = () => { if (R && R.autoQ) R.autoQ.last = 0; }; document.addEventListener("visibilitychange", R.onVis);
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
  canvas.addEventListener("click", (e) => { const p = pick(e); if (R.onClick) R.onClick(p); }); // null: the empty table (closes what is open)
  const clock = new THREE.Clock();
  // "ประหยัดเครื่อง" in Settings: the table is drawn 30 times a second instead of 60 (half the work for the phone's GPU)
  const cap = Q === "low" ? 1000 / 30 - 3 : 0; let lastDraw = 0;
  const tick = (now = performance.now()) => {
    if (!R || !R.alive) return;
    if (cap && now - lastDraw < cap) { requestAnimationFrame(tick); return; } lastDraw = now;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (!reduce) {
      for (const pts of [R.motes]) { const a = pts.geometry.attributes.position.array, sp = pts.userData.sp; for (let i = 0; i < sp.length; i++) { a[i * 3 + 1] += sp[i] * 60 * dt * (pts === R.motes ? 0.35 : 1); a[i * 3] += Math.sin(t + i) * 0.002; if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0; } pts.geometry.attributes.position.needsUpdate = true; }
      for (const c of R.candles) { const f = 1 + 0.07 * Math.sin(t * 13 + c.ph) + 0.05 * Math.sin(t * 7.3 + c.ph * 2) + Math.random() * 0.03; c.flame.scale.set(0.16 * (2 - f), 0.36 * f, 1); c.halo.material.opacity = 0.32 * f; c.pool.material.opacity = 0.2 * f; }
      R.lifeT.rotation.y = t * 1.2; R.lifeT.position.y = 1 + Math.sin(t * 2) * 0.12; R.lifeHalo.position.copy(R.lifeT.position);
      for (const m of R.meshes.values()) {
        if (m.pulse) m.glow.material.opacity = 0.45 + Math.sin(t * 6) * 0.3;
        if (t > m.nextSweep && !m.busy) { sweep(m, 0.22 + m.u.uFoil.value * 0.35, 1.3); m.nextSweep = t + 7 + Math.random() * 10; } // now and then the lamps catch a card
      }
    }
    if (R.avatars) for (const a of R.avatars) { if (!a || a.loading) continue; a.mixer.update(dt * (R.speed || 1)); if (!a.acts.idle && !reduce) { a.bob.position.y = Math.max(0, Math.sin(t * 2.6 + a.ph)) * 0.025; a.bob.scale.y = 1 + Math.sin(t * 2.6 + a.ph) * 0.018; } }
    R.t = t; for (const m of R.meshes.values()) placeShadow(m); for (const m of R.dying) placeShadow(m);
    camera.position.set(R.camBase.x + Math.sin(t * 0.15) * 0.35 + R.off.x, R.camBase.y + R.off.y, R.camBase.z + Math.cos(t * 0.12) * 0.2); camera.lookAt(R.look);
    for (const [i, el] of R.labels) { const m = R.meshes.get(i); if (!m) continue; const s = toScreen(m.grp.position.clone().add(new THREE.Vector3(-0.55 * m.scale, 0.1, (m.side === "me" ? 0.85 : -0.85) * m.scale))); el.style.left = s.x + "px"; el.style.top = s.y + "px"; }
    if (R.composer) R.composer.render(); else renderer.render(scene, camera);
    if (R.autoQ) watchFps(R.autoQ);
    requestAnimationFrame(tick);
  };
  tick();
  R.speed = animSetting(); gsap.globalTimeline.timeScale(R.speed); // "fast animations" in Settings speed up every move and pause on the table
  gsap.from(R.camBase, { y: 22, z: 18, duration: reduce ? 0 : 2, ease: "power3.out" });
  gsap.from(R.matMat, { emissiveIntensity: 0, duration: reduce ? 0 : 1.8, ease: "power2.out" }); // the gold leaf catches the light once
}
function unmount() {
  document.querySelectorAll(".fxcuts,.rpsduel").forEach((x) => x.remove());
  if (!R) return; R.alive = false; removeEventListener("resize", R.onResize); if (R.onVis) document.removeEventListener("visibilitychange", R.onVis); gsap.globalTimeline.timeScale(1);
  for (const el of R.labels.values()) el.remove();
  R.renderer.dispose(); R.canvas.remove(); R = null;
}

// ---------- 3D avatars: a small figure for each player who has chosen one, at the left end of the centre band ----------
// Original designs made in Blender (tools/avatars). A model with idle / hit / win / lose clips plays them; one without gets the same moves from code.
export const AVATARS = { chang: { name: "ช้างน้อย", file: "chang.glb", h: 1.25 }, naga: { name: "ลูกพญานาค", file: "naga.glb", h: 1.3 }, maew: { name: "แมววิเชียรมาศ", file: "maew.glb", h: 1.2 }, suea: { name: "เสือน้อย", file: "suea.glb", h: 1.25 }, kai: { name: "ไก่ชนน้อย", file: "kai.glb", h: 1.2 } };
// lacquer colours for the mat (the gold line-work stays); the edge colour washes in on the opponent's side
export const MATS = { black: { name: "รักดำ", lac: "#120b09", edge: "rgba(150,34,24," }, red: { name: "รักแดง", lac: "#3a0d09", edge: "rgba(190,60,30," },
  navy: { name: "กรมท่า", lac: "#0b1324", edge: "rgba(60,90,170," }, jade: { name: "เขียวหยก", lac: "#0a1c15", edge: "rgba(40,140,100," }, violet: { name: "ม่วงไพลิน", lac: "#190e22", edge: "rgba(130,70,170," }, gold: { name: "ทองคำเปลว", lac: "#21160a", edge: "rgba(214,166,64," }, indigo: { name: "ครามจันทร์", lac: "#0f1030", edge: "rgba(110,110,210," } };
const avCache = new Map();
const loadAvatar = (key) => {
  const a = AVATARS[key]; if (!a || !THREE.GLTFLoader) return Promise.resolve(null);
  if (!avCache.has(key)) avCache.set(key, new Promise((res) => new THREE.GLTFLoader().load(`assets/avatars/${a.file}?v=${ENV_V}`, res, undefined, () => res(null))));
  return avCache.get(key);
};
// mine stands between the centre band and my Avatar Zone, the opponent's between the band and theirs; both turn a little toward the board
// (a phone shows less of the mat's sides, so there they stand further in and a little smaller)
const avSpot = (mine) => { const x = R.small ? -3.55 : -4.75; return mine ? { x, z: 0.6, ry: 0.5 } : { x, z: -1.0, ry: 0.3 }; };
function syncAvatars(s, V) {
  R.avatars = R.avatars || [null, null];
  for (const p of [0, 1]) {
    const key = (s.P[p] && AVATARS[s.P[p].av3]) ? s.P[p].av3 : ""; const cur = R.avatars[p];
    if (cur && cur.key === key) { if (cur.grp && cur.mine !== (p === V)) placeAvatar(cur, p === V); continue; }
    if (cur && cur.grp) R.scene.remove(cur.grp);
    R.avatars[p] = null; if (!key) continue;
    const slot = { key, loading: true }; R.avatars[p] = slot;
    loadAvatar(key).then((g) => { if (R && R.avatars && R.avatars[p] === slot && g) buildAvatar(slot, g, p === V); });
  }
}
function placeAvatar(a, mine) { const sp = avSpot(mine); a.mine = mine; a.grp.position.set(sp.x, 0, sp.z); a.grp.rotation.y = sp.ry; }
function buildAvatar(slot, g, mine) {
  const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
  model.traverse((o) => { if (!o.isMesh) return; o.material = o.material.clone(); o.castShadow = true; if (R.env && R.Q !== "high" && o.material.metalness > 0.5) o.material.envMap = R.env; });
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), k = ((AVATARS[slot.key].h || 1.25) * (R.small ? 0.82 : 1)) / Math.max(0.01, size.y);
  model.scale.setScalar(k); model.position.set((-(box.min.x + box.max.x) / 2) * k, -box.min.y * k, (-(box.min.z + box.max.z) / 2) * k);
  // layers: grp places it, bob breathes for a model without an idle clip, spin takes the moves made in code, the model plays its own clips
  const spin = new THREE.Group(), bob = new THREE.Group(), grp = new THREE.Group(); spin.add(model); bob.add(spin); grp.add(bob);
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const c of g.animations || []) { const n = c.name.toLowerCase(); for (const w of ["idle", "hit", "win", "lose"]) if (n.includes(w) && !acts[w]) acts[w] = mixer.clipAction(c); }
  for (const w of ["hit", "win", "lose"]) if (acts[w]) { acts[w].setLoop(THREE.LoopOnce, 1); acts[w].clampWhenFinished = true; }
  if (acts.idle) acts.idle.play();
  mixer.addEventListener("finished", (e) => { if (e.action === acts.lose) return; e.action.fadeOut(0.25); if (acts.idle) acts.idle.reset().fadeIn(0.25).play(); });
  Object.assign(slot, { loading: false, grp, bob, spin, model, mixer, acts, ph: Math.random() * 6 }); placeAvatar(slot, mine);
  R.scene.add(grp); if (!reduce) gsap.from(spin.position, { y: 1.4, duration: 0.6, ease: "bounce.out" });
}
// what a player's avatar does: hop (their turn starts), hit (they lose a LIFE), win, lose, rest (back to standing)
function avatarDo(p, what) {
  const a = R.avatars && R.avatars[p]; if (!a || a.loading) return;
  const s = a.spin; gsap.killTweensOf([s.position, s.scale, s.rotation]);
  if (what === "rest") { s.position.set(0, 0, 0); s.scale.set(1, 1, 1); s.rotation.set(0, 0, 0); for (const w of ["hit", "win", "lose"]) if (a.acts[w]) a.acts[w].stop(); if (a.acts.idle) a.acts.idle.reset().setEffectiveWeight(1).play(); return; }
  if (what === "hop") { if (!reduce) gsap.timeline().to(s.position, { y: 0.16, duration: 0.14, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.2, ease: "bounce.out" }); return; }
  if (what === "hit") flashAvatar(a);
  const act = a.acts[what];
  if (act) { if (a.acts.idle) a.acts.idle.fadeOut(0.08); for (const w of ["hit", "win", "lose"]) if (w !== what && a.acts[w]) a.acts[w].stop(); act.reset().setEffectiveWeight(1).fadeIn(0.06).play(); return; }
  if (reduce) return;
  if (what === "hit") gsap.timeline().to(s.scale, { x: 1.16, y: 0.8, z: 1.16, duration: 0.07 }).to(s.scale, { x: 0.95, y: 1.08, z: 0.95, duration: 0.14 }).to(s.scale, { x: 1, y: 1, z: 1, duration: 0.22 }).fromTo(s.rotation, { x: -0.3 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.35)" }, 0);
  if (what === "win") gsap.timeline().to(s.position, { y: 0.32, duration: 0.18, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.18, ease: "power2.in" }).to(s.position, { y: 0.2, duration: 0.16, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.16, ease: "power2.in" }).to(s.rotation, { y: Math.PI * 2, duration: 0.5, ease: "power2.inOut" }, 0).set(s.rotation, { y: 0 });
  if (what === "lose") gsap.timeline().to(s.scale, { y: 0.88, x: 1.04, z: 1.04, duration: 0.6, ease: "power2.out" }).to(s.rotation, { x: 0.22, duration: 0.6, ease: "power2.out" }, 0);
}
// a red flush over the whole figure when it is hit
function flashAvatar(a) {
  a.model.traverse((o) => { if (!o.isMesh || !o.material.emissive) return; const m = o.material; gsap.killTweensOf(m.emissive); m.emissive.setRGB(0.9, 0.08, 0.05); gsap.to(m.emissive, { r: 0, g: 0, b: 0, duration: 0.45, ease: "power2.out" }); });
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
// where the zones sit on the mat. "wide" is the table for screens held sideways; "tall" is for phones held upright,
// where the screen is too narrow for the wide table: the Land Magic Zone moves in from the left edge to the middle
// band, the Construct and Magic Zones close in, and five or six Avatars stand closer together, so every card fits
// on the screen and can be tapped
const ZONES = {
  wide: { avGap: (n) => (n > 4 ? Math.min(2.05, 9.2 / (n - 1)) : 2.05) /* five or six Avatars close up a little */, cs: [-5.8, -1.8], mg: [-1.2, 5.8], csX: (k) => -5.1 + k * 1.3, csS: 0.68, mgX: (k) => 5.1 - k * 1.15, mgS: 0.6,
    land: { x0: -6.98, x1: -5.12, dz: 1.72, x: -6.05, s: 0.72, s2: 0.6, dz2: 0.8, lx: -6.05, lz: MZ + 1.95, align: "center" }, band: [-4.6, 6.85],
    fit: [[-6.8, -5.2], [5.7, -5.2], [-6.8, 4.9], [5.7, 4.9]] }, // the outer cards of a full table
  tall: { avGap: (n) => (n > 4 ? Math.min(2.05, 8.1 / (n - 1)) : 2.05), cs: [-4.35, -1.15], mg: [-0.75, 4.35], csX: (k) => -3.75 + k * 1.0, csS: 0.6, mgX: (k) => 3.8 - k * 0.92, mgS: 0.55,
    land: { x0: -4.45, x1: -2.85, dz: 1.08, x: -3.65, s: 0.62, s2: 0.5, dz2: 0.55, lx: -2.65, lz: MZ - 0.62, align: "left" }, band: [-2.45, 4.35],
    // the part of the table that must be on screen: the zones' outer edges (six Avatars included)
    fit: [[-4.95, -5.3], [4.95, -5.3], [-4.95, 4.95], [4.95, 4.95], [-4.95, MZ], [4.95, MZ]] },
};
const ENV_V = 1, LIGHT_MAX = 3; // bump ENV_V when a file in assets/env changes; the light map stores light / LIGHT_MAX
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
// frame-rate watch for the automatic quality (two slow two-second spells in a row lower it one step; it never goes back up)
function watchFps(A) {
  const now = performance.now(); if (A.last) { const ft = now - A.last; if (ft < 5000) { A.sum += ft; A.n++; } } A.last = now; // the gap after a hidden tab does not count (see mount)
  if (now - A.t0 < 2000 || A.n < 3) return;
  if (now - A.born > 4000 && !document.hidden) { if (1000 / (A.sum / A.n) < 28) { if (++A.slow >= 2) { A.slow = 0; lowerQuality(); } } else A.slow = 0; }
  A.t0 = now; A.sum = 0; A.n = 0;
}
function lowerQuality() {
  if (R.composer) { const c = R.composer; R.composer = null; try { for (const p of c.passes) if (p.dispose) p.dispose(); c.renderTarget1.dispose(); c.renderTarget2.dispose(); } catch { /* freed anyway */ } console.info("3D: glow off to keep the table smooth"); return; }
  const pr = R.renderer.getPixelRatio(); if (pr > 1) { R.renderer.setPixelRatio(Math.max(1, pr - 0.25)); R.resize(); console.info("3D: resolution", Math.max(1, pr - 0.25)); return; }
  R.autoQ = null; // nothing left to lower
}
function matTextures(small, theme = MATS.black, Z = ZONES.wide) {
  const S = small ? 84 : 128; const CW = Math.round(MW * S), CH = Math.round(MD * S);
  const mk = () => { const c = document.createElement("canvas"); c.width = CW; c.height = CH; return c; };
  const base = mk(), glow = mk(), rough = mk(); const g = base.getContext("2d"), q = glow.getContext("2d"), rq = rough.getContext("2d");
  const X = (x) => (x + MW / 2) * S, Y = (z) => (z - MZ + MD / 2) * S, U = (v) => v * S;
  const LAC = theme.lac;
  // lacquer: a warm black with a soft pool of light, flecks of gold leaf, red lacquer creeping in on the opponent's side
  g.fillStyle = LAC; g.fillRect(0, 0, CW, CH); q.fillStyle = "#000"; q.fillRect(0, 0, CW, CH); rq.fillStyle = "#c0c0c0"; rq.fillRect(0, 0, CW, CH); // roughness: lacquer satin, so the hall reflects in it only as a soft glow; gold leaf a little glossier
  let gr = g.createRadialGradient(CW / 2, CH * 0.55, CW * 0.05, CW / 2, CH * 0.55, CW * 0.62); gr.addColorStop(0, "rgba(64,38,28,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  gr = g.createLinearGradient(0, 0, 0, CH * 0.42); gr.addColorStop(0, theme.edge + ".30)"); gr.addColorStop(1, theme.edge + "0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH * 0.42);
  gr = g.createLinearGradient(0, CH, 0, CH * 0.6); gr.addColorStop(0, "rgba(216,168,74,.10)"); gr.addColorStop(1, "rgba(216,168,74,0)"); g.fillStyle = gr; g.fillRect(0, CH * 0.6, CW, CH * 0.4);
  for (let k = 0; k < CW * CH / 900; k++) { const v = Math.random(); g.fillStyle = v < 0.5 ? "rgba(255,255,255,.018)" : "rgba(0,0,0,.05)"; g.fillRect(Math.random() * CW, Math.random() * CH, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let k = 0; k < (small ? 260 : 520); k++) { const x = Math.random() * CW, y = Math.random() * CH, r = Math.random() * 1.6 + 0.4, a = Math.random() * 0.22 + 0.04; g.fillStyle = `rgba(232,186,92,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); q.fillStyle = `rgba(255,255,255,${a * 0.6})`; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); }
  // everything gilded is drawn three times: in gold on the mat, in white on the glow (and metal) map, in grey on the roughness map
  const gild = (fn) => { for (const [c, col, gr] of [[g, GOLD, LAC], [q, "#fff", "#000"], [rq, "#a0a0a0", "#c0c0c0"]]) { c.save(); c.strokeStyle = c.fillStyle = col; c.lineJoin = "miter"; fn(c, gr); c.restore(); } };
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
      frame(c, Z.cs[0], zo - 0.76, Z.cs[1], zo + 0.76, 0.11, 0.028); inLabel(c, "Construct Zone", Z.cs[0], zo - 0.76, Z.cs[1], zo + 0.76, flip);
      frame(c, Z.mg[0], zo - 0.76, Z.mg[1], zo + 0.76, 0.11, 0.028); inLabel(c, "Magic Zone", Z.mg[0], zo - 0.76, Z.mg[1], zo + 0.76, flip);
    }
    // Land Magic Zone, shared in the middle on the left; the centre band of ประจำยาม runs from it
    const Ld = Z.land, [b0, b1] = Z.band; frame(c, Ld.x0, MZ - Ld.dz, Ld.x1, MZ + Ld.dz, 0.13, 0.03); label(c, "Land Magic", Ld.lx, Ld.lz, false, Ld.align);
    c.lineWidth = U(0.022); for (const dz of [-0.24, 0.24]) { c.beginPath(); c.moveTo(X(b0), Y(MZ + dz)); c.lineTo(X(b1), Y(MZ + dz)); c.stroke(); }
    for (let x = b0 + 0.4; x <= b1 - 0.25; x += 0.9) prajamyam(c, X(x), Y(MZ), U(0.14), ground);
    for (const x of [b0, b1]) prajamyam(c, X(x), Y(MZ), U(0.3), ground);
  });
  draw();
  const tb = new THREE.CanvasTexture(base), tg = new THREE.CanvasTexture(glow), tr = new THREE.CanvasTexture(rough); tb.encoding = THREE.sRGBEncoding; tb.anisotropy = tg.anisotropy = tr.anisotropy = 8;
  // the labels need the display font: redraw once it has loaded
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => { if (!R) return; draw(); tb.needsUpdate = tg.needsUpdate = tr.needsUpdate = true; });
  return { base: tb, glow: tg, rough: tr };
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
function candle(x, z) { // no real light: a lamp per candle would make every lit surface on the table slower to draw
  const grp = new THREE.Group(); grp.position.set(x, -0.335, z);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0xc99a3e, metalness: 0.6, roughness: 0.35 })); dish.position.y = 0.03;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.62, 20), new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6, emissive: 0x3a2008, emissiveIntensity: 0.5 })); wax.position.y = 0.37;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flame.scale.set(0.16, 0.36, 1); flame.position.y = 0.86;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.FX.dot, color: 0xffa040, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(1.3, 1.3, 1); halo.position.y = 0.86;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0xff9a40, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004;
  grp.add(dish, wax, flame, halo, pool);
  // once the brass candlesticks have loaded, the drawn dish and candle give way and the flame moves up to the wick
  const onStand = () => { dish.visible = wax.visible = false; flame.position.y = halo.position.y = 1.7; };
  R.scene.add(grp); return { flame, halo, pool, ph: Math.random() * 10, onStand };
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
// summoning circles, one per player (chosen in settings, opened by playing): drawn white, tinted by the card's colour
export const SIGILS = { lotus: { name: "บัวประจำยาม" }, sun: { name: "สุริยะดาวเพดาน" }, naga: { name: "เกล็ดนาค" }, yant: { name: "ตารางยันต์" }, pikul: { name: "ดอกพิกุล" } };
function sigilTexture(kind = "lotus") {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"), C = 256;
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512); g.strokeStyle = g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 10;
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  const at = (a, d) => [C + Math.cos(a) * d, C + Math.sin(a) * d];
  ring(238, 7); ring(222, 2);
  if (kind === "sun") { // สุริยะ: long and short rays round an eight-point ceiling star (ดาวเพดาน)
    ring(140, 4);
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2, L = k % 2 ? 182 : 214, w = k % 2 ? 0.05 : 0.07; g.beginPath(); g.moveTo(...at(a - w, 150)); g.lineTo(...at(a, L)); g.lineTo(...at(a + w, 150)); g.closePath(); g.fill(); }
    g.lineWidth = 4; for (const r0 of [0, Math.PI / 4]) { g.beginPath(); for (let k = 0; k < 4; k++) { const p = at(r0 + (k * Math.PI) / 2, 118); k ? g.lineTo(...p) : g.moveTo(...p); } g.closePath(); g.stroke(); }
    ring(46, 3); g.beginPath(); g.arc(C, C, 18, 0, 7); g.fill();
  } else if (kind === "naga") { // เกล็ดนาค: a band of overlapping scales, a coil of dots, a small flower at the heart
    ring(146, 4);
    for (const [r, n, off] of [[214, 36, 0], [190, 36, 0.5], [166, 36, 0]]) for (let k = 0; k < n; k++) { const a = ((k + off) / n) * Math.PI * 2; g.lineWidth = 2.5; g.beginPath(); g.arc(...at(a, r), 13, a + Math.PI * 0.5, a + Math.PI * 1.5, false); g.stroke(); }
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2 + k * 0.02; g.beginPath(); g.arc(...at(a, 120 - k * 2.4), 4 - k * 0.08, 0, 7); g.fill(); }
    prajamyam(g, C, C, 52, "#000");
  } else if (kind === "yant") { // ตารางยันต์: two squares make an eight-point frame round a three-by-three grid, ticks like a compass
    ring(150, 3);
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; g.lineWidth = k % 4 ? 1.5 : 3.5; g.beginPath(); g.moveTo(...at(a, 158)); g.lineTo(...at(a, k % 4 ? 172 : 196)); g.stroke(); }
    g.lineWidth = 4; for (const r0 of [Math.PI / 4, 0]) { g.beginPath(); for (let k = 0; k < 4; k++) { const p = at(r0 + (k * Math.PI) / 2, 146); k ? g.lineTo(...p) : g.moveTo(...p); } g.closePath(); g.stroke(); }
    const h = 146 / Math.SQRT2, s3 = (2 * h) / 3; g.lineWidth = 2;
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(C - h + k * s3, C - h); g.lineTo(C - h + k * s3, C + h); g.moveTo(C - h, C - h + k * s3); g.lineTo(C + h, C - h + k * s3); g.stroke(); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(C - h + s3 * (i + 0.5), C - h + s3 * (j + 0.5), (i + j) % 2 ? 9 : 15, 0, 7); (i + j) % 2 ? g.fill() : g.stroke(); }
  } else if (kind === "pikul") { // ดอกพิกุล: a ring of small eight-petalled pikul flowers round one large one
    ring(146, 4); ring(132, 1.5);
    const pikul = (cx, cy, r, w) => { g.lineWidth = w; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, P = (d, da) => [cx + Math.cos(a + da) * d, cy + Math.sin(a + da) * d];
      g.beginPath(); g.moveTo(...P(r * 0.28, -0.32)); g.lineTo(...P(r * 0.82, -0.2)); g.lineTo(...P(r, 0)); g.lineTo(...P(r * 0.82, 0.2)); g.lineTo(...P(r * 0.28, 0.32)); g.closePath(); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, r * 0.2, 0, 7); g.fill(); };
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pikul(...at(a, 186), 30, 2.5); g.beginPath(); g.arc(...at(a + Math.PI / 12, 186), 4, 0, 7); g.fill(); }
    pikul(C, C, 112, 4); ring(52, 2);
  } else { // บัวประจำยาม: sixteen lotus petals round a four-petal flower
    ring(146, 4); ring(132, 1.5);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, P = (d, da) => [C + Math.cos(a + da) * d, C + Math.sin(a + da) * d];
      g.lineWidth = 3; g.beginPath(); g.moveTo(...P(152, -0.16)); g.quadraticCurveTo(...P(196, -0.13), ...P(214, 0)); g.quadraticCurveTo(...P(196, 0.13), ...P(152, 0.16)); g.stroke();
      g.beginPath(); g.arc(...P(230, Math.PI / 16), 4, 0, 7); g.fill(); }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.lineWidth = 2; g.beginPath(); g.moveTo(C + Math.cos(a) * 60, C + Math.sin(a) * 60); g.lineTo(C + Math.cos(a) * 128, C + Math.sin(a) * 128); g.stroke(); }
    prajamyam(g, C, C, 92, "#000");
  }
  return new THREE.CanvasTexture(c);
}
const sigilTex = (kind) => (R.sigilTexs[kind] = R.sigilTexs[kind] || sigilTexture(SIGILS[kind] ? kind : "lotus"));
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
  if (!token && mat.map === R.backTex) resolveArt(c).then((url) => { if (!url || !R) return; R.loader.load(corsUrl(url), (t) => { if (!R) return t.dispose(); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; R.texCache.set(d.im, t); mat.map = t; mat.needsUpdate = true; }); });
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
// the other side's Magic, shown big for a moment as it is played (as card games show a played spell), then the effect
function showcase(s, ev) {
  const L = E.locate(s, ev.i), d = L && s.cards[L.x.c], c = d && d.im != null ? card(d.im) : null; if (!c) return Promise.resolve();
  const el = h("div", { class: "showcase", "aria-hidden": "true" }, artImg(c, "scimg"), h("b", null, `${(s.P[ev.p] || {}).name || "ฝ่ายตรงข้าม"} ใช้ ${d.n}`));
  document.body.append(el); const k = 1 / ((R && R.speed) || 1);
  gsap.set(el, { xPercent: -50, yPercent: -50 });
  gsap.fromTo(el, { opacity: 0, scale: reduce ? 1 : 0.8 }, { opacity: 1, scale: 1, duration: 0.22 * k, ease: "back.out(1.6)" });
  gsap.to(el, { opacity: 0, duration: 0.25 * k, delay: 1.1 * k, onComplete: () => el.remove() });
  return sleepMs(950);
}
// the effect strip: newest on top, three at most, each fades by itself (never takes a click)
function fxCut(s, ev, mine) {
  const d = s.cards[ev.c]; if (!d) return; const c = d.im != null ? card(d.im) : null;
  let box = document.querySelector(".fxcuts"); if (!box) { box = h("div", { class: "fxcuts", "aria-live": "polite" }); document.body.append(box); }
  const el = h("div", { class: "fxcut glass" + (mine ? " mine" : " opp") }, c ? artImg(c, "fxart") : h("div", { class: "fxart tok" }, "✦"),
    h("div", { class: "fxtx" }, h("b", null, (mine ? "" : (s.P[ev.p] ? s.P[ev.p].name + " · " : "")) + d.n), h("span", null, ev.t || "")));
  box.prepend(el); while (box.children.length > 3) box.lastChild.remove();
  const k = Math.max(0.25, 1 / ((R && R.speed) || 1)); if (!reduce) gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25 });
  gsap.to(el, { opacity: 0, duration: 0.4, delay: 2.6 * k + Math.min(2, String(ev.t || "").length / 60) * k, onComplete: () => el.remove() });
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
const tallScreen = (el) => (el.clientWidth || innerWidth) / (el.clientHeight || innerHeight) < 0.9;
// phones held upright: the band of the screen the table must fit in, between the opponent's bar and our hand (both
// drawn over the table); measured when the game's HUD is on screen, otherwise its usual size
function tallBand(w, hh) {
  const top = document.querySelector(".hud .oppbar"), hand = document.querySelector(".hud .handrow") || document.querySelector(".hud .handzone"), side = document.querySelector(".hud .matchp");
  const t = top ? top.getBoundingClientRect().bottom + 6 : 64; const hr = hand && hand.getBoundingClientRect(); const sr = side && side.getBoundingClientRect();
  const handTop = hr && hr.height > 40 ? hr.top + (hand.classList.contains("handrow") ? 6 : 30) : hh - 205;
  // a tablet held upright keeps the side panel of the wide screen: the table moves left of it
  const r = sr && sr.width > 40 && sr.left > w * 0.45 ? sr.left - 4 : w;
  return { t, b: Math.max(t + 160, handTop), l: 0, r };
}
// the camera for a wide screen: the usual height and tilt, then the table (its outer cards) is centred in the part of the
// screen left of the game panel, moving back a little first if it would not fit there
function wideCam(camera, w, hh, k) {
  const nd = new THREE.Vector3(0, 11.2, 9.2).normalize(), base = Math.hypot(11.2 * k, 9.6 * k - 0.4);
  const side = document.querySelector(".hud .matchp"), sr = side && side.getBoundingClientRect();
  const L = 14, Rt = (sr && sr.width > 40 && sr.left > w * 0.55 ? sr.left : w) - 14;
  const pts = ZONES.wide.fit.map(([x, z]) => new THREE.Vector3(x, 0, z)), q = new THREE.Vector3();
  const span = (d, cx) => { const tg = new THREE.Vector3(cx, 0, 0.4); camera.position.copy(tg).addScaledVector(nd, d); camera.lookAt(tg); camera.updateMatrixWorld(true);
    let a = Infinity, b = -Infinity; for (const p of pts) { q.copy(p).project(camera); const x = (q.x * 0.5 + 0.5) * w; a = Math.min(a, x); b = Math.max(b, x); } return [a, b]; };
  let d = base; for (let i = 0; i < 10; i++) { const [a, b] = span(d, 0); if (b - a <= Rt - L || d > base * 1.35) break; d *= 1.035; }
  let cx = 0; const perPx = (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / hh;
  for (let i = 0; i < 3; i++) { const [a, b] = span(d, cx); cx += ((a + b) / 2 - (L + Rt) / 2) * perPx; }
  const look = new THREE.Vector3(cx, 0, 0.4); return { pos: look.clone().addScaledVector(nd, d), look };
}
// the camera for an upright screen: the same downward tilt, moved back just far enough that the whole tall table (its
// fit points) fits across the screen and between the bars, then centred in that band
function fitTall(camera, w, hh) {
  const V3 = THREE.Vector3, dir = new V3(0, -17.5, -10.6).normalize(), band = tallBand(w, hh), M = 10, q = new V3();
  const pts = ZONES.tall.fit.map(([x, z]) => new V3(x, 0, z));
  const proj = (d, xc, zc) => { const look = new V3(xc, 0, zc); camera.position.copy(look).addScaledVector(dir, -d); camera.lookAt(look); camera.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { q.copy(p).project(camera); const sx = (q.x * 0.5 + 0.5) * w, sy = (-q.y * 0.5 + 0.5) * hh; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    return { x0, x1, y0, y1 }; };
  let xc = 0, zc = 1.9, d = 20.5;
  for (let it = 0; it < 5; it++) {
    let lo = 6, hi = 120; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, r = proj(m, xc, zc); if (r.x1 - r.x0 <= band.r - band.l - 2 * M && r.y1 - r.y0 <= band.b - band.t) hi = m; else lo = m; } d = hi;
    // then move the view so the table sits in the middle of the band, across and down (a step of 0.5 measures how far it moves)
    const r = proj(d, xc, zc), my = (r.y0 + r.y1) / 2, mx = (r.x0 + r.x1) / 2, wy = (band.t + band.b) / 2, wx = (band.l + band.r) / 2;
    const rz = proj(d, xc, zc + 0.5), rx = proj(d, xc + 0.5, zc), pz = ((rz.y0 + rz.y1) / 2 - my) / 0.5, px = ((rx.x0 + rx.x1) / 2 - mx) / 0.5;
    if (Math.abs(wy - my) < 1 && Math.abs(wx - mx) < 1) break; if (pz) zc += (wy - my) / pz; if (px) xc += (wx - mx) / px;
  }
  const look = new V3(xc, 0, zc); return { pos: look.clone().addScaledVector(dir, -d), look };
}
// the mat redrawn for the other table (the phone was turned)
function swapMat() {
  if (!R || !R.matMat || !R.matKey) return; const mt = matTextures(...R.matKey, R.zones), M = R.matMat;
  for (const k of ["map", "emissiveMap", "roughnessMap"]) if (M[k] && M[k].dispose) M[k].dispose();
  M.map = mt.base; M.emissiveMap = mt.glow; M.roughnessMap = mt.rough; if (M.metalnessMap) M.metalnessMap = mt.glow; R.matGlow = mt.glow; M.needsUpdate = true;
}
function layout(s, V) {
  const out = new Map(); const Z = R.zones || ZONES.wide;
  for (const p of [0, 1]) {
    const side = p === V ? "me" : "opp"; const P = s.P[p]; const zs = side === "me" ? 1 : -1;
    const n = P.av.length, gap = Z.avGap(n); P.av.forEach((x, k) => out.set(x.i, { x, p, side, zone: "av", pos: new THREE.Vector3((k - (n - 1) / 2) * gap, 0.04, side === "me" ? 2.15 : -2.55), scale: 1 }));
    P.cs.forEach((x, k) => out.set(x.i, { x, p, side, zone: "cs", pos: new THREE.Vector3(Z.csX(k), 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: Z.csS }));
    P.mg.forEach((x, k) => out.set(x.i, { x, p, side, zone: "mg", pos: new THREE.Vector3(Z.mgX(k), 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: Z.mgS }));
  }
  { const two = !!(s.land && s.land2), Ld = Z.land; for (const l of [s.land, s.land2]) if (l) out.set(l.i, { x: l, p: l.o, side: l.o === V ? "me" : "opp", zone: "land", pos: new THREE.Vector3(Ld.x, 0.04, MZ + (two ? (l.o === V ? Ld.dz2 : -Ld.dz2) : 0)), scale: two ? Ld.s2 : Ld.s }); } // แบ่งแยกดินแดน: one Land per side
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
function done(m) { m.busy = false; if (!R) return; home(m, 0.3); if (!m.pulse) gsap.to(m.glow.material, { opacity: m.sel ? GLOW.sel : GLOW.rest, duration: 0.4 }); }
function settle(m, delay) { // the table as it stands (resuming a game): cards just come down into place
  const w = m.want, g = m.grp; g.rotation.set(0, w.rotY, 0); g.scale.setScalar(w.scale); g.position.set(w.pos.x, w.pos.y, w.pos.z); if (reduce) return;
  m.busy = true; g.position.y = w.pos.y + 0.9; m.shOp = 0; gsap.to(m, { shOp: 0.6, duration: 0.4, delay }); gsap.to(g.position, { y: w.pos.y, duration: 0.35, delay, ease: "power2.in", onComplete: () => done(m) });
}
// summoned: the card rises from its owner's hand, turns over above its slot as a summoning circle opens beneath, then slams down
function summonIn(m, L, co, cHex) {
  const mine = L.side === "me", P = L.pos, s = L.scale, g = m.grp, hy = mine ? 3 : 2.1, hz = P.z + (mine ? 1.5 : 1.9); // the hover point stays in view from either seat
  g.position.set(P.x * 0.45, 1.4, mine ? 6.6 : -7.8); g.rotation.set(Math.PI / 2 - 0.3, 0, Math.PI); g.scale.setScalar(s * 0.8);
  m.busy = true; m.shOp = 0; m.glow.material.opacity = 0;
  const ring = sigil(P, cHex, s, R.sig[L.p]); Sfx.play("rise"); trail(m, cHex, 0.95);
  gsap.timeline({ onComplete: () => done(m) })
    .to(g.position, { x: P.x, y: hy, z: hz, duration: 0.5, ease: "power2.out" }, 0)
    .to(g.rotation, { x: Math.PI / 2 - 0.12, z: 0, duration: 0.55, ease: "power2.inOut" }, 0.02)
    .to(g.scale, { x: s * 1.3, y: s * 1.3, z: s * 1.3, duration: 0.5, ease: "power2.out" }, 0)
    .add(() => R && sweep(m, 1.2, 0.55), 0.34)
    .to(m, { shOp: 0.6, duration: 0.5 }, 0.3)
    .to(g.position, { y: hy + 0.14, duration: 0.24, ease: "sine.inOut" }, 0.5)
    .to(g.position, { x: P.x, y: P.y, z: P.z, duration: 0.22, ease: "power4.in" }, 0.76)
    .to(g.rotation, { x: 0, y: m.want.rotY, duration: 0.22, ease: "power3.in" }, 0.76)
    .to(g.scale, { x: s, y: s, z: s, duration: 0.22, ease: "power3.in" }, 0.76)
    .add(() => { if (!R) return; landFx(P, s, co, cHex); ringOut(ring, s); Sfx.play("summon", { color: co }); m.glow.material.opacity = 1; }, 0.98)
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
    .add(() => { if (!R) return; dust(P, s * 0.8, 6); sweep(m, 0.9, 0.6); }, 0.42);
}
function landFx(P, s, co, cHex) {
  shockwave(P, cHex, 6 * s); dust(P, s, 10); pillar(P, cHex); colorFx(P, co);
  burst(new THREE.Vector3(P.x, 0.3, P.z), { n: 10, map: R.FX.star_06, color: 0xffe2a8, size: 0.45, spread: 2 * s, up: 0.9, dur: 0.6 }); burst(new THREE.Vector3(P.x, 0.2, P.z), { n: 18, color: cHex, size: 0.2, spread: 2.4 * s, up: 0.7, dur: 0.7 });
  shake(0.2, 0.5); flash("rgba(255,236,200,.2)", 0.2);
}
function sigil(P, color, s, kind) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sigilTex(kind), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
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
// ---------- dice and coins: thrown onto the table from the roller's side, landing on what the engine rolled ----------
// Thai dice (as in ไฮโล) paint the one and the four red; the coin says หัว and ก้อย on its faces so the result reads at a glance
const PIPS = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]] };
function canvasTex(S, draw) { const c = document.createElement("canvas"); c.width = c.height = S; draw(c.getContext("2d"), S); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
const dieFace = (n) => canvasTex(128, (g, S) => {
  const gr = g.createRadialGradient(S * 0.38, S * 0.32, S * 0.1, S / 2, S / 2, S * 0.78); gr.addColorStop(0, "#fdf6e6"); gr.addColorStop(1, "#dccaa6"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(120,90,50,.35)"; g.lineWidth = 5; g.strokeRect(2.5, 2.5, S - 5, S - 5); // the worn edge
  for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(x * S, y * S, n === 1 ? S * 0.15 : S * 0.085, 0, Math.PI * 2); g.fillStyle = n === 1 || n === 4 ? "#b3212b" : "#1d1411"; g.fill(); g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5; g.stroke(); }
});
const coinFace = (txt) => canvasTex(256, (g, S) => {
  const C = S / 2, gr = g.createRadialGradient(C * 0.8, C * 0.7, S * 0.05, C, C, C); gr.addColorStop(0, "#ffe6a3"); gr.addColorStop(0.6, "#d9a744"); gr.addColorStop(1, "#8f6420"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = "#7a5418"; g.lineWidth = 6; g.beginPath(); g.arc(C, C, C * 0.86, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#7a5418"; for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; g.beginPath(); g.arc(C + Math.cos(a) * C * 0.76, C + Math.sin(a) * C * 0.76, 3.2, 0, Math.PI * 2); g.fill(); } // a ring of beads
  g.font = `700 ${Math.round(S * 0.3)}px "Mitr","Noto Sans Thai",sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,240,200,.55)"; g.fillText(txt, C + 2, C + 4); g.fillStyle = "#5e3f10"; g.fillText(txt, C, C + 2);
});
// which way up each face sits: the die's faces in BoxGeometry order (+X, -X, +Y, -Y, +Z, -Z) carry 2, 5, 1, 6, 3, 4
const DIE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
function rollProp(coin) {
  if (coin && !R.coinMats) { R.coinGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 48); R.coinMats = [new THREE.MeshStandardMaterial({ color: 0xc8962e, metalness: 0.55, roughness: 0.32 }), new THREE.MeshStandardMaterial({ map: coinFace("หัว"), metalness: 0.4, roughness: 0.36 }), new THREE.MeshStandardMaterial({ map: coinFace("ก้อย"), metalness: 0.4, roughness: 0.36 })]; if (R.env) for (const m of R.coinMats) { m.envMap = R.env; m.envMapIntensity = 1.3; } }
  if (!coin && !R.dieMats) { R.dieGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6); R.dieMats = [2, 5, 1, 6, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: dieFace(n), roughness: 0.3, metalness: 0 })); }
  const m = new THREE.Mesh(coin ? R.coinGeo : R.dieGeo, coin ? R.coinMats : R.dieMats); m.castShadow = true; R.scene.add(m);
  const sh = new THREE.Mesh(R.dieShGeo || (R.dieShGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: 0, alphaMap: R.FX.dot, transparent: true, opacity: 0, depthWrite: false })); sh.renderOrder = -1; R.scene.add(sh); // a soft round shadow
  return { m, sh, rest: coin ? 0.04 : 0.3 };
}
// one throw: up from the roller's side, a fall, two bounces, spinning down to the face the engine chose
function throwProp(coin, r, from, to) {
  const { m, sh, rest } = rollProp(coin), up = coin ? (r === 1 ? [0, 0, 0] : [Math.PI, 0, 0]) : DIE_UP[r] || DIE_UP[1];
  const fin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...up)));
  const axis = coin ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin = (coin ? 9 : 5 + Math.random() * 2) * Math.PI, tmp = new THREE.Quaternion();
  const st = { a: 1 }; const face = () => { m.quaternion.copy(fin).multiply(tmp.setFromAxisAngle(axis, st.a * spin)); const hgt = Math.max(0, m.position.y - rest); sh.position.set(m.position.x - hgt * 0.25, 0.013, m.position.z - hgt * 0.4); sh.scale.setScalar((coin ? 1.6 : 1.5) * (1 + hgt * 0.18)); sh.material.opacity = 0.7 * Math.max(0.12, 1 - hgt * 0.35); };
  m.position.copy(from); face();
  if (reduce) { m.position.copy(to).setY(rest); st.a = 0; face(); return Promise.resolve({ m, sh }); }
  const top = coin ? 3.4 : 2.4;
  return new Promise((res) => gsap.timeline({ onUpdate: face, onComplete: () => res({ m, sh }) })
    .to(m.position, { x: to.x, z: to.z, duration: 1.05, ease: "power2.out" }, 0)
    .to(m.position, { y: top, duration: 0.34, ease: "power2.out" }, 0).to(m.position, { y: rest, duration: 0.38, ease: "power2.in" }, 0.34)
    .add(() => Sfx.play(coin ? "clink" : "dice"), 0.72)
    .to(m.position, { y: rest + (coin ? 0.28 : 0.45), duration: 0.14, ease: "power2.out" }, 0.72).to(m.position, { y: rest, duration: 0.14, ease: "power2.in" }, 0.86)
    .to(m.position, { y: rest + 0.1, duration: 0.07, ease: "power2.out" }, 1.0).to(m.position, { y: rest, duration: 0.07, ease: "power2.in" }, 1.07)
    .to(st, { a: 0, duration: 1.12, ease: "power3.out" }, 0));
}
async function rollFx(ev, mine) {
  const coin = ev.sides === 2, rs = ev.r2 != null ? [ev.r, ev.r2] : [ev.r];
  if (coin) Sfx.play("coin");
  const z = MZ + (mine ? 0.75 : -0.75), sideZ = mine ? 4.4 : -4.8;
  const got = await Promise.all(rs.map((r, k) => throwProp(coin, r, new THREE.Vector3((mine ? -0.8 : 0.8) + k * 0.5, 0.6, sideZ), new THREE.Vector3(0.9 + k * 0.95 - (rs.length - 1) * 0.45, 0, z + k * 0.25))));
  const at = new THREE.Vector3(0.9, 0.9, z); shockwave(at.clone().setY(0), 0xffd27a, 2.6); burst(at.clone().setY(0.5), { n: 12, map: R.FX.star_06, color: 0xffe6a3, size: 0.35, spread: 1.1, up: 1.2, dur: 0.7 });
  popText(at, coin ? `ออก${ev.r === 1 ? "หัว" : "ก้อย"}` : rs.join(" · "), "#ffd27a");
  await sleepMs(1300);
  for (const { m, sh } of got) gsap.to(m.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, ease: "back.in(2)", onComplete: () => { if (!R) return; R.scene.remove(m); R.scene.remove(sh); sh.material.dispose(); } });
}
// เป่ายิงฉุบ: both hands come down together, the loser's side dims
const RPS_HAND = ["✊", "✌️", "✋"], RPS_NAME = ["ค้อน", "กรรไกร", "กระดาษ"];
async function rpsFx(s, ev, V) {
  const me = V, op = 1 - V, el = h("div", { class: "rpsduel", "aria-live": "polite" });
  const row = (p) => h("div", { class: "rpsrow" + (p === op ? " top" : "") }, h("span", { class: "rpsh" }, "✊"), h("span", { class: "rpsn" }, s.P[p] ? s.P[p].name : ""));
  const rows = [row(op), h("b", { class: "rpsbeat" }, "เป่า"), row(me)]; el.append(...rows); document.body.append(el); Sfx.play("rps");
  const hands = [rows[0], rows[2]].map((r) => r.querySelector(".rpsh")), beat = rows[1];
  if (!reduce) gsap.fromTo(hands, { y: 0 }, { y: -14, duration: 0.14, yoyo: true, repeat: 5, ease: "power1.inOut" });
  for (const [k, t] of [[0, "เป่า"], [1, "ยิง"], [2, "ฉุบ!"]]) { beat.textContent = t; if (k < 2) await sleepMs(280); }
  hands[0].textContent = RPS_HAND[ev.h[op]]; hands[1].textContent = RPS_HAND[ev.h[me]];
  rows[0].querySelector(".rpsn").textContent = `${s.P[op] ? s.P[op].name : ""} · ${RPS_NAME[ev.h[op]]}`; rows[2].querySelector(".rpsn").textContent = `${s.P[me] ? s.P[me].name : ""} · ${RPS_NAME[ev.h[me]]}`;
  (ev.lo === op ? rows[0] : rows[2]).classList.add("lost"); beat.textContent = ev.lo === me ? "แพ้" : "ชนะ";
  await sleepMs(1400); gsap.to(el, { opacity: 0, duration: 0.3, onComplete: () => el.remove() });
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
        if (!R) return; Sfx.play("clash"); hitFx(ev.ti != null && R.meshes.get(ev.ti)); sweep(m, 1, 0.4); const sl = sprite(R.FX.slash_02, tint, 3.6, hit.clone().setY(1)); sl.material.rotation = Math.random() * 2;
        gsap.fromTo(sl.scale, { x: 0.5, y: 0.5 }, { x: 4.2, y: 4.2, duration: 0.25, ease: "power3.out" }); gsap.to(sl.material, { opacity: 0, duration: 0.35, delay: 0.1, onComplete: () => R && R.scene.remove(sl) });
        burst(hit.clone().setY(0.8), { n: 22, color: 0xffd27a, spread: 2.6, size: 0.24 }); burst(hit.clone().setY(0.8), { n: 6, map: R.FX.star_06, color: 0xfff1c9, spread: 1.6, size: 0.5, dur: 0.5 }); shockwave(hit, aco ? tint : 0xff8a4a, 5); if (aco) colorFx(hit, aco, 0.6); shake(0.42, 0.6); flash("rgba(255,240,210,.5)", 0.45);
      })
      .to(m.grp.position, { x: from.x, y: from.y, z: from.z, duration: 0.42, ease: "power2.out" }, "+=0.1").to(m.grp.rotation, { x: 0, duration: 0.42, ease: "power2.out" }, "<")
      .add(() => done(m)));
  } else if (ev.k === "life") {
    const mine = mineSide(ev.p); Sfx.play("life"); avatarDo(ev.p, "hit"); if (mine) buzz([35, 50, 60]);
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
    if (!mineSide(ev.p)) await showcase(s, ev);
  } else if (ev.k === "heal") { // a LIFE card turned back face-down: green light rising where that side's LIFE sits
    const mine = mineSide(ev.p), at = new THREE.Vector3(0, 1, mine ? 5.2 : -4.7); Sfx.play("heal");
    popText(at.clone().setY(1.2), "LIFE +1", "#5ef0a0"); pillar(at.clone().setY(0), 0x6dffb0, 0.75); ripple(at.clone().setY(0), 0x7dffb8, 3.4);
    burst(at, { n: 18, map: R.FX.star_06, color: 0xa8ffd0, size: 0.34, spread: 1.3, up: 2.8, dur: 1.2 }); await sleepMs(450);
  } else if (ev.k === "roll") { await rollFx(ev, mineSide(ev.p));
  } else if (ev.k === "rps") { await rpsFx(s, ev, V);
  } else if (ev.k === "fx") { // a card's effect resolves: its picture, its name and what it did, for a moment over the table
    fxCut(s, ev, mineSide(ev.p)); await sleepMs(350);
  } else if (ev.k === "turn") {
    mood(mineSide(ev.p)); avatarDo(ev.p, "hop"); Sfx.play("turn", { mine: mineSide(ev.p) }); if (mineSide(ev.p)) buzz(25); banner(mineSide(ev.p) && !R.watch ? "YOUR TURN" : s.P[ev.p].name, `เทิร์น ${ev.t}`); await sleepMs(500);
  } else if (ev.k === "battle") {
    Sfx.play("battle"); banner("BATTLE PHASE", ""); gsap.fromTo(R.div.material, { opacity: 0.9 }, { opacity: 0, duration: 1.4, ease: "power2.out" });
  } else if (ev.k === "over") {
    const won = R.watch ? ev.w != null : ev.w === V; Sfx.play(won ? "win" : "lose"); if (R.watch) banner(ev.w != null ? s.P[ev.w].name : "DRAW", ev.w != null ? "ชนะ" : ""); else banner(won ? "VICTORY" : "DEFEAT", ""); for (const p of [0, 1]) avatarDo(p, ev.w === p ? "win" : "lose"); flash(won ? "rgba(255,210,120,.5)" : "rgba(80,0,10,.6)", 0.6);
    if (!reduce) for (let k = 0; k < (won ? 90 : 40); k++) gsap.delayedCall(Math.random() * 1.6, () => { // gold leaf rains for a win, ash and embers drift down for a loss
      if (!R) return; const win = won, p0 = new THREE.Vector3((Math.random() - 0.5) * 15, 6 + Math.random() * 2, (Math.random() - 0.5) * 10 - 0.5);
      const sp = sprite(win && Math.random() < 0.4 ? R.FX.star_06 : R.FX.dot, win ? [0xffd27a, 0xffe9b0, 0xd8a84a, 0xff9a4a][k % 4] : k % 3 ? 0x3a2622 : 0xff5a3a, win ? 0.28 + Math.random() * 0.2 : 0.2 + Math.random() * 0.25, p0, 0.95);
      const d = 2.2 + Math.random() * 1.6; gsap.to(sp.position, { y: 0.1, x: p0.x + (Math.random() - 0.5) * 2, z: p0.z + (Math.random() - 0.5) * 1.5, duration: d, ease: "sine.in" }); gsap.to(sp.material, { rotation: (Math.random() - 0.5) * 8, duration: d });
      gsap.to(sp.material, { opacity: 0, duration: 0.6, delay: d - 0.6, onComplete: () => { R && R.scene.remove(sp); sp.material.dispose(); } });
    });
  }
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms / ((R && R.speed) || 1)));
// without WebGL there is no table to throw a die on: the result still shows, as a note in the middle of the screen
let flatLast = 0, flatView = null;
function flatEvents(s, V, opts) {
  if (opts.reset || flatView !== V) { flatLast = s.evc || 0; flatView = V; return; }
  for (const e of (s.ev || []).filter((x) => x.id > flatLast)) {
    if (e.k === "roll") flatNote(`${e.sides === 2 ? "ทอยเหรียญ" : "ทอยลูกเต๋า"}${e.why ? " (" + e.why + ")" : ""}: ${e.sides === 2 ? (e.r === 1 ? "ออกหัว" : "ออกก้อย") : "ได้ " + (e.r2 != null ? `${e.r} และ ${e.r2}` : e.r)}`);
    else if (e.k === "heal") flatNote(`${e.p === V ? "LIFE เรา" : "LIFE " + ((s.P[e.p] || {}).name || "ฝ่ายตรงข้าม")} +1`);
    else if (e.k === "rps") rpsFx(s, e, V).catch(() => {});
    else if (e.k === "fx") fxCut(s, e, e.p === V); // an effect resolves: the same strip as over the 3D table
    else if (e.k === "cast" && e.p !== V) showcase(s, e);
    else if (e.k === "life") { flatNote(e.p === V ? "LIFE เรา −1" : `LIFE ${(s.P[e.p] || {}).name || "ฝ่ายตรงข้าม"} −1`); if (e.p === V) buzz([35, 50, 60]); }
    else if (e.k === "turn" && e.p === V) buzz(25);
  }
  flatLast = s.evc || flatLast;
}
function flatNote(t) {
  const d = h("div", { class: "flatfx glass", role: "status" }, t); document.body.append(d);
  gsap.fromTo(d, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 }); gsap.to(d, { opacity: 0, duration: 0.4, delay: 2.4, onComplete: () => d.remove() });
}
function update(s, V, opts = {}) {
  if (!R) { try { flatEvents(s, V, opts); } catch (e) { console.warn(e); } return Promise.resolve(); } R.last = { s, V };
  // flush: a jump (a replay seek) drops the animations still waiting in the queue, and the banner they raised
  if (opts.flush) { R.token = (R.token || 0) + 1; const band = document.querySelector(".banner .band"); if (band) { gsap.killTweensOf(band); gsap.set(band, { opacity: 0 }); } }
  const token = R.token || 0;
  R.queue = R.queue.then(async () => {
    if (!R || (R.token || 0) !== token) return;
    if (opts.reset || R.view !== V) { R.lastEv = s.evc || 0; R.view = V; }
    R.sig = [0, 1].map((p) => (s.P[p] && SIGILS[s.P[p].sig] ? s.P[p].sig : "lotus")); syncAvatars(s, V); if (opts.reset) for (const p of [0, 1]) avatarDo(p, s.phase === "over" ? (s.winner === p ? "win" : "lose") : "rest");
    const evs = (s.ev || []).filter((e) => e.id > R.lastEv); R.lastEv = s.evc || R.lastEv;
    const drops = new Set(evs.filter((e) => e.k === "summon").map((e) => e.i)), burned = new Set(evs.filter((e) => e.k === "destroy").map((e) => e.i));
    for (const e of evs) if (e.k !== "summon") { try { await animateEvent(e, null, s, V); } catch (err) { console.warn(err); } }
    try { sync(s, V, drops, burned, !!opts.reset); } catch (err) { console.warn(err); } // a drawing problem must never stall the queue the bot waits on
    if (drops.size) await sleepMs(reduce ? 200 : 1150); else if (burned.size) await sleepMs(reduce ? 100 : 600);
  }).catch((err) => console.warn(err));
  return R.queue;
}
