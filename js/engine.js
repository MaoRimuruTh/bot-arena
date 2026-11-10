// Game engine — official Rule Book 3.2; card text effects are resolved by players or Ciel through ops.
import { card, kwHas, SUB_TH, CARDS, baseId, nameText, syText, allSy, hasFieldAlias, normName, colorIs } from "./cards.js?v=20261111004012";
import { readAura, traits, modPowerFor } from "./auras.js?v=20261111004012";
import { SCRIPTS } from "./scripts.js?v=20261111004012";
import { newId, clone } from "./util.js?v=20261111004012";
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
// static rules of a card: its script if it has one, otherwise what can be read from its text (see auras.js traits)
// a card's rules: its hand-written script, plus the printed rules read from its text (the script wins where both say something)
const hkMerged = new Map();
// does this card's ability fire at `when`? A script handles the timings it defines; the others are read from the printed text.
const fires = (s, x, when, re) => { if (x.mute) return false; const sc = scriptOf(s, x); if (sc && when in sc) return !!sc[when] && !(when === "attack" && sc.storyOnly && !x.story); const t = E.def(s, x).x || ""; return E.ext.trig ? E.ext.trig(t, when) : !!(re && re.test(t)); };
const hk = (s, x) => { const sc = scriptOf(s, x); const tr = traits(E.def(s, x)); if (!sc || !tr) return sc || tr; let m = hkMerged.get(sc); if (!m) { m = { ...tr, ...sc }; hkMerged.set(sc, m); } return m; };
const FIELD = ["av", "cs", "mg"];
const COLORS = ["แดง", "ฟ้า", "เขียว", "ม่วง"];
const LINKS = new Map(); // card text → names in its [Link …]
export const END_RE = /อัตโนมัติ\s*ใน(?:ช่วง|ทุกๆ)?\s*End Phase(\s*(?:ของ)?\s*เรา)?/;
export const MAIN_RE = /อัตโนมัติ\s*(?:เมื่อ|ใน)?(?:ช่วง)?\s*เริ่ม(?:ต้น)?\s*Main Phase\s*(?:ของ)?\s*เรา/;
function fieldCards(s) { const out = []; for (let p = 0; p < 2; p++) for (const z of FIELD) for (const x of s.P[p][z]) out.push({ x, L: { p, z } }); if (s.land) out.push({ x: s.land, L: { p: s.land.o, z: "land" } }); return out; }
const ATTACKED_RE = /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*ถูกโจมตี/;
const WIN_RE = /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*ทำลาย\s*Avatar\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*จากการต่อสู้/;
export const E = {
  hooks: (s, x) => hk(s, x), // script or text-derived static rules of a card
  ext: {}, // filled in by effects.js: acts(s, x, L) → text abilities usable now, react(s, x, p, on) → may this React answer now
  ev(s, o) { s.evc = (s.evc || 0) + 1; (s.ev = s.ev || []).push({ id: s.evc, ...o }); if (s.ev.length > 40) s.ev.shift(); },
  rnd(s) { s.seed = (s.seed + 0x6D2B79F5) | 0; let t = s.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
  shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(E.rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  def: (s, x) => (x.ov ? { ...(s.cards[x.c] || {}), ...x.ov } : s.cards[x.c] || { n: "?", t: "A", x: "" }),
  name: (s, x) => E.def(s, x).n,
  log(s, seat, m) { s.log.push({ t: s.turn, s: seat, m }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); },
  kw(s, x, k) { if (x.mute) return false; const d = E.def(s, x); return kwHas(d.x, k) || (x.kw || []).includes(k) || (x.kt || []).some((e) => e.k === k) || E.auraKw(s, x, k); },
  // keywords handed out by continuous effects on the field, or by a Modification it wears
  auraKw(s, x, k) {
    const me = E.locate(s, x.i); if (!me || me.z !== "av") return false;
    for (const { x: src, L } of fieldCards(s)) { const sc = scriptOf(s, src); const ra = sc && sc.aura ? null : !src.mute && readAura(E.def(s, src));
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; for (const a of list) if (a.kw && a.kw.includes(k) && a.seat === me.p && a.test(x)) return true; }
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) { const tr = traits(E.def(s, m)); if (tr && tr.modKw && tr.modKw.includes(k)) return true; }
    return false;
  },
  magicInHell: (s, p) => s.P[p].hell.filter((x) => E.def(s, x).t === "M").length,
  power(s, x) {
    const d = E.def(s, x); let mb = 0;
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i) { const sm = scriptOf(s, m); mb += sm && sm.worn ? sm.worn(E, s, m, x) : modBonus(E.def(s, m).x) || modPowerFor(E, s, m, x); }
    // cards worn by the Avatar attacking this one that weaken its target (e.g. ปืนฉมวก)
    if (s.pend && s.pend.tk === "av" && s.pend.ti === x.i) { const A = E.locate(s, s.pend.att); if (A) for (const P of s.P) for (const m of P.mg) if (m.on === A.x.i) { const sm = scriptOf(s, m); if (sm && sm.foeWorn) mb += sm.foeWorn(E, s, m, A.x, x) || 0; } }
    const tn = x.tn ? Object.values(x.tn).reduce((a, b) => a + b, 0) : 0;
    let au = 0; const me = E.locate(s, x.i);
    if (me && me.z === "av") for (const { x: src, L } of fieldCards(s)) { const sc = scriptOf(s, src); const ra = sc && sc.aura ? null : !src.mute && readAura(E.def(s, src));
      const list = sc && sc.aura ? sc.aura(E, s, src, L) : ra ? ra.run(E, s, src, L) : []; for (const a of list) if (a.seat === me.p && a.test(x)) au += a.n; }
    if (me && me.z === "av" && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).noLower)) return Math.max(0, (x.zero ? 0 : d.pw || 0) + Math.max(0, x.pm || 0) + Math.max(0, x.tm || 0) + Math.max(0, x.fm || 0) + Math.max(0, tn) + Math.max(0, mb) + Math.max(0, au));
    return Math.max(0, (x.zero ? 0 : d.pw || 0) + (x.pm || 0) + (x.tm || 0) + (x.fm || 0) + tn + mb + au);
  },
  costOf(s, p, x) { // Cost after continuous reductions (e.g. ซาร์อึก)
    let c = E.def(s, x).c || 0; { const own = x.mute ? null : scriptOf(s, x); if (own && own.selfCost) c += own.selfCost(E, s, x, p) || 0; }
    for (const { x: src, L } of fieldCards(s)) { if (L.p !== p) continue; const sc = scriptOf(s, src); if (sc && sc.costMod) c += sc.costMod(E, s, src, L, x); }
    { const ls = s.land && !s.land.mute ? scriptOf(s, s.land) : null; if (ls && ls.costAll) c += ls.costAll(E, s, x) || 0; } // Land effects on every hand
    return Math.max(0, c);
  },
  untargetable(s, x) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); return !!(L && sc && sc.untargetable && sc.untargetable(E, s, x, L)); },
  // names / Symbols a card counts as (printed "#Avatar ใบนี้ถือว่ามีชื่อ …" rules included)
  onField(s, x) { const L = E.locate(s, x.i); return !!L && (L.z === "av" || L.z === "cs"); },
  named(s, x, n) { if (x.nameAs) return normName(x.nameAs).includes(normName(n)); const d = E.def(s, x); return nameText(d, hasFieldAlias(d) && E.onField(s, x)).includes(normName(n)); },
  hasSy(s, x, k) { if (x.syAs) return x.syAs === k; const o = E.syOver(s, x); if (o) return o === k; { const own = x.mute ? null : scriptOf(s, x); if (own && own.extraSy === k) return true; } const d = E.def(s, x); const on = hasFieldAlias(d) && E.onField(s, x); return allSy(d, on) || syText(d, on).includes(k); },
  syOver(s, x) { if (x.on != null || !s.P) return null; let o = null, lock = false; for (const P of s.P) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sc = scriptOf(s, m); if (sc && sc.syLock) lock = true; else if (sc && sc.syOver) o = sc.syOver; } return lock ? null : o; },
  // "เมื่อ LIFE Card ของเราถูกหงาย": field cards of that player with a lifeFlip script
  lifeFlipped(s, p) { for (const { x: y, L: Ly } of fieldCards(s)) if (Ly.p === p && !y.mute && (scriptOf(s, y) || {}).lifeFlip) s.trig.push({ id: newId(), seat: p, i: y.i, c: y.c, when: "lifeFlip", optional: true }); },
  // extra cards seen by a scout of player p's card `src` (วัดคู่บ้านคู่เมือง …)
  scoutBonus(s, p, src) { let n = 0; for (const { x: y, L: Ly } of fieldCards(s)) if (Ly.p === p && !y.mute) { const sy = scriptOf(s, y); if (sy && sy.scoutMore) n += sy.scoutMore(E, s, y, Ly, src) || 0; } return n; },
  // Avatars that may not attack LIFE right now (printed restrictions)
  noLife(s, x) { if (x.nlt === s.turn) return true; { const L = E.locate(s, x.i); if (L && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p !== L.p && !y.mute && (scriptOf(s, y) || {}).lifeGuard)) return true; } if (x.mute) return false; const h = hk(s, x); return !!(h && h.noLife && h.noLife(E, s, x)); }, // lifeGuard: ป้อมยาม
  // the fight is over: "until the end of the fight" POWER changes end
  endFight(s, cancelled) { const pd = s.pend; s.pend = null; for (const q of [0, 1]) for (const y of s.P[q].av) delete y.fm;
    if (pd && pd.af && pd.af.length) E.ops(s, pd.af, pd.by);
    // แทงหลัง: when the fight is over, an attacker that shares no colour with a backstabbing helper is destroyed
    if (!cancelled && pd && pd.bs && pd.bs.length) { const A = E.locate(s, pd.att); if (A && A.z === "av") { const ac = E.colors(s, A.x); const bad = pd.bs.find((b) => !b.co.some((c) => ac.includes(c)));
      if (bad) E.destroy(s, A.x.i, `แทงหลังของ ${bad.n}: สีต่างกับผู้โจมตี ถูกทำลายเมื่อจบการต่อสู้`); } }
  },
  // colours a card counts as (printed colour plus "ถือว่ามีสี …" rules)
  mgActive(s, x, L) { return L.z === "mg" && x.on == null && fieldCards(s).some(({ x: y, L: Ly }) => Ly.p === L.p && Ly.z === "av" && !y.mute && (scriptOf(s, y) || {}).mgAbilities && scriptOf(s, y).mgAbilities(E, s, y, x)); },
  colors(s, x) { const d = E.def(s, x); const on = hasFieldAlias(d) && E.onField(s, x); return COLORS.filter((c) => colorIs(d, c, on)); },
  // how Avatar y of player p may help attacker att: สามัคคี adds its POWER, แทงหลัง adds +1 (risky: other colour → attacker destroyed after the fight)
  helpOf(s, p, att, y) {
    if (!y.a || y.i === att.i || y.mute) return null;
    if (E.kw(s, y, "สามัคคี") && !fieldCards(s).some(({ x: z, L }) => L.p !== p && !z.mute && (scriptOf(s, z) || {}).noUnite)) return { k: "u", n: E.power(s, y) };
    if (E.kw(s, y, "แทงหลัง")) { const yc = E.colors(s, y), ac = E.colors(s, att); return { k: "b", n: 1, risky: !yc.some((c) => ac.includes(c)) }; }
    return null;
  },
  // x cannot be chosen by its opponent's card abilities (its own rule, or a protection such as กวนอู's)
  noAim(s, x) { if (E.untargetable(s, x) || x.imm === s.turn) return true; const L = E.locate(s, x.i); if (!L) return false;
    for (const { x: src, L: Ls } of fieldCards(s)) { if (Ls.p !== L.p || src.mute) continue; const sc = scriptOf(s, src); if (sc && sc.noAim && sc.noAim(E, s, src, Ls, x, L)) return true; } return false; },
  // the attack now goes to another Avatar: cards waiting for that moment fire (ลิโป้ …)
  retargeted(s) { let n = 0; for (const { x: y, L } of fieldCards(s)) { if (y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.retarget && (!sc.retargetOk || sc.retargetOk(E, s, y, L))) { s.trig.push({ id: newId(), seat: L.p, i: y.i, c: y.c, when: "retarget", optional: true }); n++; } } return n; },
  // Avatars that say "the opponent can attack nothing but this card"
  modOk(s, m, host) { const hs = host.mute ? null : hk(s, host); if (hs && hs.noMod) return false; if (hs && hs.anyMod) return true; const sc = hk(s, m); return !(sc && sc.modOnly && !sc.modOnly(E, s, host)); }, // noMod: แมมมอธแช่แข็ง · anyMod: รีวิวแมน
  noControl(s, x) { return !x.mute && !!(hk(s, x) || {}).noControl; },
  // "ในเทิร์นนี้ Avatar {X} ที่เราอัญเชิญ … ได้รับ": buffs given to Avatars summoned later this turn
  summonBuff(s, p, x) { const b = s.tbuff && s.tbuff[p]; if (!b || b.t !== s.turn || (b.sy && !E.hasSy(s, x, b.sy))) return;
    if (b.imm) x.imm = s.turn; if (b.kw) x.kt = [...(x.kt || []), ...b.kw.map((k) => ({ k, end: s.turn }))]; if (b.noShield) x.nsh = s.turn; E.log(s, p, `${E.name(s, x)} ได้รับความสามารถจนจบเทิร์น`); },
  // awake Avatars of p that a worn card forces to attack and that have something to attack
  mustAttack(s, p) { return s.P[p].av.filter((x) => x.a && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostMust) && legalMoves(s, p).some((m) => m.a.type === "attack" && m.a.i === x.i)); },
  atkLocked(s, p, x) { const t = s.tlock && s.tlock[p]; return !!(t && t.t === s.turn && t.atkSy && !E.hasSy(s, x, t.atkSy)); },
  deckOpen(s) { return fieldCards(s).some(({ x }) => !x.mute && (scriptOf(s, x) || {}).openDeck); },
  // is x unaffected by the effect resolving now? (ช่วยโลกใบนี้ไว้ this turn, ริกกี้ คุณตา against the opponent's Magic, มาติเนซ's one-time cancel)
  immuneNow(s, x, opName) { const L = E.locate(s, x.i); if (!L || L.z !== "av") return false; if (x.imm === s.turn && s.cur != null && s.curSeat !== L.p) return true;
    const src = s.cur != null ? s.cards[s.cur] : null; if (!src || src.t !== "M" || s.curSeat == null || s.curSeat === L.p) return false;
    if (!x.mute && (scriptOf(s, x) || {}).magicProof) return true;
    if (x.mprot && x.mprot.until >= s.turn && (x.mprot.all || (opName !== "power" && opName !== "mute"))) return true;
    const blk = [...s.P[0].mg, ...s.P[1].mg].find((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).magicBlock); if (blk) { E.log(s, L.p, `${E.name(s, blk)} ถูกทำลาย: ยกเลิกความสามารถของ ${src.n} ที่มีต่อ ${E.name(s, x)}`); E.moveTo(s, blk.i, "hell"); s.blockedCur = s.cur; x.blk = s.turn; return true; }
    return x.blk === s.turn && s.blockedCur === s.cur; },
  hostSaved(s, x, L, fromOpp) { for (const P of s.P) for (const m of P.mg) { if (m.on !== x.i || m.mute || m.used === s.turn) continue; const sc = scriptOf(s, m); if (sc && sc.hostSave) { const r = sc.hostSave(E, s, m, x, { fromOpp }); if (r != null) { m.used = s.turn; if (r) return true; } } } return false; },
  // what p summoned this turn (เครื่องบิน Super Air)
  noteSummon(s, p, x) { s.sum = s.sum || [null, null]; if (!s.sum[p] || s.sum[p].t !== s.turn) s.sum[p] = { t: s.turn, n: [] }; s.sum[p].n.push(E.name(s, x)); },
  summonedNow(s, p) { return s.sum && s.sum[p] && s.sum[p].t === s.turn ? s.sum[p].n : []; },
  // a Magic that may be used even though one of its kind was used this turn
  extraMagic(s, p, x) { const d = E.def(s, x); const sc = scriptOf(s, x);
    if (d.st === "N") { if (fieldCards(s).some(({ x: y, L }) => L.p === p && !y.mute && (scriptOf(s, y) || {}).freeMagic && scriptOf(s, y).freeMagic(E, s, x))) return true; const xn = s.xN && s.xN[p]; return !!(xn && xn.t === s.turn && !xn.used && d.n !== xn.not); } if (d.st === "R") return !!(sc && sc.react && sc.react.ignoreLimit && !s.mu[p].R2);
    if (d.st === "D") { const two = s.two && s.two[p] && s.two[p].t === s.turn; return !!(two && !s.two[p].used && String(d.n || "").includes(s.two[p].name)); } return false; },
  modBlocked(s, p, x) { const two = s.two && s.two[p] && s.two[p].t === s.turn; return !!(two && !String(E.def(s, x).n || "").includes(s.two[p].name)); },
  handed(s, x) { const sc = x.mute ? null : scriptOf(s, x); const src = s.cur != null ? s.cards[s.cur] : null; if (sc && sc.handed && (!sc.handedOk || sc.handedOk(E, s, x, src))) s.trig.push({ id: newId(), seat: x.o, i: x.i, c: x.c, when: "handed", optional: true }); },
  oneAttack(s) { const sc = s.land && !s.land.mute ? scriptOf(s, s.land) : null; return !!(sc && sc.oneAttack); },
  // awake Avatars of player p that can take the pending attack with โล่มนุษย์
  shields(s, p) { if (!s.pend || s.pend.nsh) return []; const A = E.locate(s, s.pend.att); if (A && A.x.nsh === s.turn) return []; return s.P[p].av.filter((y) => y.a && y.i !== s.pend.ti && E.kw(s, y, "โล่มนุษย์")); },
  taunts(s, p) { return s.P[p].av.filter((y) => { if (y.mute) return false; const h = hk(s, y); return !!(h && h.taunt && h.taunt(E, s, y)); }); },
  battleMod(s, me, foe) { const sc = scriptOf(s, me); let n = sc && sc.battle ? sc.battle(E, s, me, foe) : 0; const fo = foe ? scriptOf(s, foe) : null; if (fo && fo.foeBattle && E.def(s, me).t !== "C") n += fo.foeBattle(E, s, foe, me) || 0; return n; },
  locked(s, p, x) { const d = E.def(s, x); if (s.lock && s.lock[p] === "dragon") return !(String(d.sy || "").includes("มังกร") || String(d.n || "").includes("ผู้ฝึกมังกร"));
    const t = s.tlock && s.tlock[p]; if (t && t.t === s.turn) { if (t.sy && !E.hasSy(s, x, t.sy)) return true; if (t.names && t.names.includes(d.n)) return true; if (t.only && !String(d.n || "").includes(t.only)) return true; } return false; },
  locate(s, i) {
    for (let p = 0; p < 2; p++) for (const z of ZONES) { const idx = s.P[p][z].findIndex((x) => x.i === i); if (idx >= 0) return { p, z, idx, x: s.P[p][z][idx] }; }
    if (s.land && s.land.i === i) return { p: s.land.o, z: "land", idx: 0, x: s.land };
    return null;
  },
  // Avatars counted against the 4-Avatar limit (พิภพรัททาทุย: 6 while every Avatar of ours is รัททาทุย, so 2 are not counted)
  avatars: (P) => { const n = P.av.filter((x) => !x.tok).length; return P.c6 ? Math.max(0, n - 2) : P.c3 ? n + 1 : n; }, // c3: นรกในกรง (only 3 Avatars)
  sync(s) { if (s.later2 && s.later2.length && !s.inCheck) { const ids = s.later2; s.later2 = []; for (const i of ids) { const L = E.locate(s, i); if (L && L.z === "av") { E.log(s, L.p, `${E.name(s, L.x)} ถูกส่งลงนรก (การ์ดที่สวมใส่ออกจากสนาม)`); E.moveTo(s, i, "hell"); } } } E.capSync(s); E.linkSync(s); E.stateCheck(s); },
  stateCheck(s) { if (s.inCheck || s.phase === "over") return; s.inCheck = true; try { for (const { x, L } of fieldCards(s)) { if (x.mute) continue; const sc = scriptOf(s, x); if (sc && sc.check) { const ops = sc.check(E, s, x, L) || []; if (ops.length) E.ops(s, ops, L.p); } } } finally { delete s.inCheck; } },
  // [Link ชื่อ]: an Avatar is in Link status while an Avatar with that name is also on its Avatar Zone
  linkNames(s, x) { const t = String(E.def(s, x).x || ""); let v = LINKS.get(t); if (!v) { v = [...t.matchAll(/\[\s*Link\s+([^\]]+?)\s*\]/g)].map((m) => m[1].trim()); LINKS.set(t, v); } return v; },
  linked(s, x) { const L = E.locate(s, x.i); if (!L || L.z !== "av" || x.mute) return false; const ns = E.linkNames(s, x); return ns.length > 0 && s.P[L.p].av.some((y) => y.i !== x.i && ns.some((n) => E.named(s, y, n))); },
  linkSync(s) { if (s.phase === "over") return; for (const p of [0, 1]) for (const x of s.P[p].av) { const now = E.linked(s, x);
      if (now && !x.lk) { x.lk = true; E.log(s, p, `${E.name(s, x)} เข้าสู่สถานะ [Link]`); if (fires(s, x, "link")) E.addTrig(s, p, x, "link"); } else if (!now && x.lk) delete x.lk; }
    for (const p of [0, 1]) for (const z of ["hand", "deck", "hell", "dark", "life", "mg", "cs"]) for (const x of s.P[p][z]) if (x.lk) delete x.lk; },
  // Cost of a card now ("ปรับค่า Cost … จนจบเทิร์น")
  costNow(s, x) { if (x.cst && x.cst.t === s.turn) return x.cst.v; let c = (E.def(s, x).c || 0) + (x.cm || 0); const L = E.locate(s, x.i); if (!L || (L.z !== "av" && L.z !== "cs")) return Math.max(0, c);
    for (const P of s.P) for (const m of P.mg) if (m.on === x.i && !m.mute) { const sc = scriptOf(s, m); if (sc && sc.wornCost) c += sc.wornCost; }
    for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.costAura) c += sc.costAura(E, s, y, Ly, x, L) || 0; }
    return Math.max(0, c); },
  capSync(s) { for (const p of [0, 1]) { const P = s.P[p]; const sc = s.land && s.land.o === p && !s.land.mute ? scriptOf(s, s.land) : null; if (sc && sc.cap6 && P.av.every((x) => sc.cap6(E, s, x))) P.c6 = true; else delete P.c6; }
    { const sc = s.land && !s.land.mute ? scriptOf(s, s.land) : null; for (const P of s.P) if (sc && sc.cap3) P.c3 = true; else delete P.c3; } },
  // may Avatar x join p's Avatar Zone? (only a card that keeps the six-slot rule may use the two extra slots)
  fits6(s, p, x) { const P = s.P[p]; if (!P.c6) return true; const sc = scriptOf(s, s.land); return !!(sc && sc.cap6 && sc.cap6(E, s, x)) || P.av.filter((y) => !y.tok).length < 4; },
  critical: (P) => P.life.length > 0 && P.life.every((x) => x.up),

  newGame({ players, decks, seed, first, mode, id }) {
    const s = { v: 1, id: id || newId(), mode, seed: seed | 0, turn: 0, active: first, first, phase: "mull", land: null, cards: {}, nextI: 1, log: [], trig: [], pend: null, need: 0,
      winner: null, reason: "", mull: [false, false], mu: [{}, {}], played: [{}, {}], startedAt: Date.now(), P: [] };
    for (let p = 0; p < 2; p++) {
      const pl = players[p];
      const P = { uid: pl.uid || null, name: pl.name, ava: pl.ava || "", bot: !!pl.bot, deckName: decks[p].name || "", deckId: decks[p].id || null, deck: [], hand: [], av: [], mg: [], cs: [], hell: [], dark: [], life: [] };
      const mk = (id) => { const c = card(id); s.cards[id] = s.cards[id] || { n: c.n, t: c.t, st: c.st, c: c.c, g: c.g, gc: c.gc, pw: c.pw, sy: c.sy, co: c.co, x: c.x || "", o1: c.o1, im: +id, ...(c.al ? { al: c.al } : {}) }; return { i: s.nextI++, c: String(id), o: p, a: true }; };
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
    for (const x of s.P[p].av) { if (x.nw && x.nw >= s.turn) { E.log(s, p, `${E.name(s, x)} ยังไม่ตื่น (ผลของการ์ดที่สวมใส่)`); continue; } delete x.nw; x.a = true; }
    for (const q of [0, 1]) for (const x of s.P[q].av) if (x.tn) { delete x.tn[p]; if (!Object.keys(x.tn).length) delete x.tn; } // "until our next Draw Phase" bonuses end
    const P = s.P[p]; const n = P.hand.length < 3 ? 3 - P.hand.length : 1;
    E.log(s, p, `เทิร์น ${s.turn} · ${P.name} จั่ว ${n} ใบ`);
    const swap = fieldCards(s).find(({ x, L }) => L.p === p && !x.mute && (scriptOf(s, x) || {}).replacesDraw && (L.z !== "mg" || x.on != null));
    if (swap) s.trig.push({ id: newId(), seat: p, i: swap.x.i, c: swap.x.c, when: "drawPhase", n }); // รูปปั้นพระอิศวร: scout instead of the normal draw
    else { if (!E.draw(s, p, n)) return; for (const y of P.hand.slice(-n)) { const sc = scriptOf(s, y); if (sc && sc.drawn && (!sc.drawnOk || sc.drawnOk(E, s, y))) s.trig.push({ id: newId(), seat: p, i: y.i, c: y.c, when: "drawn", optional: true }); } }
    for (const { x, L } of fieldCards(s)) { const sc = x.mute ? null : scriptOf(s, x); if (L.p === p && sc && sc.drawPhase && !sc.replacesDraw && (!sc.drawPhaseOk || sc.drawPhaseOk(E, s, x, L))) s.trig.push({ id: newId(), seat: p, i: x.i, c: x.c, when: "drawPhase", optional: true }); }
    { let k = 0; for (const { x, L } of fieldCards(s)) if (L.p === p && !x.mute && (L.z !== "mg" || E.mgActive(s, x, L))) k += (scriptOf(s, x) || {}).drawMore || 0; if (k) { E.log(s, p, `จั่วเพิ่ม ${k} ใบ (ความสามารถต่อเนื่อง)`); if (!E.draw(s, p, k)) return; } }
    if (s.turn <= 2) { const q = P.deck.find((y) => (scriptOf(s, y) || {}).firstDraw); if (q) s.trig.push({ id: newId(), seat: p, i: q.i, c: q.c, when: "firstDraw", drawn: P.hand.slice(-n).map((y) => y.i), optional: true }); }
    s.phase = "main";
    if (s.later && s.later.length) { const now = s.later.filter((l) => l.seat === p && l.at !== "battle"); s.later = s.later.filter((l) => !now.includes(l)); for (const l of now) { E.log(s, p, l.why || "เอฟเฟกต์ที่รอ Main Phase นี้"); if (l.t) s.trig.push({ id: newId(), ...l.t }); else E.ops(s, l.ops || [], p); } }
    { const k0 = s.trig.length; for (const { x, L } of fieldCards(s)) if (L.p === p && !x.mute && ((MAIN_RE.test(String(E.def(s, x).x || "")) && (!E.ext.trig || E.ext.trig(E.def(s, x).x, "mainStart"))) || (scriptOf(s, x) || {}).mainStart)) E.addTrig(s, p, x, "mainStart");
      const early = s.trig.slice(k0).filter((t) => (s.cards[t.c] && (scriptOf(s, { c: t.c }) || {}).early)); if (early.length) s.trig.splice(k0, s.trig.length - k0, ...early, ...s.trig.slice(k0).filter((t) => !early.includes(t))); } // "อัตโนมัติ เมื่อเริ่ม Main Phase เรา :" (Cost changers first)
  },
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
    s.trig.push({ id: newId(), seat, i: x.i, c: x.c, when, ...extra });
  },
  // move a card instance anywhere; handles leave-field cleanup
  moveTo(s, i, to, seatOverride) {
    const L = E.locate(s, i); if (!L) throw new RuleError("ไม่พบการ์ด");
    const x = L.x;
    if (L.z === "land") s.land = null; else s.P[L.p][L.z].splice(L.idx, 1);
    if (L.z === "av") for (const q of [0, 1]) { const att = s.P[q].mg.filter((m) => m.on === x.i); for (const m of att) { s.P[q].mg.splice(s.P[q].mg.indexOf(m), 1); delete m.on; s.P[m.o].hell.push(m); E.log(s, m.o, `${E.name(s, m)} หลุดลงนรก (Avatar ที่สวมใส่ออกจากสนาม)`); E.fellToHell(s, m); } }
    if (L.z === "mg" && x.on) { const H = E.locate(s, x.on); if (H && H.x.muteBy === x.i) { delete H.x.mute; delete H.x.muteBy; } delete x.on; if (H && H.z === "av" && !x.mute && (scriptOf(s, x) || {}).leaveKillsHost) s.later2 = [...(s.later2 || []), H.x.i]; }
    if (x.tok && to !== "av") { E.log(s, L.p, `Token ${E.name(s, x)} ถูกนำออกจากเกม`); return null; }
    x.a = true; x.pm = 0; x.tm = 0; for (const k of ["kw", "kt", "ua", "tn", "fm", "story", "mute", "zero", "muteEnd", "guard", "used", "saved", "exd", "canAtk", "back", "lk", "cst", "nlt", "hs", "sb", "t0", "muteBy", "ind", "imm", "nsh", "cm", "ups", "blk"]) delete x[k]; if (to !== "life") delete x.up; if (!["av", "mg", "cs", "land"].includes(to)) { delete x.nameAs; delete x.syAs; delete x.ov; delete x.srv; }
    const owner = x.o; const ctl = seatOverride != null ? seatOverride : (L.z === "land" ? owner : L.p);
    const dest = { hand: owner, hell: owner, dark: owner, deckTop: owner, deckBottom: owner, life: seatOverride != null ? seatOverride : owner }[to];
    if (to === "deckTop") s.P[dest].deck.unshift(x);
    else if (to === "deckBottom") s.P[dest].deck.push(x);
    else if (to === "life") { x.up = false; s.P[dest].life.push(x); }
    else if (to === "land") { if (s.land) { const old = s.land; s.land = null; s.P[old.o].hell.push(old); } s.land = x; }
    else if (["av", "mg", "cs"].includes(to)) s.P[ctl][to].push(x);
    else if (dest != null) s.P[dest][to].push(x);
    else throw new RuleError("โซนไม่ถูกต้อง");
    if (to === "hell") E.fellToHell(s, x);
    if (to === "land") x.t0 = s.turn;
    return x;
  },
  // "เมื่อการ์ดใบนี้ตกลงสู่นรก" (ตีแม่, ตีพ่อ …)
  fellToHell(s, x) { const sc = x.mute ? null : scriptOf(s, x); if (sc && sc.toHell) s.trig.push({ id: newId(), seat: x.o, i: x.i, c: x.c, when: "toHell" }); },
  // x may not be chosen as an attack target right now (its own rule or a protection that only covers attacks)
  atkSafe(s, x) { if (E.untargetable(s, x)) return true; const L = E.locate(s, x.i); const sc = L && !x.mute ? scriptOf(s, x) : null; return !!(sc && sc.noAtk && sc.noAtk(E, s, x, L)); },
  destroy(s, i, cause, opt = {}) {
    const L = E.locate(s, i); if (!L) return;
    // cards of the same owner that stop or take this destruction instead (พันเรือง, อาจารย์ธรรมโชติ …): saveOther returns { why, ops } or null
    if (!opt.noSave && (s.saving || 0) < 3) { const fight = /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")); const P = s.P[L.p];
      for (const [z, list] of [["av", P.av], ["cs", P.cs], ["mg", P.mg], ["hand", P.hand], ["land", s.land && s.land.o === L.p ? [s.land] : []]]) for (const y of list) {
        if (y.i === L.x.i || y.mute) continue; const sy = scriptOf(s, y); if (!sy || !sy.saveOther) continue; const r = sy.saveOther(E, s, y, { p: L.p, z }, L.x, L, { fight, cause }); if (!r) continue;
        E.log(s, L.p, r.why); s.saving = (s.saving || 0) + 1; try { E.ops(s, r.ops || [], L.p); } finally { s.saving--; } if (!r.also) return; } }
    if (L.x.guard) { delete L.x.guard; E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลาย (ได้รับการป้องกัน)`); return; }
    if (L.x.ind === s.turn) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายในเทิร์นนี้`); return; }
    if (L.x.fprot === s.turn && /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายจากการต่อสู้ในเทิร์นนี้`); return; }
    if (s.pend && /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && (s.pend.att === L.x.i || s.pend.ti === L.x.i)) { const foe = E.locate(s, s.pend.att === L.x.i ? s.pend.ti : s.pend.att); const sc = L.x.mute ? null : scriptOf(s, L.x);
      if (foe && sc && sc.fightImmune && sc.fightImmune(E, s, L.x, foe.x)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่ถูกทำลายจากการต่อสู้นี้ (ความสามารถต่อเนื่อง)`); return; } }
    if (!/^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")) && E.immuneNow(s, L.x)) { E.log(s, L.p, `${E.name(s, L.x)} ไม่รับผลความสามารถของการ์ด`); return; }
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
      if (L.z === "av" && E.hostSaved(s, L.x, L, fromOpp)) return;
      if (sc && sc.wouldDestroy && L.x.saved !== s.turn && sc.wouldDestroy(E, s, L.x, L, { fight, fromOpp, cause })) { L.x.saved = s.turn; return; } }
    const x = L.x; const tok = x.tok; const had = kwHas(E.def(s, x).x, "คำสั่งเสีย") || !!(!x.mute && (scriptOf(s, x) || {}).death);
    E.ev(s, { k: "destroy", i, p: L.p });
    if (x.exd) { E.moveTo(s, i, "dark"); E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย แล้วถูกเนรเทศ (คำสั่งเสีย : เนรเทศการ์ดใบนี้)`); if (had && !tok) E.addTrig(s, x.o, x, "death"); if (L.z === "av") E.died(s, L.p, x, cause, opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || ""))); return; }
    const dTo = L.z === "av" && !x.mute && (scriptOf(s, x) || {}).destroyTo;
    E.moveTo(s, i, "hell");
    E.log(s, L.p, `${E.name(s, x)} ถูกทำลาย${cause ? " (" + cause + ")" : ""}`);
    if (dTo === "deckBottom" && E.locate(s, i)?.z === "hell") { E.moveTo(s, i, "deckBottom"); E.log(s, L.p, `${E.name(s, x)} กลับเข้าใต้ Deck แทนการลงนรก`); }
    if (had && !tok) E.addTrig(s, x.o, x, "death");
    if (L.z === "av") E.died(s, L.p, x, cause, opt.by != null ? opt.by !== L.p : /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")));
  },
  // an Avatar of player p was destroyed: "เมื่อ Avatar … ฝ่ายเราถูกทำลาย" abilities fire and p may answer with a React
  died(s, p, x, cause, fromOpp) {
    for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p || y.i === x.i || y.mute) continue; const sc = scriptOf(s, y); if (sc && sc.allyDeath && (!sc.allyOk || sc.allyOk(E, s, y, Ly, x))) s.trig.push({ id: newId(), seat: p, i: y.i, c: y.c, when: "allyDeath", dead: x.i }); }
    for (const y of s.P[p].hand) { const sc = scriptOf(s, y); if (sc && sc.handDeath && (!sc.handDeathOk || sc.handDeathOk(E, s, y, x))) s.trig.push({ id: newId(), seat: p, i: y.i, c: y.c, when: "handDeath", dead: x.i, optional: true }); }
    const on = { kind: "destroyed", by: 1 - p, i: x.i, p, fight: /^(?:แพ้|เสมอ|พลังเท่ากัน)/.test(String(cause || "")), opp: !!fromOpp };
    if (!s.rw && s.phase !== "over" && E.reactsFor(s, p, on).length) s.rw = on;
  },
  gemOf(s, p, x, targetDef) { const d = E.def(s, x); const g = d.g || 0; { const own = x.mute ? null : scriptOf(s, x); if (own && own.gemFor && targetDef) { const v = own.gemFor(targetDef); if (v != null) return v; } } const sc = s.land && !s.land.mute ? scriptOf(s, s.land) : null;
    if (sc && sc.powerGem && targetDef && targetDef.t === "A" && String(targetDef.sy || "").includes(sc.powerGem) && d.t === "A" && String(d.sy || "").includes(sc.powerGem)) return Math.max(g, d.pw || 0); return g; },
  colorless(s, x) { const sc = s.land && !s.land.mute ? scriptOf(s, s.land) : null; return !!(sc && sc.colorlessGem && sc.colorlessGem(E, s, x)); }, // สภาแบงค์
  canPay(s, p, targetDef, pay, costOverride) {
    const P = s.P[p]; const cost = costOverride != null ? costOverride : targetDef.c || 0; let total = 0; const seen = new Set();
    for (const i of pay) {
      if (seen.has(i)) return { ok: false, err: "เลือกซ้ำ" }; seen.add(i);
      const x = P.hand.find((y) => y.i === i); if (!x) return { ok: false, err: "การ์ดจ่ายต้องอยู่บนมือ" };
      const d = E.def(s, x); const g = E.gemOf(s, p, x, targetDef);
      if (g <= 0) return { ok: false, err: `${d.n} มี GEM 0 ใช้จ่ายไม่ได้` };
      if (s.ban && s.ban[p].includes(d.n)) return { ok: false, err: `${d.n} ใช้เป็น Cost ไม่ได้ (ผลของการ์ดที่ใช้ไปแล้ว)` };
      if (d.gc && targetDef.co && d.gc !== targetDef.co && !(traits(targetDef) || {}).anyColor && !E.colorless(s, x)) return { ok: false, err: `GEM สี${d.gc} จ่ายให้การ์ดสี${targetDef.co} ไม่ได้` };
      { const sc = hk(s, x); if (sc && sc.payOnly && !sc.payOnly(targetDef)) return { ok: false, err: `${d.n} ใช้จ่ายได้เฉพาะการ์ดที่กำหนดเท่านั้น` }; }
      total += g;
    }
    if (total < cost) return { ok: false, err: `GEM ไม่พอ (${total}/${cost})`, total };
    for (const i of pay) { if (total - E.gemOf(s, p, P.hand.find((y) => y.i === i), targetDef) >= cost) return { ok: false, err: "จ่ายเกินจำเป็น (GEM พอแล้วจ่ายเพิ่มไม่ได้)", total }; }
    return { ok: true, total, exact: total === cost };
  },
  autoPay(s, p, i, costOverride, exclude = []) {
    const P = s.P[p]; const tgt = P.hand.find((x) => x.i === i); if (!tgt) return null;
    const td = E.def(s, tgt); const cost = costOverride != null ? costOverride : E.costOf(s, p, tgt); if (cost === 0) return [];
    const el = P.hand.filter((x) => x.i !== i && !exclude.includes(x.i)).filter((x) => { const d = E.def(s, x); const sc = hk(s, x); return E.gemOf(s, p, x, td) > 0 && !(x.borrow && false) && !(s.ban && s.ban[p].includes(d.n)) && !(d.gc && td.co && d.gc !== td.co && !(traits(td) || {}).anyColor) && !(sc && sc.payOnly && !sc.payOnly(td)); }).slice(0, 12);
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
    if (s.phase === "over") return []; if (s.mu[p].R) return s.P[p].hand.filter((x) => { const sc = scriptOf(s, x); return sc && sc.react && sc.react.ignoreLimit && !s.mu[p].R2 && sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)); });
    if (s.pend && s.pend.nr && s.pend.by !== p) return []; // "ฝ่ายตรงข้ามไม่สามารถสั่งใช้งาน React Magic จนจบการต่อสู้"
    return s.P[p].hand.filter((x) => { const d = E.def(s, x); if (d.t !== "M" || d.st !== "R") return false; const sc = scriptOf(s, x);
      if (sc && sc.react) return sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)) && (!sc.canCast || sc.canCast(E, s, p));
      if (!sc && E.ext.react) { const r = E.ext.react(s, x, p, on); if (r != null) return r; } // timing read from the card text
      return !s.P[p].bot && !(sc && sc.canCast && !sc.canCast(E, s, p)); });
  },
  // after a summon or a Magic, the other player may answer with a React before effects resolve
  openWindow(s, p, kind, i) { const q = 1 - p; const on = { kind, by: p, i }; if (E.reactsFor(s, q, on).length) s.rw = on; },

  apply(s, act, p) { E.sync(s); try { return E.act0(s, act, p); } finally { E.sync(s); } },
  act0(s, act, p) {
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
        need(!x.borrow, "การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญเท่านั้น");
        if (act.type === "summon") need(!E.locked(s, p, x), "อัญเชิญการ์ดใบนี้ไม่ได้ในเทิร์นนี้ (ผลของการ์ดที่ใช้ไปแล้ว)");
        { const sc = hk(s, x); need(!(sc && sc.noHand), "การ์ดใบนี้ลงสนามจากบนมือไม่ได้"); if (act.type === "summon") need(!(sc && sc.uniq && P.av.some((y) => E.name(s, y) === d.n)), `ควบคุม ${d.n} บน Avatar Zone ได้เพียง 1 ใบ`); }
        if (act.type === "summon") { need(d.t === "A", "อัญเชิญได้เฉพาะ Avatar"); need(E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, p, x), "Avatar Zone เต็ม (Avatar 4 / รวม Token 6)"); }
        else { need(d.t === "C", "ก่อสร้างได้เฉพาะ Construct"); need(P.cs.length < 3, "Construct Zone เต็ม (3 ใบ)"); need(!P.cs.some((y) => E.name(s, y) === d.n), "Construct ชื่อซ้ำในฝ่ายเดียวกันไม่ได้"); }
        const r = E.canPay(s, p, d, act.pay || [], cost); need(r.ok, r.err);
        if (via) { P.hand.splice(P.hand.indexOf(via), 1); P.hell.push(via); s.lock = s.lock || [null, null]; s.lock[p] = "dragon"; E.log(s, p, `ทิ้ง ${E.name(s, via)} เพื่ออัญเชิญมังกรแบบจุติ (Cost -6) · จากนี้อัญเชิญได้เฉพาะมังกร`); }
        const paid = [];
        for (const i of act.pay || []) { const k = P.hand.findIndex((y) => y.i === i); const y = P.hand.splice(k, 1)[0]; P.hell.push(y); paid.push(y); }
        P.hand.splice(P.hand.indexOf(x), 1); x.a = true; (act.type === "summon" ? P.av : P.cs).push(x);
        E.ev(s, { k: "summon", i: x.i, p });
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        E.log(s, p, `${act.type === "summon" ? "อัญเชิญ" : "ก่อสร้าง"} ${d.n} (จ่าย ${(act.pay || []).length} ใบ GEM ${r.total || 0}/${cost})${r.exact && kwHas(d.x, "พอดี") ? " · พอดี!" : ""}`);
        const scS = scriptOf(s, x); if (r.exact) x.px = true; if (act.type === "summon") E.noteSummon(s, p, x);
        if (scS && scS.summon) { if (!scS.storyOnly || x.story) E.addTrig(s, p, x, "summon", { exact: r.exact }); }
        else if (kwHas(d.x, "จุติ")) E.addTrig(s, p, x, "summon", { exact: r.exact });
        else if (act.type === "build" && d.x && fires(s, x, "build")) E.addTrig(s, p, x, "build"); // only Constructs with a "when built" ability
        { const pt = paid.filter((y) => { const sc = scriptOf(s, y); return sc ? sc.paid && (!sc.paidFor || sc.paidFor(d)) : act.type === "summon" && E.ext.paid && E.ext.paid(s, y, d); }).map((y) => ({ id: newId(), seat: p, i: y.i, c: y.c, when: "paid", for: x.c, forI: x.i }));
          const k = s.trig.findIndex((t) => t.i === x.i); s.trig.splice(k < 0 ? s.trig.length : k, 0, ...pt); } // paying happens before จุติ
        if (act.type === "summon") { E.summonBuff(s, p, x); E.openWindow(s, p, "summon", x.i); }
        return;
      }
      case "cast": {
        const x = P.hand.find((y) => y.i === act.i); need(x, "การ์ดไม่อยู่บนมือ");
        const d = E.def(s, x); need(d.t === "M", "ใช้ได้เฉพาะ Magic");
        need(!x.borrow, "การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญเท่านั้น");
        need(s.phase !== "mull" && (!s.mu[p][d.st] || E.extraMagic(s, p, x)), `Magic ประเภท ${SUB_TH[d.st]} ใช้ไปแล้วเทิร์นนี้`);
        if (d.st === "D") need(!E.modBlocked(s, p, x), "เทิร์นนี้ใช้ได้เฉพาะ Modification ที่การ์ดกำหนด");
        { const sc = scriptOf(s, x); need(!(sc && sc.canCast && !sc.canCast(E, s, p)), "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้");
          if (!sc && E.ext.canCast) need(E.ext.canCast(s, x, p) !== false, "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้"); }
        if (d.st !== "R") need(E.canAct(s, p) && s.phase === "main", `${SUB_TH[d.st]} Magic ใช้ได้เฉพาะ Main Phase ของคุณ`);
        let on = null;
        if (d.st === "R") {
          on = s.rw && s.rw.by !== p ? { ...s.rw } : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
          const sc = scriptOf(s, x); if (sc && sc.react) need(on && sc.react.kinds.includes(on.kind) && (!sc.react.can || sc.react.can(E, s, p, on, x)), "ยังไม่ถึงจังหวะของ React ใบนี้");
          else if (!sc && E.ext.react) need(on ? E.ext.react(s, x, p, on, true) !== false : !!(E.ext.reactFree && E.ext.reactFree(s, x)) && E.canAct(s, p), "ยังไม่ถึงจังหวะของ React ใบนี้");
        }
        if (d.st === "R" && s.mu[p].R) s.mu[p].R2 = true; // a React allowed after another one (อย่าให้มีครั้งที่ 2)
        if (d.st === "D" && s.mu[p].D && E.extraMagic(s, p, x)) s.two[p].used = true;
        if (d.st === "N" && s.mu[p].N && s.xN && s.xN[p] && s.xN[p].t === s.turn && !fieldCards(s).some(({ x: y, L }) => L.p === p && !y.mute && (scriptOf(s, y) || {}).freeMagic && scriptOf(s, y).freeMagic(E, s, x))) s.xN[p].used = true;
        s.mu[p][d.st] = true; P.hand.splice(P.hand.indexOf(x), 1);
        if (s.active === p) for (const { x: y, L: Ly } of fieldCards(s)) { if (Ly.p !== p) continue; const sy = scriptOf(s, y); if (sy && sy.onMagic) { const ops = sy.onMagic(E, s, y, Ly); if (ops && ops.length) E.ops(s, ops, p); } }
        s.played[p][x.c] = (s.played[p][x.c] || 0) + 1;
        for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.magicSeen && (!sy.magicSeenOk || sy.magicSeenOk(E, s, y, Ly, d, p))) s.trig.push({ id: newId(), seat: Ly.p, i: y.i, c: y.c, when: "magicSeen", by: p }); }
        if (d.st === "D" && act.on == null && (scriptOf(s, x) || {}).castFree) { P.mg.push(x); E.log(s, p, `ใช้ Modification Magic ${d.n}`); E.addTrig(s, p, x, "cast", { toHell: true }); }
        else if (d.st === "D") {
          const host = E.locate(s, act.on); need(host && host.z === "av", "ต้องเลือก Avatar บนสนามเพื่อสวมใส่");
          need(E.modOk(s, x, host.x), "สวมใส่ให้ Avatar ใบนี้ไม่ได้ (ไม่ตรงเงื่อนไขของการ์ด)");
          x.on = act.on; P.mg.push(x); E.log(s, p, `สวมใส่ ${d.n} ให้ ${E.name(s, host.x)}`);
          { const sc = scriptOf(s, x); if (sc ? !!sc.cast : !E.ext.modCast || E.ext.modCast(d.x)) E.addTrig(s, p, x, "cast", { on: act.on }); }
        } else if (d.st === "L") {
          if (s.land) { const old = s.land; s.land = null; s.P[old.o].hell.push(old); E.log(s, p, `${E.name(s, old)} ถูกแทนที่`); }
          s.land = x; E.log(s, p, `ใช้ Land Magic ${d.n}`); if (!(scriptOf(s, x) && !scriptOf(s, x).cast)) E.addTrig(s, p, x, "cast"); E.ev(s, { k: "cast", i: x.i, p, st: "L" });
        } else {
          P.mg.push(x); E.log(s, p, `ใช้ ${SUB_TH[d.st]} Magic ${d.n}`); E.ev(s, { k: "cast", i: x.i, p, st: d.st });
          if (d.x) E.addTrig(s, p, x, "cast", { toHell: true }); else { P.mg.splice(P.mg.indexOf(x), 1); P.hell.push(x); }
          if (d.st === "R") { const k = s.trig.findIndex((t) => t.i === x.i); if (k > 0) { const [t] = s.trig.splice(k, 1); s.trig.unshift(t); } if (k >= 0) s.trig[0].on = on; s.rw = null; E.openWindow(s, p, "react", x.i); }
        }
        if (d.st !== "R") E.openWindow(s, p, "cast", x.i);
        return;
      }
      case "pass": { need(s.rw && s.rw.by !== p, "ไม่มีจังหวะให้ตอบโต้"); E.log(s, p, `${P.name} ไม่ตอบโต้`); s.rw = null; return; }
      case "battle": {
        need(E.canAct(s, p) && s.phase === "main", "ไปเฟสต่อสู้ได้จาก Main Phase");
        if (s.turn === 1) { E.log(s, p, "เทิร์นแรกของผู้เริ่มก่อนไม่มี Battle Phase"); return E.apply(s, { type: "end" }, p); }
        s.phase = "battle"; E.log(s, p, "เข้าสู่ Battle Phase"); E.ev(s, { k: "battle", p }); E.openWindow(s, p, "battle", null);
        for (const y of P.av) { const sb = y.mute ? null : scriptOf(s, y); if (sb && sb.battleStart) sb.battleStart(E, s, y); } // "ถ้า … ในช่วงเริ่ม Battle Phase"
        if (s.later && s.later.length) { const now = s.later.filter((l) => l.seat === p && l.at === "battle" && l.after < s.turn); s.later = s.later.filter((l) => !now.includes(l)); for (const l of now) { E.log(s, p, l.why || "เอฟเฟกต์ที่รอ Battle Phase นี้"); if (l.t) s.trig.push({ id: newId(), ...l.t }); else E.ops(s, l.ops || [], p); } }
        return;
      }
      case "attack": {
        need(E.canAct(s, p) && s.phase === "battle", "โจมตีได้เฉพาะ Battle Phase ของคุณ");
        const x = P.av.find((y) => y.i === act.i); need(x && x.a, "ต้องเป็น Avatar ที่ตื่นอยู่บน Avatar Zone"); need(x.noAct !== s.turn, "เทิร์นนี้ Avatar ใบนี้สั่งโจมตีไม่ได้");
        need(!(E.oneAttack(s) && s.atk && s.atk.t === s.turn && s.atk.n >= 1), "เทิร์นนี้สั่งโจมตีได้แค่ 1 ครั้ง (Land Magic บนสนาม)");
        need(!E.atkLocked(s, p, x), "เทิร์นนี้สั่งโจมตีได้เฉพาะ Avatar ที่การ์ดกำหนด");
        { const sc = x.mute ? null : hk(s, x); need(!(sc && sc.noAttack && sc.noAttack(E, s, x)), "Avatar ใบนี้โจมตีไม่ได้"); }
        { const tn = E.taunts(s, 1 - p); if (tn.length) need(act.tk === "av" && tn.some((y) => y.i === act.ti), `ต้องโจมตี ${E.name(s, tn[0])} เท่านั้น (ความสามารถต่อเนื่องของการ์ดใบนั้น)`); }
        if (act.tk === "av") { need(O.av.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Avatar Zone ฝ่ายตรงข้าม"); need(!E.atkSafe(s, E.locate(s, act.ti).x), "Avatar ใบนี้ถูกโจมตีไม่ได้ตอนนี้"); }
        else if (act.tk === "cs") need(O.cs.some((y) => y.i === act.ti), "เป้าหมายไม่อยู่บน Construct Zone");
        else if (act.tk === "life") { need(!O.av.length || E.kw(s, x, "เตะไข่"), "ฝ่ายตรงข้ามยังมี Avatar อยู่ (ยกเว้นเตะไข่)"); need(!E.noLife(s, x), "Avatar ใบนี้โจมตี LIFE ไม่ได้ตอนนี้ (เงื่อนไขบนการ์ด)"); }
        else throw new RuleError("เป้าหมายไม่ถูกต้อง");
        let bonus = 0; const sup = [], bs = [], stab = [];
        for (const i of act.sup || []) {
          const y = P.av.find((z) => z.i === i); const hp = y ? E.helpOf(s, p, x, y) : null; if (!hp) continue;
          bonus += hp.n; y.a = false; sup.push(i);
          if (hp.k === "b") { bs.push({ i, n: E.name(s, y), co: E.colors(s, y) }); const sy = y.mute ? null : scriptOf(s, y); if (sy && sy.stab && (!sy.stabOk || sy.stabOk(E, s, y, x))) stab.push(y); }
        }
        x.a = false;
        s.pend = { att: x.i, tk: act.tk, ti: act.ti || null, bonus, sup, by: p, ...(bs.length ? { bs } : {}) };
        s.atk = s.atk && s.atk.t === s.turn ? { t: s.turn, n: s.atk.n + 1 } : { t: s.turn, n: 1 };
        for (const { x: y, L: Ly } of fieldCards(s)) { if (y.mute) continue; const sy = scriptOf(s, y); if (sy && sy.onDeclare) { const ops = sy.onDeclare(E, s, y, Ly, p) || []; if (ops.length) { E.log(s, Ly.p, `เอฟเฟกต์ ${E.name(s, y)}`); E.ops(s, ops, Ly.p); } } }
        for (const y of stab) s.trig.push({ id: newId(), seat: p, i: y.i, c: y.c, when: "stab" });
        E.ev(s, { k: "declare", att: x.i, by: p, tk: act.tk, ti: act.ti || null });
        const tName = act.tk === "life" ? "LIFE" : E.name(s, E.locate(s, act.ti).x);
        E.log(s, p, `${E.name(s, x)} (POWER ${E.power(s, x) + bonus}) โจมตี ${tName}${sup.length ? ` · ผู้ช่วย ${sup.length} ใบ +${bonus}` : ""}`);
        {
          for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostAttack) s.trig.push({ id: newId(), seat: p, i: m.i, c: m.c, when: "hostAttack" });
          if (fires(s, x, "attack", /เมื่อ\s*(?:Avatar\s*|การ์ด)?(?:ใบนี้|ตัวนี้)?\s*(?:ประกาศ)?โจมตี|เมื่อโจมตี/)) E.addTrig(s, p, x, "attack"); }
        if (act.tk === "av") { const T = E.locate(s, act.ti).x; if (fires(s, T, "attacked", ATTACKED_RE)) E.addTrig(s, 1 - p, T, "attacked"); }
        return;
      }
      case "answer": { // an ability usable when the opponent attacks (from the hand or the field)
        need(s.pend && s.pend.by === 1 - p && !s.trig.length, "ยังไม่ถึงจังหวะ"); const L = E.locate(s, act.i); need(L && L.p === p, "ไม่พบการ์ดของคุณ"); const sc = scriptOf(s, L.x);
        need(sc && sc.answer && sc.answer.can(E, s, L.x, L) && L.x.ans !== s.turn, "ใช้ความสามารถนี้ตอนนี้ไม่ได้"); L.x.ans = s.turn;
        s.trig.push({ id: newId(), seat: p, i: L.x.i, c: L.x.c, when: "answer" }); E.log(s, p, `ใช้ความสามารถของ ${E.name(s, L.x)}`); return; }
      case "respond": {
        need(s.pend && s.pend.by === 1 - p && !s.trig.length, "ยังไม่ถึงจังหวะตอบโต้");
        if (s.pend.must && !act.shield) need(!E.shields(s, p).length, "ต้องใช้โล่มนุษย์ (ความสามารถของผู้โจมตี)");
        if (act.shield) {
          need(E.shields(s, p).some((y) => y.i === act.shield), "ใช้โล่มนุษย์กับการโจมตีนี้ไม่ได้");
          // โล่มนุษย์: an awake Avatar with the keyword goes to sleep and becomes the target instead
          const y = P.av.find((z) => z.i === act.shield); need(y && E.kw(s, y, "โล่มนุษย์") && y.i !== s.pend.ti, "ต้องเป็น Avatar ที่มีโล่มนุษย์");
          need(y.a, "โล่มนุษย์ใช้ได้เฉพาะ Avatar ที่อยู่ในสภาพตื่น");
          y.a = false; s.pend.tk = "av"; s.pend.ti = y.i; E.log(s, p, `${E.name(s, y)} ใช้โล่มนุษย์ เปลี่ยนเป็นสภาพนอนแล้วรับการโจมตีแทน`);
          { const sy2 = y.mute ? null : scriptOf(s, y); if (sy2 && sy2.onShield) E.ops(s, sy2.onShield(E, s, y) || [], p); }
          if (E.retargeted(s)) { s.pend.go = true; return; } // the fight waits for those effects
        }
        E.startFight(s); return;
      }
      case "end": {
        need(E.canAct(s, p) && (s.phase === "main" || s.phase === "battle"), "จบเทิร์นได้เฉพาะเทิร์นของคุณ");
        if (s.phase === "battle") { const m = E.mustAttack(s, p); need(!m.length, `${E.name(s, m[0] || {})} ต้องโจมตีก่อน (ความสามารถของการ์ดที่สวมใส่)`); }
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
        else { if (act.explain) E.log(s, p, `เอฟเฟกต์ ${nm}: ${act.explain}`); s.cur = t.c; s.curSeat = t.seat; try { E.ops(s, act.ops || [], p); } finally { delete s.cur; delete s.curSeat; } }
        if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg" && L.x.on == null) { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } }
        if (s.pend && !s.trig.length && s.pend.resolved) s.pend = null;
        if (s.pend && !s.trig.length && s.pend.go) { delete s.pend.go; E.startFight(s); }
        if (s.endWait && !s.trig.length && s.phase === "end") { delete s.endWait; E.finishTurn(s); }
        return;
      }
      case "op": { E.ops(s, act.ops || [], p); return; }
      case "activate": { // scripted once-per-turn ability on the field
        const L = E.locate(s, act.i); need(L && L.p === p, "ไม่พบการ์ดของคุณ"); const sc = scriptOf(s, L.x);
        need(E.canAct(s, p) && (s.phase === "main" || (s.phase === "battle" && sc && sc.activate && sc.activate.battle)), "สั่งใช้ตอนนี้ไม่ได้");
        if (act.k != null) { // an ability read from the card text (see effects.js)
          need(s.phase === "main" && E.ext.acts && E.ext.acts(s, L.x, L).some((a) => a.k === act.k), "ใช้ความสามารถนี้ไม่ได้ตอนนี้");
          (L.x.ua = L.x.ua || {})[act.k] = s.turn; s.trig.push({ id: newId(), seat: p, i: L.x.i, c: L.x.c, when: "activate", k: act.k }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)}`); if (L.z === "av") E.openWindow(s, p, "activate", L.x.i); return;
        }
        need(sc && sc.activate && sc.activate.can(E, s, L.x, L), "ใช้ความสามารถนี้ไม่ได้ตอนนี้"); need(L.x.used !== s.turn, "ใช้ไปแล้วในเทิร์นนี้"); need(L.x.noAct !== s.turn, "เทิร์นนี้ใช้ความสามารถของการ์ดใบนี้ไม่ได้");
        L.x.used = s.turn; s.trig.push({ id: newId(), seat: p, i: L.x.i, c: L.x.c, when: "activate" }); E.log(s, p, `สั่งใช้ความสามารถ ${E.name(s, L.x)}`); if (L.z === "av") E.openWindow(s, p, "activate", L.x.i); return;
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
  // the fight begins: "เมื่อ Avatar ใบนี้ต่อสู้" abilities of both Avatars resolve first, then POWER is compared
  startFight(s) { const pd = s.pend; if (!pd) return;
    if (!pd.ft && pd.tk !== "life") { pd.ft = true; let n = 0; const A = E.locate(s, pd.att); const T = pd.ti != null ? E.locate(s, pd.ti) : null;
      if (A && A.z === "av" && T && (T.z === "av" || T.z === "cs")) { if (fires(s, A.x, "fight")) { E.addTrig(s, A.p, A.x, "fight"); n++; } if (T.z === "av" && fires(s, T.x, "fight")) { E.addTrig(s, T.p, T.x, "fight"); n++; }
        if (T.z === "av") for (const [H, F] of [[A, T], [T, A]]) for (const m of [...s.P[0].mg, ...s.P[1].mg]) { if (m.on !== H.x.i || m.mute) continue; const sc = scriptOf(s, m); if (sc && sc.hostFight && (!sc.hostFightOk || sc.hostFightOk(E, s, m, H.x, F.x))) { s.trig.push({ id: newId(), seat: H.p, i: m.i, c: m.c, when: "hostFight", foe: F.x.i }); n++; } } }
      if (n) { pd.go = true; return; } }
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
      else { const sa = att.mute ? null : scriptOf(s, att); const hits = Math.max(1, (sa && sa.lifeHits && sa.lifeHits(E, s, att)) || 1); const quiet = !!(sa && sa.lifeQuiet && sa.lifeQuiet(E, s, att));
        for (let j = 0; j < hits && s.phase !== "over"; j++) E.damageLife(s, 1 - pd.by, pd.by, { quiet }); }
    } else {
      const T = E.locate(s, pd.ti);
      if (!T || (pd.tk === "av" && T.z !== "av") || (pd.tk === "cs" && T.z !== "cs")) { E.log(s, pd.by, "เป้าหมายหายไป การโจมตีสิ้นสุด"); E.endFight(s); return; }
      const tp = Math.max(0, E.power(s, T.x) + (pd.tk === "av" ? E.battleMod(s, T.x, att) : 0));
      if (pd.tk === "cs") {
        if (ap > tp) E.destroy(s, T.x.i, `แพ้พลัง ${ap} ต่อ ${tp}`); else E.log(s, pd.by, `Construct ${E.name(s, T.x)} รับไว้ได้ (${ap} ต่อ ${tp})`);
      } else if (ap === 0 && tp === 0) E.log(s, pd.by, "POWER 0 ปะทะ 0 ไม่มีอะไรเกิดขึ้น");
      else if (ap > tp) { const dead = T.x; E.destroy(s, T.x.i, `แพ้การต่อสู้ ${tp} ต่อ ${ap}`); if (fires(s, att, "win", WIN_RE) && !E.locate(s, dead.i)?.z?.startsWith("av")) s.trig.push({ id: newId(), seat: pd.by, i: att.i, c: att.c, when: "win", diff: ap - tp, dead: dead.i });
        if (!att.mute && (scriptOf(s, att) || {}).kill && !E.locate(s, dead.i)?.z?.startsWith("av")) s.trig.push({ id: newId(), seat: pd.by, i: att.i, c: att.c, when: "kill", dead: dead.i });
        // cards worn by the winner that react to it ("เมื่อ Avatar ที่สวมใส่การ์ดนี้ทำลาย Avatar อีกฝ่ายจากการต่อสู้")
        if (E.locate(s, att.i) && !E.locate(s, dead.i)?.z?.startsWith("av")) for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === att.i && (scriptOf(s, m) || {}).hostWin) s.trig.push({ id: newId(), seat: pd.by, i: m.i, c: m.c, when: "hostWin", optional: true }); }
      else if (tp > ap) { E.destroy(s, att.i, `แพ้การต่อสู้ ${ap} ต่อ ${tp}`); const D = E.locate(s, T.x.i); if (D && D.z === "av" && !T.x.mute && (scriptOf(s, T.x) || {}).kill && !E.locate(s, att.i)?.z?.startsWith("av")) s.trig.push({ id: newId(), seat: D.p, i: T.x.i, c: T.x.c, when: "kill", dead: att.i }); }
      else {
        const ah = E.kw(s, att, "ลูกฮึด"), dh = E.kw(s, T.x, "ลูกฮึด");
        if (ah && !dh) E.destroy(s, T.x.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        else if (dh && !ah) E.destroy(s, att.i, "เสมอ แต่อีกฝ่ายมีลูกฮึด");
        else { E.destroy(s, att.i, `พลังเท่ากัน ${ap}`); E.destroy(s, T.x.i, `พลังเท่ากัน ${tp}`); }
      }
      // "when this Avatar attacked and was not destroyed in the fight"
      if (pd.tk === "av") { const T2 = E.locate(s, T.x.i); const st = T2 && T2.z === "av" && !T.x.mute ? scriptOf(s, T.x) : null; if (st && st.survived) s.trig.push({ id: newId(), seat: T2.p, i: T.x.i, c: T.x.c, when: "survived", optional: true });
        for (const m of [...s.P[0].mg, ...s.P[1].mg]) if (m.on === T.x.i && (scriptOf(s, m) || {}).atkShield) E.moveTo(s, m.i, "hell"); } // ประกันชั้นต่ำ is used up by the attack
      { const A2 = E.locate(s, att.i); const sa = A2 && A2.z === "av" && !att.mute ? scriptOf(s, att) : null; if (sa && sa.afterFight) s.trig.push({ id: newId(), seat: pd.by, i: att.i, c: att.c, when: "afterFight", optional: true }); }
    }
    E.endFight(s);
  },
  damageLife(s, d, by, o = {}) {
    const P = s.P[d];
    if (E.critical(P)) { E.lose(s, d, `${s.P[by].name} โจมตี LIFE ขณะ ${P.name} อยู่ในสถานะสาหัส`); return; }
    const x = P.life.find((y) => !y.up); if (!x) return;
    x.up = true; E.log(s, d, `LIFE ของ ${P.name} ถูกหงาย: ${E.name(s, x)}`); E.ev(s, { k: "life", p: d, i: x.i });
    if (o.quiet) E.log(s, d, "ความสามารถของ LIFE ใบนี้ไม่ทำงาน"); else E.addTrig(s, d, x, "life"); E.lifeFlipped(s, d);
    if (E.critical(P)) E.log(s, d, `${P.name} เข้าสู่สถานะสาหัส`);
  },
  // effect operations (from Claude or manual tools)
  ops(s, list, by) {
    for (const o of list.slice(0, 30)) {
      try { E.op(s, o, by); } catch (e) { E.log(s, by, `ทำผล "${o.op}" ไม่ได้: ${e.message}`); } E.sync(s);
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
        // "when our cards' abilities mill, mill N more" (นายนิรยบาล อ้วน)
        let more = 0; if (!o.plain) for (const { x: y, L: Ly } of fieldCards(s)) { const sy = y.mute ? null : scriptOf(s, y); if (sy && sy.millMore) more += sy.millMore(E, s, y, Ly, { seat, by, src: s.cards[o.src || s.cur] || null }) || 0; }
        const P = s.P[seat]; const k = Math.min(n + more, P.deck.length); const got = P.deck.splice(0, k);
        for (const x of got) { const sc = o.virus && scriptOf(s, x); if (sc && sc.virusExile) P.dark.push(x); else P.hell.push(x); }
        { // cards that react to being milled: millBy "any", or "god" = by a purple {เทพ} Avatar or a Magic card
          const src = s.cards[o.src || s.cur] || null; const byGod = !!src && (src.t === "M" || (["A", "T"].includes(src.t) && String(src.sy || "").includes("เทพ") && src.co === "ม่วง"));
          for (const x of got) { if (!P.hell.includes(x)) continue; const sc = scriptOf(s, x); const mb = sc ? (sc.milled ? sc.millBy || "god" : null) : E.ext.milled ? E.ext.milled(s, x) : null; if (mb && (mb === "any" || (mb === "godAv" ? byGod && src.t !== "M" : byGod))) s.trig.push({ id: newId(), seat: x.o, i: x.i, c: x.c, when: "milled", optional: true }); } }
        E.log(s, seat, `ธรณีสูบ ${k} ใบ: ${got.map((x) => E.name(s, x)).join(", ")}${o.virus && got.some((x) => (scriptOf(s, x) || {}).virusExile) ? " (ไวรัสที่ถูกธรณีสูบไปมิติมืด)" : ""}`); return;
      }
      case "move": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i);
        const to = o.to; if (o.onlyFrom && L.z !== o.onlyFrom) return; // e.g. "send it to hell" only while it is still on the field
        if (to === "av") { const P = s.P[o.seat != null ? seat : L.p]; if (!(L.z === "av") && (E.avatars(P) >= 4 || P.av.length >= 6 || !E.fits6(s, o.seat != null ? seat : L.p, L.x))) throw new RuleError("Avatar Zone เต็ม"); }
        if (to === "cs" && s.P[o.seat != null ? seat : L.p].cs.length >= 3) throw new RuleError("Construct Zone เต็ม");
        const name = E.name(s, L.x);
        const wasAv = L.z === "av"; const had = kwHas(E.def(s, L.x).x, "คำสั่งเสีย");
        // "เมื่อ Avatar ใบนี้จะออกจากสนาม … : จะไม่ออกจากสนาม" (ไพรมอล รัททาทุย)
        if (wasAv && to !== "av" && E.immuneNow(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        if (wasAv && to !== "av" && E.hostSaved(s, L.x, L, by !== L.p)) return;
        if (wasAv && to !== "av") { const sc = scriptOf(s, L.x); if (sc && sc.wouldLeave && L.x.saved !== s.turn && sc.wouldLeave(E, s, L.x, L, { fromOpp: by !== L.p, to })) { L.x.saved = s.turn; return; } }
        const built = to === "cs" && L.z !== "cs"; if (built && s.P[o.seat != null ? seat : L.x.o].cs.some((y) => E.name(s, y) === name)) { E.log(s, by, `ก่อสร้าง ${name} ไม่ได้: มี Construct ชื่อนี้อยู่แล้ว`); return; }
        E.moveTo(s, o.i, to, o.seat != null ? seat : null);
        E.log(s, by, built ? `ก่อสร้าง ${name} จาก${ZONE_TH[L.z] || L.z}` : `${name}: ${ZONE_TH[L.z] || L.z} → ${ZONE_TH[to] || to}`);
        if (wasAv && to === "hell" && had) E.addTrig(s, L.x.o, L.x, "death");
        if (built && fires(s, L.x, "build")) E.addTrig(s, L.x.o, L.x, "build"); // "เมื่อการ์ดใบนี้ก่อสร้าง" also fires when an effect builds it
        if (to === "hand" && (L.z === "deck" || L.z === "hell")) E.handed(s, L.x);
        return;
      }
      case "destroy": { E.destroy(s, o.i, o.why || "จากเอฟเฟกต์", { noSave: !!o.noSave, by }); return; }
      case "atEnd": { (s.timers = s.timers || []).push({ turn: o.turn | 0, seat: by, ops: (o.ops || []).slice(0, 10), why: o.why || "" }); return; } // ops that run at the end of turn `turn`
      case "exile": { const name = nm(o.i); E.moveTo(s, o.i, "dark"); E.log(s, by, `เนรเทศ ${name}`); return; }
      case "power": {
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด");
        if (E.immuneNow(s, L.x, "power")) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        const v = Math.max(-20, Math.min(20, o.n | 0)); if (v > 0) L.x.ups = (L.x.ups || 0) + 1; // counted for "ได้รับผลเพิ่ม POWER ไปแล้ว 3 ครั้ง" (ยายกบ 1954)
        if (o.temp === false) L.x.pm = (L.x.pm || 0) + v; else if (o.temp === "next") { L.x.tn = L.x.tn || {}; L.x.tn[by] = (L.x.tn[by] || 0) + v; } else if (o.temp === "fight") L.x.fm = (L.x.fm || 0) + v; else L.x.tm = (L.x.tm || 0) + v;
        E.log(s, by, `${E.name(s, L.x)} POWER ${v >= 0 ? "+" : ""}${v}${o.temp === false ? "" : o.temp === "next" ? " จนถึง Draw Phase ถัดไป" : o.temp === "fight" ? " จนจบการต่อสู้" : " จนจบเทิร์น"} (ตอนนี้ ${E.power(s, L.x)})`); return;
      }
      case "noWake": { const L = E.locate(s, o.i); if (L) { L.x.nw = Math.max(L.x.nw || 0, o.until | 0); E.log(s, by, `${E.name(s, L.x)} จะไม่เปลี่ยนเป็นสภาพตื่นจนจบเทิร์น ${o.until}`); } return; }
      case "wake": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); if (o.v !== false && L.x.nw && L.x.nw >= s.turn) { E.log(s, by, `${E.name(s, L.x)} เปลี่ยนเป็นสภาพตื่นไม่ได้ (ผลของการ์ดที่สวมใส่)`); return; } L.x.a = o.v !== false; E.log(s, by, `${E.name(s, L.x)} ${L.x.a ? "ตื่น" : "นอน"}`); return; }
      case "keyword": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); const k = String(o.k).slice(0, 20);
        if (o.until) L.x.kt = [...(L.x.kt || []), { k, end: o.until === "oppturn" ? (s.active === by ? s.turn + 1 : s.turn) : s.turn }]; else L.x.kw = [...new Set([...(L.x.kw || []), k])];
        E.log(s, by, `${E.name(s, L.x)} ได้รับ ${k}${o.until ? (o.until === "oppturn" ? " จนจบเทิร์นฝ่ายตรงข้าม" : " จนจบเทิร์น") : ""}`); return; }
      case "token": {
        const P = s.P[seat]; if (E.avatars(P) >= 4 && P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); if (P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        const key = "tok:" + String(o.name || "Token").slice(0, 30) + ":" + (o.power | 0);
        s.cards[key] = s.cards[key] || { n: String(o.name || "Token").slice(0, 30), t: "T", pw: o.power | 0, sy: o.symbol || "", co: o.color || "", x: "", ...(o.cost != null ? { c: o.cost | 0 } : {}) };
        for (let k = 0; k < n && P.av.length < 6; k++) P.av.push({ i: s.nextI++, c: key, o: seat, a: true, tok: true });
        E.log(s, seat, `เรียก Token ${s.cards[key].n} ×${n}`); return;
      }
      case "lifeFlip": {
        const P = s.P[seat];
        if (o.up === false) { if (s.land && !s.land.mute && (scriptOf(s, s.land) || {}).noLifeDown) { E.log(s, by, "LIFE คว่ำไม่ได้ (Land Magic บนสนาม)"); return; } if (E.critical(P) && !o.force) throw new RuleError("สถานะสาหัสคว่ำ LIFE ด้วยความสามารถไม่ได้"); const x = [...P.life].reverse().find((y) => y.up); if (x) { x.up = false; E.log(s, seat, `คว่ำ LIFE ${E.name(s, x)}`); } }
        else { const x = P.life.find((y) => !y.up); if (x) { x.up = true; E.log(s, seat, `หงาย LIFE ${E.name(s, x)} (จากความสามารถ ไม่ทำงาน)`); if (E.critical(P)) E.log(s, seat, `${P.name} เข้าสู่สถานะสาหัส`); E.lifeFlipped(s, seat); } }
        return;
      }
      case "lifeDamage": { E.damageLife(s, seat, 1 - seat); return; }
      case "shuffle": { E.shuffle(s, s.P[seat].deck); E.log(s, seat, "สับ Deck"); return; }
      case "search": {
        const P = s.P[seat]; const q = String(o.name || "");
        const k = o.take != null ? P.deck.findIndex((x) => x.i === o.take) : P.deck.findIndex((x) => (q || o.names || o.symbol || o.type || o.maxCost != null) && matchCard(E.def(s, x), o));
        if (k < 0) { E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา "${q}" ไม่พบ · สับ Deck`); return; }
        const to = o.to === "av" ? "av" : "hand";
        if (to === "av" && (E.avatars(P) >= 4 || P.av.length >= 6)) { const nmK = E.name(s, P.deck[k]); E.shuffle(s, P.deck); E.log(s, seat, `Avatar Zone เต็ม อัญเชิญ ${nmK} จาก Deck ไม่ได้ · สับ Deck`); return; }
        const x = P.deck.splice(k, 1)[0];
        if (to === "av") { x.a = true; P.av.push(x); E.noteSummon(s, seat, x); E.ev(s, { k: "summon", i: x.i, p: seat }); } else P.hand.push(x);
        E.shuffle(s, P.deck); E.log(s, seat, `ค้นหา ${E.name(s, x)} จาก Deck → ${ZONE_TH[to]} · สับ Deck`); if (to === "hand") E.handed(s, x); return;
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
        const sc = scriptOf(s, H.x); if (sc && sc.summon) s.trig.push({ id: newId(), seat: H.p, i: H.x.i, c: H.x.c, when: "summon" });
        return;
      }
      case "put": { // summon a card from any zone with an ability; jt = "อัญเชิญ จุติ" (its จุติ fires), exd = gains "คำสั่งเสีย : เนรเทศ"
        const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด #" + o.i); if (L.z === "av") return;
        const ctl = o.here ? L.p : L.x.o; const P = s.P[ctl]; if (E.avatars(P) >= 4 || P.av.length >= 6 || !E.fits6(s, ctl, L.x)) throw new RuleError("Avatar Zone เต็ม");
        if (E.def(s, L.x).t !== "A") throw new RuleError("อัญเชิญได้เฉพาะ Avatar");
        if (L.z === "hell" && fieldCards(s).some(({ x: y }) => !y.mute && (scriptOf(s, y) || {}).noHellSummon)) { E.log(s, by, `อัญเชิญ ${E.name(s, L.x)} จากนรกไม่ได้ (ความสามารถต่อเนื่องบนสนาม)`); return; }
        const from = ZONE_TH[L.z] || L.z; const x = E.moveTo(s, o.i, "av", ctl); if (o.exd) x.exd = true; if (o.asleep) x.a = false; E.noteSummon(s, ctl, x);
        E.ev(s, { k: "summon", i: x.i, p: ctl }); E.log(s, by, `อัญเชิญ ${E.name(s, x)} จาก${from}${o.jt ? " แบบจุติ" : ""}${o.asleep ? " ในสภาพนอน" : ""}${o.exd ? " (ได้รับคำสั่งเสีย : เนรเทศ)" : ""}`);
        if (o.jt) { const ex = o.exact ? { exact: true } : {}; const sc = scriptOf(s, x); if (sc && sc.summon) { if (!sc.storyOnly || x.story) E.addTrig(s, ctl, x, "summon", ex); } else if (kwHas(E.def(s, x).x, "จุติ")) E.addTrig(s, ctl, x, "summon", ex); }
        // "เมื่อการ์ดใบนี้ถูกอัญเชิญมาด้วยความสามารถของ …": the card whose effect is resolving is the source
        if (s.cur != null && s.cards[s.cur]) { x.sb = s.cur; const sc = x.mute ? null : scriptOf(s, x); if (sc && sc.summonedBy && (!sc.byOk || sc.byOk(E, s, s.cards[s.cur], x))) s.trig.push({ id: newId(), seat: x.o, i: x.i, c: x.c, when: "summonedBy", src: s.cur }); }
        return;
      }
      case "toLand": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); const name = E.name(s, L.x); E.moveTo(s, o.i, "land"); E.log(s, by, `ใช้ ${name} บน Land Magic Zone`); return; }
      case "handToDeck": { const P = s.P[seat]; const n0 = P.hand.length; P.deck.push(...P.hand.splice(0)); E.shuffle(s, P.deck); E.log(s, seat, `${P.name} นำการ์ดบนมือ ${n0} ใบกลับเข้า Deck แล้วสับ`); return; }
      case "resume": { if (o.t && o.t.c != null) s.trig.unshift({ id: newId(), ...o.t }); return; } // the rest of an effect that had to wait for its first steps
      case "mu": { s.mu[seat][o.k] = true; return; }
      case "banPay": { s.ban = s.ban || [[], []]; if (!s.ban[seat].includes(o.name)) s.ban[seat].push(o.name); E.log(s, by, `${o.name} ใช้เป็น Cost ในการอัญเชิญไม่ได้จนจบเกม`); return; }
      case "millKill": { // ซีเกิร์ด: mill n, then destroy enemy Avatars with total Cost ≤ base + (named cards milled)
        const P = s.P[seat]; const top = P.deck.slice(0, Math.min(n, P.deck.length)); E.op(s, { op: "mill", seat, n, src: o.src }, by);
        const k = top.filter((x) => String(E.def(s, x).n || "").includes(o.name || "")).length; let budget = (o.base | 0) + k;
        const cands = s.P[1 - seat].av.filter((x) => !x.tok && !E.untargetable(s, x)).sort((a, b) => E.power(s, b) - E.power(s, a));
        const kill = []; for (const x of cands) { const c = E.def(s, x).c || 0; if (c <= budget) { kill.push(x); budget -= c; } }
        E.log(s, by, `ธรณีสูบเจอ ${o.name} ${k} ใบ · ทำลายได้ Cost รวมไม่เกิน ${(o.base | 0) + k}`); for (const x of kill) E.destroy(s, x.i, "ความสามารถของซีเกิร์ด"); return;
      }
      case "flag": { const L = E.locate(s, o.i); if (L && ["canAtk", "drac"].includes(o.k)) { if (o.off) delete L.x[o.k]; else L.x[o.k] = o.v != null ? o.v : true; } return; }
      case "cancelAttack": { if (s.pend) { E.log(s, by, "ยกเลิกการโจมตี"); E.endFight(s, true); } return; }
      case "zero": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.zero = true; L.x.muteEnd = s.turn; E.log(s, by, `${E.name(s, L.x)} POWER ตั้งต้นเป็น 0 จนจบเทิร์น`); return; }
      case "attach": { // put a card onto an Avatar as an equipped card (e.g. โอตะ on a ไอดอล)
        const L = E.locate(s, o.i), H = E.locate(s, o.on); if (!L) throw new RuleError("สวมใส่ไม่ได้");
        if (!H || H.z !== "av") { E.log(s, by, `${E.name(s, L.x)} สวมใส่ไม่ได้ (Avatar ที่จะสวมใส่ไม่อยู่บนสนามแล้ว)`); return; }
        { const ht = H.x.mute ? null : hk(s, H.x); if (ht && ht.uniqWear && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === H.x.i && E.def(s, m).n === E.def(s, L.x).n)) { E.log(s, by, `${E.name(s, H.x)} สวมใส่การ์ดชื่อซ้ำกันไม่ได้`); return; } }
        if (L.z === "land") s.land = null; else s.P[L.p][L.z].splice(L.idx, 1); L.x.on = o.on; L.x.a = true; s.P[H.p].mg.push(L.x);
        E.log(s, by, `${E.name(s, L.x)} สวมใส่ให้ ${E.name(s, H.x)}`); return;
      }
      case "negate": { const k = s.trig.findIndex((t) => t.i === o.i); if (k >= 0) s.trig.splice(k, 1); const L = E.locate(s, o.i); if (L && (L.z === "mg" || L.z === "land")) E.moveTo(s, o.i, "hell"); E.log(s, by, "ยกเลิกผลของการ์ดนั้น"); return; }
      case "later": { (s.later = s.later || []).push({ seat, ...(o.t ? { t: o.t } : { ops: (o.ops || []).slice(0, 10) }), why: o.why, ...(o.at === "battle" ? { at: "battle", after: s.turn } : {}) }); E.log(s, seat, o.at === "battle" ? "รอทำงานใน Battle Phase ของเทิร์นถัดไปของเรา" : "รอทำงานใน Main Phase ถัดไป"); return; }
      case "guard": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.guard = o.until || true; E.log(s, by, `${E.name(s, L.x)} ได้รับการป้องกันการถูกทำลาย 1 ครั้ง${o.until ? " จนจบเทิร์นถัดไปของฝ่ายตรงข้าม" : ""}`); return; }
      case "used": { const L = E.locate(s, o.i); if (L) L.x.used = s.turn; return; }
      case "roll": { // dice (sides 6) or a coin (sides 2: 1 = heads): the matching ops run
        const sides = o.sides === 2 ? 2 : 6; const r = 1 + Math.floor(E.rnd(s) * sides); const label = sides === 2 ? (r === 1 ? "หัว" : "ก้อย") : String(r);
        E.log(s, by, `${o.why ? o.why + ": " : ""}${sides === 2 ? "ทอยเหรียญได้" : "ทอยลูกเต๋าได้ "}${label}`);
        const branch = (o.cases && (o.cases[r] || o.cases[r % 2 ? "odd" : "even"])) || (r % 2 ? o.odd : o.even) || []; if (branch.length) E.ops(s, branch, by); return; }
      case "scout": { // look at the top n, take the chosen (or first matching) card, the rest go to the bottom
        const P = s.P[seat]; const top = P.deck.splice(0, Math.min(n, P.deck.length)); const k = o.take != null ? top.findIndex((x) => x.i === o.take) : o.none ? -1 : top.findIndex((x) => matchCard(E.def(s, x), o));
        let got = null; if (k >= 0) got = top.splice(k, 1)[0];
        P.deck.push(...top);
        if (got) { if (o.to === "av" && E.avatars(P) < 4 && P.av.length < 6 && E.def(s, got).t === "A") { P.av.push(got); E.ev(s, { k: "summon", i: got.i, p: seat }); } else P.hand.push(got); }
        E.log(s, seat, `สอดแนม ${top.length + (got ? 1 : 0)} ใบ${got ? ` · นำ ${E.name(s, got)} ${o.to === "av" ? "ลงสนาม" : "ขึ้นมือ"}` : " · ไม่พบการ์ดที่ตรงเงื่อนไข"} · ที่เหลือไว้ใต้ Deck`); return;
      }
      case "scoutShow": { const P = s.P[seat]; const xs = (o.ids || []).map((i) => P.deck.find((x) => x.i === i)).filter(Boolean); E.log(s, by, `${o.label || "สอดแนม"}${seat !== by ? " Deck ฝ่ายตรงข้าม" : ""} ${xs.length} ใบ: ${xs.map((x) => E.name(s, x)).join(", ") || "ไม่มีการ์ด"}`); return; }
      case "scoutRest": { // the scouted cards that were not taken: bottom (default) / shuffle / top / hell / dark
        const P = s.P[seat]; const left = (o.ids || []).map((i) => P.deck.find((x) => x.i === i)).filter(Boolean); if (!left.length) return;
        if (o.rest === "top") { E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ วางไว้บน Deck ตามเดิม`); return; }
        for (const x of left) P.deck.splice(P.deck.indexOf(x), 1);
        if (o.rest === "hell") { P.hell.push(...left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ลงนรก: ${left.map((x) => E.name(s, x)).join(", ")}`); }
        else if (o.rest === "dark") { P.dark.push(...left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ถูกเนรเทศ`); }
        else if (o.rest === "shuffle") { P.deck.push(...left); E.shuffle(s, P.deck); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ กลับเข้า Deck แล้วสับ`); }
        else { P.deck.push(...left); E.log(s, by, `การ์ดที่เหลือ ${left.length} ใบ ไว้ใต้ Deck`); }
        return;
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
      case "control": { const L = E.locate(s, o.i); if (!L || L.z !== "av") throw new RuleError("ควบคุมได้เฉพาะ Avatar บนสนาม"); if (E.immuneNow(s, L.x)) { E.log(s, by, `${E.name(s, L.x)} ไม่รับผลความสามารถนี้`); return; }
        if (!L.x.mute && (hk(s, L.x) || {}).noControl) { E.log(s, by, `${E.name(s, L.x)} ไม่สามารถถูกเปลี่ยนการควบคุมได้`); return; } const t = o.seat === 0 || o.seat === 1 ? o.seat : 1 - L.p; const P = s.P[t]; if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม"); s.P[L.p].av.splice(L.idx, 1); if (o.until === "turn") L.x.back = L.p; if (o.asleep) L.x.a = false; if (o.wake) L.x.a = true; if (o.noLife) L.x.nlt = s.turn; P.av.push(L.x); E.log(s, by, `${s.P[t].name} ได้ควบคุม ${E.name(s, L.x)}${o.until === "turn" ? " จนจบเทิร์น" : ""}${o.wake ? " ในสภาพตื่น" : ""}${o.noLife ? " (โจมตี LIFE ไม่ได้)" : ""}`); return; }
      case "turnLock": { s.tlock = s.tlock || [null, null]; const cur = s.tlock[seat] && s.tlock[seat].t === s.turn ? s.tlock[seat] : { t: s.turn };
        if (o.sy) cur.sy = o.sy; if (o.atkSy) cur.atkSy = o.atkSy; if (o.only) cur.only = o.only; if (o.name) cur.names = [...(cur.names || []), o.name]; s.tlock[seat] = cur;
        E.log(s, by, o.sy ? `เทิร์นนี้อัญเชิญได้เฉพาะ Avatar {${o.sy}}` : o.atkSy ? `เทิร์นนี้สั่งโจมตีได้เฉพาะ Avatar {${o.atkSy}}` : `เทิร์นนี้อัญเชิญหรือใช้ความสามารถของ ${o.name} ไม่ได้`); return; }
      case "turnBuff": { s.tbuff = s.tbuff || [null, null]; s.tbuff[seat] = { t: s.turn, sy: o.sy, imm: !!o.imm, kw: o.kw || null, noShield: !!o.noShield }; E.log(s, by, o.why || "ในเทิร์นนี้ Avatar ที่อัญเชิญจะได้รับความสามารถ"); return; }
      case "ind": { const L = E.locate(s, o.i); if (L) { L.x.ind = s.turn; E.log(s, by, `${E.name(s, L.x)} จะไม่ถูกทำลายในเทิร์นนี้`); } return; }
      case "randomHand": { // ด่านลอย: a random card from that hand; an Avatar of the named Cost goes to hell
        const P = s.P[seat]; if (!P.hand.length) { E.log(s, by, "มือฝ่ายนั้นไม่มีการ์ด"); return; } const x = P.hand[Math.floor(E.rnd(s) * P.hand.length)]; const d = E.def(s, x);
        const hit = d.t === "A" && (o.sy ? E.hasSy(s, x, o.sy) : (d.c || 0) === (o.cost | 0)); E.log(s, by, `สุ่มได้ ${d.n}${hit ? ` (${o.sy ? "Avatar {" + o.sy + "}" : "Avatar Cost " + o.cost}) ส่งลงนรก` : " ไม่ตรงเงื่อนไข"}`); if (hit) { P.hand.splice(P.hand.indexOf(x), 1); P.hell.push(x); } return; }
      case "setCost": { const L = E.locate(s, o.i); if (!L) throw new RuleError("ไม่พบการ์ด"); L.x.cst = { v: Math.max(0, o.v | 0), t: s.turn }; E.log(s, by, `Cost ของ ${E.name(s, L.x)} เป็น ${L.x.cst.v} จนจบเทิร์น`); return; }
      case "stun": { const L = E.locate(s, o.i); if (L) { L.x.noAct = s.turn; E.log(s, by, `${E.name(s, L.x)} สั่งโจมตีและใช้ความสามารถไม่ได้จนจบเทิร์น`); } return; }
      case "enslave": { // มนุษย์ดาว R18: an Avatar is kept in our Magic Zone as "ข้ารับใช้ของ มนุษย์ดาว R18" {เอเลี่ยน}
        const L = E.locate(s, o.i); if (!L || !["hell", "av"].includes(L.z)) return; const was = E.name(s, L.x); const x = E.moveTo(s, o.i, "mg", seat); if (!x) return; x.nameAs = "ข้ารับใช้ของ มนุษย์ดาว R18"; x.syAs = "เอเลี่ยน"; x.srv = true;
        E.log(s, by, `${was} มาอยู่ที่ Magic Zone ฝ่าย${s.P[seat].name} เป็น "ข้ารับใช้ของ มนุษย์ดาว R18" {เอเลี่ยน}`); return; }
      case "wipe": { // send every card on player seat's field and in their hand to hell (แผนลับของเหล่าพลเอก)
        const P = s.P[seat]; let k = 0; for (const z of ["mg", "av", "cs", "hand"]) for (const x of [...P[z]]) { if (!E.locate(s, x.i)) continue; E.moveTo(s, x.i, "hell"); k++; }
        if (s.land && s.land.o === seat) { E.moveTo(s, s.land.i, "hell"); k++; } E.log(s, by, `ส่งการ์ดบนสนามและบนมือของ ${P.name} ลงนรก ${k} ใบ`); return; }
      case "afterFight": { if (s.pend) (s.pend.af = s.pend.af || []).push(...(o.ops || []).slice(0, 6)); return; }
      case "extraN": { s.xN = s.xN || [null, null]; s.xN[seat] = { t: s.turn, not: String(o.not || "") }; E.log(s, by, "เทิร์นนี้ใช้ Normal Magic ได้อีก 1 ใบ"); return; }
      case "noShieldAtk": { if (s.pend) { s.pend.nsh = true; E.log(s, by, "ฝ่ายตรงข้ามใช้โล่มนุษย์กับการโจมตีครั้งนี้ไม่ได้"); } return; }
      case "payPut": { // summon a card from the hand by paying its Cost, outside the summon action (นักรบ ฮอล)
        const P = s.P[seat]; const x = P.hand.find((y) => y.i === o.i); if (!x) return; const d = E.def(s, x); const cost = E.costOf(s, seat, x);
        const pay = o.pay || E.autoPay(s, seat, x.i); const r = pay ? E.canPay(s, seat, d, pay, cost) : { ok: false, err: "GEM ไม่พอ" }; if (!r.ok) { E.log(s, by, `จ่าย Cost ของ ${d.n} ไม่ได้ (${r.err})`); return; }
        const paid = []; for (const i of pay) { const k = P.hand.findIndex((y) => y.i === i); if (k < 0) continue; const y = P.hand.splice(k, 1)[0]; P.hell.push(y); paid.push(y); }
        E.log(s, by, `จ่าย ${paid.length} ใบ GEM ${r.total || 0}/${cost}`); E.op(s, { op: "put", i: x.i, jt: true, exact: r.exact }, by); if (r.exact) x.px = true;
        s.trig.push(...paid.filter((y) => { const sc = scriptOf(s, y); return sc ? sc.paid && (!sc.paidFor || sc.paidFor(d)) : E.ext.paid && E.ext.paid(s, y, d); }).map((y) => ({ id: newId(), seat, i: y.i, c: y.c, when: "paid", for: x.c, forI: x.i })));
        return; }
      case "noReact": { if (s.pend) { s.pend.nr = true; E.log(s, by, "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้นี้"); } return; }
      case "costUp": { const L = E.locate(s, o.i); if (L) { L.x.cm = (L.x.cm || 0) + (o.n | 0); E.log(s, by, `Cost ของ ${E.name(s, L.x)} ${o.n >= 0 ? "+" : ""}${o.n}`); } return; }
      case "powerFlip": { const L = E.locate(s, o.i); if (!L) return; let k = 0; for (const f of ["pm", "tm"]) if ((L.x[f] || 0) < 0) { k -= L.x[f]; L.x[f] = -L.x[f]; } if (k) E.log(s, by, `${E.name(s, L.x)} POWER ที่ถูกลดไป ${k} กลายเป็นเพิ่มแทน`); return; }
      case "setPower": { const L = E.locate(s, o.i); if (!L) return; const d = (o.v | 0) - E.power(s, L.x); if (d) E.op(s, { op: "power", i: o.i, n: d, temp: o.temp == null ? true : o.temp }, by); return; }
      case "giveCard": { const P = s.P[seat]; const k = P.hand.findIndex((y) => y.i === o.i); if (k < 0) return; const x = P.hand.splice(k, 1)[0]; s.P[1 - seat].hand.push(x); E.log(s, by, `${P.name} ให้การ์ด 1 ใบบนมือแก่ ${s.P[1 - seat].name}`); return; }
      case "useMod": { s.mu[seat].D = true; E.log(s, by, "นับว่าใช้ Modification Magic ในเทิร์นนี้แล้ว"); return; }
      case "cancelTrig": { const n0 = s.trig.length; const gone = s.trig.filter((t) => t.i === o.i && (o.cast || t.when !== "cast")); s.trig = s.trig.filter((t) => !gone.includes(t)); for (const t of gone) if (t.toHell) { const L = E.locate(s, t.i); if (L && L.z === "mg") { s.P[L.p].mg.splice(L.idx, 1); s.P[L.x.o].hell.push(L.x); } } if (s.trig.length < n0) E.log(s, by, "ยกเลิกความสามารถนั้น"); return; }
      case "becomeAvatar": { const L = E.locate(s, o.i); if (!L) return; const P = s.P[seat]; if (E.avatars(P) >= 4 || P.av.length >= 6) throw new RuleError("Avatar Zone เต็ม");
        if (L.z === "land") s.land = null; else s.P[L.p][L.z].splice(L.idx, 1); L.x.ov = o.ov || {}; L.x.a = true; delete L.x.on; P.av.push(L.x); E.noteSummon(s, seat, L.x); E.log(s, by, `${E.name(s, L.x)} กลายเป็น Avatar บน Avatar Zone`); return; }
      case "setName": { const L = E.locate(s, o.i); if (L) { L.x.nameAs = String(o.name || "").slice(0, 30); E.log(s, by, `${E.def(s, L.x).n} เปลี่ยนชื่อเป็น "${L.x.nameAs}"`); } return; }
      case "mprot": { const L = E.locate(s, o.i); if (L) { L.x.mprot = { until: o.until | 0, all: !!o.all }; E.log(s, by, `${E.name(s, L.x)} ${o.all ? "ไม่รับผลจาก Magic ของฝ่ายตรงข้าม" : "จะไม่ถูกนำออกจากสนามด้วย Magic"} จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`); } return; }
      case "fprot": { for (const x of s.P[seat].av) x.fprot = s.turn; E.log(s, by, "Avatar ฝ่ายเราทุกใบจะไม่ถูกทำลายจากการต่อสู้ในเทิร์นนี้"); return; }
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

// legal moves for AI/coach
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
  if (s.phase === "mull") return out;
  if (s.active !== p) return out;
  if (s.phase === "end" && s.need) return out;
  if (s.phase === "main") {
    const seen = new Set();
    for (const x of P.hand) {
      const d = E.def(s, x); if (seen.has(x.c)) continue; seen.add(x.c);
      if (d.t === "A" && !x.borrow && E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, p, x) && !E.locked(s, p, x) && !(hk(s, x) || {}).noHand && !((hk(s, x) || {}).uniq && P.av.some((y) => E.name(s, y) === d.n))) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `อัญเชิญ ${d.n} (Cost ${E.costOf(s, p, x)}, POWER ${d.pw || 0}) จ่ายด้วย ${pay.map((i) => E.name(s, P.hand.find((y) => y.i === i))).join(", ") || "ไม่ต้องจ่าย"}`, a: { type: "summon", i: x.i, pay } }); }
      if (d.t === "C" && P.cs.length < 3 && !P.cs.some((y) => E.name(s, y) === d.n)) { const pay = E.autoPay(s, p, x.i); if (pay) out.push({ d: `ก่อสร้าง ${d.n} (Cost ${d.c || 0})`, a: { type: "build", i: x.i, pay } }); }
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
    for (const x of [...P.av, ...P.cs, ...P.mg, ...P.dark, ...P.hell, ...P.hand, ...(s.land && s.land.o === p ? [s.land] : [])]) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.activate && x.used !== s.turn && x.noAct !== s.turn && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    if (E.ext.acts) for (const x of [...P.av, ...P.cs, ...(s.land && s.land.o === p ? [s.land] : [])]) for (const a of E.ext.acts(s, x, E.locate(s, x.i))) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${a.label}`, a: { type: "activate", i: x.i, k: a.k } });
    out.push({ d: s.turn === 1 ? "จบเทิร์น (เทิร์นแรกไม่มี Battle)" : "ไป Battle Phase", a: { type: "battle" } });
  } else if (s.phase === "battle") {
    for (const x of P.av.filter((y) => y.a && y.noAct !== s.turn && !(!y.mute && (hk(s, y) || {}).noAttack && hk(s, y).noAttack(E, s, y)))) {
      const ap = E.power(s, x); const n = E.name(s, x); const tn = E.taunts(s, 1 - p);
      if ((E.oneAttack(s) && s.atk && s.atk.t === s.turn && s.atk.n >= 1) || E.atkLocked(s, p, x)) continue;
      for (const y of O.av.filter((z) => !E.atkSafe(s, z) && (!tn.length || tn.includes(z)))) out.push({ d: `${n} (P${ap}) โจมตี ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "av", ti: y.i } });
      if (tn.length) continue;
      for (const y of O.cs) out.push({ d: `${n} (P${ap}) โจมตี Construct ${E.name(s, y)} (P${E.power(s, y)})`, a: { type: "attack", i: x.i, tk: "cs", ti: y.i } });
      if ((!O.av.length || E.kw(s, x, "เตะไข่")) && !E.noLife(s, x)) out.push({ d: `${n} (P${ap}) โจมตี LIFE`, a: { type: "attack", i: x.i, tk: "life" } });
    }
    for (const x of P.av) { const L = E.locate(s, x.i); const sc = scriptOf(s, x); if (sc && sc.activate && sc.activate.battle && x.used !== s.turn && sc.activate.can(E, s, x, L)) out.push({ d: `สั่งใช้ ${E.name(s, x)}: ${sc.activate.label}`, a: { type: "activate", i: x.i } }); }
    // an Avatar that a worn card forces to attack (สตีฟ Tank Ranger) must do so before the turn can end
    if (!P.av.some((x) => x.a && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && !m.mute && (scriptOf(s, m) || {}).hostMust) && out.some((m) => m.a.type === "attack" && m.a.i === x.i))) out.push({ d: "จบเทิร์น", a: { type: "end" } });
  }
  return out;
}
