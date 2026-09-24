'use strict';
/**
 * The fixes from the review of 93 tier-sim games, both sides Stockfish (24 Sep
 * 2026), one focused position each: the foe model for built-team formats, the
 * endgame tree's sanity, recovery, hazards, and the status-move sanity rules.
 *
 *   node test/stockfish-review.test.js
 *
 * Positions come from test/pinkacross.test.js (position(), mon()). The new
 * knobs are Stockfish's (STOCKFISH_REVIEW in src/ai.js), so each position is
 * asked of Stockfish, and where it helps to show the rule is what decides it,
 * of Stockfish with that knob switched off.
 */

const calc = require('@smogon/calc');
const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');
const { position, mon, moveName } = require('./pinkacross.test.js');

let pass = 0, fail = 0;
function check(name, got, want) {
	const ok = typeof want === 'function' ? want(got) : got === want;
	if (ok) { pass++; console.log(`  ok   ${name}`); }
	else { fail++; console.log(`  FAIL ${name} -> got ${JSON.stringify(got)}`); }
}
const stockfish = cfg => { const ai = new BattleAI({ difficulty: 'stockfish', cfg }); ai.setFormat('gen9rpubers'); return ai; };
const foeOf = (species, extra = {}) => ({ species, level: 100, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(), item: null, ability: null,
	immuneTo: new Set(), notImmuneTo: new Set(), ...extra });

// ------------------------------------------------------------------ foe model
console.log('\n--- the foe model in a built-team format ---');
{
	const field = new calc.Field();
	const read = cfg => {
		const ai = stockfish(cfg);
		const gen = ai.gen(9);
		const me = ai.myPokemon(gen, mon('Rotom-Mow', ['Leaf Storm']), null);
		const foe = foeOf('Tauros-Paldea-Combat', { moves: new Set(['Close Combat']) });
		return { ai, gen, foe, pct: ai.damagePct(gen, ai.foePokemon(gen, foe), me, 'Close Combat', field) };
	};
	const on = read(), off = read({ foeModel: false });
	// The review: 47-56% read, 81-96% dealt by the Choice Band set this server builds for it.
	check(`Close Combat on Rotom-Mow reads as the Band hit it is (${off.pct.toFixed(0)}% -> ${on.pct.toFixed(0)}%)`, on.pct >= 80 && off.pct < 65, true);
	const attacks = on.ai.foeAttacks(on.gen, on.foe);
	check(`a foe that has shown one move is judged by its likely others too (${attacks.join(', ')})`, attacks.length >= 3 && attacks.includes('Close Combat'), true);
	check('without the foe model it is the one move', off.ai.foeAttacks(off.gen, off.foe).length, 1);

	// Revealed information wins: a known item, or two different moves in one stay, drops the guess.
	const ai = on.ai;
	check('a seen item switches the item guess off', ai.foeGuess(foeOf('Tauros-Paldea-Combat', { item: 'Leftovers' })).factor.Physical, 1);
	check('two different moves in one stay rule out a Choice item', ai.foeGuess(foeOf('Tauros-Paldea-Combat', { movedFreely: true })).factor.Physical, 1);
	// A Scarf that nearly every built set carries is assumed, at the Speed those sets are built with.
	const rotom = foeOf('Rotom-Mow');
	const withScarf = ai.foeSpeed(on.gen, rotom, ''), without = off.ai.foeSpeed(on.gen, rotom, '');
	check(`Rotom-Mow is read as the Scarf set this server builds (${without} -> ${withScarf})`, withScarf > without, true);
	check('and not once it has used two different moves', ai.foeSpeed(on.gen, { ...rotom, movedFreely: true }, ''), without);
}

// --------------------------------------------------------- item read from damage
console.log('\n--- their item, read off how hard they hit ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const feed = (state, line) => state.line(line.slice(1).split('|'));
	const setup = () => {
		const p = position({
			me: mon('Skarmory', ['Brave Bird', 'Roost']), myMoves: ['Brave Bird', 'Roost'],
			bench: [mon('Blissey', ['Seismic Toss'])],
			foe: { species: 'Garchomp', moves: [] },
		});
		p.state.opponent.a.hp = 100;
		p.state.turn = 3;
		return p;
	};
	const p = setup();
	const hp = +/^(\d+)/.exec(p.request.side.pokemon[0].condition)[1];
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const bare = ai.damagePct(gen, ai.foePokemon(gen, { ...p.state.opponent.a, species: 'Garchomp' }, { bare: true }), me, 'Dragon Claw', new calc.Field());
	// Dragon Claw hits half again as hard as a plain, fully invested Garchomp's would: that is a Choice Band.
	const dealt = Math.round(hp * bare / 100 * 1.5);
	feed(p.state, '|move|p1a: Garchomp|Dragon Claw|p2a: Skarmory');
	feed(p.state, `|-damage|p2a: Skarmory|${hp - dealt}/${hp}`);
	check('battle.js keeps the plain hit', (p.state.opponent.a.hits || []).length, 1);
	p.request.side.pokemon[0].condition = `${hp - dealt}/${hp}`;
	ai.learnFoeScale(gen, p.state, p.request);
	const scale = ai.foePokemon(gen, p.state.opponent.a).velvetScale;
	check(`and the AI reads it as about 1.5 (${scale && scale.Physical.toFixed(2)})`, scale && scale.Physical > 1.35 && scale.Physical < 1.65, true);
	// A critical hit says nothing about the item.
	const q = setup();
	feed(q.state, '|move|p1a: Garchomp|Dragon Claw|p2a: Skarmory');
	feed(q.state, '|-crit|p2a: Skarmory');
	feed(q.state, `|-damage|p2a: Skarmory|${hp - dealt}/${hp}`);
	check('a critical hit is not kept', (q.state.opponent.a.hits || []).length, 0);
	// Life Orb names itself on its recoil line; Knock Off takes the item away for good.
	const r = setup();
	feed(r.state, '|-damage|p1a: Garchomp|90/100|[from] item: Life Orb');
	check('Life Orb recoil names the item', r.state.opponent.a.item, 'Life Orb');
	feed(r.state, '|-enditem|p1a: Garchomp|Life Orb|[from] move: Knock Off|[of] p2a: Blissey');
	check('and a knocked-off item is gone, not unknown', r.state.opponent.a.item === null && r.state.opponent.a.itemGone, true);
	// Two different moves in one stay.
	feed(r.state, '|move|p1a: Garchomp|Earthquake|p2a: Blissey');
	feed(r.state, '|move|p1a: Garchomp|Stone Edge|p2a: Blissey');
	check('two different moves in one stay are noticed', !!r.state.opponent.a.movedFreely, true);
}

// ------------------------------------------------------------------- recovery
console.log('\n--- recovery ---');
{
	// Clefable at 40% against a Hippowdon whose hits take about a quarter of it: the
	// old units read that as dying (62 >= 40) and scored Moonlight -20.
	const board = cfg => {
		const ai = stockfish(cfg);
		const p = position({
			me: mon('Clefable', ['Moonblast', 'Moonlight'], { hp: 40 }), myMoves: ['Moonblast', 'Moonlight'],
			foe: { species: 'Hippowdon', hp: 100, moves: ['Earthquake', 'Slack Off', 'Stealth Rock', 'Whirlwind'] },
			foeBench: ['Corviknight'], foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon'],
		});
		return moveName(String(ai.decide(p.request, p.state)), p.request);
	};
	check('heals at 40% when the hit coming is smaller than the heal', board(), 'Moonlight');
	check('(and did not before)', board({ hpUnits: false, recovery: false }), c => c !== 'Moonlight');

	// Wish at 65%, and Protect the turn after.
	const wish = (hp, lastMove) => {
		const ai = stockfish();
		const p = position({
			me: mon('Vaporeon', ['Scald', 'Wish', 'Protect'], { hp }), myMoves: ['Scald', 'Wish', 'Protect'],
			foe: { species: 'Blissey', hp: 100, moves: ['Seismic Toss', 'Soft-Boiled', 'Stealth Rock', 'Thunder Wave'] },
			// No preview: the rest of their team unseen, so this is the midgame search, not the endgame tree
			// (which plays Wish as a pass: its heal lands a turn late and may go to a teammate).
		});
		if (lastMove) Object.assign(p.state.mine.a, { lastMove, lastMoveTurn: p.state.turn - 1 });
		return moveName(String(ai.decide(p.request, p.state)), p.request);
	};
	check('Wish at 60%', wish(60), 'Wish');
	check('Protect the turn after a Wish', wish(60, 'Wish'), 'Protect');
	check('no Wish at full health', wish(100), c => c !== 'Wish');

	// The search credits the heal: moving first, Recover turns their KO into a survival.
	const ai = stockfish();
	const gen = ai.gen(9);
	const p = position({ me: mon('Clefable', ['Moonblast', 'Moonlight'], { hp: 30 }), myMoves: ['Moonblast', 'Moonlight'], foe: { species: 'Hippowdon', moves: ['Earthquake'] } });
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const foe = p.state.foes()[0];
	const brd = { me, them: ai.foePokemon(gen, foe), entry: p.request.side.pokemon[0], foe, mySpe: 999, theirSpe: 1 };
	const hit = { name: 'Earthquake', damage: 35, priority: 0 };
	const heal = ai.search.playTurn(gen, brd, { kind: 'move', name: 'Moonlight', damage: 0, heal: 50, priority: 0 }, hit, p.state, new calc.Field(), p.request);
	const noHeal = ai.search.playTurn(gen, brd, { kind: 'move', name: 'Moonlight', damage: 0, priority: 0 }, hit, p.state, new calc.Field(), p.request);
	check(`the playout credits a heal (${noHeal.toFixed(0)} -> ${heal.toFixed(0)})`, heal > noHeal + 60, true);
}

// -------------------------------------------------------------------- hazards
console.log('\n--- hazards ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const at = (turn, foeBench, foeDown, hazards = {}) => {
		const p = position({ me: mon('Garchomp', ['Stealth Rock', 'Spikes', 'Earthquake']), myMoves: ['Stealth Rock', 'Spikes', 'Earthquake'],
			foe: { species: 'Clefable', moves: ['Moonblast'] }, foeBench, foeDown, turn });
		p.state.hazards.p1 = hazards;
		return p.state;
	};
	const sr = s => ai.hazardScore(gen, { name: 'Stealth Rock' }, s);
	const spikes = s => ai.hazardScore(gen, { name: 'Spikes' }, s);
	const early = sr(at(2, ['Charizard', 'Volcarona', 'Corviknight', 'Dragonite', 'Gyarados'], []));
	const late = sr(at(40, ['Garchomp'], ['Pikachu', 'Raichu', 'Eevee', 'Jolteon']));
	check(`Stealth Rock early into five Rock-weak foes beats the old flat 38 (${early})`, early > 45, true);
	check(`and late into one foe is worth much less (${late})`, late < 25, true);
	check('Spikes stack past one layer', spikes(at(3, ['Garchomp', 'Tyranitar'], [], { Spikes: 1 })) > 0, true);
	check('but not past three', spikes(at(3, ['Garchomp'], [], { Spikes: 3 })), -30);
	const boots = at(2, ['Charizard'], ['Pikachu', 'Raichu', 'Eevee', 'Jolteon']);
	const plain = sr(boots);
	boots.theirBench = { Charizard: { species: 'Charizard', hp: 100, maxhp: 100, item: 'Heavy-Duty Boots', moves: new Set(), bench: true, boosts: {} } };
	check(`a foe known to wear Heavy-Duty Boots is not counted (${plain} -> ${sr(boots)})`, sr(boots) < plain, true);
}

// --------------------------------------------------------------------- sanity
console.log('\n--- status-move sanity ---');
{
	const pick = (build, cfg) => { const ai = stockfish(cfg); const p = build(); return moveName(String(ai.decide(p.request, p.state)), p.request); };
	// Blissey used Thunder Wave into Gholdengo three times.
	check('no Thunder Wave into Good as Gold', pick(() => position({
		me: mon('Blissey', ['Thunder Wave', 'Seismic Toss', 'Soft-Boiled']), myMoves: ['Thunder Wave', 'Seismic Toss', 'Soft-Boiled'],
		foe: { species: 'Gholdengo', moves: ['Shadow Ball'], ability: 'Good as Gold' },
	})), c => c !== 'Thunder Wave');
	// Encore into a foe that has not moved since it came in fails.
	const encore = moved => () => {
		const p = position({
			me: mon('Clefable', ['Encore', 'Moonblast']), myMoves: ['Encore', 'Moonblast'],
			foe: { species: 'Heatran', moves: ['Calm Mind'] },
		});
		if (moved) Object.assign(p.state.opponent.a, { lastMove: 'Calm Mind', lastMoveTurn: p.state.turn - 1 });
		return p;
	};
	check('no Encore into a foe that has not moved since it came in', pick(encore(false)), 'Moonblast');
	check('Encore into the Calm Mind it just used', pick(encore(true)), 'Encore');
	// Found in the first validation games: moves that fail, clicked turn after turn.
	{
		const ai = stockfish();
		const gen = ai.gen(9);
		const p = position({ me: mon('Dondozo', ['Sleep Talk', 'Rest', 'Wave Crash']), myMoves: ['Sleep Talk', 'Rest', 'Wave Crash'],
			foe: { species: 'Blissey', moves: ['Seismic Toss'] }, foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon', 'Vaporeon'] });
		const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
		const them = ai.foePokemon(gen, p.state.foes()[0]);
		ai.myMoveNames = ['Sleep Talk', 'Rest', 'Wave Crash'];
		const ctx = { foes: p.state.foes(), field: new calc.Field(), entry: p.request.side.pokemon[0], live: p.state.mine.a };
		check('Sleep Talk awake fails', ai.statusScore(gen, 'Sleep Talk', me, them, p.state, 10, ctx), -30);
		check('Recover at full health fails', ai.statusScore(gen, 'Recover', me, them, p.state, 10, ctx), -30);
		check('Roar with nothing of theirs left to drag in fails', ai.statusScore(gen, 'Roar', me, them, p.state, 10, ctx), -30);
		p.state.opponent.a.lastMove = 'Seismic Toss';
		p.state.opponent.a.encored = true;
		check('Encore into an encored foe fails', ai.statusScore(gen, 'Encore', me, them, p.state, 10, { ...ctx, foes: p.state.foes() }), -30);
		const asleep = ai.myPokemon(gen, { ...p.request.side.pokemon[0], condition: p.request.side.pokemon[0].condition + ' slp' }, p.state);
		check('Sleep Talk asleep is the move', ai.statusScore(gen, 'Sleep Talk', asleep, them, p.state, 10, ctx) > 20, true);
	}
	// No Retreat a second time fails.
	const nr = () => {
		const p = position({ me: mon('Urshifu', ['No Retreat', 'Wicked Blow']), myMoves: ['No Retreat', 'Wicked Blow'], foe: { species: 'Blissey', moves: ['Soft-Boiled'] } });
		p.state.mine.a.noRetreat = true;
		p.request.side.pokemon[0].boosts = { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };
		return p;
	};
	check('no second No Retreat', pick(nr), 'Wicked Blow');
	// Mega Blaziken used Swords Dance at 14% in front of a KO: no setup on the hope they switch at 30% or less.
	const low = () => position({
		me: mon('Blaziken', ['Swords Dance', 'Close Combat', 'Flare Blitz'], { hp: 14 }), myMoves: ['Swords Dance', 'Close Combat', 'Flare Blitz'],
		foe: { species: 'Ferrothorn', hp: 60, moves: ['Power Whip', 'Gyro Ball'] },
	});
	check('no Swords Dance at 14% in front of a KO', pick(low), c => c !== 'Swords Dance');
}

// -------------------------------------------------------------------- endgame
console.log('\n--- the endgame tree ---');
{
	// Indeedee-F locked into Hyper Voice by its Specs, a Ghost in front: switch, now.
	const locked = () => {
		const p = position({
			me: mon('Indeedee-F', ['Hyper Voice', 'Psychic', 'Dazzling Gleam'], { item: 'Choice Specs' }), myMoves: ['Hyper Voice', 'Psychic', 'Dazzling Gleam'],
			bench: [mon('Tyranitar', ['Crunch', 'Stone Edge'], { hp: 80 }), mon('Garchomp', ['Earthquake', 'Outrage'], { hp: 60 })],
			foe: { species: 'Gengar', hp: 70, moves: ['Shadow Ball', 'Sludge Bomb'] }, foeBench: ['Blissey'], foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon'],
		});
		p.request.active[0].moves.forEach((m, i) => { m.disabled = i !== 0; });
		return p;
	};
	const ai = stockfish();
	const p = locked();
	const choice = String(ai.decide(p.request, p.state));
	check(`Choice-locked into an immune Hyper Voice, it switches (${choice})`, /^switch/.test(choice), true);

	// Fake Out after its first turn is out of the tree.
	const fake = () => {
		const q = position({
			me: mon('Purugly', ['Fake Out', 'Body Slam', 'U-turn']), myMoves: ['Fake Out', 'Body Slam', 'U-turn'],
			bench: [mon('Garchomp', ['Earthquake'], { hp: 50 })],
			foe: { species: 'Alakazam', hp: 20, moves: ['Psychic'] }, foeBench: ['Blissey'], foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon'], turn: 12,
		});
		q.state.mineCameIn = 8;
		return q;
	};
	const f = fake();
	check('no Fake Out four turns after it came in', moveName(String(stockfish().decide(f.request, f.state)), f.request), c => c !== 'Fake Out');

	// A status move is played for its chip, not as a pass: Will-O-Wisp into a Normal
	// type that Night Shade cannot touch.
	const gen = ai.gen(9);
	const w = position({
		me: mon('Sableye', ['Night Shade', 'Will-O-Wisp', 'Recover']), myMoves: ['Night Shade', 'Will-O-Wisp', 'Recover'],
		bench: [mon('Skarmory', ['Brave Bird'], { hp: 50 })],
		foe: { species: 'Snorlax', hp: 100, moves: ['Body Slam'] }, foeDown: ['Pikachu', 'Raichu', 'Eevee', 'Jolteon', 'Vaporeon'],
	});
	ai.myMoveNames = ['Night Shade', 'Will-O-Wisp', 'Recover'];
	const model = ai.search.endgameModel(gen, w.request, w.state, new calc.Field());
	const found = model && ai.search.endgameSearch(model);
	const wisp = found && found.actions.find(a => a.st !== undefined), shade = found && found.actions.find(a => a.m !== undefined);
	check(`the tree values the burn above the immune Night Shade (${wisp && wisp.value.toFixed(0)} vs ${shade && shade.value.toFixed(0)})`, !!wisp && (!shade || wisp.value > shade.value), true);
	check('and the whole decision is Will-O-Wisp', moveName(String(stockfish().decide(w.request, w.state)), w.request), 'Will-O-Wisp');
}

// -------------------------------------------------------------------- Z-Moves
console.log('\n--- Z-Moves ---');
{
	// Garchomp with a Groundium Z: Tectonic Rage (180) where Earthquake (100) does not kill.
	const z = foeHp => {
		const p = position({
			me: mon('Garchomp', ['Earthquake', 'Dragon Claw'], { item: 'Groundium Z' }), myMoves: ['Earthquake', 'Dragon Claw'],
			foe: { species: 'Clefable', hp: foeHp, moves: ['Moonblast'] },
		});
		p.request.active[0].canZMove = [{ move: 'Tectonic Rage', target: 'normal' }, null];
		return String(stockfish().decide(p.request, p.state));
	};
	check('uses the Z-Move when it turns Earthquake into a KO', z(65), 'move 1 zmove');
	check('but not when even the Z-Move does not kill', z(100), c => !/zmove/.test(c));
	check('and holds it when Earthquake kills anyway', z(25), c => !/zmove/.test(c));
}

// ------------------------------------------------------------ decision time
console.log('\n--- time ---');
{
	const ai = stockfish();
	const p = position({
		me: mon('Garchomp', ['Earthquake', 'Dragon Claw', 'Stone Edge', 'Swords Dance']), myMoves: ['Earthquake', 'Dragon Claw', 'Stone Edge', 'Swords Dance'],
		bench: [mon('Scizor', ['Bullet Punch', 'U-turn']), mon('Rotom-Wash', ['Hydro Pump', 'Volt Switch']), mon('Clefable', ['Moonblast', 'Moonlight'])],
		foe: { species: 'Tauros-Paldea-Combat', moves: ['Close Combat'] }, foeBench: ['Gholdengo', 'Rotom-Mow', 'Kingambit', 'Great Tusk', 'Dragapult'],
	});
	ai.decide(p.request, p.state);   // the first decision builds the species profiles
	const t0 = Date.now();
	for (let i = 0; i < 5; i++) ai.decide(p.request, p.state);
	const ms = (Date.now() - t0) / 5;
	check(`a six-a-side decision stays quick (${ms.toFixed(0)} ms)`, ms < 300, true);
}

void BattleState;
console.log(`\n=== ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
