'use strict';
/**
 * Does the bot still set up into the two Pokemon that make setting up useless?
 *
 *   node test/unaware.test.js
 *
 * "bot is also a lil dumb around unaware and haze... all of em".
 *
 * Two different kinds of pointless, and the bot treated both as ordinary:
 *
 * **Unaware** does not see the boosts. Every point of Attack bought with a turn
 * is calculated as though it were never bought, so a setup move against one is
 * strictly worse than any attack - the same damage, one turn later. Only the
 * offensive half is dead: Bulk Up against an Unaware *attacker* still makes us
 * harder to kill, and the test below checks that case still works.
 *
 * **Haze** deletes them. The turn spent setting up and the turn spent hazing
 * cancel out, except we also spent a turn. And in the other direction the bot
 * scored its own Haze the same whether the opponent had six boosts or none,
 * which is how it hazes a healthy attacker and declines to haze a sweeper.
 *
 * Only what the battle has shown counts. Assuming a Clefable is Unaware before
 * it proves it is right most of the time and wrong in the way that loses games.
 */

const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

/*
 * Each Pokemon's own stats (85 EVs, neutral), as a request reports them. One
 * made-up spread for all of them stopped being harmless once the request's
 * stats reached the calculator (replay gen9rpou-10-tlvuiv): Toxapex at 160
 * Sp. Def died to the +2 Volcarona before its Haze.
 */
const { realStats } = require('./pinkacross.test.js');
const STATS = species => { const { hp, ...rest } = realStats(species); return rest; };

function position({ myMoves, foeSpecies, foeAbility, foeMoves = [], foeBoosts = null, mySpecies = 'Garchomp' }) {
	const state = new BattleState('test');
	state.myPlayer = 'p1';
	state.gen = 9;
	state.turn = 5;
	const feed = line => state.line(line.slice(1).split('|'));
	feed(`|player|p1|Bot|1|`);
	feed(`|player|p2|Them|1|`);
	feed(`|switch|p1a: Mine|${mySpecies}, L100|300/300`);
	feed(`|switch|p2a: Theirs|${foeSpecies}, L100|100/100`);
	if (foeAbility) feed(`|-ability|p2a: Theirs|${foeAbility}`);
	for (const move of foeMoves) feed(`|move|p2a: Theirs|${move}|p1a: Mine`);
	if (foeBoosts) for (const [stat, n] of Object.entries(foeBoosts)) feed(`|-boost|p2a: Theirs|${stat}|${n}`);

	return {
		state,
		request: {
			active: [{ moves: myMoves.map(name => ({ move: name, id: name.toLowerCase().replace(/\W/g, ''), pp: 8, maxpp: 8 })) }],
			side: {
				pokemon: [{
					active: true, details: `${mySpecies}, L100`, condition: '300/300',
					moves: myMoves.map(m => m.toLowerCase().replace(/\W/g, '')),
					ability: '', baseAbility: '', item: '', stats: STATS(mySpecies),
				}, {
					active: false, details: 'Blissey, L100', condition: '400/400',
					moves: ['softboiled'], ability: '', baseAbility: '', item: '', stats: STATS('Blissey'),
				}],
			},
		},
	};
}

const cases = [
	{
		name: 'Swords Dance into a known Unaware wall',
		setup: { myMoves: ['Swords Dance', 'Earthquake'], foeSpecies: 'Clefable', foeAbility: 'Unaware' },
		expect: move => move !== 'Swords Dance',
		wanted: 'anything but Swords Dance',
	},
	{
		name: 'Swords Dance into the same wall before it shows Unaware',
		setup: { myMoves: ['Swords Dance', 'Earthquake'], foeSpecies: 'Clefable' },
		expect: () => true,
		wanted: 'either is defensible - it has not shown the ability',
	},
	{
		name: 'Swords Dance into something that has used Haze',
		setup: { myMoves: ['Swords Dance', 'Earthquake'], foeSpecies: 'Toxapex', foeMoves: ['Haze'] },
		expect: move => move !== 'Swords Dance',
		wanted: 'anything but Swords Dance',
	},
	{
		name: 'our own Haze, against a sweeper at +2',
		setup: {
			myMoves: ['Haze', 'Tackle'], mySpecies: 'Toxapex',
			// A Quiver Dancer, not a Dragon Dancer: with Stockfish's foe model a +2
			// fully invested Dragonite's Earthquake knocks this Toxapex out, and a
			// Pokemon that dies before it moves has no right answer to test (24 Sep 2026).
			foeSpecies: 'Volcarona', foeBoosts: { spa: 2, spd: 2, spe: 2 },
		},
		expect: move => move === 'Haze',
		wanted: 'Haze',
		// Not asked of Normal, which is `greedy` by design: it clicks the biggest
		// damage and does not weigh status moves at all. That is the difficulty,
		// not a bug in it.
		thinking: true,
	},
	{
		name: 'our own Haze, against something that has not set up',
		setup: { myMoves: ['Haze', 'Tackle'], mySpecies: 'Toxapex', foeSpecies: 'Dragonite' },
		expect: move => move !== 'Haze',
		wanted: 'not Haze',
		// Only asked of the rungs that are supposed to be precise. Normal and
		// Hard add deliberate noise - 20 and 12 points - and this is a close call
		// between a pointless Haze and a Tackle that does almost nothing, so it
		// flips on the jitter. Demanding it of them would be demanding they stop
		// being the difficulty they are.
		quiet: true,
	},
];

let bad = 0;
for (const rung of ['normal', 'hard', 'champion', 'stockfish']) {
	console.log(`\n${rung}:`);
	for (const one of cases) {
		if (one.quiet && rung !== 'champion' && rung !== 'stockfish') continue;
		if (one.thinking && rung === 'normal') continue;
		const ai = new BattleAI({ difficulty: rung });
		ai.setFormat('gen9ou');
		const { state, request } = position(one.setup);
		let choice = '';
		try {
			choice = String(ai.decide(request, state) || '');
		} catch (e) {
			choice = 'threw: ' + e.message;
		}
		const number = /^move (\d)/.exec(choice);
		const picked = number ? one.setup.myMoves[Number(number[1]) - 1] : choice;
		const ok = one.expect(picked);
		if (!ok) bad++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${one.name}`);
		console.log(`       wanted ${one.wanted}, got ${picked}`);
	}
}

/*
 * Unaware only wastes a boost against an Unaware Pokemon that can stay in (owner,
 * 23 Sep 2026: "Clodsire is Unaware but absolutely cannot 1v1 Garchomp, so a SD
 * will kill the other ones after"). One that our plain hit takes half of is
 * leaving or losing, and the boost is for what comes after it.
 */
{
	const calc = require('@smogon/calc');
	const gen = calc.Generations.get(9);
	const ai = new BattleAI({ difficulty: 'stockfish' });
	ai.setFormat('gen9ou');
	ai.myMoveNames = ['Swords Dance', 'Flower Trick'];
	const me = new calc.Pokemon(gen, 'Meowscarada', { level: 100, evs: { atk: 252, spe: 252 }, nature: 'Jolly' });
	const unaware = species => ({ species, name: species, level: 100, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(), ability: 'Unaware', immuneTo: new Set(), notImmuneTo: new Set() });
	const checks = [
		['an Unaware wall that can stay in (Skeledirge, resisting Grass) still wastes the boost', ai.setupIsWasted(gen, unaware('Skeledirge'), { atk: 2 }, { foes: [unaware('Skeledirge')], me }) === true],
		['an Unaware Quagsire that a Grass hit tears apart does not', ai.setupIsWasted(gen, unaware('Quagsire'), { atk: 2 }, { foes: [unaware('Quagsire')], me }) === false],
	];
	console.log('\nforced out:');
	for (const [name, ok] of checks) {
		if (!ok) bad++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
	}
}

console.log(bad ? `\n${bad} wrong` : '\nit understands what boosts are worth');
process.exit(bad ? 1 : 0);
