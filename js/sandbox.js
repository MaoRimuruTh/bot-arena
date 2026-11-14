// สนามซ้อม (sandbox): set the table up freely, then play it out under the normal rules. Both sides are yours (the two-sided
// mode), every hand can be looked at, any card from a Deck, a zone or the card library goes into any zone, LIFE turns up or
// down, and every change can be taken back. Also: a training-dummy run (ซ้อมมือเดียว) played N times by the quick bot, to
// see how fast a Deck wins. Nothing here is saved to the match history and nothing here counts for unlocks.
import { h, openSheet, toast } from "./util.js?v=20261114222637";
import { CARDS, card, artImg, isBase, TYPE_TH } from "./cards.js?v=20261114222637";
import { E } from "./engine.js?v=20261114222637";
import { simGame } from "./views/lab.js?v=20261114222637";

// where a card can go, in the words of the table
export const SB_ZONES = [["hand", "มือ"], ["top", "บนสุดของ Deck"], ["bottom", "ใต้สุดของ Deck"], ["av", "Avatar Zone"], ["mg", "Magic Zone"], ["cs", "Construct Zone"], ["hell", "นรก"], ["lifeDown", "LIFE (คว่ำ)"], ["lifeUp", "LIFE (หงาย)"], ["dark", "มิติมืด"]];
const SRC = [["hand", "มือ"], ["deck", "Deck"], ["av", "Avatar"], ["mg", "Magic"], ["cs", "Construct"], ["hell", "นรก"], ["life", "LIFE"], ["dark", "มิติมืด"]];
const clean = (x) => { const y = { i: x.i, c: x.c, o: x.o, a: true }; return y; }; // a card leaving its zone keeps nothing it had there
// take a card out of wherever it is on seat p's side
function takeOut(s, p, i) { const P = s.P[p]; for (const z of ["hand", "deck", "av", "mg", "cs", "hell", "dark", "life"]) { const k = P[z].findIndex((x) => x.i === i); if (k >= 0) { const [x] = P[z].splice(k, 1); // an equipped Magic falls off with its Avatar
      if (z === "av") for (const m of P.mg.filter((y) => y.on === x.i)) { P.mg.splice(P.mg.indexOf(m), 1); P.hell.push(clean(m)); }
      return x; } } return null; }
// put card x into zone `to` on seat p's side (the zone limits of the rules still apply: 5 Avatars, 5 Magics, 2 Constructs)
export function putInto(s, p, x, to) {
  const P = s.P[p], y = clean(x); y.o = x.o != null ? x.o : p;
  if (to === "av" && P.av.length >= 5) throw new Error("Avatar Zone เต็มแล้ว (5 ใบ)");
  if (to === "mg" && P.mg.length >= 5) throw new Error("Magic Zone เต็มแล้ว (5 ใบ)");
  if (to === "cs" && P.cs.length >= 2) throw new Error("Construct Zone เต็มแล้ว (2 ใบ)");
  if (to === "top") P.deck.unshift(y); else if (to === "bottom") P.deck.push(y);
  else if (to === "lifeDown" || to === "lifeUp") P.life.push({ ...y, up: to === "lifeUp" });
  else P[to].push(y);
}
// move a card that is already on the table / in a pile / in a hand
export function moveCard(s, p, i, to) { const x = takeOut(s, p, i); if (!x) throw new Error("ไม่พบการ์ดใบนี้แล้ว"); try { putInto(s, p, x, to); } catch (e) { putInto(s, p, x, "hand"); throw e; } }
// a new copy of a library card for seat p
export function addCard(s, p, id, to) { s.cards[id] = s.cards[id] || E.cardDef(id); putInto(s, p, { i: s.nextI++, c: String(id), o: p, a: true }, to); }
const shown = (s, x) => { const d = s.cards[x.c] || {}; return { d, c: d.im != null ? card(d.im) : null }; };

// the sheet: ctx = { s(), names: [n0, n1], edit(fn, what) → applies fn(s) after taking a snapshot and redraws }
export function openSandbox(ctx) {
  const st = { p: 0, src: "hand", to: "av", q: "" };
  const sheet = openSheet((api) => body(api), { title: "จัดสนามซ้อม", sub: "เปลี่ยนอะไรก็ได้ แล้วเล่นต่อตามกติกาจริง กด ↶ ย้อน เพื่อเอาคืนทีละขั้น", wide: true });
  const redraw = () => sheet.set(body(sheet));
  const run = (fn, what) => { try { ctx.edit(fn, what); toast(what); } catch (e) { toast(e.message || "ทำไม่ได้", "bad"); } redraw(); };
  function body() {
    const s = ctx.s(); if (!s) return [h("div", { class: "muted" }, "ไม่มีเกม")]; const P = s.P[st.p];
    const seg = (items, key) => h("div", { class: "seg sbseg", role: "group" }, items.map(([k, t]) => h("button", { "aria-pressed": String(st[key] === k), onclick: () => { st[key] = k; redraw(); } }, t)));
    const toSel = (val, on) => h("select", { class: "sbsel", "aria-label": "ย้ายไป", onchange: (e) => on(e.target.value) }, h("option", { value: "" }, "ย้ายไป…"), SB_ZONES.map(([k, t]) => h("option", { value: k, selected: val === k ? "" : null }, t)));
    const list = P[st.src] || [];
    const rows = list.map((x) => { const { d, c } = shown(s, x);
      return h("div", { class: "sbrow" }, c ? artImg(c, "sbimg", d.n) : h("span", { class: "sbimg" }), h("div", { class: "grow", style: "min-width:0" }, h("b", { class: "sbname" }, d.n || "?"), h("div", { class: "tiny muted" }, [TYPE_TH[d.t] || "", d.pw != null && d.t === "A" ? "POWER " + E.power(s, x) : "", st.src === "life" ? (x.up ? "หงาย" : "คว่ำ") : "", st.src === "av" ? (x.a ? "ตื่น" : "นอน") : ""].filter(Boolean).join(" · "))),
        toSel("", (to) => to && run((t) => moveCard(t, st.p, x.i, to), `ย้าย ${d.n} ไป${(SB_ZONES.find((z) => z[0] === to) || [])[1]}`))); });
    const hits = st.q.trim().length >= 1 ? CARDS.filter((c) => c && isBase(c) && c.t !== "T" && (c.n.includes(st.q.trim()) || c.p.toLowerCase().includes(st.q.trim().toLowerCase()))).slice(0, 18) : [];
    const lifeUp = P.life.filter((x) => x.up).length;
    return [
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap;align-items:center" }, h("span", { class: "small muted" }, "ฝั่ง"), seg([[0, ctx.names[0]], [1, ctx.names[1]]], "p"),
        ctx.undo ? h("button", { class: "btn sm", disabled: !ctx.canUndo(), onclick: () => { ctx.undo(); redraw(); } }, "↶ ย้อน") : null),
      // LIFE and the turn, the quick knobs
      h("div", { class: "sbbox" }, h("div", { class: "row", style: "gap:6px;flex-wrap:wrap;align-items:center" }, h("b", null, `LIFE ${P.life.length} ใบ · หงาย ${lifeUp}`),
        h("button", { class: "btn sm", disabled: lifeUp >= P.life.length, onclick: () => run((t) => { const y = t.P[st.p].life.find((z) => !z.up); if (y) y.up = true; }, "หงาย LIFE 1 ใบ") }, "หงาย 1"),
        h("button", { class: "btn sm", disabled: !lifeUp, onclick: () => run((t) => { const y = [...t.P[st.p].life].reverse().find((z) => z.up); if (y) y.up = false; }, "คว่ำ LIFE คืน 1 ใบ") }, "คว่ำคืน 1"),
        h("button", { class: "btn sm", disabled: !P.deck.length, onclick: () => run((t) => { const Q = t.P[st.p]; const y = Q.deck.shift(); if (y) Q.life.push({ ...clean(y), up: false }); }, "เพิ่ม LIFE จาก Deck 1 ใบ") }, "+1 จาก Deck"),
        h("button", { class: "btn sm", disabled: !P.life.length, onclick: () => run((t) => { const Q = t.P[st.p]; const y = Q.life.pop(); if (y) Q.hell.push(clean(y)); }, "ส่ง LIFE ใบสุดท้ายลงนรก") }, "−1 ลงนรก"),
        h("button", { class: "btn sm", onclick: () => run((t) => { for (const x of t.P[st.p].av) { x.a = true; delete x.nw; } }, "ปลุก Avatar ทุกใบ") }, "ปลุก Avatar ทุกใบ"),
        h("button", { class: "btn sm", onclick: () => run((t) => { const Q = t.P[st.p]; for (let k = Q.deck.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [Q.deck[k], Q.deck[j]] = [Q.deck[j], Q.deck[k]]; } }, "สับ Deck แล้ว") }, "สับ Deck")),
        h("div", { class: "tiny muted" }, "GEM ของ BoT จ่ายด้วยการ์ดบนมือ ถ้าอยากมี GEM มากขึ้น ให้ย้ายการ์ดเข้ามือหรือเพิ่มจากคลังการ์ด")),
      // the cards this side already has, wherever they are (both hands can be looked at here)
      h("div", { class: "sbbox" }, h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, seg(SRC.map(([k, t]) => [k, `${t} ${(P[k] || []).length}`]), "src")),
        st.src === "deck" ? h("div", { class: "tiny muted" }, "เรียงจากบนสุดลงไป") : null,
        h("div", { class: "sblist" }, rows.length ? rows : [h("div", { class: "muted small" }, "ว่าง")])),
      // any card from the library
      h("div", { class: "sbbox" }, h("b", null, "เพิ่มการ์ดจากคลังการ์ด"),
        h("div", { class: "row", style: "gap:6px;flex-wrap:wrap;align-items:center" }, h("input", { class: "input", type: "search", placeholder: "ชื่อการ์ด หรือรหัส เช่น BT01-001", value: st.q, style: "flex:1;min-width:0",
          oninput: (e) => { st.q = e.target.value; clearTimeout(st.t); st.t = setTimeout(() => { const f = document.activeElement; redraw(); const i = sheet.body.querySelector("input[type=search]"); if (i && f && f.type === "search") { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } }),
          h("span", { class: "small muted" }, "ลงที่"), h("select", { class: "sbsel", onchange: (e) => { st.to = e.target.value; } }, SB_ZONES.map(([k, t]) => h("option", { value: k, selected: st.to === k ? "" : null }, t)))),
        hits.length ? h("div", { class: "sbgrid" }, hits.map((c) => h("button", { class: "sbpick", title: `${c.p} ${c.n}`, onclick: () => run((t) => addCard(t, st.p, c.i, st.to), `เพิ่ม ${c.n} ลง${(SB_ZONES.find((z) => z[0] === st.to) || [])[1]}`) }, artImg(c, "sbimg", c.n), h("span", { class: "tiny" }, c.n))))
          : h("div", { class: "tiny muted" }, st.q ? "ไม่พบการ์ด" : "พิมพ์ชื่อการ์ดเพื่อค้นหา")),
    ];
  }
  return sheet;
}

// a Deck against the training dummy, played by the quick bot N times: how many of its own turns it needs to win
export function openFishRuns(deck) {
  if (!deck) return toast("เลือกเด็คก่อน");
  const st = { n: 100, res: [], run: false, stop: false };
  const sheet = openSheet(() => body(), { title: "ให้บอทซ้อมมือเดียว", sub: deck.name + " เจอหุ่นซ้อมที่ไม่เล่นการ์ด บอทระดับปกติเล่นแทนเรา เล่นก่อนทุกเกม" });
  const redraw = () => sheet.set(body());
  async function go() {
    st.res = []; st.run = true; st.stop = false; redraw(); const seed0 = (Date.now() & 0x7fffffff) | 0, dummy = { ...deck, name: "หุ่นซ้อม" };
    for (let k = 0; k < st.n && !st.stop && sheet.body.isConnected; k++) {
      try { const r = simGame(deck, dummy, (seed0 + k * 7919) | 0, true, false); st.res.push(r); } catch (e) { st.res.push({ winner: null, turns: 0, reason: "error" }); }
      if (k % 5 === 4 || k === st.n - 1) { redraw(); await new Promise((r) => setTimeout(r, 0)); } // the page stays responsive between batches
    }
    st.run = false; if (sheet.body.isConnected) redraw();
  }
  function body() {
    const R = st.res, wins = R.filter((r) => r.winner === 0), own = wins.map((r) => Math.ceil(r.turns / 2)).sort((a, b) => a - b);
    const avg = own.length ? own.reduce((a, b) => a + b, 0) / own.length : 0, med = own.length ? own[Math.floor((own.length - 1) / 2)] : 0;
    const top = Math.max(1, ...own.map((t) => Math.min(t, 12))), byT = {}; for (const t of own) { const k = Math.min(t, 12); byT[k] = (byT[k] || 0) + 1; }
    const maxN = Math.max(1, ...Object.values(byT)); let cum = 0;
    return [
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap;align-items:center" }, h("span", { class: "small muted" }, "จำนวนเกม"),
        h("div", { class: "seg", role: "group" }, [20, 50, 100, 200].map((n) => h("button", { "aria-pressed": String(st.n === n), disabled: st.run, onclick: () => { st.n = n; redraw(); } }, String(n)))),
        st.run ? h("button", { class: "btn sm", onclick: () => { st.stop = true; } }, "หยุด") : h("button", { class: "btn gold sm", onclick: go }, R.length ? "เล่นใหม่" : "เริ่ม")),
      R.length ? h("div", { class: "sbprog", role: "progressbar", "aria-valuenow": String(R.length), "aria-valuemax": String(st.n) }, h("i", { style: `width:${(100 * R.length) / st.n}%` })) : null,
      R.length ? h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ชนะ"), h("b", null, `${wins.length}/${R.length}`)),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เฉลี่ยตาของเรา"), h("b", null, own.length ? avg.toFixed(1) : "–")),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "มัธยฐาน"), h("b", null, own.length ? String(med) : "–")),
        h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "เร็วสุด"), h("b", null, own.length ? String(own[0]) : "–"))) : null,
      own.length ? h("div", { class: "sbbars" }, Array.from({ length: top }, (_, j) => j + 1).map((t) => { cum += byT[t] || 0; return h("div", { class: "sbbar" }, h("span", { class: "tiny" }, t === 12 ? "12+" : String(t)),
        h("i", { style: `width:${(100 * (byT[t] || 0)) / maxN}%` }), h("span", { class: "tiny muted" }, `${byT[t] || 0} · สะสม ${Math.round((100 * cum) / R.length)}%`)); })) : null,
      h("div", { class: "tiny muted" }, "ตาของเรา = เทิร์นที่เราเล่น (เราเริ่มก่อน ตาที่ 3 คือเทิร์นที่ 5 ของเกม) ผลนี้ไม่บันทึกในประวัติ และไม่นับรางวัล"),
    ];
  }
  return sheet;
}
