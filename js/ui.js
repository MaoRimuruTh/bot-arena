import { h, openSheet, holo, toast, fmtDate } from "./util.js?v=20261112035142";
import { fxText, kwGloss } from "./fxtext.js?v=20261112035142";
import { CARDS, card, baseId, isBase, TYPE_TH, SUB_TH, colorOf, setName, artImg, ownedOf, variantsOf, favKey, isFav, isSpecialArt, priceOf, setCode } from "./cards.js?v=20261112035142";
import { Data, saveOwned, saveSkins, saveFavs, savePrices } from "./fb.js?v=20261112035142";
import { Ciel, cielAceCheck, aiErr } from "./ai.js?v=20261112035142";

export function cardBtn(id, opts = {}) {
  const c = card(id); const b = h("button", { class: "ccard" + (opts.cls ? " " + opts.cls : "") + (opts.note ? " noted" : ""), type: "button", "aria-label": c ? c.n + (opts.note ? " · " + opts.note : "") : "การ์ด", title: c ? c.n : "", onclick: opts.onclick });
  if (c) b.append(artImg(c));
  if (opts.note) b.append(h("span", { class: "why" }, opts.note)); // why this card cannot be chosen
  if (opts.badge) b.append(h("span", { class: "badge" }, opts.badge));
  if (opts.own) b.append(h("span", { class: "own" }, opts.own));
  if (c && opts.heart !== false && isFav(c)) b.append(h("span", { class: "fav", "aria-label": "การ์ดที่ชอบ" }, "♥"));
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
      h("div", { class: "stack" }, favButton(c), cardInfo(c), c.x ? fxText(c.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"), kwGloss(c.x), c.ex ? h("div", { class: "small muted" }, c.ex) : null,
        h("div", { class: "row" }, h("span", { class: "muted small" }, "ฉันมีจริง"), h("button", { class: "mini", "aria-label": "ลด", onclick: () => { setOwned(c.i, Math.max(0, ownedOf(c.i) - 1)); own.textContent = ownedOf(c.i); } }, "−"), own, h("button", { class: "mini", "aria-label": "เพิ่ม", onclick: () => { setOwned(c.i, ownedOf(c.i) + 1); own.textContent = ownedOf(c.i); } }, "+")),
        others.length ? h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, "ชื่อเดียวกันแต่คนละใบ · นับรวมโควตาชื่อ"), h("div", { class: "pick" }, others.map((v) => cardBtn(v.i, { badge: v.p, onclick: () => { api.close(); showCard(v.i, extra); } })))) : null,
        skinPicker(c, api, extra), priceBox(c),
        extra ? extra(c, api) : null,
        c.t === "A" ? h("div", { class: "row" },
          h("button", { class: "btn ciel sm", onclick: async (e) => { const b = e.currentTarget; if (!Ciel.on()) { aceBox.replaceChildren(h("div", { class: "muted small" }, aiErr({ code: "no_key" }))); return; } b.disabled = true; aceBox.replaceChildren(h("span", { class: "muted small" }, "ชิเอลกำลังประเมิน…")); try { const r = await cielAceCheck(c); aceBox.replaceChildren(aceView(r)); } catch (err) { aceBox.replaceChildren(h("div", { class: "muted small" }, aiErr(err))); } b.disabled = false; } }, "ประเมินเป็นเอซ"),
          h("a", { class: "btn sm", href: "#decks/ace/" + c.i, onclick: () => api.close() }, "จัดเด็ครอบใบนี้")) : null, aceBox))];
  }, { title: c.n, sub: `${TYPE_TH[c.t]} · ${c.p}`, wide: true });
}
// market check: which box each print comes from, links to look the card up, and prices the player noted down
const SRC = ["TCG Thailand", "Shopee", "ร้านการ์ด", "กลุ่ม Facebook", "อื่นๆ"];
function priceBox(c) {
  const prints = variantsOf(c); const q = encodeURIComponent(c.n);
  const box = h("div", { class: "panel stack", style: "gap:8px" });
  const draw = () => {
    const last = priceOf(c); const hist = ((Data.prices[favKey(c)] || {}).h || []).slice(-5).reverse();
    const inp = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric", placeholder: "ราคา (บาท)", "aria-label": "ราคาที่เห็น (บาท)", style: "width:120px" });
    const src = h("select", { "aria-label": "เห็นราคาจากที่ไหน" }, SRC.map((s) => h("option", { value: s }, s)));
    box.replaceChildren(h("div", { class: "eyebrow" }, "เทียบราคาตลาด · ข้อมูลอ้างอิง ไม่มีการซื้อขายในเว็บนี้"),
      h("div", { class: "small" }, h("b", null, "มาจาก: "), prints.map((v) => `${setCode(v)} ${v.r}${v.dr ? " (" + v.dr + ")" : ""}`).join(" · ")),
      h("div", { class: "row", style: "gap:6px" },
        h("a", { class: "btn sm", href: `https://www.tcgthailand.com/product?search=${q}&page=1`, target: "_blank", rel: "noopener noreferrer" }, "เช็คราคาที่ TCG Thailand ↗"),
        h("a", { class: "btn sm", href: `https://shopee.co.th/search?keyword=${encodeURIComponent(c.n + " battle of talingchan")}`, target: "_blank", rel: "noopener noreferrer" }, "ค้นใน Shopee ↗")),
      h("div", { class: "tiny muted" }, `ภาพ ${c.r} ใบนี้ (${c.p})${c.r === "SCR" ? " · ในตลาดมักเรียก SCR ว่า SEC" : ""} · ราคาต่างกันมากตามความหายากและสภาพการ์ด`),
      last ? h("div", { class: "row small" }, h("span", { class: "chip gold num" }, `฿${last.p.toLocaleString()}`), h("span", { class: "muted" }, `จดล่าสุด ${fmtDate(last.at)} · ${last.src || ""}`)) : h("div", { class: "small muted" }, "ยังไม่ได้จดราคาใบนี้"),
      h("div", { class: "row", style: "gap:6px" }, inp, src, h("button", { class: "btn sm gold", onclick: async () => { const p = Math.round(+inp.value); if (!(p >= 0) || inp.value === "") return toast("ใส่ราคาเป็นตัวเลขก่อน");
        const k = favKey(c); const e = Data.prices[k] || { h: [] }; e.h = [...(e.h || []), { p, at: Date.now(), src: src.value }].slice(-12); Data.prices[k] = e; await savePrices(); toast(`จดราคา ${c.n} ${c.r} ฿${p}`); draw(); } }, "จดราคา")),
      hist.length > 1 ? h("div", { class: "tiny muted" }, "ประวัติ: " + hist.map((x) => `฿${x.p} (${fmtDate(x.at)})`).join(" · ")) : null);
  };
  draw(); return box;
}
// ♥ favourite: Ciel can build a deck from these, and a favourite special art becomes the card's skin
export function toggleFav(c) {
  const k = favKey(c); if (Data.favs[k]) delete Data.favs[k]; else { Data.favs[k] = Date.now(); if (c.b != null && Data.skins[String(c.b)] == null) { Data.skins[String(c.b)] = c.i; saveSkins(); } }
  saveFavs(); Data.listeners.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
}
function favButton(c) {
  const b = h("button", { class: "btn sm fav-btn", "aria-pressed": isFav(c) ? "true" : "false" });
  const paint = () => { const on = isFav(c); b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "♥ อยู่ในการ์ดที่ชอบ" : "♡ เก็บเป็นการ์ดที่ชอบ"; };
  b.onclick = () => { toggleFav(c); paint(); }; paint();
  return h("div", { class: "row", style: "gap:8px" }, b, isSpecialArt(c) ? h("span", { class: "chip gold" }, "✦ ภาพพิเศษ " + c.r) : null);
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
