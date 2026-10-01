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
const { tracks } = read('data/legend-music.json');
const { events } = read('data/battle-music.json');
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
}

const lengthMs = file => Math.round(1000 * Number(execFileSync('ffprobe',
	['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim()));

// Each track loops from its start to a little before its end, skipping the fade-out.
const files = {};
for (const t of tracks) {
	const f = path.join(LEGENDS_DIR, `${t.file}.mp3`);
	if (t.species.length && !fs.existsSync(f)) throw new Error(`legend track ${t.file} is not cut yet (scripts/cut-legend-music.js)`);
	if (t.species.length) files[`legends/${t.file}`] = lengthMs(f) - 2500;
}
const EVENT_OF = {};
for (const [id, e] of Object.entries(events)) {
	const f = path.join(EVENTS_DIR, `${e.file}.mp3`);
	if (!fs.existsSync(f)) throw new Error(`event song ${e.file} is not cut yet (--cut <folder>)`);
	files[`events/${e.file}`] = lengthMs(f) - 4000;
	EVENT_OF[id] = `events/${e.file}`;
}

const LEGEND_OF = {};
for (const t of tracks) for (const s of t.species) LEGEND_OF[s] = `legends/${t.file}`;

// Rare wild: what the rarity ladder puts at rare or above, and anything shiny (the client checks that).
const Dex = require(path.join(ROOT, 'src', 'rp-dex'))();
const Rarity = require(path.join(ROOT, 'src', 'rarity'));
const RARE = new Set(['rare', 'starter', 'pseudo', 'ub', 'paradox', 'legendary', 'mythical', 'boxart']);
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
	const role = c.id === 'gymleader' ? 'gym' : ['elitefour', 'champion'].includes(c.id) ? 'league' : 'trainer';
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
