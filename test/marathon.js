'use strict';
/**
 * Let the bots play each other for as long as you like, and keep what is worth
 * keeping.
 *
 * This is the thing the live server must never do. Four queues left in the same
 * ladder pool filled five battle rooms in six, burned the one shared CPU a free
 * tier gets, and beat each other into ratings no player had any part in. Here
 * none of that matters: it is off the server, on a machine with cores to spare,
 * and nothing it produces touches anybody's rating.
 *
 * What it writes, every flush:
 *
 *   data/marathon/standings.md   fitted Elo, the head-to-head grid, how long
 *                                games last, and how often each rung sweeps
 *   data/marathon/notable.jsonl  the games actually worth reading - upsets,
 *                                sweeps, and the very long and very short ones -
 *                                with their full logs, capped per category
 *
 * Aggregates cover every game played. Full logs are kept only for the notable
 * ones: at a hundred and fifty thousand games a day, keeping them all would be
 * tens of gigabytes and nobody would ever read a line of it.
 *
 *   npm run marathon                    -- until stopped
 *   npm run marathon -- --hours 24      -- for a day
 *   npm run marathon:stop               -- stop it from another terminal
 *
 * Ctrl+C does the same thing: it finishes the games in flight, writes, commits
 * and exits rather than leaving the last stretch unsaved.
 */

const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'marathon');
const STOP_FILE = path.join(OUT_DIR, 'STOP');

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);

// ------------------------------------------------------------------ stop mode
// Writing the file is all it takes; the run checks for it between batches.
if (has('stop')) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	fs.writeFileSync(STOP_FILE, `stop requested ${new Date().toISOString()}\n`);
	console.log('Stop requested. The marathon will finish its current games, save, and exit.');
	process.exit(0);
}

const RUNGS = String(arg('rungs', 'easy,normal,hard,champion,stockfish')).split(',').map(r => r.trim()).filter(r => r);
const FORMAT = arg('format', 'gen9randombattle');
const HOURS = Number(arg('hours', 0));               // 0 means until stopped
// Half the machine by default. This runs for hours and the computer should stay
// usable while it does; --workers takes it higher.
const WORKERS = Number(arg('workers', Math.max(1, Math.floor(os.cpus().length / 2))));
const BATCH = Number(arg('batch', 4));
const FLUSH_MINUTES = Number(arg('flush', 15));
const COMMIT = !has('no-commit');
const KEEP_PER_CATEGORY = Number(arg('keep', 40));

// ---------------------------------------------------------------- child mode
if (has('play')) {
	const A = arg('a'), B = arg('b'), games = Number(arg('games', 1));
	const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
	const { BattleAI } = require('../src/ai');
	const { BattleState } = require('../src/battle');
	const { TeamBuilder } = require('../src/teambuilder');
	const { MEASURED } = require('../src/ladder-seed');

	const playGame = async (builder, aIsP1) => {
		const stream = new BattleStream();
		const streams = getPlayerStreams(stream);
		const bots = {
			p1: new BattleAI({ difficulty: aIsP1 ? A : B }),
			p2: new BattleAI({ difficulty: aIsP1 ? B : A }),
		};
		for (const bot of Object.values(bots)) bot.setFormat(FORMAT);
		const team = () => (builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null);
		void streams.omniscient.write(
			`>start ${JSON.stringify({ formatid: FORMAT })}\n` +
			`>player p1 ${JSON.stringify({ name: 'P1', team: team() })}\n` +
			`>player p2 ${JSON.stringify({ name: 'P2', team: team() })}\n`
		);

		const run = async (who) => {
			const state = new BattleState('marathon');
			state.myPlayer = who;
			for await (const chunk of streams[who]) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|')) continue;
					const parts = line.slice(1).split('|');
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

		const log = [];
		let winner = null, turns = 0;
		const faints = { p1: 0, p2: 0 };
		const watch = (async () => {
			for await (const chunk of streams.omniscient) {
				for (const line of chunk.split('\n')) {
					log.push(line);
					if (line.startsWith('|turn|')) turns = Number(line.slice(6)) || turns;
					if (line.startsWith('|faint|')) {
						const side = line.slice(7, 9);
						if (side === 'p1') faints.p1++; else if (side === 'p2') faints.p2++;
					}
					if (line.startsWith('|win|')) winner = line.slice(5).trim();
					if (line.startsWith('|tie')) winner = 'tie';
				}
			}
		})();

		await Promise.all([run('p1'), run('p2'), watch]);

		const aSide = aIsP1 ? 'p1' : 'p2';
		const bSide = aIsP1 ? 'p2' : 'p1';
		const result = winner === 'tie' ? 'tie'
			: winner === (aIsP1 ? 'P1' : 'P2') ? 'a' : 'b';

		// What makes a game worth keeping the log of.
		const why = [];
		const ratingA = MEASURED[A] || 1000, ratingB = MEASURED[B] || 1000;
		if (result !== 'tie') {
			const winnerRung = result === 'a' ? A : B;
			const loserRung = result === 'a' ? B : A;
			const winnerRating = result === 'a' ? ratingA : ratingB;
			const loserRating = result === 'a' ? ratingB : ratingA;
			if (winnerRating + 60 < loserRating) why.push('upset');
			const loserFaints = result === 'a' ? faints[bSide] : faints[aSide];
			const winnerFaints = result === 'a' ? faints[aSide] : faints[bSide];
			if (loserFaints >= 6 && winnerFaints <= 1) why.push('sweep');
			void winnerRung; void loserRung;
		}
		if (turns >= 90) why.push('long');
		else if (turns > 0 && turns <= 8) why.push('short');

		return {
			t: Date.now(), a: A, b: B, result, turns,
			faintsA: faints[aSide], faintsB: faints[bSide],
			why,
			log: why.length ? log.filter(l => l).join('\n') : undefined,
		};
	};

	(async () => {
		const builder = new TeamBuilder();
		try { await builder.prefetch(FORMAT); } catch (e) { /* offline is fine */ }
		const records = [];
		for (let i = 0; i < games; i++) {
			try { records.push(await playGame(builder, i % 2 === 0)); } catch (e) { /* skip the game */ }
		}
		process.stdout.write(`\n${JSON.stringify(records)}\n`);
	})();
	return;
}

// --------------------------------------------------------------- parent mode
const { fitRatings } = require('../src/elo');

const pairs = [];
for (let i = 0; i < RUNGS.length; i++) {
	for (let j = i + 1; j < RUNGS.length; j++) pairs.push([RUNGS[i], RUNGS[j]]);
}
if (!pairs.length) {
	console.error('Need at least two rungs to play each other.');
	process.exit(1);
}

const totals = new Map(pairs.map(([a, b]) => [`${a}|${b}`, { a, b, score: 0, played: 0, ties: 0, turns: 0 }]));
const perRung = new Map(RUNGS.map(r => [r, { w: 0, l: 0, t: 0, sweeps: 0, swept: 0 }]));
const notable = new Map();   // category -> records
let gamesPlayed = 0, pairIndex = 0, running = 0, stopping = false;
const startedAt = Date.now();
const deadline = HOURS > 0 ? startedAt + HOURS * 3600 * 1000 : Infinity;

fs.mkdirSync(OUT_DIR, { recursive: true });
try { fs.unlinkSync(STOP_FILE); } catch (e) { /* was not there */ }

function shouldStop() {
	if (stopping) return true;
	if (Date.now() >= deadline) return true;
	return fs.existsSync(STOP_FILE);
}

function record(rec) {
	const key = totals.has(`${rec.a}|${rec.b}`) ? `${rec.a}|${rec.b}` : `${rec.b}|${rec.a}`;
	const t = totals.get(key);
	if (!t) return;
	t.played++;
	t.turns += rec.turns || 0;
	gamesPlayed++;
	if (rec.result === 'tie') {
		t.score += 0.5; t.ties++;
		perRung.get(rec.a).t++; perRung.get(rec.b).t++;
	} else {
		const winner = rec.result === 'a' ? rec.a : rec.b;
		const loser = rec.result === 'a' ? rec.b : rec.a;
		// `score` is always the first-named rung's total, whichever side it played.
		if (winner === t.a) t.score += 1;
		perRung.get(winner).w++;
		perRung.get(loser).l++;
		if ((rec.why || []).includes('sweep')) { perRung.get(winner).sweeps++; perRung.get(loser).swept++; }
	}
	for (const why of rec.why || []) {
		if (!notable.has(why)) notable.set(why, []);
		const list = notable.get(why);
		list.push(rec);
		if (list.length > KEEP_PER_CATEGORY) list.shift();   // keep the most recent
	}
}

function standings() {
	const results = [...totals.values()].filter(t => t.played);
	const rating = fitRatings(results, RUNGS);
	const ranked = RUNGS.slice().sort((x, y) => rating[y] - rating[x]);
	const hours = ((Date.now() - startedAt) / 3600000);

	const lines = [];
	lines.push('# Bot marathon');
	lines.push('');
	lines.push(`The difficulty rungs playing each other on ${FORMAT}, off the live server so that`);
	lines.push('nothing here touches a player\'s rating.');
	lines.push('');
	lines.push(`- games: **${gamesPlayed.toLocaleString()}**`);
	lines.push(`- running for: ${hours.toFixed(1)} hours (${(gamesPlayed / Math.max(hours, 0.001)).toFixed(0)}/hour)`);
	lines.push(`- last updated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push('## Rating');
	lines.push('');
	lines.push('| rung | Elo | W | L | T | sweeps | swept |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
	for (const r of ranked) {
		const s = perRung.get(r);
		lines.push(`| ${r} | ${Math.round(rating[r])} | ${s.w} | ${s.l} | ${s.t} | ${s.sweeps} | ${s.swept} |`);
	}
	lines.push('');
	lines.push('## Head to head');
	lines.push('');
	lines.push('Share of games won by the rung on the left.');
	lines.push('');
	lines.push(`| | ${ranked.join(' | ')} |`);
	lines.push(`| --- |${ranked.map(() => ' ---: |').join('')}`);
	for (const a of ranked) {
		const cells = ranked.map(b => {
			if (a === b) return '-';
			const t = totals.get(`${a}|${b}`);
			if (t && t.played) return `${(t.score / t.played * 100).toFixed(0)}%`;
			const rev = totals.get(`${b}|${a}`);
			if (rev && rev.played) return `${((1 - rev.score / rev.played) * 100).toFixed(0)}%`;
			return '-';
		});
		lines.push(`| ${a} | ${cells.join(' | ')} |`);
	}
	lines.push('');
	lines.push('## Game length');
	lines.push('');
	lines.push('| pairing | games | average turns |');
	lines.push('| --- | ---: | ---: |');
	for (const t of [...totals.values()].filter(x => x.played)) {
		lines.push(`| ${t.a} vs ${t.b} | ${t.played} | ${(t.turns / t.played).toFixed(1)} |`);
	}
	lines.push('');
	lines.push('## Kept games');
	lines.push('');
	lines.push('Full logs for these are in `notable.jsonl`.');
	lines.push('');
	lines.push('| kind | kept |');
	lines.push('| --- | ---: |');
	for (const [why, list] of [...notable.entries()].sort()) lines.push(`| ${why} | ${list.length} |`);
	lines.push('');
	return lines.join('\n');
}

function flush(reason) {
	if (!gamesPlayed) return;
	fs.mkdirSync(OUT_DIR, { recursive: true });
	fs.writeFileSync(path.join(OUT_DIR, 'standings.md'), standings());
	const kept = [...notable.values()].flat().sort((a, b) => a.t - b.t);
	fs.writeFileSync(path.join(OUT_DIR, 'notable.jsonl'), kept.map(r => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''));
	console.log(`\n[marathon] ${gamesPlayed.toLocaleString()} games, wrote standings (${reason})`);
	if (!COMMIT) return;
	try {
		execFileSync('git', ['add', 'data/marathon'], { cwd: ROOT, stdio: 'ignore' });
		execFileSync('git', ['commit', '-q', '-m',
			`Bot marathon: ${gamesPlayed.toLocaleString()} games on ${FORMAT}`,
			'-m', 'Bots playing each other off the live server, where it costs nobody a rating.',
		], { cwd: ROOT, stdio: 'ignore' });
		execFileSync('git', ['push', '-q', 'origin', 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
		console.log('[marathon] pushed');
	} catch (e) {
		console.log('[marathon] nothing to commit, or the push failed - results are still on disk');
	}
}

function launch(done) {
	if (shouldStop()) return done();
	const [a, b] = pairs[pairIndex++ % pairs.length];
	running++;
	execFile(process.execPath,
		[__filename, '--play', '--a', a, '--b', b, '--games', String(BATCH), '--format', FORMAT],
		{ maxBuffer: 1 << 27 },
		(err, stdout) => {
			running--;
			if (!err) {
				try { for (const rec of JSON.parse(stdout.trim().split('\n').pop())) record(rec); } catch (e) { /* lost batch */ }
			}
			process.stderr.write(`\r  ${gamesPlayed.toLocaleString()} games`);
			launch(done);
		});
}

let flushTimer = null;
function finish() {
	if (flushTimer) clearInterval(flushTimer);
	process.stderr.write('\n');
	flush('finished');
	process.exit(0);
}

process.on('SIGINT', () => {
	if (stopping) process.exit(1);         // a second Ctrl+C gives up immediately
	stopping = true;
	console.log('\n[marathon] stopping - finishing the games in flight, then saving.');
});

console.log(`marathon on ${FORMAT}: ${RUNGS.join(', ')}`);
console.log(`${WORKERS} at a time${HOURS > 0 ? `, for ${HOURS} hours` : ', until stopped'}; writing every ${FLUSH_MINUTES} min`);
console.log(`stop with:  npm run marathon:stop   (or Ctrl+C)\n`);

flushTimer = setInterval(() => flush('checkpoint'), FLUSH_MINUTES * 60 * 1000);
flushTimer.unref?.();

let live = WORKERS;
for (let i = 0; i < WORKERS; i++) launch(() => { if (--live === 0) finish(); });
