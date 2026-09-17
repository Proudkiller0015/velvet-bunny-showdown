'use strict';
/**
 * Replays are saved during a battle, and the health page counts battles.
 *
 * Boots a local server, plays a battle against the bot (always move 1), and
 * checks: the health page lists the battle while it runs; a replay is saved
 * before the battle ends (the snapshot); and the finished battle is saved too.
 *
 *   node test/replay-snapshot.test.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 8795;
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-snap-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };

function waitForPort(port, timeoutMs = 120000) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const s = net.connect(port, '127.0.0.1');
			s.once('connect', () => { s.destroy(); resolve(); });
			s.once('error', () => { s.destroy(); Date.now() > deadline ? reject(new Error('no port')) : setTimeout(attempt, 500); });
		};
		attempt();
	});
}
const health = () => new Promise(resolve => {
	http.get(`http://127.0.0.1:${PORT}/velvet/health.json`, res => {
		let body = '';
		res.on('data', c => body += c);
		res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(null); } });
	}).on('error', () => resolve(null));
});

(async () => {
	const root = path.join(__dirname, '..');
	let log = '';
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: { ...process.env, PORT: String(PORT), PS_REAL_ACCOUNTS: '0', PS_NO_RP_BOT: '1', PS_LADDER: '0', PS_CACHE_DIR: CACHE,
			PS_REPLAY_SNAPSHOT_TURNS: '2', PS_REPLAY_SNAPSHOT_MS: '1500', GITHUB_TOKEN: '' },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);
	await waitForPort(PORT);
	await sleep(8000);

	const name = `Snap${Math.floor(Math.random() * 9000 + 1000)}`;
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	let named = false, room = null, ended = false, turns = 0, sawInHealth = false;
	ws.on('message', data => {
		const lines = String(data).split('\n');
		const r = lines[0].startsWith('>') ? lines.shift().slice(1).trim() : '';
		for (const line of lines) {
			const parts = line.slice(1).split('|');
			if (parts[0] === 'challstr') ws.send(`|/trn ${name},0,`);
			if (parts[0] === 'updateuser' && toId(parts[1]) === toId(name)) named = true;
			if (r.startsWith('battle-')) {
				room = r;
				if (parts[0] === 'request' && parts[1]) {
					const req = JSON.parse(parts[1]);
					if (req.teamPreview) ws.send(`${r}|/choose team 1`);
					else if (req.forceSwitch) ws.send(`${r}|/choose default`);
					// A human pace: the bot answers in milliseconds, and a whole battle
					// can otherwise finish between two snapshot checks.
					else if (req.active) setTimeout(() => ws.send(`${r}|/choose move 1`), 2500);
				}
				if (parts[0] === 'turn') { turns = Number(parts[1]); if (turns >= 8 && !ended) ws.send(`${r}|/forfeit`); }
				if (parts[0] === 'win' || parts[0] === 'tie') ended = true;
			}
		}
	});
	await new Promise(r => ws.once('open', r));
	for (let i = 0; i < 40 && !named; i++) await sleep(250);
	ws.send('|/utm null');
	ws.send('|/challenge Velvet Bunny, gen9randombattle');

	const t0 = Date.now();
	while (!ended && Date.now() - t0 < 240000) {
		await sleep(1000);
		if (room && !ended && !sawInHealth) {
			const h = await health();
			if (h && Array.isArray(h.battles) && h.battles.some(b => b.players.some(p => toId(p) === toId(name)))) sawInHealth = true;
		}
	}
	check(!!room, `a battle started (${room})`);
	check(sawInHealth, 'the health page listed the battle while it ran');
	await sleep(3000);
	// One line per save, "[replays] saved <id>" (the "in memory only" line is the same save).
	const replayLines = log.split('\n').map(l => l.trim()).filter(l => /^\[replays\] saved \S+$/.test(l));
	if (process.env.DEBUG_SNAP) console.log(log.split('\n').filter(l => /replays|snapshot|health/i.test(l)).join('\n'));
	check(replayLines.length >= 3, `the replay was saved during the battle, every 2 turns (${replayLines.length} saves in ${turns} turns)`);
	const after = await health();
	check(after && Array.isArray(after.battles) && !after.battles.some(b => b.players.some(p => toId(p) === toId(name))), 'and the finished battle is no longer counted');

	console.log(`\n${passed} passed, ${failed} failed`);
	ws.close();
	cleanup();
	process.exit(failed ? 1 : 0);
})();
