# Legt Vorschau (links) und Entwurf (rechts) nebeneinander, mit Beschriftung. Aufruf: python3 -I vergleich.py <aus.jpg> <vorschau.jpg> <entwurf.jpg>
import sys
from PIL import Image, ImageDraw
out, a, b = sys.argv[1:4]
A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
h = max(A.height, B.height); pad = 56
m = Image.new('RGB', (A.width + B.width + 24, h + pad), (245, 245, 247))
m.paste(A, (0, pad)); m.paste(B, (A.width + 24, pad))
d = ImageDraw.Draw(m)
try:
    from PIL import ImageFont
    f = ImageFont.load_default(size=30)
except Exception:
    f = None
d.text((16, 12), 'Vorschau (abgenommen)', fill=(40, 40, 48), font=f)
d.text((A.width + 40, 12), 'Vorschlag VB', fill=(80, 70, 200), font=f)
m.save(out, quality=80)
