// Sound effects synthesized with Web Audio — no audio files to download or license.
// Everything goes through one chain: effects bus (with a glue compressor and a small room) and the
// music bus (which dips under big hits) meet in a limiter, so stacked sounds never clip.
import { lsGet, lsSet } from "./util.js?v=20261115012727";

let ctx = null, master = null, out = null, duckG = null, noiseBuf = null, room = null; // master is the effects bus
let pv = 1, gk = 1; // this sound's small random pitch (so repeats don't sound like a machine) and its level trim
const state = { on: lsGet("bot.sound", true), vol: lsGet("bot.volume", 0.6) };
// the chain, built the same way for the live context and for an offline render
function chain(c, vol) {
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12; lim.connect(c.destination);
  const o = c.createGain(); o.connect(lim);
  const glue = c.createDynamicsCompressor(); glue.threshold.value = -16; glue.knee.value = 6; glue.ratio.value = 3; glue.attack.value = 0.004; glue.release.value = 0.15; glue.connect(o);
  const m = c.createGain(); m.gain.value = vol; m.connect(glue);
  const n = Math.floor(c.sampleRate * 1.1), b = c.createBuffer(2, n, c.sampleRate); // a small room for the effects
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.4 * i / n); d[i] = lp * Math.pow(1 - i / n, 3); } }
  const r = c.createConvolver(); r.buffer = b; const rs = c.createGain(); rs.gain.value = 0.16; m.connect(rs); rs.connect(r); r.connect(o);
  const dk = c.createGain(); dk.connect(o);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return { out: o, master: m, duck: dk, noise: nb, room: r };
}
function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { ctx = new AC(); }
  ({ out, master, duck: duckG, noise: noiseBuf, room } = chain(ctx, state.vol));
  return ctx;
}
// the shared audio context, for the background music (js/music.js): music plays into `master`, the bus that ducks
export function audio() { return init() ? { ctx, master: duckG } : null; }
// big hits push the music down a little and let it come back
function duck(depth = 0.55, hold = 0.18, rel = 0.7) {
  if (!duckG || !ctx) return; const t = ctx.currentTime, g = duckG.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(depth, t + 0.03); g.setValueAtTime(depth, t + 0.03 + hold); g.linearRampToValueAtTime(1, t + 0.03 + hold + rel);
}
// browsers only allow sound after the player interacts
addEventListener("pointerdown", () => { if (state.on && init() && ctx.state === "suspended") ctx.resume(); }, { passive: true });
// a hidden tab makes no sound and spends no battery; it wakes when it is shown again
document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) { if (ctx.state === "running") ctx.suspend(); } else if (ctx.state === "suspended") ctx.resume(); });
// a soft tick for buttons anywhere in the app
addEventListener("click", (e) => { const b = e.target && e.target.closest && e.target.closest("button,.btn,[role=button],summary"); if (b && !b.disabled) Sfx.play("ui"); }, true);

function tone(f, t0, dur, { type = "sine", vol = 0.3, slide = 0, attack = 0.005 } = {}) {
  f *= pv; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  vol *= gk; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, { vol = 0.3, from = 2000, to = 300, q = 0.8, type = "lowpass", attack = 0 } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(Math.min(from * pv, ctx.sampleRate / 2 - 100), t0); f.frequency.exponentialRampToValueAtTime(Math.min(Math.max(40, to * pv), ctx.sampleRate / 2 - 100), t0 + dur);
  vol *= gk; if (attack) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); } else g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
// a bell or glass note: FM, bright at the strike and soft as it rings
function fm(f, t0, dur, { vol = 0.1, ratio = 3.5, index = 2.2 } = {}) {
  f *= pv; const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = f; m.frequency.value = f * ratio; mg.gain.setValueAtTime(f * index, t0); mg.gain.exponentialRampToValueAtTime(f * 0.05, t0 + dur * 0.5);
  m.connect(mg); mg.connect(c.frequency); vol *= gk; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  c.connect(g); g.connect(master); c.start(t0); m.start(t0); c.stop(t0 + dur + 0.03); m.stop(t0 + dur + 0.03);
}
// notes by MIDI number, in D like the music, so effects sit in tune with it
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
// a small palette per card colour so summons sound different
const COLOR_NOTES = { "แดง": [62, 69, 74], "ฟ้า": [76, 81, 83], "เขียว": [67, 71, 74], "ม่วง": [63, 69, 72] };
const SOUNDS = {
  ui(t) { noise(t, 0.025, { vol: 0.05, from: 3800, to: 2600, type: "bandpass", q: 3 }); tone(N(86), t, 0.04, { type: "sine", vol: 0.025 }); },
  click(t) { tone(N(81), t, 0.06, { type: "triangle", vol: 0.07 }); noise(t, 0.02, { vol: 0.05, from: 4000, to: 3000, type: "bandpass", q: 2 }); },
  // a summon is two sounds: the card rising and turning over, then the slam when it lands
  rise(t) { noise(t, 0.6, { vol: 0.12, from: 350, to: 4200, type: "bandpass", q: 1.3, attack: 0.25 }); [74, 77, 81, 86].forEach((m, j) => fm(N(m), t + 0.12 + j * 0.07, 0.6, { vol: 0.035, ratio: 2.0, index: 1.2 })); },
  summon(t, o = {}) {
    tone(82, t, 0.5, { vol: 0.5, slide: 0.5 }); noise(t, 0.28, { vol: 0.3, from: 900, to: 80 }); noise(t, 0.06, { vol: 0.2, from: 5000, to: 1800, type: "bandpass" }); // impact
    const n = COLOR_NOTES[o.color] || [62, 69, 74];
    n.forEach((m, k) => fm(N(m), t + 0.04 + k * 0.05, 0.9, { vol: 0.07, ratio: o.color === "ม่วง" ? 1.41 : 3.5, index: o.color === "แดง" ? 3 : 2 }));
    if (o.color === "แดง") tone(N(50), t + 0.02, 0.6, { type: "sawtooth", vol: 0.05, slide: 0.98 });
  },
  burn(t) { // catches fire and crackles
    noise(t, 1.2, { vol: 0.14, from: 1600, to: 420, type: "bandpass", q: 0.6, attack: 0.08 }); tone(95, t, 0.5, { vol: 0.16, slide: 0.6 });
    for (let k = 0; k < 16; k++) noise(t + 0.1 + Math.random() * 1.0, 0.025, { vol: 0.08 + Math.random() * 0.12, from: 2500 + Math.random() * 3500, to: 1200, type: "bandpass", q: 2.5 });
  },
  spent(t) { [74, 78, 81, 85].forEach((m, j) => fm(N(m), t + j * 0.07, 0.9, { vol: 0.04, ratio: 2, index: 1 })); noise(t, 0.9, { vol: 0.04, from: 5000, to: 9000, type: "highpass" }); },
  void(t) { noise(t, 0.8, { vol: 0.2, from: 3200, to: 110, type: "lowpass" }); tone(150, t, 0.8, { type: "sawtooth", vol: 0.05, slide: 0.3 }); tone(N(38), t + 0.5, 0.6, { vol: 0.25 }); },
  fly(t) { noise(t, 0.38, { vol: 0.1, from: 500, to: 2800, type: "bandpass", q: 1.1, attack: 0.12 }); },
  cast(t, o = {}) { const n = COLOR_NOTES[o.color] || [74, 79, 83]; [0, 1, 2, 1, 2].forEach((k, j) => fm(N(n[k] + 12), t + j * 0.05, 0.45, { vol: 0.06, ratio: 3.5 })); noise(t, 0.4, { vol: 0.05, from: 6000, to: 9000, type: "highpass" }); },
  land(t) { tone(N(38), t, 1.4, { type: "sine", vol: 0.3, attack: 0.15 }); tone(N(45), t + 0.05, 1.2, { type: "sine", vol: 0.12, attack: 0.2 }); fm(N(62), t + 0.1, 1.6, { vol: 0.05, ratio: 2, index: 1 }); },
  // a blade drawn: a rising scrape and a metal ring that is not quite in tune with itself
  declare(t) { noise(t, 0.2, { vol: 0.11, from: 1200, to: 5200, type: "bandpass", q: 2, attack: 0.08 }); [1, 2.76, 5.4].forEach((r, k) => tone(N(74) * r, t + 0.12, 0.5 - k * 0.12, { type: "sine", vol: 0.04 / (k + 1) })); },
  clash(t) { noise(t, 0.1, { vol: 0.5, from: 6000, to: 900, type: "highpass" }); tone(95, t, 0.35, { vol: 0.55, slide: 0.45 }); noise(t + 0.02, 0.3, { vol: 0.25, from: 800, to: 100 }); [1, 2.4, 3.9].forEach((r, k) => tone(1450 * r, t, 0.3 - k * 0.07, { type: "triangle", vol: 0.04 / (k + 1), slide: 0.92 })); },
  // breaking: shards scattering down in pitch, and a dull thud under them
  destroy(t) { noise(t, 0.45, { vol: 0.3, from: 3000, to: 120 }); tone(150, t, 0.35, { type: "sawtooth", vol: 0.08, slide: 0.3 }); for (let k = 0; k < 9; k++) noise(t + 0.02 + k * 0.03 + Math.random() * 0.02, 0.05, { vol: 0.09 - k * 0.006, from: 6500 - k * 450, to: 3000 - k * 200, type: "bandpass", q: 6 }); },
  life(t) { tone(55, t, 0.9, { vol: 0.6, slide: 0.6 }); noise(t, 0.6, { vol: 0.3, from: 600, to: 60 }); tone(N(63), t + 0.05, 0.6, { type: "sawtooth", vol: 0.04, slide: 0.5 }); for (let k = 0; k < 5; k++) noise(t + 0.03 + k * 0.025, 0.04, { vol: 0.06, from: 7000 - k * 600, to: 4000, type: "bandpass", q: 5 }); },
  // a new turn: a clear two-note chime, up for us and down for them
  turn(t, o = {}) { const [a, b] = o.mine ? [81, 88] : [74, 69]; fm(N(a), t, 1.2, { vol: 0.09, ratio: 2, index: 0.9 }); fm(N(b), t + 0.11, 1.4, { vol: 0.08, ratio: 2, index: 0.9 }); tone(N(b - 12), t + 0.11, 0.9, { vol: 0.04 }); },
  battle(t) { [[50, 57], [52, 59], [53, 60]].forEach(([x, y], k) => { tone(N(x), t + k * 0.1, 0.4, { type: "sawtooth", vol: 0.05 }); tone(N(y), t + k * 0.1, 0.4, { type: "sawtooth", vol: 0.04 }); }); tone(70, t + 0.2, 0.6, { vol: 0.35, slide: 0.5 }); noise(t, 0.35, { vol: 0.1, from: 200, to: 1600, type: "bandpass" }); },
  win(t) { [74, 78, 81, 86].forEach((m, k) => fm(N(m), t + k * 0.08, 1.4, { vol: 0.07, ratio: 3.5 })); noise(t, 1.2, { vol: 0.04, from: 6000, to: 10000, type: "highpass", attack: 0.4 }); },
  lose(t) { [69, 65, 62].forEach((m, k) => fm(N(m), t + k * 0.22, 1.2, { vol: 0.07, ratio: 1.41, index: 1.4 })); tone(N(38), t + 0.6, 1.5, { vol: 0.28 }); },
  // someone is one LIFE from losing: a deep gong and a heartbeat
  crit(t) { tone(N(38), t, 2.6, { vol: 0.32, attack: 0.01 }); tone(N(38) * 2.01, t, 1.2, { vol: 0.07 }); tone(N(38) * 2.94, t, 0.6, { vol: 0.04 }); tone(55, t + 0.55, 0.25, { vol: 0.42, slide: 0.7 }); tone(52, t + 0.77, 0.3, { vol: 0.3, slide: 0.7 }); },
  draw(t) { noise(t, 0.12, { vol: 0.1, from: 2500, to: 6000, type: "bandpass", q: 2, attack: 0.04 }); },
  // a die rattling to a stop on the lacquer: knocks closer and closer together, each a little softer
  dice(t) { [0, 0.11, 0.2, 0.27, 0.32, 0.36].forEach((d, k) => { noise(t + d, 0.045, { vol: 0.26 - k * 0.03, from: 3400 - k * 180, to: 900, type: "bandpass", q: 3.2 }); tone(150 - k * 6, t + d, 0.07, { vol: 0.1 - k * 0.012, slide: 0.7 }); }); },
  // a coin: the ring of the flick, then the clink when it lands
  coin(t) { [2350, 3530, 5240].forEach((f, k) => tone(f, t, 0.95 - k * 0.22, { type: "sine", vol: 0.055 / (k + 1) })); },
  clink(t) { [2780, 4010, 6150].forEach((f, k) => tone(f, t, 0.4 - k * 0.08, { type: "triangle", vol: 0.05 / (k + 1) })); noise(t, 0.05, { vol: 0.12, from: 6500, to: 3200, type: "highpass" }); },
  // a LIFE card turned back face-down: a rising chime
  heal(t) { [74, 76, 78, 81, 83, 86].forEach((m, j) => fm(N(m), t + j * 0.06, 0.8, { vol: 0.05, ratio: 2, index: 1 })); noise(t, 0.8, { vol: 0.03, from: 7000, to: 11000, type: "highpass", attack: 0.2 }); },
  // เป่า ยิง ฉุบ: three beats, the last one higher
  rps(t) { [0, 0.28, 0.56].forEach((d, k) => { tone(k === 2 ? N(81) : N(74), t + d, 0.16, { type: "triangle", vol: 0.12 }); noise(t + d, 0.05, { vol: 0.1, from: 1500, to: 600 }); }); },
};
// level trims, measured offline (AUDIO.md): key moments near -19 LUFS momentary, small ones lower, the UI tick near -40
const TRIM = { ui: 6, click: 4, fly: 3, draw: 3.5, destroy: 2.5, declare: 1.8, clink: 1.6, dice: 1.3, land: 0.6, crit: 0.7, battle: 0.6, lose: 0.7 };
const DUCK = { summon: 0.6, clash: 0.5, life: 0.45, crit: 0.4, destroy: 0.65, win: 0.5, lose: 0.5, battle: 0.7 };
export const Sfx = {
  get on() { return state.on; },
  get vol() { return state.vol; },
  toggle() { state.on = !state.on; lsSet("bot.sound", state.on); if (state.on) { init(); ctx && ctx.resume(); } return state.on; },
  setVolume(v) { state.vol = v; lsSet("bot.volume", v); if (master) master.gain.value = v; },
  play(name, o) {
    if (!state.on || !SOUNDS[name] || !init() || ctx.state !== "running") return;
    pv = name === "ui" || name === "click" ? 1 : 1 + (Math.random() - 0.5) * 0.05; gk = TRIM[name] || 1;
    try { SOUNDS[name](ctx.currentTime + 0.01, o || {}); if (DUCK[name]) duck(DUCK[name]); } catch (e) { /* audio is optional */ }
  },
};
// renders one effect into an offline context (for checking levels); returns nothing, the caller renders
export function renderSfx(c, name, o = {}, vol = state.vol) {
  const keep = [ctx, master, out, duckG, noiseBuf, room]; const C = chain(c, vol);
  ctx = c; master = C.master; out = C.out; duckG = C.duck; noiseBuf = C.noise; room = C.room; pv = 1; gk = TRIM[name] || 1;
  try { SOUNDS[name](0.02, o); } finally { [ctx, master, out, duckG, noiseBuf, room] = keep; }
  return C;
}
export const SFX_NAMES = Object.keys(SOUNDS);
