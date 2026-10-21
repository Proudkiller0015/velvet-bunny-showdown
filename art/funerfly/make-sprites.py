from PIL import Image, ImageOps
OUT = 'client/sprites/'
def fit(im, w, h):
    im = im.crop(im.getchannel('A').getbbox())
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
for name in ('funerfly', 'funerfly-breach'):
    cut = Image.open(f'art/funerfly/{name}-cut.png').convert('RGBA')
    back_cut = ImageOps.mirror(cut)
    back_cut.save(f'art/funerfly/{name}-back-cut.png')
    for view, src in (('', cut), ('-back', back_cut)):
        s = fit(src, 84, 90)
        c = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
        c.alpha_composite(s, ((96 - s.width) // 2, 94 - s.height))
        c.save(f'{OUT}{name}{view}.png')
    head = cut.crop((0, 0, cut.width, int(cut.height * 0.55)))
    s = fit(head, 40, 30)
    c = Image.new('RGBA', (40, 30), (0, 0, 0, 0))
    c.alpha_composite(s, ((40 - s.width) // 2, 30 - s.height))
    c.save(f'{OUT}{name}-icon.png')
