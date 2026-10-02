"""What a battle theme is made of, measured: tempo, key, how it opens, how loud and how
low it sits, how percussive it is, and how it moves through its sections.

    python scripts/analyse-theme.py client/audio/legends/reshiram-zekrom.mp3 [...]

Written to brief new themes against the ones the owner calls peak (Reshiram/Zekrom,
Dialga/Palkia, the weather trio) instead of guessing at what makes them work.
"""
import sys
import warnings
import numpy as np
import librosa

warnings.filterwarnings('ignore')
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def key_of(chroma):
    best = (-2, '')
    for i in range(12):
        for name, profile in (('major', MAJOR), ('minor', MINOR)):
            r = np.corrcoef(np.roll(profile, i), chroma)[0, 1]
            if r > best[0]:
                best = (r, f'{NOTES[i]} {name}')
    return best[1], best[0]


def analyse(path):
    y, sr = librosa.load(path, sr=22050, mono=True)
    dur = len(y) / sr
    hop = 512
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=onset, sr=sr, hop_length=hop))[0])
    harm, perc = librosa.effects.hpss(y)
    chroma = librosa.feature.chroma_cqt(y=harm, sr=sr, hop_length=hop)
    key, fit = key_of(chroma.mean(axis=1))
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    low = S[freqs < 150].sum(axis=0) / (S.sum(axis=0) + 1e-9)
    perc_rms = librosa.feature.rms(y=perc, hop_length=hop)[0]
    harm_rms = librosa.feature.rms(y=harm, hop_length=hop)[0]
    t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    db = 20 * np.log10(rms + 1e-6)

    print(f'\n=== {path.split("/")[-1]}  ({dur:.0f}s)')
    print(f'tempo ~{tempo:.0f} BPM (half {tempo / 2:.0f}, double {tempo * 2:.0f}) | key {key} (fit {fit:.2f})')
    order = np.argsort(-chroma.mean(axis=1))
    print('strongest pitch classes:', ' '.join(NOTES[i] for i in order[:6]))
    print(f'loudness: median {np.median(db):.1f} dB, quietest 10% {np.percentile(db, 10):.1f}, loudest 10% {np.percentile(db, 90):.1f}  (range {np.percentile(db, 90) - np.percentile(db, 10):.1f} dB)')
    print(f'bass weight (<150 Hz share of energy): {100 * low.mean():.0f}% | brightness (centroid): {cent.mean():.0f} Hz | drums vs pitched: {100 * perc_rms.mean() / (perc_rms.mean() + harm_rms.mean()):.0f}% percussive')
    # When the drums arrive: the first second whose percussive energy passes half its later median.
    sec = int(sr / hop)
    p_sec = np.array([perc_rms[i:i + sec].mean() for i in range(0, len(perc_rms) - sec, sec)])
    ref = np.median(p_sec[len(p_sec) // 4:])
    first = next((i for i, v in enumerate(p_sec) if v > 0.5 * ref), 0)
    print(f'drums are in by ~{first}s')
    # The shape: eight equal stretches of the track.
    print('  stretch    loud(dB)  bass%  bright(Hz)  perc%  densest notes')
    n = 8
    for k in range(n):
        a, b = int(k * len(rms) / n), int((k + 1) * len(rms) / n)
        ch = chroma[:, a:b].mean(axis=1)
        top = ' '.join(NOTES[i] for i in np.argsort(-ch)[:3])
        pr = perc_rms[a:b].mean()
        print(f'  {t[a]:5.0f}-{t[b - 1]:3.0f}s  {db[a:b].mean():7.1f}  {100 * low[a:b].mean():4.0f}  {cent[a:b].mean():9.0f}  {100 * pr / (pr + harm_rms[a:b].mean()):4.0f}   {top}')
    # Does it come back? Similarity of the opening material to the rest (chroma, 10 s blocks).
    blk = int(10 * sr / hop)
    blocks = [chroma[:, i:i + blk].mean(axis=1) for i in range(0, chroma.shape[1] - blk, blk)]
    if len(blocks) > 3:
        ref_b = blocks[2]
        sims = [float(np.dot(ref_b, b) / (np.linalg.norm(ref_b) * np.linalg.norm(b) + 1e-9)) for b in blocks]
        print('harmonic likeness to the 20-30s block, per 10s:', ' '.join(f'{s:.2f}' for s in sims))


for p in sys.argv[1:]:
    analyse(p.replace('\\', '/'))
