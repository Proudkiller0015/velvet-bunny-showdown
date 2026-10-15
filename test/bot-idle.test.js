'use strict';
/**
 * The vs-bot inactivity rule (src/bot-idle.js), with stand-in rooms.
 *
 *   node test/bot-idle.test.js
 */
const assert = require('assert');
const { tick, IDLE_MS, GRACE_MS } = require('../src/bot-idle');

let failed = 0;
const check = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); } };

const users = {
	velvetbunnyhard: { id: 'velvetbunnyhard', connections: [{ ip: '127.0.0.1' }] },
	wildpidgey: { id: 'wildpidgey', connections: [{ ip: '::ffff:127.0.0.1' }] },
	sam: { id: 'sam', connections: [{ ip: '203.0.113.5' }] },
	kora: { id: 'kora', connections: [{ ip: '198.51.100.7' }] },
};
const getUser = id => users[id];

function room(a, b) {
	const lines = [];
	const players = [a, b].map((id, i) => ({ id, name: id, slot: `p${i + 1}`, active: true, eliminated: false, request: { rqid: 1, request: '{}', isWait: false, choice: '' } }));
	return {
		roomid: `battle-${a}-${b}`, lines, add: l => lines.push(l), update() {},
		battle: { started: true, ended: false, players, forfeited: null, forfeitPlayer(p) { this.forfeited = p.id; p.eliminated = true; } },
	};
}

check('five idle minutes on one turn start two minutes, then a forfeit', () => {
	const r = room('sam', 'velvetbunnyhard');
	tick([r], { getUser, now: 0 });
	assert.deepStrictEqual(tick([r], { getUser, now: IDLE_MS - 1 }), []);
	assert.strictEqual(tick([r], { getUser, now: IDLE_MS })[0].did, 'start');
	assert.ok(/2 minutes/.test(r.lines[0]));
	assert.deepStrictEqual(tick([r], { getUser, now: IDLE_MS + GRACE_MS - 1 }), []);
	assert.strictEqual(tick([r], { getUser, now: IDLE_MS + GRACE_MS })[0].did, 'forfeit');
	assert.strictEqual(r.battle.forfeited, 'sam');
});

check('moving in time turns the countdown off', () => {
	const r = room('sam', 'wildpidgey');
	tick([r], { getUser, now: 0 });
	tick([r], { getUser, now: IDLE_MS });
	r.battle.players[0].request = { rqid: 2, request: '{}', isWait: false, choice: '' };
	assert.strictEqual(tick([r], { getUser, now: IDLE_MS + 1000 })[0].did, 'off');
	tick([r], { getUser, now: IDLE_MS + GRACE_MS + 5000 });
	assert.strictEqual(r.battle.forfeited, null);
});

check('leaving starts the countdown at once; still gone means a forfeit', () => {
	const r = room('velvetbunnyhard', 'sam');
	tick([r], { getUser, now: 0 });
	r.battle.players[1].active = false;
	assert.strictEqual(tick([r], { getUser, now: 1000 })[0].why, 'left');
	tick([r], { getUser, now: 1000 + GRACE_MS });
	assert.strictEqual(r.battle.forfeited, 'sam');
});

check('player vs player is left alone', () => {
	const r = room('sam', 'kora');
	r.battle.players[0].active = false;
	tick([r], { getUser, now: 0 });
	assert.deepStrictEqual(tick([r], { getUser, now: IDLE_MS + GRACE_MS + 1 }), []);
	assert.strictEqual(r.battle.forfeited, null);
});

check('waiting on the bot does not count against the player', () => {
	const r = room('sam', 'velvetbunnyhard');
	r.battle.players[0].request.isWait = true;
	tick([r], { getUser, now: 0 });
	assert.deepStrictEqual(tick([r], { getUser, now: IDLE_MS * 3 }), []);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
