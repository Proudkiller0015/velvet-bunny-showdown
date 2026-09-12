'use strict';
/**
 * Train the search weights by self-play, on a real machine.
 *
 * The server has 512MB and a disk wiped on every restart, so it is the wrong
 * place to learn anything. This runs locally, plays candidate weightings against
 * the current champion, keeps what actually wins, and writes data/brain.json.
 * Committing and deploying that file is what makes the hosted bot stronger.
 *
 * The method is a simple hill climb with a shrinking step: perturb every weight,
 * play a match, keep the perturbation only if it beats the incumbent by more
 * than noise. Nothing clever - but every generation is *measured*, so the file
 * it writes is never worse than the weights it started from.
 *
 *   node test/train.js --games 60 --generations 8 --format gen9ou
 */

const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { TeamBuilder } = require('../src/teambuilder');
const { DEFAULT_WEIGHTS } = require('../src/search');
const { loadBrain, saveBrain } = require('../src/brain');

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? fallback : process.argv[i + 1];
}
const GAMES = +arg('games', 40);
const GENERATIONS = +arg('generations', 6);
const FORMAT = arg('format', 'gen9ou');
const OPPONENT = arg('opponent', 'champion');

/** Play one game. `a` and `b` are {difficulty, weights}. Returns true if a won. */
async function playGame(builder, a, b, aIsP1) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const make = side => new BattleAI({
		difficulty: side.difficulty,
		brain: { weights: side.weights, trained: true, games: 0, generation: 0 },
	});
	const bots = { p1: make(aIsP1 ? a : b), p2: make(aIsP1 ? b : a) };

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
		const state = new BattleState('train');
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
	return { aWon: winner === (aIsP1 ? 'P1' : 'P2'), errors };
}

/** Win rate of `a` against `b`, sides swapped every game. */
async function match(builder, a, b, games) {
	let wins = 0, played = 0, errors = 0;
	for (let i = 0; i < games; i++) {
		try {
			const r = await playGame(builder, a, b, i % 2 === 0);
			played++; if (r.aWon) wins++; errors += r.errors;
		} catch (e) { /* a crashed game is not evidence either way */ }
	}
	return { rate: played ? (wins / played) * 100 : 0, played, errors };
}

function perturb(weights, scale, rng) {
	const out = { ...weights };
	for (const k of Object.keys(out)) {
		if (typeof out[k] !== 'number') continue;
		const span = Math.abs(out[k]) || 1;
		out[k] = out[k] + (rng() * 2 - 1) * span * scale;
	}
	// Pessimism is a probability-ish blend; keep it in range.
	if (out.pessimism !== undefined) out.pessimism = Math.max(0, Math.min(1, out.pessimism));
	return out;
}

(async () => {
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }

	const brain = loadBrain();
	let incumbent = { ...DEFAULT_WEIGHTS, ...(brain.weights || {}) };
	let generation = brain.generation || 0;
	let totalGames = brain.games || 0;

	console.log(`training on ${FORMAT}: ${GENERATIONS} generations x ${GAMES} games vs ${OPPONENT}`);
	console.log(brain.trained ? `starting from generation ${generation}` : 'starting from the default weights');

	// Where we stand before changing anything.
	const baseline = await match(builder,
		{ difficulty: 'stockfish', weights: incumbent },
		{ difficulty: OPPONENT, weights: null }, GAMES);
	totalGames += baseline.played;
	console.log(`\ngeneration ${generation} (incumbent): ${baseline.rate.toFixed(0)}% vs ${OPPONENT}` +
		(baseline.errors ? `  [${baseline.errors} protocol errors]` : ''));
	let bestRate = baseline.rate;

	let scale = 0.35;
	let seed = 12345;
	const rng = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 0x100000000; };

	for (let g = 1; g <= GENERATIONS; g++) {
		const candidate = perturb(incumbent, scale, rng);
		const result = await match(builder,
			{ difficulty: 'stockfish', weights: candidate },
			{ difficulty: OPPONENT, weights: null }, GAMES);
		totalGames += result.played;

		// Only accept a clear win: at this sample size anything inside the noise
		// band is a coin flip, and accepting it would drift the weights randomly.
		const noiseBand = Math.sqrt(0.25 / Math.max(1, result.played)) * 196;
		const better = result.rate > bestRate + noiseBand / 2;
		console.log(`generation ${g}: ${result.rate.toFixed(0)}% (incumbent ${bestRate.toFixed(0)}%, ` +
			`needs +${(noiseBand / 2).toFixed(0)}) -> ${better ? 'ACCEPTED' : 'rejected'}`);
		if (better) {
			incumbent = candidate;
			bestRate = result.rate;
			generation++;
		} else {
			scale *= 0.8;   // settle down as we stop finding improvements
		}
	}

	const saved = saveBrain({
		weights: incumbent,
		trained: true,
		games: totalGames,
		generation,
		winRateVsBaseline: bestRate,
		trainedOn: FORMAT,
		baselineOpponent: OPPONENT,
	});
	console.log(`\nwrote data/brain.json - generation ${saved.generation}, ${saved.games} games, ${bestRate.toFixed(0)}% vs ${OPPONENT}`);
	console.log('commit it and deploy to put it on the server.');
})();
