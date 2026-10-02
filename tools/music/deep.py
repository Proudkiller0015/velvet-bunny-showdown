"""Heard from the deep (owner, 2 Oct 2026: "its an abyss theme so instrument should sound
from the deep").

Underwater, the high end of a sound is gone and only the low end reaches you. This puts
the theme under water where it should be - the opening and the bridge - and lets it come
up: the filter opens as the thing surfaces into the theme, closes again when the music
goes back down, and the theme itself stays darker than a normal battle theme.

    python deep.py in.wav out.wav
"""
import subprocess
import sys
import wave
import numpy as np

SR = 44100
BAR = 4 * 60 / 172
# (bar, cutoff Hz): straight lines between them on a log scale
CURVE = [(0, 420), (4, 520), (6.5, 1400), (8, 12000), (30, 12000), (32, 9000), (33, 700), (37, 650), (39.5, 2400), (40, 12000), (400, 12000)]   # v10: it surfaces at the ascent and stays up


def cutoff_at(t):
    bar = t / BAR
    for (b0, c0), (b1, c1) in zip(CURVE, CURVE[1:]):
        if b0 <= bar <= b1:
            f = (bar - b0) / max(1e-9, b1 - b0)
            return float(np.exp(np.log(c0) + f * (np.log(c1) - np.log(c0))))
    return CURVE[-1][1]


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, 2) / 32768


def process(x):
    n_fft, hop = 2048, 512
    win = np.hanning(n_fft)
    out = np.zeros((len(x) + n_fft, 2))
    norm = np.zeros(len(x) + n_fft)
    freqs = np.fft.rfftfreq(n_fft, 1 / SR)
    pad = np.vstack([x, np.zeros((n_fft, 2))])
    for i in range(0, len(x), hop):
        fc = cutoff_at(i / SR)
        # a gentle slope past the cutoff (24 dB an octave), and a lift in the bass that grows as it closes
        gain = 1 / np.sqrt(1 + (freqs / fc) ** 8)
        depth = np.clip((3000 - fc) / 3000, 0, 1)
        gain = gain * (1 + 0.5 * depth * np.exp(-freqs / 120))
        for ch in (0, 1):
            seg = pad[i:i + n_fft, ch] * win
            out[i:i + n_fft, ch] += np.fft.irfft(np.fft.rfft(seg) * gain) * win
        norm[i:i + n_fft] += win ** 2
    out = out[:len(x)] / np.maximum(norm[:len(x), None], 1e-6)
    return out


def main(src, dst):
    y = process(read(src))
    y = y / max(1e-9, np.abs(y).max()) * 0.93
    with wave.open(dst, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())
    print(dst)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
