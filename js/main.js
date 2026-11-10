import { $, h, toast, openSheet, lsGet, lsSet, lsDel, busy, fmtDate } from "./util.js";
import { signIn, signOut, onUser, ensureProfile, watchMe, Me, Data, startData, setUserStatus, setMeta } from "./fb.js";
import { loadCards, CARDS } from "./cards.js";
import { Views } from "./ui.js";
import { Ciel } from "./ai.js";
import "./views/library.js";
import "./views/decks.js";
import "./views/lab.js";
import "./views/history.js";
import "./views/play.js";

const root = $("#view");
let current = null, cardsReady = false;

// ---------- background embers (2D, cheap) ----------
(function bgfx() {
  const c = $("#bgfx"), g = c.getContext("2d"); const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, P = []; const fit = () => { W = c.width = innerWidth; H = c.height = innerHeight; P = Array.from({ length: Math.round((W * H) / 26000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.35 + 0.08, a: Math.random() })); };
  fit(); addEventListener("resize", fit);
  const tick = () => {
    if (!document.body.classList.contains("arena-on")) {
      g.clearRect(0, 0, W, H);
      for (const p of P) { if (!reduce) { p.y -= p.v; p.x += Math.sin(p.y / 60) * 0.15; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; } } g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(p.a += 0.01)); g.fillStyle = p.r > 1.4 ? "#ffcf6a" : "#8fa8ff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    }
    requestAnimationFrame(tick);
  };
  tick();
})();

// ---------- gate screens ----------
function ring() {
  const NS = "http://www.w3.org/2000/svg"; const mk = (cls, r, dash) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 200 200"); if (cls) s.setAttribute("class", cls);
    s.innerHTML = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(227,181,74,.55)" stroke-width="0.8" stroke-dasharray="${dash}"/><circle cx="100" cy="100" r="${r - 6}" fill="none" stroke="rgba(227,181,74,.25)" stroke-width="0.5"/>` +
      Array.from({ length: 12 }, (_, k) => `<rect x="99" y="${100 - r - 2}" width="2" height="5" fill="rgba(255,217,134,.8)" transform="rotate(${k * 30} 100 100)"/>`).join(""); return s; };
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
  $("#me").replaceChildren(h("button", { class: "btn sm", onclick: settings, "aria-label": "ตั้งค่า" }, p.photo ? h("img", { src: p.photo, alt: "", referrerpolicy: "no-referrer" }) : null, h("span", null, p.name || ""), pending && p.role === "owner" ? h("span", { class: "chip warn" }, pending + " รออนุมัติ") : null, Ciel.on() ? h("span", { class: "chip gold" }, "✦ ชิเอล") : null));
}
function settings() {
  openSheet((api) => {
    const key = h("input", { type: "password", value: Ciel.key(), placeholder: "sk-ant-…", autocomplete: "off", "aria-label": "Claude API key" });
    const model = h("select", { "aria-label": "โมเดลหลัก" }, ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"].map((m) => h("option", { value: m, selected: m === Ciel.model() }, m)));
    const out = [h("div", { class: "eyebrow" }, "ชิเอล (Claude API)"),
      h("div", { class: "small muted" }, "ใส่ API key ของคุณเองเพื่อให้ชิเอลคิดเป็นบอท อ่านเอฟเฟกต์การ์ด และจัดเด็ค key เก็บเฉพาะในเบราว์เซอร์นี้ ไม่ส่งขึ้นฐานข้อมูล ค่าใช้จ่ายคิดกับบัญชี API ของคุณ ถ้าไม่ใส่ ยังเล่นกับบอทพื้นฐานได้"),
      key, h("div", { class: "row" }, h("span", { class: "small muted" }, "โมเดลจัดเด็ค/อ่านการ์ด"), model),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { const v = key.value.trim(); if (v) lsSet("bot.apiKey", v); else lsDel("bot.apiKey"); lsSet("bot.model", model.value); toast(v ? "บันทึก key ของชิเอลแล้ว" : "ลบ key แล้ว"); meArea(); api.close(); } }, "บันทึก"), Ciel.on() ? h("button", { class: "btn danger sm", onclick: () => { lsDel("bot.apiKey"); meArea(); api.close(); toast("ลบ key แล้ว"); } }, "ลบ key") : null)];
    if (Me.profile && Me.profile.role === "owner") {
      const users = Data.users.filter((u) => u.id !== Me.uid).sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || (b.createdAt || 0) - (a.createdAt || 0));
      const url = h("input", { type: "text", value: Data.meta.cardsUrl || "", placeholder: "เว้นว่าง = ใช้ไฟล์ข้อมูลตั้งต้น", "aria-label": "ลิงก์ข้อมูลการ์ด" });
      out.push(h("div", { class: "eyebrow", style: "margin-top:12px" }, "ผู้เล่นในสนาม (เจ้าของเท่านั้น)"),
        users.length ? h("div", { class: "stack", style: "gap:6px" }, users.map((u) => h("div", { class: "mrow", style: "cursor:default" }, u.photo ? h("img", { src: u.photo, alt: "", referrerpolicy: "no-referrer", style: "width:30px;height:30px;border-radius:50%" }) : h("span", { class: "ava" }, (u.name || "?")[0]),
          h("div", { style: "min-width:0" }, h("b", null, u.name), h("div", { class: "tiny muted" }, `${u.email || ""} · ${fmtDate(u.createdAt)}`)),
          h("div", { class: "row" }, h("span", { class: "chip " + (u.status === "approved" ? "good" : u.status === "blocked" ? "bad" : "warn") }, { approved: "อนุมัติแล้ว", blocked: "ระงับ", pending: "รออนุมัติ" }[u.status] || u.status),
            u.status !== "approved" ? h("button", { class: "btn sm gold", onclick: () => setUserStatus(u.id, "approved").then(() => toast("อนุมัติ " + u.name)).catch(() => toast("อนุมัติไม่ได้", "bad")) }, "อนุมัติ") : null,
            u.status !== "blocked" ? h("button", { class: "btn sm danger", onclick: () => setUserStatus(u.id, "blocked").then(() => toast("ระงับ " + u.name)) }, "ระงับ") : null)))) : h("div", { class: "small muted" }, "ยังไม่มีเพื่อนขอเข้า ส่งลิงก์เว็บนี้ให้เพื่อนล็อกอิน แล้วมากดอนุมัติที่นี่"),
        h("div", { class: "eyebrow", style: "margin-top:12px" }, "แหล่งข้อมูลการ์ด"), h("div", { class: "small muted" }, `ตอนนี้มี ${CARDS.length.toLocaleString()} ใบ ถ้าเว็บทางการเปลี่ยนชื่อไฟล์ข้อมูล (cards.xxxx.json) ให้วางลิงก์ใหม่ที่นี่`),
        h("div", { class: "row" }, url, h("button", { class: "btn sm", onclick: () => setMeta({ cardsUrl: url.value.trim() }).then(() => { toast("บันทึกแล้ว โหลดหน้าใหม่เพื่อใช้"); }).catch(() => toast("บันทึกไม่ได้", "bad")) }, "บันทึก")));
    }
    out.push(h("div", { class: "row", style: "margin-top:12px" }, h("button", { class: "btn", onclick: () => { api.close(); signOut(); } }, "ออกจากระบบ")));
    return out;
  }, { title: "ตั้งค่า", sub: Me.profile ? Me.profile.name : "", wide: true });
}

// ---------- router ----------
function parse() { const p = (location.hash.replace(/^#/, "") || "play").split("/"); return { tab: Views[p[0]] ? p[0] : "play", parts: p.slice(1) }; }
function route() {
  if (!cardsReady) return;
  const { tab, parts } = parse();
  if (current && current !== tab && Views[current].leave) Views[current].leave();
  current = tab;
  document.querySelectorAll("#nav a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  try { Views[tab].render(root, parts); } catch (e) { console.error(e); root.replaceChildren(h("div", { class: "empty" }, "หน้านี้มีปัญหา: " + e.message)); }
  if (!document.body.classList.contains("arena-on")) scrollTo(0, 0);
}
addEventListener("hashchange", route);
let refreshT = null;
Data.listeners.add(() => {
  if (Me.profile && Me.profile.role === "owner") meArea();
  if (!cardsReady || !current) return;
  clearTimeout(refreshT); refreshT = setTimeout(() => { const v = Views[current]; if (v && v.refresh && !document.querySelector(".scrim")) v.refresh(root, parse().parts); }, 120);
});

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
    if (p.status !== "approved") { booted = false; cardsReady = false; return p.status === "blocked" ? gate(h("h2", null, "บัญชีนี้ถูกระงับ"), h("button", { class: "btn", onclick: () => signOut() }, "ออกจากระบบ")) : pendingScreen(); }
    if (booted) return; booted = true;
    startData(); meArea(); $("#nav").hidden = false;
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
