'use strict';
/**
 * The tutorial end to end, against a running server: /tutorial, the RP bot's
 * challenge, accepting with no team, the Throw and item panels, a ball and a
 * Potion.
 *
 *   PORT=8123 PS_REAL_ACCOUNTS=0 node src/index.js
 *   RP_TEST_URL=http://localhost:8123 node test/tutorial.test.js
 *
 * Against the live server, RP_GUEST=1 stays a guest (no name to log in with).
 */

const WebSocket = require('ws');

const BASE = process.env.RP_TEST_URL || 'http://localhost:8123';
const NAME = `TutTester${Math.floor(Math.random() * 1000)}`;

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
	const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/showdown/websocket');
	const seen = { challenge: null, battle: null, errors: [], log: [], ended: false, replies: [] };
	let turn = 0, threw = false, potion = false;
	ws.on('message', data => {
		const lines = String(data).split('\n');
		let room = '';
		if (lines[0].startsWith('>')) room = lines.shift().slice(1);
		for (const line of lines) {
			if (line.startsWith('|challstr|') && !process.env.RP_GUEST) ws.send(`|/trn ${NAME},0,`);
			if (line.startsWith('|pm|') && line.includes('|/challenge gen9rptutorial')) {
				const from = line.split('|')[2].trim().replace(/^[^A-Za-z0-9]/, '');
				seen.challenge = from;
				ws.send('|/utm null');
				ws.send(`|/accept ${from}`);
			}
			if (!room.startsWith('battle-')) {
				if (/tutorial|Rattata/i.test(line)) seen.replies.push(line);
				continue;
			}
			seen.battle = room;
			seen.log.push(line);
			const button = /\|uhtml\|rpitems\|.*value="(\/useitem potion, Pikachu)"/.exec(line);
			if (button) seen.potionButton = button[1];
			// The newest panel, whichever side of the request it lands on.
			if (line.startsWith('|uhtml|rpitems|')) seen.panelButton = button ? button[1] : null;
			if (button && seen.awaitPanel && !potion) { potion = true; ws.send(`${seen.awaitPanel}|${button[1]}`); seen.awaitPanel = null; }
			if (line.startsWith('|error|')) seen.errors.push(line);
			// Another ball once that one is thrown: there was only one.
			if (/threw a Poké Ball!/.test(line) && !seen.second) { seen.second = true; ws.send(`${room}|/throwball poke`); }
			if (process.env.DEBUG && /error|rpitems|threw|win/.test(line)) console.log('  >', line.slice(0, 120));
			if (line.startsWith('|win|') || line === '|tie' || line.startsWith('|tie|')) seen.ended = true;   // not '|tier|'
			if (!line.startsWith('|request|')) continue;
			const raw = line.slice(9);
			if (!raw) continue;
			const request = JSON.parse(raw);
			// An updated request (after a throw is queued) is not a new turn: answering it replaces the throw.
			if (request.wait || request.update) continue;
			if (request.forceSwitch || request.teamPreview) { ws.send(`${room}|/choose default`); continue; }
			turn++;
			const [hp, max] = String(request.side.pokemon[0].condition).split(' ')[0].split('/').map(Number);
			// Growl until Rattata hurts Pikachu, then wait for the item panel sent right
			// behind this request and press its Potion button; throw after that.
			if (!potion && hp < max && seen.panelButton) { potion = true; ws.send(`${room}|${seen.panelButton}`); continue; }
			if (!potion && hp < max) { seen.awaitPanel = room; continue; }
			if (!threw && (potion || turn > 10)) {
				threw = true;
				ws.send(`${room}|/throwball poke`);
				continue;
			}
			ws.send(`${room}|/choose move ${threw || turn > 12 ? 1 : 3}`);
		}
	});
	await new Promise(r => ws.on('open', r));
	await wait(3000);

	ws.send('|/tutorial');
	for (let i = 0; i < 40 && !seen.challenge; i++) await wait(500);
	check(!!seen.challenge, `/tutorial gets a challenge from the RP bot (${seen.challenge})`);
	for (let i = 0; i < 40 && !seen.battle; i++) await wait(500);
	check(!!seen.battle, 'accepting with no team starts the battle');
	for (let i = 0; i < 120 && !seen.ended; i++) await wait(1000);

	const log = seen.log.join('\n');
	check(/\|switch\|p\d+a: Pikachu\|Pikachu, L5/.test(log) && /Rattata, L5/.test(log), 'Lv. 5 Pikachu against Lv. 5 Rattata');
	check(/\|uhtml\|rpball0\|.*\/throwball poke/.test(log), 'the Throw buttons are in the battle');
	check(/\|uhtml\|rpitems\|/.test(log), 'the item panel is in the battle');
	check(!!seen.potionButton, 'the item panel offers a Potion button once Pikachu is hurt');
	check(/threw a Poké Ball!/.test(log), '/throwball throws the Poké Ball');
	check(seen.errors.some(e => /last Poké Ball/.test(e)) || /Gotcha!/.test(log), `a second ball is refused, or the first one caught it (${seen.errors.join(' ; ')})`);
	check(potion && /used a Potion on Pikachu!/.test(log), 'pressing the Potion button uses the Potion');
	check(seen.ended, 'the battle ends');

	ws.close();
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
