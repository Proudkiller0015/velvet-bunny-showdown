"""A mountain shrine before a storm, for Raishin's theme - the counterpart of Makuro's dive.

Wind through the trees, the shrine's bell shaken twice, thunder a long way off and then
nearer, and the lightning strike that the music starts on. The wind stays under the
opening and thins away.

    python storm.py music.wav out.mp3
"""
import os
import subprocess
import sys
import wave
import numpy as np
from water_dive import lowpass_curve, SR

LEAD = 6.0            # seconds before the music's first note
STRIKE = 5.55         # the lightning
rng = np.random.default_rng(23)


def wind(seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    gust = 0.5 + 0.5 * np.sin(2 * np.pi * (0.13 * t + 0.07 * np.sin(2 * np.pi * 0.05 * t)))
    body = lowpass_curve(noise, lambda sec: 500.0 + 900.0 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.21 * sec + 1.0)))
    body = body - lowpass_curve(body, lambda sec: 140.0)                  # no rumble in the wind itself
    return body / np.abs(body).max() * (0.35 + 0.65 * gust)


def bell(seconds=9.0):
    """v2 (owner: "the bell... doesnt sound like a japenese belll"). Not the little jingling
    suzu: the bonsho, the great bronze temple bell struck with a hanging log. A deep hum
    under a strike tone, partials that do not line up the way a Western bell's do, and the
    slow wah-wah of two almost-equal pitches beating as it rings on for many seconds."""
    n = int(seconds * SR)
    t_ = np.arange(n) / SR
    base = 104.0
    out = np.zeros(n)
    # (ratio to the hum, loudness, seconds to die away)
    for ratio, gain, decay in ((1.0, 1.0, 5.5), (1.007, 0.8, 5.5), (2.02, 0.7, 3.6), (2.03, 0.5, 3.6), (2.76, 0.5, 2.4),
                               (3.41, 0.35, 1.8), (4.3, 0.25, 1.2), (5.67, 0.18, 0.8), (7.1, 0.1, 0.5)):
        out += np.sin(2 * np.pi * base * ratio * t_) * gain * np.exp(-t_ / decay)
    thud = rng.normal(0, 1, n) * np.exp(-t_ / 0.02)                    # the log against the bronze
    thud = np.convolve(thud, np.ones(60) / 60, mode='same') * 6
    out = (out + thud) * np.minimum(t_ / 0.004, 1.0)
    return out / np.abs(out).max()


def thunder(seconds, near):
    """near 0..1: far thunder is a low roll; near thunder has a body and breaks up as it goes."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    roll = np.cumsum(rng.normal(0, 1, n))
    roll = roll - np.convolve(roll, np.ones(6000) / 6000, mode='same')
    roll = roll / np.abs(roll).max()
    crackle = rng.normal(0, 1, n) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(5, 9) * t + 1.0)) ** 4
    mix = roll + crackle * 0.5 * near
    mix = lowpass_curve(mix, lambda sec: (180.0 + 900.0 * near) * np.exp(-sec / (seconds * 0.6)) + 90.0)
    env = np.minimum(t / (0.25 - 0.2 * near), 1.0) * np.exp(-t / (seconds * 0.4))
    return mix / np.abs(mix).max() * env


def scene(total):
    n = int(total * SR)
    t = np.arange(n) / SR
    out = wind(total) * 0.55 * np.minimum(t / 1.2, 1.0) * np.where(t < LEAD, 1.0, np.exp(-(t - LEAD) / 5.0))

    def put(sound, at, gain):
        i = int(at * SR)
        out[i:i + len(sound)] += (sound * gain)[:max(0, n - i)]

    put(bell(), 0.5, 1.1)                            # one stroke, and it rings through the rest
    put(thunder(3.2, 0.0), 1.4, 0.7)                 # far
    put(thunder(3.0, 0.45), 3.4, 1.0)                # nearer
    # the strike: a white crack, then the sky coming down, and it rings into the first bars
    m = int(0.35 * SR)
    tt = np.arange(m) / SR
    crack = rng.normal(0, 1, m) * np.exp(-tt / 0.03) + rng.normal(0, 1, m) * np.exp(-tt / 0.12) * 0.5
    put(crack / np.abs(crack).max(), STRIKE, 1.5)
    put(thunder(5.5, 1.0), STRIKE + 0.04, 1.9)
    return out / max(1e-9, np.abs(out).max())


def main(src, dst, level=0.9):
    fx = scene(LEAD + 14) * level
    tmp = dst + '.fx.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(fx, -1, 1) * 32767).astype('<i2').tobytes())
    ms = int(LEAD * 1000)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-i', tmp, '-filter_complex',
                    f'[0:a]adelay={ms}|{ms}[m];[1:a]aecho=0.8:0.6:90|210:0.3|0.18,pan=stereo|c0=c0|c1=c0[fx];[m][fx]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.97:level=disabled:attack=1:release=40[out]',
                    '-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '192k', dst], check=True)
    os.remove(tmp)
    print(dst)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
