// Card text made readable: one block per ability, the ability type and keywords as coloured tags,
// reminder text dimmed, and the data's markup ({symbol X}, {only}, {red …}) drawn instead of printed.
import { h } from "./util.js?v=20261113133136";

// what each keyword means (from the reminder text printed on the cards / Rule Book 3.2)
export const KW_HELP = {
  "ต่อเนื่อง": "มีผลตลอดเวลาที่การ์ดใบนี้อยู่บนสนาม",
  "อัตโนมัติ": "ทำงานเองเมื่อถึงเงื่อนไขที่เขียนไว้",
  "สั่งใช้": "ผู้เล่นเลือกใช้เอง ต้องจ่ายค่าใช้จ่ายที่อยู่หน้าเครื่องหมาย :",
  "เทิร์นละครั้ง": "ใช้หรือทำงานได้เทิร์นละ 1 ครั้ง",
  "จุติ": "ทำงานเมื่อ Avatar ใบนี้ถูกอัญเชิญลงสนามแบบจ่าย Cost",
  "คำสั่งเสีย": "ทำงานเมื่อ Avatar ใบนี้ถูกทำลาย",
  "พอดี": "ได้ความสามารถเมื่ออัญเชิญด้วยการทิ้ง GEM พอดีกับ Cost",
  "สอดแนม": "แสดงการ์ดใบบนสุดของ Deck ตามจำนวน",
  "ธรณีสูบ": "ส่งการ์ดใบบนสุดจาก Deck ตกนรก",
  "เซ่นไหว้": "ทำลาย Avatar จาก Avatar Zone ลงนรกเป็นค่าใช้จ่าย",
  "เนรเทศ": "ส่งการ์ดไปมิติมืด",
  "โล่มนุษย์": "เมื่อถูกโจมตี Avatar ใบนี้ที่ตื่นอยู่เปลี่ยนเป็นนอน แล้วรับการโจมตีแทน",
  "สามัคคี": "เปลี่ยนจากตื่นเป็นนอน แล้วนำ POWER ไปเพิ่มให้ Avatar ที่สั่งโจมตีจนจบการต่อสู้",
  "แทงหลัง": "เปลี่ยนจากตื่นเป็นนอน แล้วเพิ่ม POWER ของตัวเอง +1 ให้ผู้โจมตี ถ้าสีต่างกัน ผู้โจมตีถูกทำลายเมื่อจบการต่อสู้",
  "ลูกฮึด": "ต่อสู้กับ Avatar ที่ POWER เท่ากันและไม่มีลูกฮึด ใบนี้ชนะ",
  "เตะไข่": "โจมตี LIFE ได้โดยตรงแม้อีกฝ่ายมี Avatar",
  "เลือกปฏิบัติ": "เลือกทำข้อใดข้อหนึ่ง",
};
// the keywords in a card's text and what they mean, for a phone (no hovering for the tooltips) and for new players
export function kwGloss(text) {
  const t = String(text || ""); const found = Object.keys(KW_HELP).filter((k) => t.includes(k) || (k === "อัตโนมัติ" && t.includes("อัติโนมัติ")));
  if (!found.length) return null;
  return h("details", { class: "kwgloss" }, h("summary", null, `คำในการ์ดนี้แปลว่าอะไร (${found.length})`),
    h("dl", null, found.flatMap((k) => [h("dt", null, k), h("dd", null, KW_HELP[k])])));
}
const TYPE = { "ต่อเนื่อง": "cont", "อัตโนมัติ": "auto", "อัติโนมัติ": "auto", "สั่งใช้": "act", "จุติ": "sum", "คำสั่งเสีย": "death" };
const LEAD = ["เทิร์นละครั้ง", "ต่อเนื่อง", "อัตโนมัติ", "อัติโนมัติ", "สั่งใช้", "จุติ", "คำสั่งเสีย", "พอดี", "โล่มนุษย์", "ลูกฮึด", "สามัคคี", "เตะไข่", "แทงหลัง", "เลือกปฏิบัติ"];
const INLINE = ["สอดแนม", "ธรณีสูบ", "เนรเทศ", "เซ่นไหว้", "จุติ", "คำสั่งเสีย", "โล่มนุษย์", "ลูกฮึด", "สามัคคี", "เตะไข่", "แทงหลัง", "เทิร์นละครั้ง"];
const MARK = { only: "Only #1", react: "React Magic", mod: "Modification Magic", magic: "Magic", land: "Land Magic" };
const REF = /(?:ได้รับ|ความสามารถ|อัญเชิญ|แบบ|และ|หรือ|มี|รับ|ของ|ใช้|เป็น|ด้วย|การ|,)\s*["“”]?$/;
const O = "\u0001", C = "\u0002";

// {red …} holds abilities the card hands out: keep each group whole while the text is split
function maskGroups(text) {
  const groups = []; let out = ""; let i = 0;
  while (i < text.length) {
    const m = /^\{\s*red\b/i.exec(text.slice(i, i + 8));
    if (!m) { out += text[i++]; continue; }
    let depth = 0, j = i; for (; j < text.length; j++) { if (text[j] === "{") depth++; else if (text[j] === "}" && --depth === 0) break; }
    groups.push(text.slice(i + m[0].length, j).trim()); out += O + (groups.length - 1) + C; i = j + 1;
  }
  return { out, groups };
}
// where a new ability starts in the middle of a line ("… POWER +1 อัตโนมัติ เมื่อ …")
function splitLine(line) {
  const cuts = []; const re = /(?:เทิร์นละครั้ง\s+)?(?:ต่อเนื่อง|อัตโนมัติ|อัติโนมัติ|สั่งใช้)(?=\s|:|$)|(?:จุติ|คำสั่งเสีย)(?=\s*[:(])/g; let m;
  while ((m = re.exec(line))) { const pre = line.slice(0, m.index); if (!pre.trim() || !/\s$/.test(pre) || REF.test(pre.trimEnd())) continue;
    if (/(?:เทิร์นละครั้ง|สั่งใช้|อัตโนมัติ|อัติโนมัติ|ต่อเนื่อง|พอดี)\s*$/.test(pre)) continue; cuts.push(m.index); }
  const parts = []; let from = 0; for (const c of cuts) { parts.push(line.slice(from, c)); from = c; } parts.push(line.slice(from));
  return parts.map((x) => x.trim()).filter(Boolean);
}
function inline(text, groups) {
  const out = []; let last = 0;
  const re = new RegExp(`${O}(\\d+)${C}|\\{\\s*[Ss]ymbol\\s+([^}]+?)\\s*\\}|\\{\\s*([^{}]+?)\\s*\\}|(\\([^()]{12,}\\))|(["“][^"“”\\n]{1,60}["”])|(POWER\\s*[+\\-]\\s*\\d+)|(${INLINE.join("|")})`, "g"); let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index)); last = m.index + m[0].length;
    if (m[1] != null) out.push(h("div", { class: "grant" }, h("span", { class: "gl" }, "ความสามารถที่ได้รับ"), ...blocks(groups[+m[1]].replace(/^["“]|["”]$/g, ""), groups)));
    else if (m[2]) out.push(h("span", { class: "sy" }, "◆ " + m[2]));
    else if (m[3]) out.push(h("span", { class: "sy mk" }, MARK[m[3].toLowerCase()] || m[3]));
    else if (m[4]) out.push(h("span", { class: "rem" }, "(", ...inline(m[4].slice(1, -1), groups), ")"));
    else if (m[5]) out.push(h("span", { class: "qn" }, m[5]));
    else if (m[6]) out.push(h("b", { class: "pw" }, m[6]));
    else out.push(h("b", { class: "kw", title: KW_HELP[m[7]] || "" }, m[7]));
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function ability(seg, groups) {
  let rest = seg.replace(/^[\s#\-•*·]+/, ""); const tags = []; let kind = "";
  for (let guard = 0; guard < 6; guard++) {
    const q = rest.replace(/^["“”\s]+/, ""); const w = LEAD.find((k) => q.startsWith(k) && /^(?:["”]|\s|:|\(|\{|$)/.test(q.slice(k.length)));
    if (!w) break; tags.push(w); if (!kind && TYPE[w]) kind = TYPE[w]; rest = q.slice(w.length).replace(/^["”]/, "").replace(/^\s+/, "");
  }
  if (!tags.length && /^#/.test(seg.trim())) kind = "rule";
  rest = rest.replace(/^[:：]\s*/, "");
  // cost / condition before the colon, effect after it
  const k = rest.search(/\s[:：](?:\s|$)/); const head = k > 0 && k < 220 ? rest.slice(0, k) : ""; const body = head ? rest.slice(k).replace(/^\s*[:：]\s*/, "") : rest;
  return h("div", { class: "ab " + kind }, tags.map((t) => h("span", { class: "tg " + (TYPE[t] || "k"), title: KW_HELP[t === "อัติโนมัติ" ? "อัตโนมัติ" : t] || "" }, t)),
    head ? h("span", { class: "hd" }, ...inline(head, groups)) : null, head ? h("span", { class: "co", title: "ก่อนเครื่องหมาย : คือเงื่อนไขหรือค่าใช้จ่าย หลังเครื่องหมายคือผล" }, " ➜ ") : null, ...inline(body, groups));
}
function blocks(text, parent) {
  const { out, groups } = parent ? { out: text, groups: parent } : maskGroups(String(text || ""));
  return out.split(/\n+/).flatMap(splitLine).filter((seg) => seg.replace(/[\s"“”#\-•*·}{]+/g, "")).map((seg) => ability(seg, groups));
}
// cls: extra classes for the box (e.g. "small"); style: inline style such as a max-height
export function fxText(text, cls = "", style = "") {
  let kids; try { kids = blocks(text); } catch (e) { console.warn(e); kids = [String(text || "")]; }
  return h("div", { class: "fx fxl" + (cls ? " " + cls : ""), style }, kids);
}
