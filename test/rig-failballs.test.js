'use strict';
/* An arranged miss (rp-bot rigs.js failBalls -> /throwball appends 'fail'): even a Master Ball misses, the ball is spent, the battle goes on. node test/rig-failballs.test.js */
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
				if (request.wait) continue;
				// Wild encounters have team preview now (the lead is picked there).
				if (request.teamPreview) { void streams.p1.write('default'); continue; }
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
				if (request.teamPreview) { void streams.p2.write('default'); continue; }
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
  const electrode = { species: 'Electrode', level: 30, moves: ['Explosion'], item: 'Choice Scarf', shiny: true, ability: 'Static', evs: {}, ivs: {} };
  const me = mine('Pikachu', 30, ['Thunder Wave', 'Quick Attack']);
  // 1. The forced miss: even a Master Ball, then Electrode blows up.
  let r = await play({ wild: electrode, p1team: me, plan: (t) => t === 1 ? 'ball master fail' : 'move 1', turns: 3 });
  const L = String(r.log);
  check(L.includes('threw a Master Ball'), 'the ball is thrown');
  check(!L.includes('Gotcha!'), 'a forced miss never catches, even a Master Ball');
  check((L.match(/wobble/g) || []).length >= 2, 'it wobbles at least twice (looks close)');
  check(/\|move\|p2a: Electrode\|Explosion/.test(L), 'Electrode uses Explosion');
  check(/\|faint\|p2a: Electrode/.test(L), 'and blows itself up');
  // 2. The same throw without the flag still catches (nothing else changed).
  r = await play({ wild: electrode, p1team: me, plan: (t) => t === 1 ? 'ball master' : 'move 1', turns: 3 });
  check(String(r.log).includes('Gotcha!'), 'without the rig a Master Ball catches as usual');
  console.log(failed ? `${failed} failed` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
