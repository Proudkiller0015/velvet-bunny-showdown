'use strict';
/**
 * Custom moves and abilities do what their descriptions say (24 Sep 2026).
 *
 * The site audit found a handful where the text and the code disagreed. Each
 * was settled one way or the other - the code fixed where the text was the
 * intent, the text fixed where it was simply wrong - and this pins the
 * settled behaviour down:
 *
 *  - Jungle/Cinder/Torrent Rush and Resolute Strike pick their category
 *    "before any boosts", so a Swords Dance does not flip a special attacker.
 *  - Tectonic Shell heals half the base max HP rounded half up, prints no
 *    false "-fail" at full HP when the rocks still go up, and fails when
 *    neither half does anything.
 *  - Keystone Legion mends after any other faint, even one while it was benched.
 *  - Witch's Snatch has its gen, and curses (adds Ghost) with or without an item.
 *  - Thorned Bouquet's Poison half: Fairy takes it super effectively, Steel
 *    still only resists it.
 *
 * Like the other battle tests this reads the data installed in node_modules by
 * scripts/setup-config.js, so run that (or deploy) after changing data/velvet.
 *
 *   node test/desc-code.test.js
 */

const { Battle } = require('pokemon-showdown');
const Dex = require('../src/rp-dex')();

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

function battle(p1, p2, seed = [1, 2, 3, 4]) {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: p1.map(s => ({ level: 100, evs: {}, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	b.setPlayer('p2', { team: p2.map(s => ({ level: 100, evs: {}, ivs: {}, nature: 'Hardy', item: '', ...s })) });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	return b;
}
const log = b => b.log.join('\n');

/** The category a move would have for this Pokemon, after its onModifyMove. */
function categoryFor(b, pokemon, id) {
	const move = Dex.moves.get(id);
	const m = { ...move };
	move.onModifyMove.call(b, m, pokemon, b.p2.active[0]);
	return m.category;
}

// Category before boosts.
for (const [species, id] of [['Simisage', 'junglerush'], ['Simisear', 'cinderrush'], ['Simipour', 'torrentrush'], ['Azelf', 'resolutestrike']]) {
	const special = battle([{ species, ability: 'Gluttony', moves: [id], nature: 'Modest', evs: { spa: 252 } }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	const s = special.p1.active[0];
	check(categoryFor(special, s, id) === 'Special', `${id}: a special attacker's is Special`);
	s.boosts.atk = 6;
	check(categoryFor(special, s, id) === 'Special', `${id}: and stays Special at +6 Attack (before boosts)`);

	const physical = battle([{ species, ability: 'Gluttony', moves: [id], nature: 'Adamant', evs: { atk: 252 } }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	const p = physical.p1.active[0];
	p.boosts.spa = 6;
	check(categoryFor(physical, p, id) === 'Physical', `${id}: a physical attacker's stays Physical at +6 Sp. Atk`);
}

// Tectonic Shell.
{
	const shell = () => battle([{ species: 'Torterra', ability: 'World Turtle', moves: ['tectonicshell'] }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	let b = shell();
	let t = b.p1.active[0];
	t.hp = 1;
	b.makeChoices('move 1', 'move 1');
	check(t.hp - 1 === Math.round(t.baseMaxhp / 2), `Tectonic Shell heals half the base max HP, rounded half up (${t.hp - 1} of ${t.baseMaxhp})`);

	b = shell();
	b.makeChoices('move 1', 'move 1');
	check(!!b.p2.sideConditions.stealthrock && !/\|-fail\|/.test(log(b)), 'at full HP: the rocks go up and nothing says it failed');
	b.makeChoices('move 1', 'move 1');
	check(/\|-fail\|p1a: Torterra/.test(log(b)), 'at full HP with rocks already up: it fails');
}

// Keystone Legion mends after a faint it did not see.
{
	const legion = mended => {
		const b = battle(
			[{ species: 'Spiritomb', ability: 'Keystone Legion', moves: ['splash'] }],
			[{ species: 'Rhyperior', ability: 'Solid Rock', moves: ['megahorn'], nature: 'Adamant', evs: { atk: 252 } }],
		);
		const tomb = b.p1.active[0];
		tomb.m.keystoneCracked = true;
		tomb.m.keystoneFaints = 0;
		if (mended) b.p2.totalFainted++;   // a faint while it was on the bench
		tomb.hp = 5;
		b.makeChoices('move 1', 'move 1');
		return tomb;
	};
	check(legion(true).hp === 1, 'Keystone Legion: a faint while benched mends it, so it holds again');
	check(legion(false).fainted || legion(false).hp === 0, 'and with no faint since, it does not');
}

// Witch's Snatch.
{
	check(Dex.moves.get('witchssnatch').gen === 9, "Witch's Snatch says it is Gen 9");
	const b = battle([{ species: 'Banette', ability: 'Insomnia', moves: ['witchssnatch'] }], [{ species: 'Blissey', ability: 'Natural Cure', moves: ['splash'] }]);
	b.makeChoices('move 1', 'move 1');
	check(b.p2.active[0].hasType('Ghost'), "Witch's Snatch adds the Ghost type even with no item to take");
}

// Thorned Bouquet's Poison half.
{
	const eff = (species, ability) => {
		const b = battle([{ species: 'Roserade', ability: 'Natural Cure', moves: ['thornedbouquet'] }], [{ species, ability, moves: ['splash'] }]);
		const target = b.p2.active[0];
		target.setStatus('psn', null, null, true);
		target.status = 'psn';
		return target.runEffectiveness(Dex.getActiveMove('thornedbouquet'));
	};
	check(eff('Clefable', 'Magic Guard') === 1, 'Thorned Bouquet vs a poisoned Fairy: super effective');
	check(eff('Registeel', 'Clear Body') === -1, 'vs a poisoned Steel: still only resisted');
	check(eff('Tangrowth', 'Chlorophyll') === 0, 'vs a poisoned Grass: neutral');
	check(eff('Muk', 'Stench') === -2, 'vs a poisoned Poison: doubly resisted');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
