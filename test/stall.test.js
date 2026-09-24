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

const { BattleAI, STYLE_RULES } = require('../src/ai');
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
	// Every thinking rung plays a stall team as stall (ladder bots, gyms, trainers, summons); the greedy ones never do.
	for (const rung of ['hard', 'champion']) check(`${rung} knows it too`, new BattleAI({ difficulty: rung }).stallTeam(stallReq), true);
	for (const rung of ['easy', 'normal']) check(`${rung} stays greedy`, !!new BattleAI({ difficulty: rung }).cfg.stallPlay, false);
	// The style of our own team, and the rules each style plays.
	check('the stall team reads as stall', ai.ourArchetype(stallReq), 'stall');
	check('Blissey and four attackers (two of them setup) read as bulky offense', stockfish().ourArchetype(offReq), 'bulky offense');
	const balReq = position({ me: WALLS.Blissey(), myMoves: ['Seismic Toss'], bench: [WALLS.Toxapex(), ...OFFENSE().slice(0, 3)], foe: { species: 'Garchomp' } }).request;
	check('two walls and three attackers read as balance', stockfish().ourArchetype(balReq), 'balance');
	check('balance plays none of the stall rules yet', stockfish().styleRules(balReq), null);
	check('unless a measurement switches one on', !!stockfish({ styleRules: { ...STYLE_RULES, balance: { preserve: true } } }).styleRules(balReq), true);
}

console.log('\n--- a switch-in judged by the move they will click (round 2: Blissey died with Clodsire benched) ---');
{
	const moves = ['Seismic Toss', 'Soft-Boiled', 'Stealth Rock', 'Wish'];
	const me = mon('Blissey', moves, { item: 'Leftovers', ability: 'Natural Cure', hp: 13, status: 'par' });
	const p = position({ me, myMoves: moves, bench: wallsBut('Blissey'), foe: { species: 'Raging Bolt', moves: ['Thunderbolt'], item: 'Choice Specs' } });
	p.state.opponent.a.lastMove = 'Thunderbolt';   // locked into it
	check('Blissey at 13% leaves for the Ground type', moveOf(p.request, stockfish().decide(p.request, p.state)), c => /switch (Clodsire|Gliscor)/.test(c));
	const hard = new BattleAI({ difficulty: 'hard' }); hard.setFormat('gen9nationaldex');
	let saved = 0;
	for (let i = 0; i < 6; i++) if (/switch (Clodsire|Gliscor)/.test(moveOf(p.request, hard.decide(p.request, p.state)))) saved++;
	check(`and so does Hard, most of the time (${saved}/6)`, saved >= 4, true);
}

console.log('\n--- R1: pivot before the hit, even at full health ---');
{
	// Clodsire at full health in front of a Water attacker: Toxapex takes it for nothing.
	const moves = ['Earthquake', 'Poison Jab', 'Recover', 'Spikes'];
	const ask = bench => {
		const { request, state } = position({ me: WALLS.Clodsire(100), myMoves: moves, bench, foe: { species: 'Greninja', moves: ['Hydro Pump', 'Ice Beam'], item: 'Choice Specs' } });
		return moveOf(request, stockfish().decide(request, state));
	};
	// Toxapex resists it; Blissey is the special wall. Either is the human play.
	check('stall: Clodsire leaves in front of Specs Greninja at 100%', ask(wallsBut('Clodsire')), c => /switch (Toxapex|Blissey)/.test(c));
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
	const ctx = { foes: [foe], entry: request.side.pokemon[0], rules: STYLE_RULES.stall, request };
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

console.log('\n--- R11 in replay gen9rpou-10-tlvuiv: Blissey stayed in front of a +2 Kingambit ---');
{
	/*
	 * Turn 14, the bot's own sets and the stats Showdown reported for them. Blissey
	 * (51%) Seismic Tossed and died to +2 Iron Head. The Unaware Clefable behind it
	 * takes 66-78% from that Iron Head, boosts or not; the bot read 116-136%, because
	 * the calculator was working from 0 EVs and a neutral nature for every one of our
	 * own Pokemon (the request's stats never reached it), and so kept Blissey in.
	 */
	const withStats = (m, hp, stats) => {
		const c = /^(\d+)\/(\d+)/.exec(m.condition);
		m.stats = stats;
		m.condition = /fnt/.test(m.condition) ? '0 fnt' : `${Math.round(hp * c[1] / c[2])}/${hp}`;
		return m;
	};
	const blissMoves = ['Soft-Boiled', 'Calm Mind', 'Seismic Toss', 'Shadow Ball'];
	const build = (atk, blissHp) => position({
		me: withStats(mon('Blissey', blissMoves, { item: 'Leftovers', ability: 'Serene Grace', hp: blissHp }), 652, { atk: 50, def: 119, spa: 186, spd: 405, spe: 146 }),
		myMoves: blissMoves,
		bench: [
			mon('Clodsire', ['Earthquake', 'Recover', 'Toxic', 'Stealth Rock'], { item: 'Heavy-Duty Boots', ability: 'Unaware', fainted: true }),
			mon('Corviknight', ['Brave Bird', 'Defog', 'Iron Defense', 'Roost'], { item: 'Rocky Helmet', ability: 'Unnerve', fainted: true }),
			withStats(mon('Regieleki', ['Volt Switch', 'Rapid Spin', 'Swift', 'Thunderbolt'], { item: 'Choice Specs', ability: 'Transistor' }), 301, { atk: 212, def: 136, spa: 299, spd: 137, spe: 548 }),
			withStats(mon('Clefable', ['Calm Mind', 'Moonblast', 'Moonlight', 'Thunder Wave'], { item: 'Heavy-Duty Boots', ability: 'Unaware' }), 394, { atk: 158, def: 269, spa: 226, spd: 217, spe: 156 }),
			withStats(mon('Dondozo', ['Rest', 'Undertow', 'Crunch', 'Sleep Talk'], { item: 'Heavy-Duty Boots', ability: 'Water Veil', hp: 20 }), 504, { atk: 266, def: 361, spa: 149, spd: 167, spe: 106 }),
		],
		foe: { species: 'Kingambit', hp: 81, moves: ['Swords Dance'], boosts: { atk, spd: -1 }, item: 'Leftovers', ability: 'Supreme Overlord' },
		foeBench: ['Ursaluna-Bloodmoon', 'Magearna', 'Hatterene', 'Stakataka'], foeDown: ['Banette'], turn: 14,
	});
	const rp = () => { const ai = new BattleAI({ difficulty: 'stockfish' }); ai.setFormat('gen9rpou'); return ai; };
	const ai = rp();
	const gen = ai.gen(9);
	const p = build(2, 51);
	const clef = ai.myPokemon(gen, p.request.side.pokemon[4], p.state);
	const iron = ai.damagePct(gen, ai.foePokemon(gen, p.state.opponent.a), clef, 'Iron Head', undefined);
	check(`our own stats reach the calculator: +2 Iron Head on the Unaware Clefable reads ${iron.toFixed(0)}% (66-78)`, iron > 60 && iron < 82, true);
	check('the team (five walls that heal, and a Regieleki) is played as stall', ai.stallTeam(p.request), true);
	check('Blissey at 51% facing +2 Kingambit brings in Clefable', moveOf(p.request, rp().decide(p.request, p.state)), 'switch Clefable');
	const t13 = build(0, 45);
	check('and a turn earlier, at 45% in front of its Iron Head, already goes', moveOf(t13.request, rp().decide(t13.request, t13.state)), 'switch Clefable');
}

console.log('\n--- Dynamax held for the moment it wins (replay gen9rpou-10-tlvuiv, turn 7) ---');
{
	/*
	 * Dondozo (Rest, Sleep Talk) Dynamaxed at 86% for Undertow, and Magearna came
	 * in on it: three turns of Max Guard where its Rest was, three Max Moves for 66% of its
	 * HP, and it left at 20% for good. On stall the Dynamax is for surviving a hit or
	 * for a Max Move that kills.
	 */
	const ai = stockfish();
	check('stall does not Dynamax for a strong hit that does not kill', ai.dynamaxWorthIt(86, 25, { score: 70, name: 'Liquidation' }, { attacks: 2, damage: 40, turn: 7, hold: true, maxDamage: 55 }), false);
	check('the same turn on offense still does', ai.dynamaxWorthIt(86, 25, { score: 70, name: 'Liquidation' }, { attacks: 2, damage: 40, turn: 7, maxDamage: 55 }), true);
	check('stall Dynamaxes to live through a hit', ai.dynamaxWorthIt(40, 60, { score: 10 }, { hold: true, maxDamage: 20 }), true);
	check('and for a Max Move that kills', ai.dynamaxWorthIt(86, 25, { score: 90, name: 'Liquidation' }, { attacks: 2, damage: 80, turn: 7, hold: true, maxDamage: 104 }), true);
	// The replay's turn 7: in on Stakataka's Gyro Ball under Trick Room, Undertow is its best hit.
	const moves = ['Rest', 'Undertow', 'Crunch', 'Sleep Talk'];
	const bench = [
		mon('Blissey', ['Soft-Boiled', 'Calm Mind', 'Seismic Toss', 'Shadow Ball'], { item: 'Leftovers', ability: 'Serene Grace' }),
		mon('Regieleki', ['Volt Switch', 'Rapid Spin', 'Swift', 'Thunderbolt'], { item: 'Choice Specs', ability: 'Transistor' }),
		mon('Clefable', ['Calm Mind', 'Moonblast', 'Moonlight', 'Thunder Wave'], { item: 'Heavy-Duty Boots', ability: 'Unaware' }),
		mon('Clodsire', ['Earthquake', 'Recover', 'Toxic', 'Stealth Rock'], { item: 'Heavy-Duty Boots', ability: 'Unaware', fainted: true }),
		mon('Corviknight', ['Brave Bird', 'Defog', 'Iron Defense', 'Roost'], { item: 'Rocky Helmet', ability: 'Unnerve', fainted: true }),
	];
	const p = position({
		me: mon('Dondozo', moves, { item: 'Heavy-Duty Boots', ability: 'Water Veil', hp: 86 }), myMoves: moves, bench,
		foe: { species: 'Stakataka', hp: 91, moves: ['Gyro Ball'], item: 'Life Orb' },
		foeBench: ['Ursaluna-Bloodmoon', 'Hatterene', 'Kingambit', 'Magearna'], foeDown: ['Banette'], turn: 7,
	});
	p.request.active[0].canDynamax = true;
	p.state.pseudo['Trick Room'] = true;
	const rp = new BattleAI({ difficulty: 'stockfish' });
	rp.setFormat('gen9rpou');
	check('Dondozo at 86% attacks Stakataka without its Dynamax', String(rp.decide(p.request, p.state)), c => /^move/.test(c) && !/dynamax/.test(c));
}

console.log('\n--- R9: Protect with a purpose, never twice ---');
{
	const ai = stockfish();
	const gen = ai.gen(9);
	const p = position({ me: WALLS.Gliscor(), myMoves: ['Earthquake', 'Knock Off', 'Protect', 'Toxic'], bench: wallsBut('Gliscor'), foe: { species: 'Heatran', status: 'tox', moves: ['Magma Storm'] } });
	const me = ai.myPokemon(gen, p.request.side.pokemon[0], p.state);
	const ctx = { foes: [p.state.opponent.a], rules: STYLE_RULES.stall, live: p.state.mine.a };
	check('Protect into a badly poisoned foe has a purpose', ai.stallProtect(gen, { id: 'protect' }, me, p.state, 80, ctx) >= 20, true);
	p.state.lastTurnMoves = [{ side: 'p2', slot: 'a', name: 'Protect', species: 'Gliscor' }];
	check('but not twice in a row', ai.stallProtect(gen, { id: 'protect' }, me, p.state, 80, ctx), -30);
	const calm = position({ me: WALLS.Gliscor(), myMoves: ['Protect'], bench: wallsBut('Gliscor'), foe: { species: 'Blissey', moves: ['Seismic Toss', 'Soft-Boiled'] }, turn: 12 });
	check('and without a purpose it is a lost turn', ai.stallProtect(gen, { id: 'protect' }, me, calm.state, 100, { foes: [calm.state.opponent.a], rules: STYLE_RULES.stall, live: calm.state.mine.a }) < 0, true);
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
