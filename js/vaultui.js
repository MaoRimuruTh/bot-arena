// Settings for the owner's own things (vault.js): a picture for his half of the mat, a picture for his card sleeves and a
// 3D figure. A picture is framed here (drag to move it, slide to zoom) and saved twice: in full for his own screen, and
// smaller for opponents if he lets them see it. Shown only to the owner account.
import { h, toast, openSheet } from "./util.js?v=20261112182606";
import { Vault, onVault, vaultPut, vaultDrop, vaultMeta, vaultShow, shownNow, isOwner, vaultBlob } from "./vault.js?v=20261112182606";
import { matLines, FIG_FINISH } from "./arena3d.js?v=20261112182606";
import { setMeta, Data } from "./fb.js?v=20261112182606";

const MAT_A = 15.4 / 5.8, SLEEVE_A = 1.5 / 2.04; // one side of the table; a card
const KIND = {
  mat: { a: MAT_A, full: 2048, show: 1280, title: "จัดภาพผ้าปู", pick: "bot.mat", label: "ผ้าปูของฉัน", hint: "ภาพนี้เป็นฝั่งของมาสเตอร์บนโต๊ะ เส้นทองคือกรอบโซนที่จะวาดทับ" },
  sleeve: { a: SLEEVE_A, full: 600, show: 360, title: "จัดภาพหลังการ์ด", pick: "bot.sleeve", label: "หลังการ์ดของฉัน", hint: "ภาพนี้จะอยู่หลังการ์ดทุกใบของมาสเตอร์ ทั้ง Deck และ LIFE ที่คว่ำอยู่" },
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
  const cv = h("canvas", { class: "vprev " + kind, width: W, height: H, "aria-label": "ตัวอย่างภาพ ลากเพื่อเลื่อน" }), g = cv.getContext("2d");
  const lines = kind === "mat" ? matLines() : null;
  const draw = () => { g.clearRect(0, 0, W, H); drawCrop(g, W, H, img, st);
    if (lines) { g.fillStyle = `rgba(13,11,18,${st.veil})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "screen"; g.drawImage(lines, 0, 0, W, H); g.globalCompositeOperation = "source-over"; } };
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy }; try { cv.setPointerCapture(e.pointerId); } catch {} });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; const r = cv.getBoundingClientRect(), k = W / r.width, s = Math.max(W / img.width, H / img.height) * st.z;
    st.cx = drag.cx - ((e.clientX - drag.x) * k) / (img.width * s); st.cy = drag.cy - ((e.clientY - drag.y) * k) / (img.height * s); draw(); });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, () => { drag = null; });
  const zoom = h("input", { type: "range", min: "1", max: "3", step: "0.01", value: "1", "aria-label": "ซูม", oninput: (e) => { st.z = +e.target.value; draw(); } });
  const veil = kind === "mat" ? h("input", { type: "range", min: "0", max: "0.7", step: "0.01", value: String(st.veil), "aria-label": "ความมืดของภาพ", oninput: (e) => { st.veil = +e.target.value; draw(); } }) : null;
  const show = h("input", { type: "checkbox", checked: kind === "mat" || shownNow(kind) });
  draw();
  openSheet((api) => [h("div", { class: "small muted" }, K.hint), cv, h("div", { class: "tiny muted" }, "ลากภาพเพื่อเลื่อน เลื่อนแถบเพื่อซูม"),
    h("label", { class: "vrow" }, h("span", null, "ซูม"), zoom), veil ? h("label", { class: "vrow" }, h("span", null, "ความมืดของภาพ"), veil) : null,
    h("label", { class: "vcheck" }, show, h("span", null, "ให้คู่แข่งเห็นภาพนี้บนโต๊ะของเขา (ได้แค่ฉบับย่อ ไม่มีทางโหลดไฟล์)")),
    h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = "กำลังบันทึก…";
      try { const full = await render(kind, img, st, K.full, 0.9), small = show.checked ? await render(kind, img, st, K.show, 0.82) : null;
        await vaultPut(kind, full, kind === "mat" ? { veil: st.veil } : {}); await vaultShow(kind, small, kind === "mat" ? { veil: st.veil } : {});
        try { localStorage.setItem(K.pick, "own"); } catch {} toast(`บันทึก${K.label}แล้ว ใช้ตั้งแต่เกมถัดไป`); api.close(); }
      catch (er) { console.warn(er); toast("บันทึกไม่สำเร็จ: " + (er.message || er), "bad"); b.disabled = false; b.textContent = "บันทึก"; } } }, "บันทึก"),
      h("button", { class: "btn", onclick: () => api.close() }, "ยกเลิก"))].filter(Boolean), { title: K.title, wide: kind === "mat" });
}

// a small picture of what is stored
function thumb(kind) {
  const K = KIND[kind], w = kind === "mat" ? 240 : 66, c = h("canvas", { class: "vthumb " + kind, width: w, height: Math.round(w / K.a) });
  vaultBlob(kind).then((b) => b && createImageBitmap(b)).then((bm) => { if (bm) c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height); }).catch(() => {});
  return c;
}
const filePick = (accept, fn) => { const i = h("input", { type: "file", accept, hidden: true, onchange: async () => { const f = i.files && i.files[0]; i.value = ""; if (f) await fn(f); } }); return i; };
const isGlb = async (f) => { const b = new Uint8Array(await f.slice(0, 4).arrayBuffer()); return b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46; }; // "glTF"

function rows() {
  const out = [];
  for (const kind of ["mat", "sleeve"]) {
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
    try { if (show) { await vaultShow("fig", f, { finish: fin }); toast("คู่แข่งจะเห็นรูปปั้นฉบับเบาแล้ว"); } else { await vaultPut("fig", f, { finish: fin, name: f.name.slice(0, 60) }); try { localStorage.setItem("bot.av3", "own"); } catch {} toast("บันทึกรูปปั้นแล้ว ใช้ตั้งแต่เกมถัดไป"); } }
    catch (er) { toast("บันทึกไม่สำเร็จ: " + (er.message || er), "bad"); } });
  const full = load(false), light = load(true);
  out.push(h("div", { class: "vitem" }, h("div", { class: "vthumb empty fig" }, has ? "🗿" : "ยังไม่มี"),
    h("div", { class: "stack", style: "gap:6px;min-width:0" }, h("b", null, "รูปปั้นของฉัน"), h("span", { class: "tiny muted" }, has ? (shown ? "คู่แข่งเห็นฉบับเบาบนโต๊ะของเขา" : "เห็นแค่บนเครื่องของมาสเตอร์") + (it.name ? " · " + it.name : "") : "ไฟล์ .glb ไม่เกิน 6 MB"),
      has ? h("div", { class: "seg wrap", role: "group", "aria-label": "ผิวรูปปั้น" }, Object.entries(FIG_FINISH).map(([k, t]) => h("button", { "aria-pressed": fin === k ? "true" : "false", onclick: async () => {
        try { await vaultMeta("fig", { finish: k }); if (shown) await setMeta({ show: { fig: { finish: k } } }); toast("ผิวรูปปั้น: " + t); } catch { toast("เปลี่ยนไม่สำเร็จ", "bad"); } } }, t))) : null,
      h("div", { class: "row wrap" }, full, light, h("button", { class: "btn sm gold", onclick: () => full.click() }, has ? "เปลี่ยนไฟล์" : "เลือกไฟล์ .glb"),
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
