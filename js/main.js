import { $, h, toast, openSheet, lsGet, lsSet, lsDel, busy, fmtDate } from "./util.js?v=20261114112449";
import { applyPersona, isOwnerNow } from "./persona.js?v=20261114112449";
import { AVATARS, MATS, SIGILS, SCENES, WINFX, gfxSetting, animSetting, buzzOn, foilSetting } from "./arena3d.js?v=20261114112449";
import { myFigure, myMat, myScene, sceneOpen, sigilOpen, mySleeve, mySigil, myWinFx, unlocked, needFor } from "./achieve.js?v=20261114112449";
import { Vault, startVault } from "./vault.js?v=20261114112449";
import { vaultSection } from "./vaultui.js?v=20261114112449";
import { notifySupported, notifyOn, notifyBlocked, setNotify } from "./notify.js?v=20261114112449";
import { signIn, signOut, onUser, ensureProfile, watchMe, Me, Data, startData, setUserStatus, setMeta, myName, myAvatar, saveProfile } from "./fb.js?v=20261114112449";
import { loadCards, CARDS, isBase, SkinCtx, setGameSkins } from "./cards.js?v=20261114112449";
import { Sfx } from "./sfx.js?v=20261114112449";
import { Music, MUSIC_STYLES } from "./music.js?v=20261114112449";
import { Views, avatarEl } from "./ui.js?v=20261114112449";
import { Ciel } from "./ai.js?v=20261114112449";
import "./views/library.js?v=20261114112449";
import "./views/decks.js?v=20261114112449";
import "./views/lab.js?v=20261114112449";
import "./views/unlocks.js?v=20261114112449";
import "./views/history.js?v=20261114112449";
import { openReport } from "./views/ask.js?v=20261114112449";
import "./views/play.js?v=20261114112449";

const root = $("#view");
// text size for the whole app (everything is sized in rem), kept per browser; Hearthstone and LoR offer the same for small screens
const textSize = () => { const v = +lsGet("bot.fs", 1); return [1, 1.12, 1.25].includes(v) ? v : 1; };
const applyTextSize = () => { document.documentElement.style.fontSize = textSize() === 1 ? "" : textSize() * 100 + "%"; };
applyTextSize();
// the look of the pages (settings → หน้าตาเว็บ): gold leaf on lacquer (no class), night-sky glass, or graphite; kept per browser
const UI_THEMES = [["", "ทองบนรัก"], ["glass", "กระจกดารา"], ["pro", "กราไฟต์"]];
const uiTheme = () => { let v = ""; try { v = localStorage.getItem("bot.ui") || ""; } catch {} return UI_THEMES.some(([k]) => k === v) ? v : ""; };
const applyUi = () => { const v = uiTheme(); for (const [k] of UI_THEMES) if (k) document.documentElement.classList.toggle("ui-" + k, v === k); dispatchEvent(new Event("bgfx")); };
applyUi();
let current = null, cardsReady = false;
// installable as an app: the service worker serves the app's own files, and the browser's install prompt waits in Settings
let installEv = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEv = e; });
addEventListener("appinstalled", () => { installEv = null; toast("ติดตั้งแอปแล้ว เปิดจากหน้าจอโฮมได้เลย"); });
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function appSection(api) {
  if (standalone()) return [];
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!installEv && !ios) return [];
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "แอปบนหน้าจอโฮม"),
    h("div", { class: "small muted" }, "เปิดเต็มจอไม่มีแถบเบราว์เซอร์ สนามจะกว้างขึ้น และหน้าเว็บโหลดเร็วขึ้น"),
    installEv ? h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async () => { const ev = installEv; installEv = null; api.close(); ev.prompt(); try { await ev.userChoice; } catch {} } }, "ติดตั้งเป็นแอป"))
      : h("div", { class: "small" }, "บน iPhone/iPad: แตะปุ่มแชร์ของ Safari แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\"")];
}

// ---------- background: still flecks of gold leaf on the lacquer (drawn once per size, no animation) ----------
(function bgfx() {
  const c = $("#bgfx"), g = c.getContext("2d");
  const fit = () => { const W = (c.width = innerWidth), H = (c.height = innerHeight), col = document.documentElement.classList.contains("ui-glass") ? "#d4e9ff" : "#e8ba5c"; g.clearRect(0, 0, W, H); // gold flecks, or stars on the glass theme
    for (let k = 0, n = Math.round((W * H) / 9000); k < n; k++) { g.globalAlpha = 0.05 + Math.random() * 0.22; g.fillStyle = col; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 1.3 + 0.3, 0, 7); g.fill(); }
    g.globalAlpha = 1; };
  fit(); let t = 0; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fit, 150); }); addEventListener("bgfx", fit);
})();

// ---------- gate screens ----------
function ring() {
  const NS = "http://www.w3.org/2000/svg"; const mk = (cls, r, dash) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 200 200"); if (cls) s.setAttribute("class", cls);
    s.innerHTML = `<circle cx="100" cy="100" r="${r}" fill="none" style="stroke:var(--gold);stroke-opacity:.55" stroke-width="0.8" stroke-dasharray="${dash}"/><circle cx="100" cy="100" r="${r - 6}" fill="none" style="stroke:var(--gold);stroke-opacity:.25" stroke-width="0.5"/>` +
      Array.from({ length: 12 }, (_, k) => `<rect x="99" y="${100 - r - 2}" width="2" height="5" style="fill:var(--gold-hi);fill-opacity:.8" transform="rotate(${k * 30} 100 100)"/>`).join(""); return s; };
  return h("div", { class: "ring" }, mk("", 96, "2 4"), mk("r2", 92, "14 6"));
}
function gate(...kids) { root.replaceChildren(h("div", { class: "gate" }, h("div", { class: "stack", style: "align-items:center;gap:22px" }, ...kids))); }
function loginScreen(err) {
  $("#nav").hidden = true; $("#me").replaceChildren();
  gate(h("div", { class: "ring" }, ...ring().children, h("div", { class: "stack", style: "align-items:center;gap:6px;position:relative" }, h("span", { class: "eyebrow" }, "Battle of Talingchan"), h("b", { class: "big" }, "ARENA"), h("span", { class: "small muted" }, "สนามซ้อมส่วนตัว"))),
    h("button", { class: "btn gold lg", onclick: async (e) => { e.currentTarget.disabled = true; try { await signIn(); } catch (er) { loginScreen(er.code === "auth/popup-closed-by-user" ? "" : "เข้าสู่ระบบไม่สำเร็จ: " + (er.code || er.message)); } } }, "เข้าสู่ระบบด้วย Google"),
    err ? h("div", { class: "small", style: "color:var(--bad)" }, err) : null,
    h("div", { class: "tiny muted", style: "max-width:420px" }, "เว็บส่วนตัวสำหรับซ้อมเล่นกับเพื่อน ไม่มีการซื้อขายหรือเติมเงินใดๆ ข้อมูลและภาพการ์ดโหลดจากเว็บทางการ bottcg.com ลิขสิทธิ์เป็นของเจ้าของเกม"));
}
function pendingScreen() {
  $("#nav").hidden = true; meArea();
  gate(ring(), h("h2", { style: "margin:0" }, "รอเจ้าของสนามอนุมัติ"), h("div", { class: "muted", style: "max-width:420px" }, `บัญชี ${Me.profile.name} ส่งคำขอแล้ว เมื่อริมุรุกดอนุมัติ หน้านี้จะเปิดให้อัตโนมัติ`), h("button", { class: "btn", onclick: () => signOut() }, "ออกจากระบบ"));
}

// ---------- header / settings ----------
function meArea() {
  const p = Me.profile || {}; const pending = Data.users.filter((u) => u.status === "pending").length;
  const na = document.getElementById("nav-ask"); if (na) na.hidden = p.role !== "owner";
  $("#me").replaceChildren(h("button", { class: "btn sm", onclick: settings, "aria-label": `${myName()} · ตั้งค่า` }, avatarEl(myAvatar(), myName(), "hd"), h("span", null, myName()), pending && p.role === "owner" ? h("span", { class: "chip warn" }, pending + " รออนุมัติ") : null, Ciel.on() ? h("span", { class: "chip gold" }, "✦ ชิเอล") : null));
}
// the little 3D figure by your side of the table, and the colour of the mat's lacquer: some are opened by achievements (kept per browser)
function avatarSection() {
  const seg = (label, key, cur, opts, kind, done) => h("div", { class: "segfield" }, h("div", { class: "seglabel", "aria-hidden": "true" }, label), h("div", { class: "seg wrap", role: "group", "aria-label": label }, opts.map(([k, t]) => { const open = !k || unlocked(kind, k);
    return h("button", { "aria-pressed": cur === k ? "true" : "false", disabled: !open, title: open ? t : "ล็อคอยู่ · " + needFor(kind, k), onclick: (e) => {
      try { if (k) localStorage.setItem(key, k); else localStorage.removeItem(key); } catch {} for (const b of e.currentTarget.parentElement.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); toast(done(t)); } }, open ? t : "🔒 " + t); })));
  const locked = [...Object.keys(AVATARS).filter((k) => !unlocked("av", k)).map((k) => [AVATARS[k].name, needFor("av", k)]), ...Object.keys(MATS).filter((k) => !unlocked("mat", k)).map((k) => ["ผ้าปู" + MATS[k].name, needFor("mat", k)]),
    ...Object.keys(SIGILS).filter((k) => !unlocked("sig", k)).map((k) => ["วงอัญเชิญ" + SIGILS[k].name, needFor("sig", k)]), ...Object.keys(WINFX).filter((k) => !unlocked("win", k)).map((k) => ["ฉากชัยชนะ" + WINFX[k].name, needFor("win", k)])];
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "อวตาร 3 มิติ สนาม ผ้าปูโต๊ะ และวงอัญเชิญ"),
    h("div", { class: "small muted" }, "อวตารยืนข้างแถบกลางสนามฝั่งคุณ เด้งตอนเริ่มเทิร์น สะดุ้งตอนเสีย LIFE ดีใจหรือคอตกตอนจบเกม สนามคือฉากรอบโต๊ะ (แมพ) ที่เห็นเฉพาะบนเครื่องเรา ส่วนผ้าปูโต๊ะ (playmat) คือผ้าที่ปูบนโต๊ะฝั่งเราซึ่งคู่แข่งเห็นด้วย วงอัญเชิญคือวงที่เปิดใต้การ์ดตอนเราอัญเชิญ เปลี่ยนแล้วใช้ตั้งแต่เกมถัดไป"),
    seg("หน้าตาเว็บ (ธีม)", "bot.ui", uiTheme(), UI_THEMES, "ui", (t) => { applyUi(); return `หน้าตาเว็บ: ${t}`; }),
    seg("อวตาร 3 มิติ", "bot.av3", myFigure(), [["", "ไม่มี"], ...Object.entries(AVATARS).map(([k, a]) => [k, a.name]), ...(Vault.has("fig") ? [["own", "รูปปั้นของฉัน"]] : []), ...(Vault.has("stand") ? [["stand", "ภาพตั้งโต๊ะของฉัน"]] : [])], "av", (t) => `เลือก${t}แล้ว ใช้ตั้งแต่เกมถัดไป`),
    seg("สนาม (ฉากรอบโต๊ะ)", "bot.scene", myScene(), Object.entries(SCENES).filter(([k]) => sceneOpen(k)).map(([k, m]) => [k, m.owner ? "✦ " + m.name : m.name]), "scene", (t) => `สนาม${t} ใช้ตั้งแต่เกมถัดไป`),
    seg("ผ้าปูโต๊ะ (playmat)", "bot.mat", myMat(), [...Object.entries(MATS).map(([k, m]) => [k, m.name]), ...(Vault.has("mat") ? [["own", "ผ้าปูของฉัน"]] : [])], "mat", (t) => `ผ้าปู${t} ใช้ตั้งแต่เปิดสนามครั้งถัดไป`),
    Vault.has("sleeve") ? seg("หลังการ์ด", "bot.sleeve", mySleeve(), [["", "ลายไทย"], ["own", "หลังการ์ดของฉัน"]], "sleeve", (t) => `หลังการ์ด${t} ใช้ตั้งแต่เกมถัดไป`) : null,
    seg("วงอัญเชิญ", "bot.sig", mySigil(), Object.entries(SIGILS).filter(([k, m]) => !m.owner || sigilOpen(k)).map(([k, m]) => [k, m.owner ? "✦ " + m.name : m.name]), "sig", (t) => `วงอัญเชิญลาย${t} ใช้ตั้งแต่เกมถัดไป`),
    seg("ฉากเมื่อชนะ", "bot.winfx", myWinFx() === "gold" ? "" : myWinFx(), Object.entries(WINFX).map(([k, m]) => [k === "gold" ? "" : k, m.name]), "win", (t) => `ฉากชัยชนะ: ${t} (เห็นบนเครื่องเรา)`),
    locked.length ? h("details", { class: "unlocks" }, h("summary", null, `วิธีปลดล็อคที่เหลืออีก ${locked.length} อย่าง (ได้จากการเล่นเท่านั้น)`), h("ul", null, locked.map(([n, w]) => h("li", null, h("b", null, n), h("span", null, w))))) : null].filter(Boolean);
}
// how much the 3D table draws, and how fast its animations run (both per browser; used the next time the table opens)
function gfxSection() {
  const seg = (label, cur, opts, key, done) => h("div", { class: "segfield" }, h("div", { class: "seglabel", "aria-hidden": "true" }, label), h("div", { class: "seg wrap", role: "group", "aria-label": label }, opts.map(([v, t]) => h("button", { "aria-pressed": String(cur) === String(v) ? "true" : "false", onclick: (e) => {
    try { localStorage.setItem(key, v); } catch {} for (const b of e.currentTarget.parentElement.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); toast(done(t)); } }, t))));
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "ภาพและความเร็ว"),
    h("div", { class: "small muted" }, "สวยสุด: แสงฟุ้ง เงา และทองสะท้อนแสงทุกเครื่อง · ประหยัดเครื่อง: เหมาะกับมือถือรุ่นเก่า วาดภาพ 30 เฟรมต่อวินาที แบตอยู่นานขึ้น · อัตโนมัติ: เริ่มตามขนาดจอ แล้วลดแสงฟุ้งและความละเอียดลงเองถ้าเครื่องเล่นไม่ลื่น · แบบเรียบ 2D: ไม่มีโต๊ะ 3 มิติ การ์ดบนสนามวางเป็นแถว เบาเครื่องที่สุด"),
    seg("คุณภาพภาพ", gfxSetting(), [["auto", "อัตโนมัติ"], ["high", "สวยสุด"], ["low", "ประหยัดเครื่อง"], ["flat", "แบบเรียบ 2D"]], "bot.gfx", (t) => `ภาพ: ${t} มีผลตอนเปิดสนามครั้งถัดไป`),
    seg("ประกายการ์ดหายาก", foilSetting(), [["auto", "อัตโนมัติ"], ["1", "เปิด"], ["0", "ปิด"]], "bot.foil", (t) => `ประกายการ์ดหายาก: ${t}${t === "อัตโนมัติ" ? " (เปิดเฉพาะภาพสวยสุดบนคอมพิวเตอร์)" : ""} มีผลตอนเปิดสนามครั้งถัดไป`),
    seg("ความเร็วแอนิเมชัน", animSetting(), [[1, "ปกติ"], [1.6, "เร็ว"], [2.5, "เร็วมาก"]], "bot.anim", (t) => `แอนิเมชัน: ${t} มีผลตอนเปิดสนามครั้งถัดไป`),
    seg("ขนาดตัวหนังสือ", textSize(), [[1, "ปกติ"], [1.12, "ใหญ่"], [1.25, "ใหญ่มาก"]], "bot.fs", (t) => { applyTextSize(); return `ตัวหนังสือ: ${t}`; }),
    // phones that can buzz (Android): a short buzz when our LIFE is hit and when our turn begins
    "vibrate" in navigator ? seg("สั่นเมื่อโดนตี LIFE และถึงตาเรา", buzzOn() ? "1" : "0", [["1", "สั่น"], ["0", "ไม่สั่น"]], "bot.buzz", (t) => (t === "สั่น" ? "มือถือจะสั่นเมื่อโดนตี LIFE และถึงตาเรา" : "ปิดการสั่นแล้ว")) : null];
}
// effects and music: on/off and loudness for each, the arena's music style, and quiet music in the menus
function soundSection() {
  const row = (label, on, set, vol, setVol) => h("div", { class: "row" }, h("label", { class: "chk" }, h("input", { type: "checkbox", checked: on, onchange: (e) => set(e.target.checked) }), h("span", null, label)),
    h("input", { type: "range", min: 0, max: 1, step: 0.05, value: vol, "aria-label": "ความดัง" + label, oninput: (e) => setVol(+e.target.value), onchange: () => Sfx.play("click") }));
  const style = h("div", { class: "seg", role: "group", "aria-label": "แนวเพลงในสนาม" }, Object.entries(MUSIC_STYLES).map(([k, t]) => h("button", { "aria-pressed": Music.style === k ? "true" : "false", onclick: (e) => { Music.setStyle(k); for (const b of style.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); toast(`เพลงในสนาม: ${t}`); } }, t)));
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "เสียงและเพลง"),
    h("div", { class: "small muted" }, "เสียงและเพลงทั้งหมดสร้างสดในเครื่อง ไม่มีไฟล์เพลงให้โหลด เพลงแต่งใหม่ทุกครั้งตามจังหวะเกม"),
    row("เสียงเอฟเฟกต์", Sfx.on, (v) => { if (v !== Sfx.on) Sfx.toggle(); }, Sfx.vol, (v) => Sfx.setVolume(v)),
    row("เพลงประกอบ", Music.on, (v) => { if (v !== Music.on) Music.toggle(); }, Music.vol, (v) => Music.setVolume(v)),
    h("div", { class: "segfield" }, h("div", { class: "seglabel", "aria-hidden": "true" }, "แนวเพลงในสนาม"), style),
    h("label", { class: "chk" }, h("input", { type: "checkbox", checked: Music.menu, onchange: (e) => Music.setMenu(e.target.checked) }), h("span", null, "เปิดเพลงเบาๆ ที่หน้าเมนูด้วย"))];
}
// notices while the app is in the background (your turn, a friend joining, a new room)
function notifySection() {
  const note = h("div", { class: "small muted" });
  const say = () => { note.textContent = !notifySupported() ? "เบราว์เซอร์นี้แจ้งเตือนไม่ได้ (บน iPhone/iPad ต้องติดตั้งเป็นแอปบนหน้าจอโฮมก่อน)" : notifyBlocked() ? "เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้อยู่ เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์" : notifyOn() ? "เปิดอยู่: แจ้งเมื่อถึงตาเรา เพื่อนเข้าห้อง มีห้องใหม่ และเกมจบ ขณะแอปเปิดค้างไว้เบื้องหลัง" : "ปิดอยู่: แท็บจะขึ้นจุด ● อย่างเดียวเมื่อถึงตาเรา"; };
  const seg = h("div", { class: "seg", role: "group", "aria-label": "การแจ้งเตือน" });
  const paint = () => { seg.replaceChildren(...[[false, "ปิด"], [true, "เปิด"]].map(([v, t]) => h("button", { "aria-pressed": notifyOn() === v ? "true" : "false", disabled: v && (!notifySupported() || notifyBlocked()), onclick: async () => { const ok = await setNotify(v); if (v && !ok) toast("ยังไม่ได้รับอนุญาตให้แจ้งเตือน", "bad"); paint(); say(); } }, t))); };
  paint(); say();
  return [h("div", { class: "eyebrow", style: "margin-top:12px" }, "การแจ้งเตือน"), note, seg];
}
// the settings sheet was four phone screens long: after the profile, each titled group folds (one tap opens it; which ones were
// open is remembered in this browser)
function groupSettings(out) {
  const items = out.filter((x) => x != null && x !== false), res = [], open = lsGet("bot.setOpen", {}); let cur = null;
  for (const el of items) {
    const isHead = el && el.classList && el.classList.contains("eyebrow");
    if (isHead && res.length) { const title = el.textContent; const d = h("details", { class: "setgroup", open: !!open[title] }, h("summary", null, title));
      d.addEventListener("toggle", () => { const o = lsGet("bot.setOpen", {}); if (d.open) o[title] = 1; else delete o[title]; lsSet("bot.setOpen", o); }); res.push(d); cur = d; continue; }
    if (cur) cur.append(el); else res.push(el);
  }
  return res;
}
function settings() {
  openSheet((api) => {
    const key = h("input", { type: "password", value: Ciel.key(), placeholder: "sk-ant-…", autocomplete: "off", "aria-label": "Claude API key" });
    const model = h("select", { "aria-label": "โมเดลหลัก" }, ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"].map((m) => h("option", { value: m, selected: m === Ciel.model() }, m)));
    const out = [...profileSection(api), ...avatarSection(), ...vaultSection(), ...gfxSection(), ...soundSection(), ...notifySection(), ...appSection(api), h("div", { class: "eyebrow", style: "margin-top:12px" }, "เจอปัญหา?"), h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { api.close(); openReport(); } }, "แจ้งปัญหา")), h("div", { class: "eyebrow", style: "margin-top:12px" }, "ชิเอล (Claude API)"),
      h("div", { class: "small muted" }, "ใส่ API key ของคุณเองเพื่อให้ชิเอลคิดเป็นบอท อ่านเอฟเฟกต์การ์ด และจัดเด็ค key เก็บเฉพาะในเบราว์เซอร์นี้ ไม่ส่งขึ้นฐานข้อมูล ค่าใช้จ่ายคิดกับบัญชี API ของคุณ ถ้าไม่ใส่ ยังเล่นกับบอทพื้นฐานได้"),
      key, h("div", { class: "row" }, h("span", { class: "small muted" }, "โมเดลจัดเด็ค/อ่านการ์ด"), model),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { const v = key.value.trim(); if (v) lsSet("bot.apiKey", v); else lsDel("bot.apiKey"); lsSet("bot.model", model.value); toast(v ? "บันทึก key ของชิเอลแล้ว" : "ลบ key แล้ว"); meArea(); api.close(); } }, "บันทึก"), Ciel.on() ? h("button", { class: "btn danger sm", onclick: () => { lsDel("bot.apiKey"); meArea(); api.close(); toast("ลบ key แล้ว"); } }, "ลบ key") : null)];
    if (Me.profile && Me.profile.role === "owner") {
      const users = Data.users.filter((u) => u.id !== Me.uid).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || (b.createdAt || 0) - (a.createdAt || 0));
      const url = h("input", { type: "text", value: Data.meta.cardsUrl || "", placeholder: "เว้นว่าง = ใช้ไฟล์ข้อมูลตั้งต้น", "aria-label": "ลิงก์ข้อมูลการ์ด" });
      out.push(h("div", { class: "eyebrow", style: "margin-top:12px" }, "ผู้เล่นในสนาม (เจ้าของเท่านั้น)"),
        users.length ? h("div", { class: "stack", style: "gap:6px" }, users.map((u) => h("div", { class: "mrow", style: "cursor:default" }, avatarEl(u.avatar || u.photo, u.nick || u.name, "sm"),
          h("div", { style: "min-width:0" }, h("b", null, u.nick || u.name), u.nick ? h("span", { class: "tiny muted" }, " (" + u.name + ")") : null, h("div", { class: "tiny muted" }, `${u.email || ""} · ${fmtDate(u.createdAt)}`)),
          h("div", { class: "row" }, h("span", { class: "chip " + (u.status === "approved" ? "good" : u.status === "blocked" ? "bad" : "warn") }, { approved: "อนุมัติแล้ว", blocked: "ระงับ", pending: "รออนุมัติ" }[u.status] || u.status),
            u.status !== "approved" ? h("button", { class: "btn sm gold", onclick: () => setUserStatus(u.id, "approved").then(() => toast("อนุมัติ " + u.name)).catch(() => toast("อนุมัติไม่ได้", "bad")) }, "อนุมัติ") : null,
            u.status !== "blocked" ? h("button", { class: "btn sm danger", onclick: () => setUserStatus(u.id, "blocked").then(() => toast("ระงับ " + u.name)) }, "ระงับ") : null)))) : h("div", { class: "small muted" }, "ยังไม่มีเพื่อนขอเข้า ส่งลิงก์เว็บนี้ให้เพื่อนล็อกอิน แล้วมากดอนุมัติที่นี่"),
        h("div", { class: "eyebrow", style: "margin-top:12px" }, "แหล่งข้อมูลการ์ด"), h("div", { class: "small muted" }, `ตอนนี้มี ${CARDS.length.toLocaleString()} ใบ ถ้าเว็บทางการเปลี่ยนชื่อไฟล์ข้อมูล (cards.xxxx.json) ให้วางลิงก์ใหม่ที่นี่`),
        h("div", { class: "row" }, url, h("button", { class: "btn sm", onclick: () => setMeta({ cardsUrl: url.value.trim() }).then(() => { toast("บันทึกแล้ว โหลดหน้าใหม่เพื่อใช้"); }).catch(() => toast("บันทึกไม่ได้", "bad")) }, "บันทึก")));
    }
    out.push(h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn", onclick: () => { api.close(); signOut(); } }, "ออกจากระบบ")));
    return groupSettings(out);
  }, { title: "ตั้งค่า", sub: myName(), wide: true });
}
// ---------- profile: nickname + picture (upload, card art, or Google) ----------
function shrinkImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const S = 160, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"); const m = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("อ่านรูปไม่ได้")); }; img.src = url;
  });
}
function profileSection() {
  const st = { nick: (Me.profile && Me.profile.nick) || "", avatar: (Me.profile && Me.profile.avatar) || "" };
  const prev = h("div"); const drawPrev = () => prev.replaceChildren(avatarEl(st.avatar || (Me.profile && Me.profile.photo), st.nick || (Me.profile && Me.profile.name), "lg"));
  drawPrev();
  const nick = h("input", { type: "text", value: st.nick, maxlength: "24", placeholder: (Me.profile && Me.profile.name) || "ชื่อเล่น", "aria-label": "ชื่อที่แสดง", oninput: (e) => { st.nick = e.target.value; drawPrev(); } });
  const file = h("input", { type: "file", accept: "image/*", hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { st.avatar = await shrinkImage(f); drawPrev(); } catch (er) { toast(er.message, "bad"); } } });
  const pickBox = h("div");
  const cardPicker = () => {
    let q = ""; const grid = h("div", { class: "avpick" });
    const draw = () => { const list = CARDS.filter((c) => isBase(c) && c.t === "A" && (!q || c.n.includes(q) || (c.sy || "").includes(q))).sort((a, b) => (b.o1 ? 1 : 0) - (a.o1 ? 1 : 0) || (b.pw || 0) - (a.pw || 0)).slice(0, 36);
      grid.replaceChildren(...list.map((c) => h("button", { title: c.n, "aria-label": c.n, "aria-pressed": st.avatar === "card:" + c.p ? "true" : "false", onclick: () => { st.avatar = "card:" + c.p; drawPrev(); draw(); } }, avatarEl("card:" + c.p, c.n)))); };
    draw();
    pickBox.replaceChildren(h("div", { class: "stack", style: "gap:8px" }, h("input", { type: "search", placeholder: "ค้นชื่อการ์ดหรือ Symbol", "aria-label": "ค้นการ์ดสำหรับรูปโปรไฟล์", oninput: (e) => { q = e.target.value.trim(); draw(); } }), grid));
  };
  return [h("div", { class: "eyebrow" }, "โปรไฟล์"),
    h("div", { class: "row", style: "gap:16px;align-items:flex-start" }, prev, h("div", { class: "stack grow", style: "gap:8px" }, nick,
      h("div", { class: "row" }, file, h("button", { class: "btn sm", onclick: () => file.click() }, "อัปโหลดรูป"), h("button", { class: "btn sm", onclick: cardPicker }, "เลือกจากภาพการ์ด"), h("button", { class: "btn sm", onclick: () => { st.avatar = ""; drawPrev(); } }, "ใช้รูปจาก Google")),
      h("div", null, h("button", { class: "btn gold sm", onclick: async (e) => { const b = e.currentTarget; b.disabled = true;
        try { await saveProfile({ nick: st.nick.trim().slice(0, 24), avatar: st.avatar }); toast("บันทึกโปรไฟล์แล้ว"); } catch (er) { console.warn(er); toast("บันทึกโปรไฟล์ไม่สำเร็จ", "bad"); } b.disabled = false; } }, "บันทึกโปรไฟล์")))),
    pickBox];
}

// ---------- router ----------
function parse() { const p = (location.hash.replace(/^#/, "") || "play").split("/"); return { tab: Views[p[0]] ? p[0] : "play", parts: p.slice(1) }; }
function route() {
  if (!cardsReady) return;
  const { tab, parts } = parse();
  if (current && current !== tab && Views[current].leave) Views[current].leave();
  current = tab; SkinCtx.on = tab === "decks" || tab === "play"; if (tab !== "play") setGameSkins(null); // (a game's skins are only for its table)
  document.querySelectorAll("#nav a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  { const cur = document.querySelector('#nav a[aria-current="page"]'); if (cur && cur.scrollIntoView && innerWidth <= 700) cur.scrollIntoView({ block: "nearest", inline: "nearest" }); }
  try { Views[tab].render(root, parts); } catch (e) { console.error(e); root.replaceChildren(h("div", { class: "empty" }, "หน้านี้มีปัญหา: " + e.message)); }
  if (!document.body.classList.contains("arena-on")) scrollTo(0, 0);
}
addEventListener("hashchange", route);
applyPersona();
let refreshT = null;
Data.listeners.add(() => {
  if (Me.profile && Me.profile.role === "owner") meArea();
  if (!cardsReady || !current) return;
  clearTimeout(refreshT); refreshT = setTimeout(() => { const v = Views[current]; if (v && v.refresh && !document.querySelector(".scrim")) v.refresh(root, parse().parts); }, 120);
});

// ---------- auto update: check for a newer deploy every 2 minutes ----------
const APP_V = (import.meta.url.match(/\?v=(\w+)/) || [])[1];
async function checkUpdate() {
  if (!APP_V) return;
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; const { v } = await r.json();
    if (!v || v === APP_V) return;
    const busyNow = document.body.classList.contains("arena-on") || /^#decks\/(edit|new)/.test(location.hash) || document.querySelector(".scrim");
    if (!busyNow) return location.reload();
    if (!document.querySelector(".upd")) document.body.append(h("div", { class: "upd glass", role: "status" }, h("span", null, "มีเวอร์ชันใหม่ของเว็บ"), h("button", { class: "btn gold sm", onclick: () => location.reload() }, "โหลดเลย"), h("button", { class: "btn sm", onclick: (e) => e.currentTarget.parentElement.remove() }, "ไว้ก่อน")));
  } catch {}
}
setInterval(checkUpdate, 120000); addEventListener("visibilitychange", () => { if (!document.hidden) checkUpdate(); });

// ---------- boot ----------
let meUnsub = null, booted = false;
gate(busy("กำลังเปิดสนาม…"));
onUser(async (user) => {
  if (meUnsub) { meUnsub(); meUnsub = null; }
  cardsReady = false; booted = false;
  if (!user) return loginScreen();
  gate(busy("กำลังตรวจสิทธิ์…"));
  let prof;
  try { prof = await ensureProfile(user); } catch (e) { console.error(e); return gate(h("div", null, "เชื่อมต่อฐานข้อมูลไม่ได้"), h("div", { class: "small muted" }, e.message), h("button", { class: "btn", onclick: () => signOut() }, "ออกจากระบบ")); }
  meUnsub = watchMe(async (p) => {
    if (!p) return;
    { const was = isOwnerNow(); applyPersona(); if (booted && was !== isOwnerNow()) route(); } // Ciel's name is for the owner account only
    if (p.status !== "approved") { booted = false; cardsReady = false; return p.status === "blocked" ? gate(h("h2", null, "บัญชีนี้ถูกระงับ"), h("button", { class: "btn", onclick: () => signOut() }, "ออกจากระบบ")) : pendingScreen(); }
    if (booted) { meArea(); return; } booted = true;
    startData(); startVault(); meArea(); $("#nav").hidden = false;
    gate(busy("กำลังโหลดการ์ดจากเว็บทางการ…"));
    try { await loadCards(); }
    catch (e) {
      // the meta doc may not have arrived yet; retry once with the default file
      try { await new Promise((r) => setTimeout(r, 800)); await loadCards(); }
      catch (e2) { return gate(h("h2", null, "โหลดข้อมูลการ์ดไม่สำเร็จ"), h("div", { class: "muted small", style: "max-width:460px" }, "เว็บทางการอาจเปลี่ยนชื่อไฟล์ข้อมูล เจ้าของสนามวางลิงก์ใหม่ได้ที่เมนูตั้งค่า"), h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => location.reload() }, "ลองใหม่"), h("button", { class: "btn", onclick: settings }, "ตั้งค่า"))); }
    }
    cardsReady = true; route();
  });
  if (prof && prof.status !== "approved") pendingScreen();
});
