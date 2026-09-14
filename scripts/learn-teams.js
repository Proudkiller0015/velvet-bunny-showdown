'use strict';
/**
 * What they bring, not just how they play it.
 *
 *   node scripts/learn-teams.js                 # everything mined
 *   node scripts/learn-teams.js --format gen9ou
 *   node scripts/learn-teams.js --sample 50
 *
 * Writes data/mined-teams.json: real teams, from real games, with the sets as
 * far as the replay reveals them.
 *
 * A replay shows both teams at preview and then reveals them piece by piece -
 * every move used, every item knocked off or consumed, every ability announced,
 * every Terastallization. So a game that goes long gives up most of a team
 * sheet. What it never shows is EVs and natures, and it only shows the moves
 * that were actually clicked - so four-move sets come out of long games and
 * two-move sets out of short ones.
 *
 * Two different things come out of this, and they are worth separating:
 *
 * **Teams.** Six species that someone good chose to put together, with the sets
 * they ran. The bot currently assembles a team from usage statistics, which
 * produces six individually reasonable Pokemon and no plan. A real team has a
 * plan in it even when nobody writes the plan down.
 *
 * **Cores.** Which pairs turn up together far more often than their own usage
 * would predict. That is the part that generalises: it is not "copy this team",
 * it is "these two go together, and this one never appears without that one".
 *
 * Only winners are kept by default. It is a crude filter and a real one - the
 * same game contributes the team that worked rather than both.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const MINED = process.env.MINE_DIR || path.join(ROOT, '..', 'reference', 'replays');
const OUT = path.join(ROOT, 'data', 'mined-teams.json');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const at = args.indexOf('--' + name);
	return at >= 0 ? (args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : true) : fallback;
};
const ONLY = typeof flag('format', '') === 'string' ? flag('format', '') : '';
const SAMPLE = Number(flag('sample', 0)) || 0;
const KEEP_PER_FORMAT = Number(flag('keep', 120));
const LOSERS_TOO = !!flag('losers', false);

/** The people whose teams are worth keeping whatever the result. */
const PLAYERS = new Set(['stormzone', 'shikuleo', 'relicstone']);
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * One Pokemon, however the log happens to be naming it at the time.
 *
 * Two different things make the same Pokemon look like two. Team preview hides
 * a forme it does not want to reveal - `Zamazenta-*` - and an in-battle
 * transformation announces a new name when it happens, so a team with one
 * Salamence on it reads as Salamence *and* Salamence-Mega. Left alone, the
 * strongest "core" in every format is a Pokemon paired with itself.
 *
 * Only the transformations are merged. Landorus-Therian and Urshifu-Rapid-Strike
 * are choices somebody made when building, and collapsing those would throw away
 * the thing being learned.
 */
const TRANSFORMED = /-(\*|Mega|Mega-[XY]|Primal|Gmax|Eternamax|Ash|Complete|Origin-.*|Tera)$/;
const baseOf = species => String(species || '').replace(TRANSFORMED, '') || String(species || '');

/**
 * Everything one replay gives up about the two teams in it.
 *
 * Team preview names the six. Everything after it fills them in: a move is
 * revealed by being used, an ability by announcing itself, an item by being
 * eaten or knocked off, a Tera type by being used. A nickname is tracked back to
 * its species, because every later line refers to the nickname and a team of
 * nicknames is no use to anybody.
 */
function readTeams(log) {
	const sides = {
		p1: { name: '', rating: null, team: new Map(), order: [] },
		p2: { name: '', rating: null, team: new Map(), order: [] },
	};
	const nicknames = { p1: {}, p2: {} };
	let tier = '', gen = 0, winner = '', turns = 0, preview = false;

	const member = (side, species) => {
		if (!species) return null;
		if (!sides[side].team.has(species)) {
			sides[side].team.set(species, {
				species, moves: new Set(), item: '', ability: '', tera: '', lead: false,
			});
			sides[side].order.push(species);
		}
		return sides[side].team.get(species);
	};

	const slot = text => {
		const match = /^(p[1-4])[a-f]?: (.*)$/.exec(String(text || ''));
		if (!match) return null;
		const side = match[1];
		return { side, species: nicknames[side] ? nicknames[side][match[2]] : null, nickname: match[2] };
	};

	for (const raw of log.split('\n')) {
		if (!raw.startsWith('|')) continue;
		const parts = raw.slice(1).split('|');
		const kind = parts[0];

		if (kind === 'player' && sides[parts[1]]) {
			sides[parts[1]].name = parts[2] || '';
			sides[parts[1]].rating = Number(parts[4]) || null;
			continue;
		}
		if (kind === 'gen') { gen = Number(parts[1]) || gen; continue; }
		if (kind === 'tier') { tier = String(parts[1] || ''); continue; }
		if (kind === 'win') { winner = toId(parts[1]); continue; }
		if (kind === 'turn') { turns = Number(parts[1]) || turns; continue; }
		if (kind === 'teampreview') { preview = true; continue; }

		// Team preview: `|poke|p1|Species, L50, F|item`
		if (kind === 'poke' && sides[parts[1]]) {
			const species = String(parts[2] || '').split(',')[0].trim();
			const entry = member(parts[1], species);
			if (entry && parts[3] && parts[3] !== 'item') entry.item = entry.item || String(parts[3]);
			continue;
		}

		if (kind === 'switch' || kind === 'drag' || kind === 'replace') {
			const match = /^(p[1-4])[a-f]?: (.*)$/.exec(String(parts[1] || ''));
			if (!match) continue;
			const species = String(parts[2] || '').split(',')[0].trim();
			nicknames[match[1]][match[2]] = species;
			const entry = member(match[1], species);
			if (entry && !sides[match[1]].order.slice(0, 1).length) entry.lead = true;
			continue;
		}

		if (kind === 'move') {
			const who = slot(parts[1]);
			if (!who || !who.species) continue;
			const entry = member(who.side, who.species);
			if (entry && parts[2]) entry.moves.add(parts[2]);
			continue;
		}

		if (kind === '-ability') {
			const who = slot(parts[1]);
			if (who && who.species && parts[2]) member(who.side, who.species).ability = parts[2];
			continue;
		}
		if (kind === '-item' || kind === '-enditem') {
			const who = slot(parts[1]);
			if (who && who.species && parts[2]) member(who.side, who.species).item = parts[2];
			continue;
		}
		if (kind === '-terastallize') {
			const who = slot(parts[1]);
			if (who && who.species && parts[2]) member(who.side, who.species).tera = parts[2];
			continue;
		}
	}

	// Whoever was sent out first led, which team preview does not record.
	for (const side of ['p1', 'p2']) {
		const first = sides[side].order[preview ? 6 : 0];
		const lead = preview ? first : sides[side].order[0];
		if (lead && sides[side].team.has(lead)) sides[side].team.get(lead).lead = true;
	}

	/*
	 * A tier line is written for people - "[Gen 9] OU", but also "OU" on older
	 * replays and "[Gen 9] OU (suspect test)" during one. Without the generation
	 * those land in pools called `ou` and `oususpecttest`, which are nobody's
	 * format and split the sample.
	 */
	const named = toId(tier.replace(/\[Gen \d+\]/i, '').replace(/\(.*\)/, ''));
	const format = named ? `gen${gen || 9}${named}` : '';
	return { format, winner, turns, preview, sides };
}

function asTeam(side, extra) {
	return {
		player: side.name,
		rating: side.rating,
		...extra,
		pokemon: [...side.team.values()].map(entry => ({
			species: entry.species,
			moves: [...entry.moves],
			item: entry.item || undefined,
			ability: entry.ability || undefined,
			tera: entry.tera || undefined,
			lead: entry.lead || undefined,
		})),
	};
}

/* -------------------------------------------------------------- collecting */

const pools = fs.existsSync(MINED) ? fs.readdirSync(MINED, { withFileTypes: true })
	.filter(entry => entry.isDirectory()).map(entry => entry.name) : [];

const byFormat = {};       // format -> teams
const usage = {};          // format -> species -> games
const together = {};       // format -> "a+b" -> games
const leads = {};          // format -> species -> times led
const playerTeams = {};    // player -> teams
let read = 0;

for (const pool of pools) {
	if (ONLY && !pool.includes(ONLY)) continue;
	const dir = path.join(MINED, pool);
	let names = fs.readdirSync(dir).filter(f => f.endsWith('.log.gz'));
	if (SAMPLE) names = names.slice(0, SAMPLE);

	for (const name of names) {
		let log;
		try {
			log = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
		} catch (e) { continue; }
		read++;

		const parsed = readTeams(log);
		if (!parsed.format) continue;
		// Nothing to learn about building a team nobody built.
		if (/random|factory|challengecup|metronome/.test(parsed.format)) continue;
		// Six is a team. Anything less is a game that ended before preview, or a
		// format that does not have one.
		for (const side of ['p1', 'p2']) {
			const entry = parsed.sides[side];
			if (entry.team.size < 3) continue;
			const won = toId(entry.name) === parsed.winner;
			const theirs = PLAYERS.has(toId(entry.name));
			if (!won && !theirs && !LOSERS_TOO) continue;

			const team = asTeam(entry, { format: parsed.format, won, turns: parsed.turns, replay: name.replace('.log.gz', '') });
			(byFormat[parsed.format] = byFormat[parsed.format] || []).push(team);
			if (theirs) (playerTeams[toId(entry.name)] = playerTeams[toId(entry.name)] || []).push(team);

			const species = [...new Set([...entry.team.keys()].map(baseOf))].sort();
			const u = usage[parsed.format] = usage[parsed.format] || {};
			for (const one of species) u[one] = (u[one] || 0) + 1;
			const t = together[parsed.format] = together[parsed.format] || {};
			for (let i = 0; i < species.length; i++) {
				for (let j = i + 1; j < species.length; j++) t[`${species[i]}+${species[j]}`] = (t[`${species[i]}+${species[j]}`] || 0) + 1;
			}
			const l = leads[parsed.format] = leads[parsed.format] || {};
			for (const one of entry.team.values()) if (one.lead) l[baseOf(one.species)] = (l[baseOf(one.species)] || 0) + 1;
		}
		if (read % 200 === 0) process.stdout.write(`\r  read ${read} replays   `);
	}
}
process.stdout.write(`\r  read ${read} replays   \n`);

/**
 * Pairs that appear together more than their own popularity explains.
 *
 * Two Pokemon each on a third of teams will share a team about a ninth of the
 * time by chance alone. What is worth knowing is the pair that beats that by a
 * distance - the one that is not two popular Pokemon, but a decision.
 */
function cores(format) {
	const u = usage[format] || {};
	const t = together[format] || {};
	const games = (byFormat[format] || []).length;
	if (games < 20) return [];
	const out = [];
	for (const [pair, count] of Object.entries(t)) {
		if (count < Math.max(4, games * 0.02)) continue;
		const [a, b] = pair.split('+');
		const expected = (u[a] / games) * (u[b] / games) * games;
		if (expected < 0.5) continue;
		out.push({ pair: [a, b], games: count, lift: Math.round(count / expected * 100) / 100 });
	}
	return out.sort((x, y) => y.lift - x.lift).slice(0, 25);
}

const top = (table, n) => Object.entries(table || {})
	.sort((a, b) => b[1] - a[1]).slice(0, n)
	.map(([name, count]) => ({ name, count }));

const out = {
	builtAt: new Date().toISOString(),
	source: 'team sheets reconstructed from public replays; sets are only what each game revealed',
	formats: {},
	players: {},
};

for (const [format, teams] of Object.entries(byFormat)) {
	// The longest games reveal the most of a team, so those are the ones kept.
	const best = teams.slice().sort((a, b) => b.turns - a.turns).slice(0, KEEP_PER_FORMAT);
	out.formats[format] = {
		teamsSeen: teams.length,
		kept: best.length,
		usage: top(usage[format], 30),
		leads: top(leads[format], 15),
		cores: cores(format),
		teams: best,
	};
}
for (const [player, teams] of Object.entries(playerTeams)) {
	out.players[player] = {
		teams: teams.length,
		byFormat: teams.reduce((acc, team) => { acc[team.format] = (acc[team.format] || 0) + 1; return acc; }, {}),
		kept: teams.slice().sort((a, b) => b.turns - a.turns).slice(0, 60),
	};
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log(`\n${read} replays read -> ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)}KB)\n`);
console.log('format                    teams  kept   most used                     strongest core');
for (const [format, row] of Object.entries(out.formats).sort((a, b) => b[1].teamsSeen - a[1].teamsSeen).slice(0, 14)) {
	const core = row.cores[0];
	console.log(
		format.padEnd(26) +
		String(row.teamsSeen).padStart(5) +
		String(row.kept).padStart(6) + '   ' +
		(row.usage[0] ? `${row.usage[0].name} (${row.usage[0].count})` : '-').padEnd(30) +
		(core ? `${core.pair[0]} + ${core.pair[1]} x${core.lift}` : '-')
	);
}
for (const [player, row] of Object.entries(out.players)) {
	console.log(`\n${player}: ${row.teams} teams  ` +
		Object.entries(row.byFormat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => `${f} ${n}`).join(', '));
}
