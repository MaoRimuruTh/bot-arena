// Free effect reader: turns common card-text patterns into engine ops without any AI.
// It is deliberately conservative — anything conditional or unusual returns null so the
// player (or Ciel, with an API key) handles it instead of guessing wrong.
import { E, scriptOf } from "./engine.js?v=20261110172114";

const BAIL = /POWER\s*[+\-−–]?\s*\d+\s*ต่อ|Text Box|ยกเว้น|ไม่ได้ชื่อ|ที่ไม่ใช่|ที่สุด|กี่ใบ|ก่อสร้าง|สวม|ต่อจำนวน|ตามจำนวน|เท่ากับจำนวน|\d\)|ลูกเต๋า|สูงสุด|ถ้า|หาก|เลือกปฏิบัติ|แทน|ตราบ|เมื่อ|ทุกครั้ง|ไม่สามารถ|ได้รับ|เปลี่ยนชื่อ|สวมใส่|ควบคุม|Token|โทเคน|เทิร์นถัดไป|ครั้งถัดไป|เลือก\s*1\s*อย่าง|ทั้งหมดบนมือ|เปิดเผย|แสดง/;
// the trigger keyword must start an ability ("จุติ :" / "จุติ (…) :" / "จุติ ทิ้งการ์ด… :"), not appear inside one ("อัญเชิญ จุติ Avatar")
const KEYS = { summon: /(?<!อัญเชิญ\s*|แบบ\s*|ทำการ\s*)จุติ(?=\s*(?:\(|:|ทิ้ง|เลือก|เซ่นไหว้))/, death: /(?<!ได้รับ\s*["“]?\s*)คำสั่งเสีย(?=\s*(?:\(|:))/, life: /ถูกหงายจากการโจมตี/, attack: /เมื่อ\s*Avatar\s*(?:ใบนี้|ตัวนี้)\s*โจมตี/,
  end: /อัตโนมัติ\s*ใน(?:ช่วง|ทุกๆ)?\s*End Phase(?:\s*(?:ของ)?\s*เรา)?/, mainStart: /อัตโนมัติ\s*(?:เมื่อ|ใน)?(?:ช่วง)?\s*เริ่ม(?:ต้น)?\s*Main Phase\s*(?:ของ)?\s*เรา/ };
const VERBS = [/จั่วการ์ด/, /ธรณีสูบ/, /ทำลาย/, /POWER\s*[+\-−–]/, /สภาพนอน/, /สภาพตื่น/];

// pull "head : body" for the ability that this trigger fires
function clause(text, when) {
  const t = String(text || "").replace(/\r/g, "");
  let rest;
  if (when === "cast") rest = t;
  else {
    const key = KEYS[when]; if (!key) return null;
    const i = t.search(key);
    if (i < 0) { if (when === "life") rest = t; else return null; } // LIFE cards often skip the "ถูกหงาย…" wording
    else rest = t.slice(i).replace(key, "");
  }
  rest = rest.split(/\n\s*\n|\n(?=\s*(?:เทิร์นละครั้ง|เทิรน์ละครั้ง|ต่อเนื่อง|อัตโนมัติ|สั่งใช้|คำสั่งเสีย|จุติ|\[|#))/)[0];
  rest = rest.split(/\s(?=ต่อเนื่อง|เทิร์นละครั้ง|เทิรน์ละครั้ง|อัตโนมัติ|คำสั่งเสีย\s*[(:]|จุติ\s*[(:]|\[Link|#)/)[0];
  rest = rest.replace(/^\s*\([^)]*\)/, "").replace(/\((?:ส่ง|แสดง|เมื่อ)[^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^:\s*/, "");
  const k = rest.indexOf(":");
  return k >= 0 ? { head: rest.slice(0, k).trim(), body: rest.slice(k + 1).trim() } : { head: "", body: rest };
}
function filterOf(t) {
  const f = {};
  const sy = t.match(/\{\s*[Ss]ymbol\s+([^}]+?)\s*\}/); if (sy) f.symbol = sy[1].trim();
  const names = [...t.matchAll(/["“]([^"”]{1,30})["”]/g)].map((m) => m[1].trim());
  if (names.length > 1) f.names = names; else if (names.length) f.name = names[0];
  if (/Avatar/.test(t)) f.type = "A"; else if (/Magic|\{magic\}/i.test(t)) f.type = "M"; else if (/Construct/.test(t)) f.type = "C";
  const mc = t.match(/Cost\s*(?:ไม่เกิน|น้อยกว่าหรือเท่ากับ)\s*(\d+)/) || t.match(/Cost\s*(\d+)\s*หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/); if (mc) { f.maxCost = +mc[1]; t = t.replace(/หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/, ""); }
  const pc = t.match(/POWER\s*(\d+)\s*หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/); if (pc) { f.maxPower = +pc[1]; t = t.replace(/หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/, ""); }
  const lc = t.match(/Cost\s*(?:น้อยกว่า|ต่ำกว่า)\s*(\d+)/); if (lc) f.maxCost = +lc[1] - 1;
  const mp = t.match(/POWER\s*(?:ไม่เกิน)\s*(\d+)/); if (mp) f.maxPower = +mp[1];
  const lp = t.match(/POWER\s*(?:น้อยกว่า|ต่ำกว่า)\s*(\d+)/); if (lp) f.maxPower = +lp[1] - 1;
  const co = t.match(/สี(แดง|ฟ้า|เขียว|ม่วง)/); if (co) f.color = co[1];
  if (/หรือ/.test(t) && !(names.length > 1 && !f.symbol)) f.bad = true; // "A or B" mixes we can't express
  return f;
}
const seatOf = (t, p) => (/ผู้เล่นทุกคน|ทั้งสองฝ่าย|ทุกฝ่าย/.test(t) ? [p, 1 - p] : /ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) ? [1 - p] : [p]);
const num = (t, re, d = 1) => { const m = t.match(re); return m ? +m[1] : d; };
const val = (s, x) => E.power(s, x) + (E.def(s, x).c || 0) * 0.5 + (E.def(s, x).o1 ? 6 : 0);
function fits(s, x, f) {
  const d = E.def(s, x);
  if (f.symbol && !String(d.sy || "").includes(f.symbol)) return false;
  if (f.name && !String(d.n || "").includes(f.name)) return false;
  if (f.names && !f.names.some((n) => String(d.n || "").includes(n))) return false;
  if (f.maxCost != null && (d.c || 0) > f.maxCost) return false;
  if (f.maxPower != null && E.power(s, x) > f.maxPower) return false;
  if (f.color && d.co !== f.color) return false;
  return true;
}

// one sentence → ops (or false when it can't be read safely)
function sentence(s, t, p, self, ctx) {
  if (filterOf(t).bad) return false;
  const ops = []; const say = [];
  const verbs = VERBS.filter((v) => v.test(t)).length;
  if (verbs > 1) return false; // several different actions in one clause: too risky to guess
  const O = s.P[1 - p], P = s.P[p];
  const pickN = (t) => { const m = t.replace(/(?:สอดแนม|ธรณีสูบ|Cost|POWER|Gem|GEM)\s*\d+/g, "").match(/(\d+)\s*ใบ/); return m ? +m[1] : 1; };
  const named = (f) => f.name || f.names || f.symbol;
  if (/ทำลาย/.test(t)) {
    if (!/ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) || /นรก|Deck/.test(t)) return false;
    const f = filterOf(t); if (/Cost|POWER/.test(t) && f.maxCost == null && f.maxPower == null) return false;
    const all = /ทุกใบ/.test(t); const n = all ? 99 : pickN(t);
    const cands = (/Construct/.test(t) ? O.cs : O.av).filter((x) => fits(s, x, f) && !E.untargetable(s, x)).sort((a, b) => val(s, b) - val(s, a));
    const pool = all ? cands : ctx.choose(cands, n, `เลือกการ์ดฝ่ายตรงข้ามที่จะทำลาย (${n} ใบ)`);
    for (const x of pool) ops.push({ op: "destroy", i: x.i, why: "จากเอฟเฟกต์" });
    say.push(pool.length ? `ทำลาย ${pool.map((x) => E.name(s, x)).join(", ")}` : "ไม่มีเป้าหมายให้ทำลาย");
  } else if (/สอดแนม\s*(\d+)/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const n = num(t, /สอดแนม\s*(\d+)/); const f = filterOf(t.replace(/สอดแนม\s*\d+\s*ใบ/, ""));
    if (!named(f) || pickN(t.replace(/สอดแนม\s*\d+\s*ใบ/, "")) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    const to = /อัญเชิญ|ลงบน\s*Avatar Zone/.test(t) ? "av" : "hand";
    if (ctx.deferred) { ops.push({ op: "scout", seat: p, n, ...f, to }); say.push(`สอดแนม ${n} ใบ หาการ์ดที่ตรงเงื่อนไข`); }
    else { const top = P.deck.slice(0, n); const cands = top.filter((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type));
      const got = ctx.choose(cands, 1, `สอดแนม ${n} ใบ: เลือกการ์ดที่จะ${to === "av" ? "อัญเชิญ" : "นำขึ้นมือ"}`, { optional: /สามารถ/.test(t), reveal: top.map((x) => x.i) })[0];
      ops.push({ op: "scout", seat: p, n, to, ...(got ? { take: got.i } : { none: true }) }); say.push(got ? `สอดแนม ${n} ใบ ได้ ${E.name(s, got)}` : `สอดแนม ${n} ใบ ไม่ได้การ์ดที่ตรงเงื่อนไข`); }
  } else if (/สอดแนม/.test(t)) { if (/นำ|เลือก|อัญเชิญ|ขึ้นมือ/.test(t) || !/เรียง|ตามใจ/.test(t)) return false; say.push("สอดแนม (ดูการ์ดบนสุดของ Deck แล้วเรียงตามเดิม)"); }
  else if (/จั่วการ์ด/.test(t)) {
    const n = num(t, /จั่วการ์ด\s*(?:จาก\s*Deck\s*(?:เรา\s*)?)?(\d+)/); for (const q of seatOf(t.split("จั่ว")[0], p)) ops.push({ op: "draw", seat: q, n });
    say.push(`${seatOf(t.split("จั่ว")[0], p).length > 1 ? "ทุกคน" : seatOf(t.split("จั่ว")[0], p)[0] === p ? "" : "ฝ่ายตรงข้าม"}จั่ว ${n} ใบ`);
  } else if (/ธรณีสูบ/.test(t)) {
    const n = num(t, /ธรณีสูบ\s*(?:\([^)]*\)\s*)?(\d+)/); for (const q of seatOf(t.split("ธรณีสูบ")[0], p)) ops.push({ op: "mill", seat: q, n }); say.push(`ธรณีสูบ ${n} ใบ`);
  } else if (/จาก(?:ใน)?\s*นรก/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone|Deck/.test(t)) {
    const f = filterOf(t); if (!named(f) || pickN(t) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    const to = /อัญเชิญ|Avatar Zone/.test(t) ? "av" : /ขึ้นมือ/.test(t) ? "hand" : "deck";
    const cands = [...P.hell].reverse().filter((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type)).sort((a, b) => val(s, b) - val(s, a));
    const got = ctx.deferred ? null : ctx.choose(cands, 1, "เลือกการ์ดจากนรก", { optional: /สามารถ/.test(t) })[0];
    if (!ctx.deferred && !got) { say.push("ไม่มีการ์ดในนรกที่ตรงเงื่อนไข"); } else { ops.push({ op: "fromHell", seat: p, ...f, to, ...(got ? { take: got.i } : {}) }); say.push(got ? `นำ ${E.name(s, got)} จากนรก` : "นำการ์ดจากนรก"); }
  } else if (/จาก(?:ใน)?\s*Deck/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const f = filterOf(t.replace(/จาก(?:ใน)?\s*Deck[^ ]*/, "")); if (!named(f) || pickN(t) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    const to = /อัญเชิญ|Avatar Zone/.test(t) ? "av" : "hand";
    const seenN = new Set(); const cands = ctx.deferred ? [] : P.deck.filter((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type)).filter((x) => { const k = E.def(s, x).n; if (seenN.has(k)) return false; seenN.add(k); return true; }).sort((a, b) => val(s, b) - val(s, a));
    const got = ctx.deferred ? null : ctx.choose(cands, 1, "เลือกการ์ดจาก Deck", { optional: /สามารถ/.test(t) })[0];
    ops.push({ op: "search", seat: p, ...f, to, ...(got ? { take: got.i } : {}) }); say.push(got ? `ค้น ${E.name(s, got)} จาก Deck` : `ค้น ${f.name || f.symbol || "การ์ด"} จาก Deck`);
  } else if (/POWER\s*([+\-−–])\s*(\d+)/.test(t)) {
    const m = t.match(/POWER\s*([+\-−–])\s*(\d+)/); const v = (m[1] === "+" ? 1 : -1) * +m[2];
    let temp = /Draw Phase (?:ถัดไป|ต่อไป)/.test(t) ? "next" : /จนจบเทิร์น|จนจบการต่อสู้|เทิร์นนี้/.test(t) || ctx.when === "cast" || ctx.when === "attack" ? true : null;
    if (temp == null && (ctx.when === "end" || ctx.when === "mainStart") && !/จนถึง|จนกว่า/.test(t)) temp = false; // a printed timed boost stays
    if (temp == null) return false; // continuous wording: leave it
    const f = filterOf(t); let tgt;
    if (self && (/ใบนี้|ตัวนี้/.test(t) || (!/เลือก|ฝ่าย|ทุกใบ|Avatar|\{/.test(t.split("POWER")[0]) && v > 0))) tgt = [self];
    else {
      const opp = /ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) || (v < 0 && !/ฝ่ายเรา|ของเรา|Zone\s*เรา/.test(t));
      const cands = (opp ? O.av.filter((x) => !E.untargetable(s, x)) : P.av).filter((x) => fits(s, x, f)).sort(opp ? (a, b) => (v < 0 ? val(s, b) - val(s, a) : val(s, a) - val(s, b)) : (a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a));
      tgt = /ทุกใบ/.test(t) ? cands : ctx.choose(cands, 1, `เลือก Avatar ${opp ? "ฝ่ายตรงข้าม" : "ฝ่ายเรา"} ที่จะ POWER ${v > 0 ? "+" : ""}${v}`);
    }
    if (!tgt.length) { say.push("ไม่มีเป้าหมาย POWER"); }
    for (const x of tgt) ops.push({ op: "power", i: x.i, n: v, temp });
    if (tgt.length) say.push(`${tgt.map((x) => E.name(s, x)).join(", ")} POWER ${v > 0 ? "+" : ""}${v}`);
  } else if (/สภาพนอน/.test(t)) {
    if (!/ฝ่ายตรงข้าม|อีกฝ่าย/.test(t)) return false;
    const f = filterOf(t); const cands = O.av.filter((x) => x.a && fits(s, x, f) && !E.untargetable(s, x)).sort((a, b) => E.power(s, b) - E.power(s, a));
    const tgt = /ทุกใบ/.test(t) ? cands : ctx.choose(cands, num(t, /(\d+)\s*ใบ/), "เลือก Avatar ฝ่ายตรงข้ามที่จะทำให้นอน");
    for (const x of tgt) ops.push({ op: "wake", i: x.i, v: false }); say.push(tgt.length ? `ทำให้ ${tgt.map((x) => E.name(s, x)).join(", ")} นอน` : "ไม่มีเป้าหมายให้นอน");
  } else if (/สภาพตื่น/.test(t)) {
    const tgt = /ใบนี้|ตัวนี้/.test(t) && self ? [self] : P.av.filter((x) => !x.a).slice(0, 1);
    for (const x of tgt) ops.push({ op: "wake", i: x.i, v: true }); say.push("ปลุก Avatar");
  } else if (/(?:กลับ)?ขึ้นมือ/.test(t) && /ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) && /Avatar/.test(t)) {
    const f = filterOf(t); const x = ctx.choose(O.av.filter((y) => !y.tok && fits(s, y, f) && !E.untargetable(s, y)).sort((a, b) => val(s, b) - val(s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะส่งกลับขึ้นมือ")[0];
    if (x) { ops.push({ op: "move", i: x.i, to: "hand" }); say.push(`ส่ง ${E.name(s, x)} กลับขึ้นมือ`); } else say.push("ไม่มีเป้าหมาย");
  } else if (/สับ\s*Deck|เรียง|ใต้\s*Deck|ไว้ที่เดิม/.test(t) || t.replace(/[\s.,]/g, "").length < 6) {
    // housekeeping words already covered by the ops above
  } else return false;
  return { ops, say };
}

// main entry: trig = {i, c, when, seat, exact}; returns {explain, ops} or null when unreadable
export function autoEffect(s, trig, ctx = makeCtx(s, trig)) {
  const d = s.cards[trig.c]; if (!d || !d.x) return null;
  const when = trig.when === "cast" && d.st === "D" ? "mod" : trig.when;
  if (when === "mod" || when === "build" || when === "manual") return null;
  const cl = clause(d.x, when); if (!cl) return null;
  let { head, body } = cl; const p = trig.seat; const L = E.locate(s, trig.i); const self = L && L.z === "av" ? L.x : null;
  const ops = [], say = [];
  // costs / conditions written before ":"
  if (/พอดี/.test(head) && !trig.exact) return { explain: "ไม่ได้จ่าย GEM พอดีกับ Cost ความสามารถไม่ทำงาน", ops: [] };
  head = head.replace(/พอดี/g, "").trim();
  if (head) {
    const disc = head.match(/^ทิ้งการ์ด(?:บน|จาก)?มือ\s*(\d+)\s*ใบ$/);
    if (disc) {
      const P = s.P[p]; const n = +disc[1]; if (P.hand.length < n) return { explain: "การ์ดบนมือไม่พอจ่ายค่าความสามารถ", ops: [] };
      const pick = ctx.choose([...P.hand].filter((x) => x.i !== trig.i).sort((a, b) => cardVal(s, a) - cardVal(s, b)), n, `ทิ้งการ์ดบนมือ ${n} ใบเป็นค่าใช้จ่าย`, { exact: true }).map((x) => x.i);
      ops.push({ op: "discard", seat: p, iids: pick }); say.push(`ทิ้งการ์ดบนมือ ${n} ใบเป็นค่าใช้จ่าย`);
    } else if (/^เลือก\s*Avatar/.test(head) && !BAIL.test(head) && !/นรก|Deck|มือ/.test(head) && (/ฝ่ายตรงข้าม|อีกฝ่าย/.test(head) || /POWER\s*[+\-−–]/.test(body))) body = head + " " + body; // a target choice, not a cost
    else if (!/^(?:สามารถใช้(?:การ์ดใบนี้)?ได้เมื่อ|ใช้ได้เมื่อ)/.test(head) || /เลือกปฏิบัติ|\d\)/.test(head)) return null;
  }
  const later = /^ใน\s*main\s*phase\s*ถัดไป\s*/i.test(body); body = body.replace(/^ใน\s*main\s*phase\s*ถัดไป\s*/i, "");
  if (later) ctx.deferred = true;
  if (BAIL.test(body)) return null;
  const parts = body.split(/\s*(?:จากนั้น|หลังจากนั้น|แล้ว(?=\s*(?:จั่ว|สับ|นำ))|\s\/\s|และ(?=\s*(?:จั่ว|ทำลาย|ธรณีสูบ|สับ))|\s(?=เลือก\s*Avatar))\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  ctx.when = when;
  for (const t of parts) { const r = sentence(s, t, p, self, ctx); if (!r) return null; ops.push(...r.ops); say.push(...r.say); }
  if (later) return { explain: "อ่านอัตโนมัติ: ใน Main Phase ถัดไป " + say.join(" · "), ops: [{ op: "later", seat: p, ops, why: `${d.n}: ${say.join(" · ")}` }] };
  if (!ops.length && !say.length) return null;
  return { explain: "อ่านอัตโนมัติ: " + say.join(" · "), ops };
}
function cardVal(s, x) { const d = E.def(s, x); return d.t === "A" ? (d.pw || 0) + (d.c || 0) * 0.5 + (d.o1 ? 10 : 0) : d.t === "C" ? 3 : 2; }

// coverage helper for the lab: how many cards' triggered texts can be read
export function readable(c, when) { const s = { cards: { x: { n: c.n, x: c.x, st: c.st, t: c.t } }, P: [{ av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }, { av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }], land: null }; return !!autoEffect(s, { c: "x", i: -1, when, seat: 0, exact: true }); }

// --- choices -------------------------------------------------------------------------
// ctx.choose(cands, n, prompt, opts) returns the chosen cards. Bots (interactive=false) take
// the first n (callers sort best-first). Players get asked: we throw {ask}, the UI shows a
// picker, then calls again with picks[] filled in. Effects are pure, so re-running is safe.
export function makeCtx(s, t, picks = [], interactive = false) {
  let k = 0;
  const ctx = { s, E, seat: t.seat, t, self: null, picks, interactive, deferred: false,
    choose(cands, n, prompt, o = {}) {
      const idx = k++; if (!cands.length) return [];
      if (picks[idx] !== undefined) return picks[idx].map((i) => cands.find((x) => x.i === i)).filter(Boolean);
      if (!interactive || (!o.optional && !o.reveal && cands.length <= n)) return cands.slice(0, n);
      throw { ask: { idx, prompt, options: cands.map((x) => x.i), n, optional: !!o.optional, exact: !!o.exact, reveal: o.reveal || null } };
    },
    // pick one of several written options (เลือกปฏิบัติ); bots take `best`
    mode(labels, prompt, best = 0) { const idx = k++; if (picks[idx] !== undefined) return picks[idx][0]; if (!interactive) return best; throw { ask: { idx, prompt, modes: labels, options: [], n: 1 } }; },
  };
  const L = E.locate(s, t.i); ctx.self = L ? L.x : null;
  return ctx;
}
// resolve a trigger: hand-written script first, then the text reader
export function resolveEffect(s, t, picks = [], interactive = false) {
  const ctx = makeCtx(s, t, picks, interactive);
  try {
    const sc = scriptOf(s, { c: t.c });
    const run = sc && (t.when === "activate" ? sc.activate && sc.activate.run : sc[t.when]);
    if (run) return run(ctx);
    return autoEffect(s, t, ctx);
  } catch (e) { if (e && e.ask) return { ask: e.ask }; throw e; }
}
