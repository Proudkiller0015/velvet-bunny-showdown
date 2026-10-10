'use strict';
/**
 * The creation trio's buff (10 Oct 2026): Shadow Force catches a switch while Giratina
 * is vanished and uses the better attacking stat; Timeless, Rending Space and
 * Distortion World do what they say.
 *
 *   node test/creation-trio.test.js
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
const log = b => b.log.join('\n');

// The abilities are on the normal forms only.
for (const [id, ability] of [['dialga', 'Timeless'], ['palkia', 'Rending Space'], ['giratina', 'Distortion World']]) {
	check(Object.values(Dex.species.get(id).abilities).includes(ability), `${id} can have ${ability}`);
	check(!Object.values(Dex.species.get(id + 'origin').abilities).includes(ability), `${id}-Origin cannot`);
}

// Shadow Force: the foe switches on the vanished turn and is hit on its way out.
{
	const b = battle(
		[{ species: 'Giratina', ability: 'Pressure', moves: ['shadowforce'] }],
		[{ species: 'Slowbro', ability: 'Oblivious', moves: ['splash'] }, { species: 'Chansey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	b.makeChoices('move 1', 'move 1');   // Giratina vanishes
	check(!!b.p1.active[0].volatiles['shadowforce'], 'Giratina vanished');
	const slowbro = b.p2.pokemon[0];
	const before = slowbro.hp;
	b.makeChoices('move 1', 'switch 2');
	const text = log(b);
	check(slowbro.hp < before, `the switching Slowbro took the hit (${before} -> ${slowbro.hp})`);
	check(b.p2.active[0].species.id === 'chansey', 'and the switch still happened');
	check(b.p2.active[0].hp === b.p2.active[0].maxhp, 'Chansey came in untouched');
	check((text.match(/\|move\|p1a: Giratina\|Shadow Force\|p2a/g) || []).length === 1, 'Shadow Force was used once, not twice');
	check(!b.p1.active[0].volatiles['twoturnmove'], 'Giratina is no longer locked in');
	b.makeChoices('move 1', 'move 1');
	check(!!b.p1.active[0].volatiles['shadowforce'], 'next turn it can vanish again');
}

// Shadow Force: special from a special Giratina.
{
	const b = battle(
		[{ species: 'Giratina', ability: 'Pressure', moves: ['shadowforce', 'nastyplot'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	b.makeChoices('move 2', 'move 1');   // +2 Sp. Atk
	const move = b.dex.getActiveMove('shadowforce');
	b.singleEvent('ModifyMove', move, null, b.p1.active[0], b.p2.active[0], move, move);
	check(move.category === 'Special', 'after Nasty Plot, Shadow Force is special');
	const plain = battle(
		[{ species: 'Giratina', ability: 'Pressure', moves: ['shadowforce'], evs: { atk: 252 } }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	const m2 = plain.dex.getActiveMove('shadowforce');
	plain.singleEvent('ModifyMove', m2, null, plain.p1.active[0], plain.p2.active[0], m2, m2);
	check(m2.category === 'Physical', 'an Attack-invested Giratina stays physical');
}

// Timeless: no recharge after Roar of Time.
{
	const b = battle(
		[{ species: 'Dialga', ability: 'Timeless', moves: ['roaroftime'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(!b.p1.active[0].volatiles['mustrecharge'], 'Dialga has no recharge turn');
	check(/doesn't need to recharge/.test(log(b)), 'and it says so');
}

// Rending Space: Spacial Rend always crits; Hydro Pump does not.
{
	let crits = 0, pumps = 0;
	for (let i = 0; i < 20; i++) {
		const b = battle(
			[{ species: 'Palkia', ability: 'Rending Space', moves: ['spacialrend', 'hydropump'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, 7, 9, 11],
		);
		b.makeChoices('move 1', 'move 1');
		if (/\|-crit\|/.test(log(b)) || /\|-miss\|/.test(log(b))) crits++;   // a miss is Spacial Rend's 95%, not the ability
		const c = battle(
			[{ species: 'Palkia', ability: 'Rending Space', moves: ['hydropump'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, 7, 9, 11],
		);
		c.makeChoices('move 1', 'move 1');
		if (/\|-crit\|/.test(log(c))) pumps++;
	}
	check(crits === 20, `Spacial Rend crit 20/20 (${crits})`);
	check(pumps < 6, `Hydro Pump crits only by luck (${pumps}/20)`);
}

// Distortion World: half damage at full HP only.
{
	const dmg = ability => {
		const b = battle(
			[{ species: 'Garchomp', ability: 'Rough Skin', moves: ['dragonclaw'] }],
			[{ species: 'Giratina', ability, moves: ['splash'] }],
		);
		b.randomizer = d => d;
		const g = b.p2.active[0];
		const full = b.actions.getDamage(b.p1.active[0], g, b.dex.getActiveMove('dragonclaw'), true);
		g.hp = g.maxhp - 1;
		const hurt = b.actions.getDamage(b.p1.active[0], g, b.dex.getActiveMove('dragonclaw'), true);
		return [full, hurt];
	};
	const [full, hurt] = dmg('Distortion World');
	check(Math.abs(full / hurt - 0.5) < 0.02, `Distortion World halves at full HP (${full} vs ${hurt})`);
}

// Distortion World: Fairy moves do nothing.
{
	const b = battle(
		[{ species: 'Sylveon', ability: 'Pixilate', moves: ['moonblast'] }],
		[{ species: 'Giratina', ability: 'Distortion World', moves: ['splash'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].hp === b.p2.active[0].maxhp && /-immune\|p2a: Giratina\|\[from\] ability: Distortion World/.test(log(b)), 'Moonblast does nothing to Distortion World Giratina');
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
