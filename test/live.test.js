'use strict';
/**
 * End-to-end: boot the real server, let the bot connect, then log in as a
 * player, set a difficulty, challenge the bot, and play the battle out.
 *
 * This is the only test that proves the whole pipeline - config, server, login,
 * challenge, team validation on the server side, and the battle protocol.
 *
 *   node test/live.test.js [format]
 */

const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');
const { Teams } = require('pokemon-showdown');
const { TeamBuilder } = require('../src/teambuilder');

const FORMAT = process.argv[2] || 'gen9ou';
const PORT = Number(process.env.TEST_PORT) || 8123;

function waitForPort(port, timeoutMs = 90000) {
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

/** A scripted human: joins, challenges the bot, and clicks the first legal move. */
class Player {
	constructor(name, url) {
		this.name = name;
		this.url = url;
		this.events = [];
		this.battleRoom = null;
		this.done = null;
		this.result = null;
		this.sawInfobox = false;
		this.errors = [];
	}

	connect() {
		return new Promise(resolve => {
			this.ws = new WebSocket(this.url);
			this.ws.on('open', () => resolve());
			this.ws.on('message', data => {
				for (const block of String(data).split('\n\n')) this.onData(block);
			});
		});
	}

	send(line) { this.ws.send(line); }

	onData(block) {
		const lines = block.split('\n');
		let roomid = '';
		if (lines[0] && lines[0].startsWith('>')) roomid = lines.shift().slice(1).trim();
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			const parts = line.slice(1).split('|');
			this.events.push([roomid, parts[0], parts.slice(1).join('|').slice(0, 120)]);

			if (parts[0] === 'challstr') this.send(`|/trn ${this.name},0,`);
			if (parts[0] === 'updateuser' && parts[2] === '1' && !this.ready) { this.ready = true; this.onReady && this.onReady(); }
			if (parts[0] === 'popup') this.errors.push(`popup: ${parts.slice(1).join('|')}`);
			if (parts[0] === 'pm' && /pminfobox|<button/i.test(line)) this.sawInfobox = true;
			if (parts[0] === 'raw' && /button/i.test(line)) this.sawInfobox = true;

			if (roomid.startsWith('battle-')) {
				this.battleRoom = roomid;
				if (parts[0] === 'error') this.errors.push(`battle error: ${parts.slice(1).join('|')}`);
				if (parts[0] === 'request') {
					const raw = parts.slice(1).join('|');
					if (raw) this.respond(roomid, JSON.parse(raw));
				}
				if (parts[0] === 'win' || parts[0] === 'tie') {
					this.result = parts[0] === 'win' ? parts[1].trim() : 'tie';
					this.done && this.done();
				}
			}
		}
	}

	respond(roomid, request) {
		if (request.wait) return;
		let choice = 'default';
		if (request.teamPreview) choice = 'default';
		else if (request.forceSwitch) {
			const options = request.side.pokemon.map((p, i) => ({ p, i: i + 1 }))
				.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
			choice = options.length ? `switch ${options[0].i}` : 'default';
		} else if (request.active) {
			const doubles = request.active.length > 1;
			const needsTarget = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
			choice = request.active.map((active, index) => {
				const entry = request.side.pokemon[index];
				if (!entry || /fnt/.test(entry.condition)) return 'pass';
				const moves = (active.moves || []).map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => !m.disabled);
				if (!moves.length) return 'move 1';
				const first = moves[0];
				return doubles && needsTarget.has(first.m.target) ? `move ${first.n} 1` : `move ${first.n}`;
			}).join(', ');
		}
		this.ws.send(`${roomid}|/choose ${choice}|${request.rqid || ''}`);
	}
}

(async () => {
	process.env.PORT = String(PORT);
	const root = path.join(__dirname, '..');
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: { ...process.env, PORT: String(PORT) },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let serverLog = '';
	server.stdout.on('data', d => { serverLog += d; });
	server.stderr.on('data', d => { serverLog += d; });

	const cleanup = () => { try { server.kill(); } catch (e) { /* gone */ } };
	process.on('exit', cleanup);

	const fail = (msg) => {
		console.log(`FAIL: ${msg}`);
		console.log('--- server log (tail) ---');
		console.log(serverLog.split('\n').slice(-25).join('\n'));
		cleanup();
		process.exit(1);
	};

	try {
		await waitForPort(PORT);
	} catch (e) {
		return fail(e.message);
	}
	console.log('server is up');
	// Give the bot a moment to log in.
	await new Promise(r => setTimeout(r, 4000));

	const url = `ws://127.0.0.1:${PORT}/showdown/websocket`;
	const player = new Player('TestTrainer', url);
	await player.connect();
	await new Promise(resolve => { player.onReady = resolve; setTimeout(resolve, 8000); });
	if (!player.ready) return fail('player could not log in');
	console.log('player logged in');

	// Ask for the difficulty picker, then set one.
	player.send(`|/pm Velvet Bunny, hi`);
	await new Promise(r => setTimeout(r, 2500));
	console.log(`difficulty box shown: ${player.sawInfobox}`);
	player.send(`|/pm Velvet Bunny, difficulty champion`);
	await new Promise(r => setTimeout(r, 1500));

	// Challenge with a real, validated team.
	const builder = new TeamBuilder();
	try { await builder.prefetch(FORMAT); } catch (e) { /* offline */ }
	const team = builder.needsTeam(FORMAT) ? builder.build(FORMAT) : null;
	player.send(`|/utm ${team === null ? 'null' : team}`);
	player.send(`|/challenge Velvet Bunny, ${FORMAT}`);
	console.log(`challenged in ${FORMAT}`);

	const finished = await Promise.race([
		new Promise(resolve => { player.done = () => resolve(true); }),
		new Promise(resolve => setTimeout(() => resolve(false), 180000)),
	]);

	if (!player.battleRoom) {
		console.log('--- last protocol events seen by the player ---');
		for (const e of player.events.slice(-30)) console.log('  ', JSON.stringify(e));
		return fail(`no battle started. errors: ${player.errors.join(' | ') || 'none'}`);
	}
	if (!finished) return fail(`battle started (${player.battleRoom}) but did not finish in time. errors: ${player.errors.join(' | ') || 'none'}`);
	if (player.errors.length) return fail(`battle errors: ${player.errors.join(' | ')}`);

	console.log(`battle finished, winner: ${player.result}`);
	console.log(`difficulty picker delivered: ${player.sawInfobox}`);
	console.log('PASS');
	cleanup();
	process.exit(0);
})();
