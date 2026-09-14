'use strict';
/**
 * Does the server write down who visits, and does it show that to the right
 * people only?
 *
 *   node test/roster.test.js
 *
 * Two halves, and the second is the one worth the boot. The guest book itself
 * is a file and a map and can be checked in memory. Whether it is *private* can
 * only be answered by asking the server as somebody who should not see it, and
 * that means a real server and a real rank check - the kind of thing that is
 * right in the code and wrong in the running program because a command was
 * registered one object further out than intended.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const net = require('net');
const WebSocket = require('ws');

const PORT = Number(process.env.TEST_PORT) || 8794;
const ROSTER = path.join(os.tmpdir(), `velvet-roster-test-${process.pid}.tsv`);
const OWNER = 'SlimeQueenSamantha';

let pass = 0, bad = 0;
const check = (name, ok, detail = '') => {
	if (ok) { pass++; console.log(`  ok   ${name}`); } else { bad++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); }
};

function waitForPort(port, timeoutMs = 90000) {
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

/** A client that names itself and collects everything it is sent. */
function client(name) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
		const lines = [];
		ws.on('message', raw => {
			const text = String(raw);
			lines.push(text);
			if (text.includes('|challstr|')) ws.send(`|/trn ${name},0,`);
		});
		ws.on('open', () => setTimeout(() => resolve({ ws, lines, name }), 3000));
		ws.on('error', reject);
	});
}

const say = (c, text) => new Promise(r => { c.ws.send(`|${text}`); setTimeout(r, 1500); });
const said = c => c.lines.join('\n');

(async () => {
	// --- the guest book on its own -------------------------------------------
	const { Roster } = require('../src/roster');
	const unitFile = path.join(os.tmpdir(), `roster-unit-${process.pid}.tsv`);
	try { fs.unlinkSync(unitFile); } catch (e) {}
	const bots = new Set(['velvetbunny', 'bunnyeasy']);
	const unit = new Roster(unitFile);
	unit.see('someone', 'Someone', { skip: id => bots.has(id) });
	unit.see('velvetbunny', 'Velvet Bunny', { skip: id => bots.has(id) });
	unit.see('someone', 'Someone', { skip: id => bots.has(id) });
	check('the bots are not written down', !unit.all().some(row => row.id === 'velvetbunny'));
	check('a second visit is counted, not duplicated',
		unit.size === 1 && unit.all()[0].visits === 2);
	unit.see('awkward', 'tab\there');
	unit.flush();
	const reloaded = new Roster(unitFile);
	check('it survives being written and read back', reloaded.size === 2);
	check('a name that would break the format is cleaned rather than kept',
		!reloaded.all().some(row => /[\t\n]/.test(row.name)));
	try { fs.unlinkSync(unitFile); } catch (e) {}

	// --- and the same thing through a running server --------------------------
	try { fs.unlinkSync(ROSTER); } catch (e) {}
	const root = path.join(__dirname, '..');
	let log = '';
	const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], {
		cwd: root,
		env: {
			...process.env,
			PORT: String(PORT),
			// Guest logins, so this test can have a name at all - the real server
			// checks names against Showdown and refuses a `/trn` with no assertion.
			PS_REAL_ACCOUNTS: '0',
			PS_ROSTER_FILE: ROSTER,
			PS_ROSTER_FLUSH_MS: '1000',
			PS_LADDER: '0',
			PS_NO_BOT: '1',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	server.stdout.on('data', d => { log += d; });
	server.stderr.on('data', d => { log += d; });
	const cleanup = () => { try { server.kill(); } catch (e) {} };
	process.on('exit', cleanup);

	try {
		await waitForPort(PORT);
	} catch (e) {
		console.log(`FAIL: ${e.message}`);
		console.log(log.split('\n').slice(-15).join('\n'));
		cleanup();
		process.exit(1);
	}
	await new Promise(r => setTimeout(r, 6000));

	const visitor = await client('RosterVisitor');
	const owner = await client(OWNER);
	await new Promise(r => setTimeout(r, 2500));

	const written = () => {
		try { return fs.readFileSync(ROSTER, 'utf8'); } catch (e) { return ''; }
	};
	check('a visitor is written down', /rostervisitor/.test(written()), written().slice(0, 120));
	check('so is the owner', /slimequeensamantha/.test(written()));

	// The owner may look.
	await say(owner, `/players`);
	const ownerSaw = said(owner);
	check('the owner is shown the list', /Everyone who has been here/.test(ownerSaw));
	check('the list names a visitor', /RosterVisitor/.test(ownerSaw));

	// Nobody else may.
	await say(visitor, `/players`);
	const visitorSaw = said(visitor);
	check('an ordinary player is refused', !/Everyone who has been here/.test(visitorSaw));
	check('and told why rather than ignored',
		/access denied|permission|not allowed|Access denied/i.test(visitorSaw), visitorSaw.slice(-160));

	visitor.ws.close();
	owner.ws.close();
	cleanup();
	try { fs.unlinkSync(ROSTER); } catch (e) {}

	console.log(`\n=== ${pass} passed, ${bad} failed`);
	process.exit(bad ? 1 : 0);
})().catch(e => {
	console.error('failed:', e.stack || e.message);
	process.exit(1);
});
