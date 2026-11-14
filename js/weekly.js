// ---------- weekly special rules (กติกาประจำสัปดาห์) and a friend best-of-3 series ----------
// One rule a week, the same for everyone: picked from the week number in Thai time (Monday 00:00 UTC+7), so friends agree.
// The rule is an engine option (s.rule, read by the engine's newGame / startTurn / cost) and travels with the game, its
// replay and a friend room. Wins under the week's rule earn stars: shown on the history page, cosmetic only, earned only by
// playing (at most STAR_CAP a week), never bought.
import { h, lsGet, lsSet } from "./util.js?v=20261115015105";
import { Data } from "./fb.js?v=20261115015105";

import { card, limitKey } from "./cards.js?v=20261115015105";
import { singletonDeck } from "./builder.js?v=20261115015105";

export const RULES = [
  { id: "hand6", name: "มือเปิดอิ่ม", desc: "ทุกคนเริ่มเกมด้วยการ์ดบนมือ 6 ใบ แทน 5 ใบ" },
  { id: "life4", name: "ศึกชีวิตสั้น", desc: "LIFE ฝ่ายละ 4 ใบ แทน 5 ใบ (หลังสับ การ์ด LIFE 1 ใบออกจากเกม)" },
  { id: "draw1", name: "สายน้ำไหลหลาก", desc: "ทุก Draw Phase จั่วเพิ่มอีก 1 ใบ" },
  { id: "cheap", name: "ตลาดนัดลดราคา", desc: "Avatar ทุกใบ Cost −1 (Cost 1 ยังเป็น 1, Cost 0 ยังเป็น 0)" },
  { id: "nodup", name: "ใบเดียวไม่ซ้ำ", desc: "Main Deck 50 ใบต้องไม่มีการ์ดชื่อซ้ำ (ชื่อละ 1 ใบ) เด็คที่มีการ์ดซ้ำสร้างฉบับไม่ซ้ำได้ในคลิกเดียว ใช้ได้ทั้งสัปดาห์ เด็คที่บันทึกไว้ไม่เปลี่ยน", deck: true },
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
  return { y, w, th: +th, key: `${y}-W${String(w).padStart(2, "0")}` };
}
// weeks before 2026-W47 keep the rule they had (four rules); from W47 the five rules take turns, ห้ามการ์ดซ้ำ first
const ROT5 = Date.UTC(2026, 10, 19); // the Thursday of 2026-W47
export function weekRule(t = Date.now()) { const { y, w, th } = isoWeek(t); if (th < ROT5) return RULES[(y * 53 + w) % 4]; return RULES[(Math.round((th - ROT5) / 6048e5) + 4) % RULES.length]; }
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

// ---------- ห้ามการ์ดซ้ำ: one copy of each card in the Main Deck ----------
// (a Deck object { main: { id: n } } or a packed list { main: [ids] })
const listIds = (d) => (Array.isArray(d && d.main) ? d.main : Object.entries((d && d.main) || {}).flatMap(([i, n]) => Array(Math.max(0, n | 0)).fill(+i)));
export function dupNames(d) { const c = {}; for (const i of listIds(d)) { const x = card(i); if (!x) continue; const k = limitKey(x); c[k] = (c[k] || 0) + 1; } return Object.keys(c).filter((k) => c[k] > 1); }
export const NODUP_NEED = "กติกาสัปดาห์นี้ห้ามการ์ดซ้ำ: กด \"สร้างฉบับไม่ซ้ำ\" ในโหมดกติกาสัปดาห์ก่อน (เด็คที่บันทึกไว้ไม่เปลี่ยน)";
const skey = (d) => `bot.single.${isoWeek().key}.${d.id || d.name}`;
export const weekSingle = (d) => { const v = d ? lsGet(skey(d), null) : null; return v && v.main && !dupNames(v).length ? v : null; };
export function makeWeekSingle(d) { const v = singletonDeck(d); lsSet(skey(d), v); return v; }
// the Deck to play under a rule: as saved, or (ห้ามการ์ดซ้ำ) the one-copy version made for this week; null when it still needs one
export function ruleDeck(rule, d) { if (rule !== "nodup" || !d || !dupNames(d).length) return d; return weekSingle(d); }
// the bot's Deck under ห้ามการ์ดซ้ำ: made the same way, once per Deck
const SB = {}; export function botSingle(d) { if (!d || !dupNames(d).length) return d; const k = d.id || d.name; return SB[k] || (SB[k] = singletonDeck(d)); }
// in the weekly mode: the player's Deck has duplicates, so offer the one-tap copy for this week
export function singlePanel(d, redraw) {
  if (!d) return h("div", { class: "tiny muted" }, "เลือกเด็คด้านบนก่อน"); const dup = dupNames(d);
  if (!dup.length) return h("div", { class: "tiny muted" }, "เด็คนี้ไม่มีการ์ดซ้ำ เล่นกติกานี้ได้เลย");
  const have = weekSingle(d);
  return h("div", { class: "stack nodup", style: "gap:4px" }, h("div", { class: "small" }, `${d.name} มีการ์ดซ้ำ ${dup.length} ชื่อ`),
    have ? h("div", { class: "tiny muted" }, `ใช้ ${have.name}: 50 ใบ ชื่อละ 1 ใบ เก็บการ์ดของเด็คนี้ ${have.kept || "?"} ชื่อ เติมที่เหลือด้วยการ์ดกลุ่มเดียวกัน · ใช้ได้ถึงสิ้นสัปดาห์ เด็คที่บันทึกไว้ไม่เปลี่ยน`)
      : h("div", { class: "tiny muted" }, "สร้างฉบับไม่ซ้ำ: เก็บการ์ดทุกชื่อไว้ชื่อละ 1 ใบ แล้วเติมให้ครบ 50 ด้วยการ์ดกลุ่มเดียวกัน ใช้ได้ถึงสิ้นสัปดาห์ เด็คที่บันทึกไว้ไม่เปลี่ยน"),
    h("button", { class: "btn sm" + (have ? "" : " gold"), onclick: () => { makeWeekSingle(d); if (redraw) redraw(); } }, have ? "จัดฉบับไม่ซ้ำใหม่" : "สร้างฉบับไม่ซ้ำ (เฉพาะสัปดาห์นี้)"));
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
export const eventOpt = () => { const p = roomPref(); return { ...(p.rule ? { rule: weekRule().id } : {}), ...(p.bo3 ? { series: { of: 3, prev: [] } } : {}) }; };
export function eventPicker() {
  const p = roomPref(), r = weekRule();
  const box = (k, label) => h("label", { class: "row small" }, h("input", { type: "checkbox", checked: !!p[k], onchange: (e) => lsSet(ROOM, { ...roomPref(), [k]: e.target.checked }) }), label);
  return h("div", { class: "stack", style: "gap:6px" }, box("rule", `ใช้กติกาประจำสัปดาห์ (${r.name})`), r.id === "nodup" ? h("div", { class: "tiny muted" }, "สัปดาห์นี้ห้ามการ์ดซ้ำ: ทั้งสองฝ่ายต้องใช้เด็คไม่ซ้ำ ถ้าเด็คมีการ์ดซ้ำ สร้างฉบับไม่ซ้ำได้ในโหมดกติกาสัปดาห์") : null, box("bo3", "แข่งแบบชนะ 2 ใน 3 เกม (ห้องเก็บคะแนนให้ ขอดวลอีกครั้งเพื่อเล่นเกมต่อไป)"));
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
