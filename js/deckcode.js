// Sharing decks as a short code or a plain list, and reading either back.
// Cards are named by print code (e.g. SD01-001), which stays the same when the card data is updated.
import { CARDS, card, baseId, isBase, deckEntries, TYPE_TH } from "./cards.js?v=20261114181128";

const CODE_HEAD = "BoT1";
const printOf = (id) => { const c = card(baseId(id)); return c ? c.p : null; };
// "SD01-001" -> ["SD01", "001"]; some prints carry extra parts ("PRMO-153-A"), which stay in the second half
const splitPrint = (p) => { const k = p.indexOf("-"); return k < 0 ? [p, ""] : [p.slice(0, k), p.slice(k + 1)]; };

// BoT1|SD01:001*3,002|BT03:012*2|L|SD01:021,022 — main deck grouped by set, then the LIFE cards
export function deckCode(d) {
  const group = (items) => {
    const by = new Map();
    for (const { p, n } of items) { const [set, num] = splitPrint(p); if (!by.has(set)) by.set(set, []); by.get(set).push(num + (n > 1 ? "*" + n : "")); }
    return [...by].map(([set, nums]) => set + ":" + nums.join(",")).join("|");
  };
  const main = deckEntries(d).map((e) => ({ p: printOf(e.id), n: e.n })).filter((x) => x.p);
  const life = (d.life || []).map((i) => ({ p: printOf(i), n: 1 })).filter((x) => x.p);
  return [CODE_HEAD, group(main), life.length ? "L|" + group(life) : ""].filter(Boolean).join("|");
}

// one line per card, readable in a chat: "3 พระอิศวร [SD01-001]"
export function deckText(d) {
  const line = (id, n) => { const c = card(id); return c ? `${n} ${c.n} [${c.p}]` : null; };
  const main = deckEntries(d).sort((a, b) => (a.c.t === b.c.t ? (a.c.c ?? 99) - (b.c.c ?? 99) : a.c.t.localeCompare(b.c.t))).map((e) => line(e.id, e.n));
  return [`# ${d.name || "เด็ค"}`, ...main, "", `LIFE (${(d.life || []).length})`, ...(d.life || []).map((i) => line(i, 1))].filter((x) => x != null).join("\n");
}

const norm = (s) => String(s || "").toLowerCase().replace(/[\s​]+/g, "").replace(/[!！?？.,'"“”‘’()（）\-–—_:;]/g, "");
let byNorm = null;
function nameIndex() { if (byNorm && byNorm.size) return byNorm; byNorm = new Map(); for (const c of CARDS) { const k = norm(c.n); if (!byNorm.has(k)) byNorm.set(k, []); byNorm.get(k).push(c); } return byNorm; }
// the playable card behind a print code (the first base version printed with it)
function byPrint(p) {
  const P = String(p).toUpperCase(); const all = CARDS.filter((c) => c.p === P); if (!all.length) return null;
  return all.find(isBase) || card(baseId(all[0].i));
}
// a print code as people write it: maybe with the rarity after it, the way other sites list cards ("BT01-040-C",
// "BT01-038-SR"), or with a part that belongs to the code itself ("PRMO-153-A"); the whole thing is tried as a code
// first, then the code without that last part
const PRINT_RE = /\b([A-Z][A-Z0-9]{2,4}-[0-9A-Z]{2,4})(?:-([0-9A-Z]{1,4}))?\b/i;
export function printCard(code) { const m = String(code || "").trim().match(PRINT_RE); return m ? (m[2] && byPrint(m[1] + "-" + m[2])) || byPrint(m[1]) : null; }
// versions of a name that play differently (same name, different text); alternate arts of one card count once
function versionsOf(name) {
  const vs = (CARDS.byName.get(name) || nameIndex().get(norm(name)) || []).filter(isBase); const seen = new Map();
  for (const c of vs) { const k = c.t + "|" + c.x; if (!seen.has(k)) seen.set(k, c); }
  return [...seen.values()];
}

// reads a deck code or a pasted list; returns what it found, lines it could not read, and names that need a choice
export function parseDeck(text) {
  const items = [], miss = [], amb = []; const src = String(text || "").trim();
  const found = src.match(new RegExp(CODE_HEAD + "\\|[^\\s]+")); // a code anywhere in the text, e.g. pasted with a message around it
  if (found) {
    let set = null;
    for (const part of found[0].split("|").slice(1)) {
      if (part === "L") continue; // LIFE cards follow; they are recognised by their type when added
      const k = part.indexOf(":"); if (k < 0) { miss.push(part); continue; }
      set = part.slice(0, k);
      for (const tok of part.slice(k + 1).split(",").filter(Boolean)) {
        const [num, cnt] = tok.split("*"); const c = byPrint(set + "-" + num);
        if (c) items.push({ c, n: Math.max(1, +cnt || 1) }); else miss.push(set + "-" + num);
      }
    }
    return { items, miss, amb, code: true };
  }
  for (let raw of src.split(/\r?\n/)) {
    raw = raw.trim(); if (!raw || /^#/.test(raw) || /^(life|ไลฟ์|main|เด็คหลัก|deck)\b/i.test(raw.replace(/[\s:：(（].*$/, ""))) continue;
    let n = 1, rest = raw; let m;
    if ((m = rest.match(/^(\d+)\s*[x×*]?\s+(.+)$/i))) { n = +m[1]; rest = m[2]; }
    else if ((m = rest.match(/^(.+?)\s*[x×*]\s*(\d+)$/i))) { n = +m[2]; rest = m[1]; }
    const pm = rest.match(PRINT_RE);
    let c = pm ? printCard(pm[0]) : null;
    const name = rest.replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(pm ? pm[0] : "\u0000", "").trim();
    if (!c && name) { const vs = versionsOf(name); if (vs.length === 1) c = vs[0]; else if (vs.length > 1) { amb.push({ name, n, vers: vs }); continue; } }
    if (c) items.push({ c, n: Math.max(1, Math.min(n, 50)) }); else miss.push(raw);
  }
  return { items, miss, amb, code: false };
}
export const typeLabel = (c) => TYPE_TH[c.t] || "";
