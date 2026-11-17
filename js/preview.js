// Settings → the looks (อวตาร สนาม ผ้าปู หลังการ์ด วงอัญเชิญ, and the owner's own things): a small live picture of your side of the
// table, drawn by the game's own table (arena3d.js: the same mats, sleeves, figures, scenes and summon circles), so each
// look can be seen, and where it sits, before a game. Pointing at a choice (or reaching it with the keyboard) shows it for
// a moment; choosing it keeps it. Without WebGL, on "แบบเรียบ 2D" or "ประหยัดเครื่อง", or while a game table is open, a flat
// map of the same table marks the spot instead. Nothing here is saved or sent anywhere: it only draws.
import { h, toast } from "./util.js?v=20261117094134";
import { Arena, TablePreview, tableMap, MATS, gfxSetting } from "./arena3d.js?v=20261117094134";
import { myFigure, myMat, myScene, mySleeve, mySigil, myWinFx } from "./achieve.js?v=20261117094134";
import { Vault, onVault } from "./vault.js?v=20261117094134";
import { CARDS, isBase } from "./cards.js?v=20261117094134";
import { E } from "./engine.js?v=20261117094134";
import { Me } from "./fb.js?v=20261117094134";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const tallNow = () => innerWidth / innerHeight < 0.9; // the table an upright phone gets (arena3d.js ZONES.tall)
// which part of the table each setting is about
// the bot's mat across the table (as js/views/play.js botMat): beside a night-glass or graphite look, the other modern cloth; else a lacquer colour
const botMatOf = (m) => { const cl = document.documentElement.classList; if (m === "glass" || m === "dusk") return "pro"; if (m === "pro") return "glass";
  if (m === "black" && cl.contains("ui-glass")) return "pro"; if (m === "black" && cl.contains("ui-pro")) return "glass"; return m === "red" ? "black" : "red"; };
const KEY_VIEW = { "bot.av3": "av3", "bot.mat": "mat", "bot.sleeve": "sleeve", "bot.sleeveFin": "sleeve", "bot.scene": "scene", "bot.sig": "sig", "bot.winfx": "win", "bot.ui": "table" };
const VIEWS = [["table", "ทั้งฝั่ง"], ["mat", "ผ้าปู"], ["sleeve", "หลังการ์ด"], ["av3", "อวตาร"], ["scene", "รอบโต๊ะ"]];
const CAP = {
  table: (o) => (o.flat ? "ฝั่งของคุณบนโต๊ะ (แผนผังจากด้านบน)" : "ฝั่งของคุณบนโต๊ะ · ลากซ้ายขวาเพื่อหมุนดู"),
  mat: (o) => (o.own ? "ผ้าปูของฉันปูเต็มฝั่งของคุณ ใต้เส้นโซนทอง" : "ผ้าปูปูเต็มฝั่งของคุณ คู่แข่งก็เห็น"),
  sleeve: () => (tallNow() ? "หลังการ์ดอยู่ที่ Deck ปลายแถบกลางด้านขวา และการ์ดทุกใบที่คว่ำอยู่" : "หลังการ์ดอยู่ที่ Deck ทางขวา และ LIFE ที่คว่ำอยู่ทางซ้าย"),
  av3: (o) => (o.none ? "ไม่มีอวตาร: ตรงนี้จะว่าง" : "อวตารยืนตรงนี้ ระหว่างแถบกลางกับโซนอวตารฝั่งของคุณ"),
  stand: () => "ภาพตั้งโต๊ะยืนตรงนี้ ข้างโต๊ะฝั่งของคุณ",
  fig: () => "รูปปั้นยืนตรงนี้ ข้างโต๊ะฝั่งของคุณ",
  scene: () => "สนามคือฉากรอบโต๊ะ เห็นเฉพาะบนเครื่องคุณ",
  sig: () => "วงอัญเชิญเปิดใต้การ์ดตอนอัญเชิญ",
  win: () => "ฉากนี้เล่นบนเครื่องคุณตอนชนะ",
};
// an owner's own thing with no picture yet: the preview shows a neutral board where it will go
const CAP_EMPTY = {
  mat: () => "ยังไม่มีภาพ · ผ้าปูของคุณจะปูเต็มฝั่งนี้ ใต้เส้นโซนทอง",
  sleeve: () => "ยังไม่มีภาพ · หลังการ์ดของคุณจะอยู่ที่ Deck และการ์ดที่คว่ำอยู่",
  stand: () => "ยังไม่มีภาพ · ภาพตั้งโต๊ะของคุณจะยืนตรงนี้ ข้างโต๊ะฝั่งของคุณ",
  fig: () => "ยังไม่มีไฟล์ · รูปปั้นของคุณจะยืนตรงนี้ ข้างโต๊ะฝั่งของคุณ",
};
// the choices as they would be with one setting changed (a choice pointed at): the same rules as a game uses (achieve.js),
// worked out with that one value in place for a moment and then put back
function withPick(over, fn) {
  const keep = []; try { for (const [k, v] of Object.entries(over)) { keep.push([k, localStorage.getItem(k)]); if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } } catch { /* no storage: the saved choices */ }
  try { return fn(); } finally { try { for (const [k, v] of keep.reverse()) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } } catch { /* as above */ } }
}
const looks = (over) => withPick(over, () => { let fin = 1; try { fin = localStorage.getItem("bot.sleeveFin") === "matte" ? 0 : 1; } catch { /* default */ }
  return { av3: myFigure(), mat: myMat(), scene: myScene(), sleeve: mySleeve(), sig: mySigil(), win: myWinFx(), fin }; });

// a few real cards for the table (their pictures load from the official site like every card in the game): the first
// Avatar of each colour, three for our side, two for theirs
let picks = null;
function pickCards() {
  if (picks && picks.n === CARDS.length) return picks;
  const seen = new Set(), av = [];
  for (const c of CARDS) { if (!c || c.t !== "A" || !isBase(c) || !c.co || seen.has(c.co)) continue; seen.add(c.co); av.push(c.i); if (av.length >= 5) break; }
  return (picks = { n: CARDS.length, me: av.slice(0, 3), op: av.slice(3, 5), fill: av[0] });
}
// the table: our Avatars, LIFE (face down), Deck and a hell pile; on theirs a little less
function tableState(L, vault) {
  const pc = pickCards(), s = { P: [], cards: {}, land: null, land2: null, ev: [], evc: 0, phase: "main", turn: 3, active: 0, first: 0, log: [], trig: [], nextI: 1000 };
  const def = (id) => { const k = String(id); if (!s.cards[k]) s.cards[k] = id != null && CARDS[id] ? E.cardDef(id) : { n: "", t: "A", co: "แดง", pw: 0, x: "", im: null }; return k; };
  const inst = (i, id, o, extra) => ({ i, c: def(id), o, a: true, ...extra });
  const side = (p, ids, nLife, nDeck, nHell) => ({ uid: p ? null : Me.uid, name: p ? "คู่แข่ง" : "คุณ", bot: !!p, av: ids.map((id, k) => inst(p * 100 + 1 + k, id, p)), cs: [], mg: [], hand: [],
    life: Array.from({ length: nLife }, (_, k) => inst(p * 100 + 10 + k, pc.fill, p)), deck: Array.from({ length: nDeck }, (_, k) => inst(p * 100 + 20 + k, pc.fill, p)),
    hell: Array.from({ length: nHell }, (_, k) => inst(p * 100 + 70 + k, ids[k] != null ? ids[k] : pc.fill, p)), dark: [] });
  const me = side(0, pc.me, 4, 34, 2), op = side(1, pc.op, 4, 30, 1);
  Object.assign(me, { mat: L.mat, sleeve: L.sleeve, av3: L.av3, sig: L.sig });
  Object.assign(op, { mat: botMatOf(L.mat), sleeve: "", av3: "", sig: "lotus" }); // (the bot's mat in a practice game)
  // an owner's own thing looked at in Settings: his picture if he has one, or a neutral board where it will go
  if (vault) { const k = vault.kind, has = vault.has;
    if (k === "mat") me.mat = has ? "own" : "ph"; else if (k === "sleeve") me.sleeve = has ? "own" : "ph";
    else if (k === "stand") { me.av3 = has ? "stand" : "ph"; me.ph = "stand"; } else if (k === "fig") { me.av3 = has ? "own" : "ph"; me.ph = "fig"; } }
  s.P = [me, op]; return s;
}

let cur = null; // the preview on screen (one at a time)
export function tablePreview() {
  if (cur) cur.close();
  const stage = h("div", { class: "pvstage" }), pin = h("div", { class: "pvpin", hidden: true, "aria-hidden": "true" });
  const cap = h("div", { class: "pvcap", "aria-live": "polite" }), flat = h("div", { class: "pvflat", hidden: true });
  const fullBtn = h("button", { class: "btn sm pvfull", title: "ดูบนโต๊ะเต็มจอ", "aria-label": "ดูบนโต๊ะเต็มจอ", onclick: () => (st.over ? unfull() : full()) }, "⛶ เต็มจอ");
  stage.append(flat, pin, fullBtn); const pane = h("div", { class: "pvpane" }, stage, cap); // (the picture and its caption stay in view together)
  const st = { pick: { view: "table" }, temp: null, mode: "", timer: 0 };
  const viewBtns = VIEWS.map(([k, t]) => h("button", { "aria-pressed": k === "table" ? "true" : "false", onclick: () => { st.pick = { view: k }; st.temp = null; paint(true); } }, t));
  const summonBtn = h("button", { class: "btn sm", onclick: () => doSummon(true) }, "▶ อัญเชิญ");
  const winBtn = h("button", { class: "btn sm", onclick: () => doWin(true) }, "▶ ฉากชนะ");
  const more = h("button", { class: "btn sm gold", hidden: true, onclick: () => { st.force3d = true; start(); } }, "ดูแบบ 3 มิติ");
  const note = h("div", { class: "tiny muted pvnote" });
  const box = h("div", { class: "pvbox" }, pane, h("div", { class: "row wrap pvbar" }, h("div", { class: "seg wrap pvviews", role: "group", "aria-label": "มุมที่ดู" }, viewBtns), summonBtn, winBtn, more), note);

  const view = () => (st.temp && st.temp.view) || st.pick.view;
  const vaultNow = () => (st.temp ? st.temp.vault : st.pick.vault) || null;
  const over = () => (st.temp && st.temp.key ? { [st.temp.key]: st.temp.val } : {});
  function caption(L, vault) {
    if (vault && !vault.has) return CAP_EMPTY[vault.kind]();
    const v = view(), f = vault ? vault.kind : v === "av3" && L.av3 === "stand" ? "stand" : v === "av3" && L.av3 === "own" ? "fig" : v;
    return (CAP[f] || CAP.table)({ own: L.mat === "own" || !!vault, none: v === "av3" && !L.av3, flat: st.mode !== "3d" });
  }
  function paint(now) { clearTimeout(st.timer); if (now) draw(); else st.timer = setTimeout(draw, 90); } // (pointing along a row of choices draws once it rests)
  function draw() {
    if (!box.isConnected && st.mode) return close();
    const L = looks(over()), vault = vaultNow(), v = vault ? vault.kind : view();
    for (const [b, [k]] of viewBtns.map((b, i) => [b, VIEWS[i]])) b.setAttribute("aria-pressed", k === (vault ? "" : st.pick.view) ? "true" : "false");
    cap.textContent = caption(L, vault);
    if (st.mode === "3d") {
      if (!TablePreview.live(stage)) { setMode("2d", "ตัวอย่าง 3 มิติปิดไปเพราะเปิดสนามอยู่ ของที่เลือกใช้ตั้งแต่เกมถัดไป"); return draw(); }
      TablePreview.scene(L.scene); TablePreview.fin(L.fin); TablePreview.show(tableState(L, vault)); TablePreview.view(v);
    } else if (st.mode) flatMap(L, vault, v);
  }
  // ---- the flat map: the player's half of the same table (arena3d.js tableMap), with the spot marked ----
  function flatMap(L, vault, v) {
    const tall = tallNow(), M = tableMap(tall, innerWidth < 760), [cw, ch] = M.card, xr = tall ? 5.6 : M.MW / 2 + 0.2, z0 = M.MZ - 2.6, z1 = M.MZ + M.MD / 2 + 0.3;
    const lac = (k, fb) => (k === "own" || k === "ph" ? "#3a3940" : (MATS[k] || {}).lac || fb), NS = "http://www.w3.org/2000/svg";
    const r = (x, z, w, d, a = "") => `<rect x="${(x - w / 2).toFixed(2)}" y="${(z - d / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${d.toFixed(2)}" rx="0.08" ${a}/>`;
    const tx = (x, z, t, a = "") => `<text x="${x.toFixed(2)}" y="${z.toFixed(2)}" ${a}>${t}</text>`;
    const mat = vault && vault.kind === "mat" ? (vault.has ? "own" : "ph") : L.mat, sleeve = vault && vault.kind === "sleeve" ? "own" : L.sleeve;
    const back = sleeve === "own" ? 'fill="#4a4954" stroke="#f0e8d6" stroke-dasharray=".12 .08"' : 'fill="#6a1a14" stroke="#d8a84a"';
    const zone = 'fill="none" stroke="#d8a84a" stroke-opacity=".75" stroke-width=".05"', fig = vault && (vault.kind === "stand" || vault.kind === "fig") ? vault.kind : L.av3 ? "av3" : "";
    let s = `<rect x="${-M.MW / 2}" y="${M.MZ - M.MD / 2}" width="${M.MW}" height="${M.MD / 2}" fill="${lac(botMatOf(L.mat))}" opacity=".45"/>`;
    s += `<rect x="${-M.MW / 2}" y="${M.MZ}" width="${M.MW}" height="${M.MD / 2}" fill="${lac(mat, "#120b09")}" stroke="#d8a84a" stroke-width=".06"/>`;
    if (mat === "own" || mat === "ph") s += r(0, M.MZ + M.MD / 4, M.PM.x * 2, M.MD / 2 - M.PM.z0 - M.PM.z1, 'fill="none" stroke="#f0e8d6" stroke-width=".05" stroke-dasharray=".2 .12"') + tx(0, M.MZ + M.MD / 2 - 0.75, mat === "ph" ? "ภาพผ้าปูของคุณ" : "ผ้าปูของฉัน", 'class="lb"');
    s += `<line x1="${-M.MW / 2}" x2="${M.MW / 2}" y1="${M.MZ}" y2="${M.MZ}" stroke="#d8a84a" stroke-width=".05" stroke-dasharray=".25 .15"/>`;
    for (let k = -1; k <= 1; k++) s += r(k * M.av.gap, M.av.z, cw, ch, 'fill="#2a1d18" stroke="#d8a84a" stroke-width=".05"');
    s += tx(0, M.av.z + ch / 2 + 0.45, "โซนอวตาร", 'class="lb"');
    s += r(M.cs[0], M.cs[1], cw * M.cs[2], ch * M.cs[2], zone) + r(M.mg[0], M.mg[1], cw * M.mg[2], ch * M.mg[2], zone);
    if (M.life) for (let k = 0; k < 4; k++) s += r(M.life.x, M.life.z0 + k * M.life.dz, ch * M.life.s, cw * M.life.s, back + ' stroke-width=".04"');
    if (M.life) s += tx(M.life.x, M.life.z0 + 4 * M.life.dz + 0.3, "LIFE", 'class="lb"');
    const [dx, dz] = M.piles.deck; s += r(dx, dz, cw * M.piles.s, ch * M.piles.s, back + ' stroke-width=".05"') + tx(dx, dz + ch * M.piles.s / 2 + 0.4, "Deck", 'class="lb"');
    const [fx, fz] = M.fig; if (fig) s += `<ellipse cx="${fx}" cy="${fz}" rx=".42" ry=".3" fill="${vault && !vault.has ? "#3a3940" : "#c9a25a"}" stroke="#f0e8d6" stroke-width=".05"/>` + tx(fx + 0.55, fz + 0.15, fig === "stand" ? "ภาพตั้งโต๊ะ" : fig === "fig" ? "รูปปั้น" : "อวตาร", 'class="lb" style="text-anchor:start"');
    const spot = v === "stand" || v === "fig" || v === "av3" ? [fx, fz, 0.85] : v === "sleeve" ? [dx, dz, 0.95] : v === "mat" ? null : v === "sig" ? [0, M.av.z, 1.25] : null;
    if (spot) s += `<circle class="pvmark" cx="${spot[0]}" cy="${spot[1]}" r="${spot[2]}" fill="none" stroke="#ffe7a8" stroke-width=".09"/>`;
    flat.innerHTML = `<svg xmlns="${NS}" viewBox="${-xr} ${z0} ${2 * xr} ${z1 - z0}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${s}</svg>`;
    pin.hidden = true;
  }
  function setMode(m, why) {
    st.mode = m; flat.hidden = m === "3d"; note.textContent = why || "";
    more.hidden = !(m === "2d" && st.lowOnly); summonBtn.disabled = winBtn.disabled = m !== "3d";
  }
  // 3D starts once the box is on screen (a folded settings group draws nothing), and stops when it leaves the page
  function start() {
    const g = gfxSetting(), gl = !!(window.THREE && window.WebGLRenderingContext), game = Arena.on || document.body.classList.contains("arena-on");
    st.lowOnly = false;
    if (!gl || g === "flat") return setMode("2d", !gl ? "เครื่องนี้แสดงโต๊ะ 3 มิติไม่ได้ จึงเป็นแผนผังแทน วงทองคือตำแหน่งของที่เลือก" : "ตั้งภาพเป็นแบบเรียบ 2D อยู่ จึงเป็นแผนผังแทน วงทองคือตำแหน่งของที่เลือก");
    if (game) return setMode("2d", "เปิดสนามอยู่ ตัวอย่างจึงเป็นแผนผัง ของที่เลือกใช้ตั้งแต่เกมถัดไป");
    if (g === "low" && !st.force3d) { st.lowOnly = true; return setMode("2d", "โหมดประหยัดเครื่อง: ตัวอย่างเป็นแผนผังก่อน กด \"ดูแบบ 3 มิติ\" ถ้าอยากดูโต๊ะจริง"); }
    if (TablePreview.live(stage)) return setMode("3d", "ลากซ้ายขวาเพื่อหมุน · ชี้ที่ตัวเลือกเพื่อดูก่อน กดเพื่อเลือก (ใช้ตั้งแต่เกมถัดไป)");
    const L = looks({});
    try { if (!TablePreview.mount(stage, { mat: L.mat, scene: L.scene, winfx: L.win })) throw new Error("no table"); }
    catch (e) { console.warn("preview 3D off", e); TablePreview.unmount(); return setMode("2d", "เปิดโต๊ะ 3 มิติไม่ได้ จึงเป็นแผนผังแทน วงทองคือตำแหน่งของที่เลือก"); }
    TablePreview.pin(pin); TablePreview.visible(true);
    setMode("3d", (matchMedia("(pointer: coarse)").matches ? "ลากซ้ายขวาเพื่อหมุน · แตะตัวเลือกเพื่อดูและเลือก" : "ลากซ้ายขวาเพื่อหมุน · ชี้ที่ตัวเลือกเพื่อดูก่อน กดเพื่อเลือก") + " (ใช้ตั้งแต่เกมถัดไป)");
    draw();
  }
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => { const on = es.some((e) => e.isIntersecting); if (on && !st.mode) { start(); if (st.mode !== "3d") draw(); } TablePreview.live(stage) && TablePreview.visible(on); }) : null;
  if (io) io.observe(stage); else setTimeout(() => { start(); draw(); });
  const offVault = onVault(() => paint()); // a picture saved, changed or removed in the owner's rows below
  const gone = setInterval(() => { if (!box.isConnected && !st.over) close(); }, 1500); // the settings sheet closed some other way
  const onResize = () => { if (st.mode && st.mode !== "3d") paint(); }; addEventListener("resize", onResize);

  function doSummon(btn) { if (st.mode !== "3d") return; if (!TablePreview.summon() && btn) toast("รอการ์ดวางลงก่อน แล้วกดอีกครั้ง"); }
  function doWin(btn) { if (st.mode !== "3d") return; const L = looks(over()); if (!TablePreview.win(L.win) && btn) toast("เครื่องนี้ตั้งให้ลดภาพเคลื่อนไหวไว้ ฉากชนะจึงไม่เล่น"); }
  // a larger look: the same box moved over the whole screen (its table goes with it), and back
  function full() {
    const ov = h("div", { class: "pvover", role: "dialog", "aria-modal": "true", "aria-label": "ตัวอย่างโต๊ะเต็มจอ" }, h("button", { class: "btn sm pvclose", onclick: unfull }, "✕ ปิด"));
    st.over = ov; st.key = (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); unfull(); } }; addEventListener("keydown", st.key, true);
    document.body.append(ov); ov.prepend(pane); fullBtn.hidden = true; setTimeout(() => ov.querySelector(".pvclose").focus({ preventScroll: true })); paint(true);
  }
  function unfull() { if (!st.over) return; removeEventListener("keydown", st.key, true); box.prepend(pane); st.over.remove(); st.over = null; fullBtn.hidden = false; fullBtn.focus({ preventScroll: true }); paint(true); }
  function close() { if (cur !== api) return; cur = null; clearTimeout(st.timer); clearInterval(gone); removeEventListener("resize", onResize); if (io) io.disconnect(); offVault(); if (st.over) { removeEventListener("keydown", st.key, true); st.over.remove(); st.over = null; } if (TablePreview.live(stage)) TablePreview.unmount(); }

  const api = {
    el: box, close,
    // pointing at (or focusing) a choice: show it for now
    hover(key, val, vault) { st.temp = { key, val, view: KEY_VIEW[key] || st.pick.view, vault: vault || null }; paint(); },
    unhover() { if (!st.temp) return; st.temp = null; paint(); },
    // a choice was made (it is already saved): show it, and play what it does
    pick(key) { st.temp = null; st.pick = { view: KEY_VIEW[key] || "table" }; paint(true); if (key === "bot.sig") setTimeout(() => doSummon(), 350); if (key === "bot.winfx") setTimeout(() => doWin(), 600); },
    // the owner's own thing (vault.js): where it goes, with his picture or a neutral board
    focus(kind, has, keep) { const t = kind ? { view: kind === "stand" || kind === "fig" ? "av3" : kind, vault: { kind, has: !!has } } : null; if (keep) { st.pick = t || { view: "table" }; st.temp = null; } else st.temp = t; paint(); },
    show() { const r = stage.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) pane.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }); },
  };
  cur = api; return api;
}
// for the rows of choices (main.js) and the owner's rows (vaultui.js): they work on whichever preview is on screen
export const pvHover = (key, val, vault) => cur && cur.hover(key, val, vault);
export const pvUnhover = () => cur && cur.unhover();
export const pvPick = (key) => cur && cur.pick(key);
export const pvFocus = (kind, has, keep, scroll) => { if (!cur) return; cur.focus(kind, has, keep); if (scroll) cur.show(); };
export const pvClose = () => cur && cur.close();
