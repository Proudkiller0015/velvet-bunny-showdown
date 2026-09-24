'use strict';
/**
 * Encounters opened from Discord, without a server: who counts as the
 * encounter's own account, what Discord is told when the RP bot can't take one,
 * and what the RP Guide does when the same encounter is asked for again.
 *
 *   node test/rp-open.test.js
 *
 * Written for the fixes of 23 Sep 2026: the opened battle looked up the bot by
 * its exact name (missing "Hiker Bob42", and able to seat a person called
 * Hiker Bob), a spawn nobody took still answered ok, and a second ask sent a
 * /challenge next to a room being opened.
 */

const rp = require('../src/rp-server');
const { RpGuide, EncounterOpponent } = require('../src/rp-bot');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

// ------------------------------------------------ which account is the bot's
{
	const user = (id, ips, lastConnected = 1, connected = true) =>
		({ id, connected, lastConnected, connections: ips.map(ip => ({ ip })) });
	const local = ['127.0.0.1'];

	check(rp.isEncounterName('hikerbob', 'hikerbob'), 'the plain name is the bot\'s');
	check(rp.isEncounterName('hikerbob', 'hikerbob42'), 'so is the name with a number after it (nametaken)');
	check(!rp.isEncounterName('hikerbob', 'hikerbob1234'), 'but not four digits');
	check(!rp.isEncounterName('hikerbob', 'hikerbobby'), 'nor a longer name');
	check(!rp.isEncounterName('hikerbob', 'hiker'), 'nor a shorter one');

	const person = user('hikerbob', ['203.0.113.9'], 5);
	const renamed = user('hikerbob42', local, 3);
	check(rp.encounterAccount([person, renamed], 'Hiker Bob') === renamed,
		'a person called Hiker Bob is passed over for the renamed bot on this machine');
	check(rp.encounterAccount([person], 'Hiker Bob') === null, 'and is never seated on their own');
	check(rp.encounterAccount([user('hikerbob7', ['203.0.113.9'])], 'Hiker Bob') === null,
		'nor is a person who happens to have a number on the end');
	check(rp.encounterAccount([user('hikerbob', ['127.0.0.1', '198.51.100.1'])], 'Hiker Bob') === null,
		'an account with any connection from elsewhere is not the bot');
	check(rp.encounterAccount([user('hikerbob', local, 1, false)], 'Hiker Bob') === null, 'an offline one is not seated');
	const old = user('hikerbob', ['::1'], 1);
	const fresh = user('hikerbob15', ['::ffff:127.0.0.1'], 9);
	check(rp.encounterAccount([old, fresh], 'Hiker Bob') === fresh, 'with two, the one that connected last is the replacement');
	check(rp.encounterAccount([user('wildpidgey', local)], 'Wild Pidgey').id === 'wildpidgey', 'a plain wild name is found as it is');
}

// ------------------------------------------------ what Discord is told
{
	const payload = { showdown: 'OpenTester', channel: 'route-1', kind: 'wild', badges: 1, playerTeam: [{ species: 'Pikachu', level: 10, moves: ['tackle'] }] };
	const offlineGuide = {
		isOnline: () => true,
		spawn: enc => {
			enc.status = 'error';
			enc.result = { outcome: 'error', message: 'The RP bot is not connected. Try again in a minute.' };
			return false;
		},
	};
	const refused = rp.requestEncounter(payload, offlineGuide);
	check(refused.ok === false, 'a spawn the RP bot never got is not ok');
	check(/not connected/.test(refused.message || ''), `and says why (${refused.message})`);
	check(!rp.openFor('opentester'), 'and leaves nothing open, so asking again starts clean');

	let spawned = 0;
	const deps = { isOnline: () => true, spawn: () => { spawned++; return true; } };
	const first = rp.requestEncounter(payload, deps);
	check(first.ok && spawned === 1, 'a spawn that went out is ok');
	const enc = rp.encounters.get(first.encounter.id);
	enc.status = 'battling';
	enc.roomid = 'battle-gen9rpbattlewildencounter-99';
	const again = rp.requestEncounter(payload, deps);
	check(again.ok && again.again && again.opened === true && again.roomid === enc.roomid,
		'asked again mid-battle: the room it is in, not a challenge');
	check(spawned === 1, 'and nothing is sent to the RP bot');
	enc.status = 'done';
}

// ------------------------------------------------ the RP Guide, asked twice
{
	const sent = [];
	const opened = [];
	EncounterOpponent.prototype.connect = function () { opened.push(this); };
	EncounterOpponent.prototype.send = function (line) { sent.push([this.spawn.id, line]); };
	RpGuide.prototype.send = function (line) { sent.push(['guide', line]); };
	const guide = new RpGuide({ builder: {}, log: () => {} });
	const spawn = (open, extra = {}) => ({ id: 'e1', target: 'Tester', name: 'Hiker Bob', format: 'gen9rpbattle', team: '', kind: 'trainer', classId: 'hiker', open, ...extra });

	guide.startEncounter(spawn(true, { badges: 1 }));
	const first = guide.live.get('e1');
	check(opened.length === 1, 'an opened encounter logs its opponent in');
	guide.startEncounter(spawn(true, { badges: 3 }));
	check(guide.live.get('e1') === first && opened.length === 1, 'asked again while waiting to be seated: the same opponent');
	check(!sent.some(([, line]) => /\/challenge/.test(line)), 'and no /challenge goes out');
	check(first.spawn.badges === 3, 'it takes the new spawn (badges and the rest)');

	// Waiting on a challenge, then the player picks a team: that one is retired.
	sent.length = 0;
	guide.live.clear();
	guide.startEncounter(spawn(false));
	const challenger = guide.live.get('e1');
	guide.startEncounter(spawn(true));
	check(challenger.finished, 'a challenge-mode opponent is retired when the encounter is opened instead');
	check(sent.some(([, line]) => /\/cancelchallenge Tester/.test(line)), 'its challenge withdrawn');
	check(guide.live.get('e1') && guide.live.get('e1') !== challenger && guide.live.get('e1').spawn.open, 'and a fresh one waits to be seated');
	for (const o of guide.live.values()) o.finish('test over');

	// Too many at once: the player hears it, and so does the server.
	sent.length = 0;
	guide.live.clear();
	for (let i = 0; i < 50 && sent.every(([, line]) => !/rpbusy/.test(line)); i++) guide.startEncounter(spawn(true, { id: `busy${i}` }));
	check(sent.some(([who, line]) => who === 'guide' && /^\|\/rpbusy busy\d+$/.test(line)), 'a full RP bot tells the server with /rpbusy');
	for (const o of guide.live.values()) o.finish('test over');
}

// ------------------------------------------------ an hour in, mid-battle
{
	const bot = Object.create(EncounterOpponent.prototype);
	bot.timers = [];
	bot.finished = false;
	bot.log = () => {};
	bot.stop = () => {};
	bot.born = Date.now() - 61 * 60 * 1000;
	bot.battleRoom = 'battle-x';
	bot.outlived();
	check(!bot.finished && bot.timers.length === 1, 'a battle still being played is not ended by the hour');
	bot.born = Date.now() - 4 * 60 * 60 * 1000;
	bot.outlived();
	check(bot.finished, 'but the hard cap still ends one that is stuck');
	for (const t of bot.timers) clearTimeout(t);
	const idle = Object.create(EncounterOpponent.prototype);
	Object.assign(idle, { timers: [], finished: false, log: () => {}, stop: () => {}, born: Date.now() - 61 * 60 * 1000, battleRoom: null });
	idle.outlived();
	check(idle.finished, 'one that never got a battle goes at the hour');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
