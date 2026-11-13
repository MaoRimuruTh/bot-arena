// Game engine — official Rule Book 3.2; card text effects are resolved by players or Ciel through ops.
import { card, kwHas, kwWhere, SUB_TH, CARDS, baseId, nameText, syText, allSy, hasFieldAlias, normName, nameHas, colorIs } from "./cards.js?v=20261113191423";
import { readAura, traits, modPowerFor } from "./auras.js?v=20261113191423";
import { SCRIPTS } from "./scripts.js?v=20261113191423";
import { newId, clone } from "./util.js?v=20261113191423";
// Symbol names some card texts use for a Symbol the cards print under another name ({symbol มนุษย์} on เยี่ยวรดศาล
// means the คน Avatars; the KD04 reprint of "GHD โคลค" says เครื่องจักร for หุ่นยนต์)
const SY_ALIAS = { "มนุษย์": "คน", "เครื่องจักร": "หุ่นยนต์" };
export const ZONES = ["deck", "hand", "av", "mg", "cs", "hell", "dark", "life"];
export const ZONE_TH = { deck: "Deck", hand: "มือ", av: "Avatar Zone", mg: "Magic Zone", cs: "Construct Zone", hell: "นรก", dark: "มิติมืด", life: "LIFE", land: "Land Magic" };
export const PHASE_TH = { toss: "เสี่ยงทาย", mull: "เปลี่ยนมือ", draw: "Draw", main: "Main", battle: "Battle", end: "End", over: "จบเกม" };
export class RuleError extends Error {}
// script lookup: print code → base card id, so reprints share one script
let scriptBase = null;
// trigger ids come from a counter in the game state (not a random id), so replaying the same actions rebuilds the same game
const tid = (s) => "t" + (s.tidc = (s.tidc || 0) + 1);
export function scriptOfDef(d) { return d && d.im != null ? scriptOf({ cards: { 0: d } }, { c: 0 }) : null; }
// the printed Token card an ability calls for, when the card list has one by that name (วานร SD09-026, สัตว์ในตำนาน
// BT12-076): the Token on the table is that card, picture and all. The ability's own numbers stay the rules.
function tokenCard(name, pw) {
  const all = ((CARDS.byName && CARDS.byName.get(name)) || []).filter((c) => c.t === "T"); if (!all.length) return null;
  return (all.find((c) => c.b == null && c.pw === pw) || all.find((c) => c.pw === pw) || all[0]).i;
}
export function scriptOf(s, x) {
  if (x.mute) return null; // "สูญเสียความสามารถทั้งหมด"
  const d = s.cards[x.c]; if (!d || d.im == null) return null;
  // every printing of a code gets its script (some codes have two spellings)
  if (!scriptBase || scriptBase.n !== CARDS.length) { const m = new Map(); const byP = new Map(); for (const y of CARDS) { if (!byP.has(y.p)) byP.set(y.p, []); byP.get(y.p).push(y); } for (const [p, sc] of Object.entries(SCRIPTS)) for (const c of byP.get(p) || []) if (!m.has(baseId(c.i))) m.set(baseId(c.i), sc); scriptBase = { n: CARDS.length, m }; }
  const sc = scriptBase.m.get(baseId(d.im)) || null;
  // (a bare { c } — a trigger being resolved — gets the whole script: a Link ability that already fired still resolves)
  return sc && sc.linkOnly && x.i != null && !x.lk ? unlinked(sc) : sc;
}
// FAQ (every [Link] card): "ความสามารถคู่หูจะได้รับเมื่อ Avatar นี้เข้าสู่สถานะคู่หู" — out of Link the script's linkOnly parts are switched
// off (rules that are always asked keep a harmless answer, timings are null so the printed text is not read instead)
const LINK_OFF = { aura: () => [], taunt: () => false, tauntFor: () => false, endPhase: () => [], wouldLeave: () => false, wouldDestroy: () => false, saveOther: () => null };
const unlinkedMap = new Map();
function unlinked(sc) { let v = unlinkedMap.get(sc); if (!v) { v = { ...sc }; for (const k of sc.linkOnly) v[k] = k in LINK_OFF ? LINK_OFF[k] : null; unlinkedMap.set(sc, v); } return v; }
// static rules of a card: its script if it has one, otherwise what can be read from its text (see auras.js traits)
// a card's rules: its hand-written script, plus the printed rules read from its text (the script wins where both say something)
const hkMerged = new Map();
// does this card's ability fire at `when`? A script handles the timings it defines; the others are read from the printed text.
const fires = (s, x, when, re) => { if (x.mute) return false; const sc = scriptOf(s, x); if (sc && when in sc) return !!sc[when] && !((when === "attack" || when === "fight") && sc.storyOnly && !x.story); const t = E.def(s, x).x || ""; return E.ext.trig ? E.ext.trig(t, when) : !!(re && re.test(t)); };
const hk = (s, x) => { const sc = scriptOf(s, x); const tr = traits(E.def(s, x)); if (!sc || !tr) return sc || tr; let m = hkMerged.get(sc); if (!m) { m = { ...tr, ...sc }; hkMerged.set(sc, m); } return m; };
const FIELD = ["av", "cs", "mg"];
const COLORS = ["แดง", "ฟ้า", "เขียว", "ม่วง"];
const LINKS = new Map(); // card text → names in its [Link …]
export const END_RE = /อัตโนมัติ\s*ใน(?:ช่วง|ทุกๆ)?\s*End Phase(\s*(?:ของ)?\s*เรา)?/;
export const MAIN_RE = /อัตโนมัติ\s*(?:เมื่อ|ใน)?(?:ช่วง)?\s*เริ่ม(?:ต้น)?\s*Main Phase\s*(?:ของ)?\s*เรา/;
const once0 = (s, p, n) => !(s.nu && s.nu[p] && s.nu[p][n] === s.turn);
function fieldCards(s) { const out = []; for (let p = 0; p < 2; p++) for (const z of FIELD) for (const x of s.P[p][z]) out.push({ x, L: { p, z } }); for (const l of [s.land, s.land2]) if (l) out.push({ x: l, L: { p: l.o, z: "land" } }); return out; }
const WORN_RE = /เมื่อการ์ดใบนี้\s*สวมใส่/;
const OD_LOCK = /#\s*Avatar\s*ทุกใบใน\s*สนามฝ่ายเรา\s*จะไม่สามารถใช้ความสามารถได้\s*ยกเว้น/;
const ATTACKED_RE = /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*ถูกโจมตี/;
const WIN_RE = /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*ทำลาย\s*Avatar\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*จากการต่อสู้/;
export const E = {
  hooks: (s, x) => hk(s, x), // script or text-derived static rules of a card
  ext: {}, // filled in by effects.js: acts(s, x, L) → text abilities usable now, react(s, x, p, on) → may this React answer now
  ev(s, o) { s.evc = (s.evc || 0) + 1; (s.ev = s.ev || []).push({ id: s.evc, ...o }); if (s.ev.length > 40) s.ev.shift(); },
  // before the game (phase "toss"): both vote for a die or a coin (a split vote is drawn between the two), then each rolls a die
  // (a tie is rolled again) or the coin is flipped; the winner chooses to go first or second
  tossSeat(s) { const t = s.toss; if (!t) return null; if (t.m == null) return t.vote[0] == null ? 0 : 1; if (t.win == null) return t.roll[0] == null ? 0 : 1; return t.win; },
  tossMoves(s, p) { const t = s.toss; if (!t) return [];
    if (t.m == null) return t.vote[p] == null ? [{ d: "เลือก: ทอยเต๋า", a: { type: "tossVote", m: "dice" } }, { d: "เลือก: โยนเหรียญ", a: { type: "tossVote", m: "coin" } }] : [];
    if (t.win == null) return t.m === "dice" && t.roll[p] == null ? [{ d: "ทอยเต๋า", a: { type: "tossRoll" } }] : [];
    return t.win === p ? [{ d: "เริ่มก่อน", a: { type: "tossPick", first: true } }, { d: "เริ่มทีหลัง", a: { type: "tossPick", first: false } }] : []; },
  rnd(s) { s.seed = (s.seed + 0x6D2B79F5) | 0; let t = s.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
  shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(E.rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  def: (s, x) => (x.ov ? { ...(s.cards[x.c] || {}), ...x.ov } : s.cards[x.c] || { n: "?", t: "A", x: "" }),
  name: (s, x) => E.def(s, x).n,
  log(s, seat, m) { s.log.push({ t: s.turn, s: seat, m }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); },
  kw(s, x, k) { if (x.mute) return false; if ((k === "โล่มนุษย์" || k === "ลูกฮึด") && s.P) { const L = E.locate(s, x.i); if (L && L.z === "av" && E.odHas(s, 1 - L.p, "shield")) return false; } const d = E.def(s, x); const w = kwWhere(d.x, k); return w === 1 || (w === 2 && !!x.lk) || (x.kw || []).includes(k) || (x.kt || []).some((e) => e.k === k) || E.auraKw(s, x, k); },
  // keywords handed out by continuous effects on the field, or by a Modification it wears
  auraKw(s, x, k) {
    const me = E.locate(s, x.i); if (!me || (me.z !== "av" && !(k === "สามัคคี" && E.mgActive(s, x, me)))) return false; // FAQ เสาซินแสมงคล: a เสามงคล on the Magic Zone gets สามัคคี from ผู้เจริญ นาย too
    for (const { x: src, L } of fieldCards(s)) { const sc = scriptOf(s, src); const ra = sc && sc.aura ? null : !src.mute && readAura(E.def(s, src));
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; for (const a of list) if (a.kw && a.kw.includes(k) && a.seat === me.p && a.test(x)) return true; }
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) { const tr = traits(E.def(s, m)); if (tr && tr.modKw && tr.modKw.includes(k)) return true; }
    return false;
  },
  magicInHell: (s, p) => s.P[p].hell.filter((x) => E.def(s, x).t === "M").length,
  // POWER ตั้งต้น as the field sees it: หมู่บ้านเห็ด halves it (FAQ: "ปรับลด POWER ตั้งต้น" — the +/- on top are not halved, จอมหักกระดูก resets to the halved value)
  // a continuous "POWER ตั้งต้นจะเป็น N" of its own (ฮองตง, ฮิมไลน์) is an aura entry with base: N — FAQ: it comes back after anything else changes the base, but a Land (Layer 2) still applies on top of it
  basePower(s, x, me, ab) { const d = E.def(s, x); const L = me === undefined ? E.locate(s, x.i) : me;
    if (ab === undefined) { ab = null; if (L && L.z === "av") for (const { x: src, L: Ls } of fieldCards(s)) { const sc = scriptOf(s, src); if (!sc || !sc.aura) continue; for (const a of sc.aura(E, s, src, Ls)) if (a.base != null && a.seat === L.p && a.test(x)) ab = a.base; } }
    const b = ab != null ? ab : x.zero ? 0 : d.pw || 0; return L && L.z === "av" && E.landSc(s, "halvePower") ? Math.floor(b / 2) : b; },
  power(s, x) {
    const d = E.def(s, x); let mb = 0;
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) { const sm = scriptOf(s, m); mb += sm && sm.worn ? sm.worn(E, s, m, x) : modBonus(E.def(s, m).x) || modPowerFor(E, s, m, x); }
    // cards worn by the Avatar attacking this one that weaken its target (e.g. ปืนฉมวก)
    if (s.pend && s.pend.tk === "av" && s.pend.ti === x.i) { const A = E.locate(s, s.pend.att); if (A) for (const P of s.P) for (const m of P.mg) if (m.on === A.x.i) { const sm = scriptOf(s, m); if (sm && sm.foeWorn) mb += sm.foeWorn(E, s, m, A.x, x) || 0; } }
    const tn = x.tn ? Object.values(x.tn).reduce((a, b) => a + b, 0) : 0;
    let au = 0, ab = null; const me = E.locate(s, x.i);
    // (FAQ ริกกี้ คุณตาใจดี: an Avatar that takes nothing from the other side's Magic gets no POWER from their Land or Magic either)
    const mproof = me && me.z === "av" && !x.mute ? (() => { const mp = (scriptOf(s, x) || {}).magicProof; return typeof mp === "function" ? !!mp(E, s, x) : !!mp; })() : false;
    if (me && me.z === "av") for (const { x: src, L } of fieldCards(s)) { if (mproof && E.def(s, src).t === "M" && (src.o != null ? src.o : L.p) !== me.p) continue; const sc = scriptOf(s, src); const ra = sc && sc.aura ? null : !src.mute && readAura(E.def(s, src));
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; for (const a of list) if (a.seat === me.p && a.test(x)) { if (a.base != null) ab = a.base; else au += a.n || 0; } }
    else if (me && me.z === "cs") for (const { x: src, L } of fieldCards(s)) { const sc = !src.mute && scriptOf(s, src); if (!sc || !sc.aura) continue; for (const a of sc.aura(E, s, src, L)) if (a.cs && a.seat === me.p && a.test(x)) au += a.n; }
    const base = E.basePower(s, x, me, ab);
    { const own = x.mute ? null : scriptOf(s, x); if (own && own.soloPower) { let only = 0; for (const P of s.P) for (const m of P.mg) if (m.on === x.i && E.named(s, m, own.soloPower)) { const sm = scriptOf(s, m); only += sm && sm.worn ? sm.worn(E, s, m, x) : 0; } return Math.max(0, base + Math.min(0, x.pm || 0) + Math.min(0, x.tm || 0) + Math.min(0, x.fm || 0) + Math.min(0, tn) + Math.min(0, mb - only) + only + Math.min(0, au)); } }
    if (me && me.z === "av" && [...s.P[0].mg, ...s.P[1].mg].some((m) => { if (m.on !== x.i || m.mute) return false; const nl = (scriptOf(s, m) || {}).noLower; return typeof nl === "function" ? !!nl(E, s, m, x) : !!nl; })) return Math.max(0, base + Math.max(0, x.pm || 0) + Math.max(0, x.tm || 0) + Math.max(0, x.fm || 0) + Math.max(0, tn) + Math.max(0, mb) + Math.max(0, au));
    const v = Math.max(0, base + (x.pm || 0) + (x.tm || 0) + (x.fm || 0) + tn + mb + au);
    return v;
  },
  // where a card's POWER comes from, for the card view: [what, amount] pairs in the order power() adds them, the
  // printed POWER first; the total is power() itself (it may stop at 0, be halved by a Land, or ignore some parts)
  powerParts(s, x) {
    const d = E.def(s, x), me = E.locate(s, x.i), hv = !!(me && me.z === "av" && E.landSc(s, "halvePower")), parts = [[x.zero ? "POWER ตั้งต้นถูกปรับเป็น 0" : hv ? "ตั้งต้น (หารครึ่งจาก Land Magic)" : "ตั้งต้น", E.basePower(s, x, me)]]; void d;
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) { const sm = scriptOf(s, m); const n = sm && sm.worn ? sm.worn(E, s, m, x) : modBonus(E.def(s, m).x) || modPowerFor(E, s, m, x); if (n) parts.push([`${E.name(s, m)} ที่สวมใส่`, n]); }
    if (s.pend && s.pend.tk === "av" && s.pend.ti === x.i) { const A = E.locate(s, s.pend.att); if (A) for (const P of s.P) for (const m of P.mg) if (m.on === A.x.i) { const sm = scriptOf(s, m); const n = sm && sm.foeWorn ? sm.foeWorn(E, s, m, A.x, x) || 0 : 0; if (n) parts.push([`${E.name(s, m)} ของผู้โจมตี`, n]); } }
    if (x.pm) parts.push(["จากเอฟเฟกต์ (ติดตัวจนออกจากสนาม)", x.pm]); if (x.tm) parts.push(["จนจบเทิร์นนี้", x.tm]); if (x.fm) parts.push(["ระหว่างการต่อสู้นี้", x.fm]);
    const tn = x.tn ? Object.values(x.tn).reduce((a, b) => a + b, 0) : 0; if (tn) parts.push(["จนจบเทิร์นถัดไป", tn]);
    if (me && (me.z === "av" || me.z === "cs")) for (const { x: src, L } of fieldCards(s)) {
      const sc = me.z === "cs" ? !src.mute && scriptOf(s, src) : scriptOf(s, src); const ra = me.z === "av" && !(sc && sc.aura) && !src.mute ? readAura(E.def(s, src)) : null;
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; let n = 0; for (const a of list) if (a.seat === me.p && (me.z === "av" || a.cs) && a.test(x) && a.base == null) n += a.n || 0;
      if (n) parts.push([`${E.name(s, src)}${src.i === x.i ? " (ตัวเอง)" : ""} ความสามารถต่อเนื่อง`, n]);
    }
    return { total: E.power(s, x), parts, halved: !!(me && me.z === "av" && E.landSc(s, "halvePower")) };
  },
  hellGem(s, p, x) { const ids = new Set(); for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.hellGem) for (const z of sc.hellGem(E, s, y, Ly, x) || []) ids.add(z); } const td = E.def(s, x); /* FAQ แม่นางลิ: GEM taken from hell still has to match the colour, like GEM from the hand */ const list = s.P[p].hell.filter((z) => ids.has(z.i) && !(E.def(s, z).gc && td && td.co && E.def(s, z).gc !== td.co && !(traits(td) || {}).anyColor)); return { list, n: list.reduce((a, z) => a + (E.def(s, z).g || 0), 0) }; },
  costOf(s, p, x, noHell) { // Cost after continuous reductions (e.g. ซาร์อึก)
    let c = E.def(s, x).c || 0; { const own = x.mute ? null : scriptOf(s, x); if (own && own.selfCost) c += own.selfCost(E, s, x, p) || 0; }
    for (const { x: src, L } of fieldCards(s)) { if (L.p !== p) continue; const sc = scriptOf(s, src); if (sc && sc.costMod) c += sc.costMod(E, s, src, L, x); }
    for (const l of E.lands(s)) { const ls = l.mute ? null : scriptOf(s, l); if (ls && ls.costAll) c += ls.costAll(E, s, x) || 0; } // Land effects on every hand
    if (x.hcm && x.hcm.t === s.turn) c += x.hcm.n; // "Cost -1 ในเทิร์นนี้" on a card in the hand (พี่เจมส์)
    if (s.grule && s.grule[p] && s.grule[p].cd) { const nn = (t) => normName(String(t || "")).replace(/ซัก/g, "สัก"); for (const r of s.grule[p].cd) if (nn(E.def(s, x).n).includes(nn(r.name))) c = Math.max(c - r.n, Math.min(c, r.min)); } // for the rest of the game (ตัวอะไรสักอย่างฯ)
    if (!noHell) c -= E.hellGem(s, p, x).n;
    return Math.max(0, c);
  },
  untargetable(s, x) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); return !!(L && sc && sc.untargetable && sc.untargetable(E, s, x, L)); },
  // names / Symbols a card counts as (printed "#Avatar ใบนี้ถือว่ามีชื่อ …" rules included)
  onField(s, x) { const L = E.locate(s, x.i); return !!L && (L.z === "av" || L.z === "cs"); },
  named(s, x, n) { if (x.xn && normName(x.xn).includes(normName(n))) return true;
    { const own = x.mute ? null : scriptOf(s, x); if (own && own.alsoName) { const an = own.alsoName(E, s, x); if (an && normName(an).includes(normName(n))) return true; } }
    if (s.P) for (let q = 0; q < 2; q++) if (s.P[q].hell.includes(x)) for (const y of s.P[q].av) { if (y.mute) continue; const sh = scriptOf(s, y); if (sh && sh.hellName) { const hn = sh.hellName(E, s, y, x); if (hn && normName(hn).includes(normName(n))) return true; } } if (x.nameAs) return normName(x.nameAs).includes(normName(n)); const d = E.def(s, x); if (nameHas(nameText(d, hasFieldAlias(d) && E.onField(s, x)), n)) return true;
    for (const P of s.P || []) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sm = scriptOf(s, m); if (sm && sm.addName && normName(sm.addName).includes(normName(n))) return true; }
    if (s.P) for (let q = 0; q < 2; q++) for (const y of s.P[q].av) { if (y.mute || y.i === x.i) continue; const sy = scriptOf(s, y); if (sy && sy.nameAura && normName(sy.nameAura.name).includes(normName(n)) && s.P[q].av.includes(x) && sy.nameAura.test(E, s, x)) return true; } return false; },
  // Rule Book (Layers): a Land that sets every Avatar's Symbol (Layer 2) wins over a Modification's (Layer 1) — กุ่ย wearing วูตาตู is only {เทพ} under แอสการ์ด
  hasSy(s, x, k) { k = SY_ALIAS[k] || k; const lockSy = (x.sye || x.syAs) && E.syLocked(s, x); if (x.sye && x.sye.until >= s.turn && !lockSy) return x.sye.k === k; { const own = x.mute ? null : scriptOf(s, x); if (own && own.allSyOnField && (E.locate(s, x.i) || {}).z === "av") return true; } if (x.xsy && x.xsy.t === s.turn && x.xsy.list.includes(k)) return true; if (x.syAs && !lockSy) return x.syAs === k; const o = E.landSy(s, x) || E.syOver(s, x); { const own = x.mute ? null : scriptOf(s, x); if (own && own.extraSy === k) return true; } if (o) { if (o === k) return true; const d0 = E.def(s, x); return hasFieldAlias(d0) && E.onField(s, x) && syText(d0, true).includes(k) && !syText(d0, false).includes(k); } /* FAQ ตั๊กแตนพันธุ์ X: a Symbol the card gives itself stays beside the one a Land gives */ const d = E.def(s, x); const on = hasFieldAlias(d) && E.onField(s, x); return allSy(d, on) || syText(d, on).includes(k); },
  // a Land Magic that changes the symbol of every Avatar on the Avatar Zones ("เปลี่ยน Symbol ของ Avatar ทุกใบบน Avatar Zone เป็น Symbol {เทพ}")
  landSy(s, x) { if (!s.P || !(s.land || s.land2)) return null; const sc = E.landSc(s, "landSy"); if (!sc) return null; const L = E.locate(s, x.i); return L && L.z === "av" && !E.syLocked(s, x) ? sc.landSy : null; },
  // "Avatar ที่สวมใส่การ์ดใบนี้ จะไม่ถูกเปลี่ยน Symbol" (GHD โคลค): nothing replaces its Symbol, a Land that turns every Avatar into {เทพ} included
  syLocked(s, x) { if (!s.P) return false; for (const P of s.P) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sc = scriptOf(s, m); if (sc && sc.syLock) return true; } return false; },
  // the single symbol a card has right now instead of its printed ones, or null
  syNow(s, x) { const lock = (x.sye || x.syAs) && E.syLocked(s, x); if (x.sye && x.sye.until >= s.turn && !lock) return x.sye.k; if (x.syAs && !lock) return x.syAs; return E.landSy(s, x) || E.syOver(s, x) || null; },
  syOver(s, x) { if (x.on != null || !s.P) return null; let o = null, lock = false; for (const P of s.P) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sc = scriptOf(s, m); if (sc && sc.syLock) lock = true; else if (sc && sc.syOver) o = sc.syOver; } return lock ? null : o; },
  // "เมื่อ LIFE Card ของเราถูกหงาย": field cards of that player with a lifeFlip script
  lifeFlipped(s, p) { for (const { x: y, L: Ly } of fieldCards(s)) if (Ly.p === p && !y.mute && (scriptOf(s, y) || {}).lifeFlip) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "lifeFlip", optional: true }); },
  // extra cards seen by a scout of player p's card `src` (วัดคู่บ้านคู่เมือง …)
  scoutBonus(s, p, src) { let n = 0; for (const { x: y, L: Ly } of fieldCards(s)) if (Ly.p === p && !y.mute) { const sy = scriptOf(s, y); if (sy && sy.scoutMore) n += sy.scoutMore(E, s, y, Ly, src) || 0; } return n; },
  // Avatars that may not attack LIFE right now (printed restrictions)
  noLife(s, x) { if (x.nlt === s.turn) return true; { const L = E.locate(s, x.i); if (L && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p !== L.p && !y.mute && (scriptOf(s, y) || {}).lifeGuard)) return true; } if (x.mute) return false; const h = hk(s, x); return !!(h && h.noLife && h.noLife(E, s, x)); }, // lifeGuard: ป้อมยาม
  // the fight is over: "until the end of the fight" POWER changes end
  endFight(s, cancelled) { const pd = s.pend; s.pend = null; for (const q of [0, 1]) for (const y of s.P[q].av) delete y.fm;
    if (pd && pd.af && pd.af.length) E.ops(s, pd.af.filter((o) => !o.kick || (!cancelled && pd.tk === "life")), pd.by); // เตะไข่: only once LIFE was hit
    if (pd && !cancelled && pd.tk === "av") { const T = E.locate(s, pd.ti); const st = T && T.z === "av" && !T.x.mute ? scriptOf(s, T.x) : null; if (st && st.defEnd) s.trig.push({ id: tid(s), seat: T.p, i: T.x.i, c: T.x.c, when: "defEnd" }); }
    if (pd && !cancelled && pd.tk === "av") { const A = E.locate(s, pd.att); const sa = A && A.z === "av" && !A.x.mute ? scriptOf(s, A.x) : null; if (sa && sa.atkEnd && (!sa.atkEndOk || sa.atkEndOk(E, s, A.x, A))) s.trig.push({ id: tid(s), seat: A.p, i: A.x.i, c: A.x.c, when: "atkEnd" }); }
    if (pd && !cancelled && pd.tk === "av") for (const [a, b] of [[pd.att, pd.ti], [pd.ti, pd.att]]) { const A = E.locate(s, a), B = E.locate(s, b); const sc = A && A.z === "av" && !A.x.mute ? scriptOf(s, A.x) : null; if (sc && sc.fightEnd && B) sc.fightEnd(E, s, A.x, B.x, A); }
    // แทงหลัง: when the fight is over, an attacker that shares no colour with a backstabbing helper is destroyed
    if (!cancelled && pd && pd.bs && pd.bs.length) { const A = E.locate(s, pd.att); if (A && A.z === "av") { const ac = E.colors(s, A.x); const bad = pd.bs.find((b) => !b.co.some((c) => ac.includes(c)));
      if (bad) E.destroy(s, A.x.i, `แทงหลังของ ${bad.n}: สีต่างกับผู้โจมตี ถูกทำลายเมื่อจบการต่อสู้`); } }
  },
  // colours a card counts as (printed colour plus "ถือว่ามีสี …" rules)
  guarded(s, x, L, fromOpp, kind = "destroy") { if (!fromOpp) return false; for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.guard && sc.guard(E, s, y, Ly, x, L, kind)) return true; } return false; },
  // "เมื่อฝ่ายตรงข้ามใช้ความสามารถของ Avatar": the counter resolves before the ability (พระพิฆเนศ)
  abilitySeen(s, p, x) { for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p === p || y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.oppAbility && (!sy.oppAbilityOk || sy.oppAbilityOk(E, s, y, Ly, x))) s.trig.unshift({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "oppAbility", ai: x.i }); } },
  helped(s, p, att, y) { { const sh = y.mute ? null : scriptOf(s, y); if (sh && sh.helper && (!sh.helperOk || sh.helperOk(E, s, y, att))) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "helper", att: att.i }); } const sa = att.mute ? null : scriptOf(s, att); if (sa && sa.helpedBy && (!sa.helpedByOk || sa.helpedByOk(E, s, att, y))) s.trig.push({ id: tid(s), seat: p, i: att.i, c: att.c, when: "helpedBy", helper: y.i });
    const sy = y.mute ? null : scriptOf(s, y); if (sy && sy.onHelp) { att.kf = s.turn; E.log(s, p, `${E.name(s, att)} ได้รับ: ทำลาย Avatar จากการต่อสู้แล้วหงาย LIFE ฝ่ายตรงข้าม (จนจบเทิร์น)`); } E.helperUsed(s, p, y); },
  helperUsed(s, p, y) { if (!y.lk) return; for (const { x: z, L } of fieldCards(s)) { if (L.p !== p || z.mute) continue; const sc = scriptOf(s, z); if (sc && sc.wakeLinked && once0(s, p, "wakeLinked:" + z.i)) { (s.nu = s.nu || [{}, {}])[p]["wakeLinked:" + z.i] = s.turn; y.a = true; E.log(s, p, `${E.name(s, y)} กลับมาตื่น (${E.name(s, z)})`); } } },
  wonFight(s, p, w) { for (const y of s.P[p].hand) { const sc = scriptOf(s, y); if (sc && sc.handKill && (!sc.handKillOk || sc.handKillOk(E, s, y, w))) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "handKill", winner: w.i, optional: true }); } if (w.kf === s.turn) E.op(s, { op: "lifeFlip", seat: 1 - p }, p); if (w.kdm === s.turn) E.op(s, { op: "lifeDamage", seat: 1 - p }, p); if (w.tlb === s.turn) { delete w.tlb; E.op(s, { op: "lifeFlip", seat: 1 - p }, p); } for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.allyKill && sc.allyKillOk && sc.allyKillOk(E, s, y, w)) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "allyKill", optional: true }); } },
  gotMod(s, host, m) { const hs = host.mute ? null : scriptOf(s, host); const H = E.locate(s, host.i); if (H && hs && hs.gotMod && (!hs.gotModOk || hs.gotModOk(E, s, host, m))) s.trig.push({ id: tid(s), seat: H.p, i: host.i, c: host.c, when: "gotMod", mod: m.i, optional: true }); },
  forced(s, p) { return fieldCards(s).some(({ x: y, L: Ly }) => Ly.p !== p && !y.mute && (scriptOf(s, y) || {}).forceAttack && scriptOf(s, y).forceAttack(E, s, y, Ly)) && !(s.atk && s.atk.t === s.turn && s.atk.n > 0); }, // สุมาอี้: must attack once
  overdose(s, p) { return s.P[p].life.filter((y) => y.up).length >= 3; },
  odHas(s, p, key) { return fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === p && Ly.z === "av" && !y.mute && ((scriptOf(s, y) || {}).odBlock || []).includes(key)) && E.overdose(s, p); }, // Overdose: blocks the opponent's abilities
  // "#Avatar ทุกใบในสนามฝ่ายเราจะไม่สามารถใช้ความสามารถได้ยกเว้น Avatar "Overdose"": also from the Magic Zone, and every kind of ability but the
  // continuous ones stops (FAQ เซตาม่อน Overdose): no สั่งใช้ here, no จุติ / อัตโนมัติ / คำสั่งเสีย in odPrune
  odLock(s, p) { return [...s.P[p].av, ...s.P[p].mg].some((y) => !y.mute && !y.fd && OD_LOCK.test(E.def(s, y).x || "")); },
  // โรงบาล: the card brought back, and every card of that name, cannot be summoned or use its ability this turn
  nameLocked(s, p, x) { const t = s.tlock && s.tlock[p]; return !!(t && t.t === s.turn && t.names && t.names.includes(E.def(s, x).n)); },
  actBlocked(s, p, x) { if (E.nameLocked(s, p, x)) return true; return ["A", "T"].includes(E.def(s, x).t) && !E.named(s, x, "Overdose") && (E.locate(s, x.i) || {}).z === "av" && E.odLock(s, p); },
  odMuted(s, t) { const d = s.cards[t.c]; if (!d || !["A", "T"].includes(d.t) || String(d.n || "").includes("Overdose") || t.held || t.when === "trim") return false;
    const L = E.locate(s, t.i); if (!(L && L.z === "av" && L.p === t.seat) && !(t.when === "death" && t.z === "av")) return false; return E.odLock(s, t.seat); },
  // โรงบาล: this turn the cards of that name cannot use their abilities, either player's (FAQ). By the Overdose ruling "cannot use abilities" stops every
  // kind of ability but the continuous ones, so the automatic ones (จุติ, อัตโนมัติ, คำสั่งเสีย) of such a card are dropped here as they come up.
  nameShut(s, p, n) { const t = s.tlock && s.tlock[p], h = s.hosp && s.hosp[p]; return !!((t && t.t === s.turn && t.names && t.names.includes(n)) || (h && h.t === s.turn && h.names.includes(n))); },
  odPrune(s) { if (!s.trig.length || s.phase === "over") return;
    if ((s.tlock && s.tlock.some((q) => q && q.t === s.turn && q.names)) || (s.hosp && s.hosp.some((q) => q && q.t === s.turn))) for (let k = s.trig.length - 1; k >= 0; k--) { const t = s.trig[k], d = s.cards[t.c]; if (!d || d.t !== "A" || t.held || t.when === "trim" || !E.nameShut(s, t.seat, d.n)) continue; s.trig.splice(k, 1); E.log(s, t.seat, `${d.n}: ความสามารถไม่ทำงาน (เทิร์นนี้ใช้ความสามารถของการ์ดชื่อนี้ไม่ได้)`); }
    for (let k = s.trig.length - 1; k >= 0; k--) { const t = s.trig[k]; if (!E.odMuted(s, t)) continue; s.trig.splice(k, 1); E.log(s, t.seat, `${s.cards[t.c].n}: ความสามารถไม่ทำงาน (Avatar ฝ่ายเราใช้ความสามารถไม่ได้ ยกเว้น Overdose)`); } },
  wornNoAtk(s, x) { return [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostNoAttack); },
  mgActive(s, x, L) { return L.z === "mg" && x.on == null && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === L.p && Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).mgAbilities && scriptOf(s, y).mgAbilities(E, s, y, x)); },
  colors(s, x) { const pd = s.pend; if (pd && pd.tk === "av" && (pd.att === x.i || pd.ti === x.i)) { const foe = pd.att === x.i ? pd.ti : pd.att; if (foe != null && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === foe && !m.mute && (scriptOf(s, m) || {}).foeColor)) { const m = [...s.P[0].mg, ...s.P[1].mg].find((z) => z.on === foe && !z.mute && (scriptOf(s, z) || {}).foeColor); return [scriptOf(s, m).foeColor]; } } // มีมมิ: "Avatar ที่ต่อสู้กับ … จะถูกเปลี่ยนเป็น Avatar สีม่วง"
    const d = E.def(s, x); const on = hasFieldAlias(d) && E.onField(s, x); return COLORS.filter((c) => colorIs(d, c, on)); },
  // how Avatar y of player p may help attacker att: สามัคคี adds its POWER, แทงหลัง adds +1 (risky: other colour → attacker destroyed after the fight)
  // who may help an attack: our Avatars, and the Avatars on our Magic Zone that may use their abilities from there (เสาซินแสมงคล)
  helpPool(s, p) { const P = s.P[p]; return [...P.av, ...P.mg.filter((m) => m.on == null && E.def(s, m).t === "A" && E.mgActive(s, m, { p, z: "mg" }))]; },
  helpOf(s, p, att, y) {
    if (!y.a || y.i === att.i || y.mute) return null; if (!s.P[p].av.includes(y) && !E.helpPool(s, p).includes(y)) return null; { const sc = scriptOf(s, y); if (sc && sc.helpOnly && !sc.helpOnly(E, s, att)) return null; }
    if (E.kw(s, y, "สามัคคี") && !fieldCards(s).some(({ x: z, L }) => L.p !== p && !z.mute && (scriptOf(s, z) || {}).noUnite)) return { k: "u", n: E.power(s, y) };
    if (E.kw(s, y, "แทงหลัง")) { const yc = E.colors(s, y), ac = E.colors(s, att); return { k: "b", n: 1, risky: !yc.some((c) => ac.includes(c)) }; }
    return null;
  },
  // x cannot be chosen by its opponent's card abilities (its own rule, or a protection such as กวนอู's)
  noAim(s, x) { if (E.untargetable(s, x) || x.imm === s.turn) return true; const L = E.locate(s, x.i); if (!L) return false;
    for (const { x: src, L: Ls } of fieldCards(s)) { if (Ls.p !== L.p || src.mute) continue; const sc = scriptOf(s, src); if (sc && sc.noAim && sc.noAim(E, s, src, Ls, x, L)) return true; } return false; },
  // the attack now goes to another Avatar: cards waiting for that moment fire (ลิโป้ …)
  retargeted(s) { let n = 0; for (const { x: y, L } of fieldCards(s)) { if (y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.retarget && (!sc.retargetOk || sc.retargetOk(E, s, y, L))) { s.trig.push({ id: tid(s), seat: L.p, i: y.i, c: y.c, when: "retarget", optional: true }); n++; } } return n; },
  // Avatars that say "the opponent can attack nothing but this card"
  // stay: the check a worn Modification keeps making (Rule Book: "ตรวจสอบสถานะของ Avatar ที่สวมใส่อยู่ตลอดเวลา"), which leaves out the
  // limits that only stop a second card from being put on (one of a name per Avatar, one อาวุธของเพมมุ controlled …)
  modOk(s, m, host, stay) { const hs = host.mute ? null : hk(s, host); if (hs && hs.noMod) return false; if (!stay && hs && hs.uniqWear && [...s.P[0].mg, ...s.P[1].mg].some((z) => z.on === host.i && z.i !== m.i && E.def(s, z).n === E.def(s, m).n)) return false; if (hs && hs.wearOnly && !hs.wearOnly(E, s, m)) return false; if (hs && hs.anyMod) return true; const sc = hk(s, m); return !(sc && sc.modOnly && !sc.modOnly(E, s, host, m, !!stay)); }, // noMod: แมมมอธแช่แข็ง · anyMod: รีวิวแมน
  // a worn Modification whose Avatar no longer meets its wearing condition (a name or Symbol lost …) goes to hell
  modSync(s) { for (const p of [0, 1]) for (const m of [...s.P[p].mg]) { if (m.on == null || m.fd) continue; const d = E.def(s, m); if (d.t !== "M" || d.st !== "D") continue; const H = E.locate(s, m.on); if (!H || H.z !== "av" || E.modOk(s, m, H.x, true)) continue;
      E.log(s, p, `${d.n} ไม่ตรงเงื่อนไขการสวมใส่ของ ${E.name(s, H.x)} แล้ว จึงถูกส่งลงนรก`); E.moveTo(s, m.i, "hell"); } },
  // would player t then control two of a card that allows only one (#ควบคุม … ได้เพียง 1 ใบ)?
  ctlBlocked(s, x, t) { return !!(hk(s, x) || {}).uniq && s.P[t].av.some((y) => y.i !== x.i && E.name(s, y) === E.def(s, x).n); },
  // why player p may not play a Land Magic now (null: may): the Land on the field, the opponent's abilities
  landPlayBlocked(s, p) { if (E.landSc(s, "noLand")) return "ใช้ Land Magic ไม่ได้ (Land Magic บนสนาม)"; if (s.landLock && s.landLock[p] >= s.turn) return "ใช้ Land Magic ไม่ได้ในตอนนี้ (ความสามารถของฝ่ายตรงข้าม)";
    return fieldCards(s).some(({ x: y, L: Ly }) => Ly.p !== p && !y.mute && (scriptOf(s, y) || {}).landBlock && scriptOf(s, y).landBlock(E, s, y, Ly)) ? "ใช้ Land Magic ไม่ได้ (ความสามารถของฝ่ายตรงข้าม)" : null; },
  // Rule Book สถานะคู่หู ข้อ 8: an Avatar in Link cannot change control, by card abilities or by players
  // FAQ หมวดเงียบ: a "stays asleep" lock from a card whose abilities were later lost no longer holds
  nwHeld(s, x) { if (!x.nw || x.nw < s.turn) return false; const B = x.nwBy != null ? E.locate(s, x.nwBy) : null; return !(B && B.x.mute); },
  noControl(s, x) { return !!x.lk || (!x.mute && !!(hk(s, x) || {}).noControl); },
  // "ในเทิร์นนี้ Avatar {X} ที่เราอัญเชิญ … ได้รับ": buffs given to Avatars summoned later this turn
  summonBuff(s, p, x) { const b = s.tbuff && s.tbuff[p]; if (!b || b.t !== s.turn || (b.sy && !E.hasSy(s, x, b.sy))) return;
    if (b.imm) x.imm = s.turn; if (b.kw) x.kt = [...(x.kt || []), ...b.kw.map((k) => ({ k, end: s.turn }))]; if (b.noShield) x.nsh = s.turn; E.log(s, p, `${E.name(s, x)} ได้รับความสามารถจนจบเทิร์น`); },
  // awake Avatars of p that a worn card forces to attack and that have something to attack
  mustAttack(s, p) { const lm = () => legalMoves(s, p); if (E.forced(s, p)) { const mv = lm().filter((m) => m.a.type === "attack"); if (mv.length) return s.P[p].av.filter((x) => mv.some((m) => m.a.i === x.i)); }
    return s.P[p].av.filter((x) => x.a && (x.mustAtk === s.turn || [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostMust)) && lm().some((m) => m.a.type === "attack" && m.a.i === x.i)); },
  atkLocked(s, p, x) { const t = s.tlock && s.tlock[p]; return !!(t && t.t === s.turn && t.atkSy && !E.hasSy(s, x, t.atkSy)); },
  deckOpen(s, q) { if (q == null) return E.deckOpen(s, 0) || E.deckOpen(s, 1); return fieldCards(s).some(({ x, L }) => { if (x.mute) return false; const o = (scriptOf(s, x) || {}).openDeck; return typeof o === "function" ? !!o(E, s, x, L, q) : !!o; }); },
  // is x unaffected by the effect resolving now? (ช่วยโลกใบนี้ไว้ this turn, ริกกี้ คุณตา against the opponent's Magic, มาติเนซ's one-time cancel)
  immuneNow(s, x, opName) { const L = E.locate(s, x.i); if (!L || L.z !== "av") return false; if (x.imm === s.turn && s.cur != null && s.curSeat !== L.p) return true;
    { const s0 = s.cur != null ? s.cards[s.cur] : null; if (s0 && s.curSeat != null && s.curSeat !== L.p && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).proofFrom && scriptOf(s, m).proofFrom(E, s, m, x, s0))) return true; }
    const src = s.cur != null ? s.cards[s.cur] : null; if (!src || src.t !== "M" || s.curSeat == null || s.curSeat === L.p) return false;
    { const mp = !x.mute && (scriptOf(s, x) || {}).magicProof; if (typeof mp === "function" ? mp(E, s, x) : mp) return true; } if (x.rimm === s.turn && src.st === "R") return true;
    if (x.mprot && x.mprot.until >= s.turn && (x.mprot.all || (opName !== "power" && opName !== "mute"))) return true;
    const blk = !(/ทั้งหมด|ทุกใบ/.test(String(src.x || "")) && !/เลือก/.test(String(src.x || ""))) && [...s.P[0].mg, ...s.P[1].mg].find((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).magicBlock); if (blk) { E.log(s, L.p, `${E.name(s, blk)} ถูกทำลาย: ยกเลิกความสามารถของ ${src.n} ที่มีต่อ ${E.name(s, x)}`); E.moveTo(s, blk.i, "hell"); s.blockedCur = s.cur; x.blk = s.turn; return true; }
    return x.blk === s.turn && s.blockedCur === s.cur; },
  // FAQ ไบโพล่า ชิลด์: copies worn by the same Avatar answer together (one die each, any even saves it) and are all used up for the turn
  hostSaved(s, x, L, fromOpp, fight) { const o = { fromOpp, fight: !!fight }; for (const P of s.P) for (const m of P.mg) { if (m.on !== x.i || m.mute || m.used === s.turn) continue; const sc = scriptOf(s, m); if (sc && sc.hostSave) { const r = sc.hostSave(E, s, m, x, o); if (r != null) { m.used = s.turn; let saved = !!r; const n = E.def(s, m).n;
      for (const Q of s.P) for (const z of Q.mg) { if (z === m || z.on !== x.i || z.mute || z.used === s.turn || E.def(s, z).n !== n) continue; const sz = scriptOf(s, z); if (!sz || !sz.hostSave) continue; const r2 = sz.hostSave(E, s, z, x, o); if (r2 != null) { z.used = s.turn; saved = saved || !!r2; } }
      if (saved) return true; } } } return false; },
  // what p summoned this turn (เครื่องบิน Super Air)
  // FAQ หุ่นนักรบผู้กล้า : โปรโตไมเกรน: an Avatar (or Token) brought down by an ability can be answered by "เมื่อมี Avatar อัญเชิญ" Reacts too
  // (อุบัติเหตุ, จิ้มมันเลย จิ้ม!) — the window opens here and the ability finishes its other steps before the React resolves
  fxSummoned(s, p, x) { if (x && !s.rw && s.phase !== "over" && s.phase !== "mull" && s.phase !== "toss") E.openWindow(s, p, "summon", x.i); },
  noteSummon(s, p, x) { for (const y of s.P[p].av) { if (y.i === x.i || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.allyIn && sc.allyIn(E, s, y, x)) { y.pm = (y.pm || 0) + 1; E.log(s, p, `${E.name(s, y)} POWER +1 (${E.name(s, x)} เข้ามาใน Avatar Zone)`); } }
    if (s.sum && s.sum[p] && s.sum[p].t === s.turn && s.sum[p].n.length >= 2) for (const y of s.P[1 - p].hand) { const sc = scriptOf(s, y); if (sc && sc.oppThird && !s.trig.some((t) => t.i === y.i)) s.trig.push({ id: tid(s), seat: 1 - p, i: y.i, c: y.c, when: "oppThird", optional: true }); }
    s.sum = s.sum || [null, null]; if (!s.sum[p] || s.sum[p].t !== s.turn) s.sum[p] = { t: s.turn, n: [], d: [] }; s.sum[p].n.push(E.name(s, x)); { const d = E.def(s, x); (s.sum[p].d = s.sum[p].d || []).push({ co: E.colors(s, x), c: d.c || 0, sy: String(d.sy || "") }); }
    s.ever = s.ever || [{}, {}]; s.ever[p][E.def(s, x).n] = 1;
    for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute || y.i === x.i) continue; const sc = scriptOf(s, y); if (sc && sc.anySummon && (!sc.anySummonOk || sc.anySummonOk(E, s, y, Ly, x))) s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "anySummon" }); } },
  summonedNow(s, p) { return s.sum && s.sum[p] && s.sum[p].t === s.turn ? s.sum[p].n : []; },
  // a Magic that may be used even though one of its kind was used this turn
  extraMagic(s, p, x) { const d = E.def(s, x); const sc = scriptOf(s, x);
    if (d.st === "N") { if (fieldCards(s).some(({ x: y, L }) => L.p === p && !y.mute && (scriptOf(s, y) || {}).freeMagic && scriptOf(s, y).freeMagic(E, s, x))) return true; const xn = s.xN && s.xN[p]; return !!(xn && xn.t === s.turn && !xn.used && d.n !== xn.not && (!xn.only || String(d.n || "").includes(xn.only))); } if (d.st === "R") return !!(sc && sc.react && sc.react.ignoreLimit && !s.mu[p].R2) || E.skillExtra(s, p, x);
    if (d.st === "D") { const two = s.two && s.two[p] && s.two[p].t === s.turn; return !!(two && !s.two[p].used && String(d.n || "").includes(s.two[p].name)); } return false; },
  // ขวัญตา เรื่องราว ครุฑเจ้าเวหา (from นักท่องเรื่องราว): one more React "Skill" a turn, with a name not used yet this turn
  skillExtra(s, p, x) { const d = E.def(s, x); if (d.t !== "M" || d.st !== "R" || !/^Skill\b/.test(String(d.n || ""))) return false;
    const n = s.P[p].av.filter((y) => !y.mute && y.story && (scriptOf(s, y) || {}).skillExtra).length; if (!n || (+s.mu[p].RS || 0) >= n) return false; const u = s.skillUsed && s.skillUsed[p]; return !(u && u.t === s.turn && u.n.includes(d.n)); },
  modBlocked(s, p, x) { const two = s.two && s.two[p] && s.two[p].t === s.turn; return !!(two && !String(E.def(s, x).n || "").includes(s.two[p].name)); },
  actOnly(s, p, x, L) { return L.z === "av" && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === p && !y.mute && (scriptOf(s, y) || {}).onlyActs && !scriptOf(s, y).onlyActs(E, s, y, x)); },
  slept(s, p, xs) { for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p || y.mute) continue; const sc = scriptOf(s, y); if (!sc || !sc.allySlept) continue; const hit = xs.filter((z) => z.i !== y.i && (!sc.allySleptOk || sc.allySleptOk(E, s, y, z))); if (hit.length) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "allySlept", ids: hit.map((z) => z.i) }); } },
  dumped(s, x) { const sc = x.mute ? null : scriptOf(s, x); const src = s.cur != null ? s.cards[s.cur] : null; if (sc && sc.dumped && (!sc.dumpedOk || sc.dumpedOk(E, s, x, src))) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "dumped", optional: true }); },
  discarded(s, xs) { const src = s.cur != null ? s.cards[s.cur] : null; for (const x of xs) { const sc = x.mute ? null : scriptOf(s, x); if (sc && sc.discarded && (!sc.discardedOk || sc.discardedOk(E, s, x, src))) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "discarded", optional: true }); } },
  handed(s, x) { const sc = x.mute ? null : scriptOf(s, x); const src = s.cur != null ? s.cards[s.cur] : null; if (sc && sc.handed && (!sc.handedOk || sc.handedOk(E, s, x, src))) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "handed", optional: !sc.forced }); },
  oneAttack(s) { return !!E.landSc(s, "oneAttack"); },
  lands(s) { return [s.land, s.land2].filter(Boolean); }, // two Land Magic cards only while แบ่งแยกดินแดน is on the Land Magic Zone
  // Land Magic is shared by both players: either may use its "สั่งใช้" abilities, and "ฝ่ายเรา" on it means whoever
  // uses it. The card's place with p set to that player, for the ability's own checks (other cards: just where it is)
  // does this Avatar take no effect from the other side's Magic right now? (วีรชนชีวภาพ's protection, or a card that says so itself)
  magicProof(s, x) { if (x.mprot && x.mprot.until >= s.turn) return true; const mp = !x.mute && (scriptOf(s, x) || {}).magicProof; return !!(typeof mp === "function" ? mp(E, s, x) : mp); },
  krakenCan(s, p, x) { const L = E.locate(s, x.i); return !!x.kraken && !!L && L.z === "mg" && L.p === p && x.on == null && s.phase === "main" && s.active === p && s.P[p].hand.length >= 2 && E.avatars(s.P[p]) < 4 && !E.actBlocked(s, p, x); },
  actLoc(s, i, p) { const L = E.locate(s, i); return L && L.z === "land" ? { ...L, p } : L; },
  landSc(s, k) { for (const l of E.lands(s)) { if (l.mute) continue; const sc = scriptOf(s, l); if (sc && sc[k]) return sc; } return null; },
  placeLand(s, x) { // x goes onto the Land Magic Zone: it replaces the Land there, or (แบ่งแยกดินแดน) only its owner's own Land
    const split = !!E.landSc(s, "splitLand"); const gone = E.lands(s).filter((l) => l !== x && (!split || l.o === x.o));
    for (const old of gone) { E.unLand(s, old); s.P[old.o].hell.push(old); E.log(s, x.o, `${E.name(s, old)} ถูกแทนที่`); }
    if (!s.land) s.land = x; else s.land2 = x; },
  unLand(s, x) { if (s.land2 && s.land2.i === x.i) s.land2 = null; else if (s.land && s.land.i === x.i) s.land = null; if (!s.land && s.land2) { s.land = s.land2; s.land2 = null; } },
  // awake Avatars of player p that can take the pending attack with โล่มนุษย์
  shields(s, p) { if (!s.pend || s.pend.nsh) return []; const A = E.locate(s, s.pend.att); if (A && A.x.nsh === s.turn) return []; return s.P[p].av.filter((y) => y.a && y.i !== s.pend.ti && E.kw(s, y, "โล่มนุษย์")); },
  taunts(s, p) { return s.P[p].av.filter((y) => { if (!y.mute) { const h = hk(s, y); if (h && h.taunt && h.taunt(E, s, y)) return true; } return s.P[p].av.some((z) => z.i !== y.i && !z.mute && (scriptOf(s, z) || {}).tauntFor && scriptOf(s, z).tauntFor(E, s, z, y)); }); },
  battleMod(s, me, foe) { const sc = scriptOf(s, me); let n = sc && sc.battle ? sc.battle(E, s, me, foe) : 0; const fo = foe ? scriptOf(s, foe) : null; if (fo && fo.foeBattle && E.def(s, me).t !== "C") n += fo.foeBattle(E, s, foe, me) || 0; return n; },
  locked(s, p, x) { const d = E.def(s, x); { const ls = E.landSc(s, "summonCap"); if (ls && E.summonedNow(s, p).length >= ls.summonCap) return true; } if (s.lock && s.lock[p] === "dragon") return !(String(d.sy || "").includes("มังกร") || String(d.n || "").includes("ผู้ฝึกมังกร"));
    if (s.lock && s.lock[p] === "blueAlien" && !(E.hasSy(s, x, "เอเลี่ยน") && colorIs(d, "ฟ้า", false))) return true;
    for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.limitAv && sy.limitAv(E, s, y, Ly, p, x)) return true; } // a continuous limit on what may be summoned (คุณปลาชด)
    const t = s.tlock && s.tlock[p]; if (t && t.t === s.turn) { if (t.sy && !E.hasSy(s, x, t.sy)) return true; if (t.names && t.names.includes(d.n)) return true; if (t.only && !String(d.n || "").includes(t.only)) return true; } return false; },
  locate(s, i) {
    for (let p = 0; p < 2; p++) for (const z of ZONES) { const idx = s.P[p][z].findIndex((x) => x.i === i); if (idx >= 0) return { p, z, idx, x: s.P[p][z][idx] }; }
    if (s.land && s.land.i === i) return { p: s.land.o, z: "land", idx: 0, x: s.land };
    if (s.land2 && s.land2.i === i) return { p: s.land2.o, z: "land", idx: 1, x: s.land2 };
    return null;
  },
  // Avatars counted against the 4-Avatar limit (พิภพรัททาทุย: 6 while every Avatar of ours is รัททาทุย, so 2 are not counted)
  avatars: (P) => { const n = P.av.filter((x) => !x.tok).length; return P.c6 ? Math.max(0, n - 2) : P.c3 ? P.av.length + 1 : n; }, // c3: นรกในกรง (only 3, Tokens included: FAQ)
  sync(s) { if (s.later2 && s.later2.length && !s.inCheck) { const ids = s.later2; s.later2 = []; for (const i of ids) { const L = E.locate(s, i); if (L && L.z === "av") { E.log(s, L.p, `${E.name(s, L.x)} ถูกส่งลงนรก (การ์ดที่สวมใส่ออกจากสนาม)`); E.moveTo(s, i, "hell"); } } } E.capSync(s); E.linkSync(s); E.modSync(s); E.stateCheck(s); },
  stateCheck(s) { if (s.inCheck || s.phase === "over") return;
    // a Land Magic that can still be answered (ชายจากอนาคต) is not in play yet: what it would force (บึงทมิฬ + คุณปลาชด, FAQ) waits for the answer
    { const open = [s.rw, ...s.trig.map((t) => t.on)].filter((on) => on && on.kind === "cast"); if (open.some((on) => { const Lw = E.locate(s, on.i); return !!Lw && Lw.z === "land"; })) return; }
    s.inCheck = true; try { for (const { x, L } of fieldCards(s)) { if (x.mute) continue; const sc = scriptOf(s, x); if (sc && sc.check) { const ops = sc.check(E, s, x, L) || []; if (ops.length) E.ops(s, ops, L.p); } } } finally { delete s.inCheck; } },
  // สถานะคู่หู (Rule Book p.19–20): an Avatar with "[Link ชื่อ]" and an Avatar of that name on the same Avatar Zone are put into Link
  // together — by their player, once a turn (done here for them in their own turn, the strongest pair first) · an Avatar is in one pair
  // at most (a second โลกิ does not link while ธอร์ is linked to the first) · the pair ends when either card leaves the Avatar Zone
  linkNames(s, x) { { const sc = scriptOf(s, x); if (sc && sc.linkAs) return sc.linkAs; } const t = String(E.def(s, x).x || ""); let v = LINKS.get(t); if (!v) { v = [...t.matchAll(/\[\s*Link\s+([^\]]+?)\s*\]/g)].map((m) => m[1].trim()); LINKS.set(t, v); } return v; },
  linked(s, x) { return !!x.lk; },
  linkSync(s) { if (s.phase === "over") return;
    for (const p of [0, 1]) { const av = s.P[p].av;
      for (const x of av) if (x.lk && !av.some((y) => y.i === x.lkp && y.lkp === x.i)) { delete x.lk; delete x.lkp; }
      if (s.active !== p || (s.lkT && s.lkT[p] === s.turn)) continue;
      let best = null;
      for (const x of av) { if (x.lk || x.mute) continue; const ns = E.linkNames(s, x); if (!ns.length) continue;
        for (const y of av) if (y.i !== x.i && !y.lk && ns.some((n) => E.named(s, y, n))) { const v = E.power(s, x) + E.power(s, y); if (!best || v > best.v) best = { x, y, v }; } }
      if (!best) continue; const { x, y } = best; x.lk = y.lk = true; x.lkp = y.i; y.lkp = x.i; (s.lkT = s.lkT || [null, null])[p] = s.turn;
      E.log(s, p, `${E.name(s, x)} กับ ${E.name(s, y)} เข้าสู่สถานะ [Link]`); const hh = new Set();
      for (const z of [x, y]) { if (fires(s, z, "link")) E.addTrig(s, p, z, "link");
        for (const h of s.P[p].hell) { const sc = scriptOf(s, h); if (!hh.has(h.i) && sc && sc.linkFromHell && sc.linkFromHellOk && sc.linkFromHellOk(E, s, h, z)) { hh.add(h.i); s.trig.push({ id: tid(s), seat: p, i: h.i, c: h.c, when: "linkFromHell", optional: true }); } } } }
    for (const p of [0, 1]) for (const z of ["hand", "deck", "hell", "dark", "life", "mg", "cs"]) for (const x of s.P[p][z]) if (x.lk) { delete x.lk; delete x.lkp; } },
  // Cost of a card now ("ปรับค่า Cost … จนจบเทิร์น")
  costNow(s, x) { if (x.cst && x.cst.t === s.turn) return x.cst.v; let c = (E.def(s, x).c || 0) + (x.cm || 0); const L = E.locate(s, x.i); if (!L || (L.z !== "av" && L.z !== "cs")) return Math.max(0, c);
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sc = scriptOf(s, m); if (sc && sc.wornCost) c += sc.wornCost; }
    for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.costAura) c += sc.costAura(E, s, y, Ly, x, L) || 0; }
    return Math.max(0, c); },
  capSync(s) { for (const p of [0, 1]) { const P = s.P[p]; const sc = E.lands(s).filter((l) => !l.mute).map((l) => scriptOf(s, l)).find((y) => y && y.cap6) || null; /* a Land Magic: for either player */ if (sc && sc.cap6 && P.av.every((x) => sc.cap6(E, s, x))) P.c6 = true; else delete P.c6; }
    { const sc = E.landSc(s, "cap3"); for (const P of s.P) if (sc && sc.cap3) P.c3 = true; else delete P.c3; }
    if (s.phase !== "over" && s.phase !== "mull" && s.phase !== "toss") for (const p of [0, 1]) { const P = s.P[p]; const x = P.av.find((y) => !y.tok); if (x && E.avatars(P) > 4 && !s.trig.some((t) => t.when === "trim" && t.seat === p)) s.trig.push({ id: tid(s), seat: p, i: x.i, c: x.c, when: "trim" }); } },
  // may Avatar x join p's Avatar Zone? (only a card that keeps the six-slot rule may use the two extra slots)
  fits6(s, p, x) { return true; }, // FAQ พิภพรัททาทุย: with 5 รัททาทุย another Avatar may still be summoned; then the Zone is trimmed back to 4
  critical: (P) => P.life.length > 0 && P.life.every((x) => x.up),

  // what a game keeps about a card (looked up from the live card data)
  cardDef(id) { const c = card(id); return { n: c.n, t: c.t, st: c.st, c: c.c, g: c.g, gc: c.gc, pw: c.pw, sy: c.sy, co: c.co, x: c.x || "", o1: c.o1, im: +id, ...(c.al ? { al: c.al } : {}), ...(c.fl ? { fl: c.fl } : {}) }; },
  // a "โดนใจ" (collaboration) card: the mark printed on the card, not a word in its text (older saved games: looked up again)
  collab(s, x) { const d = E.def(s, x); if (!d) return false; if (d.fl) return d.fl === "dj"; const c = d.im != null ? card(d.im) : null; return !!(c && c.fl === "dj"); },
  // toss: true starts with the players settling who chooses to go first (a die each, or a coin): phase "toss", then "mull"
  newGame({ players, decks, seed, first, mode, id, toss }) {
    first = first === 1 ? 1 : 0;
    const s = { v: 1, id: id || newId(), mode, seed: seed | 0, turn: 0, active: first, first, phase: toss ? "toss" : "mull", land: null, cards: {}, nextI: 1, log: [], trig: [], pend: null, need: 0,
      winner: null, reason: "", mull: [false, false], mu: [{}, {}], played: [{}, {}], startedAt: Date.now(), P: [] };
    for (let p = 0; p < 2; p++) {
      const pl = players[p];
      const P = { uid: pl.uid || null, name: pl.name, ava: pl.ava || "", av3: pl.av3 || "", sig: pl.sig || "", mat: pl.mat || "", sleeve: pl.sleeve || "", skins: pl.skins || null, bot: !!pl.bot, deckName: decks[p].name || "", deckId: decks[p].id || null, deck: [], hand: [], av: [], mg: [], cs: [], hell: [], dark: [], life: [] };
      const mk = (id) => { s.cards[id] = s.cards[id] || E.cardDef(id); return { i: s.nextI++, c: String(id), o: p, a: true }; };
      P.deck = E.shuffle(s, decks[p].main.map(mk));
      P.life = E.shuffle(s, decks[p].life.map(mk)).map((x) => ({ ...x, up: false }));
      for (let k = 0; k < 5 && P.deck.length; k++) P.hand.push(P.deck.shift());
      s.P.push(P);
    }
    if (toss) { s.toss = { vote: [null, null], m: null, roll: [null, null], n: 0, win: null }; E.log(s, null, "ก่อนเริ่มเกม: เลือกทอยเต๋าหรือโยนเหรียญ ผู้ชนะได้เลือกว่าจะเริ่มก่อนหรือทีหลัง"); }
    else E.log(s, null, `เริ่มเกม · ${s.P[first].name} เริ่มก่อน`);
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
  // may player `seat` take cards from the Deck into the hand with an ability of card definition `src`? (drawing counts too:
  // Rule Book ล้มโต๊ะ) · 1 - 2 - 2 stops every ability · แมวนิค stops its controller's Avatar and Magic abilities
  deckHandBlocked(s, seat, src) { if (s.noSearch && s.noSearch[seat] >= s.turn) return true; if (src && src.t === "C") return false;
    return fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === seat && Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).blockSearch); },
  lose(s, p, reason) { if (s.phase === "over") return; s.winner = 1 - p; s.phase = "over"; s.reason = reason; s.pend = null; s.trig = []; E.log(s, null, `${s.P[1 - p].name} ชนะ · ${reason}`); E.ev(s, { k: "over", w: 1 - p }); },
  startTurn(s, p) {
    s.turn++; s.active = p; s.phase = "draw"; s.mu = [{}, {}]; E.ev(s, { k: "turn", p, t: s.turn });
    for (const q of [0, 1]) for (const x of s.P[q].av) x.tm = 0;
    for (const x of s.P[p].av) { if (E.nwHeld(s, x)) { E.log(s, p, `${E.name(s, x)} ยังไม่ตื่น (ผลของการ์ดที่สวมใส่)`); continue; } delete x.nw; x.a = true; }
    for (const x of s.P[p].mg) if (x.on == null && x.a === false) x.a = true; // an Avatar on the Magic Zone that lent its POWER (สามัคคี from there) wakes with the rest
    for (const q of [0, 1]) for (const x of s.P[q].av) if (x.tn) { delete x.tn[p]; if (!Object.keys(x.tn).length) delete x.tn; } // "until our next Draw Phase" bonuses end
    // Rule Book (Draw Phase): up to 3 cards in hand, else 1; the very first turn of the player who starts draws 2
    const P = s.P[p]; const n = s.turn === 1 ? 2 : P.hand.length < 3 ? 3 - P.hand.length : 1;
    E.log(s, p, `เทิร์น ${s.turn} · ${P.name} จั่ว ${n} ใบ`);
    if (s.love && s.love.length) for (const lv of [...s.love]) { if (lv.seat !== p || --lv.n > 0) continue; s.love.splice(s.love.indexOf(lv), 1); const L = E.locate(s, lv.i); if (L && L.z === "hell") { delete L.x.hlock; E.moveTo(s, lv.i, "hand"); E.log(s, p, `${E.name(s, L.x)} กลับขึ้นมือ (หมอเลิฟ)`); } }
    const swap = fieldCards(s).find(({ x, L }) => L.p === p && !x.mute && (scriptOf(s, x) || {}).replacesDraw && (L.z !== "mg" || x.on != null));
    if (swap) s.trig.push({ id: tid(s), seat: p, i: swap.x.i, c: swap.x.c, when: "drawPhase", n }); // รูปปั้นพระอิศวร: scout instead of the normal draw
    else if (s.skipDraw && s.skipDraw[p] === s.turn) { E.log(s, p, "ไม่ได้จั่วการ์ดใน Draw Phase นี้ (1 - 2 - 2)"); }
    else { if (!E.draw(s, p, n)) return; for (const y of P.hand.slice(-n)) { const sc = scriptOf(s, y); if (sc && sc.drawn && (!sc.drawnOk || sc.drawnOk(E, s, y))) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "drawn" }); } } // (FAQ คุณบลูลอบสเตอร์: not a choice — it has to come down)
    for (const { x, L } of fieldCards(s)) { const sc = x.mute ? null : scriptOf(s, x); if (L.p === p && sc && sc.drawPhase && !sc.replacesDraw && (!sc.drawPhaseOk || sc.drawPhaseOk(E, s, x, L))) s.trig.push({ id: tid(s), seat: p, i: x.i, c: x.c, when: "drawPhase", optional: true }); }
    if (!swap && !(s.skipDraw && s.skipDraw[p] === s.turn)) { let k = 0; for (const { x, L } of fieldCards(s)) if (L.p === p && !x.mute && (L.z !== "mg" || E.mgActive(s, x, L))) { const dm = (scriptOf(s, x) || {}).drawMore; k += typeof dm === "function" ? dm(E, s, x, p, n) || 0 : dm || 0; } if (k) { E.log(s, p, `จั่วเพิ่ม ${k} ใบ (ความสามารถต่อเนื่อง)`); if (!E.draw(s, p, k)) return; } }
    if (s.turn <= 2) { const q = P.deck.find((y) => (scriptOf(s, y) || {}).firstDraw); if (q) s.trig.push({ id: tid(s), seat: p, i: q.i, c: q.c, when: "firstDraw", drawn: P.hand.slice(-n).map((y) => y.i), optional: true }); }
    // "ควบคุม … จนจบ Draw Phase ถัดไปของเจ้าของ": back to the owner now
    for (const q of [0, 1]) if (q !== p) for (const x of [...s.P[q].av]) if (x.backDraw === p) { s.P[q].av.splice(s.P[q].av.indexOf(x), 1); delete x.backDraw; s.P[p].av.push(x); E.log(s, p, `${E.name(s, x)} กลับไปอยู่กับเจ้าของ`); }
    s.phase = "main";
    if (s.later && s.later.length) { const now = s.later.filter((l) => l.seat === p && l.at !== "battle"); s.later = s.later.filter((l) => !now.includes(l)); for (const l of now) { E.log(s, p, l.why || "เอฟเฟกต์ที่รอ Main Phase นี้"); if (l.t) s.trig.push({ id: tid(s), ...l.t }); else E.ops(s, l.ops || [], p); } }
    for (const l0 of E.lands(s)) { const ls = l0.mute ? null : scriptOf(s, l0); const k = ls && ls.mainDraw ? ls.mainDraw(E, s, p) || 0 : 0; if (k > 0) { E.log(s, p, `จั่ว ${k} ใบก่อนเริ่ม Main Phase (${E.name(s, l0)})`); if (!E.draw(s, p, k)) return; } }
    { const k0 = s.trig.length; for (const { x, L } of fieldCards(s)) if (L.p === p && !x.mute && ((MAIN_RE.test(String(E.def(s, x).x || "")) && (!E.ext.trig || E.ext.trig(E.def(s, x).x, "mainStart"))) || (scriptOf(s, x) || {}).mainStart)) E.addTrig(s, p, x, "mainStart");
      const early = s.trig.slice(k0).filter((t) => (s.cards[t.c] && (scriptOf(s, { c: t.c }) || {}).early)); if (early.length) s.trig.splice(k0, s.trig.length - k0, ...early, ...s.trig.slice(k0).filter((t) => !early.includes(t))); } // "อัตโนมัติ เมื่อเริ่ม Main Phase เรา :" (Cost changers first)
  },
  wornHas(s, w, k) { return [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === w.i && !m.mute && (scriptOf(s, m) || {})[k]); },
  hostKill(s, p, w, dead, dp) { for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === w.i && !m.mute && (scriptOf(s, m) || {}).hostKill) s.trig.push({ id: tid(s), seat: p, i: m.i, c: m.c, when: "hostKill", dead: dead.i, dp }); },
  rishiOpp(s, p, d) { return s.active !== p && String(d.sy || "").includes("ฤษี") && s.P[p].av.some((y) => !y.mute && (scriptOf(s, y) || {}).rishiTime); },
  magicLocked(s, p, st) { return fieldCards(s).some(({ x: y, L: Ly }) => Ly.p !== p && Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).magicLock && scriptOf(s, y).magicLock(E, s, y, Ly, st)); },
  stateChanged(s, L) { for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p === L.p || Ly.z !== "av" || y.mute || s.active !== Ly.p) continue; const sc = scriptOf(s, y); if (sc && sc.foeState && once0(s, Ly.p, "foeState:" + y.i)) { (s.nu = s.nu || [{}, {}])[Ly.p]["foeState:" + y.i] = s.turn; s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "foeState" }); } } },
  hospital(s, p, x) { const h = s.hosp && s.hosp[p]; return !!(h && h.t === s.turn && h.names.includes(E.def(s, x).n)); },
  noSteal(s, L) { return fieldCards(s).some(({ x: y, L: Ly }) => { if (Ly.p !== L.p || y.mute) return false; const ns = (scriptOf(s, y) || {}).noSteal; return typeof ns === "function" ? !!ns(E, s, y, Ly) : !!ns; }); },
  forceEnd(s) { const p = s.active, P = s.P[p]; if (s.phase === "end" || s.phase === "over" || s.phase === "mull" || s.phase === "toss") return; s.phase = "end"; for (const q of [0, 1]) for (const x of s.P[q].av) x.tm = 0; E.log(s, p, `เทิร์นของ ${P.name} จบลงทันที`);
    if (P.hand.length > 7) { s.need = P.hand.length - 7; E.log(s, p, `มือเกิน 7 ใบ ต้องทิ้ง ${s.need} ใบ`); return; } E.nextTurn(s); },
  nextTurn(s) {
    s.need = 0; s.phase = "end";
    for (const { x, L } of fieldCards(s)) { const sc = scriptOf(s, x); if (sc && sc.endPhase) { const ops = sc.endPhase(E, s, x, L); if (ops.length) { E.log(s, L.p, `เอฟเฟกต์ End Phase: ${E.name(s, x)}`); E.ops(s, ops, L.p); } } }
    if (s.phase === "over") return;
    // printed "อัตโนมัติ ในช่วง End Phase (ของเรา) :" abilities become triggers resolved before the turn passes
    for (const { x, L } of fieldCards(s)) { if (x.mute || (scriptOf(s, x) || {}).endPhase) continue; const m = String(E.def(s, x).x || "").match(END_RE); if (m && (!m[1] || L.p === s.active) && (!E.ext.trig || E.ext.trig(E.def(s, x).x, "end"))) E.addTrig(s, L.p, x, "end"); }
    if (s.trig.length) { s.endWait = true; return; }
    E.finishTurn(s);
  },
  finishTurn(s) {
    for (const q of [0, 1]) for (const x of [...s.P[q].hand]) if (x.borrow && x.borrow.t <= s.turn) { s.P[q].hand.splice(s.P[q].hand.indexOf(x), 1); const back = x.borrow.from; delete x.borrow; s.P[back].hand.push(x); E.log(s, back, `${E.name(s, x)} กลับคืนสู่มือเจ้าของ`); }
    if (s.timers && s.timers.length) { const due = s.timers.filter((t) => t.turn <= s.turn); s.timers = s.timers.filter((t) => t.turn > s.turn); for (const t of due) { if (t.why) E.log(s, t.seat, t.why); E.ops(s, t.ops, t.seat); if (s.phase === "over") return; } }
    for (const q of [0, 1]) for (const x of [...s.P[q].av]) if (x.back != null) { const k = s.P[q].av.indexOf(x); s.P[q].av.splice(k, 1); const back = x.back; delete x.back; s.P[back].av.push(x); E.log(s, back, `${E.name(s, x)} กลับไปอยู่กับเจ้าของ`); }
    for (const q of [0, 1]) for (const x of s.P[q].av) if (x.kt) { x.kt = x.kt.filter((e) => e.end > s.turn); if (!x.kt.length) delete x.kt; }
    for (const q of [0, 1]) for (const x of s.P[q].av) { delete x.fm; if (x.guard === true || (typeof x.guard === "number" && x.guard <= s.turn)) delete x.guard; if (x.muteEnd != null && x.muteEnd <= s.turn) { delete x.mute; delete x.zero; delete x.muteEnd; } }
    if (s.phase === "over") return;
    E.startTurn(s, 1 - s.active);
  },
  addTrig(s, seat, x, when, extra = {}) {
    const d = E.def(s, x);
    if (!d.x || x.mute) return;
    { const sc = scriptOf(s, x); const ok = sc && sc[when + "Ok"]; if (ok && !ok(E, s, x)) return; } // a script may say its condition is not met (no empty "does nothing" step)
    if ((when === "summon" || when === "death") && ["A", "T"].includes(d.t) && E.odHas(s, 1 - seat, when)) { E.log(s, seat, `${d.n}: ${when === "summon" ? "จุติ" : "คำสั่งเสีย"} ไม่ทำงาน (Overdose)`); return; }
    s.trig.push({ id: tid(s), seat, i: x.i, c: x.c, when, ...extra });
    if (when === "death") E.openWindow(s, seat, "death", x.i); // แผนการ : ตอกฝาโลง
  },
  // move a card instance anywhere; handles leave-field cleanup
  moveTo(s, i, to, seatOverride) {
    const L = E.locate(s, i); if (!L) throw new RuleError("ไม่พบการ์ด");
    const x = L.x; if (["hell", "dark", "hand", "deck", "deckTop", "deckBottom"].includes(to) && to !== L.z) { delete x.used; delete x.ua; } // a new card there: its once-a-turn uses start again (FAQ บัมเบิ้ลแบงค์)
    if (L.z === "land") E.unLand(s, x); else s.P[L.p][L.z].splice(L.idx, 1);
    if (L.z === "av") for (const q of [0, 1]) { const att = s.P[q].mg.filter((m) => m.on === x.i); for (const m of att) { s.P[q].mg.splice(s.P[q].mg.indexOf(m), 1); delete m.on; m.hd = s.dying === x.i; if (!m.mute && (scriptOf(s, m) || {}).fallTo === "deck") { s.P[m.o].deck.push(m); E.shuffle(s, s.P[m.o].deck); E.log(s, m.o, `${E.name(s, m)} กลับเข้า Deck แทนการถูกทำลาย`); continue; } s.P[m.o].hell.push(m); E.log(s, m.o, `${E.name(s, m)} หลุดลงนรก (Avatar ที่สวมใส่ออกจากสนาม)`); E.fellToHell(s, m); } }
    if (L.z === "mg" && x.on) { const H = E.locate(s, x.on); if (H && H.x.muteBy === x.i) { delete H.x.mute; delete H.x.muteBy; } delete x.on; if (H && H.z === "av" && !x.mute && (scriptOf(s, x) || {}).leaveKillsHost) s.later2 = [...(s.later2 || []), H.x.i]; if (H && H.z === "av" && !x.mute && (scriptOf(s, x) || {}).leaveReturns && H.p !== H.x.o) { const P0 = s.P[H.x.o]; if (E.avatars(P0) < 4) { s.P[H.p].av.splice(s.P[H.p].av.indexOf(H.x), 1); P0.av.push(H.x); E.log(s, H.x.o, `${E.name(s, H.x)} กลับไปอยู่กับเจ้าของ`); } } }
    if (L.z === "av" && to !== "av") { if (x.ov && x.ov.t) delete x.ov; /* FAQ เครื่องบิน Super Air: off the Avatar Zone it is a Magic Card again */ for (const q of [0, 1]) for (const y of s.P[q].av) if (y.nwBy === x.i) { delete y.nw; delete y.nwBy; } const so = x.mute ? null : scriptOf(s, x); if (so && so.onLeave) s.trig.push({ id: tid(s), seat: L.p, i: x.i, c: x.c, when: "onLeave" }); }
    if (x.tok && to !== "av") { E.log(s, L.p, `Token ${E.name(s, x)} ถูกนำออกจากเกม`); return null; }
    x.a = true; x.pm = 0; x.tm = 0; for (const k of ["ntg", "backDraw", "ctlx", "home", "kw", "kt", "ua", "tn", "fm", "story", "mute", "zero", "muteEnd", "guard", "used", "saved", "exd", "canAtk", "back", "lk", "lkp", "cst", "nlt", "hs", "sb", "t0", "muteBy", "ind", "imm", "nsh", "cm", "ups", "blk", "fromHell", "noAct", "bp", "fd", "rimm", "own", "lh2", "kf", "frz", "kraken", "px", "feed", "ofa", "mustAtk", "sumt", "picky", "hs2", "tani", "twice", "twiceUsed", "sye", "nw", "nwBy", "nact", "mil", "kdm", "fa", "stay"]) delete x[k]; if (to !== "hand") delete x.hcm; if (to !== "hell") delete x.hlock; if (to !== "life") delete x.up; if (!["av", "mg", "cs", "land"].includes(to)) { delete x.nameAs; delete x.syAs; delete x.ov; delete x.srv; delete x.xn; delete x.xsy; delete x.mgo; }
    const owner = x.o; const ctl = seatOverride != null ? seatOverride : (L.z === "land" ? owner : L.p);
    const dest = { hand: owner, hell: owner, dark: owner, deckTop: owner, deckBottom: owner, life: seatOverride != null ? seatOverride : owner }[to];
    if (to === "deckTop") s.P[dest].deck.unshift(x);
    else if (to === "deckBottom") s.P[dest].deck.push(x);
    else if (to === "life") { x.up = false; s.P[dest].life.push(x); }
    else if (to === "land") E.placeLand(s, x);
    else if (["av", "mg", "cs"].includes(to)) s.P[ctl][to].push(x);
    else if (dest != null) s.P[dest][to].push(x);
    else throw new RuleError("โซนไม่ถูกต้อง");
    if (to === "hell") E.fellToHell(s, x);
    if (to === "land") x.t0 = s.turn;
    return x;
  },
  // "เมื่อการ์ดใบนี้ตกลงสู่นรก" (ตีแม่, ตีพ่อ …)
  // "เมื่อการ์ดใบนี้ตกลงสู่นรก" from anywhere (FAQ ตีพ่อ / ตีแม่: from the hand too): discarded, paid as GEM, milled
  anyHell(s, xs) { for (const x of xs || []) { const sc = scriptOf(s, x); if (sc && sc.anyHell && sc.toHell) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "toHell" }); } },
  fellToHell(s, x) { const sc = x.mute ? null : scriptOf(s, x); if (sc && sc.toHell) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "toHell" }); },
  // x may not be chosen as an attack target right now (its own rule or a protection that only covers attacks)
  hellCastOk(s, p, x) { const sc = x.mute ? null : scriptOf(s, x); return E.def(s, x).t === "M" && s.P[p].hell.includes(x) && !!(sc && sc.hellCast && sc.hellCast(E, s, p, x)); },
  // may attacker x of player p go for LIFE without เตะไข่: no Avatar of theirs that x may attack (FAQ แบงค์ ตัวแดง)
  lifeOpen(s, p, x) { return !s.P[1 - p].av.some((y) => !E.atkBy(s, y, x) && !E.atkSafe(s, y)); },
  atkBy(s, x, att) { const sc = x.mute ? null : scriptOf(s, x); return !!(sc && sc.noAtkBy && sc.noAtkBy(E, s, x, att)); },
  atkSafe(s, x) { if (E.untargetable(s, x)) return true; if (x.ntg != null && x.ntg >= s.turn) return true; { const Lx = E.locate(s, x.i); if (Lx && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === Lx.p && !y.mute && y.i !== x.i && (scriptOf(s, y) || {}).guardOthers && scriptOf(s, y).guardOthers(E, s, y, x))) return true; } const L = E.locate(s, x.i); const sc = L && !x.mute ? scriptOf(s, x) : null; return !!(sc && sc.noAtk && sc.noAtk(E, s, x, L)); },
  destroy(s, i, cause, opt = {}) {
    const L = E.locate(s, i); if (!L || !["av", "cs", "mg", "land"].includes(L.z)) return; // only a card on the table can be destroyed (a held destroy must not follow a card already sent to the hand)
    // cards of the same owner that stop or take this destruction instead (พันเรือง, อาจารย์ธรรมโชติ …): saveOther returns { why, ops } or null
    if (!opt.noSave && (s.saving || 0) < 3) { const fight = /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")); const P = s.P[L.p];
      for (const [z, list] of [["av", P.av], ["cs", P.cs], ["mg", P.mg], ["hand", P.hand], ["land", E.lands(s).filter((l) => l.o === L.p)]]) for (const y of list) {
        if (y.i === L.x.i || y.mute) continue; const sy = scriptOf(s, y); if (!sy || !sy.saveOther) continue; const r = sy.saveOther(E, s, y, { p: L.p, z }, L.x, L, { fight, cause, by: opt.by }); if (!r) continue;
        E.log(s, L.p, r.why); s.saving = (s.saving || 0) + 1; try { E.ops(s, r.ops || [], L.p); } finally { s.saving--; } if (!r.also) return; } }
    if (L.x.stay === s.turn) { delete L.x.stay; E.log(s, L.p, `${E.name(s, L.x)} ไม่ออกจากสนาม`); return; }
    if (L.x.guard) { delete L.x.guard; E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลาย (ได้รับการป้องกัน)`); return; }
    if (L.x.ind === s.turn) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายในเทิร์นนี้`); return; }
    if (L.x.fprot >= s.turn && /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายจากการต่อสู้ในเทิร์นนี้`); return; }
    if (s.pend && /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && (s.pend.att === L.x.i || s.pend.ti === L.x.i)) { const foe = E.locate(s, s.pend.att === L.x.i ? s.pend.ti : s.pend.att); const sc = L.x.mute ? null : scriptOf(s, L.x);
      if (foe && sc && sc.fightImmune && sc.fightImmune(E, s, L.x, foe.x)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายจากการต่อสู้นี้ (ความสามารถต่อเนื่อง)`); return; } }
    if (!/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && E.immuneNow(s, L.x)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่รับผลความสามารถของการ์ด`); return; }
    if (!/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && E.guarded(s, L.x, L, opt.by != null ? opt.by !== L.p : s.curSeat != null && s.curSeat !== L.p)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลาย (ความสามารถต่อเนื่อง)`); return; }
    if (!/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && fieldCards(s).some(({ x: y, L: Ly }) => y.i !== L.x.i && !y.mute && (scriptOf(s, y) || {}).shieldOthers && scriptOf(s, y).shieldOthers(E, s, y, Ly, L.x, L))) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายด้วยความสามารถของการ์ด (ความสามารถต่อเนื่อง)`); return; }
    if (!/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) { const own = L.x.mute ? null : scriptOf(s, L.x); if (own && own.noDestroy && own.noDestroy(E, s, L.x, L)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายด้วยความสามารถของการ์ด`); return; } }
    // "ไม่ถูกทำลายจากความสามารถของ Magic Card" (สว นาโนแมชชีน) · "… ด้วยผลของ Magic Card ถ้าอยู่ในสภาพตื่น" (worn: แกลลาติน)
    if (L.z === "av" && !/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && s.cur != null && s.cards[s.cur] && s.cards[s.cur].t === "M") { const own = L.x.mute ? null : scriptOf(s, L.x);
      const wg = L.x.a && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === L.x.i && !m.mute && (scriptOf(s, m) || {}).awakeMagicGuard);
      if ((own && own.noMagicDestroy) || wg) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายด้วยผลของ Magic`); return; } }
    // ประกันชั้นต่ำ: an attacked Avatar wearing it survives the fight once
    if (L.z === "av" && s.pend && s.pend.ti === L.x.i && /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) { const ins = s.P[L.p].mg.find((m) => m.on === L.x.i && (scriptOf(s, m) || {}).atkShield); if (ins) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลาย (${E.name(s, ins)})`); E.moveTo(s, ins.i, "hell"); return; } }
    if (L.z === "mg" && L.x.on != null) { const sc = L.x.mute ? null : scriptOf(s, L.x); if (sc && sc.wornDestroyed) { const host = L.x.on; E.moveTo(s, i, "hell"); E.log(s, L.p, `${E.name(s, L.x)} ถูกทำลาย${cause ? " (" + cause + ")" : ""}`); E.ops(s, sc.wornDestroyed(E, s, L.x, host) || [], L.p); return; } }
    if (L.z === "av") { const sh = [0, 1].flatMap((q) => s.P[q].mg).find((m) => m.on === L.x.i && (hk(s, m) || {}).shield);
      if (sh) { E.log(s, L.p, `${E.name(s, sh)} ถูกทำลายแทน ${E.name(s, L.x)}`); E.moveTo(s, sh.i, "hell"); return; } }
    { const sc = scriptOf(s, L.x); const fight = /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")); const fromOpp = opt.by != null ? opt.by !== L.p : fight;
      if (L.z === "av" && !/เซ่นไหว้|ค่าความสามารถ|ค่าใช้จ่าย/.test(String(cause || "")) && E.hostSaved(s, L.x, L, fromOpp, fight)) return;
      if (sc && !L.x.mute && sc.wouldDestroy && L.x.saved !== s.turn && sc.wouldDestroy(E, s, L.x, L, { fight, fromOpp, cause })) { L.x.saved = s.turn; return; } } // a card that lost its abilities cannot save itself
    const x = L.x; const tok = x.tok; const had = kwHas(E.def(s, x).x, "คำสั่งเสีย") || !!(!x.mute && (scriptOf(s, x) || {}).death);
    E.ev(s, { k: "destroy", i, p: L.p });
    // "เมื่อมี Avatar ใน Magic Zone ฝ่ายตรงข้ามถูกทำลาย" (อาดัส)
    if (L.z === "mg" && x.on == null && ["A", "T"].includes(E.def(s, x).t)) for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p === L.p || y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.foeMgDeath && once0(s, Ly.p, "foeMg:" + y.i)) { (s.nu = s.nu || [{}, {}])[Ly.p]["foeMg:" + y.i] = s.turn; s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "foeMgDeath" }); } }
    if (x.exd) { s.dying = i; try { E.moveTo(s, i, "dark"); } finally { delete s.dying; } E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย แล้วถูกเนรเทศ (คำสั่งเสีย : เนรเทศการ์ดใบนี้)`); if (had && !tok && x.nd !== s.turn) E.addTrig(s, x.o, x, "death"); delete x.nd; if (L.z === "av") E.died(s, L.p, x, cause, opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))); return; }
    const dTo = L.z === "av" && !x.mute && (scriptOf(s, x) || {}).destroyTo;
    // a destroyed Avatar that goes back into the Deck instead of hell — its own rule (อาม่อน No.7) or the one that beat it in a fight
    // (เลอติ๊ก, FAQ): it never reaches hell, so its คำสั่งเสีย does not work
    { const fight = /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")); const K = fight && s.pend && L.z === "av" && (s.pend.att === x.i || s.pend.ti === x.i) ? E.locate(s, s.pend.att === x.i ? s.pend.ti : s.pend.att) : null;
      const kTo = K && !K.x.mute && (scriptOf(s, K.x) || {}).killTo; const to = dTo === "deckBottom" ? "deckBottom" : kTo || null;
      if (to) { s.dying = i; try { E.moveTo(s, i, "deckBottom"); } finally { delete s.dying; } if (to === "deck") E.shuffle(s, s.P[x.o].deck); delete x.nd;
        E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย${cause ? " (" + cause + ")" : ""} · ${to === "deck" ? "กลับเข้า Deck" : "กลับเข้าใต้ Deck"} แทนการลงนรก${kTo ? ` (${E.name(s, K.x)})` : ""}`); E.died(s, L.p, x, cause, opt.by != null ? opt.by !== L.p : fight); return; } }
    const mgo0 = x.mgo; s.dying = i; try { E.moveTo(s, i, "hell"); } finally { delete s.dying; } // worn cards see that their Avatar was destroyed (วูตาตู)
    E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย${cause ? " (" + cause + ")" : ""}`);
    if (mgo0 && L.z === "av" && E.locate(s, i)?.z === "hell" && ((opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) || (s.cur != null && String((s.cards[s.cur] || {}).n || "").includes("มะม่วง")))) { E.moveTo(s, i, "mg", L.p); E.log(s, L.p, `${E.name(s, x)} ไปวางไว้บน Magic Zone`); }
    if (had && !tok && x.nd !== s.turn) E.addTrig(s, x.o, x, "death", { fromOpp: opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")), src: s.cur, z: L.z }); delete x.nd;
    if (L.z === "av") E.died(s, L.p, x, cause, opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")));
  },
  // an Avatar of player p was destroyed: "เมื่อ Avatar … ฝ่ายเราถูกทำลาย" abilities fire and p may answer with a React
  died(s, p, x, cause, fromOpp) {
    if (s.cur != null && s.curSeat != null && s.curSeat !== p && s.cards[s.cur] && !/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) { s.kills = s.kills || [{}, {}]; const n = s.cards[s.cur].n; s.kills[s.curSeat][n] = (s.kills[s.curSeat][n] || 0) + 1; }
    s.dc = s.dc && s.dc.t === s.turn ? s.dc : { t: s.turn, n: [0, 0], f: [0, 0] }; s.dc.n[p]++; if (/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) s.dc.f = [(s.dc.f || [0, 0])[0] + (p === 0 ? 1 : 0), (s.dc.f || [0, 0])[1] + (p === 1 ? 1 : 0)];
    for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p || y.i === x.i || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.allyDeath && (!sc.allyOk || sc.allyOk(E, s, y, Ly, x))) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "allyDeath", dead: x.i }); }
    for (const y of s.P[p].hand) { const sc = scriptOf(s, y); if (sc && sc.handDeath && (!sc.handDeathOk || sc.handDeathOk(E, s, y, x, !!fromOpp))) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "handDeath", dead: x.i, optional: true }); }
    const on = { kind: "destroyed", by: 1 - p, i: x.i, p, fight: /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")), opp: !!fromOpp, nth: s.dc.n[p] };
    if (!s.rw && s.phase !== "over" && E.reactsFor(s, p, on).length) s.rw = on;
  },
  gemOf(s, p, x, targetDef) { const d = E.def(s, x); const g = d.g || 0; { const own = x.mute ? null : scriptOf(s, x); if (own && own.gemFor && targetDef) { const v = own.gemFor(targetDef, E, s, x, p); if (v != null) return v; } } const sc = E.landSc(s, "powerGem");
    if (sc && sc.powerGem && targetDef && targetDef.t === "A" && String(targetDef.sy || "").includes(sc.powerGem) && d.t === "A" && String(d.sy || "").includes(sc.powerGem)) return Math.max(g, d.pw || 0); return g; },
  // the GEM an effect reads (not a payment): a Gem change with no target card counts in every zone (สัตว์ทดลอง: Gem 8 with 10+ Avatar names in hell)
  gemNow(s, x) { const own = x.mute ? null : scriptOf(s, x); if (own && own.gemFor) { const v = own.gemFor(null, E, s, x, x.o); if (v != null) return v; } return E.def(s, x).g || 0; },
  colorless(s, x, targetDef) { const own = x.mute ? null : scriptOf(s, x); if (own && own.selfColorless && own.selfColorless(E, s, x, targetDef)) return true; if (fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === x.o && !y.mute && (scriptOf(s, y) || {}).colorlessOther && scriptOf(s, y).colorlessOther(E, s, y, x, targetDef))) return true; const sc = E.landSc(s, "colorlessGem"); return !!(sc && sc.colorlessGem(E, s, x)); }, // สภาแบงค์ · สัตว์ทดลอง
  canPay(s, p, targetDef, pay, costOverride) {
    const P = s.P[p]; const cost = costOverride != null ? costOverride : targetDef.c || 0; let total = 0; const seen = new Set();
    for (const i of pay) {
      if (seen.has(i)) return { ok: false, err: "เลือกซ้ำ" }; seen.add(i);
      const x = P.hand.find((y) => y.i === i); if (!x) return { ok: false, err: "การ์ดจ่ายต้องอยู่บนมือ" };
      const d = E.def(s, x); const g = E.gemOf(s, p, x, targetDef);
      if (g <= 0) return { ok: false, err: `${d.n} มี GEM 0 ใช้จ่ายไม่ได้` };
      if (s.ban && s.ban[p].includes(d.n)) return { ok: false, err: `${d.n} ใช้เป็น Cost ไม่ได้ (ผลของการ์ดที่ใช้ไปแล้ว)` };
      if (d.gc && targetDef.co && d.gc !== targetDef.co && !(traits(targetDef) || {}).anyColor && !E.colorless(s, x, targetDef)) return { ok: false, err: `GEM สี${d.gc} จ่ายให้การ์ดสี${targetDef.co} ไม่ได้` };
      { const sc = hk(s, x); if (sc && sc.payOnly && !sc.payOnly(targetDef)) return { ok: false, err: `${d.n} ใช้จ่ายได้เฉพาะการ์ดที่กำหนดเท่านั้น` }; }
      total += g;
    }
    { const ts = scriptOfDef(targetDef); if (ts && ts.payEach) { const bad = pay.some((i) => !ts.payEach(E.gemOf(s, p, P.hand.find((y) => y.i === i), targetDef))); if (bad || pay.length !== ts.payN) return { ok: false, err: ts.payErr || "จ่าย Cost ไม่ตรงเงื่อนไขของการ์ด", total }; return { ok: true, total, exact: true }; } }
    if (total < cost) return { ok: false, err: `GEM ไม่พอ (${total}/${cost})`, total };
    if (total !== cost && E.landSc(s, "exactGem")) return { ok: false, err: `ต้องจ่าย GEM ให้พอดีกับ Cost (${total}/${cost}) · หมู่บ้านพอดี`, total };
    for (const i of pay) { if (total - E.gemOf(s, p, P.hand.find((y) => y.i === i), targetDef) >= cost) return { ok: false, err: "จ่ายเกินจำเป็น (GEM พอแล้วจ่ายเพิ่มไม่ได้)", total }; }
    return { ok: true, total, exact: total === cost };
  },
  autoPay(s, p, i, costOverride, exclude = []) {
    const P = s.P[p]; const tgt = P.hand.find((x) => x.i === i); if (!tgt) return null;
    const td = E.def(s, tgt); const cost = costOverride != null ? costOverride : E.costOf(s, p, tgt); if (cost === 0) return [];
    const el = P.hand.filter((x) => x.i !== i && !exclude.includes(x.i)).filter((x) => { const d = E.def(s, x); const sc = hk(s, x); return E.gemOf(s, p, x, td) > 0 && !(x.borrow && false) && !(s.ban && s.ban[p].includes(d.n)) && !(d.gc && td.co && d.gc !== td.co && !(traits(td) || {}).anyColor) && !(sc && sc.payOnly && !sc.payOnly(td)); }).slice(0, 12);
    // what each card is worth keeping: Avatars by POWER and Cost, a React held for the other side's turn a little more
    // than a plain Magic, and a Modification one of our Avatars can wear now more again (more still when its card's
    // script says what it is worth there, e.g. หยินหยางทอร์นาโด on ตั๊กแตนหยิน), so combo pieces are not paid away first
    const val = (x) => { const d = E.def(s, x); { const sk = scriptOf(s, x); if (sk && sk.keepV) { const v = sk.keepV(E, s, x, p); if (v != null) return v; } } /* a card whose script says what it is worth in hand right now (the จอมเวทย์ kit) */ if ((scriptOf(s, x) || {}).anyHell) return 9; /* ตีพ่อ / ตีแม่: into the hell they turn up our LIFE */ if (d.t === "A") return (d.pw || 0) + (d.c || 0) * 0.6 + (d.o1 ? 20 : 0); if (d.t === "C") return 4;
      if (d.st === "R") return 2.8;
      if (d.st === "D") { let b = 0; try { const sc = scriptOf(s, x); for (const h of P.av) if (E.modOk(s, x, h)) b = Math.max(b, 1.2 + (sc && sc.modV ? Math.max(0, Math.min(4, sc.modV(E, s, x, h) || 0)) : 0)); } catch { b = 0; } return 2.2 + b; }
      return 2.2; };
    const V = new Map(el.map((x) => [x.i, val(x)]));
    let best = null;
    for (let m = 1; m < 1 << el.length; m++) {
      const pick = el.filter((_, k) => m & (1 << k)); const r = E.canPay(s, p, td, pick.map((x) => x.i), cost);
      if (!r.ok) continue;
      const score = pick.reduce((a, x) => a + V.get(x.i), 0) + pick.length * 0.4;
      if (!best || score < best.score) best = { score, pay: pick.map((x) => x.i) };
    }
    return best ? best.pay : null;
  },
  // the abilities of player p's cards waiting at the front of the queue that came up together and may go in any order
  // (not the rest of an effect already under way, not LIFE cards: those go from the top card down, Rule Book)
  ownRun(s, p) { const out = []; const b = s.trig.length ? s.trig[0].b : null; for (const t of s.trig) { if (t.seat !== p || t.b !== b || b == null || t.held || t.part || t.tail || t.manualRest || t.now || t.via || ["trim", "life", "handReact", "answer"].includes(t.when)) break; out.push(t); } return out; },
  canAct(s, p) { return s.phase !== "over" && !s.trig.length && !s.pend && !s.rw && s.active === p && s.phase !== "mull" && s.phase !== "toss"; },
  // which React cards in p's hand fit this moment (on = the window: summon / cast / attack)
  reactsFor(s, p, on) {
    if (s.phase === "over") return [];
    const handAv = s.P[p].hand.filter((x) => { const sc = scriptOf(s, x); return !!sc && typeof sc.handReact === "function" && !!sc.react && E.def(s, x).t === "A" && sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)); });
    // (the attacker's own window in a fight: only the Reacts written for our own fighting Avatar)
    if (on.own) return E.reactsFor0(s, p, on).filter((x) => { const sc = scriptOf(s, x); return sc ? !!(sc.react && sc.react.own) : !!E.ext.react && E.ext.react(s, x, p, on) === true; });
    return [...E.reactsFor0(s, p, on), ...handAv];
  },
  // does this scripted React answer the moment `on`? ("phase": the end of the opponent's Phase, for the ones that name no moment)
  rkOk(sc, on) { return sc.react.kinds.includes(on.kind) || (on.kind === "phase" && !!sc.react.anytime); },
  reactsFor0(s, p, on) { if (s.noR && s.noR.t === s.turn && s.noR.p === p) return []; if (E.magicLocked(s, p, "R")) return []; if (s.mu[p].R) return s.P[p].hand.filter((x) => { const sc = scriptOf(s, x); if (sc && sc.react && sc.react.ignoreLimit && !s.mu[p].R2) return E.rkOk(sc, on) && (!sc.react.can || sc.react.can(E, s, p, on, x));
      if (!E.skillExtra(s, p, x)) return false; if (sc && sc.react) return E.rkOk(sc, on) && (!sc.react.can || sc.react.can(E, s, p, on, x)) && (!sc.canCast || sc.canCast(E, s, p)); if (!sc && E.ext.react) return E.ext.react(s, x, p, on) === true; return false; });
    if (s.pend && s.pend.nr && s.pend.by !== p) return []; // "ฝ่ายตรงข้ามไม่สามารถสั่งใช้งาน React Magic จนจบการต่อสู้"
    return s.P[p].hand.filter((x) => { const d = E.def(s, x); const sc = scriptOf(s, x); if (d.t === "M" && E.rishiOpp(s, p, d) && (d.st === "N" || (d.st === "R" && ["attack", "activate", "cast"].includes(on.kind)))) return !(sc && sc.canCast && !sc.canCast(E, s, p)); if (d.t !== "M" || (d.st !== "R" && !(d.st === "N" && sc && sc.asReact && s.active !== p && sc.asReact(E, s, p)))) return false;
      if (sc && sc.react) return E.rkOk(sc, on) && (!sc.react.can || sc.react.can(E, s, p, on, x)) && (!sc.canCast || sc.canCast(E, s, p));
      if (on.kind === "phase") return false; // (unscripted Reacts keep to the moments their text names)
      if (!sc && E.ext.react) { const r = E.ext.react(s, x, p, on); if (r != null) return r; } // timing read from the card text
      return !s.P[p].bot && !(sc && sc.canCast && !sc.canCast(E, s, p)); });
  },
  // after a summon or a Magic, the other player may answer with a React before effects resolve
  openWindow(s, p, kind, i, extra) { const q = 1 - p; const on = { kind, by: p, i, ...(extra || {}) }; if (E.reactsFor(s, q, on).length) s.rw = on; },

  // s.na counts the actions; every ability that comes up during one is marked with it (t.b), so "at the same time" can be told
  apply(s, act, p) { E.sync(s); s.na = (s.na || 0) + 1; try { return E.act0(s, act, p); } finally { E.runHeld(s); E.sync(s); E.odPrune(s); E.hfPrune(s); E.deckOut(s); for (const t of s.trig) if (t.b == null) t.b = s.na; } },
  // a hand ability offered for a fight (เมย์ แวมไพร์โกธิค) is offered one card at a time: once one has been used, the others waiting are
  // checked again and dropped when their condition no longer holds (FAQ เมย์: the second finds a เมย์ already in the dark dimension)
  hfPrune(s) { if (!s.trig.some((t) => t.when === "handFight")) return; s.trig = s.trig.filter((t) => { if (t.when !== "handFight" || t.held) return true; const L = E.locate(s, t.i), F = t.fighter != null ? E.locate(s, t.fighter) : null; const sc = L && L.z === "hand" ? scriptOf(s, L.x) : null; return !!(sc && sc.handFightOk && F && F.z === "av" && sc.handFightOk(E, s, L.x, F.x)); }); },
  // Rule Book (Win Condition 2): a player whose Deck reaches 0 cards loses at once, not only when a draw finds it empty;
  // both Decks empty at the same time is a draw
  deckOut(s) { if (s.phase === "over" || s.phase === "mull" || s.phase === "toss") return; const out = [0, 1].filter((p) => !s.P[p].deck.length); if (!out.length) return;
    if (out.length === 1) return E.lose(s, out[0], "การ์ดใน Deck หมด (เหลือ 0 ใบ)");
    s.winner = null; s.phase = "over"; s.reason = "การ์ดใน Deck ของทั้งสองฝ่ายหมดพร้อมกัน"; s.pend = null; s.trig = []; s.rw = null; E.log(s, null, `เสมอ · ${s.reason}`); E.ev(s, { k: "over", w: null }); },
  // an effect held back so the other player could answer "when an Avatar would be destroyed / leave the field" runs once that window closes
  runHeld(s) { let g = 0; while (s.phase !== "over" && !s.rw && s.trig.length && s.trig[0].held && g++ < 10) { const t = s.trig[0]; E.act0(s, { type: "trig", id: t.id }, t.seat); } },
  // which of the other player's Avatars / Constructs these ops would destroy or move off the field; a window only if they hold an answer for it
  doomFor(s, ops, p) { const q = 1 - p; const kill = [], killCs = [], leave = [];
    for (const o of ops || []) { if (!o || o.i == null || typeof o.i !== "number") continue; const L = E.locate(s, o.i); if (!L || L.p !== q || (L.z !== "av" && L.z !== "cs")) continue;
      // "destroyed if its POWER is 0" (คาถา ปลดอาวุสสิวะ): about to be destroyed only when the POWER these ops leave it with is 0
      if (o.op === "destroy" && o.ifPower0 && E.power(s, L.x) + ops.filter((y) => y && y.op === "power" && y.i === o.i).reduce((a, y) => a + (y.n || 0), 0) > 0) continue;
      if (o.op === "destroy") (L.z === "av" ? kill : killCs).push(o.i); else if (L.z === "av" && ((o.op === "move" && o.to !== "av") || o.op === "exile")) leave.push(o.i); }
    return E.doomWin(s, { kind: "doom", by: p, p: q, kill: [...new Set(kill)], killCs: [...new Set(killCs)], leave: [...new Set(leave)], fight: false }); },
  // an attack ability that takes from the defender's hand (เจค: สุ่มทิ้ง) waits while the defender may still answer the attack with a React (FAQ)
  // เหน็บกินมือ: an Avatar or Magic ability of ours is about to take a card from our Deck into our hand: the opponent may React first (and cancel the whole ability)
  deckHandWin(s, t, ops, p) { if (s.phase === "over") return null; const sd = s.cards[t.via || t.c]; if (!sd || !["A", "T", "M"].includes(sd.t)) return null;
    const P = s.P[p]; if (E.deckHandBlocked(s, p, sd)) return null; let hit = null;
    for (const o of ops || []) { if (!o || hit) continue; const seat = o.seat === 0 || o.seat === 1 ? o.seat : p; if (seat !== p && o.op !== "move") continue;
      if (o.op === "move" && o.to === "hand") { const L = E.locate(s, o.i); if (L && L.z === "deck" && L.p === p) hit = { i: o.i }; }
      else if (o.op === "search" && o.to !== "av") { const q = String(o.name || ""); const x = o.take != null ? P.deck.find((y) => y.i === o.take) : P.deck.find((y) => (q || o.names || o.symbol || o.type || o.maxCost != null) && matchCard(E.def(s, y), o)); if (x) hit = { i: x.i }; }
      else if (o.op === "scout" && o.to !== "av") { const top = P.deck.slice(0, Math.max(0, o.n | 0)); const x = o.take != null ? top.find((y) => y.i === o.take) : o.none ? null : top.find((y) => matchCard(E.def(s, y), o)); if (x) hit = { i: x.i }; }
      else if (o.op === "randomPick" && (o.ids || []).some((i) => P.deck.some((y) => y.i === i))) hit = { i: null };
      // drawing with an ability is taking cards from the Deck too (FAQ ลานเซลอต: a blue knight means a draw, so it can be answered · มือเปรี๊ยะ: "ยกเว้นการจั่วใน Draw Phase")
      // — but not a draw picked while the effect resolves (FAQ พรของอิศวร: the React had to come when the card was used)
      else if (o.op === "draw" && !o.late && (o.n | 0) > 0 && P.deck.length) hit = { i: null }; }
    if (!hit) return null; const on = { kind: "handed", by: p, i: hit.i, pre: true, src: t.i, tid: t.id };
    return E.reactsFor(s, 1 - p, on).length ? on : null; },
  handWin(s, t, ops, p) { const q = 1 - p, pd = s.pend; if (!pd || pd.by !== p || !["attack", "hostAttack"].includes(t.when) || !s.P[q].hand.length || s.phase === "over") return null;
    const inHand = (i) => typeof i === "number" && s.P[q].hand.some((y) => y.i === i);
    const hits = (ops || []).some((o) => o && ((["discardRandom", "exileRandom", "handToDeck", "handToTop", "randomHand", "discard"].includes(o.op) && o.seat === q) || (o.op === "borrow" && o.seat !== q) || o.op === "pilfer" || (["move", "exile"].includes(o.op) && inHand(o.i))));
    if (!hits) return null; const on = { kind: "attack", by: p, att: pd.att, tk: pd.tk, ti: pd.ti, p: q, hand: true, src: t.i, ids: [], kill: [], killCs: [], leave: [] };
    return E.reactsFor(s, q, on).length ? on : null; },
  doomWin(s, on) { on.ids = [...new Set([...on.kill, ...on.killCs, ...on.leave])]; if (!on.ids.length || s.phase === "over") return null; on.i = on.ids[0];
    return E.reactsFor(s, on.p, on).some((x) => { const sc = scriptOf(s, x); return !!(sc && sc.react && sc.react.kinds.includes("doom")); }) ? on : null; },
  // before a fight is resolved: whoever is about to lose an Avatar / Construct in it may answer first
  fightDoom(s) { const pd = s.pend; if (!pd || (pd.tk !== "av" && pd.tk !== "cs")) return false; const A = E.locate(s, pd.att), T = E.locate(s, pd.ti); if (!A || A.z !== "av" || !T || T.z !== pd.tk) return false;
    const ap = Math.max(0, E.power(s, A.x) + (pd.bonus || 0) + (pd.tk === "av" ? E.battleMod(s, A.x, T.x) : 0)), tp = Math.max(0, E.power(s, T.x) + (pd.tk === "av" ? E.battleMod(s, T.x, A.x) : 0));
    let dead = []; if (pd.tk === "cs") dead = ap > tp ? [T] : []; else if (ap > tp) dead = [T]; else if (tp > ap) dead = [A]; else if (ap > 0) { const ah = E.kw(s, A.x, "ลูกฮึด"), dh = E.kw(s, T.x, "ลูกฮึด"); dead = ah && !dh ? [T] : dh && !ah ? [A] : [A, T]; }
    pd.doomAsked = pd.doomAsked || [false, false];
    for (const q of [1 - pd.by, pd.by]) { if (pd.doomAsked[q]) continue; const mine = dead.filter((D) => D.p === q); if (!mine.length) continue; pd.doomAsked[q] = true;
      const on = E.doomWin(s, { kind: "doom", by: 1 - q, p: q, kill: mine.filter((D) => D.z === "av").map((D) => D.x.i), killCs: mine.filter((D) => D.z === "cs").map((D) => D.x.i), leave: [], fight: true });
      if (on) { s.rw = on; E.log(s, q, `${mine.map((D) => E.name(s, D.x)).join(", ")} กำลังจะถูกทำลายจากการต่อสู้`); return true; } }
    return false; },
  act0(s, act, p) {
    if (s.phase === "over" && act.type !== "note") throw new RuleError("เกมจบแล้ว");
    const P = s.P[p], O = s.P[1 - p];
    const need = (cond, msg) => { if (!cond) throw new RuleError(msg); };
    if (s.phase === "toss") need(["tossVote", "tossRoll", "tossPick", "concede", "note"].includes(act.type), "ต้องตัดสินก่อนว่าใครได้เลือกเริ่มก่อนหรือทีหลัง");
    switch (act.type) {
      case "tossVote": { const t = s.toss; const TH = { dice: "ทอยเต๋า", coin: "โยนเหรียญ" };
        need(s.phase === "toss" && t && t.m == null && t.vote[p] == null, "เลือกไปแล้ว"); need(TH[act.m], "เลือกได้แค่ทอยเต๋าหรือโยนเหรียญ"); t.vote[p] = act.m;
        if (t.vote[0] && t.vote[1]) { const [a, b] = t.vote; t.split = a !== b; t.m = a === b ? a : E.rnd(s) < 0.5 ? a : b;
          E.log(s, null, a === b ? `ทั้งสองฝ่ายเลือก${TH[a]}` : `เลือกไม่ตรงกัน (${s.P[0].name}: ${TH[a]} · ${s.P[1].name}: ${TH[b]}) ระบบสุ่มได้: ${TH[t.m]}`);
          if (t.m === "coin") { t.win = E.rnd(s) < 0.5 ? 0 : 1; E.log(s, null, `โยนเหรียญ: ออกหน้า ${s.P[t.win].name} · ${s.P[t.win].name} ได้เลือกว่าจะเริ่มก่อนหรือทีหลัง`); } }
        return; }
      case "tossRoll": { const t = s.toss; need(s.phase === "toss" && t && t.m === "dice" && t.win == null && t.roll[p] == null, "ทอยไปแล้ว");
        t.roll[p] = 1 + Math.floor(E.rnd(s) * 6); E.log(s, p, `${P.name} ทอยเต๋าได้ ${t.roll[p]}`);
        if (t.roll[0] != null && t.roll[1] != null) { if (t.roll[0] === t.roll[1]) { t.tie = t.roll.slice(); t.roll = [null, null]; t.n = (t.n || 0) + 1; E.log(s, null, "แต้มเท่ากัน ทอยใหม่ทั้งสองฝ่าย"); }
          else { t.win = t.roll[0] > t.roll[1] ? 0 : 1; E.log(s, null, `${s.P[t.win].name} แต้มมากกว่า ได้เลือกว่าจะเริ่มก่อนหรือทีหลัง`); } }
        return; }
      case "tossPick": { const t = s.toss; need(s.phase === "toss" && t && t.win === p, "ผู้ชนะการเสี่ยงเป็นคนเลือก"); const f = act.first ? p : 1 - p;
        t.pick = act.first ? "first" : "second"; s.first = s.active = f; s.phase = "mull"; E.log(s, p, `${P.name} เลือก${act.first ? "เริ่มก่อน" : "เริ่มทีหลัง"}`); E.log(s, null, `เริ่มเกม · ${s.P[f].name} เริ่มก่อน`);
        return; }
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
        need(!x.borrow, "การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญเท่านั้น");
        if (act.type === "summon") need(!E.locked(s, p, x) && !E.hospital(s, p, x), "อัญเชิญการ์ดใบนี้ไม่ได้ในเทิร์นนี้ (ผลของการ์ดที่ใช้ไปแล้ว)");
        { const sc = hk(s, x); need(!(sc && sc.noHand), "การ์ดใบนี้ลงสนามจากบนมือไม่ได้"); if (act.type === "summon") need(!(sc && sc.uniq && P.av.some((y) => E.name(s, y) === d.n)), `ควบคุม ${d.n} บน Avatar Zone ได้เพียง 1 ใบ`); }
        if (act.type === "summon") { need(d.t === "A", "อัญเชิญได้เฉพาะ Avatar"); need(E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, p, x), "Avatar Zone เต็ม (Avatar 4 / รวม Token 6)"); }
        else { need(d.t === "C", "ก่อสร้างได้เฉพาะ Construct"); need(P.cs.length < 3, "Construct Zone เต็ม (3 ใบ)"); need((hk(s, x) || {}).multiCs || !P.cs.some((y) => E.name(s, y) === d.n), "Construct ชื่อซ้ำในฝ่ายเดียวกันไม่ได้"); }
        const r = E.canPay(s, p, d, act.pay || [], cost); need(r.ok, r.err);
        if (via) { P.hand.splice(P.hand.indexOf(via), 1); P.hell.push(via); s.lock = s.lock || [null, null]; s.lock[p] = "dragon"; E.log(s, p, `ทิ้ง ${E.name(s, via)} เพื่ออัญเชิญมังกรแบบจุติ (Cost -6) · จากนี้อัญเชิญได้เฉพาะมังกร`); }
        const paid = [];
        for (const i of act.pay || []) { const k = P.hand.findIndex((y) => y.i === i); const y = P.hand.splice(k, 1)[0]; P.hell.push(y); paid.push(y); } E.anyHell(s, paid);
        { const full = E.costOf(s, p, x, true); const red = Math.min(full, full - cost + (via ? 6 : 0)); if (red > 0 && !via) { const hg = E.hellGem(s, p, x).list.sort((a, b) => (E.def(s, b).g || 0) - (E.def(s, a).g || 0)); let got = 0; for (const z of hg) { if (got >= red) break; got += E.def(s, z).g || 0; E.moveTo(s, z.i, "dark"); E.log(s, p, `เนรเทศ ${E.name(s, z)} จากนรก เพื่อใช้ GEM เป็น Cost`); } } }
        P.hand.splice(P.hand.indexOf(x), 1); x.a = true; (act.type === "summon" ? P.av : P.cs).push(x);
        E.ev(s, { k: "summon", i: x.i, p });
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        E.log(s, p, `${act.type === "summon" ? "อัญเชิญ" : "ก่อสร้าง"} ${d.n} (จ่าย ${(act.pay || []).length} ใบ GEM ${r.total || 0}/${cost})${r.exact && kwHas(d.x, "พอดี") ? " · พอดี!" : ""}`);
        const scS = scriptOf(s, x); if (r.exact) x.px = true; const kS = s.trig.length; if (act.type === "summon") E.noteSummon(s, p, x);
        if (scS && scS.summon) { if (!scS.storyOnly || x.story) E.addTrig(s, p, x, "summon", { exact: r.exact }); }
        else if (kwHas(d.x, "จุติ")) E.addTrig(s, p, x, "summon", { exact: r.exact });
        else if (act.type === "build" && d.x && fires(s, x, "build")) E.addTrig(s, p, x, "build"); // only Constructs with a "when built" ability
        // the summoned Avatar's own จุติ comes before "เมื่อมีการอัญเชิญ Avatar" of the cards already there (FAQ แมวนิค: it is still ours when the จุติ is checked)
        { const tail = s.trig.splice(kS); s.trig.push(...tail.filter((t) => t.when !== "anySummon"), ...tail.filter((t) => t.when === "anySummon")); }
        { const pt = paid.filter((y) => { const sc = scriptOf(s, y); return sc ? sc.paid && (!sc.paidFor || sc.paidFor(d)) : act.type === "summon" && E.ext.paid && E.ext.paid(s, y, d); }).map((y) => ({ id: tid(s), seat: p, i: y.i, c: y.c, when: "paid", for: x.c, forI: x.i }));
          const k = s.trig.findIndex((t) => t.i === x.i); s.trig.splice(k < 0 ? s.trig.length : k, 0, ...pt); } // paying happens before จุติ
        if (act.type === "summon") { E.summonBuff(s, p, x); E.openWindow(s, p, "summon", x.i); }
        return;
      }
      case "cast": {
        const x = P.hand.find((y) => y.i === act.i) || (act.from === "hell" ? P.hell.find((y) => y.i === act.i && E.hellCastOk(s, p, y)) : null); need(x, act.from === "hell" ? "การ์ดใบนี้ใช้จากนรกไม่ได้" : "การ์ดไม่อยู่บนมือ");
        { const d0 = E.def(s, x); const sh = scriptOf(s, x); if (d0.t === "A" && sh && typeof sh.handReact === "function") { // an Avatar ability used from the hand as an answer
          const on = s.rw && s.rw.by !== p ? { ...s.rw } : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
          need(on && sh.react && sh.react.kinds.includes(on.kind) && (!sh.react.can || sh.react.can(E, s, p, on, x)), "ยังไม่ถึงจังหวะของความสามารถนี้");
          if (s.rw) s.rw = null; s.trig.unshift({ id: tid(s), seat: p, i: x.i, c: x.c, when: "handReact", on }); E.log(s, p, `ใช้ความสามารถจากบนมือของ ${d0.n}`); return; } }
        const d = E.def(s, x); need(d.t === "M", "ใช้ได้เฉพาะ Magic"); const sc0 = scriptOf(s, x); const st = d.st === "N" && ((s.active !== p || (s.phase === "battle" && sc0 && sc0.asReactBattle)) && sc0 && sc0.asReact && sc0.asReact(E, s, p) || E.rishiOpp(s, p, d)) ? "R" : d.st; // เพ้อเจ้อ: a Normal Magic used as a React
        need(!x.borrow, "การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญเท่านั้น");
        need(s.phase !== "mull" && (!s.mu[p][st] || E.extraMagic(s, p, x)), `Magic ประเภท ${SUB_TH[st]} ใช้ไปแล้วเทิร์นนี้`);
        if (st === "D") need(!E.modBlocked(s, p, x), "เทิร์นนี้ใช้ได้เฉพาะ Modification ที่การ์ดกำหนด");
        { const sc = scriptOf(s, x); need(!(sc && sc.canCast && !sc.canCast(E, s, p)), "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้");
          if (!sc && E.ext.canCast) need(E.ext.canCast(s, x, p) !== false, "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้"); }
        need(!E.magicLocked(s, p, st), "ใช้ Magic ประเภทนี้ไม่ได้ในตอนนี้ (ความสามารถต่อเนื่องของฝ่ายตรงข้าม)");
        if (st !== "R") need(E.canAct(s, p) && s.phase === "main", `${SUB_TH[st]} Magic ใช้ได้เฉพาะ Main Phase ของคุณ`);
        let on = null;
        if (st === "R") {
          on = s.rw && s.rw.by !== p ? { ...s.rw } : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
          const sc = scriptOf(s, x); if (E.rishiOpp(s, p, d) && on && (d.st === "N" || ["attack", "activate", "cast"].includes(on.kind))) { /* ฤๅษี ภฤคุ: usable now */ } else if (sc && sc.react && !on && sc.react.anytime) need(E.canAct(s, p) && ["main", "battle"].includes(s.phase) && !s.trig.length && (!sc.react.can || sc.react.can(E, s, p, null, x)), "ใช้ React ใบนี้ตอนนี้ไม่ได้");
          else if (sc && sc.react) need(on && (!on.own || sc.react.own) && E.rkOk(sc, on) && (!sc.react.can || sc.react.can(E, s, p, on, x)), "ยังไม่ถึงจังหวะของ React ใบนี้");
          else if (!sc && E.ext.react) need(!!on && E.ext.react(s, x, p, on, true) !== false && E.reactsFor0(s, p, on).includes(x), "ยังไม่ถึงจังหวะของ React ใบนี้");
        }
        if (st === "R" && s.mu[p].R) { const scx = scriptOf(s, x); if (scx && scx.react && scx.react.ignoreLimit && !s.mu[p].R2) s.mu[p].R2 = true; else s.mu[p].RS = (+s.mu[p].RS || 0) + 1; } // a React allowed after another one (อย่าให้มีครั้งที่ 2 / an extra "Skill")
        if (st === "R" && /^Skill\b/.test(String(d.n || ""))) { s.skillUsed = s.skillUsed || [null, null]; const u = s.skillUsed[p] && s.skillUsed[p].t === s.turn ? s.skillUsed[p] : { t: s.turn, n: [] }; u.n.push(d.n); s.skillUsed[p] = u; }
        if (st === "D" && s.mu[p].D && E.extraMagic(s, p, x)) s.two[p].used = true;
        if (st === "N" && s.mu[p].N && s.xN && s.xN[p] && s.xN[p].t === s.turn && !fieldCards(s).some(({ x: y, L }) => L.p === p && !y.mute && (scriptOf(s, y) || {}).freeMagic && scriptOf(s, y).freeMagic(E, s, x))) s.xN[p].used = true;
        s.mu[p][st] = true; { const Z = P.hand.includes(x) ? P.hand : P.hell; Z.splice(Z.indexOf(x), 1); if (Z === P.hell) E.log(s, p, `ใช้ ${E.name(s, x)} จากนรก`); }
        if (s.active === p) for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p) continue; const sy = scriptOf(s, y); if (sy && sy.onMagic) { const ops = sy.onMagic(E, s, y, Ly); if (ops && ops.length) E.ops(s, ops, p); } }
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.magicSeen && (!sy.magicSeenOk || sy.magicSeenOk(E, s, y, Ly, d, p))) s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "magicSeen", by: p, mi: x.i }); }
        for (const y of s.P[1 - p].hand) { const sh = scriptOf(s, y); if (sh && sh.handMagic && (!sh.handMagicOk || sh.handMagicOk(E, s, y, d))) s.trig.push({ id: tid(s), seat: 1 - p, i: y.i, c: y.c, when: "handMagic", optional: true }); }
        if (s.neko) for (const q of [0, 1]) { const nk = s.neko[q]; if (nk && nk.until >= s.turn && nk.st === st) E.op(s, { op: "draw", seat: q, n: 1 }, q); }
        if (st === "D" && act.on == null && (scriptOf(s, x) || {}).castFree) { P.mg.push(x); E.log(s, p, `ใช้ Modification Magic ${d.n}`); E.ev(s, { k: "cast", i: x.i, p, st: "D" }); E.addTrig(s, p, x, "cast", { toHell: true }); }
        else if (st === "D") {
          const host = E.locate(s, act.on); need(host && host.z === "av", "ต้องเลือก Avatar บนสนามเพื่อสวมใส่");
          need(E.modOk(s, x, host.x), "สวมใส่ให้ Avatar ใบนี้ไม่ได้ (ไม่ตรงเงื่อนไขของการ์ด)");
          x.on = act.on; P.mg.push(x); E.log(s, p, `สวมใส่ ${d.n} ให้ ${E.name(s, host.x)}`); E.ev(s, { k: "cast", i: x.i, p, st: "D", on: act.on });
          { const sc = scriptOf(s, x); if (sc ? !!sc.cast : !E.ext.modCast || E.ext.modCast(d.x)) E.addTrig(s, p, x, "cast", { on: act.on }); }
          E.gotMod(s, host.x, x);
        } else if (st === "L") { { const why = E.landPlayBlocked(s, p); need(!why, why); }
          E.placeLand(s, x); x.t0 = s.turn; E.log(s, p, `ใช้ Land Magic ${d.n}`); if (!(scriptOf(s, x) && !scriptOf(s, x).cast)) E.addTrig(s, p, x, "cast"); E.ev(s, { k: "cast", i: x.i, p, st: "L" });
        } else {
          P.mg.push(x); E.log(s, p, `ใช้ ${SUB_TH[st]} Magic ${d.n}`); E.ev(s, { k: "cast", i: x.i, p, st: st });
          if (d.x) E.addTrig(s, p, x, "cast", { toHell: true }); else { P.mg.splice(P.mg.indexOf(x), 1); P.hell.push(x); }
          if (st === "R") { const k = s.trig.findIndex((t) => t.i === x.i); if (k > 0) { const [t] = s.trig.splice(k, 1); s.trig.unshift(t); } if (k >= 0) s.trig[0].on = on; s.rw = null; E.openWindow(s, p, "react", x.i); }
        }
        if (st !== "R") E.openWindow(s, p, "cast", x.i);
        return;
      }
      case "pass": { need(s.rw && s.rw.by !== p, "ไม่มีจังหวะให้ตอบโต้"); E.log(s, p, `${P.name} ไม่ตอบโต้`); const then = s.rw.then; s.rw = null; if (s.pend && s.pend.go && !s.trig.length) { delete s.pend.go; E.startFight(s); }
        if (then === "end" && E.canAct(s, s.active)) return E.act0(s, { type: "end", go: true }, s.active); // the turn goes on to its End Phase
        return; }
      case "battle": {
        need(E.canAct(s, p) && s.phase === "main", "ไปเฟสต่อสู้ได้จาก Main Phase");
        if (s.turn === 1) { E.log(s, p, "เทิร์นแรกของผู้เริ่มก่อนไม่มี Battle Phase"); return E.apply(s, { type: "end" }, p); }
        s.phase = "battle"; E.log(s, p, "เข้าสู่ Battle Phase"); E.ev(s, { k: "battle", p }); E.openWindow(s, p, "battle", null);
        for (const y of P.av) { const sb = y.mute ? null : scriptOf(s, y); if (sb && sb.battleStart) sb.battleStart(E, s, y); } // "ถ้า … ในช่วงเริ่ม Battle Phase"
        for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p === p || y.mute) continue; const so = scriptOf(s, y); if (so && so.oppBattleStart && (!so.oppBattleStartOk || so.oppBattleStartOk(E, s, y, Ly))) s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "oppBattleStart" }); }
        if (s.later && s.later.length) { const now = s.later.filter((l) => l.seat === p && l.at === "battle" && l.after < s.turn); s.later = s.later.filter((l) => !now.includes(l)); for (const l of now) { E.log(s, p, l.why || "เอฟเฟกต์ที่รอ Battle Phase นี้"); if (l.t) s.trig.push({ id: tid(s), ...l.t }); else E.ops(s, l.ops || [], p); } }
        return;
      }
      case "attack": {
        need(E.canAct(s, p) && s.phase === "battle", "โจมตีได้เฉพาะ Battle Phase ของคุณ");
        const x = P.av.find((y) => y.i === act.i); need(x && x.a, "ต้องเป็น Avatar ที่ตื่นอยู่บน Avatar Zone"); need(x.noAct !== s.turn && x.frz !== s.turn && !E.hospital(s, p, x), "เทิร์นนี้ Avatar ใบนี้สั่งโจมตีไม่ได้");
        need(!(E.oneAttack(s) && s.atk && s.atk.t === s.turn && s.atk.n >= 1), "เทิร์นนี้สั่งโจมตีได้แค่ 1 ครั้ง (Land Magic บนสนาม)");
        need(!E.atkLocked(s, p, x), "เทิร์นนี้สั่งโจมตีได้เฉพาะ Avatar ที่การ์ดกำหนด");
        { const sc = x.mute ? null : hk(s, x); need(!(sc && sc.noAttack && sc.noAttack(E, s, x)) && !E.wornNoAtk(s, x), "Avatar ใบนี้โจมตีไม่ได้"); }
        { const tn = E.taunts(s, 1 - p); if (tn.length) need(act.tk === "av" && tn.some((y) => y.i === act.ti), `ต้องโจมตี ${E.name(s, tn[0])} เท่านั้น (ความสามารถต่อเนื่องของการ์ดใบนั้น)`); }
        if (act.tk === "av") { need(O.av.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Avatar Zone ฝ่ายตรงข้าม"); need(!E.atkSafe(s, E.locate(s, act.ti).x) && !E.atkBy(s, E.locate(s, act.ti).x, x), "Avatar ใบนี้ถูกโจมตีไม่ได้ตอนนี้"); }
        else if (act.tk === "cs") { need(O.cs.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Construct Zone"); need(!E.atkSafe(s, E.locate(s, act.ti).x), "Construct ใบนี้ถูกโจมตีไม่ได้"); }
        else if (act.tk === "life") { need(E.lifeOpen(s, p, x) || E.kw(s, x, "เตะไข่"), "ฝ่ายตรงข้ามยังมี Avatar อยู่ (ยกเว้นเตะไข่)"); need(!E.noLife(s, x), "Avatar ใบนี้โจมตี LIFE ไม่ได้ตอนนี้ (เงื่อนไขบนการ์ด)"); }
        else throw new RuleError("เป้าหมายไม่ถูกต้อง");
        if (x.picky === s.turn && act.tk === "av") { const opts = O.av.filter((y) => !E.atkSafe(s, y) && !E.atkBy(s, y, x)); const ap = E.power(s, x); const pick = opts.filter((y) => E.power(s, y) >= ap).sort((a, b) => E.power(s, b) - E.power(s, a))[0] || opts.sort((a, b) => (E.def(s, a).c || 0) - (E.def(s, b).c || 0))[0]; if (pick && pick.i !== act.ti) { act = { ...act, ti: pick.i }; E.log(s, 1 - p, `${O.name} เลือกเป้าหมายการโจมตีเอง: ${E.name(s, pick)}`); } }
        let bonus = 0; const sup = [], bs = [], stab = [];
        for (const i of act.sup || []) {
          const y = E.helpPool(s, p).find((z) => z.i === i); const hp = y ? E.helpOf(s, p, x, y) : null; if (!hp) continue;
          bonus += hp.n; y.a = false; sup.push(i); if (hp.k === "u") E.helped(s, p, x, y);
          if (hp.k === "b") { bs.push({ i, n: E.name(s, y), co: E.colors(s, y) }); const sy = y.mute ? null : scriptOf(s, y); if (sy && sy.stab && (!sy.stabOk || sy.stabOk(E, s, y, x))) stab.push(y); }
        }
        x.a = false; E.slept(s, p, [x, ...sup.map((i) => [...P.av, ...P.mg].find((z) => z.i === i)).filter(Boolean)]);
        s.pend = { att: x.i, tk: act.tk, ti: act.ti || null, bonus, sup, by: p, ...(bs.length ? { bs } : {}) };
        s.atk = s.atk && s.atk.t === s.turn ? { t: s.turn, n: s.atk.n + 1, ids: [...new Set([...(s.atk.ids || []), x.i])] } : { t: s.turn, n: 1, ids: [x.i] };
        for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.onDeclare) { const ops = sy.onDeclare(E, s, y, Ly, p) || []; if (ops.length) { E.log(s, Ly.p, `เอฟเฟกต์ ${E.name(s, y)}`); E.ops(s, ops, Ly.p); } } }
        for (const y of stab) s.trig.push({ id: tid(s), seat: p, i: y.i, c: y.c, when: "stab" });
        E.ev(s, { k: "declare", att: x.i, by: p, tk: act.tk, ti: act.ti || null });
        const tName = act.tk === "life" ? "LIFE" : E.name(s, E.locate(s, act.ti).x);
        E.log(s, p, `${E.name(s, x)} (POWER ${E.power(s, x) + bonus}) โจมตี ${tName}${sup.length ? ` · ผู้ช่วย ${sup.length} ใบ +${bonus}` : ""}`);
        {
          for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostAttack) s.trig.push({ id: tid(s), seat: p, i: m.i, c: m.c, when: "hostAttack" });
          if (fires(s, x, "attack", /เมื่อ\s*(?:Avatar\s*|การ์ด)?(?:ใบนี้|ตัวนี้)?\s*(?:ประกาศ)?โจมตี|เมื่อโจมตี/)) E.addTrig(s, p, x, "attack"); }
        for (const l0 of E.lands(s)) { const ls = l0.mute ? null : scriptOf(s, l0); if (ls && ls.landAtkOps) { const ops = ls.landAtkOps(E, s, x, p) || []; if (ops.length) E.ops(s, ops, p); } }
        for (const l0 of E.lands(s)) { const ls = l0.mute ? null : scriptOf(s, l0); const n = ls && ls.landAttack ? ls.landAttack(E, s, x) || 0 : 0; if (n) { x.fm = (x.fm || 0) + n; E.log(s, p, `${E.name(s, x)} POWER +${n} จนจบการต่อสู้ (${E.name(s, l0)})`); } }
        if (x.feed === s.turn) { E.log(s, 1 - p, `${E.name(s, x)} โจมตี: ${s.P[1 - p].name} จั่วการ์ด 1 ใบ`); E.draw(s, 1 - p, 1); }
        for (const y of P.av) { if (y.i === x.i || y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.allyAttack) { x.tm = (x.tm || 0) + 1; E.log(s, p, `${E.name(s, x)} POWER +1 (${E.name(s, y)})`); } }
        if (s.kbo && s.kbo.t === s.turn && s.kbo.p === p && s.pend && (E.named(s, x, "เพมมุ") || E.named(s, x, "สไปรท์"))) s.pend.nr = true;
        return;
      }
      case "answer": { // an ability usable when the opponent attacks (from the hand or the field)
        need(s.pend && s.pend.by === 1 - p && !s.trig.length, "ยังไม่ถึงจังหวะ"); const L = E.actLoc(s, act.i, p); need(L && L.p === p, "ไม่พบการ์ดของคุณ"); const sc = scriptOf(s, L.x);
        need(sc && sc.answer && sc.answer.can(E, s, L.x, L) && L.x.ans !== s.turn, "ใช้ความสามารถนี้ตอนนี้ไม่ได้"); L.x.ans = s.turn;
        s.trig.push({ id: tid(s), seat: p, i: L.x.i, c: L.x.c, when: "answer" }); E.log(s, p, `ใช้ความสามารถของ ${E.name(s, L.x)}`); return; }
      case "respond": {
        need(s.pend && s.pend.by === 1 - p && !s.trig.length, "ยังไม่ถึงจังหวะตอบโต้");
        if (s.pend.must && !act.shield) need(!E.shields(s, p).length, "ต้องใช้โล่มนุษย์ (ความสามารถของผู้โจมตี)");
        if (act.shield) {
          need(E.shields(s, p).some((y) => y.i === act.shield), "ใช้โล่มนุษย์กับการโจมตีนี้ไม่ได้");
          // โล่มนุษย์: an awake Avatar with the keyword goes to sleep and becomes the target instead
          const y = P.av.find((z) => z.i === act.shield); need(y && E.kw(s, y, "โล่มนุษย์") && y.i !== s.pend.ti, "ต้องเป็น Avatar ที่มีโล่มนุษย์");
          need(y.a, "โล่มนุษย์ใช้ได้เฉพาะ Avatar ที่อยู่ในสภาพตื่น");
          y.a = false; s.pend.tk = "av"; s.pend.ti = y.i; E.log(s, p, `${E.name(s, y)} ใช้โล่มนุษย์ เปลี่ยนเป็นสภาพนอนแล้วรับการโจมตีแทน`); E.stateChanged(s, E.locate(s, y.i)); /* FAQ ตั๋งโต๊ะ: going to sleep for โล่มนุษย์ is a change of state */
          { const sy2 = y.mute ? null : scriptOf(s, y); if (sy2 && sy2.onShield) E.ops(s, sy2.onShield(E, s, y) || [], p); } E.helperUsed(s, p, y);
          if (E.retargeted(s)) { s.pend.go = true; return; } // the fight waits for those effects
        }
        // Rule Book (React Magic): "ใช้ใน Phase ไหนก็ได้ เทิร์นเรา และ เทิร์นอีกฝ่าย ถ้าเงื่อนไขของการ์ดครบ": a React about our own
        // fighting Avatar (กาจอก, คาถา โปเตกโต้ …) is the attacker's to use too. Once the defender has answered (the
        // target is final), the attacker is asked once; the fight starts when that window closes
        if (!s.pend.own) { s.pend.own = true; const on = { kind: "attack", by: p, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti, own: true };
          if (E.reactsFor(s, s.pend.by, on).length) { s.rw = on; s.pend.go = true; return; } }
        E.startFight(s); return;
      }
      case "end": {
        need(E.canAct(s, p) && (s.phase === "main" || s.phase === "battle"), "จบเทิร์นได้เฉพาะเทิร์นของคุณ");
        if (s.phase === "battle") { const m = E.mustAttack(s, p); need(!m.length, `${E.name(s, m[0] || {})} ต้องโจมตีก่อน (ความสามารถของการ์ดที่สวมใส่)`); }
        // Rule Book (React Magic): "ในช่วงของก่อนการเปลี่ยน Phase ของฝ่ายตรงข้าม" a React that names no moment may be played — once, as the turn heads to its End Phase
        if (!act.go && s.phEnd !== s.turn) { s.phEnd = s.turn; const on = { kind: "phase", by: p, ph: s.phase }; if (E.reactsFor(s, 1 - p, on).length) { s.rw = { ...on, then: "end" }; E.log(s, p, `${P.name} กำลังจะจบ ${s.phase === "battle" ? "Battle" : "Main"} Phase · ฝ่ายตรงข้ามใช้ React ได้ก่อน`); return; } }
        s.phase = "end";
        for (const q of [0, 1]) for (const x of s.P[q].av) x.tm = 0;
        if (P.hand.length > 7) { s.need = P.hand.length - 7; E.log(s, p, `มือเกิน 7 ใบ ต้องทิ้ง ${s.need} ใบ`); return; }
        E.log(s, p, `${P.name} จบเทิร์น`); E.nextTurn(s); return;
      }
      case "discard": {
        need(s.phase === "end" && s.active === p && s.need > 0, "ยังไม่ต้องทิ้งการ์ด");
        need((act.iids || []).length === s.need, `ต้องทิ้ง ${s.need} ใบพอดี`);
        for (const i of act.iids) { const k = P.hand.findIndex((x) => x.i === i); need(k >= 0, "การ์ดไม่อยู่บนมือ"); const x = P.hand.splice(k, 1)[0]; P.hell.push(x); E.anyHell(s, [x]); }
        E.log(s, p, `ทิ้งการ์ด ${act.iids.length} ใบลงนรก`); E.nextTurn(s); return;
      }
      case "trigFirst": { // Rule Book: abilities of our own cards that come up together — we choose which one goes first
        need(!s.rw, "รอฝ่ายตรงข้ามตอบโต้ก่อน"); const run = E.ownRun(s, p); const t = run.find((x) => x.id === act.id); need(t && run.length > 1, "เลือกลำดับความสามารถนี้ไม่ได้");
        s.trig.splice(s.trig.indexOf(t), 1); s.trig.unshift(t); E.log(s, p, `${P.name} ให้ความสามารถของ ${(s.cards[t.c] || {}).n || "การ์ด"} ทำงานก่อน`); return;
      }
      case "trig": {
        const k = s.trig.findIndex((t) => t.id === act.id); need(k >= 0, "เอฟเฟกต์นี้จบไปแล้ว");
        const t = s.trig[k]; need(t.seat === p, "ไม่ใช่เอฟเฟกต์ของคุณ"); need(!(t.held && s.rw), "รอฝ่ายตรงข้ามตอบโต้ก่อน");
        s.trig.splice(k, 1);
        const nm = s.cards[t.c] ? s.cards[t.c].n : "การ์ด";
        // FAQ อุบัติเหตุ: a card that lost all its abilities before its own waiting ability resolved (จุติ, อัตโนมัติ, สั่งใช้) does nothing
        { const S0 = !t.via && ["summon", "attack", "attacked", "fight", "activate", "kill", "win", "survived", "summonedBy"].includes(t.when) ? E.locate(s, t.i) : null;
          if (S0 && S0.x.mute && ["av", "mg", "cs"].includes(S0.z) && S0.x.c === t.c) { E.log(s, p, `${nm} สูญเสียความสามารถแล้ว ความสามารถนั้นจึงไม่ทำงาน`); return; } }
        if (act.skip && !t.held) E.log(s, p, `ข้ามเอฟเฟกต์ ${nm}`);
        else { let ops0 = t.held ? t.hops : act.ops || []; const ex0 = t.held ? t.hex : act.explain;
          // a Magic whose effect ลูเซเน่ uses after exiling it stays exiled: it cannot put itself on the field (FAQ: no เครื่องบิน Super Air, no Magic Zone)
          if (t.via && (E.locate(s, t.i) || {}).z === "dark") ops0 = ops0.filter((o) => !(o && o.i === t.i && ["move", "put", "attach", "toLand", "payPut"].includes(o.op)));
          if (!t.held) { const doom = E.doomFor(s, ops0, p); if (doom) { s.trig.splice(k, 0, { ...t, held: true, hops: ops0, hex: ex0 }); s.rw = doom; E.log(s, doom.p, `${doom.ids.map((i) => E.name(s, E.locate(s, i).x)).join(", ")} กำลังจะ${doom.kill.length || doom.killCs.length ? "ถูกทำลาย" : "ออกจากสนาม"} (${nm})`); return; }
            const hw = E.handWin(s, t, ops0, p); if (hw) { s.trig.splice(k, 0, { ...t, held: true, hops: ops0, hex: ex0 }); s.rw = hw; E.log(s, hw.p, `${s.P[hw.p].name} ใช้ React ตอบโต้ได้ก่อนที่ความสามารถของ ${nm} จะทำงาน`); return; }
            const dw = E.deckHandWin(s, t, ops0, p); if (dw) { s.trig.splice(k, 0, { ...t, held: true, hops: ops0, hex: ex0 }); s.rw = dw; E.log(s, 1 - p, `${nm} กำลังจะนำการ์ดจาก Deck ขึ้นมือ · ${s.P[1 - p].name} ใช้ React ได้ก่อน`); return; } }
          if (ex0) { E.log(s, p, `เอฟเฟกต์ ${nm}: ${ex0}`); E.ev(s, { k: "fx", c: t.c, p, t: String(ex0).replace(/^อ่านอัตโนมัติ: /, "").slice(0, 180) }); } const ap = t.as === 0 || t.as === 1 ? t.as : p; /* (a choice the other player makes for our card: the effect is still ours) */ s.cur = t.via || t.c; s.curI = t.via ? t.viaI : t.i; s.curSeat = ap; if (t.now) s.lifeNow = t.now; try { E.ops(s, ops0, ap); } finally { delete s.cur; delete s.curI; delete s.curSeat; delete s.lifeNow; } }
        if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg" && L.x.on == null && !(scriptOf(s, L.x) || {}).stay) { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } } // บลัดดี้แมรี่ stays
        if (s.pend && !s.trig.length && s.pend.resolved) s.pend = null;
        if (s.pend && !s.trig.length && s.pend.go) { delete s.pend.go; E.startFight(s); }
        if (s.endWait && !s.trig.length && s.phase === "end") { delete s.endWait; E.finishTurn(s); }
        if (s.endNow && !s.trig.length && !s.rw && s.phase !== "over") { delete s.endNow; if (s.pend) E.endFight(s, true); E.forceEnd(s); }
        return;
      }
      case "activate": { // scripted once-per-turn ability on the field
        const L = E.actLoc(s, act.i, p); need(L && L.p === p, "ไม่พบการ์ดของคุณ"); const sc = scriptOf(s, L.x);
        need(E.canAct(s, p) && (s.phase === "main" || (s.phase === "battle" && sc && sc.activate && sc.activate.battle)), "สั่งใช้ตอนนี้ไม่ได้");
        if (act.k === "kraken") { // FAQ คราเค่น: the Avatar sent to its controller's Magic Zone may come back for two cards from hand — used by that controller only
          need(L.z === "mg" && E.krakenCan(s, p, L.x), "ใช้ความสามารถนี้ไม่ได้ตอนนี้"); s.trig.push({ id: tid(s), seat: p, i: L.x.i, c: L.x.c, when: "activate", k: "kraken" }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)} (จาก Magic Zone)`); E.openWindow(s, p, "activate", L.x.i, { off: L.z }); return;
        }
        if (act.k != null) { // an ability read from the card text (see effects.js)
          need(s.phase === "main" && E.ext.acts && E.ext.acts(s, L.x, L).some((a) => a.k === act.k), "ใช้ความสามารถนี้ไม่ได้ตอนนี้"); need(!E.actBlocked(s, p, L.x), "เทิร์นนี้ใช้ความสามารถของการ์ดใบนี้ไม่ได้");
          (L.x.ua = L.x.ua || {})[act.k] = s.turn; s.trig.push({ id: tid(s), seat: p, i: L.x.i, c: L.x.c, when: "activate", k: act.k }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)}`); if (L.z === "av") E.abilitySeen(s, p, L.x); if (L.z === "av") E.openWindow(s, p, "activate", L.x.i); else if (["A", "T"].includes(E.def(s, L.x).t)) E.openWindow(s, p, "activate", L.x.i, { off: L.z }); return;
        }
        need(sc && sc.activate && sc.activate.can(E, s, L.x, L), "ใช้ความสามารถนี้ไม่ได้ตอนนี้"); need(sc.activate.multi || L.x.used !== s.turn, "ใช้ไปแล้วในเทิร์นนี้"); need(L.x.noAct !== s.turn && !L.x.nact && !E.actBlocked(s, p, L.x) && !E.actOnly(s, p, L.x, L) && !E.hospital(s, p, L.x), "เทิร์นนี้ใช้ความสามารถของการ์ดใบนี้ไม่ได้");
        if (!sc.activate.multi) L.x.used = s.turn; s.trig.push({ id: tid(s), seat: p, i: L.x.i, c: L.x.c, when: "activate" }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)}`); E.abilitySeen(s, p, L.x); if (L.z === "av") E.openWindow(s, p, "activate", L.x.i); else if (["A", "T"].includes(E.def(s, L.x).t)) E.openWindow(s, p, "activate", L.x.i, { off: L.z }); return;
      }
      case "concede": { E.lose(s, p, `${P.name} ยอมแพ้`); return; }
      case "note": { E.log(s, p, String(act.text || "").slice(0, 200)); return; }
      default: throw new RuleError("คำสั่งไม่รู้จัก");
    }
  },
  // the fight begins: "เมื่อ Avatar ใบนี้ต่อสู้" abilities of both Avatars resolve first, then POWER is compared
  startFight(s) { const pd = s.pend; if (!pd) return;
    // Rule Book (ช่วงโจมตี ขั้นที่ 3): "when attacked / made the target" abilities work once the target is confirmed — after the
    // defender's โล่มนุษย์, so a shield that steps in is the one they fire for
    if (!pd.at) { pd.at = true; const T0 = pd.tk === "av" && pd.ti != null ? E.locate(s, pd.ti) : null; if (T0 && T0.z === "av" && fires(s, T0.x, "attacked", ATTACKED_RE)) { E.addTrig(s, T0.p, T0.x, "attacked"); pd.go = true; return; } }
    if (!pd.ft && pd.tk !== "life") { pd.ft = true; let n = 0; const A = E.locate(s, pd.att); const T = pd.ti != null ? E.locate(s, pd.ti) : null;
      if (A && A.z === "av" && T && (T.z === "av" || T.z === "cs")) { if (fires(s, A.x, "fight")) { E.addTrig(s, A.p, A.x, "fight"); n++; } if (T.z === "av" && fires(s, T.x, "fight")) { E.addTrig(s, T.p, T.x, "fight"); n++; }
        if (T.z === "av") for (const [H, F] of [[A, T], [T, A]]) for (const m of [...s.P[0].mg, ...s.P[1].mg]) { if (m.on !== H.x.i || m.mute) continue; const sc = scriptOf(s, m); if (sc && sc.hostFight && (!sc.hostFightOk || sc.hostFightOk(E, s, m, H.x, F.x))) { s.trig.push({ id: tid(s), seat: H.p, i: m.i, c: m.c, when: "hostFight", foe: F.x.i }); n++; } } }
      if (T.z === "av") for (const F of [A, T]) for (const y of s.P[F.p].hand) { const sc = scriptOf(s, y); if (sc && sc.handFight && sc.handFightOk && sc.handFightOk(E, s, y, F.x)) { s.trig.push({ id: tid(s), seat: F.p, i: y.i, c: y.c, when: "handFight", fighter: F.x.i, optional: true }); n++; } }
      if (n) { pd.go = true; return; } }
    if ((pd.tk === "av" || pd.tk === "cs") && E.fightDoom(s)) { pd.go = true; return; }
    E.resolveAttack(s);
  },
  resolveAttack(s) {
    const pd = s.pend; const A = s.P[pd.by], D = s.P[1 - pd.by];
    const L = E.locate(s, pd.att);
    if (!L || L.z !== "av") { E.log(s, pd.by, "ผู้โจมตีออกจากสนาม การโจมตีสิ้นสุด"); E.endFight(s); return; }
    const att = L.x; const tgt0 = pd.tk === "av" ? (E.locate(s, pd.ti) || {}).x : null;
    const ap = Math.max(0, E.power(s, att) + (pd.bonus || 0) + (tgt0 ? E.battleMod(s, att, tgt0) : 0));
    E.ev(s, { k: "clash", att: att.i, by: pd.by, tk: pd.tk, ti: pd.ti, ap });
    if (pd.tk === "life") {
      if (ap <= 0) E.log(s, pd.by, "POWER 0 โจมตีแต่ไม่ทำความเสียหาย");
      else if (pd.noDmg) E.log(s, pd.by, "การโจมตีครั้งนี้ไม่ทำความเสียหาย LIFE");
      else { const sa = att.mute ? null : scriptOf(s, att); const hits = Math.max(1, (sa && sa.lifeHits && sa.lifeHits(E, s, att)) || 1); const quiet = !!(sa && sa.lifeQuiet && sa.lifeQuiet(E, s, att)) || !!(s.sorry && s.sorry.t === s.turn && s.sorry.p === pd.by && s.P[pd.by].av.some((y) => !y.mute && (scriptOf(s, y) || {}).apology));
        for (let j = 0; j < hits && s.phase !== "over"; j++) E.damageLife(s, 1 - pd.by, pd.by, { quiet });
        if (sa && sa.lifeHit && (!sa.lifeHitOk || sa.lifeHitOk(E, s, att)) && s.phase !== "over") s.trig.push({ id: tid(s), seat: pd.by, i: att.i, c: att.c, when: "lifeHit" }); }
    } else {
      const T = E.locate(s, pd.ti); const k0 = s.trig.length;
      if (!T || (pd.tk === "av" && T.z !== "av") || (pd.tk === "cs" && T.z !== "cs")) { E.log(s, pd.by, "เป้าหมายหายไป การโจมตีสิ้นสุด"); E.endFight(s); return; }
      const tp = Math.max(0, E.power(s, T.x) + (pd.tk === "av" ? E.battleMod(s, T.x, att) : 0));
      const side = pd.tk === "av" && att.fa === s.turn ? D.av.filter((y) => y.i !== T.x.i).map((y) => ({ y, py: Math.max(0, E.power(s, y) + E.battleMod(s, y, att)) })) : []; if (side.length) E.log(s, pd.by, `${E.name(s, att)} ต่อสู้กับ Avatar ฝ่ายตรงข้ามทุกใบพร้อมกัน`);
      if (pd.tk === "cs") {
        if (ap > tp) E.destroy(s, T.x.i, `แพ้พลัง ${ap} ต่อ ${tp}`); else E.log(s, pd.by, `Construct ${E.name(s, T.x)} รับไว้ได้ (${ap} ต่อ ${tp})`);
      } else if (ap === 0 && tp === 0) E.log(s, pd.by, "POWER 0 ปะทะ 0 ไม่มีอะไรเกิดขึ้น");
      else if (ap > tp) { const dead = T.x; if (E.wornHas(s, att, "killNoDeath")) dead.nd = s.turn; E.destroy(s, T.x.i, `แพ้การต่อสู้ ${tp} ต่อ ${ap}`); if (!E.locate(s, dead.i)?.z?.startsWith("av")) E.hostKill(s, pd.by, att, dead, tp); if (fires(s, att, "win", WIN_RE) && !E.locate(s, dead.i)?.z?.startsWith("av")) s.trig.push({ id: tid(s), seat: pd.by, i: att.i, c: att.c, when: "win", diff: ap - tp, dead: dead.i });
        if (!E.locate(s, dead.i)?.z?.startsWith("av")) E.wonFight(s, pd.by, att);
        if (!att.mute && (scriptOf(s, att) || {}).kill && !E.locate(s, dead.i)?.z?.startsWith("av")) s.trig.push({ id: tid(s), seat: pd.by, i: att.i, c: att.c, when: "kill", dead: dead.i });
        // cards worn by the winner that react to it ("เมื่อ Avatar ที่สวมใส่การ์ดนี้ทำลาย Avatar อีกฝ่ายจากการต่อสู้")
        if (E.locate(s, att.i) && !E.locate(s, dead.i)?.z?.startsWith("av")) for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === att.i && (scriptOf(s, m) || {}).hostWin) s.trig.push({ id: tid(s), seat: pd.by, i: m.i, c: m.c, when: "hostWin", optional: true, dead: dead.i, dp: tp, ap }); }
      else if (tp > ap) { if (E.wornHas(s, T.x, "killNoDeath")) att.nd = s.turn; E.destroy(s, att.i, `แพ้การต่อสู้ ${ap} ต่อ ${tp}`); const D = E.locate(s, T.x.i); if (D && D.z === "av" && !E.locate(s, att.i)?.z?.startsWith("av")) E.hostKill(s, D.p, T.x, att, ap); if (D && D.z === "av" && !E.locate(s, att.i)?.z?.startsWith("av")) E.wonFight(s, D.p, T.x); if (D && D.z === "av" && !T.x.mute && (scriptOf(s, T.x) || {}).kill && !E.locate(s, att.i)?.z?.startsWith("av")) s.trig.push({ id: tid(s), seat: D.p, i: T.x.i, c: T.x.c, when: "kill", dead: att.i }); }
      else {
        const ah = E.kw(s, att, "ลูกฮึด"), dh = E.kw(s, T.x, "ลูกฮึด");
        if (ah && !dh) E.destroy(s, T.x.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        else if (dh && !ah) E.destroy(s, att.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        // Rule Book (หลังจบการต่อสู้): both destroyed together, the turn player's คำสั่งเสีย comes up first and so resolves last
        else { E.destroy(s, T.x.i, `พลังเท่ากัน ${tp}`); E.destroy(s, att.i, `พลังเท่ากัน ${ap}`); }
      }
      for (const { y, py } of side) { const Y = E.locate(s, y.i); if (!Y || Y.z !== "av") continue; const alive = () => E.locate(s, att.i)?.z === "av";
        if (ap > py) E.destroy(s, y.i, `แพ้การต่อสู้ ${py} ต่อ ${ap}`); else if (py > ap) { if (alive()) E.destroy(s, att.i, `แพ้การต่อสู้ ${ap} ต่อ ${py}`); }
        else if (ap > 0) { const ah = E.kw(s, att, "ลูกฮึด"), dh = E.kw(s, y, "ลูกฮึด"); if (!dh || ah) E.destroy(s, y.i, `พลังเท่ากัน ${py}`); if ((!ah || dh) && alive()) E.destroy(s, att.i, `พลังเท่ากัน ${ap}`); } }
      // "when this Avatar attacked and was not destroyed in the fight"
      if (pd.tk === "av") { const T2 = E.locate(s, T.x.i); const st = T2 && T2.z === "av" && !T.x.mute ? scriptOf(s, T.x) : null; if (st && st.survived) s.trig.push({ id: tid(s), seat: T2.p, i: T.x.i, c: T.x.c, when: "survived", optional: true });
        for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === T.x.i && (scriptOf(s, m) || {}).atkShield) E.moveTo(s, m.i, "hell"); } // ประกันชั้นต่ำ is used up by the attack
      if (pd.tk === "av") { const A2 = E.locate(s, att.i); const sa = A2 && A2.z === "av" && !att.mute ? scriptOf(s, att) : null; if (sa && sa.afterFight) s.trig.push({ id: tid(s), seat: pd.by, i: att.i, c: att.c, when: "afterFight", optional: true }); } // a Construct attack is no fight (FAQ)
      // Rule Book (ช่วงหลังจบการต่อสู้): "เมื่อทำลาย Avatar จากการต่อสู้" / "เมื่อจบการต่อสู้" abilities (step 2) work before the คำสั่งเสีย of the
      // Avatars destroyed in it (step 3) — FAQ สวีนนีย์: its ability is done first, then the last words
      E.endFight(s); const tail = s.trig.slice(k0); if (tail.some((t) => t.when === "death") && tail.some((t) => t.when !== "death")) s.trig.splice(k0, tail.length, ...tail.filter((t) => t.when !== "death"), ...tail.filter((t) => t.when === "death"));
      return;
    }
    E.endFight(s);
  },
  damageLife(s, d, by, o = {}) {
    const P = s.P[d];
    if (E.critical(P)) { if (s.tbuff && s.tbuff[d] && s.tbuff[d].noLose && s.tbuff[d].t === s.turn) { E.log(s, d, `${P.name} ยังไม่แพ้ในเทิร์นนี้ (เงื่อนไขการแพ้จาก LIFE ไม่ทำงาน)`); return; } E.lose(s, d, `${s.P[by].name} โจมตี LIFE ขณะ ${P.name} อยู่ในสถานะสาหัส`); return; }
    const x = P.life.find((y) => !y.up); if (!x) return;
    x.up = true; E.log(s, d, `LIFE ของ ${P.name} ถูกหงาย: ${E.name(s, x)}`); E.ev(s, { k: "life", p: d, i: x.i });
    if (o.quiet) E.log(s, d, "ความสามารถของ LIFE ใบนี้ไม่ทำงาน"); else E.addTrig(s, d, x, "life"); E.lifeFlipped(s, d);
    if (E.critical(P)) E.log(s, d, `${P.name} เข้าสู่สถานะสาหัส`);
  },
  // effect operations (from the card scripts, the text reader, or Ciel)
  ops(s, list, by) {
    for (const o of list.slice(0, 30)) {
      try { E.op(s, o, by); } catch (e) { E.log(s, by, `ทำผล "${o.op}" ไม่ได้: ${e.message}`); } E.sync(s);
      if (s.phase === "over") return;
    }
  },
  redirMagic(s, o) { if (o.i == null || s.cur == null || s.curSeat == null || o.noRedirect || !["destroy", "move", "power", "mute", "control", "setPower", "keyword", "exile", "stun", "noWake", "ovSet"].includes(o.op)) return o; const src = s.cards[s.cur]; if (!src || src.t !== "M" || (/ทั้งหมด|ทุกใบ/.test(String(src.x || "")) && !/เลือก/.test(String(src.x || "")))) return o; const L = E.locate(s, o.i); if (!L || L.z !== "av" || L.p === s.curSeat) return o;
    if (s.redir && s.redir.c === s.cur && s.redir.t === s.turn) { if (s.redir.from === o.i) return { ...o, i: s.redir.to }; if (o.i !== s.redir.to && o.op === s.redir.op) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกเลือกแล้ว: ผลของ ${src.n} เปลี่ยนไปที่ Avatar ใบเดียวแล้ว`); return null; } return o; } /* FAQ ยักษ์หินแผ่นดินใหญ่: a Magic that picked 2+ of ours now picks only this Avatar */
    for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== L.p || Ly.z !== "av" || y.i === L.x.i || y.mute || !y.a) continue; const sc = scriptOf(s, y); if (sc && sc.magicRedirect && sc.magicRedirect(E, s, y, L.x)) { y.a = false; s.redir = { c: s.cur, t: s.turn, from: o.i, to: y.i, op: o.op }; E.log(s, L.p, `${E.name(s, y)} เปลี่ยนเป็นสภาพนอน: ผลของ ${src.n} เปลี่ยนมาที่ ${E.name(s, y)} แทน ${E.name(s, L.x)}`); return { ...o, i: y.i }; } } return o; },
  op(s, o, by) {
    o = E.redirMagic(s, o); if (!o) return;
    const seat = o.seat === 0 || o.seat === 1 ? o.seat : by;
    const n = Math.max(0, Math.min(20, o.n | 0 || 1));
    const nm = (i) => { const L = E.locate(s, i); return L ? E.name(s, L.x) : "#" + i; };
    switch (o.op) {
      case "draw": { if (E.deckHandBlocked(s, seat, s.cards[o.src || s.cur])) { E.log(s, seat, `${s.P[seat].name} จั่วการ์ดด้วยความสามารถไม่ได้ (ห้ามนำการ์ดจาก Deck ขึ้นมือ)`); return; }
        E.draw(s, seat, n); E.log(s, seat, `${s.P[seat].name} จั่ว ${n} ใบ`); if (!s.rw) E.openWindow(s, seat, "handed", null); return; }
      case "mill": {
        // "when our cards' abilities mill, mill N more" (นายนิรยบาล อ้วน)
        if (s.cur != null && s.cards[s.cur] && ["A", "T"].includes(s.cards[s.cur].t) && s.curSeat != null && E.odHas(s, 1 - s.curSeat, "mill")) { E.log(s, by, "ธรณีสูบไม่ทำงาน (Overdose)"); return; }
        let more = 0; if (!o.plain) for (const { x: y, L: Ly } of fieldCards(s)) { const sy = y.mute ? null : scriptOf(s, y); if (sy && sy.millMore) more += sy.millMore(E, s, y, Ly, { seat, by, src: s.cards[o.src || s.cur] || null }) || 0; }
        const P = s.P[seat]; const k = Math.min(n + more, P.deck.length); const got = P.deck.splice(0, k);
        for (const x of got) { const sc = o.virus && scriptOf(s, x); if (sc && sc.virusExile) P.dark.push(x); else { P.hell.push(x); x.mil = s.turn || 1; E.anyHell(s, [x]); } } // x.mil: sent to hell by ธรณีสูบ (หอกแหลมแทงทุกวัน ทุกวัน)
        if (k > 0) E.ev(s, { k: "mill", p: seat, ids: got.map((x) => x.i), cs: got.map((x) => x.c), dark: got.filter((x) => P.dark.includes(x)).map((x) => x.i) }); // (the table shows them going)
        { // cards that react to being milled: millBy "any", or "god" = by a purple {เทพ} Avatar or a Magic card
          const src = s.cards[o.src || s.cur] || null; const srcX = !o.src && s.curI != null ? (E.locate(s, s.curI) || {}).x : null;
          const byGod = !!src && (src.t === "M" || (["A", "T"].includes(src.t) && (srcX ? E.hasSy(s, srcX, "เทพ") : String(src.sy || "").includes("เทพ")) && src.co === "ม่วง"));
          for (const x of got) { if (!P.hell.includes(x)) continue; const sc = scriptOf(s, x); const mb = sc ? (sc.milled ? sc.millBy || "god" : null) : E.ext.milled ? E.ext.milled(s, x) : null; if (mb && (mb === "any" || (typeof mb === "function" ? !!src && mb(src, E, s, x) : mb === "godAv" ? byGod && src.t !== "M" : byGod))) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "milled", optional: true }); } }
        if (k > 0) (s.milled = s.milled || [0, 0])[by] = s.turn; // นายนิรยบาล ดาร์กช็อก "ถ้าในเทิร์นนี้เราทำการธรณีสูบ": the player whose ability milled (either Deck, FAQ)
        if (k > 0) for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.z !== "av" || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.onAnyMill && once0(s, Ly.p, "anyMill:" + y.i)) { (s.nu = s.nu || [{}, {}])[Ly.p]["anyMill:" + y.i] = s.turn; s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "onAnyMill" }); } }
        if (k > 0) for (const l0 of E.lands(s)) if (!l0.mute && (scriptOf(s, l0) || {}).onMill) s.trig.push({ id: tid(s), seat: l0.o, i: l0.i, c: l0.c, when: "onMill", optional: true }); // บิฟร็อสต์
        E.log(s, seat, `ธรณีสูบ ${k} ใบ: ${got.map((x) => E.name(s, x)).join(", ")}${o.virus && got.some((x) => (scriptOf(s, x) || {}).virusExile) ? " (ไวรัสที่ถูกธรณีสูบไปมิติมืด)" : ""}`); return;
      }
      case "move": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i); if (o.dump && L.z === "deck" && o.to === "hell") { E.moveTo(s, o.i, "hell"); E.log(s, by, `${E.name(s, L.x)} ถูกทิ้งลงนรกจากการสอดแนม`); E.dumped(s, L.x); return; }
        const to = o.to; if (o.onlyFrom && L.z !== o.onlyFrom) return; if (L.z === "hell" && L.x.hlock && to !== "hell") { E.log(s, by, `${E.name(s, L.x)} ออกจากนรกไม่ได้`); return; } // e.g. "send it to hell" only while it is still on the field
        if (to === "av") { const P = s.P[o.seat != null ? seat : L.p]; if (!(L.z === "av") && (E.avatars(P) >= 4 || P.av.length >= 6 || !E.fits6(s, o.seat != null ? seat : L.p, L.x))) throw new RuleError("Avatar Zone เต็ม"); }
        if (to === "cs" && s.P[o.seat != null ? seat : L.p].cs.length >= 3) throw new RuleError("Construct Zone เต็ม");
        if (to === "hand" && L.z === "deck" && s.cur != null && E.deckHandBlocked(s, L.p, s.cards[o.src || s.cur])) { E.log(s, by, `นำ ${E.name(s, L.x)} จาก Deck ขึ้นมือไม่ได้ (ห้ามนำการ์ดจาก Deck ขึ้นมือ)`); return; }
        const name = E.name(s, L.x);
        const wasAv = L.z === "av"; const had = kwHas(E.def(s, L.x).x, "คำสั่งเสีย");
        // "เมื่อ Avatar ใบนี้จะออกจากสนาม … : จะไม่ออกจากสนาม" (ไพรมอล รัททาทุย)
        const ply = !!o.player; // FAQ: what the player is made to do (จมน้ำ, นรกในกรง) is never stopped by the abilities of cards
        if (!ply && wasAv && to !== "av" && E.immuneNow(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        if (!ply && wasAv && to !== "av" && E.hostSaved(s, L.x, L, by !== L.p)) return;
        if (!ply && wasAv && to !== "av" && L.x.stay === s.turn) { delete L.x.stay; E.log(s, by, `${E.name(s, L.x)} ไม่ออกจากสนาม`); return; }
        if (!ply && (wasAv || L.z === "mg") && to !== "av" && E.guarded(s, L.x, L, by !== L.p, "move")) { E.log(s, by, `${E.name(s, L.x)} ไม่ถูกนำออกจากสนาม (ความสามารถต่อเนื่อง)`); return; }
        if (!ply && wasAv && to !== "av") { const sc = L.x.mute ? null : scriptOf(s, L.x); if (sc && sc.wouldLeave && L.x.saved !== s.turn && sc.wouldLeave(E, s, L.x, L, { fromOpp: by !== L.p, to })) { L.x.saved = s.turn; return; } }
        const built = to === "cs" && L.z !== "cs"; if (built && s.P[o.seat != null ? seat : L.x.o].cs.some((y) => E.name(s, y) === name)) { E.log(s, by, `ก่อสร้าง ${name} ไม่ได้: มี Construct ชื่อนี้อยู่แล้ว`); return; }
        E.moveTo(s, o.i, to, o.seat != null ? seat : null); if (L.z === "hell" && (to === "deckBottom" || to === "deckTop")) { s.back = s.back && s.back.t === s.turn ? s.back : { t: s.turn, n: [0, 0] }; s.back.n[L.p]++; }
        E.log(s, by, built ? `ก่อสร้าง ${name} จาก${ZONE_TH[L.z] || L.z}` : `${name}: ${ZONE_TH[L.z] || L.z} → ${ZONE_TH[to] || to}`);
        if (wasAv && to !== "av" && !s.rw && s.phase !== "over") { const on = { kind: "left", by: 1 - L.p, i: L.x.i, p: L.p, to }; if (E.reactsFor(s, L.p, on).length) s.rw = on; }
        // (an Avatar sent to hell is not destroyed: no คำสั่งเสีย — printed "คำสั่งเสีย (เมื่อ Avatar ใบนี้ถูกทำลาย)", FAQ เจ้ากล้าดียังไง and เลอติ๊ก)
        if (built && fires(s, L.x, "build")) E.addTrig(s, L.x.o, L.x, "build"); // "เมื่อการ์ดใบนี้ก่อสร้าง" also fires when an effect builds it
        if (to === "hand" && (L.z === "deck" || L.z === "hell")) E.handed(s, L.x);
        if (to === "hand" && L.z === "deck" && s.cur != null && !s.rw && s.phase !== "over") E.openWindow(s, L.p, "handed", L.x.i);
        return;
      }
      case "destroy": { if (o.ifPower0) { const L = E.locate(s, o.i); if (!L || E.power(s, L.x) > 0) return; } E.destroy(s, o.i, o.why || "จากเอฟเฟกต์", { noSave: !!o.noSave, by }); return; }
      case "atEnd": { (s.timers = s.timers || []).push({ turn: o.turn | 0, seat: by, ops: (o.ops || []).slice(0, 10), why: o.why || "" }); return; } // ops that run at the end of turn `turn`
      case "exile": { const name = nm(o.i); { const L = E.locate(s, o.i); if (L && L.z === "av" && L.x.stay === s.turn) { delete L.x.stay; E.log(s, by, `${name} ไม่ออกจากสนาม`); return; } } E.moveTo(s, o.i, "dark"); E.log(s, by, `เนรเทศ ${name}`); return; }
      case "stay": { const L = E.locate(s, o.i); if (L) { L.x.stay = s.turn; E.log(s, by, `${E.name(s, L.x)} จะไม่ออกจากสนามครั้งถัดไปในเทิร์นนี้`); } return; }
      case "power": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด");
        if (E.immuneNow(s, L.x, "power")) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        let v = Math.max(-20, Math.min(20, o.n | 0)); if (v < 0 && by !== L.p && s.cur != null && s.cards[s.cur] && ["A", "T"].includes(s.cards[s.cur].t) && E.named(s, L.x, "หิมะ") && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === L.p && !y.mute && (scriptOf(s, y) || {}).snowFlip)) { v = -v; E.log(s, L.p, "ผลลด POWER ถูกเปลี่ยนเป็นเพิ่ม POWER (นายพลทหารหิมะ หลินอัน)"); } if (v > 0) L.x.ups = (L.x.ups || 0) + 1; // counted for "ได้รับผลเพิ่ม POWER ไปแล้ว 3 ครั้ง" (ยายกบ 1954)
        if (v < 0 && L.z === "av" && [...s.P[0].mg, ...s.P[1].mg].some((m) => { if (m.on !== L.x.i || m.mute) return false; const nl = (scriptOf(s, m) || {}).noLower; return typeof nl === "function" ? !!nl(E, s, m, L.x) : !!nl; })) { E.log(s, by, `${E.name(s, L.x)} ไม่ถูกลด POWER`); return; } /* FAQ ถาดหลุม: wearing ยาแก้ไอน้ำดำ a -POWER is not received, so it does not eat into gains */
        const thru = o.temp === "myturn" && s.active !== by; // "จนจบเทิร์นเรา" given in the other player's turn: it lasts through our next turn (until their turn after it starts)
        if (o.temp === false) L.x.pm = (L.x.pm || 0) + v; else if (o.temp === "next" || thru) { const k = thru ? 1 - by : by; L.x.tn = L.x.tn || {}; L.x.tn[k] = (L.x.tn[k] || 0) + v; } else if (o.temp === "fight") L.x.fm = (L.x.fm || 0) + v; else L.x.tm = (L.x.tm || 0) + v;
        E.log(s, by, `${E.name(s, L.x)} POWER ${v >= 0 ? "+" : ""}${v}${o.temp === false ? "" : o.temp === "next" ? " จนถึง Draw Phase ถัดไป" : o.temp === "fight" ? " จนจบการต่อสู้" : thru ? ` จนจบเทิร์นของ ${s.P[by].name}` : " จนจบเทิร์น"} (ตอนนี้ ${E.power(s, L.x)})`); return;
      }
      case "noWake": { const L = E.locate(s, o.i); if (L) { if (o.by != null) L.x.nwBy = o.by; L.x.nw = Math.max(L.x.nw || 0, o.until | 0); E.log(s, by, `${E.name(s, L.x)} จะไม่เปลี่ยนเป็นสภาพตื่นจนจบเทิร์น ${o.until}`); } return; }
      case "wake": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); if (L.x.frz === s.turn) { E.log(s, by, `${E.name(s, L.x)} เปลี่ยนสภาพไม่ได้ในเทิร์นนี้`); return; } if (o.force) { delete L.x.nw; delete L.x.nwBy; } if (o.v !== false && E.nwHeld(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} เปลี่ยนเป็นสภาพตื่นไม่ได้ (ผลของการ์ดที่สวมใส่)`); return; } const was0 = L.x.a; L.x.a = o.v !== false; if (was0 !== L.x.a) E.stateChanged(s, L); E.log(s, by, `${E.name(s, L.x)} ${L.x.a ? "ตื่น" : "นอน"}`); return; }
      case "keyword": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); const k = String(o.k).slice(0, 20);
        if (o.until) L.x.kt = [...(L.x.kt || []), { k, end: o.until === "oppturn" ? (s.active === by ? s.turn + 1 : s.turn) : s.turn }]; else L.x.kw = [...new Set([...(L.x.kw || []), k])];
        E.log(s, by, `${E.name(s, L.x)} ได้รับ ${k}${o.until ? (o.until === "oppturn" ? " จนจบเทิร์นฝ่ายตรงข้าม" : " จนจบเทิร์น") : ""}`); return; }
      case "token": {
        const P = s.P[seat]; if (E.avatars(P) >= 4 && P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); if (P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        const key = "tok:" + String(o.name || "Token").slice(0, 30) + ":" + (o.power | 0), im = tokenCard(String(o.name || ""), o.power | 0);
        s.cards[key] = s.cards[key] || { n: String(o.name || "Token").slice(0, 30), t: "T", pw: o.power | 0, sy: o.symbol || "", co: o.color || "", x: "", ...(o.cost != null ? { c: o.cost | 0 } : {}), ...(im != null ? { im, g: card(im).g || 0 } : {}) };
        if (s.cards[key].im == null && im != null) s.cards[key].im = im; // (a game saved before Tokens had their cards)
        let first = null; for (let k = 0; k < n && P.av.length < 6; k++) { const tk = { i: s.nextI++, c: key, o: seat, a: true, tok: true }; P.av.push(tk); first = first || tk; }
        E.log(s, seat, `เรียก Token ${s.cards[key].n} ×${n}`); E.fxSummoned(s, seat, first); return;
      }
      case "lifeFlip": {
        const P = s.P[seat];
        if (o.up === false) { if (E.landSc(s, "noLifeDown")) { E.log(s, by, "LIFE คว่ำไม่ได้ (Land Magic บนสนาม)"); return; } if (E.critical(P) && !o.force) { if (o.ifAble) { E.log(s, seat, "อยู่ในสถานะสาหัส LIFE คว่ำกลับไม่ได้"); return; } throw new RuleError("สถานะสาหัสคว่ำ LIFE ด้วยความสามารถไม่ได้"); }
          // "สุ่มคว่ำ": any of the face-up LIFE cards, by chance; otherwise the last one turned up
          const ups = P.life.filter((y) => y.up); const x = (o.i != null && ups.find((y) => y.i === o.i)) || (o.rnd && ups.length > 1 ? ups[Math.floor(E.rnd(s) * ups.length)] : ups[ups.length - 1]); // o.i: the one the player chose
          if (x) { x.up = false; E.log(s, seat, `${o.rnd ? "สุ่มคว่ำ" : "คว่ำ"} LIFE ${E.name(s, x)}`); E.ev(s, { k: "heal", p: seat, i: x.i }); } }
        else { const x = P.life.find((y) => !y.up); if (x) { x.up = true; E.log(s, seat, `หงาย LIFE ${E.name(s, x)} (จากความสามารถ ไม่ทำงาน)`); E.ev(s, { k: "life", p: seat, i: x.i, by }); if (E.critical(P)) E.log(s, seat, `${P.name} เข้าสู่สถานะสาหัส`); E.lifeFlipped(s, seat); } }
        return;
      }
      case "lifeDamage": { E.damageLife(s, seat, 1 - seat); return; }
      case "shuffle": { E.shuffle(s, s.P[seat].deck); E.log(s, seat, "สับ Deck"); return; }
      case "search": {
        const P = s.P[seat]; const q = String(o.name || "");
        const k = o.take != null ? P.deck.findIndex((x) => x.i === o.take) : P.deck.findIndex((x) => (q || o.names || o.symbol || o.type || o.maxCost != null) && matchCard(E.def(s, x), o));
        if (k < 0) { E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา "${q}" ไม่พบ · สับ Deck`); return; }
        if (o.to !== "av" && E.deckHandBlocked(s, seat, s.cards[o.src || s.cur])) { E.shuffle(s, P.deck); E.log(s, seat, `นำการ์ดจาก Deck ขึ้นมือไม่ได้ (${s.noSearch && s.noSearch[seat] >= s.turn ? "1 - 2 - 2" : "แมวนิค"})`); return; }
        const to = o.to === "av" ? "av" : "hand";
        if (to === "av" && fieldCards(s).some(({ x: y, L: Ly }) => Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).noDeckSummon)) { E.shuffle(s, P.deck); E.log(s, seat, "อัญเชิญ Avatar จาก Deck ไม่ได้ (ความสามารถต่อเนื่องบนสนาม)"); return; }
        if (to === "av" && (E.avatars(P) >= 4 || P.av.length >= 6)) { const nmK = E.name(s, P.deck[k]); E.shuffle(s, P.deck); E.log(s, seat, `Avatar Zone เต็ม อัญเชิญ ${nmK} จาก Deck ไม่ได้ · สับ Deck`); return; }
        const x = P.deck.splice(k, 1)[0];
        if (to === "av") { x.a = true; P.av.push(x); E.noteSummon(s, seat, x); E.ev(s, { k: "summon", i: x.i, p: seat }); E.fxSummoned(s, seat, x); } else P.hand.push(x);
        E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา ${E.name(s, x)} จาก Deck → ${ZONE_TH[to]} · สับ Deck`); if (to === "hand") { E.handed(s, x); if (!s.rw) E.openWindow(s, seat, "handed", x.i); } return;
      }
      case "mute": { // lose all abilities (and optionally base POWER 0) until the end of this / the opponent's turn
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); if (o.by == null && E.immuneNow(s, L.x, "mute")) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; } L.x.mute = true; if (o.zero) L.x.zero = true; if (o.by != null) { L.x.muteBy = o.by; E.log(s, by, `${E.name(s, L.x)} ความสามารถไร้ผลขณะสวมใส่การ์ดนั้น`); return; }
        L.x.muteEnd = o.until === "oppturn" ? (s.active === by ? s.turn + 1 : s.turn) : s.turn;
        E.log(s, by, `${E.name(s, L.x)} สูญเสียความสามารถทั้งหมด${o.zero ? " และ POWER ตั้งต้นเป็น 0" : ""}`); return;
      }
      case "travel": { // นักท่องเรื่องราว: exile the traveller, put the shown "เรื่องราว" from hand onto the field
        const T = E.locate(s, o.from), H = E.locate(s, o.to); if (!T || !H || H.z !== "hand") throw new RuleError("แปลงร่างไม่ได้");
        const P = s.P[H.p]; if (E.avatars(P) - 1 >= 4) throw new RuleError("Avatar Zone เต็ม");
        E.moveTo(s, o.from, "dark"); E.log(s, by, `${E.name(s, T.x)} ถูกเนรเทศ แปลงร่าง`);
        P.hand.splice(P.hand.indexOf(H.x), 1); H.x.a = true; H.x.story = true; if (o.bonus) H.x.pm = (H.x.pm || 0) + o.bonus; P.av.push(H.x);
        E.ev(s, { k: "summon", i: H.x.i, p: H.p }); E.log(s, by, `อัญเชิญ ${E.name(s, H.x)} ด้วยความสามารถของนักท่องเรื่องราว${o.bonus ? ` (POWER +${o.bonus})` : ""}`);
        const sc = scriptOf(s, H.x); if (sc && sc.summon) s.trig.push({ id: tid(s), seat: H.p, i: H.x.i, c: H.x.c, when: "summon" });
        E.fxSummoned(s, H.p, H.x); return;
      }
      case "put": { // summon a card from any zone with an ability; jt = "อัญเชิญ จุติ" (its จุติ fires), exd = gains "คำสั่งเสีย : เนรเทศ"
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i); if (L.z === "av") return; if (L.z === "hell" && L.x.hlock) { E.log(s, by, `${E.name(s, L.x)} ออกจากนรกไม่ได้`); return; }
        const ctl = o.ctl === 0 || o.ctl === 1 ? o.ctl : o.here ? L.p : L.x.o; const P = s.P[ctl]; if (E.avatars(P) >= 4 || P.av.length >= 6 || !E.fits6(s, ctl, L.x)) throw new RuleError("Avatar Zone เต็ม");
        if (E.def(s, L.x).t !== "A") throw new RuleError("อัญเชิญได้เฉพาะ Avatar");
        { const su = scriptOf(s, L.x); if (su && su.uniq && P.av.some((y) => E.name(s, y) === E.def(s, L.x).n)) { E.log(s, by, `ควบคุม ${E.def(s, L.x).n} บน Avatar Zone ได้เพียง 1 ใบ`); return; } }
        if ((scriptOf(s, L.x) || {}).selfOnly && s.cur !== L.x.c) { E.log(s, by, `${E.name(s, L.x)} อัญเชิญได้ด้วยความสามารถของตัวเองเท่านั้น`); return; }
        if (L.z === "hell" && (scriptOf(s, L.x) || {}).noFromHell) { E.log(s, by, `${E.name(s, L.x)} อัญเชิญจากนรกไม่ได้`); return; }
        if (L.z === "deck" && fieldCards(s).some(({ x: y, L: Ly }) => Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).noDeckSummon)) { E.log(s, by, `อัญเชิญ ${E.name(s, L.x)} จาก Deck ไม่ได้ (ความสามารถต่อเนื่องบนสนาม)`); return; }
        if (L.z === "hell" && fieldCards(s).some(({ x: y }) => !y.mute && (scriptOf(s, y) || {}).noHellSummon)) { E.log(s, by, `อัญเชิญ ${E.name(s, L.x)} จากนรกไม่ได้ (ความสามารถต่อเนื่องบนสนาม)`); return; }
        const from = ZONE_TH[L.z] || L.z; const x = E.moveTo(s, o.i, "av", ctl); if (o.exd) x.exd = true; if (o.asleep) x.a = false; if (L.z === "hell") x.fromHell = true; if (o.ov) x.ov = { ...(x.ov || {}), ...o.ov }; E.noteSummon(s, ctl, x);
        E.ev(s, { k: "summon", i: x.i, p: ctl }); E.log(s, by, `อัญเชิญ ${E.name(s, x)} จาก${from}${o.jt ? " แบบจุติ" : ""}${o.asleep ? " ในสภาพนอน" : ""}${o.exd ? " (ได้รับคำสั่งเสีย : เนรเทศ)" : ""}`);
        if (o.jt) { const ex = o.exact ? { exact: true } : {}; const sc = scriptOf(s, x); if (sc && sc.summon) { if (!sc.storyOnly || x.story) E.addTrig(s, ctl, x, "summon", ex); } else if (kwHas(E.def(s, x).x, "จุติ")) E.addTrig(s, ctl, x, "summon", ex); }
        // "เมื่อการ์ดใบนี้ถูกอัญเชิญมาด้วยความสามารถของ …": the card whose effect is resolving is the source
        if (s.cur != null && s.cards[s.cur]) { x.sb = s.cur; const sc = x.mute ? null : scriptOf(s, x); if (sc && sc.summonedBy && (!sc.byOk || sc.byOk(E, s, s.cards[s.cur], x))) s.trig.push({ id: tid(s), seat: x.o, i: x.i, c: x.c, when: "summonedBy", src: s.cur }); }
        E.fxSummoned(s, ctl, x); return;
      }
      case "toLand": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); const name = E.name(s, L.x); E.moveTo(s, o.i, "land"); E.log(s, by, `ใช้ ${name} บน Land Magic Zone`); return; }
      case "handToDeck": { const P = s.P[seat]; const n0 = P.hand.length; P.deck.push(...P.hand.splice(0)); E.shuffle(s, P.deck); E.log(s, seat, `${P.name} นำการ์ดบนมือ ${n0} ใบกลับเข้า Deck แล้วสับ`); return; }
      case "rps": { // เป่ายิงฉุบ: the loser flips their top LIFE card, or loses the game if already in critical state
        const Hd = ["ค้อน", "กรรไกร", "กระดาษ"]; let a = 0, b = 0, k = 0; do { a = Math.floor(E.rnd(s) * 3); b = Math.floor(E.rnd(s) * 3); k++; } while (a === b && k < 9); if (a === b) b = (a + 1) % 3;
        const lo = (a + 1) % 3 === b ? 1 : 0; E.log(s, by, `เป่ายิงฉุบ: ${s.P[0].name} ${Hd[a]} · ${s.P[1].name} ${Hd[b]} → ${s.P[lo].name} แพ้`); E.ev(s, { k: "rps", h: [a, b], lo });
        if (E.critical(s.P[lo])) { E.lose(s, lo, `${s.P[lo].name} แพ้เป่ายิงฉุบขณะอยู่ในสถานะสาหัส`); return; } E.op(s, { op: "lifeFlip", seat: lo }, by); return; }
      case "peek": { const P = s.P[seat]; const xs = o.ids ? o.ids.map((i) => (E.locate(s, i) || {}).x).filter(Boolean) : P[o.z || "hand"]; E.log(s, by, `${o.label || "ดูการ์ด"} (${xs.length} ใบ): ${xs.map((x) => E.name(s, x)).join(", ") || "ไม่มีการ์ด"}`); return; }
      case "pilfer": { // เบียดเบียนผู้อื่น: each player takes a random card from the other's hand and shows it; the follow-ups are triggers of the source card
        const src = s.cur != null ? s.cur : o.c; const take = [0, 1].map((q) => { const H = s.P[1 - q].hand; return H.length ? H[Math.floor(E.rnd(s) * H.length)] : null; }); // take[q]: the card q took
        const cost = (x) => { if (!x) return null; const d = E.def(s, x); return typeof d.c === "number" ? E.costOf(s, x.o, x) : null; };
        const cv = take.map(cost); E.log(s, by, `เบียดเบียนผู้อื่น: ${[0, 1].map((q) => `${s.P[q].name} หยิบได้ ${take[q] ? `${E.name(s, take[q])}${cv[q] != null ? ` (Cost ${cv[q]})` : " (ไม่มี Cost)"}` : "ไม่มีการ์ด"}`).join(" · ")}`);
        const fu = (q, when, extra = {}) => s.trig.push({ id: tid(s), seat: q, i: o.i, c: src, when, ...extra });
        for (const q of [0, 1]) if (cv[q] == null) fu(q, "pilferDiscard", { ex: take[1 - q] ? take[1 - q].i : null });
        if (cv[0] != null && cv[1] != null) { if (cv[0] === cv[1]) { for (const q of [0, 1]) E.op(s, { op: "discard", seat: take[q].o, iids: [take[q].i] }, by); E.log(s, by, `Cost เท่ากัน: ${E.name(s, take[0])} และ ${E.name(s, take[1])} ลงนรก`); }
          else { const lo = cv[0] < cv[1] ? 0 : 1; fu(lo, "pilferExile", { ex: take[1 - lo].i }); fu(1 - lo, "pilferBack"); } }
        E.log(s, by, "คืนการ์ดที่หยิบมาให้เจ้าของเดิม"); return; }
      case "resume": { if (o.t && o.t.c != null) s.trig.unshift({ id: tid(s), ...o.t }); return; } // the rest of an effect that had to wait for its first steps
      case "mu": { s.mu[seat][o.k] = true; return; }
      case "banPay": { s.ban = s.ban || [[], []]; if (!s.ban[seat].includes(o.name)) s.ban[seat].push(o.name); E.log(s, by, `${o.name} ใช้เป็น Cost ในการอัญเชิญไม่ได้จนจบเกม`); return; }
      case "millKill": { // ซีเกิร์ด: mill n, then destroy enemy Avatars with total Cost ≤ base + (named cards milled)
        const P = s.P[seat]; const top = P.deck.slice(0, Math.min(n, P.deck.length)); E.op(s, { op: "mill", seat, n, src: o.src }, by);
        const k = top.filter((x) => String(E.def(s, x).n || "").includes(o.name || "")).length; let budget = (o.base | 0) + k;
        const cands = s.P[1 - seat].av.filter((x) => !x.tok && !E.untargetable(s, x)).sort((a, b) => E.power(s, b) - E.power(s, a));
        const kill = []; for (const x of cands) { const c = E.def(s, x).c || 0; if (c <= budget) { kill.push(x); budget -= c; } }
        E.log(s, by, `ธรณีสูบเจอ ${o.name} ${k} ใบ · ทำลายได้ Cost รวมไม่เกิน ${(o.base | 0) + k}`); for (const x of kill) E.destroy(s, x.i, "ความสามารถของซีเกิร์ด"); return;
      }
      case "flag": { const L = E.locate(s, o.i); if (L && ["canAtk", "drac", "sb", "kula"].includes(o.k)) { if (o.off) delete L.x[o.k]; else L.x[o.k] = o.v != null ? o.v : true; } return; }
      case "randomPick": { const P = s.P[seat]; const xs = (o.ids || []).map((i) => P.deck.find((x) => x.i === i)).filter(Boolean); if (!xs.length) return; if (s.cur != null && E.deckHandBlocked(s, seat, s.cards[o.src || s.cur])) { E.log(s, seat, "นำการ์ดจาก Deck ขึ้นมือไม่ได้ (ห้ามนำการ์ดจาก Deck ขึ้นมือ)"); if (o.shuffle) E.shuffle(s, P.deck); return; } const x = xs[Math.floor(E.rnd(s) * xs.length)]; P.deck.splice(P.deck.indexOf(x), 1); P.hand.push(x); E.log(s, seat, `สุ่มเลือกได้ ${E.name(s, x)} → ขึ้นมือ`); E.handed(s, x); if (o.shuffle) E.shuffle(s, P.deck); if (!s.rw && s.phase !== "over") E.openWindow(s, seat, "handed", x.i); return; }
      case "xsy": { const L = E.locate(s, o.i); if (!L) return; L.x.xsy = { t: s.turn, list: (o.list || []).map(String).slice(0, 8) }; E.log(s, by, `${E.name(s, L.x)} ได้รับ Symbol ${L.x.xsy.list.join(", ")} จนจบเทิร์น`); return; }
      case "xsyOnly": { const L = E.locate(s, o.i); if (!L) return; if (E.immuneNow(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; } L.x.sye = { k: String(o.k || ""), until: o.until | 0 }; E.log(s, by, `${E.name(s, L.x)} เปลี่ยน Symbol เป็น {${L.x.sye.k}}`); return; }
      case "xn": { const L = E.locate(s, o.i); if (!L) return; L.x.xn = String(o.name || "").slice(0, 30); E.log(s, by, `${E.name(s, L.x)} ได้รับชื่อ "${L.x.xn}"`); return; }
      case "exileRandom": { const P = s.P[seat]; for (let k = 0; k < n && P.hand.length; k++) { const j = Math.floor(E.rnd(s) * P.hand.length); const x = P.hand.splice(j, 1)[0]; s.P[x.o != null ? x.o : seat].dark.push(x); E.log(s, by, `สุ่มเนรเทศ ${E.name(s, x)} จากมือของ ${P.name}`); } return; }
      case "toggle": { const L = E.locate(s, o.i); if (!L || L.z !== "av") return; if (L.x.frz === s.turn) { E.log(s, by, `${E.name(s, L.x)} เปลี่ยนสภาพไม่ได้ในเทิร์นนี้`); return; } L.x.a = !L.x.a; E.stateChanged(s, L); E.log(s, by, `${E.name(s, L.x)} เปลี่ยนเป็นสภาพ${L.x.a ? "ตื่น" : "นอน"}`); return; }
      case "noDmg": { if (s.pend) { s.pend.noDmg = true; E.log(s, by, "การโจมตีครั้งนี้จะไม่ทำความเสียหาย LIFE"); } return; }
      case "endNow": { s.endNow = true; E.log(s, by, "เทิร์นของฝ่ายตรงข้ามจะจบลงทันที"); return; }
      case "cancelAttack": { if (s.pend) { E.log(s, by, "ยกเลิกการโจมตี"); E.endFight(s, true); } return; }
      case "zero": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.zero = true; L.x.muteEnd = s.turn; E.log(s, by, `${E.name(s, L.x)} POWER ตั้งต้นเป็น 0 จนจบเทิร์น`); return; }
      case "attach": { // put a card onto an Avatar as an equipped card (e.g. โอตะ on a ไอดอล)
        const L = E.locate(s, o.i), H = E.locate(s, o.on); if (!L) throw new RuleError("สวมใส่ไม่ได้");
        if (!H || H.z !== "av") { E.log(s, by, `${E.name(s, L.x)} สวมใส่ไม่ได้ (Avatar ที่จะสวมใส่ไม่อยู่บนสนามแล้ว)`); return; }
        { const ht = H.x.mute ? null : hk(s, H.x); if (ht && ht.uniqWear && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === H.x.i && E.def(s, m).n === E.def(s, L.x).n)) { E.log(s, by, `${E.name(s, H.x)} สวมใส่การ์ดชื่อซ้ำกันไม่ได้`); return; } }
        if (L.z !== "mg" && E.def(s, L.x).t === "M" && E.def(s, L.x).st === "D" && !E.modOk(s, L.x, H.x)) { E.log(s, by, `${E.name(s, L.x)} สวมใส่ให้ ${E.name(s, H.x)} ไม่ได้ (ไม่ตรงเงื่อนไขการสวมใส่)`); return; }
        if (L.z === "land") E.unLand(s, L.x); else s.P[L.p][L.z].splice(L.idx, 1); L.x.on = o.on; L.x.a = true; s.P[H.p].mg.push(L.x); if (E.def(s, L.x).st === "D") E.gotMod(s, H.x, L.x);
        // "เมื่อการ์ดใบนี้สวมใส่ …" works when the card is brought from another zone, not when it moves within the Magic Zone (FAQ มีมมิจัง ไอดอล No.1)
        if ((L.z !== "mg" || o.wear) && WORN_RE.test(E.def(s, L.x).x || "") && (scriptOf(s, L.x) || {}).cast) s.trig.push({ id: tid(s), seat: H.p, i: L.x.i, c: L.x.c, when: "cast", on: H.x.i });
        E.log(s, by, `${E.name(s, L.x)} สวมใส่ให้ ${E.name(s, H.x)}`); return;
      }
      case "negate": { const k = s.trig.findIndex((t) => t.i === o.i); if (k >= 0) s.trig.splice(k, 1); const L = E.locate(s, o.i); if (L && (L.z === "mg" || L.z === "land")) E.moveTo(s, o.i, "hell"); E.log(s, by, "ยกเลิกผลของการ์ดนั้น"); return; }
      case "later": { if (s.lifeNow && (o.at !== "battle" || s.lifeNow === "all")) { E.log(s, seat, "ทำงานทันทีในเทิร์นนี้"); if (o.t) s.trig.push({ id: tid(s), ...o.t }); else E.ops(s, (o.ops || []).slice(0, 10), seat); return; } (s.later = s.later || []).push({ seat, ...(o.t ? { t: o.t } : { ops: (o.ops || []).slice(0, 10) }), why: o.why, ...(o.at === "battle" ? { at: "battle", after: s.turn } : {}) }); E.log(s, seat, o.at === "battle" ? "รอทำงานใน Battle Phase ของเทิร์นถัดไปของเรา" : "รอทำงานใน Main Phase ถัดไป"); return; }
      case "guard": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.guard = o.until || true; E.log(s, by, `${E.name(s, L.x)} ได้รับการป้องกันการถูกทำลาย 1 ครั้ง${o.until ? " จนจบเทิร์นถัดไปของฝ่ายตรงข้าม" : ""}`); return; }
      case "used": { const L = E.locate(s, o.i); if (L) L.x.used = s.turn; return; }
      case "roll": { // dice (sides 6) or a coin (sides 2: 1 = heads): the matching ops run
        const sides = o.sides === 2 ? 2 : 6; const r = 1 + Math.floor(E.rnd(s) * sides); const label = sides === 2 ? (r === 1 ? "หัว" : "ก้อย") : String(r);
        E.log(s, by, `${o.why ? o.why + ": " : ""}${sides === 2 ? "ทอยเหรียญได้" : "ทอยลูกเต๋าได้ "}${label}`); E.ev(s, { k: "roll", p: by, sides, r, why: String(o.why || "") });
        const branch = (o.cases && (o.cases[r] || o.cases[r % 2 ? "odd" : "even"])) || (r % 2 ? o.odd : o.even) || []; if (branch.length) E.ops(s, branch, by); return; }
      case "scout": { // look at the top n, take the chosen (or first matching) card, the rest go to the bottom
        const P = s.P[seat]; const top = P.deck.splice(0, Math.min(n, P.deck.length)); const k = o.take != null ? top.findIndex((x) => x.i === o.take) : o.none ? -1 : top.findIndex((x) => matchCard(E.def(s, x), o));
        let got = null; if (k >= 0) got = top.splice(k, 1)[0];
        const toAv = !!got && o.to === "av" && E.avatars(P) < 4 && P.av.length < 6 && E.def(s, got).t === "A";
        if (got && !toAv && s.cur != null && E.deckHandBlocked(s, seat, s.cards[o.src || s.cur])) { top.splice(k, 0, got); got = null; E.log(s, seat, "นำการ์ดจาก Deck ขึ้นมือไม่ได้ (ห้ามนำการ์ดจาก Deck ขึ้นมือ)"); }
        P.deck.push(...top);
        if (got) { if (toAv) { P.av.push(got); E.ev(s, { k: "summon", i: got.i, p: seat }); E.fxSummoned(s, seat, got); } else { P.hand.push(got); E.handed(s, got); if (!s.rw && s.phase !== "over") E.openWindow(s, seat, "handed", got.i); } }
        E.log(s, seat, `สอดแนม ${top.length + (got ? 1 : 0)} ใบ${got ? ` · นำ ${E.name(s, got)} ${o.to === "av" ? "ลงสนาม" : "ขึ้นมือ"}` : " · ไม่พบการ์ดที่ตรงเงื่อนไข"} · ที่เหลือไว้ใต้ Deck`); return;
      }
      case "scoutShow": { const P = s.P[seat]; const xs = (o.ids || []).map((i) => P.deck.find((x) => x.i === i)).filter(Boolean); E.log(s, by, `${o.label || "สอดแนม"}${seat !== by ? " Deck ฝ่ายตรงข้าม" : ""} ${xs.length} ใบ: ${xs.map((x) => E.name(s, x)).join(", ") || "ไม่มีการ์ด"}`); return; }
      case "scoutRest": { // the scouted cards that were not taken: bottom (default) / shuffle / top / hell / dark
        const P = s.P[seat]; let left = (o.ids || []).map((i) => P.deck.find((x) => x.i === i)).filter(Boolean); if (!left.length) return;
        { const src = s.cards[o.src || s.cur] || null; for (const x of [...left]) { const sc = scriptOf(s, x); if (src && x.o === by && sc && sc.scoutedPut && sc.scoutedPut(E, s, x, src) && E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, by, x)) { left = left.filter((y) => y !== x); E.log(s, by, `${E.name(s, x)} ถูกสอดแนมด้วย ${src.n}: อัญเชิญลง Avatar Zone`); E.op(s, { op: "put", i: x.i }, by); continue; }
          if (src && x.o === by && sc && sc.scoutedBy && sc.scoutedBy(E, s, x, src)) { P.deck.splice(P.deck.indexOf(x), 1); P.hand.push(x); left = left.filter((y) => y !== x); E.log(s, by, `${E.name(s, x)} ถูกสอดแนมด้วย ${src.n}: นำขึ้นมือ`); E.handed(s, x); } } if (!left.length) return; }
        if (o.rest === "top") { E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ วางไว้บน Deck ตามเดิม`); return; }
        for (const x of left) P.deck.splice(P.deck.indexOf(x), 1);
        if (o.rest === "hell") { P.hell.push(...left); E.anyHell(s, left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ลงนรก: ${left.map((x) => E.name(s, x)).join(", ")}`); for (const x of left) E.dumped(s, x); }
        else if (o.rest === "dark") { P.dark.push(...left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ถูกเนรเทศ`); }
        else if (o.rest === "shuffle") { P.deck.push(...left); E.shuffle(s, P.deck); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ กลับเข้า Deck แล้วสับ`); }
        else { P.deck.push(...left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ไว้ใต้ Deck`); }
        return;
      }
      case "fromHell": {
        const P = s.P[seat]; const k = o.take != null ? [...P.hell].reverse().findIndex((x) => x.i === o.take) : [...P.hell].reverse().findIndex((x) => matchCard(E.def(s, x), o)); if (k < 0) { E.log(s, seat, "ไม่พบการ์ดที่ตรงเงื่อนไขในนรก"); return; }
        const x = P.hell.splice(P.hell.length - 1 - k, 1)[0];
        if (o.to === "av" && E.avatars(P) < 4 && P.av.length < 6 && E.def(s, x).t === "A") { x.a = true; P.av.push(x); E.ev(s, { k: "summon", i: x.i, p: seat }); E.fxSummoned(s, seat, x); }
        else if (o.to === "deck") { P.deck.push(x); E.shuffle(s, P.deck); } else P.hand.push(x);
        E.log(s, seat, `นำ ${E.name(s, x)} จากนรก${o.to === "av" ? "ลงสนาม" : o.to === "deck" ? "กลับเข้า Deck" : "ขึ้นมือ"}`); return;
      }
      case "discard": { // chosen discard (used for "ทิ้งการ์ดบนมือ N ใบ" costs)
        const P = s.P[seat]; let k0 = 0; const gone = []; for (const i of o.iids || []) { const k = P.hand.findIndex((x) => x.i === i); if (k >= 0) { const x = P.hand.splice(k, 1)[0]; s.P[x.o != null ? x.o : seat].hell.push(x); k0++; gone.push(x); E.log(s, seat, `ทิ้ง ${E.name(s, x)} ลงนรก`); E.anyHell(s, [x]); } }
        if (gone.length) E.discarded(s, gone);
        if (k0 && s.cur != null && s.curSeat === seat) { const seen = new Set(); for (const y of P.hell) { const sc = scriptOf(s, y); const n = E.def(s, y).n; if (sc && sc.onDiscard && y.used !== s.turn && !gone.includes(y) && !seen.has(n)) { seen.add(n); s.trig.push({ id: tid(s), seat, i: y.i, c: y.c, when: "onDiscard", optional: true }); } } } return; // FAQ ลาพิเน่: not the card just discarded, one per discard
      }
      case "discardRandom": { const P = s.P[seat]; for (let k = 0; k < n && P.hand.length; k++) { const j = Math.floor(E.rnd(s) * P.hand.length); const x = P.hand.splice(j, 1)[0]; s.P[x.o != null ? x.o : seat].hell.push(x); E.log(s, seat, `ทิ้งแบบสุ่ม ${E.name(s, x)}`); E.discarded(s, [x]); E.anyHell(s, [x]); } return; }
      case "control": { const L = E.locate(s, o.i); if (!L || L.z !== "av") throw new RuleError("ควบคุมได้เฉพาะ Avatar บนสนาม"); if (E.immuneNow(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        // (o.home: back to the player who put it on the field — ปลอกคอซื่อสัตย์ worn after it was taken, FAQ)
        if (!o.home && (o.player ? !!L.x.lk : E.noControl(s, L.x) || E.noSteal(s, L) || [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === L.x.i && !m.mute && (scriptOf(s, m) || {}).keepControl))) { E.log(s, by, `${E.name(s, L.x)} ไม่สามารถถูกเปลี่ยนการควบคุมได้`); return; } const t = o.seat === 0 || o.seat === 1 ? o.seat : 1 - L.p; const P = s.P[t]; if (E.ctlBlocked(s, L.x, t)) { E.log(s, by, `ควบคุม ${E.def(s, L.x).n} บน Avatar Zone ได้เพียง 1 ใบ: เปลี่ยนการควบคุมไม่ได้`); return; } if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); s.P[L.p].av.splice(L.idx, 1); if (o.until === "turn") L.x.back = L.p; if (o.until === "ownerDraw") L.x.backDraw = L.p; if (o.asleep) L.x.a = false; if (o.wake) L.x.a = true; if (o.noLife) L.x.nlt = s.turn; L.x.ctlx = (L.x.ctlx || 0) + 1; if (L.x.home == null) L.x.home = L.p; if (L.x.home === t) delete L.x.home; /* home: who controlled it when it came onto the field */ P.av.push(L.x); E.log(s, by, `${s.P[t].name} ได้ควบคุม ${E.name(s, L.x)}${o.until === "turn" ? " จนจบเทิร์น" : ""}${o.wake ? " ในสภาพตื่น" : ""}${o.noLife ? " (โจมตี LIFE ไม่ได้)" : ""}`); return; }
      case "turnLock": { s.tlock = s.tlock || [null, null]; const cur = s.tlock[seat] && s.tlock[seat].t === s.turn ? s.tlock[seat] : { t: s.turn };
        if (o.sy) cur.sy = o.sy; if (o.atkSy) cur.atkSy = o.atkSy; if (o.only) cur.only = o.only; if (o.name) cur.names = [...(cur.names || []), o.name]; s.tlock[seat] = cur; if (o.both && o.name) { const q = 1 - seat; const c2 = s.tlock[q] && s.tlock[q].t === s.turn ? s.tlock[q] : { t: s.turn }; c2.names = [...(c2.names || []), o.name]; s.tlock[q] = c2; } // FAQ โรงบาล: the name is shut for both players
        E.log(s, by, o.sy ? `เทิร์นนี้อัญเชิญได้เฉพาะ Avatar {${o.sy}}` : o.atkSy ? `เทิร์นนี้สั่งโจมตีได้เฉพาะ Avatar {${o.atkSy}}` : o.only ? `เทิร์นนี้อัญเชิญได้เฉพาะ Avatar "${o.only}"` : `เทิร์นนี้อัญเชิญหรือใช้ความสามารถของ ${o.name} ไม่ได้`); return; }
      case "turnBuff": { s.tbuff = s.tbuff || [null, null]; s.tbuff[seat] = { t: s.turn, sy: o.sy, imm: !!o.imm, kw: o.kw || null, noShield: !!o.noShield, noLose: !!o.noLose }; E.log(s, by, o.why || "ในเทิร์นนี้ Avatar ที่อัญเชิญจะได้รับความสามารถ"); return; }
      case "ind": { const L = E.locate(s, o.i); if (L) { L.x.ind = s.turn; E.log(s, by, `${E.name(s, L.x)} จะไม่ถูกทำลายในเทิร์นนี้`); } return; }
      case "randomHand": { // ด่านลอย: a random card from that hand; an Avatar of the named Cost goes to hell
        const P = s.P[seat]; if (!P.hand.length) { E.log(s, by, "มือฝ่ายนั้นไม่มีการ์ด"); return; } const x = P.hand[Math.floor(E.rnd(s) * P.hand.length)]; const d = E.def(s, x);
        const hit = d.t === "A" && (o.sy ? E.hasSy(s, x, o.sy) : (d.c || 0) === (o.cost | 0)); E.log(s, by, `สุ่มได้ ${d.n}${hit ? ` (${o.sy ? "Avatar {" + o.sy + "}" : "Avatar Cost " + o.cost}) ส่งลงนรก` : " ไม่ตรงเงื่อนไข"}`); if (hit) { P.hand.splice(P.hand.indexOf(x), 1); P.hell.push(x); } return; }
      case "setCost": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.cst = { v: Math.max(0, o.v | 0), t: s.turn }; E.log(s, by, `Cost ของ ${E.name(s, L.x)} เป็น ${L.x.cst.v} จนจบเทิร์น`); return; }
      case "reSummon": { const L = E.locate(s, o.i); if (!L || L.z !== "av") return; s.trig.push({ id: tid(s), seat: L.p, i: L.x.i, c: L.x.c, when: "summon", ...(o.exact ? { exact: true } : {}) }); E.log(s, by, `ความสามารถจุติของ ${E.name(s, L.x)} ทำงานอีกครั้ง`); return; }
      case "stateSet": { // turn-scoped player flags: K-BO, เนโกะเมะ, 1 - 2 - 2
        if (o.k === "hosp") { s.hosp = s.hosp || [null, null]; for (const q of [0, 1]) { const cur = s.hosp[q] && s.hosp[q].t === s.turn ? s.hosp[q].names : []; s.hosp[q] = { t: s.turn, names: [...cur, String(o.name || "")] }; } } /* FAQ โรงบาล: the name is shut for both players */ else if (o.k === "noReact") { s.noR = { t: s.turn, p: o.self ? seat : 1 - seat }; } else if (o.k === "landLock") { (s.landLock = s.landLock || [0, 0])[1 - seat] = s.turn + 1; } else if (o.k === "kbo") s.kbo = { t: s.turn, p: seat }; else if (o.k === "neko") { (s.neko = s.neko || [null, null])[seat] = { st: o.st, until: s.turn + 1 }; } else if (o.k === "oneTwoTwo") { (s.noSearch = s.noSearch || [0, 0])[seat] = s.turn + 2; (s.skipDraw = s.skipDraw || [0, 0])[seat] = s.turn + 2; }
        E.log(s, by, String(o.why || "")); return; }
      case "bloody": { const P = s.P[seat]; const a = 1 + Math.floor(E.rnd(s) * 6), b = 1 + Math.floor(E.rnd(s) * 6); E.log(s, by, `ทอยลูกเต๋าได้ ${a} และ ${b}`); E.ev(s, { k: "roll", p: by, sides: 6, r: a, r2: b, why: "บลัดดี้แมรี่" }); if (a % 2 || b % 2) return;
        const x = P.hell.find((y) => E.named(s, y, "วิญญาณร้าย")); if (!x) return; E.moveTo(s, x.i, "dark"); s.bm = s.bm || [0, 0]; s.bm[seat]++; E.log(s, by, `เนรเทศ ${E.name(s, x)} (${s.bm[seat]}/3)`); if (s.bm[seat] >= 3) E.lose(s, 1 - seat, "วิญญาณร้ายครบ 3 ใบในมิติมืด (บลัดดี้แมรี่)"); return; }
      case "bpOn": { const L = E.locate(s, o.i); if (L) L.x.bp = s.turn; return; }
      case "flagSet": { const L = E.locate(s, o.i); if (L && /^(tlb|st0|sorry|kraken|frz|lh2|kf|own|feed|ofa|mustAtk|mgo|sumt|picky|hs2|tani|twice|twiceUsed|nact|kdm|fa)$/.test(o.k)) L.x[o.k] = o.v == null ? s.turn : o.v; return; }
      case "sorry": { s.sorry = { t: s.turn, p: seat }; E.log(s, by, "เทิร์นนี้การขอโทษของ DJ ปีโป้ จะได้รับการยกโทษเสมอ"); return; }
      case "copyStats": { const L = E.locate(s, o.i), F = E.locate(s, o.from); if (!L || !F) return; const d = E.def(s, F.x); L.x.ov = { n: d.n, c: d.c, g: d.g, sy: d.sy, pw: E.power(s, F.x) }; E.log(s, by, `${E.def(s, L.x).n}: ชื่อ Cost GEM Symbol POWER เหมือน ${d.n} จนจบเทิร์น`); return; }
      case "ovSet": { const L = E.locate(s, o.i); if (!L || !o.ov) return; const ov = { ...(L.x.ov || {}) }; for (const k of ["n", "c", "pw", "g", "sy", "co"]) { if (o.ov[k] === null) delete ov[k]; else if (o.ov[k] !== undefined) ov[k] = o.ov[k]; } if (Object.keys(ov).length) L.x.ov = ov; else delete L.x.ov; if (o.why) E.log(s, by, String(o.why)); return; }
      case "putNamed": { const P = s.P[seat]; const z = o.from === "hell" ? P.hell : P.deck; const x = z.find((y) => E.def(s, y).t === "A" && E.named(s, y, String(o.name || ""))); if (!x || E.avatars(P) >= 4) { E.log(s, seat, `ไม่มี ${o.name} ให้อัญเชิญ`); return; } E.op(s, { op: "put", i: x.i, jt: !!o.jt }, by); if (o.shuffle && o.from !== "hell") E.shuffle(s, P.deck); return; }
      case "clearOv": { const L = E.locate(s, o.i); if (L) delete L.x.ov; return; }
      case "copySummon": { const L = E.locate(s, o.i), F = E.locate(s, o.from); if (!L || !F) return; s.trig.push({ id: tid(s), seat, i: L.x.i, c: F.x.c, when: "summon" }); E.log(s, by, `${E.name(s, L.x)} ได้รับความสามารถจุติของ ${E.name(s, F.x)}`); return; } // มฤตยูเทวี
      case "lifeFlipCard": { const P = s.P[seat]; const x = P.life.find((y) => y.i === o.i); if (!x || x.up) return; x.up = true; E.log(s, seat, `หงาย LIFE ${E.name(s, x)} (จากความสามารถ ไม่ทำงาน)`); E.ev(s, { k: "life", p: seat, i: x.i, by }); E.lifeFlipped(s, seat); if (E.critical(P)) E.log(s, seat, `${P.name} เข้าสู่สถานะสาหัส`); return; }
      case "topPeek": { const P = s.P[seat]; const x = P.deck[0]; if (!x) return; const t = E.def(s, x).t; E.log(s, by, `สอดแนม Deck ${P.name}: ${E.name(s, x)}`); if (t === o.type) { E.moveTo(s, x.i, "hell"); E.log(s, by, `${E.name(s, x)} ลงนรก`); } else { P.deck.push(P.deck.shift()); E.log(s, by, "นำไว้ใต้ Deck"); } return; }
      case "rimm": { const L = E.locate(s, o.i); if (L) { L.x.rimm = s.turn; E.log(s, by, `${E.name(s, L.x)} ไม่รับผล React Magic ของฝ่ายตรงข้ามจนจบเทิร์น`); } return; }
      case "duel": { // two Avatars fight without going to sleep, no React (โคกอีสานนูน)
        const A = E.locate(s, o.a), B = E.locate(s, o.b); if (!A || !B || A.z !== "av" || B.z !== "av") return; const ap = E.power(s, A.x), bp = E.power(s, B.x); E.log(s, by, `${E.name(s, A.x)} (${ap}) ต่อสู้กับ ${E.name(s, B.x)} (${bp})`);
        const win = (W, D) => { const sc = !W.x.mute && scriptOf(s, W.x); if (sc && sc.kill && !E.locate(s, D.x.i)?.z?.startsWith("av")) s.trig.push({ id: tid(s), seat: W.p, i: W.x.i, c: W.x.c, when: "kill", dead: D.x.i }); };
        if (ap > bp) { E.destroy(s, B.x.i, `แพ้การต่อสู้ ${bp} ต่อ ${ap}`); win(A, B); } else if (bp > ap) { E.destroy(s, A.x.i, `แพ้การต่อสู้ ${ap} ต่อ ${bp}`); win(B, A); } else if (ap > 0) { E.destroy(s, A.x.i, `พลังเท่ากัน ${ap}`); E.destroy(s, B.x.i, `พลังเท่ากัน ${bp}`); } return; }
      case "rollOff": { // ลุ้นเยี่ยวเหนียว: both roll, the lower one's Avatars go under their owners' Decks
        let r0 = 0, r1 = 0, k = 0; do { r0 = 1 + Math.floor(E.rnd(s) * 6); r1 = 1 + Math.floor(E.rnd(s) * 6); k++; } while (r0 === r1 && k < 6); E.log(s, by, `${s.P[0].name} ทอยได้ ${r0} · ${s.P[1].name} ทอยได้ ${r1}`); if (r0 === r1) return;
        const lo = r0 < r1 ? 0 : 1; for (const x of [...s.P[lo].av]) { if (!E.locate(s, x.i)) continue; E.moveTo(s, x.i, "deckBottom"); } E.log(s, by, `Avatar ทั้งหมดของ ${s.P[lo].name} กลับเข้าใต้ Deck`); if (s.pend) E.endFight(s, true); return; }
      case "fdPay": { // โรงเรียนเวทย์มนต์: summon a จอมเวทย์ from the hand, face-down Magic cards in our Magic Zone pay 1 GEM each
        const P = s.P[seat]; const x = P.hand.find((y) => y.i === o.i); if (!x) return; const cost = E.costOf(s, seat, x); const fd = P.mg.filter((m) => m.fd); const k = Math.min(fd.length, cost);
        const pay = cost - k > 0 ? E.autoPay(s, seat, x.i, cost - k) : []; if (!pay) { E.log(s, by, "GEM ไม่พอ"); return; } for (const m of fd.slice(0, k)) { delete m.fd; E.moveTo(s, m.i, "hell"); }
        for (const i of pay) { const j = P.hand.findIndex((y) => y.i === i); if (j >= 0) { const y = P.hand.splice(j, 1)[0]; P.hell.push(y); E.anyHell(s, [y]); } } E.log(s, by, `ใช้ Magic คว่ำ ${k} ใบ${pay.length ? ` และทิ้ง ${pay.length} ใบ` : ""} เป็น GEM`); E.op(s, { op: "put", i: x.i, jt: true }, by); return; }
      case "faceDown": { const L = E.locate(s, o.i); if (!L || L.z !== "hell" || E.def(s, L.x).t !== "M") return; const x = E.moveTo(s, o.i, "mg", seat); if (x) { x.fd = true; E.log(s, by, `วาง Magic 1 ใบแบบคว่ำบน Magic Zone`); } return; }
      case "gameRule": { // rules for the rest of the game: a summon lock, hand-cost reductions by name
        s.lock = s.lock || [null, null]; if (o.lock) s.lock[seat] = o.lock;
        if (o.costDown) { s.grule = s.grule || [{}, {}]; const g = s.grule[seat]; g.cd = [...(g.cd || []), { name: String(o.costDown.name || ""), n: o.costDown.n | 0, min: o.costDown.min | 0 }]; }
        E.log(s, by, o.why || "กติกาพิเศษตลอดเกมนี้"); return; }
      case "noTarget": { const L = E.locate(s, o.i); if (!L) return; L.x.ntg = s.active === by ? s.turn : s.turn + 1; E.log(s, by, `${E.name(s, L.x)}: ฝ่ายตรงข้ามเลือกเป็นเป้าหมายการโจมตีไม่ได้จนจบเทิร์นของ ${s.P[by].name}`); return; }
      case "nameOnce": { s.nu = s.nu || [{}, {}]; s.nu[seat][String(o.name || "")] = s.turn; return; } // "ใช้ความสามารถของ Avatar ชื่อ … ได้เทิร์นละ 1 ครั้ง"
      case "castFrom": { // เบล่า / ลูเซเน่: use the effect of a Magic. FAQ: it is the ability of the card that used it (not a Magic: สว. นาโนแมชชีน can be destroyed),
        // it does not use the Normal Magic right, and "เมื่อมีการใช้ผลของ Magic" sees it (เดสสึหวา) while "เมื่อมีการใช้ Magic / คาถา" does not (กาลู)
        const L = E.locate(s, o.i); if (!L || E.def(s, L.x).t !== "M") return; const via = s.cur != null && s.cards[s.cur] && s.cards[s.cur].t !== "M" ? s.cur : null;
        s.trig.push({ id: tid(s), seat, i: L.x.i, c: L.x.c, when: "cast", ...(via ? { via, viaI: s.curI } : {}) }); E.log(s, by, `สั่งใช้ผลความสามารถของ ${E.name(s, L.x)}`);
        { const d = E.def(s, L.x); for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.magicSeen && sy.effectSeen && (!sy.magicSeenOk || sy.magicSeenOk(E, s, y, Ly, d, seat))) s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "magicSeen", by: seat, mi: L.x.i }); } }
        return; }
      case "lifeUse": { const P = s.P[seat]; const x = o.i != null ? P.life.find((y) => y.i === o.i && y.up) : P.life.find((y) => !y.up); if (!x) return;
        if (!x.up) { x.up = true; E.log(s, seat, `หงาย LIFE ${E.name(s, x)}`); E.ev(s, { k: "life", p: seat, i: x.i }); E.lifeFlipped(s, seat); if (E.critical(P)) E.log(s, seat, `${P.name} เข้าสู่สถานะสาหัส`); }
        E.log(s, by, `สั่งใช้ความสามารถของ LIFE ${E.name(s, x)}`); E.addTrig(s, seat, x, "life", { now: o.all ? "all" : true }); return; }
      case "resetPower": { const L = E.locate(s, o.i); if (!L) return; if (E.immuneNow(s, L.x, "power")) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; } for (const k of ["pm", "tm", "fm", "tn"]) delete L.x[k]; E.log(s, by, `${E.name(s, L.x)} POWER กลับเป็นค่าตั้งต้น (ตอนนี้ ${E.power(s, L.x)})`); return; }
      case "handToTop": { const P = s.P[seat]; if (!P.hand.length) return; const x = o.random ? P.hand[Math.floor(E.rnd(s) * P.hand.length)] : [...P.hand].sort((a, b) => ((E.def(s, a).pw || 0) + (E.def(s, a).c || 0)) - ((E.def(s, b).pw || 0) + (E.def(s, b).c || 0)))[0]; P.hand.splice(P.hand.indexOf(x), 1); P.deck.unshift(x); E.log(s, seat, `${P.name} แสดง ${E.name(s, x)} แล้ววางไว้บนสุดของ Deck`); return; }
      case "rollScout": { // แมรี่: roll a die, scout that many, an Avatar to the hand, the rest to the bottom
        const P = s.P[seat]; const r = 1 + Math.floor(E.rnd(s) * 6); E.log(s, by, `ทอยลูกเต๋าได้ ${r} · สอดแนม ${Math.min(r, P.deck.length)} ใบ`); const top = P.deck.splice(0, r); const av = top.filter((y) => ["A", "T"].includes(E.def(s, y).t)).sort((a, b) => ((E.def(s, b).pw || 0) + (E.def(s, b).c || 0)) - ((E.def(s, a).pw || 0) + (E.def(s, a).c || 0)))[0];
        if (av) { top.splice(top.indexOf(av), 1); P.hand.push(av); E.log(s, by, `${E.name(s, av)} ขึ้นมือ`); } P.deck.push(...top); return; }
      case "hellLock": { const L = E.locate(s, o.i); if (!L || L.z !== "hell") return; L.x.hlock = true; (s.love = s.love || []).push({ seat, i: o.i, n: 2 }); E.log(s, by, `${E.name(s, L.x)} อยู่ในนรก ออกจากนรกไม่ได้ จนถึง Draw Phase ที่ 2 ของเรา`); return; }
      case "stun": { const L = E.locate(s, o.i); if (L) { L.x.noAct = s.turn; E.log(s, by, `${E.name(s, L.x)} สั่งโจมตีและใช้ความสามารถไม่ได้จนจบเทิร์น`); } return; }
      case "enslave": { // มนุษย์ดาว R18: an Avatar is kept in our Magic Zone as "ข้ารับใช้ของ มนุษย์ดาว R18" {เอเลี่ยน}
        const L = E.locate(s, o.i); if (!L || !["hell", "av"].includes(L.z)) return; const was = E.name(s, L.x); const x = E.moveTo(s, o.i, "mg", seat); if (!x) return; x.nameAs = "ข้ารับใช้ของ มนุษย์ดาว R18"; x.syAs = "เอเลี่ยน"; x.srv = true;
        E.log(s, by, `${was} มาอยู่ที่ Magic Zone ฝ่าย${s.P[seat].name} เป็น "ข้ารับใช้ของ มนุษย์ดาว R18" {เอเลี่ยน}`); return; }
      case "wipe": { // send every card on player seat's field and in their hand to hell (แผนลับของเหล่าพลเอก)
        const P = s.P[seat]; let k = 0; for (const z of ["mg", "av", "cs", "hand"]) for (const x of [...P[z]]) { if (!E.locate(s, x.i)) continue; E.moveTo(s, x.i, "hell"); k++; }
        for (const l0 of E.lands(s).filter((l) => l.o === seat)) { E.moveTo(s, l0.i, "hell"); k++; } E.log(s, by, `ส่งการ์ดบนสนามและบนมือของ ${P.name} ลงนรก ${k} ใบ`); return; }
      case "afterFight": { if (s.pend) (s.pend.af = s.pend.af || []).push(...(o.ops || []).slice(0, 6)); return; }
      case "extraN": { s.xN = s.xN || [null, null]; s.xN[seat] = { t: s.turn, not: String(o.not || ""), only: String(o.only || "") }; E.log(s, by, `เทิร์นนี้ใช้ Normal Magic${o.only ? ` "${o.only}"` : ""} ได้อีก 1 ใบ`); return; }
      case "noShieldAtk": { if (s.pend) { s.pend.nsh = true; E.log(s, by, "ฝ่ายตรงข้ามใช้โล่มนุษย์กับการโจมตีครั้งนี้ไม่ได้"); } return; }
      case "payPut": { // summon a card from the hand by paying its Cost, outside the summon action (นักรบ ฮอล)
        const P = s.P[seat]; const x = P.hand.find((y) => y.i === o.i); if (!x) return; const d = E.def(s, x); const cost = E.costOf(s, seat, x);
        const pay = o.pay || E.autoPay(s, seat, x.i); const r = pay ? E.canPay(s, seat, d, pay, cost) : { ok: false, err: "GEM ไม่พอ" }; if (!r.ok) { E.log(s, by, `จ่าย Cost ของ ${d.n} ไม่ได้ (${r.err})`); return; }
        const paid = []; for (const i of pay) { const k = P.hand.findIndex((y) => y.i === i); if (k < 0) continue; const y = P.hand.splice(k, 1)[0]; P.hell.push(y); paid.push(y); } E.anyHell(s, paid);
        E.log(s, by, `จ่าย ${paid.length} ใบ GEM ${r.total || 0}/${cost}`); E.op(s, { op: "put", i: x.i, jt: !o.noJt, exact: r.exact }, by); if (r.exact) x.px = true; // noJt: summoned by a Magic's effect, no จุติ (FAQ ใบรับสมัครพนักงาน)
        s.trig.push(...paid.filter((y) => { const sc = scriptOf(s, y); return sc ? sc.paid && (!sc.paidFor || sc.paidFor(d)) : E.ext.paid && E.ext.paid(s, y, d); }).map((y) => ({ id: tid(s), seat, i: y.i, c: y.c, when: "paid", for: x.c, forI: x.i })));
        return; }
      case "noReact": { if (s.pend) { s.pend.nr = true; E.log(s, by, "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้นี้"); } return; }
      case "handCost": { const L = E.locate(s, o.i); if (L) { L.x.hcm = { t: s.turn, n: (L.x.hcm && L.x.hcm.t === s.turn ? L.x.hcm.n : 0) + (o.n | 0) }; E.log(s, by, `Cost ของ ${E.name(s, L.x)} ${o.n >= 0 ? "+" : ""}${o.n} ในเทิร์นนี้`); } return; }
      case "costUp": { const L = E.locate(s, o.i); if (L) { L.x.cm = (L.x.cm || 0) + (o.n | 0); E.log(s, by, `Cost ของ ${E.name(s, L.x)} ${o.n >= 0 ? "+" : ""}${o.n}`); } return; }
      case "powerFlip": { const L = E.locate(s, o.i); if (!L) return; let k = 0; for (const f of ["pm", "tm"]) if ((L.x[f] || 0) < 0) { k -= L.x[f]; L.x[f] = -L.x[f]; } if (k) E.log(s, by, `${E.name(s, L.x)} POWER ที่ถูกลดไป ${k} กลายเป็นเพิ่มแทน`); return; }
      case "setPower": { const L = E.locate(s, o.i); if (!L) return; const d = (o.v | 0) - E.power(s, L.x); if (d) E.op(s, { op: "power", i: o.i, n: d, temp: o.temp == null ? true : o.temp }, by); return; }
      case "giveCard": { const P = s.P[seat]; const k = P.hand.findIndex((y) => y.i === o.i); if (k < 0) return; const x = P.hand.splice(k, 1)[0]; s.P[1 - seat].hand.push(x); E.log(s, by, `${P.name} ให้การ์ด 1 ใบบนมือแก่ ${s.P[1 - seat].name}`); return; }
      case "modFromHell": { // หอกแหลมแทงทุกวัน: a Modification Magic used from the hell by its own ability: a real use (it can be answered and cancelled, FAQ)
        const L = E.locate(s, o.i), H = E.locate(s, o.on); if (!L || L.z !== "hell" || !H || H.z !== "av" || s.mu[seat].D) return; const x = L.x, d = E.def(s, x);
        if (!E.modOk(s, x, H.x)) { E.log(s, by, `${d.n} สวมใส่ให้ ${E.name(s, H.x)} ไม่ได้`); return; }
        s.P[L.p].hell.splice(L.idx, 1); x.on = o.on; x.a = true; s.P[H.p].mg.push(x); s.mu[seat].D = true; E.log(s, seat, `ใช้ ${d.n} จากนรก สวมใส่ให้ ${E.name(s, H.x)}`); E.ev(s, { k: "cast", i: x.i, p: seat, st: "D", on: o.on });
        for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute || y.i === x.i) continue; const sy = scriptOf(s, y); if (sy && sy.magicSeen && (!sy.magicSeenOk || sy.magicSeenOk(E, s, y, Ly, d, seat))) s.trig.push({ id: tid(s), seat: Ly.p, i: y.i, c: y.c, when: "magicSeen", by: seat, mi: x.i }); }
        { const sc = scriptOf(s, x); if (sc ? !!sc.cast : !E.ext.modCast || E.ext.modCast(d.x)) E.addTrig(s, seat, x, "cast", { on: o.on }); }
        E.gotMod(s, H.x, x); E.openWindow(s, seat, "cast", x.i); return; }
      case "useMod": { s.mu[seat].D = true; E.log(s, by, "นับว่าใช้ Modification Magic ในเทิร์นนี้แล้ว"); return; }
      case "cancelTid": { const k = s.trig.findIndex((t) => t.id === o.id); if (k < 0) return; const [t] = s.trig.splice(k, 1); // เหน็บกินมือ: the whole ability is cancelled (a Magic it would have kept on the Magic Zone goes to hell)
        if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg" && L.x.on == null) { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } } E.log(s, by, `ยกเลิกผลความสามารถของ ${(s.cards[t.via || t.c] || {}).n || "การ์ดนั้น"}`); return; }
      case "cancelTrig": { const n0 = s.trig.length; const gone = s.trig.filter((t) => t.i === o.i && (o.cast || t.when !== "cast")); s.trig = s.trig.filter((t) => !gone.includes(t)); for (const t of gone) if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg") { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } }
        // FAQ พระพิฆเนศ / กระรอกนิสัยไม่ดี: a cancelled "สั่งใช้" that is not once per turn may be used again this turn (the card did not lose its abilities)
        if (!o.keepUsed) for (const t of gone) if (t.when === "activate") { const L = E.locate(s, t.i); if (L && L.x.used === s.turn && !/เทิร์นละครั้ง/.test(String(E.def(s, L.x).x || ""))) delete L.x.used; }
        if (s.trig.length < n0) E.log(s, by, "ยกเลิกความสามารถนั้น"); return; }
      case "becomeAvatar": { const L = E.locate(s, o.i); if (!L) return; const P = s.P[seat]; if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        if (L.z === "land") E.unLand(s, L.x); else s.P[L.p][L.z].splice(L.idx, 1); L.x.ov = o.ov || {}; L.x.a = true; delete L.x.on; P.av.push(L.x); E.noteSummon(s, seat, L.x); E.log(s, by, `${E.name(s, L.x)} กลายเป็น Avatar บน Avatar Zone`); return; }
      case "setName": { const L = E.locate(s, o.i); if (L) { L.x.nameAs = String(o.name || "").slice(0, 30); E.log(s, by, `${E.def(s, L.x).n} เปลี่ยนชื่อเป็น "${L.x.nameAs}"`); } return; }
      case "mprot": { const L = E.locate(s, o.i); if (L) { L.x.mprot = { until: o.until | 0, all: !!o.all }; E.log(s, by, `${E.name(s, L.x)} ${o.all ? "ไม่รับผลจาก Magic ของฝ่ายตรงข้าม" : "จะไม่ถูกนำออกจากสนามด้วย Magic"} จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`); } return; }
      case "fprot": { if (o.i != null) { const L = E.locate(s, o.i); if (L) { L.x.fprot = Math.max(L.x.fprot || 0, o.until | 0 || s.turn); E.log(s, by, `${E.name(s, L.x)} จะไม่ถูกทำลายจากการต่อสู้`); } return; } for (const x of s.P[seat].av) x.fprot = s.turn; E.log(s, by, "Avatar ฝ่ายเราทุกใบจะไม่ถูกทำลายจากการต่อสู้ในเทิร์นนี้"); return; }
      case "twoWeapons": { s.two = s.two || [null, null]; s.two[seat] = { t: s.turn, name: o.name }; E.log(s, by, `เทิร์นนี้ใช้ Modification "${o.name}" ได้ 2 ใบ และใช้ Modification อื่นไม่ได้`); return; }
      case "borrow": { const O = s.P[1 - seat]; if (!O.hand.length) { E.log(s, by, "มือฝ่ายตรงข้ามไม่มีการ์ด"); return; } const x = O.hand[Math.floor(E.rnd(s) * O.hand.length)]; O.hand.splice(O.hand.indexOf(x), 1); x.borrow = { from: 1 - seat, t: s.turn }; s.P[seat].hand.push(x);
        E.log(s, by, `สุ่มหยิบ ${E.name(s, x)} จากมือฝ่ายตรงข้าม (ใช้ได้แค่เป็นค่า Cost จนจบเทิร์น)`); return; }
      case "randomDeck": { const P = s.P[seat]; if (!P.deck.length) return; const x = P.deck[Math.floor(E.rnd(s) * P.deck.length)]; const d = E.def(s, x); E.log(s, by, `สุ่มได้ ${d.n}`);
        if (d.t === "A" && (d.c || 0) <= (o.maxCost | 0) && E.avatars(P) < 4 && P.av.length < 6) E.op(s, { op: "put", i: x.i }, by); else if (d.t !== "A") E.op(s, { op: "move", i: x.i, to: "hell" }, by); E.shuffle(s, P.deck); return; }
      case "mustShield": { if (s.pend) { s.pend.must = true; E.log(s, by, "ฝ่ายตรงข้ามต้องใช้โล่มนุษย์ในการโจมตีครั้งนี้"); } return; }
      case "redirect": { if (!s.pend) return; if (o.life) { if (s.pend.tk === "life") return; s.pend.tk = "life"; s.pend.ti = null; E.log(s, by, "เปลี่ยนเป้าหมายการโจมตีไปที่ LIFE"); E.retargeted(s); return; }
        const L = E.locate(s, o.i); if (!L || (L.z !== "av" && L.z !== "cs") || L.p === s.pend.by || s.pend.ti === o.i) return; s.pend.tk = L.z; s.pend.ti = o.i; E.log(s, by, `เปลี่ยนเป้าหมายการโจมตีไปที่ ${E.name(s, L.x)}`); E.retargeted(s); return; }
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

// Deck cards with an ability usable from the Deck: one per name
function uniqDeckActs(s, P) { const seen = new Set(); return P.deck.filter((x) => { const sc = scriptOf(s, x); if (!sc || !sc.activate || !sc.activate.fromDeck) return false; const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; }); }
export { uniqDeckActs };
// legal moves for AI/coach
// React Magic with no moment written on it can be used at any time, so also in our own turn
// Rule Book (React Magic): "ใช้ใน Phase ไหนก็ได้ เทิร์นเรา และ เทิร์นอีกฝ่าย ถ้าเงื่อนไขของการ์ดครบ" — a React that names no moment is also played in our own turn
function anytimeReacts(s, p) { const P = s.P[p]; if (s.mu[p].R || E.magicLocked(s, p, "R")) return [];
  return P.hand.filter((x) => { const d = E.def(s, x); const sc = scriptOf(s, x); return d.t === "M" && d.st === "R" && !x.borrow && sc && sc.react && sc.react.anytime && (!sc.canCast || sc.canCast(E, s, p)) && (!sc.react.can || sc.react.can(E, s, p, null, x)); }).map((x) => ({ d: `ใช้ React Magic ${E.name(s, x)}`, a: { type: "cast", i: x.i } })); }
export function legalMoves(s, p) {
  const P = s.P[p], O = s.P[1 - p]; const out = [];
  if (s.phase === "over") return out;
  if (s.trig.length || (s.pend && s.pend.by === p)) return out;
  if (s.pend && s.pend.by === 1 - p) {
    const shields = E.shields(s, p);
    if (!(s.pend.must && shields.length)) out.push({ d: shields.length ? "ไม่ใช้โล่มนุษย์ ปล่อยให้โจมตีตามเดิม" : "ไม่ตอบโต้ ปล่อยให้โจมตี", a: { type: "respond" } });
    for (const x of [...P.hand, ...P.av]) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.answer && x.ans !== s.turn && sc.answer.can(E, s, x, L)) out.push({ d: `${sc.answer.label}: ${E.name(s, x)}`, a: { type: "answer", i: x.i } }); }
    for (const y of shields) out.push({ d: `ใช้โล่มนุษย์ ${E.name(s, y)} (POWER ${E.power(s, y)}) รับแทน`, a: { type: "respond", shield: y.i } });
    return out;
  }
  if (s.phase === "toss") return E.tossMoves(s, p);
  if (s.phase === "mull") return out;
  if (s.active !== p) return out;
  if (s.phase === "end" && s.need) return out;
  if (s.phase === "main") {
    const seen = new Set();
    for (const x of P.hand) {
      const d = E.def(s, x); if (seen.has(x.c)) continue; seen.add(x.c);
      if (d.t === "A" && !x.borrow && E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, p, x) && !E.locked(s, p, x) && !(hk(s, x) || {}).noHand && !((hk(s, x) || {}).uniq && P.av.some((y) => E.name(s, y) === d.n))) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `อัญเชิญ ${d.n} (Cost ${E.costOf(s, p, x)}, POWER ${d.pw || 0}) จ่ายด้วย ${pay.map((i) => E.name(s, P.hand.find((y) => y.i === i))).join(", ") || "ไม่ต้องจ่าย"}`, a: { type: "summon", i: x.i, pay } }); }
      if (d.t === "C" && P.cs.length < 3 && ((hk(s, x) || {}).multiCs || !P.cs.some((y) => E.name(s, y) === d.n))) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `ก่อสร้าง ${d.n} (Cost ${d.c || 0})`, a: { type: "build", i: x.i, pay } }); }
      if (d.t === "A" && scriptOf(s, x) && scriptOf(s, x).handCall && E.avatars(P) < 4 && P.av.length < 6) {
        for (const y of P.hand) { const yd = E.def(s, y); if (y.i === x.i || yd.t !== "A" || !String(yd.sy || "").includes("มังกร")) continue;
          const pay = E.autoPay(s, p, y.i, Math.max(0, E.costOf(s, p, y) - 6), [x.i]); if (pay) out.push({ d: `ทิ้ง ${d.n} เพื่ออัญเชิญ ${yd.n} แบบจุติ (Cost -6)`, a: { type: "summon", i: y.i, pay, via: x.i } }); }
      }
      if (d.t === "M" && !x.borrow && (!s.mu[p][d.st] || E.extraMagic(s, p, x)) && !(d.st === "D" && E.modBlocked(s, p, x)) && d.st !== "R" && !(scriptOf(s, x) && scriptOf(s, x).canCast && !scriptOf(s, x).canCast(E, s, p)) && !(!scriptOf(s, x) && E.ext.canCast && (E.ext.canCast(s, x, p) === false || (E.ext.canCast(s, x, p) == null && P.bot)))) {
        if (d.st === "D" && (scriptOf(s, x) || {}).castFree) out.push({ d: `ใช้ ${d.n}`, a: { type: "cast", i: x.i } });
        else if (d.st === "D") { const so = hk(s, x); for (const y of P.av.filter((h) => E.modOk(s, x, h)).slice(0, 4)) out.push({ d: `สวมใส่ ${d.n} ให้ ${E.name(s, y)}`, a: { type: "cast", i: x.i, on: y.i } }); }
        else out.push({ d: `ใช้ ${SUB_TH[d.st]} Magic ${d.n}`, a: { type: "cast", i: x.i } });
      }
    }
    for (const x of P.hell) { const d = E.def(s, x); if (d.t !== "M" || d.st === "R" || !E.hellCastOk(s, p, x) || (s.mu[p][d.st] && !E.extraMagic(s, p, x)) || (d.st === "D" && E.modBlocked(s, p, x)) || E.magicLocked(s, p, d.st) || (scriptOf(s, x).canCast && !scriptOf(s, x).canCast(E, s, p))) continue; // Magic usable from hell
      if (d.st === "D") { for (const y of P.av.filter((h) => E.modOk(s, x, h)).slice(0, 4)) out.push({ d: `สวมใส่ ${d.n} จากนรก ให้ ${E.name(s, y)}`, a: { type: "cast", i: x.i, on: y.i, from: "hell" } }); }
      else if (d.st !== "L") out.push({ d: `ใช้ ${SUB_TH[d.st]} Magic ${d.n} จากนรก`, a: { type: "cast", i: x.i, from: "hell" } }); }
    for (const x of [...P.av, ...P.cs, ...P.mg, ...P.dark, ...P.hell, ...P.hand, ...uniqDeckActs(s, P), ...E.lands(s)]) { const L = E.actLoc(s, x.i, p); const sc = scriptOf(s, x); if (sc && sc.activate && (sc.activate.multi || x.used !== s.turn) && x.noAct !== s.turn && !E.actBlocked(s, p, x) && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    if (E.ext.acts) for (const x of [...P.av, ...P.cs, ...E.lands(s)]) if (!E.actBlocked(s, p, x)) for (const a of E.ext.acts(s, x, E.actLoc(s, x.i, p))) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${a.label}`, a: { type: "activate", i: x.i, k: a.k } });
    for (const x of P.mg) if (E.krakenCan(s, p, x)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ทิ้งการ์ดบนมือ 2 ใบ อัญเชิญจาก Magic Zone (ความสามารถที่ได้จาก คราเค่น ปลาหมึกปีศาจ)`, a: { type: "activate", i: x.i, k: "kraken" } });
    out.push(...anytimeReacts(s, p));
    out.push({ d: s.turn === 1 ? "จบเทิร์น (เทิร์นแรกไม่มี Battle)" : "ไป Battle Phase", a: { type: "battle" } });
  } else if (s.phase === "battle") {
    for (const x of P.av.filter((y) => y.a && y.noAct !== s.turn && y.frz !== s.turn && !E.hospital(s, p, y) && !E.wornNoAtk(s, y) && !(!y.mute && (hk(s, y) || {}).noAttack && hk(s, y).noAttack(E, s, y)))) {
      const ap = E.power(s, x); const n = E.name(s, x); const tn = E.taunts(s, 1 - p);
      if ((E.oneAttack(s) && s.atk && s.atk.t === s.turn && s.atk.n >= 1) || E.atkLocked(s, p, x)) continue;
      for (const y of O.av.filter((z) => !E.atkSafe(s, z) && !E.atkBy(s, z, x) && (!tn.length || tn.includes(z)))) out.push({ d: `${n} (P${ap}) โจมตี ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "av", ti: y.i } });
      if (tn.length) continue;
      for (const y of O.cs.filter((z) => !E.atkSafe(s, z))) out.push({ d: `${n} (P${ap}) โจมตี Construct ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "cs", ti: y.i } });
      if ((E.lifeOpen(s, p, x) || E.kw(s, x, "เตะไข่")) && !E.noLife(s, x)) out.push({ d: `${n} (P${ap}) โจมตี LIFE`, a: { type: "attack", i: x.i, tk: "life" } });
    }
    for (const x of [...P.av, ...P.hand, ...P.mg]) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.activate && sc.activate.battle && x.used !== s.turn && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    out.push(...anytimeReacts(s, p));
    // an Avatar that a worn card forces to attack (สตีฟ Tank Ranger) must do so before the turn can end
    if (!(E.forced(s, p) && out.some((m) => m.a.type === "attack")) && !P.av.some((x) => x.a && (x.mustAtk === s.turn || [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostMust)) && out.some((m) => m.a.type === "attack" && m.a.i === x.i))) out.push({ d: "จบเทิร์น", a: { type: "end" } });
  }
  return out;
}
