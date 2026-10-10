'use strict';
/**
 * The 10 Oct 2026 minor update: Twister at 85 power and 30% flinch, and Explosion /
 * Self-Destruct halving the target's Defense as in Generations 1-4.
 *
 *   node test/classic-moves.test.js
 */

const { Battle } = require('pokemon-showdown');
const Dex = require('../src/rp-dex')();

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function battle(p1, p2, seed = [1, 2, 3, 4]) {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: p1.map(s => ({ level: 100, evs: { hp: 252, atk: 252, spa: 252 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	b.setPlayer('p2', { team: p2.map(s => ({ level: 100, evs: { hp: 252, def: 252, spd: 4 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	return b;
}

const twister = Dex.moves.get('twister');
check(twister.basePower === 85, `Twister is 85 power (${twister.basePower})`);
check(twister.secondary && twister.secondary.chance === 30 && twister.secondary.volatileStatus === 'flinch', 'Twister flinches 30%');

for (const id of ['explosion', 'selfdestruct']) {
	const b = battle(
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: [id] }],
		[{ species: 'Skarmory', ability: 'Sturdy', moves: ['splash'] }],
	);
	const [atk, def] = [b.p1.active[0], b.p2.active[0]];
	b.randomizer = d => d;   // no damage roll, so the two numbers compare
	const ours = b.actions.getDamage(atk, def, b.dex.getActiveMove(id), true);
	const plain = b.dex.getActiveMove(id);
	delete plain.onBasePower;
	const vanilla = b.actions.getDamage(atk, def, plain, true);
	// Doubling the power and halving Defense come out within a point or two of each other.
	check(Math.abs(ours / vanilla - 2) < 0.05, `${plain.name} hits as if Defense were halved (${vanilla} -> ${ours})`);
}

// Twister flinches about 30% of the time from a faster user.
{
	let flinched = 0;
	const N = 300;
	for (let i = 0; i < N; i++) {
		const b = battle(
			[{ species: 'Dragapult', ability: 'Infiltrator', moves: ['twister'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, i + 1, i + 2, i + 3],
		);
		b.makeChoices('move 1', 'move 1');
		if (/\|cant\|p2a: Blissey\|flinch/.test(b.log.join('\n'))) flinched++;
	}
	check(flinched / N > 0.24 && flinched / N < 0.36, `Twister flinch rate ${(100 * flinched / N).toFixed(0)}%`);
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
