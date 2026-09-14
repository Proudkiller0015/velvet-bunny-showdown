'use strict';
/**
 * Where this server puts a Pokemon, when it disagrees with Smogon.
 *
 * The RP tiers stand on National Dex's lists, which is the part nobody should
 * invent from scratch: they are built from real usage and they update when
 * Smogon updates. This file is the exception list - the handful of Pokemon this
 * server has decided belong somewhere else, with the reason written down beside
 * each one.
 *
 * A tier here is not a ban. Moving a Pokemon to Ubers does not remove it from
 * the game; it puts it in the tier where the things that answer it live, and
 * the existing banlists do the rest without a line of ours deciding anything.
 *
 * This is deliberately dex-wide rather than RP-only. "RP is its own tier" cuts
 * both ways: the dex this server runs is one dex, and a Gliscor that is Uber in
 * RP OU and OU in National Dex is two different Pokemon wearing one name. Every
 * other thing in data/velvet works the same way.
 */

/**
 * Smogon's tiers, strongest first. Shared shape with data/velvet/za-megas.js -
 * the two files disagreeing about what "above RU" means is a bug waiting to
 * happen.
 */
const LADDER = [
	'AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU',
	'NUBL', 'NU', 'PUBL', 'PU', 'ZUBL', 'ZU',
];

/**
 * The exceptions, and why.
 *
 * Keep the reason with the entry. A tier change with no reason beside it is
 * impossible to revisit later, because nobody remembers whether it was a
 * considered decision or a bad afternoon.
 */
const TIERS = {
	// Poison Heal plus Protect plus Toxic plus Substitute is a Pokemon that wins
	// by not losing, and the things that break it through are largely the things
	// already in Ubers. Moved up rather than banned outright so it still has a
	// tier to be played in.
	gliscor: 'Uber',
};

/**
 * Put the decisions into the tier tables.
 *
 * Both `tier` and `natDexTier` are set. The first is what a plain
 * ninth-generation format reads and the second is what National Dex reads, and
 * the RP tiers are built on National Dex - so the one that matters here is the
 * second. They are kept in step rather than allowed to drift, because two
 * numbers describing one Pokemon is how it ends up legal in one place and not
 * its mirror.
 */
exports.applyTiers = (FormatsData, log = () => {}) => {
	const applied = {};
	for (const [id, tier] of Object.entries(TIERS)) {
		if (!LADDER.includes(tier)) {
			log(`${id} is set to "${tier}", which is not a tier - skipped`);
			continue;
		}
		const data = FormatsData[id];
		if (!data) {
			log(`${id} has no tier data, so it cannot be re-tiered`);
			continue;
		}
		data.tier = tier;
		data.natDexTier = tier;
		applied[id] = tier;
	}
	return applied;
};

exports.TIERS = TIERS;
exports.LADDER = LADDER;
