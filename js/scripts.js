// Hand-written card scripts (Stage 4). Keyed by print code; reprints with the same name and
// text share the script automatically. Functions receive the engine object E so this file
// stays free of imports.
//
// Passive hooks (used by the engine):
//   aura(E, s, src, L)          -> [{ seat, test(x), n }]  POWER bonus while src is on the field
//   battle(E, s, me, foe)        -> POWER change for `me` while fighting `foe`
//   untargetable(E, s, x, L)     -> true when x cannot be attacked / chosen by enemy Magic
//   costMod(E, s, src, L, hc)    -> Cost change for card hc in the same player's hand
//   canCast(E, s, p)             -> false blocks casting this Magic
//   endPhase(E, s, x, L)         -> ops at every End Phase while on the field
// Effects (run by effects.js, may ask the player to choose):
//   summon / death / cast / life / attack (ctx) -> { explain, ops }
//   activate: { label, can(E, s, x, L), run(ctx) }   once per turn, from the field
//   handCall: true   (ซาร์อึก) discard from hand to summon a dragon with Cost -6
const sy = (E, s, x, k) => String(E.def(s, x).sy || "").includes(k);
const isAv = (E, s, x) => ["A", "T"].includes(E.def(s, x).t);
const dragon = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "มังกร");
const weakTo = (k) => (E, s, me, foe) => (foe && sy(E, s, foe, k) ? -2 : 0);

export const SCRIPTS = {
  // ซาร์อึก ผู้ฝึกมังกร
  "BT12-009": {
    costMod: (E, s, src, L, hc) => (L.z === "av" && dragon(E, s, hc) ? -1 : 0),
    handCall: true,
  },
  // อิกนิส มังกรไฟโซลฮอต
  "BT12-013": {
    aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].hell.filter((x) => dragon(E, s, x)).length >= 4 ? [{ seat: L.p, test: (x) => x.i !== src.i && dragon(E, s, x), n: 1 }] : []),
    battle: weakTo("นรก"),
  },
  // อาดัส มังกรแห่งห้วงเหวน้ำลึก
  "BT12-028": {
    battle: weakTo("สัตว์"),
    activate: {
      label: "ทำลาย Avatar ใน Magic Zone ฝ่ายตรงข้าม",
      can: (E, s, x, L) => L.z === "av" && x.a && s.P[L.p].av.some((y) => y.i !== x.i && dragon(E, s, y)) && s.P[1 - L.p].mg.some((m) => isAv(E, s, m)),
      run: (c) => { const t = c.choose(c.s.P[1 - c.seat].mg.filter((m) => isAv(c.E, c.s, m)), 1, "เลือก Avatar ใน Magic Zone ฝ่ายตรงข้ามที่จะทำลาย")[0];
        return { explain: `อาดัสนอนเพื่อทำลาย ${c.E.name(c.s, t)}`, ops: [{ op: "wake", i: c.self.i, v: false }, { op: "destroy", i: t.i, why: "ความสามารถของอาดัส" }] }; },
    },
  },
  // ดีรูโอ มังกรแห่งการพังทลาย
  "BT12-041": {
    battle: weakTo("เทพ"),
    summon: (c) => {
      const pool = c.s.P[c.seat].hell.filter((x) => dragon(c.E, c.s, x));
      if (!pool.length) return { explain: "ไม่มีมังกรในนรกให้จ่ายค่าจุติ ความสามารถไม่ทำงาน", ops: [] };
      const t = c.choose(pool, 1, "จ่ายค่าจุติ: เลือกมังกรในนรกกลับขึ้นมือ", { optional: true })[0];
      if (!t) return { explain: "ไม่จ่ายค่าจุติ", ops: [] };
      return { explain: `นำ ${c.E.name(c.s, t)} กลับขึ้นมือ · Avatar ฝ่ายตรงข้ามทุกใบ POWER -1 จนจบเทิร์น`, ops: [{ op: "move", i: t.i, to: "hand" }, ...c.s.P[1 - c.seat].av.map((x) => ({ op: "power", i: x.i, n: -1, temp: true }))] };
    },
  },
  // เนอมัส มังกรแห่งป่าไร้เงา
  "BT12-052": {
    battle: weakTo("คน"),
    untargetable: (E, s, x, L) => L.z === "av" && s.P[L.p].av.some((y) => y.i !== x.i && dragon(E, s, y)),
  },
  // สายเลือดมังกร
  "BT12-062": {
    canCast: (E, s, p) => s.P[p].av.some((x) => dragon(E, s, x)),
    cast: (c) => { const t = c.choose(c.s.P[c.seat].av.filter((x) => dragon(c.E, c.s, x)), 1, "เลือกมังกรที่จะ POWER +2")[0];
      return t ? { explain: `${c.E.name(c.s, t)} POWER +2 จนถึง Draw Phase ถัดไปของเรา`, ops: [{ op: "power", i: t.i, n: 2, temp: "next" }] } : { explain: "ไม่มีมังกรให้เลือก", ops: [] }; },
  },
  // อารยธรรมที่พังทลาย (Land)
  "BT12-072": {
    aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((q) => ({ seat: q, test: (x) => ["มังกร", "ต้นไม้", "สัตว์วิเศษ"].some((k) => sy(E, s, x, k)), n: 1 })) : []),
    cast: () => ({ explain: "Land: มังกร ต้นไม้ และสัตว์วิเศษทุกใบ POWER +1 ตราบที่ยังอยู่", ops: [] }),
  },
  // แรงงานทาสออฟฟิศ
  "BT02-017": { endPhase: (E, s, x, L) => (L.z === "av" ? [{ op: "move", i: x.i, to: "deckBottom" }] : []) },
  // หมอมาแล้วววว — approximated: the chosen Avatar survives the next destruction this turn
  "BT01-040": {
    cast: (c) => { const pool = [...c.s.P[c.seat].av, ...c.s.P[1 - c.seat].av];
      const t = c.choose(pool, 1, "เลือก Avatar ที่จะไม่ถูกทำลาย (ครั้งถัดไปในเทิร์นนี้)")[0];
      return t ? { explain: `${c.E.name(c.s, t)} จะไม่ถูกทำลายครั้งถัดไปในเทิร์นนี้`, ops: [{ op: "guard", i: t.i }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; },
  },
};
