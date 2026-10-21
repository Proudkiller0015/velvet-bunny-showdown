'use strict';
/**
 * Touhou character themes (data/touhou-music.json, tools/music/touhou.py): every Touhou
 * species plays its character's theme or is listed as missing one, every track is on disk
 * and decodes, every loop sits inside its file, and the client's own lookup - run here as
 * the browser runs it - picks the right theme, over wild/trainer music but never over a
 * legendary or a gym leader, the first Touhou out keeping it. Needs ffprobe on PATH; no
 * node_modules.
 *
 *   node test/touhou-music.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const music = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'touhou-music.json'), 'utf8'));
const { species } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'velvet', 'touhou-data.json'), 'utf8'));
const client = fs.readFileSync(path.join(ROOT, 'client', 'js', 'velvet-data.js'), 'utf8');
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

// ---- Every species: a theme, or a reason it has none; never both, never twice.
const themeOf = {};
for (const t of music.tracks) for (const s of t.species) { ok(!themeOf[s], `${s} has one theme`); themeOf[s] = t.file; }
for (const id of Object.keys(species)) ok(!!themeOf[id] !== !!music.missing[id], `${id}: a theme or a missing note`);
for (const id of [...Object.keys(themeOf), ...Object.keys(music.missing)]) ok(species[id], `${id} is a Touhou species`);
// A forme plays its base's theme.
for (const [id, s] of Object.entries(species)) {
	const base = s.baseSpecies && s.baseSpecies !== s.name && Object.keys(species).find(k => species[k].name === s.baseSpecies);
	if (base && themeOf[base]) ok(themeOf[id] === themeOf[base], `${id} plays ${base}'s theme`);
}

// ---- Every track: on disk, decodes, mono and small, its loop inside it, and in the client.
const block = /\/\* MUSIC-DATA-START[\s\S]*?MUSIC-DATA-END \*\//.exec(client)[0];
const data = {};
vm.runInNewContext(block + '; out.MUSIC_LOOP = MUSIC_LOOP; out.TOUHOU_OF = TOUHOU_OF; out.TOUHOU_NAMES = TOUHOU_NAMES; out.LEGEND_OF = LEGEND_OF; out.NPC_TRAINERS = NPC_TRAINERS;', { out: data });
let bytes = 0;
for (const t of music.tracks) {
	const f = path.join(ROOT, 'client', 'audio', 'touhou', `${t.file}.mp3`);
	ok(fs.existsSync(f), `${t.file}.mp3 exists`);
	bytes += fs.statSync(f).size;
	const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=channels,codec_name', '-of', 'json', f]).toString();
	const p = JSON.parse(probe);
	const ms = 1000 * Number(p.format.duration);
	ok(p.streams[0].codec_name === 'mp3' && p.streams[0].channels === 1, `${t.file}: mono mp3`);
	ok(t.loop && t.loop[0] >= 1000 && t.loop[1] - t.loop[0] >= 30000, `${t.file}: a loop of 30 s or more`);
	ok(t.loop[1] + 1500 <= ms, `${t.file}: the music runs on past its loop end (${t.loop[1]} of ${Math.round(ms)} ms)`);
	ok(JSON.stringify(data.MUSIC_LOOP[`touhou/${t.file}`]) === JSON.stringify(t.loop), `${t.file}: the client has its loop`);
	ok(data.TOUHOU_NAMES[`touhou/${t.file}`] === `${t.title} (${t.character})`, `${t.file}: named in the music picker`);
	for (const s of t.species) ok(data.TOUHOU_OF[s] === `touhou/${t.file}`, `client: ${s} -> ${t.file}`);
}
// Every file decodes to the end (ffmpeg reports no errors).
for (const t of music.tracks) {
	const f = path.join(ROOT, 'client', 'audio', 'touhou', `${t.file}.mp3`);
	const err = require('child_process').spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
	ok(!err.trim(), `${t.file} decodes cleanly${err ? ': ' + err.slice(0, 120) : ''}`);
}
ok(bytes < 125 * 1048576, `the Touhou themes stay small (${(bytes / 1048576).toFixed(1)} MiB)`);

// ---- The client's lookup, run as the browser runs it.
const a = client.indexOf('\tvar MUSIC_RANK');
const b = client.indexOf('\tfunction playEventMusic');
const nameToId = {};
for (const [id, s] of Object.entries(species)) nameToId[id] = s;
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const Dex = { species: { get: id => { const s = nameToId[toID(id)]; return s ? { baseSpecies: s.baseSpecies || s.name } : { baseSpecies: '' }; } } };
const sandbox = { window: { toID, Dex }, Dex, out: {} };
vm.runInNewContext(block + client.slice(a, b) + '; out.musicFor = musicFor; out.RANK = MUSIC_RANK;', sandbox);
const { musicFor, RANK } = sandbox.out;
const side = (name, avatar) => ({ name, avatar, battle: { tier: '[Gen 9] RP Touhou' } });
const mon = (sp, s) => ({ speciesForme: sp, side: s });
const pick = (sp, s) => musicFor(mon(sp, s || side('Player', '1')));
ok(pick('Reimu Hakurei').file === 'touhou/maidens-capriccio', 'Reimu Hakurei -> Maiden\'s Capriccio');
ok(pick('Flandre Scarlet').file === 'touhou/un-owen-was-her', 'Flandre Scarlet -> U.N. Owen Was Her?');
ok(pick('Cirno').file === 'touhou/beloved-tomboyish-girl' && pick('Cirno-Tanned').file === 'touhou/beloved-tomboyish-girl', 'Cirno and Cirno-Tanned -> Beloved Tomboyish Girl');
ok(pick('Hecatia-Moon').file === 'touhou/pandemonic-planet', 'a forme plays its base\'s theme');
ok(pick('Pikachu') === null, 'a Pokemon in a player battle changes nothing');
ok(pick('Sakuya Izayoi').kind === 'touhou', 'a Touhou Pokemon, player-vs-player');
ok(pick('Remilia Scarlet', side('Wild Remilia Scarlet', '')).file === 'touhou/septette-for-the-dead-princess', 'a wild one too');
ok(pick('Mewtwo', side('Wild Mewtwo', '')).kind === 'legend', 'a wild legendary keeps its theme');
// Ranks: over wild and trainer music, tied with gym/E4/Champion/troll (they stay), under a legendary.
ok(RANK.touhou > RANK.wild && RANK.touhou > RANK.trainer && RANK.touhou > RANK.rarewild, 'over wild and trainer music');
ok(RANK.touhou === RANK.gym && RANK.touhou < RANK.legend, 'never over a gym leader or a legendary');

// ---- The music picker (Settings > sound): every theme under a "Touhou" heading, by name, and
// only there. Its own code builds the menu here, with just enough of jQuery to catch the HTML.
{
	const c = client.replace(/\r\n/g, '\n');
	const from = c.indexOf('\tvar NATIVE_MUSIC = [');
	const at = c.indexOf('\tfunction installMusicPlayer');
	const to = c.indexOf('\n\t}\n', at) + 3;
	let html = '';
	const $ = h => ({ html: h, insertBefore() {}, find: () => ({ on() {} }) });
	function SoundsPopup() {}
	SoundsPopup.prototype.initialize = function () {};
	const box = { window: { SoundsPopup, jQuery: $ }, jQuery: $, localStorage: { getItem: () => null }, out: {} };
	vm.runInNewContext(block + c.slice(from, to) + '; out.install = installMusicPlayer;', box);
	ok(box.out.install(), 'the music picker installs');
	const popup = new SoundsPopup();
	popup.$el = { find: () => ({ closest: () => ({ length: 0 }) }), append: s => { html = s.html; } };
	popup.initialize();
	const group = label => (new RegExp(`<optgroup label="${label}">(.*?)</optgroup>`).exec(html) || [])[1] || '';
	const th = group('Touhou');
	for (const t of music.tracks) {
		ok(th.includes(`<option value="ours:touhou/${t.file}">${t.title} (${t.character})</option>`), `picker: ${t.title} (${t.character}) under Touhou`);
		ok(!group('Velvet Bunny').includes(`touhou/${t.file}"`), `picker: ${t.file} not under Velvet Bunny`);
	}
	ok(group('Velvet Bunny').includes('ours:legends/makuro'), 'the Velvet Bunny group keeps its own tracks');
}
console.log(`touhou-music: ${n} checks passed, ${music.tracks.length} tracks, ${Object.keys(themeOf).length} species, ${(bytes / 1048576).toFixed(1)} MiB`);
