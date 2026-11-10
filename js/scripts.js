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

// ===================== นักท่องเรื่องราว × ไวรัส (Rimuru's picks) =====================
const nm = (E, s, x, k) => String(E.def(s, x).n || "").includes(k);
const isMagic = (E, s, x) => E.def(s, x).t === "M";
const story = (E, s, x) => isAv(E, s, x) && nm(E, s, x, "เรื่องราว") && !nm(E, s, x, "นักท่องเรื่องราว");
const skill = (E, s, x) => isMagic(E, s, x) && nm(E, s, x, "Skill");
const virus = (E, s, x) => isAv(E, s, x) && nm(E, s, x, "ไวรัส");
const uniq = (E, s, list) => { const seen = new Set(); return list.filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; }); };
const strongFirst = (E, s) => (a, b) => E.power(s, b) - E.power(s, a);
function traveller(bonus, drawOnExile) {
  return {
    activate: {
      label: "แปลงร่างเป็นเรื่องราว (Cost 6 จากมือ)", battle: true,
      can: (E, s, x, L) => L.z === "av" && s.P[L.p].hand.some((y) => story(E, s, y) && (E.def(s, y).c || 0) === 6),
      run: (c) => {
        const opts = uniq(c.E, c.s, c.s.P[c.seat].hand.filter((y) => story(c.E, c.s, y) && (c.E.def(c.s, y).c || 0) === 6)).sort(strongFirst(c.E, c.s));
        const t = c.choose(opts, 1, "เลือกร่างเรื่องราว Cost 6 บนมือที่จะแปลงร่าง")[0]; if (!t) return { explain: "ไม่มีการ์ดเรื่องราวบนมือ", ops: [] };
        return { explain: `แปลงร่างเป็น ${c.E.name(c.s, t)}${bonus ? " (POWER +1)" : ""}${drawOnExile ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "travel", from: c.self.i, to: t.i, bonus }, ...(drawOnExile ? [{ op: "draw", seat: c.seat, n: 1 }] : [])] };
      },
    },
  };
}
const virusMill = (c, n) => { const top = [0, 1].flatMap((q) => c.s.P[q].deck.slice(0, n)); return { ops: [0, 1].map((q) => ({ op: "mill", seat: q, n, virus: true })), avatars: top.filter((x) => isAv(c.E, c.s, x)).length }; };
const fromDark = {
  label: "อัญเชิญจากมิติมืด (ทิ้งการ์ดบนมือ 2 ใบ)",
  can: (E, s, x, L) => L.z === "dark" && s.P[L.p].dark.filter((y) => virus(E, s, y)).length >= 5 && s.P[L.p].hand.length >= 2 && E.avatars(s.P[L.p]) < 4,
  run: (c) => { const disc = c.choose([...c.s.P[c.seat].hand].sort((a, b) => (c.E.def(c.s, a).pw || 0) - (c.E.def(c.s, b).pw || 0)), 2, "เลือกการ์ดบนมือ 2 ใบที่จะทิ้ง", { exact: true });
    return { explain: `ทิ้ง 2 ใบ อัญเชิญ ${c.E.name(c.s, c.self)} จากมิติมืด`, ops: [{ op: "discard", seat: c.seat, iids: disc.map((x) => x.i) }, { op: "move", i: c.self.i, to: "av" }] }; },
};
Object.assign(SCRIPTS, {
  "BT09-042": traveller(0, true),   // นักท่องเรื่องราว ขวัญตา: draws 1 when exiled from the field
  "BT11-048": traveller(1, false),  // นักท่องเรื่องราว มายา: the summoned story gets POWER +1
  // ขวัญตา เรื่องราว ราชาแห่งนาค
  "BT09-043": {
    aura: (E, s, src, L) => (src.story && L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: Math.floor(E.magicInHell(s, L.p) / 2) }] : []),
    activate: { label: "ทิ้ง 1 ใบ: นำ Skill จากนรกขึ้นมือ",
      can: (E, s, x, L) => x.story && L.z === "av" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => skill(E, s, y)),
      run: (c) => { const d = c.choose([...c.s.P[c.seat].hand].sort((a, b) => (c.E.def(c.s, a).pw || 0) - (c.E.def(c.s, b).pw || 0)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].hell.filter((y) => skill(c.E, c.s, y))), 1, "เลือก Skill ในนรกที่จะนำขึ้นมือ")[0];
        return { explain: `ทิ้ง ${c.E.name(c.s, d)} · นำ ${c.E.name(c.s, k)} ขึ้นมือ`, ops: [{ op: "discard", seat: c.seat, iids: [d.i] }, { op: "move", i: k.i, to: "hand" }] }; } },
  },
  // ขวัญตา เรื่องราว ครุฑเจ้าเวหา
  "BT09-044": { storyOnly: true,
    attack: (c) => { if (!c.self || !c.self.story) return { explain: "ไม่ได้มาจากนักท่องเรื่องราว", ops: [] };
      const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].deck.filter((y) => skill(c.E, c.s, y))), 1, "นำ Skill จาก Deck ลงนรก (เพิ่ม Magic ในนรก)", { optional: true })[0];
      return k ? { explain: `ส่ง ${c.E.name(c.s, k)} จาก Deck ลงนรก แล้วสับ`, ops: [{ op: "move", i: k.i, to: "hell" }, { op: "shuffle", seat: c.seat }] } : { explain: "ไม่ส่ง Skill ลงนรก", ops: [] }; },
  },
  // มายา เรื่องราว เทพเจ้าสายฟ้า
  "BT11-049": { storyOnly: true,
    summon: (c) => { if (!c.self || !c.self.story) return { explain: "ไม่ได้มาจากนักท่องเรื่องราว", ops: [] };
      const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].deck.filter((y) => skill(c.E, c.s, y))), 1, "เลือก Skill จาก Deck ขึ้นมือ")[0];
      return k ? { explain: `นำ ${c.E.name(c.s, k)} ขึ้นมือ แล้วสับ Deck`, ops: [{ op: "search", seat: c.seat, take: k.i, to: "hand" }] } : { explain: "ไม่มี Skill ใน Deck", ops: [] }; },
    onMagic: (E, s, x, L) => (x.story && L.z === "av" && x.used !== "m" + s.turn ? ((x.used = "m" + s.turn), [{ op: "power", i: x.i, n: 1, temp: true }]) : []),
  },
  // ขวัญตา เรื่องราว ตำนานอมตะ: mill 2 instead of being destroyed; survives if both are Magic
  "BT12-048": {
    wouldDestroy: (E, s, x, L) => { if (!x.story) return false; const P = s.P[L.p]; const two = P.deck.slice(0, 2);
      E.ops(s, [{ op: "mill", seat: L.p, n: 2 }], L.p); const ok = two.length === 2 && two.every((y) => isMagic(E, s, y));
      E.log(s, L.p, ok ? `${E.name(s, x)} ไม่ถูกทำลาย (ธรณีสูบได้ Magic ทั้ง 2 ใบ)` : `${E.name(s, x)} ธรณีสูบแล้วไม่ได้ Magic ครบ 2 ใบ`); return ok; },
  },
  // ขวัญตา เรื่องราว ผู้กำหนดชีวิต
  "BT12-049": {
    aura: (E, s, src, L) => { if (!src.story || L.z !== "av") return []; const n = Math.floor(E.magicInHell(s, L.p) / 2); return n ? [0, 1].map((q) => ({ seat: q, test: (x) => !String(E.def(s, x).x || "").trim(), n: -n })) : []; },
    activate: { label: "ทำความเสียหาย LIFE เรา 1: ให้ Avatar ฝ่ายตรงข้ามเสียความสามารถ", battle: true,
      can: (E, s, x, L) => x.story && L.z === "av" && s.phase === "battle" && s.P[1 - L.p].av.length > 0 && s.P[L.p].life.some((y) => !y.up),
      run: (c) => { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะเสียความสามารถ")[0];
        return t ? { explain: `หงาย LIFE ตัวเอง 1 ใบ · ${c.E.name(c.s, t)} เสียความสามารถจนจบเทิร์นฝ่ายตรงข้าม`, ops: [{ op: "lifeFlip", seat: c.seat, up: true }, { op: "mute", i: t.i, until: "oppturn" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  },
  // Skill : Full Drive
  "BT09-056": {
    cast: (c) => { const P = c.s.P[c.seat];
      const fromDeck = uniq(c.E, c.s, P.deck.filter((y) => story(c.E, c.s, y))), fromHell = uniq(c.E, c.s, P.hell.filter((y) => story(c.E, c.s, y)));
      const m = c.mode(["1) นำเรื่องราวจาก Deck ขึ้นมือ", "2) นำเรื่องราวจากนรกขึ้นมือ"], "Full Drive: เลือกปฏิบัติ", fromHell.length && !fromDeck.length ? 1 : 0);
      const pool = m === 1 ? fromHell : fromDeck; const t = c.choose(pool, 1, m === 1 ? "เลือกเรื่องราวจากนรก" : "เลือกเรื่องราวจาก Deck")[0];
      const ops = t ? [m === 1 ? { op: "move", i: t.i, to: "hand" } : { op: "search", seat: c.seat, take: t.i, to: "hand" }] : [];
      const big = c.E.magicInHell(c.s, c.seat) >= 8; if (big) ops.push({ op: "draw", seat: c.seat, n: 1 });
      return { explain: (t ? `นำ ${c.E.name(c.s, t)} ขึ้นมือ` : "ไม่มีการ์ดเรื่องราวให้นำ") + (big ? " · Magic ในนรก 8+ จั่ว 1 ใบ" : ""), ops }; },
  },
  // Skill : Hypersense
  "BT09-059": {
    canCast: (E, s, p) => s.P[p].av.length > 0 && s.P[p].av.every((x) => story(E, s, x)),
    cast: (c) => { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะเสียความสามารถ")[0];
      if (!t) return { explain: "ไม่มีเป้าหมาย", ops: [] }; const big = c.E.magicInHell(c.s, c.seat) >= 8;
      return { explain: `${c.E.name(c.s, t)} เสียความสามารถจนจบเทิร์น${big ? " และถูกทำลาย (Magic ในนรก 8+)" : ""}`, ops: [{ op: "mute", i: t.i, until: "turn" }, ...(big ? [{ op: "destroy", i: t.i, why: "Skill : Hypersense" }] : [])] }; },
  },
  // Skill : Second Energy (approximation: protect a story Avatar once this turn)
  "BT09-060": {
    canCast: (E, s, p) => s.P[p].av.some((x) => story(E, s, x)),
    cast: (c) => { const t = c.choose(c.s.P[c.seat].av.filter((x) => story(c.E, c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือกเรื่องราวที่จะไม่ออกจากสนาม")[0];
      if (!t) return { explain: "ไม่มีเรื่องราวบนสนาม", ops: [] }; const big = c.E.magicInHell(c.s, c.seat) >= 8; const oh = c.s.P[1 - c.seat].hell;
      return { explain: `${c.E.name(c.s, t)} จะไม่ออกจากสนามครั้งถัดไปในเทิร์นนี้${big && oh.length ? " · ฝ่ายตรงข้ามเนรเทศการ์ดในนรก 1 ใบ" : ""}`, ops: [{ op: "guard", i: t.i }, ...(big && oh.length ? [{ op: "exile", i: oh[oh.length - 1].i }] : [])] }; },
  },
  // Skill : Dacknova
  "BT12-064": {
    canCast: (E, s, p) => s.P[p].av.some((x) => story(E, s, x) && !x.a),
    cast: (c) => { const t = c.choose(c.s.P[c.seat].av.filter((x) => story(c.E, c.s, x) && !x.a).sort(strongFirst(c.E, c.s)), 1, "เลือกเรื่องราวที่นอนอยู่ให้ตื่น")[0];
      if (!t) return { explain: "ไม่มีเรื่องราวที่นอนอยู่", ops: [] }; const big = c.E.magicInHell(c.s, c.seat) >= 8;
      return { explain: `${c.E.name(c.s, t)} ตื่น${big ? " และ POWER +2" : ""}`, ops: [{ op: "wake", i: t.i, v: true }, ...(big ? [{ op: "power", i: t.i, n: 2, temp: true }] : [])] }; },
  },
  // ไวรัส
  "BT11-020": { virusExile: true, activate: fromDark,
    death: (c) => { const m = virusMill(c, 2); let ops = m.ops, say = "ทุกคนธรณีสูบ 2 ใบ";
      if (m.avatars >= 3) { const pick = c.choose(uniq(c.E, c.s, c.s.P[c.seat].dark.filter((x) => virus(c.E, c.s, x) && x.i !== c.t.i)), 2, "อัญเชิญไวรัสจากมิติมืด (สูงสุด 2 ใบ ชื่อต่างกัน)", { optional: true });
        ops = [...ops, ...pick.map((x) => ({ op: "move", i: x.i, to: "av" }))]; if (pick.length) say += ` · อัญเชิญ ${pick.map((x) => c.E.name(c.s, x)).join(", ")}`; }
      return { explain: say + (m.avatars >= 3 ? "" : ` (ได้ Avatar ${m.avatars} ใบ ไม่ถึง 3)`), ops }; } },
  "BT11-021": { virusExile: true, activate: fromDark,
    summon: (c) => { const m = virusMill(c, 3); let ops = m.ops, say = "ทุกคนธรณีสูบ 3 ใบ";
      if (m.avatars >= 4) { const o = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้าม POWER -2", { optional: true })[0];
        const v = c.choose(c.s.P[c.seat].av.filter((x) => virus(c.E, c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือกไวรัสฝ่ายเรา POWER +2", { optional: true })[0];
        if (o) ops.push({ op: "power", i: o.i, n: -2, temp: true }); if (v) ops.push({ op: "power", i: v.i, n: 2, temp: true }); say += ` · ได้ Avatar ${m.avatars} ใบ`; }
      else say += ` (ได้ Avatar ${m.avatars} ใบ ไม่ถึง 4)`;
      return { explain: say, ops }; } },
  "BT11-022": { virusExile: true, activate: fromDark,
    attack: (c) => { if (c.self && c.self.used === "a" + c.s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] }; if (c.self) c.self.used = "a" + c.s.turn;
      const m = virusMill(c, 3); const ops = [...m.ops]; let say = "ทุกคนธรณีสูบ 3 ใบ";
      if (m.avatars >= 4) { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามให้เสียความสามารถและ POWER ตั้งต้น 0", { optional: true })[0];
        if (t) { ops.push({ op: "mute", i: t.i, until: "turn", zero: true }); say += ` · ${c.E.name(c.s, t)} เสียความสามารถ POWER ตั้งต้น 0`; } }
      else say += ` (ได้ Avatar ${m.avatars} ใบ ไม่ถึง 4)`;
      return { explain: say, ops }; } },
  // พรของอิศวร (Only #1)
  "CC01-042": {
    cast: (c) => { const P = c.s.P[c.seat], O = c.s.P[1 - c.seat];
      const best = O.av.length >= 2 ? 1 : P.hand.length <= 2 ? 0 : P.hell.length ? 2 : 0;
      const m = c.mode(["1) จั่วให้การ์ดบนมือครบ 5 ใบ", "2) ทำลาย Avatar อีกฝ่ายไม่เกิน 2 ใบ", "3) นำการ์ดจากนรกเราขึ้นมือ 2 ใบ"], "พรของอิศวร: เลือกปฏิบัติ", best);
      if (m === 0) { const n = Math.max(0, 5 - P.hand.length); return { explain: `จั่ว ${n} ใบ`, ops: n ? [{ op: "draw", seat: c.seat, n }] : [] }; }
      if (m === 1) { const t = c.choose(O.av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 2, "เลือก Avatar อีกฝ่ายที่จะทำลาย (ไม่เกิน 2 ใบ)", { optional: true });
        return { explain: t.length ? `ทำลาย ${t.map((x) => c.E.name(c.s, x)).join(", ")}` : "ไม่ทำลาย", ops: t.map((x) => ({ op: "destroy", i: x.i, why: "พรของอิศวร" })) }; }
      const t = c.choose([...P.hell].reverse(), 2, "เลือกการ์ดในนรกขึ้นมือ 2 ใบ");
      return { explain: `นำ ${t.map((x) => c.E.name(c.s, x)).join(", ")} ขึ้นมือ`, ops: t.map((x) => ({ op: "move", i: x.i, to: "hand" })) }; },
  },
});
