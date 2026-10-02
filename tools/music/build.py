"""Score -> audio -> under water -> bubbles -> loudness. python build.py makuro5 makuro-v6"""
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
score, name = sys.argv[1], sys.argv[2]
length = sys.argv[3] if len(sys.argv) > 3 else '84.3'   # of the music; the dive scene adds its own lead-in
out = os.path.join(here, 'out')
env = dict(os.environ)
subprocess.run([sys.executable, os.path.join(here, score + '.py')], check=True, env=env, capture_output=True)
made = max((f for f in os.listdir(out) if f.endswith('.wav')), key=lambda f: os.path.getmtime(os.path.join(out, f)))
wav = os.path.join(out, made)
deep = os.path.join(out, '_deep.wav')
subprocess.run([sys.executable, os.path.join(here, 'deep.py'), wav, deep], check=True, capture_output=True)
dry = os.path.join(out, '_dry.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', deep, '-t', length, '-af', 'aecho=0.8:0.6:90|180:0.18|0.10', '-codec:a', 'libmp3lame', '-b:a', '192k', dry], check=True)
wet = os.path.join(out, '_wet.mp3')
subprocess.run([sys.executable, os.path.join(here, 'water_dive.py'), dry, wet], check=True, capture_output=True)
final = os.path.join(out, name + '.mp3')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wet, '-af', 'alimiter=limit=0.97:level=disabled:attack=1:release=40', '-codec:a', 'libmp3lame', '-b:a', '192k', final], check=True)
for f in (wav, deep, dry, wet, wav[:-4] + '.mp3'):
    if os.path.exists(f) and f != final:
        os.remove(f)
print(final)
