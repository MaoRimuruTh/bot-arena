// Free reader for continuous POWER effects ("ต่อเนื่อง ... POWER +N").
// Conservative like effects.js: anything it can't express exactly is ignored (returns no aura).
// readAura(def) -> null or { desc, run(E, s, src, L) -> [{ seat, test(x), n }] }
const cache = new Map();

const ON_FIELD = { A: "av", T: "av", C: "cs" };
const BAIL = /Text Box|\[Link\]|แทน|สวมใส่|Token|Modification|Construct\s*"|มิติมืด|Magic Zone|ไม่สามารถ|ได้รับ|ถูกทำลาย|ลด POWER|ต่ำสุด|สูงสุด|เท่ากับ|ทุกๆ|ไม่มี|สภาพนอน|สภาพตื่น|ตั้งต้น|Gem|ลูกเต๋า|เปลี่ยน/;

function filterOf(t) {
  const f = {};
  const sy = t.match(/\{\s*[Ss]ymbol\s+([^}]+?)\s*\}/); if (sy) f.symbol = sy[1].trim();
  const names = [...t.matchAll(/["“]([^"”]{1,40})["”]/g)].map((m) => m[1].trim()).filter(Boolean); if (names.length) f.names = names;
  const co = t.match(/สี(แดง|ฟ้า|เขียว|ม่วง)/); if (co) f.color = co[1];
  const c = t.match(/Cost\s*(\d+)/); if (c) f.cost = +c[1];
  if (/POWER\s*\d/.test(t.replace(/POWER\s*[+\-−–]\s*\d+/g, ""))) f.bad = true;
  return f;
}
const named = (f) => !!(f.symbol || f.names || f.color || f.cost != null);
function fits(E, s, x, f) {
  const d = E.def(s, x); if (!["A", "T"].includes(d.t)) return false;
  if (f.symbol && !String(d.sy || "").includes(f.symbol)) return false;
  if (f.names && !f.names.some((n) => String(d.n || "").includes(n))) return false;
  if (f.color && d.co !== f.color) return false;
  if (f.cost != null && (d.c || 0) !== f.cost) return false;
  return true;
}
// one "ต่อเนื่อง" clause → aura spec or null
function parse(seg) {
  let t = seg.replace(/\{red\s*/gi, "").replace(/\s+/g, " ").trim();
  t = t.replace(/^ต่อเนื่อง\s*/, "");
  if (BAIL.test(t)) return null;
  if (!/POWER/.test(t)) return null;
  const spec = { when: null, has: null };
  // timing / location conditions
  t = t.replace(/(?:ตราบเท่าที่|เมื่อ)\s*(?:Avatar|การ์ด)?\s*(?:ใบนี้|ตัวนี้)?\s*(?:อยู่)?\s*บน\s*(?:Avatar|Construct)\s*Zone(?:\s*ฝ่ายเรา)?/g, " ");
  t = t.replace(/ตราบเท่าที่อยู่บน\s*Avatar\s*Zone/g, " ");
  if (/(?:ในช่วง|ใน)\s*Battle Phase\s*(?:ฝ่าย)?เรา/.test(t)) { spec.when = "myBattle"; t = t.replace(/(?:ในช่วง|ใน)\s*Battle Phase\s*(?:ฝ่าย)?เรา/, " "); }
  else if (/(?:ในช่วง|ใน)\s*Battle Phase/.test(t)) { spec.when = "battle"; t = t.replace(/(?:ในช่วง|ใน)\s*Battle Phase/, " "); }
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
    const per = +(cm[3] || cm[1] || 1); const what = cm[2];
    if (t.slice(0, t.indexOf(cm[0])).replace(/การ์ดใบนี้|Avatar ใบนี้|ใบนี้|POWER ของ|ของ|Avatar|การ์ด/g, "").trim()) return null; // must be about this card
    if (/LIFE/.test(what)) { if (!/หงาย/.test(what)) return null; return { ...spec, kind: "count", per, count: { life: /ทั้ง\s*2\s*ฝ่าย|ทั้งสองฝ่าย/.test(what) ? "both" : "mine" } }; }
    const f = filterOf(what); if (!named(f) || f.bad) return null;
    const zone = /นรก/.test(what) ? "hell" : /Avatar Zone|สนาม/.test(what) ? "av" : null; if (!zone) return null;
    const side = /ฝ่ายเรา|ของเรา|Zone\s*เรา|นรกเรา/.test(what) ? "mine" : /ฝ่ายตรงข้าม/.test(what) ? null : zone === "av" ? "both" : null; if (!side) return null;
    return { ...spec, kind: "count", per, count: { f, zone, side, other: /ใบอื่น/.test(what), uniq: /ชื่อต่างกัน|ไม่ซ้ำ/.test(what) } };
  }
  if (/ตามจำนวน|ต่อจำนวน|ใบละ/.test(t)) return null;
  const pm = t.match(/POWER\s*([+\-−–])\s*(\d+)/); if (!pm) return null; const n = (pm[1] === "+" ? 1 : -1) * +pm[2];
  if ((t.match(/POWER\s*[+\-−–]\s*\d+/g) || []).length > 1) return null;
  const before = t.slice(0, pm.index), after = t.slice(pm.index + pm[0].length);
  const target = (before + " " + after.replace(/^\s*ให้/, "")).trim();
  // self: "Avatar ใบนี้ POWER +N" or a bare "POWER +N"
  if (/^(?:Avatar|การ์ด)?\s*(?:ใบนี้|ตัวนี้)?\s*$/.test(before.trim()) && !after.replace(/^\s*ให้/, "").trim()) return { ...spec, kind: "self", n };
  if (!/ใบนี้|ตัวนี้/.test(target) || /ใบอื่น/.test(target)) {
    const f = filterOf(target); if (f.bad) return null;
    const opp = /ฝ่ายตรงข้าม|อีกฝ่าย/.test(target); const ours = /ฝ่ายเรา|ของเรา|Zone\s*เรา|สนามเรา|ทุกใบของเรา/.test(target);
    if (!opp && !ours) return null;
    if (!named(f) && !/ทุกใบ/.test(target)) return null;
    return { ...spec, kind: "group", n, f, side: opp ? "opp" : "mine", other: /ใบอื่น/.test(target) };
  }
  return null;
}
function describe(sp) {
  const w = { myBattle: "ใน Battle Phase เรา ", battle: "ใน Battle Phase ", oppTurn: "ในเทิร์นฝ่ายตรงข้าม ", myTurn: "ในเทิร์นเรา " }[sp.when] || "";
  const sign = (n) => (n > 0 ? "+" : "") + n;
  if (sp.kind === "self") return `${w}ใบนี้ POWER ${sign(sp.n)}`;
  if (sp.kind === "group") return `${w}${sp.side === "opp" ? "ฝ่ายตรงข้าม" : "ฝ่ายเรา"}${sp.other ? " (ใบอื่น)" : ""} POWER ${sign(sp.n)}`;
  return `${w}ใบนี้ POWER +${sp.per} ต่อจำนวนที่นับได้`;
}
export function readAura(def) {
  const text = def && def.x; if (!text || !/ต่อเนื่อง/.test(text)) return null;
  const key = (def.t || "") + "|" + text; if (cache.has(key)) return cache.get(key);
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
    if (sp.has) { const pool = sp.has.any ? [...s.P[p].av, ...s.P[p].cs, ...s.P[p].mg, ...(s.land && s.land.o === p ? [s.land] : [])] : s.P[p].av;
      if (!pool.some((x) => x.i !== (sp.has.other ? src.i : -1) && (sp.has.any ? sp.has.f.names.some((n) => String(E.def(s, x).n || "").includes(n)) : fits(E, s, x, sp.has.f)))) continue; }
    if (sp.kind === "self") { if (zone === "av") res.push({ seat: p, test: (x) => x.i === src.i, n: sp.n }); continue; }
    if (sp.kind === "group") { res.push({ seat: sp.side === "opp" ? 1 - p : p, test: (x) => !(sp.other && x.i === src.i) && (sp.f && (sp.f.symbol || sp.f.names || sp.f.color || sp.f.cost != null) ? fits(E, s, x, sp.f) : true), n: sp.n }); continue; }
    if (sp.kind === "count" && zone === "av") {
      let k = 0; const c = sp.count;
      if (c.life) k = (c.life === "both" ? [0, 1] : [p]).reduce((a, q) => a + s.P[q].life.filter((x) => x.up).length, 0);
      else { const seats = c.side === "both" ? [0, 1] : [p]; let list = seats.flatMap((q) => s.P[q][c.zone]).filter((x) => fits(E, s, x, c.f) && !(c.other && x.i === src.i));
        if (c.uniq) list = [...new Set(list.map((x) => E.def(s, x).n))]; k = list.length; }
      if (k) res.push({ seat: p, test: (x) => x.i === src.i, n: k * sp.per });
    }
  }
  return res;
}
