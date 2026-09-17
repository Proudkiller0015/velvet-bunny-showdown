'use strict';
/**
 * What is actually played, and what actually wins, on this server.
 *
 * Smogon's usage statistics describe a different game: they know nothing about
 * Keystone Legion, a Glaceon that doubles its Speed in snow, or which of our
 * buffed Pokemon people bring. The bots drafted teams against that other game
 * and lost twenty in a row to a team built around ours.
 *
 * So the server reads its own battles. Every saved replay is a real game played
 * here; this counts, per format, how often each Pokemon appeared, how many
 * knockouts it scored and how often it fainted, and writes the table the team
 * builder reads (src/teambuilder.js: threats() and rank()).
 *
 *   node scripts/rp-usage.js              # rewrite data/velvet/rp-usage.json
 *   node scripts/rp-usage.js --print      # and show the table
 *
 * Run it after a batch of games; the file is small and committed, so a fresh
 * deploy starts with what the server already learned.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'replays');
const OUT = path.join(__dirname, '..', 'data', 'velvet', 'rp-usage.json');
const MIN_GAMES = 3;

function formatOf(id) {
	const m = /^([a-z0-9]+)-/.exec(String(id || ''));
	return m ? m[1] : String(id || '');
}

function mine() {
	const table = {};
	let games = 0;
	for (const file of fs.readdirSync(DIR)) {
		if (!file.endsWith('.json')) continue;
		let replay;
		try { replay = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch (e) { continue; }
		const format = formatOf(replay.id);
		if (!/^gen\d/.test(format)) continue;
		const lines = String(replay.log || '').split('\n');
		const per = (table[format] = table[format] || {});
		games++;
		// Who each Pokemon belonged to, and who won: appearing often means nothing if
		// its side keeps losing (the bots' own Dragonite led the appearance count).
		const winner = (/\|win\|(.+)/.exec(replay.log) || [])[1];
		const players = replay.players || [];
		const wonSide = winner ? (String(players[0] || '').trim() === String(winner).trim() ? 'p1' : 'p2') : null;
		const seen = new Map();
		const active = { p1: '', p2: '' };
		let lastMove = null;
		for (const line of lines) {
			const parts = line.slice(1).split('|');
			const cmd = parts[0];
			const side = String(parts[1] || '').slice(0, 2);
			const name = String(parts[1] || '').replace(/^p[12][a-c]?: /, '');
			if (cmd === 'poke') {
				const species = String(parts[2] || '').split(',')[0].trim();
				if (species) seen.set(species, String(parts[1] || '').slice(0, 2));
				continue;
			}
			if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
				const species = String(parts[2] || '').split(',')[0].trim() || name;
				active[side] = species;
				if (!seen.has(species)) seen.set(species, side);
				continue;
			}
			if (cmd === 'move') { lastMove = { side, species: active[side] }; continue; }
			if (cmd === 'faint') {
				const died = active[side];
				if (died) {
					const row = (per[died] = per[died] || { games: 0, kos: 0, faints: 0, wins: 0 });
					row.faints++;
				}
				// The knockout goes to whoever moved last, unless they knocked themselves out.
				if (lastMove && lastMove.side !== side && lastMove.species) {
					const row = (per[lastMove.species] = per[lastMove.species] || { games: 0, kos: 0, faints: 0, wins: 0 });
					row.kos++;
				}
			}
		}
		for (const [species, owner] of seen) {
			const row = (per[species] = per[species] || { games: 0, kos: 0, faints: 0, wins: 0 });
			row.games++;
			if (wonSide && owner === wonSide) row.wins++;
		}
	}
	/*
	 * The score a draft sorts by: how well it does here, not how often it turns up.
	 * Win rate is the spine of it, knockouts per game say how much of the work it
	 * did, and fainting every game pulls it back down. Few games are pulled towards
	 * the middle, so one lucky appearance cannot top the table.
	 */
	for (const per of Object.values(table)) {
		for (const row of Object.values(per)) {
			const games = row.games || 1;
			const winRate = (row.wins + 1) / (games + 2);
			row.kosPerGame = row.kos / games;
			row.faintsPerGame = row.faints / games;
			const confidence = Math.min(1, games / 10);
			const strength = winRate * (1 + Math.min(2, row.kosPerGame)) / (1 + Math.min(1.5, row.faintsPerGame));
			row.score = Number((0.5 + confidence * (strength - 0.5)).toFixed(5));
		}
	}
	return { games, table };
}

const { games, table } = mine();
const trimmed = {};
for (const [format, per] of Object.entries(table)) {
	const rows = Object.entries(per).filter(([, r]) => r.games >= MIN_GAMES);
	if (!rows.length) continue;
	trimmed[format] = Object.fromEntries(rows.sort((a, b) => b[1].score - a[1].score));
}
fs.writeFileSync(OUT, `${JSON.stringify({ updated: new Date().toISOString(), games, formats: trimmed }, null, '\t')}\n`);
console.log(`read ${games} replay(s) -> ${OUT}`);
for (const [format, per] of Object.entries(trimmed)) {
	const top = Object.entries(per).slice(0, 10).map(([name, r]) => `${name} (${r.games}g ${r.kos}ko)`);
	console.log(`  ${format}: ${Object.keys(per).length} species; top: ${top.join(', ')}`);
	if (process.argv.includes('--print')) for (const [name, r] of Object.entries(per)) console.log(`    ${name.padEnd(20)} games ${r.games} kos ${r.kos} faints ${r.faints} score ${r.score}`);
}
