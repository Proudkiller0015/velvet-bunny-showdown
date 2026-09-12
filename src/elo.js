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
 * Each pass works out how many games every player should have won at its current
 * rating, and moves the rating towards whatever would have predicted what they
 * actually won. Repeat until it stops moving.
 *
 * The step is the average error per game, not the total. That distinction is the
 * whole difference between this working and not: summing the error means the step
 * grows with the number of games, so a run of a few hundred games per pairing
 * overshoots, bounces off the other side, and settles somewhere with no relation
 * to the results. It put the third-best bot top of a seven-thousand-game table
 * while the head-to-head numbers on the same page said otherwise. Dividing by the
 * games played bounds every step, so more games make the answer better rather
 * than worse.
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
function fitRatings(results, players, { anchor = ANCHOR, scale = SCALE, steps = 3000, rate = 0.6 } = {}) {
	const names = players && players.length
		? players.slice()
		: [...new Set(results.flatMap(r => [r.a, r.b]))];
	const rating = {};
	for (const name of names) rating[name] = anchor;
	if (names.length < 2) return rating;

	const usable = results.filter(r => r.played > 0 && rating[r.a] !== undefined && rating[r.b] !== undefined);
	if (!usable.length) return rating;

	for (let step = 0; step < steps; step++) {
		const actual = {}, expected = {}, games = {};
		for (const name of names) { actual[name] = 0; expected[name] = 0; games[name] = 0; }

		for (const { a, b, score, played } of usable) {
			const eA = played * expectedScore(rating[a], rating[b], scale);
			actual[a] += score;
			expected[a] += eA;
			games[a] += played;
			actual[b] += played - score;
			expected[b] += played - eA;
			games[b] += played;
		}

		let moved = 0;
		for (const name of names) {
			if (!games[name]) continue;
			// Average error per game, so the step cannot grow with the sample.
			const delta = rate * scale * (actual[name] - expected[name]) / games[name];
			rating[name] += delta;
			moved = Math.max(moved, Math.abs(delta));
		}

		// Only differences mean anything, so pin the average where the ladder starts.
		const mean = names.reduce((sum, name) => sum + rating[name], 0) / names.length;
		for (const name of names) rating[name] += anchor - mean;

		if (moved < 1e-4) break;
	}
	return rating;
}

/** The share of games the stronger of two ratings should expect to win. */
function expectedScore(ratingA, ratingB, scale = SCALE) {
	return 1 / (1 + Math.pow(10, (ratingB - ratingA) / scale));
}

module.exports = { fitRatings, expectedScore, SCALE, ANCHOR };
