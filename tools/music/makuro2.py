"""Battle! Makuro - Call of the Abyss.

Built on what the themes the owner calls peak measure as (scripts/analyse-theme.py):
one home note held under the whole piece (D), tension from the semitones either side of
it (E-flat above, C-sharp below), melody and bass in front with drums under a third of the
sound, and the weather trio's shape - near silence, then it erupts. No traditional
Japanese instruments: those are the Shrine's (Raishin), not the Abyss's.

The abyss in notes: a contrabass drone on the lowest D, a sonar ping, a slow horn swell
bending up a semitone like something vast turning over, and a melody that keeps being
pulled back down to D.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import *   # noqa

s = Song(bpm=172)
trumpet = s.part('trumpets', TRUMPET, volume=112, pan=54, reverb=50)
brass = s.part('brass', BRASS, volume=96, pan=72, reverb=50)
horn = s.part('horns', HORN, volume=100, pan=40, reverb=60)
strings = s.part('strings', STRINGS, volume=92, pan=64, reverb=60)
trem = s.part('tremolo', TREMOLO, volume=84, pan=64, reverb=60)
cb = s.part('contrabass', CONTRABASS, volume=118, pan=64, reverb=40)
bass = s.part('bass', SLAP_BASS, volume=120, pan=64, reverb=10)
piano = s.part('piano', PIANO, volume=104, pan=60, reverb=30)
choir = s.part('choir', CHOIR, volume=88, pan=64, reverb=80)
timp = s.part('timpani', TIMPANI, volume=120, pan=64, reverb=50)
bell = s.part('bells', BELLS, volume=96, pan=70, reverb=80)
ping = s.part('sonar', GLOCK, volume=100, pan=84, reverb=110)
drums = s.part('drums', 0, volume=92, drums=True, reverb=30)
VARIANT = os.environ.get('VARIANT', 'a')
# a: trumpets lead, a square wave under them for the console edge. b: a saw lead and strings carry it, brass only punches.
lead = s.part('lead', SQUARE if VARIANT == 'a' else SAW, volume=78 if VARIANT == 'a' else 108, pan=64, reverb=30)
s.offset_bars = -4   # the old eight-bar opening is gone: the piece starts at what was bar 4


def drone(bar, bars, vel=70, pitch='D1'):
    for b in range(bars):
        s.note(cb, bar + b, 0, pitch, 4.0, vel)
        s.note(cb, bar + b, 0, n(pitch) + 12, 4.0, vel - 10)


def sonar(bar, vel=84):
    """One ping and its echoes, each quieter."""
    for k, v in enumerate([vel, vel - 26, vel - 44]):
        s.note(ping, bar, k * 1.5, 'A6', 0.5, v)


def kit(bar, fill=False, crash=False, ride=False):
    """The battle beat: kick on 1 and the push before 3, snare on 2 and 4, sixteenth hats."""
    if crash:
        s.note(drums, bar, 0, CRASH, 2, 108)
    for q in (0, 0.75, 2, 2.5):
        s.note(drums, bar, q, KICK, 0.25, 104)
    if not fill:
        for q in (1, 3):
            s.note(drums, bar, q, SNARE, 0.25, 100)
        for k in range(16):
            s.note(drums, bar, k * 0.25, RIDE if ride else HAT, 0.2, 78 if k % 2 == 0 else 54)
    else:
        s.note(drums, bar, 1, SNARE, 0.25, 100)
        for k in range(8):
            s.note(drums, bar, k * 0.25, HAT, 0.2, 70 if k % 2 == 0 else 50)
        # a roll down the toms into the next bar
        for k, tom in enumerate([HIGH_TOM, HIGH_TOM, MID_TOM, MID_TOM, LOW_TOM, LOW_TOM, SNARE, SNARE]):
            s.note(drums, bar, 2 + k * 0.25, tom, 0.25, 84 + k * 4)


def bass_bar(bar, root, neighbour=None, vel=106):
    """Eighths in octaves on the root; the last two step to its semitone neighbour."""
    r = n(root)
    nb = n(neighbour) if neighbour else r
    for k, p in enumerate([r, r + 12, r, r + 12, r, r + 12, nb, nb + 12]):
        s.note(bass, bar, k * 0.5, p, 0.45, vel if k % 2 == 0 else vel - 14)


def ostinato(bar, root, vel=84, flat2=True):
    """The low piano figure: root, fifth, octave, and the semitone above the octave."""
    r = n(root)
    top = r + 13 if flat2 else r + 14
    fig = [r, r + 7, r + 12, r + 7, top, r + 12, r + 7, r + 12]
    for k in range(16):
        s.note(piano, bar, k * 0.25, fig[k % 8], 0.22, vel if k % 4 == 0 else vel - 16)
        if k % 4 == 0:
            s.note(piano, bar, k * 0.25, r - 12, 0.22, vel - 6)


def stabs(bar, chord, beats=(0.5, 1.5, 2.5, 3.5), vel=74):
    for q in beats:
        for p in chord:
            s.note(strings, bar, q, p, 0.3, vel)


# ---------------------------------------------------------------- intro: 4 bars
# v2 (owner: "the beginning i dont fuck with"): no slow build. The fight starts on the first
# beat, the way an encounter does - a unison hit and a chromatic cascade falling two octaves,
# again a semitone higher, then two bars of the bass and piano figure alone before the theme.
CASCADE = ['D6', 'C#6', 'C6', 'B5', 'Bb5', 'A5', 'Ab5', 'G5', 'F#5', 'F5', 'E5', 'Eb5', 'D5', 'C#5',
           'C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', 'F#4', 'F4', 'E4', 'Eb4', 'D4', 'C#4', 'D4', 'Eb4']
for i, (b, hit) in enumerate(((4, 'D'), (5, 'Eb'))):
    s.note(drums, b, 0, CRASH, 2, 118)
    s.note(drums, b, 0, KICK, 0.5, 112)
    s.note(timp, b, 0, hit + '2', 1.0, 124)
    for part, octave, v in ((trumpet, 5, 120), (brass, 4, 116), (horn, 3, 112), (cb, 1, 112), (lead, 5, 110)):
        s.note(part, b, 0, hit + str(octave), 0.45, v)
    for k in range(14):
        pitch = CASCADE[i * 14 + k]
        s.note(strings, b, 0.5 + k * 0.25, pitch, 0.24, 100 - k)
        s.note(piano, b, 0.5 + k * 0.25, n(pitch) - 12, 0.24, 96 - k)
    for q in (2, 3, 3.5):
        s.note(timp, b, q, hit + '2', 0.5, 96)
for b in (6, 7):
    bass_bar(b, 'D2', 'Eb2', vel=100 if b == 6 else 110)
    ostinato(b, 'D3', vel=80 if b == 6 else 92)
    s.note(cb, b, 0, 'D1', 4.0, 88)
    for q in range(4):
        s.note(drums, b, q, KICK, 0.25, 96 + (b - 6) * 10)
    for q in range(8):
        s.note(drums, b, q * 0.5, HAT, 0.2, 66)
    s.note(timp, b, 0, 'D2', 1.0, 108)
    s.note(timp, b, 2.5, 'D2', 0.5, 100)
sonar(6, vel=70)
for part, octave in ((trumpet, 4), (brass, 3), (horn, 3)):
    base = 12 * (octave + 1) + 2
    s.note(part, 7, 0, base, 0.45, 112)
    s.note(part, 7, 1.5, base + 1, 0.45, 114)
    s.note(part, 7, 2, base, 0.45, 116)
# the run up into the theme: strings and piano climbing chromatically through the last beat
run = ['A3', 'Bb3', 'B3', 'C4', 'C#4', 'D4', 'E4', 'F4']
for k, p in enumerate(run):
    s.note(strings, 7, 3 + k * 0.125, p, 0.125, 80 + k * 5)
    s.note(piano, 7, 3 + k * 0.125, n(p) + 12, 0.125, 76 + k * 5)
for k in range(8):
    s.note(drums, 7, 3 + k * 0.125, SNARE, 0.12, 70 + k * 7)

# ---------------------------------------------------------------- the theme
# Eight bars over a D pedal: i, i, bII, i, bVI, bVI, V, V - the E-flat and the C-sharp
# are the only places the harmony leans away from D, and it is pulled straight back.
HARM = [
    ('D2', 'Eb2', ['D4', 'F4', 'A4']), ('D2', 'Eb2', ['D4', 'F4', 'A4']),
    ('D2', 'Eb2', ['Eb4', 'G4', 'Bb4']), ('D2', 'C#2', ['D4', 'F4', 'A4']),
    ('D2', 'Eb2', ['D4', 'F4', 'Bb4']), ('D2', 'Eb2', ['D4', 'F4', 'Bb4']),
    ('A1', 'Bb1', ['C#4', 'E4', 'A4']), ('A1', 'C#2', ['C#4', 'E4', 'G4']),
]
THEME_1 = [
    [('D5', 0.75), ('D5', 0.75), ('A5', 0.5), ('A5', 1), ('G5', 0.5), ('F5', 0.5)],
    [('Eb5', 0.75), ('Eb5', 0.75), ('G5', 0.5), ('F5', 1), ('Eb5', 0.5), ('D5', 0.5)],
    [('D5', 0.5), ('F5', 0.5), ('A5', 0.5), ('D6', 1.5), ('C6', 0.5), ('Bb5', 0.5)],
    [('A5', 3), (None, 0.5), ('A5', 0.5)],
    [('Bb5', 0.75), ('Bb5', 0.75), ('D6', 0.5), ('C6', 1), ('Bb5', 0.5), ('A5', 0.5)],
    [('G5', 0.75), ('G5', 0.75), ('Bb5', 0.5), ('A5', 1), ('G5', 0.5), ('F5', 0.5)],
    [('E5', 0.5), ('G5', 0.5), ('A5', 0.5), ('C#6', 1.5), ('Bb5', 1)],
    [('A5', 3), (None, 1)],
]
THEME_2 = THEME_1[:6] + [
    [('E5', 0.5), ('G5', 0.5), ('A5', 0.5), ('C#6', 1.5), ('E6', 1)],
    [('D6', 3.5), (None, 0.5)],
]


def theme(bar, melody, big=False, ride=False):
    for k in range(8):
        root, nb, chord = HARM[k]
        b = bar + k
        kit(b, fill=(k == 7), crash=(k == 0), ride=ride)
        bass_bar(b, root, nb)
        ostinato(b, 'D3' if root == 'D2' else 'A2', flat2=(root == 'D2'))
        stabs(b, chord, vel=78 if big else 70)
        s.note(cb, b, 0, 'D1' if root == 'D2' else 'A1', 4.0, 84)
        if VARIANT == 'a':
            s.line(trumpet, b, melody[k], vel=118)
            s.line(lead, b, melody[k], vel=96)
        else:
            s.line(lead, b, melody[k], vel=112)
            s.line(strings, b, melody[k], vel=100)
            for q in (0, 1.5, 3):                       # brass punches the chord instead
                for cp in chord:
                    s.note(trumpet, b, q, n(cp) + 12, 0.35, 92)
        # horns: the line an octave down the second time through, long chord tones the first
        if big:
            s.line(horn, b, [(n(p) - 12 if p else None, d) for p, d in melody[k]], vel=100)
            s.line(strings, b, [(n(p) + 12 if p else None, d) for p, d in melody[k]], vel=84)
            s.note(choir, b, 0, chord[0], 4.0, 76)
            s.note(choir, b, 0, chord[2], 4.0, 72)
            if k % 2 == 0:
                s.note(bell, b, 0, 'D5', 2.0, 90)
        else:
            s.note(horn, b, 0, chord[0], 4.0, 80)
            s.note(horn, b, 0, n(chord[1]) - 12, 4.0, 76)
        if k in (0, 4):
            s.note(timp, b, 0, 'D2' if root == 'D2' else 'A2', 1.0, 112)
        if k == 7:
            for q, p in ((2, 'A2'), (2.5, 'A2'), (3, 'D2'), (3.5, 'A2')):
                s.note(timp, b, q, p, 0.5, 108)


theme(8, THEME_1)
theme(16, THEME_2, big=True)

# ---------------------------------------------------------------- B: 8 bars, away from D
# The one stretch that leaves the pedal: iv, iv, bII, bII, bVI, III, V, V. Strings sing,
# trumpets punch the chord, horns hold it. It ends hanging on the C-sharp.
B_HARM = [
    ('G1', ['G3', 'Bb3', 'D4']), ('G1', ['G3', 'Bb3', 'D4']),
    ('Eb2', ['Eb3', 'G3', 'Bb3']), ('Eb2', ['Eb3', 'G3', 'Bb3']),
    ('Bb1', ['F3', 'Bb3', 'D4']), ('F1', ['F3', 'A3', 'C4']),
    ('A1', ['E3', 'A3', 'C#4']), ('A1', ['E3', 'G3', 'C#4']),
]
B_MEL = [
    [('D5', 2), ('G5', 2)],
    [('Bb5', 3), ('A5', 1)],
    [('G5', 2), ('Eb5', 2)],
    [('G5', 4)],
    [('F5', 2), ('Bb5', 2)],
    [('C6', 3), ('A5', 1)],
    [('A5', 2), ('C#6', 2)],
    [('E6', 2), ('E6', 0.5), ('D6', 0.5), ('C#6', 0.5), ('Bb5', 0.5)],
]
for k in range(8):
    root, chord = B_HARM[k]
    b = 24 + k
    kit(b, fill=(k == 7), crash=(k in (0, 4)), ride=True)
    bass_bar(b, root, None)
    s.note(cb, b, 0, root, 4.0, 86)
    r = n(root) + 24
    fig = [r, r + 7, r + 12, r + 7, r + 15 if k < 2 else r + 16, r + 12, r + 7, r + 12]
    for q in range(16):
        s.note(piano, b, q * 0.25, fig[q % 8], 0.22, 80 if q % 4 == 0 else 64)
    s.line(strings, b, B_MEL[k], vel=104)
    s.line(strings, b, [(n(p) - 12 if p else None, d) for p, d in B_MEL[k]], vel=84)
    for p in chord:
        s.note(horn, b, 0, p, 4.0, 84)
        for q in (0, 1.5, 3):
            s.note(trumpet, b, q, n(p) + 12, 0.4, 96)
            s.note(brass, b, q, p, 0.4, 92)
    s.note(choir, b, 0, n(chord[2]) + 12, 4.0, 72)

# ---------------------------------------------------------------- bridge: 8 bars, back in the trench
drone(32, 8, vel=72)
for k in range(8):
    b = 32 + k
    s.note(timp, b, 0, 'D2', 0.5, 70 + k * 5)             # the heartbeat
    s.note(timp, b, 0.5, 'D2', 0.5, 56 + k * 5)
    if k % 2 == 0:
        sonar(b, vel=86)
    s.note(choir, b, 0, 'D4', 4.0, 48 + k * 6)             # the cluster, swelling
    s.note(choir, b, 0, 'Eb4', 4.0, 44 + k * 6)
    if k >= 2:
        s.note(choir, b, 0, 'A3', 4.0, 44 + k * 5)
    if k >= 4:                                             # the piano figure creeps back in
        ostinato(b, 'D3', vel=52 + (k - 4) * 9)
        bass_bar(b, 'D2', 'Eb2', vel=70 + (k - 4) * 9)
    if k >= 4:
        for q in range(8):
            s.note(drums, b, q * 0.5, HAT, 0.2, 50 + (k - 4) * 6)
    if k >= 6:                                             # snare roll into the reprise
        for q in range(16):
            s.note(drums, b, q * 0.25, SNARE, 0.2, 48 + (k - 6) * 24 + q * 2)
        for p in ('D4', 'Eb4', 'A4'):
            s.note(trem, b, 0, p, 4.0, 70 + (k - 6) * 16)
for k, p in enumerate(run):
    s.note(strings, 39, 3 + k * 0.125, n(p) + 12, 0.125, 84 + k * 5)
# the horn swell once more, under the bridge
for bar in (33, 35):
    s.bend(horn, bar, 0, 0)
    s.note(horn, bar, 0, 'D2', 4.0, 70)
    for k in range(9):
        s.bend(horn, bar, 1 + k * 0.125, int(4096 * k / 8))
    for k in range(9):
        s.bend(horn, bar, 2.5 + k * 0.125, int(4096 * (8 - k) / 8))
    s.bend(horn, bar + 1, 0, 0)

# ---------------------------------------------------------------- reprise: the theme, everything in
theme(40, THEME_1, big=True, ride=True)
theme(48, THEME_2, big=True, ride=True)
# the last chord: D in every octave, and one more ping as it sinks
for part, p in ((trumpet, 'D5'), (brass, 'D4'), (horn, 'D3'), (strings, 'D5'), (strings, 'A4'), (cb, 'D1'), (choir, 'D4'), (bell, 'D5')):
    s.note(part, 56, 0, p, 4.0, 112)
s.note(drums, 56, 0, CRASH, 4, 116)
s.note(timp, 56, 0, 'D2', 2.0, 122)
sonar(57, vel=80)
drone(57, 1, vel=56)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'makuro-v2' + VARIANT)
os.makedirs(os.path.dirname(out), exist_ok=True)
print(s.render(out))
