"""Shiny sprites for the Shrine Trio, recoloured from the normal ones (owner, 2 Oct 2026).

The owner picked the "inverted" look, with Makuro black and red; the shiny artwork was then
painted in ChatGPT (chat "Pixel Sprite Design") and these sprites follow that artwork:

  Makuro   stays black; the blue edges turn crimson, the cyan fins burn red to orange,
           and the red eye turns light blue
  Raishin  the white fur turns midnight violet, the violet fire turns gold, the gold turns silver
           (the paper charms stay white)
  Chimai   the tan fur turns ivory, the dark mane and back silver-grey, the pink flames ice blue
           (the holes in its ribbon tails stay dark)

Each pixel falls into a colour family and each family gets a new ramp; shading is kept, so the
shiny is the same drawing pixel for pixel. Re-run after any redraw of the normal sprites.

    python scripts/shiny-sprites.py            writes client/sprites/<name>-shiny.png, -back-shiny.png
    python scripts/shiny-sprites.py sheet <png>  normal and shiny side by side, 3x
"""
import colorsys
import os
import sys
from collections import deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPRITES = os.path.join(ROOT, 'client', 'sprites')
NAMES = ('makuro', 'raishin', 'chimai')


def family(name, h, s, v):
    """Which colour family a pixel belongs to. h in degrees, s and v 0..1."""
    if v < 0.10:
        return 'line'
    if name == 'makuro':
        if s < 0.22:
            return 'belly'
        if (h >= 340 or h <= 20) and s > 0.5:
            return 'eye'
        if 165 <= h <= 205 and v > 0.55:
            return 'glow'
        return 'body'
    if name == 'raishin':
        if 25 <= h <= 60 and s > 0.25 and v > 0.5:
            return 'gold'
        if 240 <= h <= 320 and s > 0.5 and v > 0.38:
            return 'bolt'
        return 'body'
    if name == 'chimai':
        if (h >= 295 or h <= 5) and s > 0.5 and v > 0.38:
            return 'flame'
        if 12 <= h <= 45 and s > 0.3 and v > 0.42:
            return 'trim'
        return 'body'
    return 'body'


# family -> (hue dark end, hue light end, saturation dark, saturation light, value dark, value light, curve)
RAMPS = {
    'makuro': {
        'body': (350, 356, 0.95, 0.88, 0.05, 0.70, 2.2),
        'glow': (2, 32, 0.95, 0.70, 0.80, 1.00, 1.0),
        'belly': (350, 350, 0.08, 0.06, 0.14, 0.34, 1.0),
        'eye': (192, 190, 0.60, 0.40, 0.95, 1.00, 1.0),
    },
    'raishin': {
        'body': (262, 256, 0.55, 0.38, 0.07, 0.36, 1.0),
        'bolt': (30, 52, 0.95, 0.55, 0.55, 1.00, 0.8),
        'gold': (225, 225, 0.10, 0.03, 0.55, 0.98, 1.0),
    },
    'chimai': {
        'body': (245, 235, 0.14, 0.07, 0.46, 0.76, 0.8),
        'trim': (32, 42, 0.16, 0.03, 0.68, 1.00, 0.8),
        'flame': (208, 186, 0.92, 0.40, 0.55, 1.00, 1.0),
        'hole': (215, 215, 0.50, 0.45, 0.10, 0.24, 1.0),
    },
}


def classify(img, name, reach=3):
    """A family for every opaque pixel, including the two that need the neighbours to tell."""
    w, h = img.size
    px = img.load()
    fam = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            fam[x, y] = family(name, hh * 360, s, v)

    if name == 'raishin':
        # The paper charms hang from the halo: joined to the rest only through gold. So with the gold
        # taken out, everything that is not the biggest piece is a charm, and stays white.
        # (The outline that runs along the gold would join them up again, so it is a wall too.)
        gold = {p for p, f in fam.items() if f == 'gold'}
        wall = set(gold)
        for (x, y) in gold:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if fam.get((x + dx, y + dy)) == 'line':
                        wall.add((x + dx, y + dy))
        seen, pieces = set(), []
        for start in fam:
            if start in seen or start in wall:
                continue
            piece, todo = [], deque([start])
            seen.add(start)
            while todo:
                x, y = todo.popleft()
                piece.append((x, y))
                for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if q in fam and q not in seen and q not in wall:
                        seen.add(q)
                        todo.append(q)
            pieces.append(piece)
        pieces.sort(key=len)
        for piece in pieces[:-1]:
            if len(piece) < 120 * (reach / 3) ** 2:
                for p in piece:
                    fam[p] = 'keep'

    if name == 'chimai':
        # The holes in the ribbon tails are body-coloured pixels sitting inside the flame colour.
        holes = []
        for (x, y), f in fam.items():
            if f not in ('body', 'line'):
                continue
            near = [fam.get((x + dx, y + dy)) for dx in range(-reach, reach + 1, max(1, reach // 3)) for dy in range(-reach, reach + 1, max(1, reach // 3))]
            if sum(1 for n in near if n == 'flame') >= 0.42 * len(near):
                holes.append((x, y))
        for p in holes:
            fam[p] = 'hole' if fam[p] == 'body' else 'line'
    return fam


def recolour(img, name, reach=3):
    img = img.convert('RGBA')
    fam = classify(img, name, reach)
    px = img.load()
    span = {}
    for p, f in fam.items():
        v = max(px[p][:3]) / 255
        lo, hi = span.get(f, (1.0, 0.0))
        span[f] = (min(lo, v), max(hi, v))
    out = img.copy()
    po = out.load()
    for p, f in fam.items():
        ramp = RAMPS[name].get(f)
        if not ramp:
            continue
        h0, h1, s0, s1, v0, v1, curve = ramp
        lo, hi = span[f]
        k = ((max(px[p][:3]) / 255 - lo) / (hi - lo) if hi > lo else 0.5) ** curve
        if h1 < h0 and h0 - h1 > 180:
            h1 += 360
        hue = (h0 + (h1 - h0) * k) % 360
        r, g, b = colorsys.hsv_to_rgb(hue / 360, s0 + (s1 - s0) * k, v0 + (v1 - v0) * k)
        po[p] = (int(r * 255), int(g * 255), int(b * 255), px[p][3])
    return out


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'sheet':
        cell = 96 * 3
        sheet = Image.new('RGBA', (cell * 4, cell * 3), (34, 34, 42, 255))
        for y, name in enumerate(NAMES):
            for x, suffix in enumerate(('', '-back')):
                src = Image.open(os.path.join(SPRITES, name + suffix + '.png')).convert('RGBA')
                for k, img in enumerate((src, recolour(src, name))):
                    big = img.resize((cell, cell), Image.NEAREST)
                    sheet.paste(big, ((x + k * 2) * cell, y * cell), big)
        sheet.save(sys.argv[2])
        print(sys.argv[2])
    else:
        for name in NAMES:
            for suffix in ('', '-back'):
                src = Image.open(os.path.join(SPRITES, name + suffix + '.png'))
                recolour(src, name).save(os.path.join(SPRITES, name + suffix + '-shiny.png'))
            print(name, 'shiny written')
