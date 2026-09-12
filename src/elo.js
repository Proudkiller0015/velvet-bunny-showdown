'use strict';
/**
 * Fit an Elo rating to every player from a set of results.
 *
 * A ladder updates game by game because it cannot see the future. A measurement
 * can see every game at once, and fitting them together gets the same answer
 * without depending on the order they happened to be played in - which matters,
 * because with a handful of bots trading wins the order alone can move a rung by
 * a hundred points.
 *
 * This is straight maximum likelihood on the logistic model Elo is defined by:
 * nudge every rating towards whatever would have predicted the results, and
 * repeat until it stops moving.
 */

const SCALE = 400;     // Elo's scale factor: 400 points is ten-to-one odds
const ANCHOR = 1000;   // where the ladder starts everyone, so the numbers compare

/**
 * @param {{a: string, b: string, score: number, played: number}[]} results
 *        `score` is a's total, counting a win as 1 and a tie as 0.5.
 * @param {string[]} [players] everyone who should get a rating, including anyone
 *        who happened not to play; defaults to whoever appears in the results.
 * @returns {Record<string, number>}
 */
function fitRatings(results, players, { anchor = ANCHOR, scale = SCALE, steps = 4000 } = {}) {
	const names = players && players.length
		? players.slice()
		: [...new Set(results.flatMap(r => [r.a, r.b]))];
	const rating = {};
	for (const name of names) rating[name] = anchor;
	if (names.length < 2) return rating;

	for (let step = 0; step < steps; step++) {
		const grad = {};
		for (const name of names) grad[name] = 0;
		for (const { a, b, score, played } of results) {
			if (!played || rating[a] === undefined || rating[b] === undefined) continue;
			const expected = 1 / (1 + Math.pow(10, (rating[b] - rating[a]) / scale));
			const err = score - expected * played;
			grad[a] += err;
			grad[b] -= err;
		}
		for (const name of names) rating[name] += grad[name] * 0.5;
		// Only differences mean anything, so pin the average where the ladder starts.
		const mean = names.reduce((sum, name) => sum + rating[name], 0) / names.length;
		for (const name of names) rating[name] += anchor - mean;
	}
	return rating;
}

/** The share of games the stronger of two ratings should expect to win. */
function expectedScore(ratingA, ratingB, scale = SCALE) {
	return 1 / (1 + Math.pow(10, (ratingB - ratingA) / scale));
}

module.exports = { fitRatings, expectedScore, SCALE, ANCHOR };
