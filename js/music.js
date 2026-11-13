// Background music for the arena, composed live with Web Audio in the manner of a Thai piphat
// ensemble: seven equal steps to the octave with a five-note scale on top, a gong-circle skeleton
// melody, ranat runs that land on it every beat, a bamboo flute, ching-chap cymbals and drums.
// Nothing is sampled or downloaded, so there is nothing to license.
import { lsGet, lsSet } from "./util.js?v=20261113200502";
import { audio } from "./sfx.js?v=20261113200502";

const ROOT = 293.66; // the scale's home note
const SCALES = [[0, 1, 2, 4, 5], [0, 1, 3, 4, 5], [0, 2, 3, 4, 6]]; // five of the seven steps
// how the game feels from moment to moment
export const MOODS = {
  mine: { bpm: 76, sub: 2, scale: 0, root: 0, oct: 0, ranat: 0.9, khong: "beat", flute: 0.75, drum: "calm", ching: "slow" },
  foe: { bpm: 66, sub: 2, scale: 1, root: -2, oct: -1, ranat: 0.75, khong: "half", flute: 0.9, drum: "sparse", ching: "slow" },
  battle: { bpm: 100, sub: 4, scale: 0, root: 0, oct: 0, ranat: 1, khong: "beat", flute: 0, drum: "battle", ching: "fast" },
  tense: { bpm: 84, sub: 2, scale: 2, root: 1, oct: 0, ranat: 0.85, khong: "beat", flute: 0.5, drum: "heart", ching: "fast" },
  climax: { bpm: 112, sub: 4, scale: 2, root: 1, oct: 0, ranat: 1, khong: "beat", flute: 0, drum: "climax", ching: "fast" },
};
// drum strokes per sixteenth of a bar: the taphon's open "theng" and slap "tha"
const DRUMS = {
  calm: { 4: ["tha", 0.45], 12: ["theng", 0.7], 14: ["tha", 0.35] },
  sparse: { 12: ["theng", 0.55] },
  battle: { 0: ["theng", 0.8], 4: ["tha", 0.6], 6: ["tha", 0.45], 8: ["theng", 0.7], 10: ["theng", 0.45], 12: ["theng", 0.85], 14: ["tha", 0.55] },
  heart: { 0: ["theng", 0.8], 2: ["theng", 0.45], 8: ["theng", 0.8], 10: ["theng", 0.45] },
  climax: { 0: ["theng", 0.9], 2: ["theng", 0.5], 4: ["tha", 0.6], 6: ["tha", 0.5], 8: ["theng", 0.9], 10: ["theng", 0.5], 12: ["tha", 0.7], 13: ["tha", 0.45], 14: ["tha", 0.6], 15: ["tha", 0.5] },
};
// a small hall to play in: decaying, slightly darkened noise
function room(ctx, rnd) {
  const n = Math.floor(ctx.sampleRate * 1.6), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { lp += (rnd() * 2 - 1 - lp) * 0.35; d[i] = lp * Math.pow(1 - i / n, 2.6); } }
  return b;
}

// The ensemble itself, playing into `out`. It is driven by until(t), which writes every note up to
// time t, so the same code plays live (a timer keeps it a little ahead) or renders offline.
export function band(ctx, out, seed = (Math.random() * 2 ** 31) | 0) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

  // the mixing desk: each instrument has its level, its place in the stereo field and a send to the hall
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const outG = ctx.createGain(); outG.connect(out);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2; comp.connect(outG);
  const hall = ctx.createConvolver(); hall.buffer = room(ctx, rnd); hall.connect(comp);
  const strip = (pan, send) => {
    const g = ctx.createGain(); let n = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    n.connect(comp); const s = ctx.createGain(); s.gain.value = send; n.connect(s); s.connect(hall); return g;
  };
  const CH = { ranat: strip(-0.3, 0.22), khong: strip(0.28, 0.32), flute: strip(0.12, 0.4), ching: strip(0.05, 0.18), drum: strip(-0.05, 0.1) };

  const osc = (ch, f, t, dur, vol, { type = "sine", attack = 0.004, from = 0, glide = 0.05 } = {}) => {
    if (f > 15000 || vol < 0.0004) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    if (from) { o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + glide); } else o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ch); o.start(t); o.stop(t + dur + 0.03);
  };
  const hiss = (ch, t, dur, vol, freq, q = 1, type = "bandpass") => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise;
    f.type = type; f.frequency.value = Math.min(freq, ctx.sampleRate / 2 - 200); f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(ch); s.start(t, rnd() * 0.7); s.stop(t + dur + 0.03);
  };
  // ranat ek: a hard-mallet wooden bar, quick to fade, with a bar's out-of-tune overtones and a knock
  const ranat = (f, t, v) => {
    const d = Math.min(0.5, 140 / f) + 0.04;
    osc(CH.ranat, f, t, d, 0.11 * v); osc(CH.ranat, f * 2.76, t, d * 0.25, 0.022 * v); osc(CH.ranat, f * 5.4, t, 0.03, 0.008 * v); hiss(CH.ranat, t, 0.025, 0.05 * v, f * 2.4, 3);
  };
  // khong wong: a bossed gong, round and long, two partials a hair apart beating slowly
  const khong = (f, t, v) => {
    osc(CH.khong, f, t, 1.8, 0.1 * v, { attack: 0.008 }); osc(CH.khong, f * 1.0045, t, 1.5, 0.05 * v, { attack: 0.01 });
    osc(CH.khong, f * 2.01, t, 0.6, 0.03 * v); osc(CH.khong, f * 2.92, t, 0.3, 0.014 * v); osc(CH.khong, f * 4.2, t, 0.12, 0.008 * v); hiss(CH.khong, t, 0.03, 0.02 * v, f * 3, 2);
  };
  // khlui: a bamboo flute that slides from note to note and lets a vibrato grow on the long ones
  const khlui = (f, t, dur, prev, v) => {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), lfo = ctx.createOscillator(), dep = ctx.createGain();
    o.type = "triangle"; o2.type = "sine"; g2.gain.value = 0.25;
    for (const [x, k] of [[o, 1], [o2, 2]]) { if (prev) { x.frequency.setValueAtTime(prev * k, t); x.frequency.exponentialRampToValueAtTime(f * k, t + 0.08); } else x.frequency.setValueAtTime(f * k, t); }
    lfo.frequency.value = 5 + rnd(); dep.gain.setValueAtTime(0, t); dep.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.6, dur * 0.6)); lfo.connect(dep); dep.connect(o.frequency); dep.connect(o2.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * v, t + 0.07); g.gain.linearRampToValueAtTime(0.045 * v, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(CH.flute); for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.05); }
    hiss(CH.flute, t, 0.09, 0.016 * v, f * 1.6, 1.4);
  };
  // ching: small thick cymbals, let ring ("ching") or damped at once ("chap")
  const ching = (t, open, v = 1) => {
    const d = open ? 1.1 : 0.06;
    [[3170, 1], [4420, 0.8], [5960, 0.6], [7710, 0.45], [9930, 0.3]].forEach(([f, k], i) => osc(CH.ching, f * (1 + (rnd() - 0.5) * 0.006), t, d * (1 - i * 0.12), (open ? 0.016 : 0.022) * k * v, { attack: 0.002 }));
    hiss(CH.ching, t, open ? 0.3 : 0.045, (open ? 0.025 : 0.05) * v, 7000, 0.8, "highpass");
  };
  // drums: the klong that's deep boom, the taphon's open "theng" and its slap "tha"
  const drum = (kind, t, v) => {
    if (kind === "boom") { osc(CH.drum, 58, t, 1.2, 0.32 * v, { from: 96, glide: 0.12, attack: 0.006 }); hiss(CH.drum, t, 0.18, 0.09 * v, 260, 0.7, "lowpass"); }
    else if (kind === "theng") { osc(CH.drum, 118, t, 0.5, 0.2 * v, { from: 152, glide: 0.07 }); osc(CH.drum, 236, t, 0.12, 0.04 * v); hiss(CH.drum, t, 0.06, 0.05 * v, 900, 1); }
    else { osc(CH.drum, 340, t, 0.08, 0.08 * v); hiss(CH.drum, t, 0.07, 0.1 * v, 2200, 1.3); }
  };

  // m counts steps of the five-note scale from the home note an octave down; 5 is home
  const hz = (m, md, oct = 0) => { const sc = SCALES[md.scale], o = Math.floor(m / 5), k = ((m % 5) + 5) % 5; return ROOT * Math.pow(2, (o * 7 + sc[k] + md.root) / 7 + oct); };
  const LO = 1, HI = 9, HOME = 5, clamp = (m) => Math.max(LO, Math.min(HI, m));
  // the next note of the skeleton: a step or two, never so far that the bar's goal is out of reach
  const toward = (cur, tgt, left) => {
    for (let i = 0; i < 12; i++) {
      let s = pick([-2, -1, -1, 1, 1, 2, 0]); if (rnd() < 0.3) s = Math.sign(tgt - cur) || s; const n = cur + s;
      if (n < LO || n > HI || Math.abs(tgt - n) > 2 * left || (left === 1 && n === tgt)) continue; return n;
    }
    return clamp(cur + Math.sign(tgt - cur) * Math.min(2, Math.abs(tgt - cur)));
  };
  // what the ranat plays across one beat: it starts on the skeleton note and leads into the next one
  const run = (cur, nxt, k) => {
    if (k === 1) return [cur]; const d = nxt - cur, sg = Math.sign(d) || (rnd() < 0.5 ? 1 : -1);
    if (k === 2) return [cur, clamp(Math.abs(d) >= 2 ? cur + Math.round(d / 2) : d === 0 ? cur + sg : rnd() < 0.5 ? cur - d : nxt + d)];
    const shapes = Math.abs(d) >= 3 ? [[1, 2, 3].map((j) => cur + Math.round((d * j) / 4))]
      : [[cur + 1, cur, nxt - sg], [cur - 1, cur, nxt - sg], [nxt + 1, nxt + 2, nxt + 1], [nxt - 1, nxt - 2, nxt - 1], [cur, nxt + sg, nxt - sg]];
    return [cur, ...pick(shapes).map(clamp)];
  };
  // a phrase is four bars; each bar comes to rest on its last beat and the last bar comes home
  const phrase = (from, md) => {
    const ends = [pick([3, 4, 6, 7]), pick([3, 5, 7, 8]), pick([2, 4, 6, 7]), rnd() < 0.8 ? HOME : 3];
    const sk = []; let cur = from;
    for (let b = 0; b < 16; b++) { const e = (b >> 2) * 4 + 3, tgt = ends[b >> 2]; cur = b === e ? tgt : toward(cur, tgt, e - b); sk.push(cur); }
    const thin = md.ranat < 1 && rnd() > md.ranat; // now and then the ranat only marks the beats, to let the music breathe
    const ra = sk.map((c, b) => (thin && b % 4 !== 3 ? [c] : run(c, b < 15 ? sk[b + 1] : c, md.sub)));
    const fill = sk.map((c, b) => (b >= 12 ? run(c, b < 15 ? sk[b + 1] : c, 4) : null)); // the second time round, the last bar runs twice as fast
    return { sk, ra, fill, flute: rnd() < md.flute, rest: [0, 1, 2, 3].map(() => rnd() < 0.25), rep: 0 };
  };

  let md = MOODS.mine, cur = "", want = "mine", ph = null, pos = 0, next = ctx.currentTime + 0.12, last = HOME, fprev = 0, ending = null, doneAt = 0;
  // one sixteenth note of the band; returns how long it lasts
  const step = (t) => {
    if (pos % 16 === 0 && (want !== cur || !ph)) { cur = want; md = MOODS[cur]; ph = phrase(last, md); pos = 0; } // a new mood starts with the next bar
    else if (pos === 0 && ph.rep >= 2) ph = phrase(last, md); // each phrase is heard twice
    const beat = pos >> 2, j = pos & 3, bar = pos >> 4, s16 = pos & 15, spb = 60 / md.bpm, hum = () => t + (rnd() - 0.5) * 0.008;
    const notes = ph.rep === 1 && md.sub === 2 && ph.fill[beat] ? ph.fill[beat] : ph.ra[beat], every = 4 / notes.length;
    if (j % every === 0) { // ranat, in octaves
      const f = hz(notes[j / every], md, md.oct), v = (j === 0 ? 1 : 0.72) * (0.92 + rnd() * 0.16) * (md.sub === 4 ? 1.05 : 0.9), th = hum();
      ranat(f, th, v); ranat(f * 2, th + 0.002, v * 0.7);
    }
    if (j === 0) {
      const m = ph.sk[beat], strong = beat % 4 === 3, f = hz(m, md) / 2;
      if (md.khong === "beat" || beat % 2 === 1) { khong(f, hum(), strong ? 1 : 0.7); if (strong) khong(f * 2, hum() + 0.012, 0.45); }
      if (beat % 2 === 0) { // the flute holds the note the next strong beat will land on
        if (ph.flute && !ph.rest[bar]) { const g = hz(ph.sk[Math.min(15, beat + 1)], md); khlui(g, t, spb * 2 * 0.96, fprev, 1); fprev = g; } else fprev = 0;
      }
      last = m;
    }
    const cg = md.ching === "slow" ? { 4: 1, 12: 0 } : { 0: 1, 4: 0, 8: 1, 12: 0 }; if (s16 in cg) ching(t, cg[s16] === 1);
    const dr = DRUMS[md.drum][s16]; if (dr) drum(dr[0], hum(), dr[1]);
    if (s16 === 12 && (bar === 3 || (md.sub === 4 && bar === 1))) drum("boom", t, 0.75);
    if (++pos === 64) { pos = 0; ph.rep++; }
    return spb / 4;
  };
  // the close: a ranat run up to the high home note for a win, sinking for a loss, then gong and drum
  const finish = (t) => {
    const spb = 60 / md.bpm, win = ending === "win", line = win ? [5, 6, 7, 8, 10] : [6, 5, 3, 1, 0];
    line.forEach((m, i) => { const f = hz(m, md, md.oct), at = t + (i * spb) / 4; ranat(f, at, 0.95); ranat(f * 2, at + 0.002, 0.7); });
    const tt = t + spb * 1.25; khong(hz(win ? 10 : 0, md) / 2, tt, 1); khong(hz(win ? 5 : 0, md) / 2, tt + 0.01, 0.8); ching(tt, true, 1.2); drum("boom", tt, 1);
    if (!win) drum("boom", tt + spb, 0.6);
    doneAt = tt + 3.2;
  };
  return {
    setMood(m) { if (MOODS[m]) want = m; },
    end(won) { if (!ending) ending = won ? "win" : "lose"; },
    until(tEnd) {
      if (doneAt) return; if (next < ctx.currentTime - 0.05) next = ctx.currentTime + 0.05; // fell behind (a hidden tab): skip ahead
      while (next < tEnd) { if (ending) { finish(next); return; } next += step(next); }
    },
    get doneAt() { return doneAt; },
    dispose() { try { outG.disconnect(); } catch (e) { /* already gone */ } },
  };
}

// ---------- live playback in the arena ----------
const st = { on: lsGet("bot.music", true), vol: lsGet("bot.musicvol", 0.55) };
let A = null, B = null, timer = null, mood = "mine", want = false;
function bus() {
  if (A) return A; const a = audio(); if (!a) return null;
  const g = a.ctx.createGain(); g.gain.value = 0; g.connect(a.master); A = { ctx: a.ctx, g }; return A;
}
function tick() {
  if (!A || !B || A.ctx.state !== "running" || document.hidden) return;
  B.until(A.ctx.currentTime + 0.3);
  if (B.doneAt && A.ctx.currentTime > B.doneAt) halt(); // the game is over and the last gong has died away
}
function begin() {
  if (!st.on || !want || B) return; const a = bus(); if (!a) return;
  B = band(a.ctx, a.g); B.setMood(MOODS[mood] ? mood : "mine");
  const t = a.ctx.currentTime; a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(a.g.gain.value, t); a.g.gain.linearRampToValueAtTime(st.vol, t + 1.5);
  clearInterval(timer); timer = setInterval(tick, 50);
}
function halt() {
  clearInterval(timer); timer = null; if (!A) return;
  const t = A.ctx.currentTime, old = B; B = null;
  A.g.gain.cancelScheduledValues(t); A.g.gain.setValueAtTime(A.g.gain.value, t); A.g.gain.linearRampToValueAtTime(0, t + 0.6);
  if (old) setTimeout(() => old.dispose(), 1500);
}
// browsers only allow sound after the player interacts
addEventListener("pointerdown", () => { if (st.on && want) { const a = bus(); if (a && a.ctx.state === "suspended") a.ctx.resume(); } }, { passive: true });

export const Music = {
  get on() { return st.on; },
  get vol() { return st.vol; },
  toggle() { st.on = !st.on; lsSet("bot.music", st.on); if (st.on) { const a = bus(); if (a) a.ctx.resume(); begin(); } else halt(); return st.on; },
  start() { want = true; begin(); }, // entering the arena
  stop() { want = false; halt(); }, // leaving it
  // mine / foe / battle / tense / climax, or win / lose to play the close
  mood(m) {
    if (m === mood) return; mood = m; if (!B) return;
    if (m === "win" || m === "lose") B.end(m === "win"); else B.setMood(m);
  },
  setVolume(v) { st.vol = v; lsSet("bot.musicvol", v); if (A && B) A.g.gain.setTargetAtTime(v, A.ctx.currentTime, 0.1); },
};
