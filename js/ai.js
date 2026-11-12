// Bot heuristics + optional Ciel (Claude API with the player's own key, kept only in this browser).
import { E, legalMoves, PHASE_TH, ZONE_TH, modBonus, scriptOf } from "./engine.js?v=20261113015636";
import { plain } from "./persona.js?v=20261113015636";
import { autoEffect, resolveEffect } from "./effects.js?v=20261113015636";
import { CARDS, card, isBase, TYPE_TH, SUB_TH, COLORS, cardLine, limitOf, deckEntries, deckStats } from "./cards.js?v=20261113015636";
import { modPowerFor } from "./auras.js?v=20261113015636";
import { Data } from "./fb.js?v=20261113015636";
import { lsGet, clone } from "./util.js?v=20261113015636";

export const Ciel = {
  key: () => lsGet("bot.apiKey", ""),
  model: () => lsGet("bot.model", "claude-sonnet-5-5"),
  fastModel: () => lsGet("bot.fastModel", "claude-haiku-5-5"),
  on: () => !!lsGet("bot.apiKey", ""),
};
async function callClaude(content, { model, max = 2000 } = {}) {
  const key = Ciel.key(); if (!key) throw Object.assign(new Error("no_key"), { code: "no_key" });
  // other accounts get the same help from a nameless assistant, not from Ciel
  content = typeof content === "string" ? plain(content) : Array.isArray(content) ? content.map((b) => (b && b.type === "text" ? { ...b, text: plain(b.text) } : b)) : content;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: model || Ciel.model(), max_tokens: max, messages: [{ role: "user", content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.message) || "api " + r.status), { code: r.status === 401 ? "bad_key" : r.status === 429 ? "rate_limited" : "api" });
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}
function parseJSON(t) {
  try { return JSON.parse(t); } catch {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw Object.assign(new Error("invalid_json"), { code: "invalid_json" });
}
async function fileToBlock(f) {
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
  return { type: "image", source: { type: "base64", media_type: f.type || "image/png", data: b64 } };
}
async function askJSON(prompt, opts = {}) {
  const content = opts.images ? [...(await Promise.all([...opts.images].map(fileToBlock))), { type: "text", text: prompt + "\nตอบเป็น JSON เท่านั้น" }] : prompt + "\nตอบเป็น JSON เท่านั้น";
  return parseJSON(await callClaude(content, { model: opts.tier === "quick" ? Ciel.fastModel() : Ciel.model(), max: opts.max || 2000 }));
}
async function askText(prompt) { return callClaude(prompt, { max: 700 }); }
export function aiErr(e) {
  const c = e && (e.code || e.message);
  if (c === "no_key") return "ยังไม่ได้ใส่ API key ของชิเอล ไปที่เมนูตั้งค่า (รูปโปรไฟล์มุมขวาบน)";
  if (c === "bad_key") return "API key ใช้ไม่ได้ ตรวจที่หน้าตั้งค่าอีกครั้ง";
  if (c === "rate_limited") return "ใช้ชิเอลถี่เกินไป รอสักครู่แล้วลองใหม่";
  if (c === "invalid_json") return "ชิเอลตอบกลับมาไม่ครบ ลองกดอีกครั้ง";
  return "ชิเอลตอบไม่สำเร็จ: " + ((e && e.message) || "");
}
// ===== rules digest for Claude =====
export const RULES = `กติกา Battle of Talingchan (สรุปจาก Rule Book 3.2):
- Deck 50 ใบ + LIFE 5 ใบ (ชื่อไม่ซ้ำ). ชื่อเดียวกันไม่เกิน 4 ใบ. ต้องมี Only #1 พอดี 1 ใบ.
- เริ่มจั่ว 5 ใบ, เปลี่ยนมือได้ 1 ครั้ง. LIFE คว่ำ 5 ใบ.
- เทิร์น: Draw (มือน้อยกว่า 3 จั่วจนครบ 3 ไม่งั้นจั่ว 1, เทิร์นแรกสุดของผู้เริ่มก่อนจั่ว 2, Avatar ฝ่ายเจ้าของเทิร์นตื่น) → Main (อัญเชิญ/ก่อสร้าง/ใช้ Magic) → Battle (ผู้เริ่มก่อนไม่มีในเทิร์นแรก) → End (มือเกิน 7 ทิ้งเหลือ 7).
- จ่าย Cost = ทิ้งการ์ดจากมือลงนรกให้ผลรวม GEM ≥ Cost, ห้ามจ่ายเกินถ้าพอแล้ว, การ์ด GEM 0 ใช้จ่ายไม่ได้, GEM มีสีจ่ายได้เฉพาะการ์ดสีเดียวกัน.
- Avatar Zone: Avatar ≤4, รวม Token ≤6. Construct ≤3 ชื่อไม่ซ้ำ. Land Magic มีได้ 1 ใบร่วมกันทั้งสนาม.
- Magic ไม่มี Cost, แต่ละประเภท (Normal/Modification/React/Land) ใช้ได้ 1 ครั้งต่อเทิร์นต่อผู้เล่น. Normal/Modification/Land ใช้ใน Main ของตัวเอง, React ใช้ได้ทุกจังหวะ.
- โจมตี: Avatar ที่ตื่น → นอน. เป้าหมาย Avatar หรือ Construct ฝ่ายตรงข้าม, หรือ LIFE ได้เมื่ออีกฝ่ายไม่มี Avatar บน Avatar Zone (ยกเว้นเตะไข่). POWER มากกว่าชนะ อีกฝ่ายถูกทำลายลงนรก, เท่ากันถูกทำลายทั้งคู่ (ลูกฮึดชนะเมื่อเสมอ). โจมตี Construct: ทำลายเมื่อ POWER มากกว่า.
- โจมตี LIFE สำเร็จหงาย 1 ใบจากบนสุด ความสามารถ LIFE ทำงาน. หงายครบ 5 = สาหัส; ถูกโจมตี LIFE อีกครั้งขณะสาหัส = แพ้. การ์ดใน Deck เหลือ 0 ใบเมื่อไร = แพ้ทันที (หมดพร้อมกันทั้งสองฝ่าย = เสมอ).
- ใช้ผลของการ์ดต้องทำได้ครบทุกส่วน: ถ้าส่วนที่ไม่ใช่ "สามารถ" ไม่มีเป้าหมายหรือทำไม่ได้ (เช่น บีมตอนอีกฝ่ายไม่มี Avatar) จะใช้ความสามารถนั้นไม่ได้เลยและไม่ต้องจ่าย Cost.
- คีย์เวิร์ด: จุติ (ทำงานเมื่ออัญเชิญแบบจ่าย Cost), คำสั่งเสีย (ทำงานเมื่อถูกทำลายลงนรก), เซ่นไหว้ (ทำลายการ์ดฝ่ายเราเป็นค่าใช้จ่าย), พอดี (จ่าย GEM พอดีกับ Cost), สอดแนม (ดูการ์ดบนสุดของ Deck), ธรณีสูบ (ส่งการ์ดบนสุดของ Deck ลงนรก), สามัคคี (ให้ Avatar ที่ตื่นนอนแล้วบวก POWER ให้ผู้โจมตี), แทงหลัง (+1), โล่มนุษย์ (รับการโจมตีแทน), เตะไข่ (ตีLIFEได้แม้มี Avatar), เนรเทศ (ไปมิติมืด), เทิร์นละครั้ง, ต่อเนื่อง, สั่งใช้.
- สถานะคู่หู [Link X]: เมื่อบน Avatar Zone เรามี X อยู่ด้วย ผู้เล่นสั่งให้ทั้งสองใบเข้า Link ได้เทิร์นละ 1 คู่ (ใบหนึ่งอยู่ได้คู่เดียว) ความสามารถหลัง [Link X] ใช้ได้เฉพาะตอนอยู่ใน Link · ใบใดออกจาก Avatar Zone อีกใบออกจาก Link · Avatar ใน Link ถูกเปลี่ยนการควบคุมไม่ได้.
- เครื่องหมาย "...." ในชื่อหมายถึงการ์ดที่มีคำนั้นในชื่อ. {Symbol X} หมายถึง Avatar ที่มี Symbol X. หารปัดลง.`;

export function stateText(s, view, opts = {}) {
  const L = [];
  const me = s.P[view], op = s.P[1 - view];
  L.push(`เทิร์น ${s.turn} · เฟส ${PHASE_TH[s.phase]} · ตาเดินของ ${s.P[s.active].name}${s.active === view ? " (ฝ่ายคุณ)" : " (ฝ่ายตรงข้าม)"}`);
  const zone = (P, z) => P[z].map((x) => {
    const d = E.def(s, x); let t = `#${x.i} ${d.n}`;
    if (z === "av") t += ` [POWER ${E.power(s, x)}${(x.pm || x.tm) ? ` ฐาน${d.pw || 0}` : ""}, ${x.a ? "ตื่น" : "นอน"}${d.sy ? ", " + d.sy : ""}${d.co ? ", สี" + d.co : ""}${x.tok ? ", Token" : ""}${(x.kw || []).length ? ", ได้รับ " + x.kw.join("/") : ""}${x.lk ? ", Link กับ #" + x.lkp : ""}]`;
    else if (z === "cs") t += ` [Construct POWER ${E.power(s, x)}]`;
    else if (z === "mg") t += x.on ? ` [สวมใส่ #${x.on}]` : "";
    else if (z === "hand") t += ` [${TYPE_TH[d.t]}${d.st ? "/" + SUB_TH[d.st] : ""}${d.c != null && d.t !== "M" ? " C" + d.c : ""} G${d.g || 0}${d.gc ? "(" + d.gc + ")" : ""}${d.pw != null ? " P" + d.pw : ""}${d.co ? " " + d.co : ""}]`;
    return t;
  }).join("; ") || "ว่าง";
  for (const [P, tag, hid] of [[me, "ฝ่ายคุณ", false], [op, "ฝ่ายตรงข้าม", true]]) {
    const ups = P.life.filter((x) => x.up).map((x) => E.name(s, x));
    L.push(`\n[${tag}: ${P.name}] Deck ${P.deck.length} · มือ ${P.hand.length} · LIFE คว่ำ ${P.life.filter((x) => !x.up).length}/5${ups.length ? " (หงายแล้ว: " + ups.join(", ") + ")" : ""}${E.critical(P) ? " · สาหัส!" : ""}`);
    L.push(`  Avatar Zone: ${zone(P, "av")}`);
    if (P.cs.length) L.push(`  Construct Zone: ${zone(P, "cs")}`);
    if (P.mg.length) L.push(`  Magic Zone: ${zone(P, "mg")}`);
    if (!hid || opts.all) L.push(`  มือ: ${zone(P, "hand")}`);
    if (P.hell.length) L.push(`  นรก (${P.hell.length}): ${P.hell.slice(-12).map((x) => "#" + x.i + " " + E.name(s, x)).join(", ")}`);
    if (P.dark.length) L.push(`  มิติมืด: ${P.dark.map((x) => E.name(s, x)).join(", ")}`);
  }
  for (const l0 of E.lands(s)) L.push(`\nLand Magic บนสนาม: #${l0.i} ${E.name(s, l0)} (ของ ${s.P[l0.o].name})`);
  if (s.pend) L.push(`\nกำลังโจมตี: #${s.pend.att} → ${s.pend.tk === "life" ? "LIFE" : "#" + s.pend.ti}`);
  // texts of visible cards
  const vis = new Map();
  const addv = (x) => { const d = E.def(s, x); if (d.x && !vis.has(d.n)) vis.set(d.n, d.x.replace(/\s+/g, " ").slice(0, 260)); };
  for (const P of s.P) { [...P.av, ...P.cs, ...P.mg].forEach(addv); }
  me.hand.forEach(addv); E.lands(s).forEach(addv);
  if (vis.size) { L.push("\nข้อความการ์ดที่มองเห็น:"); for (const [n, x] of vis) L.push(`- ${n}: ${x}`); }
  return L.join("\n");
}

// ===== heuristic bot =====
// worth of a worn card that gives no flat POWER bonus: an ability, a conditional bonus or a trigger for the wearer
// what a Construct's lasting text does for its side when it reads generic (not tied to a named theme): the other side
// cannot attack our LIFE (ป้อมยาม), every Avatar of ours gets POWER or a keyword (เวทีเพื่อชีวิต, เสาธง), it turns our
// LIFE back down (ตู้วารีบำบัด). The board evaluation counts the body only, so these were never worth building.
const csCache = new Map();
const csBonus = (d) => { const t = String((d && d.x) || ""); if (csCache.has(t)) return csCache.get(t); let v = 0;
  if (/ฝ่ายตรงข้าม\s*(?:ไม่สามารถ|ไม่)\s*โจมตี\s*LIFE/.test(t)) v += 6;
  else if (/Avatar\s*ทุกใบ[^/\n]{0,40}ฝ่ายเรา[^/\n]{0,30}(?:POWER\s*\+|ได้รับ)/.test(t)) v += 2.5;
  if (/คว่ำ/.test(t) && /LIFE/.test(t)) v += 1.2;
  csCache.set(t, v); return v; };
const gearV = (t) => (/ได้รับความสามารถ|ได้รับ\s*(?:POWER|การ์ด)|ที่สวมใส่การ์ดใบนี้/.test(String(t || "")) ? 2 : 0);
export const H = {
  look: 4, // how many of the best-looking main-phase options get played out on a copy before choosing (0 = off)
  lookAtk: false, // play attacks out too (off: it made the bots too timid in testing)
  // how good the table looks for p (used by the one-step lookahead): board, hand, LIFE still face down, Deck running out
  evalBoard(s, p) {
    if (s.phase === "over") return s.winner === p ? 999 : -999;
    const side = (q) => { const P = s.P[q]; let v = 0;
      for (const x of P.av) { const d = E.def(s, x); v += E.power(s, x) + (d.c || 0) * 0.45 + (x.a ? 0.35 : 0) + (d.o1 ? 2 : 0); }
      for (const x of P.cs) v += 1.4 + E.power(s, x) * 0.3 + csBonus(E.def(s, x));
      for (const m of P.mg) if (m.on != null) { const d = E.def(s, m); v += ["A", "T"].includes(d.t) ? 1 + (d.c || 0) * 0.45 : 0.5; } // a worn Avatar (โอตะ …) is safe and can come back
      v += P.hand.length * 1.05;
      for (const l of E.lands(s)) if (l.o === q) v += 1.6; // a Land Magic of ours works every turn
      const down = P.life.filter((y) => !y.up).length; v += down * 2.4 + (down === 0 ? -5 : 0);
      if (P.deck.length < 5) v -= (5 - P.deck.length) * 1.5;
      return v; };
    return side(p) - side(1 - p);
  },
  // play a move on a copy of the game, let both sides finish what it starts, and return how much better the table got for p.
  // The copy hides the other player's hand (no peeking at their React cards) and shuffles p's own Deck (no peeking at the top).
  lookahead(s, p, a) {
    let t; try { t = clone({ ...s, log: [], ev: [] }); } catch { return null; }
    try { t.P[1 - p].hand = []; E.shuffle(t, t.P[p].deck); const before = H.evalBoard(t, p); E.apply(t, a, p);
      for (let n = 0; n < 90 && t.phase !== "over"; n++) {
        if (t.rw) { const q = 1 - t.rw.by; E.apply(t, (q === p && H.react(t, q)) || { type: "pass" }, q); continue; }
        if (t.trig.length) { const tr = t.trig[0]; E.apply(t, H.trig(t, tr), tr.seat); continue; }
        if (t.pend && t.pend.by === p) { const q = 1 - p; const m = H.pick(t, q); E.apply(t, m ? m.a : { type: "respond" }, q); continue; }
        break; }
      return H.evalBoard(t, p) - before;
    } catch { return null; }
  },
  // the pro bot: each promising option (its own first choice, the best-scored others, going on to battle or ending the
  // turn) is played out on copies to the start of our next turn, both sides playing the quick way and the other side's
  // hand guessed from the cards it has not shown; the option with the best average table is played. Against the normal
  // bot with the same decks this won 65% of 300 games (looking at more options with the one-step lookahead won 51%).
  // (for its own Main and Battle Phase: playing out its answers to attacks and React moments too made no difference in
  // 480 games, 51%, so those stay with the quick rules)
  mcPick(s, p, n = 2, wide = 10) {
    const moves = legalMoves(s, p); if (!moves.length) return null;
    const base = H.pick(s, p), key = (a) => JSON.stringify(a), cand = [];
    const add = (m) => { if (m && !cand.some((c) => key(c.a) === key(m.a))) cand.push(m); };
    add(base); for (const m of moves) { if (cand.length >= wide) break; if (["summon", "cast", "build", "attack", "activate"].includes(m.a.type)) add(m); }
    add(moves.find((m) => m.a.type === "battle")); add(moves.find((m) => m.a.type === "end"));
    if (cand.length < 2) return base || cand[0] || null;
    let best = null;
    for (const m of cand) {
      let sum = 0, got = 0; for (let k = 0; k < n; k++) { const v = H.rollout(s, p, m.a, k); if (v != null) { sum += v; got++; } }
      if (!got) continue; const avg = sum / got + (m === base ? 0.3 : 0); if (!best || avg > best.v) best = { v: avg, m };
    }
    return best ? best.m : base;
  },
  // one play-out for mcPick: a copy with the other side's hand dealt again from its unseen cards and our Deck shuffled,
  // the move made, then both sides the quick way (no lookahead) until our next Main Phase; how good the table is then
  rollout(s, p, a, k) {
    let t; try { t = clone({ ...s, cards: null, log: [], ev: [] }); } catch { return null; } t.cards = s.cards; t.seed = (t.seed + 7919 * (k + 1)) | 0;
    const O = t.P[1 - p], pool = E.shuffle(t, [...O.hand, ...O.deck]); O.hand = pool.slice(0, O.hand.length); O.deck = pool.slice(O.hand.length); E.shuffle(t, t.P[p].deck);
    const T = t.turn, look = H.look; H.look = 0;
    try {
      E.apply(t, a, p);
      for (let i = 0; i < 400 && t.phase !== "over" && !(t.turn > T && t.active === p && t.phase === "main"); i++) { // to our next Main Phase
        if (t.rw) { const q = 1 - t.rw.by; E.apply(t, H.react(t, q) || { type: "pass" }, q); continue; }
        if (t.trig.length) { const tr = t.trig[0]; E.apply(t, H.trig(t, tr), tr.seat); continue; }
        const q = t.pend ? 1 - t.pend.by : t.active;
        if (t.phase === "end" && t.need) { E.apply(t, { type: "discard", iids: H.discard(t, q) }, q); continue; }
        const m = H.pick(t, q); try { E.apply(t, m ? m.a : t.pend ? { type: "respond" } : { type: "end" }, q); } catch { E.apply(t, { type: "end" }, q); }
      }
      return H.evalBoard(t, p);
    } catch { return null; } finally { H.look = look; }
  },
  value(s, x) { const d = E.def(s, x); if ((scriptOf(s, x) || {}).anyHell) return 8; return d.t === "A" ? (d.pw || 0) + (d.c || 0) * 0.5 + (d.o1 ? 10 : 0) : d.t === "C" ? 3 : 2; },
  mulligan(s, p) {
    const P = s.P[p]; const cheap = P.hand.filter((x) => { const d = E.def(s, x); return d.t === "A" && (d.c || 0) <= 3; });
    if (cheap.length >= 2) return [];
    return P.hand.filter((x) => { const d = E.def(s, x); const sc = scriptOf(s, x); if (sc && sc.mullKeep && sc.mullKeep(E, s, x, P.hand)) return false; return (d.c || 0) >= 5 && !d.o1; }).map((x) => x.i);
  },
  pick(s, p) {
    const moves = legalMoves(s, p); if (!moves.length) return null;
    const P = s.P[p], O = s.P[1 - p];
    if (s.pend) {
      const att = E.locate(s, s.pend.att); const ap = att ? E.power(s, att.x) + (s.pend.bonus || 0) : 0;
      const sh = moves.filter((m) => m.a.shield).map((m) => ({ m, p: E.power(s, E.locate(s, m.a.shield).x), v: H.value(s, E.locate(s, m.a.shield).x) })).sort((a, b) => b.p - a.p)[0];
      // a forced โล่มนุษย์ (ลิโป้): one that wins the fight, otherwise the cheapest one
      if (!moves.some((m) => m.a.type === "respond" && !m.a.shield)) { const all = moves.filter((m) => m.a.shield).map((m) => { const y = E.locate(s, m.a.shield).x; return { m, p: E.power(s, y), v: H.value(s, y) }; }); const w = all.filter((z) => z.p > ap).sort((a, b) => a.v - b.v)[0] || all.sort((a, b) => a.v - b.v)[0]; if (w) return w.m; }
      if (sh && (s.pend.tk === "life" ? sh.p >= ap - 1 || E.critical(P) : sh.p > ap)) return sh.m; // a LIFE hit that would end the game: any shield
      // abilities that answer an attack (นักรบ ฮอล, อาจารย์หลี): their scripts say when it is worth it
      for (const m of moves.filter((m) => m.a.type === "answer")) { const L = E.locate(s, m.a.i); const sc = L && scriptOf(s, L.x); if (sc && sc.answer.botOk && sc.answer.botOk(E, s, L.x, L, ap)) return m; }
      return moves[0];
    }
    if (s.phase === "main") {
      // score every playable option; the best one above a small threshold is played, otherwise go to battle
      const cand = [];
      for (const m of moves) {
        const a = m.a; if (a.type === "battle") continue;
        if (a.type === "activate") { const L = E.locate(s, a.i); const nm = L ? E.name(s, L.x) : ""; const fx = L ? H.opsScore(s, p, H.preview(s, { i: L.x.i, c: L.x.c, when: "activate", seat: p, ...(a.k != null ? { k: a.k } : {}) })) : 0;
          cand.push({ m, sc: /นักท่องเรื่องราว/.test(nm) ? 7 : /มิติมืด/.test(m.d) ? 5 : fx < 0 ? fx : 1.5 + Math.min(6, fx) }); continue; }
        const x = P.hand.find((y) => y.i === a.i) || (a.from === "hell" ? P.hell.find((y) => y.i === a.i) : null); if (!x) continue; const d = E.def(s, x);
        const payLoss = (a.pay || []).reduce((t, i) => t + H.value(s, P.hand.find((y) => y.i === i)), 0);
        let sc = -99;
        let bias = 0; { const sx = scriptOf(s, x); if (sx && sx.botHold) bias = sx.botHold(E, s, x, p) || 0; } // a card that is better kept in hand for now
        if (a.type === "summon") { const fx = d.x && /จุติ/.test(d.x) ? H.opsScore(s, p, H.preview(s, { i: x.i, c: x.c, when: "summon", seat: p, exact: true })) : 0; sc = (d.pw || 0) + 2 + Math.max(0, fx) + csBonus(d) - payLoss * 0.45 + (P.av.length < 2 ? 3 : 0) + bias; } // csBonus: a lasting buff for every Avatar of ours
        else if (a.type === "build") sc = 3 + csBonus(d) - payLoss * 0.3;
        else if (a.type === "cast" && d.st === "L") sc = E.lands(s).some((l) => l.o === p) ? -1 : E.lands(s).length && !E.landSc(s, "splitLand") ? 3 : 2.5; // ours replaces theirs: their Land goes too
        else if (a.type === "cast" && d.st === "D") { const host = P.av.find((y) => y.i === a.on); const sm = scriptOf(s, x); const b = sm && sm.modV ? sm.modV(E, s, x, host) : modBonus(d.x) || (host ? modPowerFor(E, s, x, host) : 0) || gearV(d.x); sc = b > 0 && host ? b + (host.a ? 1.5 : 0) + E.power(s, host) * 0.1 : -1; }
        else if (a.type === "cast" && d.st === "N") sc = H.opsScore(s, p, H.preview(s, { i: x.i, c: x.c, when: "cast", seat: p }));
        else if (a.type === "cast" && d.st === "R") { const sr = scriptOf(s, x); let v = -99; // a React that names no moment, played in our own turn
          if (sr && sr.react && sr.react.anytime && sr.react.botV) { try { v = sr.react.botV(E, s, p, null); } catch { v = -99; } } sc = v >= 3 ? v : -99; }
        if (a.via != null) sc += 4; // ซาร์อึก: a dragon for almost nothing
        cand.push({ m, sc, bias });
      }
      cand.sort((a, b) => b.sc - a.sc);
      // a free Magic about to be paid away as GEM for the chosen play, while that play can still be paid for without it:
      // cast it first (the play comes next, paid with the other cards)
      const first = (m) => { if (!m || !["summon", "build"].includes(m.a.type) || m.a.via != null || !(m.a.pay || []).length) return m;
        for (const z of cand) if (z.m.a.type === "cast" && z.sc >= 1.5 && m.a.pay.includes(z.m.a.i) && E.autoPay(s, p, m.a.i, undefined, [z.m.a.i])) return z.m;
        return m; };
      if (H.look && cand.length) { const top = cand.filter((z) => z.sc > -20).slice(0, H.look);
        for (const z of top) z.lv = H.lookahead(s, p, z.m.a);
        const ranked = top.filter((z) => z.lv != null).map((z) => ({ ...z, tot: z.lv + z.sc * 0.25 + (z.bias || 0) })).sort((a, b) => b.tot - a.tot);
        if (ranked.length) return ranked[0].tot >= 0.9 || (ranked[0].sc >= 1.5 && ranked[0].lv > -1) ? first(ranked[0].m) : moves.find((m) => m.a.type === "battle"); }
      if (cand.length && cand[0].sc >= 1.5) return first(cand[0].m);
      return moves.find((m) => m.a.type === "battle");
    }
    if (s.phase === "battle") {
      const tr = moves.find((m) => m.a.type === "activate" && /แปลงร่าง|โจมตีได้/.test(m.d)); if (tr) return tr; // transform / unlock attacks before attacking
      // their awake โล่มนุษย์ can take any attack (a LIFE attack too): the strongest one they could put in the way
      const shieldP = (x, ti) => (x.nsh === s.turn ? -1 : Math.max(-1, ...O.av.filter((y) => y.a && y.i !== ti && E.kw(s, y, "โล่มนุษย์")).map((y) => E.power(s, y))));
      // while we are สาหัส every LIFE hit ends the game: an awake โล่มนุษย์ of ours that their coming attacks need stays home
      // (it is asleep once it attacks), unless this attack wins the game right now
      const guards = P.av.filter((y) => y.a && E.kw(s, y, "โล่มนุษย์")); const threats = E.critical(P) ? O.av.length : 0;
      const atk = moves.filter((m) => m.a.type === "attack").map((m) => {
        const x = E.locate(s, m.a.i).x; const ap = E.power(s, x);
        if (threats && guards.includes(x) && guards.length <= threats && !(m.a.tk === "life" && E.critical(O) && shieldP(x, null) < 0)) return { m, score: -5 };
        if (m.a.tk === "life") { const sp = shieldP(x, null); // they block when the shield holds (or when the hit would end the game)
          if (sp >= 0 && (sp >= ap - 1 || E.critical(O))) return { m, score: ap > sp ? 20 + sp : ap === sp ? 4 : -8 };
          return { m, score: 50 + (E.critical(O) ? 100 : 0) }; }
        const t = E.locate(s, m.a.ti).x; const tp = E.power(s, t);
        if (m.a.tk === "cs") return { m, score: ap > tp ? 8 : -5 };
        if (m.a.tk === "av" && shieldP(x, t.i) > ap) return { m, score: -10 }; // a stronger shield steps in and our attacker loses
        if (ap > tp) return { m, score: 20 + tp };
        if (m.a.tk === "av") { // can สามัคคี / แทงหลัง helpers turn this into a win?
          const helpers = P.av.map((y) => ({ y, hq: E.helpOf(s, p, x, y) })).filter((z) => z.hq && !z.hq.risky).map((z) => ({ i: z.y.i, b: z.hq.n })).sort((a, b) => a.b - b.b);
          let bonus = 0; const sup = []; for (const hlp of helpers) { if (ap + bonus > tp) break; bonus += hlp.b; sup.push(hlp.i); }
          if (ap + bonus > tp) return { m: { ...m, a: { ...m.a, sup } }, score: 14 + tp - sup.length * 2 };
        }
        if (ap === tp) { const mine = E.kw(s, x, "ลูกฮึด"), theirs = E.kw(s, t, "ลูกฮึด"); // ลูกฮึด wins a tie against one without it
          if (mine && !theirs) return { m, score: 20 + tp }; if (theirs && !mine) return { m, score: -10 };
          return { m, score: tp >= ap && E.def(s, t).c >= E.def(s, x).c ? 5 : -2 }; }
        return { m, score: -10 };
      }).filter((z) => z.score > 0).sort((a, b) => b.score - a.score);
      if (H.look && H.lookAtk && atk.length) { const top = atk.slice(0, H.look + 1).map((z) => ({ ...z, lv: H.lookahead(s, p, z.m.a) })).filter((z) => z.lv != null);
        if (top.length) { top.sort((a, b) => b.lv + b.score * 0.02 - (a.lv + a.score * 0.02)); if (top[0].lv > 0.3) return top[0].m; return moves.find((m) => m.a.type === "end") || moves.find((m) => m.a.type === "attack"); } }
      if (atk.length) return atk[0].m;
      return moves.find((m) => m.a.type === "end") || moves.find((m) => m.a.type === "attack"); // a forced attacker must still attack
    }
    return null;
  },
  // what an effect would do, read on a copy whose Deck order is unknown to the bot (shuffled), so scouting / milling
  // effects are judged on what could come rather than on the real top card (the bot does not peek at its Deck)
  preview(s, t) { try { const P = s.P && s.P[t.seat]; const u = P && P.deck.length > 1 ? { ...s, P: s.P.map((Q, q) => (q === t.seat ? { ...Q, deck: E.shuffle({ seed: (s.seed ^ 0x2545f491) | 0 }, [...Q.deck]) } : Q)) } : s;
    const r = resolveEffect(u, t); return r && r.ops ? r : null; } catch { return null; } },
  // value of an auto-read effect for player p (rough, used to decide whether to cast/summon)
  opsScore(s, p, r) {
    if (!r) return -1; let v = 0;
    for (const o of r.ops) {
      if (o.op === "draw") v += o.seat === p ? (s.P[p].hand.length < 7 ? 1.5 : 0.3) * (o.n || 1) : -1.2 * (o.n || 1);
      else if (o.op === "mill") v += o.seat === p ? -0.2 * (o.n || 1) : 0.3 * (o.n || 1);
      else if (o.op === "destroy") { const L = E.locate(s, o.i); v += L ? (L.p === p ? -(2 + E.power(s, L.x) * 0.6 + (E.def(s, L.x).c || 0) * 0.3 - (L.x.tok ? 1 : 0)) : 5 + E.power(s, L.x) * 0.6) : 0; } // ours: a weak one costs less than a strong one
      else if (o.op === "move" && ["hell", "dark"].includes(o.to)) { const L = E.locate(s, o.i); if (L && ["av", "cs"].includes(L.z)) v += L.p !== p ? 5 + E.power(s, L.x) * 0.6 : -(2 + E.power(s, L.x) * 0.6); } // sent off the table: as good (or bad) as destroying it
      else if (o.op === "move" && o.to === "hand") { const L = E.locate(s, o.i); const field = L && ["av", "cs", "mg"].includes(L.z); // a card from a Deck or hell to its owner's hand, or one bounced off the table
        v += !L ? 0 : L.p !== p ? (field ? 4 : -1.2) : field ? -2 : 1.6; }
      else if (o.op === "power") { const L = E.locate(s, o.i); v += L ? ((L.p === p) === (o.n > 0) ? Math.abs(o.n) * (s.turn > 1 ? 0.8 : 0.3) : -Math.abs(o.n)) : 0; }
      else if (o.op === "wake") { const L = E.locate(s, o.i); const mine = L && L.p === p; v += !L ? 0 : o.v === false ? (mine ? -2 : 2) : mine ? (L.x.a ? 0 : 2) : -2; }
      else if (["search", "scout", "fromHell"].includes(o.op)) v += 2.5;
      else if (o.op === "discard") v -= 1.6 * (o.iids || []).length;
      else if (o.op === "attach") { const H2 = E.locate(s, o.on); const L = E.locate(s, o.i); v += H2 && H2.p === p ? (L && L.p !== p && L.z === "av" ? 6 : L && L.z === "av" ? 1.5 : 3) : 0; }
      else if (o.op === "put") { const L = E.locate(s, o.i); v += L ? 2 + E.power(s, L.x) * 0.5 + (o.jt ? 1.5 : 0) : 0; }
      else if (o.op === "toLand") v += 1.5;
      else if (o.op === "mute") { const L = E.locate(s, o.i); v += L && L.p !== p ? 2.5 + E.power(s, L.x) * 0.3 : -3; }
      else if (o.op === "control") { const L = E.locate(s, o.i); v += L && L.p !== p ? 4 + E.power(s, L.x) * 0.5 : 0; }
      else if (o.op === "lifeDamage") v += o.seat === p ? -8 : 7;
      else if (o.op === "exile") { const L = E.locate(s, o.i); v += L && L.p !== p && L.z === "av" ? 5 + E.power(s, L.x) * 0.6 : 0; }
      else if (o.op === "negate") v += 4;
      else if (o.op === "keyword") v += 1.2;
      // LIFE turned up (as a cost or an attack-free hit) or back down; tokens; the other side's hand thinned
      else if (o.op === "lifeFlip") { const sq = o.seat === 0 || o.seat === 1 ? o.seat : p, Q = s.P[sq], mine = sq === p;
        if (o.up === false) v += Q.life.some((y) => y.up) && !(E.critical(Q) && !o.force) ? (mine ? 2.4 : -2.4) : 0;
        else { const down = Q.life.filter((y) => !y.up).length; v += !down ? 0 : (mine ? -1 : 1) * (2.4 + (down === 1 ? 5 : 0)); } }
      else if (o.op === "token") { const sq = o.seat === 0 || o.seat === 1 ? o.seat : p; v += (sq === p ? 1 : -1) * (o.n || 1) * (1.5 + (o.power | 0) * 0.5); }
      else if (o.op === "exileRandom") { const sq = o.seat === 0 || o.seat === 1 ? o.seat : p; v += sq === p ? -1.8 * (o.n || 1) : Math.min(o.n || 1, s.P[sq].hand.length) * 1.5; }
      else if (o.op === "discardRandom") { const sq = o.seat === 0 || o.seat === 1 ? o.seat : p; v += sq === p ? -1.6 * (o.n || 1) : Math.min(o.n || 1, s.P[sq].hand.length) * 1.4; }
      else if (o.op === "borrow") v += s.P[1 - p].hand.length ? 2.2 : 0;
      else if (o.op === "enslave") { const L = E.locate(s, o.i); v += L && L.p !== p ? 5 + E.power(s, L.x) * 0.6 : 0; }
      else if (o.op === "extraN") v += 1;
    }
    return v;
  },
  // answer a window (s.rw) or an attack (s.pend) with a React if it is clearly worth it
  react(s, q) {
    const on = s.rw && s.rw.by !== q ? s.rw : s.pend && s.pend.by !== q ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null; if (!on) return null;
    // what the Magic or React being answered would do for its player: a counter (ชายจากอนาคต, อย่าให้มีครั้งที่ 2) is kept
    // for one that matters (removal of ours, a Land, a weapon, a big swing) instead of going on the first card seen
    let threat = null;
    if (on.kind === "cast" || on.kind === "react") { const t = s.trig.find((y) => y.i === on.i); const d = t ? s.cards[t.c] || {} : {}; const r0 = t ? H.preview(s, t) : null;
      threat = r0 ? H.opsScore(s, on.by, r0) : 2; if (d.st === "L" || d.st === "D") threat = Math.max(threat, 4); }
    let best = null;
    for (const x of E.reactsFor(s, q, on)) {
      const r = H.preview(s, { i: x.i, c: x.c, when: E.def(s, x).t === "M" ? "cast" : "handReact", seat: q, on }); let v = H.opsScore(s, q, r);
      if (r && r.ops.some((o) => o.op === "cancelAttack")) v += 3;
      if (threat != null && r && r.ops.some((o) => o.op === "negate" || o.op === "cancelTrig")) v += threat >= 4 ? 1 : -5;
      { const sc = scriptOf(s, x); if (sc && sc.react && sc.react.botV) v += sc.react.botV(E, s, q, on, x) || 0; }
      if (on.kind === "attack" && !on.own) { const A = E.locate(s, on.att); const T = on.tk === "av" ? E.locate(s, on.ti) : null; const ap = A ? E.power(s, A.x) + (s.pend.bonus || 0) : 0;
        const danger = on.tk === "life" ? (E.critical(s.P[q]) ? 30 : 4) : T && ap >= E.power(s, T.x) ? 3 + E.power(s, T.x) * 0.5 : 0; if (!danger) v -= 3; else v += danger * 0.3; }
      // our own attack: a fight React is for a fight we are not already winning
      if (on.kind === "attack" && on.own) { const A = E.locate(s, on.att); const T = on.tk === "av" ? E.locate(s, on.ti) : null; v += A && T && E.power(s, A.x) + (s.pend.bonus || 0) <= E.power(s, T.x) ? 2 : -4; }
      if (on.kind === "summon") { const L = E.locate(s, on.i); if (L) v += (E.def(s, L.x).c || 0) >= 4 || E.power(s, L.x) >= 5 ? 2 : -3; }
      if (!best || v > best.v) best = { v, x };
    }
    return best && best.v >= 3 ? { type: "cast", i: best.x.i } : null;
  },
  // resolve an effect without AI: read it if possible, otherwise skip
  trig(s, t) { let r = null; try { r = resolveEffect(s, t); } catch (e) { console.warn(e); } return r && r.ops ? { type: "trig", id: t.id, explain: r.explain, ops: r.ops } : { type: "trig", id: t.id, skip: true }; },
  discard(s, p) { const P = s.P[p]; return [...P.hand].sort((a, b) => H.value(s, a) - H.value(s, b)).slice(0, s.need).map((x) => x.i); },
};

// ===== Ciel =====
export async function cielPick(s, p, style) {
  const moves = legalMoves(s, p); if (moves.length <= 1) return moves[0] || null;
  const prompt = `คุณคือชิเอล บอทผู้เล่นการ์ดเกม Battle of Talingchan ที่เล่นเก่งและเล่นตามกติกา\n${RULES}\n\nสถานะเกม (มุมมองของคุณ):\n${stateText(s, p)}\n\nตัวเลือกที่ทำได้ตอนนี้:\n${moves.map((m, k) => `${k}. ${m.d}`).join("\n")}\n\nแนวการเล่น: ${style || "เล่นเพื่อชนะ ประเมินการแลกการ์ด รักษามือ และกดดัน LIFE เมื่อคุ้ม"}\nเลือก 1 ตัวเลือกที่ดีที่สุด ตอบเป็น JSON เท่านั้น เช่น {"pick": 0, "say": "เหตุผลสั้นๆ ภาษาไทย ไม่เกิน 15 คำ"}`;
  try {
    const r = await askJSON(prompt, { tier: "quick", max: 200 });
    const k = Number(r && r.pick);
    if (Number.isInteger(k) && moves[k]) return { ...moves[k], say: r.say };
  } catch (e) { console.warn("ciel pick", e); }
  return H.pick(s, p);
}
const OP_DOC = `รูปแบบผล (ops) ที่ระบบรองรับ ใช้เลข #id ของการ์ดจากสถานะเกม, seat 0 = ${"${S0}"}, seat 1 = ${"${S1}"}:
{"op":"draw","seat":S,"n":N} จั่ว | {"op":"mill","seat":S,"n":N} ธรณีสูบ | {"op":"move","i":ID,"to":"hand|hell|dark|deckTop|deckBottom|av|mg|cs|life","seat":S(ไม่ใส่=ฝ่ายเดิม)}
{"op":"destroy","i":ID} ทำลายลงนรก | {"op":"exile","i":ID} เนรเทศ | {"op":"power","i":ID,"n":±N,"temp":true(จนจบเทิร์น)|false(ถาวร)}
{"op":"wake","i":ID,"v":true|false} ตื่น/นอน | {"op":"keyword","i":ID,"k":"โล่มนุษย์"} ให้ความสามารถ | {"op":"token","seat":S,"name":"ชื่อ","power":N,"n":จำนวน}
{"op":"lifeFlip","seat":S,"up":true|false} หงาย/คว่ำ LIFE ด้วยความสามารถ | {"op":"lifeDamage","seat":S} ทำความเสียหาย LIFE 1 ใบ
{"op":"shuffle","seat":S} | {"op":"search","seat":S,"name":"คำในชื่อ","symbol":"Symbol(ถ้ามี)","to":"hand|av"} ค้นจาก Deck | {"op":"discardRandom","seat":S,"n":N}
{"op":"control","i":ID,"seat":S} ยึดการควบคุม | {"op":"note","text":"บันทึกผลที่ระบบทำให้ไม่ได้ เช่นผลต่อเนื่อง"} | {"op":"win","seat":S}`;
export async function cielResolve(s, trig, hint) {
  const x = E.locate(s, trig.i); const d = s.cards[trig.c] || {};
  const when = { summon: "ถูกอัญเชิญ (จุติ)", cast: "ถูกใช้", life: "LIFE ถูกหงายจากการโจมตี", death: "ถูกทำลายลงนรก (คำสั่งเสีย)", attack: "โจมตี", build: "ถูกก่อสร้าง", manual: "ผู้เล่นสั่งใช้ความสามารถ", end: "ถึงช่วง End Phase", mainStart: "เริ่ม Main Phase ของเรา", milled: "ถูกธรณีสูบลงนรก", paid: "ถูกทิ้งเป็นค่า Cost", win: "ชนะการต่อสู้" }[trig.when] || trig.when;
  const doc = OP_DOC.replace("${S0}", s.P[0].name).replace("${S1}", s.P[1].name);
  const prompt = `คุณคือชิเอล ผู้ตัดสินเอฟเฟกต์การ์ด Battle of Talingchan ให้ทำตามข้อความการ์ดอย่างถูกต้องตามกติกา\n${RULES}\n\nสถานะเกม (มุมมองผู้ควบคุมเอฟเฟกต์ seat ${trig.seat}):\n${stateText(s, trig.seat)}\n\nเอฟเฟกต์ที่ต้องจัดการ: การ์ด #${trig.i} "${d.n}" (${x ? ZONE_TH[x.z] : "ออกจากสนามแล้ว"}) เหตุการณ์: ${when}${trig.exact ? " · จ่าย GEM พอดีกับ Cost" : ""}\nข้อความการ์ด: ${d.x}\n${hint ? "\nผู้เล่นระบุเป้าหมาย/ความต้องการ: " + hint + "\n" : ""}\n${doc}\n\nกติกาการตอบ:\n- ทำเฉพาะส่วนที่เหตุการณ์นี้กระตุ้น ถ้าเงื่อนไขไม่ครบให้ ops ว่าง\n- ถ้าต้องเลือกเป้าหมาย ให้เลือกที่ดีที่สุดสำหรับผู้ควบคุมเอฟเฟกต์ เว้นแต่ผู้เล่นระบุไว้\n- ความสามารถต่อเนื่องที่ระบบคำนวณเองไม่ได้ ให้ใส่ power/keyword ที่เกี่ยวข้อง หรือ note อธิบาย\nตอบ JSON เท่านั้น: {"explain":"สรุปผลเป็นภาษาไทย 1-2 ประโยค","ops":[...]}`;
  const r = await askJSON(prompt, { tier: "default" });
  return { explain: String((r && r.explain) || "").slice(0, 300), ops: Array.isArray(r && r.ops) ? r.ops.slice(0, 20) : [] };
}
export async function cielCoach(s, p) {
  const moves = legalMoves(s, p);
  const prompt = `คุณคือชิเอล โค้ชการ์ดเกม Battle of Talingchan ให้คำแนะนำผู้เล่นชื่อริมุรุแบบกระชับ\n${RULES}\n\nสถานะเกม (มุมมองผู้เล่น):\n${stateText(s, p)}\n\nตัวเลือกที่ระบบเห็นว่าทำได้:\n${moves.map((m, k) => `${k}. ${m.d}`).join("\n") || "(ยังไม่ถึงตาเล่น)"}\n\nแนะนำว่าควรทำอะไรต่อในเทิร์นนี้ เรียงลำดับ 2-4 ข้อ พร้อมเหตุผลสั้นๆ และสิ่งที่ต้องระวังจากฝ่ายตรงข้าม 1 ข้อ ตอบเป็นข้อความภาษาไทยไม่เกิน 120 คำ ไม่ใช้หัวข้อ markdown`;
  return askText(prompt, { tier: "default" });
}

// ===== deck building with Claude =====
export function poolFor(colors, opts = {}) {
  const want = new Set(colors.filter(Boolean));
  const extra = (opts.ace || []).map(card).filter(Boolean);
  const refs = extra.flatMap((c) => [c.n.split(" ")[0], c.sy].filter(Boolean));
  const list = CARDS.filter((c) => isBase(c) && c.t !== "T" && c.fl !== "le").filter((c) => {
    if (c.t === "L") return true;
    if (!c.co) return true;
    if (want.has(c.co)) return true;
    return refs.some((r) => r && (c.x || "").includes(r));
  });
  return list;
}
export function poolText(list, max = 1400) {
  return list.slice(0, max).map((c) => `${c.i}|${c.n}|${TYPE_TH[c.t]}${c.st ? "/" + SUB_TH[c.st] : ""}|${c.co || "-"}|C${c.c ?? "-"}|G${c.g ?? 0}${c.gc ? "(" + c.gc + ")" : ""}|P${c.pw ?? "-"}|${c.sy || "-"}|${c.o1 ? "Only#1|" : ""}${c.lim ? "จำกัด" + c.lim + "|" : ""}${(c.x || "").replace(/\s+/g, " ").slice(0, 120)}`).join("\n");
}
export const STYLE_TH = { win: "ล่าชัย: เน้นอัตราชนะสูงสุด เส้นโค้ง Cost สมดุล การ์ดตอบโต้พอ", fun: "มันส์สุด: เน้นคอมโบสวย ลุ้นสนุก แต่ยังเล่นได้จริง", budget: "งบน้อย: เลี่ยงการ์ดหายาก (SR/UR/SCR) เท่าที่ทำได้ ใช้ C/R เป็นหลัก" };
export async function cielBuild({ ace, colors, style, request, owned }) {
  const aceCards = (ace || []).map(card).filter(Boolean);
  const cols = colors && colors.length ? colors : [...new Set(aceCards.map((c) => c.co).filter(Boolean))];
  const pool = poolFor(cols.length ? cols : COLORS, { ace });
  const prompt = `คุณคือชิเอล ผู้ช่วยจัดเด็คการ์ดเกม Battle of Talingchan ของริมุรุ\n${RULES}\n\n${aceCards.length ? "การ์ดเอซ (ต้องอยู่ในเด็คและเป็นแกนของแผน):\n" + aceCards.map((c) => "- id " + c.i + " " + cardLine(c, 300)).join("\n") : "ไม่มีการ์ดเอซกำหนด"}\nสีหลัก: ${cols.join(", ") || "เลือกเอง"}\nแนวทาง: ${STYLE_TH[style] || STYLE_TH.win}\n${request ? "ความต้องการเพิ่มเติม: " + request : ""}\n${owned ? "ให้ความสำคัญกับการ์ดที่ผู้เล่นมีอยู่แล้ว (id): " + owned : ""}\n\nคลังการ์ดที่ใช้ได้ (id|ชื่อ|ประเภท|สี|Cost|GEM|POWER|Symbol|ข้อความ):\n${poolText(pool)}\n\nจัดเด็ค Main 50 ใบพอดี (ชื่อเดียวกันไม่เกิน 4 หรือเท่าที่การ์ดจำกัด, Only#1 พอดี 1 ใบ, ห้ามใส่ LIFE ใน Main) และ LIFE 5 ใบชื่อไม่ซ้ำจากการ์ดประเภท LIFE ในคลัง\nคิดเรื่อง: การ์ดหนุนเอซ (Symbol/ชื่อ/สีที่ข้อความอ้างถึง), เส้น Cost, จำนวน GEM สำหรับจ่าย, การ์ดรับมือฝ่ายตรงข้าม, วิธีปิดเกม\nตอบ JSON เท่านั้น:\n{"name":"ชื่อเด็คภาษาไทยสั้นๆ","ace_rating":"S|A|B|C","ace_note":"ประเมินเอซว่าพอเป็นแกนไหม 1-2 ประโยค","plan":"แผนการเล่นช่วงต้น/กลาง/ท้าย 3-4 ประโยค","main":[{"id":123,"n":4}],"life":[id,id,id,id,id],"covers":["จุดอ่อนที่อุดแล้ว"],"risks":["จุดที่ยังต้องระวัง"],"mulligan":"คำแนะนำการเปลี่ยนมือ 1 ประโยค"}`;
  const r = await askJSON(prompt, { tier: "complex" });
  return normalizeBuild(r, aceCards);
}
export function normalizeBuild(r, aceCards) {
  const main = {};
  for (const e of (r && r.main) || []) { const c = card(e.id); if (!c || c.t === "L" || c.t === "T") continue; main[c.i] = Math.min(limitOf(c), (main[c.i] || 0) + Math.max(1, e.n | 0)); }
  for (const a of aceCards) if (!main[a.i]) main[a.i] = Math.min(limitOf(a), 3);
  const life = []; const seen = new Set();
  for (const id of (r && r.life) || []) { const c = card(id); if (c && c.t === "L" && !seen.has(c.n)) { life.push(c.i); seen.add(c.n); } }
  for (const c of CARDS) { if (life.length >= 5) break; if (c.t === "L" && isBase(c) && !seen.has(c.n)) { life.push(c.i); seen.add(c.n); } }
  return { name: String(r.name || "เด็คของชิเอล").slice(0, 60), main, life: life.slice(0, 5), ace: aceCards.map((c) => c.i), meta: { rating: r.ace_rating, aceNote: r.ace_note, plan: r.plan, covers: r.covers || [], risks: r.risks || [], mulligan: r.mulligan } };
}
export async function cielAnalyze(deck) {
  const ents = deckEntries(deck); const st = deckStats(deck);
  const ms = Data.matches.filter((m) => m.deckId === deck.id && m.mode !== "goldfish").slice(0, 15);
  const cols = Object.keys(st.colors).filter((c) => COLORS.includes(c));
  const pool = poolFor(cols, { ace: deck.ace }).filter((c) => !deck.main[c.i]);
  const prompt = `คุณคือชิเอล นักวิเคราะห์เด็ค Battle of Talingchan ของริมุรุ ตอบตรงไปตรงมา\n${RULES}\n\nเด็ค "${deck.name}" (${st.total} ใบ):\n${ents.map((e) => `${e.n}x id${e.id} ${cardLine(e.c, 200)}`).join("\n")}\nLIFE: ${(deck.life || []).map((i) => cardLine(card(i), 120)).join(" | ")}\nการ์ดเอซ: ${(deck.ace || []).map((i) => card(i).n).join(", ") || "ไม่ได้กำหนด"}\nเส้น Cost Avatar/Construct (0-8+): ${st.curve.join(",")} · GEM รวม ${st.gem} · POWER เฉลี่ย ${st.avgPw.toFixed(1)}\n\nผลการเล่น ${ms.length} เกมล่าสุด:\n${ms.map((m) => `- ${m.result === "win" ? "ชนะ" : "แพ้"} vs ${m.oppDeck || m.opp} ใน ${m.turns} เทิร์น (${m.reason || ""}) · บันทึกท้ายเกม: ${(m.log || []).slice(-6).join(" / ")}`).join("\n") || "ยังไม่มี"}\n\nการ์ดอื่นในสีเดียวกันที่อาจใส่แทน (id|...):\n${poolText(pool, 500)}\n\nตอบ JSON เท่านั้น:\n{"summary":"ภาพรวม 2 ประโยค","score":0-100,"strengths":["..."],"weaknesses":["..."],"swaps":[{"out_id":123,"in_id":456,"n":1,"why":"..."}],"tips":["เคล็ดลับการเล่น"],"matchups":"เด็คนี้ถนัด/แพ้ทางแบบไหน 1-2 ประโยค"}`;
  return askJSON(prompt, { tier: "complex" });
}
export async function cielAceCheck(c) {
  const syn = CARDS.filter((x) => isBase(x) && x.i !== c.i && ((c.sy && (x.x || "").includes(c.sy)) || (x.x || "").includes(c.n.split(" ")[0]))).slice(0, 60);
  const prompt = `คุณคือชิเอล ประเมินการ์ดเกม Battle of Talingchan ว่าเหมาะเป็นการ์ดเอซ (แกนหลัก) ของเด็คแค่ไหน\n${RULES}\n\nการ์ด: ${cardLine(c, 400)}\n\nการ์ดในคลังที่อ้างถึงชื่อหรือ Symbol ของใบนี้:\n${poolText(syn, 60) || "ไม่มี"}\n\nตอบ JSON เท่านั้น: {"rating":"S|A|B|C","why":"เหตุผล 2-3 ประโยค","needs":["สิ่งที่เด็คต้องมีเพื่อให้ใบนี้ทำงาน"],"partners":[id การ์ดคู่หูที่ดีจากรายการ สูงสุด 6]}`;
  return askJSON(prompt, { tier: "default" });
}
export async function cielReadImport(files) {
  const prompt = `อ่านภาพหน้าจอรายการเด็คหรือการ์ด Battle of Talingchan แล้วดึงรายชื่อการ์ดและจำนวน ตอบ JSON เท่านั้น: {"cards":[{"name":"ชื่อการ์ดตามภาพ","print":"รหัสเช่น BT07-012 ถ้าเห็น","n":จำนวน}]} ถ้าไม่แน่ใจจำนวนให้ใส่ 1`;
  return askJSON(prompt, { tier: "default", images: files });
}
