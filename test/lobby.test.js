'use strict';
/**
 * Does a player actually receive the lobby format picker, and do its buttons
 * carry real challenge commands? Joins as a player, reads the lobby
 * introduction, and checks the formats it offers.
 *
 *   node test/lobby.test.js                                  # boot one locally
 *   node test/lobby.test.js wss://host/showdown/websocket    # check a live one
 */

const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');
const { Dex } = require('pokemon-showdown');
const { BattleAI } = require('../src/ai');

const PORT = Number(process.env.TEST_PORT) || 8791;
const REMOTE = process.argv[2] || '';   // when given, test a deployed server instead
const BOT = process.env.PS_BOT_NAME || 'Velvet Bunny';

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
	let log = '';
	let cleanup = () => {};

	if (!REMOTE) {
		const root = path.join(__dirname, '..');
		/*
		 * A local server that will let this test have a name.
		 *
		 * The real server checks names against Showdown's login server, and a
		 * `/trn` with no assertion is refused - so this watcher stayed a guest,
		 * never joined the lobby, and reported that the panel had not been sent.
		 * The panel was fine; the test could not get in the door. It went that way
		 * the day real accounts became the default and stayed that way, which is
		 * the argument for the test saying which server it wants rather than
		 * inheriting whatever the environment happens to hold.
		 */
		const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
			cwd: root,
			env: { ...process.env, PORT: String(PORT), PS_REAL_ACCOUNTS: '0' },
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		server.stdout.on('data', d => { log += d; });
		server.stderr.on('data', d => { log += d; });
		cleanup = () => { try { server.kill(); } catch (e) { /* already gone */ } };
		process.on('exit', cleanup);
	}

	const fail = m => {
		console.log(`FAIL: ${m}`);
		if (log) {
			console.log('--- server log (tail) ---');
			console.log(log.split('\n').slice(-20).join('\n'));
		}
		cleanup();
		process.exit(1);
	};

	if (!REMOTE) {
		try { await waitForPort(PORT); } catch (e) { return fail(e.message); }
		// Give the bot time to log in, join the lobby and publish the intro.
		await new Promise(r => setTimeout(r, 12000));
	}

	const target = REMOTE || `ws://127.0.0.1:${PORT}/showdown/websocket`;
	console.log(`checking ${target}`);

	let intro = '';
	const ws = new WebSocket(target, { handshakeTimeout: 30000 });
	try {
		await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
	} catch (e) {
		return fail(`could not connect: ${e.message}`);
	}

	ws.on('message', data => {
		const frame = String(data);
		const lines = frame.split('\n');
		let room = '';
		if (lines[0] && lines[0].startsWith('>')) { room = lines.shift().slice(1).trim(); }
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			const parts = line.slice(1).split('|');
			if (parts[0] === 'challstr') ws.send(`|/trn LobbyWatcher${Math.floor(Math.random() * 900 + 100)},0,`);
			if (parts[0] === 'updateuser' && parts[2] === '1') ws.send('|/join lobby');
			// Showdown omits the ">roomid" line for the default room, so an empty
			// room here means the lobby rather than "no room".
			const where = room || 'lobby';
			if (where === 'lobby' && /Battle the house bot/.test(line)) intro += line;
		}
	});

	await new Promise(r => setTimeout(r, REMOTE ? 12000 : 8000));
	ws.close();

	if (!intro) return fail('the player never received a lobby panel');

	let pass = 0, bad = 0;
	const check = (name, ok) => {
		if (ok) { pass++; console.log(`  ok   ${name}`); } else { bad++; console.log(`  FAIL ${name}`); }
	};

	console.log(`\nlobby panel received (${intro.length} bytes)`);
	// `/bot <difficulty>`, not `/difficulty` - the buttons were moved onto a
	// command the server also hears, because the ladder is matched server-side
	// and a difficulty only this process knew about was ignored there. The check
	// asks for whatever difficulties the bot actually offers rather than a list
	// written out here, so adding a rung does not quietly fail this.
	const rungs = BattleAI.difficulties();
	check('offers a difficulty control',
		rungs.length > 1 && rungs.every(d => intro.includes(`/bot ${d}`)));
	check('has challenge buttons', new RegExp(`/challenge ${BOT}, `).test(intro));

	// Every format id the panel offers must be one the server really has.
	const ids = [...intro.matchAll(new RegExp(`/challenge ${BOT}, ([a-z0-9]+)`, 'g'))].map(m => m[1]);
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
