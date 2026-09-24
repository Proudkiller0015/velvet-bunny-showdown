'use strict';
/**
 * The bots' battle bookkeeping, without a server (24 Sep 2026).
 *
 * Two failures the site audit found, both in how a bot keeps track of the
 * battle rooms it is in:
 *
 *  - A ladder rung answered every |error| with "/choose default" and no limit,
 *    so an error that "default" also triggers became a loop pinning the CPU.
 *  - A battle that ended without |win| or |tie| (room expiry, |noinit|,
 *    |deinit|) was never forgotten, and bots.js counts every remembered battle
 *    as busy - so the memory recycle never ran.
 *
 * Both classes are driven directly with hand-written protocol lines and a
 * stub builder; nothing connects anywhere.
 *
 *   node test/battle-forget.test.js
 */

const assert = require('assert');
const { ShowdownBot, expireIdleBattles, BATTLE_IDLE_MS } = require('../src/bot');
const { LadderBot } = require('../src/ladder');

const builder = { usage: new Map(), prefetch: async () => {} };
let failed = 0;

function check(name, fn) {
	try {
		fn();
		console.log(`ok   ${name}`);
	} catch (e) {
		failed++;
		console.log(`FAIL ${name}\n     ${e.message}`);
	}
}

function ladderBot() {
	const bot = new LadderBot({ url: 'ws://nowhere', name: 'Velvet Bunny Hard', builder, difficulty: 'hard', log: () => {} });
	bot.sent = [];
	bot.send = line => bot.sent.push(line);
	return bot;
}

function houseBot() {
	const bot = new ShowdownBot({ url: 'ws://nowhere', builder, log: () => {} });
	bot.sent = [];
	bot.send = line => bot.sent.push(line);
	bot.room = (roomid, line) => bot.sent.push(`${roomid}|${line}`);
	return bot;
}

const ROOM = 'battle-gen9ou-123';

check('ladder: an illegal choice is retried at most five times', () => {
	const bot = ladderBot();
	for (let i = 0; i < 20; i++) bot.onBattleLine(ROOM, ['error', '[Invalid choice] Can\'t move: Pikachu has no move 9']);
	assert.strictEqual(bot.sent.filter(l => l.endsWith('/choose default')).length, 5);
});

check('ladder: "nothing to choose" is never answered', () => {
	const bot = ladderBot();
	bot.onBattleLine(ROOM, ['error', '[Invalid choice] There\'s nothing to choose']);
	assert.strictEqual(bot.sent.length, 0);
});

check('ladder: a new request resets the retry count', () => {
	const bot = ladderBot();
	for (let i = 0; i < 6; i++) bot.onBattleLine(ROOM, ['error', '[Invalid choice] bad']);
	bot.onBattleLine(ROOM, ['request', '{"wait":true,"rqid":2}']);
	bot.onBattleLine(ROOM, ['error', '[Invalid choice] bad']);
	assert.strictEqual(bot.sent.filter(l => l.endsWith('/choose default')).length, 6);
});

for (const [label, make] of [['ladder', ladderBot], ['house', houseBot]]) {
	for (const end of ['deinit', 'noinit']) {
		check(`${label}: |${end}| forgets a live battle`, () => {
			const bot = make();
			bot.onBattleLine(ROOM, ['turn', '3']);
			assert.strictEqual(bot.battles.size, 1);
			bot.onBattleLine(ROOM, end === 'noinit' ? ['noinit', 'nonexistent', 'gone'] : ['deinit']);
			assert.strictEqual(bot.battles.size, 0);
		});
		check(`${label}: |${end}| for an unknown room creates nothing`, () => {
			const bot = make();
			bot.onBattleLine(ROOM, [end]);
			assert.strictEqual(bot.battles.size, 0);
		});
	}

	check(`${label}: a battle idle past the limit is dropped, a live one kept`, () => {
		const bot = make();
		bot.onBattleLine(ROOM, ['turn', '3']);
		bot.onBattleLine('battle-gen9ou-124', ['turn', '1']);
		bot.battles.get(ROOM).lastSeen -= BATTLE_IDLE_MS + 1000;
		assert.strictEqual(expireIdleBattles(bot), 1);
		assert.deepStrictEqual([...bot.battles.keys()], ['battle-gen9ou-124']);
	});
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
