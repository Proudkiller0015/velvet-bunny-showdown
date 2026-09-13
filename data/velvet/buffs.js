'use strict';
/**
 * Pokemon this server buffs, and what they get.
 *
 * Some Pokemon were left behind: never given the moves their whole type got in
 * later generations, never given an ability worth the slot, and never revisited
 * since. This is where that is fixed, one Pokemon at a time, deliberately.
 *
 * A buff is additive. Nothing is taken away - the original moves, abilities and
 * stats are all still there - so a buffed Pokemon is the Pokemon you know plus
 * the things it should have had.
 *
 * Buffs apply everywhere the data does, which means every format on this
 * server. They are ours; a Simisage here is not a Simisage on Showdown, and the
 * RP tiers are where that is the point.
 *
 * The client shows each list in its own section in the teambuilder, so it is
 * obvious what is a buff and what came with the Pokemon - see
 * client/js/velvet-buffs.js, which is generated from this file.
 */

/**
 * The elemental monkeys.
 *
 * Three fully evolved Pokemon with 480 base stats, no niche, and movepools that
 * stopped being updated around 2011: no Grassy Glide for the grass one, no
 * Liquidation for the water one, no Temper Flare for the fire one, and between
 * them not a single weather ability despite being the most on-the-nose weather
 * trio in the game.
 *
 * So: each sets its own weather, each gets the standard moves of its type that
 * its whole type received and it did not, and each gets Simian Rush - a move
 * that is fast precisely when their own weather is up, which is the reason to
 * bring one.
 *
 * The moves were not picked by taste. Each list is what at least 45% of that
 * type learns and this Pokemon does not, which is how "everyone got this but
 * them" was measured rather than assumed.
 */
/**
 * What every monkey in the game gets, and these three somehow did not.
 *
 * Measured the same way as everything else here: every status move that at
 * least 45% of the primate Pokemon learn - Mankey through Annihilape, the
 * Chimchar and Grookey lines, Aipom, Oranguru, Passimian - and that at least one
 * of the simi family cannot. Sword Dance and Nasty Plot are on the list by name
 * because they were asked for; both were already half-distributed across the
 * three, which is the exact problem this list exists to fix.
 *
 * All three get all of it. That is the "equalize" part: there was no reason for
 * Simisage to have Swords Dance and Simisear not, or for Simipour alone to know
 * Sunny Day, beyond nobody ever looking. Anything a monkey already learns is
 * skipped rather than duplicated, so this list is safe to grow.
 */
/**
 * Coverage, of the kind a monkey ought to have.
 *
 * These three are primates with fists and nothing to hit anything with. Every
 * other monkey in the game got the punches, the Fighting moves, or both -
 * Infernape, Primeape and Rillaboom are built out of them - while the simi
 * family was left with its own type and Acrobatics.
 *
 * So: the Fighting coverage that makes a monkey a monkey, the three elemental
 * punches, and enough rock to answer the birds that wall them. Shared across all
 * three for the same reason the status list is: there was never a reason for
 * them to differ, only an oversight.
 */
const MONKEY_COVERAGE = [
	'closecombat', 'focusblast', 'drainpunch', 'machpunch',
	'icepunch', 'firepunch', 'thunderpunch',
	'rockslide', 'stoneedge',
	'uturn', 'knockoff',
];

const MONKEY_STATUS = [
	'nastyplot', 'swordsdance', 'bulkup',
	'focusenergy', 'screech', 'scaryface',
	'encore', 'psychup', 'spite', 'curse',
	'quickguard', 'metronome',
	'sunnyday', 'raindance',
	'taunt', 'substitute',
];

/**
 * The elemental monkeys.
 *
 * Three fully evolved Pokemon with 480 base stats, no niche, and movepools that
 * stopped being updated around 2011: no Grassy Glide for the grass one, no
 * Liquidation for the water one, no Temper Flare for the fire one, and between
 * them not a single weather ability despite being the most on-the-nose weather
 * trio in the game.
 *
 * So: each sets its own weather, each gets the standard moves of its type that
 * its whole type received and it did not, each gets the 50 BP Speed-raising move
 * of its own type (Trailblaze, Flame Charge, and Wave Charge, which had to be
 * written because Water never got one), and each gets its own Rush move - Jungle,
 * Cinder and Torrent - which is fast precisely when that monkey's own weather
 * is up, and is the reason to bring one.
 *
 * The attacking moves were not picked by taste. Each list is what at least 45%
 * of that type learns and this Pokemon does not, which is how "everyone got this
 * but them" was measured rather than assumed.
 */
const MONKEYS = {
	simisage: {
		abilities: ['Verdant Surge'],
		moves: [
			'grassyglide', 'grassyterrain', 'trailblaze',
			'growth', 'endure', 'terablast', 'junglerush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
	simisear: {
		abilities: ['Solar Surge'],
		moves: [
			'temperflare', 'burningjealousy', 'flamecharge', 'ember',
			'endure', 'terablast', 'cinderrush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
	simipour: {
		abilities: ['Tidal Surge'],
		moves: [
			'liquidation', 'chillingwater', 'muddywater', 'whirlpool', 'wavecharge',
			'endure', 'terablast', 'torrentrush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
};

exports.Buffs = {
	...MONKEYS,
};

/**
 * Add the abilities to a species, past the three slots it has.
 *
 * A species carries its abilities as slots - 0, 1, H for hidden, S for a one-off
 * event - and there are only ever four. A buff can hand out more than that, so
 * the extras go in under keys of our own. The engine reads the values rather
 * than the keys wherever it matters (the validator checks membership, the
 * client reads the four it knows), so an extra key is invisible to everything
 * that should not see it and available to everything that should.
 */
function addAbilities(species, abilities) {
	const existing = new Set(Object.values(species.abilities || {}));
	let extra = 0;
	for (const ability of abilities) {
		if (existing.has(ability)) continue;
		if (!species.abilities['1']) species.abilities['1'] = ability;
		else if (!species.abilities['H']) species.abilities['H'] = ability;
		else if (!species.abilities['S']) species.abilities['S'] = ability;
		else species.abilities[`V${extra++}`] = ability;
		existing.add(ability);
	}
}

/**
 * Does this Pokemon already get this move, counting what it learned as a baby?
 *
 * A learnset entry only lists what that stage learns itself; everything from
 * earlier stages comes along implicitly, and the validator knows it. So asking
 * `Learnsets.simisage.learnset.nastyplot` gets "no" for a move Simisage has
 * always had, because it is Pansage who learns it.
 *
 * Getting this wrong does nothing to the game - adding a move twice is harmless
 * - but it would have the client announcing Nasty Plot, Sunny Day and Flame
 * Charge as things this server handed out, which is the one thing the buff
 * display exists not to do.
 */
function alreadyKnows(Pokedex, Learnsets, id, move) {
	const seen = new Set();
	let current = id;
	while (current && !seen.has(current)) {
		seen.add(current);
		if (Learnsets[current] && Learnsets[current].learnset && Learnsets[current].learnset[move]) return true;
		const species = Pokedex[current];
		const prevo = species && species.prevo;
		current = prevo ? String(prevo).toLowerCase().replace(/[^a-z0-9]+/g, '') : null;
	}
	return false;
}

/**
 * What the buffs actually changed, filled in as they are applied.
 *
 * Not the same thing as the lists above. A buff names everything a Pokemon
 * should have, including moves it already had - Substitute and Taunt are on the
 * monkey list because two of the three were missing them - and showing those to
 * a player as "new" would be a lie. This records only what was really added, so
 * the client can label a move as ours because it is.
 *
 * Read by scripts/build-buffs.js, which turns it into client/js/velvet-buffs.js.
 */
exports.applied = {};

/** Put the buffs into the dex the server is about to use. */
exports.applyBuffs = (Pokedex, Learnsets) => {
	for (const [id, buff] of Object.entries(exports.Buffs)) {
		const species = Pokedex[id];
		if (!species) continue;   // a Pokemon that no longer exists is not an error

		const record = exports.applied[id] || (exports.applied[id] = { moves: [], abilities: [] });
		const hadAbilities = new Set(Object.values(species.abilities || {}));

		if (buff.abilities?.length) addAbilities(species, buff.abilities);
		for (const ability of Object.values(species.abilities || {})) {
			if (!hadAbilities.has(ability) && !record.abilities.includes(ability)) {
				record.abilities.push(ability);
			}
		}

		if (buff.moves?.length && Learnsets) {
			const entry = Learnsets[id] || (Learnsets[id] = { learnset: {} });
			entry.learnset = entry.learnset || {};
			for (const move of buff.moves) {
				// '9M' is "taught by machine, generation 9". The letter is not
				// decoration: the validator dispatches on it and only knows L, M, T,
				// R, E, S, D and V, so a source it does not recognise is walked
				// straight past and the move comes back unlearnable. '9a' belongs to
				// the client's teambuilder table, which is a different file in a
				// different format - see installBuffs() in client/js/velvet-data.js.
				if (alreadyKnows(Pokedex, Learnsets, id, move)) continue;
				entry.learnset[move] = ['9M'];
				if (!record.moves.includes(move)) record.moves.push(move);
			}
		}
	}
};
