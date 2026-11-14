// ตารางพบกัน (who beats whom) and คู่มือเปลี่ยนมือ (which opening hands to keep), from bot-vs-bot simulations.
// Only the official decks (Starter Decks and box decks) come precomputed in data/matchups.json, made offline with the normal
// (quick) bot; Ciel's decks and a player's own decks are simulated here in the browser, in small chunks, and kept on that device.
// These are simulation numbers from our bot, not official data.
import { h, busy, lsGet, lsSet, openSheet } from "./util.js?v=20261115005244";
import { card, validateDeck, deckAce } from "./cards.js?v=20261115005244";
import { E } from "./engine.js?v=20261115005244";
import { allDecks } from "./views/decks.js?v=20261115005244";
import { deckLocked } from "./achieve.js?v=20261115005244";
import { simGame } from "./views/lab.js?v=20261115005244";

// ---------- the opening hand: what a hand looks like, as a small pattern ----------
// cheap: Avatars of Cost 2 or less (0 / 1 / 2+), big: cards of Cost 5 or more (0–1 / 2+), key: the deck's ace (its marked ace
// cards, or else its strongest Avatar, as the deck page shows it) is in the hand, matched by name
export const aceNames = (d) => { const a = new Set(((d && d.ace) || []).map((i) => card(i)).filter(Boolean).map((c) => c.n)); const top = d && deckAce(d); if (top) a.add(top.n); return a; };
export function handPattern(s, p, d) {
  const hand = s.P[p].hand.map((x) => E.def(s, x)); const ace = aceNames(d);
  const cheap = hand.filter((d) => d.t === "A" && (d.c || 0) <= 2).length, big = hand.filter((d) => (d.c || 0) >= 5).length;
  return { c: Math.min(2, cheap), b: big >= 2 ? 1 : 0, k: hand.some((x) => ace.has(x.n)) ? 1 : 0 };
}
export const PAT_KEYS = ["c0b0", "c0b1", "c1b0", "c1b1", "c2b0", "c2b1"];
export const patKey = (q) => `c${q.c}b${q.b}`;
export const patLabel = (k) => { const c = +k[1], b = +k[3]; return `Avatar Cost ≤2 ${c === 2 ? "2 ใบขึ้นไป" : c + " ใบ"} · การ์ด Cost 5+ ${b ? "2 ใบขึ้นไป" : "ไม่เกิน 1 ใบ"}`; };

// ---------- running games ----------
const score = (r) => (r.winner === 0 ? 1 : r.winner == null ? 0.5 : 0);
// n games of A (seat 0) against B; who starts alternates with the seed. Returns [n, wins, draws, games first, wins first, draws first]
export function pairGames(A, B, n, seed0, from = 0, acc = [0, 0, 0, 0, 0, 0]) {
  for (let i = from; i < from + n; i++) {
    const r = simGame(A, B, (seed0 + i) | 0); const f = r.first === 0;
    acc[0]++; if (r.winner === 0) acc[1]++; else if (r.winner == null) acc[2]++;
    if (f) { acc[3]++; if (r.winner === 0) acc[4]++; else if (r.winner == null) acc[5]++; }
  }
  return acc;
}
// one paired mulligan test: the same seed (so the same opening hand) played twice, once keeping the hand and once sending all
// five back; returns the hand's pattern and the two results
export function mullPair(A, B, seed) {
  let q = null;
  const keep = simGame(A, B, seed, false, false, null, (s) => { q = handPattern(s, 0, A); return []; });
  const mull = simGame(A, B, seed, false, false, null, (s) => s.P[0].hand.map((x) => x.i));
  return { q, keep: score(keep), mull: score(mull) };
}
// add one mulligan pair to a deck's tally: per pattern [pairs, keep wins, mulligan wins, sum of differences, sum of squares]
export function addMull(T, r) {
  for (const key of [patKey(r.q), r.q.k ? "key1" : "key0", "all"]) {
    const t = (T[key] = T[key] || [0, 0, 0, 0, 0]); const d = r.keep - r.mull;
    t[0]++; t[1] += r.keep; t[2] += r.mull; t[3] += d; t[4] += d * d;
  }
  return T;
}
// a pattern's verdict: keep or mulligan only when the gap is at least two standard errors of the paired difference
export function mullVerdict(t) {
  if (!t || t[0] < 2) return { v: "few", n: t ? t[0] : 0 };
  const n = t[0], m = t[3] / n, sd = Math.sqrt(Math.max(0, t[4] / n - m * m) * n / (n - 1)), se = sd / Math.sqrt(n);
  const sure = se > 0 && Math.abs(m) >= 2 * se && n >= 20;
  return { v: sure ? (m > 0 ? "keep" : "mull") : "even", n, keep: t[1] / n, mull: t[2] / n, d: m, se };
}
const VERD = { keep: "ควรเก็บมือ", mull: "ควรเปลี่ยนทั้งมือ", even: "พอ ๆ กัน", few: "เกมยังน้อยเกินไป" };

// ---------- the precomputed data ----------
let DATA = null, loading = null;
export function loadData() {
  if (DATA) return Promise.resolve(DATA); if (loading) return loading;
  const v = (import.meta.url.split("?v=")[1] || "0");
  loading = fetch(new URL("../data/matchups.json?v=" + v, import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => (DATA = d || { decks: [], m: {}, mull: {} }));
  return loading;
}
// a cell of the grid from row deck a's side: { n, w, d, nf, wf, df } (wins and draws overall, and when a went first)
function cellOf(m, a, b) {
  const k1 = a + "|" + b, k2 = b + "|" + a;
  if (m[k1]) { const [n, w, d, nf, wf, df] = m[k1]; return { n, w, d, nf, wf, df }; }
  if (m[k2]) { const [n, w, d, nf, wf, df] = m[k2]; const l = n - w - d; const ns = n - nf; return { n, w: l, d, nf: ns, wf: ns - (w - wf) - (d - df), df: d - df }; }
  return null;
}
const rate = (w, d, n) => (n ? (w + d / 2) / n : null);
const seOf = (p, n) => Math.sqrt(Math.max(0, p * (1 - p)) / Math.max(1, n));
const pc = (x) => (x == null ? "–" : Math.round(x * 100) + "%");

// a player's own results live on this device only (they come from their own decks)
const OWN = "bot.mm.own", OWNM = "bot.mm.mull";
const sig = (d) => JSON.stringify([d.main, d.life]).length + ":" + Object.entries(d.main || {}).reduce((a, [k, n]) => (a * 31 + (+k || 0) * 7 + n) % 1e9, 7);
const visibleDecks = () => allDecks().filter((d) => validateDeck(d).ok && !deckLocked(d));

// ---------- ตารางพบกัน ----------
export async function openMatrix() {
  const data = await loadData(); const st = lsGet("bot.mm.view", { side: "all" });
  const decks = visibleDecks(); const built = decks.filter((d) => data.decks.includes(d.id));
  const own = decks.filter((d) => !data.decks.includes(d.id)); const store = lsGet(OWN, {});
  const m = { ...data.m }; for (const d of own) { const o = store[d.id]; if (o && o.sig === sig(d)) Object.assign(m, o.m); }
  const rows = [...built, ...own.filter((d) => store[d.id] && store[d.id].sig === sig(d))];
  const cols = built;
  openSheet((api) => {
    const val = (a, b) => { const c = cellOf(m, a.id, b.id); if (!c) return null;
      if (st.side === "first") return { p: rate(c.wf, c.df, c.nf), n: c.nf };
      if (st.side === "second") return { p: rate(c.w - c.wf, c.d - c.df, c.n - c.nf), n: c.n - c.nf };
      return { p: rate(c.w, c.d, c.n), n: c.n }; };
    const rank = rows.map((a) => { let w = 0, n = 0; for (const b of cols) { if (b.id === a.id) continue; const c = cellOf(m, a.id, b.id); if (!c) continue; const v = val(a, b); if (v.p == null) continue; w += v.p * v.n; n += v.n; } return { a, p: n ? w / n : null, n }; })
      .filter((r) => r.p != null).sort((x, y) => y.p - x.p);
    const short = (d) => /^(starter|box)-/.test(d.id) ? d.id.split("-")[1].toUpperCase() : d.name.length > 10 ? d.name.slice(0, 9) + "…" : d.name; // SD01 / KD03; the full name is in the tooltip and the ranking
    const tone = (p) => (p == null ? "" : `background:rgba(${p >= 0.5 ? "80,200,140" : "230,90,100"},${Math.min(0.55, Math.abs(p - 0.5) * 1.4)})`);
    const draw = () => api.set([
      h("div", { class: "small muted" }, "ตัวเลขจากบอทปกติเล่นกันเอง (ไม่ใช่ข้อมูลทางการ) อ่านแถว: เด็คในแถวชนะเด็คในคอลัมน์กี่เปอร์เซ็นต์ แตะช่องเพื่อดู ± และจำนวนเกม"),
      h("div", { class: "row mmside", role: "group", "aria-label": "ฝั่งที่เริ่ม" }, [["all", "รวม"], ["first", "เล่นก่อน"], ["second", "เล่นหลัง"]].map(([k, t]) =>
        h("button", { class: "btn sm" + (st.side === k ? " gold" : ""), "aria-pressed": String(st.side === k), onclick: () => { st.side = k; lsSet("bot.mm.view", st); draw(); } }, t))),
      h("div", { class: "eyebrow" }, "อันดับเด็ค (อัตราชนะเฉลี่ยกับทุกเด็คในตาราง)"),
      h("ol", { class: "mmrank" }, rank.map((r, i) => h("li", null, h("span", { class: "num" }, String(i + 1)), h("span", { class: "grow" }, r.a.name + (store[r.a.id] ? " (จำลองในเครื่องนี้)" : "")),
        h("b", { class: "num" }, pc(r.p)), h("span", { class: "tiny muted num" }, `±${Math.round(seOf(r.p, r.n) * 100)} · ${r.n} เกม`)))),
      h("div", { class: "eyebrow" }, "ตารางพบกัน"),
      h("div", { class: "mmwrap" }, h("table", { class: "mmgrid" },
        h("thead", null, h("tr", null, h("th", { class: "rh" }, "แถว ชนะ คอลัมน์"), cols.map((b) => h("th", { title: b.name }, h("span", null, short(b)))))),
        h("tbody", null, rows.map((a) => h("tr", null, h("th", { class: "rh", title: a.name }, short(a)),
          cols.map((b) => { const v = val(a, b); if (!v || v.p == null) return h("td", { class: "na" }, "–");
            const tip = `${a.name} ชนะ ${b.name} ${pc(v.p)} ±${Math.round(seOf(v.p, v.n) * 100)} จาก ${v.n} เกม`;
            return h("td", { style: tone(v.p), title: tip, tabindex: "0", onclick: (e) => { e.currentTarget.classList.toggle("open"); } }, h("b", null, pc(v.p)), h("small", null, `±${Math.round(seOf(v.p, v.n) * 100)} · ${v.n}`)); })))))),
      ownPanel(own, store, () => { api.close(); openMatrix(); }),
      h("div", { class: "tiny muted" }, data.made ? `ข้อมูลเด็คในเกมคำนวณเมื่อ ${data.made} · ${data.per} เกมต่อคู่ · บอทปกติ` : "ยังไม่มีข้อมูลที่คำนวณไว้"),
    ]);
    queueMicrotask(draw); return [busy()]; // openSheet sets what this returns, so the first draw comes right after
  }, { title: "ตารางพบกัน", sub: "เด็คไหนชนะเด็คไหน แยกเล่นก่อนและเล่นหลัง", wide: true });
}
// simulate one of the player's own decks against every built-in deck in the grid
function ownPanel(own, store, done) {
  if (!own.length) return h("div", { class: "small muted" }, "เด็คที่คุณสร้างเองจะเพิ่มเข้าตารางได้ เมื่อมีเด็คที่ถูกกติกา");
  const st = lsGet("bot.mm.ownpick", { id: own[0].id, n: 20 }); if (!own.some((d) => d.id === st.id)) st.id = own[0].id;
  const out = h("div", { class: "small" }); let stop = false;
  return h("div", { class: "panel stack mmown" },
    h("div", { class: "eyebrow" }, "เพิ่มเด็คของคุณเข้าตาราง (จำลองในเครื่องนี้)"),
    h("div", { class: "row wrap" }, h("select", { "aria-label": "เด็คของคุณ", onchange: (e) => { st.id = e.target.value; lsSet("bot.mm.ownpick", st); } }, own.map((d) => h("option", { value: d.id, selected: d.id === st.id }, d.name))),
      h("select", { "aria-label": "จำนวนเกมต่อคู่", onchange: (e) => { st.n = +e.target.value; lsSet("bot.mm.ownpick", st); } }, [20, 50, 100].map((n) => h("option", { value: n, selected: n === st.n }, `${n} เกมต่อคู่`))),
      h("button", { class: "btn gold sm", onclick: async (e) => {
        const btn = e.currentTarget; btn.disabled = true; stop = false; const data = await loadData();
        const A = own.find((d) => d.id === st.id), opps = visibleDecks().filter((d) => data.decks.includes(d.id)); const res = {}; const total = opps.length * st.n; let done1 = 0;
        const seed0 = (Date.now() ^ 0x2545f491) | 0;
        for (const B of opps) { const acc = [0, 0, 0, 0, 0, 0];
          for (let i = 0; i < st.n; i += 2) { if (stop) break; pairGames(A, B, Math.min(2, st.n - i), seed0, i, acc); done1 += Math.min(2, st.n - i);
            out.replaceChildren(h("div", { class: "trk" }, h("i", { style: `width:${(done1 / total) * 100}%` })), h("span", { class: "tiny muted" }, `จำลองแล้ว ${done1}/${total} เกม`)); await new Promise((ok) => setTimeout(ok, 0)); }
          if (stop) break; res[A.id + "|" + B.id] = acc; }
        if (!stop) { const all = lsGet(OWN, {}); all[A.id] = { sig: sig(A), m: res, at: Date.now() }; lsSet(OWN, all); done(); } else { btn.disabled = false; out.replaceChildren(h("span", { class: "muted" }, "หยุดแล้ว")); }
      } }, "จำลอง"), h("button", { class: "btn sm", onclick: () => { stop = true; } }, "หยุด")),
    out, h("div", { class: "tiny muted" }, "ผลเก็บไว้ในเครื่องนี้เท่านั้น ถ้าแก้เด็คแล้วต้องจำลองใหม่"));
}

// ---------- คู่มือเปลี่ยนมือ ----------
const mullOf = (data, d) => { if (data.mull && data.mull[d.id]) return { T: data.mull[d.id], built: true }; const o = lsGet(OWNM, {})[d.id]; return o && o.sig === sig(d) ? { T: o.T, built: false } : null; };
export async function openMull(d) {
  const data = await loadData();
  openSheet((api) => {
    const out = h("div", { class: "small" }); let stop = false;
    const draw = () => { const got = mullOf(data, d);
      api.set([
        h("div", { class: "small muted" }, "แต่ละมือเปิดถูกเล่น 2 ครั้งด้วยการสับเดียวกัน: ครั้งหนึ่งเก็บมือ อีกครั้งเปลี่ยนทั้ง 5 ใบ แล้วเทียบอัตราชนะ จะแนะนำก็ต่อเมื่อต่างกันเกิน 2 เท่าของความคลาดเคลื่อน ไม่อย่างนั้นบอกว่าพอ ๆ กัน"),
        got ? table(got.T, d) : h("div", { class: "muted" }, "ยังไม่มีข้อมูลของเด็คนี้"),
        got && got.built ? null : h("div", { class: "row wrap" }, h("button", { class: "btn gold sm", onclick: async (e) => {
          e.currentTarget.disabled = true; stop = false; const opps = visibleDecks().filter((x) => data.decks.includes(x.id) && x.id !== d.id); const N = 200; const T = {}; const seed0 = (Date.now() ^ 0x1b873593) | 0;
          for (let i = 0; i < N && !stop; i++) { addMull(T, mullPair(d, opps[i % Math.max(1, opps.length)] || d, (seed0 + i) | 0));
            if (i % 2) { out.replaceChildren(h("div", { class: "trk" }, h("i", { style: `width:${((i + 1) / N) * 100}%` })), h("span", { class: "tiny muted" }, `จำลองแล้ว ${i + 1}/${N} มือ (${(i + 1) * 2} เกม)`)); await new Promise((ok) => setTimeout(ok, 0)); } }
          if (!stop) { const all = lsGet(OWNM, {}); all[d.id] = { sig: sig(d), T, at: Date.now() }; lsSet(OWNM, all); draw(); }
        } }, got ? "จำลองใหม่ (200 มือ)" : "จำลอง 200 มือ"), h("button", { class: "btn sm", onclick: () => { stop = true; } }, "หยุด")),
        out,
        h("div", { class: "tiny muted" }, got && got.built ? `คำนวณไว้แล้วด้วยบอทปกติ ${data.made || ""}` : "ผลเก็บไว้ในเครื่องนี้เท่านั้น"),
      ]); };
    queueMicrotask(draw); return [busy()]; // openSheet sets what this returns, so the first draw comes right after
  }, { title: "คู่มือเปลี่ยนมือ", sub: d.name, wide: true });
}
function table(T, d) {
  const aceLabel = [...aceNames(d)].join(", ") || "–";
  const row = (k, label) => { const r = mullVerdict(T[k]);
    return h("tr", null, h("td", null, label), h("td", { class: "num" }, String(r.n)), h("td", { class: "num" }, r.keep == null ? "–" : pc(r.keep)), h("td", { class: "num" }, r.mull == null ? "–" : pc(r.mull)),
      h("td", { class: "num" }, r.d == null ? "–" : `${r.d >= 0 ? "+" : "−"}${Math.abs(Math.round(r.d * 100))} ±${Math.round(r.se * 100)}`), h("td", { class: "mmv " + r.v }, VERD[r.v])); };
  return h("div", { class: "mmwrap" }, h("table", { class: "mmtab" },
    h("thead", null, h("tr", null, ["มือเปิด", "มือ", "เก็บ", "เปลี่ยน", "ต่าง", "คำแนะนำ"].map((t) => h("th", null, t)))),
    h("tbody", null, PAT_KEYS.map((k) => row(k, patLabel(k))), row("key1", "มีการ์ดเอซในมือ: " + aceLabel), row("key0", "ไม่มีการ์ดเอซในมือ"), row("all", "ทุกมือรวมกัน"))));
}
// the in-game hint (off unless the player turns it on in settings): one line for the hand in front of them
export function mullHint(s, p) {
  if (!lsGet("bot.mullHint", false) || !DATA) return null;
  const id = s.P[p].deckId; const d = allDecks().find((x) => x.id === id); if (!d) return null;
  const got = mullOf(DATA, d); if (!got) return null;
  const q = handPattern(s, p, d), r = mullVerdict(got.T[patKey(q)]);
  if (r.v === "few") return null;
  return `คู่มือเปลี่ยนมือ: มือแบบนี้${r.v === "even" ? "เก็บหรือเปลี่ยนก็พอ ๆ กัน" : r.v === "keep" ? "ควรเก็บ" : "ควรเปลี่ยนทั้งมือ"} (เก็บ ${pc(r.keep)} · เปลี่ยน ${pc(r.mull)} · ${r.n} มือที่จำลอง)`;
}
loadData(); // warm the data so the in-game hint is ready by the first mulligan
