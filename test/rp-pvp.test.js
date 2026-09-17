'use strict';
/**
 * RP battles between players are moderated like encounters (Patch 1.5).
 *
 * Boots a local server with a throwaway RP key, pushes a bag table for two
 * players the way the Discord bot does, and plays [Gen 9] RP Battle between
 * them: a team with a Pokémon the character doesn't own is called off; a team
 * from the box starts, each player is told what applies to them, and a locked
 * gimmick is refused.
 *
 *   node test/rp-pvp.test.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { Teams } = require('pokemon-showdown');

const PORT = Number(process.env.TEST_PORT) || 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-pvp-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
// How both sides key a battle that counts: the two Showdown ids, sorted.
const id = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pair = (a, b) => [id(a), id(b)].sort().join('-');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const signed = payload => {
	const bytes = Buffer.from(JSON.stringify({ ...payload, at: Date.now() }));
	return { payload: bytes.toString('base64'), sig: crypto.sign(null, bytes, privateKey).toString('base64') };
};

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

const mon = (species, level, moves) => ({ species, level, moves, ability: '', evs: {}, ivs: {} });

/** A player on the websocket: a name, a log of everything said to it, and send(). */
function player(name) {
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	const p = { name, id: name.toLowerCase(), ws, lines: [], room: null, named: false, requests: [] };
	ws.on('message', data => {
		const lines = String(data).split('\n');
		const room = lines[0].startsWith('>') ? lines.shift().slice(1).trim() : '';
		for (const line of lines) {
			p.lines.push(`${room} ${line}`);
			if (line.startsWith('|challstr|')) ws.send(`|/trn ${name},0,`);
			if (line.startsWith('|updateuser|') && line.toLowerCase().includes(p.id)) p.named = true;
			if (room.startsWith('battle-')) p.room = room;
			if (room.startsWith('battle-') && line.startsWith('|request|') && line.length > 9) p.requests.push(JSON.parse(line.slice(9)));
			if (line.startsWith('|pm|') && line.includes('/challenge')) p.challenged = true;
		}
	});
	p.send = text => ws.send(text);
	p.said = re => p.lines.some(l => re.test(l));
	return p;
}

async function battle(a, b, teamA, teamB) {
	a.lines.length = 0; b.lines.length = 0; a.room = b.room = null; a.requests.length = 0; b.requests.length = 0; b.challenged = false;
	a.send(`|/utm ${Teams.pack(teamA)}`);
	a.send(`|/challenge ${b.name}, gen9rpbattle`);
	for (let i = 0; i < 40 && !b.challenged; i++) await sleep(250);
	b.send(`|/utm ${Teams.pack(teamB)}`);
	b.send(`|/accept ${a.name}`);
	for (let i = 0; i < 40 && !(a.room && b.room); i++) await sleep(250);
	await sleep(2500);
	// Team preview: lead with the first.
	for (const p of [a, b]) {
		const preview = p.requests.find(r => r.teamPreview);
		if (preview && p.room) p.send(`${p.room}|/choose team 1|${preview.rqid}`);
	}
	await sleep(2000);
}

(async () => {
	const root = path.join(__dirname, '..');
	let log = '';
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: {
			...process.env, PORT: String(PORT), PS_REAL_ACCOUNTS: '0', PS_NO_RP_BOT: '1', PS_LADDER: '0', PS_CACHE_DIR: CACHE, GITHUB_TOKEN: '',
			RP_ENCOUNTER_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);
	await waitForPort(PORT);
	await sleep(8000);

	const suffix = Math.floor(Math.random() * 9000 + 1000);
	const ann = player(`PvpAnn${suffix}`);
	const bob = player(`PvpBob${suffix}`);
	for (let i = 0; i < 60 && !(ann.named && bob.named); i++) await sleep(250);

	const res = await fetch(`${BASE}/rp/bags`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(signed({ players: [
			{ showdown: ann.name, character: 'Ann', npc: false, items: { potion: 2 }, badges: 0, gimmicks: { mega: false, zmove: false, dynamax: false, tera: false }, box: [['Pikachu', 30, 0, 0], ['Chansey', 30, 0, 0]] },
			{ showdown: bob.name, character: 'Cynthia', npc: true, items: {} },
		], matches: [pair(ann.name, bob.name)] })),
	});
	const pushed = await res.json().catch(() => ({}));
	check(pushed.ok && pushed.players === 2 && pushed.matches === 1, `the bag table with boxes and the agreed match is accepted (${JSON.stringify(pushed)})`);

	// Ann brings a Garchomp she doesn't own: called off.
	await battle(ann, bob, [mon('Pikachu', 30, ['Thunderbolt']), mon('Garchomp', 30, ['Earthquake'])], [mon('Mewtwo', 100, ['Psystrike'])]);
	check(ann.said(/called off/) && ann.said(/Garchomp/), 'a team with a Pokémon the character does not own is called off, and says which');

	// A legal team: the battle runs, each side is told what applies to them.
	await battle(ann, bob, [mon('Pikachu', 30, ['Thunderbolt']), mon('Chansey', 30, ['Pound'])], [mon('Mewtwo', 100, ['Psystrike'])]);
	check(!ann.said(/called off/), 'a team from the box is not called off');
	check(ann.said(/battling as <b>Ann<\/b>/) && ann.said(/2× Potion/) && ann.said(/Locked until the story/), 'the player is told their character, items and locks');
	check(bob.said(/battling as the NPC <b>Cynthia<\/b>/), 'the NPC is told it battles with any team');

	// Terastallizing without a Tera Orb is refused.
	for (let i = 0; i < 20 && !ann.requests.some(r => r.active); i++) await sleep(250);
	const req = ann.requests.filter(r => r.active).pop();
	if (req && ann.room) {
		ann.send(`${ann.room}|/choose move 1 terastallize|${req.rqid}`);
		await sleep(1500);
		check(ann.said(/can't Terastallize without a Tera Orb/), 'a locked gimmick is refused with the reason');
	} else {
		check(false, 'the battle asked Ann for a move');
	}

	// Nobody agreed to this one on Discord: a friendly, so the same illegal team is fine.
	const again = await fetch(`${BASE}/rp/bags`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(signed({ players: [
			{ showdown: ann.name, character: 'Ann', npc: false, items: { potion: 2 }, badges: 0, gimmicks: { mega: false, zmove: false, dynamax: false, tera: false }, box: [['Pikachu', 30, 0, 0], ['Chansey', 30, 0, 0]] },
			{ showdown: bob.name, character: 'Cynthia', npc: true, items: {} },
		], matches: [] })),
	});
	check((await again.json().catch(() => ({}))).matches === 0, 'the agreed match can be taken away again');
	await battle(ann, bob, [mon('Pikachu', 30, ['Thunderbolt']), mon('Garchomp', 30, ['Earthquake'])], [mon('Mewtwo', 100, ['Psystrike'])]);
	check(!ann.said(/called off/), 'a friendly is not called off for a team outside the box');
	check(ann.said(/Friendly battle/), 'and both players are told it counts for nothing');

	// A gimmick nobody has is allowed in a friendly, because none of it is recorded.
	for (let i = 0; i < 20 && !ann.requests.some(r => r.active); i++) await sleep(250);
	const free = ann.requests.filter(r => r.active).pop();
	if (free && ann.room) {
		ann.send(`${ann.room}|/choose move 1 terastallize|${free.rqid}`);
		await sleep(1500);
		check(!ann.said(/can't Terastallize without a Tera Orb/), 'and a locked gimmick is not refused in a friendly');
	} else {
		check(false, 'the friendly asked Ann for a move');
	}

	if (failed && process.env.DEBUG_PVP) console.log(ann.lines.filter(l => !/\|(t:|j|l|c|n|init|title|gametype|gen|tier|rule|clearpoke|poke|teampreview|player|teamsize|raw\|<div class="infobox infobox-roomintro)\|/.test(l)).slice(-50).join('\n'));
	console.log(`\n${passed} passed, ${failed} failed`);
	ann.ws.close(); bob.ws.close();
	cleanup();
	process.exit(failed ? 1 : 0);
})();
