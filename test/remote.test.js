'use strict';
/**
 * End-to-end against a DEPLOYED server: log in as a player over the public
 * WebSocket, set a difficulty, challenge the bot, and play the battle out.
 *
 * This is the only check that proves the hosted thing works - local tests say
 * nothing about whether the deploy booted, the bot logged in, or the platform
 * allows WebSockets.
 *
 *   node test/remote.test.js wss://host/showdown/websocket [format]
 */

const WebSocket = require('ws');
const { TeamBuilder } = require('../src/teambuilder');

const URL = process.argv[2] || 'wss://velvet-bunny-showdown.onrender.com/showdown/websocket';
const FORMAT = process.argv[3] || 'gen9randombattle';
const BOT = process.env.PS_BOT_NAME || 'Velvet Bunny';
const NAME = 'TestTrainer' + Math.floor(Math.random() * 900 + 100);

const needsTarget = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);

class Player {
	constructor() {
		this.errors = [];
		this.battleRoom = null;
		this.result = null;
		this.sawBox = false;
		this.ready = false;
		this.turns = 0;
	}

	connect() {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(URL, { handshakeTimeout: 30000 });
			this.ws.on('open', resolve);
			this.ws.on('error', reject);
			this.ws.on('message', d => { for (const b of String(d).split('\n\n')) this.onData(b); });
		});
	}

	send(l) { this.ws.send(l); }

	onData(block) {
		const lines = block.split('\n');
		let room = '';
		if (lines[0] && lines[0].startsWith('>')) room = lines.shift().slice(1).trim();
		for (const line of lines) {
			if (!line.startsWith('|')) continue;
			const parts = line.slice(1).split('|');
			if (parts[0] === 'challstr') this.send(`|/trn ${NAME},0,`);
			if (parts[0] === 'updateuser' && parts[2] === '1' && !this.ready) { this.ready = true; this.onReady && this.onReady(); }
			if (parts[0] === 'popup') this.errors.push(`popup: ${parts.slice(1).join('|').slice(0, 200)}`);
			if (parts[0] === 'pm' && /<button/i.test(line)) this.sawBox = true;

			if (room.startsWith('battle-')) {
				this.battleRoom = room;
				if (parts[0] === 'error') this.errors.push(`battle error: ${parts.slice(1).join('|')}`);
				if (parts[0] === 'turn') this.turns = +parts[1] || this.turns;
				if (parts[0] === 'request') {
					const raw = parts.slice(1).join('|');
					if (raw) this.respond(room, JSON.parse(raw));
				}
				if (parts[0] === 'win' || parts[0] === 'tie') {
					this.result = parts[0] === 'win' ? parts[1].trim() : 'tie';
					this.done && this.done();
				}
			}
		}
	}

	respond(room, request) {
		if (request.wait) return;
		let choice = 'default';
		if (request.forceSwitch) {
			const opts = request.side.pokemon.map((p, i) => ({ p, i: i + 1 }))
				.filter(({ p }) => !p.active && !/fnt/.test(p.condition));
			choice = opts.length ? `switch ${opts[0].i}` : 'default';
		} else if (request.active) {
			const doubles = request.active.length > 1;
			choice = request.active.map((active, i) => {
				const entry = request.side.pokemon[i];
				if (!entry || /fnt/.test(entry.condition)) return 'pass';
				const moves = (active.moves || []).map((m, n) => ({ m, n: n + 1 })).filter(({ m }) => !m.disabled);
				if (!moves.length) return 'move 1';
				const f = moves[0];
				return doubles && needsTarget.has(f.m.target) ? `move ${f.n} 1` : `move ${f.n}`;
			}).join(', ');
		}
		this.send(`${room}|/choose ${choice}|${request.rqid || ''}`);
	}
}

(async () => {
	const t0 = Date.now();
	const p = new Player();
	console.log(`connecting to ${URL}`);
	try {
		await p.connect();
	} catch (e) {
		console.log(`FAIL: could not open the socket (${e.message})`);
		process.exit(1);
	}
	console.log(`connected in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

	await new Promise(r => { p.onReady = r; setTimeout(r, 20000); });
	if (!p.ready) { console.log('FAIL: could not log in'); process.exit(1); }
	console.log(`logged in as ${NAME}`);

	p.send(`|/pm ${BOT}, hi`);
	await new Promise(r => setTimeout(r, 4000));
	p.send(`|/pm ${BOT}, difficulty champion`);
	await new Promise(r => setTimeout(r, 2000));
	console.log(`difficulty box delivered: ${p.sawBox}`);

	const builder = new TeamBuilder();
	let team = null;
	if (builder.needsTeam(FORMAT)) {
		try { await builder.prefetch(FORMAT); } catch (e) { /* offline */ }
		team = builder.build(FORMAT);
	}
	p.send(`|/utm ${team === null ? 'null' : team}`);
	p.send(`|/challenge ${BOT}, ${FORMAT}`);
	console.log(`challenged in ${FORMAT}`);

	const finished = await Promise.race([
		new Promise(r => { p.done = () => r(true); }),
		new Promise(r => setTimeout(() => r(false), 240000)),
	]);

	if (!p.battleRoom) { console.log(`FAIL: no battle started. ${p.errors.join(' | ') || 'no errors reported'}`); process.exit(1); }
	if (!finished) { console.log(`FAIL: battle ${p.battleRoom} stalled at turn ${p.turns}. ${p.errors.join(' | ') || 'no errors'}`); process.exit(1); }
	if (p.errors.length) { console.log(`FAIL: ${p.errors.join(' | ')}`); process.exit(1); }

	console.log(`battle finished in ${p.turns} turns, winner: ${p.result}`);
	console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
	console.log('PASS');
	process.exit(0);
})();
