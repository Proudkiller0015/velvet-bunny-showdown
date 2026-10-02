"""Tidy a sprite taken out of ChatGPT so it reads as a clean pixel sprite (owner, 2 Oct 2026:
"the sprites in builder look hella pixelated").

ChatGPT's "pixel art" has no true grid, so sampling it leaves a ragged edge: stray pixels off the
body, pinholes, and an outline that comes and goes - which shows badly on the builder's light
background. This:

  1. removes specks (opaque pixels with at most one opaque neighbour) and fills pinholes;
  2. closes the outline: wherever a light pixel touches the outside, the outside pixel next to it
     becomes outline colour - the drawing itself is not touched;
  3. fits it on the 96x96 canvas by dropping the columns/rows that carry least (never resampling),
     standing on the gen 5 baseline.

    python scripts/clean-sprite.py <in.png> <out.png>
"""
import sys
from collections import Counter
from PIL import Image

OUTLINE = (20, 14, 26, 255)
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
N4 = [(0, -1), (-1, 0), (1, 0), (0, 1)]


def grid(im):
    w, h = im.size
    px = im.load()
    return {(x, y): px[x, y] for y in range(h) for x in range(w) if px[x, y][3] > 127}


def tidy(g):
    for _ in range(3):
        for p in [p for p in g if sum((p[0] + dx, p[1] + dy) in g for dx, dy in N8) <= 1]:
            del g[p]
    xs = [p[0] for p in g]
    ys = [p[1] for p in g]
    for x in range(min(xs), max(xs) + 1):
        for y in range(min(ys), max(ys) + 1):
            if (x, y) in g:
                continue
            near = [g[(x + dx, y + dy)] for dx, dy in N8 if (x + dx, y + dy) in g]
            if len(near) >= 7:
                g[(x, y)] = Counter(near).most_common(1)[0][0]
    return g


def outline(g):
    add = set()
    for (x, y), c in g.items():
        if max(c[:3]) <= 70:                      # already dark: this is the outline
            continue
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if q not in g:
                add.add(q)
    for q in add:
        g[q] = OUTLINE
    return g


def squeeze(g, limit, axis):
    """Drop the lines (columns for axis 0, rows for 1) that differ least from their neighbour."""
    while True:
        lo = min(p[axis] for p in g)
        hi = max(p[axis] for p in g)
        if hi - lo + 1 <= limit:
            return g
        other = 1 - axis
        a, b = min(p[other] for p in g), max(p[other] for p in g)

        def at(i, j):
            return g.get((i, j) if axis == 0 else (j, i))
        cost = {i: sum(at(i, j) != at(i + 1, j) for j in range(a, b + 1)) for i in range(lo + 2, hi - 2)}
        cut = min(cost, key=cost.get)
        g = {((p[0] - (p[0] > cut), p[1]) if axis == 0 else (p[0], p[1] - (p[1] > cut))): c for p, c in g.items() if p[axis] != cut}


def clean(im):
    g = squeeze(squeeze(outline(tidy(grid(im.convert('RGBA')))), 96, 0), 92, 1)
    x0, x1 = min(p[0] for p in g), max(p[0] for p in g)
    y1 = max(p[1] for p in g)
    w = x1 - x0 + 1
    out = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    po = out.load()
    for (x, y), c in g.items():
        po[x - x0 + (96 - w) // 2, y - y1 + 91] = c
    return out


if __name__ == '__main__':
    clean(Image.open(sys.argv[1])).save(sys.argv[2])
    print(sys.argv[2])
