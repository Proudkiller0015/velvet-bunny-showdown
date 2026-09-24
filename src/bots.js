'use strict';
/**
 * The bots, in a process of their own.
 *
 * Started by src/index.js once the server is listening, and restarted by it
 * whenever this exits. Everything that plays lives here: the lobby bot, the RP
 * guide and its encounter opponents, and the ladder rungs, all sharing one team
 * builder.
 *
 * Why a separate process: the team builder loads each generation's dex mod the
 * first time a format from it is played, and V8 never gives that back. With
 * every tier on the ladder, one sitting through ~125 different formats walked
 * the heap up to the 200MB cap and the process died of it - and when this code
 * ran inside the wrapper, the wrapper dying took the battle server with it.
 * Here, a crash costs the bots a reconnect and nothing else.
 *
 * And so it rarely comes to a crash: when the heap is past PS_BOTS_RECYCLE_MB
 * and nobody is in a battle, searching, or being challenged by one of these,
 * the process exits on purpose and comes back fresh. Nobody is mid-anything
 * when that happens, so nobody notices.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.PORT) || 8000;
const HOST = '127.0.0.1';
const url = `ws://${HOST}:${PORT}/showdown/websocket`;

const RECYCLE_MB = Number(process.env.PS_BOTS_RECYCLE_MB || 150);
const CHECK_MS = Number(process.env.PS_BOTS_CHECK_MS || 30000);
// Never sooner than this after starting, so a threshold set below what a fresh
// process needs cannot turn into a restart every minute.
const MIN_UPTIME_S = Number(process.env.PS_BOTS_MIN_UPTIME_S ?? 600);

// If the wrapper goes, so do we: an orphan holding the bot names would lock the
// next boot's bots out of their own accounts.
process.on('disconnect', () => process.exit(0));

const players = [];   // every bot that can be in a battle
const difficultyFor = new Map();

const { ShowdownBot, expireIdleBattles } = require('./bot');
const bot = new ShowdownBot({ url, difficultyFor });
bot.connect();
players.push(bot);

let guide = null;
if (process.env.PS_NO_RP_BOT !== '1') {
	const { RpGuide } = require('./rp-bot');
	guide = new RpGuide({ url, builder: bot.builder });
	guide.connect();
	players.push(guide);
}

const { describeBrain } = require('./brain');
console.log(`[bots] ${describeBrain()}`);

const { startLadderBots } = require('./ladder');
const ladder = startLadderBots({
	url,
	baseName: bot.name,
	builder: bot.builder,
	difficulty: bot.defaultDifficulty,
	difficultyFor,
	log: (...a) => console.log('[ladder]', ...a),
});
players.push(...ladder);
console.log(`[bots] ${ladder.length} ladder queue(s) starting`);

/** What would be interrupted by a restart right now, or '' if nothing. */
function busyWith() {
	const battles = players.reduce((n, p) => n + (p.battles ? p.battles.size : 0), 0);
	if (battles) return `${battles} battle(s)`;
	const searching = ladder.reduce((n, q) => n + (q.formats ? q.formats.size : 0) + (q.pending ? q.pending.size : 0), 0);
	if (searching) return `${searching} search(es)`;
	if (guide && guide.live.size) return `${guide.live.size} RP encounter(s)`;
	return '';
}

const statusFile = path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-bots.json');
let highChecks = 0;
let recycling = false;

function check() {
	const memory = process.memoryUsage();
	// 24 Sep 2026: a battle that went silent without a deinit would otherwise
	// count as "busy" forever and hold the recycle off; see expireIdleBattles().
	for (const p of players) {
		if (!p.battles) continue;
		const dropped = expireIdleBattles(p);
		if (dropped) console.log(`[bots] ${p.name}: dropped ${dropped} battle(s) idle for over 30 minutes`);
	}
	const busy = busyWith();
	try {
		fs.mkdirSync(path.dirname(statusFile), { recursive: true });
		fs.writeFileSync(statusFile, JSON.stringify({
			pid: process.pid,
			uptimeSeconds: Math.round(process.uptime()),
			heapLimit: require('v8').getHeapStatistics().heap_size_limit,
			nodeOptions: process.env.NODE_OPTIONS || '',
			rss: memory.rss,
			heapUsed: memory.heapUsed,
			heapTotal: memory.heapTotal,
			external: memory.external,
			recycleMB: RECYCLE_MB,
			busy,
			at: new Date().toISOString(),
		}));
	} catch (e) {
		// Diagnostics must never be the thing that breaks the bots.
	}

	// Twice in a row, so one garbage-heavy moment is not mistaken for the leak.
	highChecks = memory.heapUsed > RECYCLE_MB * 1048576 ? highChecks + 1 : 0;
	if (highChecks >= 2 && !busy && !recycling && process.uptime() >= MIN_UPTIME_S) {
		recycling = true;
		console.log(`[bots] heap ${Math.round(memory.heapUsed / 1048576)}MB and nobody is playing: restarting fresh`);
		for (const p of players) {
			try { if (p.ws) p.ws.close(); } catch (e) {}
		}
		// A moment for the closes to reach the server, then go.
		setTimeout(() => process.exit(0), 500);
	}
}
check();
setInterval(check, CHECK_MS);
