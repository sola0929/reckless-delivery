# A numbered sheet of the promotional candidates for one level. python dev/promo-sheet.py <level>
import re, sys, os
from PIL import Image, ImageDraw, ImageFont
level = sys.argv[1]
d = 'dev/out/promo'
files = sorted([f for f in os.listdir(d) if re.fullmatch(level + r'-\d+\.png', f)], key=lambda f: int(f[len(level) + 1:-4]))
W, H = 480, 270
sheet = Image.new('RGB', (W * 3, H * ((len(files) + 2) // 3)), '#111')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('arialbd.ttf', 28)
for n, f in enumerate(files):
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((W, H), Image.LANCZOS)
    x, y = (n % 3) * W, (n // 3) * H
    sheet.paste(im, (x, y))
    draw.text((x + 8, y + 4), f[len(level) + 1:-4], fill='yellow', font=font, stroke_width=2, stroke_fill='black')
sheet.save(os.path.join(d, f'sheet-{level}.png'))
