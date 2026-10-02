"""An ear, of a kind (owner, 2 Oct 2026: "is there a way to make u physically hear a song and
understand it... even if it needs a bit of work"). The composer here cannot hear. This is a
model that was trained on recordings paired with descriptions (CLAP), so it can say how well
a piece of audio matches a phrase - "eerie ghostly music", "cheerful adventure game music" -
and how close two recordings are to each other in what they sound like, not just in notes.

    python ear.py <audio> [more audio...]              what each sounds like, in words
    python ear.py --like <reference> <audio> [...]     how close each is to the reference

It scores 10-second windows and averages them. It is an opinion, not the truth: it has
never been told what a Pokemon theme is, only what music in general sounds like.
"""
import sys
import warnings
import numpy as np

warnings.filterwarnings('ignore')
MODEL = 'laion/clap-htsat-unfused'
WORDS = {
    'mood': ['eerie ghostly haunting music', 'cheerful bright adventure game music', 'menacing ominous threatening music',
             'heroic triumphant music', 'sad melancholy music', 'calm peaceful music', 'tense fast battle music'],
    'kind': ['video game boss battle theme', 'video game overworld or town theme', 'film orchestral score',
             'japanese traditional folk music', 'rock song with electric guitar', 'electronic dance music'],
    'sound': ['retro 16-bit video game soundtrack', 'nintendo ds era sequenced game music', 'live symphony orchestra recording',
              'cheap general midi keyboard demo', 'modern cinematic trailer music'],
}
_state = {}


def model():
    if not _state:
        import torch
        from transformers import ClapModel, ClapProcessor
        _state['torch'] = torch
        _state['m'] = ClapModel.from_pretrained(MODEL).eval()
        _state['p'] = ClapProcessor.from_pretrained(MODEL)
    return _state['torch'], _state['m'], _state['p']


def windows(path, seconds=10, hop=10, limit=12):
    import librosa
    y, sr = librosa.load(path, sr=48000, mono=True)
    n, out = int(seconds * sr), []
    for i in range(0, max(1, len(y) - n + 1), int(hop * sr)):
        out.append(y[i:i + n])
        if len(out) >= limit:
            break
    return out or [y]


def embed_audio(path):
    torch, m, p = model()
    clips = windows(path)
    with torch.no_grad():
        inputs = p(audio=clips, sampling_rate=48000, return_tensors='pt', padding=True)
        e = m.audio_projection(m.audio_model(**inputs).pooler_output)   # the shared space audio and words are compared in
    e = e / e.norm(dim=-1, keepdim=True)
    return e


def embed_text(texts):
    torch, m, p = model()
    with torch.no_grad():
        e = m.text_projection(m.text_model(**p(text=texts, return_tensors='pt', padding=True)).pooler_output)
    return e / e.norm(dim=-1, keepdim=True)


def hear(path):
    torch, m, _ = model()
    a = embed_audio(path)
    out = {}
    for group, phrases in WORDS.items():
        t = embed_text(phrases)
        sims = (a @ t.T) * m.logit_scale_a.exp()
        probs = sims.softmax(dim=-1).mean(dim=0).detach().numpy()
        out[group] = sorted(zip(phrases, probs), key=lambda x: -x[1])
    return out


def likeness(reference, path):
    a, b = embed_audio(reference).mean(dim=0), embed_audio(path).mean(dim=0)
    a, b = a / a.norm(), b / b.norm()
    return float(a @ b)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--like':
        ref = args[1]
        for f in args[2:]:
            print(f'{likeness(ref, f):.3f}  {f}')
    else:
        for f in args:
            print(f'\n{f}')
            for group, rows in hear(f).items():
                print(f'  {group:6s} ' + ' | '.join(f'{ph} {100 * pr:.0f}%' for ph, pr in rows[:4]))
