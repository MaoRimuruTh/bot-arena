// Ciel's free deck builder (no API key): builds a legal 50 + 5 LIFE deck around a set of core
// cards (favourites or aces) by picking supporting cards that share their symbols, names and
// colours, keeping a playable Cost curve and enough GEM.
import { CARDS, card, baseId, isBase, limitOf, validateDeck } from "./cards.js?v=20261111184157";
import { SCRIPTS } from "./scripts.js?v=20261111184157";
import { readable } from "./effects.js?v=20261111184157";

let scripted = null;
const isScripted = (c) => { if (!scripted || scripted.n !== CARDS.length) { const s = new Set(); for (const p of Object.keys(SCRIPTS)) { const x = CARDS.find((y) => y.p === p); if (x) s.add(baseId(x.i)); } scripted = { n: CARDS.length, s }; } return scripted.s.has(baseId(c.i)); };
const words = (n) => String(n || "").split(/\s*[-–]\s*|\s+/).filter((w) => w.length >= 3);
// generic, reliable support Magic the bot can use (by print code)
const STAPLES = ["BT01-038", "BT04-044", "BT01-040", "BT02-049", "SD01-017"];

export function freeBuild({ core = [], colors = [], style = "win", name = "" } = {}) {
  const cores = [...new Set(core.map((i) => baseId(+i)))].map(card).filter(Boolean);
  const notes = [];
  // colours: what was asked, else the two most common among the core cards
  let cols = colors.slice(0, 2);
  if (!cols.length) { const cnt = {}; for (const c of cores) if (c.co && c.t !== "L") cnt[c.co] = (cnt[c.co] || 0) + (c.t === "A" ? 2 : 1); cols = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k); }
  const okColor = (c) => !c.co || !cols.length || cols.includes(c.co);
  const coreMain = cores.filter((c) => c.t !== "L" && c.t !== "T");
  const offColor = coreMain.filter((c) => !okColor(c)); if (offColor.length) notes.push(`ไม่ได้ใส่ ${offColor.map((c) => c.n).join(", ")} เพราะคนละสีกับเด็ค`);
  const keep = coreMain.filter(okColor);
  // what the core cares about: symbols, name words, quoted names / symbols in their text
  const syms = new Set(keep.filter((c) => c.t === "A").map((c) => c.sy).filter(Boolean));
  const refs = new Set(); const refSy = new Set();
  for (const c of keep) { for (const m of String(c.x || "").matchAll(/["“]([^"”]{2,30})["”]/g)) refs.add(m[1].trim()); for (const m of String(c.x || "").matchAll(/\{\s*[Ss]ymbol\s+([^}]+?)\s*\}/g)) refSy.add(m[1].trim()); }
  const nameWords = new Set(keep.flatMap((c) => words(c.n)).filter((w) => keep.filter((c) => c.n.includes(w)).length >= 1 && CARDS.filter((x) => isBase(x) && x.n.includes(w)).length >= 3 && CARDS.filter((x) => isBase(x) && x.n.includes(w)).length <= 60));
  // synergy with the chosen cards (separate from raw card strength)
  // a symbol shared by hundreds of cards (คน, ต่างชาติ …) says little; a rare one says a lot
  const syCount = {}; for (const c of CARDS) if (isBase(c) && c.sy) syCount[c.sy] = (syCount[c.sy] || 0) + 1;
  const syW = (y) => ((syCount[y] || 0) > 60 ? 0.6 : 2.5);
  const syn = (c) => {
    let v = 0; const d = String(c.x || "");
    if (c.sy && syms.has(c.sy)) v += syW(c.sy); if (c.sy && refSy.has(c.sy) && !syms.has(c.sy)) v += 1;
    for (const r of refs) if (c.n.includes(r)) { v += 4; break; }
    for (const w of nameWords) if (c.n.includes(w)) { v += 3; break; }
    for (const s of syms) if (d.includes(s)) { v += syW(s) > 1 ? 3 : 0.8; break; }
    for (const k of keep) if (d.includes(k.n) || words(k.n).some((w) => nameWords.has(w) && d.includes(w))) { v += 3; break; }
    return v;
  };
  const score = (c) => {
    let v = syn(c); const d = String(c.x || "");
    if (c.t === "A") v += ((c.pw || 0) - (c.c || 0)) * 0.6 + ((c.c || 0) <= 2 && (c.g || 0) >= 2 ? 1.2 : 0) + ((c.g || 0) >= 3 && (c.c || 0) <= 3 ? 0.6 : 0);
    if (c.t === "M") v += /จั่วการ์ด/.test(d) ? 1.2 : 0, v += /ทำลาย/.test(d) && /ฝ่ายตรงข้าม/.test(d) ? 1.5 : 0;
    if (isScripted(c) || (c.t === "A" && d && readable(c, "summon")) || (c.t === "M" && d && readable(c, "cast"))) v += 1;
    if (style === "budget" && ["SCR", "UR", "USEC", "CBR"].includes(c.r)) v -= 1;
    // cards that only work inside their own family are dead weight elsewhere
    if (/ใช้เป็น\s*Cost[^#\n]*ได้เฉพาะ|ไม่สามารถลงสนามจากบนมือ|ลงสนามจากบนมือไม่ได้/.test(d) && syn(c) < 3) v -= 5;
    return v;
  };
  const pool = CARDS.filter((c) => isBase(c) && !["L", "T"].includes(c.t) && c.fl !== "le" && okColor(c) && !(c.gc && cols.length && !cols.includes(c.gc)));
  const scored = pool.map((c) => ({ c, s: score(c), y: syn(c) })).sort((a, b) => b.s - a.s);
  const main = {}; const byName = {}; let total = 0;
  const room = (c) => Math.min(limitOf(c) - (byName[c.n] || 0), 50 - total);
  const add = (c, n) => { const k = Math.max(0, Math.min(n, room(c))); if (!k) return 0; main[c.i] = (main[c.i] || 0) + k; byName[c.n] = (byName[c.n] || 0) + k; total += k; return k; };
  // exactly one Only #1: the best one among the core, else the best that fits
  const o1core = keep.filter((c) => c.o1).sort((a, b) => (b.c || 0) - (a.c || 0));
  if (o1core.length > 1) notes.push(`Only #1 ใส่ได้ใบเดียว เลือก ${o1core[0].n}`);
  const o1 = o1core[0] || (scored.find((e) => e.c.o1 && e.c.t === "A" && e.s > 1) || scored.find((e) => e.c.o1)).c; add(o1, 1);
  // core cards: full copies
  for (const c of keep) if (!c.o1) add(c, c.t === "M" ? 3 : 4);
  // the chosen cards' own family first (same names / symbols / cards their text asks for), regardless of curve
  const cnt = (f) => Object.entries(main).reduce((a, [i, n]) => a + (f(card(+i)) ? n : 0), 0);
  const famA = { n: 0 }, famM = { n: 0 };
  for (const e of [...scored].sort((a, b) => b.y - a.y || b.s - a.s)) {
    if (total >= 42) break; if (e.y < 3 || e.c.o1 || byName[e.c.n]) continue;
    if (e.c.t === "A") { if (famA.n >= 16) continue; if ((e.c.c || 0) >= 7 && e.y < 5) continue; if ((e.c.c || 0) >= 5 && cnt((c) => c.t === "A" && (c.c || 0) >= 5) >= 11) continue; famA.n += add(e.c, e.y >= 5 ? 3 : 2); }
    else if (e.c.t === "M") { if (famM.n >= 9) continue; famM.n += add(e.c, e.y >= 5 ? 3 : 2); }
  }
  // Avatar curve targets (by Cost) then Magic, filled best-first
  const want = style === "fun" ? { 0: 5, 1: 6, 2: 7, 3: 6, 4: 6, 5: 3, 6: 3 } : { 0: 4, 1: 7, 2: 8, 3: 7, 4: 6, 5: 3, 6: 2 };
  const have = (k) => Object.entries(main).reduce((a, [i, n]) => { const c = card(+i); return a + (c.t === "A" && Math.min(6, c.c || 0) === k ? n : 0); }, 0);
  for (const k of [2, 1, 3, 4, 0, 5, 6]) for (const e of scored) { if (have(k) >= want[k] || total >= 50) break; if (e.c.t !== "A" || e.c.o1 || Math.min(6, e.c.c || 0) !== k) continue; add(e.c, Math.min(want[k] - have(k), e.s >= 4 ? 4 : 3)); }
  for (const p of STAPLES) { if (total >= 50) break; const c = CARDS.find((x) => x.p === p); if (c && okColor(c) && !byName[c.n]) add(card(baseId(c.i)), 2); }
  for (const e of scored) { if (total >= 50) break; if (e.c.t !== "M" || e.c.st === "L" && Object.keys(main).some((i) => card(+i).st === "L")) continue; if (e.s < 0.5) continue; add(e.c, e.s >= 4 ? 3 : 2); }
  for (const e of scored) { if (total >= 50) break; if (e.c.o1) continue; add(e.c, 2); }
  // LIFE: favourites first, then readable LIFE cards that suit the colours / symbols
  const lifeFav = cores.filter((c) => c.t === "L");
  const lifePool = CARDS.filter((c) => isBase(c) && c.t === "L" && c.fl !== "le").map((c) => ({ c, s: (readable(c, "life") ? 3 : 0) + (/จั่ว/.test(c.x || "") ? 1 : 0) + ([...syms].some((y) => String(c.x || "").includes(y)) ? 2 : 0) + ((c.co && cols.includes(c.co)) ? 1 : 0) })).sort((a, b) => b.s - a.s);
  const life = []; const ln = new Set(); for (const c of [...lifeFav, ...lifePool.map((e) => e.c)]) { if (life.length >= 5) break; if (ln.has(c.n)) continue; ln.add(c.n); life.push(c.i); }
  const ace = [...keep].filter((c) => c.t === "A").sort((a, b) => (b.o1 ? 1 : 0) - (a.o1 ? 1 : 0) || (b.c || 0) - (a.c || 0)).slice(0, 2).map((c) => c.i);
  const lead = card(ace[0] || o1.i);
  const deck = { name: name || `เด็ค${lead ? " " + lead.n : "การ์ดที่ชอบ"}`, main, life, ace: ace.length ? ace : [o1.i], style,
    plan: [`ชิเอลจัดจากการ์ด ${keep.length} ใบที่เลือก${cols.length ? " · สี" + cols.join(" + ") : ""}`,
      syms.size ? `แกนของเด็ค: Symbol ${[...syms].slice(0, 3).join(", ")} การ์ดหนุนเลือกจากใบที่ Symbol หรือชื่อเข้ากัน` : "",
      `ต้นเกม: ลง Avatar Cost ต่ำที่ GEM สูงไว้จ่าย Cost · กลางเกม: ลงการ์ดที่ชอบ · Only #1: ${o1.n}`, ...notes].filter(Boolean).join("\n") };
  return { deck, notes, colors: cols, valid: validateDeck(deck) };
}
