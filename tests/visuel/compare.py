# Compare deux dossiers de captures pixel par pixel
import sys, os
from PIL import Image, ImageChops
a, b = sys.argv[1], sys.argv[2]
ok = True
for f in sorted(os.listdir(a)):
    pa, pb = os.path.join(a, f), os.path.join(b, f)
    if not os.path.exists(pb): print('MANQUANT', f); ok = False; continue
    ia, ib = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
    if ia.size != ib.size: print(f'TAILLE  {f}: {ia.size} -> {ib.size}'); ok = False; continue
    d = ImageChops.difference(ia, ib); bb = d.getbbox()
    if bb:
        n = sum(1 for px in d.get_flattened_data() if max(px) > 16) if hasattr(d,'get_flattened_data') else sum(1 for px in d.getdata() if max(px) > 16)
        if n: print(f'DIFF    {f}: zone {bb}, {n} px'); ok = False
print('IDENTIQUE' if ok else 'DIFFÉRENCES')
