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
	const cond = /^(\d+)\/(\d+)/.exec(me.condition) || [0, 0, 1];
	state.mine.a = { species: mySpecies, level: 100, hp: +cond[1], maxhp: +cond[2], status: '', fainted: !+cond[1], boosts: me.boosts || {}, moves: new Set(), tera: null };
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

	// Thunder against Thunderbolt, neither a KO: 110 x 0.7 is less than 90 x 1. (Not on Hard:
	// its +-12 noise is wider than that gap, so there it is a coin flip by design.)
	onRungs(['champion', 'stockfish'], 6, () => position({
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

// ------------------------------------------------------------------ sacking
if (MAIN) console.log('\n--- A14: the Art of Sacking ---');
if (MAIN) {
	const calc = require('@smogon/calc');
	// Scizor has just fainted to a Volcarona that has shown Quiver Dance. Chansey
	// takes almost nothing and does nothing: the boosting turn it hands over ends
	// the game. Lopunny at 70% chips it and lives a hit.
	const fodder = () => {
		const p = position({
			me: mon('Scizor', ['Bullet Punch'], { fainted: true }), myMoves: ['Bullet Punch'],
			bench: [mon('Chansey', ['Soft-Boiled', 'Heal Bell']), mon('Lopunny', ['Double-Edge'], { hp: 70 })],
			foe: { species: 'Volcarona', hp: 100, moves: ['Quiver Dance', 'Fiery Dance'] },
		});
		p.request.forceSwitch = [true];
		delete p.request.active;
		return p;
	};
	onRungs(['champion', 'stockfish'], 2, fodder, c => c === 'switch 3', 'does not send setup fodder in front of a Quiver Dancer');

	// Same position, but the Chansey carries Seismic Toss: now it is not fodder.
	const tosser = () => {
		const p = fodder();
		p.request.side.pokemon[1].moves = ['softboiled', 'seismictoss'];
		return p;
	};
	onRungs(['champion'], 1, tosser, c => /^switch/.test(c), 'still switches normally when the Chansey can hit back');

	// Value: the only answer to a live threat is worth more for it (his 15% Moltres).
	for (const rung of ['champion', 'stockfish']) {
		const on = new BattleAI({ difficulty: rung });
		const off = new BattleAI({ difficulty: rung, cfg: { sacking: false } });
		const p = position({
			me: mon('Chansey', ['Soft-Boiled']), myMoves: ['Soft-Boiled'],
			bench: [mon('Coalossal', ['Stone Edge'], { hp: 70 }), mon('Lopunny', ['Double-Edge'])],
			foe: { species: 'Volcarona', hp: 100, moves: ['Quiver Dance', 'Fiery Dance', 'Bug Buzz'] },
			foeBench: ['Blissey'], foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon'],
		});
		const gen = on.gen(9);
		on._memo = new Map();
		const plan = on.teamPlan(gen, p.state, p.request);
		const coal = p.request.side.pokemon[1];
		check(`${rung}: Coalossal is the sole answer to Volcarona`, plan.rows.get(on.entryKey(coal)).sole, n => n >= 1);
		const vOn = on.monValue(gen, coal, p.state, p.request), vOff = off.monValue(gen, coal, p.state, p.request);
		check(`${rung}: the sole answer is valued up (${vOff.toFixed(0)} -> ${vOn.toFixed(0)})`, vOn > vOff + 8, true);
		on._memo = null;
	}

	// Value: hard-walled by a living foe nothing of ours can wear down.
	for (const rung of ['champion']) {
		const ai = new BattleAI({ difficulty: rung });
		const gen = ai.gen(9);
		const team = foeBench => position({
			me: mon('Chansey', ['Soft-Boiled']), myMoves: ['Soft-Boiled'],
			bench: [mon('Jolteon', ['Thunderbolt'])],
			foe: { species: 'Gyarados', hp: 100, moves: ['Waterfall'] }, foeBench, foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Vaporeon'],
		});
		const walled = team(['Garchomp']), open = team(['Pelipper']);
		const v = p => { ai._memo = new Map(); const out = ai.monValue(gen, p.request.side.pokemon[1], p.state, p.request); ai._memo = null; return out; };
		check(`${rung}: a Jolteon with a living Garchomp and no answer to it is worth less`, v(walled) < v(open) - 5, true);
	}

	// Value: a bench Pokemon our own Stealth Rock would finish is a fixed-price free switch.
	{
		const ai = new BattleAI({ difficulty: 'champion' });
		const gen = ai.gen(9);
		const p = position({
			me: mon('Chansey', ['Soft-Boiled']), myMoves: ['Soft-Boiled'],
			bench: [mon('Charizard', ['Flamethrower'], { hp: 20 }), mon('Lopunny', ['Double-Edge'])],
			foe: { species: 'Gyarados', hp: 100, moves: ['Waterfall'] }, hazards: { 'Stealth Rock': 1 },
		});
		check('champion: dead-on-entry Charizard is kept at the token price', ai.monValue(gen, p.request.side.pokemon[1], p.state, p.request), 15);
	}
	void calc;
}

// -------------------------------------------------------------------- leads
if (MAIN) console.log('\n--- A2-A4: choosing a lead ---');
if (MAIN) {
	const preview = (ours, theirs, rung = 'champion') => {
		const ai = new BattleAI({ difficulty: rung, cfg: process.env.OFF ? JSON.parse(process.env.OFF) : undefined });
		ai.setFormat('gen9ou');
		const state = new BattleState('t');
		state.myPlayer = 'p2';
		state.gen = 9;
		state.preview = { p1: theirs.map(species => ({ species, level: 100 })), p2: [] };
		const request = { teamPreview: true, side: { pokemon: ours.map(([s, moves, item]) => mon(s, moves, { item })) } };
		const choice = String(ai.decide(request, state));
		return { ai, lead: ours[+choice[5] - 1][0] };
	};
	// Volcarona has the best average matchup into a Grass/Steel/Bug team, and it
	// is a Quiver Dance sweeper: it wants its free turn later, not a guess now.
	const ours = [
		['Volcarona', ['Quiver Dance', 'Fiery Dance', 'Bug Buzz', 'Giga Drain']],
		['Garchomp', ['Stealth Rock', 'Earthquake', 'Dragon Claw', 'Fire Fang']],
		['Chansey', ['Soft-Boiled', 'Seismic Toss', 'Toxic']],
		['Lopunny', ['Double-Edge', 'High Jump Kick']],
	];
	for (const rung of ['champion', 'stockfish']) {
		const { lead } = preview(ours, ['Scizor', 'Ferrothorn', 'Breloom', 'Amoonguss', 'Celebi', 'Mew'], rung);
		check(`${rung}: does not lead with the setup sweeper (led ${lead})`, lead, l => l !== 'Volcarona');
	}

	// Their likely lead is the hazard setter, not the sweeper.
	{
		const { ai } = preview(ours, ['Skarmory', 'Volcarona', 'Dragonite', 'Clefable', 'Rotom-Wash', 'Tyranitar']);
		const share = s => ((ai.leadPlan && ai.leadPlan.theirs.find(t => t.species === s)) || {}).share || 0;
		check(`champion: Skarmory is a likelier lead than Volcarona (${share('Skarmory').toFixed(2)} vs ${share('Volcarona').toFixed(2)})`,
			share('Skarmory') > share('Volcarona'), true);
	}

	// The wrong guess costs more with nothing behind to take it: Heatran against a
	// Garchomp lead, without and then with a Corviknight to switch to.
	{
		const theirs = ['Garchomp', 'Ferrothorn', 'Scizor', 'Clefable', 'Tentacruel', 'Magnezone'];
		const team = third => [
			['Heatran', ['Stealth Rock', 'Magma Storm', 'Earth Power', 'Flash Cannon']],
			['Scizor', ['U-turn', 'Bullet Punch', 'Knock Off']],
			third,
			['Tyranitar', ['Crunch', 'Stone Edge']],
		];
		const heatran = ai => ((ai.leadPlan && ai.leadPlan.ours.find(o => /Heatran/.test(o.details))) || {}).score || 0;
		const alone = heatran(preview(team(['Blissey', ['Soft-Boiled', 'Seismic Toss']]), theirs).ai);
		const covered = heatran(preview(team(['Corviknight', ['Roost', 'Brave Bird', 'U-turn']]), theirs).ai);
		check(`champion: a Ground-immune teammate makes the Heatran lead safer (${alone.toFixed(0)} -> ${covered.toFixed(0)})`, covered > alone + 5, true);
	}
}

// ------------------------------------------------------------- middle ground
if (MAIN) console.log('\n--- A6-A8: middle-ground search ---');
if (MAIN) {
	const calc = require('@smogon/calc');
	const ai = new BattleAI({ difficulty: 'stockfish' });
	ai.setFormat('gen9ou');
	const gen = ai.gen(9);
	const field = new calc.Field();
	const moves = ['U-turn', 'Earthquake', 'Stone Edge'];
	const board = (myHp, foeHp, foeBench = ['Skarmory', 'Clefable', 'Toxapex']) => position({
		me: mon('Landorus-Therian', moves, { hp: myHp }), myMoves: moves,
		bench: [mon('Blissey', ['Seismic Toss'], { hp: myHp }), mon('Garchomp', ['Earthquake'], { hp: myHp })],
		foe: { species: 'Heatran', hp: foeHp, moves: ['Magma Storm', 'Earth Power'] }, foeBench, foeDown: ['Pikachu'],
	});

	const ahead = board(100, 30, ['Skarmory']), behind = board(30, 100);
	check('an honest count says ahead when ahead', ai.advantage(ahead.state, ahead.request) > 0.15, true);
	check('and behind when behind', ai.advantage(behind.state, behind.request) < -0.15, true);

	// Their replies, weighted: Earth Power does nothing to a Levitate/Flying
	// Landorus and is pruned; the switch is on the list, to the Skarmory that
	// shrugs off Earthquake.
	const p = board(100, 100);
	ai.myMoveNames = moves;
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const foe = p.state.foes()[0];
	const replies = ai.search.theirActions(gen, ai.foePokemon(gen, foe), me, foe, field);
	ai.search.weighReplies(gen, replies, me, foe, field, p.state);
	const ep = replies.find(r => r.name === 'Earth Power'), ms = replies.find(r => r.name === 'Magma Storm');
	const sw = replies.find(r => r.switch);
	check(`an immune reply is pruned (Earth Power ${ep && ep.weight.toFixed(2)} vs Magma Storm ${ms && ms.weight.toFixed(2)})`, ep && ms && ep.weight < ms.weight / 5, true);
	check(`the switch is a reply, into ${sw && sw.switchIn && sw.switchIn.species}`, sw && sw.switchIn && sw.switchIn.species, 'Skarmory');

	// And against that switch U-turn is the better click than Earthquake.
	const brd = { me, them: ai.foePokemon(gen, foe), entry: p.request.side.pokemon[0], foe };
	const play = name => ai.search.playTurn(gen, brd, { kind: 'move', name, damage: ai.damageToFoe(gen, me, foe, name, field), priority: 0 }, sw, p.state, field, p.request);
	check(`into their switch, U-turn beats Earthquake (${play('U-turn').toFixed(0)} vs ${play('Earthquake').toFixed(0)})`, play('U-turn') > play('Earthquake'), true);
}

module.exports = { position, mon, onRungs, moveName, check, realStats };

if (require.main === module) {
	// The later sections register themselves below this line as they are added.
	process.on('exit', () => {
		console.log(`\n=== ${pass} passed, ${fail} failed`);
		process.exitCode = fail ? 1 : 0;
	});
}
