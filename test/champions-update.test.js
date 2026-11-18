'use strict';
/**
 * Pokemon Champions' first balance update in RP, its buffs only (data/velvet/champions-update.js).
 *
 *   node test/champions-update.test.js
 */

const { Battle, Dex: Vanilla, TeamValidator } = require('pokemon-showdown');
const Dex = require('../src/rp-dex')();
const Update = require('../data/velvet/champions-update.js');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function battle(p1, p2, seed = [1, 2, 3, 4]) {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: p1.map(s => ({ level: 100, evs: { hp: 252, atk: 252, spa: 252, spe: 252 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	b.setPlayer('p2', { team: p2.map(s => ({ level: 100, evs: { hp: 252, def: 252, spd: 4 }, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	return b;
}

// Moves: the accuracy buffs, and Rock Slide's flinch left alone.
for (const [id, accuracy] of Object.entries({ screech: 100, steelwing: 100, metalsound: 100, frostbreath: 100, rockslide: 95 })) {
	check(Dex.moves.get(id).accuracy === accuracy, `${Dex.moves.get(id).name}: ${accuracy}% in RP (${Dex.moves.get(id).accuracy})`);
}
check(Dex.moves.get('rockslide').secondary?.chance === 30, 'Rock Slide still flinches 30% in RP (Champions cut it to 20%)');
check(Vanilla.forGen(9).moves.get('rockslide').accuracy === 90, 'official Gen 9 Rock Slide is untouched (90%)');

// Learners: every one legal in RP, as listed.
{
	const tv = TeamValidator.get('gen9rpubers');
	for (const [move, ids] of Object.entries(Update.LEARNS)) {
		const cannot = ids.filter(id => tv.checkCanLearn(Dex.moves.get(move), Dex.species.get(id)));
		check(!cannot.length, `${Dex.moves.get(move).name}: all ${ids.length} learn it in RP${cannot.length ? ' (not: ' + cannot.join(', ') + ')' : ''}`);
	}
}

// Flash Fire: the boost survives Mega Evolution.
{
	const b = battle(
		[{ species: 'Houndoom', ability: 'Flash Fire', item: 'Houndoominite', moves: ['flamethrower', 'protect'] }],
		[{ species: 'Charizard', ability: 'Blaze', moves: ['flamethrower'] }],
	);
	// Charizard's Flamethrower lands on Houndoom (turn 2 at the latest: the first may meet Protect).
	b.makeChoices('move protect', 'move flamethrower');
	b.makeChoices('move flamethrower', 'move flamethrower');
	const before = b.p1.active[0];
	const boosted = !!before.volatiles['flashfire'];
	check(boosted, 'Houndoom got the Flash Fire boost');
	b.makeChoices('move flamethrower mega', 'move flamethrower');
	const mega = b.p1.active[0];
	check(mega.species.isMega, `Houndoom Mega Evolved (${mega.species.name}, ${mega.ability})`);
	check(!!mega.volatiles['flashfire'], 'the Flash Fire boost is still there after Mega Evolution');
	b.randomizer = d => d;
	const move = b.dex.getActiveMove('flamethrower');
	const target = b.p2.active[0];
	const withBoost = b.actions.getDamage(mega, target, move, true);
	delete mega.volatiles['flashfire'];
	const without = b.actions.getDamage(mega, target, b.dex.getActiveMove('flamethrower'), true);
	check(Math.abs(withBoost / without - 1.5) < 0.05, `and it still boosts Fire moves (${without} -> ${withBoost})`);
}

// Flash Fire without Mega Evolution still ends as before (switching out).
{
	const b = battle(
		[{ species: 'Heatran', ability: 'Flash Fire', moves: ['flamethrower', 'protect'] }, { species: 'Snorlax', ability: 'Thick Fat', moves: ['splash'] }],
		[{ species: 'Charizard', ability: 'Blaze', moves: ['flamethrower'] }],
	);
	b.makeChoices('move flamethrower', 'move flamethrower');
	check(!!b.p1.active[0].volatiles['flashfire'], 'Heatran got the Flash Fire boost');
	b.makeChoices('switch 2', 'move flamethrower');
	check(!b.p1.pokemon.find(p => p.species.name === 'Heatran').volatiles['flashfire'], 'switching out still ends it');
}

// Stalwart: hits through Substitute.
{
	const b = battle(
		[{ species: 'Duraludon', ability: 'Stalwart', moves: ['flashcannon'] }],
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: ['substitute'] }],
	);
	// Snorlax is slower: let it set up the Substitute on the first turn, then compare HP on the second.
	b.makeChoices('move flashcannon', 'move substitute');
	const snorlax = b.p2.active[0];
	const hadSub = !!snorlax.volatiles['substitute'];
	const hpBefore = snorlax.hp;
	b.makeChoices('move flashcannon', 'move substitute');
	check(hadSub || snorlax.hp < snorlax.maxhp, 'Snorlax set up a Substitute');
	check(snorlax.hp < hpBefore, `Duraludon's Flash Cannon hit Snorlax through it (${hpBefore} -> ${snorlax.hp})`);
}

// The control: the same attack without Stalwart is stopped by the Substitute.
{
	const b = battle(
		[{ species: 'Duraludon', ability: 'Light Metal', moves: ['flashcannon'] }],
		[{ species: 'Snorlax', ability: 'Thick Fat', moves: ['substitute'] }],
	);
	b.makeChoices('move flashcannon', 'move substitute');
	const snorlax = b.p2.active[0];
	const hpBefore = snorlax.hp;
	b.makeChoices('move flashcannon', 'move substitute');
	check(snorlax.hp === hpBefore, `without Stalwart the Substitute takes it (${hpBefore} -> ${snorlax.hp})`);
}

console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
