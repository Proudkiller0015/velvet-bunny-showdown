'use strict';
/**
 * Behaviour tests: the specific judgements the AI is supposed to make.
 * Win rate alone cannot tell us whether it set up for the right reason.
 */

const { BattleAI } = require('../src/ai');
const { BattleState } = require('../src/battle');

let pass = 0, fail = 0;
function check(name, got, want) {
	const ok = typeof want === 'function' ? want(got) : got === want;
	if (ok) { pass++; console.log(`  ok   ${name}`); }
	else { fail++; console.log(`  FAIL ${name} -> got ${JSON.stringify(got)}`); }
}

/** Build a request/state pair for a one-on-one situation. */
function scenario({ me, myMoves, myItem, foe, foeMoves = [], foeHp = 100, trickRoom = false, bench = [], myHp = 100, myStatus = '' }) {
	const state = new BattleState('test');
	state.myPlayer = 'p2';
	state.gen = 9;
	state.opponent.a = {
		species: foe, level: 100, hp: foeHp, maxhp: 100, status: '', fainted: false,
		boosts: {}, moves: new Set(foeMoves), item: null, ability: null, tera: null,
	};
	state.mine.a = { species: me, level: 100, hp: myHp, maxhp: 100, status: myStatus, fainted: false, boosts: {}, moves: new Set(), tera: null };
	if (trickRoom) state.pseudo['Trick Room'] = true;

	const active = [{ moves: myMoves.map(m => ({ move: m, id: m.toLowerCase().replace(/\W/g, ''), pp: 16, maxpp: 16, target: 'normal', disabled: false })) }];
	const side = {
		name: 'Bot', id: 'p2',
		pokemon: [
			{
				ident: `p2a: ${me}`, details: `${me}, M`, condition: `${myHp}/100${myStatus ? ' ' + myStatus : ''}`,
				active: true, moves: myMoves.map(m => m.toLowerCase().replace(/\W/g, '')),
				baseAbility: '', ability: '', item: myItem || '', stats: { atk: 200, def: 200, spa: 200, spd: 200, spe: 200 },
			},
			...bench,
		],
	};
	return { request: { active, side, rqid: 1 }, state };
}

function benchMon(species, moves, opts = {}) {
	return {
		ident: `p2b: ${species}`, details: `${species}, M`,
		condition: opts.condition || '100/100',
		active: false, moves: moves.map(m => m.toLowerCase().replace(/\W/g, '')),
		baseAbility: '', ability: '', item: opts.item || '',
		stats: opts.stats || { atk: 200, def: 200, spa: 200, spd: 200, spe: 200 },
	};
}

console.log('\n--- setup gating ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	// The rule the setup logic exists to encode: a foe that is about to run away
	// makes the boost turn free, so pressure must raise the value of setting up.
	// (Asserted on the score rather than the final click: against a specific foe
	// the boost and the attack can legitimately land within a point of each other,
	// and which one wins there is not the behaviour under test.)
	const gen = ai.gen(9);
	const field = new (require('@smogon/calc').Field)({});
	const a = scenario({ me: 'Gyarados', myMoves: ['Dragon Dance', 'Waterfall', 'Ice Fang'], foe: 'Heatran', foeMoves: ['Magma Storm'] });
	const meMon = ai.myPokemon(gen, a.request.side.pokemon[0], a.state);
	ai.myMoveNames = ['Dragon Dance', 'Waterfall', 'Ice Fang'];

	const scaredFoe = [{ species: 'Heatran', level: 100, hp: 25, maxhp: 100, status: '', boosts: {}, moves: new Set(['Magma Storm']) }];
	const happyFoe = [{ species: 'Raging Bolt', level: 100, hp: 100, maxhp: 100, status: '', boosts: {}, moves: new Set(['Thunderclap', 'Draco Meteor']) }];
	const ctxFor = foes => ({ foes, field, entry: a.request.side.pokemon[0] });

	check('pressure makes setting up more attractive',
		ai.switchPressure(gen, meMon, scaredFoe, field) > ai.switchPressure(gen, meMon, happyFoe, field), true);
	const scoreScared = ai.statusScore(gen, 'Dragon Dance', meMon, ai.foePokemon(gen, scaredFoe[0]), a.state, 15, ctxFor(scaredFoe));
	const scoreHappy = ai.statusScore(gen, 'Dragon Dance', meMon, ai.foePokemon(gen, happyFoe[0]), a.state, 95, ctxFor(happyFoe));
	check('setup scores higher vs a foe that must leave', scoreScared > scoreHappy, true);
	check('setup is rejected outright in front of a lethal, comfortable foe', scoreHappy < 0, true);

	// ...but a kill on the board beats any amount of setup.
	const k = scenario({ me: 'Gyarados', myMoves: ['Dragon Dance', 'Waterfall', 'Earthquake'], foe: 'Charizard', foeMoves: ['Flamethrower'] });
	check('takes the KO instead of setting up', ai.decide(k.request, k.state), c => /move 2\b/.test(c));

	// In front of something that threatens to OHKO and is happy to stay.
	const b = scenario({ me: 'Gyarados', myMoves: ['Dragon Dance', 'Waterfall', 'Earthquake'], foe: 'Raging Bolt', foeMoves: ['Thunderclap', 'Draco Meteor'], myHp: 35 });
	check('does not set up into a lethal attacker', ai.decide(b.request, b.state), c => !/move 1\b/.test(c));
}

console.log('\n--- tempo / win-condition value ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	const gen = ai.gen(9);
	const s = scenario({ me: 'Blissey', myMoves: ['Seismic Toss'], foe: 'Great Tusk' });

	const scarfCleaner = benchMon('Dragapult', ['Dragon Darts', 'U-turn'], { item: 'choicescarf', condition: '1/100', stats: { atk: 220, def: 100, spa: 220, spd: 100, spe: 350 } });
	const spentWall = benchMon('Torkoal', ['Lava Plume'], { condition: '100/100', stats: { atk: 90, def: 200, spa: 90, spd: 90, spe: 20 } });
	s.request.side.pokemon.push(scarfCleaner, spentWall);

	const cleanerValue = ai.monValue(gen, scarfCleaner, s.state, s.request);
	const wallValue = ai.monValue(gen, spentWall, s.state, s.request);
	check('a 1 HP Choice Scarf cleaner outvalues a healthy slow wall', cleanerValue > wallValue, true);

	const dead = benchMon('Dragapult', ['Dragon Darts'], { item: 'choicescarf', condition: '0 fnt' });
	check('a fainted Pokemon is worth nothing', ai.monValue(gen, dead, s.state, s.request), 0);

	const paralysed = benchMon('Dragapult', ['Dragon Darts'], { item: 'choicescarf', condition: '100/100 par', stats: { atk: 220, def: 100, spa: 220, spd: 100, spe: 350 } });
	const healthy = benchMon('Dragapult', ['Dragon Darts'], { item: 'choicescarf', condition: '100/100', stats: { atk: 220, def: 100, spa: 220, spd: 100, spe: 350 } });
	check('paralysis cuts a cleaner down', ai.monValue(gen, paralysed, s.state, s.request) < ai.monValue(gen, healthy, s.state, s.request), true);
}

console.log('\n--- trick room ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	const gen = ai.gen(9);
	const slow = benchMon('Torkoal', ['Lava Plume', 'Body Press'], { stats: { atk: 90, def: 200, spa: 130, spd: 90, spe: 20 } });

	const plain = scenario({ me: 'Blissey', myMoves: ['Seismic Toss'], foe: 'Great Tusk' });
	plain.request.side.pokemon.push(slow);
	const plainValue = ai.monValue(gen, slow, plain.state, plain.request);

	const tr = scenario({ me: 'Blissey', myMoves: ['Seismic Toss'], foe: 'Great Tusk', trickRoom: true });
	tr.request.side.pokemon.push(slow);
	const trValue = ai.monValue(gen, slow, tr.state, tr.request);
	check('Trick Room makes a slow Pokemon more valuable', trValue > plainValue, true);

	// Trick Room merely available on the team should soften the speed penalty.
	const avail = scenario({ me: 'Hatterene', myMoves: ['Trick Room', 'Psychic'], foe: 'Great Tusk' });
	avail.request.side.pokemon.push(slow);
	const availValue = ai.monValue(gen, slow, avail.state, avail.request);
	check('Trick Room on the team softens the slowness penalty', availValue > plainValue, true);
}

console.log('\n--- difficulty ladder ---');
{
	const easy = new BattleAI({ difficulty: 'easy' });
	const champ = new BattleAI({ difficulty: 'champion' });
	check('easy does not voluntarily switch', easy.cfg.switching, false);
	check('champion predicts', champ.cfg.predict, true);
	check('unknown difficulty falls back to the default', new BattleAI({ difficulty: 'banana' }).difficultyName, 'hard');
	check('difficulty list is exposed for the UI', BattleAI.difficulties().length >= 4, true);

	// Easy is meant to play like an in-game trainer: it uses its gimmick, but it
	// never switches and never plans past the turn.
	check('easy still uses its Tera, like an NPC would', easy.cfg.tera, true);
	check('easy never switches out', easy.cfg.switching, false);
	check('easy does not weigh tempo', easy.cfg.tempo, false);
	check('easy blunders occasionally but is not random', easy.cfg.blunder > 0 && easy.cfg.blunder < 0.25, true);
}


console.log('\n--- transform / Imposter ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	const gen = ai.gen(9);

	// A Ditto that has copied Hydreigon must be judged as Hydreigon, not as Ditto.
	const s = scenario({ me: 'Ditto', myMoves: ['Dark Pulse'], foe: 'Dachsbun' });
	const entry = s.request.side.pokemon[0];
	delete entry.stats;                       // transformed stats are not reported
	const plain = ai.myPokemon(gen, entry, s.state);
	s.state.mine.a.transformed = 'Hydreigon';
	const copied = ai.myPokemon(gen, entry, s.state);
	check('a transformed Ditto is modelled as what it copied',
		copied.species.name === 'Hydreigon' && plain.species.name === 'Ditto', true);

	// A benched Imposter Ditto mirrors whatever is in front of it.
	const s2 = scenario({ me: 'Blissey', myMoves: ['Seismic Toss'], foe: 'Iron Boulder' });
	const ditto = benchMon('Ditto', ['Transform'], { item: 'choicescarf' });
	ditto.ability = 'imposter'; ditto.baseAbility = 'imposter';
	delete ditto.stats;
	const asSwitchIn = ai.switchInAs(gen, ditto, s2.state, s2.state.foes());
	check('a benched Imposter is judged as a mirror of the foe',
		asSwitchIn.species.name === 'Iron Boulder', true);

	// ...and so it should be preferred over something that is 4x weak to it.
	const articuno = benchMon('Articuno', ['Ice Beam', 'Hurricane'], {});
	s2.request.side.pokemon.push(ditto, articuno);
	const field = new (require('@smogon/calc').Field)({});
	s2.state.opponent.a.moves = new Set(['Mighty Cleave', 'Close Combat']);
	const dScore = ai.benchScore(gen, ditto, s2.state, field, s2.request);
	const aScore = ai.benchScore(gen, articuno, s2.state, field, s2.request);
	check('Imposter beats a Pokemon that is 4x weak to what is out', dScore > aScore, true);

	// Patch 1.2b: a boosted sweeper is the time to bring the Ditto in, and it is
	// judged with the foe's attacks, not its own Transform.
	const s3 = scenario({ me: 'Blissey', myMoves: ['Seismic Toss'], foe: 'Dragonite', foeMoves: ['Dragon Dance', 'Extreme Speed', 'Earthquake'] });
	const ditto3 = benchMon('Ditto', ['Transform'], { item: 'choicescarf' });
	ditto3.ability = 'imposter'; ditto3.baseAbility = 'imposter';
	delete ditto3.stats;
	const calm = ai.benchScore(gen, ditto3, s3.state, field, s3.request);
	s3.state.opponent.a.boosts = { atk: 2, spe: 2 };
	const boosted = ai.benchScore(gen, ditto3, s3.state, field, s3.request);
	check('a boosted foe makes the Imposter switch-in worth much more', boosted > calm + 30, true);
	check('the Imposter is scored with the foe\'s own attacks', calm > -50, true);
}

console.log('\n--- self-dropping moves (Patch 1.2b) ---');
{
	for (const difficulty of ['normal', 'hard', 'champion']) {
		const ai = new BattleAI({ difficulty, cfg: { blunder: 0, noise: 0 } });
		const gen = ai.gen(9);
		// A Latios at -4 Sp. Atk from two Draco Meteors, with Psyshock and Flamethrower too.
		const s = scenario({ me: 'Latios', myMoves: ['Draco Meteor', 'Psyshock', 'Flamethrower'], foe: 'Heatran', foeMoves: ['Magma Storm'] });
		s.state.mine.a.boosts = { spa: -4 };
		const choice = ai.turnChoice(s.request, s.state);
		check(`${difficulty}: stops firing Draco Meteor from -4`, choice !== 'move 1', true);
	}
	// Easy is the in-game trainer that doesn't notice.
	const easy = new BattleAI({ difficulty: 'easy', cfg: { blunder: 0, noise: 0 } });
	const s = scenario({ me: 'Latios', myMoves: ['Draco Meteor', 'Tackle'], foe: 'Snorlax', foeMoves: [] });
	s.state.mine.a.boosts = { spa: -4 };
	check('easy: still reaches for the biggest number', easy.turnChoice(s.request, s.state), 'move 1');
}

console.log('\n--- terastallizing ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	const gen = ai.gen(9);
	const field = new (require('@smogon/calc').Field)({});

	// The exact situation that lost a Gallade: Play Rough is ~96% into it, and
	// Tera Steel resists Fairy. Spending Tera here is correct; it survives.
	const s = scenario({ me: 'Gallade', myMoves: ['Close Combat'], foe: 'Dachsbun', foeMoves: ['Play Rough'] });
	s.request.active[0].canTerastallize = 'Steel';
	const entry = s.request.side.pokemon[0];
	delete entry.stats;
	const best = { name: 'Close Combat', score: 50, n: 1 };
	check('teras defensively to survive a hit that would knock it out',
		ai.teraWorthIt(gen, s.request.active[0], entry, s.state, s.state.foes(), field, best, 96), true);

	// A Tera that neither adds damage nor removes the threat is hoarded.
	const s2 = scenario({ me: 'Gallade', myMoves: ['Close Combat'], foe: 'Dachsbun', foeMoves: ['Play Rough'] });
	s2.request.active[0].canTerastallize = 'Fighting';
	const entry2 = s2.request.side.pokemon[0];
	delete entry2.stats;
	check('does not tera into a type that leaves it just as dead',
		ai.teraWorthIt(gen, s2.request.active[0], entry2, s2.state, s2.state.foes(), field, best, 96), false);
}

console.log('\n--- dynamax ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	check('dynamaxes to survive a hit that doubling HP would live through', ai.dynamaxWorthIt(40, 60, { score: 10 }), true);
	check('does not dynamax when it dies either way', ai.dynamaxWorthIt(20, 90, { score: 80 }), false);
	check('dynamaxes on a strong attacking turn while healthy', ai.dynamaxWorthIt(100, 20, { score: 70 }), true);
}


console.log('\n--- learning abilities during the battle ---');
{
	const ai = new BattleAI({ difficulty: 'champion' });
	const gen = ai.gen(9);
	const calcLib = require('@smogon/calc');
	const field = new calcLib.Field({});
	const atk = new calcLib.Pokemon(gen, 'Walking Wake', { level: 100, evs: { spa: 252 } });

	const gastro = () => ({
		species: 'Gastrodon', level: 100, hp: 100, maxhp: 100, status: '', fainted: false,
		boosts: {}, moves: new Set(), item: null, ability: null, tera: null, transformed: null,
		immuneTo: new Set(), notImmuneTo: new Set(), keptItem: false,
	});

	// Nothing known: the possible Water immunity has to drag the estimate down.
	const blind = ai.damageToFoe(gen, atk, gastro(), 'Surf', field);
	check('an unknown Gastrodon discounts Surf for possible Storm Drain', blind < 40, true);

	// It switched in on Surf and took nothing: that is Storm Drain, for good.
	const absorbed = gastro();
	absorbed.immuneTo.add('Surf');
	check('Surf that did nothing is remembered as an immunity',
		ai.damageToFoe(gen, atk, absorbed, 'Surf', field), 0);

	// It took the Surf: it cannot be Storm Drain, so stop discounting.
	const landed = gastro();
	landed.notImmuneTo.add('Surf');
	check('Surf that landed rules the immunity out for the rest of the battle',
		ai.damageToFoe(gen, atk, landed, 'Surf', field) > blind, true);

	// Knock Off failed to take the item: Sticky Hold, so not Storm Drain either.
	const sticky = gastro();
	sticky.keptItem = true;
	check('an item that would not come off points at Sticky Hold',
		ai.damageToFoe(gen, atk, sticky, 'Surf', field) > blind, true);

	// The protocol itself must feed those flags in.
	const st = new BattleState('t');
	st.myPlayer = 'p2';
	st.line(['switch', 'p1a: Gastrodon', 'Gastrodon, M', '100/100']);
	st.line(['move', 'p2a: Walking Wake', 'Surf', 'p1a: Gastrodon']);
	st.line(['-immune', 'p1a: Gastrodon']);
	check('the tracker records an immunity from the log', st.opponent.a.immuneTo.has('Surf'), true);

	const st2 = new BattleState('t');
	st2.myPlayer = 'p2';
	st2.line(['switch', 'p1a: Gastrodon', 'Gastrodon, M', '100/100']);
	st2.line(['move', 'p2a: Walking Wake', 'Surf', 'p1a: Gastrodon']);
	st2.line(['-damage', 'p1a: Gastrodon', '60/100']);
	check('the tracker records a move that landed', st2.opponent.a.notImmuneTo.has('Surf'), true);
}

console.log('\n--- an attacking stat dropped by someone else ---');
{
	// Garchomp at -4 Attack (Intimidate, Charm, Parting Shot...) against a Skarmory
	// its bench resists: it used to go on clicking Earthquake, because only drops
	// from its own moves were counted. Realistic HP, so nothing looks like a one-shot.
	const drop = (atk, moves, difficulty) => {
		const { request, state } = scenario({
			me: 'Garchomp', myMoves: moves, foe: 'Skarmory', foeMoves: ['Brave Bird', 'Roost', 'Spikes'],
			bench: [benchMon('Heatran', ['Magma Storm', 'Earth Power'], { condition: '341/341' }), benchMon('Kingambit', ['Kowtow Cleave', 'Sucker Punch'], { condition: '341/341' })],
		});
		request.side.pokemon[0].condition = '357/357';
		state.mine.a.hp = 357; state.mine.a.maxhp = 357;
		state.mine.a.boosts = { atk };
		const ai = new BattleAI({ difficulty });
		ai.setFormat('gen9ou');
		const choice = ai.decide(request, state);
		const n = /^move (\d)/.exec(choice);
		return n ? moves[+n[1] - 1] : choice;
	};
	const physical = ['Earthquake', 'Dragon Claw', 'Stone Edge', 'Swords Dance'];
	const mixed = ['Earthquake', 'Dragon Claw', 'Fire Blast', 'Swords Dance'];
	for (const difficulty of ['champion', 'stockfish']) {
		check(`${difficulty}: at 0 Attack it stays in`, drop(0, physical, difficulty), c => !/^switch/.test(c));
		check(`${difficulty}: at -4 Attack with only physical moves it switches out`, drop(-4, physical, difficulty), c => /^switch/.test(c));
		check(`${difficulty}: at -4 Attack with a special move it uses that`, drop(-4, mixed, difficulty), 'Fire Blast');
	}
}

console.log('\n--- hazard removal only when there are hazards ---');
{
	const defog = (hazards, difficulty) => {
		const moves = ['Defog', 'Body Press', 'Roost', 'Iron Defense'];
		const { request, state } = scenario({ me: 'Corviknight', myMoves: moves, foe: 'Toxapex', foeMoves: ['Toxic', 'Recover', 'Haze'] });
		request.side.pokemon[0].condition = '399/399';
		state.mine.a.hp = 399; state.mine.a.maxhp = 399;
		state.hazards[state.myPlayer] = hazards;
		const ai = new BattleAI({ difficulty });
		ai.setFormat('gen9ou');
		const n = /^move (\d)/.exec(ai.decide(request, state));
		return n ? moves[+n[1] - 1] : 'switch';
	};
	for (const difficulty of ['champion', 'stockfish']) {
		check(`${difficulty}: no Defog with no hazards up`, defog({}, difficulty), c => c !== 'Defog');
		check(`${difficulty}: no Defog when only Tailwind is up`, defog({ Tailwind: 1 }, difficulty), c => c !== 'Defog');
		check(`${difficulty}: Defog with Stealth Rock and two Spikes on its side`, defog({ 'Stealth Rock': 1, Spikes: 2 }, difficulty), 'Defog');
	}
}

console.log(`\n=== ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
