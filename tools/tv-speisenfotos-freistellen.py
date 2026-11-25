# Kassenfotos (pos/assets/*_version_3.png) als Freisteller fuer die TV-Speisenfolien (tools/tv-speisenfolien.cjs):
# grauer Studiohintergrund, Info-Symbol (oben links) und Namensbalken (unten) werden durchsichtig.
# Benoetigt Python 3 mit pillow, numpy, scipy.
# Aufruf: python3 tools/tv-speisenfotos-freistellen.py pos/assets/gruenkohl_version_3.png media/speisen/gruenkohl.webp
#   gruenkohl -> gruenkohl, gruenkohl_wurst -> gruenkohl-mettendchen, sauerkraut -> sauerkraut,
#   sauerkraut_wurst -> sauerkraut-mettendchen, creme_kartoffeln -> kartoffeln-kartoffelcreme, hering_kartoffeln -> kartoffeln-heringsstipp
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB').crop((0, 0, 1254, 1010))
a = np.asarray(img).astype(np.float64); H, W, _ = a.shape
yy, xx = np.mgrid[0:H, 0:W]
icon = (xx - 107) ** 2 + (yy - 107) ** 2 <= 94 ** 2
# Hintergrund-Modell: quadratische Flaeche aus dem Randstreifen (ohne Symbol)
rand = np.zeros((H, W), bool); rand[:24] = rand[:, :24] = rand[:, -24:] = True; rand[-8:] = True; rand &= ~icon
X = np.stack([np.ones(H * W), xx.ravel(), yy.ravel(), xx.ravel() ** 2, yy.ravel() ** 2, (xx * yy).ravel()], 1) / np.array([1, W, H, W * W, H * H, W * H])
hg = np.zeros_like(a)
for c in range(3):
    k, *_ = np.linalg.lstsq(X[rand.ravel()], a[..., c].ravel()[rand.ravel()], rcond=None)
    hg[..., c] = (X @ k).reshape(H, W)
d = a - hg
farbe = np.sqrt(((d - d.mean(2, keepdims=True)) ** 2).sum(2))   # Farbabweichung (Gericht)
hell = d.mean(2)                                                 # heller als Hintergrund (Schuesselrand) / dunkler (Schatten)
vorder = np.clip((np.maximum(farbe * 1.4, hell) - 10) / 14, 0, 1)
# nur das Gericht behalten: groesste zusammenhaengende Flaeche (Schuessel/Teller), Loecher darin gefuellt.
# Kein Schatten, keine Reste vom Info-Symbol oder von Helligkeitsverlaeufen in den Ecken.
from scipy import ndimage
hart = vorder > 0.5
hart[(xx - 107) ** 2 + (yy - 107) ** 2 <= 101 ** 2] = False
hart = ndimage.binary_opening(hart, iterations=3)
lab, n = ndimage.label(hart)
groesse = ndimage.sum(hart, lab, range(1, n + 1))
kern = lab == (1 + int(np.argmax(groesse)))
# Schuessel und Teller sind von aussen konvex: Umriss = konvexe Huelle (schliesst graue Randstellen, die dem Hintergrund aehneln)
from scipy.spatial import ConvexHull
from PIL import ImageDraw
pkt = np.argwhere(kern)[:, ::-1]
huelle = pkt[ConvexHull(pkt).vertices]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(map(float, q)) for q in huelle], fill=255)
alpha = np.asarray(m.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float64) / 255
rgb = a
A = Image.fromarray((alpha * 255).astype(np.uint8))
out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA'); out.putalpha(A)
box = out.getbbox(); out = out.crop(box)
out.thumbnail((900, 900), Image.LANCZOS)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size)
