// Free effect reader: turns common card-text patterns into engine ops without any AI.
// It is deliberately conservative — anything conditional or unusual returns null so the
// player (or Ciel, with an API key) handles it instead of guessing wrong.
import { readAura } from "./auras.js?v=20261113195449";
import { CARDS, card, TYPE_TH, nameText, syText, allSy, colorIs, hasFieldAlias, normName, nameHas, inRed } from "./cards.js?v=20261113195449";
import { E, scriptOf } from "./engine.js?v=20261113195449";

const BAIL = /POWER\s*[+\-−–]?\s*\d+\s*ต่อ|Text Box|ที่สุด|กี่ใบ|ต่อจำนวน|ตามจำนวน|เท่ากับจำนวน|ลูกเต๋า|ถ้า|หาก|แทน|ตราบ|เมื่อ|ทุกครั้ง|ไม่สามารถ|เปลี่ยนชื่อ|Token|โทเคน|ครั้งถัดไป|ทั้งหมดบนมือ|เปิดเผย|แสดง|ประกาศ|ตั้งต้น|ได้แค่|ได้เพียง|Cost\s*[+\-−–]|ไม่ถูก|จะไม่|ไม่ได้รับ|ไม่รับผล|ที่เหลือ(?:ทิ้ง|ส่ง)?ลงนรก|สลับ|คนละชื่อ|ฝ่ายตรงข้าม\s*เลือก|อย่างละ|(?<!ตั้ง)แต่|ได้อีก|เท่านั้น|ครึ่ง|ทอย|เหรียญ|โอน้อย|เป่ายิ้งฉุบ/;
const KWS = "โล่มนุษย์|ลูกฮึด|สามัคคี|เตะไข่|แทงหลัง";
const KWGRANT = new RegExp(`ได้รับ\\s*(?:ความสามารถ\\s*)?["“]?\\s*(${KWS})`);
// the trigger keyword must start an ability ("จุติ :" / "จุติ (…) :" / "จุติ ทิ้งการ์ด… :"), not appear inside one ("อัญเชิญ จุติ Avatar")
const KEYS = { build: /เมื่อ\s*(?:การ์ด|Construct)\s*(?:ใบนี้|นี้)?\s*(?:ถูก)?ก่อสร้าง/, summon: /(?<!อัญเชิญ\s*(?:พอดี\s*)?|แบบ\s*|ทำการ\s*|ความสามารถ\s*)จุติ(?=\s*(?:\(|:|\{red|ทิ้ง|เลือก|เซ่นไหว้|ถ้า|สอดแนม|ธรณีสูบ|เนรเทศ|หงาย|นำ|แสดง|ส่ง|ทำลาย|และ\s*บน))/, death: /(?<!ได้รับ\s*["“]?\s*|ความสามารถ\s*)คำสั่งเสีย(?=\s*(?:\(|:|\{red))/, life: /ถูกหงายจากการโจมตี/,
  attack: /เมื่อ\s*(?:Avatar\s*|การ์ด\s*)?(?:ใบนี้|ตัวนี้|นี้)?\s*(?:เป็นเป้าหมายโจมตีหรือ)?(?:ประกาศ|สั่ง)?โจมตี/, attacked: /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:เป็นเป้าหมายโจมตีหรือสั่งโจมตี|ถูกโจมตี|ถูกเล็งเป็นเป้าหมาย(?:การ)?โจมตี|(?:ตก)?เป็นเป้าหมาย(?:ของ)?การโจมตี)/,
  win: /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*ทำลาย\s*Avatar\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*จากการต่อสู้\s*(?:สำเร็จ)?/,
  paid: /(?:เมื่อ|ถ้า)\s*(?:(?:การ์ด|Avatar)\s*(?:ใบนี้|นี้)\s*)?ถูก(?:ใช้)?(?:ทิ้ง)?\s*(?:เป็น)?\s*(?:ค่า)?\s*Cost\s*(?:ให้กับ|ให้|ในการ|เพื่อ)?\s*(?:อัญเชิญ)?/,
  milled: /(?:เมื่อ|ถ้า)\s*การ์ดใบนี้\s*(?:ถูก)?\s*(?:(?:ส่งลง|ตก)นรกด้วยผลของ\s*ธรณีสูบ|ธรณีสูบ)(?:\s*\([^)]*\))?(\s*ด้วย(?:การ์ด)?\s*Avatar\s*\{\s*symbol\s*เทพ\s*\}\s*สีม่วง\s*หรือ\s*Magic\s*(?:Card)?)?/i,
  fight: /เมื่อ\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:ทำการ)?ต่อสู้(?!\s*(?:กับ|ชนะ|แพ้))/, link: /เมื่อ\s*(?:Avatar\s*(?:ใบนี้|ตัวนี้)\s*)?เข้าสู่\s*สถานะ\s*\[?\s*Link\s*\]?/,
  end: /อัตโนมัติ\s*ใน(?:ช่วง|ทุกๆ)?\s*End Phase(?:\s*(?:ของ)?\s*เรา)?/, mainStart: /อัตโนมัติ\s*(?:เมื่อ|ใน)?(?:ช่วง)?\s*เริ่ม(?:ต้น)?\s*Main Phase\s*(?:ของ)?\s*เรา/ };
const VERBS = [/จั่วการ์ด/, /ธรณีสูบ/, /ทำลาย/, /POWER\s*[+\-−–]/, /สภาพนอน/, /สภาพตื่น/, /สูญเสียความสามารถ|เสียความสามารถ|ไร้ผล/, /ทำความเสียหาย/, /ควบคุม/, /เนรเทศ/, /ยกเลิก/, /ทิ้งการ์ด|สุ่มทิ้ง/, /(?:หงาย|คว่ำ)\s*LIFE/i];

// first place where a trigger keyword starts a real ability of this card — not one it grants to something
// ({red "…"} / ได้รับ "…"), not an item of a conditional list ("- 7 ชื่อ …"), not an optional "สั่งใช้ เมื่อ …"
function keyAt(t, key) {
  const re = new RegExp(key.source, "g"); let m;
  while ((m = re.exec(t))) {
    if (inRed(t, m.index)) { if (re.lastIndex === m.index) re.lastIndex++; continue; } // inside {red …}: reminder text, or an ability granted to another card
    const pre = t.slice(t.lastIndexOf("\n", m.index) + 1, m.index); const k = pre.lastIndexOf("สั่งใช้");
    if ((k >= 0 && !pre.slice(k).includes(":")) || /^\s*(?:-\s*\d|\d\s*[).])/.test(pre) || /(\{red|["“]|ได้รับ)\s*(?:["“]\s*)?(?:อัตโนมัติ\s*|เทิร์นละครั้ง\s*)*$/i.test(pre)) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
    return m;
  }
  return null;
}
// pull "head : body" for the ability that this trigger fires
function clause(text, when) {
  const t = String(text || "").replace(/\r/g, "");
  let rest; let exactOnly = false; // "พอดี จุติ : …" only works when the Cost was paid with exactly that much GEM
  if (when === "cast") rest = t;
  else {
    const key = KEYS[when]; if (!key) return null;
    const m = keyAt(t, key);
    if (!m) { if (when === "life") rest = t; else return null; } // LIFE cards often skip the "ถูกหงาย…" wording
    else { rest = t.slice(m.index + m[0].length); if (when === "summon" && /พอดี\s*(?:\{red\s*)?(?:\([^)]*\)\s*\}?)?[\s\-•]*$/.test(t.slice(0, m.index))) exactOnly = true; }
  }
  rest = cutAbility(rest, when === "cast" || when === "life").replace(/^\s*\{red\s*\([^{}]*\)\s*\}/, "");
  const k = rest.indexOf(":");
  return k >= 0 ? { head: rest.slice(0, k).trim(), body: rest.slice(k + 1).trim(), exactOnly } : { head: "", body: rest, exactOnly };
}
const TEXTBOX = /ที่มี\s*["“]([^"”]+)["”]\s*(?:อยู่)?\s*ใน\s*Text\s*Box/i;
function filterOf(t) {
  const f = {}; t = String(t).replace(/\{\s*[Ss]ymbol\s*:\s*/g, "{Symbol ");
  { const tb = t.match(TEXTBOX); if (tb) { f.text = tb[1].trim(); t = t.replace(tb[0], " "); } } // 'Avatar ที่มี "X" อยู่ใน Text Box'
  // "การ์ดที่เป็น โดนใจ": a card with the โดนใจ (collaboration) mark, not a name (a name in quotes stays a name)
  if (/โดนใจ/.test(t.replace(/["“][^"”]*["”]/g, " "))) { f.collab = true; t = t.replace(/(?:ที่เป็น|ที่มี)?\s*(?<!["“][^"”]*)โดนใจ/g, " "); }

  if (/(?:ที่ไม่ใช่|ยกเว้น)\s*\{only\}|ไม่ใช่\s*Only\s*#?1/i.test(t)) { f.notOnly = true; t = t.replace(/(?:ที่ไม่ใช่|ไม่ใช่|ยกเว้น)\s*(?:\{only\}|Only\s*#?1)/gi, " "); }
  const nn = t.match(/(?:ที่ไม่ใช่|ที่ไม่ได้ชื่อ|ไม่ได้ชื่อ|ยกเว้น|ชื่อไม่ซ้ำกับ)\s*["“]?([^"”,]+?)["”]?(?=\s+\d+\s*ใบ|\s+จาก|\s+ใน|\s+บน|\s+ลง|\s+ขึ้น|\s*$)/);
  if (nn) { f.notName = nn[1].trim(); t = t.replace(nn[0], " "); }
  if (/ที่ไม่ใช่|ไม่ได้ชื่อ|ยกเว้น|ชื่อไม่ซ้ำ|ชื่อต่างกัน|เดียวกัน/.test(t)) f.bad = true;
  if (/ใบอื่น|ตัวอื่น/.test(t)) f.other = true;
  const sys = [...t.matchAll(/\{\s*[Ss]ymbol\s+([^}]+?)\s*\}/g)].map((m) => m[1].trim()); if (sys.length === 1) f.symbol = sys[0]; else if (sys.length > 1) { f.symbols = sys; t = t.replace(/\}\s*(?:,|หรือ)\s*\{/g, "} {"); }
  if (!sys.length) { const us = t.match(/Symbol\s*:?\s*(?:ชาว)?([^\s\d{}:,]+)/); if (us) { f.symbol = us[1]; t = t.replace(us[0], " "); } }
  { const syN = (y) => String(y).replace(/ฤๅษี|ฤาษี/g, "ฤษี"); if (f.symbol) f.symbol = syN(f.symbol); if (f.symbols) f.symbols = f.symbols.map(syN); } // the card data spells the Symbol ฤษี (ฤๅษีพระเจ้าตา)
  const xg = t.match(/GEM\s*(\d+)\s*หรือ\s*มากกว่า/i); if (xg) { f.minGem = +xg[1]; t = t.replace(xg[0], " "); }
  const names = [...t.matchAll(/["“]([^"”]{1,30})["”]/g)].map((m) => m[1].trim());
  if (names.length > 1) f.names = names; else if (names.length) f.name = names[0];
  else { const bn = t.match(/(?:Avatar|การ์ด)\s*ชื่อ\s*([^\d:]+?)\s*(?=\d+\s*ใบ)/); if (bn) f.name = bn[1].trim(); }
  if (/Avatar/.test(t)) f.type = "A"; else if (/Modification|\{mod\}/i.test(t)) { f.type = "M"; f.st = "D"; } else if (/Normal\s*Magic/i.test(t)) { f.type = "M"; f.st = "N"; } else if (/React|\{react\}/i.test(t)) { f.type = "M"; f.st = "R"; } else if (/Land|\{land\}/i.test(t)) { f.type = "M"; f.st = "L"; } else if (/Magic|\{magic\}/i.test(t)) f.type = "M"; else if (/Construct/.test(t)) f.type = "C";
  const mc = t.match(/Cost\s*(?:ไม่เกิน|น้อยกว่าหรือเท่ากับ)\s*(\d+)/) || t.match(/Cost\s*(\d+)\s*หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/); if (mc) { f.maxCost = +mc[1]; t = t.replace(/หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/, ""); }
  const xc = t.match(/Cost\s*(?:ตั้งแต่\s*)?(\d+)\s*(?:ขึ้นไป|หรือ\s*(?:มากกว่า|สูงกว่า))/); if (xc) { f.minCost = +xc[1]; t = t.replace(/หรือ\s*(?:มากกว่า|สูงกว่า)/, ""); }
  const pc = t.match(/POWER\s*(\d+)\s*หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/); if (pc) { f.maxPower = +pc[1]; t = t.replace(/หรือ\s*(?:ต่ำกว่า|น้อยกว่า)/, ""); }
  const lc = t.match(/Cost\s*(?:น้อยกว่า|ต่ำกว่า)\s*(\d+)/); if (lc) f.maxCost = +lc[1] - 1;
  const mp = t.match(/POWER\s*(?:ไม่เกิน)\s*(\d+)/); if (mp) f.maxPower = +mp[1];
  const lp = t.match(/POWER\s*(?:น้อยกว่า|ต่ำกว่า)\s*(\d+)/); if (lp) f.maxPower = +lp[1] - 1;
  // exact values: "ที่มี Cost 1 Gem 1 POWER 1"
  if (f.maxCost == null && f.minCost == null) { const ec = t.match(/Cost\s*(\d+)(?!\s*(?:\d|หรือ|ขึ้นไป|ลงมา|ใบ))/); if (ec) f.cost = +ec[1]; }
  if (f.minGem == null) { const eg = t.match(/GEM\s*(\d+)(?!\s*(?:\d|หรือ|ขึ้นไป|ลงมา|ใบ))/i); if (eg) f.gem = +eg[1]; }
  if (f.maxPower == null) { const ep = t.match(/POWER\s*(\d+)(?!\s*(?:\d|หรือ|ขึ้นไป|ลงมา|ใบ))/); if (ep) f.power = +ep[1]; }
  const co = t.match(/สี(แดง|ฟ้า|เขียว|ม่วง)/); if (co) f.color = co[1];
  // "A or B" mixes we can't express (a list of quoted names is fine, and so is "from the hand or the Deck")
  if (/หรือ/.test(t.replace(/["”]\s*,?\s*หรือ\s*["“]/g, '" "').replace(/(?:Deck|นรก|มือ)(?:\s*(?:ฝ่าย|ของ)?เรา)?\s*หรือ\s*(?:จาก)?\s*(?:ใน)?\s*(?:บน)?\s*(?:Deck|นรก|มือ)/g, " ").replace(/บนสุด\s*หรือ\s*(?:ล่างสุด|ใต้)/g, " "))) f.bad = true;
  return f;
}
const seatOf = (t, p) => (/ผู้เล่นทุกคน|ทั้งสองฝ่าย|ทุกฝ่าย|ทั้ง\s*2\s*ฝ่าย/.test(t) ? [p, 1 - p] : /ฝ่ายตรงข้าม|อีกฝ่าย/.test(t) ? [1 - p] : [p]);
const num = (t, re, d = 1) => { const m = t.match(re); return m ? +m[1] : d; };
const val = (s, x) => E.power(s, x) + (E.def(s, x).c || 0) * 0.5 + (E.def(s, x).o1 ? 6 : 0);
const fits = (s, x, f) => { let d = E.def(s, x); const so = E.syNow ? E.syNow(s, x) : E.syOver(s, x); if (so) { d = { ...d, sy: so }; delete d.al; } return fitsD(d, f, () => E.power(s, x), hasFieldAlias(d) && E.onField(s, x), () => E.costNow(s, x), () => E.gemNow(s, x)); };
function fitsD(d, f, pw = () => d.pw || 0, on = false, cst = () => d.c || 0, gm = () => d.g || 0) {
  const nm = nameText(d, on); const syt = syText(d, on); const anySy = allSy(d, on);
  if (f.symbol && !anySy && !syt.includes(f.symbol)) return false;
  if (f.symbols && !anySy && !f.symbols.some((y) => syt.includes(y))) return false;
  if (f.name && !nameHas(nm, f.name)) return false;
  if (f.names && !f.names.some((n) => nameHas(nm, n))) return false;
  if (f.notName && nm.includes(normName(f.notName))) return false;
  if (f.notOnly && d.o1) return false;
  if (f.collab && !(d.fl === "dj" || (d.im != null && (card(d.im) || {}).fl === "dj"))) return false;
  if (f.st && d.st !== f.st) return false;
  if (f.maxCost != null && cst() > f.maxCost) return false;
  if (f.minCost != null && cst() < f.minCost) return false;
  if (f.minGem != null && gm() < f.minGem) return false;
  if (f.cost != null && cst() !== f.cost) return false;
  if (f.gem != null && gm() !== f.gem) return false;
  if (f.power != null && pw() !== f.power) return false;
  if (f.maxPower != null && pw() > f.maxPower) return false;
  if (f.colors ? !f.colors.some((k) => colorIs(d, k, on)) : f.color && !colorIs(d, f.color, on)) return false;
  if (f.text && !String(d.x || "").includes(f.text)) return false;
  if (f.type && d.t !== f.type && !(f.type === "A" && d.t === "T") && f.strict) return false;
  return true;
}

// the first condition of a filter that a card misses, in words for the player (shown on cards that cannot be picked)
function whyD(d, f, pw = () => d.pw || 0, on = false, cst = () => d.c || 0, gm = () => d.g || 0) {
  const nm = nameText(d, on); const syt = syText(d, on); const anySy = allSy(d, on);
  if (f.type && d.t !== f.type && !(f.type === "A" && d.t === "T")) return "ไม่ใช่ " + (TYPE_TH[f.type] || f.type);
  if (f.symbol && !anySy && !syt.includes(f.symbol)) return "ไม่ใช่ {" + f.symbol + "}";
  if (f.symbols && !anySy && !f.symbols.some((y) => syt.includes(y))) return "สัญลักษณ์ไม่ตรง";
  if (f.name && !nm.includes(normName(f.name))) return "ชื่อไม่ใช่" + f.name;
  if (f.names && !f.names.some((n) => nm.includes(normName(n)))) return "ชื่อไม่ตรง";
  if (f.notName && nm.includes(normName(f.notName))) return "ห้ามชื่อ" + f.notName;
  if (f.notOnly && d.o1) return "เป็น Only #1";
  if (f.st && d.st !== f.st) return "ชนิด Magic ไม่ตรง";
  if (f.maxCost != null && cst() > f.maxCost) return "Cost เกิน " + f.maxCost;
  if (f.minCost != null && cst() < f.minCost) return "Cost ต่ำกว่า " + f.minCost;
  if (f.minGem != null && gm() < f.minGem) return "GEM ไม่ถึง " + f.minGem;
  if (f.cost != null && cst() !== f.cost) return "Cost ไม่ใช่ " + f.cost;
  if (f.gem != null && gm() !== f.gem) return "GEM ไม่ใช่ " + f.gem;
  if (f.power != null && pw() !== f.power) return "POWER ไม่ใช่ " + f.power;
  if (f.maxPower != null && pw() > f.maxPower) return "POWER เกิน " + f.maxPower;
  if (f.colors ? !f.colors.some((k) => colorIs(d, k, on)) : f.color && !colorIs(d, f.color, on)) return "ไม่ใช่สี" + (f.colors ? f.colors.join("/") : f.color);
  if (f.text && !String(d.x || "").includes(f.text)) return "ข้อความไม่ตรง";
  return null;
}
const whyX = (s, x, f) => { let d = E.def(s, x); const so = E.syOver(s, x); if (so) { d = { ...d, sy: so }; delete d.al; } return whyD(d, f, () => E.power(s, x), hasFieldAlias(d) && E.onField(s, x), () => E.costNow(s, x), () => E.gemNow(s, x)); };
// reasons for every revealed card that is not a candidate
const whyMap = (ids, cands, fn) => { const ok = new Set(cands.map((x) => x.i)), out = {}; for (const i of ids) if (!ok.has(i)) out[i] = fn(i) || "ไม่ตรงเงื่อนไข"; return out; };

// ---------- สอดแนม: show the top cards, take what the text names, put the rest where it says ----------
const SC_REST = /การ์ด(?:ใบ)?(?:อื่น\s*ๆ?\s*)?ที่เหลือ(?:ทั้งหมด)?|(?:ใบ|ส่วน)?ที่เหลือ(?:ทั้งหมด)?|การ์ดใบอื่น(?:\s*ๆ)?/;
const SC_TAIL = /\s(?=ถ้า|หาก|หลังจากนั้น(?!\s*(?:สับ|(?:นำ)?(?:การ์ด)?(?:ใบ)?ที่เหลือ|เรียง))|จากนั้น(?!\s*(?:สับ|(?:นำ)?(?:การ์ด)?(?:ใบ)?ที่เหลือ|เรียง))|โดย(?:นับ|ถือ)|#|Avatar\s*(?:ใบ)?ที่(?:ถูก)?(?:อัญเชิญ|เลือก)|การ์ด(?:ใบ)?ที่(?:เลือก|นำ|อัญเชิญ)|และ\s*(?:จั่ว|ทำลาย|ธรณีสูบ|ทำความเสียหาย))/;
// where the cards that were not taken go: bottom / shuffle / top / hell / dark, or null when the wording is not understood
function scoutWhere(t) {
  const left = t.replace(/นำ|ส่ง|ทิ้ง|ใส่|วาง|เก็บ|ไว้|เข้า|ลง|คืน|กลับ|ไป|ใน|ที่|ใต้|สุด|ของ|ล่าง|บน|กอง|Deck|เด็ค|นรก|มิติมืด|เนรเทศ|ฝ่าย|เรา|ตนเอง|แล้ว|และ|จากนั้น|สับ|เรียง|ลำดับ|ตามใจ|ชอบ|ใหม่|ได้|ให้|ทั้งหมด|ตาม|ใด|ก็|เดิม|ต้องการ|ยัง|การ์ด|ทุกใบ|ใบนั้น|นั้น|หรือ|เลือก|[\s.,:]/gi, "");
  if (left.length > 1) return null;
  if (/บนสุด\s*หรือ\s*(?:ล่างสุด|ใต้)|(?:ล่างสุด|ใต้)\s*(?:สุด)?\s*หรือ\s*บนสุด/.test(t)) return "choice";
  if (/สับ/.test(t)) return "shuffle";
  if (/ใต้|ล่างสุด/.test(t)) return "bottom";
  if (/บนสุด|บน\s*Deck|เดิม/.test(t)) return "top";
  if (/เนรเทศ|มิติมืด/.test(t)) return "dark";
  if (/นรก|ทิ้ง/.test(t)) return "hell";
  if (/กลับ(?:เข้า)?\s*Deck/.test(t)) return "shuffle";
  return null;
}
const SC_STRIP = /เลือก|สามารถ|นำ|อัญเชิญ|จุติ|การ์ด|ใบนั้น|ที่เป็น|ที่มี|ที่|ชื่อ|จาก(?:ใน)?(?:ที่)?\s*สอดแนม(?:เจอ|ได้|มา)?|สอดแนม|ขึ้นมือ|กลับ|ลง(?:บน|ใน|มา|สู่)?|บน|ไว้|มา|ไป|สนาม|Avatar Zone|Constr?u?ct Zone|Magic Zone|ฝ่ายเรา|ของเรา|เรา|ก่อสร้าง|ทำการ|ทิ้ง|นรก|เนรเทศ|มิติมืด|และ|แล้ว|ให้|ได้|จำนวน|สูงสุด|ไม่เกิน|กี่ใบก็ได้|ทั้งหมด|ทุกใบ|\d+\s*ใบ|ใบ|Avatar|Magic(?:\s*Card)?|Construct|Modification|Normal|React|Land|Cost\s*\d+\s*(?:หรือ\s*(?:ต่ำกว่า|น้อยกว่า))?|Cost\s*(?:ไม่เกิน|น้อยกว่า|ต่ำกว่า)\s*\d+|POWER\s*(?:ไม่เกิน)?\s*\d+(?:\s*หรือ\s*(?:ต่ำกว่า|น้อยกว่า))?|สี(?:แดง|ฟ้า|เขียว|ม่วง)|["“][^"”]*["”]|\{[^}]*\}|[\s:,.()]/g;
let knownNames = null;
const nameKnown = (n) => { if (!knownNames || knownNames.n !== CARDS.length) knownNames = { n: CARDS.length, list: [...new Set(CARDS.map((c) => c.n))] }; return n.length >= 2 && knownNames.list.some((x) => x.includes(n)); };
// the card(s) a scout may take: one filter, or several joined with "หรือ"; null when the wording is not understood
function scoutFilter(text, selfDef) {
  let t = text; const extra = {};
  if (/ชื่อไม่ซ้ำกัน|ชื่อ(?:ที่)?(?:แตก)?ต่างกัน|คนละชื่อ/.test(t)) { extra.distinct = true; t = t.replace(/(?:ที่)?(?:มี)?ชื่อไม่ซ้ำกัน|(?:ที่)?ชื่อ(?:ที่)?(?:แตก)?ต่างกัน|คนละชื่อ/g, " "); }
  let m = t.match(/ที่มี\s*["“]([^"”]+)["”]\s*(?:อยู่)?ใน\s*Text\s*Box/i); if (m) { extra.text = m[1].trim(); t = t.replace(m[0], " "); }
  m = t.match(/(?:ที่)?(?:มี)?สีเดียวกัน(?:กัน)?(?:กับ|เหมือน)?\s*(?:Avatar|การ์ด)\s*(?:ใบ|ตัว)?นี้/); if (m) { if (!selfDef || !selfDef.co) return null; extra.color = selfDef.co; if (selfDef.al && (selfDef.al.aco || []).length) extra.colors = [selfDef.co, ...selfDef.al.aco]; /* FAQ ซุนฮูหยิน: a colour it also counts as is the same colour too */ t = t.replace(m[0], " "); }
  const one = (part, base) => {
    const f = filterOf(part); if (f.bad) return null;
    if (!(f.name || f.names || f.symbol || f.symbols || f.text || f.collab || extra.text)) { const bare = part.replace(/(?:ที่ไม่ใช่|ยกเว้น|ไม่ได้ชื่อ)\s*["“]?[^"”]+?["”]?(?=\s+(?:\d+\s*ใบ|จาก|ใน|บน|ลง|ขึ้น)|\s*$)/, " ").replace(SC_STRIP, " ").replace(/\s+/g, " ").trim(); if (bare) { if (base && base.symbolish) f.symbol = bare; else if (nameKnown(bare)) f.name = bare; else return null; } }
    return f;
  };
  let list;
  const whole = one(t);
  if (whole) list = [whole];
  else { const parts = t.split(/\s*(?:และ\/)?หรือ\s*/); if (parts.length < 2 || parts.length > 4) return null; list = [];
    for (let k = 0; k < parts.length; k++) { const prev = list[k - 1]; const f = one(parts[k], prev && { symbolish: !!(prev.symbol || prev.symbols) && !prev.name && !prev.names }); if (!f) return null; list.push(f); }
    const last = list[list.length - 1]; for (const f of list) { if (!f.type && list[0].type) f.type = list[0].type; for (const k of ["maxCost", "minCost", "maxPower", "notOnly"]) if (f[k] == null && last[k] != null) f[k] = last[k]; } }
  for (const f of list) { Object.assign(f, extra.text ? { text: extra.text } : {}, extra.color ? { color: extra.color } : {}, extra.colors ? { colors: extra.colors } : {}); }
  return { list, distinct: !!extra.distinct };
}
function readScout(s, body, p, self, ctx, trig) {
  let t = body.replace(/\{red\s*(?:\([^{}]*\))?\s*\}/g, " ").replace(/^(สอดแนม)\s*\([^)]*\)/, "$1").replace(/\s+/g, " ").trim();
  let m = t.match(/^สอดแนม\s*(?:Deck\s*(?:ของ)?(ฝ่ายตรงข้าม|อีกฝ่าย)\s*)?(\d+)\s*ใบ(?:\s*(?:ของ|จาก)\s*Deck\s*(?:ของ)?(อีกฝ่าย|ฝ่ายตรงข้าม|ฝ่ายเรา|เรา))?\s*[:：]?\s*/); if (!m) return null;
  const seat = m[1] || (m[3] && OPP.test(m[3])) ? 1 - p : p; const n = +m[2] + (seat === p && E.scoutBonus ? E.scoutBonus(s, p, s.cards[trig.c]) : 0); t = t.slice(m[0].length);
  const D = s.P[seat]; if (D.deck.length < +m[2] && !trig.dry && trig.i !== -1) return { ops: [], say: [], fail: `Deck มีไม่ถึง ${m[2]} ใบ ความสามารถสอดแนมไม่ทำงาน` }; // FAQ กุ่ย หน้าตาดี
  const top = D.deck.slice(0, n); const ids = top.map((x) => x.i); const ops = [], say = [];
  const meDef = ctx.me ? E.def(s, ctx.me) : trig.i === -1 ? { co: "-" } : null;
  const whereOf = (txt) => { const w = scoutWhere(txt); return w === "choice" ? (ctx.mode(["วางไว้บนสุดของ Deck", "นำไปไว้ล่างสุดของ Deck"], `สอดแนม ${n} ใบ: การ์ดที่เหลือ`, 0) === 0 ? "top" : "bottom") : w; };
  const tail = (rest) => { // what the text says after the scout itself: read later if possible, otherwise left for the player
    rest = rest.replace(/^[\s.,]+/, "").trim(); if (!rest) return true;
    const base = { i: trig.i, c: trig.c, when: trig.when, seat: trig.seat, ...(trig.k != null ? { k: trig.k } : {}), ...(trig.on ? { on: trig.on } : {}) };
    const dry = makeCtx(s, trig); dry.ref = ctx.ref; dry.when = ctx.when; dry.me = ctx.me; let ok = null; try { ok = readClause(s, rest, p, self, dry, { ...trig, dry: true, part: 0 }); } catch { ok = null; }
    ops.push({ op: "resume", t: ok ? { ...base, tail: rest } : { ...base, manualRest: rest } }); say.push(ok ? "แล้วทำส่วนที่เหลือต่อ" : "ส่วนที่เหลือของข้อความต้องทำเอง"); return true;
  };
  const moveOp = (x, to) => (to === "av" ? { op: "put", i: x.i, jt: /อัญเชิญ\s*(?:พอดี\s*)?จุติ/.test(t) } : to === "cs" ? { op: "move", i: x.i, to: "cs", seat: p } : to === "attach" ? { op: "attach", i: x.i, on: self.i } : to === "dark" ? { op: "exile", i: x.i } : { op: "move", i: x.i, to });
  const TO_TH = { av: "อัญเชิญ", cs: "ก่อสร้าง", attach: "นำมาสวมใส่", dark: "เนรเทศ", hell: "ส่งลงนรก", hand: "นำขึ้นมือ" };
  const dest = (x) => (/สวม/.test(x) ? (self && /(?:Avatar|การ์ด)\s*(?:ใบ|ตัว)?นี้/.test(x) ? "attach" : null) : /ก่อสร้าง|Constr?u?ct\s*Zone/i.test(x) ? "cs" : /อัญเชิญ|Avatar\s*Zone|ลงสนาม/.test(x) ? (/ขึ้นมือ/.test(x) ? null : "av") : /ขึ้นมือ/.test(x) ? "hand" : /เนรเทศ|มิติมืด/.test(x) ? "dark" : /นรก|ทิ้ง/.test(x) ? "hell" : null);
  // "if it is X do this, otherwise do that" on a single scouted card
  if (n === 1 && (m = t.match(/^ถ้า(?:การ์ด)?(?:ที่สอดแนม|ใบนั้น|นั้น)?\s*(?:เป็น|คือ)\s*(.+?)\s+(?:ให้|สามารถ)?\s*((?:อัญเชิญ|นำ|ส่ง|ทิ้ง|ก่อสร้าง|เนรเทศ).*?)\s*(?:แต่\s*)?ถ้า(?:ไม่ใช่|ไม่เป็น|เป็นการ์ดอื่น|เป็นอย่างอื่น)\s*(?:ให้\s*)?(.+)$/))) {
    const F = scoutFilter(m[1], meDef); const to = dest(m[2]); const cut = m[3].split(SC_TAIL); if (!F || !to || !scoutWhere(cut[0])) return null; const where = whereOf(cut[0]);
    const x = top[0]; ops.push({ op: "scoutShow", seat, ids });
    if (!x) say.push("Deck หมด ไม่มีการ์ดให้สอดแนม");
    else if (F.list.some((f) => fitsD(E.def(s, x), { ...f, strict: true }, undefined, false, undefined, () => E.gemNow(s, x))) && !(to === "av" && seat === p && (E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6))) { ops.push(seat === p || to === "hell" || to === "dark" ? moveOp(x, to) : { op: "move", i: x.i, to: "hell" }); say.push(`สอดแนมเจอ ${E.name(s, x)} · ${TO_TH[to]}`); }
    else { ops.push({ op: "scoutRest", seat, ids, rest: where }); say.push(`สอดแนมเจอ ${E.name(s, x)} ไม่ตรงเงื่อนไข`); }
    tail(cut.slice(1).join(" ")); return { ops, say };
  }
  if (seat !== p) return null;
  // "<take something> … การ์ดที่เหลือ <where>"
  // "then put those cards …" with nothing taken: every scouted card is a card that is left
  const allRest = t.match(/^(?:หลังจากนั้น|จากนั้น|แล้ว)?\s*(?:เลือก)?\s*(?:นำ)?\s*การ์ด(?:ใบ)?(?:นั้น|ที่\s*สอดแนม|เหล่านั้น|ทั้งหมด)\s*/);
  const k = allRest ? 0 : t.search(SC_REST); let pick = allRest ? "" : k >= 0 ? t.slice(0, k) : t; let after = allRest ? t.slice(allRest[0].length) : k >= 0 ? t.slice(k).replace(SC_REST, "") : ""; let where = "shuffle"; let rest = ""; // Rule Book (สอดแนม): nothing said about the rest → the Deck was seen, so it is shuffled
  if (k >= 0) { const cut = after.split(SC_TAIL); if (!scoutWhere(cut[0])) return null; where = whereOf(cut[0]); rest = cut.slice(1).join(" "); }
  else { const cut = pick.split(SC_TAIL); pick = cut[0]; rest = cut.slice(1).join(" "); }
  pick = pick.replace(/[\s:,.]+$/, "").replace(/\s*(?:และ|แล้ว)?\s*(?:นำ|ส่ง|ทิ้ง|ให้)?\s*$/, "").trim();
  ops.push({ op: "scoutShow", seat, ids });
  if (!pick) { ops.push({ op: "scoutRest", seat, ids, rest: where }); say.push(`สอดแนม ${n} ใบ`); tail(rest); return { ops, say }; }
  if (!/^(?:สามารถ\s*)?(?:เลือก|นำ|อัญเชิญ|ก่อสร้าง|เนรเทศ|ทิ้ง|ส่ง)/.test(pick) || /อีก\s*\d+\s*ใบ|และ\/หรือ|อย่างละ|ฝ่ายตรงข้าม|อีกฝ่าย|POWER\s*[+\-]|เท่ากับ/.test(pick)) return null;
  const to = dest(pick); if (!to) return null;
  if (to === "hand" && !/สามารถ/.test(pick) && E.deckHandBlocked(s, p, s.cards[trig.c])) missed(ctx); // FAQ แมวนิค: no taking cards from the Deck into the hand
  const F = scoutFilter(pick, meDef); if (!F) return null;
  const all = /กี่ใบก็ได้|ทั้งหมด|ทุกใบ/.test(pick); const hm = howMany(pick.replace(/จาก(?:ใน)?(?:ที่)?\s*สอดแนม/g, " ")); let want = all ? 99 : hm.n; const optional = all || hm.upTo || /สามารถ/.test(pick);
  let cands = top.filter((x) => F.list.some((f) => fitsD(E.def(s, x), { ...f, strict: true }, undefined, false, undefined, () => E.gemNow(s, x))) && !(F.list[0].other && self && x.i === self.i)).sort((a, b) => val(s, b) - val(s, a));
  if (F.distinct) { const seen = new Set(); cands = cands.filter((x) => { const nm = E.def(s, x).n; if (seen.has(nm)) return false; seen.add(nm); return true; }); }
  if (to === "av") { const P = s.P[p]; const free = Math.max(0, Math.min(4 - E.avatars(P), 6 - P.av.length)); cands = cands.filter((x) => E.def(s, x).t === "A"); want = Math.min(want, free); }
  if (to === "cs") { cands = cands.filter((x) => E.def(s, x).t === "C" && !s.P[p].cs.some((y) => E.name(s, y) === E.def(s, x).n)); want = Math.min(want, 3 - s.P[p].cs.length); }
  want = Math.min(want, cands.length);
  const why = whyMap(ids, cands, (i) => { const x = top.find((y) => y.i === i); if (!x) return null; const d = E.def(s, x);
    if (to === "av" && d.t !== "A") return "ไม่ใช่ Avatar"; if (to === "cs" && d.t !== "C") return "ไม่ใช่ Construct";
    if (F.list[0].other && self && x.i === self.i) return "ใบเดียวกับที่ใช้"; return F.list.length === 1 ? whyD(d, { ...F.list[0], strict: true }, undefined, false, undefined, () => E.gemNow(s, x)) : null; });
  const got = want > 0 ? ctx.choose(cands, want, `สอดแนม ${n} ใบ: เลือกการ์ดที่จะ${TO_TH[to]}${want > 1 ? ` (${optional ? "สูงสุด " : ""}${want} ใบ)` : ""}`, { optional, reveal: ids, why }) : [];
  for (const x of got) ops.push(moveOp(x, to));
  ops.push({ op: "scoutRest", seat, ids, rest: where });
  say.push(got.length ? `สอดแนม ${n} ใบ · ${TO_TH[to]} ${got.map((x) => E.name(s, x)).join(", ")}` : `สอดแนม ${n} ใบ ไม่ได้การ์ดที่ตรงเงื่อนไข`);
  tail(rest); return { ops, say };
}
// the card a "when used as Cost for …" ability asks for: 0 = any card, a filter, or null when unreadable
const paidFilter = (head) => { const h = String(head || "").trim(); if (!h) return 0; const f = filterOf(h); if (f.bad || !(f.name || f.names || f.symbol || f.symbols || f.color)) return null; if (h.replace(/Avatar|การ์ด|["“][^"”]*["”]|\{[^}]*\}|สี(?:แดง|ฟ้า|เขียว|ม่วง)|ที่มี|ที่เป็น|หรือ|,|\s/g, "").length > 2) return null; return f; };
const OPP = /ฝ่ายตรงข้าม|อีกฝ่าย/;
// how many cards a sentence asks for: { n, upTo } ("สูงสุด 2 ใบ" / "ไม่เกิน 2 ใบ" = up to)
const howMany = (t) => { const c = t.replace(/(?:สอดแนม|ธรณีสูบ|Cost|POWER|Gem|GEM)\s*(?:ไม่เกิน\s*)?\d+(?:\s*ใบ)?/g, " "); const m = c.match(/(สูงสุด|ไม่เกิน)?\s*(\d+)\s*ใบ/); return { n: m ? +m[2] : 1, upTo: !!(m && m[1]) || /สามารถ/.test(t) }; };

// one sentence → ops (or false when it can't be read safely)
function sentence(s, t, p, self, ctx) {
  const f0 = filterOf(t); if (f0.bad) return false;
  const ops = []; const say = [];
  const verbs = VERBS.filter((v) => v.test(t)).length - (/ควบคุม/.test(t) && /สภาพนอน/.test(t) ? 1 : 0);
  if (verbs > 1) return false; // several different actions in one clause: too risky to guess
  if (/\sและ\s/.test(t.replace(/["“][^"”]*["”]/g, "")) && !KWGRANT.test(t)) return false; // a second action joined with "และ" that the splitter did not recognise
  const O = s.P[1 - p], P = s.P[p]; const ref = ctx.ref || {};
  const pickN = (t) => howMany(t).n;
  const named = (f) => f.name || f.names || f.symbol || f.symbols || f.text || f.collab;
  const typed = (x, f) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type || (f.type === "A" && E.def(s, x).t === "T")) && !(f.other && self && x.i === self.i);
  // "that Avatar" / "the attacker" in answers to an attack, a summon or a fight
  const refCard = () => { const i = /ที่(?:ประกาศ)?โจมตี|ผู้โจมตี|ใบที่โจมตี/.test(t) && ref.att != null ? ref.att : /ที่ต่อสู้ด้วย/.test(t) && ref.foe != null ? ref.foe : /ใบนั้น|ตัวนั้น|ที่เป็นเป้าหมาย|ที่ต่อสู้ด้วย|ที่ถูกอัญเชิญ|ที่อัญเชิญ/.test(t) && ref.that != null ? ref.that : null; const L = i != null ? E.locate(s, i) : null; return L && L.z === "av" ? L.x : null; };
  const oppAv = (f) => O.av.filter((x) => typed(x, f) && !E.noAim(s, x)).sort((a, b) => val(s, b) - val(s, a));
  const me = ctx.me;
  if (/สวม/.test(t)) { // "bring X onto this Avatar" / "put this card onto an Avatar"
    let m;
    if (verbs === 0 && (m = t.match(/^(?:สามารถ)?นำ\s*(.+?)\s*จาก(?:ใน)?\s*(Deck|นรก)(.*?)มาสวม(?:ใส่)?(?:ให้|ที่)?(?:กับ)?\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*$/)) && !(self && E.locate(s, self.i).z === "av")) { say.push("Avatar ใบนี้ไม่อยู่บนสนามแล้ว ไม่มีอะไรให้สวมใส่"); return { ops, say }; }
    if (verbs === 0 && self && (m = t.match(/^(?:สามารถ)?นำ\s*(.+?)\s*จาก(?:ใน)?\s*(Deck|นรก)(.*?)มาสวม(?:ใส่)?(?:ให้|ที่)?(?:กับ)?\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*$/)) && E.locate(s, self.i).z === "av") {
      const f = filterOf(m[1] + " " + m[3]); if (f.bad || !(named(f) || f.st)) return false; const zone = m[2] === "Deck" ? P.deck : P.hell; const seen = new Set();
      const cands = zone.filter((x) => typed(x, f)).filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; });
      const got = ctx.choose(cands, 1, `เลือกการ์ดจาก${m[2] === "Deck" ? " Deck" : "นรก"}มาสวมใส่ให้ ${E.name(s, self)}`, { optional: /สามารถ/.test(t) })[0];
      if (got) { ops.push({ op: "attach", i: got.i, on: self.i }); say.push(`${E.name(s, got)} มาสวมใส่ให้ ${E.name(s, self)}`); } else say.push("ไม่มีการ์ดที่ตรงเงื่อนไข"); if (m[2] === "Deck") ops.push({ op: "shuffle", seat: p });
      return { ops, say };
    }
    const it = self || me; const itZ = it ? (E.locate(s, it.i) || {}).z : null;
    if (verbs === 0 && it && (m = t.match(/^(?:สามารถ)?นำ\s*(?:การ์ด|Avatar)\s*(?:ใบนี้|ตัวนี้)(?:\s*(?:ที่อยู่)?(?:บน|ใน)\s*Avatar Zone)?\s*ไปสวม(?:ใส่)?ให้(?:กับ)?\s*(.+?)(?:\s*ได้)?$/)) && ["av", "hell", "hand"].includes(itZ)) {
      const f = filterOf(m[1].replace(/(?:ที่อยู่)?\s*(?:บน|ใน)\s*Avatar Zone\s*(?:ฝ่าย|ของ)?เรา/, " ")); if (f.bad) return false; const cands = P.av.filter((x) => x.i !== it.i && typed(x, { ...f, type: null })).sort((a, b) => E.power(s, b) - E.power(s, a));
      const h = ctx.choose(cands, 1, `เลือก Avatar ที่จะสวมใส่ ${E.name(s, it)}`, { optional: /สามารถ/.test(t) })[0];
      if (h) { ops.push({ op: "attach", i: it.i, on: h.i }); say.push(`${E.name(s, it)} ไปสวมใส่ให้ ${E.name(s, h)}`); } else say.push("ไม่มี Avatar ให้สวมใส่"); return { ops, say };
    }
    return false;
  }
  if (/Land\s*Magic/i.test(t) && !/ขึ้นมือ|นรก/.test(t)) {
    let m;
    if ((m = t.match(/^ทำลาย(?:การ์ด)?\s*Land\s*Magic\s*(?:1\s*ใบ\s*)?(?:(?:บน|ใน)\s*(?:Land\s*Magic\s*Zone|สนาม))?\s*$/i))) {
      { const on = E.lands(s); const L0 = on.length > 1 ? ctx.choose([...on].sort((a, b) => (a.o === p) - (b.o === p)), 1, "เลือก Land Magic ที่จะทำลาย", { exact: true })[0] : on[0]; if (L0 && !ctx.landGone) { ops.push({ op: "destroy", i: L0.i, why: "จากเอฟเฟกต์" }); say.push(`ทำลาย Land Magic ${E.name(s, L0)}`); ctx.landGone = true; } else if (!L0) return { ops, say, fail: "ไม่มี Land Magic บนสนาม ความสามารถไม่ทำงาน" }; else say.push("ไม่มี Land Magic บนสนาม"); return { ops, say }; } // FAQ แมลงปอแจ็ค
    }
    if ((m = t.match(/^(?:สามารถ\s*)?(?:นำ|สั่งใช้|ใช้)\s*Land\s*Magic\s*(?:["“]([^"”]+)["”]\s*)?(?:1\s*ใบ\s*)?จาก(?:ใน)?\s*Deck\s*(?:(?:ฝ่าย|ของ)?เรา)?\s*(?:1\s*ใบ\s*)?(?:มา(?:เล่น|วาง|ใช้)?(?:ไว้)?\s*(?:บน|ใน|ที่)\s*(?:Land\s*Magic\s*Zone|สนาม)(?:\s*(?:ฝ่าย)?เรา)?)?\s*$/i))) {
      const seen = new Set(); const cands = P.deck.filter((x) => { const d = E.def(s, x); return d.t === "M" && d.st === "L" && (!m[1] || String(d.n).includes(m[1])); }).filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; });
      if (s.mu[p].L) return { ops: [], say: [], fail: "เทิร์นนี้ใช้ Land Magic ไปแล้ว (การนำ Land Magic มาเล่นนับเป็นการใช้สิทธิ์นั้น)" }; // FAQ แมลงปอแจ็ค
      { const why = E.landPlayBlocked(s, p); if (why) return { ops: [], say: [], fail: why }; } // FAQ กัฟแดน
      const got = ctx.choose(cands, 1, "เลือก Land Magic จาก Deck มาเล่นบนสนาม", { optional: /สามารถ/.test(t) })[0];
      if (got) { ops.push({ op: "toLand", i: got.i }, { op: "mu", seat: p, k: "L" }, { op: "shuffle", seat: p }); say.push(`นำ ${E.name(s, got)} จาก Deck มาเล่นบน Land Magic Zone`); } else { ops.push({ op: "shuffle", seat: p }); say.push("ไม่มี Land Magic ใน Deck"); }
      return { ops, say };
    }
  }
  if (verbs === 0 && /ก่อสร้าง/.test(t) && /จาก(?:ใน)?\s*(?:บน)?\s*(?:Deck|นรก|มือ)/.test(t) && !OPP.test(t) && !/ใบนี้|ตัวนี้/.test(t)) { // build a Construct from the Deck / hell / hand
    const zm = t.match(/จาก(?:ใน)?\s*(?:บน)?\s*(Deck|นรก|มือ)/); const zone = zm[1] === "Deck" ? P.deck : zm[1] === "นรก" ? P.hell : P.hand;
    const f = filterOf(t.replace(/จาก(?:ใน)?\s*(?:บน)?\s*(?:Deck|นรก|มือ)(?:\s*(?:ฝ่าย|ของ)?เรา)?/, " ").replace(/ก่อสร้าง|Construct\s*Card|Construct|Zone/g, " ")); if (f.bad || !named(f) || pickN(t) > 1) return false;
    if (P.cs.length >= 3) { say.push("Construct Zone เต็ม"); return { ops, say }; }
    const seen = new Set(); const cands = zone.filter((x) => E.def(s, x).t === "C" && fits(s, x, f) && !P.cs.some((y) => E.def(s, y).n === E.def(s, x).n)).filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; });
    const got = ctx.choose(cands, 1, "เลือก Construct ที่จะก่อสร้าง", { optional: /สามารถ/.test(t) })[0];
    if (got) { ops.push({ op: "move", i: got.i, to: "cs", seat: p }); say.push(`ก่อสร้าง ${E.name(s, got)} จาก${zm[1] === "Deck" ? " Deck" : zm[1]}`); } else say.push("ไม่มี Construct ที่ตรงเงื่อนไข");
    if (zm[1] === "Deck") ops.push({ op: "shuffle", seat: p });
    return { ops, say };
  }
  const ZZ = /จาก(?:ใน)?\s*(?:บน)?\s*(Deck|นรก|มือ)(?:\s*(?:ฝ่าย|ของ)?เรา)?\s*หรือ\s*(?:จาก)?\s*(?:ใน)?\s*(?:บน)?\s*(Deck|นรก|มือ)(?:\s*(?:ฝ่าย|ของ)?เรา)?/;
  if (verbs === 0 && ZZ.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t) && !OPP.test(t)) { // "from the Deck or hell" / "from the hand or Deck"
    const zm = t.match(ZZ); const zones = [zm[1], zm[2]]; const to = /อัญเชิญ|Avatar Zone/.test(t) ? "av" : "hand"; if (to === "hand" && zones.includes("มือ")) return false;
    const f = filterOf(t.replace(ZZ, " ")); if (f.bad || !named(f) || pickN(t) > 1) return false;
    if (to === "av" && Math.min(4 - E.avatars(P), 6 - P.av.length) <= 0) { say.push("Avatar Zone เต็ม"); return { ops, say }; }
    const pool = (z) => (z === "Deck" ? P.deck : z === "นรก" ? [...P.hell].reverse() : P.hand.filter((x) => !(me && x.i === me.i)));
    const seen = new Set(); const cands = [...pool(zones[0]), ...pool(zones[1])].filter((x) => typed(x, f) && (to !== "av" || E.def(s, x).t === "A")).filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => val(s, b) - val(s, a));
    const got = ctx.choose(cands, 1, `เลือกการ์ดจาก${zones.join("หรือ")}`, { optional: /สามารถ/.test(t) })[0];
    const jt = /อัญเชิญ\s*(?:พอดี\s*)?จุติ/.test(t); const exact = /อัญเชิญ\s*พอดี\s*จุติ/.test(t);
    if (got) { const inDeck = P.deck.includes(got); const from = inDeck ? " Deck" : P.hand.includes(got) ? "มือ" : "นรก"; ops.push(to === "av" ? { op: "put", i: got.i, jt, ...(exact ? { exact: true } : {}) } : inDeck ? { op: "search", seat: p, take: got.i, to: "hand" } : { op: "move", i: got.i, to: "hand" }); if (inDeck && to === "av") ops.push({ op: "shuffle", seat: p }); say.push(`นำ ${E.name(s, got)} จาก${from}${to === "av" ? "ลงสนาม" : "ขึ้นมือ"}`); } else say.push("ไม่มีการ์ดที่ตรงเงื่อนไข");
    return { ops, say };
  }
  if (verbs === 0 && /อัญเชิญ/.test(t) && /จาก(?:บน)?มือ(?:เรา)?/.test(t) && !/Deck|นรก/.test(t) && !OPP.test(t)) { // free summon from hand
    const f = filterOf(t.replace(/จาก(?:บน)?มือ(?:เรา)?/, " ")); if (f.bad || pickN(t) > 1) return false; if (E.avatars(P) >= 4) { say.push("Avatar Zone เต็ม"); return { ops, say }; }
    // the best one to put down for free: the most Cost saved and POWER gained, but not one whose จุติ would be lost (no Cost paid)
    const freeV = (x) => { const d = E.def(s, x); return (d.c || 0) * 1.5 + E.power(s, x) * 0.6 - (/จุติ/.test(d.x || "") && !/อัญเชิญ\s*(?:พอดี\s*)?จุติ/.test(t) ? 3.5 : 0); };
    const cands = P.hand.filter((x) => E.def(s, x).t === "A" && typed(x, f) && !(me && x.i === me.i)).sort((a, b) => freeV(b) - freeV(a));
    const got = ctx.choose(cands, 1, "เลือก Avatar บนมือที่จะอัญเชิญ", { optional: true })[0];
    if (got) { ops.push({ op: "put", i: got.i, jt: /อัญเชิญ\s*(?:พอดี\s*)?จุติ/.test(t) }); say.push(`อัญเชิญ ${E.name(s, got)} จากมือ`); } else say.push("ไม่อัญเชิญจากมือ"); return { ops, say };
  }
  if (me && /(?:อัญเชิญ|นำ|ก่อสร้าง)\s*(?:การ์ด|Avatar|Construct)\s*(?:ใบนี้|นี้)/.test(t) && !/สวมใส่|Magic Zone|มิติมืด/.test(t) && verbs === 0) {
    const L = E.locate(s, me.i); if (!L || ["av", "cs", "mg", "land"].includes(L.z)) return false; // only for a card that is off the field (hell / hand / deck)
    const to = /ก่อสร้าง/.test(t) ? "cs" : /อัญเชิญ|Avatar Zone/.test(t) ? "av" : /ขึ้นมือ/.test(t) ? "hand" : /Deck/.test(t) ? "deck" : null; if (!to) return false;
    if (to === "av" && E.avatars(P) >= 4) { say.push("Avatar Zone เต็ม"); return { ops, say }; } if (to === "cs" && P.cs.length >= 3) { say.push("Construct Zone เต็ม"); return { ops, say }; }
    if (/สามารถ/.test(t) && ctx.mode([`ทำ: ${t.length > 60 ? t.slice(0, 58) + "…" : t}`, "ไม่ทำ"], E.name(s, me), 0) !== 0) { say.push("ไม่ใช้ความสามารถ"); return { ops, say }; }
    ops.push(to === "av" ? { op: "put", i: me.i } : to === "cs" ? { op: "move", i: me.i, to: "cs", seat: p } : to === "hand" ? { op: "move", i: me.i, to: "hand" } : { op: "move", i: me.i, to: "deckBottom" }); if (to === "deck") ops.push({ op: "shuffle", seat: p });
    say.push(`${E.name(s, me)} ${to === "av" ? "ลงสนาม" : to === "cs" ? "ถูกก่อสร้าง" : to === "hand" ? "ขึ้นมือ" : "กลับเข้า Deck"}`);
  } else if (/ยกเลิก/.test(t)) {
    if (t.replace(/ยกเลิก\s*(?:การโจมตี|ผล|ความสามารถ|การใช้(?:งาน)?)\s*(?:ของ)?\s*(?:การ์ด|Magic(?:\s*Card)?)?\s*(?:ใบ)?\s*(?:นั้น|ครั้งนั้น)?/, "").replace(/[\s.]/g, "").length > 2) return false; // something else is going on in this sentence
    if (/การโจมตี/.test(t) && ref.cancel) { ops.push({ op: "cancelAttack" }); say.push("ยกเลิกการโจมตี"); }
    else if (/ผล|ความสามารถ|การใช้/.test(t) && ref.magic != null) { ops.push({ op: "negate", i: ref.magic }); say.push("ยกเลิกผลของการ์ดนั้น"); }
    else return false;
  } else if (/ทำลาย/.test(t)) {
    const rc = refCard();
    if (rc) { ops.push({ op: "destroy", i: rc.i, why: "จากเอฟเฟกต์" }); say.push(`ทำลาย ${E.name(s, rc)}`); }
    else {
      const anySide = !OPP.test(t) && /บนสนาม(?!\s*(?:ฝ่าย)?เรา)|บน\s*Avatar Zone(?!\s*(?:ฝ่าย|ของ)?เรา)/.test(t) && !/ฝ่ายเรา|ของเรา|ใบนี้|ตัวนี้/.test(t);
      if ((!OPP.test(t) && !anySide) || /นรก|Deck|มือ|Magic Zone|มิติมืด/.test(t)) return false;
      const f = f0; if (/Cost|POWER/.test(t) && f.maxCost == null && f.maxPower == null && f.minCost == null && f.cost == null && f.power == null) return false;
      const all = /ทุกใบ|ทั้งหมด/.test(t); const hm = howMany(t); const n = all ? 99 : hm.n;
      const cands = (/Construct/.test(t) ? O.cs.filter((x) => fits(s, x, f)) : f.type === "M" ? [...O.mg, ...E.lands(s).filter((l) => l.o === 1 - p)].filter((x) => typed(x, f)) : /การ์ด(?:บนสนาม)?\s*\d/.test(t) && !/Avatar/.test(t) ? [...oppAv({ ...f, type: null }), ...O.cs] : oppAv(f));
      // "Avatar บนสนาม": an Avatar in any zone of the field, the Magic Zone too (FAQ บีมมมมมมมมมม) · "บน Avatar Zone" only there
      if (!/Construct/.test(t) && f.type !== "M" && /Avatar[^:]*บนสนาม|บนสนาม[^:]*Avatar/.test(t) && !/Avatar Zone/.test(t)) cands.push(...O.mg.filter((x) => !x.fd && ["A", "T"].includes(E.def(s, x).t) && typed(x, f) && !E.noAim(s, x)));
      // "ทุกใบ / ทั้งหมด" picks nothing, so cards that cannot be targeted go too (FAQ กวนอู ขุนพลภักดีแห่งจ๊กก๊ก)
      if (all && !/Construct/.test(t) && f.type !== "M") for (const x of O.av) if (typed(x, f) && !cands.includes(x)) cands.push(x);
      if (anySide && !all) cands.push(...P.av.filter((x) => typed(x, f) && !(self && x.i === self.i)).sort((a, b) => val(s, a) - val(s, b)));
      // "ทำลาย MAGIC บนสนาม": Magic cards only, ours after theirs — never an Avatar, not even one lying in a Magic Zone or worn (FAQ แมลงปอเลื่อยยนต์)
      if (anySide && !all && f.type === "M") cands.push(...[...P.mg, ...E.lands(s).filter((l) => l.o === p)].filter((x) => typed(x, f)));
      // "ทำลายการ์ดบนสนาม 1 ใบ" with nothing else there: it has to be this card itself (FAQ พระอิศวร เทพผู้ทำลาย: the ability is not optional)
      if (anySide && !all && !cands.length && self && !hm.upTo && !/ใบอื่น|สามารถ/.test(t) && (!f.type || E.def(s, self).t === f.type)) cands.push(self);
      const pool = all ? cands : ctx.choose(cands, n, `เลือกการ์ด${anySide ? "บนสนาม" : "ฝ่ายตรงข้าม"}ที่จะทำลาย (${hm.upTo ? "สูงสุด " : ""}${n} ใบ)`, { optional: hm.upTo }); if (all && !cands.length) missed(ctx);
      for (const x of pool) ops.push({ op: "destroy", i: x.i, why: "จากเอฟเฟกต์" });
      say.push(pool.length ? `ทำลาย ${pool.map((x) => E.name(s, x)).join(", ")}` : "ไม่มีเป้าหมายให้ทำลาย");
    }
  } else if (/สูญเสียความสามารถ|เสียความสามารถ|ความสามารถ.*ไร้ผล/.test(t)) {
    const until = /เทิร์น(?:ถัดไป)?\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)/.test(t) ? "oppturn" : "turn"; const rc = refCard();
    if (!rc && !OPP.test(t)) return false;
    const tgt = rc ? [rc] : /ทุกใบ|ทั้งหมด/.test(t.replace(/ความสามารถ\s*ทั้งหมด/g, "")) ? oppAv({ ...f0, type: null }) : ctx.choose(oppAv(f0), pickN(t), "เลือก Avatar ฝ่ายตรงข้ามที่จะสูญเสียความสามารถ");
    if (!tgt.length) missed(ctx); for (const x of tgt) ops.push({ op: "mute", i: x.i, until }); say.push(tgt.length ? `${tgt.map((x) => E.name(s, x)).join(", ")} สูญเสียความสามารถ` : "ไม่มีเป้าหมาย");
  } else if (/ทำความเสียหาย/.test(t)) {
    if (!/LIFE/i.test(t) || !OPP.test(t)) return false; const n = num(t, /(\d+)\s*ครั้ง/);
    for (let k = 0; k < Math.min(n, 3); k++) ops.push({ op: "lifeDamage", seat: 1 - p }); say.push(`ทำความเสียหาย LIFE ฝ่ายตรงข้าม ${n} ครั้ง`);
  } else if (/ควบคุม/.test(t)) {
    if (/(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)/.test(t)) { if (!self || !OPP.test(t) || /จน/.test(t)) return false; const O = s.P[1 - p]; if (E.avatars(O) >= 4 || O.av.length >= 6) { missed(ctx); say.push("Avatar Zone ฝ่ายตรงข้ามเต็ม ย้ายไปไม่ได้"); return { ops, say }; }
      ops.push({ op: "control", i: self.i, seat: 1 - p }); say.push(`${E.name(s, self)} ย้ายไปอยู่ฝ่ายตรงข้าม`); return { ops, say }; }
    if (!OPP.test(t) || !/Avatar/.test(t) || /Draw Phase|ถัดไป/.test(t)) return false;
    const temp = /จนจบเทิร์น/.test(t); const asleep = /สภาพนอน/.test(t); if (E.avatars(P) >= 4) { if (!/สามารถ/.test(t)) missed(ctx); say.push("Avatar Zone เราเต็ม"); return { ops, say }; }
    const x = ctx.choose(oppAv({ ...f0, type: null }).filter((y) => !y.tok && !E.noControl(s, y)), 1, "เลือก Avatar ฝ่ายตรงข้ามที่จะควบคุม", { optional: /สามารถ/.test(t) })[0];
    if (x) { ops.push({ op: "control", i: x.i, seat: p, ...(temp ? { until: "turn" } : {}), ...(asleep ? { asleep: true } : {}) }); say.push(`ควบคุม ${E.name(s, x)}${temp ? " จนจบเทิร์น" : ""}`); } else say.push("ไม่มีเป้าหมาย");
  } else if (/เนรเทศ/.test(t)) {
    if (/Deck|มือ/.test(t)) return false;
    if (/นรก/.test(t)) { const seat = OPP.test(t) ? 1 - p : p; const hm = howMany(t); const pool = [...s.P[seat].hell].reverse().filter((x) => typed(x, f0));
      const got = ctx.choose(pool, hm.n, `เนรเทศการ์ดในนรก${seat === p ? "เรา" : "ฝ่ายตรงข้าม"} ${hm.n} ใบ`, { optional: hm.upTo }); for (const x of got) ops.push({ op: "exile", i: x.i }); say.push(got.length ? `เนรเทศ ${got.map((x) => E.name(s, x)).join(", ")}` : "ไม่มีการ์ดให้เนรเทศ"); }
    else { const rc = refCard(); if (!rc && !OPP.test(t)) return false; const tgt = rc ? [rc] : ctx.choose(oppAv(f0), pickN(t), "เลือก Avatar ฝ่ายตรงข้ามที่จะเนรเทศ");
      for (const x of tgt) ops.push({ op: "exile", i: x.i }); say.push(tgt.length ? `เนรเทศ ${tgt.map((x) => E.name(s, x)).join(", ")}` : "ไม่มีเป้าหมาย"); }
  } else if (/สอดแนม\s*(\d+)/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const n = num(t, /สอดแนม\s*(\d+)/); const f = filterOf(t.replace(/สอดแนม\s*\d+\s*ใบ/, ""));
    if (f.bad || !(named(f) || f.type) || pickN(t.replace(/สอดแนม\s*\d+\s*ใบ/, "")) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน|สวม|Magic Zone/.test(t)) return false;
    const to = /อัญเชิญ|ลงบน\s*Avatar Zone/.test(t) ? "av" : "hand"; if (to === "hand" && !/สามารถ/.test(t) && E.deckHandBlocked(s, p, s.cards[ctx.t.c])) missed(ctx);
    if (ctx.deferred) { ops.push({ op: "scout", seat: p, n, ...f, to }); say.push(`สอดแนม ${n} ใบ หาการ์ดที่ตรงเงื่อนไข`); }
    else { const top = P.deck.slice(0, n); const cands = top.filter((x) => typed(x, f));
      const why = whyMap(top.map((x) => x.i), cands, (i) => { const x = top.find((y) => y.i === i); return f.other && self && x.i === self.i ? "ใบเดียวกับที่ใช้" : whyX(s, x, f); });
      const got = ctx.choose(cands, 1, `สอดแนม ${n} ใบ: เลือกการ์ดที่จะ${to === "av" ? "อัญเชิญ" : "นำขึ้นมือ"}`, { optional: /สามารถ/.test(t), reveal: top.map((x) => x.i), why })[0];
      ops.push({ op: "scout", seat: p, n, to, ...(got ? { take: got.i } : { none: true }) }); say.push(got ? `สอดแนม ${n} ใบ ได้ ${E.name(s, got)}` : `สอดแนม ${n} ใบ ไม่ได้การ์ดที่ตรงเงื่อนไข`); }
  } else if (/สอดแนม/.test(t)) { if (/นำ|เลือก|อัญเชิญ|ขึ้นมือ/.test(t) || !/เรียง|ตามใจ/.test(t)) return false; say.push("สอดแนม (ดูการ์ดบนสุดของ Deck แล้วเรียงตามเดิม)"); }
  else if (/จั่วการ์ด/.test(t)) {
    const dm = t.match(/จั่วการ์ด\s*(?:จาก\s*Deck\s*(?:เรา\s*)?)?(คนละ\s*)?(\d+)\s*ใบ/); if (!dm) return false; const n = +dm[2];
    const seats = dm[1] || /แต่ละฝ่าย/.test(t) ? [p, 1 - p] : seatOf(t.split("จั่ว")[0], p); for (const q of seats) ops.push({ op: "draw", seat: q, n });
    if (seats.some((q) => E.deckHandBlocked(s, q, s.cards[ctx.t.c]))) missed(ctx); // Rule Book ล้มโต๊ะ / FAQ แมวนิค: a player who cannot take cards from the Deck
    say.push(`${seats.length > 1 ? "ทุกคน" : seats[0] === p ? "" : "ฝ่ายตรงข้าม"}จั่ว ${n} ใบ`);
  } else if (/นำการ์ดบนมือ.*ทั้งหมด.*กลับเข้า\s*Deck/.test(t)) {
    const seats = /ทั้ง\s*2\s*ฝ่าย|ผู้เล่นทุกคน|ทั้งสองฝ่าย/.test(t) ? [p, 1 - p] : OPP.test(t) ? [1 - p] : [p]; if (seats.length > 1 && seats.some((q) => !s.P[q].hand.filter((x) => x.i !== (ctx.me || {}).i).length)) return { ops: [], say: [], fail: "ผู้เล่นทุกคนต้องมีการ์ดบนมือให้นำกลับเข้า Deck ได้" }; // FAQ ล้มโต๊ะ
    for (const q of seats) ops.push({ op: "handToDeck", seat: q }); say.push(`${seats.length > 1 ? "ทุกคน" : ""}นำการ์ดบนมือทั้งหมดกลับเข้า Deck แล้วสับ`);
  } else if (/ธรณีสูบ/.test(t)) {
    const n = num(t, /ธรณีสูบ\s*(?:\([^)]*\)\s*)?(\d+)/); for (const q of seatOf(t.split("ธรณีสูบ")[0], p)) ops.push({ op: "mill", seat: q, n }); say.push(`ธรณีสูบ ${n} ใบ`);
  } else if (/(?:ส่ง|นำ).*จาก(?:ใน)?\s*Deck.*ลงนรก/.test(t)) {
    const f = filterOf(t.replace(/จาก(?:ใน)?\s*Deck[^ ]*/, "")); if (f.bad || !named(f) || OPP.test(t) || pickN(t) > 1) return false;
    const seenN = new Set(); const cands = P.deck.filter((x) => typed(x, f)).filter((x) => { const k = E.def(s, x).n; if (seenN.has(k)) return false; seenN.add(k); return true; });
    const got = ctx.choose(cands, 1, "เลือกการ์ดจาก Deck ที่จะส่งลงนรก", { optional: /สามารถ/.test(t) })[0];
    if (got) { ops.push({ op: "move", i: got.i, to: "hell" }, { op: "shuffle", seat: p }); say.push(`ส่ง ${E.name(s, got)} จาก Deck ลงนรก`); } else say.push("ไม่มีการ์ดใน Deck ที่ตรงเงื่อนไข");
  } else if (/(?:จาก|ใน)(?:ใน)?\s*นรก/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone|Deck/.test(t)) {
    const f = f0; const hm = howMany(t); const toDeck = !/ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t); if (!toDeck && !named(f) && !f.type || hm.n > 3 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน|ใครก็ได้/.test(t)) return false;
    const to = /อัญเชิญ|Avatar Zone/.test(t) ? "av" : /ขึ้นมือ/.test(t) ? "hand" : /บนสุด/.test(t) ? "top" : "deck"; const jt = to === "av" && /อัญเชิญ\s*(?:พอดี\s*)?จุติ/.test(t);
    const cands = [...P.hell].reverse().filter((x) => typed(x, f)).sort((a, b) => val(s, b) - val(s, a));
    if (ctx.deferred) { ops.push({ op: "fromHell", seat: p, ...f, to }); say.push("นำการ์ดจากนรก"); }
    else if (to === "av" && Math.min(4 - E.avatars(P), 6 - P.av.length) <= 0) { if (!hm.upTo) missed(ctx); say.push("Avatar Zone เต็ม อัญเชิญจากนรกไม่ได้"); }
    else { const got = ctx.choose(cands, to === "av" ? Math.min(hm.n, 4 - E.avatars(P), 6 - P.av.length) : hm.n, `เลือกการ์ดจากนรก${hm.n > 1 ? ` (${hm.upTo ? "สูงสุด " : ""}${hm.n} ใบ)` : ""}`, { optional: hm.upTo });
      if (!got.length) say.push("ไม่มีการ์ดในนรกที่ตรงเงื่อนไข");
      for (const x of got) ops.push(to === "av" ? { op: "put", i: x.i, jt } : to === "hand" ? { op: "move", i: x.i, to: "hand" } : { op: "move", i: x.i, to: to === "top" ? "deckTop" : "deckBottom" });
      if (got.length && to === "deck") ops.push({ op: "shuffle", seat: p });
      if (got.length) say.push(`นำ ${got.map((x) => E.name(s, x)).join(", ")} จากนรก${to === "av" ? "ลงสนาม" : to === "hand" ? "ขึ้นมือ" : to === "top" ? "ไว้บนสุดของ Deck" : "กลับเข้า Deck"}`); }
  } else if (/จาก(?:ใน)?\s*Deck/.test(t) && /ขึ้นมือ|อัญเชิญ|Avatar Zone/.test(t)) {
    const f = filterOf(t.replace(/จาก(?:ใน)?\s*Deck[^ ]*/, "")); if (f.bad || !named(f) || pickN(t) > 1 || /อีกฝ่าย|ฝ่ายตรงข้าม|ผู้เล่นทุกคน/.test(t)) return false;
    const to = /อัญเชิญ|Avatar Zone/.test(t) ? "av" : "hand";
    const seenN = new Set(); const cands = ctx.deferred ? [] : P.deck.filter((x) => typed(x, f)).filter((x) => { const k = E.def(s, x).n; if (seenN.has(k)) return false; seenN.add(k); return true; }).sort((a, b) => val(s, b) - val(s, a));
    const got = ctx.deferred ? null : ctx.choose(cands, 1, "เลือกการ์ดจาก Deck", { optional: /สามารถ/.test(t) })[0];
    if (to === "hand" && !/สามารถ/.test(t) && E.deckHandBlocked(s, p, s.cards[ctx.t.c])) missed(ctx);
    if (!ctx.deferred && !got) { ops.push({ op: "shuffle", seat: p }); say.push("ไม่มีการ์ดใน Deck ที่ตรงเงื่อนไข"); }
    else { ops.push({ op: "search", seat: p, ...(got ? { take: got.i } : f), to }); say.push(got ? `ค้น ${E.name(s, got)} จาก Deck` : `ค้น ${f.name || f.symbol || "การ์ด"} จาก Deck`); }
  } else if (KWGRANT.test(t)) {
    const k = t.match(KWGRANT)[1]; if (!/จนจบเทิร์น|เทิร์นนี้/.test(t) && ctx.when !== "cast") return false;
    const until = /เทิร์น(?:ถัดไป)?\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)/.test(t) ? "oppturn" : /จนจบเทิร์น|เทิร์นนี้/.test(t) ? "turn" : null; const rc = refCard(); // no duration written: it stays
    const tgt = rc ? [rc] : self && /ใบนี้|ตัวนี้/.test(t) ? [self] : /ทุกใบ/.test(t) ? P.av.filter((x) => typed(x, f0)) : ctx.choose(P.av.filter((x) => typed(x, f0)).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, `เลือก Avatar ฝ่ายเราที่จะได้รับ ${k}`);
    if (!tgt.length) missed(ctx); for (const x of tgt) ops.push({ op: "keyword", i: x.i, k, until }); say.push(tgt.length ? `${tgt.map((x) => E.name(s, x)).join(", ")} ได้รับ ${k}` : "ไม่มีเป้าหมาย");
    const pm = t.match(/POWER\s*([+\-−–])\s*(\d+)/); if (pm) for (const x of tgt) ops.push({ op: "power", i: x.i, n: (pm[1] === "+" ? 1 : -1) * +pm[2], temp: until === "oppturn" ? "next" : until ? true : false });
  } else if (/POWER\s*([+\-−–])\s*(\d+)/.test(t)) {
    const m = t.match(/POWER\s*([+\-−–])\s*(\d+)/); const times = num(t, /POWER\s*[+\-−–]\s*\d+\s*(\d+)\s*ครั้ง/, 1); const v = (m[1] === "+" ? 1 : -1) * +m[2] * Math.min(times, 9);
    let temp = /Draw Phase (?:ถัดไป|ต่อไป)|จนจบเทิร์น(?:ถัดไป)?\s*(?:ของ)?\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)/.test(t) ? "next" : /จนจบการต่อสู้/.test(t) ? "fight" : /จนจบเทิร์น|เทิร์นนี้/.test(t) ? true : ["cast", "attack", "attacked", "activate", "win", "summon", "death", "life", "paid", "milled"].includes(ctx.when) && !/จนถึง|จนกว่า/.test(t) ? false : null; // no duration on the card: permanent (as ริมุรุ plays it)
    if (temp == null && (ctx.when === "end" || ctx.when === "mainStart") && !/จนถึง|จนกว่า/.test(t)) temp = false; // a printed timed boost stays
    if (temp == null) return false; // continuous wording: leave it
    const f = f0; let tgt; const rc = refCard();
    if (rc) tgt = [rc];
    else if (self && (/ใบนี้|ตัวนี้/.test(t) || (!/เลือก|ฝ่าย|ทุกใบ|Avatar|\{/.test(t.split("POWER")[0]) && v > 0))) tgt = [self];
    else {
      const opp = OPP.test(t) || (v < 0 && !/ฝ่ายเรา|ของเรา|Zone\s*เรา/.test(t));
      const csOnly = /Construct/.test(t.split("POWER")[0]) && !/Avatar/.test(t.split("POWER")[0]); // "Construct ทุกใบ บน Construct Zone … POWER+1" (ไม่นะ ทองเหม็น!)
      const cands = (csOnly ? (opp ? O.cs : P.cs) : opp ? O.av.filter((x) => !E.noAim(s, x)) : P.av).filter((x) => csOnly || typed(x, f)).sort(opp ? (a, b) => (v < 0 ? val(s, b) - val(s, a) : val(s, a) - val(s, b)) : (a, b) => (b.a ? 1 : 0) - (a.a ? 1 : 0) || E.power(s, b) - E.power(s, a));
      tgt = /ทุกใบ|ทั้งหมด/.test(t) ? cands : ctx.choose(cands, 1, `เลือก Avatar ${opp ? "ฝ่ายตรงข้าม" : "ฝ่ายเรา"} ที่จะ POWER ${v > 0 ? "+" : ""}${v}`);
    }
    if (!tgt.length) { missed(ctx); say.push("ไม่มีเป้าหมาย POWER"); }
    for (const x of tgt) ops.push({ op: "power", i: x.i, n: v, temp });
    if (tgt.length) say.push(`${tgt.map((x) => E.name(s, x)).join(", ")} POWER ${v > 0 ? "+" : ""}${v}`);
  } else if (/สภาพนอน|เป็นนอน/.test(t)) {
    const rc = refCard(); if (!rc && !OPP.test(t)) return false;
    const cands = O.av.filter((x) => x.a && typed(x, f0) && !E.noAim(s, x)).sort((a, b) => E.power(s, b) - E.power(s, a));
    const tgt = rc ? [rc] : /ทุกใบ|ทั้งหมด/.test(t) ? cands : ctx.choose(cands, pickN(t), "เลือก Avatar ฝ่ายตรงข้ามที่จะทำให้นอน");
    if (!tgt.length) missed(ctx); for (const x of tgt) ops.push({ op: "wake", i: x.i, v: false }); say.push(tgt.length ? `ทำให้ ${tgt.map((x) => E.name(s, x)).join(", ")} นอน` : "ไม่มีเป้าหมายให้นอน");
  } else if (/สภาพตื่น|เป็นตื่น/.test(t)) {
    if (OPP.test(t)) return false;
    const tgt = /ใบนี้|ตัวนี้/.test(t) && self ? [self] : /ทุกใบ|ทั้งหมด/.test(t) ? P.av.filter((x) => !x.a && typed(x, f0)) : ctx.choose(P.av.filter((x) => !x.a && typed(x, f0)).sort((a, b) => E.power(s, b) - E.power(s, a)), 1, "เลือก Avatar ฝ่ายเราที่จะเปลี่ยนเป็นสภาพตื่น");
    if (!tgt.length) missed(ctx); for (const x of tgt) ops.push({ op: "wake", i: x.i, v: true }); say.push(tgt.length ? `ปลุก ${tgt.map((x) => E.name(s, x)).join(", ")}` : "ไม่มี Avatar ที่นอนอยู่");
  } else if (/(?:กลับ)?ขึ้นมือ/.test(t) && /Avatar/.test(t) && !/Deck|นรก|มิติมืด|Magic Zone/.test(t)) {
    const rc = refCard(); const opp = OPP.test(t); if (!rc && !opp && !/ฝ่ายเรา|ของเรา|Zone\s*เรา|สนามเรา/.test(t)) return false;
    const cands = opp ? oppAv(f0).filter((y) => !y.tok) : P.av.filter((y) => !y.tok && typed(y, f0)).sort((a, b) => val(s, a) - val(s, b));
    const x = rc || ctx.choose(cands, 1, `เลือก Avatar ${opp ? "ฝ่ายตรงข้าม" : "ฝ่ายเรา"} ที่จะกลับขึ้นมือ`, { optional: /สามารถ/.test(t) })[0];
    if (x) { ops.push({ op: "move", i: x.i, to: "hand" }); say.push(`ส่ง ${E.name(s, x)} กลับขึ้นมือ`); } else say.push("ไม่มีเป้าหมาย");
  } else if (/สุ่มทิ้ง/.test(t) && /มือ/.test(t)) { if (!OPP.test(t)) return false; const n = pickN(t); ops.push({ op: "discardRandom", seat: 1 - p, n }); say.push(`สุ่มทิ้งการ์ดบนมือฝ่ายตรงข้าม ${n} ใบ`); }
  else if (/ทิ้งการ์ด/.test(t) && /มือ/.test(t)) {
    if (OPP.test(t) || /ทั้งหมด|ทุกใบ|ผู้เล่นทุกคน/.test(t) || named(f0)) return false; const n = pickN(t);
    const pick = ctx.choose([...P.hand].filter((x) => x.i !== (ctx.me || {}).i).sort((a, b) => cardVal(s, a) - cardVal(s, b)), n, `ทิ้งการ์ดบนมือ ${n} ใบ`, { exact: true }); ops.push({ op: "discard", seat: p, iids: pick.map((x) => x.i) }); say.push(`ทิ้งการ์ดบนมือ ${pick.length} ใบ`);
  } else if (/หงาย\s*LIFE/i.test(t)) { const seat = OPP.test(t) ? 1 - p : p; if (/ทุกใบ|ทั้งหมด/.test(t)) return false; const n = Math.max(1, Math.min(5, (t.match(/LIFE[^\d]{0,20}?(\d)\s*ใบ/i) || [0, 1])[1] | 0)); for (let k = 0; k < n; k++) ops.push({ op: "lifeFlip", seat, up: true }); say.push(`หงาย LIFE ${seat === p ? "เรา" : "ฝ่ายตรงข้าม"} ${n} ใบ`); }
  else if (/คว่ำ\s*LIFE/i.test(t) && !OPP.test(t)) { if (E.critical(P) && !/แม้อยู่ในสถานะสาหัส/.test(t)) { if (!/สามารถ/.test(t)) missed(ctx); say.push("สถานะสาหัส คว่ำ LIFE ไม่ได้"); } else { const rnd = /สุ่ม\s*คว่ำ/.test(t); ops.push({ op: "lifeFlip", seat: p, up: false, ...(rnd ? { rnd: true } : {}), ...(/แม้อยู่ในสถานะสาหัส/.test(t) ? { force: true } : {}) }); say.push(`${rnd ? "สุ่มคว่ำ" : "คว่ำ"} LIFE เรา 1 ใบ`); } }
  else if ((/สับ\s*Deck|เรียง|ไว้ที่เดิม/.test(t) || (/ที่เหลือ/.test(t) && /ใต้\s*Deck|กลับเข้า\s*(?:กอง|Deck)/.test(t))) && !/เลือก|Avatar|นำ\s*["“{]|บนมือ/.test(t) || /^นำ(?:ไป)?(?:ไว้)?ใต้\s*Deck$/.test(t.trim()) || t.replace(/[\s.,]/g, "").length < 6) {
    // housekeeping words already covered by the ops above
  } else return false;
  return { ops, say };
}

// ---------- abilities written on a card ----------
const START = "เทิร์นละครั้ง|เทิรน์ละครั้ง|ต่อเนื่อง|อัตโนมัติ|อัติโนมัติ|สั่งใช้|คำสั่งเสีย|จุติ|\\[|#";
// cut one ability out of the text that follows its keyword (numbered "1) … 2) …" options stay attached)
function cutAbility(rest, whole) {
  rest = rest.split(new RegExp(`${whole ? "" : "\\n\\s*\\n(?!\\s*\\d\\s*[).])|"}\\n(?=\\s*(?:${START}))`))[0];
  rest = rest.split(/\s(?=ต่อเนื่อง|เทิร์นละครั้ง|เทิรน์ละครั้ง|อัตโนมัติ|อัติโนมัติ|คำสั่งเสีย\s*[(:]|จุติ\s*[(:]|\[Link|#)/)[0];
  return rest.replace(/^\s*\([^)]*\)/, "").replace(/\((?:ส่ง|แสดง|เมื่อ|ทำลาย|ดู)[^)]*\)/g, " ").replace(/\{red\s*\(([^)]*)\)\s*\}/gi, " ").replace(/\s+/g, " ").trim().replace(/^:\s*/, "");
}
const actCache = new Map();
// "สั่งใช้" abilities of a card: [{ k, once, text, where: "field"|"hand"|"hell"|"dark", timed }]
export function activations(text) {
  const t = String(text || ""); if (actCache.has(t)) return actCache.get(t);
  const out = []; const re = /(?:(เทิร์นละครั้ง|เทิรน์ละครั้ง)\s*)?สั่งใช้/g; let m;
  while ((m = re.exec(t))) {
    if (/(\{red|["“]|ได้รับ|มีการ)\s*$/i.test(t.slice(Math.max(0, m.index - 14), m.index)) || inRed(t, m.index)) continue; // an ability granted to something else, or a mention ("เมื่อมีการสั่งใช้ Magic")
    let rest = t.slice(m.index + m[0].length); if (/^\s*(งาน|ความสามารถ|ผล|ได้|ของ)/.test(rest)) continue;
    rest = cutAbility(rest);
    const wm = rest.match(/^จาก(?:บน|ใน)?\s*(มือ|นรก|มิติมืด)(?:เรา)?(?:\s*หรือ\s*Deck)?\s*/); const where = wm ? { มือ: "hand", นรก: "hell", มิติมืด: "dark" }[wm[1]] : "field"; if (wm) rest = rest.slice(wm[0].length);
    const timed = /^(เมื่อ|ในเทิร์นใครก็ได้|ในช่วง|หลังจาก|ใน\s*(?:Battle|Draw|End|Main)\s*Phase|ถ้าในเทิร์นนี้)/.test(rest);
    out.push({ k: out.length, once: !!m[1], text: rest, where, timed });
  }
  actCache.set(t, out); return out;
}
// when a React Magic may be used, read from its first words: { kinds, mine, f, rest }
// "เมื่อ Avatar "X" / {Symbol X} / รถถัง (ฝ่ายเรา) ตกเป็นเป้าหมายการโจมตี / ถูกโจมตี / ต่อสู้": one of OUR Avatars (of that kind) is attacked
const WHO = String.raw`(?:["“][^"”]+["”]|\{\s*[Ss]ymbol[^}]+\})(?:\s*(?:หรือ|,)\s*(?:["“][^"”]+["”]|\{\s*[Ss]ymbol[^}]+\}))*`;
const DEFENDER = new RegExp(String.raw`^เมื่อ\s*Avatar\s*(?:(?:ฝ่าย|ของ)?เรา\s*)?(?:(${WHO})\s*|([^\s"“{:]{2,30}?)\s*)?(?:ที่อยู่\s*)?(?:บน\s*(?:Avatar Zone|สนาม)\s*)?(?:(?:ฝ่าย|ของ)?เรา\s*)?(?:ตก)?(?:เป็นเป้าหมาย(?:ของ)?(?:การ)?โจมตี|ถูกโจมตี|เป็นเป้าโจมตี|ต่อสู้)\s*`);
// the filter for the attacked Avatar: null = any of ours, false = a name the reader does not know
function defenderFilter(m) {
  if (m[1]) { const f = filterOf("Avatar " + m[1].replace(/\s*(?:หรือ|,)\s*/g, " ")); const names = [...m[1].matchAll(/["“]([^"”]+)["”]/g)].map((q) => q[1].trim()); if (names.length > 1) { f.names = names; delete f.name; } delete f.bad; return f; }
  if (m[2]) { const w = m[2].trim(); if (/^(?:ใบนี้|ตัวนี้|ใบใด|ใด|ทุกใบ|ที่|ใบ|ฝ่ายเรา|ของเรา)$/.test(w) || !nameKnown(w)) return false; return { name: w }; }
  return null;
}
export function reactTiming(text) {
  const t = cutAbility(String(text || ""), true); let m;
  if ((m = t.match(/^(?:ใช้ได้)?เมื่อ\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*(?:ประกาศ|สั่ง)?\s*โจมตี\s*/))) return { kinds: ["attack"], rest: t.slice(m[0].length) };
  if ((m = t.match(/^เมื่อ\s*Avatar\s*(?:ของ)?(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*(?:ประกาศ)?โจมตี\s*(เข้ามา(?:ที่)?\s*LIFE(?:\s*Card)?\s*)?/))) return { kinds: ["attack"], life: !!m[1], rest: t.slice(m[0].length) };
  if ((m = t.match(/^เมื่อ\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*อัญเชิญ\s*Avatar\s*/))) return { kinds: ["summon"], rest: t.slice(m[0].length) };
  if ((m = t.match(/^เมื่อมีการ(?:สั่ง)?ใช้\s*Magic(?:\s*Card)?\s*/i))) return { kinds: ["cast"], rest: t.slice(m[0].length) };
  if ((m = t.match(DEFENDER))) { const f = defenderFilter(m); if (f === false) return null; return { kinds: ["attack"], mine: true, either: /ต่อสู้\s*$/.test(m[0]), f, rest: t.slice(m[0].length) }; }
  if ((m = t.match(/^เมื่อ(?:มี)?\s*Avatar\s*(?:ถูก)?อัญเชิญ(?:ลง(?:มา)?)?\s*(?:บน\s*(?:สนาม|Avatar Zone))?\s*/))) return { kinds: ["summon"], rest: t.slice(m[0].length) };
  if ((m = t.match(/^เมื่อ\s*(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*(?:ใช้|ใช้งาน)\s*(?:การ์ด\s*)?(?:Magic(?:\s*Card)?|\{magic\})\s*/i))) return { kinds: ["cast"], rest: t.slice(m[0].length) };
  // "เมื่อ Avatar (…) ฝ่ายเรา/บนสนามของเรา ถูกทำลาย(จากการต่อสู้)" — after one of ours was destroyed
  if ((m = t.match(/^เมื่อ\s*Avatar\s*(.{0,60}?)\s*(?:(?:บน|ใน)\s*(?:สนาม|Avatar Zone)\s*)?(?:ฝ่าย|ของ)?\s*เรา\s*ถูกทำลาย(\s*จากการต่อสู้)?(?:\s*สามารถใช้การ์ดใบนี้ได้)?\s*/))) { const w = m[1].replace(/(?:บน|ใน)\s*(?:สนาม|Avatar Zone)\s*(?:ของ)?\s*$/, "").trim(); const f = w ? filterOf(w) : null; if (f && f.bad) return null; return { kinds: ["destroyed"], dead: true, fight: !!m[2], f, rest: t.slice(m[0].length) }; }
  return null;
}

// ---------- costs and conditions written before ":" ----------
const NEXT = "(?=\\s*(?:$|และ|,|ธรณีสูบ|ทิ้ง|เปลี่ยน|เซ่นไหว้|เซ่นไหว์|เนรเทศ|หงาย|ส่ง|เลือก|สอดแนม|แสดง))";
// a Symbol word written bare ("Avatar เครื่องจักร"): only when no card is named after it (จอมเวทย์ and ขุนพล are names)
const SY_WORD = { "มนุษย์": "คน", "เครื่องจักร": "หุ่นยนต์" }; let SYS = null;
const bareSymbol = (w) => { if (!SYS) SYS = new Set(CARDS.filter((c) => c.t === "A" && c.sy).map((c) => String(c.sy).trim())); const k = SY_WORD[w] || w; return SYS.has(k) && !CARDS.some((c) => String(c.n).includes(w)) ? k : null; };
const nameOrFilter = (t) => { t = t.replace(/(?:บน|ใน)\s*(?:Avatar Zone|สนาม)(?:\s*(?:ฝ่าย)?เรา)?/g, " "); const f = filterOf(t); if (f.symbols) f.symbol = f.symbol || "\u0000";
  // (the words for a kind of card are not a name: "ทิ้งการ์ด Modification Magic 1 ใบ" is any Modification)
  if (!f.name && !f.names && !f.symbol) { const bare = t.replace(/Avatar|การ์ด|Construct|Modification|Normal|React|Land|Magic|\{(?:mod|react|land|magic)\}|ใบอื่น|ชื่อ/gi, "").trim(); if (bare && bare.length <= 40 && !/\d|ที่|หรือ/.test(bare)) { const sy = bareSymbol(bare); if (sy) f.symbol = sy; else f.name = bare; } } return f; };
const fieldOf = (s, p, zone) => (zone === "Construct Zone" ? s.P[p].cs : zone === "Land Magic Zone" ? E.lands(s) : zone === "Avatar Zone" ? s.P[p].av : [...s.P[p].av, ...s.P[p].cs, ...s.P[p].mg, ...E.lands(s).filter((l) => l.o === p)]);
// "สามารถใช้(การ์ดนี้)ได้เมื่อ …" → true / false, or null when the condition cannot be read
export function playCond(s, text, p) {
  const m = String(text || "").match(/(?:สามารถ)?ใช้(?:การ์ด(?:ใบ)?นี้)?ได้(?:ต่อ)?(?:เมื่อ|ถ้า)\s*([^:\n]*)/); if (!m) return true;
  const c = m[1].replace(/เท่านั้น/g, " ").replace(/\s+/g, " ").trim(); const P = s.P[p], O = s.P[1 - p]; let k;
  if (/^(?:เรา)?(?:อยู่)?ใน\s*สถานะ\s*สาหัส$/.test(c)) return E.critical(P);
  if ((k = c.match(/^ฝ่ายตรงข้าม\s*ควบคุม\s*Avatar\s*(?:ในสนาม|บน Avatar Zone)?\s*ตั้งแต่\s*(\d+)\s*ใบ\s*ขึ้นไป$/))) return O.av.length >= +k[1];
  if ((k = c.match(/^(?:(?:มี|ควบคุม)\s*(.+?)\s*(?:อยู่)?\s*บน\s*(Avatar Zone|Construct Zone|สนาม)\s*(?:ฝ่าย)?เรา|(?:บน|ใน)?\s*(Avatar Zone|Construct Zone|สนาม)\s*(?:ฝ่าย)?เรา\s*มี\s*(.+?)\s*(?:อยู่)?)$/))) {
    const what = k[1] || k[4]; const zone = k[2] || k[3]; if (/เพียง|และ|หรือ|ใบขึ้นไป|\d/.test(what)) return null; const f = nameOrFilter(what); if (f.bad || (!f.name && !f.names && !f.symbol)) return null;
    return fieldOf(s, p, zone).some((x) => fits(s, x, f)); }
  return null;
}
// returns null (cannot read) | { fail: "why" } | { ops, say, merge }  — merge = text to treat as the start of the effect
function readHead(s, head, p, self, ctx, trig, body) {
  const ops = [], say = []; const P = s.P[p]; let merge = ""; let t = head.trim(); let guard = 0;
  // once a condition or cost fails we keep reading (with a throwaway chooser) so an unreadable rest still counts as unreadable
  let fail = null; const bad = (why) => { if (!fail) { fail = why; ctx = makeCtx(s, trig); } };
  while (t && guard++ < 8) {
    t = t.replace(/^(?:และ|,|แล้ว)\s*/, ""); let m;
    if ((m = t.match(/^พอดี\s*/))) { if (!trig.exact) bad("ไม่ได้จ่าย GEM พอดีกับ Cost ความสามารถไม่ทำงาน"); }
    else if ((m = t.match(/^(?:สามารถ)?ใช้(?:การ์ด(?:ใบ)?นี้)?ได้(?:ต่อ)?(?:เมื่อ|ถ้า)[^:]*?(?:เท่านั้น\s*|$)/))) { const c = playCond(s, t, p); if (c === false) bad("ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้"); else if (c == null && !ctx.interactive && !trig.dry) bad("บอทไม่ใช้การ์ดที่อ่านเงื่อนไขไม่ออก"); }
    else if (trig.when === "attack" && (m = t.match(/^Avatar\s*(?:\{[^}]+\}|["“][^"”]+["”])\s*(?:(?:ของ)?(?:ฝ่ายตรงข้าม|อีกฝ่าย))?\s*$/))) { const f = filterOf(m[0]); const T = s.pend && s.pend.tk === "av" ? E.locate(s, s.pend.ti) : null; if (!trig.dry && !(T && fits(s, T.x, f))) bad("เป้าหมายการโจมตีไม่ตรงเงื่อนไข"); }
    else if ((m = t.match(/^ถ้าเรา(?:อยู่ใน)?สถานะ\s*สาหัส\s*/))) { if (!E.critical(P)) bad("ยังไม่อยู่ในสถานะสาหัส"); }
    else if ((m = t.match(/^ถ้า\s*(.+?)\s+หรือ\s+(.+)$/)) && !/["“][^"”]*\sหรือ\s[^"”]*["”]/.test(t)) { // "ถ้า A หรือ B": either condition
      const one = (c) => { const r = readHead(s, "ถ้า" + (c.startsWith("ถ้า") ? c.slice(3) : " " + c), p, self, makeCtx(s, trig), { ...trig, dry: true }); return r === null ? null : !r.fail; };
      const a = one(m[1]), b = one(m[2]); if (a === null || b === null) return null; if (!a && !b) bad("ยังไม่ตรงเงื่อนไขของความสามารถ"); }
    else if ((m = t.match(/^(?:ถ้า\s*)?(?:ใน)?\s*นรก\s*(?:ฝ่าย|ของ)?\s*เรา\s*มี\s*(?:การ์ด\s*)?(.+?)\s*(?:อยู่)?\s*$/)) && !/\d+\s*ใบ/.test(m[1])) { // "ในนรกเรามีการ์ด X" (at least one)
      let f = nameOrFilter(m[1]); if (!f.name && !f.names && !f.symbol && !f.type) { const bare = m[1].replace(/การ์ด|Avatar|Magic/g, " ").trim(); if (nameKnown(bare)) f = { name: bare }; else return null; }
      if (!P.hell.some((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type))) bad("ในนรกยังไม่มีการ์ดที่ตรงเงื่อนไข"); }
    else if ((m = t.match(/^ถ้า\s*LIFE\s*Card\s*(?:ฝ่าย|ของ)?เรา\s*(?:ที่)?(?:ถูก)?หงาย(?:อยู่)?\s*(?:ตั้งแต่\s*)?(\d+)\s*ใบ\s*(?:ขึ้นไป|หรือมากกว่า)\s*/))) { if (P.life.filter((x) => x.up).length < +m[1]) bad(`LIFE ที่หงายยังไม่ถึง ${m[1]} ใบ`); }
    else if ((m = t.match(new RegExp(`^ถ้า(?:ใน)?\\s*นรก(?:ฝ่าย)?เรา\\s*มี\\s*(.+?)\\s*(?:ตั้งแต่\\s*)?(\\d+)\\s*ใบ\\s*(?:ขึ้นไป|หรือมากกว่า)?${NEXT}`)))) { const uq = /ที่?ชื่อไม่ซ้ำกัน|ที่?ชื่อต่างกัน/.test(m[1]); const f = nameOrFilter(m[1].replace(/ที่?ชื่อไม่ซ้ำกัน|ที่?ชื่อต่างกัน/g, " ")); if (f.bad) return null; const hit = P.hell.filter((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type)); const n = uq ? new Set(hit.map((x) => E.def(s, x).n)).size : hit.length; if (n < +m[2]) bad(`ในนรกมีไม่ถึง ${m[2]} ใบ (มี ${n})`); }
    else if ((m = t.match(new RegExp(`^ถ้า(?:บน|ใน)?\\s*(Avatar Zone|Construct Zone|Land Magic Zone|สนาม)?\\s*(?:ฝ่าย)?(?:เรา)?\\s*มี\\s*(.+?)\\s*(?:อยู่)?\\s*(?:บน\\s*(?:สนาม|Avatar Zone)\\s*(?:ฝ่าย)?เรา)?${NEXT}`)))) {
      const f = nameOrFilter(m[2]); if (!f.name && !f.names && !f.symbol) return null; const other = /ใบอื่น/.test(m[2]);
      if (!fieldOf(s, p, m[1] || (f.type === "A" ? "Avatar Zone" : "สนาม")).some((x) => fits(s, x, f) && !(other && self && x.i === self.i))) bad("ยังไม่ตรงเงื่อนไขของความสามารถ"); }
    else if ((m = t.match(/^ทิ้งการ์ด(?:จากบน|บน|จาก)?มือ(?:เรา)?\s*(\d+)\s*ใบ\s*/))) {
      const n = +m[1]; const pool = [...P.hand].filter((x) => x.i !== trig.i).sort((a, b) => cardVal(s, a) - cardVal(s, b)); if (pool.length < n) bad("การ์ดบนมือไม่พอจ่ายค่าความสามารถ");
      const pick = ctx.choose(pool, n, `ทิ้งการ์ดบนมือ ${n} ใบเป็นค่าใช้จ่าย`, { exact: true }); ops.push({ op: "discard", seat: p, iids: pick.map((x) => x.i) }); say.push(`ทิ้งการ์ดบนมือ ${n} ใบ`); }
    else if ((m = t.match(/^(?:ทิ้ง|ส่ง)\s*(?:การ์ด\s*)?(.+?)\s*(?:(?:จาก|บน)(?:บน)?มือ(?:เรา)?\s*(\d+)\s*ใบ|(\d+)\s*ใบ\s*(?:จาก|บน)(?:บน)?มือ(?:เรา)?)\s*(?:ลงนรก\s*)?/))) {
      const f = nameOrFilter(m[1]); const n = +(m[2] || m[3]); if (!f.name && !f.names && !f.symbol && !f.type) return null;
      const alts = /หรือ/.test(m[1]) ? m[1].split(/\s*หรือ\s*/).map(nameOrFilter).filter((g) => g.name || g.names || g.symbol) : []; // "Avatar {symbol แมลง} หรือ Avatar "เหยื่อ"": either one (มาวิน เซียนเบ็ด)
      const okX = (x) => (alts.length > 1 ? alts.some((g) => fits(s, x, g) && (!g.type || E.def(s, x).t === g.type)) : fits(s, x, f) && (!f.type || E.def(s, x).t === f.type));
      const pool = P.hand.filter((x) => x.i !== trig.i && okX(x)).sort((a, b) => cardVal(s, a) - cardVal(s, b)); if (pool.length < n) bad("ไม่มีการ์ดบนมือที่ตรงเงื่อนไขให้ทิ้ง");
      const pick = ctx.choose(pool, n, `ทิ้งการ์ดที่ตรงเงื่อนไข ${n} ใบเป็นค่าใช้จ่าย`, { exact: true }); ops.push({ op: "discard", seat: p, iids: pick.map((x) => x.i) }); say.push(`ทิ้ง ${pick.map((x) => E.name(s, x)).join(", ")}`); }
    else if ((m = t.match(/^ธรณีสูบ\s*(?:\([^)]*\)\s*)?(\d+)\s*ใบ\s*/))) { const n = +m[1]; if (P.deck.length < n) bad("Deck เหลือไม่พอธรณีสูบ"); ops.push({ op: "mill", seat: p, n }); say.push(`ธรณีสูบ ${n} ใบ`); }
    else if ((m = t.match(/^เปลี่ยน\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:จากสภาพตื่น)?\s*เป็น\s*(?:สภาพ)?\s*นอน\s*/))) { if (!self || !self.a) bad("Avatar ใบนี้ไม่ได้อยู่ในสภาพตื่น"); else { ops.push({ op: "wake", i: self.i, v: false }); say.push("นอน Avatar ใบนี้"); } }
    else if ((m = t.match(/^(?:เซ่นไหว้|เซ่นไหว์)\s*(?:\([^)]*\)\s*)?(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*/)) || (m = t.match(/^(?:ส่ง|ทำลาย)\s*(?:Avatar|การ์ด)\s*(?:ใบนี้|ตัวนี้)\s*(?:ลงนรก)?\s*/))) { if (!self) bad("การ์ดใบนี้ไม่อยู่บนสนาม"); else { ops.push({ op: "destroy", i: self.i, why: "ค่าความสามารถ" }); say.push("เซ่นไหว้การ์ดใบนี้"); } }
    else if ((m = t.match(/^เลือก\s*Avatar\s*(\d+)\s*ใบ\s*(?:ใน|บน)\s*Avatar Zone\s*(?:ฝ่าย)?เรา\s*เปลี่ยน(?:สภาพ)?\s*Avatar\s*ใบนั้น\s*เป็น\s*(?:สภาพ)?\s*นอน\s*/))) {
      const n = +m[1]; const pool = P.av.filter((x) => x.a).sort((a, b) => E.power(s, a) - E.power(s, b)); if (pool.length < n) bad("ไม่มี Avatar ที่ตื่นอยู่ให้นอน");
      const pick = ctx.choose(pool, n, `เลือก Avatar ฝ่ายเรา ${n} ใบที่จะเปลี่ยนเป็นสภาพนอน`, { exact: true }); for (const x of pick) ops.push({ op: "wake", i: x.i, v: false }); say.push(`นอน ${pick.map((x) => E.name(s, x)).join(", ")}`); }
    else if ((m = t.match(/^(?:เซ่นไหว้|เซ่นไหว์|ทำลาย|ส่ง)\s*(?:\([^)]*\)\s*)?(?:Avatar\s*)?(.*?)\s*(?:(?:บน|ใน)(?:สนาม|\s*Avatar Zone)\s*(?:ฝ่าย|ของ)?เรา\s*)?(\d+)\s*ใบ\s*(?:(?:บน|ใน)(?:สนาม|\s*Avatar Zone)\s*(?:ฝ่าย|ของ)?เรา\s*)?(?:ลงนรก\s*)?/)) && !/มือ|นรก.*\d|Deck|Magic Zone|Construct|สวม/.test(m[0].replace(/ลงนรก\s*$/, ""))) {
      const f = m[1].trim() ? nameOrFilter(m[1]) : {}; if (f.bad) return null; const n = +m[2]; const other = /ใบอื่น/.test(m[1]);
      const pool = P.av.filter((x) => fits(s, x, f) && !(other && self && x.i === self.i)).sort((a, b) => val(s, a) - val(s, b)); if (pool.length < n) bad("ไม่มี Avatar ให้เซ่นไหว้");
      const pick = ctx.choose(pool, n, `เซ่นไหว้ Avatar ฝ่ายเรา ${n} ใบเป็นค่าใช้จ่าย`, { exact: true }); for (const x of pick) ops.push({ op: "destroy", i: x.i, why: "เซ่นไหว้" }); say.push(`เซ่นไหว้ ${pick.map((x) => E.name(s, x)).join(", ")}`); }
    else if ((m = t.match(/^ทำลาย\s*(?:การ์ด\s*)?["“]([^"”]+)["”]\s*ที่สวมใส่อยู่\s*(?:ให้)?(?:กับ)?\s*(?:การ์ด)?\s*(?:Avatar\s*)?(?:["“]([^"”]+)["”])?\s*(?:บน\s*Avatar Zone\s*(?:ฝ่าย)?เรา\s*)?(\d+)\s*ใบ\s*/))) {
      const n = +m[3]; const hosts = new Set(P.av.filter((h) => !m[2] || E.name(s, h).includes(m[2])).map((h) => h.i));
      const pool = [0, 1].flatMap((q) => s.P[q].mg).filter((c) => c.on != null && hosts.has(c.on) && E.name(s, c).includes(m[1])).sort((a, b) => cardVal(s, a) - cardVal(s, b)); if (pool.length < n) bad(`ไม่มี ${m[1]} ที่สวมใส่อยู่ให้ทำลาย`);
      const pick = ctx.choose(pool, n, `เลือก ${m[1]} ที่สวมใส่อยู่ ${n} ใบเพื่อทำลายเป็นค่าใช้จ่าย`, { exact: true }); for (const x of pick) ops.push({ op: "destroy", i: x.i, why: "ค่าความสามารถ" }); say.push(`ทำลาย ${pick.map((x) => E.name(s, x)).join(", ")}`); }
    else if ((m = t.match(/^เนรเทศ\s*การ์ด(?:ใน)?\s*นรก(?:ฝ่าย)?เรา\s*(\d+)\s*ใบ\s*/))) { const n = +m[1]; if (P.hell.length < n) bad("การ์ดในนรกไม่พอ");
      const pick = ctx.choose([...P.hell].sort((a, b) => cardVal(s, a) - cardVal(s, b)), n, `เนรเทศการ์ดในนรกเรา ${n} ใบเป็นค่าใช้จ่าย`, { exact: true }); for (const x of pick) ops.push({ op: "exile", i: x.i }); say.push(`เนรเทศการ์ดในนรก ${n} ใบ`); }
    else if ((m = t.match(/^หงาย\s*LIFE\s*Card\s*(?:ของ|ฝ่าย)?เรา\s*(?:ใบบนสุด\s*)?(?:1\s*ใบ\s*)?/))) { if (!P.life.some((x) => !x.up)) bad("ไม่มี LIFE ที่คว่ำอยู่ให้หงาย"); ops.push({ op: "lifeFlip", seat: p, up: true }); say.push("หงาย LIFE เรา 1 ใบ"); }
    else if ((m = t.match(/^นำ\s*(?:การ์ด\s*)?(.+?)\s*(?:(\d+)\s*ใบ\s*(?:ที่มีชื่อ(?:แตก)?ต่างกัน\s*)?จาก(?:ใน)?\s*(นรก|มิติมืด)(?:\s*(?:ฝ่าย|ของ)?เรา)?|จาก(?:ใน)?\s*(นรก|มิติมืด)(?:\s*(?:ฝ่าย|ของ)?เรา)?\s*(\d+)\s*ใบ)\s*กลับ\s*(?:เข้า|ไป)?\s*(ใต้)?\s*Deck\s*(?:(?:แล้ว|และ)?\s*สับ(?:\s*Deck)?)?\s*/))) {
      const zn = m[3] || m[4]; const zone = zn === "นรก" ? P.hell : P.dark; const n = +(m[2] || m[5]); const distinct = /ชื่อ(?:แตก)?ต่างกัน|ชื่อไม่ซ้ำ/.test(m[0]);
      const f = nameOrFilter(m[1].replace(/ที่มีชื่อ(?:แตก)?ต่างกัน|(?:ที่)?ชื่อไม่ซ้ำกัน/g, " ")); if (f.bad || (!f.name && !f.names && !f.symbol && !f.type)) return null;
      let pool = zone.filter((x) => fits(s, x, f) && (!f.type || E.def(s, x).t === f.type)); if (distinct) { const seen = new Set(); pool = pool.filter((x) => { const k = E.def(s, x).n; if (seen.has(k)) return false; seen.add(k); return true; }); }
      if (pool.length < n) bad(`การ์ดใน${zn}ไม่พอจ่ายค่าความสามารถ`);
      const pick = ctx.choose(pool.sort((a, b) => cardVal(s, a) - cardVal(s, b)), n, `เลือกการ์ดใน${zn} ${n} ใบกลับเข้า Deck เป็นค่าใช้จ่าย`, { exact: true }); for (const x of pick) ops.push({ op: "move", i: x.i, to: "deckBottom" }); if (!m[6]) ops.push({ op: "shuffle", seat: p }); say.push(`นำ ${pick.map((x) => E.name(s, x)).join(", ")} กลับเข้า Deck`); }
    else if ((m = t.match(/^นำ\s*(?:Avatar\s*)?(.*?)\s*(?:บน|ใน)\s*Avatar Zone\s*(?:ฝ่าย)?เรา\s*(\d+)\s*ใบ\s*กลับ\s*(?:เข้า|ไป)?\s*(ใต้)?\s*Deck\s*(?:(?:แล้ว|และ)?\s*สับ(?:\s*Deck)?)?\s*/))) {
      const f = m[1].trim() ? nameOrFilter(m[1]) : {}; if (f.bad) return null; const n = +m[2]; const other = /ใบอื่น/.test(m[1]);
      const pool = P.av.filter((x) => !x.tok && fits(s, x, f) && !(other && self && x.i === self.i)).sort((a, b) => val(s, a) - val(s, b)); if (pool.length < n) bad("ไม่มี Avatar ให้นำกลับเข้า Deck");
      const pick = ctx.choose(pool, n, `เลือก Avatar ฝ่ายเรา ${n} ใบกลับเข้า Deck เป็นค่าใช้จ่าย`, { exact: true }); for (const x of pick) ops.push({ op: "move", i: x.i, to: "deckBottom" }); if (!m[3]) ops.push({ op: "shuffle", seat: p }); say.push(`นำ ${pick.map((x) => E.name(s, x)).join(", ")} กลับเข้า Deck`); }
    else if ((m = t.match(/^สอดแนม\s*(?:\([^)]*\)\s*)?\d+\s*ใบ$/))) merge = t; // a scout that the effect continues from
    else if ((m = t.match(/^เลือก\s*Avatar.*$/)) && !/นรก|มือ|Deck|ทำลาย|ส่ง|เนรเทศ|ทิ้ง|เซ่นไหว้/.test(t) && !BAIL.test(t)) merge = t; // a target choice, not a cost
    else if ((m = t.match(/^เลือก\s*(?:Avatar|การ์ด).*(?:ใน|จาก)\s*นรก(?:ฝ่าย|ของ)?เรา\s*\d+\s*ใบ$/)) && /^(?:อัญเชิญ|นำ)\s*(?:Avatar|การ์ด)?\s*(?:ใบ|ตัว)?(?:นั้น|ที่เลือก)/.test(body || "") && !BAIL.test(t)) merge = t; // "choose X in hell : summon that card"
    else return null;
    t = t.slice(m[0].length).trim();
  }
  if (t) return null;
  return fail ? { fail } : { ops, say, merge };
}
// rough value of a result, used to pick between written options for the bot
function modeScore(s, p, r) {
  if (!r || r.fail) return -99; let v = 0;
  for (const o of r.ops) { const L = o.i != null ? E.locate(s, o.i) : null; const mine = L ? L.p === p : o.seat == null || o.seat === p;
    if (o.op === "draw") v += (mine ? 1.5 : -1.5) * (o.n || 1); else if (o.op === "destroy") v += mine ? -3 : 5 + (L ? E.power(s, L.x) * 0.4 : 0); else if (o.op === "discard") v -= 1.4 * (o.iids || []).length;
    else if (o.op === "power") v += (mine === o.n > 0 ? 1 : -1) * Math.abs(o.n) * 0.8; else if (["search", "scout", "fromHell", "put"].includes(o.op)) v += 2.5; else if (o.op === "mute" || o.op === "control") v += 3.5;
    else if (o.op === "lifeDamage") v += 6; else if (o.op === "mill") v += mine ? -0.3 * (o.n || 1) : 0.3 * (o.n || 1); else if (o.op === "move" && o.to === "hand") v += mine ? 1 : 3.5; else v += 0.5; }
  return v;
}
const why = (m) => { if (globalThis.__dbg) globalThis.__why = m; return null; }; // debugging aid for the coverage scripts
// Rule Book (การใช้ผลของการ์ด / การจ่าย Cost): an effect has to be carried out in full to be used at all; when a step that
// is not optional has nothing to act on (บีม with no Avatar to destroy, อีวิลไมเกรน with no weapon in hell) the ability
// cannot be used, and its Cost is not paid either
const NO_FULL = "ทำผลของการ์ดได้ไม่ครบ (ไม่มีเป้าหมายหรือทำไม่ได้) จึงใช้ความสามารถนี้ไม่ได้ และไม่ต้องจ่าย Cost";
const missed = (ctx) => { ctx.miss = (ctx.miss || 0) + 1; };
function readClause(s, text, p, self, ctx, trig) {
  const m0 = ctx.miss || 0; const r = readClause0(s, text, p, self, ctx, trig);
  return r && !r.fail && (ctx.miss || 0) > m0 ? { fail: NO_FULL } : r;
}
// "cost : effect" (or just "effect") → { ops, say } | { fail } | null
function readClause0(s, text, p, self, ctx, trig) {
  const k = text.indexOf(":"); let head = k >= 0 ? text.slice(0, k).trim() : "", body = k >= 0 ? text.slice(k + 1).trim() : text.trim();
  const ops = [], say = [];
  const modes = /เลือกปฏิบัติ|เลือก\s*1\s*อย่าง/.test(head) || /^(?:เลือกปฏิบัติ\s*:?\s*)?1\s*[).]\s/.test(body); head = head.replace(/เลือกปฏิบัติ|เลือก\s*1\s*อย่าง/g, "").trim(); body = body.replace(/^เลือกปฏิบัติ\s*:?\s*/, "");
  if (head && !trig.part && /^สอดแนม/.test(head) && !/^สอดแนม\s*(?:\([^)]*\)\s*)?\d+\s*ใบ$/.test(head)) { const r = readScout(s, head, p, self, ctx, trig); if (r && r.fail) return { fail: r.fail }; if (r && !r.ops.some((o) => o.op === "resume")) { ops.push(...r.ops); say.push(...r.say); head = ""; } }
  if (head && !trig.part) { const h = readHead(s, head, p, self, ctx, trig, body); if (!h) return why("head: " + head);
    if (h.fail) { if (!trig.dry) { const d = readClause(s, body.replace(/^/, modes ? "เลือกปฏิบัติ : " : ""), p, self, makeCtx(s, trig), { ...trig, dry: true }); if (!d) return null; } return h; }
    ops.push(...h.ops); say.push(...h.say); if (h.merge) body = h.merge + " " + (/นรก/.test(h.merge) ? body.replace(/^(อัญเชิญ|นำ)\s*(?:Avatar|การ์ด)?\s*(?:ใบ|ตัว)?(?:นั้น|ที่เลือก)/, "$1") : body); }
  if (modes) {
    const list = body.split(/(?:^|\s)\d\s*[).]\s+/).map((x) => x.trim()).filter(Boolean); if (list.length < 2 || list.length > 4) return null;
    const dry = list.map((m) => readClause(s, m, p, self, makeCtx(s, trig), trig)); if (dry.some((r) => !r)) return null; // every option must be readable
    // an option that cannot be carried out cannot be chosen (FAQ เซนเซไฮ); none left: the ability cannot be used
    const feas = list.map((_, i) => i).filter((i) => !dry[i].fail); if (!feas.length) return { fail: dry.find((r) => r.fail).fail };
    let best = feas[0]; for (const i of feas) if (modeScore(s, p, dry[i]) > modeScore(s, p, dry[best])) best = i;
    const pk = feas.length === 1 ? 0 : ctx.mode(feas.map((i) => `${i + 1}) ${list[i].length > 70 ? list[i].slice(0, 68) + "…" : list[i]}`), feas.length < list.length ? "เลือกปฏิบัติ (ข้อที่ทำไม่ได้ตอนนี้ถูกซ่อนไว้)" : "เลือกปฏิบัติ", feas.indexOf(best));
    const pick = feas[pk] != null ? feas[pk] : best;
    const r = readClause(s, list[pick], p, self, ctx, trig); if (!r) return null; if (r.fail) return r;
    return { ops: [...ops, ...r.ops], say: [...say, `เลือกข้อ ${pick + 1}`, ...r.say] };
  }
  body = body.replace(/ถ้า\s*(?:นำ(?:ขึ้นมือ)?|อัญเชิญ|เลือก)(?:มา)?\s*จาก(?:ใน)?\s*Deck\s*(?:ให้|ต้อง)?\s*สับ\s*Deck(?:\s*ด้วย)?/g, " ").trim();
  // "ใน Main Phase ถัดไป …": the whole effect is resolved then (with the choices made then), not now
  // "ใน Main Phase ถัดไป …" / "ในช่วงเริ่มต้น Battle Phase ถัดไป …": the whole effect waits for that moment
  const LATER = /^ใน(?:ช่วง)?\s*(?:เริ่ม(?:ต้น)?\s*)?(main|battle)\s*phase\s*ถัดไป\s*/i; const lm = body.match(LATER);
  const later = !!lm && !trig.now; const laterAt = lm && /battle/i.test(lm[1]) ? "battle" : null; body = body.replace(LATER, "");
  body = body.replace(/\{red\s*\}/g, " ").replace(/\s{2,}/g, " ").trim();
  if (/^สอดแนม/.test(body) && !later && !(trig.part > 0)) { const r = readScout(s, body, p, self, ctx, trig); if (r && r.fail) return { fail: r.fail }; if (r) return { ops: [...ops, ...r.ops], say: [...say, ...r.say] }; }
  if (BAIL.test(body.replace(new RegExp(TEXTBOX.source, "gi"), " "))) return why("bail: " + body.replace(new RegExp(TEXTBOX.source, "gi"), " ").match(BAIL)[0]); if (/ได้รับ/.test(body) && !KWGRANT.test(body)) return why("bail: ได้รับ");
  const parts = body.split(/\s*(?:จากนั้น|หลังจากนั้น|แล้ว(?=\s*(?:จั่ว|สับ|นำ))|\s\/\s|และ(?=\s*(?:จั่ว|ทำลาย|ธรณีสูบ|สับ|ยกเลิก|ทำความเสียหาย|เปลี่ยน|นำ(?!\s*(?:ขึ้นมือ|กลับขึ้นมือ|มา|ไป|ลง))|อัญเชิญ(?!\s*ลง)|เนรเทศ|เลือก))|\s(?=เลือก\s*Avatar)|(?<=(?:ธรณีสูบ|จั่วการ์ด)[^.:]{0,90}?\d\s*ใบ)\s+(?=POWER\s*[+\-−–]\s*\d))\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (later) { const dry = makeCtx(s, trig); dry.ref = ctx.ref; dry.when = ctx.when; dry.me = ctx.me; for (const t of parts) if (!sentence(s, t, p, self, dry)) return why("sentence: " + t);
    return { ops: [...ops, { op: "later", seat: p, ...(laterAt ? { at: "battle" } : {}), t: { i: trig.i, c: trig.c, when: trig.when, seat: trig.seat, now: true }, why: `${(s.cards[trig.c] || {}).n}: ถึง${laterAt ? "ช่วงเริ่ม Battle Phase" : " Main Phase"} ที่รอไว้แล้ว` }], say: [...say, laterAt ? "จะทำงานในช่วงเริ่ม Battle Phase ถัดไป" : "จะทำงานใน Main Phase ถัดไป"] }; }
  const eops = [], esay = []; const start = (trig.part || 1) - 1; if (start >= parts.length) return null;
  const touches = (o) => (["mill", "discard", "destroy"].includes(o.op) ? "นรก" : ["draw", "search", "scout", "handToDeck"].includes(o.op) ? "มือ" : null);
  for (let k = start; k < parts.length; k++) { const t = parts[k];
    const dirty = [...(start ? [] : ops), ...eops].map(touches).filter(Boolean);
    if (dirty.length && (k > start || !trig.part) && dirty.some((z) => t.includes(z)) && !later && !trig.dry) { // let the earlier steps happen first, then continue from here
      const dry = makeCtx(s, trig); dry.ref = ctx.ref; dry.when = ctx.when; for (let j = k; j < parts.length; j++) if (!sentence(s, parts[j], p, self, dry)) return null; // the rest must be readable too
      eops.push({ op: "resume", t: { i: trig.i, c: trig.c, when: trig.when, seat: trig.seat, ...(trig.k != null ? { k: trig.k } : {}), ...(trig.on ? { on: trig.on } : {}), part: k + 1 } }); esay.push("แล้วทำส่วนที่เหลือต่อ"); break; }
    const r = sentence(s, t, p, self, ctx); if (!r) return why("sentence: " + t); if (r.fail) return { fail: r.fail }; eops.push(...r.ops); esay.push(...r.say); }
  return { ops: [...ops, ...eops], say: [...say, ...esay] };
}

// main entry: trig = {i, c, when, seat, exact, k}; returns {explain, ops} or null when unreadable
export function autoEffect(s, trig, ctx = makeCtx(s, trig)) {
  const d = s.cards[trig.c]; if (!d || !d.x) return null;
  const when = trig.when === "cast" && d.st === "D" ? "mod" : trig.when;
  if (when === "mod") return null;
  const p = trig.seat; const L = E.locate(s, trig.i); const self = L && (L.z === "av" || L.z === "cs") ? L.x : null;
  let text; ctx.when = when; ctx.ref = {}; ctx.me = L ? L.x : null;
  if (trig.manualRest) return null; // the part of an effect the reader could not understand: the player finishes it
  // a Land Magic's text works while it stays on the field: playing it only puts it there (its "สั่งใช้" abilities are used from the field)
  if (when === "cast" && d.t === "M" && d.st === "L") { const ra = readAura(d); const plain = String(d.x).split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^(?:ต่อเนื่อง|อัตโนมัติ|อัติโนมัติ|เทิร์นละครั้ง|สั่งใช้|เลือกปฏิบัติ|#|\[|-|\d\s*[).])/.test(l));
    if (ra || !plain.length) return { explain: ra ? `Land Magic มีผลตลอดที่อยู่บนสนาม: ${ra.desc}` : "Land Magic วางบนสนามแล้ว ใช้ความสามารถจากบนสนามได้", ops: [] }; return null; }
  if (trig.tail) { const r = readClause(s, trig.tail, p, self, ctx, { ...trig, tail: null }); if (!r) return null; if (r.fail) return { explain: r.fail, ops: [], fail: true }; return { explain: "อ่านอัตโนมัติ: " + (r.say.join(" · ") || "ไม่มีผลเพิ่ม"), ops: r.ops }; }
  if (when === "activate") { const a = activations(d.x)[trig.k | 0]; if (!a || a.where !== "field" || a.timed) return null; text = a.text; }
  else if (when === "cast" && d.st === "R") { const rt = reactTiming(d.x); if (!rt) return null; text = rt.rest.replace(/^:\s*/, ""); const on = trig.on || {};
    ctx.ref = on.kind === "attack" ? { att: on.att, that: rt.mine ? (on.own ? on.att : on.ti) : on.att, foe: rt.mine ? (on.own ? on.ti : on.att) : null, cancel: true } : on.kind === "summon" ? { that: on.i } : on.kind === "cast" ? { magic: on.i } : {}; }
  else if (when === "paid") { const cl = clause(d.x, "paid"); if (!cl) return null; const pf = paidFilter(cl.head); if (pf === null) return null; const td = s.cards[trig.for];
    if (pf && td && !fitsD(td, pf)) return { explain: "การ์ดที่อัญเชิญไม่ตรงเงื่อนไขของความสามารถ", ops: [], fail: true }; text = cl.body; }
  else if (when === "milled") { const cl = clause(d.x, "milled"); if (!cl) return null; text = cl.head ? cl.head + " : " + cl.body : cl.body; }
  else { const cl = clause(d.x, when); if (!cl) return null; text = cl.head ? cl.head + " : " + cl.body : cl.body;
    if (cl.exactOnly && !trig.exact) return { explain: "ไม่ได้จ่าย GEM พอดีกับ Cost ความสามารถนี้ไม่ทำงาน", ops: [], fail: true };
    if ((when === "attack" || when === "attacked" || when === "win") && s.pend) ctx.ref = when === "attacked" ? { att: s.pend.att, that: s.pend.att } : { that: s.pend.tk === "av" ? s.pend.ti : null }; }
  const r = readClause(s, text, p, self, ctx, trig); if (!r) return null;
  if (r.fail) return { explain: r.fail, ops: [], fail: true };
  if (!r.ops.length && !r.say.length) return null;
  return { explain: "อ่านอัตโนมัติ: " + r.say.join(" · "), ops: r.ops };
}
function cardVal(s, x) { const d = E.def(s, x); return d.t === "A" ? (d.pw || 0) + (d.c || 0) * 0.5 + (d.o1 ? 10 : 0) : d.t === "C" ? 3 : 2; }

// coverage helper for the lab: how many cards' triggered texts can be read
export function readable(c, when, extra = {}) { const s = { cards: { x: { n: c.n, x: c.x, st: c.st, t: c.t, co: c.co, c: c.c, pw: c.pw, sy: c.sy } }, P: [{ av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }, { av: [], cs: [], mg: [], hand: [], hell: [], deck: [], dark: [], life: [] }], land: null, mu: [{}, {}], turn: 3, active: 0, phase: "main", trig: [], log: [] };
  { const z = when === "death" || when === "milled" || when === "paid" ? "hell" : c.t === "C" ? "cs" : c.t === "A" || c.t === "T" ? "av" : c.t === "M" && when === "cast" ? "mg" : null; if (z) s.P[0][z].push({ i: -1, c: "x", o: 0, a: true }); }
  if (when === "cast" && c.st === "R" && !extra.on) { const rt = reactTiming(c.x); if (!rt) return false; extra = { on: { kind: rt.kinds[0], att: -1, ti: -1, i: -1, tk: "av" } }; }
  try { const r = autoEffect(s, { c: "x", i: -1, when, seat: 0, exact: true, ...extra }); return !!r && !(r.ops || []).some((o) => o.op === "resume" && o.t && o.t.manualRest); } catch { return false; } }

// --- choices -------------------------------------------------------------------------
// ctx.choose(cands, n, prompt, opts) returns the chosen cards. Bots (interactive=false) take
// the first n (callers sort best-first). Players get asked: we throw {ask}, the UI shows a
// picker, then calls again with picks[] filled in. Effects are pure, so re-running is safe.
export function makeCtx(s, t, picks = [], interactive = false) {
  let k = 0;
  const ctx = { s, E, seat: t.seat, t, self: null, picks, interactive, deferred: false,
    choose(cands, n, prompt, o = {}) {
      // nothing to pick for a step the card does not make optional: the effect cannot be carried out (Rule Book: it cannot be used)
      // FAQ รับซื้อของโจร: the card taken from the other side's hand pays for a summon only — an effect can never pick it (discard cost, reveal …)
      if (cands.some((x) => x && x.borrow)) cands = cands.filter((x) => !(x && x.borrow));
      const idx = k++; if (!cands.length) { if (n > 0 && !o.optional && !o.reveal) ctx.miss = (ctx.miss || 0) + 1; return []; }
      if (picks[idx] !== undefined) return picks[idx].map((i) => cands.find((x) => x.i === i)).filter(Boolean);
      if (!interactive || (!o.optional && !o.reveal && cands.length <= n)) return cands.slice(0, n);
      // reveal: the cards shown (a list of ids); "reveal: true" only means "always ask, even with one choice"
      throw { ask: { idx, prompt, options: cands.map((x) => x.i), n, optional: !!o.optional, exact: !!o.exact, reveal: Array.isArray(o.reveal) ? o.reveal : null, why: o.why || null } };
    },
    // pick one of several written options (เลือกปฏิบัติ); bots take `best`
    mode(labels, prompt, best = 0) { const idx = k++; if (picks[idx] !== undefined) return picks[idx][0]; if (!interactive) return best; throw { ask: { idx, prompt, modes: labels, options: [], n: 1 } }; },
  };
  const L = E.locate(s, t.i); ctx.self = L ? L.x : null;
  return ctx;
}
// resolve a trigger: hand-written script first, then the text reader
export function resolveEffect(s, t, picks = [], interactive = false) {
  const ctx = makeCtx(s, t, picks, interactive);
  try {
    if (t.when === "trim") { const P = s.P[t.seat]; const n = Math.max(0, E.avatars(P) - 4); const pick = n ? ctx.choose(P.av.filter((x) => P.c3 || !x.tok).sort((a, b) => (b.tok ? 1 : 0) - (a.tok ? 1 : 0) || cardVal(s, a) - cardVal(s, b)), n, `Avatar Zone เกินจำนวนที่ควบคุมได้: เลือก Avatar ${n} ใบส่งลงนรก`, { exact: true }) : [];
      return { explain: pick.length ? `ควบคุมได้ไม่เกินจำนวนที่กำหนด: ${pick.map((x) => E.name(s, x)).join(", ")} ลงนรก` : "", ops: pick.map((x) => ({ op: "move", i: x.i, to: "hell", player: true })) }; }
    if (t.when === "activate" && t.k === "kraken") { const L = E.locate(s, t.i), P = s.P[t.seat]; if (!L || L.z !== "mg" || !L.x.kraken || P.hand.length < 2 || E.avatars(P) >= 4) return { explain: "ใช้ความสามารถนี้ไม่ได้แล้ว", ops: [] };
      const pay = ctx.choose([...P.hand].sort((a, b) => cardVal(s, a) - cardVal(s, b)), 2, "ทิ้งการ์ดบนมือ 2 ใบ", { exact: true });
      return pay.length === 2 ? { explain: `ทิ้ง 2 ใบ · อัญเชิญ ${E.name(s, L.x)} จาก Magic Zone`, ops: [{ op: "discard", seat: t.seat, iids: pay.map((y) => y.i) }, { op: "put", i: t.i, here: true }, { op: "flagSet", i: t.i, k: "kraken", v: false }] } : { explain: "", ops: [] }; }
    const sc = scriptOf(s, { c: t.c });
    const run = sc && (t.when === "activate" ? t.k == null && sc.activate && sc.activate.run : t.when === "answer" ? sc.answer && sc.answer.run : sc[t.when]);
    if (run) return run(ctx);
    if (t.when === "milled" && (E.locate(s, t.i) || {}).z !== "hell") return { explain: "การ์ดใบนี้ไม่ได้อยู่ในนรกแล้ว ความสามารถไม่ทำงาน", ops: [] };
    return autoEffect(s, t, ctx);
  } catch (e) { if (e && e.ask) return { ask: e.ask }; throw e; }
}

// ---------- hooks the engine calls (kept here so engine.js does not import this file) ----------
const quiet = (fn) => { try { return fn(); } catch { return null; } };
// text "สั่งใช้" abilities of a card on the field that can be used right now
E.ext.acts = (s, x, L) => {
  if (!L || x.mute || !["av", "cs", "land"].includes(L.z) || scriptOf(s, x)) return [];
  const d = E.def(s, x); if (!d.x || !d.x.includes("สั่งใช้")) return [];
  const bot = s.P[L.p].bot || s.mode === "sim";
  return activations(d.x).filter((a) => a.where === "field" && !a.timed && !(x.ua && x.ua[a.k] === s.turn && (a.once || bot)))
    .filter((a) => { const r = quiet(() => autoEffect(s, { i: x.i, c: x.c, when: "activate", k: a.k, seat: L.p }, makeCtx(s, { i: x.i, c: x.c, seat: L.p }))); return r && !r.fail && r.ops.length > 0; })
    .map((a) => ({ k: a.k, label: a.text.length > 64 ? a.text.slice(0, 62) + "…" : a.text }));
};
// may this (unscripted) React card answer the window `on`?  true / false, or null when its timing cannot be read
// React cards whose moment the reader cannot check exactly (players only): offered only where the wording could fit,
// and never when the card names a moment the game has no window for.
function looseReact(s, x, p, on) {
  const t = String(E.def(s, x).x || ""); const head = t.split(/[:：]/)[0];
  const T = on.kind === "attack" && on.tk !== "life" ? E.locate(s, on.ti) : null; const A = on.kind === "attack" ? E.locate(s, on.att) : null;
  if (on.kind === "destroyed") return on.p === p && /ถูกทำลาย/.test(head) && !/จะ\s*ถูกทำลาย/.test(head) && (!/จากการต่อสู้/.test(head) || !!on.fight);
  if (/กำลังต่อสู้|ทำการต่อสู้/.test(head)) return on.kind === "attack" && on.tk === "av";
  if (/จะ(?:ถูกทำลาย|ออกจาก)/.test(head)) {
    if (on.kind === "attack") return !!(A && T && T.p === p && (/Cons?t[r]?uct/i.test(head) ? T.z === "cs" : T.z === "av") && E.power(s, A.x) + ((s.pend && s.pend.bonus) || 0) >= E.power(s, T.x));
    const L = E.locate(s, on.i); return !!L && /ทำลาย|เนรเทศ|ลงนรก|ออกจาก/.test(E.def(s, L.x).x || "");
  }
  if (/เป็นเป้า|ถูกโจมตี|โจมตีเข้ามา|ประกาศโจมตี/.test(head)) {
    if (on.kind !== "attack") return false;
    // a named or {Symbol} Avatar of ours must be the one attacked ("เมื่อ Avatar รถถังเป็นเป้าโจมตี")
    const dm = head.trim().match(DEFENDER); if (dm) { const f = defenderFilter(dm); if (!T || T.p !== p || T.z !== "av") return false; if (f && !fits(s, T.x, f)) return false; }
    return true;
  }
  if (/(?:ฝ่ายตรงข้าม|อีกฝ่าย)\s*ใช้ความสามารถ(?:ของ)?\s*Avatar/.test(head)) return on.kind === "summon" || on.kind === "activate";
  if (/^[\s"“”#-]*(?:เทิร์นละครั้ง\s*)?(?:สามารถ)?(?:ใช้(?:การ์ดนี้|การ์ดใบนี้)?ได้)?\s*(?:เมื่อ|ถ้า|หาก|ในช่วง)/.test(t)) return false;
  return true;
}
E.ext.react = (s, x, p, on, asPlayer) => {
  const d = E.def(s, x); const rt = reactTiming(d.x);
  // our own attack, asked after the defender answered: only a card about "our Avatar fights" (พลังแฝง), with our attacker as that Avatar
  if (on.own) { const A = rt && rt.mine && rt.either && on.tk === "av" ? E.locate(s, on.att) : null; if (!A || A.p !== p || A.z !== "av" || (rt.f && !fits(s, A.x, rt.f))) return false; }
  if (!rt) return asPlayer ? null : s.P[p].bot ? false : looseReact(s, x, p, on);
  if (!rt.kinds.includes(on.kind)) return false;
  if (rt.life && on.tk !== "life") return false;
  if (rt.mine && !on.own) { const T = on.tk === "av" ? E.locate(s, on.ti) : null; if (!T || T.p !== p || (rt.f && !fits(s, T.x, rt.f))) return false; }
  if (rt.dead) { const L = E.locate(s, on.i); if (on.p !== p || !L || (rt.fight && !on.fight) || (rt.f && !fits(s, L.x, rt.f))) return false; }
  if (asPlayer || !s.P[p].bot) return true; // players resolve it themselves if the effect is unreadable
  const r = quiet(() => autoEffect(s, { i: x.i, c: x.c, when: "cast", seat: p, on }, makeCtx(s, { i: x.i, c: x.c, seat: p }))); return !!(r && !r.fail && r.ops.length);
};

// may this (unscripted) Magic be cast now?  false = its printed condition is not met, null = condition unreadable
// Rule Book: a Magic whose effect cannot be carried out in full (บีม with no Avatar on the other side) cannot be used at all
E.ext.castFail = (s, x, p) => { const d = E.def(s, x); if (d.t !== "M" || d.st !== "N" || !d.x || scriptOf(s, x)) return null;
  const r = quiet(() => autoEffect(s, { i: x.i, c: x.c, when: "cast", seat: p }, makeCtx(s, { i: x.i, c: x.c, seat: p }))); return r && r.fail ? r.explain || NO_FULL : null; };
E.ext.canCast = (s, x, p) => { const d = E.def(s, x); const cond = /ใช้(?:การ์ด(?:ใบ)?นี้)?ได้(?:ต่อ)?(?:เมื่อ|ถ้า)/.test(d.x || "") ? playCond(s, d.x, p) : true; if (cond === false) return false;
  if (E.ext.castFail(s, x, p)) return false; return cond; };

// does this card text really have its own ability for this trigger? (used by the engine before queueing a trigger)
E.ext.trig = (text, when) => { const key = KEYS[when]; return !!(key && keyAt(String(text || ""), key)); };

// "when used as Cost for …" printed on card y: should it trigger for the card being summoned (definition td)?
E.ext.paid = (s, y, td) => { const d = E.def(s, y); const key = KEYS.paid; if (!d.x || !keyAt(d.x, key)) return false; const cl = clause(d.x, "paid"); const pf = cl ? paidFilter(cl.head) : null; return pf === null ? true : !pf || fitsD(td, pf); };
// "when this card is milled …": null, "any", or "god" (only by a purple {เทพ} Avatar or a Magic)
E.ext.milled = (s, x) => { const d = E.def(s, x); const m = d.x ? keyAt(d.x, KEYS.milled) : null; return m ? (m[1] ? "god" : "any") : null; };
// does a Modification do something at the moment it is worn? (most only give POWER / rules while worn)
E.ext.modCast = (text) => String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).some((l) => !/^(?:สวมใส่ได้|สามารถสวมใส่|#|เมื่อ|ถ้า|หาก|สั่งใช้|อัตโนมัติ|อัติโนมัติ|เทิร์นละครั้ง|ต่อเนื่อง|ตราบ|ในช่วง|ใน\s|Avatar\s*(?:ที่|ใบนี้)|POWER|สามารถควบคุม|ความสามารถของการ์ดใบนี้|สี(?:แดง|ฟ้า|เขียว|ม่วง)|\{red|-|\[|\()/.test(l));
