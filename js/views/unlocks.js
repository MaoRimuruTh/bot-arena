// ปลดล็อค: everything the table can open up, and how. Only what play earns is here (nothing is bought, nothing is the owner's
// own): each card says what it opens, what to do for it, and how far along you are. Grouped by what it opens; a filter keeps
// the list short on a phone; the three nearest to done are pulled to the top.
import { h, busy } from "../util.js?v=20261115014158";
import { Data } from "../fb.js?v=20261115014158";
import { Views } from "../ui.js?v=20261115014158";
import { MATS } from "../arena3d.js?v=20261115014158";
import { ACH, progress, rewardName } from "../achieve.js?v=20261115014158";

const KINDS = [["av", "อวตาร 3 มิติ", "ยืนข้างแถบกลางสนามฝั่งคุณ"], ["mat", "ผ้าปูโต๊ะ", "ผ้าปูฝั่งคุณ คู่แข่งก็เห็น"], ["sig", "วงอัญเชิญ", "วงที่เปิดใต้การ์ดตอนเราอัญเชิญ"],
  ["win", "ฉากเมื่อชนะ", "สิ่งที่ลอยเต็มจอตอนเราชนะ"], ["deck", "เด็คกล่องพิเศษ", "เด็คกล่องที่เก่งกว่า Starter Deck"]];
const kindOf = (g) => KINDS.find(([k]) => g && g[k] != null);
const FILTERS = [["all", "ทั้งหมด"], ["locked", "ยังล็อค"], ["done", "ได้แล้ว"]];
let filter = "all";
// a small picture of what it opens: the mat's own lacquer, or a plain mark for the rest
const swatch = (g) => { if (g.mat && MATS[g.mat]) { const m = MATS[g.mat]; return h("span", { class: "unl-sw mat", style: `background:linear-gradient(160deg,${m.lac},${m.edge}.55))` }); }
  const k = kindOf(g); return h("span", { class: "unl-sw " + (k ? k[0] : ""), "aria-hidden": "true" }); };
const left = (p) => (p.need > 1 ? `อีก ${p.need - p.have}` : "ยังไม่สำเร็จ");
function card({ a, p }) {
  const pct = Math.round((p.have / p.need) * 100);
  return h("article", { class: "unl" + (p.done ? " done" : "") },
    h("div", { class: "unl-top" }, swatch(a.gives), h("div", { class: "unl-what" }, h("b", null, rewardName(a.gives).replace(/^(อวตาร |ผ้าปู|วงอัญเชิญ|ฉากชัยชนะ|เด็คกล่องพิเศษ )/, "")), h("span", { class: "tiny muted" }, a.name)),
      h("span", { class: "chip " + (p.done ? "good" : "lockchip") }, p.done ? "ได้แล้ว" : "ล็อคอยู่")),
    h("div", { class: "unl-how small" }, a.how),
    p.done ? h("div", { class: "tiny muted" }, "เลือกใช้ได้ที่ ตั้งค่า (กดชื่อของคุณมุมขวาบน)")
      : h("div", { class: "unl-prog" }, h("div", { class: "trk", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(p.need), "aria-valuenow": String(p.have), "aria-label": a.how }, h("i", { style: `width:${pct}%` })),
        h("span", { class: "num small" }, p.need > 1 ? `${p.have}/${p.need}` : "0/1"), h("span", { class: "tiny muted" }, left(p))));
}
Views.unlocks = {
  render(root) {
    const head = h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ปลดล็อค"), h("div", { class: "muted small" }, "ของทุกชิ้นในหน้านี้ได้จากการเล่นเท่านั้น ไม่มีการซื้อหรือเติมเงิน")));
    if (!Data.ready.matches) return root.replaceChildren(head, busy());
    const rows = ACH.filter((a) => a.gives && kindOf(a.gives)).map((a) => ({ a, p: progress(a, Data.matches) })), n = rows.filter((r) => r.p.done).length;
    const near = rows.filter((r) => !r.p.done).sort((x, y) => y.p.have / y.p.need - x.p.have / x.p.need || x.p.need - x.p.have - (y.p.need - y.p.have)).slice(0, 3);
    const seg = h("div", { class: "seg", role: "group", "aria-label": "แสดง" }, FILTERS.map(([k, t]) => h("button", { "aria-pressed": String(filter === k), onclick: () => { filter = k; this.render(root); } }, t)));
    const shown = rows.filter((r) => filter === "all" || (filter === "done") === r.p.done);
    root.replaceChildren(head,
      h("section", { class: "unl-sum panel" }, h("div", { class: "unl-count" }, h("b", { class: "num" }, String(n)), h("span", { class: "muted" }, ` จาก ${rows.length} ชิ้น`)),
        h("div", { class: "trk", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(rows.length), "aria-valuenow": String(n), "aria-label": "ปลดล็อคแล้ว" }, h("i", { style: `width:${Math.round((n / rows.length) * 100)}%` })),
        near.length ? h("div", { class: "unl-near" }, h("div", { class: "seglabel" }, "ใกล้สำเร็จที่สุด"), near.map(({ a, p }) => h("div", { class: "unl-nrow" }, h("span", null, rewardName(a.gives)), h("span", { class: "tiny muted" }, `${a.name} · ${left(p)}`)))) : h("div", { class: "small muted" }, "ปลดล็อคครบทุกชิ้นแล้ว")),
      h("div", { class: "row unl-bar" }, seg),
      ...KINDS.map(([k, title, what]) => { const list = shown.filter((r) => kindOf(r.a.gives)[0] === k); if (!list.length) return null; const got = rows.filter((r) => kindOf(r.a.gives)[0] === k && r.p.done).length, all = rows.filter((r) => kindOf(r.a.gives)[0] === k).length;
        return h("section", { class: "unl-group" }, h("header", null, h("h2", null, title), h("span", { class: "tiny muted" }, `${what} · ได้แล้ว ${got}/${all}`)), h("div", { class: "unl-grid" }, list.map(card))); }).filter(Boolean),
      shown.length ? null : h("div", { class: "empty" }, filter === "done" ? "ยังไม่ได้ปลดล็อคชิ้นไหน ลองเริ่มจากชนะบอทสักเกม" : "ปลดล็อคครบทุกชิ้นแล้ว"));
  },
  refresh(root) { this.render(root); },
};
