'use strict';
/**
 * Rate the difficulties against each other on a real Elo scale.
 *
 * Every rung has its own account on the ladder, so its rating is only worth
 * anything if the rungs genuinely differ in strength - otherwise beating
 * Champion and beating Easy are the same achievement wearing different names.
 * This plays a round robin in the simulator and turns the results into Elo, on
 * the same scale the server's ladder uses, which says what a player should
 * expect for beating each one and whether the ladder means anything at all.
 *
 * The ratings are fitted to the whole round robin at once rather than updated
 * game by game. A ladder has to update as it goes because it cannot see the
 * future; a measurement can see every game, and fitting them together gets the
 * same answer without depending on what order they happened to be played in.
 *
 *   node test/elo.test.js [gamesPerPair] [format] [workers]
 */

const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

const RUNGS = ['easy', 'normal', 'hard', 'champion', 'stockfish'];
const ANCHOR = 1000;        // where the ladder starts, so the numbers are comparable
const SCALE = 400;          // Elo's scale factor
const CHUNK = 4;            // games per child, small enough to keep every core busy

// --------------------------------------------------------------- child mode
// One child plays a handful of games between two rungs and prints the score.
// Battles are entirely CPU-bound, so the only way to use the machine is to run
// several of them in separate processes.
if (process.argv[2] === '--play') {
	const [, , , A, B, gamesArg, format] = process.argv;
	const games = +gamesArg;

	const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
	const { BattleAI } = require('../src/ai');
	const { BattleState } = require('../src/battle');
	const { TeamBuilder } = require('../src/teambuilder');

	const playGame = async (builder, aIsP1) => {
		const stream = new BattleStream();
		const streams = getPlayerStreams(stream);
		const bots = {
			p1: new BattleAI({ difficulty: aIsP1 ? A : B }),
			p2: new BattleAI({ difficulty: aIsP1 ? B : A }),
		};
		for (const bot of Object.values(bots)) bot.setFormat(format);
		const team = () => (builder.needsTeam(format) ? builder.build(format) : null);
		void streams.omniscient.write(
			`>start ${JSON.stringify({ formatid: format })}\n` +
			`>player p1 ${JSON.stringify({ name: 'P1', team: team() })}\n` +
			`>player p2 ${JSON.stringify({ name: 'P2', team: team() })}\n`
		);

		const run = async (who) => {
			const state = new BattleState('elo');
			state.myPlayer = who;
			for await (const chunk of streams[who]) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|')) continue;
					const parts = line.slice(1).split('|');
					if (parts[0] === 'request') {
						const raw = parts.slice(1).join('|');
						if (!raw) continue;
						const choice = bots[who].decide(JSON.parse(raw), state);
						if (choice) void streams[who].write(choice);
						continue;
					}
					state.line(parts);
				}
			}
		};

		let winner = null;
		const watch = (async () => {
			for await (const chunk of streams.omniscient) {
				for (const line of chunk.split('\n')) {
					if (line.startsWith('|win|')) winner = line.slice(5).trim();
					if (line.startsWith('|tie')) winner = 'tie';
				}
			}
		})();

		await Promise.all([run('p1'), run('p2'), watch]);
		if (winner === 'tie') return 0.5;
		return winner === (aIsP1 ? 'P1' : 'P2') ? 1 : 0;
	};

	(async () => {
		const builder = new TeamBuilder();
		try { await builder.prefetch(format); } catch (e) { /* offline is fine */ }
		let score = 0, played = 0;
		for (let i = 0; i < games; i++) {
			// Alternate sides: moving first is worth something, and neither rung
			// should collect that advantage more often than the other.
			try { score += await playGame(builder, i % 2 === 0); played++; } catch (e) { /* skip */ }
		}
		process.stdout.write(`\n${JSON.stringify({ score, played })}\n`);
	})();
	return;
}

// -------------------------------------------------------------- parent mode
const GAMES = +(process.argv[2] || 40);
const FORMAT = process.argv[3] || 'gen9randombattle';
const WORKERS = +(process.argv[4] || Math.max(1, os.cpus().length - 1));

// Fitting the whole round robin at once, rather than updating game by game, so
// the answer does not depend on the order the games came in. Shared with the
// marathon in test/marathon.js.
const { fitRatings } = require('../src/elo');

(async () => {
	const pairs = [];
	for (let i = 0; i < RUNGS.length; i++) {
		for (let j = i + 1; j < RUNGS.length; j++) pairs.push([RUNGS[i], RUNGS[j]]);
	}

	const jobs = [];
	for (const [a, b] of pairs) {
		for (let left = GAMES; left > 0; left -= CHUNK) jobs.push({ a, b, games: Math.min(CHUNK, left) });
	}

	const totals = new Map(pairs.map(([a, b]) => [`${a}|${b}`, { a, b, score: 0, played: 0 }]));
	console.log(`round robin on ${FORMAT}: ${pairs.length} pairs x ${GAMES} games, ${WORKERS} at a time\n`);

	let next = 0, finished = 0;
	const runNext = () => new Promise(resolve => {
		const step = () => {
			if (next >= jobs.length) return resolve();
			const job = jobs[next++];
			execFile(process.execPath,
				[__filename, '--play', job.a, job.b, String(job.games), FORMAT],
				{ maxBuffer: 1 << 26 },
				(err, stdout) => {
					if (!err) {
						try {
							const r = JSON.parse(stdout.trim().split('\n').pop());
							const t = totals.get(`${job.a}|${job.b}`);
							t.score += r.score;
							t.played += r.played;
						} catch (e) { /* a lost chunk is not worth failing over */ }
					}
					finished++;
					process.stderr.write(`\r  ${finished}/${jobs.length} chunks`);
					step();
				});
		};
		step();
	});
	await Promise.all(Array.from({ length: WORKERS }, runNext));
	process.stderr.write('\r' + ' '.repeat(30) + '\r');

	for (const [a, b] of pairs) {
		const t = totals.get(`${a}|${b}`);
		const pct = t.played ? (t.score / t.played * 100).toFixed(0) : '--';
		console.log(`${a.padEnd(10)} vs ${b.padEnd(10)} ${String(pct).padStart(3)}%  (${t.played} games)`);
	}

	const results = [...totals.values()];
	const rating = fitRatings(results, RUNGS);

	console.log('\nrating:');
	for (const r of RUNGS.slice().sort((x, y) => rating[y] - rating[x])) {
		console.log(`  ${r.padEnd(10)} ${String(Math.round(rating[r])).padStart(5)}`);
	}

	// The ladder is only worth having if the rungs come out in the order they are
	// offered in. Stockfish is left out of the check on purpose: it trains, so
	// where it lands is a result rather than a promise.
	const promised = ['easy', 'normal', 'hard', 'champion'];
	const gaps = [];
	let ordered = true;
	for (let i = 0; i < promised.length - 1; i++) {
		const gap = rating[promised[i + 1]] - rating[promised[i]];
		gaps.push(`${promised[i]}->${promised[i + 1]} ${gap > 0 ? '+' : ''}${Math.round(gap)}`);
		if (gap <= 0) ordered = false;
	}
	const spread = Math.round(Math.max(...RUNGS.map(r => rating[r])) - Math.min(...RUNGS.map(r => rating[r])));
	console.log(`\ngaps: ${gaps.join(', ')}`);
	console.log(`spread: ${spread} points`);
	console.log(ordered
		? 'PASS - each rung outrates the one below, so beating a harder one is worth more'
		: 'FAIL - the rungs are out of order, so their ratings would not mean anything');
	process.exit(ordered ? 0 : 1);
})();
