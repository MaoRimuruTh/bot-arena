// Daily quests: three a day, the same three for everyone, picked by the date. Worked out from your match history and
// the puzzles you have solved, so nothing extra is stored. Every quest done is a star; stars open things to wear,
// like the achievements do (see achieve.js). Played for, never bought.
import { Data } from "./fb.js?v=20261113134242";
import { lsGet } from "./util.js?v=20261113134242";

const real = (m) => m.mode === "bot" || m.mode === "friend"; // practice against the dummy and two-sided games do not count
const won = (m) => real(m) && m.result === "win";
export const QUESTS = [
  { id: "win1", t: "ชนะบอทหรือเพื่อน 1 เกม", n: 1, f: (ms) => ms.filter(won).length },
  { id: "play2", t: "เล่นกับบอทหรือเพื่อนจนจบ 2 เกม", n: 2, f: (ms) => ms.filter(real).length },
  { id: "friend1", t: "ดวลกับเพื่อนจนจบ 1 เกม", n: 1, f: (ms) => ms.filter((m) => m.mode === "friend").length },
  { id: "puzzle1", t: "ไขโจทย์ปริศนาสำเร็จ 1 ข้อ", n: 1, f: (ms, pz) => pz },
  { id: "own", t: "ชนะด้วยเด็คที่จัดเอง", n: 1, f: (ms) => ms.filter((m) => won(m) && m.deckId && !/^starter-/.test(m.deckId)).length },
  { id: "fast", t: "ชนะภายในเทิร์นที่ 12 ของเกม", n: 1, f: (ms) => ms.filter((m) => won(m) && m.turns <= 12).length },
  { id: "clean", t: "ชนะโดย LIFE ของเราถูกหงายไม่เกิน 2 ใบ", n: 1, f: (ms) => ms.filter((m) => won(m) && m.lifeLost != null && m.lifeLost <= 2).length },
  { id: "fish", t: "ซ้อมมือเดียวจนจบ 1 เกม", n: 1, f: (ms) => ms.filter((m) => m.mode === "goldfish").length },
  { id: "strong", t: "ชนะบอทระดับปกติขึ้นไป", n: 1, f: (ms) => ms.filter((m) => won(m) && m.mode === "bot" && ["basic", "hard", "ciel"].includes(m.brain)).length },
  { id: "second", t: "ชนะเกมที่เราได้เล่นทีหลัง", n: 1, f: (ms) => ms.filter((m) => won(m) && m.first === false).length },
];
export const dayOf = (t) => new Date(t).toLocaleDateString("sv"); // YYYY-MM-DD in the player's own time zone
// the day's three: a small seeded shuffle of the pool, so every player sees the same ones on the same date
export function questsFor(day) {
  let h = 2166136261; for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = [...QUESTS]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
const solvedOn = () => Object.values(lsGet("bot.pz", {})).map(dayOf);
// how a day went: each of its quests with how far along it is
export function dayQuests(day, ms = Data.matches) {
  const today = ms.filter((m) => m.at && dayOf(m.at) === day), pz = solvedOn().filter((d) => d === day).length;
  return questsFor(day).map((q) => { const have = q.f(today, pz); return { q, have: Math.min(have, q.n), done: have >= q.n }; });
}
// every star earned so far: the quests done on each day anything was played
export function stars(ms = Data.matches) {
  const days = new Set([...ms.filter((m) => m.at).map((m) => dayOf(m.at)), ...solvedOn()]);
  let n = 0; for (const d of days) n += dayQuests(d, ms).filter((x) => x.done).length; return n;
}
// after a game or a puzzle: which of today's quests it finished (compares the day without and with it)
export function questsDoneBy(match) {
  const day = dayOf(Date.now()), others = Data.matches.filter((m) => m.id !== match.id);
  const before = new Set(dayQuests(day, others).filter((x) => x.done).map((x) => x.q.id));
  return dayQuests(day, [{ ...match, at: match.at || Date.now() }, ...others]).filter((x) => x.done && !before.has(x.q.id)).map((x) => x.q);
}
// today's finished quests, to compare before and after something that is not a match (a solved puzzle)
export const doneToday = (ms = Data.matches) => new Set(dayQuests(dayOf(Date.now()), ms).filter((x) => x.done).map((x) => x.q.id));
