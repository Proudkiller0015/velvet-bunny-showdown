'use strict';
/**
 * /rank and the ladder medals.
 *
 * Boots a local server, seeds a ladder row for a test player, and checks that
 * /rank answers with Elo, GXE, ladder position and record - and that a battle
 * sends the |badge| line the client draws beside the avatar for the top three.
 *
 *   node test/rank.test.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 8799;
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-rank-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
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

(async () => {
	const root = path.join(__dirname, '..');
	/*
	 * A challenge is unrated and never reaches the ladder, so the ladder this test
	 * reads is written first - the same file the server keeps - with our player on
	 * top and two below. The medals and the position are read from exactly this.
	 */
	const laddersDir = path.join(root, 'node_modules', 'pokemon-showdown', 'config', 'ladders');
	fs.mkdirSync(laddersDir, { recursive: true });
	const ladderFile = path.join(laddersDir, 'gen9randombattle.tsv');
	const savedLadder = fs.existsSync(ladderFile) ? fs.readFileSync(ladderFile, 'utf8') : null;
	const restoreLadder = () => {
		try {
			if (savedLadder === null) fs.unlinkSync(ladderFile);
			else fs.writeFileSync(ladderFile, savedLadder);
		} catch (e) { /* nothing to put back */ }
	};
	process.on('exit', restoreLadder);
	const name = `Rank${Math.floor(Math.random() * 9000 + 1000)}`;
	const when = new Date().toString();
	fs.writeFileSync(ladderFile, `${[
		['Elo', 'Username', 'W', 'L', 'T', 'Last update'].join('\t'),
		[1680, name, 20, 4, 0, when].join('\t'),
		[1500, 'Bunny Champion', 10, 10, 0, when].join('\t'),
		[1400, 'Bunny Hard', 5, 12, 0, when].join('\t'),
	].join('\n')}\n`);

	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: { ...process.env, PORT: String(PORT), PS_REAL_ACCOUNTS: '0', PS_NO_RP_BOT: '1', PS_LADDER: '0', PS_CACHE_DIR: CACHE, GITHUB_TOKEN: '' },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let log = '';
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);
	await waitForPort(PORT);
	await sleep(8000);

	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	const lines = [];
	let named = false;
	ws.on('message', data => {
		const text = String(data);
		lines.push(text);
		for (const line of text.split('\n')) {
			if (line.startsWith('|challstr|')) ws.send(`|/trn ${name},0,`);
			if (line.startsWith('|updateuser|') && line.toLowerCase().includes(name.toLowerCase())) named = true;
		}
	});
	await new Promise(r => ws.once('open', r));
	for (let i = 0; i < 60 && !named; i++) await sleep(250);

	// Nothing played yet.
	lines.length = 0;
	ws.send(`|/rank Nobody${Math.floor(Math.random() * 999)}`);
	await sleep(1500);
	check(lines.join('\n').includes('has not played a ladder game here yet'), 'somebody with no games is told so');

	// A battle against the house bot puts both of us on the ladder, and the badge line
	// goes out for whoever is in the top three of that format.
	lines.length = 0;
	ws.send('|/utm null');
	ws.send('|/challenge Velvet Bunny, gen9randombattle');
	for (let i = 0; i < 60 && !lines.join('').includes('|request|'); i++) await sleep(250);
	const room = (/>(battle-[a-z0-9-]+)/.exec(lines.join('\n')) || [])[1];
	check(!!room, `a battle started (${room})`);
	// Forfeit: the point is the ladder row, not the game.
	if (room) ws.send(`${room}|/forfeit`);
	await sleep(4000);

	lines.length = 0;
	ws.send('|/rank');
	await sleep(2000);
	const answer = lines.join('\n');
	check(/Elo/.test(answer) && /GXE/.test(answer), 'the table has Elo and GXE');
	check(/Rank<\/th>/.test(answer) || /#1/.test(answer), 'and where they sit on the ladder');
	check(/Random Battle/i.test(answer), 'for the format just played');

	// The badge: a second battle, now that the ladder has rows.
	lines.length = 0;
	ws.send('|/utm null');
	ws.send('|/challenge Velvet Bunny, gen9randombattle');
	for (let i = 0; i < 60 && !lines.join('').includes('|request|'); i++) await sleep(250);
	await sleep(2500);
	const second = lines.join('\n');
	check(/\|badge\|p\d\|(gold|silver|bronze)\|gen9randombattle\|/.test(second), `the top three wear their medal in battle${/\|badge\|/.test(second) ? '' : ' (no badge line seen)'}`);
	const room2 = (/>(battle-[a-z0-9-]+)/.exec(second) || [])[1];
	if (room2) ws.send(`${room2}|/forfeit`);
	await sleep(1500);

	if (failed && process.env.DEBUG_RANK) console.log(answer.slice(-3000), '\n---\n', log.slice(-2000));
	console.log(`\n${passed} passed, ${failed} failed`);
	ws.close();
	cleanup();
	process.exit(failed ? 1 : 0);
})();
