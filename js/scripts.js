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
//   noAim(E, s, src, Ls, x, L)   -> true when the opponent's abilities may not choose our card x (กวนอู)
//   noUnite: true                the opponent may not use สามัคคี (ด่านเฮาโลก๋วน)
//   stab(ctx) + stabOk(E, s, y, att)        "เมื่อการ์ดใบนี้ใช้ความสามารถ แทงหลัง …"
//   summonedBy(ctx) + byOk(E, s, srcDef, x) "เมื่อการ์ดใบนี้ถูกอัญเชิญมาด้วยความสามารถของ …"
//   retarget(ctx) + retargetOk(E, s, y, L)  "เมื่อมีการเปลี่ยนเป้าหมายการโจมตี"
const sy = (E, s, x, k) => (E.hasSy ? E.hasSy(s, x, k) : String(E.def(s, x).sy || "").includes(k));
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
      run: (c) => { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะเสียความสามารถ")[0];
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
    cast: (c) => { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะเสียความสามารถ")[0];
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
      if (m.avatars >= 4) { const o = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้าม POWER -2", { optional: true })[0];
        const v = c.choose(c.s.P[c.seat].av.filter((x) => virus(c.E, c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือกไวรัสฝ่ายเรา POWER +2", { optional: true })[0];
        if (o) ops.push({ op: "power", i: o.i, n: -2, temp: true }); if (v) ops.push({ op: "power", i: v.i, n: 2, temp: true }); say += ` · ได้ Avatar ${m.avatars} ใบ`; }
      else say += ` (ได้ Avatar ${m.avatars} ใบ ไม่ถึง 4)`;
      return { explain: say, ops }; } },
  "BT11-022": { virusExile: true, activate: fromDark,
    attack: (c) => { if (c.self && c.self.used === "a" + c.s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] }; if (c.self) c.self.used = "a" + c.s.turn;
      const m = virusMill(c, 3); const ops = [...m.ops]; let say = "ทุกคนธรณีสูบ 3 ใบ";
      if (m.avatars >= 4) { const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามให้เสียความสามารถและ POWER ตั้งต้น 0", { optional: true })[0];
        if (t) { ops.push({ op: "mute", i: t.i, until: "turn", zero: true }); say += ` · ${c.E.name(c.s, t)} เสียความสามารถ POWER ตั้งต้น 0`; } }
      else say += ` (ได้ Avatar ${m.avatars} ใบ ไม่ถึง 4)`;
      return { explain: say, ops }; } },
  // พรของอิศวร (Only #1)
  "CC01-042": {
    cast: (c) => { const P = c.s.P[c.seat], O = c.s.P[1 - c.seat];
      const best = O.av.length >= 2 ? 1 : P.hand.length <= 2 ? 0 : P.hell.length ? 2 : 0;
      const m = c.mode(["1) จั่วให้การ์ดบนมือครบ 5 ใบ", "2) ทำลาย Avatar อีกฝ่ายไม่เกิน 2 ใบ", "3) นำการ์ดจากนรกเราขึ้นมือ 2 ใบ"], "พรของอิศวร: เลือกปฏิบัติ", best);
      if (m === 0) { const n = Math.max(0, 5 - P.hand.length); return { explain: `จั่ว ${n} ใบ`, ops: n ? [{ op: "draw", seat: c.seat, n }] : [] }; }
      if (m === 1) { const t = c.choose(O.av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 2, "เลือก Avatar อีกฝ่ายที่จะทำลาย (ไม่เกิน 2 ใบ)", { optional: true });
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
      const t = c.choose([...O.av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), ...O.cs], 1, "เลือกการ์ดบนสนามฝ่ายตรงข้ามที่จะทำลาย")[0];
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
      const t = c.choose(c.s.P[1 - c.seat].av.filter((y) => !y.tok && !c.E.noAim(c.s, y)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามมาเป็นโอตะของเนียจัง")[0];
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
      const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย")[0];
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
      can: (E, s, x, L) => (L.z === "av" && s.P[L.p].hell.some((y) => valkyrie(E, s, y)) && s.P[1 - L.p].av.length > 0 && s.P[L.p].deck.length > 6)
        || (L.z === "hell" && s.P[L.p].av.some((y) => nm(E, s, y, "บรุนฮิลด์")) && E.avatars(s.P[L.p]) < 4 && s.P[L.p].deck.length > (s.P[L.p].bot ? 14 : 9)),
      run: (c) => { const L = c.E.locate(c.s, c.self.i);
        if (L.z === "hell") return { explain: "ธรณีสูบ 9 ใบ · อัญเชิญซีเกิร์ดจากนรก", ops: [{ op: "mill", seat: c.seat, n: 9 }, { op: "put", i: c.self.i }] };
        const back = c.choose(c.s.P[c.seat].hell.filter((x) => valk(c.E, c.s, x)), 3, "เลือกเทพธิดาในนรก 1-3 ใบกลับเข้า Deck");
        return { explain: `นำเทพธิดา ${back.length} ใบกลับเข้า Deck · ธรณีสูบ 3 ใบ แล้วทำลายศัตรูตาม Cost`, ops: [...back.map((x) => ({ op: "move", i: x.i, to: "deckBottom" })), { op: "shuffle", seat: c.seat }, { op: "millKill", seat: c.seat, n: 3, base: 2, name: "เทพธิดาแห่งวัลฮัลลา" }] }; } } },
  // ธอร์: after winning a fight, destroy an enemy Avatar with POWER equal to the difference
  "BT02-018": { win: (c) => { const X = c.t.diff; const t = c.choose(c.s.P[1 - c.seat].av.filter((x) => c.E.power(c.s, x) === X && !c.E.noAim(c.s, x)), 1, `เลือก Avatar ฝ่ายตรงข้าม POWER ${X} ที่จะทำลาย`)[0];
    return t ? { explain: `ทำลาย ${c.E.name(c.s, t)} (POWER ${X})`, ops: [{ op: "destroy", i: t.i, why: "ธอร์" }] } : { explain: `ไม่มี Avatar POWER ${X}`, ops: [] }; } },
  // แอสการ์ดคือสถานที่ไม่ใช่ผู้คน (Land): discard 1 → borrow a sleeping enemy Avatar (Cost ≤3) until end of turn
  "BT02-060": { activate: { label: "ทิ้ง 1 ใบ: ยึด Avatar ที่นอนอยู่ (Cost ≤3) จนจบเทิร์น",
    can: (E, s, x, L) => L.z === "land" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].av.some((y) => !y.a && !y.tok && (E.def(s, y).c || 0) <= 3),
    run: (c) => { const d = c.choose([...c.s.P[c.seat].hand].sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      const t = c.choose(c.s.P[1 - c.seat].av.filter((y) => !y.a && !y.tok && (c.E.def(c.s, y).c || 0) <= 3).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่นอนอยู่ (Cost ≤3)")[0];
      return { explain: `ทิ้ง ${c.E.name(c.s, d)}${t ? ` · ยึด ${c.E.name(c.s, t)} จนจบเทิร์น` : ""}`, ops: [{ op: "discard", seat: c.seat, iids: [d.i] }, ...(t ? [{ op: "control", i: t.i, seat: c.seat, until: "turn", asleep: true }] : [])] }; } } },
});

// ===================== timed abilities (End Phase / start of Main Phase) =====================
const mineEnd = (s, L) => s.active === L.p;
Object.assign(SCRIPTS, {
  // โลกิ: every End Phase it moves to the other side
  "BT03-023": { endPhase: (E, s, x, L) => (L.z === "av" && E.avatars(s.P[1 - L.p]) < 4 ? [{ op: "control", i: x.i, seat: 1 - L.p }] : []) },
  // ศาสตราจารย์วานร: 3+ วานร on our field → draw 2
  "BT08-041": { endPhase: (E, s, x, L) => (L.z === "av" && s.P[L.p].av.filter((y) => nm(E, s, y, "วานร")).length >= 3 ? [{ op: "draw", seat: L.p, n: 2 }] : []) },
  // ม้าเฉียว: back to hand at our End Phase unless another green ขุนพล {ต่างชาติ} is with it
  "BT10-049": { endPhase: (E, s, x, L) => (L.z === "av" && mineEnd(s, L) && !s.P[L.p].av.some((y) => y.i !== x.i && nm(E, s, y, "ขุนพล") && E.def(s, y).co === "เขียว" && sy(E, s, y, "ต่างชาติ")) ? [{ op: "move", i: x.i, to: "hand" }] : []) },
  // ฟูมะ: exiled at our End Phase, comes back at the start of our next Main Phase
  "BT11-010": { endPhase: (E, s, x, L) => (L.z === "av" && mineEnd(s, L) ? [{ op: "exile", i: x.i }, { op: "later", seat: L.p, ops: [{ op: "put", i: x.i }], why: "ฟูมะกลับจากมิติมืด" }] : []) },
  // อินาริ: draw 1, +1 per 15 cards in our hell
  "CC02-016": { endPhase: (E, s, x, L) => (L.z === "av" && mineEnd(s, L) ? [{ op: "draw", seat: L.p, n: 1 + Math.floor(s.P[L.p].hell.length / 15) }] : []) },
  // พาลี: destroy every enemy Avatar with the lowest Cost
  "SD09-004": { mainStart: (c) => { const O = c.s.P[1 - c.seat].av.filter((x) => !x.tok); if (!O.length) return { explain: "ฝ่ายตรงข้ามไม่มี Avatar", ops: [] };
    const lo = Math.min(...O.map((x) => c.E.def(c.s, x).c || 0)); const t = O.filter((x) => (c.E.def(c.s, x).c || 0) === lo);
    return { explain: `ทำลาย Avatar Cost ${lo}: ${t.map((x) => c.E.name(c.s, x)).join(", ")}`, ops: t.map((x) => ({ op: "destroy", i: x.i, why: "พาลี" })) }; } },
  // นินจินแมน: draw one per Modification it wears
  "BT02-020": { mainStart: (c) => { const n = c.self ? [0, 1].flatMap((q) => c.s.P[q].mg).filter((m) => m.on === c.self.i).length : 0; return { explain: `จั่ว ${n} ใบ`, ops: n ? [{ op: "draw", seat: c.seat, n }] : [] }; } },
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
    cast: (c) => { const on = onTarget(c); const pool = c.s.P[1 - c.seat].av.filter((x) => !c.E.noAim(c.s, x)).sort((a, b) => (b.i === on.att ? 1 : 0) - (a.i === on.att ? 1 : 0));
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

// ---------- Starter Decks: cards the text reader cannot express ----------
const TRIO = ["กุ่ย", "ฮอล", "นาย"];
const trioPool = (E, s, p, n) => [...s.P[p].hand, ...s.P[p].av].filter((x) => isAv(E, s, x) && !x.tok && E.name(s, x).includes(n));
const cheapFirst = (E, s) => (a, b) => (E.def(s, a).c || 0) + (E.def(s, a).pw || 0) - (E.def(s, b).c || 0) - (E.def(s, b).pw || 0);
Object.assign(SCRIPTS, {
  // ระเบิด Very Fat Man: send one each of กุ่ย, ฮอล and นาย (hand and/or field) to hell : destroy every enemy Avatar
  "SD02-016": { react: { kinds: ["attack", "summon", "cast"], can: (E, s, p) => TRIO.every((n) => trioPool(E, s, p, n).length) && s.P[1 - p].av.length > 0 },
    cast: (c) => { const { E, s, seat: p } = c; const picks = [];
      for (const n of TRIO) { const x = c.choose(trioPool(E, s, p, n).filter((y) => !picks.includes(y)).sort(cheapFirst(E, s)), 1, `ค่าใช้จ่าย: เลือก "${n}" จากมือหรือสนามที่จะส่งลงนรก`, { exact: true })[0]; if (!x) return { explain: `ไม่มี "${n}" ให้ส่งลงนรก ใช้การ์ดนี้ไม่ได้`, ops: [] }; picks.push(x); }
      const foes = s.P[1 - p].av;
      return { explain: `ส่ง ${picks.map((x) => E.name(s, x)).join(", ")} ลงนรก · ทำลาย Avatar ฝ่ายตรงข้ามทุกใบ`, ops: [...picks.map((x) => ({ op: "move", i: x.i, to: "hell" })), ...foes.map((x) => ({ op: "destroy", i: x.i, why: "ระเบิด Very Fat Man" }))] }; } },
  // สละเพื่อนเพื่อช่วยเพื่อน: send one กุ่ย / ฮอล / นาย (hand or field) to hell : return one Avatar on the field to its owner's hand
  "SD02-019": { react: { kinds: ["attack", "summon", "cast"], can: (E, s, p) => TRIO.some((n) => trioPool(E, s, p, n).length) && (s.P[0].av.length + s.P[1].av.length) > 0 },
    cast: (c) => { const { E, s, seat: p } = c; const pool = [...new Set(TRIO.flatMap((n) => trioPool(E, s, p, n)))].sort(cheapFirst(E, s));
      const cost = c.choose(pool, 1, "ค่าใช้จ่าย: เลือก กุ่ย / ฮอล / นาย จากมือหรือสนามที่จะส่งลงนรก", { exact: true })[0]; if (!cost) return { explain: "ไม่มี กุ่ย / ฮอล / นาย ให้ส่งลงนรก", ops: [] };
      const tg = [...s.P[1 - p].av.filter((x) => !x.tok).sort((a, b) => E.power(s, b) - E.power(s, a)), ...s.P[p].av.filter((x) => !x.tok && x.i !== cost.i)];
      const t = c.choose(tg, 1, "เลือก Avatar บนสนามที่จะกลับขึ้นมือ")[0];
      return { explain: `ส่ง ${E.name(s, cost)} ลงนรก${t ? ` · ${E.name(s, t)} กลับขึ้นมือ` : " · ไม่มี Avatar ให้เลือก"}`, ops: [{ op: "move", i: cost.i, to: "hell" }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : [])] }; } },
  // นายนิรยบาล อ้วน: when an ability of our cards (other than อ้วน) mills our Deck, 2 more cards are milled
  "SD03-004": { millMore: (E, s, y, L, { seat, by, src }) => (L.z === "av" && by === L.p && seat === L.p && src && !String(src.n || "").includes("นายนิรยบาล อ้วน") ? 2 : 0) },
  // บัญชีหนังหมา: take a นายนิรยบาล (Cost 4 or less) from the Deck; that name can no longer be paid as Cost this game
  "SD03-017": { cast: (c) => { const { E, s, seat: p } = c; const seen = new Set();
    const cands = s.P[p].deck.filter((x) => isAv(E, s, x) && E.name(s, x).includes("นายนิรยบาล") && (E.def(s, x).c || 0) <= 4).filter((x) => { const n = E.name(s, x); if (seen.has(n)) return false; seen.add(n); return true; }).sort((a, b) => (E.def(s, b).c || 0) - (E.def(s, a).c || 0));
    const t = c.choose(cands, 1, "เลือก นายนิรยบาล Cost 4 หรือต่ำกว่า จาก Deck ขึ้นมือ")[0];
    return t ? { explain: `นำ ${E.name(s, t)} ขึ้นมือ · ชื่อนี้ใช้เป็น Cost ไม่ได้จนจบเกม`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }, { op: "banPay", seat: p, name: E.name(s, t) }] } : { explain: "ไม่มี นายนิรยบาล Cost 4 หรือต่ำกว่าใน Deck", ops: [{ op: "shuffle", seat: p }] }; } },
  // หอกแหลมแทงทุกวัน: when milled, if no Modification was used this turn, it may be used from hell
  "SD03-018": { millBy: "any", milled: (c) => { const { E, s, seat: p } = c; if (s.mu[p].D) return { explain: "เทิร์นนี้ใช้ Modification Magic ไปแล้ว ใช้จากนรกไม่ได้", ops: [] };
    const host = c.choose([...s.P[p].av].sort((a, b) => (sy(E, s, b, "นรก") ? 1 : 0) - (sy(E, s, a, "นรก") ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "หอกแหลมแทงทุกวัน ถูกธรณีสูบ: เลือก Avatar ที่จะสวมใส่ (หรือไม่ใช้)", { optional: true })[0];
    return host ? { explain: `ใช้จากนรก สวมใส่ให้ ${E.name(s, host)}`, ops: [{ op: "attach", i: c.self.i, on: host.i }, { op: "mu", seat: p, k: "D" }] } : { explain: "ไม่ใช้จากนรก", ops: [] }; } },
  // จิ้มมันเลย จิ้ม!: when an Avatar is summoned, discard a {นรก} Avatar with Cost ≥ it : mill 2 and destroy that Avatar
  "SD03-020": { react: { kinds: ["summon"], can: (E, s, p, on) => { const L = E.locate(s, on.i); return !!L && L.z === "av" && s.P[p].hand.some((x) => isAv(E, s, x) && sy(E, s, x, "นรก") && (E.def(s, x).c || 0) >= (E.def(s, L.x).c || 0)); } },
    cast: (c) => { const { E, s, seat: p } = c; const L = E.locate(s, onTarget(c).i); if (!L || L.z !== "av") return { explain: "เป้าหมายหายไปแล้ว", ops: [] };
      const pool = s.P[p].hand.filter((x) => isAv(E, s, x) && sy(E, s, x, "นรก") && (E.def(s, x).c || 0) >= (E.def(s, L.x).c || 0)).sort(cheapFirst(E, s));
      const d = c.choose(pool, 1, `ค่าใช้จ่าย: ทิ้ง Avatar นรก ที่ Cost ${E.def(s, L.x).c || 0} ขึ้นไป`, { exact: true })[0]; if (!d) return { explain: "ไม่มี Avatar นรก ที่ Cost พอให้ทิ้ง", ops: [] };
      return { explain: `ทิ้ง ${E.name(s, d)} · ธรณีสูบ 2 ใบ · ทำลาย ${E.name(s, L.x)}`, ops: [{ op: "discard", seat: p, iids: [d.i] }, { op: "mill", seat: p, n: 2 }, { op: "destroy", i: L.x.i, why: "จิ้มมันเลย จิ้ม!" }] }; } },
});

// ---------- Starter Deck 04: Tank Rangers (Avatars worn by a รถถัง) ----------
const tanks = (E, s, p) => s.P[p].av.filter((x) => E.named(s, x, "รถถัง"));
const wornBy = (s, host) => [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === host.i);
const canWear = (E, s, host, x) => host.i !== x.i && !wornBy(s, host).some((m) => E.name(s, m) === E.name(s, x)); // a รถถัง cannot wear two Avatars of the same name
const rideTank = { label: "ไปสวมใส่ให้ Avatar รถถัง", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && tanks(E, s, L.p).some((h) => canWear(E, s, h, x)),
  run: (c) => { const { E, s } = c; const h = c.choose(tanks(E, s, c.seat).filter((t) => canWear(E, s, t, c.self)).sort((a, b) => wornBy(s, a).length - wornBy(s, b).length), 1, `เลือก รถถัง ที่ ${E.name(s, c.self)} จะไปสวมใส่`)[0];
    return h ? { explain: `${E.name(s, c.self)} ไปสวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่มี รถถัง ให้สวมใส่", ops: [] }; } };
Object.assign(SCRIPTS, {
  // กัปตันแบงค์: scout 5, a จ่ามะนาว / จ่าแดงเดือด among them goes onto one of our รถถัง
  "SD04-001": { activate: rideTank, summon: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 5); const ids = top.map((x) => x.i); const hosts = tanks(E, s, p);
    const cands = top.filter((x) => /จ่ามะนาว|จ่าแดงเดือด/.test(E.name(s, x)) && hosts.some((h) => canWear(E, s, h, x)));
    const got = cands.length ? c.choose(cands, 1, "สอดแนม 5 ใบ: เลือก จ่ามะนาว หรือ จ่าแดงเดือด มาสวมให้ รถถัง", { optional: true, reveal: ids })[0] : null;
    const h = got ? c.choose(hosts.filter((t) => canWear(E, s, t, got)).sort((a, b) => wornBy(s, a).length - wornBy(s, b).length), 1, `เลือก รถถัง ที่จะสวมใส่ ${E.name(s, got)}`)[0] : null;
    return { explain: got && h ? `สอดแนม 5 ใบ · ${E.name(s, got)} มาสวมให้ ${E.name(s, h)}` : hosts.length ? "สอดแนม 5 ใบ ไม่พบ จ่ามะนาว / จ่าแดงเดือด" : "สอดแนม 5 ใบ แต่ไม่มี รถถัง บนสนามเรา", ops: [{ op: "scoutShow", seat: p, ids }, ...(got && h ? [{ op: "attach", i: got.i, on: h.i }] : []), { op: "scoutRest", seat: p, ids, rest: "bottom" }] }; } },
  // จ่ามะนาว: with a รถถัง on our field, one of our face-up LIFE cards is turned face-down; destroyed instead of the รถถัง wearing it
  "SD04-002": { activate: rideTank, shield: true, summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p];
    return tanks(E, s, p).length && P.life.some((x) => x.up) && !E.critical(P) ? { explain: "มี รถถัง บนสนามเรา: คว่ำ LIFE เรา 1 ใบ", ops: [{ op: "lifeFlip", seat: p, up: false }] } : { explain: tanks(E, s, p).length ? "ไม่มี LIFE ที่หงายให้คว่ำ" : "ไม่มี รถถัง บนสนามเรา ความสามารถไม่ทำงาน", ops: [] }; } },
  // จ่าแดงเดือด: the รถถัง wearing it gets POWER +1; when that รถถัง wins a fight, this card may be destroyed to wake it
  "SD04-003": { activate: rideTank, worn: (E, s, m, host) => (E.named(s, host, "รถถัง") ? 1 : 0),
    hostWin: (c) => { const { E, s } = c; const H = E.locate(s, c.self.on); if (!H || H.z !== "av") return { explain: "Avatar ที่สวมใส่ไม่อยู่แล้ว", ops: [] };
      const use = c.mode([`ทำลาย ${E.name(s, c.self)} เพื่อให้ ${E.name(s, H.x)} กลับมาตื่น`, "ไม่ใช้"], "จ่าแดงเดือด", wornBy(s, H.x).length > 1 ? 0 : 1) === 0;
      return use ? { explain: `ทำลาย ${E.name(s, c.self)} · ${E.name(s, H.x)} กลับมาในสภาพตื่น`, ops: [{ op: "destroy", i: c.self.i, why: "ค่าความสามารถ" }, { op: "wake", i: H.x.i, v: true }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // รถถังลงถนน: we summon a รถถัง (Cost 5 or less) from our Deck, the opponent summons an Avatar (Cost 5 or less) from theirs
  "SD04-014": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p], O = s.P[1 - p]; const room = (Q) => E.avatars(Q) < 4 && Q.av.length < 6; const uniq = (list) => { const seen = new Set(); return list.filter((x) => { const n = E.name(s, x); if (seen.has(n)) return false; seen.add(n); return true; }); };
    const mine = room(P) ? uniq(P.deck.filter((x) => E.def(s, x).t === "A" && E.named(s, x, "รถถัง") && (E.def(s, x).c || 0) <= 5)).sort((a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0)) : [];
    const t = c.choose(mine, 1, "เลือก รถถัง Cost 5 หรือต่ำกว่า จาก Deck เรา")[0];
    const theirs = room(O) ? O.deck.filter((x) => E.def(s, x).t === "A" && (E.def(s, x).c || 0) <= 5).sort((a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0))[0] : null;
    return { explain: `${t ? `อัญเชิญ ${E.name(s, t)} จาก Deck เรา` : "เราไม่มี รถถัง ให้อัญเชิญ"} · ${theirs ? `อีกฝ่ายอัญเชิญ ${E.name(s, theirs)} จาก Deck (ระบบเลือกใบที่ POWER สูงสุดให้)` : "อีกฝ่ายไม่มี Avatar ให้อัญเชิญ"}`,
      ops: [...(t ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }, ...(theirs ? [{ op: "put", i: theirs.i }] : []), { op: "shuffle", seat: 1 - p }] }; } },
  // ขึ้นมาเร็ว ไอ้ลูกลิง !!: our รถถัง is attacked → scout 5, a Tank Ranger {คน} goes onto a รถถัง; if it does, the attacker is destroyed
  "SD04-018": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return !!T && T.p === p && E.named(s, T.x, "รถถัง"); } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const top = s.P[p].deck.slice(0, 5); const ids = top.map((x) => x.i); const hosts = tanks(E, s, p).sort((a, b) => (b.i === on.ti ? 1 : 0) - (a.i === on.ti ? 1 : 0));
      const cands = top.filter((x) => E.def(s, x).t === "A" && sy(E, s, x, "คน") && E.name(s, x).includes("Tank Ranger") && hosts.some((h) => canWear(E, s, h, x)));
      const got = cands.length ? c.choose(cands, 1, "สอดแนม 5 ใบ: เลือก Tank Ranger มาสวมให้ รถถัง", { optional: true, reveal: ids })[0] : null;
      const h = got ? c.choose(hosts.filter((t) => canWear(E, s, t, got)), 1, `เลือก รถถัง ที่จะสวมใส่ ${E.name(s, got)}`)[0] : null; const A = E.locate(s, on.att);
      return { explain: got && h ? `${E.name(s, got)} มาสวมให้ ${E.name(s, h)}${A ? ` · ทำลาย ${E.name(s, A.x)} ที่สั่งโจมตี` : ""}` : "สอดแนม 5 ใบ ไม่มี Tank Ranger ให้สวมใส่ การโจมตีดำเนินต่อ",
        ops: [{ op: "scoutShow", seat: p, ids }, ...(got && h ? [{ op: "attach", i: got.i, on: h.i }] : []), { op: "scoutRest", seat: p, ids, rest: "bottom" }, ...(got && h && A ? [{ op: "destroy", i: A.x.i, why: "ขึ้นมาเร็ว ไอ้ลูกลิง !!" }] : [])] }; } },
  // ถาดหลุม: every Main Phase of ours a coin is tossed: heads POWER +2, tails POWER -2 for the Avatar wearing it (until the end of the turn)
  "SD04-019": { worn: () => 0, mainStart: (c) => { const { E, s } = c; const H = c.self.on != null ? E.locate(s, c.self.on) : null; if (!H || H.z !== "av") return { explain: "ไม่ได้สวมใส่อยู่", ops: [] };
    return { explain: `ทอยเหรียญ: หัว ${E.name(s, H.x)} POWER +2 · ก้อย POWER -2 (จนจบเทิร์น)`, ops: [{ op: "roll", sides: 2, why: "ถาดหลุม", odd: [{ op: "power", i: H.x.i, n: 2, temp: true }], even: [{ op: "power", i: H.x.i, n: -2, temp: true }] }] }; } },
  // เขาชนไก่ (Land): once per turn, one of our awake {คน} Avatars goes to sleep, then scout 1 and leave it on top or put it at the bottom
  "SD04-020": { cast: () => ({ explain: "Land Magic: สั่งใช้ได้เทิร์นละครั้งใน Main Phase", ops: [] }),
    activate: { label: "นอน Avatar คน 1 ใบ แล้วสอดแนม 1 ใบ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].av.some((y) => y.a && sy(E, s, y, "คน")) && s.P[L.p].deck.length > 0,
      run: (c) => { const { E, s, seat: p } = c; const a = c.choose(s.P[p].av.filter((y) => y.a && sy(E, s, y, "คน")).sort((x, y) => E.power(s, x) - E.power(s, y)), 1, "เลือก Avatar คน ที่จะเปลี่ยนเป็นสภาพนอน", { optional: true })[0]; if (!a) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
        const top = s.P[p].deck[0]; const keep = c.mode([`วาง ${E.name(s, top)} ไว้บนสุดของ Deck`, "นำไปไว้ล่างสุดของ Deck"], `สอดแนมเจอ ${E.name(s, top)}`, E.def(s, top).t === "A" ? 0 : 1) === 0;
        return { explain: `${E.name(s, a)} นอน · สอดแนมเจอ ${E.name(s, top)} ${keep ? "วางไว้บนสุด" : "นำไปไว้ล่างสุด"}`, ops: [{ op: "wake", i: a.i, v: false }, { op: "scoutShow", seat: p, ids: [top.i] }, { op: "scoutRest", seat: p, ids: [top.i], rest: keep ? "top" : "bottom" }] }; } } },
});

// ---------- Starter Deck 05: บึงทมิฬ People (sleeping Avatars) ----------
const PEOPLE = "บึงทมิฬ People";
const people = (E, s, x) => isAv(E, s, x) && E.named(s, x, PEOPLE);
const swamp = (E, s) => !!s.land && E.named(s, s.land, "บึงทมิฬ");
const sleepers = (s) => [...s.P[0].av, ...s.P[1].av].filter((x) => !x.a).length;
const byPw = (E, s) => (a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0);
const ceo = (c) => { const n = sleepers(c.s); return n ? { explain: `Avatar ที่นอนอยู่ทั้งสนาม ${n} ใบ: ${c.E.name(c.s, c.self)} POWER +${n} จนจบเทิร์น`, ops: [{ op: "power", i: c.self.i, n, temp: true }] } : { explain: "ไม่มี Avatar ที่นอนอยู่บนสนาม", ops: [] }; };
Object.assign(SCRIPTS, {
  // CEO คุณจิระ: when it attacks or is attacked, POWER +1 for every sleeping Avatar on the field (both sides) until the end of the turn
  "SD05-001": { attack: ceo, attacked: ceo },
  // คุณเค้นท์: once per turn, after a fight it attacked in and survived, with another บึงทมิฬ People on our field: roll a die, odd = it wakes up
  "SD05-002": { afterFight: (c) => { const { E, s, self: x } = c; if (x.used === s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] };
    if (!s.P[c.seat].av.some((y) => y.i !== x.i && people(E, s, y))) return { explain: `ไม่มี ${PEOPLE} ใบอื่นบนสนามเรา`, ops: [] };
    if (c.mode(["ทอยลูกเต๋า (ออกเลขคี่ = กลับมาตื่น)", "ไม่ใช้"], E.name(s, x), 0) !== 0) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
    return { explain: "ทอยลูกเต๋า ถ้าออกเลขคี่ กลับมาในสภาพตื่น", ops: [{ op: "used", i: x.i }, { op: "roll", sides: 6, why: E.name(s, x), odd: [{ op: "wake", i: x.i, v: true }] }] }; } },
  // คุณฮาร์วี่: show as many cards from the bottom of the Deck as there are sleeping Avatars, a {ปลา} Avatar among them goes to the hand, shuffle
  "SD05-003": { summon: (c) => { const { E, s, seat: p } = c; const D = s.P[p].deck; const n = Math.min(sleepers(s), D.length); if (!n) return { explain: "ไม่มี Avatar ที่นอนอยู่บนสนาม ไม่ได้แสดงการ์ด", ops: [] };
    const ids = D.slice(D.length - n).map((x) => x.i); const cands = D.slice(D.length - n).filter((x) => isAv(E, s, x) && sy(E, s, x, "ปลา")).sort(byPw(E, s));
    const t = cands.length ? c.choose(cands, 1, `แสดงการ์ดล่างสุดของ Deck ${n} ใบ: เลือก Avatar ปลา ขึ้นมือ`, { reveal: ids })[0] : null;
    return { explain: `แสดงการ์ดล่างสุดของ Deck ${n} ใบ${t ? ` · นำ ${E.name(s, t)} ขึ้นมือ` : " ไม่มี Avatar ปลา"} · สับ Deck`, ops: [{ op: "scoutShow", seat: p, ids, label: "แสดงการ์ดล่างสุดของ Deck" }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), { op: "shuffle", seat: p }] }; } },
  // คุณอังคณา: when it uses โล่มนุษย์, POWER +2 until the end of that fight
  "SD05-004": { onShield: (E, s, x) => [{ op: "power", i: x.i, n: 2, temp: "fight" }] },
  // คุณพยาบาล: once per turn, put it to sleep: another บึงทมิฬ People of ours is not destroyed once, until the end of the opponent's next turn
  "SD05-005": { activate: { label: `นอน แล้วปกป้อง ${PEOPLE} ใบอื่นจากการถูกทำลาย 1 ครั้ง`, can: (E, s, x, L) => L.z === "av" && x.a && s.P[L.p].av.some((y) => y.i !== x.i && people(E, s, y)),
    run: (c) => { const { E, s, self: x } = c; const t = c.choose(s.P[c.seat].av.filter((y) => y.i !== x.i && people(E, s, y)).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, `เลือก ${PEOPLE} ที่จะไม่ถูกทำลาย 1 ครั้ง`)[0];
      return t ? { explain: `${E.name(s, x)} นอน · ${E.name(s, t)} จะไม่ถูกทำลาย 1 ครั้ง จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, ops: [{ op: "wake", i: x.i, v: false }, { op: "guard", i: t.i, until: s.turn + (s.active === c.seat ? 1 : 2) }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } } },
  // วอเตอร์แมน: summon 2 บึงทมิฬ People from the Deck, asleep (awake if the Land Magic is บึงทมิฬ), shuffle · counts as บึงทมิฬ People on the field (printed rule, read from the text)
  "SD05-006": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const room = Math.max(0, Math.min(4 - E.avatars(P), 6 - P.av.length)); const awake = swamp(E, s);
    const got = room ? c.choose(P.deck.filter((x) => people(E, s, x)).sort(byPw(E, s)), Math.min(2, room), `เลือก ${PEOPLE} จาก Deck ที่จะอัญเชิญ`) : [];
    return { explain: got.length ? `อัญเชิญ ${got.map((x) => E.name(s, x)).join(", ")} จาก Deck ${awake ? "ในสภาพตื่น (มี Land บึงทมิฬ)" : "ในสภาพนอน"}` : room ? `ไม่มี ${PEOPLE} ใน Deck` : "Avatar Zone เต็ม", ops: [...got.map((x) => ({ op: "put", i: x.i, ...(awake ? {} : { asleep: true }) })), { op: "shuffle", seat: p }] }; } },
  // บึงทมิฬ (Land): once per turn, put one of our awake Avatars to sleep : draw 1
  "SD05-014": { cast: () => ({ explain: "Land Magic: สั่งใช้ได้เทิร์นละครั้ง", ops: [] }),
    activate: { label: "นอน Avatar ฝ่ายเรา 1 ใบ แล้วจั่ว 1 ใบ", can: (E, s, x, L) => L.z === "land" && L.p === s.active && s.phase === "main" && s.P[L.p].av.some((y) => y.a),
      run: (c) => { const { E, s } = c; const t = c.choose(s.P[c.seat].av.filter((y) => y.a).sort((a, b) => E.power(s, a) - E.power(s, b)), 1, "เลือก Avatar ฝ่ายเราที่จะเปลี่ยนเป็นสภาพนอน", { optional: true })[0];
        return t ? { explain: `${E.name(s, t)} นอน · จั่ว 1 ใบ`, ops: [{ op: "wake", i: t.i, v: false }, { op: "draw", seat: c.seat, n: 1 }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } } },
  // กำเนิดจากน้ำ: a {ปลา} Avatar from our hell comes back asleep (awake if the Land Magic is บึงทมิฬ)
  "SD05-015": { canCast: (E, s, p) => s.P[p].hell.some((x) => isAv(E, s, x) && sy(E, s, x, "ปลา")) && E.avatars(s.P[p]) < 4 && s.P[p].av.length < 6,
    cast: (c) => { const { E, s, seat: p } = c; const awake = swamp(E, s); const t = c.choose([...s.P[p].hell].reverse().filter((x) => isAv(E, s, x) && sy(E, s, x, "ปลา")).sort(byPw(E, s)), 1, "เลือก Avatar ปลา ในนรกที่จะอัญเชิญ")[0];
      return t ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก${awake ? "ในสภาพตื่น (มี Land บึงทมิฬ)" : "ในสภาพนอน"}`, ops: [{ op: "put", i: t.i, ...(awake ? {} : { asleep: true }) }] } : { explain: "ไม่มี Avatar ปลา ในนรก", ops: [] }; } },
  // น้ำวนชักโครก: our บึงทมิฬ People is attacked → cancel the attack, every other Avatar on the field changes state (awake ↔ asleep)
  "SD05-016": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return !!T && T.p === p && people(E, s, T.x); } },
    cast: (c) => { const { s } = c; const on = onTarget(c); const all = [...s.P[0].av, ...s.P[1].av].filter((x) => x.i !== on.att);
      return { explain: `ยกเลิกการโจมตี · เปลี่ยนสภาพ Avatar ${all.length} ใบบนสนาม (ยกเว้นใบที่สั่งโจมตี)`, ops: [{ op: "cancelAttack" }, ...all.map((x) => ({ op: "wake", i: x.i, v: !x.a }))] }; } },
  // ปืนฉมวก: when the Avatar wearing it attacks a sleeping Avatar: it gets POWER +1 and the target POWER -1 (worn only by บึงทมิฬ People: printed rule)
  "SD05-017": { worn: (E, s, m, host) => { if (!(s.pend && s.pend.att === host.i && s.pend.tk === "av")) return 0; const T = E.locate(s, s.pend.ti); return T && !T.x.a ? 1 : 0; }, foeWorn: (E, s, m, att, foe) => (foe.a ? 0 : -1) },
  // ตรีศูล ไตรตัน: if no Land Magic was used this turn, send it (worn) to hell : a Land "บึงทมิฬ" from the Deck goes onto the Land Magic Zone (counts as using a Land Magic)
  "SD05-018": { activate: { label: "ส่งลงนรก แล้วนำ Land บึงทมิฬ จาก Deck มาวาง", can: (E, s, x, L) => L.z === "mg" && x.on != null && L.p === s.active && s.phase === "main" && !s.mu[L.p].L && s.P[L.p].deck.some((y) => E.def(s, y).t === "M" && E.def(s, y).st === "L" && E.named(s, y, "บึงทมิฬ")),
    run: (c) => { const { E, s, seat: p } = c; const seen = new Set(); const cands = s.P[p].deck.filter((y) => E.def(s, y).t === "M" && E.def(s, y).st === "L" && E.named(s, y, "บึงทมิฬ")).filter((y) => { const n = E.name(s, y); if (seen.has(n)) return false; seen.add(n); return true; });
      const t = c.choose(cands, 1, "เลือก Land Magic บึงทมิฬ จาก Deck")[0];
      return t ? { explain: `ส่ง ${E.name(s, c.self)} ลงนรก · วาง ${E.name(s, t)} บน Land Magic Zone`, ops: [{ op: "move", i: c.self.i, to: "hell" }, { op: "toLand", i: t.i }, { op: "shuffle", seat: p }, { op: "mu", seat: p, k: "L" }] } : { explain: "ไม่มี Land บึงทมิฬ ใน Deck", ops: [] }; } } },
});

// ---------- Starter Deck 06: ค่ายบางระจัน ----------
const CAMP = "ค่ายบางระจัน";
const camp = (E, s, p) => s.P[p].cs.some((y) => E.named(s, y, CAMP));
const campText = (E, s, x) => isAv(E, s, x) && String(E.def(s, x).x || "").includes(CAMP);
const worth = (E, s, x) => { const d = E.def(s, x); return (d.pw || 0) + (d.c || 0) * 0.6 + (d.o1 ? 10 : 0); };
const cheapCard = (E, s) => (a, b) => worth(E, s, a) - worth(E, s, b);
Object.assign(SCRIPTS, {
  // จัน หนวดเขี้ยว: POWER +1 while we are in critical state · when destroyed while we control the camp: back into the Deck, shuffle, draw 1
  "SD06-001": { aura: (E, s, src, L) => (L.z === "av" && E.critical(s.P[L.p]) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 1 }] : []),
    death: (c) => { const { E, s, seat: p } = c; if (!camp(E, s, p)) return { explain: `ไม่ได้ควบคุม ${CAMP} ความสามารถไม่ทำงาน`, ops: [] }; const L = E.locate(s, c.t.i); if (!L || L.z !== "hell") return { explain: "การ์ดไม่อยู่ในนรกแล้ว", ops: [] };
      return { explain: `${E.name(s, L.x)} กลับเข้า Deck แล้วสับ · จั่ว 1 ใบ`, ops: [{ op: "move", i: L.x.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "draw", seat: p, n: 1 }] }; } },
  // อิน สไนเปอร์: using เตะไข่ (attacking LIFE while the opponent still has Avatars) destroys one of our Avatars
  "SD06-002": { attack: (c) => { const { E, s, seat: p, self: x } = c; if (!(s.pend && s.pend.tk === "life" && s.P[1 - p].av.length)) return { explain: "ไม่ได้ใช้เตะไข่", ops: [] };
    const t = c.choose([...s.P[p].av].sort((a, b) => (a.i === x.i ? 1 : 0) - (b.i === x.i ? 1 : 0) || worth(E, s, a) - worth(E, s, b)), 1, "ใช้เตะไข่: เลือก Avatar ฝ่ายเราที่จะถูกทำลาย", { exact: true })[0];
    return t ? { explain: `ใช้เตะไข่: ทำลาย ${E.name(s, t)} ฝ่ายเรา`, ops: [{ op: "destroy", i: t.i, why: "ผลของเตะไข่" }] } : { explain: "ไม่มี Avatar ให้ทำลาย", ops: [] }; } },
  // ทองเหม็น ขวานคลั่ง: cannot attack LIFE unless we control the camp (its attack bonus is read from the text)
  "SD06-003": { noLife: (E, s, x) => { const L = E.locate(s, x.i); return !!L && !camp(E, s, L.p); } },
  // พันเรือง ผู้พิทักษ์ไร้พ่าย: while we control the camp, it may be destroyed instead of another Avatar of ours with "ค่ายบางระจัน" in its text
  "SD06-005": { saveOther: (E, s, y, Ly, x, L) => (Ly.z === "av" && L.z === "av" && x.i !== y.i && campText(E, s, x) && camp(E, s, Ly.p) && worth(E, s, x) > worth(E, s, y)
    ? { why: `${E.name(s, y)} ถูกทำลายแทน ${E.name(s, x)}`, ops: [{ op: "destroy", i: y.i, why: "ทำลายแทน", noSave: true }] } : null) },
  // อาจารย์ธรรมโชติ: once per turn, when our camp would be destroyed by an Avatar ability or a Magic, it goes from hand / Avatar Zone to the bottom of the Deck instead
  "SD06-007": { saveOther: (E, s, y, Ly, x, L, info) => (["hand", "av"].includes(Ly.z) && L.z === "cs" && E.named(s, x, CAMP) && !info.fight && y.used !== s.turn
    ? { why: `${E.name(s, y)} กลับเข้าใต้ Deck · ${E.name(s, x)} ไม่ถูกทำลาย`, ops: [{ op: "used", i: y.i }, { op: "move", i: y.i, to: "deckBottom" }] } : null) },
  // บุญช่วย ควายรักชาติ: once per turn, goes onto another Avatar of ours; the wearer gets POWER +1 (+2 while we control the camp)
  "SD06-008": { activate: { label: "ไปสวมใส่ให้ Avatar ใบอื่นของเรา", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i),
      run: (c) => { const { E, s, self: x } = c; const h = c.choose(s.P[c.seat].av.filter((y) => y.i !== x.i).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, `เลือก Avatar ที่ ${E.name(s, x)} จะไปสวมใส่`)[0];
        return h ? { explain: `${E.name(s, x)} ไปสวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: x.i, on: h.i }] } : { explain: "ไม่มี Avatar ให้สวมใส่", ops: [] }; } },
    worn: (E, s, m, host) => { const L = E.locate(s, host.i); return L && camp(E, s, L.p) ? 2 : 1; } },
  // วิญญาณวีรชน: discard 1 : a camp Avatar from our hell is summoned (จุติ); at the end of the opponent's next turn it is sent to hell
  "SD06-013": { canCast: (E, s, p) => s.P[p].hand.length >= 2 && s.P[p].hell.some((x) => campText(E, s, x)) && E.avatars(s.P[p]) < 4 && s.P[p].av.length < 6,
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p];
      const pay = c.choose([...P.hand].filter((x) => x.i !== c.t.i).sort(cheapCard(E, s)), 1, "ค่าใช้จ่าย: ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; if (!pay) return { explain: "ไม่มีการ์ดบนมือให้ทิ้ง", ops: [] };
      const t = c.choose([...P.hell].reverse().filter((x) => campText(E, s, x)).sort(byPw(E, s)), 1, `เลือก Avatar ที่มี "${CAMP}" ในนรกที่จะอัญเชิญ`)[0]; if (!t) return { explain: `ไม่มี Avatar ที่มี "${CAMP}" ในนรก`, ops: [] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)} แบบจุติ · จบเทิร์นถัดไปของฝ่ายตรงข้ามจะถูกส่งลงนรก`,
        ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i, jt: true }, { op: "atEnd", turn: s.turn + (s.active === p ? 1 : 2), ops: [{ op: "move", i: t.i, to: "hell", onlyFrom: "av" }], why: `${E.name(s, t)} (วิญญาณวีรชน) ถูกส่งลงนรก` }] }; } },
  // ไปเลยมอนตี้ (React): the attacker gets POWER -2 for every card on our field and in our hand
  "SD06-014": { react: { kinds: ["attack"] }, cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const A = E.locate(s, on.att); if (!A) return { explain: "ผู้โจมตีหายไปแล้ว", ops: [] };
    const P = s.P[p]; const n = P.av.length + P.cs.length + P.mg.filter((m) => m.i !== c.t.i).length + (s.land && s.land.o === p ? 1 : 0) + P.hand.length;
    return { explain: `การ์ดบนสนามและบนมือเรา ${n} ใบ: ${E.name(s, A.x)} POWER -${2 * n} จนจบเทิร์น`, ops: [{ op: "power", i: A.x.i, n: -2 * n, temp: true }] }; } },
  // ปืนใหญ่ไทยประดิษฐ์ (React): the opponent summons and we control a camp Avatar: destroy one camp Avatar of ours and one Avatar of theirs
  "SD06-015": { react: { kinds: ["summon"], can: (E, s, p) => s.P[p].av.some((x) => campText(E, s, x)) && s.P[1 - p].av.length > 0 },
    cast: (c) => { const { E, s, seat: p } = c; const mine = c.choose(s.P[p].av.filter((x) => campText(E, s, x)).sort(cheapCard(E, s)), 1, `เลือก Avatar ที่มี "${CAMP}" ฝ่ายเราที่จะทำลาย`)[0];
      const theirs = c.choose(s.P[1 - p].av.filter((x) => !E.noAim(s, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย")[0];
      return mine && theirs ? { explain: `ทำลาย ${E.name(s, mine)} และ ${E.name(s, theirs)}`, ops: [{ op: "destroy", i: mine.i, why: "ปืนใหญ่ไทยประดิษฐ์" }, { op: "destroy", i: theirs.i, why: "ปืนใหญ่ไทยประดิษฐ์" }] } : { explain: "ไม่มีเป้าหมายครบ", ops: [] }; } },
  // ดาบใบข้าว X: when the wearer destroys an opposing Avatar in a fight: draw 1 (worn only by camp Avatars: printed rule)
  "SD06-017": { hostWin: (c) => ({ explain: "Avatar ที่สวมใส่ชนะการต่อสู้: จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // ค่ายบางระจัน: our camp Avatars get POWER +1, โล่มนุษย์ and สามัคคี · when it is destroyed, every Avatar on our Avatar Zone is sent to hell
  "SD06-018": { aura: (E, s, src, L) => (L.z === "cs" ? [{ seat: L.p, test: (x) => campText(E, s, x), n: 1, kw: ["โล่มนุษย์", "สามัคคี"] }] : []),
    death: (c) => { const { E, s, seat: p } = c; const all = [...s.P[p].av]; return { explain: `${CAMP} ถูกทำลาย: ส่ง Avatar ทุกใบบน Avatar Zone เราลงนรก (${all.length} ใบ)`, ops: all.map((x) => ({ op: "move", i: x.i, to: "hell" })) }; } },
  // วัดคู่บ้านคู่เมือง: our Constructs' scout abilities look at 2 more cards
  "SD06-019": { scoutMore: (E, s, y, Ly, src) => (Ly.z === "cs" && src && src.t === "C" ? 2 : 0) },
  // กำแพงด่านสุดท้าย: once per turn, when our LIFE is flipped and we have no Avatar: discard 1 : scout 1 (more with วัดคู่บ้านคู่เมือง);
  // camp Avatars Cost 4 or less among them are summoned, the other cards go to the hand
  "SD06-020": { lifeFlip: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; if (x.used === s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] };
    if (P.av.length) return { explain: "มี Avatar บน Avatar Zone เรา ความสามารถไม่ทำงาน", ops: [] }; if (!P.hand.length || !P.deck.length) return { explain: "ไม่มีการ์ดให้ทิ้งหรือ Deck หมด", ops: [] };
    const pay = c.choose([...P.hand].sort(cheapCard(E, s)), 1, "กำแพงด่านสุดท้าย: ทิ้งการ์ดบนมือ 1 ใบเพื่อสอดแนม (หรือไม่ใช้)", { optional: true })[0]; if (!pay) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
    const top = P.deck.slice(0, Math.min(P.deck.length, 1 + E.scoutBonus(s, p, E.def(s, x)))); const ops = [{ op: "used", i: x.i }, { op: "discard", seat: p, iids: [pay.i] }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; let room = 4 - E.avatars(P); const say = [];
    for (const y of top) { const d = E.def(s, y); if (d.t === "A" && campText(E, s, y) && (d.c || 0) <= 4 && room > 0) { ops.push({ op: "put", i: y.i }); room--; say.push(`อัญเชิญ ${E.name(s, y)}`); } else { ops.push({ op: "move", i: y.i, to: "hand" }); say.push(`${E.name(s, y)} ขึ้นมือ`); } }
    return { explain: `ทิ้ง ${E.name(s, pay)} · สอดแนม ${top.length} ใบ: ${say.join(", ")}`, ops }; } },
});

// ---------- cards from Ciel's decks ----------
Object.assign(SCRIPTS, {
  // น้ำซุปชาบู: POWER +3 (read from the text) · after the wearer attacks it does not wake up until the end of our next End Phase
  "CC01-048": { hostAttack: (c) => { const { E, s } = c; const H = c.self.on != null ? E.locate(s, c.self.on) : null;
    return H ? { explain: `${E.name(s, H.x)} จะไม่เปลี่ยนเป็นสภาพตื่นจนจบ End Phase ถัดไปของเรา`, ops: [{ op: "noWake", i: H.x.i, until: s.turn + 2 }] } : { explain: "ไม่ได้สวมใส่อยู่", ops: [] }; } },
});

// ---------- Starter Deck 07: สามก๊ก (ขุนพล ชาวต่างชาติ) ----------
const warlord = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ขุนพล") && sy(E, s, x, "ต่างชาติ");
const warlordDef = (d) => !!d && d.t === "A" && String(d.n || "").includes("ขุนพล") && String(d.sy || "").includes("ต่างชาติ");
const myWarlords = (E, s, p) => s.P[p].av.filter((x) => warlord(E, s, x));
const shareColor = (E, s, ...xs) => ["แดง", "ฟ้า", "เขียว", "ม่วง"].filter((co) => xs.every((x) => E.colors(s, x).includes(co)));
// Avatars on p's Avatar Zone that cover every colour of the game (one Avatar per colour)
const allColors = (E, s, p) => { const av = s.P[p].av.map((x) => E.colors(s, x)); const need = ["แดง", "ฟ้า", "เขียว", "ม่วง"]; const used = new Set();
  const go = (k) => { if (k === need.length) return true; for (let j = 0; j < av.length; j++) if (!used.has(j) && av[j].includes(need[k])) { used.add(j); if (go(k + 1)) return true; used.delete(j); } return false; }; return go(0); };
// opposing Avatars wearing a Modification of their own player (ยืมมือสังหาร)
const borrowable = (E, s, p) => s.P[1 - p].av.filter((x) => !E.noAim(s, x) && !E.noControl(s, x) && s.P[1 - p].mg.some((m) => m.on === x.i && E.def(s, m).st === "D"));
Object.assign(SCRIPTS, {
  // กวนอู: ลูกฮึด and "cannot change control" are read from the text · the opponent's abilities cannot choose our other ขุนพล ชาวต่างชาติ
  "SD07-001": { noAim: (E, s, src, Ls, x, L) => Ls.z === "av" && L.z === "av" && warlord(E, s, x) && !E.named(s, x, "กวนอู ขุนพลภักดีแห่งจ๊กก๊ก") },
  // แฮหัวตุ้น: summoned by the ability of a ขุนพล ชาวต่างชาติ Avatar: destroy 1 card on the field
  "SD07-003": { byOk: (E, s, src) => warlordDef(src),
    summonedBy: (c) => { const { E, s, seat: p, self: me } = c; const O = s.P[1 - p], P = s.P[p];
      const cands = [...O.av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...O.cs.filter((y) => !E.noAim(s, y)), ...O.mg.filter((m) => m.on != null), ...(s.land && s.land.o === 1 - p ? [s.land] : []),
        ...P.mg.filter((m) => m.on != null), ...P.cs, ...P.av.filter((y) => !me || y.i !== me.i).sort(cheapCard(E, s)), ...(me ? [me] : [])];
      const t = c.choose(cands, 1, "แฮหัวตุ้น: เลือกการ์ดบนสนามที่จะทำลาย 1 ใบ", { exact: true })[0];
      return t ? { explain: `ถูกอัญเชิญด้วยความสามารถของขุนพล: ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ความสามารถของแฮหัวตุ้น" }] } : { explain: "ไม่มีการ์ดบนสนามให้ทำลาย", ops: [] }; } },
  // แฮหัวเอี๋ยน: แทงหลัง (engine) · summoned by the ability of a ขุนพล ชาวต่างชาติ Avatar: draw 1
  "SD07-004": { byOk: (E, s, src) => warlordDef(src), summonedBy: (c) => ({ explain: "ถูกอัญเชิญด้วยความสามารถของขุนพล: จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // ซุนเซ็ก: once per turn, after using แทงหลัง for a red Avatar it wakes up again
  "SD07-006": { stabOk: (E, s, y, att) => y.used !== s.turn && E.colors(s, att).includes("แดง"),
    stab: (c) => { const { E, s, self: y } = c; if (!y || y.used === s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] };
      return { explain: `${E.name(s, y)} ใช้แทงหลังให้ Avatar สีแดง: เปลี่ยนกลับเป็นสภาพตื่น`, ops: [{ op: "used", i: y.i }, { op: "wake", i: y.i }] }; } },
  // ลิโป้: in a Battle Phase every opposing Avatar has โล่มนุษย์ · when it attacks the opponent must use one ·
  // in our turn, when an attack changes target: may destroy 1 opposing Avatar
  "SD07-007": { aura: (E, s, src, L) => (L.z === "av" && s.phase === "battle" ? [{ seat: 1 - L.p, test: () => true, n: 0, kw: ["โล่มนุษย์"] }] : []),
    attack: () => ({ explain: "ลิโป้โจมตี: ฝ่ายตรงข้ามต้องใช้โล่มนุษย์", ops: [{ op: "mustShield" }] }),
    retargetOk: (E, s, y, L) => L.z === "av" && s.active === L.p,
    retarget: (c) => { const { E, s, seat: p } = c; const pd = s.pend; const A = pd ? E.locate(s, pd.att) : null; const T = pd && pd.tk === "av" ? E.locate(s, pd.ti) : null;
      const ap = A ? E.power(s, A.x) + (pd.bonus || 0) : 0; const saveUs = !!(T && E.power(s, T.x) >= ap); // the new target would win: remove it instead
      const cands = s.P[1 - p].av.filter((x) => !E.noAim(s, x)).sort((a, b) => (saveUs ? (b.i === pd.ti) - (a.i === pd.ti) : (a.i === (pd || {}).ti) - (b.i === (pd || {}).ti)) || worth(E, s, b) - worth(E, s, a));
      const t = c.choose(cands, 1, "ลิโป้: เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย (ไม่เลือกก็ได้)", { optional: true })[0];
      return t ? { explain: `เป้าหมายการโจมตีเปลี่ยน: ลิโป้ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ความสามารถของลิโป้" }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // อ้วนเสี้ยว: จุติ scout 3: a ขุนพล ชาวต่างชาติ Avatar goes to the hand, a blue one may be summoned instead; the rest are shuffled back
  "SD07-008": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const me = c.self ? E.def(s, c.self) : s.cards[c.t.c];
    const top = P.deck.slice(0, Math.min(P.deck.length, 3 + E.scoutBonus(s, p, me))); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const ops = [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; const say = [`สอดแนม ${top.length} ใบ`];
    const t = c.choose(top.filter((y) => warlord(E, s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ขุนพล ชาวต่างชาติ 1 ใบจากที่สอดแนม", { exact: true, reveal: top.map((y) => y.i) })[0];
    if (t) { const canPut = E.colors(s, t).includes("ฟ้า") && E.avatars(P) < 4 && P.av.length < 6;
      const m = canPut ? c.mode([`อัญเชิญ ${E.name(s, t)} ลง Avatar Zone`, `นำ ${E.name(s, t)} ขึ้นมือ`], `${E.name(s, t)} เป็น Avatar สีฟ้า: อัญเชิญแทนการนำขึ้นมือได้`, 0) : 1;
      if (m === 0) { ops.push({ op: "put", i: t.i }); say.push(`อัญเชิญ ${E.name(s, t)}`); } else { ops.push({ op: "search", seat: p, take: t.i, to: "hand" }); say.push(`${E.name(s, t)} ขึ้นมือ`); } }
    else say.push("ไม่มีขุนพลชาวต่างชาติ");
    ops.push({ op: "shuffle", seat: p }); return { explain: say.join(" · ") + " · ที่เหลือกลับ Deck แล้วสับ", ops }; } },
  // คำสาบานสวนท้อ: 1) one ขุนพล of ours → a non-Only ขุนพล of its colour with another name from the Deck to the hand;
  // 2) two same-colour ขุนพล of ours with different names → an Only #1 ขุนพล of that colour from the Deck to the hand
  "SD07-013": { canCast: (E, s, p) => myWarlords(E, s, p).length > 0,
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const mine = myWarlords(E, s, p);
      const pool1 = (a) => uniq(E, s, P.deck.filter((y) => warlord(E, s, y) && !E.def(s, y).o1 && shareColor(E, s, a, y).length && E.name(s, y) !== E.name(s, a)));
      const partners = (a) => mine.filter((b) => b.i !== a.i && E.name(s, b) !== E.name(s, a) && shareColor(E, s, a, b).length);
      const pool2 = (a, b) => uniq(E, s, P.deck.filter((y) => warlord(E, s, y) && E.def(s, y).o1 && shareColor(E, s, a, b, y).length));
      const ok1 = mine.some((a) => pool1(a).length), ok2 = mine.some((a) => partners(a).some((b) => pool2(a, b).length));
      const m = c.mode(["1) ขุนพล 1 ใบ: นำขุนพลสีเดียวกันคนละชื่อ (ไม่ใช่ Only #1) จาก Deck ขึ้นมือ", "2) ขุนพลสีเดียวกัน 2 ใบชื่อไม่ซ้ำ: นำขุนพล Only #1 สีเดียวกันจาก Deck ขึ้นมือ"], "คำสาบานสวนท้อ: เลือกปฏิบัติ", ok2 ? 1 : 0);
      let t = null, why = "";
      if (m === 0) { const a = c.choose([...mine].sort((x, y) => pool1(y).length - pool1(x).length), 1, "เลือก Avatar ขุนพล ชาวต่างชาติฝ่ายเรา 1 ใบ", { exact: true })[0];
        if (a) { t = c.choose(pool1(a).sort(strongFirst(E, s)), 1, `เลือกขุนพลสีเดียวกับ ${E.name(s, a)} จาก Deck ขึ้นมือ`)[0]; why = E.name(s, a); } }
      else { const a = c.choose(mine.filter((x) => partners(x).length).sort((x, y) => partners(y).filter((b) => pool2(y, b).length).length - partners(x).filter((b) => pool2(x, b).length).length), 1, "เลือก Avatar ขุนพล ชาวต่างชาติใบแรก", { exact: true })[0];
        const b = a ? c.choose(partners(a).sort((x, y) => pool2(a, y).length - pool2(a, x).length), 1, `เลือกขุนพลสีเดียวกับ ${E.name(s, a)} ที่ชื่อไม่ซ้ำ`, { exact: true })[0] : null;
        if (a && b) { t = c.choose(pool2(a, b).sort(strongFirst(E, s)), 1, "เลือกขุนพล Only #1 สีเดียวกันจาก Deck ขึ้นมือ")[0]; why = `${E.name(s, a)} และ ${E.name(s, b)}`; } }
      if (!t) return { explain: why ? `ไม่มีขุนพลที่ตรงเงื่อนไขใน Deck · สับ Deck` : "ไม่มีขุนพลที่เลือกได้", ops: why ? [{ op: "shuffle", seat: p }] : [] };
      return { explain: `เลือก ${why}: นำ ${E.name(s, t)} จาก Deck ขึ้นมือ แล้วสับ Deck`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }, { op: "shuffle", seat: p }] }; } },
  // ยืมมือสังหาร: only with a ขุนพล ชาวต่างชาติ of ours · discard 1 : an opposing Avatar wearing its own player's Modification is ours until the end of the turn, awake, and cannot attack LIFE
  "SD07-014": { canCast: (E, s, p) => myWarlords(E, s, p).length > 0 && s.P[p].hand.length >= 2 && E.avatars(s.P[p]) < 4 && s.P[p].av.length < 6 && borrowable(E, s, p).length > 0,
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; if (!myWarlords(E, s, p).length) return { explain: "ไม่มีขุนพลชาวต่างชาติบน Avatar Zone เรา", ops: [] };
      const pay = c.choose(P.hand.filter((x) => x.i !== c.t.i).sort(cheapCard(E, s)), 1, "ค่าใช้จ่าย: ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; if (!pay) return { explain: "ไม่มีการ์ดบนมือให้ทิ้ง", ops: [] };
      const t = c.choose(borrowable(E, s, p).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่สวมใส่ Modification ของฝ่ายตรงข้ามอยู่", { exact: true })[0];
      if (!t) return { explain: `ทิ้ง ${E.name(s, pay)} · ไม่มี Avatar ให้เลือก`, ops: [{ op: "discard", seat: p, iids: [pay.i] }] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · ควบคุม ${E.name(s, t)} จนจบเทิร์นในสภาพตื่น (โจมตี LIFE ไม่ได้)`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "control", i: t.i, seat: p, until: "turn", wake: true, noLife: true }] }; } },
  // เสบียงหลวง: everyone draws 1; with 2+ ขุนพล ชาวต่างชาติ of ours: we draw 2 instead
  "SD07-015": { cast: (c) => { const { E, s, seat: p } = c; return myWarlords(E, s, p).length >= 2 ? { explain: "มีขุนพลชาวต่างชาติ 2 ใบขึ้นไป: จั่ว 2 ใบ", ops: [{ op: "draw", seat: p, n: 2 }] }
    : { explain: "ผู้เล่นทุกคนจั่ว 1 ใบ", ops: [{ op: "draw", seat: p, n: 1 }, { op: "draw", seat: 1 - p, n: 1 }] }; } },
  // ง้าวมังกรเขียว: worn only by ขุนพล ชาวต่างชาติ · POWER +1, +2 on กวนอู
  "SD07-018": { modOnly: (E, s, host) => warlord(E, s, host), worn: (E, s, m, host) => (E.named(s, host, "กวนอู") ? 2 : 1) },
  // เมืองลกเอี๋ยง: while our Avatars show all 4 colours, every Avatar of ours POWER +2
  "SD07-019": { aura: (E, s, src, L) => (L.z === "land" && allColors(E, s, L.p) ? [{ seat: L.p, test: () => true, n: 2 }] : []) },
  // ด่านเฮาโลก๋วน: the opponent cannot use สามัคคี · our purple ขุนพล POWER +1
  "SD07-020": { noUnite: true, aura: (E, s, src, L) => (L.z === "cs" ? [{ seat: L.p, test: (x) => E.named(s, x, "ขุนพล") && E.colors(s, x).includes("ม่วง"), n: 1 }] : []) },
});

// ---------- Starter Deck 08: รัททาทุย ----------
const rat = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "รัททาทุย");
const ratDef = (d) => !!d && d.t === "A" && String(d.sy || "").includes("รัททาทุย");
const ratCon = (E, s, x) => E.def(s, x).t === "C" && sy(E, s, x, "รัททาทุย");
// the printed Cost 1 · GEM 1 · POWER 1 รัททาทุย (พาหะ, โป๊ …)
const mini = (E, s, x) => { const d = E.def(s, x); return rat(E, s, x) && d.c === 1 && d.g === 1 && d.pw === 1; };
const freeAv = (E, s, p) => Math.max(0, Math.min(4 - E.avatars(s.P[p]), 6 - s.P[p].av.length));
// summon up to `max` of those from the Deck and/or hell (o.min1: at least one; o.shuffle: shuffle the Deck if one came from it)
function callMini(c, zones, max, label, o = {}) {
  const { E, s, seat: p } = c; const P = s.P[p]; const n = Math.min(max, freeAv(E, s, p));
  const pool = () => [...(zones.includes("deck") ? uniq(E, s, P.deck.filter((y) => mini(E, s, y) && !got.includes(y))) : []), ...(zones.includes("hell") ? uniq(E, s, [...P.hell].reverse().filter((y) => mini(E, s, y) && !got.includes(y))) : [])];
  const got = []; if (!n) return { explain: "Avatar Zone เต็ม", ops: [] };
  for (let k = 0; k < n; k++) { const t = c.choose(pool(), 1, k ? `${label} (เพิ่มได้อีก ${n - k} ใบ)` : label, { optional: k > 0 || !o.min1 })[0]; if (!t) break; got.push(t); }
  if (!got.length) return { explain: pool().length ? "ไม่อัญเชิญ" : "ไม่มีรัททาทุย Cost 1 GEM 1 POWER 1 ให้อัญเชิญ", ops: [] };
  const fromDeck = got.some((y) => P.deck.includes(y)); const ops = got.map((y) => ({ op: "put", i: y.i })); if (o.shuffle && fromDeck) ops.push({ op: "shuffle", seat: p });
  return { explain: `อัญเชิญ ${got.map((y) => `${E.name(s, y)} จาก${P.deck.includes(y) ? " Deck" : "นรก"}`).join(", ")}${o.shuffle && fromDeck ? " แล้วสับ Deck" : ""}`, ops };
}
const miniReady = (E, s, p, zones) => freeAv(E, s, p) > 0 && zones.some((z) => (z === "deck" ? s.P[p].deck : s.P[p].hell).some((y) => mini(E, s, y)));
// ไพรมอล: once per turn, instead of leaving the field, 5 รัททาทุย cards from our hell are exiled
const primalSave = (E, s, x, L) => { const P = s.P[L.p]; const pool = P.hell.filter((y) => sy(E, s, y, "รัททาทุย")); if (pool.length < 5) return false;
  const pick = [...pool].sort((a, b) => (mini(E, s, a) ? 1 : 0) - (mini(E, s, b) ? 1 : 0) || worth(E, s, a) - worth(E, s, b)).slice(0, 5);
  E.log(s, L.p, `${E.name(s, x)} เนรเทศรัททาทุยในนรก 5 ใบ แล้วไม่ออกจากสนาม`); E.ops(s, pick.map((y) => ({ op: "move", i: y.i, to: "dark" })), L.p); return true; };
Object.assign(SCRIPTS, {
  // ไพรมอล รัททาทุย: once per turn summon a Cost 1 GEM 1 POWER 1 รัททาทุย from Deck or hell · stays on the field by exiling 5 รัททาทุย from hell (once per turn) ·
  // when it attacks, may sacrifice another รัททาทุย of ours to wake up
  "SD08-001": { activate: { label: "อัญเชิญรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck หรือนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && miniReady(E, s, L.p, ["deck", "hell"]),
      run: (c) => callMini(c, ["deck", "hell"], 1, "เลือกรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck หรือนรกที่จะอัญเชิญ", { min1: true, shuffle: true }) },
    wouldDestroy: primalSave, wouldLeave: primalSave,
    attack: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "ไม่อยู่บนสนาม", ops: [] };
      const pool = s.P[p].av.filter((y) => y.i !== x.i && rat(E, s, y)).sort((a, b) => worth(E, s, a) - worth(E, s, b)); if (!pool.length) return { explain: "ไม่มีรัททาทุยใบอื่นให้เซ่นไหว้", ops: [] };
      const t = c.choose(s.P[p].bot ? pool.filter((y) => (E.def(s, y).c || 0) <= 2) : pool, 1, "ไพรมอล รัททาทุย: เซ่นไหว้รัททาทุยฝ่ายเรา 1 ใบ เพื่อกลับเป็นสภาพตื่น (ไม่ใช้ก็ได้)", { optional: true })[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, t)} · ${E.name(s, x)} กลับเป็นสภาพตื่น`, ops: [{ op: "destroy", i: t.i, why: "เซ่นไหว้" }, { op: "wake", i: x.i }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // รัททาทุย พาหะ: the Avatar fighting it gets POWER -1 (the 50-copy deck rule is in the card data)
  "SD08-002": { foeBattle: () => -1, fight: false },
  // โดมรัททาทุย: sacrifice it and show a รัททาทุย Construct from the hand: build that Construct
  "SD08-003": { activate: { label: "เซ่นไหว้ใบนี้ แสดง Construct รัททาทุยจากมือ แล้วก่อสร้าง", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].cs.length < 3 && s.P[L.p].hand.some((y) => ratCon(E, s, y) && !s.P[L.p].cs.some((z) => E.name(s, z) === E.name(s, y))),
    run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; if (!x) return { explain: "ไม่อยู่บนสนาม", ops: [] };
      const t = c.choose(uniq(E, s, P.hand.filter((y) => ratCon(E, s, y) && !P.cs.some((z) => E.name(s, z) === E.name(s, y)))).sort((a, b) => (E.def(s, b).c || 0) - (E.def(s, a).c || 0)), 1, "แสดง Construct รัททาทุยจากมือที่จะก่อสร้าง", { exact: true })[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, x)} · แสดงแล้วก่อสร้าง ${E.name(s, t)}`, ops: [{ op: "destroy", i: x.i, why: "เซ่นไหว้" }, { op: "move", i: t.i, to: "cs", seat: p }] } : { explain: "ไม่มี Construct รัททาทุยบนมือ", ops: [] }; } } },
  // รัททาทุยกินซาก: once per turn exile any number of different-name รัททาทุย Avatars from our hell: POWER +1 each until end of turn
  "SD08-005": { activate: { label: "เนรเทศรัททาทุยในนรก (ชื่อไม่ซ้ำ): POWER +1 ต่อใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.some((y) => rat(E, s, y)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; if (!x) return { explain: "ไม่อยู่บนสนาม", ops: [] }; const names = uniq(E, s, [...P.hell].reverse().filter((y) => rat(E, s, y)));
      const keep = P.av.some((y) => E.named(s, y, "ไพรมอล รัททาทุย")) ? 5 : 0; const spare = P.hell.filter((y) => sy(E, s, y, "รัททาทุย")).length - keep;
      const pick = c.choose(names, P.bot ? Math.max(0, Math.min(names.length, spare)) : names.length, "เลือก Avatar รัททาทุยในนรก (ชื่อไม่ซ้ำกัน) ที่จะเนรเทศ: POWER +1 ต่อใบ", { optional: true });
      return pick.length ? { explain: `เนรเทศ ${pick.length} ใบ: ${E.name(s, x)} POWER +${pick.length} จนจบเทิร์น`, ops: [...pick.map((y) => ({ op: "move", i: y.i, to: "dark" })), { op: "power", i: x.i, n: pick.length, temp: true }] } : { explain: "ไม่เนรเทศ", ops: [] }; } } },
  // ตุ๊กตารัททาทุย: pays only for รัททาทุย (read from the text) · paid for a รัททาทุย: summon a Cost 1 GEM 1 POWER 1 รัททาทุย from the Deck
  "SD08-010": { paidFor: (d) => ratDef(d), paid: (c) => callMini(c, ["deck"], 1, "ตุ๊กตารัททาทุย: เลือกรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck ที่จะอัญเชิญ", { min1: true }) },
  // กรุงโรมใน 1 วัน: up to 2 non-Only Constructs from our hell with total Cost 5 or less are built
  "SD08-012": { canCast: (E, s, p) => s.P[p].cs.length < 3 && s.P[p].hell.some((y) => E.def(s, y).t === "C" && !E.def(s, y).o1 && (E.def(s, y).c || 0) <= 5 && !s.P[p].cs.some((z) => E.name(s, z) === E.name(s, y))),
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const free = 3 - P.cs.length;
      const pool = (budget, not) => uniq(E, s, [...P.hell].reverse().filter((y) => E.def(s, y).t === "C" && !E.def(s, y).o1 && (E.def(s, y).c || 0) <= budget && !P.cs.some((z) => E.name(s, z) === E.name(s, y)) && !(not && E.name(s, y) === E.name(s, not))));
      const cost = (y) => E.def(s, y).c || 0; let best = null; const p1 = pool(5);
      for (const a of p1) { const rest = free >= 2 ? pool(5 - cost(a), a) : []; const b = rest.sort((u, v) => cost(v) - cost(u))[0]; const v = cost(a) + (b ? cost(b) : 0) + 0.1 * cost(a); if (!best || v > best.v) best = { v, a }; }
      const a = c.choose(best ? [best.a, ...p1.filter((y) => y !== best.a)] : p1, 1, "เลือก Construct (ไม่ใช่ Only #1) จากนรกที่จะก่อสร้าง · Cost รวมไม่เกิน 5", { exact: true })[0]; if (!a) return { explain: "ไม่มี Construct ในนรกที่ตรงเงื่อนไข", ops: [] };
      const b = free >= 2 ? c.choose(pool(5 - cost(a), a).filter((y) => y.i !== a.i).sort((u, v) => cost(v) - cost(u)), 1, `เลือก Construct ใบที่ 2 (Cost ไม่เกิน ${5 - cost(a)}) หรือไม่เลือก`, { optional: true })[0] : null;
      const list = [a, b].filter(Boolean); return { explain: `ก่อสร้าง ${list.map((y) => E.name(s, y)).join(" และ ")} จากนรก`, ops: list.map((y) => ({ op: "move", i: y.i, to: "cs", seat: p })) }; } },
  // เลือกมันสำหรับพวก จน !!!: an Avatar of Cost 5 or less (not Only #1) to the hand: 1) from hell or 2) from the Deck · both when 4+ of our LIFE are flipped and more than theirs
  "SD08-013": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p], O = s.P[1 - p]; const up = (Q) => Q.life.filter((x) => x.up).length; const both = up(P) >= 4 && up(P) > up(O);
    const ok = (y) => E.def(s, y).t === "A" && (E.def(s, y).c || 0) <= 5 && !E.def(s, y).o1;
    const hellPool = uniq(E, s, [...P.hell].reverse().filter(ok)).sort(byPw(E, s)), deckPool = uniq(E, s, P.deck.filter(ok)).sort(byPw(E, s));
    const pw = (y) => (y ? E.def(s, y).pw || 0 : -1);
    const m = both ? 2 : c.mode(["1) Avatar Cost 5 หรือต่ำกว่า (ไม่ใช่ Only #1) จากนรกขึ้นมือ", "2) Avatar Cost 5 หรือต่ำกว่า (ไม่ใช่ Only #1) จาก Deck ขึ้นมือ แล้วสับ Deck"], "เลือกมันสำหรับพวก จน !!!: เลือกปฏิบัติ", pw(hellPool[0]) >= pw(deckPool[0]) ? 0 : 1);
    const ops = [], say = both ? ["LIFE เราหงาย 4 ใบขึ้นไปและมากกว่าฝ่ายตรงข้าม: ทำทั้งสองข้อ"] : [];
    if (m !== 1) { const t = c.choose(hellPool, 1, "เลือก Avatar Cost 5 หรือต่ำกว่าจากนรกขึ้นมือ")[0]; if (t) { ops.push({ op: "move", i: t.i, to: "hand" }); say.push(`${E.name(s, t)} จากนรกขึ้นมือ`); } else say.push("ไม่มี Avatar ในนรกที่ตรงเงื่อนไข"); }
    if (m !== 0) { const t = c.choose(deckPool, 1, "เลือก Avatar Cost 5 หรือต่ำกว่าจาก Deck ขึ้นมือ")[0]; if (t) { ops.push({ op: "search", seat: p, take: t.i, to: "hand" }); say.push(`${E.name(s, t)} จาก Deck ขึ้นมือ`); } else say.push("ไม่มี Avatar ใน Deck ที่ตรงเงื่อนไข"); ops.push({ op: "shuffle", seat: p }); }
    return { explain: say.join(" · "), ops }; } },
  // แพร่พันธ์ุทันใจ: discard any number of รัททาทุย Avatars from the hand, then summon a รัททาทุย Avatar from the Deck whose Cost is at most the total Cost discarded
  "SD08-014": { canCast: (E, s, p) => freeAv(E, s, p) > 0 && s.P[p].deck.some((y) => rat(E, s, y)),
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const cost = (y) => E.def(s, y).c || 0;
      const hand = P.hand.filter((y) => y.i !== c.t.i && rat(E, s, y)); const deck = uniq(E, s, P.deck.filter((y) => rat(E, s, y)));
      // bots: the best Avatar whose Cost the least valuable discards can cover
      let plan = { v: -3, use: [], t: null }; // the card is already cast: take the best trade unless it is clearly bad
      for (const t of deck) { if (cost(t) === 0) { const v = worth(E, s, t); if (v > plan.v) plan = { v, use: [], t }; continue; }
        let bestUse = null; for (let m = 1; m < 1 << Math.min(hand.length, 8); m++) { const use = hand.filter((_, k) => m & (1 << k)); const sum = use.reduce((a, y) => a + cost(y), 0); if (sum < cost(t)) continue; const loss = use.reduce((a, y) => a + worth(E, s, y), 0); if (!bestUse || loss < bestUse.loss) bestUse = { use, loss }; }
        if (bestUse) { const v = worth(E, s, t) - bestUse.loss * 0.6; if (v > plan.v) plan = { v, use: bestUse.use, t }; } }
      const order = [...plan.use, ...hand.filter((y) => !plan.use.includes(y))];
      const dis = c.choose(order, P.bot ? plan.use.length : hand.length, "แพร่พันธ์ุทันใจ: เลือกรัททาทุยบนมือที่จะทิ้ง (กี่ใบก็ได้)", { optional: true }); const sum = dis.reduce((a, y) => a + cost(y), 0);
      const cands = deck.filter((y) => cost(y) <= sum).sort((a, b) => (b === plan.t) - (a === plan.t) || worth(E, s, b) - worth(E, s, a));
      const t = freeAv(E, s, p) > 0 ? c.choose(cands, 1, `เลือกรัททาทุยจาก Deck ที่จะอัญเชิญ (Cost ไม่เกิน ${sum})`, { exact: true })[0] : null;
      const ops = dis.length ? [{ op: "discard", seat: p, iids: dis.map((y) => y.i) }] : []; if (t) ops.push({ op: "put", i: t.i });
      return { explain: `ทิ้ง ${dis.length} ใบ (Cost รวม ${sum})${t ? ` · อัญเชิญ ${E.name(s, t)} จาก Deck` : " · ไม่มีรัททาทุยใน Deck ที่ Cost ไม่เกินนั้น"}`, ops }; } },
  // รัททาท่วม (React): one of our รัททาทุย Avatars was destroyed: summon 1-2 Cost 1 GEM 1 POWER 1 รัททาทุย from the Deck, then shuffle
  "SD08-015": { react: { kinds: ["destroyed"], can: (E, s, p, on) => { const L = E.locate(s, on.i); return on.p === p && !!L && rat(E, s, L.x) && miniReady(E, s, p, ["deck"]); } },
    cast: (c) => callMini(c, ["deck"], 2, "รัททาท่วม: เลือกรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck ที่จะอัญเชิญ", { min1: true, shuffle: true }) },
  // นวมรัททาทุย: worn only by รัททาทุย · POWER +1 for each รัททาทุย Avatar on our side
  "SD08-016": { modOnly: (E, s, host) => rat(E, s, host), worn: (E, s, m, host) => { const L = E.locate(s, host.i); return L ? s.P[L.p].av.filter((y) => rat(E, s, y)).length : 0; } },
  // พิภพรัททาทุย (Land): while every Avatar of ours is รัททาทุย we may control 6 of them · our attacking รัททาทุย POWER +2 until the fight ends
  "SD08-017": { cap6: (E, s, x) => rat(E, s, x), aura: (E, s, src, L) => (L.z === "land" && s.pend && s.pend.by === L.p ? [{ seat: L.p, test: (x) => x.i === s.pend.att && rat(E, s, x), n: 2 }] : []) },
  // รังรักรัททาทุย: when built, and once per turn: summon a Cost 1 GEM 1 POWER 1 รัททาทุย from the Deck, then shuffle
  "SD08-018": { build: (c) => callMini(c, ["deck"], 1, "รังรักรัททาทุย: เลือกรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck ที่จะอัญเชิญ", { min1: true, shuffle: true }),
    activate: { label: "อัญเชิญรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && miniReady(E, s, L.p, ["deck"]),
      run: (c) => callMini(c, ["deck"], 1, "เลือกรัททาทุย Cost 1 GEM 1 POWER 1 จาก Deck ที่จะอัญเชิญ", { min1: true, shuffle: true }) } },
  // วงล้อรัททาทุย: our Cost 1 GEM 1 POWER 1 รัททาทุย POWER +1
  "SD08-019": { aura: (E, s, src, L) => (L.z === "cs" ? [{ seat: L.p, test: (x) => mini(E, s, x), n: 1 }] : []) },
  // บ่อหมัก รัททาทุย: discarded as Cost for a รัททาทุย Avatar: it is built · once per turn, when a รัททาทุย Avatar of ours is destroyed: draw 1
  "SD08-020": { paidFor: (d) => ratDef(d), paid: (c) => { const { E, s, seat: p } = c; const L = E.locate(s, c.t.i); const P = s.P[p];
      if (!L || L.z !== "hell") return { explain: "การ์ดไม่อยู่ในนรกแล้ว", ops: [] }; if (P.cs.length >= 3 || P.cs.some((z) => E.name(s, z) === E.name(s, L.x))) return { explain: "Construct Zone เต็มหรือมีชื่อนี้แล้ว", ops: [] };
      return { explain: `ก่อสร้าง ${E.name(s, L.x)} จากนรก`, ops: [{ op: "move", i: L.x.i, to: "cs", seat: p }] }; },
    allyOk: (E, s, y, Ly, x) => Ly.z === "cs" && y.used !== s.turn && rat(E, s, x),
    allyDeath: (c) => { const { s, self: y } = c; if (!y || y.used === s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] }; return { explain: "รัททาทุยฝ่ายเราถูกทำลาย: จั่ว 1 ใบ", ops: [{ op: "used", i: y.i }, { op: "draw", seat: c.seat, n: 1 }] }; } },
});

// ---------- Starter Deck 09: วานร ----------
const monkey = (E, s, x) => isAv(E, s, x) && E.named(s, x, "วานร");
const monkeyDef = (d) => !!d && d.t === "A" && String(d.n || "").includes("วานร");
const monkeyToken = (seat, n = 1) => ({ op: "token", seat, n, name: "วานร", power: 1, cost: 1, symbol: "สัตว์", color: "เขียว" });
const tokensFirst = (E, s) => (a, b) => (b.tok ? 1 : 0) - (a.tok ? 1 : 0) || worth(E, s, a) - worth(E, s, b);
const hellMonkeys = (E, s, p) => s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "วานร")).length;
// หนุมาน / นิลพัท: from the hand, destroy 2 วานร on our Avatar Zone to summon it
const monkeyCall = { label: "ทำลาย Avatar วานร 2 ใบบน Avatar Zone เรา แล้วอัญเชิญใบนี้จากมือ", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && s.P[L.p].av.filter((y) => monkey(E, s, y)).length >= 2,
  run: (c) => { const { E, s, seat: p, self: x } = c; const two = c.choose(s.P[p].av.filter((y) => monkey(E, s, y)).sort(tokensFirst(E, s)), 2, `ทำลาย Avatar วานร 2 ใบบน Avatar Zone เพื่ออัญเชิญ ${x ? E.name(s, x) : ""}`, { exact: true });
    if (!x || two.length < 2) return { explain: "มี Avatar วานรไม่พอ", ops: [] };
    return { explain: `ทำลาย ${two.map((y) => E.name(s, y)).join(", ")} · อัญเชิญ ${E.name(s, x)} จากมือ`, ops: [...two.map((y) => ({ op: "destroy", i: y.i, why: "ค่าความสามารถ" })), { op: "put", i: x.i }] }; } };
// หนุมาน: once per turn, when the opponent's card would remove it: scout 1, a วานร Avatar keeps it on the field; the scouted card is discarded
const hanumanSave = (E, s, x, L, o) => { if (!o || !o.fromOpp || x.hs === s.turn) return false; x.hs = s.turn; const P = s.P[L.p]; const top = P.deck[0]; if (!top) return false;
  const ok = isAv(E, s, top) && E.named(s, top, "วานร"); E.log(s, L.p, `${E.name(s, x)}: สอดแนม 1 ใบ ${E.name(s, top)}${ok ? " เป็น Avatar วานร จึงไม่ถูกนำออกจากสนาม" : " ไม่ใช่วานร"} · ทิ้งการ์ดที่สอดแนม`);
  E.ops(s, [{ op: "move", i: top.i, to: "hell" }], L.p); return ok; };
const baliKill = (c) => { const { E, s, seat: p } = c; const O = s.P[1 - p]; if (!O.av.length) return { explain: "ฝ่ายตรงข้ามไม่มี Avatar", ops: [] };
  const m = Math.min(...O.av.map((x) => E.costNow(s, x))); const all = O.av.filter((x) => E.costNow(s, x) === m);
  return { explain: `ทำลาย Avatar ที่มี Cost ต่ำที่สุด (${m}) ของฝ่ายตรงข้ามทุกใบ: ${all.map((x) => E.name(s, x)).join(", ")}`, ops: all.map((x) => ({ op: "destroy", i: x.i, why: "ความสามารถของพาลี" })) }; };
const lifeMonkey = (c) => { const { s, seat: p } = c; if (!c.t.now) return { explain: "จะทำงานใน Main Phase ถัดไป", ops: [{ op: "later", seat: p, t: { i: c.t.i, c: c.t.c, when: "life", seat: p, now: true }, why: `${(s.cards[c.t.c] || {}).n}: ถึง Main Phase ที่รอไว้แล้ว` }] };
  const n = hellMonkeys(c.E, s, p); return n >= 4 && s.P[p].av.length < 6 ? { explain: `ในนรกมี Avatar วานร ${n} ใบ: เรียก Token วานร 1 ใบ`, ops: [monkeyToken(p, 1)] } : { explain: `ในนรกมี Avatar วานร ${n} ใบ (ต้อง 4 ใบขึ้นไป) ความสามารถไม่ทำงาน`, ops: [] }; };
Object.assign(SCRIPTS, {
  // หนุมาน วานรวายุ: called from the hand · โล่มนุษย์ · [Link นิลพัท] · saved once per turn by a วานร scout · when it fights: POWER +1 until end of turn
  "SD09-001": { activate: monkeyCall, wouldDestroy: hanumanSave, wouldLeave: hanumanSave,
    fight: (c) => (c.self ? { explain: `${c.E.name(c.s, c.self)} ต่อสู้: POWER +1 จนจบเทิร์น`, ops: [{ op: "power", i: c.self.i, n: 1, temp: true }] } : { explain: "ไม่อยู่บนสนาม", ops: [] }) },
  // นิลพัท วานรสีกาฬ: called from the hand · สามัคคี · on entering Link: 2 วานร Tokens · POWER +1 for each วานร Token of ours
  "SD09-002": { activate: monkeyCall,
    link: (c) => { const n = Math.min(2, 6 - c.s.P[c.seat].av.length); return n > 0 ? { explain: `เข้าสู่สถานะ Link: เรียก Token วานร ${n} ใบ`, ops: [monkeyToken(c.seat, n)] } : { explain: "Avatar Zone เต็ม", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: s.P[L.p].av.filter((y) => y.tok && E.named(s, y, "วานร")).length }] : []) },
  // สุครีพ: at the start of our Main Phase, 2 opposing Avatars take the lower of their Costs until end of turn (before พาลี checks the lowest Cost)
  "SD09-003": { early: true, mainStart: (c) => { const { E, s, seat: p } = c; const pool = s.P[1 - p].av.filter((x) => !E.noAim(s, x)); if (pool.length < 2) return { explain: "ฝ่ายตรงข้ามมี Avatar ให้เลือกไม่ถึง 2 ใบ", ops: [] };
    const cheap = [...pool].sort((a, b) => E.costNow(s, a) - E.costNow(s, b))[0]; const rich = [...pool].filter((x) => x.i !== cheap.i).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
    const two = c.choose([rich, cheap, ...pool.filter((x) => x !== rich && x !== cheap)], 2, "สุครีพ: เลือก Avatar ฝ่ายตรงข้าม 2 ใบ (Cost ทั้งคู่จะเท่ากับใบที่ต่ำกว่าจนจบเทิร์น)", { exact: true });
    const v = Math.min(...two.map((x) => E.costNow(s, x))); return { explain: `Cost ของ ${two.map((x) => E.name(s, x)).join(" และ ")} เป็น ${v} จนจบเทิร์น`, ops: two.map((x) => ({ op: "setCost", i: x.i, v })) }; } },
  // พาลี: จุติ and at the start of our Main Phase: destroy every opposing Avatar with the lowest Cost
  "SD09-004": { summon: baliKill, mainStart: baliKill },
  // คิงคา: จุติ with a วานร Avatar in our hell (or showing one from the hand): a วานร Token
  "SD09-005": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; if (P.av.length >= 6) return { explain: "Avatar Zone เต็ม", ops: [] };
    if (hellMonkeys(E, s, p)) return { explain: "ในนรกมี Avatar วานร: เรียก Token วานร 1 ใบ", ops: [monkeyToken(p, 1)] };
    const show = c.choose(P.hand.filter((y) => isAv(E, s, y) && E.named(s, y, "วานร")), 1, "แสดง Avatar วานรบนมือ 1 ใบ เพื่อเรียก Token วานร (ไม่แสดงก็ได้)", { optional: true })[0];
    return show ? { explain: `แสดง ${E.name(s, show)} จากมือ · เรียก Token วานร 1 ใบ`, ops: [monkeyToken(p, 1)] } : { explain: "ไม่มีวานรในนรกและไม่ได้แสดงการ์ด", ops: [] }; } },
  // วานรกินซากลากอเวจี: คำสั่งเสีย with 4+ วานร Avatars in our hell: a วานร Token
  "SD09-006": { death: (c) => { const n = hellMonkeys(c.E, c.s, c.seat); return n >= 4 && c.s.P[c.seat].av.length < 6 ? { explain: `ในนรกมี Avatar วานร ${n} ใบ: เรียก Token วานร 1 ใบ`, ops: [monkeyToken(c.seat, 1)] } : { explain: `ในนรกมี Avatar วานร ${n} ใบ (ต้อง 4 ใบขึ้นไป)`, ops: [] }; } },
  // วานรถลกหนังฝังกระดูก: used as Cost for a วานร Avatar: a วานร Token
  "SD09-007": { paidFor: (d) => monkeyDef(d), paid: (c) => (c.s.P[c.seat].av.length < 6 ? { explain: "ถูกใช้เป็นค่า Cost ให้วานร: เรียก Token วานร 1 ใบ", ops: [monkeyToken(c.seat, 1)] } : { explain: "Avatar Zone เต็ม", ops: [] }) },
  // เลือกตั้งเจ้าป่า: sacrifice a วานร, scout 7: a วานร Avatar of Cost 5 or less to the hand (คิงคา may be summoned with จุติ instead)
  "SD09-014": { canCast: (E, s, p) => s.P[p].av.some((y) => monkey(E, s, y)),
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const sac = c.choose(P.av.filter((y) => monkey(E, s, y)).sort(tokensFirst(E, s)), 1, "ค่าใช้จ่าย: เซ่นไหว้ Avatar วานร 1 ใบ", { exact: true })[0]; if (!sac) return { explain: "ไม่มีวานรให้เซ่นไหว้", ops: [] };
      const top = P.deck.slice(0, Math.min(P.deck.length, 7)); const ops = [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; const say = [`เซ่นไหว้ ${E.name(s, sac)}`, `สอดแนม ${top.length} ใบ`];
      const kk = (y) => E.named(s, y, "คิงคา วานรเจ้าป่า");
      const t = c.choose(top.filter((y) => isAv(E, s, y) && E.named(s, y, "วานร") && (E.def(s, y).c || 0) <= 5).sort((a, b) => kk(b) - kk(a) || worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar วานร Cost 5 หรือต่ำกว่าจากที่สอดแนมขึ้นมือ", { exact: true, reveal: top.map((y) => y.i) })[0];
      if (t) { const room = E.avatars(P) - (sac.tok ? 0 : 1) < 4 && P.av.length - 1 < 6;
        const m = kk(t) && room ? c.mode([`อัญเชิญ ${E.name(s, t)} แบบจุติ`, `นำ ${E.name(s, t)} ขึ้นมือ`], "เลือกได้คิงคา วานรเจ้าป่า: อัญเชิญแบบจุติแทนการนำขึ้นมือได้", 0) : 1;
        if (m === 0) { ops.push({ op: "put", i: t.i, jt: true }); say.push(`อัญเชิญ ${E.name(s, t)} แบบจุติ`); } else { ops.push({ op: "search", seat: p, take: t.i, to: "hand" }); say.push(`${E.name(s, t)} ขึ้นมือ`); } }
      else say.push("ไม่มี Avatar วานร Cost 5 หรือต่ำกว่า");
      ops.push({ op: "scoutRest", seat: p, ids: top.filter((y) => y !== t).map((y) => y.i), rest: "bottom" }); return { explain: say.join(" · ") + " · ที่เหลือไว้ใต้ Deck", ops }; } },
  // เตรียมเสบียง: each player puts an Avatar of Cost 4 or less (not Only #1) from its hell on top of its Deck (the opponent puts back its best one)
  "SD09-015": { cast: (c) => { const { E, s, seat: p } = c; const ok = (y) => E.def(s, y).t === "A" && (E.def(s, y).c || 0) <= 4 && !E.def(s, y).o1;
    const mine = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter(ok)).sort(byPw(E, s)), 1, "เลือก Avatar ในนรกเรา (Cost 4 หรือต่ำกว่า) วางไว้บนสุดของ Deck")[0];
    const theirs = uniq(E, s, [...s.P[1 - p].hell].reverse().filter(ok)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
    const ops = [], say = []; if (mine) { ops.push({ op: "move", i: mine.i, to: "deckTop" }); say.push(`เรา ${E.name(s, mine)}`); } if (theirs) { ops.push({ op: "move", i: theirs.i, to: "deckTop" }); say.push(`ฝ่ายตรงข้าม ${E.name(s, theirs)}`); }
    return { explain: say.length ? `วางบนสุดของ Deck: ${say.join(" · ")}` : "ไม่มี Avatar ในนรกที่ตรงเงื่อนไข", ops }; } },
  // วานรร้อนรัก (React): our วานร is in a fight: sacrifice another วานร that is not fighting: the fighting one POWER +2 until end of turn
  "SD09-017": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return !!T && T.p === p && monkey(E, s, T.x) && s.P[p].av.some((y) => y.i !== T.x.i && monkey(E, s, y)); } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const T = on.ti != null ? E.locate(s, on.ti) : null; if (!T || T.z !== "av") return { explain: "Avatar ที่ต่อสู้ไม่อยู่แล้ว", ops: [] };
      const sac = c.choose(s.P[p].av.filter((y) => y.i !== T.x.i && monkey(E, s, y)).sort(tokensFirst(E, s)), 1, "ค่าใช้จ่าย: เซ่นไหว้ Avatar วานรใบอื่นที่ไม่ได้ต่อสู้ 1 ใบ", { exact: true })[0];
      return sac ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · ${E.name(s, T.x)} POWER +2 จนจบเทิร์น`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "power", i: T.x.i, n: 2, temp: true }] } : { explain: "ไม่มีวานรใบอื่นให้เซ่นไหว้", ops: [] }; } },
  // ตรีเพชร: worn only by วานร · destroy the wearer: summon หนุมาน or นิลพัท from our hell
  "SD09-018": { modOnly: (E, s, host) => monkey(E, s, host),
    activate: { label: "ทำลาย Avatar ที่สวมใส่ แล้วอัญเชิญหนุมานหรือนิลพัทจากนรก", can: (E, s, x, L) => { const H = L.z === "mg" && x.on != null ? E.locate(s, x.on) : null; return !!H && H.p === L.p && s.phase === "main" && s.P[L.p].hell.some((y) => isAv(E, s, y) && (E.named(s, y, "หนุมาน") || E.named(s, y, "นิลพัท"))); },
      run: (c) => { const { E, s, seat: p, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; if (!H) return { explain: "ไม่ได้สวมใส่อยู่", ops: [] };
        const t = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter((y) => isAv(E, s, y) && (E.named(s, y, "หนุมาน") || E.named(s, y, "นิลพัท")))).sort(byPw(E, s)), 1, "เลือกหนุมานหรือนิลพัทในนรกที่จะอัญเชิญ", { exact: true })[0];
        return t ? { explain: `ทำลาย ${E.name(s, H.x)} · อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "destroy", i: H.x.i, why: "ค่าความสามารถของตรีเพชร" }, { op: "put", i: t.i }] } : { explain: "ไม่มีหนุมานหรือนิลพัทในนรก", ops: [] }; } } },
  // ดาบพระขรรค์: worn only by วานร · POWER +2
  "SD09-019": { modOnly: (E, s, host) => monkey(E, s, host), worn: () => 2 },
  // ป่าแห่งเมืองขีดขิน (Land): once per turn, sacrifice a วานร: draw 1
  "SD09-020": { activate: { label: "เซ่นไหว้ Avatar วานร 1 ใบ: จั่ว 1 ใบ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].av.some((y) => monkey(E, s, y)),
    run: (c) => { const { E, s, seat: p } = c; const sac = c.choose(s.P[p].av.filter((y) => monkey(E, s, y)).sort(tokensFirst(E, s)), 1, "เซ่นไหว้ Avatar วานร 1 ใบเพื่อจั่ว 1 ใบ", { exact: true })[0];
      return sac ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · จั่ว 1 ใบ`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "draw", seat: p, n: 1 }] } : { explain: "ไม่มีวานรให้เซ่นไหว้", ops: [] }; } } },
  // ไม่นะ คิงคา / นังชั่ว ตายแล้ว (LIFE): in the next Main Phase, with 4+ วานร Avatars in our hell: a วานร Token
  "SD09-023": { life: lifeMonkey }, "SD09-024": { life: lifeMonkey },
});

// ---------- BT01 ----------
const syIs = (E, s, x, k) => { const d = E.def(s, x); return E.hasSy(s, x, k) && (String(d.sy || "").split(/[\s,\/]+/).includes(k) || !String(d.sy || "").includes(k)); }; // "สัตว์" is not "สัตว์วิเศษ"
const flipsOwnLife = { toHell: (c) => (c.E.critical(c.s.P[c.seat]) ? { explain: "LIFE หงายหมดแล้ว", ops: [] } : { explain: "ตกลงสู่นรก: หงาย LIFE Card ใบบนสุดฝ่ายเรา 1 ใบ", ops: [{ op: "lifeFlip", seat: c.seat }] }) };
Object.assign(SCRIPTS, {
  // นนทก นิ้วเพชร: attacking a {เทพ} Avatar destroys it
  "BT01-001": { attackOk: (E, s) => { const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return !!T && sy(E, s, T.x, "เทพ"); }, attack: (c) => { const { E, s } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; if (!T || T.z !== "av" || !sy(E, s, T.x, "เทพ")) return { explain: "เป้าหมายไม่ใช่ Avatar {เทพ}", ops: [] };
    return { explain: `โจมตี Avatar {เทพ}: ทำลาย ${E.name(s, T.x)}`, ops: [{ op: "destroy", i: T.x.i, why: "ความสามารถของนนทก นิ้วเพชร" }] }; } },
  // อู๊ดลูกเสือ: when attacked, may destroy another Avatar of ours: cancel that attack (read from the card art; the data text lost a word)
  "BT01-005": { attacked: (c) => { const { E, s, seat: p, self: x } = c; if (!x || !s.pend) return { explain: "ไม่มีการโจมตีแล้ว", ops: [] };
    const A = E.locate(s, s.pend.att); const ap = A ? E.power(s, A.x) + (s.pend.bonus || 0) : 0; const pool = s.P[p].av.filter((y) => y.i !== x.i).sort((a, b) => (b.tok ? 1 : 0) - (a.tok ? 1 : 0) || worth(E, s, a) - worth(E, s, b));
    const cands = s.P[p].bot ? (ap >= E.power(s, x) ? pool.filter((y) => worth(E, s, y) + 1 < worth(E, s, x)) : []) : pool;
    const t = c.choose(cands, 1, "อู๊ดลูกเสือถูกโจมตี: ทำลาย Avatar ใบอื่นของเราเพื่อยกเลิกการโจมตี (ไม่ใช้ก็ได้)", { optional: true })[0];
    return t ? { explain: `ทำลาย ${E.name(s, t)} · ยกเลิกการโจมตีนั้น`, ops: [{ op: "destroy", i: t.i, why: "ค่าความสามารถของอู๊ดลูกเสือ" }, { op: "cancelAttack" }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // รัททาทุย นางพญา: in our first Draw Phase it may come from the Deck instead of the draw
  "BT01-008": { firstDraw: (c) => { const { E, s, seat: p, self: q } = c; if (!q || E.locate(s, q.i).z !== "deck") return { explain: "ไม่อยู่ใน Deck แล้ว", ops: [] }; const back = (c.t.drawn || []).map((i) => s.P[p].hand.find((y) => y.i === i)).filter(Boolean).pop();
    const m = c.mode([`นำ ${E.name(s, q)} จาก Deck ขึ้นมือแทนการจั่ว`, "จั่วตามปกติ"], "Draw Phase แรก: เลือกได้", 0); if (m !== 0) return { explain: "จั่วตามปกติ", ops: [] };
    return { explain: `นำ ${E.name(s, q)} ขึ้นมือแทนการจั่ว${back ? ` (${E.name(s, back)} กลับไปบน Deck)` : ""}`, ops: [...(back ? [{ op: "move", i: back.i, to: "deckTop" }] : []), { op: "search", seat: p, take: q.i, to: "hand" }] }; } },
  // รัททาทุย พ่อพันธุ์: จุติ with รัททาทุย นางพญา on our side: any number of "รัททาทุย" Avatars from the Deck, total Cost 5 or less, then shuffle
  "BT01-009": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; if (!P.av.some((y) => E.named(s, y, "รัททาทุย นางพญา"))) return { explain: "ไม่มีรัททาทุย นางพญาบน Avatar Zone เรา", ops: [] };
    let budget = 5, room = Math.max(0, Math.min(4 - E.avatars(P), 6 - P.av.length)); const got = [];
    while (room > 0) { const pool = uniq(E, s, P.deck.filter((y) => isAv(E, s, y) && E.named(s, y, "รัททาทุย") && !got.includes(y) && (E.def(s, y).c || 0) <= budget)).sort((a, b) => worth(E, s, b) - worth(E, s, a));
      const t = c.choose(pool, 1, `เลือก Avatar "รัททาทุย" จาก Deck (Cost รวมเหลือ ${budget}) หรือหยุด`, { optional: true })[0]; if (!t) break; got.push(t); budget -= E.def(s, t).c || 0; room--; }
    return { explain: got.length ? `อัญเชิญ ${got.map((y) => E.name(s, y)).join(", ")} จาก Deck แล้วสับ Deck` : "ไม่อัญเชิญ · สับ Deck", ops: [...got.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; } },
  // ลูกแม่ศรีนวล: คำสั่งเสีย: turn the top face-up LIFE card face down again
  "BT01-012": { death: (c) => (c.s.P[c.seat].life.some((y) => y.up) && !c.E.critical(c.s.P[c.seat]) ? { explain: "คว่ำ LIFE Card ที่หงายอยู่ใบบนสุด 1 ใบ", ops: [{ op: "lifeFlip", seat: c.seat, up: false }] } : { explain: c.E.critical(c.s.P[c.seat]) ? "อยู่ในสถานะสาหัส คว่ำ LIFE ด้วยความสามารถไม่ได้" : "ไม่มี LIFE ที่หงายอยู่", ops: [] }) },
  // ศาลพระภูมิ: จุติ: a {ผี} Avatar from the Deck, shuffle · cannot be chosen as an attack target while another {ผี} of ours is on the field
  "BT01-020": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; if (E.avatars(P) >= 4 || P.av.length >= 6) return { explain: "Avatar Zone เต็ม", ops: [{ op: "shuffle", seat: p }] };
      const t = c.choose(uniq(E, s, P.deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "ผี"))).sort(strongFirst(E, s)), 1, "เลือก Avatar {ผี} จาก Deck ที่จะอัญเชิญ")[0];
      return { explain: t ? `อัญเชิญ ${E.name(s, t)} จาก Deck แล้วสับ Deck` : "ไม่มี Avatar {ผี} ใน Deck", ops: [...(t ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }] }; },
    noAtk: (E, s, x, L) => L.z === "av" && s.P[L.p].av.some((y) => y.i !== x.i && sy(E, s, y, "ผี")) },
  // เพื่อลูกค้า: sacrifice a {สัตว์} Avatar: draw 3, then only {สัตว์} Avatars may be summoned this turn
  "BT01-037": { canCast: (E, s, p) => s.P[p].av.some((y) => syIs(E, s, y, "สัตว์")),
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => syIs(E, s, y, "สัตว์")).sort((a, b) => worth(E, s, a) - worth(E, s, b)), 1, "เซ่นไหว้ Avatar {สัตว์} ฝ่ายเรา 1 ใบ", { exact: true })[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, t)} · จั่ว 3 ใบ · เทิร์นนี้อัญเชิญได้แค่ Avatar {สัตว์}`, ops: [{ op: "destroy", i: t.i, why: "เซ่นไหว้" }, { op: "draw", seat: p, n: 3 }, { op: "turnLock", seat: p, sy: "สัตว์" }] } : { explain: "ไม่มี Avatar {สัตว์} ให้เซ่นไหว้", ops: [] }; } },
  // ริกกี้ นักปลอมแปลง (React): one of ours was destroyed in a fight: take a sleeping opposing Avatar and wear this card on it; if this card is destroyed, that Avatar returns to its owner's hand
  "BT01-042": { react: { kinds: ["destroyed"], can: (E, s, p, on) => on.p === p && on.fight && s.P[1 - p].av.some((y) => !y.a && !E.noAim(s, y) && !E.noControl(s, y)) && E.avatars(s.P[p]) < 4 && s.P[p].av.length < 6 },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !y.a && !E.noAim(s, y) && !E.noControl(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่นอนอยู่ มาอยู่ฝ่ายเรา", { exact: true })[0];
      return t ? { explain: `ควบคุม ${E.name(s, t)} แล้วนำริกกี้ไปสวมใส่ให้`, ops: [{ op: "control", i: t.i, seat: p }, { op: "attach", i: c.t.i, on: t.i }] } : { explain: "ไม่มี Avatar ที่นอนอยู่ให้เลือก", ops: [] }; },
    wornDestroyed: (E, s, m, host) => (E.locate(s, host) ? [{ op: "move", i: host, to: "hand" }] : []) },
  // น้ำชูกำลัง: the wearer wakes up in the End Phase
  "BT01-043": { endPhase: (E, s, m, L) => (L.z === "mg" && m.on != null && E.locate(s, m.on) && !E.locate(s, m.on).x.a ? [{ op: "wake", i: m.on }] : []) },
  // รั้วของชาติ: the wearer has โล่มนุษย์
  "BT01-044": { aura: (E, s, src, L) => { const H = L.z === "mg" && src.on != null ? E.locate(s, src.on) : null; return H ? [{ seat: H.p, test: (x) => x.i === src.on, n: 0, kw: ["โล่มนุษย์"] }] : []; } },
  // ตีแม่: POWER +2 · when it falls to hell, our top LIFE card is flipped
  "BT01-045": { worn: () => 2, ...flipsOwnLife },
  // ตีพ่อ: in Battle Phase, when the wearer destroys an opposing Avatar it may wake once · when it falls to hell, our top LIFE card is flipped
  "BT01-046": { worn: () => 0, hostWin: (c) => { const { E, s, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; if (!H || m.used === s.turn) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] };
      return { explain: `${E.name(s, H.x)} ทำลาย Avatar อีกฝ่ายสำเร็จ: กลับมาสภาพตื่น`, ops: [{ op: "used", i: m.i }, { op: "wake", i: H.x.i }] }; }, ...flipsOwnLife },
  // เขาไกรลาสเอียง (Land): whoever declares an attack mills 2
  "BT01-047": { onDeclare: (E, s, x, L, by) => [{ op: "mill", seat: by, n: 2 }] },
  // ทุ่งนาแดนนี้ (Land): every {แมลง}, {สัตว์}, {รัททาทุย} and {คน} Avatar POWER +1
  "BT01-048": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((q) => ({ seat: q, test: (x) => ["แมลง", "สัตว์", "รัททาทุย", "คน"].some((k) => syIs(E, s, x, k)), n: 1 })) : []) },
  // มวยทะเลลลลลล (Land): each player attacks once per turn · it leaves after 4 turns
  "BT01-049": { oneAttack: true, endPhase: (E, s, x, L) => (L.z === "land" && x.t0 != null && s.turn - x.t0 >= 3 ? [{ op: "move", i: x.i, to: "hell" }] : []) },
  // โรงบาล (Land): once per turn, discard 1: an Avatar of Cost 3 or less from hell to the hand; that name cannot be summoned or used this turn
  "BT01-050": { activate: { label: "ทิ้งการ์ดบนมือ 1 ใบ: นำ Avatar Cost 3 หรือต่ำกว่าจากนรกขึ้นมือ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 3),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const t = c.choose(uniq(E, s, [...P.hell].reverse().filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 3)).sort(strongFirst(E, s)), 1, "เลือก Avatar Cost 3 หรือต่ำกว่าในนรกที่จะขึ้นมือ", { exact: true })[0];
      const pay = t ? c.choose([...P.hand].sort(cheapCard(E, s)), 1, "ค่าใช้จ่าย: ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0] : null; if (!t || !pay) return { explain: "ไม่มีการ์ดให้เลือก", ops: [] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} จากนรกขึ้นมือ (เทิร์นนี้อัญเชิญหรือใช้ความสามารถชื่อนี้ไม่ได้)`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "hand" }, { op: "turnLock", seat: p, name: E.name(s, t) }] }; } } },
});

// ---------- BT02 ----------
const peretDef = (d) => !!d && d.t === "A" && String(d.sy || "").includes("เปรต");
const hellLord = (E, s, x) => isAv(E, s, x) && E.named(s, x, "นายนิรยบาล");
Object.assign(SCRIPTS, {
  // วันชัย พ่อบุญลือ: paid for a {เปรต}: that Avatar cannot be destroyed this turn
  "BT02-002": { paidFor: (d) => peretDef(d), paid: (c) => (c.t.forI != null && c.E.locate(c.s, c.t.forI) ? { explain: "ถูกใช้เป็นค่า Cost ให้เปรต: Avatar ใบนั้นจะไม่ถูกทำลายในเทิร์นนี้", ops: [{ op: "ind", i: c.t.forI }] } : { explain: "Avatar ใบนั้นไม่อยู่บนสนามแล้ว", ops: [] }) },
  // กัญญา แม่บุญลือ: paid for a {เปรต}: draw 1, then discard 1
  "BT02-003": { paidFor: (d) => peretDef(d), paid: (c) => ({ explain: "ถูกใช้เป็นค่า Cost ให้เปรต: จั่ว 1 ใบ แล้วทิ้ง 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }, { op: "resume", t: { i: c.t.i, c: c.t.c, when: "paid2", seat: c.seat } }] }),
    paid2: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return t ? { explain: `ทิ้ง ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [t.i] }] } : { explain: "ไม่มีการ์ดบนมือ", ops: [] }; } },
  // อ๊บ: จุติ: sacrifice another Avatar of ours
  "BT02-007": { summon: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => !x || y.i !== x.i).sort(cheapCard(E, s)), 1, "อ๊บ: เลือก Avatar ฝ่ายเราใบอื่นที่จะเซ่นไหว้", { exact: true })[0];
    return t ? { explain: `เซ่นไหว้ ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "เซ่นไหว้" }] } : { explain: "ไม่มี Avatar ใบอื่นให้เซ่นไหว้", ops: [] }; } },
  // พระพรหม: จุติ: sacrifice one of ours: summon (จุติ) from our hell an Avatar sharing its Symbol, with another name, Cost 8 or less
  "BT02-008": { summon: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const syOf = (y) => String(E.def(s, y).sy || "").split(/[\s,\/]+/).filter(Boolean);
    const targets = (y) => uniq(E, s, [...P.hell].reverse().filter((z) => isAv(E, s, z) && (E.def(s, z).c || 0) <= 8 && E.name(s, z) !== E.name(s, y) && syOf(y).some((k) => syOf(z).includes(k))));
    const pool = P.av.filter((y) => targets(y).length && (!P.bot || Math.max(...targets(y).map((z) => worth(E, s, z))) > worth(E, s, y))).sort((a, b) => worth(E, s, a) - worth(E, s, b) || (x && a.i === x.i ? 1 : 0));
    const sac = c.choose(pool, 1, "พระพรหม: เซ่นไหว้ Avatar ฝ่ายเรา 1 ใบ เพื่ออัญเชิญ Avatar Symbol เดียวกันจากนรก (ไม่ใช้ก็ได้)", { optional: true })[0]; if (!sac) return { explain: pool.length || P.av.some((y) => targets(y).length) ? "ไม่ใช้ความสามารถ" : "ไม่มี Avatar ในนรกที่ตรงเงื่อนไข", ops: [] };
    const t = c.choose(targets(sac).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar จากนรก (Symbol เดียวกับ ${E.name(s, sac)}, Cost ไม่เกิน 8)`, { exact: true })[0];
    return t ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · อัญเชิญ ${E.name(s, t)} จากนรกแบบจุติ`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "put", i: t.i, jt: true }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // เอเลี่ยนแสงสีฟ้า: จุติ: discard 1, choose an opposing Avatar: coin flip — heads destroys it, tails destroys this card
  "BT02-015": { summon: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const tgt = s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a));
    if (!tgt.length || !P.hand.length || !x) return { explain: "ไม่มีเป้าหมายหรือไม่มีการ์ดบนมือให้ทิ้ง", ops: [] };
    const pay = c.choose([...P.hand].sort(cheapCard(E, s)), 1, "เอเลี่ยนแสงสีฟ้า: ทิ้งการ์ดบนมือ 1 ใบ เพื่อทอยเหรียญ (ไม่ใช้ก็ได้)", { optional: true })[0]; if (!pay) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
    const t = c.choose(tgt, 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
    return { explain: `ทิ้ง ${E.name(s, pay)} · ทอยเหรียญ: หัว ทำลาย ${E.name(s, t)} / ก้อย ทำลายใบนี้`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "roll", sides: 2, why: "เอเลี่ยนแสงสีฟ้า", cases: { 1: [{ op: "destroy", i: t.i, why: "ออกหัว" }], 2: [{ op: "destroy", i: x.i, why: "ออกก้อย" }] } }] }; } },
  // ฤษี โคบุตร: whenever a {ฤษี} Magic is used: one Avatar on the field POWER +1
  "BT02-016": { magicSeenOk: (E, s, y, Ly, d) => Ly.z === "av" && String(d.sy || "").includes("ฤษี"),
    magicSeen: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "ฤษี โคบุตร: เลือก Avatar บนสนาม POWER +1")[0]; return t ? { explain: `${E.name(s, t)} POWER +1`, ops: [{ op: "power", i: t.i, n: 1, temp: false }] } : { explain: "ไม่มี Avatar", ops: [] }; } },
  // กัปตัน ไกร: จุติ: discard the whole hand, choose an opposing Avatar: it returns to its owner's hand
  "BT02-021": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const tgt = s.P[1 - p].av.filter((y) => !y.tok && !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)); if (!tgt.length) return { explain: "ไม่มีเป้าหมาย", ops: [] };
    const handVal = P.hand.reduce((a, y) => a + worth(E, s, y), 0); const use = !P.bot || worth(E, s, tgt[0]) >= Math.max(5, handVal * 0.6);
    const t = c.choose(use ? tgt : [], 1, `กัปตัน ไกร: ทิ้งการ์ดทั้งหมดบนมือ (${P.hand.length} ใบ) แล้วเลือก Avatar ฝ่ายตรงข้ามกลับขึ้นมือ (ไม่ใช้ก็ได้)`, { optional: true })[0];
    return t ? { explain: `ทิ้งการ์ดทั้งมือ ${P.hand.length} ใบ · ${E.name(s, t)} กลับขึ้นมือ`, ops: [...(P.hand.length ? [{ op: "discard", seat: p, iids: P.hand.map((y) => y.i) }] : []), { op: "move", i: t.i, to: "hand" }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // 40ดีกรีแมน: when it attacks, the opponent chooses the attack target
  "BT02-023": { attack: (c) => ({ explain: "ฝ่ายตรงข้ามเป็นผู้เลือกเป้าหมายการโจมตี", ops: [{ op: "resume", t: { i: c.t.i, c: c.t.c, when: "pickTarget", seat: 1 - c.seat } }] }),
    pickTarget: (c) => { const { E, s, seat: q } = c; const pd = s.pend; const A = pd ? E.locate(s, pd.att) : null; if (!A) return { explain: "ไม่มีการโจมตีแล้ว", ops: [] }; const ap = E.power(s, A.x) + (pd.bonus || 0); const O = s.P[q];
      const opts = [...O.av.filter((y) => !E.atkSafe(s, y)), ...O.cs]; const life = !O.av.length || E.kw(s, A.x, "เตะไข่");
      const best = [...opts].sort((a, b) => (E.power(s, b) >= ap) - (E.power(s, a) >= ap) || worth(E, s, a) - worth(E, s, b));
      const t = c.choose(best, 1, "40ดีกรีแมนโจมตี: คุณเป็นผู้เลือกเป้าหมายการโจมตี", { optional: life })[0];
      if (!t) return life ? { explain: "เลือกให้โจมตี LIFE", ops: [{ op: "redirect", life: true }] } : { explain: "ไม่มีเป้าหมายอื่น", ops: [] };
      return t.i === pd.ti ? { explain: `เลือก ${E.name(s, t)} (เป้าหมายเดิม)`, ops: [] } : { explain: `เลือกให้โจมตี ${E.name(s, t)}`, ops: [{ op: "redirect", i: t.i }] }; } },
  // เสามงคล: cannot attack (read from the text) · draws 1 more card after the normal draw
  "BT02-024": { drawMore: 1 },
  // ชุ่ย โจรสุสาน: จุติ: each player chooses 5 cards from the other's hell; they go back to their owners' Decks, which are shuffled
  "BT02-026": { summon: (c) => { const { E, s, seat: p } = c; const theirs = c.choose([...s.P[1 - p].hell].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 5, "เลือกการ์ดในนรกฝ่ายตรงข้าม 5 ใบ กลับเข้า Deck ของเขา", { exact: s.P[1 - p].hell.length >= 5 });
    const ours = [...s.P[p].hell].sort((a, b) => worth(E, s, b) - worth(E, s, a)).slice(0, 5); // the opponent takes our best ones
    return { explain: `นรกฝ่ายตรงข้าม ${theirs.length} ใบ และนรกเรา ${ours.length} ใบ กลับเข้า Deck เจ้าของ แล้วสับ`, ops: [...[...theirs, ...ours].map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "shuffle", seat: p }, { op: "shuffle", seat: 1 - p }] }; } },
  // พยาบาล เอ๋: survives being attacked: turn one of our face-up LIFE cards face down
  "BT02-027": { survived: (c) => (c.s.P[c.seat].life.some((y) => y.up) && !c.E.critical(c.s.P[c.seat]) ? { explain: "ไม่ถูกทำลายจากการถูกโจมตี: คว่ำ LIFE เรา 1 ใบ", ops: [{ op: "lifeFlip", seat: c.seat, up: false }] } : { explain: "ไม่มี LIFE ที่คว่ำได้", ops: [] }) },
  // สตีฟ Tank Ranger: rides a รถถัง (POWER +2); in the Battle Phase that รถถัง must attack if it can
  "BT02-028": { activate: rideTank, worn: (E, s, m, host) => (E.named(s, host, "รถถัง") ? 2 : 0), hostMust: true },
  // ช่วยโลกใบนี้ไว้: flip all our LIFE: this turn the {เปรต} Avatars we summon ignore card abilities and get เตะไข่ that cannot be stopped by โล่มนุษย์
  "BT02-041": { canCast: (E, s, p) => s.P[p].life.some((y) => !y.up),
    cast: (c) => { const { s, seat: p } = c; const n = s.P[p].life.filter((y) => !y.up).length; return { explain: `หงาย LIFE เรา ${n} ใบ · เทิร์นนี้ Avatar {เปรต} ที่อัญเชิญได้รับ ไม่รับผลความสามารถ และ เตะไข่ (ห้ามใช้โล่มนุษย์)`,
      ops: [...Array.from({ length: n }, () => ({ op: "lifeFlip", seat: p })), { op: "turnBuff", seat: p, sy: "เปรต", imm: true, kw: ["เตะไข่"], noShield: true, why: "เทิร์นนี้ Avatar {เปรต} ที่อัญเชิญจะไม่รับผลความสามารถ และได้รับเตะไข่" }] }; } },
  // ประชามติ: all our Avatars go to sleep; destroy an Avatar whose POWER is below the total POWER of the sleeping Avatars
  "BT02-042": { cast: (c) => { const { E, s, seat: p } = c; const asleep = [...s.P[p].av, ...s.P[1 - p].av.filter((y) => !y.a)]; const sum = asleep.reduce((a, y) => a + E.power(s, y), 0);
    const pool = [...s.P[1 - p].av.filter((y) => !E.noAim(s, y)), ...s.P[p].av].filter((y) => E.power(s, y) < sum).sort((a, b) => (b.o !== p) - (a.o !== p) || worth(E, s, b) - worth(E, s, a));
    const t = c.choose(pool, 1, `เลือก Avatar ที่ POWER ต่ำกว่า ${sum} ที่จะทำลาย`, { exact: true })[0];
    return { explain: `Avatar เราทุกใบนอน (POWER รวมที่นอน ${sum})${t ? ` · ทำลาย ${E.name(s, t)}` : ""}`, ops: [...s.P[p].av.filter((y) => y.a).map((y) => ({ op: "wake", i: y.i, v: false })), ...(t ? [{ op: "destroy", i: t.i, why: "ประชามติ" }] : [])] }; } },
  // ฉุบสั่งตาย: rock-paper-scissors (a coin here): the winner destroys an Avatar on the field
  "BT02-043": { cast: (c) => { const { E, s, seat: p } = c; const ours = s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)); const mine = [...s.P[p].av].sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
    const t = c.choose(ours, 1, "ถ้าเราชนะเป่ายิ้งฉุบ: เลือก Avatar ที่จะทำลาย")[0];
    return { explain: "เป่ายิ้งฉุบ (ใช้ทอยเหรียญแทน: หัว = เราชนะ)", ops: [{ op: "roll", sides: 2, why: "เป่ายิ้งฉุบ", cases: { 1: t ? [{ op: "destroy", i: t.i, why: "แพ้เป่ายิ้งฉุบ" }] : [], 2: mine ? [{ op: "destroy", i: mine.i, why: "ฝ่ายตรงข้ามชนะเป่ายิ้งฉุบ" }] : [] } }] }; } },
  // ด่านลอย: name a Cost 0-9: a random card from the opponent's hand; an Avatar of that Cost goes to hell
  "BT02-044": { cast: (c) => { const v = c.mode(["Cost 0", "Cost 1", "Cost 2", "Cost 3", "Cost 4", "Cost 5", "Cost 6", "Cost 7", "Cost 8", "Cost 9"], "ด่านลอย: เลือกค่า Cost", 3);
    return { explain: `เลือก Cost ${v} · สุ่มการ์ดบนมือฝ่ายตรงข้าม 1 ใบ`, ops: [{ op: "randomHand", seat: 1 - c.seat, cost: v }] }; } },
  // ความกล้าหาญ: one Avatar of ours POWER +4, destroyed in the End Phase
  "BT02-045": { canCast: (E, s, p) => s.P[p].av.length > 0, cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา POWER +4 (จะถูกทำลายใน End Phase)", { exact: true })[0];
    return t ? { explain: `${E.name(s, t)} POWER +4 · ถูกทำลายในตอน End Phase`, ops: [{ op: "power", i: t.i, n: 4, temp: true }, { op: "atEnd", turn: s.turn, ops: [{ op: "destroy", i: t.i, why: "ความกล้าหาญ" }], why: `${E.name(s, t)} ถูกทำลาย (ความกล้าหาญ)` }] } : { explain: "ไม่มี Avatar", ops: [] }; } },
  // แมลงปอทอด: sacrifice a {แมลง}: draw 3; this turn only {แมลง} Avatars may attack
  "BT02-047": { canCast: (E, s, p) => s.P[p].av.some((y) => sy(E, s, y, "แมลง")),
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => sy(E, s, y, "แมลง")).sort(cheapCard(E, s)), 1, "เซ่นไหว้ Avatar {แมลง} 1 ใบ", { exact: true })[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, t)} · จั่ว 3 ใบ · เทิร์นนี้โจมตีได้แค่ Avatar {แมลง}`, ops: [{ op: "destroy", i: t.i, why: "เซ่นไหว้" }, { op: "draw", seat: p, n: 3 }, { op: "turnLock", seat: p, atkSy: "แมลง" }] } : { explain: "ไม่มี Avatar {แมลง}", ops: [] }; } },
  // เคี้ยวเพื่อนเธอซะ (React, when an Avatar is summoned): sacrifice any number of ours, summon Avatars from the hand whose total Cost fits the GEM of those sacrificed
  "BT02-050": { react: { kinds: ["summon"], can: (E, s, p) => !s.P[p].bot && s.P[p].av.length > 0 && s.P[p].hand.some((y) => isAv(E, s, y)) }, // players only: the bot cannot weigh this trade
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const gem = (y) => E.def(s, y).g || 0; const cost = (y) => E.def(s, y).c || 0;
      const sac = c.choose([...P.av].sort((a, b) => gem(b) - gem(a) || worth(E, s, a) - worth(E, s, b)), P.av.length, "เซ่นไหว้ Avatar ฝ่ายเรากี่ใบก็ได้ (GEM รวมใช้อัญเชิญจากมือ)", { optional: true });
      let budget = sac.reduce((a, y) => a + gem(y), 0); let room = 4 - Math.max(0, E.avatars(P) - sac.filter((y) => !y.tok).length); const got = [];
      while (room > 0) { const t = c.choose(P.hand.filter((y) => isAv(E, s, y) && !got.includes(y) && cost(y) <= budget).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `อัญเชิญ Avatar จากมือ (GEM เหลือ ${budget})`, { optional: true })[0]; if (!t) break; got.push(t); budget -= cost(t); room--; }
      return { explain: `เซ่นไหว้ ${sac.length} ใบ · อัญเชิญ ${got.map((y) => E.name(s, y)).join(", ") || "ไม่มี"}`, ops: [...sac.map((y) => ({ op: "destroy", i: y.i, why: "เซ่นไหว้" })), ...got.map((y) => ({ op: "put", i: y.i }))] }; } },
  // ถวาย (React): our Avatar would be destroyed in this fight: discard the whole hand: it is not destroyed
  "BT02-051": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; const A = E.locate(s, on.att); return !!(T && A && T.p === p && E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) >= E.power(s, T.x)); } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const T = on.ti != null ? E.locate(s, on.ti) : null; if (!T) return { explain: "Avatar ใบนั้นไม่อยู่แล้ว", ops: [] }; const hand = s.P[p].hand.filter((y) => y.i !== c.t.i);
      return { explain: `ทิ้งการ์ดทั้งมือ ${hand.length} ใบ · ${E.name(s, T.x)} จะไม่ถูกทำลาย`, ops: [...(hand.length ? [{ op: "discard", seat: p, iids: hand.map((y) => y.i) }] : []), { op: "guard", i: T.x.i }] }; } },
  // ประกันชั้นต่ำ: the wearer survives one attack; after it is attacked this card goes to hell
  "BT02-055": { worn: () => 0, atkShield: true },
  // ขวานเงิน: POWER +2 and the wearer's abilities have no effect while it wears this card
  "BT02-056": { worn: () => 2, cast: (c) => (c.t.on != null && c.E.locate(c.s, c.t.on) ? { explain: "Avatar ที่สวมใส่ POWER +2 และความสามารถไร้ผล", ops: [{ op: "mute", i: c.t.on, by: c.t.i }] } : { explain: "ไม่มี Avatar ที่สวมใส่", ops: [] }) },
  // ช็อตกัน นัยนาวุธ: when the wearer destroys an Avatar in a fight: flip the opponent's top LIFE card
  "BT02-057": { worn: () => 0, hostWin: (c) => (c.E.critical(c.s.P[1 - c.seat]) ? { explain: "LIFE ฝ่ายตรงข้ามหงายหมดแล้ว", ops: [] } : { explain: "หงาย LIFE Card ใบบนสุดของฝ่ายตรงข้าม", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] }) },
  // ประตูนรก (Land): once per turn, discard a {นรก} Avatar: summon "นายนิรยบาล" of Cost 4 or less from our hell
  "BT02-058": { activate: { label: "ทิ้ง Avatar {นรก} จากมือ: อัญเชิญนายนิรยบาล Cost ไม่เกิน 4 จากนรก", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.some((y) => isAv(E, s, y) && sy(E, s, y, "นรก")) && s.P[L.p].hell.some((y) => hellLord(E, s, y) && (E.def(s, y).c || 0) <= 4),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const t = c.choose(uniq(E, s, [...P.hell].reverse().filter((y) => hellLord(E, s, y) && (E.def(s, y).c || 0) <= 4)).sort(strongFirst(E, s)), 1, "เลือกนายนิรยบาล Cost ไม่เกิน 4 ในนรก", { exact: true })[0];
      const pay = t ? c.choose(P.hand.filter((y) => isAv(E, s, y) && sy(E, s, y, "นรก")).sort(cheapCard(E, s)), 1, "ทิ้ง Avatar {นรก} จากมือ 1 ใบ", { exact: true })[0] : null;
      return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; } } },
});
SCRIPTS["BT02-010"] = SCRIPTS["KD03-007"]; // โอตะ รุ่นก่อตั้ง (same card, older print)

// ---------- BT03 ----------
const braveRobot = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "หุ่นยนต์") && E.named(s, x, "ผู้กล้า");
const braveWeapon = (E, s, x) => E.def(s, x).t === "M" && E.named(s, x, "อาวุธหุ่นนักรบผู้กล้า");
const KING = "ราชาอาณาจักรของแพง";
const destroyAtTarget = (k) => ({ attackOk: (E, s) => { const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return !!T && sy(E, s, T.x, k); },
  attack: (c) => { const { E, s } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return T && T.z === "av" ? { explain: `โจมตี Avatar {${k}}: ทำลาย ${E.name(s, T.x)}`, ops: [{ op: "destroy", i: T.x.i, why: "ความสามารถของผู้โจมตี" }] } : { explain: "เป้าหมายไม่อยู่แล้ว", ops: [] }; } });
const foeOf = (E, s, x) => { const pd = s.pend; if (!pd) return null; const id = pd.att === x.i ? pd.ti : pd.ti === x.i ? pd.att : null; const L = id != null ? E.locate(s, id) : null; return L && L.z === "av" ? L.x : null; };
Object.assign(SCRIPTS, {
  // นางอัปสร: counts as "พระนารายณ์" (read from the text) · when it attacks the opponent cannot use React Magic until the fight ends
  "BT03-002": { attack: () => ({ explain: "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้", ops: [{ op: "noReact" }] }) },
  // อินทรีย์แมน: จุติ: a Modification from our Deck is worn by it, then shuffle · POWER +1 for every Modification on the field
  "BT03-003": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "ไม่อยู่บนสนาม", ops: [] };
      const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => E.def(s, y).t === "M" && E.def(s, y).st === "D" && E.modOk(s, y, x))).sort((a, b) => (modBonusOf(E, s, b) - modBonusOf(E, s, a))), 1, "เลือก Modification Magic จาก Deck มาสวมให้ใบนี้")[0];
      return { explain: t ? `${E.name(s, t)} จาก Deck สวมใส่ให้ ${E.name(s, x)} แล้วสับ Deck` : "ไม่มี Modification ใน Deck", ops: [...(t ? [{ op: "attach", i: t.i, on: x.i }] : []), { op: "shuffle", seat: p }] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on != null && E.def(s, m).st === "D").length }] : []) },
  // หุ่นนักรบผู้กล้า : ไมเกรน: จุติ scout 5: a "อาวุธหุ่นนักรบผู้กล้า" to the hand, the rest to the bottom · once per turn when such a weapon is used: draw 1
  "BT03-004": { summon: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 5); if (!top.length) return { explain: "Deck หมด", ops: [] };
      const t = c.choose(top.filter((y) => braveWeapon(E, s, y)), 1, "เลือก อาวุธหุ่นนักรบผู้กล้า จากที่สอดแนมขึ้นมือ", { reveal: top.map((y) => y.i) })[0];
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : " · ไม่มีอาวุธหุ่นนักรบผู้กล้า"} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), { op: "scoutRest", seat: p, ids: top.filter((y) => y !== t).map((y) => y.i), rest: "bottom" }] }; },
    magicSeenOk: (E, s, y, Ly, d) => Ly.z === "av" && y.used !== s.turn && d.st === "D" && String(d.n || "").includes("อาวุธหุ่นนักรบผู้กล้า"),
    magicSeen: (c) => (c.self && c.self.used !== c.s.turn ? { explain: "มีการใช้อาวุธหุ่นนักรบผู้กล้า: จั่ว 1 ใบ", ops: [{ op: "used", i: c.self.i }, { op: "draw", seat: c.seat, n: 1 }] } : { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] }) },
  // โดรนสอดแนมผู้กล้า : เก๊าท์: จุติ with another {หุ่นยนต์} "ผู้กล้า" of ours: look at the opponent's top card: an Avatar goes to hell, anything else to the bottom
  "BT03-005": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!s.P[p].av.some((y) => (!x || y.i !== x.i) && braveRobot(E, s, y))) return { explain: "ไม่มี Avatar {หุ่นยนต์} ผู้กล้าใบอื่นบน Avatar Zone", ops: [] };
    const top = s.P[1 - p].deck[0]; if (!top) return { explain: "Deck ฝ่ายตรงข้ามหมด", ops: [] }; const av = isAv(E, s, top);
    return { explain: `สอดแนม Deck ฝ่ายตรงข้าม: ${E.name(s, top)} ${av ? "เป็น Avatar ลงนรก" : "ไม่ใช่ Avatar ไว้ใต้ Deck"}`, ops: [{ op: "scoutShow", seat: 1 - p, ids: [top.i] }, av ? { op: "move", i: top.i, to: "hell" } : { op: "move", i: top.i, to: "deckBottom" }] }; } },
  // อากาศยานผู้กล้า : แอร์ซิด รีฟลักซ์: may be destroyed instead of our "หุ่นนักรบผู้กล้า"
  "BT03-007": { saveOther: (E, s, y, Ly, x, L) => (Ly.z === "av" && L.z === "av" && x.i !== y.i && E.named(s, x, "หุ่นนักรบผู้กล้า") ? { why: `${E.name(s, y)} ถูกทำลายแทน ${E.name(s, x)}`, ops: [{ op: "destroy", i: y.i, why: "ทำลายแทน", noSave: true }] } : null) },
  // กาฬสินธุ์แมน: destroys an opposing Avatar in a fight: POWER +1
  "BT03-008": { win: (c) => (c.self ? { explain: "ชนะการต่อสู้: POWER +1", ops: [{ op: "power", i: c.self.i, n: 1, temp: false }] } : { explain: "ไม่อยู่บนสนาม", ops: [] }) },
  // มนุษย์รัททาทุย: POWER +1 for each {รัททาทุย} Avatar on our side
  "BT03-017": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: s.P[L.p].av.filter((y) => sy(E, s, y, "รัททาทุย")).length }] : []) },
  // จ่างู: attacking a {หุ่นยนต์} destroys it
  "BT03-018": destroyAtTarget("หุ่นยนต์"),
  // แดรกคูลา: จุติ: when it is destroyed, it comes back from hell in the Battle Phase of our next turn
  "BT03-020": { summon: (c) => (c.self ? { explain: "ได้รับ: เมื่อถูกทำลาย จะกลับจากนรกใน Battle Phase ของเทิร์นถัดไปของเรา", ops: [{ op: "flag", i: c.self.i, k: "drac" }] } : { explain: "ไม่อยู่บนสนาม", ops: [] }),
    deathOk: (E, s, x) => !!x.drac,
    death: (c) => { const { s, self: x } = c; if (!x || !x.drac) return { explain: "ไม่มีความสามารถที่ได้รับ", ops: [] }; return { explain: "จะกลับจากนรกใน Battle Phase ของเทิร์นถัดไปของเรา", ops: [{ op: "flag", i: x.i, k: "drac", off: true }, { op: "later", seat: c.seat, at: "battle", ops: [{ op: "put", i: x.i }], why: "แดรกคูลากลับจากนรก" }] }; } },
  // อีแป๋ม ผีกระสือ RGB: คำสั่งเสีย: worn by an opposing Avatar, which becomes {ผี} with POWER -2
  "BT03-021": { worn: () => -2, syOver: "ผี",
    death: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่อีแป๋มจะไปสวมใส่")[0];
      return t ? { explain: `อีแป๋มสวมใส่ให้ ${E.name(s, t)}: Symbol เป็น {ผี} และ POWER -2`, ops: [{ op: "attach", i: c.t.i, on: t.i }] } : { explain: "ฝ่ายตรงข้ามไม่มี Avatar", ops: [] }; } },
  // แม่นาค พระประแดง: when summoned: a card from the opponent's hell to the bottom of their Deck; then an opposing Avatar POWER -2
  "BT03-022": { summon: (c) => maeNak(c), byOk: () => true, summonedBy: (c) => maeNak(c) },
  // ฮามดัล: while on the Avatar Zone the top card of both Decks is face up
  "BT03-025": { openDeck: true },
  // แมลงปอมีพิษ: คำสั่งเสีย: destroy an Avatar of Cost 4 or less on the field
  "BT03-027": { death: (c) => { const { E, s, seat: p } = c; const pool = [...s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...[...s.P[p].av].sort(cheapCard(E, s))].filter((y) => E.costNow(s, y) <= 4);
    const t = c.choose(pool, 1, "เลือก Avatar Cost 4 หรือต่ำกว่าบนสนามที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "คำสั่งเสียของแมลงปอมีพิษ" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // พระเจ้านิโคไล: not destroyed in fights with Avatars of lower Cost
  "BT03-028": { fightImmune: (E, s, x, foe) => E.costNow(s, foe) < E.costNow(s, x) },
  // ทหารอาณาจักรของแพง: opposing Avatars Cost -1 · POWER 2 while the King is on our Avatar Zone
  "BT03-029": { costAura: (E, s, y, Ly, x, L) => (Ly.z === "av" && L.z === "av" && L.p !== Ly.p ? -1 : 0), aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.some((y) => E.named(s, y, KING)) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 2 }] : []) },
  // ช่างตัดเสื้อ: จุติ: our King gets Cost +1 and POWER +1
  "BT03-030": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => E.named(s, y, KING)), 1, "เลือกราชาอาณาจักรของแพงบน Avatar Zone เรา")[0];
    return t ? { explain: `${E.name(s, t)} Cost +1 และ POWER +1`, ops: [{ op: "costUp", i: t.i, n: 1 }, { op: "power", i: t.i, n: 1, temp: false }] } : { explain: "ไม่มีราชาอาณาจักรของแพงบน Avatar Zone เรา", ops: [] }; } },
  // จอมเวทย์ดอคู่: once per turn: destroy a Modification Magic on a Magic Zone
  "BT03-031": { activate: { label: "ทำลาย Modification Magic บนสนาม 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on != null && E.def(s, m).st === "D"),
    run: (c) => { const { E, s, seat: p } = c; const mods = [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on != null && E.def(s, m).st === "D"); const host = (m) => E.locate(s, m.on);
      const t = c.choose(mods.sort((a, b) => ((host(b) || {}).p !== p) - ((host(a) || {}).p !== p)), 1, "เลือก Modification Magic ที่จะทำลาย", { exact: true })[0];
      return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "จอมเวทย์ดอคู่" }] } : { explain: "ไม่มี Modification", ops: [] }; } } },
  // ตั๊กแตนพันธ์ุ X: counts as {แมลง} (read from the text) · POWER +1 for each {แมลง} Avatar on our Avatar Zone
  "BT03-032": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: s.P[L.p].av.filter((y) => sy(E, s, y, "แมลง")).length }] : []) },
  // แมลงปอ บรรพบุรุษ: คำสั่งเสีย: a {แมลง} Avatar of Cost 4 or less with another name from our hell, summoned with จุติ
  "BT03-033": { death: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter((y) => isAv(E, s, y) && sy(E, s, y, "แมลง") && (E.def(s, y).c || 0) <= 4 && !E.named(s, y, "แมลงปอ บรรพบุรุษ"))).sort(strongFirst(E, s)), 1, "เลือก Avatar {แมลง} Cost ไม่เกิน 4 จากนรกที่จะอัญเชิญแบบจุติ")[0];
    return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรกแบบจุติ`, ops: [{ op: "put", i: t.i, jt: true }] } : { explain: t ? "Avatar Zone เต็ม" : "ไม่มี Avatar {แมลง} ที่ตรงเงื่อนไขในนรก", ops: [] }; } },
  // พาลี (BT03): when it fights: the other Avatar POWER -2 and this one +2 until the fight ends
  "BT03-034": { fight: (c) => { const { E, s, self: x } = c; const f = x ? foeOf(E, s, x) : null; return x ? { explain: `ต่อสู้: ${f ? E.name(s, f) + " POWER -2 · " : ""}${E.name(s, x)} POWER +2 จนจบการต่อสู้`, ops: [...(f ? [{ op: "power", i: f.i, n: -2, temp: "fight" }] : []), { op: "power", i: x.i, n: 2, temp: "fight" }] } : { explain: "ไม่อยู่บนสนาม", ops: [] }; } },
  // เก็บค่าคุ้มครอง: with a Land face up on the Land zone, discard 1: draw 2
  "BT03-041": { canCast: (E, s, p) => !!s.land && s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
    return t ? { explain: `ทิ้ง ${E.name(s, t)} · จั่ว 2 ใบ`, ops: [{ op: "discard", seat: p, iids: [t.i] }, { op: "draw", seat: p, n: 2 }] } : { explain: "ไม่มีการ์ดบนมือให้ทิ้ง", ops: [] }; } },
  // ผมขอค้าน !!: name a Symbol: a random card from the opponent's hand; an Avatar of that Symbol is discarded
  "BT03-043": { cast: (c) => { const k = c.mode(SYMBOLS, "ผมขอค้าน !!: ประกาศ Symbol", 0); return { explain: `ประกาศ {${SYMBOLS[k]}} · สุ่มการ์ดบนมือฝ่ายตรงข้าม 1 ใบ`, ops: [{ op: "randomHand", seat: 1 - c.seat, sy: SYMBOLS[k] }] }; } },
  // เยี่ยวรดศาล: with a {คน} Avatar of Cost 3+ of ours: a {ผี} Avatar of Cost 4 or less from the Deck, summoned with จุติ, then shuffle
  "BT03-044": { canCast: (E, s, p) => s.P[p].av.some((y) => sy(E, s, y, "คน") && E.costNow(s, y) >= 3) && E.avatars(s.P[p]) < 4,
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "ผี") && (E.def(s, y).c || 0) <= 4)).sort(strongFirst(E, s)), 1, "เลือก Avatar {ผี} Cost ไม่เกิน 4 จาก Deck ที่จะอัญเชิญแบบจุติ")[0];
      return { explain: t ? `อัญเชิญ ${E.name(s, t)} แบบจุติ แล้วสับ Deck` : "ไม่มี Avatar {ผี} ที่ตรงเงื่อนไขใน Deck", ops: [...(t ? [{ op: "put", i: t.i, jt: true }] : []), { op: "shuffle", seat: p }] }; } },
  // ซุปเปอร์สแน็ค !!: a {สัตว์} Avatar POWER +6, destroyed in the End Phase
  "BT03-045": { canCast: (E, s, p) => [...s.P[0].av, ...s.P[1].av].some((y) => syIs(E, s, y, "สัตว์")),
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av, ...s.P[1 - p].av.filter((y) => !E.noAim(s, y))].filter((y) => syIs(E, s, y, "สัตว์")), 1, "เลือก Avatar {สัตว์} POWER +6 (ถูกทำลายใน End Phase)", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} POWER +6 · ถูกทำลายใน End Phase`, ops: [{ op: "power", i: t.i, n: 6, temp: true }, { op: "atEnd", turn: s.turn, ops: [{ op: "destroy", i: t.i, why: "ซุปเปอร์สแน็ค" }], why: `${E.name(s, t)} ถูกทำลาย (ซุปเปอร์สแน็ค)` }] } : { explain: "ไม่มี Avatar {สัตว์}", ops: [] }; } },
  // จมน้ำ: each player puts one of its own Avatars at the bottom of its Deck (the opponent picks its cheapest)
  "BT03-046": { cast: (c) => { const { E, s, seat: p } = c; const mine = c.choose([...s.P[p].av].sort(cheapCard(E, s)), 1, "เลือก Avatar ฝ่ายเรา 1 ใบ กลับเข้าใต้ Deck", { exact: true })[0]; const theirs = [...s.P[1 - p].av].sort(cheapCard(E, s))[0];
    return { explain: `${mine ? E.name(s, mine) : "-"} และ ${theirs ? E.name(s, theirs) : "-"} กลับเข้าใต้ Deck เจ้าของ`, ops: [...(mine ? [{ op: "move", i: mine.i, to: "deckBottom" }] : []), ...(theirs ? [{ op: "move", i: theirs.i, to: "deckBottom" }] : [])] }; } },
  // เอาเสื้อมาหมุนๆแล้วตบ (React): a hand card back into the Deck, shuffle: destroy an opposing {แมลง} Avatar
  "BT03-048": { react: { kinds: ["attack", "summon", "cast", "destroyed"], can: (E, s, p) => s.P[1 - p].av.some((y) => sy(E, s, y, "แมลง") && !E.noAim(s, y)) && s.P[p].hand.length >= 2 },
    cast: (c) => { const { E, s, seat: p } = c; const back = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "นำการ์ดบนมือ 1 ใบกลับเข้า Deck", { exact: true })[0]; const t = c.choose(s.P[1 - p].av.filter((y) => sy(E, s, y, "แมลง") && !E.noAim(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar {แมลง} ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
      return back && t ? { explain: `${E.name(s, back)} กลับเข้า Deck แล้วสับ · ทำลาย ${E.name(s, t)}`, ops: [{ op: "move", i: back.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "destroy", i: t.i, why: "เอาเสื้อมาหมุนๆแล้วตบ" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // คว้าปืนมายิงหมี (React): our Avatar is in a fight: a Modification from our hell to the hand, and the other Avatar POWER -1
  "BT03-049": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return !!T && T.p === p && s.P[p].hell.some((y) => E.def(s, y).st === "D"); } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const A = E.locate(s, on.att); const m = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter((y) => E.def(s, y).st === "D")), 1, "เลือก Modification Magic ในนรกขึ้นมือ", { exact: true })[0];
      return { explain: `${m ? E.name(s, m) + " ขึ้นมือ · " : ""}${A ? E.name(s, A.x) + " POWER -1" : ""}`, ops: [...(m ? [{ op: "move", i: m.i, to: "hand" }] : []), ...(A ? [{ op: "power", i: A.x.i, n: -1, temp: true }] : [])] }; } },
  // อีโบล่า ซอร์ด: worn only by {หุ่นยนต์} · +1, or +3 on "หุ่นนักรบผู้กล้า"
  "BT03-051": { modOnly: (E, s, host) => sy(E, s, host, "หุ่นยนต์"), worn: (E, s, m, host) => (E.named(s, host, "หุ่นนักรบผู้กล้า") ? 3 : 1) },
  // แผนการ : แกงส้มตะปูเสียบ: the wearer POWER -2; at POWER 0 it is destroyed
  "BT03-052": { worn: () => -2, check: (E, s, m, L) => { if (L.z !== "mg" || m.on == null) return []; const H = E.locate(s, m.on); return H && H.z === "av" && E.power(s, H.x) === 0 ? [{ op: "destroy", i: H.x.i, why: "POWER เป็น 0 (แกงส้มตะปูเสียบ)" }] : []; } },
  // ยาแก้ไอน้ำดำ: the wearer's POWER cannot be lowered; reductions it already had turn into increases
  "BT03-053": { worn: () => 0, noLower: true, cast: (c) => (c.t.on != null ? { explain: "POWER ที่ถูกลดไปกลายเป็นเพิ่ม และจะไม่ถูกลด POWER อีก", ops: [{ op: "powerFlip", i: c.t.on }] } : { explain: "ไม่มี Avatar ที่สวมใส่", ops: [] }) },
  // ขวานไม้เน่าๆเหม็นๆ: the wearer's Cost -1
  "BT03-054": { worn: () => 0, wornCost: -1 },
  // ขวานทอง: when the wearer attacks, its controller draws 1
  "BT03-055": { worn: () => 0, hostAttack: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H ? { explain: "Avatar ที่สวมใส่โจมตี: จั่ว 1 ใบ", ops: [{ op: "draw", seat: H.p, n: 1 }] } : { explain: "ไม่ได้สวมใส่อยู่", ops: [] }; } },
  // สายฟ้า วัชระ: when the wearer attacks, the Avatar it fights is destroyed
  "BT03-056": { worn: () => 0, hostAttack: (c) => { const { E, s } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return T && T.z === "av" ? { explain: `สายฟ้า วัชระ: ทำลาย ${E.name(s, T.x)}`, ops: [{ op: "destroy", i: T.x.i, why: "สายฟ้า วัชระ" }] } : { explain: "ไม่ได้โจมตี Avatar", ops: [] }; } },
  // อาณาจักรของแพง (Land): while the opponent's Avatars total Cost 4 or less, discard 1: the King from our Deck to the hand
  "BT03-057": { activate: { label: `ทิ้งการ์ด 1 ใบ: นำ${KING}จาก Deck ขึ้นมือ`, can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[1 - L.p].av.reduce((a, y) => a + E.costNow(s, y), 0) <= 4 && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => E.named(s, y, KING)),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const k = s.P[p].deck.find((y) => E.named(s, y, KING));
      return pay && k ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, k)} จาก Deck ขึ้นมือ แล้วสับ Deck`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "search", seat: p, take: k.i, to: "hand" }] } : { explain: "ไม่มีการ์ดให้ทิ้งหรือไม่มีราชาใน Deck", ops: [] }; } } },
  // ราชธานีสามัคคี (Land): once per turn, an Avatar gains สามัคคี until end of turn
  "BT03-059": { activate: { label: "Avatar 1 ใบได้รับ สามัคคี จนจบเทิร์น", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].av.some((y) => !E.kw(s, y, "สามัคคี")),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => !E.kw(s, y, "สามัคคี")).sort(strongFirst(E, s)), 1, "เลือก Avatar ที่จะได้รับสามัคคีจนจบเทิร์น", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} ได้รับ สามัคคี จนจบเทิร์น`, ops: [{ op: "keyword", i: t.i, k: "สามัคคี", until: "turn" }] } : { explain: "ไม่มี Avatar", ops: [] }; } } },
  // ปราสาทแดรก (Land): แดรกคูลา POWER +1 · once per turn, discard 1: a แดรกคูลา from our hell is summoned
  "BT03-060": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((q) => ({ seat: q, test: (x) => E.named(s, x, "แดรกคูลา"), n: 1 })) : []),
    activate: { label: "ทิ้งการ์ด 1 ใบ: อัญเชิญแดรกคูลาจากนรก", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "แดรกคูลา")),
      run: (c) => { const { E, s, seat: p } = c; const d = [...s.P[p].hell].reverse().find((y) => isAv(E, s, y) && E.named(s, y, "แดรกคูลา")); const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        return d && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, d)} จากนรก`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: d.i }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; } } },
});
function maeNak(c) { const { E, s, seat: p } = c; const h = c.choose([...s.P[1 - p].hell].reverse().sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดในนรกฝ่ายตรงข้ามกลับเข้าใต้ Deck ของเขา")[0]; if (!h) return { explain: "นรกฝ่ายตรงข้ามไม่มีการ์ด", ops: [] };
  const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้าม POWER -2")[0];
  return { explain: `${E.name(s, h)} กลับเข้าใต้ Deck ฝ่ายตรงข้าม${t ? ` · ${E.name(s, t)} POWER -2` : ""}`, ops: [{ op: "move", i: h.i, to: "deckBottom" }, ...(t ? [{ op: "power", i: t.i, n: -2, temp: false }] : [])] }; }
const modBonusOf = (E, s, m) => { const t = String(E.def(s, m).x || "").match(/POWER\s*\+\s*(\d+)/); return t ? +t[1] : 0; };
const SYMBOLS = ["คน", "จอมเวทย์", "เทพ", "ต่างชาติ", "สัตว์", "หุ่นยนต์", "นรก", "รัททาทุย", "สัตว์วิเศษ", "แมลง", "ยักษ์", "ผี", "ต้นไม้", "เอเลี่ยน", "ปลา", "ไซเบอร์", "ทหาร", "กะปอม", "ฤษี", "เปรต", "มังกร"];
SCRIPTS["BT03-014"] = SCRIPTS["KD03-008"]; // โอตะปุส (same card as the KD03 print)
SCRIPTS["BT03-015"] = SCRIPTS["SD08-010"]; // ตุ๊กตารัททาทุย (same card as the SD08 print)

// ---------- BT04 ----------
const TRUTH = "ผู้รู้ความจริง";
const truthAv = (E, s, x) => isAv(E, s, x) && E.named(s, x, TRUTH);
const oldMan = (E, s, x) => isAv(E, s, x) && E.named(s, x, "คนแก่สติเลอะเลือน");
// a scout by a "ผู้รู้ความจริง" Avatar: คนแก่สติเลอะเลือนผู้รู้ความจริง among the cards jumps onto our Avatar Zone
const truthSpill = (c, top, taken = []) => { const { E, s, seat: p } = c; const ops = [], say = []; let room = Math.max(0, Math.min(4 - E.avatars(s.P[p]), 6 - s.P[p].av.length));
  for (const y of top) if (!taken.includes(y) && oldMan(E, s, y) && room > 0) { ops.push({ op: "put", i: y.i }); say.push(`${E.name(s, y)} ถูกสอดแนม: อัญเชิญลงสนาม`); room--; } return { ops, say, used: top.filter((y) => ops.some((o) => o.i === y.i)) }; };
// leave the scouted cards on top or put them at the bottom (bots keep good ones on top)
const topOrBottom = (c, cards, label) => { if (!cards.length) return []; const { E, s, seat: p } = c; const good = cards.filter((y) => worth(E, s, y) >= 4).length * 2 >= cards.length;
  const m = c.mode([`วาง ${cards.length} ใบไว้บนสุดของ Deck`, `วาง ${cards.length} ใบไว้ใต้ Deck`], label, good ? 0 : 1); return [{ op: "scoutRest", seat: p, ids: cards.map((y) => y.i), rest: m === 0 ? "top" : "bottom" }]; };
const isPrime = (n) => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };
Object.assign(SCRIPTS, {
  // จอมหักกระดูก: โล่มนุษย์ · when it fights an opposing Avatar, that Avatar's POWER becomes its printed POWER until the fight ends
  "BT04-001": { fight: (c) => { const { E, s, self: x } = c; const f = x ? foeOf(E, s, x) : null; if (!f) return { explain: "ไม่ได้ต่อสู้กับ Avatar", ops: [] }; const base = E.def(s, f).pw || 0;
    return { explain: `${E.name(s, f)} POWER กลับเป็นค่าตั้งต้น ${base} จนจบการต่อสู้`, ops: [{ op: "setPower", i: f.i, v: base, temp: "fight" }] }; } },
  // ยายกบ 1954: not summoned by paying Cost; send a "กบ" of ours that got POWER increases 3+ times to hell: summon it from the hand with that POWER added
  "BT04-005": { noHand: true, activate: { label: "ส่งกบที่ได้รับผลเพิ่ม POWER 3 ครั้งขึ้นไปลงนรก แล้วอัญเชิญใบนี้", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && s.P[L.p].av.some((y) => E.named(s, y, "กบ") && (y.ups || 0) >= 3),
    run: (c) => { const { E, s, seat: p, self: x } = c; const f = c.choose(s.P[p].av.filter((y) => E.named(s, y, "กบ") && (y.ups || 0) >= 3).sort(strongFirst(E, s)), 1, "เลือกกบที่จะส่งลงนรก", { exact: true })[0]; if (!f || !x) return { explain: "ไม่มีกบที่ตรงเงื่อนไข", ops: [] }; const pw = E.power(s, f);
      return { explain: `ส่ง ${E.name(s, f)} (POWER ${pw}) ลงนรก · อัญเชิญ ${E.name(s, x)} POWER +${pw}`, ops: [{ op: "move", i: f.i, to: "hell" }, { op: "put", i: x.i }, { op: "power", i: x.i, n: pw, temp: false }] }; } } },
  // ราม และ วิโรจน์: once per turn: 1) POWER +2 until the opponent's next End Phase, or 2) with no Modification used this turn, one from our hell is worn by it (counts as using one)
  "BT04-007": { activate: { label: "เลือกปฏิบัติ: POWER +2 หรือสวมใส่ Modification จากนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main",
    run: (c) => { const { E, s, seat: p, self: x } = c; const mods = uniq(E, s, [...s.P[p].hell].reverse().filter((y) => E.def(s, y).st === "D" && E.modOk(s, y, x))); const can2 = !s.mu[p].D && mods.length > 0;
      const m = can2 ? c.mode(["1) POWER +2 จนถึง End Phase ต่อไปของฝ่ายตรงข้าม", "2) สวมใส่ Modification Magic จากนรก (นับว่าใช้ Modification แล้ว)"], "ราม และ วิโรจน์: เลือกปฏิบัติ", modBonusOf(E, s, mods[0] || x) > 2 ? 1 : 0) : 0;
      if (m === 0) return { explain: `${E.name(s, x)} POWER +2 จนถึง End Phase ต่อไปของฝ่ายตรงข้าม`, ops: [{ op: "power", i: x.i, n: 2, temp: "next" }] };
      const t = c.choose(mods.sort((a, b) => modBonusOf(E, s, b) - modBonusOf(E, s, a)), 1, "เลือก Modification Magic จากนรก", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} จากนรกสวมใส่ให้ ${E.name(s, x)}`, ops: [{ op: "attach", i: t.i, on: x.i }, { op: "useMod", seat: p }] } : { explain: "ไม่มี Modification", ops: [] }; } } },
  // ลูกคนรวย: POWER equals the number of cards in the opponent's hand
  "BT04-008": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: s.P[1 - L.p].hand.length }] : []) },
  // โทมาโทจัง: our other ไอดอล wearing โอตะ POWER +2 · while wearing โอตะ with another-name ไอดอล of ours, it cannot be chosen as an attack target
  "BT04-009": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i !== src.i && idol(E, s, x) && otaOn(E, s, x).length > 0, n: 2 }] : []),
    noAtk: (E, s, x, L) => L.z === "av" && otaOn(E, s, x).length > 0 && s.P[L.p].av.some((y) => y.i !== x.i && idol(E, s, y) && E.name(s, y) !== E.name(s, x)) },
  // เทอราโนดอน จากต่างแดน: our {กะปอม} scouts look at one more card (counted by the กะปอม scripts, see scoutN)
  "BT04-011": { scoutPlus: 1 },
  // เอเลี่ยนทูตดาวอังคาร: once per turn, show Avatars from the hand: destroy an opposing Avatar whose POWER equals their total Cost, then give a hand card to the opponent
  "BT04-012": { activate: { label: "แสดง Avatar บนมือ: ทำลาย Avatar ที่ POWER เท่ากับ Cost รวม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.some((y) => isAv(E, s, y)) && s.P[1 - L.p].av.length > 0,
    run: (c) => { const { E, s, seat: p } = c; const hand = s.P[p].hand.filter((y) => isAv(E, s, y)).slice(0, 8); const foes = s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a));
      let plan = null; for (const f of foes) { const want = E.power(s, f); for (let m = 1; m < 1 << hand.length && !plan; m++) { const pick = hand.filter((_, k) => m & (1 << k)); if (pick.reduce((a, y) => a + (E.def(s, y).c || 0), 0) === want) plan = { f, pick }; } if (plan) break; }
      const shown = c.choose(plan ? [...plan.pick, ...hand.filter((y) => !plan.pick.includes(y))] : hand, plan ? plan.pick.length : hand.length, "แสดง Avatar บนมือ (Cost รวม = POWER ของเป้าหมาย)", { optional: true });
      const sum = shown.reduce((a, y) => a + (E.def(s, y).c || 0), 0); const t = c.choose(foes.filter((y) => E.power(s, y) === sum), 1, `เลือก Avatar ฝ่ายตรงข้ามที่ POWER ${sum}`, { exact: true })[0];
      const give = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "เลือกการ์ดบนมือ 1 ใบให้ฝ่ายตรงข้าม", { exact: true })[0];
      return { explain: `แสดง Cost รวม ${sum}${t ? ` · ทำลาย ${E.name(s, t)}` : " · ไม่มี Avatar ที่ POWER ตรง"}${give ? " · ให้การ์ด 1 ใบแก่ฝ่ายตรงข้าม" : ""}`, ops: [...(t ? [{ op: "destroy", i: t.i, why: "เอเลี่ยนทูตดาวอังคาร" }] : []), ...(give ? [{ op: "giveCard", seat: p, i: give.i }] : [])] }; } } },
  // คุณดีไมส์ (ปลาดาบ): with บึงทมิฬ on the Land zone: after destroying an opposing Avatar, may discard 1 to wake up
  "BT04-015": { win: (c) => { const { E, s, seat: p, self: x } = c; if (!swamp(E, s)) return { explain: "ไม่มีบึงทมิฬบน Land Magic Zone", ops: [] }; if (!x || !s.P[p].hand.length) return { explain: "ไม่มีการ์ดบนมือให้ทิ้ง", ops: [] };
    const t = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ เพื่อกลับมาสภาพตื่น (ไม่ใช้ก็ได้)", { optional: true })[0];
    return t ? { explain: `ทิ้ง ${E.name(s, t)} · ${E.name(s, x)} กลับมาสภาพตื่น`, ops: [{ op: "discard", seat: p, iids: [t.i] }, { op: "wake", i: x.i }] } : { explain: "ไม่ใช้ความสามารถ", ops: [] }; } },
  // ริกกี้ คุณตา: unaffected by the opponent's Magic
  "BT04-016": { magicProof: true },
  // รัททาทุย 2 หัว: โล่มนุษย์ · once per turn, instead of being destroyed in a fight it gets POWER -1 · at POWER 0 it is destroyed
  "BT04-018": { wouldDestroy: (E, s, x, L, o) => { if (!o || !o.fight || E.power(s, x) <= 1) return false; E.log(s, L.p, `${E.name(s, x)} POWER -1 แทนการถูกทำลาย`); E.ops(s, [{ op: "power", i: x.i, n: -1, temp: false }], L.p); return true; },
    check: (E, s, x, L) => (L.z === "av" && E.power(s, x) === 0 ? [{ op: "destroy", i: x.i, why: "POWER เป็น 0" }] : []) },
  // คนแก่สติเลอะเลือนผู้รู้ความจริง: scouted by a "ผู้รู้ความจริง" Avatar it is summoned (see truthSpill) · once per turn: draw 1
  "BT04-019": { activate: { label: "จั่วการ์ด 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main", run: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) } },
  // อู๊ด ประธานผู้รู้ความจริง: จุติ scout 2, back on top or bottom: destroy an opposing Avatar of Cost up to their total Cost
  "BT04-020": { summon: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 2); if (!top.length) return { explain: "Deck หมด", ops: [] }; const sum = top.reduce((a, y) => a + (E.def(s, y).c || 0), 0); const sp = truthSpill(c, top);
    const ops = [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...sp.ops, ...topOrBottom(c, top.filter((y) => !sp.used.includes(y)), "อู๊ด: วางการ์ดที่สอดแนมไว้บนสุดหรือใต้ Deck")];
    const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) <= sum).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${sum} ที่จะทำลาย`)[0]; if (t) ops.push({ op: "destroy", i: t.i, why: "อู๊ด ประธานผู้รู้ความจริง" });
    return { explain: [`สอดแนม 2 ใบ (Cost รวม ${sum})`, ...sp.say, t ? `ทำลาย ${E.name(s, t)}` : "ไม่มี Avatar ที่ Cost ไม่เกินนั้น"].join(" · "), ops }; } },
  // น้องสาม ผู้รู้ความจริง: when it attacks: scout 2, POWER + the POWER of the "ผู้รู้ความจริง" Avatars seen, may take one to the hand, the rest on top or bottom
  "BT04-021": { attack: (c) => { const { E, s, seat: p, self: x } = c; const top = s.P[p].deck.slice(0, 2); if (!top.length || !x) return { explain: "Deck หมด", ops: [] }; const tr = top.filter((y) => truthAv(E, s, y)); const bonus = tr.reduce((a, y) => a + (E.def(s, y).pw || 0), 0);
    const take = c.choose(tr.filter((y) => !oldMan(E, s, y)), 1, "นำ Avatar ผู้รู้ความจริง 1 ใบจากที่สอดแนมขึ้นมือ (ไม่เอาก็ได้)", { optional: true, reveal: top.map((y) => y.i) })[0]; const sp = truthSpill(c, top, take ? [take] : []);
    const rest = top.filter((y) => y !== take && !sp.used.includes(y));
    return { explain: [`สอดแนม 2 ใบ: POWER +${bonus}`, ...(take ? [`${E.name(s, take)} ขึ้นมือ`] : []), ...sp.say].join(" · "), ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(bonus ? [{ op: "power", i: x.i, n: bonus, temp: true }] : []), ...(take ? [{ op: "move", i: take.i, to: "hand" }] : []), ...sp.ops, ...topOrBottom(c, rest, "น้องสาม: วางการ์ดที่เหลือไว้บนสุดหรือใต้ Deck")] }; } },
  // รปภ ผู้รู้ความจริง: จุติ: draw 1, then put a hand card on top of the Deck
  "BT04-022": { summon: (c) => ({ explain: "จั่ว 1 ใบ แล้ววางการ์ดบนมือ 1 ใบไว้บนสุดของ Deck", ops: [{ op: "draw", seat: c.seat, n: 1 }, { op: "resume", t: { i: c.t.i, c: c.t.c, when: "putBack", seat: c.seat } }] }),
    putBack: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].hand].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดบนมือวางไว้บนสุดของ Deck", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} วางไว้บนสุดของ Deck`, ops: [{ op: "move", i: t.i, to: "deckTop" }] } : { explain: "ไม่มีการ์ดบนมือ", ops: [] }; } },
  // ครูแกง สอนเลข: จุติ: a side whose Avatars' total POWER is a prime number loses all its Avatars
  "BT04-025": { summon: (c) => { const { E, s } = c; const ops = [], say = []; for (const q of [0, 1]) { const sum = s.P[q].av.reduce((a, y) => a + E.power(s, y), 0); say.push(`${s.P[q].name} ${sum}${isPrime(sum) ? " (จำนวนเฉพาะ)" : ""}`); if (isPrime(sum)) for (const y of s.P[q].av) ops.push({ op: "destroy", i: y.i, why: "ครูแกง สอนเลข" }); }
    return { explain: `ผลรวม POWER: ${say.join(" · ")}`, ops }; } },
  // พญายักษ์ ทศกัณฑ์: once per turn, discard 1: a {ยักษ์} Avatar with POWER 3 (not ทศกัณฑ์) from the Deck, then shuffle
  "BT04-028": { activate: { label: "ทิ้งการ์ด 1 ใบ: อัญเชิญยักษ์ POWER 3 จาก Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3 && !E.named(s, y, "ทศกัณฑ์")),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3 && !E.named(s, y, "ทศกัณฑ์"))), 1, "เลือก Avatar {ยักษ์} POWER 3 จาก Deck", { exact: true })[0];
      const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)} จาก Deck แล้วสับ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; } } },
  // มาติเนซ Tank Ranger: rides a รถถัง · destroyed to cancel an opposing Magic's effect on that รถถัง
  "BT04-030": { activate: rideTank, worn: () => 0, magicBlock: true },
  // พลปืนอาณาจักรของแพง: has เตะไข่ while the King is on our Avatar Zone
  "BT04-032": { aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.some((y) => E.named(s, y, KING)) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 0, kw: ["เตะไข่"] }] : []) },
  // เจ้าของร้านอาบน้ำสัตว์: โล่มนุษย์ · once per turn, discard "พนักงานอาบน้ำสัตว์" or a {สัตว์} card: a {สัตว์} Avatar of ours POWER +1
  "BT04-033": { activate: { label: "ทิ้งพนักงานอาบน้ำสัตว์หรือการ์ด {สัตว์}: Avatar {สัตว์} POWER +1", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => syIs(E, s, y, "สัตว์")) && s.P[L.p].hand.some((y) => E.named(s, y, "พนักงานอาบน้ำสัตว์") || syIs(E, s, y, "สัตว์")),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => E.named(s, y, "พนักงานอาบน้ำสัตว์") || syIs(E, s, y, "สัตว์")).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดจากมือ 1 ใบ", { exact: true })[0]; const t = c.choose(s.P[p].av.filter((y) => syIs(E, s, y, "สัตว์")).sort(strongFirst(E, s)), 1, "เลือก Avatar {สัตว์} ฝ่ายเรา POWER +1", { exact: true })[0];
      return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} POWER +1`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "power", i: t.i, n: 1, temp: false }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; } } },
  // อนงค์ พนักงานอาบน้ำสัตว์: คำสั่งเสีย: a "หมา" or "แมว" {สัตว์} Avatar of Cost 3 or less from our hell is summoned
  "BT04-034": { death: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter((y) => isAv(E, s, y) && syIs(E, s, y, "สัตว์") && (E.named(s, y, "หมา") || E.named(s, y, "แมว")) && (E.def(s, y).c || 0) <= 3)).sort(strongFirst(E, s)), 1, "เลือกหมาหรือแมวจากนรกที่จะอัญเชิญ")[0];
    return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: t ? "Avatar Zone เต็ม" : "ไม่มีหมาหรือแมวที่ตรงเงื่อนไขในนรก", ops: [] }; } },
  // Grand Rumble !!!!: exactly 6 Avatars on the field: number them 1-6, roll a die, destroy all but the rolled one
  "BT04-042": { canCast: (E, s) => s.P[0].av.length + s.P[1].av.length === 6, cast: (c) => { const { E, s } = c; const all = [...s.P[0].av, ...s.P[1].av]; if (all.length !== 6) return { explain: "บนสนามไม่ได้มี Avatar 6 ใบพอดี", ops: [] };
    const cases = {}; all.forEach((x, k) => { cases[k + 1] = all.filter((y) => y !== x).map((y) => ({ op: "destroy", i: y.i, why: "Grand Rumble" })); });
    return { explain: `กำหนดเลข ${all.map((x, k) => `${k + 1}=${E.name(s, x)}`).join(", ")} แล้วทอยลูกเต๋า`, ops: [{ op: "roll", sides: 6, why: "Grand Rumble", cases }] }; } },
  // ใครเจ๋งกว่า !: both show a card with a Cost; the lower one is discarded, a tie sends both back into the Decks
  "BT04-045": { cast: (c) => { const { E, s, seat: p } = c; const has = (y) => E.def(s, y).c != null; const mine = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i && has(y)).sort((a, b) => (E.def(s, b).c || 0) - (E.def(s, a).c || 0)), 1, "เลือกการ์ดที่มี Cost บนมือเพื่อแสดง", { exact: true })[0];
    const theirs = s.P[1 - p].hand.filter(has).sort((a, b) => (E.def(s, b).c || 0) - (E.def(s, a).c || 0))[0]; const cm = mine ? E.def(s, mine).c : -1, ct = theirs ? E.def(s, theirs).c : -1; const ops = [], say = [`เรา: ${mine ? E.name(s, mine) + " (Cost " + cm + ")" : "ไม่มี"}`, `ฝ่ายตรงข้าม: ${theirs ? E.name(s, theirs) + " (Cost " + ct + ")" : "ไม่มี แสดงมือทั้งหมด"}`];
    if (!theirs) ops.push({ op: "note", text: `มือฝ่ายตรงข้าม: ${s.P[1 - p].hand.map((y) => E.name(s, y)).join(", ") || "-"}` });
    if (mine && theirs) { if (cm < ct) ops.push({ op: "discard", seat: p, iids: [mine.i] }); else if (ct < cm) ops.push({ op: "discard", seat: 1 - p, iids: [theirs.i] }); else ops.push({ op: "move", i: mine.i, to: "deckBottom" }, { op: "move", i: theirs.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "shuffle", seat: 1 - p }); }
    else if (mine && !theirs) { /* nothing to compare */ } else if (theirs && !mine) ops.push({ op: "note", text: `มือเรา: ${s.P[p].hand.filter((y) => y.i !== c.t.i).map((y) => E.name(s, y)).join(", ") || "-"}` });
    return { explain: say.join(" · "), ops }; } },
  // ความจริงงงงงงง: with a "ผู้รู้ความจริง" of ours: show a card from our Deck, shuffle, put it on top
  "BT04-047": { canCast: (E, s, p) => s.P[p].av.some((y) => truthAv(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดจาก Deck ที่จะวางไว้บนสุด", { exact: true })[0];
    return t ? { explain: `แสดง ${E.name(s, t)} · สับ Deck แล้ววางไว้บนสุด`, ops: [{ op: "shuffle", seat: p }, { op: "move", i: t.i, to: "deckTop" }] } : { explain: "Deck หมด", ops: [] }; } },
  // เอาไปอยู่ด้วย (React): our {ผี} was destroyed by the opponent's card: destroy an opposing Avatar
  "BT04-049": { react: { kinds: ["destroyed"], can: (E, s, p, on) => { const L = E.locate(s, on.i); return on.p === p && on.opp && !!L && sy(E, s, L.x, "ผี") && s.P[1 - p].av.some((y) => !E.noAim(s, y)); } },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "เอาไปอยู่ด้วย" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // เชาว์ปัญญาลิง (React): the opponent uses an Avatar's ability: that Avatar loses all abilities until end of turn (the ability is cancelled)
  "BT04-050": { react: { kinds: ["activate"], can: (E, s, p, on) => { const L = E.locate(s, on.i); return !!L && L.p !== p && L.z === "av" && !E.noAim(s, L.x); } },
    cast: (c) => { const { E, s } = c; const on = onTarget(c); const L = on.i != null ? E.locate(s, on.i) : null; return L ? { explain: `${E.name(s, L.x)} สูญเสียความสามารถทั้งหมดจนจบเทิร์น`, ops: [{ op: "cancelTrig", i: L.x.i }, { op: "mute", i: L.x.i }] } : { explain: "Avatar ใบนั้นไม่อยู่แล้ว", ops: [] }; } },
  // ลดราคาล้นตลาด (React): both sides wear a Modification: one from each side goes to hell
  "BT04-051": { react: { kinds: ["attack", "summon", "cast", "activate", "destroyed"], can: (E, s, p) => [0, 1].every((q) => [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on != null && (E.locate(s, m.on) || {}).p === q)) },
    cast: (c) => { const { E, s, seat: p } = c; const worn = (q) => [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on != null && (E.locate(s, m.on) || {}).p === q);
      const theirs = c.choose(worn(1 - p).sort((a, b) => modBonusOf(E, s, b) - modBonusOf(E, s, a)), 1, "เลือก Modification ฝั่งตรงข้ามที่จะส่งลงนรก", { exact: true })[0]; const mine = c.choose(worn(p).sort((a, b) => modBonusOf(E, s, a) - modBonusOf(E, s, b)), 1, "เลือก Modification ฝั่งเราที่จะส่งลงนรก", { exact: true })[0];
      return { explain: `ส่ง ${[theirs, mine].filter(Boolean).map((m) => E.name(s, m)).join(" และ ")} ลงนรก`, ops: [theirs, mine].filter(Boolean).map((m) => ({ op: "move", i: m.i, to: "hell" })) }; } },
  // กลับหลังหัน !!! (React): an Avatar in the fight swaps its Cost and POWER until the fight ends
  "BT04-052": { react: { kinds: ["attack"], can: (E, s, p, on) => on.tk === "av" },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const A = E.locate(s, on.att), T = on.ti != null ? E.locate(s, on.ti) : null; const pool = [A, T].filter((L) => L && L.z === "av").map((L) => L.x);
      const gain = (x) => (E.costNow(s, x) - E.power(s, x)) * (E.locate(s, x.i).p === p ? 1 : -1); const t = c.choose(pool.sort((a, b) => gain(b) - gain(a)), 1, "เลือก Avatar ที่กำลังต่อสู้ (สลับ Cost กับ POWER)", { exact: true })[0]; if (!t) return { explain: "ไม่มี Avatar ที่ต่อสู้", ops: [] };
      const cst = E.costNow(s, t), pw = E.power(s, t); return { explain: `${E.name(s, t)}: Cost ${cst} ↔ POWER ${pw} จนจบการต่อสู้`, ops: [{ op: "setPower", i: t.i, v: cst, temp: "fight" }, { op: "setCost", i: t.i, v: pw }] }; } },
  // ไบโพล่า ชิลด์: worn only by "ผู้กล้า" robots · once per turn, when the wearer would leave the field by an opposing card: a die, even keeps it
  "BT04-053": { modOnly: (E, s, host) => sy(E, s, host, "หุ่นยนต์") && E.named(s, host, "ผู้กล้า"), worn: () => 0,
    hostSave: (E, s, m, host, o) => { if (!o.fromOpp) return null; const r = 1 + Math.floor(E.rnd(s) * 6); E.log(s, (E.locate(s, host.i) || {}).p, `${E.name(s, m)}: ทอยลูกเต๋าได้ ${r}${r % 2 === 0 ? " (คู่) ไม่ถูกนำออกจากสนาม" : ""}`); return r % 2 === 0; } },
  // ดาบพิฆาตสวรรค์: the wearer's Cost +2; at Cost 6 or more it also gets POWER +1
  "BT04-055": { wornCost: 2, worn: (E, s, m, host) => (E.costNow(s, host) >= 6 ? 1 : 0) },
  // ปืนเล็กยาว: worn only by "ทหาร" or "รด." {คน} Avatars · POWER +3
  "BT04-056": { modOnly: (E, s, host) => sy(E, s, host, "คน") && (E.named(s, host, "ทหาร") || E.named(s, host, "รด.")), worn: () => 3 },
  // สมาคมผู้รู้ความจริง (Land): once per turn with a "ผู้รู้ความจริง" of ours: scout 3, put them on top or at the bottom
  "BT04-057": { activate: { label: "สอดแนม 3 ใบ แล้ววางไว้บนหรือใต้ Deck", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].av.some((y) => truthAv(E, s, y)) && s.P[L.p].deck.length > 0,
    run: (c) => { const { s, seat: p } = c; const top = s.P[p].deck.slice(0, 3); return { explain: `สอดแนม ${top.length} ใบ`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...topOrBottom(c, top, "สมาคมผู้รู้ความจริง: วางไว้บนสุดหรือใต้ Deck")] }; } } },
  // โรงบาลรัฐ (Land): LIFE cards cannot be turned face down
  "BT04-058": { noLifeDown: true },
  // Podcast Untitled Case (Land): {ผี}, {เปรต}, {เอเลี่ยน} and dinosaur Avatars POWER +1
  "BT04-060": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((q) => ({ seat: q, test: (x) => ["ผี", "เปรต", "เอเลี่ยน"].some((k) => sy(E, s, x, k)) || E.named(s, x, "ไดโนเสาร์"), n: 1 })) : []) },
});

// ---------- BT05 ----------
const knight = (E, s, x) => isAv(E, s, x) && E.named(s, x, "อัศวินโต๊ะกลม");
const dragonfly = (E, s, x) => isAv(E, s, x) && E.named(s, x, "แมลงปอ");
const dogCat = (E, s, x) => isAv(E, s, x) && syIs(E, s, x, "สัตว์") && (E.named(s, x, "หมา") || E.named(s, x, "แมว"));
const PLANE = "เครื่องบิน Super Air";
const isPlane = (E, s, y) => String(E.def(s, y).n || "").trim() === PLANE; // exact: "หมาเครื่องบิน Super Air" is not the plane
const plane = (E, s, p) => s.P[p].av.some((y) => isPlane(E, s, y));
const superAir = (E, s, x) => isAv(E, s, x) && E.named(s, x, "Super Air");
const greenDef = (d) => !!d && d.t === "A" && d.co === "เขียว";
// scout n from our Deck, the rest to the bottom (or shuffled back)
const scoutPick = (c, n, test, label, o = {}) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, n); if (!top.length) return { top, t: null };
  const t = c.choose(top.filter(test).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, label, { optional: !!o.optional, reveal: top.map((y) => y.i) })[0]; return { top, t }; };
const restOps = (p, top, taken, rest = "bottom") => [{ op: "scoutRest", seat: p, ids: top.filter((y) => !taken.includes(y)).map((y) => y.i), rest }];
Object.assign(SCRIPTS, {
  // กุ่ย นักเอาตัวรอด: summoned exactly (พอดี): when it would be destroyed, discard 1: it is not destroyed
  "BT05-001": { wouldDestroy: (E, s, x, L) => { if (!x.px) return false; const P = s.P[L.p]; if (!P.hand.length) return false; const t = [...P.hand].sort(cheapCard(E, s))[0];
    E.log(s, L.p, `${E.name(s, x)} ทิ้ง ${E.name(s, t)} แทนการถูกทำลาย (พอดี)`); E.ops(s, [{ op: "discard", seat: L.p, iids: [t.i] }], L.p); return true; } },
  // แมลงปอนางพญา: Cost -1 for each "แมลงปอ" in our hell · POWER +1 for each other "แมลงปอ" on the field · once per turn sacrifice another แมลงปอ: one with another name from our hell, summoned with จุติ
  "BT05-002": { selfCost: (E, s, x, p) => -s.P[p].hell.filter((y) => dragonfly(E, s, y)).length,
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: [...s.P[0].av, ...s.P[1].av].filter((y) => y.i !== src.i && dragonfly(E, s, y)).length }] : []),
    activate: { label: "เซ่นไหว้แมลงปอใบอื่น: อัญเชิญแมลงปอชื่ออื่นจากนรกแบบจุติ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i && dragonfly(E, s, y) && s.P[L.p].hell.some((z) => dragonfly(E, s, z) && E.name(s, z) !== E.name(s, y))),
      run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const sac = c.choose(P.av.filter((y) => y.i !== x.i && dragonfly(E, s, y) && P.hell.some((z) => dragonfly(E, s, z) && E.name(s, z) !== E.name(s, y))).sort(cheapCard(E, s)), 1, "เซ่นไหว้แมลงปอใบอื่น", { exact: true })[0]; if (!sac) return { explain: "ไม่มีแมลงปอให้เซ่นไหว้", ops: [] };
        const t = c.choose(uniq(E, s, [...P.hell].reverse().filter((z) => dragonfly(E, s, z) && E.name(s, z) !== E.name(s, sac))).sort(strongFirst(E, s)), 1, "เลือกแมลงปอในนรกที่จะอัญเชิญแบบจุติ", { exact: true })[0];
        return t ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · อัญเชิญ ${E.name(s, t)} แบบจุติ`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "put", i: t.i, jt: true }] } : { explain: "ไม่มีแมลงปอในนรก", ops: [] }; } } },
  // ทริสทัน: summoned by an "อัศวินโต๊ะกลม" ability: destroy a card on the opponent's field · สามัคคี with another อัศวินโต๊ะกลม of ours
  "BT05-004": { byOk: (E, s, src) => !!src && src.t === "A" && String(src.n || "").includes("อัศวินโต๊ะกลม"),
    summonedBy: (c) => { const { E, s, seat: p } = c; const O = s.P[1 - p]; const t = c.choose([...O.av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...O.cs, ...O.mg.filter((m) => m.on != null)], 1, "ทริสทัน: เลือกการ์ดบนสนามฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
      return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ทริสทัน" }] } : { explain: "ฝ่ายตรงข้ามไม่มีการ์ดบนสนาม", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.some((y) => y.i !== src.i && knight(E, s, y)) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 0, kw: ["สามัคคี"] }] : []) },
  // หมาแพนดี้: while asleep, POWER +1 for each other หมา/แมว {สัตว์} of ours
  "BT05-006": { aura: (E, s, src, L) => (L.z === "av" && !src.a ? [{ seat: L.p, test: (x) => x.i === src.i, n: s.P[L.p].av.filter((y) => y.i !== src.i && dogCat(E, s, y)).length }] : []) },
  // สหายหุ่นผู้กล้า โฟเบีย: จุติ: เก๊าท์, ไดบาเรีย and แอร์ซิด from hell back to the Deck: a "ไมเกรน" of Cost 5 or less from the Deck, shuffle, and this card is worn by it (POWER +1)
  "BT05-007": { worn: () => 1, summon: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const need = ["โดรนสอดแนมผู้กล้า : เก๊าท์", "ยานเกราะผู้กล้า : ไดบาเรีย", "อากาศยานผู้กล้า : แอร์ซิด"].map((n) => P.hell.find((y) => E.named(s, y, n)));
    if (need.some((y) => !y)) return { explain: "ในนรกมีการ์ดไม่ครบ 3 ชื่อ", ops: [] }; const m = P.deck.find((y) => isAv(E, s, y) && E.named(s, y, "ไมเกรน") && (E.def(s, y).c || 0) <= 5); if (!m || !x) return { explain: "ไม่มีไมเกรนใน Deck", ops: [] };
    const go = c.mode(["นำ 3 ใบกลับเข้า Deck แล้วอัญเชิญไมเกรน", "ไม่ใช้"], "สหายหุ่นผู้กล้า โฟเบีย", 0); if (go !== 0) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
    return { explain: `อัญเชิญ ${E.name(s, m)} จาก Deck แล้วโฟเบียไปสวมใส่ให้`, ops: [...need.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "put", i: m.i }, { op: "shuffle", seat: p }, { op: "attach", i: x.i, on: m.i }] }; } },
  // น้องส้ม ชู้วันชัย: paid for a {เปรต}: Magic cannot remove that Avatar until the end of the opponent's next turn
  "BT05-009": { paidFor: (d) => peretDef(d), paid: (c) => (c.t.forI != null ? { explain: "Avatar ใบนั้นจะไม่ถูกนำออกจากสนามด้วย Magic จนจบเทิร์นถัดไปของฝ่ายตรงข้าม", ops: [{ op: "mprot", i: c.t.forI, until: c.s.turn + 1 }] } : { explain: "ไม่พบ Avatar", ops: [] }) },
  // น้องนาว ชู้วันชัย: Cost 0 while we control a {เปรต} · once per turn flip up to 2 of our LIFE face up; they turn face down at the end of the turn
  "BT05-010": { selfCost: (E, s, x, p) => (s.P[p].av.some((y) => sy(E, s, y, "เปรต")) ? -(E.def(s, x).c || 0) : 0),
    activate: { label: "หงาย LIFE เราสูงสุด 2 ใบ (คว่ำคืนเมื่อจบเทิร์น)", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].life.some((y) => !y.up),
      run: (c) => { const { s, seat: p } = c; const down = s.P[p].life.filter((y) => !y.up).length; const n = Math.min(2, down) - (c.mode(["หงาย 2 ใบ", "หงาย 1 ใบ"], "น้องนาว: หงาย LIFE กี่ใบ", 0) === 1 && down >= 2 ? 1 : 0);
        return { explain: `หงาย LIFE เรา ${n} ใบ จนจบเทิร์น`, ops: [...Array.from({ length: n }, () => ({ op: "lifeFlip", seat: p })), { op: "atEnd", turn: s.turn, ops: Array.from({ length: n }, () => ({ op: "lifeFlip", seat: p, up: false, force: true })), why: "คว่ำ LIFE ที่หงายด้วยน้องนาว" }] }; } } },
  // เจนนี่ อย่าบู้บี้เลขา: nobody can summon Avatars from hell
  "BT05-012": { noHellSummon: true },
  // ลานเซลอต: จุติ scout 2: an "อัศวินโต๊ะกลม" is summoned, the rest shuffled back; red: our knights +1 this turn, blue: draw 1
  "BT05-014": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 2, (y) => knight(E, s, y), "เลือกอัศวินโต๊ะกลมจากที่สอดแนมเพื่ออัญเชิญ"); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const ops = [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; const say = [`สอดแนม ${top.length} ใบ`]; const room = E.avatars(s.P[p]) < 4;
    if (t && room) { ops.push({ op: "put", i: t.i }); say.push(`อัญเชิญ ${E.name(s, t)}`); const co = E.colors(s, t);
      if (co.includes("แดง")) { for (const y of s.P[p].av.filter((z) => knight(E, s, z))) ops.push({ op: "power", i: y.i, n: 1, temp: true }); ops.push({ op: "power", i: t.i, n: 1, temp: true }); say.push("สีแดง: อัศวินโต๊ะกลมเรา POWER +1"); }
      if (co.includes("ฟ้า")) { ops.push({ op: "draw", seat: p, n: 1 }); say.push("สีฟ้า: จั่ว 1 ใบ"); } }
    ops.push({ op: "shuffle", seat: p }); return { explain: say.join(" · ") + " · ที่เหลือกลับ Deck แล้วสับ", ops }; } },
  // ของขวัญที่เมียทิ้งไว้ให้: with เจค นักฆ่ามือเก๋า and no other copy on our Avatar Zone: summoned from the hand without paying
  "BT05-018": { activate: { label: "อัญเชิญจากมือโดยไม่ต้องจ่าย Cost", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].av.some((y) => E.named(s, y, "เจค นักฆ่ามือเก๋า")) && !s.P[L.p].av.some((y) => E.named(s, y, "ของขวัญที่เมียทิ้งไว้ให้")),
    run: (c) => ({ explain: `อัญเชิญ ${c.E.name(c.s, c.self)} โดยไม่ต้องจ่าย Cost`, ops: [{ op: "put", i: c.self.i }] }) } },
  // นีโม่ นรกสเลเยอร์: attacking a {นรก} destroys it
  "BT05-021": destroyAtTarget("นรก"),
  // แมว-น้ำมะลิ: จุติ scout 3: a หมา/แมว {สัตว์} to the hand (หมานมเย็น is summoned with จุติ instead), the rest shuffled back
  "BT05-022": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 3, (y) => dogCat(E, s, y), "เลือกหมาหรือแมวจากที่สอดแนม"); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const ops = [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; let say = `สอดแนม ${top.length} ใบ`;
    if (t) { if (E.named(s, t, "หมานมเย็น") && E.avatars(s.P[p]) < 4) { ops.push({ op: "put", i: t.i, jt: true }); say += ` · อัญเชิญ ${E.name(s, t)} แบบจุติ`; } else { ops.push({ op: "move", i: t.i, to: "hand" }); say += ` · ${E.name(s, t)} ขึ้นมือ`; } }
    ops.push({ op: "shuffle", seat: p }); return { explain: say + " · ที่เหลือกลับ Deck แล้วสับ", ops }; } },
  // นักรบ ฮอล: when the opponent attacks: shown from the hand and summoned by paying its Cost; then the attack goes to it · คำสั่งเสีย: draw 1
  "BT05-023": { answer: { label: "อัญเชิญจากมือ (จ่าย Cost) แล้วรับการโจมตีแทน", can: (E, s, x, L) => L.z === "hand" && !!s.pend && E.avatars(s.P[L.p]) < 4 && s.P[L.p].av.length < 6 && !!E.autoPay(s, L.p, x.i),
      botOk: (E, s, x, L, ap) => (E.def(s, x).pw || 0) > ap || (s.pend.tk === "life" && E.critical(s.P[L.p])),
      run: (c) => (c.self ? { explain: `อัญเชิญ ${c.E.name(c.s, c.self)} แล้วรับการโจมตีแทน`, ops: [{ op: "payPut", seat: c.seat, i: c.self.i }, { op: "redirect", i: c.self.i }] } : { explain: "", ops: [] }) },
    death: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // มีมมิ ผู้ร่วงหล่น: จุติ with แดรกคูลา on our side: the Land "ปราสาทแดรก" from the Deck to the hand, shuffle
  "BT05-024": { summon: (c) => { const { E, s, seat: p } = c; if (!s.P[p].av.some((y) => E.named(s, y, "แดรกคูลา"))) return { explain: "ไม่มีแดรกคูลาบน Avatar Zone เรา", ops: [] }; const t = s.P[p].deck.find((y) => E.named(s, y, "ปราสาทแดรก"));
    return t ? { explain: `${E.name(s, t)} จาก Deck ขึ้นมือ แล้วสับ Deck`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "ไม่มีปราสาทแดรกใน Deck", ops: [] }; } },
  // หมาชาไทย: once per turn, a {สัตว์} Avatar of ours returns to the hand: this one POWER +2
  "BT05-030": { activate: { label: "นำ Avatar {สัตว์} ฝ่ายเรากลับขึ้นมือ: POWER +2", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i && syIs(E, s, y, "สัตว์")),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => y.i !== x.i && syIs(E, s, y, "สัตว์")).sort(cheapCard(E, s)), 1, "เลือก Avatar {สัตว์} ฝ่ายเรากลับขึ้นมือ", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} กลับขึ้นมือ · ${E.name(s, x)} POWER +2`, ops: [{ op: "move", i: t.i, to: "hand" }, { op: "power", i: x.i, n: 2, temp: false }] } : { explain: "ไม่มี Avatar {สัตว์}", ops: [] }; } } },
  // ทัตดนัยซัง: โล่มนุษย์ · พอดี จุติ: an opposing Avatar becomes "โอตะ" worn by our ไอดอล; with มยุราซัง a ไอดอล from the Deck to the hand
  "BT05-031": { summon: (c) => { const { E, s, seat: p } = c; if (!c.t.exact) return { explain: "ไม่ได้อัญเชิญแบบพอดี ความสามารถไม่ทำงาน", ops: [] }; const hosts = s.P[p].av.filter((y) => idol(E, s, y)); const ops = [], say = [];
    const t = hosts.length ? c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && !E.noControl(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะกลายเป็นโอตะ")[0] : null;
    if (t) { const h = c.choose(hosts, 1, "เลือกไอดอลฝ่ายเราที่จะสวมใส่", { exact: true })[0]; ops.push({ op: "setName", i: t.i, name: "โอตะ" }, { op: "attach", i: t.i, on: h.i }); say.push(`${E.name(s, t)} กลายเป็นโอตะ สวมใส่ให้ ${E.name(s, h)}`); }
    if (s.P[p].av.some((y) => E.named(s, y, "มยุราซัง"))) { const k = c.choose(uniq(E, s, s.P[p].deck.filter((y) => idol(E, s, y))).sort(strongFirst(E, s)), 1, "เลือกไอดอลจาก Deck ขึ้นมือ", { optional: true })[0]; if (k) { ops.push({ op: "search", seat: p, take: k.i, to: "hand" }); say.push(`${E.name(s, k)} ขึ้นมือ`); } }
    return { explain: say.join(" · ") || "ไม่มีไอดอลให้สวมใส่", ops }; } },
  // ลุงไนท์ ราชาวานร: จุติ scout 5: a "วานร" of Cost 4 or less is summoned, the rest to the bottom · from hell with 3 วานร of ours, discard 1: it returns
  "BT05-033": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => monkey(E, s, y) && (E.def(s, y).c || 0) <= 4, "เลือกวานร Cost ไม่เกิน 4 จากที่สอดแนมเพื่ออัญเชิญ"); if (!top.length) return { explain: "Deck หมด", ops: [] };
      const put = t && E.avatars(s.P[p]) < 4; return { explain: `สอดแนม ${top.length} ใบ${put ? ` · อัญเชิญ ${E.name(s, t)}` : ""} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(put ? [{ op: "put", i: t.i }] : []), ...restOps(p, top, put ? [t] : [])] }; },
    activate: { label: "ทิ้งการ์ด 1 ใบ: อัญเชิญใบนี้จากนรก", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.filter((y) => monkey(E, s, y)).length >= 3 && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4,
      run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, x)} จากนรก`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: x.i }] } : { explain: "ไม่มีการ์ดบนมือ", ops: [] }; } } },
  // คุณเชิดชัย Super Air: จุติ scout 5: the plane or รหัสดำ, and/or a "Super Air" {คน} Avatar, to the hand; the rest to the bottom
  "BT05-035": { summon: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 5); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const a = c.choose(top.filter((y) => isPlane(E, s, y) || E.named(s, y, "รหัสดำ")), 1, "เลือกเครื่องบิน Super Air หรือ รหัสดำ (ไม่เลือกก็ได้)", { optional: true, reveal: top.map((y) => y.i) })[0];
    const b = c.choose(top.filter((y) => y !== a && superAir(E, s, y) && sy(E, s, y, "คน")), 1, "เลือก Avatar Super Air {คน} (ไม่เลือกก็ได้)", { optional: true, reveal: top.map((y) => y.i) })[0]; const got = [a, b].filter(Boolean);
    return { explain: `สอดแนม ${top.length} ใบ${got.length ? ` · ${got.map((y) => E.name(s, y)).join(", ")} ขึ้นมือ` : ""} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...got.map((y) => ({ op: "move", i: y.i, to: "hand" })), ...restOps(p, top, got)] }; } },
  // หมาเครื่องบิน Super Air: เตะไข่ while we control the plane on our Avatar Zone
  "BT05-037": { aura: (E, s, src, L) => (L.z === "av" && plane(E, s, L.p) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 0, kw: ["เตะไข่"] }] : []) },
  // ผู้โดยสาร Super Air: may be destroyed instead of the plane · cannot be chosen as an attack target while the plane is on our Avatar Zone
  "BT05-038": { saveOther: (E, s, y, Ly, x, L) => (Ly.z === "av" && L.z === "av" && x.i !== y.i && isPlane(E, s, x) ? { why: `${E.name(s, y)} ถูกทำลายแทน ${E.name(s, x)}`, ops: [{ op: "destroy", i: y.i, why: "ทำลายแทน", noSave: true }] } : null),
    noAtk: (E, s, x, L) => L.z === "av" && plane(E, s, L.p) },
  // จ่ายุทธ Tank Ranger: จุติ with a รถถัง of ours: destroy a {ต่างชาติ} Avatar · rides a รถถัง · when that รถถัง fights a {ต่างชาติ}, the foe goes under the Deck
  "BT05-041": { activate: rideTank, worn: () => 0,
    summon: (c) => { const { E, s, seat: p } = c; if (!tanks(E, s, p).length) return { explain: "ไม่มีรถถังบนสนามเรา", ops: [] }; const t = c.choose([...s.P[1 - p].av.filter((y) => !E.noAim(s, y)), ...s.P[p].av].filter((y) => sy(E, s, y, "ต่างชาติ")).sort((a, b) => (b.o !== p) - (a.o !== p) || worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar {ต่างชาติ} ที่จะทำลาย", { exact: true })[0];
      return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "จ่ายุทธ Tank Ranger" }] } : { explain: "ไม่มี Avatar {ต่างชาติ}", ops: [] }; },
    hostFightOk: (E, s, m, host, foe) => E.named(s, host, "รถถัง") && sy(E, s, foe, "ต่างชาติ"),
    hostFight: (c) => { const { E, s } = c; const f = c.t.foe != null ? E.locate(s, c.t.foe) : null; return f && f.z === "av" ? { explain: `${E.name(s, f.x)} ถูกนำเข้าใต้ Deck`, ops: [{ op: "move", i: f.x.i, to: "deckBottom" }] } : { explain: "ไม่มี Avatar ที่ต่อสู้", ops: [] }; } },
  // วีรชนชีวภาพ: paid for a green Avatar: it is unaffected by the opponent's Magic until the end of their next turn
  "BT05-042": { paidFor: (d) => greenDef(d), paid: (c) => (c.t.forI != null ? { explain: "Avatar ที่ถูกอัญเชิญไม่รับผลจาก Magic ของฝ่ายตรงข้ามจนจบเทิร์นถัดไปของฝ่ายตรงข้าม", ops: [{ op: "mprot", i: c.t.forI, until: c.s.turn + 1, all: true }] } : { explain: "ไม่พบ Avatar", ops: [] }) },
  // อาจารย์หลี: when it attacks: POWER +1 until end of turn · once per turn, when an opposing Avatar attacks: the attack may be moved to it
  "BT05-044": { attack: (c) => (c.self ? { explain: "โจมตี: POWER +1 จนจบเทิร์น", ops: [{ op: "power", i: c.self.i, n: 1, temp: true }] } : { explain: "", ops: [] }),
    answer: { label: "ย้ายเป้าหมายการโจมตีมาที่การ์ดใบนี้", can: (E, s, x, L) => L.z === "av" && !!s.pend && s.pend.ti !== x.i && !E.atkSafe(s, x),
      botOk: (E, s, x, L, ap) => { const T = s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return E.power(s, x) > ap && (!T || E.power(s, T.x) <= ap); },
      run: (c) => (c.self ? { explain: `${c.E.name(c.s, c.self)} รับการโจมตีแทน`, ops: [{ op: "redirect", i: c.self.i }] } : { explain: "", ops: [] }) } },
  // รับซื้อของโจร: a random card from the opponent's hand comes to ours; only usable as summoning Cost; returned at the end of the turn
  "BT05-049": { cast: () => ({ explain: "สุ่มหยิบการ์ดจากมือฝ่ายตรงข้าม 1 ใบ (ใช้ได้แค่เป็นค่า Cost จนจบเทิร์น)", ops: [{ op: "borrow" }] }) },
  // พูดไทยได้ 5 คำ: scout 5: a {ต่างชาติ} Avatar to the hand (Cost 2 or less may be summoned instead), the rest to the bottom
  "BT05-050": { cast: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => isAv(E, s, y) && sy(E, s, y, "ต่างชาติ"), "เลือก Avatar {ต่างชาติ} จากที่สอดแนม"); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const ops = [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }]; let say = `สอดแนม ${top.length} ใบ`;
    if (t) { const cheap = (E.def(s, t).c || 0) <= 2 && E.avatars(s.P[p]) < 4; const m = cheap ? c.mode([`อัญเชิญ ${E.name(s, t)}`, `นำ ${E.name(s, t)} ขึ้นมือ`], "Cost 2 หรือต่ำกว่า: อัญเชิญแทนได้", 0) : 1; ops.push(m === 0 ? { op: "put", i: t.i } : { op: "move", i: t.i, to: "hand" }); say += m === 0 ? ` · อัญเชิญ ${E.name(s, t)}` : ` · ${E.name(s, t)} ขึ้นมือ`; }
    return { explain: say + " · ที่เหลือไว้ใต้ Deck", ops: [...ops, ...restOps(p, top, t ? [t] : [])] }; } },
  // ง่วงมากก็ไปนอน !!!: a sleeping Avatar goes back into its owner's Deck (shuffled); that player draws 1
  "BT05-051": { canCast: (E, s) => [...s.P[0].av, ...s.P[1].av].some((y) => !y.a), cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[1 - p].av.filter((y) => !y.a && !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...s.P[p].av.filter((y) => !y.a)], 1, "เลือก Avatar ที่นอนอยู่กลับเข้า Deck", { exact: true })[0];
    return t ? { explain: `${E.name(s, t)} กลับเข้า Deck เจ้าของแล้วสับ · เจ้าของจั่ว 1 ใบ`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: t.o }, { op: "draw", seat: t.o, n: 1 }] } : { explain: "ไม่มี Avatar ที่นอนอยู่", ops: [] }; } },
  // Jump Scare: discard 1: a random card from our Deck: an Avatar of Cost 5 or less is summoned, a non-Avatar goes to hell; then shuffle
  "BT05-052": { canCast: (E, s, p) => s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
    return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · สุ่มการ์ดจาก Deck เรา 1 ใบ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "randomDeck", seat: p, maxCost: 5 }] } : { explain: "ไม่มีการ์ดให้ทิ้ง", ops: [] }; } },
  // เครื่องบิน Super Air: only if we summoned nothing this turn (or only "Super Air"): it becomes a {หุ่นยนต์} Avatar Cost 5 GEM 0 POWER 5; after that only "Super Air" Avatars may be summoned this turn
  "BT05-054": { canCast: (E, s, p) => E.summonedNow(s, p).every((n) => n.includes("Super Air")) && E.avatars(s.P[p]) < 4 && s.P[p].av.length < 6,
    cast: (c) => ({ explain: "เครื่องบิน Super Air กลายเป็น Avatar {หุ่นยนต์} Cost 5 POWER 5 · เทิร์นนี้อัญเชิญได้แค่ Avatar Super Air", ops: [{ op: "becomeAvatar", seat: c.seat, i: c.t.i, ov: { t: "A", sy: "หุ่นยนต์", c: 5, g: 0, pw: 5 } }, { op: "turnLock", seat: c.seat, only: "Super Air" }] }) },
  // ตั๋วยืน: with the plane on our Avatar Zone, discard 1: up to 2 "ผู้โดยสาร Super Air" from the Deck, shuffle
  "BT05-055": { canCast: (E, s, p) => plane(E, s, p) && s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
    const pool = s.P[p].deck.filter((y) => E.named(s, y, "ผู้โดยสาร Super Air")); const n = Math.min(2, pool.length, freeAv(E, s, p)); const got = pool.slice(0, n);
    return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญผู้โดยสาร Super Air ${got.length} ใบ แล้วสับ Deck`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, ...got.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] } : { explain: "ไม่มีการ์ดให้ทิ้ง", ops: [] }; } },
  // พลังแห่งการตีพ่อตีแม่: 1) ตีพ่อ and ตีแม่ from the Deck worn by our {เปรต}; 2) a {เปรต} Avatar from the Deck to the hand; both when we are in critical state
  "BT05-056": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const both = E.critical(P); const pe = P.av.filter((y) => sy(E, s, y, "เปรต"));
    const m = both ? 2 : c.mode(["1) ตีพ่อ และ ตีแม่ จาก Deck สวมใส่ให้เปรตของเรา", "2) Avatar {เปรต} จาก Deck ขึ้นมือ"], "เลือกปฏิบัติ", pe.length ? 0 : 1); const ops = [], say = [];
    if (m !== 1) { const h = c.choose(pe.sort(strongFirst(E, s)), 1, "เลือก Avatar {เปรต} ฝ่ายเรา")[0]; if (h) for (const n of ["ตีพ่อ", "ตีแม่"]) { const w = P.deck.find((y) => E.named(s, y, n)); if (w) { ops.push({ op: "attach", i: w.i, on: h.i }); say.push(`${n} สวมใส่ให้ ${E.name(s, h)}`); } } }
    if (m !== 0) { const t = c.choose(uniq(E, s, P.deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "เปรต"))).sort(strongFirst(E, s)), 1, "เลือก Avatar {เปรต} จาก Deck ขึ้นมือ")[0]; if (t) { ops.push({ op: "search", seat: p, take: t.i, to: "hand" }); say.push(`${E.name(s, t)} ขึ้นมือ`); } }
    ops.push({ op: "shuffle", seat: p }); return { explain: (both ? "สาหัส: ทำทั้งสองข้อ · " : "") + (say.join(" · ") || "ไม่มีการ์ดที่ตรงเงื่อนไข"), ops }; } },
  // พระคุ้มครอง (React, start of the opponent's Battle Phase): send one of ours to hell: our Avatars are not destroyed in fights this turn
  "BT05-057": { react: { kinds: ["battle"], can: (E, s, p) => s.P[p].av.length > 0,
      botV: (E, s, q) => { const mine = s.P[q].av; if (mine.length < 2) return -5; const foes = s.P[1 - q].av.filter((y) => y.a); const n = mine.filter((m) => foes.some((f) => E.power(s, f) >= E.power(s, m))).length; return n >= 2 ? 6 : n === 1 ? 2 : -5; } }, cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort(cheapCard(E, s)), 1, "ส่ง Avatar ฝ่ายเรา 1 ใบลงนรก", { exact: true })[0];
    return t ? { explain: `${E.name(s, t)} ลงนรก · Avatar เราทุกใบไม่ถูกทำลายจากการต่อสู้ในเทิร์นนี้`, ops: [{ op: "move", i: t.i, to: "hell" }, { op: "fprot", seat: p }] } : { explain: "ไม่มี Avatar", ops: [] }; } },
  // อย่าให้มีครั้งที่ 2 (React): cancels the opponent's React; usable even after our own React this turn (once per turn)
  "BT05-058": { react: { kinds: ["react"], ignoreLimit: true, can: (E, s, p, on) => { const L = E.locate(s, on.i); return !!L && L.p !== p; }, botV: () => 4 },
    cast: (c) => { const on = onTarget(c); return on.i != null ? { explain: "ยกเลิกผลของ React ใบนั้น", ops: [{ op: "cancelTrig", i: on.i, cast: true }] } : { explain: "", ops: [] }; } },
  // รหัสดำ (React): send คุณเชิดชัย, the plane and 2 other "Super Air" Avatars (4 names) to hell: flip 3 opposing LIFE; with 2 or fewer face down, we win
  "BT05-059": { react: { kinds: ["attack", "summon", "cast", "activate", "destroyed", "battle"], can: (E, s, p) => blackCode(E, s, p).length === 4, botV: (E, s, q) => (s.P[1 - q].life.filter((y) => !y.up).length <= 2 ? 99 : 6) },
    cast: (c) => { const { E, s, seat: p } = c; const four = blackCode(E, s, p); if (four.length < 4) return { explain: "Avatar Super Air ไม่ครบ", ops: [] }; const down = s.P[1 - p].life.filter((y) => !y.up).length;
      return { explain: `ส่ง ${four.map((y) => E.name(s, y)).join(", ")} ลงนรก · ${down <= 2 ? "LIFE ฝ่ายตรงข้ามคว่ำ 2 ใบหรือน้อยกว่า: ชนะทันที" : "หงาย LIFE ฝ่ายตรงข้าม 3 ใบ"}`, ops: [...four.map((y) => ({ op: "move", i: y.i, to: "hell" })), ...(down <= 2 ? [{ op: "win", text: "รหัสดำ" }] : Array.from({ length: 3 }, () => ({ op: "lifeFlip", seat: 1 - p })))] }; } },
  // แผนการ : เพดานถล่ม (React): with 2+ sleeping Avatars on the opponent's side: destroy a sleeping Avatar
  "BT05-061": { react: { kinds: ["attack", "summon", "cast", "activate"], can: (E, s, p) => s.P[1 - p].av.filter((y) => !y.a).length >= 2 },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !y.a && !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ที่นอนอยู่ที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "เพดานถล่ม" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // ฮึบบบบ (React): an Avatar gains ลูกฮึด until end of turn
  "BT05-062": { react: { kinds: ["attack", "summon", "cast", "activate", "battle"], botV: (E, s, q, on) => { if (on.kind !== "attack" || on.tk !== "av") return -5; const T = E.locate(s, on.ti), A = E.locate(s, on.att); return T && A && T.p === q && E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) >= E.power(s, T.x) ? 4 : -5; } }, cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const T = on.ti != null ? E.locate(s, on.ti) : null;
    const t = c.choose([...(T && T.p === p ? [T.x] : []), ...s.P[p].av.filter((y) => !T || y.i !== T.x.i)], 1, "เลือก Avatar ที่จะได้รับลูกฮึด", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ได้รับลูกฮึดจนจบเทิร์น`, ops: [{ op: "keyword", i: t.i, k: "ลูกฮึด", until: "turn" }] } : { explain: "ไม่มี Avatar", ops: [] }; } },
  // GHD โคลค: worn only by {หุ่นยนต์} · the wearer's Symbol cannot be changed
  "BT05-063": { modOnly: (E, s, host) => sy(E, s, host, "หุ่นยนต์"), worn: () => 0, syLock: true },
  // อาลอนไดร์ท: worn only by อัศวินโต๊ะกลม · +1, no โล่มนุษย์ against its attacks · from hell, with no Modification used this turn: mill 1 and wear it (counts as using one)
  "BT05-064": { modOnly: (E, s, host) => knight(E, s, host), worn: () => 1, hostAttack: () => ({ explain: "ฝ่ายตรงข้ามใช้โล่มนุษย์ไม่ได้", ops: [{ op: "noShieldAtk" }] }),
    activate: { label: "ธรณีสูบ 1 ใบ แล้วนำใบนี้จากนรกไปสวมใส่ให้อัศวินโต๊ะกลม", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && !s.mu[L.p].D && s.P[L.p].av.some((y) => knight(E, s, y)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const h = c.choose(s.P[p].av.filter((y) => knight(E, s, y)).sort(strongFirst(E, s)), 1, "เลือกอัศวินโต๊ะกลมที่จะสวมใส่", { exact: true })[0]; return h ? { explain: `ธรณีสูบ 1 ใบ · ${E.name(s, x)} สวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "mill", seat: p, n: 1 }, { op: "attach", i: x.i, on: h.i }, { op: "useMod", seat: p }] } : { explain: "ไม่มีอัศวินโต๊ะกลม", ops: [] }; } } },
  // กระบองแสง คทาวุธ: when the wearer attacks, no React until the fight ends · after it destroys an opposing Avatar, it wakes if they still have Avatars
  "BT05-065": { worn: () => 0, hostAttack: () => ({ explain: "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้", ops: [{ op: "noReact" }] }),
    hostWin: (c) => { const { E, s, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; return H && s.P[1 - H.p].av.length ? { explain: `${E.name(s, H.x)} กลับมาสภาพตื่น`, ops: [{ op: "wake", i: H.x.i }] } : { explain: "ฝ่ายตรงข้ามไม่มี Avatar แล้ว", ops: [] }; } },
  // มนุษย์ดัดแปลง: choose an Avatar of Cost 3 or less in our hell, discard 1: it is summoned and wears this card; its Symbol becomes เครื่องจักร; if this card leaves the field, the wearer goes to hell
  "BT05-066": { castFree: true, worn: () => 0, syOver: "เครื่องจักร", leaveKillsHost: true,
    cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const t = c.choose(uniq(E, s, [...P.hell].reverse().filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 3)).sort(strongFirst(E, s)), 1, "เลือก Avatar Cost ไม่เกิน 3 ในนรก", { exact: true })[0];
      const pay = t ? c.choose(P.hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0] : null; if (!t || !pay || E.avatars(P) >= 4) return { explain: "ไม่มีเป้าหมายหรือการ์ดให้ทิ้ง", ops: [] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)} จากนรก แล้วสวมใส่มนุษย์ดัดแปลง`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "attach", i: c.t.i, on: t.i }] }; } },
  // Hot Zone (Land): once per turn, a "Tank Ranger" {คน} Avatar from our hand is worn by a รถถัง of ours
  "BT05-067": { activate: { label: "นำ Tank Ranger จากมือไปสวมใส่ให้รถถัง", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && tanks(E, s, L.p).length > 0 && s.P[L.p].hand.some((y) => isAv(E, s, y) && E.named(s, y, "Tank Ranger") && sy(E, s, y, "คน")),
    run: (c) => { const { E, s, seat: p } = c; const r = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && E.named(s, y, "Tank Ranger") && sy(E, s, y, "คน")), 1, "เลือก Tank Ranger บนมือ", { exact: true })[0]; const h = r ? c.choose(tanks(E, s, p).filter((t) => canWear(E, s, t, r)), 1, "เลือกรถถัง", { exact: true })[0] : null;
      return r && h ? { explain: `${E.name(s, r)} จากมือไปสวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: r.i, on: h.i }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; } } },
  // ทรายดูด (Land): Avatars at POWER 0 are destroyed
  "BT05-068": { check: (E, s, x, L) => (L.z === "land" ? [...s.P[0].av, ...s.P[1].av].filter((y) => E.power(s, y) === 0).map((y) => ({ op: "destroy", i: y.i, why: "POWER 0 (ทรายดูด)" })) : []) },
  // กรุงลงกา (Land): {ยักษ์} Avatars in the hand may pay a {ยักษ์} summon with their POWER as GEM
  "BT05-069": { powerGem: "ยักษ์" },
  // ฐานหุ่นนักรบผู้กล้า ซีทันยาน (Land): once per turn, with no Modification used yet: two "อาวุธหุ่นนักรบผู้กล้า" may be used this turn and no other Modification
  "BT05-070": { activate: { label: "เทิร์นนี้ใช้อาวุธหุ่นนักรบผู้กล้าได้ 2 ใบ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && !s.mu[L.p].D, run: (c) => ({ explain: "เทิร์นนี้ใช้ อาวุธหุ่นนักรบผู้กล้า ได้ 2 ใบ (ใช้ Modification อื่นไม่ได้)", ops: [{ op: "twoWeapons", seat: c.seat, name: "อาวุธหุ่นนักรบผู้กล้า" }] }) } },
});
// เฮล่า: milled or put into the hand by a purple {เทพ} Avatar, with "แอสการ์ดคือสถานที่ไม่ใช่ผู้คน" on the Land Magic Zone and a purple {เทพ} of ours: summoned free
const purpleGod = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "เทพ") && E.colors(s, x).includes("ม่วง");
const helaCall = (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const L = E.locate(s, x.i);
  if (!s.land || !E.named(s, s.land, "แอสการ์ดคือสถานที่ไม่ใช่ผู้คน")) return { explain: "บน Land Magic Zone ไม่มี แอสการ์ดคือสถานที่ไม่ใช่ผู้คน", ops: [] };
  if (!s.P[p].av.some((y) => purpleGod(E, s, y))) return { explain: "ไม่มี Avatar {เทพ} สีม่วงบน Avatar Zone เรา", ops: [] };
  if (!L || !["hand", "hell"].includes(L.z) || E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6) return { explain: "อัญเชิญไม่ได้", ops: [] };
  return { explain: `อัญเชิญ ${E.name(s, x)} โดยไม่ต้องจ่าย Cost`, ops: [{ op: "put", i: x.i }] }; };
SCRIPTS["BT05-026"] = { milled: helaCall, millBy: "godAv", handed: helaCall, handedOk: (E, s, x, src) => !!src && ["A", "T"].includes(src.t) && String(src.sy || "").includes("เทพ") && src.co === "ม่วง",
  activate: { label: "ธรณีสูบสูงสุด 5 ใบ: Avatar {เทพ} สีม่วงฝ่ายเรา POWER + จำนวนนั้นจนจบเทิร์น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].deck.length > 0 && s.P[L.p].av.some((y) => purpleGod(E, s, y)),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const max = Math.min(5, P.deck.length); const opts = Array.from({ length: max }, (_, k) => `ธรณีสูบ ${max - k} ใบ`);
      const n = max - c.mode(opts, "ธรณีสูบกี่ใบ", P.deck.length > 20 ? 0 : Math.max(0, max - 1)); const t = c.choose(P.av.filter((y) => purpleGod(E, s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar {เทพ} สีม่วงฝ่ายเรา", { exact: true })[0];
      return t ? { explain: `ธรณีสูบ ${n} ใบ · ${E.name(s, t)} POWER +${n} จนจบเทิร์น`, ops: [{ op: "mill", seat: p, n }, { op: "power", i: t.i, n, temp: true }] } : { explain: "ไม่มี Avatar {เทพ} สีม่วง", ops: [] }; } } };
function blackCode(E, s, p) { const P = s.P[p]; const a = P.av.find((y) => E.named(s, y, "คุณเชิดชัย Super Air")), b = P.av.find((y) => isPlane(E, s, y)); if (!a || !b) return [];
  const rest = uniq(E, s, P.av.filter((y) => y !== a && y !== b && superAir(E, s, y) && E.name(s, y) !== E.name(s, a) && E.name(s, y) !== E.name(s, b))).slice(0, 2); return rest.length === 2 ? [a, b, ...rest] : []; }

// ---------- BT06 ----------
const naga = (E, s, x) => isAv(E, s, x) && E.named(s, x, "นาค") && (sy(E, s, x, "สัตว์วิเศษ") || sy(E, s, x, "สัตว์มหัศจรรย์"));
const holySword = (E, s, m) => E.def(s, m).t === "M" && E.def(s, m).st === "D" && E.named(s, m, "ดาบศักดิ์สิทธิ์");
const saoM = (E, s, x) => isAv(E, s, x) && E.named(s, x, "เสามงคล");
const bankNames = (E, s, p) => new Set(s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "แบงค์")).map((y) => E.name(s, y))).size;
const bank = (E, s, x) => isAv(E, s, x) && E.named(s, x, "แบงค์");
const seven = (E, s, x) => isAv(E, s, x) && E.named(s, x, "มนุษย์ดาว R18");
const valkyrie = (E, s, x) => isAv(E, s, x) && E.named(s, x, "เทพธิดาแห่งวัลฮัลลา");
const bp7 = (E, s, x) => { if (E.power(s, x) >= 7) { x.bp = s.turn; const L = E.locate(s, x.i); E.log(s, L ? L.p : null, `${E.name(s, x)} POWER ${E.power(s, x)} ตอนเริ่ม Battle Phase: ได้รับความสามารถจนจบเทิร์น`); } };
const fromHellMod = (test, who) => ({ label: `ธรณีสูบ 1 ใบ แล้วนำใบนี้จากนรกไปสวมใส่ให้${who}`, can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && !s.mu[L.p].D && s.P[L.p].av.some((y) => test(E, s, y)),
  run: (c) => { const { E, s, seat: p, self: x } = c; const h = c.choose(s.P[p].av.filter((y) => test(E, s, y)).sort(strongFirst(E, s)), 1, `เลือก${who}ที่จะสวมใส่`, { exact: true })[0]; return h ? { explain: `ธรณีสูบ 1 ใบ · ${E.name(s, x)} สวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "mill", seat: p, n: 1 }, { op: "attach", i: x.i, on: h.i }, { op: "useMod", seat: p }] } : { explain: `ไม่มี${who}`, ops: [] }; } });
const blackRed = (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const hill = P.cs.some((y) => !y.mute && E.named(s, y, "หุบเขา 3 พลเอก")); const room = E.avatars(P) < 4 && P.av.length < 6;
  if (!hill) { const top = P.deck[0]; if (!top) return { explain: "Deck หมด", ops: [] }; const ok = room && isAv(E, s, top) && sy(E, s, top, "คน") && (E.def(s, top).c || 0) <= 3;
    return { explain: `สอดแนม 1 ใบ: ${E.name(s, top)}${ok ? " · อัญเชิญ" : " · ไว้ใต้ Deck"}`, ops: [{ op: "scoutShow", seat: p, ids: [top.i] }, ok ? { op: "put", i: top.i } : { op: "move", i: top.i, to: "deckBottom" }] }; }
  const { top, t } = scoutPick(c, 3, (y) => isAv(E, s, y) && sy(E, s, y, "คน") && (E.def(s, y).c || 0) <= 4 && E.colors(s, y).includes("เขียว"), "หุบเขา 3 พลเอก: เลือก Avatar {คน} สีเขียว Cost ไม่เกิน 4 เพื่ออัญเชิญ"); if (!top.length) return { explain: "Deck หมด", ops: [] };
  const put = t && room; return { explain: `หุบเขา 3 พลเอก: สอดแนม ${top.length} ใบ${put ? ` · อัญเชิญ ${E.name(s, t)}` : ""} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(put ? [{ op: "put", i: t.i }] : []), ...restOps(p, top, put ? [t] : [])] }; };
const lobster = (c) => { const { E, s, seat: p, self: x } = c; const L = x && E.locate(s, x.i); if (!L || L.z !== "hand" || E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6) return { explain: "อัญเชิญไม่ได้", ops: [] };
  const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "คุณบลูลอบสเตอร์: เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
  return { explain: `แสดงการ์ดแล้วอัญเชิญ ${E.name(s, x)}${t ? ` · ทำลาย ${E.name(s, t)}` : ""}`, ops: [{ op: "put", i: x.i }, ...(t ? [{ op: "destroy", i: t.i, why: "คุณบลูลอบสเตอร์" }] : [])] }; };
const saoSave = (E, s, x, L) => { const y = [...s.P[L.p].av, ...s.P[L.p].mg.filter((m) => m.on == null)].find((z) => z.i !== x.i && saoM(E, s, z)); if (!y) return false; E.log(s, L.p, `ส่ง ${E.name(s, y)} ลงนรกแทน ${E.name(s, x)}`); E.moveTo(s, y.i, "hell"); return true; };
Object.assign(SCRIPTS, {
  "SD04-016": { cast: blackRed },
  // วิรูฬ นาคเกล็ดทอง: POWER 7+ at the start of the Battle Phase: LIFE it flips by attacking have no abilities this turn
  "BT06-001": { battleStart: bp7, lifeQuiet: (E, s, x) => x.bp === s.turn },
  // ฉัพพยา นาคเกล็ดรุ้ง: POWER 7+ at the start of the Battle Phase: a successful LIFE attack deals 2 damage this turn
  "BT06-002": { battleStart: bp7, lifeHits: (E, s, x) => (x.bp === s.turn ? 2 : 1) },
  // อนันต์ ราชาแห่งนาค: once per turn, our other นาค take its POWER this turn · after its attack destroys an Avatar, the opponent flips 1 LIFE
  "BT06-004": { activate: { label: "Avatar นาค ใบอื่นฝ่ายเรามี POWER เท่าการ์ดใบนี้จนจบเทิร์น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i && naga(E, s, y) && E.power(s, y) < E.power(s, x)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const v = E.power(s, x); const ts = s.P[p].av.filter((y) => y.i !== x.i && naga(E, s, y)); return { explain: `Avatar นาค ${ts.length} ใบ POWER เป็น ${v} จนจบเทิร์น`, ops: ts.map((y) => ({ op: "setPower", i: y.i, v, temp: true })) }; } },
    win: (c) => ({ explain: "ฝ่ายตรงข้ามหงาย LIFE 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] }) },
  // รีวิวแมน: wears any Modification regardless of its wearing condition
  "BT06-005": { anyMod: true },
  // อาเธอร์: only one on our Avatar Zone · จุติ 2 "ดาบศักดิ์สิทธิ์" from the Deck to hell: an "อัศวินโต๊ะกลม" from the Deck; Avatars of ours with its name cannot attack or use abilities this turn
  "BT06-006": { uniq: true, summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const sw = P.deck.filter((y) => holySword(E, s, y)).slice(0, 2); if (sw.length < 2) return { explain: "ใน Deck มีดาบศักดิ์สิทธิ์ไม่ถึง 2 ใบ", ops: [] };
    const t = c.choose(uniq(E, s, P.deck.filter((y) => knight(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกอัศวินโต๊ะกลมจาก Deck เพื่ออัญเชิญ", { exact: true })[0]; if (!t || E.avatars(P) >= 4) return { explain: "ไม่มีอัศวินโต๊ะกลมใน Deck", ops: [] };
    const same = P.av.filter((y) => E.name(s, y) === E.name(s, t));
    return { explain: `ส่ง ${sw.map((y) => E.name(s, y)).join(", ")} ลงนรก · อัญเชิญ ${E.name(s, t)} · ชื่อนี้โจมตีและใช้ความสามารถไม่ได้จนจบเทิร์น`, ops: [...sw.map((y) => ({ op: "move", i: y.i, to: "hell" })), { op: "put", i: t.i }, { op: "shuffle", seat: p }, ...[t, ...same].map((y) => ({ op: "stun", i: y.i }))] }; } },
  // เคย์: once per turn in the opponent's turn, when our knight is attacked: a "ดาบศักดิ์สิทธิ์" of ours to hell: a knight +2 this turn
  "BT06-007": { answer: { label: "ส่งดาบศักดิ์สิทธิ์ลงนรก: อัศวินโต๊ะกลม POWER +2", can: (E, s, x, L) => { if (L.z !== "av" || !s.pend || s.pend.tk !== "av") return false; const T = E.locate(s, s.pend.ti); return !!T && T.p === L.p && knight(E, s, T.x) && s.P[L.p].mg.some((m) => holySword(E, s, m)); },
      botOk: (E, s, x, L, ap) => { const T = E.locate(s, s.pend.ti); return !!T && E.power(s, T.x) <= ap && E.power(s, T.x) + 2 > ap; },
      run: (c) => { const { E, s, seat: p } = c; const T = s.pend && E.locate(s, s.pend.ti); const sws = s.P[p].mg.filter((m) => holySword(E, s, m)).sort((a, b) => (a.on === (T && T.x.i)) - (b.on === (T && T.x.i))); const sw = c.choose(sws, 1, "เลือกดาบศักดิ์สิทธิ์ที่จะส่งลงนรก", { exact: true })[0];
        const k = c.choose([...(T ? [T.x] : []), ...s.P[p].av.filter((y) => knight(E, s, y) && (!T || y.i !== T.x.i))], 1, "เลือกอัศวินโต๊ะกลมที่จะได้ POWER +2", { exact: true })[0];
        return sw && k ? { explain: `${E.name(s, sw)} ลงนรก · ${E.name(s, k)} POWER +2 จนจบเทิร์น`, ops: [{ op: "move", i: sw.i, to: "hell" }, { op: "power", i: k.i, n: 2, temp: true }] } : { explain: "", ops: [] }; } } },
  // ยอดนักบุญ: จุติ our other Avatars' "น้ำใจ" come to this one · with 4 น้ำใจ its base POWER is 10
  "BT06-008": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const ms = s.P[p].mg.filter((m) => m.on != null && m.on !== x.i && E.named(s, m, "น้ำใจ") && s.P[p].av.some((y) => y.i === m.on));
      return { explain: ms.length ? `น้ำใจ ${ms.length} ใบ มาสวมใส่ที่การ์ดใบนี้` : "ไม่มีน้ำใจบน Avatar อื่น", ops: ms.map((m) => ({ op: "attach", i: m.i, on: x.i })) }; },
    aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].mg.filter((m) => m.on === src.i && E.named(s, m, "น้ำใจ")).length >= 4 ? [{ seat: L.p, test: (x) => x.i === src.i, n: 10 - (E.def(s, src).pw || 0) }] : []) },
  // โปรโตไมเกรน: after its attack destroys an Avatar: to hell, "หุ่นนักรบผู้กล้า : ไมเกรน" from the Deck with จุติ, its worn cards move over
  "BT06-009": { win: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "av") return { explain: "", ops: [] }; const mg = s.P[p].deck.find((y) => isAv(E, s, y) && E.name(s, y) === "หุ่นนักรบผู้กล้า : ไมเกรน"); if (!mg) return { explain: "ไม่มีไมเกรนใน Deck", ops: [] };
    if (c.mode(["ส่งใบนี้ลงนรก แล้วอัญเชิญไมเกรนจาก Deck", "ไม่ใช้"], "โปรโตไมเกรน", 0) !== 0) return { explain: "ไม่ใช้ความสามารถ", ops: [] }; const worn = [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === x.i);
    return { explain: `โปรโตไมเกรนลงนรก · อัญเชิญ ${E.name(s, mg)} แบบจุติ${worn.length ? ` · การ์ดที่สวมใส่ ${worn.length} ใบย้ายไปด้วย` : ""}`, ops: [{ op: "move", i: x.i, to: "hell" }, { op: "put", i: mg.i, jt: true }, { op: "shuffle", seat: p }, ...worn.map((m) => ({ op: "attach", i: m.i, on: mg.i }))] }; } },
  // กัปตัน 7 สี: จุติ choose by the colours of our other Avatars: red +2 · blue draw 1 · purple mill 1, then 1 card from hell under the Deck · green not destroyed this turn
  "BT06-012": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const co = new Set(s.P[p].av.filter((y) => y.i !== x.i).flatMap((y) => E.colors(s, y))); const opts = ["แดง", "ฟ้า", "เขียว", "ม่วง"].filter((k) => co.has(k));
    if (!opts.length) return { explain: "ไม่มี Avatar ใบอื่นบน Avatar Zone เรา", ops: [] }; const k = opts[c.mode(opts.map((o) => ({ แดง: "สีแดง: POWER +2", ฟ้า: "สีฟ้า: จั่ว 1 ใบ", ม่วง: "สีม่วง: ธรณีสูบ 1 แล้วนำการ์ดในนรก 1 ใบเข้าใต้ Deck", เขียว: "สีเขียว: ไม่ถูกทำลายจนจบเทิร์น" })[o]), "กัปตัน 7 สี: เลือกปฏิบัติ", 0)];
    if (k === "แดง") return { explain: "POWER +2", ops: [{ op: "power", i: x.i, n: 2, temp: false }] }; if (k === "ฟ้า") return { explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: p, n: 1 }] }; if (k === "เขียว") return { explain: "ไม่ถูกทำลายจนจบเทิร์น", ops: [{ op: "ind", i: x.i }] };
    const top = s.P[p].deck[0]; const back = c.choose([...(top ? [top] : []), ...s.P[p].hell].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดในนรกที่จะนำเข้าใต้ Deck", { exact: true })[0];
    return { explain: `ธรณีสูบ 1 ใบ${back ? ` · ${E.name(s, back)} เข้าใต้ Deck` : ""}`, ops: [{ op: "mill", seat: p, n: 1 }, ...(back ? [{ op: "move", i: back.i, to: "deckBottom" }] : [])] }; } },
  // คุณบลูลอบสเตอร์: drawn in the Draw Phase with "บึงทมิฬ" on the Land Magic Zone, or put into the hand by a "บึงทมิฬ": summoned, then destroys an opposing Avatar
  "BT06-013": { drawn: lobster, drawnOk: (E, s) => !!s.land && !s.land.mute && E.named(s, s.land, "บึงทมิฬ"), handed: lobster, handedOk: (E, s, x, src) => !!src && String(src.n || "").includes("บึงทมิฬ") },
  // สวีนนีย์: an Avatar it destroys in a fight comes to our Magic Zone as "ข้ารับใช้ของ มนุษย์ดาว R18" {เอเลี่ยน} · คำสั่งเสีย: one servant goes to its owner's hell
  "BT06-014": { kill: (c) => { const { E, s, seat: p } = c; const L = c.t.dead != null ? E.locate(s, c.t.dead) : null; return L && L.z === "hell" ? { explain: `${E.name(s, L.x)} กลายเป็นข้ารับใช้ใน Magic Zone เรา`, ops: [{ op: "enslave", i: L.x.i, seat: p }] } : { explain: "", ops: [] }; },
    death: (c) => { const { E, s, seat: p } = c; const t = s.P[p].mg.filter((m) => m.srv && m.on == null).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `ฝ่ายตรงข้ามเลือก ${E.name(s, t)} ลงนรกเจ้าของเดิม`, ops: [{ op: "move", i: t.i, to: "hell" }] } : { explain: "ไม่มีข้ารับใช้ใน Magic Zone", ops: [] }; } },
  // จอย: once per turn a servant from our Magic Zone is summoned; it goes back there in the End Phase
  "BT06-016": { activate: { label: "อัญเชิญข้ารับใช้จาก Magic Zone (กลับที่เดิมเมื่อจบเทิร์น)", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].mg.some((m) => m.srv && m.on == null),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].mg.filter((m) => m.srv && m.on == null).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกข้ารับใช้ใน Magic Zone", { exact: true })[0];
      return t ? { explain: `อัญเชิญ ${E.def(s, t).n} (ข้ารับใช้) · กลับ Magic Zone เมื่อจบเทิร์น`, ops: [{ op: "put", i: t.i, here: true }, { op: "atEnd", turn: s.turn, ops: [{ op: "move", i: t.i, to: "mg", seat: p, onlyFrom: "av" }], why: "ข้ารับใช้กลับ Magic Zone" }] } : { explain: "ไม่มีข้ารับใช้", ops: [] }; } } },
  // วิลโล่ ปลาแกะ: counts as {สัตว์} too
  "BT06-017": { extraSy: "สัตว์" },
  // จ่ามะนาวแขนเหล็ก: when our "จ่ามะนาว" of Cost 3 or less is destroyed: summoned from the hand by paying (free in critical state)
  "BT06-018": { handDeath: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hand" || E.avatars(s.P[p]) >= 4) return { explain: "อัญเชิญไม่ได้", ops: [] }; const free = E.critical(s.P[p]);
      return { explain: `อัญเชิญ ${E.name(s, x)} จากมือ${free ? " โดยไม่ต้องจ่าย Cost (สาหัส)" : " โดยจ่าย Cost"}`, ops: [free ? { op: "put", i: x.i } : { op: "payPut", seat: p, i: x.i }] }; },
    handDeathOk: (E, s, y, dead) => E.named(s, dead, "จ่ามะนาว") && (E.def(s, dead).c || 0) <= 3 && E.avatars(s.P[y.o]) < 4 && (E.critical(s.P[y.o]) || !!E.autoPay(s, y.o, y.i)) },
  // ผู้เจริญระดับสูงสุด: once per turn a "เสามงคล" of ours goes from the Avatar Zone to our Magic Zone
  "BT06-019": { activate: { label: "นำเสามงคลจาก Avatar Zone ไปไว้ที่ Magic Zone", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => saoM(E, s, y)) && (s.P[L.p].av.some((y) => E.named(s, y, "เสาซินแสมงคล")) || !(s.P[L.p].bot || s.mode === "sim")),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => saoM(E, s, y)), 1, "เลือกเสามงคล", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไปอยู่ที่ Magic Zone`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }] } : { explain: "", ops: [] }; } } },
  // ฮิฟีสตัส: GEM 5 when paid for a Construct
  "BT06-021": { gemFor: (td) => (td && td.t === "C" ? 5 : null) },
  // แบงค์ผู้พิชิต: by the different "แบงค์" names in our hell: 5 +2 · 7 flips 1 LIFE after a fight win · 10 no React against its attacks · from hell by sending 4 แบงค์ to hell
  "BT06-022": { aura: (E, s, src, L) => (L.z === "av" && bankNames(E, s, L.p) >= 5 ? [{ seat: L.p, test: (x) => x.i === src.i, n: 2 }] : []),
    kill: (c) => (bankNames(c.E, c.s, c.seat) >= 7 ? { explain: "แบงค์ 7 ชื่อในนรก: หงาย LIFE ฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] } : { explain: "แบงค์ในนรกยังไม่ถึง 7 ชื่อ", ops: [] }),
    attack: (c) => (bankNames(c.E, c.s, c.seat) >= 10 ? { explain: "แบงค์ 10 ชื่อในนรก: ฝ่ายตรงข้ามใช้ React ไม่ได้จนจบการต่อสู้", ops: [{ op: "noReact" }] } : { explain: "แบงค์ในนรกยังไม่ถึง 10 ชื่อ", ops: [] }),
    activate: { label: "ส่งแบงค์ 4 ใบจาก Avatar Zone ลงนรก: อัญเชิญใบนี้จากนรก", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.filter((y) => bank(E, s, y)).length >= 4,
      run: (c) => { const { E, s, seat: p, self: x } = c; const four = c.choose(s.P[p].av.filter((y) => bank(E, s, y)).sort(cheapCard(E, s)), 4, "เลือกแบงค์ 4 ใบที่จะส่งลงนรก", { exact: true }); if (four.length < 4) return { explain: "แบงค์ไม่ครบ 4 ใบ", ops: [] };
        return { explain: `ส่งแบงค์ 4 ใบลงนรก · อัญเชิญ ${E.name(s, x)} จากนรก`, ops: [...four.map((y) => ({ op: "move", i: y.i, to: "hell" })), { op: "put", i: x.i }] }; } } },
  // พี่หน่วง: once per turn discard 2: an opposing Avatar and this card go to our Magic Zone; this one returns at the start of our next Main Phase
  "BT06-024": { activate: { label: "ทิ้ง 2 ใบ: นำ Avatar ฝ่ายตรงข้ามและใบนี้ไป Magic Zone เรา", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length >= 2 && s.P[1 - L.p].av.some((y) => !E.noAim(s, y)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
      if (pay.length < 2 || !t) return { explain: "ทำไม่ได้", ops: [] };
      return { explain: `ทิ้ง 2 ใบ · ${E.name(s, t)} และ ${E.name(s, x)} ไปอยู่ที่ Magic Zone เรา · ${E.name(s, x)} กลับมาเมื่อเริ่ม Main Phase ถัดไปของเรา`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "move", i: t.i, to: "mg", seat: p }, { op: "move", i: x.i, to: "mg", seat: p }, { op: "later", ops: [{ op: "put", i: x.i, here: true }], why: `${E.name(s, x)} กลับ Avatar Zone` }] }; } } },
  // เลอติ๊ก: an Avatar it destroys in a fight goes back into the Deck instead of hell
  "BT06-025": { kill: (c) => { const { E, s } = c; const L = c.t.dead != null ? E.locate(s, c.t.dead) : null; return L && L.z === "hell" ? { explain: `${E.name(s, L.x)} กลับเข้า Deck แทนการลงนรก`, ops: [{ op: "move", i: L.x.i, to: "deckBottom" }, { op: "shuffle", seat: L.x.o }] } : { explain: "", ops: [] }; } },
  // อาม่อน No.7: milled: summoned · destroyed on the Avatar Zone: to the bottom of the Deck instead of hell
  "BT06-030": { milled: (c) => { const { E, s, seat: p, self: x } = c; return x && E.locate(s, x.i)?.z === "hell" && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "put", i: x.i }] } : { explain: "อัญเชิญไม่ได้", ops: [] }; }, millBy: "any", destroyTo: "deckBottom" },
  // งี่เง่า และ งอแง: once per turn: 1) sacrifice it, draw 2 · 2) เตะไข่ this turn, destroyed in the End Phase
  "BT06-031": { activate: { label: "เลือกปฏิบัติ: เซ่นไหว้จั่ว 2 ใบ หรือ ได้รับเตะไข่ (ถูกทำลายเมื่อจบเทิร์น)", can: (E, s, x, L) => L.z === "av" && s.phase === "main",
    run: (c) => { const { E, s, seat: p, self: x } = c; const m = c.mode(["1) เซ่นไหว้ จั่ว 2 ใบ", "2) ได้รับเตะไข่จนจบเทิร์น แล้วถูกทำลายใน End Phase"], "งี่เง่า และ งอแง", E.critical(s.P[1 - p]) && x.a && s.turn > 1 ? 1 : 0);
      return m === 0 ? { explain: "เซ่นไหว้ · จั่ว 2 ใบ", ops: [{ op: "destroy", i: x.i, why: "เซ่นไหว้" }, { op: "draw", seat: p, n: 2 }] } : { explain: "ได้รับเตะไข่จนจบเทิร์น · ถูกทำลายใน End Phase", ops: [{ op: "keyword", i: x.i, k: "เตะไข่", until: "turn" }, { op: "atEnd", turn: s.turn, ops: [{ op: "destroy", i: x.i, why: "งี่เง่า และ งอแง" }] }] }; } } },
  // พีเจี้ยน 3000: once per turn worn by our "เครื่องบิน Super Air": the plane gets โล่มนุษย์ and +1
  "BT06-032": { worn: () => 1, aura: (E, s, src, L) => (L.z === "mg" && src.on != null ? [{ seat: L.p, test: (x) => x.i === src.on, n: 0, kw: ["โล่มนุษย์"] }] : []),
    activate: { label: "ไปสวมใส่ให้เครื่องบิน Super Air", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => isPlane(E, s, y)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[p].av.find((y) => isPlane(E, s, y)); return h ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: x.i, on: h.i }] } : { explain: "", ops: [] }; } } },
  // เสาซินแสมงคล: from the hand by sending ซินแส and เสามงคล to hell (จุติ) · จุติ up to 3 เสามงคล from hell to our Magic Zone · our เสามงคล work from the Magic Zone · another เสามงคล leaves instead of it
  "BT06-033": { mgAbilities: (E, s, me, x) => E.named(s, x, "เสามงคล"), wouldLeave: saoSave, wouldDestroy: (E, s, x, L) => saoSave(E, s, x, L),
    activate: { label: "ส่งซินแสและเสามงคลลงนรก: อัญเชิญใบนี้จากมือแบบจุติ", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && s.P[L.p].av.some((y) => E.named(s, y, "ซินแส")) && s.P[L.p].av.some((y) => saoM(E, s, y)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const a = s.P[p].av.find((y) => E.named(s, y, "ซินแส")); const b = s.P[p].av.find((y) => y !== a && saoM(E, s, y)); return a && b ? { explain: `ส่ง ${E.name(s, a)} และ ${E.name(s, b)} ลงนรก · อัญเชิญ ${E.name(s, x)} แบบจุติ`, ops: [{ op: "move", i: a.i, to: "hell" }, { op: "move", i: b.i, to: "hell" }, { op: "put", i: x.i, jt: true }] } : { explain: "ไม่มีซินแสหรือเสามงคล", ops: [] }; } },
    summon: (c) => { const { E, s, seat: p } = c; const ts = c.choose([...s.P[p].hell].reverse().filter((y) => saoM(E, s, y)), 3, "เลือกเสามงคลในนรกสูงสุด 3 ใบ", { optional: true }); return { explain: ts.length ? `${ts.map((y) => E.name(s, y)).join(", ")} ไปอยู่ที่ Magic Zone` : "ไม่มีเสามงคลในนรก", ops: ts.map((y) => ({ op: "move", i: y.i, to: "mg", seat: p })) }; } },
  // เสามงคล ทรงญี่ปุ่น: cannot attack · once per turn a "ผู้เจริญ" from the hand, +1, sent to hell in our End Phase
  "BT06-034": { noAttack: () => true, activate: { label: "อัญเชิญผู้เจริญจากมือ (POWER +1 ลงนรกเมื่อจบเทิร์น)", can: (E, s, x, L) => (L.z === "av" || E.mgActive(s, x, L)) && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.some((y) => isAv(E, s, y) && E.named(s, y, "ผู้เจริญ")),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && E.named(s, y, "ผู้เจริญ")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกผู้เจริญบนมือ", { exact: true })[0];
      return t ? { explain: `อัญเชิญ ${E.name(s, t)} POWER +1 · ลงนรกเมื่อจบเทิร์น`, ops: [{ op: "put", i: t.i }, { op: "power", i: t.i, n: 1, temp: false }, { op: "atEnd", turn: s.turn, ops: [{ op: "move", i: t.i, to: "hell", onlyFrom: "av" }], why: "ผู้เจริญที่ถูกอัญเชิญลงนรก" }] } : { explain: "", ops: [] }; } } },
  // เสนาธิการ: จุติ with our นิโคไล: destroy an opposing Avatar of lower Cost than it
  "BT06-036": { summon: (c) => { const { E, s, seat: p } = c; const k = c.choose(s.P[p].av.filter((y) => E.named(s, y, "พระเจ้านิโคไล")).sort((a, b) => E.costNow(s, b) - E.costNow(s, a)), 1, "เลือกพระเจ้านิโคไล", { exact: true })[0]; if (!k) return { explain: "ไม่มีพระเจ้านิโคไลบน Avatar Zone", ops: [] };
    const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) < E.costNow(s, k)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost น้อยกว่า ${E.costNow(s, k)}`, { exact: true })[0];
    return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "เสนาธิการ" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // สว นาโนแมชชีน: not destroyed in fights by POWER under 10, nor by Magic · control cannot change
  "BT06-037": { fightImmune: (E, s, me, foe) => E.power(s, foe) < 10, noMagicDestroy: true, noControl: true },
  // แมมมอธแช่แข็ง: cannot attack, cannot wear Modifications
  "BT06-038": { noAttack: () => true, noMod: true },
  // เรนะ: attacking a {กะปอม} destroys it
  "BT06-039": destroyAtTarget("กะปอม"),
  // แมวเก็นไมฉะ: จุติ 1) แมวมัทฉะ from hell · 2) with 2+ other หมา/แมว: the Land คาเฟ่หมาแมว from the Deck
  "BT06-040": { summon: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const m = [...P.hell].reverse().find((y) => isAv(E, s, y) && E.named(s, y, "แมวมัทฉะ")); const pets = P.av.filter((y) => (!x || y.i !== x.i) && (E.named(s, y, "หมา") || E.named(s, y, "แมว"))).length;
    const land = P.deck.find((y) => E.named(s, y, "คาเฟ่หมาแมว")); const k = c.mode(["1) อัญเชิญแมวมัทฉะจากนรก", "2) คาเฟ่หมาแมวจาก Deck ขึ้นมือ"], "แมวเก็นไมฉะ: เลือกปฏิบัติ", m && E.avatars(P) < 4 ? 0 : 1);
    if (k === 0) return m && E.avatars(P) < 4 ? { explain: `อัญเชิญ ${E.name(s, m)} จากนรก`, ops: [{ op: "put", i: m.i }] } : { explain: "ไม่มีแมวมัทฉะในนรก", ops: [] };
    return pets >= 2 && land ? { explain: `${E.name(s, land)} ขึ้นมือ`, ops: [{ op: "search", seat: p, take: land.i, to: "hand" }] } : { explain: "หมาหรือแมวใบอื่นไม่ถึง 2 ใบ หรือไม่มีคาเฟ่หมาแมวใน Deck", ops: [] }; } },
  // งานวิจัยของพระพรหม: discard the hand: 3 or more → draw 5 · with พระพรหม: any card from the Deck instead
  "BT06-045": { canCast: (E, s, p) => s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const hand = s.P[p].hand.filter((y) => y.i !== c.t.i); const brahma = s.P[p].av.some((y) => E.named(s, y, "พระพรหม"));
    if (brahma) { const t = c.choose([...s.P[p].deck].sort((a, b) => worth(E, s, b) - worth(E, s, a)).slice(0, 40), 1, "เลือกการ์ดที่ชอบจาก Deck", { exact: true })[0]; return { explain: `ทิ้งมือ ${hand.length} ใบ · ${t ? E.name(s, t) + " ขึ้นมือ" : "Deck ว่าง"}`, ops: [{ op: "discard", seat: p, iids: hand.map((y) => y.i) }, ...(t ? [{ op: "search", seat: p, take: t.i, to: "hand" }] : [])] }; }
    return { explain: `ทิ้งมือ ${hand.length} ใบ${hand.length >= 3 ? " · จั่ว 5 ใบ" : " (ไม่ถึง 3 ใบ)"}`, ops: [{ op: "discard", seat: p, iids: hand.map((y) => y.i) }, ...(hand.length >= 3 ? [{ op: "draw", seat: p, n: 5 }] : [])] }; } },
  // คำสั่งของพระอิศวร: 1) an opposing Avatar -2 · 2) an opposing Construct -2 · both with พระอิศวร
  "BT06-046": { cast: (c) => { const { E, s, seat: p } = c; const O = s.P[1 - p]; const both = s.P[p].av.some((y) => E.named(s, y, "พระอิศวร")); const m = both ? 2 : c.mode(["1) Avatar ฝ่ายตรงข้าม POWER -2", "2) Construct ฝ่ายตรงข้าม POWER -2"], "คำสั่งของพระอิศวร", O.av.length ? 0 : 1);
    const a = m !== 1 ? c.choose(O.av.filter((y) => !E.noAim(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้าม")[0] : null; const k = m !== 0 ? c.choose([...O.cs].sort(strongFirst(E, s)), 1, "เลือก Construct ฝ่ายตรงข้าม")[0] : null;
    return { explain: [a && `${E.name(s, a)} POWER -2`, k && `${E.name(s, k)} POWER -2`].filter(Boolean).join(" · ") || "ไม่มีเป้าหมาย", ops: [...(a ? [{ op: "power", i: a.i, n: -2, temp: false }] : []), ...(k ? [{ op: "power", i: k.i, n: -2, temp: false }] : [])] }; } },
  // จิตมุ่งมั่นของพระนารายณ์: one of our Avatars +1 this turn (up to 3 with พระนารายณ์)
  "BT06-047": { cast: (c) => { const { E, s, seat: p } = c; const n = s.P[p].av.some((y) => E.named(s, y, "พระนารายณ์")) ? 3 : 1; const ts = c.choose([...s.P[p].av].sort(strongFirst(E, s)), n, `เลือก Avatar ฝ่ายเราสูงสุด ${n} ใบ`, { optional: n > 1 });
    return { explain: ts.length ? `${ts.map((y) => E.name(s, y)).join(", ")} POWER +1 จนจบเทิร์น` : "ไม่มี Avatar", ops: ts.map((y) => ({ op: "power", i: y.i, n: 1, temp: true })) }; } },
  // เฮือกสุดท้าย: critical only: draw 4, and one more Normal Magic this turn
  "BT06-048": { canCast: (E, s, p) => E.critical(s.P[p]), cast: (c) => ({ explain: "จั่ว 4 ใบ · เทิร์นนี้ใช้ Normal Magic อื่นได้อีก 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 4 }, { op: "extraN", seat: c.seat, not: "เฮือกสุดท้าย" }] }) },
  // แผนลับของเหล่าพลเอก: 3 different "พลเอก" to hell: every card on the opponent's field and hand to hell; up to 3 different "ทหาร"/"รด." from the Deck
  "BT06-049": { canCast: (E, s, p) => new Set(s.P[p].av.filter((y) => E.named(s, y, "พลเอก")).map((y) => E.name(s, y))).size >= 3,
    cast: (c) => { const { E, s, seat: p } = c; const gens = uniq(E, s, s.P[p].av.filter((y) => E.named(s, y, "พลเอก"))).slice(0, 3); if (gens.length < 3) return { explain: "พลเอกไม่ครบ 3 ชื่อ", ops: [] };
      const pool = uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && (E.named(s, y, "ทหาร") || E.named(s, y, "รด.")))).sort((a, b) => worth(E, s, b) - worth(E, s, a)).slice(0, 3);
      return { explain: `ส่งพลเอก 3 ใบลงนรก · การ์ดบนสนามและบนมือฝ่ายตรงข้ามลงนรกทั้งหมด · อัญเชิญ ${pool.length} ใบจาก Deck`, ops: [...gens.map((y) => ({ op: "move", i: y.i, to: "hell" })), { op: "wipe", seat: 1 - p }, ...pool.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; } },
  // ช่างมาแล้ววว (React): a Construct of ours that would be destroyed is not
  "BT06-050": { react: { kinds: ["attack", "cast", "activate", "summon"], can: (E, s, p, on) => (on.kind === "attack" ? on.tk === "cs" && E.locate(s, on.ti)?.p === p : s.P[p].cs.length > 0),
      botV: (E, s, q, on) => { if (on.kind !== "attack" || on.tk !== "cs") return -9; const A = E.locate(s, on.att), T = E.locate(s, on.ti); return A && T && E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) > E.power(s, T.x) ? 6 : -9; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const T = on.kind === "attack" && on.tk === "cs" ? E.locate(s, on.ti) : null; const t = T ? T.x : c.choose([...s.P[p].cs].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Construct ที่จะไม่ถูกทำลาย", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} จะไม่ถูกทำลาย`, ops: [{ op: "ind", i: t.i }] } : { explain: "ไม่มี Construct", ops: [] }; } },
  // ธาตุไฟแตก ๆ (React): one of ours to hell, roll: even destroys 2 opposing Avatars, odd destroys 1 of ours
  "BT06-051": { react: { kinds: ["attack", "summon", "cast", "activate", "battle", "react"], can: (E, s, p) => s.P[p].av.length > 0,
      botV: (E, s, q) => (s.P[1 - q].av.length >= 2 && s.P[q].av.length >= 2 ? 2 : -9) },
    cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].av].sort(cheapCard(E, s)), 1, "ส่ง Avatar ฝ่ายเรา 1 ใบลงนรก", { exact: true })[0]; if (!pay) return { explain: "ไม่มี Avatar", ops: [] };
      const foes = s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)).slice(0, 2); const mine = s.P[p].av.filter((y) => y.i !== pay.i).sort(cheapCard(E, s))[0];
      return { explain: `ส่ง ${E.name(s, pay)} ลงนรก · ทอยลูกเต๋า (คู่: ทำลาย Avatar ฝ่ายตรงข้าม 2 ใบ · คี่: ทำลาย Avatar ฝ่ายเรา 1 ใบ)`, ops: [{ op: "move", i: pay.i, to: "hell" }, { op: "roll", sides: 6, why: "ธาตุไฟแตก ๆ", even: foes.map((y) => ({ op: "destroy", i: y.i, why: "ธาตุไฟแตก ๆ" })), odd: mine ? [{ op: "destroy", i: mine.i, why: "ธาตุไฟแตก ๆ" }] : [] }] }; } },
  // ไสยเวท ย้อนกลับ: when the wearer attacks, mill 2: a Magic among them wakes the wearer (4 times a turn)
  "BT06-055": { worn: () => 0, hostAttack: (c) => { const { E, s, seat: p, self: m } = c; if (!m || m.on == null) return { explain: "", ops: [] }; m.n55 = m.n55 && m.n55.t === s.turn ? m.n55 : { t: s.turn, n: 0 }; if (m.n55.n >= 4) return { explain: "ใช้ครบ 4 ครั้งในเทิร์นนี้แล้ว", ops: [] }; m.n55.n++;
    const H = E.locate(s, m.on); const top = s.P[H ? H.p : p].deck.slice(0, 2); const magic = top.some((y) => E.def(s, y).t === "M");
    return { explain: `ธรณีสูบ 2 ใบ${magic ? " · มี Magic: Avatar ที่สวมใส่กลับมาตื่น" : ""}`, ops: [{ op: "mill", seat: H ? H.p : p, n: 2 }, ...(magic && H ? [{ op: "wake", i: H.x.i }] : [])] }; } },
  // เท่ระเบิด !!!!: only "ทหาร"/"รด." · when the wearer attacks: +5 for the fight, then the wearer is destroyed
  "BT06-056": { modOnly: (E, s, h) => E.named(s, h, "ทหาร") || E.named(s, h, "รด."), worn: () => 0,
    hostAttack: (c) => { const { E, s, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; return H ? { explain: `${E.name(s, H.x)} POWER +5 จนจบการต่อสู้ แล้วถูกทำลาย`, ops: [{ op: "power", i: H.x.i, n: 5, temp: "fight" }, { op: "afterFight", ops: [{ op: "destroy", i: H.x.i, why: "เท่ระเบิด !!!!" }] }] } : { explain: "", ops: [] }; } },
  // กองถ่ายฤาษี: only {ฤษี} · in its fights the opposing Avatar -1 for the fight
  "BT06-057": { modOnly: (E, s, h) => sy(E, s, h, "ฤษี"), worn: () => 0, hostFight: (c) => { const { E, s } = c; const f = c.t.foe != null ? E.locate(s, c.t.foe) : null; return f ? { explain: `${E.name(s, f.x)} POWER -1 จนจบการต่อสู้`, ops: [{ op: "power", i: f.x.i, n: -1, temp: "fight" }] } : { explain: "", ops: [] }; } },
  // ดาบศักดิ์สิทธิ์ แกลลาติน: only knights · an awake wearer is not destroyed by Magic · from hell like the other holy swords
  "BT06-058": { modOnly: (E, s, h) => knight(E, s, h), worn: () => 0, awakeMagicGuard: true, activate: fromHellMod(knight, "อัศวินโต๊ะกลม") },
  // นรกในกรง (Land): 3 Avatars each at most
  "BT06-059": { cap3: true, check: (E, s, x, L) => (L.z === "land" ? [0, 1].flatMap((q) => { const real = s.P[q].av.filter((y) => !y.tok); return real.length > 3 ? [...real].sort(cheapCard(E, s)).slice(0, real.length - 3).map((y) => ({ op: "move", i: y.i, to: "hell" })) : []; }) : []) },
  // คาเฟ่หมาแมว (Land): once per turn in our End Phase: a หมา/แมว back into the Deck, a different-name one from the Deck, then a หมา/แมว +1
  "BT06-060": { endPhase: (E, s, x, L) => { if (L.z === "land" && L.p === s.active && x.used !== s.turn && s.P[L.p].av.some((y) => dogCat(E, s, y)) && s.P[L.p].deck.some((y) => dogCat(E, s, y))) E.addTrig(s, L.p, x, "cafe", { optional: true }); return []; },
    cafe: (c) => { const { E, s, seat: p, self: x } = c; if (x) x.used = s.turn; const back = c.choose(s.P[p].av.filter((y) => dogCat(E, s, y)).sort(cheapCard(E, s)), 1, "เลือกหมาหรือแมวกลับเข้า Deck", { exact: true })[0]; if (!back) return { explain: "", ops: [] };
      const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => dogCat(E, s, y) && E.name(s, y) !== E.name(s, back))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกหมาหรือแมวจาก Deck ที่ชื่อไม่ซ้ำ", { exact: true })[0];
      const plus = c.choose([...(t ? [t] : []), ...s.P[p].av.filter((y) => y !== back && dogCat(E, s, y))], 1, "เลือกหมาหรือแมวที่จะได้ POWER +1", { exact: true })[0];
      return { explain: `${E.name(s, back)} กลับเข้า Deck${t ? ` · อัญเชิญ ${E.name(s, t)}` : ""}${plus ? ` · ${E.name(s, plus)} POWER +1` : ""}`, ops: [{ op: "move", i: back.i, to: "deckBottom" }, ...(t ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }, ...(plus ? [{ op: "power", i: plus.i, n: 1, temp: false }] : [])] }; } },
  // สภาแบงค์ (Land): "แบงค์" Avatars in hand Cost -1 and their GEM is colourless
  "BT06-061": { costAll: (E, s, x) => (bank(E, s, x) && E.locate(s, x.i)?.z === "hand" ? -1 : 0), colorlessGem: (E, s, x) => bank(E, s, x) },
  // ถ้ำนาคา (Land): นาค +1
  "BT06-062": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((seat) => ({ seat, test: (x) => naga(E, s, x), n: 1 })) : []) },
  // ประตูวัลฮัลลา (Land): once per turn mill 2: a "เทพธิดาแห่งวัลฮัลลา" from our hell to the hand
  "BT06-063": { activate: { label: "ธรณีสูบ 2 ใบ: เทพธิดาแห่งวัลฮัลลาจากนรกขึ้นมือ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && (s.P[L.p].hell.some((y) => valkyrie(E, s, y)) || s.P[L.p].deck.slice(0, 2).some((y) => valkyrie(E, s, y))),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, [...s.P[p].deck.slice(0, 2), ...s.P[p].hell].filter((y) => valkyrie(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกเทพธิดาแห่งวัลฮัลลาในนรก", { exact: true })[0];
      return t ? { explain: `ธรณีสูบ 2 ใบ · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "mill", seat: p, n: 2 }, { op: "move", i: t.i, to: "hand" }] } : { explain: "", ops: [] }; } } },
  // รูปปั้นพระอิศวร (Construct): in our Draw Phase scout 2 and take a {เทพ} instead of the normal draw
  "BT06-065": { replacesDraw: true, drawPhase: (c) => { const { E, s, seat: p } = c; const n = c.t.n || 1; const m = c.mode(["สอดแนม 2 ใบ เลือกการ์ด {เทพ} ขึ้นมือ (แทนการจั่ว)", `จั่วปกติ ${n} ใบ`], "รูปปั้นพระอิศวร", n === 1 ? 0 : 1);
    if (m === 1) return { explain: `จั่วปกติ ${n} ใบ`, ops: [{ op: "draw", seat: p, n }] }; const { top, t } = scoutPick(c, 2, (y) => sy(E, s, y, "เทพ"), "เลือกการ์ด {เทพ} จากที่สอดแนม"); if (!top.length) return { explain: "Deck หมด", ops: [{ op: "draw", seat: p, n: 1 }] };
    return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [])] }; } },
  // ยานสำรวจ R18 (Construct): once per turn with a "มนุษย์ดาว R18" on our Avatar Zone: an Avatar of Cost 5+ from the opponent's hell becomes our servant
  "BT06-066": { activate: { label: "นำ Avatar Cost 5+ จากนรกฝ่ายตรงข้ามมาเป็นข้ารับใช้", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].av.some((y) => seven(E, s, y)) && s.P[1 - L.p].hell.some((y) => isAv(E, s, y) && (E.def(s, y).c || 0) >= 5),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].hell.filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) >= 5).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ในนรกฝ่ายตรงข้าม", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} มาเป็นข้ารับใช้ใน Magic Zone เรา`, ops: [{ op: "enslave", i: t.i, seat: p }] } : { explain: "", ops: [] }; } } },
  // กองไฟลูกเสือ (Construct): our Avatars of Cost 2 or less have สามัคคี
  "BT06-067": { aura: (E, s, src, L) => (L.z === "cs" ? [{ seat: L.p, test: (x) => E.costNow(s, x) <= 2, n: 0, kw: ["สามัคคี"] }] : []) },
  // ป้อมยาม (Construct): the opponent cannot attack our LIFE
  "BT06-068": { lifeGuard: true },
  // หุบเขา 3 พลเอก (Construct): ใบดำใบแดง reads differently and can be used any number of times
  "BT06-069": { freeMagic: (E, s, x) => E.def(s, x).n === "ใบดำใบแดง" },
  // ตู้วารีบำบัด (Construct): in our Draw Phase it may be destroyed: one of our face-up LIFE turns face down
  "BT06-070": { drawPhaseOk: (E, s, x, L) => L.z === "cs" && s.P[L.p].life.some((y) => y.up) && !E.critical(s.P[L.p]),
    drawPhase: (c) => { const { E, s, seat: p, self: x } = c; const up = s.P[p].life.filter((y) => y.up).length; if (!c.interactive && up < 2) return { explain: "ยังไม่ใช้", ops: [] };
      return x && up ? { explain: `ทำลาย ${E.name(s, x)} · คว่ำ LIFE 1 ใบ`, ops: [{ op: "destroy", i: x.i, why: "ตู้วารีบำบัด" }, { op: "lifeFlip", seat: p, up: false }] } : { explain: "", ops: [] }; } },
});
