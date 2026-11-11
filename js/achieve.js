// Achievements: earned only by playing (nothing here can be bought), each one unlocking something for the table:
// a 3D figure to stand by your side, or a colour of lacquer for the mat. Worked out from your own match history.
import { Data } from "./fb.js?v=20261111131929";
import { lsGet } from "./util.js?v=20261111131929";
import { AVATARS, MATS } from "./arena3d.js?v=20261111131929";

const real = (ms) => ms.filter((m) => m.mode !== "goldfish");
const wins = (ms) => real(ms).filter((m) => m.result === "win").length;
// each: what it is called, how to earn it, a test (or progress [have, need]), and what it unlocks
export const ACH = [
  { id: "win1", name: "ชัยชนะแรก", how: "ชนะบอทหรือเพื่อน 1 เกม", prog: (ms) => [wins(ms), 1], gives: { av: "naga" } },
  { id: "fast", name: "สายฟ้าแลบ", how: "ซ้อมมือเดียวแล้วชนะภายในเทิร์นที่ 5 ของเกม", test: (ms) => ms.some((m) => m.mode === "goldfish" && m.result === "win" && m.turns <= 5), gives: { mat: "navy" } },
  { id: "win10", name: "นักสู้แห่งโต๊ะสัก", how: "ชนะบอทหรือเพื่อน 10 เกม", prog: (ms) => [wins(ms), 10], gives: { mat: "red" } },
  { id: "pro", name: "ปราบมือโปร", how: "ชนะบอทมือโปร 1 เกม", test: (ms) => ms.some((m) => m.brain === "hard" && m.result === "win"), gives: { mat: "jade" } },
  { id: "clean", name: "ไร้รอยขีดข่วน", how: "ชนะโดยที่ LIFE ของเราไม่ถูกหงายเลยสักใบ", test: (ms) => real(ms).some((m) => m.result === "win" && m.lifeLost === 0), gives: { mat: "violet" } },
  { id: "friend3", name: "เพื่อนร่วมสนาม", how: "ดวลกับเพื่อนครบ 3 เกม", prog: (ms) => [ms.filter((m) => m.mode === "friend").length, 3], gives: { av: "maew" } },
  { id: "puzzle5", name: "นักไขปริศนา", how: "ไขโจทย์ปริศนาสำเร็จ 5 ข้อ", prog: () => [Object.keys(lsGet("bot.pz", {})).length, 5], gives: { mat: "gold" } },
  { id: "decks", name: "ครบเจ็ดสาย", how: "ชนะด้วย Starter Deck ต่างกันครบ 7 เด็ค", prog: (ms) => [new Set(real(ms).filter((m) => m.result === "win" && /^starter-/.test(m.deckId || "")).map((m) => m.deckId)).size, 7] },
];
export const progress = (a, ms = Data.matches) => { if (a.prog) { const [have, need] = a.prog(ms); return { have: Math.min(have, need), need, done: have >= need }; } const done = !!a.test(ms); return { have: done ? 1 : 0, need: 1, done }; };
export const earned = (ms = Data.matches) => new Set(ACH.filter((a) => progress(a, ms).done).map((a) => a.id));
// is this figure / mat colour open to you? (anything no achievement gives is free)
const giver = (kind, key) => ACH.find((a) => a.gives && a.gives[kind] === key);
export function unlocked(kind, key, ms = Data.matches) { const a = giver(kind, key); return !a || progress(a, ms).done; }
export const needFor = (kind, key) => { const a = giver(kind, key); return a ? `${a.name}: ${a.how}` : ""; };
// after a game: what this match newly earned (compares the history without and with it)
export function newlyEarned(match) { const before = earned(Data.matches.filter((m) => m.id !== match.id)); const after = earned([match, ...Data.matches.filter((m) => m.id !== match.id)]); return ACH.filter((a) => after.has(a.id) && !before.has(a.id)); }
// your chosen figure and mat colour, if they are open to you (kept per browser)
const pick = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
export const myFigure = () => { const k = pick("bot.av3"); return AVATARS[k] && unlocked("av", k) ? k : ""; };
export const myMat = () => { const k = pick("bot.mat"); return MATS[k] && unlocked("mat", k) ? k : "black"; };
export const rewardName = (g) => (g.av ? "อวตาร " + AVATARS[g.av].name : g.mat ? "ผ้าปู" + MATS[g.mat].name : "");
