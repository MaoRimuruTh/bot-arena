// ---------- friend games: a move log that each side checks ----------
// Every move a player sends goes into the game with a running number (n) and the action itself (mv keeps the last few).
// The other player's app plays each new move again from the last state it checked, with the same rules engine, and
// compares the result with the state that was sent. A state written by hand (a forced win, a card moved between zones)
// does not come out of any move, so it is caught. Shuffles come out the same on both sides because the game's random
// numbers are part of the state and start from the shared fair seed (commit-reveal).
// An effect's result must be the one the rules engine gives for the choices made (picks are sent with the move); only
// an effect the engine cannot read at all may carry a result worked out elsewhere (Ciel reading the card).
import { E } from "./engine.js?v=20261115021802";
import { resolveEffect } from "./effects.js?v=20261115021802";

export const MV_KEEP = 80; // moves kept in the game (the database rules hold the same number); a player who was away for more than this many moves starts checking again from where the game is
const cp = (o) => JSON.parse(JSON.stringify(o));
const opsOf = (r) => JSON.stringify((r && r.ops) || null);
// who has a decision to make (the same order the table uses)
function acts(s) {
  if (s.phase === "over") return null;
  if (s.phase === "toss") return E.tossSeat(s);
  if (s.phase === "mull") return s.mull[0] ? (s.mull[1] ? null : 1) : 0;
  if (s.rw) return 1 - s.rw.by;
  if (s.trig.length) return s.trig[0].seat;
  if (s.pend) return 1 - s.pend.by;
  return s.active;
}
// the player's choices for an effect, sent as { index: choice } (a choice the card made by itself leaves its index empty,
// which a plain list would turn into null on the way)
export const pickMap = (picks) => { const o = {}; (picks || []).forEach((v, k) => { if (v !== undefined) o[k] = v; }); return o; };
const picksOf = (m) => { const out = []; if (m && typeof m === "object" && !Array.isArray(m)) for (const [k, v] of Object.entries(m)) if (/^\d+$/.test(k) && +k < 64) out[+k] = v; return out; };
export const idleReason = (s, by) => `${s.P[1 - by].name} ไม่ได้เล่นนานเกิน 4 นาที`;
// a move as the game keeps it: the action is stored as text exactly as it was sent, before the engine saw it
export const logged = (g, aj, p, by) => { const n = (g.n || 0) + 1; return { n, mv: [...(Array.isArray(g.mv) ? g.mv : []), { n, p, by, a: aj }].slice(-MV_KEEP) }; };
// play one logged move on s (changed in place); returns "" or why it cannot be a real move
export function replay(s, m) {
  let a; try { a = JSON.parse(m.a); } catch { return "อ่านการเดินไม่ได้"; }
  if (!a || typeof a !== "object" || typeof a.type !== "string") return "การเดินไม่ถูกรูปแบบ";
  if (m.p !== m.by) return "เดินแทนอีกฝ่าย";
  if (a.type === "__idle") { // the waiting player claims the game when the other has not moved for a while
    if (s.phase === "over" || acts(s) !== 1 - m.by) return "อ้างว่าอีกฝ่ายไม่เล่นทั้งที่ไม่ใช่ตาของอีกฝ่าย";
    E.lose(s, 1 - m.by, idleReason(s, m.by)); return "";
  }
  if (a.type === "trig" && !a.skip && a.ops) { // the effect's result must come from the rules engine
    const c = cp(s), t = c.trig.find((x) => x.id === a.id); if (!t) return "ไม่มีเอฟเฟกต์นี้รออยู่";
    let r = null; try { r = a.pk ? resolveEffect(c, t, picksOf(a.pk), true) : resolveEffect(c, t); } catch { r = null; }
    if (a.pk ? opsOf(r) !== JSON.stringify(a.ops) : (r && r.ops && opsOf(r) !== JSON.stringify(a.ops))) return "ผลของเอฟเฟกต์ไม่ตรงกับกติกา (" + ((s.cards[t.c] || {}).n || "การ์ด") + ")";
  }
  try { E.apply(s, a, m.p); } catch (e) { return "การเดินนี้ทำไม่ได้ตามกติกา: " + (e && e.message || e); }
  return "";
}
// check a game document against what this side has checked so far (ck: { s, n, full } or null)
// returns { ck, why, gap }: why = what does not add up (empty when all is well); gap = moves were missed, checking starts again here
export function check(ck, g) {
  const n = g.n || 0, mv = Array.isArray(g.mv) ? g.mv : [];
  if (!g.state || g.trimmed) return { ck, why: "" };
  if (!ck) {
    if (g.init && n === 0) ck = { s: JSON.parse(g.init), n: 0, full: true }; // from the very start (the start itself is checked by the fair-shuffle check)
    else if (g.init && mv.length && mv[0].n === 1) ck = { s: JSON.parse(g.init), n: 0, full: true };
    else return { ck: { s: JSON.parse(g.state), n, full: false }, why: "", gap: true }; // joined late (an older game, or another device): check from here on
  }
  if (n < ck.n) return { ck, why: "บันทึกการเดินถอยหลัง" };
  if (n === ck.n) return { ck, why: JSON.stringify(ck.s) === g.state ? "" : "สถานะเกมเปลี่ยนโดยไม่มีการเดิน" };
  const todo = mv.filter((m) => m.n > ck.n).sort((a, b) => a.n - b.n);
  const whole = todo.length && todo[0].n === ck.n + 1 && todo[todo.length - 1].n === n && todo.every((m, k) => m.n === ck.n + 1 + k);
  if (!whole) { // missed moves: only real when more moves were made than the game keeps (the log is full and starts after ours)
    const away = mv.length >= MV_KEEP && mv[0].n > ck.n + 1 && n - ck.n > MV_KEEP && mv.every((m, k) => m.n === mv[0].n + k) && mv[mv.length - 1].n === n;
    return away ? { ck: { s: JSON.parse(g.state), n, full: false }, why: "", gap: true } : { ck, why: "บันทึกการเดินขาดหายหรือถูกแก้" }; }
  const s = cp(ck.s);
  for (const m of todo) { const why = replay(s, m); if (why) return { ck, why: `การเดินที่ ${m.n}: ${why}` }; }
  if (JSON.stringify(s) !== g.state) return { ck, why: `สถานะหลังการเดินที่ ${n} ไม่ตรงกับผลของการเดิน` };
  return { ck: { s, n, full: ck.full }, why: "" };
}
