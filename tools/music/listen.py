"""The closest this project's composer gets to hearing (owner, 2 Oct 2026: "can u make it
so u can hear"). A recording goes in; out come the notes that were played (Spotify's
basic-pitch transcription model), the top line written out as a melody, what that melody
is made of (how long its notes are, how far it leaps, how much of the time it rests), and
a piano-roll picture that can be looked at.

    python listen.py <audio> [start seconds] [length seconds] [beats per minute]

Used to study how the real themes' melodies move before writing one, and to check a
render says what the score meant. It hears pitch and rhythm; it does not hear tone.
"""
import sys
import warnings
import numpy as np

warnings.filterwarnings('ignore')
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
name = lambda m: f'{NAMES[int(m) % 12]}{int(m) // 12 - 1}'


def transcribe(path, start=0.0, length=None):
    import os
    import subprocess
    import tempfile
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict
    clip = path
    if start or length:
        clip = os.path.join(tempfile.gettempdir(), 'listen-clip.wav')
        cmd = ['ffmpeg', '-y', '-v', 'error', '-ss', str(start)] + (['-t', str(length)] if length else []) + ['-i', path, '-ac', '1', '-ar', '22050', clip]
        subprocess.run(cmd, check=True)
    _, _, events = predict(clip, ICASSP_2022_MODEL_PATH, onset_threshold=0.5, frame_threshold=0.3, minimum_note_length=58)
    return sorted([(float(a), float(b), int(p), float(v)) for a, b, p, v, _ in events])


def skyline(notes, low=60, step=0.02):
    """The top line: at each moment the highest note sounding (above middle C), merged into notes."""
    if not notes:
        return []
    end = max(b for _, b, _, _ in notes)
    grid = np.full(int(end / step) + 1, -1)
    for a, b, p, v in notes:
        if p < low or v < 0.25:
            continue
        i, j = int(a / step), int(b / step)
        grid[i:j + 1] = np.maximum(grid[i:j + 1], p)
    line, cur, since = [], grid[0], 0
    for k in range(1, len(grid) + 1):
        if k == len(grid) or grid[k] != cur:
            line.append((since * step, k * step, int(cur)))
            if k < len(grid):
                cur, since = grid[k], k
    return [(a, b, p) for a, b, p in line if b - a >= 0.05]


def describe(line, bpm=None):
    played = [(a, b, p) for a, b, p in line if p >= 0]
    if not played:
        print('no melody found')
        return
    total = line[-1][1] - line[0][0]
    durs = np.array([b - a for a, b, _ in played])
    steps = np.array([q[2] - p[2] for p, q in zip(played, played[1:])])
    beat = 60 / bpm if bpm else None
    print(f'melody notes: {len(played)} in {total:.1f} s ({len(played) / total:.1f} a second) | range {name(min(p for *_, p in played))} to {name(max(p for *_, p in played))}')
    print(f'note length: median {1000 * np.median(durs):.0f} ms, a quarter of them under {1000 * np.percentile(durs, 25):.0f} ms, a quarter over {1000 * np.percentile(durs, 75):.0f} ms' + (f' | in beats at {bpm} BPM: median {np.median(durs) / beat:.2f}' if beat else ''))
    print(f'silence in the line: {100 * (1 - durs.sum() / total):.0f}% of the time')
    a = np.abs(steps)
    print(f'movement: repeats {100 * (a == 0).mean():.0f}% | steps (1-2 semitones) {100 * ((a >= 1) & (a <= 2)).mean():.0f}% | thirds (3-4) {100 * ((a >= 3) & (a <= 4)).mean():.0f}% | fourths and fifths (5-7) {100 * ((a >= 5) & (a <= 7)).mean():.0f}% | bigger {100 * (a > 7).mean():.0f}%')
    print(f'direction: up {100 * (steps > 0).mean():.0f}% | down {100 * (steps < 0).mean():.0f}%')
    pcs = np.zeros(12)
    for a_, b_, p in played:
        pcs[p % 12] += b_ - a_
    print('notes by time held: ' + ' '.join(f'{NAMES[i]} {100 * pcs[i] / pcs.sum():.0f}%' for i in np.argsort(-pcs)[:7]))
    print('the line: ' + ' '.join((name(p) if p >= 0 else '-') + (f'({(b - a) / beat:.1f})' if beat else f'({b - a:.2f})') for a, b, p in line[:70]))


def picture(notes, path, seconds_per_px=0.02):
    from PIL import Image, ImageDraw
    if not notes:
        return
    end = max(b for _, b, _, _ in notes)
    lo, hi = 28, 100
    w, row = int(end / seconds_per_px) + 60, 6
    img = Image.new('RGB', (w, (hi - lo + 1) * row + 20), (18, 18, 24))
    d = ImageDraw.Draw(img)
    for m in range(lo, hi + 1):
        y = (hi - m) * row
        if m % 12 == 0:
            d.line([(0, y + row), (w, y + row)], fill=(60, 60, 80))
            d.text((2, y - 4), name(m), fill=(150, 150, 170))
        elif NAMES[m % 12].endswith('#'):
            d.rectangle([40, y, w, y + row - 1], fill=(24, 24, 32))
    for sec in range(int(end) + 1):
        x = 40 + int(sec / seconds_per_px)
        d.line([(x, 0), (x, img.height - 14)], fill=(40, 40, 56) if sec % 5 else (80, 80, 110))
        if sec % 5 == 0:
            d.text((x + 2, img.height - 12), f'{sec}s', fill=(150, 150, 170))
    for a, b, p, v in notes:
        if lo <= p <= hi:
            x0, x1 = 40 + int(a / seconds_per_px), 40 + max(int(a / seconds_per_px) + 2, int(b / seconds_per_px))
            y = (hi - p) * row
            c = int(110 + 145 * min(1.0, v))
            d.rectangle([x0, y, x1, y + row - 2], fill=(c, int(c * 0.75), 70) if p >= 60 else (70, int(c * 0.8), c))
    img.save(path)
    print('picture:', path, img.size)


if __name__ == '__main__':
    src = sys.argv[1]
    start = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    length = float(sys.argv[3]) if len(sys.argv) > 3 else None
    bpm = float(sys.argv[4]) if len(sys.argv) > 4 else None
    notes = transcribe(src, start, length)
    print(f'{src} from {start}s: {len(notes)} notes heard')
    describe(skyline(notes), bpm)
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'listen-' + os.path.splitext(os.path.basename(src))[0] + '.png')
    picture(notes, out)
