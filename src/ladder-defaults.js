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

/*
 * How often a bot's team is dedicated stall, per format (24 Sep 2026).
 *
 * The owner: "I want the ladder, including the RP tier, to build dedicated
 * stall sometimes... since it goes against usage." Sometimes: about one team
 * in eight, 13% - enough that a regular meets it every few games and has to
 * know how to beat it, not so much that the ladder stops looking like the
 * format. The rungs have no personalities (one account per difficulty, a new
 * team built for every search - src/ladder.js), so this is a per-team draw
 * and no bot is locked into stall.
 *
 * A format missing here takes `default`. PS_STALL_SHARE overrides without a
 * deploy: "0.2" for every format, or "gen9rpou=0.2,gen9ou=0.1,default=0.13";
 * 0 turns stall off.
 */
const STALL_SHARE = { default: 0.13 };

function stallShare(format) {
	const id = toId(format);
	const table = { ...STALL_SHARE };
	for (const part of split(process.env.PS_STALL_SHARE)) {
		const [key, value] = part.includes('=') ? part.split('=') : ['default', part];
		const n = Number(value);
		if (Number.isFinite(n)) table[toId(key) || 'default'] = Math.max(0, Math.min(1, n));
	}
	return table[id] !== undefined ? table[id] : table.default;
}

module.exports = { RUNGS, DEFAULT_FORMATS, DEFAULT_DIFFICULTIES, ladderQueues, STALL_SHARE, stallShare };
