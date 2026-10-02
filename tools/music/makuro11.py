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
strings = s.part('strings', STRINGS, volume=76, pan=64, reverb=60)
trem = s.part('tremolo', TREMOLO, volume=84, pan=64, reverb=60)
cb = s.part('contrabass', CONTRABASS, volume=118, pan=64, reverb=40)
bass = s.part('bass', SLAP_BASS, volume=120, pan=64, reverb=10)
piano = s.part('piano', 1, volume=127, pan=64, reverb=25)   # v9: bright piano, as loud as it goes (owner: "we dont hear the piano well enough")
choir = s.part('choir', CHOIR, volume=88, pan=64, reverb=80)
timp = s.part('timpani', TIMPANI, volume=120, pan=64, reverb=50)
bell = s.part('bells', BELLS, volume=96, pan=70, reverb=80)
ping = s.part('sonar', GLOCK, volume=100, pan=84, reverb=110)
drums = s.part('drums', 0, volume=92, drums=True, reverb=30)
VARIANT = os.environ.get('VARIANT', 'a')
harp = s.part('harp', HARP, volume=78, pan=78, reverb=70)
bones = s.part('trombones', TROMBONE, volume=104, pan=58, reverb=50)
# a: trumpets lead, a square wave under them for the console edge. b: a saw lead and strings carry it, brass only punches.
lead = None   # v5: no synth lead - sixteen channels, and the deep wants low brass, not a square wave
s.offset_bars = 0


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
    """v5: the two notes of the opening, still going under everything - root, root, the semitone
    above, grouped 3+3+2. Whatever the harmony does, the thing in the water is still there."""
    r = n(root)
    up = r + 1
    for k, p in enumerate([r, r, up, r, r, up, r, up]):
        s.note(bass, bar, k * 0.5, p, 0.45, vel if k in (0, 3, 6) else vel - 16)
        if k in (0, 3, 6):
            s.note(bass, bar, k * 0.5, p + 12, 0.3, vel - 24)


def ostinato(bar, root, vel=84, flat2=True):
    """v5: a wave. Sixteenths climbing the chord and falling back, harp an octave over the piano."""
    r = n(root)
    two = 1 if flat2 else 2
    shape = [0, 7, 12, 12 + two, 15, 19, 24, 19, 15, 12 + two, 12, 7, 0, 7, 12, 7]
    for k, step in enumerate(shape):
        crest = 1 - abs(k - 6) / 10                       # louder at the top of the wave
        v = int(vel - 22 + 26 * crest)
        s.note(harp, bar, k * 0.25, r + step + 12, 0.3, v - 8)
    s.note(piano, bar, 0, r - 12, 1.0, vel)


def stabs(bar, chord, beats=None, vel=74):
    """v5: tide. The chord held for the bar, swelling through odd bars and drawing back in even ones."""
    for p in chord:
        s.note(strings, bar, 0, p, 4.0, vel + 10)
        s.note(strings, bar, 0, n(p) - 12, 4.0, vel)
    rising = bar % 2 == 0
    for k in range(9):
        level = 58 + int(60 * (k / 8 if rising else 1 - k / 8))
        s.cc(strings, bar, k * 0.5 if k < 8 else 3.95, 11, level)


# ---------------------------------------------------------------- intro: 8 bars
# v3 (owner: "inspire from jaws"): something under the water, coming closer. Two notes a
# semitone apart, low - the D and E-flat the whole theme is built on - first alone with
# silence after them, then closer together, then without a gap, getting louder, the brass
# snapping at them, until it breaks the surface into the theme.
low = s.part('low strings', CELLO, volume=124, pan=64, reverb=50)
tuba = bones   # the trombones take the tuba's line: the channels are all spoken for


def pair(bar, beat, step, vel, parts=(cb, low)):
    """D then E-flat, each `step` beats long."""
    for k, pitch in enumerate(('D', 'Eb')):
        for part, octave in zip(parts, (1, 2, 1, 3)):
            s.note(part, bar, beat + k * step, pitch + str(octave), step * 0.8, vel)


pair(0, 0, 1, 76)                      # two notes, then nothing
pair(2, 0, 1, 84)                      # again
pair(3, 0, 1, 90)                      # and again, sooner
pair(3, 2, 1, 94)
for b in (4, 5, 6, 7):                 # no more gaps: eighths, swelling
    for k in range(4):
        v = 92 + (b - 4) * 7 + k
        pair(b, k, 0.5, v, parts=(cb, low, tuba, piano) if b >= 5 else (cb, low))
    if b >= 5:
        s.note(timp, b, 0, 'D2', 0.5, 96 + (b - 5) * 8)
        s.note(timp, b, 2, 'D2', 0.5, 92 + (b - 5) * 8)
    if b >= 6:                         # the brass snaps: a tritone over the D, off the beat
        for q in ((1.5, 3.5) if b == 6 else (0.5, 1.5, 2.5)):
            for part, pitches in ((trumpet, ('D5', 'Ab5')), (brass, ('D4', 'Ab4')), (horn, ('Ab3',))):
                for pitch in pitches:
                    s.note(part, b, q, pitch, 0.3, 104 + (b - 6) * 10)
        for p_ in ('D3', 'Eb3', 'Ab3'):
            s.note(trem, b, 0, p_, 4.0, 60 + (b - 6) * 22)
# v8 (owner: "edit the start a bit to match"): the opening in the theme's own voice. The low
# piano hammers the two notes with the strings from the first one, and over the last two
# bars it starts the theme's riff rhythm on nothing but D and E-flat, an octave higher each
# bar - so the riff is not a new idea when the theme lands, it is the two notes sped up.
for bar_, beats_ in ((0, (0, 1)), (2, (0, 1)), (3, (0, 1, 2, 3))):
    for k_, q_ in enumerate(beats_):
        pitch_ = ('D', 'Eb')[k_ % 2]
        s.note(piano, bar_, q_, pitch_ + '1', 0.9, 104)
        s.note(piano, bar_, q_, pitch_ + '2', 0.9, 98)
START_RIFF = ['D', 'D', None, 'D', None, 'D', 'Eb', None, 'D', None, 'D', 'D', None, 'Eb', 'Eb', 'D']
for bar_, octave_, vel_ in ((6, 3, 92), (7, 4, 108)):
    for q_, name_ in enumerate(START_RIFF):
        if name_ is None or (bar_ == 7 and q_ >= 12):       # the last beat belongs to the run up
            continue
        s.note(piano, bar_, q_ * 0.25, name_ + str(octave_), 0.22, vel_ + (10 if q_ in (0, 3, 6, 10) else 0))
        s.note(piano, bar_, q_ * 0.25, name_ + str(octave_ + 1), 0.22, vel_ - 6)
    for q_ in range(16):
        s.note(drums, bar_, q_ * 0.25, HAT, 0.2, (58 if q_ % 2 else 76) + (bar_ - 6) * 8)
s.note(drums, 4, 0, KICK, 0.5, 90)
for b in (5, 6, 7):
    for q in range(4):
        s.note(drums, b, q, KICK, 0.25, 84 + (b - 5) * 10)
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
# v5 (owner: "the melody is kinda mid... this one can stay more grave than most pokemon themes").
# Long notes, low, and the first bar is the opening itself: D, E-flat. Each bar leans out a
# little further - a third, then the tritone - and is drawn back down.
# v7 (owner: "the melody still isnt it... a more gen 4 style", "HSsg doesnt do for me").
# Diamond and Pearl's legendary themes are not sung: a piano hammers a syncopated riff of
# repeated notes in octaves, the strings double it, and low brass lays long notes over the
# top. So the "melody" is a riff - sixteen slots a bar, None is a rest - and the tune the
# ear keeps is the brass line: D, E-flat, D, the opening itself, very slow.
D, Eb, F, C, G, Ab, A, Bb, Cs = 'D5', 'Eb5', 'F5', 'C5', 'G5', 'Ab5', 'A5', 'Bb5', 'C#5'
_ = None
RIFF = [
    [D, D, _, D, _, D, Eb, _, D, _, C, D, _, F, Eb, D],
    [D, D, _, D, _, D, Eb, _, F, _, Ab, G, _, F, Eb, D],
    [Eb, Eb, _, Eb, _, Eb, F, _, Eb, _, D, Eb, _, G, F, Eb],
    [D, D, _, D, _, F, Eb, _, D, Cs, D, _, A, Ab, G, F],
    [D, D, _, D, _, D, Eb, _, D, _, C, D, _, F, Eb, D],
    [F, F, _, F, _, F, G, _, Ab, _, G, F, _, Eb, D, Cs],
    [A, A, _, A, _, A, Bb, _, A, _, G, A, _, 'C#6', Bb, A],
    [A, _, A, Bb, _, A, _, G, 'A4', 'Bb4', 'B4', 'C5', 'C#5', 'D5', 'E5', 'F5'],
]
RIFF_END = RIFF[:7] + [[A, _, A, Bb, _, A, _, 'C#6', 'D6', _, _, _, 'D6', _, 'D6', _]]
# the brass over it: (pitch, beats). Low, long, and it is the opening's two notes.
BRASS_LINE = [
    [('D3', 4)], [('Eb3', 3), ('D3', 1)], [('Eb3', 4)], [('D3', 2), ('A3', 2)],
    [('D3', 4)], [('F3', 2), ('Ab3', 2)], [('A3', 3), ('Bb3', 1)], [('A3', 4)],
]
BRASS_END = BRASS_LINE[:6] + [[('A3', 2), ('C#4', 2)], [('D4', 4)]]


def theme(bar, riff, brass_line, big=False, ride=False):
    for k in range(8):
        root, nb, chord = HARM[k]
        b = bar + k
        kit(b, fill=(k == 7), crash=(k == 0), ride=ride)
        bass_bar(b, root, nb)
        ostinato(b, 'D3' if root == 'D2' else 'A2', flat2=(root == 'D2'))
        stabs(b, chord, vel=70 if big else 62)
        s.note(cb, b, 0, 'D1' if root == 'D2' else 'A1', 4.0, 84)
        for q, pitch in enumerate(riff[k]):                    # the riff, piano in octaves
            if pitch is None:
                continue
            accent = 127 if q in (0, 3, 6, 10, 13) else 112
            s.note(piano, b, q * 0.25, pitch, 0.22, accent)
            s.note(piano, b, q * 0.25, n(pitch) - 12, 0.22, accent - 4)
            s.note(piano, b, q * 0.25, n(pitch) + 12, 0.22, accent - 12)   # three octaves of it, always
        s.line(bones, b, brass_line[k], vel=118)               # the long notes over it
        s.line(bones, b, [(n(p) - 12, d) for p, d in brass_line[k]], vel=108)
        s.line(horn, b, [(n(p) + 12, d) for p, d in brass_line[k]], vel=100)
        if big:
            s.line(trumpet, b, [(n(p) + 24, d) for p, d in brass_line[k]], vel=98)
            s.note(choir, b, 0, chord[0], 4.0, 76)
            s.note(choir, b, 0, chord[2], 4.0, 72)
            if k % 2 == 0:
                s.note(bell, b, 0, 'D5', 2.0, 90)
        if k in (0, 4):
            s.note(timp, b, 0, 'D2' if root == 'D2' else 'A2', 1.0, 112)
        if k == 7:
            for q, p in ((2, 'A2'), (2.5, 'A2'), (3, 'D2'), (3.5, 'A2')):
                s.note(timp, b, q, p, 0.5, 108)


theme(8, RIFF, BRASS_LINE)
theme(16, RIFF_END, BRASS_END, big=True)

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
def section_b(bar, big=False):
    for k in range(8):
        root, chord = B_HARM[k]
        b = bar + k
        kit(b, fill=(k == 7), crash=(k in (0, 4)), ride=True)
        bass_bar(b, root, None)
        s.note(cb, b, 0, root, 4.0, 86)
        r = n(root) + 24
        fig = [r, r + 7, r + 12, r + 7, r + 15 if k < 2 else r + 16, r + 12, r + 7, r + 12]
        for q in range(16):
            s.note(piano, b, q * 0.25, fig[q % 8], 0.22, 96 if q % 4 == 0 else 80)
        s.line(strings, b, B_MEL[k], vel=108)
        s.line(strings, b, [(n(p) - 12 if p else None, d) for p, d in B_MEL[k]], vel=88)
        for p in chord:
            s.note(horn, b, 0, p, 4.0, 84)
            for q in (0, 1.5, 3):
                s.note(brass, b, q, p, 0.4, 92)
                if not big:
                    s.note(trumpet, b, q, n(p) + 12, 0.4, 96)
        if big:                                            # second time: the trumpets sing it too
            s.line(trumpet, b, [(n(p) - 12 if p else None, d) for p, d in B_MEL[k]], vel=110)
            s.note(choir, b, 0, chord[0], 4.0, 80)
            s.note(timp, b, 0, root, 1.0, 108)
        s.note(choir, b, 0, n(chord[2]) + 12, 4.0, 72)


def bridge(bar):
    """Back in the trench: drone, heartbeat, the cluster swelling, the figure creeping back."""
    drone(bar, 8, vel=72)
    for k in range(8):
        b = bar + k
        s.note(timp, b, 0, 'D2', 0.5, 70 + k * 5)
        s.note(timp, b, 0.5, 'D2', 0.5, 56 + k * 5)
        if k % 2 == 0:
            sonar(b, vel=86)
        s.note(choir, b, 0, 'D4', 4.0, 48 + k * 6)
        s.note(choir, b, 0, 'Eb4', 4.0, 44 + k * 6)
        if k >= 2:
            s.note(choir, b, 0, 'A3', 4.0, 44 + k * 5)
        if k >= 4:
            ostinato(b, 'D3', vel=52 + (k - 4) * 9)
            bass_bar(b, 'D2', 'Eb2', vel=70 + (k - 4) * 9)
            for q in range(8):
                s.note(drums, b, q * 0.5, HAT, 0.2, 50 + (k - 4) * 6)
        if k >= 6:
            for q in range(16):
                s.note(drums, b, q * 0.25, SNARE, 0.2, 48 + (k - 6) * 24 + q * 2)
            for p in ('D4', 'Eb4', 'A4'):
                s.note(trem, b, 0, p, 4.0, 70 + (k - 6) * 16)
    for hb in (bar + 1, bar + 3):
        s.bend(horn, hb, 0, 0)
        s.note(horn, hb, 0, 'D2', 4.0, 70)
        for k in range(9):
            s.bend(horn, hb, 1 + k * 0.125, int(4096 * k / 8))
        for k in range(9):
            s.bend(horn, hb, 2.5 + k * 0.125, int(4096 * (8 - k) / 8))
        s.bend(horn, hb + 1, 0, 0)


def ascent(bar, roots=(0, 3, 6)):
    """v10 (owner: "add a small epic transition so its not as repetitive"). It comes up out of
    the trench. The riff and a brass call climb a minor third every two bars - D, F, A-flat,
    never settling, each step higher and louder - and then the whole orchestra plants itself
    on A and hammers the two notes one last time before the theme comes back."""
    for step, root in enumerate(roots):                     # semitones above D
        for half in (0, 1):
            b = bar + step * 2 + half
            lift = 14 * step
            kit(b, fill=False, crash=(half == 0), ride=True)
            r = n('D2') + root
            for k, p in enumerate([r, r, r + 1, r, r, r + 1, r, r + 1]):
                s.note(bass, b, k * 0.5, p, 0.45, 104)
            s.note(cb, b, 0, r - 12, 4.0, 90)
            s.note(timp, b, 0, r, 1.0, 104 + step * 6)
            s.note(timp, b, 2.5, r, 0.5, 96 + step * 6)
            for q, pitch in enumerate(RIFF[half]):          # the riff, carried up with it
                if pitch is None:
                    continue
                for octave in (-12, 0, 12):
                    s.note(piano, b, q * 0.25, n(pitch) + root + octave, 0.22, min(127, 104 + lift // 2))
            # the call: root, fifth, octave - then held - trombones and horns low, trumpets on top
            call = [(r + 24, 1), (r + 31, 1), (r + 36, 2)] if half == 0 else [(r + 36, 1.5), (r + 37, 0.5), (r + 36, 2)]
            s.line(bones, b, call, vel=min(127, 108 + lift))
            s.line(horn, b, call, vel=min(127, 100 + lift))
            s.line(trumpet, b, [(p + 12, d) for p, d in call], vel=min(127, 100 + lift))
            for p in (r + 36, r + 39, r + 43):              # the minor chord under it, voices and tremolo
                s.note(choir, b, 0, p, 4.0, 70 + lift)
                s.note(trem, b, 0, p, 4.0, 66 + lift)
            for k in range(9):                               # strings swelling into each new step
                s.cc(strings, b, k * 0.5 if k < 8 else 3.95, 11, 70 + k * 6)
    # a bar on A: everyone, the two notes (A, B-flat); then a bar of drums and the run up
    b = bar + 6
    s.note(drums, b, 0, CRASH, 4, 120)
    for q, (pitch, dur) in zip((0, 1, 2, 2.5, 3), (('A', 0.9), ('A', 0.9), ('A', 0.45), ('Bb', 0.45), ('A', 0.9))):
        for part, octave, v in ((trumpet, 5, 122), (brass, 4, 118), (bones, 3, 122), (horn, 3, 116), (cb, 1, 118), (piano, 2, 127), (piano, 4, 124), (strings, 5, 110)):
            s.note(part, b, q, pitch + str(octave), dur, v)
        s.note(timp, b, q, pitch + '2', dur, 124)
        s.note(drums, b, q, KICK, 0.25, 116)
        s.note(drums, b, q, SNARE, 0.25, 110)
    b = bar + 7
    for q in range(16):
        s.note(drums, b, q * 0.25, SNARE if q % 2 else LOW_TOM, 0.2, 76 + q * 3)
        s.note(timp, b, q * 0.25, 'A2', 0.2, 80 + q * 3)
    for p in ('A3', 'C#4', 'E4', 'G4'):
        s.note(trem, b, 0, p, 4.0, 104)
        s.note(choir, b, 0, p, 3.0, 96)
    climb = ['A3', 'Bb3', 'C4', 'C#4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'C#5', 'D5', 'E5', 'F5', 'G5']
    for k, p in enumerate(climb):
        s.note(strings, b, 2 + k * 0.125, p, 0.125, 84 + k * 2)
        s.note(piano, b, 2 + k * 0.125, n(p) + 12, 0.125, 100 + k)


# v11 (owner: "try to hit 2:40 as our standard"): forty more bars that are not repeats.
C_MEL = [
    [('D4', 2), ('Eb4', 2)],
    [('D4', 1), ('F4', 1), ('Eb4', 2)],
    [('D4', 1), ('A4', 2), ('Ab4', 1)],
    [('G4', 2), ('Eb4', 1), ('D4', 1)],
    [('D4', 1), ('Eb4', 1), ('G4', 2)],
    [('Bb4', 2), ('A4', 1), ('Ab4', 1)],
    [('G4', 1), ('Bb4', 1), ('A4', 1), ('C#5', 1)],
    [('D5', 4)],
]


def leviathan(bar, up=0, big=False):
    """The thing itself, seen whole. The riff stops; the drums drop to half time; and the low
    brass finally sings the line the opening only hinted at - D, E-flat, and each bar leaning
    a little further out before it is pulled back. `up` moves it (5 = a fourth higher)."""
    root = n('D2') + up
    for k in range(8):
        b = bar + k
        if k == 0:
            s.note(drums, b, 0, CRASH, 4, 114)
        for q in (0, 1.5, 2.5):                              # half time: one heavy backbeat
            s.note(drums, b, q, KICK, 0.25, 110)
        s.note(drums, b, 2, SNARE, 0.25, 114)
        s.note(drums, b, 3.5, LOW_TOM, 0.25, 92)
        for q in range(8):
            s.note(drums, b, q * 0.5, RIDE, 0.2, 74 if q % 2 == 0 else 54)
        if k == 7:
            for q, tom in enumerate([MID_TOM, MID_TOM, LOW_TOM, LOW_TOM, SNARE, SNARE, SNARE, SNARE]):
                s.note(drums, b, 3 + q * 0.125, tom, 0.12, 84 + q * 5)
        for q, p in enumerate([root, root, root + 1, root, root, root + 1, root, root + 1]):
            s.note(bass, b, q * 0.5, p, 0.45, 106 if q in (0, 3, 6) else 90)
        s.note(cb, b, 0, root - 12, 4.0, 92)
        s.note(timp, b, 0, root, 1.0, 104)
        # the water: harp and a quieter piano rolling up and back down the chord
        shape = [0, 7, 12, 13, 15, 19, 24, 19, 15, 13, 12, 7, 0, 7, 12, 7]
        for q, step in enumerate(shape):
            crest = 1 - abs(q - 6) / 10
            s.note(harp, b, q * 0.25, root + 24 + step, 0.3, int(64 + 30 * crest))
            s.note(piano, b, q * 0.25, root + 12 + step, 0.24, int(58 + 26 * crest))
        chord = [root + 24, root + 27, root + 31]
        for p in chord:                                      # the tide
            s.note(strings, b, 0, p, 4.0, 84)
            s.note(choir, b, 0, p, 4.0, 72 if not big else 88)
        for q in range(9):
            s.cc(strings, b, q * 0.5 if q < 8 else 3.95, 11, 58 + int(60 * (q / 8 if k % 2 == 0 else 1 - q / 8)))
        line = [(n(p) + up, d) for p, d in C_MEL[k]]
        s.line(bones, b, line, vel=124)                      # the line: trombones in octaves, horns with them
        s.line(bones, b, [(p - 12, d) for p, d in line], vel=112)
        s.line(horn, b, line, vel=110)
        if big:
            s.line(trumpet, b, [(p + 12, d) for p, d in line], vel=112)
            if k % 2 == 0:
                s.note(bell, b, 0, root + 36, 2.0, 92)
    for q in range(9):
        s.cc(strings, bar + 8, 0, 11, 127)


def piano_break(bar):
    """Diamond and Pearl's signature: everything stops and the piano is alone with the riff.
    Two bars bare, then the hats, then the kick, then the roll back into the full band."""
    for k in range(8):
        b = bar + k
        for q, pitch in enumerate(RIFF[k if k < 7 else 0]):
            if pitch is None:
                continue
            accent = 124 if q in (0, 3, 6, 10, 13) else 106
            s.note(piano, b, q * 0.25, pitch, 0.22, accent)
            s.note(piano, b, q * 0.25, n(pitch) - 12, 0.22, accent - 6)
        for q in (0, 1.5, 3):                                # the left hand: low D, 3+3+2
            s.note(piano, b, q, 'D2', 0.4, 112)
            s.note(piano, b, q, 'D1', 0.4, 104)
        if k >= 2:
            for q in range(16):
                s.note(drums, b, q * 0.25, HAT, 0.2, (48 if q % 2 else 66) + (k - 2) * 4)
            s.note(cb, b, 0, 'D1', 4.0, 60 + k * 4)
        if k >= 4:
            for q in range(4):
                s.note(drums, b, q, KICK, 0.25, 92 + (k - 4) * 6)
            for q, p in enumerate(['D2', 'D2', 'Eb2', 'D2', 'D2', 'Eb2', 'D2', 'Eb2']):
                s.note(bass, b, q * 0.5, p, 0.45, 84 + (k - 4) * 6)
            for p in ('D3', 'A3', 'D4'):
                s.note(trem, b, 0, p, 4.0, 56 + (k - 4) * 12)
        if k >= 6:
            for q in range(16):
                s.note(drums, b, q * 0.25, SNARE, 0.2, 50 + (k - 6) * 26 + q * 2)
            s.note(timp, b, 0, 'D2', 1.0, 100)
            s.note(timp, b, 2, 'D2', 1.0, 108)


# ---------------------------------------------------------------- the layout
# intro 0-7 | theme 8-23 | B 24-31 | trench 32-39 | ascent 40-47 | theme 48-55 |
# leviathan 56-71 | piano alone 72-79 | second ascent 80-87 | theme 88-95 | B again 96-103
# B ends hanging on the dominant, so bar 104 can be bar 8: the loop is 8 -> 104 (96 bars,
# 134 s), and the listening file with one more theme fading out is 2:40.
section_b(24)
bridge(32)
ascent(40)
theme(48, RIFF_END, BRASS_END, big=True, ride=True)
leviathan(56)
leviathan(64, up=5, big=True)
piano_break(72)
ascent(80, roots=(5, 8, 11))
theme(88, RIFF_END, BRASS_END, big=True, ride=True)
section_b(96, big=True)
theme(104, RIFF, BRASS_LINE, big=True, ride=True)
LOOP_BARS = (8, 104)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'makuro-v11')
os.makedirs(os.path.dirname(out), exist_ok=True)
print(s.render(out))
