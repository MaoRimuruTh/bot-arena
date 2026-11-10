import { h, clone, toast, openSheet, confirmBox, busy, holo } from "../util.js?v=20261110160417";
import { CARDS, card, baseId, isBase, TYPE_TH, SUB_TH, COLORS, colorOf, setName, setCode, artImg, limitOf, deckEntries, deckCount, validateDeck, deckStats, deckAce, shoppingList, starterDecks, ownedOf, cardLine } from "../cards.js?v=20261110160417";
import { Data, Me, saveDeck, deleteDeck } from "../fb.js?v=20261110160417";
import { Views, cardBtn, showCard } from "../ui.js?v=20261110160417";
import { Ciel, aiErr, cielBuild, cielAnalyze, cielReadImport, STYLE_TH } from "../ai.js?v=20261110160417";
import { filterBar, filterCards } from "./library.js?v=20261110160417";
import { openingOdds } from "./lab.js?v=20261110160417";
import { CIEL_DECKS } from "../cieldecks.js?v=20261110160417";

// Ciel's theme decks: print codes → card ids (resolved once the card data is loaded)
let cielCache = null;
export function cielDecks() {
  if (cielCache && cielCache.n === CARDS.length) return cielCache.list;
  const byPrint = (p) => { const c = CARDS.find((x) => x.p === p); return c ? baseId(c.i) : null; };
  const list = CIEL_DECKS.map((z) => { const main = {}; for (const [p, n] of z.main) { const id = byPrint(p); if (id != null) main[id] = (main[id] || 0) + n; }
    return { id: z.id, name: z.name, theme: z.theme, plan: z.plan, style: z.style, main, life: z.life.map(byPrint).filter((x) => x != null), ace: z.ace.map(byPrint).filter((x) => x != null), owner: "ciel", ownerName: "ชิเอล", starter: true, ciel: true, updatedAt: 0 }; });
  cielCache = { n: CARDS.length, list }; return list;
}

export let Editing = null;
const PickFilter = { q: "", t: "", co: "", c: "", set: "", rare: "", sy: "", variants: false, owned: false };
const blank = () => ({ id: null, name: "เด็คใหม่", main: {}, life: [], ace: [], plan: "", notes: "", style: "win" });
export const allDecks = () => [...Data.decks, ...cielDecks(), ...starterDecks()];
export const deckById = (id) => (id === "__editing" ? Editing : allDecks().find((d) => d.id === id));
export function addToDeck(d, id, delta = 1) {
  const c = card(id); if (!c) return;
  if (c.t === "L") {
    if (delta > 0) { if ((d.life || []).length >= 5) return toast("LIFE ครบ 5 ใบแล้ว"); if (d.life.some((x) => card(x).n === c.n)) return toast("LIFE ชื่อซ้ำไม่ได้"); d.life = [...d.life, c.i]; }
    else d.life = d.life.filter((x) => +x !== +id); return;
  }
  if (c.t === "T") return toast("Token ใส่ในเด็คไม่ได้");
  const same = deckEntries(d).filter((e) => e.c.n === c.n).reduce((a, e) => a + e.n, 0);
  if (delta > 0 && same >= limitOf(c)) return toast(`${c.n} ใส่ได้สูงสุด ${limitOf(c)} ใบ`);
  const n = Math.max(0, (d.main[c.i] || 0) + delta); const main = { ...d.main }; if (n) main[c.i] = n; else delete main[c.i]; d.main = main;
}
const deckColors = (d) => { const st = deckStats(d); return Object.entries(st.colors).filter(([k]) => COLORS.includes(k)).sort((a, b) => b[1] - a[1]).map(([k]) => k); };
function deckTile(d) {
  const ace = deckAce(d); const v = validateDeck(d); const ms = Data.matches.filter((m) => m.deckId === d.id); const w = ms.filter((m) => m.result === "win").length;
  const cols = deckColors(d); const band = cols.length ? `linear-gradient(180deg,${cols.map(colorOf).join(",")}${cols.length === 1 ? "," + colorOf(cols[0]) : ""})` : "var(--c-none)";
  return h("a", { class: "tile", href: "#decks/view/" + d.id }, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }), h("div", { class: "band", style: "background:" + band }),
    h("div", { class: "in" }, h("span", { class: "eyebrow" }, d.ciel ? "✦ ชิเอลแนะนำ" : d.starter ? "ทางการ" : d.owner === Me.uid ? "เด็คของฉัน" : "ของ " + (d.ownerName || "เพื่อน")), h("h3", null, d.name),
      h("div", { class: "small muted" }, d.theme || (ace ? "เอซ: " + ace.n : "")),
      h("div", { class: "meta" }, h("span", { class: "chip num" }, deckCount(d) + "/50"), v.ok ? h("span", { class: "chip good" }, "พร้อมเล่น") : h("span", { class: "chip warn" }, "ยังไม่ครบ"), ms.length ? h("span", { class: "chip num" }, `ชนะ ${w}/${ms.length}`) : null)));
}

Views.decks = {
  render(root, [mode, arg]) {
    if (mode === "view") return this.view(root, arg);
    if (mode === "edit" || mode === "new") {
      if (mode === "new") { if (!Editing || Editing.id) Editing = blank(); }
      else if (!Editing || Editing.id !== arg) { const d = deckById(arg); if (!d) { location.hash = "#decks"; return; } Editing = d.owner === Me.uid ? clone(d) : { ...clone(d), id: null, owner: Me.uid, name: d.name + " (สำเนา)", starter: false }; }
      return this.editor(root);
    }
    const mine = Data.decks.filter((d) => d.owner === Me.uid), friends = Data.decks.filter((d) => d.owner !== Me.uid);
    root.replaceChildren(...[h("div", { class: "pagehead" }, h("div", null, h("h1", null, "เด็ค"), h("div", { class: "muted small" }, "จัดเด็คก่อนซื้อจริง ลองเล่น แล้วดูว่าต้องซื้อการ์ดอะไรเพิ่ม")),
      h("div", { class: "row" }, h("button", { class: "btn ciel", onclick: () => openAceBuilder([]) }, "ให้ชิเอลจัดรอบการ์ดเอซ"), h("a", { class: "btn gold", href: "#decks/new", onclick: () => { Editing = blank(); } }, "สร้างเด็คใหม่"))),
      !Data.ready.decks ? busy("กำลังโหลดเด็ค…") : mine.length ? h("div", { class: "tiles" }, mine.map(deckTile)) : h("div", { class: "empty" }, "ยังไม่มีเด็คของคุณ เริ่มจากเลือกการ์ดเอซให้ชิเอลจัด หรือคัดลอก Starter Deck ด้านล่างไปแก้ต่อ"),
      friends.length ? h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "เด็คของเพื่อน"), h("div", { class: "tiles" }, friends.map(deckTile))) : null,
      h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "✦ เด็คแนะนำจากชิเอล"), h("div", { class: "muted small" }, "เด็คธีมที่ชิเอลจัดให้ริมุรุ เปิดดูแผนการเล่น ลงสนามได้เลย หรือคัดลอกไปแก้ต่อ"), h("div", { class: "tiles" }, cielDecks().map(deckTile))),
      h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "Starter Deck ทางการ"), h("div", { class: "muted small" }, "จัดตามจำนวนในกล่องจริงจากข้อมูลทางการ"), h("div", { class: "tiles" }, starterDecks().map(deckTile)))].filter(Boolean));
    if (mode === "ace" && arg) openAceBuilder([+arg]);
  },
  refresh(root, parts) { if (parts[0] === "edit" || parts[0] === "new") return this.drawSide && this.drawSide(); this.render(root, parts); },

  // ---------- deck lab page ----------
  view(root, id) {
    const d = deckById(id); if (!d) { root.replaceChildren(busy("กำลังโหลดเด็ค…")); return; }
    const st = deckStats(d), v = validateDeck(d), ace = deckAce(d), shop = shoppingList(d);
    const need = shop.reduce((a, x) => a + x.need, 0), have = shop.reduce((a, x) => a + Math.min(x.need, x.have), 0);
    const ms = Data.matches.filter((m) => m.deckId === d.id); const w = ms.filter((m) => m.result === "win").length;
    const preview = h("div", { class: "stack", style: "gap:10px" });
    const showPrev = (c) => preview.replaceChildren(h("div", { class: "row", style: "align-items:flex-start;gap:14px;flex-wrap:nowrap" }, holo(h("div", { class: "ccard", style: "width:150px;flex:none;cursor:default" }, artImg(c))),
      h("div", { class: "stack", style: "gap:6px;min-width:0" }, h("b", { style: "font-family:var(--f-display)" }, c.n), h("div", { class: "small muted" }, cardLine(c, 0).split(" : ")[0].replace(c.n + " ", "")), h("div", { class: "small", style: "line-height:1.55;max-height:150px;overflow:auto" }, c.x || ""))));
    if (ace) showPrev(ace);
    const groups = {}; for (const e of deckEntries(d).sort((a, b) => (a.c.t > b.c.t ? 1 : a.c.t < b.c.t ? -1 : (a.c.c ?? 99) - (b.c.c ?? 99)))) { const k = e.c.t === "M" ? "MAGIC" : TYPE_TH[e.c.t].toUpperCase(); (groups[k] = groups[k] || []).push(e); }
    const isAce = (i) => (d.ace || []).map(Number).includes(+i);
    const pill = (e) => { const o = ownedOf(e.id); const miss = Math.max(0, e.n - o);
      return h("button", { class: "pill" + (isAce(e.id) ? " ace" : ""), style: e.c.co ? `background:linear-gradient(90deg,color-mix(in srgb,${colorOf(e.c.co)} 30%,transparent),transparent 75%);border-color:color-mix(in srgb,${colorOf(e.c.co)} 45%,transparent)` : "", onmouseenter: () => showPrev(e.c), onfocus: () => showPrev(e.c), onclick: () => showCard(e.id) },
        h("span", { class: "q" }, e.n + "×"), e.c.t !== "M" ? h("span", { class: "cost", style: "background:" + colorOf(e.c.co) }, e.c.c ?? "-") : h("span", { class: "chip", style: "font-size:.66rem" }, SUB_TH[e.c.st]),
        h("span", { class: "nm" }, e.c.n), isAce(e.id) ? h("span", { class: "chip gold" }, "เอซ") : null, h("span", { class: "st " + (miss ? "" : "muted"), style: miss ? "color:var(--warn)" : "color:#8ee3b2" }, miss ? "ขาด " + miss : "มีครบ")); };
    const mx = Math.max(1, ...st.curve.map((o) => Object.values(o).reduce((a, b) => a + b, 0)));
    const totalCol = Object.values(st.colors).reduce((a, b) => a + b, 0) || 1; let acc = 0;
    const donut = Object.entries(st.colors).map(([k, n]) => { const a = acc; acc += (n / totalCol) * 100; return `${colorOf(k === "ไร้สี" ? "" : k)} ${a}% ${acc}%`; }).join(",");
    const odds = ace ? openingOdds(d, [ace.i], 1500) : null;
    root.replaceChildren(
      h("section", { class: "hero" }, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }),
        h("div", { class: "in" }, h("div", { class: "row", style: "gap:6px" }, ...deckColors(d).map((c) => h("span", { class: "chip", style: `background:color-mix(in srgb,${colorOf(c)} 25%,transparent)` }, c)), d.style && STYLE_TH[d.style] ? h("span", { class: "chip" }, STYLE_TH[d.style].split(":")[0]) : null, v.ok ? h("span", { class: "chip good" }, "ถูกกติกา") : h("span", { class: "chip warn" }, "ยังไม่ครบกติกา")),
          h("h1", null, d.name), h("div", { class: "muted small" }, [ace ? "เอซ: " + ace.n : null, `${deckCount(d)} + LIFE ${(d.life || []).length}`, d.ciel ? "ชิเอลแนะนำ" : d.starter ? "เด็คทางการ" : d.owner === Me.uid ? "เด็คของคุณ" : "ของ " + (d.ownerName || "เพื่อน"), ms.length ? `ชนะ ${w}/${ms.length} เกม` : null].filter(Boolean).join(" · ")),
          h("div", { class: "row" }, h("a", { class: "btn gold", href: "#play/deck/" + d.id }, "ลงสนามกับเด็คนี้"), h("button", { class: "btn ciel", onclick: () => openAnalysis(d) }, "ชิเอลวิเคราะห์"),
            h("a", { class: "btn", href: "#decks/edit/" + d.id }, d.owner === Me.uid ? "แก้ไข" : "คัดลอกไปแก้"), h("button", { class: "btn", onclick: () => openShopping(d) }, "รายการต้องซื้อ")))),
      h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ทั้งเด็ค"), h("b", null, need)), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "มีแล้ว"), h("b", { style: "color:#8ee3b2" }, have)),
        h("div", { class: "stat buy", style: "cursor:pointer", onclick: () => openShopping(d) }, h("span", { class: "eyebrow" }, "ต้องซื้อเพิ่ม"), h("b", null, need - have + " ใบ")),
        odds ? h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ได้เอซภายในเทิร์น 3"), h("b", { style: "color:var(--gold-hi)" }, Math.round(odds.t3 * 100) + "%")) : null),
      h("div", { class: "lab" },
        h("div", { class: "rows" }, ...Object.entries(groups).flatMap(([k, list]) => [h("div", { class: "eyebrow h" }, `${k} · ${list.reduce((a, e) => a + e.n, 0)}`), ...list.map(pill)]),
          h("div", { class: "eyebrow h" }, `LIFE · ${(d.life || []).length}`), ...(d.life || []).map((i) => pill({ c: card(i), n: 1, id: +i }))),
        h("aside", { class: "stack" }, h("div", { class: "panel" }, preview),
          d.plan ? h("div", { class: "panel stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, "แผนการเล่นจากชิเอล"), h("div", { class: "small", style: "white-space:pre-wrap;line-height:1.6" }, d.plan)) : null,
          h("div", { class: "panel stack", style: "gap:8px" }, h("div", { class: "eyebrow" }, "เส้น Cost แยกสี"),
            h("div", { class: "curve", role: "img", "aria-label": "เส้น Cost" }, st.curve.map((o) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return h("div", { class: "col" }, h("span", { class: "val" }, tot || ""), ...Object.entries(o).map(([k, n]) => h("span", { style: `height:${(n / mx) * 85}%;background:${colorOf(k === "ไร้สี" ? "" : k)}` }))); })),
            h("div", { class: "curve-l" }, [0, 1, 2, 3, 4, 5, 6, 7, "8+"].map((x) => h("span", null, x)))),
          h("div", { class: "panel row", style: "gap:16px;flex-wrap:nowrap" }, h("div", { class: "donut", style: `background:conic-gradient(${donut})`, role: "img", "aria-label": "สัดส่วนสี" }),
            h("div", { class: "stack small", style: "gap:4px" }, Object.entries(st.colors).map(([k, n]) => h("span", { class: "row", style: "gap:7px" }, h("span", { class: "dot", style: "background:" + colorOf(k === "ไร้สี" ? "" : k) }), `${k} ${n}`))),
            h("div", { class: "stack small", style: "margin-left:auto;text-align:right;gap:2px" }, h("span", { class: "muted" }, "GEM รวม"), h("b", { class: "num" }, st.gem), h("span", { class: "muted" }, "POWER เฉลี่ย"), h("b", { class: "num" }, st.avgPw.toFixed(1)))))));
  },

  // ---------- editor ----------
  editor(root) {
    const d = Editing; let limit = 90;
    const grid = h("div", { class: "grid-cards", style: "grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:12px" }); const more = h("div", { class: "row", style: "justify-content:center;margin-top:12px" });
    const drawPick = () => {
      const list = filterCards(PickFilter);
      grid.replaceChildren(...list.slice(0, limit).map((c) => { const inDeck = c.t === "L" ? (d.life.includes(c.i) ? 1 : 0) : d.main[c.i] || 0;
        return h("div", { class: "libi", onmouseenter: () => showHov(c) }, cardBtn(c.i, { badge: inDeck ? "×" + inDeck : null, onclick: () => { addToDeck(d, c.i, 1); drawPick(); this.drawSide(); } }),
          h("div", { class: "row", style: "justify-content:space-between;gap:4px;flex-wrap:nowrap" }, h("div", { class: "nm grow" }, c.n), h("button", { class: "mini", "aria-label": "รายละเอียด " + c.n, onclick: () => showCard(c.i) }, "i"))); }));
      more.replaceChildren(list.length > limit ? h("button", { class: "btn sm", onclick: () => { limit += 90; drawPick(); } }, "แสดงเพิ่ม") : "");
    };
    const side = h("div", { class: "stack" });
    // hover preview that stays on screen (sticky column): see a card without clicking it
    const hov = h("div", { class: "panel hovprev" }, h("div", { class: "muted small", style: "grid-column:1/-1" }, "ชี้เมาส์ที่การ์ดเพื่อดูรูปใหญ่และข้อความ"));
    const showHov = (c) => hov.replaceChildren(holo(h("div", { class: "ccard" }, artImg(c))), h("div", { class: "stack", style: "gap:5px;min-width:0" }, h("b", { style: "font-family:var(--f-display)" }, c.n), h("div", { class: "tiny muted" }, cardLine(c, 0).split(" : ")[0].replace(c.n + " ", "") + " · " + c.p), h("div", { class: "small", style: "line-height:1.55;max-height:170px;overflow:auto;white-space:pre-wrap" }, c.x || "ไม่มีข้อความความสามารถ")));
    this.drawSide = () => {
      const v = validateDeck(d); const st = deckStats(d); const isAce = (id) => (d.ace || []).map(Number).includes(+id);
      const rows = deckEntries(d).sort((a, b) => (a.c.t > b.c.t ? 1 : a.c.t < b.c.t ? -1 : (a.c.c ?? 99) - (b.c.c ?? 99)));
      side.replaceChildren(hov,
        h("div", { class: "panel stack" }, h("input", { type: "text", id: "deck-name", value: d.name, "aria-label": "ชื่อเด็ค", style: "font:700 1.15rem var(--f-display)", oninput: (e) => { d.name = e.target.value; } }),
          h("div", { class: "valid" }, v.items.map((x) => h("div", { class: x.ok ? "ok" : "no" }, (x.ok ? "✓ " : "✗ ") + x.msg))),
          h("div", { class: "row small" }, Object.entries(st.colors).map(([k, n]) => h("span", { class: "chip" }, h("span", { class: "dot", style: "background:" + colorOf(k === "ไร้สี" ? "" : k) }), `${k} ${n}`)), h("span", { class: "chip num" }, "GEM " + st.gem)),
          h("div", { class: "row" },
            h("button", { class: "btn gold", onclick: async () => { try { d.id = await saveDeck(d); toast("บันทึกเด็คแล้ว"); location.hash = "#decks/view/" + d.id; } catch (e) { console.warn(e); toast("บันทึกไม่สำเร็จ", "bad"); } } }, "บันทึก"),
            h("button", { class: "btn ciel", onclick: () => openAnalysis(d) }, "ชิเอลวิเคราะห์"),
            h("button", { class: "btn", onclick: () => openImport(d, () => { drawPick(); this.drawSide(); }) }, "นำเข้าจากภาพ"),
            d.id ? h("button", { class: "btn danger sm", onclick: () => confirmBox("ลบเด็คนี้ถาวร?", "ลบเด็ค", async () => { await deleteDeck(d.id); Editing = null; location.hash = "#decks"; toast("ลบเด็คแล้ว"); }, true) }, "ลบ") : null)),
        h("div", { class: "panel stack", style: "gap:6px" }, rows.length ? rows.map((e) => h("div", { class: "pill" + (isAce(e.id) ? " ace" : ""), style: "cursor:default", onmouseenter: () => showHov(e.c) },
            h("span", { class: "q" }, e.n), e.c.t !== "M" ? h("span", { class: "cost", style: "background:" + colorOf(e.c.co) }, e.c.c ?? "-") : h("span", { class: "chip", style: "font-size:.66rem" }, SUB_TH[e.c.st]),
            h("span", { class: "nm", style: "cursor:pointer", onclick: () => showCard(e.id), title: e.c.p }, e.c.n), h("span", { class: "tiny muted num" }, e.c.p),
            e.c.t === "A" ? h("button", { class: "mini", title: "ตั้งเป็นเอซ", "aria-pressed": isAce(e.id) ? "true" : "false", onclick: () => { d.ace = isAce(e.id) ? d.ace.filter((x) => +x !== e.id) : [...(d.ace || []), e.id].slice(-2); this.drawSide(); } }, isAce(e.id) ? "★" : "☆") : null,
            h("button", { class: "mini", "aria-label": "ลด", onclick: () => { addToDeck(d, e.id, -1); drawPick(); this.drawSide(); } }, "−"), h("button", { class: "mini", "aria-label": "เพิ่ม", onclick: () => { addToDeck(d, e.id, 1); drawPick(); this.drawSide(); } }, "+"))) : h("div", { class: "empty" }, "แตะการ์ดทางซ้ายเพื่อเพิ่มลงเด็ค"),
          h("div", { class: "eyebrow", style: "margin-top:8px" }, `LIFE ${d.life.length}/5`), h("div", { class: "pick" }, d.life.map((id) => cardBtn(id, { badge: "เอาออก", onclick: () => { addToDeck(d, id, -1); drawPick(); this.drawSide(); } })),
            d.life.length < 5 ? h("button", { class: "btn sm", onclick: () => { PickFilter.t = "L"; const s = document.getElementById("pk-t"); if (s) s.value = "L"; drawPick(); } }, "เลือก LIFE") : null)));
    };
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", { class: "row" }, h("a", { class: "btn sm", href: d.id ? "#decks/view/" + d.id : "#decks" }, "← กลับ"), h("h1", null, d.id ? "แก้ไขเด็ค" : "เด็คใหม่"))),
      h("div", { class: "editor" }, h("div", null, filterBar(PickFilter, () => { limit = 90; drawPick(); }, "pk-"), grid, more), side));
    drawPick(); this.drawSide();
  },
};

// ---------- Ciel: build around an ace ----------
export function openAceBuilder(preset) {
  const st = { ace: [...preset], colors: [], style: "win", request: "", useOwned: false }; let q = "";
  openSheet((api) => {
    const results = h("div", { class: "pick" }); const chosen = h("div", { class: "row" }); const out = h("div"); const colorRow = h("div", { class: "row small" });
    const drawChosen = () => {
      chosen.replaceChildren(...(st.ace.length ? st.ace.map((id) => h("div", { class: "row", style: "gap:10px;flex-wrap:nowrap" }, h("div", { style: "width:84px" }, cardBtn(id, { onclick: () => showCard(id) })), h("div", { class: "stack", style: "gap:3px" }, h("b", null, card(id).n), h("span", { class: "small muted" }, cardLine(card(id), 60).split(" : ")[0]), h("button", { class: "btn sm", onclick: () => { st.ace = st.ace.filter((x) => x !== id); drawChosen(); } }, "เอาออก")))) : [h("span", { class: "muted small" }, "ยังไม่ได้เลือกเอซ ค้นชื่อด้านล่าง เลือกได้ 2 ใบ")]));
      const auto = [...new Set(st.ace.map((i) => card(i).co).filter(Boolean))]; if (!st.colors.length && auto.length) st.colors = auto;
      colorRow.replaceChildren(h("span", { class: "muted" }, "สีของเด็ค"), ...COLORS.map((c) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: st.colors.includes(c), onchange: (e) => { st.colors = e.target.checked ? [...st.colors, c] : st.colors.filter((x) => x !== c); } }), h("span", { class: "dot", style: "background:" + colorOf(c) }), c)));
    };
    const search = () => {
      const list = q.trim() ? CARDS.filter((c) => isBase(c) && c.t === "A" && (c.n.includes(q.trim()) || (c.sy || "").includes(q.trim()))).sort((a, b) => (b.pw || 0) - (a.pw || 0)).slice(0, 24) : CARDS.filter((c) => isBase(c) && c.t === "A" && c.o1).slice(-24);
      results.replaceChildren(...list.map((c) => cardBtn(c.i, { onclick: () => { if (!st.ace.includes(c.i)) st.ace = [...st.ace, c.i].slice(-2); drawChosen(); } })));
    };
    drawChosen(); search();
    const seg = h("div", { class: "seg", role: "group", "aria-label": "แนวเด็ค" }, [["win", "ล่าชัย"], ["fun", "มันส์สุด"], ["budget", "งบน้อย"]].map(([k, t]) => h("button", { "aria-pressed": st.style === k ? "true" : "false", onclick: (e) => { st.style = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); } }, t)));
    return [h("div", { class: "stack" }, h("div", { class: "eyebrow" }, "การ์ดเอซ"), chosen, h("input", { type: "search", id: "ace-q", placeholder: "ค้นชื่อ Avatar หรือ Symbol เช่น มังกร", oninput: (e) => { q = e.target.value; search(); } }), h("div", { class: "tiny muted" }, q ? "ผลการค้นหา" : "ตัวอย่าง: การ์ด Only #1 ล่าสุด"), results),
      colorRow, h("div", { class: "row" }, h("span", { class: "small muted" }, "แนวเด็ค"), seg, h("label", { class: "chk small" }, h("input", { type: "checkbox", onchange: (e) => (st.useOwned = e.target.checked) }), "ใช้การ์ดที่มีจริงก่อน")),
      h("textarea", { id: "ace-req", rows: 2, placeholder: "อยากได้อะไรเพิ่ม เช่น อยากชนะเร็วในเทิร์น 6, ไม่เอา React เยอะ", oninput: (e) => (st.request = e.target.value) }),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => {
        const btn = e.currentTarget; if (!Ciel.on()) { out.replaceChildren(h("div", { class: "muted" }, aiErr({ code: "no_key" }))); return; }
        btn.disabled = true; out.replaceChildren(busy("ชิเอลกำลังคัดการ์ดจากคลังทั้งหมด อาจใช้เวลาครึ่งนาที…"));
        try {
          const r = await cielBuild({ ace: st.ace, colors: st.colors, style: st.style, request: st.request, owned: st.useOwned ? Object.keys(Data.owned).join(",") : "" });
          const deck = { ...blank(), name: r.name, main: r.main, life: r.life, ace: r.ace, style: st.style, plan: [r.meta.plan, r.meta.mulligan ? "เปลี่ยนมือ: " + r.meta.mulligan : ""].filter(Boolean).join("\n") };
          const v = validateDeck(deck);
          out.replaceChildren(h("div", { class: "panel stack" }, h("div", { class: "row" }, h("h3", null, r.name), r.meta.rating ? h("span", { class: "chip " + (/[SA]/.test(r.meta.rating) ? "good" : "warn") }, "เอซระดับ " + r.meta.rating) : null, h("span", { class: "chip num" }, deckCount(deck) + "/50")),
            r.meta.aceNote ? h("div", { class: "small" }, r.meta.aceNote) : null, r.meta.plan ? h("div", { class: "fx small" }, r.meta.plan) : null,
            r.meta.covers.length ? h("div", { class: "small" }, h("b", null, "จุดอ่อนที่อุดแล้ว"), h("ul", { style: "margin:4px 0;padding-left:18px" }, r.meta.covers.map((x) => h("li", null, x)))) : null,
            r.meta.risks.length ? h("div", { class: "small" }, h("b", null, "ต้องระวัง"), h("ul", { style: "margin:4px 0;padding-left:18px" }, r.meta.risks.map((x) => h("li", null, x)))) : null,
            h("div", { class: "valid" }, v.items.filter((x) => !x.ok).map((x) => h("div", { class: "no" }, "✗ " + x.msg + " (แก้ต่อในตัวแก้ไขได้)"))),
            h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { Editing = deck; api.close(); location.hash = "#decks/new"; } }, "เปิดในตัวแก้ไข"))));
        } catch (err) { out.replaceChildren(h("div", { class: "muted" }, aiErr(err))); }
        btn.disabled = false;
      } }, "ให้ชิเอลจัดเด็ค"), !Ciel.on() ? h("span", { class: "small muted" }, "ต้องใส่ API key ที่หน้าตั้งค่าก่อน") : null), out];
  }, { title: "จัดเด็ครอบการ์ดเอซ", sub: "ชิเอลคัดการ์ดหนุนเอซจากคลังทั้งหมด พร้อมแผนการเล่น", wide: true });
}
export function openAnalysis(d) {
  openSheet(() => {
    const out = h("div", null, Ciel.on() ? busy("ชิเอลกำลังวิเคราะห์เด็คและผลการเล่น…") : h("div", { class: "muted" }, aiErr({ code: "no_key" })));
    if (Ciel.on()) cielAnalyze(d).then((r) => {
      const swap = (r.swaps || []).map((s) => ({ ...s, o: card(s.out_id), i: card(s.in_id) })).filter((s) => s.o && s.i);
      out.replaceChildren(h("div", { class: "stack" }, h("div", { class: "row" }, r.score != null ? h("span", { class: "chip " + (r.score >= 70 ? "good" : r.score >= 45 ? "warn" : "bad") }, "คะแนน " + r.score + "/100") : null, h("span", null, r.summary || "")),
        h("div", null, h("b", null, "จุดแข็ง"), h("ul", null, (r.strengths || []).map((x) => h("li", null, x)))), h("div", null, h("b", null, "จุดอ่อน"), h("ul", null, (r.weaknesses || []).map((x) => h("li", null, x)))),
        r.matchups ? h("div", { class: "small" }, h("b", null, "แมตช์อัพ: "), r.matchups) : null,
        swap.length ? h("div", { class: "stack", style: "gap:6px" }, h("b", null, "ข้อเสนอเปลี่ยนการ์ด"), swap.map((s) => h("div", { class: "row small" }, h("span", { class: "chip bad" }, `−${s.n || 1} ${s.o.n}`), "→", h("span", { class: "chip good" }, `+${s.n || 1} ${s.i.n}`), h("span", { class: "muted" }, s.why || "")))) : null,
        (r.tips || []).length ? h("div", null, h("b", null, "เคล็ดลับการเล่น"), h("ul", null, r.tips.map((x) => h("li", null, x)))) : null));
    }).catch((e) => out.replaceChildren(h("div", { class: "muted" }, aiErr(e))));
    return out;
  }, { title: "ชิเอลวิเคราะห์: " + d.name, wide: true });
}
export function openShopping(d) {
  const list = shoppingList(d).filter((x) => x.miss > 0); const bySet = {};
  for (const x of list) { const k = setName(x.c) + " (" + setCode(x.c) + ")"; (bySet[k] = bySet[k] || []).push(x); }
  openSheet(() => list.length ? [h("div", { class: "muted small" }, `ขาด ${list.reduce((a, x) => a + x.miss, 0)} ใบ จาก ${list.length} รายการ · นับจากการ์ดที่บันทึกว่ามีในคลังการ์ด · ราคาตลาดจะเพิ่มทีหลัง`),
    ...Object.entries(bySet).map(([k, xs]) => h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, k), h("div", { class: "scroll-x" }, h("table", { class: "t" }, h("thead", null, h("tr", null, ...["การ์ด", "ความหายาก", "ต้องใช้", "มี", "ขาด", "อัตราออก"].map((t) => h("th", null, t)))),
      h("tbody", null, xs.map((x) => h("tr", null, h("td", null, h("a", { href: "#", onclick: (e) => { e.preventDefault(); showCard(x.c.i); } }, x.c.n)), h("td", { class: "num" }, x.c.r), h("td", { class: "num" }, x.need), h("td", { class: "num" }, x.have), h("td", { class: "num" }, h("b", { style: "color:var(--warn)" }, x.miss)), h("td", { class: "small" }, x.c.dr || "-"))))))))]
    : h("div", { class: "empty" }, "มีครบทุกใบแล้ว"), { title: "รายการต้องซื้อ: " + d.name, wide: true });
}
function openImport(d, done) {
  openSheet(() => {
    const out = h("div"); const inp = h("input", { type: "file", id: "imp-file", accept: "image/png,image/jpeg,image/webp", multiple: true });
    return [h("p", { class: "small", style: "margin:0" }, "แคปหน้าจอรายการเด็คจากเว็บทางการ แล้วให้ชิเอลอ่านชื่อ รหัส และจำนวน การ์ดที่อ่านได้จะเพิ่มเข้าเด็คที่กำลังแก้"), inp,
      h("button", { class: "btn ciel", onclick: async (e) => {
        const btn = e.currentTarget; if (!inp.files.length) return toast("เลือกรูปก่อน"); if (!Ciel.on()) { out.replaceChildren(h("div", { class: "muted" }, aiErr({ code: "no_key" }))); return; }
        btn.disabled = true; out.replaceChildren(busy("ชิเอลกำลังอ่านภาพ…"));
        try {
          const r = await cielReadImport(inp.files); const miss = [], amb = []; let added = 0;
          for (const it of (r && r.cards) || []) {
            const n = Math.max(1, it.n | 0); let c = it.print && CARDS.find((x) => x.p === it.print);
            if (!c) { const vers = (CARDS.byName.get(it.name) || []).filter(isBase); if (vers.length > 1) { amb.push({ name: it.name, n, vers }); continue; } c = vers[0]; }
            if (!c) { miss.push(it.name); continue; } for (let k = 0; k < n; k++) addToDeck(d, baseId(c.i), 1); added++;
          }
          out.replaceChildren(h("div", { class: "stack small" }, `เพิ่ม ${added} รายการ`, miss.length ? h("div", { class: "muted" }, "อ่านไม่ออก: " + miss.join(", ")) : null,
            ...amb.map((a) => { const box = h("div", { class: "stack", style: "gap:4px" }, h("b", null, `"${a.name}" มี ${a.vers.length} เวอร์ชันที่ความสามารถต่างกัน เลือกใบที่ใช่ (×${a.n})`), h("div", { class: "pick" }, a.vers.map((v) => cardBtn(v.i, { badge: v.p, onclick: () => { for (let k = 0; k < a.n; k++) addToDeck(d, v.i, 1); box.remove(); done(); } })))); return box; })));
          done();
        } catch (err) { out.replaceChildren(h("div", { class: "muted" }, aiErr(err))); }
        btn.disabled = false;
      } }, "อ่านภาพ"), out];
  }, { title: "นำเข้าเด็คจากภาพหน้าจอ" });
}
