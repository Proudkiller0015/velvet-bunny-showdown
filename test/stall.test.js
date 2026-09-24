'use strict';
/**
 * Stall play (STALL_PLAY in src/ai.js), one focused position per rule of
 * docs/stall-replay-study.md (R1-R13). Each position is the plainest version of
 * what 63 human stall sides rated 1849-1934 did and the bot did not.
 *
 *   node test/stall.test.js
 *
 * Positions come from test/pinkacross.test.js (position(), mon()). The rules
 * switch on only for a stall team, so each is also asked of the same Pokemon
 * on an offense bench where that shows the gate.
 */

const { BattleAI } = require('../src/ai');
const { position, mon } = require('./pinkacross.test.js');

let pass = 0, fail = 0;
function check(name, got, want) {
	const ok = typeof want === 'function' ? want(got) : got === want;
	if (ok) { pass++; console.log(`  ok   ${name}`); }
	else { fail++; console.log(`  FAIL ${name} -> got ${JSON.stringify(got)}`); }
}
const stockfish = cfg => { const ai = new BattleAI({ difficulty: 'stockfish', cfg, log: process.env.DEBUG ? (...m) => console.log('      ', ...m) : undefined }); ai.setFormat('gen9nationaldex'); return ai; };
const moveOf = (request, choice) => {
	const m = /^move (\d+)/.exec(choice || '');
	if (m) return request.active[0].moves[+m[1] - 1].move;
	const s = /^switch (\d+)/.exec(choice || '');
	return s ? `switch ${request.side.pokemon[+s[1] - 1].details.split(',')[0]}` : choice;
};

// A stall bench: walls that heal (Smogon NatDex stall, data/teams/natdex/stall-*).
const WALLS = {
	Blissey: () => mon('Blissey', ['Seismic Toss', 'Soft-Boiled', 'Stealth Rock', 'Wish'], { item: 'Heavy-Duty Boots', ability: 'Natural Cure' }),
	Toxapex: hp => mon('Toxapex', ['Scald', 'Toxic', 'Recover', 'Haze'], { item: 'Heavy-Duty Boots', ability: 'Regenerator', hp }),
	Corviknight: hp => mon('Corviknight', ['Body Press', 'Roost', 'Defog', 'Iron Defense'], { item: 'Heavy-Duty Boots', ability: 'Pressure', hp }),
	Clodsire: hp => mon('Clodsire', ['Earthquake', 'Poison Jab', 'Recover', 'Spikes'], { item: 'Heavy-Duty Boots', ability: 'Unaware', hp }),
	Gliscor: () => mon('Gliscor', ['Earthquake', 'Knock Off', 'Protect', 'Toxic'], { item: 'Toxic Orb', ability: 'Poison Heal', status: 'tox' }),
};
const wallsBut = (...skip) => Object.keys(WALLS).filter(k => !skip.includes(k)).map(k => WALLS[k]());
const OFFENSE = () => [
	mon('Garchomp', ['Earthquake', 'Scale Shot', 'Swords Dance', 'Fire Fang'], { item: 'Life Orb', ability: 'Rough Skin' }),
	mon('Iron Valiant', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], { item: 'Booster Energy', ability: 'Quark Drive' }),
	mon('Dragapult', ['Draco Meteor', 'Shadow Ball', 'U-turn', 'Flamethrower'], { item: 'Choice Specs', ability: 'Infiltrate' }),
	mon('Kingambit', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], { item: 'Black Glasses', ability: 'Supreme Overlord' }),
];

console.log('\n--- knowing we are stall ---');
{
	const ai = stockfish();
	const stallReq = position({ me: WALLS.Blissey(), myMoves: ['Seismic Toss'], bench: wallsBut('Blissey'), foe: { species: 'Garchomp' } }).request;
	check('five walls that heal are a stall team', ai.stallTeam(stallReq), true);
	const offReq = position({ me: WALLS.Blissey(), myMoves: ['Seismic Toss'], bench: OFFENSE(), foe: { species: 'Garchomp' } }).request;
	check('one wall and four attackers are not', stockfish().stallTeam(offReq), false);
	check('and the knob switches it off', stockfish({ stallPlay: false }).stallTeam(stallReq), false);
}

console.log('\n--- R1: pivot before the hit, even at full health ---');
{
	// Clodsire at full health in front of a Water attacker: Toxapex takes it for nothing.
	const moves = ['Earthquake', 'Poison Jab', 'Recover', 'Spikes'];
	const ask = bench => {
		const { request, state } = position({ me: WALLS.Clodsire(100), myMoves: moves, bench, foe: { species: 'Greninja', moves: ['Hydro Pump', 'Ice Beam'], item: 'Choice Specs' } });
		return moveOf(request, stockfish().decide(request, state));
	};
	check('stall: Clodsire leaves for the Water resist at 100%', ask(wallsBut('Clodsire')), 'switch Toxapex');
}

console.log('\n--- R2/R3: preserve at 35% or less, heal when the heal outruns the hit ---');
{
	const moves = ['Body Press', 'Roost', 'Defog', 'Iron Defense'];
	// A hit Roost outruns: heal. (Against a faster Garchomp's 45% it would be dead before the Roost.)
	let p = position({ me: WALLS.Corviknight(30), myMoves: moves, bench: wallsBut('Corviknight'), foe: { species: 'Toxapex', moves: ['Scald'], ability: 'Regenerator' } });
	check('Corviknight at 30% against Toxapex Roosts', moveOf(p.request, stockfish().decide(p.request, p.state)), 'Roost');
	// A hit bigger than the heal: switch to what takes it, never stay and die.
	p = position({ me: WALLS.Corviknight(30), myMoves: moves, bench: wallsBut('Corviknight'), foe: { species: 'Heatran', moves: ['Magma Storm', 'Earth Power'], item: 'Choice Specs' } });
	check('Corviknight at 30% against Specs Heatran switches out', moveOf(p.request, stockfish().decide(p.request, p.state)), c => /^switch/.test(c));
}

console.log('\n--- R4: heal in the 45-65% band, never at 90% ---');
{
	const moves = ['Earthquake', 'Poison Jab', 'Recover', 'Spikes'];
	const at = hp => {
		const p = position({ me: WALLS.Clodsire(hp), myMoves: moves, bench: wallsBut('Clodsire'), foe: { species: 'Blissey', moves: ['Seismic Toss', 'Soft-Boiled'] }, hazards: null });
		p.state.hazards.p1 = { Spikes: 3 };   // their side is full: Spikes is not the move
		return moveOf(p.request, stockfish().decide(p.request, p.state));
	};
	check('Clodsire at 57% Recovers', at(57), 'Recover');
	check('Clodsire at 93% does not', at(93), m => m !== 'Recover');
}

console.log('\n--- R6: status aimed ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const { request, state } = position({ me: WALLS.Toxapex(100), myMoves: ['Scald', 'Toxic', 'Recover', 'Haze'], bench: wallsBut('Toxapex'), foe: { species: 'Gliscor' } });
	const me = ai.myPokemon(gen, request.side.pokemon[0], state);
	ai.myMoveNames = ['Scald', 'Toxic', 'Recover', 'Haze'];
	const foe = state.opponent.a;
	const ctx = { foes: [foe], entry: request.side.pokemon[0], stall: true, request };
	check('no Toxic into a Gliscor that may be Poison Heal', ai.statusScore(gen, 'Toxic', me, ai.foePokemon(gen, foe), state, 10, ctx), s => s < 15);
	const burn = ai.stallStatus(gen, { status: 'brn' }, ai.foePokemon(gen, { ...foe, species: 'Kingambit', ability: 'Supreme Overlord' }), { foes: [{ ...foe, species: 'Kingambit', ability: 'Supreme Overlord', moves: new Set(['Kowtow Cleave']) }] });
	const burnSpecial = ai.stallStatus(gen, { status: 'brn' }, ai.foePokemon(gen, { ...foe, species: 'Heatran' }), { foes: [{ ...foe, species: 'Iron Moth', moves: new Set(['Fiery Dance']) }] });
	check(`a burn is worth more on a physical attacker (${burn} vs ${burnSpecial})`, burn > burnSpecial, true);
}

console.log('\n--- R8: remove hazards when they cost the team ---');
{
	const moves = ['Body Press', 'Roost', 'Defog', 'Iron Defense'];
	const noBoots = () => [
		mon('Blissey', ['Seismic Toss', 'Soft-Boiled'], { item: 'Leftovers', ability: 'Natural Cure' }),
		mon('Toxapex', ['Scald', 'Recover'], { item: 'Rocky Helmet', ability: 'Regenerator' }),
		mon('Clodsire', ['Earthquake', 'Recover'], { item: 'Leftovers', ability: 'Unaware' }),
		mon('Dondozo', ['Liquidation', 'Rest'], { item: 'Leftovers', ability: 'Unaware' }),
	];
	let p = position({ me: WALLS.Corviknight(90), myMoves: moves, bench: noBoots(), foe: { species: 'Toxapex', moves: ['Scald'], ability: 'Regenerator' }, hazards: { 'Stealth Rock': 1, Spikes: 1 } });
	check('Stealth Rock and Spikes on a Leftovers team: Defog', moveOf(p.request, stockfish().decide(p.request, p.state)), 'Defog');
	const ai = stockfish();
	p = position({ me: WALLS.Corviknight(90), myMoves: moves, bench: wallsBut('Corviknight', 'Gliscor'), foe: { species: 'Blissey' }, hazards: { 'Stealth Rock': 1 } });
	check('a team in Heavy-Duty Boots lives with them', ai.stallRemoval(ai.gen(9), { id: 'defog' }, p.state, p.request, 90, 10) < 10, true);
}

console.log('\n--- R11: a boosted foe meets its answer ---');
{
	const moves = ['Seismic Toss', 'Soft-Boiled', 'Stealth Rock', 'Wish'];
	const p = position({ me: WALLS.Blissey(), myMoves: moves, bench: wallsBut('Blissey'), foe: { species: 'Dragonite', moves: ['Dragon Dance', 'Extreme Speed'], boosts: { atk: 1, spe: 1 } } });
	// Clodsire (Unaware) or Corviknight (Steel, Iron Defense): anything but trading blows or sacking Blissey.
	check('Blissey facing a +1 Band Dragonite brings in a check', moveOf(p.request, stockfish().decide(p.request, p.state)), c => /switch (Clodsire|Toxapex|Corviknight)/.test(c));
}

console.log('\n--- R9: Protect with a purpose, never twice ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const p = position({ me: WALLS.Gliscor(), myMoves: ['Earthquake', 'Knock Off', 'Protect', 'Toxic'], bench: wallsBut('Gliscor'), foe: { species: 'Heatran', status: 'tox', moves: ['Magma Storm'] } });
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const ctx = { foes: [p.state.opponent.a], stall: true, live: p.state.mine.a };
	check('Protect into a badly poisoned foe has a purpose', ai.stallProtect(gen, { id: 'protect' }, me, p.state, 80, ctx) >= 20, true);
	p.state.lastTurnMoves = [{ side: 'p2', slot: 'a', name: 'Protect', species: 'Gliscor' }];
	check('but not twice in a row', ai.stallProtect(gen, { id: 'protect' }, me, p.state, 80, ctx), -30);
	const calm = position({ me: WALLS.Gliscor(), myMoves: ['Protect'], bench: wallsBut('Gliscor'), foe: { species: 'Blissey', moves: ['Seismic Toss', 'Soft-Boiled'] }, turn: 12 });
	check('and without a purpose it is a lost turn', ai.stallProtect(gen, { id: 'protect' }, me, calm.state, 100, { foes: [calm.state.opponent.a], stall: true, live: calm.state.mine.a }) < 0, true);
}

console.log('\n--- R10: Wish at about 80%, and pass it ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const moves = ['Seismic Toss', 'Soft-Boiled', 'Stealth Rock', 'Wish'];
	const p = position({ me: WALLS.Blissey(), myMoves: moves, bench: wallsBut('Blissey', 'Toxapex').concat([WALLS.Toxapex(40)]), foe: { species: 'Clefable', moves: ['Moonblast'] } });
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	check('Wish at 82% is worth a turn', ai.stallRecovery({ id: 'wish' }, me, p.state, 82, 10, false, { live: p.state.mine.a }) >= 30, true);
	p.state.mine.a.lastMove = 'Wish'; p.state.mine.a.lastMoveTurn = p.state.turn - 1;
	check('with our Wish landing, Blissey passes it to the 40% Toxapex', moveOf(p.request, stockfish().decide(p.request, p.state)), 'switch Toxapex');
}

console.log('\n--- no free turns for a setup foe (round 2: Alomomola Wished and Protected into two Swords Dances) ---');
{
	const moves = ['Wish', 'Protect', 'Toxic', 'Flip Turn'];
	const alomomola = () => mon('Alomomola', moves, { item: 'Rocky Helmet', ability: 'Regenerator' });
	const p = position({ me: alomomola(), myMoves: moves, bench: wallsBut('Toxapex').concat([WALLS.Toxapex(40)]), foe: { species: 'Ogerpon-Wellspring', moves: ['Swords Dance', 'Ivy Cudgel'], ability: 'Water Absorb' } });
	check('healthy Alomomola in front of Ogerpon does not Wish for the bench', moveOf(p.request, stockfish().decide(p.request, p.state)), m => m !== 'Wish' && m !== 'Protect');
	p.state.mine.a.lastMove = 'Wish'; p.state.mine.a.lastMoveTurn = p.state.turn - 1;
	p.state.opponent.a.boosts = { atk: 2 };
	check('nor Protects at full health while it boosts', moveOf(p.request, stockfish().decide(p.request, p.state)), m => m !== 'Protect');
}

console.log('\n--- R13: the last heals are saved for low HP ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const p = position({ me: WALLS.Clodsire(60), myMoves: ['Recover'], bench: wallsBut('Clodsire'), foe: { species: 'Blissey' } });
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const move = { id: 'recover', name: 'Recover' };
	const full = ai.stallRecovery(move, me, p.state, 60, 10, false, { pp: { Recover: 12 } });
	const last = ai.stallRecovery(move, me, p.state, 60, 10, false, { pp: { Recover: 2 } });
	check(`two Recovers left at 60%: half the value (${last} vs ${full})`, last < full * 0.6, true);
	check('but at 40% they are spent', ai.stallRecovery(move, me, p.state, 40, 10, false, { pp: { Recover: 2 } }) > 60, true);
}

console.log(`\n=== ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
