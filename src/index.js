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
	// Nothing is seeded: every account starts at 1000 and earns its rating like
	// anyone else. The rungs separate on their own, because they meet each other
	// in the queue as well as meeting players.
	const pkgRoot = path.dirname(require.resolve('pokemon-showdown/package.json'));
	const ladderDir = path.join(pkgRoot, 'config', 'ladders');
	const { LadderStore } = require('./ladder-store');
	const store = new LadderStore(ladderDir, (...a) => console.log('[ladder-store]', ...a));
	await store.connect();
	await store.restore();

	console.log(`[boot] starting Pokemon Showdown on port ${PORT}`);
	const server = startServer();

	const shutdown = () => {
		// Flush the ratings before the process goes, or the last games are lost.
		store.stop().catch(() => {}).finally(() => {
			try { server.kill(); } catch (e) { /* already gone */ }
			process.exit(0);
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
