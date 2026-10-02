"""Game Boy water for Makuro's theme (owner, 2 Oct 2026: "a gameboy aquatic sound effect...
some other theme do in the franchise").

Made the way the handheld made them, not sampled: a pulse wave (25% duty) whose pitch
slides up fast is a bubble; several of them rising is a stream of bubbles; the noise
channel with a slow swell is a wave; a pulse sliding down with a wobble is a dive.
Volumes step in sixteen levels, like the hardware's envelope.

    python gb_water.py in.mp3 out.mp3
"""
import subprocess
import sys
import wave
import numpy as np

SR = 44100
BAR = 4 * 60 / 172          # seconds in a bar at the theme's tempo
rng = np.random.default_rng(7)


def steps(env):
    return np.round(env * 15) / 15


def pulse(freq, duty=0.25):
    phase = np.cumsum(freq) / SR
    return np.where((phase % 1.0) < duty, 1.0, -1.0)


def bubble(f0, dur=0.15, rise=1.0, vol=1.0, pop=True):
    """v3, measured from Gen 3's Bubble Beam (the owner's reference): a tone near 500 Hz with a
    hard start that dies away over about 150 ms, and often a chirp up to ~1400 Hz as it
    bursts. A Game Boy Advance pulse wave, so it has the console's edge without the buzz."""
    t = np.arange(int(dur * SR)) / SR
    freq = np.full(len(t), float(f0))
    if pop:                                                   # the last 18 ms: it bursts
        tail = t > dur - 0.018
        freq[tail] = f0 * 2.8
    wave_ = pulse(freq, duty=0.5) * 0.55 + np.sin(2 * np.pi * np.cumsum(freq) / SR) * 0.6
    env = steps(np.minimum(t / 0.002, 1.0) * np.exp(-t / (dur * 0.42)))
    if pop:
        env[t > dur - 0.018] = np.maximum(env[t > dur - 0.018], 0.3)
    return wave_ * env * vol


def bubbles(count, low=470, high=540, gap=(0.150, 0.168), vol=1.0):
    """A short burst, not a stream ("too long cuz its a stream of bubble"): three to five,
    about six a second, each a little different. Returns stereo."""
    count = max(3, min(5, count // 2 + 2))
    out = np.zeros((int((count * gap[1] + 0.4) * SR), 2))
    at = 0.0
    for k in range(count):
        f0 = rng.uniform(low, high)
        b = bubble(f0, dur=rng.uniform(0.13, 0.16), vol=vol * rng.uniform(0.7, 1.0), pop=rng.random() < 0.6)
        pan = rng.uniform(0.25, 0.75)
        i = int(at * SR)
        out[i:i + len(b), 0] += b * (1 - pan)
        out[i:i + len(b), 1] += b * pan
        at += rng.uniform(*gap)
    return out


def wash(dur=2.4, vol=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = np.linspace(7000, 1800, n)                       # the noise clock slowing down
    idx = np.floor(np.cumsum(rate) / SR).astype(int)
    noise = rng.uniform(-1, 1, idx[-1] + 1)[idx]
    env = steps(np.minimum(t / 0.35, 1.0) * np.exp(-np.maximum(t - 0.35, 0) / (dur * 0.35)))
    k = 24
    smooth = np.convolve(noise, np.ones(k) / k, mode='same') * 2.2          # round the hiss off
    return smooth * env * vol


def dive(dur=0.9, vol=1.0):
    t = np.arange(int(dur * SR)) / SR
    freq = 880 * (110 / 880) ** (t / dur) * (1 + 0.04 * np.sin(2 * np.pi * 11 * t))
    env = steps(np.minimum(t / 0.03, 1.0) * (1 - t / dur) ** 0.6)
    return pulse(freq, duty=0.5) * env * vol


def build(total):
    track = np.zeros((int(total * SR) + SR, 2))

    def put(sound, bar, beat=0.0):
        i = int((bar + beat / 4) * BAR * SR)
        if sound.ndim == 1:
            sound = np.stack([sound, sound], axis=1) * 0.7
        track[i:i + len(sound)] += sound[:max(0, len(track) - i)]

    # the opening: bubbles in the silences between the two-note pairs
    put(bubbles(5, vol=0.8), 0, 2.4)
    put(bubbles(7), 1, 0.5)
    put(bubbles(6), 2, 2.4)
    put(wash(2.2, vol=0.5), 6, 0)                    # the surface breaking, under the build
    # the bridge (bars 32-39): back in the trench
    put(dive(), 32, 0)
    put(wash(3.0, vol=0.45), 32, 1)
    for bar, count in ((33, 6), (35, 8), (37, 9)):
        put(bubbles(count), bar, 2)
    put(bubbles(12, gap=(0.04, 0.08)), 39, 0.5)   # a rush of them as it rises again
    # phrase ends in the theme (v5: the water stays for the whole piece)
    for bar in (11, 15, 19, 23, 43, 47, 51, 55):
        put(bubbles(5, vol=0.75), bar, 2.5)
    for bar in (8, 16, 24, 40, 48):
        put(wash(2.0, vol=0.4), bar, 0)
    # the last chord sinking
    put(wash(3.2, vol=0.55), 56, 0.5)
    put(bubbles(8, gap=(0.09, 0.18), vol=0.7), 57, 0)
    return track[:int(total * SR)]


def main(src, dst, level=0.20):
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip())
    fx = build(dur) * level
    data = (np.clip(fx, -1, 1) * 32767).astype('<i2').reshape(-1)
    tmp = dst + '.fx.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-i', tmp, '-filter_complex',
                    '[1:a]lowpass=f=5000,aecho=0.7:0.5:120|300:0.3|0.15[fx];[0:a][fx]amix=inputs=2:normalize=0[out]',
                    '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '192k', dst], check=True)
    import os
    os.remove(tmp)
    print(dst)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
