'use strict';
/**
 * Running from a wild encounter: who may run, and what a refusal leaves behind.
 *
 *   node test/run.test.js
 *
 * Two things players ran into (23 Sep 2026): in a wild double, the left
 * Pokémon fainting locked Run with the right one still standing; and a Run
 * that was refused left the menu shut on "waiting for opponent", because only
 * the trainer refusal sent the turn's request back.
 */

require('../scripts/setup-config');
const { Battle, Teams } = require('pokemon-showdown');
const E = require('../src/encounters');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const set = (species, moves, level = 30) => ({ species, ability: '', item: '', moves, level, evs: {}, ivs: {}, nature: '' });

/** A wild double: p1 is the player with exactly two Pokémon, p2 the wild pair. */
function double(wilds = ['Pidgey', 'Rattata']) {
	const battle = new Battle({ formatid: E.WILD_DOUBLE_FORMAT, seed: [1, 2, 3, 4] });
	battle.setPlayer('p1', { name: 'Ash', team: Teams.pack([set('Pikachu', ['tackle']), set('Eevee', ['tackle'])]) });
	battle.setPlayer('p2', { name: 'Wild Pokemon', team: Teams.pack(wilds.map(s => set(s, ['tackle'], 10))) });
	// Team preview first, then the first turn's move requests.
	if (battle.requestState === 'teampreview') battle.makeChoices('default', 'default');
	return battle;
}

/** Everything a side sends to its player's client from here on. */
function sent(battle) {
	const lines = [];
	const send = battle.send;
	battle.send = (type, data) => { lines.push([type, Array.isArray(data) ? data.join('\n') : String(data)]); return send.call(battle, type, data); };
	return lines;
}

// 1. The left one down, nobody left to send out: the right one can still run.
{
	const b = double();
	check(b.requestState === 'move', `the battle is at a move request (${b.requestState})`);
	b.p1.active[0].faint();
	b.faintMessages();
	check(b.p1.active[0].fainted && !b.p1.active[1].fainted, 'the left Pokémon is down, the right one standing');
	const ok = b.p1.choose('run');
	check(ok === true, 'Run is accepted with the right one still standing');
	check(!!b.p1.rpPendingRun, 'and the run is pending for the turn');
}

// 2. A refused Run puts the menu back, not just the trainer refusal.
{
	const b = double(['Mewtwo', 'Rattata']);
	const lines = sent(b);
	const ok = b.p1.choose('run');
	check(ok === false, 'a legendary will not let you leave');
	const errorAt = lines.findIndex(([type, data]) => type === 'sideupdate' && /\|error\|/.test(data));
	const requestAt = lines.findIndex(([type, data]) => type === 'sideupdate' && /\|request\|/.test(data));
	check(errorAt >= 0, 'the player is told why');
	check(requestAt > errorAt, 'and the turn\'s request is sent again behind it');
}
{
	const b = double();
	const lines = sent(b);
	const ok = b.p1.choose('run masterball');
	check(ok === false, 'a ball is not an escape item');
	check(lines.some(([type, data]) => type === 'sideupdate' && /\|request\|/.test(data)), 'and the menu comes back for that too');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
