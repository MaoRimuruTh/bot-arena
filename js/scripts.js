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
    // the bot keeps a traveller in hand until a story form is there to turn into (unless the board is empty)
    botHold: (E, s, x, p) => (s.P[p].hand.some((y) => story(E, s, y) && (E.def(s, y).c || 0) === 6) ? 1.5 : s.P[p].av.length ? -3 : 0),
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
// a story form is only worth keeping in the opening hand next to a traveller that can bring it out
const storyKeep = (E, s, x, hand) => hand.some((y) => nm(E, s, y, "นักท่องเรื่องราว"));
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
  "BT09-043": { mullKeep: storyKeep,
    aura: (E, s, src, L) => (src.story && L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: Math.floor(E.magicInHell(s, L.p) / 2) }] : []),
    activate: { label: "ทิ้ง 1 ใบ: นำ Skill จากนรกขึ้นมือ",
      can: (E, s, x, L) => x.story && L.z === "av" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => skill(E, s, y)),
      run: (c) => { const d = c.choose([...c.s.P[c.seat].hand].sort((a, b) => (c.E.def(c.s, a).pw || 0) - (c.E.def(c.s, b).pw || 0)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].hell.filter((y) => skill(c.E, c.s, y))), 1, "เลือก Skill ในนรกที่จะนำขึ้นมือ")[0];
        return { explain: `ทิ้ง ${c.E.name(c.s, d)} · นำ ${c.E.name(c.s, k)} ขึ้นมือ`, ops: [{ op: "discard", seat: c.seat, iids: [d.i] }, { op: "move", i: k.i, to: "hand" }] }; } },
  },
  // ขวัญตา เรื่องราว ครุฑเจ้าเวหา
  "BT09-044": { mullKeep: storyKeep, storyOnly: true,
    attack: (c) => { if (!c.self || !c.self.story) return { explain: "ไม่ได้มาจากนักท่องเรื่องราว", ops: [] };
      const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].deck.filter((y) => skill(c.E, c.s, y))), 1, "นำ Skill จาก Deck ลงนรก (เพิ่ม Magic ในนรก)", { optional: true })[0];
      return k ? { explain: `ส่ง ${c.E.name(c.s, k)} จาก Deck ลงนรก แล้วสับ`, ops: [{ op: "move", i: k.i, to: "hell" }, { op: "shuffle", seat: c.seat }] } : { explain: "ไม่ส่ง Skill ลงนรก", ops: [] }; },
  },
  // มายา เรื่องราว เทพเจ้าสายฟ้า
  "BT11-049": { mullKeep: storyKeep, storyOnly: true,
    summon: (c) => { if (!c.self || !c.self.story) return { explain: "ไม่ได้มาจากนักท่องเรื่องราว", ops: [] };
      const k = c.choose(uniq(c.E, c.s, c.s.P[c.seat].deck.filter((y) => skill(c.E, c.s, y))), 1, "เลือก Skill จาก Deck ขึ้นมือ")[0];
      return k ? { explain: `นำ ${c.E.name(c.s, k)} ขึ้นมือ แล้วสับ Deck`, ops: [{ op: "search", seat: c.seat, take: k.i, to: "hand" }] } : { explain: "ไม่มี Skill ใน Deck", ops: [] }; },
    onMagic: (E, s, x, L) => (x.story && L.z === "av" && x.used !== "m" + s.turn ? ((x.used = "m" + s.turn), [{ op: "power", i: x.i, n: 1, temp: true }]) : []),
  },
  // ขวัญตา เรื่องราว ตำนานอมตะ: mill 2 instead of being destroyed; survives if both are Magic
  "BT12-048": { mullKeep: storyKeep,
    wouldDestroy: (E, s, x, L) => { if (!x.story) return false; const P = s.P[L.p]; const two = P.deck.slice(0, 2);
      E.ops(s, [{ op: "mill", seat: L.p, n: 2 }], L.p); const ok = two.length === 2 && two.every((y) => isMagic(E, s, y));
      E.log(s, L.p, ok ? `${E.name(s, x)} ไม่ถูกทำลาย (ธรณีสูบได้ Magic ทั้ง 2 ใบ)` : `${E.name(s, x)} ธรณีสูบแล้วไม่ได้ Magic ครบ 2 ใบ`); return ok; },
  },
  // ขวัญตา เรื่องราว ผู้กำหนดชีวิต
  "BT12-049": { mullKeep: storyKeep,
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
  // Skill : Second Energy: when a "เรื่องราว" of ours would leave the field by an opposing card: it stays · with 8+ Magic in our hell the opponent exiles a card of their hell
  "BT09-060": { react: { kinds: ["doom"], can: (E, s, p, on) => on.p === p && on.by !== p && [...on.kill, ...on.leave].some((i) => { const L = E.locate(s, i); return L && story(E, s, L.x); }), botV: (E, s, q, on) => doomV(E, s, q, on) + 2 },
    cast: (c) => { const { E, s, seat: p } = c; const L = [...doomed(c, "kill"), ...doomed(c, "leave")].filter((x) => story(E, s, x)); const t = L.length > 1 ? c.choose(L.sort(strongFirst(E, s)), 1, "เลือกเรื่องราวที่จะไม่ออกจากสนาม", { exact: true })[0] : L[0];
      if (!t) return { explain: "เรื่องราวใบนั้นไม่อยู่บนสนามแล้ว", ops: [] }; const big = E.magicInHell(s, p) >= 8 && s.P[1 - p].hell.length > 0;
      return { explain: `${E.name(s, t)} จะไม่ออกจากสนาม${big ? " · ฝ่ายตรงข้ามเลือกเนรเทศการ์ดในนรกตนเอง 1 ใบ" : ""}`, ops: [{ op: "stay", i: t.i }, ...(big ? [{ op: "resume", t: { i: c.t.i, c: c.t.c, when: "foeExile", seat: 1 - p } }] : [])] }; },
    foeExile: (c) => { const { E, s, seat: q } = c; const t = c.choose([...s.P[q].hell].sort(cheapCard(E, s)), 1, "Skill : Second Energy: เลือกการ์ดในนรกของคุณ 1 ใบที่จะเนรเทศ", { exact: true })[0]; return t ? { explain: `เนรเทศ ${E.name(s, t)} จากนรก`, ops: [{ op: "move", i: t.i, to: "dark" }] } : { explain: "ไม่มีการ์ดในนรก", ops: [] }; },
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
  if (land && !(c.E.lands(c.s).some((l) => nm(c.E, c.s, l, "ยุคกาฬสินธุ์โซอิค")))) { const m = c.mode(["ใช้ยุคกาฬสินธุ์โซอิคบน Land Magic Zone", "ไม่ใช้"], "ยุคกาฬสินธุ์โซอิคถูกสอดแนม", 0);
    if (m === 0) { ops.push({ op: "toLand", i: land.i }); say.push("ใช้ยุคกาฬสินธุ์โซอิคเป็น Land"); } }
  return { ops, say };
}
// scout n, choose up to k matching cards and send them to `to` ("put" / "putJ" / "hand"), rest shuffled back
function dinoScout(c, n0, test, k, to, prompt, whyNot) {
  const n = scoutN(c, n0); const top = c.s.P[c.seat].deck.slice(0, n);
  const cands = top.filter((x) => test(x)).sort(strongFirst(c.E, c.s));
  const lim = to === "hand" ? k : Math.min(k, room(c));
  const why = whyNot ? Object.fromEntries(top.filter((x) => !cands.includes(x)).map((x) => [x.i, whyNot(x)])) : null; // shown on the cards that cannot be picked
  const got = lim > 0 && cands.length ? c.choose(cands, lim, prompt, { optional: true, reveal: top.map((x) => x.i), why }) : [];
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
  "BT06-011": { death: (c) => dinoScout(c, 3, (x) => isAv(c.E, c.s, x) && nm(c.E, c.s, x, "ไดโนกาฬสินธุ์") && !nm(c.E, c.s, x, "สุธีธรนีซอรัส") && (c.E.def(c.s, x).c || 0) <= 3, 1, "put", "สอดแนม: เลือก Avatar ชื่อ ไดโนกาฬสินธุ์ ที่ Cost 3 หรือต่ำกว่ามาอัญเชิญ",
    (x) => (!isAv(c.E, c.s, x) ? "ไม่ใช่ Avatar" : !nm(c.E, c.s, x, "ไดโนกาฬสินธุ์") ? "ชื่อไม่ใช่ไดโนกาฬสินธุ์" : nm(c.E, c.s, x, "สุธีธรนีซอรัส") ? "ชื่อเดียวกับใบนี้" : "Cost เกิน 3")) },
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
const otaku = (extra = {}) => ({ botHold: (E, s, x, p) => (s.P[p].av.some((h) => idol(E, s, h)) ? 1 : -2), ...extra, // the bot brings fans out only when an idol is there to wear them
  activate: { label: "โอตะ: สวมใส่ให้ไอดอล / ลงจากการสวมใส่",
    can: (E, s, x, L) => (L.z === "av" && s.P[L.p].av.some((h) => h.i !== x.i && idol(E, s, h))) || (L.z === "mg" && x.on && !s.P[L.p].bot && E.avatars(s.P[L.p]) < 4),
    run: (c) => { const L = c.E.locate(c.s, c.self.i);
      if (L.z === "mg") return { explain: `${c.E.name(c.s, c.self)} ลงจากการสวมใส่ไปที่ Avatar Zone`, ops: [{ op: "move", i: c.self.i, to: "av" }] };
      const h = c.choose(bestIdol(c, c.self.i), 1, "เลือกไอดอลที่จะสวมใส่โอตะใบนี้")[0];
      return h ? { explain: `${c.E.name(c.s, c.self)} ไปสวมใส่ให้ ${c.E.name(c.s, h)}`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่มีไอดอล", ops: [] }; } } });
const idolPay = (d) => String(d.n || "").includes("ไอดอล") || String(d.n || "").includes("โปรดิวเซอร์");
// โอตะคูลา: the โอตะ two-way move once a turn, worn +1 (+2 on มีมมิ — "บีมมิ" on the card), and
// "เนรเทศ การ์ดใบนี้ และทิ้งการ์ดบนมือ 1 ใบ : a มีมมิ Avatar from the deck to the hand"
const kulaFind = (E, s, x, L) => ["av", "mg"].includes(L.z) && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => isAv(E, s, y) && E.named(s, y, "มีมมิ"));
const kula = () => { const base = otaku({ payOnly: idolPay }); const wear = base.activate;
  return { ...base, worn: (E, s, m, host) => (E.named(s, host, "มีมมิ") ? 2 : idol(E, s, host) ? 1 : 0),
    activate: { label: "โอตะคูลา: สวมใส่ / ลงจากการสวมใส่ / เนรเทศหามีมมิ", multi: true,
      can: (E, s, x, L) => (x.kula !== s.turn && wear.can(E, s, x, L)) || kulaFind(E, s, x, L),
      run: (c) => { const { E, s, seat: p, self: x } = c; const L = E.locate(s, x.i); const a = x.kula !== s.turn && wear.can(E, s, x, L), b = kulaFind(E, s, x, L);
        const k = a && b ? c.mode(["สวมใส่ให้ไอดอล / ลงจากการสวมใส่ (เทิร์นละครั้ง)", "เนรเทศการ์ดใบนี้ และทิ้ง 1 ใบ: นำมีมมิจาก Deck ขึ้นมือ"], "โอตะคูลา: เลือกความสามารถ", 0) : a ? 0 : 1;
        if (k === 0) { const r = wear.run(c); return { ...r, ops: [{ op: "flag", i: x.i, k: "kula", v: s.turn }, ...r.ops] }; }
        const P = s.P[p]; const d = c.choose([...P.hand].sort((u, v) => gemVal(E, s, u) - gemVal(E, s, v)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        const t = c.choose(uniq(E, s, P.deck.filter((y) => isAv(E, s, y) && E.named(s, y, "มีมมิ"))).sort(strongFirst(E, s)), 1, "เลือกมีมมิจาก Deck ขึ้นมือ")[0];
        return { explain: `เนรเทศ ${E.name(s, x)}${d ? ` · ทิ้ง ${E.name(s, d)}` : ""}${t ? ` · นำ ${E.name(s, t)} ขึ้นมือ` : ""}`,
          ops: [{ op: "exile", i: x.i }, ...(d ? [{ op: "discard", seat: p, iids: [d.i] }] : []), t ? { op: "search", seat: p, take: t.i, to: "hand" } : { op: "shuffle", seat: p }] }; } } }; };
Object.assign(SCRIPTS, {
  "KD03-007": otaku({ shield: true }), // โอตะ รุ่นก่อตั้ง: dies instead of its idol
  "KD03-008": otaku({ death: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) }), // โอตะปุส
  "BT08-021": otaku({ otaCount: 2 }), // โอตะท๊อปโดเนท
  "KD03-002": kula(), // โอตะคูลา
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
  // มีมมิจัง ไอดอล No.1 ("บีมมิ" on the card is a misprint of มีมมิ, see normName in cards.js)
  // from the hand: banish a มีมมิ on our Avatar Zone → this card comes down with its จุติ, and the โอตะ that มีมมิ wore move onto it
  // จุติ — an idol from the deck plus an โอตะ from the deck onto it
  // End Phase: back into the deck, shuffle, draw 1; a banished มีมมิ comes back and takes over the โอตะ this card wore
  "KD03-001": {
    activate: { label: "เนรเทศมีมมิบน Avatar Zone: อัญเชิญ จุติ การ์ดใบนี้จากมือ",
      can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && s.P[L.p].av.some((y) => isAv(E, s, y) && E.named(s, y, "มีมมิ")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p];
        const pool = P.av.filter((y) => isAv(E, s, y) && E.named(s, y, "มีมมิ")).sort((a, b) => otaOn(E, s, b).length - otaOn(E, s, a).length || E.power(s, a) - E.power(s, b));
        const m = c.choose(pool, 1, "เลือกมีมมิบน Avatar Zone ที่จะเนรเทศ", { exact: true })[0]; if (!m) return { explain: "ไม่มีมีมมิบน Avatar Zone", ops: [] };
        const fans = otaOn(E, s, m); const carry = fans.map((f) => ({ op: "attach", i: f.i, on: x.i }));
        const room1 = E.avatars(P) < 4 && P.av.length < 6 && E.fits6(s, p, x); // with room, come down first so the โอตะ go straight across
        const ops = room1 ? [{ op: "put", i: x.i, jt: true }, ...carry, { op: "exile", i: m.i }] : [{ op: "exile", i: m.i }, { op: "put", i: x.i, jt: true }, ...carry];
        return { explain: `เนรเทศ ${E.name(s, m)} · อัญเชิญ ${E.name(s, x)} แบบจุติ${fans.length ? ` · โอตะ ${fans.length} ใบย้ายมาสวมใส่ให้` : ""}`, ops }; } },
    summon: (c) => { const P = c.s.P[c.seat]; if (!room(c)) return { explain: "Avatar Zone เต็ม", ops: [] };
      const i = c.choose(uniq(c.E, c.s, P.deck.filter((x) => idol(c.E, c.s, x))).sort(strongFirst(c.E, c.s)), 1, "เลือกไอดอลจาก Deck ที่จะอัญเชิญ")[0];
      const o = i ? c.choose(uniq(c.E, c.s, P.deck.filter((x) => x.i !== i.i && ota(c.E, c.s, x))), 1, "เลือกโอตะจาก Deck มาสวมใส่ให้ไอดอลที่อัญเชิญ")[0] : null;
      return { explain: i ? `อัญเชิญ ${c.E.name(c.s, i)}${o ? ` พร้อม ${c.E.name(c.s, o)}` : ""} จาก Deck` : "ไม่มีไอดอลใน Deck", ops: [...(i ? [{ op: "put", i: i.i }] : []), ...(i && o ? [{ op: "attach", i: o.i, on: i.i }] : []), { op: "shuffle", seat: c.seat }] }; },
    endPhase: (E, s, x, L) => { if (L.z !== "av" || s.active !== L.p) return []; const P = s.P[L.p];
      const home = [{ op: "move", i: x.i, to: "deckBottom" }, { op: "shuffle", seat: L.p }, { op: "draw", seat: L.p, n: 1 }];
      const back = P.dark.filter((y) => isAv(E, s, y) && E.named(s, y, "มีมมิ")).sort((a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0))[0]; if (!back) return home;
      const carry = otaOn(E, s, x).map((f) => ({ op: "attach", i: f.i, on: back.i }));
      return E.avatars(P) < 4 && P.av.length < 6 ? [{ op: "put", i: back.i }, ...carry, ...home] : [home[0], { op: "put", i: back.i }, ...carry, ...home.slice(1)]; } },
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
const stillInHell = (c) => (c.E.locate(c.s, c.self.i) || {}).z === "hell"; // a milled card that has already left hell (taken to the hand, say) can no longer come back from there
const putSelf = (label) => (c) => { if (!stillInHell(c)) return { explain: "การ์ดใบนี้ไม่ได้อยู่ในนรกแล้ว", ops: [] }; if (!room(c)) return { explain: "Avatar Zone เต็ม", ops: [] };
  const m = c.mode([`อัญเชิญ ${c.E.name(c.s, c.self)} จากนรก`, "ไม่อัญเชิญ"], label, 0); return m === 0 ? { explain: "อัญเชิญจากนรก", ops: [{ op: "put", i: c.self.i }] } : { explain: "ไม่อัญเชิญ", ops: [] }; };
const valkFromHell = (c, test, prompt) => { const t = room(c) ? c.choose(uniq(c.E, c.s, c.s.P[c.seat].hell.filter((x) => valk(c.E, c.s, x) && x.i !== (c.self || {}).i && test(x))).sort(strongFirst(c.E, c.s)), 1, prompt)[0] : null;
  return t ? { explain: `อัญเชิญ ${c.E.name(c.s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "ไม่มีเทพธิดาในนรกให้อัญเชิญ หรือสนามเต็ม", ops: [] }; };
const attachValk = (c, label) => { if (!stillInHell(c)) return { explain: "การ์ดใบนี้ไม่ได้อยู่ในนรกแล้ว", ops: [] }; const hs = c.s.P[c.seat].av.filter((x) => valk(c.E, c.s, x)).sort(strongFirst(c.E, c.s));
  const h = hs.length ? c.choose(hs, 1, label, { optional: true })[0] : null; return h ? { explain: `สวมใส่ให้ ${c.E.name(c.s, h)} จากนรก`, ops: [{ op: "attach", i: c.self.i, on: h.i }] } : { explain: "ไม่สวมใส่", ops: [] }; };
const modValk = (E, s, h) => valk(E, s, h);
Object.assign(SCRIPTS, {
  "BT05-027": { millBy: "god", milled: putSelf("บรุนฮิลด์ถูกธรณีสูบ") },
  "BT06-027": { millBy: "god", milled: (c) => valkFromHell(c, (x) => (c.E.def(c.s, x).c || 0) <= 4 && !nm(c.E, c.s, x, "สกัลด์"), "สกัลด์ถูกธรณีสูบ: เลือกเทพธิดา Cost 4 หรือต่ำกว่าในนรกที่จะอัญเชิญ") },
  "BT06-028": { millBy: "god", milled: (c) => ({ explain: "โอลรุนกลับขึ้นมือ", ops: [{ op: "move", i: c.self.i, to: "hand", onlyFrom: "hell" }] }) },
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
  "BT02-060": { landSy: "เทพ", activate: { label: "ทิ้ง 1 ใบ: ยึด Avatar ที่นอนอยู่ (Cost ≤3) จนจบเทิร์น",
    can: (E, s, x, L) => L.z === "land" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].av.some((y) => !y.a && !y.tok && (E.def(s, y).c || 0) <= 3),
    run: (c) => { const d = c.choose([...c.s.P[c.seat].hand].sort((a, b) => gemVal(c.E, c.s, a) - gemVal(c.E, c.s, b)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      const t = c.choose(c.s.P[1 - c.seat].av.filter((y) => !y.a && !y.tok && (c.E.def(c.s, y).c || 0) <= 3).sort(strongFirst(c.E, c.s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่นอนอยู่ (Cost ≤3)")[0];
      return { explain: `ทิ้ง ${c.E.name(c.s, d)}${t ? ` · ยึด ${c.E.name(c.s, t)} จนจบเทิร์น` : ""}`, ops: [{ op: "discard", seat: c.seat, iids: [d.i] }, ...(t ? [{ op: "control", i: t.i, seat: c.seat, until: "turn", asleep: true }] : [])] }; } } },
});

// ===================== timed abilities (End Phase / start of Main Phase) =====================
const mineEnd = (s, L) => s.active === L.p;
Object.assign(SCRIPTS, {
  // โลกิ: every End Phase it moves to the other side
  // โลกิ: moves to the other side's Avatar Zone at every End Phase; once its control has changed it can no longer attack
  "BT03-023": { endPhase: (E, s, x, L) => (L.z === "av" && E.avatars(s.P[1 - L.p]) < 4 ? [{ op: "control", i: x.i, seat: 1 - L.p }] : []), noAttack: (E, s, x) => (x.ctlx || 0) > 0 },
  // ศาสตราจารย์วานร: 3+ วานร on our field → draw 2
  "BT08-041": { endPhase: (E, s, x, L) => (L.z === "av" && s.P[L.p].av.filter((y) => nm(E, s, y, "วานร")).length >= 3 ? [{ op: "draw", seat: L.p, n: 2 }] : []) },
  // ม้าเฉียว: back to hand at our End Phase unless another green ขุนพล {ต่างชาติ} is with it
  "BT10-049": { endPhase: (E, s, x, L) => (L.z === "av" && mineEnd(s, L) && !s.P[L.p].av.some((y) => y.i !== x.i && nm(E, s, y, "ขุนพล") && E.def(s, y).co === "เขียว" && sy(E, s, y, "ต่างชาติ")) ? [{ op: "move", i: x.i, to: "hand" }] : []) },
  // ฟูมะ: from the hand, a นินจา on our Avatar Zone goes back to the hand and this card comes down (once a turn by this way).
  // Brought down by its own ability it gets POWER +3 and hides in the dark zone at our End Phase, coming back at the start
  // of our next Main Phase (by its own ability again). Summoned the usual way it does none of that.
  "BT11-010": { activate: { label: "นำนินจาบน Avatar Zone กลับขึ้นมือ: อัญเชิญฟูมะจากมือ",
      can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && once(s, L.p, "ฟูมะ:สลับ") && s.P[L.p].av.some((y) => isAv(E, s, y) && E.named(s, y, "นินจา") && E.def(s, y).n !== E.def(s, x).n),
      run: (c) => { const { E, s, seat: p, self: x } = c; const pool = s.P[p].av.filter((y) => isAv(E, s, y) && E.named(s, y, "นินจา") && E.def(s, y).n !== E.def(s, x).n).sort((a, b) => worth(E, s, a) - worth(E, s, b));
        const n = c.choose(pool, 1, "เลือกนินจาบน Avatar Zone ที่จะนำกลับขึ้นมือ", { exact: true })[0]; if (!n) return { explain: "ไม่มีนินจาบน Avatar Zone", ops: [] };
        return { explain: `${E.name(s, n)} กลับขึ้นมือ · อัญเชิญ ${E.name(s, x)} POWER +3`, ops: [{ op: "nameOnce", seat: p, name: "ฟูมะ:สลับ" }, { op: "move", i: n.i, to: "hand" }, { op: "put", i: x.i }, { op: "flag", i: x.i, k: "sb", v: x.c }, { op: "power", i: x.i, n: 3, temp: false }] }; } },
    endPhase: (E, s, x, L) => (L.z === "av" && mineEnd(s, L) && x.sb === x.c ? [{ op: "exile", i: x.i }, { op: "later", seat: L.p, ops: [{ op: "put", i: x.i }, { op: "flag", i: x.i, k: "sb", v: x.c }, { op: "power", i: x.i, n: 3, temp: false }], why: "ฟูมะกลับจากมิติมืด" }] : []) },
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
// "when … would be destroyed / leave the field": the cards that window is about (still where they were)
const doomed = (c, list) => (onTarget(c)[list] || []).map((i) => c.E.locate(c.s, i)).filter(Boolean).map((L) => L.x);
const doomV = (E, s, q, on, list = "kill") => Math.max(-9, ...(on[list] || []).map((i) => E.locate(s, i)).filter(Boolean).map((L) => (E.def(s, L.x).c || 0) * 0.8 + E.power(s, L.x) * 0.5 - 1));
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
  "BT01-040": { react: { kinds: ["doom"], can: (E, s, p, on) => on.p === p && on.kill.length > 0, botV: (E, s, q, on) => doomV(E, s, q, on) },
    cast: (c) => { const L = doomed(c, "kill"); const t = L.length > 1 ? c.choose(L.sort((a, b) => worth(c.E, c.s, b) - worth(c.E, c.s, a)), 1, "เลือก Avatar ที่จะไม่ถูกทำลาย", { exact: true })[0] : L[0];
      return t ? { explain: `${c.E.name(c.s, t)} จะไม่ถูกทำลาย`, ops: [{ op: "guard", i: t.i }] } : { explain: "Avatar ใบนั้นไม่อยู่บนสนามแล้ว", ops: [] }; } },
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
Object.assign(SCRIPTS["BT06-052"], { millBy: "god", milled: (c) => ({ explain: "เสียงเรียกแห่งวัลฮัลลากลับขึ้นมือ", ops: [{ op: "move", i: c.self.i, to: "hand", onlyFrom: "hell" }] }) });

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
const swamp = (E, s) => E.lands(s).some((l) => E.named(s, l, "บึงทมิฬ"));
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
    const P = s.P[p]; const n = P.av.length + P.cs.length + P.mg.filter((m) => m.i !== c.t.i).length + E.lands(s).filter((l) => l.o === p).length + P.hand.length;
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
      const cands = [...O.av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...O.cs.filter((y) => !E.noAim(s, y)), ...O.mg.filter((m) => m.on != null), ...E.lands(s).filter((l) => l.o === 1 - p),
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
  "BT02-051": { react: { kinds: ["doom"], can: (E, s, p, on) => on.p === p && on.kill.length > 0, botV: (E, s, q, on) => doomV(E, s, q, on) - s.P[q].hand.length * 0.9 },
    cast: (c) => { const { E, s, seat: p } = c; const L = doomed(c, "kill"); const T = L.length > 1 ? c.choose(L.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ที่จะไม่ถูกทำลาย", { exact: true })[0] : L[0]; if (!T) return { explain: "Avatar ใบนั้นไม่อยู่แล้ว", ops: [] }; const hand = s.P[p].hand.filter((y) => y.i !== c.t.i);
      return { explain: `ทิ้งการ์ดทั้งมือ ${hand.length} ใบ · ${E.name(s, T)} จะไม่ถูกทำลาย`, ops: [...(hand.length ? [{ op: "discard", seat: p, iids: hand.map((y) => y.i) }] : []), { op: "guard", i: T.i }] }; } },
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
  "BT03-041": { canCast: (E, s, p) => E.lands(s).length > 0 && s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
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
  if (!E.lands(s).some((l) => E.named(s, l, "แอสการ์ดคือสถานที่ไม่ใช่ผู้คน"))) return { explain: "บน Land Magic Zone ไม่มี แอสการ์ดคือสถานที่ไม่ใช่ผู้คน", ops: [] };
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
  "BT06-013": { drawn: lobster, drawnOk: (E, s) => E.lands(s).some((l) => !l.mute && E.named(s, l, "บึงทมิฬ")), handed: lobster, handedOk: (E, s, x, src) => !!src && String(src.n || "").includes("บึงทมิฬ") },
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
  "BT06-050": { react: { kinds: ["doom"], can: (E, s, p, on) => on.p === p && on.killCs.length > 0, botV: (E, s, q, on) => doomV(E, s, q, on, "killCs") + 3 },
    cast: (c) => { const { E, s } = c; const L = doomed(c, "killCs"); const t = L.length > 1 ? c.choose(L.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Construct ที่จะไม่ถูกทำลาย", { exact: true })[0] : L[0];
      return t ? { explain: `${E.name(s, t)} จะไม่ถูกทำลาย`, ops: [{ op: "guard", i: t.i }] } : { explain: "Construct ใบนั้นไม่อยู่แล้ว", ops: [] }; } },
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
  "BT06-063": { activate: { label: "ธรณีสูบ 2 ใบ: เทพธิดาแห่งวัลฮัลลาจากนรกขึ้นมือ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].deck.length >= 2 && (!s.P[L.p].bot || s.P[L.p].hell.some((y) => valkyrie(E, s, y))),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, [...s.P[p].deck.slice(0, 2), ...s.P[p].hell].filter((y) => valkyrie(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกเทพธิดาแห่งวัลฮัลลาในนรก", { exact: true })[0];
      return { explain: `ธรณีสูบ 2 ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : " · ไม่มีเทพธิดาในนรก"}`, ops: [{ op: "mill", seat: p, n: 2 }, ...(t ? [{ op: "move", i: t.i, to: "hand", onlyFrom: "hell" }] : [])] }; } } },
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

// ---------- BT07 ----------
const garuda = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ครุฑ");
const flare = (E, s, x) => E.named(s, x, "ขนมณี แฟลร์");
const gOrF = (E, s, x) => garuda(E, s, x) || flare(E, s, x);
const wizard = (E, s, x) => isAv(E, s, x) && E.named(s, x, "จอมเวท");
const spell = (E, s, x) => E.def(s, x).t === "M" && E.named(s, x, "คาถา");
const police = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ตำรวจ");
const grass = (E, s, x) => isAv(E, s, x) && (E.named(s, x, "ตั๊กแตน") || String(E.def(s, x).x || "").includes("ตั๊กแตน"));
const snowMan = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ทหารหิมะ");
const once = (s, p, n) => !(s.nu && s.nu[p] && s.nu[p][n] === s.turn);
const facedUp = (s, p) => s.P[p].life.filter((y) => y.up).length;
const isBotSeat = (s, p) => !!(s.P[p].bot || s.mode === "sim");
// ครุฑปรเมศวร: used as the cost of a {สัตว์วิเศษ} card's ability → ขนมณี แฟลร์ from the Deck to the hand
const paramet = (E, s, p, ys) => ys.filter((y) => E.named(s, y, "ครุฑปรเมศวร")).slice(0, 1).flatMap(() => (s.P[p].deck.some((z) => flare(E, s, z)) ? [{ op: "search", seat: p, name: "ขนมณี แฟลร์", to: "hand" }] : []));
const garudaCall = (c, extra) => { const { E, s, seat: p } = c; if (E.avatars(s.P[p]) >= 4) return null; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => garuda(E, s, y) && (E.def(s, y).c || 0) <= 4)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกครุฑ Cost ไม่เกิน 4 จาก Deck เพื่ออัญเชิญ", { exact: true })[0];
  return t ? { t, ops: [{ op: "put", i: t.i }, ...(extra ? extra(t) : []), { op: "shuffle", seat: p }] } : null; };
const guessType = (E, s, q) => { const n = { A: 0, M: 0, C: 0 }; for (const y of s.P[q].deck) { const t = E.def(s, y).t; if (t === "T" || t === "A") n.A++; else if (n[t] != null) n[t]++; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]; };
const TYPE_LABEL = { A: "Avatar", M: "Magic", C: "Construct" };
const declare = (c) => { const { E, s, seat: p } = c; const keys = ["A", "M", "C"]; const best = keys.indexOf(guessType(E, s, 1 - p)); const k = keys[c.mode(keys.map((t) => `ประกาศ ${TYPE_LABEL[t]}`), "ประกาศประเภทการ์ดใบบนสุดของ Deck ฝ่ายตรงข้าม", best)]; const top = s.P[1 - p].deck[0];
  const tt = top ? (E.def(s, top).t === "T" ? "A" : E.def(s, top).t) : null; return { k, top, hit: !!top && tt === k }; };
const gem3 = (E, s, p, x) => { const cards = s.P[p].hand.filter((y) => y.i !== x.i && (E.def(s, y).g || 0) > 0).slice(0, 12); let best = null;
  for (let m = 1; m < 1 << cards.length; m++) { let g = 0, w = 0; const pick = []; for (let k = 0; k < cards.length; k++) if (m & (1 << k)) { g += E.def(s, cards[k]).g || 0; w += worth(E, s, cards[k]); pick.push(cards[k]); } if (g === 3 && (!best || w < best.w)) best = { w, pick }; } return best ? best.pick : null; };
const stolen = (E, s, p) => s.P[p].mg.filter((m) => m.on == null && m.o !== p && isAv(E, s, m));
const endUse = (ok) => (E, s, x, L) => { if (L.p === s.active && x.used !== s.turn && (!ok || ok(E, s, x, L))) E.addTrig(s, L.p, x, "endUse", { optional: true }); return []; };
Object.assign(SCRIPTS, {
  // วันชัยเปรตรุ่นพ่อ: +1 per face-up LIFE on both sides · once per turn flip our top LIFE: its ability works now
  "BT07-001": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: facedUp(s, 0) + facedUp(s, 1) }] : []),
    activate: { label: "หงาย LIFE ใบบนสุดของเรา: สั่งใช้ความสามารถของ LIFE ใบนั้น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].life.filter((y) => !y.up).length > (isBotSeat(s, L.p) ? 2 : 0), run: () => ({ explain: "หงาย LIFE ใบบนสุด แล้วใช้ความสามารถทันที", ops: [{ op: "lifeUse" }] }) } },
  // พระแม่อุมาเทวี: จุติ discard 1: a {เทพ} card (not a one-copy card) from hell to the hand · while the opponent controls our พระอิศวร: to hell, เจ้าแม่กาลี with จุติ
  "BT07-002": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const t = c.choose([...P.hell].reverse().filter((y) => sy(E, s, y, "เทพ") && !E.def(s, y).o1).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ด {เทพ} ในนรกที่จะนำขึ้นมือ")[0];
      const pay = t ? c.choose([...P.hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0] : null; return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "hand" }] } : { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; },
    activate: { label: "ส่งใบนี้ลงนรก: อัญเชิญเจ้าแม่กาลีแบบจุติ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[1 - L.p].av.some((y) => E.named(s, y, "พระอิศวร") && y.o === L.p) && [...s.P[L.p].hand, ...s.P[L.p].deck].some((y) => E.named(s, y, "เจ้าแม่กาลี")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[p].hand.find((y) => E.named(s, y, "เจ้าแม่กาลี")); const k = h || s.P[p].deck.find((y) => E.named(s, y, "เจ้าแม่กาลี")); return k ? { explain: `${E.name(s, x)} ลงนรก · อัญเชิญ ${E.name(s, k)} แบบจุติ`, ops: [{ op: "move", i: x.i, to: "hell" }, { op: "put", i: k.i, jt: true }, ...(h ? [] : [{ op: "shuffle", seat: p }])] } : { explain: "", ops: [] }; } } },
  // เจ้าแม่กาลี: จุติ destroy an opposing {เทพ}; otherwise draw 1
  "BT07-003": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => sy(E, s, y, "เทพ") && !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar {เทพ} ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
    return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "เจ้าแม่กาลี" }] } : { explain: "ไม่มี {เทพ} ฝ่ายตรงข้าม · จั่ว 1 ใบ", ops: [{ op: "draw", seat: p, n: 1 }] }; } },
  // พรีวิวบอย: once per turn +POWER of one of our Avatars this turn
  "BT07-004": { activate: { label: "POWER เพิ่มเท่ากับ Avatar ฝ่ายเราที่เลือก จนจบเทิร์น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i && E.power(s, y) > 0),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => y.i !== x.i).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `POWER +${E.power(s, t)} (เท่ากับ ${E.name(s, t)}) จนจบเทิร์น`, ops: [{ op: "power", i: x.i, n: E.power(s, t), temp: true }] } : { explain: "", ops: [] }; } } },
  // อนันตวดี: pays only for {สัตว์วิเศษ} · paid for a นาค: it gets +3 this turn · 6 GEM for อนันต์ ราชาแห่งนาค
  "BT07-006": { payOnly: (td) => !!td && String(td.sy || "").includes("สัตว์วิเศษ"), gemFor: (td) => (td && td.n === "อนันต์ ราชาแห่งนาค" ? 6 : null),
    paidFor: (d) => !!d && d.t === "A" && String(d.n || "").includes("นาค") && String(d.sy || "").includes("สัตว์วิเศษ"),
    paid: (c) => (c.t.forI != null ? { explain: "Avatar ที่อัญเชิญ POWER +3 จนจบเทิร์น", ops: [{ op: "power", i: c.t.forI, n: 3, temp: true }] } : { explain: "", ops: [] }) },
  // สัตว์ทดลอง #1: 10+ different Avatar names in our hell: 8 colourless GEM
  "BT07-007": { gemFor: (td, E, s, x, p) => (E && new Set(s.P[p].hell.filter((y) => isAv(E, s, y)).map((y) => E.name(s, y))).size >= 10 ? 8 : null),
    selfColorless: (E, s, x) => { const L = E.locate(s, x.i); return !!L && new Set(s.P[L.p].hell.filter((y) => isAv(E, s, y)).map((y) => E.name(s, y))).size >= 10; } },
  // ตำรวจไซบอร์ค จ่านิ่ง: once per turn the opponent draws 1, then puts a card from the hand on top of the Deck
  "BT07-008": { activate: { label: "ฝ่ายตรงข้ามจั่ว 1 ใบ แล้ววางการ์ดจากมือ 1 ใบไว้บนสุดของ Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[1 - L.p].deck.length > 0,
    run: (c) => ({ explain: "ฝ่ายตรงข้ามจั่ว 1 ใบ แล้ววางการ์ด 1 ใบจากมือไว้บนสุดของ Deck", ops: [{ op: "draw", seat: 1 - c.seat, n: 1 }, { op: "handToTop", seat: 1 - c.seat }] }) } },
  // น้องไอซ์ จี่สมอง: declaring an attack on an Avatar of POWER 3 or less destroys it
  "BT07-010": { attackOk: (E, s) => { const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return !!T && E.power(s, T.x) <= 3; },
    attack: (c) => { const { E, s } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return T && T.z === "av" && E.power(s, T.x) <= 3 ? { explain: `ทำลาย ${E.name(s, T.x)} (POWER ไม่เกิน 3)`, ops: [{ op: "destroy", i: T.x.i, why: "น้องไอซ์" }] } : { explain: "", ops: [] }; } },
  // ไอ้แม๊ก ขยะสังคม: คำสั่งเสีย a card in the opponent's Magic Zone back to its owner's hand
  "BT07-011": { death: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[1 - p].mg].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดใน Magic Zone ฝ่ายตรงข้าม", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} กลับขึ้นมือเจ้าของ`, ops: [{ op: "move", i: t.i, to: "hand" }] } : { explain: "Magic Zone ฝ่ายตรงข้ามว่าง", ops: [] }; } },
  // ครุฑสุบรรณ: once per turn up to 3 ครุฑ/ขนมณี แฟลร์ from hell into the Deck: a ครุฑ Cost ≤4 from the Deck (1: back to hand at the end · 3: +2 this turn)
  "BT07-012": { activate: { label: "นำครุฑหรือขนมณี แฟลร์ในนรกสูงสุด 3 ใบเข้า Deck: อัญเชิญครุฑ Cost ไม่เกิน 4", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.some((y) => gOrF(E, s, y)) && E.avatars(s.P[L.p]) < 4,
    run: (c) => { const { E, s, seat: p } = c; const back = c.choose([...s.P[p].hell].filter((y) => gOrF(E, s, y)).sort(cheapCard(E, s)), 3, "เลือกครุฑหรือขนมณี แฟลร์ในนรก (สูงสุด 3 ใบ)", { optional: true }); if (!back.length) return { explain: "", ops: [] }; const n = back.length;
      const g = garudaCall(c, (t) => (n === 1 ? [{ op: "atEnd", turn: s.turn, ops: [{ op: "move", i: t.i, to: "hand", onlyFrom: "av" }], why: "ครุฑกลับขึ้นมือ" }] : n === 3 ? [{ op: "power", i: t.i, n: 2, temp: true }] : []));
      return { explain: `นำ ${n} ใบเข้า Deck${g ? ` · อัญเชิญ ${E.name(s, g.t)}${n === 1 ? " (กลับขึ้นมือเมื่อจบเทิร์น)" : n === 3 ? " POWER +2" : ""}` : ""}`, ops: [...back.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), ...paramet(E, s, p, back), ...(g ? g.ops : [{ op: "shuffle", seat: p }])] }; } } },
  // ครุฑเวนไตย: once per turn another ครุฑ or ขนมณี แฟลร์ from hell under the Deck: +3 this turn
  "BT07-013": { activate: { label: "นำครุฑใบอื่นหรือขนมณี แฟลร์ในนรกเข้าใต้ Deck: POWER +3", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.some((y) => gOrF(E, s, y) && E.name(s, y) !== E.name(s, x)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].hell.filter((y) => gOrF(E, s, y) && E.name(s, y) !== E.name(s, x)).sort(cheapCard(E, s)), 1, "เลือกการ์ดในนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} เข้าใต้ Deck · POWER +3 จนจบเทิร์น`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, ...paramet(E, s, p, [t]), { op: "power", i: x.i, n: 3, temp: true }] } : { explain: "", ops: [] }; } } },
  // ครุฑวัสสวัส: จุติ a ครุฑ/ขนมณี แฟลร์ from hell under the Deck: a ครุฑ Cost ≤4 from the Deck
  "BT07-014": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => gOrF(E, s, y)).sort(cheapCard(E, s)), 1, "เลือกครุฑหรือขนมณี แฟลร์ในนรก")[0]; if (!t) return { explain: "ไม่มีครุฑหรือขนมณี แฟลร์ในนรก", ops: [] }; const g = garudaCall(c);
    return { explain: `${E.name(s, t)} เข้าใต้ Deck${g ? ` · อัญเชิญ ${E.name(s, g.t)}` : ""}`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, ...paramet(E, s, p, [t]), ...(g ? g.ops : [])] }; } },
  // ครุฑสัจจะ: จุติ discard a ครุฑ/ขนมณี แฟลร์: a ครุฑ Cost ≤4 from the Deck
  "BT07-015": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => gOrF(E, s, y)).sort(cheapCard(E, s)), 1, "ทิ้งครุฑหรือขนมณี แฟลร์จากมือ")[0]; if (!t) return { explain: "ไม่มีครุฑหรือขนมณี แฟลร์บนมือ", ops: [] }; const g = garudaCall(c);
    return { explain: `ทิ้ง ${E.name(s, t)}${g ? ` · อัญเชิญ ${E.name(s, g.t)}` : ""}`, ops: [{ op: "discard", seat: p, iids: [t.i] }, ...paramet(E, s, p, [t]), ...(g ? g.ops : [])] }; } },
  // ครุฑปรเมศวร: used as an ability cost of a {สัตว์วิเศษ} card → ขนมณี แฟลร์ from the Deck (handled by those cards)
  "BT07-016": { costTrigger: "ขนมณี แฟลร์" },
  // ราชาหิมะ บิง: Cost in the hand -1 per "ทหารหิมะ" in our hell
  "BT07-018": { selfCost: (E, s, x, p) => (E.locate(s, x.i)?.z === "hand" ? -s.P[p].hell.filter((y) => snowMan(E, s, y)).length : 0) },
  // พลทหารหิมะ: deck-building rule only (up to 12 copies)
  "BT07-020": { deckRule: true },
  // อัศวินแบงค์: from the hand, discard other cards with exactly 3 GEM: summoned with base POWER 3
  "BT07-021": { activate: { label: "ทิ้งการ์ดให้ GEM รวม 3: อัญเชิญใบนี้ (POWER ตั้งต้น 3)", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && !!gem3(E, s, L.p, x),
    run: (c) => { const { E, s, seat: p, self: x } = c; const pay = gem3(E, s, p, x); return pay ? { explain: `ทิ้ง ${pay.map((y) => E.name(s, y)).join(", ")} · อัญเชิญ ${E.name(s, x)} POWER ตั้งต้น 3`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "put", i: x.i, ov: { pw: 3 } }] } : { explain: "", ops: [] }; } } },
  // พี่หน่วง พิธีกรผมสวย: จุติ the ship from the Deck or hell · with the ship, discard 1: an opposing Avatar with a keyword to our Magic Zone · คำสั่งเสีย one back to its owner's hand
  "BT07-023": { summon: (c) => { const { E, s, seat: p } = c; const h = s.P[p].hell.find((y) => E.named(s, y, "ยานรายการ เถียงทันหน่วง")); const d = h ? null : s.P[p].deck.find((y) => E.named(s, y, "ยานรายการ เถียงทันหน่วง"));
      return h ? { explain: `${E.name(s, h)} จากนรกขึ้นมือ`, ops: [{ op: "move", i: h.i, to: "hand" }] } : d ? { explain: `${E.name(s, d)} จาก Deck ขึ้นมือ`, ops: [{ op: "search", seat: p, take: d.i, to: "hand" }] } : { explain: "ไม่มียานรายการ", ops: [] }; },
    activate: { label: "ทิ้ง 1 ใบ: นำ Avatar ฝ่ายตรงข้ามที่มีสามัคคี/เตะไข่/โล่มนุษย์/คำสั่งเสีย มาไว้ที่ Magic Zone เรา", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].cs.some((y) => E.named(s, y, "ยานรายการ เถียงทันหน่วง")) && s.P[1 - L.p].av.some((y) => !E.noAim(s, y) && ["สามัคคี", "เตะไข่", "โล่มนุษย์", "คำสั่งเสีย"].some((k) => E.kw(s, y, k))),
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && ["สามัคคี", "เตะไข่", "โล่มนุษย์", "คำสั่งเสีย"].some((k) => E.kw(s, y, k))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
        const pay = t ? c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0] : null; return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} มาอยู่ที่ Magic Zone เรา`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "mg", seat: p }] } : { explain: "", ops: [] }; } },
    death: (c) => { const { E, s, seat: p } = c; const t = stolen(E, s, p).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `ฝ่ายตรงข้ามเลือก ${E.name(s, t)} กลับขึ้นมือเจ้าของ`, ops: [{ op: "move", i: t.i, to: "hand" }] } : { explain: "ไม่มี Avatar ฝ่ายตรงข้ามใน Magic Zone", ops: [] }; } },
  // คุณเก่งพลังช้าง: จุติ destroy an opposing Avatar kept in our Magic Zone: +3 · +1 with พี่หน่วง
  "BT07-024": { summon: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(stolen(E, s, p).sort(cheapCard(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้ามใน Magic Zone เรา")[0]; return t && x ? { explain: `ทำลาย ${E.name(s, t)} · POWER +3`, ops: [{ op: "destroy", i: t.i, why: "คุณเก่งพลังช้าง" }, { op: "power", i: x.i, n: 3, temp: false }] } : { explain: "ไม่มี Avatar ฝ่ายตรงข้ามใน Magic Zone เรา", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.some((y) => E.named(s, y, "พี่หน่วง")) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 1 }] : []) },
  // ไอ้ดำ จากนรก: once per turn after its attack's fight: sacrifice another of ours: wake up
  "BT07-028": { afterFight: (c) => { const { E, s, seat: p, self: x } = c; if (!x || x.used === s.turn || E.locate(s, x.i)?.z !== "av") return { explain: "", ops: [] }; const pool = s.P[p].av.filter((y) => y.i !== x.i && (c.interactive || y.tok || worth(E, s, y) <= 2)).sort(cheapCard(E, s));
    const t = c.choose(pool, 1, "เซ่นไหว้ Avatar ใบอื่นฝ่ายเรา")[0]; return t ? { explain: `เซ่นไหว้ ${E.name(s, t)} · ${E.name(s, x)} กลับมาตื่น`, ops: [{ op: "used", i: x.i }, { op: "destroy", i: t.i, why: "เซ่นไหว้" }, { op: "wake", i: x.i }] } : { explain: "ไม่เซ่นไหว้", ops: [] }; } },
  // จอมเวทย์ กาลู: discard 1: a "คาถา" from the Deck or hell (once a turn by name) · once per turn when a "คาถา" is used: draw 1
  "BT07-029": { activate: { label: "ทิ้ง 1 ใบ: นำ Magic คาถา จาก Deck หรือนรกขึ้นมือ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && once(s, L.p, "จอมเวทย์ กาลู") && s.P[L.p].hand.length > 0 && [...s.P[L.p].hell, ...s.P[L.p].deck].some((y) => spell(E, s, y)),
      run: (c) => { const { E, s, seat: p } = c; const h = [...s.P[p].hell].reverse().find((y) => spell(E, s, y)); const t = h || c.choose(uniq(E, s, s.P[p].deck.filter((y) => spell(E, s, y))), 1, "เลือกคาถาจาก Deck", { exact: true })[0]; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "nameOnce", seat: p, name: "จอมเวทย์ กาลู" }, { op: "discard", seat: p, iids: [pay.i] }, h ? { op: "move", i: t.i, to: "hand" } : { op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "", ops: [] }; } },
    magicSeen: (c) => (once(c.s, c.seat, "กาลู:จั่ว") ? { explain: "มีการใช้คาถา: จั่ว 1 ใบ", ops: [{ op: "nameOnce", seat: c.seat, name: "กาลู:จั่ว" }, { op: "draw", seat: c.seat, n: 1 }] } : { explain: "จั่วไปแล้วในเทิร์นนี้", ops: [] }), magicSeenOk: (E, s, y, Ly, d) => Ly.z === "av" && String(d.n || "").includes("คาถา") && once(s, Ly.p, "กาลู:จั่ว") },
  // จอมเวทย์ อะปัด: one more Normal Magic "คาถา" this turn (once a turn by name)
  "BT07-030": { activate: { label: "เทิร์นนี้ใช้ Normal Magic คาถา ได้อีก 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && once(s, L.p, "จอมเวทย์ อะปัด"), run: (c) => ({ explain: "เทิร์นนี้ใช้คาถาได้อีก 1 ใบ", ops: [{ op: "nameOnce", seat: c.seat, name: "จอมเวทย์ อะปัด" }, { op: "extraN", seat: c.seat, only: "คาถา" }] }) } },
  // จอมเวทย์ เบล่า: จุติ with another-name จอมเวทย์: a Normal "คาถา" in our hell works again (once a turn by name)
  "BT07-031": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!once(s, p, "จอมเวทย์ เบล่า") || !s.P[p].av.some((y) => (!x || y.i !== x.i) && wizard(E, s, y) && E.name(s, y) !== (x && E.name(s, x)))) return { explain: "ไม่มีจอมเวทย์ชื่ออื่น", ops: [] };
    const t = c.choose(uniq(E, s, [...s.P[p].hell].reverse().filter((y) => spell(E, s, y) && E.def(s, y).st === "N")), 1, "เลือกคาถา (Normal) ในนรก")[0]; return t ? { explain: `ใช้ผลของ ${E.name(s, t)} จากนรก`, ops: [{ op: "nameOnce", seat: p, name: "จอมเวทย์ เบล่า" }, { op: "castFrom", i: t.i }] } : { explain: "ไม่มีคาถาในนรก", ops: [] }; } },
  // อาวุธชีวภาพ เอ็มตัวเต็ง: cannot attack · once per turn in our End Phase: destroy an opposing Avatar, then 1 damage to their LIFE
  "BT07-032": { noAttack: () => true, endPhase: endUse((E, s, x, L) => L.z === "av"), endUse: (c) => { const { E, s, seat: p, self: x } = c; if (x) x.used = s.turn; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
    return { explain: `${t ? `ทำลาย ${E.name(s, t)} · ` : ""}ทำความเสียหายใส่ LIFE ฝ่ายตรงข้าม 1 ครั้ง`, ops: [...(t ? [{ op: "destroy", i: t.i, why: "อาวุธชีวภาพ" }] : []), { op: "lifeDamage", seat: 1 - p }] }; } },
  // เดซี่ แห่งสายรุ้ง: once per turn in our End Phase a "ผีเสื้อ" {สัตว์วิเศษ} from the Deck · our ผีเสื้อ +1 and โล่มนุษย์
  "BT07-033": { endPhase: endUse((E, s, x, L) => L.z === "av" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].deck.some((y) => isAv(E, s, y) && E.named(s, y, "ผีเสื้อ") && sy(E, s, y, "สัตว์วิเศษ"))),
    endUse: (c) => { const { E, s, seat: p, self: x } = c; if (x) x.used = s.turn; const t = s.P[p].deck.filter((y) => isAv(E, s, y) && E.named(s, y, "ผีเสื้อ") && sy(E, s, y, "สัตว์วิเศษ")).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)} จาก Deck`, ops: [{ op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => E.named(s, x, "ผีเสื้อ") && sy(E, s, x, "สัตว์วิเศษ"), n: 1, kw: ["โล่มนุษย์"] }] : []) },
  // ตำรวจนอกเครื่องแบบ ไซเฮย์: from the hand, declare the type of the opponent's top card: right → summoned free and that card to hell; wrong → this card is discarded
  "BT07-034": { activate: { label: "ประกาศประเภทการ์ดบนสุดของ Deck ฝ่ายตรงข้าม (ถูก: อัญเชิญฟรี)", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p, self: x } = c; const g = declare(c); if (!g.top) return { explain: "", ops: [] }; return g.hit ? { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ถูก (${E.name(s, g.top)}) · อัญเชิญฟรี และส่งการ์ดนั้นลงนรก`, ops: [{ op: "put", i: x.i }, { op: "move", i: g.top.i, to: "hell" }] } : { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ผิด (${E.name(s, g.top)}) · ทิ้งการ์ดใบนี้`, ops: [{ op: "discard", seat: p, iids: [x.i] }] }; } } },
  // ตำรวจไฟแรง เอนโว่: attacking an Avatar, declare the opponent's top card type: right → destroy the target and that card to hell
  "BT07-035": { attackOk: (E, s) => !!s.pend && s.pend.tk === "av", attack: (c) => { const { E, s } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; const g = declare(c); if (!g.top || !T) return { explain: "", ops: [] };
    return g.hit ? { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ถูก · ทำลาย ${E.name(s, T.x)} และส่ง ${E.name(s, g.top)} ลงนรก`, ops: [{ op: "destroy", i: T.x.i, why: "ตำรวจไฟแรง" }, { op: "move", i: g.top.i, to: "hell" }] } : { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ผิด`, ops: [] }; } },
  // ตั๊กแตนหยิน: จุติ flip our top LIFE up, then turn one face down (even in critical state) · with the throne, discard 1: a face-up LIFE's ability works now
  "BT07-036": { summon: () => ({ explain: "หงาย LIFE ใบบนสุด แล้วคว่ำ LIFE 1 ใบ", ops: [{ op: "lifeFlip" }, { op: "lifeFlip", up: false, force: true }] }),
    activate: { label: "ทิ้ง 1 ใบ: สั่งใช้ความสามารถของ LIFE ที่หงายอยู่", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].life.some((y) => y.up) && [...s.P[L.p].cs, ...s.P[L.p].mg].some((y) => E.named(s, y, "บัลลังก์ตั๊กแตนศตวรรษ")),
      run: (c) => { const { E, s, seat: p } = c; const l = c.choose(s.P[p].life.filter((y) => y.up), 1, "เลือก LIFE ที่หงายอยู่", { exact: true })[0]; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        return l && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ใช้ความสามารถของ LIFE ${E.name(s, l)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "lifeUse", i: l.i }] } : { explain: "", ops: [] }; } } },
  // ตั๊กแตนหยาง: with ตั๊กแตนหยิน +1 per face-up LIFE of ours, ลูกฮึด and โล่มนุษย์ in critical state · wears only {แมลง} cards
  "BT07-037": { wearOnly: (E, s, m) => sy(E, s, m, "แมลง"), aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.some((y) => E.named(s, y, "ตั๊กแตนหยิน")) ? [{ seat: L.p, test: (x) => x.i === src.i, n: facedUp(s, L.p), kw: E.critical(s.P[L.p]) ? ["ลูกฮึด", "โล่มนุษย์"] : [] }] : []) },
  // วาฬทมิฬ ก้า: จุติ with a ตั๊กแตน and 2+ face-up LIFE: a "ตั๊กแตน" from hell to the hand
  "BT07-038": { summon: (c) => { const { E, s, seat: p } = c; if (!s.P[p].av.some((y) => E.named(s, y, "ตั๊กแตน")) || facedUp(s, p) < 2) return { explain: "เงื่อนไขไม่ครบ", ops: [] }; const t = [...s.P[p].hell].reverse().find((y) => E.named(s, y, "ตั๊กแตน"));
    return t ? { explain: `${E.name(s, t)} จากนรกขึ้นมือ`, ops: [{ op: "move", i: t.i, to: "hand" }] } : { explain: "ไม่มีตั๊กแตนในนรก", ops: [] }; } },
  // ตั๊กแตนหญิง: จุติ flip our top LIFE: a "ตั๊กแตน" from the Deck to the hand
  "BT07-039": { summon: (c) => { const { E, s, seat: p } = c; const down = s.P[p].life.filter((y) => !y.up).length; const t = s.P[p].deck.find((y) => E.named(s, y, "ตั๊กแตน")); if (!down || !t) return { explain: "จ่ายค่าความสามารถไม่ได้", ops: [] };
    if (c.mode(["หงาย LIFE ใบบนสุด: ค้นหาตั๊กแตนขึ้นมือ", "ไม่ใช้"], "ตั๊กแตนหญิง", down >= 3 ? 0 : 1) !== 0) return { explain: "ไม่ใช้ความสามารถ", ops: [] }; return { explain: `หงาย LIFE ใบบนสุด · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "lifeFlip" }, { op: "search", seat: p, take: t.i, to: "hand" }] }; } },
  // หมอเลิฟ ฟันเหยิน: จุติ any card from the Deck shown and sent to hell (it cannot leave), back to the hand at our 2nd Draw Phase
  "BT07-040": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].deck].sort((a, b) => worth(E, s, b) - worth(E, s, a)).slice(0, 40), 1, "เลือกการ์ดจาก Deck", { exact: true })[0];
    return t ? { explain: `แสดง ${E.name(s, t)} แล้วส่งลงนรก · กลับขึ้นมือใน Draw Phase ที่ 2 ของเรา`, ops: [{ op: "move", i: t.i, to: "hell" }, { op: "hellLock", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "Deck ว่าง", ops: [] }; } },
  // คาบู ช่วยด้วย: from the hand when our {สัตว์} would be destroyed, discard 1: summoned and the destruction is cancelled
  "BT07-041": { saveOther: (E, s, y, Ly, x, L) => { if (Ly.z !== "hand" || L.z !== "av" || L.p !== Ly.p || !isAv(E, s, x) || !sy(E, s, x, "สัตว์") || E.avatars(s.P[Ly.p]) >= 4) return null; const pay = s.P[Ly.p].hand.filter((z) => z.i !== y.i).sort(cheapCard(E, s))[0]; if (!pay) return null;
    return { why: `${E.name(s, y)}: ทิ้ง ${E.name(s, pay)} อัญเชิญจากมือ และยกเลิกการทำลาย ${E.name(s, x)}`, ops: [{ op: "discard", seat: Ly.p, iids: [pay.i] }, { op: "put", i: y.i }] }; } },
  // บัวนิด: attacks only with another "วานร" of ours on the field
  "BT07-042": { noAttack: (E, s, x) => { const L = E.locate(s, x.i); return !L || !s.P[L.p].av.some((y) => y.i !== x.i && monkey(E, s, y)); } },
  // แมรี่ พนักงานต้อนรับ: once per turn in our End Phase: roll a die, scout that many, an Avatar to the hand
  "BT07-043": { endPhase: endUse((E, s, x, L) => L.z === "av" && s.P[L.p].deck.length > 0), endUse: (c) => { if (c.self) c.self.used = c.s.turn; return { explain: "ทอยลูกเต๋า สอดแนมตามผล เลือก Avatar 1 ใบขึ้นมือ", ops: [{ op: "rollScout", seat: c.seat }] }; } },
  // หยุด!! นี่ตำรวจ: with a ตำรวจ, show another ตำรวจ in hand: an opposing Avatar on top of its Deck
  "BT07-048": { canCast: (E, s, p) => s.P[p].av.some((y) => police(E, s, y)) && s.P[p].hand.some((y) => E.named(s, y, "ตำรวจ") && E.def(s, y).t !== "M"),
    cast: (c) => { const { E, s, seat: p } = c; const show = s.P[p].hand.find((y) => E.named(s, y, "ตำรวจ") && E.def(s, y).t !== "M"); const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
      return show && t ? { explain: `แสดง ${E.name(s, show)} · ${E.name(s, t)} ไปไว้บนสุดของ Deck`, ops: [{ op: "move", i: t.i, to: "deckTop" }] } : { explain: "", ops: [] }; } },
  // เพ้อเจ้อ: an Avatar's POWER back to its base · with a ตำรวจ it can be used in the opponent's turn as a React
  "BT07-049": { asReact: (E, s, p) => s.P[p].av.some((y) => police(E, s, y)), react: { kinds: ["attack", "summon", "cast", "activate"], botV: (E, s, q, on) => { if (on.kind !== "attack") return -9; const A = E.locate(s, on.att); return A && E.power(s, A.x) > (E.def(s, A.x).pw || 0) + 1 ? 5 : -9; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const A = on.kind === "attack" ? E.locate(s, on.att) : null;
      const t = A ? A.x : c.choose([...s.P[1 - p].av.filter((y) => E.power(s, y) > (E.def(s, y).pw || 0)), ...s.P[p].av.filter((y) => E.power(s, y) < (E.def(s, y).pw || 0))].sort((a, b) => Math.abs(E.power(s, b) - (E.def(s, b).pw || 0)) - Math.abs(E.power(s, a) - (E.def(s, a).pw || 0))), 1, "เลือก Avatar บนสนาม", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} POWER กลับเป็นค่าตั้งต้น`, ops: [{ op: "resetPower", i: t.i }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // ราคาชาติที่คุณขาย: 2 "ทหารหิมะ" from the Deck to hell; 10+ "หิมะ" in our hell: draw 1
  "BT07-050": { cast: (c) => { const { E, s, seat: p } = c; const two = s.P[p].deck.filter((y) => snowMan(E, s, y)).slice(0, 2); const n = s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "หิมะ")).length + two.length;
    return { explain: `ส่งทหารหิมะ ${two.length} ใบลงนรก${n >= 10 ? " · หิมะในนรก 10 ใบขึ้นไป: จั่ว 1 ใบ" : ""}`, ops: [...two.map((y) => ({ op: "move", i: y.i, to: "hell" })), { op: "shuffle", seat: p }, ...(n >= 10 ? [{ op: "draw", seat: p, n: 1 }] : [])] }; } },
  // คาถา ปลดอาวุสสิวะ: with a จอมเวท: an opposing Avatar -3, destroyed at 0
  "BT07-051": { canCast: (E, s, p) => s.P[p].av.some((y) => wizard(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => (E.power(s, a) <= 3) - (E.power(s, b) <= 3) || worth(E, s, b) - worth(E, s, a)).reverse(), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
    return t ? { explain: `${E.name(s, t)} POWER -3 (เหลือ 0 ถูกทำลาย)`, ops: [{ op: "power", i: t.i, n: -3, temp: false }, { op: "destroy", i: t.i, ifPower0: true, why: "คาถา ปลดอาวุสสิวะ" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // คาถา สัตตูหลีกปาย: with 2+ จอมเวท: an opposing Avatar of POWER 5+ to the opponent's Magic Zone
  "BT07-052": { canCast: (E, s, p) => s.P[p].av.filter((y) => wizard(E, s, y)).length >= 2 && s.P[1 - p].av.some((y) => E.power(s, y) >= 5), cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.power(s, y) >= 5).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม POWER 5 ขึ้นไป", { exact: true })[0];
    return t ? { explain: `${E.name(s, t)} ไปอยู่ที่ Magic Zone ฝ่ายตรงข้าม`, ops: [{ op: "move", i: t.i, to: "mg", seat: 1 - p }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // พลังแห่งควางสิริมงคง: with เสาซินแสมงคล, discard 7: a เสามงคล from hell to our Magic Zone
  "BT07-054": { canCast: (E, s, p) => s.P[p].av.some((y) => E.named(s, y, "เสาซินแสมงคล")) && s.P[p].hand.length >= 8 && s.P[p].hell.some((y) => saoM(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; const pay = s.P[p].hand.filter((y) => y.i !== c.t.i).sort(cheapCard(E, s)).slice(0, 7); const t = [...s.P[p].hell].reverse().find((y) => saoM(E, s, y));
    return pay.length === 7 && t ? { explain: `ทิ้ง 7 ใบ · ${E.name(s, t)} ไปอยู่ที่ Magic Zone`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "move", i: t.i, to: "mg", seat: p }] } : { explain: "", ops: [] }; } },
  // เปลี่ยนเมน: our ไอดอล wearing โอตะ back into the Deck; a different ไอดอล from the Deck takes all its โอตะ
  "BT07-055": { canCast: (E, s, p) => s.P[p].av.some((y) => idol(E, s, y) && s.P[p].mg.some((m) => m.on === y.i && E.named(s, m, "โอตะ"))),
    cast: (c) => { const { E, s, seat: p } = c; const old = c.choose(s.P[p].av.filter((y) => idol(E, s, y) && s.P[p].mg.some((m) => m.on === y.i && E.named(s, m, "โอตะ"))), 1, "เลือกไอดอลที่สวมใส่โอตะ", { exact: true })[0]; if (!old) return { explain: "", ops: [] };
      const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => idol(E, s, y) && E.name(s, y) !== E.name(s, old))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกไอดอลชื่ออื่นจาก Deck", { exact: true })[0]; if (!t) return { explain: "ไม่มีไอดอลชื่ออื่นใน Deck", ops: [] };
      const ota = s.P[p].mg.filter((m) => m.on === old.i && E.named(s, m, "โอตะ")); return { explain: `${E.name(s, old)} กลับเข้า Deck · อัญเชิญ ${E.name(s, t)} · โอตะ ${ota.length} ใบย้ายไปด้วย`, ops: [{ op: "move", i: old.i, to: "deckBottom" }, { op: "put", i: t.i }, ...ota.flatMap((m) => [{ op: "attach", i: m.i, on: t.i }, { op: "setName", i: m.i, name: "โอตะ" }]), { op: "shuffle", seat: p }] }; } },
  // กลับบ้านเก่า: destroy every Avatar that was summoned from hell
  "BT07-056": { cast: (c) => { const { E, s } = c; const ts = [...s.P[0].av, ...s.P[1].av].filter((y) => y.fromHell); return { explain: ts.length ? `ทำลาย ${ts.map((y) => E.name(s, y)).join(", ")}` : "ไม่มี Avatar ที่อัญเชิญจากนรก", ops: ts.map((y) => ({ op: "destroy", i: y.i, why: "กลับบ้านเก่า" })) }; } },
  // แบงค์ Portal: with a แบงค์: scout 5, of two แบงค์ one to hell and one to the hand
  "BT07-058": { canCast: (E, s, p) => s.P[p].av.some((y) => bank(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 5); if (!top.length) return { explain: "Deck หมด", ops: [] };
    const two = c.choose(top.filter((y) => bank(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 2, "เลือกแบงค์ 2 ใบ (ใบแรกขึ้นมือ ใบที่สองลงนรก)", { reveal: top.map((y) => y.i) });
    return { explain: `สอดแนม ${top.length} ใบ${two[0] ? ` · ${E.name(s, two[0])} ขึ้นมือ` : ""}${two[1] ? ` · ${E.name(s, two[1])} ลงนรก` : ""} · ที่เหลือกลับเข้า Deck แล้วสับ`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(two[0] ? [{ op: "move", i: two[0].i, to: "hand" }] : []), ...(two[1] ? [{ op: "move", i: two[1].i, to: "hell" }] : []), { op: "shuffle", seat: p }] }; } },
  // พันปักษา (React, the opponent attacks): destroy one of our ครุฑ: destroy up to 2 opposing Avatars
  "BT07-059": { react: { kinds: ["attack"], can: (E, s, p) => s.P[p].av.some((y) => garuda(E, s, y)), botV: (E, s, q) => (s.P[1 - q].av.length >= 2 ? 4 : 1) },
    cast: (c) => { const { E, s, seat: p } = c; const g = c.choose(s.P[p].av.filter((y) => garuda(E, s, y)).sort(cheapCard(E, s)), 1, "เลือกครุฑฝ่ายเราที่จะทำลาย", { exact: true })[0]; if (!g) return { explain: "", ops: [] };
      const ts = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 2, "เลือก Avatar ฝ่ายตรงข้ามสูงสุด 2 ใบ", { optional: true }); return { explain: `ทำลาย ${E.name(s, g)} · ทำลาย ${ts.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [{ op: "destroy", i: g.i, why: "พันปักษา" }, ...ts.map((y) => ({ op: "destroy", i: y.i, why: "พันปักษา" }))] }; } },
  // คาถา สตอปปุ (React): with a จอมเวท, our จอมเวทย์ attacked: a คาถา from hell under the Deck: the attack is cancelled
  "BT07-060": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return !!T && T.p === p && E.named(s, T.x, "จอมเวทย์") && s.P[p].av.some((y) => wizard(E, s, y)) && s.P[p].hell.some((y) => spell(E, s, y)); },
      botV: (E, s, q, on) => { const A = E.locate(s, on.att), T = E.locate(s, on.ti); return A && T && E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) >= E.power(s, T.x) ? 5 : -9; } },
    cast: (c) => { const { E, s, seat: p } = c; const t = [...s.P[p].hell].find((y) => spell(E, s, y)); return t ? { explain: `${E.name(s, t)} เข้าใต้ Deck · ยกเลิกการโจมตี`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, { op: "cancelAttack" }] } : { explain: "", ops: [] }; } },
  // ขอจบรายการแต่เพียงเท่านี้ (React): our พี่หน่วง about to be destroyed: the ship to hell, พี่หน่วง to the hand instead
  "BT07-061": { react: { kinds: ["doom"], can: (E, s, p, on) => on.p === p && s.P[p].cs.some((y) => E.named(s, y, "ยานรายการ เถียงทันหน่วง")) && on.kill.some((i) => { const L = E.locate(s, i); return L && E.named(s, L.x, "พี่หน่วง"); }), botV: (E, s, q, on) => doomV(E, s, q, on) + 1 },
    cast: (c) => { const { E, s, seat: p } = c; const ship = s.P[p].cs.find((y) => E.named(s, y, "ยานรายการ เถียงทันหน่วง")); const n = doomed(c, "kill").find((y) => E.named(s, y, "พี่หน่วง"));
      return ship && n ? { explain: `${E.name(s, ship)} ลงนรก · ${E.name(s, n)} กลับขึ้นมือแทนการถูกทำลาย`, ops: [{ op: "move", i: ship.i, to: "hell" }, { op: "move", i: n.i, to: "hand" }] } : { explain: "", ops: [] }; } },
  // ขนมณี แฟลร์: only {สัตว์วิเศษ} ครุฑ · when an opposing card would remove the wearer, this card goes to hell instead
  "BT07-062": { modOnly: (E, s, h) => garuda(E, s, h) && sy(E, s, h, "สัตว์วิเศษ"), worn: () => 0, hostSave: (E, s, m, host, o) => { if (o.fight || !o.fromOpp) return null; const L = E.locate(s, host.i); E.log(s, L ? L.p : null, `${E.name(s, m)} ลงนรกแทน: ${E.name(s, host)} ไม่ถูกนำออกจากสนาม`); E.moveTo(s, m.i, "hell"); return true; } },
  // เก้าอี้ เฟิร์สคลาส: the wearer is also named "Super Air"
  "BT07-064": { worn: () => 0, addName: "Super Air" },
  // ปลอกคอซื่อสัตย์: the wearer's control cannot change
  "BT07-065": { worn: () => 0, keepControl: true },
  // อาคารผู้โดยสารชั้นต่ำ (Land): once per turn with the plane, discard 1: a "ผู้โดยสาร Super Air" from hell or the Deck
  "BT07-066": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญผู้โดยสาร Super Air จากนรกหรือ Deck", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && plane(E, s, L.p) && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && [...s.P[L.p].hell, ...s.P[L.p].deck].some((y) => E.named(s, y, "ผู้โดยสาร Super Air")),
    run: (c) => { const { E, s, seat: p } = c; const h = s.P[p].hell.find((y) => E.named(s, y, "ผู้โดยสาร Super Air")); const t = h || s.P[p].deck.find((y) => E.named(s, y, "ผู้โดยสาร Super Air")); const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, ...(h ? [] : [{ op: "shuffle", seat: p }])] } : { explain: "", ops: [] }; } } },
  // หมู่บ้านเห็ด (Land): every Avatar's POWER is halved, rounded down
  "BT07-067": { halvePower: true },
  // ดินแดนหิมะสีเทา (Land): once per turn a "หิมะ" {ต่างชาติ} +1 per 2 ทหารหิมะ in our hell this turn
  "BT07-068": { activate: { label: "Avatar หิมะ POWER +1 ต่อทหารหิมะ 2 ใบในนรก", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hell.filter((y) => snowMan(E, s, y)).length >= 2 && s.P[L.p].av.some((y) => E.named(s, y, "หิมะ") && sy(E, s, y, "ต่างชาติ")),
    run: (c) => { const { E, s, seat: p } = c; const n = Math.floor(s.P[p].hell.filter((y) => snowMan(E, s, y)).length / 2); const t = c.choose(s.P[p].av.filter((y) => E.named(s, y, "หิมะ") && sy(E, s, y, "ต่างชาติ")).sort(strongFirst(E, s)), 1, "เลือก Avatar หิมะ", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} POWER +${n} จนจบเทิร์น`, ops: [{ op: "power", i: t.i, n, temp: true }] } : { explain: "", ops: [] }; } } },
  // สถานีตำรวจ (Land): ตำรวจ by Symbol: {คน} +2 · {หุ่นยนต์} สามัคคี · {ผี} โล่มนุษย์
  "BT07-069": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].flatMap((seat) => [{ seat, test: (x) => police(E, s, x) && sy(E, s, x, "คน"), n: 2 }, { seat, test: (x) => police(E, s, x) && sy(E, s, x, "หุ่นยนต์"), n: 0, kw: ["สามัคคี"] }, { seat, test: (x) => police(E, s, x) && sy(E, s, x, "ผี"), n: 0, kw: ["โล่มนุษย์"] }]) : []) },
  // งานเลี้ยงโดนใจ หัวใจโดนเธอ (Land): Avatars with โดนใจ +1
  "BT07-070": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((seat) => ({ seat, test: (x) => E.kw(s, x, "โดนใจ"), n: 1 })) : []) },
  // ยานรายการ เถียงทันหน่วง (Construct): Cost 0 with พี่หน่วง · with พี่หน่วง and an opposing Avatar in our Magic Zone: draw 1 in our End Phase · once per turn an Avatar gets โล่มนุษย์ until the end of the opponent's next turn
  "BT07-072": { selfCost: (E, s, x, p) => (s.P[p].av.some((y) => E.named(s, y, "พี่หน่วง")) ? -(E.def(s, x).c || 0) : 0),
    endPhase: (E, s, x, L) => (L.z === "cs" && L.p === s.active && s.P[L.p].av.some((y) => E.named(s, y, "พี่หน่วง")) && stolen(E, s, L.p).length ? [{ op: "draw", seat: L.p, n: 1 }] : []),
    activate: { label: "Avatar 1 ใบได้รับโล่มนุษย์จนจบเทิร์นถัดไปของฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].av.length > 0,
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort((a, b) => worth(E, s, a) - worth(E, s, b)), 1, "เลือก Avatar", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ได้รับโล่มนุษย์`, ops: [{ op: "keyword", i: t.i, k: "โล่มนุษย์", until: "oppturn" }] } : { explain: "", ops: [] }; } } },
  // บัลลังก์ตั๊กแตนศตวรรษ (Construct): once per turn worn by a ตั๊กแตน: +2, cannot attack, other ตั๊กแตน of ours +1
  "BT07-073": { worn: () => 2, hostNoAttack: true, aura: (E, s, src, L) => (L.z === "mg" && src.on != null ? [{ seat: L.p, test: (x) => x.i !== src.on && grass(E, s, x), n: 1 }] : []),
    activate: { label: "ไปสวมใส่ให้ Avatar ตั๊กแตน", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].av.some((y) => grass(E, s, y)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const h = c.choose(s.P[p].av.filter((y) => grass(E, s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ตั๊กแตน", { exact: true })[0]; return h ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: x.i, on: h.i }] } : { explain: "", ops: [] }; } } },
});

// ---------- BT08 ----------
const bangText = (E, s, x) => String(E.def(s, x).x || "").includes("ค่ายบางระจัน");
const general = (E, s, x, co) => isAv(E, s, x) && E.named(s, x, "ขุนพล") && sy(E, s, x, "ต่างชาติ") && (!co || E.colors(s, x).includes(co));
const ricky = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ริกกี้");
const isan = (E, s, x) => isAv(E, s, x) && E.named(s, x, "อีสานสลิงเกอร์");
const kok = (E, s) => E.lands(s).some((l) => !l.mute && E.named(s, l, "โคกอีสานนูน"));
const ratAv = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "รัททาทุย");
const rd = (E, s, x) => isAv(E, s, x) && (E.named(s, x, "ทหาร") || E.named(s, x, "รด."));
const bangFree = (E, s, p) => s.P[p].av.some((y) => !y.mute && E.named(s, y, "ไอ้ชิด"));
const textHas = (E, s, x, ...ks) => ks.some((k) => String(E.def(s, x).x || "").includes(k));
const deadOf = (c) => (c.t.dead != null ? c.E.locate(c.s, c.t.dead) : null);
const kwAura = (L, src, k) => [{ seat: L.p, test: (x) => x.i === src.i, n: 0, kw: [k] }];
Object.assign(SCRIPTS, {
  // อีวิลไมเกรน: จุติ mill 5: a weapon from hell to the hand · once per turn when a weapon Modification is used: the opponent's top card, Magic to hell
  "BT08-001": { summon: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const t = c.choose(uniq(E, s, [...P.deck.slice(0, 5), ...P.hell].filter((y) => E.named(s, y, "อาวุธหุ่นนักรบผู้กล้า"))), 1, "เลือกอาวุธหุ่นนักรบผู้กล้าในนรก")[0];
      return { explain: `ธรณีสูบ 5 ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "mill", seat: p, n: 5 }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : [])] }; },
    magicSeen: (c) => (once(c.s, c.seat, "อีวิลไมเกรน") ? { explain: "สอดแนม Deck ฝ่ายตรงข้าม 1 ใบ: ถ้าเป็น Magic ส่งลงนรก", ops: [{ op: "nameOnce", seat: c.seat, name: "อีวิลไมเกรน" }, { op: "topPeek", seat: 1 - c.seat, type: "M" }] } : { explain: "", ops: [] }),
    magicSeenOk: (E, s, y, Ly, d) => Ly.z === "av" && d.st === "D" && String(d.n || "").includes("อาวุธหุ่นนักรบผู้กล้า") && once(s, Ly.p, "อีวิลไมเกรน") },
  // ไอ้ชิด: our "ค่ายบางระจัน" abilities need no discard
  "BT08-002": { bangFree: true },
  // เณรคู: once per turn with ค่ายบางระจัน, discard 1: our ค่ายบางระจัน Avatars ignore the opponent's React Magic this turn
  "BT08-003": { activate: { label: "ทิ้ง 1 ใบ: Avatar ค่ายบางระจันไม่รับผล React ของฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].cs.some((y) => E.named(s, y, "ค่ายบางระจัน")) && (s.P[L.p].hand.length > 0 || bangFree(E, s, L.p)),
    run: (c) => { const { E, s, seat: p } = c; const free = bangFree(E, s, p); const pay = free ? null : c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; if (!free && !pay) return { explain: "", ops: [] };
      const ts = s.P[p].av.filter((y) => bangText(E, s, y)); return { explain: `${free ? "" : `ทิ้ง ${E.name(s, pay)} · `}Avatar ค่ายบางระจัน ${ts.length} ใบ ไม่รับผล React ของฝ่ายตรงข้ามจนจบเทิร์น`, ops: [...(pay ? [{ op: "discard", seat: p, iids: [pay.i] }] : []), ...ts.map((y) => ({ op: "rimm", i: y.i }))] }; } } },
  // น้าเอี๊ยด: other ค่ายบางระจัน Avatars +1, the ค่ายบางระจัน Construct +2, our ค่ายบางระจัน Modifications give +1 more
  "BT08-004": { aura: (E, s, src, L) => (L.z !== "av" ? [] : [{ seat: L.p, test: (x) => x.i !== src.i && bangText(E, s, x), n: 1 }, { seat: L.p, test: (x) => E.named(s, x, "ค่ายบางระจัน"), n: 2, cs: true },
    ...s.P[L.p].av.map((y) => ({ seat: L.p, test: (x) => x.i === y.i, n: [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === y.i && bangText(E, s, m)).length })).filter((a) => a.n > 0)]) },
  // ซุนกวน: once per turn 2 "ง่อก๊ก"/"พลเดินทัพ" from hell under the Deck: destroy a card on the field
  "BT08-005": { activate: { label: "นำง่อก๊ก/พลเดินทัพในนรก 2 ใบเข้าใต้ Deck: ทำลายการ์ดบนสนาม 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.filter((y) => isAv(E, s, y) && (E.named(s, y, "ง่อก๊ก") || E.named(s, y, "พลเดินทัพ"))).length >= 2,
    run: (c) => { const { E, s, seat: p } = c; const two = s.P[p].hell.filter((y) => isAv(E, s, y) && (E.named(s, y, "ง่อก๊ก") || E.named(s, y, "พลเดินทัพ"))).sort(cheapCard(E, s)).slice(0, 2); const O = s.P[1 - p];
      const t = c.choose([...O.av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...O.cs, ...O.mg, ...E.lands(s).filter((l) => l.o !== p)], 1, "เลือกการ์ดบนสนามที่จะทำลาย", { exact: true })[0];
      return two.length === 2 && t ? { explain: `นำ 2 ใบเข้าใต้ Deck · ทำลาย ${E.name(s, t)}`, ops: [...two.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "destroy", i: t.i, why: "ซุนกวน" }] } : { explain: "", ops: [] }; } } },
  // จิวท่าย: discarded from the hand when our red ขุนพล {ต่างชาติ} would be removed by an ability: it stays (ซุนกวน: draw 1)
  "BT08-007": { saveOther: (E, s, y, Ly, x, L, ctx) => { if (Ly.z !== "hand" || L.z !== "av" || L.p !== Ly.p || (ctx && ctx.fight) || !general(E, s, x, "แดง")) return null; const sun = E.named(s, x, "ซุนกวน");
    return { why: `ทิ้ง ${E.name(s, y)}: ${E.name(s, x)} ไม่ถูกนำออกจากสนาม${sun ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "discard", seat: Ly.p, iids: [y.i] }, ...(sun ? [{ op: "draw", seat: Ly.p, n: 1 }] : [])] }; } },
  // กาลาฮัด: Cost 4 with 2+ holy swords in our Magic Zone · +1 per different holy sword there
  "BT08-008": { selfCost: (E, s, x, p) => (s.P[p].mg.filter((m) => holySword(E, s, m)).length >= 2 ? 4 - (E.def(s, x).c || 0) : 0),
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: new Set(s.P[L.p].mg.filter((m) => holySword(E, s, m)).map((m) => E.name(s, m))).size }] : []) },
  // เอเจ้นท์สมูท: คำสั่งเสีย scout 3, a เอเจ้นท์สมูท to the hand · in our Battle Phase POWER = 1 per 2 of them in our hell
  "BT08-009": { death: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 3, (y) => E.named(s, y, "เอเจ้นท์สมูท"), "เลือกเอเจ้นท์สมูทจากที่สอดแนม"); if (!top.length) return { explain: "Deck หมด", ops: [] };
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [])] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.phase === "battle" && s.active === L.p ? [{ seat: L.p, test: (x) => x.i === src.i, n: Math.floor(s.P[L.p].hell.filter((y) => E.named(s, y, "เอเจ้นท์สมูท")).length / 2) - (E.def(s, src).pw || 0) }] : []) },
  // เซอร์นัท: จุติ a "ไอ้นัท" from hell worn by it · +3 fighting a purple Avatar · our เลอติ๊ก +2
  "BT08-010": { summon: (c) => { const { E, s, seat: p, self: x } = c; const n = [...s.P[p].hell].reverse().find((y) => E.named(s, y, "ไอ้นัท")); return n && x ? { explain: `${E.name(s, n)} จากนรกสวมใส่ให้การ์ดใบนี้`, ops: [{ op: "attach", i: n.i, on: x.i }] } : { explain: "ไม่มีไอ้นัทในนรก", ops: [] }; },
    fight: (c) => { const { E, s, self: x } = c; const f = x && foeOf(E, s, x); return f && E.colors(s, f).includes("ม่วง") ? { explain: "ต่อสู้กับ Avatar สีม่วง: POWER +3", ops: [{ op: "power", i: x.i, n: 3, temp: "fight" }] } : { explain: "", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => E.named(s, x, "เลอติ๊ก เด็กไม่ชอบแดรคคูลา"), n: 2 }] : []) },
  // ซาบะริว: one copy · Cost 0 in the hand while the opponent has เจค นักฆ่ามือเก๋า
  "BT08-011": { uniq: true, selfCost: (E, s, x, p) => (E.locate(s, x.i)?.z === "hand" && s.P[1 - p].av.some((y) => E.named(s, y, "เจค นักฆ่ามือเก๋า")) ? -(E.def(s, x).c || 0) : 0) },
  // หมอเสริมศักดิ์: จุติ scout 5: หมอมาแล้วววว to the hand · คำสั่งเสีย an Avatar of Cost 2 or less, or พยาบาล เอ๋, from hell
  "BT08-012": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => E.named(s, y, "หมอมาแล้ว"), "เลือกหมอมาแล้วววว"); if (!top.length) return { explain: "Deck หมด", ops: [] };
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""} · ที่เหลือกลับ Deck แล้วสับ`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), { op: "shuffle", seat: p }] }; },
    death: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose([...s.P[p].hell].filter((y) => isAv(E, s, y) && y !== x && ((E.def(s, y).c || 0) <= 2 || E.named(s, y, "พยาบาล เอ๋"))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ในนรกที่จะอัญเชิญ")[0];
      return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // เปรตรัททาทุย: summoned: sacrifice นางพญา/พ่อพันธุ์: another {รัททาทุย} from hell · +1 per our face-up LIFE
  "BT08-013": { summon: (c) => { const { E, s, seat: p } = c; const sac = s.P[p].av.find((y) => E.named(s, y, "รัททาทุย นางพญา") || E.named(s, y, "รัททาทุย พ่อพันธุ์")); if (!sac) return { explain: "ไม่มีนางพญาหรือพ่อพันธุ์", ops: [] };
      const t = c.choose([...s.P[p].hell].filter((y) => ratAv(E, s, y) && !E.named(s, y, "รัททาทุย นางพญา") && !E.named(s, y, "รัททาทุย พ่อพันธุ์")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกรัททาทุยในนรก")[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "put", i: t.i }] } : { explain: "ไม่มีรัททาทุยในนรก", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i === src.i, n: facedUp(s, L.p) }] : []) },
  // ริกกี้ ฆาตกรถลกหนัง: after a fight win: to hell, a different ริกกี้ {แมลง} from the Deck with จุติ
  "BT08-014": { kill: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "av") return { explain: "", ops: [] }; const t = s.P[p].deck.filter((y) => ricky(E, s, y) && sy(E, s, y, "แมลง") && E.name(s, y) !== E.name(s, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
    if (!t || c.mode([`ส่งใบนี้ลงนรก อัญเชิญ ${E.name(s, t)}`, "ไม่ใช้"], E.name(s, x), 0) !== 0) return { explain: "ไม่ใช้", ops: [] }; return { explain: `${E.name(s, x)} ลงนรก · อัญเชิญ ${E.name(s, t)} แบบจุติ`, ops: [{ op: "move", i: x.i, to: "hell" }, { op: "put", i: t.i, jt: true }, { op: "shuffle", seat: p }] }; } },
  // ริกกี้ คุณหมอ: after a fight win: "หนังมนุษย์ ชุดแก้แค้น" from the Deck
  "BT08-016": { kill: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck.find((y) => E.named(s, y, "หนังมนุษย์ ชุดแก้แค้น")); return t ? { explain: `${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "ไม่มีใน Deck", ops: [] }; } },
  // มอเดรด: once per turn given a holy sword: sacrifice another of ours: a blue knight from hell with จุติ
  "BT08-017": { gotModOk: (E, s, host, m) => holySword(E, s, m) && host.used !== s.turn, gotMod: (c) => { const { E, s, seat: p, self: x } = c; const sac = c.choose(s.P[p].av.filter((y) => y.i !== x.i).sort(cheapCard(E, s)), 1, "เซ่นไหว้ Avatar ใบอื่นฝ่ายเรา")[0];
    const t = sac ? c.choose([...s.P[p].hell].filter((y) => knight(E, s, y) && E.colors(s, y).includes("ฟ้า")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกอัศวินโต๊ะกลมสีฟ้าในนรก")[0] : null;
    return sac && t ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · อัญเชิญ ${E.name(s, t)} แบบจุติ`, ops: [{ op: "used", i: x.i }, { op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "put", i: t.i, jt: true }] } : { explain: "ไม่ได้ใช้", ops: [] }; } },
  // โจโฉ: จุติ a blue ขุนพล {ต่างชาติ} from the hand · when our blue ขุนพล is attacked: flip our top LIFE, the attack is cancelled · once per turn when our LIFE flips: scout, a "วุยก๊ก" summoned
  "BT08-018": { summon: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].hand.filter((y) => general(E, s, y, "ฟ้า")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกขุนพลสีฟ้าบนมือ")[0]; return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} แบบจุติ`, ops: [{ op: "put", i: t.i, jt: true }] } : { explain: "ไม่มีขุนพลสีฟ้าบนมือ", ops: [] }; },
    answer: { label: "หงาย LIFE ใบบนสุด: ยกเลิกการโจมตี", can: (E, s, x, L) => { if (L.z !== "av" || !s.pend || s.pend.tk !== "av") return false; const T = E.locate(s, s.pend.ti); return !!T && T.p === L.p && general(E, s, T.x, "ฟ้า") && s.P[L.p].life.some((y) => !y.up); },
      botOk: (E, s, x, L, ap) => { const T = E.locate(s, s.pend.ti); return !!T && ap >= E.power(s, T.x) && s.P[L.p].life.filter((y) => !y.up).length >= 2; }, run: () => ({ explain: "หงาย LIFE ใบบนสุด · ยกเลิกการโจมตี", ops: [{ op: "lifeFlip" }, { op: "cancelAttack" }] }) },
    lifeFlip: (c) => { const { E, s, seat: p } = c; if (!once(s, p, "โจโฉ")) return { explain: "", ops: [] }; const n = facedUp(s, p) + (s.P[p].av.some((y) => E.def(s, y).n === "โจผี ขุนพลผู้สืบทอดแห่งวุยก๊ก") ? 2 : 0); /* โจผี: +2 */ const { top, t } = scoutPick(c, n, (y) => isAv(E, s, y) && E.named(s, y, "วุยก๊ก"), "เลือก Avatar วุยก๊กจากที่สอดแนม"); if (!top.length) return { explain: "", ops: [] }; const put = t && E.avatars(s.P[p]) < 4;
      return { explain: `สอดแนม ${top.length} ใบ${put ? ` · อัญเชิญ ${E.name(s, t)}` : ""}`, ops: [{ op: "nameOnce", seat: p, name: "โจโฉ" }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(put ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }] }; } },
  // สุมาอี้: with โจโฉ and only blue ขุนพล beside it, the opponent must attack at least once
  "BT08-019": { forceAttack: (E, s, y, Ly) => Ly.z === "av" && s.P[Ly.p].av.some((z) => E.named(s, z, "โจโฉ ผู้นำเบ็ดเสร็จแห่งวุยก๊ก")) && s.P[Ly.p].av.every((z) => z.i === y.i || general(E, s, z, "ฟ้า")) },
  // นายพลทหารหิมะ หลินอัน: Cost -2 in the hand with 10+ ทหารหิมะ in hell · opposing Avatar abilities that lower our หิมะ raise them instead
  "BT08-022": { snowFlip: true, selfCost: (E, s, x, p) => (E.locate(s, x.i)?.z === "hand" && s.P[p].hell.filter((y) => snowMan(E, s, y)).length >= 10 ? -2 : 0) },
  // มฤตยูเทวี: จุติ a {นรก} Cost 5 in our hell: its จุติ works for this card
  "BT08-023": { summon: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose([...s.P[p].hell].filter((y) => isAv(E, s, y) && sy(E, s, y, "นรก") && (E.def(s, y).c || 0) === 5).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar {นรก} Cost 5 ในนรก")[0];
    return t && x ? { explain: `ได้รับความสามารถของ ${E.name(s, t)}`, ops: [{ op: "copySummon", i: x.i, from: t.i }] } : { explain: "ไม่มี Avatar {นรก} Cost 5 ในนรก", ops: [] }; } },
  // อีสานสลิงเกอร์ ปิ๊ก: จุติ mill 3: โคกอีสานนูน from the Deck or hell to the hand
  "BT08-024": { summon: (c) => { const { E, s, seat: p } = c; const h = [...s.P[p].deck.slice(0, 3), ...s.P[p].hell].find((y) => E.named(s, y, "โคกอีสานนูน")); const d = h ? null : s.P[p].deck.find((y) => E.named(s, y, "โคกอีสานนูน"));
    return { explain: `ธรณีสูบ 3 ใบ${h || d ? " · โคกอีสานนูน ขึ้นมือ" : ""}`, ops: [{ op: "mill", seat: p, n: 3 }, ...(h ? [{ op: "move", i: h.i, to: "hand" }] : d ? [{ op: "search", seat: p, take: d.i, to: "hand" }] : [])] }; } },
  // อีสานสลิงเกอร์ ปิ่น: when it attacks with โคกอีสานนูน: mill 3, then the attack may go to the opponent's LIFE
  "BT08-025": { attackOk: (E, s) => kok(E, s), attack: (c) => { const { E, s } = c; if (!kok(E, s) || !s.pend || s.pend.tk === "life") return { explain: "", ops: [] }; if (c.mode(["ธรณีสูบ 3 ใบ แล้วย้ายเป้าหมายไปที่ LIFE", "ไม่ใช้"], "อีสานสลิงเกอร์ ปิ่น", 0) !== 0) return { explain: "ไม่ใช้", ops: [] };
    return { explain: "ธรณีสูบ 3 ใบ · ย้ายเป้าหมายไปที่ LIFE ฝ่ายตรงข้าม", ops: [{ op: "mill", seat: c.seat, n: 3 }, { op: "redirect", life: true }] }; } },
  // อีสานสลิงเกอร์ เปอร์: once per turn with โคกอีสานนูน, mill 3: +2 this turn · destroying an opposing Avatar in the Main Phase with it: flip their top LIFE
  "BT08-026": { activate: { label: "ธรณีสูบ 3 ใบ: POWER +2 จนจบเทิร์น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && kok(E, s) && s.P[L.p].deck.length >= 3, run: (c) => ({ explain: "ธรณีสูบ 3 ใบ · POWER +2", ops: [{ op: "mill", seat: c.seat, n: 3 }, { op: "power", i: c.self.i, n: 2, temp: true }] }) },
    kill: (c) => (c.s.phase === "main" && kok(c.E, c.s) ? { explain: "หงาย LIFE ฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] } : { explain: "", ops: [] }) },
  // กัฟแดน: with โรงเรียนเวทย์มนต์ on the Land Magic Zone the opponent cannot use Land Magic
  "BT08-027": { landBlock: (E, s, y, Ly) => Ly.z === "av" && E.lands(s).some((l) => E.named(s, l, "โรงเรียนเวทย์มนต์")) },
  // พี่ไท่ น้องเฟิง: once per game, in our first turn: จุติ discard 2: 3 Avatars of Cost 1 or less with different Symbols from the Deck
  "BT08-028": { summon: (c) => { const { E, s, seat: p } = c; if (s.turn > 2 || (s.nu && s.nu[p] && s.nu[p]["พี่ไท่ น้องเฟิง"] != null)) return { explain: "ใช้ได้ในเทิร์นแรกเท่านั้น", ops: [] }; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); if (pay.length < 2) return { explain: "การ์ดบนมือไม่พอ", ops: [] };
    const got = [], seen = new Set(); for (const y of [...s.P[p].deck].sort((a, b) => worth(E, s, b) - worth(E, s, a))) { if (!isAv(E, s, y) || (E.def(s, y).c || 0) > 1) continue; const k = String(E.def(s, y).sy || ""); if (seen.has(k)) continue; seen.add(k); got.push(y); if (got.length >= Math.min(3, freeAv(E, s, p))) break; }
    return { explain: `ทิ้ง 2 ใบ · อัญเชิญ ${got.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [{ op: "nameOnce", seat: p, name: "พี่ไท่ น้องเฟิง" }, { op: "discard", seat: p, iids: pay.map((y) => y.i) }, ...got.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; } },
  // เต่า: จุติ with อ่อ กระต่ายตาย face up (found and flipped from our face-down LIFE if needed): 1) destroy an opposing Avatar weaker than it · 2) เนยถั่ว from the Deck worn by it
  "BT08-030": { summon: (c) => { const { E, s, seat: p, self: x } = c; const life = s.P[p].life.find((y) => E.named(s, y, "อ่อ กระต่ายตาย")); if (!life || !x) return { explain: "ไม่มี อ่อ กระต่ายตาย ใน LIFE", ops: [] };
    const ops = life.up ? [] : [{ op: "lifeFlipCard", i: life.i }]; const foes = s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.power(s, y) < E.power(s, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a)); const nut = s.P[p].deck.find((y) => E.named(s, y, "เนยถั่ว"));
    const m = c.mode(["1) ทำลาย Avatar ฝ่ายตรงข้ามที่ POWER น้อยกว่า", "2) เนยถั่ว จาก Deck สวมใส่การ์ดใบนี้"], "เต่า: เลือกปฏิบัติ", foes.length ? 0 : 1);
    if (m === 0) { const t = c.choose(foes, 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0]; return { explain: t ? `ทำลาย ${E.name(s, t)}` : "ไม่มีเป้าหมาย", ops: [...ops, ...(t ? [{ op: "destroy", i: t.i, why: "เต่า" }] : [])] }; }
    return { explain: nut ? "เนยถั่ว สวมใส่การ์ดใบนี้" : "ไม่มีเนยถั่วใน Deck", ops: [...ops, ...(nut ? [{ op: "attach", i: nut.i, on: x.i }, { op: "shuffle", seat: p }] : [])] }; } },
  // Overdose (3+ face-up LIFE of ours): พูรินอล blocks the opponent's จุติ/คำสั่งเสีย · ชาโค่ล their ธรณีสูบ · เซตาม่อน their โล่มนุษย์/ลูกฮึด · our other cards cannot use abilities
  "BT08-031": { odBlock: ["summon", "death"], kill: (c) => { const L = deadOf(c); return L && textHas(c.E, c.s, L.x, "จุติ", "คำสั่งเสีย") && c.s.P[c.seat].life.some((y) => y.up) ? { explain: "คว่ำ LIFE ฝ่ายเรา 1 ใบ", ops: [{ op: "lifeFlip", up: false, force: true }] } : { explain: "", ops: [] }; } },
  "BT08-032": { odBlock: ["mill"], kill: (c) => { const { E, s, seat: p } = c; const L = deadOf(c); return L && textHas(E, s, L.x, "ธรณีสูบ", "สอดแนม") ? { explain: "Avatar Overdose ทุกใบ POWER +1", ops: s.P[p].av.filter((y) => E.named(s, y, "Overdose")).map((y) => ({ op: "power", i: y.i, n: 1, temp: false })) } : { explain: "", ops: [] }; } },
  "BT08-033": { odBlock: ["shield"], kill: (c) => { const L = deadOf(c); return L && textHas(c.E, c.s, L.x, "โล่มนุษย์", "ลูกฮึด") ? { explain: "หงาย LIFE ฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] } : { explain: "", ops: [] }; } },
  // เล่าปี่: our จ๊กก๊ก +1 · with another green ขุนพล: cannot be attacked or chosen by the opponent's Magic
  "BT08-035": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => E.named(s, x, "จ๊กก๊ก"), n: 1 }] : []), noAtk: (E, s, x, L) => L.z === "av" && s.P[L.p].av.some((y) => y.i !== x.i && general(E, s, y, "เขียว")),
    untargetable: (E, s, x, L) => { if (L.z !== "av" || !s.P[L.p].av.some((y) => y.i !== x.i && general(E, s, y, "เขียว"))) return false; const t = s.trig[0]; const src = t && s.cards[t.c]; return !!src && src.t === "M" && t.seat !== L.p; } },
  // ขงเบ้ง: once per turn (by name) when the opponent uses a Magic, with เล่าปี่ and only green ขุนพล beside it, discard 1: that Magic is cancelled
  "BT08-036": { magicSeenOk: (E, s, y, Ly, d, by) => Ly.z === "av" && by !== Ly.p && once(s, Ly.p, "ขงเบ้ง") && s.P[Ly.p].hand.length > 0 && s.P[Ly.p].av.some((z) => E.named(s, z, "เล่าปี่ ผู้นำคุณธรรมแห่งจ๊กก๊ก")) && s.P[Ly.p].av.every((z) => z.i === y.i || general(E, s, z, "เขียว")),
    magicSeen: (c) => { const { E, s, seat: p } = c; if (!once(s, p, "ขงเบ้ง")) return { explain: "", ops: [] }; const pay = [...s.P[p].hand].sort(cheapCard(E, s))[0]; const M = c.t.mi != null ? E.locate(s, c.t.mi) : null; if (!pay || !M) return { explain: "", ops: [] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · ยกเลิก ${E.name(s, M.x)}`, ops: [{ op: "nameOnce", seat: p, name: "ขงเบ้ง" }, { op: "discard", seat: p, iids: [pay.i] }, { op: "cancelTrig", i: M.x.i, cast: true }, ...(M.z === "land" || M.z === "mg" ? [{ op: "move", i: M.x.i, to: "hell" }] : [])] }; } },
  // จูล่ง: จุติ alone on our Avatar Zone: a green ขุนพล from hell · when our จ๊กก๊ก is destroyed: summoned from the hand by paying (จุติ)
  "BT08-037": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (s.P[p].av.some((y) => y.i !== (x && x.i))) return { explain: "มี Avatar ใบอื่นอยู่", ops: [] }; const t = c.choose([...s.P[p].hell].filter((y) => general(E, s, y, "เขียว") && !E.named(s, y, "จูล่ง")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกขุนพลสีเขียวในนรก")[0];
      return t ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "ไม่มีขุนพลสีเขียวในนรก", ops: [] }; },
    handDeath: (c) => ({ explain: `อัญเชิญ ${c.E.name(c.s, c.self)} จากมือโดยจ่าย Cost`, ops: [{ op: "payPut", seat: c.seat, i: c.self.i }] }), handDeathOk: (E, s, y, dead) => E.named(s, dead, "จ๊กก๊ก") && E.avatars(s.P[y.o]) < 4 && !!E.autoPay(s, y.o, y.i) },
  // มณโฑ: counts as {ยักษ์} · once per turn sacrifice a {ยักษ์}: a different {ยักษ์} of the same POWER from hell, +2 this turn
  "BT08-038": { extraSy: "ยักษ์", activate: { label: "เซ่นไหว้ยักษ์: อัญเชิญยักษ์ POWER เท่ากันจากนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => sy(E, s, y, "ยักษ์") && s.P[L.p].hell.some((z) => isAv(E, s, z) && sy(E, s, z, "ยักษ์") && (E.def(s, z).pw || 0) === E.power(s, y) && E.name(s, z) !== E.name(s, y))),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const sac = c.choose(P.av.filter((y) => sy(E, s, y, "ยักษ์") && P.hell.some((z) => isAv(E, s, z) && sy(E, s, z, "ยักษ์") && (E.def(s, z).pw || 0) === E.power(s, y) && E.name(s, z) !== E.name(s, y))).sort(cheapCard(E, s)), 1, "เซ่นไหว้ Avatar {ยักษ์}", { exact: true })[0]; if (!sac) return { explain: "", ops: [] };
      const pw = E.power(s, sac); const t = c.choose(P.hell.filter((z) => isAv(E, s, z) && sy(E, s, z, "ยักษ์") && (E.def(s, z).pw || 0) === pw && E.name(s, z) !== E.name(s, sac)), 1, `เลือกยักษ์ POWER ${pw} ในนรก`, { exact: true })[0];
      return t ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · อัญเชิญ ${E.name(s, t)} POWER +2`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "put", i: t.i }, { op: "power", i: t.i, n: 2, temp: true }] } : { explain: "", ops: [] }; } } },
  // ราชา รด.: +1 whenever a ทหาร or รด. comes to our Avatar Zone · once per turn scout 2: a ทหาร/รด. {คน} summoned
  "BT08-039": { allyIn: (E, s, y, x) => rd(E, s, x), activate: { label: "สอดแนม 2 ใบ: อัญเชิญทหารหรือรด.", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].deck.length > 0 && E.avatars(s.P[L.p]) < 4,
    run: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 2, (y) => rd(E, s, y) && sy(E, s, y, "คน") && !E.named(s, y, "ราชา รด."), "เลือกทหารหรือรด. จากที่สอดแนม"); if (!top.length) return { explain: "", ops: [] };
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · อัญเชิญ ${E.name(s, t)}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }] }; } } },
  // จ่าอเวจี: our green {คน} Avatars are also named "ทหาร"
  "BT08-040": { nameAura: { name: "ทหาร", test: (E, s, x) => ["A", "T"].includes(E.def(s, x).t) && E.hasSy(s, x, "คน") && E.colors(s, x).includes("เขียว") } },
  // ปีศาจวานร: once per turn after a fight win with another วานร of ours, discard 1: wake up
  "BT08-042": { kill: (c) => { const { E, s, seat: p, self: x } = c; if (!x || x.used === s.turn || E.locate(s, x.i)?.z !== "av" || !s.P[p].av.some((y) => y.i !== x.i && monkey(E, s, y)) || !s.P[p].hand.length || x.a) return { explain: "", ops: [] };
    const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ")[0]; return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · กลับมาตื่น`, ops: [{ op: "used", i: x.i }, { op: "discard", seat: p, iids: [pay.i] }, { op: "wake", i: x.i }] } : { explain: "", ops: [] }; } },
  // แหมกำบ่อ้าย: with 15 or fewer cards in the Deck: up to 5 cards from hell back into the Deck
  "BT08-049": { canCast: (E, s, p) => s.P[p].deck.length <= 15 && s.P[p].hell.some((y) => !E.named(s, y, "แหมกำบ่อ้าย")), cast: (c) => { const { E, s, seat: p } = c; const ts = c.choose([...s.P[p].hell].filter((y) => !E.named(s, y, "แหมกำบ่อ้าย")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 5, "เลือกการ์ดในนรกสูงสุด 5 ใบ", { optional: true });
    return { explain: `นำ ${ts.length} ใบกลับเข้า Deck แล้วสับ`, ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "shuffle", seat: p }] }; } },
  // หนังมนุษย์ ชุดแก้แค้น: a ริกกี้ of ours to hell: a ริกกี้ of another name from the Deck with จุติ · also as a React in the opponent's turn or our Battle Phase
  "BT08-051": { asReact: () => true, asReactBattle: true, canCast: (E, s, p) => s.P[p].av.some((y) => ricky(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; const r = c.choose(s.P[p].av.filter((y) => ricky(E, s, y)).sort(cheapCard(E, s)), 1, "เลือกริกกี้ฝ่ายเรา", { exact: true })[0]; if (!r) return { explain: "", ops: [] };
    const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => ricky(E, s, y) && E.name(s, y) !== E.name(s, r))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกริกกี้ชื่ออื่นจาก Deck", { exact: true })[0];
    return { explain: `${E.name(s, r)} ลงนรก${t ? ` · อัญเชิญ ${E.name(s, t)} แบบจุติ` : ""}`, ops: [{ op: "move", i: r.i, to: "hell" }, ...(t ? [{ op: "put", i: t.i, jt: true }, { op: "shuffle", seat: p }] : [])] }; } },
  // โจมตีตัวฉันให้โดนถ้าหากเธอทำได้ (React): the attack moves to an Avatar of ours we choose
  "BT08-054": { react: { kinds: ["attack"], can: (E, s, p, on) => s.P[p].av.some((y) => y.i !== on.ti && !E.atkSafe(s, y)), botV: (E, s, q, on) => { const A = E.locate(s, on.att); const ap = A ? E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) : 0; return s.P[q].av.some((y) => y.i !== on.ti && E.power(s, y) > ap) ? 5 : -9; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const A = on.att != null ? E.locate(s, on.att) : null; const ap = A ? E.power(s, A.x) : 0; const t = c.choose(s.P[p].av.filter((y) => y.i !== on.ti && !E.atkSafe(s, y)).sort((a, b) => (E.power(s, b) > ap) - (E.power(s, a) > ap) || E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายเราที่จะรับการโจมตี", { exact: true })[0];
      return t ? { explain: `เปลี่ยนเป้าหมายไปที่ ${E.name(s, t)}`, ops: [{ op: "redirect", i: t.i }] } : { explain: "", ops: [] }; } },
  // แผนการ : ตอกฝาโลง (React): the opponent's คำสั่งเสีย is cancelled
  "BT08-055": { react: { kinds: ["death"], can: (E, s, p, on) => on.by !== p && s.trig.some((t) => t.i === on.i && t.when === "death"), botV: () => 3 }, cast: (c) => { const on = onTarget(c); return on.i != null ? { explain: "ยกเลิกคำสั่งเสียนั้น", ops: [{ op: "cancelTrig", i: on.i }] } : { explain: "", ops: [] }; } },
  // ลุ้นเยี่ยวเหนียว (React, the opponent attacks, both sides have Avatars): both roll; the lower one's Avatars go under their Decks
  "BT08-056": { react: { kinds: ["attack"], can: (E, s, p) => s.P[0].av.length > 0 && s.P[1].av.length > 0, botV: (E, s, q) => (s.P[1 - q].av.reduce((a, y) => a + worth(E, s, y), 0) > s.P[q].av.reduce((a, y) => a + worth(E, s, y), 0) + 4 ? 4 : -9) }, cast: () => ({ explain: "ทุกฝ่ายทอยลูกเต๋า", ops: [{ op: "rollOff" }] }) },
  // แหม่อ้ายก็~~~ (React): the attack declaration is cancelled
  "BT08-057": { react: { kinds: ["attack"], botV: (E, s, q, on) => { const A = E.locate(s, on.att), T = on.tk === "av" ? E.locate(s, on.ti) : null; const ap = A ? E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) : 0; return on.tk === "life" || (T && ap >= E.power(s, T.x)) ? 4 : -9; } }, cast: () => ({ explain: "ยกเลิกการประกาศโจมตี", ops: [{ op: "cancelAttack" }] }) },
  // รัททาทุยเกาะหน้า (React): our {รัททาทุย} destroyed: destroy an opposing Avatar of Cost 5 or less, then a Cost 1 GEM 1 POWER 1 {รัททาทุย} from the Deck
  "BT08-058": { react: { kinds: ["destroyed"], can: (E, s, p, on) => { const L = E.locate(s, on.i); return on.p === p && !!L && ratAv(E, s, L.x); }, botV: () => 4 },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) <= 5).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน 5", { exact: true })[0];
      const r = s.P[p].deck.find((y) => ratAv(E, s, y) && (E.def(s, y).c || 0) === 1 && (E.def(s, y).g || 0) === 1 && (E.def(s, y).pw || 0) === 1);
      return { explain: `${t ? `ทำลาย ${E.name(s, t)}` : "ไม่มีเป้าหมาย"}${r ? ` · อัญเชิญ ${E.name(s, r)}` : ""}`, ops: [...(t ? [{ op: "destroy", i: t.i, why: "รัททาทุยเกาะหน้า" }] : []), ...(r ? [{ op: "put", i: r.i }, { op: "shuffle", seat: p }] : [])] }; } },
  // ดาบศักดิ์สิทธิ์ คาเรนต์: only knights · after the wearer wins a fight: destroy a Magic on the opponent's field · มอเดรด wearing it has เตะไข่ · from hell like the other holy swords
  "BT08-059": { modOnly: (E, s, h) => knight(E, s, h), worn: () => 0, activate: fromHellMod(knight, "อัศวินโต๊ะกลม"),
    hostWin: (c) => { const { E, s, seat: p } = c; const O = s.P[1 - p]; const t = c.choose([...O.mg, ...E.lands(s).filter((l) => l.o !== p)].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Magic บนสนามฝ่ายตรงข้าม", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ดาบศักดิ์สิทธิ์ คาเรนต์" }] } : { explain: "ไม่มี Magic บนสนามฝ่ายตรงข้าม", ops: [] }; },
    aura: (E, s, src, L) => { const H = src.on != null ? E.locate(s, src.on) : null; return L.z === "mg" && H && E.named(s, H.x, "มอเดรด") ? [{ seat: H.p, test: (x) => x.i === H.x.i, n: 0, kw: ["เตะไข่"] }] : []; } },
  // ดาบศักดิ์สิทธิ์ เอกซ์คาลิเบอร์: only อาเธอร์ · +2 · destroyed instead when the wearer would leave · from hell to อาเธอร์ (counts as the Modification)
  "BT08-060": { modOnly: (E, s, h) => E.named(s, h, "อาเธอร์ ราชาแห่งอัศวินโต๊ะกลม"), worn: () => 2, hostSave: (E, s, m, host) => { const L = E.locate(s, host.i); E.log(s, L ? L.p : null, `${E.name(s, m)} ถูกทำลายแทน: ${E.name(s, host)} ไม่ออกจากสนาม`); E.moveTo(s, m.i, "hell"); return true; },
    activate: { label: "จากนรกไปสวมใส่ให้อาเธอร์", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.some((y) => E.named(s, y, "อาเธอร์ ราชาแห่งอัศวินโต๊ะกลม")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[p].av.find((y) => E.named(s, y, "อาเธอร์ ราชาแห่งอัศวินโต๊ะกลม")); return h ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, h)}`, ops: [{ op: "attach", i: x.i, on: h.i }, { op: "useMod", seat: p }] } : { explain: "", ops: [] }; } } },
  // ขวาน 7 สี: by the wearer's colour: red +2 in its attacks · blue draws 1 · purple mills 1 and +1 · green ลูกฮึด
  "BT08-061": { worn: () => 0, hostAttack: (c) => { const { E, s, seat: p, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; if (!H) return { explain: "", ops: [] }; const co = E.colors(s, H.x); const ops = [], say = [];
      if (co.includes("แดง")) { ops.push({ op: "power", i: H.x.i, n: 2, temp: "fight" }); say.push("สีแดง: POWER +2"); } if (co.includes("ฟ้า")) { ops.push({ op: "draw", seat: p, n: 1 }); say.push("สีฟ้า: จั่ว 1 ใบ"); }
      if (co.includes("ม่วง")) { ops.push({ op: "mill", seat: p, n: 1 }, { op: "power", i: H.x.i, n: 1, temp: true }); say.push("สีม่วง: ธรณีสูบ 1 ใบ POWER +1"); } return { explain: say.join(" · ") || "ไม่มีผล", ops }; },
    aura: (E, s, src, L) => { const H = src.on != null ? E.locate(s, src.on) : null; return L.z === "mg" && H && E.colors(s, H.x).includes("เขียว") ? [{ seat: H.p, test: (x) => x.i === H.x.i, n: 0, kw: ["ลูกฮึด"] }] : []; } },
  // เนยถั่ว: only เต่า · its opponents in fights -1
  "BT08-062": { modOnly: (E, s, h) => E.named(s, h, "เต่า"), worn: () => 0, hostFight: (c) => { const f = c.t.foe != null ? c.E.locate(c.s, c.t.foe) : null; return f ? { explain: `${c.E.name(c.s, f.x)} POWER -1`, ops: [{ op: "power", i: f.x.i, n: -1, temp: "fight" }] } : { explain: "", ops: [] }; } },
  // บิฟร็อสต์ (Land): whenever cards are milled, one of our Avatars gets สามัคคี this turn · milled by a purple {เทพ} or a Magic: to the hand
  "BT08-063": { onMill: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => !E.kw(s, y, "สามัคคี")).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเราที่จะได้สามัคคี")[0]; return t ? { explain: `${E.name(s, t)} ได้รับสามัคคีจนจบเทิร์น`, ops: [{ op: "keyword", i: t.i, k: "สามัคคี", until: "turn" }] } : { explain: "", ops: [] }; },
    milled: (c) => (c.self && c.E.locate(c.s, c.self.i)?.z === "hell" ? { explain: "บิฟร็อสต์ ขึ้นมือ", ops: [{ op: "move", i: c.self.i, to: "hand" }] } : { explain: "", ops: [] }), millBy: "god" },
  // โรงเรียนเวทย์มนต์ (Land): each "คาถา" used puts a Magic from our hell face down in our Magic Zone · once per turn a จอมเวทย์ from the hand, face-down Magic paying 1 GEM each
  "BT08-064": { magicSeenOk: (E, s, y, Ly, d) => Ly.z === "land" && String(d.n || "").includes("คาถา") && s.P[Ly.p].hell.some((z) => E.def(s, z).t === "M"), magicSeen: (c) => { const { E, s, seat: p } = c; const t = [...s.P[p].hell].reverse().find((z) => E.def(s, z).t === "M"); return t ? { explain: "วาง Magic จากนรก 1 ใบคว่ำไว้ที่ Magic Zone", ops: [{ op: "faceDown", i: t.i }] } : { explain: "", ops: [] }; },
    activate: { label: "อัญเชิญจอมเวทย์จากมือ (Magic คว่ำใช้เป็น GEM ใบละ 1)", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.some((y) => isAv(E, s, y) && E.named(s, y, "จอมเวทย์")),
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && E.named(s, y, "จอมเวทย์")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกจอมเวทย์บนมือ", { exact: true })[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "fdPay", seat: p, i: t.i }] } : { explain: "", ops: [] }; } } },
  // โคกอีสานนูน (Land): once per turn with an อีสานสลิงเกอร์, 6 cards (2 Magic at most) from hell into the Deck: draw 1 · once per turn after 6+ such cards this turn: our อีสานสลิงเกอร์ and an opposing Avatar fight (no sleep, no React)
  "BT08-065": { activate: { multi: true, label: "โคกอีสานนูน: นำการ์ดจากนรกเข้า Deck / สั่งต่อสู้", can: (E, s, x, L) => L.z === "land" && x.o === L.p && s.phase === "main" && s.P[L.p].av.some((y) => isan(E, s, y)) && ((once(s, L.p, "โคก:1") && s.P[L.p].hell.filter((y) => E.def(s, y).t !== "M").length + Math.min(2, s.P[L.p].hell.filter((y) => E.def(s, y).t === "M").length) >= 6) || (once(s, L.p, "โคก:2") && s.back && s.back.t === s.turn && s.back.n[L.p] >= 6 && s.P[1 - L.p].av.length > 0)),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const a = once(s, p, "โคก:1") && P.hell.filter((y) => E.def(s, y).t !== "M").length + Math.min(2, P.hell.filter((y) => E.def(s, y).t === "M").length) >= 6; const b = once(s, p, "โคก:2") && s.back && s.back.t === s.turn && s.back.n[p] >= 6 && s.P[1 - p].av.length > 0;
      const m = a && b ? c.mode(["นำการ์ดในนรก 6 ใบเข้า Deck: จั่ว 1 ใบ", "สั่งอีสานสลิงเกอร์ต่อสู้กับ Avatar ฝ่ายตรงข้าม"], "โคกอีสานนูน", 1) : a ? 0 : 1;
      if (m === 0) { const av = P.hell.filter((y) => E.def(s, y).t !== "M"), mg = P.hell.filter((y) => E.def(s, y).t === "M").slice(0, 2); const six = [...mg, ...av].slice(0, 6); return { explain: "นำการ์ดในนรก 6 ใบกลับเข้า Deck แล้วสับ · จั่ว 1 ใบ", ops: [{ op: "nameOnce", seat: p, name: "โคก:1" }, ...six.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "shuffle", seat: p }, { op: "draw", seat: p, n: 1 }] }; }
      const me = c.choose(P.av.filter((y) => isan(E, s, y)).sort(strongFirst(E, s)), 1, "เลือกอีสานสลิงเกอร์ฝ่ายเรา", { exact: true })[0]; const foe = me ? c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a2, b2) => (E.power(s, a2) < E.power(s, me)) - (E.power(s, b2) < E.power(s, me)) || worth(E, s, a2) - worth(E, s, b2)).reverse(), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0] : null;
      return me && foe ? { explain: `${E.name(s, me)} ต่อสู้กับ ${E.name(s, foe)}`, ops: [{ op: "nameOnce", seat: p, name: "โคก:2" }, { op: "duel", a: me.i, b: foe.i }] } : { explain: "", ops: [] }; } } },
  // เรือรบโบราณ (Construct, up to 3 of this name): once per turn 1) scout 5: a POWER 2 or less พลเดินทัพ/ขุนพล {ต่างชาติ} to the hand or field · 2) a พลเดินทัพ from hell into the Deck
  "BT08-066": { multiCs: true, activate: { label: "เลือกปฏิบัติ: สอดแนม 5 ใบ หรือ นำพลเดินทัพจากนรกเข้า Deck", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && (s.P[L.p].deck.length > 0 || s.P[L.p].hell.some((y) => E.named(s, y, "พลเดินทัพ"))),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const fit = (y) => isAv(E, s, y) && sy(E, s, y, "ต่างชาติ") && (E.named(s, y, "พลเดินทัพ") || E.named(s, y, "ขุนพล")) && (E.def(s, y).pw || 0) <= 2; const back = P.hell.find((y) => E.named(s, y, "พลเดินทัพ"));
      const m = c.mode(["1) สอดแนม 5 ใบ", "2) นำพลเดินทัพจากนรกกลับเข้า Deck"], "เรือรบโบราณ", P.deck.slice(0, 5).some(fit) || !back ? 0 : 1);
      if (m === 1) return back ? { explain: `${E.name(s, back)} กลับเข้า Deck แล้วสับ`, ops: [{ op: "move", i: back.i, to: "deckBottom" }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] };
      const { top, t } = scoutPick(c, 5, fit, "เลือกพลเดินทัพหรือขุนพล POWER ไม่เกิน 2"); if (!top.length) return { explain: "", ops: [] }; const put = t && E.avatars(P) < 4;
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${put ? "อัญเชิญ" : ""} ${E.name(s, t)}${put ? "" : " ขึ้นมือ"}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [put ? { op: "put", i: t.i } : { op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [])] }; } } },
  // ยิมทมิฬ (Construct): every "บึงทมิฬ People" +1 and สามัคคี · cannot be attacked with วอเตอร์แมน on our Avatar Zone
  "BT08-068": { aura: (E, s, src, L) => (L.z === "cs" ? [0, 1].map((seat) => ({ seat, test: (x) => E.named(s, x, "บึงทมิฬ") && E.named(s, x, "People"), n: 1, kw: ["สามัคคี"] })) : []), noAtk: (E, s, x, L) => L.z === "cs" && s.P[L.p].av.some((y) => E.named(s, y, "วอเตอร์แมน")) },
  // บัลลังก์โอดิน (Construct): in our Battle Phase purple {เทพ} +1 (โอดิน +3) · once per turn destroy it: an "โอดิน" from hell to the hand · milled: built on our Construct Zone
  "BT08-069": { aura: (E, s, src, L) => (L.z === "cs" && s.phase === "battle" && s.active === L.p ? [{ seat: L.p, test: (x) => purpleGod(E, s, x) && !E.named(s, x, "โอดิน"), n: 1 }, { seat: L.p, test: (x) => isAv(E, s, x) && E.named(s, x, "โอดิน"), n: 3 }] : []),
    activate: { label: "ทำลายการ์ดใบนี้: โอดินจากนรกขึ้นมือ", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].hell.some((y) => E.named(s, y, "โอดิน")), run: (c) => { const { E, s, seat: p, self: x } = c; const t = [...s.P[p].hell].reverse().find((y) => E.named(s, y, "โอดิน")); return t ? { explain: `ทำลาย ${E.name(s, x)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "destroy", i: x.i, why: "บัลลังก์โอดิน" }, { op: "move", i: t.i, to: "hand" }] } : { explain: "", ops: [] }; } },
    milled: (c) => (c.self && c.E.locate(c.s, c.self.i)?.z === "hell" && c.s.P[c.seat].cs.length < 3 ? { explain: "ก่อสร้างบัลลังก์โอดินจากนรก", ops: [{ op: "move", i: c.self.i, to: "cs", seat: c.seat }] } : { explain: "", ops: [] }), millBy: "any" },
});

// ---------- BT09 ----------
const pemmu = (E, s, x) => isAv(E, s, x) && (E.named(s, x, "เพมมุ") || E.named(s, x, "สไปรท์"));
const cultBy = (E, s, x) => x.sb != null && !!s.cards[x.sb] && String(s.cards[x.sb].n || "").includes("พี่โปจิ");
const fruit = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ภูติผลไม้");
const forest = (E, s) => E.lands(s).some((l) => !l.mute && E.named(s, l, "ป่าพงไพร เผ่าพงศ์พันธุ์"));
const thorCap = (s, p) => 3 + Math.floor(s.P[p].hell.length / 10);
const giant = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "ยักษ์");
const thorSmash = (c, then) => { const { E, s, seat: p } = c; const cap = thorCap(s, p); const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) <= cap).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${cap}`)[0];
  return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [...(then || []), { op: "destroy", i: t.i, why: "ธอร์" }] } : null; };
const bestFoe = (E, s, p) => s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a));
Object.assign(SCRIPTS, {
  // พระอิศวร วีลแชร์: when our พระอิศวร is destroyed into our hell: summoned from the hand with base POWER half of a พระอิศวร in hell, then an opposing Avatar loses that much
  "BT09-001": { handDeathOk: (E, s, y, dead) => E.named(s, dead, "พระอิศวร") && dead.o === y.o && E.locate(s, dead.i)?.z === "hell" && E.avatars(s.P[y.o]) < 4,
    handDeath: (c) => { const { E, s, seat: p, self: x } = c; const god = [...s.P[p].hell].filter((y) => E.named(s, y, "พระอิศวร")).sort((a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0))[0]; const half = god ? Math.floor((E.def(s, god).pw || 0) / 2) : 0; const t = bestFoe(E, s, p)[0];
      return { explain: `อัญเชิญ ${E.name(s, x)} POWER ตั้งต้น ${half}${t && half ? ` · ${E.name(s, t)} POWER -${half}` : ""}`, ops: [{ op: "put", i: x.i, ov: { pw: half } }, ...(t && half ? [{ op: "power", i: t.i, n: -half, temp: false }] : [])] }; } },
  // เนอร์เกิ้ล เนียร์: other แห่หัว +1 (+2 when summoned by พี่โปจิ)
  "BT09-002": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => x.i !== src.i && E.named(s, x, "แห่หัว"), n: cultBy(E, s, src) ? 2 : 1 }] : []) },
  // นางฟ้าลูกซอง: from hell, exile it: one of our Avatars +2 this turn
  "BT09-003": { activate: { label: "เนรเทศใบนี้จากนรก: Avatar ฝ่ายเรา POWER +2", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.length > 0,
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `เนรเทศ ${E.name(s, x)} · ${E.name(s, t)} POWER +2`, ops: [{ op: "exile", i: x.i }, { op: "power", i: t.i, n: 2, temp: true }] } : { explain: "", ops: [] }; } } },
  // DJ ปีโป้: says sorry when our attack flips LIFE; if forgiven (ขอโทษสังคม) that LIFE does not work
  "BT09-004": { apology: true },
  // กัณหา นาคเกล็ดดำ: POWER 7+ at the start of the Battle Phase: after a fight win, a Cost 3 นาค from the Deck, its automatic ability on at once
  "BT09-005": { battleStart: bp7, win: (c) => { const { E, s, seat: p, self: x } = c; if (!x || x.bp !== s.turn || E.avatars(s.P[p]) >= 4) return { explain: "", ops: [] }; const t = s.P[p].deck.find((y) => naga(E, s, y) && (E.def(s, y).c || 0) === 3);
    return t ? { explain: `อัญเชิญ ${E.name(s, t)} และเปิดใช้ความสามารถอัตโนมัติทันที`, ops: [{ op: "put", i: t.i }, { op: "bpOn", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มีนาค Cost 3 ใน Deck", ops: [] }; } },
  // ลูเซีย โพลีกอน: once per turn a Cost ≤5 {เทพ}/{นรก}/"โพลิกอน" Avatar from the Deck shown, then placed on top
  "BT09-006": { activate: { label: "นำ Avatar เทพ/นรก/โพลิกอน จาก Deck ไปไว้บนสุด", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].deck.length > 1,
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 5 && !E.def(s, y).o1 && (sy(E, s, y, "เทพ") || sy(E, s, y, "นรก") || E.named(s, y, "โพลิกอน") || E.named(s, y, "โพลีกอน")))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar จาก Deck", { exact: true })[0];
      return t ? { explain: `แสดง ${E.name(s, t)} · สับ Deck แล้ววางไว้บนสุด`, ops: [{ op: "shuffle", seat: p }, { op: "move", i: t.i, to: "deckTop" }] } : { explain: "", ops: [] }; } } },
  // โฮคุ โพลีกอน: +1 with any other Avatar · [Link โซน่า] entering: destroy the opponent's strongest · only it can be attacked · counts as {สัตว์}
  "BT09-007": { linkAs: ["โซน่า"], extraSy: "สัตว์", taunt: () => true, aura: (E, s, src, L) => (L.z === "av" && [...s.P[0].av, ...s.P[1].av].some((y) => y.i !== src.i) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 1 }] : []),
    link: (c) => { const { E, s, seat: p } = c; const t = [...s.P[1 - p].av].filter((y) => !E.noAim(s, y)).sort(strongFirst(E, s))[0]; return t ? { explain: `ทำลาย ${E.name(s, t)} (POWER สูงสุด)`, ops: [{ op: "destroy", i: t.i, why: "โฮคุ โพลีกอน" }] } : { explain: "", ops: [] }; } },
  // เพมมุ ยอดมนุษย์: wears only อาวุธของเพมมุ, +2 while wearing one · once per turn (IKUZO AIBOU!) a weapon from the Deck worn (counts as the Modification)
  "BT09-008": { wearOnly: (E, s, m) => E.named(s, m, "อาวุธของเพมมุ"), aura: (E, s, src, L) => (L.z === "av" && [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === src.i) ? [{ seat: L.p, test: (x) => x.i === src.i, n: 2 }] : []),
    activate: { label: "IKUZO AIBOU: อาวุธของเพมมุจาก Deck มาสวมใส่", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !s.mu[L.p].D && s.P[L.p].deck.some((y) => E.named(s, y, "อาวุธของเพมมุ")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const w = s.P[p].deck.find((y) => E.named(s, y, "อาวุธของเพมมุ")); return w ? { explain: `"IKUZO AIBOU!" · ${E.name(s, w)} สวมใส่ให้การ์ดใบนี้`, ops: [{ op: "attach", i: w.i, on: x.i }, { op: "shuffle", seat: p }, { op: "useMod", seat: p }] } : { explain: "", ops: [] }; } } },
  // เมย์ แวมไพร์โกธิค: exiled from the hand when our เพมมุ/สไปรท์ fights (no เมย์ in our dark zone yet): our fighter +4 · [Link เจ้าหญิงรวงข้าว] base POWER 5
  "BT09-010": { handFightOk: (E, s, y, F) => pemmu(E, s, F) && !s.P[y.o].dark.some((z) => E.named(s, z, "เมย์ แวมไพร์โกธิค")),
    handFight: (c) => { const { E, s, self: x } = c; const F = c.t.fighter != null ? E.locate(s, c.t.fighter) : null; return x && F && F.z === "av" ? { explain: `เนรเทศ ${E.name(s, x)} จากมือ · ${E.name(s, F.x)} POWER +4 จนจบเทิร์น`, ops: [{ op: "exile", i: x.i }, { op: "power", i: F.x.i, n: 4, temp: true }] } : { explain: "", ops: [] }; }, aura: (E, s, src, L) => (L.z === "av" && src.lk ? [{ seat: L.p, test: (x) => x.i === src.i, n: 5 - (E.def(s, src).pw || 0) }] : []) },
  // เจ้าหญิงรวงข้าว: จุติ เมย์ from the dark zone or a เพมมุ weapon from hell into the Deck, draw 1 · our [Link] เพมมุ/สไปรท์/เมย์ +2 in our turn · protected while เมย์ is linked
  "BT09-011": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].dark.find((y) => E.named(s, y, "เมย์ แวมไพร์โกธิค")) || s.P[p].hell.find((y) => E.named(s, y, "อาวุธของเพมมุ")); return { explain: `${t ? `${E.name(s, t)} กลับเข้า Deck · ` : ""}จั่ว 1 ใบ`, ops: [...(t ? [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }] : []), { op: "draw", seat: p, n: 1 }] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.active === L.p ? [{ seat: L.p, test: (x) => x.lk && (pemmu(E, s, x) || E.named(s, x, "เมย์ แวมไพร์โกธิค")), n: 2 }] : []),
    noAtk: (E, s, x, L) => s.P[L.p].av.some((y) => y.lk && E.named(s, y, "เมย์ แวมไพร์โกธิค")), untargetable: (E, s, x, L) => s.P[L.p].av.some((y) => y.lk && E.named(s, y, "เมย์ แวมไพร์โกธิค")) && !!s.trig[0] && s.trig[0].seat !== L.p },
  // เพนกวินหิมะ เหลียง: sacrifice it: 2 POWER 2 ทหารหิมะ from the Deck (12+ in hell: ราชาหิมะ บิง and ราชินีหิมะ ชีหลิน instead) · 4 blue GEM for a ราชินีหิมะ · counts as ทหารหิมะ {ต่างชาติ}
  "BT09-015": { extraSy: "ต่างชาติ", gemFor: (td) => (td && String(td.n || "").includes("ราชินีหิมะ") ? 4 : null), activate: { label: "เซ่นไหว้ใบนี้: อัญเชิญทหารหิมะ 2 ใบจาก Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].deck.some((y) => snowMan(E, s, y)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const big = P.hell.filter((y) => snowMan(E, s, y)).length >= 12 && ["ราชาหิมะ บิง", "ราชินีหิมะ ชีหลิน"].map((n) => P.deck.find((y) => E.named(s, y, n)));
      const pair = big && big.every(Boolean) && c.mode(["อัญเชิญราชาหิมะและราชินีหิมะ", "อัญเชิญทหารหิมะ 2 ใบ"], "เพนกวินหิมะ", 0) === 0 ? big : P.deck.filter((y) => snowMan(E, s, y) && (E.def(s, y).pw || 0) === 2).slice(0, 2);
      return { explain: `เซ่นไหว้ ${E.name(s, x)} · อัญเชิญ ${pair.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [{ op: "destroy", i: x.i, why: "เซ่นไหว้" }, ...pair.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; } } },
  // รัททาทุย นินจา: when our {รัททาทุย} or นินจา leaves the field: summoned from the hand by discarding exactly 3 GEM
  "BT09-016": { handDeathOk: (E, s, y, dead) => (sy(E, s, dead, "รัททาทุย") || E.named(s, dead, "นินจา")) && E.avatars(s.P[y.o]) < 4 && !!gem3(E, s, y.o, y),
    handDeath: (c) => { const { E, s, seat: p, self: x } = c; const pay = gem3(E, s, p, x); return pay ? { explain: `ทิ้ง ${pay.length} ใบ (GEM 3) · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "put", i: x.i }] } : { explain: "", ops: [] }; } },
  // พี่โปจิ: once per turn exile an Avatar / Magic / Construct from the Deck: เนอร์เกิ้ล / แมวดำ / ปอนด์ from the Deck
  "BT09-017": { activate: { label: "เนรเทศการ์ดจาก Deck: อัญเชิญสมาชิกลัทธิแห่หัว", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.avatars(s.P[L.p]) < 4,
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const opts = [["A", "เนอร์เกิ้ล"], ["M", "แมวดำ สมาชิกลัทธิแห่หัว"], ["C", "ปอนด์ สมาชิกลัทธิแห่หัว"]].filter(([t, n]) => P.deck.some((y) => E.named(s, y, n)) && P.deck.some((y) => E.def(s, y).t === t && !E.named(s, y, n)));
      if (!opts.length) return { explain: "ไม่มีการ์ดที่ตรงเงื่อนไข", ops: [] }; const [t, n] = opts[c.mode(opts.map(([, n2]) => `อัญเชิญ ${n2}`), "พี่โปจิ: เลือกปฏิบัติ", 0)]; const ex = P.deck.filter((y) => E.def(s, y).t === t && !E.named(s, y, n)).sort(cheapCard(E, s))[0]; const m = P.deck.find((y) => E.named(s, y, n));
      return { explain: `เนรเทศ ${E.name(s, ex)} · อัญเชิญ ${E.name(s, m)}`, ops: [{ op: "exile", i: ex.i }, { op: "put", i: m.i }, { op: "shuffle", seat: p }] }; } } },
  // หมาป่าเดียวดาย: จุติ {สัตว์} Avatars from the Deck with total Cost 5 or less · attacking: +1 per other {สัตว์} of ours
  "BT09-019": { summon: (c) => { const { E, s, seat: p } = c; let left = 5, room = freeAv(E, s, p); const got = []; for (const y of [...s.P[p].deck].filter((z) => isAv(E, s, z) && sy(E, s, z, "สัตว์")).sort((a, b) => worth(E, s, b) - worth(E, s, a))) { const k = E.def(s, y).c || 0; if (room > 0 && k <= left) { got.push(y); left -= k; room--; } }
      return { explain: `อัญเชิญ ${got.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [...got.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; },
    attack: (c) => { const { E, s, seat: p, self: x } = c; const n = s.P[p].av.filter((y) => y.i !== x.i && sy(E, s, y, "สัตว์")).length; return { explain: `POWER +${n}`, ops: n ? [{ op: "power", i: x.i, n, temp: true }] : [] }; } },
  // กัล มนุษย์ดาว R18: from the hand, up to 2 servants of ours to hell: summoned with จุติ, base POWER +3 each · จุติ a weaker opposing Avatar becomes our servant
  "BT09-020": { activate: { label: "ส่งข้ารับใช้สูงสุด 2 ใบลงนรก: อัญเชิญใบนี้แบบจุติ", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4,
      run: (c) => { const { E, s, seat: p, self: x } = c; const sv = s.P[p].mg.filter((m) => m.srv && m.on == null).slice(0, 2); return { explain: `ส่งข้ารับใช้ ${sv.length} ใบลงนรก · อัญเชิญ ${E.name(s, x)} POWER ตั้งต้น ${1 + sv.length * 3}`, ops: [...sv.map((m) => ({ op: "move", i: m.i, to: "hell" })), { op: "put", i: x.i, jt: true, ov: { pw: 1 + sv.length * 3 } }] }; } },
    summon: (c) => { const { E, s, seat: p, self: x } = c; const t = x && c.choose(bestFoe(E, s, p).filter((y) => E.power(s, y) < E.power(s, x)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่ POWER น้อยกว่า")[0]; return t ? { explain: `${E.name(s, t)} กลายเป็นข้ารับใช้`, ops: [{ op: "enslave", i: t.i, seat: p }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // คราเค่น: once per turn discard 1: an opposing POWER 8+ Avatar to the opponent's Magic Zone
  "BT09-021": { activate: { label: "ทิ้ง 1 ใบ: ส่ง Avatar ฝ่ายตรงข้าม POWER 8+ ไป Magic Zone ฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[1 - L.p].av.some((y) => E.power(s, y) >= 8 && !E.noAim(s, y)),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(bestFoe(E, s, p).filter((y) => E.power(s, y) >= 8), 1, "เลือก Avatar POWER 8 ขึ้นไป", { exact: true })[0]; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ไป Magic Zone ฝ่ายตรงข้าม`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "mg", seat: 1 - p }, { op: "flagSet", i: t.i, k: "kraken", v: true }] } : { explain: "", ops: [] }; } } },
  // โซน่า โพลีกอน: จุติ scout 3: a {ไซเบอร์} or {ปลา} Cost ≤5 summoned (โฮคุ: draw 1) · [partner โฮคุ] once per turn go to sleep: draw 1 · counts as {ปลา}
  "BT09-022": { extraSy: "ปลา", summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 3, (y) => isAv(E, s, y) && (sy(E, s, y, "ไซเบอร์") || sy(E, s, y, "ปลา")) && (E.def(s, y).c || 0) <= 5, "เลือก Avatar ไซเบอร์หรือปลา"); if (!top.length) return { explain: "", ops: [] }; const put = t && E.avatars(s.P[p]) < 4; const hoku = put && E.named(s, t, "โฮคุ");
      return { explain: `สอดแนม ${top.length} ใบ${put ? ` · อัญเชิญ ${E.name(s, t)}` : ""}${hoku ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(put ? [{ op: "put", i: t.i }] : []), { op: "shuffle", seat: p }, ...(hoku ? [{ op: "draw", seat: p, n: 1 }] : [])] }; },
    activate: { label: "เปลี่ยนเป็นสภาพนอน: จั่ว 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && x.a && s.P[L.p].av.some((y) => E.named(s, y, "โฮคุ")), run: (c) => ({ explain: "เปลี่ยนเป็นสภาพนอน · จั่ว 1 ใบ", ops: [{ op: "wake", i: c.self.i, v: false }, { op: "draw", seat: c.seat, n: 1 }] }) } },
  // ธอร์: after a fight win: destroy an opposing Avatar of Cost ≤ 3 (+1 per 10 cards in our hell); otherwise flip their top LIFE
  "BT09-024": { kill: (c) => thorSmash(c) || { explain: "ไม่มีเป้าหมาย · หงาย LIFE ฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] } },
  // โลกิ: cannot attack, สามัคคี only for ธอร์ · once per turn +1 (+1 per 5 cards in our hell) this turn
  "BT09-025": { noAttack: () => true, helpOnly: (E, s, att) => E.named(s, att, "ธอร์"), activate: { label: "POWER +1 (+1 ต่อการ์ดในนรกทุก 5 ใบ)", can: (E, s, x, L) => L.z === "av" && s.phase === "main", run: (c) => { const n = 1 + Math.floor(c.s.P[c.seat].hell.length / 5); return { explain: `POWER +${n} จนจบเทิร์น`, ops: [{ op: "power", i: c.self.i, n, temp: true }] }; } } },
  // แมวดำ: once per turn the opponent mills 1 (summoned by พี่โปจิ: exile the bottom card of their hell instead)
  "BT09-026": { activate: { label: "ฝ่ายตรงข้ามธรณีสูบ 1 ใบ (หรือเนรเทศการ์ดล่างสุดในนรกฝ่ายตรงข้าม)", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && (cultBy(E, s, x) ? s.P[1 - L.p].hell.length > 0 : s.P[1 - L.p].deck.length > 0),
    run: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[1 - p].hell[0]; return cultBy(E, s, x) ? { explain: `เนรเทศ ${h ? E.name(s, h) : "-"}`, ops: h ? [{ op: "exile", i: h.i }] : [] } : { explain: "ฝ่ายตรงข้ามธรณีสูบ 1 ใบ", ops: [{ op: "mill", seat: 1 - p, n: 1 }] }; } } },
  // แบงค์ ตัวแดง: red Avatars cannot attack it · [partner สตางค์] attacking a red Avatar sends it to hell
  "BT09-028": { noAtkBy: (E, s, x, att) => E.colors(s, att).includes("แดง"), attackOk: (E, s) => { const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return !!T && E.colors(s, T.x).includes("แดง"); },
    attack: (c) => { const { E, s, seat: p } = c; const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; return T && E.colors(s, T.x).includes("แดง") && s.P[p].av.some((y) => E.named(s, y, "สตางค์")) ? { explain: `${E.name(s, T.x)} ลงนรก`, ops: [{ op: "move", i: T.x.i, to: "hell" }] } : { explain: "", ops: [] }; } },
  // สตางค์น้องชายแบงค์: green Avatars cannot attack it
  "BT09-029": { noAtkBy: (E, s, x, att) => E.colors(s, att).includes("เขียว") },
  // ลาพิเน่ โพลีกอน (in hell): when our ability discards from the hand, exile it and mill 3: draw 1, a "โพลิกอน" among them to the hand (ลูเซเน่ may be summoned)
  "BT09-030": { extraSy: "สัตว์วิเศษ", onDiscard: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hell") return { explain: "", ops: [] }; const top = s.P[p].deck.slice(0, 3); const pg = top.find((y) => E.named(s, y, "โพลิกอน") || E.named(s, y, "โพลีกอน"));
    const lu = pg && E.named(s, pg, "ลูเซเน่") && E.avatars(s.P[p]) < 4; return { explain: `เนรเทศ ${E.name(s, x)} · ธรณีสูบ 3 ใบ · จั่ว 1 ใบ${pg ? ` · ${E.name(s, pg)} ${lu ? "ถูกอัญเชิญ" : "ขึ้นมือ"}` : ""}`, ops: [{ op: "used", i: x.i }, { op: "exile", i: x.i }, { op: "mill", seat: p, n: 3 }, { op: "draw", seat: p, n: 1 }, ...(pg ? [lu ? { op: "put", i: pg.i } : { op: "move", i: pg.i, to: "hand" }] : [])] }; } },
  // ลูเซเน่ โพลีกอน: once per turn discard 1: exile a Magic in hell and use its ability · +1 with another จอมเวทย์ (+2 with another โพลิกอน)
  "BT09-031": { activate: { label: "ทิ้ง 1 ใบ: เนรเทศ Magic ในนรกแล้วใช้ความสามารถนั้น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => E.def(s, y).t === "M" && !E.def(s, y).o1),
      run: (c) => { const { E, s, seat: p } = c; const m = c.choose([...s.P[p].hell].filter((y) => E.def(s, y).t === "M" && !E.def(s, y).o1 && E.def(s, y).st === "N"), 1, "เลือก Magic ในนรก", { exact: true })[0]; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        return m && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ใช้ความสามารถของ ${E.name(s, m)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "exile", i: m.i }, { op: "castFrom", i: m.i }] } : { explain: "", ops: [] }; } },
    aura: (E, s, src, L) => { if (L.z !== "av") return []; const others = s.P[L.p].av.filter((y) => y.i !== src.i); const n = others.some((y) => E.named(s, y, "โพลิกอน") || E.named(s, y, "โพลีกอน")) ? 2 : others.some((y) => wizard(E, s, y)) ? 1 : 0; return n ? [{ seat: L.p, test: (x) => x.i === src.i, n }] : []; } },
  // วินดิโก้: summoned only by its own ability: from the hand when the opponent summons their 3rd Avatar this turn · then all their Avatars but one (their choice) go to hell
  "BT09-032": { noHand: true, oppThird: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hand" || E.avatars(s.P[p]) >= 4) return { explain: "", ops: [] }; const keep = [...s.P[1 - p].av].sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
    return { explain: `อัญเชิญ ${E.name(s, x)} · ฝ่ายตรงข้ามเก็บไว้แค่ ${keep ? E.name(s, keep) : "-"}`, ops: [{ op: "put", i: x.i }, ...s.P[1 - p].av.filter((y) => y !== keep).map((y) => ({ op: "move", i: y.i, to: "hell" }))] }; } },
  // สกินวอคเกอร์ (พอดี): once per turn copy an opposing Avatar's name, Cost, GEM, Symbol and POWER this turn
  "BT09-033": { activate: { label: "คัดลอกชื่อ Cost GEM Symbol POWER ของ Avatar ฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !!x.px && s.P[1 - L.p].av.length > 0,
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose([...s.P[1 - p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0]; return t ? { explain: `คัดลอก ${E.name(s, t)} จนจบเทิร์น`, ops: [{ op: "copyStats", i: x.i, from: t.i }, { op: "atEnd", turn: s.turn, ops: [{ op: "clearOv", i: x.i }] }] } : { explain: "", ops: [] }; } } },
  // ปอนด์: once per turn exile a card in our hell: a แห่หัว gets ลูกฮึด and โล่มนุษย์ (summoned by พี่โปจิ: also no opposing Magic) until the opponent's turn ends
  "BT09-034": { activate: { label: "เนรเทศการ์ดในนรก: แห่หัว ได้รับลูกฮึดและโล่มนุษย์", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.length > 0 && s.P[L.p].av.some((y) => E.named(s, y, "แห่หัว")),
    run: (c) => { const { E, s, seat: p, self: x } = c; const h = [...s.P[p].hell].sort(cheapCard(E, s))[0]; const t = c.choose(s.P[p].av.filter((y) => E.named(s, y, "แห่หัว")).sort(strongFirst(E, s)), 1, "เลือก Avatar แห่หัว", { exact: true })[0];
      return h && t ? { explain: `เนรเทศ ${E.name(s, h)} · ${E.name(s, t)} ได้รับลูกฮึดและโล่มนุษย์`, ops: [{ op: "exile", i: h.i }, { op: "keyword", i: t.i, k: "ลูกฮึด", until: "oppturn" }, { op: "keyword", i: t.i, k: "โล่มนุษย์", until: "oppturn" }, ...(cultBy(E, s, x) ? [{ op: "mprot", i: t.i, until: s.turn + 1, all: true }] : [])] } : { explain: "", ops: [] }; } } },
  // เนฟิล: the only Avatar on our Avatar Zone · loses the POWER of each Avatar it fights · destroyed at POWER 0 · คำสั่งเสีย our LIFE flips · wears nothing
  "BT09-035": { noMod: true, fightEnd: (E, s, x, foe, L) => { const n = E.power(s, foe); if (n > 0) { x.pm = (x.pm || 0) - n; E.log(s, L.p, `${E.name(s, x)} POWER -${n} (หลังจบการต่อสู้)`); } },
    check: (E, s, x, L) => (L.z !== "av" ? [] : [...s.P[L.p].av.filter((y) => y.i !== x.i).map((y) => ({ op: "move", i: y.i, to: "hell" })), ...(E.power(s, x) === 0 ? [{ op: "destroy", i: x.i, why: "POWER 0" }] : [])]), death: (c) => ({ explain: "หงาย LIFE ฝ่ายเรา 1 ใบ", ops: [{ op: "lifeFlip", seat: c.seat }] }) },
  // ภูติผลไม้ (with ป่าพงไพร เผ่าพงศ์พันธุ์): มะม่วง โล่มนุษย์ · มะเหมี่ยว คำสั่งเสีย another ภูติผลไม้ from the hand, draw 1 · มะเฟือง เตะไข่ while they have face-down LIFE · มะขาม จุติ fetches the Land
  "BT09-036": { aura: (E, s, src, L) => (L.z === "av" && forest(E, s) ? kwAura(L, src, "โล่มนุษย์") : []) },
  "BT09-037": { death: (c) => { const { E, s, seat: p } = c; if (!forest(E, s)) return { explain: "ไม่มีป่าพงไพร", ops: [] }; const t = s.P[p].hand.find((y) => fruit(E, s, y) && !E.named(s, y, "มะเหมี่ยว")); return { explain: `${t ? `อัญเชิญ ${E.name(s, t)} · ` : ""}จั่ว 1 ใบ`, ops: [...(t && E.avatars(s.P[p]) < 4 ? [{ op: "put", i: t.i }] : []), { op: "draw", seat: p, n: 1 }] }; } },
  "BT09-038": { aura: (E, s, src, L) => (L.z === "av" && forest(E, s) && s.P[1 - L.p].life.some((y) => !y.up) ? kwAura(L, src, "เตะไข่") : []) },
  "BT09-039": { summon: (c) => { const { E, s, seat: p } = c; const h = s.P[p].hell.find((y) => E.named(s, y, "ป่าพงไพร เผ่าพงศ์พันธุ์")); const d = h ? null : s.P[p].deck.find((y) => E.named(s, y, "ป่าพงไพร เผ่าพงศ์พันธุ์"));
    return h ? { explain: "ป่าพงไพร จากนรกขึ้นมือ", ops: [{ op: "move", i: h.i, to: "hand" }] } : d ? { explain: "ป่าพงไพร จาก Deck ขึ้นมือ", ops: [{ op: "search", seat: p, take: d.i, to: "hand" }] } : { explain: "ไม่มีป่าพงไพร", ops: [] }; } },
  // จ่ายุทธ ทหารรักชาติ: attacking a {ต่างชาติ} destroys it
  "BT09-040": destroyAtTarget("ต่างชาติ"),
  // ท้าวเวสสุวรรณ: when our {ยักษ์} is destroyed by an opposing card: summoned from the hand, may destroy an opposing card · our {ยักษ์} +2 in the Battle Phase
  "BT09-041": { handDeathOk: (E, s, y, dead, fromOpp) => fromOpp && sy(E, s, dead, "ยักษ์") && E.avatars(s.P[y.o]) < 4, handDeath: (c) => { const { E, s, seat: p, self: x } = c; const O = s.P[1 - p]; const t = [...O.av.filter((y) => !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...O.cs][0];
      return { explain: `อัญเชิญ ${E.name(s, x)}${t ? ` · ทำลาย ${E.name(s, t)}` : ""}`, ops: [{ op: "put", i: x.i }, ...(t ? [{ op: "destroy", i: t.i, why: "ท้าวเวสสุวรรณ" }] : [])] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.phase === "battle" ? [{ seat: L.p, test: (x) => giant(E, s, x), n: 2 }] : []) },
  // ตัวอะไรสักอย่าง: flavour text only
  "BT09-046": { vanilla: true },
  // ขอโทษสังคม: this turn DJ ปีโป้'s apologies are always accepted · pays only for DJ ปีโป้
  "BT09-049": { payOnly: (td) => !!td && String(td.n || "").includes("DJ ปีโป้"), cast: (c) => ({ explain: "เทิร์นนี้การขอโทษของ DJ ปีโป้ ได้รับการยกโทษ", ops: [{ op: "sorry", seat: c.seat }] }) },
  // บลัดดี้แมรี่: stays on the Magic Zone · once per turn roll 2 dice; both even: exile a วิญญาณร้าย from hell · 3 of them in the dark zone this way: we win
  "BT09-050": { stay: true, cast: () => ({ explain: "บลัดดี้แมรี่ วางอยู่บน Magic Zone", ops: [] }), activate: { label: "ทอยลูกเต๋า 2 ครั้ง (คู่ทั้งคู่: เนรเทศวิญญาณร้าย)", can: (E, s, x, L) => L.z === "mg" && s.phase === "main" && s.P[L.p].hell.some((y) => E.named(s, y, "วิญญาณร้าย")), run: (c) => ({ explain: "ทอยลูกเต๋า 2 ครั้ง", ops: [{ op: "bloody", seat: c.seat }] }) } },
  // ไม้กวาดปีกปักษา: destroy every face-up card in the opponent's Magic Zone, draw 1 per 2
  "BT09-051": { cast: (c) => { const { E, s, seat: p } = c; const ts = s.P[1 - p].mg.filter((m) => !m.fd); const n = Math.floor(ts.length / 2); return { explain: `ทำลาย ${ts.length} ใบ${n ? ` · จั่ว ${n} ใบ` : ""}`, ops: [...ts.map((m) => ({ op: "destroy", i: m.i, why: "ไม้กวาดปีกปักษา" })), ...(n ? [{ op: "draw", seat: p, n }] : [])] }; } },
  // ผจญภัยด้วยกัน: with เพมมุ a สไปรท์ from the Deck, or with สไปรท์ a เพมมุ
  "BT09-052": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const a = P.av.some((y) => E.named(s, y, "เพมมุ")) && P.deck.find((y) => isAv(E, s, y) && E.named(s, y, "สไปรท์")); const b = P.av.some((y) => E.named(s, y, "สไปรท์")) && P.deck.find((y) => isAv(E, s, y) && E.named(s, y, "เพมมุ"));
    const t = a && b ? [a, b][c.mode(["อัญเชิญสไปรท์", "อัญเชิญเพมมุ"], "ผจญภัยด้วยกัน", 0)] : a || b; return t && E.avatars(P) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่ตรงเงื่อนไข", ops: [] }; } },
  // แผนการตู้เย็นทับ: one of our Constructs: destroy an opposing Avatar of POWER ≤ its POWER
  "BT09-054": { canCast: (E, s, p) => s.P[p].cs.length > 0, cast: (c) => { const { E, s, seat: p } = c; const k = c.choose([...s.P[p].cs].sort(strongFirst(E, s)), 1, "เลือก Construct ฝ่ายเรา", { exact: true })[0]; const t = k && c.choose(bestFoe(E, s, p).filter((y) => E.power(s, y) <= E.power(s, k)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
    return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "แผนการตู้เย็นทับ" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // คาถา เสกควายเข้าท้อง: with a จอมเวทย์: destroy opposing Avatars with total POWER 4 or less
  "BT09-055": { canCast: (E, s, p) => s.P[p].av.some((y) => wizard(E, s, y)), cast: (c) => { const { E, s, seat: p } = c; let left = 4; const got = []; for (const y of bestFoe(E, s, p)) { const k = E.power(s, y); if (k <= left) { got.push(y); left -= k; } }
    return { explain: got.length ? `ทำลาย ${got.map((y) => E.name(s, y)).join(", ")}` : "ไม่มีเป้าหมาย", ops: got.map((y) => ({ op: "destroy", i: y.i, why: "คาถา เสกควายเข้าท้อง" })) }; } },
  // ไต้ฝุ่น: destroy a card in the opponent's Magic Zone, or the Land · also as a React in the opponent's turn or our Battle Phase
  "BT09-057": { asReact: () => true, asReactBattle: true, cast: (c) => { const { E, s, seat: p } = c; const mg = [...s.P[1 - p].mg].sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; const land = E.lands(s).find((l) => l.o !== p) || null;
    const m = mg && land ? c.mode(["1) ทำลายการ์ดใน Magic Zone ฝ่ายตรงข้าม", "2) ทำลายการ์ดบน Land Magic Zone"], "ไต้ฝุ่น", 0) : mg ? 0 : 1; const t = m === 0 ? mg : land || E.lands(s)[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ไต้ฝุ่น" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // Ah-ah, ah!: mill 5: with ธอร์ a โลกิ from hell, or with โลกิ a ธอร์
  "BT09-058": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const hasT = P.av.some((y) => E.named(s, y, "ธอร์")), hasL = P.av.some((y) => E.named(s, y, "โลกิ")); const pick = (n) => [...P.deck.slice(0, 5), ...P.hell].find((y) => isAv(E, s, y) && E.named(s, y, n));
    const t = hasT ? pick("โลกิ") : hasL ? pick("ธอร์") : null; return { explain: `ธรณีสูบ 5 ใบ${t ? ` · อัญเชิญ ${E.name(s, t)} จากนรก` : ""}`, ops: [{ op: "mill", seat: p, n: 5 }, ...(t && E.avatars(P) < 4 ? [{ op: "put", i: t.i }] : [])] }; } },
  // ทะลุบ้านทะลุโกศ (React): our POWER 8+ Avatar in this fight: if it wins, their top LIFE flips
  "BT09-061": { react: { kinds: ["attack"], can: (E, s, p, on) => [on.att, on.ti].some((i) => { const L = i != null ? E.locate(s, i) : null; return !!L && L.p === p && L.z === "av" && E.power(s, L.x) >= 8; }), botV: (E, s, q, on) => { const A = E.locate(s, on.att), T = on.ti != null ? E.locate(s, on.ti) : null; if (!A || !T) return -9; const mine = A.p === q ? A : T, foe = A.p === q ? T : A; return E.power(s, mine.x) > E.power(s, foe.x) + (A.p !== q ? (s.pend && s.pend.bonus) || 0 : 0) ? 7 : -9; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const L = [on.att, on.ti].map((i) => (i != null ? E.locate(s, i) : null)).find((l) => l && l.p === p && E.power(s, l.x) >= 8); return L ? { explain: `ถ้า ${E.name(s, L.x)} ชนะการต่อสู้ หงาย LIFE ฝ่ายตรงข้าม 1 ใบ`, ops: [{ op: "flagSet", i: L.x.i, k: "tlb" }] } : { explain: "", ops: [] }; } },
  // ตัดเน็ต (React, start of a Battle Phase): every Avatar loses all abilities this turn
  "BT09-062": { react: { kinds: ["battle"], botV: (E, s, q) => (s.P[1 - q].av.length > s.P[q].av.length ? 1 : -9) }, cast: (c) => ({ explain: "Avatar ทุกใบสูญเสียความสามารถจนจบเทิร์น", ops: [...c.s.P[0].av, ...c.s.P[1].av].map((y) => ({ op: "mute", i: y.i })) }) },
  // ลงกาโพรเทคชั่น (React): our fighting {ยักษ์} gets the POWER of another awake {ยักษ์} of ours, which goes to sleep
  "BT09-063": { react: { kinds: ["attack"], can: (E, s, p, on) => { const F = [on.att, on.ti].map((i) => (i != null ? E.locate(s, i) : null)).find((l) => l && l.p === p && giant(E, s, l.x)); return !!F && s.P[p].av.some((y) => y.a && y.i !== F.x.i && giant(E, s, y)); }, botV: () => 3 },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const F = [on.att, on.ti].map((i) => (i != null ? E.locate(s, i) : null)).find((l) => l && l.p === p && giant(E, s, l.x)); const h = F && s.P[p].av.filter((y) => y.a && y.i !== F.x.i && giant(E, s, y)).sort(strongFirst(E, s))[0];
      return h ? { explain: `${E.name(s, h)} นอน · ${E.name(s, F.x)} POWER +${E.power(s, h)}`, ops: [{ op: "wake", i: h.i, v: false }, { op: "power", i: F.x.i, n: E.power(s, h), temp: "fight" }] } : { explain: "", ops: [] }; } },
  // ค้อนโยเนียร์: only ธอร์ · +1 · from hell (once a turn) when ธอร์ or โลกิ enters Link: under the Deck, destroy an opposing Avatar of Cost ≤ 3 (+1 per 10 in hell)
  "BT09-064": { modOnly: (E, s, h) => E.named(s, h, "ธอร์"), worn: () => 1, linkFromHellOk: (E, s, y, x) => (E.named(s, x, "ธอร์") || E.named(s, x, "โลกิ")) && once(s, y.o, "ค้อนโยเนียร์"),
    linkFromHell: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hell" || !once(s, p, "ค้อนโยเนียร์")) return { explain: "", ops: [] }; const r = thorSmash(c, [{ op: "nameOnce", seat: p, name: "ค้อนโยเนียร์" }, { op: "move", i: x.i, to: "deckBottom" }]); return r || { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
  // กระสอบ: the wearer cannot attack · goes to hell at the 4th End Phase after it was used
  "BT09-065": { worn: () => 0, hostNoAttack: true, cast: (c) => ({ explain: "", ops: [{ op: "flagSet", i: c.t.i, k: "st0" }] }), endPhase: (E, s, x, L) => (L.z === "mg" && x.st0 != null && s.turn - x.st0 >= 3 ? [{ op: "move", i: x.i, to: "hell" }] : []) },
  // กระบองตำรวจ: only ตำรวจ · after the wearer wins a fight: a card from the opponent's hell on top of their Deck
  "BT09-068": { modOnly: (E, s, h) => E.named(s, h, "ตำรวจ"), worn: () => 0, hostWin: (c) => { const { E, s, seat: p } = c; const t = [...s.P[1 - p].hell].sort((a, b) => worth(E, s, a) - worth(E, s, b))[0]; return t ? { explain: `${E.name(s, t)} ไปไว้บนสุดของ Deck ฝ่ายตรงข้าม`, ops: [{ op: "move", i: t.i, to: "deckTop" }] } : { explain: "", ops: [] }; } },
  // ด่านตรวจเข้าเมือง (Land): two summons per turn each
  "BT09-069": { summonCap: 2 },
  // สวนกล้วยหนีภาษี (Land): nobody can use Land Magic · goes to hell at the 4th End Phase
  "BT09-070": { noLand: true, endPhase: (E, s, x, L) => (L.z === "land" && x.t0 != null && s.turn - x.t0 >= 3 ? [{ op: "move", i: x.i, to: "hell" }] : []) },
  // ป่าพงไพร เผ่าพงศ์พันธุ์ (Land): ภูติผลไม้ +2 and สามัคคี · once per turn exile our top card: a ภูติผลไม้ from hell (คำสั่งเสีย: exile it)
  "BT09-071": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].map((seat) => ({ seat, test: (x) => fruit(E, s, x), n: 2, kw: ["สามัคคี"] })) : []),
    activate: { label: "เนรเทศการ์ดบนสุดของ Deck: อัญเชิญภูติผลไม้จากนรก", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].deck.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hell.some((y) => fruit(E, s, y)),
      run: (c) => { const { E, s, seat: p } = c; const t = [...s.P[p].hell].filter((y) => fruit(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `เนรเทศการ์ดบนสุด · อัญเชิญ ${E.name(s, t)} (คำสั่งเสีย: เนรเทศ)`, ops: [{ op: "exile", i: s.P[p].deck[0].i }, { op: "put", i: t.i, exd: true }] } : { explain: "", ops: [] }; } } },
  // โพเดียมสมาคมผู้รู้ความจริง (Construct): once per turn with a ผู้รู้ความจริง: swap a hand card with the top of our Deck
  "BT09-072": { activate: { label: "สลับการ์ดบนมือ 1 ใบกับการ์ดบนสุดของ Deck", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.length > 0 && s.P[L.p].av.some((y) => E.named(s, y, "ผู้รู้ความจริง")),
    run: (c) => { const { E, s, seat: p } = c; const h = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "เลือกการ์ดบนมือ", { exact: true })[0]; const top = s.P[p].deck[0]; return h && top ? { explain: `สลับ ${E.name(s, h)} กับการ์ดบนสุดของ Deck`, ops: [{ op: "move", i: top.i, to: "hand" }, { op: "move", i: h.i, to: "deckTop" }] } : { explain: "", ops: [] }; } } },
  // สำนักภฤคุ (Construct): whenever a {ฤษี} Magic is used, draw 1
  "BT09-073": { magicSeenOk: (E, s, y, Ly, d) => Ly.z === "cs" && String(d.sy || "").includes("ฤษี"), magicSeen: (c) => ({ explain: "มีการใช้ Magic {ฤษี}: จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // ตู้เสื้อผ้าของริกกี้ (Construct): once per turn our ริกกี้ wins a fight: หนังมนุษย์ ชุดแก้แค้น from hell into the Deck
  "BT09-074": { allyKillOk: (E, s, y, w) => ricky(E, s, w) && once(s, y.o, "ตู้เสื้อผ้า") && s.P[y.o].hell.some((z) => E.named(s, z, "หนังมนุษย์ ชุดแก้แค้น")),
    allyKill: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.find((z) => E.named(s, z, "หนังมนุษย์ ชุดแก้แค้น")); return t && once(s, p, "ตู้เสื้อผ้า") ? { explain: `${E.name(s, t)} กลับเข้า Deck แล้วสับ`, ops: [{ op: "nameOnce", seat: p, name: "ตู้เสื้อผ้า" }, { op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } },
  // ห้างโรงเกลือ (Construct): opposing Avatars Cost -1
  "BT09-075": { costAura: (E, s, y, Ly, x, L) => (Ly.z === "cs" && L && L.z === "av" && L.p !== Ly.p ? -1 : 0) },
});

// ---------- BT10 ----------
const ninja = (E, s, x) => isAv(E, s, x) && E.named(s, x, "นินจา");
const mango = (E, s, x) => isAv(E, s, x) && E.named(s, x, "มะม่วง") && sy(E, s, x, "ต้นไม้");
const gang = (E, s, x) => isAv(E, s, x) && E.named(s, x, "แก๊งขยะ");
const sewer = (E, s, x) => isAv(E, s, x) && E.named(s, x, "สิ่งปฏิกูล");
const isTree = (E, s, y) => String(E.def(s, y).n || "").trim() === "ต้นมะม่วง";
const mangoTree = (E, s, p) => s.P[p].mg.filter((m) => m.on == null && isTree(E, s, m)).length;
const mangoDeath = (c) => { const { E, s, self: x } = c; const src = c.t.src != null ? s.cards[c.t.src] : null; return x && (c.t.z == null || c.t.z === "av") && E.locate(s, x.i)?.z === "hell" && (c.t.fromOpp || (src && String(src.n || "").includes("มะม่วง"))) ? { explain: `${E.name(s, x)} ไปวางไว้บน Magic Zone`, ops: [{ op: "move", i: x.i, to: "mg", seat: c.seat }] } : { explain: "", ops: [] }; };
const ninjaSwap = (name, n, onlyBattle) => ({ label: `นำนินจา ${n} ใบกลับขึ้นมือ: อัญเชิญใบนี้`, battle: !!onlyBattle, can: (E, s, x, L) => L.z === "hand" && (s.phase === "main" || (onlyBattle && s.phase === "battle" && facedUp(s, L.p) >= 3)) && once(s, L.p, name) && s.P[L.p].av.filter((y) => ninja(E, s, y) && !E.named(s, y, name)).length >= n,
  run: (c) => { const { E, s, seat: p, self: x } = c; const back = c.choose(s.P[p].av.filter((y) => ninja(E, s, y) && !E.named(s, y, name)).sort(cheapCard(E, s)), n, `เลือกนินจา ${n} ใบกลับขึ้นมือ`, { exact: true }); if (back.length < n) return { explain: "", ops: [] };
    const self = SCRIPTS[{ "ชิโยเมะ นินจาสาว": "BT10-006", "โกเอมอน นินจาจอมโจร": "BT10-004", "ฮันโซ นินจาในตำนาน": "BT10-005" }[name]]; const extra = self && self.selfCall ? self.selfCall(c, back) : [];
    return { explain: `${back.map((y) => E.name(s, y)).join(", ")} กลับขึ้นมือ · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "nameOnce", seat: p, name }, ...back.map((y) => ({ op: "move", i: y.i, to: "hand" })), { op: "put", i: x.i }, { op: "flagSet", i: x.i, k: "own", v: true }, ...extra] }; } });
const ganeshOk = (E, s, y, Ly) => once(s, Ly.p, "พระพิฆเนศ") && s.P[Ly.p].av.some((z) => z.i !== y.i && sy(E, s, z, "เทพ"));
const ganesh = (c, mi) => { const { E, s, seat: p, self: x } = c; const sac = s.P[p].av.filter((z) => z.i !== x.i && sy(E, s, z, "เทพ")).sort(cheapCard(E, s))[0]; const M = mi != null ? E.locate(s, mi) : null; if (!sac || !M || !once(s, p, "พระพิฆเนศ")) return { explain: "", ops: [] };
  const best = worth(E, s, sac) <= worth(E, s, M.x) + 4 ? 1 : 0; if (c.mode(["ไม่ใช้", `เซ่นไหว้ ${E.name(s, sac)}: ยกเลิกความสามารถของ ${E.name(s, M.x)}`], "พระพิฆเนศ", best) !== 1) return { explain: "ไม่ใช้", ops: [] };
  return { explain: `เซ่นไหว้ ${E.name(s, sac)} · ยกเลิก ${E.name(s, M.x)}`, ops: [{ op: "nameOnce", seat: p, name: "พระพิฆเนศ" }, { op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "cancelTrig", i: M.x.i, cast: true }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "mg" }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "land" }] }; };
const declareOps = (c, hit, miss) => { const { E, s } = c; const g = declare(c); if (!g.top) return { explain: "", ops: [] }; return g.hit ? { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ถูก (${E.name(s, g.top)})`, ops: [...hit, { op: "move", i: g.top.i, to: "hell" }] } : { explain: `ประกาศ ${TYPE_LABEL[g.k]} · ผิด (${E.name(s, g.top)})`, ops: miss }; };
Object.assign(SCRIPTS, {
  // พระพิฆเนศ: once per turn when the opponent uses an Avatar ability or a Magic, sacrifice another {เทพ}: that ability is cancelled
  "BT10-001": { magicSeenOk: (E, s, y, Ly, d, by) => Ly.z === "av" && by !== Ly.p && ganeshOk(E, s, y, Ly), magicSeen: (c) => ganesh(c, c.t.mi),
    oppAbilityOk: (E, s, y, Ly) => Ly.z === "av" && ganeshOk(E, s, y, Ly), oppAbility: (c) => ganesh(c, c.t.ai) },
  // พี่บูม แก๊งขยะ: once per turn discard 1: พี่ซี๊ด or เบรกเกต from the Deck · helped by พี่ซี๊ด: our แก๊งขยะ +1
  "BT10-003": { activate: { label: "ทิ้ง 1 ใบ: นำพี่ซี๊ดหรือเบรกเกตจาก Deck ขึ้นมือ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => E.named(s, y, "พี่ซี๊ด แก๊งขยะ") || E.named(s, y, "เบรกเกต แก๊งขยะ")),
      run: (c) => { const { E, s, seat: p } = c; const opts = ["พี่ซี๊ด แก๊งขยะ", "เบรกเกต แก๊งขยะ"].filter((n) => s.P[p].deck.some((y) => E.named(s, y, n))); const n = opts[c.mode(opts.map((o) => `นำ ${o} ขึ้นมือ`), "พี่บูม", 0)]; const t = s.P[p].deck.find((y) => E.named(s, y, n)); const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
        return t && pay ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "", ops: [] }; } },
    helpedByOk: (E, s, att, y) => E.named(s, y, "พี่ซี๊ด แก๊งขยะ"), helpedBy: (c) => ({ explain: "แก๊งขยะทุกใบ POWER +1", ops: c.s.P[c.seat].av.filter((y) => gang(c.E, c.s, y)).map((y) => ({ op: "power", i: y.i, n: 1, temp: true })) }) },
  // ninja: from the hand return ninja(s) of ours to the hand and come in (once a turn by name)
  "BT10-004": { activate: ninjaSwap("โกเอมอน นินจาจอมโจร", 2, true), selfCall: () => [], lifeHitOk: (E, s, x) => !!x.own,
    lifeHit: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[1 - p].hell].filter((y) => ["M"].includes(E.def(s, y).t)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Magic หรือ Mod ในนรกฝ่ายตรงข้าม", { exact: true })[0];
      if (!t) return { explain: "ไม่มี Magic ในนรกฝ่ายตรงข้าม", ops: [] }; const pay = c.choose([...s.P[p].hand, t].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0];
      return { explain: `นำ ${E.name(s, t)} ขึ้นมือ · ทิ้ง ${pay ? E.name(s, pay) : "-"}`, ops: [{ op: "move", i: t.i, to: "hand", seat: p }, ...(pay ? [{ op: "discard", seat: p, iids: [pay.i] }] : [])] }; } },
  "BT10-005": { activate: ninjaSwap("ฮันโซ นินจาในตำนาน", 1), summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck.find((y) => E.named(s, y, "วิชานินจา")); return t ? { explain: `${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "ไม่มีวิชานินจาใน Deck", ops: [] }; },
    selfCall: (c, back = []) => { const { E, s, seat: p, self: x } = c; const t = [...s.P[p].av.filter((y) => ninja(E, s, y) && !back.includes(y)), x].sort(strongFirst(E, s))[0]; return t ? [{ op: "keyword", i: t.i, k: "เตะไข่", until: "turn" }] : []; } },
  "BT10-006": { activate: ninjaSwap("ชิโยเมะ นินจาสาว", 1), selfCall: (c) => { const { E, s, seat: p } = c; const t = bestFoe(E, s, p)[0]; return t ? [{ op: "power", i: t.i, n: -3, temp: true }] : []; } },
  // ตำรวจเอไอ มุเค: once per turn declare the opponent's top type: right → an opposing Avatar -2 and that card to hell · wrong → this one -2
  "BT10-007": { activate: { label: "ประกาศประเภทการ์ดบนสุดของ Deck ฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[1 - L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = bestFoe(E, s, p)[0]; return declareOps(c, t ? [{ op: "power", i: t.i, n: -2, temp: true }] : [], [{ op: "power", i: x.i, n: -2, temp: true }]); } } },
  // ไอ้นัท - คนบ้าจั่ว: once per turn when it attacks: draw 1
  "BT10-008": { attack: (c) => (once(c.s, c.seat, "ไอ้นัท:" + c.self.i) ? { explain: "จั่ว 1 ใบ", ops: [{ op: "nameOnce", seat: c.seat, name: "ไอ้นัท:" + c.self.i }, { op: "draw", seat: c.seat, n: 1 }] } : { explain: "", ops: [] }) },
  // K-BO: from the hand, a เพมมุ weapon from our Magic Zone to hell: summoned · then exile it: this turn เพมมุ/สไปรท์ attacks face no React
  "BT10-009": { activate: { label: "K-BO: ส่งอาวุธของเพมมุลงนรก อัญเชิญ / เนรเทศ: เพมมุโจมตีโดยไม่มี React", can: (E, s, x, L) => s.phase === "main" && ((L.z === "hand" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].mg.some((m) => E.named(s, m, "อาวุธของเพมมุ"))) || (L.z === "av" && !!x.own)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const L = E.locate(s, x.i); if (L.z === "av") return { explain: "เนรเทศ K-BO · เทิร์นนี้ เพมมุ/สไปรท์ โจมตีโดยฝ่ายตรงข้ามใช้ React ไม่ได้", ops: [{ op: "exile", i: x.i }, { op: "stateSet", k: "kbo", why: "K-BO: เพมมุ/สไปรท์ โจมตีโดยไม่มี React" }] };
      const w = s.P[p].mg.find((m) => E.named(s, m, "อาวุธของเพมมุ")); return w ? { explain: `${E.name(s, w)} ลงนรก · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "move", i: w.i, to: "hell" }, { op: "put", i: x.i }, { op: "flagSet", i: x.i, k: "own", v: true }] } : { explain: "", ops: [] }; } } },
  // ซัลลี่วอดก้า: once per turn our [Link] Avatar that used สามัคคี or โล่มนุษย์ wakes up
  "BT10-010": { wakeLinked: true },
  // บ่าวแสม: once per turn when it attacks: exile our top card, then by our dark zone: 1+ +1 · 2+ wake · 3+ random discard from the opponent · counts as {หุ่นยนต์}
  "BT10-012": { extraSy: "หุ่นยนต์", attack: (c) => { const { E, s, seat: p, self: x } = c; if (!once(s, p, "บ่าวแสม:" + x.i) || !s.P[p].deck.length) return { explain: "", ops: [] }; const n = s.P[p].dark.length + 1; const opts = [[1, "POWER +1"], [2, "กลับมาตื่น"], [3, "สุ่มทิ้งการ์ดบนมือฝ่ายตรงข้าม 1 ใบ"]].filter(([k]) => n >= k);
    const k = opts[c.mode(opts.map(([, l]) => l), "บ่าวแสม: เลือกผล", opts.length - 1)][0]; return { explain: `เนรเทศการ์ดบนสุด · ${opts.find((o) => o[0] === k)[1]}`, ops: [{ op: "nameOnce", seat: p, name: "บ่าวแสม:" + x.i }, { op: "exile", i: s.P[p].deck[0].i }, k === 1 ? { op: "power", i: x.i, n: 1, temp: true } : k === 2 ? { op: "wake", i: x.i } : { op: "discardRandom", seat: 1 - p }] }; } },
  // พี่เจมส์: จุติ พี่บูม from the Deck (Cost -1 this turn) · helped by พี่ซี๊ด: up to 2 other-name แก๊งขยะ from hell
  "BT10-013": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck.find((y) => E.named(s, y, "พี่บูม แก๊งขยะ")); return t ? { explain: `${E.name(s, t)} ขึ้นมือ (Cost -1 เทิร์นนี้)`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }, { op: "handCost", i: t.i, n: -1 }] } : { explain: "ไม่มีพี่บูมใน Deck", ops: [] }; },
    helpedByOk: (E, s, att, y) => E.named(s, y, "พี่ซี๊ด แก๊งขยะ"), helpedBy: (c) => { const { E, s, seat: p, self: x } = c; const ts = uniq(E, s, s.P[p].hell.filter((y) => gang(E, s, y) && E.name(s, y) !== E.name(s, x))).slice(0, Math.min(2, freeAv(E, s, p))); return { explain: `อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ") || "-"} จากนรก`, ops: ts.map((y) => ({ op: "put", i: y.i })) }; } },
  // ลิขวิดบอย: partner วอเตอร์แมน: its จุติ works again
  "BT10-014": { linkAs: ["วอเตอร์แมน"], link: (c) => { const { E, s, seat: p } = c; const w = s.P[p].av.find((y) => E.named(s, y, "วอเตอร์แมน")); return w ? { explain: `จุติของ ${E.name(s, w)} ทำงานอีกครั้ง`, ops: [{ op: "reSummon", i: w.i }] } : { explain: "", ops: [] }; } },
  // ริกกี้ แท็กซี่: summoned by หนังมนุษย์ or a ริกกี้: base POWER 5 · what it destroys in fights is exiled
  "BT10-015": { byOk: (E, s, src) => !!src && (String(src.n || "").includes("หนังมนุษย์") || String(src.n || "").includes("ริกกี้")), summonedBy: (c) => (c.self ? { explain: "POWER ตั้งต้นเป็น 5", ops: [{ op: "ovSet", i: c.self.i, ov: { pw: 5 } }] } : { explain: "", ops: [] }),
    kill: (c) => { const L = deadOf(c); return L && L.z === "hell" ? { explain: `${c.E.name(c.s, L.x)} ถูกเนรเทศแทน`, ops: [{ op: "exile", i: L.x.i }] } : { explain: "", ops: [] }; } },
  // ตัวอะไรสักอย่างที่คล้ายกระรอก: once per turn from the hand after we summoned a blue {เอเลี่ยน} of Cost 5+: summoned
  "BT10-016": { activate: { label: "อัญเชิญจากมือ (อัญเชิญเอเลี่ยนสีฟ้า Cost 5+ แล้วในเทิร์นนี้)", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && once(s, L.p, "กระรอก") && !!s.sum && !!s.sum[L.p] && s.sum[L.p].t === s.turn && (s.sum[L.p].d || []).some((d) => d.co.includes("ฟ้า") && d.c >= 5 && d.sy.includes("เอเลี่ยน")),
    run: (c) => ({ explain: `อัญเชิญ ${c.E.name(c.s, c.self)}`, ops: [{ op: "nameOnce", seat: c.seat, name: "กระรอก" }, { op: "put", i: c.self.i }] }) } },
  // สิ่งปฏิกูล: มีชีวิต คำสั่งเสีย scout 3, a สิ่งปฏิกูล to the hand (summoned in our turn), the rest to hell · สีเงิน คำสั่งเสีย an opposing Avatar -1 (-3 in our turn)
  "BT10-017": { death: (c) => { const { E, s, seat: p } = c; const top = s.P[p].deck.slice(0, 3); if (!top.length) return { explain: "", ops: [] }; const t = top.find((y) => sewer(E, s, y)); const ours = s.active === p && E.avatars(s.P[p]) < 4;
    return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ${ours ? "อัญเชิญ" : "ขึ้นมือ"}` : ""} · ที่เหลือลงนรก`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [ours ? { op: "put", i: t.i } : { op: "move", i: t.i, to: "hand" }] : []), ...top.filter((y) => y !== t).map((y) => ({ op: "move", i: y.i, to: "hell" }))] }; } },
  "BT10-018": { death: (c) => { const { E, s, seat: p } = c; const t = bestFoe(E, s, p)[0]; const n = s.active === p ? 3 : 1; return t ? { explain: `${E.name(s, t)} POWER -${n}`, ops: [{ op: "power", i: t.i, n: -n, temp: false }] } : { explain: "", ops: [] }; } },
  // ราชาสิ่งปฏิกูล (พอดี / by a สิ่งปฏิกูล): จุติ with 5+ สิ่งปฏิกูล in hell an opposing Avatar becomes a POWER 1 สิ่งปฏิกูล {สัตว์วิเศษ} · once per turn destroy a สิ่งปฏิกูล: random discard from the opponent
  "BT10-019": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!c.t.exact && !(x && x.sb != null && String((s.cards[x.sb] || {}).n || "").includes("สิ่งปฏิกูล"))) return { explain: "ไม่ได้อัญเชิญแบบพอดี", ops: [] }; if (s.P[p].hell.filter((y) => E.named(s, y, "สิ่งปฏิกูล")).length < 5) return { explain: "สิ่งปฏิกูลในนรกไม่ถึง 5 ใบ", ops: [] };
      const t = bestFoe(E, s, p)[0]; return t ? { explain: `${E.name(s, t)} กลายเป็น "สิ่งปฏิกูล" {สัตว์วิเศษ} POWER 1`, ops: [{ op: "ovSet", i: t.i, ov: { n: "สิ่งปฏิกูล", sy: "สัตว์วิเศษ", pw: 1 } }, { op: "resetPower", i: t.i }] } : { explain: "", ops: [] }; },
    byOk: (E, s, src) => !!src && String(src.n || "").includes("สิ่งปฏิกูล"), summonedBy: (c) => SCRIPTS["BT10-019"].summon({ ...c, t: { ...c.t, exact: true } }),
    activate: { label: "ทำลายสิ่งปฏิกูล 1 ใบ: สุ่มทิ้งการ์ดบนมือฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && [...s.P[0].av, ...s.P[1].av].some((y) => y.i !== x.i && E.named(s, y, "สิ่งปฏิกูล")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose([...s.P[1 - p].av, ...s.P[p].av].filter((y) => y.i !== x.i && E.named(s, y, "สิ่งปฏิกูล")), 1, "เลือกสิ่งปฏิกูล", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)} · สุ่มทิ้งการ์ดฝ่ายตรงข้าม 1 ใบ`, ops: [{ op: "destroy", i: t.i, why: "ราชาสิ่งปฏิกูล" }, { op: "discardRandom", seat: 1 - p }] } : { explain: "", ops: [] }; } } },
  // เตียวคับ: the opponent cannot attack our other วุยก๊ก · summoned by a ขุนพล {ต่างชาติ}: +2 and deals 2 LIFE damage
  "BT10-020": { guardOthers: (E, s, y, t) => E.named(s, t, "วุยก๊ก"), byOk: (E, s, src) => !!src && src.t === "A" && (String(src.n || "").includes("ขุนพล") || String(src.x || "").includes('ถือว่ามีชื่อ "ขุนพล')) && String(src.sy || "").includes("ต่างชาติ"),
    summonedBy: (c) => (c.self ? { explain: "POWER +2 · โจมตี LIFE สำเร็จทำความเสียหาย 2 ใบ", ops: [{ op: "power", i: c.self.i, n: 2, temp: false }, { op: "flagSet", i: c.self.i, k: "lh2", v: true }] } : { explain: "", ops: [] }), lifeHits: (E, s, x) => (x.lh2 ? 2 : 1) },
  // แบงค์ ชาวดาวพฤหัส: once per turn discard 1: a แบงค์ to the hand, or one from the Deck to hell
  "BT10-021": { activate: { label: "ทิ้ง 1 ใบ: นำแบงค์ขึ้นมือ หรือส่งแบงค์ลงนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => bank(E, s, y)),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const m = c.mode(["1) แบงค์ จาก Deck ขึ้นมือ", "2) ส่งแบงค์ จาก Deck ลงนรก"], "แบงค์ ชาวดาวพฤหัส", 0);
      const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => bank(E, s, y) && (m === 1 || !E.def(s, y).o1))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกแบงค์ใน Deck", { exact: true })[0];
      return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ${m === 0 ? "ขึ้นมือ" : "ลงนรก"}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, m === 0 ? { op: "search", seat: p, take: t.i, to: "hand" } : { op: "move", i: t.i, to: "hell" }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } } },
  // ไมค์วิสกี้: จุติ a Cost ≤4 [Link] Avatar from the hand (ซัลลี่วอดก้า: draw 1)
  "BT10-023": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hand.filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 4 && /\[\s*Link/.test(String(E.def(s, y).x || ""))).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; if (!t || E.avatars(s.P[p]) >= 4) return { explain: "ไม่มี Avatar [Link] บนมือ", ops: [] }; const sv = E.named(s, t, "ซัลลี่วอดก้า");
    return { explain: `อัญเชิญ ${E.name(s, t)}${sv ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "put", i: t.i }, ...(sv ? [{ op: "draw", seat: p, n: 1 }] : [])] }; } },
  // ฯลฯ กระบือชาวร๊อค: our other attackers +1 this turn
  "BT10-024": { allyAttack: true },
  // จอมเวทย์ โกลเด้น: entering [Link]: a "จอมเวทย์" Construct from the Deck or hell built · destroyed instead of another จอมเวทย์ of ours removed by the opponent
  "BT10-025": { link: (c) => { const { E, s, seat: p } = c; if (s.P[p].cs.length >= 3) return { explain: "", ops: [] }; const h = s.P[p].hell.find((y) => E.def(s, y).t === "C" && E.named(s, y, "จอมเวทย์")); const d = h ? null : s.P[p].deck.find((y) => E.def(s, y).t === "C" && E.named(s, y, "จอมเวทย์"));
      const t = h || d; return t ? { explain: `ก่อสร้าง ${E.name(s, t)}`, ops: [{ op: "move", i: t.i, to: "cs", seat: p }, ...(d ? [{ op: "shuffle", seat: p }] : [])] } : { explain: "ไม่มี Construct จอมเวทย์", ops: [] }; },
    saveOther: (E, s, y, Ly, x, L, ctx) => (Ly.z === "av" && L.z === "av" && x.i !== y.i && L.p === Ly.p && wizard(E, s, x) && ((ctx && ctx.fight) || (ctx && ctx.by != null ? ctx.by !== Ly.p : s.curSeat != null && s.curSeat !== Ly.p)) ? { why: `${E.name(s, y)} ถูกทำลายแทน ${E.name(s, x)}`, ops: [{ op: "destroy", i: y.i, why: "ทำลายแทน", noSave: true }] } : null) },
  // จอมเวทย์ เดสสึหวา: จุติ discard a คาถา or จอมเวทย์: draw 2 · when a คาถา is used, a จอมเวทย์ of ours +1 · [Link] only it can be attacked; once per turn attacked: draw 1
  "BT10-026": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hand.filter((y) => spell(E, s, y) || wizard(E, s, y)).sort(cheapCard(E, s))[0]; return t ? { explain: `ทิ้ง ${E.name(s, t)} · จั่ว 2 ใบ`, ops: [{ op: "discard", seat: p, iids: [t.i] }, { op: "draw", seat: p, n: 2 }] } : { explain: "ไม่มีคาถาหรือจอมเวทย์บนมือ", ops: [] }; },
    magicSeenOk: (E, s, y, Ly, d) => Ly.z === "av" && String(d.n || "").includes("คาถา"), magicSeen: (c) => { const { E, s, seat: p } = c; const t = s.P[p].av.filter((y) => wizard(E, s, y)).sort(strongFirst(E, s))[0]; return t ? { explain: `${E.name(s, t)} POWER +1`, ops: [{ op: "power", i: t.i, n: 1, temp: false }] } : { explain: "", ops: [] }; },
    taunt: (E, s, y) => !!y.lk, attacked: (c) => (c.self && c.self.lk && once(c.s, c.seat, "เดสสึหวา") ? { explain: "ตกเป็นเป้าการโจมตี: จั่ว 1 ใบ", ops: [{ op: "nameOnce", seat: c.seat, name: "เดสสึหวา" }, { op: "draw", seat: c.seat, n: 1 }] } : { explain: "", ops: [] }) },
  // นายนิรยบาล นิมมา: จุติ mill 2, draw 1 · [Link ดาร์กช็อก] once per turn attacking, mill 1: +1 per {นรก} of ours this turn
  "BT10-027": { summon: (c) => ({ explain: "ธรณีสูบ 2 ใบ · จั่ว 1 ใบ", ops: [{ op: "mill", seat: c.seat, n: 2 }, { op: "draw", seat: c.seat, n: 1 }] }),
    attack: (c) => { const { E, s, seat: p, self: x } = c; if (!x.lk || !once(s, p, "นิมมา:" + x.i)) return { explain: "", ops: [] }; const n = s.P[p].av.filter((y) => sy(E, s, y, "นรก")).length; return { explain: `ธรณีสูบ 1 ใบ · POWER +${n}`, ops: [{ op: "nameOnce", seat: p, name: "นิมมา:" + x.i }, { op: "mill", seat: p, n: 1 }, { op: "power", i: x.i, n, temp: true }] }; } },
  // นายนิรยบาล ดาร์กช็อก: once per turn after a mill this turn: a card from hell under the Deck
  "BT10-028": { activate: { label: "นำการ์ดในนรก 1 ใบเข้าใต้ Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !!(s.milled && s.milled[L.p] === s.turn) && s.P[L.p].hell.some((y) => !E.def(s, y).o1),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].hell].filter((y) => !E.def(s, y).o1).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดในนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} เข้าใต้ Deck`, ops: [{ op: "move", i: t.i, to: "deckBottom" }] } : { explain: "", ops: [] }; } } },
  // พี่หน่วงเพชรฆาตโซเชียล: once per turn exile a captured opposing Avatar: scout 5 for คุณเก่ง/ทนาย/พี่หน่วง, or an Avatar from the opponent's hell to our Magic Zone
  "BT10-031": { activate: { label: "เนรเทศ Avatar ฝ่ายตรงข้ามใน Magic Zone เรา: เลือกปฏิบัติ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && stolen(E, s, L.p).length > 0,
    run: (c) => { const { E, s, seat: p } = c; const ex = stolen(E, s, p).sort(cheapCard(E, s))[0]; const m = c.mode(["1) สอดแนม 5 ใบ หาคุณเก่ง/ทนาย/พี่หน่วง", "2) Avatar ในนรกฝ่ายตรงข้ามมาไว้ Magic Zone เรา"], "พี่หน่วงเพชรฆาต", s.P[1 - p].hell.some((y) => isAv(E, s, y)) ? 1 : 0);
      if (m === 1) { const t = [...s.P[1 - p].hell].filter((y) => isAv(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return { explain: `เนรเทศ ${E.name(s, ex)}${t ? ` · ${E.name(s, t)} มาไว้ที่ Magic Zone เรา` : ""}`, ops: [{ op: "exile", i: ex.i }, ...(t ? [{ op: "move", i: t.i, to: "mg", seat: p }] : [])] }; }
      const { top, t } = scoutPick(c, 5, (y) => ["คุณเก่ง", "ทนาย", "พี่หน่วง"].some((n) => E.named(s, y, n)), "เลือกคุณเก่ง ทนาย หรือพี่หน่วง", { optional: true }); return { explain: `เนรเทศ ${E.name(s, ex)} · สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "exile", i: ex.i }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [])] }; } } },
  // พี่ซี๊ด แก๊งขยะ: สามัคคี · once per turn from hell after we summoned a แก๊งขยะ this turn (none of it on our zone), discard 1: summoned
  "BT10-032": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญพี่ซี๊ดจากนรก", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && E.summonedNow(s, L.p).some((n) => n.includes("แก๊งขยะ")) && !s.P[L.p].av.some((y) => E.named(s, y, "พี่ซี๊ด แก๊งขยะ")),
    run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, x)} จากนรก`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: x.i }] } : { explain: "", ops: [] }; } } },
  // พระอีสาน: discarded from the hand when our อีสานสลิงเกอร์ fights: it +1 for the fight
  "BT10-033": { handFightOk: (E, s, y, F) => isan(E, s, F) && F.o === y.o, handFight: (c) => { const F = c.t.fighter != null ? c.E.locate(c.s, c.t.fighter) : null; return F ? { explain: `ทิ้ง ${c.E.name(c.s, c.self)} · ${c.E.name(c.s, F.x)} POWER +1`, ops: [{ op: "discard", seat: c.seat, iids: [c.self.i] }, { op: "power", i: F.x.i, n: 1, temp: "fight" }] } : { explain: "", ops: [] }; } },
});
const ANYR = ["attack", "summon", "cast", "activate", "battle", "react"];
const onlyNinja = (E, s, p) => s.P[p].av.length > 0 && s.P[p].av.every((y) => ninja(E, s, y));
const isThrone = (E, s, y) => E.named(s, y, "บัลลังก์ตั๊กแตนศตวรรษ");
const throneOn = (E, s, x) => [...s.P[0].mg, ...s.P[1].mg].some((m) => m.on === x.i && isThrone(E, s, m));
const lifeUp = (s, p) => s.P[p].life.filter((y) => y.up);
const useLife = (c, all) => { const { E, s, seat: p } = c; const t = c.choose(lifeUp(s, p), 1, "เลือก LIFE ที่หงายอยู่ของเรา 1 ใบ", { exact: true, reveal: true })[0]; return t ? { explain: `ใช้ความสามารถของ LIFE ${E.name(s, t)}`, ops: [{ op: "lifeUse", seat: p, i: t.i, all: !!all }] } : { explain: "ไม่มี LIFE ที่หงายอยู่", ops: [] }; };
const gangNames = (E, s, p) => new Set(s.P[p].av.filter((y) => gang(E, s, y)).map((y) => E.name(s, y))).size;
const foeField = (E, s, p) => [...s.P[1 - p].av, ...s.P[1 - p].mg, ...s.P[1 - p].cs, ...E.lands(s).filter((l) => l.o === 1 - p)].filter((y) => !E.noAim(s, y));
const podAttrs = [["POWER", (E, s, h, y) => E.power(s, y) === (E.def(s, h).pw || 0)], ["Symbol", (E, s, h, y) => String(E.def(s, h).sy || "").split(/[\s,/]+/).filter(Boolean).some((k) => sy(E, s, y, k))], ["ค่า Cost", (E, s, h, y) => (E.def(s, y).c || 0) === (E.def(s, h).c || 0)], ["จำนวน GEM", (E, s, h, y) => (E.def(s, y).g || 0) === (E.def(s, h).g || 0)], ["สี", (E, s, h, y) => !!E.def(s, h).co && E.colors(s, y).includes(E.def(s, h).co)]];
Object.assign(SCRIPTS, {
  // ตำรวจสัมภเวสี ทาย: จุติ show a ตำรวจ from the hand: scout the opponent's 2, one to hell, the other back on top
  "BT10-034": { summon: (c) => { const { E, s, seat: p, self: x } = c; const show = s.P[p].hand.find((y) => y.i !== (x && x.i) && E.named(s, y, "ตำรวจ")); if (!show) return { explain: "ไม่มีการ์ดตำรวจบนมือ", ops: [] }; const top = s.P[1 - p].deck.slice(0, 2); if (!top.length) return { explain: "", ops: [] };
    const t = c.choose([...top].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดที่จะส่งลงนรก (อีกใบวางไว้บนสุด)", { exact: true, reveal: true })[0]; return { explain: `แสดง ${E.name(s, show)} · ${E.name(s, t)} ลงนรก`, ops: [{ op: "scoutShow", seat: 1 - p, ids: top.map((y) => y.i) }, { op: "move", i: t.i, to: "hell" }] }; } },
  // แก๊ง Super Card: in the Draw Phase, with 3+ cards in hand, draw 2 instead of 1
  "BT10-035": { drawMore: (E, s, x, p, n) => (s.P[p].hand.length - n >= 3 ? 1 : 0) },
  // เนโกะเมะ ยูริ: once per turn: until the end of the opponent's next turn, each Land (or each Mod) used draws us 1
  "BT10-036": { activate: { label: "เลือก: ทุกครั้งที่มีการใช้ Land หรือ Mod จั่ว 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main",
    run: (c) => { const { E, s, seat: p } = c; const mods = s.P[p].hand.filter((y) => E.def(s, y).st === "D").length + s.P[1 - p].mg.filter((m) => m.on != null).length; const lands = s.P[p].hand.filter((y) => E.def(s, y).st === "L").length;
      const m = c.mode(["1) ทุกครั้งที่มีการใช้ Land: จั่ว 1 ใบ", "2) ทุกครั้งที่มีการใช้ Mod: จั่ว 1 ใบ"], "เนโกะเมะ ยูริ", lands > mods ? 0 : 1); const st = m === 0 ? "L" : "D";
      return { explain: m === 0 ? "ใช้ Land แล้วจั่ว 1 ใบ" : "ใช้ Mod แล้วจั่ว 1 ใบ", ops: [{ op: "stateSet", k: "neko", st, why: `เนโกะเมะ ยูริ: จนจบเทิร์นถัดไปของฝ่ายตรงข้าม ทุกครั้งที่มีการใช้ ${st === "L" ? "Land" : "Mod"} จั่ว 1 ใบ` }] }; } } },
  // ตันก๋ง: our ลิโป้ ขุนพลเทพสงคราม flips the opponent's top LIFE when it attacks and wins a fight
  "BT10-037": { allyKillOk: (E, s, y, w) => E.named(s, w, "ลิโป้ ขุนพลเทพสงคราม") && !!s.pend && s.pend.att === w.i, allyKill: (c) => ({ explain: "หงาย LIFE ใบบนสุดของฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] }) },
  // แบงค์ Miner: 4+ แบงค์ names in hell: attacking exiles the opponent's top 2 · 8+: unaffected by Magic
  "BT10-038": { attack: (c) => { const { E, s, seat: p } = c; if (bankNames(E, s, p) < 4) return { explain: "", ops: [] }; const top = s.P[1 - p].deck.slice(0, 2); return { explain: `เนรเทศการ์ดบนสุดของ Deck ฝ่ายตรงข้าม ${top.length} ใบ`, ops: top.map((y) => ({ op: "exile", i: y.i })) }; },
    magicProof: (E, s, x) => { const L = E.locate(s, x.i); return !!L && L.z === "av" && bankNames(E, s, L.p) >= 8; } },
  // มาโกะ มารดาแห่งภาคีมะม่วง: from the Magic Zone, 5 other มะม่วง there to hell: summoned with จุติ · จุติ distinct มะม่วง from hell to the Magic Zone · +1 per ต้นมะม่วง there · once per turn a มะม่วง from there summoned with จุติ
  "BT10-039": { activate: { label: "มาโกะ: อัญเชิญ จุติ", can: (E, s, x, L) => s.phase === "main" && E.avatars(s.P[L.p]) < 4 && ((L.z === "mg" && x.on == null && s.P[L.p].mg.filter((m) => m.on == null && m.i !== x.i && mango(E, s, m)).length >= 5) || (L.z === "av" && s.P[L.p].mg.some((m) => m.on == null && isAv(E, s, m) && E.named(s, m, "มะม่วง")))),
    run: (c) => { const { E, s, seat: p, self: x } = c; const L = E.locate(s, x.i);
      if (L.z === "mg") { const pay = c.choose(s.P[p].mg.filter((m) => m.on == null && m.i !== x.i && mango(E, s, m)).sort((a, b) => (isTree(E, s, a) ? 1 : 0) - (isTree(E, s, b) ? 1 : 0) || cheapCard(E, s)(a, b)), 5, "เลือก มะม่วง 5 ใบ บน Magic Zone ส่งลงนรก", { exact: true }); if (pay.length < 5) return { explain: "", ops: [] };
        return { explain: `ส่ง ${pay.length} ใบลงนรก · อัญเชิญ จุติ ${E.name(s, x)}`, ops: [...pay.map((m) => ({ op: "move", i: m.i, to: "hell" })), { op: "put", i: x.i, jt: true, here: true }] }; }
      const t = c.choose(s.P[p].mg.filter((m) => m.on == null && isAv(E, s, m) && E.named(s, m, "มะม่วง")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก มะม่วง บน Magic Zone อัญเชิญ จุติ", { exact: true })[0];
      return t ? { explain: `อัญเชิญ จุติ ${E.name(s, t)} จาก Magic Zone`, ops: [{ op: "put", i: t.i, jt: true, here: true }] } : { explain: "", ops: [] }; } },
    summon: (c) => { const { E, s, seat: p } = c; const ts = c.choose(uniq(E, s, s.P[p].hell.filter((y) => mango(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 9, "เลือก มะม่วง (ชื่อไม่ซ้ำ) จากนรก มาวางบน Magic Zone", { optional: true }); const seen = new Set(); const pick = ts.filter((y) => !seen.has(E.name(s, y)) && seen.add(E.name(s, y)));
      return { explain: pick.length ? `${pick.map((y) => E.name(s, y)).join(", ")} ไปวางไว้บน Magic Zone` : "ไม่มี มะม่วง ในนรก", ops: pick.map((y) => ({ op: "move", i: y.i, to: "mg", seat: p })) }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: mangoTree(E, s, L.p) }] : []) },
  // ผู้คุมกฎแห่งภาคีมะม่วง: จุติ a มะม่วง from the Deck to our Magic Zone (a ต้นมะม่วง brings another from the Deck or hell) · คำสั่งเสีย back to the Magic Zone
  "BT10-040": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => mango(E, s, y) && !E.def(s, y).o1)).sort((a, b) => (isTree(E, s, b) ? 1 : 0) - (isTree(E, s, a) ? 1 : 0) || worth(E, s, b) - worth(E, s, a)), 1, "เลือก มะม่วง จาก Deck มาวางบน Magic Zone", { exact: true })[0];
      if (!t) return { explain: "ไม่มี มะม่วง ใน Deck", ops: [{ op: "shuffle", seat: p }] }; const t2 = isTree(E, s, t) ? c.choose([...s.P[p].deck, ...s.P[p].hell].filter((y) => y !== t && mango(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก มะม่วง อีก 1 ใบ จาก Deck หรือนรก (ไม่บังคับ)", { optional: true })[0] : null;
      return { explain: `${E.name(s, t)}${t2 ? " และ " + E.name(s, t2) : ""} ไปวางไว้บน Magic Zone`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }, ...(t2 ? [{ op: "move", i: t2.i, to: "mg", seat: p }] : []), { op: "shuffle", seat: p }] }; }, death: mangoDeath },
  // นักรบทองแห่งภาคีมะม่วง: End Phase with a ต้นมะม่วง on our Magic Zone: wake and +2 until our next Draw Phase · คำสั่งเสีย back to the Magic Zone
  "BT10-041": { endPhase: (E, s, x, L) => (L.z === "av" && mangoTree(E, s, L.p) > 0 ? [{ op: "wake", i: x.i }, { op: "power", i: x.i, n: 2, temp: "next" }] : []), death: mangoDeath },
  // ผู้พิทักษ์แห่งภาคีมะม่วง: on the Magic Zone, our ต้นมะม่วง there cannot be destroyed by the opponent · คำสั่งเสีย back to the Magic Zone
  "BT10-042": { guard: (E, s, y, Ly, x, L, kind) => kind === "destroy" && Ly.z === "mg" && y.on == null && L.z === "mg" && x.on == null && L.p === Ly.p && isTree(E, s, x), death: mangoDeath },
  // ไมยราพ: จุติ two {ยักษ์} of Cost ≤3 without text from the Deck
  "BT10-043": { summon: (c) => { const { E, s, seat: p } = c; const n = Math.min(2, freeAv(E, s, p)); const ts = c.choose(s.P[p].deck.filter((y) => giant(E, s, y) && (E.def(s, y).c || 0) <= 3 && !String(E.def(s, y).x || "").trim()).sort((a, b) => worth(E, s, b) - worth(E, s, a)), n, "เลือกยักษ์ Cost ไม่เกิน 3 ที่ไม่มี Text Box", { exact: true });
    return { explain: ts.length ? `อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ")}` : "ไม่มียักษ์ที่ตรงเงื่อนไข", ops: [...ts.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }] }; } },
  // ราชันย์ตั๊กแตนศตวรรษ: จุติ wear บัลลังก์ from hell, or flip our LIFE and take it from the Deck · wearing it: at the start of our Main Phase use a face-up LIFE of ours
  "BT10-044": { summon: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[p].hell.find((y) => isThrone(E, s, y)); const d = s.P[p].deck.find((y) => isThrone(E, s, y)); const opts = [...(h ? [0] : []), ...(d ? [1] : [])]; if (!opts.length || !x) return { explain: "ไม่มีบัลลังก์ตั๊กแตนศตวรรษ", ops: [] };
      const m = opts[c.mode(opts.map((k) => (k === 0 ? "1) นำบัลลังก์ตั๊กแตนศตวรรษจากนรกมาสวมใส่" : "2) หงาย LIFE 1 ใบ: นำบัลลังก์ตั๊กแตนศตวรรษจาก Deck ขึ้นมือ")), "ราชันย์ตั๊กแตนศตวรรษ", 0)];
      return m === 0 ? { explain: `${E.name(s, h)} สวมใส่ให้ ${E.name(s, x)}`, ops: [{ op: "attach", i: h.i, on: x.i }] } : { explain: `หงาย LIFE · ${E.name(s, d)} ขึ้นมือ`, ops: [{ op: "lifeFlip", seat: p }, { op: "search", seat: p, take: d.i, to: "hand" }] }; },
    mainStartOk: (E, s, x) => { const L = E.locate(s, x.i); return !!L && L.z === "av" && throneOn(E, s, x) && lifeUp(s, L.p).length > 0; }, mainStart: (c) => useLife(c, false) },
  // นักข่าวสาว เดย์วัน: paid for a ตำรวจ: GEM 5 colourless and scout the opponent 1 · with a ตำรวจ: the opponent's top card is open, cannot be attacked
  "BT10-045": { gemFor: (td) => (td && td.t === "A" && String(td.n || "").includes("ตำรวจ") ? 5 : null), selfColorless: (E, s, x, td) => !!td && td.t === "A" && String(td.n || "").includes("ตำรวจ"),
    paidFor: (d) => d.t === "A" && String(d.n || "").includes("ตำรวจ"), paid: (c) => { const { E, s, seat: p } = c; const top = s.P[1 - p].deck[0]; return top ? { explain: `สอดแนม Deck ฝ่ายตรงข้าม 1 ใบ แล้ววางไว้ที่เดิม`, ops: [{ op: "scoutShow", seat: 1 - p, ids: [top.i] }] } : { explain: "", ops: [] }; },
    openDeck: (E, s, x, L, q) => L.z === "av" && q === 1 - L.p && s.P[L.p].av.some((y) => police(E, s, y)), noAtk: (E, s, x, L) => !!L && L.z === "av" && s.P[L.p].av.some((y) => police(E, s, y)) },
  // ตำรวจพ่อลูกอ่อน คามุ: once per turn after a fight it attacked in: declare the opponent's top type: right → wake and that card to hell
  "BT10-046": { atkEndOk: (E, s, x, A) => once(s, A.p, "คามุ:" + x.i) && s.P[1 - A.p].deck.length > 0,
    atkEnd: (c) => { const { s, seat: p, self: x } = c; if (!x || !once(s, p, "คามุ:" + x.i)) return { explain: "", ops: [] }; const r = declareOps(c, [{ op: "wake", i: x.i }], []); return { explain: r.explain, ops: [{ op: "nameOnce", seat: p, name: "คามุ:" + x.i }, ...r.ops] }; } },
  // เบรกเกต แก๊งขยะ: helped by พี่ซี๊ด: wakes
  "BT10-047": { helpedByOk: (E, s, att, y) => E.named(s, y, "พี่ซี๊ด แก๊งขยะ"), helpedBy: (c) => (c.self ? { explain: `${c.E.name(c.s, c.self)} กลับมาตื่น`, ops: [{ op: "wake", i: c.self.i }] } : { explain: "", ops: [] }) },
  // เซนเซไฮ: the Avatar it helps gains the LIFE flip on a fight win · คำสั่งเสีย discard 3 or flip our LIFE
  "BT10-048": { onHelp: true, death: (c) => { const { E, s, seat: p } = c; const h = s.P[p].hand.length; const down = s.P[p].life.filter((y) => !y.up).length; const best = !down ? 1 : h <= 2 || down <= 2 ? 0 : 1;
    if (c.mode([`ทิ้งการ์ดบนมือ ${Math.min(3, h)} ใบ`, "หงาย LIFE ใบบนสุดของเรา 1 ใบ"], "เซนเซไฮ: คำสั่งเสีย", best) === 1) return { explain: "หงาย LIFE ใบบนสุดของเรา 1 ใบ", ops: [{ op: "lifeFlip", seat: p }] };
    const ts = h <= 3 ? [...s.P[p].hand] : c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 3, "เลือกการ์ดบนมือทิ้ง 3 ใบ", { exact: true }); return { explain: `ทิ้งการ์ด ${ts.length} ใบ`, ops: ts.length ? [{ op: "discard", seat: p, iids: ts.map((y) => y.i) }] : [] }; } },
  // ชิบาตะ โบตัน: พอดี: once per turn swap an Avatar's Cost and base POWER until the end of the turn
  "BT10-050": { activate: { label: "พอดี: สลับ Cost กับ POWER ตั้งต้นของ Avatar 1 ใบ จนจบเทิร์น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !!x.px,
    run: (c) => { const { E, s, seat: p } = c; const mine = (y) => (E.locate(s, y.i) || {}).p === p; const score = (y) => { const d = E.def(s, y); const g = (d.c || 0) - (d.pw || 0); return mine(y) ? g : -g; };
      const t = c.choose([...s.P[1 - p].av.filter((y) => !E.noAim(s, y)), ...s.P[p].av].sort((a, b) => score(b) - score(a)), 1, "เลือก Avatar ที่จะสลับ Cost กับ POWER ตั้งต้น", { exact: true })[0]; if (!t) return { explain: "", ops: [] };
      const d = E.def(s, t); const prev = { c: t.ov && t.ov.c !== undefined ? t.ov.c : null, pw: t.ov && t.ov.pw !== undefined ? t.ov.pw : null };
      return { explain: `${E.name(s, t)}: Cost ${d.c || 0} ↔ POWER ${d.pw || 0} จนจบเทิร์น`, ops: [{ op: "ovSet", i: t.i, ov: { c: d.pw || 0, pw: d.c || 0 } }, { op: "atEnd", turn: s.turn, ops: [{ op: "ovSet", i: t.i, ov: prev }] }] }; } } },
  // การเลือกสรรของ พระพิฆเนศ: with พระพิฆเนศ: a non-Only {เทพ} of Cost ≤4 from hell
  "BT10-053": { canCast: (E, s, p) => s.P[p].av.some((y) => E.named(s, y, "พระพิฆเนศ")) && E.avatars(s.P[p]) < 4 && s.P[p].hell.some((y) => isAv(E, s, y) && sy(E, s, y, "เทพ") && (E.def(s, y).c || 0) <= 4 && !E.def(s, y).o1),
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && sy(E, s, y, "เทพ") && (E.def(s, y).c || 0) <= 4 && !E.def(s, y).o1).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar เทพ จากนรก", { exact: true })[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "", ops: [] }; } },
  // เหนือฟ้าใต้หล้า ข้าคือมหาจอมเวทย์: discard 1: a คาถา from the Deck · with a จอมเวทย์ one more Magic this turn
  "BT10-054": { canCast: (E, s, p) => s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => spell(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกคาถาจาก Deck", { exact: true })[0]; const wiz = s.P[p].av.some((y) => wizard(E, s, y));
    return { explain: `${pay ? "ทิ้ง " + E.name(s, pay) + " · " : ""}${t ? E.name(s, t) + " ขึ้นมือ" : "ไม่มีคาถาใน Deck"}${wiz ? " · ใช้ Magic ได้อีก 1 ใบ" : ""}`, ops: [...(pay ? [{ op: "discard", seat: p, iids: [pay.i] }] : []), t ? { op: "search", seat: p, take: t.i, to: "hand" } : { op: "shuffle", seat: p }, ...(wiz ? [{ op: "extraN", seat: p, not: "เหนือฟ้าใต้หล้า ข้าคือมหาจอมเวทย์" }] : [])] }; } },
  // คาถา เฟรนลี่คัม: with a จอมเวทย์: scout 5, a จอมเวทย์ summoned with จุติ, the rest under the Deck · pays only for จอมเวทย์
  "BT10-055": { canCast: (E, s, p) => s.P[p].av.some((y) => wizard(E, s, y)), payOnly: (td) => td.t === "A" && String(td.n || "").includes("จอมเวท"),
    cast: (c) => { const { E, s, seat: p } = c; const room = E.avatars(s.P[p]) < 4; const { top, t } = scoutPick(c, 5, (y) => room && wizard(E, s, y), "เลือกจอมเวทย์ อัญเชิญ จุติ", { optional: true }); if (!top.length) return { explain: "", ops: [] };
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · อัญเชิญ จุติ ${E.name(s, t)}` : ""} · ที่เหลือไว้ใต้ Deck`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "put", i: t.i, jt: true }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] }; } },
  // ชีวิตที่พอดี: discard 2: an Avatar of ours with พอดี จุติ does its จุติ again
  "BT10-056": { canCast: (E, s, p) => s.P[p].hand.length >= 3 && s.P[p].av.some((y) => /พอดี\s*จุต[ิี]/.test(String(E.def(s, y).x || ""))),
    cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); const t = c.choose(s.P[p].av.filter((y) => /พอดี\s*จุต[ิี]/.test(String(E.def(s, y).x || ""))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ที่มี พอดี จุติ", { exact: true })[0];
      return t && pay.length === 2 ? { explain: `ทิ้ง 2 ใบ · จุติของ ${E.name(s, t)} ทำงานอีกครั้ง`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "reSummon", i: t.i, exact: true }] } : { explain: "", ops: [] }; } },
  // 1 - 2 - 2: only as the first card of the Main Phase: draw 3, then no Deck searches and no next draw until the end of our next turn
  "BT10-057": { canCast: (E, s, p) => !E.summonedNow(s, p).length && !["N", "D", "R", "L"].some((k) => s.mu[p][k]),
    cast: (c) => ({ explain: "จั่ว 3 ใบ", ops: [{ op: "draw", seat: c.seat, n: 3 }, { op: "stateSet", k: "oneTwoTwo", why: "1 - 2 - 2: จนจบเทิร์นถัดไปของเรา นำการ์ดจาก Deck ขึ้นมือด้วยความสามารถไม่ได้ และ Draw Phase ถัดไปไม่ได้จั่ว" }] }) },
  // พายุหิมะเริงระบำ: with ราชินีหิมะ and 8+ ทหารหิมะ in hell: ทหารหิมะ of total Cost ≤6 from the Deck; at the End Phase they go to hell and a ราชาหิมะ may come
  "BT10-058": { canCast: (E, s, p) => s.P[p].av.some((y) => E.named(s, y, "ราชินีหิมะ")) && s.P[p].hell.filter((y) => snowMan(E, s, y)).length >= 8,
    cast: (c) => { const { E, s, seat: p } = c; const room = freeAv(E, s, p); const pool = s.P[p].deck.filter((y) => snowMan(E, s, y)).sort((a, b) => (E.def(s, a).c || 0) - (E.def(s, b).c || 0)); const picks = c.interactive ? c.choose(pool, Math.min(room, pool.length), "เลือกทหารหิมะ (Cost รวมไม่เกิน 6)", { optional: true }) : pool;
      const ts = []; let sum = 0; for (const y of picks) { const k = E.def(s, y).c || 0; if (ts.length < room && sum + k <= 6) { ts.push(y); sum += k; } }
      return { explain: ts.length ? `อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ")} (Cost รวม ${sum})` : "ไม่มีทหารหิมะใน Deck", ops: [...ts.map((y) => ({ op: "put", i: y.i })), { op: "shuffle", seat: p }, ...(ts.length ? [{ op: "atEnd", turn: s.turn, why: "พายุหิมะเริงระบำ: ทหารหิมะลงนรก", ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "hell", onlyFrom: "av" })), { op: "putNamed", seat: p, from: "deck", name: "ราชาหิมะ", shuffle: true }] }] : [])] }; } },
  // ศิลาหยินหยาง: flip our LIFE (free while สาหัส): ตั๊กแตนหยิน or ตั๊กแตนหยาง from the Deck
  "BT10-059": { canCast: (E, s, p) => E.avatars(s.P[p]) < 4 && s.P[p].deck.some((y) => isAv(E, s, y) && (E.named(s, y, "ตั๊กแตนหยิน") || E.named(s, y, "ตั๊กแตนหยาง"))),
    cast: (c) => { const { E, s, seat: p } = c; const opts = ["ตั๊กแตนหยิน", "ตั๊กแตนหยาง"].filter((n) => s.P[p].deck.some((y) => isAv(E, s, y) && E.named(s, y, n))); if (!opts.length) return { explain: "", ops: [] }; const best = Math.max(0, opts.indexOf(s.P[p].av.some((y) => E.named(s, y, "ตั๊กแตนหยิน")) ? "ตั๊กแตนหยาง" : "ตั๊กแตนหยิน"));
      const n = opts[c.mode(opts.map((o, k) => `${k + 1}) อัญเชิญ ${o} จาก Deck`), "ศิลาหยินหยาง", best)]; const t = s.P[p].deck.find((y) => isAv(E, s, y) && E.named(s, y, n)); const crit = E.critical(s.P[p]);
      return { explain: `${crit ? "" : "หงาย LIFE 1 ใบ · "}อัญเชิญ ${E.name(s, t)}`, ops: [...(crit ? [] : [{ op: "lifeFlip", seat: p }]), { op: "put", i: t.i }, { op: "shuffle", seat: p }] }; } },
  // ผู้มาเยือน: discard a {เอเลี่ยน}: a {เอเลี่ยน} of base Cost ≤4 from the Deck, and this card is worn by it; if it leaves, the wearer goes to hell
  "BT10-060": { leaveKillsHost: true, canCast: (E, s, p) => E.avatars(s.P[p]) < 4 && s.P[p].hand.filter((y) => sy(E, s, y, "เอเลี่ยน") && E.def(s, y).n !== "ผู้มาเยือน").length > 0 && s.P[p].deck.some((y) => isAv(E, s, y) && sy(E, s, y, "เอเลี่ยน") && ((s.cards[y.c] || {}).c || 0) <= 4),
    cast: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose(s.P[p].hand.filter((y) => sy(E, s, y, "เอเลี่ยน")).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดเอเลี่ยน 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "เอเลี่ยน") && ((s.cards[y.c] || {}).c || 0) <= 4)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกเอเลี่ยน Cost ตั้งต้นไม่เกิน 4 จาก Deck", { exact: true })[0];
      if (!pay || !t) return { explain: "", ops: [] }; return { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)} แล้วสวมใส่การ์ดใบนี้`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "shuffle", seat: p }, ...(x ? [{ op: "attach", i: x.i, on: t.i }] : [])] }; } },
  // ไปคุยกับรากมะม่วง: destroy a มะม่วง of ours: destroy a card on the opponent's field
  "BT10-063": { react: { kinds: ANYR, can: (E, s, p) => s.P[p].av.some((y) => mango(E, s, y)) && foeField(E, s, p).length > 0, botV: (E, s, q) => { const t = foeField(E, s, q).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; const m = s.P[q].av.filter((y) => mango(E, s, y)).sort(cheapCard(E, s))[0]; return t && m && worth(E, s, t) > worth(E, s, m) ? 3 : -2; } },
    cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].av.filter((y) => mango(E, s, y)).sort(cheapCard(E, s)), 1, "ทำลาย มะม่วง ฝ่ายเรา 1 ใบ", { exact: true })[0]; const t = c.choose(foeField(E, s, p).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดบนสนามฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
      return pay ? { explain: `ทำลาย ${E.name(s, pay)}${t ? " · ทำลาย " + E.name(s, t) : ""}`, ops: [{ op: "destroy", i: pay.i, why: "ไปคุยกับรากมะม่วง" }, ...(t ? [{ op: "destroy", i: t.i, why: "ไปคุยกับรากมะม่วง" }] : [])] } : { explain: "", ops: [] }; } },
  // วิชานินจา ผนึกเงา: only ninjas on our zone: an opposing Avatar cannot change state this turn
  "BT10-064": { react: { kinds: ANYR, can: (E, s, p) => onlyNinja(E, s, p) && s.P[1 - p].av.some((y) => !E.noAim(s, y)), botV: (E, s, q, on) => (on.kind === "battle" && s.P[1 - q].av.some((y) => y.a && E.power(s, y) >= 4) ? 3 : -1) },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} เปลี่ยนสภาพไม่ได้จนจบเทิร์น`, ops: [{ op: "flagSet", i: t.i, k: "frz" }] } : { explain: "", ops: [] }; } },
  // วิชานินจา รุกรับพลิกผัน: only ninjas: a ninja gains เตะไข่, or is exiled and comes back at the End Phase
  "BT10-065": { react: { kinds: ANYR, can: (E, s, p) => onlyNinja(E, s, p), botV: (E, s, q, on) => (on.kind === "attack" && on.tk === "av" && (E.locate(s, on.ti) || {}).p === q ? 3 : -1) },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const hit = on.kind === "attack" && on.tk === "av" && (E.locate(s, on.ti) || {}).p === p ? E.locate(s, on.ti).x : null; const t = c.choose(s.P[p].av.filter((y) => ninja(E, s, y)).sort((a, b) => (b === hit ? 1 : 0) - (a === hit ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "เลือกนินจาฝ่ายเรา", { exact: true })[0]; if (!t) return { explain: "", ops: [] };
      const att = hit && t === hit ? E.locate(s, on.att) : null; const lose = !!att && E.power(s, att.x) >= E.power(s, t); const m = c.mode(["1) ได้รับ เตะไข่ จนจบเทิร์น", "2) เนรเทศ แล้วกลับมาในช่วง End Phase"], "วิชานินจา รุกรับพลิกผัน", lose ? 1 : 0);
      return m === 0 ? { explain: `${E.name(s, t)} ได้รับ เตะไข่`, ops: [{ op: "keyword", i: t.i, k: "เตะไข่", until: "turn" }] } : { explain: `เนรเทศ ${E.name(s, t)} · กลับมาในช่วง End Phase`, ops: [{ op: "exile", i: t.i }, { op: "atEnd", turn: s.turn, why: `${E.name(s, t)} กลับมาจากมิติมืด`, ops: [{ op: "move", i: t.i, to: "av", onlyFrom: "dark", seat: p }] }] }; } },
  // คาถา โปเตกโต้: our fighting จอมเวทย์ +2 per คาถา in our hell for the fight
  "BT10-066": { react: { kinds: ["attack", "react"], can: (E, s, p) => !!s.pend && s.pend.tk === "av" && [s.pend.att, s.pend.ti].some((i) => { const L = E.locate(s, i); return !!L && L.p === p && wizard(E, s, L.x); }) && s.P[p].hell.some((y) => spell(E, s, y)), botV: (E, s, q) => 2 * s.P[q].hell.filter((y) => spell(E, s, y)).length - 1 },
    cast: (c) => { const { E, s, seat: p } = c; const L = s.pend ? [s.pend.att, s.pend.ti].map((i) => E.locate(s, i)).find((L) => L && L.p === p && wizard(E, s, L.x)) : null; const n = 2 * s.P[p].hell.filter((y) => spell(E, s, y)).length; return L && n ? { explain: `${E.name(s, L.x)} POWER +${n} จนจบการต่อสู้`, ops: [{ op: "power", i: L.x.i, n, temp: "fight" }] } : { explain: "", ops: [] }; } },
  // หยินหยางทอร์นาโด: only ตั๊กแตนหยิน/หยาง · wearer attacks and wins: use a face-up LIFE of ours now
  "BT10-068": { modOnly: (E, s, h) => E.named(s, h, "ตั๊กแตนหยิน") || E.named(s, h, "ตั๊กแตนหยาง"), hostWin: (c) => useLife(c, true) },
  // อาวุธของเพมมุ ดาบมารไร้พ่าย: เพมมุ only, +1 · wearer attacks and wins: destroy an opposing Avatar of base POWER ≤ the loser's, then may destroy this and wake a เพมมุ
  "BT10-069": { modOnly: (E, s, h) => { const L = E.locate(s, h.i); return E.named(s, h, "เพมมุ") && !(L && s.P[L.p].mg.some((z) => z.on != null && E.named(s, z, "อาวุธของเพมมุ"))); }, worn: () => 1,
    hostWin: (c) => { const { E, s, seat: p, self: m } = c; const dp = c.t.dp | 0; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && (E.def(s, y).pw || 0) <= dp).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar POWER ตั้งต้นไม่เกิน ${dp}`, { exact: true })[0];
      const host = m && m.on != null ? E.locate(s, m.on) : null; const wake = [...(host ? [host.x] : []), ...s.P[p].av].find((y) => !y.a && E.named(s, y, "เพมมุ")); const more = wake && m && c.mode(["ทำลายการ์ดใบนี้: เปลี่ยนสภาพ เพมมุ เป็นสภาพตื่น", "ไม่ทำ"], "ดาบมารไร้พ่าย", 0) === 0;
      return { explain: `${t ? "ทำลาย " + E.name(s, t) : "ไม่มีเป้าหมาย"}${more ? ` · ทำลายดาบ · ${E.name(s, wake)} ตื่น` : ""}`, ops: [...(t ? [{ op: "destroy", i: t.i, why: "ดาบมารไร้พ่าย" }] : []), ...(more ? [{ op: "move", i: m.i, to: "hell" }, { op: "wake", i: wake.i }] : [])] }; } },
  // ดินแดนยุติธรรม: with a เพมมุ/สไปรท์ in [Link]: our เพมมุ Avatars cannot be removed by the opponent except by fights
  "BT10-070": { guard: (E, s, y, Ly, x, L) => Ly.z === "land" && L.z === "av" && L.p === Ly.p && s.P[Ly.p].av.some((z) => z.lk && pemmu(E, s, z)) && (E.named(s, x, "เพมมุ") || textHas(E, s, x, "เพมมุ")) },
  // Myth Universe Podcast: once per turn show an Avatar from the hand: up to 2 of ours sharing one of its values +2, then exile the shown card
  "BT10-071": { activate: { label: "แสดง Avatar บนมือ: Avatar ที่มีข้อมูลเดียวกัน POWER +2", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.some((h) => isAv(E, s, h) && podAttrs.some(([, f]) => s.P[L.p].av.some((y) => f(E, s, h, y)))),
    run: (c) => { const { E, s, seat: p } = c; const rate = (h) => Math.max(...podAttrs.map(([, f]) => Math.min(2, s.P[p].av.filter((y) => f(E, s, h, y)).length))) * 10 - worth(E, s, h); const h = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && podAttrs.some(([, f]) => s.P[p].av.some((z) => f(E, s, y, z)))).sort((a, b) => rate(b) - rate(a)), 1, "เลือก Avatar บนมือมาแสดง", { exact: true })[0]; if (!h) return { explain: "", ops: [] };
      const ok = podAttrs.filter(([, f]) => s.P[p].av.some((y) => f(E, s, h, y))); const best = ok.reduce((b, a, k) => (s.P[p].av.filter((y) => a[1](E, s, h, y)).length > s.P[p].av.filter((y) => ok[b][1](E, s, h, y)).length ? k : b), 0); const [lab, f] = ok[c.mode(ok.map(([l]) => l), `ข้อมูลของ ${E.name(s, h)}`, best)];
      const ts = c.choose(s.P[p].av.filter((y) => f(E, s, h, y)).sort(strongFirst(E, s)), 2, `เลือก Avatar ที่มี${lab}เดียวกัน (1-2 ใบ)`, {}); return ts.length ? { explain: `แสดง ${E.name(s, h)} (${lab}) · ${ts.map((y) => E.name(s, y)).join(", ")} POWER +2 · เนรเทศการ์ดที่แสดง`, ops: [...ts.map((y) => ({ op: "power", i: y.i, n: 2, temp: true })), { op: "exile", i: h.i }] } : { explain: "", ops: [] }; } } },
  // หอสมุดจอมเวทย์: once per turn one more คาถา this turn · with a จอมเวทย์ the opponent cannot target it
  "BT10-072": { activate: { label: "เทิร์นนี้ใช้ คาถา เพิ่มได้ 1 ใบ", can: (E, s, x, L) => L.z === "cs" && s.phase === "main", run: (c) => ({ explain: "เทิร์นนี้ใช้ Magic คาถา เพิ่มได้ 1 ใบ", ops: [{ op: "extraN", seat: c.seat, only: "คาถา" }] }) },
    untargetable: (E, s, x, L) => L.z === "cs" && s.P[L.p].av.some((y) => wizard(E, s, y)) },
  // ดวงจันทร์วันเพ็ญ: ค่ายบางระจัน Avatars +1 and โล่มนุษย์ · with one of ours it cannot be destroyed by abilities
  "BT10-073": { aura: (E, s, src, L) => (L.z === "cs" ? [0, 1].map((q) => ({ seat: q, test: (y) => bangText(E, s, y), n: 1, kw: ["โล่มนุษย์"] })) : []), noDestroy: (E, s, x, L) => L.z === "cs" && s.P[L.p].av.some((y) => bangText(E, s, y)) },
  // ZeedZad Server: Cost 0 with 2+ แก๊งขยะ names on our zone · our แก๊งขยะ gain ลูกฮึด
  "BT10-074": { selfCost: (E, s, x, p) => (gangNames(E, s, p) >= 2 ? -(E.def(s, x).c || 0) : 0), aura: (E, s, src, L) => (L.z === "cs" ? [{ seat: L.p, test: (y) => gang(E, s, y), n: 0, kw: ["ลูกฮึด"] }] : []) },
});

// ---------- BT11 ----------
const wornOn = (s, y) => [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === y.i);
const knightAll = (E, s, p) => s.P[p].av.length > 0 && s.P[p].av.every((z) => ["อัศวินตลิ่งชัน", "เซอร์นัท", "ไอ้นัท"].some((n) => E.named(s, z, n)));
const nutOk = (E, s, y, Ly) => Ly.z === "av" && once(s, Ly.p, "เซอร์นัท:" + y.i) && knightAll(E, s, Ly.p) && wornOn(s, y).length >= 2;
const nutCounter = (c, mi) => { const { E, s, seat: p, self: x } = c; const M = mi != null ? E.locate(s, mi) : null; if (!x || !M || !nutOk(E, s, x, E.locate(s, x.i))) return { explain: "", ops: [] };
  const pay = c.choose(wornOn(s, x).sort((a, b) => (E.named(s, a, "ไอ้นัท") ? 1 : 0) - (E.named(s, b, "ไอ้นัท") ? 1 : 0) || cheapCard(E, s)(a, b)), 2, "เลือกการ์ดที่สวมใส่อยู่ 2 ใบ เพื่อเนรเทศ", { exact: true }); if (pay.length < 2) return { explain: "", ops: [] };
  if (c.mode(["ไม่ใช้", `เนรเทศ 2 ใบ: ยกเลิกความสามารถของ ${E.name(s, M.x)}`], E.name(s, x), E.def(s, M.x).t === "M" || worth(E, s, M.x) >= 3 ? 1 : 0) !== 1) return { explain: "ไม่ใช้", ops: [] };
  return { explain: `เนรเทศ ${pay.map((y) => E.name(s, y)).join(", ")} · ยกเลิก ${E.name(s, M.x)}`, ops: [{ op: "nameOnce", seat: p, name: "เซอร์นัท:" + x.i }, ...pay.map((y) => ({ op: "exile", i: y.i })), { op: "cancelTrig", i: M.x.i, cast: true }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "mg" }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "land" }] }; };
// เซอร์นัท cards also get the abilities of the ไอ้นัท they wear (คนบ้าจั่ว draws on attack, คนข้ามเวลา brings another ไอ้นัท)
const nutDraws = (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const ds = wornOn(s, x).filter((m) => E.def(s, m).n === "ไอ้นัท - คนบ้าจั่ว" && once(s, p, "ไอ้นัท:" + m.i)); return ds.length ? { explain: `จั่ว ${ds.length} ใบ (ความสามารถของไอ้นัทที่สวมใส่)`, ops: [...ds.map((m) => ({ op: "nameOnce", seat: p, name: "ไอ้นัท:" + m.i })), { op: "draw", seat: p, n: ds.length }] } : { explain: "", ops: [] }; };
const nutTravel = { label: "นำไอ้นัท (ไม่ใช่ คนข้ามเวลา) จากนรกมาสวมใส่ (ความสามารถของไอ้นัท คนข้ามเวลา)", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && wornOn(s, x).some((m) => E.def(s, m).n === "ไอ้นัท คนข้ามเวลา") && s.P[L.p].hell.some((y) => E.named(s, y, "ไอ้นัท") && E.def(s, y).n !== "ไอ้นัท คนข้ามเวลา"),
  run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].hell.filter((y) => E.named(s, y, "ไอ้นัท") && E.def(s, y).n !== "ไอ้นัท คนข้ามเวลา").sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกไอ้นัทในนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} สวมใส่ให้ ${E.name(s, x)}`, ops: [{ op: "attach", i: t.i, on: x.i }] } : { explain: "", ops: [] }; } };
Object.assign(SCRIPTS["BT08-010"], { attack: nutDraws, activate: nutTravel });
SCRIPTS["BT04-003"] = { ...(SCRIPTS["BT04-003"] || {}), keepControl: true };
const city = (E, s, p) => s.P[p].cs.some((y) => E.named(s, y, "นครทิเนนทอล"));
const cityGun = (E, s, x) => E.def(s, x).t === "M" && E.named(s, x, "อาวุธนคร");
const gunman = (E, s, x) => isAv(E, s, x) && E.named(s, x, "มือปืนนคร");
const sama = (E, s, x) => isAv(E, s, x) && E.named(s, x, "สมาชม");
const samaN = (E, s, p) => s.P[p].av.filter((y) => sama(E, s, y)).length;
const tang = ["พระถังซัมจั๋ง", "ซุนหงอคง", "ตือโป๊ยก่าย", "ซัวเจ๋ง"];
const tangIn = (E, s, p, names = tang) => names.filter((n) => s.P[p].av.some((y) => E.named(s, y, n)));
const appliance = (E, s, x) => isAv(E, s, x) && E.named(s, x, "เครื่องใช้ไฟฟ้า");
const otaField = (E, s) => [0, 1].flatMap((q) => [...s.P[q].av, ...s.P[q].mg]).filter((y) => E.named(s, y, "โอตะ") && isAv(E, s, y));
const unitXVI = (E, s, x) => isAv(E, s, x) && E.named(s, x, "หน่วยรบ XVI");
const virusAv = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ไวรัส");
const odAv = (E, s, x) => isAv(E, s, x) && (E.named(s, x, "Overdose") || textHas(E, s, x, "Overdose"));
const deathToMg = (c, needOpp = true) => { const { E, s, self: x } = c; return x && (c.t.z == null || c.t.z === "av") && E.locate(s, x.i)?.z === "hell" && (!needOpp || c.t.fromOpp) ? { explain: `${E.name(s, x)} ไปวางไว้บน Magic Zone`, ops: [{ op: "move", i: x.i, to: "mg", seat: c.seat }] } : { explain: "", ops: [] }; };
const fromMgSummon = { label: "ทิ้งการ์ดบนมือ 2 ใบ: อัญเชิญจาก Magic Zone", can: (E, s, x, L) => L.z === "mg" && x.on == null && s.phase === "main" && s.P[L.p].hand.length >= 2 && E.avatars(s.P[L.p]) < 4,
  run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); return pay.length === 2 ? { explain: `ทิ้ง 2 ใบ · อัญเชิญ ${E.name(s, x)} จาก Magic Zone`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "put", i: x.i, here: true }] } : { explain: "", ops: [] }; } };
const modeBeser = (form) => (E, s, p) => { const P = s.P[p]; return P.mg.some((m) => m.on == null && E.def(s, m).n === "มนุษย์เครื่องใช้ไฟฟ้า เบเซอร์") && P.mg.some((m) => m.on == null && E.def(s, m).n === form) && E.avatars(P) < 4; };
const beserSwap = (c, form, kw) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const a = P.mg.find((m) => m.on == null && E.def(s, m).n === "มนุษย์เครื่องใช้ไฟฟ้า เบเซอร์"), b = P.mg.find((m) => m.on == null && E.def(s, m).n === form); if (!a || !b || !x) return { explain: "", ops: [] };
  return { explain: `${E.name(s, a)} และ ${E.name(s, b)} กลับเข้า Deck · อัญเชิญ ${E.name(s, x)} (ได้รับ ${kw})`, ops: [{ op: "move", i: a.i, to: "deckBottom" }, { op: "move", i: b.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "put", i: x.i }, { op: "keyword", i: x.i, k: kw }, { op: "flagSet", i: x.i, k: "own", v: true }] }; };
Object.assign(SCRIPTS, {
  // ฤาษีอังคต: once per turn when we use a {ฤษี} Magic: a {สัตว์} Avatar — theirs is destroyed, ours +2 and สามัคคี
  "BT11-001": { magicSeenOk: (E, s, y, Ly, d, by) => Ly.z === "av" && by === Ly.p && String(d.sy || "").includes("ฤษี") && once(s, Ly.p, "ฤาษีอังคต") && [...s.P[0].av, ...s.P[1].av].some((z) => sy(E, s, z, "สัตว์")),
    magicSeen: (c) => { const { E, s, seat: p } = c; if (!once(s, p, "ฤาษีอังคต")) return { explain: "", ops: [] }; const mine = (y) => (E.locate(s, y.i) || {}).p === p; const t = c.choose([...s.P[1 - p].av.filter((y) => sy(E, s, y, "สัตว์") && !E.noAim(s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), ...s.P[p].av.filter((y) => sy(E, s, y, "สัตว์")).sort(strongFirst(E, s))], 1, "เลือก Avatar สัตว์ 1 ใบ", { exact: true })[0];
      if (!t) return { explain: "", ops: [] }; return mine(t) ? { explain: `${E.name(s, t)} POWER +2 และได้รับ สามัคคี`, ops: [{ op: "nameOnce", seat: p, name: "ฤาษีอังคต" }, { op: "power", i: t.i, n: 2, temp: true }, { op: "keyword", i: t.i, k: "สามัคคี", until: "turn" }] } : { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "nameOnce", seat: p, name: "ฤาษีอังคต" }, { op: "destroy", i: t.i, why: "ฤาษีอังคต" }] }; } },
  // เซอร์นัท ผู้นำแห่งอัศวินตลิ่งชัน: จุติ a ไอ้นัท from hell worn · counter the opponent's ability by exiling 2 worn cards (only knights on our zone) · +1 per worn card · inherits worn ไอ้นัท
  "BT11-003": { summon: (c) => { const { E, s, seat: p, self: x } = c; const n = [...s.P[p].hell].reverse().find((y) => E.named(s, y, "ไอ้นัท")); return n && x ? { explain: `${E.name(s, n)} จากนรกสวมใส่ให้การ์ดใบนี้`, ops: [{ op: "attach", i: n.i, on: x.i }] } : { explain: "ไม่มีไอ้นัทในนรก", ops: [] }; },
    magicSeenOk: (E, s, y, Ly, d, by) => by !== Ly.p && nutOk(E, s, y, Ly), magicSeen: (c) => nutCounter(c, c.t.mi), oppAbilityOk: (E, s, y, Ly) => nutOk(E, s, y, Ly), oppAbility: (c) => nutCounter(c, c.t.ai),
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: wornOn(s, src).length }] : []), attack: nutDraws, activate: nutTravel },
  // มือปืนนคร บ่าวจุ้ย: one copy, no same-name อาวุธนคร · after its attack (with นครทิเนนทอล): swap a worn อาวุธนคร with another from the dark zone and wake
  "BT11-004": { uniq: true, uniqWear: true, atkEndOk: (E, s, x, A) => once(s, A.p, "บ่าวจุ้ย") && city(E, s, A.p) && wornOn(s, x).some((m) => cityGun(E, s, m)) && s.P[A.p].dark.some((y) => cityGun(E, s, y) && !wornOn(s, x).some((m) => E.def(s, m).n === E.def(s, y).n)),
    atkEnd: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const old = c.choose(wornOn(s, x).filter((m) => cityGun(E, s, m)).sort(cheapCard(E, s)), 1, "เลือกอาวุธนครที่สวมใส่อยู่เพื่อเนรเทศ", { exact: true })[0]; if (!old) return { explain: "", ops: [] };
      const nw = c.choose(uniq(E, s, s.P[p].dark.filter((y) => cityGun(E, s, y) && E.def(s, y).n !== E.def(s, old).n && !wornOn(s, x).some((m) => m !== old && E.def(s, m).n === E.def(s, y).n))), 1, "เลือกอาวุธนครจากมิติมืด", { exact: true })[0]; if (!nw) return { explain: "", ops: [] };
      if (c.mode(["ไม่ใช้", `เนรเทศ ${E.name(s, old)} · สวมใส่ ${E.name(s, nw)} แล้วตื่น`], "มือปืนนคร บ่าวจุ้ย", 1) !== 1) return { explain: "ไม่ใช้", ops: [] };
      return { explain: `เนรเทศ ${E.name(s, old)} · ${E.name(s, nw)} สวมใส่ · กลับมาตื่น`, ops: [{ op: "nameOnce", seat: p, name: "บ่าวจุ้ย" }, { op: "exile", i: old.i }, { op: "attach", i: nw.i, on: x.i }, { op: "wake", i: x.i }] }; } },
  // มือปืนนคร ชานน: จุติ with นครทิเนนทอล: an อาวุธนคร from the Deck to the dark zone
  "BT11-005": { uniqWear: true, summon: (c) => { const { E, s, seat: p } = c; if (!city(E, s, p)) return { explain: "ไม่มี นครทิเนนทอล", ops: [] }; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => cityGun(E, s, y))), 1, "เลือกอาวุธนครจาก Deck ไปไว้ที่มิติมืด", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไปไว้ที่มิติมืด`, ops: [{ op: "exile", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มีอาวุธนครใน Deck", ops: [{ op: "shuffle", seat: p }] }; } },
  // มือปืนนคร นายหัว: จุติ build นครทิเนนทอล · once per turn exile an อาวุธนคร from the hand: draw 2
  "BT11-006": { uniqWear: true, summon: (c) => { const { E, s, seat: p } = c; if (s.P[p].cs.length >= 3) return { explain: "", ops: [] }; const h = s.P[p].hell.find((y) => E.named(s, y, "นครทิเนนทอล")); const d = h ? null : s.P[p].deck.find((y) => E.named(s, y, "นครทิเนนทอล")); const t = h || d;
      return t ? { explain: `ก่อสร้าง ${E.name(s, t)}`, ops: [{ op: "move", i: t.i, to: "cs", seat: p }, ...(d ? [{ op: "shuffle", seat: p }] : [])] } : { explain: "ไม่มี นครทิเนนทอล", ops: [] }; },
    activate: { label: "เนรเทศอาวุธนครจากมือ: จั่ว 2 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && city(E, s, L.p) && s.P[L.p].hand.some((y) => cityGun(E, s, y)),
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => cityGun(E, s, y)), 1, "เลือกอาวุธนครบนมือ", { exact: true })[0]; return t ? { explain: `เนรเทศ ${E.name(s, t)} · จั่ว 2 ใบ`, ops: [{ op: "exile", i: t.i }, { op: "draw", seat: p, n: 2 }] } : { explain: "", ops: [] }; } } },
  // กิมมิคแมน: จุติ scout 3; one of them at random to our hand, the rest back and shuffled
  "BT11-007": { summon: (c) => { const { s, seat: p } = c; const top = s.P[p].deck.slice(0, 3); return top.length ? { explain: `สอดแนม ${top.length} ใบ · ฝ่ายตรงข้ามสุ่มเลือก 1 ใบขึ้นมือ`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, { op: "randomPick", seat: p, ids: top.map((y) => y.i), shuffle: true }] } : { explain: "", ops: [] }; } },
  // ออส่วนบอย: only กิมมิคแมน can be attacked · กิมมิคแมน destroyed in the opponent's turn: base POWER 6
  "BT11-008": { tauntFor: (E, s, z, y) => E.named(s, y, "กิมมิคแมน"), allyOk: (E, s, y, Ly, x) => Ly.z === "av" && E.named(s, x, "กิมมิคแมน") && s.active !== Ly.p, allyDeath: (c) => (c.self ? { explain: "POWER ตั้งต้นเป็น 6", ops: [{ op: "ovSet", i: c.self.i, ov: { pw: 6 } }] } : { explain: "", ops: [] }) },
  // นักฆ่าแม่เหล็ก มอนซี: discard a {หุ่นยนต์} Avatar: a foe -4 · with another {หุ่นยนต์} it is not destroyed in fights
  "BT11-009": { activate: { label: "ทิ้ง Avatar หุ่นยนต์: Avatar ฝ่ายตรงข้าม POWER -4", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.some((y) => isAv(E, s, y) && sy(E, s, y, "หุ่นยนต์")) && s.P[1 - L.p].av.some((y) => !E.noAim(s, y)),
      run: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && sy(E, s, y, "หุ่นยนต์")).sort(cheapCard(E, s)), 1, "ทิ้ง Avatar หุ่นยนต์ 1 ใบ", { exact: true })[0]; const t = c.choose(bestFoe(E, s, p), 1, "เลือก Avatar ฝ่ายตรงข้าม POWER -4", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} POWER -4`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "power", i: t.i, n: -4, temp: true }] } : { explain: "", ops: [] }; } },
    fightImmune: (E, s, x) => { const L = E.locate(s, x.i); return !!L && s.P[L.p].av.some((y) => y.i !== x.i && sy(E, s, y, "หุ่นยนต์") && E.name(s, y) !== E.name(s, x)); } },
  // มิสทรอม่า: จุติ destroy their Land, use ดินแดนยุติธรรม from the Deck, no Lands for them until the end of their next turn · +1 with a [Link] (+2 if เพมมุ/สไปรท์)
  "BT11-011": { summon: (c) => { const { E, s, seat: p } = c; const foe = E.lands(s).find((l) => l.o === 1 - p) || null; const t = s.P[p].deck.find((y) => E.named(s, y, "ดินแดนยุติธรรม"));
      return { explain: `${foe ? "ทำลาย " + E.name(s, foe) + " · " : ""}${t ? "ใช้ " + E.name(s, t) + " · " : ""}ฝ่ายตรงข้ามใช้ Land ไม่ได้จนจบเทิร์นถัดไปของเขา`, ops: [...(foe ? [{ op: "destroy", i: foe.i, why: "มิสทรอม่า" }] : []), ...(t ? [{ op: "toLand", i: t.i }, { op: "shuffle", seat: p }] : []), { op: "stateSet", k: "landLock", why: "มิสทรอม่า: ฝ่ายตรงข้ามใช้ Land Magic ไม่ได้จนจบเทิร์นถัดไปของเขา" }] }; },
    aura: (E, s, src, L) => { if (L.z !== "av") return []; const lk = s.P[L.p].av.filter((y) => y.lk); return lk.length ? [{ seat: L.p, test: (y) => y.i === src.i, n: lk.some((y) => pemmu(E, s, y)) ? 2 : 1 }] : []; } },
  // ซุนหงอคง: with พระถังซัมจั๋ง: +2 and พระถังซัมจั๋ง cannot be attacked or targeted by the opponent
  "BT11-013": { aura: (E, s, src, L) => (L.z === "av" && tangIn(E, s, L.p, ["พระถังซัมจั๋ง"]).length ? [{ seat: L.p, test: (y) => y.i === src.i, n: 2 }] : []), guardOthers: (E, s, y, t) => E.named(s, t, "พระถังซัมจั๋ง"),
    noAim: (E, s, src, Ls, x) => Ls.z === "av" && E.named(s, x, "พระถังซัมจั๋ง") },
  // ชาช่า: attacking: +1 per ไอ้นัท / เซอร์นัท on our field
  "BT11-018": { attack: (c) => { const { E, s, seat: p, self: x } = c; const n = [...s.P[p].av, ...s.P[p].mg].filter((y) => E.named(s, y, "ไอ้นัท") || E.named(s, y, "เซอร์นัท")).length; return x && n ? { explain: `POWER +${n} จนจบเทิร์น`, ops: [{ op: "power", i: x.i, n, temp: true }] } : { explain: "", ops: [] }; } },
  // มีมมิ: from hell worn by our ไอ้นัท / เซอร์นัท (counts as our Mod) · the wearer's opponent becomes purple for the fight
  "BT11-019": { activate: { label: "จากนรก: สวมใส่ให้ ไอ้นัท หรือ เซอร์นัท", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && !s.mu[L.p].D && s.P[L.p].av.some((y) => E.named(s, y, "ไอ้นัท") || E.named(s, y, "เซอร์นัท")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => E.named(s, y, "ไอ้นัท") || E.named(s, y, "เซอร์นัท")).sort(strongFirst(E, s)), 1, "เลือก ไอ้นัท หรือ เซอร์นัท", { exact: true })[0]; return t ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, t)} (นับเป็นการใช้ Modification Magic)`, ops: [{ op: "attach", i: x.i, on: t.i }, { op: "mu", k: "D" }] } : { explain: "", ops: [] }; } },
    foeColor: "ม่วง" },
  // ตัวอะไรสักอย่างที่สุดเท่และเป็นนักดาบ: once per turn +half the base POWER of another ตัวอะไรสักอย่าง
  "BT11-023": { activate: { label: "เพิ่ม POWER ครึ่งหนึ่งของ ตัวอะไรสักอย่าง ใบอื่น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i && E.named(s, y, "ตัวอะไรสักอย่าง") && (E.def(s, y).pw || 0) >= 2),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => y.i !== x.i && E.named(s, y, "ตัวอะไรสักอย่าง")).sort((a, b) => (E.def(s, b).pw || 0) - (E.def(s, a).pw || 0)), 1, "เลือก ตัวอะไรสักอย่าง", { exact: true })[0]; const n = t ? Math.floor((E.def(s, t).pw || 0) / 2) : 0; return n ? { explain: `POWER +${n} จนจบเทิร์น`, ops: [{ op: "power", i: x.i, n, temp: true }] } : { explain: "", ops: [] }; } } },
  // เพนกวิ้น ฮัท: from the hand while สาหัส and our LIFE is attacked: "ขอเทิร์นนึง" — cancel the attack and end their turn
  "BT11-024": { react: { kinds: ["attack"], can: (E, s, p, on) => on.tk === "life" && E.critical(s.P[p]), botV: () => 40 },
    handReact: (c) => ({ explain: `"ขอเทิร์นนึง" · เนรเทศ ${c.E.name(c.s, c.self)} · ยกเลิกการโจมตีและจบเทิร์นฝ่ายตรงข้าม`, ops: [{ op: "exile", i: c.self.i }, { op: "cancelAttack" }, { op: "endNow" }] }) },
  // ซัวเจ๋ง: from hell with 2+ of พระถังซัมจั๋ง / ซุนหงอคง / ตือโป๊ยก่าย, discard 1: summoned
  "BT11-025": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญจากนรก", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.length > 0 && tangIn(E, s, L.p, tang.slice(0, 3)).length >= 2,
    run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: x.i }] } : { explain: "", ops: [] }; } } },
  // ลุกซุเรีย: from the hand send 1-3 โอตะ to hell: summoned, +1 each · once per turn a โอตะ to hell: +2 · attacking: a โอตะ from our hell worn
  "BT11-026": { activate: { label: "ส่ง โอตะ ลงนรก", can: (E, s, x, L) => s.phase === "main" && otaField(E, s).length > 0 && ((L.z === "hand" && E.avatars(s.P[L.p]) < 4) || L.z === "av"),
      run: (c) => { const { E, s, seat: p, self: x } = c; const L = E.locate(s, x.i); const pool = otaField(E, s).sort((a, b) => (E.locate(s, b.i).p !== p ? 1 : 0) - (E.locate(s, a.i).p !== p ? 1 : 0));
        if (L.z === "hand") { const ts = c.choose(pool, 3, "เลือก โอตะ บนสนาม 1-3 ใบ ส่งลงนรก", {}); return ts.length ? { explain: `ส่ง ${ts.length} ใบลงนรก · อัญเชิญ ${E.name(s, x)} POWER +${ts.length}`, ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "hell" })), { op: "put", i: x.i }, { op: "power", i: x.i, n: ts.length, temp: false }] } : { explain: "", ops: [] }; }
        const t = c.choose(pool, 1, "เลือก โอตะ ส่งลงนรก", { exact: true })[0]; return t ? { explain: `ส่ง ${E.name(s, t)} ลงนรก · POWER +2`, ops: [{ op: "move", i: t.i, to: "hell" }, { op: "power", i: x.i, n: 2, temp: true }] } : { explain: "", ops: [] }; } },
    attack: (c) => { const { E, s, seat: p, self: x } = c; if (!x || !once(s, p, "ลุกซุเรีย:" + x.i)) return { explain: "", ops: [] }; const t = s.P[p].hell.filter((y) => E.named(s, y, "โอตะ")).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `${E.name(s, t)} สวมใส่ให้การ์ดใบนี้`, ops: [{ op: "nameOnce", seat: p, name: "ลุกซุเรีย:" + x.i }, { op: "attach", i: t.i, on: x.i }] } : { explain: "", ops: [] }; } },
  // เจ้าแห่งความมืด: from the hand while they have 4+ Avatars: one of theirs to hell, summoned · our End Phase: base POWER halved
  "BT11-027": { activate: { label: "ส่ง Avatar ฝ่ายตรงข้าม 1 ใบลงนรก: อัญเชิญจากมือ", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].av.length >= 4,
      run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(bestFoe(E, s, p), 1, "เลือก Avatar ฝ่ายตรงข้ามส่งลงนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ลงนรก · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "move", i: t.i, to: "hell" }, { op: "put", i: x.i }] } : { explain: "", ops: [] }; } },
    endPhase: (E, s, x, L) => (L.z === "av" && s.active === L.p ? [{ op: "ovSet", i: x.i, ov: { pw: Math.floor((E.def(s, x).pw || 0) / 2) }, why: `${E.name(s, x)} POWER ตั้งต้นลดลงครึ่งหนึ่ง` }] : []) },
});
Object.assign(SCRIPTS, {
  // YaiMakMak (สมาชม): จุติ a สมาชม from the Deck · with 2+ สมาชม destroy one foe per other สมาชม, Cost ≤4 then ≤3 …
  "BT11-028": { uniq: true, summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => sama(E, s, y) && !s.P[p].av.some((z) => E.name(s, z) === E.def(s, y).n))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก สมาชม จาก Deck", { exact: true })[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มี สมาชม ใน Deck", ops: [{ op: "shuffle", seat: p }] }; },
    activate: { label: "ทำลาย Avatar ฝ่ายตรงข้าม Cost ต่ำ ตามจำนวนสมาชม", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && samaN(E, s, L.p) >= 2 && s.P[1 - L.p].av.some((y) => !E.noAim(s, y) && E.costNow(s, y) <= 4),
      run: (c) => { const { E, s, seat: p, self: x } = c; const k = s.P[p].av.filter((y) => y.i !== x.i && sama(E, s, y)).length; const picked = []; for (let j = 0; j < k; j++) { const lim = 4 - j; const t = c.choose(s.P[1 - p].av.filter((y) => !picked.includes(y) && !E.noAim(s, y) && E.costNow(s, y) <= lim).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${lim}`, { exact: true })[0]; if (!t) break; picked.push(t); }
        return picked.length ? { explain: `ทำลาย ${picked.map((y) => E.name(s, y)).join(", ")}`, ops: picked.map((y) => ({ op: "destroy", i: y.i, why: "YaiMakMak" })) } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } } },
  // แอชลีย์ (สมาชม): with 2+ สมาชม, discard 1: an Avatar from their hell (their pick) comes to our zone without abilities and leaves at the End Phase
  "BT11-029": { uniq: true, activate: { label: "ทิ้ง 1 ใบ: ยืม Avatar จากนรกฝ่ายตรงข้ามจนถึง End Phase", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && samaN(E, s, L.p) >= 2 && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[1 - L.p].hell.some((y) => isAv(E, s, y) && E.def(s, y).t === "A"),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = s.P[1 - p].hell.filter((y) => E.def(s, y).t === "A").sort(cheapCard(E, s))[0]; // the opponent gives their weakest
      return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ฝ่ายตรงข้ามเลือก ${E.name(s, t)} มาอยู่ฝ่ายเรา (ไร้ความสามารถ ลงนรกในช่วง End Phase)`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i, ctl: p }, { op: "mute", i: t.i, until: "oppturn" }, { op: "atEnd", turn: s.turn, why: `${E.name(s, t)} ลงนรก (แอชลีย์)`, ops: [{ op: "move", i: t.i, to: "hell", onlyFrom: "av" }] }] } : { explain: "", ops: [] }; } } },
  // น้าแมน (สมาชม): with 2+ สมาชม: flip the state of one of ours and one of theirs
  "BT11-030": { uniq: true, activate: { label: "เปลี่ยนสภาพ Avatar เราและฝ่ายตรงข้ามอย่างละ 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && samaN(E, s, L.p) >= 2 && s.P[1 - L.p].av.some((y) => !E.noAim(s, y)),
    run: (c) => { const { E, s, seat: p } = c; const a = c.choose([...s.P[p].av].sort((u, v) => (u.a ? 1 : 0) - (v.a ? 1 : 0) || E.power(s, v) - E.power(s, u)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; const b = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((u, v) => (v.a ? 1 : 0) - (u.a ? 1 : 0) || E.power(s, v) - E.power(s, u)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
      return a && b ? { explain: `เปลี่ยนสภาพ ${E.name(s, a)} และ ${E.name(s, b)}`, ops: [{ op: "toggle", i: a.i }, { op: "toggle", i: b.i }] } : { explain: "", ops: [] }; } } },
  // คุณคำดี (สมาชม): จุติ a สมาชม from the Deck · attacking with 2+ สมาชม: +1 per 2 Avatars in our hell for the fight · our Avatars -1
  "BT11-031": { uniq: true, summon: (c) => SCRIPTS["BT11-028"].summon(c), attack: (c) => { const { E, s, seat: p, self: x } = c; const n = Math.floor(s.P[p].hell.filter((y) => isAv(E, s, y)).length / 2); return x && samaN(E, s, p) >= 2 && n ? { explain: `POWER +${n} จนจบการต่อสู้`, ops: [{ op: "power", i: x.i, n, temp: "fight" }] } : { explain: "", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: () => true, n: -1 }] : []) },
  // ไมค์ตี้ทอยแมน: จุติ destroy a worn card, or scout 5 for a Mod
  "BT11-032": { summon: (c) => { const { E, s, seat: p } = c; const worn = [...s.P[1 - p].mg, ...s.P[p].mg].filter((m) => m.on != null && !E.noAim(s, m)); const m = c.mode(["1) ทำลายการ์ดที่สวมใส่อยู่ 1 ใบ", "2) สอดแนม 5 ใบ นำ Modification Magic ขึ้นมือ"], "ไมค์ตี้ทอยแมน", s.P[1 - p].mg.some((z) => z.on != null) ? 0 : 1);
    if (m === 0) { const t = c.choose(worn.sort((a, b) => ((E.locate(s, b.i) || {}).p !== p ? 1 : 0) - ((E.locate(s, a.i) || {}).p !== p ? 1 : 0)), 1, "เลือกการ์ดที่สวมใส่อยู่", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ไมค์ตี้ทอยแมน" }] } : { explain: "ไม่มีการ์ดที่สวมใส่อยู่", ops: [] }; }
    const { top, t } = scoutPick(c, 5, (y) => E.def(s, y).t === "M" && E.def(s, y).st === "D", "เลือก Modification Magic", { optional: true }); return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] }; } },
  // เลอร์ติ๊ก สหายอัศวินตลิ่งชัน: จุติ scout 5 for ไอ้นัท / เซอร์นัท / อัศวินตลิ่งชัน
  "BT11-033": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => isAv(E, s, y) && ["ไอ้นัท", "เซอร์นัท", "อัศวินตลิ่งชัน"].some((n) => E.named(s, y, n)), "เลือก ไอ้นัท เซอร์นัท หรือ อัศวินตลิ่งชัน", { optional: true });
    return top.length ? { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "shuffle")] } : { explain: "", ops: [] }; } },
  // ตือโป๊ยก่าย: once per turn when we use a Magic: the four pilgrims +1 until our next Draw Phase
  "BT11-035": { magicSeenOk: (E, s, y, Ly, d, by) => Ly.z === "av" && by === Ly.p && once(s, Ly.p, "ตือโป๊ยก่าย"), magicSeen: (c) => { const { E, s, seat: p } = c; const ts = s.P[p].av.filter((y) => tang.some((n) => E.named(s, y, n))); return { explain: `${ts.map((y) => E.name(s, y)).join(", ")} POWER +1 จนถึง Draw Phase ถัดไปของเรา`, ops: [{ op: "nameOnce", seat: p, name: "ตือโป๊ยก่าย" }, ...ts.map((y) => ({ op: "power", i: y.i, n: 1, temp: "next" }))] }; } },
  // ภูติผลไม้ แตงกวา: with ป่าพงไพร: +1 per ภูติผลไม้ in our dark zone · คำสั่งเสีย one of them back to the Deck
  "BT11-036": { aura: (E, s, src, L) => (L.z === "av" && E.lands(s).some((l) => E.named(s, l, "ป่าพงไพร เผ่าพงศ์พันธุ์")) ? [{ seat: L.p, test: (y) => y.i === src.i, n: s.P[L.p].dark.filter((y) => E.named(s, y, "ภูติผลไม้")).length }] : []),
    death: (c) => { const { E, s, seat: p } = c; if (!(E.lands(s).some((l) => E.named(s, l, "ป่าพงไพร เผ่าพงศ์พันธุ์")))) return { explain: "", ops: [] }; const t = s.P[p].dark.find((y) => E.named(s, y, "ภูติผลไม้")); return t ? { explain: `${E.name(s, t)} กลับเข้า Deck`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } },
  // มนุษย์เครื่องใช้ไฟฟ้า เบเซอร์: จุติ an appliance from the Deck to our Magic Zone · once per turn one from the hand there, then may draw 1 · destroyed by the opponent: to the Magic Zone
  "BT11-037": { summon: (c) => { const { E, s, seat: p } = c; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => appliance(E, s, y))).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก เครื่องใช้ไฟฟ้า จาก Deck มาวางบน Magic Zone", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไปวางไว้บน Magic Zone`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }, { op: "shuffle", seat: p }] } : { explain: "ไม่มีเครื่องใช้ไฟฟ้าใน Deck", ops: [{ op: "shuffle", seat: p }] }; },
    activate: { label: "เครื่องใช้ไฟฟ้า จากมือไปวางบน Magic Zone แล้วจั่ว 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.some((y) => appliance(E, s, y)), run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => appliance(E, s, y)), 1, "เลือก เครื่องใช้ไฟฟ้า บนมือ", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไปวางบน Magic Zone · จั่ว 1 ใบ`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }, { op: "draw", seat: p, n: 1 }] } : { explain: "", ops: [] }; } },
    death: (c) => deathToMg(c) },
  "BT11-038": { activate: fromMgSummon, death: (c) => deathToMg(c) },
  "BT11-039": { activate: fromMgSummon, death: (c) => deathToMg(c) },
  // เบเซอร์ โหมด เฟเธอร์: from the hand at the start of our Battle Phase, เบเซอร์ + เฟเธอร์ from our Magic Zone into the Deck: summoned with ลูกฮึด; +5 when attacking something 3+ stronger
  "BT11-040": { activate: { label: "เริ่ม Battle Phase: เบเซอร์ + เฟเธอร์ กลับเข้า Deck อัญเชิญ เบเซอร์ โหมด เฟเธอร์", battle: true, can: (E, s, x, L) => L.z === "hand" && s.phase === "battle" && !(s.atk && s.atk.t === s.turn) && modeBeser("เครื่องใช้ไฟฟ้า เฟเธอร์")(E, s, L.p), run: (c) => beserSwap(c, "เครื่องใช้ไฟฟ้า เฟเธอร์", "ลูกฮึด") },
    attack: (c) => { const { E, s, self: x } = c; if (!x || !x.own || !s.pend || s.pend.tk !== "av") return { explain: "", ops: [] }; const T = E.locate(s, s.pend.ti); return T && E.power(s, T.x) - E.power(s, x) >= 3 ? { explain: "เป้าหมายแรงกว่า 3 ขึ้นไป: POWER +5 จนจบเทิร์น", ops: [{ op: "power", i: x.i, n: 5, temp: true }] } : { explain: "", ops: [] }; } },
  // เบเซอร์ โหมด ฟรีซเซอร์: from the hand when the opponent's Battle Phase starts, เบเซอร์ + ฟรีซเซอร์ into the Deck: summoned with โล่มนุษย์; asleep, our other Avatars cannot be attacked
  "BT11-041": { react: { kinds: ["battle"], can: (E, s, p) => modeBeser("เครื่องใช้ไฟฟ้า ฟรีซเซอร์")(E, s, p), botV: (E, s, q) => (s.P[1 - q].av.some((y) => y.a) ? 4 : 0) }, handReact: (c) => beserSwap(c, "เครื่องใช้ไฟฟ้า ฟรีซเซอร์", "โล่มนุษย์"),
    guardOthers: (E, s, y) => !!y.own && !y.a },
  // อาเมอร์ ทศกัณฐ์: จุติ scout 5 for a POWER 3 {ยักษ์} or ทศกัณฐ์ · +2 with another ยักษ์ or มณโฑ, -2 without
  "BT11-042": { summon: (c) => { const { E, s, seat: p } = c; const room = E.avatars(s.P[p]) < 4; const { top, t } = scoutPick(c, 5, (y) => room && isAv(E, s, y) && ((sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3) || E.named(s, y, "ทศกัณฐ์")), "เลือกยักษ์ POWER 3 หรือ ทศกัณฐ์ อัญเชิญ", { optional: true });
      return top.length ? { explain: `สอดแนม ${top.length} ใบ${t ? ` · อัญเชิญ ${E.name(s, t)}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "put", i: t.i }] : []), ...restOps(p, top, t ? [t] : [], "shuffle")] } : { explain: "", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: s.P[L.p].av.some((y) => y.i !== src.i && (sy(E, s, y, "ยักษ์") || E.named(s, y, "มณโฑ"))) ? 2 : -2 }] : []) },
  // พิเภก: once per turn a POWER 3 {ยักษ์} from hell into the Deck: draw 1
  "BT11-043": { activate: { label: "ยักษ์ POWER 3 จากนรกกลับเข้า Deck: จั่ว 1 ใบ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.some((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3),
    run: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.find((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3); return t ? { explain: `${E.name(s, t)} กลับเข้า Deck · จั่ว 1 ใบ`, ops: [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "draw", seat: p, n: 1 }] } : { explain: "", ops: [] }; } } },
  // มาดามทาบิ: our Constructs are not destroyed by card abilities
  "BT11-044": { shieldOthers: (E, s, y, Ly, x, L) => Ly.z === "av" && L.z === "cs" && L.p === Ly.p },
  // โคลัมแบงค์: แบงค์ Avatars in our hand pay colourless GEM
  "BT11-045": { colorlessOther: (E, s, y, x) => (E.locate(s, x.i) || {}).z === "hand" && bank(E, s, x) && (E.locate(s, y.i) || {}).z === "av" },
  // ดยุกแห่งภาคีมะม่วง: จุติ destroy a foe of Cost ≤ 2 + ต้นมะม่วง on our Magic Zone · คำสั่งเสีย back to the Magic Zone
  "BT11-046": { summon: (c) => { const { E, s, seat: p } = c; const lim = 2 + mangoTree(E, s, p); const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) <= lim).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${lim}`, { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "ดยุกแห่งภาคีมะม่วง" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; }, death: mangoDeath },
  // พระถังซัมจั๋ง: จุติ discard an Avatar: ซุนหงอคง / ตือโป๊ยก่าย / ซัวเจ๋ง from the Deck · with all three: พระไตรปิฎก from the Deck or hell
  "BT11-047": { summon: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y)).sort(cheapCard(E, s)), 1, "ทิ้ง Avatar บนมือ 1 ใบ", { exact: true })[0]; if (!pay || E.avatars(s.P[p]) >= 4) return { explain: "ไม่ได้ทิ้ง Avatar", ops: [] }; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && tang.slice(1).some((n) => E.named(s, y, n)) && !tangIn(E, s, p).some((n) => E.named(s, y, n)))), 1, "เลือก ซุนหงอคง ตือโป๊ยก่าย หรือ ซัวเจ๋ง", { exact: true })[0];
      return t ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มีศิษย์ใน Deck", ops: [] }; },
    activate: { label: "นำพระไตรปิฎกขึ้นมือ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && tangIn(E, s, L.p, tang.slice(1)).length === 3 && [...s.P[L.p].deck, ...s.P[L.p].hell].some((y) => E.named(s, y, "พระไตรปิฎก")),
      run: (c) => { const { E, s, seat: p } = c; const h = s.P[p].hell.find((y) => E.named(s, y, "พระไตรปิฎก")); const d = s.P[p].deck.find((y) => E.named(s, y, "พระไตรปิฎก")); return h ? { explain: `${E.name(s, h)} จากนรกขึ้นมือ`, ops: [{ op: "move", i: h.i, to: "hand" }] } : d ? { explain: `${E.name(s, d)} จาก Deck ขึ้นมือ`, ops: [{ op: "search", seat: p, take: d.i, to: "hand" }] } : { explain: "", ops: [] }; } } },
  // โอเปอเรชั่น : รอยัล: two awake หน่วยรบ XVI go to sleep: destroy a foe
  "BT11-053": { canCast: (E, s, p) => s.P[p].av.filter((y) => y.a && unitXVI(E, s, y)).length >= 2 && s.P[1 - p].av.length > 0,
    cast: (c) => { const { E, s, seat: p } = c; const two = c.choose(s.P[p].av.filter((y) => y.a && unitXVI(E, s, y)).sort((a, b) => E.power(s, a) - E.power(s, b)), 2, "เลือก หน่วยรบ XVI ที่ตื่นอยู่ 2 ใบ", { exact: true }); const t = c.choose(bestFoe(E, s, p), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
      return two.length === 2 ? { explain: `${two.map((y) => E.name(s, y)).join(", ")} เปลี่ยนเป็นสภาพนอน${t ? " · ทำลาย " + E.name(s, t) : ""}`, ops: [...two.map((y) => ({ op: "toggle", i: y.i })), ...(t ? [{ op: "destroy", i: t.i, why: "โอเปอเรชั่น : รอยัล" }] : [])] } : { explain: "", ops: [] }; } },
  // แยกกันไปแตก: 4 different สมาชม on our zone, exile 4 different from hell: their whole hand, or all their Avatars
  "BT11-054": { canCast: (E, s, p) => new Set(s.P[p].av.filter((y) => sama(E, s, y)).map((y) => E.name(s, y))).size >= 4 && uniq(E, s, s.P[p].hell.filter((y) => sama(E, s, y))).length >= 4,
    cast: (c) => { const { E, s, seat: p } = c; const ex = uniq(E, s, s.P[p].hell.filter((y) => sama(E, s, y))).slice(0, 4); const m = c.mode(["1) ฝ่ายตรงข้ามทิ้งการ์ดบนมือทั้งหมด", "2) ทำลาย Avatar บนสนามฝ่ายตรงข้ามทั้งหมด"], "แยกกันไปแตก", s.P[1 - p].av.length >= 2 ? 1 : 0);
      return { explain: `เนรเทศ สมาชม 4 ใบ · ${m === 0 ? "ฝ่ายตรงข้ามทิ้งการ์ดบนมือทั้งหมด" : "ทำลาย Avatar ฝ่ายตรงข้ามทั้งหมด"}`, ops: [...ex.map((y) => ({ op: "exile", i: y.i })), ...(m === 0 ? [{ op: "discardRandom", seat: 1 - p, n: s.P[1 - p].hand.length }] : s.P[1 - p].av.map((y) => ({ op: "destroy", i: y.i, why: "แยกกันไปแตก" })))] }; } },
  // Cross Vaccine: damage our LIFE once, an Overdose Avatar back to the Deck, another Overdose from the Deck: +2 and safe from their Magic this turn
  "BT11-055": { canCast: (E, s, p) => !E.critical(s.P[p]) && s.P[p].av.some((y) => odAv(E, s, y)) && s.P[p].deck.some((y) => isAv(E, s, y) && odAv(E, s, y) && !E.def(s, y).o1),
    cast: (c) => { const { E, s, seat: p } = c; const back = c.choose(s.P[p].av.filter((y) => odAv(E, s, y)).sort(cheapCard(E, s)), 1, "เลือก Avatar Overdose กลับเข้า Deck", { exact: true })[0]; if (!back) return { explain: "", ops: [] }; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && odAv(E, s, y) && !E.def(s, y).o1 && E.def(s, y).n !== E.def(s, back).n)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar Overdose จาก Deck", { exact: true })[0];
      return { explain: `LIFE เราเสียหาย 1 ครั้ง · ${E.name(s, back)} กลับเข้า Deck${t ? ` · อัญเชิญ ${E.name(s, t)} POWER +2` : ""}`, ops: [{ op: "lifeDamage", seat: p }, { op: "move", i: back.i, to: "deckBottom" }, ...(t ? [{ op: "put", i: t.i }, { op: "power", i: t.i, n: 2, temp: true }, { op: "flagSet", i: t.i, k: "rimm" }] : []), { op: "shuffle", seat: p }] }; } },
  // พระไตรปิฎก: with พระถังซัมจั๋ง: draw 1 and it stays on our Magic Zone · the pilgrims +1 · 3 of them + all four pilgrims at our Draw Phase: we win
  "BT11-056": { stay: true, canCast: (E, s, p) => tangIn(E, s, p, ["พระถังซัมจั๋ง"]).length > 0, cast: (c) => ({ explain: "จั่ว 1 ใบ · การ์ดใบนี้วางไว้บน Magic Zone", ops: [{ op: "draw", seat: c.seat, n: 1 }] }),
    aura: (E, s, src, L) => (L.z === "mg" && src.on == null ? [{ seat: L.p, test: (y) => tang.some((n) => E.named(s, y, n)), n: 1 }] : []),
    drawPhaseOk: (E, s, x, L) => L.z === "mg" && x.on == null && s.P[L.p].mg.filter((m) => m.on == null && E.named(s, m, "พระไตรปิฎก")).length >= 3 && tangIn(E, s, L.p).length === 4, drawPhase: (c) => ({ explain: "พระไตรปิฎก 3 ใบ และศิษย์ครบ: ชนะเกม!", ops: [{ op: "win", seat: c.seat, text: "พระไตรปิฎก 3 ใบ และ พระถังซัมจั๋ง ซุนหงอคง ตือโป๊ยก่าย ซัวเจ๋ง ครบ" }] }) },
  // สู่โลกอันเปล่งประกาย!: an อัศวินตลิ่งชัน from hell of Cost ≤ our chosen ไอ้นัท / เซอร์นัท · with ชาช่า or มีมมิ on our field draw 1
  "BT11-057": { canCast: (E, s, p) => E.avatars(s.P[p]) < 4 && s.P[p].av.some((n) => (E.named(s, n, "ไอ้นัท") || E.named(s, n, "เซอร์นัท")) && s.P[p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "อัศวินตลิ่งชัน") && (E.def(s, y).c || 0) <= E.costNow(s, n))),
    cast: (c) => { const { E, s, seat: p } = c; const n = c.choose(s.P[p].av.filter((y) => E.named(s, y, "ไอ้นัท") || E.named(s, y, "เซอร์นัท")).sort((a, b) => E.costNow(s, b) - E.costNow(s, a)), 1, "เลือก ไอ้นัท หรือ เซอร์นัท", { exact: true })[0]; if (!n) return { explain: "", ops: [] };
      const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "อัศวินตลิ่งชัน") && (E.def(s, y).c || 0) <= E.costNow(s, n)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก อัศวินตลิ่งชัน จากนรก", { exact: true })[0]; const dr = [...s.P[p].av, ...s.P[p].mg, ...s.P[p].cs].some((y) => E.named(s, y, "ชาช่า") || E.named(s, y, "มีมมิ"));
      return t ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก${dr ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "put", i: t.i }, ...(dr ? [{ op: "draw", seat: p, n: 1 }] : [])] } : { explain: "", ops: [] }; } },
  // ระเบิดความเกลียดชัง: 10+ Avatars on the fields: every card on both fields to hell
  "BT11-058": { canCast: (E, s) => [0, 1].reduce((n, q) => n + [...s.P[q].av, ...s.P[q].mg, ...s.P[q].cs].filter((y) => isAv(E, s, y)).length, 0) >= 10,
    cast: (c) => { const { E, s } = c; const all = [0, 1].flatMap((q) => [...s.P[q].mg, ...s.P[q].av, ...s.P[q].cs]).filter((y) => y.i !== (c.self && c.self.i)); return { explain: "ส่งการ์ดทุกใบบนสนามลงนรก", ops: [...all.map((y) => ({ op: "move", i: y.i, to: "hell" })), ...E.lands(s).map((l) => ({ op: "move", i: l.i, to: "hell" }))] }; } },
  // อินสตอล บึ้มทั้งไดรฟ์: exile 2 non-Only ไวรัส from hell; 5+ in the dark zone: a ไวรัส from there
  "BT11-059": { canCast: (E, s, p) => s.P[p].hell.filter((y) => virusAv(E, s, y) && !E.def(s, y).o1).length >= 2,
    cast: (c) => { const { E, s, seat: p } = c; const ex = c.choose(s.P[p].hell.filter((y) => virusAv(E, s, y) && !E.def(s, y).o1).sort(cheapCard(E, s)), 2, "เลือก ไวรัส ในนรก 2 ใบ เนรเทศ", { exact: true }); const pool = [...s.P[p].dark.filter((y) => virusAv(E, s, y)), ...ex]; const ok = pool.length >= 5 && E.avatars(s.P[p]) < 4;
      const t = ok ? c.choose(pool.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก ไวรัส จากมิติมืด อัญเชิญ (ไม่บังคับ)", { optional: true })[0] : null; return { explain: `เนรเทศ ${ex.length} ใบ${t ? ` · อัญเชิญ ${E.name(s, t)} จากมิติมืด` : ""}`, ops: [...ex.map((y) => ({ op: "exile", i: y.i })), ...(t ? [{ op: "put", i: t.i }] : [])] }; } },
  // ให้ข้าวฉันถ้าคุณเป็นคนดี: their Battle Phase starts: one of theirs draws us a card each time it attacks this turn
  "BT11-061": { react: { kinds: ["battle"], can: (E, s, p) => s.P[1 - p].av.some((y) => y.a && !E.noAim(s, y)), botV: (E, s, q) => (s.P[1 - q].av.filter((y) => y.a).length >= 1 ? 3 : 0) },
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0]; return t ? { explain: `${E.name(s, t)}: เมื่อโจมตีในเทิร์นนี้ เราจั่ว 1 ใบ`, ops: [{ op: "flagSet", i: t.i, k: "feed" }] } : { explain: "", ops: [] }; } },
  // เหตุผลที่ยังหายใจ: our second Avatar destroyed this turn, exile a hell card: one of ours +8
  "BT11-062": { react: { kinds: ["destroyed"], can: (E, s, p, on) => on.p === p && on.nth === 2 && s.P[p].hell.length > 1 && s.P[p].av.length > 0, botV: () => 3 },
    cast: (c) => { const { E, s, seat: p } = c; const ex = [...s.P[p].hell].filter((y) => y.i !== (c.t.on || {}).i).sort(cheapCard(E, s))[0]; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา POWER +8", { exact: true })[0]; return ex && t ? { explain: `เนรเทศ ${E.name(s, ex)} · ${E.name(s, t)} POWER +8`, ops: [{ op: "exile", i: ex.i }, { op: "power", i: t.i, n: 8, temp: true }] } : { explain: "", ops: [] }; } },
  // ทำไมถึงเอาแต่ดูละครับ ?!: the attack moves to one of our [Link] Avatars, which gets +3 · pays GEM 4 colourless for a [Link] Avatar
  "BT11-063": { gemFor: (td) => (td && td.t === "A" && /\[\s*Link/.test(String(td.x || "")) ? 4 : null), selfColorless: (E, s, x, td) => !!td && td.t === "A" && /\[\s*Link/.test(String(td.x || "")),
    react: { kinds: ["attack"], can: (E, s, p, on) => s.P[p].av.some((y) => y.lk && y.i !== on.ti && !E.atkSafe(s, y)), botV: (E, s, q, on) => { const A = E.locate(s, on.att); const best = s.P[q].av.filter((y) => y.lk).sort(strongFirst(E, s))[0]; return A && best && E.power(s, best) + 3 > E.power(s, A.x) ? 4 : -2; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const t = c.choose(s.P[p].av.filter((y) => y.lk && y.i !== on.ti).sort(strongFirst(E, s)), 1, "เลือก Avatar [Link] ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `เปลี่ยนเป้าหมายไปที่ ${E.name(s, t)} · POWER +3`, ops: [{ op: "redirect", i: t.i }, { op: "power", i: t.i, n: 3, temp: true }] } : { explain: "", ops: [] }; } },
  // ดาบแห่งแสงอรุณ & นัทคาลิเบอร์: ไอ้นัท / เซอร์นัท only · on ไอ้นัท: sacrifice it and discard 1: เซอร์นัท from the Deck with จุติ · on เซอร์นัท: other อัศวินตลิ่งชัน +1
  "BT11-064": { modOnly: (E, s, h) => E.named(s, h, "ไอ้นัท") || E.named(s, h, "เซอร์นัท"),
    activate: { label: "เซ่นไหว้ ไอ้นัท ที่สวมใส่ และทิ้ง 1 ใบ: อัญเชิญ จุติ เซอร์นัท จาก Deck", can: (E, s, x, L) => { if (L.z !== "mg" || x.on == null || s.phase !== "main") return false; const H = E.locate(s, x.on); return !!H && H.z === "av" && H.p === L.p && E.named(s, H.x, "ไอ้นัท") && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => isAv(E, s, y) && E.named(s, y, "เซอร์นัท")); },
      run: (c) => { const { E, s, seat: p, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = s.P[p].deck.filter((y) => isAv(E, s, y) && E.named(s, y, "เซอร์นัท")).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
        return H && pay && t ? { explain: `เซ่นไหว้ ${E.name(s, H.x)} · ทิ้ง ${E.name(s, pay)} · อัญเชิญ จุติ ${E.name(s, t)}`, ops: [{ op: "destroy", i: H.x.i, why: "เซ่นไหว้" }, { op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i, jt: true }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } },
    aura: (E, s, src, L) => { if (L.z !== "mg" || src.on == null) return []; const H = E.locate(s, src.on); return H && H.z === "av" && E.named(s, H.x, "เซอร์นัท") ? [{ seat: H.p, test: (y) => y.i !== H.x.i && E.named(s, y, "อัศวินตลิ่งชัน"), n: 1 }] : []; } },
  // อาวุธนคร: มือปืนนคร only · ปืนพกงูเห่า +1 attacking and its kills leave no last words · ลูกซองจุ้ย +2 attacking and its kills damage their LIFE · ดินสอ 5H no React Magic against its attacks
  "BT11-065": { modOnly: (E, s, h) => gunman(E, s, h), killNoDeath: true, hostAttack: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H ? { explain: `${c.E.name(c.s, H.x)} POWER +1 จนจบการต่อสู้`, ops: [{ op: "power", i: H.x.i, n: 1, temp: "fight" }] } : { explain: "", ops: [] }; } },
  "BT11-066": { modOnly: (E, s, h) => gunman(E, s, h), hostAttack: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H ? { explain: `${c.E.name(c.s, H.x)} POWER +2 จนจบการต่อสู้`, ops: [{ op: "power", i: H.x.i, n: 2, temp: "fight" }] } : { explain: "", ops: [] }; },
    hostKill: (c) => ({ explain: "ทำความเสียหายต่อ LIFE ฝ่ายตรงข้าม 1 ครั้ง", ops: [{ op: "lifeDamage", seat: 1 - c.seat }] }) },
  "BT11-067": { modOnly: (E, s, h) => gunman(E, s, h), hostAttack: () => ({ explain: "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้", ops: [{ op: "noReact" }] }) },
  // หนึ่งเดียวเพื่อทุกอย่าง: +1 (+1 more each time it changes wearer); when the wearer leaves it moves to another Avatar
  "BT11-068": { worn: (E, s, m) => 1 + (m.ofa || 0), toHell: (c) => { const { E, s, seat: p, self: m } = c; if (!m) return { explain: "", ops: [] }; const t = c.choose([...s.P[p].av, ...s.P[1 - p].av.filter((y) => !E.noAim(s, y))].sort((a, b) => ((E.locate(s, b.i) || {}).p === p ? 1 : 0) - ((E.locate(s, a.i) || {}).p === p ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ที่จะสวมใส่ หนึ่งเดียวเพื่อทุกอย่าง", { exact: true })[0];
      return t ? { explain: `สวมใส่ให้ ${E.name(s, t)} (POWER +${2 + (m.ofa || 0)})`, ops: [{ op: "attach", i: m.i, on: t.i }, { op: "flagSet", i: m.i, k: "ofa", v: (m.ofa || 0) + 1 }] } : { explain: "ไม่มี Avatar ให้สวมใส่", ops: [] }; } },
  // มัลแวร์โซน: once per turn exile a non-Only ไวรัส from our hell: they mill 1
  "BT11-069": { activate: { label: "เนรเทศ ไวรัส จากนรก: ฝ่ายตรงข้าม ธรณีสูบ 1 ใบ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hell.some((y) => virusAv(E, s, y) && !E.def(s, y).o1),
    run: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.filter((y) => virusAv(E, s, y) && !E.def(s, y).o1).sort(cheapCard(E, s))[0]; return t ? { explain: `เนรเทศ ${E.name(s, t)} · ฝ่ายตรงข้าม ธรณีสูบ 1 ใบ`, ops: [{ op: "exile", i: t.i }, { op: "mill", seat: 1 - p, n: 1 }] } : { explain: "", ops: [] }; } } },
  // มะม่วงดราชิลด์: by ต้นมะม่วง on our Magic Zone — 1 not destroyed by abilities · 2 our มะม่วง +1 · 3 they cannot be targeted · 4 once per turn a มะม่วง from hell to the Magic Zone
  "BT11-070": { noDestroy: (E, s, x, L) => L.z === "land" && mangoTree(E, s, L.p) >= 1, aura: (E, s, src, L) => (L.z === "land" && mangoTree(E, s, L.p) >= 2 ? [{ seat: L.p, test: (y) => mango(E, s, y), n: 1 }] : []),
    noAim: (E, s, src, Ls, x) => Ls.z === "land" && mangoTree(E, s, Ls.p) >= 3 && mango(E, s, x),
    activate: { label: "นำ มะม่วง จากนรกมาวางบน Magic Zone", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && mangoTree(E, s, L.p) >= 4 && s.P[L.p].hell.some((y) => mango(E, s, y)),
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => mango(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก มะม่วง ในนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไปวางไว้บน Magic Zone`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }] } : { explain: "", ops: [] }; } } },
  // โรงเรียนฝึกหน่วยรบ: หน่วยรบ XVI attacking +1 for the fight · once per turn discard 1: one from hell under the Deck
  "BT11-071": { landAttack: (E, s, x) => (unitXVI(E, s, x) ? 1 : 0), activate: { label: "ทิ้ง 1 ใบ: หน่วยรบ XVI จากนรกกลับเข้าใต้ Deck", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => unitXVI(E, s, y)),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(s.P[p].hell.filter((y) => unitXVI(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก หน่วยรบ XVI ในนรก", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} กลับเข้าใต้ Deck`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "deckBottom" }] } : { explain: "", ops: [] }; } } },
  // นครทิเนนทอล: once per turn each — scout 5 to exile an อาวุธนคร / an อาวุธนคร from the dark zone worn by our มือปืนนคร (+2) · destroyed only by being attacked
  "BT11-072": { noDestroy: (E, s, x, L) => L.z === "cs",
    activate: { label: "นครทิเนนทอล", multi: true, can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && (once(s, L.p, "นคร:scout:" + x.i) && s.P[L.p].deck.length > 0 || (once(s, L.p, "นคร:wear:" + x.i) && !s.mu[L.p].D && s.P[L.p].dark.some((y) => cityGun(E, s, y)) && s.P[L.p].av.some((y) => gunman(E, s, y)))),
      run: (c) => { const { E, s, seat: p, self: x } = c; const opts = []; if (once(s, p, "นคร:scout:" + x.i) && s.P[p].deck.length) opts.push(0); if (once(s, p, "นคร:wear:" + x.i) && !s.mu[p].D && s.P[p].dark.some((y) => cityGun(E, s, y)) && s.P[p].av.some((y) => gunman(E, s, y))) opts.push(1); if (!opts.length) return { explain: "", ops: [] };
        const m = opts[c.mode(opts.map((k) => (k === 0 ? "สอดแนม 5 ใบ: เนรเทศ อาวุธนคร" : "อาวุธนคร จากมิติมืด สวมใส่ให้ มือปืนนคร (POWER +2)")), "นครทิเนนทอล", opts.length - 1)];
        if (m === 0) { const top = s.P[p].deck.slice(0, 5); const t = c.choose(top.filter((y) => cityGun(E, s, y)), 1, "เลือก อาวุธนคร เนรเทศ", { exact: true, reveal: true })[0]; return { explain: `สอดแนม ${top.length} ใบ${t ? ` · เนรเทศ ${E.name(s, t)}` : ""}`, ops: [{ op: "nameOnce", seat: p, name: "นคร:scout:" + x.i }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "exile", i: t.i }] : []), { op: "shuffle", seat: p }] }; }
        const h = c.choose(s.P[p].av.filter((y) => gunman(E, s, y)).sort(strongFirst(E, s)), 1, "เลือก มือปืนนคร", { exact: true })[0]; const g = h ? c.choose(uniq(E, s, s.P[p].dark.filter((y) => cityGun(E, s, y) && E.modOk(s, y, h))), 1, "เลือก อาวุธนคร จากมิติมืด", { exact: true })[0] : null;
        return h && g ? { explain: `${E.name(s, g)} สวมใส่ให้ ${E.name(s, h)} · POWER +2`, ops: [{ op: "nameOnce", seat: p, name: "นคร:wear:" + x.i }, { op: "attach", i: g.i, on: h.i }, { op: "mu", k: "D" }, { op: "power", i: h.i, n: 2, temp: true }] } : { explain: "", ops: [] }; } } },
  // รูปประจำบ้าน: our Avatars' control cannot change
  "BT11-073": { noSteal: true },
  // แป้นสกุล อิเล็กทรอนิกส์: once per turn scout 5 for an appliance to our Magic Zone · more of our LIFE face up than theirs: cannot be attacked
  "BT11-074": { activate: { label: "สอดแนม 5 ใบ: เครื่องใช้ไฟฟ้า ไปวางบน Magic Zone", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].deck.length > 0,
      run: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => appliance(E, s, y), "เลือก เครื่องใช้ไฟฟ้า", { optional: true }); return top.length ? { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ไปวางบน Magic Zone` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "mg", seat: p }] : []), ...restOps(p, top, t ? [t] : [], "shuffle")] } : { explain: "", ops: [] }; } },
    noAtk: (E, s, x, L) => !!L && L.z === "cs" && facedUp(s, L.p) > facedUp(s, 1 - L.p) },
});

// ---------- BT12 ----------
const SYMS = ["คน", "ต่างชาติ", "เทพ", "สัตว์", "หุ่นยนต์", "นรก", "สัตว์วิเศษ", "ยักษ์", "รัททาทุย", "แมลง", "ผี", "เอเลี่ยน", "ปลา", "ต้นไม้", "ไซเบอร์", "กะปอม", "เปรต", "มังกร", "ฤษี"];
const fieldAv = (E, s, p) => [...s.P[p].av, ...s.P[p].mg.filter((m) => m.on == null && isAv(E, s, m))];
const syCount = (E, s, y) => SYMS.filter((k) => E.hasSy(s, y, k)).length;
const distinctSy = (E, s, p) => SYMS.filter((k) => fieldAv(E, s, p).some((y) => E.hasSy(s, y, k))).length;
const army = (E, s, x) => isAv(E, s, x) && E.named(s, x, "กองทัพปีศาจ");
const aim = (E, s, p) => [...s.P[p].av, ...s.P[p].dark].some((y) => E.named(s, y, "ไอม์ อางส์ กูล"));
const firstMain = (s, p) => s.phase === "main" && s.turn === (p === s.first ? 1 : 2);
const party = (E, s, x) => E.named(s, x, "ปาร์ตี้ผู้กล้า");
const treasure = (E, s, x) => E.def(s, x).t === "M" && E.named(s, x, "สมบัติศักดิ์สิทธิ์");
const roundK = (E, s, x) => isAv(E, s, x) && (E.named(s, x, "อัศวินโต๊ะกลม") || E.named(s, x, "เมอลิน"));
const ghost = (E, s, x) => isAv(E, s, x) && sy(E, s, x, "ผี");
const redGeneral = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ขุนพล") && E.colors(s, x).includes("แดง") && sy(E, s, x, "ต่างชาติ");
const greenGeneral = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ขุนพล") && E.colors(s, x).includes("เขียว") && sy(E, s, x, "ต่างชาติ");
const armyDeath = (draw) => (c) => { const { E, s, seat: p, self: x } = c; if (!x || !aim(E, s, p) || E.locate(s, x.i)?.z !== "hell") return { explain: "", ops: [] }; return { explain: `เนรเทศ ${E.name(s, x)}${draw ? " · จั่ว 1 ใบ" : ""}`, ops: [{ op: "exile", i: x.i }, ...(draw ? [{ op: "draw", seat: p, n: 1 }] : [])] }; };
Object.assign(SCRIPTS, {
  // จอมมาร ไอม์ อางส์ กูล: in our first Main Phase from the hand (draw 2) or the Deck: to the dark zone · from there, any กองทัพปีศาจ back under the Deck: summoned with base POWER = that number, and every 5 sends a field card to hell · our กองทัพปีศาจ +1
  "BT12-001": { activate: { label: "จอมมาร ไอม์ อางส์ กูล", fromDeck: true, can: (E, s, x, L) => s.phase === "main" && (((L.z === "hand" || L.z === "deck") && firstMain(s, L.p)) || (L.z === "dark" && E.avatars(s.P[L.p]) < 4)),
      run: (c) => { const { E, s, seat: p, self: x } = c; const L = E.locate(s, x.i); if (L.z === "hand") return { explain: `เนรเทศ ${E.name(s, x)} · จั่ว 2 ใบ`, ops: [{ op: "exile", i: x.i }, { op: "draw", seat: p, n: 2 }] }; if (L.z === "deck") return { explain: `เนรเทศ ${E.name(s, x)} จาก Deck · สับ Deck`, ops: [{ op: "exile", i: x.i }, { op: "shuffle", seat: p }] };
        const ts = c.choose(s.P[p].dark.filter((y) => army(E, s, y)), 20, "เลือก กองทัพปีศาจ ในมิติมืด กลับเข้าใต้ Deck (กี่ใบก็ได้)", { optional: true }); const n = ts.length; const kills = Math.floor(n / 5); const foes = [...foeField(E, s, p)].sort((a, b) => worth(E, s, b) - worth(E, s, a)); const k2 = c.choose(foes, kills, `เลือกการ์ดบนสนาม ${kills} ใบ ส่งลงนรก`, { exact: true });
        return { explain: `${n} ใบกลับเข้า Deck · อัญเชิญ ${E.name(s, x)} POWER ตั้งต้น ${n}${k2.length ? ` · ส่ง ${k2.map((y) => E.name(s, y)).join(", ")} ลงนรก` : ""}`, ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "put", i: x.i }, { op: "ovSet", i: x.i, ov: { pw: n } }, ...k2.map((y) => ({ op: "move", i: y.i, to: "hell" }))] }; } },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => army(E, s, y), n: 1 }] : []) },
  // กองทัพปีศาจ กริมฟรีค: +3 fighting {คน}/{ต่างชาติ} · คำสั่งเสีย with ไอม์: exiled and draw 1
  "BT12-002": { fight: (c) => { const { E, s, self: x } = c; const f = x && foeOf(E, s, x); return f && (sy(E, s, f, "คน") || sy(E, s, f, "ต่างชาติ")) ? { explain: "POWER +3 จนจบการต่อสู้", ops: [{ op: "power", i: x.i, n: 3, temp: "fight" }] } : { explain: "", ops: [] }; }, death: armyDeath(true) },
  // กองทัพปีศาจ ฟรีซเซอร์: from hell with ไอม์, exiled: scout 4 for a กองทัพปีศาจ
  "BT12-003": { activate: { label: "เนรเทศจากนรก: สอดแนม 4 ใบ หา กองทัพปีศาจ", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && aim(E, s, L.p) && s.P[L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p, self: x } = c; const { top, t } = scoutPick(c, 4, (y) => army(E, s, y), "เลือก กองทัพปีศาจ ขึ้นมือ", { optional: true }); return { explain: `เนรเทศ ${E.name(s, x)} · สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "exile", i: x.i }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] }; } } },
  // กองทัพปีศาจ อูเบล: our other {นรก} กองทัพปีศาจ / จอมมาร gain โล่มนุษย์ and +1 · คำสั่งเสีย with ไอม์: exiled
  "BT12-004": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i !== src.i && (army(E, s, y) || E.named(s, y, "จอมมาร")) && sy(E, s, y, "นรก"), n: 1, kw: ["โล่มนุษย์"] }] : []), death: armyDeath(false) },
  // ภาคีสะพานเหล็ก: paid for an Avatar: it gains a keyword by its Symbol
  "BT12-005": { paid: (c) => { const { E, s } = c; const L = c.t.forI != null ? E.locate(s, c.t.forI) : null; if (!L || L.z !== "av") return { explain: "", ops: [] }; const kws = [["หุ่นยนต์", "โล่มนุษย์"], ["กะปอม", "สามัคคี"], ["เอเลี่ยน", "แทงหลัง"], ["ต่างชาติ", "ลูกฮึด"]].filter(([k]) => sy(E, s, L.x, k)).map(([, w]) => w);
    return kws.length ? { explain: `${E.name(s, L.x)} ได้รับ ${kws.join(", ")}`, ops: kws.map((k) => ({ op: "keyword", i: L.x.i, k })) } : { explain: "", ops: [] }; } },
  // นานาโฮชิ นานะ: attacking, discard 2: destroy a foe of POWER ≤ hers · +1 per Symbol on our field · counts as {เทพ}
  "BT12-006": { extraSy: "เทพ", aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: distinctSy(E, s, L.p) }] : []),
    attack: (c) => { const { E, s, seat: p, self: x } = c; if (!x || s.P[p].hand.length < 2) return { explain: "", ops: [] }; const t = s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.power(s, y) <= E.power(s, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; if (!t) return { explain: "", ops: [] };
      if (c.mode(["ไม่ใช้", `ทิ้ง 2 ใบ: ทำลาย Avatar POWER ไม่เกิน ${E.power(s, x)}`], "นานาโฮชิ นานะ", worth(E, s, t) >= 4 ? 1 : 0) !== 1) return { explain: "ไม่ใช้", ops: [] }; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); const tt = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.power(s, y) <= E.power(s, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0];
      return pay.length === 2 && tt ? { explain: `ทิ้ง 2 ใบ · ทำลาย ${E.name(s, tt)}`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "destroy", i: tt.i, why: "นานาโฮชิ นานะ" }] } : { explain: "", ops: [] }; } },
  // นาย นักเวทย์: Cost -1 in the hand for a กุ่ย and for a ฮอล on our field
  "BT12-007": { selfCost: (E, s, x, p) => ((E.locate(s, x.i) || {}).z === "hand" ? -["กุ่ย", "ฮอล"].filter((n) => fieldAv(E, s, p).some((y) => E.named(s, y, n))).length : 0) },
  // ร่างอวตารพระนารายณ์-พระราม: from the hand when our พระนารายณ์ wins a fight, that พระนารายณ์ to hell: summoned · then our พระนารายณ์ +1 and โล่มนุษย์ · our End Phase: back to hell and another พระนารายณ์ from hell
  "BT12-008": { handKillOk: (E, s, y, w) => E.named(s, w, "พระนารายณ์") && once(s, y.o, "ร่างอวตารพระราม"), handKill: (c) => { const { E, s, seat: p, self: x } = c; const n = s.P[p].av.filter((y) => E.named(s, y, "พระนารายณ์")).sort(cheapCard(E, s))[0]; if (!n || !x || !once(s, p, "ร่างอวตารพระราม")) return { explain: "", ops: [] };
      return { explain: `${E.name(s, n)} ลงนรก · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "nameOnce", seat: p, name: "ร่างอวตารพระราม" }, { op: "move", i: n.i, to: "hell" }, { op: "put", i: x.i }, { op: "flagSet", i: x.i, k: "own", v: true }, ...s.P[p].av.filter((y) => y !== n && E.named(s, y, "พระนารายณ์")).flatMap((y) => [{ op: "power", i: y.i, n: 1, temp: false }, { op: "keyword", i: y.i, k: "โล่มนุษย์" }])] }; },
    endPhase: (E, s, x, L) => { if (L.z !== "av" || !x.own || s.active !== L.p) return []; const t = s.P[L.p].hell.find((y) => isAv(E, s, y) && E.named(s, y, "พระนารายณ์") && E.def(s, y).n !== E.def(s, x).n); return [{ op: "move", i: x.i, to: "hell" }, ...(t ? [{ op: "put", i: t.i }] : [])]; } },
  // เมอลิน: once a turn (by name) discard 1: a knight from hell into the Deck and draw 1 / a Cost ≤5 knight on top of the Deck / a ดาบศักดิ์สิทธิ์ from hell onto a knight
  "BT12-010": { activate: { label: "ทิ้ง 1 ใบ: เลือกปฏิบัติ (อัศวินโต๊ะกลม)", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && once(s, L.p, "เมอลิน") && s.P[L.p].hand.length > 0 && (s.P[L.p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "อัศวินโต๊ะกลม")) || (s.P[L.p].hell.some((y) => E.named(s, y, "ดาบศักดิ์สิทธิ์") && !E.def(s, y).o1) && s.P[L.p].av.some((y) => E.named(s, y, "อัศวินโต๊ะกลม")))),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const kn = P.hell.filter((y) => isAv(E, s, y) && E.named(s, y, "อัศวินโต๊ะกลม")); const sw = P.hell.filter((y) => E.named(s, y, "ดาบศักดิ์สิทธิ์") && !E.def(s, y).o1); const hosts = P.av.filter((y) => E.named(s, y, "อัศวินโต๊ะกลม"));
      const opts = [...(kn.length ? [0] : []), ...(kn.some((y) => (E.def(s, y).c || 0) <= 5) ? [1] : []), ...(sw.length && hosts.length ? [2] : [])]; if (!opts.length) return { explain: "", ops: [] }; const lab = ["1) อัศวินโต๊ะกลม จากนรกกลับเข้า Deck แล้วจั่ว 1 ใบ", "2) อัศวินโต๊ะกลม Cost ≤5 จากนรกไว้บนสุดของ Deck", "3) ดาบศักดิ์สิทธิ์ จากนรกสวมใส่ให้อัศวินโต๊ะกลม"];
      const m = opts[c.mode(opts.map((k) => lab[k]), "เมอลิน พ่อมดแห่งอวาลอน", opts.includes(2) ? opts.indexOf(2) : 0)]; const pay = c.choose([...P.hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; if (!pay) return { explain: "", ops: [] }; const head = [{ op: "nameOnce", seat: p, name: "เมอลิน" }, { op: "discard", seat: p, iids: [pay.i] }];
      if (m === 0) { const t = kn.sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return { explain: `${E.name(s, t)} กลับเข้า Deck · จั่ว 1 ใบ`, ops: [...head, { op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }, { op: "draw", seat: p, n: 1 }] }; }
      if (m === 1) { const t = c.choose(kn.filter((y) => (E.def(s, y).c || 0) <= 5).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกอัศวินโต๊ะกลม Cost ไม่เกิน 5", { exact: true })[0]; return { explain: `${E.name(s, t)} ไว้บนสุดของ Deck`, ops: [...head, { op: "move", i: t.i, to: "deckTop" }] }; }
      const w = c.choose(sw.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกดาบศักดิ์สิทธิ์ในนรก", { exact: true })[0]; const h = c.choose(hosts.filter((y) => E.modOk(s, w, y)).sort(strongFirst(E, s)), 1, "เลือกอัศวินโต๊ะกลมที่จะสวมใส่", { exact: true })[0]; return w && h ? { explain: `${E.name(s, w)} สวมใส่ให้ ${E.name(s, h)}`, ops: [...head, { op: "attach", i: w.i, on: h.i }] } : { explain: "", ops: [] }; } } },
  // กำเหลง: Cost -1 when our zone has only red ขุนพล {ต่างชาติ} · +2 with เรือรบโบราณ · our เรือรบโบราณ +1
  "BT12-011": { selfCost: (E, s, x, p) => ((E.locate(s, x.i) || {}).z === "hand" && s.P[p].av.length > 0 && s.P[p].av.every((y) => redGeneral(E, s, y)) ? -1 : 0),
    aura: (E, s, src, L) => (L.z === "av" ? [...(s.P[L.p].cs.some((y) => E.named(s, y, "เรือรบโบราณ")) ? [{ seat: L.p, test: (y) => y.i === src.i, n: 2 }] : []), { seat: L.p, cs: true, test: (y) => (E.locate(s, y.i) || {}).z === "cs" && E.named(s, y, "เรือรบโบราณ"), n: 1 }] : []) },
  // ฮิมไลน์: base POWER 7 wearing a สมบัติศักดิ์สิทธิ์ · once per summon, destroyed with no Mod on it: a สมบัติศักดิ์สิทธิ์ from hell worn instead and may wake
  "BT12-014": { aura: (E, s, src, L) => (L.z === "av" && wornOn(s, src).some((m) => treasure(E, s, m)) ? [{ seat: L.p, test: (y) => y.i === src.i, n: 7 - (E.def(s, src).pw || 0) }] : []),
    wouldDestroy: (E, s, x, L) => { if (L.z !== "av" || x.hs2 || wornOn(s, x).some((m) => E.def(s, m).st === "D")) return false; const t = s.P[L.p].hell.find((y) => treasure(E, s, y)); if (!t) return false; x.hs2 = true; E.op(s, { op: "attach", i: t.i, on: x.i }, L.p); x.a = true; E.log(s, L.p, `${E.name(s, x)} ไม่ถูกทำลาย: ${E.name(s, t)} จากนรกสวมใส่แทน และกลับมาตื่น`); return true; } },
  // ฟรีแลนซ์: จุติ discard a Magic: scout 3, a foe -1 per Magic / ปาร์ตี้ผู้กล้า seen, and/or a ปาร์ตี้ผู้กล้า / สมบัติศักดิ์สิทธิ์ to the hand
  "BT12-015": { summon: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => E.def(s, y).t === "M").sort(cheapCard(E, s)), 1, "ทิ้ง Magic บนมือ 1 ใบ", { exact: true })[0]; if (!pay) return { explain: "ไม่มี Magic บนมือ", ops: [] }; const top = s.P[p].deck.slice(0, 3); const n = top.filter((y) => E.def(s, y).t === "M" || party(E, s, y)).length;
    const f = n ? c.choose(bestFoe(E, s, p), 1, `เลือก Avatar ฝ่ายตรงข้าม POWER -${n}`, { optional: true })[0] : null; const t = c.choose(top.filter((y) => party(E, s, y) || treasure(E, s, y)), 1, "เลือก ปาร์ตี้ผู้กล้า หรือ สมบัติศักดิ์สิทธิ์ ขึ้นมือ", { optional: true })[0];
    return { explain: `ทิ้ง ${E.name(s, pay)} · สอดแนม ${top.length} ใบ${f ? ` · ${E.name(s, f)} POWER -${n}` : ""}${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(f ? [{ op: "power", i: f.i, n: -n, temp: true }] : []), ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] }; } },
  // ฮิตเตอร์: without ฮิมไลน์ on our zone and no ฮิตเตอร์ in the dark zone: exiled, a ฮิมไลน์ from hell (may wear a สมบัติศักดิ์สิทธิ์ from the Deck)
  "BT12-016": { activate: { label: "เนรเทศ: อัญเชิญ ฮิมไลน์ จากนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !s.P[L.p].av.some((y) => E.named(s, y, "ฮิมไลน์")) && !s.P[L.p].dark.some((y) => E.def(s, y).n === E.def(s, x).n) && s.P[L.p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "ฮิมไลน์")),
    run: (c) => { const { E, s, seat: p, self: x } = c; const h = s.P[p].hell.find((y) => isAv(E, s, y) && E.named(s, y, "ฮิมไลน์")); const t = s.P[p].deck.find((y) => treasure(E, s, y)); return h ? { explain: `เนรเทศ ${E.name(s, x)} · อัญเชิญ ${E.name(s, h)}${t ? ` สวมใส่ ${E.name(s, t)}` : ""}`, ops: [{ op: "exile", i: x.i }, { op: "put", i: h.i }, ...(t ? [{ op: "attach", i: t.i, on: h.i }] : []), { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } } },
  // โกลัส: จุติ with another ปาร์ตี้ผู้กล้า: dice — even: they discard 1 (or we draw), odd: a foe -1 (or our party +1)
  "BT12-017": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!s.P[p].av.some((y) => y !== x && party(E, s, y))) return { explain: "ไม่มี ปาร์ตี้ผู้กล้า ใบอื่น", ops: [] }; const f = bestFoe(E, s, p)[0]; const me = s.P[p].av.filter((y) => party(E, s, y)).sort(strongFirst(E, s))[0];
    return { explain: "ทอยลูกเต๋า", ops: [{ op: "roll", why: "โกลัส", even: s.P[1 - p].hand.length ? [{ op: "discardRandom", seat: 1 - p, n: 1 }] : [{ op: "draw", seat: p, n: 1 }], odd: f ? [{ op: "power", i: f.i, n: -1, temp: true }] : me ? [{ op: "power", i: me.i, n: 1, temp: true }] : [] }] }; } },
  // มารินะ: dumped by a หน่วยรบ XVI / โอเปอเรชั่น scout: back to the hand, may +1 a หน่วยรบ XVI (once a turn)
  "BT12-018": { dumpedOk: (E, s, x, src) => !!src && (String(src.n || "").includes("หน่วยรบ XVI") || String(src.n || "").includes("โอเปอเรชั่น")) && once(s, x.o, "มารินะ"),
    dumped: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hell") return { explain: "", ops: [] }; const t = s.P[p].av.filter((y) => unitXVI(E, s, y)).sort(strongFirst(E, s))[0]; return { explain: `${E.name(s, x)} กลับขึ้นมือ${t ? ` · ${E.name(s, t)} POWER +1` : ""}`, ops: [{ op: "nameOnce", seat: p, name: "มารินะ" }, { op: "move", i: x.i, to: "hand" }, ...(t ? [{ op: "power", i: t.i, n: 1, temp: true }] : [])] }; } },
  // มามิ: discarded by an Avatar's ability: to our Magic Zone · there, our Avatars with 2+ Symbols +1 · counts as {ต้นไม้}
  "BT12-019": { extraSy: "ต้นไม้", discardedOk: (E, s, x, src) => !!src && ["A", "T"].includes(src.t), discarded: (c) => (c.self && c.E.locate(c.s, c.self.i)?.z === "hell" ? { explain: `${c.E.name(c.s, c.self)} ไปวางที่ Magic Zone`, ops: [{ op: "move", i: c.self.i, to: "mg", seat: c.seat }] } : { explain: "", ops: [] }),
    aura: (E, s, src, L) => (L.z === "mg" && src.on == null ? [{ seat: L.p, test: (y) => syCount(E, s, y) >= 2, n: 1 }] : []) },
  // ฮอล นักบวช: attacking or giving สามัคคี with กุ่ย / นาย beside it: +2
  "BT12-020": { attack: (c) => { const { E, s, seat: p, self: x } = c; return x && s.P[p].av.some((y) => E.named(s, y, "กุ่ย") || E.named(s, y, "นาย")) ? { explain: "POWER +2 จนจบเทิร์น", ops: [{ op: "power", i: x.i, n: 2, temp: true }] } : { explain: "", ops: [] }; },
    helperOk: (E, s, y) => { const L = E.locate(s, y.i); return !!L && s.P[L.p].av.some((z) => E.named(s, z, "กุ่ย") || E.named(s, z, "นาย")); }, helper: (c) => (c.self ? { explain: "POWER +2 จนจบเทิร์น", ops: [{ op: "power", i: c.self.i, n: 2, temp: true }] } : { explain: "", ops: [] }) },
  // รัททาทุยต่างโลก: from hell, exiled: a {รัททาทุย} of ours +1
  "BT12-021": { activate: { label: "เนรเทศจากนรก: รัททาทุย ฝ่ายเรา POWER +1", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.some((y) => sy(E, s, y, "รัททาทุย")),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => sy(E, s, y, "รัททาทุย")).sort(strongFirst(E, s)), 1, "เลือก รัททาทุย ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `เนรเทศ ${E.name(s, x)} · ${E.name(s, t)} POWER +1`, ops: [{ op: "exile", i: x.i }, { op: "power", i: t.i, n: 1, temp: true }] } : { explain: "", ops: [] }; } } },
  // มาร์โกต์: จุติ the cheapest Avatar in their hell becomes our ข้ารับใช้ on the Magic Zone · other มนุษย์ดาว R18 +1
  "BT12-022": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[1 - p].hell.filter((y) => isAv(E, s, y)).sort((a, b) => (E.def(s, a).c || 0) - (E.def(s, b).c || 0))[0]; return t ? { explain: `${E.name(s, t)} มาเป็นข้ารับใช้ของ มนุษย์ดาว R18`, ops: [{ op: "enslave", i: t.i, seat: p }] } : { explain: "ไม่มี Avatar ในนรกฝ่ายตรงข้าม", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i !== src.i && E.named(s, y, "มนุษย์ดาว R18"), n: 1 }] : []) },
  // คุณบ๊วบ: once per turn a {ปลา} from our hell on top of the Deck
  "BT12-023": { activate: { label: "ปลา จากนรกไว้บนสุดของ Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hell.some((y) => isAv(E, s, y) && sy(E, s, y, "ปลา")),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && sy(E, s, y, "ปลา")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ปลา ในนรก", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไว้บนสุดของ Deck`, ops: [{ op: "move", i: t.i, to: "deckTop" }] } : { explain: "", ops: [] }; } } },
  // โจผี: จุติ scout 3 for a วุยก๊ก · their Battle Phase starts: one of theirs must attack
  "BT12-026": { summon: (c) => { const { E, s, seat: p } = c; const room = E.avatars(s.P[p]) < 4; const { top, t } = scoutPick(c, 3, (y) => room && isAv(E, s, y) && E.named(s, y, "วุยก๊ก"), "เลือก วุยก๊ก อัญเชิญ", { optional: true }); return top.length ? { explain: `สอดแนม ${top.length} ใบ${t ? ` · อัญเชิญ ${E.name(s, t)}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "put", i: t.i }] : []), ...restOps(p, top, t ? [t] : [], "shuffle")] } : { explain: "", ops: [] }; },
    oppBattleStartOk: (E, s, y, Ly) => Ly.z === "av" && s.P[1 - Ly.p].av.some((z) => z.a && !E.noAim(s, z)), oppBattleStart: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => y.a && !E.noAim(s, y)).sort((a, b) => E.power(s, a) - E.power(s, b)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่ต้องโจมตี", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ต้องโจมตีถ้าทำได้ในเทิร์นนี้`, ops: [{ op: "flagSet", i: t.i, k: "mustAtk" }] } : { explain: "", ops: [] }; } },
});
Object.assign(SCRIPTS, {
  // อีสานสลิงเกอร์ ปัณณ์: จุติ with โคกอีสานนูน mill 3, may return an อีสานสลิงเกอร์ from hell to the Deck · our อีสานสลิงเกอร์'s attack retargeted: destroy a card of theirs
  "BT12-029": { summon: (c) => { const { E, s, seat: p } = c; if (!(E.lands(s).some((l) => E.named(s, l, "โคกอีสานนูน")))) return { explain: "ไม่มี โคกอีสานนูน", ops: [] }; const t = s.P[p].hell.filter((y) => isan(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0];
      return { explain: `ธรณีสูบ 3 ใบ${t ? ` · ${E.name(s, t)} กลับเข้า Deck` : ""}`, ops: [{ op: "mill", seat: p, n: 3 }, ...(t ? [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }] : [])] }; },
    retargetOk: (E, s, y, L) => L.z === "av" && !!s.pend && s.pend.by === L.p && (() => { const A = E.locate(s, s.pend.att); return !!A && isan(E, s, A.x); })(), retarget: (c) => { const { E, s, seat: p } = c; const t = c.choose(foeField(E, s, p).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดบนสนามฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "อีสานสลิงเกอร์ ปัณณ์" }] } : { explain: "", ops: [] }; } },
  // ตะเคียนทอง: with another {ผี}: a Mod from our hell worn (our Mod), then may make a foe {ผี} until the end of their turn
  "BT12-030": { activate: { label: "Mod จากนรกสวมใส่การ์ดใบนี้", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !s.mu[L.p].D && s.P[L.p].av.some((y) => y.i !== x.i && ghost(E, s, y)) && s.P[L.p].hell.some((y) => E.def(s, y).st === "D" && !E.def(s, y).o1 && E.modOk(s, y, x)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const m = c.choose(s.P[p].hell.filter((y) => E.def(s, y).st === "D" && !E.def(s, y).o1 && E.modOk(s, y, x)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Mod ในนรก", { exact: true })[0]; if (!m) return { explain: "", ops: [] }; const f = c.choose(bestFoe(E, s, p), 1, "เลือก Avatar ฝ่ายตรงข้ามให้เป็น {ผี} (ไม่บังคับ)", { optional: true })[0];
      return { explain: `${E.name(s, m)} สวมใส่ให้ ${E.name(s, x)}${f ? ` · ${E.name(s, f)} เป็น {ผี}` : ""}`, ops: [{ op: "attach", i: m.i, on: x.i }, { op: "mu", k: "D" }, ...(f ? [{ op: "xsyOnly", i: f.i, k: "ผี", until: s.turn + 1 }] : [])] }; } } },
  // นางตานีด่าง: base POWER 2 per {ผี} on our zone · once per turn with 3+ {ผี}: base halved, and it may attack twice this turn
  "BT12-031": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: (src.tani ? 1 : 2) * s.P[L.p].av.filter((y) => ghost(E, s, y)).length - (E.def(s, src).pw || 0) }] : []),
    activate: { label: "POWER ตั้งต้นลดครึ่ง: โจมตีได้ 2 เป้าหมาย (2 ครั้ง) ในเทิร์นนี้", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.filter((y) => ghost(E, s, y)).length >= 3, run: (c) => ({ explain: `${c.E.name(c.s, c.self)} POWER ตั้งต้นลดลงครึ่งหนึ่ง · โจมตีได้ 2 ครั้งในเทิร์นนี้`, ops: [{ op: "flagSet", i: c.self.i, k: "tani", v: true }, { op: "flagSet", i: c.self.i, k: "twice" }] }) },
    atkEndOk: (E, s, x) => x.twice === s.turn && x.twiceUsed !== s.turn, atkEnd: (c) => (c.self ? { explain: "เลือกเป้าหมายที่ 2: กลับมาตื่นเพื่อโจมตีอีกครั้ง", ops: [{ op: "flagSet", i: c.self.i, k: "twiceUsed" }, { op: "wake", i: c.self.i }] } : { explain: "", ops: [] }) },
  // ผีตายาย: fighting a {ผี}: base POWER becomes 8
  "BT12-032": { fight: (c) => { const { E, s, self: x } = c; const f = x && foeOf(E, s, x); return f && ghost(E, s, f) ? { explain: "POWER ตั้งต้นเป็น 8", ops: [{ op: "ovSet", i: x.i, ov: { pw: 8 } }] } : { explain: "", ops: [] }; } },
  // เฟริส สาวจิไรเคย์: จุติ damage our LIFE once: draw 1
  "BT12-033": { summon: (c) => { const { E, s, seat: p } = c; if (E.critical(s.P[p])) return { explain: "สาหัส: ไม่ใช้", ops: [] }; if (c.mode(["ไม่ใช้", "ทำความเสียหาย LIFE เรา 1 ครั้ง: จั่ว 1 ใบ"], "เฟริส สาวจิไรเคย์", facedUp(s, p) <= 2 ? 1 : 0) !== 1) return { explain: "ไม่ใช้", ops: [] }; return { explain: "LIFE เราเสียหาย 1 ครั้ง · จั่ว 1 ใบ", ops: [{ op: "lifeDamage", seat: p }, { op: "draw", seat: p, n: 1 }] }; } },
  // คาไม แม่มดไอที: from the hand when they use a Magic and our field has 2+ Symbols: summoned with จุติ (once a turn) · จุติ discard 1: a foe -1 per Symbol · once per turn (not the turn it came) its จุติ again · counts as {คน}
  "BT12-034": { extraSy: "คน", handMagicOk: (E, s, y) => once(s, y.o, "คาไม") && distinctSy(E, s, y.o) >= 2 && E.avatars(s.P[y.o]) < 4, handMagic: (c) => { const { E, s, seat: p, self: x } = c; if (!x || !once(s, p, "คาไม") || E.locate(s, x.i)?.z !== "hand") return { explain: "", ops: [] }; return { explain: `อัญเชิญ จุติ ${E.name(s, x)} จากมือ`, ops: [{ op: "nameOnce", seat: p, name: "คาไม" }, { op: "put", i: x.i, jt: true }] }; },
    summon: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const n = distinctSy(E, s, p); const t = bestFoe(E, s, p)[0]; if (!pay || !t) return { explain: "", ops: x ? [{ op: "flagSet", i: x.i, k: "sumt" }] : [] };
      return { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} POWER -${n}`, ops: [...(x ? [{ op: "flagSet", i: x.i, k: "sumt" }] : []), { op: "discard", seat: p, iids: [pay.i] }, { op: "power", i: t.i, n: -n, temp: true }] }; },
    activate: { label: "ทำความสามารถ จุติ อีกครั้ง", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && x.sumt !== s.turn && (E.summonedNow(s, L.p) || []).indexOf(E.def(s, x).n) < 0 && s.P[L.p].hand.length > 0, run: (c) => ({ explain: "จุติอีกครั้ง", ops: [{ op: "reSummon", i: c.self.i }] }) } },
  // หัวหน้าชนเผ่าสายตาดี: จุติ scout 4 for ผู้รู้ความจริง / ชนเผ่าสายตาดี; if found, one of ours +1
  "BT12-035": { summon: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 4, (y) => isAv(E, s, y) && (E.named(s, y, "ผู้รู้ความจริง") || E.named(s, y, "ชนเผ่าสายตาดี")), "เลือก ผู้รู้ความจริง หรือ ชนเผ่าสายตาดี", { optional: true }); if (!top.length) return { explain: "", ops: [] };
    const b = t ? s.P[p].av.sort(strongFirst(E, s))[0] : null; const where = c.mode(["การ์ดที่เหลือไว้บนสุดของ Deck", "การ์ดที่เหลือไว้ล่างสุดของ Deck"], "หัวหน้าชนเผ่าสายตาดี", 1);
    return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}${b ? ` · ${E.name(s, b)} POWER +1` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...(b ? [{ op: "power", i: b.i, n: 1, temp: true }] : []), ...restOps(p, top, t ? [t] : [], where === 0 ? "top" : "bottom")] }; } },
  // บัซ: +2 in our turn beside another อัศวินตลิ่งชัน · คำสั่งเสีย worn by a เซอร์นัท
  "BT12-037": { aura: (E, s, src, L) => (L.z === "av" && s.active === L.p && s.P[L.p].av.some((y) => y.i !== src.i && E.named(s, y, "อัศวินตลิ่งชัน") && E.def(s, y).n !== E.def(s, src).n) ? [{ seat: L.p, test: (y) => y.i === src.i, n: 2 }] : []),
    death: (c) => { const { E, s, seat: p, self: x } = c; const t = s.P[p].av.filter((y) => E.named(s, y, "เซอร์นัท")).sort(strongFirst(E, s))[0]; return x && t && E.locate(s, x.i)?.z === "hell" ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, t)}`, ops: [{ op: "attach", i: x.i, on: t.i }] } : { explain: "", ops: [] }; } },
  // แม่นางลิ: ลิโป้ {ต่างชาติ} may use the GEM of ขุนพล-text cards exiled from our hell · once per turn discard 1: a ขุนพล-text Magic from the Deck
  "BT12-039": { hellGem: (E, s, y, Ly, x) => (Ly.z === "av" && isAv(E, s, x) && E.named(s, x, "ลิโป้") && sy(E, s, x, "ต่างชาติ") ? s.P[Ly.p].hell.filter((z) => textHas(E, s, z, "ขุนพล")).map((z) => z.i) : []),
    activate: { label: "ทิ้ง 1 ใบ: Magic ที่มี ขุนพล จาก Deck ขึ้นมือ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => E.def(s, y).t === "M" && textHas(E, s, y, "ขุนพล")),
      run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => E.def(s, y).t === "M" && textHas(E, s, y, "ขุนพล"))), 1, "เลือก Magic ที่มี ขุนพล", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "", ops: [] }; } } },
  // เซ็กเธาว์: from the hand worn by กวนอู (+1 per other จ๊กก๊ก) or ลิโป้ (+1, no POWER loss) · one on the field · counts as {ต่างชาติ}, pays only for ขุนพล {ต่างชาติ}
  "BT12-040": { extraSy: "ต่างชาติ", payOnly: (td) => td.t === "A" && String(td.n || "").includes("ขุนพล") && String(td.sy || "").includes("ต่างชาติ"),
    activate: { label: "สวมใส่ให้ กวนอู หรือ ลิโป้", can: (E, s, x, L) => L.z === "hand" && s.phase === "main" && !s.P[L.p].mg.some((m) => E.def(s, m).n === E.def(s, x).n) && s.P[L.p].av.some((y) => E.named(s, y, "กวนอู") || E.named(s, y, "ลิโป้")),
      run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => E.named(s, y, "กวนอู") || E.named(s, y, "ลิโป้")).sort(strongFirst(E, s)), 1, "เลือก กวนอู หรือ ลิโป้", { exact: true })[0]; return t ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, t)}`, ops: [{ op: "attach", i: x.i, on: t.i }] } : { explain: "", ops: [] }; } },
    worn: (E, s, m, h) => { const L = E.locate(s, h.i); if (!L) return 0; if (E.named(s, h, "กวนอู")) return s.P[L.p].av.filter((y) => y.i !== h.i && E.named(s, y, "จ๊กก๊ก")).length; return E.named(s, h, "ลิโป้") ? 1 : 0; }, noLower: (E, s, m, h) => E.named(s, h, "ลิโป้") },
  // เกดุ ฮีโร่วัยเยาว์: จุติ scout 7 for หนึ่งเดียวเพื่อทุกอย่าง worn (our Mod) · its fight win, exile that card: 3 LIFE damage · cannot attack without it · no POWER from other cards but it
  "BT12-042": { soloPower: "หนึ่งเดียวเพื่อทุกอย่าง", noAttack: (E, s, x) => !wornOn(s, x).some((m) => E.named(s, m, "หนึ่งเดียวเพื่อทุกอย่าง")),
    summon: (c) => { const { E, s, seat: p, self: x } = c; const top = s.P[p].deck.slice(0, 7); const t = top.find((y) => E.named(s, y, "หนึ่งเดียวเพื่อทุกอย่าง")); return top.length ? { explain: `สอดแนม ${top.length} ใบ${t && x ? ` · ${E.name(s, t)} สวมใส่ให้การ์ดใบนี้` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t && x ? [{ op: "attach", i: t.i, on: x.i }, { op: "mu", k: "D" }] : []), { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; },
    kill: (c) => { const { E, s, seat: p, self: x } = c; const m = x ? wornOn(s, x).find((z) => E.named(s, z, "หนึ่งเดียวเพื่อทุกอย่าง")) : null; return m ? { explain: `เนรเทศ ${E.name(s, m)} · ทำความเสียหายต่อ LIFE ฝ่ายตรงข้าม 3 ครั้ง`, ops: [{ op: "exile", i: m.i }, { op: "lifeDamage", seat: 1 - p }, { op: "lifeDamage", seat: 1 - p }, { op: "lifeDamage", seat: 1 - p }] } : { explain: "", ops: [] }; } },
  // Overdose แอมเฟสต้า: in Overdose, our other Overdose +1 · once per turn our other-name Overdose going to sleep wake up · only Overdose Avatars of ours may use abilities
  "BT12-043": { aura: (E, s, src, L) => (L.z === "av" && E.overdose(s, L.p) ? [{ seat: L.p, test: (y) => y.i !== src.i && odAv(E, s, y), n: 1 }] : []), onlyActs: (E, s, y, x) => odAv(E, s, x),
    allySleptOk: (E, s, y, z) => odAv(E, s, z) && E.def(s, z).n !== E.def(s, y).n && once(s, y.o, "แอมเฟสต้า"), allySlept: (c) => { const { E, s, seat: p } = c; const ids = (c.t.ids || []).filter((i) => (E.locate(s, i) || {}).z === "av"); return ids.length && once(s, p, "แอมเฟสต้า") ? { explain: "Avatar Overdose กลับมาตื่น", ops: [{ op: "nameOnce", seat: p, name: "แอมเฟสต้า" }, ...ids.map((i) => ({ op: "wake", i }))] } : { explain: "", ops: [] }; } },
  // บันบัน: จุติ a Token สัตว์ในตำนาน · 5+ Symbols on our field: its LIFE hits deal 2 · counts as {สัตว์}
  "BT12-045": { extraSy: "สัตว์", summon: (c) => ({ explain: "อัญเชิญ Token สัตว์ในตำนาน", ops: [{ op: "token", seat: c.seat, name: "สัตว์ในตำนาน", power: 2, cost: 2, symbol: "สัตว์วิเศษ", color: "เขียว" }] }), lifeHits: (E, s, x) => { const L = E.locate(s, x.i); return L && distinctSy(E, s, L.p) >= 5 ? 2 : 1; } },
  // นักยุทธศาสตร์แห่งภาคีมะม่วง: จุติ a ต้นมะม่วง from hell: +2 and the mango last words · คำสั่งเสีย back to the Magic Zone
  "BT12-046": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.find((y) => isTree(E, s, y)); return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก POWER +2`, ops: [{ op: "put", i: t.i }, { op: "power", i: t.i, n: 2, temp: false }, { op: "flagSet", i: t.i, k: "mgo", v: true }] } : { explain: "ไม่มี ต้นมะม่วง ในนรก", ops: [] }; }, death: mangoDeath },
  // เจ้าความเร็วแห่งภาคีมะม่วง: once per turn attacking with a ต้นมะม่วง on our Magic Zone: wakes · คำสั่งเสีย back to the Magic Zone
  "BT12-047": { attack: (c) => { const { E, s, seat: p, self: x } = c; return x && mangoTree(E, s, p) > 0 && once(s, p, "เจ้าความเร็ว:" + x.i) ? { explain: "กลับมาตื่น", ops: [{ op: "nameOnce", seat: p, name: "เจ้าความเร็ว:" + x.i }, { op: "wake", i: x.i }] } : { explain: "", ops: [] }; }, death: mangoDeath },
  // ฮองตง: จุติ a เล่าปี่ {ต่างชาติ} from hell · with 3+ green ขุนพล {ต่างชาติ} base POWER 5
  "BT12-050": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.find((y) => isAv(E, s, y) && E.named(s, y, "เล่าปี่") && sy(E, s, y, "ต่างชาติ")); return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "ไม่มี เล่าปี่ ในนรก", ops: [] }; },
    aura: (E, s, src, L) => (L.z === "av" && s.P[L.p].av.filter((y) => greenGeneral(E, s, y)).length >= 3 ? [{ seat: L.p, test: (y) => y.i === src.i, n: 5 - (E.def(s, src).pw || 0) }] : []) },
  // อุยเอี๋ยน: paying for a ขุนพล {ต่างชาติ} it adds the GEM of a green ขุนพล {ต่างชาติ} exiled from our hell
  "BT12-051": { gemFor: (td, E, s, x, p) => { if (!td || td.t !== "A" || !String(td.n || "").includes("ขุนพล") || !String(td.sy || "").includes("ต่างชาติ")) return null; const best = s.P[p].hell.filter((y) => y !== x && greenGeneral(E, s, y)).reduce((m, y) => Math.max(m, E.def(s, y).g || 0), 0); return (E.def(s, x).g || 0) + best; },
    paidFor: (d) => d.t === "A" && String(d.n || "").includes("ขุนพล") && String(d.sy || "").includes("ต่างชาติ"), paid: (c) => { const { E, s, seat: p, self: me } = c; const t = s.P[p].hell.filter((y) => y !== me && greenGeneral(E, s, y)).sort((a, b) => (E.def(s, b).g || 0) - (E.def(s, a).g || 0))[0]; return t ? { explain: `เนรเทศ ${E.name(s, t)} จากนรก (ใช้ GEM ร่วมกับ อุยเอี๋ยน)`, ops: [{ op: "exile", i: t.i }] } : { explain: "", ops: [] }; } },
});
Object.assign(SCRIPTS, {
  // กุนซือลงสนาม: show an Only ขุนพล from anywhere: a same-colour กุนซือ from the Deck with จุติ, and it is also named ขุนพล
  "BT12-055": { canCast: (E, s, p) => E.avatars(s.P[p]) < 4 && [...s.P[p].hand, ...s.P[p].av, ...s.P[p].deck, ...s.P[p].hell].some((y) => isAv(E, s, y) && E.named(s, y, "ขุนพล") && E.def(s, y).o1),
    cast: (c) => { const { E, s, seat: p } = c; const shows = [...s.P[p].hand, ...s.P[p].av, ...s.P[p].deck, ...s.P[p].hell].filter((y) => isAv(E, s, y) && E.named(s, y, "ขุนพล") && E.def(s, y).o1); const ok = (sh) => s.P[p].deck.some((y) => isAv(E, s, y) && E.named(s, y, "กุนซือ") && E.colors(s, y).some((k) => E.colors(s, sh).includes(k)));
      const sh = c.choose(shows.sort((a, b) => (ok(b) ? 1 : 0) - (ok(a) ? 1 : 0)), 1, "เลือก Avatar ขุนพล (Only) ที่จะแสดง", { exact: true, reveal: true })[0]; if (!sh) return { explain: "", ops: [] }; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && E.named(s, y, "กุนซือ") && E.colors(s, y).some((k) => E.colors(s, sh).includes(k)))), 1, "เลือก กุนซือ สีเดียวกันจาก Deck", { exact: true })[0];
      return { explain: `แสดง ${E.name(s, sh)}${t ? ` · อัญเชิญ จุติ ${E.name(s, t)} (ได้รับชื่อ ขุนพล)` : " · ไม่มีกุนซือสีเดียวกัน"}`, ops: [...(t ? [{ op: "put", i: t.i, jt: true }, { op: "xn", i: t.i, name: "ขุนพล" }] : []), { op: "shuffle", seat: p }] }; } },
  // ไม่สนจั่วอยู่ดี: everyone discards their hand and draws that many (not on the first turn)
  "BT12-056": { canCast: (E, s) => s.turn > 1, cast: (c) => { const { s, seat: p, self: x } = c; const a = s.P[p].hand.filter((y) => y !== x), b = s.P[1 - p].hand; return { explain: `ทิ้งมือทั้งหมด · เราจั่ว ${a.length} ใบ ฝ่ายตรงข้ามจั่ว ${b.length} ใบ`, ops: [{ op: "discard", seat: p, iids: a.map((y) => y.i) }, { op: "discard", seat: 1 - p, iids: b.map((y) => y.i) }, ...(a.length ? [{ op: "draw", seat: p, n: a.length }] : []), ...(b.length ? [{ op: "draw", seat: 1 - p, n: b.length }] : [])] }; } },
  // กองทัพรุกราน: up to 2 กองทัพปีศาจ from our dark zone, or 1 from hell; destroyed at this End Phase
  "BT12-057": { canCast: (E, s, p) => E.avatars(s.P[p]) < 4 && [...s.P[p].dark, ...s.P[p].hell].some((y) => army(E, s, y)),
    cast: (c) => { const { E, s, seat: p } = c; const dk = s.P[p].dark.filter((y) => army(E, s, y)), hl = s.P[p].hell.filter((y) => army(E, s, y)); const opts = [...(dk.length ? [0] : []), ...(hl.length ? [1] : [])]; if (!opts.length) return { explain: "", ops: [] };
      const m = opts[c.mode(opts.map((k) => (k === 0 ? "1) กองทัพปีศาจ จากมิติมืด สูงสุด 2 ใบ" : "2) กองทัพปีศาจ จากนรก 1 ใบ")), "กองทัพรุกราน", 0)]; const ts = c.choose((m === 0 ? dk : hl).sort((a, b) => worth(E, s, b) - worth(E, s, a)), Math.min(m === 0 ? 2 : 1, freeAv(E, s, p)), "เลือก กองทัพปีศาจ", {});
      return { explain: `อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ")} · ถูกทำลายในช่วง End Phase`, ops: [...ts.map((y) => ({ op: "put", i: y.i })), { op: "atEnd", turn: s.turn, why: "กองทัพรุกราน: ทำลาย Avatar ที่ถูกอัญเชิญ", ops: ts.map((y) => ({ op: "destroy", i: y.i, why: "กองทัพรุกราน" })) }] }; } },
  // ฉันทิ้งชื่อตัวเองไปแล้ว: name an Avatar in our hell: one of ours gets all its Symbols this turn
  "BT12-058": { canCast: (E, s, p) => s.P[p].hell.some((y) => isAv(E, s, y)) && s.P[p].av.length > 0,
    cast: (c) => { const { E, s, seat: p } = c; const src = c.choose(uniq(E, s, s.P[p].hell.filter((y) => isAv(E, s, y))).sort((a, b) => syCount(E, s, b) - syCount(E, s, a)), 1, "ประกาศชื่อ Avatar ในนรก", { exact: true, reveal: true })[0]; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; if (!src || !t) return { explain: "", ops: [] };
      const list = SYMS.filter((k) => E.hasSy(s, src, k)); return { explain: `ประกาศ ${E.name(s, src)} · ${E.name(s, t)} ได้รับ Symbol ${list.join(", ")}`, ops: [{ op: "xsy", i: t.i, list }] }; } },
  // คาถาอัดคาบ้าน: 3+ จอมเวทย์ on our zone: the opponent cannot use React cards this turn
  "BT12-059": { canCast: (E, s, p) => s.P[p].av.filter((y) => wizard(E, s, y)).length >= 3, cast: () => ({ explain: "ฝ่ายตรงข้ามใช้ React ไม่ได้จนจบเทิร์น", ops: [{ op: "stateSet", k: "noReact", why: "คาถาอัดคาบ้าน: ฝ่ายตรงข้ามใช้การ์ด React ไม่ได้จนจบเทิร์น" }] }) },
  // ความสบายตาที่แท้จริง: one of ours +2, and the opponent picks its attack targets until the end of our turn
  "BT12-060": { canCast: (E, s, p) => s.P[p].av.length > 0, cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} POWER +2 · ฝ่ายตรงข้ามเลือกเป้าหมายการโจมตีให้`, ops: [{ op: "power", i: t.i, n: 2, temp: true }, { op: "flagSet", i: t.i, k: "picky" }] } : { explain: "", ops: [] }; } },
  // ฉิบหายการช่าง: two different appliances to our Magic Zone, or a เบเซอร์ of Cost 6+ to the hand
  "BT12-061": { cast: (c) => { const { E, s, seat: p } = c; const ap = uniq(E, s, s.P[p].deck.filter((y) => appliance(E, s, y))); const bz = s.P[p].deck.filter((y) => E.named(s, y, "เบเซอร์") && (E.def(s, y).c || 0) >= 6); const m = c.mode(["1) เครื่องใช้ไฟฟ้า ชื่อต่างกัน 2 ใบ ไปวางบน Magic Zone", "2) เบเซอร์ Cost 6 ขึ้นไป ขึ้นมือ"], "ฉิบหายการช่าง", ap.length >= 2 || !bz.length ? 0 : 1);
    if (m === 0) { const ts = c.choose(ap.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 2, "เลือก เครื่องใช้ไฟฟ้า 2 ใบ (ชื่อต่างกัน)", { exact: true }); return { explain: `${ts.map((y) => E.name(s, y)).join(", ") || "ไม่มี"} ไปวางบน Magic Zone`, ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "mg", seat: p })), { op: "shuffle", seat: p }] }; }
    const t = c.choose(uniq(E, s, bz), 1, "เลือก เบเซอร์", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "ไม่มี เบเซอร์ ใน Deck", ops: [{ op: "shuffle", seat: p }] }; } },
  // ออกอาวุธ ออกอาวุธ: discard 1: a non-Only Mod from the Deck
  "BT12-063": { canCast: (E, s, p) => s.P[p].hand.length >= 2, cast: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose(s.P[p].hand.filter((y) => y !== x).sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => E.def(s, y).st === "D" && !E.def(s, y).o1)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Mod จาก Deck", { exact: true })[0];
    return pay ? { explain: `ทิ้ง ${E.name(s, pay)}${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, t ? { op: "search", seat: p, take: t.i, to: "hand" } : { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } },
  // ถ้าเป็นฮิมไลน์ก็คงทำแบบนี้: another of ours attacked, a Mod on ฮิมไลน์ under the Deck: the attack goes to ฮิมไลน์
  "BT12-065": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; const h = s.P[p].av.find((y) => E.named(s, y, "ฮิมไลน์")); return !!T && T.p === p && !!h && T.x.i !== h.i && wornOn(s, h).some((m) => E.def(s, m).st === "D"); }, botV: () => 3 },
    cast: (c) => { const { E, s, seat: p } = c; const h = s.P[p].av.find((y) => E.named(s, y, "ฮิมไลน์")); const m = h ? wornOn(s, h).filter((z) => E.def(s, z).st === "D").sort(cheapCard(E, s))[0] : null; return h && m ? { explain: `${E.name(s, m)} กลับเข้าใต้ Deck · เปลี่ยนเป้าหมายไปที่ ${E.name(s, h)}`, ops: [{ op: "move", i: m.i, to: "deckBottom" }, { op: "redirect", i: h.i }] } : { explain: "", ops: [] }; } },
  // โอเปอเรชั่น : สกายฟอลล์: our หน่วยรบ XVI fights in their turn: scout 3, dump a หน่วยรบ XVI / โอเปอเรชั่น: destroy the foe it fights
  "BT12-066": { react: { kinds: ["attack"], can: (E, s, p, on) => { const T = on.tk === "av" ? E.locate(s, on.ti) : null; return s.active !== p && !!T && T.p === p && unitXVI(E, s, T.x) && s.P[p].deck.length > 0; }, botV: () => 3 },
    cast: (c) => { const { E, s, seat: p } = c; const on = onTarget(c); const top = s.P[p].deck.slice(0, 3); const d = c.choose(top.filter((y) => unitXVI(E, s, y) || E.named(s, y, "โอเปอเรชั่น")), 1, "เลือก หน่วยรบ XVI หรือ โอเปอเรชั่น ทิ้งลงนรก", { optional: true, reveal: true })[0]; const A = on.att != null ? E.locate(s, on.att) : null;
      return { explain: `สอดแนม ${top.length} ใบ${d ? ` · ทิ้ง ${E.name(s, d)}${A ? " · ทำลาย " + E.name(s, A.x) : ""}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(d ? [{ op: "move", i: d.i, to: "hell", dump: true }, ...(A ? [{ op: "destroy", i: A.x.i, why: "โอเปอเรชั่น : สกายฟอลล์" }] : [])] : []), ...restOps(p, top, d ? [d] : [], "bottom")] }; } },
  // มือเปรี๊ยะ: they take a card from the Deck (not the Draw Phase draw): exile a random card from their hand
  "BT12-067": { react: { kinds: ["handed"], can: (E, s, p, on) => on.by === 1 - p && s.P[1 - p].hand.length > 0, botV: () => 3 }, cast: (c) => ({ explain: "สุ่มเนรเทศการ์ดบนมือฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "exileRandom", seat: 1 - c.seat, n: 1 }] }) },
  // สมบัติศักดิ์สิทธิ์ แอสคาลอน: on ฮิมไลน์: +2 fighting {นรก} and unaffected by {นรก} cards · back to the Deck instead of going to hell with its wearer · up to 2 on our Magic Zone
  "BT12-068": { modOnly: (E, s, h) => { const L = E.locate(s, h.i); return !(L && s.P[L.p].mg.filter((z) => z.on != null && E.named(s, z, "สมบัติศักดิ์สิทธิ์")).length >= 2); }, fallTo: "deck",
    hostFight: (c) => { const { E, s, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; const F = c.t.foe != null ? E.locate(s, c.t.foe) : null; return H && F && E.named(s, H.x, "ฮิมไลน์") && sy(E, s, F.x, "นรก") ? { explain: `${E.name(s, H.x)} POWER +2 จนจบการต่อสู้`, ops: [{ op: "power", i: H.x.i, n: 2, temp: "fight" }] } : { explain: "", ops: [] }; },
    proofFrom: (E, s, m, host, src) => E.named(s, host, "ฮิมไลน์") && String(src.sy || "").includes("นรก") },
  // ชิป Tank Ranger A.I.: only on a {หุ่นยนต์} รถถัง, +2 · pays only for รถถัง {หุ่นยนต์} or Tank Ranger
  "BT12-069": { modOnly: (E, s, h) => E.named(s, h, "รถถัง") && sy(E, s, h, "หุ่นยนต์"), worn: () => 2, payOnly: (td) => td.t === "A" && ((String(td.n || "").includes("รถถัง") && String(td.sy || "").includes("หุ่นยนต์")) || String(td.n || "").includes("Tank Ranger")) },
  // อาวุธของเพมมุ มาโกะชิลด์: เพมมุ only (one อาวุธของเพมมุ) · destroyed instead of its wearer · start of our Main Phase: flip our top LIFE or this goes to hell
  "BT12-070": { modOnly: (E, s, h) => { const L = E.locate(s, h.i); return E.named(s, h, "เพมมุ") && !(L && s.P[L.p].mg.some((z) => z.on != null && E.named(s, z, "อาวุธของเพมมุ"))); }, shield: true,
    mainStart: (c) => { const { E, s, seat: p, self: m } = c; if (!m || m.on == null) return { explain: "", ops: [] }; const best = E.critical(s.P[p]) || s.P[p].life.filter((y) => !y.up).length <= 2 ? 1 : 0; return c.mode(["หงาย LIFE ใบบนสุดของเรา 1 ใบ", "ส่งการ์ดใบนี้ลงนรก"], E.name(s, m), best) === 0 ? { explain: "หงาย LIFE ใบบนสุด 1 ใบ", ops: [{ op: "lifeFlip", seat: p }] } : { explain: `${E.name(s, m)} ลงนรก`, ops: [{ op: "move", i: m.i, to: "hell" }] }; } },
  // โลกระหว่างความเป็นและความตาย: {ผี} +1, {คน} -1
  "BT12-071": { aura: (E, s, src, L) => (L.z === "land" ? [0, 1].flatMap((q) => [{ seat: q, test: (y) => ghost(E, s, y), n: 1 }, { seat: q, test: (y) => sy(E, s, y, "คน"), n: -1 }]) : []) },
  // อาณาจักรแห่งเกียรติภูมิ อวาลอน: once per turn scout 1: a Cost ≤5 อัศวินโต๊ะกลม or เมอลิน is summoned with จุติ, otherwise under the Deck
  "BT12-073": { activate: { label: "สอดแนม 1 ใบ: อัศวินโต๊ะกลม หรือ เมอลิน อัญเชิญ จุติ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck[0]; const ok = t && E.avatars(s.P[p]) < 4 && isAv(E, s, t) && ((E.named(s, t, "อัศวินโต๊ะกลม") && (E.def(s, t).c || 0) <= 5) || E.named(s, t, "เมอลิน")); return t ? { explain: `สอดแนม: ${E.name(s, t)}${ok ? " · อัญเชิญ จุติ" : " · ไว้ใต้ Deck"}`, ops: [{ op: "scoutShow", seat: p, ids: [t.i] }, ok ? { op: "put", i: t.i, jt: true } : { op: "move", i: t.i, to: "deckBottom" }] } : { explain: "", ops: [] }; } } },
  // เรือรบโบราณฉวน: once per turn scout 5 for a red ขุนพล {ต่างชาติ}: to the hand, or summoned if Cost ≤4
  "BT12-074": { activate: { label: "สอดแนม 5 ใบ: ขุนพลสีแดง {ต่างชาติ}", can: (E, s, x, L) => L.z === "cs" && s.phase === "main" && s.P[L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p } = c; const { top, t } = scoutPick(c, 5, (y) => redGeneral(E, s, y), "เลือก ขุนพล สีแดง", { optional: true }); if (!top.length) return { explain: "", ops: [] }; const sum = t && (E.def(s, t).c || 0) <= 4 && E.avatars(s.P[p]) < 4 && c.mode(["นำขึ้นมือ", "อัญเชิญลง Avatar Zone"], E.name(s, t), 1) === 1;
      return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ${sum ? "อัญเชิญ" : "ขึ้นมือ"}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [sum ? { op: "put", i: t.i } : { op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] }; } } },
  // โต๊ะกลมของเหล่าอัศวิน: with 4+ อัศวินโต๊ะกลม / เมอลิน: our Avatars +1 and their control cannot change
  "BT12-075": { aura: (E, s, src, L) => (L.z === "cs" && s.P[L.p].av.filter((y) => roundK(E, s, y)).length >= 4 ? [{ seat: L.p, test: () => true, n: 1 }] : []), noSteal: (E, s, y, Ly) => Ly.z === "cs" && s.P[Ly.p].av.filter((z) => roundK(E, s, z)).length >= 4 },
});

// ---------- CC01 ----------
const tankC = (E, s, x) => isAv(E, s, x) && E.named(s, x, "รถถัง");
const controlled = (E, s, p) => s.P[p].av.filter((y) => y.o !== p);
Object.assign(SCRIPTS, {
  // พระนารายณ์ เทพผู้พิทักษ์: once per summon, instead of being destroyed its base POWER is halved
  "CC01-002": { wouldDestroy: (E, s, x, L) => { if (L.z !== "av" || x.hs2) return false; x.hs2 = true; x.ov = { ...(x.ov || {}), pw: Math.floor((E.def(s, x).pw || 0) / 2) }; E.log(s, L.p, `${E.name(s, x)} ไม่ถูกทำลาย: POWER ตั้งต้นลดลงครึ่งหนึ่งแทน (เหลือ ${E.def(s, x).pw})`); return true; } },
  // พระพรหม เทพผู้สร้าง: จุติ with 5+ different Avatars in hell, scout 7: any Avatars of new names summoned
  "CC01-003": { summon: (c) => { const { E, s, seat: p } = c; if (uniq(E, s, s.P[p].hell.filter((y) => isAv(E, s, y))).length < 5) return { explain: "Avatar ในนรกชื่อไม่ซ้ำไม่ถึง 5 ใบ", ops: [] }; const top = s.P[p].deck.slice(0, 7); const have = new Set(s.P[p].av.map((y) => E.def(s, y).n));
    const cand = uniq(E, s, top.filter((y) => E.def(s, y).t === "A" && !have.has(E.def(s, y).n))).sort((a, b) => worth(E, s, b) - worth(E, s, a)); const ts = c.choose(cand, freeAv(E, s, p), "เลือก Avatar ชื่อไม่ซ้ำ อัญเชิญ (กี่ใบก็ได้)", { optional: true }).slice(0, freeAv(E, s, p));
    return { explain: `สอดแนม ${top.length} ใบ · อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...ts.map((y) => ({ op: "put", i: y.i })), ...restOps(p, top, ts, "shuffle")] }; } },
  // ปื๊ดเปรตกังฟู: +1 per face-down LIFE of ours · leaving the field: our top LIFE flips
  "CC01-005": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => y.i === src.i, n: s.P[L.p].life.filter((y) => !y.up).length }] : []), onLeave: (c) => ({ explain: "หงาย LIFE ใบบนสุดของเรา 1 ใบ", ops: [{ op: "lifeFlip", seat: c.seat }] }) },
  // ไตรตัน เจ้าสมุทร: จุติ {ปลา} of total Cost ≤7 from hell · our {ปลา} +1 and สามัคคี
  "CC01-006": { summon: (c) => { const { E, s, seat: p } = c; const pool = s.P[p].hell.filter((y) => isAv(E, s, y) && sy(E, s, y, "ปลา")).sort((a, b) => worth(E, s, b) - worth(E, s, a)); const picks = c.interactive ? c.choose(pool, Math.min(freeAv(E, s, p), pool.length), "เลือก Avatar ปลา (Cost รวมไม่เกิน 7)", { optional: true }) : pool;
      const ts = []; let sum = 0; for (const y of picks) { const k = E.def(s, y).c || 0; if (ts.length < freeAv(E, s, p) && sum + k <= 7) { ts.push(y); sum += k; } } return { explain: ts.length ? `อัญเชิญ ${ts.map((y) => E.name(s, y)).join(", ")} (Cost รวม ${sum})` : "ไม่มีปลาในนรก", ops: ts.map((y) => ({ op: "put", i: y.i })) }; },
    aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (y) => sy(E, s, y, "ปลา"), n: 1, kw: ["สามัคคี"] }] : []) },
  // วีรบุรุษสุดซอย: จุติ กุ่ย, ฮอล and นาย from hell worn · after its attack, wearing all three, to hell: วีรบุรุษปากซอย from the hand or Deck with จุติ
  "CC01-007": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const ts = ["กุ่ย", "ฮอล", "นาย"].map((n) => s.P[p].hell.find((y) => isAv(E, s, y) && E.named(s, y, n))).filter(Boolean); return { explain: ts.length ? `${ts.map((y) => E.name(s, y)).join(", ")} สวมใส่ให้การ์ดใบนี้` : "ไม่มีในนรก", ops: ts.map((y) => ({ op: "attach", i: y.i, on: x.i })) }; },
    atkEndOk: (E, s, x, A) => ["กุ่ย", "ฮอล", "นาย"].every((n) => wornOn(s, x).some((m) => E.named(s, m, n))) && [...s.P[A.p].hand, ...s.P[A.p].deck].some((y) => E.named(s, y, "วีรบุรุษปากซอย")),
    atkEnd: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const h = s.P[p].hand.find((y) => E.named(s, y, "วีรบุรุษปากซอย")); const d = h ? null : s.P[p].deck.find((y) => E.named(s, y, "วีรบุรุษปากซอย")); const t = h || d; if (!t) return { explain: "", ops: [] };
      if (c.mode(["ไม่ใช้", `ส่ง ${E.name(s, x)} ลงนรก: อัญเชิญ จุติ ${E.name(s, t)}`], E.name(s, x), 1) !== 1) return { explain: "ไม่ใช้", ops: [] }; return { explain: `${E.name(s, x)} ลงนรก · อัญเชิญ จุติ ${E.name(s, t)}`, ops: [{ op: "move", i: x.i, to: "hell" }, { op: "put", i: t.i, jt: true }, ...(d ? [{ op: "shuffle", seat: p }] : [])] }; } },
  // ชู้รักรัททาทุย: once we have summoned รัททาทุย นางพญา this game, it is also named that on the Avatar Zone
  "CC01-009": { alsoName: (E, s, x) => { const L = E.locate(s, x.i); return L && L.z === "av" && s.ever && s.ever[L.p] && s.ever[L.p]["รัททาทุย นางพญา"] ? "รัททาทุย นางพญา" : null; } },
  // พญายม With The Shotgun: our {นรก} in hell are named นายนิรยบาล · once per turn a นายนิรยบาล from hell
  "CC01-011": { hellName: (E, s, y, x) => (isAv(E, s, x) && sy(E, s, x, "นรก") ? "นายนิรยบาล" : null),
    activate: { label: "อัญเชิญ นายนิรยบาล จากนรก", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "นายนิรยบาล")),
      run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "นายนิรยบาล")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก นายนิรยบาล ในนรก", { exact: true })[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "put", i: t.i }] } : { explain: "", ops: [] }; } } },
  // เฟรนชี่: คำสั่งเสีย draw 2, then a card from the hand under the Deck
  "CC01-012": { death: (c) => { const { s, seat: p, self: x } = c; return { explain: "จั่ว 2 ใบ · จากนั้นนำการ์ดบนมือ 1 ใบไว้ใต้ Deck", ops: [{ op: "draw", seat: p, n: 2 }, ...(x ? [{ op: "resume", t: { seat: p, i: x.i, c: x.c, when: "putBack" } }] : [])] }; },
    putBack: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "เลือกการ์ดบนมือ 1 ใบ ไว้ล่างสุดของ Deck", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ไว้ล่างสุดของ Deck`, ops: [{ op: "move", i: t.i, to: "deckBottom" }] } : { explain: "", ops: [] }; } },
  // เจนนี่: cannot attack · every End Phase a die: 4 destroys it and flips its controller's LIFE, anything else moves it to the other side
  "CC01-013": { noAttack: () => true, endPhase: (E, s, x, L) => { if (L.z !== "av") return []; const other = E.avatars(s.P[1 - L.p]) < 4 && s.P[1 - L.p].av.length < 6 ? [{ op: "control", i: x.i, seat: 1 - L.p }] : [{ op: "note", text: "Avatar Zone ฝ่ายตรงข้ามเต็ม: เจนนี่ไม่ย้าย" }]; return [{ op: "roll", why: "เจนนี่", cases: { 1: other, 2: other, 3: other, 4: [{ op: "destroy", i: x.i, why: "เจนนี่ ทอยได้ 4" }, { op: "lifeFlip", seat: L.p }], 5: other, 6: other } }]; } },
  // วูตาตู: once per turn worn by one of ours (it becomes {ผี}, +3) · when the wearer is destroyed it moves to another of ours
  "CC01-014": { activate: { label: "สวมใส่ให้ Avatar ฝ่ายเรา", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[L.p].av.some((y) => y.i !== x.i), run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].av.filter((y) => y.i !== x.i).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเราที่จะสวมใส่ วูตาตู", { exact: true })[0]; return t ? { explain: `${E.name(s, x)} สวมใส่ให้ ${E.name(s, t)}`, ops: [{ op: "attach", i: x.i, on: t.i }] } : { explain: "", ops: [] }; } },
    worn: () => 3, syOver: "ผี", toHell: (c) => { const { E, s, seat: p, self: m } = c; if (!m || E.locate(s, m.i)?.z !== "hell") return { explain: "", ops: [] }; const t = [...s.P[p].av].sort(strongFirst(E, s))[0]; return t ? { explain: `${E.name(s, m)} สวมใส่ให้ ${E.name(s, t)}`, ops: [{ op: "attach", i: m.i, on: t.i }] } : { explain: "", ops: [] }; } },
  // แมวนิค: once per turn when an Avatar is summoned it moves to the other side · its controller cannot search the Deck with abilities
  "CC01-016": { anySummonOk: (E, s, y, Ly) => Ly.z === "av" && once(s, 0, "แมวนิค:" + y.i) && once(s, 1, "แมวนิค:" + y.i), anySummon: (c) => { const { E, s, self: x } = c; const L = x ? E.locate(s, x.i) : null; if (!L || L.z !== "av" || !once(s, 0, "แมวนิค:" + x.i) || !once(s, 1, "แมวนิค:" + x.i) || E.avatars(s.P[1 - L.p]) >= 4 || s.P[1 - L.p].av.length >= 6) return { explain: "", ops: [] };
      return { explain: `${E.name(s, x)} ย้ายไปอยู่ฝ่ายตรงข้าม`, ops: [{ op: "nameOnce", seat: 0, name: "แมวนิค:" + x.i }, { op: "nameOnce", seat: 1, name: "แมวนิค:" + x.i }, { op: "control", i: x.i, seat: 1 - L.p }] }; }, blockSearch: true },
  // ยักษ์หินแผ่นดินใหญ่: a Magic aimed at another {ยักษ์} of ours can be moved onto this (it goes to sleep)
  "CC01-017": { magicRedirect: (E, s, y, x) => sy(E, s, x, "ยักษ์") },
  // เสามงคล ทรงจีน: cannot attack · จุติ a ผู้เจริญ from the Deck, back to the hand at the end of the turn
  "CC01-018": { noAttack: () => true, summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck.filter((y) => isAv(E, s, y) && E.named(s, y, "ผู้เจริญ")).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} (กลับขึ้นมือเมื่อจบเทิร์น)`, ops: [{ op: "put", i: t.i }, { op: "shuffle", seat: p }, { op: "atEnd", turn: s.turn, why: `${E.name(s, t)} กลับขึ้นมือ`, ops: [{ op: "move", i: t.i, to: "hand", onlyFrom: "av" }] }] } : { explain: "ไม่มี ผู้เจริญ ใน Deck", ops: [] }; } },
  // หมวดเงียบ: once per turn an awake foe goes to sleep and stays asleep while this stays
  "CC01-019": { activate: { label: "Avatar ฝ่ายตรงข้ามเปลี่ยนเป็นสภาพนอน", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[1 - L.p].av.some((y) => !E.noAim(s, y)), run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort((a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายตรงข้าม", { exact: true })[0];
      return t ? { explain: t.a ? `${E.name(s, t)} เปลี่ยนเป็นสภาพนอน และไม่ตื่นจนกว่า ${E.name(s, x)} จะออกจาก Avatar Zone` : `${E.name(s, t)} ไม่อยู่ในสภาพตื่น`, ops: t.a ? [{ op: "toggle", i: t.i }, { op: "noWake", i: t.i, until: 9999, by: x.i }] : [] } : { explain: "", ops: [] }; } } },
  // ผู้กองอึ่งอ่าง: counts as every Symbol on the Avatar Zone
  "CC01-020": { allSyOnField: true },
  // รู้สึกเหมือนโดนแย่งเมีย: control-changed Avatars go back to their owners
  "CC01-043": { canCast: (E, s) => [0, 1].some((q) => controlled(E, s, q).length), cast: (c) => { const { E, s } = c; const xs = [0, 1].flatMap((q) => controlled(E, s, q)); return { explain: `${xs.map((y) => E.name(s, y)).join(", ")} กลับไปหาเจ้าของ`, ops: xs.map((y) => ({ op: "control", i: y.i, seat: y.o })) }; } },
  // ซ่อมบำรุงประจำปี: they control Avatars and we none: a Cost 3 รถถัง from hell, and a Cost 3 Tank Ranger from hell worn by it
  "CC01-044": { canCast: (E, s, p) => s.P[1 - p].av.length > 0 && s.P[p].av.length === 0 && s.P[p].hell.some((y) => tankC(E, s, y) && (E.def(s, y).c || 0) === 3) && s.P[p].hell.some((y) => isAv(E, s, y) && E.named(s, y, "Tank Ranger") && !E.named(s, y, "รถถัง") && (E.def(s, y).c || 0) === 3),
    cast: (c) => { const { E, s, seat: p } = c; const tk = s.P[p].hell.find((y) => tankC(E, s, y) && (E.def(s, y).c || 0) === 3); const tr = s.P[p].hell.find((y) => isAv(E, s, y) && E.named(s, y, "Tank Ranger") && !E.named(s, y, "รถถัง") && (E.def(s, y).c || 0) === 3); return tk && tr ? { explain: `อัญเชิญ ${E.name(s, tk)} · ${E.name(s, tr)} สวมใส่`, ops: [{ op: "put", i: tk.i }, { op: "attach", i: tr.i, on: tk.i }] } : { explain: "", ops: [] }; } },
  // กฎร้าน: both sides control Avatars: compare the Costs of the bottom Deck cards; the higher side sends a foe to hell or returns an Avatar to its Deck
  "CC01-045": { react: { kinds: ANYR, can: (E, s, p) => s.P[0].av.length > 0 && s.P[1].av.length > 0 && s.P[0].deck.length > 0 && s.P[1].deck.length > 0, botV: () => 1 },
    cast: (c) => { const { E, s, seat: p } = c; const b = [p, 1 - p].map((q) => s.P[q].deck[s.P[q].deck.length - 1]); const cost = (y) => (y && E.def(s, y).t === "A" ? E.def(s, y).c || 0 : 0); const mine = cost(b[0]), theirs = cost(b[1]); const head = `ล่างสุดของ Deck: เรา ${b[0] ? E.name(s, b[0]) : "-"} (${mine}) · ฝ่ายตรงข้าม ${b[1] ? E.name(s, b[1]) : "-"} (${theirs})`;
      if (mine === theirs) return { explain: head + " · เท่ากัน ไม่มีผล", ops: [] }; const w = mine > theirs ? p : 1 - p; const foe = s.P[1 - w].av.sort((a, b2) => worth(E, s, b2) - worth(E, s, a))[0]; if (!foe) return { explain: head, ops: [] };
      if (w === p) { const m = c.mode(["1) ส่ง Avatar ฝ่ายตรงข้าม 1 ใบลงนรก", "2) นำ Avatar บนสนามกลับเข้า Deck เจ้าของ"], "กฎร้าน", 0); const t = c.choose([...s.P[1 - p].av].sort((a, b2) => worth(E, s, b2) - worth(E, s, a)), 1, "เลือก Avatar", { exact: true })[0]; return t ? { explain: `${head} · ${m === 0 ? "ส่ง " + E.name(s, t) + " ลงนรก" : E.name(s, t) + " กลับเข้า Deck"}`, ops: m === 0 ? [{ op: "move", i: t.i, to: "hell" }] : [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: t.o }] } : { explain: head, ops: [] }; }
      return { explain: `${head} · ฝ่ายตรงข้ามเลือก: ส่ง ${E.name(s, foe)} ลงนรก`, ops: [{ op: "move", i: foe.i, to: "hell" }] }; } },
  // ขอให้ทั้งตัวมีแต่---: a fighting Avatar's base POWER becomes 0 until the end of the Battle Phase
  "CC01-046": { react: { kinds: ["attack", "react"], can: (E, s) => !!s.pend && s.pend.tk === "av", botV: (E, s, q) => { const pd = s.pend; const A = pd && E.locate(s, pd.att); return A && A.p !== q && E.power(s, A.x) >= 4 ? 4 : 0; } },
    cast: (c) => { const { E, s, seat: p } = c; const pd = s.pend; if (!pd) return { explain: "", ops: [] }; const xs = [pd.att, pd.ti].map((i) => E.locate(s, i)).filter((L) => L && L.z === "av"); const t = c.choose(xs.map((L) => L.x).sort((a, b) => ((E.locate(s, b.i) || {}).p !== p ? 1 : 0) - ((E.locate(s, a.i) || {}).p !== p ? 1 : 0)), 1, "เลือก Avatar ที่กำลังต่อสู้", { exact: true })[0];
      if (!t) return { explain: "", ops: [] }; const prev = t.ov && t.ov.pw !== undefined ? t.ov.pw : null; return { explain: `${E.name(s, t)} POWER ตั้งต้นเป็น 0 จนจบ Battle Phase`, ops: [{ op: "ovSet", i: t.i, ov: { pw: 0 } }, { op: "atEnd", turn: s.turn, ops: [{ op: "ovSet", i: t.i, ov: { pw: prev } }] }] }; } },
  // ตุ๊กตางูพันคอ: +2 and the wearer must attack if it can
  "CC01-047": { worn: () => 2, hostMust: true },
  // Micro Plaza สะพานพลาสติก: once per turn discard 1: a Mod from the Deck
  "CC01-049": { activate: { label: "ทิ้ง 1 ใบ: นำ Modification Magic จาก Deck ขึ้นมือ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => E.def(s, y).st === "D"),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => E.def(s, y).st === "D")), 1, "เลือก Mod จาก Deck", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "search", seat: p, take: t.i, to: "hand" }] } : { explain: "", ops: [] }; } } },
  // SD Plaza สายเหนือเก่า: once per turn — discard 1: scout 3, an Avatar to our Magic Zone; or an Avatar from our Magic Zone summoned awake
  "CC01-050": { activate: { label: "SD Plaza: เลือกปฏิบัติ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && ((s.P[L.p].hand.length > 0 && s.P[L.p].deck.length > 0) || (E.avatars(s.P[L.p]) < 4 && s.P[L.p].mg.some((m) => m.on == null && isAv(E, s, m)))),
    run: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const opts = [...(P.hand.length && P.deck.length ? [0] : []), ...(E.avatars(P) < 4 && P.mg.some((m) => m.on == null && isAv(E, s, m)) ? [1] : [])]; const m = opts[c.mode(opts.map((k) => (k === 0 ? "1) ทิ้ง 1 ใบ: สอดแนม 3 ใบ Avatar ไปวางบน Magic Zone" : "2) อัญเชิญ Avatar จาก Magic Zone")), "SD Plaza", opts.length - 1)];
      if (m === 1) { const t = c.choose(P.mg.filter((z) => z.on == null && isAv(E, s, z)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar บน Magic Zone", { exact: true })[0]; return t ? { explain: `อัญเชิญ ${E.name(s, t)} จาก Magic Zone`, ops: [{ op: "put", i: t.i, here: true }] } : { explain: "", ops: [] }; }
      const pay = c.choose([...P.hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const { top, t } = scoutPick(c, 3, (y) => isAv(E, s, y), "เลือก Avatar ไปวางบน Magic Zone", { optional: true }); return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ไปวางบน Magic Zone` : ""}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "mg", seat: p }] : []), ...restOps(p, top, t ? [t] : [], "bottom")] } : { explain: "", ops: [] }; } } },
  // สมชายห้องเช่าพันล้าน: once per turn discard 1: a เสามงคล from the Deck · before the Main Phase draw 1 per เสามงคล on your field
  "CC01-051": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญ เสามงคล จาก Deck", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && s.P[L.p].deck.some((y) => isAv(E, s, y) && E.named(s, y, "เสามงคล")),
      run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && E.named(s, y, "เสามงคล"))), 1, "เลือก เสามงคล", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } },
    mainDraw: (E, s, p) => [...s.P[p].av, ...s.P[p].mg, ...s.P[p].cs].filter((y) => E.named(s, y, "เสามงคล")).length },
  // โรงบาล: once per turn discard 1: a Cost ≤3 Avatar from hell to the hand; this turn that name cannot be summoned, use abilities or attack
  "CC01-059": { activate: { label: "ทิ้ง 1 ใบ: Avatar Cost ไม่เกิน 3 จากนรกขึ้นมือ", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].hand.length > 0 && s.P[L.p].hell.some((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 3),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && (E.def(s, y).c || 0) <= 3).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar Cost ไม่เกิน 3 ในนรก", { exact: true })[0];
      return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} ขึ้นมือ (เทิร์นนี้ใช้การ์ดชื่อนี้ไม่ได้)`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "move", i: t.i, to: "hand" }, { op: "stateSet", k: "hosp", name: E.def(s, t).n, why: `โรงบาล: เทิร์นนี้ ${E.def(s, t).n} อัญเชิญ ใช้ความสามารถ และโจมตีไม่ได้` }] } : { explain: "", ops: [] }; } } },
});

// ---------- CC02 (and the counters deferred from BT02/BT05) ----------
const bearShow = (co) => (E, s, p, x) => s.P[p].hand.some((y) => y !== x && isAv(E, s, y) && E.colors(s, y).includes(co));
const richCounter = (react) => ({ magicSeenOk: (E, s, y, Ly, d, by) => Ly.z === "av" && by !== Ly.p && once(s, Ly.p, "คนรวย:" + y.i) && s.P[Ly.p].hand.length > 0 && (!react || !s.mu[Ly.p].R), magicSeen: (c) => richRun(c, c.t.mi, react),
  oppAbilityOk: (E, s, y, Ly) => Ly.z === "av" && once(s, Ly.p, "คนรวย:" + y.i) && s.P[Ly.p].hand.length > 0 && (!react || !s.mu[Ly.p].R), oppAbility: (c) => richRun(c, c.t.ai, react) });
const richRun = (c, mi, react) => { const { E, s, seat: p, self: x } = c; const M = mi != null ? E.locate(s, mi) : null; if (!x || !M || !once(s, p, "คนรวย:" + x.i) || !s.P[p].hand.length) return { explain: "", ops: [] }; const give = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "เลือกการ์ดบนมือ 1 ใบ ให้ฝ่ายตรงข้าม", { exact: true })[0];
  if (!give || c.mode(["ไม่ใช้", `ให้ ${E.name(s, give)} แก่ฝ่ายตรงข้าม: ยกเลิกความสามารถของ ${E.name(s, M.x)}`], E.name(s, x), E.def(s, M.x).t === "M" || worth(E, s, M.x) >= 4 ? 1 : 0) !== 1) return { explain: "ไม่ใช้", ops: [] };
  return { explain: `ให้การ์ด 1 ใบแก่ฝ่ายตรงข้าม · ยกเลิก ${E.name(s, M.x)}`, ops: [{ op: "nameOnce", seat: p, name: "คนรวย:" + x.i }, { op: "giveCard", seat: p, i: give.i }, { op: "cancelTrig", i: M.x.i, cast: true }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "mg" }, { op: "move", i: M.x.i, to: "hell", onlyFrom: "land" }, react ? { op: "mu", k: "R" } : { op: "stateSet", k: "noReact", self: true, why: "คนรวย: เทิร์นนี้เราใช้ React Magic ไม่ได้" }] }; };
const colorMagic = (co) => ({ stay: true, cast: (c) => { const { E, s, seat: p, self: x } = c; const top = s.P[p].deck.slice(0, 2); const t = c.choose(top.filter((y) => E.colors(s, y).includes(co)), 1, `เลือกการ์ดสี${co} ขึ้นมือ`, { optional: true, reveal: true })[0];
    return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""} · การ์ดใบนี้วางบน Magic Zone`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "bottom"), ...(x ? [{ op: "flagSet", i: x.i, k: "sumt" }] : [])] }; },
  activate: { label: `ทำลายการ์ดใบนี้: อัญเชิญ Avatar สี${co} จากมือ (Cost -2)`, can: (E, s, x, L) => L.z === "mg" && x.on == null && s.phase === "main" && x.sumt != null && s.turn > x.sumt && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.some((y) => isAv(E, s, y) && E.colors(s, y).includes(co)),
    run: (c) => { const { E, s, seat: p, self: x } = c; const t = c.choose(s.P[p].hand.filter((y) => isAv(E, s, y) && E.colors(s, y).includes(co)).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar สี${co} บนมือ`, { exact: true })[0]; return t ? { explain: `ทำลายการ์ดใบนี้ · อัญเชิญ ${E.name(s, t)} (Cost -2)`, ops: [{ op: "destroy", i: x.i, why: "ใช้ความสามารถ" }, { op: "handCost", i: t.i, n: -2 }, { op: "payPut", i: t.i }] } : { explain: "", ops: [] }; } } });
Object.assign(SCRIPTS, {
  "BT02-006": richCounter(false),
  "CC02-022": richCounter(true),
  // ฤๅษี ภฤคุ: our {ฤษี} Normal Magic in the opponent's turn, and {ฤษี} Reacts answer attacks, abilities and Magic
  "BT05-011": { rishiTime: true },
  // เหน็บกินมือ: the opponent takes a card from the Deck with an ability: it goes back
  "BT05-060": { react: { kinds: ["handed"], can: (E, s, p, on) => on.by === 1 - p && on.i != null && (E.locate(s, on.i) || {}).z === "hand", botV: () => 3 },
    cast: (c) => { const { E, s } = c; const on = onTarget(c); const L = on.i != null ? E.locate(s, on.i) : null; return L && L.z === "hand" ? { explain: `${E.name(s, L.x)} กลับเข้า Deck (ยกเลิกผล)`, ops: [{ op: "move", i: L.x.i, to: "deckBottom" }, { op: "shuffle", seat: L.p }] } : { explain: "", ops: [] }; } },
  // มหาราชาสีนิล: +2 in fights · destroyed in a fight: its Mods go to hell instead · คำสั่งเสีย our Avatars +1
  "CC02-001": { fight: (c) => (c.self ? { explain: "POWER +2 จนจบการต่อสู้", ops: [{ op: "power", i: c.self.i, n: 2, temp: "fight" }] } : { explain: "", ops: [] }),
    wouldDestroy: (E, s, x, L, o) => { if (!o || !o.fight || L.z !== "av") return false; const ms = wornOn(s, x).filter((m) => E.def(s, m).st === "D"); if (!ms.length) return false; for (const m of ms) E.moveTo(s, m.i, "hell"); E.log(s, L.p, `${E.name(s, x)} ไม่ถูกทำลาย: Modification ที่สวมใส่ลงนรกแทน`); return true; },
    death: (c) => ({ explain: "Avatar ฝ่ายเรา POWER +1", ops: c.s.P[c.seat].av.map((y) => ({ op: "power", i: y.i, n: 1, temp: false })) }) },
  // บัมเบิ้ลแบงค์: once per turn from hell (none of it on our zone), discard 1: summoned
  "CC02-002": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญจากนรก", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].hand.length > 0 && E.avatars(s.P[L.p]) < 4 && !s.P[L.p].av.some((y) => E.def(s, y).n === E.def(s, x).n),
    run: (c) => { const { E, s, seat: p, self: x } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return pay ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: x.i }] } : { explain: "", ops: [] }; } } },
  // คุณโดม: once per turn a die: +that much this turn · คำสั่งเสีย back into the Deck
  "CC02-003": { activate: { label: "ทอยลูกเต๋า: POWER เพิ่มตามผล", can: (E, s, x, L) => L.z === "av" && s.phase === "main", run: (c) => { const x = c.self; const cases = {}; for (let k = 1; k <= 6; k++) cases[k] = [{ op: "power", i: x.i, n: k, temp: true }]; return { explain: "ทอยลูกเต๋า", ops: [{ op: "roll", why: "คุณโดม", cases }] }; } },
    death: (c) => (c.self && c.E.locate(c.s, c.self.i)?.z === "hell" ? { explain: "กลับเข้า Deck", ops: [{ op: "move", i: c.self.i, to: "deckBottom" }, { op: "shuffle", seat: c.seat }] } : { explain: "", ops: [] }) },
  // นักดาบตะวันแดง: survives being attacked: destroy a foe · counts as {หุ่นยนต์}
  "CC02-004": { extraSy: "หุ่นยนต์", defEnd: (c) => { const { E, s, seat: p } = c; const t = c.choose(bestFoe(E, s, p), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "นักดาบตะวันแดง" }] } : { explain: "", ops: [] }; } },
  // หมีบราซิล (red): show a red Avatar: one of ours +2, or draw 2 discard 1
  "CC02-005": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!bearShow("แดง")(E, s, p, x)) return { explain: "ไม่มี Avatar สีแดงบนมือ", ops: [] }; const m = c.mode(["1) Avatar ฝ่ายเรา 1 ใบ POWER +2", "2) จั่ว 2 ใบ ทิ้ง 1 ใบ"], "หมีบราซิล", 1);
    if (m === 0) { const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} POWER +2`, ops: [{ op: "power", i: t.i, n: 2, temp: false }] } : { explain: "", ops: [] }; }
    return { explain: "จั่ว 2 ใบ แล้วทิ้ง 1 ใบ", ops: [{ op: "draw", seat: p, n: 2 }, ...(x ? [{ op: "resume", t: { seat: p, i: x.i, c: x.c, when: "dropOne" } }] : [])] }; },
    dropOne: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; return t ? { explain: `ทิ้ง ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [t.i] }] } : { explain: "", ops: [] }; } },
  // ซุส: จุติ any 2 cards from the Deck
  "CC02-006": { summon: (c) => { const { E, s, seat: p } = c; const ts = c.choose(uniq(E, s, s.P[p].deck).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 2, "เลือกการ์ด 2 ใบจาก Deck ขึ้นมือ", { exact: true }); return { explain: `${ts.map((y) => E.name(s, y)).join(", ")} ขึ้นมือ`, ops: [...ts.map((y) => ({ op: "move", i: y.i, to: "hand" })), { op: "shuffle", seat: p }] }; } },
  // หมีขาว (blue): show a blue Avatar: scout 5 to summon Cost ≤3 or take an Avatar
  "CC02-010": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!bearShow("ฟ้า")(E, s, p, x)) return { explain: "ไม่มี Avatar สีฟ้าบนมือ", ops: [] }; const m = c.mode(["1) สอดแนม 5 ใบ อัญเชิญ Avatar Cost ไม่เกิน 3", "2) สอดแนม 5 ใบ นำ Avatar ขึ้นมือ"], "หมีขาว", E.avatars(s.P[p]) < 4 ? 0 : 1); const room = E.avatars(s.P[p]) < 4;
    const { top, t } = scoutPick(c, 5, (y) => isAv(E, s, y) && E.def(s, y).t === "A" && (m === 1 || (room && (E.def(s, y).c || 0) <= 3)), m === 0 ? "เลือก Avatar Cost ไม่เกิน 3 อัญเชิญ" : "เลือก Avatar ขึ้นมือ", { optional: true });
    return { explain: `สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ${m === 0 ? "อัญเชิญ" : "ขึ้นมือ"}` : ""}`, ops: [{ op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [m === 0 ? { op: "put", i: t.i } : { op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "shuffle")] }; } },
  // ตุตันคาเมน: จุติ Avatars of total Cost ≤8 from any hell with จุติ, or one Avatar · cannot come from hell itself
  "CC02-011": { noFromHell: true, summon: (c) => { const { E, s, seat: p } = c; const pool = [...s.P[p].hell, ...s.P[1 - p].hell].filter((y) => E.def(s, y).t === "A" && E.def(s, y).n !== "ตุตันคาเมน ฟาโรห์ทองคำ"); const room = freeAv(E, s, p); if (!pool.length || !room) return { explain: "ไม่มี Avatar ในนรก", ops: [] };
    const m = c.mode(["1) อัญเชิญ จุติ Avatar (ไม่ใช่ Only) Cost รวมไม่เกิน 8", "2) อัญเชิญ จุติ Avatar 1 ใบ"], "ตุตันคาเมน", 0);
    if (m === 1) { const t = c.choose(pool.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar จากนรก", { exact: true })[0]; return t ? { explain: `อัญเชิญ จุติ ${E.name(s, t)}`, ops: [{ op: "put", i: t.i, jt: true, ctl: p }] } : { explain: "", ops: [] }; }
    const cand = pool.filter((y) => !E.def(s, y).o1).sort((a, b) => worth(E, s, b) - worth(E, s, a)); const picks = c.interactive ? c.choose(cand, Math.min(room, cand.length), "เลือก Avatar (Cost รวมไม่เกิน 8)", { optional: true }) : cand; const ts = []; let sum = 0; for (const y of picks) { const k = E.def(s, y).c || 0; if (ts.length < room && sum + k <= 8) { ts.push(y); sum += k; } }
    return { explain: `อัญเชิญ จุติ ${ts.map((y) => E.name(s, y)).join(", ") || "-"} (Cost รวม ${sum})`, ops: ts.map((y) => ({ op: "put", i: y.i, jt: true, ctl: p })) }; } },
  // เตียวเสียน: with a purple ขุนพล {ต่างชาติ} it cannot be attacked · once per turn wake all their Avatars
  "CC02-012": { noAtk: (E, s, x, L) => !!L && L.z === "av" && s.P[L.p].av.some((y) => y.i !== x.i && isAv(E, s, y) && E.named(s, y, "ขุนพล") && E.colors(s, y).includes("ม่วง") && sy(E, s, y, "ต่างชาติ")),
    activate: { label: "Avatar ฝ่ายตรงข้ามทุกใบเปลี่ยนเป็นสภาพตื่น", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && s.P[1 - L.p].av.some((y) => !y.a), run: (c) => ({ explain: "Avatar ฝ่ายตรงข้ามทุกใบตื่น", ops: c.s.P[1 - c.seat].av.filter((y) => !y.a).map((y) => ({ op: "wake", i: y.i })) }) } },
  // ตั๋งโต๊ะ: จุติ a purple ขุนพล {ต่างชาติ} from hell to the hand with Cost -3 this turn · once per turn in our turn an opposing Avatar changes state: draw 1
  "CC02-013": { summon: (c) => { const { E, s, seat: p, self: x } = c; const t = s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "ขุนพล") && E.colors(s, y).includes("ม่วง") && sy(E, s, y, "ต่างชาติ") && E.def(s, y).n !== E.def(s, x || y).n).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t ? { explain: `${E.name(s, t)} ขึ้นมือ (Cost -3 เทิร์นนี้)`, ops: [{ op: "move", i: t.i, to: "hand" }, { op: "handCost", i: t.i, n: -3 }] } : { explain: "ไม่มีขุนพลสีม่วงในนรก", ops: [] }; },
    foeState: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // แร้งทึ้งศพ: once per turn when anyone mills: draw 1
  "CC02-014": { onAnyMill: (c) => ({ explain: "จั่ว 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }) },
  // หมีดำ (purple): show a purple Avatar: mill 2, then a POWER ≤2 non-Only Avatar from hell, or a non-Only hell card under the Deck
  "CC02-015": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!bearShow("ม่วง")(E, s, p, x)) return { explain: "ไม่มี Avatar สีม่วงบนมือ", ops: [] }; const m = c.mode(["1) ธรณีสูบ 2 ใบ: อัญเชิญ Avatar POWER ไม่เกิน 2 จากนรก", "2) ธรณีสูบ 2 ใบ: การ์ดในนรก 1 ใบกลับเข้าใต้ Deck"], "หมีดำ", E.avatars(s.P[p]) < 4 ? 0 : 1);
    return { explain: "ธรณีสูบ 2 ใบ", ops: [{ op: "mill", seat: p, n: 2 }, ...(x ? [{ op: "resume", t: { seat: p, i: x.i, c: x.c, when: m === 0 ? "bearCall" : "bearBack" } }] : [])] }; },
    bearCall: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => E.def(s, y).t === "A" && !E.def(s, y).o1 && (E.def(s, y).pw || 0) <= 2).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar POWER ไม่เกิน 2 ในนรก", { exact: true })[0]; return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "put", i: t.i }] } : { explain: "", ops: [] }; },
    bearBack: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hell.filter((y) => !E.def(s, y).o1).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือกการ์ดในนรกกลับเข้าใต้ Deck", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} กลับเข้าใต้ Deck`, ops: [{ op: "move", i: t.i, to: "deckBottom" }] } : { explain: "", ops: [] }; } },
  // มอร์ฟีน Overdose: 4 different Overdose on our zone: they cannot use React or Normal Magic · once per turn flip our LIFE: an Avatar from any hell to its owner's zone (theirs cannot use abilities)
  "CC02-017": { magicLock: (E, s, y, Ly, st) => (st === "R" || st === "N") && new Set(s.P[Ly.p].av.filter((z) => odAv(E, s, z)).map((z) => E.def(s, z).n)).size >= 4,
    activate: { label: "หงาย LIFE 1 ใบ: อัญเชิญ Avatar จากนรกผู้เล่นใดก็ได้", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && !E.critical(s.P[L.p]) && [0, 1].some((q) => E.avatars(s.P[q]) < 4 && s.P[q].hell.some((y) => E.def(s, y).t === "A")),
      run: (c) => { const { E, s, seat: p } = c; const pool = [0, 1].flatMap((q) => (E.avatars(s.P[q]) < 4 ? s.P[q].hell.filter((y) => E.def(s, y).t === "A") : [])); const t = c.choose(pool.sort((a, b) => (b.o === p ? 1 : 0) - (a.o === p ? 1 : 0) || worth(E, s, b) - worth(E, s, a)), 1, "เลือก Avatar ในนรก", { exact: true })[0];
        return t ? { explain: `หงาย LIFE · อัญเชิญ ${E.name(s, t)} ลง Avatar Zone ของเจ้าของ${t.o !== p ? " (สั่งใช้ความสามารถไม่ได้)" : ""}`, ops: [{ op: "lifeFlip", seat: p }, { op: "put", i: t.i }, ...(t.o !== p ? [{ op: "flagSet", i: t.i, k: "nact", v: true }] : [])] } : { explain: "", ops: [] }; } } },
  // หุ่นพิฆาต 300%: nobody can summon Avatars from the Deck
  "CC02-018": { noDeckSummon: true },
  // ราชาใบก้อน: once per turn its Cost -1: destroy a foe of Cost ≤ its Cost
  "CC02-019": { activate: { label: "Cost ใบนี้ -1: ทำลาย Avatar ฝ่ายตรงข้าม Cost ไม่เกินใบนี้", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.costNow(s, x) > 0 && s.P[1 - L.p].av.some((y) => !E.noAim(s, y) && E.costNow(s, y) <= E.costNow(s, x) - 1),
    run: (c) => { const { E, s, seat: p, self: x } = c; const lim = E.costNow(s, x) - 1; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y) && E.costNow(s, y) <= lim).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, `เลือก Avatar Cost ไม่เกิน ${lim}`, { exact: true })[0]; return t ? { explain: `Cost -1 · ทำลาย ${E.name(s, t)}`, ops: [{ op: "costUp", i: x.i, n: -1 }, { op: "destroy", i: t.i, why: "ราชาใบก้อน" }] } : { explain: "", ops: [] }; } } },
  // หมีเหลือง (green): show a green Avatar: an Avatar safe from fights, or from the opponent's Magic, until the end of their next turn
  "CC02-020": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!bearShow("เขียว")(E, s, p, x)) return { explain: "ไม่มี Avatar สีเขียวบนมือ", ops: [] }; const m = c.mode(["1) Avatar 1 ใบไม่ถูกทำลายจากการต่อสู้", "2) Avatar 1 ใบไม่รับผล Magic ฝ่ายตรงข้าม"], "หมีเหลือง", 0); const t = c.choose([...s.P[p].av].sort(strongFirst(E, s)), 1, "เลือก Avatar", { exact: true })[0]; const until = s.active === p ? s.turn + 1 : s.turn;
    return t ? { explain: `${E.name(s, t)} ${m === 0 ? "ไม่ถูกทำลายจากการต่อสู้" : "ไม่รับผล Magic ฝ่ายตรงข้าม"} จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, ops: [m === 0 ? { op: "fprot", i: t.i, until } : { op: "mprot", i: t.i, until, all: true }] } : { explain: "", ops: [] }; } },
  // นางอัปสร: attacking, they cannot use React Magic for the fight
  "CC02-023": { attack: () => ({ explain: "ฝ่ายตรงข้ามใช้ React Magic ไม่ได้จนจบการต่อสู้", ops: [{ op: "noReact" }] }) },
  // ริกกี้ คุณตาใจดี: unaffected by the opponent's Magic
  "CC02-029": { magicProof: true },
  // ศาลพระภูมิ: จุติ a {ผี} from the Deck · with another {ผี} on our zone it cannot be attacked
  "CC02-032": { summon: (c) => { const { E, s, seat: p } = c; const t = s.P[p].deck.filter((y) => isAv(E, s, y) && ghost(E, s, y)).sort((a, b) => worth(E, s, b) - worth(E, s, a))[0]; return t && E.avatars(s.P[p]) < 4 ? { explain: `อัญเชิญ ${E.name(s, t)} จาก Deck`, ops: [{ op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "ไม่มี ผี ใน Deck", ops: [{ op: "shuffle", seat: p }] }; },
    noAtk: (E, s, x, L) => !!L && L.z === "av" && s.P[L.p].av.some((y) => y.i !== x.i && ghost(E, s, y)) },
  // พญายักษ์ ทศกัณฐ์: once per turn discard 1: a POWER 3 {ยักษ์} (not ทศกัณฐ์) from the Deck
  "CC02-039": { activate: { label: "ทิ้ง 1 ใบ: อัญเชิญยักษ์ POWER 3 จาก Deck", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && E.avatars(s.P[L.p]) < 4 && s.P[L.p].hand.length > 0 && s.P[L.p].deck.some((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3 && !E.named(s, y, "ทศกัณฐ์")),
    run: (c) => { const { E, s, seat: p } = c; const pay = c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 1, "ทิ้งการ์ดบนมือ 1 ใบ", { exact: true })[0]; const t = c.choose(uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "ยักษ์") && (E.def(s, y).pw || 0) === 3 && !E.named(s, y, "ทศกัณฐ์"))), 1, "เลือกยักษ์ POWER 3", { exact: true })[0]; return pay && t ? { explain: `ทิ้ง ${E.name(s, pay)} · อัญเชิญ ${E.name(s, t)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, { op: "put", i: t.i }, { op: "shuffle", seat: p }] } : { explain: "", ops: [] }; } } },
  "CC02-041": colorMagic("แดง"), "CC02-042": colorMagic("ฟ้า"), "CC02-043": colorMagic("ม่วง"), "CC02-044": colorMagic("เขียว"),
  // สิงสู่เพื่อสู่สม: sacrifice a Cost 3+ Avatar: one of theirs (their pick) comes to us wearing this; when this leaves it goes back
  "CC02-045": { stay: true, leaveReturns: true, canCast: (E, s, p) => s.P[p].av.some((y) => (E.def(s, y).c || 0) >= 3) && s.P[1 - p].av.some((y) => !E.noControl(s, y)),
    cast: (c) => { const { E, s, seat: p, self: x } = c; const sac = c.choose(s.P[p].av.filter((y) => (E.def(s, y).c || 0) >= 3).sort(cheapCard(E, s)), 1, "เลือก Avatar Cost 3 ขึ้นไป เซ่นไหว้", { exact: true })[0]; const t = s.P[1 - p].av.filter((y) => !E.noControl(s, y)).sort(cheapCard(E, s))[0]; // their pick: the weakest
      return sac && t && x ? { explain: `เซ่นไหว้ ${E.name(s, sac)} · ฝ่ายตรงข้ามเลือก ${E.name(s, t)} มาอยู่ฝ่ายเรา (สวมใส่การ์ดใบนี้)`, ops: [{ op: "destroy", i: sac.i, why: "เซ่นไหว้" }, { op: "control", i: t.i, seat: p }, { op: "attach", i: x.i, on: t.i }] } : { explain: "", ops: [] }; } },
  // กาจอก: our fighting Avatar's awake opponent is destroyed
  "CC02-046": { react: { kinds: ["attack", "react"], can: (E, s, p) => { const pd = s.pend; if (!pd || pd.tk !== "av") return false; const A = E.locate(s, pd.att), T = E.locate(s, pd.ti); return !!A && !!T && ((A.p === p && T.x.a) || (T.p === p && A.x.a)); }, botV: () => 4 },
    cast: (c) => { const { E, s, seat: p } = c; const pd = s.pend; if (!pd) return { explain: "", ops: [] }; const A = E.locate(s, pd.att), T = E.locate(s, pd.ti); const foe = A && A.p !== p ? A.x : T && T.p !== p ? T.x : null; return foe && foe.a ? { explain: `${E.name(s, foe)} อยู่ในสภาพตื่น: ทำลาย`, ops: [{ op: "destroy", i: foe.i, why: "กาจอก" }] } : { explain: "", ops: [] }; } },
  // เราจะตายแล้วท่านหยุดเถอะ: their LIFE attack after one of ours died in a fight this turn: no LIFE damage
  "CC02-047": { react: { kinds: ["attack"], can: (E, s, p, on) => on.tk === "life" && !!s.dc && s.dc.t === s.turn && (s.dc.f || [0, 0])[p] > 0, botV: () => 6 }, cast: () => ({ explain: "การโจมตีครั้งนี้ไม่ทำความเสียหาย LIFE", ops: [{ op: "noDmg" }] }) },
  // ปืนจักรวุทธ: +4 when attacking and must attack · once per turn its attack wins: wake (then it never wakes otherwise) · once per turn back to the hand, waking the wearer
  "CC02-048": { hostMust: true, hostAttack: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H ? { explain: `${c.E.name(c.s, H.x)} POWER +4 จนจบการต่อสู้`, ops: [{ op: "power", i: H.x.i, n: 4, temp: "fight" }] } : { explain: "", ops: [] }; },
    hostWin: (c) => { const { E, s, seat: p, self: m } = c; const H = m && m.on != null ? E.locate(s, m.on) : null; if (!H || !once(s, p, "จักรวุทธ:" + m.i)) return { explain: "", ops: [] }; return { explain: `${E.name(s, H.x)} ตื่น (จากนี้ไม่ตื่นด้วยวิธีอื่น)`, ops: [{ op: "nameOnce", seat: p, name: "จักรวุทธ:" + m.i }, { op: "wake", i: H.x.i, force: true }, { op: "noWake", i: H.x.i, until: 9999, by: m.i }] }; },
    activate: { label: "นำการ์ดใบนี้ขึ้นมือ: Avatar ที่สวมใส่ตื่น", can: (E, s, x, L) => L.z === "mg" && x.on != null && s.phase === "main", run: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H ? { explain: `ปืนจักรวุทธ ขึ้นมือ · ${c.E.name(c.s, H.x)} ตื่น`, ops: [{ op: "move", i: c.self.i, to: "hand" }, { op: "wake", i: H.x.i, force: true }] } : { explain: "", ops: [] }; } } },
  // ดินแดนแห่งความหลากหลาย: 2+ Avatars on our zone with no shared Symbol: they are all +1
  "CC02-049": { aura: (E, s, src, L) => { if (L.z !== "land") return []; const av = s.P[L.p].av; if (av.length < 2) return []; for (const k of SYMS) if (av.filter((y) => E.hasSy(s, y, k)).length >= 2) return []; return [{ seat: L.p, test: () => true, n: 1 }]; } },
  // วิหารเจ้าสมุทร: once per turn a {ปลา} of ours sleeps: scout 3, a {ปลา} card to the hand, the rest to hell
  "CC02-050": { activate: { label: "ปลา เปลี่ยนเป็นสภาพนอน: สอดแนม 3 ใบ หาปลา", can: (E, s, x, L) => L.z === "land" && s.phase === "main" && s.P[L.p].av.some((y) => y.a && sy(E, s, y, "ปลา")) && s.P[L.p].deck.length > 0,
    run: (c) => { const { E, s, seat: p } = c; const f = s.P[p].av.filter((y) => y.a && sy(E, s, y, "ปลา")).sort((a, b) => E.power(s, a) - E.power(s, b))[0]; const { top, t } = scoutPick(c, 3, (y) => sy(E, s, y, "ปลา"), "เลือกการ์ด ปลา ขึ้นมือ", { optional: true }); return f ? { explain: `${E.name(s, f)} นอน · สอดแนม ${top.length} ใบ${t ? ` · ${E.name(s, t)} ขึ้นมือ` : ""} · ที่เหลือลงนรก`, ops: [{ op: "toggle", i: f.i }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : []), ...restOps(p, top, t ? [t] : [], "hell")] } : { explain: "", ops: [] }; } } },
  // จมน้ำ: each player puts one Avatar of their own under their Deck
  "CC02-052": { canCast: (E, s) => s.P[0].av.length > 0 || s.P[1].av.length > 0, cast: (c) => { const { E, s, seat: p } = c; const mine = c.choose([...s.P[p].av].sort(cheapCard(E, s)), 1, "เลือก Avatar ฝ่ายเราที่จะกลับเข้าใต้ Deck", { exact: true })[0]; const theirs = [...s.P[1 - p].av].sort(cheapCard(E, s))[0];
    return { explain: `${[mine, theirs].filter(Boolean).map((y) => E.name(s, y)).join(", ")} กลับเข้าใต้ Deck`, ops: [mine, theirs].filter(Boolean).map((y) => ({ op: "move", i: y.i, to: "deckBottom" })) }; } },
  // ล้มโต๊ะ: every hand back into its Deck, shuffled, then 4 each
  "CC02-053": { cast: (c) => ({ explain: "มือทั้งหมดกลับเข้า Deck · ต่างฝ่ายจั่ว 4 ใบ", ops: [{ op: "handToDeck", seat: 0 }, { op: "handToDeck", seat: 1 }, { op: "draw", seat: 0, n: 4 }, { op: "draw", seat: 1, n: 4 }] }) },
  // เขาไกรลาสเอียง: whoever declares an attack mills 2
  "CC02-059": { landAtkOps: (E, s, x, p) => [{ op: "mill", seat: p, n: 2 }] },
});
SCRIPTS["CC02-034"] = SCRIPTS["BT03-020"]; SCRIPTS["CC02-051"] = SCRIPTS["BT02-041"]; SCRIPTS["CC02-058"] = SCRIPTS["BT03-055"]; SCRIPTS["CC02-060"] = SCRIPTS["BT01-049"];

// ── ODY1 (Odyssey): early printings. Most share a name and an effect with a later BT01/BT02 card, so they reuse that script.
const tako = (E, s, x) => /ทาโกะ/.test(E.name(s, x));
const odenTako = (E, s, x) => /ทาโกะ|โอเดนย่า/.test(E.name(s, x));
const jeejaMill = (c) => ({ explain: "ธรณีสูบ 2 ใบ · POWER +1 จนจบเทิร์น", ops: [{ op: "mill", seat: c.seat, n: 2 }, ...(c.self && c.E.locate(c.s, c.self.i) ? [{ op: "power", i: c.self.i, n: 1, temp: true }] : [])] });
Object.assign(SCRIPTS, {
  // โอเดนย่ากาย: attacks only while a "ทาโกะ" is on our Avatar Zone
  "ODY1-005": { noAttack: (E, s, x) => { const L = E.locate(s, x.i); return !L || !s.P[L.p].av.some((y) => y.i !== x.i && tako(E, s, y)); } },
  // นนทก: our {เทพ} Avatars +1 POWER
  "ODY1-016": { aura: (E, s, src, L) => (L.z === "av" ? [{ seat: L.p, test: (x) => sy(E, s, x, "เทพ"), n: 1 }] : []) },
  // นายนิรยบาล พ่อจีจ้า: when it attacks or is attacked: mill 2, POWER +1 this turn
  "ODY1-036": { attack: jeejaMill, attacked: jeejaMill },
  // เอาแค่การ์ด !!!: discard an "โอเดนย่า" or "ทาโกะ" card: an Avatar on the field back to its owner's hand
  "ODY1-063": { canCast: (E, s, p) => s.P[p].hand.filter((y) => odenTako(E, s, y)).length >= 1 && [0, 1].some((q) => s.P[q].av.length > 0),
    cast: (c) => { const { E, s, seat: p } = c; const pay = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.i && odenTako(E, s, y)).sort(cheapCard(E, s)), 1, "ทิ้งการ์ด \"โอเดนย่า\" หรือ \"ทาโกะ\" บนมือ 1 ใบ", { exact: true })[0];
      if (!pay) return { explain: "ไม่มีการ์ดโอเดนย่าหรือทาโกะบนมือ", ops: [] };
      const t = c.choose([...bestFoe(E, s, p), ...s.P[p].av.filter((y) => !E.noAim(s, y))], 1, "เลือก Avatar บนสนามที่จะกลับขึ้นมือเจ้าของ", { exact: true })[0];
      return { explain: t ? `ทิ้ง ${E.name(s, pay)} · ${E.name(s, t)} กลับขึ้นมือเจ้าของ` : `ทิ้ง ${E.name(s, pay)}`, ops: [{ op: "discard", seat: p, iids: [pay.i] }, ...(t ? [{ op: "move", i: t.i, to: "hand" }] : [])] }; } },
  // ถุงเกราะโอเดนย่า: an Avatar of ours +2 POWER until the end of the opponent's next turn
  "ODY1-065": { canCast: (E, s, p) => s.P[p].av.length > 0,
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].av].sort((a, b) => E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายเรา (POWER +2 จนจบเทิร์นถัดไปของฝ่ายตรงข้าม)", { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} POWER +2 จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, ops: [{ op: "power", i: t.i, n: 2, temp: "next" }] } : { explain: "ไม่มี Avatar ฝ่ายเรา", ops: [] }; } },
  // ไม้เกาหลัง: the wearer gains เตะไข่
  "ODY1-076": { worn: () => 0, modV: (E, s, m, host) => (host && !E.kw(s, host, "เตะไข่") && s.P[1 - host.o].av.length ? 2.5 : 0.3),
    aura: (E, s, src, L) => { const H = src.on != null ? E.locate(s, src.on) : null; return L.z === "mg" && H && H.z === "av" ? [{ seat: H.p, test: (x) => x.i === H.x.i, n: 0, kw: ["เตะไข่"] }] : []; } },
  // หอกแหลมแทงทุกวัน ทุกวัน: +1 to a {นรก} wearer; once milled into hell it can be used from there
  "ODY1-077": { worn: (E, s, m, host) => (sy(E, s, host, "นรก") ? 1 : 0), modV: (E, s, m, host) => (host && sy(E, s, host, "นรก") ? 1.5 : 0.1), hellCast: (E, s, p, x) => !!x.mil },
});
for (const [a, b] of [["ODY1-007", "BT01-001"], ["ODY1-013", "BT02-002"], ["ODY1-017", "BT01-008"], ["ODY1-018", "BT01-009"], ["ODY1-021", "BT01-012"], ["ODY1-025", "BT02-015"], ["ODY1-029", "BT01-020"], ["ODY1-034", "BT02-017"], ["ODY1-035", "BT02-021"],
  ["ODY1-071", "BT01-045"], ["ODY1-072", "BT01-046"], ["ODY1-073", "BT01-040"], ["ODY1-074", "BT01-050"], ["ODY1-078", "BT01-037"], ["ODY1-079", "BT01-043"], ["ODY1-084", "BT01-039"]]) if (SCRIPTS[b]) SCRIPTS[a] = SCRIPTS[b];

// ── PRMO (promo cards). Same-text promos reuse the original script.
Object.assign(SCRIPTS, {
  // ช่วยโลกใบนี้ไว้ (promo): as BT02-041, and losing from an all-face-up LIFE does not apply this turn
  "PRMO-010": { ...SCRIPTS["BT02-041"], cast: (c) => { const r = SCRIPTS["BT02-041"].cast(c); return { explain: r.explain + " · เงื่อนไขการแพ้จาก LIFE ไม่ทำงานจนจบเทิร์น", ops: r.ops.map((o) => (o.op === "turnBuff" ? { ...o, noLose: true } : o)) }; } },
  // แบ่งแยกดินแดน: while it is on the Land Magic Zone, a new Land Magic replaces only its owner's own Land (one Land per side)
  "PRMO-029": { splitLand: true },
  // หมู่บ้านพอดี: every Cost must be paid with exactly that much GEM
  "PRMO-039": { exactGem: true },
});
for (const [a, b] of [["PRMO-052", "BT03-022"], ["PRMO-058", "BT04-015"], ["PRMO-078", "BT03-004"], ["PRMO-084", "BT05-030"], ["PRMO-090", "BT07-051"], ["PRMO-091", "SD07-001"], ["PRMO-116", "BT07-015"]]) if (SCRIPTS[b]) SCRIPTS[a] = SCRIPTS[b];

// ── KD (kingdom / party decks), PRE0 (pre-release players) and SL02: new cards; reprints reuse the original script
const hellNames = (E, s, p, f) => new Set(s.P[p].hell.filter((y) => isAv(E, s, y) && (!f || f(y))).map((y) => E.def(s, y).n)).size;
const narayHere = (E, s, p) => s.P[p].av.filter((y) => E.named(s, y, "พระนารายณ์"));
// ร่างอวตารพระนารายณ์ (KD01): from the hand when our พระนารายณ์ wins a fight, a พระนารายณ์ of ours to hell: this is summoned; extra = the effect "when summoned by its own ability"
const avatarForm = (key, extra) => ({
  handKillOk: (E, s, y, w) => E.named(s, w, "พระนารายณ์") && once(s, y.o, key) && narayHere(E, s, y.o).length > 0,
  handKill: (c) => { const { E, s, seat: p, self: x } = c; const n = narayHere(E, s, p).sort(cheapCard(E, s))[0]; if (!n || !x || !once(s, p, key)) return { explain: "", ops: [] }; const more = extra ? extra(c, n) : { explain: "", ops: [] };
    return { explain: `${E.name(s, n)} ลงนรก · อัญเชิญ ${E.name(s, x)}${more.explain ? " · " + more.explain : ""}`, ops: [{ op: "nameOnce", seat: p, name: key }, { op: "move", i: n.i, to: "hell" }, { op: "put", i: x.i }, { op: "flagSet", i: x.i, k: "own", v: true }, ...more.ops] }; },
  endPhase: (E, s, x, L) => { if (L.z !== "av" || !x.own || s.active !== L.p) return []; const t = s.P[L.p].hell.find((y) => isAv(E, s, y) && E.named(s, y, "พระนารายณ์") && E.def(s, y).n !== E.def(s, x).n); return [{ op: "move", i: x.i, to: "hell" }, ...(t ? [{ op: "put", i: t.i }] : [])]; } });
const mephisto = (E, s, x) => /เมฟิสโตเฟเลส/.test(E.def(s, x).n);
const migraine = (E, s, x) => isAv(E, s, x) && E.named(s, x, "ไมเกรน");
Object.assign(SCRIPTS, {
  // อะไรวะ !: when one of our Avatars leaves the Avatar Zone: every hand into its Deck, draw 4 each, whoever shows fewer Avatars takes 2 LIFE damage
  "KD00-00A": { react: { kinds: ["destroyed", "left"], can: (E, s, p, on) => on.p === p, botV: (E, s, q) => (s.P[q].hand.length <= 2 && s.P[1 - q].hand.length >= 4 ? 3.5 : -2) },
    cast: (c) => ({ explain: "ทุกคนนำการ์ดบนมือเข้า Deck แล้วสับ · จั่วคนละ 4 ใบ · แสดง Avatar บนมือ", ops: [{ op: "handToDeck", seat: 0 }, { op: "handToDeck", seat: 1 }, { op: "draw", seat: 0, n: 4 }, { op: "draw", seat: 1, n: 4 }, { op: "resume", t: { i: c.t.i, c: c.t.c, when: "showAv", seat: c.seat } }] }),
    showAv: (c) => { const { E, s } = c; const av = [0, 1].map((q) => s.P[q].hand.filter((y) => isAv(E, s, y))); const lo = Math.min(av[0].length, av[1].length); const who = [0, 1].filter((q) => av[q].length === lo);
      return { explain: `Avatar บนมือ ${s.P[0].name} ${av[0].length} · ${s.P[1].name} ${av[1].length} → ${who.map((q) => s.P[q].name).join(" และ ")} รับความเสียหาย LIFE 2 ครั้ง`,
        ops: [...[0, 1].map((q) => ({ op: "peek", seat: q, ids: av[q].map((y) => y.i), label: `${s.P[q].name} แสดง Avatar บนมือ` })), ...who.flatMap((q) => [{ op: "lifeDamage", seat: q }, { op: "lifeDamage", seat: q }])] }; } },
  // เบียดเบียนผู้อื่น: both take a random card from the other's hand and compare Cost (see the pilfer op)
  "KD00-00B": { cast: (c) => ({ explain: "ต่างฝ่ายสุ่มหยิบการ์ดจากมืออีกฝ่าย 1 ใบแล้วแสดงพร้อมกัน", ops: [{ op: "pilfer", i: c.t.i }] }),
    pilferExile: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.ex).sort(cheapCard(E, s)), 1, "แสดง Cost น้อยที่สุด: เลือกเนรเทศการ์ดบนมือ 1 ใบ", { exact: true })[0]; return t ? { explain: `เนรเทศ ${E.name(s, t)} จากมือ`, ops: [{ op: "move", i: t.i, to: "dark" }] } : { explain: "ไม่มีการ์ดให้เนรเทศ", ops: [] }; },
    pilferBack: (c) => { const { E, s, seat: p } = c; const t = c.choose([...s.P[p].dark].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "แสดง Cost มากที่สุด: เลือกการ์ดในโซนเนรเทศกลับเข้าใต้ Deck", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} จากโซนเนรเทศกลับเข้าใต้ Deck`, ops: [{ op: "move", i: t.i, to: "deckBottom" }] } : { explain: "ไม่มีการ์ดในโซนเนรเทศ", ops: [] }; },
    pilferDiscard: (c) => { const { E, s, seat: p } = c; const xs = c.choose(s.P[p].hand.filter((y) => y.i !== c.t.ex).sort(cheapCard(E, s)), 2, "แสดงการ์ดที่มี Cost ไม่ได้: ทิ้งการ์ดบนมือเพิ่ม 2 ใบ", { exact: true }); return xs.length ? { explain: `ทิ้ง ${xs.map((y) => E.name(s, y)).join(", ")}`, ops: [{ op: "discard", seat: p, iids: xs.map((y) => y.i) }] } : { explain: "ไม่มีการ์ดให้ทิ้ง", ops: [] }; } },
  // โอน้อยออกแห่งโชคชะตา: two players → straight to rock-paper-scissors; the loser flips their top LIFE (already critical: loses)
  "KD00-00C": { cast: () => ({ explain: "เป่ายิงฉุบ: ผู้แพ้หงาย LIFE ใบบนสุด 1 ใบ (ถ้าอยู่ในสถานะสาหัสจะแพ้ทันที)", ops: [{ op: "rps" }] }) },
  // ขอมือเธอหน่อย~: whoever holds the most cards discards 2: then everyone draws up to the biggest hand
  "KD00-00D": { cast: (c) => { const { E, s, seat: p } = c; const n = [0, 1].map((q) => s.P[q].hand.length); const M = Math.max(...n); const who = M > 0 ? [0, 1].filter((q) => n[q] === M) : [];
      const mine = who.includes(p) ? c.choose([...s.P[p].hand].sort(cheapCard(E, s)), 2, "มือเยอะที่สุด: ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }) : [];
      const next = who.includes(1 - p) ? { op: "resume", t: { i: c.t.i, c: c.t.c, when: "oppDiscard", seat: 1 - p } } : { op: "resume", t: { i: c.t.i, c: c.t.c, when: "drawUp", seat: p } };
      return { explain: who.length ? `${who.map((q) => s.P[q].name).join(" และ ")} มือเยอะที่สุด ทิ้ง 2 ใบ` : "ไม่มีใครมีการ์ดบนมือ", ops: [...(mine.length ? [{ op: "discard", seat: p, iids: mine.map((y) => y.i) }] : []), next] }; },
    oppDiscard: (c) => { const { E, s, seat: q } = c; const xs = c.choose([...s.P[q].hand].sort(cheapCard(E, s)), 2, "มือเยอะที่สุด: ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); return { explain: `ทิ้ง ${xs.map((y) => E.name(s, y)).join(", ")}`, ops: [...(xs.length ? [{ op: "discard", seat: q, iids: xs.map((y) => y.i) }] : []), { op: "resume", t: { i: c.t.i, c: c.t.c, when: "drawUp", seat: 1 - q } }] }; },
    drawUp: (c) => { const { s } = c; const M = Math.max(s.P[0].hand.length, s.P[1].hand.length); const k = [0, 1].map((q) => M - s.P[q].hand.length); return { explain: `จั่วให้เท่ากับ ${M} ใบ`, ops: [0, 1].filter((q) => k[q] > 0).map((q) => ({ op: "draw", seat: q, n: k[q] })) }; } },
  // พระนารายณ์ เทพผดุงธรรม: from the hand when our พระนารายณ์ wins a fight, a พระนารายณ์ of ours to hell: summoned · scout 2, both to the hand, exile an opposing Avatar with Cost ≤ their total Cost
  "KD01-001": { handKillOk: (E, s, y, w) => E.named(s, w, "พระนารายณ์") && narayHere(E, s, y.o).length > 0,
    handKill: (c) => { const { E, s, seat: p, self: x } = c; const n = narayHere(E, s, p).sort(cheapCard(E, s))[0]; if (!n || !x) return { explain: "", ops: [] }; const top = s.P[p].deck.slice(0, 2); const sum = top.reduce((a, y) => a + (E.def(s, y).c || 0), 0);
      const t = c.choose(bestFoe(E, s, p).filter((y) => E.costNow(s, y) <= sum), 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${sum} ที่จะเนรเทศ`, { exact: true })[0];
      return { explain: `${E.name(s, n)} ลงนรก · อัญเชิญ ${E.name(s, x)} · สอดแนม 2 ใบขึ้นมือ (Cost รวม ${sum})${t ? ` · เนรเทศ ${E.name(s, t)}` : ""}`, ops: [{ op: "move", i: n.i, to: "hell" }, { op: "put", i: x.i }, { op: "scoutShow", seat: p, ids: top.map((y) => y.i) }, ...top.map((y) => ({ op: "move", i: y.i, to: "hand" })), ...(t ? [{ op: "move", i: t.i, to: "dark" }] : [])] }; } },
  // นรสิงห์: summoned by its own ability: destroy an opposing Avatar with Cost ≤4
  "KD01-002": avatarForm("ร่างอวตารพระนารายณ์ - นรสิงห์", (c) => { const { E, s, seat: p } = c; const t = c.choose(bestFoe(E, s, p).filter((y) => E.costNow(s, y) <= 4), 1, "เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน 4 ที่จะทำลาย", { exact: true })[0]; return t ? { explain: `ทำลาย ${E.name(s, t)}`, ops: [{ op: "destroy", i: t.i, why: "นรสิงห์" }] } : { explain: "", ops: [] }; }),
  // เกษียรสมุทร: summoned by its own ability: wake a sleeping {เทพ} of ours
  "KD01-003": avatarForm("ร่างอวตารพระนารายณ์ - เกษียรสมุทร", (c, n) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => y !== n && !y.a && sy(E, s, y, "เทพ")).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar {เทพ} ที่นอนอยู่ให้ตื่น", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} ตื่น`, ops: [{ op: "wake", i: t.i }] } : { explain: "", ops: [] }; }),
  // เมฟิสโตเฟเลส: from the hand with 7+ differently named {นรก} Avatars in our hell, discard 2: summoned (no other way) · once a turn mill 5: destroy every other Avatar · scouted by สุวรรณ: to the hand
  "KD02-001": { noHand: true, selfOnly: true, scoutedBy: (E, s, x, src) => /สุวรรณ/.test(src.n || ""),
    activate: { label: "อัญเชิญจากมือ (ทิ้ง 2 ใบ) / ธรณีสูบ 5 ใบ: ทำลาย Avatar อื่นทั้งหมด", can: (E, s, x, L) => s.phase === "main" && (L.z === "hand" ? hellNames(E, s, L.p, (y) => sy(E, s, y, "นรก")) >= 7 && s.P[L.p].hand.length >= 3 && E.avatars(s.P[L.p]) < 4 && s.P[L.p].av.length < 6 : L.z === "av" && s.P[L.p].deck.length >= 5),
      run: (c) => { const { E, s, seat: p, self: x } = c; const L = x && E.locate(s, x.i); if (!L) return { explain: "", ops: [] };
        if (L.z === "hand") { const pay = c.choose(s.P[p].hand.filter((y) => y.i !== x.i).sort(cheapCard(E, s)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true }); if (pay.length < 2) return { explain: "", ops: [] }; return { explain: `ทิ้ง ${pay.map((y) => E.name(s, y)).join(", ")} · อัญเชิญ ${E.name(s, x)}`, ops: [{ op: "discard", seat: p, iids: pay.map((y) => y.i) }, { op: "put", i: x.i }] }; }
        const all = [0, 1].flatMap((q) => s.P[q].av.filter((y) => y.i !== x.i)); return { explain: `ธรณีสูบ 5 ใบ · ทำลาย Avatar อื่นทั้งหมด ${all.length} ใบ`, ops: [{ op: "mill", seat: p, n: 5 }, ...all.map((y) => ({ op: "destroy", i: y.i, why: "เมฟิสโตเฟเลส" }))] }; } } },
  // นายนิรยบาล พ่อจีจ้า (KD02): attacks or is attacked: mill 1, POWER +1
  "KD02-006": (() => { const f = (c) => ({ explain: "ธรณีสูบ 1 ใบ · POWER +1 จนจบเทิร์น", ops: [{ op: "mill", seat: c.seat, n: 1 }, ...(c.self && c.E.locate(c.s, c.self.i) ? [{ op: "power", i: c.self.i, n: 1, temp: true }] : [])] }); return { attack: f, attacked: f }; })(),
  // สัญญาเลือด: mill 3, then draw 1 (2 with 5+ differently named {นรก} Avatars in our hell) · milled: may exile it to summon a นายนิรยบาล from hell
  "KD02-014": { cast: (c) => ({ explain: "ธรณีสูบ 3 ใบ แล้วจั่ว", ops: [{ op: "mill", seat: c.seat, n: 3 }, { op: "resume", t: { i: c.t.i, c: c.t.c, when: "pactDraw", seat: c.seat } }] }),
    pactDraw: (c) => { const { E, s, seat: p } = c; const n = hellNames(E, s, p, (y) => sy(E, s, y, "นรก")) >= 5 ? 2 : 1; return { explain: `จั่ว ${n} ใบ`, ops: [{ op: "draw", seat: p, n }] }; },
    millBy: "any", milled: (c) => { const { E, s, seat: p, self: x } = c; if (!x || E.locate(s, x.i)?.z !== "hell" || E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6) return { explain: "", ops: [] }; const t = c.choose(s.P[p].hell.filter((y) => isAv(E, s, y) && E.named(s, y, "นายนิรยบาล")).sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก นายนิรยบาล จากนรกที่จะอัญเชิญ", { optional: true })[0];
      return t ? { explain: `เนรเทศ ${E.name(s, x)} · อัญเชิญ ${E.name(s, t)} จากนรก`, ops: [{ op: "move", i: x.i, to: "dark" }, { op: "put", i: t.i }] } : { explain: "ไม่ใช้", ops: [] }; } },
  // แมลงปอแจ็ค: จุติ: destroy the Land Magic, then put a Land Magic from our Deck on the Land Magic Zone and shuffle
  "KD03-011": { summon: (c) => { const { E, s, seat: p } = c; const lands = s.P[p].deck.filter((y) => E.def(s, y).t === "M" && E.def(s, y).st === "L"); const t = c.choose([...lands].sort((a, b) => worth(E, s, b) - worth(E, s, a)), 1, "เลือก Land Magic จาก Deck", { exact: true, reveal: lands.map((y) => y.i) })[0]; const on = E.lands(s); const old = on.length > 1 ? c.choose([...on].sort((a, b) => (a.o === p) - (b.o === p)), 1, "เลือก Land Magic ที่จะทำลาย", { exact: true })[0] : on[0];
      return { explain: `${old ? `ทำลาย ${E.name(s, old)} · ` : ""}${t ? `ใช้ ${E.name(s, t)} จาก Deck` : "ไม่มี Land Magic ใน Deck"}`, ops: [...(old ? [{ op: "destroy", i: old.i, why: "แมลงปอแจ็ค" }] : []), ...(t ? [{ op: "toLand", i: t.i }] : []), { op: "shuffle", seat: p }] }; } },
  // คริติคอล ไมเกรน: once a turn exile 3 differently named ไมเกรน Avatars from hell: 1) up to 2 อาวุธหุ่นนักรบผู้กล้า from hell onto it 2) this turn its fight kills deal 1 LIFE damage
  "KD04-001": { activate: { label: "เนรเทศไมเกรนต่างชื่อ 3 ใบจากนรก: เลือกปฏิบัติ", can: (E, s, x, L) => L.z === "av" && s.phase === "main" && new Set(s.P[L.p].hell.filter((y) => migraine(E, s, y)).map((y) => E.def(s, y).n)).size >= 3,
    run: (c) => { const { E, s, seat: p, self: x } = c; const P = s.P[p]; const seen = new Set(); const pay = []; for (const y of P.hell.filter((y) => migraine(E, s, y)).sort(cheapCard(E, s))) { const n = E.def(s, y).n; if (!seen.has(n) && pay.length < 3) { seen.add(n); pay.push(y); } } if (pay.length < 3 || !x) return { explain: "", ops: [] };
      const wp = P.hell.filter((y) => braveWeapon(E, s, y) && E.def(s, y).st === "D"); const m = c.mode(["1) อาวุธหุ่นนักรบผู้กล้า จากนรกสูงสุด 2 ใบ มาสวมใส่", "2) ทำลาย Avatar จากการต่อสู้: ความเสียหาย LIFE 1 ครั้ง (จนจบเทิร์น)"], "คริติคอล ไมเกรน", wp.length ? 0 : 1);
      const head = pay.map((y) => ({ op: "move", i: y.i, to: "dark" }));
      if (m === 0) { const w = c.choose(wp.sort((a, b) => worth(E, s, b) - worth(E, s, a)), 2, "เลือกอาวุธหุ่นนักรบผู้กล้า จากนรก (สูงสุด 2 ใบ)", { optional: true }); return { explain: `เนรเทศ ${pay.map((y) => E.name(s, y)).join(", ")} · สวมใส่ ${w.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [...head, ...w.map((y) => ({ op: "attach", i: y.i, on: x.i }))] }; }
      return { explain: `เนรเทศ ${pay.map((y) => E.name(s, y)).join(", ")} · เทิร์นนี้ทำลาย Avatar จากการต่อสู้แล้วทำความเสียหาย LIFE 1 ครั้ง`, ops: [...head, { op: "flagSet", i: x.i, k: "kdm" }] }; } } },
  // โปรโตไมเกรน (KD04): as BT06-009, but for any fight it wins (attacking or defending)
  "KD04-004": { kill: (c) => SCRIPTS["BT06-009"].win(c) },
  // แอร์ซิด รีฟลักซ์ (KD04): destroyed instead of our "หุ่นนักรบผู้กล้า : ไมเกรน"
  "KD04-006": { saveOther: (E, s, y, Ly, x, L) => (Ly.z === "av" && L.z === "av" && x.i !== y.i && E.named(s, x, "หุ่นนักรบผู้กล้า : ไมเกรน") ? { why: `${E.name(s, y)} ถูกทำลายแทน ${E.name(s, x)}`, ops: [{ op: "destroy", i: y.i, why: "ทำลายแทน", noSave: true }] } : null) },
  // THE END: a ไมเกรน of ours fights every opposing Avatar at once when it attacks this turn · from hell, exile it: differently named อาวุธหุ่นนักรบผู้กล้า from hell onto a ไมเกรน · milled or scouted by a ไมเกรน Avatar: to the hand
  "KD04-012": { canCast: (E, s, p) => s.P[p].av.some((y) => migraine(E, s, y)),
    cast: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => migraine(E, s, y)).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ไมเกรน ฝ่ายเรา", { exact: true })[0]; return t ? { explain: `${E.name(s, t)}: เมื่อโจมตีในเทิร์นนี้ จะต่อสู้กับ Avatar ฝ่ายตรงข้ามทุกใบพร้อมกัน`, ops: [{ op: "flagSet", i: t.i, k: "fa" }] } : { explain: "", ops: [] }; },
    activate: { label: "เนรเทศใบนี้จากนรก: อาวุธหุ่นนักรบผู้กล้า ต่างชื่อจากนรก สวมใส่ให้ไมเกรน", can: (E, s, x, L) => L.z === "hell" && s.phase === "main" && s.P[L.p].av.some((y) => migraine(E, s, y)) && s.P[L.p].hell.some((y) => braveWeapon(E, s, y) && E.def(s, y).st === "D"),
      run: (c) => { const { E, s, seat: p, self: x } = c; const host = c.choose(s.P[p].av.filter((y) => migraine(E, s, y)).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ไมเกรน ที่จะสวมใส่", { exact: true })[0]; if (!host || !x) return { explain: "", ops: [] };
        const seen = new Set(); const w = []; for (const y of s.P[p].hell.filter((y) => braveWeapon(E, s, y) && E.def(s, y).st === "D")) { const n = E.def(s, y).n; if (!seen.has(n)) { seen.add(n); w.push(y); } }
        const pick = c.choose(w, w.length, "เลือกอาวุธหุ่นนักรบผู้กล้า (ชื่อต่างกัน) จากนรก", { optional: true }); return { explain: `เนรเทศ ${E.name(s, x)} · ${E.name(s, host)} สวมใส่ ${pick.map((y) => E.name(s, y)).join(", ") || "-"}`, ops: [{ op: "move", i: x.i, to: "dark" }, ...pick.map((y) => ({ op: "attach", i: y.i, on: host.i }))] }; } },
    millBy: (src) => ["A", "T"].includes(src.t) && /ไมเกรน/.test(src.n || ""), milled: (c) => (c.self && c.E.locate(c.s, c.self.i)?.z === "hell" ? { explain: `${c.E.name(c.s, c.self)} ขึ้นมือ`, ops: [{ op: "move", i: c.self.i, to: "hand" }] } : { explain: "", ops: [] }),
    scoutedBy: (E, s, x, src) => ["A", "T"].includes(src.t) && /ไมเกรน/.test(src.n || "") },
  // ผู้เล่นยุคแรก: จุติ: look at the bottom 3 of the opponent's Deck, one of them on top (the rest stay)
  "PRE0-001": { summon: (c) => { const { E, s, seat: p } = c; const D = s.P[1 - p].deck; const bot = D.slice(-3); if (!bot.length) return { explain: "Deck ฝ่ายตรงข้ามหมด", ops: [] };
      const t = c.choose([...bot].sort((a, b) => worth(E, s, a) - worth(E, s, b)), 1, "เลือก 1 ใบไว้บนสุดของ Deck ฝ่ายตรงข้าม", { exact: true, reveal: bot.map((y) => y.i) })[0];
      return { explain: `ดูการ์ดล่างสุด ${bot.length} ใบของ Deck ฝ่ายตรงข้าม${t ? ` · ${E.name(s, t)} ไว้บนสุด` : ""}`, ops: [{ op: "scoutShow", seat: 1 - p, ids: bot.map((y) => y.i), label: "ดูการ์ดล่างสุด" }, ...(t ? [{ op: "move", i: t.i, to: "deckTop" }] : [])] }; } },
  // ผู้เล่นภักดี: จุติ: a random card from the opponent's hand on top of their Deck
  "PRE0-002": { summon: (c) => (c.s.P[1 - c.seat].hand.length ? { explain: "สุ่มการ์ดบนมือฝ่ายตรงข้าม 1 ใบไว้บนสุดของ Deck", ops: [{ op: "handToTop", seat: 1 - c.seat, random: true }] } : { explain: "ฝ่ายตรงข้ามไม่มีการ์ดบนมือ", ops: [] }) },
  // ผู้เล่นเหลี่ยม: จุติ: look at the opponent's whole hand
  "PRE0-003": { summon: (c) => ({ explain: "ดูการ์ดบนมือฝ่ายตรงข้ามทั้งหมด", ops: [{ op: "peek", seat: 1 - c.seat, z: "hand", label: `ดูการ์ดบนมือ ${c.s.P[1 - c.seat].name}` }] }) },
  // ผู้เล่นจำไม: paid for only with five GEM-1 cards · จุติ: how many Avatars and Magic are left in the opponent's Deck, and what their Only #1 is
  "PRE0-004": { payEach: (g) => g === 1, payN: 5, payErr: "อัญเชิญได้โดยการทิ้งการ์ด GEM 1 จำนวน 5 ใบเท่านั้น",
    summon: (c) => { const { E, s, seat: p } = c; const O = s.P[1 - p]; const nA = O.deck.filter((y) => isAv(E, s, y)).length, nM = O.deck.filter((y) => E.def(s, y).t === "M").length; const only = [...O.deck, ...O.hand, ...O.life, ...O.av, ...O.hell, ...O.dark, ...O.mg, ...O.cs].find((y) => E.def(s, y).o1);
      return { explain: `Deck ฝ่ายตรงข้ามเหลือ Avatar ${nA} ใบ · Magic ${nM} ใบ · Only #1 คือ ${only ? E.def(s, only).n : "ไม่มี"}`, ops: [] }; } },
  // ผู้เล่นมั่ว: +2 POWER with 10+ differently named Avatars in our hell
  "PRE0-005": { aura: (E, s, src, L) => (L.z === "av" && hellNames(E, s, L.p) >= 10 ? [{ seat: L.p, test: (x) => x.i === src.i, n: 2 }] : []) },
  // ผู้เล่นโซเชียล: จุติ: an opposing Avatar with less POWER than this goes to our Magic Zone
  "PRE0-005-2": { summon: (c) => { const { E, s, seat: p, self: x } = c; if (!x) return { explain: "", ops: [] }; const pw = E.power(s, x); const t = c.choose(bestFoe(E, s, p).filter((y) => E.power(s, y) < pw), 1, `เลือก Avatar ฝ่ายตรงข้าม POWER น้อยกว่า ${pw}`, { exact: true })[0];
      return t ? { explain: `${E.name(s, t)} ไปอยู่ที่ Magic Zone ฝ่ายเรา`, ops: [{ op: "move", i: t.i, to: "mg", seat: p }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } },
});
for (const [a, b] of [["KD01-005", "CC01-002"], ["KD01-008", "BT02-008"], ["KD01-009", "BT03-002"], ["KD01-016", "BT03-055"], ["KD01-020", "BT02-060"], ["KD02-008", "SD03-004"], ["KD04-003", "BT03-004"], ["KD04-007", "BT03-005"], ["KD04-010", "CC02-022"],
  ["KD04-014", "BT04-053"], ["KD04-015", "BT05-063"], ["SL02-001", "BT07-006"], ["SL02-006", "BT06-031"]]) if (SCRIPTS[b]) SCRIPTS[a] = SCRIPTS[b];

// ── B2SA (น้อง Passion mini set)
const passion = (E, s, x) => isAv(E, s, x) && E.named(s, x, "น้อง Passion");
const kBomb = (E, s, x) => E.def(s, x).t === "M" && E.named(s, x, "ระเบิดความรู้");
Object.assign(SCRIPTS, {
  // น้อง Passion: once a turn when it attacks, discard any number (1+) of ระเบิดความรู้: destroy an opposing Avatar with Cost ≤3 (+1 wearing คทารูปไฟฟ้า) · our End Phase: exile a ปิ๊งไอเดีย from hell: a ระเบิดความรู้ from hell to the hand
  "B2SA-001": { attack: (c) => { const { E, s, seat: p, self: x } = c; const key = "น้อง Passion:" + (x ? x.i : ""); if (!x || !once(s, p, key)) return { explain: "", ops: [] };
      const lim = 3 + [...s.P[0].mg, ...s.P[1].mg].filter((m) => m.on === x.i && !m.mute && E.named(s, m, "คทารูปไฟฟ้า")).length; const tg = bestFoe(E, s, p).filter((y) => E.costNow(s, y) <= lim); const bombs = s.P[p].hand.filter((y) => kBomb(E, s, y));
      if (!tg.length || !bombs.length) return { explain: tg.length ? "ไม่มี ระเบิดความรู้ บนมือ" : `ไม่มี Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${lim}`, ops: [] };
      const pay = c.choose(bombs, bombs.length, "ทิ้ง ระเบิดความรู้ จากบนมือ (อย่างน้อย 1 ใบ)", { optional: true }); if (!pay.length) return { explain: "ไม่ใช้ความสามารถ", ops: [] };
      const t = c.choose(tg, 1, `เลือก Avatar ฝ่ายตรงข้าม Cost ไม่เกิน ${lim} ที่จะทำลาย`, { exact: true })[0];
      return { explain: `ทิ้ง ระเบิดความรู้ ${pay.length} ใบ${t ? ` · ทำลาย ${E.name(s, t)}` : ""}`, ops: [{ op: "nameOnce", seat: p, name: key }, { op: "discard", seat: p, iids: pay.map((y) => y.i) }, ...(t ? [{ op: "destroy", i: t.i, why: "น้อง Passion" }] : [])] }; },
    endPhase: (E, s, x, L) => { if (L.z !== "av" || s.active !== L.p) return []; const P = s.P[L.p]; const idea = P.hell.find((y) => E.named(s, y, "ปิ๊งไอเดีย")); const bomb = P.hell.find((y) => kBomb(E, s, y)); return idea && bomb ? [{ op: "move", i: idea.i, to: "dark" }, { op: "move", i: bomb.i, to: "hand" }] : []; } },
  // ปิ๊งไอเดีย: a ระเบิดความรู้ or a น้อง Passion from the Deck or hell to the hand (shuffle when from the Deck)
  "B2SA-004": { cast: (c) => { const { E, s, seat: p } = c; const P = s.P[p]; const pool = (f) => [...P.deck, ...P.hell].filter((y) => f(E, s, y)); const a = pool(kBomb), b = pool(passion);
      const m = c.mode(["1) ระเบิดความรู้ จาก Deck หรือนรก ขึ้นมือ", "2) น้อง Passion จาก Deck หรือนรก ขึ้นมือ"], "ปิ๊งไอเดีย", P.av.some((y) => passion(E, s, y)) || !b.length ? 0 : 1); const list = m === 0 ? a : b;
      const t = c.choose([...list].sort((y, z) => (P.hell.includes(y) ? 0 : 1) - (P.hell.includes(z) ? 0 : 1)), 1, "เลือกการ์ดที่จะนำขึ้นมือ", { exact: true })[0]; if (!t) return { explain: "ไม่มีการ์ดให้นำขึ้นมือ", ops: [] };
      const fromDeck = P.deck.includes(t); return { explain: `${E.name(s, t)} จาก${fromDeck ? " Deck" : "นรก"} ขึ้นมือ`, ops: fromDeck ? [{ op: "search", seat: p, take: t.i, to: "hand" }] : [{ op: "move", i: t.i, to: "hand" }] }; } },
  // ระเบิดความรู้: with a น้อง Passion on our zone: draw 1 · discarded from the hand by น้อง Passion's ability: a น้อง Passion of ours +1 POWER this turn
  "B2SA-003": { canCast: (E, s, p) => s.P[p].av.some((y) => passion(E, s, y)), cast: (c) => ({ explain: "จั่วการ์ด 1 ใบ", ops: [{ op: "draw", seat: c.seat, n: 1 }] }),
    discardedOk: (E, s, x, src) => !!src && /น้อง Passion/.test(src.n || ""), discarded: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[p].av.filter((y) => passion(E, s, y)), 1, "เลือก น้อง Passion ที่จะได้ POWER +1", { exact: true })[0]; return t ? { explain: `${E.name(s, t)} POWER +1 จนจบเทิร์น`, ops: [{ op: "power", i: t.i, n: 1, temp: true }] } : { explain: "", ops: [] }; } },
  // คทารูปไฟฟ้า: wearer +1 POWER (and น้อง Passion's Cost limit +1, read by its script)
  "B2SA-005": { worn: () => 1 },
});

// ===================== coverage fixes (whole-card audit, November 2026) =====================
// abilities a script already resolves under another hook ("kill" = after it destroys an Avatar in a fight):
// the printed wording must not fire a second, unreadable time
for (const [k, o] of [["BT06-004", { attack: null }], ["BT06-014", { win: null }], ["BT06-025", { win: null }], ["BT09-024", { win: null }], ["BT10-015", { win: null }]]) if (SCRIPTS[k]) Object.assign(SCRIPTS[k], o);
Object.assign(SCRIPTS, {
  // ลุงน้อย พ่อค้าไก่ย่าง (พอดี จุติ): draw 3, then 2 cards from the hand back into the Deck and shuffle
  "CC02-008": { summon: (c) => (c.t.exact ? { explain: "จั่วการ์ด 3 ใบ แล้วเลือกการ์ดบนมือ 2 ใบกลับเข้า Deck", ops: [{ op: "draw", seat: c.seat, n: 3 }, { op: "resume", t: { i: c.t.i, c: c.t.c, when: "back2", seat: c.seat } }] } : { explain: "ไม่ได้อัญเชิญแบบพอดี ความสามารถไม่ทำงาน", ops: [] }),
    back2: (c) => { const { E, s, seat: p } = c; const H = [...s.P[p].hand].sort((a, b) => gemVal(E, s, a) - gemVal(E, s, b)); const pick = c.choose(H, 2, "เลือกการ์ดบนมือ 2 ใบกลับเข้า Deck", { exact: true });
      return { explain: `นำ ${pick.length} ใบกลับเข้า Deck แล้วสับ`, ops: [...pick.map((y) => ({ op: "move", i: y.i, to: "deckBottom" })), { op: "shuffle", seat: p }] }; } },
  // พี่วัฒน์ BGN (พอดี จุติ, once a turn by name): everyone draws or discards to five, the hands are shown, and the player with fewer GEM in hand picks one of three
  "BT07-027": { summon: (c) => { const { E, s, seat: p } = c; if (!c.t.exact) return { explain: "ไม่ได้อัญเชิญแบบพอดี ความสามารถไม่ทำงาน", ops: [] };
      if (!once(s, p, "พี่วัฒน์ BGN")) return { explain: "ใช้ความสามารถของ พี่วัฒน์ BGN ไปแล้วในเทิร์นนี้", ops: [] };
      const ops = [{ op: "nameOnce", seat: p, name: "พี่วัฒน์ BGN" }];
      for (const q of [p, 1 - p]) { const H = s.P[q].hand; if (H.length < 5) ops.push({ op: "draw", seat: q, n: 5 - H.length });
        else if (H.length > 5) { const n = H.length - 5; const low = [...H].sort((a, b) => gemVal(E, s, a) - gemVal(E, s, b)); const pick = q === p ? c.choose(low, n, `ทิ้งการ์ดบนมือ ${n} ใบให้เหลือ 5 ใบ`, { exact: true }) : low.slice(0, n); ops.push({ op: "discard", seat: q, iids: pick.map((y) => y.i) }); } }
      ops.push({ op: "resume", t: { i: c.t.i, c: c.t.c, when: "gemPick", seat: p } });
      return { explain: "ทุกคนจั่วหรือทิ้งจนมีการ์ดบนมือ 5 ใบ แล้วเทียบ GEM บนมือ", ops }; },
    gemPick: (c) => { const { E, s, seat: p } = c; const gem = (q) => s.P[q].hand.reduce((a, y) => a + (E.def(s, y).g || 0), 0); const a = gem(p), b = gem(1 - p);
      const show = [{ op: "peek", seat: p, z: "hand", label: `แสดงมือ ${s.P[p].name} (GEM ${a})` }, { op: "peek", seat: 1 - p, z: "hand", label: `แสดงมือ ${s.P[1 - p].name} (GEM ${b})` }];
      if (a === b) return { explain: `GEM บนมือเท่ากัน (${a}) ไม่มีใครได้เลือก`, ops: show };
      const q = a < b ? p : 1 - p; const P = s.P[q], O = s.P[1 - q]; // the player with less GEM chooses; for the other side the game picks what suits them
      const foe = O.av.filter((y) => !E.noAim(s, y) && !y.tok).sort(strongFirst(E, s)); const canTake = foe.length > 0 && E.avatars(P) < 4;
      const best = canTake && E.power(s, foe[0]) >= 4 ? 2 : P.av.length >= 2 ? 1 : 0;
      const m = q === p ? c.mode(["1) นำการ์ด 2 ใบจากใต้ Deck ขึ้นมือ", "2) Avatar ฝ่ายเราทุกใบ POWER +2", "3) ควบคุม Avatar ฝ่ายตรงข้าม 1 ใบ จนจบ Draw Phase ถัดไปของเจ้าของ"], `GEM บนมือน้อยกว่า (${a} ต่อ ${b}): เลือกปฏิบัติ 1 อย่าง`, best) : best;
      const who = q === p ? "" : `${P.name} มี GEM น้อยกว่า เลือก: `;
      if (m === 0) return { explain: who + "นำการ์ด 2 ใบจากใต้ Deck ขึ้นมือ", ops: [...show, ...P.deck.slice(-2).map((y) => ({ op: "move", i: y.i, to: "hand" }))] };
      if (m === 1) return { explain: who + "Avatar ทุกใบ POWER +2", ops: [...show, ...P.av.map((y) => ({ op: "power", i: y.i, n: 2, temp: false }))] };
      const t = canTake ? (q === p ? c.choose(foe, 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะควบคุม")[0] : foe[0]) : null;
      return { explain: who + (t ? `ควบคุม ${E.name(s, t)} จนจบ Draw Phase ถัดไปของเจ้าของ` : "ไม่มี Avatar ให้ควบคุม"), ops: [...show, ...(t ? [{ op: "control", i: t.i, seat: q, until: "ownerDraw" }] : [])] }; } },
  // ตัวอะไรสักอย่างที่เป็นมิตรและพูดมาก (คำสั่งเสีย): for the rest of the game we summon only blue {เอเลี่ยน}; "ตัวอะไรซักอย่าง" in our hand cost 2 less (not below 2)
  "BT09-018": { death: (c) => ({ explain: "ตลอดเกมนี้อัญเชิญได้เฉพาะ Avatar {เอเลี่ยน} สีฟ้า · ตัวอะไรสักอย่างบนมือ Cost -2 (ไม่ต่ำกว่า 2)", ops: [{ op: "gameRule", seat: c.seat, lock: "blueAlien", costDown: { name: "ตัวอะไรสักอย่าง", n: 2, min: 2 }, why: "คำสั่งเสีย ตัวอะไรสักอย่างฯ: ตลอดเกมนี้อัญเชิญได้เฉพาะ Avatar {เอเลี่ยน} สีฟ้า" }] }) },
  // Skill : Hypersense: "when the opponent uses an Avatar's ability" — that Avatar loses its abilities this turn (and with 8+ Magic in our hell it may be destroyed)
  "BT09-059": { canCast: (E, s, p) => s.P[p].av.length > 0 && s.P[p].av.every((x) => story(E, s, x)),
    react: { kinds: ["activate", "summon"], can: (E, s, p, on) => { if (!on || on.by === p) return false; const L = E.locate(s, on.i); return !!L && L.z === "av" && isAv(E, s, L.x) && (on.kind === "activate" || s.trig.some((t) => t.i === on.i && t.when === "summon")); },
      botV: (E, s, q, on) => { const L = E.locate(s, on.i); return L ? 2 + (E.def(s, L.x).c || 0) * 0.4 : 0; } },
    cast: (c) => { const { E, s, seat: p } = c; const on = c.t.on || {}; const L = on.i != null ? E.locate(s, on.i) : null; const t = L && L.z === "av" ? L.x : null;
      if (!t) return { explain: "Avatar ใบนั้นไม่อยู่บนสนามแล้ว", ops: [] }; const big = E.magicInHell(s, p) >= 8;
      const kill = big && c.mode([`ทำลาย ${E.name(s, t)} ด้วย`, "ไม่ทำลาย"], "Magic ในนรก 8 ใบขึ้นไป: ทำลาย Avatar ใบนั้นด้วยไหม", 0) === 0;
      return { explain: `${E.name(s, t)} สูญเสียความสามารถทั้งหมดจนจบเทิร์น${kill ? " และถูกทำลาย" : ""}`, ops: [{ op: "mute", i: t.i, until: "turn" }, ...(kill ? [{ op: "destroy", i: t.i, why: "Skill : Hypersense" }] : [])] }; } },
  // อินาริ โอคามิ แห่งการเก็บเกี่ยว: จุติ moves it into our Magic Zone, where its abilities keep working
  "CC02-016": { summon: (c) => (c.self && (c.E.locate(c.s, c.self.i) || {}).z === "av" ? { explain: "อินาริย้ายไปอยู่ใน Magic Zone", ops: [{ op: "move", i: c.self.i, to: "mg" }] } : { explain: "", ops: [] }),
    aura: (E, s, src, L) => (L.z === "av" || (L.z === "mg" && src.on == null) ? [{ seat: L.p, test: () => true, n: 1 + Math.floor(s.P[L.p].hell.length / 15) }] : []),
    endPhase: (E, s, x, L) => ((L.z === "av" || (L.z === "mg" && x.on == null)) && mineEnd(s, L) ? [{ op: "draw", seat: L.p, n: 1 + Math.floor(s.P[L.p].hell.length / 15) }] : []) },
});
// Skill : Dacknova has no moment written on it: usable whenever a React can be (our own turn too)
SCRIPTS["BT12-064"].react = { kinds: ["attack", "summon", "cast", "activate", "destroyed", "doom", "battle", "handed", "react"], anytime: true, botV: (E, s, q) => (s.active === q ? 2 : -1) };
// ขวัญตา เรื่องราว ตำนานอมตะ (only when it came from นักท่องเรื่องราว): once a turn, after it is attacked and survives, one Avatar on either side cannot be chosen as an attack target until the end of our turn
SCRIPTS["BT12-048"].survived = (c) => { const { E, s, seat: p, self: x } = c; if (!x || !x.story) return { explain: "", ops: [] }; const key = "ขวัญตาตำนานอมตะ:" + x.i; if (!once(s, p, key)) return { explain: "ใช้ไปแล้วในเทิร์นนี้", ops: [] };
  const pool = [...s.P[p].av.filter((y) => !y.tok).sort(strongFirst(E, s)), ...s.P[1 - p].av]; const t = c.choose(pool, 1, "เลือก Avatar ที่ฝ่ายตรงข้ามของมันจะเลือกเป็นเป้าโจมตีไม่ได้ จนจบเทิร์นเรา")[0];
  return t ? { explain: `${E.name(s, t)} ถูกเลือกเป็นเป้าหมายการโจมตีไม่ได้จนจบเทิร์นของเรา`, ops: [{ op: "nameOnce", seat: p, name: key }, { op: "noTarget", i: t.i }] } : { explain: "ไม่มี Avatar ให้เลือก", ops: [] }; };
Object.assign(SCRIPTS, {
  // ไม้กายสิทธิ์: worn by a "จอมเวท"; each time a "คาถา" Magic is used, the wearer gets POWER +1
  "BT07-063": { modOnly: (E, s, h) => E.named(s, h, "จอมเวท"), magicSeenOk: (E, s, y, Ly, d) => y.on != null && /คาถา/.test(String((d && d.n) || "")),
    magicSeen: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; return H && H.z === "av" ? { explain: `${c.E.name(c.s, H.x)} POWER +1 (ไม้กายสิทธิ์)`, ops: [{ op: "power", i: H.x.i, n: 1, temp: false }] } : { explain: "", ops: [] }; } },
  // อาวุธของเพมมุ ปืนพกรุ่น 19: worn by เพมมุ (one อาวุธของเพมมุ at a time); its wearer destroys an Avatar in a fight with 2+ POWER to spare → the opponent's top LIFE is flipped
  "BT09-067": { modOnly: (E, s, h) => { const L = E.locate(s, h.i); return E.named(s, h, "เพมมุ") && !(L && s.P[L.p].mg.some((z) => z.on != null && E.named(s, z, "อาวุธของเพมมุ"))); },
    hostWin: (c) => { const H = c.self && c.self.on != null ? c.E.locate(c.s, c.self.on) : null; const hp = c.t.ap != null ? c.t.ap : H ? c.E.power(c.s, H.x) : 0;
      return hp - (c.t.dp || 0) >= 2 ? { explain: "หงาย LIFE ใบบนสุดของฝ่ายตรงข้าม 1 ใบ", ops: [{ op: "lifeFlip", seat: 1 - c.seat }] } : { explain: "POWER ต่างกันไม่ถึง 2", ops: [] }; } },
  // เยี่ยวรดศาล: only with an Avatar {มนุษย์} of Cost 3+ on our zone: a {ผี} Avatar of Cost 4 or less from the Deck, summoned as จุติ
  "KD03-013": { canCast: (E, s, p) => s.P[p].av.some((y) => sy(E, s, y, "มนุษย์") && (E.def(s, y).c || 0) >= 3),
    cast: (c) => { const { E, s, seat: p } = c; const pool = uniq(E, s, s.P[p].deck.filter((y) => isAv(E, s, y) && sy(E, s, y, "ผี") && (E.def(s, y).c || 0) <= 4)).sort(strongFirst(E, s));
      const t = room(c) ? c.choose(pool, 1, "เลือก Avatar {ผี} Cost ไม่เกิน 4 จาก Deck อัญเชิญแบบจุติ")[0] : null;
      return t ? { explain: `อัญเชิญ ${E.name(s, t)} จาก Deck แบบจุติ แล้วสับ Deck`, ops: [{ op: "put", i: t.i, jt: true }, { op: "shuffle", seat: p }] } : { explain: room(c) ? "ไม่มี Avatar {ผี} Cost ไม่เกิน 4 ใน Deck" : "Avatar Zone เต็ม", ops: [{ op: "shuffle", seat: p }] }; } },
});
// ของขวัญจากโอตะ (KD03-019 / BT04-054): worn only by a "ไอดอล" (the wording has no "เท่านั้น", so the text reader misses it)
SCRIPTS["KD03-019"].modOnly = (E, s, h) => E.named(s, h, "ไอดอล");
// ขวัญตา เรื่องราว ครุฑเจ้าเวหา (from นักท่องเรื่องราว): one more React "Skill" a turn (engine: E.skillExtra)
SCRIPTS["BT09-044"].skillExtra = true;
// ชาช่าจัง ไอดอลคนเก่ง: wears only "โอตะ"
SCRIPTS["BT07-022"].wearOnly = (E, s, m) => E.named(s, m, "โอตะ");
// อาดัส มังกรแห่งห้วงเหวน้ำลึก: once a turn, when an Avatar in the opponent's Magic Zone is destroyed, it wakes up
SCRIPTS["BT12-028"].foeMgDeath = (c) => (c.self && (c.E.locate(c.s, c.self.i) || {}).z === "av" && !c.self.a ? { explain: "อาดัสกลับมาเป็นสภาพตื่น", ops: [{ op: "wake", i: c.self.i, v: true }] } : { explain: "", ops: [] });
// ไดโนกาฬสินธุ์ - สยามแรปเตอร์: scouted (and not taken) by the ability of one of our {กะปอม} Avatars → it may be summoned (the game always takes the free summon)
SCRIPTS["BT12-025"].scoutedPut = (E, s, x, src) => ["A", "T"].includes(src.t) && String(src.sy || "").includes("กะปอม");
Object.assign(SCRIPTS, {
  // สไปรท์ ยอดสุนัข: at our End Phase, asleep → it wakes, and it gets POWER +2 until our next Draw Phase
  "BT09-009": { endPhase: (E, s, x, L) => (L.z === "av" && s.active === L.p ? [...(!x.a ? [{ op: "wake", i: x.i, v: true }] : []), { op: "power", i: x.i, n: 2, temp: "next" }] : []) },
  // บึงทมิฬ People - คุณปลาชด: while "บึงทมิฬ" is on the Land Magic Zone every player controls at most one Avatar that is not {ปลา}
  "CC02-009": { limitAv: (E, s, src, L, p, x) => L.z === "av" && E.lands(s).some((l) => E.named(s, l, "บึงทมิฬ")) && !sy(E, s, x, "ปลา") && s.P[p].av.some((y) => !y.tok && !sy(E, s, y, "ปลา")),
    check: (E, s, x, L) => (L.z === "av" && E.lands(s).some((l) => E.named(s, l, "บึงทมิฬ")) ? [0, 1].flatMap((q) => { const non = s.P[q].av.filter((y) => !y.tok && !sy(E, s, y, "ปลา")); return non.length > 1 ? [...non].sort(cheapCard(E, s)).slice(0, non.length - 1).map((y) => ({ op: "move", i: y.i, to: "hell" })) : []; }) : []) },
});
Object.assign(SCRIPTS, {
  // บึงทมิฬ People - คุณตะพาบ (คำสั่งเสีย): a "วอเตอร์แมน" from our hell back into the Deck and shuffle, then draw 1 (the name is written without quotes, which the text reader misses)
  "BT07-017": { death: (c) => { const { E, s, seat: p } = c; const t = s.P[p].hell.find((y) => E.named(s, y, "วอเตอร์แมน"));
    return { explain: `${t ? `${E.name(s, t)} กลับเข้า Deck แล้วสับ · ` : "ไม่มี วอเตอร์แมน ในนรก · "}จั่ว 1 ใบ`, ops: [...(t ? [{ op: "move", i: t.i, to: "deckBottom" }, { op: "shuffle", seat: p }] : []), { op: "draw", seat: p, n: 1 }] }; } },
  // ริน บันนี่เกิร์ล (จุติ): take control of an opposing POWER 0 Avatar, then that Avatar gets POWER +1
  "BT09-023": { summon: (c) => { const { E, s, seat: p } = c; const pool = s.P[1 - p].av.filter((y) => E.power(s, y) === 0 && !E.noAim(s, y));
    if (!pool.length) return { explain: "ไม่มี Avatar POWER 0 ฝ่ายตรงข้าม", ops: [] }; if (E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6) return { explain: "Avatar Zone เราเต็ม", ops: [] };
    const t = c.choose([...pool].sort(strongFirst(E, s)), 1, "เลือก Avatar POWER 0 ฝ่ายตรงข้ามที่จะควบคุม")[0];
    return t ? { explain: `ควบคุม ${E.name(s, t)} แล้ว POWER +1`, ops: [{ op: "control", i: t.i, seat: p }, { op: "power", i: t.i, n: 1, temp: false }] } : { explain: "ไม่ได้เลือก", ops: [] }; } },
});
Object.assign(SCRIPTS, {
  // ซุนเกี๋ยน (คำสั่งเสีย): a "ขุนพล" {ชาวต่างชาติ} of ours gets POWER +2 until the end of the opponent's next turn
  "SD07-005": { death: (c) => { const { E, s, seat: p } = c; const pool = s.P[p].av.filter((y) => E.named(s, y, "ขุนพล") && sy(E, s, y, "ต่างชาติ")).sort(strongFirst(E, s));
    const t = c.choose(pool, 1, "เลือกขุนพล {ชาวต่างชาติ} ฝ่ายเรา POWER +2")[0]; if (!t) return { explain: "ไม่มีขุนพล {ชาวต่างชาติ} บนสนาม", ops: [] };
    const end = s.active === p ? s.turn + 1 : s.turn + 2;
    return { explain: `${E.name(s, t)} POWER +2 จนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, ops: [{ op: "power", i: t.i, n: 2, temp: false }, { op: "atEnd", turn: end, ops: [{ op: "power", i: t.i, n: -2, temp: false }], why: "POWER +2 จากซุนเกี๋ยนหมดเวลา" }] }; } },
  // ยอดมนุษย์หัวยางลบ (พอดี, once a turn): an opposing Avatar loses all its abilities until the end of the opponent's next turn — only when this one was summoned paying exactly
  "BT10-030": { activate: { label: "พอดี: Avatar ฝ่ายตรงข้ามสูญเสียความสามารถจนจบเทิร์นถัดไปของฝ่ายตรงข้าม", can: (E, s, x, L) => L.z === "av" && !!x.px && s.P[1 - L.p].av.some((y) => !E.noAim(s, y)),
    run: (c) => { const { E, s, seat: p } = c; const t = c.choose(s.P[1 - p].av.filter((y) => !E.noAim(s, y)).sort(strongFirst(E, s)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะสูญเสียความสามารถ")[0];
      return t ? { explain: `${E.name(s, t)} สูญเสียความสามารถทั้งหมดจนจบเทิร์นถัดไปของฝ่ายตรงข้าม`, ops: [{ op: "mute", i: t.i, until: "oppturn" }] } : { explain: "ไม่มีเป้าหมาย", ops: [] }; } } },
});
