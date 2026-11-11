# Mix the baked light passes into the table's light map: light = A * candles + B * key, stored as sRGB(light / LMAX) in a JPEG.
# Also writes a top-down preview of the wood under that light. Usage: python3 lm8.py A B [LMAX]
import numpy as np, sys
from PIL import Image, ImageFilter
A, B = float(sys.argv[1]), float(sys.argv[2]); LMAX = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
c = np.load("lightmap_candles.npy"); k = np.load("lightmap_key.npy")
L = A * c + B * k                                  # rows run bottom-up (Blender): row 0 is the near edge of the table
H, W = L.shape[:2]
def at(x, z):  # three (x, z) on the 70 x 50 table centred at z = -2
    return float(L[int((-z + 23) / 50 * (H - 1)), int((x + 35) / 70 * (W - 1))].mean())
for x, z in [(0, 6.5), (0, 9), (9, 0), (12, 0), (0, -7.5), (0, -12), (-4.6, -7.6), (-4.6, -9.8), (-9.4, -3.6), (20, -10), (25, 5)]:
    print("light at", (x, z), round(at(x, z), 3))
enc = lambda v: np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(np.clip(v, 0, None), 1 / 2.4) - 0.055)
s = enc(np.clip(L / LMAX, 0, 1))
im = Image.fromarray((s[::-1] * 255 + 0.5).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
im.save("table-light.jpg", quality=92, optimize=True); print("light map", im.size)
# preview: the wood tile repeated as in the game, multiplied by the light, a 1024 px wide top view
wood = np.asarray(Image.open("wood.png").convert("RGB"), dtype=np.float32) / 255
dec = lambda v: np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
wl = dec(wood); PW, PH = 1024, 732
u = (np.arange(PW) + 0.5) / PW * (70 / 12); v = (np.arange(PH) + 0.5) / PH * (50 / 12)
tile = wl[((v[:, None] % 1) * wl.shape[0]).astype(int), ((u[None, :] % 1) * wl.shape[1]).astype(int)]
lm = np.asarray(im.resize((PW, PH), Image.BILINEAR), dtype=np.float32) / 255
lit = tile * dec(lm) * LMAX
# a filmic-ish curve close to the game's ACES tone mapping at exposure 0.92
x = lit * 0.92; t = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
Image.fromarray((enc(np.clip(t, 0, 1)) * 255).astype(np.uint8)).save("preview.png"); print("preview saved")
