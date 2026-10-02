'use strict';
/**
 * The battle music table the client reads, built from the data files.
 *
 *   node scripts/build-battle-music.js [--cut <folder with the owner's downloads>]
 *
 * --cut first encodes the event songs in data/battle-music.json from their sources
 * into client/audio/events (leading silence trimmed, VBR ~130 kbps like the
 * legendary themes). Then, always: measures every track in client/audio/legends and
 * client/audio/events, and rewrites the block between the MUSIC-DATA markers in
 * client/js/velvet-data.js with
 *   - which wild species play which legendary theme (data/legend-music.json),
 *   - which wild species count as rare (src/rarity.js: rare and up, or no theme),
 *   - which trainer avatars and titles are NPC trainers (src/encounters.js),
 *   - each track's file and length, so it loops before its fade-out.
 * Needs ffmpeg/ffprobe on PATH and `npm run setup` done (it reads the RP dex).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const { tracks, own = [] } = read('data/legend-music.json');
const { events, sounds = {} } = read('data/battle-music.json');
const EVENTS_DIR = path.join(ROOT, 'client', 'audio', 'events');
const LEGENDS_DIR = path.join(ROOT, 'client', 'audio', 'legends');

const cutAt = process.argv.indexOf('--cut');
if (cutAt > -1) {
	const from = process.argv[cutAt + 1];
	fs.mkdirSync(EVENTS_DIR, { recursive: true });
	for (const [id, e] of Object.entries(events)) {
		const src = path.join(from, e.source);
		if (!fs.existsSync(src)) throw new Error(`${id}: no ${src}`);
		execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vn',
			'-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
			'-c:a', 'libmp3lame', '-q:a', '5', path.join(EVENTS_DIR, `${e.file}.mp3`)]);
		console.log(`cut ${id}: ${e.file}.mp3`);
	}
	// Sound effects: just the sound, from..to, a little louder (the shiny sparkle was quiet).
	const SFX = path.join(ROOT, 'client', 'audio', 'sfx');
	fs.mkdirSync(SFX, { recursive: true });
	for (const [id, e] of Object.entries(sounds)) {
		const src = path.join(from, e.source);
		if (!fs.existsSync(src)) throw new Error(`${id}: no ${src}`);
		execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(e.from || 0), ...(e.to ? ['-to', String(e.to)] : []), '-i', src, '-vn',
			'-af', `volume=${e.gainDb || 0}dB,afade=t=out:st=${Math.max(0, (e.to || 1) - (e.from || 0) - 0.15)}:d=0.15`,
			'-c:a', 'libmp3lame', '-q:a', '4', path.join(SFX, `${e.file}.mp3`)]);
		console.log(`cut sound ${id}: ${e.file}.mp3`);
	}
}

const lengthMs = file => Math.round(1000 * Number(execFileSync('ffprobe',
	['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim()));

/*
 * Where a track stops being full volume, in ms: the loop end. The tracks fade out over
 * their last few seconds - some go silent ten seconds early (Primal, Mewtwo) - and the
 * client's loop (BattleBGM.updateTime) jumps back to the start 1 s before the loop end,
 * so a fixed margin either clipped music or looped through a fade and silence. Reads the
 * loudness of each second of the last 30, takes the usual level from the first ten, and
 * ends the loop after the last second within 2.5 dB of it.
 */
function loopEndMs(file) {
	const length = lengthMs(file);
	const rate = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file]).toString().trim()) || 44100;
	const tail = Math.min(30, Math.floor(length / 1000) - 1);
	const out = require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-sseof', String(-tail), '-i', file,
		'-af', `asetnsamples=n=${rate},astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level`,
		'-f', 'null', '-'], { encoding: 'utf8' }).stderr;
	const levels = [...out.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map(m => (m[1] === '-inf' ? -120 : Number(m[1])));
	if (levels.length < 12) return length - 6000;
	const usual = [...levels.slice(0, 10)].sort((a, b) => a - b)[5];
	let last = 0;
	levels.forEach((db, i) => { if (db >= usual - 2.5) last = i; });
	return Math.round(length - (levels.length - (last + 1)) * 1000);
}

/*
 * Where the song repeats: most tracks are an intro, then the main part twice (Cynthia's
 * piano intro, then the battle). Compares the loudness of every quarter second with the
 * same moment one repeat later; the best-matching repeat length, and the first moment
 * the match holds for 20 s, give a loop that skips the intro and never plays the fade.
 * [startMs, endMs], or null when nothing repeats clearly enough to trust.
 */
function refineMs(file, rate, startMs, roughMs) {
	const out = require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-ss', String(startMs / 1000), '-t', String(roughMs / 1000 + 25), '-i', file,
		'-af', `asetnsamples=n=${Math.round(rate / 100)},astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level`,
		'-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr;
	const v = [...out.matchAll(/RMS_level=(-?[d.]+|-inf)/g)].map(m => (m[1] === '-inf' ? -90 : Number(m[1])));
	const rough = Math.round(roughMs / 10);
	let best = { s: Infinity, L: rough };
	for (let L = rough - 50; L <= rough + 50; L++) {
		let s = 0;
		for (let t = 0; t < 2000 && t + L < v.length; t++) s += Math.abs(v[t] - v[t + L]);
		if (s < best.s) best = { s, L };
	}
	return best.L * 10;
}

function repeatLoop(file, loudEnd) {
	const rate = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', file]).toString().trim()) || 44100;
	const out = require('child_process').spawnSync('ffmpeg', ['-v', 'info', '-i', file,
		'-af', `asetnsamples=n=${Math.round(rate / 4)},astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level`,
		'-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr;
	const v = [...out.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map(m => (m[1] === '-inf' ? -90 : Number(m[1])));
	const step = 0.25;
	const n = v.length;
	const usable = Math.floor(loudEnd / 1000 / step);
	let best = null;
	for (let L = Math.round(30 / step); L < Math.min(Math.round(150 / step), Math.floor(usable * 0.6)); L++) {
		let s = 0, c = 0;
		for (let t = 0; t + L < usable; t++) { s += Math.abs(v[t] - v[t + L]); c++; }
		if (c > 80 && (!best || s / c < best.score)) best = { score: s / c, L };
	}
	if (!best || best.score > 2.2) return null;
	for (let t = 0; t + best.L + 80 < usable; t++) {
		let s = 0;
		for (let k = 0; k < 80; k++) s += Math.abs(v[t + k] - v[t + k + best.L]);
		if (s / 80 < 1.2) {
			// One second in, so the jump (1 s before the end) lands inside the repeat; the
			// repeat length is then refined to 10 ms, or the jump lands off the beat.
			const start = Math.round((t * step + 1) * 1000);
			const end = start + refineMs(file, rate, start, best.L * step * 1000);
			return end <= loudEnd ? [start, end] : null;
		}
	}
	return null;
}
/*
 * Only for tracks marked loop: "repeat" (Cynthia: her piano intro once, then the battle).
 * Loudness finds where a song repeats but not whether the melody does, so a short phrase
 * can pass for the loop; every other track loops from its start, which is always clean.
 */
const loopOf = (f, repeat) => { const end = loopEndMs(f); return (repeat && repeatLoop(f, end)) || [0, end]; };

const files = {};
for (const t of tracks) {
	const f = path.join(LEGENDS_DIR, `${t.file}.mp3`);
	if (t.species.length && !fs.existsSync(f)) throw new Error(`legend track ${t.file} is not cut yet (scripts/cut-legend-music.js)`);
	if (t.species.length) files[`legends/${t.file}`] = loopOf(f, t.loop === 'repeat');
}
// Themes written for this server (tools/music): their loop is set by hand from the score.
for (const t of own) {
	const f = path.join(LEGENDS_DIR, `${t.file}.mp3`);
	if (!fs.existsSync(f)) throw new Error(`our own theme ${t.file}.mp3 is missing from client/audio/legends`);
	files[`legends/${t.file}`] = t.loop;
}
const EVENT_OF = {};
for (const [id, e] of Object.entries(events)) {
	const f = path.join(EVENTS_DIR, `${e.file}.mp3`);
	if (!fs.existsSync(f)) throw new Error(`event song ${e.file} is not cut yet (--cut <folder>)`);
	files[`events/${e.file}`] = loopOf(f, e.loop === 'repeat');
	EVENT_OF[id] = `events/${e.file}`;
}

const LEGEND_OF = {};
for (const t of [...tracks, ...own]) for (const s of t.species) LEGEND_OF[s] = `legends/${t.file}`;

// Rare wild: what the rarity ladder puts at rare or above, and anything shiny (the client checks that).
const Dex = require(path.join(ROOT, 'src', 'rp-dex'))();
const Rarity = require(path.join(ROOT, 'src', 'rarity'));
const RARE = new Set(['prized', 'starter', 'pseudo', 'ub', 'paradox', 'legendary', 'mythical', 'boxart']);
const rare = [];
for (const s of Dex.species.all()) {
	if (s.num <= 0 || LEGEND_OF[s.id]) continue;
	let cls;
	try { cls = Rarity.classOf(s.name); } catch (e) { continue; }
	if (RARE.has(cls)) rare.push(s.id);
}

// NPC trainers: the avatar each class battles with, and the titles its name starts with.
const E = require(path.join(ROOT, 'src', 'encounters'));
const TRAINERS = {};
for (const c of E.TRAINER_CLASSES) {
	if (!c.avatar) continue;
	const role = c.id === 'gymleader' ? 'gym' : ['elitefour', 'champion'].includes(c.id) ? c.id : 'trainer';
	const t = TRAINERS[c.avatar] = TRAINERS[c.avatar] || { role, titles: [] };
	for (const title of [c.title, c.short].filter(Boolean)) if (!t.titles.includes(title)) t.titles.push(title);
}

const block = [
	'\t/* MUSIC-DATA-START: written by scripts/build-battle-music.js - edit the data files, not this. */',
	`\tvar MUSIC_LOOP = ${JSON.stringify(files)};`,
	`\tvar MUSIC_EVENT = ${JSON.stringify(EVENT_OF)};`,
	`\tvar LEGEND_OF = ${JSON.stringify(LEGEND_OF)};`,
	`\tvar RARE_WILD = ${JSON.stringify(Object.fromEntries(rare.sort().map(id => [id, 1])))};`,
	`\tvar NPC_TRAINERS = ${JSON.stringify(TRAINERS)};`,
	'\t/* MUSIC-DATA-END */',
].join('\n');

const target = path.join(ROOT, 'client', 'js', 'velvet-data.js');
let src = fs.readFileSync(target, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
src = src.replace(/\r\n/g, '\n');
const a = src.indexOf('\t/* MUSIC-DATA-START');
const b = src.indexOf('/* MUSIC-DATA-END */');
if (a < 0 || b < 0) throw new Error('no MUSIC-DATA markers in velvet-data.js');
src = src.slice(0, a) + block + src.slice(b + '/* MUSIC-DATA-END */'.length);
fs.writeFileSync(target, src.replace(/\n/g, eol));
console.log(`${Object.keys(files).length} tracks, ${Object.keys(LEGEND_OF).length} legendary species, ${rare.length} rare wild species, ${Object.keys(TRAINERS).length} trainer avatars`);
