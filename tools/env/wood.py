# seamless teak tile: anisotropic FFT noise (periodic by construction), planks running along v, butt joints, pores, oiled finish tones
import numpy as np, sys
from PIL import Image
N = int(sys.argv[1]) if len(sys.argv) > 1 else 1024; out = sys.argv[2] if len(sys.argv) > 2 else "wood.png"
rng = np.random.default_rng(11)
fx = np.fft.fftfreq(N)[None, :] * N; fy = np.fft.fftfreq(N)[:, None] * N   # cycles per tile (u across, v along)
def aniso(su, sv, power, seed, cut=40):
    r = np.random.default_rng(seed); w = r.standard_normal((N, N))
    k = np.sqrt((fx / su) ** 2 + (fy / sv) ** 2) + 1e-6
    amp = k ** (-power) * np.exp(-(k / cut) ** 2); amp[0, 0] = 0
    f = np.real(np.fft.ifft2(np.fft.fft2(w) * amp)); return (f - f.mean()) / f.std()
PL = 3                                    # planks per tile
u = (np.arange(N)[None, :] + 0.5) / N; v = (np.arange(N)[:, None] + 0.5) / N
p = np.floor(u * PL).astype(int) % PL; lu = u * PL - np.floor(u * PL)          # plank index, position across the plank
tone = np.array([1.0, 0.86, 1.1]); hue = np.array([0.0, 0.03, -0.02]); joint = np.array([0.27, 0.71, 0.49])
shift = np.array([0.0, 0.37, 0.61])
# grain: long streaks along v; each plank its own slice of noise (shift along v) so neighbours never line up
g1 = aniso(1.0, 0.02, 0.9, 1, 260); g2 = aniso(1.0, 0.06, 1.1, 2, 60); g3 = aniso(0.25, 0.25, 1.4, 3); g4 = aniso(1.0, 0.015, 0.7, 5, 400)
def roll_rows(a):
    out = np.empty_like(a)
    for k in range(PL):
        cols = slice(k * N // PL, (k + 1) * N // PL); out[:, cols] = np.roll(a[:, cols], int(shift[k] * N), axis=0)
    return out
g1, g2, g4 = roll_rows(g1), roll_rows(g2), roll_rows(g4)
# growth rings show as soft bands that drift across the plank
ring = np.sin((lu * 5 + 0.35 * g3 + 0.12 * g2) * np.pi * 2) * 0.5 + 0.5
grain = 0.45 * g1 + 0.35 * g2 + 0.18 * (ring - 0.5) + 0.25 * g4
streak = np.clip((aniso(1.0, 0.01, 0.8, 6, 120) - 1.8) * 0.4, 0, 0.3)
pores = (aniso(1.0, 0.012, 0.6, 4) > 2.1) * 1.0
t = np.clip(0.5 + 0.22 * grain, 0, 1)
# teak, oiled and darkened by age: honey brown to a deep red-brown (linear-ish values, sRGB written below)
dark = np.array([0.16, 0.085, 0.045]); light = np.array([0.40, 0.235, 0.125])
col = dark[None, None, :] * (1 - t[..., None]) + light[None, None, :] * t[..., None]
col *= tone[p][..., None] * (1 + hue[p][..., None] * np.array([1, -0.5, -1]))
col *= (1 - 0.3 * pores[..., None]) * (1 - streak[..., None])
# a hairline gap between planks and one butt joint per plank, both slightly bevelled
edge = np.minimum(lu, 1 - lu) * (N / PL)        # pixels from the plank edge
col *= np.clip(edge / 2.0, 0.35, 1)[..., None] ** 0.5
dj = np.abs(((v - joint[p] + 0.5) % 1) - 0.5) * N
col *= np.clip(dj / 2.2, 0.3, 1)[..., None] ** 0.6
# each plank drifts a little lighter and darker along its length
ph = np.array([0.1, 0.55, 0.8]); col *= (1 + 0.07 * np.sin((v + ph[p]) * np.pi * 2))[..., None]
# light wear in the middle of each plank
col *= (0.94 + 0.08 * np.sin(lu * np.pi))[..., None]
img = np.clip(col, 0, 1) ** (1 / 1.0)
Image.fromarray((img * 255).astype(np.uint8)).save(out)
print("saved", out, img.mean(axis=(0, 1)))
