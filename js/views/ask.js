// "ถามชิเอล": questions written inside the app, read later by Ciel in Rimuru's chat (owner account only).
// Each question can carry a short snapshot of where it was asked (page, deck, or the game in progress).
import { h, openSheet, toast, fmtDate, busy } from "../util.js?v=20261112151640";
import { Me, addQuestion, watchInbox, answerQuestion, deleteQuestion } from "../fb.js?v=20261112151640";
import { Views } from "../ui.js?v=20261112151640";

const ctxProviders = [];
// views register a function that describes what is on screen right now (e.g. the game state)
export function addAskContext(fn) { ctxProviders.push(fn); }
function snapshot() {
  const out = { page: location.hash || "#play" };
  for (const f of ctxProviders) { try { const r = f(); if (r) Object.assign(out, r); } catch (e) { console.warn(e); } }
  return out;
}
export const isOwner = () => !!(Me.profile && Me.profile.role === "owner");

// "แจ้งปัญหา": a short report of what went wrong plus where it happened. The owner's goes to the inbox; anyone else
// copies it to send in chat (only the owner's inbox can be written to from the app)
export function openReport() {
  const ctx = snapshot(), ver = new URL(import.meta.url).searchParams.get("v") || "";
  openSheet((api) => {
    const ta = h("textarea", { rows: 4, maxlength: "1500", placeholder: "เกิดอะไรขึ้น เช่น กดอัญเชิญแล้วการ์ดไม่ลงสนาม หรือเอฟเฟกต์ของการ์ดใบไหนทำงานผิด" });
    const pre = h("pre", { class: "glog", style: "white-space:pre-wrap;user-select:all;max-height:30vh", hidden: true });
    const text = () => [`แจ้งปัญหา BoT Arena (รุ่น ${ver})`, ta.value.trim(), ctx.game ? "--- สถานะเกม ---\n" + ctx.game : "หน้า: " + ctx.page, "เบราว์เซอร์: " + navigator.userAgent.slice(0, 140)].filter(Boolean).join("\n");
    const go = isOwner()
      ? h("button", { class: "btn gold", onclick: async (e) => { if (!ta.value.trim()) return toast("เล่าสั้นๆ ก่อนว่าเกิดอะไรขึ้น"); e.currentTarget.disabled = true; try { await addQuestion({ text: "[แจ้งปัญหา] " + ta.value.trim(), ctx: { ...ctx, ver } }); api.close(); toast("เก็บไว้ในกล่องคำถามแล้ว"); } catch { e.currentTarget.disabled = false; toast("บันทึกไม่ได้ ลองอีกครั้ง", "bad"); } } }, "เก็บไว้ในกล่องคำถาม")
      : h("button", { class: "btn gold", onclick: async () => { if (!ta.value.trim()) return toast("เล่าสั้นๆ ก่อนว่าเกิดอะไรขึ้น"); try { await navigator.clipboard.writeText(text()); toast("คัดลอกแล้ว ส่งให้เจ้าของสนามทางแชทได้เลย"); } catch { pre.textContent = text(); pre.hidden = false; toast("คัดลอกให้อัตโนมัติไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง", "bad"); } } }, "คัดลอกรายงาน");
    return [h("div", { class: "stack" }, ta, h("div", { class: "tiny muted" }, ctx.game ? "จะแนบสถานะเกมตอนนี้ (มือเรา สนาม และบันทึกล่าสุด) ไปด้วย" : "จะแนบหน้าที่เปิดอยู่ไปด้วย"),
      h("div", { class: "row" }, go), pre)];
  }, { title: "แจ้งปัญหา", sub: isOwner() ? "เก็บไว้ให้ชิเอลดูในกล่องคำถาม" : "คัดลอกไปส่งให้เจ้าของสนาม" });
}
export function openAsk(preset = "") {
  if (!isOwner()) return toast("ถามชิเอลใช้ได้เฉพาะบัญชีเจ้าของสนาม");
  const ctx = snapshot();
  openSheet((api) => {
    const ta = h("textarea", { rows: 4, maxlength: "2000", placeholder: "พิมพ์คำถามถึงชิเอล เช่น ตานี้ควรใช้ React ไหม / เด็คนี้ควรเปลี่ยนการ์ดอะไร", "aria-label": "คำถาม" }, preset);
    const withCtx = h("input", { type: "checkbox", checked: true, id: "ask-ctx" });
    return [h("div", { class: "stack" }, ta,
      h("label", { class: "chk small", for: "ask-ctx" }, withCtx, ctx.game ? "แนบสถานะเกมตอนนี้ไปด้วย" : "แนบหน้าที่เปิดอยู่ไปด้วย"),
      h("div", { class: "tiny muted" }, "คำถามจะเก็บไว้ในบัญชีของริมุรุ ชิเอลจะเห็นตอนริมุรุบอกในแชทว่า \"มีคำถามในแอป\" แล้วจะตอบกลับมาที่หน้า ถามชิเอล"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: async (e) => { const text = ta.value.trim(); if (!text) return toast("พิมพ์คำถามก่อน");
        e.currentTarget.disabled = true; try { await addQuestion({ text, ctx: withCtx.checked ? ctx : { page: ctx.page } }); api.close(); toast("ส่งคำถามถึงชิเอลแล้ว"); } catch (err) { toast("ส่งไม่สำเร็จ: " + err.message, "bad"); e.currentTarget.disabled = false; } } }, "ส่งคำถาม"),
        h("a", { class: "btn", href: "#ask", onclick: () => api.close() }, "ดูคำถามทั้งหมด")))];
  }, { title: "ถามชิเอล", sub: "คำถามจากในแอป" });
}

let list = [], unsub = null, ready = false;
Views.ask = {
  render(root) {
    if (!isOwner()) { root.replaceChildren(h("div", { class: "empty" }, "หน้านี้ใช้ได้เฉพาะบัญชีเจ้าของสนาม")); return; }
    if (!unsub) unsub = watchInbox((qs) => { list = qs; ready = true; if (location.hash.startsWith("#ask")) this.draw(root); });
    this.draw(root);
  },
  draw(root) {
    const head = h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ถามชิเอล"), h("div", { class: "muted small" }, "พิมพ์คำถามไว้ แล้วบอกชิเอลในแชทว่า \"มีคำถามในแอป\" ชิเอลจะมาอ่านและตอบที่นี่")),
      h("button", { class: "btn gold", onclick: () => openAsk() }, "ถามใหม่"));
    if (!ready) return root.replaceChildren(head, busy("กำลังโหลดคำถาม…"));
    if (!list.length) return root.replaceChildren(head, h("div", { class: "empty" }, "ยังไม่มีคำถาม กด \"ถามใหม่\" หรือกดปุ่ม ถามชิเอล ในสนามระหว่างเล่น"));
    root.replaceChildren(head, h("div", { class: "stack", style: "gap:12px" }, list.map((q) => h("div", { class: "panel stack", style: "gap:8px" },
      h("div", { class: "row small" }, h("span", { class: "chip " + (q.answer ? "good" : "warn") }, q.answer ? "ชิเอลตอบแล้ว" : "รอชิเอลอ่าน"), h("span", { class: "muted" }, fmtDate(q.at)), q.ctx && q.ctx.game ? h("span", { class: "chip" }, "ถามจากเกม") : q.ctx && q.ctx.page ? h("span", { class: "muted tiny" }, q.ctx.page) : null,
        h("button", { class: "btn sm", style: "margin-left:auto", onclick: () => deleteQuestion(q.id).catch((e) => toast(e.message, "bad")) }, "ลบ")),
      h("div", { style: "white-space:pre-wrap" }, q.text),
      q.ctx && q.ctx.game ? h("details", { class: "small muted" }, h("summary", null, "สถานะเกมที่แนบมา"), h("div", { style: "white-space:pre-wrap" }, q.ctx.game)) : null,
      q.answer ? h("div", { class: "coachbox", style: "white-space:pre-wrap" }, h("b", null, "ชิเอล: "), q.answer, h("div", { class: "tiny muted" }, fmtDate(q.answeredAt))) : answerBox(q)))));
  },
  leave() {},
};
// the reply box is used by Ciel (through Rimuru's signed-in browser) to post the answer back
function answerBox(q) {
  const ta = h("textarea", { rows: 2, placeholder: "คำตอบจากชิเอล", "aria-label": "คำตอบ", "data-q": q.id });
  return h("details", { class: "small" }, h("summary", { class: "muted" }, "ช่องตอบ (ชิเอลใช้)"), h("div", { class: "stack", style: "gap:6px" }, ta,
    h("button", { class: "btn sm", "data-answer": q.id, onclick: async () => { const a = ta.value.trim(); if (!a) return; await answerQuestion(q.id, a); toast("บันทึกคำตอบแล้ว"); } }, "บันทึกคำตอบ")));
}
