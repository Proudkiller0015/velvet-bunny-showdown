'use strict';
/**
 * The deploy hold (src/deploy-hold.js): a flag written after this server started
 * locks new battles and turns off Showdown's lockdown self-kill; an older flag, an
 * expired one or a cleared one does nothing / releases it.
 *
 *   node test/deploy-hold.test.js
 */
let passed = 0, failed = 0;
const check = (ok, name) => { if (ok) { passed++; console.log(`ok   ${name}`); } else { failed++; console.log(`FAIL ${name}`); } };

global.Rooms = { global: { lockdown: false } };
global.Config = { autolockdown: true };
let flag = null;
let status = 200;
global.fetch = async () => ({
	ok: status === 200, status,
	text: async () => (flag === null ? '' : JSON.stringify(flag)),
});

const hold = require('../src/deploy-hold');

(async () => {
	// A flag from before this process started (the new build reading the old deploy's flag).
	flag = { at: Date.now() - 60 * 1000, until: Date.now() + 10 * 60 * 1000 };
	await hold.check();
	check(!Rooms.global.lockdown && !hold.state.held, 'a flag older than the server is ignored');

	// A fresh flag.
	await new Promise(r => setTimeout(r, 5));
	flag = { at: Date.now(), until: Date.now() + 10 * 60 * 1000 };
	await hold.check();
	check(Rooms.global.lockdown === true && hold.state.held, 'a fresh flag holds new battles');
	check(Config.autolockdown === false, 'and the lockdown will not kill the server when the last battle ends');

	// A failed read changes nothing.
	status = 500;
	await hold.check();
	check(Rooms.global.lockdown === true, 'a failed read leaves the hold as it was');
	status = 200;

	// Released.
	flag = {};
	await hold.check();
	check(!Rooms.global.lockdown && !hold.state.held, 'a cleared flag releases the hold');

	// Expired.
	flag = { at: Date.now(), until: Date.now() - 1 };
	await hold.check();
	check(!Rooms.global.lockdown, 'an expired flag does not hold');

	// No flag file at all.
	status = 404; flag = null;
	await hold.check();
	check(!Rooms.global.lockdown, 'no flag file, no hold');

	console.log(`${passed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
