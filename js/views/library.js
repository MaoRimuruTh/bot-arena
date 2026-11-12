import { h, lsGet, lsSet } from "../util.js?v=20261113015636";
import { CARDS, isBase, COLORS, setCode, ownedOf, isSpecialArt, isFav } from "../cards.js?v=20261113015636";
import { Views, cardBtn, showCard } from "../ui.js?v=20261113015636";

export const LibState = lsGet("bot.libFilter", { q: "", t: "", co: "", c: "", set: "", rare: "", sy: "", variants: false, owned: false });
export function filterCards(f) {
  const q = (f.q || "").trim().toLowerCase();
  return CARDS.filter((c) => {
    if (f.fav) { if (!isFav(c)) return false; } else if (f.special) { if (!isSpecialArt(c)) return false; } else if (!f.variants && !isBase(c)) return false;
    if (f.t && (f.t.length === 1 ? c.t !== f.t : !(c.t === "M" && c.st === f.t.slice(1)))) return false;
    if (f.co && (f.co === "none" ? !!c.co : c.co !== f.co)) return false;
    if (f.c !== "" && f.c != null) { const v = c.t === "M" ? null : c.c; if (f.c === "7" ? !(v >= 7) : v !== +f.c) return false; }
    if (f.set && setCode(c) !== f.set) return false;
    if (f.rare && c.r !== f.rare) return false;
    if (f.sy && c.sy !== f.sy) return false;
    if (f.owned && !ownedOf(c.i)) return false;
    if (q && !(c.n.toLowerCase().includes(q) || (c.x || "").toLowerCase().includes(q) || c.p.toLowerCase().includes(q) || (c.sy || "").includes(q))) return false;
    return true;
  });
}
export function filterBar(f, onChange, pfx = "") {
  const sets = [...new Set(CARDS.map(setCode))].sort();
  const syms = [...new Set(CARDS.map((c) => c.sy).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const sel = (id, label, key, options) => h("select", { id: pfx + id, "aria-label": label, onchange: (e) => { f[key] = e.target.value; onChange(); } }, options.map(([v, t]) => h("option", { value: v, selected: String(f[key] ?? "") === String(v) }, t)));
  let tm;
  return h("div", { class: "filters" },
    h("input", { type: "search", id: pfx + "q", placeholder: "ค้นชื่อ ข้อความ รหัส หรือ Symbol", value: f.q, "aria-label": "ค้นหา", style: "grid-column:span 2", oninput: (e) => { clearTimeout(tm); tm = setTimeout(() => { f.q = e.target.value; onChange(); }, 200); } }),
    sel("t", "ประเภท", "t", [["", "ทุกประเภท"], ["A", "Avatar"], ["MN", "Magic Normal"], ["MD", "Magic Modification"], ["MR", "Magic React"], ["ML", "Magic Land"], ["C", "Construct"], ["L", "LIFE"], ["T", "Token"]]),
    sel("co", "สี", "co", [["", "ทุกสี"], ...COLORS.map((c) => [c, "สี" + c]), ["none", "ไร้สี"]]),
    sel("c", "Cost", "c", [["", "ทุก Cost"], ...[0, 1, 2, 3, 4, 5, 6].map((n) => [String(n), "Cost " + n]), ["7", "Cost 7+"]]),
    sel("sy", "Symbol", "sy", [["", "ทุก Symbol"], ...syms.map((s) => [s, s])]),
    sel("set", "ชุด", "set", [["", "ทุกชุด"], ...sets.map((s) => [s, s])]),
    sel("rare", "ความหายาก", "rare", [["", "ทุกความหายาก"], ...["C", "R", "SR", "UR", "SCR", "USEC", "PR", "CBR"].map((r) => [r, r])]),
    h("div", { class: "row small" },
      h("label", { class: "chk" }, h("input", { type: "checkbox", id: pfx + "var", checked: f.variants, onchange: (e) => { f.variants = e.target.checked; onChange(); } }), "รวมภาพพิเศษ"),
      h("label", { class: "chk" }, h("input", { type: "checkbox", id: pfx + "sp", checked: f.special, onchange: (e) => { f.special = e.target.checked; onChange(); } }), "✦ เฉพาะภาพพิเศษ"),
      h("label", { class: "chk" }, h("input", { type: "checkbox", id: pfx + "fav", checked: !!f.fav, onchange: (e) => { f.fav = e.target.checked; onChange(); } }), "♥ ที่ชอบ"),
      h("label", { class: "chk" }, h("input", { type: "checkbox", id: pfx + "own", checked: f.owned, onchange: (e) => { f.owned = e.target.checked; onChange(); } }), "เฉพาะที่มี")));
}
Views.library = {
  render(root) {
    let limit = 120;
    const grid = h("div", { class: "grid-cards" }); const count = h("span", { class: "muted small num" }); const more = h("div", { class: "row", style: "justify-content:center;margin-top:18px" });
    const draw = () => {
      lsSet("bot.libFilter", LibState); const list = filterCards(LibState);
      count.textContent = `${list.length.toLocaleString()} ใบ`;
      grid.replaceChildren(...(list.length ? list.slice(0, limit).map((c) => h("div", { class: "libi" }, cardBtn(c.i, { onclick: () => showCard(c.i), own: ownedOf(c.i) ? "มี " + ownedOf(c.i) : null }), h("div", { class: "nm" }, c.n), h("div", { class: "tiny muted num" }, c.p + " · " + c.r))) : [h("div", { class: "empty", style: "grid-column:1/-1" }, "ไม่พบการ์ดที่ตรงกับตัวกรอง ลองล้างคำค้นหรือเปลี่ยนตัวกรอง")]));
      more.replaceChildren(list.length > limit ? h("button", { class: "btn", onclick: () => { limit += 120; draw(); } }, `แสดงเพิ่ม ${Math.min(120, list.length - limit)} ใบ`) : "");
    };
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", null, h("h1", null, "คลังการ์ด"), h("div", { class: "muted small" }, "ข้อมูลและภาพโหลดสดจากเว็บทางการ bottcg.com · ภาพ © PASULOL / LION HOUSE")), count), filterBar(LibState, () => { limit = 120; draw(); }), grid, more);
    draw();
  },
};
