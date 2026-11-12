// Puzzles: positions taken from bot games where the side to play can win this very turn. Each was found and checked
// by the search below (tools/puzzles), with the other side's hand emptied and every defence it has left tried.
// Only card numbers and where they lie are kept; names, text and art load live like everywhere else.
import { E, legalMoves } from "./engine.js?v=20261112144714";
import { H } from "./ai.js?v=20261112144714";

// copies for the search share the card details (they never change during play) and leave the log behind
const clone = (s) => { const t = JSON.parse(JSON.stringify({ ...s, cards: null, log: [], ev: [] })); t.cards = s.cards; return t; };
const whoActs = (s) => { if (s.phase === "over") return null; if (s.phase === "mull") return s.mull[0] ? (s.mull[1] ? null : 1) : 0; if (s.rw) return 1 - s.rw.by; if (s.trig.length) return s.trig[0].seat; if (s.pend) return 1 - s.pend.by; return s.active; };
// steps with no real choice: reaction windows pass (the defender has no hand), effects resolve the way the bot would
function settle(t) {
  for (let n = 0; n < 120 && t.phase !== "over"; n++) {
    if (t.rw) { E.apply(t, { type: "pass" }, 1 - t.rw.by); continue; }
    if (t.trig.length) { const tr = t.trig[0]; E.apply(t, H.trig(t, tr), tr.seat); continue; }
    break;
  }
}
const key = (t) => JSON.stringify([t.phase, t.active, t.pend, t.P.map((P) => [P.hand.map((x) => x.i), P.av.map((x) => [x.i, x.a, x.tm, x.kw, x.kt, x.pb, x.pw]), P.cs.map((x) => [x.i, x.a]), P.mg.map((x) => [x.i, x.on]), P.life.map((x) => x.up), P.hell.length, P.dark.length, P.deck.length]), t.mu, t.tbuff || null]);
// can p, acting in their own turn, still win before it passes? Returns the actions of one winning line, or null.
// Each attack is answered in every way the defender can; the line has to beat all of them. Throws "budget" when too big.
export function solveTurn(s, p, depth = 7, budget = 60000) {
  let nodes = 0; const memo = new Map();
  const go = (t, d) => {
    if (++nodes > budget) throw new Error("budget");
    settle(t);
    if (t.phase === "over") return t.winner === p ? [] : null;
    if (t.active !== p) return null;
    const q = whoActs(t); if (q == null) return null;
    const k = key(t) + "|" + d; if (memo.has(k)) return memo.get(k);
    let out = null;
    if (q !== p) {
      let line = null;
      for (const m of legalMoves(t, q)) { const u = clone(t); try { E.apply(u, m.a, q); } catch { continue; } const r = go(u, d); if (!r) { line = null; break; } line = line || r; }
      out = line;
    } else if (d > 0) {
      for (const m of legalMoves(t, p)) { if (m.a.type === "concede" || m.a.type === "end") continue; const u = clone(t); try { E.apply(u, m.a, p); } catch { continue; } const r = go(u, d - 1); if (r) { out = [{ a: m.a, d: m.d }, ...r]; break; } }
    }
    memo.set(k, out); return out;
  };
  for (let d = 1; d <= depth; d++) { const line = go(clone(s), d); if (line) return { line, nodes }; } // the shortest line first
  return { line: null, nodes };
}
// how many of p's possible first moves still leave a win this turn (few = a real puzzle)
export function firstMoves(s, p, depth = 7, budget = 60000) {
  const t = clone(s); settle(t); let good = 0, all = 0;
  for (const m of legalMoves(t, p)) { if (m.a.type === "concede" || m.a.type === "end") continue; const u = clone(t); try { E.apply(u, m.a, p); } catch { continue; } all++; try { if (solveTurn(u, p, depth - 1, budget).line) good++; } catch { /* too big: count as not winning */ } }
  return { good, all };
}
// a puzzle's table as a playable game: card details are filled in from the live card data
export function puzzleState(pz) {
  const s = JSON.parse(JSON.stringify(pz.state)); s.cards = { ...(s.cards || {}) }; s.log = []; s.ev = []; s.mode = "bot"; s.id = "pz-" + pz.id + "-" + Date.now().toString(36);
  const add = (x) => { if (x && x.c != null && !s.cards[x.c]) s.cards[x.c] = E.cardDef(x.c); };
  for (const P of s.P) for (const z of ["deck", "hand", "av", "mg", "cs", "hell", "dark", "life"]) for (const x of P[z] || []) add(x);
  add(s.land); add(s.land2);
  return s;
}
