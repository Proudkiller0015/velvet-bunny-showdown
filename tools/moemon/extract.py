import zipfile, re, io, json, sys
from xml.etree import ElementTree as ET
from PIL import Image
z = zipfile.ZipFile('book.xlsx')
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
rels = lambda p: dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', z.read(p).decode()))
wbrels = rels('xl/_rels/workbook.xml.rels')
wb = z.read('xl/workbook.xml').decode()
sheets = re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
ss = []
root = ET.fromstring(z.read('xl/sharedStrings.xml'))
for si in root.findall('m:si', NS):
    ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
def colnum(ref):
    letters = re.match(r'[A-Z]+', ref).group(0); n = 0
    for ch in letters: n = n * 26 + ord(ch) - 64
    return n - 1
out = []
for name, rid in sheets:
    if not name.startswith('Gen') and not name.startswith('Misc'): continue
    path = 'xl/' + wbrels[rid]
    sx = ET.fromstring(z.read(path))
    rows = {}
    for c in sx.iter('{%s}c' % NS['m']):
        ref = c.get('r'); r = int(re.search(r'\d+', ref).group(0)) - 1; col = colnum(ref)
        v = c.find('m:v', NS); t = c.get('t')
        if v is None:
            isel = c.find('m:is', NS)
            val = ''.join(x.text or '' for x in isel.iter('{%s}t' % NS['m'])) if isel is not None else ''
        else:
            val = ss[int(v.text)] if t == 's' else v.text
        rows.setdefault(r, {})[col] = val
    srels = rels(path.replace('worksheets/', 'worksheets/_rels/') + '.rels')
    dpath = 'xl/' + [v for v in srels.values() if 'drawing' in v][0].replace('../', '')
    drels = rels(dpath.replace('drawings/', 'drawings/_rels/') + '.rels')
    d = z.read(dpath).decode()
    for col, row, emb in re.findall(r'<xdr:from><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>.*?r:embed="(rId\d+)"', d):
        col, row = int(col), int(row)
        if col != 1: continue
        cells = rows.get(row, {})
        media = 'xl/' + drels[emb].replace('../', '')
        im = Image.open(io.BytesIO(z.read(media)))
        out.append({'sheet': name, 'row': row, 'species': cells.get(0, ''), 'dex': cells.get(2, ''), 'repo': cells.get(3, ''), 'form': cells.get(4, ''),
                    'by': cells.get(5, ''), 'edited': cells.get(6, ''), 'notes': cells.get(7, ''), 'media': media, 'size': im.size})
json.dump(out, open('rows.json', 'w'), indent=0)
from collections import Counter
print(len(out), Counter(tuple(o['size']) for o in out).most_common(8))
print(Counter(o['sheet'] for o in out))
print(Counter(o['form'] for o in out).most_common(40))
