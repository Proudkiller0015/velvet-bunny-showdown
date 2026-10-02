'use strict';
/**
 * Halloween 2026, the second board: MissingNo.
 *
 * The glitch itself, as it was: Bird/Normal, 33 / 136 / 0 / 6 / 6 / 29. The owner's
 * call (2 Oct 2026): "it's a glitch, it's not meant to be good" - the numbers stay
 * broken and the ability carries it one hundred per cent.
 *
 *   Glitched Data     No single hit takes more than a quarter of its HP, and an item
 *                     it uses up is back at the end of the turn (the item duplication
 *                     glitch: the sixth item in the bag, 128 of it).
 *   Data Corruption   Bird, physical, 90, 100% (the owner: "the atk will be bird type"). 30% to leave
 *                     the target burned, paralysed or poisoned, whichever comes up.
 *
 * Showdown ships MissingNo. as a Custom species with its Gen 1 moves; here it is made
 * standard, tiered RU, and given a modern movepool. Bird is not a type the engine
 * knows: it takes and deals neutral damage, which is exactly what a glitch type does.
 */

const ID = 'missingno';
const ABILITY = 'Glitched Data';
const MOVE = 'Data Corruption';

// What it knew in Red and Blue stays (Water Gun twice, Sky Attack); the rest is new.
const MODERN = [
	// Normal and "Bird"
	'bodyslam', 'facade', 'return', 'frustration', 'hyperbeam', 'gigaimpact', 'quickattack', 'extremespeed', 'headbutt', 'payday', 'tackle', 'slam', 'thrash',
	'bravebird', 'drillpeck', 'peck', 'wingattack', 'aerialace', 'acrobatics', 'dualwingbeat', 'hurricane', 'airslash', 'gust',
	// what a pile of scrambled tiles can throw
	'knockoff', 'suckerpunch', 'shadowsneak', 'shadowclaw', 'phantomforce', 'rockslide', 'stoneedge', 'ironhead', 'drainpunch', 'superpower', 'uturn', 'waterfall',
	'liquidation', 'surf', 'hydropump', 'bubble', 'thunderbolt', 'shadowball', 'terablast', 'leechlife', 'xscissor', 'lunge', 'firstimpression', 'pounce', 'bugbite',
	// items: the glitch it is known for
	'recycle', 'trick', 'switcheroo', 'fling', 'thief', 'covet', 'naturalgift', 'stuffcheeks', 'belch', 'embargo', 'magicroom',
	// status and set-up
	'trickroom', 'bulkup', 'curse', 'agility', 'protect', 'sleeptalk', 'recover', 'roost', 'painsplit', 'taunt', 'encore', 'disable', 'glare', 'willowisp', 'confuseray',
	'metronome', 'transform', 'conversion', 'conversion2', 'mimic', 'haze', 'stealthrock', 'spikes', 'defog', 'endure', 'endeavor', 'destinybond', 'trickortreat',
];

exports.pokedex = (data) => {
	const mon = data[ID];
	if (!mon) return data;
	// Its own generation, so every National Dex RP format from Gen 1 on takes it.
	data[ID] = { ...mon, gen: 1, abilities: { 0: ABILITY }, tags: [], color: 'Gray' };
	return data;
};

exports.formatsData = (data) => {
	// RU for now (the owner). Nothing below: it is not in standard Showdown's dex at all.
	data[ID] = { isNonstandard: null, tier: 'RU', doublesTier: 'DUU', natDexTier: 'RU' };
	return data;
};

exports.abilities = (data) => {
	data.glitcheddata = {
		name: ABILITY,
		num: -62,
		gen: 9,
		rating: 5,
		onStart(pokemon) {
			this.add('-ability', pokemon, ABILITY);
			this.add('-message', `${pokemon.name}'s data is too corrupted to erase in one go!`);
		},
		/*
		 * A hit is capped at a quarter of its maximum HP. Only attacks: poison, burn,
		 * weather, hazards, recoil and fixed residual damage go through as they are,
		 * which is how it is beaten. Multi-hit moves count each hit on its own.
		 */
		onDamagePriority: -30,
		onDamage(damage, target, source, effect) {
			if (!effect || effect.effectType !== 'Move') return;
			const cap = Math.max(1, Math.floor(target.baseMaxhp / 4));
			if (damage > cap) {
				this.add('-activate', target, `ability: ${ABILITY}`);
				return cap;
			}
		},
		/*
		 * The item duplication glitch: whatever it used up (a Berry eaten, a Gem
		 * spent, a Weakness Policy fired, a thing flung) is in its hand again at the
		 * end of the turn. Not an item taken from it: Knock Off and Trick still work.
		 */
		onResidualOrder: 28,
		onResidualSubOrder: 2,
		onResidual(pokemon) {
			if (!pokemon.hp || pokemon.item || !pokemon.lastItem) return;
			// Taken by somebody else: nothing to duplicate (Harvest's own rule).
			const item = this.dex.items.get(pokemon.lastItem);
			if (!item.exists || pokemon.velvetItemTaken === pokemon.lastItem) return;
			pokemon.setItem(pokemon.lastItem);
			pokemon.lastItem = '';
			this.add('-item', pokemon, pokemon.getItem(), `[from] ability: ${ABILITY}`);
			this.add('-message', `${pokemon.name} duplicated its ${item.name}!`);
		},
		// Breakable like Multiscale and Disguise: Mold Breaker hits it for the full amount.
		flags: { breakable: 1 },
		shortDesc: 'A hit takes at most 1/4 of its max HP. A used-up item returns at the end of the turn.',
		desc: "Damage this Pokemon takes from a single hit of an attack is capped at 1/4 of its maximum HP, rounded down; other damage is not capped. At the end of each turn, if this Pokemon has no item and it consumed, used up or flung its last one, that item is restored. An item removed by a foe is not restored. Moves and abilities that ignore abilities ignore the damage cap.",
	};
	return data;
};

exports.moves = (data) => {
	data.datacorruption = {
		num: -62,
		gen: 9,
		accuracy: 100,
		basePower: 90,
		category: 'Physical',
		name: MOVE,
		pp: 15,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		// Tri Attack's roll, with poison in place of the freeze.
		secondary: {
			chance: 30,
			onHit(target, source) {
				const result = this.random(3);
				if (result === 0) target.trySetStatus('brn', source);
				else if (result === 1) target.trySetStatus('par', source);
				else target.trySetStatus('psn', source);
			},
		},
		target: 'normal',
		type: 'Bird',
		// Ours alone: never filed with the shared Awakened moves.
		shortDesc: '30% chance to burn, paralyze or poison the target.',
		desc: 'Has a 30% chance to either burn, paralyze or poison the target.',
	};
	return data;
};

exports.learnsets = (data) => {
	const learnset = { ...((data[ID] || {}).learnset || {}) };
	learnset.datacorruption = ['9L1'];
	for (const move of MODERN) if (!learnset[move]) learnset[move] = ['9M'];
	data[ID] = { ...(data[ID] || {}), learnset };
	return data;
};

// For scripts/build-signature-moves.js: handed out here, so none of them is its signature.
exports.MODERN = MODERN;
exports.ID = ID;
exports.SPECIES = [ID];
exports.MOVE_IDS = ['datacorruption'];
exports.ABILITY_IDS = ['glitcheddata'];
exports.EVENT_SPECIES = [ID];
// "glitch" and "no" find it, the way "valiant" finds Iron Valiant: [alias, where in the id it starts].
exports.SEARCH_ALIASES = [['glitch', 0], ['missingnumber', 0], ['missing', 0]];
