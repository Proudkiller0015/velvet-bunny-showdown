'use strict';
/**
 * One game between two drafted teams, both sides played by the AI, in this process.
 *
 * The same loop as test/vs-team.js and test/marathon.js: a BattleStream, two
 * player streams, a BattleAI and a BattleState per side. Nothing here touches
 * the server - no src/index.js, no config setup, no sockets - which is what
 * lets it run on a shared machine next to the live bot.
 *
 * Three guards, because a tier run is thousands of unattended games and one
 * stuck game would otherwise hold a worker forever:
 *
 *   - a turn cap (default 300): past it the game is a tie. The Endless Battle
 *     Clause only steps in at 1000 turns, and a 300-turn stall war between two
 *     bots is not evidence about either team.
 *   - an error cap: the AI's choice refused this many times in one game
 *     (Showdown answers |error| and asks again) and the game is abandoned as
 *     a crash, so an AI bug cannot spin a worker at 100% CPU.
 *   - a wall-clock cap per game, for anything the other two miss.
 *
 * Only the numbers leave: the log is read by src/tier-sim/credit.js and then
 * dropped. No replays are written.
 */

const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const { BattleAI } = require('../ai');
const { BattleState } = require('../battle');
const { creditLog } = require('./credit');
const { registerFormat } = require('./format');

async function playGame(setsA, setsB, { difficulty = 'stockfish', maxTurns = 300, maxErrors = 40, maxMs = 8 * 60 * 1000, seed = null } = {}) {
	const formatid = registerFormat();
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const ai = { p1: new BattleAI({ difficulty }), p2: new BattleAI({ difficulty }) };
	// The AI's own format hooks key off the id (Random Battle presets); a built-team
	// RP id gives it the "sets are unknown" behaviour, which is the honest one here.
	for (const k of ['p1', 'p2']) ai[k].setFormat('gen9rpubers');
	const start = { formatid };
	if (seed) start.seed = seed;
	void streams.omniscient.write(
		`>start ${JSON.stringify(start)}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: Teams.pack(setsA) })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: Teams.pack(setsB) })}\n`
	);
	let errors = 0, decisions = 0, decideMs = 0, maxDecide = 0, ended = false, aborted = null;
	const began = Date.now();
	const stop = reason => {
		if (ended || aborted) return;
		aborted = reason;
		try { void streams.omniscient.write('>forcetie\n'); } catch (e) { /* already closed */ }
	};
	const timer = setTimeout(() => stop('timeout'), maxMs);

	const run = async who => {
		const state = new BattleState('tiersim');
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') {
					errors++;
					if (errors > maxErrors) stop('errors');
					continue;
				}
				if (parts[0] === 'request') {
					const raw = parts.slice(1).join('|');
					if (!raw || aborted) continue;
					let choice = null;
					const t0 = process.hrtime.bigint();
					try { choice = ai[who].decide(JSON.parse(raw), state); } catch (e) { errors++; choice = 'default'; }
					const ms = Number(process.hrtime.bigint() - t0) / 1e6;
					decisions++; decideMs += ms; if (ms > maxDecide) maxDecide = ms;
					if (choice) void streams[who].write(choice);
					continue;
				}
				state.line(parts);
			}
		}
	};
	const log = [];
	const watch = (async () => {
		for await (const chunk of streams.omniscient) {
			for (const line of chunk.split('\n')) {
				log.push(line);
				if (line.startsWith('|turn|') && Number(line.slice(6)) > maxTurns) stop('turns');
				if (line.startsWith('|win|') || line.startsWith('|tie')) ended = true;
			}
		}
	})();
	try {
		await Promise.all([run('p1'), run('p2'), watch]);
	} finally {
		clearTimeout(timer);
	}
	const credit = creditLog(log, { p1: setsA.map(s => s.name), p2: setsB.map(s => s.name) });
	return {
		winner: aborted ? (aborted === 'turns' ? 'tie' : null) : credit.winner,
		aborted,
		turns: credit.turns,
		p1: credit.p1,
		p2: credit.p2,
		errors,
		decisions,
		decideMs: Math.round(decideMs),
		maxDecideMs: Math.round(maxDecide),
		ms: Date.now() - began,
	};
}

module.exports = { playGame };
