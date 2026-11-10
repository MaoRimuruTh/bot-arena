import { h, openSheet, fmtDate, busy } from "../util.js?v=20261110223558";
import { Data } from "../fb.js?v=20261110223558";
import { Views } from "../ui.js?v=20261110223558";

const MODE_TH = { bot: "บอท", friend: "เพื่อน", solo: "สองฝั่ง" };
Views.history = {
  render(root) {
    const ms = Data.matches;
    const head = h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ประวัติการดวล"), h("div", { class: "muted small" }, "ทุกเกมที่จบจะบันทึกอัตโนมัติ ชิเอลใช้ข้อมูลนี้วิเคราะห์เด็ค")));
    if (!Data.ready.matches) return root.replaceChildren(head, busy());
    if (!ms.length) return root.replaceChildren(head, h("div", { class: "empty" }, "ยังไม่มีเกมที่จบ ลงสนามสักเกมก่อนนะ"));
    const w = ms.filter((m) => m.result === "win").length;
    const byDeck = {};
    for (const m of ms) { const k = m.deckName || "ไม่ทราบ"; byDeck[k] = byDeck[k] || { n: 0, w: 0, t: 0 }; byDeck[k].n++; byDeck[k].t += m.turns || 0; if (m.result === "win") byDeck[k].w++; }
    root.replaceChildren(head,
      h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เกมทั้งหมด"), h("b", null, ms.length)), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ชนะ"), h("b", { style: "color:#8ee3b2" }, Math.round((w / ms.length) * 100) + "%")),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เทิร์นเฉลี่ย"), h("b", null, (ms.reduce((a, m) => a + (m.turns || 0), 0) / ms.length).toFixed(1)))),
      h("div", { class: "setup", style: "margin-top:18px" },
        h("div", { class: "stack", style: "gap:8px" }, ms.slice(0, 100).map((m) => h("button", { class: "mrow", onclick: () => openSheet(() => [h("div", { class: "small muted" }, `${fmtDate(m.at)} · ${MODE_TH[m.mode] || ""} · ${m.first ? "เล่นก่อน" : "เล่นหลัง"} · ${m.turns} เทิร์น`), h("div", null, m.reason || ""), h("div", { class: "glog", style: "max-height:none" }, (m.log || []).map((l) => h("div", null, l)))], { title: `${m.deckName} vs ${m.oppDeck}` }) },
          h("span", { class: "chip " + (m.result === "win" ? "good" : m.result === "loss" ? "bad" : "") }, m.result === "win" ? "ชนะ" : m.result === "loss" ? "แพ้" : "เสมอ"),
          h("div", { class: "grow", style: "min-width:0" }, h("b", null, `${m.deckName} vs ${m.oppDeck || m.opp}`), h("div", { class: "tiny muted" }, `${m.opp} · ${MODE_TH[m.mode] || ""} · ${m.turns} เทิร์น · ${m.reason || ""}`)),
          h("span", { class: "tiny muted" }, fmtDate(m.at))))),
        h("div", { class: "panel stack" }, h("div", { class: "eyebrow" }, "อัตราชนะแยกเด็ค"), h("div", { class: "bars" }, Object.entries(byDeck).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => h("div", { class: "bar" }, h("span", null, `${k} (${v.n})`), h("div", { class: "trk" }, h("i", { style: `width:${(v.w / v.n) * 100}%` })), h("span", { class: "num small" }, Math.round((v.w / v.n) * 100) + "%")))))));
  },
  refresh(root) { this.render(root); },
};
