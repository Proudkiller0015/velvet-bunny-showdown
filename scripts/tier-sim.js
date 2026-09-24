'use strict';
/**
 * The tier simulation: the bots play drafted teams against each other, every
 * Pokemon in the pool gets its turn, and the results go to a file that
 * scripts/tier-report.js turns into proposed tiers.
 *
 *   node scripts/tier-sim.js --workers 2 --minutes 45            -- a fresh run
 *   node scripts/tier-sim.js --workers 2 --minutes 120 --resume   -- carry on
 *   node scripts/tier-sim.js --stop                              -- stop a run from another terminal
 *
 * Options: --out <file> (data/tier-sim/games.jsonl), --difficulty (stockfish),
 * --heap <MB> (512, and never more), --refit <games> (300), --target <apps>
 * (stop early once every Pokemon has this many appearances).
 *
 * It runs on the owner's home PC next to other work, so the limits are hard
 * ones rather than defaults: at most two battle workers, each a separate node
 * process capped at 512 MB of heap, and nothing written but one JSON line per
 * game (about half a kilobyte - no logs, no replays). Workers are replaced
 * every few hundred games so a slow leak in a cache can never grow without
 * bound.
 *
 * Resumable by construction: the file is append-only and each line is one
 * finished game, so stopping - Ctrl+C, --stop, the time limit, a crash, a
 * reboot - loses at most the games in flight. --resume reads the file back,
 * rebuilds the appearance counts and the estimates, and carries on. Without
 * --resume an existing file is refused rather than appended to or overwritten.
 *
 * The coordinator (this process, without --worker) does no battles: it keeps
 * the counts, refits the ratings every --refit games so pairing follows the
 * evidence, hands out jobs and writes lines. The workers draft both teams and
 * play the game.
 */

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const ROOT = path.join(__dirname, '..');
const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);

const OUT = path.resolve(ROOT, arg('out', path.join('data', 'tier-sim', 'games.jsonl')));
const STOP_FILE = path.join(path.dirname(OUT), 'STOP');
// The owner allowed up to 80% of the PC for this (24 Sep 2026): 10 of its 12 logical
// cores, ~330 MB each, leaving room for Windows and the live Discord bot.
const MAX_WORKERS = 10;
const MAX_HEAP = 512;

// ------------------------------------------------------------------ worker
if (has('worker')) {
	const dex = require('../src/rp-dex')();
	const { buildPool } = require('../src/tier-sim/pool');
	const { draftTeam } = require('../src/tier-sim/draft');
	const { playGame } = require('../src/tier-sim/play');
	const pool = buildPool(dex);
	const byName = new Map(pool.map(e => [e.name, e]));
	const difficulty = arg('difficulty', 'stockfish');

	const draft = side => {
		const entries = side.names.map(n => byName.get(n)).filter(Boolean);
		const strength = new Map(side.names.map((n, i) => [n, side.strengths[i]]));
		for (let attempt = 0; attempt < 2; attempt++) {
			const team = draftTeam(dex, entries, { strengthOf: e => strength.get(e.name) || 100, archetype: attempt ? null : side.archetype });
			if (team) return team;
		}
		return null;
	};

	process.on('message', async job => {
		if (!job || job.type !== 'job') return;
		const t0 = Date.now();
		let out;
		try {
			const A = draft(job.a), B = draft(job.b);
			if (!A || !B) {
				out = { type: 'result', id: job.id, err: 'draft', a: A ? A.names : job.a.names.slice(0, 6), b: B ? B.names : job.b.names.slice(0, 6) };
			} else {
				const draftMs = Date.now() - t0;
				// Side at random, so a first-player edge (there should be none) cannot pile onto one team.
				const aFirst = Math.random() < 0.5;
				const r = await playGame(aFirst ? A.sets : B.sets, aFirst ? B.sets : A.sets, { difficulty });
				const sa = aFirst ? r.p1 : r.p2, sb = aFirst ? r.p2 : r.p1;
				const w = r.winner === 'tie' ? 't' : r.winner === null ? null : (r.winner === 'p1') === aFirst ? 'a' : 'b';
				out = {
					type: 'result', id: job.id, a: A.names, b: B.names, fa: job.a.names[0], fb: job.b.names[0],
					w, p: aFirst ? 1 : 2, turns: r.turns, ms: r.ms, draftMs, dec: r.decisions,
					dms: r.decisions ? Math.round(r.decideMs / r.decisions) : 0, mx: r.maxDecideMs, e: r.errors,
					ab: r.aborted || undefined, sa, sb,
					// The two focus Pokemon's sets, compactly (item/moves), so the report can say
					// what a mover was running. Only those two: all twelve would double the file.
					ks: [A, B].map((T, k) => { const i = T.names.indexOf((k ? job.b : job.a).names[0]); const s = T.sets[i]; return s ? [s.item, ...s.moves].join('/') : ''; }),
				};
			}
		} catch (e) {
			out = { type: 'result', id: job.id, err: String(e && e.message || e).slice(0, 200), a: job.a.names.slice(0, 6), b: job.b.names.slice(0, 6) };
		}
		out.heap = Math.round(process.memoryUsage().heapUsed / 1e6);
		process.send(out);
	});
	process.send({ type: 'ready', pool: pool.length });
	return;
}

// -------------------------------------------------------------- stop mode
if (has('stop')) {
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(STOP_FILE, `stop requested ${new Date().toISOString()}\n`);
	console.log('Stop requested: the run finishes the games in flight and exits.');
	process.exit(0);
}

// ------------------------------------------------------------- coordinator
const WORKERS = Math.max(1, Math.min(MAX_WORKERS, Number(arg('workers', 2)) || 2));
if (Number(arg('workers', 2)) > MAX_WORKERS) console.log(`--workers capped at ${MAX_WORKERS} (shared machine).`);
const HEAP = Math.max(128, Math.min(MAX_HEAP, Number(arg('heap', MAX_HEAP)) || MAX_HEAP));
const MINUTES = Number(arg('minutes', 0));            // 0: until stopped or --target is reached
const TARGET = Number(arg('target', 0));
const REFIT = Math.max(50, Number(arg('refit', 300)) || 300);
const RECYCLE = 400;                                   // games per worker before it is replaced
const RESUME = has('resume');
const DIFFICULTY = arg('difficulty', 'stockfish');

const dex = require('../src/rp-dex')();
const { buildPool } = require('../src/tier-sim/pool');
const { Matchmaker, loadTeammates, loadServerUsage } = require('../src/tier-sim/match');
const { rate } = require('../src/tier-sim/rating');

const pool = buildPool(dex);
const { teammates, files } = loadTeammates(ROOT, pool.map(e => e.name));
const mm = new Matchmaker(pool, { teammates, usage: loadServerUsage(ROOT) });
console.log(`pool ${pool.length} Pokemon; teammate data from ${files} usage files for ${teammates.size} of them.`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
try { fs.unlinkSync(STOP_FILE); } catch (e) { /* none */ }
const records = [];
if (fs.existsSync(OUT) && fs.statSync(OUT).size > 0) {
	if (!RESUME) {
		console.error(`${path.relative(ROOT, OUT)} already has games. Use --resume to continue it, or --out for a new file.`);
		process.exit(1);
	}
	for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
		if (!line.trim()) continue;
		let r;
		try { r = JSON.parse(line); } catch (e) { continue; }   // a line cut off by a hard stop
		records.push(r);
		if (r.w) mm.record([...r.a, ...r.b]);
	}
	console.log(`resuming: ${records.length} games already played.`);
}

const stats = { started: Date.now(), done: 0, crashes: 0, drafts: 0, aborted: 0, decisions: 0, decideMsTotal: 0, maxDecide: 0, gameMs: 0, turns: 0 };
let nextId = records.length;
let stopping = false;
let sinceFit = 0;

function refit() {
	const t0 = Date.now();
	const good = records.filter(r => r.w && r.sa);
	if (good.length < 50) return;
	try {
		const out = rate(pool, good);
		mm.setEstimates(out.rows);
		console.log(`refit on ${good.length} games in ${((Date.now() - t0) / 1000).toFixed(1)}s (utility slope ${out.beta.toFixed(2)})`);
	} catch (e) {
		console.log('refit failed:', e.message);
	}
}
if (records.length) refit();

function progress() {
	const hrs = (Date.now() - stats.started) / 3600000;
	const apps = [...mm.apps.values()];
	const min = Math.min(...apps);
	const at40 = apps.filter(n => n >= 40).length;
	console.log(`[${new Date().toISOString().slice(11, 19)}] ${stats.done} games this session (${(stats.done / Math.max(1e-9, hrs)).toFixed(0)}/h), ` +
		`${stats.crashes} crashed, ${stats.drafts} draft failures, ${stats.aborted} capped; ` +
		`decision avg ${(stats.decideMsTotal / Math.max(1, stats.decisions)).toFixed(0)} ms, max ${stats.maxDecide} ms; ` +
		`appearances min ${min}, ${at40}/${apps.length} at 40+`);
	fs.writeFileSync(path.join(path.dirname(OUT), 'progress.json'), JSON.stringify({
		updated: new Date().toISOString(), session: { ...stats, hours: hrs }, total: records.length, minApps: min, at40, pool: apps.length,
	}, null, '\t'));
}

function shouldStop() {
	if (stopping) return true;
	if (MINUTES && Date.now() - stats.started > MINUTES * 60000) stopping = true;
	if (fs.existsSync(STOP_FILE)) stopping = true;
	if (TARGET && Math.min(...mm.apps.values()) >= TARGET) stopping = true;
	return stopping;
}

const workers = new Set();
function spawn() {
	const child = fork(__filename, ['--worker', '--difficulty', DIFFICULTY], { execArgv: [`--max-old-space-size=${HEAP}`], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
	const w = { child, games: 0, busy: false, ready: false };
	workers.add(w);
	child.on('message', msg => {
		if (msg.type === 'ready') { w.ready = true; dispatch(w); return; }
		if (msg.type !== 'result') return;
		w.busy = false;
		w.games++;
		handle(msg);
		if (w.games >= RECYCLE && !shouldStop()) { w.retiring = true; child.kill(); return; }
		dispatch(w);
	});
	child.on('exit', code => {
		workers.delete(w);
		if (w.busy) { stats.crashes++; console.log(`worker exited mid-game (code ${code}); the game is lost, not recorded.`); }
		if (!shouldStop()) spawn();
		else if (!workers.size) finish();
	});
}

function dispatch(w) {
	if (shouldStop()) { w.child.kill(); return; }
	const job = mm.next();
	w.busy = true;
	w.child.send({ type: 'job', id: nextId++, ...job });
}

function handle(msg) {
	delete msg.type;
	delete msg.id;
	const heap = msg.heap; delete msg.heap;
	if (msg.err === 'draft') { stats.drafts++; return; }
	if (msg.err || !msg.w) {
		stats.crashes++;
		// Kept, so a crash can be looked into; rating skips anything without a winner.
		msg.w = null;
	} else {
		mm.record([...msg.a, ...msg.b]);
	}
	if (msg.ab) stats.aborted++;
	stats.done++;
	stats.decisions += msg.dec || 0;
	stats.decideMsTotal += (msg.dms || 0) * (msg.dec || 0);
	stats.maxDecide = Math.max(stats.maxDecide, msg.mx || 0);
	stats.gameMs += msg.ms || 0;
	stats.turns += msg.turns || 0;
	stats.maxHeap = Math.max(stats.maxHeap || 0, heap || 0);
	records.push(msg);
	fs.appendFileSync(OUT, JSON.stringify(msg) + '\n');
	if (++sinceFit >= REFIT) { sinceFit = 0; refit(); }
}

let finished = false;
function finish() {
	if (finished) return;
	finished = true;
	clearInterval(ticker);
	progress();
	console.log(`done. ${records.length} games in ${path.relative(ROOT, OUT)}; run node scripts/tier-report.js for the report.`);
	process.exit(0);
}

process.on('SIGINT', () => {
	if (stopping) { console.log('second Ctrl+C: leaving now.'); for (const w of workers) w.child.kill(); process.exit(1); }
	stopping = true;
	console.log('stopping after the games in flight (Ctrl+C again to leave now)...');
});

const ticker = setInterval(() => {
	progress();
	if (shouldStop()) {
		for (const w of workers) if (!w.busy) w.child.kill();
		if (!workers.size) finish();
	}
}, 60000);
console.log(`${WORKERS} worker(s), heap cap ${HEAP} MB, ${MINUTES ? MINUTES + ' minutes' : 'until stopped'}, ${DIFFICULTY}; writing ${path.relative(ROOT, OUT)}`);
for (let i = 0; i < WORKERS; i++) spawn();
