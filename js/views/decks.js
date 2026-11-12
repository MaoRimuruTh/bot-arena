import { h, clone, toast, openSheet, confirmBox, busy, holo } from "../util.js?v=20261112123626";
import { plain, isOwnerNow } from "../persona.js?v=20261112123626";
import { fxText } from "../fxtext.js?v=20261112123626";
import { CARDS, card, baseId, isBase, TYPE_TH, SUB_TH, COLORS, colorOf, setName, setCode, artImg, limitOf, banlist, banMax, banPair, deckEntries, deckCount, validateDeck, deckStats, deckAce, shoppingList, ownedOf, cardLine, favCards, variantsOf, isSpecialArt, buyPrice } from "../cards.js?v=20261112123626";
import { Data, Me, saveDeck, deleteDeck, saveSkins } from "../fb.js?v=20261112123626";
import { Views, cardBtn, showCard } from "../ui.js?v=20261112123626";
import { Ciel, aiErr, cielBuild, cielAnalyze, cielReadImport, STYLE_TH } from "../ai.js?v=20261112123626";
import { filterBar, filterCards } from "./library.js?v=20261112123626";
import { openingOdds, simGame } from "./lab.js?v=20261112123626";
import { freeBuild } from "../builder.js?v=20261112123626";
import { deckCode, deckText, parseDeck, printCard } from "../deckcode.js?v=20261112123626";
import { CIEL_DECKS } from "../cieldecks.js?v=20261112123626";
import { officialStarters, boxDecks, topUpNote, themeCounts } from "../boxdecks.js?v=20261112123626";
import { deckLocked, deckLockAch } from "../achieve.js?v=20261112123626";

// Ciel's theme decks: print codes → card ids (resolved once the card data is loaded). They are Ciel's decks for Rimuru,
// so only the owner's account sees them: other accounts get none (not in the deck list, the duel setup, the lab or the bot's picks)
let cielCache = null;
export function cielDecks() {
  const own = isOwnerNow(); if (!own) return [];
  if (cielCache && cielCache.n === CARDS.length) return cielCache.list;
  const byPrint = (p) => { const c = CARDS.find((x) => x.p === p); return c ? baseId(c.i) : null; };
  const list = CIEL_DECKS.map((z) => { const main = {}; for (const [p, n] of z.main) { const id = byPrint(p); if (id != null) main[id] = (main[id] || 0) + n; }
    return { id: z.id, name: z.name, theme: plain(z.theme), plan: plain(z.plan), style: z.style, main, life: z.life.map(byPrint).filter((x) => x != null), ace: z.ace.map(byPrint).filter((x) => x != null), owner: "ciel", ownerName: "ชิเอล", starter: true, ciel: true, updatedAt: 0 }; });
  cielCache = { n: CARDS.length, list }; return list;
}

export let Editing = null;
const PickFilter = { q: "", t: "", co: "", c: "", set: "", rare: "", sy: "", variants: false, owned: false };
const blank = () => ({ id: null, name: "เด็คใหม่", main: {}, life: [], ace: [], plan: "", notes: "", style: "win" });
export const allDecks = () => [...Data.decks, ...cielDecks(), ...officialStarters(), ...boxDecks()];
export const deckById = (id) => (id === "__editing" ? Editing : allDecks().find((d) => d.id === id));
export function addToDeck(d, id, delta = 1) {
  const c = card(id); if (!c) return;
  // the official limits (การ์ดบาป): a banned card cannot go in, a limited one only up to its count (Main Deck and LIFE
  // together), and the two cards of a forbidden pair not together
  if (delta > 0) { const B = banlist(), mx = banMax(c, B);
    if (mx === 0) return toast(`${c.n} เป็นการ์ดบาป ห้ามใช้ (${B.name})`);
    const inDeck = deckEntries(d).filter((e) => e.c.n === c.n).reduce((a, e) => a + e.n, 0) + (d.life || []).filter((x) => (card(x) || {}).n === c.n).length;
    if (mx != null && inDeck >= mx) return toast(`${c.n} ใส่ได้ ${mx} ใบตาม${B.name}`);
    const pair = banPair(c, d, B); if (pair) return toast(`${c.n} ใส่คู่กับ ${pair} ไม่ได้ (${B.name})`); }
  if (c.t === "L") {
    if (delta > 0) { if ((d.life || []).length >= 5) return toast("LIFE ครบ 5 ใบแล้ว"); if (d.life.some((x) => card(x).n === c.n)) return toast("LIFE ชื่อซ้ำไม่ได้"); d.life = [...d.life, c.i]; }
    else d.life = d.life.filter((x) => +x !== +id); return;
  }
  if (c.t === "T") return toast("Token ใส่ในเด็คไม่ได้");
  const same = deckEntries(d).filter((e) => e.c.n === c.n).reduce((a, e) => a + e.n, 0);
  if (delta > 0 && same >= limitOf(c)) return toast(`${c.n} ใส่ได้สูงสุด ${limitOf(c)} ใบ`);
  const n = Math.max(0, (d.main[c.i] || 0) + delta); const main = { ...d.main }; if (n) main[c.i] = n; else delete main[c.i]; d.main = main;
}
const isMine = (d) => !!d && !!d.id && d.owner === Me.uid && !d.starter;
const redraw = () => setTimeout(() => Data.listeners.forEach((f) => { try { f(); } catch (e) { console.warn(e); } }), 0);

// ----- autosave + undo, shared by the deck page and the editor -----
const Save = { t: null, p: null, pending: null, state: "", el: null, undo: [] };
const SAVE_TH = { saving: "กำลังบันทึก…", saved: "✓ บันทึกแล้ว", error: "บันทึกไม่สำเร็จ จะลองใหม่เมื่อแก้ครั้งถัดไป", dirty: "กำลังบันทึก…" };
function saveLabel() { if (!Save.el) return; Save.el.textContent = SAVE_TH[Save.state] || "บันทึกอัตโนมัติ"; Save.el.className = "savest small " + (Save.state === "error" ? "bad" : Save.state === "saved" ? "good" : "muted"); }
function saveStatus() { Save.el = h("span", { class: "savest small muted", role: "status" }); saveLabel(); return Save.el; }
function flushSave(d) {
  clearTimeout(Save.t); Save.t = null; Save.pending = null;
  return (Save.p = (Save.p || Promise.resolve()).then(async () => {
    Save.state = "saving"; saveLabel();
    try { const fresh = !d.id; d.id = await saveDeck(d); if (fresh) { d.owner = Me.uid; if (d === Editing && /^#decks\/(new|edit)/.test(location.hash)) history.replaceState(null, "", "#decks/edit/" + d.id); } Save.state = "saved"; }
    catch (e) { console.warn(e); Save.state = "error"; }
    saveLabel();
  }));
}
function queueSave(d) { if (Save.t && Save.pending && Save.pending !== d) flushSave(Save.pending); Save.state = "dirty"; saveLabel(); clearTimeout(Save.t); Save.pending = d; Save.t = setTimeout(() => flushSave(d), 700); }
const sameDeck = (u, d) => u.d === d || (!!u.id && u.id === d.id);
function remember(d) { Save.undo.push({ d, id: d.id, main: { ...d.main }, life: [...(d.life || [])], ace: [...(d.ace || [])] }); if (Save.undo.length > 40) Save.undo.shift(); }
const canUndo = (d) => Save.undo.some((u) => sameDeck(u, d));
function undoLast(d) { for (let k = Save.undo.length - 1; k >= 0; k--) { const u = Save.undo[k]; if (!sameDeck(u, d)) continue; Save.undo.splice(k, 1); d.main = u.main; d.life = u.life; d.ace = u.ace; queueSave(d); return true; } return false; }
// one change to a deck's cards: how = +1 / -1, or "all" to take every copy out. Saved automatically.
function editCard(d, id, how) {
  const c = card(id); if (!c) return false; const before = JSON.stringify([d.main, d.life]); remember(d);
  if (how === "all") { if (c.t === "L") d.life = (d.life || []).filter((x) => +x !== +id); else { const main = { ...d.main }; delete main[c.i]; d.main = main; } }
  else addToDeck(d, id, how);
  if (c.t !== "L" && !(d.main[c.i] > 0)) d.ace = (d.ace || []).filter((x) => +x !== +c.i);
  if (JSON.stringify([d.main, d.life]) === before) { Save.undo.pop(); return false; }
  queueSave(d); return true;
}
async function removeDecks(list) {
  // a save that is still waiting must not bring a deleted deck back
  if (Save.t) { const w = Save.pending; clearTimeout(Save.t); Save.t = null; Save.pending = null; if (w && !list.some((x) => x === w || x.id === w.id)) flushSave(w); }
  if (Save.p) await Save.p;
  for (const d of list) { await deleteDeck(d.id); if (Editing && Editing.id === d.id) Editing = null; Save.undo = Save.undo.filter((u) => !sameDeck(u, d)); } }
const plainCopy = (d, extra) => { const n = { ...clone(d), id: null, owner: Me.uid, starter: false, ciel: false, name: d.name + " (สำเนา)", ...extra }; delete n.createdAt; delete n.box; delete n.guess; return n; };
async function copyDeck(d) { return saveDeck(plainCopy(d)); }

// rename / copy / delete one of my decks without opening the editor
export function openDeckMenu(d) {
  openSheet((api) => {
    const name = h("input", { type: "text", value: d.name, maxlength: "60", "aria-label": "ชื่อเด็ค", class: "grow" });
    const rename = async (e) => { const v = name.value.trim(); if (!v) return toast("ใส่ชื่อเด็คก่อน"); e.currentTarget.disabled = true; try { d.name = v; await saveDeck(d); toast("เปลี่ยนชื่อแล้ว"); api.close(); redraw(); } catch (err) { toast("บันทึกไม่สำเร็จ: " + err.message, "bad"); e.currentTarget.disabled = false; } };
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") renameBtn.click(); });
    const renameBtn = h("button", { class: "btn gold", onclick: rename }, "บันทึกชื่อ");
    const del = h("div", { class: "row" });
    const drawDel = (ask) => del.replaceChildren(...(ask
      ? [h("span", { class: "small grow" }, `ลบ "${d.name}" ถาวร กู้คืนไม่ได้`), h("button", { class: "btn danger", onclick: async (e) => { e.currentTarget.disabled = true; try { await removeDecks([d]); api.close(); toast("ลบเด็คแล้ว"); if (location.hash !== "#decks") location.hash = "#decks"; else redraw(); } catch (err) { toast("ลบไม่สำเร็จ: " + err.message, "bad"); e.currentTarget.disabled = false; } } }, "ยืนยันลบ"), h("button", { class: "btn", onclick: () => drawDel(false) }, "ยกเลิก")]
      : [h("button", { class: "btn danger", onclick: () => drawDel(true) }, "ลบเด็คนี้")]));
    drawDel(false);
    return [h("div", { class: "stack" },
      h("div", { class: "stack", style: "gap:6px" }, h("span", { class: "eyebrow" }, "ชื่อเด็ค"), h("div", { class: "row", style: "flex-wrap:nowrap" }, name, renameBtn)),
      h("div", { class: "row" }, h("a", { class: "btn", href: "#decks/edit/" + d.id, onclick: () => api.close() }, "แก้ไขการ์ดในเด็ค"),
        h("button", { class: "btn", onclick: async (e) => { e.currentTarget.disabled = true; try { const id = await copyDeck(d); api.close(); toast("ทำสำเนาแล้ว"); location.hash = "#decks/view/" + id; } catch (err) { toast("ทำสำเนาไม่สำเร็จ: " + err.message, "bad"); e.currentTarget.disabled = false; } } }, "ทำสำเนา")),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { api.close(); openShare(d); } }, "แชร์เด็ค (โค้ด/รายการ)")),
      h("div", { class: "tiny muted" }, `${deckCount(d)} ใบ + LIFE ${(d.life || []).length} ใบ`), del)];
  }, { title: "จัดการเด็ค", sub: d.name });
}
// choosing several of my decks to delete at once
const Manage = { on: false, sel: new Set() };

const deckColors = (d) => { const st = deckStats(d); return Object.entries(st.colors).filter(([k]) => COLORS.includes(k)).sort((a, b) => b[1] - a[1]).map(([k]) => k); };
function deckTile(d) {
  const ace = deckAce(d); const v = validateDeck(d); const ms = Data.matches.filter((m) => m.deckId === d.id && m.mode !== "goldfish"); const w = ms.filter((m) => m.result === "win").length;
  const cols = deckColors(d); const band = cols.length ? `linear-gradient(180deg,${cols.map(colorOf).join(",")}${cols.length === 1 ? "," + colorOf(cols[0]) : ""})` : "var(--c-none)";
  const mine = isMine(d); const picking = mine && Manage.on; const on = picking && Manage.sel.has(d.id); const lock = deckLocked(d) && deckLockAch(d);
  const body = (tag, attrs) => h(tag, attrs, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }), h("div", { class: "band", style: "background:" + band }),
    h("div", { class: "in" }, h("span", { class: "eyebrow" }, d.ciel ? "✦ ชิเอลแนะนำ" : d.box ? "คัดสรรเด็ค" : d.starter ? "ทางการ" : d.owner === Me.uid ? "เด็คของฉัน" : "ของ " + (d.ownerName || "เพื่อน")), h("h3", null, d.name),
      h("div", { class: "small muted" }, lock ? lock.short || lock.how : d.theme || (ace ? "เอซ: " + ace.n : "")),
      h("div", { class: "meta" }, lock ? h("span", { class: "chip lockchip" }, "ล็อคอยู่") : h("span", { class: "chip num" }, deckCount(d) + "/50"), lock ? null : v.ok ? h("span", { class: "chip good" }, "พร้อมเล่น") : h("span", { class: "chip warn" }, deckCount(d) === 50 && (d.life || []).length === 5 ? "ผิดกติกา" : "ยังไม่ครบ"), !lock && v.ok && v.items.some((x) => x.warn) ? h("span", { class: "chip", title: v.items.filter((x) => x.warn).map((x) => x.msg).join("\n") }, "แข่งจริงไม่ได้") : null, ms.length ? h("span", { class: "chip num" }, `ชนะ ${w}/${ms.length}`) : null)));
  if (lock) return h("div", { class: "tilewrap" }, body("a", { class: "tile locked", href: "#decks/view/" + d.id, "aria-label": `${d.name} ล็อคอยู่ ${lock.how}` }));
  if (picking) return h("div", { class: "tilewrap" }, body("button", { class: "tile" + (on ? " sel" : ""), type: "button", "aria-pressed": on ? "true" : "false", onclick: () => { on ? Manage.sel.delete(d.id) : Manage.sel.add(d.id); redraw(); } }), h("span", { class: "tilecheck" + (on ? " on" : ""), "aria-hidden": "true" }, on ? "✓" : ""));
  return h("div", { class: "tilewrap" }, body("a", { class: "tile", href: "#decks/view/" + d.id }), mine ? h("button", { class: "tilemenu", type: "button", "aria-label": "จัดการเด็ค " + d.name, title: "เปลี่ยนชื่อ ทำสำเนา หรือลบ", onclick: () => openDeckMenu(d) }, "⋯") : null);
}

Views.decks = {
  render(root, [mode, arg]) {
    if (mode === "view") return this.view(root, arg);
    if (mode === "edit" || mode === "new") {
      if (mode === "new") { if (!Editing || Editing.id) Editing = blank(); }
      // always start from the saved deck (it may have been changed on the deck page), unless this very copy still has a save waiting
      else if (!Editing || Editing.id !== arg || !(Save.t && Save.pending === Editing)) { const d = deckById(arg); if (!d) { location.hash = "#decks"; return; } if (deckLocked(d)) { location.hash = "#decks/view/" + d.id; return; } Editing = d.owner === Me.uid ? clone(d) : plainCopy(d); }
      return this.editor(root);
    }
    const mine = Data.decks.filter((d) => d.owner === Me.uid), friends = Data.decks.filter((d) => d.owner !== Me.uid);
    root.replaceChildren(...[h("div", { class: "pagehead" }, h("div", null, h("h1", null, "เด็ค"), h("div", { class: "muted small" }, "จัดเด็คก่อนซื้อจริง ลองเล่น แล้วดูว่าต้องซื้อการ์ดอะไรเพิ่ม")),
      h("div", { class: "row" }, h("button", { class: "btn ciel", onclick: () => openFavBuilder() }, "♥ จัดเด็คจากการ์ดที่ชอบ"), h("button", { class: "btn ciel", onclick: () => openAceBuilder([]) }, "ให้ชิเอลจัดรอบการ์ดเอซ"),
        h("button", { class: "btn", onclick: () => { let fresh = null; openTextImport(() => fresh || (fresh = blank()), (d) => { Editing = d; queueSave(d); const want = d.id ? "#decks/edit/" + d.id : "#decks/new"; if (location.hash !== want) location.hash = want; else redraw(); }); } }, "นำเข้าเด็ค"), h("a", { class: "btn gold", href: "#decks/new", onclick: () => { Editing = blank(); } }, "สร้างเด็คใหม่"))),
      !Data.ready.decks ? busy("กำลังโหลดเด็ค…") : mine.length ? h("div", { class: "stack" }, this.mineBar(mine), h("div", { class: "tiles" }, mine.map(deckTile))) : h("div", { class: "empty" }, "ยังไม่มีเด็คของคุณ เริ่มจากเลือกการ์ดเอซให้ชิเอลจัด หรือคัดลอก Starter Deck ด้านล่างไปแก้ต่อ"),
      friends.length ? h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "เด็คของเพื่อน"), h("div", { class: "tiles" }, friends.map(deckTile))) : null,
      cielDecks().length ? h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "✦ เด็คแนะนำจากชิเอล"), h("div", { class: "muted small" }, plain("เด็คธีมที่ชิเอลจัดให้ริมุรุ เปิดดูแผนการเล่น ลงสนามได้เลย หรือคัดลอกไปแก้ต่อ")), h("div", { class: "tiles" }, cielDecks().map(deckTile))) : null,
      h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "Starter Deck ทางการ"), h("div", { class: "muted small" }, "จัดตามจำนวนในกล่องจริงจากรายการการ์ดทางการ"), h("div", { class: "tiles" }, officialStarters().map(deckTile))),
      h("div", { class: "stack", style: "margin-top:28px" }, h("h2", null, "คัดสรรเด็ค กล่องพิเศษ"), h("div", { class: "muted small" }, "เด็คกล่องพิเศษทางการ กล่องที่เล่นแรงกว่า Starter Deck มากจะล็อคไว้ เปิดได้ด้วยการชนะตามเงื่อนไขเท่านั้น ไม่มีการซื้อปลดล็อค"), h("div", { class: "tiles" }, boxDecks().map(deckTile)))].filter(Boolean));
    if (mode === "ace" && arg) openAceBuilder([+arg]);
  },
  // heading of "my decks": normal = a button to start choosing; choosing = how many are chosen + delete
  mineBar(mine) {
    for (const id of [...Manage.sel]) if (!mine.some((d) => d.id === id)) Manage.sel.delete(id);
    if (!Manage.on) return h("div", { class: "row" }, h("h2", { class: "grow" }, `เด็คของฉัน (${mine.length})`), h("span", { class: "small muted" }, "กด ⋯ บนเด็คเพื่อเปลี่ยนชื่อ ทำสำเนา หรือลบ"), h("button", { class: "btn sm", onclick: () => { Manage.on = true; Manage.sel.clear(); redraw(); } }, "เลือกหลายเด็คเพื่อลบ"));
    const n = Manage.sel.size; const chosen = mine.filter((d) => Manage.sel.has(d.id));
    return h("div", { class: "row managebar" }, h("b", { class: "grow" }, n ? `เลือกแล้ว ${n} เด็ค` : "แตะเด็คที่ต้องการลบ"),
      h("button", { class: "btn sm", onclick: () => { if (n === mine.length) Manage.sel.clear(); else mine.forEach((d) => Manage.sel.add(d.id)); redraw(); } }, n === mine.length ? "ไม่เลือกเลย" : "เลือกทั้งหมด"),
      h("button", { class: "btn sm danger", disabled: !n, onclick: () => confirmBox(`ลบ ${n} เด็คถาวร กู้คืนไม่ได้: ${chosen.map((d) => d.name).join(", ")}`, `ลบ ${n} เด็ค`, async () => { try { await removeDecks(chosen); Manage.sel.clear(); Manage.on = false; toast(`ลบ ${n} เด็คแล้ว`); } catch (e) { toast("ลบไม่สำเร็จ: " + e.message, "bad"); } redraw(); }, true) }, n ? `ลบ ${n} เด็ค` : "ลบ"),
      h("button", { class: "btn sm", onclick: () => { Manage.on = false; Manage.sel.clear(); redraw(); } }, "เสร็จ"));
  },
  refresh(root, parts) { if (parts[0] === "edit" || parts[0] === "new") return this.drawSide && this.drawSide(); this.render(root, parts); },

  // ---------- deck lab page ----------
  // a box deck still locked: its ace and theme, and the win that opens it; the list stays hidden until then
  locked(root, d) {
    const ace = deckAce(d), a = deckLockAch(d);
    // decks that already meet the Symbol count: yours first, then the official ones (never another box)
    const fit = allDecks().filter((x) => !x.box && (x.owner === Me.uid || x.starter) && validateDeck(x).ok && (themeCounts(x)[a.theme] || 0) >= a.need).slice(0, 6);
    root.replaceChildren(h("section", { class: "hero locked" }, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }),
      h("div", { class: "in" }, h("div", { class: "row", style: "gap:6px" }, h("span", { class: "chip lockchip" }, "ล็อคอยู่"), h("span", { class: "chip" }, "คัดสรรเด็ค กล่องพิเศษ")),
        h("h1", null, d.name), h("div", { class: "muted small" }, d.theme),
        h("div", { class: "lockreq" }, h("span", { class: "eyebrow" }, "เปิดด้วยความสำเร็จ " + a.name), h("b", null, a.how), h("span", { class: "tiny muted" }, "นับการ์ดใน Main Deck ที่พิมพ์ Symbol นั้นไว้ ตอนจบเกม เกมซ้อมมือเดียวไม่นับ")),
        h("div", { class: "row" }, h("a", { class: "btn gold", href: "#play" }, "ไปดวลเลย"), h("a", { class: "btn", href: "#decks/new" }, "จัดเด็คธีมนี้เอง"), h("a", { class: "btn", href: "#history" }, "ดูความสำเร็จทั้งหมด")))),
      fit.length ? h("div", { class: "stack", style: "gap:10px;margin-bottom:18px" }, h("h2", null, "เด็คที่ใช้ปลดล็อคได้"), h("div", { class: "muted small" }, `มีการ์ด Symbol ${a.theme} ตั้งแต่ ${a.need} ใบ ชนะด้วยเด็คไหนก็ได้`),
        h("div", { class: "row" }, fit.map((x) => h("a", { class: "btn", href: "#play/deck/" + x.id }, `${x.name} · ${themeCounts(x)[a.theme]} ใบ`)))) : null,
      h("div", { class: "empty" }, "รายการการ์ดของกล่องนี้จะเปิดให้ดู ลงสนาม และคัดลอกไปแก้ได้ เมื่อปลดล็อคแล้ว"));
  },
  view(root, id) {
    const d = deckById(id); if (!d) { root.replaceChildren(busy("กำลังโหลดเด็ค…")); return; }
    if (deckLocked(d)) return this.locked(root, d);
    const st = deckStats(d), v = validateDeck(d), ace = deckAce(d), shop = shoppingList(d);
    const need = shop.reduce((a, x) => a + x.need, 0), have = shop.reduce((a, x) => a + Math.min(x.need, x.have), 0);
    const ms = Data.matches.filter((m) => m.deckId === d.id && m.mode !== "goldfish"); const w = ms.filter((m) => m.result === "win").length;
    const preview = h("div", { class: "stack", style: "gap:10px" });
    const showPrev = (c) => preview.replaceChildren(h("div", { class: "row", style: "align-items:flex-start;gap:14px;flex-wrap:nowrap" }, holo(h("div", { class: "ccard", style: "width:150px;flex:none;cursor:default" }, artImg(c))),
      h("div", { class: "stack", style: "gap:6px;min-width:0" }, h("b", { style: "font-family:var(--f-display)" }, c.n), h("div", { class: "small muted" }, cardLine(c, 0).split(" : ")[0].replace(c.n + " ", "")), fxText(c.x || "", "small bare", "max-height:190px;overflow:auto"))));
    if (ace) showPrev(ace);
    const groups = {}; for (const e of deckEntries(d).sort((a, b) => (a.c.t > b.c.t ? 1 : a.c.t < b.c.t ? -1 : (a.c.c ?? 99) - (b.c.c ?? 99)))) { const k = e.c.t === "M" ? "MAGIC" : TYPE_TH[e.c.t].toUpperCase(); (groups[k] = groups[k] || []).push(e); }
    const isAce = (i) => (d.ace || []).map(Number).includes(+i);
    const mine = isMine(d); const again = () => this.view(root, id);
    const change = (cid, how) => { if (editCard(d, cid, how)) again(); };
    const pill = (e) => { const o = ownedOf(e.id); const miss = Math.max(0, e.n - o); const tint = e.c.co ? `background:linear-gradient(90deg,color-mix(in srgb,${colorOf(e.c.co)} 30%,transparent),transparent 75%);border-color:color-mix(in srgb,${colorOf(e.c.co)} 45%,transparent)` : "";
      // my own deck: every row can be changed right here (saved automatically)
      if (mine) return h("div", { class: "pill ed" + (isAce(e.id) ? " ace" : ""), style: tint + ";cursor:default", onmouseenter: () => showPrev(e.c) },
        h("span", { class: "q" }, e.n + "×"), e.c.t === "L" ? h("span", { class: "chip", style: "font-size:.66rem" }, "LIFE") : e.c.t !== "M" ? h("span", { class: "cost", style: "background:" + colorOf(e.c.co) }, e.c.c ?? "-") : h("span", { class: "chip", style: "font-size:.66rem" }, SUB_TH[e.c.st]),
        h("button", { class: "nm linkish", onfocus: () => showPrev(e.c), onclick: () => showCard(e.id) }, e.c.n), isAce(e.id) ? h("span", { class: "chip gold" }, "เอซ") : null,
        h("span", { class: "st", style: miss ? "color:var(--warn)" : "color:#8ee3b2" }, miss ? "ขาด " + miss : "มีครบ"),
        e.c.t !== "L" ? h("button", { class: "mini", "aria-label": `ลด ${e.c.n} 1 ใบ`, title: "ลด 1 ใบ", onclick: () => change(e.id, -1) }, "−") : null,
        e.c.t !== "L" ? h("button", { class: "mini", "aria-label": `เพิ่ม ${e.c.n} 1 ใบ`, title: "เพิ่ม 1 ใบ", onclick: () => change(e.id, 1) }, "+") : null,
        h("button", { class: "mini del", "aria-label": `เอา ${e.c.n} ออกจากเด็คทั้งหมด`, title: "เอาออกทั้งหมด", onclick: () => change(e.id, "all") }, "✕"));
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
          h("h1", null, d.name), h("div", { class: "muted small" }, [ace ? "เอซ: " + ace.n : null, `${deckCount(d)} + LIFE ${(d.life || []).length}`, d.ciel ? "ชิเอลแนะนำ" : d.box ? "คัดสรรเด็ค กล่องพิเศษ" : d.starter ? "เด็คทางการ" : d.owner === Me.uid ? "เด็คของคุณ" : "ของ " + (d.ownerName || "เพื่อน"), ms.length ? `ชนะ ${w}/${ms.length} เกม` : null].filter(Boolean).join(" · ")),
          h("div", { class: "row" }, h("a", { class: "btn gold", href: "#play/deck/" + d.id }, "ลงสนามกับเด็คนี้"), h("button", { class: "btn ciel", onclick: () => openAnalysis(d) }, "ชิเอลวิเคราะห์"),
            h("a", { class: "btn", href: "#decks/edit/" + d.id }, mine ? "เพิ่ม / แก้ไขการ์ด" : "คัดลอกไปแก้"), h("button", { class: "btn", onclick: () => openShopping(d) }, "รายการต้องซื้อ"), h("button", { class: "btn", onclick: () => openSkins(d) }, "✦ เลือกสกินทั้งเด็ค"),
            mine ? h("button", { class: "btn", onclick: () => openDeckMenu(d) }, "⋯ เปลี่ยนชื่อ / สำเนา / ลบ") : null))),
      mine ? h("div", { class: "edstrip" }, h("span", { class: "small grow" }, "แก้เด็คได้จากหน้านี้เลย: ", h("b", null, "−"), " ลด 1 ใบ · ", h("b", null, "+"), " เพิ่ม 1 ใบ · ", h("b", null, "✕"), " เอาออกทั้งหมด"), saveStatus(),
        h("button", { class: "btn sm", disabled: !canUndo(d), onclick: () => { if (undoLast(d)) again(); } }, "↶ เลิกทำ"), h("a", { class: "btn sm gold", href: "#decks/edit/" + d.id }, "+ เพิ่มการ์ดใหม่")) : null,
      d.guess ? h("div", { class: "panel small muted", style: "margin-bottom:14px" }, topUpNote(d)) : null,
      h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ทั้งเด็ค"), h("b", null, need)), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "มีแล้ว"), h("b", { style: "color:#8ee3b2" }, have)),
        h("div", { class: "stat buy", style: "cursor:pointer", onclick: () => openShopping(d) }, h("span", { class: "eyebrow" }, "ต้องซื้อเพิ่ม"), h("b", null, need - have + " ใบ")),
        odds ? h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ได้เอซภายในเทิร์น 3"), h("b", { style: "color:var(--gold-hi)" }, Math.round(odds.t3 * 100) + "%")) : null),
      h("div", { class: "lab" },
        h("div", { class: "rows" }, ...Object.entries(groups).flatMap(([k, list]) => [h("div", { class: "eyebrow h" }, `${k} · ${list.reduce((a, e) => a + e.n, 0)}`), ...list.map(pill)]),
          h("div", { class: "eyebrow h" }, `LIFE (การ์ดบ้าน) · ${(d.life || []).length}`), ...(d.life || []).map((i) => pill({ c: card(i), n: 1, id: +i }))),
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
    const d = Editing; let limit = 90; d.life = d.life || []; d.main = d.main || {};
    const grid = h("div", { class: "grid-cards", style: "grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:12px" }); const more = h("div", { class: "row", style: "justify-content:center;margin-top:12px" });
    const wrap = h("div", { class: "editor", "data-tab": "pick" }); const bar = h("div", { class: "edbar", role: "group", "aria-label": "สลับมุมมอง" });
    const drawBar = () => { const tab = wrap.dataset.tab; const sw = (k, label) => h("button", { type: "button", "aria-pressed": tab === k ? "true" : "false", onclick: () => { wrap.dataset.tab = k; drawBar(); scrollTo(0, 0); } }, label);
      bar.replaceChildren(sw("pick", "เลือกการ์ดเพิ่ม"), sw("deck", `ในเด็ค ${deckCount(d)}/50 · LIFE ${d.life.length}/5`)); };
    const changed = () => { drawPick(); this.drawSide(); drawBar(); };
    const change = (cid, how) => { if (editCard(d, cid, how)) changed(); };
    const drawPick = () => {
      const list = filterCards(PickFilter);
      grid.replaceChildren(...list.slice(0, limit).map((c) => { const inDeck = c.t === "L" ? (d.life.map(Number).includes(c.i) ? 1 : 0) : d.main[c.i] || 0;
        return h("div", { class: "libi", onmouseenter: () => showHov(c) }, cardBtn(c.i, { cls: inDeck ? "indeck" : "", badge: inDeck ? "×" + inDeck : null, onclick: () => change(c.i, 1) }),
          h("div", { class: "row", style: "justify-content:space-between;gap:4px;flex-wrap:nowrap" }, h("div", { class: "nm grow" }, c.n),
            inDeck ? h("button", { class: "mini del", "aria-label": `เอา ${c.n} ออก 1 ใบ`, title: "เอาออก 1 ใบ", onclick: () => change(c.i, -1) }, "−") : null,
            h("button", { class: "mini", "aria-label": "รายละเอียด " + c.n, onclick: () => showCard(c.i) }, "i"))); }));
      more.replaceChildren(list.length > limit ? h("button", { class: "btn sm", onclick: () => { limit += 90; drawPick(); } }, "แสดงเพิ่ม") : "");
    };
    const side = h("div", { class: "stack" });
    // hover preview that stays on screen (sticky column): see a card without clicking it
    const hov = h("div", { class: "panel hovprev" }, h("div", { class: "muted small", style: "grid-column:1/-1" }, "ชี้เมาส์ที่การ์ดเพื่อดูรูปใหญ่และข้อความ"));
    const showHov = (c) => hov.replaceChildren(holo(h("div", { class: "ccard" }, artImg(c))), h("div", { class: "stack", style: "gap:5px;min-width:0" }, h("b", { style: "font-family:var(--f-display)" }, c.n), h("div", { class: "tiny muted" }, cardLine(c, 0).split(" : ")[0].replace(c.n + " ", "") + " · " + c.p), fxText(c.x || "ไม่มีข้อความความสามารถ", "small bare", "max-height:200px;overflow:auto")));
    const hasCards = () => deckCount(d) > 0 || d.life.length > 0;
    this.drawSide = () => {
      const v = validateDeck(d); const st = deckStats(d); const isAce = (id) => (d.ace || []).map(Number).includes(+id);
      const rows = deckEntries(d).sort((a, b) => (a.c.t > b.c.t ? 1 : a.c.t < b.c.t ? -1 : (a.c.c ?? 99) - (b.c.c ?? 99)));
      const act = document.activeElement; const caret = act && act.id === "deck-name" ? [act.selectionStart, act.selectionEnd] : null;
      side.replaceChildren(hov,
        h("div", { class: "panel stack" }, h("input", { type: "text", id: "deck-name", value: d.name, maxlength: "60", "aria-label": "ชื่อเด็ค", style: "font:700 1.15rem var(--f-display)", oninput: (e) => { d.name = e.target.value; }, onchange: () => { if (d.id || hasCards()) queueSave(d); } }),
          h("div", { class: "valid" }, v.items.map((x) => h("div", { class: !x.ok ? "no" : x.warn ? "warn" : "ok" }, (!x.ok ? "✗ " : x.warn ? "⚠ " : "✓ ") + x.msg))),
          h("div", { class: "row small" }, Object.entries(st.colors).map(([k, n]) => h("span", { class: "chip" }, h("span", { class: "dot", style: "background:" + colorOf(k === "ไร้สี" ? "" : k) }), `${k} ${n}`)), h("span", { class: "chip num" }, "GEM " + st.gem)),
          h("div", { class: "row" },
            h("button", { class: "btn gold", onclick: async (e) => { if (!d.id && !hasCards()) { location.hash = "#decks"; return; } e.currentTarget.disabled = true; await flushSave(d); if (!d.id || Save.state === "error") { e.currentTarget.disabled = false; return toast("บันทึกไม่สำเร็จ ลองอีกครั้ง", "bad"); } toast("บันทึกเด็คแล้ว"); location.hash = "#decks/view/" + d.id; } }, "เสร็จ"),
            saveStatus(),
            h("button", { class: "btn sm", disabled: !canUndo(d), onclick: () => { if (undoLast(d)) changed(); } }, "↶ เลิกทำ")),
          h("div", { class: "row" },
            h("button", { class: "btn sm ciel", onclick: () => openAnalysis(d) }, "ชิเอลวิเคราะห์"),
            hasCards() ? h("button", { class: "btn sm", onclick: () => openShare(d) }, "แชร์เด็ค") : null,
            h("button", { class: "btn sm", onclick: () => { remember(d); openTextImport(() => d, () => { queueSave(d); changed(); }); } }, "นำเข้าโค้ด/รายการ"),
            h("button", { class: "btn sm", onclick: () => { remember(d); openImport(d, () => { queueSave(d); changed(); }); } }, "นำเข้าจากภาพ"),
            hasCards() ? h("button", { class: "btn sm danger", onclick: () => confirmBox("เอาการ์ดทั้งหมดออกจากเด็คนี้? (ย้อนได้ด้วยปุ่ม เลิกทำ)", "ล้างการ์ดทั้งหมด", () => { remember(d); d.main = {}; d.life = []; d.ace = []; queueSave(d); changed(); }, true) }, "ล้างการ์ดทั้งหมด") : null,
            d.id ? h("button", { class: "btn sm danger", onclick: () => confirmBox(`ลบเด็ค "${d.name}" ถาวร กู้คืนไม่ได้`, "ลบเด็ค", async () => { try { await removeDecks([d]); location.hash = "#decks"; toast("ลบเด็คแล้ว"); } catch (e) { toast("ลบไม่สำเร็จ: " + e.message, "bad"); } }, true) }, "ลบเด็ค") : null)),
        h("div", { class: "panel stack", style: "gap:6px" }, h("div", { class: "row small muted" }, h("span", { class: "grow" }, `การ์ดในเด็ค ${deckCount(d)}/50`), h("span", null, "− ลด · + เพิ่ม · ✕ เอาออกทั้งหมด")),
          rows.length ? rows.map((e) => h("div", { class: "pill ed" + (isAce(e.id) ? " ace" : ""), style: "cursor:default", onmouseenter: () => showHov(e.c) },
            h("span", { class: "q" }, e.n), e.c.t !== "M" ? h("span", { class: "cost", style: "background:" + colorOf(e.c.co) }, e.c.c ?? "-") : h("span", { class: "chip", style: "font-size:.66rem" }, SUB_TH[e.c.st]),
            h("button", { class: "nm linkish", onclick: () => showCard(e.id), title: e.c.p }, e.c.n), h("span", { class: "tiny muted num st" }, e.c.p),
            e.c.t === "A" ? h("button", { class: "mini", title: "ตั้งเป็นเอซ", "aria-label": "ตั้ง " + e.c.n + " เป็นเอซ", "aria-pressed": isAce(e.id) ? "true" : "false", onclick: () => { remember(d); d.ace = isAce(e.id) ? d.ace.filter((x) => +x !== e.id) : [...(d.ace || []), e.id].slice(-2); queueSave(d); this.drawSide(); } }, isAce(e.id) ? "★" : "☆") : null,
            h("button", { class: "mini", "aria-label": `ลด ${e.c.n} 1 ใบ`, title: "ลด 1 ใบ", onclick: () => change(e.id, -1) }, "−"), h("button", { class: "mini", "aria-label": `เพิ่ม ${e.c.n} 1 ใบ`, title: "เพิ่ม 1 ใบ", onclick: () => change(e.id, 1) }, "+"),
            h("button", { class: "mini del", "aria-label": `เอา ${e.c.n} ออกจากเด็คทั้งหมด`, title: "เอาออกทั้งหมด", onclick: () => change(e.id, "all") }, "✕"))) : h("div", { class: "empty" }, "ยังไม่มีการ์ดในเด็ค แตะการ์ดในรายการเพื่อเพิ่ม"),
          h("div", { class: "eyebrow", style: "margin-top:8px" }, `LIFE (การ์ดบ้าน) ${d.life.length}/5 · แตะเพื่อเอาออก`), h("div", { class: "pick" }, d.life.map((id) => cardBtn(id, { badge: "✕ เอาออก", onclick: () => change(id, "all") })),
            d.life.length < 5 ? h("button", { class: "btn sm", onclick: () => { PickFilter.t = "L"; const s = document.getElementById("pk-t"); if (s) s.value = "L"; limit = 90; drawPick(); wrap.dataset.tab = "pick"; drawBar(); } }, "เลือก LIFE") : null)));
      if (caret) { const n = document.getElementById("deck-name"); if (n) { n.focus(); try { n.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field any more */ } } }
    };
    wrap.append(h("div", null, filterBar(PickFilter, () => { limit = 90; drawPick(); }, "pk-"), grid, more), side);
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", { class: "row" }, h("a", { class: "btn sm", href: d.id ? "#decks/view/" + d.id : "#decks" }, "← กลับ"), h("h1", null, d.id ? "แก้ไขเด็ค" : "เด็คใหม่")),
      h("div", { class: "muted small" }, "แตะการ์ดเพื่อเพิ่มลงเด็ค ทุกการแก้ไขบันทึกให้อัตโนมัติ")), wrap, bar);
    drawPick(); this.drawSide(); drawBar();
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
        const btn = e.currentTarget; if (!st.ace.length) { out.replaceChildren(h("div", { class: "muted" }, "เลือกการ์ดเอซก่อนอย่างน้อย 1 ใบ")); return; }
        if (!Ciel.on()) { btn.disabled = true; await showFreeBuild(out, { core: st.ace, colors: st.colors, style: st.style }, api); btn.disabled = false; return; }
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
      } }, "ให้ชิเอลจัดเด็ค"), !Ciel.on() ? h("span", { class: "small muted" }, "ใช้ตัวจัดเด็คฟรีของชิเอล (ไม่ต้องใช้ API key)") : null), out];
  }, { title: "จัดเด็ครอบการ์ดเอซ", sub: "ชิเอลคัดการ์ดหนุนเอซจากคลังทั้งหมด พร้อมแผนการเล่น", wide: true });
}
// ---------- free builder: favourites → deck ----------
async function showFreeBuild(out, opts, api) {
  out.replaceChildren(busy("ชิเอลกำลังจัดเด็คแล้วลองให้บอทเล่น…")); await new Promise((r) => setTimeout(r, 30));
  const r = freeBuild(opts); const deck = { ...blank(), ...r.deck };
  // quick test: 40 bot games against the official starter decks
  const st = officialStarters(); let w = 0, n = 0; for (let k = 0; k < 40; k++) { const g = simGame(deck, st[k % st.length], (Date.now() + k * 7919) | 0); n++; if (g.winner === 0) w++; if (k % 10 === 9) await new Promise((res) => setTimeout(res, 0)); }
  const pct = Math.round((w / n) * 100); const v = r.valid;
  const ents = deckEntries(deck).sort((a, b) => (a.c.t === "A" ? 0 : 1) - (b.c.t === "A" ? 0 : 1) || (a.c.c || 0) - (b.c.c || 0));
  out.replaceChildren(h("div", { class: "panel stack" },
    h("div", { class: "row" }, h("h3", null, deck.name), h("span", { class: "chip num" }, deckCount(deck) + "/50"), h("span", { class: "chip " + (pct >= 60 ? "good" : pct >= 40 ? "warn" : "bad") }, `ชนะเด็คเริ่มต้น ${pct}% (บอท ${n} เกม)`)),
    h("div", { class: "small", style: "white-space:pre-wrap;line-height:1.6" }, deck.plan),
    h("div", { class: "pick" }, ents.slice(0, 18).map((e) => cardBtn(e.id, { badge: "×" + e.n, onclick: () => showCard(e.id) }))),
    h("div", { class: "valid" }, v.items.filter((x) => !x.ok).map((x) => h("div", { class: "no" }, "✗ " + x.msg + " (แก้ต่อในตัวแก้ไขได้)"))),
    h("div", { class: "tiny muted" }, "ตัวจัดฟรีเลือกการ์ดหนุนจาก Symbol ชื่อ และสีที่เข้ากัน ลองปรับต่อในตัวแก้ไข แล้วไปห้องทดลองเพื่อจำลองเกมเพิ่ม"),
    h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => { e.currentTarget.disabled = true; try { const id = await saveDeck(deck); api.close(); toast("บันทึกเด็คแล้ว"); location.hash = "#decks/view/" + id; } catch (err) { toast("บันทึกไม่สำเร็จ: " + err.message, "bad"); e.currentTarget.disabled = false; } } }, "บันทึกเด็คนี้"),
      h("button", { class: "btn", onclick: () => { Editing = deck; api.close(); location.hash = "#decks/new"; } }, "เปิดในตัวแก้ไข"))));
}
export function openFavBuilder() {
  const favs = favCards(); const st = { off: new Set(), colors: [], style: "fun" };
  openSheet((api) => {
    if (!favs.length) return [h("div", { class: "stack" }, h("div", null, "ยังไม่มีการ์ดที่ชอบเลยค่ะ"), h("div", { class: "small muted" }, "ไปที่คลังการ์ด ติ๊ก \"✦ เฉพาะภาพพิเศษ\" แล้วกดการ์ดที่ชอบ กดปุ่ม ♡ เก็บไว้ จากนั้นกลับมาที่นี่ ชิเอลจะจัดเด็คจากการ์ดพวกนั้นให้"),
      h("a", { class: "btn gold", href: "#library", onclick: () => api.close() }, "ไปคลังการ์ด"))];
    const grid = h("div", { class: "pick" }); const colorRow = h("div", { class: "row small" }); const out = h("div");
    const drawGrid = () => grid.replaceChildren(...favs.map((c) => { const b = cardBtn(c.i, { cls: st.off.has(c.i) ? "dim" : "", badge: st.off.has(c.i) ? "ไม่ใช้" : c.r, onclick: () => { st.off.has(c.i) ? st.off.delete(c.i) : st.off.add(c.i); drawGrid(); } }); return b; }));
    const auto = (() => { const cnt = {}; favs.forEach((c) => { if (c.co) cnt[c.co] = (cnt[c.co] || 0) + 1; }); return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k); })(); st.colors = auto;
    const drawColors = () => colorRow.replaceChildren(h("span", { class: "muted" }, "สีของเด็ค (สูงสุด 2)"), ...COLORS.map((c) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: st.colors.includes(c), onchange: (e) => { st.colors = e.target.checked ? [...st.colors, c].slice(-2) : st.colors.filter((x) => x !== c); drawColors(); } }), h("span", { class: "dot", style: "background:" + colorOf(c) }), c)));
    drawGrid(); drawColors();
    const seg = h("div", { class: "seg", role: "group", "aria-label": "แนวเด็ค" }, [["fun", "มันส์สุด"], ["win", "ล่าชัย"], ["budget", "งบน้อย"]].map(([k, t]) => h("button", { "aria-pressed": st.style === k ? "true" : "false", onclick: (e) => { st.style = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); } }, t)));
    return [h("div", { class: "stack" }, h("div", { class: "eyebrow" }, `การ์ดที่ชอบ ${favs.length} ใบ · แตะเพื่อไม่ใช้ในเด็คนี้`), grid, colorRow, h("div", { class: "row" }, h("span", { class: "small muted" }, "แนวเด็ค"), seg),
      h("div", { class: "tiny muted" }, "ภาพพิเศษที่ชอบจะถูกตั้งเป็นสกินของการ์ดนั้นให้อัตโนมัติ"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => { const btn = e.currentTarget; const core = favs.filter((c) => !st.off.has(c.i));
        if (!core.length) { out.replaceChildren(h("div", { class: "muted" }, "เลือกการ์ดอย่างน้อย 1 ใบ")); return; }
        let changed = false; for (const c of core) if (c.b != null && Data.skins[String(c.b)] == null) { Data.skins[String(c.b)] = c.i; changed = true; } if (changed) saveSkins();
        btn.disabled = true; await showFreeBuild(out, { core: core.map((c) => c.i), colors: st.colors, style: st.style }, api); btn.disabled = false; } }, "ให้ชิเอลจัดเด็ค"))), out];
  }, { title: "♥ จัดเด็คจากการ์ดที่ชอบ", sub: plain("ชิเอลจัดเด็คจากการ์ดภาพสวยที่ริมุรุเลือกไว้ พร้อมลองให้บอทเล่นให้ดู"), wide: true });
}
// ---------- skins for every card in a deck ----------
export function openSkins(d) {
  openSheet((api) => {
    const rows = [...deckEntries(d), ...(d.life || []).map((i) => ({ c: card(i), id: +i, n: 1 }))].filter((e) => e.c && variantsOf(e.c).length > 1);
    if (!rows.length) return [h("div", { class: "muted" }, "การ์ดในเด็คนี้ยังไม่มีภาพพิเศษให้เลือก")];
    const body = h("div", { class: "stack", style: "gap:14px" });
    const draw = () => body.replaceChildren(...rows.map((e) => { const b = baseId(e.c.i); const cur = Data.skins[String(b)] != null ? +Data.skins[String(b)] : b;
      return h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "row small" }, h("b", null, e.c.n), h("span", { class: "muted" }, `${variantsOf(e.c).length} ภาพ`)),
        h("div", { class: "pick" }, variantsOf(e.c).map((v) => { const btn = h("button", { class: "ccard" + (cur === v.i ? " sel" : ""), "aria-label": `${v.n} ${v.r}`, "aria-pressed": cur === v.i ? "true" : "false", onclick: () => { if (v.i === b) delete Data.skins[String(b)]; else Data.skins[String(b)] = v.i; saveSkins(); draw(); } }, rawArt(v), h("span", { class: "badge" }, (isSpecialArt(v) ? "✦ " : "") + v.r)); return btn; }))); }));
    draw(); return [h("div", { class: "small muted" }, "แตะภาพที่อยากใช้ ภาพที่เลือกจะแสดงในหน้าเด็คและในสนาม"), body];
  }, { title: "เลือกสกินทั้งเด็ค", sub: d.name, wide: true });
}
// the art of exactly this print, ignoring the current skin choice
function rawArt(v) { const k = String(baseId(v.i)); const saved = Data.skins[k]; delete Data.skins[k]; const im = artImg(v); if (saved != null) Data.skins[k] = saved; return im; }

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
  let sum = 0, unknown = 0; for (const x of list) { const p = buyPrice(x.c); if (p) sum += p.p * x.miss; else unknown++; }
  openSheet(() => list.length ? [h("div", { class: "muted small" }, `ขาด ${list.reduce((a, x) => a + x.miss, 0)} ใบ จาก ${list.length} รายการ · นับจากการ์ดที่บันทึกว่ามีในคลังการ์ด`),
    h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ประมาณจากราคาที่จดไว้"), h("b", { class: "num", style: "color:var(--gold-hi)" }, "฿" + sum.toLocaleString())),
      h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ยังไม่มีราคา"), h("b", { class: "num" }, unknown + " รายการ"))),
    h("div", { class: "tiny muted" }, "กดชื่อการ์ดเพื่อเช็คราคาที่ TCG Thailand หรือ Shopee แล้วจดราคาไว้ ยอดรวมจะคำนวณให้เอง (ข้อมูลอ้างอิง ไม่มีการซื้อขายในเว็บนี้)"),
    ...Object.entries(bySet).map(([k, xs]) => h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, k), h("div", { class: "scroll-x" }, h("table", { class: "t" }, h("thead", null, h("tr", null, ...["การ์ด", "ความหายาก", "ต้องใช้", "มี", "ขาด", "อัตราออก", "ราคาที่จด"].map((t) => h("th", null, t)))),
      h("tbody", null, xs.map((x) => h("tr", null, h("td", null, h("a", { href: "#", onclick: (e) => { e.preventDefault(); showCard(x.c.i); } }, x.c.n)), h("td", { class: "num" }, x.c.r), h("td", { class: "num" }, x.need), h("td", { class: "num" }, x.have), h("td", { class: "num" }, h("b", { style: "color:var(--warn)" }, x.miss)), h("td", { class: "small" }, x.c.dr || "-"), h("td", { class: "num small" }, (() => { const p = buyPrice(x.c); return p ? `฿${p.p.toLocaleString()}${p.c.i !== x.c.i ? " (" + p.c.r + ")" : ""}` : "-"; })()))))))))]
    : h("div", { class: "empty" }, "มีครบทุกใบแล้ว"), { title: "รายการต้องซื้อ: " + d.name, wide: true });
}
// share a deck as a short code, or as a list that reads well in a chat
export function openShare(d) {
  const box = (label, value, rows) => {
    const f = h(rows ? "textarea" : "input", { readonly: true, rows, "aria-label": label, class: "sharebox", onfocus: (e) => e.target.select() }); f.value = value;
    const copy = h("button", { class: "btn sm gold", onclick: async () => { try { await navigator.clipboard.writeText(value); toast(`คัดลอก${label}แล้ว`); } catch { f.focus(); f.select(); toast("เลือกข้อความไว้ให้แล้ว กดคัดลอกได้เลย"); } } }, "คัดลอก");
    return h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "row" }, h("span", { class: "eyebrow grow" }, label), copy), f);
  };
  openSheet([h("div", { class: "small muted" }, "ส่งให้เพื่อน แล้วให้เขากด \"นำเข้าเด็ค\" ที่หน้าเด็ค วางโค้ดหรือรายการนี้ได้เลย รายการการ์ดยังใช้จดไปซื้อการ์ดจริงได้ด้วย"),
    box("โค้ดเด็ค", deckCode(d)), box("รายการการ์ด", deckText(d), 10)], { title: "แชร์เด็ค", sub: d.name });
}
// read a deck code or a pasted list (from a chat, another site or BoT Arena itself) into a deck
function openTextImport(target, done) {
  openSheet((api) => {
    const ta = h("textarea", { rows: 9, class: "sharebox", "aria-label": "โค้ดหรือรายการเด็ค", placeholder: "วางโค้ดเด็ค (BoT1|…) หรือรายการ เช่น\n3 พระอิศวร\n2x เทวดาแบงค์\nSD01-004\n2x BT01-038-SR (รายการจาก bottcg.com)" });
    const out = h("div", { class: "stack small" });
    const read = () => {
      const r = parseDeck(ta.value);
      // a link to a deck on another site: that site does not let other sites read its decks, so only its list can be pasted
      if (!r.items.length && !r.amb.length && /https?:\/\/\S+/.test(ta.value)) return out.replaceChildren(h("div", { class: "muted" }, "ลิงก์เด็คจากเว็บอื่นเปิดอ่านจากที่นี่ไม่ได้ เพราะเว็บนั้นไม่ให้เว็บอื่นดึงข้อมูลเด็ค ให้เปิดลิงก์นั้นเอง คัดลอกรายการการ์ด (เช่นที่ปุ่ม \"ดูรหัสเด็ค\" ของ bottcg.com ซึ่งเป็นบรรทัดแบบ 2x BT01-038-SR) แล้วนำมาวางที่นี่แทน"));
      if (!r.items.length && !r.amb.length) return out.replaceChildren(h("div", { class: "muted" }, ta.value.trim() ? "อ่านไม่ออกสักบรรทัด ลองตรวจชื่อการ์ดหรือรหัสอีกครั้ง" : "วางโค้ดหรือรายการก่อน"));
      const d = target(); const nm = ta.value.match(/^#\s*(.+)$/m); if (nm && !d.id && !deckCount(d)) d.name = nm[1].trim().slice(0, 60);
      for (const { c, n } of r.items) for (let k = 0; k < n; k++) addToDeck(d, baseId(c.i), 1);
      out.replaceChildren(h("div", null, `เพิ่ม ${r.items.reduce((a, x) => a + x.n, 0)} ใบ · ตอนนี้ ${deckCount(d)} ใบ + LIFE ${(d.life || []).length} ใบ`),
        r.miss.length ? h("div", { class: "muted" }, "อ่านไม่ออก: " + r.miss.join(" · ")) : null,
        ...r.amb.map((a) => { const b = h("div", { class: "stack", style: "gap:4px" }, h("b", null, `"${a.name}" มี ${a.vers.length} เวอร์ชันที่ความสามารถต่างกัน เลือกใบที่ใช่ (×${a.n})`), h("div", { class: "pick" }, a.vers.map((v) => cardBtn(v.i, { badge: v.p, onclick: () => { for (let k = 0; k < a.n; k++) addToDeck(d, v.i, 1); b.remove(); done(d); } })))); return b; }),
        h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { api.close(); done(d); } }, "เสร็จ")));
      done(d);
    };
    return [ta, h("div", { class: "row" }, h("button", { class: "btn gold", onclick: read }, "อ่าน")), out];
  }, { title: "นำเข้าเด็คจากโค้ดหรือรายการ" });
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
            const n = Math.max(1, it.n | 0); let c = it.print && printCard(it.print);
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
