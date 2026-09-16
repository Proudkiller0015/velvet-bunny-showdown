'use strict';
/**
 * The rarity ladder and the wild encounter odds built on it.
 *
 *   node test/rarity.test.js
 */
const assert = require('assert');
const R = require('../src/rarity');
const E = require('../src/encounters');
const T = require('../src/encounter-tables/kagura');
const { Dex } = require('pokemon-showdown');

let seed = 11;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// The ladder, top to bottom.
const ladder = ['Koraidon', 'Mew', 'Regirock', 'Flutter Mane', 'Xurkitree', 'Garchomp', 'Turtwig', 'Growlithe', 'Caterpie'];
assert.deepEqual(ladder.map(R.classOf), ['boxart', 'mythical', 'legendary', 'paradox', 'ub', 'pseudo', 'starter', 'rare', 'common']);
for (let i = 1; i < ladder.length; i++) assert.ok(R.score(ladder[i - 1]) > R.score(ladder[i]), `${ladder[i - 1]} outranks ${ladder[i]}`);
// Usage inside a class, and the Paradoxes the Dex forgot to tag.
assert.ok(R.score('Garchomp') > R.score('Goodra'), 'a Garchomp is not a Goodra');
assert.equal(R.classOf('Raging Bolt'), 'paradox');
assert.equal(R.usageOf('Caterpie'), 0, 'the RU stamp on an Illegal line is not a verdict');

// Legendaries are never wild; headliners never come from "anything of the right type".
assert.equal(R.wildWeight('Regirock'), 0);
assert.ok(R.wildWeight('Bagon', 0) < R.wildWeight('Bagon', 6) / 10, 'a pseudo is far rarer short on badges');

const noon = Date.UTC(2026, 8, 16, 10); // 12:00 in Paris
const night = Date.UTC(2026, 8, 16, 22); // 00:00 in Paris
assert.equal(E.clock(noon).period, 'day');
assert.equal(E.clock(night).period, 'night');
assert.equal(E.clock(Date.UTC(2026, 9, 31, 20)).event.id, 'halloween');
assert.equal(E.clock(Date.UTC(2026, 6, 1)).season, 'summer');
const gastly = Dex.species.get('Gastly');
assert.ok(E.clockWeight(gastly, night) > E.clockWeight(gastly, noon), 'Ghosts are commoner at night');
assert.ok(E.clockWeight(gastly, noon) > 0.5, 'and still out at noon');

function sample(place, opts, n = 400) {
	const out = { classes: {}, levels: 0, ghost: 0, babies: 0 };
	for (let i = 0; i < n; i++) {
		const mon = E.rollWild({ place: T.locations[place], rng, double: false, ...opts }).team[0];
		const s = Dex.species.get(mon.species);
		const c = R.classOf(s);
		out.classes[c] = (out.classes[c] || 0) + 1;
		out.levels += mon.level / n;
		if (s.types.includes('Ghost')) out.ghost += 1 / n;
		if (E.BABIES.has(s.id)) out.babies += 1 / n;
	}
	return out;
}

// Nothing a place does not list: a town with no pseudos never shows one.
const town = sample('sakura', { badges: 8, levelCap: 60, ace: 60, now: noon });
assert.ok(!town.classes.pseudo && !town.classes.ub && !town.classes.paradox, 'headliners only where a place lists them');

// Your ace pulls the levels down when it sits under your cap.
const strong = sample('sakura', { badges: 6, levelCap: 60, ace: 60, now: noon }, 200);
const weak = sample('sakura', { badges: 6, levelCap: 60, ace: 20, now: noon }, 200);
assert.ok(weak.levels < strong.levels - 5, `ace 20 meets lower levels (${weak.levels.toFixed(1)} vs ${strong.levels.toFixed(1)})`);

// Halloween night in Ghost Woods is haunted; noon is not empty of them either.
const haunted = sample('ghost', { badges: 0, levelCap: 13, ace: 13, now: Date.UTC(2026, 9, 31, 22) });
const day = sample('ghost', { badges: 0, levelCap: 13, ace: 13, now: noon });
assert.ok(haunted.ghost > day.ghost + 0.1, `more Ghosts on Halloween night (${haunted.ghost.toFixed(2)} vs ${day.ghost.toFixed(2)})`);
assert.ok(day.ghost > 0.1, 'Ghosts still turn up at noon');

// A rare list of only pseudos no longer hands one out every 25 encounters at no badges.
const route9 = sample('route-9', { badges: 0, levelCap: 13, ace: 13, now: noon }, 1500);
assert.ok((route9.classes.pseudo || 0) / 1500 < 0.01, 'pseudos are rare at no badges');

// Stages: one ahead of its level now and then, never more.
const line = E.rootOf(Dex.species.get('Gible'));
let ahead = 0;
for (let i = 0; i < 2000; i++) if (E.stageFor(line, 10, rng, { ahead: 0.04 }).name !== 'Gible') ahead++;
assert.ok(ahead > 20 && ahead < 200, `a Gabite at level 10 is unusual, not impossible (${ahead}/2000)`);

console.log('rarity: ok');
