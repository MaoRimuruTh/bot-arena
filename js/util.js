// replaceChildren/append turn null into the text "null"; skip empty values everywhere in the app
if (typeof Element !== "undefined") for (const P of [Element.prototype, DocumentFragment.prototype]) for (const m of ["replaceChildren", "append"]) {
  const orig = P[m]; P[m] = function (...kids) { return orig.apply(this, kids.flat(9).filter((x) => x != null && x !== false)); };
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(9)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
export const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const lsDel = (k) => { try { localStorage.removeItem(k); } catch {} };
export function toast(msg, kind) {
  const t = h("div", { class: "toast" + (kind ? " " + kind : "") }, msg);
  $("#toasts").append(t); setTimeout(() => t.remove(), kind === "bad" ? 5200 : 3200);
}
export const fmtDate = (ms) => { try { return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };
export function busy(label) { return h("span", { class: "row muted small" }, h("span", { class: "spin" }), label || "กำลังโหลด…"); }
let stack = [];
export function openSheet(content, opts = {}) {
  const close = () => { scrim.remove(); stack = stack.filter((x) => x !== scrim); opts.onClose && opts.onClose(); };
  const sheet = h("div", { class: "sheet glass" + (opts.wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title || "" });
  sheet.append(h("header", null, h("div", { class: "grow" }, opts.title ? h("h2", null, opts.title) : null, opts.sub ? h("div", { class: "muted small" }, opts.sub) : null), opts.noClose ? null : h("button", { class: "x", "aria-label": "ปิด", onclick: close }, "✕")));
  const body = h("div", { class: "stack" }); sheet.append(body);
  const scrim = h("div", { class: "scrim", onclick: (e) => { if (e.target === scrim && !opts.noClose) close(); } }, sheet);
  document.body.append(scrim); stack.push(scrim);
  const api = { close, body, set(c) { body.replaceChildren(...[].concat(c).filter((x) => x != null && x !== false)); } }; // (an optional line left out is null: nothing, not the word)
  api.set(typeof content === "function" ? content(api) : content);
  return api;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && stack.length) { const x = stack[stack.length - 1].querySelector(".x"); if (x) x.click(); } });
export function confirmBox(msg, label, fn, danger) {
  return openSheet((api) => [h("p", { style: "margin:0" }, msg), h("div", { class: "row" }, h("button", { class: "btn " + (danger ? "danger" : "gold"), onclick: async () => { api.close(); await fn(); } }, label), h("button", { class: "btn", onclick: api.close }, "ยกเลิก"))], { title: "ยืนยัน" });
}
export function holo(el) {
  el.classList.add("holo");
  el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%"); el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%"); });
  return el;
}
