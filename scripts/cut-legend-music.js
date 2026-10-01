'use strict';
/**
 * Cut the legendary-themes compilation into one file per track.
 *
 *   node scripts/cut-legend-music.js "<compilation.mp3 or .mp4>" [--all]
 *
 * Reads data/legend-music.json (start times from the compilation's tracklist),
 * writes client/audio/legends/<file>.mp3 for every track that plays for some
 * Pokemon (--all: the alternate versions too). Each runs from its start to the
 * next track's start, re-encoded at VBR ~130 kbps with a 2-second fade-out so a
 * cut never ends mid-note. Needs ffmpeg and ffprobe on PATH.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const input = process.argv[2];
if (!input || !fs.existsSync(input)) { console.error('usage: node scripts/cut-legend-music.js <compilation file> [--all]'); process.exit(1); }
const all = process.argv.includes('--all');
const ROOT = path.join(__dirname, '..');
const { tracks } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'legend-music.json'), 'utf8'));
const OUT = path.join(ROOT, 'client', 'audio', 'legends');
fs.mkdirSync(OUT, { recursive: true });

const seconds = t => t.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', input]).toString().trim());

let made = 0;
tracks.forEach((t, i) => {
	if (!all && !t.species.length) return;
	const start = seconds(t.start);
	const end = i + 1 < tracks.length ? seconds(tracks[i + 1].start) : total;
	const length = Math.max(1, end - start);
	const fade = Math.min(2, length / 4);
	const file = path.join(OUT, `${t.file}.mp3`);
	execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(start), '-t', String(length), '-i', input,
		'-vn', '-af', `afade=t=out:st=${(length - fade).toFixed(2)}:d=${fade.toFixed(2)}`,
		'-c:a', 'libmp3lame', '-q:a', '5', file]);
	made++;
	console.log(`${t.file}.mp3  ${t.start}  ${Math.round(length)}s  ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB  -> ${t.species.join(', ') || '(alternate)'}`);
});
console.log(`${made} tracks in ${path.relative(ROOT, OUT)}`);
