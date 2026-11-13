// Friends' ladder: a rating for everyone who has finished a friend game, worked out in the browser from the finished
// games every approved member can read (each keeps a small result summary). Elo from 1000, oldest game first.
import { finishedGames } from "./fb.js?v=20261113115141";

const START = 1000, K = 24;
// one finished game as { w, seats, names, at, id }, from its summary or, for games from before summaries, its final state
function outcome(g) {
  let r = g.result, st = null;
  if (!r || !r.seats) { try { st = JSON.parse(g.state); } catch { return null; } if (!st || st.phase !== "over") return null; r = { w: st.winner == null ? "" : st.P[st.winner].uid || "", seats: [st.P[0].uid || "", st.P[1].uid || ""], names: [st.P[0].name, st.P[1].name], at: g.updatedAt }; }
  if (!r.seats[0] || !r.seats[1] || r.seats[0] === r.seats[1]) return null;
  return { w: r.w || "", seats: r.seats, names: r.names || ["", ""], at: r.at || g.updatedAt || 0, id: g.id, tour: g.tour || null };
}
export function rank(games) {
  const list = games.map(outcome).filter(Boolean).sort((a, b) => a.at - b.at);
  const P = {}, vs = {}, newest = {};
  const who = (uid, name, at, id) => { const p = (P[uid] = P[uid] || { uid, name, r: START, w: 0, l: 0, d: 0, n: 0, last: 0 }); if (name) p.name = name; if (at >= p.last) { p.last = at; newest[uid] = id; } return p; };
  for (const o of list) {
    const [a, b] = o.seats.map((u, k) => who(u, o.names[k], o.at, o.id));
    const sa = o.w === a.uid ? 1 : o.w === b.uid ? 0 : 0.5, ea = 1 / (1 + 10 ** ((b.r - a.r) / 400));
    a.r += K * (sa - ea); b.r -= K * (sa - ea); a.n++; b.n++;
    if (sa === 1) { a.w++; b.l++; } else if (sa === 0) { a.l++; b.w++; } else { a.d++; b.d++; }
    for (const [x, y, s] of [[a, b, sa], [b, a, 1 - sa]]) { const k = x.uid + ">" + y.uid; const h = (vs[k] = vs[k] || { w: 0, l: 0, d: 0 }); if (s === 1) h.w++; else if (s === 0) h.l++; else h.d++; }
  }
  const table = Object.values(P).sort((x, y) => y.r - x.r || y.w - x.w).map((p) => ({ ...p, r: Math.round(p.r) }));
  return { table, games: list.length, list, vs: (me, them) => vs[me + ">" + them] || null, newest };
}
// cached for a minute, so moving between pages does not read every finished game again
let cache = null, at = 0, pending = null;
export function ladder(force) {
  if (!force && cache && Date.now() - at < 60e3) return Promise.resolve(cache);
  if (pending) return pending;
  pending = finishedGames().then((games) => { const res = rank(games); res.avatars = avatarsOf(games, res.newest); cache = res; at = Date.now(); return res; }).finally(() => { pending = null; });
  return pending;
}
export const ladderNow = () => cache;
export const ladderFresh = () => !!cache && Date.now() - at < 60e3;
export const ladderReset = () => { at = 0; }; // a game just ended: read again next time
// each player's picture as it was in their most recent game
function avatarsOf(games, newest) {
  const byId = Object.fromEntries(games.map((g) => [g.id, g])); const out = {};
  for (const [uid, id] of Object.entries(newest)) { try { const st = JSON.parse(byId[id].state); const p = st.P.find((x) => x.uid === uid); if (p && p.ava) out[uid] = p.ava; } catch { /* no picture */ } }
  return out;
}
