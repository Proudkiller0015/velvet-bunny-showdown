import sys
from PIL import Image, ImageFilter, ImageChops, ImageOps
src, art = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
im = im.crop(im.getchannel('A').getbbox())
pad = 24
base = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
base.paste(im, (pad, pad))
base.save(f'{art}/funerfly-cut.png')
# Breached: the same body in a pale soul light, faint outside, strong at the edge.
a = base.getchannel('A')
glow = Image.new('RGBA', base.size, (0, 0, 0, 0))
for radius, alpha, colour in ((14, 150, (196, 214, 255)), (5, 230, (240, 246, 255))):
    m = a.filter(ImageFilter.MaxFilter(radius // 2 * 2 + 1)).filter(ImageFilter.GaussianBlur(radius))
    layer = Image.new('RGBA', base.size, colour + (0,))
    layer.putalpha(m.point(lambda v: v * alpha // 255))
    glow = Image.alpha_composite(glow, layer)
breach = Image.alpha_composite(glow, base)
breach.save(f'{art}/funerfly-breach-cut.png')
