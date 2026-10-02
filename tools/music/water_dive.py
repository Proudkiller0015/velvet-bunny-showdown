"""The camera is at the surface of a lake in the rain, and it dives (owner, 2 Oct 2026:
"scratch the bubble idea js give a small rain sound effect that dives under water").

Three seconds of rain heard from above the water, the plunge, and then the same rain
heard from below - dull, far away, fading - while the theme's first two notes arrive.
The music is pushed back by the length of the scene so the dive happens before it.

    python water_dive.py music.mp3 out.mp3
"""
import os
import subprocess
import sys
import wave
import numpy as np

SR = 44100
LEAD = 6.5            # seconds before the music's first note
DIVE = 3.6            # when the camera goes under
rng = np.random.default_rng(11)


def lowpass_curve(x, cutoff):
    """Block-wise low-pass whose cutoff (Hz) is a function of time in seconds."""
    n_fft, hop = 2048, 512
    win = np.hanning(n_fft)
    out = np.zeros(len(x) + n_fft)
    norm = np.zeros(len(x) + n_fft)
    freqs = np.fft.rfftfreq(n_fft, 1 / SR)
    pad = np.concatenate([x, np.zeros(n_fft)])
    for i in range(0, len(x), hop):
        gain = 1 / np.sqrt(1 + (freqs / cutoff(i / SR)) ** 8)
        out[i:i + n_fft] += np.fft.irfft(np.fft.rfft(pad[i:i + n_fft] * win) * gain) * win
        norm[i:i + n_fft] += win ** 2
    return out[:len(x)] / np.maximum(norm[:len(x)], 1e-6)


def rain(seconds):
    """Hiss of many drops, plus the nearer ones landing on the water one by one."""
    n = int(seconds * SR)
    hiss = rng.normal(0, 1, n)
    hiss = hiss - np.convolve(hiss, np.ones(40) / 40, mode='same')        # take the rumble out: rain is bright
    out = hiss * 0.22
    for _ in range(int(seconds * 150)):                                    # individual drops
        at = rng.integers(0, n - 600)
        length = rng.integers(90, 420)
        t = np.arange(length) / SR
        f = rng.uniform(1800, 6500)
        drop = np.sin(2 * np.pi * f * t * (1 + 2.5 * t)) * np.exp(-t / rng.uniform(0.0012, 0.004))
        out[at:at + length] += drop * rng.uniform(0.15, 0.6)
    return out


def dive_tone(seconds):
    """v2 (owner: "no synth on the melody to simulate diving"). The music takes you under: a
    synth note that starts on a high D and slides down three octaves as the water closes
    over it, landing on the low D the theme begins with. A few slightly detuned voices so it
    is a pad, not a siren, and a slow shudder that deepens as it goes."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    glide = np.clip(t / seconds, 0, 1) ** 0.8
    freq = 587.33 * (73.42 / 587.33) ** glide
    out = np.zeros(n)
    for detune, gain in ((1.0, 1.0), (1.006, 0.7), (0.994, 0.7), (0.5, 0.6)):
        phase = 2 * np.pi * np.cumsum(freq * detune) / SR
        for h in (1, 2, 3, 4, 5):                             # a soft saw: the first five harmonics
            out += np.sin(h * phase) * gain / h
    shudder = 1 - 0.25 * glide * (0.5 + 0.5 * np.sin(2 * np.pi * (5 + 6 * glide) * t))
    env = np.minimum(t / 0.08, 1.0) * shudder
    out = lowpass_curve(out * env, lambda sec: 5200.0 * (420.0 / 5200.0) ** min(1.0, sec / seconds))
    return out / np.abs(out).max()


def scene(total):
    n = int(total * SR)
    t = np.arange(n) / SR
    wet = rain(total)

    # v2 (owner: "rain doesnt fade it js vanish", "the dive is also not creshendo enough").
    # Above the water it is bright and getting louder. Going under, the top end closes over
    # two and a half seconds rather than at once, and it never closes all the way: the rain
    # is still there from below, duller and further off, for the whole of the opening.
    def cutoff(sec):
        if sec < DIVE:
            return 12000.0
        return float(max(750.0, 12000.0 * np.exp(-(sec - DIVE) / 0.75)))
    wet = lowpass_curve(wet, cutoff)
    level = 0.35 + 0.65 * np.clip(t / DIVE, 0, 1) ** 2            # the crescendo
    level *= np.minimum(t / 0.5, 1.0)
    under = t >= DIVE
    level[under] = 1.6 * np.exp(-(t[under] - DIVE) / 4.5)         # louder below (it is all low end now), then away
    wet = wet * level

    out = wet
    # the swell that comes up under the rain and breaks at the plunge
    m = int(DIVE * SR)
    ts = np.arange(m) / SR
    swell = np.cumsum(rng.normal(0, 1, m))
    swell = swell - np.convolve(swell, np.ones(3000) / 3000, mode='same')
    swell = swell / np.abs(swell).max() * (ts / DIVE) ** 2.5 * 1.3
    riser = np.sin(2 * np.pi * np.cumsum(60 * (4.0 ** (ts / DIVE))) / SR) * (ts / DIVE) ** 3 * 0.5
    out[:m] += lowpass_curve(swell, lambda sec: 300.0 + 900.0 * sec / DIVE) + riser

    # the plunge: a slap of water, a long rush past the ears, and a thump of pressure
    i = m
    k = int(2.4 * SR)
    tt = np.arange(k) / SR
    slap = rng.normal(0, 1, k) * np.exp(-tt / 0.09)
    rush = rng.normal(0, 1, k) * np.minimum(tt / 0.04, 1) * np.exp(-tt / 0.8)
    plunge = lowpass_curve(slap * 1.3 + rush * 1.0, lambda sec: max(300.0, 10000.0 * np.exp(-sec / 0.45)))
    thump = np.sin(2 * np.pi * 50 * tt * (1 - 0.12 * tt)) * np.exp(-tt / 0.5) * 1.8
    out[i:i + k] += (plunge + thump)[:max(0, n - i)]

    # the synth that carries us down, landing on the theme's first note
    tone = dive_tone(LEAD - DIVE)
    tail = int(1.2 * SR)                                           # it rings on under the first note and lets go
    hold = np.sin(2 * np.pi * 73.42 * np.arange(tail) / SR) * np.exp(-np.arange(tail) / SR / 0.5) * 0.6
    tone = np.concatenate([tone, hold]) * 0.9
    out[i:i + len(tone)] += tone[:max(0, n - i)]

    # rain heard from below. Closing a filter on bright rain leaves almost nothing (the first
    # version went dead silent between the opening's notes), so this is its own layer: a dull
    # patter in the low mids with the nearer drops as soft thuds, there from the plunge on and
    # sinking away slowly over the whole opening.
    k = int((total - DIVE) * SR)
    patter = rng.normal(0, 1, k)
    patter = lowpass_curve(patter, lambda sec: 1100.0) - lowpass_curve(patter, lambda sec: 260.0)
    for _ in range(int((total - DIVE) * 22)):
        at = rng.integers(0, k - 3000)
        length = rng.integers(900, 2600)
        td = np.arange(length) / SR
        patter[at:at + length] += np.sin(2 * np.pi * rng.uniform(180, 520) * td) * np.exp(-td / rng.uniform(0.008, 0.02)) * rng.uniform(0.5, 1.6)
    te = np.arange(k) / SR
    fade = np.minimum(te / 0.6, 1.0) * np.exp(-te / 7.0)
    out[i:i + k] += (patter / np.abs(patter).max() * fade * 2.8)[:max(0, n - i)]

    # under water: a low, slow pressure through the opening
    k = int(9 * SR)
    brown = np.cumsum(rng.normal(0, 1, k))
    brown = brown - np.convolve(brown, np.ones(4000) / 4000, mode='same')
    brown = brown / np.abs(brown).max()
    te = np.arange(k) / SR
    brown *= np.minimum(te / 0.4, 1) * np.exp(-te / 3.5) * 0.5
    out[i:i + k] += lowpass_curve(brown, lambda sec: 220.0)[:max(0, n - i)]
    return out / max(1e-9, np.abs(out).max())


def main(src, dst, level=0.95):
    fx = scene(LEAD + 16) * level
    tmp = dst + '.fx.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(fx, -1, 1) * 32767).astype('<i2').tobytes())
    ms = int(LEAD * 1000)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-i', tmp, '-filter_complex',
                    f'[0:a]adelay={ms}|{ms}[m];[1:a]aecho=0.8:0.5:60|130:0.2|0.1,pan=stereo|c0=c0|c1=c0[fx];[m][fx]amix=inputs=2:normalize=0:duration=first[out]',
                    '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '192k', dst], check=True)
    os.remove(tmp)
    print(dst)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
