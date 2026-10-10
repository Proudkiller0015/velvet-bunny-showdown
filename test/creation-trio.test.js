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

// Who gets what: the normal forms and Dialga-/Palkia-Origin share; Giratina-Origin has its own.
for (const [id, ability] of [['dialga', 'Timeless'], ['palkia', 'Rending Space'], ['giratina', 'Distortion World'],
	['dialgaorigin', 'Timeless'], ['palkiaorigin', 'Rending Space'], ['giratinaorigin', 'Renegade Drift']]) {
	check(Object.values(Dex.species.get(id).abilities).includes(ability), `${id} can have ${ability}`);
}
for (const id of ['dialga', 'palkia', 'giratina']) check(!!Dex.data.Learnsets[id].learnset.explosion, `${id} learns Explosion`);
{
	const v = new (require('pokemon-showdown').TeamValidator)('gen9rpubers');
	const said = v.validateTeam([{ species: 'Giratina-Origin', ability: 'Renegade Drift', item: 'Griseous Core', moves: ['explosion', 'shadowforce'], evs: { hp: 4 }, level: 100 }]);
	check(!said, `Giratina-Origin with Renegade Drift and Explosion is legal${said ? ': ' + said.join('; ') : ''}`);
}

// No recoil for the trio: Steel Beam, Head Smash. Explosion still faints.
{
	const b = battle(
		[{ species: 'Dialga', ability: 'Timeless', moves: ['steelbeam', 'headsmash', 'explosion'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
	);
	const d = b.p1.active[0];
	b.makeChoices('move 1', 'move 1');
	check(d.hp === d.maxhp, `Steel Beam costs Dialga nothing (${d.hp}/${d.maxhp})`);
	b.makeChoices('move 2', 'move 1');
	check(d.hp === d.maxhp, 'Head Smash: no recoil');
	b.makeChoices('move 3', 'move 1');
	check(d.fainted, 'Explosion still faints it');
}

// Renegade Drift: Ground, Fairy and Spikes miss it; nothing inverted.
{
	const b = battle(
		[{ species: 'Garchomp', ability: 'Rough Skin', moves: ['earthquake', 'playrough', 'spikes', 'shadowclaw'] }],
		[{ species: 'Giratina-Origin', ability: 'Renegade Drift', item: 'Griseous Core', moves: ['splash'] }, { species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }],
	);
	const g = b.p2.active[0];
	b.makeChoices('move 1', 'move 1');
	check(g.hp === g.maxhp, 'Earthquake misses it');
	b.makeChoices('move 2', 'move 1');
	check(g.hp === g.maxhp, 'Play Rough misses it');
	check(g.runEffectiveness(b.dex.getActiveMove('shadowclaw')) > 0, 'Ghost still hits it super effectively (no inversion)');
	check(g.isGrounded() === null, 'it is ungrounded like Levitate');
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

// Timeless: no recharge after Roar of Time, and charge moves in one turn. Dialga learns Meteor Beam.
{
	const b = battle(
		[{ species: 'Dialga', ability: 'Timeless', moves: ['roaroftime', 'meteorbeam', 'solarbeam'] }],
		[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
	);
	b.makeChoices('move 1', 'move 1');
	check(!b.p1.active[0].volatiles['mustrecharge'], 'Dialga has no recharge turn');
	check(/doesn't need to recharge/.test(log(b)), 'and it says so');
	let hp = b.p2.active[0].hp;
	b.makeChoices('move 2', 'move 1');
	check(b.p1.active[0].boosts.spa === 1 && !b.p1.active[0].volatiles['twoturnmove'], 'Meteor Beam fires at once and still raises Sp. Atk');
	check(/\|move\|p1a: Dialga\|Meteor Beam\|p2a/.test(log(b)) || /-damage\|p2a: Blissey/.test(log(b)), 'and hits the same turn');
	b.makeChoices('move 3', 'move 1');
	check(!b.p1.active[0].volatiles['twoturnmove'], 'Solar Beam without sun: one turn too');
	check(!!Dex.data.Learnsets.dialga.learnset.meteorbeam && !!Dex.data.Learnsets.dialga.learnset.shiftgear, 'Dialga learns Meteor Beam and Shift Gear');
}

// Rending Space: Spacial Rend always crits, a normal move crits more than usual, crits are 2x.
{
	let crits = 0, pumps = 0;
	const N = 60;
	for (let i = 0; i < N; i++) {
		const b = battle(
			[{ species: 'Palkia', ability: 'Rending Space', moves: ['spacialrend'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, 7, 9, 11],
		);
		b.makeChoices('move 1', 'move 1');
		if (/\|-crit\|/.test(log(b)) || /\|-miss\|/.test(log(b))) crits++;   // a miss is Spacial Rend's 95%, not the ability
		const c = battle(
			[{ species: 'Palkia', ability: 'Rending Space', moves: ['surf'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
			[i, 7, 9, 11],
		);
		c.makeChoices('move 1', 'move 1');
		if (/\|-crit\|/.test(log(c))) pumps++;
	}
	check(crits === N, `Spacial Rend crit ${crits}/${N}`);
	check(pumps >= 3 && pumps <= 18, `Surf crits about 1 in 8 (${pumps}/${N})`);
	const dmg = ability => {
		const b = battle(
			[{ species: 'Palkia', ability, moves: ['spacialrend'] }],
			[{ species: 'Blissey', ability: 'Natural Cure', moves: ['softboiled'] }],
		);
		b.randomizer = d => d;
		const m = b.dex.getActiveMove('spacialrend');
		m.willCrit = true;
		return b.actions.getDamage(b.p1.active[0], b.p2.active[0], m, true);
	};
	const ours = dmg('Rending Space'), plain = dmg('Pressure');
	check(Math.abs(ours / plain - 4 / 3) < 0.02, `crits deal 2x instead of 1.5x (${plain} -> ${ours})`);
}

// Distortion World: the chart turns over while Giratina is out.
{
	const b = battle(
		[{ species: 'Gengar', ability: 'Cursed Body', moves: ['shadowball', 'moonblast'] }, { species: 'Sylveon', ability: 'Pixilate', moves: ['moonblast'] }],
		[{ species: 'Giratina', ability: 'Distortion World', moves: ['splash', 'dragonpulse'] }, { species: 'Snorlax', ability: 'Thick Fat', moves: ['splash'] }],
	);
	check(/The battlefield turned inside out/.test(log(b)), 'it announces itself');
	const gengar = b.p1.active[0], gira = b.p2.active[0], lax = b.p2.pokemon[1];
	check(gira.runEffectiveness(b.dex.getActiveMove('shadowball')) < 0, 'Ghost on Giratina: resisted, not super effective');
	check(gira.runImmunity(b.dex.getActiveMove('tackle')) && gira.runEffectiveness(b.dex.getActiveMove('tackle')) > 0, 'Normal on Giratina: super effective, not immune');
	{
		const e = battle(
			[{ species: 'Snorlax', ability: 'Thick Fat', moves: ['splash'] }],
			[{ species: 'Giratina', ability: 'Distortion World', moves: ['shadowball'] }],
		);
		const target = e.p1.active[0];
		check(target.runImmunity(e.dex.getActiveMove('shadowball')) && target.runEffectiveness(e.dex.getActiveMove('shadowball')) > 0, 'Ghost on Normal: super effective');
		e.makeChoices('move 1', 'move 1');
		check(target.hp < target.maxhp && /supereffective\|p1a: Snorlax/.test(log(e)), 'and Shadow Ball really hits Snorlax for super effective damage');
	}
	b.makeChoices('move 2', 'move 1');
	check(gira.hp === gira.maxhp && /-immune\|p2a: Giratina\|\[from\] ability: Distortion World/.test(log(b)), 'Dragon types are immune to Fairy');
	b.makeChoices('switch 2', 'switch 2');
	check(/The battlefield returned to normal/.test(log(b)), 'and it ends when Giratina leaves');
	check(!b.p2.active[0].runImmunity(b.dex.getActiveMove('shadowball')), 'Normal is immune to Ghost again');
	// Two Giratinas do not cancel out.
	const d = battle(
		[{ species: 'Giratina', ability: 'Distortion World', moves: ['splash'] }],
		[{ species: 'Giratina', ability: 'Distortion World', moves: ['splash'] }],
	);
	check(d.p2.active[0].runEffectiveness(d.dex.getActiveMove('shadowball')) < 0, 'two Distortion Worlds still invert once');
}

// Shadow Force through Protect and Reflect.
{
	const hit = reflect => {
		const b = battle(
			[{ species: 'Giratina', ability: 'Pressure', moves: ['shadowforce'] }],
			[{ species: 'Slowbro', ability: 'Oblivious', moves: ['splash', 'reflect', 'protect'] }],
		);
		b.randomizer = d => d;
		if (reflect) b.p2.addSideCondition('reflect', b.p2.active[0]);
		const m = b.dex.getActiveMove('shadowforce');
		b.singleEvent('ModifyMove', m, null, b.p1.active[0], b.p2.active[0], m, m);
		return b.actions.getDamage(b.p1.active[0], b.p2.active[0], m, true);
	};
	check(hit(true) === hit(false), `Reflect does not cut it (${hit(true)} vs ${hit(false)})`);
	const b = battle(
		[{ species: 'Giratina', ability: 'Pressure', moves: ['shadowforce'] }],
		[{ species: 'Slowbro', ability: 'Oblivious', moves: ['splash', 'protect'] }],
	);
	b.makeChoices('move 1', 'move 1');
	b.makeChoices('move 1', 'move 2');
	check(b.p2.active[0].hp < b.p2.active[0].maxhp, 'and it goes through Protect');
}
for (const [id, bp] of Object.entries({ dragonpulse: 100, icywind: 60, ancientpower: 70, ominouswind: 70, silverwind: 70 })) {
	check(Dex.moves.get(id).basePower === bp, `${Dex.moves.get(id).name} is ${bp} power`);
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
