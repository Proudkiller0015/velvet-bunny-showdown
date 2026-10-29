# King Boo (collab-kingboo.js): official renders from the Super Mario Wiki, in kingboo-src/.
# Normal: Mario Super Sluggers. Shiny: Luigi's Mansion: Dark Moon (glowing purple eyes), turned to face left.
from PIL import Image, ImageOps, ImageFilter
OUT = r'C:\Users\Sam_0\Documents\Project\showdown\client\sprites\collab'
SRC = r'C:\Users\Sam_0\Documents\Project\showdown\art\collab\kingboo-src'
def trim(im): return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
def fit(im, w, h):
    im = trim(im); k = min(w / im.width, h / im.height)
    s = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    return s.filter(ImageFilter.UnsharpMask(1, 60, 2))
def sprites(name, cut):
    for view, src in (('', cut), ('-back', ImageOps.mirror(cut))):
        s = fit(src, 88, 88); c = Image.new('RGBA', (96, 96), (0, 0, 0, 0)); c.alpha_composite(s, ((96 - s.width) // 2, 94 - s.height)); c.save(f'{OUT}/{name}{view}.png')
def icon(name, cut):
    s = fit(cut, 40, 30); c = Image.new('RGBA', (40, 30), (0, 0, 0, 0)); c.alpha_composite(s, ((40 - s.width) // 2, 30 - s.height)); c.save(f'{OUT}/{name}-icon.png')
normal = trim(Image.open(f'{SRC}/mss.png').convert('RGBA'))
shiny = trim(ImageOps.mirror(Image.open(f'{SRC}/lmdm.png').convert('RGBA')))
sprites('kingboo', normal); icon('kingboo', normal); sprites('kingboo-shiny', shiny)
c = Image.new('RGBA', (96 * 4 + 40, 96), (90, 110, 90, 255))
for i, n in enumerate(['kingboo', 'kingboo-back', 'kingboo-shiny', 'kingboo-shiny-back']): c.alpha_composite(Image.open(f'{OUT}/{n}.png'), (i * 96, 0))
c.alpha_composite(Image.open(f'{OUT}/kingboo-icon.png'), (384, 33))
c.resize((c.width * 2, c.height * 2), Image.NEAREST).save('kingboo-sheet.png')
