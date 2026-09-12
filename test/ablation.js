'use strict';
/**
 * Ablation harness: play two configurations of the AI against each other so a
 * feature can be judged on results rather than on how sensible it looks.
 *
 *   node test/ablation.js '{"switching":false}' '{"switching":true}' 60 gen9ou
 */

const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');

const A = JSON.parse(process.argv[2] || '{}');
const B = JSON.parse(process.argv[3] || '{}');
const GAMES = +(process.argv[4] || 40);
const FORMAT = process.argv[5] || 'gen9ou';
const BASE = process.argv[6] || 'champion';

function make(overrides) {
	const ai = new BattleAI({ difficulty: BASE });
	ai.cfg = { ...ai.cfg, ...overrides };
	return ai;
}

async function playGame(builder, aFirst) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const bots = { p1: make(aFirst ? A : B), p2: make(aFirst ? B : A) };
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
	return { aWon: winner === (aFirst ? 'P1' : 'P2'), errors };
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }
	let wins = 0, played = 0, errors = 0;
	for (let i = 0; i < GAMES; i++) {
		try { const r = await playGame(builder, i % 2 === 0); played++; if (r.aWon) wins++; errors += r.errors; }
		catch (e) { console.log('crash:', String(e.message || e).slice(0, 120)); }
	}
	const rate = played ? (wins / played) * 100 : 0;
	// Rough 95% interval for a proportion, to keep us honest about small samples.
	const se = played ? Math.sqrt(0.25 / played) * 196 : 0;
	console.log(`A=${JSON.stringify(A)} vs B=${JSON.stringify(B)} [${BASE}, ${FORMAT}]`);
	console.log(`A won ${wins}/${played} (${rate.toFixed(0)}% +/- ${se.toFixed(0)}), errors ${errors}`);
})();
