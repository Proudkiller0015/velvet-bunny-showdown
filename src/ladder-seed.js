'use strict';
/**
 * Start each rung of the bot ladder at the rating it earned in testing.
 *
 * Everything used to start at 1000 and climb from there, on the theory that the
 * rungs would separate on their own because they meet each other in the queue.
 * They did meet each other - constantly, five games in six - and with four
 * near-identical accounts trading wins the ratings did not separate, they random
 * walked. The server no longer lets bots play each other at all, which fixes the
 * churn but leaves the ratings with nothing to move them except players.
 *
 * So they are seeded from the round robin in test/elo.test.js, which is a real
 * measurement over more than a thousand games rather than a guess. That means a
 * player is matched against a rung near their own strength from the first search,
 * and beating Champion is worth more than beating Easy immediately, instead of
 * after however many games it would take the ladder to work it out.
 *
 * Only missing rows are added. A rating a bot has actually earned against people
 * is worth more than the one it was measured at, and is never overwritten.
 */

const fs = require('fs');
const path = require('path');

// From `node test/elo.test.js 150 gen9randombattle`: 10 pairings, 150 games each.
// Re-run it and update these together if the difficulties change.
const MEASURED = {
	easy: 792,
	normal: 973,
	hard: 1053,
	champion: 1082,
	stockfish: 1101,
};

const HEADER = 'Elo\tUsername\tW\tL\tT\tLast update';

/**
 * @param {string} dir       the package's config/ladders directory
 * @param {string} format    formatid, which is also the file name
 * @param {{name: string, difficulty: string}[]} queues
 * @param {(msg: string) => void} [log]
 */
function seedLadder(dir, format, queues, log = () => {}) {
	const file = path.join(dir, `${format}.tsv`);
	let rows = [];
	try {
		const data = fs.readFileSync(file, 'utf8');
		rows = data.split('\n').slice(1)              // drop the header
			.map(line => line.trim())
			.filter(line => line)
			.map(line => line.split('\t'));
	} catch (e) {
		rows = [];                                    // no ladder yet, which is fine
	}

	const present = new Set(rows.map(r => String(r[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
	let added = 0;
	for (const queue of queues) {
		const id = queue.name.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (present.has(id)) continue;
		const rating = MEASURED[queue.difficulty];
		if (!rating) continue;                        // an unmeasured rung starts where anyone does
		rows.push([String(rating), queue.name, '0', '0', '0', '']);
		added++;
	}
	if (!added) return 0;

	// Showdown keeps the file in rating order, and so does its own writer.
	rows.sort((a, b) => Number(b[0]) - Number(a[0]));
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(file, `${HEADER}\r\n${rows.map(r => r.join('\t')).join('\r\n')}\r\n`);
	log(`seeded ${added} bot rating(s) on ${format}`);
	return added;
}

module.exports = { seedLadder, MEASURED };
