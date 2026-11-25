// คู่มือเด็คแบบภาพ: a deck's three-phase plan (ต้นเกม / กลางเกม / ปลายเกม) laid out as small tables of card pictures.
// Each phase line is read as steps: "·" separates things done side by side, "→" is "then". In each step the cards of
// the deck it names are found by name (full name, or a distinctive word of it), so the player sees the combo as the
// cards themselves lying on a tilted table, with the line of text under it. A step that names no card shows its words.
import { h, openSheet } from "./util.js?v=20261125124344";
import { card, deckEntries } from "./cards.js?v=20261125124344";
import { cardBtn, showCard } from "./ui.js?v=20261125124344";

const PHASES = [["ต้นเกม", "เปิดเกม วางของ"], ["กลางเกม", "เดินคอมโบหลัก"], ["ปลายเกม", "ปิดเกม บุก LIFE"]];
// a plan calls cards by a part of their name ("นักรบทอง", "หงอคง", "ดยุก"), so a step names a card when the longest run
// of letters it shares with that card's name is long enough, belongs to that card alone in the deck, and is a real
// piece of the name: the start of a word of it, half of that word or more, or 6+ letters. Common Thai words and runs
// that start inside a syllable never count. A few nicknames have no shared run at all: ALIAS gives them their card.
const NONINIT = new Set([..."ะัาำิีึืฺุู็่้๊๋์ๆฯ"]);
const STOPW = ["ความ", "การ", "แล้ว", "เรียก", "จาก", "ที่", "ของ", "ไม่", "ได้", "อีก", "ทุก", "ตัว", "สั่ง", "ทิ้ง", "ขึ้น", "เอา", "ใช้", "ทำลาย", "อัญเชิญ", "สอดแนม", "ต่อ", "ใบ"];
const ALIAS = { ราชา: "ราชันย์", หยิน: "ตั๊กแตนหยิน", หยาง: "ตั๊กแตนหยาง", หญิง: "ตั๊กแตนหญิง" };
const partsOf = (n) => n.split(/[\s:：,()\-–!！.]+/).filter(Boolean);
function lcs(a, b) { let best = 0, end = 0; const m = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = m[j]; m[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0; if (m[j] > best) { best = m[j]; end = i; } prev = tmp; } }
  return a.slice(end - best, end); }
function names(text, all) {
  const t = text.trim(); if (t.length < 4 || NONINIT.has(t[0]) || STOPW.some((w) => w === t || w.startsWith(t))) return false;
  const hold = all.filter((n) => n.includes(t)); if (hold.length !== 1 && !all.includes(t)) return false;
  const ps = partsOf(hold[0] || t).filter((p) => p.includes(t)); if (!ps.length) return true; const p = ps.reduce((a, b) => (b.length < a.length ? b : a));
  return p.startsWith(t) || t.length / p.length >= 0.5 || t.length >= 6;
}

// the deck's cards that a step of text names, in the order the text names them (a card once per step)
function cardsIn(text, pool) {
  const all = pool.map((e) => e.c.n), hits = [];
  for (const [nick, part] of Object.entries(ALIAS)) { const at = text.indexOf(nick); if (at < 0 || text.includes(part)) continue; const e = pool.find((x) => x.c.n.includes(part)); if (e) hits.push({ ...e, at }); }
  for (const e of pool) { const sub = lcs(text, e.c.n); if (names(sub, all)) hits.push({ ...e, at: text.indexOf(sub) }); }
  hits.sort((a, b) => a.at - b.at); const out = []; for (const x of hits) if (!out.some((y) => y.id === x.id || Math.abs(y.at - x.at) < 2)) out.push(x); return out.slice(0, 4);
}

// the plan's phase lines: [{ label, text }] — any line "xxx: …" with a short label, the three phases first
export function planPhases(plan) {
  const out = []; for (const raw of String(plan || "").split("\n")) { const m = raw.match(/^\s*([^:：]{2,14})[:：]\s*(.+)$/); if (m) out.push({ label: m[1].trim(), text: m[2].trim() }); }
  return out;
}

export function hasGuide(d) { return planPhases(d && d.plan).length > 0; }

export function openGuide(d) {
  const ents = deckEntries(d); const pool = [];
  const add = (id, n, tag) => { const c = card(id); if (c && !pool.some((e) => e.c.n === c.n)) pool.push({ id: +id, c, n, tag }); };
  for (const e of ents) add(e.id, e.n, null); for (const i of d.life || []) add(i, 1, "LIFE"); for (const i of d.ace || []) add(i, 0, "เอซ");
  const phases = planPhases(d.plan);
  const step = (t) => { const cs = cardsIn(t, pool);
    return h("div", { class: "gstep" + (cs.length ? "" : " words") },
      cs.length ? h("div", { class: "gcards" }, cs.map((e, k) => h("div", { class: "gcard", style: `--k:${k}` }, cardBtn(e.id, { badge: e.tag || (e.n ? "×" + e.n : ""), onclick: () => showCard(e.id) })))) : h("div", { class: "gword" }, t),
      cs.length ? h("div", { class: "gcap" }, t) : null); };
  const table = (text) => h("div", { class: "gtable" }, h("div", { class: "gfelt" },
    ...text.split(/\s+·\s+/).flatMap((cl, i) => [i ? h("span", { class: "gsep", "aria-hidden": "true" }) : null,
      h("div", { class: "gclause" }, ...cl.split(/\s*→\s*/).flatMap((st, j) => [j ? h("span", { class: "garrow", "aria-label": "แล้ว" }, "→") : null, step(st)]))])));
  openSheet((api) => [
    h("p", { class: "small muted", style: "margin:0" }, "แต่ละช่วงวางการ์ดตามลำดับคอมโบ: ลูกศร → คือทำต่อ จุด · คั่นสิ่งที่ทำได้คู่กัน แตะการ์ดเพื่อดูรายละเอียด"),
    ...phases.map((ph, k) => { const known = PHASES.find(([n]) => n === ph.label);
      return h("section", { class: "gphase" }, h("div", { class: "row", style: "gap:8px;align-items:baseline" }, h("span", { class: "gnum" }, String(k + 1)), h("b", null, ph.label), known ? h("span", { class: "tiny muted" }, known[1]) : null),
        table(ph.text)); }),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => api.close() }, "ปิด"))], { title: "คู่มือเด็ค: " + (d.name || ""), wide: true });
}
