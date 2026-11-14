// ---------- weekly special rules (กติกาประจำสัปดาห์) and a friend best-of-3 series ----------
// One rule a week, the same for everyone: picked from the week number in Thai time (Monday 00:00 UTC+7), so friends agree.
// The rule is an engine option (s.rule, read by the engine's newGame / startTurn / cost) and travels with the game, its
// replay and a friend room. Wins under the week's rule earn stars: shown on the history page, cosmetic only, earned only by
// playing (at most STAR_CAP a week), never bought.
import { h, lsGet, lsSet } from "./util.js?v=20261114222637";
import { Data } from "./fb.js?v=20261114222637";

export const RULES = [
  { id: "hand6", name: "มือเปิดอิ่ม", desc: "ทุกคนเริ่มเกมด้วยการ์ดบนมือ 6 ใบ แทน 5 ใบ" },
  { id: "life4", name: "ศึกชีวิตสั้น", desc: "LIFE ฝ่ายละ 4 ใบ แทน 5 ใบ (หลังสับ การ์ด LIFE 1 ใบออกจากเกม)" },
  { id: "draw1", name: "สายน้ำไหลหลาก", desc: "ทุก Draw Phase จั่วเพิ่มอีก 1 ใบ" },
  { id: "cheap", name: "ตลาดนัดลดราคา", desc: "Avatar ทุกใบ Cost −1 (Cost 1 ยังเป็น 1, Cost 0 ยังเป็น 0)" },
];
export const STAR_CAP = 5;
export const ruleById = (id) => RULES.find((r) => r.id === id) || null;

// the ISO week (Monday first) of a moment, counted in Thai time (UTC+7) whatever the device's time zone
export function isoWeek(t = Date.now()) {
  const d = new Date((t || Date.now()) + 7 * 3600e3); // Thai wall time, read with the UTC getters
  const day = (d.getUTCDay() + 6) % 7; // Monday 0
  const th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3)); // the Thursday of this week
  const y = th.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4)), jan4day = (jan4.getUTCDay() + 6) % 7;
  const w = 1 + Math.round(((th - jan4) / 864e5 - 3 + jan4day) / 7);
  return { y, w, key: `${y}-W${String(w).padStart(2, "0")}` };
}
export function weekRule(t = Date.now()) { const { y, w } = isoWeek(t); return RULES[(y * 53 + w) % RULES.length]; }
// how long until the next rule (Monday 00:00 Thai time)
export function weekLeft(t = Date.now()) {
  const d = new Date(t + 7 * 3600e3), day = (d.getUTCDay() + 6) % 7;
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7) - 7 * 3600e3;
  const hrs = Math.max(0, Math.round((next - t) / 3600e3)); return hrs >= 48 ? `อีก ${Math.round(hrs / 24)} วัน` : `อีก ${hrs} ชั่วโมง`;
}

// stars: one per win under a weekly rule (bot or friend, not the two-sided practice), at most STAR_CAP in one week
const starGames = (ms) => ms.filter((m) => m.rule && m.wk && m.result === "win" && m.mode !== "solo" && m.mode !== "goldfish");
export function weeklyStars(ms = Data.matches, t = Date.now()) {
  const by = {}; for (const m of starGames(ms)) by[m.wk] = (by[m.wk] || 0) + 1;
  const total = Object.values(by).reduce((a, n) => a + Math.min(n, STAR_CAP), 0), week = Math.min(by[isoWeek(t).key] || 0, STAR_CAP);
  return { total, week, weeks: Object.keys(by).length };
}
// said after a win under the week's rule (the record is not in Data.matches yet, so this game counts as one more)
export function weeklyWinNote(wk = isoWeek().key) {
  const n = starGames(Data.matches).filter((m) => m.wk === wk).length;
  return n < STAR_CAP ? `★ ได้ดาวกติกาสัปดาห์ (${n + 1}/${STAR_CAP} ในสัปดาห์นี้)` : `ชนะกติกาสัปดาห์! ดาวสัปดาห์นี้ครบ ${STAR_CAP} ดวงแล้ว`;
}

export const ruleChip = (id) => { const r = ruleById(id); return r ? h("span", { class: "chip gold", title: r.desc }, "กติกาพิเศษ: " + r.name) : null; };

// the setup panel of the weekly mode (play against the bot under this week's rule)
export function weeklyPanel() {
  const r = weekRule(), st = weeklyStars(), wk = isoWeek();
  return h("div", { class: "weekly stack", style: "gap:6px" },
    h("div", { class: "row", style: "justify-content:space-between;flex-wrap:wrap;gap:6px" }, h("b", { class: "wk-name" }, r.name), h("span", { class: "tiny muted" }, `สัปดาห์ ${wk.w} · เปลี่ยนกติกา${weekLeft()}`)),
    h("div", { class: "small" }, r.desc),
    h("div", { class: "row small", style: "gap:8px;flex-wrap:wrap" }, h("span", { class: "chip gold" }, `★ สัปดาห์นี้ ${st.week}/${STAR_CAP}`), h("span", { class: "muted tiny" }, `สะสมทั้งหมด ${st.total} ดวง · ได้ดาวเมื่อชนะ ใช้แต่งโปรไฟล์อย่างเดียว`)),
    h("div", { class: "tiny muted" }, "กติกานี้ใช้กับทั้งสองฝ่ายเท่ากัน ชวนเพื่อนเล่นกติกานี้ได้จากโหมดดวลกับเพื่อน (ติ๊ก \"ใช้กติกาประจำสัปดาห์\")"));
}

// ---------- friend room options: this week's rule, and a best-of-3 series ----------
const ROOM = "bot.room";
const roomPref = () => lsGet(ROOM, { rule: false, bo3: false }) || { rule: false, bo3: false };
export const eventOpt = () => { const p = roomPref(); return { ...(p.rule ? { rule: weekRule().id } : {}), ...(p.bo3 ? { series: { of: 3, w: {}, n: 1 } } : {}) }; };
export function eventPicker() {
  const p = roomPref(), r = weekRule();
  const box = (k, label) => h("label", { class: "row small" }, h("input", { type: "checkbox", checked: !!p[k], onchange: (e) => lsSet(ROOM, { ...roomPref(), [k]: e.target.checked }) }), label);
  return h("div", { class: "stack", style: "gap:6px" }, box("rule", `ใช้กติกาประจำสัปดาห์ (${r.name})`), box("bo3", "แข่งแบบชนะ 2 ใน 3 เกม (ห้องเก็บคะแนนให้ ขอดวลอีกครั้งเพื่อเล่นเกมต่อไป)"));
}
// a series after a finished game: the winner gets a point; once someone has 2, the next room starts a fresh series
export function seriesAfter(series, s) {
  if (!series) return null; const w = { ...(series.w || {}) }; const uid = s && s.winner != null ? s.P[s.winner].uid : null;
  if (uid) w[uid] = (w[uid] || 0) + 1; return { of: series.of || 3, w, n: series.n || 1 };
}
const need = (series) => Math.floor((series.of || 3) / 2) + 1;
export const seriesWinner = (series) => { if (!series) return null; const n = need(series); return Object.keys(series.w || {}).find((u) => series.w[u] >= n) || null; };
export function seriesNext(series, s) { const a = seriesAfter(series, s); return seriesWinner(a) ? { of: a.of, w: {}, n: a.n + 1 } : a; }
// "ซีรีส์ 2 ใน 3 · ริมุรุ 1 – 0 เพื่อน" (after the game when it is over, so the last game counts)
export function seriesText(series, s) {
  if (!series || !s) return ""; const cur = s.phase === "over" ? seriesAfter(series, s) : series; const [A, B] = s.P; const a = (cur.w || {})[A.uid] || 0, b = (cur.w || {})[B.uid] || 0;
  const won = seriesWinner(cur); return `ชนะ ${need(cur)} ใน ${cur.of} เกม · ${A.name} ${a} – ${b} ${B.name}` + (won ? ` · ${won === A.uid ? A.name : B.name} ชนะซีรีส์!` : "");
}
export const seriesChip = (series, s) => (series && s ? h("span", { class: "chip", title: "ซีรีส์กับเพื่อน" }, seriesText(series, s)) : null);
// the phone bar has room for one short line: "✦ มือเปิดอิ่ม · 0–1"
export function hudLine(series, s) {
  const r = s && ruleById(s.rule); if (!r && !(series && s)) return null;
  const cur = series && s ? (s.phase === "over" ? seriesAfter(series, s) : series) : null; const sc = cur ? `${(cur.w || {})[s.P[0].uid] || 0}–${(cur.w || {})[s.P[1].uid] || 0}` : "";
  return h("span", { class: "mrule", title: [r && r.name, series && s ? seriesText(series, s) : ""].filter(Boolean).join(" · ") }, "✦ " + [r && r.name, sc].filter(Boolean).join(" · "));
}
