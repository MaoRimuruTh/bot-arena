// Sound effects synthesized with Web Audio — no audio files to download or license.
import { lsGet, lsSet } from "./util.js?v=20261110205821";

let ctx = null, master = null, noiseBuf = null;
const state = { on: lsGet("bot.sound", true), vol: lsGet("bot.volume", 0.6) };
function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = state.vol; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
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
// a small palette per card colour so summons sound different
const COLOR_NOTES = { "แดง": [220, 330, 440], "ฟ้า": [392, 523, 784], "เขียว": [294, 370, 440], "ม่วง": [233, 277, 349] };
const SOUNDS = {
  click(t) { tone(880, t, 0.06, { type: "triangle", vol: 0.08 }); },
  summon(t, o = {}) {
    noise(t, 0.35, { vol: 0.18, from: 300, to: 3000, type: "bandpass", q: 1.2 }); // whoosh down from the sky
    tone(70, t + 0.32, 0.4, { vol: 0.45, slide: 0.5 }); noise(t + 0.32, 0.25, { vol: 0.3, from: 900, to: 80 }); // impact
    const n = COLOR_NOTES[o.color] || [330, 440, 660];
    n.forEach((f, k) => tone(f, t + 0.36 + k * 0.06, 0.5, { type: o.color === "ม่วง" ? "sawtooth" : "triangle", vol: 0.09 }));
  },
  cast(t, o = {}) { const n = COLOR_NOTES[o.color] || [523, 659, 784]; [0, 1, 2, 1, 2].forEach((k, j) => tone(n[k] * 2, t + j * 0.05, 0.3, { type: "sine", vol: 0.09 })); noise(t, 0.4, { vol: 0.06, from: 6000, to: 9000, type: "highpass" }); },
  land(t) { tone(110, t, 1.2, { type: "sine", vol: 0.3, attack: 0.15 }); tone(165, t + 0.05, 1.1, { type: "sine", vol: 0.15, attack: 0.2 }); },
  declare(t) { noise(t, 0.18, { vol: 0.12, from: 1200, to: 4000, type: "bandpass" }); tone(196, t, 0.2, { type: "square", vol: 0.05 }); },
  clash(t) { noise(t, 0.12, { vol: 0.5, from: 5000, to: 900, type: "highpass" }); tone(95, t, 0.35, { vol: 0.55, slide: 0.45 }); noise(t + 0.03, 0.3, { vol: 0.25, from: 800, to: 100 }); tone(1800, t, 0.25, { type: "triangle", vol: 0.05, slide: 0.6 }); },
  destroy(t) { noise(t, 0.45, { vol: 0.35, from: 3000, to: 120 }); tone(160, t, 0.4, { type: "sawtooth", vol: 0.1, slide: 0.3 }); },
  life(t) { tone(55, t, 0.9, { vol: 0.6, slide: 0.6 }); noise(t, 0.6, { vol: 0.3, from: 600, to: 60 }); tone(440, t + 0.05, 0.6, { type: "sawtooth", vol: 0.05, slide: 0.5 }); },
  turn(t, o = {}) { const base = o.mine ? 392 : 311; tone(base, t, 1.1, { type: "sine", vol: 0.18, attack: 0.02 }); tone(base * 1.5, t + 0.04, 0.9, { type: "sine", vol: 0.08 }); },
  battle(t) { [196, 233, 294].forEach((f, k) => tone(f, t + k * 0.09, 0.35, { type: "sawtooth", vol: 0.07 })); noise(t, 0.3, { vol: 0.12, from: 200, to: 1600, type: "bandpass" }); },
  win(t) { [523, 659, 784, 1047].forEach((f, k) => tone(f, t + k * 0.13, 0.6, { type: "triangle", vol: 0.14 })); tone(1047, t + 0.55, 1.2, { type: "sine", vol: 0.12 }); },
  lose(t) { [392, 349, 311, 262].forEach((f, k) => tone(f, t + k * 0.2, 0.7, { type: "sine", vol: 0.14 })); tone(65, t + 0.8, 1.3, { vol: 0.3 }); },
  draw(t) { noise(t, 0.12, { vol: 0.1, from: 2500, to: 6000, type: "bandpass", q: 2 }); },
};
export const Sfx = {
  get on() { return state.on; },
  toggle() { state.on = !state.on; lsSet("bot.sound", state.on); if (state.on) { init(); ctx && ctx.resume(); } return state.on; },
  setVolume(v) { state.vol = v; lsSet("bot.volume", v); if (master) master.gain.value = v; },
  play(name, o) {
    if (!state.on || !SOUNDS[name] || !init() || ctx.state !== "running") return;
    try { SOUNDS[name](ctx.currentTime + 0.01, o || {}); } catch (e) { /* audio is optional */ }
  },
};
