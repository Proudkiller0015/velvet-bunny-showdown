"""Animated battle sprites for the Shrine Trio (owner, 2 Oct 2026: "their ingame sprite lack
animation, are super pixelated compared to native ones").

The native sprites are smooth animated renders; ours were still 96px pixel sprites. So:

  hd     the creature's own artwork (cut off its background by cut-art.py), scaled down smoothly
         and given an idle loop - it breathes (or, for a swimmer, drifts), and everything that
         glows on it pulses, with a soft bloom behind the glow.
  pixel  for a view there is no artwork of yet (the backs): the pixel sprite, with
         the same pulse and a one-pixel breath, so at least nothing on the field stands frozen.

Both loop in 1.92 s (24 frames) and are written as animated WebP.

    python scripts/animate-sprite.py hd <cut.png> <out.webp> <width> [float]
    python scripts/animate-sprite.py pixel <sprite.png> <out.webp>
"""
import math
import sys
import numpy as np
from PIL import Image, ImageFilter

FRAMES, MS = 24, 80


def glow_mask(rgba):
    """Where the creature glows: saturated and bright. 0..1, soft-edged."""
    a = np.asarray(rgba).astype(np.float32) / 255
    mx, mn = a[..., :3].max(2), a[..., :3].min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    m = np.clip((sat - 0.45) / 0.25, 0, 1) * np.clip((mx - 0.6) / 0.2, 0, 1) * a[..., 3]
    return m


def pulse(rgba, mask, k, bloom_radius):
    """One frame's light: k runs -1..1."""
    a = np.asarray(rgba).astype(np.float32)
    lit = a.copy()
    lit[..., :3] = np.clip(a[..., :3] * (1 + 0.16 * k * mask[..., None]) + 22 * k * mask[..., None], 0, 255)
    frame = Image.fromarray(lit.astype(np.uint8), 'RGBA')
    if bloom_radius:
        halo = a.copy()
        halo[..., 3] = mask * 255
        halo = Image.fromarray(halo.astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(bloom_radius))
        h = np.asarray(halo).astype(np.float32)
        h[..., 3] *= 0.55 + 0.35 * k
        under = Image.fromarray(np.clip(h, 0, 255).astype(np.uint8), 'RGBA')
        under.alpha_composite(frame)
        frame = under
    return frame


def hd(src, width, floats=False):
    art = Image.open(src).convert('RGBA')
    art = art.crop(art.getbbox())
    scale = 2                                                    # work at twice the size, shrink at the end
    w = width * scale
    h = round(art.height * w / art.width)
    art = art.resize((w, h), Image.LANCZOS)
    pad = 14 * scale
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.alpha_composite(art, (pad, pad))
    mask = glow_mask(canvas)
    cw, ch = canvas.size
    out = []
    for i in range(FRAMES):
        p = 2 * math.pi * i / FRAMES
        frame = pulse(canvas, mask, math.sin(p * 2 + 0.6) * 0.6 + math.sin(p) * 0.4, 5 * scale)
        if floats:                                               # a swimmer: it drifts and tilts
            frame = frame.rotate(1.1 * math.sin(p + 0.9), resample=Image.BICUBIC, center=(cw / 2, ch / 2),
                                 translate=(0, 3 * scale * math.sin(p)))
        else:                                                    # it stands and breathes, feet planted
            sy = 1 + 0.016 * math.sin(p)
            sx = 1 - 0.005 * math.sin(p)
            foot = ch - pad
            # output (x, y) takes from input ((x - cx) / sx + cx, (y - foot) / sy + foot)
            frame = frame.transform((cw, ch), Image.AFFINE,
                                    (1 / sx, 0, cw / 2 - cw / 2 / sx, 0, 1 / sy, foot - foot / sy), resample=Image.BICUBIC)
        out.append(frame.resize((cw // scale, ch // scale), Image.LANCZOS))
    return out


def pixel(src):
    art = Image.open(src).convert('RGBA')
    mask = glow_mask(art)
    out = []
    for i in range(FRAMES):
        p = 2 * math.pi * i / FRAMES
        frame = pulse(art, mask, math.sin(p * 2 + 0.6) * 0.6 + math.sin(p) * 0.4, 0)
        if math.sin(p) > 0.35:                                   # the breath: the top two thirds rise one pixel
            box = art.getbbox()
            cut = box[1] + (box[3] - box[1]) * 2 // 3
            top = frame.crop((0, 1, art.width, cut))
            lifted = frame.copy()
            lifted.paste(top, (0, 0))
            frame = lifted
        out.append(frame)
    return out


def save(frames, dst, lossless):
    frames[0].save(dst, save_all=True, append_images=frames[1:], duration=MS, loop=0,
                   lossless=lossless, quality=88, method=6, exact=False)
    import os
    print(dst, frames[0].size, os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    if sys.argv[1] == 'hd':
        save(hd(sys.argv[2], int(sys.argv[4]), len(sys.argv) > 5 and sys.argv[5] == 'float'), sys.argv[3], False)
    else:
        save(pixel(sys.argv[2]), sys.argv[3], True)
