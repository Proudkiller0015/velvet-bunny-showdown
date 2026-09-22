'use strict';
/**
 * An RP encounter end to end, against a running server: the signed request
 * Discord would send, the RP bot's challenge, the battle, a ball, the result.
 *
 * Start a server first with real accounts off, so a test player can take a
 * name without a login server:
 *
 *   PORT=8123 PS_REAL_ACCOUNTS=0 node src/index.js
 *   RP_TEST_URL=http://localhost:8123 RP_ENCOUNTER_KEY=<base64 pem> node test/rp-encounter.test.js
 *
 * RP_ENCOUNTER_KEY is the Discord bot's private key (rp-bot/.env).
 */

const crypto = require('crypto');
const WebSocket = require('ws');
const { Teams } = require('pokemon-showdown');

const BASE = process.env.RP_TEST_URL || 'http://localhost:8123';
// The name asked for; the server may keep us a guest (an unsigned /trn is refused here),
// so NAME becomes whatever |updateuser| says we are - that is the name it checks online.
let NAME = `RpTester${Math.floor(Math.random() * 1000)}`;
const KEY = crypto.createPrivateKey(Buffer.from(process.env.RP_ENCOUNTER_KEY || '', 'base64').toString('utf8'));

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

function signed(payload) {
	const bytes = Buffer.from(JSON.stringify(payload));
	return { payload: bytes.toString('base64'), sig: crypto.sign(null, bytes, KEY).toString('base64') };
}

async function post(path, body) {
	const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	return { status: res.status, body: await res.json() };
}

const TEAM = Teams.pack([
	{ species: 'Pikachu', level: 30, moves: ['Thunder Wave', 'Quick Attack'], ability: 'Static', evs: {}, ivs: {} },
	{ species: 'Chansey', level: 30, moves: ['Sing', 'Pound'], ability: 'Natural Cure', evs: {}, ivs: {} },
]);

(async () => {
	const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/showdown/websocket');
	const seen = { challenge: null, battle: null, errors: [], log: [] };
	let throws = 0;
	ws.on('message', data => {
		const block = String(data);
		const lines = block.split('\n');
		let room = '';
		if (lines[0].startsWith('>')) room = lines.shift().slice(1);
		for (const line of lines) {
			if (line.startsWith('|challstr|')) ws.send(`|/trn ${NAME},0,`);
			if (line.startsWith('|updateuser|')) NAME = line.split('|')[2].trim().replace(/^[^A-Za-z0-9]/, '').replace(/@!?$/, '');
			if (line.startsWith('|pm|') && line.includes('|/challenge gen9rpbattle')) {
				const from = line.split('|')[2].trim().replace(/^[^A-Za-z0-9]/, '');
				seen.challenge = { from, rank: line.split('|')[2][0], format: /\/challenge (\w+)/.exec(line)[1] };
				ws.send(`|/utm ${TEAM}`);
				ws.send(`|/accept ${from}`);
			}
			if (room.startsWith('battle-')) {
				seen.battle = room;
				seen.log.push(line);
				if (line.startsWith('|error|')) seen.errors.push(line);
				if (line.startsWith('|request|')) {
					const raw = line.slice(9);
					if (!raw) continue;
					const request = JSON.parse(raw);
					if (request.wait || request.teamPreview) { if (request.teamPreview) ws.send(`${room}|/choose default`); continue; }
					if (request.forceSwitch) { ws.send(`${room}|/choose default`); continue; }
					const wild = seen.challenge && seen.challenge.format.includes('wild');
					if (wild && throws < 4) { throws++; ws.send(`${room}|/throwball poke`); } else ws.send(`${room}|/choose default`);
				}
			}
		}
	});
	await new Promise(r => ws.on('open', r));
	await wait(3000);

	// Refused: a forged signature.
	const forged = signed({ at: Date.now(), showdown: NAME, channel: 'route-1', badges: 1 });
	forged.sig = Buffer.alloc(64).toString('base64');
	check((await post('/rp/encounter', forged)).status === 403, 'a request with a bad signature is refused');

	// Refused: somewhere with no wild Pokemon.
	const indoors = await post('/rp/encounter', signed({ at: Date.now(), showdown: NAME, channel: 'poke-center', kind: 'wild', badges: 1 }));
	check(indoors.body.code === 'nowild' && /blossom-road/.test(indoors.body.message), `no wild Pokémon indoors, and it says where to go (${indoors.body.message})`);

	// Refused: somebody who isn't on Showdown.
	const offline = await post('/rp/encounter', signed({ at: Date.now(), showdown: 'NobodyOnline123', channel: 'route-1', kind: 'wild', badges: 1 }));
	check(offline.body.code === 'offline', 'an offline player is told to log in first');

	// A team that doesn't match the box: Pikachu is Lv. 30 on the team but 5 in the box, and there's no Chansey.
	const answer = await post('/rp/encounter', signed({
		at: Date.now(), showdown: NAME, character: 'Mira', channel: 'the-long-grass', kind: 'wild', badges: 0, levelCap: 8,
		balls: { poke: 2 }, box: [{ species: 'Pikachu', level: 5 }], gimmicks: { mega: false, zmove: false, dynamax: false, tera: false },
	}));
	if (!answer.body.ok) console.log("  answer:", answer.status, JSON.stringify(answer.body).slice(0, 400));
	check(answer.body.ok, `a wild encounter is rolled: ${answer.body.encounter && answer.body.encounter.text}`);
	const id = answer.body.encounter && answer.body.encounter.id;
	for (let i = 0; i < 40 && !seen.challenge; i++) await wait(500);
	let invalid = null;
	for (let i = 0; i < 40 && !invalid; i++) {
		const r = await (await fetch(`${BASE}/rp/result/${id}`)).json();
		if (r.encounter && r.encounter.invalid) invalid = r.encounter;
		await wait(500);
	}
	check(invalid && invalid.status === 'waiting' && /Chansey/.test(invalid.invalid.message) && /Pikachu\*\* is Lv\. 30/.test(invalid.invalid.message),
		`a team that doesn't match the box calls the battle off (${invalid && invalid.invalid.message})`);
	check(/called off/.test(seen.log.join('\n')), 'the player is told why in the battle');
	check(!/threw an? Pok[ée] ?[Bb]all/.test(seen.log.join('\n')), 'nothing happened in the called-off battle');
	await wait(3000);   // the opponent logs off after the called-off battle
	seen.challenge = null;
	seen.log = [];

	// The team fixed (here: the box it's checked against), and asked again: the same encounter, and it battles.
	const again = await post('/rp/encounter', signed({ at: Date.now(), showdown: NAME, channel: 'the-long-grass', kind: 'wild', badges: 0, levelCap: 8,
		balls: { poke: 2 }, box: [{ species: 'Pikachu', level: 30 }, { species: 'Chansey', level: 35 }] }));
	check(again.body.again && again.body.encounter.id === id, 'asking again brings back the same encounter');

	for (let i = 0; i < 40 && !seen.challenge; i++) await wait(500);
	check(!!seen.challenge, `the RP bot challenged the player (${seen.challenge && seen.challenge.from})`);
	check(seen.challenge && seen.challenge.rank === '*', `the wild Pokémon has the bot rank (got "${seen.challenge && seen.challenge.rank}")`);

	let result = null;
	for (let i = 0; i < 180; i++) {
		const r = await (await fetch(`${BASE}/rp/result/${id}`)).json();
		if (r.encounter && r.encounter.status === 'done') { result = r.encounter.result; break; }
		await wait(1000);
	}
	check(!!result, `the result is reported: ${JSON.stringify(result)}`);
	const log = seen.log.join('\n');
	check(/threw an? Pok[ée] ?[Bb]all/.test(log), 'a ball was thrown');
	// The test player only ever chooses "default", so any gimmick in the log is the wild Pokémon's.
	check(!/^\|-(terastallize|mega|burst|zpower)\||^\|-start\|[^|]*\|Dynamax/m.test(log),'the wild Pokémon used no Mega, Tera, Dynamax or Z-move');
	const thrown = (log.match(/threw an? Pok[ée] ?[Bb]all/g) || []).length;
	check(thrown <= 2, `no more balls than the character had (${thrown} of 2)`);
	check(seen.errors.some(e => /last Poké Ball|doesn't have/.test(e)) || thrown < 2 || (result && result.outcome === 'caught'),
		'the bag stopped a third ball (or it was caught first)');
	if (result) check((result.ballsUsed.poke || 0) === thrown, 'the result counts the balls used');

	// A trainer, and it battles to the end.
	const trainer = await post('/rp/encounter', signed({ at: Date.now(), showdown: NAME, channel: 'route-1', kind: 'trainer', badges: 1, levelCap: 12 }));
	check(trainer.body.ok, `a trainer encounter is rolled: ${trainer.body.encounter && trainer.body.encounter.text}`);

	console.log(failed ? `\n${failed} failed` : '\nall passed');
	ws.close();
	process.exit(failed ? 1 : 0);
})();
