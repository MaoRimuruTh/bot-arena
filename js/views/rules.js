// กฎและคำศัพท์: what the words on the cards mean (written in our own words from the official Rule Book 3.2), and a search over
// every official FAQ answer, read live from the CDN like the card sheet does (nothing of it is stored here). #rules/k/<word>
// opens one word; #rules/q/<text> runs a search, so a word in any card text can link straight to its rulings.
import { h, busy } from "../util.js?v=20261115013301";
import { Views, showCard } from "../ui.js?v=20261115013301";
import { CARDS, artImg, isBase } from "../cards.js?v=20261115013301";
import { GLOSS, GROUPS, glossEntry, faqSearch, marked, RULEBOOK_URL, FAQ_PAGE } from "../glossary.js?v=20261115013301";

let group = "all", query = "", shown = 30;
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
const cardOf = (name) => { const list = (CARDS.byName && CARDS.byName.get(name)) || CARDS.filter((c) => norm(c.n) === norm(name)); return list.find(isBase) || list[0] || null; };
function glossList(root, focus) {
  const seg = h("div", { class: "seg gl-seg", role: "group", "aria-label": "หมวดคำศัพท์" }, [["all", "ทั้งหมด"], ...GROUPS].map(([k, t]) => h("button", { "aria-pressed": String(group === k), onclick: () => { group = k; Views.rules.render(root); } }, t)));
  const q = norm(query);
  const es = GLOSS.filter((e) => (group === "all" || e.g === group) && (!q || norm(e.k + " " + (e.al || []).join(" ") + " " + e.s + " " + e.l).includes(q)));
  const blocks = GROUPS.map(([g, title]) => { const list = es.filter((e) => e.g === g); if (!list.length) return null;
    return h("section", { class: "gl-group" }, h("h2", null, title), h("div", { class: "gl-grid" }, list.map((e) => {
      const d = h("details", { class: "gl-item panel" + (focus && e.k === focus ? " on" : ""), id: "gl-" + encodeURIComponent(e.k), open: focus === e.k || (q && list.length <= 4) ? true : null },
        h("summary", null, h("b", null, e.k), h("span", { class: "small muted" }, e.s)), glossEntry(e, { onFaq: (k) => { location.hash = "#rules/q/" + encodeURIComponent(k); } }));
      return d; }))); }).filter(Boolean);
  return [seg, ...(blocks.length ? blocks : [h("div", { class: "muted small" }, "ไม่พบคำนี้ในคำศัพท์")])];
}
function faqResults(root, box) {
  const q = norm(query); if (q.length < 2) { box.replaceChildren(h("div", { class: "muted small" }, "พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นใน FAQ ทางการทั้งหมด (ชื่อการ์ด คำถาม หรือคำตอบ)")); return; }
  box.replaceChildren(busy("กำลังค้นใน FAQ…"));
  const asked = query;
  faqSearch(q, 600).then((hits) => {
    if (asked !== query || !box.isConnected) return;
    const by = new Map(); for (const x of hits) { if (!by.has(x.name)) by.set(x.name, []); by.get(x.name).push(x.q); }
    const groups = [...by.entries()].sort((a, b) => (norm(b[0]).includes(q) ? 1 : 0) - (norm(a[0]).includes(q) ? 1 : 0) || b[1].length - a[1].length);
    if (!groups.length) { box.replaceChildren(h("div", { class: "muted small" }, `ไม่พบ "${query}" ใน FAQ`)); return; }
    box.replaceChildren(
      h("div", { class: "small muted" }, `พบ ${hits.length >= 600 ? "600+" : hits.length} คำตอบ จากการ์ด ${groups.length} ใบ`),
      ...groups.slice(0, shown).map(([name, qs]) => { const c = cardOf(name);
        return h("article", { class: "faqhit panel" },
          c ? h("button", { class: "faqhit-img", "aria-label": "ดูการ์ด " + name, onclick: () => showCard(c.i) }, artImg(c, "cimg")) : h("div", { class: "faqhit-img none", "aria-hidden": "true" }),
          h("div", { class: "faqhit-body" }, h("h3", null, ...marked(name, q)),
            qs.slice(0, 6).map((x) => h("div", { class: "faq-q" }, h("div", { class: "small" }, h("b", null, "ถาม "), ...marked(x.question, q)), h("div", { class: "small" }, h("b", null, "ตอบ "), ...marked(x.answer || "-", q)))),
            qs.length > 6 ? h("div", { class: "tiny muted" }, `และอีก ${qs.length - 6} ข้อ (เปิดการ์ดเพื่อดูทั้งหมด)`) : null)); }),
      groups.length > shown ? h("button", { class: "btn sm", onclick: () => { shown += 30; faqResults(root, box); } }, `แสดงเพิ่ม (เหลือ ${groups.length - shown} ใบ)`) : null,
      h("a", { class: "tiny", href: FAQ_PAGE, target: "_blank", rel: "noopener noreferrer" }, "ที่มา: คำถามที่พบบ่อย bottcg.com ↗"));
  }).catch(() => { if (box.isConnected) box.replaceChildren(h("div", { class: "row small" }, h("span", { class: "muted" }, "โหลด FAQ ไม่ได้"), h("button", { class: "btn sm", onclick: () => faqResults(root, box) }, "ลองใหม่"))); });
}
Views.rules = {
  render(root, parts = []) {
    let focus = null;
    if (parts[0] === "k" && parts[1]) { focus = decodeURIComponent(parts[1]); query = ""; group = "all"; }
    else if (parts[0] === "q" && parts[1] != null) { const q = decodeURIComponent(parts[1] || ""); if (q !== query) shown = 30; query = q; }
    const faqBox = h("div", { class: "stack faqhits", "aria-live": "polite" });
    const glossBox = h("div", { class: "stack" });
    let t = 0;
    const inp = h("input", { type: "search", class: "gl-search", value: query, placeholder: "ค้นคำศัพท์หรือ FAQ เช่น จุติ, สอดแนม, ชื่อการ์ด", "aria-label": "ค้นหาคำศัพท์และ FAQ", enterkeyhint: "search" });
    const faqSec = h("section", { class: "gl-faq", hidden: !query }, h("h2", null, "คำตอบจาก FAQ ทางการ"), faqBox);
    const run = () => { query = inp.value; shown = 30; try { history.replaceState(null, "", query ? "#rules/q/" + encodeURIComponent(query) : "#rules"); } catch {} faqSec.hidden = !norm(query); glossBox.replaceChildren(...glossList(root, null)); faqResults(root, faqBox); };
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 220); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(t); run(); } });
    root.replaceChildren(
      h("div", { class: "pagehead" }, h("div", null, h("h1", null, "กฎและคำศัพท์"),
        h("div", { class: "muted small" }, "คำอธิบายเขียนใหม่จาก Rule Book 3.2 ส่วนคำถามคำตอบมาจาก FAQ ทางการ โหลดสดจาก bottcg.com ทุกครั้ง"))),
      h("div", { class: "gl-bar" }, inp, h("a", { class: "btn sm", href: RULEBOOK_URL, target: "_blank", rel: "noopener noreferrer" }, "Rule Book ฉบับเต็ม ↗")),
      h("div", { class: "tiny muted" }, "แตะคำที่เป็นตัวหนาในข้อความการ์ด (ในคลังการ์ดหรือในเกม) เพื่อเปิดคำอธิบายของคำนั้นได้ทันที"),
      glossBox, faqSec);
    glossBox.replaceChildren(...glossList(root, focus));
    if (query) faqResults(root, faqBox);
    if (focus) requestAnimationFrame(() => { const el = document.getElementById("gl-" + encodeURIComponent(focus)); if (el) { el.open = true; el.scrollIntoView({ block: "center" }); } });
  },
};
