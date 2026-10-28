import json, zipfile, io, os
from PIL import Image
z = zipfile.ZipFile('book.xlsx'); rows = json.load(open('rows.json'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'sprites', 'moemon')
os.makedirs(OUT, exist_ok=True)
names = ['', '-shiny', '-back', '-back-shiny']
done = []
for i, r in enumerate(rows):
    if r['size'] not in ([256, 64], [257, 64], [512, 128]): continue
    im = Image.open(io.BytesIO(z.read(r['media']))).convert('RGBA')
    if r['size'] == [512, 128]: im = im.resize((256, 64), Image.NEAREST)
    im = im.crop((0, 0, 256, 64))
    px = im.load()
    for k in range(4):
        fr = im.crop((k * 64, 0, k * 64 + 64, 64)); p = fr.load()
        corners = {p[0, 0], p[63, 0], p[0, 63], p[63, 63]}
        bg = max(corners, key=lambda c: sum(1 for q in (p[0, 0], p[63, 0], p[0, 63], p[63, 63]) if q == c))
        for y in range(64):
            for x in range(64):
                c = p[x, y]
                if c[3] == 0 or (abs(c[0] - bg[0]) <= 4 and abs(c[1] - bg[1]) <= 4 and abs(c[2] - bg[2]) <= 4): p[x, y] = (0, 0, 0, 0)
        fr.save(os.path.join(OUT, f'm{i}{names[k]}.png'), optimize=True)
    done.append(i)
json.dump(done, open('done.json', 'w'))
print(len(done))
