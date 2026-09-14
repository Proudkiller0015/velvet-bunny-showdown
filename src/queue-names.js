'use strict';
/**
 * What each rung of the bot ladder is called.
 *
 * This lives on its own because two very different things need to agree on it:
 * the queues themselves (src/ladder.js) and the server's matchmaking rules
 * (config/showdown-config.js), which has to know which accounts are bots so it
 * can stop them playing each other. When those two disagreed, the rules simply
 * did not apply to anyone.
 *
 * The names have to be short. Showdown refuses any account whose userid is over
 * eighteen characters, and it refuses it silently as far as the client is
 * concerned - the connection is fine, the login just never completes. "Velvet
 * Bunny Champion" is nineteen, so Champion never appeared on the ladder at all
 * and nobody could work out why there were only three bots.
 */

// users.js: `if (userid.length > 18)`.
const MAX_USERID = 18;

const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A short name for a format, to hang on the end of a queue's name.
 *
 * Short because the whole name has to survive the eighteen-character limit, and
 * a name is trimmed from the right when it does not - which spells "Bunny
 * Champion rpbat", and reads as a bug. Two or three characters leaves room for
 * the longest rung.
 */
const TAGS = {
	randombattle: 'RB',
	randomdoublesbattle: 'RDB',
	rprandombattle: 'rpRB',
	rpbattle: 'RP',
};

function tagFor(format) {
	const rest = String(format || '').replace(/^gen\d+/, '');
	if (TAGS[rest]) return TAGS[rest];
	// A tier of our own: keep the rp, shout the tier. rpou -> rpOU, rpubers ->
	// rpUbers, which is as much as fits.
	const tier = rest.startsWith('rp') ? rest.slice(2) : rest;
	const shouted = tier.length <= 3 ? tier.toUpperCase() : tier.charAt(0).toUpperCase() + tier.slice(1);
	return (rest.startsWith('rp') ? 'rp' : '') + shouted;
}

/**
 * The display name for one queue.
 *
 * Deliberately not the bot's full name plus the difficulty: that is too long for
 * the longest rungs, and a name that is silently rejected is far worse than a
 * shorter one.
 */
function queueName(base, difficulty, format, multiFormat) {
	const short = String(base || 'Velvet Bunny').trim().split(/\s+/).pop();   // "Velvet Bunny" -> "Bunny"
	const pretty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
	let name = `${short} ${pretty}`;
	if (multiFormat) {
		// The first format keeps the plain name. A queue's rating belongs to its
		// account, so tagging every format the moment a second one is added would
		// rename the four accounts that have been laddering since the start and
		// hand each of them a fresh, empty rating. Adding a format should cost
		// nothing to the formats already running.
		const tag = tagFor(format);
		if (tag && !multiFormat.primary) name = `${name} ${tag}`;
	}
	// Trim the difficulty rather than the name, so it still reads as the bot.
	while (toId(name).length > MAX_USERID) name = name.slice(0, -1).trim();
	return name;
}

/**
 * Every account the bot plays under: the main one, and one per queue.
 *
 * Given the queues rather than two lists to cross, because the crossing is not
 * uniform any more - a format can run three rungs where another runs five - and
 * because doing it here as well was how these two ever came to disagree with
 * the ladder in the first place. src/ladder-defaults.js owns the list.
 */
function botAccountIds(base, queues) {
	const ids = new Set([toId(base)]);
	for (const queue of queues) ids.add(queue.id || toId(queue.name));
	return ids;
}

/** Which rung each bot account plays as: userid -> difficulty. */
function botDifficulties(base, queues) {
	const map = new Map();
	for (const queue of queues) map.set(queue.id || toId(queue.name), queue.difficulty);
	return map;
}

module.exports = { queueName, botAccountIds, botDifficulties, tagFor, toId, MAX_USERID };
