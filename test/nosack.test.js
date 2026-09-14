'use strict';
/**
 * Does the bot still throw a Pokemon away when something walls the hit?
 *
 *   node test/nosack.test.js
 *
 * The complaint, in the user's words: "it sacrifices when it had an obvious
 * switch in... all of em do it". It was not an oversight - it was a rule. When
 * the active was dying and happened to be the cheap end of the team, the switch
 * margin was set to 70, which means "nothing on the bench is worth a turn", and
 * a Pokemon that resists the incoming attack sat there watching it happen.
 *
 * The position below is the plainest possible version of it: a Fire attacker
 * about to kill our Grass-type, with a Water-type on the bench that takes
 * almost nothing from the same attack. There is no argument for the sacrifice.
 * Coming in is free.
 *
 * The second case is the argument *for* sacrificing, and it has to keep
 * working: when everything on the bench takes just as much as the thing that is
 * already dying, the switch buys nothing and costs a turn.
 */

const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

function position({ mine, bench, foe, foeMoves }) {
	const state = new BattleState('test');
	state.myPlayer = 'p1';
	state.gen = 9;
	state.turn = 6;
	for (const line of [
		`|player|p1|Bot|1|`,
		`|player|p2|Them|1|`,
		`|switch|p1a: ${mine.name}|${mine.species}, L100|${mine.hp}`,
		`|switch|p2a: ${foe.name}|${foe.species}, L100|100/100`,
		...foeMoves.map(move => `|move|p2a: ${foe.name}|${move}|p1a: ${mine.name}`),
		// `line` wants the parts, already split and without the leading empty -
		// handed a raw string it silently parses nothing, and then there is no
		// opponent, no incoming damage, and no switching decision to test.
	]) state.line(line.slice(1).split('|'));

	return {
		state,
		request: {
			active: [{ moves: mine.moves.map(name => ({ move: name, id: name.toLowerCase().replace(/\W/g, ''), pp: 8, maxpp: 8 })) }],
			side: {
				pokemon: [
					{
						active: true, details: `${mine.species}, L100`, condition: mine.hp,
						moves: mine.moves.map(m => m.toLowerCase().replace(/\W/g, '')),
						ability: mine.ability || '', item: '', baseAbility: mine.ability || '',
						stats: mine.stats,
					},
					...bench.map(one => ({
						active: false, details: `${one.species}, L100`, condition: one.hp,
						moves: one.moves.map(m => m.toLowerCase().replace(/\W/g, '')),
						ability: one.ability || '', item: '', baseAbility: one.ability || '',
						stats: one.stats,
					})),
				],
			},
		},
	};
}

const STATS = { atk: 200, def: 200, spa: 200, spd: 200, spe: 200 };

const cases = [
	{
		name: 'a Water-type on the bench, against the Fire move that is killing us',
		setup: {
			mine: { name: 'Leafy', species: 'Sceptile', hp: '60/300', moves: ['Leaf Blade', 'Giga Drain'], stats: { ...STATS, spe: 120 } },
			bench: [
				{ species: 'Gyarados', hp: '330/330', moves: ['Waterfall', 'Earthquake'], stats: STATS },
				{ species: 'Lopunny', hp: '300/300', moves: ['Return'], stats: STATS },
			],
			foe: { name: 'Burny', species: 'Charizard' },
			foeMoves: ['Flamethrower'],
		},
		expect: 'switch',
	},
	{
		name: 'nothing on the bench takes it any better',
		setup: {
			mine: { name: 'Leafy', species: 'Sceptile', hp: '60/300', moves: ['Leaf Blade'], stats: { ...STATS, spe: 120 } },
			bench: [
				{ species: 'Sunflora', hp: '90/300', moves: ['Solar Beam'], stats: STATS },
				{ species: 'Shiftry', hp: '80/300', moves: ['Leaf Blade'], stats: STATS },
			],
			foe: { name: 'Burny', species: 'Charizard' },
			foeMoves: ['Flamethrower'],
		},
		expect: 'move',
	},
];

let bad = 0;
for (const rung of ['hard', 'champion', 'stockfish']) {
	console.log(`\n${rung}:`);
	for (const one of cases) {
		const ai = new BattleAI({ difficulty: rung });
		ai.setFormat('gen9ou');
		const { state, request } = position(one.setup);
		let choice = '';
		try {
			choice = String(ai.decide(request, state) || '');
		} catch (e) {
			choice = 'threw: ' + e.message;
			if (process.env.TRACE) console.log(String(e.stack).split(String.fromCharCode(10)).slice(0, 6).join(' | '));
		}
		const kind = choice.startsWith('switch') ? 'switch' : choice.startsWith('move') ? 'move' : choice;
		const ok = kind === one.expect;
		if (!ok) bad++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${one.name}`);
		console.log(`       wanted ${one.expect}, got ${choice}`);
	}
}

console.log(bad ? `\n${bad} wrong` : '\nit stops throwing Pokemon away');
process.exit(bad ? 1 : 0);
