'use strict';
/**
 * Arranged trainer fights, end to end on a local server: a rigged Larper and a
 * rigged trainer of a class the list doesn't have, each battled to the end the
 * way the Discord bot's rigs send them (payload.summon).
 *
 *   RP_TEST_URL=http://localhost:8123 RP_ENCOUNTER_KEY=<base64 pem> node test/rp-rig-trainer.test.js
 */
const crypto = require('crypto');
const WebSocket = require('ws');
const { Teams } = require('pokemon-showdown');

const BASE = process.env.RP_TEST_URL || 'http://localhost:8123';
const KEY = crypto.createPrivateKey(Buffer.from(process.env.RP_ENCOUNTER_KEY || '', 'base64').toString('utf8'));
let NAME = '';
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

const BOX = [{ species: 'Garchomp', level: 60 }, { species: 'Blissey', level: 60 }];
const TEAM = Teams.pack([
	{ species: 'Garchomp', level: 60, moves: ['Earthquake', 'Dragon Claw'], ability: 'Rough Skin', evs: {}, ivs: {} },
	{ species: 'Blissey', level: 60, moves: ['Seismic Toss', 'Soft-Boiled'], ability: 'Natural Cure', evs: {}, ivs: {} },
]);

(async () => {
	const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/showdown/websocket');
	const seen = { challenge: null, log: [], errors: [] };
	ws.on('message', data => {
		const lines = String(data).split('\n');
		let room = '';
		if (lines[0].startsWith('>')) room = lines.shift().slice(1);
		for (const line of lines) {
			if (line.startsWith('|challstr|')) ws.send(`|/trn ${NAME || 'RigTester'},0,`);
			if (line.startsWith('|updateuser|')) NAME = line.split('|')[2].trim().replace(/^[^A-Za-z0-9]/, '').replace(/@!?$/, '');
			if (line.startsWith('|pm|') && line.includes('|/challenge gen9rp')) {
				const from = line.split('|')[2].trim().replace(/^[^A-Za-z0-9]/, '');
				seen.challenge = { from };
				ws.send(`|/utm ${TEAM}`);
				ws.send(`|/accept ${from}`);
			}
			if (room.startsWith('battle-')) {
				seen.log.push(line);
				if (line.startsWith('|error|')) seen.errors.push(line);
				if (line.startsWith('|request|') && line.length > 9) {
					const request = JSON.parse(line.slice(9));
					if (request.wait) continue;
					ws.send(`${room}|/choose default`);
				}
			}
		}
	});
	await new Promise(r => ws.on('open', r));
	await wait(3000);

	async function fight(summon, label) {
		seen.challenge = null; seen.log = []; seen.errors = [];
		const answer = await post('/rp/encounter', signed({
			at: Date.now(), showdown: NAME, character: 'Mira', channel: 'route-1', kind: 'trainer', badges: 6, levelCap: 60,
			box: BOX, summon,
		}));
		check(answer.body.ok, `${label}: the arranged fight is accepted (${answer.body.ok ? answer.body.encounter.text : answer.body.message})`);
		if (!answer.body.ok) return null;
		const id = answer.body.encounter.id;
		for (let i = 0; i < 40 && !seen.challenge; i++) await wait(500);
		check(!!seen.challenge, `${label}: the trainer challenged the player (${seen.challenge && seen.challenge.from})`);
		let result = null;
		for (let i = 0; i < 240 && !result; i++) {
			const r = await (await fetch(`${BASE}/rp/result/${id}`)).json();
			if (r.encounter && r.encounter.status === 'done') result = r.encounter.result;
			else await wait(1000);
		}
		check(!!result, `${label}: battled to the end (${result && result.outcome})`);
		check(seen.errors.length === 0, `${label}: no errors in the battle (${seen.errors.slice(0, 2).join(' ')})`);
		await wait(3000);
		return { answer: answer.body.encounter, log: seen.log.join('\n'), from: seen.challenge && seen.challenge.from };
	}

	const larper = await fight({ kind: 'trainer', classId: 'larper', name: 'Bob' }, 'rigged Larper');
	if (larper) {
		check(/Larper Bob/.test(larper.from || ''), `it's Larper Bob (${larper.from})`);
		check(/\|switch\|p2a: /.test(larper.log), 'the Larper sent out a team');
	}
	const custom = await fight({ kind: 'trainer', classId: 'teamrocketgrunt', classTitle: 'Rocket Grunt', name: 'Jess' }, 'rigged custom class');
	if (custom) check(/Rocket Grunt Jess/.test(custom.from || ''), `it's under the title typed (${custom.from})`);

	console.log(failed ? `\n${failed} failed` : '\nall passed');
	ws.close();
	process.exit(failed ? 1 : 0);
})();
