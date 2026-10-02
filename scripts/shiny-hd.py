"""The shiny colours on the cut artwork, for the animated sprites: the same ramps as the pixel
shinies (shiny-sprites.py), applied to the art scaled to twice the sprite's width.

    python scripts/shiny-hd.py <name> <cut.png> <out.png> <sprite width>
"""
import importlib.util
import os
import sys
from PIL import Image

spec = importlib.util.spec_from_file_location('shiny', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shiny-sprites.py'))
shiny = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shiny)

name, src, dst, width = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
art = Image.open(src).convert('RGBA')
art = art.crop(art.getbbox())
art = art.resize((width * 2, round(art.height * width * 2 / art.width)), Image.LANCZOS)
shiny.recolour(art, name, reach=round(3 * width * 2 / 96)).save(dst)
print(dst)
