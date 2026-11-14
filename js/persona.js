// Ciel is Rimuru's own assistant. Only the owner account sees her name; every other account gets a
// nameless helper ("ผู้ช่วย") for the same tools, and nothing that speaks to Rimuru personally.
import { Me } from "./fb.js?v=20261114123802";
import { lsGet, lsSet } from "./util.js?v=20261114123802";

export const isOwnerNow = () => (Me.profile ? Me.profile.role === "owner" : lsGet("bot.own", false) === true);
const SWAP = [[/การ์ดที่ริมุรุเลือกเอง\s*/g, ""], [/ที่ชิเอลจัดให้ริมุรุ/g, "ที่จัดไว้ให้"], [/ที่ริมุรุเลือกไว้/g, "ที่เลือกไว้"], [/ของริมุรุ/g, "ของผู้เล่น"], [/ริมุรุ/g, "ผู้เล่น"], [/ชิเอล/g, "ผู้ช่วย"]];
// text written for the owner (prompts, deck notes) reworded for anyone else
export function plain(t) { if (isOwnerNow() || typeof t !== "string") return t; for (const [a, b] of SWAP) t = t.replace(a, b); return t; }

const ATTRS = ["title", "aria-label", "placeholder"];
const fix = (v) => v.replace(/ชิเอล/g, "ผู้ช่วย");
function scrubOne(n) {
  if (n.nodeType === 3) { if (n.nodeValue.includes("ชิเอล")) n.nodeValue = fix(n.nodeValue); }
  else if (n.nodeType === 1) for (const a of ATTRS) { const v = n.getAttribute(a); if (v && v.includes("ชิเอล")) n.setAttribute(a, fix(v)); }
}
function scrub(node) {
  scrubOne(node); if (node.nodeType !== 1) return;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n; while ((n = w.nextNode())) scrubOne(n);
}
let obs = null;
// call when the page starts and again whenever the signed-in profile arrives or changes
export function applyPersona() {
  if (Me.profile) lsSet("bot.own", Me.profile.role === "owner");
  if (typeof MutationObserver === "undefined" || !document.body) return;
  if (isOwnerNow()) { if (obs) { obs.disconnect(); obs = null; const na = document.getElementById("nav-ask"); if (na) na.textContent = "ถามชิเอล"; } return; }
  if (obs) return;
  scrub(document.body);
  obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach(scrub); else scrubOne(m.target); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
