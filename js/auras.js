// Free reader for continuous POWER effects ("ต่อเนื่อง ... POWER +N").
// Conservative like effects.js: anything it can't express exactly is ignored (returns no aura).
// readAura(def) -> null or { desc, run(E, s, src, L) -> [{ seat, test(x), n }] }
import { nameText, syText, allSy, colorIs, hasFieldAlias, normName } from "./cards.js?v=20261113005645";
const cache = new Map();

const ON_FIELD = { A: "av", T: "av", C: "cs" };
const KWS = "โล่มนุษย์|ลูกฮึด|สามัคคี|เตะไข่|แทงหลัง";
const BAIL = /Text Box|\[Link\]|แทน|สวมใส่|Token|Modification|Construct\s*"|มิติมืด|Magic Zone|ไม่สามารถ|ได้รับ|ถูกทำลาย|ลด POWER|ต่ำสุด|สูงสุด|เท่ากับ|ทุกๆ|ไม่มี|สภาพนอน|สภาพตื่น|ตั้งต้น|Gem|ลูกเต๋า|เปลี่ยน/;

function filterOf(t) {
  const f = {};
  const sys = [...t.matchAll(/\{\s*[Ss]ymbol\s+([^}]+?)\s*\}/g)].map((m) => m[1].trim()); if (sys.length === 1) f.symbol = sys[0]; else if (sys.length > 1) f.symbols = sys; // "Avatar {Symbol คน} และ Avatar {Symbol ต้นไม้}": either
  const names = [...t.matchAll(/["“]([^"”]{1,40})["”]/g)].map((m) => m[1].trim()).filter(Boolean); if (names.length) f.names = names;
  const co = t.match(/สี(แดง|ฟ้า|เขียว|ม่วง)/); if (co) f.color = co[1];
  const c = t.match(/Cost\s*(\d+)/); if (c) f.cost = +c[1];
  if (/POWER\s*\d/.test(t.replace(/POWER\s*[+\-−–]\s*\d+/g, ""))) f.bad = true;
  return f;
}
const named = (f) => !!(f.symbol || f.symbols || f.names || f.color || f.cost != null || f.text);
function fits(E, s, x, f) {
  let d = E.def(s, x); { const so = E.syNow ? E.syNow(s, x) : null; if (so) { d = { ...d, sy: so }; delete d.al; } } if (!["A", "T"].includes(d.t)) return false; const on = hasFieldAlias(d) && E.onField(s, x);
  if (f.symbol && !allSy(d, on) && !syText(d, on).includes(f.symbol)) return false;
  if (f.symbols && !allSy(d, on) && !f.symbols.some((k) => syText(d, on).includes(k))) return false;
  if (f.names && !f.names.some((n) => nameText(d, on).includes(normName(n)))) return false;
  if (f.color && !colorIs(d, f.color, on)) return false;
  if (f.cost != null && (d.c || 0) !== f.cost) return false;
  if (f.text && !String(d.x || "").includes(f.text)) return false;
  return true;
}
const fitsDef = (d, f, on = false) => !(f.symbol && !allSy(d, on) && !syText(d, on).includes(f.symbol)) && !(f.symbols && !allSy(d, on) && !f.symbols.some((k) => syText(d, on).includes(k))) && !(f.names && !f.names.some((n) => nameText(d, on).includes(normName(n)))) && !(f.color && !colorIs(d, f.color, on)) && !(f.text && !String(d.x || "").includes(f.text));
// one "ต่อเนื่อง" clause → aura spec or null
function parse(seg) {
  let t = seg.replace(/\{red\s*/gi, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^ต่อเนื่อง\s*/, "").replace(/\{red\s*\([^)]*\)\s*\}?|\([^)]*\)/gi, " ");
  // 'Avatar ที่มี "X" อยู่ใน Text Box' and keywords handed out ("ได้รับ โล่มนุษย์ และ สามัคคี") are read first, then removed
  let textHas = null; t = t.replace(/ที่มี\s*["“]([^"”]+)["”]\s*อยู่ใน\s*Text Box/, (m, a) => { textHas = a.trim(); return " "; });
  let kws = null; const km = t.match(new RegExp(`(?:และ\\s*)?(?:จะ)?ได้รับ\\s*(?:ความสามารถ\\s*)?((?:["“]?\\s*(?:${KWS})\\s*["”]?\\s*(?:,|และ)?\\s*)+)`));
  if (km) { kws = km[1].match(new RegExp(KWS, "g")); t = t.replace(km[0], " ").replace(/\s+และ\s*$/, " "); }
  t = t.replace(/(?:จะ)?ได้รับ\s*(?=POWER)/g, " ");
  // counted by what this Avatar wears, or by our Tokens (read before the general checks, which reject those words)
  let em = t.match(/^(?:(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*)?POWER\s*\+\s*(\d+)\s*(?:ตามจำนวน|ต่อจำนวน)\s*(การ์ด|Modification(?:\s*Magic)?)\s*(?:["“]([^"”]+)["”])?\s*ที่(?:สวมใส่|ติด)(?:อยู่)?(?:\s*(?:กับ|ให้)?\s*(?:Avatar|การ์ด)?\s*(?:ใบนี้|ตัวนี้))?\s*$/);
  if (em && !kws) return { when: null, has: null, kind: "count", per: +em[1], count: { worn: true, mod: /Modification/.test(em[2]), name: em[3] ? em[3].trim() : null } };
  em = t.match(/^(?:(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*)?POWER\s*\+\s*(\d+)\s*(?:ตามจำนวน|ต่อจำนวน)\s*Token\s*["“]?([^\s"”]+)["”]?\s*บน\s*Avatar Zone\s*(?:ฝ่าย)?เรา\s*$/);
  if (em && !kws) return { when: null, has: null, kind: "count", per: +em[1], count: { token: em[2] } };
  if (BAIL.test(t)) return null;
  if (!/POWER/.test(t) && !kws) return null;
  const spec = { when: null, has: null, ...(kws ? { kw: kws } : {}) };
  const lm = t.match(/(?:ตราบเท่าที่|ถ้า)\s*(?:บน\s*)?Land Magic Zone\s*มี\s*(?:["“]([^"”]+)["”]|(\S+(?:\s\S+)??))\s+(?=Avatar|การ์ด|POWER)/);
  if (lm) { spec.land = (lm[1] || lm[2]).trim(); t = t.replace(lm[0], " "); }
  // timing / location conditions
  t = t.replace(/(?:ตราบเท่าที่|เมื่อ)\s*(?:Avatar|การ์ด)?\s*(?:ใบนี้|ตัวนี้)?\s*(?:อยู่)?\s*บน\s*(?:Avatar|Construct)\s*Zone(?:\s*ฝ่ายเรา)?/g, " ");
  t = t.replace(/ตราบเท่าที่อยู่บน\s*Avatar\s*Zone/g, " ");
  if (/(?:ในช่วง|ใน)\s*Battle Phase\s*(?:ฝ่าย)?เรา/.test(t)) { spec.when = "myBattle"; t = t.replace(/(?:ในช่วง|ใน)\s*Battle Phase\s*(?:ฝ่าย)?เรา/, " "); }
  else if (/(?:ในช่วง|ใน)\s*Battle Phase/.test(t)) { spec.when = "battle"; t = t.replace(/(?:ในช่วง|ใน)\s*Battle Phase/, " "); }
  if (/ที่(?:สั่ง|ประกาศ)โจมตี\s*(?:จนจบการต่อสู้(?:นั้น)?)?/.test(t)) { spec.atk = true; t = t.replace(/ที่(?:สั่ง|ประกาศ)โจมตี\s*(?:จนจบการต่อสู้(?:นั้น)?)?/, " "); }
  if (/ในเทิร์นฝ่ายตรงข้าม/.test(t)) { spec.when = "oppTurn"; t = t.replace(/ในเทิร์นฝ่ายตรงข้าม/, " "); }
  else if (/ในเทิร์น(?:ของ)?เรา/.test(t)) { spec.when = "myTurn"; t = t.replace(/ในเทิร์น(?:ของ)?เรา/, " "); }
  const hasM = t.match(/(?:ตราบเท่าที่|ถ้า)\s*(?:บน\s*)?Avatar Zone\s*(?:ฝ่าย)?เรา\s*มี\s*(?:Avatar\s*)?((?:["“][^"”]+["”]|\{\s*[Ss]ymbol[^}]+\})(?:\s*ใบอื่น)?)/);
  if (hasM) { const f = filterOf(hasM[1]); if (!named(f)) return null; spec.has = { f, other: /ใบอื่น/.test(hasM[1]) }; t = t.replace(hasM[0], " "); }
  const ctl = t.match(/ตราบเท่าที่เราควบคุม\s*["“]([^"”]+)["”]/); if (ctl) { spec.has = { f: { names: [ctl[1].trim()] }, any: true }; t = t.replace(ctl[0], " "); }
  if (/ตราบเท่าที่|ถ้า|หาก/.test(t)) return null; // some other condition
  t = t.replace(/\s+/g, " ").trim();
  // counted bonus: "เพิ่ม POWER ตามจำนวน X ใบละ N" / "POWER +N ตามจำนวน X" / "POWER +1 ต่อจำนวน X"
  const cm = t.match(/(?:POWER\s*\+\s*(\d+)\s*(?:ตามจำนวน|ต่อจำนวน)|(?:จะ\s*)?(?:เพิ่ม|เพื่ม)\s*POWER\s*ตามจำนวน|POWER(?:\s*ของ\s*(?:Avatar|การ์ด)\s*ใบนี้)?\s*จะ\s*เพิ่ม(?:ขึ้น)?\s*ตามจำนวน)\s*(.+?)(?:\s*(?:ชื่อละ|ใบละ)\s*(\d+))?\s*$/);
  if (cm) {
    if (kws) return null;
    const per = +(cm[3] || cm[1] || 1); const what = cm[2];
    if (t.slice(0, t.indexOf(cm[0])).replace(/การ์ดใบนี้|Avatar ใบนี้|ใบนี้|POWER ของ|ของ|Avatar|การ์ด/g, "").trim()) return null; // must be about this card
    if (/LIFE/.test(what)) { if (!/หงาย/.test(what)) return null; return { ...spec, kind: "count", per, count: { life: /ทั้ง\s*2\s*ฝ่าย|ทั้งสองฝ่าย/.test(what) ? "both" : "mine" } }; }
    const f = filterOf(what); if (!named(f) || f.bad) return null;
    const zone = /นรก/.test(what) ? "hell" : /Avatar Zone/.test(what) ? "av" : /สนาม/.test(what) ? "field" : null; if (!zone) return null; // "บนสนาม": every zone of the field (FAQ หนุมาน)
    const side = /ฝ่ายเรา|ของเรา|Zone\s*เรา|นรกเรา/.test(what) ? "mine" : /ฝ่ายตรงข้าม/.test(what) ? null : zone === "av" || zone === "field" ? "both" : null; if (!side) return null;
    return { ...spec, kind: "count", per, count: { f, zone, side, other: /ใบอื่น/.test(what), uniq: /ชื่อต่างกัน|ไม่ซ้ำ/.test(what) } };
  }
  if (/ตามจำนวน|ต่อจำนวน|ใบละ/.test(t)) return null;
  const pm = t.match(/POWER\s*([+\-−–])\s*(\d+)/) || (kws && !/POWER/.test(t) ? { 1: "+", 2: "0", 0: "", index: t.length } : null); if (!pm) return null; const n = (pm[1] === "+" ? 1 : -1) * +pm[2];
  if ((t.match(/POWER\s*[+\-−–]\s*\d+/g) || []).length > 1) return null;
  const before = t.slice(0, pm.index), after = t.slice(pm.index + pm[0].length);
  const target = (before + " " + after.replace(/^\s*ให้/, "")).trim();
  // self: "Avatar ใบนี้ POWER +N" or a bare "POWER +N"
  if (/^(?:Avatar|การ์ด)?\s*(?:ใบนี้|ตัวนี้)?\s*$/.test(before.trim()) && !after.replace(/^\s*ให้/, "").trim()) return { ...spec, kind: "self", n };
  if (!/ใบนี้|ตัวนี้/.test(target) || /ใบอื่น/.test(target)) {
    const f = filterOf(target); if (f.bad) return null; if (textHas) f.text = textHas;
    const opp = /ฝ่ายตรงข้าม|อีกฝ่าย/.test(target); const ours = /ฝ่ายเรา|ของเรา|Zone\s*เรา|สนามเรา|ทุกใบของเรา/.test(target);
    const both = !opp && !ours && (/บนสนาม|ทุกใบ|ทั้งหมด/.test(target) || spec.atk); // "every … on the field": both players
    if (!opp && !ours && !both) return null;
    if (!named(f) && !/ทุกใบ/.test(target)) return null;
    if (f.names) f.names = f.names.flatMap((x) => x.split(/\s*,\s*/)).filter(Boolean);
    return { ...spec, kind: "group", n, f, side: opp ? "opp" : both ? "both" : "mine", other: /ใบอื่น/.test(target) };
  }
  return null;
}
function describe(sp) {
  const w = { myBattle: "ใน Battle Phase เรา ", battle: "ใน Battle Phase ", oppTurn: "ในเทิร์นฝ่ายตรงข้าม ", myTurn: "ในเทิร์นเรา " }[sp.when] || "";
  const sign = (n) => (n > 0 ? "+" : "") + n;
  const what = [sp.n ? `POWER ${sign(sp.n)}` : "", sp.kw ? "ได้รับ " + sp.kw.join(" ") : ""].filter(Boolean).join(" · ");
  if (sp.kind === "self") return `${w}ใบนี้ ${what}`;
  if (sp.kind === "group") return `${w}${sp.side === "opp" ? "ฝ่ายตรงข้าม" : sp.side === "both" ? "ทั้งสองฝ่าย" : "ฝ่ายเรา"}${sp.other ? " (ใบอื่น)" : ""}${sp.atk ? " ตอนสั่งโจมตี" : ""} ${what}`;
  return `${w}ใบนี้ POWER +${sp.per} ต่อจำนวนที่นับได้`;
}
export function readAura(def) {
  let text = def && def.x; if (!text) return null;
  const key = (def.t || "") + (def.st || "") + "|" + text; if (cache.has(key)) return cache.get(key);
  // a Land Magic's plain lines ("POWER +1 ให้ Avatar … ทุกใบ") work for as long as it stays on the field
  if (def.t === "M" && def.st === "L") text = String(text).split(/\n+/).map((l) => (/^\s*(?:ต่อเนื่อง|อัตโนมัติ|เทิร์นละครั้ง|สั่งใช้|เลือกปฏิบัติ|#|\[|-|\d\s*[).])/.test(l) || !l.trim() || /[:：]/.test(l) ? l : "ต่อเนื่อง " + l.trim())).join("\n");
  if (!/ต่อเนื่อง/.test(text)) { cache.set(key, null); return null; }
  const zone = ON_FIELD[def.t] || (def.t === "M" && def.st === "L" ? "land" : null);
  // skip abilities that are only granted in some situation ({red "ต่อเนื่อง …"} / "ได้รับ …")
  const ms = [...String(text).matchAll(/ต่อเนื่อง/g)].map((m) => m.index);
  const segs = zone ? ms.filter((k) => !/(\{red|["“]|ได้รับ)\s*$/i.test(text.slice(Math.max(0, k - 12), k)) && !/^ต่อเนื่อง\s*\{red/i.test(text.slice(k, k + 20)))
    .map((k) => text.slice(k, ms.find((q) => q > k) ?? text.length)).map((x) => x.split(/\n|\s(?=อัตโนมัติ|เทิร์นละครั้ง|เทิรน์ละครั้ง|สั่งใช้|คำสั่งเสีย|จุติ|#|\/)/)[0]) : [];
  const specs = segs.map(parse).filter(Boolean);
  const out = specs.length ? { desc: specs.map(describe).join(" · "), specs, run: (E, s, src, L) => run(E, s, src, L, specs, zone) } : null;
  cache.set(key, out); return out;
}
function run(E, s, src, L, specs, zone) {
  if (L.z !== zone || src.mute) return [];
  const p = L.p; const res = [];
  for (const sp of specs) {
    if (sp.when === "myBattle" && !(s.phase === "battle" && s.active === p)) continue;
    if (sp.when === "battle" && s.phase !== "battle") continue;
    if (sp.when === "oppTurn" && s.active === p) continue;
    if (sp.when === "myTurn" && s.active !== p) continue;
    if (sp.land && !E.lands(s).some((l) => String(E.def(s, l).n || "").includes(sp.land))) continue;
    if (sp.has) { const pool = sp.has.any ? [...s.P[p].av, ...s.P[p].cs, ...s.P[p].mg, ...E.lands(s).filter((l) => l.o === p)] : s.P[p].av;
      if (!pool.some((x) => x.i !== (sp.has.other ? src.i : -1) && (sp.has.any ? sp.has.f.names.some((n) => String(E.def(s, x).n || "").includes(n)) : fits(E, s, x, sp.has.f)))) continue; }
    if (sp.kind === "self") { if (zone === "av") res.push({ seat: p, test: (x) => x.i === src.i, n: sp.n, kw: sp.kw }); continue; }
    if (sp.kind === "group") { for (const seat of sp.side === "both" ? [0, 1] : [sp.side === "opp" ? 1 - p : p]) res.push({ seat, test: (x) => !(sp.other && x.i === src.i) && (!sp.atk || (!!s.pend && s.pend.att === x.i)) && (sp.f && named(sp.f) ? fits(E, s, x, sp.f) : true), n: sp.n, kw: sp.kw }); continue; }
    if (sp.kind === "count" && zone === "av") {
      let k = 0; const c = sp.count;
      if (c.worn) k = [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === src.i && (!c.mod || E.def(s, m).st === "D") && (!c.name || String(E.def(s, m).n || "").includes(c.name))).length;
      else if (c.token) k = s.P[p].av.filter((x) => x.tok && String(E.def(s, x).n || "").includes(c.token)).length;
      else if (c.life) k = (c.life === "both" ? [0, 1] : [p]).reduce((a, q) => a + s.P[q].life.filter((x) => x.up).length, 0);
      else { const seats = c.side === "both" ? [0, 1] : [p]; let list = seats.flatMap((q) => (c.zone === "field" ? [...s.P[q].av, ...s.P[q].cs, ...s.P[q].mg.filter((x) => !x.fd)] : s.P[q][c.zone])).filter((x) => fits(E, s, x, c.f) && !(c.other && x.i === src.i));
        if (c.uniq) list = [...new Set(list.map((x) => E.def(s, x).n))]; k = list.length; }
      if (k) res.push({ seat: p, test: (x) => x.i === src.i, n: k * sp.per });
    }
  }
  return res;
}

// POWER a Modification gives the Avatar wearing it: { n, f } (f = which Avatars get it), or null
const mcache = new Map();
export function modPower(def) {
  const text = def && def.x; if (!text) return null; if (mcache.has(text)) return mcache.get(text); let out = null;
  for (const l of String(text).split(/\n/)) { if (/ถ้า|หาก|เมื่อ|ในช่วง|ใน Battle|ตราบ|ต่อจำนวน|ตามจำนวน/.test(l.split(/POWER/)[0])) continue; let m;
    if ((m = l.match(/POWER\s*\+\s*(\d+)\s*ให้\s*Avatar\s*(.*?)\s*ที่(?:ถูก)?สวมใส่/))) { const f = filterOf(m[2]); out = { n: +m[1], f: named(f) ? f : null }; break; }
    if ((m = l.match(/^\s*(?:Avatar\s*)?(.*?)\s*ที่(?:ถูก)?สวมใส่(?:การ์ด(?:ใบ)?นี้)?\s*(?:จะ)?\s*(?:ได้รับ\s*)?POWER\s*\+\s*(\d+)/))) { const f = filterOf(m[1]); out = { n: +m[2], f: named(f) ? f : null }; break; } }
  mcache.set(text, out); return out;
}
export const modPowerFor = (E, s, m, host) => { const r = modPower(E.def(s, m)); return r && (!r.f || fitsDef(E.def(s, host), r.f)) ? r.n : 0; };

// ---------- static rules printed on a card (no timing): who it may pay for / be worn by, cannot attack, … ----------
// traits(def) → null or an object shaped like the hand-written script hooks, so the engine can use either one
const tcache = new Map();
const quoted = (t) => { const f = filterOf(t.replace(/Symbol\s+[^\s{]+/g, " ")); const tb = t.match(/ที่มี\s*["“]([^"”]+)["”]\s*อยู่ใน\s*Text Box/); if (tb) { f.text = tb[1].trim(); delete f.names; } if (!named(f)) { const bare = t.replace(/Avatar|การ์ด|ที่เป็น|เท่านั้น|ชื่อ/g, "").trim(); if (bare && bare.length <= 30 && !/\d/.test(bare)) f.names = bare.split(/\s*หรือ\s*|\s*,\s*/).filter(Boolean); } return named(f) ? f : null; };
export function traits(def) {
  const text = def && def.x; if (!text) return null; const key = (def.t || "") + (def.st || "") + "|" + text; if (tcache.has(key)) return tcache.get(key);
  const o = {}; let m; const line = (re) => String(text).split(/\n/).find((l) => re.test(l) && !/ถ้า|ตราบ|เมื่อ|ยกเว้น|จนกว่า|หาก/.test(l));
  if ((m = text.match(/ใช้เป็น\s*Cost\s*(?:ใน)?(?:การ)?อัญเชิญ\s*ได้เฉพาะ\s*([^\n\]]+?)\s*เท่านั้น/))) { const f = quoted(m[1]); if (f) o.payOnly = (d) => ["A", "T"].includes(d.t) && fitsDef(d, f); }
  if (def.t === "M" && def.st === "D") {
    if ((m = text.match(/สวมใส่ได้(?:เฉพาะ|แค่)\s*([^\n]+?)\s*เท่านั้น/))) { const f = quoted(m[1]); if (f) o.modOnly = (E, s, host) => fitsDef(E.def(s, host), f, true); }
    const kl = line(new RegExp(`ที่(?:ถูก)?สวมใส่(?:การ์ด(?:ใบ)?นี้)?\\s*(?:จะ)?\\s*ได้รับ\\s*(?:ความสามารถ\\s*)?["“]?\\s*(?:${KWS})`)); if (kl) o.modKw = kl.slice(kl.search(/ได้รับ/)).split(/POWER/)[0].match(new RegExp(KWS, "g"));
    if (/เมื่อ\s*Avatar\s*(?:["“][^"”]+["”]\s*)?ที่สวมใส่(?:การ์ด(?:ใบ)?นี้)?\s*จะถูกทำลาย\s*:?\s*(?:สามารถ)?\s*ทำลายการ์ดใบนี้\s*แทน/.test(text)) o.shield = true;
  }
  if (["A", "T"].includes(def.t)) {
    if (line(/(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:จะ)?\s*(?:โจมตีไม่ได้|ไม่สามารถ\s*โจมตีได้)/) && !/โจมตีได้(?!.*ไม่)|สามารถสั่งโจมตี|จะโจมตีได้/.test(text.replace(/ไม่สามารถ\s*โจมตีได้/g, ""))) o.noAttack = () => true;
    // "cannot attack unless an Avatar is worn (N or more)" / "may attack only with an empty hand"
    if ((m = text.match(/ถ้าไม่มี\s*Avatar\s*สวมใส่\s*Avatar\s*(?:ใบนี้|ตัวนี้)\s*(?:(\d+)\s*ใบ\s*ขึ้นไป)?\s*(?:จะ)?\s*ไม่สามารถ\s*โจมตีได้/))) { const need = +(m[1] || 1); o.noAttack = (E, s, x) => [...s.P[0].mg, ...s.P[1].mg].filter((c) => c.on === x.i && ["A", "T"].includes(E.def(s, c).t)).length < need; }
    else if (/(?:การ์ด|Avatar)\s*(?:ใบนี้|ตัวนี้)\s*สามารถ(?:สั่ง)?โจมตีได้\s*(?:ต่อ)?เมื่อเราไม่มีการ์ดบนมือ/.test(text)) o.noAttack = (E, s, x) => { const L = E.locate(s, x.i); return !!L && s.P[L.p].hand.length > 0; };
    if (String(text).split(/\n/).some((l) => /(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:จะ)?\s*(?:ไม่สามารถ\s*(?:ถูก)?\s*เปลี่ยนการควบคุม|ไม่ถูกเปลี่ยนการควบคุม)/.test(l))) o.noControl = true;
    if (line(/ฝ่ายตรงข้าม\s*(?:จะ)?\s*ไม่สามารถเลือกเป้า(?:หมาย)?(?:การ)?โจมตี(?:อื่น)?\s*(?:ได้)?\s*นอกจาก\s*(?:การ์ด|Avatar)\s*(?:ใบนี้|ตัวนี้)/)) o.taunt = () => true;
    if (/ไม่สามารถลงสนามจากบนมือ|ลงสนามจากบนมือไม่ได้/.test(text)) o.noHand = true;
    if (/ควบคุม[^\n]*?(?:ใน|บน)\s*Avatar Zone\s*ได้เพียง\s*1\s*ใบ/.test(text)) o.uniq = true;
    if (/ถือเป็น\s*Avatar\s*ทุกสี/.test(text)) o.anyColor = true;
    if (/ไม่สามารถใช้\s*Avatar\s*ชื่อซ้ำกัน\s*(?:ใน)?(?:การ)?สวมใส่/.test(text)) o.uniqWear = true;
  }
  const out = Object.keys(o).length ? o : null; tcache.set(key, out); return out;
}
