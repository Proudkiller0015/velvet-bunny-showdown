"""Cut a creature's artwork off its flat dark background, keeping its own black parts.

The trio's art is a dark creature on a black ground, which defeats the usual background
removers (they ate Makuro's tail and left black slabs behind Raishin). What does work: the
ground is one flat colour and the creature's black areas are enclosed by its coloured rims.
So flood the ground in from the picture's edge, with the rims thickened a little so the
flood cannot leak through a hairline gap, and everything the flood never reaches is creature.

    python scripts/cut-art.py <art.png> <out.png> [tolerance=14] [seal=3] [gaps=0] [floor=]

    gaps   share of the picture above which an enclosed patch of ground is a gap (0: keep them all -
           Makuro's body IS black); floor: cut everything below this share of the height
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def cut(im, tol=14, seal=3, gaps=0.0, floor=None):
    rgb = np.asarray(im.convert('RGB')).astype(np.int32)
    h, w, _ = rgb.shape
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ground = np.median(edge, axis=0)
    like = np.abs(rgb - ground).max(axis=2) <= tol               # pixels that look like the ground
    wall = ndimage.binary_dilation(~like, iterations=seal)       # the creature's visible parts, thickened
    labels, _ = ndimage.label(~wall)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    outside = np.isin(labels, list(border))
    outside = ndimage.binary_dilation(outside, iterations=seal) & like      # give back the thickening
    body = ~outside
    if gaps:                                                      # ground showing through between legs and tails
        inner, count = ndimage.label(like & body)
        if count:
            sizes = ndimage.sum(like & body, inner, range(1, count + 1))
            body &= ~np.isin(inner, [i + 1 for i, sz in enumerate(sizes) if sz >= gaps * h * w])
    if floor:                                                     # a reflection on the floor under the feet
        body[int(floor * h):] = False
        dark = rgb.max(axis=2) < 60                               # and the dark line where the floor met the feet
        for y in range(int(floor * h) - 1, int(floor * h) - 40, -1):
            row = body[y]
            if row.sum() and (dark[y] & row).sum() > 0.6 * row.sum():
                body[y] = False
            elif row.sum():
                body[y] &= ~dark[y] | (ndimage.binary_dilation(~dark[y] & row, iterations=4))
    body = ndimage.binary_opening(body, iterations=1)
    labels, count = ndimage.label(body)                           # drop specks: keep pieces of real size
    if count > 1:
        sizes = ndimage.sum(body, labels, range(1, count + 1))
        keep = [i + 1 for i, sz in enumerate(sizes) if sz >= 0.002 * body.sum()]
        body = np.isin(labels, keep)
    alpha = Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    return out.crop(out.getbbox())


if __name__ == '__main__':
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 14
    seal = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    gaps = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    floor = float(sys.argv[6]) if len(sys.argv) > 6 else None
    out = cut(Image.open(sys.argv[1]), tol, seal, gaps, floor)
    out.save(sys.argv[2])
    print(sys.argv[2], out.size)
