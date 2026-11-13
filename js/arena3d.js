// 3D duel arena (three.js r128 + GSAP) on a black-lacquer play mat drawn in code. Kenney particle textures are CC0.
import { card, resolveArt, colorHex, corsUrl, artImg, skinOf } from "./cards.js?v=20261113222034";
import { E } from "./engine.js?v=20261113222034";
import { h } from "./util.js?v=20261113222034";
import { Sfx } from "./sfx.js?v=20261113222034";
const THREE = window.THREE, gsap = window.gsap;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

let R = null; // runtime
let custom = {}; // the players' own mat picture, card sleeve and figure (see vault.js): set by the game view
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
  cheer: (p) => R && avatarDo(p, "hop"), // the sender's figure hops
  // an emote: the sender's figure acts it out (a figure with its own emote moves plays them; any other one hops) under a
  // small picture bubble
  emote: (p, k) => R && avatarEmote(p, k),
  setHover: (fn) => R && (R.onHover = fn), setClick: (fn) => R && (R.onClick = fn), setDrag: (fn) => R && (R.onDrag = fn),
  highlight, setLifeTarget, banner, flash, shake, popText, mood,
  // the players' own things (vault.js): how to find them, and a nudge when one has loaded or changed
  setCustom: (c) => { custom = c || {}; },
  customReady: (o) => { if (!R || !R.last) return; const k = R.matKey && R.matKey[1]; if (k && (k.near === o || k.far === o)) swapMat(); if (o.sleeve) syncBacks(R.last.s); },
  refreshCustom: () => { if (!R || !R.last) return; const { s, V } = R.last; applyMats(s, V); syncBacks(s); syncAvatars(s, V); },
  setQuiet: (v) => { quiet = !!v; },
  setScene: (k) => { if (R && SCENES[k]) { R.sceneKey = k; decor(); } },
  // a picture of the table as it is now (the cards in hand are not part of it): one frame drawn and copied at once
  // (drawn at twice the screen's size at least, so a phone's picture is sharp too)
  snapshot: () => { if (!R) return null; const pr = R.renderer.getPixelRatio(), want = Math.max(pr, 2);
    try { if (want !== pr) { R.renderer.setPixelRatio(want); R.resize(); } if (R.composer) R.composer.render(); else R.renderer.render(R.scene, R.camera);
      const src = R.canvas, c = document.createElement("canvas"); c.width = src.width; c.height = src.height; const g = c.getContext("2d"); g.fillStyle = "#0e0807"; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0); return c; }
    catch (e) { console.warn(e); return null; } finally { if (R && want !== pr) { R.renderer.setPixelRatio(pr); R.resize(); } } },
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
  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 200); // (a near plane this far keeps the depth fine enough across the table)
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  const tex = (u, srgb = true) => { const t = loader.load(u); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
  const FX = {}; ["magic_02", "slash_02", "circle_05", "smoke_03", "light_02", "star_06", "flare_01", "twirl_02"].forEach((n) => (FX[n] = tex("assets/fx/" + n + ".png")));
  R = { container, canvas, renderer, scene, camera, loader, FX, meshes: new Map(), dying: new Set(), texCache: new Map(), labels: new Map(), queue: Promise.resolve(), lastEv: 0, camBase: new THREE.Vector3(0, 11, 9.6), look: new THREE.Vector3(0, 0, 0.4), off: new THREE.Vector3(), alive: true, onHover: null, onClick: null, hovered: null, view: 0 };

  R.sceneKey = SCENES[opts.scene] ? opts.scene : "hall"; R.winfx = WINFX[opts.winfx] ? opts.winfx : "gold";
  R.hemi = new THREE.HemisphereLight(0xffe2c0, 0x140a06, 0.5); scene.add(R.hemi);
  const key = new THREE.DirectionalLight(0xffe2b0, 1.1); key.position.set(4, 12, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.2); rim.position.set(-6, 6, -10); scene.add(rim);
  R.goldL = new THREE.PointLight(0xffb84a, 0.8, 16, 2); R.goldL.position.set(0, 4.2, 3.6); scene.add(R.goldL);
  R.redL = new THREE.PointLight(0xff4a3a, 0.55, 16, 2); R.redL.position.set(0, 4.2, -4.4); scene.add(R.redL);

  // the play mat: black lacquer with gold-leaf line-work (ลายรดน้ำ), stepped corners (ย่อมุม) round every zone
  const small = innerWidth < 760; R.small = small; R.Q = Q; R.watch = !!opts.watch; /* a friend looking on: no "your turn", and the winner gets the banner */ R.matKey = [small || Q === "low", { near: MATS[opts.mat] || MATS.black, far: MATS[opts.farMat] || MATS[opts.mat] || MATS.black }]; R.zones = tallScreen(container) ? ZONES.tall : ZONES.wide; const mt = matTextures(...R.matKey, R.zones);
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
  R.pileMat = new THREE.MeshStandardMaterial({ color: 0xbdb2a0, roughness: 0.85, metalness: 0 }); // the edges of a stack of cards
  // the teak table the mat lies on, and candles in brass dishes round it, each throwing a flickering pool of light on the wood
  // unlit, with the lamplight baked into vertex colours: it covers much of a phone screen, so it must be cheap to draw
  const tg = new THREE.PlaneGeometry(70, 50, 28, 20), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
  for (let k = 0; k < tp.count; k++) { const x = tp.getX(k), y = tp.getY(k), d = Math.hypot(x / 1.25, y + 1.5); const v = 0.3 + 1.3 * Math.exp(-((Math.max(0, d - 6)) ** 2) / 80); tc[k * 3] = v; tc[k * 3 + 1] = v * 0.93; tc[k * 3 + 2] = v * 0.86; }
  tg.setAttribute("color", new THREE.BufferAttribute(tc, 3));
  const wood = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: woodTexture(small), vertexColors: true }));
  wood.rotation.x = -Math.PI / 2; wood.position.set(0, -0.335, -2); scene.add(wood); R.wood = wood; R.shade = shade;
  R.flameTex = flameTexture();
  // two candles at the far corners of the mat show at the top of a wide screen, two further back show on a phone
  R.candles = [[-4.2, -8.2], [4.2, -8.2], [-8.7, -5.4], [8.7, -5.4]].map(([x, z]) => candle(x, z));
  // made in Blender (tools/env): a seamless teak top with the candlelight baked into a light map, brass candlesticks, a jasmine garland,
  // a water bowl, and a dim hall that the gold and brass reflect. Each part swaps in when it has loaded; the drawn table stays as the fallback.
  const envUrl = (f) => `assets/env/${f}?v=${ENV_V}`;
  { let n = 0; const ok = () => { if (++n < 2 || !R) return;
      woodT.encoding = THREE.sRGBEncoding; woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(70 / 12, 50 / 12); woodT.anisotropy = 8; lightT.encoding = THREE.sRGBEncoding;
      tg.setAttribute("uv2", tg.attributes.uv); wood.material.dispose(); wood.material = new THREE.MeshBasicMaterial({ map: woodT, lightMap: lightT, lightMapIntensity: LIGHT_MAX }); R.shadeOff = true; shade.visible = false; };
    const woodT = loader.load(envUrl("wood.jpg"), ok), lightT = loader.load(envUrl("table-light.jpg"), ok); }
  if (THREE.GLTFLoader) new THREE.GLTFLoader().load(envUrl("props.glb"), (g) => {
    if (!R) return;
    g.scene.traverse((o) => { if (!o.isMesh) return; const m = o.material; if (/wax/.test(m.name)) { m.emissive = new THREE.Color(0x5a2c0a); m.emissiveIntensity = 0.55; } if (/brass/.test(m.name)) m.envMapIntensity = 1.6; });
    g.scene.name = "props"; scene.add(g.scene); for (const c of R.candles) c.onStand(); envProps(); hallShow();
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
    // the glow pass draws the scene into its own buffer first; by default that buffer has a 16-bit depth, too coarse to tell the
    // table top from the board under it: thin stripes all over the mat ("สวยสุด" on phones). A depth + stencil buffer is 24-bit.
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    R.composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: true }));
    R.composer.setPixelRatio(renderer.getPixelRatio()); R.composer.addPass(new THREE.RenderPass(scene, camera));
    R.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.9));
  }
  R.resize = (smooth) => {
    const w = container.clientWidth || innerWidth, hh = container.clientHeight || innerHeight; renderer.setSize(w, hh, false); camera.aspect = w / hh;
    const portrait = w / hh < 0.9; const k = portrait ? 1 : Math.min(1.45, Math.max(1, 820 / hh, 1250 / w));
    const Z = portrait ? ZONES.tall : ZONES.wide; if (Z !== R.zones) { R.zones = Z; swapMat(); decor(); if (R.last) update(R.last.s, R.last.V); } // turned the phone: the other table
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
    const objs = [...R.meshes.values()].map((m) => m.mesh); if (R.lifeT.visible) objs.push(R.lifeT); if (R.side) objs.push(...R.side.objs);
    const hit = ray.intersectObjects(objs)[0]; return hit ? (hit.object === R.lifeT ? "life" : hit.object.userData.i != null ? hit.object.userData.i : sidePick(hit.object)) : null;
  };
  canvas.addEventListener("pointermove", (e) => {
    const p = pick(e); if (p === R.hovered) return;
    const prev = R.meshes.get(R.hovered); if (prev && !prev.busy) { if (!prev.sel) gsap.to(prev.grp.position, { y: prev.restY, duration: 0.2 }); gsap.to(prev.grp.rotation, { x: 0, duration: 0.25 }); }
    R.hovered = p; canvas.style.cursor = p != null ? "pointer" : "default";
    // picked up: the card lifts, tips toward you and the light runs across its laminate
    const m = R.meshes.get(p); if (m && !m.busy) { gsap.to(m.grp.position, { y: m.restY + 0.32, duration: 0.2 }); gsap.to(m.grp.rotation, { x: 0.22, duration: 0.25, ease: "power2.out" }); sweep(m, 0.75, 0.6); }
    if (R.onHover) R.onHover(p != null && p !== "life" && typeof p !== "string" ? p : null);
  });
  // a press on a card, a move and a release somewhere else is a drag (the attack gesture, as in other card games); the
  // click the browser sends after it is not a second pick. The table takes touch drags itself (no page pan or zoom on it)
  canvas.style.touchAction = "none"; let down = null;
  canvas.addEventListener("pointerdown", (e) => { if (e.button) return; down = { p: pick(e), x: e.clientX, y: e.clientY, moved: false }; if (down.p != null) try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ } if (R.onDrag) R.onDrag("start", down.p, e); });
  canvas.addEventListener("pointermove", (e) => { if (!down) return; if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) down.moved = true; if (down.moved && R.onDrag) R.onDrag("move", down.p, e); });
  canvas.addEventListener("pointerup", (e) => { const d = down; down = null; if (!d || !d.moved) return; R.noClick = performance.now(); if (R.onDrag) R.onDrag("drop", d.p, e, pick(e)); });
  canvas.addEventListener("pointercancel", () => { down = null; if (R.onDrag) R.onDrag("cancel"); });
  canvas.addEventListener("click", (e) => { if (R.noClick && performance.now() - R.noClick < 600) { R.noClick = 0; return; } const p = pick(e); if (R.onClick) R.onClick(p); }); // null: the empty table (closes what is open)
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
      if (R.sakura) stepSakura(R.sakura, dt, t);
      if (R.pond) R.pond.step(R.pond, dt, t);
      R.lifeT.rotation.y = t * 1.2; R.lifeT.position.y = 1 + Math.sin(t * 2) * 0.12; R.lifeHalo.position.copy(R.lifeT.position);
      for (const m of R.meshes.values()) {
        if (m.pulse) m.glow.material.opacity = 0.45 + Math.sin(t * 6) * 0.3;
        if (t > m.nextSweep && !m.busy) { sweep(m, 0.22 + m.u.uFoil.value * 0.35, 1.3); m.nextSweep = t + 7 + Math.random() * 10; } // now and then the lamps catch a card
      }
    }
    if (R.avatars) for (const a of R.avatars) { if (!a || a.loading) continue; a.mixer.update(dt * (R.speed || 1)); if (!a.acts.idle && !reduce) { a.bob.position.y = Math.max(0, Math.sin(t * 2.6 + a.ph)) * 0.025; a.bob.scale.y = 1 + Math.sin(t * 2.6 + a.ph) * 0.018; } }
    R.t = t; for (const m of R.meshes.values()) placeShadow(m); for (const m of R.dying) placeShadow(m);
    camera.position.set(R.camBase.x + Math.sin(t * 0.15) * 0.35 + R.off.x, R.camBase.y + R.off.y, R.camBase.z + Math.cos(t * 0.12) * 0.2); camera.lookAt(R.look);
    if (R.side) for (const o of R.side.piles.values()) { if (!o.grp.visible && !o.n) { o.el.style.display = "none"; continue; } o.el.style.display = ""; const lz = (R.zones && R.zones.side && R.zones.side.piles.lz) || 0.62; const sp = toScreen(o.grp.position.clone().add(new THREE.Vector3(0, 0.2, (o.mine ? lz : -lz)))); o.el.style.left = sp.x + "px"; o.el.style.top = sp.y + "px"; }
    for (const [i, el] of R.labels) { const m = R.meshes.get(i); if (!m) continue; const s = toScreen(m.grp.position.clone().add(new THREE.Vector3(-0.55 * m.scale, 0.1, (m.side === "me" ? 0.85 : -0.85) * m.scale))); el.style.left = s.x + "px"; el.style.top = s.y + "px"; }
    if (R.composer) R.composer.render(); else renderer.render(scene, camera);
    if (R.autoQ) watchFps(R.autoQ);
    requestAnimationFrame(tick);
  };
  tick(); decor();
  R.speed = animSetting(); gsap.globalTimeline.timeScale(R.speed); // "fast animations" in Settings speed up every move and pause on the table
  gsap.from(R.camBase, { y: 22, z: 18, duration: reduce ? 0 : 2, ease: "power3.out" });
  gsap.from(R.matMat, { emissiveIntensity: 0, duration: reduce ? 0 : 1.8, ease: "power2.out" }); // the gold leaf catches the light once
}
function unmount() {
  document.querySelectorAll(".fxcuts,.rpsduel").forEach((x) => x.remove());
  if (!R) return; R.alive = false; removeEventListener("resize", R.onResize); if (R.onVis) document.removeEventListener("visibilitychange", R.onVis); gsap.globalTimeline.timeScale(1);
  for (const el of R.labels.values()) el.remove(); if (R.side) for (const o of R.side.piles.values()) o.el.remove();
  R.renderer.dispose(); R.canvas.remove(); R = null;
}

// ---------- 3D avatars: a small figure for each player who has chosen one, at the left end of the centre band ----------
// Original designs made in Blender (tools/avatars). A model with idle / hit / win / lose clips plays them; one without gets the same moves from code.
export const AVATARS = { chang: { name: "ช้างน้อย", file: "chang.glb", h: 1.25 }, naga: { name: "ลูกพญานาค", file: "naga.glb", h: 1.3 }, maew: { name: "แมววิเชียรมาศ", file: "maew.glb", h: 1.2 }, suea: { name: "เสือน้อย", file: "suea.glb", h: 1.25 }, kai: { name: "ไก่ชนน้อย", file: "kai.glb", h: 1.2 } };
// lacquer colours for the mat (the gold line-work stays); the edge colour washes in on the opponent's side
export const MATS = { black: { name: "รักดำ", lac: "#120b09", edge: "rgba(150,34,24," }, red: { name: "รักแดง", lac: "#3a0d09", edge: "rgba(190,60,30," },
  navy: { name: "กรมท่า", lac: "#0b1324", edge: "rgba(60,90,170," }, jade: { name: "เขียวหยก", lac: "#0a1c15", edge: "rgba(40,140,100," }, violet: { name: "ม่วงไพลิน", lac: "#190e22", edge: "rgba(130,70,170," }, gold: { name: "ทองคำเปลว", lac: "#21160a", edge: "rgba(214,166,64," }, indigo: { name: "ครามจันทร์", lac: "#0f1030", edge: "rgba(110,110,210," },
  // ซากุระราตรี: night-lacquer with sakura painted in the corners (maki-e style) — and sakura trees by the table, petals drifting over it
  sakura: { name: "ซากุระราตรี", lac: "#160d22", edge: "rgba(236,140,178,", kind: "sakura" },
  // drawn by hand (kind "sketch"): the zones are marker lines on a flattened box, or pen lines on a ruled page — no lacquer, no gold
  box: { name: "ลังกระดาษ", lac: "#6b4b28", edge: "rgba(60,40,20,", kind: "sketch", paper: "box", ink: "#f4efe2", pens: { hell: "#ff8a70", deck: "#9be8da", dark: "#dcc2ff" } },
  note: { name: "สมุดเส้น", lac: "#dcddd6", edge: "rgba(120,130,150,", kind: "sketch", paper: "note", ink: "#1b1c24", pens: { hell: "#c23a2c", deck: "#2b4fa8", dark: "#6b3fa3" } } };
// what fills the air over the table when you win (seen on your own screen; earned by playing, see achieve.js)
export const WINFX = { gold: { name: "ทองคำเปลวโปรย" }, lotus: { name: "กลีบบัวโปรย" }, lantern: { name: "โคมลอย" }, fireworks: { name: "พลุฉลอง" } };
// the scene (สนาม, the map) round the table — not the cloth on it (ผ้าปู, the playmat above). Each viewer sees the one they chose.
export const SCENES = { hall: { name: "โถงไม้แสงเทียน" }, pond: { name: "สวนสระบัว" }, market: { name: "ตลาดน้ำยามค่ำ" }, hell: { name: "นรกภูมิ" }, forest: { name: "ป่าหิมพานต์" }, deep: { name: "เมืองบาดาล" }, sakura: { name: "ซากุระราตรี" },
  azure: { name: "ลานเปลวคราม", owner: true } }; // owner: the owner's own (achieve.js opens it to him alone)
// a scene that brings its own ground: how to build it, and the air round it (fog colour and thickness, sky and ground light, how strong)
const GROUND = { pond: { build: () => buildPond(), air: [0x0f2a26, 0.019, 0xf2f6ff, 0x1c3320, 0.62] }, market: { build: () => buildMarket(), air: [0x04080f, 0.015, 0xaab8ff, 0x0a0a14, 0.4] },
  hell: { build: () => buildHell(), air: [0x140403, 0.02, 0xffa070, 0x2a0805, 0.5], noMotes: true },
  forest: { build: () => buildForest(), air: [0x0b1f1a, 0.02, 0xbfe8d8, 0x10241a, 0.5], noMotes: true },
  deep: { build: () => buildDeep(), air: [0x062636, 0.022, 0x9fdcff, 0x062030, 0.55], noMotes: true }, azure: { build: () => buildAzure(), air: [0x030818, 0.017, 0x9fc4ff, 0x060a1c, 0.46], noMotes: true } };
const avCache = new Map();
const loadAvatar = (key, f) => {
  if (f) { if (!avCache.has(f.key)) avCache.set(f.key, f.url.then((u) => (u && THREE.GLTFLoader ? new Promise((res) => new THREE.GLTFLoader().load(u, res, undefined, () => res(null))) : null))); return avCache.get(f.key); }
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
    const f = s.P[p] && s.P[p].av3 === "own" && custom.fig ? custom.fig(s.P[p]) : null; // the owner's own figure: on his own screen only
    const key = f ? f.key + ":" + f.finish : (s.P[p] && AVATARS[s.P[p].av3]) ? s.P[p].av3 : ""; const cur = R.avatars[p];
    if (cur && cur.key === key) { if (cur.grp && cur.mine !== (p === V)) placeAvatar(cur, p === V); continue; }
    if (cur && cur.grp) R.scene.remove(cur.grp);
    R.avatars[p] = null; if (!key) continue;
    const slot = { key, loading: true, own: f }; R.avatars[p] = slot;
    loadAvatar(key, f).then((g) => { if (R && R.avatars && R.avatars[p] === slot && g) buildAvatar(slot, g, p === V); });
  }
}
function placeAvatar(a, mine) { const sp = avSpot(mine); a.mine = mine; a.grp.position.set(sp.x, 0, sp.z); a.grp.rotation.y = sp.ry; }
function buildAvatar(slot, g, mine) {
  const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
  model.traverse((o) => { if (!o.isMesh) return; o.material = o.material.clone(); o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; }); // a raised arm can reach past the bounds of the pose it was made in
  if (slot.own) dressFigure(model, slot.own.finish);
  model.traverse((o) => { if (o.isMesh && R.env && R.Q !== "high" && o.material.metalness > 0.5) o.material.envMap = R.env; });
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), k = (((slot.own ? slot.own.h : (AVATARS[slot.key] || {}).h) || 1.25) * (R.small ? 0.82 : 1)) / Math.max(0.01, size.y);
  model.scale.setScalar(k); model.position.set((-(box.min.x + box.max.x) / 2) * k, -box.min.y * k, (-(box.min.z + box.max.z) / 2) * k);
  // layers: grp places it, bob breathes for a model without an idle clip, spin takes the moves made in code, the model plays its own clips
  const spin = new THREE.Group(), bob = new THREE.Group(), grp = new THREE.Group(); spin.add(model); bob.add(spin); grp.add(bob);
  if (slot.own) { const b = figureBase(); b.scale.setScalar(R.small ? 0.82 : 1); grp.add(b); model.position.y += 0.07 * (R.small ? 0.82 : 1); } // the owner's figure stands on a lacquer base
  // its clips: idle (looping), hit / win / lose, and emote moves named emo_<emote> (each played once)
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const c of g.animations || []) { const n = c.name.toLowerCase(); if (/^emo_\w+$/.test(n)) { acts[n] = mixer.clipAction(c); continue; } for (const w of ["idle", "hit", "win", "lose"]) if (n.includes(w) && !acts[w]) acts[w] = mixer.clipAction(c); }
  for (const w of onceActs(acts)) { acts[w].setLoop(THREE.LoopOnce, 1); acts[w].clampWhenFinished = true; }
  if (acts.idle) acts.idle.play();
  // a move that has ended hands back to idle; one that ended a lost game stays slumped, and an emote made after it goes back to slumping
  mixer.addEventListener("finished", (e) => { if (e.action === acts.lose) return; e.action.fadeOut(0.25); if (onceActs(acts).some((w) => acts[w] !== e.action && acts[w].isRunning())) return; // a newer move is already playing
    const back = slot.mood === "lose" && acts.lose ? acts.lose : acts.idle; if (back) back.reset().fadeIn(0.25).play(); });
  Object.assign(slot, { loading: false, grp, bob, spin, model, mixer, acts, ph: Math.random() * 6, top: (model.position.y + size.y * k) }); placeAvatar(slot, mine);
  R.scene.add(grp); if (!reduce) gsap.from(spin.position, { y: 1.4, duration: 0.6, ease: "bounce.out" });
}
// what a player's avatar does: hop (their turn starts), hit (they lose a LIFE), win, lose, rest (back to standing)
const onceActs = (acts) => Object.keys(acts).filter((w) => w !== "idle");
function avatarDo(p, what) {
  const a = R.avatars && R.avatars[p]; if (!a || a.loading) return;
  const s = a.spin; gsap.killTweensOf([s.position, s.scale, s.rotation]);
  if (what === "rest") { a.mood = ""; s.position.set(0, 0, 0); s.scale.set(1, 1, 1); s.rotation.set(0, 0, 0); for (const w of onceActs(a.acts)) a.acts[w].stop(); if (a.acts.idle) a.acts.idle.reset().setEffectiveWeight(1).play(); return; }
  if (what === "hop") { if (!reduce) gsap.timeline().to(s.position, { y: 0.16, duration: 0.14, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.2, ease: "bounce.out" }); return; }
  if (what === "hit") flashAvatar(a);
  if (what === "win" || what === "lose") a.mood = what;
  const act = a.acts[what];
  if (act) { if (a.acts.idle) a.acts.idle.fadeOut(0.08); for (const w of onceActs(a.acts)) if (w !== what) a.acts[w].stop(); act.reset().setEffectiveWeight(1).fadeIn(0.06).play(); return; }
  if (reduce) return;
  if (what === "hit") gsap.timeline().to(s.scale, { x: 1.16, y: 0.8, z: 1.16, duration: 0.07 }).to(s.scale, { x: 0.95, y: 1.08, z: 0.95, duration: 0.14 }).to(s.scale, { x: 1, y: 1, z: 1, duration: 0.22 }).fromTo(s.rotation, { x: -0.3 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.35)" }, 0);
  if (what === "win") gsap.timeline().to(s.position, { y: 0.32, duration: 0.18, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.18, ease: "power2.in" }).to(s.position, { y: 0.2, duration: 0.16, ease: "power2.out" }).to(s.position, { y: 0, duration: 0.16, ease: "power2.in" }).to(s.rotation, { y: Math.PI * 2, duration: 0.5, ease: "power2.inOut" }, 0).set(s.rotation, { y: 0 });
  if (what === "lose") gsap.timeline().to(s.scale, { y: 0.88, x: 1.04, z: 1.04, duration: 0.6, ease: "power2.out" }).to(s.rotation, { x: 0.22, duration: 0.6, ease: "power2.out" }, 0);
}
// a red flush over the whole figure when it is hit
function flashAvatar(a) {
  a.model.traverse((o) => { if (!o.isMesh || !o.material.emissive) return; const m = o.material; gsap.killTweensOf(m.emissive); m.emissive.setRGB(0.9, 0.08, 0.05); gsap.to(m.emissive, { r: 0, g: 0, b: 0, duration: 0.45, ease: "power2.out" }); });
}
// an emote acted out by the sender's figure: its own move for that emote if the model has one (emo_<emote>), else a hop
function avatarEmote(p, k) {
  const a = R.avatars && R.avatars[p]; if (!a || a.loading) return;
  emoteBubble(a, k);
  const act = a.acts["emo_" + k]; if (!act) return avatarDo(p, "hop");
  const s = a.spin; gsap.killTweensOf([s.position, s.scale, s.rotation]); s.position.set(0, 0, 0); s.scale.set(1, 1, 1); s.rotation.set(0, 0, 0);
  for (const w of onceActs(a.acts)) if (a.acts[w] !== act && a.acts[w].isScheduled()) a.acts[w].fadeOut(0.15);
  if (a.acts.idle) a.acts.idle.fadeOut(0.15);
  act.reset().setEffectiveWeight(1).fadeIn(0.15).play();
}
// a small picture over the figure's head for a moment: what the emote says, drawn as a manga sign in a speech bubble
const bubbleTex = new Map();
function emoteBubble(a, k) {
  if (!bubbleTex.has(k)) { const t = new THREE.CanvasTexture(drawBubble(k)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; bubbleTex.set(k, t); }
  if (a.bubble) { gsap.killTweensOf([a.bubble.scale, a.bubble.position, a.bubble.material]); a.grp.remove(a.bubble); a.bubble.material.dispose(); }
  const m = new THREE.SpriteMaterial({ map: bubbleTex.get(k), transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  // it floats up and to the left of the head with its tail reaching in (straight above, it would cover the other player's
  // figure, which stands just beyond on screen)
  const sp = new THREE.Sprite(m), sz = R.small ? 0.66 : 0.76, y = (a.top || 1.3) - 0.12; a.bubble = sp;
  const at = new THREE.Vector3(-0.3, y, 0.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a.grp.rotation.y); // the offset is along the table, not the figure's turn
  sp.center.set(0.9, 0); sp.renderOrder = 20; sp.position.copy(at); sp.scale.set(reduce ? sz : 0.001, reduce ? sz : 0.001, 1); a.grp.add(sp);
  const gone = () => { if (a.bubble !== sp) return; a.grp.remove(sp); m.dispose(); a.bubble = null; };
  if (reduce) { setTimeout(gone, 2600); return; }
  gsap.timeline({ onComplete: gone }).to(sp.scale, { x: sz, y: sz, duration: 0.35, ease: "back.out(2.4)" }).to(sp.position, { y: at.y + 0.14, duration: 2.2, ease: "sine.out" }, 0).to(m, { opacity: 0, duration: 0.45 }, 2.15);
}
function drawBubble(k) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), X = 128, Y = 108, INK = "#3a2414";
  g.lineJoin = g.lineCap = "round";
  // the bubble: a round cream card with a short tail down to the figure
  g.beginPath(); g.arc(X, Y, 94, Math.PI * 0.42, Math.PI * 2.18); g.quadraticCurveTo(X + 84, 196, 232, 250); g.quadraticCurveTo(X + 52, 220, X + 29, 197); g.closePath();
  g.fillStyle = "#f6ecd8"; g.fill(); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(X, Y, 80, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = "rgba(196,150,70,.55)"; g.stroke(); // a thin gold ring inside
  const shape = (fill, line = INK, w = 7) => { g.fillStyle = fill; g.fill(); g.lineWidth = w; g.strokeStyle = line; g.stroke(); };
  const word = (t, size, fill, y = Y + size * 0.36, x = X) => { g.font = `900 ${size}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`; g.textAlign = "center"; g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
  const star4 = (x, y, r, fill) => { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.closePath(); shape(fill, INK, 5); };
  const heart = (x, y, s, fill) => { g.beginPath(); g.moveTo(x, y + s * 0.3); g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s); g.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3); g.closePath(); shape(fill); };
  const drop = (x, y, s, fill) => { g.beginPath(); g.moveTo(x, y - s); g.bezierCurveTo(x + s * 0.25, y - s * 0.45, x + s * 0.6, y - s * 0.1, x + s * 0.6, y + s * 0.25); g.arc(x, y + s * 0.25, s * 0.6, 0, Math.PI); g.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.25, y - s * 0.45, x, y - s); g.closePath(); shape(fill, "#1d4f8a", 6);
    g.beginPath(); g.ellipse(x - s * 0.2, y + s * 0.1, s * 0.12, s * 0.22, 0.4, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.85)"; g.fill(); };
  const lines = (pts, col, w = 7) => { g.strokeStyle = col; g.lineWidth = w; for (const [x0, y0, x1, y1] of pts) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } };
  if (k === "hi") { word("Hi!", 86, "#f08a24"); g.lineWidth = 6; g.strokeStyle = "#f08a24"; for (const s of [-1, 1]) for (const r of [74, 86]) { g.beginPath(); g.arc(X, Y - 4, r, s < 0 ? Math.PI * 0.9 : -Math.PI * 0.1, s < 0 ? Math.PI * 1.1 : Math.PI * 0.1); g.stroke(); } }
  else if (k === "glhf") { star4(X - 8, Y + 4, 52, "#f5c33b"); star4(X + 46, Y - 40, 22, "#ffe08a"); star4(X - 52, Y + 42, 16, "#ffe08a"); }
  else if (k === "wow") { lines([[X - 62, Y - 46, X - 44, Y - 30], [X + 62, Y - 46, X + 44, Y - 30], [X - 70, Y + 8, X - 50, Y + 8], [X + 70, Y + 8, X + 50, Y + 8]], "#f08a24", 8);
    g.beginPath(); g.moveTo(X - 15, Y - 66); g.lineTo(X + 15, Y - 66); g.lineTo(X + 9, Y + 22); g.lineTo(X - 9, Y + 22); g.closePath(); shape("#e5482f"); g.beginPath(); g.arc(X, Y + 50, 14, 0, Math.PI * 2); shape("#e5482f"); }
  else if (k === "gg") { word("GG", 92, "#3f9fe8", Y + 30); star4(X + 62, Y - 46, 15, "#ffe08a"); star4(X - 64, Y + 44, 12, "#ffe08a"); }
  else if (k === "ggwp") { word("GG", 78, "#f5c33b", Y + 6); word("WP", 44, "#3f9fe8", Y + 58); }
  else if (k === "oops") { drop(X + 18, Y - 2, 52, "#79c6f5"); lines([[X - 64, Y - 30, X - 42, Y - 20], [X - 68, Y + 2, X - 44, Y + 2], [X - 64, Y + 34, X - 42, Y + 24]], "#1d4f8a", 7); }
  else if (k === "think") { word("?", 124, "#8a63d2", Y + 44, X - 8); for (const [i, r] of [[0, 9], [1, 7], [2, 5]]) { g.beginPath(); g.arc(X + 46 + i * 16, Y + 40 - i * 4, r, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); } }
  else if (k === "ty") { for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + (i * Math.PI * 2) / 5; g.beginPath(); g.ellipse(X + Math.cos(t) * 34, Y + Math.sin(t) * 34, 30, 21, t, 0, Math.PI * 2); shape("#f7a8c4", "#b4466e", 5); }
    g.beginPath(); g.arc(X, Y, 15, 0, Math.PI * 2); shape("#f6d24a", "#b4466e", 5); }
  else if (k === "angry") { g.strokeStyle = "#e23a2e"; g.lineWidth = 15; const w = 15, L = 56; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(X + sx * w, Y + sy * L); g.quadraticCurveTo(X + sx * w * 1.15, Y + sy * w * 1.15, X + sx * L, Y + sy * w); g.stroke(); } }
  else if (k === "cry") { drop(X - 30, Y - 6, 36, "#79c6f5"); drop(X + 32, Y + 22, 30, "#79c6f5"); lines([[X - 30, Y + 44, X - 30, Y + 60], [X + 32, Y + 66, X + 32, Y + 78]], "#3f9fe8", 6); }
  else if (k === "love") { heart(X - 10, Y - 46, 96, "#e8435a"); heart(X + 52, Y - 62, 40, "#ff8fab"); }
  else if (k === "pout") { const P = [[X - 30, Y + 12, 32], [X, Y - 12, 38], [X + 34, Y + 8, 32], [X + 4, Y + 26, 30]];
    for (const [x, y, r] of P) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = 14; g.strokeStyle = INK; g.stroke(); }
    for (const [x, y, r] of P) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = "#dfe5ec"; g.fill(); }
    lines([[X - 62, Y - 44, X - 46, Y - 30], [X + 66, Y - 40, X + 50, Y - 26]], "#8a96a6", 7); }
  else { for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(X + i * 34, Y, 12, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); } }
  return c;
}

// the owner's own figure (a print model has no colours of its own): a finish for the whole figure, and a round lacquer
// base with a gold rim for it to stand on
const FINISH = {
  porcelain: () => new THREE.MeshPhysicalMaterial({ color: 0xf2eee8, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xe2ad4a, roughness: 0.25, metalness: 1 }),
  slime: () => new THREE.MeshPhysicalMaterial({ color: 0x7cc6ff, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.88, emissive: 0x0f3f74, emissiveIntensity: 0.6 }),
  sakura: () => new THREE.MeshPhysicalMaterial({ color: 0xf6c0d3, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3, emissive: 0x3a0f1e, emissiveIntensity: 0.3 }),
};
export const FIG_FINISH = { porcelain: "พอร์ซเลนขาว", gold: "ทองคำ", slime: "สไลม์ใส", sakura: "ซากุระ", file: "สีจากไฟล์" };
function dressFigure(model, finish) {
  let plain = true; model.traverse((o) => { if (!o.isMesh) return; if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    if (o.material && (o.material.map || o.material.vertexColors || o.material.name || (o.geometry && o.geometry.attributes.color))) plain = false; });
  // "สีจากไฟล์" (or no choice yet) keeps the file's own colours; a print model has none: porcelain then
  const mk = FINISH[finish] || (plain ? FINISH.porcelain : null); if (!mk) return;
  const m = mk(), ms = mk(); ms.skinning = true; // a figure with bones needs a material that follows them
  model.traverse((o) => { if (o.isMesh) o.material = o.isSkinnedMesh ? ms : m; });
}
function figureBase() {
  const g = new THREE.Group(), disc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.07, 48), new THREE.MeshStandardMaterial({ color: 0x140c0a, roughness: 0.32, metalness: 0 }));
  disc.position.y = 0.035; disc.castShadow = disc.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: 0xd8a84a, emissive: 0x6a4a12, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.8 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.07; g.add(disc, rim); return g;
}

// ---------- the owner's figure up close (Settings): drag to turn it round, pinch or scroll to come closer, play its moves ----------
// Its own small renderer in the given box, gone (and its memory freed) once the box leaves the page.
export const FIG_MOVES = { idle: "ยืน", emo_hi: "สวัสดี", emo_glhf: "ขอให้สนุก", emo_wow: "ว้าว!", emo_gg: "เก่งมาก", emo_oops: "อุ๊ย", emo_think: "ขอคิดแป๊บ", emo_ty: "ขอบคุณ", emo_ggwp: "GG เกมดี",
  emo_love: "ชอบมาก", emo_angry: "ไม่ยอมนะ", emo_pout: "งอน", emo_cry: "ฮือ…", hit: "โดนโจมตี", win: "ชนะ", lose: "แพ้" };
export function figureViewer(box, url, finish) {
  const canvas = h("canvas", { class: "figview", "aria-label": "รูปปั้น 3 มิติ ลากเพื่อหมุน บีบหรือเลื่อนเพื่อซูม" }); box.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60), clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xfff1e2, 0x2a1a14, 0.85));
  const key = new THREE.DirectionalLight(0xffe4c4, 1.1); key.position.set(2.2, 3.4, 2.8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ccfff, 0.75); rim.position.set(-2.6, 2.2, -2.4); scene.add(rim); // a cool light from behind outlines the hair
  scene.add(figureBase());
  const v = { az: 0.45, el: 0.16, dist: 4.6, look: 0.74, to: { dist: 4.6, look: 0.74 }, acts: {}, mixer: null, top: 1.5, bubble: null };
  const fit = () => { const w = box.clientWidth || 300, hh = box.clientHeight || 360; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
  fit(); const ro = window.ResizeObserver ? new ResizeObserver(fit) : null; if (ro) ro.observe(box);
  // turning and zooming: one finger or the mouse turns it, two fingers or the wheel come closer
  const pts = new Map(); let pinch = 0;
  canvas.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { canvas.setPointerCapture(e.pointerId); } catch {} });
  canvas.addEventListener("pointermove", (e) => { const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { v.az -= (e.clientX - p.x) * 0.012; v.el = Math.max(-0.05, Math.min(0.75, v.el + (e.clientY - p.y) * 0.006)); }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zoomBy(pinch / d); pinch = d; } });
  for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, (e) => { pts.delete(e.pointerId); pinch = 0; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoomBy(1 + e.deltaY * 0.0012); }, { passive: false });
  // closer means looking a little higher too, at the face and the hands
  const lookAt = (d) => 0.74 + 0.42 * Math.max(0, Math.min(1, (4.6 - d) / (4.6 - 1.9)));
  function zoomBy(k) { const d = Math.max(1.3, Math.min(6.5, v.to.dist * k)); v.to.dist = d; v.to.look = lookAt(d); }
  let model = null;
  const ready = new Promise((res) => {
    if (!THREE.GLTFLoader) return res(false);
    new THREE.GLTFLoader().load(url, (g) => {
      if (!box.isConnected) return res(false);
      model = g.scene; model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); dressFigure(model, finish);
      const bx = new THREE.Box3().setFromObject(model), size = bx.getSize(new THREE.Vector3()), k = 1.4 / Math.max(0.01, size.y);
      model.scale.setScalar(k); model.position.set((-(bx.min.x + bx.max.x) / 2) * k, -bx.min.y * k + 0.07, (-(bx.min.z + bx.max.z) / 2) * k); scene.add(model); v.top = 0.07 + size.y * k;
      const mixer = new THREE.AnimationMixer(model); v.mixer = mixer;
      for (const c of g.animations || []) { const n = c.name.toLowerCase(); if (FIG_MOVES[n] && !v.acts[n]) v.acts[n] = mixer.clipAction(c); }
      for (const w of onceActs(v.acts)) { v.acts[w].setLoop(THREE.LoopOnce, 1); v.acts[w].clampWhenFinished = true; }
      if (v.acts.idle) v.acts.idle.play();
      mixer.addEventListener("finished", (e) => { e.action.fadeOut(0.3); if (v.acts.idle && !onceActs(v.acts).some((w) => v.acts[w] !== e.action && v.acts[w].isRunning())) v.acts.idle.reset().fadeIn(0.3).play(); });
      res(true);
    }, undefined, () => res(false));
  });
  const tick = () => {
    if (!box.isConnected) { stop(); return; }
    const dt = Math.min(0.05, clock.getDelta());
    v.dist += (v.to.dist - v.dist) * Math.min(1, dt * 8); v.look += (v.to.look - v.look) * Math.min(1, dt * 8);
    if (v.mixer) v.mixer.update(dt);
    cam.position.set(Math.sin(v.az) * Math.cos(v.el) * v.dist, v.look + Math.sin(v.el) * v.dist, Math.cos(v.az) * Math.cos(v.el) * v.dist); cam.lookAt(0, v.look, 0);
    renderer.render(scene, cam); if (v.bubble) placeBubble(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // the bubble's tail at the side of the head (the head bone when the model has one), the bubble kept within the stage
  const headAt = new THREE.Vector3();
  function placeBubble() {
    const el = v.bubble, hb = model && model.getObjectByName("head"); if (!el) return;
    if (hb) { hb.getWorldPosition(headAt); headAt.y += 0.12; } else headAt.set(0, v.top - 0.1, 0);
    headAt.x -= Math.cos(v.az) * 0.26; headAt.z += Math.sin(v.az) * 0.26; // a little to the left of the head as the camera sees it
    const p = headAt.project(cam), w = box.clientWidth, hh = box.clientHeight, bw = el.offsetWidth || 90, bh = el.offsetHeight || 90;
    const x = (p.x + 1) / 2 * w - bw * 0.95 - 8, y = (1 - p.y) / 2 * hh - bh;
    el.style.left = Math.max(6, Math.min(w - bw - 6, x)) + "px"; el.style.top = Math.max(6, Math.min(hh - bh - 6, y)) + "px";
  }
  function stop() {
    if (ro) ro.disconnect();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? [].concat(o.material) : []; for (const m of ms) { if (m.map && ![...bubbleTex.values()].includes(m.map)) m.map.dispose(); m.dispose(); } });
    renderer.dispose();
  }
  return {
    ready, moves: () => Object.keys(FIG_MOVES).filter((k) => v.acts[k]),
    // a move: the others fade out, it plays once and the figure goes back to standing; an emote shows its bubble too
    play(name) { const act = v.acts[name]; if (!act) return;
      for (const w of Object.keys(v.acts)) if (v.acts[w] !== act && v.acts[w].isScheduled()) v.acts[w].fadeOut(0.2);
      if (name === "idle") { act.reset().fadeIn(0.2).play(); return; }
      act.reset().setEffectiveWeight(1).fadeIn(0.2).play();
      // an emote's bubble: drawn over the stage beside the head, kept inside the frame however close the camera is
      if (name.startsWith("emo_")) { if (v.bubble) v.bubble.remove(); const el = drawBubble(name.slice(4)); el.className = "figbubble"; box.append(el); v.bubble = el; placeBubble();
        const gone = () => { el.remove(); if (v.bubble === el) v.bubble = null; };
        if (reduce) setTimeout(gone, 2400); else gsap.timeline({ onComplete: gone }).fromTo(el, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.4)" }).to(el, { opacity: 0, duration: 0.4 }, 2.1); } },
    view(which) { v.to.dist = which === "close" ? 2.05 : 4.6; v.to.look = lookAt(v.to.dist); }, // close: the head and the raised hand
  };
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
// a player's own picture lies on their half as a cloth playmat would: inside the table's gilded border and clear of the
// centre band, its corners rounded, its edge bound and stitched; the zones' gold line-work is printed over it
const PM = { x: 7.2, z0: 0.42, z1: 0.46, r: 0.3, bind: 0.075 }; // half its width; gap to the centre line; gap to the near edge; corner; binding
export const MAT_ASPECT = (2 * PM.x) / (MD / 2 - PM.z0 - PM.z1); // the shape of the picture (width : depth)
// where the zones sit on the mat. "wide" is the table for screens held sideways; "tall" is for phones held upright,
// where the screen is too narrow for the wide table: the Land Magic Zone moves in from the left edge to the middle
// band, the Construct and Magic Zones close in, and five or six Avatars stand closer together, so every card fits
// on the screen and can be tapped
const ZONES = {
  wide: { avGap: (n) => (n > 4 ? Math.min(2.05, 9.2 / (n - 1)) : 2.05) /* five or six Avatars close up a little */, cs: [-5.8, -1.8], mg: [-1.2, 5.8], csX: (k) => -5.1 + k * 1.3, csS: 0.68, mgX: (k) => 5.1 - k * 1.15, mgS: 0.6,
    // the Land Magic Zone sits in the middle of the table, between the two sides (it is shared: one Land for both players)
    land: { x0: -1.25, x1: 1.25, dz: 0.92, x: 0, s: 0.72, s2: 0.6, dx2: 0.7, lx: 1.42, lz: MZ, align: "left", center: true }, band: [-4.35, 4.35],
    // each player's own left: LIFE laid sideways down the side like a damage zone; their right: Deck, hell and the dark zone
    side: { life: { x: -6.3, z0: 0.5, dz: 0.6, s: 0.46 }, piles: { x: 6.3, s: 0.46, deck: 2.85, hell: 1.7, dark: 0.55 } },
    fit: [[-6.95, -5.2], [6.95, -5.2], [-6.95, 4.9], [6.95, 4.9]] }, // the outer cards of a full table
  tall: { avGap: (n) => (n > 4 ? Math.min(2.05, 8.1 / (n - 1)) : 2.05), cs: [-4.35, -1.15], mg: [-0.75, 4.35], csX: (k) => -3.75 + k * 1.0, csS: 0.6, mgX: (k) => 3.8 - k * 0.92, mgS: 0.55,
    land: { x0: -4.45, x1: -2.85, dz: 1.08, x: -3.65, s: 0.62, s2: 0.5, dz2: 0.55, lx: -2.65, lz: MZ - 0.62, align: "left" }, band: [-2.45, 2.15],
    // an upright phone: the Deck, the hell and the dark zone of both players at the right end of the middle band (ours on our half, theirs on
    // theirs, the same side for both); LIFE stays in the bars at the top and the bottom
    side: { piles: { s: 0.44, same: true, short: true, lz: 0.56, pos: { deck: [4.5, MZ + 0.6], hell: [3.67, MZ + 0.6], dark: [2.84, MZ + 0.6] } } },
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
// ประจำยาม: a four-petalled flower seen from above, the knot that sits on Thai bands and door panels. Its grammar: four plump
// petals that swell from the heart and close to a point (not thin rays: thin rays read as a sparkle), a vein cut through each,
// small pointed sepals on the diagonals between them, and a round heart (เกสร) with a ring cut round it.
// ground: the colour the cuts are made in (the lacquer under the gold); without it the flower is drawn solid.
function prajamyam(g, cx, cy, r, ground) {
  const leaf = (a, d0, d1, w) => { const L = d1 - d0, P = (d, s) => [cx + Math.cos(a) * d - Math.sin(a) * s, cy + Math.sin(a) * d + Math.cos(a) * s];
    g.beginPath(); g.moveTo(...P(d0, 0)); g.bezierCurveTo(...P(d0 + L * 0.16, w * 1.2), ...P(d0 + L * 0.64, w * 0.92), ...P(d1, 0)); g.bezierCurveTo(...P(d0 + L * 0.64, -w * 0.92), ...P(d0 + L * 0.16, -w * 1.2), ...P(d0, 0)); g.fill(); };
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 - Math.PI / 2; leaf(a, r * 0.06, r, r * 0.4); leaf(a + Math.PI / 4, r * 0.12, r * 0.62, r * 0.11); }
  g.beginPath(); g.arc(cx, cy, r * 0.24, 0, 7); g.fill();
  if (ground) { const f = g.fillStyle; g.fillStyle = ground; for (let k = 0; k < 4; k++) leaf((k * Math.PI) / 2 - Math.PI / 2, r * 0.36, r * 0.8, r * 0.085);
    g.beginPath(); g.arc(cx, cy, r * 0.15, 0, 7); g.fill(); g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r * 0.085, 0, 7); g.fill(); }
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
// ---------- ซากุระราตรี: sakura painted in maki-e over one side of the mat ----------
// near: our side (the bottom of the canvas); the far side gets the same picture turned round, for the player who sits there.
// Branches taper and bend, the thin ones carry blossoms (five notched petals, deep pink at the heart, stamens) and buds,
// and loose petals lie scattered over the side. A fixed seed: the picture is the same every time the mat is drawn.
function paintSakura(g, X, Y, U, near, small) {
  let seed = near ? 7 : 19; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = (x, z) => (near ? [X(x), Y(z)] : [X(-x), Y(2 * MZ - z)]);
  const flowers = [];
  const branch = (x, z, ang, len, w, depth) => {
    const x1 = x + Math.cos(ang) * len, z1 = z + Math.sin(ang) * len, bend = (rnd() - 0.5) * len * 0.45;
    const nx = -Math.sin(ang), nz = Math.cos(ang), mx = (x + x1) / 2 + nx * bend, mz = (z + z1) / 2 + nz * bend, w1 = w * 0.64, wm = (w + w1) / 4;
    g.beginPath(); g.moveTo(...P(x + (nx * w) / 2, z + (nz * w) / 2)); g.quadraticCurveTo(...P(mx + nx * wm, mz + nz * wm), ...P(x1 + (nx * w1) / 2, z1 + (nz * w1) / 2));
    g.lineTo(...P(x1 - (nx * w1) / 2, z1 - (nz * w1) / 2)); g.quadraticCurveTo(...P(mx - nx * wm, mz - nz * wm), ...P(x - (nx * w) / 2, z - (nz * w) / 2)); g.closePath();
    g.fillStyle = "rgba(40,18,24,.94)"; g.fill();
    g.strokeStyle = "rgba(216,168,74,.42)"; g.lineWidth = Math.max(1, U(w * 0.13)); g.beginPath(); g.moveTo(...P(x + (nx * w) / 2, z + (nz * w) / 2)); g.quadraticCurveTo(...P(mx + nx * wm, mz + nz * wm), ...P(x1 + (nx * w1) / 2, z1 + (nz * w1) / 2)); g.stroke();
    if (depth > 0) { const kids = depth > 2 ? 2 : 2 + (rnd() < 0.5 ? 1 : 0); for (let k = 0; k < kids; k++) branch(x1, z1, ang + (k - (kids - 1) / 2) * (0.55 + rnd() * 0.3) + (rnd() - 0.5) * 0.3, len * (0.6 + rnd() * 0.18), w1, depth - 1); }
    if (depth <= 2) { const n = depth === 0 ? 4 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) { const f = depth === 0 ? 0.75 + rnd() * 0.3 : 0.25 + rnd() * 0.65; flowers.push([x + (x1 - x) * f + (rnd() - 0.5) * 0.32, z + (z1 - z) * f + (rnd() - 0.5) * 0.32, 0.075 + rnd() * 0.06, rnd() * 6.28, rnd() < 0.18]); } }
  };
  branch(-7.55, 5.45, -0.6, 1.95, 0.3, 3); branch(7.6, 4.95, Math.PI + 0.45, 1.6, 0.26, 3); branch(-2.2, 5.62, -1.3, 0.85, 0.14, 2);
  for (const [fx, fz, r, rot, bud] of flowers) { const [cx, cy] = P(fx, fz), R0 = U(r);
    if (bud) { g.fillStyle = "rgba(214,84,126,.92)"; g.beginPath(); g.ellipse(cx, cy, R0 * 0.34, R0 * 0.56, rot, 0, 7); g.fill(); continue; }
    for (let k = 0; k < 5; k++) { g.save(); g.translate(cx, cy); g.rotate(rot + (k * Math.PI * 2) / 5);
      const pg = g.createLinearGradient(0, 0, 0, -R0); pg.addColorStop(0, "rgba(206,86,128,.86)"); pg.addColorStop(0.5, "rgba(236,166,192,.8)"); pg.addColorStop(1, "rgba(250,222,232,.78)"); g.fillStyle = pg;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(R0 * 0.56, -R0 * 0.24, R0 * 0.52, -R0 * 0.94, R0 * 0.13, -R0); g.lineTo(0, -R0 * 0.85); g.lineTo(-R0 * 0.13, -R0); g.bezierCurveTo(-R0 * 0.52, -R0 * 0.94, -R0 * 0.56, -R0 * 0.24, 0, 0); g.fill();
      g.strokeStyle = "rgba(216,168,74,.55)"; g.lineWidth = Math.max(0.6, R0 * 0.05); g.stroke(); g.restore(); }
    g.fillStyle = "rgba(190,48,92,.95)"; g.beginPath(); g.arc(cx, cy, R0 * 0.2, 0, 7); g.fill();
    g.fillStyle = "rgba(255,224,138,.95)"; for (let k = 0; k < 6; k++) { const a = rot + k * 1.05; g.beginPath(); g.arc(cx + Math.cos(a) * R0 * 0.3, cy + Math.sin(a) * R0 * 0.3, Math.max(0.6, R0 * 0.05), 0, 7); g.fill(); } }
  for (let k = 0; k < (small ? 18 : 32); k++) { const [cx, cy] = P(-7.1 + rnd() * 14.2, 0.1 + rnd() * 5.3), R0 = U(0.045 + rnd() * 0.04);
    g.save(); g.translate(cx, cy); g.rotate(rnd() * 6.28); g.fillStyle = `rgba(255,${192 + Math.floor(rnd() * 40)},${210 + Math.floor(rnd() * 30)},${(0.32 + rnd() * 0.36).toFixed(2)})`; g.beginPath(); g.ellipse(0, 0, R0 * 0.56, R0, 0, 0, 7); g.fill(); g.restore(); }
}
// ---------- ซากุระราตรี in 3D: cherry trees round the table, petals drifting over it ----------
// Built while either side's mat is the sakura mat. Each tree grows the same way every time (its own seed): a trunk that forks
// into limbs and twigs, every one a tube that bends and thins toward its end, with thousands of five-petalled flowers (one
// small card each, all drawn in one batch) along the twigs. Petals fall on a light breeze and tumble as they go; one that
// lands rests a moment and fades. The trees stand off the mat, beside and behind it, so they frame the table and never
// hide a card: x, z, turn, size, seed (a wide screen sees its sides, an upright phone sees past its far edge).
const SAKURA = { wide: [[-10.6, -2.6, 0.6, 1.0, 3], [10.9, -3.6, -0.7, 0.95, 5], [-6.4, -10.9, 0.3, 1.1, 7], [7.2, -11.6, -0.3, 1.05, 9]],
  tall: [[-5.1, -9.9, 0.4, 0.92, 3], [5.6, -10.6, -0.5, 0.9, 5]] };
function flowerTexture() {
  return canvasTex(128, (g, S) => { const C = S / 2, R0 = S * 0.47;
    for (let k = 0; k < 5; k++) { g.save(); g.translate(C, C); g.rotate((k * Math.PI * 2) / 5);
      const pg = g.createLinearGradient(0, 0, 0, -R0); pg.addColorStop(0, "#d9557f"); pg.addColorStop(0.3, "#f4a9c2"); pg.addColorStop(1, "#fff2f6"); g.fillStyle = pg;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(R0 * 0.62, -R0 * 0.2, R0 * 0.56, -R0 * 0.95, R0 * 0.14, -R0); g.lineTo(0, -R0 * 0.83); g.lineTo(-R0 * 0.14, -R0); g.bezierCurveTo(-R0 * 0.56, -R0 * 0.95, -R0 * 0.62, -R0 * 0.2, 0, 0); g.fill();
      g.strokeStyle = "rgba(190,60,100,.22)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -R0 * 0.18); g.lineTo(0, -R0 * 0.68); g.stroke(); g.restore(); }
    g.fillStyle = "#b8295a"; g.beginPath(); g.arc(C, C, R0 * 0.16, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,232,170,.9)"; g.fillStyle = "#ffdf86"; g.lineWidth = 1.2;
    for (let k = 0; k < 11; k++) { const a = k * 0.571 + 0.2, x = C + Math.cos(a) * R0 * 0.34, y = C + Math.sin(a) * R0 * 0.34; g.beginPath(); g.moveTo(C + Math.cos(a) * R0 * 0.1, C + Math.sin(a) * R0 * 0.1); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); } });
}
function petalTexture() {
  return canvasTex(64, (g, S) => { const pg = g.createLinearGradient(0, S, 0, 0); pg.addColorStop(0, "#df6890"); pg.addColorStop(0.4, "#f8bfd1"); pg.addColorStop(1, "#fff4f8"); g.fillStyle = pg;
    g.beginPath(); g.moveTo(S / 2, S * 0.97); g.bezierCurveTo(S * 0.99, S * 0.6, S * 0.9, S * 0.05, S * 0.61, S * 0.04); g.lineTo(S / 2, S * 0.18); g.lineTo(S * 0.39, S * 0.04); g.bezierCurveTo(S * 0.1, S * 0.05, S * 0.01, S * 0.6, S / 2, S * 0.97); g.fill(); });
}
// sakura bark: dark plum-brown with the pale bands (lenticels) that run round the trunk, and faint cracks along it
function barkTexture() {
  return canvasTex(128, (g, S) => { g.fillStyle = "#3a2327"; g.fillRect(0, 0, S, S);
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(16,8,10,${0.2 + rnd() * 0.25})`; g.lineWidth = 1 + rnd(); const x = rnd() * S; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 14, S / 3, x + (rnd() - 0.5) * 14, (2 * S) / 3, x, S); g.stroke(); }
    for (let k = 0; k < 150; k++) { const y = rnd() * S, x = rnd() * S, w = 5 + rnd() * 24, hh = 1 + rnd() * 1.8; g.fillStyle = rnd() < 0.62 ? `rgba(150,110,100,${0.25 + rnd() * 0.3})` : `rgba(12,5,7,${0.3 + rnd() * 0.3})`; g.fillRect(x, y, w, hh); if (x + w > S) g.fillRect(x - S, y, w, hh); } });
}
// a limb: a tube along a smooth curve through pts, radius r0 at its root to r1 at its tip (flare: a wider foot for a trunk)
function limbGeometry(pts, r0, r1, radial, seg, flare = 0) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), fr = curve.computeFrenetFrames(seg, false), P = new THREE.Vector3(), L = curve.getLength();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; curve.getPointAt(t, P); const r = r0 + (r1 - r0) * t + flare * Math.exp(-t * 9), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(P.x + r * (c * N.x + s * B.x), P.y + r * (c * N.y + s * B.y), P.z + r * (c * N.z + s * B.z)); uv.push(j / radial, (t * L) / 1.1); } }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  return { pos, uv, idx };
}
// one tree: limbs grow from the trunk up, forking two or three ways, the upper ones leaning out toward the level (a sakura's
// broad crown); the last forks are the twigs that carry the flowers
function sakuraTree(seed, Q, bark, flower, fGeo) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 4; k++) rnd();
  const limbs = [], twigs = [], D = Q === "high" ? 5 : 4;
  const grow = (p0, dir, len, r0, depth) => {
    const pts = [p0.clone()], d = dir.clone(); let p = p0.clone();
    for (let k = 0; k < 3; k++) { d.x += (rnd() - 0.5) * 0.42; d.z += (rnd() - 0.5) * 0.42; d.y += (rnd() - 0.5) * 0.22 + (depth >= D - 1 ? 0.07 : -0.035); d.normalize(); p = p.clone().addScaledVector(d, len / 3); pts.push(p); }
    const r1 = depth ? r0 * 0.66 : r0 * 0.3; limbs.push([pts, r0, r1, depth]);
    if (!depth) { twigs.push(pts); return; }
    const n = depth >= D - 1 ? 3 : rnd() < 0.55 ? 3 : 2;
    for (let k = 0; k < n; k++) { const b = (k / n) * Math.PI * 2 + rnd() * 1.4, ax = new THREE.Vector3(Math.cos(b), 0, Math.sin(b)).cross(d); if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0); ax.normalize();
      const nd = d.clone().applyAxisAngle(ax, 0.45 + rnd() * 0.42); if (depth <= D - 2) nd.y *= 0.7; nd.normalize();
      grow(p, nd, len * (0.66 + rnd() * 0.16), r1, depth - 1); }
  };
  grow(new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0, 1, 0), D === 5 ? 2.5 : 2.2, 0.3, D);
  const P = [], UV = [], I = []; let nv = 0;
  for (const [pts, r0, r1, depth] of limbs) { const big = depth >= D - 1, L = limbGeometry(pts, r0, r1, big ? 10 : depth >= 2 ? 6 : 4, big ? 9 : depth >= 2 ? 5 : 3, depth === D ? 0.2 : 0);
    P.push(...L.pos); UV.push(...L.uv); for (const i of L.idx) I.push(i + nv); nv += L.pos.length / 3; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, bark));
  // flowers along the last third of each twig and round its tip, more toward the tip, a few pinker, a few whiter
  const per = Q === "high" ? 17 : 11, fl = new THREE.InstancedMesh(fGeo, flower, twigs.length * per), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), at = new THREE.Vector3(), col = new THREE.Color();
  let n = 0; for (const pts of twigs) for (let k = 0; k < per; k++) { const f = Math.sqrt(rnd()), sp = 0.14 + f * 0.3; at.lerpVectors(pts[1], pts[3], f); at.x += (rnd() - 0.5) * sp * 2; at.y += (rnd() - 0.3) * sp * 1.5; at.z += (rnd() - 0.5) * sp * 2;
    e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); q.setFromEuler(e); const s = 0.72 + rnd() * 0.56; sc.set(s, s, s); M.compose(at, q, sc); fl.setMatrixAt(n, M); col.setRGB(1, 0.84 + rnd() * 0.16, 0.9 + rnd() * 0.1); fl.setColorAt(n, col); n++; }
  fl.frustumCulled = false; grp.add(fl); return grp;
}
function buildSakura() {
  const Q = R.Q, grp = new THREE.Group(); grp.name = "sakura"; R.scene.add(grp);
  const S = { grp, zk: R.zones, tex: [petalTexture(), flowerTexture(), barkTexture()], o: new THREE.Object3D() }, [pt, ft, bt] = S.tex; bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  const bark = new THREE.MeshStandardMaterial({ map: bt, color: 0xc8b2b0, roughness: 0.93, metalness: 0 });
  const flower = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.7, metalness: 0, emissive: 0xff86b0, emissiveMap: ft, emissiveIntensity: 0.26 });
  const petal = new THREE.MeshStandardMaterial({ map: pt, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.65, metalness: 0, emissive: 0xff8ab0, emissiveMap: pt, emissiveIntensity: 0.2 });
  const fGeo = new THREE.PlaneGeometry(0.22, 0.22), pGeo = new THREE.PlaneGeometry(0.15, 0.12); S.mats = [bark, flower, petal]; S.geos = [fGeo, pGeo];
  if (Q !== "low") for (const [x, z, ry, k, seed] of SAKURA[R.zones === ZONES.tall ? "tall" : "wide"].slice(0, Q === "high" ? 4 : 2)) { const t = sakuraTree(seed * 7919, Q, bark, flower, fGeo); t.position.set(x, -0.335, z); t.rotation.y = ry; t.scale.setScalar(k); grp.add(t); }
  // fallen petals: on the wood round the mat, thickest under the trees, and a few on the mat's border
  { const n = Q === "high" ? 320 : Q === "mid" ? 180 : 90, m = new THREE.InstancedMesh(pGeo, petal, n), o = S.o; let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spots = SAKURA[R.zones === ZONES.tall ? "tall" : "wide"];
    for (let i = 0; i < n; i++) { let x, z, y = -0.326;
      if (i % 4 === 0) { const side = Math.floor(rnd() * 4), u = rnd(); [x, z] = side < 2 ? [-MW / 2 + 0.12 + u * (MW - 0.24), MZ + (side ? 1 : -1) * (MD / 2 - 0.12 - rnd() * 0.14)] : [(side === 2 ? 1 : -1) * (MW / 2 - 0.12 - rnd() * 0.14), MZ - MD / 2 + 0.12 + u * (MD - 0.24)]; y = 0.006; }
      else if (i % 4 === 1) { const [tx, tz] = spots[Math.floor(rnd() * spots.length)], a = rnd() * 6.28, r = Math.sqrt(rnd()) * 3.2; x = tx + Math.cos(a) * r; z = tz + Math.sin(a) * r; }
      else { do { x = -13 + rnd() * 26; z = -13 + rnd() * 21; } while (Math.abs(x) < MW / 2 + 0.15 && Math.abs(z - MZ) < MD / 2 + 0.15); }
      o.position.set(x, y + rnd() * 0.004, z); o.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); o.scale.setScalar(0.75 + rnd() * 0.55); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    m.frustumCulled = false; grp.add(m); }
  // falling petals (none when the device asks for less motion)
  const nf = reduce ? 0 : Q === "high" ? 70 : Q === "mid" ? 42 : 22;
  if (nf) { const m = new THREE.InstancedMesh(pGeo, petal, nf); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; grp.add(m); S.fall = { m, st: Array.from({ length: nf }, () => respawnPetal({}, true)) }; }
  return S;
}
function respawnPetal(st, first) {
  Object.assign(st, { x: -10.5 + Math.random() * 18, z: -8.5 + Math.random() * 14, y: first ? 0.3 + Math.random() * 7 : 5.5 + Math.random() * 3, v: 0.26 + Math.random() * 0.26, a: 0.25 + Math.random() * 0.45, f: 0.7 + Math.random() * 0.9,
    ph: Math.random() * 6.28, rx: 1 + Math.random() * 2.2, ry: 0.6 + Math.random() * 1.4, rz: 0.5 + Math.random() * 1.5, s: 0.8 + Math.random() * 0.5, rest: 0, lie: 0 }); return st;
}
// each frame: a light breeze toward the right, a sway and a tumble; a petal that lands lies still a moment, then shrinks away
function stepSakura(S, dt, t) {
  const F = S.fall, o = S.o; if (!F) return;
  for (let i = 0; i < F.st.length; i++) { const st = F.st[i];
    if (st.rest > 0) { st.rest -= dt; o.position.set(st.x, st.y, st.z); o.rotation.set(-Math.PI / 2, 0, st.lie); o.scale.setScalar(st.s * Math.min(1, Math.max(0, st.rest / 0.8))); if (st.rest <= 0) respawnPetal(st, false); }
    else { st.y -= st.v * dt; st.x += (0.22 + Math.sin(t * st.f + st.ph) * st.a) * dt; st.z += (Math.cos(t * st.f * 0.7 + st.ph) * st.a * 0.5 - 0.04) * dt;
      const floor = Math.abs(st.x) < MW / 2 && Math.abs(st.z - MZ) < MD / 2 ? 0.012 : -0.322;
      if (st.y <= floor) { st.y = floor; st.rest = 2 + Math.random() * 4; st.lie = Math.random() * 6.28; }
      o.position.set(st.x, st.y, st.z); o.rotation.set(t * st.rx + st.ph, t * st.ry, t * st.rz + st.ph * 2); o.scale.setScalar(st.s); }
    o.updateMatrix(); F.m.setMatrixAt(i, o.matrix); }
  F.m.instanceMatrix.needsUpdate = true;
}
function dropSakura(S) {
  R.scene.remove(S.grp); S.grp.traverse((o) => { if (o.isMesh && !S.geos.includes(o.geometry)) o.geometry.dispose(); });
  for (const x of [...S.geos, ...S.mats, ...S.tex]) x.dispose();
}
// ---------- สวนสระบัว: a garden diorama round the table ----------
// A lotus pond behind and beside the mat with an arched wooden bridge to a small islet and its stone lantern, a blossom tree
// that sheds petals, rocks, stepping stones, daisies and leafy clumps, koi under the water, a robin on the bridge rail and
// butterflies over the flowers. All of it is made here (no picture or model is loaded); every repeated thing is one batch,
// nothing has a lamp of its own, and the water is one small shader — so it stays cheap on a phone.
// What a screen sees: the band behind the mat and its left margin on a wide screen (the right margin lies under the game
// panel), the band past the far edge on an upright phone.
const POND = {
  wide: { water: [[-14.5, -7.9], [-10, -7.3], [-5, -7.2], [0, -7.2], [5, -7.2], [10, -7.3], [14.8, -7.9], [15.6, -10.5], [13, -13], [8, -14], [0, -14.4], [-8, -14], [-14, -12.6], [-15.6, -10.2]],
    bridge: [-8.5, -3.0, -7.95], isles: [[-9.75, -8.25, 1.55, 1.0], [-2.0, -8.2, 1.2, 0.9]], lamp: [-10.25, -8.45], tree: [10.8, -3.4, -0.7, 1.0, 5],
    stones: [[-9.3, 4.6], [-9.25, 1.2], [-9.4, -2.2], [-9.6, -5.2], [-9.7, -6.9]],
    beds: [[-12.8, -8.75, -7.0, 4.8], [8.75, 12.6, -7.0, 4.8]], pads: [-13, 9.4, -8.9],
    koi: [[-5.6, -8.5, 2.3, 0.45], [6.6, -8.4, 1.6, 0.4], [10.2, -8.7, 1.3, 0.4]], fly: [-10.6, -3.0], rockBird: [-11.2, -5.2] },
  tall: { water: [[-10, -8.4], [-5, -7.7], [0, -7.6], [5, -7.7], [10, -8.4], [11, -11], [8, -14], [0, -14.6], [-8, -14], [-11, -11]],
    bridge: [-3.6, 2.0, -8.7], isles: [[-4.9, -8.95, 1.5, 1.15], [3.0, -8.95, 1.2, 1.0]], lamp: [-5.5, -9.1], tree: [-6.4, -7.2, 0.5, 0.82, 3],
    stones: [[-6.7, -6.3], [-5.9, -7.0], [-5.3, -7.9]],
    beds: [[-7.6, 7.6, -7.5, -6.9], [-7.4, 7.4, 6.6, 9.5]], pads: [-7.6, 7.6, -10.2],
    koi: [[4.6, -9.2, 1.6, 0.5], [-0.8, -9.9, 1.8, 0.4], [6.4, -10.4, 1.0, 0.8]], fly: [3.6, -7.3], rockBird: [5.6, -7.25] } };
const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const lcg = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function grassTexture() {
  return canvasTex(512, (g, S) => { g.fillStyle = "#43923c"; g.fillRect(0, 0, S, S); const rnd = lcg(11);
    for (let k = 0; k < 90; k++) { const x = rnd() * S, y = rnd() * S, r = 26 + rnd() * 70, light = rnd() < 0.5;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, light ? "rgba(132,200,84,.34)" : "rgba(28,98,56,.34)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } }
    for (let k = 0; k < 3200; k++) { const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 7; g.strokeStyle = rnd() < 0.5 ? "rgba(160,216,100,.36)" : "rgba(22,84,46,.36)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - l); g.stroke(); }
    for (let k = 0; k < 70; k++) { g.fillStyle = rnd() < 0.6 ? "rgba(255,255,242,.85)" : "rgba(255,226,120,.85)"; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1.4, 0, 7); g.fill(); } });
}
function paverTexture() {
  return canvasTex(256, (g, S) => { g.fillStyle = "#4a4658"; g.fillRect(0, 0, S, S); const rnd = lcg(29), N = 4, c = S / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = 138 + Math.floor(rnd() * 34), x = i * c + 3, y = j * c + 3, w = c - 6; g.fillStyle = `rgb(${v},${v - 5},${v + 12})`; roundRect(g, x, y, x + w, y + w, 7); g.fill();
      for (let k = 0; k < 26; k++) { g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.09)"; g.fillRect(x + rnd() * w, y + rnd() * w, 2 + rnd() * 5, 2 + rnd() * 3); } } });
}
function padTexture() {
  return canvasTex(128, (g, S) => { const C = S / 2; g.fillStyle = "#2f8f4e"; g.beginPath(); g.moveTo(C, C); g.arc(C, C, C - 4, 0.28, 6.0); g.closePath(); g.fill();
    g.strokeStyle = "rgba(190,236,160,.5)"; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const a = 0.5 + k * 0.63; g.beginPath(); g.moveTo(C, C); g.lineTo(C + Math.cos(a) * (C - 10), C + Math.sin(a) * (C - 10)); g.stroke(); }
    g.strokeStyle = "rgba(20,70,40,.55)"; g.lineWidth = 4; g.beginPath(); g.arc(C, C, C - 5, 0.28, 6.0); g.stroke(); });
}
function daisyTexture() {
  return canvasTex(128, (g, S) => { g.strokeStyle = "#3d8a3c"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(S / 2, S); g.quadraticCurveTo(S * 0.45, S * 0.7, S / 2, S * 0.4); g.stroke();
    g.fillStyle = "#4f9a40"; g.beginPath(); g.ellipse(S * 0.37, S * 0.8, 17, 6, -0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(S * 0.63, S * 0.87, 16, 6, 0.6, 0, 7); g.fill();
    g.fillStyle = "#ffffff"; for (let k = 0; k < 13; k++) { g.save(); g.translate(S / 2, S * 0.36); g.rotate((k * 6.2832) / 13); g.beginPath(); g.ellipse(0, -19, 6.5, 17, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = "#ffcf3d"; g.beginPath(); g.arc(S / 2, S * 0.36, 9.5, 0, 7); g.fill(); g.fillStyle = "#e79a1c"; g.beginPath(); g.arc(S / 2, S * 0.36, 5, 0, 7); g.fill(); });
}
function leafTexture() {
  return canvasTex(128, (g, S) => { for (let k = 0; k < 7; k++) { const a = -1.15 + k * 0.383, len = S * (0.62 + 0.3 * Math.cos(a)); g.save(); g.translate(S / 2, S * 0.98); g.rotate(a);
      const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, "#1f6a3a"); gr.addColorStop(1, k % 2 ? "#6cc05a" : "#4fa64c"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(17, -len * 0.3, 15, -len * 0.8, 0, -len); g.bezierCurveTo(-15, -len * 0.8, -17, -len * 0.3, 0, 0); g.fill();
      g.strokeStyle = "rgba(210,240,170,.45)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len * 0.9); g.stroke(); g.restore(); } });
}
function koiTexture(spot) {
  return canvasTex(128, (g, S) => { const y = S / 2; g.fillStyle = "#fff6ea"; g.beginPath(); g.moveTo(S * 0.93, y); g.bezierCurveTo(S * 0.8, y - 17, S * 0.42, y - 15, S * 0.24, y - 3); g.lineTo(S * 0.04, y - 15); g.lineTo(S * 0.1, y); g.lineTo(S * 0.04, y + 15); g.lineTo(S * 0.24, y + 3); g.bezierCurveTo(S * 0.42, y + 15, S * 0.8, y + 17, S * 0.93, y); g.fill();
    g.globalCompositeOperation = "source-atop"; g.fillStyle = spot; for (const [x, r] of [[0.74, 13], [0.5, 11], [0.3, 7]]) { g.beginPath(); g.arc(S * x, y + (x > 0.6 ? -3 : 4), r, 0, 7); g.fill(); } g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(255,246,234,.8)"; g.beginPath(); g.ellipse(S * 0.6, y - 17, 9, 4, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(S * 0.6, y + 17, 9, 4, 0.5, 0, 7); g.fill(); });
}
function wingTexture(col) {
  return canvasTex(64, (g, S) => { g.fillStyle = "#2a1c18"; g.beginPath(); g.moveTo(0, S * 0.5); g.bezierCurveTo(S * 0.3, -S * 0.1, S * 1.05, S * 0.02, S * 0.96, S * 0.42); g.bezierCurveTo(S * 1.0, S * 0.8, S * 0.5, S * 1.02, 0, S * 0.5); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(S * 0.06, S * 0.5); g.bezierCurveTo(S * 0.32, S * 0.04, S * 0.9, S * 0.1, S * 0.84, S * 0.42); g.bezierCurveTo(S * 0.86, S * 0.72, S * 0.48, S * 0.9, S * 0.06, S * 0.5); g.fill();
    g.fillStyle = "rgba(255,255,255,.85)"; for (const [x, y] of [[0.8, 0.26], [0.86, 0.5], [0.72, 0.7]]) { g.beginPath(); g.arc(S * x, S * y, 2.6, 0, 7); g.fill(); } });
}
function ringTexture() { return canvasTex(128, (g, S) => { g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 5; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke(); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 22, 0, 7); g.stroke(); }); }
// the arched bridge as a list of boxes: planks, the two beams under them, posts and two rails each side [x, y, z, sx, sy, sz, turn, tone]
function bridgeParts(x0, x1, zc, w, rise, base) {
  const len = x1 - x0, N = 16, parts = [], y = (u) => base + 0.12 + rise * Math.sin(Math.PI * u), ang = (u) => Math.atan((rise * Math.PI * Math.cos(Math.PI * u)) / len);
  const box = (...a) => parts.push(a);
  for (let k = 0; k < N; k++) { const u = (k + 0.5) / N, x = x0 + len * u, a = ang(u), L = (len / N / Math.cos(a)) * 0.95;
    box(x, y(u), zc, L, 0.06, w, a, 0.9 + ((k * 7) % 5) * 0.045);
    for (const s of [-1, 1]) box(x, y(u) - 0.1, zc + s * (w / 2 - 0.07), L * 1.08, 0.15, 0.09, a, 0.7); }
  const posts = []; for (let k = 0; k <= N; k += 2) { const u = k / N, end = k === 0 || k === N, ph = end ? 0.76 : 0.52, x = x0 + len * u; posts.push([x, y(u)]);
    for (const s of [-1, 1]) box(x, y(u) + ph / 2, zc + s * (w / 2 - 0.05), end ? 0.14 : 0.08, ph, end ? 0.14 : 0.08, 0, end ? 0.74 : 0.84); }
  for (let k = 0; k + 1 < posts.length; k++) { const [xa, ya] = posts[k], [xb, yb] = posts[k + 1], dx = xb - xa, dy = yb - ya, L = Math.hypot(dx, dy);
    for (const [hh, th] of [[0.47, 0.07], [0.25, 0.045]]) for (const s of [-1, 1]) box((xa + xb) / 2, (ya + yb) / 2 + hh, zc + s * (w / 2 - 0.05), L, th, th, Math.atan2(dy, dx), 1); }
  return { parts, top: (u) => y(u) + 0.47 + 0.035 };
}
function makeBird(M) {
  const grp = new THREE.Group(), body = new THREE.Mesh(M.sph, M.back); body.scale.set(0.13, 0.115, 0.17); grp.add(body);
  const belly = new THREE.Mesh(M.sph, M.belly); belly.scale.set(0.115, 0.09, 0.13); belly.position.set(0, -0.03, 0.01); grp.add(belly);
  const chest = new THREE.Mesh(M.sph, M.chest); chest.scale.set(0.105, 0.1, 0.09); chest.position.set(0, 0.005, 0.085); grp.add(chest);
  const tail = new THREE.Mesh(M.box, M.back); tail.scale.set(0.07, 0.02, 0.2); tail.position.set(0, 0.03, -0.22); tail.rotation.x = -0.35; grp.add(tail);
  const neck = new THREE.Group(); neck.position.set(0, 0.09, 0.08); grp.add(neck);
  const head = new THREE.Mesh(M.sph, M.back); head.scale.set(0.085, 0.08, 0.085); head.position.set(0, 0.035, 0.02); neck.add(head);
  const face = new THREE.Mesh(M.sph, M.chest); face.scale.set(0.066, 0.058, 0.05); face.position.set(0, 0.022, 0.062); neck.add(face);
  const beak = new THREE.Mesh(M.cone, M.dark); beak.scale.set(0.022, 0.07, 0.022); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.035, 0.125); neck.add(beak);
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(M.sph, M.dark); eye.scale.setScalar(0.013); eye.position.set(s * 0.058, 0.052, 0.062); neck.add(eye); }
  return { grp, neck, t: 1 + Math.random() * 3, yaw: 0, hop: 0, turn: 0, y0: 0 };
}
// water whose light runs over it in a net of bright lines (the pond; other scenes give it their own colours)
// wave: 0 = still light on water; 1 = the light runs outward from the table in rings (the owner's scene)
function cellWater(low, deep, shal, hi, fogD, gain = 0.55, wave = 0) {
  return new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uShal: { value: new THREE.Color(shal) }, uHi: { value: new THREE.Color(hi) }, uGain: { value: gain }, uWave: { value: wave }, uFogC: { value: R.scene.fog.color }, uFogD: { value: fogD } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `${low ? "#define LOW\n" : ""}uniform float uT; uniform float uGain; uniform float uWave; uniform vec3 uDeep; uniform vec3 uShal; uniform vec3 uHi; uniform vec3 uFogC; uniform float uFogD; varying vec3 vW;
      vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      float cell(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = 0.5 + 0.42 * sin(uT * 0.8 + 6.2831 * h2(i + g)); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        return d2 - d1; }
      void main(){ vec2 p = vW.xz; float line = smoothstep(0.1, 0.02, cell(p * 0.62 + vec2(uT * 0.035, 0.0)));
        #ifndef LOW
        line = line * 0.85 + 0.4 * smoothstep(0.08, 0.015, cell(p * 1.27 + vec2(3.7, -uT * 0.05)));
        #endif
        line *= mix(1.0, 0.16 + 0.84 * pow(0.5 + 0.5 * sin(length(p - vec2(0.0, -0.2)) * 0.85 - uT * 1.25), 3.0), uWave);
        float depth = 0.5 + 0.5 * sin(p.x * 0.33 + sin(p.y * 0.41) * 1.3 + uT * 0.07);
        vec3 col = mix(uDeep, uShal, 0.18 + 0.6 * depth) + uHi * line * uGain;
        float d = length(cameraPosition - vW); col = mix(col, uFogC, 1.0 - exp(-uFogD * uFogD * d * d));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }` });
}
function buildPond() {
  const Q = R.Q, low = Q === "low", C = POND[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "pond"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], koi: [], rings: [], flies: [], birds: [], step: stepPond }, o = S.o, rnd = lcg(71), T = (t) => { S.tex.push(t); return t; };
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  // grass as far as the eye goes (unlit, its light painted in: bright round the table, deep green toward the edges)
  { const gt = T(grassTexture()); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(7, 5); gt.anisotropy = 8;
    const tg = new THREE.PlaneGeometry(70, 50, 28, 20), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
    for (let k = 0; k < tp.count; k++) { const d = Math.hypot(tp.getX(k) / 1.3, tp.getY(k) + 1.5), v = 0.3 + 0.62 * Math.exp(-(Math.max(0, d - 7) ** 2) / 120); tc[k * 3] = v * 0.93; tc[k * 3 + 1] = v; tc[k * 3 + 2] = v * 0.95; }
    tg.setAttribute("color", new THREE.BufferAttribute(tc, 3)); const m = flat(tg, new THREE.MeshBasicMaterial({ map: gt, vertexColors: true }), G); m.position.z = -2; }
  // the table stands on a terrace of stone slabs
  { const pt = T(paverTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(7, 5.5); flat(new THREE.PlaneGeometry(MW + 1.7, MD + 1.7), new THREE.MeshBasicMaterial({ map: pt, color: 0xc9c6d2 }), G + 0.006, 1).position.z = MZ;
    flat(new THREE.PlaneGeometry(MW + 3.2, MD + 3.2), new THREE.MeshBasicMaterial({ map: R.shade.material.map, transparent: true, opacity: 0.5, depthWrite: false }), G + 0.004, 1).position.z = MZ; }
  // the pond: a sandy bank, then water whose light ripples run across it
  const out = new THREE.CatmullRomCurve3(C.water.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal").getPoints(80).map((p) => [p.x, p.z]); S.poly = out;
  const cx = out.reduce((a, p) => a + p[0], 0) / out.length, cz = out.reduce((a, p) => a + p[1], 0) / out.length;
  const shape = (grow) => new THREE.ShapeGeometry(new THREE.Shape(out.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return new THREE.Vector2(x + (dx / d) * grow, -(z + (dz / d) * grow)); })));
  flat(shape(0.34), new THREE.MeshBasicMaterial({ color: 0x9a8f6e }), G + 0.003, 1); flat(shape(0.12), new THREE.MeshBasicMaterial({ color: 0x4a6f5c }), G + 0.0045, 2);
  const water = cellWater(low, 0x0c6d86, 0x35c9c4, 0xc8fff2, 0.019);
  flat(shape(0), water, G + 0.006, 3); S.water = water;
  const wet = (x, z, pad = 0) => inPoly(x, z, out) && (!pad || [[pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([a, b]) => inPoly(x + a, z + b, out)));
  const [bx0, bx1, bz] = C.bridge, onIslet = (x, z, k = 1) => C.isles.some(([ix, iz, irx, irz]) => ((x - ix) / (irx * k)) ** 2 + ((z - iz) / (irz * k)) ** 2 < 1);
  // a free spot on the water, in the part of the pond a screen shows
  const inWater = (pad) => { const [x0, x1, z0] = C.pads; for (let n = 0; n < 80; n++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (-7.4 - z0) * 1.0; if (wet(x, z, pad) && !onIslet(x, z, 1.3) && !(Math.abs(z - bz) < 1.0 && x > bx0 - 0.4 && x < bx1 + 0.4)) return [x, z]; } return null; };
  // the islet the bridge leads to, with its stone lantern
  { const cg = new THREE.CircleGeometry(1, 28), sand = new THREE.MeshBasicMaterial({ color: 0x9a8f6e }), turf = new THREE.MeshBasicMaterial({ color: 0x3f8f3c });
    for (const [ix, iz, irx, irz] of C.isles) { const im = flat(cg, sand, G + 0.008, 4); im.position.set(ix, G + 0.008, iz); im.scale.set(irx + 0.2, irz + 0.2, 1); const ig = flat(cg, turf, G + 0.011, 5); ig.position.set(ix, G + 0.011, iz); ig.scale.set(irx, irz, 1); } }
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a95a6, roughness: 0.95, metalness: 0, flatShading: true });
  { const L = new THREE.Group(); L.position.set(C.lamp[0], G, C.lamp[1]); grp.add(L); const part = (geo, y, mat = stone) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; L.add(m); return m; };
    part(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 6), 0.07); part(new THREE.CylinderGeometry(0.1, 0.13, 0.62, 6), 0.45);
    part(new THREE.CylinderGeometry(0.27, 0.2, 0.08, 6), 0.8); part(new THREE.BoxGeometry(0.32, 0.26, 0.32), 0.97, new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb04a, emissiveIntensity: 1.25, roughness: 0.6 }));
    const roof = part(new THREE.ConeGeometry(0.42, 0.26, 4), 1.23); roof.rotation.y = Math.PI / 4; part(new THREE.SphereGeometry(0.07, 6, 5), 1.4);
    S.glow = sprite(R.FX.dot, 0xffb050, 2.3, new THREE.Vector3(0, 0.97, 0), 0.5, L); }
  // the bridge: every board, post and rail is one box of the same batch
  { const B = bridgeParts(bx0, bx1, bz, 1.3, 0.95, G), bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb06a3c, roughness: 0.82, metalness: 0 }), B.parts.length), col = new THREE.Color();
    B.parts.forEach(([x, y, z, sx, sy, sz, a, tone], i) => { o.position.set(x, y, z); o.rotation.set(0, 0, a); o.scale.set(sx, sy, sz); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); bm.setColorAt(i, col.setRGB(tone, tone * 0.97, tone * 0.93)); });
    bm.castShadow = Q === "high"; grp.add(bm); S.railTop = B.top;
    const sh = flat(new THREE.PlaneGeometry(bx1 - bx0 + 1, 2.6), new THREE.MeshBasicMaterial({ map: R.shade.material.map, transparent: true, opacity: 0.42, depthWrite: false }), G + 0.012, 6); sh.position.set((bx0 + bx1) / 2, G + 0.012, bz + 0.25); }
  // lily pads and lotus in bloom
  { const n = low ? 8 : Q === "mid" ? 13 : 19, pads = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T(padTexture()), alphaTest: 0.5 }), n), col = new THREE.Color(), spots = [];
    for (let i = 0; i < n; i++) { const p = inWater(0.45) || [bx1 + 2, bz - 0.9]; spots.push(p); o.position.set(p[0], G + 0.012 + i * 0.0002, p[1]); o.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); o.scale.setScalar(0.55 + rnd() * 0.5); o.updateMatrix(); pads.setMatrixAt(i, o.matrix); pads.setColorAt(i, col.setRGB(0.8 + rnd() * 0.2, 0.9 + rnd() * 0.1, 0.8 + rnd() * 0.2)); }
    pads.renderOrder = 4; grp.add(pads);
    const nf = Math.min(spots.length, low ? 3 : Q === "mid" ? 5 : 7), rings = [[7, 1.08, 1], [6, 0.62, 0.86], [4, 0.24, 0.7]], per = 17;
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.13, 0.2, 0.05, 0, 0.44, 0.1, -0.13, 0.2, 0.05], 3)); pg.setIndex([0, 1, 2, 0, 2, 3]); pg.computeVertexNormals();
    const petals = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0, emissive: 0x8a2a55, emissiveIntensity: 0.28 }), nf * per);
    const hearts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 7, 5), new THREE.MeshStandardMaterial({ color: 0xffd257, emissive: 0x8a5a10, emissiveIntensity: 0.4, roughness: 0.6 }), nf); let k = 0; o.rotation.order = "YXZ";
    for (let f = 0; f < nf; f++) { const [x, z] = spots[f], sc = 0.85 + rnd() * 0.45, y = G + 0.03, a0 = rnd() * 6.28, white = f % 3 === 2;
      for (const [cnt, tilt, size] of rings) for (let j = 0; j < cnt; j++) { o.position.set(x, y, z); o.rotation.set(tilt, a0 + (j / cnt) * 6.2832 + tilt, 0); o.scale.setScalar(sc * size); o.updateMatrix(); petals.setMatrixAt(k, o.matrix);
        petals.setColorAt(k++, white ? col.setRGB(1, 0.96 - tilt * 0.06, 0.98) : col.setRGB(1, 0.5 + (1.1 - tilt) * 0.3, 0.72 + (1.1 - tilt) * 0.16)); }
      o.rotation.set(0, 0, 0); o.position.set(x, y + 0.07 * sc, z); o.scale.setScalar(sc); o.updateMatrix(); hearts.setMatrixAt(f, o.matrix); }
    o.rotation.order = "XYZ"; o.rotation.set(0, 0, 0); grp.add(petals, hearts); }
  // koi going round under the surface, and the rings a fish leaves when it comes up
  { const cols = ["#f0652a", "#e23a2a", "#f4b63a"]; C.koi.slice(0, low ? 1 : 3).forEach(([kx, kz, a, b], i) => { const g2 = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: T(koiTexture(cols[i])), transparent: true, opacity: 0.86, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 4; g2.add(m); g2.position.y = G + 0.009; grp.add(g2); S.koi.push({ g: g2, kx, kz, a, b, w: (0.16 + i * 0.05) * (i % 2 ? -1 : 1), ph: i * 2.1 }); });
    const rt = T(ringTexture()); for (let i = 0; i < (low ? 1 : 3); i++) { const m = flat(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: 0, depthWrite: false }), G + 0.014, 5); S.rings.push({ m, age: 9, dur: 2.6, wait: 1 + i * 2.3 }); } }
  // the blossom tree, the petals it has dropped and the ones still falling
  { const [tx, tz, ry, k, seed] = C.tree, bt = T(barkTexture()), ft = T(flowerTexture()), pt = T(petalTexture()); bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
    const bark = new THREE.MeshStandardMaterial({ map: bt, color: 0xd8c2b4, roughness: 0.93, metalness: 0 });
    const flower = new THREE.MeshStandardMaterial({ map: ft, color: 0xfff0ff, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.7, metalness: 0, emissive: 0xe9b6ff, emissiveMap: ft, emissiveIntensity: 0.3 });
    const petal = new THREE.MeshBasicMaterial({ map: pt, color: 0xfff2ff, alphaTest: 0.4, side: THREE.DoubleSide });
    const fGeo = new THREE.PlaneGeometry(0.24, 0.24), pGeo = new THREE.PlaneGeometry(0.15, 0.12);
    const tree = sakuraTree(seed * 7919, low ? "mid" : Q, bark, flower, fGeo); tree.position.set(tx, G, tz); tree.rotation.y = ry; tree.scale.setScalar(k); grp.add(tree);
    const sh = flat(new THREE.PlaneGeometry(7.5 * k, 7.5 * k), new THREE.MeshBasicMaterial({ map: R.shade.material.map, transparent: true, opacity: 0.5, depthWrite: false }), G + 0.005, 1); sh.position.set(tx + 0.4, G + 0.005, tz + 0.3);
    const n = low ? 40 : 110, m = new THREE.InstancedMesh(pGeo, petal, n); for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 4.2 * k; o.position.set(tx + Math.cos(a) * r, G + 0.013 + rnd() * 0.003, tz + Math.sin(a) * r); o.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); o.scale.setScalar(0.8 + rnd() * 0.5); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    m.frustumCulled = false; m.renderOrder = 6; grp.add(m);
    const nf = reduce ? 0 : low ? 14 : Q === "mid" ? 30 : 52; if (nf) { const fm = new THREE.InstancedMesh(pGeo, petal, nf); fm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fm.frustumCulled = false; grp.add(fm); S.fall = { m: fm, st: Array.from({ length: nf }, () => respawnPetal({}, true)) }; } }
  // rocks along the bank and by the tree, and stepping stones leading to the bridge
  { const spots = []; for (let i = 0; i < out.length; i += low ? 9 : 5) { const [x, z] = out[i], dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; if (z < -13.4 || x > 13.6) continue; spots.push([x + (dx / d) * (0.25 + rnd() * 0.35), z + (dz / d) * (0.25 + rnd() * 0.35), 0.28 + rnd() * 0.42]); }
    const [tx, tz] = C.tree; spots.push([tx + 0.95, tz + 1.2, 0.42], [tx - 0.9, tz + 1.5, 0.34], [tx + 1.2, tz - 1.1, 0.26], [C.rockBird[0], C.rockBird[1], 0.55], [C.rockBird[0] + 0.8, C.rockBird[1] + 0.35, 0.3], ...C.isles.map(([ix, iz, irx, irz], i) => [ix + (i ? 0.75 : -0.8) * irx, iz + irz * 0.55, 0.3]));
    const rk = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), stone, spots.length), col = new THREE.Color(); spots.forEach(([x, z, s], i) => { const sy = s * (0.55 + rnd() * 0.3); o.position.set(x, G + sy * 0.5, z); o.rotation.set(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5); o.scale.set(s * (0.9 + rnd() * 0.5), sy, s * (0.8 + rnd() * 0.4)); o.updateMatrix(); rk.setMatrixAt(i, o.matrix); const v = 0.82 + rnd() * 0.3; rk.setColorAt(i, col.setRGB(v, v * 0.97, v * 1.06)); });
    o.rotation.set(0, 0, 0); rk.castShadow = Q === "high"; grp.add(rk); S.rock = [C.rockBird[0], G + 0.55 * 0.7, C.rockBird[1]];
    const path = []; for (let i = 0; i + 1 < C.stones.length; i++) { const [xa, za] = C.stones[i], [xb, zb] = C.stones[i + 1], L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 1.2)); for (let j = 0; j < n; j++) path.push([xa + ((xb - xa) * j) / n, za + ((zb - za) * j) / n]); }
    const st = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.5, 0.05, 7), stone, path.length); path.forEach(([x, z], i) => { o.position.set(x + (rnd() - 0.5) * 0.16, G + 0.027, z + (rnd() - 0.5) * 0.16); o.rotation.set(0, rnd() * 6.28, 0); o.scale.set(0.85 + rnd() * 0.3, 1, 0.8 + rnd() * 0.3); o.updateMatrix(); st.setMatrixAt(i, o.matrix); const v = 0.95 + rnd() * 0.2; st.setColorAt(i, col.setRGB(v, v, v * 1.04)); });
    o.rotation.set(0, 0, 0); grp.add(st); S.path = path; }
  // daisies and leafy clumps: flat cards that lean back toward the eye
  { const beds = C.beds, dry = (x, z) => !wet(x, z) && !inPoly(x + 0.4, z, out) && !inPoly(x - 0.4, z, out) && !(Math.abs(x) < MW / 2 + 0.95 && Math.abs(z - MZ) < MD / 2 + 0.95) && !S.path.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.62);
    const place = (n) => { const r = []; for (let t = 0; t < n * 6 && r.length < n; t++) { const b = beds[Math.floor(rnd() * beds.length)], x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (dry(x, z)) r.push([x, z]); } if (!low) for (const [ix, iz, irx, irz] of C.isles) for (let t = 0; t < 3; t++) r.push([ix + (rnd() - 0.5) * irx * 1.2, iz + (rnd() - 0.1) * irz * 0.9]); return r; };
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0); const col = new THREE.Color();
    const card = (tex, spots, s0, s1, tint) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: T(tex), alphaTest: 0.45, side: THREE.DoubleSide }), spots.length);
      spots.forEach(([x, z], i) => { o.position.set(x, G, z); o.rotation.set(-0.5, (rnd() - 0.5) * 0.7, 0); o.scale.setScalar(s0 + rnd() * (s1 - s0)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, tint(col)); }); m.frustumCulled = false; grp.add(m); };
    card(leafTexture(), place(low ? 14 : Q === "mid" ? 26 : 40), 0.7, 1.15, (c) => { const v = 0.82 + rnd() * 0.25; return c.setRGB(v, v, v * 0.95); });
    card(daisyTexture(), place(low ? 18 : Q === "mid" ? 36 : 60), 0.42, 0.7, (c) => { const k = rnd(); return k < 0.55 ? c.setRGB(1, 1, 1) : k < 0.8 ? c.setRGB(1, 0.78, 0.9) : c.setRGB(1, 0.94, 0.7); }); o.rotation.set(0, 0, 0); }
  // a robin on the bridge rail, another on a rock; butterflies over the flowers
  { const M = { sph: new THREE.SphereGeometry(1, 9, 7), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 5), mk: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, flatShading: true }) };
    Object.assign(M, { back: M.mk(0x7b6a5b), belly: M.mk(0xf0e7da), chest: M.mk(0xe5702c), dark: M.mk(0x2a1d18) });
    const at = (x, y, z, ry, s) => { const b = makeBird(M); b.grp.position.set(x, y, z); b.grp.rotation.y = ry; b.grp.scale.setScalar(s); b.y0 = y; grp.add(b.grp); S.birds.push(b); };
    at(bx0 + (bx1 - bx0) * 0.42, S.railTop(0.42) + 0.15, bz + 0.6, 0.5, 1.5); if (Q === "high") at(S.rock[0], S.rock[1] + 0.13, S.rock[2], -0.7, 1.5);
    const wg = (s) => { const g2 = new THREE.PlaneGeometry(0.2, 0.24); g2.rotateX(-Math.PI / 2); g2.translate(s * 0.1, 0, 0); return g2; };
    ["#f39a2c", "#f6e27a", "#8ec9ff"].slice(0, low || reduce ? 1 : 3).forEach((c, i) => { const g2 = new THREE.Group(), wm = new THREE.MeshBasicMaterial({ map: T(wingTexture(c)), alphaTest: 0.3, side: THREE.DoubleSide }), a = new THREE.Mesh(wg(1), wm), b = new THREE.Mesh(wg(1), wm); b.scale.x = -1; g2.add(a, b); grp.add(g2);
      S.flies.push({ g: g2, a, b, cx: C.fly[0] + (i - 1) * 1.1, cz: C.fly[1] + (i - 1) * 2.3, ph: i * 2.3, f: 0.33 + i * 0.07, px: 0, pz: 0 }); }); }
  return S;
}
function stepPond(S, dt, t) {
  S.water.uniforms.uT.value = t; if (S.fall) stepSakura(S, dt, t);
  for (const k of S.koi) { const a = t * k.w + k.ph, x = k.kx + Math.cos(a) * k.a, z = k.kz + Math.sin(a) * k.b; k.g.position.x = x; k.g.position.z = z; k.g.rotation.y = Math.atan2(-k.b * Math.cos(a) * k.w, -k.a * Math.sin(a) * k.w) + Math.sin(t * 5 + k.ph) * 0.14; }
  for (const r of S.rings) { r.age += dt; if (r.age > r.dur + r.wait) { let p = null; for (let n = 0; n < 12 && !p; n++) { const q = S.poly[Math.floor(Math.random() * S.poly.length)], k = S.koi[Math.floor(Math.random() * Math.max(1, S.koi.length))]; p = k ? [k.g.position.x, k.g.position.z] : q; }
      r.m.position.x = p[0]; r.m.position.z = p[1]; r.age = 0; r.wait = 2 + Math.random() * 5; }
    const u = Math.min(1, r.age / r.dur); r.m.scale.setScalar(0.3 + u * 1.7); r.m.material.opacity = u >= 1 ? 0 : (1 - u) * 0.55; }
  for (const f of S.flies) { const x = f.cx + Math.sin(t * f.f + f.ph) * 2.1, z = f.cz + Math.cos(t * f.f * 0.8 + f.ph * 1.3) * 2.4, y = 0.35 + Math.sin(t * 1.9 + f.ph) * 0.22 + Math.sin(t * 7 + f.ph) * 0.04;
    f.g.rotation.y = Math.atan2(x - f.px, z - f.pz); f.px = x; f.pz = z; f.g.position.set(x, y, z); const w = 0.25 + Math.abs(Math.sin(t * 13 + f.ph)) * 1.15; f.a.rotation.z = w; f.b.rotation.z = -w; }
  for (const b of S.birds) { b.t -= dt; if (b.t <= 0) { b.t = 1.6 + Math.random() * 4; b.yaw = (Math.random() - 0.5) * 1.9; if (Math.random() < 0.35) { b.hop = 0.34; b.turn = (Math.random() - 0.5) * 1.3; } }
    b.neck.rotation.y += (b.yaw - b.neck.rotation.y) * Math.min(1, dt * 10); b.neck.rotation.x = Math.sin(t * 2.3 + b.y0 * 9) * 0.06;
    if (b.hop > 0) { b.hop -= dt; const u = 1 - Math.max(0, b.hop) / 0.34; b.grp.position.y = b.y0 + Math.sin(Math.PI * u) * 0.11; b.grp.rotation.y += (b.turn * dt) / 0.34; } }
  if (S.glow) S.glow.material.opacity = 0.44 + 0.07 * Math.sin(t * 9.3) + 0.04 * Math.sin(t * 23);
}
function dropPond(S) {
  R.scene.remove(S.grp); const seen = new Set(), shared = R.shade.material.map;
  S.grp.traverse((o) => { if (!o.isMesh && !o.isSprite && !o.isPoints && !o.isLine) return; for (const x of o.isSprite ? [o.material] : [o.geometry, o.material]) if (x && !seen.has(x)) { seen.add(x); x.dispose(); } }); // (every sprite shares one geometry)
  for (const t of S.tex) if (t !== shared && t !== R.FX.dot) t.dispose();
}
// ---------- ตลาดน้ำยามค่ำ: a floating market at night ----------
// The table lies on a plank pier in a dark canal. Paddle boats loaded with baskets of fruit are tied up along it and one
// drifts past behind; paper lanterns hang on cords between poles and on the boats, their light lying in long streaks on
// the water; krathong with a candle each float by, and fireflies wander over the banks. Made here like the garden: one
// batch per repeated thing, no lamp of its own for anything, and water that costs two texture reads.
const MARKET = {
  wide: { boats: [[-6.5, -7.95, 0.05, 0xc8402c], [7.0, -8.0, -0.07, 0x2f9a8c], [-10.5, -3.4, 1.42, 0xe0a63a], [10.9, -2.4, 1.72, 0x4f74c8]], drift: [-9.15, -17, 17, 0.32, 0xb04a7a],
    cords: [[-8.45, -6.95, -2.9, -6.95, 7], [4.9, -6.95, 8.45, -6.95, 5]], lanes: [[-9.55, -7.0, 5.6, 1], [9.6, -7.0, 5.6, 1], [-15, 15, -9.0, 0]], flies: [[-11.5, -5], [10.5, -5], [-6, -8.6]] },
  tall: { boats: [[-3.9, -8.0, 0.05, 0xc8402c], [3.7, -8.1, -0.06, 0x2f9a8c]], drift: [-9.25, -13, 13, 0.3, 0xe0a63a],
    cords: [[-7.45, -6.95, -1.3, -6.95, 7], [1.7, -6.95, 7.45, -6.95, 7]], lanes: [[-12, 12, -8.95, 0], [-12, 12, 7.6, 0], [-12, 12, 9.2, 0]], flies: [[-5, -8.6], [5, -8.6], [0, 8]] } };
function rippleTexture() {
  return canvasTex(256, (g, S) => { g.fillStyle = "#000"; g.fillRect(0, 0, S, S); const rnd = lcg(41);
    for (let k = 0; k < 150; k++) { const x = rnd() * S, y = rnd() * S, w = 10 + rnd() * 36, hh = 1.2 + rnd() * 2.4, a = 0.25 + rnd() * 0.6;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, w); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.save(); g.translate(x + dx, y + dy); g.scale(1, hh / w); g.translate(-x - dx, -y - dy); g.beginPath(); g.arc(x + dx, y + dy, w, 0, 7); g.fill(); g.restore(); } } });
}
function plankTexture() {
  return canvasTex(256, (g, S) => { const rnd = lcg(53), N = 8, hh = S / N; for (let j = 0; j < N; j++) { const v = 96 + Math.floor(rnd() * 34); g.fillStyle = `rgb(${v + 30},${v},${Math.floor(v * 0.66)})`; g.fillRect(0, j * hh, S, hh - 2); g.fillStyle = "#231710"; g.fillRect(0, j * hh + hh - 2, S, 2);
      const cut = Math.floor(rnd() * S); g.fillRect(cut, j * hh, 2, hh); for (let k = 0; k < 40; k++) { g.fillStyle = rnd() < 0.5 ? "rgba(255,230,190,.07)" : "rgba(0,0,0,.1)"; g.fillRect(rnd() * S, j * hh + rnd() * (hh - 3), 8 + rnd() * 30, 1); }
      g.fillStyle = "rgba(20,12,8,.7)"; for (const x of [cut + 7, cut - 7 + S]) { g.beginPath(); g.arc(x % S, j * hh + hh / 2, 1.6, 0, 7); g.fill(); } } });
}
// a paddle boat's hull: ribs from bow to stern, wide in the middle, both ends drawn up; the top strake carries the boat's colour
function boatGeometry(L, W, H, paint) {
  const N = 12, pos = [], col = [], idx = [], wood = new THREE.Color(0x6a4326), top = new THREE.Color(paint);
  for (let i = 0; i <= N; i++) { const u = i / N, e = Math.abs(u - 0.5) * 2, x = (u - 0.5) * L, w = (W / 2) * Math.pow(Math.sin(Math.PI * u), 0.55), yt = H + 0.3 * Math.pow(e, 2.3), yk = 0.02 + 0.24 * Math.pow(e, 3);
    for (const [z, y, c] of [[-w, yt, top], [-w * 0.74, (yt + yk) / 2 - 0.02, wood], [0, yk, wood], [w * 0.74, (yt + yk) / 2 - 0.02, wood], [w, yt, top]]) { pos.push(x, y, z); col.push(c.r, c.g, c.b); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a = i * 5 + j, b = a + 5; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
function buildMarket() {
  const Q = R.Q, low = Q === "low", C = MARKET[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "market"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], boats: [], step: stepMarket }, o = S.o, rnd = lcg(97), T = (t) => { S.tex.push(t); return t; }, col = new THREE.Color();
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  // the canal: black-green water, small lights running over it, warm where the lanterns are
  { const rt = T(rippleTexture()); rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
    S.water = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uRip: { value: rt }, uA: { value: new THREE.Color(0.002, 0.006, 0.012) }, uB: { value: new THREE.Color(0.006, 0.04, 0.06) }, uGlow: { value: new THREE.Color(1.0, 0.42, 0.1) }, uBox: { value: new THREE.Vector3(MW / 2 + 0.85, MD / 2 + 0.85, MZ) }, uFogC: { value: R.scene.fog.color }, uFogD: { value: 0.015 } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `uniform float uT; uniform sampler2D uRip; uniform vec3 uA; uniform vec3 uB; uniform vec3 uGlow; uniform vec3 uBox; uniform vec3 uFogC; uniform float uFogD; varying vec3 vW;
        void main(){ vec2 p = vW.xz; float r1 = texture2D(uRip, p * vec2(0.085, 0.16) + vec2(uT * 0.011, uT * 0.006)).r; float r2 = texture2D(uRip, p * vec2(0.15, 0.27) + vec2(-uT * 0.015, uT * 0.01)).r;
          vec2 q = max(abs(p - vec2(0.0, uBox.z)) - uBox.xy, 0.0); float near = exp(-dot(q, q) * 0.045);
          vec3 col = mix(uA, uB, r1 * 0.7 + near * 0.25) + uGlow * (smoothstep(0.08, 0.45, r1 * r2) * (0.03 + 0.9 * near) + r1 * near * 0.05);
          float d = length(cameraPosition - vW); col = mix(col, uFogC, 1.0 - exp(-uFogD * uFogD * d * d));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }` });
    flat(new THREE.PlaneGeometry(70, 50), S.water, G).position.z = -2; }
  // the pier under the table, lamplight pooled at its far corners
  { const pt = T(plankTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(5, 6); const deck = new THREE.Mesh(new THREE.BoxGeometry(MW + 1.7, 0.1, MD + 1.7), new THREE.MeshBasicMaterial({ map: pt, color: 0x9a8068 })); deck.position.set(0, G + 0.05, MZ); grp.add(deck);
    const glow = new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0xff9a3c, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-1, 1]) { const m = flat(new THREE.PlaneGeometry(4.6, 4.6), glow, G + 0.104, 2); m.position.set(sx * (MW / 2 + 0.5), G + 0.104, MZ - MD / 2 - 0.5); } S.pool = glow;
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 7), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9, metalness: 0 }), 8); let k = 0;
    for (const sx of [-1, 1]) for (const [fz, fx] of [[-1, 1], [1, 1], [-1, 0.33], [1, 0.33]]) { o.position.set(sx * fx * (MW / 2 + 0.78), G + 0.3, MZ + fz * (MD / 2 + 0.78)); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); post.setMatrixAt(k++, o.matrix); } grp.add(post); }
  // paper lanterns on cords between poles; their glow is one cloud of points, their light on the water one batch of streaks
  const lamps = [], LC = [0xff4426, 0xff9a1e, 0xffc832, 0xff4f86, 0xff7a1e];
  { const pole = new THREE.MeshStandardMaterial({ color: 0x4a2f1e, roughness: 0.9, metalness: 0 }), pg = new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6), lm = new THREE.LineBasicMaterial({ color: 0x1a120c });
    for (const [x0, z0, x1, z1, n] of C.cords) { for (const [x, z] of [[x0, z0], [x1, z1]]) { const p = new THREE.Mesh(pg, pole); p.position.set(x, G + 1.2, z); grp.add(p); }
      const pts = []; for (let i = 0; i <= 16; i++) { const s = i / 16; pts.push(new THREE.Vector3(x0 + (x1 - x0) * s, G + 2.3 - 0.5 * 4 * s * (1 - s), z0 + (z1 - z0) * s)); } grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm));
      for (let i = 0; i < n; i++) { const s = (i + 0.5) / n; lamps.push([x0 + (x1 - x0) * s, G + 2.3 - 0.5 * 4 * s * (1 - s) - 0.2, z0 + (z1 - z0) * s, LC[(i + lamps.length) % LC.length], 1]); } } }
  // boats tied up along the pier, each with baskets of fruit and a lantern on a pole at the stern
  const fruit = [0xff8a2a, 0xf2c43a, 0x8ac44a, 0xe2453a, 0xc86ad2], bask = new THREE.CylinderGeometry(0.2, 0.15, 0.17, 8, 1, true), ball = new THREE.SphereGeometry(0.075, 6, 5), reed = new THREE.MeshStandardMaterial({ color: 0xb8925a, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }), skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
  const hat = new THREE.ConeGeometry(0.26, 0.13, 10), straw = new THREE.MeshStandardMaterial({ color: 0xd8bc7a, roughness: 0.9, metalness: 0 }), rod = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 5), dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 }), bulb = new THREE.SphereGeometry(0.13, 8, 6);
  const boat = (x, z, ry, paint, i) => { const b = new THREE.Group(); b.position.set(x, G - 0.02, z); b.rotation.y = ry; grp.add(b);
    const hull = new THREE.Mesh(boatGeometry(3.7, 0.86, 0.36, paint), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 })); b.add(hull);
    const nb = low ? 2 : 3, bs = new THREE.InstancedMesh(bask, reed, nb), fr = new THREE.InstancedMesh(ball, skin, nb * 6); let k = 0;
    for (let j = 0; j < nb; j++) { const bx = -0.75 + j * 0.62 + (rnd() - 0.5) * 0.1; o.position.set(bx, 0.2, (rnd() - 0.5) * 0.12); o.rotation.set(0, rnd() * 6, 0); o.scale.setScalar(0.95 + rnd() * 0.25); o.updateMatrix(); bs.setMatrixAt(j, o.matrix); const fc = fruit[(i + j) % fruit.length];
      for (let f = 0; f < 6; f++) { const a = f * 1.05, r = f < 5 ? 0.1 : 0; o.position.set(bx + Math.cos(a) * r, 0.3 + (f < 5 ? 0 : 0.07), Math.sin(a) * r); o.scale.setScalar(0.9 + rnd() * 0.3); o.updateMatrix(); fr.setMatrixAt(k, o.matrix); fr.setColorAt(k++, col.setHex(fc).multiplyScalar(0.85 + rnd() * 0.3)); } }
    b.add(bs, fr); const h = new THREE.Mesh(hat, straw); h.position.set(0.95, 0.33, 0.05); h.rotation.z = 0.25; b.add(h);
    const p = new THREE.Mesh(rod, dark); p.position.set(-1.45, 0.72, 0); b.add(p); const lc = LC[(i + 1) % LC.length], l = new THREE.Mesh(bulb, new THREE.MeshBasicMaterial({ color: lc, toneMapped: false })); l.scale.set(1, 1.25, 1); l.position.set(-1.45, 1.12, 0); b.add(l);
    const gl = sprite(R.FX.dot, lc, 1.7, new THREE.Vector3(-1.45, 1.12, 0), 0.4, b); lamps.push([x - 1.45 * Math.cos(ry), G + 1.1, z + 1.45 * Math.sin(ry), lc, 0]); const st = { b, gl, ph: i * 1.7, y0: G - 0.02 }; S.boats.push(st); return st; };
  C.boats.slice(0, low ? 2 : 9).forEach(([x, z, ry, paint], i) => boat(x, z, ry, paint, i));
  if (!reduce) { const [dz, x0, x1, v, paint] = C.drift; S.drift = Object.assign(boat(x0 + (x1 - x0) * 0.3, dz, 0.02, paint, 5), { x0, x1, v }); }
  { const n = lamps.length, body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n), pp = new Float32Array(n * 3), pc = new Float32Array(n * 3);
    const streak = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: R.FX.dot, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    lamps.forEach(([x, y, z, c, own], i) => { o.position.set(x, own ? y : -50, z); o.rotation.set(0, 0, 0); o.scale.set(1, 1.3, 1); o.updateMatrix(); body.setMatrixAt(i, o.matrix); body.setColorAt(i, col.setHex(c)); pp.set([x, own ? y : -50, z], i * 3); pc.set([col.r, col.g, col.b], i * 3);
      o.position.set(x, G + 0.012, z - 0.75); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.set(0.8, 2.6, 1); o.updateMatrix(); streak.setMatrixAt(i, o.matrix); streak.setColorAt(i, col); });
    o.rotation.set(0, 0, 0); streak.renderOrder = 2; grp.add(body, streak); S.streak = streak.material;
    const pgm = new THREE.BufferGeometry(); pgm.setAttribute("position", new THREE.BufferAttribute(pp, 3)); pgm.setAttribute("color", new THREE.BufferAttribute(pc, 3));
    S.halo = new THREE.Points(pgm, new THREE.PointsMaterial({ map: R.FX.dot, size: 1.15, vertexColors: true, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false })); grp.add(S.halo); }
  // krathong drifting with the current, a candle on each
  { const n = low ? 5 : Q === "mid" ? 9 : 14, per = 8, pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.13, 0.2, 0.05, 0, 0.44, 0.1, -0.13, 0.2, 0.05], 3)); pg.setIndex([0, 1, 2, 0, 2, 3]); pg.computeVertexNormals();
    const leaf = new THREE.InstancedMesh(new THREE.CircleGeometry(0.34, 10), new THREE.MeshBasicMaterial({ color: 0x2f7a44 }), n), pet = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0, emissive: 0x5a2410, emissiveIntensity: 0.22 }), n * per);
    const KC = [[1, 0.3, 0.46], [1, 0.86, 0.62], [1, 0.5, 0.12]]; for (let i = 0; i < n * per; i++) { const c = KC[Math.floor(i / per) % 3]; pet.setColorAt(i, col.setRGB(c[0], c[1], c[2])); }
    for (const m of [leaf, pet]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; grp.add(m); } leaf.renderOrder = 1;
    const fp = new Float32Array(n * 3), fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    const flame = new THREE.Points(fg, new THREE.PointsMaterial({ map: R.FX.dot, color: 0xffa040, size: 0.55, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); flame.frustumCulled = false; grp.add(flame);
    S.kr = { leaf, pet, flame, fp, per, st: Array.from({ length: n }, (_, i) => ({ lane: C.lanes[i % C.lanes.length], u: rnd(), v: 0.012 + rnd() * 0.012, off: (rnd() - 0.5) * 0.7, ph: rnd() * 6.28, spin: rnd() * 6.28 })) }; }
  // fireflies over the banks
  if (!reduce) { const n = low ? 8 : 26, fp = new Float32Array(n * 3), fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    const pts = new THREE.Points(fg, new THREE.PointsMaterial({ map: R.FX.dot, color: 0xd8ff7a, size: 0.26, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; grp.add(pts);
    S.fly = { pts, fp, st: Array.from({ length: n }, (_, i) => { const [cx, cz] = C.flies[i % C.flies.length]; return { cx: cx + (rnd() - 0.5) * 4, cz: cz + (rnd() - 0.5) * 3, ph: rnd() * 6.28, f: 0.25 + rnd() * 0.4 }; }) }; }
  return S;
}
function stepMarket(S, dt, t) {
  S.water.uniforms.uT.value = t; const o = S.o, G = -0.335;
  for (const b of S.boats) { b.b.position.y = b.y0 + Math.sin(t * 1.1 + b.ph) * 0.022; b.b.rotation.x = Math.sin(t * 0.85 + b.ph) * 0.04; b.gl.material.opacity = 0.36 + 0.06 * Math.sin(t * 8 + b.ph); }
  if (S.drift) { const d = S.drift; d.b.position.x += d.v * dt; if (d.b.position.x > d.x1) d.b.position.x = d.x0; }
  S.streak.opacity = 0.46 + 0.07 * Math.sin(t * 2.3) + 0.04 * Math.sin(t * 5.1); S.halo.material.opacity = 0.34 + 0.04 * Math.sin(t * 6.7); S.pool.opacity = 0.32 + 0.04 * Math.sin(t * 7.9);
  if (S.kr) { const K = S.kr; K.st.forEach((k, i) => { k.u += k.v * dt; if (k.u > 1) k.u -= 1; const [a, b, c, alongZ] = k.lane; const x = alongZ ? a + k.off + Math.sin(t * 0.4 + k.ph) * 0.15 : a + (b - a) * k.u, z = alongZ ? b + (c - b) * k.u : c + k.off * 0.5 + Math.sin(t * 0.4 + k.ph) * 0.12, y = G + 0.016 + Math.sin(t * 1.6 + k.ph) * 0.008, sp = k.spin + t * 0.12;
      o.rotation.order = "XYZ"; o.position.set(x, y, z); o.rotation.set(-Math.PI / 2, 0, sp); o.scale.setScalar(1); o.updateMatrix(); K.leaf.setMatrixAt(i, o.matrix); o.rotation.order = "YXZ";
      for (let j = 0; j < K.per; j++) { o.position.set(x, y + 0.01, z); o.rotation.set(0.86, sp + (j / K.per) * 6.2832, 0); o.scale.setScalar(0.74); o.updateMatrix(); K.pet.setMatrixAt(i * K.per + j, o.matrix); }
      K.fp[i * 3] = x; K.fp[i * 3 + 1] = y + 0.24; K.fp[i * 3 + 2] = z; });
    o.rotation.order = "XYZ"; o.rotation.set(0, 0, 0); K.leaf.instanceMatrix.needsUpdate = K.pet.instanceMatrix.needsUpdate = true; K.flame.geometry.attributes.position.needsUpdate = true; K.flame.material.opacity = 0.8 + 0.15 * Math.sin(t * 11); }
  if (S.fly) { const F = S.fly; F.st.forEach((f, i) => { F.fp[i * 3] = f.cx + Math.sin(t * f.f + f.ph) * 1.6 + Math.sin(t * f.f * 2.3 + f.ph) * 0.4; F.fp[i * 3 + 1] = 0.35 + Math.sin(t * f.f * 1.7 + f.ph * 2) * 0.3 + 0.3; F.fp[i * 3 + 2] = f.cz + Math.cos(t * f.f * 0.8 + f.ph) * 1.3; });
    F.pts.geometry.attributes.position.needsUpdate = true; F.pts.material.opacity = 0.55 + 0.4 * Math.abs(Math.sin(t * 1.3)); }
}
// ---------- นรกภูมิ: the hell realm ----------
// Black basalt split by cracks of lava that brighten and dim, a river of lava behind the table, rock spires along its bank
// and out in the margins, a ruined gate standing in the lava with chains that sway, braziers burning at the corners of the
// stone the table lies on, bubbles bursting on the river and embers rising everywhere. The ground and the river each read
// one small texture made here; every repeated thing is one batch and nothing has a lamp of its own.
const HELL = {
  wide: { river: [[-15, -7.9], [-10, -7.4], [-5, -7.3], [0, -7.35], [5, -7.3], [10, -7.4], [15, -7.9], [15.6, -10.5], [13, -12], [8, -12.4], [0, -12.6], [-8, -12.4], [-14, -12], [-15.6, -10.2]],
    gate: [-8.0, -4.4, -8.05], beds: [[-13, -8.9, -7.0, 4.8], [8.9, 13, -7.0, 4.8]], braz: [[-8.2, -6.5], [8.2, -6.5], [-8.2, 6.1], [8.2, 6.1]], bub: [-11, 9.4, -8.6, -7.7] },
  tall: { river: [[-10, -8.2], [-5, -7.6], [0, -7.5], [5, -7.6], [10, -8.2], [11, -10.5], [8, -12.5], [0, -13], [-8, -12.5], [-11, -10.5]],
    gate: [-3.2, 0.4, -8.4], beds: [[-8, 8, 6.7, 9.6]], braz: [[-7.3, -6.5], [7.3, -6.5], [-7.3, 6.1], [7.3, 6.1]], bub: [-7.4, 7.4, -9.2, -7.9] } };
// basalt cells: R = how near a crack, G = the cell's own beat, B = how light its rock is (plain numbers, not a picture's colours)
function crackTexture() {
  const S = 256, N = 7, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), img = g.createImageData(S, S), d = img.data, rnd = lcg(131), pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.12 + rnd() * 0.76) / N, (j + 0.12 + rnd() * 0.76) / N, rnd(), 0.5 + rnd() * 0.5]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / S, v = y / S, ci = Math.floor(u * N), cj = Math.floor(v * N); let d1 = 9, d2 = 9, id = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const q = ((cj + b + N) % N) * N + ((ci + a + N) % N), p = pts[q]; let dx = p[0] - u, dy = p[1] - v; dx -= Math.round(dx); dy -= Math.round(dy); const dd = Math.hypot(dx, dy); if (dd < d1) { d2 = d1; d1 = dd; id = q; } else if (dd < d2) d2 = dd; }
    const e = (d2 - d1) * N, edge = Math.max(0, 1 - e / 0.17), k = (y * S + x) * 4; d[k] = 255 * edge * edge; d[k + 1] = 255 * pts[id][2]; d[k + 2] = 255 * pts[id][3] * (0.7 + 0.3 * Math.min(1, e * 2.2)); d[k + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function buildHell() {
  const Q = R.Q, low = Q === "low", C = HELL[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "hell"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], flames: [], rings: [], chains: [], step: stepHell }, o = S.o, rnd = lcg(151), T = (t) => { S.tex.push(t); return t; }, col = new THREE.Color();
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  const VS = "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }", FOG = "float d = length(cameraPosition - vW); col = mix(col, uFogC, 1.0 - exp(-uFogD * uFogD * d * d)); gl_FragColor = vec4(col, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n";
  const fogU = { uT: { value: 0 }, uFogC: { value: R.scene.fog.color }, uFogD: { value: 0.02 } };
  // the ground: every crack glows to its own slow beat
  S.ground = new THREE.ShaderMaterial({ uniforms: { ...fogU, uMap: { value: T(crackTexture()) } }, vertexShader: VS,
    fragmentShader: `uniform float uT; uniform sampler2D uMap; uniform vec3 uFogC; uniform float uFogD; varying vec3 vW;
      void main(){ vec3 m = texture2D(uMap, vW.xz * 0.105).rgb; float beat = 0.3 + 0.7 * (0.5 + 0.5 * sin(uT * 0.9 + m.g * 6.2831 + vW.x * 0.25)); float glow = m.r * beat;
        vec3 col = vec3(0.016, 0.012, 0.014) * (0.5 + m.b) + vec3(1.0, 0.16, 0.012) * glow * 1.25 + vec3(1.0, 0.7, 0.2) * glow * glow * glow * 1.4 + vec3(0.2, 0.02, 0.0) * smoothstep(0.0, 0.5, m.r) * 0.25;
        ${FOG} }` });
  flat(new THREE.PlaneGeometry(70, 50), S.ground, G).position.z = -2;
  // the dark stone the table lies on, lit along its far edge by the river
  { const pt = T(paverTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(7, 5.5); flat(new THREE.PlaneGeometry(MW + 1.7, MD + 1.7), new THREE.MeshBasicMaterial({ map: pt, color: 0x5c4444 }), G + 0.006, 1).position.z = MZ;
    const gt = T(canvasTex(64, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "rgba(255,120,30,.95)"); gr.addColorStop(1, "rgba(255,90,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, s, s); }));
    S.rim = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }); const m = flat(new THREE.PlaneGeometry(MW + 6, 2.6), S.rim, G + 0.01, 2); m.position.set(0, G + 0.01, MZ - MD / 2 - 0.05); }
  // the river of lava and its dark bank
  const out = new THREE.CatmullRomCurve3(C.river.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal").getPoints(80).map((p) => [p.x, p.z]); S.poly = out;
  const cx = out.reduce((a, p) => a + p[0], 0) / out.length, cz = out.reduce((a, p) => a + p[1], 0) / out.length;
  const shape = (grow) => new THREE.ShapeGeometry(new THREE.Shape(out.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return new THREE.Vector2(x + (dx / d) * grow, -(z + (dz / d) * grow)); })));
  flat(shape(0.22), new THREE.MeshBasicMaterial({ color: 0x1a0a08 }), G + 0.003, 1);
  { const rt = T(rippleTexture()); rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
    S.lava = new THREE.ShaderMaterial({ uniforms: { ...fogU, uRip: { value: rt } }, vertexShader: VS,
      fragmentShader: `uniform float uT; uniform sampler2D uRip; uniform vec3 uFogC; uniform float uFogD; varying vec3 vW;
        void main(){ vec2 p = vW.xz; float n = texture2D(uRip, p * vec2(0.06, 0.12) + vec2(uT * 0.02, 0.0)).r * 0.75 + texture2D(uRip, p * vec2(0.11, 0.21) + vec2(uT * 0.034, uT * 0.004)).r * 0.6;
          vec3 col = mix(vec3(0.3, 0.025, 0.0), vec3(1.0, 0.3, 0.02), smoothstep(0.04, 0.5, n)) + vec3(1.0, 0.72, 0.2) * smoothstep(0.45, 0.95, n);
          ${FOG} }` }); flat(shape(0), S.lava, G + 0.006, 3); }
  const hot = (x, z) => inPoly(x, z, out), dry = (x, z) => !hot(x, z) && !(Math.abs(x) < MW / 2 + 1.0 && Math.abs(z - MZ) < MD / 2 + 1.0);
  const rock = new THREE.MeshStandardMaterial({ color: 0x1f1719, roughness: 0.95, metalness: 0, flatShading: true, emissive: 0x3a0a02, emissiveIntensity: 0.5 });
  // spires: small ones along the near bank, tall ones out in the margins
  { const spots = []; for (let i = 0; i < out.length; i += low ? 4 : 2) { const [x, z] = out[i]; if (z < -8.3 || Math.abs(x) > 13.5) continue; spots.push([x + (rnd() - 0.5) * 0.3, z + 0.14 + rnd() * 0.1, 0.16 + rnd() * 0.16, 0.3 + rnd() * 0.75]); }
    const n = low ? 10 : Q === "mid" ? 18 : 30; for (let t = 0; t < n * 8 && spots.length < 200 && t < 400; t++) { const b = C.beds[Math.floor(rnd() * C.beds.length)], x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (dry(x, z) && spots.filter((s) => s[4]).length < n) spots.push([x, z, 0.22 + rnd() * 0.3, 0.6 + rnd() * 1.7, 1]); }
    const geo = new THREE.ConeGeometry(1, 1, 5); geo.translate(0, 0.5, 0); const sp = new THREE.InstancedMesh(geo, rock, spots.length);
    spots.forEach(([x, z, r, hh], i) => { o.position.set(x, G, z); o.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.3); o.scale.set(r, hh, r); o.updateMatrix(); sp.setMatrixAt(i, o.matrix); const v = 0.75 + rnd() * 0.5; sp.setColorAt(i, col.setRGB(v, v * 0.9, v * 0.9)); });
    o.rotation.set(0, 0, 0); sp.castShadow = Q === "high"; grp.add(sp); }
  // the ruined gate: two pillars in the lava, half a lintel left on one, chains hanging from it
  { const [x0, x1, gz] = C.gate, box = new THREE.BoxGeometry(1, 1, 1), parts = [[x0, 1.3, gz, 0.72, 2.9, 0.72, 0], [x1, 0.95, gz, 0.72, 2.2, 0.72, 0.05], [x0, 2.85, gz, 0.95, 0.24, 0.95, 0], [x0 + 1.25, 3.12, gz, 3.0, 0.5, 0.78, -0.07], [x1 + 0.7, 0.16, gz + 0.5, 0.8, 0.5, 0.6, 0.5], [x0 - 0.1, 0.1, gz + 0.62, 0.5, 0.3, 0.4, 0.2], [x1, 2.12, gz, 0.9, 0.2, 0.9, 0.12]];
    const gm = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x2a2023, roughness: 0.95, metalness: 0, flatShading: true, emissive: 0x4a0e03, emissiveIntensity: 0.5 }), parts.length);
    parts.forEach(([x, y, z, sx, sy, sz, a], i) => { o.position.set(x, G + y, z); o.rotation.set(0, a * 0.6, a); o.scale.set(sx, sy, sz); o.updateMatrix(); gm.setMatrixAt(i, o.matrix); }); o.rotation.set(0, 0, 0); gm.castShadow = Q === "high"; grp.add(gm);
    const iron = new THREE.MeshStandardMaterial({ color: 0x8a8088, roughness: 0.5, metalness: 0.6 }), link = new THREE.BoxGeometry(0.09, 0.2, 0.035);
    [[x0 + 0.95, 8], [x0 + 2.2, 6]].slice(0, low ? 1 : 2).forEach(([x, n], i) => { const ch = new THREE.Group(); ch.position.set(x, G + 2.86, gz + 0.1); const m = new THREE.InstancedMesh(link, iron, n);
      for (let k = 0; k < n; k++) { o.position.set(0, -0.09 - k * 0.165, 0); o.rotation.set(0, k % 2 ? Math.PI / 2 : 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); m.setMatrixAt(k, o.matrix); } ch.add(m); grp.add(ch); S.chains.push({ g: ch, ph: i * 1.9 }); }); o.rotation.set(0, 0, 0); }
  // braziers at the corners of the stone
  { const bowl = new THREE.CylinderGeometry(0.34, 0.2, 0.26, 8), leg = new THREE.CylinderGeometry(0.1, 0.16, 0.5, 6), bm = new THREE.InstancedMesh(bowl, rock, C.braz.length), lm = new THREE.InstancedMesh(leg, rock, C.braz.length);
    C.braz.forEach(([x, z], i) => { o.position.set(x, G + 0.63, z); o.scale.set(1, 1, 1); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); o.position.y = G + 0.25; o.updateMatrix(); lm.setMatrixAt(i, o.matrix); bm.setColorAt(i, col.setRGB(1, 0.92, 0.9)); lm.setColorAt(i, col); // (one material: every batch that shares it carries colours)
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.flameTex, color: 0xffb070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.set(x, G + 1.15, z); f.scale.set(0.55, 1.0, 1); grp.add(f);
      const hl = sprite(R.FX.dot, 0xff6a20, 2.6, new THREE.Vector3(x, G + 1.0, z), 0.4, grp); S.flames.push({ f, hl, ph: i * 2.7 }); }); grp.add(bm, lm); }
  // bubbles bursting on the river, embers rising over everything
  { const rt = T(ringTexture()); for (let i = 0; i < (low ? 1 : 4); i++) { const m = flat(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, color: 0xffd070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), G + 0.012, 5); S.rings.push({ m, age: 9, dur: 1.3, wait: 0.5 + i * 0.9 }); } S.bub = C.bub;
    const n = reduce ? 0 : low ? 18 : Q === "mid" ? 44 : 90; if (n) { const fp = new Float32Array(n * 3), fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
      const pts = new THREE.Points(fg, new THREE.PointsMaterial({ map: R.FX.dot, color: 0xff6a1a, size: 0.2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; grp.add(pts);
      S.emb = { pts, fp, st: Array.from({ length: n }, () => ({ x: -13 + Math.random() * 26, z: -12 + Math.random() * 20, y: Math.random() * 6, v: 0.25 + Math.random() * 0.6, ph: Math.random() * 6.28 })) }; } }
  return S;
}
function stepHell(S, dt, t) {
  S.ground.uniforms.uT.value = t; S.lava.uniforms.uT.value = t; S.rim.opacity = 0.46 + 0.07 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 4.3);
  for (const c of S.chains) c.g.rotation.z = Math.sin(t * 0.9 + c.ph) * 0.07;
  for (const b of S.flames) { const f = 1 + 0.1 * Math.sin(t * 12 + b.ph) + 0.07 * Math.sin(t * 7.1 + b.ph * 2) + Math.random() * 0.04; b.f.scale.set(0.55 * (2 - f), 1.0 * f, 1); b.hl.material.opacity = 0.36 * f; }
  for (const r of S.rings) { r.age += dt; if (r.age > r.dur + r.wait) { const [x0, x1, z0, z1] = S.bub; let x = 0, z = 0; for (let n = 0; n < 10; n++) { x = x0 + Math.random() * (x1 - x0); z = z0 + Math.random() * (z1 - z0); if (inPoly(x, z, S.poly)) break; } r.m.position.x = x; r.m.position.z = z; r.age = 0; r.wait = 0.4 + Math.random() * 2.2; }
    const u = Math.min(1, r.age / r.dur); r.m.scale.setScalar(0.15 + u * 0.75); r.m.material.opacity = u >= 1 ? 0 : (1 - u) * 0.9; }
  if (S.emb) { const E2 = S.emb; for (let i = 0; i < E2.st.length; i++) { const e = E2.st[i]; e.y += e.v * dt; if (e.y > 7) { e.y = 0; e.x = -13 + Math.random() * 26; e.z = -12 + Math.random() * 20; } E2.fp[i * 3] = e.x + Math.sin(t * 0.8 + e.ph) * 0.3; E2.fp[i * 3 + 1] = e.y; E2.fp[i * 3 + 2] = e.z + Math.cos(t * 0.6 + e.ph) * 0.2; }
    E2.pts.geometry.attributes.position.needsUpdate = true; E2.pts.material.opacity = 0.8 + 0.15 * Math.sin(t * 9); }
}
// ---------- ป่าหิมพานต์: the Himmapan forest at dusk ----------
// Moss underfoot, great trunks with buttress roots at the sides and their leaves hanging into view, a spring fed by a small
// waterfall, ferns, mushrooms and flowers that glow, shafts of light through the canopy, fireflies and drifting spores.
const FOREST = {
  wide: { trunks: [[-10.7, -5.3, 0.8, 11], [9.9, -7.7, 0.8, 13]], pool: [[-9.2, -7.35], [-7, -7.15], [-4.5, -7.2], [-3.3, -7.7], [-4, -8.3], [-6.5, -8.5], [-8.8, -8.45], [-9.7, -7.9]], fall: [-9.3, -8.05], fh: 0.5,
    beds: [[-13, -8.8, -7.0, 4.8], [8.8, 13, -7.0, 4.8], [-3, 9, -7.5, -6.95]], shafts: [[-9.6, -3.6], [-5.6, -7.9], [7.4, -7.6], [10.4, -1.2]], flies: [[-10.5, -3], [6, -8], [10.5, -4]] },
  tall: { trunks: [[-5.3, -9.0, 0.7, 11], [5.5, -9.1, 0.7, 13]], fh: 1, pool: [[-3.6, -7.7], [-1, -7.45], [1.6, -7.6], [2.6, -8.3], [1.8, -9.1], [-1, -9.4], [-3.4, -9.2], [-4.4, -8.4]], fall: [-0.9, -9.25],
    beds: [[-7.5, 7.5, -7.5, -6.95], [-7.5, 7.5, 6.7, 9.6]], shafts: [[-4, -7.9], [3.6, -8.1], [0.5, 7.6]], flies: [[-4, -8], [4, -8], [0, 8]] } };
function fallTexture() { return canvasTex(128, (g, S) => { g.fillStyle = "#000"; g.fillRect(0, 0, S, S); const rnd = lcg(61); for (let k = 0; k < 70; k++) { const x = rnd() * S, y = rnd() * S, l = 20 + rnd() * 60; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${0.3 + rnd() * 0.6})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; for (const dy of [-S, 0]) g.fillRect(x, y + dy, 1.5 + rnd() * 3, l); }
    const ed = g.createLinearGradient(0, 0, S, 0); ed.addColorStop(0, "rgba(0,0,0,1)"); ed.addColorStop(0.25, "rgba(0,0,0,0)"); ed.addColorStop(0.75, "rgba(0,0,0,0)"); ed.addColorStop(1, "rgba(0,0,0,1)"); g.fillStyle = ed; g.fillRect(0, 0, S, S); }); }
function shaftTexture() { return canvasTex(64, (g, S) => { const v = g.createLinearGradient(0, 0, 0, S); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(0.45, "rgba(255,255,255,.45)"); v.addColorStop(0.85, "rgba(255,255,255,.95)"); v.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = v; g.fillRect(0, 0, S, S); g.globalCompositeOperation = "destination-in"; const hgr = g.createLinearGradient(0, 0, S, 0); hgr.addColorStop(0, "rgba(0,0,0,0)"); hgr.addColorStop(0.5, "rgba(0,0,0,1)"); hgr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = hgr; g.fillRect(0, 0, S, S); }); }
// points of light that wander (fireflies) or rise (spores, embers): [object, stepper]
function lightPoints(grp, n, color, size, rise, spots) {
  const fp = new Float32Array(n * 3), fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  const pts = new THREE.Points(fg, new THREE.PointsMaterial({ map: R.FX.dot, color, size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; grp.add(pts);
  const st = Array.from({ length: n }, (_, i) => { const c = spots ? spots[i % spots.length] : null; return { x: c ? c[0] + (Math.random() - 0.5) * 4 : -13 + Math.random() * 26, z: c ? c[1] + (Math.random() - 0.5) * 3 : -12 + Math.random() * 21, y: Math.random() * 6, v: rise * (0.5 + Math.random()), ph: Math.random() * 6.28, f: 0.25 + Math.random() * 0.4 }; });
  return (dt, t) => { for (let i = 0; i < n; i++) { const e = st[i];
      if (rise) { e.y += e.v * dt; if (e.y > 7) { e.y = 0; e.x = -13 + Math.random() * 26; e.z = -12 + Math.random() * 21; } fp[i * 3] = e.x + Math.sin(t * 0.8 + e.ph) * 0.3; fp[i * 3 + 1] = e.y; fp[i * 3 + 2] = e.z + Math.cos(t * 0.6 + e.ph) * 0.2; }
      else { fp[i * 3] = e.x + Math.sin(t * e.f + e.ph) * 1.6 + Math.sin(t * e.f * 2.3 + e.ph) * 0.4; fp[i * 3 + 1] = 0.65 + Math.sin(t * e.f * 1.7 + e.ph * 2) * 0.3; fp[i * 3 + 2] = e.z + Math.cos(t * e.f * 0.8 + e.ph) * 1.3; } }
    fg.attributes.position.needsUpdate = true; pts.material.opacity = rise ? 0.8 + 0.15 * Math.sin(t * 9) : 0.55 + 0.4 * Math.abs(Math.sin(t * 1.3)); };
}
// a brazier bowl on a foot at each spot, a flame and its glow over it: returns what flickers
const blueFlame = () => R.flameB || (R.flameB = flameTexture(true)); // made once, the first time the owner's fire is wanted
function braziers(grp, spots, G, mat, flameCol, glowCol, o, tex = R.flameTex) {
  const bm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.2, 0.26, 8), mat, spots.length), lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 6), mat, spots.length), col = new THREE.Color(1, 0.94, 0.92), out = [];
  spots.forEach(([x, z], i) => { o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.position.set(x, G + 0.63, z); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); o.position.y = G + 0.25; o.updateMatrix(); lm.setMatrixAt(i, o.matrix); bm.setColorAt(i, col); lm.setColorAt(i, col);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: flameCol, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.set(x, G + 1.15, z); f.scale.set(0.55, 1.0, 1); grp.add(f);
    out.push({ f, hl: sprite(R.FX.dot, glowCol, 2.6, new THREE.Vector3(x, G + 1.0, z), 0.4, grp), ph: i * 2.7 }); }); grp.add(bm, lm); return out;
}
const flicker = (list, t) => { for (const b of list) { const f = 1 + 0.1 * Math.sin(t * 12 + b.ph) + 0.07 * Math.sin(t * 7.1 + b.ph * 2) + Math.random() * 0.04; b.f.scale.set(0.55 * (2 - f), 1.0 * f, 1); b.hl.material.opacity = 0.36 * f; } };
function buildForest() {
  const Q = R.Q, low = Q === "low", C = FOREST[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "forest"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], rings: [], steps: [], step: stepForest }, o = S.o, rnd = lcg(211), T = (t) => { S.tex.push(t); return t; }, col = new THREE.Color();
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  // moss as far as the eye goes, a mossy stone platform under the table
  { const gt = T(grassTexture()); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(7, 5); gt.anisotropy = 8; const tg = new THREE.PlaneGeometry(70, 50, 28, 20), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3);
    for (let k = 0; k < tp.count; k++) { const d = Math.hypot(tp.getX(k) / 1.3, tp.getY(k) + 1.5), v = 0.11 + 0.27 * Math.exp(-(Math.max(0, d - 7) ** 2) / 120); tc[k * 3] = v * 0.55; tc[k * 3 + 1] = v; tc[k * 3 + 2] = v * 0.86; }
    tg.setAttribute("color", new THREE.BufferAttribute(tc, 3)); flat(tg, new THREE.MeshBasicMaterial({ map: gt, vertexColors: true }), G).position.z = -2;
    const pt = T(paverTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(7, 5.5); flat(new THREE.PlaneGeometry(MW + 1.7, MD + 1.7), new THREE.MeshBasicMaterial({ map: pt, color: 0x4f6f62 }), G + 0.006, 1).position.z = MZ;
    flat(new THREE.PlaneGeometry(MW + 3.2, MD + 3.2), new THREE.MeshBasicMaterial({ map: R.shade.material.map, transparent: true, opacity: 0.55, depthWrite: false }), G + 0.004, 1).position.z = MZ; }
  // the spring and the fall that feeds it, rocks behind
  const out = new THREE.CatmullRomCurve3(C.pool.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal").getPoints(48).map((p) => [p.x, p.z]); S.poly = out;
  const cx = out.reduce((a, p) => a + p[0], 0) / out.length, cz = out.reduce((a, p) => a + p[1], 0) / out.length;
  const shape = (grow) => new THREE.ShapeGeometry(new THREE.Shape(out.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1; return new THREE.Vector2(x + (dx / d) * grow, -(z + (dz / d) * grow)); })));
  flat(shape(0.2), new THREE.MeshBasicMaterial({ color: 0x2c4a3a }), G + 0.003, 1); S.water = cellWater(low, 0x08463f, 0x22b092, 0xc8ffe8, 0.02, 0.45); flat(shape(0), S.water, G + 0.006, 3);
  const stone = new THREE.MeshStandardMaterial({ color: 0x3c4a44, roughness: 0.95, metalness: 0, flatShading: true }), [fx, fz] = C.fall, fh = C.fh;
  { const spots = [[-1.5, -0.2, 0.9, 1.9], [-0.5, -0.45, 1.0, 2.6], [0.6, -0.4, 0.95, 2.3], [1.6, -0.15, 0.8, 1.6], [-2.4, 0.1, 0.6, 1.0], [2.5, 0.2, 0.55, 0.9]].map(([x, z, s, hh]) => [fx + x * fh, fz + z * fh, s * fh, hh * fh]);
    for (const b of C.beds) for (let k = 0; k < (low ? 1 : 3); k++) { const x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (!inPoly(x, z, out)) spots.push([x, z, 0.3 + rnd() * 0.35, 0.25 + rnd() * 0.3]); }
    const rk = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), stone, spots.length); spots.forEach(([x, z, s, hh], i) => { o.position.set(x, G + hh * 0.45, z); o.rotation.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4); o.scale.set(s, hh, s * 0.8); o.updateMatrix(); rk.setMatrixAt(i, o.matrix); const v = 0.75 + rnd() * 0.4; rk.setColorAt(i, col.setRGB(v * 0.9, v, v * 0.92)); });
    o.rotation.set(0, 0, 0); grp.add(rk);
    const ft = T(fallTexture()); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1, 1.6); S.fall = ft;
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(1.15 * fh, 3.6 * fh), new THREE.MeshBasicMaterial({ map: ft, color: 0xbff4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); fm.position.set(fx, G + 1.8 * fh, fz + 0.62 * fh); fm.rotation.x = -0.12; grp.add(fm);
    S.mist = sprite(R.FX.dot, 0xbfeee6, 2.4 * fh, new THREE.Vector3(fx, G + 0.3 * fh, fz + 0.9 * fh), 0.32, grp); S.mistS = fh;
    const rt = T(ringTexture()); for (let i = 0; i < (low ? 1 : 3); i++) { const m = flat(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, color: 0xdffff4, transparent: true, opacity: 0, depthWrite: false }), G + 0.012, 5); m.position.set(fx + (i - 1) * 0.25 * fh, G + 0.012, fz + 1.0 * fh); S.rings.push({ m, age: i * 0.6, dur: 1.8 }); } }
  // the great trees: a trunk that goes up out of sight, buttress roots, and leaves hanging down into view
  { const bt = T(barkTexture()); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; const bark = new THREE.MeshStandardMaterial({ map: bt, color: 0xa89878, roughness: 0.95, metalness: 0 }), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const lt = T(leafTexture()), hang = [];
    for (const [tx, tz, k, seed] of C.trunks.slice(0, low ? 2 : 9)) { const r2 = lcg(seed * 7919), P = [], UV = [], I = []; let nv = 0; const add = (L) => { P.push(...L.pos); UV.push(...L.uv); for (const i of L.idx) I.push(i + nv); nv += L.pos.length / 3; };
      add(limbGeometry([V(0, -0.3, 0), V(0.05, 2.2, 0.05), V(-0.1, 4.6, -0.05), V(0.15, 7.5, 0.1)], 0.8, 0.55, 12, 8, 0.45));
      for (let j = 0; j < 6; j++) { const a = (j / 6) * 6.2832 + r2() * 0.7, c = Math.cos(a), s = Math.sin(a), L = 1.9 + r2() * 1.2; add(limbGeometry([V(c * 0.3, 1.3 + r2() * 0.5, s * 0.3), V(c * 0.8, 0.6, s * 0.8), V(c * L * 0.7, 0.14, s * L * 0.7), V(c * L, -0.22, s * L)], 0.3, 0.07, 6, 6)); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, bark); m.position.set(tx, G, tz); m.scale.setScalar(k); grp.add(m);
      const sh = flat(new THREE.PlaneGeometry(7 * k, 7 * k), new THREE.MeshBasicMaterial({ map: R.shade.material.map, transparent: true, opacity: 0.55, depthWrite: false }), G + 0.005, 1); sh.position.set(tx, G + 0.005, tz);
      for (let j = 0; j < (low ? 5 : 11); j++) { const a = r2() * 6.2832, r = 1.0 + r2() * 2.4; hang.push([tx + Math.cos(a) * r * k, G + 2.3 + r2() * 1.7, tz + Math.sin(a) * r * k + 0.6, 1.5 + r2() * 1.1]); } }
    const hg = new THREE.PlaneGeometry(1, 1); hg.translate(0, 0.5, 0); const hm = new THREE.InstancedMesh(hg, new THREE.MeshBasicMaterial({ map: lt, alphaTest: 0.45, side: THREE.DoubleSide }), hang.length);
    hang.forEach(([x, y, z, s], i) => { o.position.set(x, y, z); o.rotation.set(0.25, (rnd() - 0.5) * 1.2, Math.PI + (rnd() - 0.5) * 0.7); o.scale.setScalar(s); o.updateMatrix(); hm.setMatrixAt(i, o.matrix); const v = 0.2 + rnd() * 0.22; hm.setColorAt(i, col.setRGB(v * 0.6, v, v * 0.8)); }); o.rotation.set(0, 0, 0); hm.frustumCulled = false; grp.add(hm);
    // ferns, and flowers and mushrooms that give their own light
    const dry = (x, z) => !inPoly(x, z, out) && !(Math.abs(x) < MW / 2 + 0.95 && Math.abs(z - MZ) < MD / 2 + 0.95), place = (n) => { const r = []; for (let t = 0; t < n * 6 && r.length < n; t++) { const b = C.beds[Math.floor(rnd() * C.beds.length)], x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (dry(x, z)) r.push([x, z]); } return r; };
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0); const cardsOf = (tex, spots, s0, s1, tint, bright) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: !bright }), spots.length);
      spots.forEach(([x, z], i) => { o.position.set(x, G, z); o.rotation.set(-0.5, (rnd() - 0.5) * 0.7, 0); o.scale.setScalar(s0 + rnd() * (s1 - s0)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, tint(col)); }); o.rotation.set(0, 0, 0); m.frustumCulled = false; grp.add(m); };
    cardsOf(lt, place(low ? 18 : Q === "mid" ? 36 : 56), 0.75, 1.3, (c) => { const v = 0.26 + rnd() * 0.26; return c.setRGB(v * 0.62, v, v * 0.82); }, false);
    const GC = [[0.2, 0.95, 0.9], [0.72, 0.38, 1], [0.45, 1, 0.32]], fl = place(low ? 12 : Q === "mid" ? 22 : 36); cardsOf(T(daisyTexture()), fl, 0.4, 0.62, (c) => { const k = GC[Math.floor(rnd() * 3)]; return c.setRGB(k[0], k[1], k[2]); }, true);
    const ms = place(low ? 8 : Q === "mid" ? 16 : 26), stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6), new THREE.MeshBasicMaterial({ color: 0x8ea596 }), ms.length), cap = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 5, 0, 6.2832, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), ms.length);
    const gp = new Float32Array((ms.length + fl.length) * 3), gc = new Float32Array((ms.length + fl.length) * 3);
    ms.forEach(([x, z], i) => { const s = 0.8 + rnd() * 0.9, k = GC[Math.floor(rnd() * 3)]; o.position.set(x, G + 0.11 * s, z); o.scale.setScalar(s); o.updateMatrix(); stem.setMatrixAt(i, o.matrix); o.position.y = G + 0.2 * s; o.updateMatrix(); cap.setMatrixAt(i, o.matrix); cap.setColorAt(i, col.setRGB(k[0], k[1], k[2])); gp.set([x, G + 0.26 * s, z], i * 3); gc.set(k, i * 3); });
    fl.forEach(([x, z], i) => { gp.set([x, G + 0.3, z], (ms.length + i) * 3); gc.set([0.3, 0.6, 0.55], (ms.length + i) * 3); }); o.scale.set(1, 1, 1); grp.add(stem, cap);
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(gp, 3)); gg.setAttribute("color", new THREE.BufferAttribute(gc, 3));
    S.glow = new THREE.Points(gg, new THREE.PointsMaterial({ map: R.FX.dot, size: 0.95, vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); S.glow.frustumCulled = false; grp.add(S.glow); }
  // shafts of light through the canopy
  { const st = T(shaftTexture()); S.shaft = new THREE.MeshBasicMaterial({ map: st, color: 0xd8ffe2, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    S.spot = new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0xc8ffd6, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [x, z] of C.shafts.slice(0, low ? 2 : 9)) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5.2), S.shaft); m.position.set(x + 0.75, G + 2.5, z); m.rotation.z = 0.3; m.renderOrder = 6; grp.add(m);
      flat(new THREE.PlaneGeometry(3, 3), S.spot, G + 0.014, 4).position.set(x, G + 0.014, z); } }
  if (!reduce) { S.steps.push(lightPoints(grp, low ? 8 : 26, 0xd8ff7a, 0.26, 0, C.flies)); if (!low) S.steps.push(lightPoints(grp, Q === "mid" ? 24 : 50, 0xaaffee, 0.11, 0.14, null)); }
  return S;
}
function stepForest(S, dt, t) {
  S.water.uniforms.uT.value = t; S.fall.offset.y = (t * 0.55) % 1; S.mist.material.opacity = 0.28 + 0.06 * Math.sin(t * 2.1); S.mist.scale.setScalar((2.3 + 0.25 * Math.sin(t * 1.3)) * S.mistS);
  for (const r of S.rings) { r.age += dt; if (r.age > r.dur) r.age = 0; const u = r.age / r.dur; r.m.scale.setScalar((0.3 + u * 1.5) * S.mistS); r.m.material.opacity = (1 - u) * 0.5; }
  S.glow.material.opacity = 0.4 + 0.14 * Math.sin(t * 1.4); S.shaft.opacity = 0.2 + 0.05 * Math.sin(t * 0.5) + 0.02 * Math.sin(t * 1.7); S.spot.opacity = S.shaft.opacity * 0.9; for (const f of S.steps) f(dt, t);
}
// ---------- เมืองบาดาล: a sunken temple on the sea floor ----------
// Sand with the light rippling over it, the steps of a sunken temple under the table, broken pillars at the sides, coral and
// sea grass that sways, shoals of fish going round, bubbles rising, the sun's shafts coming down through the water.
const DEEP = {
  wide: { pillars: [[-10.6, -5.2, 2.6], [-12.3, -2.0, 1.4], [10.4, -6.2, 3.1], [12.2, -3.0, 1.0], [5.6, -9.4, 2.2]], fallen: [[-8.2, -8.3, 0.5]], beds: [[-13, -8.9, -7.0, 4.8], [8.9, 13, -7.0, 4.8], [-9, 9, -9.6, -7.2]], shoals: [[-9.5, -5.5], [8.5, -7.5]], shafts: [[-9, -4], [-3.5, -8.4], [6.5, -8.1], [10.8, -1.5]] },
  tall: { pillars: [[-6.2, -8.6, 2.4], [6.2, -8.9, 2.8], [-3.3, -9.9, 1.2]], fallen: [[2.6, -9.4, 0.4]], beds: [[-7.6, 7.6, -9.6, -7.2], [-7.6, 7.6, 6.7, 9.6]], shoals: [[-2, -8.3], [1.5, 8.2]], shafts: [[-4, -8.2], [3.5, -8.5], [0, 7.9]] } };
function buildDeep() {
  const Q = R.Q, low = Q === "low", C = DEEP[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "deep"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], steps: [], fish: [], weeds: [], step: stepDeep }, o = S.o, rnd = lcg(523), T = (t) => { S.tex.push(t); return t; }, col = new THREE.Color();
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  // the sea floor: sand in the blue, the light from above rippling over it (the pond's water shader, used as caustics)
  S.floor = cellWater(low, new THREE.Color(0.02, 0.04, 0.045), new THREE.Color(0.07, 0.11, 0.1), new THREE.Color(0.2, 0.42, 0.42), 0.022, 0.32); flat(new THREE.PlaneGeometry(70, 50), S.floor, G).position.z = -2;
  // a sunken temple's platform under the table, a step down round it
  { const pt = T(paverTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(7, 5.5); const pm = new THREE.MeshBasicMaterial({ map: pt, color: 0x3d5a63 });
    flat(new THREE.PlaneGeometry(MW + 1.7, MD + 1.7), pm, G + 0.008, 2).position.z = MZ; flat(new THREE.PlaneGeometry(MW + 3.4, MD + 3.4), new THREE.MeshBasicMaterial({ map: pt, color: 0x24393f }), G + 0.004, 1).position.z = MZ; }
  // broken pillars, one fallen; stone the sea has turned green-grey
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b7472, roughness: 0.95, metalness: 0, flatShading: true });
  { const shaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.48, 1, 10), stone, C.pillars.length + C.fallen.length), base = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.36, 1.3), stone, C.pillars.length); let k = 0;
    C.pillars.forEach(([x, z, hh], i) => { o.rotation.set(0, rnd() * 3, (rnd() - 0.5) * 0.08); o.scale.set(1, hh, 1); o.position.set(x, G + 0.36 + hh / 2, z); o.updateMatrix(); shaft.setMatrixAt(k, o.matrix); shaft.setColorAt(k++, col.setRGB(0.9 + rnd() * 0.2, 1, 0.95));
      o.rotation.set(0, rnd(), 0); o.scale.set(1, 1, 1); o.position.set(x, G + 0.18, z); o.updateMatrix(); base.setMatrixAt(i, o.matrix); base.setColorAt(i, col.setRGB(0.85, 0.95, 0.92)); });
    for (const [x, z, a] of C.fallen) { o.rotation.set(0, a, Math.PI / 2); o.scale.set(1, 2.6, 1); o.position.set(x, G + 0.42, z); o.updateMatrix(); shaft.setMatrixAt(k, o.matrix); shaft.setColorAt(k++, col.setRGB(0.85, 0.95, 0.9)); }
    o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); grp.add(shaft, base); }
  // coral heads and rocks on the beds, sea grass in tufts that sways
  const out = (x, z) => !(Math.abs(x) < MW / 2 + 1.0 && Math.abs(z - MZ) < MD / 2 + 1.0), spots = (n) => { const r = []; for (let t = 0; t < n * 8 && r.length < n; t++) { const b = C.beds[Math.floor(rnd() * C.beds.length)], x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (out(x, z)) r.push([x, z]); } return r; };
  { const cs = spots(low ? 8 : Q === "mid" ? 16 : 26), CO = [[1, 0.42, 0.55], [1, 0.62, 0.32], [0.72, 0.45, 1], [0.95, 0.85, 0.45], [0.4, 0.85, 0.9]];
    const coral = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, flatShading: true }), cs.length * 3); let k = 0;
    for (const [x, z] of cs) { const c0 = CO[Math.floor(rnd() * CO.length)]; for (let j = 0; j < 3; j++) { const s = 0.18 + rnd() * 0.22; o.position.set(x + (rnd() - 0.5) * 0.6, G + s * 0.7, z + (rnd() - 0.5) * 0.5); o.rotation.set(rnd(), rnd() * 6, rnd()); o.scale.set(s, s * (1 + rnd()), s); o.updateMatrix(); coral.setMatrixAt(k, o.matrix); coral.setColorAt(k++, col.setRGB(c0[0] * 0.5, c0[1] * 0.42, c0[2] * 0.48)); } }
    o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); grp.add(coral);
    const lt = T(leafTexture()), wg = new THREE.PlaneGeometry(0.34, 1.6); wg.translate(0, 0.8, 0); const wm = new THREE.MeshBasicMaterial({ map: lt, color: 0x3d8a5a, alphaTest: 0.4, side: THREE.DoubleSide });
    for (const [x, z] of spots(low ? 8 : Q === "mid" ? 16 : 28)) { const tuft = new THREE.Group(); tuft.position.set(x, G, z); for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(wg, wm); b.rotation.y = (j / 4) * Math.PI + rnd() * 0.4; b.position.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25); b.scale.set(1, 0.7 + rnd() * 0.8, 1); tuft.add(b); } grp.add(tuft); S.weeds.push({ g: tuft, ph: rnd() * 6.28, f: 0.6 + rnd() * 0.5 }); } }
  // shoals of fish going round, bubbles rising, the sun's shafts
  { const ft = T(koiTexture("#7aa8c8")); for (const [cx, cz] of C.shoals) for (let j = 0; j < (low ? 5 : 11); j++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: j % 3 ? 0xcfe8ff : 0xffe0a8, transparent: true, depthWrite: false })); f.scale.set(0.62, 0.62, 1); grp.add(f); S.fish.push({ f, cx, cz, r: 1.2 + rnd() * 1.4, y: 1.0 + rnd() * 1.6, ph: rnd() * 6.28, w: (0.25 + rnd() * 0.15) * (rnd() < 0.5 ? 1 : -1) }); } }
  { const st = T(shaftTexture()); S.shaft = new THREE.MeshBasicMaterial({ map: st, color: 0x9fe8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const [x, z] of C.shafts.slice(0, low ? 2 : 9)) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 6), S.shaft); m.position.set(x + 0.8, G + 2.9, z); m.rotation.z = 0.22; m.renderOrder = 6; grp.add(m); } }
  if (!reduce) S.steps.push(lightPoints(grp, low ? 14 : Q === "mid" ? 34 : 60, 0xcff4ff, 0.14, 0.5, null));
  return S;
}
function stepDeep(S, dt, t) {
  S.floor.uniforms.uT.value = t; S.shaft.opacity = 0.14 + 0.05 * Math.sin(t * 0.6) + 0.02 * Math.sin(t * 1.9);
  for (const w of S.weeds) { w.g.rotation.z = Math.sin(t * w.f + w.ph) * 0.14; w.g.rotation.x = Math.cos(t * w.f * 0.8 + w.ph) * 0.1; }
  for (const f of S.fish) { const a = t * f.w + f.ph; f.f.position.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 0.9 + f.ph) * 0.12, f.cz + Math.sin(a) * f.r * 0.6); const dx = -Math.sin(a) * f.w; f.f.material.rotation = (dx >= 0 ? 0 : Math.PI) + 0.15 * Math.sin(t * 3 + f.ph); }
  for (const s of S.steps) s(dt, t);
}
// ---------- ลานเปลวคราม: the owner's own scene ----------
// A terrace on still dark water that light runs across in blue lines, braziers of blue fire at its corners, clusters of
// crystal that glow, will-o'-the-wisps drifting round the table and blue sparks rising. Open to the owner only (see achieve.js).
const AZURE = {
  wide: { braz: [[-8.2, -6.5], [8.2, -6.5], [-8.2, 6.1], [8.2, 6.1]], beds: [[-13, -8.9, -7.0, 4.8], [8.9, 13, -7.0, 4.8], [-12, 12, -9.2, -7.3]], wisps: [[-10.4, -2.5], [-9.6, -7.5], [-5, -8.0], [5.6, -7.9], [10.3, -3]] },
  tall: { braz: [[-4.7, -7.7], [4.7, -7.7], [-4.7, 7.4], [4.7, 7.4]], beds: [[-7.6, 7.6, -9.5, -7.2], [-7.6, 7.6, 6.7, 9.6]], wisps: [[-5, -8.1], [0, -8.7], [5, -8.1], [-3, 7.8], [3.5, 8.2]] } };
function buildAzure() {
  const Q = R.Q, low = Q === "low", C = AZURE[R.zones === ZONES.tall ? "tall" : "wide"], G = -0.335, grp = new THREE.Group(); grp.name = "azure"; R.scene.add(grp);
  const S = { grp, zk: R.zones, o: new THREE.Object3D(), tex: [], wisps: [], steps: [], step: stepAzure }, o = S.o, rnd = lcg(307), T = (t) => { S.tex.push(t); return t; }, col = new THREE.Color();
  const flat = (geo, mat, y, order = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; grp.add(m); return m; };
  S.water = cellWater(Q !== "high", new THREE.Color(0.001, 0.004, 0.02), new THREE.Color(0.003, 0.02, 0.075), new THREE.Color(0.16, 0.5, 1.0), 0.017, 0.9, 1); flat(new THREE.PlaneGeometry(70, 50), S.water, G).position.z = -2;
  { const pt = T(paverTexture()); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(7, 5.5); flat(new THREE.PlaneGeometry(MW + 1.7, MD + 1.7), new THREE.MeshBasicMaterial({ map: pt, color: 0x3a4764 }), G + 0.008, 2).position.z = MZ;
    S.halo = new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0x2a8cff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }); flat(new THREE.PlaneGeometry(MW + 9, MD + 9), S.halo, G + 0.004, 1).position.z = MZ; }
  // crystal: three shards to a cluster, lit from inside
  { const spots = []; const n = low ? 6 : Q === "mid" ? 11 : 18; for (let t = 0; t < n * 8 && spots.length < n; t++) { const b = C.beds[Math.floor(rnd() * C.beds.length)], x = b[0] + rnd() * (b[1] - b[0]), z = b[2] + rnd() * (b[3] - b[2]); if (!(Math.abs(x) < MW / 2 + 1.0 && Math.abs(z - MZ) < MD / 2 + 1.0)) spots.push([x, z]); }
    S.crystal = new THREE.MeshStandardMaterial({ color: 0x0a1e5a, emissive: 0x1450e0, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0, flatShading: true });
    const cm = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), S.crystal, spots.length * 3); let k = 0;
    for (const [x, z] of spots) for (let j = 0; j < 3; j++) { const hh = (j ? 0.35 : 0.7) + rnd() * 0.5, r = 0.11 + rnd() * 0.08; o.position.set(x + (j ? (j === 1 ? 0.24 : -0.2) : 0), G + hh * 0.42, z + (j ? (rnd() - 0.5) * 0.3 : 0)); o.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (j ? (j === 1 ? -0.45 : 0.4) : 0) + (rnd() - 0.5) * 0.2); o.scale.set(r, hh, r); o.updateMatrix(); cm.setMatrixAt(k++, o.matrix); }
    o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); grp.add(cm);
    const gl = new THREE.MeshBasicMaterial({ map: R.FX.dot, color: 0x2f9cff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), gm = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 2.4), gl, spots.length);
    spots.forEach(([x, z], i) => { o.position.set(x, G + 0.012, z); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix(); gm.setMatrixAt(i, o.matrix); }); o.rotation.set(0, 0, 0); gm.renderOrder = 3; grp.add(gm); }
  S.flames = braziers(grp, C.braz, G, new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.8, metalness: 0.2, flatShading: true }), 0xffffff, 0x1a5cff, o, blueFlame());
  // will-o'-the-wisps: a small blue flame each, going round its own spot
  for (const [x, z] of C.wisps.slice(0, low || reduce ? 2 : 9)) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: blueFlame(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.scale.set(0.36, 0.66, 1); grp.add(f);
    S.wisps.push({ f, hl: sprite(R.FX.dot, 0x3aa0ff, 1.5, new THREE.Vector3(x, 1, z), 0.45, grp), x, z, ph: rnd() * 6.28, r: 0.5 + rnd() * 0.6, w: (0.35 + rnd() * 0.3) * (rnd() < 0.5 ? -1 : 1) }); }
  if (!reduce) S.steps.push(lightPoints(grp, low ? 16 : Q === "mid" ? 40 : 80, 0x5ab8ff, 0.17, 0.4, null));
  return S;
}
function stepAzure(S, dt, t) {
  S.water.uniforms.uT.value = t; flicker(S.flames, t); S.crystal.emissiveIntensity = 0.75 + 0.3 * Math.sin(t * 1.3); S.halo.opacity = 0.27 + 0.05 * Math.sin(t * 0.9);
  for (const w of S.wisps) { const a = t * w.w + w.ph, x = w.x + Math.cos(a) * w.r, z = w.z + Math.sin(a * 1.3) * w.r * 0.6, y = 0.55 + Math.sin(t * 1.7 + w.ph) * 0.22; w.f.position.set(x, y, z); w.hl.position.set(x, y - 0.05, z); const f = 1 + 0.12 * Math.sin(t * 11 + w.ph); w.f.scale.set(0.36 * (2 - f), 0.66 * f, 1); }
  for (const f of S.steps) f(dt, t);
}
// the owner's own summon: tongues of blue fire run round the circle and close in on the card as it lands
function azureFx(P, s) {
  if (!R || reduce) return; const n = R.Q === "low" ? 6 : 10;
  for (let i = 0; i < n; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: blueFlame(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); const st = { a: (i / n) * 6.2832, r: 1.5 * s, y: 0.32 * s }; f.scale.set(0.5 * s, 0.95 * s, 1); R.scene.add(f);
    const place = () => f.position.set(P.x + Math.cos(st.a) * st.r, st.y, P.z + Math.sin(st.a) * st.r); place();
    gsap.to(st, { a: st.a + 3.4, duration: 0.95, ease: "power1.in", onUpdate: place }); gsap.to(st, { r: 0.55 * s, y: 0.8 * s, duration: 0.3, delay: 0.62, ease: "power2.in" });
    gsap.to(f.material, { opacity: 1, duration: 0.2, delay: i * 0.015 }); gsap.to(f.material, { opacity: 0, duration: 0.22, delay: 0.82, onComplete: () => { if (R) R.scene.remove(f); f.material.dispose(); } }); }
  for (let k = 0; k < 2; k++) ripple(P, 0x0a4ad8, 4.4 * s, 0.1 + k * 0.3);
}
// the table's surroundings are the scene the viewer chose (สนาม), whatever cloth lies on the table
function decor() {
  if (!R) return; const want = R.sceneKey;
  if (R.sakura && (want !== "sakura" || R.sakura.zk !== R.zones)) { dropSakura(R.sakura); R.sakura = null; }
  if (want === "sakura" && !R.sakura) R.sakura = buildSakura();
  if (R.pond && (R.pond.key !== want || R.pond.zk !== R.zones)) { dropPond(R.pond); R.pond = null; }
  if (GROUND[want] && !R.pond) { R.pond = GROUND[want].build(); R.pond.key = want; }
  hallShow();
}
// the candle-lit hall (teak table, candles, brass and garland) gives way to a scene that brings its own ground (GROUND)
function hallShow() {
  if (!R) return; const gr = GROUND[R.sceneKey], on = !gr, air = gr ? gr.air : [0x0b0605, 0.026, 0xffe2c0, 0x140a06, 0.5];
  if (R.wood) R.wood.visible = on; if (R.shade) R.shade.visible = on && !R.shadeOff; for (const c of R.candles || []) c.grp.visible = on;
  const pr = R.scene.getObjectByName("props"); if (pr) pr.visible = on; if (R.motes) R.motes.visible = on || (R.Q !== "low" && !gr.noMotes);
  R.scene.fog.color.setHex(air[0]); R.scene.fog.density = air[1];
  if (R.hemi) { R.hemi.color.setHex(air[2]); R.hemi.groundColor.setHex(air[3]); R.hemi.intensity = air[4]; }
}
const rgbaOf = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
// the gold line-work of our half of the wide table, gold on black, for the playmat editor to lay over a picture ("screen")
export function matLines() {
  const mt = matTextures(true, { near: MATS.black, far: MATS.black }, ZONES.wide), src = mt.glow.image, S = src.width / MW;
  const [x0, y0, x1, y1] = matRect(true, (x) => (x + MW / 2) * S, (z) => (z - MZ + MD / 2) * S), c = document.createElement("canvas");
  c.width = Math.round(x1 - x0); c.height = Math.round(y1 - y0); const g = c.getContext("2d");
  g.drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height); g.globalCompositeOperation = "multiply"; g.fillStyle = GOLD; g.fillRect(0, 0, c.width, c.height);
  for (const t of [mt.base, mt.glow, mt.rough]) t.dispose(); return c;
}
// where a player's playmat lies on the mat canvas: [left, top, right, bottom] in canvas pixels
const matRect = (near, X, Y) => (near ? [X(-PM.x), Y(MZ + PM.z0), X(PM.x), Y(MZ + MD / 2 - PM.z1)] : [X(-PM.x), Y(MZ - MD / 2 + PM.z1), X(PM.x), Y(MZ - PM.z0)]);
const roundRect = (c, x0, y0, x1, y1, r) => { c.beginPath(); c.moveTo(x0 + r, y0); c.arcTo(x1, y0, x1, y1, r); c.arcTo(x1, y1, x0, y1, r); c.arcTo(x0, y1, x0, y0, r); c.arcTo(x0, y0, x1, y0, r); c.closePath(); };
// the playmat: a soft shadow on the lacquer round it, the picture covering it (cropped to fit, never stretched) under the
// owner's veil, a dark bound edge with a row of stitches, and cloth's matt finish in the roughness map
function playmat(g, rq, m, near, [x0, y0, x1, y1], U) {
  const r = U(PM.r), bw = U(PM.bind), w = x1 - x0, hh = y1 - y0;
  g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = U(0.22); g.shadowOffsetY = U(near ? 0.05 : -0.05); g.fillStyle = "#0c0b0e"; roundRect(g, x0, y0, x1, y1, r); g.fill(); g.restore();
  g.save(); roundRect(g, x0, y0, x1, y1, r); g.clip();
  const iw = m.img.width, ih = m.img.height, k = Math.max(w / iw, hh / ih), dw = iw * k, dh = ih * k;
  if (near) g.drawImage(m.img, x0 + (w - dw) / 2, y0 + (hh - dh) / 2, dw, dh); else { g.translate(x1, y1); g.rotate(Math.PI); g.drawImage(m.img, (w - dw) / 2, (hh - dh) / 2, dw, dh); }
  g.restore();
  g.save(); roundRect(g, x0, y0, x1, y1, r); g.clip(); g.fillStyle = rgbaOf(m.lac, m.veil != null ? m.veil : 0.3); g.fillRect(x0, y0, w, hh);
  // the binding round the edge, a little sheen along its inner side, and the stitching along it
  g.lineWidth = bw * 2; g.strokeStyle = "#0e0d12"; roundRect(g, x0, y0, x1, y1, r); g.stroke();
  g.lineWidth = Math.max(1, U(0.012)); g.strokeStyle = "rgba(255,255,255,.10)"; roundRect(g, x0 + bw, y0 + bw, x1 - bw, y1 - bw, Math.max(1, r - bw)); g.stroke();
  g.setLineDash([U(0.07), U(0.045)]); g.lineWidth = Math.max(1, U(0.016)); g.strokeStyle = "rgba(150,140,128,.55)"; const sx = bw * 0.5; roundRect(g, x0 + sx, y0 + sx, x1 - sx, y1 - sx, Math.max(1, r - sx)); g.stroke(); g.setLineDash([]);
  g.restore();
  rq.save(); rq.fillStyle = "#e4e4e4"; roundRect(rq, x0, y0, x1, y1, r); rq.fill(); rq.restore(); // cloth is matt: the hall's light does not shine in it
}
// a "sketch" mat's half of the table: a flattened cardboard box, or a ruled page — drawn the way its owner sees it (the far one turned round)
function paintPaper(g, rq, m, near, CW, CH, yMid, U) {
  const H = near ? CH - yMid : yMid, r = lcg(m.paper === "box" ? 31 : 47), W = CW; rq.fillStyle = "#ececec"; rq.fillRect(0, near ? yMid : 0, CW, H);
  g.save(); g.beginPath(); g.rect(0, near ? yMid : 0, CW, H); g.clip(); if (near) g.translate(0, yMid); else { g.translate(CW, yMid); g.rotate(Math.PI); } // now (0,0) is the middle of the table at its owner's left, y runs toward the owner
  g.fillStyle = m.lac; g.fillRect(-2, -2, W + 4, H + 4);
  const blot = (n, a) => { for (let k = 0; k < n; k++) { const x = r() * W, y = r() * H, rad = U(0.9 + r() * 2.2), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, k % 2 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } };
  if (m.paper === "box") {
    for (let x = 0, k = 0; x < W; x += U(0.085), k++) { g.fillStyle = k % 2 ? "rgba(0,0,0,.025)" : "rgba(255,236,200,.02)"; g.fillRect(x, 0, U(0.03), H); } // the corrugation showing through, faintly
    blot(30, 0.1); for (let k = 0; k < 3; k++) { const x = r() * W, y = r() * H, rad = U(0.45 + r() * 0.3); g.strokeStyle = "rgba(52,28,10,.22)"; g.lineWidth = U(0.05 + r() * 0.04); g.beginPath(); g.arc(x, y, rad, r() * 6, 5 + r() * 1.2); g.stroke(); } // coffee-cup rings g.lineCap = "round";
    for (let k = 0; k < 520; k++) { const x = r() * W, y = r() * H, l = U(0.04 + r() * 0.16); g.strokeStyle = k % 3 ? "rgba(40,24,10,.11)" : "rgba(255,240,212,.09)"; g.lineWidth = Math.max(1, U(0.008)); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * l * 0.3); g.stroke(); }
    const fy = H * 0.5; g.fillStyle = "rgba(28,16,6,.3)"; g.fillRect(0, fy, W, Math.max(1, U(0.022))); g.fillStyle = "rgba(255,236,200,.13)"; g.fillRect(0, fy + U(0.022), W, Math.max(1, U(0.018))); // where the flap folds
    g.save(); g.translate(U(1.5), U(0.75)); g.rotate(-0.1); g.fillStyle = "rgba(222,198,146,.4)"; g.beginPath(); const tw = U(2.3), th = U(0.52); g.moveTo(-tw / 2, -th / 2); g.lineTo(tw / 2, -th / 2); for (let k = 0; k <= 6; k++) g.lineTo(tw / 2 + (k % 2 ? U(0.05) : 0), -th / 2 + (th * k) / 6); g.lineTo(-tw / 2, th / 2); for (let k = 6; k >= 0; k--) g.lineTo(-tw / 2 - (k % 2 ? U(0.05) : 0), -th / 2 + (th * k) / 6); g.closePath(); g.fill(); g.restore(); // a strip of packing tape
    g.save(); g.fillStyle = g.strokeStyle = "rgba(34,20,8,.42)"; g.font = `700 ${U(0.2)}px "Chakra Petch", sans-serif`; g.textBaseline = "middle"; g.fillText("THIS SIDE UP", U(1.15), H - U(0.42)); // box markings, stencilled
    for (const ax of [U(0.42), U(0.82)]) { g.beginPath(); g.moveTo(ax, H - U(0.68)); g.lineTo(ax + U(0.14), H - U(0.46)); g.lineTo(ax + U(0.05), H - U(0.46)); g.lineTo(ax + U(0.05), H - U(0.2)); g.lineTo(ax - U(0.05), H - U(0.2)); g.lineTo(ax - U(0.05), H - U(0.46)); g.lineTo(ax - U(0.14), H - U(0.46)); g.closePath(); g.fill(); } g.restore();
    g.save(); g.translate(W - U(1.55), H - U(0.5)); g.rotate(-0.12); g.strokeStyle = g.fillStyle = "rgba(128,22,16,.4)"; g.lineWidth = U(0.03); roundRect(g, -U(1.05), -U(0.26), U(1.05), U(0.26), U(0.08)); g.stroke(); g.font = `700 ${U(0.2)}px "Chakra Petch", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BoT ARENA", 0, U(0.01)); g.restore(); // a rubber stamp
  } else {
    blot(26, 0.045);
    for (let k = 0; k < 5; k++) { const x0 = r() * W, y0 = r() * H, a = r() * 6.28, l = U(4 + r() * 6), dx = Math.cos(a) * l, dy = Math.sin(a) * l; for (const [o, col] of [[0, "rgba(0,0,0,.06)"], [U(0.02), "rgba(255,255,255,.35)"]]) { g.strokeStyle = col; g.lineWidth = Math.max(1, U(0.014)); g.beginPath(); g.moveTo(x0 + o, y0 + o); g.lineTo(x0 + dx + o, y0 + dy + o); g.stroke(); } } // creases of a page that was folded
    g.strokeStyle = "rgba(58,104,188,.34)"; g.lineWidth = Math.max(1, U(0.013)); for (let y = U(0.3); y < H; y += U(0.44)) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } // ruled lines
    g.strokeStyle = "rgba(206,66,66,.5)"; g.lineWidth = Math.max(1, U(0.016)); g.beginPath(); g.moveTo(U(1.02), 0); g.lineTo(U(1.02), H); g.stroke(); // the margin
    g.fillStyle = "rgba(26,20,16,.62)"; for (const fy of [0.18, 0.5, 0.82]) { g.beginPath(); g.arc(U(0.45), H * fy, U(0.1), 0, 7); g.fill(); } // punched holes
    g.save(); g.translate(W - U(1.35), H - U(0.78)); g.rotate(0.06); g.strokeStyle = "rgba(43,79,168,.6)"; g.lineWidth = Math.max(1, U(0.022)); g.lineCap = "round"; const c3 = U(0.3); // a game of noughts and crosses in the corner
    for (const k of [-0.5, 0.5]) { g.beginPath(); g.moveTo(k * c3, -1.5 * c3); g.lineTo(k * c3 + U(0.02), 1.5 * c3); g.moveTo(-1.5 * c3, k * c3); g.lineTo(1.5 * c3, k * c3 - U(0.02)); g.stroke(); }
    for (const [cx, cy, o] of [[-1, -1, 1], [0, 0, 0], [1, -1, 0], [1, 1, 1], [-1, 1, 0]]) { g.beginPath(); if (o) g.arc(cx * c3, cy * c3, c3 * 0.3, 0, 7); else { g.moveTo(cx * c3 - c3 * 0.28, cy * c3 - c3 * 0.28); g.lineTo(cx * c3 + c3 * 0.28, cy * c3 + c3 * 0.28); g.moveTo(cx * c3 + c3 * 0.28, cy * c3 - c3 * 0.28); g.lineTo(cx * c3 - c3 * 0.28, cy * c3 + c3 * 0.28); } g.stroke(); } g.restore();
  }
  g.restore();
}
function matTextures(small, mats = {}, Z = ZONES.wide) {
  const NEAR = mats.near || MATS.black, FAR = mats.far || NEAR, theme = NEAR;
  const S = small ? 84 : 128; const CW = Math.round(MW * S), CH = Math.round(MD * S);
  const mk = () => { const c = document.createElement("canvas"); c.width = CW; c.height = CH; return c; };
  const base = mk(), glow = mk(), rough = mk(); const g = base.getContext("2d"), q = glow.getContext("2d"), rq = rough.getContext("2d");
  const X = (x) => (x + MW / 2) * S, Y = (z) => (z - MZ + MD / 2) * S, U = (v) => v * S;
  const LAC = theme.lac;
  // lacquer: each side of the table is its owner's own mat (like two duel mats laid edge to edge): that colour of lacquer,
  // washed with the colour toward its own edge, a soft pool of light over both, flecks of gold leaf
  const yMid = Y(MZ);
  g.fillStyle = FAR.lac; g.fillRect(0, 0, CW, yMid); g.fillStyle = NEAR.lac; g.fillRect(0, yMid, CW, CH - yMid);
  q.fillStyle = "#000"; q.fillRect(0, 0, CW, CH); rq.fillStyle = "#c0c0c0"; rq.fillRect(0, 0, CW, CH); // roughness: lacquer satin, so the hall reflects in it only as a soft glow; gold leaf a little glossier
  let gr = g.createRadialGradient(CW / 2, CH * 0.55, CW * 0.05, CW / 2, CH * 0.55, CW * 0.62); gr.addColorStop(0, "rgba(64,38,28,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  gr = g.createLinearGradient(0, 0, 0, CH * 0.42); gr.addColorStop(0, FAR.edge + ".30)"); gr.addColorStop(1, FAR.edge + "0)"); g.fillStyle = gr; g.fillRect(0, 0, CW, CH * 0.42);
  if (NEAR !== FAR || NEAR.kind) { gr = g.createLinearGradient(0, CH, 0, CH * 0.6); gr.addColorStop(0, NEAR.edge + ".22)"); gr.addColorStop(1, NEAR.edge + "0)"); g.fillStyle = gr; g.fillRect(0, CH * 0.6, CW, CH * 0.4); }
  gr = g.createLinearGradient(0, CH, 0, CH * 0.6); gr.addColorStop(0, "rgba(216,168,74,.10)"); gr.addColorStop(1, "rgba(216,168,74,0)"); g.fillStyle = gr; g.fillRect(0, CH * 0.6, CW, CH * 0.4);
  // ซากุระราตรี: branches in bloom painted across that side (under the gold line-work; the cards lie on top)
  for (const [m, near] of [[FAR, false], [NEAR, true]]) if (m.kind === "sakura") paintSakura(g, X, Y, U, near, small);
  for (const [m, near] of [[FAR, false], [NEAR, true]]) if (m.kind === "sketch") paintPaper(g, rq, m, near, CW, CH, yMid, U);
  for (let k = 0; k < CW * CH / 900; k++) { const v = Math.random(); g.fillStyle = v < 0.5 ? "rgba(255,255,255,.018)" : "rgba(0,0,0,.05)"; g.fillRect(Math.random() * CW, Math.random() * CH, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  // a player's own picture (vault.js): a cloth playmat on their half, the far one turned round to face its owner
  const cloths = [[FAR, false], [NEAR, true]].filter(([m]) => m.img).map(([m, near]) => ({ m, near, r: matRect(near, X, Y) }));
  for (const { m, near, r } of cloths) playmat(g, rq, m, near, r, U);
  const onCloth = (x, y) => cloths.some(({ r }) => x > r[0] && x < r[2] && y > r[1] && y < r[3]) || (y < yMid ? FAR : NEAR).kind === "sketch"; // no gold flecks on cloth or paper
  for (let k = 0; k < (small ? 260 : 520); k++) { const x = Math.random() * CW, y = Math.random() * CH, r = Math.random() * 1.6 + 0.4, a = Math.random() * 0.22 + 0.04; if (onCloth(x, y)) continue; g.fillStyle = `rgba(232,186,92,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); q.fillStyle = `rgba(255,255,255,${a * 0.6})`; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); }
  // everything gilded is drawn three times: in gold on the mat, in white on the glow (and metal) map, in grey on the roughness map
  // (each half in its owner's own hand: gold leaf on lacquer, or — a "sketch" mat — marker or pen on paper, which is drawn on the colour map only)
  const gild = (fn) => { for (const [m, y0, y1] of [[FAR, 0, yMid], [NEAR, yMid, CH]]) for (const [c, col, gr] of m.kind === "sketch" ? [[g, m.ink, LAC]] : [[g, GOLD, LAC], [q, "#fff", "#000"], [rq, "#a0a0a0", "#c0c0c0"]]) {
    c.save(); c.beginPath(); c.rect(0, y0, CW, y1 - y0); c.clip(); c.strokeStyle = c.fillStyle = col; c.lineJoin = "miter"; c.sk = m.kind === "sketch" ? { m, rnd: lcg(977) } : null; fn(c, gr); c.sk = null; c.restore(); } };
  // a box drawn by hand: each side a stroke or two that bows a little and runs past the corner
  const scrawl = (c, x0, y0, x1, y1, w, n = 2) => { const r = c.sk.rnd; c.lineCap = "round"; for (let k = 0; k < n; k++) { const j = () => (r() - 0.5) * w * 2.4, o = () => r() * w * 3.2; c.lineWidth = w * (0.7 + r() * 0.55);
    for (const [ax, ay, bx, by] of [[x0 - o(), y0 + j(), x1 + o(), y0 + j()], [x1 + j(), y0 - o(), x1 + j(), y1 + o()], [x1 + o(), y1 + j(), x0 - o(), y1 + j()], [x0 + j(), y1 + o(), x0 + j(), y0 - o()]]) { c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2 + j() * 1.4, (ay + by) / 2 + j() * 1.4, bx, by); c.stroke(); } } };
  const orn = (c, ...a) => { if (!c.sk) prajamyam(c, ...a); };
  // a zone is a panel (ลูกฟัก): a firm rule with a hairline inside it, and in each inner corner a corner piece (ลายเข้ามุม: a
  // triangle with a hollowed side, a bead beyond it). Only the shared Land Magic Zone keeps stepped corners (ย่อมุม, the corner of a
  // throne base) — one stepped frame reads as a centrepiece, a dozen read as pixels. A stepped frame's hairline follows it step for step.
  const frame = (c, x0, z0, x1, z1, st, w = 0.035, stepped = false) => { if (c.sk) return scrawl(c, X(x0), Y(z0), X(x1), Y(z1), U(w * 1.1), w > 0.03 ? 3 : 2); const d = U(0.1);
    if (stepped) { c.lineWidth = U(w); stepPath(c, X(x0), Y(z0), X(x1), Y(z1), U(st)); c.stroke(); c.lineWidth = U(w * 0.38); stepPath(c, X(x0) + d, Y(z0) + d, X(x1) - d, Y(z1) - d, U(st)); c.stroke(); return; }
    c.lineWidth = U(w); c.strokeRect(X(x0), Y(z0), X(x1) - X(x0), Y(z1) - Y(z0)); c.lineWidth = U(w * 0.38); c.strokeRect(X(x0) + d, Y(z0) + d, X(x1) - X(x0) - 2 * d, Y(z1) - Y(z0) - 2 * d);
    if (st < 0.1) return; // the small boxes (LIFE, the piles) stay plain
    const k = U(st * 1.3); for (const [sx, sy, px, py] of [[1, 1, X(x0) + d, Y(z0) + d], [-1, 1, X(x1) - d, Y(z0) + d], [1, -1, X(x0) + d, Y(z1) - d], [-1, -1, X(x1) - d, Y(z1) - d]]) {
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + sx * k, py); c.quadraticCurveTo(px + sx * k * 0.36, py + sy * k * 0.36, px, py + sy * k); c.closePath(); c.fill();
      c.beginPath(); c.arc(px + sx * k * 0.5, py + sy * k * 0.5, Math.max(1, k * 0.085), 0, 7); c.fill(); } };
  const label = (c, text, x, z, flip, align = "left", size = 0.19) => { c.save(); c.translate(X(x), Y(z)); if (flip) c.rotate(Math.PI); if (c.sk) c.rotate((c.sk.rnd() - 0.5) * 0.07); c.font = c.sk ? `600 ${U(size * 1.12)}px "Mali", "IBM Plex Sans Thai", sans-serif` : `600 ${U(size)}px "Chakra Petch", "IBM Plex Sans Thai", sans-serif`; c.textAlign = align; c.textBaseline = "middle"; c.globalAlpha = c.sk ? 0.92 : 0.8; c.fillText(text, 0, 0); c.restore(); };
  const inLabel = (c, text, x0, z0, x1, z1, flip) => (flip ? label(c, text, x1 - 0.32, z1 - 0.3, true) : label(c, text, x0 + 0.32, z0 + 0.3, false));
  const draw = () => gild((c, ground) => {
    // the mat's border: a stepped double rule (ย่อมุม; the inner rule follows the outer one step for step) and, between the two, a
    // row of กรวยเชิง along the two long edges — tall leaves with rounded shoulders and a vein cut through, standing on the outer rule and
    // pointing in, a bead between each two (the short sides stay plain rules, as on a lacquer panel: กรวยเชิง hang from a band, they do not climb a post)
    const e = 0.2; if (c.sk) { scrawl(c, X(-MW / 2 + e + 0.1), Y(MZ - MD / 2 + e + 0.1), X(MW / 2 - e - 0.1), Y(MZ + MD / 2 - e - 0.1), U(0.03), 2); } else {
    const e1 = e + 0.24, bst = U(0.2);
    c.lineWidth = U(0.045); stepPath(c, X(-MW / 2 + e), Y(MZ - MD / 2 + e), X(MW / 2 - e), Y(MZ + MD / 2 - e), bst); c.stroke();
    c.lineWidth = U(0.016); stepPath(c, X(-MW / 2 + e1), Y(MZ - MD / 2 + e1), X(MW / 2 - e1), Y(MZ + MD / 2 - e1), bst); c.stroke();
    const kw = 0.13, kh = 0.15, pitch = 0.19, kz = e + 0.04;
    const row = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / pitch), ux = (x1 - x0) / L, uz = (z1 - z0) / L, s0 = (L - n * pitch) / 2;
      for (let k = 0; k < n; k++) { const s = s0 + (k + 0.5) * pitch, mx = x0 + ux * s, mz = z0 + uz * s, P = (al, out) => [X(mx + ux * al + nx * out), Y(mz + uz * al + nz * out)];
        c.beginPath(); c.moveTo(...P(-kw / 2, 0)); c.bezierCurveTo(...P(-kw / 2, kh * 0.5), ...P(-kw * 0.1, kh * 0.62), ...P(0, kh)); c.bezierCurveTo(...P(kw * 0.1, kh * 0.62), ...P(kw / 2, kh * 0.5), ...P(kw / 2, 0)); c.closePath(); c.fill();
        if (ground) { const f = c.fillStyle; c.fillStyle = ground; c.beginPath(); c.moveTo(...P(0, kh * 0.16)); c.quadraticCurveTo(...P(kw * 0.17, kh * 0.4), ...P(0, kh * 0.7)); c.quadraticCurveTo(...P(-kw * 0.17, kh * 0.4), ...P(0, kh * 0.16)); c.fill(); c.fillStyle = f; }
        if (k < n - 1) { c.beginPath(); c.arc(...P(pitch / 2, kh * 0.2), U(0.017), 0, 7); c.fill(); } } };
    const xa = -MW / 2 + e + 0.55, xb = MW / 2 - e - 0.55;
    row(xa, MZ - MD / 2 + kz, xb, MZ - MD / 2 + kz, 0, 1); row(xa, MZ + MD / 2 - kz, xb, MZ + MD / 2 - kz, 0, -1); }
    // zones, mine near and the opponent's far (their labels face them)
    for (const [zs, flip] of [[1, false], [-1, true]]) {
      const zc = zs > 0 ? 2.15 : -2.55, zo = zs > 0 ? 4.17 : -4.5; const gnd = ground === LAC ? (zs > 0 ? NEAR.lac : FAR.lac) : ground;
      frame(c, -4.35, zc - 1.18, 4.35, zc + 1.18, 0.16); inLabel(c, "Avatar Zone", -4.35, zc - 1.18, 4.35, zc + 1.18, flip);
      orn(c, X(0), Y(zc - zs * 1.18), U(0.2), gnd); orn(c, X(0), Y(zc + zs * 1.18), U(0.13), gnd);
      frame(c, Z.cs[0], zo - 0.76, Z.cs[1], zo + 0.76, 0.11, 0.028); inLabel(c, "Construct Zone", Z.cs[0], zo - 0.76, Z.cs[1], zo + 0.76, flip);
      frame(c, Z.mg[0], zo - 0.76, Z.mg[1], zo + 0.76, 0.11, 0.028); inLabel(c, "Magic Zone", Z.mg[0], zo - 0.76, Z.mg[1], zo + 0.76, flip);
    }
    // each side's LIFE (laid sideways down its owner's left, like a damage zone) and its Deck, hell and dark zone (its owner's right)
    if (Z.side) for (const [mine, flip] of [[true, false], [false, true]]) {
      const m = (x, z) => (mine ? [x, z] : [-x, 2 * MZ - z]); const box = (x0, z0, x1, z1) => { const [ax, az] = m(x0, z0), [bx, bz] = m(x1, z1); return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]; };
      const Lf = Z.side.life; if (Lf) { const hw = (CARD.h * Lf.s) / 2 + 0.1, hd = (CARD.w * Lf.s) / 2 + 0.1; const lb = box(Lf.x - hw, Lf.z0 - hd, Lf.x + hw, Lf.z0 + 4 * Lf.dz + hd);
        frame(c, ...lb, 0.08, 0.022); const [lx, lz] = m(Lf.x, Lf.z0 + 4 * Lf.dz + hd + 0.2); label(c, "LIFE", lx, lz, flip, "center", 0.17); }
      const Pl = Z.side.piles, pw = (CARD.w * Pl.s) / 2 + 0.07, pd = (CARD.h * Pl.s) / 2 + 0.07;
      for (const [k, name] of [["deck", "Deck"], ["hell", "นรก"], ["dark", Pl.short ? "มืด" : "มิติมืด"]]) { const [tx, tz] = pileSpot(0, mine ? 0 : 1, Pl, k); c.save(); if (c.sk) c.strokeStyle = c.fillStyle = c.sk.m.pens[k];
        frame(c, tx - pw, tz - pd, tx + pw, tz + pd, 0.06, c.sk ? 0.03 : 0.02); label(c, name, tx, tz, flip, "center", Pl.short ? 0.13 : 0.15); c.restore(); }
    }
    // Land Magic Zone, shared: in the middle of the table on a wide screen (its centre band of ประจำยาม runs out to both sides), at the left on an upright phone
    const Ld = Z.land, [b0, b1] = Z.band; frame(c, Ld.x0, MZ - Ld.dz, Ld.x1, MZ + Ld.dz, 0.13, 0.03, true); label(c, "Land Magic", Ld.lx, Ld.lz, false, Ld.align);
    if (c.sk) { const r = c.sk.rnd, gp = Ld.center ? [Ld.x0 - 0.12, Ld.x1 + 0.12] : null; c.lineCap = "round"; c.lineWidth = U(0.024); // on paper: two plain strokes for the band, no ornaments
      for (const dz of [-0.24, 0.24]) for (const [a, b] of gp ? [[b0, gp[0]], [gp[1], b1]] : [[b0, b1]]) { c.beginPath(); c.moveTo(X(a - 0.1 * r()), Y(MZ + dz) + (r() - 0.5) * U(0.05)); c.quadraticCurveTo(X((a + b) / 2), Y(MZ + dz) + (r() - 0.5) * U(0.1), X(b + 0.1 * r()), Y(MZ + dz) + (r() - 0.5) * U(0.05)); c.stroke(); } return; }
    const gap = Ld.center ? [Ld.x0 - 0.12, Ld.x1 + 0.12] : null; c.lineWidth = U(0.022);
    for (const dz of [-0.24, 0.24]) for (const [a, b] of gap ? [[b0, gap[0]], [gap[1], b1]] : [[b0, b1]]) { c.beginPath(); c.moveTo(X(a), Y(MZ + dz)); c.lineTo(X(b), Y(MZ + dz)); c.stroke(); }
    for (let x = b0 + 0.4; x <= b1 - 0.25; x += 0.9) if (!gap || x < gap[0] - 0.15 || x > gap[1] + 1.4) prajamyam(c, X(x), Y(MZ), U(0.14), ground); // (none under the "Land Magic" label)
    for (const x of [b0, b1]) prajamyam(c, X(x), Y(MZ), U(0.3), ground);
  });
  const under = NEAR.kind === "sketch" || FAR.kind === "sketch" ? mk() : null; if (under) under.getContext("2d").drawImage(base, 0, 0); // paper shows a second drawing of the lines, so they are redrawn from here
  draw();
  const repaint = () => { if (!R) return; if (under) g.drawImage(under, 0, 0); draw(); tb.needsUpdate = tg.needsUpdate = tr.needsUpdate = true; };
  const tb = new THREE.CanvasTexture(base), tg = new THREE.CanvasTexture(glow), tr = new THREE.CanvasTexture(rough); tb.encoding = THREE.sRGBEncoding; tb.anisotropy = tg.anisotropy = tr.anisotropy = 8;
  // the labels need the display font: redraw once it has loaded
  if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(repaint);
  if (document.fonts && (NEAR.kind === "sketch" || FAR.kind === "sketch") && !document.fonts.check('600 20px "Mali"', "นรกAa")) document.fonts.load('600 20px "Mali"', "นรกAa").then(repaint).catch(() => {});
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
function flameTexture(blue) { // blue: the owner's own fire (a warm flame only tinted blue comes out grey)
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d"), K = blue ? ["40,120,255,.9", "10,40,255,0", "40,110,255,.0", "90,180,255,.95", "225,246,255,1"] : ["255,190,90,.9", "255,90,20,0", "255,170,60,.0", "255,214,120,.95", "255,250,230,1"];
  let gr = g.createRadialGradient(32, 84, 2, 32, 76, 46); gr.addColorStop(0, `rgba(${K[0]})`); gr.addColorStop(1, `rgba(${K[1]})`); g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.beginPath(); g.moveTo(32, 14); g.bezierCurveTo(46, 52, 46, 82, 32, 100); g.bezierCurveTo(18, 82, 18, 52, 32, 14); gr = g.createLinearGradient(0, 14, 0, 100); gr.addColorStop(0, `rgba(${K[2]})`); gr.addColorStop(0.45, `rgba(${K[3]})`); gr.addColorStop(1, `rgba(${K[4]})`); g.fillStyle = gr; g.fill();
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
  R.scene.add(grp); return { grp, flame, halo, pool, ph: Math.random() * 10, onStand };
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
export const SIGILS = { lotus: { name: "บัวประจำยาม" }, sun: { name: "สุริยะดาวเพดาน" }, naga: { name: "เกล็ดนาค" }, yant: { name: "ตารางยันต์" }, pikul: { name: "ดอกพิกุล" },
  azure: { name: "เปลวคราม", owner: true } }; // the owner's own: always blue, and blue fire spirals up round the card (azureFx)
function sigilTexture(kind = "lotus") {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"), C = 256;
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512); g.strokeStyle = g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 10;
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  const at = (a, d) => [C + Math.cos(a) * d, C + Math.sin(a) * d];
  // a petal pointing out from the heart at angle a, from d0 to d1, w wide: plump near its base, closing to a point, a vein cut through it
  // (in black: the glow is white on black); edge: a black outline first, so a petal laid over another stays separate
  const petal = (a, d0, d1, w, edge) => { const L = d1 - d0, P = (d, s) => [C + Math.cos(a) * d - Math.sin(a) * s, C + Math.sin(a) * d + Math.cos(a) * s];
    const path = () => { g.beginPath(); g.moveTo(...P(d0, -w * 0.5)); g.bezierCurveTo(...P(d0 + L * 0.3, -w * 1.1), ...P(d0 + L * 0.78, -w * 0.62), ...P(d1, 0)); g.bezierCurveTo(...P(d0 + L * 0.78, w * 0.62), ...P(d0 + L * 0.3, w * 1.1), ...P(d0, w * 0.5)); g.closePath(); };
    g.save(); g.shadowBlur = 0; if (edge) { path(); g.strokeStyle = "#000"; g.lineWidth = 5; g.stroke(); } g.restore(); path(); g.fill();
    g.save(); g.shadowBlur = 0; g.fillStyle = "#000"; g.beginPath(); g.moveTo(...P(d0 + L * 0.18, 0)); g.quadraticCurveTo(...P(d0 + L * 0.48, w * 0.3), ...P(d0 + L * 0.8, 0)); g.quadraticCurveTo(...P(d0 + L * 0.48, -w * 0.3), ...P(d0 + L * 0.18, 0)); g.fill(); g.restore(); };
  ring(238, 7); ring(222, 2);
  if (kind === "azure") { // เปลวคราม: twelve tongues of flame leaning the same way round a drop at the heart, sparks between the rings
    ring(150, 4); ring(64, 3);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, P = (d, da) => at(a + da, d); g.beginPath(); g.moveTo(...P(156, -0.1)); g.bezierCurveTo(...P(176, -0.16), ...P(200, -0.02), ...P(216, 0.2)); g.bezierCurveTo(...P(196, 0.16), ...P(180, 0.2), ...P(156, 0.14)); g.closePath(); g.fill(); }
    for (let k = 0; k < 24; k++) { g.beginPath(); g.arc(...at((k / 24) * Math.PI * 2 + 0.13, k % 2 ? 108 : 124), k % 2 ? 3 : 5, 0, 7); g.fill(); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineWidth = 2.5; g.beginPath(); g.moveTo(...at(a, 70)); g.quadraticCurveTo(...at(a + 0.35, 88), ...at(a + 0.5, 100)); g.stroke(); }
    g.beginPath(); g.moveTo(C, C - 44); g.bezierCurveTo(C + 34, C - 4, C + 30, C + 34, C, C + 36); g.bezierCurveTo(C - 30, C + 34, C - 34, C - 4, C, C - 44); g.fill();
  } else if (kind === "sun") { // ดาวเพดาน: the gilded star of a temple ceiling — eight long petals with eight short ones between, round a heart
    // of beads, and a ring of small leaves (กระจัง) pointing out from it
    ring(150, 4); ring(140, 1.5);
    for (let k = 0; k < 32; k++) petal((k / 32) * Math.PI * 2, 156, k % 2 ? 186 : 210, k % 2 ? 8 : 11);
    for (let k = 0; k < 8; k++) petal((k / 8) * Math.PI * 2 + Math.PI / 8, 34, 100, 15);
    for (let k = 0; k < 8; k++) petal((k / 8) * Math.PI * 2, 30, 134, 22, true);
    g.beginPath(); g.arc(C, C, 34, 0, 7); g.fill(); g.save(); g.shadowBlur = 0; g.fillStyle = "#000"; g.beginPath(); g.arc(C, C, 24, 0, 7); g.fill(); g.restore();
    g.beginPath(); g.arc(C, C, 14, 0, 7); g.fill(); for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(...at((k / 8) * Math.PI * 2 + Math.PI / 8, 29), 3, 0, 7); g.fill(); }
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
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(C - h + s3 * (i + 0.5), C - h + s3 * (j + 0.5), (i + j) % 2 ? 7 : 0, 0, 7); if ((i + j) % 2) g.fill(); else prajamyam(g, C - h + s3 * (i + 0.5), C - h + s3 * (j + 0.5), i === 1 && j === 1 ? 30 : 19, "#000"); } // small ประจำยาม in the corners and the heart, beads between
  } else if (kind === "pikul") { // ดอกพิกุล: a ring of small eight-petalled pikul flowers round one large one
    ring(146, 4); ring(132, 1.5);
    const pikul = (cx, cy, r, w) => { g.lineWidth = w; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, P = (d, da) => [cx + Math.cos(a + da) * d, cy + Math.sin(a + da) * d];
      g.beginPath(); g.moveTo(...P(r * 0.28, -0.32)); g.lineTo(...P(r * 0.82, -0.2)); g.lineTo(...P(r, 0)); g.lineTo(...P(r * 0.82, 0.2)); g.lineTo(...P(r * 0.28, 0.32)); g.closePath(); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, r * 0.2, 0, 7); g.fill(); };
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pikul(...at(a, 186), 30, 2.5); g.beginPath(); g.arc(...at(a + Math.PI / 12, 186), 4, 0, 7); g.fill(); }
    pikul(C, C, 112, 4); ring(52, 2);
  } else { // บัวประจำยาม: a lotus seen from above — two rings of plump petals (the inner ring sits between the outer one's petals,
    // each petal outlined so it stays separate), a vein cut through each, round a ประจำยาม
    ring(146, 4);
    for (let k = 0; k < 16; k++) petal((k / 16) * Math.PI * 2, 150, 216, 25);
    for (let k = 0; k < 16; k++) petal(((k + 0.5) / 16) * Math.PI * 2, 150, 196, 20, true);
    for (let k = 0; k < 16; k++) { g.beginPath(); g.arc(...at(((k + 0.5) / 16) * Math.PI * 2, 230), 4, 0, 7); g.fill(); }
    ring(132, 1.5); prajamyam(g, C, C, 108, "#000");
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
  g.strokeStyle = g.fillStyle = GOLD; g.lineWidth = 6; stepPath(g, 12, 12, 244, 336, 14); g.stroke(); g.lineWidth = 2; stepPath(g, 24, 24, 232, 324, 14); g.stroke();
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
function faceMat(d, seat) {
  // card faces are unlit so the official art keeps its real colours (no light/bloom wash-out); FACE_HOOK adds the sheen and the burn
  // (seat: the card's owner, whose skin it shows; a Token with a printed card of its own shows that card, any other is drawn here)
  const token = d.im == null, c = token ? null : skinOf(card(d.im), seat);
  const u = { uBurn: { value: 0 }, uSweep: { value: -2 }, uSheen: { value: 0 }, uFoil: { value: (c && FOIL[c.r]) || 0 }, uFlash: { value: 0 }, uEdge: { value: new THREE.Color(0xff8a2a) }, uTint: { value: new THREE.Color(d.co ? colorHex(d.co) : 0xffd9a0) } };
  const mat = new THREE.MeshBasicMaterial({ map: token ? tokenTexture(d) : R.texCache.get(c.i) || R.backTex, color: 0xdedede, toneMapped: false });
  mat.userData.u = u; mat.userData.own = token; mat.onBeforeCompile = FACE_HOOK;
  if (!token && mat.map === R.backTex) resolveArt(c).then((url) => { if (!url || !R) return; R.loader.load(corsUrl(url), (t) => { if (!R) return t.dispose(); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; R.texCache.set(c.i, t); mat.map = t; mat.needsUpdate = true; }); });
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
  const el = h("div", { class: "showcase", "aria-hidden": "true" }, artImg(c, "scimg", undefined, L.x.o), h("b", null, `${(s.P[ev.p] || {}).name || "ฝ่ายตรงข้าม"} ใช้ ${d.n}`));
  document.querySelectorAll(".showcase").forEach((x) => x.remove()); /* one at a time (fast replays) */ document.body.append(el); const k = 1 / ((R && R.speed) || 1);
  gsap.set(el, { xPercent: -50, yPercent: -50 });
  gsap.fromTo(el, { opacity: 0, scale: reduce ? 1 : 0.8 }, { opacity: 1, scale: 1, duration: 0.22 * k, ease: "back.out(1.6)" });
  gsap.to(el, { opacity: 0, duration: 0.25 * k, delay: 1.1 * k, onComplete: () => el.remove() });
  return sleepMs(950);
}
// the effect strip: newest on top, three at most, each fades by itself (never takes a click)
function fxCut(s, ev, mine) {
  const d = s.cards[ev.c]; if (!d) return; const c = d.im != null ? card(d.im) : null;
  let box = document.querySelector(".fxcuts"); if (!box) { box = h("div", { class: "fxcuts", "aria-live": "polite" }); document.body.append(box); }
  const own = ev.i != null && E.locate(s, ev.i) ? E.locate(s, ev.i).x.o : ev.p; // (the card's owner: their skin)
  const el = h("div", { class: "fxcut glass" + (mine ? " mine" : " opp") }, c ? artImg(c, "fxart", undefined, own) : h("div", { class: "fxart tok" }, "✦"),
    h("div", { class: "fxtx" }, h("b", null, (mine ? "" : (s.P[ev.p] ? s.P[ev.p].name + " · " : "")) + d.n), h("span", null, ev.t || "")));
  box.prepend(el); while (box.children.length > 3) box.lastChild.remove();
  const k = Math.max(0.25, 1 / ((R && R.speed) || 1)); if (!reduce) gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.25 });
  gsap.to(el, { opacity: 0, duration: 0.4, delay: 2.6 * k + Math.min(2, String(ev.t || "").length / 60) * k, onComplete: () => el.remove() });
}
export function banner(t, s) {
  let b = document.querySelector(".banner"); if (!b) { b = h("div", { class: "banner" }, h("div", { class: "band" }, h("b"), h("span"))); document.body.append(b); }
  b.querySelector("b").textContent = t; b.querySelector("span").textContent = s || ""; const band = b.querySelector(".band");
  gsap.killTweensOf(band); gsap.fromTo(band, { opacity: 0, scaleX: 0.4 }, { opacity: 1, scaleX: 1, duration: 0.35, ease: "power3.out" });
  const th = /[\u0E00-\u0E7F]/.test(t); /* a Thai name is not tracked out like YOUR TURN */
  gsap.fromTo(b.querySelector("b"), { letterSpacing: th ? "0.2em" : "0.6em", opacity: 0 }, { letterSpacing: th ? "0.03em" : "0.25em", opacity: 1, duration: 0.5, ease: "power3.out" });
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
// ---------- the side zones of a wide table ----------
// LIFE lies sideways down its owner's left like a damage zone: face down until it is turned up, then its face shows (tap
// it to read it); the owner's right has the Deck, the hell and the dark zone as real piles, as high as they are thick, the
// last card into hell or the dark zone on top. A tap opens what is in a pile (the Deck only tells how many are left).
const PILE_TH = { deck: "Deck", hell: "นรก", dark: "มิติมืด" };
function sideSpot(V, p, x, z) { return p === V ? [x, z] : [-x, 2 * MZ - z]; }
// where a pile lies: down its owner's right on a wide table, or (Pl.pos, Pl.same) at one spot each on the same side for both players
function pileSpot(V, p, Pl, k) { const [x, z] = Pl.pos ? Pl.pos[k] : [Pl.x, Pl[k]]; return p === V ? [x, z] : [Pl.same ? x : -x, 2 * MZ - z]; }
function makePile(key) {
  const grp = new THREE.Group(), body = new THREE.Mesh(R.geo.edge, [R.capMat, R.pileMat]), top = new THREE.Mesh(R.geo.face, R.backMat);
  body.castShadow = top.castShadow = true; grp.add(body, top); R.scene.add(grp); body.userData.pile = top.userData.pile = key;
  const el = h("div", { class: "pilel" }); document.body.append(el);
  return { key, grp, body, top, el, n: -1, topI: null };
}
function makeLife(s, x, p) {
  const face = new THREE.Mesh(R.geo.face, faceMat(E.def(s, x), x.o)), back = new THREE.Mesh(R.geo.back, backFor(s, x.o != null ? x.o : p)), edge = new THREE.Mesh(R.geo.edge, [R.capMat, R.edgeMat]);
  const flip = new THREE.Group(); flip.add(edge, back, face); const grp = new THREE.Group(); grp.add(flip); R.scene.add(grp);
  face.userData.life = back.userData.life = x.i; edge.userData.life = x.i; return { i: x.i, p, grp, flip, face, back, edge, up: null };
}
function dropMesh(o) { R.scene.remove(o.grp); if (o.face && o.face.material.dispose) o.face.material.dispose(); if (o.top && o.top.material !== R.backMat && !o.top.material.userData.keep && o.top.material.dispose) o.top.material.dispose(); if (o.el) o.el.remove(); }
// a player's card sleeve: their own picture (vault.js) once it has loaded, otherwise the Thai-pattern back
function backFor(s, p) {
  const P = s && s.P && s.P[p], o = P && P.sleeve === "own" && custom.sleeve ? custom.sleeve(P) : null;
  if (!o || !o.img) return R.backMat;
  if (!o.mat) { o.mat = new THREE.MeshBasicMaterial({ map: sleeveTexture(o.img), color: 0xd6d6d6, toneMapped: false }); o.mat.userData.keep = true; }
  return o.mat;
}
// a player's own sleeve as a printed art sleeve: the picture under a soft gloss (light from the top left, a little shade
// toward the far corner), the dark folded edge of the sleeve round it and a thin bright rim where its plastic catches the
// light
function sleeveTexture(img, W = 512) {
  const H = Math.round(W * 697 / 512), c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const k = Math.max(W / img.width, H / img.height), dw = img.width * k, dh = img.height * k; g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  sleeveFrame(g, W, H);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
// the sleeve drawn over a picture already in a W×H canvas (the table's card backs, and the sleeve editor's preview)
export function sleeveFrame(g, W, H) {
  let gr = g.createLinearGradient(0, 0, W * 0.9, H); gr.addColorStop(0, "rgba(255,255,255,.17)"); gr.addColorStop(0.3, "rgba(255,255,255,.05)"); gr.addColorStop(0.52, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.16)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createLinearGradient(W * 0.12, 0, W * 0.62, H * 0.5); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.45, "rgba(255,255,255,.09)"); gr.addColorStop(0.55, "rgba(255,255,255,.09)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); // a band of shine
  const b = W * 0.026, r = W * 0.05;
  g.lineWidth = b * 2; g.strokeStyle = "#0c0b0f"; roundRect(g, 0, 0, W, H, r); g.stroke();
  g.lineWidth = Math.max(1, W * 0.004); g.strokeStyle = "rgba(255,255,255,.32)"; roundRect(g, b, b, W - b, H - b, Math.max(1, r - b)); g.stroke();
}
function syncBacks(s) {
  for (const m of R.meshes.values()) if (m.p != null) m.back.material = backFor(s, m.own != null ? m.own : m.p);
  if (R.side) { for (const o of R.side.life.values()) o.back.material = backFor(s, o.p); for (const [key, o] of R.side.piles) if (key.endsWith(":deck")) o.top.material = backFor(s, +key[0]); }
}
function syncSide(s, V) {
  const Z = R.zones && R.zones.side; if (!R.side) R.side = { piles: new Map(), life: new Map(), objs: [] };
  const S = R.side;
  if (!Z) { for (const o of [...S.piles.values(), ...S.life.values()]) dropMesh(o); S.piles.clear(); S.life.clear(); S.objs = []; return; } // an upright phone: the HUD shows them
  const keep = new Set();
  for (const p of [0, 1]) { const P = s.P[p]; if (!P) continue; const ry = p === V ? 0 : Math.PI;
    for (const z of ["deck", "hell", "dark"]) { const key = p + ":" + z; let o = S.piles.get(key); if (!o) { o = makePile(key); S.piles.set(key, o); }
      const list = P[z] || [], n = list.length, [x, zz] = pileSpot(V, p, Z.piles, z), hgt = Math.min(0.34, 0.012 + n * 0.0066);
      o.grp.position.set(x, 0.02, zz); o.grp.rotation.y = ry; o.grp.scale.setScalar(Z.piles.s); o.grp.visible = n > 0;
      o.body.scale.y = hgt / CARD.t; o.body.position.y = hgt / 2; o.top.position.y = hgt - CARD.t / 2 + 0.003;
      const topX = z === "deck" ? null : list[list.length - 1] || null;
      if (z === "deck") o.top.material = backFor(s, p);
      if (z !== "deck" && topX && topX.i !== o.topI) { if (o.top.material !== R.backMat && !o.top.material.userData.keep && o.top.material.dispose) o.top.material.dispose(); const fm = faceMat(E.def(s, topX), topX.o); if (z === "dark") fm.color = new THREE.Color(0xb9a6ff); o.top.material = fm; }
      o.topI = topX ? topX.i : null; o.n = n; o.mine = p === V; o.el.textContent = Z.piles.short ? String(n) : `${PILE_TH[z]} ${n}`; o.el.className = "pilel" + (p === V ? "" : " opp") + (n ? "" : " none") + (Z.piles.short ? " short" : ""); }
    if (Z.life) P.life.forEach((x, k) => { keep.add(x.i); let o = S.life.get(x.i); const fresh = !o; if (!o) { o = makeLife(s, x, p); S.life.set(x.i, o); }
      const [lx, lz] = sideSpot(V, p, Z.life.x, Z.life.z0 + k * Z.life.dz); o.grp.position.set(lx, 0.03 + k * 0.004, lz); o.grp.rotation.y = Math.PI / 2 + ry; o.grp.scale.setScalar(Z.life.s);
      const up = !!x.up; if (o.up !== up) { const z0 = up ? 0 : Math.PI;
        if (fresh || reduce) o.flip.rotation.z = z0; else { gsap.timeline().to(o.flip.position, { y: 0.9, duration: 0.25, ease: "power2.out" }).to(o.flip.rotation, { z: z0, duration: 0.45, ease: "power2.inOut" }, 0.05).to(o.flip.position, { y: 0, duration: 0.3, ease: "power2.in" }); }
        o.up = up; } });
  }
  for (const [i, o] of S.life) if (!keep.has(i)) { dropMesh(o); S.life.delete(i); }
  S.objs = [...[...S.piles.values()].filter((o) => o.grp.visible).flatMap((o) => [o.body, o.top]), ...[...S.life.values()].flatMap((o) => [o.face, o.back, o.edge])];
}
// what a pick on a side zone means: a face-up LIFE is that card (to read it), a face-down one or a pile is a place to open
function sidePick(obj) { const u = obj.userData; if (u.pile) return "pile:" + u.pile; if (u.life != null) { const o = R.side && R.side.life.get(u.life); return o && o.up ? u.life : "lifes:" + u.life; } return null; }
function layout(s, V) {
  const out = new Map(); const Z = R.zones || ZONES.wide;
  for (const p of [0, 1]) {
    const side = p === V ? "me" : "opp"; const P = s.P[p]; const zs = side === "me" ? 1 : -1;
    const n = P.av.length, gap = Z.avGap(n); P.av.forEach((x, k) => out.set(x.i, { x, p, side, zone: "av", pos: new THREE.Vector3((k - (n - 1) / 2) * gap, 0.04, side === "me" ? 2.15 : -2.55), scale: 1 }));
    P.cs.forEach((x, k) => out.set(x.i, { x, p, side, zone: "cs", pos: new THREE.Vector3(Z.csX(k), 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: Z.csS }));
    P.mg.forEach((x, k) => out.set(x.i, { x, p, side, zone: "mg", pos: new THREE.Vector3(Z.mgX(k), 0.04, zs * 4.15 - (side === "me" ? 0 : 0.35)), scale: Z.mgS }));
  }
  { const two = !!(s.land && s.land2), Ld = Z.land; for (const l of [s.land, s.land2]) if (l) out.set(l.i, { x: l, p: l.o, side: l.o === V ? "me" : "opp", zone: "land", pos: Ld.center ? new THREE.Vector3(two ? (l.o === V ? -Ld.dx2 : Ld.dx2) : Ld.x, 0.04, MZ) : new THREE.Vector3(Ld.x, 0.04, MZ + (two ? (l.o === V ? Ld.dz2 : -Ld.dz2) : 0)), scale: two ? Ld.s2 : Ld.s }); } // แบ่งแยกดินแดน: one Land per side
  return out;
}
function makeMesh(s, L) {
  const d = E.def(s, L.x), own = L.x.o != null ? L.x.o : L.p, fm = faceMat(d, own); // (a card taken over keeps its owner's art and sleeve)
  const face = new THREE.Mesh(R.geo.face, fm), back = new THREE.Mesh(R.geo.back, backFor(s, own)), edge = new THREE.Mesh(R.geo.edge, [R.capMat, R.edgeMat]);
  for (const o of [face, back, edge]) o.castShadow = true;
  const glow = new THREE.Mesh(R.geo.halo, new THREE.MeshBasicMaterial({ map: R.rimTex, color: L.zone === "land" ? 0x8fb0ff : L.side === "me" ? 0xffc35a : 0xff4a52, transparent: true, opacity: GLOW.rest, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = -0.012;
  // a soft contact shadow on the mat: it stays on the table, spreading and fading as the card lifts
  const shadow = new THREE.Mesh(R.geo.halo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: R.shadowTex, transparent: true, opacity: 0, depthWrite: false })); shadow.renderOrder = -1; R.scene.add(shadow);
  const grp = new THREE.Group(); grp.add(glow, edge, back, face); R.scene.add(grp);
  face.userData.i = L.x.i;
  return { i: L.x.i, p: L.p, own, grp, mesh: face, face, back, edge, glow, shadow, shOp: 0.6, u: fm.userData.u, co: d.co, side: L.side, zone: L.zone, scale: L.scale, restY: 0.04, sel: false, pulse: false, busy: false, nextSweep: (R.t || 0) + 3 + Math.random() * 8 };
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
    m.want = { pos: L.pos, rotY: (L.side === "opp" ? Math.PI : 0) + (L.x.a === false && (L.zone === "av" || (L.zone === "mg" && L.x.on == null)) ? -Math.PI / 2 : 0), scale: L.scale };
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
  const azure = R.sig[L.p] === "azure", aHex = azure ? 0x0a4ad8 : cHex, ring = sigil(P, aHex, s, R.sig[L.p]); Sfx.play("rise"); trail(m, aHex, 0.95);
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
    .add(() => { if (R && azure) azureFx(P, s); }, 0.06)
    .add(() => { if (!R) return; landFx(P, s, co, aHex); ringOut(ring, s); Sfx.play("summon", { color: co }); m.glow.material.opacity = 1; }, 0.98)
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
    if (E.critical(s.P[ev.p]) && R.crit !== ev.p + ":" + s.turn) { R.crit = ev.p + ":" + s.turn; setTimeout(() => R && Sfx.play("crit"), 450); } /* one LIFE from losing */ flash(mine ? "rgba(255,40,60,.5)" : "rgba(255,200,90,.35)", 0.5);
    popText(new THREE.Vector3(0, 1.2, mine ? 5.2 : -4.7), "LIFE −1", "#ff4d55");
    burst(new THREE.Vector3(0, 1, mine ? 5.2 : -4.7), { n: 26, color: 0xff6a70, spread: 2.2 });
  } else if (ev.k === "destroy") {
    Sfx.play("destroy"); const p = pos(ev.i); if (p) { popText(p.clone().setY(1), "BREAK", "#ff4d55"); burst(p.clone().setY(0.6), { n: 16, color: 0xff8a3a, size: 0.2, spread: 2.4 }); }
  } else if (ev.k === "cast") {
    const d = s.cards[(E.locate(s, ev.i) || { x: { c: "" } }).x.c]; const mco = d && d.co; const hp = ev.on != null ? pos(ev.on) : null; /* a Modification rises where it is worn */ const mpos = hp ? hp.clone().setY(0) : new THREE.Vector3(0, 0, mineSide(ev.p) ? 3.9 : -4.4);
    Sfx.play(ev.st === "L" ? "land" : "cast", { color: mco });
    pillar(mpos, mco ? colorHex(mco) : ev.st === "L" ? 0x8fb0ff : 0xc9a2ff); burst(new THREE.Vector3(0, 0.6, -0.2), { n: 16, map: R.FX.star_06, color: 0xbfd0ff, spread: 3 });
    if (ev.st === "L") decal(R.FX.magic_02, new THREE.Vector3(0, 0, -0.2), mco ? colorHex(mco) : 0x8fb0ff, 9, 1.8, 1.2); else if (mco) colorFx(mpos, mco, 0.8);
    if (d) popText(new THREE.Vector3(0, 1.4, -0.2), d.n, "#8fb0ff");
    if (!mineSide(ev.p)) await showcase(s, ev);
  } else if (ev.k === "heal") { // a LIFE card turned back face-down: green light rising where that side's LIFE sits
    const mine = mineSide(ev.p), at = new THREE.Vector3(0, 1, mine ? 5.2 : -4.7); Sfx.play("heal");
    popText(at.clone().setY(1.2), "LIFE +1", "#5ef0a0"); pillar(at.clone().setY(0), 0x6dffb0, 0.75); ripple(at.clone().setY(0), 0x7dffb8, 3.4);
    burst(at, { n: 18, map: R.FX.star_06, color: 0xa8ffd0, size: 0.34, spread: 1.3, up: 2.8, dur: 1.2 }); await sleepMs(450);
  } else if (ev.k === "mill") { await millFx(s, ev, V);
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
    if (!reduce && won && !R.watch && R.winfx !== "gold") winFx(R.winfx);
    else if (!reduce) for (let k = 0; k < (won ? 90 : 40); k++) gsap.delayedCall(Math.random() * 1.6, () => { // gold leaf rains for a win, ash and embers drift down for a loss
      if (!R) return; const win = won, p0 = new THREE.Vector3((Math.random() - 0.5) * 15, 6 + Math.random() * 2, (Math.random() - 0.5) * 10 - 0.5);
      const sp = sprite(win && Math.random() < 0.4 ? R.FX.star_06 : R.FX.dot, win ? [0xffd27a, 0xffe9b0, 0xd8a84a, 0xff9a4a][k % 4] : k % 3 ? 0x3a2622 : 0xff5a3a, win ? 0.28 + Math.random() * 0.2 : 0.2 + Math.random() * 0.25, p0, 0.95);
      const d = 2.2 + Math.random() * 1.6; gsap.to(sp.position, { y: 0.1, x: p0.x + (Math.random() - 0.5) * 2, z: p0.z + (Math.random() - 0.5) * 1.5, duration: d, ease: "sine.in" }); gsap.to(sp.material, { rotation: (Math.random() - 0.5) * 8, duration: d });
      gsap.to(sp.material, { opacity: 0, duration: 0.6, delay: d - 0.6, onComplete: () => { R && R.scene.remove(sp); sp.material.dispose(); } });
    });
  }
}
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms / ((R && R.speed) || 1)));
// the victory effects you can earn: lotus petals drifting down, lanterns rising off the table, fireworks bursting over it
function winFx(kind) {
  const gone = (sp) => () => { if (R) R.scene.remove(sp); sp.material.dispose(); }, rnd = (a, b) => a + Math.random() * (b - a);
  if (kind === "lotus") { const tex = R.petalTex || (R.petalTex = petalTexture());
    for (let k = 0; k < 110; k++) gsap.delayedCall(Math.random() * 2.4, () => { if (!R) return; const p0 = new THREE.Vector3(rnd(-8, 8), rnd(6, 8.5), rnd(-6, 4));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: k % 4 ? 0xffd6e4 : 0xffffff, transparent: true, depthWrite: false, rotation: Math.random() * 6 })); sp.scale.setScalar(rnd(0.22, 0.38)); sp.position.copy(p0); R.scene.add(sp);
      const d = rnd(3.4, 5); gsap.to(sp.position, { y: 0.08, duration: d, ease: "none" }); gsap.to(sp.position, { x: p0.x + rnd(-1.5, 1.5), z: p0.z + rnd(-1, 1), duration: d, ease: "sine.inOut" }); gsap.to(sp.material, { rotation: sp.material.rotation + rnd(-6, 6), duration: d });
      gsap.to(sp.material, { opacity: 0, duration: 0.8, delay: d - 0.3, onComplete: gone(sp) }); });
    return; }
  if (kind === "lantern") {
    for (let k = 0; k < 28; k++) gsap.delayedCall(k * 0.12 + Math.random() * 0.3, () => { if (!R) return; const side = k % 2 ? 1 : -1, p0 = new THREE.Vector3(rnd(-7.5, 7.5), 0.2, k % 3 ? rnd(-5.5, -2) : rnd(2, 5)); const grp = new THREE.Group(); grp.position.copy(p0); R.scene.add(grp);
      const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.FX.dot, color: 0xffb05a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); body.scale.set(0.8, 1.05, 1); grp.add(body);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.flameTex, color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.set(0.3, 0.55, 1); grp.add(fl);
      const d = rnd(5, 7); gsap.to([body.material, fl.material], { opacity: 0.95, duration: 0.6 }); gsap.to(grp.position, { y: rnd(7, 9), duration: d, ease: "sine.in" }); gsap.to(grp.position, { x: p0.x + side * rnd(0.3, 1.4), duration: d, ease: "sine.inOut" });
      gsap.to([body.material, fl.material], { opacity: 0, duration: 1.2, delay: d - 1.2, onComplete: () => { if (R) R.scene.remove(grp); body.material.dispose(); fl.material.dispose(); } }); });
    return; }
  if (kind === "fireworks") { const pal = [0xffd27a, 0xff6a8a, 0x7ad4ff, 0xa8ff7a, 0xd8a0ff, 0xffffff];
    for (let k = 0; k < 9; k++) gsap.delayedCall(k * 0.42 + Math.random() * 0.2, () => { if (!R) return; const to = new THREE.Vector3(rnd(-5.5, 5.5), rnd(2.2, 3.6), rnd(-3, 2.5)), col = pal[k % pal.length];
      const tail = sprite(R.FX.dot, col, 0.22, new THREE.Vector3(to.x + rnd(-0.6, 0.6), 0.3, to.z + 1.2), 0.9);
      gsap.to(tail.position, { x: to.x, y: to.y, z: to.z, duration: 0.55, ease: "power2.out", onComplete: () => { gone(tail)(); if (!R) return; burst(to, { n: 34, map: k % 2 ? R.FX.star_06 : R.FX.dot, color: col, size: 0.42, spread: 2.6, up: 0.4, dur: 1.3 }); burst(to, { n: 10, color: 0xffffff, size: 0.2, spread: 1.2, up: 0.2, dur: 0.6 }); flash("rgba(255,240,210,.07)", 0.15); } }); });
  }
}
// ธรณีสูบ: the cards leave the top of that side's Deck one after another, turn face up in the air (so the table sees what
// went) and land on its hell pile (a ไวรัส exiled by it, on the dark zone pile), under a "ธรณีสูบ N" label
async function millFx(s, ev, V) {
  const Z = R.zones && R.zones.side, n = (ev.ids || []).length; if (!n) return;
  const deckAt = Z ? new THREE.Vector3(...((a) => [a[0], 0.22, a[1]])(pileSpot(V, ev.p, Z.piles, "deck"))) : new THREE.Vector3(ev.p === V ? 5.6 : -5.6, 0.22, ev.p === V ? 3.2 : -3.6);
  popText(deckAt.clone().setY(1.5), `ธรณีสูบ ${n}`, "#c9a2ff");
  if (!Z || reduce) { await sleepMs(450); return; } // an upright phone draws no piles on the table: the label (and the HUD's counts) tell it
  const spot = (z) => { const [x, zz] = pileSpot(V, ev.p, Z.piles, z); return new THREE.Vector3(x, 0.22, zz); };
  const show = Math.min(n, 6), gap = n > 3 ? 0.12 : 0.2;
  await Promise.all(ev.ids.slice(0, show).map((i, k) => {
    const d = s.cards[ev.cs[k]] || {}, face = new THREE.Mesh(R.geo.face, faceMat(d, ev.p)), back = new THREE.Mesh(R.geo.back, backFor(s, ev.p)), edge = new THREE.Mesh(R.geo.edge, [R.capMat, R.edgeMat]);
    const flip = new THREE.Group(); flip.add(edge, back, face); flip.rotation.z = Math.PI; // face down, as it leaves the Deck
    const grp = new THREE.Group(); grp.add(flip); grp.position.copy(deckAt); grp.rotation.y = ev.p === V ? 0 : Math.PI; grp.scale.setScalar(Z.piles.s); R.scene.add(grp);
    // up and in toward the middle of the table, turning face up and growing to the size of a card in play, a beat in
    // the air so it can be read, then down onto its pile
    const to = spot((ev.dark || []).includes(i) ? "dark" : "hell"), lift = 1.9 + k * 0.1, midX = deckAt.x + (ev.p === V ? -1.5 : 1.5) - k * (ev.p === V ? 0.35 : -0.35), big = Z.piles.s * 2.1;
    return new Promise((res) => gsap.timeline({ delay: k * gap, onComplete: () => { if (R) R.scene.remove(grp); face.material.dispose(); res(); } })
      .add(() => Sfx.play("fly"))
      .to(grp.position, { y: lift, x: midX, z: (deckAt.z + to.z) / 2, duration: 0.32, ease: "power2.out" })
      .to(flip.rotation, { z: 0, duration: 0.36, ease: "power2.inOut" }, 0.05)
      .to(grp.scale, { x: big, y: big, z: big, duration: 0.32, ease: "power2.out" }, 0.05)
      .to(grp.position, { y: lift + 0.08, duration: 0.2, ease: "sine.inOut" }, 0.34)
      .to(grp.position, { x: to.x, z: to.z, duration: 0.38, ease: "power2.inOut" }, 0.56)
      .to(grp.scale, { x: Z.piles.s, y: Z.piles.s, z: Z.piles.s, duration: 0.34, ease: "power2.in" }, 0.6)
      .to(grp.position, { y: to.y, duration: 0.3, ease: "power2.in" }, 0.64));
  }));
}
// without WebGL there is no table to throw a die on: the result still shows, as a note in the middle of the screen
let flatLast = 0, flatView = null;
function flatEvents(s, V, opts) {
  if (opts.reset || flatView !== V) { flatLast = s.evc || 0; flatView = V; return; }
  for (const e of (s.ev || []).filter((x) => x.id > flatLast)) {
    if (e.k === "roll") flatNote(`${e.sides === 2 ? "ทอยเหรียญ" : "ทอยลูกเต๋า"}${e.why ? " (" + e.why + ")" : ""}: ${e.sides === 2 ? (e.r === 1 ? "ออกหัว" : "ออกก้อย") : "ได้ " + (e.r2 != null ? `${e.r} และ ${e.r2}` : e.r)}`);
    else if (e.k === "heal") flatNote(`${e.p === V ? "LIFE เรา" : "LIFE " + ((s.P[e.p] || {}).name || "ฝ่ายตรงข้าม")} +1`);
    else if (e.k === "mill") flatNote(`${e.p === V ? "เรา" : (s.P[e.p] || {}).name || "ฝ่ายตรงข้าม"} ธรณีสูบ ${(e.ids || []).length} ใบ: ${(e.cs || []).map((c) => (s.cards[c] || {}).n).filter(Boolean).slice(0, 6).join(", ")}`);
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
// each side of the table is its owner's mat: a lacquer colour, or their own picture (vault.js); the table's surroundings follow
function matOf(P) { if (!P) return null; if (P.mat === "own" && custom.mat) { const m = custom.mat(P); if (m) return m; } return MATS[P.mat] || null; }
function applyMats(s, V) {
  const k = R.matKey, near = matOf(s.P[V]) || k[1].near, far = matOf(s.P[1 - V]) || (k[1].far === k[1].near ? MATS.red : k[1].far);
  if (near !== k[1].near || far !== k[1].far) { R.matKey = [k[0], { near, far }]; swapMat(); } decor();
}
function update(s, V, opts = {}) {
  if (custom.skins) custom.skins(s); // each side's cards in their owner's skins (cards.js GameSkins)
  if (!R) { try { flatEvents(s, V, opts); } catch (e) { console.warn(e); } return Promise.resolve(); } R.last = { s, V };
  // flush: a jump (a replay seek) drops the animations still waiting in the queue, and the banner they raised
  if (opts.flush) { R.token = (R.token || 0) + 1; const band = document.querySelector(".banner .band"); if (band) { gsap.killTweensOf(band); gsap.set(band, { opacity: 0 }); } }
  const token = R.token || 0;
  R.queue = R.queue.then(async () => {
    if (!R || (R.token || 0) !== token) return;
    if (opts.reset || R.view !== V) { R.lastEv = s.evc || 0; R.view = V; }
    R.sig = [0, 1].map((p) => (s.P[p] && SIGILS[s.P[p].sig] ? s.P[p].sig : "lotus")); syncAvatars(s, V);
    applyMats(s, V); if (opts.reset) for (const p of [0, 1]) avatarDo(p, s.phase === "over" ? (s.winner === p ? "win" : "lose") : "rest");
    const evs = (s.ev || []).filter((e) => e.id > R.lastEv); R.lastEv = s.evc || R.lastEv;
    const drops = new Set(evs.filter((e) => e.k === "summon").map((e) => e.i)), burned = new Set(evs.filter((e) => e.k === "destroy").map((e) => e.i));
    for (const e of evs) if (e.k !== "summon") { try { await animateEvent(e, null, s, V); } catch (err) { console.warn(err); } }
    try { sync(s, V, drops, burned, !!opts.reset); } catch (err) { console.warn(err); } // a drawing problem must never stall the queue the bot waits on
    try { syncSide(s, V); } catch (err) { console.warn(err); }
    if (drops.size) await sleepMs(reduce ? 200 : 1150); else if (burned.size) await sleepMs(reduce ? 100 : 600);
  }).catch((err) => console.warn(err));
  return R.queue;
}
