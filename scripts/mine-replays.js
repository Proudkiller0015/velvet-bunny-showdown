'use strict';
/**
 * Collect real games by real strong players, to learn how they actually play.
 *
 *   node scripts/mine-replays.js                 # everything, 500 per format
 *   node scripts/mine-replays.js --per 200       # fewer
 *   node scripts/mine-replays.js --format gen9ou # one format
 *   node scripts/mine-replays.js --players       # only the named players
 *
 * The bot's difficulty rungs are configurations of one hand-written heuristic,
 * and measuring them showed the obvious problem: above `easy` they all land
 * within about fifty Elo of each other, because the knobs are guesses about
 * what good play looks like. This is the alternative to guessing - watch two
 * thousand games of people who are actually good and count what they do.
 *
 * Two sources, and they answer different questions.
 *
 * **By format, sorted by rating.** `search.json?sort=rating` returns the
 * highest-rated games the replay site holds, and it stays high a long way down:
 * ten pages of Gen 9 OU is still 1980+, and Random Battle is 2400+ throughout.
 * That is the shape of play at the top of a ladder, across many players, which
 * is what a general policy should be fitted to.
 *
 * **By player.** A specific strong player's whole public history, tournament
 * games included. One person's games are consistent in a way a ladder sample is
 * not - the same reads, the same pivots, the same willingness to double switch -
 * and that consistency is what makes a *style* learnable rather than an average.
 *
 * Random Battle is mined separately and deliberately: with no team preview the
 * game is a different one. You lead blind, you learn the opposing team by
 * meeting it, and the pivoting that wins is about information rather than
 * matchup. A policy fitted to OU would be wrong there in a way that averages out
 * to looking fine.
 *
 * Logs are kept outside the repository, gzipped, because they are hundreds of
 * megabytes and only the distillation belongs in git. Re-running skips what is
 * already downloaded, so this can be stopped and resumed.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const SITE = 'replay.pokemonshowdown.com';
const OUT = process.env.MINE_DIR ||
	path.join(__dirname, '..', '..', 'reference', 'replays');

/**
 * What to learn each of our formats from.
 *
 * The RP tiers are National Dex with our own changes on top, so National Dex is
 * where their play comes from - there is no ladder of RP OU games to watch, and
 * the differences (our items, our Pokemon) change which pieces are on the board
 * rather than how the game is played.
 */
const SOURCES = {
	// The two the bot ladders in, and the two the RP versions stand on.
	gen9randombattle: 'gen9randombattle',
	gen9ou: 'gen9ou',
	gen9nationaldex: 'gen9nationaldex',
	gen9nationaldexubers: 'gen9nationaldexubers',
	// The rest of the modern singles ladder, which the bot accepts challenges in.
	gen9ubers: 'gen9ubers',
	gen9uu: 'gen9uu',
	gen9ru: 'gen9ru',
	gen9nu: 'gen9nu',
	gen9pu: 'gen9pu',
	gen9zu: 'gen9zu',
	gen9monotype: 'gen9monotype',
	gen9lc: 'gen9lc',
	// Doubles is a different game again, and the bot plays it.
	gen9doublesou: 'gen9doublesou',
	gen9vgc2024regg: 'gen9vgc2024regg',
	// Past generations, where the RP past-gen tiers live.
	gen8ou: 'gen8ou',
	gen8nationaldex: 'gen8nationaldex',
	gen7ou: 'gen7ou',
	gen6ou: 'gen6ou',
	gen5ou: 'gen5ou',
	gen4ou: 'gen4ou',
	gen3ou: 'gen3ou',
};

/**
 * People worth watching by name.
 *
 * Storm Zone and the alts it plays under. A player's alts are the same player,
 * so their games are one sample of one style rather than several - which is the
 * point: a ladder sample teaches what good players do on average, and this
 * teaches what one very good player does *in particular*.
 */
const PLAYERS = dedupe([
	'Storm Zone', 'Shikuleo', 'Relic Stone',
]);

/**
 * One entry per person, not per spelling.
 *
 * The replay site searches by userid, so "storm zone" and "stormzone" are the
 * same query and return the same thousand games - listed twice, that is two
 * thousand fetches for one player's history and a summary that reads as though
 * there were two of them.
 */
function dedupe(names) {
	const seen = new Set();
	return names.filter(name => {
		const id = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const at = args.indexOf('--' + name);
	return at >= 0 ? (args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : true) : fallback;
};
const PER_FORMAT = Number(flag('per', 500));
const ONLY_FORMAT = typeof flag('format', '') === 'string' ? flag('format', '') : '';
const PLAYERS_ONLY = !!flag('players', false);

function get(url) {
	return new Promise((resolve, reject) => {
		const request = https.get(url, {
			headers: { 'User-Agent': 'velvet-bunny-showdown research (one server, learning to play)' },
		}, res => {
			if (res.statusCode === 404) { resolve(null); return; }
			if (res.statusCode !== 200) { reject(new Error(`${url} -> ${res.statusCode}`)); return; }
			let body = '';
			res.setEncoding('utf8');
			res.on('data', d => body += d);
			res.on('end', () => resolve(body));
		});
		request.on('error', reject);
		request.setTimeout(30000, () => request.destroy(new Error('timed out')));
	});
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** One page of the replay index. */
async function index(query) {
	const body = await get(`https://${SITE}/search.json?${query}`);
	if (!body) return [];
	try {
		const rows = JSON.parse(body);
		return Array.isArray(rows) ? rows : [];
	} catch (e) {
		return [];
	}
}

/** Enough replay ids for one format, highest-rated first. */
async function listByFormat(format, wanted) {
	const found = new Map();
	for (let page = 1; page <= 40 && found.size < wanted; page++) {
		const rows = await index(`format=${format}&sort=rating&page=${page}`);
		if (!rows.length) break;
		for (const row of rows) if (!found.has(row.id)) found.set(row.id, row);
		process.stdout.write(`\r  ${format}: ${found.size} listed (page ${page})   `);
		await sleep(150);
	}
	process.stdout.write('\n');
	return [...found.values()].slice(0, wanted);
}

/** Everything one player has public, across every format. */
async function listByPlayer(name) {
	const found = new Map();
	for (let page = 1; page <= 20; page++) {
		const rows = await index(`user=${encodeURIComponent(name)}&page=${page}`);
		if (!rows.length) break;
		for (const row of rows) if (!found.has(row.id)) found.set(row.id, row);
		await sleep(150);
	}
	return [...found.values()];
}

function slot(format, id) {
	return path.join(OUT, format.replace(/[^a-z0-9]/gi, ''), `${id}.log.gz`);
}

/** Fetch one log, unless it is already here. */
async function fetchLog(row, format) {
	const file = slot(format, row.id);
	if (fs.existsSync(file)) return 'kept';
	const body = await get(`https://${SITE}/${row.id}.log`);
	if (!body) return 'gone';
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, zlib.gzipSync(body));
	return 'new';
}

/** A few at a time: polite to them, and fast enough for us. */
async function fetchAll(rows, format, label) {
	let done = 0, added = 0, kept = 0, gone = 0;
	const queue = rows.slice();
	const workers = Array.from({ length: 4 }, async () => {
		while (queue.length) {
			const row = queue.shift();
			try {
				const what = await fetchLog(row, format);
				if (what === 'new') added++; else if (what === 'kept') kept++; else gone++;
			} catch (e) {
				gone++;
			}
			done++;
			if (done % 10 === 0 || !queue.length) {
				process.stdout.write(`\r  ${label}: ${done}/${rows.length} (${added} new, ${kept} already here)   `);
			}
			await sleep(60);
		}
	});
	await Promise.all(workers);
	process.stdout.write('\n');
	return { added, kept, gone };
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	console.log(`mining into ${OUT}`);
	const summary = [];

	if (!PLAYERS_ONLY) {
		for (const [ours, source] of Object.entries(SOURCES)) {
			if (ONLY_FORMAT && ours !== ONLY_FORMAT && source !== ONLY_FORMAT) continue;
			const rows = await listByFormat(source, PER_FORMAT);
			if (!rows.length) { console.log(`  ${source}: nothing listed`); continue; }
			const ratings = rows.map(r => r.rating).filter(Boolean);
			const result = await fetchAll(rows, source, source);
			summary.push({
				what: source, replays: rows.length, added: result.added,
				rating: ratings.length ? `${Math.min(...ratings)}-${Math.max(...ratings)}` : 'unrated',
			});
		}
	}

	for (const player of PLAYERS) {
		const rows = await listByPlayer(player);
		if (!rows.length) { console.log(`  ${player}: no public replays`); continue; }
		const byFormat = {};
		for (const row of rows) {
			const id = String(row.format || '').toLowerCase().replace(/[^a-z0-9]/g, '');
			(byFormat[id] = byFormat[id] || []).push(row);
		}
		let added = 0;
		for (const [format, list] of Object.entries(byFormat)) {
			const result = await fetchAll(list, `players/${format}`, `${player} ${format}`);
			added += result.added;
		}
		summary.push({ what: `player: ${player}`, replays: rows.length, added, rating: 'their own' });
	}

	console.log('\nwhat is here now:');
	for (const row of summary) {
		console.log(`  ${String(row.what).padEnd(28)} ${String(row.replays).padStart(5)} replays  ` +
			`${String(row.added).padStart(5)} new  rating ${row.rating}`);
	}
	const total = summary.reduce((n, row) => n + row.replays, 0);
	console.log(`\n${total} replays across ${summary.length} sources`);
	console.log('next: node scripts/learn-playbook.js');
})();
