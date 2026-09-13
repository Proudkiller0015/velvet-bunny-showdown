"""Build the icons a phone uses when this site is installed to the home screen.

    python scripts/build-app-icons.py <source.png> [out dir]

Android wants 192 and 512, and it wants them square and opaque: a transparent
PNG gets a white plate behind it, which for art that is mostly black reads as a
mistake. It also crops icons to whatever shape the launcher uses - a circle, a
squircle, a rounded square - so the subject sits inside the middle 80% ("the
safe zone") with the background doing the rest.

The source here is a full-body character. Shrunk to 192px she would be a
smudge, so the icon is cut to her head and shoulders, which is what reads at
that size.
"""

import sys
from pathlib import Path

from PIL import Image

SIZES = [192, 512]
# Where the head and shoulders sit in the source art, as fractions of it.
CROP = (0.26, 0.05, 0.79, 0.50)
# Her own colours: the black she wears, lifted enough to not read as a hole.
BACKGROUND = (26, 13, 26, 255)
# How much of the icon the art may take up, leaving the rest as safe margin.
SUBJECT = 0.78


def build(source: Path, out_dir: Path) -> int:
    art = Image.open(source).convert('RGBA')
    width, height = art.size
    box = (
        int(CROP[0] * width), int(CROP[1] * height),
        int(CROP[2] * width), int(CROP[3] * height),
    )
    head = art.crop(box)

    # Square it off around what was actually drawn, so the subject ends up
    # centred on its own bounds rather than on the crop rectangle's.
    bounds = head.getbbox() or (0, 0, *head.size)
    head = head.crop(bounds)
    side = max(head.size)
    squared = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    squared.paste(head, ((side - head.size[0]) // 2, (side - head.size[1]) // 2))

    for size in SIZES:
        icon = Image.new('RGBA', (size, size), BACKGROUND)
        inner = round(size * SUBJECT)
        icon.alpha_composite(
            squared.resize((inner, inner), Image.LANCZOS),
            ((size - inner) // 2, (size - inner) // 2),
        )
        path = out_dir / f'icon-{size}.png'
        icon.convert('RGB').save(path)
        print(f'{path} ({size}x{size}, {path.stat().st_size // 1024}KB)')
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip().splitlines()[2])
        return 1
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent.parent / 'client'
    return build(Path(sys.argv[1]), out_dir)


if __name__ == '__main__':
    sys.exit(main())
