'use strict';
/**
 * Does the opponent picker on the search form actually reach the server?
 *
 *   node test/opponent.test.js wss://host/showdown/websocket
 *   node test/opponent.test.js                   # the live server, by default
 *
 * The row that client/js/velvet-matchmaking.js puts above the Battle! button
 * sends `/bot hard`, `/bot pvp` or `/bot anyone` the way the search itself is
 * sent: `app.send` with no room, which writes `|/bot hard` and runs the command
 * with no room at all.
 *
 * That last part is the reason this test exists. Every other way of running
 * that command - the lobby panel's buttons, a private message to the bot - runs
 * it *inside a room*, and a command that reads `room` or replies into one
 * behaves differently, or throws, when there is none. Nothing about the client
 * would say so: the row would look right and quietly do nothing.
 *
 * So this connects as a player, sends the three commands exactly as the row
 * does, and reads what comes back.
 */

const WebSocket = require('ws');

const TARGET = process.argv[2] ||
	'wss://velvet-bunny-showdown.onrender.com/showdown/websocket';

/** What the row sends, and what the server should say about each. */
const CASES = [
	{ send: '/bot pvp', expect: /players only|wait for a real opponent/i, what: 'players only' },
	{ send: '/bot hard', expect: /set to hard/i, what: 'a difficulty' },
	{ send: '/bot anyone', expect: /closest to your rating/i, what: 'anyone' },
];

(async () => {
	console.log(`checking ${TARGET}`);
	const ws = new WebSocket(TARGET, { handshakeTimeout: 30000 });
	const received = [];

	try {
		await new Promise((resolve, reject) => {
			ws.on('open', resolve);
			ws.on('error', reject);
			setTimeout(() => reject(new Error('timed out connecting')), 45000);
		});
	} catch (e) {
		console.log(`FAIL: ${e.message}`);
		process.exit(1);
	}

	const NAME = `OpponentTest${Math.floor(Math.random() * 900 + 100)}`;
	let named = false;
	ws.on('message', data => {
		const frame = String(data);
		received.push(frame);
		for (const line of frame.split('\n')) {
			if (line.startsWith('|challstr|')) {
				const challstr = line.slice('|challstr|'.length);
				// A name has to be proved now, even an unregistered one: this server
				// checks assertions, so a bare /trn is refused. getassertion is the
				// call a browser makes for somebody who picks a name without an account.
				const url = 'https://play.pokemonshowdown.com/action.php?act=getassertion' +
					`&userid=${NAME.toLowerCase()}&challstr=${encodeURIComponent(challstr)}`;
				fetch(url).then(r => r.text()).then(a => ws.send(`|/trn ${NAME},0,${a.trim()}`))
					.catch(() => ws.send(`|/trn ${NAME},0,`));
			}
			if (line.startsWith('|updateuser|') && line.split('|')[3] === '1') named = true;
		}
	});

	// Named first, or the commands run as a guest.
	const deadline = Date.now() + 30000;
	while (!named && Date.now() < deadline) await new Promise(r => setTimeout(r, 250));
	if (!named) {
		console.log('FAIL: never got a name');
		process.exit(1);
	}

	let bad = 0;
	for (const testCase of CASES) {
		const before = received.length;
		// No room prefix: this is the line the search form itself produces.
		ws.send(`|${testCase.send}`);
		await new Promise(r => setTimeout(r, 2500));
		const answer = received.slice(before).join('\n');
		const ok = testCase.expect.test(answer);
		if (!ok) bad++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${testCase.send.padEnd(12)} -> ${testCase.what}`);
		if (!ok) {
			const said = answer.split('\n').filter(l => /\|(popup|raw|html|error)\|/.test(l)).join(' / ');
			console.log(`       said: ${said.slice(0, 300) || '(nothing)'}`);
		}
	}

	ws.close();
	console.log(bad ? `\n${bad} of ${CASES.length} did not reach the server` : `\nall ${CASES.length} reach the server`);
	process.exit(bad ? 1 : 0);
})();
