// Puzzle miner (a tool, not part of the site): play bot-vs-bot games between Starter Decks, and at the start of
// each main phase where the other side is nearly out of LIFE, search for a way to win this turn. The other side's hand
// is emptied first (no React cards), and every defence it has left is tried, so a found line wins against any reply.
const V = new URL(import.meta.url).searchParams.get("v");
const { E, legalMoves } = await import(new URL(`../../js/engine.js?v=${V}`, import.meta.url).href);
const { H } = await import(new URL(`../../js/ai.js?v=${V}`, import.meta.url).href);
const { deckToList } = await import(new URL(`../../js/cards.js?v=${V}`, import.meta.url).href);
const { allDecks } = await import(new URL(`../../js/views/decks.js?v=${V}`, import.meta.url).href);

const { solveTurn, firstMoves } = await import(new URL(`../../js/puzzles.js?v=${V}`, import.meta.url).href);
const clone = (s) => { const t = JSON.parse(JSON.stringify({ ...s, cards: null, log: [], ev: [] })); t.cards = s.cards; return t; };
// the bot's own play of this turn: does a plain greedy turn already win?
function botWins(t, p) {
  for (let n = 0; n < 200 && t.phase !== "over" && t.active === p; n++) {
    if (t.rw) { E.apply(t, { type: "pass" }, 1 - t.rw.by); continue; }
    if (t.trig.length) { const tr = t.trig[0]; E.apply(t, H.trig(t, tr), tr.seat); continue; }
    if (t.pend) { const d = 1 - t.pend.by; const m = H.pick(t, d); E.apply(t, m ? m.a : { type: "respond" }, d); continue; }
    if (t.phase === "end" && t.need) { E.apply(t, { type: "discard", iids: H.discard(t, p) }, p); continue; }
    const m = H.pick(t, p); E.apply(t, m ? m.a : { type: "end" }, p);
  }
  return t.phase === "over" && t.winner === p;
}
export async function mine(games, seed0) {
  const decks = allDecks().filter((d) => d.starter && !/^ciel-/.test(d.id || ""));
  const found = []; let tried = 0, checked = 0;
  for (let g = 0; g < games; g++) {
    const seed = seed0 + g * 7919; const dA = decks[seed % decks.length], dB = decks[(seed >> 3) % decks.length];
    const s = E.newGame({ players: [{ name: "A", bot: true }, { name: "B", bot: true }], decks: [{ ...deckToList(dA), name: dA.name, id: dA.id }, { ...deckToList(dB), name: dB.name, id: dB.id }], seed, first: seed & 1, mode: "sim" });
    for (const p of [0, 1]) E.apply(s, { type: "mull", iids: H.mulligan(s, p) }, p);
    let lastTurn = -1;
    for (let step = 0; step < 4000 && s.phase !== "over"; step++) {
      try {
        if (s.rw) { const q = 1 - s.rw.by; E.apply(s, H.react(s, q) || { type: "pass" }, q); continue; }
        if (s.trig.length) { const t = s.trig[0]; E.apply(s, H.trig(s, t), t.seat); continue; }
        if (s.pend) { const p = 1 - s.pend.by; const r = H.react(s, p); if (r) { E.apply(s, r, p); continue; } const m = H.pick(s, p); E.apply(s, m ? m.a : { type: "respond" }, p); continue; }
        const p = s.active;
        if (s.phase === "main" && s.turn !== lastTurn) {
          lastTurn = s.turn; const O = s.P[1 - p]; const down = O.life.filter((x) => !x.up).length;
          if (down <= 2 && s.turn >= 3) {
            tried++;
            const t = clone(s); t.P[1 - p].hand = []; t.log = [];
            let line = null, nodes = 0;
            try { const r = solveTurn(t, p, 7, 20000); line = r.line; nodes = r.nodes; } catch (e) { line = null; nodes = -1; }
            checked++;
            if (line && line.length >= 2) {
              const easy = botWins(clone(t), p), fm = firstMoves(t, p, 7, 20000);
              found.push({ seed, turn: s.turn, p, down, len: line.length, easy, good: fm.good, all: fm.all, nodes, decks: [s.P[0].deckName, s.P[1].deckName], line: line.map((x) => x.d), acts: line.map((x) => x.a), state: JSON.stringify({ ...t, cards: Object.fromEntries(Object.entries(t.cards).filter(([k]) => k.startsWith("tok:"))), log: [], ev: [] }) });
            }
          }
        }
        if (s.phase === "end" && s.need) { E.apply(s, { type: "discard", iids: H.discard(s, p) }, p); continue; }
        const m = H.pick(s, p); E.apply(s, m ? m.a : { type: "end" }, p);
      } catch (e) { const p = s.active; try { E.apply(s, { type: "end" }, p); } catch { E.lose(s, p, "ติดสถานะ"); } }
      if (s.turn > 60) break;
    }
  }
  return { tried, checked, found };
}
