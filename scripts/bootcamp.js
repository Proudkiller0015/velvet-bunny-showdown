'use strict';
/**
 * Bootcamp: two sides, each with its own AI switches and its own kind of team, played
 * against each other many times - the win rate with its error margin.
 *
 *   node scripts/bootcamp.js '<json>'
 *   {"a":{"cfg":{},"team":{"weather":"any"}},"b":{"cfg":{},"team":{}},"games":60,"format":"gen9rpou","base":"stockfish"}
 *
 * cfg   overrides on BattleAI.cfg (the switches in src/ai.js: variablePower, toxicExit, weatherPlay ...)
 * team  options for TeamBuilder.build: { weather: 'sun'|'rain'|'sand'|'snow'|'any', half: bool },
 *       { archetype: 'hyper offense'|'bulky offense'|'balance'|'stall' }, or {} for whatever the ladder gets
 *
 * Sides swap every game, and each game builds fresh teams, so a result is about the play and
 * the kind of team, not one lucky draft. 40 games is mostly noise (+/-15); 150 is +/-8.
 * (owner, 1 Oct 2026: "bootcamp the bot in weather usage", "HO/balance", "VS stall into the mix").
 */
const { BattleStream, getPlayerStreams } = require('pokemon-showdown/dist/sim/battle-stream');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');

const spec = JSON.parse(process.argv[2] || '{}');
const A = spec.a || {}, B = spec.b || {};
const GAMES = spec.games || 40;
const FORMAT = spec.format || 'gen9rpou';
const BASE = spec.base || 'stockfish';
const TURN_CAP = spec.turnCap || 300;

function make(side) {
	const ai = new BattleAI({ difficulty: BASE });
	ai.setFormat(FORMAT);
	ai.cfg = { ...ai.cfg, ...(side.cfg || {}) };
	return ai;
}

async function playGame(builder, aFirst) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const sides = { p1: aFirst ? A : B, p2: aFirst ? B : A };
	const bots = { p1: make(sides.p1), p2: make(sides.p2) };
	const seed = () => (Math.random() * 0xffffffff) >>> 0;
	const teams = { p1: builder.build(FORMAT, seed(), sides.p1.team || {}), p2: builder.build(FORMAT, seed(), sides.p2.team || {}) };
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: FORMAT })}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: teams.p1 })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: teams.p2 })}\n`
	);
	let errors = 0, turns = 0, winner = null;
	const run = async who => {
		const state = new BattleState('battle-' + FORMAT + '-1');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { errors++; void streams[who].write('default'); continue; }
				if (parts[0] === 'request') {
					const raw = parts.slice(1).join('|');
					if (!raw) continue;
					let choice = null;
					try { choice = bots[who].decide(JSON.parse(raw), state); } catch (e) { errors++; choice = 'default'; }
					if (choice) void streams[who].write(choice);
					continue;
				}
				state.line(parts);
			}
		}
	};
	const watch = (async () => {
		for await (const chunk of streams.omniscient) {
			for (const line of chunk.split('\n')) {
				if (line.startsWith('|turn|')) {
					turns = +line.slice(6);
					if (turns > TURN_CAP) { winner = 'tie'; void streams.omniscient.write('>forcetie'); }
				}
				if (line.startsWith('|win|')) winner = line.slice(5).trim();
				if (line.startsWith('|tie')) winner = 'tie';
			}
		}
	})();
	await Promise.all([run('p1'), run('p2'), watch]);
	return { aWon: winner === (aFirst ? 'P1' : 'P2'), tie: winner === 'tie', errors, turns };
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }
	let wins = 0, ties = 0, played = 0, errors = 0, turns = 0;
	const t0 = Date.now();
	for (let i = 0; i < GAMES; i++) {
		try {
			const r = await playGame(builder, i % 2 === 0);
			played++; errors += r.errors; turns += r.turns;
			if (r.tie) ties++; else if (r.aWon) wins++;
		} catch (e) { console.log('crash:', String(e.message || e).slice(0, 140)); }
	}
	const decided = played - ties;
	const rate = decided ? (wins / decided) * 100 : 0;
	const se = decided ? Math.sqrt(0.25 / decided) * 196 : 0;
	console.log(`${spec.label || ''} A=${JSON.stringify(A)} vs B=${JSON.stringify(B)} [${BASE}, ${FORMAT}]`);
	console.log(`A won ${wins}/${decided} (${rate.toFixed(0)}% +/- ${se.toFixed(0)}), ties ${ties}, errors ${errors}, avg turns ${(turns / Math.max(1, played)).toFixed(0)}, ${((Date.now() - t0) / 1000 / Math.max(1, played)).toFixed(1)}s/game`);
})();
