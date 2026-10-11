'use strict';
/**
 * Players' real addresses behind Render's local hop (proxyip in config/showdown-config.js).
 *
 * Boots the real server and connects the way each kind of client reaches it: a player
 * through the hop (X-Forwarded-For set), a player faking an address in front of theirs,
 * and one of our bots (local, sending 127.0.0.1). /ip says what the server saw.
 *
 *   node test/proxy-ip.test.js
 */
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 8127;
const root = path.join(__dirname, '..');

function waitForPort(port, timeoutMs = 120000) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const socket = net.connect(port, '127.0.0.1');
			socket.once('connect', () => { socket.destroy(); resolve(); });
			socket.once('error', () => {
				socket.destroy();
				if (Date.now() > deadline) reject(new Error(`port ${port} never opened`));
				else setTimeout(attempt, 500);
			});
		};
		attempt();
	});
}

/** The address the server shows for a connection made with these headers. */
function seenAs(headers) {
	return new Promise((resolve) => {
		const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`, { headers });
		const timer = setTimeout(() => { ws.terminate(); resolve('(no answer)'); }, 15000);
		ws.on('message', (data) => {
			const text = String(data);
			if (text.includes('|challstr|')) ws.send('|/ip');
			const match = text.match(/IP:\s*<a[^>]*>([^<]*)</);
			if (match) { clearTimeout(timer); ws.close(); resolve(match[1]); }
		});
		ws.on('error', () => { clearTimeout(timer); resolve('(error)'); });
	});
}

(async () => {
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: { ...process.env, PORT: String(PORT) },
		stdio: ['ignore', 'ignore', 'ignore'],
	});
	const cleanup = () => { try { server.kill(); } catch (e) { /* gone */ } };
	process.on('exit', cleanup);
	await waitForPort(PORT);

	let failed = 0;
	const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

	const player = await seenAs({ 'X-Forwarded-For': '23.239.51.105' });
	check(player === '23.239.51.105', `a player through the hop shows their own address (${player})`);
	const faked = await seenAs({ 'X-Forwarded-For': '1.2.3.4, 23.239.51.105' });
	check(faked === '23.239.51.105', `an address faked in front of theirs is ignored (${faked})`);
	const bot = await seenAs({ 'X-Forwarded-For': '127.0.0.1' });
	check(bot === '127.0.0.1', `our bots, local and saying so, stay 127.0.0.1 (${bot})`);

	console.log(failed ? `${failed} failed` : 'all passed');
	cleanup();
	process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
