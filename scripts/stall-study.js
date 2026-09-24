'use strict';
/**
 * Teaching the bot stall: real Smogon National Dex stall teams against offense,
 * both sides played by the AI, every game's log kept for review.
 *
 *   node scripts/stall-study.js --round 0 --games 100 --workers 4
 *   node scripts/stall-study.js --round 0 --report
 *
 * Teams are data/teams/natdex/*.txt (see its README): stall-* are the students,
 * everything else is the opposition. A round is ~100 games spread evenly over
 * stall team x opponent pairs, sides at random. Output goes to
 * data/stall-study/round-<n>/ (games.jsonl + logs/) so rounds compare cleanly:
 * play a round, read the stall side's logs (scripts/replay-flags.js --dir ...),
 * fix the AI, play the next round.
 *
 * Opponents the server would not allow are skipped (Terapagos is Uber here).
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
const FORMAT = arg('format', 'gen9nationaldex');
const TEAM_DIR = path.join(ROOT, 'data', 'teams', 'natdex');
const OUT_DIR = path.join(ROOT, 'data', 'stall-study', `round-${arg('round', '0')}`);
const SKIP = /terapagos/i;

// ------------------------------------------------------------------ worker
if (has('worker')) {
	const { Teams } = require('pokemon-showdown');
	const { playGame } = require('../src/tier-sim/play');
	process.on('message', async job => {
		let out;
		try {
			const stall = Teams.import(fs.readFileSync(path.join(TEAM_DIR, job.stall), 'utf8'));
			const opp = Teams.import(fs.readFileSync(path.join(TEAM_DIR, job.opp), 'utf8'));
			const stallFirst = Math.random() < 0.5;
			const r = await playGame(stallFirst ? stall : opp, stallFirst ? opp : stall, { format: FORMAT, keepLog: true });
			const stallSide = stallFirst ? 'p1' : 'p2';
			const w = r.winner === 'tie' ? 't' : r.winner === null ? null : r.winner === stallSide ? 'stall' : 'opp';
			const id = `stall-${job.id}`;
			fs.mkdirSync(path.join(OUT_DIR, 'logs'), { recursive: true });
			// replay-flags.js shape; the stall side is named "Stall" so --player Stall reviews it.
			fs.writeFileSync(path.join(OUT_DIR, 'logs', `${id}.json`), JSON.stringify({
				id, players: stallFirst ? ['Stall', 'Opp'] : ['Opp', 'Stall'], uploadtime: Math.floor(Date.now() / 1000),
				log: r.log.replace(/\|player\|p([12])\|P[12]\|/g, (m, n) => `|player|p${n}|${(n === '1') === stallFirst ? 'Stall' : 'Opp'}|`)
					.replace(/\|win\|P([12])/g, (m, n) => `|win|${(n === '1') === stallFirst ? 'Stall' : 'Opp'}`),
			}));
			out = { id, stall: job.stall, opp: job.opp, side: stallSide, w, turns: r.turns, ab: r.aborted || undefined, e: r.errors, dms: r.decisions ? Math.round(r.decideMs / r.decisions) : 0 };
		} catch (e) {
			out = { err: String(e && e.message || e).slice(0, 200), stall: job.stall, opp: job.opp };
		}
		process.send(out);
	});
	process.send({ ready: true });
	return;
}

// ------------------------------------------------------------------ report
function report() {
	const file = path.join(OUT_DIR, 'games.jsonl');
	if (!fs.existsSync(file)) { console.log('no games in', path.relative(ROOT, OUT_DIR)); return; }
	const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.w);
	const tally = (key) => {
		const m = new Map();
		for (const r of rows) { const k = key(r); const s = m.get(k) || [0, 0]; s[0] += r.w === 'stall' ? 1 : r.w === 't' ? 0.5 : 0; s[1]++; m.set(k, s); }
		return [...m].sort();
	};
	const all = rows.reduce((s, r) => s + (r.w === 'stall' ? 1 : r.w === 't' ? 0.5 : 0), 0);
	const p = all / Math.max(1, rows.length);
	console.log(`${path.relative(ROOT, OUT_DIR)}: stall won ${all}/${rows.length} (${(100 * p).toFixed(0)}% +/- ${(164.5 * Math.sqrt(p * (1 - p) / Math.max(1, rows.length))).toFixed(0)}), avg ${(rows.reduce((s, r) => s + r.turns, 0) / Math.max(1, rows.length)).toFixed(1)} turns`);
	for (const [k, s] of tally(r => r.stall)) console.log(`  ${k}: ${s[0]}/${s[1]}`);
	for (const [k, s] of tally(r => `vs ${r.opp.replace(/-\d\.txt$/, '')}`)) console.log(`  ${k}: ${s[0]}/${s[1]}`);
}
if (has('report')) { report(); process.exit(0); }

// ------------------------------------------------------------- coordinator
const GAMES = Number(arg('games', 100));
const WORKERS = Math.max(1, Math.min(8, Number(arg('workers', 4)) || 4));
const files = fs.readdirSync(TEAM_DIR).filter(f => f.endsWith('.txt'));
const allowed = f => !SKIP.test(fs.readFileSync(path.join(TEAM_DIR, f), 'utf8'));
const stalls = files.filter(f => f.startsWith('stall-') && allowed(f));
const opps = files.filter(f => !f.startsWith('stall-') && allowed(f));
console.log(`stall: ${stalls.join(', ')}; opponents: ${opps.join(', ')}; skipped: ${files.filter(f => !allowed(f)).join(', ') || 'none'}`);
const jobs = [];
for (let i = 0; jobs.length < GAMES; i++) jobs.push({ id: i, stall: stalls[i % stalls.length], opp: opps[Math.floor(i / stalls.length) % opps.length] });
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, 'games.jsonl');
const start = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).length : 0;
for (const j of jobs) j.id += start;
let next = 0, done = 0, live = 0;
for (let k = 0; k < WORKERS; k++) {
	const child = fork(__filename, ['--worker', '--round', arg('round', '0'), '--format', FORMAT], { execArgv: ['--max-old-space-size=512'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
	live++;
	const give = () => { if (next < jobs.length) child.send(jobs[next++]); else child.kill(); };
	child.on('message', msg => {
		if (msg.ready) return give();
		fs.appendFileSync(OUT, JSON.stringify(msg) + '\n');
		if (++done % 10 === 0) console.log(`${done}/${jobs.length}`);
		give();
	});
	child.on('exit', () => { if (--live === 0) { report(); process.exit(0); } });
}
