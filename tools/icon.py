#!/usr/bin/env python3
"""sword_raw.png (1024, magenta chroma-key background) -> icon/sword.png (transparent master)
   + RoguSo.ico (256/128/64/48/32/16) + the web build's favicon."""
from PIL import Image
from pathlib import Path

HERE = Path(__file__).parent / 'icon'
raw = Image.open(HERE / 'sword_raw.png').convert('RGBA')
px = raw.load()

W, H = raw.size
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if r > 210 and b > 210 and g < 90:
            px[x, y] = (0, 0, 0, 0)          # the magenta key
        elif r > 190 and b > 190 and g < 140:
            px[x, y] = (r, g, b, 0)          # the antialiased fringe

bbox = raw.getbbox()
img = raw.crop(bbox)
side = max(img.size)
master = Image.new('RGBA', (side, side), (0, 0, 0, 0))
master.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
pad = int(side * 0.06)
final = Image.new('RGBA', (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
final.paste(master, (pad, pad))
final = final.resize((512, 512), Image.LANCZOS)
final.save(HERE / 'sword.png')

sizes = [256, 128, 64, 48, 32, 16]
final.save(HERE / 'RoguSo.ico', sizes=[(s, s) for s in sizes])
print('sword.png + RoguSo.ico written')
