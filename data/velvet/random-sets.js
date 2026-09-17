'use strict';
/**
 * RP Random Battle: the buffed Pokemon, showing what they can do.
 *
 * A random battle draws from one table of hand-written sets, and a Pokemon with
 * no entry in it simply never appears. Ours have no entry - they were never in
 * Scarlet and Violet, so Showdown's ninth-generation table has nothing for them
 * - which means the format that ought to show off what this server changed is
 * the one format where none of it turns up.
 *
 * So: a set apiece, written to show the buff rather than to win. Each monkey
 * leads with its own Rush move and its own weather ability, holding the
 * Elemental Banana, because that combination is the entire point of the buff
 * and a player meeting one should see it working.
 *
 * All of this applies to `[Gen 9] RP Random Battle` and nothing else. The
 * ordinary Random Battle ladder is untouched, which matters: it is the one the
 * bots have been rated on for weeks.
 */

const FORMAT = 'gen9rprandombattle';

/**
 * Sets for the Pokemon this server buffs.
 *
 * Same shape as Showdown's own table - a level, then one or more roles, each
 * with a movepool the generator draws four from, the abilities it may roll, and
 * the Tera types it may pick.
 *
 * The levels are deliberately generous. Random battle levels are a balance
 * knob: the weaker the Pokemon, the higher the number, and these three are 480
 * base stats even after everything here.
 */
const SETS = {
	simisage: {
		level: 84,
		sets: [
			{
				role: 'Fast Attacker',
				movepool: ['Jungle Rush', 'Grassy Glide', 'Knock Off', 'Swords Dance', 'U-turn'],
				abilities: ['Verdant Surge'],
				teraTypes: ['Grass'],
			},
			{
				role: 'Setup Sweeper',
				movepool: ['Jungle Rush', 'Swords Dance', 'Grassy Glide', 'Close Combat', 'Ice Punch'],
				abilities: ['Verdant Surge'],
				teraTypes: ['Grass'],
			},
		],
	},
	simisear: {
		level: 84,
		sets: [
			{
				role: 'Fast Attacker',
				movepool: ['Cinder Rush', 'Temper Flare', 'Flame Charge', 'Knock Off', 'U-turn'],
				abilities: ['Solar Surge'],
				teraTypes: ['Fire'],
			},
			{
				role: 'Setup Sweeper',
				movepool: ['Cinder Rush', 'Nasty Plot', 'Flamethrower', 'Focus Blast', 'Thunder Punch'],
				abilities: ['Solar Surge'],
				teraTypes: ['Fire'],
			},
		],
	},
	simipour: {
		level: 84,
		sets: [
			{
				role: 'Fast Attacker',
				movepool: ['Torrent Rush', 'Liquidation', 'Wave Charge', 'Knock Off', 'U-turn'],
				abilities: ['Tidal Surge'],
				teraTypes: ['Water'],
			},
			{
				role: 'Setup Sweeper',
				movepool: ['Torrent Rush', 'Close Combat', 'Ice Punch', 'Wave Charge', 'Knock Off'],
				abilities: ['Tidal Surge'],
				teraTypes: ['Water'],
			},
		],
	},
	// The owner's own set (Patch 1.5): the Calm special wall that curses what it
	// survives, then drains it. The nature and spread are read by the bots' team
	// builders (src/role-sets.js); Random Battle ignores them.
	// Glaceon sets its own snow with Diamond Dust and doubles its Speed in it: the sweeper
	// that ability was written for. Showdown only remembers the Wish/Protect Glaceon of 2010.
	// Flareon burns itself on entry with Kindled Fury (Speed Boost + Guts in one), so its
	// Attack and Speed climb on their own. Swords Dance, which Patch 1.5b handed it, is what
	// that was missing: Showdown only remembers a Flareon with nothing to set up with.
	flareon: {
		level: 84,
		sets: [
			{
				role: 'Setup Sweeper',
				movepool: ['Swords Dance', 'Flare Blitz', 'Facade', 'Close Combat'],
				abilities: ['Kindled Fury'],
				teraTypes: ['Fire'],
				item: 'Heavy-Duty Boots',
				nature: 'Adamant',
				evs: { atk: 252, def: 4, spe: 252 },
			},
			{
				role: 'Wallbreaker',
				movepool: ['Flare Blitz', 'Facade', 'Close Combat', 'Knock Off'],
				abilities: ['Kindled Fury'],
				teraTypes: ['Normal'],
				item: 'Choice Band',
				nature: 'Adamant',
				evs: { atk: 252, def: 4, spe: 252 },
			},
		],
	},
	glaceon: {
		level: 80,
		sets: [
			{
				role: 'Setup Sweeper',
				movepool: ['Blizzard', 'Freeze-Dry', 'Earth Power', 'Aurora Veil'],
				abilities: ['Diamond Dust'],
				teraTypes: ['Ice'],
				item: 'Life Orb',
				nature: 'Timid',
				evs: { spa: 252, spd: 4, spe: 252 },
			},
		],
	},
	spiritomb: {
		level: 88,
		sets: [
			{
				role: 'Bulky Support',
				movepool: ['Soul Toll', 'Strength Sap', 'Parting Shot', 'Will-O-Wisp'],
				abilities: ['Keystone Legion'],
				teraTypes: ['Fairy'],
				item: 'Leftovers',
				nature: 'Calm',
				evs: { hp: 252, def: 4, spd: 252 },
			},
		],
	},
};

/** Held by the family whenever they turn up here - it is their item. */
const ITEMS = {
	simisage: 'Elemental Banana',
	simisear: 'Elemental Banana',
	simipour: 'Elemental Banana',
};

let installed = false;

/**
 * Teach the random team generator about them.
 *
 * Two things have to be added, and missing either one produces a format that
 * looks fine and never rolls a monkey:
 *
 *   1. the set table, which is what the pool is built from in the first place
 *   2. the pool filter, which drops anything flagged as belonging to a past
 *      generation - which all three of these are, having last appeared in Black
 *      and White
 *   3. the item chooser, which knows nothing about an item that is not on
 *      Showdown's own list
 *
 * Everything is scoped to this one format by checking the format id on the
 * generator, so the ordinary Random Battle ladder sees none of it.
 */
function installRandomSets() {
	if (installed) return true;

	let teams;
	for (const where of ['../random-battles/gen9/teams.js', 'pokemon-showdown/dist/data/random-battles/gen9/teams.js']) {
		try {
			teams = require(where);
			break;
		} catch (e) {
			// Try the next one; the path differs between the copy inside the
			// package and this repository's own.
		}
	}
	const RandomTeams = teams && (teams.default || teams.RandomTeams);
	if (!RandomTeams || !RandomTeams.prototype) return false;

	installed = true;

	const ours = species => !!SETS[species && species.id];
	const isRp = generator => generator && generator.format && generator.format.id === FORMAT;

	// 1. The sets, which is all it takes: the species pool is built from the
	//    keys of this table, so a Pokemon with a set here is eligible and one
	//    without is not. Being absent from Scarlet and Violet never came into it.
	//
	//    Copied onto the instance rather than added to the table. That table is
	//    a require()d JSON file, so every generator in the process shares one
	//    object and writing into it would put three monkeys into the ordinary
	//    Random Battle ladder from the first RP game onwards - quietly, and for
	//    as long as the process lived.
	const original = RandomTeams.prototype.randomTeam;
	RandomTeams.prototype.randomTeam = function () {
		if (isRp(this) && this.randomSets) {
			this.randomSets = Object.assign({}, this.randomSets, SETS);
		}
		return original.apply(this, arguments);
	};

	// 2. The item, which the generator would otherwise pick for them.
	const item = RandomTeams.prototype.getItem;
	RandomTeams.prototype.getItem = function (ability, types, moves, counter, teamDetails, species) {
		if (isRp(this) && ours(species) && ITEMS[species.id]) return ITEMS[species.id];
		return item.apply(this, arguments);
	};

	return true;
}

exports.SETS = SETS;
exports.ITEMS = ITEMS;
exports.FORMAT = FORMAT;
exports.installRandomSets = installRandomSets;
