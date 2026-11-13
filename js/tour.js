// A small tournament among friends, set up by the owner: everyone plays everyone once; a win is a point, a draw half.
// The set-up lives in the shared settings (only the owner can write those). Results are the finished friend games
// tagged with the tournament, read the same way as the friends' ladder.
import { h, toast, openSheet, newId, confirmBox } from "./util.js?v=20261113161704";
import { Data, Me, setMeta } from "./fb.js?v=20261113161704";
import { avatarEl } from "./ui.js?v=20261113161704";

export const tourNow = () => { const t = Data.meta && Data.meta.tour; return t && t.id && !t.done ? t : null; };
export const pairKey = (a, b) => [a, b].sort().join("|");
// the standings: each pair counts its first finished game in this tournament
export function tourTable(t, list) {
  const inTour = new Set(t.players.map((p) => p.uid)), first = {};
  for (const o of [...list].filter((o) => o.tour === t.id && o.seats.every((u) => inTour.has(u))).sort((a, b) => a.at - b.at)) { const k = pairKey(...o.seats); if (!first[k]) first[k] = o; }
  const rows = t.players.map((p) => ({ ...p, w: 0, l: 0, d: 0, n: 0, pts: 0 })), by = Object.fromEntries(rows.map((r) => [r.uid, r]));
  for (const o of Object.values(first)) { const [a, b] = o.seats.map((u) => by[u]); a.n++; b.n++; if (!o.w) { a.d++; b.d++; } else if (o.w === a.uid) { a.w++; b.l++; } else { b.w++; a.l++; } }
  for (const r of rows) r.pts = r.w + r.d / 2;
  rows.sort((x, y) => y.pts - x.pts || y.w - x.w || x.name.localeCompare(y.name, "th"));
  const total = (t.players.length * (t.players.length - 1)) / 2, played = Object.keys(first).length;
  return { rows, first, total, played, over: played >= total };
}
const pts = (n) => (n % 1 ? n.toFixed(1) : String(n));
// the panel in the friend lobby: standings, then your own matches (with a button to open the room for one)
export function tourPanel(t, L, onPlay) {
  const T = tourTable(t, (L && L.list) || []), me = Me.uid, inIt = t.players.some((p) => p.uid === me);
  const nameOf = (u) => (t.players.find((p) => p.uid === u) || {}).name || "เพื่อน";
  const mine = inIt ? t.players.filter((p) => p.uid !== me).map((p) => ({ p, o: T.first[pairKey(me, p.uid)] })) : [];
  const owner = Me.profile && Me.profile.role === "owner";
  return h("div", { class: "panel stack tour" },
    h("div", { class: "row", style: "justify-content:space-between" }, h("b", null, "ทัวร์นาเมนต์: " + t.name), h("span", { class: "chip" }, `แข่งแล้ว ${T.played}/${T.total} แมตช์`)),
    h("div", { class: "tiny muted" }, "พบกันหมด ทุกคนเจอกันคนละ 1 เกม ชนะได้ 1 แต้ม เสมอได้ครึ่ง นับเกมแรกที่จบของแต่ละคู่"),
    T.over ? h("div", { class: "chip gold", style: "align-self:flex-start" }, "จบทัวร์แล้ว · แชมป์: " + T.rows[0].name) : null,
    h("ol", { class: "ladder" }, T.rows.map((r, k) => h("li", { class: r.uid === me ? "you" : "" }, h("span", { class: "num rk" }, k + 1), avatarEl((L && L.avatars && L.avatars[r.uid]) || "", r.name, "sm"),
      h("b", { class: "nm" }, r.name + (r.uid === me ? " (คุณ)" : "")), h("span", { class: "num pts" }, pts(r.pts) + " แต้ม"), h("span", { class: "tiny muted num" }, `${r.n} เกม`)))),
    mine.length ? h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "tiny muted" }, "แมตช์ของคุณ"), mine.map(({ p, o }) => h("div", { class: "row small", style: "justify-content:space-between" },
      h("span", null, "กับ " + p.name), o ? h("span", { class: "chip " + (o.w === me ? "good" : o.w ? "bad" : "") }, o.w === me ? "ชนะ" : o.w ? "แพ้" : "เสมอ")
        : h("button", { class: "btn sm gold", onclick: () => onPlay(p) }, "สร้างห้องแมตช์นี้")))) : h("div", { class: "tiny muted" }, "คุณไม่ได้อยู่ในรายชื่อทัวร์นี้ ดูอันดับได้อย่างเดียว"),
    owner ? h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => confirmBox(T.over ? "เก็บทัวร์นี้ไว้เป็นอันจบ?" : "ปิดทัวร์นี้ทั้งที่ยังแข่งไม่ครบ?", "ปิดทัวร์", () => setMeta({ tour: { ...t, done: true, closedAt: Date.now(), champ: T.over ? T.rows[0].uid : null } }).then(() => toast("ปิดทัวร์แล้ว"))) }, "ปิดทัวร์นาเมนต์")) : null);
}
// the owner picks who plays (approved accounts) and names it
export function newTour() {
  const people = Data.users.filter((u) => u.status === "approved").map((u) => ({ uid: u.id, name: (u.nick || u.name || "ผู้เล่น").slice(0, 24) }));
  openSheet((api) => {
    const name = h("input", { type: "text", maxlength: "40", value: "ทัวร์ประจำสัปดาห์", "aria-label": "ชื่อทัวร์นาเมนต์" });
    const picks = people.map((p) => ({ p, box: h("input", { type: "checkbox", checked: true }) }));
    return [h("div", { class: "stack" }, name, h("div", { class: "stack", style: "gap:4px" }, picks.map(({ p, box }) => h("label", { class: "chk small" }, box, p.name))),
      h("div", { class: "tiny muted" }, "ทุกคนที่เลือกจะเจอกันคนละ 1 เกม ใช้ห้องดวลกับเพื่อนตามปกติ ผลจะนับเองเมื่อเกมจบ"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async () => {
        const players = picks.filter((x) => x.box.checked).map((x) => x.p); if (players.length < 2) return toast("เลือกอย่างน้อย 2 คน");
        try { await setMeta({ tour: { id: newId(), name: name.value.trim() || "ทัวร์นาเมนต์", at: Date.now(), players, done: false } }); api.close(); toast("เริ่มทัวร์แล้ว"); } catch { toast("บันทึกไม่ได้", "bad"); } } }, "เริ่มทัวร์")))];
  }, { title: "จัดทัวร์นาเมนต์", sub: "พบกันหมดในกลุ่มเพื่อน" });
}
