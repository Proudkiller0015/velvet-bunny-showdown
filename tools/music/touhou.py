"""The Touhou character themes: MIDI -> FluidSynth (Roland GM set) -> one clean loop, mono mp3.

    python -I tools/music/touhou.py choose <collection>     pick a MIDI for every track without one
    python -I tools/music/touhou.py render <collection> [file ...]   render tracks, write their loops

<collection> is a checkout of git.psf.lt/80486DX2-66/touhou-midi-collection (read as data only;
on Windows its checkout stops at a file name with '?' in it, so extract the blobs with
`git cat-file` under safe names instead: ':?*"<>|' become '_'). The tracks, who they play for
and why, are in data/touhou-music.json; scripts/build-battle-music.js then writes them into the
client (TOUHOU_OF, MUSIC_LOOP, the music picker's Touhou group).

The loop is found in the score, not the audio:
  marker        the file's own loopStart/loopEnd markers (the game's loop)
  repeat        the file plays the song twice: the notes repeat exactly after L
  marker-start  a loop-start marker (or CC111) only; the loop runs to the last bar
  whole         one pass: the whole song, first bar to last
Then the MIDI is 'unrolled' - everything before the loop end, then the loop's first seconds
again, so the render runs on past the loop end with the music that follows it. The client
(BattleBGM.updateTime) jumps back by loopEnd - loopStart at some moment in the last second
before loopEnd (or a little after), so both points sit 1 s after the bar line they mean and
the file runs 3 s past the loop: wherever the jump lands, it lands on the same music.

Mono, CBR 64 kbps, loudness matched to the legendary themes (-14 LUFS integrated, measured
with ffmpeg's ebur128 the way their own levels were). Needs ffmpeg on PATH and mido.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

import mido
import mido.midifiles.midifiles as _mf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, 'data', 'touhou-music.json')
OUT = os.path.join(ROOT, 'client', 'audio', 'touhou')
FLUID = os.environ.get('FLUID') or os.path.join(HERE, 'fluidsynth', 'fluidsynth-v2.6.1-win10-x64-cpp11', 'bin', 'fluidsynth.exe')
# Windows' own gm.dls is the Roland Sound Canvas set: the closest to the games (tools/music notes).
SF2 = os.environ.get('SF2') or 'C:/Windows/System32/drivers/gm.dls'
GAIN = float(os.environ.get('GAIN', '0.35'))
TARGET_LUFS = -14.0
TAIL_S = 4.0        # loop seconds rendered again after the loop end
KEEP_S = 3.0        # how far past the loop end the file runs
BITRATE = os.environ.get('BITRATE', '64k')
LONG_S = 170.0      # a loop ending later than this is trimmed to a phrase loop when the song allows,
PHRASE_END_S = 165.0  # one that ends by this
MIN_LOOP_S = 75.0   # ...of at least this much music

# Some transcriptions (the IN set) carry a key signature with no data: read it as unknown.
_orig_meta = _mf.build_meta_message


def _safe_meta(meta_type, data, delta):
    try:
        return _orig_meta(meta_type, data, delta)
    except Exception:
        return mido.UnknownMetaMessage(type_byte=meta_type, data=data, time=delta)


_mf.build_meta_message = _safe_meta


def merged(mid):
    out = []
    for ti, tr in enumerate(mid.tracks):
        t = 0
        for i, m in enumerate(tr):
            t += m.time
            out.append((t, ti * 1000000 + i, m))
    out.sort(key=lambda x: (x[0], x[1]))
    return out


class TempoMap:
    def __init__(self, events, tpb):
        self.tpb = tpb
        self.pts = [(0, 0.0, 500000)]
        for t, _, m in events:
            if m.type == 'set_tempo':
                lt, ls, lte = self.pts[-1]
                if t == lt:
                    self.pts[-1] = (t, ls, m.tempo)
                else:
                    self.pts.append((t, ls + (t - lt) * lte / tpb / 1e6, m.tempo))

    def sec(self, tick):
        p = self.pts[0]
        for q in self.pts:
            if q[0] > tick:
                break
            p = q
        return p[1] + (tick - p[0]) * p[2] / self.tpb / 1e6

    def tick(self, sec):
        p = self.pts[0]
        for q in self.pts:
            if q[1] > sec:
                break
            p = q
        return int(round(p[0] + (sec - p[1]) * 1e6 / p[2] * self.tpb))


def is_off(m):
    return m.type == 'note_off' or (m.type == 'note_on' and m.velocity == 0)


def scan_repeats(notes, tpb, bar):
    """For every shift L (in beats): (a, L, run) ticks, the longest run of bars from a on
    whose notes all come again L later."""
    q = max(1, tpb // 24)
    near = set()
    for t, c, n in notes:
        for d in (-1, 0, 1):
            near.add((t // q + d, c, n))
    last = notes[-1][0]
    nbars = last // bar + 1
    found = []
    for L in range(8 * tpb, last // 2 + tpb + 1, tpb):
        hits = [0] * nbars
        tot = [0] * nbars
        for t, c, n in notes:
            if t + L > last:
                break
            tot[t // bar] += 1
            if ((t + L) // q, c, n) in near:
                hits[t // bar] += 1
        run = start = 0
        best = (0, 0)
        for b in range((last - L) // bar):
            ok = tot[b] == 0 or hits[b] >= 0.9 * tot[b]
            if ok and not (tot[b] == 0 and run == 0):
                if run == 0:
                    start = b
                run += 1
                if run > best[0]:
                    best = (run, start)
            else:
                run = 0
        found.append((best[1] * bar, L, best[0] * bar))
    return found


def find_repeat(found, bar):
    """(a, L, run) of the shift after which the notes repeat for longest, or None."""
    good = [f for f in found if f[2] >= 0.8 * f[1]]
    if not good:
        return None
    top = max(f[2] for f in good)
    return min((f for f in good if f[2] >= top - 2 * bar), key=lambda f: f[1])


def plan(path):
    mid = mido.MidiFile(path, clip=True)
    ev = merged(mid)
    tpb = mid.ticks_per_beat
    tm = TempoMap(ev, tpb)
    notes = [(t, m.channel, m.note) for t, _, m in ev if m.type == 'note_on' and m.velocity > 0]
    if len(notes) < 50:
        return None
    bar = next((int(m.numerator * tpb * 4 / m.denominator) for _, _, m in ev if m.type == 'time_signature'), 4 * tpb)
    end_bar = (notes[-1][0] // bar + 1) * bar
    ls = le = cc = None
    for t, _, m in ev:
        if m.type in ('marker', 'cue_marker', 'text'):
            txt = str(m.text).strip().lower().replace(' ', '')
            if txt in ('loopstart', 'loop') and ls is None:
                ls = t
            elif txt == 'loopend':
                le = t
        elif m.type == 'control_change' and m.control == 111 and cc is None:
            cc = t
    start_mark = ls if ls is not None else cc
    found = scan_repeats(notes, tpb, bar)
    if ls is not None and le is not None and le - ls > 16 * tpb:
        method, a, b = 'marker', ls, le
    else:
        rp = find_repeat(found, bar)
        # A repeat only counts when the file is the song twice (the two passes fill it); a
        # phrase that repeats inside one pass would loop a scrap of the song (Broken Moon at 45 s).
        if rp and tm.sec(rp[0] + rp[1]) - tm.sec(rp[0]) >= 40 and rp[2] >= 0.9 * rp[1] and rp[0] + rp[1] + rp[2] >= 0.85 * notes[-1][0]:
            method, a, b = 'repeat', rp[0], rp[0] + rp[1]
        elif start_mark is not None and end_bar - start_mark > 16 * tpb:
            method, a, b = 'marker-start', start_mark, end_bar
        else:
            method, a, b = 'whole', notes[0][0] // bar * bar, end_bar
    # Too long for the size budget (the owner's 1:30-2:40): loop between two statements of
    # the same passage instead - from its first to its second, where the music is the same
    # for at least 8 bars, so the jump is as clean as the song's own repeat. The longest such
    # loop that ends by PHRASE_END_S keeps the most of the song; what came after it is cut.
    if tm.sec(b) > LONG_S:
        subs = [(tm.sec(f[0] + f[1]) - tm.sec(f[0]), f) for f in found
                if f[2] >= 8 * bar and tm.sec(f[0] + f[1]) <= PHRASE_END_S and tm.sec(f[0] + f[1]) - tm.sec(f[0]) >= MIN_LOOP_S]
        if subs:
            _, f = max(subs, key=lambda x: x[0])
            method, a, b = 'phrase', f[0], f[0] + f[1]
    chans = len({c for _, c, _ in notes})
    return dict(method=method, a=a, b=b, a_s=tm.sec(a), b_s=tm.sec(b), chans=chans, mid=mid, ev=ev, tm=tm)


def unroll(p, out_path):
    """Everything before the loop end, then the loop's first TAIL_S seconds again after it."""
    mid, ev, tm, a, b = p['mid'], p['ev'], p['tm'], p['a'], p['b']
    L = b - a
    tail_end = tm.tick(tm.sec(a) + TAIL_S)
    keep, held, held2 = [], {}, {}
    for t, o, m in ev:
        if m.type == 'end_of_track':
            continue
        k = (getattr(m, 'channel', None), getattr(m, 'note', None))
        if t < b:
            keep.append((t, o, m))
            if m.type == 'note_on' and m.velocity > 0:
                held[k] = held.get(k, 0) + 1
            elif is_off(m) and held.get(k):
                held[k] -= 1
        elif is_off(m) and held.get(k):
            held[k] -= 1                 # a note sounding at the loop end ends where it ended
            keep.append((t, o, m))
    for t, o, m in ev:
        if m.type == 'end_of_track':
            continue
        k = (getattr(m, 'channel', None), getattr(m, 'note', None))
        if a <= t < tail_end:
            keep.append((t + L, o + 500000, m))
            if m.type == 'note_on' and m.velocity > 0:
                held2[k] = held2.get(k, 0) + 1
            elif is_off(m) and held2.get(k):
                held2[k] -= 1
        elif t >= tail_end and is_off(m) and held2.get(k):
            held2[k] -= 1
            keep.append((t + L, o + 500000, m))
    # The copy must start in the state the loop start had: the tempo, and each channel's
    # program, controllers and pitch bend. A song that ends slower, quieter (a written
    # fade-out) or on other instruments played its copied opening that way (Jelly Stone).
    state = {}
    for t, o, m in ev:
        if t >= a:
            break
        if m.type == 'set_tempo':
            state['tempo'] = m
        elif m.type == 'program_change':
            state[('p', m.channel)] = m
        elif m.type == 'control_change' and m.control not in (64, 66, 67, 120, 121, 123):
            state[('c', m.channel, m.control)] = m
        elif m.type == 'pitchwheel':
            state[('w', m.channel)] = m
    for i, m in enumerate(state.values()):
        keep.append((b, -100000 + i, m))
    keep.sort(key=lambda x: (x[0], x[1]))
    tr = mido.MidiTrack()
    prev = 0
    for t, _, m in keep:
        tr.append(m.copy(time=t - prev))
        prev = t
    tr.append(mido.MetaMessage('end_of_track', time=0))
    out = mido.MidiFile(type=0, ticks_per_beat=mid.ticks_per_beat)
    out.tracks.append(tr)
    out.save(out_path)


PENALTY = re.compile(r'piano|incomplete|\[arrange\]|\balt\b|alt\.|xg\b|edited by someone|touhocaloid|short version', re.I)


def score(name, p):
    s = {'marker': 3, 'repeat': 3, 'marker-start': 2, 'whole': 1.5}[p['method']] + p['chans'] / 16
    if '(ZUN' in name or 'ZUN)' in name:
        s += 0.3
    if PENALTY.search(name):
        s -= 2
    L = p['b_s'] - p['a_s']
    if L < 45:
        s -= 1.5
    if p['b_s'] > 200:
        s -= 1
    return s


def candidates(coll, t):
    d = os.path.join(coll, t['folder'])
    return sorted(f for f in os.listdir(d) if f.lower().startswith(t['match'].lower()) and f.lower().endswith('.mid'))


def choose(coll, data):
    for t in data['tracks']:
        if t.get('midi'):
            continue
        best = None
        for f in candidates(coll, t):
            # The collection's Imperishable Night "(ZUN)" set renders silent through gm.dls.
            if 'Imperishable Night' in t['folder'] and f.endswith('(ZUN).mid'):
                continue
            try:
                p = plan(os.path.join(coll, t['folder'], f))
            except Exception as e:
                print('   skip', f, e)
                continue
            if not p:
                continue
            s = score(f, p)
            print(f"   {s:5.2f} {p['method']:12s} loop {p['a_s']:6.1f}-{p['b_s']:6.1f}s ch{p['chans']:2d}  {f}")
            if not best or s > best[0]:
                best = (s, f)
        if best:
            t['midi'] = t['folder'] + '/' + best[1]
            print(f"{t['file']}: {best[1]}")
        else:
            print(f"{t['file']}: NO USABLE MIDI")


def lufs(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def render(coll, data, only):
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='touhou-')
    for t in data['tracks']:
        if only and t['file'] not in only:
            continue
        p = plan(os.path.join(coll, t['midi']))
        mid = os.path.join(tmp, t['file'] + '.mid')
        wav = os.path.join(tmp, t['file'] + '.wav')
        cut = os.path.join(tmp, t['file'] + '-cut.wav')
        unroll(p, mid)
        subprocess.run([FLUID, '-ni', '-R', '0', '-C', '0', '-g', str(GAIN), '-r', '44100', '-F', wav, SF2, mid],
                       check=True, capture_output=True)
        end = p['b_s'] + KEEP_S
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-t', f'{end:.3f}', '-ac', '1',
                        '-af', f'afade=t=out:st={end - 0.3:.3f}:d=0.3', cut], check=True)
        level = lufs(cut)
        if level < -45:   # the IN set's Voyage 1969 (ZUN) renders silent through gm.dls: pick another
            raise SystemExit(f"{t['file']}: {t['midi']} renders silent ({level} LUFS)")
        gain = TARGET_LUFS - level
        mp3 = os.path.join(OUT, t['file'] + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', cut, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=disabled',
                        '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ac', '1', mp3], check=True)
        t['method'] = p['method']
        t['loop'] = [round(p['a_s'] * 1000) + 1000, round(p['b_s'] * 1000) + 1000]
        for f in (mid, wav, cut):
            os.remove(f)
        print(f"{t['file']}: {p['method']}, loop {t['loop'][0] / 1000:.1f}-{t['loop'][1] / 1000:.1f}s, "
              f"{os.path.getsize(mp3) / 1048576:.2f} MB, {gain:+.1f} dB")
        save(data)
    os.rmdir(tmp)


def save(data):
    with open(DATA, 'w', encoding='utf8', newline='\n') as f:
        f.write(json.dumps(data, indent='\t', ensure_ascii=False) + '\n')


if __name__ == '__main__':
    cmd, coll = sys.argv[1], sys.argv[2]
    data = json.load(open(DATA, encoding='utf8'))
    if cmd == 'choose':
        choose(coll, data)
        save(data)
    elif cmd == 'render':
        render(coll, data, set(sys.argv[3:]))
