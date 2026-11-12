// Sound effects synthesized with Web Audio — no audio files to download or license.
import { lsGet, lsSet } from "./util.js?v=20261112092930";

let ctx = null, master = null, out = null, noiseBuf = null; // master is the effects bus; out carries effects and music to the speakers
const state = { on: lsGet("bot.sound", true), vol: lsGet("bot.volume", 0.6) };
function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); out = ctx.createGain(); out.connect(ctx.destination); master = ctx.createGain(); master.gain.value = state.vol; master.connect(out);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
// the shared audio context, for the background music (js/music.js)
export function audio() { return init() ? { ctx, master: out } : null; }
// browsers only allow sound after the player interacts
addEventListener("pointerdown", () => { if (state.on && init() && ctx.state === "suspended") ctx.resume(); }, { passive: true });

function tone(f, t0, dur, { type = "sine", vol = 0.3, slide = 0, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, { vol = 0.3, from = 2000, to = 300, q = 0.8, type = "lowpass" } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
}
// seven equal steps to the octave, as in Thai classical tuning; the background music uses the same scale
const T = (k) => 293.66 * Math.pow(2, k / 7);
// a small palette per card colour so summons sound different
const COLOR_NOTES = { "แดง": [T(-3), T(1), T(4)], "ฟ้า": [T(3), T(6), T(10)], "เขียว": [T(0), T(2), T(4)], "ม่วง": [T(-2), T(-1), T(2)] };
const SOUNDS = {
  click(t) { tone(T(11), t, 0.06, { type: "triangle", vol: 0.08 }); },
  // a summon is two sounds: the card rising and turning over, then the slam when it lands
  rise(t) { noise(t, 0.6, { vol: 0.13, from: 350, to: 4200, type: "bandpass", q: 1.3 }); [0, 2, 4, 7].forEach((k, j) => tone(T(k + 7), t + 0.1 + j * 0.08, 0.4, { type: "sine", vol: 0.045 })); },
  summon(t, o = {}) {
    tone(70, t, 0.45, { vol: 0.5, slide: 0.5 }); noise(t, 0.28, { vol: 0.32, from: 900, to: 80 }); noise(t, 0.08, { vol: 0.2, from: 4000, to: 1500, type: "bandpass" }); // impact
    const n = COLOR_NOTES[o.color] || [T(1), T(4), T(8)];
    n.forEach((f, k) => tone(f, t + 0.04 + k * 0.06, 0.55, { type: o.color === "ม่วง" ? "sawtooth" : "triangle", vol: 0.09 }));
  },
  burn(t) { // catches fire and crackles
    noise(t, 1.2, { vol: 0.14, from: 1600, to: 420, type: "bandpass", q: 0.6 }); tone(95, t, 0.5, { vol: 0.16, slide: 0.6 });
    for (let k = 0; k < 16; k++) noise(t + 0.1 + Math.random() * 1.0, 0.025, { vol: 0.08 + Math.random() * 0.12, from: 2500 + Math.random() * 3500, to: 1200, type: "bandpass", q: 2.5 });
  },
  spent(t) { [0, 4, 7, 11].forEach((k, j) => tone(T(k + 7), t + j * 0.07, 0.9, { type: "sine", vol: 0.05 })); noise(t, 0.9, { vol: 0.05, from: 5000, to: 9000, type: "highpass" }); },
  void(t) { noise(t, 0.8, { vol: 0.2, from: 3200, to: 110, type: "lowpass" }); tone(150, t, 0.8, { type: "sawtooth", vol: 0.05, slide: 0.3 }); tone(T(-14), t + 0.5, 0.6, { vol: 0.25 }); },
  fly(t) { noise(t, 0.4, { vol: 0.1, from: 500, to: 2800, type: "bandpass", q: 1.1 }); },
  cast(t, o = {}) { const n = COLOR_NOTES[o.color] || [T(6), T(8), T(10)]; [0, 1, 2, 1, 2].forEach((k, j) => tone(n[k] * 2, t + j * 0.05, 0.3, { type: "sine", vol: 0.09 })); noise(t, 0.4, { vol: 0.06, from: 6000, to: 9000, type: "highpass" }); },
  land(t) { tone(T(-10), t, 1.2, { type: "sine", vol: 0.3, attack: 0.15 }); tone(T(-6), t + 0.05, 1.1, { type: "sine", vol: 0.15, attack: 0.2 }); },
  declare(t) { noise(t, 0.18, { vol: 0.12, from: 1200, to: 4000, type: "bandpass" }); tone(T(-4), t, 0.2, { type: "square", vol: 0.05 }); },
  clash(t) { noise(t, 0.12, { vol: 0.5, from: 5000, to: 900, type: "highpass" }); tone(95, t, 0.35, { vol: 0.55, slide: 0.45 }); noise(t + 0.03, 0.3, { vol: 0.25, from: 800, to: 100 }); tone(1800, t, 0.25, { type: "triangle", vol: 0.05, slide: 0.6 }); },
  destroy(t) { noise(t, 0.45, { vol: 0.35, from: 3000, to: 120 }); tone(160, t, 0.4, { type: "sawtooth", vol: 0.1, slide: 0.3 }); },
  life(t) { tone(55, t, 0.9, { vol: 0.6, slide: 0.6 }); noise(t, 0.6, { vol: 0.3, from: 600, to: 60 }); tone(T(4), t + 0.05, 0.6, { type: "sawtooth", vol: 0.05, slide: 0.5 }); },
  turn(t, o = {}) { const [a, b] = o.mine ? [T(3), T(7)] : [T(0), T(4)]; tone(a, t, 1.1, { type: "sine", vol: 0.18, attack: 0.02 }); tone(b, t + 0.04, 0.9, { type: "sine", vol: 0.08 }); },
  battle(t) { [T(-4), T(-2), T(0)].forEach((f, k) => tone(f, t + k * 0.09, 0.35, { type: "sawtooth", vol: 0.07 })); noise(t, 0.3, { vol: 0.12, from: 200, to: 1600, type: "bandpass" }); },
  win(t) { [T(6), T(8), T(10), T(13)].forEach((f, k) => tone(f, t + k * 0.13, 0.6, { type: "triangle", vol: 0.14 })); tone(T(13), t + 0.55, 1.2, { type: "sine", vol: 0.12 }); },
  lose(t) { [T(3), T(2), T(1), T(-1)].forEach((f, k) => tone(f, t + k * 0.2, 0.7, { type: "sine", vol: 0.14 })); tone(T(-14), t + 0.8, 1.3, { vol: 0.3 }); },
  // someone is one LIFE from losing: a deep gong and a heartbeat
  crit(t) { tone(T(-14), t, 2.6, { vol: 0.32, attack: 0.01 }); tone(T(-14) * 2.01, t, 1.2, { vol: 0.07 }); tone(T(-14) * 2.94, t, 0.6, { vol: 0.04 }); tone(55, t + 0.55, 0.25, { vol: 0.42, slide: 0.7 }); tone(52, t + 0.77, 0.3, { vol: 0.3, slide: 0.7 }); },
  draw(t) { noise(t, 0.12, { vol: 0.1, from: 2500, to: 6000, type: "bandpass", q: 2 }); },
  // a die rattling to a stop on the lacquer: knocks closer and closer together, each a little softer
  dice(t) { [0, 0.11, 0.2, 0.27, 0.32, 0.36].forEach((d, k) => { noise(t + d, 0.045, { vol: 0.26 - k * 0.03, from: 3400 - k * 180, to: 900, type: "bandpass", q: 3.2 }); tone(150 - k * 6, t + d, 0.07, { vol: 0.1 - k * 0.012, slide: 0.7 }); }); },
  // a coin: the ring of the flick, then the clink when it lands
  coin(t) { [2350, 3530, 5240].forEach((f, k) => tone(f, t, 0.95 - k * 0.22, { type: "sine", vol: 0.055 / (k + 1) })); },
  clink(t) { [2780, 4010, 6150].forEach((f, k) => tone(f, t, 0.4 - k * 0.08, { type: "triangle", vol: 0.05 / (k + 1) })); noise(t, 0.05, { vol: 0.12, from: 6500, to: 3200, type: "highpass" }); },
  // a LIFE card turned back face-down: a rising chime
  heal(t) { [0, 2, 4, 7, 9].forEach((k, j) => tone(T(k + 7), t + j * 0.065, 0.75, { type: "sine", vol: 0.075 })); noise(t, 0.8, { vol: 0.035, from: 7000, to: 11000, type: "highpass" }); },
  // เป่า ยิง ฉุบ: three beats, the last one higher
  rps(t) { [0, 0.28, 0.56].forEach((d, k) => { tone(k === 2 ? T(7) : T(0), t + d, 0.16, { type: "triangle", vol: 0.12 }); noise(t + d, 0.05, { vol: 0.1, from: 1500, to: 600 }); }); },
};
export const Sfx = {
  get on() { return state.on; },
  get vol() { return state.vol; },
  toggle() { state.on = !state.on; lsSet("bot.sound", state.on); if (state.on) { init(); ctx && ctx.resume(); } return state.on; },
  setVolume(v) { state.vol = v; lsSet("bot.volume", v); if (master) master.gain.value = v; },
  play(name, o) {
    if (!state.on || !SOUNDS[name] || !init() || ctx.state !== "running") return;
    try { SOUNDS[name](ctx.currentTime + 0.01, o || {}); } catch (e) { /* audio is optional */ }
  },
};
