"""A tiny score writer for the legendary themes: notes go in by bar and beat, a MIDI file
comes out, FluidSynth turns it into audio through a General MIDI sample set.

Pokemon battle themes are sequenced scores played through instrument samples, not produced
recordings; that is where their sound comes from, and why a text-to-music generator kept
handing back rock songs (owner, 2 Oct 2026: "it still doesn't sound pokemon").
"""
import os
import subprocess
import mido

HERE = os.path.dirname(os.path.abspath(__file__))
FLUID = os.path.join(HERE, 'fluidsynth', 'fluidsynth-v2.6.1-win10-x64-cpp11', 'bin', 'fluidsynth.exe')
# The sample set. SF2=<path> picks another: Windows' own gm.dls is the Roland Sound Canvas set, the
# family of sounds the GBA and DS games were written on. GAIN scales it (gm.dls is much louder).
SF2 = os.environ.get('SF2') or os.path.join(HERE, 'GeneralUser.sf2')
GAIN = float(os.environ.get('GAIN', '0.9'))
# DRY=1 turns FluidSynth's own reverb and chorus off: a hall around every note is what a film score has
# and a handheld's sound chip does not.
FX = ['-R', '0', '-C', '0'] if os.environ.get('DRY') else []
TPB = 480
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

# General MIDI programs
PIANO, GLOCK, BELLS, HARP, TIMPANI = 0, 9, 14, 46, 47
STRINGS, TREMOLO, PIZZ, CONTRABASS, CELLO = 48, 44, 45, 43, 42
CHOIR, TRUMPET, TROMBONE, HORN, BRASS = 52, 56, 57, 60, 61
SLAP_BASS, SYNTH_BASS, FINGER_BASS = 36, 38, 33
SQUARE, SAW, FLUTE, SHAKUHACHI, KOTO, SHAMISEN, TAIKO = 80, 81, 73, 77, 107, 106, 116
KICK, SNARE, HAT, OPEN_HAT, CRASH, RIDE, LOW_TOM, MID_TOM, HIGH_TOM = 36, 38, 42, 46, 49, 51, 45, 47, 50


def n(name):
    """'Eb5' -> MIDI number (C4 = 60)."""
    if isinstance(name, int):
        return name
    letter, rest = name[0], name[1:]
    acc = 0
    while rest and rest[0] in '#b':
        acc += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + NOTE[letter] + acc


class Song:
    def __init__(self, bpm, beats_per_bar=4):
        self.bpm, self.bpb = bpm, beats_per_bar
        self.parts = {}     # name -> dict(channel, program, events)
        self.next_channel = 0
        # No two notes exactly alike (owner: "sounds ai"): each is moved by up to `humanize` ticks and its
        # loudness by a few steps. Drums get a third of the timing play. 0 turns it off.
        self.humanize = 7
        import random
        self._rng = random.Random(11)
        self.offset_bars = 0   # shift every bar number (a cut opening); what lands before zero is dropped

    def part(self, name, program, volume=100, pan=64, drums=False, reverb=40):
        # REMAP='48:50,0:80' swaps General MIDI programs at render time (for trying instrument sets by ear.py);
        # KIT=<n> picks the drum kit (0 standard, 16 power, 24 electronic, 25 analog on a GS set).
        remap = dict(tuple(int(x) for x in pair.split(':')) for pair in os.environ.get('REMAP', '').split(',') if pair)
        program = remap.get(program, program)
        if drums and os.environ.get('KIT'):
            program = int(os.environ['KIT'])
        if drums:
            ch = 9
        else:
            ch = self.next_channel
            self.next_channel += 1
            if self.next_channel == 9:
                self.next_channel = 10
        self.parts[name] = {'ch': ch, 'program': program, 'events': [], 'volume': volume, 'pan': pan, 'reverb': reverb}
        return name

    def note(self, part, bar, beat, pitch, dur, vel=96):
        """bar from 0, beat from 0 within the bar (may run past it), dur in beats."""
        t = int(round(((bar + self.offset_bars) * self.bpb + beat) * TPB))
        if t < 0:
            return
        d = max(1, int(round(dur * TPB)) - 8)
        p = self.parts[part]
        if self.humanize:
            wobble = self.humanize if p['ch'] != 9 else self.humanize // 3
            t = max(0, t + self._rng.randint(-wobble, wobble))
            vel = vel + self._rng.randint(-5, 5)
        p['events'].append((t, 'on', n(pitch), int(max(1, min(127, vel)))))
        p['events'].append((t + d, 'off', n(pitch), 0))

    def line(self, part, bar, notes, vel=100, beat=0.0, legato=0.95):
        """notes: [(pitch or None, beats), ...] played end to end from bar:beat."""
        t = beat
        for pitch, dur in notes:
            if pitch is not None:
                for q in (pitch if isinstance(pitch, (list, tuple)) else [pitch]):
                    self.note(part, bar, t, q, dur * legato, vel)
            t += dur
        return t

    def bend(self, part, bar, beat, value):
        t = int(round(((bar + self.offset_bars) * self.bpb + beat) * TPB))
        if t < 0:
            return
        self.parts[part]['events'].append((t, 'bend', int(value), 0))

    def cc(self, part, bar, beat, control, value):
        t = int(round((bar * self.bpb + beat) * TPB))
        self.parts[part]['events'].append((t, 'cc', control, int(value)))

    def save(self, path, only=None, skip=None):
        mid = mido.MidiFile(ticks_per_beat=TPB)
        meta = mido.MidiTrack()
        meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm), time=0))
        mid.tracks.append(meta)
        for name, p in self.parts.items():
            if (only is not None and name not in only) or (skip is not None and name in skip):
                continue
            tr = mido.MidiTrack()
            tr.append(mido.MetaMessage('track_name', name=name, time=0))
            ch = p['ch']
            if ch != 9 or p['program']:
                tr.append(mido.Message('program_change', channel=ch, program=p['program'], time=0))
            tr.append(mido.Message('control_change', channel=ch, control=7, value=p['volume'], time=0))
            tr.append(mido.Message('control_change', channel=ch, control=10, value=p['pan'], time=0))
            tr.append(mido.Message('control_change', channel=ch, control=91, value=p['reverb'], time=0))
            order = {'off': 0, 'cc': 1, 'bend': 1, 'on': 2}
            now = 0
            for t, kind, a, b in sorted(p['events'], key=lambda e: (e[0], order[e[1]])):
                dt = t - now
                now = t
                if kind == 'on':
                    tr.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
                elif kind == 'off':
                    tr.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
                elif kind == 'bend':
                    tr.append(mido.Message('pitchwheel', channel=ch, pitch=max(-8192, min(8191, a)), time=dt))
                else:
                    tr.append(mido.Message('control_change', channel=ch, control=a, value=b, time=dt))
            mid.tracks.append(tr)
        mid.save(path)
        return path

    def render(self, stem, gain=None):
        gain = GAIN if gain is None else gain
        """stem.mid -> stem.wav (FluidSynth). If `self.loud` names parts and `self.loud_db` a
        gain, those parts are rendered on their own and mixed back in that much louder: a
        MIDI velocity only goes to 127, and Arceus's drums are as loud as the rest of the
        orchestra put together."""
        mid = self.save(stem + '.mid')
        wav = stem + '.wav'
        loud = getattr(self, 'loud', None)
        if not loud:
            subprocess.run([FLUID, '-ni', *FX, '-g', str(gain), '-r', '44100', '-F', wav, SF2, mid], check=True, capture_output=True)
            return wav
        # More layers with their own level: self.layers = [(set of part names, dB, high-pass Hz), ...]
        layers = [(set(loud), getattr(self, 'loud_db', 6), getattr(self, 'loud_hp', 20))] + list(getattr(self, 'layers', []))
        everything = set().union(*[names for names, _, _ in layers])
        files = []
        m, w = f'{stem}.rest.mid', f'{stem}.rest.wav'
        self.save(m, skip=everything)
        subprocess.run([FLUID, '-ni', *FX, '-g', str(gain), '-r', '44100', '-F', w, SF2, m], check=True, capture_output=True)
        files.append((m, w))
        chain = [f'[0:a]volume=-{getattr(self, "bed_db", 0)}dB[r]']
        mix = '[r]'
        for i, (names, db, hp) in enumerate(layers, 1):
            m, w = f'{stem}.l{i}.mid', f'{stem}.l{i}.wav'
            self.save(m, only=names)
            subprocess.run([FLUID, '-ni', *FX, '-g', str(gain), '-r', '44100', '-F', w, SF2, m], check=True, capture_output=True)
            files.append((m, w))
            chain.append(f'[{i}:a]highpass=f={hp}:poles=2,volume={db}dB[l{i}]')
            mix += f'[l{i}]'
        chain.append(f'{mix}amix=inputs={len(layers) + 1}:normalize=0:duration=longest[out]')
        cmd = ['ffmpeg', '-y', '-v', 'error']
        for _, w in files:
            cmd += ['-i', w]
        subprocess.run(cmd + ['-filter_complex', ';'.join(chain), '-map', '[out]', wav], check=True)
        for m, w in files:
            os.remove(m)
            os.remove(w)
        return wav
