// Pick puzzles from the miner's output and write js/puzzles-data.js (published puzzles are kept as they are).
//   ADD_GENTLE=4 ADD_HARD=12 node tools/puzzles/build.cjs mined_1.json [mined_2.json …]
// Keeps a few gentle ones (the plain bot also finds the win) to start, then ones the bot misses, easiest first.
// Each puzzle keeps only the table: card numbers and where they lie. No card names or text are written here.
const fs = require("fs"), path = require("path");
const all = []; const seen = new Set();
for (const f of process.argv.slice(2)) for (const x of JSON.parse(fs.readFileSync(f, "utf8"))) { const id = `pz${x.seed}t${x.turn}`; if (seen.has(id)) continue; seen.add(id); all.push({ ...x, id }); }
const frac = (x) => (x.all ? x.good / x.all : 1);
// how hard it looks: the bot missing it counts most, then how few first moves still win, then how long the line is
const score = (x) => (x.easy ? 0 : 2) + (1 - frac(x)) + x.len / 10;
const gentle = all.filter((x) => x.easy && x.len >= 3 && x.len <= 5 && x.all >= 2 && frac(x) <= 0.5).sort((a, b) => score(a) - score(b));
const hard = all.filter((x) => !x.easy && x.len >= 3 && x.all >= 2 && frac(x) < 1).sort((a, b) => score(a) - score(b));
// variety: at most two puzzles from the same pair of decks
const pick = (list, n) => { const out = [], per = {}; for (const x of list) { const k = x.decks.join("|"); if ((per[k] || 0) >= 2) continue; per[k] = (per[k] || 0) + 1; out.push(x); if (out.length >= n) break; } return out; };
// puzzles already published stay first and keep their ids (players' solved marks are stored by id); new ones follow
const dataPath = path.join(__dirname, "../../js/puzzles-data.js");
const old = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8").match(/export const PUZZLES = (\[[\s\S]*\]);/)[1]) : [];
const oldIds = new Set(old.map((x) => x.id));
const fresh = (list) => list.filter((x) => !oldIds.has(x.id));
const ADD_GENTLE = +(process.env.ADD_GENTLE || 4), ADD_HARD = +(process.env.ADD_HARD || 12);
const chosen = [...pick(fresh(gentle), ADD_GENTLE), ...pick(fresh(hard), ADD_HARD)];
const rows = [...old.map((x) => JSON.stringify(x)), ...chosen.map((x) => JSON.stringify({ id: x.id, p: x.p, down: x.down, len: x.len, hard: !x.easy, state: JSON.parse(x.state) }))];
const hardN = old.filter((x) => x.hard).length + chosen.filter((x) => !x.easy).length;
const out = `// Puzzle tables found by tools/puzzles (see js/puzzles.js): card numbers and positions only, details load live.\n// Generated: node tools/puzzles/build.cjs — ${rows.length} puzzles, ${hardN} that the plain bot misses.\nexport const PUZZLES = [\n${rows.join(",\n")}\n];\n`;
fs.writeFileSync(dataPath, out);
console.log(`candidates ${all.length} (gentle ${gentle.length}, hard ${hard.length}) → kept ${old.length}, added ${chosen.length}, ${(out.length / 1024).toFixed(0)} KB`);
for (const x of chosen) console.log(`${x.id} ${x.easy ? "gentle" : "hard  "} len ${x.len} first ${x.good}/${x.all} down ${x.down} | ${x.decks.join(" vs ")}`);
