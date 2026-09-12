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
		cwd: path.dirname(path.dirname(require.resolve('pokemon-showdown/package.json'))),
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
	console.log(`[boot] starting Pokemon Showdown on port ${PORT}`);
	const server = startServer();

	const shutdown = () => { try { server.kill(); } catch (e) { /* already gone */ } process.exit(0); };
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	await waitForPort(PORT);
	console.log('[boot] server is up');

	if (process.env.PS_NO_BOT === '1') {
		console.log('[boot] PS_NO_BOT=1, not starting the bot');
		return;
	}
	const { ShowdownBot } = require('./bot');
	const bot = new ShowdownBot({ url: `ws://${HOST}:${PORT}/showdown/websocket` });
	bot.connect();
})().catch(err => {
	console.error('[boot] failed:', err);
	process.exit(1);
});
