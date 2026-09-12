'use strict';
/**
 * Does a player actually receive the lobby format picker, and do its buttons
 * carry real challenge commands? Boots the server, joins as a player, reads the
 * lobby introduction, and checks a sample of the formats it offers.
 *
 *   node test/lobby.test.js
 */

const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');
const { Dex } = require('pokemon-showdown');

const PORT = Number(process.env.TEST_PORT) || 8791;
const BOT = 'Velvet Bunny';

function waitForPort(port, timeoutMs = 90000) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const s = net.connect(port, '127.0.0.1');
			s.once('connect', () => { s.destroy(); resolve(); });
			s.once('error', () => {
				s.destroy();
				if (Date.now() > deadline) reject(new Error(`port ${port} never opened`));
				else setTimeout(attempt, 500);
			});
		};
		attempt();
	});
}

(async () => {
	const root = path.join(__dirname, '..');
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
	});
	let log = '';
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) { /* gone */ } };
	process.on('exit', cleanup);
	const fail = m => {
		console.log(`FAIL: ${m}`);
		console.log('--- server log (tail) ---');
		console.log(log.split('\n').slice(-20).join('\n'));
		cleanup(); process.exit(1);
	};

	try { await waitForPort(PORT); } catch (e) { return fail(e.message); }
	// Give the bot time to log in, join the lobby and publish the intro.
	await new Promise(r => setTimeout(r, 12000));

	let intro = '';
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
	ws.on('message', data => {
		for (const block of String(data).split('\n\n')) {
			const lines = block.split('\n');
			let room = '';
			if (lines[0] && lines[0].startsWith('>')) room = lines.shift().slice(1).trim();
			for (const line of lines) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'challstr') ws.send('|/trn LobbyWatcher,0,');
				if (parts[0] === 'updateuser' && parts[2] === '1') ws.send('|/join lobby');
				// The intro arrives as part of the room's init payload. Showdown
				// omits the ">roomid" line for the lobby, so an empty room is it.
				const where = room || 'lobby';
				if (where === 'lobby' && /Battle the house bot/.test(line)) intro += line;
			}
		}
	});

	await new Promise(r => setTimeout(r, 8000));
	ws.close();

	if (!intro) return fail('the player never received a lobby panel');

	let pass = 0, bad = 0;
	const check = (name, ok) => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { bad++; console.log(`  FAIL ${name}`); } };

	console.log(`\nlobby panel received (${intro.length} bytes)`);
	check('offers a difficulty control', /difficulty (easy|normal|hard|champion)/.test(intro));
	check('has challenge buttons', /\/challenge Velvet Bunny, /.test(intro));

	// Every format id the panel offers must be one the server really has.
	const ids = [...intro.matchAll(/\/challenge Velvet Bunny, ([a-z0-9]+)/g)].map(m => m[1]);
	const unique = [...new Set(ids)];
	const unknown = unique.filter(id => !Dex.formats.get(id).exists);
	console.log(`  panel offers ${unique.length} formats`);
	check('every offered format exists on this server', unknown.length === 0);
	if (unknown.length) console.log('    unknown:', unknown.slice(0, 5).join(', '));

	const randoms = unique.filter(id => Dex.formats.get(id).team);
	check('includes team-building formats', unique.some(id => !Dex.formats.get(id).team));
	check('includes instant (random) formats', randoms.length > 0);
	check('offers a broad list, not a token few', unique.length > 50);
	check('marks the instant ones', /&#9889;/.test(intro));

	console.log(`\n=== ${pass} passed, ${bad} failed`);
	cleanup();
	process.exit(bad ? 1 : 0);
})();
