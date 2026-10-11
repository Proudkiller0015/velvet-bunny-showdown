'use strict';
/**
 * The RP Buffs room: it exists, its intro is the list, and /rfaq answers from
 * data/rp-buffs.json (config/showdown-config.js rpBuffsRoom). Boots the real server.
 *
 *   node test/rp-buffs-room.test.js
 */
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = 8131;
const root = path.join(__dirname, '..');
const data = require('../data/rp-buffs.json');
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const server = spawn(process.execPath, [path.join(root, 'src', 'index.js')], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', d => { log += d; });
server.stderr.on('data', d => { log += d; });
const done = () => { try { server.kill(); } catch (e) { /* gone */ } process.exit(failed ? 1 : 0); };
setTimeout(() => { check(false, 'timed out'); console.log(log.split('\n').slice(-15).join('\n')); done(); }, 90000).unref();

const ready = () => new Promise(resolve => {
	const tick = setInterval(() => { if (/rp-buffs\] the RP Buffs room is open/.test(log)) { clearInterval(tick); resolve(); } }, 300);
});

(async () => {
	await ready();
	check(true, 'the room opened at boot');
	await new Promise(r => setTimeout(r, 1500));
	const ws = new WebSocket(`ws://127.0.0.1:${PORT}/showdown/websocket`);
	let got = '';
	ws.on('message', m => { got += String(m) + '\n'; });
	await new Promise(r => ws.on('open', r));
	await new Promise(r => setTimeout(r, 1000));
	ws.send('|/join rpbuffs');
	await new Promise(r => setTimeout(r, 1500));
	check(/RP Buffs/.test(got) && /\/rfaq wavecharge/.test(got), 'joining shows the intro with the list');
	ws.send('rpbuffs|/rfaq dewgong');
	ws.send('rpbuffs|/rfaq timeless');
	await new Promise(r => setTimeout(r, 1500));
	check(/Dewgong/.test(got) && /110\/70\/100\/70\/105\/70/.test(got), '/rfaq dewgong shows its stat buff');
	check(/Timeless/.test(got) && /recharge/i.test(got), '/rfaq timeless shows the ability');
	check(Object.keys(data.faqs).length > 1000, `${Object.keys(data.faqs).length} FAQs in the data`);
	ws.close();
	done();
})();
