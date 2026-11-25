// Friends' ladder: a rating for everyone who has finished a friend game, worked out in the browser from the finished
// games every approved member can read (each keeps a small result summary). Elo from 1000, oldest game first.
import { finishedGames } from "./fb.js?v=20261125122734";

const START = 1000, K = 24;
// one finished game as { w, seats, names, at, id }, from its summary or, for games from before summaries, its final state
function outcome(g) {
  if (g.nc || g.bad0 || g.bad1 || g.uv) return null; // ended as a no-contest, or a player's app found a state that does not come out of the moves
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
// rank tiers over the ladder's points: the first 5 rated games place a player, then the points say the tier
// (each tier 75 points wide from 950; ราชันย์ from 1250 has no ceiling)
export const PLACEMENT = 5;
export const TIERS = [{ k: "bronze", name: "สัมฤทธิ์", min: -Infinity, c: "#c88a52" }, { k: "silver", name: "เงิน", min: 950, c: "#c3ccd6" }, { k: "gold", name: "ทอง", min: 1025, c: "#e8bb48" },
  { k: "plat", name: "แพลทินัม", min: 1100, c: "#70d6c8" }, { k: "diamond", name: "เพชร", min: 1175, c: "#8eb0ff" }, { k: "master", name: "ราชันย์", min: 1250, c: "#d985ff" }];
export function tierOf(p) {
  if (!p || p.n < PLACEMENT) return { k: "new", name: "รอจัดแรงก์", c: "#9a8f7c", left: PLACEMENT - (p ? p.n : 0), prog: (p ? p.n : 0) / PLACEMENT, next: null, need: 0 };
  let i = TIERS.length - 1; while (i > 0 && p.r < TIERS[i].min) i--; const t = TIERS[i], nx = TIERS[i + 1] || null, lo = i ? t.min : 875;
  return { ...t, i, next: nx, need: nx ? nx.min - p.r : 0, prog: nx ? Math.max(0, Math.min(1, (p.r - lo) / (nx.min - lo))) : 1 };
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
