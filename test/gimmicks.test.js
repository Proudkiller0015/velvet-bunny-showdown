'use strict';
/**
 * The four gimmicks in an RP battle, as the player's menu sees them.
 *
 *   node test/gimmicks.test.js
 *
 * RP formats hand out Mega Evolution, Z-moves, Dynamax and Terastallization in
 * one battle, one of the four per side, which means config/custom-formats.js
 * overrides the engine's own refusals. Those overrides are where the menu gets
 * broken, and a broken menu is invisible from the server's side: the battle is
 * correct and the buttons lie about it.
 *
 * The bug this was written for: the turns after Dynamaxing went back to showing
 * Imperial Torrent and Roost, because the spent-gimmick guard also refused the
 * question the engine asks purely to name a Dynamaxed Pokemon's Max moves.
 */

const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');

let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };

// A custom move (Imperial Torrent) and an ordinary one, so the Max names have
// to be worked out from our own data rather than copied from a table.
const TEAM = Teams.pack(Teams.import(`
Empoleon @ Leftovers
Ability: Torrent
Level: 100
EVs: 252 HP / 252 SpA / 4 Spe
Modest Nature
- Imperial Torrent
- Roost
- Stealth Rock
- Flash Cannon

Glaceon @ Heavy-Duty Boots
Ability: Diamond Dust
Level: 100
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Blizzard
- Freeze-Dry
- Ice Shard
- Calm Mind
`.trim()));

/** Play `turns` turns of the format, dynamaxing on the first, and report p1's menus. */
async function menus(format, turns) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	void streams.omniscient.write(
		`>start ${JSON.stringify({ formatid: format })}\n` +
		`>player p1 ${JSON.stringify({ name: 'P1', team: TEAM })}\n` +
		`>player p2 ${JSON.stringify({ name: 'P2', team: TEAM })}\n`
	);
	// Drained so the battle is not waiting on a full buffer.
	void (async () => { for await (const chunk of streams.p2) void chunk; })();
	void (async () => { for await (const chunk of streams.omniscient) void chunk; })();

	const seen = [];
	const done = new Promise(resolve => {
		const timer = setTimeout(() => resolve(), 20000);
		void (async () => {
			for await (const chunk of streams.p1) {
				for (const line of chunk.split('\n')) {
					if (!line.startsWith('|request|')) continue;
					const req = JSON.parse(line.slice(9));
					if (req.teamPreview) { void streams.omniscient.write('>p1 team 12\n>p2 team 12\n'); continue; }
					const active = req.active && req.active[0];
					if (!active) continue;
					const max = active.maxMoves && (active.maxMoves.maxMoves || active.maxMoves);
					seen.push({ canDynamax: !!active.canDynamax, maxMoves: max ? max.map(m => m.move) : null });
					if (seen.length >= turns) { clearTimeout(timer); resolve(); return; }
					void streams.omniscient.write(`>p1 move 1${seen.length === 1 ? ' dynamax' : ''}\n>p2 move 1\n`);
				}
			}
		})();
	});
	await done;
	return seen;
}

(async () => {
	const rp = await menus('gen9rpou', 4);
	check(rp.length >= 3, `three turns of menus (got ${rp.length})`);

	check(rp[0] && rp[0].canDynamax, 'turn 1 offers Dynamax');
	check(!!(rp[0] && rp[0].maxMoves && rp[0].maxMoves[0] === 'maxgeyser'),
		`a custom Water move is named as Max Geyser (got ${rp[0] && rp[0].maxMoves && rp[0].maxMoves[0]})`);
	check(!!(rp[0] && rp[0].maxMoves && rp[0].maxMoves[1] === 'maxguard'), 'a status move is named as Max Guard');

	// The regression: while Dynamaxed the menu must keep showing Max moves.
	check(!!(rp[1] && rp[1].maxMoves && rp[1].maxMoves.length === 4), 'turn 2, still Dynamaxed, still shows Max moves');
	check(!!(rp[2] && rp[2].maxMoves && rp[2].maxMoves.length === 4), 'turn 3, last Dynamax turn, still shows Max moves');
	// ...and it must not offer a second one.
	check(!(rp[1] && rp[1].canDynamax) && !(rp[2] && rp[2].canDynamax), 'Dynamax is not offered twice');

	// Generations that never had it are not handed the buttons.
	const old = await menus('gen4rpou', 1).catch(() => []);
	if (old.length) check(!old[0].canDynamax && !old[0].maxMoves, 'a Gen 4 RP battle has no Dynamax at all');

	console.log(`\n${passed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
