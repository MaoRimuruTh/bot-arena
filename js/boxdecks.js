// Official preconstructed decks that the card data gives no per-card counts for: Starter Deck SD08 and SD09, and the
// Kudsan Deck boxes (คัดสรรเด็ค KD01–KD04). Only card numbers and how many of each the box holds, from each box's
// published card list. KD02 and KD03 as published add up to 49 and 48 cards; the missing ones are marked `topUp`
// (a best guess, until the real box is checked).
import { CARDS, baseId, validateDeck, starterDecks, deckEntries } from "./cards.js?v=20261112181700";

const list = (pre, counts) => counts.map((n, k) => [`${pre}-${String(k + 1).padStart(3, "0")}`, n]);
const life = (pre) => [21, 22, 23, 24, 25].map((k) => `${pre}-0${k}`);
export const BOX_LISTS = {
  SD08: { name: "กองทัพตัวจี๊ดหัวใจยึดโลก", theme: "รัททาทุย", ace: "SD08-001", main: list("SD08", [1, 4, 2, 2, 2, 2, 2, 2, 4, 4, 4, 2, 1, 2, 2, 2, 4, 2, 2, 4]), life: life("SD08") },
  SD09: { name: "ลิงกว่านรก", theme: "วานร", ace: "SD09-004", main: list("SD09", [2, 2, 3, 1, 3, 2, 2, 2, 3, 2, 4, 4, 3, 2, 2, 3, 2, 3, 2, 3]), life: life("SD09") },
  KD01: { name: "อวาตาร์ลงทัณฑ์", theme: "พระนารายณ์ · เทพสีแดง", ace: "KD01-001", main: list("KD01", [1, 2, 2, 3, 2, 4, 3, 2, 4, 4, 3, 4, 2, 2, 2, 2, 2, 2, 3, 1]), life: life("KD01") },
  KD02: { name: "พันธสัญญาโลหิต", theme: "ปีศาจ · นายนิรยบาล สายนรก", ace: "KD02-001", main: list("KD02", [1, 2, 2, 3, 2, 3, 4, 2, 2, 4, 4, 1, 2, 2, 2, 2, 1, 2, 4, 4]), life: life("KD02"), topUp: [["KD02-013", 1]] },
  KD03: { name: "มุ่งสู่ฝันเป็นที่ 1", theme: "ไอดอล · แฟนคลับโอตะ", ace: "KD03-001", main: list("KD03", [1, 2, 4, 2, 2, 2, 4, 3, 4, 2, 2, 2, 2, 2, 3, 2, 2, 1, 4, 2]), life: life("KD03"), topUp: [["KD03-004", 1], ["KD03-010", 1]] },
  KD04: { name: "ชะตากรแห่งจุดจบ", theme: "หุ่นนักรบผู้กล้า", ace: "KD04-001", main: list("KD04", [2, 2, 2, 3, 3, 3, 3, 3, 2, 3, 4, 1, 3, 3, 4, 3, 1, 1, 1, 3]), life: life("KD04") },
};

// print code → card id of the base card (reprints share the rules of the card they reprint)
const byPrint = (p) => { const c = CARDS.find((x) => x.p === p); return c ? baseId(c.i) : null; };
function build(pre, z, extra) {
  const main = {}; for (const [p, n] of [...z.main, ...(z.topUp || [])]) { const id = byPrint(p); if (id != null) main[id] = (main[id] || 0) + n; }
  const d = { id: extra.id, name: extra.name, ...(extra.flags.box ? { theme: z.theme } : {}), main, life: z.life.map(byPrint).filter((x) => x != null), ace: [byPrint(z.ace)].filter((x) => x != null), owner: "starter", ownerName: "ทางการ", starter: true, updatedAt: 0, ...extra.flags };
  return validateDeck(d).ok ? d : null;
}
// the starters the card data has no counts for
export const extraStarter = (pre) => (BOX_LISTS[pre] ? build(pre, BOX_LISTS[pre], { id: "starter-" + pre.toLowerCase(), name: `Starter Deck ${pre.slice(2)}`, flags: {} }) : null);
// every official Starter Deck: the ones rebuilt from the counts in the data, then the ones listed here
export function officialStarters() {
  const out = starterDecks(); const have = new Set(out.map((d) => d.id));
  for (const pre of ["SD08", "SD09"]) { if (have.has("starter-" + pre.toLowerCase())) continue; const d = extraStarter(pre); if (d) out.push(d); }
  return out;
}
// how many of a deck's Main Deck cards carry each theme the box-deck achievements ask for (by printed Symbol);
// kept on each finished match as "th", so a deck changed later does not change what was won with it
const THEME_SY = ["เทพ", "นรก", "หุ่นยนต์"];
export function themeCounts(d) {
  const out = {}; if (!d) return out;
  for (const e of deckEntries(d)) { const sy = String(e.c.sy || "").split(/[,\s]+/); for (const k of THEME_SY) if (sy.includes(k)) out[k] = (out[k] || 0) + e.n; }
  return out;
}
// the box's published list falls short of 50: which cards were added to fill it, to show on the deck page
export function topUpNote(d) {
  const z = d && BOX_LISTS[d.box]; if (!z || !z.topUp) return "";
  const listed = z.main.reduce((a, [, n]) => a + n, 0);
  const names = z.topUp.map(([p, n]) => { const c = CARDS.find((x) => x.p === p); return `${c ? c.n : p} +${n}`; }).join(", ");
  return `รายการการ์ดทางการที่เผยแพร่ของกล่องนี้รวมได้ ${listed} ใบ จึงเติมให้ครบ 50 ใบด้วย ${names} ถ้าในกล่องจริงต่างจากนี้ แจ้งปัญหามาได้เลย`;
}
// the Kudsan Deck boxes ("box-kd01" …); whether one is locked is decided by achieve.js (deckLocked)
let cache = null;
export function boxDecks() {
  if (cache && cache.n === CARDS.length) return cache.list;
  const list = ["KD01", "KD02", "KD03", "KD04"].map((pre) => build(pre, BOX_LISTS[pre], { id: "box-" + pre.toLowerCase(), name: `${pre} ${BOX_LISTS[pre].name}`, flags: { box: pre, guess: !!BOX_LISTS[pre].topUp } })).filter(Boolean);
  cache = { n: CARDS.length, list }; return list;
}
