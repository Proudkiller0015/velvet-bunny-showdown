"""Cries for the Shrine Trio (owner, 2 Oct 2026: "they also lack a cry").

Synthesised from scratch the way the games' cries are built - a couple of pulse voices with
a pitch sweep, a noise channel, a growl - not taken from any game audio.

  Makuro   a leviathan: a low swoop up and a long fall, a slow growl in it, a whale's overtone above
  Raishin  a ghost fox: a sharp yip that jumps and wavers, electric crackle, a thin wail fading out
  Chimai   a lion guardian: a roar that rises fast and comes down heavy, with breath in it

    python cries.py      -> client/audio/cries/makuro.mp3, raishin.mp3, chimai.mp3
"""
import os
import subprocess
import wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'client', 'audio', 'cries')
rng = np.random.default_rng(7)


def curve(points, n):
    """Straight lines through (time 0..1, value) points, n samples long."""
    t = np.linspace(0, 1, n)
    return np.interp(t, [p[0] for p in points], [p[1] for p in points])


def pulse(freq, duty=0.5):
    """A pulse wave following a frequency curve, with its edges softened so it does not alias harshly."""
    phase = np.cumsum(freq) / SR
    raw = np.where((phase % 1.0) < duty, 1.0, -1.0)
    k = np.ones(5) / 5
    return np.convolve(raw, k, mode='same')


def sine(freq):
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def noise(n, low, high):
    """Noise kept between two frequencies."""
    spec = np.fft.rfft(rng.normal(0, 1, n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < low) | (f > high)] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.abs(x).max() + 1e-9)


def makuro():
    n = int(1.5 * SR)
    f = curve([(0, 58), (0.09, 118), (0.3, 104), (1, 62)], n)
    growl = 1 + 0.35 * np.sin(2 * np.pi * 27 * np.arange(n) / SR)
    body = (pulse(f, 0.25) + pulse(f * 1.007, 0.25) * 0.8 + sine(f / 2) * 1.2) * growl
    whale = sine(curve([(0, 300), (0.15, 470), (0.55, 430), (1, 290)], n)) * curve([(0, 0), (0.12, 0.5), (0.6, 0.35), (1, 0)], n)
    rumble = noise(n, 40, 500) * curve([(0, 0.6), (0.2, 0.35), (1, 0.15)], n)
    env = curve([(0, 0), (0.03, 1), (0.45, 0.85), (0.8, 0.45), (1, 0)], n)
    return np.tanh((body * 0.5 + whale * 0.45 + rumble) * env * 1.6)


def raishin():
    n = int(1.05 * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.03 * np.sin(2 * np.pi * 15 * t) * curve([(0, 0), (0.2, 0), (0.35, 1), (1, 1)], n)
    f = curve([(0, 820), (0.1, 1480), (0.2, 1320), (0.55, 1180), (1, 760)], n) * vib
    yip = (pulse(f, 0.125) + pulse(f * 1.5, 0.25) * 0.45) * curve([(0, 0), (0.02, 1), (0.3, 0.8), (0.6, 0.35), (1, 0)], n)
    gate = (np.sin(2 * np.pi * 62 * t) > 0.2) * (rng.random(n) > 0.25)
    crackle = noise(n, 2500, 9000) * gate * curve([(0, 0), (0.08, 0.9), (0.4, 0.5), (0.75, 0.1), (1, 0)], n)
    wail = sine(curve([(0, 700), (0.3, 690), (1, 470)], n)) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) \
        * curve([(0, 0), (0.3, 0), (0.5, 0.6), (1, 0)], n)
    return np.tanh((yip * 0.55 + crackle * 0.4 + wail * 0.5) * 1.5)


def chimai():
    n = int(1.3 * SR)
    t = np.arange(n) / SR
    rasp = 1 + 0.10 * np.sin(2 * np.pi * 38 * t) + 0.05 * np.sin(2 * np.pi * 61 * t)
    f = curve([(0, 150), (0.14, 268), (0.3, 240), (1, 128)], n) * rasp
    roar = pulse(f, 0.5) + pulse(f / 2, 0.35) * 0.9 + pulse(f * 1.01, 0.3) * 0.6
    am = 0.7 + 0.3 * np.sin(2 * np.pi * 38 * t)
    breath = noise(n, 500, 4500) * curve([(0, 0.2), (0.15, 0.7), (0.5, 0.45), (1, 0)], n)
    env = curve([(0, 0), (0.04, 1), (0.35, 0.95), (0.7, 0.55), (1, 0)], n)
    return np.tanh((roar * 0.45 * am + breath * 0.5) * env * 1.8)


def save(name, x):
    os.makedirs(OUT, exist_ok=True)
    x = x / np.abs(x).max() * 0.6                       # about as loud as the games' cries beside the music
    wav = os.path.join(OUT, name + '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    mp3 = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', 'aecho=0.8:0.5:40:0.12', '-codec:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
    os.remove(wav)
    print(mp3, round(len(x) / SR, 2), 's')


if __name__ == '__main__':
    save('makuro', makuro())
    save('raishin', raishin())
    save('chimai', chimai())
