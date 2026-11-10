import { h, busy, lsGet, lsSet } from "../util.js?v=20261110160417";
import { card, deckEntries, deckToList, validateDeck, TYPE_TH } from "../cards.js?v=20261110160417";
import { E } from "../engine.js?v=20261110160417";
import { H } from "../ai.js?v=20261110160417";
import { Views, cardBtn, showCard } from "../ui.js?v=20261110160417";
import { allDecks } from "./decks.js?v=20261110160417";

// exact hypergeometric: P(at least one of k copies within m cards from a deck of N)
function atLeastOne(N, k, m) { if (k <= 0) return 0; if (m >= N) return 1; let p = 1; for (let i = 0; i < m; i++) p *= (N - k - i) / (N - i); return 1 - Math.max(0, p); }
export function openingOdds(d, ids) {
  const set = new Set(ids.map(Number)); const N = Math.max(1, Object.values(d.main || {}).reduce((a, b) => a + b, 0));
  const k = deckEntries(d).filter((e) => set.has(e.id) || ids.some((i) => card(i) && card(i).n === e.c.n)).reduce((a, e) => a + e.n, 0);
  // going first: 5 in hand, then one draw per turn (turn 1 included)
  return { k, open: atLeastOne(N, k, 5), t1: atLeastOne(N, k, 6), t3: atLeastOne(N, k, 8), t5: atLeastOne(N, k, 10) };
}

// fast bot-vs-bot simulation with the heuristic bot (card effects are skipped)
export function simGame(dA, dB, seed) {
  const decks = [{ ...deckToList(dA), name: dA.name, id: dA.id }, { ...deckToList(dB), name: dB.name, id: dB.id }];
  const s = E.newGame({ players: [{ name: "A", bot: true }, { name: "B", bot: true }], decks, seed, first: seed & 1, mode: "sim" });
  for (const p of [0, 1]) E.apply(s, { type: "mull", iids: H.mulligan(s, p) }, p);
  for (let step = 0; step < 4000 && s.phase !== "over"; step++) {
    try {
      if (s.trig.length) { const t = s.trig[0]; E.apply(s, H.trig(s, t), t.seat); continue; }
      if (s.pend) { const p = 1 - s.pend.by; const m = H.pick(s, p); E.apply(s, m ? m.a : { type: "respond" }, p); continue; }
      const p = s.active;
      if (s.phase === "end" && s.need) { E.apply(s, { type: "discard", iids: H.discard(s, p) }, p); continue; }
      const m = H.pick(s, p); E.apply(s, m ? m.a : { type: "end" }, p);
    } catch (e) { const p = s.active; try { E.apply(s, { type: "end" }, p); } catch { E.lose(s, p, "ติดสถานะ"); } }
    if (s.turn > 80) { s.phase = "over"; s.winner = null; s.reason = "ยาวเกิน 80 เทิร์น"; }
  }
  return { winner: s.winner, turns: s.turn, reason: s.reason, first: s.first };
}

const LabState = lsGet("bot.lab", { a: "", b: "", n: 100 });
Views.lab = {
  render(root) {
    const decks = allDecks().filter((d) => validateDeck(d).ok);
    if (!decks.length) { root.replaceChildren(h("div", { class: "pagehead" }, h("h1", null, "ห้องทดลอง")), h("div", { class: "empty" }, "ต้องมีเด็คที่ถูกกติกาอย่างน้อย 1 เด็ค")); return; }
    if (!decks.some((d) => d.id === LabState.a)) LabState.a = decks[0].id;
    if (!decks.some((d) => d.id === LabState.b)) LabState.b = (decks[1] || decks[0]).id;
    const sel = (key) => h("select", { "aria-label": key === "a" ? "เด็คที่ทดสอบ" : "เด็คคู่แข่ง", onchange: (e) => { LabState[key] = e.target.value; lsSet("bot.lab", LabState); draw(); } }, decks.map((d) => h("option", { value: d.id, selected: d.id === LabState[key] }, d.name + (d.starter ? " (ทางการ)" : ""))));
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
    simBox.append(h("div", { class: "eyebrow" }, "จำลองบอทชนบอท"), h("div", { class: "small muted" }, "ใช้บอทฟรี เล่นตามกติกา Rule Book และอ่านเอฟเฟกต์การ์ดที่พบบ่อยได้เอง (การ์ดที่ซับซ้อนจะถูกข้าม) ใช้ดูเส้น Cost และพลังของเด็คแบบคร่าวๆ"),
      h("div", { class: "row" }, h("span", { class: "small" }, "ชน"), sel("b"), h("select", { "aria-label": "จำนวนเกม", onchange: (e) => { LabState.n = +e.target.value; lsSet("bot.lab", LabState); } }, [50, 100, 300].map((n) => h("option", { value: n, selected: n === LabState.n }, n + " เกม"))),
        h("button", { class: "btn gold", onclick: async (e) => {
          const btn = e.currentTarget; btn.disabled = true; const out = simBox.querySelector(".simout");
          const A = decks.find((x) => x.id === LabState.a), B = decks.find((x) => x.id === LabState.b); const n = LabState.n; const res = [];
          for (let k = 0; k < n; k++) { res.push(simGame(A, B, (Date.now() + k * 7919) | 0)); if (k % 10 === 9) { out.replaceChildren(busy(`จำลองแล้ว ${k + 1}/${n}`)); await new Promise((r) => setTimeout(r, 0)); } }
          const w = res.filter((r) => r.winner === 0).length, l = res.filter((r) => r.winner === 1).length, dr = n - w - l;
          const wf = res.filter((r) => r.first === 0), wfw = wf.filter((r) => r.winner === 0).length;
          const avgT = res.reduce((a, r) => a + r.turns, 0) / n; const reasons = {}; res.forEach((r) => { const k = (r.reason || "").replace(/^.*?(Deck หมด|สาหัส|ยาวเกิน|ติดสถานะ).*$/, "$1"); reasons[k] = (reasons[k] || 0) + 1; });
          out.replaceChildren(h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ชนะ"), h("b", { style: "color:#8ee3b2" }, Math.round((w / n) * 100) + "%")), h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "แพ้"), h("b", { style: "color:#ffb0b2" }, Math.round((l / n) * 100) + "%")),
            h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เฉลี่ย"), h("b", null, avgT.toFixed(1) + " เทิร์น"))),
            h("div", { class: "small muted" }, `เล่นก่อนชนะ ${wf.length ? Math.round((wfw / wf.length) * 100) : 0}% · เล่นหลังชนะ ${n - wf.length ? Math.round(((w - wfw) / (n - wf.length)) * 100) : 0}%${dr ? ` · ไม่จบ ${dr} เกม` : ""}`),
            h("div", { class: "small muted" }, "วิธีจบเกม: " + Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(" · ")));
          btn.disabled = false;
        } }, "เริ่มจำลอง")), h("div", { class: "simout" }));
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", null, h("h1", null, "ห้องทดลอง"), h("div", { class: "muted small" }, "ลองมือเปิด ดูโอกาสจั่ว และจำลองเกมก่อนลงสนามจริง")), h("div", { class: "row" }, h("span", { class: "small muted" }, "เด็ค"), sel("a"))),
      h("div", { class: "setup" }, h("div", { class: "stack" }, handBox, oddsBox), simBox));
    draw();
  },
};
