"""Build the UI font from the approved original: python dev/ui-assets/subset-font.py path/to/NotoSansTC.ttf"""
from pathlib import Path
from fontTools import subset
import sys

root = Path(__file__).resolve().parents[2]
text = (root / 'index.html').read_text(encoding='utf-8')
for path in (root / 'src').rglob('*'):
    if path.suffix in ('.ts', '.css'):
        text += path.read_text(encoding='utf-8')
options = subset.Options()
options.flavor = 'woff'
options.name_IDs = ['*']
font = subset.load_font(sys.argv[1], options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text + ''.join(chr(i) for i in range(32, 127)))
subsetter.subset(font)
output = root / 'public/ui/fonts/NotoSansTC-ui.woff'
subset.save_font(font, str(output), options)
print(f'{output.name}: {output.stat().st_size:,} bytes')
