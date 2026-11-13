// An original fantasy score for the arena and the menus, composed live with Web Audio while it plays.
// It is not a recording and not a copy of any tune: chords walk a small table of moves in a mode,
// a two-bar motif is made up for every phrase and answered with a variation, and each section of
// four phrases starts again from new material, so the music never repeats exactly.
// The ensemble is all synthesis: a string pad, a plucked harp (Karplus-Strong), FM bells, a bass,
// staccato strings, brass stabs, a soft choir and drums. Nothing is sampled or downloaded.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
};
// how the music feels from moment to moment; `cut` is how bright the string pad is
export const FMOODS = {
  menu: { bpm: 68, mode: "dorian", pad: 1, harp: "arp8", bell: 0.55, bass: "bar", drums: "", ost: 0, brass: 0, choir: 0, air: 1, cut: 1300 },
  mine: { bpm: 84, mode: "dorian", pad: 0.9, harp: "arp8", bell: 0.8, bass: "half", drums: "light", ost: 0, brass: 0, choir: 0, air: 0.35, cut: 1700 },
  foe: { bpm: 76, mode: "aeolian", pad: 0.9, harp: "arp4", bell: 0.45, bass: "half", drums: "toms", ost: 0.55, brass: 0, choir: 0, air: 0.5, cut: 1050 },
  battle: { bpm: 112, mode: "aeolian", pad: 0.65, harp: "", bell: 0.7, bass: "eighth", drums: "battle", ost: 1, brass: 1, choir: 0, air: 0, cut: 2100 },
  tense: { bpm: 92, mode: "phrygian", pad: 0.85, harp: "arp4", bell: 0.4, bass: "pulse", drums: "heart", ost: 0.6, brass: 0, choir: 0.8, air: 0.3, cut: 1250 },
  climax: { bpm: 124, mode: "harmonic", pad: 0.75, harp: "", bell: 0.8, bass: "eighth", drums: "climax", ost: 1, brass: 1, choir: 1, air: 0, cut: 2500 },
};
// where the chords may go next, by scale degree (0 = home); the last entry of each list is the cadence
const NEXT = { 0: [5, 3, 6, 2, 4, 5], 1: [4, 6, 4], 2: [5, 3, 6, 5], 3: [0, 6, 4, 5, 4], 4: [0, 5, 0], 5: [3, 6, 2, 1, 4], 6: [0, 2, 5, 0] };
// drum strokes on the sixteenths of a bar: [instrument, velocity]
const DRUMS = {
  light: { 0: [["kick", 0.55]], 8: [["kick", 0.4]], 2: [["shk", 0.5]], 6: [["shk", 0.7]], 10: [["shk", 0.5]], 14: [["shk", 0.7]] },
  toms: { 0: [["tom", 0.7]], 6: [["tom", 0.45]], 10: [["tom", 0.55]], 12: [["shk", 0.4]] },
  battle: { 0: [["taiko", 1], ["hat", 0.5]], 2: [["hat", 0.35]], 4: [["snr", 0.8], ["hat", 0.5]], 6: [["taiko", 0.65], ["hat", 0.35]], 8: [["hat", 0.5]], 10: [["taiko", 0.55], ["hat", 0.35]], 12: [["snr", 0.85], ["taiko", 0.8], ["hat", 0.5]], 14: [["hat", 0.35]] },
  heart: { 0: [["kick", 0.8]], 3: [["kick", 0.5]], 8: [["kick", 0.8]], 11: [["kick", 0.5]], 4: [["tick", 0.5]], 12: [["tick", 0.5]] },
  climax: { 0: [["taiko", 1], ["hat", 0.5]], 2: [["hat", 0.3]], 3: [["taiko", 0.6]], 4: [["snr", 0.85], ["hat", 0.45]], 6: [["taiko", 0.7], ["hat", 0.3]], 8: [["taiko", 0.9], ["hat", 0.5]], 10: [["taiko", 0.6], ["hat", 0.3]], 12: [["snr", 0.9], ["taiko", 0.85], ["hat", 0.45]], 14: [["taiko", 0.6], ["hat", 0.3]], 15: [["snr", 0.4]] },
};
// two-bar rhythms for the bell melody, as onsets in eighth notes (16 to two bars)
const RHY = [[0, 3, 4, 6, 8, 12], [0, 2, 4, 7, 8, 11, 12], [0, 4, 6, 8, 10, 12], [0, 6, 8, 10, 12], [0, 3, 6, 8, 12, 14], [0, 2, 3, 4, 8, 12]];
const ksCache = new WeakMap(); // plucked-string tables, made once per audio context and note

// opts.lite (the "ประหยัดเครื่อง" graphics setting): a shorter hall, no choir and no high string layer, about half the audio work
export function fantasy(ctx, out, seed = (Math.random() * 2 ** 31) | 0, opts = {}) {
  const key = opts.key || 62, lite = !!opts.lite;
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const sr = ctx.sampleRate, live = [];

  // ---- the mixing desk ----
  const noise = ctx.createBuffer(1, sr * 2, sr); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const outG = ctx.createGain(); outG.gain.value = 0.55; outG.connect(out); // about -21 LUFS at the default music volume (AUDIO.md)
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25; comp.connect(outG);
  // a hall made from noise: a little pre-delay, a few early reflections, then a tail that darkens as it dies
  // (the convolver is the costliest node here, so the tail is kept to 1.8 s, 1 s in lite mode)
  const hall = ctx.createConvolver(); {
    const n = Math.floor(sr * (lite ? 1.0 : 1.8)), b = ctx.createBuffer(2, n, sr), pre = Math.floor(sr * 0.018);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = pre; i < n; i++) { const x = (i - pre) / (n - pre), k = 0.55 - 0.47 * x; lp += (rnd() * 2 - 1 - lp) * k; d[i] = lp * Math.pow(1 - x, 2.2) * 0.9; }
      for (let r = 0; r < 6; r++) { const at = pre + Math.floor(sr * (0.007 + rnd() * 0.05)); if (at < n) d[at] += (rnd() < 0.5 ? -1 : 1) * (0.5 - r * 0.06); }
    }
    hall.buffer = b;
  }
  const hallIn = ctx.createGain(); hallIn.gain.value = 0.55; hallIn.connect(hall); hall.connect(comp);
  const strip = (vol, pan, send) => {
    const g = ctx.createGain(); g.gain.value = vol; let n = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    n.connect(comp); const s = ctx.createGain(); s.gain.value = send; n.connect(s); s.connect(hallIn); return g;
  };
  const CH = {
    pad: strip(0.5, 0, 0.45), harp: strip(0.8, -0.32, 0.4), bell: strip(0.55, 0.3, 0.5), bass: strip(0.75, 0, 0.08),
    ost: strip(0.45, -0.18, 0.18), brass: strip(0.42, 0.18, 0.25), choir: strip(0.0, 0, 0.6), drum: strip(0.85, 0, 0.14), air: strip(0.0, 0, 0.3), hi: strip(0.0, 0.1, 0.5),
  };
  // gains that fade in and out with the mood and the tension instead of switching
  const ramp = (p, v, tc = 0.8) => { p.setTargetAtTime(v, ctx.currentTime, tc); };

  // ---- instruments ----
  const vca = (dest, t, at, peak, dur, rel = 0.05) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + at);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(at, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(dest); return g;
  };
  const osc = (type, f, t, end, dest, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.connect(dest); o.start(t); o.stop(end + 0.05); return o; };
  const hiss = (dest, t, dur, vol, freq, q = 1, type = "bandpass", at = 0.002) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise;
    f.type = type; f.frequency.value = Math.min(freq, sr / 2 - 200); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, rnd() * 1.5); s.stop(t + dur + 0.03);
  };
  // string pad: two saws a few cents apart per note, through one gentle low-pass per chord
  const pad = (notes, t, dur, v, cut) => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.6; f.frequency.setValueAtTime(cut * 0.6, t); f.frequency.linearRampToValueAtTime(cut, t + dur * 0.5); f.frequency.linearRampToValueAtTime(cut * 0.7, t + dur);
    const g = vca(CH.pad, t, Math.min(0.9, dur * 0.3), 0.06 * v, dur + 0.7, 0.75); f.connect(g);
    for (const m of notes) { const fr = mtof(m); osc("sawtooth", fr, t, t + dur + 0.7, f, -7); if (!lite) osc("sawtooth", fr, t, t + dur + 0.7, f, 7); }
  };
  // plucked harp: Karplus-Strong tables, tuned exactly by playback rate
  const ks = (m) => {
    let C = ksCache.get(ctx); if (!C) { C = new Map(); ksCache.set(ctx, C); }
    if (C.has(m)) return C.get(m);
    const f = mtof(m), N = Math.max(2, Math.round(sr / f)), n = Math.floor(sr * Math.min(2.2, 0.9 + 220 / f)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    let lp = 0; for (let i = 0; i < N; i++) { lp += (rnd() * 2 - 1 - lp) * 0.6; ring[i] = lp; }
    let idx = 0, peak = 0; const damp = 0.4985 + Math.min(0.0012, 2 / f);
    for (let i = 0; i < n; i++) { const x = ring[idx], y = ring[(idx + 1) % N]; ring[idx] = (x + y) * damp; d[i] = x; peak = Math.max(peak, Math.abs(x)); idx = (idx + 1) % N; }
    for (let i = 0; i < n; i++) d[i] /= peak || 1;
    const r = { b, rate: (f * N) / sr }; C.set(m, r); return r;
  };
  const harp = (m, t, v) => {
    const k = ks(m), s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = k.b; s.playbackRate.value = k.rate;
    g.gain.value = 0.16 * v; s.connect(g); g.connect(CH.harp); s.start(t); s.stop(t + k.b.duration / k.rate);
  };
  // FM bell: the modulator's depth falls away faster than the tone, so it starts bright and rings soft
  const bell = (m, t, v, dur = 2.4, ratio = 3.5) => {
    const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g); g.connect(CH.bell); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  };
  const bass = (m, t, dur, v) => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 520; f.Q.value = 0.9;
    const g = vca(CH.bass, t, 0.012, 0.2 * v, dur, Math.min(0.15, dur * 0.4)); f.connect(g);
    osc("sine", mtof(m), t, t + dur, f); osc("triangle", mtof(m + 12), t, t + dur, f, 4);
  };
  // staccato strings: a short bowed saw note with a little bite at the front
  const ost = (m, t, v) => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 2; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.11);
    const g = vca(CH.ost, t, 0.006, 0.09 * v, 0.14, 0.06); f.connect(g); osc("sawtooth", mtof(m), t, t + 0.14, f, 4);
  };
  // brass stab: saws through a filter that opens and closes like a breath
  const brass = (notes, t, dur, v) => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.06); f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = vca(CH.brass, t, 0.035, 0.07 * v, dur, 0.12); f.connect(g); for (const m of notes) { osc("sawtooth", mtof(m), t, t + dur, f, -4); osc("sawtooth", mtof(m), t, t + dur, f, 5); }
  };
  // soft choir: an "ah" made of two vowel formants over detuned saws, with a slow vibrato
  const choir = (notes, t, dur, v) => {
    const sum = ctx.createGain(); const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); f1.type = f2.type = "bandpass"; f1.frequency.value = 760; f1.Q.value = 5; f2.frequency.value = 1180; f2.Q.value = 6;
    const g = vca(CH.choir, t, Math.min(1.2, dur * 0.35), 0.5 * v, dur + 1.2, 1.2); sum.connect(f1); sum.connect(f2); f1.connect(g); f2.connect(g);
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 4.6 + rnd(); dep.gain.value = 9; lfo.connect(dep); lfo.start(t); lfo.stop(t + dur + 1.3);
    for (const m of notes) for (const det of [-8, 8]) { const o = osc("sawtooth", mtof(m), t, t + dur + 1.2, sum, det); dep.connect(o.detune); }
  };
  const drum = (kind, t, v) => {
    const D = CH.drum;
    if (kind === "taiko") { const g = vca(D, t, 0.003, 0.5 * v, 0.9, 0.6); const o = ctx.createOscillator(); o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.28); o.connect(g); o.start(t); o.stop(t + 0.95); hiss(D, t, 0.12, 0.2 * v, 420, 0.7, "lowpass"); hiss(D, t, 0.025, 0.08 * v, 1300, 1.5); }
    else if (kind === "kick") { const g = vca(D, t, 0.003, 0.42 * v, 0.34, 0.25); const o = ctx.createOscillator(); o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.4); }
    else if (kind === "tom") { const g = vca(D, t, 0.003, 0.3 * v, 0.5, 0.35); const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(92, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.55); hiss(D, t, 0.08, 0.06 * v, 600, 0.8, "lowpass"); }
    else if (kind === "snr") { hiss(D, t, 0.2, 0.2 * v, 1900, 0.7); const g = vca(D, t, 0.002, 0.1 * v, 0.09, 0.06); osc("triangle", 196, t, t + 0.09, g); }
    else if (kind === "hat") hiss(D, t, 0.045, 0.05 * v, 8200, 0.7, "highpass");
    else if (kind === "tick") hiss(D, t, 0.03, 0.045 * v, 5200, 4);
    else hiss(D, t, 0.08, 0.04 * v, 6000, 1.4, "bandpass", 0.02); // shaker
  };
  // wind under the menu music: soft noise whose colour drifts slowly
  const air = (() => {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8; f.frequency.value = 700;
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 0.07; dep.gain.value = 380; lfo.connect(dep); dep.connect(f.frequency);
    const g = ctx.createGain(); g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(CH.air); const t = ctx.currentTime; s.start(t); lfo.start(t); live.push(s, lfo); return g;
  })();
  // a high string line that only the tension layer lets through: tremolo on the fifth above the home note
  const hiDrone = lite ? { o1: null, o2: null } : (() => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 3800; const trem = ctx.createGain(); trem.gain.value = 0.5; f.connect(trem); trem.connect(CH.hi);
    const lfo = ctx.createOscillator(), dep = ctx.createGain(); lfo.frequency.value = 7.5; dep.gain.value = 0.5; lfo.connect(dep); dep.connect(trem.gain);
    const t = ctx.currentTime, o1 = osc("sawtooth", mtof(key + 19), t, t + 36000, f, -6), o2 = osc("sawtooth", mtof(key + 19), t, t + 36000, f, 7);
    lfo.start(t); live.push(o1, o2, lfo); return { o1, o2 };
  })();

  // ---- composition ----
  let md = FMOODS.menu, mood = "", want = "menu", level = 0, ph = null, sect = null, pos = 0, next = ctx.currentTime + 0.15, lastMel = key + 12, ending = null, doneAt = 0;
  const sc = () => MODES[md.mode];
  const deg = (i) => { const S = sc(), o = Math.floor(i / 7); return S[((i % 7) + 7) % 7] + 12 * o; }; // a scale degree as semitones above the key
  const chordOf = (d, n = 3) => Array.from({ length: n }, (_, k) => deg(d + 2 * k));
  const nearest = (m, set) => { let b = set[0], bd = 99; for (const s0 of set) for (let o = -24; o <= 36; o += 12) { const c = s0 + o; if (Math.abs(c - m) < bd) { bd = Math.abs(c - m); b = c; } } return b; };
  const scaleNotes = () => { const r = []; for (let i = -14; i < 28; i++) r.push(key + deg(i)); return r; };
  const progression = (start, final) => {
    const ch = [start]; for (let b = 1; b < 4; b++) { const L = NEXT[ch[b - 1]]; ch.push(b === 3 && final ? L[L.length - 1] : pick(L.slice(0, -1))); } return ch;
  };
  // a phrase: four bars of chords, a bell melody (a two-bar motif and its answer) and the harp pattern
  const phrase = (k) => {
    const prog = k === 0 || k === 1 || k === 3 ? sect.A : sect.B;
    const ch = prog.map((d) => chordOf(d, 4));
    const rh = k === 3 ? sect.rh : k === 2 ? pick(RHY) : sect.rh;
    const notes = scaleNotes(), lo = key + 10, hi = key + 27, mel = [];
    let cur = nearest(lastMel, ch[0].map((c) => key + c));
    const motif = k === 3 && sect.m0 ? sect.m0 : rh.map(() => pick([-2, -1, -1, 1, 1, 2, 0, 3])); if (k === 0) sect.m0 = motif;
    for (const half of [0, 1]) for (let j = 0; j < rh.length; j++) {
      const at = half * 16 + rh[j], bar = at >> 3, strong = rh[j] % 4 === 0, tones = ch[bar].slice(0, 3).map((c) => key + c);
      // the answer (bars 3-4) keeps the motif's steps, landing on the new chords; the last note of a phrase may turn
      const step = half === 1 && j === rh.length - 1 ? pick([-1, 1, -2]) : motif[j];
      let idx = notes.indexOf(nearest(cur, notes)) + step; idx = Math.max(0, Math.min(notes.length - 1, idx)); let m = notes[idx];
      if (m < lo) m += 12; if (m > hi) m -= 12; if (strong) m = nearest(m, tones);
      if (k === 3 && half === 1 && j === rh.length - 1) m = nearest(m, [key + 12, key + 24]); // the section's last note comes home
      const end = j + 1 < rh.length ? half * 16 + rh[j + 1] : half * 16 + 16;
      mel.push({ at, m, len: Math.min(6, end - at) }); cur = m;
    }
    lastMel = cur;
    return { ch, mel, bells: rnd() < md.bell, arp: pick([[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 2, 3, 1, 2], [0, 1, 2, 3, 4, 3, 2, 1]]) };
  };
  const section = () => {
    const start = sect ? pick([0, 0, 5, 3]) : 0;
    sect = { A: progression(start, true), B: progression(pick([5, 3, 6]), false), rh: pick(RHY), m0: null, k: 0 };
  };
  const applyMood = () => {
    md = FMOODS[mood]; const tc = 1.2;
    ramp(air.gain, 0.05 * md.air, tc); ramp(CH.choir.gain, 0.0001 + 0.5 * Math.max(md.choir, level * 0.9), tc);
    ramp(CH.hi.gain, level > 0.05 ? 0.035 * level : 0.0001, tc);
  };
  // one sixteenth of the band; returns how long it lasts
  const step = (t) => {
    if (pos % 16 === 0 && (want !== mood || !ph)) { const fresh = !ph; mood = want; applyMood(); if (fresh || !sect) section(); ph = phrase(sect.k); pos = 0; }
    else if (pos === 0) { sect.k++; if (sect.k >= 4) section(); ph = phrase(sect.k); }
    const spb = 60 / md.bpm, bar = pos >> 4, s16 = pos & 15, eighth = pos >> 1, hum = () => t + (rnd() - 0.5) * 0.008, vel = () => 0.9 + rnd() * 0.18;
    const ch = ph.ch[bar], root = key + ch[0];
    if (s16 === 0) { // the bar's chord
      const voic = ch.map((c, i) => key - 12 + c + (i === 3 ? -12 : 0)).sort((x, y) => x - y);
      pad(voic, t, spb * 4, md.pad * (1 - 0.35 * level), md.cut + 1400 * level);
      if (!lite && (md.choir > 0 || level > 0.3)) choir(ch.slice(0, 3).map((c) => key + c), t, spb * 4, 0.9);
      if (md.brass) brass([root - 12, root - 5, root], hum(), spb * (bar === 3 ? 1.6 : 0.7), vel());
    }
    if (md.brass && s16 === 6 && bar % 2 === 1) brass([root - 12, root - 5], hum(), spb * 0.45, 0.7 * vel());
    // bass
    const bm = root - 24 - (ch[0] > 7 ? 12 : 0);
    if ((md.bass === "bar" && s16 === 0) || (md.bass === "half" && s16 % 8 === 0) || (md.bass === "pulse" && s16 % 4 === 0) || (md.bass === "eighth" && s16 % 2 === 0)) {
      const len = { bar: 4, half: 2, pulse: 0.9, eighth: 0.45 }[md.bass] * spb, oct = md.bass === "eighth" && s16 % 8 === 4 ? 12 : 0;
      bass(bm + oct, hum(), len * 0.95, (s16 === 0 ? 1 : 0.8) * vel());
    }
    // harp arpeggio across the chord, two octaves
    if (md.harp && (md.harp === "arp8" ? s16 % 2 === 0 : s16 % 4 === 0)) {
      const i = md.harp === "arp8" ? (s16 >> 1) : (s16 >> 2) * 2, k = ph.arp[i % 8], tones = ch.slice(0, 3);
      const m = key - 12 + tones[k % 3] + 12 * Math.floor(k / 3); harp(m, hum(), (k === 0 ? 1 : 0.75) * vel() * (1 - 0.5 * level));
    }
    // staccato string ostinato in 3+3+2
    if (md.ost && (md.ost >= 1 || s16 % 2 === 0) && rnd() < md.ost + 0.25) { const acc = [0, 3, 6, 8, 11, 14].includes(s16); const pat = [0, 0, 7, 0, 12, 0, 7, 0, 0, 0, 7, 0, 12, 7, 0, 7]; ost(root - 12 + pat[s16], hum(), (acc ? 1 : 0.55) * vel() * (0.75 + 0.35 * level)); }
    // bells
    if (ph.bells && s16 % 2 === 0) { const n = ph.mel.find((x) => x.at === eighth); if (n) bell(n.m, hum(), vel(), Math.max(1.2, n.len * spb * 0.9)); }
    // drums, with a fill into each fourth bar of the section
    const dr = md.drums && DRUMS[md.drums]; if (dr && dr[s16]) for (const [k, v] of dr[s16]) drum(k, hum(), v * vel() * (0.85 + 0.3 * level));
    if (md.drums && bar === 3 && s16 >= 12 && (md.drums === "battle" || md.drums === "climax")) drum("taiko", hum(), 0.4 + (s16 - 12) * 0.15);
    if (level > 0.5 && md.drums && s16 % 2 === 1) drum("hat", hum(), 0.25 * level);
    if (++pos === 64) pos = 0;
    return spb / 4;
  };
  // the close: a harp run and a full chord for a win, sinking bells and a low drum for a loss
  const finish = (t) => {
    const win = ending === "win", spb = 60 / Math.max(90, md.bpm);
    if (win) {
      const run = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; run.forEach((d, i) => harp(key - 12 + d, t + i * 0.045, 0.9));
      const tt = t + run.length * 0.045 + 0.05, maj = [0, 4, 7, 12];
      hiss(CH.drum, t, tt - t + 0.6, 0.05, 6500, 0.6, "highpass", tt - t); drum("taiko", tt, 1); ramp(CH.choir.gain, 0.5, 0.2); drum("snr", tt, 0.7);
      brass([key - 12, key - 5, key, key + 4], tt, 2.4, 1); pad(maj.map((d) => key - 12 + d), tt, 3, 1, 2600); choir([key, key + 4, key + 7], tt, 2.4, 1);
      maj.forEach((d, i) => bell(key + 12 + d, tt + 0.08 + i * 0.09, 0.9, 3.2));
      doneAt = tt + 4.4;
    } else {
      const fall = [12, 10, 7, 5, 3, 0]; fall.forEach((d, i) => bell(key + d, t + i * spb * 0.5, 0.8, 2.2));
      const tt = t + fall.length * spb * 0.5; drum("taiko", tt, 0.9); drum("taiko", tt + spb, 0.55);
      pad([key - 24, key - 12, key - 9, key - 5], tt, 3.4, 0.9, 900); bass(key - 24, tt, 3, 0.9);
      doneAt = tt + 4.8;
    }
  };
  return {
    setMood(m) { if (FMOODS[m]) want = m; },
    setLevel(x) { level = Math.max(0, Math.min(1, x)); if (mood) applyMood(); },
    end(won) { if (!ending) ending = won ? "win" : "lose"; },
    until(tEnd) {
      if (doneAt) return; if (next < ctx.currentTime - 0.05) next = ctx.currentTime + 0.05;
      while (next < tEnd) { if (ending) { finish(next); return; } next += step(next); }
    },
    get doneAt() { return doneAt; },
    dispose() { for (const n of live) { try { n.stop(); } catch (e) { /* already stopped */ } } try { if (hiDrone.o1) { hiDrone.o1.stop(); hiDrone.o2.stop(); } } catch (e) { /* gone */ } try { outG.disconnect(); } catch (e) { /* already gone */ } },
  };
}
