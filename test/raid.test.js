'use strict';
/**
 * Max Raids: three trainers and one Dynamaxed boss, in a free-for-all.
 *
 *   node test/raid.test.js
 *
 * What a raid promises, checked in a real battle: the boss is big and stays
 * Dynamaxed, trainers cannot hit each other, a ball bounces off until the boss
 * is worn down, and a caught or knocked-out boss ends it for everybody.
 */

const { Battle, Teams } = require('pokemon-showdown');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const set = (species, moves, level = 50) => ({ species, ability: '', item: '', moves, level, evs: {}, ivs: {}, nature: '' });
const team = sets => Teams.pack(sets);

/** A raid: p1 is the boss (the RP bot's "Raid ..." name), p2-p4 the trainers. */
function raid(bossSpecies = 'Gyarados', bossMoves = ['tackle'], seed = [2, 4, 6, 8]) {
	const battle = new Battle({ formatid: 'gen9rpraid', seed });
	battle.setPlayer('p1', { name: `Raid ${bossSpecies}`, team: team([set(bossSpecies, bossMoves, 60)]) });
	battle.setPlayer('p2', { name: 'Ash', team: team([set('Pikachu', ['thunderbolt', 'quickattack'])]) });
	battle.setPlayer('p3', { name: 'Misty', team: team([set('Starmie', ['surf', 'recover'])]) });
	battle.setPlayer('p4', { name: 'Brock', team: team([set('Onix', ['rockslide', 'harden'])]) });
	return battle;
}

// 1. Four sides, and the boss is the one the bot named.
{
	const b = raid();
	check(b.sides.length === 4, `a raid is four sides (${b.sides.length})`);
	check(b.p1.rpRaidBoss === true, 'the "Raid ..." side is the boss');
	check(!b.p2.rpRaidBoss && !b.p3.rpRaidBoss && !b.p4.rpRaidBoss, 'the trainers are not');
}

// 2. The boss is big, and Dynamaxed for good.
{
	const b = raid();
	const boss = b.p1.active[0];
	const plain = new Battle({ formatid: 'gen9rpbattle', seed: [2, 4, 6, 8] });
	plain.setPlayer('p1', { name: 'A', team: team([set('Gyarados', ['tackle'], 60)]) });
	plain.setPlayer('p2', { name: 'B', team: team([set('Pikachu', ['tackle'], 60)]) });
	const ordinary = plain.p1.pokemon[0].maxhp;
	check(boss.maxhp > ordinary * 5, `the boss has far more HP than the same Pokémon would (${boss.maxhp} vs ${ordinary})`);
	check(boss.hp === boss.maxhp, 'and starts full');
	check(!!boss.volatiles['dynamax'], 'it is Dynamaxed from the start');

	// Three turns is where an ordinary Dynamax runs out.
	for (let i = 0; i < 4; i++) b.makeChoices('move 1', 'move 1', 'move 1', 'move 1');
	check(!!b.p1.active[0].volatiles['dynamax'], 'and still Dynamaxed four turns later');
}

// 3. Everything a trainer throws goes at the boss, and spread moves don't splash the party.
{
	// A damaging move on the boss: Dynamax turns a status move into Max Guard, which
	// would block the very damage this is checking for.
	const b = raid('Gyarados', ['tackle']);
	const boss = b.p1.active[0];
	const misty = b.p3.active[0];
	const brock = b.p4.active[0];
	const before = { misty: misty.hp, brock: brock.hp, boss: boss.hp };
	// p2 aims at p3 rather than the boss; p3 uses Surf, which hits everything around it.
	b.makeChoices('move 1', 'move 1', 'move 1', 'move 2');
	check(misty.hp === before.misty && brock.hp === before.brock, 'no trainer is hurt by another');
	check(boss.hp < before.boss, 'and the damage goes to the boss instead');
	check(b.log.some(l => /\|move\|p2a: Pikachu\|Thunderbolt\|p1a/.test(l)), 'a move with no target picked lands on the boss, not on a trainer');
}

// 4. A ball bounces off a healthy boss, and lands once it is worn down.
{
	const b = raid();
	const boss = b.p1.active[0];
	const errors = [];
	b.p2.emitChoiceError = function (message) { errors.push(message); return false; };
	b.p2.choose('ball ultra');
	check(errors.some(e => /bounces off a raid boss/i.test(e)), `a ball is refused at full HP (${errors[0] || 'no error'})`);

	boss.hp = Math.floor(boss.maxhp * 0.1);
	errors.length = 0;
	const ok = b.p2.choose('ball ultra');
	check(ok !== false && !errors.length, `and accepted at 10% (${errors[0] || 'accepted'})`);
	check(!!b.p2.rpPendingBall, 'the throw is on the choice');
}

// 5. The boss going down ends the raid there and then.
{
	const b = raid('Magikarp', ['splash']);
	b.p1.active[0].faint();
	b.faintMessages();
	check(b.ended, 'the raid ends when the boss faints');
	check(b.log.some(l => /raid boss went down/i.test(l)), 'and says the spoils are shared');
}

// 6. Nothing about a raid leaks into an ordinary wild encounter.
{
	const b = new Battle({ formatid: 'gen9rpbattlewildencounter', seed: [1, 1, 1, 1] });
	b.setPlayer('p1', { name: 'Ash', team: team([set('Pikachu', ['thunderbolt'])]) });
	b.setPlayer('p2', { name: 'Wild Rattata', team: team([set('Rattata', ['tackle'], 5)]) });
	const errors = [];
	b.p1.emitChoiceError = function (message) { errors.push(message); return false; };
	b.p1.choose('ball poke');
	check(!errors.length, `a wild Pokémon can still be thrown at from full HP (${errors[0] || 'accepted'})`);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
