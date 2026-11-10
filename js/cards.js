import { CARD_SOURCE } from "./config.js?v=20261110201727";
import { h } from "./util.js?v=20261110201727";
import { Data } from "./fb.js?v=20261110201727";

export let CARDS = [];
export const TYPE_TH = { A: "Avatar", M: "Magic", C: "Construct", L: "LIFE", T: "Token" };
export const SUB_TH = { N: "Normal", D: "Modification", R: "React", L: "Land" };
export const COLORS = ["แดง", "ฟ้า", "เขียว", "ม่วง"];
const CVAR = { "แดง": "var(--c-red)", "ฟ้า": "var(--c-blue)", "เขียว": "var(--c-green)", "ม่วง": "var(--c-purple)" };
const CHEX = { "แดง": 0xe2554a, "ฟ้า": 0x3d8fe0, "เขียว": 0x3fae68, "ม่วง": 0x9b63d9 };
export const colorOf = (c) => CVAR[c] || "var(--c-none)";
export const colorHex = (c) => CHEX[c] || 0x9aa3b8;
const SET_TH = { SD: "Starter Deck", BT: "Booster", KD: "Kudson Deck", CC: "Community Collection", PRMO: "โปรโม", ODY: "Odyssey", RM: "Remaster", SL: "Special", B2SA: "B2S", B2SB: "B2S", FPRO: "โปรโม", PRE: "Pre-order", APFD: "โปรโม", STOR: "ร้านค้า" };
export const setCode = (c) => c.p.split("-")[0];
export const setName = (c) => { const s = setCode(c); return SET_TH[s] || SET_TH[s.replace(/\d+$/, "")] || s; };
export const kwHas = (t, k) => (t || "").includes(k);

const TYPE = { Avatar: "A", Magic: "M", Construct: "C", Life: "L", Token: "T" };
const SUB = { Normal: "N", Modification: "D", React: "R", Land: "L" };
function transform(raw) {
  // same card = same name and type, and either the same print code or the same text once spacing,
  // line breaks and slashes are ignored (special-art reprints often re-wrap the text)
  const norm = (t) => String(t || "").replace(/[\s\/|]+/g, "").replace(/[“”]/g, '"');
  const groups = new Map(); const byPrint = new Map(); const out = [];
  raw.forEach((c, i) => { const k = c.name + "|" + c.type + "|" + norm(c.mainEffect); const kp = c.name + "|" + c.type + "|" + c.print;
    const g = groups.has(k) ? groups.get(k) : byPrint.has(kp) ? byPrint.get(kp) : i; if (!groups.has(k)) groups.set(k, g); if (!byPrint.has(kp)) byPrint.set(kp, g); raw[i]._g = g; });
  raw.forEach((c, i) => {
    const t = TYPE[c.type] || "A"; const e = { i, n: c.name, t, p: c.print, r: c.rare, x: (c.mainEffect || "").trim() };
    const b = c._g; if (b !== i) e.b = b;
    if (t === "M") { e.st = SUB[c.subtype] || "N"; e.g = c.cost || 0; }
    else { if (c.cost != null) e.c = c.cost; if (c.gem != null) e.g = c.gem; if (c.power != null) e.pw = c.power; }
    if (c.symbol) e.sy = c.symbol; if (c.color) e.co = c.color; if (c.gemColor) e.gc = c.gemColor; if (c.customLimit) e.lim = c.customLimit;
    if (c.soi != null) e.so = c.soi; if (c.dropRate) e.dr = c.dropRate; if (c.creator) e.ar = c.creator;
    if (c.ex === "Only #1") e.o1 = 1; else if (c.ex === "โดนใจ") e.fl = "dj"; else if (c.ex === "ลำเอียง") e.fl = "le"; else if (c.ex) e.ex = c.ex;
    out.push(e);
  });
  return out;
}
export async function loadCards() {
  const url = (Data.meta && Data.meta.cardsUrl) || CARD_SOURCE.dataUrl;
  const r = await fetch(url, { cache: "default" });
  if (!r.ok) throw new Error("card data " + r.status);
  CARDS = transform(await r.json());
  CARDS.byName = new Map(); keyIndex = null;
  for (const c of CARDS) { if (!CARDS.byName.has(c.n)) CARDS.byName.set(c.n, []); CARDS.byName.get(c.n).push(c); }
  if (Data.refreshSkins) Data.refreshSkins(); // saved skins are stored by print code: map them onto this card list
  return CARDS;
}
export const card = (i) => CARDS[+i];
export const baseId = (i) => { const c = CARDS[+i]; return c && c.b != null ? c.b : +i; };
export const isBase = (c) => c.b == null;
export const limitOf = (c) => (c.o1 ? 1 : c.lim || 4);

// ----- art (loaded live from the official CDN) -----
export function imgUrls(c) {
  const folders = { ...CARD_SOURCE.folders, ...((Data.meta && Data.meta.folders) || {}) };
  const f = folders[setCode(c)] || ""; const b = (Data.meta && Data.meta.imgBase) || CARD_SOURCE.imgBase;
  return [`${b}${f}${c.p}-${c.r}.png`, `${b}${f}${c.p}.png`, `${b}${c.p}-${c.r}.png`, `${b}${c.p}.png`];
}
// stable keys for saved skins: print code + rarity of the base card → print code + rarity of the chosen art
let keyIndex = null;
const byKey = (k) => { if (!keyIndex) { keyIndex = new Map(); for (const c of CARDS) keyIndex.set(c.p + "-" + c.r, c); } return keyIndex.get(k); };
Data.skinCodec = {
  ready: () => CARDS.length > 0,
  encode: (map) => { const out = {}; for (const [b, v] of Object.entries(map || {})) { const B = CARDS[+b], V = CARDS[+v]; if (B && V) out[B.p + "-" + B.r] = V.p + "-" + V.r; } return out; },
  decode: (prints) => { const out = {}; for (const [kb, kv] of Object.entries(prints || {})) { const B = byKey(kb), V = byKey(kv); if (!B || !V) continue; const base = B.b != null ? B.b : B.i; if ((V.b != null ? V.b : V.i) !== base || V.i === base) continue; out[String(base)] = V.i; } return out; },
};
// skins: the player can pick any alternate print of a card as the art shown everywhere
export const SkinCtx = { on: true }; // skins show only on the deck pages and in the arena (set by the router)
export function skinOf(c) { if (!c || c.b != null || !SkinCtx.on) return c; const v = Data.skins && Data.skins[String(c.i)]; const s = v != null ? CARDS[+v] : null; return s && (s.b === c.i || s.i === c.i) ? s : c; }
export const variantsOf = (c) => { const b = c.b != null ? c.b : c.i; return CARDS.filter((x) => x.i === b || x.b === b); };
export const favKey = (c) => c.p + "-" + c.r;
// latest noted price of exactly this print+rarity: { p, at, src } or null
export const priceOf = (c) => { const e = c && Data.prices && Data.prices[favKey(c)]; return e && e.h && e.h.length ? e.h[e.h.length - 1] : null; };
// best known price for a card when buying it: this print first, else the cheapest noted print of the same card
export function buyPrice(c) { const own = priceOf(c); if (own) return { ...own, c }; let best = null; for (const v of variantsOf(c)) { const p = priceOf(v); if (p && (!best || p.p < best.p)) best = { ...p, c: v }; } return best; }
export const isFav = (c) => !!(c && Data.favs && Data.favs[favKey(c)]);
export const favCards = () => Object.keys((Data && Data.favs) || {}).map((k) => CARDS.find((c) => favKey(c) === k)).filter(Boolean);
export const isSpecialArt = (c) => c.b != null || ["SCR", "CBR", "USEC"].includes(c.r);
const goodUrl = new Map();
export function artUrl(c) { return goodUrl.get(c.i) || imgUrls(c)[0]; }
export function artImg(c, cls = "cimg", alt) {
  c = skinOf(c); const urls = imgUrls(c); let k = urls.indexOf(goodUrl.get(c.i)); if (k < 0) k = 0;
  const img = h("img", { class: cls, src: urls[k], alt: alt ?? c.n, loading: "lazy", decoding: "async", draggable: "false" });
  img.addEventListener("load", () => goodUrl.set(c.i, img.src));
  img.addEventListener("error", () => { k++; if (k < urls.length) img.src = urls[k]; });
  return img;
}
export function resolveArt(c) {
  c = skinOf(c);
  if (goodUrl.has(c.i)) return Promise.resolve(goodUrl.get(c.i));
  const urls = imgUrls(c);
  return new Promise((res) => {
    let k = 0; const im = new Image(); // plain probe; the 3D view loads a separate CORS copy (see corsUrl)
    im.onload = () => { goodUrl.set(c.i, urls[k]); res(urls[k]); };
    im.onerror = () => { k++; if (k < urls.length) im.src = urls[k]; else res(null); };
    im.src = urls[0];
  });
}

// The CDN only sends CORS headers when asked and does not Vary on Origin, so a
// cached plain <img> response would break WebGL textures; use a separate cache key.
export const corsUrl = (u) => u + (u.includes("?") ? "&" : "?") + "cors=1";
export function cardLine(c, max = 160) {
  const parts = [TYPE_TH[c.t] + (c.st ? "/" + SUB_TH[c.st] : "")];
  if (c.co) parts.push("สี" + c.co); if (c.c != null) parts.push("Cost " + c.c); if (c.g != null) parts.push("GEM " + c.g + (c.gc ? "(" + c.gc + ")" : ""));
  if (c.pw != null) parts.push("POWER " + c.pw); if (c.sy) parts.push("Symbol " + c.sy); if (c.o1) parts.push("Only#1");
  const x = (c.x || "").replace(/\s+/g, " ");
  return `${c.n} [${parts.join(" · ")}]${x ? " : " + (x.length > max ? x.slice(0, max) + "…" : x) : ""}`;
}

// ----- decks -----
export const deckCount = (d) => Object.values(d.main || {}).reduce((a, b) => a + b, 0);
export const deckEntries = (d) => Object.entries(d.main || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ c: card(id), n, id: +id })).filter((e) => e.c);
export function validateDeck(d) {
  const out = []; const ents = deckEntries(d); const total = deckCount(d);
  out.push({ ok: total === 50, msg: `Main Deck ${total}/50 ใบ` });
  const byName = {};
  for (const e of ents) { byName[e.c.n] = byName[e.c.n] || { n: 0, lim: limitOf(e.c) }; byName[e.c.n].n += e.n; byName[e.c.n].lim = Math.max(byName[e.c.n].lim, limitOf(e.c)); }
  const over = Object.entries(byName).filter(([, v]) => v.n > v.lim);
  out.push({ ok: !over.length, msg: over.length ? "เกินจำนวนต่อชื่อ: " + over.map(([k, v]) => `${k} ${v.n}/${v.lim}`).join(", ") : "ชื่อเดียวกันไม่เกินจำนวนที่กำหนด" });
  const o1 = ents.filter((e) => e.c.o1).reduce((a, e) => a + e.n, 0);
  out.push({ ok: o1 === 1, msg: o1 === 1 ? "มี Only #1 พอดี 1 ใบ" : `Only #1 ต้องมีพอดี 1 ใบ (ตอนนี้ ${o1})` });
  const bad = ents.filter((e) => e.c.t === "L" || e.c.t === "T");
  if (bad.length) out.push({ ok: false, msg: "LIFE/Token ใส่ใน Main Deck ไม่ได้" });
  const life = (d.life || []).map(card).filter(Boolean); const ln = new Set(life.map((c) => c.n));
  out.push({ ok: life.length === 5 && ln.size === 5 && life.every((c) => c.t === "L"), msg: `LIFE ${life.length}/5 ใบ` + (ln.size < life.length ? " (ชื่อซ้ำ)" : "") });
  if (ents.some((e) => e.c.fl === "le")) out.push({ ok: true, warn: true, msg: "มีการ์ดลำเอียง ใช้แข่งงานทางการไม่ได้" });
  return { ok: out.every((x) => x.ok), items: out };
}
export function deckStats(d) {
  const ents = deckEntries(d); const curve = Array.from({ length: 9 }, () => ({})); const colors = {}; const types = {}; let gem = 0, pw = 0, pwN = 0;
  for (const { c, n } of ents) {
    const co = c.co || "ไร้สี";
    if (c.c != null && c.t !== "M") { const k = Math.min(8, c.c); curve[k][co] = (curve[k][co] || 0) + n; }
    colors[co] = (colors[co] || 0) + n;
    const tk = c.t === "M" ? "Magic" : TYPE_TH[c.t]; types[tk] = (types[tk] || 0) + n;
    gem += (c.g || 0) * n; if (c.pw != null) { pw += c.pw * n; pwN += n; }
  }
  return { curve, colors, types, gem, avgPw: pwN ? pw / pwN : 0, total: deckCount(d) };
}
export const deckAce = (d) => (d.ace && d.ace.length ? card(d.ace[0]) : null) || (deckEntries(d).sort((a, b) => (b.c.pw || 0) - (a.c.pw || 0))[0] || {}).c;
export function deckToList(d) { const main = []; for (const e of deckEntries(d)) for (let k = 0; k < e.n; k++) main.push(e.id); return { main, life: (d.life || []).map(Number) }; }
export const ownedOf = (id) => Data.owned[String(baseId(id))] || 0;
export function shoppingList(d) {
  const need = {};
  for (const e of deckEntries(d)) { const k = baseId(e.id); need[k] = (need[k] || 0) + e.n; }
  for (const id of d.life || []) { const k = baseId(id); need[k] = (need[k] || 0) + 1; }
  return Object.entries(need).map(([k, n]) => ({ c: card(k), need: n, have: ownedOf(k), miss: Math.max(0, n - ownedOf(k)) }));
}
// official starter decks rebuilt from per-box counts in the data
export function starterDecks() {
  const out = [];
  for (const pre of ["SD01", "SD02", "SD03", "SD04", "SD05", "SD06", "SD07", "SD08", "SD09"]) {
    const list = CARDS.filter((c) => c.p.startsWith(pre + "-") && isBase(c));
    const main = {}; const life = [];
    for (const c of list) { const n = parseInt(c.dr, 10); if (!n) continue; if (c.t === "L") life.push(c.i); else if (c.t !== "T") main[c.i] = n; }
    const d = { id: "starter-" + pre.toLowerCase(), name: `Starter Deck ${pre.slice(2)}`, owner: "starter", ownerName: "ทางการ", main, life, ace: [], starter: true, updatedAt: 0 };
    if (validateDeck(d).ok) out.push(d);
  }
  return out;
}
