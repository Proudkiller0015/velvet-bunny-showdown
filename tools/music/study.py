"""What every legendary theme on the server is made of (owner, 2 Oct 2026: "feel free to
analyse all legendary themes"). For each track's first 75 seconds, heard through the
transcription model in listen.py:

  wait      seconds before a melody is established (three held mid-register notes close together)
  drone     share of the time a low note (below C3) is being held, and the note held most
  melody    how long its notes are, where they sit, how much it moves by step
  figure    how much of the short-note activity is the same pitch struck again (a hammered figure)

    python study.py [folder] > out/study.txt
"""
import os
import sys
import numpy as np
from listen import transcribe, NAMES, name

folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'client', 'audio', 'legends')
rows = []
for f in sorted(os.listdir(folder)):
    if not f.endswith('.mp3'):
        continue
    try:
        notes = transcribe(os.path.join(folder, f), 0, 75)
    except Exception as e:
        print(f, 'failed:', e)
        continue
    end = max(b for _, b, _, _ in notes)
    # the drone
    grid = np.zeros(int(end / 0.05) + 1, dtype=bool)
    held = {}
    for a, b, p, v in notes:
        if p < 48 and b - a >= 0.6:
            grid[int(a / 0.05):int(b / 0.05) + 1] = True
            held[p % 12] = held.get(p % 12, 0) + b - a
    drone = grid.mean()
    home = NAMES[max(held, key=held.get)] if held else '-'
    # the melody: held notes in the middle
    mel = [(a, b, p) for a, b, p, v in notes if 57 <= p <= 88 and b - a >= 0.35 and v >= 0.35]
    wait = None
    for i in range(len(mel) - 2):
        if mel[i + 2][0] - mel[i][0] <= 4.0:
            wait = mel[i][0]
            break
    durs = np.array([b - a for a, b, p in mel]) if mel else np.array([0.0])
    pitches = np.array([p for a, b, p in mel]) if mel else np.array([60])
    steps = np.abs(np.diff(pitches)) if len(mel) > 1 else np.array([0])
    # the figure: short notes that repeat the pitch before them
    short = sorted((a, p) for a, b, p, v in notes if b - a < 0.22 and p >= 48)
    by = {}
    rep = 0
    for a, p in short:
        if p in by and a - by[p] < 0.6:
            rep += 1
        by[p] = a
    rows.append((f[:-4], wait, drone, home, np.median(durs), np.percentile(durs, 80), int(np.median(pitches)), (steps <= 2).mean(), (steps >= 5).mean(), rep / max(1, len(short)), len(short) / end))
    r = rows[-1]
    print(f'{r[0]:22s} wait {r[1] if r[1] is not None else -1:5.1f}s | drone {100 * r[2]:3.0f}% on {r[3]:2s} | melody notes {r[4]:.2f}s (long ones {r[5]:.2f}s) around {name(r[6]):4s} | by step {100 * r[7]:3.0f}% leaps {100 * r[8]:3.0f}% | figure: {r[10]:4.1f} short notes/s, {100 * r[9]:3.0f}% repeated', flush=True)

w = np.array([r[1] for r in rows if r[1] is not None])
print(f'\n{len(rows)} themes. wait before the melody: median {np.median(w):.1f}s (quarter under {np.percentile(w, 25):.1f}, quarter over {np.percentile(w, 75):.1f})')
print(f'drone held: median {100 * np.median([r[2] for r in rows]):.0f}% of the time')
print(f'melody note length: median {np.median([r[4] for r in rows]):.2f}s; long notes {np.median([r[5] for r in rows]):.2f}s; centre {name(int(np.median([r[6] for r in rows])))}')
print(f'melody movement: by step {100 * np.median([r[7] for r in rows]):.0f}%, leaps of a fourth or more {100 * np.median([r[8] for r in rows]):.0f}%')
print(f'hammered figure: {np.median([r[10] for r in rows]):.1f} short notes a second, {100 * np.median([r[9] for r in rows]):.0f}% of them the same pitch struck again')
