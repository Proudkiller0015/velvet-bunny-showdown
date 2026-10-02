"""Battle! Raishin - Call of the Shrine. Fourth build: a scary electric ghost.

The owner on the last one: "it doesnt sound like a scary electro ghost about to fuck u up in a
battle" - and ear.py agreed with him whatever voice the lead was given: two thirds "heroic
adventure", a tenth "scary", where Giratina's theme is half "scary". So it was not the lead.
Measured and looked at (listen.py's piano roll of Giratina's theme), what frightens is:

  - a bass that CRAWLS in semitones, low, busy, never an open fifth;
  - a hollow middle: the music lives at the bottom and at the very top;
  - eerie held notes far up, a semitone apart from each other;
  - an electric lead that does not sing - it stabs in short zig-zag bursts and is gone;
  - tritones in the low brass where a hero's theme has thirds and fifths;
  - silence. Whole bars of it.

(Notes a semitone apart sounding together: Giratina 13.7% of the time, the old Raishin 6.5%;
tritones 6.0% against 1.6%.) Everything heroic in the old one is gone with it: the broad
middle melody, the root-and-fifth hammering, the galloping 6/8.

The Shrine is still in it - shakuhachi, koto, shamisen, taiko, the temple bell, the flute the
owner liked - and the storm, the battle call and the lightning stops. 4/4, 150 to the minute.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import *   # noqa

s = Song(bpm=150)
flute = s.part('flute', FLUTE, volume=118, pan=70, reverb=95)
shaku = s.part('shakuhachi', SHAKUHACHI, volume=116, pan=58, reverb=90)
lead = s.part('electric lead', int(os.environ.get('LEAD', '81')), volume=112, pan=60, reverb=30)
trumpet = s.part('trumpets', TRUMPET, volume=110, pan=54, reverb=50)
horn = s.part('horns', HORN, volume=108, pan=40, reverb=60)
bones = s.part('trombones', TROMBONE, volume=118, pan=58, reverb=50)
strings = s.part('strings', STRINGS, volume=88, pan=64, reverb=60)
trem = s.part('tremolo', TREMOLO, volume=92, pan=64, reverb=60)
cb = s.part('contrabass', CONTRABASS, volume=110, pan=64, reverb=40)
bass = s.part('bass', SYNTH_BASS, volume=120, pan=64, reverb=5)
koto = s.part('koto', KOTO, volume=120, pan=78, reverb=45)
shami = s.part('shamisen', SHAMISEN, volume=112, pan=50, reverb=20)
choir = s.part('choir', CHOIR, volume=96, pan=64, reverb=100)
taiko = s.part('taiko', TAIKO, volume=127, pan=64, reverb=30)
bell = s.part('temple bell', BELLS, volume=120, pan=64, reverb=110)
drums = s.part('drums', 0, volume=127, drums=True, reverb=30)
FLOOR_TOM_2 = 43

# The crawl: sixteen sixteenths, in semitones around the root, with the tritone at the turn.
CRAWL = [
    [0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 1, 0, 6, 5, 3, 1],
    [0, 0, 1, 0, 3, 0, 1, 0, 0, 1, 3, 4, 6, 7, 6, 1],
    [0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 1, 0, 6, 5, 3, 1],
    [0, 0, 1, 3, 4, 3, 1, 0, 11, 10, 8, 7, 6, 4, 3, 1],
]


def crawl(bar, root='E', level=1.0, plucks=True):
    r = n(root + '2')
    row = CRAWL[bar % 4]
    for k, st in enumerate(row):
        v = int((118 if k % 4 == 0 else 98) * level)
        s.note(bass, bar, k * 0.25, r + st, 0.22, v)
        if plucks:
            s.note(shami, bar, k * 0.25, r + st + 12, 0.2, v - 22)        # the same crawl, an octave up, dry
    s.note(cb, bar, 0, r - 12, 4.0, int(92 * level))


def kit(bar, level=1.0, crash=False, fill=False, big=True):
    if crash:
        s.note(drums, bar, 0, CRASH, 4, 106)
    for beat in (0, 2, 2.75):
        s.note(drums, bar, beat, KICK, 0.25, int(112 * level))
    for beat in (1, 3):
        s.note(drums, bar, beat, SNARE, 0.25, int(118 * level))
    for k in range(16):
        s.note(drums, bar, k * 0.25, HAT, 0.2, int((70 if k % 4 == 0 else 46 if k % 2 == 0 else 34) * level))
    if big and bar % 2 == 0:                                  # the big drum, every other bar (C4 sounds E2 on this sample)
        s.note(taiko, bar, 0, 'C4', 0.5, int(122 * level))
        s.note(drums, bar, 0, LOW_TOM, 0.5, int(118 * level))
        s.note(drums, bar, 0, FLOOR_TOM_2, 0.5, int(110 * level))
    if fill:
        for k, tom in enumerate([HIGH_TOM, MID_TOM, MID_TOM, LOW_TOM, LOW_TOM, FLOOR_TOM_2, FLOOR_TOM_2, SNARE]):
            s.note(drums, bar, 2 + k * 0.25, tom, 0.25, int((92 + k * 4) * level))


def eerie(bar, root='E', vel=96, both=True):
    """Far up: the flute holding a note and sliding a semitone, the koto touching it. Two bars."""
    r = n(root + '6')
    shapes = ([(0, 6), (1, 2)], [(0, 4), (-6, 4)], [(1, 6), (0, 2)], [(7, 3), (6, 3), (0, 2)])
    shape = shapes[(bar // 2) % 4]
    t = 0.0
    for st, d in shape:
        s.note(flute, bar + int(t // 4), t % 4, r + st, d, vel)
        s.note(koto, bar + int(t // 4), t % 4, r + st + 12, 0.5, vel - 14)
        if both:
            s.note(trem, bar + int(t // 4), t % 4, r + st - 12, d, vel - 34)
        t += d


ZIG = [0, -5, 1, -4, 0, -6, 1, -5]        # down a fourth, up a tritone, down a fourth...: no two notes that agree


def burst(bar, beat, root='E', count=8, vel=116, up=0):
    """The electric lead: a jagged run of sixteenths, then nothing. The koto and a snare with it."""
    r = n(root + '6') + up
    for k in range(count):
        p = r + ZIG[k % 8]
        s.note(lead, bar, beat + k * 0.25, p, 0.22, vel - (0 if k % 2 == 0 else 10))
        s.note(koto, bar, beat + k * 0.25, p, 0.22, vel - 16)
    s.note(drums, bar, beat, SNARE, 0.25, 110)
    # the last note falls away, like the charge leaving it
    end = beat + (count - 1) * 0.25
    for q in range(6):
        s.bend(lead, bar, end + 0.05 + q * 0.03, int(-1300 * q))
    s.bend(lead, bar, end + 0.4, 0)


# The dread: low brass, long notes, each one a semitone or a tritone from the last. (pitch, beats)
DREAD = [
    [('E3', 4)], [('F3', 2), ('E3', 2)], [('A#3', 4)], [('A3', 2), ('F3', 2)],
    [('E3', 4)], [('F3', 2), ('B3', 2)], [('C4', 3), ('B3', 1)], [('A#3', 2), ('F3', 2)],
]


def dread(bar, root='E', big=False, vel=120):
    shift = n(root + '3') - n('E3')
    for k in range(8):
        b = bar + k
        line = [(n(p) + shift, d) for p, d in DREAD[k]]
        s.line(bones, b, line, vel=vel, legato=1.0)
        s.line(bones, b, [(p - 12, d) for p, d in line], vel=vel - 8, legato=1.0)
        s.line(horn, b, [(p + 6, d) for p, d in line], vel=vel - 18, legato=1.0)        # a tritone above: the wrongness
        if big:
            s.line(trumpet, b, [(p + 12, d) for p, d in line], vel=vel - 8, legato=1.0)
            s.line(strings, b, [(p + 18, d) for p, d in line], vel=vel - 26, legato=1.0)
            s.note(choir, b, 0, n(root + '3') + 12, 4.0, 84)
            s.note(choir, b, 0, n(root + '3') + 13, 4.0, 78)                              # the voices a semitone apart
            if k % 4 == 0:
                s.note(bell, b, 0, n(root + '2'), 12.0, 104)


def battle_call(bar, beat, cells, start, vel=112):
    """The signal a Pokemon battle theme opens on: four notes down by semitones, then again a
    tone lower, about 70 ms a note."""
    step = 0.175
    p, t = n(start), beat
    for c in range(cells):
        for k in range(4):
            v = vel + c * 2 - (0 if k == 0 else 10)
            s.note(trumpet, bar, t, p - k, step, v)
            s.note(strings, bar, t, p - k, step, v - 8)
            s.note(koto, bar, t, p - k + 12, step, v - 4)
            s.note(lead, bar, t, p - k, step, v - 14)
            if k == 0:
                s.note(drums, bar, t, SNARE, 0.2, 100)
                s.note(drums, bar, t, LOW_TOM, 0.2, 96)
            t += step
        p -= 2


def strike(bar, beat, root='E', vel=124):
    """Lightning: the root, the semitone over it and the tritone, everyone, and gone."""
    r = n(root + '3')
    s.note(drums, bar, beat, CRASH, 3, vel)
    s.note(taiko, bar, beat, 'C4', 0.6, vel)
    s.note(drums, bar, beat, KICK, 0.5, vel)
    s.note(drums, bar, beat, LOW_TOM, 0.5, vel)
    for st in (0, 6, 13):
        for part, sh in ((trumpet, 12), (bones, 0), (horn, 0), (shami, 12), (strings, 12), (lead, 24)):
            s.note(part, bar, beat, r + st + sh, 0.6, vel)
    s.note(cb, bar, beat, r - 24, 0.6, vel)
    s.note(bass, bar, beat, r - 12, 0.6, vel)


def lightning(bar, root='E'):
    """Two bars. A strike, silence, a burst out of the silence; a double strike, the call."""
    strike(bar, 0, root)
    burst(bar, 2, root, count=8)
    strike(bar + 1, 0, root)
    strike(bar + 1, 0.75, root, vel=116)
    battle_call(bar + 1, 2, 3, n(root + '5') + 15, vel=108)


def stretch(bar, bars, root='E', melody=False, bursts=False, big=False, flute_on=True):
    for k in range(bars):
        b = bar + k
        crawl(b, root)
        kit(b, crash=(k % 8 == 0), fill=(k % 8 == 7))
        if flute_on and k % 2 == 0 and k + 1 < bars:
            eerie(b, root, vel=100 if big else 92)
        if bursts and k % 2 == 1:
            burst(b, 2, root, count=8, vel=118)
        if bursts and big and k % 4 == 2:
            burst(b, 0, root, count=4, vel=110, up=7)
    if melody:
        for k in range(0, bars, 8):
            dread(bar + k, root, big=big)


def ghost(bar):
    """Eight bars with no pulse at all. A low E, voices a semitone apart, the temple bell, and
    the flute alone, leaning into each note - then the crawl creeping back under it."""
    for k in range(8):
        b = bar + k
        s.note(cb, b, 0, 'E1', 4.0, 84)
        s.note(trem, b, 0, 'E3', 4.0, 54 + k * 4)
        s.note(trem, b, 0, 'F3', 4.0, 48 + k * 4)
        s.note(choir, b, 0, 'E4', 4.0, 54 + k * 5)
        s.note(choir, b, 0, 'F4', 4.0, 48 + k * 5)
        s.note(choir, b, 0, 'A#4', 4.0, 40 + k * 5)
        if k % 4 == 0:
            s.note(bell, b, 0, 'E2', 16.0, 112)
        s.note(taiko, b, 0, 'C4', 0.6, 60 + k * 5)
        s.note(taiko, b, 0.5, 'C4', 0.6, 44 + k * 5)
        if k >= 5:
            crawl(b, 'E', level=0.45 + (k - 5) * 0.18, plucks=False)
        if k == 7:
            for q in range(16):
                s.note(drums, b, q * 0.25, SNARE, 0.2, 50 + q * 4)
    line = [('E5', 4), ('F5', 2), ('E5', 2), ('A#4', 4), ('B4', 2), ('C5', 2), ('E5', 3), ('F5', 1), ('B5', 4), ('A#5', 2), ('F5', 2), ('E5', 4)]
    s.line(flute, bar, line, vel=112, legato=1.0)
    s.line(shaku, bar, [(n(p) - 12, d) for p, d in line], vel=92, legato=1.0)


# ---------------------------------------------------------------- the layout
at, LAYOUT = 0, []


def play(what, bars, fn):
    global at
    LAYOUT.append((at, what))
    fn(at)
    at += bars


def opening(b):
    strike(b, 0)
    battle_call(b, 1, 6, 'C#6')
    strike(b + 1, 2.5)
    for q in range(6):
        s.note(drums, b + 1, 2.5 + q * 0.25, SNARE if q % 2 else LOW_TOM, 0.2, 84 + q * 6)


def first_crawl(b):
    stretch(b, 8, flute_on=False)
    eerie(b + 4)
    eerie(b + 6)


play('call', 2, opening)
LOOP_START = at
play('the crawl', 8, first_crawl)
play('dread', 8, lambda b: stretch(b, 8, melody=True))
play('lightning', 2, lambda b: lightning(b))
play('bursts', 8, lambda b: stretch(b, 8, bursts=True))
play('dread, on A', 8, lambda b: stretch(b, 8, root='A', melody=True, big=True))
play('ghost', 8, lambda b: ghost(b))
play('lightning', 2, lambda b: lightning(b))
play('dread and bursts', 16, lambda b: stretch(b, 16, melody=True, bursts=True, big=True))
play('lightning', 2, lambda b: lightning(b))
play('the crawl, higher', 8, lambda b: stretch(b, 8, root='F#', bursts=True, big=True))
play('dread, higher', 8, lambda b: stretch(b, 8, root='F#', melody=True, bursts=True, big=True))
play('lightning', 2, lambda b: lightning(b))
LOOP_BARS = (LOOP_START, at)
play('the crawl (fade)', 8, lambda b: stretch(b, 8))
print('bars', at, 'loop', LOOP_BARS, ' | '.join(str(b) + ':' + w for b, w in LAYOUT))

s.loud, s.loud_db, s.bed_db = {'drums', 'taiko'}, 4, 2
s.loud_hp = 95
s.layers = [({'electric lead'}, float(os.environ.get('LEAD_DB', '4')), 200)]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'raishin')
os.makedirs(os.path.dirname(out), exist_ok=True)
print(s.render(out))
