# Kassenfotos (pos/assets/*_version_3.png) als Freisteller fuer die TV-Speisenfolien (tools/tv-speisenfolien.cjs):
# grauer Studiohintergrund, Info-Symbol (oben links) und Namensbalken (unten) werden durchsichtig.
# Benoetigt Python 3 mit pillow, numpy, scipy.
# Mit --ohne-kassenrahmen fuer Fotos ohne Info-Symbol und Namensbalken (z. B. neu gelieferte Fotos, grauer Hintergrund).
# Mit --teller fuer einen flachen weissen Teller auf hellem Grund (Rand kaum vom Hintergrund zu unterscheiden): der Umriss
# wird als Ellipse an die Aussenkante des Tellers angepasst (Teller darf seitlich aus dem Bild ragen).
# Mit --schale fuer eine Schuessel, deren graue Aussenwand dem Hintergrund aehnelt: die Unterkante wird spaltenweise von
# unten gesucht (Kante hell oben / dunkel unten) und in den Umriss aufgenommen.
# Mit --glatt wird der Umriss geglaettet (Ecken der konvexen Huelle werden rund).
# Aufruf: python3 tools/tv-speisenfotos-freistellen.py pos/assets/gruenkohl_version_3.png media/speisen/gruenkohl.webp
#   gruenkohl -> gruenkohl, gruenkohl_wurst -> gruenkohl-mettendchen, sauerkraut -> sauerkraut,
#   sauerkraut_wurst -> sauerkraut-mettendchen, creme_kartoffeln -> kartoffeln-kartoffelcreme, hering_kartoffeln -> kartoffeln-heringsstipp
import sys, numpy as np
from PIL import Image, ImageFilter
args = [x for x in sys.argv[1:] if not x.startswith('--')]
kassenrahmen = '--ohne-kassenrahmen' not in sys.argv
src, dst = args[0], args[1]
img = Image.open(src).convert('RGB')
if kassenrahmen: img = img.crop((0, 0, 1254, 1010))   # Namensbalken (ab y=1014) weg
if '--teller' in sys.argv:  # ragt der Teller aus dem Bild, Rand um 40 px fortsetzen, damit der Umriss rund schliesst
    img = Image.fromarray(np.pad(np.asarray(img), ((40, 40), (40, 40), (0, 0)), mode='edge'))
a = np.asarray(img).astype(np.float64); H, W, _ = a.shape
yy, xx = np.mgrid[0:H, 0:W]
icon = ((xx - 107) ** 2 + (yy - 107) ** 2 <= 94 ** 2) if kassenrahmen else np.zeros((H, W), bool)
# Hintergrund-Modell: quadratische Flaeche aus dem Randstreifen (ohne Symbol)
rand = np.zeros((H, W), bool); rand[:24] = rand[:, :24] = rand[:, -24:] = True; rand[-8:] = True; rand &= ~icon
if not kassenrahmen:  # neu gelieferte Fotos: Randstreifen ohne Ausreisser (Schatten am Bildrand, angeschnittene Schuessel)
    hel = a.mean(2); rand &= np.abs(hel - np.median(hel[rand])) < 20
X = np.stack([np.ones(H * W), xx.ravel(), yy.ravel(), xx.ravel() ** 2, yy.ravel() ** 2, (xx * yy).ravel()], 1) / np.array([1, W, H, W * W, H * H, W * H])
hg = np.zeros_like(a)
for c in range(3):
    k, *_ = np.linalg.lstsq(X[rand.ravel()], a[..., c].ravel()[rand.ravel()], rcond=None)
    hg[..., c] = (X @ k).reshape(H, W)
d = a - hg
farbe = np.sqrt(((d - d.mean(2, keepdims=True)) ** 2).sum(2))   # Farbabweichung (Gericht)
hell = d.mean(2)                                                 # heller als Hintergrund (Schuesselrand) / dunkler (Schatten)
vorder = np.clip((np.maximum(farbe * 1.4, hell) - 10) / 14, 0, 1)
def teller_alpha(L):
    # Ellipse (allgemeiner Kegelschnitt A x^2 + B xy + C y^2 + D x + E y = 1) schrittweise an die staerkste
    # Hell-innen/dunkel-aussen-Kante entlang von 360 Strahlen anpassen
    H, W = L.shape
    cx, cy, ra, rb = W / 2, H * 0.44, W * 0.5, H * 0.39
    k = np.array([1 / ra ** 2, 0, 1 / rb ** 2, 0, 0]); f = 1 - (cx / ra) ** 2 - (cy / rb) ** 2
    k = np.array([k[0], 0, k[2], -2 * cx / ra ** 2, -2 * cy / rb ** 2]) / f
    for fenster in (90, 60, 35, 35, 35):
        A, B, C, D, E = k
        c = np.linalg.solve([[2 * A, B], [B, 2 * C]], [-D, -E]); pkt = []
        for t in np.linspace(0, 2 * np.pi, 360, endpoint=False):
            dx, dy = np.cos(t), np.sin(t); x0, y0 = c
            a2 = A * dx * dx + B * dx * dy + C * dy * dy
            a1 = 2 * A * x0 * dx + B * (x0 * dy + y0 * dx) + 2 * C * y0 * dy + D * dx + E * dy
            a0 = A * x0 * x0 + B * x0 * y0 + C * y0 * y0 + D * x0 + E * y0 - 1
            w = np.sqrt(a1 * a1 - 4 * a2 * a0); r = max((-a1 + w) / (2 * a2), (-a1 - w) / (2 * a2))
            best, staerke = None, 6
            for rr in np.arange(r - fenster, r + fenster):
                x1, y1 = np.round(c + (rr - 3) * np.array([dx, dy])).astype(int)
                x2, y2 = np.round(c + (rr + 3) * np.array([dx, dy])).astype(int)
                if not (0 <= x1 < W and 0 <= y1 < H and 0 <= x2 < W and 0 <= y2 < H): continue
                if L[y1, x1] - L[y2, x2] > staerke: staerke, best = L[y1, x1] - L[y2, x2], c + rr * np.array([dx, dy])
            if best is not None: pkt.append(best)
        P = np.array(pkt); x, y = P.T
        k, *_ = np.linalg.lstsq(np.stack([x * x, x * y, y * y, x, y], 1), np.ones(len(x)), rcond=None)
    v = k[0] * xx * xx + k[1] * xx * yy + k[2] * yy * yy + k[3] * xx + k[4] * yy - 1
    c = np.linalg.solve([[2 * k[0], k[1]], [k[1], 2 * k[2]]], [-k[3], -k[4]]).round().astype(int)
    innen = np.sign(v) == np.sign(v[min(max(c[1], 0), H - 1), min(max(c[0], 0), W - 1)])   # gleiche Seite wie die Tellermitte
    m = Image.fromarray((innen * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    return np.asarray(m).astype(np.float64) / 255

# nur das Gericht behalten: groesste zusammenhaengende Flaeche (Schuessel/Teller), Loecher darin gefuellt.
# Kein Schatten, keine Reste vom Info-Symbol oder von Helligkeitsverlaeufen in den Ecken.
from scipy import ndimage
if '--teller' in sys.argv:
    alpha = teller_alpha(np.asarray(img.convert('L').filter(ImageFilter.GaussianBlur(1.5))).astype(np.float64))
else:
  hart = vorder > 0.5
  if kassenrahmen: hart[(xx - 107) ** 2 + (yy - 107) ** 2 <= 101 ** 2] = False
  hart = ndimage.binary_opening(hart, iterations=3)
  lab, n = ndimage.label(hart)
  groesse = ndimage.sum(hart, lab, range(1, n + 1))
  kern = lab == (1 + int(np.argmax(groesse)))
  if '--schale' in sys.argv:
      Lb = np.asarray(img.convert('L').filter(ImageFilter.GaussianBlur(2))).astype(np.float64)
      spalten = np.where(kern.any(0))[0]
      for x in range(spalten.min(), spalten.max() + 1, 4):
          oben = np.argmax(kern[:, x]) if kern[:, x].any() else H
          for y in range(H - 20, oben, -1):
              if Lb[y - 4, x] - Lb[y + 4, x] > 10: kern[oben:y, x] = True; break
  # Schuessel und Teller sind von aussen konvex: Umriss = konvexe Huelle (schliesst graue Randstellen, die dem Hintergrund aehneln)
  from scipy.spatial import ConvexHull
  from PIL import ImageDraw
  pkt = np.argwhere(kern)[:, ::-1]
  huelle = pkt[ConvexHull(pkt).vertices]
  m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(map(float, q)) for q in huelle], fill=255)
  if '--glatt' in sys.argv:  # Ecken runden: stark weichzeichnen, wieder scharf schneiden
      m = m.filter(ImageFilter.GaussianBlur(18)).point(lambda v: 255 if v >= 128 else 0)
  alpha = np.asarray(m.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float64) / 255
rgb = a
A = Image.fromarray((alpha * 255).astype(np.uint8))
out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA'); out.putalpha(A)
box = out.getbbox(); out = out.crop(box)
out.thumbnail((900, 900), Image.LANCZOS)
out.save(dst, 'WEBP', quality=88, method=6)
print(dst, out.size)
