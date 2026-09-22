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
/*
 * The whole stock table, brought up to date with this server's buffs - for RP
 * Random Battle. Showdown's sets were written for Showdown's Pokemon: Banette
 * without its Prankster or its Dark moves, Gengar without Twilight Exit,
 * Regigigas with a Slow Start it no longer has. Built once per dex, from the
 * same buff records the teambuilder reads (buffs.js `applied`).
 *
 *   - abilities: only ones the species really has, plus its Awakened ones;
 *   - moves: its Awakened moves, each only where the role would use it -
 *     attacks on the side the set attacks from (or STAB), setup on setup roles,
 *     pivots on support and fast roles, recovery/hazards/status on support and
 *     bulky roles. At most four added per set, best first.
 */
const EXTRA_MOVES = { banette: () => { try { return require('./halloween.js').DARK_MOVES; } catch (e) { return []; } } };
const SUPPORTISH = ['Bulky Support', 'Fast Support', 'Bulky Attacker', 'Bulky Setup'];
const SETUPISH = ['Setup Sweeper', 'Bulky Setup', 'Fast Bulky Setup', 'Tera Blast user'];
const FASTISH = ['Fast Attacker', 'Fast Support', 'Wallbreaker'];
let buffedCache = null;
function buffedTable(dex, base) {
	if (buffedCache && buffedCache.base === base) return buffedCache.table;
	let applied = {};
	let RS = null;
	try { applied = require('./buffs.js').applied || {}; } catch (e) {}
	try { RS = require('../../../../../src/role-sets.js'); } catch (e) {
		try { RS = require(require('path').join(process.cwd(), 'src', 'role-sets.js')); } catch (e2) {}
	}
	const lists = RS || { RECOVERY: [], HAZARDS: [], STATUS: [], UTILITY: [], PIVOTS: [] };
	const table = {};
	for (const [id, entry] of Object.entries(base)) {
		const species = dex.species.get(id);
		if (!species.exists || !entry || !entry.sets) { table[id] = entry; continue; }
		const own = Object.values(species.abilities).filter(Boolean);
		const record = applied[id] || { moves: [], abilities: [] };
		const extra = [...(record.moves || []), ...((EXTRA_MOVES[id] && EXTRA_MOVES[id]()) || [])]
			.map(m => dex.moves.get(m)).filter((m, i, all) => m.exists && !m.isNonstandard && all.findIndex(o => o.id === m.id) === i);
		const awakened = (record.abilities || []).filter(a => own.includes(a));
		table[id] = Object.assign({}, entry, { sets: entry.sets.map(set => {
			let abilities = (set.abilities || []).filter(a => own.includes(a));
			for (const a of awakened) if (!abilities.includes(a)) abilities.push(a);
			// An Awakened ability that is the species' default (Regigigas: Colossus Unbound
			// ahead of Slow Start) is the set's ability, not one of two it might roll.
			if (awakened.includes(species.abilities[0])) abilities = [species.abilities[0]];
			if (!abilities.length) abilities = own.slice(0, 1);
			const pool = set.movepool.map(n => dex.moves.get(n));
			const attacks = pool.filter(m => m.category !== 'Status');
			const physical = attacks.filter(m => m.category === 'Physical').length >= attacks.length / 2;
			const side = physical ? 'Physical' : 'Special';
			const fits = m => {
				if (pool.some(p => p.id === m.id)) return false;
				// No filler: an attack only if it would actually be picked - real power, or
				// priority, a switch, or Knock Off. (Adding every learnable move is how weak
				// moves like Bite or Flame Charge end up crowding out good ones.)
				if (m.category !== 'Status') {
					const worth = m.basePower >= 75 || m.priority > 0 || m.selfSwitch || m.id === 'knockoff';
					return worth && (m.category === side || species.types.includes(m.type));
				}
				if (set.role === 'AV Pivot') return false;
				const setup = (m.boosts && m.target === 'self') || (m.self && m.self.boosts);
				if (setup) return SETUPISH.includes(set.role);
				// Trick Room pivots belong on slow Pokemon or support; on a fast attacker the
				// room works against it. Ordinary pivots suit support and fast roles.
				if (m.selfSwitch && m.pseudoWeather === 'trickroom') return species.baseStats.spe <= 70 || set.role === 'Bulky Support' || set.role === 'Fast Support';
				if (m.selfSwitch) return SUPPORTISH.includes(set.role) || FASTISH.includes(set.role);
				if ([...lists.RECOVERY, ...lists.HAZARDS, ...lists.STATUS, ...lists.UTILITY].includes(m.id)) return SUPPORTISH.includes(set.role) || set.role === 'Fast Support';
				return false;
			};
			const value = m => (m.category === 'Status' ? 50 : (RS ? RS.attackValue(species, m, side) : m.basePower));
			const added = extra.filter(fits).sort((a, b) => value(b) - value(a)).slice(0, 4).map(m => m.name);
			return Object.assign({}, set, { abilities, movepool: [...set.movepool, ...added] });
		}) });
	}
	buffedCache = { base, table };
	return table;
}

/* Abilities a Pokemon no longer has on this server (Regigigas's Slow Start),
 * replaced in every Gen 9 random format, RP or not: the stock sets would
 * otherwise hand out an ability the dex says it cannot have. */
function withRealAbilities(dex, base) {
	let out = null;
	for (const [id, entry] of Object.entries(base)) {
		const species = dex.species.get(id);
		if (!species.exists || !entry || !entry.sets) continue;
		const own = Object.values(species.abilities).filter(Boolean);
		if (entry.sets.every(set => (set.abilities || []).every(a => own.includes(a)))) continue;
		out = out || Object.assign({}, base);
		out[id] = Object.assign({}, entry, { sets: entry.sets.map(set => {
			const abilities = (set.abilities || []).filter(a => own.includes(a));
			return Object.assign({}, set, { abilities: abilities.length ? abilities : own.slice(0, 1) });
		}) });
	}
	return out || base;
}

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
		if (this.randomSets && this.dex) {
			if (isRp(this)) this.randomSets = Object.assign({}, buffedTable(this.dex, this.randomSets), SETS);
			else this.randomSets = withRealAbilities(this.dex, this.randomSets);
		}
		return original.apply(this, arguments);
	};

	// 1b. A guard for Showdown's own generator. Its MOVE_PAIRS list pairs Leech
	//     Seed with both Protect and Substitute, so a set holding all three pops
	//     Leech Seed twice and the second pop (index -1) throws. Stock sets are
	//     four moves long and never reach that step; ours, with Solar Nectar or
	//     another Awakened move added, do. Popping nothing is the right answer.
	const pop = RandomTeams.prototype.fastPop;
	RandomTeams.prototype.fastPop = function (list, index) {
		if (index < 0 && isRp(this)) return undefined;
		return pop.apply(this, arguments);
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
