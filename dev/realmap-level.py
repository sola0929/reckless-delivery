# A real place's roads and heights (from dev/realmap.py) turned into data a level can be built from:
# the roads that can be driven as a network of stretches between junctions, each with a climb fitted
# within what its kind of road may climb, stopping short of each junction to leave room for it; which
# stretches are built up; the land as a grid; and a way through.
#   python dev/realmap-level.py <name> [vertical scale]
# Reads dev/out/realmap-<name>.json, writes src/levels/<name>-data.ts.
import io, json, math, sys, heapq

name = sys.argv[1]
V = float(sys.argv[2]) if len(sys.argv) > 2 else 0.7
MARGIN = 18          # roads stop this far inside the edge of the map
LEVEL = 14           # a road is level for at least this far from a junction
SHORT = 22           # junctions closer together than this are one junction
MAIN = {'primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link', 'unclassified', 'residential'}
LANE = {'service', 'living_street'}
WIDTH = {'main': 11, 'lane': 7.5}
ROUND = {'main': 14, 'lane': 9}
TOLERANCE = {'main': 1.5, 'lane': 2.5}
GRADE = {'main': 0.10, 'lane': 0.14}   # the most each may climb, rise over run
STEP = 4             # the climb is worked out at points this far apart
SMOOTH = 60          # and follows the ground averaged over this length
BUILT = 38           # a stretch is built up where a real building is within this of it

data = json.load(io.open(f'dev/out/realmap-{name}.json', encoding='utf-8'))
W, T = data['size']
rows = data['grid']['rows']
GRID = data['grid']['step']
low = min(min(r) for r in rows)
dist = lambda a, b: math.hypot(b[0] - a[0], b[1] - a[1])
length = lambda pts: sum(dist(pts[n], pts[n + 1]) for n in range(len(pts) - 1))

# Into the level's own frame: X east, Z south from the north edge (so that the map is not mirrored), heights from the lowest ground, scaled.
def own(p):
    return [p[0], T - p[1], (p[2] - low) * V]
buildings = [[b[0], T - b[1]] for b in data['buildings']]

def land(x, z):
    fx = max(0, min(len(rows[0]) - 1.001, x / GRID))
    fz = max(0, min(len(rows) - 1.001, z / GRID))
    i, j = int(fx), int(fz)
    tx, tz = fx - i, fz - j
    return (((rows[j][i] * (1 - tx) + rows[j][i + 1] * tx) * (1 - tz) + (rows[j + 1][i] * (1 - tx) + rows[j + 1][i + 1] * tx) * tz) - low) * V

def inside(p):
    return MARGIN <= p[0] <= W - MARGIN and MARGIN <= p[1] <= T - MARGIN

def clipped(pts):
    """The parts of a line that are within the map, cut where it crosses the edge."""
    runs, run = [], []
    for n, p in enumerate(pts):
        if n:
            q = pts[n - 1]
            if inside(p) != inside(q):
                # Where it crosses: by halving.
                a, b = (q, p) if inside(q) else (p, q)
                for _ in range(20):
                    m = [(a[k] + b[k]) / 2 for k in range(3)]
                    a, b = (m, b) if inside(m) else (a, m)
                run.append(a)
                if inside(q):
                    runs.append(run)
                    run = []
        if inside(p):
            run.append(p)
    runs.append(run)
    return [r for r in runs if len(r) >= 2]

key = lambda p: (round(p[0], 1), round(p[1], 1))
runs = []
for road in data['roads']:
    cls = 'main' if road['kind'] in MAIN else 'lane' if road['kind'] in LANE else None
    if cls:
        for run in clipped([own(p) for p in road['pts']]):
            runs.append((cls, run))

# Where roads meet: a point at the end of one, or on more than one, or twice on the same.
seen, ends = {}, set()
for cls, run in runs:
    for n, p in enumerate(run):
        seen[key(p)] = seen.get(key(p), 0) + 1
    ends.add(key(run[0]))
    ends.add(key(run[-1]))
is_node = lambda p: key(p) in ends or seen[key(p)] >= 2
stretches = []
for cls, run in runs:
    part = [run[0]]
    for p in run[1:]:
        part.append(p)
        if is_node(p):
            stretches.append({'cls': cls, 'pts': part})
            part = [p]

# Junctions close together become one, at the middle of them.
parent = {}
def find(k):
    parent.setdefault(k, k)
    while parent[k] != k:
        parent[k] = parent[parent[k]]
        k = parent[k]
    return k
for s in stretches:
    a, b = key(s['pts'][0]), key(s['pts'][-1])
    if a != b and length(s['pts']) < SHORT:
        parent[find(a)] = find(b)
members = {}
for s in stretches:
    for p in (s['pts'][0], s['pts'][-1]):
        members.setdefault(find(key(p)), {})[key(p)] = p
place = {root: [sum(p[k] for p in ps.values()) / len(ps) for k in range(3)] for root, ps in members.items()}
kept = []
for s in stretches:
    a, b = find(key(s['pts'][0])), find(key(s['pts'][-1]))
    if a == b and length(s['pts']) < SHORT * 2:
        continue
    s['a'], s['b'] = a, b
    s['pts'] = [place[a]] + s['pts'][1:-1] + [place[b]]
    kept.append(s)
stretches = kept

# Two carriageways of one road between the same two junctions: one is enough.
kept = []
for s in stretches:
    mid = s['pts'][len(s['pts']) // 2]
    twin = any({s['a'], s['b']} == {o['a'], o['b']} and s['a'] != s['b'] and dist(mid, o['pts'][len(o['pts']) // 2]) < 18 for o in kept)
    if not twin:
        kept.append(s)
stretches = kept

def degrees():
    d = {}
    for s in stretches:
        d[s['a']] = d.get(s['a'], 0) + 1
        d[s['b']] = d.get(s['b'], 0) + 1
    return d

# Lanes that lead nowhere go, and then whatever that leaves leading nowhere.
while True:
    d = degrees()
    dead = [s for s in stretches if s['cls'] == 'lane' and (d[s['a']] == 1 or d[s['b']] == 1)]
    if not dead:
        break
    stretches = [s for s in stretches if s not in dead]

# Two stretches of the same kind meeting with nothing else there are one stretch.
while True:
    d = degrees()
    joined = False
    for node, count in d.items():
        if count != 2:
            continue
        pair = [s for s in stretches if node in (s['a'], s['b'])]
        if len(pair) != 2 or pair[0]['cls'] != pair[1]['cls'] or pair[0]['a'] == pair[0]['b'] or pair[1]['a'] == pair[1]['b']:
            continue
        p, q = pair
        first = p['pts'] if p['b'] == node else p['pts'][::-1]
        second = q['pts'] if q['a'] == node else q['pts'][::-1]
        one = {'cls': p['cls'], 'pts': first + second[1:], 'a': p['a'] if p['b'] == node else p['b'], 'b': q['b'] if q['a'] == node else q['a']}
        stretches = [s for s in stretches if s is not p and s is not q] + [one]
        joined = True
        break
    if not joined:
        break

def simplify(pts, tolerance):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    span = dist(a, b)
    worst, at = 0, 0
    for n in range(1, len(pts) - 1):
        off = abs((b[0] - a[0]) * (pts[n][1] - a[1]) - (b[1] - a[1]) * (pts[n][0] - a[0])) / span if span > 1e-6 else dist(a, pts[n])
        if off > worst:
            worst, at = off, n
    if worst <= tolerance:
        return [a, b]
    return simplify(pts[:at + 1], tolerance)[:-1] + simplify(pts[at:], tolerance)

d = degrees()
nodes = sorted(k for k in d)
junctions = [k for k in nodes if d[k] >= 2]
jindex = {k: n for n, k in enumerate(junctions)}
# The height of each junction: the land's, there.
for k in nodes:
    place[k][2] = land(place[k][0], place[k][1])

# Each stretch as a line, with how far along each of its points is.
for s in stretches:
    pts = simplify(s['pts'], TOLERANCE[s['cls']])
    if s['a'] == s['b'] and len(pts) < 4:
        pts = s['pts']
    s['line'] = pts
    s['along'] = [0]
    for n in range(1, len(pts)):
        s['along'].append(s['along'][-1] + dist(pts[n - 1], pts[n]))
    s['L'] = s['along'][-1]

def at_length(s, at):
    pts, along = s['line'], s['along']
    for n in range(1, len(pts)):
        if at <= along[n] or n == len(pts) - 1:
            t = (at - along[n - 1]) / max(1e-6, along[n] - along[n - 1])
            return [pts[n - 1][0] + (pts[n][0] - pts[n - 1][0]) * t, pts[n - 1][1] + (pts[n][1] - pts[n - 1][1]) * t]

# How far short of each junction each road stops: far enough that its edges are clear of its neighbours' there.
for s in stretches:
    s['stop'] = [0, 0]
for k in junctions:
    arms = []
    for s in stretches:
        for end in (0, 1):
            if (s['a'], s['b'])[end] != k:
                continue
            out = at_length(s, min(8, s['L'] / 2)) if end == 0 else at_length(s, max(s['L'] - 8, s['L'] / 2))
            arms.append({'s': s, 'end': end, 'angle': math.atan2(out[1] - place[k][1], out[0] - place[k][0]), 'half': WIDTH[s['cls']] / 2})
    arms.sort(key=lambda a: a['angle'])
    for n, arm in enumerate(arms):
        need = arm['half']
        for other in (arms[n - 1], arms[(n + 1) % len(arms)]):
            if other is arm:
                continue
            gap = abs(other['angle'] - arm['angle'])
            gap = min(gap, 2 * math.pi - gap)
            if 0.05 < gap < math.pi - 0.05:
                need = max(need, (other['half'] + arm['half'] * math.cos(gap)) / math.sin(gap))
        s = arm['s']
        s['stop'][arm['end']] = max(4, min(need + 1.5, 24, s['L'] * 0.4))

def fit(sm, lo_band, hi_band, G, step):
    """The climb closest to the smoothed ground that stays in its band and never climbs more than G: by halving the most it may stray."""
    n = len(sm)
    def attempt(eps):
        r_lo, r_hi = [0] * n, [0] * n
        for i in range(n):
            lo, hi = max(lo_band[i], sm[i] - eps), min(hi_band[i], sm[i] + eps)
            if i:
                lo, hi = max(lo, r_lo[i - 1] - G * step), min(hi, r_hi[i - 1] + G * step)
            if lo > hi + 1e-9:
                return None
            r_lo[i], r_hi[i] = lo, max(lo, hi)
        out = [0] * n
        out[-1] = min(r_hi[-1], max(r_lo[-1], sm[-1]))
        for i in range(n - 2, -1, -1):
            out[i] = min(min(r_hi[i], out[i + 1] + G * step), max(max(r_lo[i], out[i + 1] - G * step), sm[i]))
        return out
    values = sm + [v for v in lo_band + hi_band if abs(v) < 1e8]
    lo, hi = 0, max(values) - min(values) + 10
    while hi - lo > 0.05:
        mid = (lo + hi) / 2
        if attempt(mid):
            hi = mid
        else:
            lo = mid
    return attempt(hi)

roads = []
eased = 0
for s in stretches:
    L, cls = s['L'], s['cls']
    pins = [place[s['a']][2] if d[s['a']] >= 2 else None, place[s['b']][2] if d[s['b']] >= 2 else None]
    level = [min(max(LEVEL, s['stop'][e] + 3), L * 0.45) if pins[e] is not None else 0 for e in (0, 1)]
    n = max(2, math.ceil(L / STEP) + 1)
    step = L / (n - 1)
    at = [i * step for i in range(n)]
    ground = [land(*at_length(s, a)) for a in at]
    # The ground averaged along the road, the stretch averaged over narrowing toward each end.
    sm = []
    for i in range(n):
        k = int(min(SMOOTH / 2, at[i], L - at[i]) / step)
        sm.append(sum(ground[i - k:i + k + 1]) / (2 * k + 1))
    # What it may climb: its kind's limit, or, where two junctions are further apart in height than that reaches, what joining them takes.
    G = GRADE[cls]
    if pins[0] is not None and pins[1] is not None:
        run = max(1, L - level[0] - level[1])
        if abs(pins[1] - pins[0]) > G * run * 0.98:
            G = abs(pins[1] - pins[0]) / run * 1.03
            eased += 1
    lo_band, hi_band = [-1e9] * n, [1e9] * n
    for i in range(n):
        if pins[0] is not None:
            off = max(0, at[i] - level[0])
            lo_band[i], hi_band[i] = max(lo_band[i], pins[0] - G * off), min(hi_band[i], pins[0] + G * off)
        if pins[1] is not None:
            off = max(0, L - at[i] - level[1])
            lo_band[i], hi_band[i] = max(lo_band[i], pins[1] - G * off), min(hi_band[i], pins[1] + G * off)
    h = fit(sm, lo_band, hi_band, G, step)
    def climb(a):
        f = max(0, min(n - 1.0001, a / step))
        i = int(f)
        return h[i] * (1 - (f - i)) + h[i + 1] * (f - i)

    # Which of its legs are built up: those with a real building near the middle of them.
    line, along = s['line'], s['along']
    town = []
    for i in range(len(line) - 1):
        mids = [at_length(s, along[i] + (along[i + 1] - along[i]) * t) for t in (0.25, 0.5, 0.75)]
        town.append(any(dist(m, b) < BUILT for m in mids for b in buildings))
    # Short runs either way are taken into what is round them.
    def runs_of(flags):
        out, i = [], 0
        while i < len(flags):
            j = i
            while j < len(flags) and flags[j] == flags[i]:
                j += 1
            out.append((i, j, flags[i], along[j] - along[i]))
            i = j
        return out
    for least, kind in ((35, False), (60, True)):
        for i, j, flag, run in runs_of(town):
            if flag == kind and run < least and not (i == 0 and j == len(town)):
                for k in range(i, j):
                    town[k] = not kind

    # Its points: the corners of its line, where the level ground at each junction ends, and some between on long straights.
    marks = []
    for i, p in enumerate(line):
        turn = 0
        if 0 < i < len(line) - 1:
            a, b = line[i - 1], line[i + 1]
            turn = abs(math.atan2((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]), (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1])))
        marks.append([along[i], ROUND[cls] if turn > 0.12 else 0, False])
    extra = [level[e] if e == 0 else L - level[e] for e in (0, 1) if level[e]]
    for i in range(len(line) - 1):
        leg = along[i + 1] - along[i]
        if leg > 44:
            count = int((leg - 28) // 16) + 1
            extra += [along[i] + 14 + (leg - 28) * k / max(1, count - 1) if count > 1 else along[i] + leg / 2 for k in range(count)]
    # Where it changes between built up and open: at the middle of the first leg of the other kind.
    splits = [(along[i] + along[i + 1]) / 2 for i in range(1, len(town)) if town[i] != town[i - 1]]
    for a in extra:
        if all(abs(a - m[0]) > 3 for m in marks):
            marks.append([a, 0, False])
    for a in splits:
        marks = [m for m in marks if abs(a - m[0]) > 1.5 or m[1]]
        marks.append([a, 0, True])
    marks.sort(key=lambda m: m[0])
    # It starts and ends where it stops short of its junctions.
    start, end = s['stop'][0], L - s['stop'][1]
    marks = [[start, 0, False]] + [m for m in marks if start + 2 < m[0] < end - 2] + [[end, 0, False]]
    piece, built = [], town[0]
    ends = [jindex.get(s['a'], -1), jindex.get(s['b'], -1)]
    first = ends[0]
    for a, rnd, split in marks:
        piece.append(at_length(s, a) + [climb(a), rnd])
        if split:
            roads.append({'cls': cls, 'town': built, 'a': first, 'b': -1, 'pts': piece})
            piece, built, first = [piece[-1]], not built, -1
    roads.append({'cls': cls, 'town': built, 'a': first, 'b': ends[1], 'pts': piece})
    s['made'] = [at_length(s, a) for a, _, _ in marks]

# The way through: from the lowest end of a main road to the highest, by main roads where it can.
index = {k: n for n, k in enumerate(nodes)}
main_ends = [k for k in nodes if d[k] == 1 and any(s['cls'] == 'main' and k in (s['a'], s['b']) for s in stretches)]
start = min(main_ends, key=lambda k: place[k][2])
goal = max(main_ends, key=lambda k: place[k][2])
best = {start: (0, None, None)}
heap = [(0, index[start])]
while heap:
    cost, n = heapq.heappop(heap)
    node = nodes[n]
    if cost > best[node][0]:
        continue
    for s in stretches:
        if node not in (s['a'], s['b']):
            continue
        other = s['b'] if s['a'] == node else s['a']
        reach = cost + s['L'] * (1 if s['cls'] == 'main' else 3)
        if other not in best or reach < best[other][0]:
            best[other] = (reach, node, s)
            heapq.heappush(heap, (reach, index[other]))
legs, node = [], goal
while best[node][1] is not None:
    _, before, s = best[node]
    legs.append(s['made'] if s['a'] == before else s['made'][::-1])
    node = before
route = [p for pts in reversed(legs) for p in pts]

num = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
with io.open(f'src/levels/{name}-data.ts', 'w', encoding='utf-8', newline='\n') as out:
    out.write('// Made by dev/realmap-level.py from the real roads and heights of the place (dev/realmap.py): not written by hand.\n')
    out.write('// Roads from OpenStreetMap (© OpenStreetMap contributors, ODbL); heights from the Terrarium elevation tiles.\n')
    out.write(f'// Lengths as they are; heights from the lowest ground, times {V}.\n')
    out.write(f'export const {name.upper()} = {{\n')
    out.write(f'  size: [{W}, {T}] as [number, number],\n')
    out.write(f'  /** The land: a height every `step` metres, rows from the north edge southward. */\n  step: {GRID},\n')
    out.write('  heights: [\n' + ''.join('    [' + ', '.join(num((h - low) * V) for h in row) + '],\n' for row in rows) + '  ],\n')
    out.write('  /**\n   * Stretches of road. Each stops short of the junction at either end (`a`, `b`: which junction, or -1 where it\n   * runs on into the next stretch or off the map). Points: x, z, height, and the radius its bend is rounded to (0: none).\n   */\n  roads: [\n')
    for r in roads:
        out.write(f"    {{ main: {'true' if r['cls'] == 'main' else 'false'}, town: {'true' if r['town'] else 'false'}, width: {WIDTH[r['cls']]}, a: {r['a']}, b: {r['b']}, pts: [" + ', '.join('[' + ', '.join(num(v) for v in p) + ']' for p in r['pts']) + '] },\n')
    out.write('  ] as { main: boolean; town: boolean; width: number; a: number; b: number; pts: [number, number, number, number][] }[],\n')
    out.write('  /** Junctions: x, z, height. */\n  junctions: [' + ', '.join('[' + ', '.join(num(v) for v in place[k]) + ']' for k in junctions) + '] as [number, number, number][],\n')
    out.write('  /** The way through, from the low end to the high. */\n  route: [' + ', '.join('[' + ', '.join(num(v) for v in p) + ']' for p in route) + '] as [number, number][],\n')
    out.write('};\n')

total = {'main': 0, 'lane': 0}
built = 0
steepest = 0
for r in roads:
    run = length(r['pts'])
    total[r['cls']] += run
    built += run if r['town'] else 0
    for i in range(len(r['pts']) - 1):
        leg = dist(r['pts'][i], r['pts'][i + 1])
        if leg > 1:
            steepest = max(steepest, abs(r['pts'][i + 1][2] - r['pts'][i][2]) / leg)
print(f"{name}: {len(roads)} stretches ({total['main']:.0f} m of main road, {total['lane']:.0f} m of lanes; {built:.0f} m built up), {len(junctions)} junctions, heights 0 to {(max(max(r) for r in rows) - low) * V:.0f} m")
print(f"steepest {steepest * 100:.0f}% ({eased} stretches eased past their limit to join their junctions); way through {length(route):.0f} m, from {place[start][2]:.0f} m up to {place[goal][2]:.0f} m")
