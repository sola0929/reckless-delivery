# A real place as reference for a level: its roads from OpenStreetMap and its heights from public
# elevation tiles, drawn to scale with the gradients marked, and measured.
#   python dev/realmap.py <name> <south> <west> <north> <east>
# e.g. python dev/realmap.py jiufen 25.1060 121.8405 25.1130 121.8495
# Writes dev/out/realmap-<name>.png and dev/out/realmap-<name>.json (roads in metres, with heights, and a grid of heights).
import io, json, math, os, sys, urllib.request
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

name = sys.argv[1]
south, west, north, east = map(float, sys.argv[2:6])
AGENT = {'User-Agent': 'reckless-delivery-leveldesign/0.1'}
os.makedirs('dev/out/cache', exist_ok=True)

def fetch(url, path):
    if not os.path.exists(path):
        open(path, 'wb').write(urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=90).read())
    return path

# Heights: Terrarium tiles, about 9 m to the pixel here, from roughly 30 m survey data.
Z = 14
def pixel(lat, lon):
    n = 2 ** Z * 256
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
tiles = {}
def height(lat, lon):
    px, py = pixel(lat, lon)
    def at(ix, iy):
        key = (ix // 256, iy // 256)
        if key not in tiles:
            tiles[key] = Image.open(fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{key[0]}/{key[1]}.png', f'dev/out/cache/terr-{Z}-{key[0]}-{key[1]}.png')).convert('RGB').load()
        r, g, b = tiles[key][ix % 256, iy % 256]
        return r * 256 + g + b / 256 - 32768
    ix, iy = math.floor(px - 0.5), math.floor(py - 0.5)
    fx, fy = px - 0.5 - ix, py - 0.5 - iy
    return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy

# Metres east and north of the south-west corner.
KX = 111320 * math.cos(math.radians((south + north) / 2))
KY = 110540
def metres(lat, lon):
    return (lon - west) * KX, (lat - south) * KY
WIDE, TALL = (east - west) * KX, (north - south) * KY

root = ET.parse(fetch(f'https://api.openstreetmap.org/api/0.6/map?bbox={west},{south},{east},{north}', f'dev/out/cache/{name}.osm')).getroot()
nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
DRIVE = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street', 'track',
         'primary_link', 'secondary_link', 'tertiary_link'}
roads = []
uses = {}
for way in root.iter('way'):
    tags = {t.get('k'): t.get('v') for t in way.iter('tag')}
    kind = tags.get('highway')
    if not kind:
        continue
    refs = [nd.get('ref') for nd in way.iter('nd') if nd.get('ref') in nodes]
    pts = []
    for ref in refs:
        lat, lon = nodes[ref]
        x, y = metres(lat, lon)
        pts.append([round(x, 1), round(y, 1), round(height(lat, lon), 1)])
    if len(pts) < 2:
        continue
    drive = kind in DRIVE
    if drive:
        for ref in (refs[0], refs[-1]):
            uses[ref] = uses.get(ref, 0) + 1
        for ref in refs[1:-1]:
            uses[ref] = uses.get(ref, 0) + 2
    roads.append({'kind': kind, 'name': tags.get('name', ''), 'width': tags.get('width', ''), 'lanes': tags.get('lanes', ''), 'oneway': tags.get('oneway', ''), 'drive': drive, 'pts': pts})

def inside(p):
    return 0 <= p[0] <= WIDE and 0 <= p[1] <= TALL

# Where the buildings are: the middle of each. Only to tell built-up stretches of road from open ones.
buildings = []
for way in root.iter('way'):
    if any(t.get('k') == 'building' for t in way.iter('tag')):
        at = [metres(*nodes[nd.get('ref')]) for nd in way.iter('nd') if nd.get('ref') in nodes]
        if at:
            buildings.append([round(sum(p[0] for p in at) / len(at), 1), round(sum(p[1] for p in at) / len(at), 1)])

# Gradient over a stretch of about 25 m: the heights are too coarse for anything shorter to mean much.
def grades(pts):
    out = []
    for n in range(len(pts) - 1):
        a = n
        b = n + 1
        run = math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1])
        while run < 25 and (a > 0 or b < len(pts) - 1):
            if b < len(pts) - 1:
                b += 1
            elif a > 0:
                a -= 1
            run = sum(math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(a, b))
        out.append(abs(pts[b][2] - pts[a][2]) / max(run, 1))
    return out

# Bends: the radius of the circle through each three points in a row, where the road really turns.
def radii(pts):
    out = []
    for n in range(1, len(pts) - 1):
        a, b, c = pts[n - 1], pts[n], pts[n + 1]
        ab, bc, ca = math.hypot(b[0] - a[0], b[1] - a[1]), math.hypot(c[0] - b[0], c[1] - b[1]), math.hypot(c[0] - a[0], c[1] - a[1])
        twice = abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]))
        turn = abs(math.atan2((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])))
        if twice > 1e-6 and turn > 0.35 and inside(b):
            out.append(ab * bc * ca / (2 * twice))
    return out

SCALE = 1.3
img = Image.new('RGB', (int(WIDE * SCALE), int(TALL * SCALE)), (0, 0, 0))
px = img.load()
lo, hi = 1e9, -1e9
field = {}
for j in range(img.height):
    for i in range(img.width):
        h = height(south + (TALL - j / SCALE) / KY, west + (i / SCALE) / KX)
        field[i, j] = h
        lo, hi = min(lo, h), max(hi, h)
for j in range(img.height):
    for i in range(img.width):
        h = field[i, j]
        t = (h - lo) / max(1, hi - lo)
        shade = [int(206 - 70 * t), int(214 - 60 * t), int(190 - 80 * t)]
        # A line every ten metres of height, a heavier one every fifty.
        if i and j and (math.floor(h / 10) != math.floor(field[i - 1, j] / 10) or math.floor(h / 10) != math.floor(field[i, j - 1] / 10)):
            heavy = math.floor(h / 50) != math.floor(field[i - 1, j] / 50) or math.floor(h / 50) != math.floor(field[i, j - 1] / 50)
            shade = [int(c * (0.62 if heavy else 0.82)) for c in shade]
        px[i, j] = tuple(shade)
draw = ImageDraw.Draw(img)
to = lambda p: (p[0] * SCALE, (TALL - p[1]) * SCALE)
THICK = {'primary': 9, 'secondary': 8, 'tertiary': 7, 'unclassified': 5, 'residential': 5, 'living_street': 4, 'service': 3, 'track': 3}
for road in sorted(roads, key=lambda r: r['drive']):
    pts = road['pts']
    if not road['drive']:
        color = (176, 80, 150) if road['kind'] == 'steps' else (120, 110, 100)
        draw.line([to(p) for p in pts], fill=color, width=2 if road['kind'] == 'steps' else 1)
        continue
    g = grades(pts)
    for n in range(len(pts) - 1):
        color = (40, 130, 60) if g[n] < 0.08 else (214, 150, 20) if g[n] < 0.16 else (200, 40, 40)
        draw.line([to(pts[n]), to(pts[n + 1])], fill=color, width=THICK.get(road['kind'].replace('_link', ''), 4))
# Junctions of roads that can be driven, and a scale bar.
junctions = 0
for ref, count in uses.items():
    p = metres(*nodes[ref])
    if count >= 3 and inside(p):
        junctions += 1
        x, y = to(p)
        draw.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(20, 20, 20), width=2)
draw.rectangle([20, img.height - 30, 20 + 100 * SCALE, img.height - 24], fill=(20, 20, 20))
draw.text((20, img.height - 22), '100 m', fill=(20, 20, 20))
draw.text((20, 10), f'{name}: {WIDE:.0f} x {TALL:.0f} m, heights {lo:.0f}-{hi:.0f} m. Roads: green under 8%, amber 8-16%, red over 16%. Purple: steps. Grey: footpaths. Rings: junctions.', fill=(20, 20, 20))
img.save(f'dev/out/realmap-{name}.png')
# The heights again as a coarse grid, rows from the north edge southward, for whatever is built from this.
STEP = 10
grid = [[round(height(south + (TALL - j * STEP) / KY, west + (i * STEP) / KX), 1) for i in range(int(WIDE // STEP) + 2)] for j in range(int(TALL // STEP) + 2)]
json.dump({'name': name, 'size': [round(WIDE), round(TALL)], 'heights': [round(lo), round(hi)], 'grid': {'step': STEP, 'rows': grid}, 'buildings': buildings, 'roads': roads}, io.open(f'dev/out/realmap-{name}.json', 'w', encoding='utf-8'), ensure_ascii=False)

print(f'{name}: {WIDE:.0f} x {TALL:.0f} m, heights {lo:.0f} to {hi:.0f} m, {junctions} junctions of drivable roads, {len(buildings)} buildings')
kinds = {}
for road in roads:
    k = kinds.setdefault(road['kind'], {'length': 0, 'grades': [], 'radii': [], 'widths': set()})
    pts = road['pts']
    g = grades(pts)
    for n in range(len(pts) - 1):
        if inside(pts[n]) and inside(pts[n + 1]):
            run = math.hypot(pts[n + 1][0] - pts[n][0], pts[n + 1][1] - pts[n][1])
            k['length'] += run
            k['grades'] += [g[n]] * max(1, round(run / 5))
    k['radii'] += radii(pts)
    if road['width']:
        k['widths'].add(road['width'])
for kind, k in sorted(kinds.items(), key=lambda kv: -kv[1]['length']):
    if k['length'] < 30:
        continue
    g = sorted(k['grades'])
    r = sorted(k['radii'])
    print(f"  {kind:14} {k['length']:6.0f} m   grade median {g[len(g) // 2] * 100:4.1f}%  steepest tenth {g[int(len(g) * 0.9)] * 100:4.1f}%"
          + (f"   bends: {len(r)}, tightest {r[0]:.0f} m, median {r[len(r) // 2]:.0f} m" if r else '')
          + (f"   widths tagged: {', '.join(sorted(k['widths']))}" if k['widths'] else ''))
