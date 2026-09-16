'use strict';
/**
 * The ladder rings the right bot, in any format, only when somebody is waiting.
 *
 * Boots a local server, then as a player:
 *   - no bot is searching anything before anyone presses Battle!
 *   - /bot normal + Battle! in gen9ou (a format no bot used to queue for) is
 *     matched against Bunny Normal
 *   - /bot hard, then Battle! again: matched against Bunny Hard (the difficulty
 *     switch works)
 *   - no preference in Random Battle: matched against some rung
 *   - /bot pvp: no bot comes
 *
 *   node test/ladder-demand.test.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 8793;
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-demand-'));

function waitForPort(port, timeoutMs = 120000) {
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let passed = 0;
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };

(async () => {
	const root = path.join(__dirname, '..');
	let log = '';
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: {
			...process.env, PORT: String(PORT), PS_REAL_ACCOUNTS: '0', PS_NO_RP_BOT: '1',
			PS_LADDER_LOGIN_SPACING_MS: '1500', PS_CACHE_DIR: CACHE, PS_DEBUG_SUMMON: process.env.PS_DEBUG_SUMMON || '',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);
	const bail = msg => {
		console.log(`FAIL: ${msg}\n--- server log (tail) ---\n${log.split('\n').slice(-30).join('\n')}`);
		cleanup();
		process.exit(1);
	};

	try { await waitForPort(PORT); } catch (e) { return bail(e.message); }
	await sleep(15000);   // five rungs logging in, 1.5 s apart

	const status = () => {
		try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'velvet-ladder-status.json'), 'utf8')); } catch (e) { return null; }
	};
	const st = status();
	const queues = st ? Object.values(st.queues) : [];
	check(queues.length === 5 && queues.every(q => q.connected), `five rungs connected (${queues.map(q => `${q.name}:${q.connected}`).join(', ')})`);
	check(queues.every(q => !(q.searching || []).length), 'no rung is searching anything before anyone presses Battle!');

	// ---- the player
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	const name = `Tester${Math.floor(Math.random() * 9000 + 1000)}`;
	let named = false;
	const battles = [];   // { room, players: {p1, p2} }
	let lastPopup = '';
	ws.on('message', data => {
		const text = String(data);
		const lines = text.split('\n');
		const room = lines[0].startsWith('>') ? lines.shift().slice(1).trim() : '';
		for (const line of lines) {
			const parts = line.slice(1).split('|');
			if (parts[0] === 'challstr') ws.send(`|/trn ${name},0,`);
			if (parts[0] === 'updateuser' && toId(parts[1]) === toId(name)) named = true;
			if (parts[0] === 'popup') lastPopup = parts.slice(1).join('|');
			if (room.startsWith('battle-') && parts[0] === 'player' && parts[2]) {
				let b = battles.find(x => x.room === room);
				if (!b) { b = { room, players: {} }; battles.push(b); }
				b.players[parts[1]] = parts[2];
			}
		}
	});
	await new Promise(r => ws.once('open', r));
	for (let i = 0; i < 40 && !named; i++) await sleep(250);
	check(named, `logged in as ${name}`);

	const { TeamBuilder } = require('../src/teambuilder');
	const builder = new TeamBuilder();
	const opponentIn = b => Object.values(b.players).find(p => toId(p) !== toId(name));

	async function battleAgainst(format, rung, withTeam) {
		const before = battles.length;
		if (rung) ws.send(`|/bot ${rung}`);
		await sleep(500);
		if (withTeam) {
			try { await builder.prefetch(format); } catch (e) {}
			ws.send(`|/utm ${builder.build(format)}`);
		} else {
			ws.send('|/utm null');
		}
		ws.send(`|/search ${format}`);
		const t0 = Date.now();
		while (Date.now() - t0 < 60000 && battles.length === before) await sleep(250);
		const b = battles[before];
		if (b) {
			for (let i = 0; i < 20 && !opponentIn(b); i++) await sleep(100);
			ws.send(`${b.room}|/forfeit`);
			await sleep(1500);
			ws.send(`|/leave ${b.room}`);
		}
		return { battle: b, seconds: ((Date.now() - t0) / 1000).toFixed(1) };
	}

	let r = await battleAgainst('gen9ou', 'normal', true);
	check(r.battle && toId(opponentIn(r.battle)) === toId('Bunny Normal'),
		`gen9ou with /bot normal -> ${r.battle ? opponentIn(r.battle) : 'no battle'} (${r.seconds}s)${lastPopup ? ` popup: ${lastPopup}` : ''}`);

	r = await battleAgainst('gen9ou', 'hard', true);
	check(r.battle && toId(opponentIn(r.battle)) === toId('Bunny Hard'),
		`difficulty switch: gen9ou with /bot hard -> ${r.battle ? opponentIn(r.battle) : 'no battle'} (${r.seconds}s)`);

	r = await battleAgainst('gen9randombattle', 'anyone', false);
	check(r.battle && /^bunny/.test(toId(opponentIn(r.battle))),
		`no preference in Random Battle -> ${r.battle ? opponentIn(r.battle) : 'no battle'} (${r.seconds}s)`);

	// Players only: search, wait, and no bot comes.
	ws.send('|/bot pvp');
	await sleep(500);
	const before = battles.length;
	ws.send('|/utm null');
	ws.send('|/search gen9randombattle');
	await sleep(12000);
	check(battles.length === before, '/bot pvp: no bot is rung');
	ws.send('|/cancelsearch');

	await sleep(3000);
	const after = status();
	const searching = after ? Object.values(after.queues).flatMap(q => q.searching || []) : ['?'];
	check(true, `rungs still searching afterwards: ${searching.length ? searching.join(', ') : 'none'} (released after a minute idle)`);

	if (process.env.PS_DEBUG_SUMMON) console.log(log.split('\n').filter(l => /summon|rung for|matchmaking/.test(l)).join('\n'));
	console.log(`\n${passed} passed, ${failed} failed`);
	ws.close();
	cleanup();
	process.exit(failed ? 1 : 0);
})();
