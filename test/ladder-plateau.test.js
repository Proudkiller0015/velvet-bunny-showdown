'use strict';
/**
 * Bot plateaus against Showdown's real ladder code, with just enough of the
 * server's globals stubbed to run it.
 *
 *   node test/ladder-plateau.test.js
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plateau-'));
global.Config = {};
global.Ladders = { disabled: false };
global.Users = { getExact: () => null };
global.Monitor = { warn() {}, crashlog() {} };
global.toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pkg = path.dirname(require.resolve('pokemon-showdown/package.json'));
const FS = require(path.join(pkg, 'dist/lib/fs.js')).FS;
const { LadderStore } = require(path.join(pkg, 'dist/server/ladders-local.js'));
const { installPlateaus } = require('../src/ladder-plateau');
const { BOT_FLOORS, MEASURED, BOT_FLOOR } = require('../src/ladder-seed');

check(BOT_FLOOR === 1003 && MEASURED.easy === 1003, 'the lowest rung starts at 1003');
check(MEASURED.easy < MEASURED.normal && MEASURED.normal < MEASURED.hard && MEASURED.hard < MEASURED.champion && MEASURED.champion < MEASURED.stockfish, 'rungs are in order');

const rungs = new Map([['bunnyeasy', 'easy'], ['bunnyhard', 'hard']]);
installPlateaus(LadderStore.prototype, id => rungs.get(id));

(async () => {
	const ladder = new LadderStore('gen9plateautest');
	// Keep it off the real config/ladders.
	ladder.save = async () => {};
	ladder.ladder = [
		['bunnyeasy', 1003, 'Bunny Easy', 0, 0, 0, ''],
		['bunnyhard', 1400, 'Bunny Hard', 0, 0, 0, ''],
		['someplayer', 1000, 'Some Player', 0, 0, 0, ''],
	];
	ladder.getLadder = async () => ladder.ladder;
	const said = [];
	const room = { battle: {}, addRaw: html => { said.push(html); return room; }, add: html => { said.push(html); return room; }, update() {} };

	const [, playerAfter, easyAfter] = await ladder.updateRating('Some Player', 'Bunny Easy', 1, room);
	check(easyAfter === 1003, `a bot at its plateau doesn't drop when it loses (${easyAfter})`);
	check(playerAfter > 1000, `the player still gains rating (${Math.round(playerAfter)})`);
	check(said.some(s => /Bunny Easy is at its plateau \(1003\)/.test(s) && /-0/.test(s)), 'the battle says the bot is at its plateau');

	said.length = 0;
	const [, , hardAfter] = await ladder.updateRating('Some Player', 'Bunny Hard', 1, room);
	check(hardAfter < 1400 && hardAfter >= BOT_FLOORS.hard, `a bot above its plateau still loses rating normally (${Math.round(hardAfter)})`);
	check(!said.some(s => /plateau/.test(s)), 'and no plateau message then');

	const [, , easyWin] = await ladder.updateRating('Some Player', 'Bunny Easy', 0, room);
	check(easyWin > 1003, `bots can climb above their plateau (${Math.round(easyWin)})`);

	fs.rmSync(dir, { recursive: true, force: true });
	void FS;
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
