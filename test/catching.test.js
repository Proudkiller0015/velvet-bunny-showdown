'use strict';
/**
 * The RP Wild Encounter format: throwing a ball, catching, missing, and the
 * things a ball must refuse to do.
 *
 * Runs the real simulator with the real format, the way a battle on the server
 * does, so this catches the engine disagreeing with the format as well as the
 * format being wrong.
 *
 *   node test/catching.test.js
 */

require('../scripts/setup-config');
const { BattleStream, getPlayerStreams, Teams, Dex } = require('pokemon-showdown');
const E = require('../src/encounters');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function mine(species = 'Pikachu', level = 20, moves = ['Thunder Wave', 'Quick Attack']) {
	return Teams.pack([{ species, level, moves, ability: Dex.species.get(species).abilities[0], evs: {}, ivs: {} }]);
}

/**
 * Play a battle where p1 does `plan(turn, request)` each turn and the wild side
 * always uses its first move. Returns the full log.
 */
async function play({ wild, wilds = null, format = E.WILD_FORMAT, wildName = null, p1team = mine(), plan, onError = null, seed, turns = 40 }) {
	const team = wilds || [wild];
	wildName = wildName || (team.length > 1 ? 'Wild Pokemon' : E.wildName(Dex.species.get(team[0].species)));
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const log = [];
	const errors = [];
	let turn = 0;

	void (async () => { for await (const chunk of streams.spectator) log.push(chunk); })();
	void (async () => {
		for await (const chunk of streams.p1) {
			for (const line of chunk.split('\n')) {
				if (line.startsWith('|error|')) {
					errors.push(line);
					if (onError && /Invalid choice/.test(line)) void streams.p1.write(onError);
				}
				if (!line.startsWith('|request|')) continue;
				const request = JSON.parse(line.slice(9));
				if (request.wait || request.teamPreview) continue;
				if (request.forceSwitch) { void streams.p1.write('default'); continue; }
				turn++;
				void streams.p1.write(turn > turns ? 'move 1' : plan(turn, request));
			}
		}
	})();
	void (async () => {
		for await (const chunk of streams.p2) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|request|')) continue;
				const request = JSON.parse(line.slice(9));
				if (request.wait) continue;
				const n = (request.active || [1]).length;
				void streams.p2.write(Array.from({ length: n }, (_, i) =>
					request.side.pokemon[i] && !request.side.pokemon[i].condition.endsWith(' fnt') ? 'move 1' : 'pass').join(', '));
			}
		}
	})();

	const spec = { formatid: format };
	if (seed) spec.seed = seed;
	void streams.omniscient.write(`>start ${JSON.stringify(spec)}\n` +
		`>player p1 ${JSON.stringify({ name: 'Mira', team: p1team })}\n` +
		`>player p2 ${JSON.stringify({ name: wildName, team: Teams.pack(team) })}`);

	for (let i = 0; i < 200; i++) {
		await new Promise(r => setTimeout(r, 10));
		if (log.join('').includes('|win|') || log.join('').includes('|tie')) break;
	}
	return { log: log.join('\n'), errors };
}

(async () => {
	check(Dex.formats.get(E.WILD_FORMAT).exists, 'the format exists');

	// 1. A Master Ball always works, on turn one, before the wild Pokemon moves.
	{
		const wild = E.wildSet(Dex.species.get('Pidgey'), 5);
		const { log } = await play({ wild, plan: () => 'ball master' });
		check(log.includes('Mira threw a Master Ball!'), 'the throw is announced');
		check(log.includes('Gotcha! Pidgey was caught!'), 'master ball catches');
		check(/\|win\|Mira/.test(log), 'catching wins the battle for the thrower');
		check(log.includes('((Caught Pidgey, Lv. 5, with a Master Ball))'), 'the RP line to paste is given');
		const throwAt = log.indexOf('threw a Master Ball');
		const pidgeyMove = log.indexOf('|move|p2a');
		check(pidgeyMove < 0 || pidgeyMove > throwAt, 'the throw comes before the wild Pokemon moves');
		check(log.includes('rpball0'), 'the ball buttons are posted at the start');
	}

	// 2. A Beast Ball on a Pidgey will almost always miss; misses must keep the battle going.
	{
		const wild = E.wildSet(Dex.species.get('Snorlax'), 30);
		const { log } = await play({ wild, plan: t => (t <= 3 ? 'ball beast' : 'move 1'), turns: 3 });
		check((log.match(/threw a Beast Ball/g) || []).length >= 1, 'a missed ball is thrown and announced');
		check(/broke free|appeared to be caught|Almost had it|so close/.test(log), 'a miss says so');
		check(!/\|-damage\|p2a[^\n]*\n[^\n]*threw/.test(log), 'no damage is dealt by the throwing turn');
		check(log.includes('rpball'), 'the ball buttons come back after a miss');
	}

	// 3. Throwing uses the turn: the player's Pokemon does not also attack.
	{
		const wild = E.wildSet(Dex.species.get('Snorlax'), 50);
		const { log } = await play({ wild, plan: t => (t === 1 ? 'ball beast' : 'move 1'), turns: 1 });
		const turn1 = log.split('|turn|2')[0];
		check(!/\|move\|p1a/.test(turn1), 'no move from the thrower on the turn it throws');
	}

	// 4. No catching somebody's Pokemon.
	{
		const wild = E.wildSet(Dex.species.get('Pidgey'), 5);
		const { errors } = await play({ wild, wildName: 'Hiker Bob', plan: t => (t === 1 ? 'ball master' : 'move 1'), turns: 1 });
		check(errors.some(e => /belongs to somebody/.test(e)), 'a trainer\'s Pokemon cannot be caught');
	}

	// 5. No catching legendaries, even if one somehow got here.
	{
		const wild = { ...E.wildSet(Dex.species.get('Pidgey'), 5), species: 'Mewtwo', name: 'Mewtwo', moves: ['Confusion'] };
		const { errors } = await play({ wild, wildName: 'Wild Mewtwo', plan: t => (t === 1 ? 'ball master' : 'move 1'), turns: 1 });
		check(errors.some(e => /legendaries happen in the RP/.test(e)), 'a legendary cannot be caught');
	}

	// 6. Doubles: no ball while two are standing; knock one out, catch the other.
	{
		const karp = () => ({ ...E.wildSet(Dex.species.get('Magikarp'), 2), moves: ['Splash'] });
		// Doubles need two Pokemon a side; the second one only ever waits.
		const p1team = Teams.pack([
			{ species: 'Pikachu', level: 100, moves: ['Thunderbolt'], ability: 'Static', evs: {}, ivs: {} },
			{ species: 'Chansey', level: 100, moves: ['Splash'], ability: 'Natural Cure', evs: {}, ivs: {} },
		]);
		const { log, errors } = await play({
			wilds: [karp(), karp()], format: E.WILD_DOUBLE_FORMAT, p1team,
			plan: t => 'ball master',   // the first is refused, and the fallback knocks one out
			onError: 'move 1 1, move 1', turns: 6,
		});
		if (process.env.DEBUG) console.log(errors, log.split('\n').filter(l => /move|faint|threw|Gotcha|win|turn/.test(l)).join('\n'));
		check(errors.some(e => /two wild Pokémon out/.test(e)), 'doubles: no throwing while two wild Pokemon stand');
		check(log.includes('Gotcha! Magikarp was caught!'), 'doubles: the last one standing can be caught');
		check(/\|win\|Mira/.test(log), 'doubles: catching it wins');
	}

	// 7. Items in battle: a Potion heals, a Revive brings back a fainted Pokemon, and nonsense is refused.
	{
		// A strong wild Pokemon that knocks out a weak lead, so there is something to revive.
		const wild = { ...E.wildSet(Dex.species.get('Snorlax'), 60), moves: ['Body Slam'] };
		const p1team = Teams.pack([
			{ species: 'Pikachu', level: 5, moves: ['Thunder Shock'], ability: 'Static', evs: {}, ivs: {} },
			{ species: 'Chansey', level: 80, moves: ['Splash'], ability: 'Natural Cure', evs: {}, ivs: {} },
		]);
		const plan = t => (t === 1 ? 'item potion Chansey' : t === 2 ? 'item revive Pikachu' : t === 3 ? 'item superpotion Chansey' : 'move 1');
		const { log, errors } = await play({ wild, format: E.WILD_FORMAT, p1team, plan, onError: 'move 1', turns: 4 });
		if (process.env.DEBUG) console.log(errors, log.split('\n').filter(l => /move|faint|used|heal|revived|switch|turn/.test(l)).join('\n'));
		check(errors.some(e => /doesn't need a Potion/.test(e)), 'a Potion on a Pokemon at full HP is refused');
		check(/used a Revive on Pikachu!/.test(log) && /Pikachu was revived!/.test(log), 'a Revive brings back a fainted Pokemon');
	}

	// 8. Catch odds are the generous ones promised.
	{
		const pidgey = E.catchChance({ ball: 'poke', hpFraction: 1, rate: E.catchRate(Dex.species.get('Pidgey')), status: '' });
		const chomp = E.catchChance({ ball: 'ultra', hpFraction: 1, rate: E.catchRate(Dex.species.get('Garchomp')), status: '' });
		const chompLow = E.catchChance({ ball: 'ultra', hpFraction: 0.1, rate: E.catchRate(Dex.species.get('Garchomp')), status: 'slp' });
		check(pidgey >= 0.45 && pidgey <= 0.55, `a full HP Pidgey in a Poké Ball is a coin flip (${Math.round(pidgey * 100)}%)`);
		check(chomp > 0.15 && chomp < 0.4, `a full HP Garchomp is a real but fair chance (${Math.round(chomp * 100)}%)`);
		check(chompLow > 0.85, `a weakened, sleeping Garchomp is nearly certain (${Math.round(chompLow * 100)}%)`);
		check(E.catchChance({ ball: 'poke', hpFraction: 1, rate: 25, status: '', misses: 4 }) >
			E.catchChance({ ball: 'poke', hpFraction: 1, rate: 25, status: '' }), 'misses make the next ball likelier');
	}

	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
