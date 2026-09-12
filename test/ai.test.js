'use strict';
/**
 * Play the AI against a random-legal-choice baseline in the real simulator.
 * "OK plays" is not a code property, so it is measured: a competent player
 * should beat random decisively and finish games without protocol errors.
 *
 *   node test/ai.test.js [games] [format]
 */

const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');

const GAMES = +(process.argv[2] || 20);
const FORMAT = process.argv[3] || 'gen9ou';

/** Pick a uniformly random legal choice from a request - the baseline. */
function randomChoice(request) {
	if (request.wait) return null;
	if (request.teamPreview) return 'default';
	if (request.forceSwitch) {
		const options = request.side.pokemon
			.map((p, i) => ({ p, i: i + 1 }))
			.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
		return options.length ? `switch ${options[Math.floor(Math.random() * options.length)].i}` : 'default';
	}
	if (request.active) {
		return request.active.map((active, index) => {
			const entry = request.side.pokemon[index];
			if (!entry || /fnt/.test(entry.condition)) return 'pass';
			const moves = (active.moves || []).map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => !m.disabled);
			if (!moves.length) return 'move 1';
			return `move ${moves[Math.floor(Math.random() * moves.length)].n}`;
		}).join(', ');
	}
	return 'default';
}

async function playGame(builder, aiIsP1) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const ai = new BattleAI();

	const spec = { formatid: FORMAT };
	const teams = {
		p1: builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null,
		p2: builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null,
	};
	void streams.omniscient.write(
		`>start ${JSON.stringify(spec)}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: teams.p1 })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: teams.p2 })}\n`
	);

	let errors = 0;
	const run = async (who) => {
		const state = new BattleState('test');
		state.myPlayer = who;
		const usingAI = (who === 'p1') === aiIsP1;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { errors++; continue; }
				if (parts[0] === 'request') {
					const raw = parts.slice(1).join('|');
					if (!raw) continue;
					const request = JSON.parse(raw);
					const choice = usingAI ? ai.decide(request, state) : randomChoice(request);
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
	const aiName = aiIsP1 ? 'P1' : 'P2';
	return { won: winner === aiName, tie: winner === 'tie', winner, errors };
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }

	let wins = 0, ties = 0, errors = 0, played = 0;
	for (let i = 0; i < GAMES; i++) {
		try {
			const r = await playGame(builder, i % 2 === 0);
			played++;
			if (r.won) wins++;
			if (r.tie) ties++;
			errors += r.errors;
		} catch (e) {
			console.log('game crashed:', String(e.message || e).slice(0, 160));
		}
	}
	const rate = played ? (wins / played) * 100 : 0;
	console.log(`\n${FORMAT}: AI won ${wins}/${played} (${rate.toFixed(0)}%), ${ties} ties, ${errors} protocol errors`);
	// A competent player should be well clear of the 50% coin flip, and must
	// never produce an illegal choice.
	const ok = played === GAMES && errors === 0 && rate >= 70;
	console.log(ok ? 'PASS' : 'FAIL');
	process.exit(ok ? 0 : 1);
})();
