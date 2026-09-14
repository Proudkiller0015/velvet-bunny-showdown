'use strict';
/**
 * What the bot ladder runs, by default.
 *
 * Separated from src/ladder.js so that anything needing only the names can have
 * them without dragging in the dex, the damage calculator and a websocket
 * client. scripts/setup-config.js is the case that matters: it has to grant the
 * bot's avatar to every queue account, and it runs before the server starts.
 *
 * Keeping one copy is not tidiness. When setup-config worked the names out for
 * itself it went on granting the avatar to "Velvet Bunny Easy" long after the
 * queues had been renamed to fit Showdown's eighteen-character user id limit, so
 * four accounts that did not exist held the rights and every queue that did was
 * refused its own face. Five different files were doing the same "read the
 * environment, split on commas, cross the two lists" dance; `ladderQueues()` is
 * that dance, once, and everything else asks it.
 */

const { queueName, toId } = require('./queue-names');

/**
 * Every format the bots queue, and which rungs each one runs.
 *
 * Rungs are per format because a queue is an account and a socket, and the
 * ceiling on this host is memory. The two Random Battles carry the full ladder;
 * the team formats carry the middle of it, which is who most people want to
 * play anyway - nobody is learning a tier against Easy, and Stockfish spends the
 * most time thinking for the least difference.
 *
 * Random Battle stays first, which is load-bearing: the first format's queues
 * keep their plain account names, so the ratings those five have been building
 * since the start survive another format being added.
 *
 * The RP tiers are here because they are what this server is *for*, and a tier
 * nobody is queuing for is a tier nobody can play - pressing Battle! in RP OU
 * simply waited. They cost more than the Random Battles do: the bot has to build
 * a legal team for each, which it can (it is legal in all 283 formats), rather
 * than being handed one by the server.
 */
const LADDER = [
	{ format: 'gen9randombattle', rungs: ['easy', 'normal', 'hard', 'champion', 'stockfish'] },
	{ format: 'gen9rprandombattle', rungs: ['easy', 'normal', 'hard', 'champion', 'stockfish'] },
	{ format: 'gen9rpbattle', rungs: ['normal', 'hard', 'champion'] },
	{ format: 'gen9rpou', rungs: ['normal', 'hard'] },
];

/** The formats, in order. Kept for anything that only wants the names. */
const DEFAULT_FORMATS = LADDER.map(entry => entry.format);

/** Every rung that appears anywhere, which is the full ladder. */
const DEFAULT_DIFFICULTIES = [...new Set(LADDER.flatMap(entry => entry.rungs))];

const split = text => String(text || '').split(',').map(part => part.trim()).filter(part => part);

/**
 * Every queue that should exist: one entry per account.
 *
 * `PS_LADDER_FORMATS` and `PS_LADDER_DIFFICULTIES` still work and still mean
 * what they meant - a plain list, crossed with each other - because that is
 * what anybody setting them expects. They are the override; the table above is
 * the default.
 */
function ladderQueues(base) {
	const chosenFormats = split(process.env.PS_LADDER_FORMATS);
	const chosenRungs = split(process.env.PS_LADDER_DIFFICULTIES);

	let spec;
	if (chosenFormats.length) {
		const rungs = chosenRungs.length ? chosenRungs : DEFAULT_DIFFICULTIES;
		spec = chosenFormats.map(format => ({ format, rungs }));
	} else {
		spec = LADDER.map(entry => ({
			format: entry.format,
			rungs: chosenRungs.length ? chosenRungs : entry.rungs,
		}));
	}

	const multiFormat = spec.length > 1;
	const queues = [];
	spec.forEach((entry, index) => {
		// The first format keeps the plain names; see queueName.
		const tagging = multiFormat && { primary: index === 0 };
		for (const difficulty of entry.rungs) {
			const name = queueName(base || process.env.PS_BOT_NAME || 'Velvet Bunny', difficulty, entry.format, tagging);
			queues.push({ format: entry.format, difficulty, name, id: toId(name) });
		}
	});
	return queues;
}

module.exports = { LADDER, DEFAULT_FORMATS, DEFAULT_DIFFICULTIES, ladderQueues };
