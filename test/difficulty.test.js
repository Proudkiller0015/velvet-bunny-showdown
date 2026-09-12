'use strict';
/**
 * The difficulty ladder has to be a real ladder: each rung should beat the one
 * below it over a run of games, not just carry a different label.
 *
 *   node test/difficulty.test.js [gamesPerPair] [format]
 */

const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');

const GAMES = +(process.argv[2] || 20);
const FORMAT = process.argv[3] || 'gen9ou';

async function playGame(builder, strongFirst, strong, weak) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const bots = {
		p1: new BattleAI({ difficulty: strongFirst ? strong : weak }),
		p2: new BattleAI({ difficulty: strongFirst ? weak : strong }),
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

	let errors = 0;
	const run = async (who) => {
		const state = new BattleState('test');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { errors++; continue; }
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
	return { strongWon: winner === (strongFirst ? 'P1' : 'P2'), errors };
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }

	const pairs = [['normal', 'easy'], ['hard', 'normal'], ['champion', 'easy']];
	let allOk = true;
	for (const [strong, weak] of pairs) {
		let wins = 0, played = 0, errors = 0;
		for (let i = 0; i < GAMES; i++) {
			try {
				const r = await playGame(builder, i % 2 === 0, strong, weak);
				played++; if (r.strongWon) wins++; errors += r.errors;
			} catch (e) { /* counted as not played */ }
		}
		const rate = played ? (wins / played) * 100 : 0;
		const ok = played === GAMES && errors === 0 && rate > 50;
		if (!ok) allOk = false;
		console.log(`${strong.padEnd(9)} vs ${weak.padEnd(9)}: ${wins}/${played} (${rate.toFixed(0)}%)  errors ${errors}  ${ok ? 'ok' : 'FAIL'}`);
	}
	console.log(allOk ? '\nPASS' : '\nFAIL');
	process.exit(allOk ? 0 : 1);
})();
