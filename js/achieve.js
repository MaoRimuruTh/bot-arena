// Achievements: earned only by playing (nothing here can be bought), each one unlocking something for the table:
// a 3D figure to stand by your side, a colour of lacquer for the mat, the circle that opens when you summon, or one of the
// official box decks (คัดสรรเด็ค) that plays stronger than the Starter Decks. Worked out from your own match history.
import { Data } from "./fb.js?v=20261114195913";
import { lsGet } from "./util.js?v=20261114195913";
import { stars } from "./quests.js?v=20261114195913";
import { AVATARS, MATS, SIGILS, SCENES, WINFX } from "./arena3d.js?v=20261114195913";
import { BOX_LISTS, themeCounts, officialStarters } from "./boxdecks.js?v=20261114195913";
import { Vault } from "./vault.js?v=20261114195913";
import { isOwnerNow } from "./persona.js?v=20261114195913";

const real = (ms) => ms.filter((m) => m.mode !== "goldfish");
const wins = (ms) => real(ms).filter((m) => m.result === "win").length;
// the longest run of wins in a row (bot and friend games, oldest first)
const streak = (ms) => { let best = 0, run = 0; for (const m of real(ms).sort((a, b) => (a.at || 0) - (b.at || 0))) { run = m.result === "win" ? run + 1 : 0; best = Math.max(best, run); } return best; };
const gauntDone = (ms) => new Set(ms.filter((m) => m.gs && m.result === "win").map((m) => m.gs)).size; // ไต่ด่าน steps passed
const solved = () => Object.keys(lsGet("bot.pz", {})).length;
// wins with a deck that held at least n cards of one theme (th: counted from the deck when the game ended, see boxdecks.js)
const themeWins = (ms, key, n) => real(ms).filter((m) => m.result === "win" && m.th && (m.th[key] || 0) >= n).length;
// a box deck's achievement: one win with a deck of 30+ cards of its Symbol
const boxAch = (id, name, sy, deck) => ({ id, name, how: `ชนะบอทหรือเพื่อนด้วยเด็คที่มีการ์ด Symbol ${sy} อย่างน้อย 30 ใบ`, short: `ชนะด้วยเด็คที่มี Symbol ${sy} 30 ใบขึ้นไป`, theme: sy, need: 30, prog: (ms) => [themeWins(ms, sy, 30), 1], gives: { deck } });
// each: what it is called, how to earn it, a test (or progress [have, need]), and what it unlocks
export const ACH = [
  { id: "win1", name: "ชัยชนะแรก", how: "ชนะบอทหรือเพื่อน 1 เกม", prog: (ms) => [wins(ms), 1], gives: { av: "naga" } },
  { id: "fast", name: "สายฟ้าแลบ", how: "ซ้อมมือเดียวแล้วชนะภายในเทิร์นที่ 5 ของเกม", test: (ms) => ms.some((m) => m.mode === "goldfish" && m.result === "win" && m.turns <= 5), gives: { mat: "navy" } },
  { id: "win10", name: "นักสู้แห่งโต๊ะสัก", how: "ชนะบอทหรือเพื่อน 10 เกม", prog: (ms) => [wins(ms), 10], gives: { mat: "red" } },
  { id: "pro", name: "ปราบมือโปร", how: "ชนะบอทมือโปร 1 เกม", test: (ms) => ms.some((m) => m.brain === "hard" && m.result === "win"), gives: { mat: "jade" } },
  { id: "pro5", name: "นักมวยรุ่นเยาว์", how: "ชนะบอทมือโปร 5 เกม", prog: (ms) => [ms.filter((m) => m.brain === "hard" && m.result === "win").length, 5], gives: { av: "suea" } },
  { id: "pro10", name: "ราชสีห์สำริด", how: "ชนะบอทมือโปร 10 เกม", prog: (ms) => [ms.filter((m) => m.brain === "hard" && m.result === "win").length, 10], gives: { av: "singha" } },
  { id: "clean", name: "ไร้รอยขีดข่วน", how: "ชนะโดยที่ LIFE ของเราไม่ถูกหงายเลยสักใบ", test: (ms) => real(ms).some((m) => m.result === "win" && m.lifeLost === 0), gives: { mat: "violet" } },
  { id: "friend3", name: "เพื่อนร่วมสนาม", how: "ดวลกับเพื่อนครบ 3 เกม", prog: (ms) => [ms.filter((m) => m.mode === "friend").length, 3], gives: { av: "maew" } },
  { id: "puzzle5", name: "นักไขปริศนา", how: "ไขโจทย์ปริศนาสำเร็จ 5 ข้อ", prog: () => [solved(), 5], gives: { mat: "gold" } },
  { id: "puzzle15", name: "ปรมาจารย์ปริศนา", how: "ไขโจทย์ปริศนาสำเร็จ 15 ข้อ", prog: () => [solved(), 15], gives: { sig: "naga" } },
  { id: "streak3", name: "ชนะรวด", how: "ชนะบอทหรือเพื่อนติดกัน 3 เกม", prog: (ms) => [streak(ms), 3], gives: { sig: "yant" } },
  { id: "stars10", name: "ขยันทุกวัน", how: "สะสมดาวจากภารกิจประจำวัน 10 ดวง", prog: (ms) => [stars(ms), 10], gives: { mat: "indigo" } },
  { id: "stars20", name: "นักสู้ประจำสนาม", how: "สะสมดาวจากภารกิจประจำวัน 20 ดวง", prog: (ms) => [stars(ms), 20], gives: { av: "kai" } },
  { id: "stars30", name: "ตำนานสนามดวล", how: "สะสมดาวจากภารกิจประจำวัน 30 ดวง", prog: (ms) => [stars(ms), 30], gives: { sig: "pikul" } },
  { id: "decks", name: "ครบเจ็ดสาย", how: "ชนะด้วย Starter Deck ต่างกันครบ 7 เด็ค", prog: (ms) => [new Set(real(ms).filter((m) => m.result === "win" && /^starter-/.test(m.deckId || "")).map((m) => m.deckId)).size, 7], gives: { sig: "sun" } },
  // the box decks that beat the Starter Decks most of the time open up for a win with a deck of their own theme
  // victory effects: the ladder of Starter Decks (ไต่ด่าน) and many wins
  { id: "gaunt3", name: "ไต่ถึงกลางทาง", how: "ไต่ด่านผ่าน 3 ด่าน", prog: (ms) => [gauntDone(ms), 3], gives: { win: "lotus" } },
  { id: "win25", name: "ผ่านศึกยี่สิบห้า", how: "ชนะบอทหรือเพื่อน 25 เกม", prog: (ms) => [wins(ms), 25], gives: { win: "lantern" } },
  { id: "gauntAll", name: "เจ้าแห่งด่านฝึก", how: "ไต่ด่านผ่านครบทุกด่าน", prog: (ms) => [gauntDone(ms), officialStarters().length || 9], gives: { win: "fireworks" } },
  boxAch("boxKD01", "ศรัทธาแห่งสวรรค์", "เทพ", "box-kd01"),
  boxAch("boxKD02", "ลงนามด้วยเลือด", "นรก", "box-kd02"),
  boxAch("boxKD04", "กองทัพเหล็กกล้า", "หุ่นยนต์", "box-kd04"),
];
export const progress = (a, ms = Data.matches) => { if (a.prog) { const [have, need] = a.prog(ms); return { have: Math.min(have, need), need, done: have >= need }; } const done = !!a.test(ms); return { have: done ? 1 : 0, need: 1, done }; };
export const earned = (ms = Data.matches) => new Set(ACH.filter((a) => progress(a, ms).done).map((a) => a.id));
// is this figure / mat colour open to you? (anything no achievement gives is free)
const giver = (kind, key) => ACH.find((a) => a.gives && a.gives[kind] === key);
export function unlocked(kind, key, ms = Data.matches) { const a = giver(kind, key); return !a || progress(a, ms).done; }
export const needFor = (kind, key) => { const a = giver(kind, key); return a ? `${a.name}: ${a.how}` : ""; };
// a box deck still waiting for its achievement: not playable, not copyable, its list stays hidden
export const deckLocked = (d, ms = Data.matches) => !!(d && d.box) && !unlocked("deck", d.id, ms);
export const deckLockAch = (d) => (d && d.box ? giver("deck", d.id) || null : null);
// the box decks a win with this deck would open (still locked, and the deck has enough cards of the Symbol)
export const boxGoalsFor = (d, ms = Data.matches) => { if (!d || d.box) return []; const th = themeCounts(d); return ACH.filter((a) => a.theme && a.gives && a.gives.deck && (th[a.theme] || 0) >= a.need && !progress(a, ms).done); };
// after a game: what this match newly earned (compares the history without and with it)
export function newlyEarned(match) { const before = earned(Data.matches.filter((m) => m.id !== match.id)); const after = earned([match, ...Data.matches.filter((m) => m.id !== match.id)]); return ACH.filter((a) => after.has(a.id) && !before.has(a.id)); }
// your chosen figure and mat colour, if they are open to you (kept per browser)
const pick = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
// "own": the owner's own figure / mat picture / card sleeve, kept in his private space (vault.js)
export const myFigure = () => { const k = pick("bot.av3"); return k === "own" ? (Vault.has("fig") ? "own" : "") : k === "stand" ? (Vault.has("stand") ? "stand" : "") : AVATARS[k] && unlocked("av", k) ? k : ""; };
export const myMat = () => { const k = pick("bot.mat"); return k === "own" && Vault.has("mat") ? "own" : MATS[k] && unlocked("mat", k) ? k : "black"; };
// the scene round the table (สนาม): ซากุระราตรี opens with the sakura mat's achievement; a browser that used the sakura mat before the two were
// told apart keeps its trees
export const sceneOpen = (k) => !!SCENES[k] && (k !== "sakura" || unlocked("mat", "sakura")) && (!SCENES[k].owner || isOwnerNow());
export const sigilOpen = (k) => !!SIGILS[k] && unlocked("sig", k) && (!SIGILS[k].owner || isOwnerNow()); // the owner's own summon circle is his alone
export const myWinFx = () => { const k = pick("bot.winfx"); return WINFX[k] && unlocked("win", k) ? k : "gold"; };
export const myScene = () => { const k = pick("bot.scene"), s0 = sceneOpen(k) ? k : !k && pick("bot.mat") === "sakura" && sceneOpen("sakura") ? "sakura" : "hall"; return s0 === "hall" && myMat() === "pro" ? "studio" : s0; }; // the graphite mat never sits in the teak hall: it gets its studio
export const mySleeve = () => (pick("bot.sleeve") === "own" && Vault.has("sleeve") ? "own" : "");
export const mySigil = () => { const k = pick("bot.sig"); return sigilOpen(k) ? k : "lotus"; };
const boxName = (id) => { const k = String(id).replace(/^box-/, "").toUpperCase(); return BOX_LISTS[k] ? `${k} ${BOX_LISTS[k].name}` : id; };
export const rewardName = (g) => (g.av ? "อวตาร " + AVATARS[g.av].name : g.mat ? "ผ้าปู" + MATS[g.mat].name : g.sig ? "วงอัญเชิญ" + SIGILS[g.sig].name : g.deck ? "เด็คกล่องพิเศษ " + boxName(g.deck) : g.win ? "ฉากชัยชนะ" + WINFX[g.win].name : "");
