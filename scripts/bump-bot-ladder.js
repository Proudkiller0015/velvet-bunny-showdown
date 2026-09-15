'use strict';
/**
 * One-off: lift every house bot's rating onto its rung's plateau.
 *
 *   node scripts/bump-bot-ladder.js [dir]      (default data/ladders)
 *
 * The easiest rung was seeded at 777, below where a new player starts (1000), so
 * beating it was worth almost nothing. Every bot row gets the same lift (Easy's
 * new floor minus 777), is raised to its own rung's plateau if still under it,
 * and within each set of rungs (the plain queues, the RB ones, the rpRB ones...)
 * the ratings are kept in order: Easy < Normal < Hard < Champion < Stockfish.
 * Players' rows are not touched.
 */

const fs = require('fs');
const path = require('path');
const { BOT_FLOOR, BOT_FLOORS } = require('../src/ladder-seed');

const OLD_LOWEST = 777;
const LIFT = BOT_FLOOR - OLD_LOWEST;
const ORDER = ['easy', 'normal', 'hard', 'champion', 'stockfish'];
const dir = process.argv[2] || path.join(__dirname, '..', 'data', 'ladders');

for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsv'))) {
	const full = path.join(dir, file);
	const [header, ...lines] = fs.readFileSync(full, 'utf8').split(/\r?\n/);
	const rows = lines.filter(l => l.trim()).map(l => l.split('\t'));

	// Bot rows, grouped by what follows the difficulty in the name ("", "RB", "rpRB", "RP", "rpOU").
	const groups = new Map();
	for (const row of rows) {
		const m = /^Bunny (Easy|Normal|Hard|Champion|Stockfish)\b\s*(.*)$/i.exec(row[1] || '');
		if (!m) continue;
		const rung = m[1].toLowerCase();
		const lifted = Math.round((Number(row[0]) + LIFT) * 1000) / 1000;
		row[0] = String(Math.max(lifted, BOT_FLOORS[rung]));
		const key = m[2].trim().toLowerCase();
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push({ row, rung: ORDER.indexOf(rung) });
	}
	for (const bots of groups.values()) {
		// Harder rungs never sit at or below an easier one.
		bots.sort((a, b) => a.rung - b.rung).forEach((b, i) => {
			if (i && Number(b.row[0]) <= Number(bots[i - 1].row[0])) b.row[0] = String(Number(bots[i - 1].row[0]) + 1);
		});
	}

	rows.sort((a, b) => Number(b[0]) - Number(a[0]));
	fs.writeFileSync(full, `${header}\r\n${rows.map(r => r.join('\t')).join('\r\n')}\r\n`);
	console.log(`== ${file}`);
	for (const r of rows.filter(r => /^Bunny /i.test(r[1]))) console.log(`  ${Math.round(Number(r[0]))}\t${r[1]}`);
}
