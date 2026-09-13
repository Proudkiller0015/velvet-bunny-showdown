"""Build Samantha's animated battle sprites from the artist's sheet.

    python scripts/build-samantha-anim.py <sheet.png> [out dir]

Showdown animates a Pokemon by pointing the sprite at a GIF - there is no
animation system beyond that, the browser plays it - so the whole job is
cutting the sheet into frames and writing one GIF for the front and one for
the back.

Three things here are less obvious than they look:

*The sheet is cut on a fixed grid, not on gaps.* Her scythe swings past the
edge of her own cell into the next one, so looking for blank columns finds
three "frames" in a row of eight. The art is laid out as even cells, so
dividing the width by the frame count cuts exactly where the artist drew.

*Every frame of a row is cropped to the same rectangle.* Cropping each frame
to its own contents would centre the scythe instead of her, and she would
swim around the screen while it stayed still.

*Scaled in linear light.* Averaging sRGB values pulls saturated colour toward
grey, and she is almost entirely saturated colour - the same reason the avatar
and static-sprite builds do it.

A GIF only gets one bit of transparency, which suits pixel art, but it also
gets one palette: quantising frames separately makes the colours crawl between
frames, so all the frames are quantised together as one image and split again.

The static PNGs from build-samantha-sprites.js stay as they are - the client
falls back to them when a viewer turns animation off.
"""

import sys
from pathlib import Path

from PIL import Image

# Rows of the sheet, top to bottom, and how tall each should end up. The third
# row is attack poses, which Showdown has nowhere to put.
ROWS = [
    ('front', 0, 140),
    ('back', 1, 116),
]
FRAMES_PER_ROW = 8
FRAME_MS = 110
# Reserved for transparency; 255 colours is more than this palette needs.
TRANSPARENT_INDEX = 255


def bands(sheet):
    """The vertical extent of each row of art, found by looking for empty rows."""
    width, height = sheet.size
    alpha = sheet.split()[3]
    found = []
    start = None
    for y in range(height):
        occupied = any(alpha.getpixel((x, y)) > 8 for x in range(0, width, 3))
        if occupied and start is None:
            start = y
        elif not occupied and start is not None:
            if y - start > 20:
                found.append((start, y))
            start = None
    if start is not None:
        found.append((start, height))
    return found


def cut(sheet, band, count):
    """One row of the sheet, as frames that all share a coordinate system."""
    width = sheet.size[0]
    cell = width // count
    top, bottom = band
    frames = [sheet.crop((i * cell, top, (i + 1) * cell, bottom)) for i in range(count)]

    # One rectangle for the whole row: the union of what every frame draws.
    box = None
    for frame in frames:
        frame_box = frame.getbbox()
        if not frame_box:
            continue
        box = frame_box if box is None else (
            min(box[0], frame_box[0]), min(box[1], frame_box[1]),
            max(box[2], frame_box[2]), max(box[3], frame_box[3]),
        )
    return [frame.crop(box) for frame in frames]


def to_linear(value):
    value /= 255.0
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def to_srgb(value):
    value = 1.0 if value > 1.0 else (0.0 if value < 0.0 else value)
    value = value * 12.92 if value <= 0.0031308 else 1.055 * (value ** (1 / 2.4)) - 0.055
    return int(round(value * 255))


LINEAR = [to_linear(v) for v in range(256)]


def scale(frame, height):
    """Downscale in linear light, with colour weighted by how opaque it is."""
    width = max(1, round(frame.size[0] * height / frame.size[1]))
    pixels = frame.load()

    # Premultiply in linear light, resize, then undo it - so a transparent
    # pixel's colour (often black) cannot leak into its neighbours' edges.
    premultiplied = Image.new('RGBA', frame.size)
    put = premultiplied.load()
    for y in range(frame.size[1]):
        for x in range(frame.size[0]):
            r, g, b, a = pixels[x, y]
            weight = a / 255.0
            put[x, y] = (
                int(round(LINEAR[r] * weight * 255)),
                int(round(LINEAR[g] * weight * 255)),
                int(round(LINEAR[b] * weight * 255)),
                a,
            )

    small = premultiplied.resize((width, height), Image.LANCZOS)
    out = Image.new('RGBA', small.size)
    src, dst = small.load(), out.load()
    for y in range(small.size[1]):
        for x in range(small.size[0]):
            r, g, b, a = src[x, y]
            if not a:
                dst[x, y] = (0, 0, 0, 0)
                continue
            weight = a / 255.0
            dst[x, y] = (
                to_srgb((r / 255.0) / weight),
                to_srgb((g / 255.0) / weight),
                to_srgb((b / 255.0) / weight),
                255 if a >= 128 else 0,
            )
    return out


def write_gif(frames, path):
    """One palette for every frame, so the colours do not crawl."""
    width, height = frames[0].size
    strip = Image.new('RGBA', (width, height * len(frames)), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.paste(frame, (0, i * height))

    flat = Image.new('RGB', strip.size, (0, 0, 0))
    flat.paste(strip, mask=strip.split()[3])
    palette = flat.quantize(colors=TRANSPARENT_INDEX, method=Image.MEDIANCUT)

    out = []
    for i, frame in enumerate(frames):
        indexed = palette.crop((0, i * height, width, (i + 1) * height))
        alpha = frame.split()[3]
        pixels = indexed.load()
        mask = alpha.load()
        for y in range(height):
            for x in range(width):
                if not mask[x, y]:
                    pixels[x, y] = TRANSPARENT_INDEX
        out.append(indexed)

    out[0].save(
        path, save_all=True, append_images=out[1:], duration=FRAME_MS, loop=0,
        transparency=TRANSPARENT_INDEX, disposal=2, optimize=False,
    )


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip().splitlines()[2])
        return 1
    sheet_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent.parent / 'client' / 'sprites'

    sheet = Image.open(sheet_path).convert('RGBA')
    rows = bands(sheet)
    for name, index, height in ROWS:
        if index >= len(rows):
            print(f'{name}: the sheet has no row {index + 1}')
            continue
        frames = [scale(frame, height) for frame in cut(sheet, rows[index], FRAMES_PER_ROW)]
        path = out_dir / f'samantha-{name}.gif'
        write_gif(frames, path)
        print(f'{name} -> {path} ({frames[0].size[0]}x{frames[0].size[1]}, {len(frames)} frames, '
              f'{path.stat().st_size // 1024}KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
