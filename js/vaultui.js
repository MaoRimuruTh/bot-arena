// Settings for the owner's own things (vault.js): a picture for his half of the mat, a picture for his card sleeves and a
// 3D figure. A picture is framed here (drag to move it, slide to zoom) and saved twice: in full for his own screen, and
// smaller for opponents if he lets them see it. Shown only to the owner account.
import { h, toast, openSheet } from "./util.js?v=20261114182056";
import { Vault, onVault, vaultPut, vaultDrop, vaultMeta, vaultShow, shownNow, shownBlob, isOwner, vaultBlob } from "./vault.js?v=20261114182056";
import { matLines, sleeveFrame, MAT_ASPECT, FIG_FINISH, FIG_MOVES, figureViewer } from "./arena3d.js?v=20261114182056";
import { setMeta, Data } from "./fb.js?v=20261114182056";

const MAT_A = MAT_ASPECT, SLEEVE_A = 1.5 / 2.04, STAND_A = 0.7; // a player's playmat on their side of the table (arena3d.js); a card
const KIND = {
  mat: { a: MAT_A, full: 2048, show: 1280, title: "จัดภาพผ้าปู", pick: "bot.mat", label: "ผ้าปูของฉัน", hint: "ภาพนี้เป็นฝั่งของมาสเตอร์บนโต๊ะ เส้นทองคือกรอบโซนที่จะวาดทับ" },
  sleeve: { a: SLEEVE_A, full: 600, show: 360, title: "จัดภาพหลังการ์ด", pick: "bot.sleeve", label: "หลังการ์ดของฉัน", hint: "ภาพนี้จะอยู่หลังการ์ดทุกใบของมาสเตอร์ ทั้ง Deck และ LIFE ที่คว่ำอยู่" },
  stand: { a: STAND_A, full: 720, show: 420, title: "จัดภาพตั้งโต๊ะ", pick: "bot.av3", pickV: "stand", label: "ภาพตั้งโต๊ะของฉัน", hint: "ภาพนี้พิมพ์ลงแผ่นตั้งบนฐาน ยืนข้างโต๊ะฝั่งของมาสเตอร์ (แทนรูปปั้น 3 มิติ)" },
};
const loadImage = async (file) => { try { return await createImageBitmap(file); } catch { const u = URL.createObjectURL(file), im = new Image(); im.src = u; await im.decode(); return im; } };
const toBlob = (c, q) => new Promise((res) => c.toBlob(res, "image/jpeg", q));
// the picture drawn into a w×h frame: cover the frame, zoomed by st.z round the point (st.cx, st.cy) of the picture
function drawCrop(g, w, hh, img, st) {
  const s = Math.max(w / img.width, hh / img.height) * st.z, iw = img.width * s, ih = img.height * s;
  st.cx = Math.min(1 - w / (2 * iw), Math.max(w / (2 * iw), st.cx)); st.cy = Math.min(1 - hh / (2 * ih), Math.max(hh / (2 * ih), st.cy));
  g.drawImage(img, w / 2 - st.cx * iw, hh / 2 - st.cy * ih, iw, ih);
}
async function render(kind, img, st, w, q) {
  const c = document.createElement("canvas"); c.width = w; c.height = Math.round(w / KIND[kind].a); drawCrop(c.getContext("2d"), c.width, c.height, img, { ...st });
  let b = await toBlob(c, q); for (let qq = q - 0.08; b && b.size > 400 * 1024 && qq > 0.4; qq -= 0.08) b = await toBlob(c, qq); return b;
}

// the framing sheet: drag the picture, zoom it, (mat) choose how dark the lacquer veil over it is, choose whether opponents see it
function editor(kind, img) {
  const K = KIND[kind], st = { z: 1, cx: 0.5, cy: 0.5, veil: 0.38 }, W = kind === "mat" ? 1024 : 360, H = Math.round(W / K.a);
  const cv = h("canvas", { class: "vprev " + kind, width: W, height: H, "aria-label": "ตัวอย่างภาพ ลากเพื่อเลื่อน บีบสองนิ้วเพื่อซูม" }), g = cv.getContext("2d");
  const lines = kind === "mat" ? matLines() : null;
  const draw = () => { g.clearRect(0, 0, W, H); drawCrop(g, W, H, img, st);
    if (lines) { g.fillStyle = `rgba(13,11,18,${st.veil})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "screen"; g.drawImage(lines, 0, 0, W, H); g.globalCompositeOperation = "source-over"; }
    if (kind === "sleeve") sleeveFrame(g, W, H); }; // (the sleeve's edge and gloss are the table's, not part of the saved picture)
  // (the standee's white border and base are the table's too)
  // one finger (or the mouse) drags the picture; two fingers pinch to zoom; the mouse wheel zooms too (the slider follows)
  let drag = null, pinch = null; const pts = new Map();
  const setZ = (z) => { st.z = Math.min(3, Math.max(1, z)); if (zoom) zoom.value = String(st.z); draw(); };
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const restart = () => { const [p] = [...pts.values()]; drag = p ? { x: p.x, y: p.y, cx: st.cx, cy: st.cy } : null; };
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch {}
    if (pts.size >= 2) { pinch = { d: gap(), z: st.z }; drag = null; } else restart(); });
  cv.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) { setZ(pinch.z * (gap() / pinch.d)); return; }
    if (!drag) return; const r = cv.getBoundingClientRect(), k = W / r.width, s = Math.max(W / img.width, H / img.height) * st.z;
    st.cx = drag.cx - ((e.clientX - drag.x) * k) / (img.width * s); st.cy = drag.cy - ((e.clientY - drag.y) * k) / (img.height * s); draw(); });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; restart(); });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); setZ(st.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  const zoom = h("input", { type: "range", min: "1", max: "3", step: "0.01", value: "1", "aria-label": "ซูม", oninput: (e) => { st.z = +e.target.value; draw(); } });
  const veil = kind === "mat" ? h("input", { type: "range", min: "0", max: "0.7", step: "0.01", value: String(st.veil), "aria-label": "ความมืดของภาพ", oninput: (e) => { st.veil = +e.target.value; draw(); } }) : null;
  const show = h("input", { type: "checkbox", checked: kind === "mat" || shownNow(kind) });
  draw();
  openSheet((api) => [h("div", { class: "small muted" }, K.hint), cv, h("div", { class: "tiny muted" }, "ลากภาพเพื่อเลื่อน บีบสองนิ้ว เลื่อนลูกกลิ้ง หรือเลื่อนแถบเพื่อซูม"),
    h("label", { class: "vrow" }, h("span", null, "ซูม"), zoom), veil ? h("label", { class: "vrow" }, h("span", null, "ความมืดของภาพ"), veil) : null,
    h("label", { class: "vcheck" }, show, h("span", null, "ให้คู่แข่งเห็นภาพนี้บนโต๊ะของเขา (ได้แค่ฉบับย่อ ไม่มีทางโหลดไฟล์)")),
    h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = "กำลังบันทึก…";
      try { const full = await render(kind, img, st, K.full, 0.9), small = show.checked ? await render(kind, img, st, K.show, 0.82) : null;
        await vaultPut(kind, full, kind === "mat" ? { veil: st.veil } : {}); await vaultShow(kind, small, kind === "mat" ? { veil: st.veil } : {});
        try { localStorage.setItem(K.pick, K.pickV || "own"); } catch {} toast(`บันทึก${K.label}แล้ว ใช้ตั้งแต่เกมถัดไป`); api.close(); }
      catch (er) { console.warn(er); toast("บันทึกไม่สำเร็จ: " + (er.message || er), "bad"); b.disabled = false; b.textContent = "บันทึก"; } } }, "บันทึก"),
      h("button", { class: "btn", onclick: () => api.close() }, "ยกเลิก"))].filter(Boolean), { title: K.title, wide: kind === "mat" });
}

// a small picture of what is stored
function thumb(kind) {
  const K = KIND[kind], w = kind === "mat" ? 240 : 66, c = h("canvas", { class: "vthumb " + kind, width: w, height: Math.round(w / K.a) });
  vaultBlob(kind).then((b) => b && createImageBitmap(b)).then((bm) => { if (!bm) return; const g = c.getContext("2d"); g.drawImage(bm, 0, 0, c.width, c.height); if (kind === "sleeve") sleeveFrame(g, c.width, c.height); }).catch(() => {});
  return c;
}
const filePick = (accept, fn) => { const i = h("input", { type: "file", accept, hidden: true, onchange: async () => { const f = i.files && i.files[0]; i.value = ""; if (f) await fn(f); } }); return i; };
const isGlb = async (f) => { const b = new Uint8Array(await f.slice(0, 4).arrayBuffer()); return b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46; }; // "glTF"
// whether a .glb is painted (a texture, colours on its points, or materials of more than one colour): its own colours are
// then the figure's finish when it is uploaded; an unpainted print model starts as porcelain
async function glbPainted(f) {
  try { const head = new DataView(await f.slice(12, 20).arrayBuffer()), n = head.getUint32(0, true);
    const j = JSON.parse(new TextDecoder().decode(await f.slice(20, 20 + n).arrayBuffer()));
    if ((j.textures || []).length) return true;
    if ((j.meshes || []).some((m) => (m.primitives || []).some((p) => p.attributes && p.attributes.COLOR_0 != null))) return true;
    return new Set((j.materials || []).map((m) => String((m.pbrMetallicRoughness || {}).baseColorFactor || "1,1,1,1"))).size > 1;
  } catch { return false; }
}

// the figure up close: turn it, zoom in, play each of its moves; the copy opponents see can be looked at the same way
function figSheet() {
  const it = Vault.m && Vault.m.fig; if (!it) return;
  const stage = h("div", { class: "figstage" }), moves = h("div", { class: "seg wrap figmoves", role: "group", "aria-label": "ท่าของรูปปั้น" });
  let url = null, viewer = null, which = "full", zoom = "whole";
  const sh = Data.meta && Data.meta.show && Data.meta.show.fig;
  const load = () => {
    if (url) URL.revokeObjectURL(url); url = null; viewer = null; moves.replaceChildren();
    const holder = h("div", { class: "figholder" }, h("div", { class: "figload small muted" }, "กำลังโหลดรูปปั้น…")); stage.replaceChildren(holder); // (the viewer before it stops once its box is gone)
    (which === "shown" ? shownBlob("fig") : vaultBlob("fig")).then((b) => { if (!b || !holder.isConnected) return false; url = URL.createObjectURL(b); viewer = figureViewer(holder, url, which === "shown" ? (sh && sh.finish) || "" : it.finish || ""); return viewer.ready; })
      .then((ok) => { const l = holder.querySelector(".figload"); if (l) l.remove(); if (!holder.isConnected) return;
        if (!ok) { holder.append(h("div", { class: "figload small muted" }, "เปิดรูปปั้นไม่ได้")); return; }
        viewer.view(zoom); moves.replaceChildren(...viewer.moves().map((k) => h("button", { onclick: () => viewer.play(k) }, FIG_MOVES[k]))); })
      .catch(() => { const l = holder.querySelector(".figload"); if (l) l.textContent = "เปิดรูปปั้นไม่ได้"; });
  };
  const pick = shownNow("fig") ? h("div", { class: "seg", role: "group", "aria-label": "ฉบับ" }, [["full", "ฉบับเต็ม"], ["shown", "ฉบับที่คู่แข่งเห็น"]].map(([k, t]) => h("button", { "aria-pressed": k === which ? "true" : "false",
    onclick: (e) => { which = k; for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); load(); } }, t))) : null;
  const near = h("div", { class: "seg", role: "group", "aria-label": "ระยะ" }, [["whole", "ทั้งตัว"], ["close", "ใกล้ ๆ"]].map(([k, t], i) => h("button", { "aria-pressed": i ? "false" : "true",
    onclick: (e) => { zoom = k; if (viewer) viewer.view(k); for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); } }, t)));
  openSheet(() => [stage, h("div", { class: "row wrap", style: "gap:8px;justify-content:space-between" }, near, pick), moves,
    h("div", { class: "tiny muted" }, "ลากเพื่อหมุน บีบสองนิ้วหรือเลื่อนลูกกลิ้งเพื่อซูม กดชื่อท่าเพื่อดูท่านั้น")].filter(Boolean),
    { title: "รูปปั้นของฉัน", wide: true, onClose: () => { if (url) URL.revokeObjectURL(url); } });
  load();
}

function rows() {
  const out = [];
  for (const kind of ["mat", "sleeve", "stand"]) {
    const K = KIND[kind], has = Vault.has(kind), shown = shownNow(kind);
    const pick = filePick("image/*", async (f) => { try { editor(kind, await loadImage(f)); } catch { toast("เปิดรูปนี้ไม่ได้", "bad"); } });
    out.push(h("div", { class: "vitem" }, has ? thumb(kind) : h("div", { class: "vthumb empty " + kind }, "ยังไม่มีภาพ"),
      h("div", { class: "stack", style: "gap:6px;min-width:0" }, h("b", null, K.label), h("span", { class: "tiny muted" }, has ? (shown ? "คู่แข่งเห็นฉบับย่อบนโต๊ะของเขา" : "เห็นแค่บนเครื่องของมาสเตอร์") : "เลือกรูปแล้วจัดตำแหน่งได้"),
        h("div", { class: "row wrap" }, pick, h("button", { class: "btn sm gold", onclick: () => pick.click() }, has ? "เปลี่ยนรูป" : "เลือกรูป"),
          has && shown ? h("button", { class: "btn sm", onclick: () => vaultShow(kind, null).then(() => toast("ซ่อนจากคู่แข่งแล้ว")).catch(() => toast("ทำไม่สำเร็จ", "bad")) }, "ซ่อนจากคู่แข่ง") : null,
          has ? h("button", { class: "btn sm danger", onclick: () => vaultDrop(kind).then(() => toast("ลบแล้ว")).catch(() => toast("ลบไม่สำเร็จ", "bad")) }, "ลบ") : null))));
  }
  // the figure: the full model for his own screen, and (optional) a lighter one for opponents
  const has = Vault.has("fig"), it = Vault.m && Vault.m.fig, shown = shownNow("fig"), fin = (it && it.finish) || "porcelain";
  const load = (show) => filePick(".glb,model/gltf-binary", async (f) => {
    if (!(await isGlb(f))) return toast("ต้องเป็นไฟล์ .glb", "bad");
    try { if (show) { await vaultShow("fig", f, { finish: fin }); toast("คู่แข่งจะเห็นรูปปั้นฉบับเบาแล้ว"); }
      else { const painted = await glbPainted(f), finish = painted ? "file" : has ? (fin === "file" ? "porcelain" : fin) : "porcelain"; // a painted model shows its own colours
        await vaultPut("fig", f, { finish, name: f.name.slice(0, 60) }); if (shown && finish !== fin) await setMeta({ show: { fig: { finish } } });
        try { localStorage.setItem("bot.av3", "own"); } catch {} toast(painted ? "บันทึกรูปปั้นแล้ว ใช้สีจากไฟล์ ตั้งแต่เกมถัดไป" : "บันทึกรูปปั้นแล้ว ใช้ตั้งแต่เกมถัดไป"); } }
    catch (er) { toast("บันทึกไม่สำเร็จ: " + (er.message || er), "bad"); } });
  const full = load(false), light = load(true);
  out.push(h("div", { class: "vitem" }, h("div", { class: "vthumb empty fig" + (has ? " has" : "") }, has ? "🗿" : "ยังไม่มีไฟล์"),
    h("div", { class: "stack", style: "gap:6px;min-width:0" }, h("b", null, "รูปปั้นของฉัน"), h("span", { class: "tiny muted" }, has ? (shown ? "คู่แข่งเห็นฉบับเบาบนโต๊ะของเขา" : "เห็นแค่บนเครื่องของมาสเตอร์") + (it.name ? " · " + it.name : "") : "ไฟล์ .glb ไม่เกิน 6 MB"),
      has ? h("div", { class: "seg wrap", role: "group", "aria-label": "ผิวรูปปั้น" }, Object.entries(FIG_FINISH).map(([k, t]) => h("button", { "aria-pressed": fin === k ? "true" : "false", onclick: async () => {
        try { await vaultMeta("fig", { finish: k }); if (shown) await setMeta({ show: { fig: { finish: k } } }); toast("ผิวรูปปั้น: " + t); } catch { toast("เปลี่ยนไม่สำเร็จ", "bad"); } } }, t))) : null,
      h("div", { class: "row wrap" }, full, light, has ? h("button", { class: "btn sm gold", onclick: figSheet }, "ดู 3D") : null, h("button", { class: "btn sm" + (has ? "" : " gold"), onclick: () => full.click() }, has ? "เปลี่ยนไฟล์" : "เลือกไฟล์ .glb"),
        has ? h("button", { class: "btn sm", onclick: () => light.click() }, shown ? "เปลี่ยนฉบับให้คู่แข่งเห็น" : "ให้คู่แข่งเห็น (ไฟล์เบา ≤ 420 KB)") : null,
        shown ? h("button", { class: "btn sm", onclick: () => vaultShow("fig", null).then(() => toast("ซ่อนจากคู่แข่งแล้ว")).catch(() => toast("ทำไม่สำเร็จ", "bad")) }, "ซ่อนจากคู่แข่ง") : null,
        has ? h("button", { class: "btn sm danger", onclick: () => vaultDrop("fig").then(() => vaultShow("fig", null)).then(() => toast("ลบแล้ว")).catch(() => toast("ลบไม่สำเร็จ", "bad")) }, "ลบ") : null))));
  return out;
}
let live = null;
export function vaultSection() {
  if (!isOwner()) return [];
  const box = h("div", { class: "stack", style: "gap:10px" }), paint = () => box.replaceChildren(...rows());
  paint(); if (live) live(); live = onVault(() => { if (box.isConnected) paint(); else if (live) { live(); live = null; } });
  // what opponents see is kept with the shared settings: repaint when that changes too
  const sig = () => { const sh = Data.meta && Data.meta.show; return sh ? Object.entries(sh).map(([k, v]) => k + ":" + (v && v.v) + ":" + (v && v.finish)).join() : ""; };
  let last = sig(); const dl = () => { if (!box.isConnected) { Data.listeners.delete(dl); return; } const now = sig(); if (now !== last) { last = now; paint(); } }; Data.listeners.add(dl);
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "ของส่วนตัวของมาสเตอร์ (บัญชีเจ้าของสนามเท่านั้น)"),
    h("div", { class: "small muted" }, "เก็บในพื้นที่ส่วนตัวของบัญชีนี้ ไม่อยู่ในโค้ดของเว็บ และไม่มีปุ่มให้ใครโหลดไฟล์ ถ้าเปิดให้คู่แข่งเห็น เขาจะได้แค่ฉบับย่อที่วาดบนโต๊ะ"), box];
}
