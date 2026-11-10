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
//   payOnly(def) / paidFor(def) + paid(ctx)   GEM restriction, and "when discarded as Cost for …"
//   milled(ctx) + millBy "god"|"any"          "ถ้าการ์ดใบนี้ถูกธรณีสูบด้วย …" (fires from hell)
//   shield: true      an attached card that is destroyed instead of the Avatar wearing it
//   modOnly(E, s, host) Modification may only be worn by host · noHand · noAttack(E, s, x) · win(ctx) after winning a fight
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

// ===================== ไดโนกาฬสินธุ์ (dino) =====================
const kapom = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "กะปอม");
const room = (c) => Math.max(0, 4 - c.E.avatars(c.s.P[c.seat]));
// how many cards a กะปอม scout looks at: +1 for each เทอราโนดอน จากต่างแดน on our field
const scoutN = (c, n) => n + c.s.P[c.seat].av.filter((x) => !x.mute && nm(c.E, c.s, x, "เทอราโนดอน")).length;
// After a กะปอม ability looked at `top`: สยามแรปเตอร์ may summon itself, ยุคกาฬสินธุ์โซอิค may go to the Land zone.
function scoutExtras(c, top, taken, free) {
  const ops = [], say = []; const left = top.filter((x) => !taken.includes(x.i));
  const rap = left.filter((x) => nm(c.E, c.s, x, "สยามแรปเตอร์"));
  if (rap.length && free > 0) { const pick = c.choose(rap, free, "สยามแรปเตอร์ถูกสอดแนม: อัญเชิญลงสนามได้", { optional: true, reveal: top.map((x) => x.i) });
    for (const x of pick) ops.push({ op: "put", i: x.i }); if (pick.length) say.push(`สยามแรปเตอร์ลงสนามเอง ${pick.length} ใบ`); }
  const land = left.find((x) => nm(c.E, c.s, x, "ยุคกาฬสินธุ์โซอิค"));
  if (land && !(c.s.land && nm(c.E, c.s, c.s.land, "ยุคกาฬสินธุ์โซอิค"))) { const m = c.mode(["ใช้ยุคกาฬสินธุ์โซอิคบน Land Magic Zone", "ไม่ใช้"], "ยุคกาฬสินธุ์โซอิคถูกสอดแนม", 0);
    if (m === 0) { ops.push({ op: "toLand", i: land.i }); say.push("ใช้ยุคกาฬสินธุ์โซอิคเป็น Land"); } }
  return { ops, say };
}
// scout n, choose up to k matching cards and send them to `to` ("put" / "putJ" / "hand"), rest shuffled back
function dinoScout(c, n0, test, k, to, prompt) {
  const n = scoutN(c, n0); const top = c.s.P[c.seat].deck.slice(0, n);
  const cands = top.filter((x) => test(x)).sort(strongFirst(c.E, c.s));
  const lim = to === "hand" ? k : Math.min(k, room(c));
  const got = lim > 0 && cands.length ? c.choose(cands, lim, prompt, { optional: true, reveal: top.map((x) => x.i) }) : [];
  const ops = got.map((x) => (to === "hand" ? { op: "search", seat: c.seat, take: x.i, to: "hand" } : { op: "put", i: x.i, jt: to === "putJ" }));
  const ex = scoutExtras(c, top, got.map((x) => x.i), (to === "hand" ? room(c) : lim - got.length));
  ops.push(...ex.ops, { op: "shuffle", seat: c.seat });
  const say = [`สอดแนม ${top.length} ใบ`, got.length ? `${to === "hand" ? "นำขึ้นมือ" : "อัญเชิญ"} ${got.map((x) => c.E.name(c.s, x)).join(", ")}` : "ไม่เลือกการ์ด", ...ex.say];
  return { explain: say.join(" · "), ops };
}
const gemVal = (E, s, x) => { const d = E.def(s, x); return (d.pw || 0) + (d.c || 0) * 0.6 + (d.o1 ? 20 : 0) - (d.g || 0) * 0.5; };
Object.assign(SCRIPTS, {
  // สยามโมไทรันนัส (Only #1): on attack scout 5, summon any number of กะปอม as จุติ
  "BT04-010": { attack: (c) => dinoScout(c, 5, (x) => kapom(c.E, c.s, x), 4, "putJ", "สอดแนม: เลือกกะปอมที่จะอัญเชิญแบบจุติ (กี่ใบก็ได้)") },
  // ภูเวียงสิรินเน: up to 4 กะปอม Cost ≤3 from hell back to the deck, draw 1, +1 POWER each
  "BT03-010": { summon: (c) => {
    const pool = c.s.P[c.seat].hell.filter((x) => kapom(c.E, c.s, x) && (c.E.def(c.s, x).c || 0) <= 3).sort(strongFirst(c.E, c.s));
    const pick = pool.length ? c.choose(pool, 4, "เลือกกะปอม Cost 3 หรือต่ำกว่าในนรก กลับเข้า Deck (สูงสุด 4 ใบ)", { optional: true }) : [];
    const ops = [...pick.map((x) => ({ op: "move", i: x.i, to: "deckBottom" })), { op: "shuffle", seat: c.seat }, { op: "draw", seat: c.seat, n: 1 }];
    if (pick.length && c.self) ops.push({ op: "power", i: c.self.i, n: pick.length, temp: true });
    return { explain: `นำกะปอม ${pick.length} ใบกลับเข้า Deck · จั่ว 1 ใบ${pick.length ? ` · POWER +${pick.length} จนจบเทิร์น` : ""}`, ops }; } },
  // กินรีมิมัส: scout 5, summon a กะปอม Cost ≤3
  "BT03-011": { summon: (c) => dinoScout(c, 5, (x) => kapom(c.E, c.s, x) && (c.E.def(c.s, x).c || 0) <= 3, 1, "put", "สอดแนม: เลือกกะปอม Cost 3 หรือต่ำกว่าที่จะอัญเชิญ") },
  // อิสานโนซอรัส: pays only for กะปอม; when paid: scout 1, keep it or put it to the bottom
  "BT03-012": { payOnly: (d) => d.t === "A" && String(d.sy || "").includes("กะปอม"), paidFor: (d) => String(d.sy || "").includes("กะปอม"),
    paid: (c) => { const n = scoutN(c, 1); const top = c.s.P[c.seat].deck.slice(0, n); if (!top.length) return { explain: "Deck หมด", ops: [] };
      const ex = scoutExtras(c, top, [], room(c)); const left = top.filter((x) => !ex.ops.some((o) => o.i === x.i));
      const ops = [...ex.ops]; const kept = [];
      for (const x of left) { const good = kapom(c.E, c.s, x) || isMagic(c.E, c.s, x);
        const m = c.mode([`ไว้ที่เดิม (${c.E.name(c.s, x)})`, `ไว้ใต้ Deck (${c.E.name(c.s, x)})`], `สอดแนมเจอ ${c.E.name(c.s, x)}`, good ? 0 : 1);
        if (m === 1) ops.push({ op: "move", i: x.i, to: "deckBottom" }); else kept.push(c.E.name(c.s, x)); }
      return { explain: [`สอดแนม ${top.length} ใบ`, kept.length ? `ไว้ที่เดิม ${kept.join(", ")}` : "ไว้ใต้ Deck", ...ex.say].join(" · "), ops }; } },
  // สัตยาซอรัส: every กะปอม on our Avatar Zone +1
  "BT03-013": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => kapom(E, s, x), n: 1 }] : []) },
  // สุธีธรนีซอรัส: last words — scout 3, summon another ไดโนกาฬสินธุ์ Cost ≤3
  "BT06-011": { death: (c) => dinoScout(c, 3, (x) => isAv(c.E, c.s, x) && nm(c.E, c.s, x, "ไดโนกาฬสินธุ์") && !nm(c.E, c.s, x, "สุธีธรนีซอรัส") && (c.E.def(c.s, x).c || 0) <= 3, 1, "put", "สอดแนม: เลือกไดโนกาฬสินธุ์ Cost 3 หรือต่ำกว่าที่จะอัญเชิญ") },
  // สยามแรปเตอร์: +2 in our turn (self-summon when scouted is handled by scoutExtras)
  "BT12-025": { aura: (E, s, src, L) => (L.z === "av" && s.active === L.p ? [{ seat: L.p, test: (x) => x.i === src.i, n: 2 }] : []) },
  // ดอกเตอร์เต้: exile a กะปอม from hell → summon a กะปอม Cost ≤5 from hell (it gains "last words: exile"); discard 1 more to make it จุติ
  "BT12-024": { summon: (c) => { const P = c.s.P[c.seat]; const k = P.hell.filter((x) => kapom(c.E, c.s, x));
    if (k.length < 2 || !room(c)) return { explain: "กะปอมในนรกไม่พอ (ต้องมีใบที่เนรเทศและใบที่อัญเชิญ) หรือสนามเต็ม", ops: [] };
    const best = [...k].filter((x) => (c.E.def(c.s, x).c || 0) <= 5).sort(strongFirst(c.E, c.s));
    const pay = c.choose([...k].filter((x) => best.some((b) => b.i !== x.i)).sort((a, b) => c.E.power(c.s, a) - c.E.power(c.s, b)), 1, "ค่าจุติ: เลือกกะปอมในนรกที่จะเนรเทศ", { optional: true })[0];
    if (!pay) return { explain: "ไม่จ่ายค่าจุติ", ops: [] };
    const t = c.choose(best.filter((x) => x.i !== pay.i), 1, "เลือกกะปอม Cost 5 หรือต่ำกว่าในนรกที่จะอัญเชิญ")[0]; if (!t) return { explain: "ไม่มีกะปอม Cost 5 หรือต่ำกว่าให้อัญเชิญ", ops: [{ op: "exile", i: pay.i }] };
    const hasJ = /(?<!อัญเชิญ\s*)จุติ/.test(c.E.def(c.s, t).x || ""); const hand = P.hand.filter((x) => x.i !== (c.self || {}).i);
    let disc = null; if (hasJ && hand.length) { const m = c.mode(["ทิ้งการ์ดบนมือ 1 ใบ ให้เป็นอัญเชิญจุติ", "ไม่ทิ้ง"], `${c.E.name(c.s, t)} มีความสามารถจุติ`, hand.length >= 3 ? 0 : 1);
      if (m === 0) disc = c.choose([...hand].sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b)), 1, "เลือกการ์ดบนมือที่จะทิ้ง", { exact: true })[0]; }
    return { explain: `เนรเทศ ${c.E.name(c.s, pay)} · อัญเชิญ ${c.E.name(c.s, t)} จากนรก${disc ? " แบบจุติ" : ""} (ถูกทำลายแล้วจะถูกเนรเทศ)`,
      ops: [{ op: "exile", i: pay.i }, ...(disc ? [{ op: "discard", seat: c.seat, iids: [disc.i] }] : []), { op: "put", i: t.i, jt: !!disc, exd: true }] }; } },
  // ยุคกาฬสินธุ์โซอิค (Land): once per turn discard GEM 3+ → scout 5, a กะปอม to hand (or summon it if Cost ≤3)
  "BT03-058": { activate: { label: "ทิ้ง GEM รวม 3+ : สอดแนม 5 หากะปอม",
    can: (E, s, x, L) => L.z === "land" && s.P[L.p].hand.reduce((a, y) => a + (E.def(s, y).g || 0), 0) >= 3,
    run: (c) => { const P = c.s.P[c.seat]; const gems = P.hand.filter((y) => (c.E.def(c.s, y).g || 0) > 0).sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b));
      // bot: cheapest set reaching 3 GEM
      const auto = []; let sum = 0; for (const y of [...gems].sort((a, b) => (c.E.def(c.s, b).g || 0) - (c.E.def(c.s, a).g || 0) || gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b))) { if (sum >= 3) break; auto.push(y); sum += c.E.def(c.s, y).g || 0; }
      const order = [...auto, ...gems.filter((y) => !auto.includes(y))];
      const disc = c.choose(order, c.interactive ? Math.min(4, order.length) : auto.length, "ทิ้งการ์ดบนมือที่มี GEM รวมกัน 3 ขึ้นไป");
      const g = disc.reduce((a, y) => a + (c.E.def(c.s, y).g || 0), 0); if (g < 3) return { explain: `GEM ที่ทิ้งรวม ${g} ไม่ถึง 3 ความสามารถไม่ทำงาน`, ops: [] };
      const n = scoutN(c, 5); const top = P.deck.slice(0, n); const cands = top.filter((x) => kapom(c.E, c.s, x)).sort(strongFirst(c.E, c.s));
      const t = cands.length ? c.choose(cands, 1, "สอดแนม: เลือกกะปอม 1 ใบขึ้นมือ", { reveal: top.map((x) => x.i) })[0] : null;
      let put = false; if (t && (c.E.def(c.s, t).c || 0) <= 3 && room(c)) put = c.mode([`อัญเชิญ ${c.E.name(c.s, t)} ลงสนาม`, "นำขึ้นมือ"], "กะปอม Cost 3 หรือต่ำกว่า", 0) === 0;
      const ops = [{ op: "discard", seat: c.seat, iids: disc.map((y) => y.i) }, ...(t ? [put ? { op: "put", i: t.i } : { op: "search", seat: c.seat, take: t.i, to: "hand" }] : [])];
      const ex = scoutExtras(c, top, t ? [t.i] : [], room(c) - (put ? 1 : 0)); ops.push(...ex.ops.filter((o) => o.op !== "toLand"), { op: "shuffle", seat: c.seat });
      return { explain: [`ทิ้ง GEM ${g}`, `สอดแนม ${top.length} ใบ`, t ? `${put ? "อัญเชิญ" : "นำขึ้นมือ"} ${c.E.name(c.s, t)}` : "ไม่พบกะปอม", ...ex.say.filter((x) => !x.includes("Land"))].join(" · "), ops }; } } },
});

// ===================== ไอดอล × โอตะ (idol) =====================
const idol = (E, s, x) => isAv(E, s, x) && nm(E, s, x, "ไอดอล");
const ota = (E, s, x) => nm(E, s, x, "โอตะ");
const otaOn = (E, s, host) => [0, 1].flatMap((q) => s.P[q].mg.filter((m) => m.on === host.i && ota(E, s, m)));
// โอตะ attached to idols on our side (the usual Cost of idol abilities)
const myOta = (E, s, p) => s.P[p].av.filter((h) => idol(E, s, h)).flatMap((h) => otaOn(E, s, h));
const weakOtaFirst = (E, s) => (a, b) => (E.def(s, a).pw || 0) - (E.def(s, b).pw || 0);
const bestIdol = (c, except) => c.s.P[c.seat].av.filter((x) => idol(c.E, c.s, x) && (!except || x.i !== except)).sort((a, b) => otaOn(c.E, c.s, a).length - otaOn(c.E, c.s, b).length || c.E.power(c.s, b) - c.E.power(c.s, a));
const destroyOtaCost = (c, n) => c.choose(myOta(c.E, c.s, c.seat).sort(weakOtaFirst(c.E, c.s)), n, `ค่าความสามารถ: เลือกโอตะที่สวมใส่ให้ไอดอลเพื่อทำลาย (${n} ใบ)`, { exact: true });
// the two-mode ability every โอตะ Avatar has: go onto an idol, or come back down to the Avatar Zone
const otaku = (extra = {}) => ({ ...extra,
  activate: { label: "โอตะ: สวมใส่ให้ไอดอล / ลงจากการสวมใส่",
    can: (E, s, x, L) => (L.z === "av" && s.P[L.p].av.some((h) => h.i !== x.i && idol(E, s, h))) || (L.z === "mg" && x.on && !s.P[L.p].bot && E.avatars(s.P[L.p]) < 4),
    run: (c) => { const L = c.E.locate(c.s, c.self.i);
      if (L.z === "mg") return { explain: `${c.E.name(c.s, c.self)} ลงจากการสวมใส่ไปที่ Avatar Zone`, ops: [{ op: "move", i: c.self.i, to: "av" }] };
      const h = c.choose(bestIdol(c, c.self.i), 1, "เลือกไอดอลที่จะสวมใส่โอตะใบนี้")[0];
      return h ? { explain: `${c.E.name(c.s, c.self)} ไปสวมใส่ให้ ${c.E.name(c.s, h)}`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่มีไอดอล", ops: [] }; } } });
const idolPay = (d) => String(d.n || "").includes("ไอดอล") || String(d.n || "").includes("โปรดิวเซอร์");
Object.assign(SCRIPTS, {
  "KD03-007": otaku({ shield: true }), // โอตะ รุ่นก่อตั้ง: dies instead of its idol
  "KD03-008": otaku({ death: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) }), // โอตะปุส
  "BT08-021": otaku({ otaCount: 2 }), // โอตะท๊อปโดเนท
  "KD03-002": otaku({ payOnly: idolPay }), // โอตะคูลา
  // โอตะตัวกะปอม: pays only for idols; when paid for an idol it may jump onto one
  "KD03-009": { payOnly: (d) => String(d.n || "").includes("ไอดอล"), paidFor: (d) => String(d.n || "").includes("ไอดอล"),
    paid: (c) => { const h = c.choose(bestIdol(c), 1, "โอตะตัวกะปอม: สวมใส่ให้ไอดอล (ไม่ใส่ก็ได้)", { optional: true })[0];
      return h ? { explain: `จากนรกไปสวมใส่ให้ ${c.E.name(c.s, h)}`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่สวมใส่", ops: [] }; } },
  // มีมมิจัง ไอดอลหน้าใหม่: an โอตะ Avatar from the deck onto itself
  "KD03-003": { summon: (c) => { const o = uniq(c.E, c.s, c.s.P[c.seat].deck.filter((x) => isAv(c.E, c.s, x) && ota(c.E, c.s, x))).sort((a, b) => (c.E.def(c.s, b).g || 0) - (c.E.def(c.s, a).g || 0));
    const t = c.choose(o, 1, "เลือกโอตะจาก Deck มาสวมใส่ให้มีมมิจัง")[0]; if (!t || !c.self) return { explain: "ไม่มีโอตะใน Deck", ops: [{ op: "shuffle", seat: c.seat }] };
    return { explain: `${c.E.name(c.s, t)} มาสวมใส่ให้มีมมิจัง`, ops: [{ op: "attach", i: t.i, on: c.self.i }, { op: "shuffle", seat: c.seat }] }; } },
  // แบมบูจัง: destroy an โอตะ worn by an idol → destroy a card on the field
  "KD03-004": { activate: { label: "ทำลายโอตะที่สวมใส่ 1 ใบ: ทำลายการ์ดบนสนาม 1 ใบ",
    can: (E, s, x, L) => L.z === "av" && myOta(E, s, L.p).length > 0 && (s.P[1 - L.p].av.length + s.P[1 - L.p].cs.length) > 0,
    run: (c) => { const o = destroyOtaCost(c, 1); const O = c.s.P[1 - c.seat];
      const t = c.choose([...O.av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), ...O.cs], 1, "เลือกการ์ดบนสนามฝ่ายตรงข้ามที่จะทำลาย")[0];
      return { explain: `ทำลาย ${o.map((x) => c.E.name(c.s, x)).join(", ")}${t ? ` · ทำลาย ${c.E.name(c.s, t)}` : ""}`, ops: [...o.map((x) => ({ op: "destroy", i: x.i, why: "ค่าความสามารถของแบมบูจัง" })), ...(t ? [{ op: "destroy", i: t.i, why: "แบมบูจัง" }] : [])] }; } } },
  // โทมาโทจัง: other idols wearing an โอตะ +2; can't be attacked while it wears one and another idol is here
  "KD03-005": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i !== src.i && idol(E, s, x) && otaOn(E, s, x).length > 0, n: 2 }] : []),
    untargetable: (E, s, x, L) => L.z === "av" && otaOn(E, s, x).length > 0 && s.P[L.p].av.some((y) => y.i !== x.i && idol(E, s, y) && E.def(s, y).n !== E.def(s, x).n) },
  // มยุราซัง: an โอตะ Avatar from hell (or the deck with ทัตดนัยซัง) onto another idol
  "KD03-006": { activate: { label: "นำโอตะจากนรกมาสวมใส่ให้ไอดอลใบอื่น",
    can: (E, s, x, L) => L.z === "av" && s.P[L.p].av.some((h) => h.i !== x.i && idol(E, s, h)) && (s.P[L.p].hell.some((y) => isAv(E, s, y) && ota(E, s, y)) || (s.P[L.p].av.some((y) => nm(E, s, y, "ทัตดนัยซัง")) && s.P[L.p].deck.some((y) => isAv(E, s, y) && ota(E, s, y)))),
    run: (c) => { const P = c.s.P[c.seat]; const prod = P.av.some((y) => nm(c.E, c.s, y, "ทัตดนัยซัง"));
      const pool = [...P.hell.filter((y) => isAv(c.E, c.s, y) && ota(c.E, c.s, y)), ...(prod ? uniq(c.E, c.s, P.deck.filter((y) => isAv(c.E, c.s, y) && ota(c.E, c.s, y))) : [])];
      const t = c.choose(pool, 1, "เลือกโอตะ (จากนรก" + (prod ? " หรือ Deck" : "") + ")")[0]; const h = t ? c.choose(bestIdol(c, c.self.i), 1, "สวมใส่ให้ไอดอลใบไหน")[0] : null;
      if (!t || !h) return { explain: "ไม่มีโอตะหรือไอดอลให้เลือก", ops: [] }; const fromDeck = P.deck.includes(t);
      return { explain: `${c.E.name(c.s, t)} ${fromDeck ? "จาก Deck" : "จากนรก"} สวมใส่ให้ ${c.E.name(c.s, h)}`, ops: [{ op: "attach", i: t.i, on: h.i }, ...(fromDeck ? [{ op: "shuffle", seat: c.seat }] : [])] }; } } },
  // ชาช่าจัง: cannot attack unless it destroys a worn โอตะ this turn
  "BT07-022": { noAttack: (E, s, x) => x.canAtk !== s.turn,
    activate: { label: "ทำลายโอตะที่สวมใส่ 1 ใบ: เทิร์นนี้โจมตีได้", battle: true,
      can: (E, s, x, L) => L.z === "av" && x.canAtk !== s.turn && myOta(E, s, L.p).length > 0 && s.turn > 1,
      run: (c) => { const o = destroyOtaCost(c, 1); return { explain: `ทำลาย ${o.map((x) => c.E.name(c.s, x)).join(", ")} · ชาช่าจังโจมตีได้ในเทิร์นนี้`, ops: [...o.map((x) => ({ op: "destroy", i: x.i, why: "ค่าความสามารถของชาช่าจัง" })), { op: "flag", i: c.self.i, k: "canAtk", v: c.s.turn }] }; } } },
  // เนียจัง: destroy 2 worn โอตะ (ท๊อปโดเนท counts as 2) → take an opposing Avatar as an โอตะ on itself
  "BT08-029": { activate: { label: "ทำลายโอตะ 2 ใบ: ดึง Avatar ฝ่ายตรงข้ามมาสวมใส่",
    can: (E, s, x, L) => L.z === "av" && myOta(E, s, L.p).reduce((a, m) => a + ((scriptOfLite(E, s, m) || {}).otaCount || 1), 0) >= 2 && s.P[1 - L.p].av.some((y) => !y.tok),
    run: (c) => { const all = myOta(c.E, c.s, c.seat).sort(weakOtaFirst(c.E, c.s)); const two = all.find((m) => nm(c.E, c.s, m, "ท๊อปโดเนท"));
      const o = two && !c.interactive ? [two] : c.choose(all, 2, "เลือกโอตะที่จะทำลาย (ท๊อปโดเนทนับเป็น 2 ใบ)");
      const cnt = o.reduce((a, m) => a + (nm(c.E, c.s, m, "ท๊อปโดเนท") ? 2 : 1), 0); if (cnt < 2) return { explain: "โอตะไม่พอ 2 ใบ ความสามารถไม่ทำงาน", ops: [] };
      const t = c.choose(c.s.P[1 - c.seat].av.filter((y) => !y.tok && !c.E.untargetable(c.s, y)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามมาเป็นโอตะของเนียจัง")[0];
      return { explain: `ทำลายโอตะ ${o.length} ใบ${t ? ` · ${c.E.name(c.s, t)} กลายเป็นโอตะสวมใส่ให้เนียจัง` : ""}`, ops: [...o.map((x) => ({ op: "destroy", i: x.i, why: "ค่าความสามารถของเนียจัง" })), ...(t ? [{ op: "attach", i: t.i, on: c.self.i }] : [])] }; } } },
  // มีมมิจัง ไอดอล No.1: จุติ — an idol from the deck plus an โอตะ from the deck onto it; End Phase: back into the deck, draw 1
  "KD03-001": {
    summon: (c) => { const P = c.s.P[c.seat]; if (!room(c)) return { explain: "Avatar Zone เต็ม", ops: [] };
      const i = c.choose(uniq(c.E, c.s, P.deck.filter((x) => idol(c.E, c.s, x))).sort(strongFirst(c.E, c.s)), 1, "เลือกไอดอลจาก Deck ที่จะอัญเชิญ")[0];
      const o = i ? c.choose(uniq(c.E, c.s, P.deck.filter((x) => x.i !== i.i && ota(c.E, c.s, x))), 1, "เลือกโอตะจาก Deck มาสวมใส่ให้ไอดอลที่อัญเชิญ")[0] : null;
      return { explain: i ? `อัญเชิญ ${c.E.name(c.s, i)}${o ? ` พร้อม ${c.E.name(c.s, o)}` : ""} จาก Deck` : "ไม่มีไอดอลใน Deck", ops: [...(i ? [{ op: "put", i: i.i }] : []), ...(i && o ? [{ op: "attach", i: o.i, on: i.i }] : []), { op: "shuffle", seat: c.seat }] }; },
    endPhase: (E, s, x, L) => (L.z === "av" && s.active === L.p ? [{ op: "move", i: x.i, to: "deckBottom" }, { op: "shuffle", seat: L.p }, { op: "draw", seat: L.p, n: 1 }] : []) },
  // ของขวัญจากโอตะ: worn by an idol → draw 1
  "KD03-019": { cast: (c) => { const H = c.t.on != null ? c.E.locate(c.s, c.t.on) : null; return H && idol(c.E, c.s, H.x) ? { explain: "สวมใส่ให้ไอดอล จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] } : { explain: "ไม่ได้สวมใส่ให้ไอดอล", ops: [] }; } },
  // ตู้โชว์ไอดอล
  "KD03-014": { canCast: (E, s, p) => s.P[p].av.some((x) => idol(E, s, x)),
    cast: (c) => { const t = c.choose(uniq(c.E, c.s, c.s.P[c.seat].deck.filter((x) => isAv(c.E, c.s, x) && ota(c.E, c.s, x))).sort((a, b) => (c.E.def(c.s, b).g || 0) - (c.E.def(c.s, a).g || 0)), 1, "เลือกโอตะจาก Deck ขึ้นมือ")[0];
      return t ? { explain: `นำ ${c.E.name(c.s, t)} ขึ้นมือ`, ops: [{ op: "search", seat: c.seat, take: t.i, to: "hand" }] } : { explain: "ไม่มีโอตะใน Deck", ops: [{ op: "shuffle", seat: c.seat }] }; } },
  // เวทีแห่งความฝัน (Land): discard 1 → 1) scout 5, up to 2 โอตะ onto an idol  2) scout 7, an idol to hand
  "KD03-020": { activate: { label: "ทิ้ง 1 ใบ: สอดแนมหาโอตะ หรือ ไอดอล",
    can: (E, s, x, L) => L.z === "land" && s.P[L.p].hand.length > 0,
    run: (c) => { const P = c.s.P[c.seat]; const hasIdol = P.av.some((x) => idol(c.E, c.s, x));
      const m = c.mode(["1) สอดแนม 5 ใบ โอตะสูงสุด 2 ใบสวมใส่ให้ไอดอล", "2) สอดแนม 7 ใบ นำไอดอล 1 ใบขึ้นมือ"], "เวทีแห่งความฝัน: เลือกปฏิบัติ", hasIdol ? 0 : 1);
      if (m === 0 && !hasIdol) return { explain: "ไม่มีไอดอลบนสนาม", ops: [] };
      const d = c.choose([...P.hand].sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      const top = P.deck.slice(0, m === 0 ? 5 : 7); const ops = [{ op: "discard", seat: c.seat, iids: [d.i] }];
      if (m === 0) { const o = c.choose(top.filter((x) => ota(c.E, c.s, x)), 2, "เลือกโอตะจากที่สอดแนม (สูงสุด 2 ใบ)", { optional: true, reveal: top.map((x) => x.i) });
        const h = o.length ? c.choose(bestIdol(c), 1, "สวมใส่ให้ไอดอลใบไหน")[0] : null; if (h) ops.push(...o.map((x) => ({ op: "attach", i: x.i, on: h.i })));
        ops.push({ op: "shuffle", seat: c.seat }); return { explain: `ทิ้ง ${c.E.name(c.s, d)} · สอดแนม 5 ใบ${h && o.length ? ` · ${o.map((x) => c.E.name(c.s, x)).join(", ")} สวมใส่ให้ ${c.E.name(c.s, h)}` : " · ไม่ได้โอตะ"}`, ops }; }
      const t = c.choose(top.filter((x) => idol(c.E, c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือกไอดอลจากที่สอดแนมขึ้นมือ", { optional: true, reveal: top.map((x) => x.i) })[0];
      if (t) ops.push({ op: "search", seat: c.seat, take: t.i, to: "hand" }); else ops.push({ op: "shuffle", seat: c.seat });
      return { explain: `ทิ้ง ${c.E.name(c.s, d)} · สอดแนม 7 ใบ${t ? ` · นำ ${c.E.name(c.s, t)} ขึ้นมือ` : " · ไม่ได้ไอดอล"}`, ops }; } } },
});
function scriptOfLite(E, s, x) { const d = E.def(s, x); return d && String(d.n || "").includes("ท๊อปโดเนท") ? { otaCount: 2 } : null; }

// ===================== เทพธิดาแห่งวัลฮัลลา (valkyrie) =====================
// "milled" fires when the card is milled into hell: millBy "god" = by a purple {เทพ} Avatar or a Magic, "any" = by anything
const valk = (E, s, x) => isAv(E, s, x) && nm(E, s, x, "เทพธิดาแห่งวัลฮัลลา");
const putSelf = (label) => (c) => { if (!room(c)) return { explain: "Avatar Zone เต็ม", ops: [] };
  const m = c.mode([`อัญเชิญ ${c.E.name(c.s, c.self)} จากนรก`, "ไม่อัญเชิญ"], label, 0); return m === 0 ? { explain: "อัญเชิญจากนรก", ops: [{ op: "put", i: c.self.i }] } : { explain: "ไม่อัญเชิญ", ops: [] }; };
const valkFromHell = (c, test, prompt) => { const t = room(c) ? c.choose(uniq(c.E, c.s, c.s.P[c.seat].hell.filter((x) => valk(c.E, c.s, x) && x.i !== (c.self || {}).i && test(x))).sort(strongFirst(c.E, c.s)), 1, prompt)[0] : null;
  return t ? { explain: `อัญเชิญ ${c.E.name(c.s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "ไม่มีเทพธิดาในนรกให้อัญเชิญ หรือสนามเต็ม", ops: [] }; };
const attachValk = (c, label) => { const hs = c.s.P[c.seat].av.filter((x) => valk(c.E, c.s, x)).sort(strongFirst(c.E, c.s));
  const h = hs.length ? c.choose(hs, 1, label, { optional: true })[0] : null; return h ? { explain: `สวมใส่ให้ ${c.E.name(c.s, h)} จากนรก`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่สวมใส่", ops: [] }; };
const modValk = (E, s, h) => valk(E, s, h);
Object.assign(SCRIPTS, {
  "BT05-027": { millBy: "god", milled: putSelf("บรุนฮิลด์ถูกธรณีสูบ") },
  "BT06-027": { millBy: "god", milled: (c) => valkFromHell(c, (x) => (c.E.def(c.s, x).c || 0) <= 4 && !nm(c.E, c.s, x, "สกัลด์"), "สกัลด์ถูกธรณีสูบ: เลือกเทพธิดา Cost 4 หรือต่ำกว่าในนรกที่จะอัญเชิญ") },
  "BT06-028": { millBy: "god", milled: (c) => ({ explain: "โอลรุนกลับขึ้นมือ", ops: [{ op: "move", i: c.self.i, to: "hand" }] }) },
  "SD03-003": { millBy: "any", noHand: true, milled: putSelf("นายนิรยบาล แว่น ถูกธรณีสูบ") },
  // ซีกรุน: mill 3 → POWER +1
  "BT06-029": { activate: { label: "ธรณีสูบ 3 ใบ: POWER +1", can: (E, s, x, L) => L.z === "av" && s.P[L.p].deck.length > 8,
    run: (c) => ({ explain: "ธรณีสูบ 3 ใบ · POWER +1 จนจบเทิร์น", ops: [{ op: "mill", seat: c.seat, n: 3 }, { op: "power", i: c.self.i, n: 1, temp: true }] }) } },
  // บัลเดอร์: once per turn, mill 9 instead of being destroyed
  "BT03-024": { wouldDestroy: (E, s, x, L) => { const P = s.P[L.p]; if (P.deck.length < (P.bot ? 15 : 9)) return false;
    E.log(s, L.p, `${E.name(s, x)} ธรณีสูบ 9 ใบแทนการถูกทำลาย`); E.ops(s, [{ op: "mill", seat: L.p, n: 9, src: x.c }], L.p); return true; } },
  // เฟรย่า (พอดี): 3 purple {เทพ} Avatars from hell back to the deck, draw 1
  "BT05-025": { summon: (c) => { if (!c.t.exact) return { explain: "ไม่ได้อัญเชิญแบบพอดี ความสามารถไม่ทำงาน", ops: [] };
    const pool = c.s.P[c.seat].hell.filter((x) => isAv(c.E, c.s, x) && sy(c.E, c.s, x, "เทพ") && c.E.def(c.s, x).co === "ม่วง");
    const pick = c.choose(pool.sort(strongFirst(c.E, c.s)), 3, "เลือกเทพสีม่วงในนรก 3 ใบกลับเข้า Deck", { exact: pool.length >= 3 });
    return { explain: `นำ ${pick.length} ใบกลับเข้า Deck · จั่ว 1 ใบ`, ops: [...pick.map((x) => ({ op: "move", i: x.i, to: "deckBottom" })), { op: "shuffle", seat: c.seat }, { op: "draw", seat: c.seat, n: 1 }] }; } },
  // การสละชีพของเทพธิดา
  "BT08-053": { canCast: (E, s, p) => s.P[p].av.some((x) => valk(E, s, x)) && s.P[1 - p].av.length > 0, millBy: "god",
    cast: (c) => { const mine = c.choose(c.s.P[c.seat].av.filter((x) => valk(c.E, c.s, x)).sort((a, b) => c.E.power(c.s, a) - c.E.power(c.s, b)), 1, "ค่าใช้จ่าย: เลือกเทพธิดาของเราที่จะทำลาย", { exact: true })[0];
      const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย")[0];
      return { explain: `ทำลาย ${mine ? c.E.name(c.s, mine) : "-"} · ทำลาย ${t ? c.E.name(c.s, t) : "-"}`, ops: [...(mine ? [{ op: "destroy", i: mine.i, why: "การสละชีพของเทพธิดา" }] : []), ...(t ? [{ op: "destroy", i: t.i, why: "การสละชีพของเทพธิดา" }] : [])] }; },
    milled: (c) => valkFromHell(c, () => true, "การสละชีพถูกธรณีสูบ: เลือกเทพธิดาในนรกที่จะอัญเชิญ") },
  // หอกศักดิ์สิทธิ์ เอ็ดดา: valkyries only; when milled it may jump onto a valkyrie
  "BT09-066": { modOnly: modValk, millBy: "any", milled: (c) => attachValk(c, "หอกเอ็ดดาถูกธรณีสูบ: สวมใส่ให้เทพธิดา (ไม่ใส่ก็ได้)") },
  // ศาสตราวุธ โวลุสปา: valkyries only; dies instead of its wearer; when milled (and no Modification used this turn) it may be used from hell
  "BT10-067": { modOnly: modValk, shield: true, millBy: "any",
    milled: (c) => { if (c.s.mu[c.seat].D) return { explain: "เทิร์นนี้ใช้ Modification ไปแล้ว", ops: [] }; const r = attachValk(c, "โวลุสปาถูกธรณีสูบ: ใช้งานจากนรกให้เทพธิดา (ไม่ใช้ก็ได้)");
      if (r.ops.length) r.ops.push({ op: "mu", seat: c.seat, k: "D" }); return r; } },
  // ซีเกิร์ด (Only #1)
  "BT10-029": {
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => valk(E, s, x), n: 1 }, { seat: L.p, test: (x) => valk(E, s, x) && nm(E, s, x, "บรุนฮิลด์"), n: 1 }] : []),
    activate: { label: "ซีเกิร์ด: คืนเทพธิดาเข้า Deck แล้วธรณีสูบ 3 ทำลายศัตรู / อัญเชิญจากนรก",
      can: (E, s, x, L) => (L.z === "av" && s.P[L.p].hell.some((y) => valk(E, s, y)) && s.P[1 - L.p].av.length > 0 && s.P[L.p].deck.length > 6)
        || (L.z === "hell" && s.P[L.p].av.some((y) => nm(E, s, y, "บรุนฮิลด์")) && E.avatars(s.P[L.p]) < 4 && s.P[L.p].deck.length > (s.P[L.p].bot ? 14 : 9)),
      run: (c) => { const L = c.E.locate(c.s, c.self.i);
        if (L.z === "hell") return { explain: "ธรณีสูบ 9 ใบ · อัญเชิญซีเกิร์ดจากนรก", ops: [{ op: "mill", seat: c.seat, n: 9 }, { op: "put", i: c.self.i }] };
        const back = c.choose(c.s.P[c.seat].hell.filter((x) => valk(c.E, c.s, x)), 3, "เลือกเทพธิดาในนรก 1-3 ใบกลับเข้า Deck");
        return { explain: `นำเทพธิดา ${back.length} ใบกลับเข้า Deck · ธรณีสูบ 3 ใบ แล้วทำลายศัตรูตาม Cost`, ops: [...back.map((x) => ({ op: "move", i: x.i, to: "deckBottom" })), { op: "shuffle", seat: c.seat }, { op: "millKill", seat: c.seat, n: 3, base: 2, name: "เทพธิดาแห่งวัลฮัลลา" }] }; } } },
  // ธอร์: after winning a fight, destroy an enemy Avatar with POWER equal to the difference
  "BT02-018": { win: (c) => { const X = c.t.diff; const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => c.E.power(c.s, x) === X && !c.E.untargetable(c.s, x)), 1, `เลือก Avatar ฝ่ายตรงข้าม POWER ${X} ที่จะทำลาย`)[0];
    return t ? { explain: `ทำลาย ${c.E.name(c.s, t)} (POWER ${X})`, ops: [{ op: "destroy", i: t.i, why: "ธอร์" }] } : { explain: `ไม่มี Avatar POWER ${X}`, ops: [] }; } },
  // แอสการ์ดคือสถานที่ไม่ใช่ผู้คน (Land): discard 1 → borrow a sleeping enemy Avatar (Cost ≤3) until end of turn
  "BT02-060": { activate: { label: "ทิ้ง 1 ใบ: ยึด Avatar ที่นอนอยู่ (Cost ≤3) จนจบเทิร์น",
    can: (E, s, x, L) => L.z === "land" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].av.some((y) => !y.a && !y.tok && (E.def(s, y).c || 0) <= 3),
    run: (c) => { const d = c.choose([...c.s.P[c.seat].hand].sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      const t = c.choose(c.s.P[1 - c.seat].av.filter((y) => !y.a && !y.tok && (c.E.def(c.s, y).c || 0) <= 3).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่นอนอยู่ (Cost ≤3)")[0];
      return { explain: `ทิ้ง ${c.E.name(c.s, d)}${t ? ` · ยึด ${c.E.name(c.s, t)} จนจบเทิร์น` : ""}`, ops: [{ op: "discard", seat: c.seat, iids: [d.i] }, ...(t ? [{ op: "control", i: t.i, seat: c.seat, until: "turn", asleep: true }] : [])] }; } } },
});

// ===================== React cards (answer windows) =====================
// react.kinds: "summon" (an Avatar was summoned), "cast" (a Magic was used), "attack" (we are being attacked)
// The trigger carries the window as c.t.on = { kind, by, i } or { kind:"attack", by, att, tk, ti }.
const onTarget = (c) => c.t.on || {};
const myTargetAttacked = (E, s, p, on) => on.kind === "attack" && on.tk === "av" && (E.locate(s, on.ti) || {}).p === p;
const destroySummoned = { react: { kinds: ["summon"], can: (E, s, p, on) => !!E.locate(s, on.i) && (E.locate(s, on.i) || {}).z === "av" },
  cast: (c) => { const L = c.E.locate(c.s, onTarget(c).i); return L ? { explain: `ทำลาย ${c.E.name(c.s, L.x)} ที่เพิ่งอัญเชิญ`, ops: [{ op: "destroy", i: L.x.i, why: "อุบัติเหตุ!!!" }] } : { explain: "เป้าหมายหายไปแล้ว", ops: [] }; } };
Object.assign(SCRIPTS, {
  "SD01-017": destroySummoned, "KD03-016": destroySummoned, // อุบัติเหตุ!!!
  // ไม่เจ้ายังไม่พร้อม
  "BT03-047": { react: { kinds: ["summon"], can: (E, s, p, on) => (E.locate(s, on.i) || {}).z === "av" },
    cast: (c) => { const L = c.E.locate(c.s, onTarget(c).i); return L ? { explain: `${c.E.name(c.s, L.x)} เปลี่ยนเป็นสภาพนอน`, ops: [{ op: "wake", i: L.x.i, v: false }] } : { explain: "เป้าหมายหายไปแล้ว", ops: [] }; } },
  // เจ้ากล้าดียังไง
  "BT01-039": { react: { kinds: ["attack"] },
    cast: (c) => { const L = c.E.locate(c.s, onTarget(c).att); return L ? { explain: `ส่ง ${c.E.name(c.s, L.x)} ที่ประกาศโจมตีลงนรก`, ops: [{ op: "move", i: L.x.i, to: "hell" }, { op: "cancelAttack" }] } : { explain: "ผู้โจมตีหายไปแล้ว", ops: [] }; } },
  // หนีคือยอดกลยุทธ์
  "SD07-016": { react: { kinds: ["attack"], can: myTargetAttacked },
    cast: (c) => { const L = c.E.locate(c.s, onTarget(c).ti); return L ? { explain: `${c.E.name(c.s, L.x)} หนีกลับขึ้นมือ`, ops: [{ op: "move", i: L.x.i, to: "hand" }, { op: "cancelAttack" }] } : { explain: "เป้าหมายหายไปแล้ว", ops: [] }; } },
  // เอากล้วยมานี่ย์ !!!!!!
  "BT02-052": { react: { kinds: ["attack"], can: myTargetAttacked },
    cast: (c) => { const on = onTarget(c); const pool = c.s.P[1 - c.seat].av.filter((x) => !c.E.untargetable(c.s, x)).sort((a, b) => (b.i === on.att ? 1 : 0) - (a.i === on.att ? 1 : 0));
      const t = c.choose(pool, 1, "เลือก Avatar อีกฝ่าย POWER -2")[0]; return t ? { explain: `${c.E.name(c.s, t)} POWER -2 จนจบเทิร์น`, ops: [{ op: "power", i: t.i, n: -2, temp: true }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // ฟ้องครู
  "BT02-053": { react: { kinds: ["attack"], can: (E, s, p, on) => myTargetAttacked(E, s, p, on) && s.P[p].av.length > 1 },
    cast: (c) => { const on = onTarget(c); const pool = c.s.P[c.seat].av.filter((x) => x.i !== on.ti).sort((a, b) => c.E.power(c.s, b) - c.E.power(c.s, a));
      const t = c.choose(pool, 1, "เลือก Avatar ฝ่ายเราที่จะยืม POWER ให้เป้าหมาย")[0]; const T = c.E.locate(c.s, on.ti);
      return t && T ? { explain: `${c.E.name(c.s, T.x)} POWER +${c.E.power(c.s, t)} จาก ${c.E.name(c.s, t)}`, ops: [{ op: "power", i: T.x.i, n: c.E.power(c.s, t), temp: true }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // ไปเลยมอนตี้
  "BT02-054": { react: { kinds: ["attack"] },
    cast: (c) => { const on = onTarget(c); const P = c.s.P[c.seat]; const n = 2 * (P.av.length + P.cs.length + P.mg.length + P.hand.length); const L = c.E.locate(c.s, on.att);
      return L ? { explain: `${c.E.name(c.s, L.x)} POWER -${n}`, ops: [{ op: "power", i: L.x.i, n: -Math.min(20, n), temp: true }] } : { explain: "ผู้โจมตีหายไปแล้ว", ops: [] }; } },
  // กระแสสิริมงคล
  "BT02-049": { react: { kinds: ["attack"] }, cast: (c) => ({ explain: "จั่ว 1 ใบ (โจมตี 1 ตัว)", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // หมอมาแล้วววว: in a window we protect the attacked Avatar (or choose one)
  "BT01-040": { react: { kinds: ["attack", "summon", "cast"] },
    cast: (c) => { const on = onTarget(c); const T = on.kind === "attack" && on.tk === "av" ? c.E.locate(c.s, on.ti) : null;
      const t = T ? T.x : c.choose([...c.s.P[c.seat].av, ...c.s.P[1 - c.seat].av], 1, "เลือก Avatar ที่จะไม่ถูกทำลาย (ครั้งถัดไปในเทิร์นนี้)")[0];
      return t ? { explain: `${c.E.name(c.s, t)} จะไม่ถูกทำลายครั้งถัดไปในเทิร์นนี้`, ops: [{ op: "guard", i: t.i }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // งับ (dino)
  "BT03-050": { react: { kinds: ["attack"] },
    cast: (c) => { const on = onTarget(c); const top = c.s.P[c.seat].deck.slice(0, 2); const cands = top.filter((x) => isAv(c.E, c.s, x) && sy(c.E, c.s, x, "กะปอม"));
      const got = c.choose(cands, 1, "สอดแนม 2 ใบ: เลือก Avatar กะปอมขึ้นมือ", { reveal: top.map((x) => x.i), optional: true })[0];
      if (!got) return { explain: "สอดแนม 2 ใบ ไม่ได้ไดโน", ops: [{ op: "shuffle", seat: c.seat }] };
      const L = c.E.locate(c.s, on.att);
      return { explain: `ได้ ${c.E.name(c.s, got)} ขึ้นมือ · ทำลายผู้โจมตี`, ops: [{ op: "search", seat: c.seat, take: got.i, to: "hand" }, ...(L ? [{ op: "destroy", i: L.x.i, why: "งับ" }] : [])] }; } },
  // งานจับมือ (idol)
  "KD03-015": { react: { kinds: ["attack"], can: (E, s, p, on) => myTargetAttacked(E, s, p, on) && nm(E, s, E.locate(s, on.ti).x, "ไอดอล") },
    cast: (c) => { const ota = c.s.P[c.seat].hell.filter((x) => nm(c.E, c.s, x, "โอตะ")); const idols = c.s.P[c.seat].av.filter((x) => nm(c.E, c.s, x, "ไอดอล"));
      const o = c.choose(ota, 1, "เลือกโอตะในนรกที่จะสวมใส่", { optional: true })[0]; const h = o ? c.choose(idols, 1, "สวมใส่ให้ไอดอลใบไหน")[0] : null;
      return { explain: "ยกเลิกการโจมตี" + (o && h ? ` · ${c.E.name(c.s, o)} สวมใส่ให้ ${c.E.name(c.s, h)}` : ""), ops: [{ op: "cancelAttack" }, ...(o && h ? [{ op: "attach", i: o.i, on: h.i }] : [])] }; } },
  // เสียงเรียกแห่งวัลฮัลลา (valkyrie): only while critical
  "BT06-052": { canCast: (E, s, p) => E.critical(s.P[p]), react: { kinds: ["attack"] },
    cast: (c) => { const val = uniq(c.E, c.s, c.s.P[c.seat].hell.filter((x) => nm(c.E, c.s, x, "เทพธิดาแห่งวัลฮัลลา")));
      const room = 4 - c.E.avatars(c.s.P[c.seat]); const pick = c.choose(val, Math.max(0, Math.min(4, room)), "อัญเชิญเทพธิดาจากนรก (สูงสุด 4 ใบ)", { optional: true });
      return { explain: `ธรณีสูบ 5 · ยกเลิกการโจมตี${pick.length ? ` · อัญเชิญ ${pick.map((x) => c.E.name(c.s, x)).join(", ")}` : ""}`, ops: [{ op: "mill", seat: c.seat, n: 5 }, { op: "cancelAttack" }, ...pick.map((x) => ({ op: "move", i: x.i, to: "av" }))] }; } },
  // ไฮแจ็ค ไฮรีเทิร์น (virus)
  "BT11-060": { react: { kinds: ["attack"], can: (E, s, p) => s.P[p].hell.some((x) => virus(E, s, x)) },
    cast: (c) => { const on = onTarget(c); const v = c.s.P[c.seat].hell.filter((x) => virus(c.E, c.s, x) && !c.E.def(c.s, x).o1)[0]; const L = c.E.locate(c.s, on.att);
      return v && L ? { explain: `เนรเทศ ${c.E.name(c.s, v)} · ${c.E.name(c.s, L.x)} POWER ตั้งต้นเป็น 0`, ops: [{ op: "exile", i: v.i }, { op: "zero", i: L.x.i }] } : { explain: "ไม่มีไวรัสในนรก หรือผู้โจมตีหายไป", ops: [] }; } },
  // ชีวิตเหนือหน้าที่ (SD09)
  "SD09-016": { react: { kinds: ["attack"], can: (E, s, p) => s.P[p].av.some((x) => nm(E, s, x, "วานร")) },
    cast: (c) => { const w = c.choose(c.s.P[c.seat].av.filter((x) => nm(c.E, c.s, x, "วานร")).sort((a, b) => c.E.power(c.s, a) - c.E.power(c.s, b)), 1, "เลือกวานรที่จะไปไว้บนสุดของ Deck")[0];
      return w ? { explain: `${c.E.name(c.s, w)} กลับบนสุด Deck · ยกเลิกการโจมตี`, ops: [{ op: "move", i: w.i, to: "deckTop" }, { op: "cancelAttack" }] } : { explain: "ไม่มีวานร", ops: [] }; } },
});
SCRIPTS["SD07-017"] = SCRIPTS["BT01-040"]; // same card, slightly different wording
Object.assign(SCRIPTS["BT06-052"], { millBy: "god", milled: (c) => ({ explain: "เสียงเรียกแห่งวัลฮัลลากลับขึ้นมือ", ops: [{ op: "move", i: c.self.i, to: "hand" }] }) });
