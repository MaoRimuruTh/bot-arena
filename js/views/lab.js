import { h, busy, lsGet, lsSet } from "../util.js?v=20261113014047";
import { card, deckEntries, deckToList, validateDeck, TYPE_TH } from "../cards.js?v=20261113014047";
import { E } from "../engine.js?v=20261113014047";
import { H } from "../ai.js?v=20261113014047";
import { Views, cardBtn, showCard } from "../ui.js?v=20261113014047";
import { allDecks } from "./decks.js?v=20261113014047";
import { deckLocked } from "../achieve.js?v=20261113014047";

// exact hypergeometric: P(at least one of k copies within m cards from a deck of N)
function atLeastOne(N, k, m) { if (k <= 0) return 0; if (m >= N) return 1; let p = 1; for (let i = 0; i < m; i++) p *= (N - k - i) / (N - i); return 1 - Math.max(0, p); }
export function openingOdds(d, ids) {
  const set = new Set(ids.map(Number)); const N = Math.max(1, Object.values(d.main || {}).reduce((a, b) => a + b, 0));
  const k = deckEntries(d).filter((e) => set.has(e.id) || ids.some((i) => card(i) && card(i).n === e.c.n)).reduce((a, e) => a + e.n, 0);
  // going first: 5 in hand, then one draw per turn (turn 1 included)
  return { k, open: atLeastOne(N, k, 5), t1: atLeastOne(N, k, 6), t3: atLeastOne(N, k, 8), t5: atLeastOne(N, k, 10) };
}

// a bot-vs-bot game (deck A is seat 0) with every card effect working; also notes which of A's cards got played
// dummy: side B is a training dummy (หุ่นซ้อม) that keeps its hand, never plays a card and never answers, and A always starts,
// so the games show how fast deck A can win on its own
// pro: both sides choose like บอทมือโปร in their Main and Battle Phase, with one play-out per option instead of two (won
// 57% of 200 games against the normal bot; a game takes about 340 ms instead of 37 ms on a computer)
export function simGame(dA, dB, seed, dummy, pro) {
  const decks = [{ ...deckToList(dA), name: dA.name, id: dA.id }, { ...deckToList(dB), name: dB.name, id: dB.id }];
  const s = E.newGame({ players: [{ name: "A", bot: true }, { name: "B", bot: true }], decks, seed, first: dummy ? 0 : seed & 1, mode: "sim" });
  const played = new Set(); let seen = s.evc || 0;
  const act = (a, p) => {
    E.apply(s, a, p);
    for (const e of s.ev || []) if (e.id > seen) { seen = e.id; if ((e.k === "summon" || e.k === "cast") && e.p === 0) { const L = E.locate(s, e.i); if (L) played.add(E.def(s, L.x).n); } }
    for (const x of s.P[0].cs) played.add(E.def(s, x).n); // Constructs are built without an event
  };
  for (const p of [0, 1]) act({ type: "mull", iids: dummy && p === 1 ? [] : H.mulligan(s, p) }, p);
  for (let step = 0; step < 4000 && s.phase !== "over"; step++) {
    try {
      if (s.rw) { const q = 1 - s.rw.by; act((dummy && q === 1 ? null : H.react(s, q)) || { type: "pass" }, q); continue; }
      if (s.trig.length) { const t = s.trig[0]; act(H.trig(s, t), t.seat); continue; }
      if (s.pend) { const p = 1 - s.pend.by; if (dummy && p === 1) { act({ type: "respond" }, p); continue; } const r = H.react(s, p); if (r) { act(r, p); continue; } const m = H.pick(s, p); act(m ? m.a : { type: "respond" }, p); continue; }
      const p = s.active;
      if (s.phase === "end" && s.need) { act({ type: "discard", iids: H.discard(s, p) }, p); continue; }
      const m = dummy && p === 1 ? null : pro && ["main", "battle"].includes(s.phase) ? H.mcPick(s, p, 1) : H.pick(s, p); act(m ? m.a : { type: "end" }, p);
    } catch (e) { const p = s.active; try { act({ type: "end" }, p); } catch { E.lose(s, p, "ติดสถานะ"); } }
    if (s.turn > 80) { s.phase = "over"; s.winner = null; s.reason = "ยาวเกิน 80 เทิร์น"; }
  }
  return { winner: s.winner, turns: s.turn, reason: s.reason, first: s.first, played: [...played] };
}
const pct = (x) => Math.round(x * 100) + "%";
// how A's cards relate to winning: how often each got played, and the win rate in those games against the overall one
function cardStats(A, res) {
  const W = res.filter((r) => r.winner === 0).length / res.length; const ents = deckEntries(A);
  return [...new Set(ents.map((e) => e.c.n))].map((nm) => {
    const g = res.filter((r) => r.played.includes(nm)), w = g.filter((r) => r.winner === 0).length;
    return { nm, id: ents.find((e) => e.c.n === nm).id, play: g.length / res.length, win: g.length ? w / g.length : null, d: g.length >= 5 ? w / g.length - W : null };
  }).sort((a, b) => (b.d ?? -9) - (a.d ?? -9) || b.play - a.play);
}

const LabState = lsGet("bot.lab", { a: "", b: "", n: 100, pro: false });
// the results: overall record, how the games ended and how long they ran, each opponent, and which cards went with winning
function showSim(out, A, opps, res) {
  const n = res.length, w = res.filter((r) => r.winner === 0).length, l = res.filter((r) => r.winner === 1).length, dr = n - w - l;
  const wf = res.filter((r) => r.first === 0), wfw = wf.filter((r) => r.winner === 0).length;
  const avgT = res.reduce((a, r) => a + r.turns, 0) / n; const reasons = {}; res.forEach((r) => { const k = (r.reason || "").replace(/^.*?(Deck หมด|สาหัส|ยาวเกิน|ติดสถานะ).*$/, "$1"); reasons[k] = (reasons[k] || 0) + 1; });
  const buckets = [["8 เทิร์นหรือน้อยกว่า", 0, 8], ["9–12", 9, 12], ["13–16", 13, 16], ["17–20", 17, 20], ["21 ขึ้นไป", 21, 999]].map(([t, a, b]) => [t, res.filter((r) => r.turns >= a && r.turns <= b).length]);
  const rows = cardStats(A, res);
  out.replaceChildren(
    h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ชนะ"), h("b", { style: "color:#8ee3b2" }, pct(w / n))), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "แพ้"), h("b", { style: "color:#ffb0b2" }, pct(l / n))),
      h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เฉลี่ย"), h("b", null, avgT.toFixed(1) + " เทิร์น"))),
    h("div", { class: "small muted" }, `${n} เกม · เล่นก่อนชนะ ${wf.length ? pct(wfw / wf.length) : "-"} · เล่นหลังชนะ ${n - wf.length ? pct((w - wfw) / (n - wf.length)) : "-"}${dr ? ` · ไม่จบ ${dr} เกม` : ""}`),
    h("div", { class: "small muted" }, "วิธีจบเกม: " + Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(" · ")),
    opps.length > 1 ? h("div", { class: "stack", style: "gap:8px" }, h("div", { class: "eyebrow" }, "แยกตามคู่แข่ง"),
      h("div", { class: "bars" }, opps.map((B) => { const g = res.filter((r) => r.opp === B.name), gw = g.filter((r) => r.winner === 0).length; return h("div", { class: "bar" }, h("span", null, B.name), h("div", { class: "trk" }, h("i", { style: `width:${(gw / Math.max(1, g.length)) * 100}%` })), h("span", { class: "num small" }, pct(gw / Math.max(1, g.length)))); }))) : null,
    h("div", { class: "stack", style: "gap:8px" }, h("div", { class: "eyebrow" }, "เกมยาวกี่เทิร์น"),
      h("div", { class: "bars" }, buckets.map(([t, c]) => h("div", { class: "bar" }, h("span", null, t), h("div", { class: "trk" }, h("i", { style: `width:${(c / n) * 100}%` })), h("span", { class: "num small" }, String(c)))))),
    h("div", { class: "stack", style: "gap:8px" }, h("div", { class: "eyebrow" }, "การ์ดกับผลแพ้ชนะ"),
      h("div", { class: "small muted" }, "ได้ลงเล่นกี่เปอร์เซ็นต์ของเกม และชนะกี่เปอร์เซ็นต์ในเกมที่ได้ลง ตัวเลขในวงเล็บเทียบกับอัตราชนะรวม ใช้ดูแนวโน้มเท่านั้น เช่น การ์ด Cost สูงมักได้ลงในเกมที่ยืดเยื้อ"),
      h("div", { class: "cstats" }, h("div", { class: "cstat head tiny muted" }, h("span", null, "การ์ด"), h("span", null, "ได้ลง"), h("span", null, "ชนะเมื่อได้ลง")),
        rows.map((r) => h("div", { class: "cstat" }, h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); showCard(r.id); } }, r.nm), h("span", { class: "num small" }, pct(r.play)),
          h("span", { class: "num small" + (r.d == null ? " muted" : r.d > 0.05 ? " up" : r.d < -0.05 ? " down" : "") }, r.win == null ? "ไม่ได้ลง" : pct(r.win) + (r.d == null ? " (น้อยเกินไป)" : ` (${r.d >= 0 ? "+" : "−"}${Math.abs(Math.round(r.d * 100))})`)))))));
}
Views.lab = {
  render(root) {
    const decks = allDecks().filter((d) => validateDeck(d).ok && !deckLocked(d));
    if (!decks.length) { root.replaceChildren(h("div", { class: "pagehead" }, h("h1", null, "ห้องทดลอง")), h("div", { class: "empty" }, "ต้องมีเด็คที่ถูกกติกาอย่างน้อย 1 เด็ค")); return; }
    if (!decks.some((d) => d.id === LabState.a)) LabState.a = decks[0].id;
    if (LabState.b !== "*" && LabState.b !== "~" && !decks.some((d) => d.id === LabState.b)) LabState.b = (decks[1] || decks[0]).id;
    const sel = (key, extra = []) => h("select", { "aria-label": key === "a" ? "เด็คที่ทดสอบ" : "เด็คคู่แข่ง", onchange: (e) => { LabState[key] = e.target.value; lsSet("bot.lab", LabState); draw(); } },
      [...extra.map(([v, t]) => h("option", { value: v, selected: v === LabState[key] }, t)), ...decks.map((d) => h("option", { value: d.id, selected: d.id === LabState[key] }, d.name + (d.ciel ? " (ชิเอลจัด)" : d.starter ? " (ทางการ)" : "")))]);
    const oddsBox = h("div", { class: "panel stack" }); const handBox = h("div", { class: "panel stack" }); const simBox = h("div", { class: "panel stack" });
    const draw = () => {
      const d = decks.find((x) => x.id === LabState.a);
      const avs = deckEntries(d).filter((e) => e.c.t === "A").sort((a, b) => (b.c.pw || 0) - (a.c.pw || 0)).slice(0, 12);
      oddsBox.replaceChildren(h("div", { class: "eyebrow" }, "โอกาสได้การ์ด (เล่นก่อน ไม่นับเปลี่ยนมือ)"),
        h("div", { class: "bar tiny muted" }, h("span", null, "การ์ด"), h("span", null, "ภายในเทิร์น 3"), h("span", null, "มือเปิด")),
        h("div", { class: "bars" }, avs.map((e) => { const o = openingOdds(d, [e.id]); return h("div", { class: "bar" }, h("a", { href: "#", onclick: (ev) => { ev.preventDefault(); showCard(e.id); } }, `${e.n}× ${e.c.n}`), h("div", { class: "trk", title: Math.round(o.t3 * 100) + "%" }, h("i", { style: `width:${o.t3 * 100}%` })), h("span", { class: "num small" }, Math.round(o.open * 100) + "%")); })));
      const roll = () => {
        const list = deckToList(d).main.slice(); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
        const hand = list.slice(0, 5); const cheap = hand.filter((i) => card(i).t === "A" && (card(i).c || 0) <= 3).length; const gem = hand.reduce((a, i) => a + (card(i).g || 0), 0);
        handBox.replaceChildren(h("div", { class: "row" }, h("div", { class: "eyebrow grow" }, "สุ่มมือเปิด 5 ใบ"), h("button", { class: "btn sm", onclick: roll }, "สุ่มใหม่")),
          h("div", { class: "pick", style: "grid-template-columns:repeat(5,minmax(0,1fr))" }, hand.map((i) => cardBtn(i, { onclick: () => showCard(i) }))),
          h("div", { class: "row small" }, h("span", { class: "chip " + (cheap >= 2 ? "good" : "warn") }, `Avatar Cost ≤3: ${cheap}`), h("span", { class: "chip num" }, "GEM รวม " + gem), h("span", { class: "muted" }, cheap >= 2 ? "มือนี้เปิดเกมได้" : "บอทจะเปลี่ยนมือนี้")));
      };
      roll();
    };
    const official = decks.filter((d) => d.starter || d.ciel); // the official Starter Decks and Ciel's sample decks
    simBox.append(h("div", { class: "eyebrow" }, "จำลองบอทชนบอท"), h("div", { class: "small muted" }, "บอทเล่นตามกติกา Rule Book 3.2 และเอฟเฟกต์การ์ดทุกใบทำงานอัตโนมัติ ผลที่ได้ใช้ดูแนวโน้มของเด็ค บอทยังเล่นไม่เก่งเท่าคน · บอทมือโปรลองเล่นแต่ละทางเลือกต่อก่อนตัดสินใจ เล่นเก่งกว่าแต่ใช้เวลานานกว่าราว 9 เท่า"),
      h("div", { class: "row" }, h("span", { class: "small" }, "ชน"), sel("b", [...(official.length > 1 ? [["*", `ทุกเด็คตัวอย่าง (${official.length} เด็ค)`]] : []), ["~", "หุ่นซ้อม (ไม่เล่นอะไรเลย)"]]),
        h("select", { "aria-label": "จำนวนเกม", onchange: (e) => { LabState.n = +e.target.value; lsSet("bot.lab", LabState); } }, [50, 100, 300].map((n) => h("option", { value: n, selected: n === LabState.n }, n + " เกม"))),
        h("select", { "aria-label": "บอทที่เล่นทั้งสองฝั่ง", onchange: (e) => { LabState.pro = e.target.value === "pro"; lsSet("bot.lab", LabState); } }, [["basic", "บอทปกติ (เร็ว)"], ["pro", "บอทมือโปร (ช้ากว่า เล่นเก่งกว่า)"]].map(([v, t]) => h("option", { value: v, selected: (v === "pro") === !!LabState.pro }, t))),
        h("button", { class: "btn gold", onclick: async (e) => {
          const btn = e.currentTarget; btn.disabled = true; const out = simBox.querySelector(".simout");
          const dummy = LabState.b === "~", A = decks.find((x) => x.id === LabState.a), opps = dummy ? [{ ...A, name: "หุ่นซ้อม" }] : LabState.b === "*" ? official : [decks.find((x) => x.id === LabState.b)];
          const per = Math.max(10, Math.round(LabState.n / opps.length)), total = per * opps.length, res = [];
          for (const B of opps) for (let j = 0; j < per; j++) {
            const r = simGame(A, B, (Date.now() + res.length * 7919) | 0, dummy, !!LabState.pro); r.opp = B.name; res.push(r);
            if (res.length % 4 === 0) { out.replaceChildren(busy(`จำลองแล้ว ${res.length}/${total}`)); await new Promise((ok) => setTimeout(ok, 0)); }
          }
          showSim(out, A, opps, res); btn.disabled = false;
        } }, "เริ่มจำลอง")), h("div", { class: "simout" }));
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ห้องทดลอง"), h("div", { class: "muted small" }, "ลองมือเปิด ดูโอกาสจั่ว และจำลองเกมก่อนลงสนามจริง")), h("div", { class: "row" }, h("span", { class: "small muted" }, "เด็ค"), sel("a"))),
      h("div", { class: "setup" }, h("div", { class: "stack" }, handBox, oddsBox), simBox));
    draw();
  },
};
