import { h, openSheet, fmtDate, busy } from "../util.js?v=20261112002434";
import { Data, Me } from "../fb.js?v=20261112002434";
import { Views, avatarEl } from "../ui.js?v=20261112002434";
import { ladder, ladderNow, ladderFresh } from "../ladder.js?v=20261112002434";
import { stars } from "../quests.js?v=20261112002434";
import { hasReplay, openReplay } from "./play.js?v=20261112002434";
import { ACH, progress, rewardName } from "../achieve.js?v=20261112002434";

const MODE_TH = { bot: "บอท", friend: "เพื่อน", solo: "สองฝั่ง", goldfish: "ซ้อมมือเดียว" };
Views.history = {
  render(root) {
    const all = Data.matches, ms = all.filter((m) => m.mode !== "goldfish"), fish = all.filter((m) => m.mode === "goldfish"); // practice against the dummy is kept out of the win rates
    const head = h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ประวัติการดวล"), h("div", { class: "muted small" }, "ทุกเกมที่จบจะบันทึกอัตโนมัติ ชิเอลใช้ข้อมูลนี้วิเคราะห์เด็ค")));
    if (!Data.ready.matches) return root.replaceChildren(head, busy());
    if (!all.length) return root.replaceChildren(head, h("div", { class: "stack" }, h("div", { class: "empty" }, "ยังไม่มีเกมที่จบ ลงสนามสักเกมก่อนนะ"), ladderPanel()));
    const w = ms.filter((m) => m.result === "win").length;
    const byDeck = {};
    for (const m of ms) { const k = m.deckName || "ไม่ทราบ"; byDeck[k] = byDeck[k] || { n: 0, w: 0, t: 0 }; byDeck[k].n++; byDeck[k].t += m.turns || 0; if (m.result === "win") byDeck[k].w++; }
    root.replaceChildren(head,
      h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เกมทั้งหมด"), h("b", null, ms.length)), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ชนะ"), h("b", { style: "color:#8ee3b2" }, ms.length ? Math.round((w / ms.length) * 100) + "%" : "-")),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เทิร์นเฉลี่ย"), h("b", null, ms.length ? (ms.reduce((a, m) => a + (m.turns || 0), 0) / ms.length).toFixed(1) : "-")),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ดาวภารกิจ"), h("b", { style: "color:var(--gold)" }, "★ " + stars()))),
      h("div", { class: "setup", style: "margin-top:18px" },
        h("div", { class: "stack", style: "gap:8px" }, all.slice(0, 100).map((m) => h("button", { class: "mrow", onclick: () => openSheet((api) => [h("div", { class: "small muted" }, `${fmtDate(m.at)} · ${MODE_TH[m.mode] || ""} · ${m.first ? "เล่นก่อน" : "เล่นหลัง"} · ${m.turns} เทิร์น`), h("div", null, m.reason || ""),
            hasReplay(m.id) ? h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { api.close(); openReplay(m.id); } }, "ดูรีเพลย์")) : m.rp ? h("div", { class: "tiny muted" }, "รีเพลย์ของเกมนี้เก็บไว้ในเครื่องที่เล่น") : null, h("div", { class: "glog", style: "max-height:none" }, (m.log || []).map((l) => h("div", null, l)))], { title: `${m.deckName} vs ${m.oppDeck}` }) },
          h("span", { class: "chip " + (m.mode === "goldfish" ? "gold" : m.result === "win" ? "good" : m.result === "loss" ? "bad" : "") }, m.mode === "goldfish" ? (m.result === "win" ? "ซ้อม T" + m.turns : "ซ้อม") : m.result === "win" ? "ชนะ" : m.result === "loss" ? "แพ้" : "เสมอ"),
          h("div", { class: "grow", style: "min-width:0" }, h("b", null, m.mode === "goldfish" ? `${m.deckName} · ซ้อมมือเดียว` : `${m.deckName} vs ${m.oppDeck || m.opp}`), h("div", { class: "tiny muted" }, `${m.opp} · ${MODE_TH[m.mode] || ""} · ${m.turns} เทิร์น${m.undo ? ` · ย้อนตา ${m.undo} ครั้ง` : ""} · ${m.reason || ""}`)),
          h("span", { class: "tiny muted" }, fmtDate(m.at))))),
        h("div", { class: "stack" }, ladderPanel(), achPanel(all), fishPanel(fish), h("div", { class: "panel stack" }, h("div", { class: "eyebrow" }, "อัตราชนะแยกเด็ค"), h("div", { class: "bars" }, Object.entries(byDeck).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => h("div", { class: "bar" }, h("span", null, `${k} (${v.n})`), h("div", { class: "trk" }, h("i", { style: `width:${(v.w / v.n) * 100}%` })), h("span", { class: "num small" }, Math.round((v.w / v.n) * 100) + "%"))))))));
  },
  refresh(root) { this.render(root); },
};
// practice against the dummy: how soon each deck wins, counted in the game's turns (both players' turns together)
function fishPanel(fish) {
  if (!fish.length) return null; const by = {};
  for (const m of fish) if (m.result === "win") { const k = m.deckName || "ไม่ทราบ"; (by[k] = by[k] || []).push(m.turns || 0); }
  return h("div", { class: "panel stack" }, h("div", { class: "eyebrow" }, "ซ้อมมือเดียว: ชนะเร็วแค่ไหน"),
    h("div", { class: "tiny muted" }, "นับเทิร์นของเกม (ของเราและหุ่นซ้อมรวมกัน) เล่นก่อนทุกเกม"),
    Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([k, t]) => { t.sort((a, b) => a - b); return h("div", { class: "row", style: "justify-content:space-between" }, h("span", { class: "small" }, `${k} (${t.length} เกม)`), h("span", { class: "num small" }, `เร็วสุด ${t[0]} · กลาง ${t[t.length >> 1]} · เฉลี่ย ${(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1)}`)); }));
}
// achievements: what each one asks, how far along you are, what it opens up
function achPanel(all) {
  const rows = ACH.map((a) => ({ a, p: progress(a, all) })); const n = rows.filter((r) => r.p.done).length;
  return h("div", { class: "panel stack" }, h("div", { class: "row", style: "justify-content:space-between" }, h("div", { class: "eyebrow" }, "ความสำเร็จ"), h("span", { class: "chip gold" }, `${n}/${ACH.length}`)),
    h("div", { class: "achlist" }, rows.map(({ a, p }) => h("div", { class: "ach" + (p.done ? " done" : "") }, h("span", { class: "ico", "aria-hidden": "true" }, p.done ? "✦" : "·"),
      h("div", { style: "min-width:0" }, h("b", null, a.name), h("div", { class: "tiny muted" }, a.how + (a.gives ? " · ได้" + rewardName(a.gives) : "")),
        p.need > 1 && !p.done ? h("div", { class: "trk", style: "margin-top:4px" }, h("i", { style: `width:${(p.have / p.need) * 100}%` })) : null),
      h("span", { class: "tiny num" }, p.done ? "สำเร็จ" : p.need > 1 ? `${p.have}/${p.need}` : "")))));
}
// friends' ladder: everyone's finished friend games, rated; plus how you have done against each friend
function ladderPanel() {
  const L = ladderNow(); const again = () => ladder().then(() => { if (/^#history/.test(location.hash)) Views.history.refresh(document.getElementById("view")); }).catch(() => {});
  if (!ladderFresh()) again(); // shows what it has meanwhile
  if (!L || !L.table.length) return null;
  const mine = L.table.filter((p) => p.uid !== Me.uid).map((p) => ({ p, v: L.vs(Me.uid, p.uid) })).filter((x) => x.v);
  return h("div", { class: "panel stack" }, h("div", { class: "row", style: "justify-content:space-between" }, h("div", { class: "eyebrow" }, "อันดับในกลุ่มเพื่อน"), h("span", { class: "chip" }, `${L.games} เกม`)),
    h("ol", { class: "ladder" }, L.table.slice(0, 12).map((p, k) => h("li", { class: p.uid === Me.uid ? "you" : "" }, h("span", { class: "num rk" }, k + 1), avatarEl(L.avatars[p.uid], p.name, "sm"),
      h("b", { class: "nm" }, p.name + (p.uid === Me.uid ? " (คุณ)" : "")), h("span", { class: "num pts", title: "แต้มอันดับ" }, p.r), h("span", { class: "tiny muted num" }, `ชนะ ${p.w} แพ้ ${p.l}${p.d ? ` เสมอ ${p.d}` : ""}`)))),
    mine.length ? h("div", { class: "stack", style: "gap:4px" }, h("div", { class: "tiny muted" }, "คุณกับเพื่อนแต่ละคน"), mine.map(({ p, v }) => h("div", { class: "row small", style: "justify-content:space-between" }, h("span", null, p.name), h("span", { class: "num" }, `ชนะ ${v.w} · แพ้ ${v.l}${v.d ? ` · เสมอ ${v.d}` : ""}`)))) : null,
    h("div", { class: "tiny muted" }, "คิดจากเกมดวลกับเพื่อนที่จบแล้วของทุกคน เริ่มที่ 1000 แต้ม ชนะคนที่แต้มสูงกว่าจะได้แต้มมากกว่า"));
}
