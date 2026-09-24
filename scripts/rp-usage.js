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

/*
 * Who counts (owner, 24 Sep 2026). The table was mostly the bots' own games
 * (Bunny Stockfish played more RP OU than anyone) and the owner playing one
 * Cynthia team dozens of times, so "our meta" was the bots' drafts plus one
 * test team - and the bots drafted against themselves. Now: bots and RP
 * encounter opponents don't count at all, and each human counts once per
 * Pokemon however many games they played with it.
 */
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BOT_IDS = new Set(['velvetbunny', ...require('../src/ladder-defaults').ladderQueues('Velvet Bunny').map(q => q.id)]);
let TITLES = [];
try { TITLES = Object.values(require('../src/encounters').TRAINER_CLASSES).map(c => c.title || c.name).filter(Boolean); } catch (e) { /* no classes: bots by name only */ }
TITLES.push('Leader', 'Elite Four', 'Champion', 'Wild');
function isBot(name) {
	const n = String(name || '').trim();
	if (!n) return true;
	if (BOT_IDS.has(toId(n))) return true;
	return TITLES.some(t => n === t || n.startsWith(t + ' '));
}

function cell(per, species, player) {
	const bySpecies = (per[species] = per[species] || {});
	return (bySpecies[player] = bySpecies[player] || { games: 0, kos: 0, faints: 0, wins: 0 });
}

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
		const playerOf = side => String(players[side === 'p2' ? 1 : 0] || '').trim();
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
				if (died && !isBot(playerOf(side))) cell(per, died, playerOf(side)).faints++;
				// The knockout goes to whoever moved last, unless they knocked themselves out.
				if (lastMove && lastMove.side !== side && lastMove.species && !isBot(playerOf(lastMove.side))) {
					cell(per, lastMove.species, playerOf(lastMove.side)).kos++;
				}
			}
		}
		for (const [species, owner] of seen) {
			if (isBot(playerOf(owner))) continue;
			const c = cell(per, species, playerOf(owner));
			c.games++;
			if (wonSide && owner === wonSide) c.wins++;
		}
	}
	/*
	 * Per species, each player's record on their own first, then the players
	 * averaged as equals: seventy games of one team is one player's opinion.
	 */
	for (const [format, per] of Object.entries(table)) {
		const out = {};
		for (const [species, byPlayer] of Object.entries(per)) {
			const rows = Object.values(byPlayer);
			const sum = k => rows.reduce((n, r) => n + r[k], 0);
			const strengthOf = r => {
				const winRate = (r.wins + 1) / (r.games + 2);
				return winRate * (1 + Math.min(2, r.kos / r.games)) / (1 + Math.min(1.5, r.faints / r.games));
			};
			out[species] = {
				games: sum('games'), kos: sum('kos'), faints: sum('faints'), wins: sum('wins'),
				players: rows.length,
				strength: rows.reduce((n, r) => n + strengthOf(r), 0) / rows.length,
			};
		}
		table[format] = out;
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
			row.kosPerGame = row.kos / games;
			row.faintsPerGame = row.faints / games;
			// Confidence and breadth come from how many different people play it, not games.
			const confidence = Math.min(1, row.players / 4) * Math.min(1, games / 6);
			row.breadth = Number(Math.min(1, row.players / 3).toFixed(3));
			row.score = Number((0.5 + confidence * (row.strength - 0.5)).toFixed(5));
			delete row.strength;
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
