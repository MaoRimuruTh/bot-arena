// โค้ชหลังเกม: replays a kept game and, at each decision of the player, asks the quick bot what it would have done.
// Where the two differ, each choice is played out a few times on copies to the player's next Main Phase (both sides the
// quick way, the other side's hand dealt again from its unseen cards) and the tables are compared with the bot's own
// evaluation (H.evalBoard). Only differences well past the spread of those play-outs are called mistakes or good plays;
// the rest are "พอ ๆ กัน". It runs a decision at a time, yielding to the page, so the screen never freezes.
import { E, legalMoves } from "./engine.js?v=20261114214910";
import { H } from "./ai.js?v=20261114214910";
import { h, clone, openSheet, lsGet, lsSet } from "./util.js?v=20261114214910";

const DECIDE = new Set(["summon", "cast", "build", "attack", "activate", "battle", "end", "respond", "pass", "discard"]);
const N = 4; // play-outs per choice
const MARGIN = 2; // points of the bot's evaluation; a difference must also be past two standard errors
const recStart = (rec) => (rec.start ? JSON.parse(rec.start) : E.newGame(rec.init));
const apply = (s, [p, a]) => {
  if (a.type === "__lose") return E.lose(s, p, a.reason);
  if (a.__fail) { try { E.apply(s, JSON.parse(JSON.stringify(a)), p); } catch { /* it broke here in the game too */ } return; }
  return E.apply(s, JSON.parse(JSON.stringify(a)), p);
};
// the same action written two ways (key order, a list of cards in another order) counts as the same
const canon = (v) => Array.isArray(v) ? (v.every((x) => typeof x === "number") ? [...v].sort((a, b) => a - b) : v.map(canon))
  : v && typeof v === "object" ? Object.keys(v).filter((k) => !k.startsWith("__")).sort().reduce((o, k) => ((o[k] = canon(v[k])), o), {}) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// what the quick bot would do here, the way it is asked in a game
function botMove(s, p) {
  if (s.rw && s.rw.by !== p) return H.react(s, p) || { type: "pass" };
  if (s.phase === "end" && s.need && s.active === p) return { type: "discard", iids: H.discard(s, p) };
  const m = H.pick(s, p); return m ? m.a : s.pend ? { type: "respond" } : { type: "end" };
}
const GENERIC = { battle: "เข้า Battle Phase", end: "จบเทิร์น", pass: "ไม่ตอบโต้", respond: "รับการโจมตี (ไม่ป้องกัน)" };
function say(s, p, a) {
  const m = legalMoves(s, p).find((q) => same(q.a, a)); if (m && m.d) return m.d;
  if (a.type === "discard") return "ทิ้ง " + (a.iids || []).map((i) => { const L = E.locate(s, i); return L ? E.name(s, L.x) : "?"; }).join(", ");
  if (a.type === "cast" && a.i != null) { const L = E.locate(s, a.i); if (L) return "ใช้ " + E.name(s, L.x); }
  return GENERIC[a.type] || a.type;
}
// the parts of the table a short reason can point at
function parts(t, p) {
  const side = (q) => { const P = t.P[q]; return { life: P.life.filter((y) => !y.up).length, board: P.av.reduce((v, x) => v + E.power(t, x), 0) + P.cs.length * 2, hand: P.hand.length }; };
  return { over: t.phase === "over" ? (t.winner === p ? 1 : -1) : 0, me: side(p), op: side(1 - p) };
}
// one play-out: the move on a copy, then both sides the quick way to p's next Main Phase (as H.rollout does), the table then
function playOut(s, p, a, k) {
  let t; try { t = clone({ ...s, cards: null, log: [], ev: [] }); } catch { return null; } t.cards = s.cards; t.seed = (t.seed + 7919 * (k + 1) + 104729) | 0;
  const O = t.P[1 - p], pool = E.shuffle(t, [...O.hand, ...O.deck]); O.hand = pool.slice(0, O.hand.length); O.deck = pool.slice(O.hand.length); E.shuffle(t, t.P[p].deck);
  const T = t.turn, look = H.look; H.look = 0;
  try {
    E.apply(t, JSON.parse(JSON.stringify(a)), p);
    for (let i = 0; i < 400 && t.phase !== "over" && !(t.turn > T && t.active === p && t.phase === "main"); i++) {
      if (t.rw) { const q = 1 - t.rw.by; E.apply(t, H.react(t, q) || { type: "pass" }, q); continue; }
      if (t.trig.length) { const tr = t.trig[0]; E.apply(t, H.trig(t, tr), tr.seat); continue; }
      const q = t.pend ? 1 - t.pend.by : t.active;
      if (t.phase === "end" && t.need) { E.apply(t, { type: "discard", iids: H.discard(t, q) }, q); continue; }
      const m = H.pick(t, q); try { E.apply(t, m ? m.a : t.pend ? { type: "respond" } : { type: "end" }, q); } catch { E.apply(t, { type: "end" }, q); }
    }
    return { v: H.evalBoard(t, p), parts: parts(t, p) };
  } catch { return null; } finally { H.look = look; }
}
const stats = (xs) => { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n; const v = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0; return { m, v, n }; };
const avgParts = (rs) => { const z = (f) => rs.reduce((a, r) => a + f(r.parts), 0) / rs.length;
  return { win: z((q) => (q.over > 0 ? 1 : 0)), lose: z((q) => (q.over < 0 ? 1 : 0)), myLife: z((q) => q.me.life), opLife: z((q) => q.op.life), myBoard: z((q) => q.me.board), opBoard: z((q) => q.op.board), hand: z((q) => q.me.hand) }; };
// why the better choice came out better: the biggest difference in what is left at our next turn
function why(better, worse) {
  const d = [
    [better.win - worse.win, (x) => `ชนะเกมภายในเทิร์นถัดไปบ่อยกว่า (${Math.round(better.win * 100)}% เทียบ ${Math.round(worse.win * 100)}%)`, 3],
    [worse.lose - better.lose, (x) => `แพ้ภายในเทิร์นถัดไปน้อยกว่า (${Math.round(better.lose * 100)}% เทียบ ${Math.round(worse.lose * 100)}%)`, 3],
    [worse.opLife - better.opLife, (x) => `LIFE ฝ่ายตรงข้ามเหลือน้อยกว่าราว ${x.toFixed(1)} ใบ`, 2.4],
    [better.myLife - worse.myLife, (x) => `LIFE ของเราเหลือมากกว่าราว ${x.toFixed(1)} ใบ`, 2.4],
    [worse.opBoard - better.opBoard, (x) => `สนามฝ่ายตรงข้ามอ่อนลงราว ${x.toFixed(1)} POWER`, 1],
    [better.myBoard - worse.myBoard, (x) => `สนามเราแข็งกว่าราว ${x.toFixed(1)} POWER`, 1],
    [better.hand - worse.hand, (x) => `การ์ดบนมือเหลือมากกว่าราว ${x.toFixed(1)} ใบ`, 1.05],
  ].map(([x, f, w]) => ({ x, f, s: x * w })).filter((z) => z.x > 0.05).sort((a, b) => b.s - a.s);
  return d.length ? d[0].f(d[0].x) : "สถานการณ์รวมดีกว่าเล็กน้อยหลายจุด";
}
const phaseTh = (s) => ({ main: "Main", battle: "Battle", end: "End", draw: "Draw" })[s.phase] || s.phase;
// the whole analysis: { rows (every decision that differed, scored), agree, total, turns }
export async function analyze(rec, V, onProgress, stop) {
  const s0 = recStart(rec), acts = rec.acts; const s = s0; const steps = [];
  // first a quick pass to count the decisions (for an honest progress bar)
  for (let k = 0; k < acts.length; k++) { const [p, a] = acts[k]; if (p === V && DECIDE.has(a.type) && !a.__fail) steps.push(k); }
  const rows = []; let agree = 0, done = 0, k = 0;
  for (const at of steps) {
    if (stop && stop()) return null;
    for (; k < at; k++) { try { apply(s, acts[k]); } catch { break; } }
    if (s.phase === "over") break;
    const played = acts[at][1]; let bot = null; try { bot = botMove(s, V); } catch { bot = null; }
    if (!bot || same(bot, played)) agree++;
    else {
      const rp = [], rb = []; for (let i = 0; i < N; i++) { const a = playOut(s, V, played, i), b = playOut(s, V, bot, i); if (a) rp.push(a); if (b) rb.push(b); await new Promise((r) => setTimeout(r, 0)); } // a breath after each pair of play-outs
      if (rp.length >= 2 && rb.length >= 2) {
        const P = stats(rp.map((r) => r.v)), B = stats(rb.map((r) => r.v)); const swing = B.m - P.m, se = Math.sqrt(P.v / P.n + B.v / B.n);
        const clear = Math.abs(swing) >= Math.max(MARGIN, 2 * se); const pp = avgParts(rp), bp = avgParts(rb);
        rows.push({ k: at, turn: s.turn, phase: phaseTh(s), mine: s.active === V, played: say(s, V, played), better: say(s, V, bot), swing: Math.round(swing * 10) / 10, se: Math.round(se * 10) / 10,
          kind: !clear ? "close" : swing > 0 ? "miss" : "good", why: swing > 0 ? why(bp, pp) : why(pp, bp) });
      } else agree++;
    }
    done++; if (onProgress) onProgress(done, steps.length);
    await new Promise((r) => setTimeout(r, 0)); // let the page breathe between decisions
    try { apply(s, acts[k]); } catch { break; } k++;
  }
  return { rows, agree, total: steps.length, turns: s.turn, v: 1 };
}

// ---------- the sheet ----------
const KEY = "bot.coach.";
export function openCoach(mid, rec, V, { title, jump } = {}) {
  let stopped = false; const cached = (() => { try { const c = lsGet(KEY + mid, null); return c && c.v === 1 ? c : null; } catch { return null; } })();
  const api = openSheet((api) => [h("div", { class: "small muted" }, "กำลังเตรียม…")], { title: "วิเคราะห์เกมนี้", sub: title || "", onClose: () => { stopped = true; } });
  const bar = h("i", { style: "width:0%" }), line = h("div", { class: "small muted num" }, "");
  const show = (R) => {
    const miss = R.rows.filter((r) => r.kind === "miss").sort((a, b) => b.swing - a.swing).slice(0, 5);
    const good = R.rows.filter((r) => r.kind === "good").sort((a, b) => a.swing - b.swing).slice(0, 3);
    const close = R.rows.filter((r) => r.kind === "close").length;
    const row = (r, cls) => h("div", { class: "coachrow " + cls },
      h("div", { class: "row", style: "justify-content:space-between;gap:8px;flex-wrap:wrap" }, h("b", null, `เทิร์น ${r.turn} · ${r.mine ? "เทิร์นเรา" : "เทิร์นฝ่ายตรงข้าม"} (${r.phase})`), h("span", { class: "chip " + (cls === "miss" ? "bad" : "good") }, Math.abs(r.swing) > 100 ? "ชี้ขาดเกม" : `${r.swing > 0 ? "−" : "+"}${Math.abs(r.swing).toFixed(1)} แต้ม`)),
      h("div", { class: "small" }, "คุณเลือก: ", h("span", null, r.played)),
      h("div", { class: "small" }, cls === "miss" ? "บอทจะเลือก: " : "บอทจะเลือก: ", h("span", null, r.better)),
      h("div", { class: "small muted" }, (cls === "miss" ? "ทางของบอทดีกว่า เพราะ" : "ทางของคุณดีกว่า เพราะ") + " " + r.why),
      jump ? h("button", { class: "btn sm", onclick: () => { api.close(); jump(r.k); } }, "ดูจังหวะนี้ในรีเพลย์") : null);
    api.set([
      h("div", { class: "small" }, `ตัดสินใจ ${R.total} ครั้ง · ตรงกับบอท ${R.agree} · พอ ๆ กัน ${close} · น่าจะพลาด ${R.rows.filter((r) => r.kind === "miss").length} · เล่นดีกว่าบอท ${R.rows.filter((r) => r.kind === "good").length}`),
      h("div", { class: "eyebrow" }, "จุดที่น่าจะพลาด"),
      miss.length ? h("div", { class: "stack", style: "gap:8px" }, miss.map((r) => row(r, "miss"))) : h("div", { class: "small muted" }, "ไม่พบจุดที่พลาดชัดเจน ที่ต่างจากบอทส่วนใหญ่ได้ผลพอ ๆ กัน"),
      h("div", { class: "eyebrow" }, "จุดที่เล่นดี"),
      good.length ? h("div", { class: "stack", style: "gap:8px" }, good.map((r) => row(r, "good"))) : h("div", { class: "small muted" }, R.agree ? `เล่นตรงกับที่บอทเลือก ${R.agree} ครั้ง ไม่มีจุดที่ทางของคุณดีกว่าบอทชัดเจน` : "ยังไม่มีจุดที่ดีกว่าบอทชัดเจน"),
      h("div", { class: "tiny muted" }, `วิธีวัด: ทุกจุดที่คุณเลือกต่างจากบอท ชิเอลให้บอทเล่นต่อทั้งสองทางทางละ ${N} รอบ ถึงต้นเทิร์นถัดไปของคุณ (สุ่มมือฝ่ายตรงข้ามใหม่ ไม่แอบดู) แล้วเทียบด้วยคะแนนกระดานของบอท ต่างกันไม่ถึง ${MARGIN} แต้มหรือยังอยู่ในช่วงสุ่มจะนับเป็นพอ ๆ กัน บอทเองก็พลาดได้ ใช้เป็นข้อสังเกต ไม่ใช่คำตัดสิน`)]);
  };
  if (cached) { show(cached); return api; }
  api.set([h("div", { class: "small" }, "ชิเอลกำลังเล่นเกมนี้ซ้ำ แล้วลองทางเลือกของบอทในแต่ละจังหวะ"), h("div", { class: "trk coachtrk", role: "progressbar", "aria-label": "ความคืบหน้า" }, bar), line]);
  analyze(rec, V, (d, n) => { bar.style.width = Math.round((d / Math.max(1, n)) * 100) + "%"; line.textContent = `${d}/${n} จังหวะ`; }, () => stopped)
    .then((R) => { if (!R || stopped) return; try { lsSet(KEY + mid, R); } catch { /* full storage: shown, not kept */ } show(R); })
    .catch((e) => { if (!stopped) api.set(h("div", { class: "small" }, "วิเคราะห์เกมนี้ไม่สำเร็จ: " + (e && e.message ? e.message : e))); });
  return api;
}
