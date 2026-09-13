'use strict';
/**
 * Entry point: bring up a Pokemon Showdown server, then connect the bot to it.
 *
 * One process, one port - which is what free hosts hand you. Players point the
 * official client at this server and get every format, the teambuilder, replays
 * and all; the bot is simply the user sitting on it waiting to be challenged.
 */

const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

require('../scripts/setup-config');

const PORT = Number(process.env.PORT) || 8000;
const HOST = '127.0.0.1';

function waitForPort(port, timeoutMs = 90000) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const socket = net.connect(port, HOST);
			socket.once('connect', () => { socket.destroy(); resolve(); });
			socket.once('error', () => {
				socket.destroy();
				if (Date.now() > deadline) reject(new Error(`server did not open port ${port}`));
				else setTimeout(attempt, 500);
			});
		};
		attempt();
	});
}

function startServer() {
	const entry = require.resolve('pokemon-showdown/dist/server/index.js');
	const child = spawn(process.execPath, [entry, String(PORT)], {
		// The package root, not its parent: Showdown resolves its static files
		// (server/static/404.html and friends) relative to the working directory.
		// Forked battle workers happened to resolve them anyway, so getting this
		// wrong only showed up once battles moved in-process.
		cwd: path.dirname(require.resolve('pokemon-showdown/package.json')),
		env: { ...process.env, PORT: String(PORT) },
		stdio: ['ignore', 'inherit', 'inherit'],
	});
	child.on('exit', code => {
		console.error(`[server] exited with code ${code}`);
		process.exit(code || 1);
	});
	return child;
}

(async () => {
	// Ratings live in a file inside the package, on a disk this host wipes every
	// restart, so pull the saved copy back before Showdown reads it.
	//
	// The bot rungs are seeded from the round robin in test/elo.test.js, so a
	// player is matched against one near their own strength from their very first
	// search and beating Champion is worth more than beating Easy straight away.
	// Only missing rows are added - a rating earned against people always stands.
	const pkgRoot = path.dirname(require.resolve('pokemon-showdown/package.json'));
	const ladderDir = path.join(pkgRoot, 'config', 'ladders');
	const { LadderStore } = require('./ladder-store');
	const store = new LadderStore(ladderDir, (...a) => console.log('[ladder-store]', ...a));
	await store.connect();
	await store.restore();

	const { seedLadder } = require('./ladder-seed');
	const { queueName, DEFAULT_FORMATS, DEFAULT_DIFFICULTIES } = require('./ladder');
	const seedFormats = (process.env.PS_LADDER_FORMATS || DEFAULT_FORMATS.join(','))
		.split(',').map(f => f.trim()).filter(f => f);
	const seedDifficulties = (process.env.PS_LADDER_DIFFICULTIES || DEFAULT_DIFFICULTIES.join(','))
		.split(',').map(d => d.trim()).filter(d => d);
	for (const format of seedFormats) {
		seedLadder(ladderDir, format, seedDifficulties.map(difficulty => ({
			name: queueName(process.env.PS_BOT_NAME || 'Velvet Bunny', difficulty, format, seedFormats.length > 1),
			difficulty,
		})), msg => console.log('[ladder-seed]', msg));
	}

	console.log(`[boot] starting Pokemon Showdown on port ${PORT}`);
	const server = startServer();

	/**
	 * Leave slowly enough for the server to say goodbye.
	 *
	 * A restart cannot preserve a battle - it lives in this process's memory and
	 * there is nowhere to put it - so the next best thing is to not lose it
	 * silently: the server is given a few seconds to warn everyone in a battle,
	 * save a replay of it, and let people finish reading the room before the
	 * socket closes under them (see the shutdown notice in the config).
	 *
	 * The window is deliberately shorter than the one the host allows between
	 * asking a process to stop and killing it outright, which on Render is 30
	 * seconds. Going over that would mean being killed mid-sentence, which is
	 * the thing this exists to avoid.
	 */
	const GOODBYE_MS = Number(process.env.PS_SHUTDOWN_GRACE_MS || 22000);
	let leaving = false;

	const shutdown = () => {
		if (leaving) return;   // a second Ctrl-C should not cut the first one short
		leaving = true;

		// Ask the server to wind down. It has its own handler for this, and it
		// exits on its own when it is done.
		try { server.kill('SIGTERM'); } catch (e) { /* already gone */ }

		const done = () => {
			// Ratings last, so anything the wind-down changed is included.
			store.stop().catch(() => {}).finally(() => process.exit(0));
		};

		const deadline = setTimeout(() => {
			console.log('[boot] the server is taking too long; closing anyway');
			try { server.kill('SIGKILL'); } catch (e) {}
			done();
		}, GOODBYE_MS);
		if (deadline.unref) deadline.unref();

		server.once('exit', () => {
			clearTimeout(deadline);
			done();
		});
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	await waitForPort(PORT);
	console.log('[boot] server is up');

	if (process.env.PS_NO_BOT === '1') {
		console.log('[boot] PS_NO_BOT=1, not starting the bot');
		return;
	}
	const url = `ws://${HOST}:${PORT}/showdown/websocket`;
	// One map, written by whoever the player talks to and read by every queue.
	const difficultyFor = new Map();

	const { ShowdownBot } = require('./bot');
	const bot = new ShowdownBot({ url, difficultyFor });
	bot.connect();

	const { describeBrain } = require('./brain');
	console.log(`[boot] ${describeBrain()}`);

	// Queues so that the client's own Battle! button finds the bot, and the
	// result counts on a real ladder. One connection per format, because an
	// account can only queue for one at a time.
	const { startLadderBots } = require('./ladder');
	const ladder = startLadderBots({
		url,
		baseName: bot.name,
		builder: bot.builder,
		difficulty: bot.defaultDifficulty,
		difficultyFor,
		log: (...a) => console.log('[ladder]', ...a),
	});
	console.log(`[boot] ${ladder.length} ladder queue(s) starting`);
	store.start();
})().catch(err => {
	console.error('[boot] failed:', err);
	process.exit(1);
});
