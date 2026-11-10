// Free effect reader: turns common card-text patterns into engine ops without any AI.
// It is deliberately conservative — anything conditional or unusual returns null so the
// player (or Ciel, with an API key) handles it instead of guessing wrong.
import { E } from "./engine.js";

const BAIL = /POWER\s*[+\-−–]?\s*\d+\s*ต่อ|Text Box|ยกเว้น|ไม่ได้ชื่อ|ที่ไม่ใช่|ที่สุด|กี่ใบ|ก่อสร้าง|สวม|ต่อจำนวน|ตามจำนวน|เท่ากับจำนวน|\d\)|ลูกเต๋า|สูงสุด|ถ้า|หาก|เลือกปฏิบัติ|แทน|ตราบ|เมื่อ|ทุกครั้ง|ไม่สามารถ|ได้รับ|เปลี่ยนชื่อ|สวมใส่|ควบคุม|Token|โทเคน|เทิร์นถัดไป|ครั้งถัดไป|เลือก\s*1\s*อย่าง|ทั้งหมดบนมือ|เปิดเผย|แสดง/;
// the trigger keyword must start an ability ("จุติ :" / "จุติ (…) :" / "จุติ ทิ้งการ์ด… :"), not appear inside one ("อัญเชิญ จุติ Avatar")
const KEYS = { summon: /(?<!อัญเชิญ\s*|แบบ\s*|ทำการ\s*)จุติ(?=\s*(?:\(|:|ทิ้ง|เลือก|เซ่นไหว้))/, death: /(?<!ได้รับ\s*["“]?\s*)คำสั่งเสีย(?=\s*(?:\(|:))/, life: /ถูกหงายจากการโจมตี/, attack: /เมื่อ\s*Avatar\s*(?:ใบนี้|ตัวนี้)\s*โจมตี/ };
const VERBS = [/จั่วการ์ด/, /ธรณีสูบ/, /ทำลาย/, /POWER\s*[+\-−–]/, /สภาพนอน/, /สภาพตื่น/];

// pull "head : body" for the ability that this trigger fires
function clause(text, when) {
  const t = String(text || "").replace(/\r/g, "");
  let rest;
  if (when === "cast") rest = t;
  else {
    const key = KEYS[when]; if (!key) return null;
    const i = t.search(key); if (i < 0) return null;
    rest = t.slice(i).replace(key, "");
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
    const pool = (/Construct/.test(t) ? O.cs : O.av).filter((x) => fits(s, x, f)).sort((a, b) => val(s, b) - val(s, a)).slice(0, n);
    for (const x of pool) ops.push({ op: "destroy", i: x.i, why: "จากเอฟเฟกต์" });
    say.push(pool.length ? `ทำลาย ${pool.map((x) => E.name(s, x)).join(", ")}` : "ไม่มีเป้าหมายให้ทำลาย");
  } else if (/สอดแนม\s*(\d+)/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const n = num(t, /สอดแนม\s*(\d+)/); const f = filterOf(t.replace(/สอดแนม\s*\d+\s*ใบ/, ""));
    if (!named(f) || pickN(t.replace(/สอดแนม\s*\d+\s*ใบ/, "")) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    ops.push({ op: "scout", seat: p, n, ...f, to: /อัญเชิญ|ลงบน\s*Avatar Zone/.test(t) ? "av" : "hand" }); say.push(`สอดแนม ${n} ใบ หาการ์ดที่ตรงเงื่อนไข`);
  } else if (/สอดแนม/.test(t)) { if (/นำ|เลือก|อัญเชิญ|ขึ้นมือ/.test(t) || !/เรียง|ตามใจ/.test(t)) return false; say.push("สอดแนม (ดูการ์ดบนสุดของ Deck แล้วเรียงตามเดิม)"); }
  else if (/จั่วการ์ด/.test(t)) {
    const n = num(t, /จั่วการ์ด\s*(?:จาก\s*Deck\s*(?:เรา\s*)?)?(\d+)/); for (const q of seatOf(t.split("จั่ว")[0], p)) ops.push({ op: "draw", seat: q, n });
    say.push(`${seatOf(t.split("จั่ว")[0], p).length > 1 ? "ทุกคน" : seatOf(t.split("จั่ว")[0], p)[0] === p ? "" : "ฝ่ายตรงข้าม"}จั่ว ${n} ใบ`);
  } else if (/ธรณีสูบ/.test(t)) {
    const n = num(t, /ธรณีสูบ\s*(?:\([^)]*\)\s*)?(\d+)/); for (const q of seatOf(t.split("ธรณีสูบ")[0], p)) ops.push({ op: "mill", seat: q, n }); say.push(`ธรณีสูบ ${n} ใบ`);
  } else if (/จาก(?:ใน)?\s*นรก/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone|Deck/.test(t)) {
    const f = filterOf(t); if (!named(f) || pickN(t) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    ops.push({ op: "fromHell", seat: p, ...f, to: /อัญเชิญ|Avatar Zone/.test(t) ? "av" : /ขึ้นมือ/.test(t) ? "hand" : "deck" }); say.push("นำการ์ดจากนรก");
  } else if (/จาก(?:ใน)?\s*Deck/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const f = filterOf(t.replace(/จาก(?:ใน)?\s*Deck[^ ]*/, "")); if (!named(f) || pickN(t) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    ops.push({ op: "search", seat: p, ...f, to: /อัญเชิญ|Avatar Zone/.test(t) ? "av" : "hand" }); say.push(`ค้น ${f.name || f.symbol || "การ์ด"} จาก Deck`);
  } else if (/POWER\s*([+\-−–])\s*(\d+)/.test(t)) {
    const m = t.match(/POWER\s*([+\-−–])\s*(\d+)/); const v = (m[1] === "+" ? 1 : -1) * +m[2];
    const temp = /Draw Phase ถัดไป/.test(t) ? "next" : /จนจบเทิร์น|จนจบการต่อสู้|เทิร์นนี้/.test(t) || ctx.when === "cast" || ctx.when === "attack" ? true : null;
    if (temp == null) return false; // continuous wording: leave it
    const f = filterOf(t); let tgt;
    if (self && (/ใบนี้|ตัวนี้/.test(t) || (!/เลือก|ฝ่าย|ทุกใบ|Avatar|\{/.test(t.split("POWER")[0]) && v > 0))) tgt = [self];
    else if (/ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) || (v < 0 && !/ฝ่ายเรา|ของเรา|Zone\s*เรา/.test(t))) tgt = O.av.filter((x) => fits(s, x, f)).sort((a, b) => (v < 0 ? val(s, b) - val(s, a) : val(s, a) - val(s, b))).slice(0, /ทุกใบ/.test(t) ? 9 : 1);
    else tgt = P.av.filter((x) => fits(s, x, f)).sort((a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a)).slice(0, /ทุกใบ/.test(t) ? 9 : 1);
    if (!tgt.length) { say.push("ไม่มีเป้าหมาย POWER"); }
    for (const x of tgt) ops.push({ op: "power", i: x.i, n: v, temp });
    if (tgt.length) say.push(`${tgt.map((x) => E.name(s, x)).join(", ")} POWER ${v > 0 ? "+" : ""}${v}`);
  } else if (/สภาพนอน/.test(t)) {
    if (!/ฝ่ายตรงข้าม|อีกฝ่าย/.test(t)) return false;
    const f = filterOf(t); const tgt = O.av.filter((x) => x.a && fits(s, x, f)).sort((a, b) => E.power(s, b) - E.power(s, a)).slice(0, /ทุกใบ/.test(t) ? 9 : num(t, /(\d+)\s*ใบ/));
    for (const x of tgt) ops.push({ op: "wake", i: x.i, v: false }); say.push(tgt.length ? `ทำให้ ${tgt.map((x) => E.name(s, x)).join(", ")} นอน` : "ไม่มีเป้าหมายให้นอน");
  } else if (/สภาพตื่น/.test(t)) {
    const tgt = /ใบนี้|ตัวนี้/.test(t) && self ? [self] : P.av.filter((x) => !x.a).slice(0, 1);
    for (const x of tgt) ops.push({ op: "wake", i: x.i, v: true }); say.push("ปลุก Avatar");
  } else if (/(?:กลับ)?ขึ้นมือ/.test(t) && /ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) && /Avatar/.test(t)) {
    const f = filterOf(t); const x = O.av.filter((y) => !y.tok && fits(s, y, f)).sort((a, b) => val(s, b) - val(s, a))[0];
    if (x) { ops.push({ op: "move", i: x.i, to: "hand" }); say.push(`ส่ง ${E.name(s, x)} กลับขึ้นมือ`); } else say.push("ไม่มีเป้าหมาย");
  } else if (/สับ\s*Deck|เรียง|ใต้\s*Deck|ไว้ที่เดิม/.test(t) || t.replace(/[\s.,]/g, "").length < 6) {
    // housekeeping words already covered by the ops above
  } else return false;
  return { ops, say };
}

// main entry: trig = {i, c, when, seat, exact}; returns {explain, ops} or null when unreadable
export function autoEffect(s, trig) {
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
      const pick = [...P.hand].sort((a, b) => cardVal(s, a) - cardVal(s, b)).slice(0, n).map((x) => x.i);
      ops.push({ op: "discard", seat: p, iids: pick }); say.push(`ทิ้งการ์ดบนมือ ${n} ใบเป็นค่าใช้จ่าย`);
    } else if (/^เลือก\s*Avatar/.test(head) && !BAIL.test(head) && !/นรก|Deck|มือ/.test(head) && (/ฝ่ายตรงข้าม|อีกฝ่าย/.test(head) || /POWER\s*[+\-−–]/.test(body))) body = head + " " + body; // a target choice, not a cost
    else if (!/^(?:สามารถใช้(?:การ์ดใบนี้)?ได้เมื่อ|ใช้ได้เมื่อ)/.test(head) || /เลือกปฏิบัติ|\d\)/.test(head)) return null;
  }
  body = body.replace(/^ใน\s*main\s*phase\s*ถัดไป\s*/i, "");
  if (BAIL.test(body)) return null;
  const parts = body.split(/\s*(?:จากนั้น|หลังจากนั้น|แล้ว(?=\s*(?:จั่ว|สับ|นำ))|\s\/\s|และ(?=\s*(?:จั่ว|ทำลาย|ธรณีสูบ|สับ))|\s(?=เลือก\s*Avatar))\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  for (const t of parts) { const r = sentence(s, t, p, self, { when }); if (!r) return null; ops.push(...r.ops); say.push(...r.say); }
  if (!ops.length && !say.length) return null;
  return { explain: "อ่านอัตโนมัติ: " + say.join(" · "), ops };
}
function cardVal(s, x) { const d = E.def(s, x); return d.t === "A" ? (d.pw || 0) + (d.c || 0) * 0.5 + (d.o1 ? 10 : 0) : d.t === "C" ? 3 : 2; }

// coverage helper for the lab: how many cards' triggered texts can be read
export function readable(c, when) { const s = { cards: { x: { n: c.n, x: c.x, st: c.st, t: c.t } }, P: [{ av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }, { av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }], land: null }; return !!autoEffect(s, { c: "x", i: -1, when, seat: 0, exact: true }); }
