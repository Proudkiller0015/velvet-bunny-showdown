"""Battle! Raishin - Call of the Shrine. Third version, from scratch, on what the real themes are.

Seen through listen.py (the piano rolls of Ho-Oh's, Dialga's and Lugia's themes), a legendary
theme is not a tune with accompaniment. It is:

  1. a drone - root and fifth, held in the bass, for nearly the whole piece;
  2. a hammered figure of repeated notes in octaves and fifths, which is the rhythm;
  3. a long wait: eight to sixteen seconds of 1 and 2 alone before any melody;
  4. then a melody that is SLOW - notes held half a second to two seconds - moving by step,
     in the middle of the range (around B4 to G5), often doubled a third below;
  5. a few bright ornaments far above it.

Every earlier attempt did the opposite (a busy, leaping, high tune straight away over moving
chords) and the owner rejected every melody. This one is built in that order. Ho-Oh's own
pace and scale (120 to the dotted quarter, each beat in three; E with G#, A, B, D), because
"this theme can afford to sound very similar to ho-oh"; Japanese instruments for the Shrine.
Six eighths to the bar; a bar is one second.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import *   # noqa

s = Song(bpm=360, beats_per_bar=6)
trumpet = s.part('trumpets', TRUMPET, volume=118, pan=56, reverb=55)
shaku = s.part('shakuhachi', SHAKUHACHI, volume=116, pan=64, reverb=80)
flute = s.part('flute', FLUTE, volume=100, pan=74, reverb=70)
horn = s.part('horns', HORN, volume=100, pan=40, reverb=60)
bones = s.part('trombones', TROMBONE, volume=104, pan=58, reverb=50)
strings = s.part('strings', STRINGS, volume=96, pan=64, reverb=60)
trem = s.part('tremolo', TREMOLO, volume=84, pan=64, reverb=60)
cb = s.part('contrabass', CONTRABASS, volume=118, pan=64, reverb=40)
bass = s.part('bass', SLAP_BASS, volume=108, pan=64, reverb=10)
koto = s.part('koto', KOTO, volume=120, pan=76, reverb=40)
shami = s.part('shamisen', SHAMISEN, volume=124, pan=52, reverb=25)
choir = s.part('choir', CHOIR, volume=88, pan=64, reverb=90)
taiko = s.part('taiko', TAIKO, volume=127, pan=64, reverb=30)
bell = s.part('temple bell', BELLS, volume=118, pan=64, reverb=110)
piano = s.part('piano', 1, volume=104, pan=60, reverb=30)
drums = s.part('drums', 0, volume=127, drums=True, reverb=30)
FLOOR_TOM_2 = 43
SCALE = [4, 6, 8, 9, 11, 1, 2]     # E F# G# A B C# D, as pitch classes


def third_below(p, shift=0):
    """The scale note two steps under p (the melody's shadow), in the scale moved by `shift`."""
    pcs = [(x + shift) % 12 for x in SCALE]
    pc = p % 12
    if pc not in pcs:
        return p - 3
    target = pcs[(pcs.index(pc) - 2) % 7]
    return p - ((pc - target) % 12)


def drone(bar, bars, root='E', vel=92):
    """1. Root and fifth, low, the whole time."""
    r = n(root + '2')
    for b in range(bar, bar + bars):
        s.note(cb, b, 0, r - 12, 6.0, vel)
        s.note(cb, b, 0, r, 6.0, vel - 8)
        s.note(bones, b, 0, r + 7, 6.0, vel - 26)


def hammer(bar, root='E', level=1.0, top=True):
    """2. The figure: root and fifth struck on every eighth across three octaves, leaning on
    1 and 4. Shamisen in the middle, koto above it, piano an octave under."""
    r = n(root + '4')
    row = [(0, 7), (12,), (7,), (0, 7), (12,), (7,)]
    for k, steps in enumerate(row):
        v = int((116 if k in (0, 3) else 92) * level)
        for st in steps:
            s.note(shami, bar, k, r + st, 0.7, v)
            s.note(piano, bar, k, r + st - 12, 0.7, v - 18)
        if top:
            s.note(koto, bar, k, r + (24 if k in (0, 3) else 19 if k in (2, 5) else 12), 0.7, v - 10)
    for k, p in enumerate([r - 24, r - 12, r - 24, r - 24, r - 12, r - 13]):     # the bass runs with it
        s.note(bass, bar, k, p, 0.8, int((108 if k in (0, 3) else 90) * level))


def kit(bar, level=1.0, crash=False, fill=False):
    if crash:
        s.note(drums, bar, 0, CRASH, 4, 104)
    for beat, size in ((0, 1.0), (3, 0.85)):                 # the big drum (C4 sounds E2 on this sample)
        v = int(120 * size * level)
        s.note(taiko, bar, beat, 'C4', 0.5, v)
        s.note(drums, bar, beat, LOW_TOM, 0.5, v)
        s.note(drums, bar, beat, FLOOR_TOM_2, 0.5, max(1, v - 8))
    s.note(drums, bar, 0, KICK, 0.5, int(112 * level))
    s.note(drums, bar, 2, KICK, 0.5, int(90 * level))
    s.note(drums, bar, 3, SNARE, 0.5, int(120 * level))
    for k in range(6):
        s.note(drums, bar, k, HAT, 0.3, int((76 if k in (0, 3) else 54) * level))
    if fill:
        for k in range(6):
            s.note(drums, bar, 4 + k / 3, SNARE if k % 2 == 0 else LOW_TOM, 0.3, int((90 + k * 6) * level))
    else:
        s.note(drums, bar, 5, SNARE, 0.3, int(68 * level))


def sing(bar, phrase, up=0, big=False, vel=118):
    """4. The melody: trumpets and shakuhachi in unison, the strings a third below and an octave
    below that. Big: flute an octave above, horns an octave under."""
    for k, notes in enumerate(phrase):
        b = bar + k
        line = [(n(p) + up - 12 if p else None, d) for p, d in notes]      # an octave down: around G4, where the real ones sit
        s.line(trumpet, b, line, vel=vel, legato=1.0)
        s.line(shaku, b, line, vel=vel - 6, legato=1.0)
        s.line(bones, b, [(p - 12 if p else None, d) for p, d in line], vel=vel - 14, legato=1.0)
        low = [(third_below(p, up) if p else None, d) for p, d in line]
        s.line(strings, b, low, vel=vel - 16, legato=1.0)
        s.line(strings, b, [(p + 12 if p else None, d) for p, d in line], vel=vel - 24, legato=1.0)
        if big:
            s.line(flute, b, [(p + 12 if p else None, d) for p, d in line], vel=vel - 14, legato=1.0)
            s.line(horn, b, low, vel=vel - 14, legato=1.0)


def sparkle(bar, root='E', vel=84):
    """5. A handful of koto notes far above, falling."""
    r = n(root + '6')
    for k, st in enumerate((12, 7, 4, 0, -5, 0)):
        s.note(koto, bar, k, r + st, 0.9, vel - k * 3)


def battle_call(bar, beat, cells, start, vel=112):
    """The signal a Pokemon battle theme opens on: four notes down by semitones, then again a
    tone lower, about 70 ms a note (the shape of Ruby/Sapphire's and Black/White's openings)."""
    step = 5 / 12
    p, t = n(start), beat
    for c in range(cells):
        for k in range(4):
            v = vel + c * 2 - (0 if k == 0 else 10)
            s.note(trumpet, bar, t, p - k, step, v)
            s.note(strings, bar, t, p - k, step, v - 8)
            s.note(koto, bar, t, p - k + 12, step, v - 4)
            if k == 0:
                s.note(drums, bar, t, SNARE, 0.3, 100)
                s.note(drums, bar, t, LOW_TOM, 0.3, 96)
            t += step
        p -= 2


def strike(bar, beat, pitches, vel=124):
    s.note(drums, bar, beat, CRASH, 3, vel)
    s.note(taiko, bar, beat, 'C4', 0.6, vel)
    s.note(drums, bar, beat, KICK, 0.5, vel)
    s.note(drums, bar, beat, LOW_TOM, 0.5, vel)
    for p in pitches:
        for part, sh in ((trumpet, 12), (bones, 0), (horn, 0), (shami, 12), (strings, 12), (piano, 0)):
            s.note(part, bar, beat, n(p) + sh, 0.9, vel)
    s.note(cb, bar, beat, n(pitches[0]) - 24, 0.9, vel)


def lightning(bar, root='E'):
    """Everything strikes one chord and is gone; a run falls through the silence; again a
    semitone higher; then the call, into what comes next."""
    r = n(root + '4')
    for k, st in enumerate((0, 1)):
        strike(bar + k, 0, [r + st, r + st + 7, r + st + 12])
        for j, d in enumerate((24, 22, 19, 17, 16, 12)):
            s.note(koto, bar + k, 3 + j * 0.5, r + st + d, 0.5, 110 - j * 4)
            s.note(flute, bar + k, 3 + j * 0.5, r + st + d, 0.5, 96 - j * 4)
    strike(bar + 2, 0, [r, r + 7, r + 12])
    strike(bar + 2, 3, [r, r + 7, r + 12], vel=116)
    battle_call(bar + 3, 1, 3, r + 15, vel=108)
    for q in range(6):
        s.note(drums, bar + 3, q, LOW_TOM if q % 2 else SNARE, 0.3, 84 + q * 6)


# ---------------------------------------------------------------- the notes
# Long notes, by step, B4 to B5. (pitch, eighths); a bar is six.
# From the study of all thirty themes (study.py): the held melody notes last about half a second
# (the long ones 0.6 s) and sit around G4 - an octave under where the first draft of this was.
# So: mostly half-second notes here, and sing() plays the trumpets an octave below what is written.
MEL_A = [
    [('B4', 3), ('E5', 3)], [('F#5', 3), ('G#5', 3)], [('F#5', 6)], [('E5', 3), ('D5', 3)],
    [('E5', 3), ('B4', 3)], [('D5', 3), ('E5', 3)], [('B4', 6)], [('B4', 4), (None, 2)],
    [('E5', 3), ('G#5', 3)], [('A5', 3), ('B5', 3)], [('A5', 6)], [('G#5', 3), ('F#5', 3)],
    [('E5', 3), ('F#5', 3)], [('G#5', 3), ('E5', 3)], [('F#5', 3), ('D#5', 3)], [('E5', 5), (None, 1)],
]
# The middle: the lift to A that Ho-Oh's own middle makes; the second half climbs a staircase.
MEL_B = [
    [('A4', 6)], [('C#5', 6)], [('D5', 3), ('E5', 3)], [('F#5', 6)],
    [('E5', 6)], [('D5', 3), ('C#5', 3)], [('B4', 6)], [('B4', 4), (None, 2)],
    [('C#5', 3), ('D5', 3)], [('E5', 3), ('F#5', 3)], [('G#5', 3), ('A5', 3)], [('B5', 6)],
    [('A5', 3), ('G#5', 3)], [('F#5', 6)], [('D#5', 6)], [('F#5', 3), ('B5', 3)],
]


def wait(bar, bars=8, root='E', level=1.0):
    """3. Drone and figure and drums, and nothing on top: the wait. Low brass swells in late."""
    drone(bar, bars, root)
    for k in range(bars):
        b = bar + k
        kit(b, level, crash=(k == 0), fill=(k == bars - 1))
        hammer(b, root, level)
        if k >= bars // 2:
            r = n(root + '3')
            for p in (r, r + 7):
                s.note(horn, b, 0, p, 6.0, 60 + (k - bars // 2) * 8)
            s.note(trem, b, 0, r + 12, 6.0, 54 + (k - bars // 2) * 8)


def tune(bar, phrase, root='E', up=0, big=False, drone_root=None):
    drone(bar, len(phrase), drone_root or root)
    for k in range(len(phrase)):
        b = bar + k
        kit(b, crash=(k % 8 == 0), fill=(k % 8 == 7))
        hammer(b, drone_root or root, 0.82, top=False)        # under the melody the figure steps back
        if big and k % 4 == 0:
            sparkle(b, root)
        if big:
            s.note(choir, b, 0, n((drone_root or root) + '3'), 6.0, 70)
            s.note(choir, b, 0, n((drone_root or root) + '3') + 7, 6.0, 66)
    sing(bar, phrase, up=up, big=big)


def ghost(bar):
    """The other half of it. Drums and figure stop. The drone, the bell, a shakuhachi leaning
    into each long note, voices a semitone apart."""
    for k in range(8):
        b = bar + k
        s.note(cb, b, 0, 'E1', 6.0, 80)
        s.note(trem, b, 0, 'E3', 6.0, 54 + k * 4)
        s.note(trem, b, 0, 'F3', 6.0, 48 + k * 4)
        s.note(choir, b, 0, 'E4', 6.0, 50 + k * 5)
        s.note(choir, b, 0, 'F4', 6.0, 44 + k * 5)
        if k % 4 == 0:
            s.note(bell, b, 0, 'E2', 24.0, 110)
        s.note(taiko, b, 0, 'C4', 0.6, 62 + k * 5)
        s.note(taiko, b, 0.75, 'C4', 0.6, 46 + k * 5)
        if k >= 4:
            hammer(b, 'E', 0.4 + (k - 4) * 0.15, top=False)
    line = [('E5', 6), ('F5', 3), ('E5', 3), ('C5', 6), ('B4', 6), ('A4', 3), ('B4', 3), ('C5', 3), ('E5', 3), ('F5', 6), ('E5', 6)]
    s.line(shaku, bar, line, vel=112, legato=1.0)


# ---------------------------------------------------------------- the layout
at, LAYOUT = 0, []


def play(what, bars, fn):
    global at
    LAYOUT.append((at, what))
    fn(at)
    at += bars


def opening(b):
    strike(b, 0, ['E4', 'B4', 'E5'])
    battle_call(b, 1, 6, 'C#6')                               # the battle begins
    strike(b + 2, 0, ['E4', 'B4', 'E5'], vel=118) if False else None


play('call', 2, opening)
LOOP_START = at
play('the wait', 8, lambda b: wait(b, 8))
play('melody', 16, lambda b: tune(b, MEL_A))
play('lightning', 4, lambda b: lightning(b))
play('the wait, on A', 8, lambda b: wait(b, 8, root='A'))
play('middle', 16, lambda b: tune(b, MEL_B, root='A', drone_root='A'))
play('ghost', 8, lambda b: ghost(b))
play('the wait', 4, lambda b: wait(b, 4))
play('melody', 16, lambda b: tune(b, MEL_A, big=True))
play('lightning', 4, lambda b: lightning(b))
play('the wait, on A', 4, lambda b: wait(b, 4, root='A'))
play('middle', 16, lambda b: tune(b, MEL_B, root='A', drone_root='A', big=True))
play('the wait, higher', 4, lambda b: wait(b, 4, root='F#'))
play('melody, higher', 16, lambda b: tune(b, MEL_A, root='F#', up=2, big=True, drone_root='F#'))
play('lightning', 4, lambda b: lightning(b))
LOOP_BARS = (LOOP_START, at)
play('the wait (fade)', 8, lambda b: wait(b, 8))
print('bars', at, 'loop', LOOP_BARS, ' | '.join(str(b) + ':' + w for b, w in LAYOUT))

s.loud, s.loud_db, s.bed_db = {'drums', 'taiko'}, 4, 2
s.loud_hp = 95
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'raishin')
os.makedirs(os.path.dirname(out), exist_ok=True)
print(s.render(out))
