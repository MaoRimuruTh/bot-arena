import { h, openSheet, holo } from "./util.js?v=20261110162433";
import { CARDS, card, baseId, isBase, TYPE_TH, SUB_TH, colorOf, setName, artImg, ownedOf, variantsOf } from "./cards.js?v=20261110162433";
import { Data, saveOwned, saveSkins } from "./fb.js?v=20261110162433";
import { Ciel, cielAceCheck, aiErr } from "./ai.js?v=20261110162433";

export function cardBtn(id, opts = {}) {
  const c = card(id); const b = h("button", { class: "ccard" + (opts.cls ? " " + opts.cls : ""), type: "button", "aria-label": c ? c.n : "การ์ด", title: c ? c.n : "", onclick: opts.onclick });
  if (c) b.append(artImg(c));
  if (opts.badge) b.append(h("span", { class: "badge" }, opts.badge));
  if (opts.own) b.append(h("span", { class: "own" }, opts.own));
  return holo(b);
}
export function cardInfo(c) {
  const kv = []; const add = (k, v) => { if (v != null && v !== "") kv.push(h("dt", null, k), h("dd", null, v)); };
  add("ประเภท", TYPE_TH[c.t] + (c.st ? " · " + SUB_TH[c.st] : ""));
  add("สี", c.co ? h("span", { class: "row", style: "gap:6px" }, h("span", { class: "dot", style: "background:" + colorOf(c.co) }), c.co) : "ไร้สี");
  if (c.t !== "M") add("Cost", c.c != null ? h("span", { class: "num" }, c.c) : null);
  add("GEM", c.g != null ? h("span", { class: "num" }, c.g + (c.gc ? " (สี" + c.gc + ")" : "")) : null);
  add("POWER", c.pw != null ? h("span", { class: "num" }, c.pw) : null);
  add("Symbol", c.sy); add("รหัส", h("span", { class: "num" }, c.p + " · " + c.r)); add("ชุด", setName(c) + (c.dr ? " · " + c.dr : ""));
  add("จำกัด", c.o1 ? "Only #1 (1 ใบต่อเด็ค)" : c.lim ? c.lim + " ใบ" : "4 ใบต่อชื่อ");
  if (c.fl) add("สถานะ", c.fl === "le" ? "ลำเอียง: ใช้แข่งทางการไม่ได้" : "โดนใจ: การ์ดคอลแลบ แข่งได้");
  add("ภาพโดย", c.ar);
  return h("dl", { class: "kv" }, kv);
}
export function setOwned(id, n) { const k = String(baseId(id)); if (n > 0) Data.owned[k] = n; else delete Data.owned[k]; saveOwned(); }
export function showCard(id, extra) {
  const c = card(id); if (!c) return;
  const variants = (CARDS.byName.get(c.n) || []).filter((x) => x.i !== c.i && (x.b === baseId(c.i) || x.i === baseId(c.i)));
  const others = (CARDS.byName.get(c.n) || []).filter((x) => isBase(x) && x.i !== baseId(c.i));
  openSheet((api) => {
    const own = h("b", { class: "num" }, ownedOf(c.i));
    const aceBox = h("div");
    return [h("div", { class: "detail" }, holo(h("div", { class: "ccard", style: "cursor:default" }, artImg(c))),
      h("div", { class: "stack" }, cardInfo(c), c.x ? h("div", { class: "fx" }, c.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"), c.ex ? h("div", { class: "small muted" }, c.ex) : null,
        h("div", { class: "row" }, h("span", { class: "muted small" }, "ฉันมีจริง"), h("button", { class: "mini", "aria-label": "ลด", onclick: () => { setOwned(c.i, Math.max(0, ownedOf(c.i) - 1)); own.textContent = ownedOf(c.i); } }, "−"), own, h("button", { class: "mini", "aria-label": "เพิ่ม", onclick: () => { setOwned(c.i, ownedOf(c.i) + 1); own.textContent = ownedOf(c.i); } }, "+")),
        others.length ? h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, "ชื่อเดียวกันแต่คนละใบ · นับรวมโควตาชื่อ"), h("div", { class: "pick" }, others.map((v) => cardBtn(v.i, { badge: v.p, onclick: () => { api.close(); showCard(v.i, extra); } })))) : null,
        skinPicker(c, api, extra),
        extra ? extra(c, api) : null,
        c.t === "A" ? h("div", { class: "row" },
          h("button", { class: "btn ciel sm", onclick: async (e) => { const b = e.currentTarget; if (!Ciel.on()) { aceBox.replaceChildren(h("div", { class: "muted small" }, aiErr({ code: "no_key" }))); return; } b.disabled = true; aceBox.replaceChildren(h("span", { class: "muted small" }, "ชิเอลกำลังประเมิน…")); try { const r = await cielAceCheck(c); aceBox.replaceChildren(aceView(r)); } catch (err) { aceBox.replaceChildren(h("div", { class: "muted small" }, aiErr(err))); } b.disabled = false; } }, "ประเมินเป็นเอซ"),
          h("a", { class: "btn sm", href: "#decks/ace/" + c.i, onclick: () => api.close() }, "จัดเด็ครอบใบนี้")) : null, aceBox))];
  }, { title: c.n, sub: `${TYPE_TH[c.t]} · ${c.p}`, wide: true });
}
// choose which print of this card is shown everywhere (decks, hand, 3D arena)
function skinPicker(c, api, extra) {
  const all = variantsOf(c); if (all.length < 2) return null; const b = baseId(c.i);
  const cur = Data.skins[String(b)] != null ? +Data.skins[String(b)] : b;
  return h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, `สกินการ์ด · ${all.length} ภาพ`),
    h("div", { class: "pick" }, all.map((v) => h("div", { class: "stack", style: "gap:4px" },
      h("button", { class: "ccard" + (cur === v.i ? " sel" : ""), "aria-label": `${v.n} ${v.r}`, onclick: () => { api.close(); showCard(v.i, extra); } }, artImgRaw(v), h("span", { class: "badge" }, v.r)),
      cur === v.i ? h("span", { class: "chip gold", style: "justify-content:center" }, "ใช้อยู่") : h("button", { class: "btn sm", onclick: () => { if (v.i === b) delete Data.skins[String(b)]; else Data.skins[String(b)] = v.i; saveSkins(); api.close(); showCard(v.i, extra); } }, "ใช้ภาพนี้")))));
}
// art of exactly this print (ignores the player's skin choice)
function artImgRaw(v) { const saved = Data.skins[String(baseId(v.i))]; if (saved == null) return artImg(v); delete Data.skins[String(baseId(v.i))]; const im = artImg(v); Data.skins[String(baseId(v.i))] = saved; return im; }
function aceView(r) {
  const parts = (r.partners || []).map(card).filter(Boolean);
  return h("div", { class: "panel stack" }, h("div", { class: "row" }, h("span", { class: "chip " + (/[SA]/.test(r.rating) ? "good" : "warn") }, "ระดับเอซ " + (r.rating || "?")), h("span", { class: "small" }, r.why || "")),
    (r.needs || []).length ? h("ul", { class: "small", style: "margin:0;padding-left:18px" }, r.needs.map((x) => h("li", null, x))) : null,
    parts.length ? h("div", { class: "pick" }, parts.map((p) => cardBtn(p.i, { onclick: () => showCard(p.i) }))) : null);
}
// profile picture: "card:<print>" (card art), an image URL or data URL, or the first letter of the name
export function avatarEl(ava, name, cls = "") {
  const el = h("span", { class: "ava " + cls, "aria-hidden": "true" });
  if (ava && ava.startsWith("card:")) { const c = CARDS.find((x) => x.p === ava.slice(5)); if (c) { const im = artImg(c, "", ""); im.style.objectPosition = "50% 22%"; im.style.transform = "scale(1.6)"; el.append(im); return el; } }
  if (ava && /^(https:|data:image\/)/.test(ava)) { el.append(h("img", { src: ava, alt: "", referrerpolicy: "no-referrer" })); return el; }
  el.textContent = (name || "?").slice(0, 1); return el;
}
export const Views = {};
