'use strict';
/**
 * Rate the difficulties against each other on a real Elo scale.
 *
 * Each rung has its own ladder account on the server, so its rating is only
 * meaningful if the rungs genuinely differ in strength. This plays a round robin
 * in the simulator and turns the results into Elo, which is the same arithmetic
 * the server's ladder uses - so it says what a player should expect to gain for
 * beating each one, and whether the ladder is worth anything at all.
 *
 *   node test/elo.test.js [gamesPerPair] [format]
 */

const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');

const GAMES = +(process.argv[2] || 20);
const FORMAT = process.argv[3] || 'gen9randombattle';
const RUNGS = ['easy', 'normal', 'hard', 'champion', 'stockfish'];
const START = 1000;
const K = 32;

async function playGame(builder, a, b, aIsP1) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const bots = {
		p1: new BattleAI({ difficulty: aIsP1 ? a : b }),
		p2: new BattleAI({ difficulty: aIsP1 ? b : a }),
	};
	const teams = {
		p1: builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null,
		p2: builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null,
	};
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: FORMAT })}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: teams.p1 })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: teams.p2 })}\n`
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
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }

	const elo = {};
	const record = {};
	for (const r of RUNGS) { elo[r] = START; record[r] = { w: 0, l: 0, d: 0 }; }

	const pairs = [];
	for (let i = 0; i < RUNGS.length; i++) {
		for (let j = i + 1; j < RUNGS.length; j++) pairs.push([RUNGS[i], RUNGS[j]]);
	}

	console.log(`round robin on ${FORMAT}: ${pairs.length} pairs x ${GAMES} games\n`);
	for (const [a, b] of pairs) {
		let scoreA = 0;
		for (let i = 0; i < GAMES; i++) {
			let s;
			try { s = await playGame(builder, a, b, i % 2 === 0); } catch (e) { continue; }
			scoreA += s;
			if (s === 1) { record[a].w++; record[b].l++; } else if (s === 0) { record[a].l++; record[b].w++; } else { record[a].d++; record[b].d++; }
			// Update after every game, the way a ladder does.
			const expA = 1 / (1 + Math.pow(10, (elo[b] - elo[a]) / 400));
			elo[a] += K * (s - expA);
			elo[b] += K * ((1 - s) - (1 - expA));
		}
		console.log(`${a.padEnd(10)} vs ${b.padEnd(10)} ${(scoreA / GAMES * 100).toFixed(0)}%`);
	}

	console.log('\nrating after the round robin:');
	const sorted = RUNGS.slice().sort((x, y) => elo[y] - elo[x]);
	for (const r of sorted) {
		const { w, l, d } = record[r];
		console.log(`  ${r.padEnd(10)} ${Math.round(elo[r])}   ${w}W ${l}L ${d}D`);
	}

	// The ladder is only worth having if the rungs are actually ordered.
	const order = ['easy', 'normal', 'hard'];
	let monotonic = true;
	for (let i = 0; i < order.length - 1; i++) {
		if (elo[order[i]] >= elo[order[i + 1]]) monotonic = false;
	}
	const spread = Math.round(Math.max(...RUNGS.map(r => elo[r])) - Math.min(...RUNGS.map(r => elo[r])));
	console.log(`\nspread: ${spread} points`);
	console.log(monotonic ? 'PASS - easy < normal < hard, so beating a harder one is worth more'
		: 'FAIL - the rungs are not ordered, so their ratings would not mean anything');
	process.exit(monotonic ? 0 : 1);
})();
