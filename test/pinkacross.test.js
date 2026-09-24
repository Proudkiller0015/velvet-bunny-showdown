'use strict';
/**
 * The rules from docs/research-pinkacross.md, one focused position each.
 *
 *   node test/pinkacross.test.js
 *
 * Each position is the plainest version of the mistake the rule is there to
 * stop, checked on the rungs that carry the rule (champion and stockfish; hard
 * too for accuracy). A win rate cannot say whether the bot did the right thing
 * for the right reason; these can. (24 Sep 2026)
 */

const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

let pass = 0, fail = 0;
function check(name, got, want) {
	const ok = typeof want === 'function' ? want(got) : got === want;
	if (ok) { pass++; console.log(`  ok   ${name}`); }
	else { fail++; console.log(`  FAIL ${name} -> got ${JSON.stringify(got)}`); }
}

/** Level 100, neutral nature, 85 EVs: the spread the AI assumes for a foe. */
function realStats(species) {
	const { Dex } = require('pokemon-showdown');
	const sheet = Dex.species.get(species);
	const base = (sheet.exists && sheet.baseStats) || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
	const stat = n => Math.floor(Math.floor((2 * n + 31 + 21) * 100 / 100 + 5));
	return {
		hp: Math.floor((2 * base.hp + 31 + 21) * 100 / 100 + 100 + 10),
		atk: stat(base.atk), def: stat(base.def), spa: stat(base.spa), spd: stat(base.spd), spe: stat(base.spe),
	};
}

const id = s => String(s).toLowerCase().replace(/\W/g, '');

function mon(species, moves, opts = {}) {
	const st = realStats(species);
	const hp = Math.max(opts.fainted ? 0 : 1, Math.round(st.hp * (opts.hp === undefined ? 100 : opts.hp) / 100));
	return {
		ident: `p2: ${species}`, details: `${species}, L100`,
		condition: opts.fainted ? '0 fnt' : `${hp}/${st.hp}${opts.status ? ' ' + opts.status : ''}`,
		active: !!opts.active, moves: moves.map(id),
		baseAbility: id(opts.ability || ''), ability: id(opts.ability || ''), item: id(opts.item || ''),
		stats: { atk: st.atk, def: st.def, spa: st.spa, spd: st.spd, spe: st.spe },
	};
}

/**
 * A singles position. `me` is the active entry (from mon()), `bench` the rest;
 * `foe` is { species, hp (percent), moves, boosts, ability }, and `foeBench`
 * adds the rest of their team through a team preview.
 */
function position({ me, myMoves, bench = [], foe, foeBench = [], foeDown = [], turn = 8, hazards = null, weather = '' }) {
	const state = new BattleState('test');
	state.myPlayer = 'p2';
	state.gen = 9;
	state.turn = turn;
	state.weather = weather;
	state.opponent.a = {
		species: foe.species, level: 100, hp: foe.hp === undefined ? 100 : foe.hp, maxhp: 100, status: foe.status || '', fainted: false,
		boosts: foe.boosts || {}, moves: new Set(foe.moves || []), item: foe.item || null, ability: foe.ability || null, tera: null,
		immuneTo: new Set(), notImmuneTo: new Set(),
	};
	const mySpecies = me.details.split(',')[0];
	const cond = /^(\d+)\/(\d+)/.exec(me.condition);
	state.mine.a = { species: mySpecies, level: 100, hp: +cond[1], maxhp: +cond[2], status: '', fainted: false, boosts: me.boosts || {}, moves: new Set(), tera: null };
	if (foeBench.length || foeDown.length) {
		state.preview = { p1: [foe.species, ...foeBench, ...foeDown].map(species => ({ species, level: 100 })), p2: [] };
		state.theirDown = foeDown.slice();
	}
	if (hazards) state.hazards.p2 = hazards;
	me.active = true;
	const active = [{ moves: myMoves.map(m => ({ move: m, id: id(m), pp: 16, maxpp: 16, target: 'normal', disabled: false })) }];
	return { request: { active, side: { name: 'Bot', id: 'p2', pokemon: [me, ...bench] }, rqid: 1 }, state };
}

/** Run the same position on several rungs, several times each (hard has noise). */
function onRungs(rungs, times, build, judge, label) {
	for (const rung of rungs) {
		let good = 0, last = '';
		// Hard adds noise and the odd random click, so it gets more tries and a lower bar.
		const tries = rung === 'hard' ? times * 2 : times;
		for (let i = 0; i < tries; i++) {
			// OFF='{"accuracy":false}' replays a position with a rule switched off, to
			// show the position actually tests the rule.
			const ai = new BattleAI({ difficulty: rung, cfg: process.env.OFF ? JSON.parse(process.env.OFF) : undefined });
			ai.setFormat('gen9ou');
			const { request, state } = build();
			last = String(ai.decide(request, state));
			if (judge(last, request)) good++;
		}
		check(`${rung}: ${label} (${good}/${tries})`, good, n => n === tries || (rung === 'hard' && n >= tries * 0.6));
		if (good < tries) console.log(`         last choice: ${last}`);
	}
}

const moveName = (choice, request) => {
	const n = +(/^move (\d)/.exec(choice) || [])[1];
	return n ? request.active[0].moves[n - 1].move : choice;
};

// ---------------------------------------------------------------- accuracy
// Required from a scratch script, it hands over the helpers and runs nothing.
const MAIN = require.main === module;

if (MAIN) console.log('\n--- A10: accuracy is part of a move\'s value ---');
if (MAIN) {
	// Both kill a Tyranitar at a third of its health; one of them misses three times in ten.
	onRungs(['hard', 'champion', 'stockfish'], 6, () => position({
		me: mon('Lucario', ['Focus Blast', 'Close Combat'], { item: '' }),
		myMoves: ['Focus Blast', 'Close Combat'],
		foe: { species: 'Tyranitar', hp: 30, moves: ['Crunch'] },
	}), (c, r) => moveName(c, r) === 'Close Combat', 'takes the 100% KO over the 70% one');

	// Thunder against Thunderbolt, neither a KO: 110 x 0.7 is less than 90 x 1.
	onRungs(['hard', 'champion', 'stockfish'], 6, () => position({
		me: mon('Raikou', ['Thunder', 'Thunderbolt']),
		myMoves: ['Thunder', 'Thunderbolt'],
		foe: { species: 'Slowbro', hp: 100, moves: ['Scald'] },
	}), (c, r) => moveName(c, r) === 'Thunderbolt', 'Thunderbolt over Thunder when neither kills');

	// In rain Thunder cannot miss, so the bigger number is right again.
	onRungs(['champion', 'stockfish'], 3, () => position({
		me: mon('Raikou', ['Thunder', 'Thunderbolt']),
		myMoves: ['Thunder', 'Thunderbolt'],
		foe: { species: 'Slowbro', hp: 100, moves: ['Scald'] },
		weather: 'RainDance',
	}), (c, r) => moveName(c, r) === 'Thunder', 'Thunder in the rain');

	// The inaccurate move is still right when it alone kills.
	onRungs(['champion', 'stockfish'], 3, () => position({
		me: mon('Lucario', ['Focus Blast', 'Vacuum Wave']),
		myMoves: ['Focus Blast', 'Vacuum Wave'],
		foe: { species: 'Tyranitar', hp: 70, moves: ['Crunch'] },
	}), (c, r) => moveName(c, r) === 'Focus Blast', 'Focus Blast when only it kills');
}

// ------------------------------------------------------ setup when winning
if (MAIN) console.log('\n--- A11: no setup when the unboosted Pokemon already wins ---');
if (MAIN) {
	const moves = ['Swords Dance', 'Earthquake', 'Dragon Claw'];
	// A fast Garchomp; Toxapex in front (a 2HKO that barely scratches it), and a
	// Heatran and a Magnezone behind, both slower and both OHKOed by Earthquake.
	const board = foeBench => () => {
		const p = position({
			me: mon('Garchomp', moves), myMoves: moves, bench: [mon('Blissey', ['Soft-Boiled'])],
			foe: { species: 'Toxapex', hp: 100, moves: ['Surf'] }, foeBench, foeDown: ['Pikachu', 'Raichu', 'Eevee'],
		});
		p.request.side.pokemon[0].stats.spe = 333;
		return p;
	};
	onRungs(['champion', 'stockfish'], 3, board(['Heatran', 'Magnezone']),
		(c, r) => moveName(c, r) === 'Earthquake', 'attacks when Earthquake already beats all that is left');
	// With a Dondozo behind, unboosted Earthquake does not win and the Swords Dance is the plan.
	// (Champion only: Stockfish's search already prefers the Earthquake here with the rule off.)
	onRungs(['champion'], 3, board(['Heatran', 'Dondozo']),
		(c, r) => moveName(c, r) === 'Swords Dance', 'still sets up when a foe behind survives the unboosted hit');
}

module.exports = { position, mon, onRungs, moveName, check, realStats };

if (require.main === module) {
	// The later sections register themselves below this line as they are added.
	process.on('exit', () => {
		console.log(`\n=== ${pass} passed, ${fail} failed`);
		process.exitCode = fail ? 1 : 0;
	});
}
