// Deck tools: earlier versions of a deck with a one-click A/B between two of them, and card stats in the style of 17lands
// (how a card relates to winning when it is in the opening hand, drawn later, or played).
// Versions are made only by the player's own saves of his own decks; nothing here ever changes a deck.
// The games run a few at a time inside a time budget, so the page stays responsive, with a bar and a stop button.
import { h, openSheet, lsGet, lsSet, toast } from "./util.js?v=20261115005244";
import { card, deckEntries, validateDeck } from "./cards.js?v=20261115005244";
import { E } from "./engine.js?v=20261115005244";
import { F, db, Me, Data } from "./fb.js?v=20261115005244";
import { simGame } from "./views/lab.js?v=20261115005244";
import { showCard } from "./ui.js?v=20261115005244";
import { allDecks } from "./views/decks.js?v=20261115005244";
import { deckLocked } from "./achieve.js?v=20261115005244";

// ---------- versions ----------
// kept in the player's private space (users/{uid}/private/deckvers): { v: { deckId: [{ at, m, l, s }] } }, newest last
const KEEP = 30, DECKS = 40, SESSION_MIN = 30;
const lastAt = (l) => (l && l.length ? l[l.length - 1].at || 0 : 0);
const SESSION = Math.random().toString(36).slice(2, 8); // edits within one visit (and half an hour) make one version
let Vers = {}, unsub = null, base = {}, ready = null, onVer = null;
const verRef = () => F.doc(db, "users", Me.uid, "private", "deckvers");
// the stored versions, read live; resolves true once they are in (a version is never written before that, so a slow
// connection cannot overwrite the history with a short list)
export function watchVersions() {
  if (ready) return ready; if (!Me.uid) return Promise.resolve(false);
  ready = new Promise((res) => {
    try { unsub = F.onSnapshot(verRef(), (s) => { Vers = (s.exists() && s.data() && s.data().v) || {}; res(true); if (onVer) try { onVer(); } catch (e) { console.warn(e); } }, () => res(false)); }
    catch (e) { console.warn(e); res(false); }
  });
  return ready;
}
const snap = (d) => ({ m: { ...(d.main || {}) }, l: [...(d.life || [])].map(Number) });
const sig = (v) => JSON.stringify([Object.entries(v.m || {}).filter(([, n]) => n > 0).map(([k, n]) => [+k, n]).sort((a, b) => a[0] - b[0]), [...(v.l || [])].sort((a, b) => a - b)]);
export const versionsOf = (id) => (id && Vers[id]) || [];
// the list as it was before the first edit of this visit (called before every change, only the first one counts)
export function noteBase(d) { if (d && d.id && !base[d.id]) { base[d.id] = { ...snap(d), at: d.updatedAt || Date.now() - 1 }; watchVersions(); } }
// after a save of one of my decks: add the new list as a version, or update this visit's version
export async function noteVersion(d) {
  if (!d || !d.id || d.owner !== Me.uid || d.starter || d.ciel) return;
  const ok = await Promise.race([watchVersions(), new Promise((r) => setTimeout(() => r(false), 8000))]); if (!ok) return;
  const list = [...versionsOf(d.id)], now = Date.now(), cur = { ...snap(d), at: now, s: SESSION };
  if (!list.length && base[d.id] && sig(base[d.id]) !== sig(cur)) list.push({ ...base[d.id], s: "" });
  const last = list[list.length - 1];
  if (last && sig(last) === sig(cur)) return;
  if (last && last.s === SESSION && now - last.at < SESSION_MIN * 60000 && list.length > 1) list[list.length - 1] = cur; else list.push(cur);
  while (list.length > KEEP) list.shift();
  Vers = { ...Vers, [d.id]: list };
  // one document holds every deck's versions: at most DECKS decks (the ones changed least recently drop out), so even
  // 40 decks x 30 versions of 50 different cards stay near 600 KB, well under Firestore's 1 MB a document
  const patch = { [d.id]: list }; const ids = Object.keys(Vers).sort((a, b) => lastAt(Vers[b]) - lastAt(Vers[a]));
  for (const old of ids.slice(DECKS)) { delete Vers[old]; patch[old] = F.deleteField(); }
  try { await F.setDoc(verRef(), { v: patch, updatedAt: now }, { merge: true }); } catch (e) { console.warn(e); }
}
// the cards that changed from version a to version b, by name: [{ n, d }]
function diff(a, b) {
  const count = (v) => { const o = {}; for (const [k, n] of Object.entries(v.m || {})) { const c = card(k); if (c) o[c.n] = (o[c.n] || 0) + n; } for (const k of v.l || []) { const c = card(k); if (c) o["LIFE " + c.n] = (o["LIFE " + c.n] || 0) + 1; } return o; };
  const A = count(a), B = count(b); return [...new Set([...Object.keys(A), ...Object.keys(B)])].map((n) => ({ n, d: (B[n] || 0) - (A[n] || 0) })).filter((x) => x.d).sort((x, y) => x.d - y.d);
}
const when = (t) => { try { return new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const asDeck = (d, v, tag) => ({ ...d, id: d.id + "@" + tag, name: d.name + " " + tag, main: { ...v.m }, life: [...v.l] });

// ---------- running many bot games without freezing the page ----------
async function runGames(n, one, onTick, stopped) {
  const res = []; let t0 = performance.now();
  for (let i = 0; i < n; i++) {
    if (stopped()) break;
    res.push(one(i));
    if (performance.now() - t0 > 35) { onTick(res.length, n); await new Promise((ok) => setTimeout(ok, 0)); t0 = performance.now(); }
  }
  onTick(res.length, n); return res;
}
const score = (r) => (r.winner === 0 ? 1 : r.winner == null ? 0.5 : 0);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const seOf = (p, n) => Math.sqrt(Math.max(0, p * (1 - p)) / Math.max(1, n));
const pc = (x) => (x * 100).toFixed(1) + "%";
const pts = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1);
// the opponents a test can use: the sample decks (official, Ciel's) or one deck
function opponentChoices() {
  const ok = allDecks().filter((d) => validateDeck(d).ok && !deckLocked(d));
  return { ok, sample: ok.filter((d) => d.starter || d.ciel) };
}
function oppSelect(state, key) {
  const { ok, sample } = opponentChoices();
  return h("select", { "aria-label": "เด็คคู่แข่ง", onchange: (e) => { state[key] = e.target.value; } },
    [...(sample.length ? [["*", `ทุกเด็คตัวอย่าง (${sample.length} เด็ค)`]] : []), ...ok.map((d) => [d.id, d.name])].map(([v, t]) => h("option", { value: v, selected: v === state[key] }, t)));
}
const oppsOf = (v) => { const { ok, sample } = opponentChoices(); return v === "*" ? sample : ok.filter((d) => d.id === v); };

// A/B of two lists: the same seeds and opponents for both, each seed played by both lists (paired), so the luck of the
// draw mostly cancels and the difference is measured with a paired standard error
export async function abTest(d1, d2, opps, n, onTick, stopped) {
  const seed0 = (Date.now() ^ 0x5bd1e995) | 0; const rows = [];
  const res = await runGames(n, (i) => { const seed = (seed0 + i * 7919) | 0, B = opps[i % opps.length]; const a = simGame(d1, B, seed), b = simGame(d2, B, seed); return { a, b, opp: B.name }; }, onTick, stopped);
  for (const r of res) rows.push(r);
  const n2 = rows.length; if (!n2) return null;
  const side = (k) => { const sc = rows.map((r) => score(r[k])), p = mean(sc), f = rows.filter((r) => r[k].first === 0), s = rows.filter((r) => r[k].first !== 0);
    return { p, se: seOf(p, n2), first: f.length ? mean(f.map((r) => score(r[k]))) : null, nf: f.length, second: s.length ? mean(s.map((r) => score(r[k]))) : null, ns: s.length, turns: mean(rows.map((r) => r[k].turns)) }; };
  const ds = rows.map((r) => score(r.a) - score(r.b)), dm = mean(ds), sd = Math.sqrt(ds.reduce((a, x) => a + (x - dm) ** 2, 0) / Math.max(1, ds.length - 1));
  const byOpp = [...new Set(rows.map((r) => r.opp))].map((o) => { const g = rows.filter((r) => r.opp === o); return { o, n: g.length, a: mean(g.map((r) => score(r.a))), b: mean(g.map((r) => score(r.b))) }; });
  return { n: n2, A: side("a"), B: side("b"), d: dm, se: sd / Math.sqrt(n2), byOpp };
}
export function verdict(R, nameA, nameB) {
  if (!R) return "ยังไม่มีเกม";
  const gap = Math.abs(R.d), sure = R.se > 0 && gap >= 2 * R.se;
  if (!sure) return `ยังไม่แน่ชัด: ต่างกัน ${(gap * 100).toFixed(1)} จุด แต่ยังไม่ถึง 2 เท่าของความคลาดเคลื่อน (±${(R.se * 100).toFixed(1)}) อาจเป็นดวง ลองเพิ่มจำนวนเกม`;
  return `${R.d > 0 ? nameA : nameB} ชนะมากกว่าราว ${(gap * 100).toFixed(1)} จุด (เกิน 2 เท่าของความคลาดเคลื่อน ±${(R.se * 100).toFixed(1)}) ถือว่าต่างกันจริง`;
}
function showAB(out, R, nA, nB) {
  const col = (S, nm) => h("div", { class: "stat" }, h("span", { class: "eyebrow" }, nm), h("b", null, pc(S.p)), h("span", { class: "tiny muted" }, `±${(S.se * 100).toFixed(1)} · ก่อน ${S.first == null ? "-" : pc(S.first)} · หลัง ${S.second == null ? "-" : pc(S.second)}`));
  out.replaceChildren(
    h("div", { class: "statrow" }, col(R.A, nA), col(R.B, nB), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ต่างกัน"), h("b", { class: Math.abs(R.d) >= 2 * R.se && R.se > 0 ? (R.d > 0 ? "up" : "down") : "" }, pts(R.d) + " จุด"), h("span", { class: "tiny muted" }, `±${(R.se * 100).toFixed(1)} (จับคู่ seed เดียวกัน)`))),
    h("div", { class: "dvverdict small" }, verdict(R, nA, nB)),
    h("div", { class: "small muted" }, `${R.n} คู่เกม (รุ่นละ ${R.n} เกม) · บอทปกติทั้งสองฝั่ง · เกมยาวเฉลี่ย ${R.A.turns.toFixed(1)} / ${R.B.turns.toFixed(1)} เทิร์น`),
    R.byOpp.length > 1 ? h("details", { class: "small" }, h("summary", null, "แยกตามคู่แข่ง"), h("div", { class: "dvtab" }, h("table", null, h("thead", null, h("tr", null, h("th", null, "คู่แข่ง"), h("th", null, "เกม"), h("th", null, nA), h("th", null, nB))),
      h("tbody", null, R.byOpp.map((o) => h("tr", null, h("td", null, o.o), h("td", { class: "num" }, String(o.n)), h("td", { class: "num" }, pc(o.a)), h("td", { class: "num" }, pc(o.b)))))))) : null);
}
// the versions of one deck and the A/B between two of them
export function openVersions(d) {
  watchVersions();
  openSheet((api) => {
    const st = lsGet("bot.dvab", { opp: "*", n: 200 }); let stopped = false, busyRun = false;
    const render = () => {
      const list = versionsOf(d.id); const cur = { ...snap(d), at: d.updatedAt || Date.now() };
      const all = list.length && sig(list[list.length - 1]) === sig(cur) ? list : [...list, { ...cur, s: "now" }];
      const label = (k) => (k === all.length - 1 ? `รุ่นปัจจุบัน (${k + 1})` : `รุ่น ${k + 1}`);
      if (all.length < 2) return api.set([h("div", { class: "small" }, "เด็คนี้ยังมีรุ่นเดียว พอแก้การ์ดแล้วบันทึก ชิเอลจะเก็บรุ่นก่อนหน้าไว้ให้เทียบเองค่ะ"),
        h("div", { class: "tiny muted" }, "รุ่นจะถูกเก็บจากการบันทึกของคุณเท่านั้น การแก้ในการเข้าเว็บครั้งเดียวกัน (ภายใน 30 นาที) นับเป็นรุ่นเดียว เก็บได้สูงสุด 30 รุ่น")]);
      if (st.a == null || st.a >= all.length) st.a = all.length - 1; if (st.b == null || st.b >= all.length || st.b === st.a) st.b = Math.max(0, all.length - 2 === st.a ? all.length - 1 : all.length - 2);
      const pickV = (key) => h("select", { "aria-label": key === "a" ? "รุ่นแรก" : "รุ่นที่สอง", onchange: (e) => { st[key] = +e.target.value; render(); } }, all.map((v, k) => h("option", { value: k, selected: k === st[key] }, `${label(k)} · ${when(v.at)}`)));
      const out = h("div", { class: "stack", style: "gap:10px" }); const bar = h("i", { style: "width:0%" }); const line = h("span", { class: "tiny muted" });
      const vA = all[st.a], vB = all[st.b], dA = asDeck(d, vA, label(st.a)), dB = asDeck(d, vB, label(st.b));
      const okA = validateDeck(dA), okB = validateDeck(dB), dd = diff(vB, vA);
      const runBtn = h("button", { class: "btn gold", disabled: !okA.ok || !okB.ok || !dd.length, onclick: async () => {
        const opps = oppsOf(st.opp); if (!opps.length) return toast("เลือกเด็คคู่แข่งก่อน"); lsSet("bot.dvab", { opp: st.opp, n: st.n });
        runBtn.disabled = true; stopped = false; busyRun = true; stopBtn.hidden = false; prog.hidden = false;
        const R = await abTest(dA, dB, opps, st.n, (k, n) => { bar.style.width = Math.round((k / n) * 100) + "%"; line.textContent = `${k}/${n} คู่เกม`; }, () => stopped || !api.body.isConnected);
        busyRun = false; stopBtn.hidden = true; runBtn.disabled = false; if (R) showAB(out, R, label(st.a), label(st.b));
      } }, "เทียบรุ่น");
      const stopBtn = h("button", { class: "btn sm", hidden: true, onclick: () => { stopped = true; } }, "หยุด (ใช้ผลที่ได้แล้ว)");
      const prog = h("div", { class: "row", hidden: true }, h("div", { class: "trk dvtrk grow", role: "progressbar", "aria-label": "ความคืบหน้า" }, bar), line, stopBtn);
      api.set([
        h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, "รุ่นที่เก็บไว้"),
          h("div", { class: "dvvers" }, all.map((v, k) => { const ch = k ? diff(all[k - 1], v) : []; return h("div", { class: "dvver" }, h("b", { class: "small" }, label(k)), h("span", { class: "tiny muted" }, when(v.at)),
            h("span", { class: "small" }, k === 0 ? "รุ่นแรกที่เก็บไว้" : ch.length ? ch.map((x) => h("span", { class: "chip " + (x.d > 0 ? "good" : "bad") }, `${x.d > 0 ? "+" : "−"}${Math.abs(x.d)} ${x.n}`)) : "ไม่มีการ์ดเปลี่ยน")); }).reverse())),
        h("div", { class: "panel stack" },
          h("div", { class: "row" }, pickV("a"), h("span", { class: "small muted" }, "เทียบกับ"), pickV("b")),
          h("div", { class: "small" }, dd.length ? [h("span", { class: "muted" }, `${label(st.a)} ต่างจาก ${label(st.b)}: `), ...dd.map((x) => h("span", { class: "chip " + (x.d > 0 ? "good" : "bad") }, `${x.d > 0 ? "+" : "−"}${Math.abs(x.d)} ${x.n}`))] : h("span", { class: "muted" }, "สองรุ่นนี้การ์ดเหมือนกัน")),
          !okA.ok || !okB.ok ? h("div", { class: "small bad" }, "รุ่นที่เลือกยังไม่ครบกติกา จึงจำลองไม่ได้") : null,
          h("div", { class: "row" }, h("span", { class: "small" }, "ชน"), oppSelect(st, "opp"),
            h("select", { "aria-label": "จำนวนเกม", onchange: (e) => { st.n = +e.target.value; } }, [200, 400, 1000, 2000].map((n) => h("option", { value: n, selected: n === st.n }, `${n} คู่เกม`))), runBtn),
          h("div", { class: "tiny muted" }, "แต่ละคู่เกมใช้ seed และคู่แข่งเดียวกันทั้งสองรุ่น สลับเล่นก่อน/หลังทีละเกม บอทปกติเล่นทั้งสองฝั่ง เด็คของคุณจะไม่ถูกแก้ ตัดสินว่าต่างกันจริงเมื่อห่างเกิน 2 เท่าของความคลาดเคลื่อน"),
          prog, out)]);
    };
    onVer = () => { if (api.body.isConnected && !busyRun) render(); };
    render(); return [...api.body.childNodes];
  }, { title: "รุ่นของเด็ค: " + d.name, wide: true, onClose: () => { onVer = null; } });
}

// ---------- card stats ----------
// a game's facts about seat p's cards: names in the opening hand (after the mulligan), names that came into the hand later,
// and names played with the round they were first played (round = ceil(turn / 2))
function tracker(p) {
  const T = { open: null, seen: new Set(), played: new Map(), ev: 0 };
  T.step = (s, a, q) => {
    if (T.open == null && a && a.type === "mull" && q === p) { T.open = new Set(s.P[p].hand.map((x) => E.def(s, x).n)); }
    if (T.open != null) for (const x of s.P[p].hand) T.seen.add(E.def(s, x).n);
    for (const e of s.ev || []) if (e.id > T.ev) { T.ev = e.id; if ((e.k === "summon" || e.k === "cast") && e.p === p) { const L = E.locate(s, e.i); if (L) { const n = E.def(s, L.x).n; if (!T.played.has(n)) T.played.set(n, Math.ceil(Math.max(1, s.turn) / 2)); } } }
    for (const x of s.P[p].cs) { const n = E.def(s, x).n; if (!T.played.has(n)) T.played.set(n, Math.ceil(Math.max(1, s.turn) / 2)); }
  };
  T.out = (won) => ({ w: won, open: [...(T.open || [])], seen: [...T.seen], played: [...T.played] });
  return T;
}
// one sim game of deck A (seat 0) with its card facts
function simTracked(A, B, seed) { const T = tracker(0); const r = simGame(A, B, seed, false, false, (s, a, q) => T.step(s, a, q)); return T.out(score(r)); }
// adds games into a running total kept per deck: { g, w, c: { name: [ohN, ohW, gdN, gdW, plN, plW, turnSum] } }
function addGames(tot, games) {
  for (const g of games) {
    tot.g++; tot.w += g.w; const open = new Set(g.open);
    const cell = (n) => (tot.c[n] = tot.c[n] || [0, 0, 0, 0, 0, 0, 0]);
    for (const n of open) { const c = cell(n); c[0]++; c[1] += g.w; }
    for (const n of g.seen) if (!open.has(n)) { const c = cell(n); c[2]++; c[3] += g.w; }
    for (const [n, t] of g.played) { const c = cell(n); c[4]++; c[5] += g.w; c[6] += t; }
  }
  return tot;
}
const deckSig = (d) => sig(snap(d));
const SIMKEY = "bot.cstat.";
// this player's own kept games with deck d, played again from their replays (bot games; the practice dummy is left out)
function replayGames(d) {
  const games = []; const recStart = (rec) => (rec.start ? JSON.parse(rec.start) : E.newGame(rec.init));
  const apply = (s, [p, a]) => { if (a.type === "__lose") return E.lose(s, p, a.reason); try { E.apply(s, JSON.parse(JSON.stringify(a)), p); } catch (e) { if (!a.__fail) throw e; } };
  for (const mid of lsGet("bot.rp.idx", [])) {
    const r = lsGet("bot.rp." + mid, null); if (!r || !r.rec || r.rec.start) continue;
    const m = (Data.matches || []).find((x) => x.id === mid); if (m && (m.mode === "goldfish" || m.deckId !== d.id)) continue;
    try {
      const s = recStart(r.rec), V = r.V || 0; if (s.P[V].deckId !== d.id || s.P[1 - V].name === "หุ่นซ้อม") continue;
      const T = tracker(V); for (const act of r.rec.acts) { apply(s, act); T.step(s, act[1], act[0]); }
      if (s.phase !== "over") continue; games.push(T.out(s.winner === V ? 1 : s.winner == null ? 0.5 : 0));
    } catch (e) { console.warn("replay stats", mid, e); }
  }
  return games;
}
const MIN_N = 20;
function statTable(d, tot) {
  const names = [...new Set(deckEntries(d).map((e) => e.c.n))]; const W = tot.g ? tot.w / tot.g : 0;
  const idOf = (n) => (deckEntries(d).find((e) => e.c.n === n) || {}).id;
  const cell = (N, Wn) => { const ok = N >= MIN_N; const wr = N ? Wn / N : null; return h("td", { class: "num" + (ok ? (wr - W > 0.04 ? " up" : wr - W < -0.04 ? " down" : "") : " dim") }, wr == null ? "–" : pc(wr), h("span", { class: "tiny muted" }, ` n${N}`)); };
  const rows = names.map((n) => { const c = tot.c[n] || [0, 0, 0, 0, 0, 0, 0]; const gihN = c[0] + c[2], gihW = c[1] + c[3]; return { n, c, gihN, gihW, gih: gihN ? gihW / gihN : -1 }; }).sort((a, b) => (b.gihN >= MIN_N) - (a.gihN >= MIN_N) || b.gih - a.gih);
  return h("div", { class: "dvtab" }, h("table", null,
    h("thead", null, h("tr", null, h("th", null, "การ์ด"), h("th", { title: "ชนะกี่ % ในเกมที่การ์ดนี้เคยอยู่บนมือ (มือเปิด + จั่วทีหลัง)" }, "อยู่บนมือ"), h("th", { title: "ชนะกี่ % เมื่ออยู่ในมือเปิดหลังเปลี่ยนมือ" }, "มือเปิด"), h("th", { title: "ชนะกี่ % เมื่อไม่อยู่ในมือเปิด แต่จั่วได้ทีหลัง" }, "จั่วทีหลัง"), h("th", { title: "ชนะกี่ % ในเกมที่ได้ลงสนามหรือใช้" }, "ได้ลง"), h("th", { title: "ลงครั้งแรกเฉลี่ยรอบที่เท่าไร (รอบ = เทิร์นเราหนึ่งครั้ง)" }, "ลงรอบที่"))),
    h("tbody", null, rows.map((r) => h("tr", null, h("td", null, h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); const id = idOf(r.n); if (id != null) showCard(id); } }, r.n)),
      cell(r.gihN, r.gihW), cell(r.c[0], r.c[1]), cell(r.c[2], r.c[3]), cell(r.c[4], r.c[5]), h("td", { class: "num" + (r.c[4] >= MIN_N ? "" : " dim") }, r.c[4] ? (r.c[6] / r.c[4]).toFixed(1) : "–"))))));
}
export function openCardStats(d) {
  openSheet((api) => {
    const st = lsGet("bot.dvcs", { src: "sim", opp: "*", n: 200 }); let stopped = false;
    const key = SIMKEY + d.id; const fresh = () => ({ sig: deckSig(d), g: 0, w: 0, c: {} });
    let simTot = lsGet(key, null); if (!simTot || simTot.sig !== deckSig(d)) simTot = fresh();
    let realTot = null;
    const render = () => {
      const tot = st.src === "real" ? (realTot = realTot || addGames({ g: 0, w: 0, c: {} }, replayGames(d))) : simTot;
      const bar = h("i", { style: "width:0%" }); const line = h("span", { class: "tiny muted" });
      const stopBtn = h("button", { class: "btn sm", hidden: true, onclick: () => { stopped = true; } }, "หยุด");
      const prog = h("div", { class: "row", hidden: true }, h("div", { class: "trk dvtrk grow", role: "progressbar", "aria-label": "ความคืบหน้า" }, bar), line, stopBtn);
      const runBtn = h("button", { class: "btn gold", disabled: !validateDeck(d).ok, onclick: async () => {
        const opps = oppsOf(st.opp); if (!opps.length) return toast("เลือกเด็คคู่แข่งก่อน"); lsSet("bot.dvcs", { src: st.src, opp: st.opp, n: st.n });
        runBtn.disabled = true; stopped = false; stopBtn.hidden = false; prog.hidden = false; const seed0 = (Date.now() ^ 0x2545f491) | 0;
        const games = await runGames(st.n, (i) => simTracked(d, opps[i % opps.length], (seed0 + i * 7919) | 0), (k, n) => { bar.style.width = Math.round((k / n) * 100) + "%"; line.textContent = `${k}/${n} เกม`; }, () => stopped || !api.body.isConnected);
        addGames(simTot, games); lsSet(key, simTot); render();
      } }, "จำลองเพิ่ม");
      const tabs = h("div", { class: "row", role: "tablist" }, [["sim", `จำลอง (${simTot.g} เกม)`], ["real", "เกมจริงของคุณ"]].map(([v, t]) => h("button", { class: "btn sm" + (st.src === v ? " gold" : ""), role: "tab", "aria-selected": st.src === v ? "true" : "false", onclick: () => { st.src = v; render(); } }, t)));
      api.set([tabs,
        st.src === "sim" ? h("div", { class: "row" }, h("span", { class: "small" }, "ชน"), oppSelect(st, "opp"), h("select", { "aria-label": "จำนวนเกม", onchange: (e) => { st.n = +e.target.value; } }, [100, 200, 500, 1000].map((n) => h("option", { value: n, selected: n === st.n }, `+${n} เกม`))), runBtn,
          simTot.g ? h("button", { class: "btn sm", onclick: () => { simTot = fresh(); lsSet(key, simTot); render(); } }, "ล้างผลจำลอง") : null) : h("div", { class: "tiny muted" }, "จากรีเพลย์เกมที่เก็บไว้ในเครื่องนี้ (สูงสุด 30 เกมล่าสุด) ที่ใช้เด็คนี้ ไม่นับเกมกับหุ่นซ้อม"),
        prog,
        tot.g ? h("div", { class: "small" }, `${tot.g} เกม · ชนะรวม ${pc(tot.w / tot.g)} · ช่องที่ตัวอย่างน้อยกว่า ${MIN_N} เกมเป็นสีจาง ใช้ดูแนวโน้มเท่านั้น สีเขียว/แดง = ชนะมากกว่า/น้อยกว่าอัตรารวมเกิน 4 จุด`) : h("div", { class: "small muted" }, st.src === "sim" ? "ยังไม่มีผล กด จำลองเพิ่ม เพื่อเริ่ม" : "ยังไม่มีรีเพลย์ของเด็คนี้ในเครื่องนี้"),
        tot.g ? statTable(d, tot) : null,
        h("div", { class: "tiny muted" }, "อ่านค่า: อยู่บนมือ = ชนะกี่ % ในเกมที่การ์ดเคยอยู่บนมือ · มือเปิด = อยู่ในมือเปิดหลังเปลี่ยนมือ · จั่วทีหลัง = ไม่อยู่ในมือเปิดแต่จั่วได้ · ได้ลง = ได้ลงสนามหรือใช้ · ลงรอบที่ = ลงครั้งแรกเฉลี่ยรอบที่ (รอบละหนึ่งเทิร์นของเรา) ผลจำลองใช้บอทปกติทั้งสองฝั่ง และเก็บไว้ในเครื่องนี้ ถ้าการ์ดในเด็คเปลี่ยน ผลเก่าจะเริ่มใหม่")]);
    };
    render(); return [...api.body.childNodes];
  }, { title: "สถิติรายใบ: " + d.name, wide: true });
}
