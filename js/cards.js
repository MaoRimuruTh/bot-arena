import { CARD_SOURCE } from "./config.js?v=20261112135937";
import { h } from "./util.js?v=20261112135937";
import { Data } from "./fb.js?v=20261112135937";

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
// A keyword belongs to the card only where it stands as a keyword: at the start of the text or of a line, or right
// after another keyword of its own (with or without reminder text). "ได้รับ โล่มนุษย์", "อัญเชิญ จุติ …" or
// "Avatar ที่มี สามัคคี" only mention the keyword; they do not give it to the card that says so.
const KW_ALL = ["โล่มนุษย์", "ลูกฮึด", "สามัคคี", "เตะไข่", "แทงหลัง", "จุติ", "คำสั่งเสีย", "พอดี"];
const KW_REF = /(?:ได้รับ|ความสามารถ|อัญเชิญ|แบบ|และ|หรือ|มี|รับ|ของ|ใช้|เป็น|ด้วย|,)$/;
const KW_TRIG = new Set(["จุติ", "คำสั่งเสีย"]);
// is position i inside a {red …} block? Those hold reminder text or an ability granted to something else, never the card's own
const redClose = (t, a) => { let d = 0; for (let j = a; j < t.length; j++) { if (t[j] === "{") d++; else if (t[j] === "}" && --d === 0) return j; } return t.length; };
export const inRed = (t, i) => { for (let a = t.lastIndexOf("{red", i); a >= 0; a = a > 0 ? t.lastIndexOf("{red", a - 1) : -1) if (redClose(t, a) > i) return true; return false; };
function ownKw(t, i, k, depth) {
  if (inRed(t, i)) return false;
  const p = t.slice(0, i); const tail = (p.match(/[\s"“”'#\-•*·]*$/) || [""])[0]; let core = p.slice(0, p.length - tail.length);
  if (!core) return true;
  if (tail.includes("\n") && !KW_REF.test(core)) return true;
  // the keyword before it (skipping that keyword's reminder text) decides
  const bare = core.replace(/\{red\s*\([^{}]*\)\s*\}$/, "").replace(/\([^()]*\)$/, "").replace(/[\s"“”']+$/, "");
  for (const w of KW_ALL) if (bare.endsWith(w)) return depth < 6 && ownKw(t, bare.length - w.length, w, depth + 1);
  // "… POWER +1 คำสั่งเสีย : …" written on one line
  return KW_TRIG.has(k) && !KW_REF.test(core) && /^\s*(?:[:：(]|\{red\s*\()/.test(t.slice(i + k.length));
}
export function kwHas(t, k) { t = String(t || ""); for (let i = t.indexOf(k); i >= 0; i = t.indexOf(k, i + 1)) if (ownKw(t, i, k, 0)) return true; return false; }

const TYPE = { Avatar: "A", Magic: "M", Construct: "C", Life: "L", Token: "T" };
const SUB = { Normal: "N", Modification: "D", React: "R", Land: "L" };
// Subtypes that are wrong in the official data: the card text (and reprints of the same card) show the real one
const DATA_FIX = { "SD05-014": { st: "L" }, "SD05-020": { st: "R" }, "SD06-014": { st: "R" }, "ODY1-064": { st: "R" } };

// ---------- names, Symbols and colours a card counts as ----------
// "#Avatar ใบนี้ถือว่ามีชื่อ "รถถัง"" · "#การ์ดใบนี้นับเป็นชื่อ บึงทมิฬ" · "#Avatar ใบนี้ นับว่าเป็น {Symbol สัตว์} ด้วย" ·
// "#Avatar ใบนี้ถือว่าเป็น Avatar สีม่วง ด้วย" · "ต่อเนื่อง ตราบเท่าที่ Avatar ใบนี้อยู่ในสนาม จะนับว่าเป็น "บึงทมิฬ People" ด้วย" (F = only on the field)
const sp1 = (t) => String(t || "").replace(/\s+/g, " ").trim();
const FIELD_RULE = /^ต่อเนื่อง\s*ตราบเท่า(?:ที่)?\s*(?:Avatar|การ์ด)?\s*(?:ใบนี้)?\s*อยู่\s*(?:บน|ใน)\s*(?:Avatar Zone|สนาม)\s*/;
export function aliasOf(text) {
  const al = {}; const add = (k, v) => { v = sp1(v); if (v && !(al[k] = al[k] || []).includes(v)) al[k].push(v); };
  for (const seg of String(text || "").split(/\n|(?=#)/)) {
    const l = sp1(seg); const hash = /^#/.test(l); const field = FIELD_RULE.test(l); if (!hash && !field) continue;
    const body = field ? l.replace(FIELD_RULE, "") : l; if (/ถ้า|หาก|เมื่อ|จนกว่า|Gem|GEM|Cost|ใส่การ์ด|ในเด็ค|ใน Deck/.test(body)) continue;
    const F = field ? "F" : ""; let m;
    // (a closing quote is sometimes missing at the very end of the text)
    if ((m = body.match(/(?:ถือว่ามีชื่อ(?:ว่า)?|นับเป็นชื่อ|นับว่าเป็นชื่อ|นับว่าเป็น|ถือว่าเป็น)\s*((?:["“'‘][^"”'’]+(?:["”'’]|$)\s*(?:และ|,|หรือ)?\s*)+)/))) for (const q of m[1].matchAll(/["“'‘]([^"”'’]+)(?:["”'’]|$)/g)) add("an" + F, q[1]);
    else if ((m = body.match(/(?:ถือว่ามีชื่อ(?:ว่า)?|นับเป็นชื่อ|นับว่าเป็นชื่อ)\s+([^"“{\s][^#]*?)\s*(?:ด้วย)?\s*$/))) add("an" + F, m[1]);
    for (const q of body.matchAll(/(?:นับเป็น|นับว่าเป็น|ถือว่าเป็น)\s*(?:Avatar\s*)?\{\s*[Ss]ymbol\s*:?\s*([^}]+?)\s*\}/g)) add("asy" + F, q[1]);
    if ((m = body.match(/นับเป็น\s*Symbol\s+([^\s{}]+)/))) add("asy" + F, m[1]);
    if (/นับเป็นทุก\s*Symbol/.test(body)) al["allSy" + F] = true;
    for (const q of body.matchAll(/(?:ถือว่าเป็น|นับว่าเป็น|นับเป็น)\s*(?:Avatar\s*)?สี(แดง|ฟ้า|เขียว|ม่วง)/g)) add("aco" + F, q[1]);
    if (/ถือเป็น\s*Avatar\s*ทุกสี/.test(body)) al["allCo" + F] = true;
  }
  return Object.keys(al).length ? al : null;
}
// matching helpers (on = the card is on the field, where "while on the field" rules count too)
export const nameText = (d, on) => { const a = d && d.al; return sp1([d && d.n, ...((a && a.an) || []), ...((on && a && a.anF) || [])].filter(Boolean).join(" | ")); };
export const syText = (d, on) => { const a = d && d.al; return [d && d.sy, ...((a && a.asy) || []), ...((on && a && a.asyF) || [])].filter(Boolean).join(" | "); };
export const allSy = (d, on) => !!(d && d.al && (d.al.allSy || (on && d.al.allSyF)));
export const colorIs = (d, c, on) => !!d && (d.co === c || !!(d.al && (d.al.allCo || (on && d.al.allCoF) || (d.al.aco || []).includes(c) || (on && (d.al.acoF || []).includes(c)))));
export const hasFieldAlias = (d) => !!(d && d.al && (d.al.anF || d.al.asyF || d.al.acoF || d.al.allSyF || d.al.allCoF));
// "บีมมิ" on มีมมิจัง ไอดอล No.1 and โอตะคูลา is a misprint of มีมมิ, the idol No.1 grows out of (no card is called บีมมิ)
// names as card texts quote them, with the misprints some texts carry mapped to the printed names: "บีมมิ" (มีมมิ),
// "อาวุร..." (อาวุธของเพมมุ, อาวุธหุ่นนักรบผู้กล้า), "ไม้ท์เกรน" (ไมเกรน), "นายนิรบาล" (นายนิรยบาล),
// "ตัวอะไรซักอย่าง" (สักอย่าง), "โพลิกอน" (โพลีกอน)
// a name asked for inside a longer word that is a name of its own does not count: "นาย" is not in "นายนิรยบาล" (FAQ ฮอล)
const NAME_WORDS = { "นาย": ["นายนิรยบาล"] };
export const nameHas = (text, q) => { const k = normName(q); let t = String(text || ""); for (const w of NAME_WORDS[k] || []) t = t.split(w).join(" "); return t.includes(k); };
export const normName = (t) => sp1(t).replace(/บีมมิ/g, "มีมมิ").replace(/อาวุร/g, "อาวุธ").replace(/ไม้ท์เกรน/g, "ไมเกรน").replace(/นิรบาล/g, "นิรยบาล").replace(/ซักอย่าง/g, "สักอย่าง").replace(/โพลิกอน/g, "โพลีกอน");

function transform(raw) {
  // same card = same name and type, and either the same print code or the same text once spacing,
  // line breaks and slashes are ignored (special-art reprints often re-wrap the text)
  const norm = (t) => String(t || "").replace(/[\s\/|]+/g, "").replace(/[“”]/g, '"');
  const groups = new Map(); const byPrint = new Map(); const out = [];
  raw.forEach((c, i) => { const k = c.name + "|" + c.type + "|" + norm(c.mainEffect); const kp = c.name + "|" + c.type + "|" + c.print;
    const g = groups.has(k) ? groups.get(k) : byPrint.has(kp) ? byPrint.get(kp) : i; if (!groups.has(k)) groups.set(k, g); if (!byPrint.has(kp)) byPrint.set(kp, g); raw[i]._g = g; });
  // a reprint whose text is missing from the data (KD03-010 วูตาตู) belongs with the printing that has the same name, type,
  // Cost, GEM and POWER and does carry the text
  { const stat = (c) => [c.name, c.type, c.cost, c.gem, c.power].join("|"); const full = new Map();
    raw.forEach((c) => { if (norm(c.mainEffect) && !full.has(stat(c))) full.set(stat(c), c._g); });
    const move = new Map(); raw.forEach((c, i) => { if (!norm(c.mainEffect) && c._g === i && full.has(stat(c))) move.set(i, full.get(stat(c))); });
    raw.forEach((c) => { if (move.has(c._g)) c._g = move.get(c._g); }); }
  raw.forEach((c, i) => {
    const t = TYPE[c.type] || "A"; const e = { i, n: c.name, t, p: c.print, r: c.rare, x: (c.mainEffect || "").trim() };
    const b = c._g; if (b !== i) e.b = b;
    if (t === "M") { e.st = SUB[c.subtype] || "N"; e.g = c.cost || 0; }
    else { if (c.cost != null) e.c = c.cost; if (c.gem != null) e.g = c.gem; if (c.power != null) e.pw = c.power; }
    if (c.symbol) e.sy = c.symbol; if (c.color) e.co = c.color; if (c.gemColor) e.gc = c.gemColor; if (c.customLimit) e.lim = c.customLimit;
    if (c.soi != null) e.so = c.soi; if (c.dropRate) e.dr = c.dropRate; if (c.creator) e.ar = c.creator;
    if (c.ex === "Only #1") e.o1 = 1; else if (c.ex === "โดนใจ") e.fl = "dj"; else if (c.ex === "ลำเอียง") e.fl = "le"; else if (c.ex) e.ex = c.ex;
    if (DATA_FIX[c.print]) Object.assign(e, DATA_FIX[c.print]);
    { const al = aliasOf(e.x); if (al) e.al = al; }
    out.push(e);
  });
  // such a reprint shows and plays with the text (and colour) of the printing it belongs with
  for (const e of out) { const b = e.b != null ? out[e.b] : null; if (!e.x && b && b.x) { e.x = b.x; if (!e.co && b.co) e.co = b.co; if (b.al) e.al = b.al; } }
  // a print code's first-listed rarity has its picture at CODE.png, the rarities after it (special arts) at CODE-RARITY.png
  { const seen = new Set(); for (const e of out) { if (seen.has(e.p)) e.alt = 1; else seen.add(e.p); } }
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
  // the likely address first (checked on 151 cards across all sets: right for 150), so most pictures load on the first
  // request instead of after a miss; the other addresses stay as fallbacks
  const plain = [`${b}${f}${c.p}.png`, `${b}${c.p}.png`], rare = [`${b}${f}${c.p}-${c.r}.png`, `${b}${c.p}-${c.r}.png`];
  return [...new Set(c.alt ? [rare[0], plain[0], rare[1], plain[1]] : [plain[0], rare[0], plain[1], rare[1]])];
}
// stable keys for saved skins: print code + rarity of the base card → print code + rarity of the chosen art
let keyIndex = null;
const byKey = (k) => { if (!keyIndex) { keyIndex = new Map(); for (const c of CARDS) keyIndex.set(c.p + "-" + c.r, c); } return keyIndex.get(k); };
Data.skinCodec = {
  ready: () => CARDS.length > 0,
  encode: (map) => { const out = {}; for (const [b, v] of Object.entries(map || {})) { const B = CARDS[+b], V = CARDS[+v]; if (B && V) out[B.p + "-" + B.r] = V.p + "-" + V.r; } return out; },
  decode: (prints) => { const out = {}; for (const [kb, kv] of Object.entries(prints || {})) { const B = byKey(kb), V = byKey(kv); if (!B || !V) continue; const base = B.b != null ? B.b : B.i; if (!artBases(base).includes(V.b != null ? V.b : V.i) || V.i === base) continue; out[String(base)] = V.i; } return out; },
};
// skins: the player can pick any alternate print of a card as the art shown everywhere
export const SkinCtx = { on: true }; // skins show only on the deck pages and in the arena (set by the router)
// prints of the same card that the data keeps apart because their text is worded a little differently (a reprint such
// as CC02-028 of BT03-011 ไดโนกาฬสินธุ์ - กินรีมิมัส): same name, type, Cost, GEM, POWER, Symbol and colour. They share
// their art (any of them can be the skin) and their market prices; in decks they stay separate cards.
let artIdx = null;
const artKey = (c) => [sp1(c.n), c.t, c.st || "", c.c ?? "", c.g ?? "", c.pw ?? "", c.sy || "", c.co || ""].join("|");
export function artBases(b) {
  if (!artIdx && CARDS.length) { artIdx = new Map(); for (const c of CARDS) if (c.b == null) { const k = artKey(c); if (!artIdx.has(k)) artIdx.set(k, []); artIdx.get(k).push(c.i); } }
  const c = CARDS[b]; return (artIdx && c && artIdx.get(artKey(c))) || [b];
}
const baseOf = (x) => (x.b != null ? x.b : x.i);
export function skinOf(c) { if (!c || c.b != null || !SkinCtx.on) return c; const v = Data.skins && Data.skins[String(c.i)]; const s = v != null ? CARDS[+v] : null; return s && artBases(c.i).includes(baseOf(s)) ? s : c; }
// every print of this card: its own first, then those of the same card worded differently
export const variantsOf = (c) => { const b = baseOf(c), bs = artBases(b); return [...CARDS.filter((x) => baseOf(x) === b), ...CARDS.filter((x) => baseOf(x) !== b && bs.includes(baseOf(x)))]; };
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

// ----- the official event limits ("การ์ดบาป", bottcg.com/rule) -----
// Banned cards, cards allowed once or twice (Main Deck and LIFE counted together), pairs that may not share a Deck, and
// the Decks a few cards ask for. The newest list that has started (Thai date) applies. A Deck outside it still plays
// here; it is marked as not allowed at official events. Names are compared with spaces collapsed (a few names in the
// data carry a double space).
const BANLISTS = [{ name: "การ์ดบาป ส.ค. 2569", from: "2026-08-01",
  ban: ["ครูแกง สอนเลข", "ไสยเวท ย้อนกลับ", "ช็อตกัน นัยนาวุธ", "ขวานเงิน", "ล้มโต๊ะ"],
  max: { 1: ["ริกกี้ นักปลอมแปลง", "เจ้ากล้าดียังไง", "กฎร้าน", "แอสการ์ดคือสถานที่ไม่ใช่ผู้คน", "SD Plaza สายเหนือเก่า", "นายนิรยบาล ตัวใหญ่พิเศษ", "น้ำซุปชาบู", "มนุษย์ดัดแปลง", "พญายักษ์ ทศกัณฑ์", "ลุ้นเยี่ยวเหนียว", "ไม้เกาหลัง", "Micro Plaza สะพานพลาสติก"],
    2: ["ชายจากอนาคต", "ความเจริญ", "ลูกแม่ศรีนวล", "การสละชีพของเทพธิดา", "แมลงปอมีพิษ", "ไอ นีด เมดิก", "กุมภกรรณ ทดน้ำ", "เพื่อชาติ", "อีช่า - สาวน้อยคนเก่ง", "เลือกมันสำหรับพวก จน !!!", "เจค นักฆ่ามือเก๋า", "งี่เง่า และ งอแง", "โคลัมบัส นักท่องเรือ", "อาเธอร์ ราชาแห่งอัศวินโต๊ะกลม", "อุบัติเหตุ!!!", "พระนารายณ์ เทพผู้พิทักษ์", "ไปเลยมอนตี้", "พี่หน่วง พิธีกรผมสวย", "มยุราซัง ไอดอลยุค 80"] },
  pairs: [["เจ้ากล้าดียังไง", "ริกกี้ นักปลอมแปลง"], ["พี่หน่วง พิธีกรผมสวย", "เลือกมันสำหรับพวก จน !!!"], ["จอมเวทย์ กาลู", "โคกอีสานนูน"], ["หมู่บ้านเห็ด", "คาถา เสกควายเข้าท้อง"]] }];
const nn = (t) => String(t || "").replace(/\s+/g, " ").trim();
export function banlist(now = new Date()) { const day = new Date(now.getTime() + 7 * 3600e3).toISOString().slice(0, 10); return BANLISTS.filter((b) => b.from <= day).sort((a, b) => (a.from < b.from ? 1 : -1))[0] || null; }
// how many copies the list allows of a card (null: no limit from the list)
export function banMax(c, B = banlist()) { if (!B || !c) return null; const n = nn(c.n); if (B.ban.some((x) => nn(x) === n)) return 0; for (const [m, names] of Object.entries(B.max)) if (names.some((x) => nn(x) === n)) return +m; return null; }
// the card a forbidden pair puts against c in this Deck (null: none)
export function banPair(c, d, B = banlist()) {
  if (!B || !c) return null; const n = nn(c.n), has = (x) => deckEntries(d).some((e) => nn(e.c.n) === nn(x)) || (d.life || []).some((id) => nn((card(id) || {}).n) === nn(x));
  for (const [a, b] of B.pairs) { if (nn(a) === n && has(b)) return b; if (nn(b) === n && has(a)) return a; }
  return null;
}
export function banIssues(d, B = banlist()) {
  if (!B) return [];
  const ents = deckEntries(d), life = (d.life || []).map(card).filter(Boolean), count = {};
  for (const e of ents) count[nn(e.c.n)] = (count[nn(e.c.n)] || 0) + e.n;
  for (const c of life) count[nn(c.n)] = (count[nn(c.n)] || 0) + 1;
  const k = (n) => count[nn(n)] || 0, out = [];
  for (const n of B.ban) if (k(n)) out.push(`${n} ห้ามใช้`);
  for (const [m, names] of Object.entries(B.max)) for (const n of names) if (k(n) > +m) out.push(`${n} ใส่ได้ ${m} ใบ (ตอนนี้ ${k(n)})`);
  for (const [a, b] of B.pairs) if (k(a) && k(b)) out.push(`${a} กับ ${b} ใส่ด้วยกันไม่ได้`);
  const av = ents.filter((e) => e.c.t === "A").map((e) => e.c), only = ents.find((e) => e.c.o1);
  if (k("เมียพระอิศวร") && !av.filter((c) => nn(c.n) !== "เมียพระอิศวร").every((c) => nn(c.sy) === "เทพ" || /เทพ/.test(c.x || ""))) out.push("มี เมียพระอิศวร แล้ว Avatar ทุกใบต้องเป็น Symbol เทพ หรือมี เทพ ใน Text Box");
  if (k("ดาบศักดิ์สิทธิ์ เอกซ์คาลิเบอร์") && !av.every((c) => /อัศวินโต๊ะกลม/.test(c.n) || !c.x || /อัศวินโต๊ะกลม/.test(c.x))) out.push("มี ดาบศักดิ์สิทธิ์ เอกซ์คาลิเบอร์ แล้ว Avatar ทุกใบต้องชื่อหรือมี \"อัศวินโต๊ะกลม\" ใน Text Box");
  if (k("สัญญาเลือด") && only && nn(only.c.sy) !== "นรก") out.push("มี สัญญาเลือด แล้ว Only #1 ต้องเป็นการ์ด Symbol นรก");
  return out;
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
  // Rule Book: a card that may fill the whole Deck (รัททาทุย, up to 50) lets a Deck of 50 of that one card go without Only #1
  const one50 = o1 === 0 && total === 50 && ents.length === 1 && limitOf(ents[0].c) >= 50;
  out.push({ ok: o1 === 1 || one50, msg: o1 === 1 ? "มี Only #1 พอดี 1 ใบ" : one50 ? "ทั้ง Deck เป็นการ์ดใบเดียวกัน 50 ใบ ไม่ต้องมี Only #1" : `Only #1 ต้องมีพอดี 1 ใบ (ตอนนี้ ${o1})` });
  const bad = ents.filter((e) => e.c.t === "L" || e.c.t === "T");
  if (bad.length) out.push({ ok: false, msg: "LIFE/Token ใส่ใน Main Deck ไม่ได้" });
  const life = (d.life || []).map(card).filter(Boolean); const ln = new Set(life.map((c) => c.n));
  out.push({ ok: life.length === 5 && ln.size === 5 && life.every((c) => c.t === "L"), msg: `LIFE ${life.length}/5 ใบ` + (ln.size < life.length ? " (ชื่อซ้ำ)" : "") });
  if (ents.some((e) => e.c.fl === "le")) out.push({ ok: true, warn: true, msg: "มีการ์ดลำเอียง ใช้แข่งงานทางการไม่ได้" });
  // Rule Book 3.2: "โดนใจ" (a collaboration card) goes in a Deck and plays at events as usual, so it carries no mark
  // the official limits (การ์ดบาป) are rules of the Deck here: a Deck over them cannot be played, except the official
  // Starter / box Decks as sold, which play as they are and are marked as not allowed at events
  const B = banlist(); if (B) { const ban = banIssues(d), sold = !!(d.starter || d.box) && !d.ciel;
    out.push(!ban.length ? { ok: true, msg: `ผ่าน${B.name}` } : sold ? { ok: true, warn: true, msg: `เด็คจากกล่องไม่ผ่าน${B.name} (เล่นได้ แต่ใช้แข่งงานทางการไม่ได้): ${ban.join(" · ")}` } : { ok: false, msg: `ผิด${B.name}: ${ban.join(" · ")}` }); }
  // "ถ้าใส่การ์ดใบนี้ใน Deck จะต้องใส่ {only} สุวาน ใน Deck อีก 1 ใบ" (พญายม With The Shotgun)
  if (ents.some((e) => e.c.n === "พญายม With The Shotgun")) { const ok = ents.some((e) => e.c.n === "สุวาน" && e.c.o1); out.push({ ok, msg: ok ? "พญายม With The Shotgun มี สุวาน (Only) คู่กันแล้ว" : "ใส่ พญายม With The Shotgun ต้องใส่ สุวาน (Only #1) ด้วย" }); }
  // "จะต้องใส่การ์ด Avatar "เพมมุ" ไว้ใน Deck ด้วยเสมอ" (สไปรท์ ยอดสุนัข)
  if (ents.some((e) => e.c.n === "สไปรท์ ยอดสุนัข")) { const ok = ents.some((e) => e.c.t === "A" && String(e.c.n || "").includes("เพมมุ")); out.push({ ok, msg: ok ? "สไปรท์ ยอดสุนัข มี เพมมุ ใน Deck แล้ว" : "ใส่ สไปรท์ ยอดสุนัข ต้องมี Avatar \"เพมมุ\" ใน Deck ด้วย" }); }
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
