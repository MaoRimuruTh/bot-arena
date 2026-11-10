// Game engine — official Rule Book 3.2; card text effects are resolved by players or Ciel through ops.
import { card, kwHas, SUB_TH, CARDS, baseId } from "./cards.js?v=20261110171526";
import { readAura } from "./auras.js?v=20261110171526";
import { SCRIPTS } from "./scripts.js?v=20261110171526";
import { newId, clone } from "./util.js?v=20261110171526";
export const ZONES = ["deck", "hand", "av", "mg", "cs", "hell", "dark", "life"];
export const ZONE_TH = { deck: "Deck", hand: "มือ", av: "Avatar Zone", mg: "Magic Zone", cs: "Construct Zone", hell: "นรก", dark: "มิติมืด", life: "LIFE", land: "Land Magic" };
export const PHASE_TH = { mull: "เปลี่ยนมือ", draw: "Draw", main: "Main", battle: "Battle", end: "End", over: "จบเกม" };
export class RuleError extends Error {}
// script lookup: print code → base card id, so reprints share one script
let scriptBase = null;
export function scriptOf(s, x) {
  if (x.mute) return null; // "สูญเสียความสามารถทั้งหมด"
  const d = s.cards[x.c]; if (!d || d.im == null) return null;
  if (!scriptBase || scriptBase.n !== CARDS.length) { const m = new Map(); for (const [p, sc] of Object.entries(SCRIPTS)) { const c = CARDS.find((y) => y.p === p); if (c) m.set(baseId(c.i), sc); } scriptBase = { n: CARDS.length, m }; }
  return scriptBase.m.get(baseId(d.im)) || null;
}
const FIELD = ["av", "cs", "mg"];
export const END_RE = /อัตโนมัติ\s*ใน(?:ช่วง|ทุกๆ)?\s*End Phase(\s*(?:ของ)?\s*เรา)?/;
export const MAIN_RE = /อัตโนมัติ\s*(?:เมื่อ|ใน)?(?:ช่วง)?\s*เริ่ม(?:ต้น)?\s*Main Phase\s*(?:ของ)?\s*เรา/;
function fieldCards(s) { const out = []; for (let p = 0; p < 2; p++) for (const z of FIELD) for (const x of s.P[p][z]) out.push({ x, L: { p, z } }); if (s.land) out.push({ x: s.land, L: { p: s.land.o, z: "land" } }); return out; }
export const E = {
  ev(s, o) { s.evc = (s.evc || 0) + 1; (s.ev = s.ev || []).push({ id: s.evc, ...o }); if (s.ev.length > 40) s.ev.shift(); },
  rnd(s) { s.seed = (s.seed + 0x6D2B79F5) | 0; let t = s.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
  shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(E.rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  def: (s, x) => s.cards[x.c] || { n: "?", t: "A", x: "" },
  name: (s, x) => E.def(s, x).n,
  log(s, seat, m) { s.log.push({ t: s.turn, s: seat, m }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); },
  kw(s, x, k) { if (x.mute) return false; const d = E.def(s, x); return kwHas(d.x, k) || (x.kw || []).includes(k); },
  magicInHell: (s, p) => s.P[p].hell.filter((x) => E.def(s, x).t === "M").length,
  power(s, x) {
    const d = E.def(s, x); let mb = 0;
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) mb += modBonus(E.def(s, m).x);
    const tn = x.tn ? Object.values(x.tn).reduce((a, b) => a + b, 0) : 0;
    let au = 0; const me = E.locate(s, x.i);
    if (me && me.z === "av") for (const { x: src, L } of fieldCards(s)) { const sc = scriptOf(s, src); const ra = sc && sc.aura ? null : !src.mute && readAura(E.def(s, src));
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; for (const a of list) if (a.seat === me.p && a.test(x)) au += a.n; }
    return Math.max(0, (x.zero ? 0 : d.pw || 0) + (x.pm || 0) + (x.tm || 0) + tn + mb + au);
  },
  costOf(s, p, x) { // Cost after continuous reductions (e.g. ซาร์อึก)
    let c = E.def(s, x).c || 0;
    for (const { x: src, L } of fieldCards(s)) { if (L.p !== p) continue; const sc = scriptOf(s, src); if (sc && sc.costMod) c += sc.costMod(E, s, src, L, x); }
    return Math.max(0, c);
  },
  untargetable(s, x) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); return !!(L && sc && sc.untargetable && sc.untargetable(E, s, x, L)); },
  battleMod(s, me, foe) { const sc = scriptOf(s, me); return sc && sc.battle ? sc.battle(E, s, me, foe) : 0; },
  locked(s, p, x) { if (s.lock && s.lock[p] === "dragon") { const d = E.def(s, x); return !(String(d.sy || "").includes("มังกร") || String(d.n || "").includes("ผู้ฝึกมังกร")); } return false; },
  locate(s, i) {
    for (let p = 0; p < 2; p++) for (const z of ZONES) { const idx = s.P[p][z].findIndex((x) => x.i === i); if (idx >= 0) return { p, z, idx, x: s.P[p][z][idx] }; }
    if (s.land && s.land.i === i) return { p: s.land.o, z: "land", idx: 0, x: s.land };
    return null;
  },
  avatars: (P) => P.av.filter((x) => !x.tok).length,
  critical: (P) => P.life.length > 0 && P.life.every((x) => x.up),

  newGame({ players, decks, seed, first, mode, id }) {
    const s = { v: 1, id: id || newId(), mode, seed: seed | 0, turn: 0, active: first, first, phase: "mull", land: null, cards: {}, nextI: 1, log: [], trig: [], pend: null, need: 0,
      winner: null, reason: "", mull: [false, false], mu: [{}, {}], played: [{}, {}], startedAt: Date.now(), P: [] };
    for (let p = 0; p < 2; p++) {
      const pl = players[p];
      const P = { uid: pl.uid || null, name: pl.name, ava: pl.ava || "", bot: !!pl.bot, deckName: decks[p].name || "", deckId: decks[p].id || null, deck: [], hand: [], av: [], mg: [], cs: [], hell: [], dark: [], life: [] };
      const mk = (id) => { const c = card(id); s.cards[id] = s.cards[id] || { n: c.n, t: c.t, st: c.st, c: c.c, g: c.g, gc: c.gc, pw: c.pw, sy: c.sy, co: c.co, x: c.x || "", o1: c.o1, im: +id }; return { i: s.nextI++, c: String(id), o: p, a: true }; };
      P.deck = E.shuffle(s, decks[p].main.map(mk));
      P.life = E.shuffle(s, decks[p].life.map(mk)).map((x) => ({ ...x, up: false }));
      for (let k = 0; k < 5 && P.deck.length; k++) P.hand.push(P.deck.shift());
      s.P.push(P);
    }
    E.log(s, null, `เริ่มเกม · ${s.P[first].name} เริ่มก่อน`);
    return s;
  },
  draw(s, p, n) {
    const P = s.P[p];
    for (let k = 0; k < n; k++) {
      if (!P.deck.length) { E.lose(s, p, "Deck หมดระหว่างจั่ว"); return false; }
      P.hand.push(P.deck.shift());
    }
    return true;
  },
  lose(s, p, reason) { if (s.phase === "over") return; s.winner = 1 - p; s.phase = "over"; s.reason = reason; s.pend = null; s.trig = []; E.log(s, null, `${s.P[1 - p].name} ชนะ · ${reason}`); E.ev(s, { k: "over", w: 1 - p }); },
  startTurn(s, p) {
    s.turn++; s.active = p; s.phase = "draw"; s.mu = [{}, {}]; E.ev(s, { k: "turn", p, t: s.turn });
    for (const q of [0, 1]) for (const x of s.P[q].av) x.tm = 0;
    for (const x of s.P[p].av) x.a = true;
    for (const q of [0, 1]) for (const x of s.P[q].av) if (x.tn) { delete x.tn[p]; if (!Object.keys(x.tn).length) delete x.tn; } // "until our next Draw Phase" bonuses end
    const P = s.P[p]; const n = P.hand.length < 3 ? 3 - P.hand.length : 1;
    E.log(s, p, `เทิร์น ${s.turn} · ${P.name} จั่ว ${n} ใบ`);
    if (!E.draw(s, p, n)) return;
    s.phase = "main";
    if (s.later && s.later.length) { const now = s.later.filter((l) => l.seat === p); s.later = s.later.filter((l) => l.seat !== p); for (const l of now) { E.log(s, p, l.why || "เอฟเฟกต์ที่รอ Main Phase นี้"); E.ops(s, l.ops, p); } }
    for (const { x, L } of fieldCards(s)) if (L.p === p && !x.mute && (MAIN_RE.test(String(E.def(s, x).x || "")) || (scriptOf(s, x) || {}).mainStart)) E.addTrig(s, p, x, "mainStart"); // "อัตโนมัติ เมื่อเริ่ม Main Phase เรา :"
  },
  nextTurn(s) {
    s.need = 0; s.phase = "end";
    for (const { x, L } of fieldCards(s)) { const sc = scriptOf(s, x); if (sc && sc.endPhase) { const ops = sc.endPhase(E, s, x, L); if (ops.length) { E.log(s, L.p, `เอฟเฟกต์ End Phase: ${E.name(s, x)}`); E.ops(s, ops, L.p); } } }
    if (s.phase === "over") return;
    // printed "อัตโนมัติ ในช่วง End Phase (ของเรา) :" abilities become triggers resolved before the turn passes
    for (const { x, L } of fieldCards(s)) { if (x.mute || (scriptOf(s, x) || {}).endPhase) continue; const m = String(E.def(s, x).x || "").match(END_RE); if (m && (!m[1] || L.p === s.active)) E.addTrig(s, L.p, x, "end"); }
    if (s.trig.length) { s.endWait = true; return; }
    E.finishTurn(s);
  },
  finishTurn(s) {
    for (const q of [0, 1]) for (const x of [...s.P[q].av]) if (x.back != null) { const k = s.P[q].av.indexOf(x); s.P[q].av.splice(k, 1); const back = x.back; delete x.back; s.P[back].av.push(x); E.log(s, back, `${E.name(s, x)} กลับไปอยู่กับเจ้าของ`); }
    for (const q of [0, 1]) for (const x of s.P[q].av) { delete x.guard; if (x.muteEnd != null && x.muteEnd <= s.turn) { delete x.mute; delete x.zero; delete x.muteEnd; } }
    if (s.phase === "over") return;
    E.startTurn(s, 1 - s.active);
  },
  addTrig(s, seat, x, when, extra = {}) {
    const d = E.def(s, x);
    if (!d.x || x.mute) return;
    s.trig.push({ id: newId(), seat, i: x.i, c: x.c, when, ...extra });
  },
  // move a card instance anywhere; handles leave-field cleanup
  moveTo(s, i, to, seatOverride) {
    const L = E.locate(s, i); if (!L) throw new RuleError("ไม่พบการ์ด");
    const x = L.x;
    if (L.z === "land") s.land = null; else s.P[L.p][L.z].splice(L.idx, 1);
    if (L.z === "av") for (const q of [0, 1]) { const att = s.P[q].mg.filter((m) => m.on === x.i); for (const m of att) { s.P[q].mg.splice(s.P[q].mg.indexOf(m), 1); delete m.on; s.P[m.o].hell.push(m); E.log(s, m.o, `${E.name(s, m)} หลุดลงนรก (Avatar ที่สวมใส่ออกจากสนาม)`); } }
    if (L.z === "mg" && x.on) delete x.on;
    if (x.tok && to !== "av") { E.log(s, L.p, `Token ${E.name(s, x)} ถูกนำออกจากเกม`); return null; }
    x.a = true; x.pm = 0; x.tm = 0; for (const k of ["kw", "tn", "story", "mute", "zero", "muteEnd", "guard", "used", "saved", "exd", "canAtk", "back"]) delete x[k]; if (to !== "life") delete x.up;
    const owner = x.o; const ctl = seatOverride != null ? seatOverride : (L.z === "land" ? owner : L.p);
    const dest = { hand: owner, hell: owner, dark: owner, deckTop: owner, deckBottom: owner, life: seatOverride != null ? seatOverride : owner }[to];
    if (to === "deckTop") s.P[dest].deck.unshift(x);
    else if (to === "deckBottom") s.P[dest].deck.push(x);
    else if (to === "life") { x.up = false; s.P[dest].life.push(x); }
    else if (to === "land") { if (s.land) { const old = s.land; s.land = null; s.P[old.o].hell.push(old); } s.land = x; }
    else if (["av", "mg", "cs"].includes(to)) s.P[ctl][to].push(x);
    else if (dest != null) s.P[dest][to].push(x);
    else throw new RuleError("โซนไม่ถูกต้อง");
    return x;
  },
  destroy(s, i, cause) {
    const L = E.locate(s, i); if (!L) return;
    if (L.x.guard) { delete L.x.guard; E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลาย (ได้รับการป้องกัน)`); return; }
    if (L.z === "av") { const sh = [0, 1].flatMap((q) => s.P[q].mg).find((m) => m.on === L.x.i && (scriptOf(s, m) || {}).shield);
      if (sh) { E.log(s, L.p, `${E.name(s, sh)} ถูกทำลายแทน ${E.name(s, L.x)}`); E.moveTo(s, sh.i, "hell"); return; } }
    { const sc = scriptOf(s, L.x); if (sc && sc.wouldDestroy && L.x.saved !== s.turn && sc.wouldDestroy(E, s, L.x, L)) { L.x.saved = s.turn; return; } }
    const x = L.x; const tok = x.tok; const had = kwHas(E.def(s, x).x, "คำสั่งเสีย");
    E.ev(s, { k: "destroy", i, p: L.p });
    if (x.exd) { E.moveTo(s, i, "dark"); E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย แล้วถูกเนรเทศ (คำสั่งเสีย : เนรเทศการ์ดใบนี้)`); if (had && !tok) E.addTrig(s, x.o, x, "death"); return; }
    E.moveTo(s, i, "hell");
    E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย${cause ? " (" + cause + ")" : ""}`);
    if (had && !tok) E.addTrig(s, x.o, x, "death");
  },
  canPay(s, p, targetDef, pay, costOverride) {
    const P = s.P[p]; const cost = costOverride != null ? costOverride : targetDef.c || 0; let total = 0; const seen = new Set();
    for (const i of pay) {
      if (seen.has(i)) return { ok: false, err: "เลือกซ้ำ" }; seen.add(i);
      const x = P.hand.find((y) => y.i === i); if (!x) return { ok: false, err: "การ์ดจ่ายต้องอยู่บนมือ" };
      const d = E.def(s, x); const g = d.g || 0;
      if (g <= 0) return { ok: false, err: `${d.n} มี GEM 0 ใช้จ่ายไม่ได้` };
      if (d.gc && targetDef.co && d.gc !== targetDef.co) return { ok: false, err: `GEM สี${d.gc} จ่ายให้การ์ดสี${targetDef.co} ไม่ได้` };
      { const sc = scriptOf(s, x); if (sc && sc.payOnly && !sc.payOnly(targetDef)) return { ok: false, err: `${d.n} ใช้จ่ายได้เฉพาะการ์ดที่กำหนดเท่านั้น` }; }
      total += g;
    }
    if (total < cost) return { ok: false, err: `GEM ไม่พอ (${total}/${cost})`, total };
    for (const i of pay) { const d = E.def(s, P.hand.find((y) => y.i === i)); if (total - (d.g || 0) >= cost) return { ok: false, err: "จ่ายเกินจำเป็น (GEM พอแล้วจ่ายเพิ่มไม่ได้)", total }; }
    return { ok: true, total, exact: total === cost };
  },
  autoPay(s, p, i, costOverride, exclude = []) {
    const P = s.P[p]; const tgt = P.hand.find((x) => x.i === i); if (!tgt) return null;
    const td = E.def(s, tgt); const cost = costOverride != null ? costOverride : E.costOf(s, p, tgt); if (cost === 0) return [];
    const el = P.hand.filter((x) => x.i !== i && !exclude.includes(x.i)).filter((x) => { const d = E.def(s, x); const sc = scriptOf(s, x); return (d.g || 0) > 0 && !(d.gc && td.co && d.gc !== td.co) && !(sc && sc.payOnly && !sc.payOnly(td)); }).slice(0, 12);
    const val = (x) => { const d = E.def(s, x); return d.t === "A" ? (d.pw || 0) + (d.c || 0) * 0.6 + (d.o1 ? 20 : 0) : d.t === "C" ? 4 : 2.2; };
    let best = null;
    for (let m = 1; m < 1 << el.length; m++) {
      const pick = el.filter((_, k) => m & (1 << k)); const r = E.canPay(s, p, td, pick.map((x) => x.i), cost);
      if (!r.ok) continue;
      const score = pick.reduce((a, x) => a + val(x), 0) + pick.length * 0.4;
      if (!best || score < best.score) best = { score, pay: pick.map((x) => x.i) };
    }
    return best ? best.pay : null;
  },
  canAct(s, p) { return s.phase !== "over" && !s.trig.length && !s.pend && !s.rw && s.active === p && s.phase !== "mull"; },
  // which React cards in p's hand fit this moment (on = the window: summon / cast / attack)
  reactsFor(s, p, on) {
    if (s.mu[p].R || s.phase === "over") return [];
    return s.P[p].hand.filter((x) => { const d = E.def(s, x); if (d.t !== "M" || d.st !== "R") return false; const sc = scriptOf(s, x);
      if (sc && sc.react) return sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)) && (!sc.canCast || sc.canCast(E, s, p));
      return !s.P[p].bot && !(sc && sc.canCast && !sc.canCast(E, s, p)); });
  },
  // after a summon or a Magic, the other player may answer with a React before effects resolve
  openWindow(s, p, kind, i) { const q = 1 - p; const on = { kind, by: p, i }; if (E.reactsFor(s, q, on).length) s.rw = on; },

  apply(s, act, p) {
    if (s.phase === "over" && act.type !== "note") throw new RuleError("เกมจบแล้ว");
    const P = s.P[p], O = s.P[1 - p];
    const need = (cond, msg) => { if (!cond) throw new RuleError(msg); };
    switch (act.type) {
      case "mull": {
        need(s.phase === "mull" && !s.mull[p], "เปลี่ยนมือได้ตอนเริ่มเกมครั้งเดียว");
        const ids = act.iids || [];
        for (const i of ids) { const k = P.hand.findIndex((x) => x.i === i); need(k >= 0, "การ์ดไม่อยู่บนมือ"); P.deck.push(P.hand.splice(k, 1)[0]); }
        for (let k = 0; k < ids.length; k++) P.hand.push(P.deck.shift());
        if (ids.length) E.shuffle(s, P.deck);
        s.mull[p] = true; E.log(s, p, ids.length ? `${P.name} เปลี่ยนมือ ${ids.length} ใบ` : `${P.name} เก็บมือเดิม`);
        if (s.mull[0] && s.mull[1]) E.startTurn(s, s.first);
        return;
      }
      case "summon": case "build": {
        need(E.canAct(s, p) && s.phase === "main", "อัญเชิญได้เฉพาะ Main Phase ของคุณ");
        const x = P.hand.find((y) => y.i === act.i); need(x, "การ์ดไม่อยู่บนมือ");
        const d = E.def(s, x); let cost = E.costOf(s, p, x); let via = null;
        if (act.via != null) { // ซาร์อึก: discard it from hand, summon a dragon as จุติ with Cost -6, then only dragons for the rest of the game
          via = P.hand.find((y) => y.i === act.via); const vs = via && scriptOf(s, via);
          need(act.type === "summon" && vs && vs.handCall && via.i !== x.i, "ใช้ความสามารถนี้ไม่ได้");
          need(String(d.sy || "").includes("มังกร"), "ต้องเลือก Avatar {Symbol มังกร}");
          need(!(act.pay || []).includes(via.i), "ซาร์อึกถูกทิ้งเป็นค่าความสามารถแล้ว ใช้จ่าย GEM ซ้ำไม่ได้");
          cost = Math.max(0, cost - 6);
        }
        if (act.type === "summon") need(!E.locked(s, p, x), "หลังใช้ซาร์อึก เกมนี้อัญเชิญได้เฉพาะมังกรหรือผู้ฝึกมังกร");
        { const sc = scriptOf(s, x); need(!(sc && sc.noHand), "การ์ดใบนี้ลงสนามจากบนมือไม่ได้"); }
        if (act.type === "summon") { need(d.t === "A", "อัญเชิญได้เฉพาะ Avatar"); need(E.avatars(P) < 4 && P.av.length < 6, "Avatar Zone เต็ม (Avatar 4 / รวม Token 6)"); }
        else { need(d.t === "C", "ก่อสร้างได้เฉพาะ Construct"); need(P.cs.length < 3, "Construct Zone เต็ม (3 ใบ)"); need(!P.cs.some((y) => E.name(s, y) === d.n), "Construct ชื่อซ้ำในฝ่ายเดียวกันไม่ได้"); }
        const r = E.canPay(s, p, d, act.pay || [], cost); need(r.ok, r.err);
        if (via) { P.hand.splice(P.hand.indexOf(via), 1); P.hell.push(via); s.lock = s.lock || [null, null]; s.lock[p] = "dragon"; E.log(s, p, `ทิ้ง ${E.name(s, via)} เพื่ออัญเชิญมังกรแบบจุติ (Cost -6) · จากนี้อัญเชิญได้เฉพาะมังกร`); }
        const paid = [];
        for (const i of act.pay || []) { const k = P.hand.findIndex((y) => y.i === i); const y = P.hand.splice(k, 1)[0]; P.hell.push(y); paid.push(y); }
        P.hand.splice(P.hand.indexOf(x), 1); x.a = true; (act.type === "summon" ? P.av : P.cs).push(x);
        E.ev(s, { k: "summon", i: x.i, p });
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        E.log(s, p, `${act.type === "summon" ? "อัญเชิญ" : "ก่อสร้าง"} ${d.n} (จ่าย ${(act.pay || []).length} ใบ GEM ${r.total || 0}/${cost})${r.exact && kwHas(d.x, "พอดี") ? " · พอดี!" : ""}`);
        const scS = scriptOf(s, x);
        if (scS && scS.summon) { if (!scS.storyOnly || x.story) E.addTrig(s, p, x, "summon", { exact: r.exact }); }
        else if (kwHas(d.x, "จุติ")) E.addTrig(s, p, x, "summon", { exact: r.exact });
        else if (act.type === "build" && d.x) E.addTrig(s, p, x, "build", { optional: true });
        { const pt = paid.filter((y) => { const sc = scriptOf(s, y); return sc && sc.paid && (!sc.paidFor || sc.paidFor(d)); }).map((y) => ({ id: newId(), seat: p, i: y.i, c: y.c, when: "paid" }));
          const k = s.trig.findIndex((t) => t.i === x.i); s.trig.splice(k < 0 ? s.trig.length : k, 0, ...pt); } // paying happens before จุติ
        if (act.type === "summon") E.openWindow(s, p, "summon", x.i);
        return;
      }
      case "cast": {
        const x = P.hand.find((y) => y.i === act.i); need(x, "การ์ดไม่อยู่บนมือ");
        const d = E.def(s, x); need(d.t === "M", "ใช้ได้เฉพาะ Magic");
        need(s.phase !== "mull" && !s.mu[p][d.st], `Magic ประเภท ${SUB_TH[d.st]} ใช้ไปแล้วเทิร์นนี้`);
        { const sc = scriptOf(s, x); need(!(sc && sc.canCast && !sc.canCast(E, s, p)), "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้"); }
        if (d.st !== "R") need(E.canAct(s, p) && s.phase === "main", `${SUB_TH[d.st]} Magic ใช้ได้เฉพาะ Main Phase ของคุณ`);
        let on = null;
        if (d.st === "R") {
          on = s.rw && s.rw.by !== p ? { ...s.rw } : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
          const sc = scriptOf(s, x); if (sc && sc.react) need(on && sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)), "ยังไม่ถึงจังหวะของ React ใบนี้");
        }
        s.mu[p][d.st] = true; P.hand.splice(P.hand.indexOf(x), 1);
        if (s.active === p) for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p) continue; const sy = scriptOf(s, y); if (sy && sy.onMagic) { const ops = sy.onMagic(E, s, y, Ly); if (ops && ops.length) E.ops(s, ops, p); } }
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        if (d.st === "D") {
          const host = E.locate(s, act.on); need(host && host.z === "av", "ต้องเลือก Avatar บนสนามเพื่อสวมใส่");
          { const sc = scriptOf(s, x); need(!(sc && sc.modOnly && !sc.modOnly(E, s, host.x)), "สวมใส่ให้ Avatar ใบนี้ไม่ได้ (ไม่ตรงเงื่อนไขของการ์ด)"); }
          x.on = act.on; P.mg.push(x); E.log(s, p, `สวมใส่ ${d.n} ให้ ${E.name(s, host.x)}`);
          E.addTrig(s, p, x, "cast", { on: act.on });
        } else if (d.st === "L") {
          if (s.land) { const old = s.land; s.land = null; s.P[old.o].hell.push(old); E.log(s, p, `${E.name(s, old)} ถูกแทนที่`); }
          s.land = x; E.log(s, p, `ใช้ Land Magic ${d.n}`); if (!(scriptOf(s, x) && !scriptOf(s, x).cast)) E.addTrig(s, p, x, "cast"); E.ev(s, { k: "cast", i: x.i, p, st: "L" });
        } else {
          P.mg.push(x); E.log(s, p, `ใช้ ${SUB_TH[d.st]} Magic ${d.n}`); E.ev(s, { k: "cast", i: x.i, p, st: d.st });
          if (d.x) E.addTrig(s, p, x, "cast", { toHell: true }); else { P.mg.splice(P.mg.indexOf(x), 1); P.hell.push(x); }
          if (d.st === "R") { const k = s.trig.findIndex((t) => t.i === x.i); if (k > 0) { const [t] = s.trig.splice(k, 1); s.trig.unshift(t); } if (k >= 0) s.trig[0].on = on; s.rw = null; }
        }
        if (d.st !== "R") E.openWindow(s, p, "cast", x.i);
        return;
      }
      case "pass": { need(s.rw && s.rw.by !== p, "ไม่มีจังหวะให้ตอบโต้"); E.log(s, p, `${P.name} ไม่ตอบโต้`); s.rw = null; return; }
      case "battle": {
        need(E.canAct(s, p) && s.phase === "main", "ไปเฟสต่อสู้ได้จาก Main Phase");
        if (s.turn === 1) { E.log(s, p, "เทิร์นแรกของผู้เริ่มก่อนไม่มี Battle Phase"); return E.apply(s, { type: "end" }, p); }
        s.phase = "battle"; E.log(s, p, "เข้าสู่ Battle Phase"); E.ev(s, { k: "battle", p }); return;
      }
      case "attack": {
        need(E.canAct(s, p) && s.phase === "battle", "โจมตีได้เฉพาะ Battle Phase ของคุณ");
        const x = P.av.find((y) => y.i === act.i); need(x && x.a, "ต้องเป็น Avatar ที่ตื่นอยู่บน Avatar Zone");
        { const sc = scriptOf(s, x); need(!(sc && sc.noAttack && sc.noAttack(E, s, x)), "Avatar ใบนี้โจมตีไม่ได้ (ต้องใช้ความสามารถก่อน)"); }
        if (act.tk === "av") { need(O.av.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Avatar Zone ฝ่ายตรงข้าม"); need(!E.untargetable(s, E.locate(s, act.ti).x), "Avatar ใบนี้ถูกโจมตีไม่ได้ตอนนี้"); }
        else if (act.tk === "cs") need(O.cs.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Construct Zone");
        else if (act.tk === "life") need(!O.av.length || E.kw(s, x, "เตะไข่"), "ฝ่ายตรงข้ามยังมี Avatar อยู่ (ยกเว้นเตะไข่)");
        else throw new RuleError("เป้าหมายไม่ถูกต้อง");
        let bonus = 0; const sup = [];
        for (const i of act.sup || []) {
          const y = P.av.find((z) => z.i === i);
          if (!y || !y.a || y.i === x.i) continue;
          if (E.kw(s, y, "สามัคคี")) bonus += E.power(s, y); else if (E.kw(s, y, "แทงหลัง")) bonus += 1; else continue;
          y.a = false; sup.push(i);
        }
        x.a = false;
        s.pend = { att: x.i, tk: act.tk, ti: act.ti || null, bonus, sup, by: p };
        E.ev(s, { k: "declare", att: x.i, by: p, tk: act.tk, ti: act.ti || null });
        const tName = act.tk === "life" ? "LIFE" : E.name(s, E.locate(s, act.ti).x);
        E.log(s, p, `${E.name(s, x)} (POWER ${E.power(s, x) + bonus}) โจมตี ${tName}${sup.length ? ` · ผู้ช่วย ${sup.length} ใบ +${bonus}` : ""}`);
        { const sc = scriptOf(s, x); const ax = E.def(s, x).x || "";
          if (sc ? sc.attack && (!sc.storyOnly || x.story) : /เมื่อ\s*(?:Avatar\s*|การ์ด)?(?:ใบนี้|ตัวนี้)?\s*(?:ประกาศ)?โจมตี|เมื่อโจมตี/.test(ax)) E.addTrig(s, p, x, "attack"); }
        return;
      }
      case "respond": {
        need(s.pend && s.pend.by === 1 - p && !s.trig.length, "ยังไม่ถึงจังหวะตอบโต้");
        if (act.shield) {
          const y = P.av.find((z) => z.i === act.shield); need(y && E.kw(s, y, "โล่มนุษย์") && y.i !== s.pend.ti, "ต้องเป็น Avatar ที่มีโล่มนุษย์");
          s.pend.tk = "av"; s.pend.ti = y.i; E.log(s, p, `${E.name(s, y)} ใช้โล่มนุษย์รับการโจมตีแทน`);
        }
        E.resolveAttack(s); return;
      }
      case "end": {
        need(E.canAct(s, p) && (s.phase === "main" || s.phase === "battle"), "จบเทิร์นได้เฉพาะเทิร์นของคุณ");
        s.phase = "end";
        for (const q of [0, 1]) for (const x of s.P[q].av) x.tm = 0;
        if (P.hand.length > 7) { s.need = P.hand.length - 7; E.log(s, p, `มือเกิน 7 ใบ ต้องทิ้ง ${s.need} ใบ`); return; }
        E.log(s, p, `${P.name} จบเทิร์น`); E.nextTurn(s); return;
      }
      case "discard": {
        need(s.phase === "end" && s.active === p && s.need > 0, "ยังไม่ต้องทิ้งการ์ด");
        need((act.iids || []).length === s.need, `ต้องทิ้ง ${s.need} ใบพอดี`);
        for (const i of act.iids) { const k = P.hand.findIndex((x) => x.i === i); need(k >= 0, "การ์ดไม่อยู่บนมือ"); P.hell.push(P.hand.splice(k, 1)[0]); }
        E.log(s, p, `ทิ้งการ์ด ${act.iids.length} ใบลงนรก`); E.nextTurn(s); return;
      }
      case "trig": {
        const k = s.trig.findIndex((t) => t.id === act.id); need(k >= 0, "เอฟเฟกต์นี้จบไปแล้ว");
        const t = s.trig[k]; need(t.seat === p, "ไม่ใช่เอฟเฟกต์ของคุณ");
        s.trig.splice(k, 1);
        const nm = s.cards[t.c] ? s.cards[t.c].n : "การ์ด";
        if (act.skip) E.log(s, p, `ข้ามเอฟเฟกต์ ${nm}`);
        else { if (act.explain) E.log(s, p, `เอฟเฟกต์ ${nm}: ${act.explain}`); s.cur = t.c; try { E.ops(s, act.ops || [], p); } finally { delete s.cur; } }
        if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg") { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } }
        if (s.pend && !s.trig.length && s.pend.resolved) s.pend = null;
        if (s.endWait && !s.trig.length && s.phase === "end") { delete s.endWait; E.finishTurn(s); }
        return;
      }
      case "op": { E.ops(s, act.ops || [], p); return; }
      case "activate": { // scripted once-per-turn ability on the field
        const L = E.locate(s, act.i); need(L && L.p === p, "ไม่พบการ์ดของคุณ"); const sc = scriptOf(s, L.x);
        need(E.canAct(s, p) && (s.phase === "main" || (s.phase === "battle" && sc && sc.activate && sc.activate.battle)), "สั่งใช้ตอนนี้ไม่ได้");
        need(sc && sc.activate && sc.activate.can(E, s, L.x, L), "ใช้ความสามารถนี้ไม่ได้ตอนนี้"); need(L.x.used !== s.turn, "ใช้ไปแล้วในเทิร์นนี้");
        L.x.used = s.turn; s.trig.push({ id: newId(), seat: p, i: L.x.i, c: L.x.c, when: "activate" }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)}`); return;
      }
      case "useAbility": {
        const L = E.locate(s, act.i); need(L, "ไม่พบการ์ด");
        E.addTrig(s, p, L.x, "manual"); return;
      }
      case "concede": { E.lose(s, p, `${P.name} ยอมแพ้`); return; }
      case "note": { E.log(s, p, String(act.text || "").slice(0, 200)); return; }
      default: throw new RuleError("คำสั่งไม่รู้จัก");
    }
  },
  resolveAttack(s) {
    const pd = s.pend; const A = s.P[pd.by], D = s.P[1 - pd.by];
    const L = E.locate(s, pd.att);
    if (!L || L.z !== "av") { E.log(s, pd.by, "ผู้โจมตีออกจากสนาม การโจมตีสิ้นสุด"); s.pend = null; return; }
    const att = L.x; const tgt0 = pd.tk === "av" ? (E.locate(s, pd.ti) || {}).x : null;
    const ap = Math.max(0, E.power(s, att) + (pd.bonus || 0) + (tgt0 ? E.battleMod(s, att, tgt0) : 0));
    E.ev(s, { k: "clash", att: att.i, by: pd.by, tk: pd.tk, ti: pd.ti, ap });
    if (pd.tk === "life") {
      if (ap <= 0) E.log(s, pd.by, "POWER 0 โจมตีแต่ไม่ทำความเสียหาย");
      else E.damageLife(s, 1 - pd.by, pd.by);
    } else {
      const T = E.locate(s, pd.ti);
      if (!T || (pd.tk === "av" && T.z !== "av") || (pd.tk === "cs" && T.z !== "cs")) { E.log(s, pd.by, "เป้าหมายหายไป การโจมตีสิ้นสุด"); s.pend = null; return; }
      const tp = Math.max(0, E.power(s, T.x) + (pd.tk === "av" ? E.battleMod(s, T.x, att) : 0));
      if (pd.tk === "cs") {
        if (ap > tp) E.destroy(s, T.x.i, `แพ้พลัง ${ap} ต่อ ${tp}`); else E.log(s, pd.by, `Construct ${E.name(s, T.x)} รับไว้ได้ (${ap} ต่อ ${tp})`);
      } else if (ap === 0 && tp === 0) E.log(s, pd.by, "POWER 0 ปะทะ 0 ไม่มีอะไรเกิดขึ้น");
      else if (ap > tp) { const dead = T.x; E.destroy(s, T.x.i, `แพ้การต่อสู้ ${tp} ต่อ ${ap}`); const sc = scriptOf(s, att); if (sc && sc.win && !E.locate(s, dead.i)?.z?.startsWith("av")) s.trig.push({ id: newId(), seat: pd.by, i: att.i, c: att.c, when: "win", diff: ap - tp }); }
      else if (tp > ap) E.destroy(s, att.i, `แพ้การต่อสู้ ${ap} ต่อ ${tp}`);
      else {
        const ah = E.kw(s, att, "ลูกฮึด"), dh = E.kw(s, T.x, "ลูกฮึด");
        if (ah && !dh) E.destroy(s, T.x.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        else if (dh && !ah) E.destroy(s, att.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        else { E.destroy(s, att.i, `พลังเท่ากัน ${ap}`); E.destroy(s, T.x.i, `พลังเท่ากัน ${tp}`); }
      }
    }
    s.pend = null;
  },
  damageLife(s, d, by) {
    const P = s.P[d];
    if (E.critical(P)) { E.lose(s, d, `${s.P[by].name} โจมตี LIFE ขณะ ${P.name} อยู่ในสถานะสาหัส`); return; }
    const x = P.life.find((y) => !y.up); if (!x) return;
    x.up = true; E.log(s, d, `LIFE ของ ${P.name} ถูกหงาย: ${E.name(s, x)}`); E.ev(s, { k: "life", p: d, i: x.i });
    E.addTrig(s, d, x, "life");
    if (E.critical(P)) E.log(s, d, `${P.name} เข้าสู่สถานะสาหัส`);
  },
  // effect operations (from Claude or manual tools)
  ops(s, list, by) {
    for (const o of list.slice(0, 30)) {
      try { E.op(s, o, by); } catch (e) { E.log(s, by, `ทำผล "${o.op}" ไม่ได้: ${e.message}`); }
      if (s.phase === "over") return;
    }
  },
  op(s, o, by) {
    const seat = o.seat === 0 || o.seat === 1 ? o.seat : by;
    const n = Math.max(0, Math.min(20, o.n | 0 || 1));
    const nm = (i) => { const L = E.locate(s, i); return L ? E.name(s, L.x) : "#" + i; };
    switch (o.op) {
      case "draw": { E.draw(s, seat, n); E.log(s, seat, `${s.P[seat].name} จั่ว ${n} ใบ`); return; }
      case "mill": {
        const P = s.P[seat]; const k = Math.min(n, P.deck.length); const got = P.deck.splice(0, k);
        for (const x of got) { const sc = o.virus && scriptOf(s, x); if (sc && sc.virusExile) P.dark.push(x); else P.hell.push(x); }
        { // cards that react to being milled: millBy "any", or "god" = by a purple {เทพ} Avatar or a Magic card
          const src = s.cards[o.src || s.cur] || null; const byGod = !!src && (src.t === "M" || (["A", "T"].includes(src.t) && String(src.sy || "").includes("เทพ") && src.co === "ม่วง"));
          for (const x of got) { if (!P.hell.includes(x)) continue; const sc = scriptOf(s, x); if (sc && sc.milled && (sc.millBy === "any" || byGod)) s.trig.push({ id: newId(), seat: x.o, i: x.i, c: x.c, when: "milled", optional: true }); } }
        E.log(s, seat, `ธรณีสูบ ${k} ใบ: ${got.map((x) => E.name(s, x)).join(", ")}${o.virus && got.some((x) => (scriptOf(s, x) || {}).virusExile) ? " (ไวรัสที่ถูกธรณีสูบไปมิติมืด)" : ""}`); return;
      }
      case "move": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i);
        const to = o.to;
        if (to === "av") { const P = s.P[o.seat != null ? seat : L.p]; if (!(L.z === "av") && (E.avatars(P) >= 4 || P.av.length >= 6)) throw new RuleError("Avatar Zone เต็ม"); }
        if (to === "cs" && s.P[o.seat != null ? seat : L.p].cs.length >= 3) throw new RuleError("Construct Zone เต็ม");
        const name = E.name(s, L.x);
        const wasAv = L.z === "av"; const had = kwHas(E.def(s, L.x).x, "คำสั่งเสีย");
        E.moveTo(s, o.i, to, o.seat != null ? seat : null);
        E.log(s, by, `${name}: ${ZONE_TH[L.z] || L.z} → ${ZONE_TH[to] || to}`);
        if (wasAv && to === "hell" && had) E.addTrig(s, L.x.o, L.x, "death");
        return;
      }
      case "destroy": { E.destroy(s, o.i, o.why || "จากเอฟเฟกต์"); return; }
      case "exile": { const name = nm(o.i); E.moveTo(s, o.i, "dark"); E.log(s, by, `เนรเทศ ${name}`); return; }
      case "power": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด");
        const v = Math.max(-20, Math.min(20, o.n | 0));
        if (o.temp === false) L.x.pm = (L.x.pm || 0) + v; else if (o.temp === "next") { L.x.tn = L.x.tn || {}; L.x.tn[by] = (L.x.tn[by] || 0) + v; } else L.x.tm = (L.x.tm || 0) + v;
        E.log(s, by, `${E.name(s, L.x)} POWER ${v >= 0 ? "+" : ""}${v}${o.temp === false ? "" : o.temp === "next" ? " จนถึง Draw Phase ถัดไป" : " จนจบเทิร์น"} (ตอนนี้ ${E.power(s, L.x)})`); return;
      }
      case "wake": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.a = o.v !== false; E.log(s, by, `${E.name(s, L.x)} ${L.x.a ? "ตื่น" : "นอน"}`); return; }
      case "keyword": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.kw = [...new Set([...(L.x.kw || []), String(o.k).slice(0, 20)])]; E.log(s, by, `${E.name(s, L.x)} ได้รับ ${o.k}`); return; }
      case "token": {
        const P = s.P[seat]; if (E.avatars(P) >= 4 && P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); if (P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        const key = "tok:" + String(o.name || "Token").slice(0, 30) + ":" + (o.power | 0);
        s.cards[key] = s.cards[key] || { n: String(o.name || "Token").slice(0, 30), t: "T", pw: o.power | 0, sy: o.symbol || "", co: o.color || "", x: "" };
        for (let k = 0; k < n && P.av.length < 6; k++) P.av.push({ i: s.nextI++, c: key, o: seat, a: true, tok: true });
        E.log(s, seat, `เรียก Token ${s.cards[key].n} ×${n}`); return;
      }
      case "lifeFlip": {
        const P = s.P[seat];
        if (o.up === false) { if (E.critical(P) && !o.force) throw new RuleError("สถานะสาหัสคว่ำ LIFE ด้วยความสามารถไม่ได้"); const x = [...P.life].reverse().find((y) => y.up); if (x) { x.up = false; E.log(s, seat, `คว่ำ LIFE ${E.name(s, x)}`); } }
        else { const x = P.life.find((y) => !y.up); if (x) { x.up = true; E.log(s, seat, `หงาย LIFE ${E.name(s, x)} (จากความสามารถ ไม่ทำงาน)`); if (E.critical(P)) E.log(s, seat, `${P.name} เข้าสู่สถานะสาหัส`); } }
        return;
      }
      case "lifeDamage": { E.damageLife(s, seat, 1 - seat); return; }
      case "shuffle": { E.shuffle(s, s.P[seat].deck); E.log(s, seat, "สับ Deck"); return; }
      case "search": {
        const P = s.P[seat]; const q = String(o.name || "");
        const k = o.take != null ? P.deck.findIndex((x) => x.i === o.take) : P.deck.findIndex((x) => (q || o.names || o.symbol || o.type || o.maxCost != null) && matchCard(E.def(s, x), o));
        if (k < 0) { E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา "${q}" ไม่พบ · สับ Deck`); return; }
        const x = P.deck.splice(k, 1)[0]; const to = o.to === "av" ? "av" : "hand";
        if (to === "av") { if (E.avatars(P) >= 4 || P.av.length >= 6) { P.hand.push(x); } else P.av.push(x); } else P.hand.push(x);
        E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา ${E.name(s, x)} จาก Deck → ${ZONE_TH[to]} · สับ Deck`); return;
      }
      case "mute": { // lose all abilities (and optionally base POWER 0) until the end of this / the opponent's turn
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.mute = true; if (o.zero) L.x.zero = true;
        L.x.muteEnd = o.until === "oppturn" ? (s.active === by ? s.turn + 1 : s.turn) : s.turn;
        E.log(s, by, `${E.name(s, L.x)} สูญเสียความสามารถทั้งหมด${o.zero ? " และ POWER ตั้งต้นเป็น 0" : ""}`); return;
      }
      case "travel": { // นักท่องเรื่องราว: exile the traveller, put the shown "เรื่องราว" from hand onto the field
        const T = E.locate(s, o.from), H = E.locate(s, o.to); if (!T || !H || H.z !== "hand") throw new RuleError("แปลงร่างไม่ได้");
        const P = s.P[H.p]; if (E.avatars(P) - 1 >= 4) throw new RuleError("Avatar Zone เต็ม");
        E.moveTo(s, o.from, "dark"); E.log(s, by, `${E.name(s, T.x)} ถูกเนรเทศ แปลงร่าง`);
        P.hand.splice(P.hand.indexOf(H.x), 1); H.x.a = true; H.x.story = true; if (o.bonus) H.x.pm = (H.x.pm || 0) + o.bonus; P.av.push(H.x);
        E.ev(s, { k: "summon", i: H.x.i, p: H.p }); E.log(s, by, `อัญเชิญ ${E.name(s, H.x)} ด้วยความสามารถของนักท่องเรื่องราว${o.bonus ? ` (POWER +${o.bonus})` : ""}`);
        const sc = scriptOf(s, H.x); if (sc && sc.summon) s.trig.push({ id: newId(), seat: H.p, i: H.x.i, c: H.x.c, when: "summon" });
        return;
      }
      case "put": { // summon a card from any zone with an ability; jt = "อัญเชิญ จุติ" (its จุติ fires), exd = gains "คำสั่งเสีย : เนรเทศ"
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i); if (L.z === "av") return;
        const P = s.P[L.x.o]; if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        if (E.def(s, L.x).t !== "A") throw new RuleError("อัญเชิญได้เฉพาะ Avatar");
        const from = ZONE_TH[L.z] || L.z; const x = E.moveTo(s, o.i, "av", L.x.o); if (o.exd) x.exd = true;
        E.ev(s, { k: "summon", i: x.i, p: x.o }); E.log(s, by, `อัญเชิญ ${E.name(s, x)} จาก${from}${o.jt ? " แบบจุติ" : ""}${o.exd ? " (ได้รับคำสั่งเสีย : เนรเทศ)" : ""}`);
        if (o.jt) { const sc = scriptOf(s, x); if (sc && sc.summon) { if (!sc.storyOnly || x.story) E.addTrig(s, x.o, x, "summon"); } else if (kwHas(E.def(s, x).x, "จุติ")) E.addTrig(s, x.o, x, "summon"); }
        return;
      }
      case "toLand": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); const name = E.name(s, L.x); E.moveTo(s, o.i, "land"); E.log(s, by, `ใช้ ${name} บน Land Magic Zone`); return; }
      case "mu": { s.mu[seat][o.k] = true; return; }
      case "millKill": { // ซีเกิร์ด: mill n, then destroy enemy Avatars with total Cost ≤ base + (named cards milled)
        const P = s.P[seat]; const top = P.deck.slice(0, Math.min(n, P.deck.length)); E.op(s, { op: "mill", seat, n, src: o.src }, by);
        const k = top.filter((x) => String(E.def(s, x).n || "").includes(o.name || "")).length; let budget = (o.base | 0) + k;
        const cands = s.P[1 - seat].av.filter((x) => !x.tok && !E.untargetable(s, x)).sort((a, b) => E.power(s, b) - E.power(s, a));
        const kill = []; for (const x of cands) { const c = E.def(s, x).c || 0; if (c <= budget) { kill.push(x); budget -= c; } }
        E.log(s, by, `ธรณีสูบเจอ ${o.name} ${k} ใบ · ทำลายได้ Cost รวมไม่เกิน ${(o.base | 0) + k}`); for (const x of kill) E.destroy(s, x.i, "ความสามารถของซีเกิร์ด"); return;
      }
      case "flag": { const L = E.locate(s, o.i); if (L && ["canAtk"].includes(o.k)) L.x[o.k] = o.v; return; }
      case "cancelAttack": { if (s.pend) { E.log(s, by, "ยกเลิกการโจมตี"); s.pend = null; } return; }
      case "zero": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.zero = true; L.x.muteEnd = s.turn; E.log(s, by, `${E.name(s, L.x)} POWER ตั้งต้นเป็น 0 จนจบเทิร์น`); return; }
      case "attach": { // put a card onto an Avatar as an equipped card (e.g. โอตะ on a ไอดอล)
        const L = E.locate(s, o.i), H = E.locate(s, o.on); if (!L || !H || H.z !== "av") throw new RuleError("สวมใส่ไม่ได้");
        if (L.z === "land") s.land = null; else s.P[L.p][L.z].splice(L.idx, 1); L.x.on = o.on; L.x.a = true; s.P[H.p].mg.push(L.x);
        E.log(s, by, `${E.name(s, L.x)} สวมใส่ให้ ${E.name(s, H.x)}`); return;
      }
      case "negate": { const k = s.trig.findIndex((t) => t.i === o.i); if (k >= 0) s.trig.splice(k, 1); const L = E.locate(s, o.i); if (L && (L.z === "mg" || L.z === "land")) E.moveTo(s, o.i, "hell"); E.log(s, by, "ยกเลิกผลของการ์ดนั้น"); return; }
      case "later": { (s.later = s.later || []).push({ seat, ops: (o.ops || []).slice(0, 10), why: o.why }); E.log(s, seat, "รอทำงานใน Main Phase ถัดไป"); return; }
      case "guard": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.guard = true; E.log(s, by, `${E.name(s, L.x)} ได้รับการป้องกันการถูกทำลาย 1 ครั้ง`); return; }
      case "scout": { // look at the top n, take the chosen (or first matching) card, the rest go to the bottom
        const P = s.P[seat]; const top = P.deck.splice(0, Math.min(n, P.deck.length)); const k = o.take != null ? top.findIndex((x) => x.i === o.take) : o.none ? -1 : top.findIndex((x) => matchCard(E.def(s, x), o));
        let got = null; if (k >= 0) got = top.splice(k, 1)[0];
        P.deck.push(...top);
        if (got) { if (o.to === "av" && E.avatars(P) < 4 && P.av.length < 6 && E.def(s, got).t === "A") { P.av.push(got); E.ev(s, { k: "summon", i: got.i, p: seat }); } else P.hand.push(got); }
        E.log(s, seat, `สอดแนม ${top.length + (got ? 1 : 0)} ใบ${got ? ` · นำ ${E.name(s, got)} ${o.to === "av" ? "ลงสนาม" : "ขึ้นมือ"}` : " · ไม่พบการ์ดที่ตรงเงื่อนไข"} · ที่เหลือไว้ใต้ Deck`); return;
      }
      case "fromHell": {
        const P = s.P[seat]; const k = o.take != null ? [...P.hell].reverse().findIndex((x) => x.i === o.take) : [...P.hell].reverse().findIndex((x) => matchCard(E.def(s, x), o)); if (k < 0) { E.log(s, seat, "ไม่พบการ์ดที่ตรงเงื่อนไขในนรก"); return; }
        const x = P.hell.splice(P.hell.length - 1 - k, 1)[0];
        if (o.to === "av" && E.avatars(P) < 4 && P.av.length < 6 && E.def(s, x).t === "A") { x.a = true; P.av.push(x); E.ev(s, { k: "summon", i: x.i, p: seat }); }
        else if (o.to === "deck") { P.deck.push(x); E.shuffle(s, P.deck); } else P.hand.push(x);
        E.log(s, seat, `นำ ${E.name(s, x)} จากนรก${o.to === "av" ? "ลงสนาม" : o.to === "deck" ? "กลับเข้า Deck" : "ขึ้นมือ"}`); return;
      }
      case "discard": { // chosen discard (used for "ทิ้งการ์ดบนมือ N ใบ" costs)
        const P = s.P[seat]; for (const i of o.iids || []) { const k = P.hand.findIndex((x) => x.i === i); if (k >= 0) { const x = P.hand.splice(k, 1)[0]; P.hell.push(x); E.log(s, seat, `ทิ้ง ${E.name(s, x)} ลงนรก`); } } return;
      }
      case "discardRandom": { const P = s.P[seat]; for (let k = 0; k < n && P.hand.length; k++) { const j = Math.floor(E.rnd(s) * P.hand.length); const x = P.hand.splice(j, 1)[0]; P.hell.push(x); E.log(s, seat, `ทิ้งแบบสุ่ม ${E.name(s, x)}`); } return; }
      case "control": { const L = E.locate(s, o.i); if (!L || L.z !== "av") throw new RuleError("ควบคุมได้เฉพาะ Avatar บนสนาม"); const t = o.seat === 0 || o.seat === 1 ? o.seat : 1 - L.p; const P = s.P[t]; if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); s.P[L.p].av.splice(L.idx, 1); if (o.until === "turn") L.x.back = L.p; if (o.asleep) L.x.a = false; P.av.push(L.x); E.log(s, by, `${s.P[t].name} ได้ควบคุม ${E.name(s, L.x)}${o.until === "turn" ? " จนจบเทิร์น" : ""}`); return; }
      case "note": { E.log(s, by, String(o.text || "").slice(0, 200)); return; }
      case "win": { E.lose(s, 1 - seat, String(o.text || "เงื่อนไขชนะพิเศษจากการ์ด")); return; }
      default: throw new RuleError("ไม่รู้จักผล " + o.op);
    }
  },
};
// card filter used by search/scout/fromHell: {name, symbol, type: "A"|"M"|"C", color, maxCost}
export function matchCard(d, o) {
  if (o.name && !String(d.n || "").includes(o.name)) return false;
  if (o.names && !o.names.some((n) => String(d.n || "").includes(n))) return false;
  if (o.symbol && !String(d.sy || "").includes(o.symbol)) return false;
  if (o.type && d.t !== o.type) return false;
  if (o.color && d.co !== o.color) return false;
  if (o.maxCost != null && (d.c || 0) > o.maxCost) return false;
  return true;
}
// POWER bonus a Modification gives the Avatar wearing it ("Avatar ที่สวมใส่การ์ดใบนี้ POWER +N")
const mbCache = new Map();
export function modBonus(t) {
  if (!t) return 0; if (mbCache.has(t)) return mbCache.get(t);
  let v = 0; const line = t.split(/\n/).find((l) => /สวมใส่การ์ดใบนี้/.test(l) && /POWER\s*\+\s*\d+/.test(l));
  if (line) { const head = line.slice(0, line.search(/POWER\s*\+/)); if (!/ถ้า|หาก|เมื่อ|ในช่วง|ใน Battle/.test(head)) { const m = line.match(/POWER\s*\+\s*(\d+)/); v = +m[1]; } }
  mbCache.set(t, v); return v;
}
export function act(s, a, p) { const n = clone(s); E.apply(n, a, p); return n; }

// legal moves for AI/coach
export function legalMoves(s, p) {
  const P = s.P[p], O = s.P[1 - p]; const out = [];
  if (s.phase === "over") return out;
  if (s.trig.length || (s.pend && s.pend.by === p)) return out;
  if (s.pend && s.pend.by === 1 - p) {
    out.push({ d: "ไม่ใช้โล่มนุษย์ ปล่อยให้โจมตีตามเดิม", a: { type: "respond" } });
    for (const y of P.av) if (E.kw(s, y, "โล่มนุษย์") && y.i !== s.pend.ti) out.push({ d: `ใช้โล่มนุษย์ ${E.name(s, y)} (POWER ${E.power(s, y)}) รับแทน`, a: { type: "respond", shield: y.i } });
    return out;
  }
  if (s.phase === "mull") return out;
  if (s.active !== p) return out;
  if (s.phase === "end" && s.need) return out;
  if (s.phase === "main") {
    const seen = new Set();
    for (const x of P.hand) {
      const d = E.def(s, x); if (seen.has(x.c)) continue; seen.add(x.c);
      if (d.t === "A" && E.avatars(P) < 4 && P.av.length < 6 && !E.locked(s, p, x) && !(scriptOf(s, x) || {}).noHand) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `อัญเชิญ ${d.n} (Cost ${E.costOf(s, p, x)}, POWER ${d.pw || 0}) จ่ายด้วย ${pay.map((i) => E.name(s, P.hand.find((y) => y.i === i))).join(", ") || "ไม่ต้องจ่าย"}`, a: { type: "summon", i: x.i, pay } }); }
      if (d.t === "C" && P.cs.length < 3 && !P.cs.some((y) => E.name(s, y) === d.n)) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `ก่อสร้าง ${d.n} (Cost ${d.c || 0})`, a: { type: "build", i: x.i, pay } }); }
      if (d.t === "A" && scriptOf(s, x) && scriptOf(s, x).handCall && E.avatars(P) < 4 && P.av.length < 6) {
        for (const y of P.hand) { const yd = E.def(s, y); if (y.i === x.i || yd.t !== "A" || !String(yd.sy || "").includes("มังกร")) continue;
          const pay = E.autoPay(s, p, y.i, Math.max(0, E.costOf(s, p, y) - 6), [x.i]); if (pay) out.push({ d: `ทิ้ง ${d.n} เพื่ออัญเชิญ ${yd.n} แบบจุติ (Cost -6)`, a: { type: "summon", i: y.i, pay, via: x.i } }); }
      }
      if (d.t === "M" && !s.mu[p][d.st] && d.st !== "R" && !(scriptOf(s, x) && scriptOf(s, x).canCast && !scriptOf(s, x).canCast(E, s, p))) {
        if (d.st === "D") { const so = scriptOf(s, x); for (const y of P.av.filter((h) => !(so && so.modOnly && !so.modOnly(E, s, h))).slice(0, 4)) out.push({ d: `สวมใส่ ${d.n} ให้ ${E.name(s, y)}`, a: { type: "cast", i: x.i, on: y.i } }); }
        else out.push({ d: `ใช้ ${SUB_TH[d.st]} Magic ${d.n}`, a: { type: "cast", i: x.i } });
      }
    }
    for (const x of [...P.av, ...P.cs, ...P.mg, ...P.dark, ...P.hell, ...(s.land && s.land.o === p ? [s.land] : [])]) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.activate && x.used !== s.turn && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    out.push({ d: s.turn === 1 ? "จบเทิร์น (เทิร์นแรกไม่มี Battle)" : "ไป Battle Phase", a: { type: "battle" } });
  } else if (s.phase === "battle") {
    for (const x of P.av.filter((y) => y.a && !((scriptOf(s, y) || {}).noAttack && scriptOf(s, y).noAttack(E, s, y)))) {
      const ap = E.power(s, x); const n = E.name(s, x);
      for (const y of O.av.filter((z) => !E.untargetable(s, z))) out.push({ d: `${n} (P${ap}) โจมตี ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "av", ti: y.i } });
      for (const y of O.cs) out.push({ d: `${n} (P${ap}) โจมตี Construct ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "cs", ti: y.i } });
      if (!O.av.length || E.kw(s, x, "เตะไข่")) out.push({ d: `${n} (P${ap}) โจมตี LIFE`, a: { type: "attack", i: x.i, tk: "life" } });
    }
    for (const x of P.av) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.activate && sc.activate.battle && x.used !== s.turn && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    out.push({ d: "จบเทิร์น", a: { type: "end" } });
  }
  return out;
}
