'use strict';
/**
 * Who plays on the ladder.
 *
 * Separated from src/ladder.js so that anything needing only the names can have
 * them without dragging in the dex, the damage calculator and a websocket
 * client. scripts/setup-config.js is the case that matters: it has to grant the
 * bot's avatar to every rung's account, and it runs before the server starts.
 *
 * One account per rung, for every format.
 *
 * It used to be one account per rung *per format*: fifteen accounts sitting in
 * four queues all day, and every other tier - OU, UU, the lot - with nobody in it
 * at all, so Battle! there simply waited forever. A Showdown account can search
 * several formats at once and play several battles at once, and its rating is
 * kept per format anyway, so there was never any need for more than one account
 * per rung. Nothing queues until somebody does: the server rings the rung that
 * player wants (see summonBots in config/showdown-config.js), that rung builds a
 * team for the format and searches, and it leaves the queue again when nobody is
 * waiting.
 */

const { queueName, toId } = require('./queue-names');

/** The rungs, easiest first. Each is one account. */
const RUNGS = ['easy', 'normal', 'hard', 'champion', 'stockfish'];

/**
 * The formats whose ratings are seeded at the measured strength of each rung
 * (src/ladder-seed.js). Any other format works just the same; its first game
 * starts from Showdown's default rating, and the plateau still applies.
 */
const DEFAULT_FORMATS = ['gen9randombattle', 'gen9rprandombattle', 'gen9rpbattle', 'gen9rpou'];

const DEFAULT_DIFFICULTIES = RUNGS.slice();

const split = text => String(text || '').split(',').map(part => part.trim()).filter(part => part);

/**
 * Every rung account that should exist.
 *
 * `PS_LADDER_DIFFICULTIES` still narrows the rungs. `format` is null: a rung plays
 * whatever it is rung for.
 */
function ladderQueues(base) {
	const chosen = split(process.env.PS_LADDER_DIFFICULTIES);
	const rungs = chosen.length ? chosen : RUNGS;
	return rungs.map(difficulty => {
		const name = queueName(base || process.env.PS_BOT_NAME || 'Velvet Bunny', difficulty, null, false);
		return { format: null, difficulty, name, id: toId(name) };
	});
}

module.exports = { RUNGS, DEFAULT_FORMATS, DEFAULT_DIFFICULTIES, ladderQueues };
