'use strict';
/**
 * Every ladderable format finds a bot.
 *
 * Boots a local server and, as a player with no rung picked, presses Battle! in
 * every format the ladder offers (two-player ones; multi battles need four
 * people). Each search must be answered by a bot within the timeout; the battle
 * is forfeited straight away. Nobody plays Gen 5 NU, and it should still work.
 *
 *   node test/ladder-sweep.test.js            # all of them
 *   node test/ladder-sweep.test.js gen5nu     # just these (comma-separated)
 *
 * Also reports the bot process's memory at the end, because building teams for
 * every format in one sitting is the worst case for it.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');
const { Dex } = require('pokemon-showdown');

const PORT = Number(process.env.TEST_PORT) || 8794;
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-sweep-'));
const WAIT_MS = Number(process.env.SWEEP_WAIT_MS || 30000);
const only = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

(async () => {
	const root = path.join(__dirname, '..');
	let log = '';
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: { ...process.env, ...(process.env.SERVER_NODE_OPTIONS ? { NODE_OPTIONS: process.env.SERVER_NODE_OPTIONS } : {}), PORT: String(PORT), PS_REAL_ACCOUNTS: '0', PS_NO_RP_BOT: '1', PS_LADDER_LOGIN_SPACING_MS: '1500', PS_CACHE_DIR: CACHE },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	server.stdout.on('data', d => { log += d; for (const l of String(d).split('\n')) if (/bots exited|restarting fresh/.test(l)) console.log('    ' + l.trim()); });
	server.stderr.on('data', d => { log += d; });
	server.on('exit', code => console.log(`!!! server process exited with code ${code}\n${log.split('\n').filter(l => /heap|FATAL|memory/i.test(l)).slice(-5).join('\n')}`));
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);
	await waitForPort(PORT);
	await sleep(15000);

	// What the server offers on the ladder: its own laddered formats, plus every
	// challenge format outside the RP sections (everyTierLadderable in the config).
	const formats = Dex.formats.all()
		.filter(f => f.effectType === 'Format' && f.name && (f.searchShow || (f.challengeShow && !/^RP/.test(f.section || ''))))
		.filter(f => (f.playerCount || 2) === 2 && !/multi|freeforall|ffa/i.test(f.gameType || ''))
		.map(f => f.id)
		.filter(id => !only.length || only.includes(id));

	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	const name = `Sweep${Math.floor(Math.random() * 9000 + 1000)}`;
	let named = false;
	let battleRoom = null;
	let opponent = null;
	let popup = '';
	ws.on('message', data => {
		const lines = String(data).split('\n');
		const room = lines[0].startsWith('>') ? lines.shift().slice(1).trim() : '';
		for (const line of lines) {
			const parts = line.slice(1).split('|');
			if (parts[0] === 'challstr') ws.send(`|/trn ${name},0,`);
			if (parts[0] === 'updateuser' && toId(parts[1]) === toId(name)) named = true;
			if (parts[0] === 'popup') popup = parts.slice(1).join('|').slice(0, 160);
			if (room.startsWith('battle-') && parts[0] === 'player' && parts[2] && toId(parts[2]) !== toId(name)) {
				battleRoom = room;
				opponent = parts[2];
			}
		}
	});
	await new Promise(r => ws.once('open', r));
	for (let i = 0; i < 40 && !named; i++) await sleep(250);
	ws.send('|/bot anyone');

	const { TeamBuilder } = require('../src/teambuilder');
	const builder = new TeamBuilder();
	const results = [];
	for (const format of formats) {
		battleRoom = null; opponent = null; popup = '';
		let team = 'null';
		try {
			if (builder.needsTeam(format)) {
				try { await builder.prefetch(format); } catch (e) {}
				team = builder.build(format);
			}
		} catch (e) {
			results.push({ format, ok: false, why: `player team: ${e.message}` });
			continue;
		}
		ws.send(`|/utm ${team}`);
		ws.send(`|/search ${format}`);
		const t0 = Date.now();
		while (Date.now() - t0 < WAIT_MS && !battleRoom) await sleep(200);
		const secs = ((Date.now() - t0) / 1000).toFixed(1);
		if (battleRoom) {
			results.push({ format, ok: true, why: `${opponent} in ${secs}s` });
			ws.send(`${battleRoom}|/forfeit`);
			await sleep(800);
			ws.send(`|/leave ${battleRoom}`);
		} else {
			results.push({ format, ok: false, why: `no bot in ${secs}s${popup ? ` (popup: ${popup})` : ''}` });
			ws.send(`|/cancelsearch ${format}`);
		}
		console.log(`${battleRoom ? 'ok  ' : 'FAIL'} ${format}: ${results[results.length - 1].why}`);
		if (results.length % 20 === 0) {
			try {
				const w = JSON.parse(fs.readFileSync(path.join(CACHE, 'velvet-bots.json'), 'utf8'));
				console.log(`    [memory after ${results.length}] bot process rss ${(w.rss / 1048576).toFixed(0)}MB heap ${(w.heapUsed / 1048576).toFixed(0)}MB`);
			} catch (e) {}
		}
		await sleep(300);
	}

	let memory = '';
	try {
		const w = JSON.parse(fs.readFileSync(path.join(CACHE, 'velvet-bots.json'), 'utf8'));
		memory = `bot process rss ${(w.rss / 1048576).toFixed(0)}MB, heap ${(w.heapUsed / 1048576).toFixed(0)}MB`;
	} catch (e) { memory = 'memory note not found'; }
	const bad = results.filter(r => !r.ok);
	console.log(`\n${results.length - bad.length}/${results.length} formats found a bot. ${memory}`);
	if (bad.length) {
		console.log('Failed:\n' + bad.map(r => `  ${r.format}: ${r.why}`).join('\n'));
		console.log('--- server log (errors) ---\n' + log.split('\n').filter(l => /error|cannot|fail/i.test(l)).slice(-25).join('\n'));
	}
	ws.close();
	cleanup();
	process.exit(bad.length ? 1 : 0);
})();
