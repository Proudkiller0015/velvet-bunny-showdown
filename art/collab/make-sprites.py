from PIL import Image, ImageFilter, ImageOps
import os
OUT = r'C:\Users\Sam_0\Documents\Project\showdown\client\sprites\collab'
ART = r'C:\Users\Sam_0\Documents\Project\showdown\art\collab'
os.makedirs(OUT, exist_ok=True); os.makedirs(ART, exist_ok=True)
def trim(im): return im.crop(im.getchannel('A').getbbox())
def glow(base, layers):
    pad = 24
    b = Image.new('RGBA', (base.width + 2 * pad, base.height + 2 * pad), (0, 0, 0, 0)); b.paste(base, (pad, pad))
    a = b.getchannel('A'); g = Image.new('RGBA', b.size, (0, 0, 0, 0))
    for radius, alpha, colour in layers:
        m = a.filter(ImageFilter.MaxFilter(radius // 2 * 2 + 1)).filter(ImageFilter.GaussianBlur(radius))
        layer = Image.new('RGBA', b.size, colour + (0,)); layer.putalpha(m.point(lambda v: v * alpha // 255))
        g = Image.alpha_composite(g, layer)
    return trim(Image.alpha_composite(g, b))
def fit(im, w, h):
    im = trim(im); k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
def sprites(name, cut):
    cut.save(f'{ART}/{name}-cut.png')
    for view, src in (('', cut), ('-back', ImageOps.mirror(cut))):
        s = fit(src, 84, 90); c = Image.new('RGBA', (96, 96), (0, 0, 0, 0)); c.alpha_composite(s, ((96 - s.width) // 2, 94 - s.height)); c.save(f'{OUT}/{name}{view}.png')
    head = cut.crop((0, 0, cut.width, int(cut.height * 0.55))); s = fit(head, 40, 30)
    c = Image.new('RGBA', (40, 30), (0, 0, 0, 0)); c.alpha_composite(s, ((40 - s.width) // 2, 30 - s.height)); c.save(f'{OUT}/{name}-icon.png')
bird = Image.open('PunishingBirdCrop.png').convert('RGBA').crop((420, 0, 700, 200)); bird = trim(bird).crop((60, 0, 190, 96))
bird = trim(bird)
sprites('punibird', bird)
# Angry: the red mouth wide open is its breach; here, a red rage glow on the same bird.
sprites('punibird-angry', glow(bird, ((14, 170, (200, 20, 30)), (5, 235, (255, 90, 80)))))
sprites('laetitia', trim(Image.open('LaetitiaCrop.png').convert('RGBA')))
sprites('freischutz', trim(Image.open('DerFreischutzCrop.png').convert('RGBA')))
queen = trim(Image.open('QueenofHatredCrop.png').convert('RGBA'))
sprites('hatrequeen', queen)
# Hatred: the magical girl gone hysteric, in a dark magenta aura.
sprites('hatrequeen-hatred', glow(queen, ((16, 190, (90, 0, 70)), (6, 235, (230, 40, 160)))))
c = Image.new('RGBA', (96 * 6, 96 * 2 + 30), (90, 110, 90, 255))
for i, n in enumerate(['punibird', 'punibird-angry', 'laetitia', 'freischutz', 'hatrequeen', 'hatrequeen-hatred']):
    c.alpha_composite(Image.open(f'{OUT}/{n}.png'), (i * 96, 0)); c.alpha_composite(Image.open(f'{OUT}/{n}-back.png'), (i * 96, 96)); c.alpha_composite(Image.open(f'{OUT}/{n}-icon.png'), (i * 96, 192))
c.resize((c.width * 2, c.height * 2), Image.NEAREST).save('sheet.png')
